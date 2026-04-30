/**
 * EML File Parser for extracting job application information.
 *
 * Handles real-world MIME structure:
 *   - multipart/* bodies (walks boundaries, picks best part)
 *   - quoted-printable and base64 transfer encodings
 *   - RFC 2047 encoded-word headers (=?utf-8?B?...?= / ?Q?...?=)
 *   - HTML-only messages (converted to plain text)
 *   - folded headers (continuation lines starting with whitespace)
 */

class EMLParser {

  // ---------- Public API ------------------------------------------------------

  /**
   * Parse a raw .eml string into structured form.
   *   { subject, from, to, date, body, headers, rawHeaders }
   * `body` is the best plain-text rendering available (HTML stripped if needed).
   */
  static parseEML(rawText) {
    const normalized = String(rawText || '').replace(/\r\n/g, '\n');
    const { headers, body } = this.splitHeadersBody(normalized);

    const decodedHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      decodedHeaders[k] = this.decodeEncodedWords(v);
    }

    const contentType = this.parseContentType(headers['content-type'] || 'text/plain');
    const encoding = (headers['content-transfer-encoding'] || '7bit').toLowerCase();

    const bodyText = this.decodeBody(body, contentType, encoding);

    return {
      subject: decodedHeaders.subject || '',
      from: decodedHeaders.from || '',
      to: decodedHeaders.to || '',
      date: decodedHeaders.date || '',
      body: bodyText,
      headers: decodedHeaders,
      rawHeaders: headers
    };
  }

  /**
   * Pull job info out of a parsed email. Returns:
   *   { title, company, date, source, subject, confidence }
   */
  static extractJobInfo(emlData) {
    const subject = emlData.subject || '';
    const body = emlData.body || '';
    const fromHeader = emlData.from || (emlData.headers && emlData.headers.from) || '';

    const company = this.extractCompany(subject, body, fromHeader);
    const title = this.extractJobTitle(subject, body);
    const date = this.extractDate(emlData.date);

    return {
      title,
      company,
      date,
      source: 'email-import',
      subject,
      confidence: {
        company: company ? 'auto-detected' : 'manual-required',
        title: title ? 'auto-detected' : 'manual-required'
      }
    };
  }

  // ---------- MIME parsing ----------------------------------------------------

  static splitHeadersBody(text) {
    const split = text.indexOf('\n\n');
    let headerSection, body;
    if (split === -1) {
      headerSection = text;
      body = '';
    } else {
      headerSection = text.substring(0, split);
      body = text.substring(split + 2);
    }

    const headers = {};
    const lines = headerSection.split('\n');
    let currentKey = null;
    let currentValue = '';

    const commit = () => {
      if (currentKey !== null) headers[currentKey] = currentValue.trim();
    };

    for (const line of lines) {
      // Continuation: line starts with whitespace → unfold into current header
      if (currentKey && /^[ \t]/.test(line)) {
        currentValue += ' ' + line.trim();
        continue;
      }
      commit();
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) {
        currentKey = null;
        currentValue = '';
        continue;
      }
      currentKey = line.substring(0, colonIdx).trim().toLowerCase();
      currentValue = line.substring(colonIdx + 1);
    }
    commit();

    return { headers, body };
  }

  static parseContentType(headerValue) {
    const parts = String(headerValue).split(';').map(p => p.trim());
    const type = (parts.shift() || 'text/plain').toLowerCase();
    const params = {};
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.substring(0, eq).trim().toLowerCase();
      let value = part.substring(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      params[key] = value;
    }
    return { type, params };
  }

  static decodeBody(rawBody, contentType, encoding) {
    if (contentType.type.startsWith('multipart/') && contentType.params.boundary) {
      const parts = this.splitMultipart(rawBody, contentType.params.boundary);
      return this.pickBestPart(parts);
    }

    const decoded = this.decodeTransfer(rawBody, encoding, contentType.params.charset);
    if (contentType.type === 'text/html') {
      return this.htmlToText(decoded);
    }
    return decoded;
  }

  static splitMultipart(body, boundary) {
    const delim = '--' + boundary;
    const closing = delim + '--';
    const out = [];
    const lines = body.split('\n');

    let current = null;
    for (const line of lines) {
      const stripped = line.replace(/\r$/, '');
      if (stripped === delim) {
        if (current !== null) out.push(current);
        current = [];
        continue;
      }
      if (stripped === closing) {
        if (current !== null) out.push(current);
        current = null;
        break;
      }
      if (current !== null) current.push(line);
    }

    return out.map(partLines => {
      const partText = partLines.join('\n');
      const { headers, body: partBody } = this.splitHeadersBody(partText);
      const ct = this.parseContentType(headers['content-type'] || 'text/plain');
      const enc = (headers['content-transfer-encoding'] || '7bit').toLowerCase();
      return { headers, contentType: ct, encoding: enc, body: partBody };
    });
  }

  static pickBestPart(parts) {
    let plainPart = null;
    let htmlPart = null;

    for (const part of parts) {
      if (part.contentType.type === 'text/plain' && !plainPart) {
        plainPart = part;
      } else if (part.contentType.type === 'text/html' && !htmlPart) {
        htmlPart = part;
      } else if (part.contentType.type.startsWith('multipart/')) {
        const nested = this.decodeBody(part.body, part.contentType, part.encoding);
        if (nested) return nested;
      }
    }

    const chosen = plainPart || htmlPart;
    if (!chosen) return '';
    const decoded = this.decodeTransfer(chosen.body, chosen.encoding, chosen.contentType.params.charset);
    return chosen.contentType.type === 'text/html' ? this.htmlToText(decoded) : decoded;
  }

  // ---------- Transfer encodings ---------------------------------------------

  static decodeTransfer(text, encoding, charset) {
    const cs = (charset || 'utf-8').toLowerCase();
    if (encoding === 'quoted-printable') return this.decodeQuotedPrintable(text, cs);
    if (encoding === 'base64') {
      try {
        const cleaned = text.replace(/[^A-Za-z0-9+/=]/g, '');
        const bin = atob(cleaned);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder(cs).decode(bytes);
      } catch (e) {
        return text;
      }
    }
    return text;
  }

  static decodeQuotedPrintable(text, charset) {
    // Soft line-break: "=" at end of line is line continuation
    const collapsed = text.replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < collapsed.length; i++) {
      if (collapsed[i] === '=' && i + 2 < collapsed.length) {
        const hex = collapsed.substr(i + 1, 2);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      bytes.push(collapsed.charCodeAt(i) & 0xff);
    }
    try {
      return new TextDecoder(charset).decode(new Uint8Array(bytes));
    } catch (e) {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }
  }

  static decodeEncodedWords(text) {
    if (!text) return '';
    // RFC 2047 §6.2: drop whitespace between adjacent encoded-words
    const merged = text.replace(/(\?=)\s+(=\?)/g, '$1$2');
    return merged.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (match, charset, enc, content) => {
      try {
        const cs = charset.toLowerCase();
        if (enc.toUpperCase() === 'B') {
          const bin = atob(content);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return new TextDecoder(cs).decode(bytes);
        }
        // Q-encoding: '_' represents space, '=XX' is hex byte
        const decoded = content.replace(/_/g, ' ');
        const bytes = [];
        for (let i = 0; i < decoded.length; i++) {
          if (decoded[i] === '=' && i + 2 < decoded.length) {
            const hex = decoded.substr(i + 1, 2);
            if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
              bytes.push(parseInt(hex, 16));
              i += 2;
              continue;
            }
          }
          bytes.push(decoded.charCodeAt(i) & 0xff);
        }
        return new TextDecoder(cs).decode(new Uint8Array(bytes));
      } catch (e) {
        return match;
      }
    });
  }

  // ---------- HTML → plain text ----------------------------------------------

  static htmlToText(html) {
    let s = String(html);
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    // Insert newline at block-level boundaries so content doesn't run together
    s = s.replace(/<\/?(p|div|br|li|tr|h[1-6]|table|section|article|header|footer)\b[^>]*>/gi, '\n');
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/&nbsp;/gi, ' ')
         .replace(/&amp;/gi, '&')
         .replace(/&lt;/gi, '<')
         .replace(/&gt;/gi, '>')
         .replace(/&quot;/gi, '"')
         .replace(/&#39;/gi, "'")
         .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
         .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }

  // ---------- Field extraction -----------------------------------------------

  static extractCompany(subject, body, fromHeader) {
    const haystack = `${subject}\n${body}`;

    // Capture groups are LAZY ({1,60}?) — greedy capture tends to swallow
    // trailing words ("Spotify was sent") because the char class allows spaces.
    const patterns = [
      // Structured "Company: X" anywhere (handles bullet lists, tables)
      /\b(?:company|employer|organization)\s*[:=]\s*([^\n,;]+)/i,
      // "position at <Company>" / "role with <Company>"
      /(?:position|role|opportunity|opening|job)\s+(?:at|with)\s+([A-Z][\w&.\- ]{1,60}?)(?=[.,!?\n]|\s+(?:has|was|is|for|will|sent|received))/,
      // "Thank you for applying to <Company>"
      /thank(?:s)?\s+(?:you\s+)?for\s+(?:applying|your\s+application)(?:\s+(?:at|to|with))?\s+([A-Z][\w&.\- ]{1,60}?)(?=[.,!?\n]|\s+(?:for|has|was|is))/i,
      // "your application ... at <Company>"
      /your\s+application\s+(?:[\w\s\-/]+?)\s+(?:at|with)\s+([A-Z][\w&.\- ]{1,60}?)(?=[.,!?\n]|\s+(?:has|was|is|will|sent|received|for))/i,
      // "application (was) sent to <Company>" — LinkedIn-style aggregator emails
      /application\s+(?:was\s+)?sent\s+to\s+([A-Z][\w&.\- ]{1,60}?)(?=[.,!?\n]|\s+(?:for|on|via|with|has|was|is))/i,
      // "joining (our team at) <Company>"
      /joining\s+(?:our\s+team\s+at\s+)?([A-Z][\w&.\- ]{1,60}?)(?=[.,!?\n]|\s+(?:has|as|team))/
    ];

    for (const re of patterns) {
      const m = haystack.match(re);
      if (m && m[1]) {
        const cleaned = this.cleanCapture(m[1]);
        if (cleaned && cleaned.length <= 80 && !this.looksLikeStopPhrase(cleaned)) {
          return cleaned;
        }
      }
    }

    const fromCompany = this.companyFromAddress(fromHeader);
    if (fromCompany) return fromCompany;

    return '';
  }

  static extractJobTitle(subject, body) {
    const haystack = `${subject}\n${body}`;

    const patterns = [
      // Structured "Job Title: X" / "Position: X" / "Role: X"
      /\b(?:job\s+title|position|role|title)\s*[:=]\s*([^\n,;]+)/i,
      // "application for the <Title> position"
      /application\s+(?:for|to)\s+(?:the\s+)?([A-Za-z][\w\s\-/]+?)\s+(?:position|role|opening|job)\b/i,
      // "applying for the <Title>"
      /apply(?:ing)?\s+(?:for|to)\s+(?:the\s+)?([A-Za-z][\w\s\-/]+?)\s+(?:position|role|opening|job)\b/i,
      // "your application for <Title> at/has/..."
      /your\s+application\s+for\s+(?:the\s+)?([A-Za-z][\w\s\-/]+?)(?=\s+(?:at|with|has|was|is)|[.,!?\n])/i,
      // "<Title> position at <Company>" — capture the title segment
      /([A-Za-z][\w\s\-/]+?)\s+position\s+(?:at|with)\b/i
    ];

    for (const re of patterns) {
      const m = haystack.match(re);
      if (m && m[1]) {
        const cleaned = this.cleanCapture(m[1]);
        if (cleaned && cleaned.length >= 2 && cleaned.length <= 100 && !this.looksLikeStopPhrase(cleaned)) {
          return cleaned;
        }
      }
    }

    // Last resort: subject-line job-title shape
    const subjMatch = subject.match(/((?:senior|junior|lead|principal|staff|associate|sr\.?|jr\.?)\s+)?((?:software|frontend|backend|full[- ]?stack|web|mobile|devops|sre|data|product|ui|ux|qa|test|machine\s+learning|ml|ai|security|cloud|platform|infrastructure|systems|game|embedded|technical)\s+)?(engineer|developer|designer|analyst|manager|director|architect|specialist|consultant|coordinator|scientist|researcher|recruiter|writer)\b/i);
    if (subjMatch && subjMatch[0]) return subjMatch[0].trim().replace(/\s+/g, ' ');

    return '';
  }

  static cleanCapture(s) {
    return String(s)
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-*•:]+/, '')
      .replace(/[\s.,;:!?\-]+$/, '')
      .trim();
  }

  static looksLikeStopPhrase(s) {
    return /^(dear|hello|hi|thanks?|thank\s+you|sincerely|regards|best|the\s+team|applicant)$/i.test(s);
  }

  // Domains that are job aggregators / ATS hosts — these are NOT the hiring
  // company, so don't fall back to them when the From: address comes from one.
  static get TRANSACTIONAL_DOMAINS() {
    return new Set([
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
      'monster.com', 'careerbuilder.com', 'simplyhired.com', 'angel.co',
      'wellfound.com', 'handshake.com', 'usa.gov',
      'greenhouse.io', 'lever.co', 'ashbyhq.com', 'workday.com',
      'myworkdayjobs.com', 'icims.com', 'taleo.net', 'workable.com',
      'jobvite.com', 'smartrecruiters.com', 'recruitee.com', 'breezy.hr',
      'bamboohr.com', 'jazzhr.com', 'applytojob.com', 'pinpointhq.com'
    ]);
  }

  static companyFromAddress(fromHeader) {
    if (!fromHeader) return '';
    const m = fromHeader.match(/<?([^\s<>@"]+)@([\w.-]+\.[a-z]{2,})>?/i);
    if (!m) return '';
    const domain = m[2].toLowerCase();

    // Don't infer company name from job aggregators / ATS hosts
    for (const aggregator of this.TRANSACTIONAL_DOMAINS) {
      if (domain === aggregator || domain.endsWith('.' + aggregator)) return '';
    }

    const labels = domain.split('.').filter(Boolean);
    if (labels.length < 2) return '';

    // Strip multi-part TLDs like .co.uk / .com.au
    const generics = new Set(['co', 'com', 'net', 'org', 'edu', 'gov', 'ac']);
    let baseLabels;
    if (labels.length >= 3 && generics.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2) {
      baseLabels = labels.slice(0, -2);
    } else {
      baseLabels = labels.slice(0, -1);
    }

    // Strip transactional/recruiting subdomains so careers.stripe.com → "Stripe"
    const STRIP = new Set([
      'mail', 'email', 'noreply', 'no-reply', 'donotreply', 'do-not-reply',
      'recruit', 'recruiting', 'careers', 'career', 'jobs', 'job', 'hire',
      'hiring', 'talent', 'apply', 'applications', 'hr', 'people', 'employer',
      'work', 'notifications', 'notify', 'support', 'info', 'contact', 'auto',
      'system', 'em', 'send', 'sender', 'comms', 'communications'
    ]);
    while (baseLabels.length > 1 && STRIP.has(baseLabels[0])) baseLabels.shift();
    while (baseLabels.length > 1 && STRIP.has(baseLabels[baseLabels.length - 1])) baseLabels.pop();

    const root = baseLabels[baseLabels.length - 1] || baseLabels[0];
    if (!root) return '';
    return this.formatCompanyName(root);
  }

  static formatCompanyName(name) {
    // Already-capitalized brand names (Google, GitHub) — leave alone
    if (/^[A-Z][a-zA-Z0-9]+$/.test(name)) return name;
    // All-caps short brands (IBM, AWS) — leave alone
    if (/^[A-Z]{2,5}$/.test(name)) return name;
    return name
      .split(/[-_.\s]+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  static extractDate(dateString) {
    if (!dateString) return new Date().toISOString();
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) return d.toISOString();
    return new Date().toISOString();
  }
}

// Make accessible from non-module callers (dashboard.js).
if (typeof window !== 'undefined') {
  window.EMLParser = EMLParser;
}
