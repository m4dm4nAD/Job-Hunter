/**
 * EML File Parser for extracting job application information
 */

class EMLParser {
  static parseEML(fileContent) {
    // More flexible EML parsing that handles various formats
    const lines = fileContent.split('\n');
    const headers = {};
    let bodyStartIndex = 0;
    let inBody = false;

    // Parse headers - handle multi-line headers and various formats
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for body start (blank line or common body markers)
      if (!inBody && (line.trim() === '' || line.startsWith('Content-Type:') || line.startsWith('Content-Transfer-Encoding:'))) {
        // Look ahead to see if this is actually the start of body
        let nextNonEmpty = i + 1;
        while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') {
          nextNonEmpty++;
        }

        if (nextNonEmpty >= lines.length || !lines[nextNonEmpty].includes(':')) {
          bodyStartIndex = i;
          inBody = true;
          break;
        }
      }

      // Parse header line
      if (!inBody) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();

          // Handle multi-line headers (continuation lines start with whitespace)
          let j = i + 1;
          while (j < lines.length && (lines[j].startsWith(' ') || lines[j].startsWith('\t'))) {
            value += ' ' + lines[j].trim();
            j++;
          }
          i = j - 1; // Skip the continuation lines we just processed

          headers[key.toLowerCase()] = value;
        }
      }
    }

    // If we didn't find a clear body start, assume everything after headers is body
    if (!inBody) {
      bodyStartIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') {
          bodyStartIndex = i + 1;
          break;
        }
      }
    }

    // Get body - everything after the headers
    const body = lines.slice(bodyStartIndex).join('\n').trim();

    return {
      subject: headers.subject || headers['subject'] || '',
      from: headers.from || headers['from'] || '',
      to: headers.to || headers['to'] || '',
      date: headers.date || headers['date'] || '',
      body: body,
      headers: headers
    };
  }

  static extractJobInfo(emlData) {
    const subject = emlData.subject || '';
    const body = emlData.body || '';
    const combined = `${subject}\n${body}`.toLowerCase();

    let company = this.extractCompany(combined, subject, body);
    let jobTitle = this.extractJobTitle(combined, subject, body);
    let extractedDate = this.extractDate(emlData.date);

    return {
      company,
      jobTitle,
      date: extractedDate,
      source: 'email-import',
      subject: subject,
      confidence: {
        company: company ? 'auto-detected' : 'manual-required',
        jobTitle: jobTitle ? 'auto-detected' : 'manual-required'
      }
    };
  }

  static extractCompany(combined, subject, body) {
    // More flexible company extraction patterns
    const patterns = [
      // Direct company mentions
      /(?:company|employer|organization)\s*[:=]?\s*([A-Z][a-zA-Z0-9\s&.-]+?)(?:\n|;|$)/i,
      /(?:at|from|with)\s+([A-Z][a-zA-Z0-9\s&.-]+?)\s+(?:we|our|team|company)/i,
      /([A-Z][a-zA-Z0-9\s&.-]+?)\s+(?:is hiring|job opening|position|role)/i,

      // Job announcement patterns
      /(?:congratulations|thank you)\s+(?:at|for applying to|for your application to)\s+([A-Z][a-zA-Z0-9\s&.-]+?)(?:\n|,|\.|$)/i,
      /(?:opportunity|position)\s+(?:at|with)\s+([A-Z][a-zA-Z0-9\s&.-]+?)(?:\n|,|\.|$)/i,

      // Email domain extraction
      /(?:from|sender)\s*:\s*[^@]+@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/i
    ];

    // Try patterns on combined text
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match && match[1]) {
        let company = match[1].trim().replace(/\s+/g, ' ');
        if (company.length > 2 && company.length < 100) {
          // Clean up common artifacts
          company = company.replace(/^(position|role|job|title)/i, '').trim();
          if (company.length > 2) {
            return this.formatCompanyName(company);
          }
        }
      }
    }

    // Try to extract from sender domain as fallback
    const fromMatch = body.match(/from:\s*([^\n<]+)/i) || subject.match(/from:\s*([^\n<]+)/i);
    if (fromMatch) {
      const from = fromMatch[1];
      const emailMatch = from.match(/@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
      if (emailMatch) {
        const domain = emailMatch[1].split('.')[0];
        if (domain.length > 2 && domain.length < 50) {
          return this.formatCompanyName(domain);
        }
      }
    }

    // Last resort: look for capitalized words that might be company names
    const capitalizedWords = combined.match(/\b[A-Z][a-zA-Z]{2,}\b/g);
    if (capitalizedWords) {
      for (const word of capitalizedWords.slice(0, 5)) {
        if (word.length > 3 && word.length < 30 && !this.isCommonWord(word.toLowerCase())) {
          return word;
        }
      }
    }

    return '';
  }

  static extractJobTitle(combined, subject, body) {
    // More flexible job title patterns
    const patterns = [
      // Direct title mentions
      /(?:position|title|role|job)\s*[:=]?\s*([^\n.,;]+?)(?:[,;\n]|$)/i,
      /(?:apply.*?(?:to|for)|applying for)\s+(?:the\s+)?([^\n.,;]+?)\s+(?:position|role|job)/i,
      /(?:congratulations.*?(?:for your application for the|on your application for))\s*([^\n.,;]+?)(?:\n|,|\.|$)/i,

      // Common job title patterns
      /\b(?:senior|junior|lead|principal|staff|associate)\s+(?:software|frontend|backend|full.?stack|web|mobile|devops|data|product|ui|ux|qa|test)\s+(?:engineer|developer|designer|analyst|manager|architect)\b/i,
      /\b(?:software|frontend|backend|full.?stack|web|mobile|devops|data|product|ui|ux|qa|test)\s+(?:engineer|developer|designer|analyst|manager|architect|specialist|consultant)\b/i,
      /\b(?:product|project|program|technical|engineering|design|marketing|sales|business|operations)\s+(?:manager|director|lead|specialist|analyst|coordinator)\b/i
    ];

    // Try patterns
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match && match[1]) {
        let title = match[1].trim().replace(/\s+/g, ' ');
        if (title.length > 2 && title.length < 150) {
          // Remove common prefixes that might have been captured
          title = title.replace(/^(position|role|job|title)/i, '').trim();
          if (title.length > 2) {
            return title;
          }
        }
      }
    }

    // Fallback: look for job titles in subject line
    const subjectTitles = subject.match(/\b(?:senior|junior|lead|principal|staff|associate)?\s*(?:software|frontend|backend|full.?stack|web|mobile|devops|data|product|ui|ux|qa|test|product|project|program|technical|engineering|design|marketing|sales|business|operations)\s+(?:engineer|developer|designer|analyst|manager|director|architect|specialist|consultant|coordinator)\b/i);
    if (subjectTitles) {
      return subjectTitles[0];
    }

    return '';
  }

  static isCommonWord(word) {
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'has', 'let', 'put', 'say', 'she', 'too', 'use'];
    return commonWords.includes(word);
  }

  static extractDate(dateString) {
    if (!dateString) {
      return new Date().toISOString();
    }

    try {
      // Try to parse email date header format (e.g., "Wed, 15 Apr 2026 10:30:00 -0500")
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
      // Fall through
    }

    return new Date().toISOString();
  }

  static formatCompanyName(name) {
    // Convert domain-like names to proper company names
    return name
      .split(/[-_\.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// UI Management
const uploadModal = document.getElementById('upload-modal');
const uploadBtn = document.getElementById('upload-eml');
const fileInput = document.getElementById('file-input');
const fileSelectBtn = document.getElementById('file-select-btn');
const dropZone = document.getElementById('drop-zone');
const modalClose = document.querySelector('.modal-close');
const uploadStatus = document.getElementById('upload-status');
const extractedApplicationsDiv = document.getElementById('extracted-applications');
const extractedList = document.getElementById('extracted-list');
const importBtn = document.getElementById('import-extracted');
const cancelBtn = document.getElementById('cancel-import');

let extractedAppData = [];

// Modal management
uploadBtn?.addEventListener('click', () => {
  uploadModal.style.display = 'flex';
  uploadStatus.style.display = 'none';
  extractedApplicationsDiv.style.display = 'none';
});

modalClose?.addEventListener('click', () => {
  uploadModal.style.display = 'none';
  extractedAppData = [];
});

window.addEventListener('click', (e) => {
  if (e.target === uploadModal) {
    uploadModal.style.display = 'none';
    extractedAppData = [];
  }
});

// File upload
fileSelectBtn?.addEventListener('click', () => {
  fileInput.click();
});

fileInput?.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

// Drag and drop
dropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone?.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
  extractedAppData = [];
  uploadStatus.style.display = 'block';
  uploadStatus.innerHTML = '<p>Processing files...</p>';

  let processed = 0;
  const total = files.length;

  for (const file of files) {
    if (!file.name.endsWith('.eml')) {
      uploadStatus.innerHTML += `<p class="error">⚠️ ${file.name} is not an .eml file</p>`;
      processed++;
      continue;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const emlData = EMLParser.parseEML(content);
        const jobInfo = EMLParser.extractJobInfo(emlData);
        
        extractedAppData.push({
          file: file.name,
          original: jobInfo,
          edited: { ...jobInfo }
        });

        processed++;
        updateProgress(processed, total);
      } catch (error) {
        console.error('Error parsing file:', file.name, error);
        uploadStatus.innerHTML += `<p class="error">❌ Error parsing ${file.name}</p>`;
        processed++;
        updateProgress(processed, total);
      }
    };

    reader.readAsText(file);
  }
}

function updateProgress(current, total) {
  if (current === total) {
    if (extractedAppData.length > 0) {
      uploadStatus.innerHTML = `<p class="success">✓ Extracted ${extractedAppData.length} application(s)</p>`;
      displayExtractedApplications();
    } else {
      uploadStatus.innerHTML = '<p class="error">❌ No valid applications found</p>';
    }
  }
}

function displayExtractedApplications() {
  extractedList.innerHTML = '';

  extractedAppData.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = 'extracted-item';
    item.innerHTML = `
      <div class="extracted-header">
        <h4>📧 ${app.file}</h4>
      </div>
      <div class="extracted-form">
        <div class="form-group">
          <label for="company-${index}">Company:</label>
          <input 
            type="text" 
            id="company-${index}" 
            class="company-input" 
            value="${escapeHtml(app.original.company)}" 
            data-index="${index}"
            placeholder="Enter company name"
          />
          <span class="confidence">${app.original.confidence.company}</span>
        </div>
        <div class="form-group">
          <label for="title-${index}">Job Title:</label>
          <input 
            type="text" 
            id="title-${index}" 
            class="title-input" 
            value="${escapeHtml(app.original.jobTitle)}" 
            data-index="${index}"
            placeholder="Enter job title"
          />
          <span class="confidence">${app.original.confidence.jobTitle}</span>
        </div>
      </div>
    `;
    extractedList.appendChild(item);
  });

  // Add change listeners
  document.querySelectorAll('.company-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      extractedAppData[index].edited.company = e.target.value;
    });
  });

  document.querySelectorAll('.title-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      extractedAppData[index].edited.jobTitle = e.target.value;
    });
  });

  uploadStatus.style.display = 'none';
  extractedApplicationsDiv.style.display = 'block';
}

importBtn?.addEventListener('click', () => {
  const applicationsToAdd = extractedAppData.map(app => ({
    title: app.edited.jobTitle || 'Imported Application',
    company: app.edited.company || 'Unknown Company',
    url: '', // No URL for imported apps
    eventType: 'email-import',
    timestamp: app.edited.date || new Date().toISOString()
  }));

  chrome.storage.local.get({jobApplications: []}, (result) => {
    const jobApplications = Array.isArray(result.jobApplications) ? result.jobApplications : [];
    jobApplications.unshift(...applicationsToAdd);
    chrome.storage.local.set({jobApplications}, () => {
      uploadModal.style.display = 'none';
      extractedAppData = [];
      
      // Notify parent window to refresh
      if (window.parent !== window) {
        window.parent.location.reload();
      } else {
        // Reload current page if standalone
        window.location.reload();
      }
    });
  });
});

cancelBtn?.addEventListener('click', () => {
  uploadModal.style.display = 'none';
  extractedAppData = [];
});

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
