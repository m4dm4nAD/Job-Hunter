// Generic, score-based job-page detector.
// Runs on every URL (host_permissions: <all_urls>) and decides per page whether
// the user is looking at / applying to a job, regardless of which site or ATS.

const APPLICATION_FIELD_PATTERNS = [
  /\bresume\b|\bcv\b/i,
  /cover.*letter/i,
  /work.*experience|employment.*history/i,
  /education.*background|highest.*degree/i,
  /linkedin.*profile|portfolio.*url|github.*profile/i,
  /why (do you want|are you applying|are you interested)/i,
  /salary.*expectation|expected.*salary|desired.*salary/i,
  /authoriz.*work|work.*authorization|sponsor.*visa/i
];

// Button text must be application-specific. Bare "Submit" / "Apply" are too
// common (filter UIs, image uploaders, comment forms) and were the main source
// of false positives.
const APPLY_BUTTON_TEXT_PATTERNS = [
  /submit application/i,
  /apply now/i,
  /easy apply/i,
  /apply for (this|the) (job|position|role|opening)/i,
  /apply on company/i,
  /send application/i,
  /finish application/i,
  /complete application/i,
  /review (and )?submit application/i
];

const URL_HINT_PATTERN = /\/(jobs?|careers?|apply|positions?|openings?|opportunit(y|ies)|recruit|hiring)(\/|$|\?)/i;

const ATTACHED_MARK = 'data-jht-attached';
const SCAN_DEBOUNCE_MS = 400;
// Threshold of 6 means a single weak signal (a bare file input, a generic
// "apply" button, or a URL hint alone) cannot push a page over the line.
// Real job pages reliably stack: ATS match, JobPosting schema, or
// (resume-context form + apply button) all clear it.
const SCORE_THRESHOLD = 6;

const PROVIDERS = (typeof window !== 'undefined' && window.JHT_ATS_PROVIDERS) || [];

let lastSeenUrl = location.href;
let scanScheduled = false;
let lastMarkedUrl = null;
let observer = null;

// ---- Cheap precheck so we do near-zero work on non-job pages ------------------

function pageCouldBeJobPage() {
  // Any of these means it's at least worth scoring properly.
  if (URL_HINT_PATTERN.test(location.pathname)) return true;
  if (matchProviderByUrl()) return true;

  if (document.querySelector('script[type="application/ld+json"]')) return true;
  if (document.querySelector('input[type="file"]')) return true;

  const title = document.title || '';
  if (/job|career|position|hiring|apply/i.test(title)) return true;

  return false;
}

// ---- Provider matching --------------------------------------------------------

function matchProviderByUrl() {
  for (const p of PROVIDERS) {
    if (!p.urlPatterns) continue;
    if (p.urlPatterns.some(re => re.test(location.href))) return p;
  }
  return null;
}

function matchProviderByDom() {
  for (const p of PROVIDERS) {
    if (!p.selectors) continue;
    for (const sel of p.selectors) {
      try {
        if (document.querySelector(sel)) return p;
      } catch (e) { /* invalid selector — skip */ }
    }
  }
  return null;
}

function getProvider() {
  return matchProviderByUrl() || matchProviderByDom();
}

// ---- Universal signals --------------------------------------------------------

function detectJobPostingSchema() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    const txt = s.textContent;
    if (!txt || !/JobPosting/i.test(txt)) continue;
    try {
      const data = JSON.parse(txt);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const found = findJobPostingNode(item);
        if (found) return found;
      }
    } catch (e) { /* malformed JSON-LD — ignore */ }
  }
  return null;
}

function findJobPostingNode(node) {
  if (!node || typeof node !== 'object') return null;
  const t = node['@type'];
  if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) return node;
  if (Array.isArray(node['@graph'])) {
    for (const child of node['@graph']) {
      const found = findJobPostingNode(child);
      if (found) return found;
    }
  }
  return null;
}

// Returns { form, kind } where kind is 'resume' (strong) or 'fields' (medium).
// A bare <input type=file> is NOT enough — Instagram, Chrono24, banking, etc.
// all have file uploads. Require resume-specific context.
function findApplicationForm() {
  for (const form of Array.from(document.forms || [])) {
    const fields = Array.from(form.querySelectorAll('input, textarea, select'));
    if (fields.length < 2) continue;

    const fileInputs = fields.filter(f => f.type === 'file');
    const hasResumeFileInput = fileInputs.some(fi => {
      const meta = [
        fi.name, fi.id, fi.placeholder,
        fi.getAttribute('aria-label'),
        fi.getAttribute('accept')
      ].filter(Boolean).join(' ');
      return /\bresume\b|\bcv\b|cover.*letter/i.test(meta);
    });
    if (hasResumeFileInput) return { form, kind: 'resume' };

    const fieldText = fields
      .map(f => [f.name, f.id, f.placeholder, f.getAttribute('aria-label')].filter(Boolean).join(' '))
      .concat(Array.from(form.querySelectorAll('label')).map(l => (l.textContent || '').trim()))
      .join(' ');
    const fieldMatches = APPLICATION_FIELD_PATTERNS.filter(p => p.test(fieldText)).length;
    // Need ≥2 distinct application-specific patterns to count — single matches
    // (e.g. a generic "experience" placeholder) are too noisy.
    if (fieldMatches >= 2) return { form, kind: 'fields' };
  }
  return null;
}

function findApplyButtons(provider) {
  const found = new Set();

  if (provider && provider.applyButtonSelectors) {
    for (const sel of provider.applyButtonSelectors) {
      try { document.querySelectorAll(sel).forEach(el => found.add(el)); } catch (e) {}
    }
  }

  const candidates = document.querySelectorAll(
    'button, input[type="submit"], input[type="button"], a[role="button"]'
  );
  candidates.forEach(el => {
    if (el.disabled) return;
    const text = (el.value || el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
    if (!text || text.length > 60) return;
    if (APPLY_BUTTON_TEXT_PATTERNS.some(p => p.test(text))) found.add(el);
  });

  return Array.from(found);
}

function getOpenGraphJob() {
  const og = document.querySelector('meta[property="og:type"]');
  if (!og) return false;
  // Strict match — broad /job/i hit unrelated values like "profile" subtypes.
  return /^(job|jobposting|profile:job)$/i.test((og.content || '').trim());
}

// ---- Scoring ------------------------------------------------------------------

function scorePage() {
  const reasons = [];
  let score = 0;

  const schema = detectJobPostingSchema();
  if (schema) { score += 10; reasons.push('JSON-LD JobPosting'); }

  const provider = getProvider();
  if (provider) { score += 8; reasons.push(`ATS: ${provider.name}`); }

  const formMatch = findApplicationForm();
  const form = formMatch ? formMatch.form : null;
  if (formMatch) {
    if (formMatch.kind === 'resume') { score += 5; reasons.push('Resume upload field'); }
    else { score += 4; reasons.push('Application form fields'); }
  }

  const buttons = findApplyButtons(provider);
  if (buttons.length > 0) { score += 3; reasons.push(`${buttons.length} apply button(s)`); }

  if (URL_HINT_PATTERN.test(location.pathname)) { score += 1; reasons.push('URL hint'); }
  if (getOpenGraphJob()) { score += 2; reasons.push('og:type=job'); }

  return { score, reasons, schema, provider, form, buttons };
}

// ---- Title / company extraction ----------------------------------------------

function extractTitle(schema) {
  if (schema && typeof schema.title === 'string' && schema.title.trim()) return schema.title.trim();

  const selectors = [
    '[data-job-title]',
    'h1[class*="job-title" i]',
    'h1[class*="position-title" i]',
    '.job-title',
    '.position-title',
    'h1'
  ];
  for (const sel of selectors) {
    try {
      const node = document.querySelector(sel);
      if (node) {
        const text = (node.textContent || '').trim();
        if (text && text.length < 200) return text;
      }
    } catch (e) {}
  }
  return document.title || window.location.hostname;
}

function extractCompany(schema) {
  if (schema && schema.hiringOrganization) {
    const org = schema.hiringOrganization;
    if (typeof org === 'string') return org;
    if (org && typeof org.name === 'string') return org.name;
  }
  const og = document.querySelector('meta[property="og:site_name"]');
  if (og && og.content) return og.content.trim();
  return null;
}

// ---- Listener wiring ----------------------------------------------------------

function recordApplicationEvent(eventType, ctx) {
  chrome.runtime.sendMessage({
    action: 'recordApplicationEvent',
    url: window.location.href,
    title: extractTitle(ctx && ctx.schema),
    company: extractCompany(ctx && ctx.schema),
    ats: ctx && ctx.provider ? ctx.provider.name : null,
    eventType
  });
}

function markApplicationPage(ctx) {
  const url = window.location.href;
  if (lastMarkedUrl === url) return;
  lastMarkedUrl = url;

  chrome.runtime.sendMessage({
    action: 'markApplicationPage',
    url,
    title: extractTitle(ctx.schema),
    company: extractCompany(ctx.schema),
    ats: ctx.provider ? ctx.provider.name : null,
    score: ctx.score,
    reasons: ctx.reasons
  });
}

function attachListeners(form, buttons, ctx) {
  if (form && !form.hasAttribute(ATTACHED_MARK)) {
    form.setAttribute(ATTACHED_MARK, 'true');
    form.addEventListener('submit', () => recordApplicationEvent('form-submit', ctx), true);
  }
  buttons.forEach(btn => {
    if (btn.hasAttribute(ATTACHED_MARK)) return;
    btn.setAttribute(ATTACHED_MARK, 'true');
    btn.addEventListener('click', () => recordApplicationEvent('button-click', ctx), true);
  });
}

// ---- Scan loop ----------------------------------------------------------------

function scanNow() {
  scanScheduled = false;

  if (!pageCouldBeJobPage()) return;

  const ctx = scorePage();

  if (ctx.score >= SCORE_THRESHOLD) {
    markApplicationPage(ctx);
    attachListeners(ctx.form, ctx.buttons, ctx);
  } else if (ctx.form || ctx.buttons.length > 0) {
    // Below threshold but has plausible form/button — still attach so a real submit gets logged.
    attachListeners(ctx.form, ctx.buttons, ctx);
  }
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  setTimeout(scanNow, SCAN_DEBOUNCE_MS);
}

function checkUrlChange() {
  if (location.href !== lastSeenUrl) {
    lastSeenUrl = location.href;
    lastMarkedUrl = null;
    scheduleScan();
  }
}

function startObservers() {
  if (observer) return;
  observer = new MutationObserver(() => {
    checkUrlChange();
    scheduleScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => {
    checkUrlChange();
    scheduleScan();
  });
}

function init() {
  // Initial scan immediately, then keep watching for SPA changes / late content.
  scanNow();
  startObservers();
}

init();
