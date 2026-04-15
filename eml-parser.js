/**
 * EML File Parser for extracting job application information
 */

class EMLParser {
  static parseEML(fileContent) {
    const lines = fileContent.split('\n');
    const headers = {};
    let bodyStartIndex = 0;

    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        bodyStartIndex = i + 1;
        break;
      }
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key.toLowerCase()] = value;
      }
    }

    // Get body
    const body = lines.slice(bodyStartIndex).join('\n');

    return {
      subject: headers.subject || '',
      from: headers.from || '',
      to: headers.to || '',
      date: headers.date || '',
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
    // Common company announcement patterns
    const patterns = [
      /(?:from|at|company)\s*[:=]?\s*([A-Z][a-zA-Z0-9\s&.-]+?)(?:\.|,|$)/i,
      /(?:opportunity at|job at|position at)\s+([A-Z][a-zA-Z0-9\s&.-]+?)(?:\.|,|$)/i,
      /([A-Z][a-zA-Z0-9\s&.-]+?)\s+(?:is hiring|job opening|application)/i,
      /(?:congratulations|thank you)\s+(?:at|for applying to|for your application to)\s+([A-Z][a-zA-Z0-9\s&.-]+?)(?:\.|,|$)/i,
      /company\s*:\s*([A-Z][a-zA-Z0-9\s&.-]+?)(?:\n|;|$)/i,
      /(?:employer|company name)\s*:\s*([A-Z][a-zA-Z0-9\s&.-]+?)(?:\n|;|$)/i
    ];

    for (const pattern of patterns) {
      const match = combined.match(pattern) || subject.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim().replace(/\s+/g, ' ');
        if (company.length > 2 && company.length < 100) {
          return company;
        }
      }
    }

    // Try to extract from sender domain
    const fromMatch = body.match(/from:\s*([^\n<]+)/i);
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

    return '';
  }

  static extractJobTitle(combined, subject, body) {
    // Job title patterns
    const patterns = [
      /(?:position|title|role)\s*[:=]?\s*([^\n.,;]+?)(?:[,;\n]|$)/i,
      /apply.*?(?:to|for)\s+(?:the\s+)?([^\n.,]+?)\s+(?:position|role|job)/i,
      /([A-Z][a-zA-Z0-9\s]*?(?:Engineer|Developer|Manager|Designer|Analyst|Consultant|Specialist|Coordinator|Associate|Officer|Architect|Lead|Senior|Junior)[a-zA-Z0-9\s]*?)(?:\n|,|$)/,
      /job title\s*:\s*([^\n;]+?)(?:\n|;|$)/i,
      /^.*?position.*?:\s*([^\n.,;]+?)(?:[,;\n]|$)/im,
      /congratulations.*?(?:for your application for the )?([^\n.,]+?)\s+(?:position|role|job)/i
    ];

    for (const pattern of patterns) {
      const match = combined.match(pattern) || subject.match(pattern);
      if (match && match[1]) {
        let title = match[1].trim().replace(/\s+/g, ' ');
        if (title.length > 2 && title.length < 150) {
          // Remove common noise
          title = title.replace(/^(position|role|job|title)/i, '').trim();
          if (title.length > 2) {
            return title;
          }
        }
      }
    }

    return '';
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
