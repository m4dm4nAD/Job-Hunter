const JOB_KEYWORDS = [
  /apply/i,
  /application/i,
  /resume/i,
  /cover\s*letter/i,
  /job/i,
  /position/i,
  /career/i,
  /submit/i,
  /interview/i
];

const APPLICATION_FIELD_PATTERNS = [
  /resume|cv|cover|job|position|company|email|phone|linkedin|portfolio/i
];

function textContainsKeywords(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function getVisibleText(element) {
  return element.innerText || element.textContent || '';
}

function getPageJobTitle() {
  const titleSelectors = [
    '[data-job-title]',
    '[aria-label*="job" i]',
    'h1',
    'h2',
    '.job-title',
    '.position-title'
  ];
  for (const selector of titleSelectors) {
    const node = document.querySelector(selector);
    if (node && node.textContent.trim().length > 0) {
      return node.textContent.trim();
    }
  }
  return document.title || window.location.hostname;
}

function findApplicationForm() {
  const forms = Array.from(document.forms || []);
  for (const form of forms) {
    const labels = Array.from(form.querySelectorAll('label')).map(node => getVisibleText(node));
    const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map(node => {
      return [node.name, node.id, node.placeholder, node.getAttribute('aria-label'), getVisibleText(node)].filter(Boolean).join(' ');
    });
    const combined = [...labels, ...inputs].join(' ');
    if (textContainsKeywords(combined, APPLICATION_FIELD_PATTERNS) || textContainsKeywords(getVisibleText(form), JOB_KEYWORDS)) {
      return form;
    }
  }
  return null;
}

function findSubmitButtons() {
  const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="image"]'));
  return buttons.filter(button => {
    const text = (button.value || getVisibleText(button) || button.getAttribute('aria-label') || '').trim();
    return textContainsKeywords(text, JOB_KEYWORDS) || /submit|apply|send|finish/i.test(text);
  });
}

function recordApplicationEvent(eventType) {
  const record = {
    url: window.location.href,
    title: getPageJobTitle(),
    eventType
  };

  chrome.runtime.sendMessage({
    action: 'recordApplicationEvent',
    ...record
  });
}

function markApplicationPage() {
  chrome.runtime.sendMessage({
    action: 'markApplicationPage',
    url: window.location.href,
    title: getPageJobTitle()
  });
}

function initDetection() {
  console.log('Job Hunter Tracker: Initializing detection on', window.location.href);

  const form = findApplicationForm();
  const submitButtons = findSubmitButtons();
  const pageText = getVisibleText(document.body || document.documentElement || document);

  const looksLikeApplication = !!form || textContainsKeywords(pageText, JOB_KEYWORDS);

  console.log('Job Hunter Tracker: Form found:', !!form);
  console.log('Job Hunter Tracker: Submit buttons found:', submitButtons.length);
  console.log('Job Hunter Tracker: Looks like application:', looksLikeApplication);

  if (looksLikeApplication) {
    console.log('Job Hunter Tracker: Marking as application page');
    markApplicationPage();
  }

  if (form) {
    console.log('Job Hunter Tracker: Adding form submit listener');
    form.addEventListener('submit', () => {
      console.log('Job Hunter Tracker: Form submitted');
      recordApplicationEvent('form-submit');
    }, true);
  }

  submitButtons.forEach((button, index) => {
    console.log('Job Hunter Tracker: Adding click listener to button', index);
    button.addEventListener('click', () => {
      console.log('Job Hunter Tracker: Button clicked');
      recordApplicationEvent('button-click');
    }, true);
  });
}

initDetection();
