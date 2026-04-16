let allApplications = [];
let openedJobAds = [];
const applicationsListOpened = document.getElementById('applications-list-opened');
const applicationsListSubmitted = document.getElementById('applications-list-submitted');
const dateFilter = document.getElementById('date-filter');
const customDatePicker = document.getElementById('custom-date-picker');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const searchInputOpened = document.getElementById('search-input-opened');
const searchInputSubmitted = document.getElementById('search-input-submitted');

// Tab management
const tabOpened = document.getElementById('tab-opened');
const tabSubmitted = document.getElementById('tab-submitted');
const tabOpenedContent = document.getElementById('tab-opened-content');
const tabSubmittedContent = document.getElementById('tab-submitted-content');
let currentTab = 'opened'; // Default to opened job ads

// Load and display applications on page load
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
  updateStats();
});

// Tab event listeners
tabOpened.addEventListener('click', () => {
  currentTab = 'opened';
  tabOpened.classList.add('active');
  tabSubmitted.classList.remove('active');
  tabOpenedContent.classList.add('active');
  tabSubmittedContent.classList.remove('active');
  displayCurrentTab();
  updateStats();
});

tabSubmitted.addEventListener('click', () => {
  currentTab = 'submitted';
  tabSubmitted.classList.add('active');
  tabOpened.classList.remove('active');
  tabSubmittedContent.classList.add('active');
  tabOpenedContent.classList.remove('active');
  displayCurrentTab();
  updateStats();
});

// Event listeners
dateFilter.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    customDatePicker.style.display = 'flex';
  } else {
    customDatePicker.style.display = 'none';
    filterAndDisplay(e.target.value);
  }
});

document.getElementById('apply-filter').addEventListener('click', () => {
  const start = new Date(startDateInput.value);
  const end = new Date(endDateInput.value);
  if (start > end) {
    alert('Start date must be before end date');
    return;
  }
  filterByDateRange(start, end);
});

searchInputOpened.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  displayApplications(
    openedJobAds.filter(
      app =>
        (app.title && app.title.toLowerCase().includes(query)) ||
        (app.url && app.url.toLowerCase().includes(query)) ||
        (app.company && app.company.toLowerCase().includes(query))
    ),
    applicationsListOpened
  );
});

searchInputSubmitted.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  displayApplications(
    allApplications.filter(
      app =>
        (app.title && app.title.toLowerCase().includes(query)) ||
        (app.url && app.url.toLowerCase().includes(query)) ||
        (app.company && app.company.toLowerCase().includes(query))
    ),
    applicationsListSubmitted
  );
});

document.getElementById('export-csv').addEventListener('click', exportToCSV);
document.getElementById('upload-eml').addEventListener('click', () => {
  if (currentTab !== 'submitted') {
    alert('Email import is only available for submitted applications. Please switch to the "Submitted Applications" tab.');
    return;
  }
  document.getElementById('upload-modal').style.display = 'block';
});
document.getElementById('clear-all').addEventListener('click', clearAllApplications);

function loadAllData() {
  chrome.storage.local.get(['jobApplications', 'applicationInProgress'], (result) => {
    allApplications = Array.isArray(result.jobApplications) ? result.jobApplications : [];
    openedJobAds = result.applicationInProgress ? [result.applicationInProgress] : [];
    console.log('Loaded applications:', allApplications);
    console.log('Loaded opened job ads:', openedJobAds);
    displayCurrentTab();
  });
}

function displayCurrentTab() {
  if (currentTab === 'submitted') {
    displayApplications(allApplications, applicationsListSubmitted);
  } else {
    displayApplications(openedJobAds, applicationsListOpened);
  }
}

function displayApplications(applications, targetList = applicationsListSubmitted) {
  if (applications.length === 0) {
    const emptyMessage = currentTab === 'submitted'
      ? 'No submitted applications found matching your filters.'
      : 'No opened job ads detected.';
    applicationsList.innerHTML = `
      <div class="empty-state">
        <p>${emptyMessage}</p>
      </div>
    `;
    return;
  }

  applicationsList.innerHTML = '';
  applications.forEach((app, index) => {
    // Handle different data structures for submitted vs opened applications
    const timestamp = app.timestamp || app.detectedAt;
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();

    let eventLabel = 'Unknown';
    let eventTypeClass = 'unknown';

    if (currentTab === 'submitted') {
      if (app.eventType === 'form-submit') {
        eventLabel = 'Form Submitted';
        eventTypeClass = 'form-submit';
      } else if (app.eventType === 'button-click') {
        eventLabel = 'Button Clicked';
        eventTypeClass = 'button-click';
      } else if (app.eventType === 'email-import') {
        eventLabel = 'Email Import';
        eventTypeClass = 'email-import';
      }
    } else {
      eventLabel = 'Job Ad Opened';
      eventTypeClass = 'job-opened';
    }

    const appCard = document.createElement('div');
    appCard.className = 'application-card';

    const urlSection = app.url ? `
        <div class="info-row">
          <span class="label">URL:</span>
          <span class="value url-value">
            <a href="${escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer">
              ${truncateUrl(app.url)}
            </a>
          </span>
        </div>
      ` : '';

    const companySection = app.company ? `
        <div class="info-row">
          <span class="label">Company:</span>
          <span class="value">${escapeHtml(app.company)}</span>
        </div>
      ` : '';

    appCard.innerHTML = `
      <div class="card-header">
        <h3 class="job-title">${escapeHtml(app.title || 'Untitled Position')}</h3>
        <span class="event-badge ${eventTypeClass}">${eventLabel}</span>
      </div>
      <div class="card-content">
        <div class="info-row">
          <span class="label">Date & Time:</span>
          <span class="value">${formattedDate} at ${formattedTime}</span>
        </div>
        ${companySection}
        ${urlSection}
      </div>
      <div class="card-actions">
        <button class="btn-copy" data-url="${escapeHtml(app.url || '')}" title="Copy URL">📋</button>
        <button class="btn-delete" data-index="${index}" title="Delete">🗑️</button>
      </div>
    `;

    applicationsList.appendChild(appCard);
  });

  // Add event listeners for copy and delete buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          const originalText = e.target.textContent;
          e.target.textContent = '✓';
          setTimeout(() => {
            e.target.textContent = originalText;
          }, 2000);
        });
      }
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      deleteApplication(index);
    });
  });
}

function updateStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

  const data = currentTab === 'submitted' ? allApplications : openedJobAds;
  const totalCount = data.length;
  const todayCount = data.filter(
    app => new Date(app.timestamp || app.detectedAt) >= today
  ).length;
  const weekCount = data.filter(
    app => new Date(app.timestamp || app.detectedAt) >= weekAgo
  ).length;
  const monthCount = data.filter(
    app => new Date(app.timestamp || app.detectedAt) >= monthAgo
  ).length;

  document.getElementById('total-applications').textContent = totalCount;
  document.getElementById('applications-today').textContent = todayCount;
  document.getElementById('applications-this-week').textContent = weekCount;
  document.getElementById('applications-this-month').textContent = monthCount;
}

function filterAndDisplay(filterType) {
  const data = currentTab === 'submitted' ? allApplications : openedJobAds;
  const targetList = currentTab === 'submitted' ? applicationsListSubmitted : applicationsListOpened;
  let filtered = data;

  if (filterType === 'today') {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    filtered = data.filter(app => new Date(app.timestamp || app.detectedAt) >= todayStart);
  } else if (filterType === 'week') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    filtered = data.filter(app => new Date(app.timestamp || app.detectedAt) >= weekAgo);
  } else if (filterType === 'month') {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = data.filter(app => new Date(app.timestamp || app.detectedAt) >= monthAgo);
  }

  displayApplications(filtered, targetList);
}

function filterByDateRange(startDate, endDate) {
  const data = currentTab === 'submitted' ? allApplications : openedJobAds;
  const targetList = currentTab === 'submitted' ? applicationsListSubmitted : applicationsListOpened;
  const filtered = data.filter(app => {
    const appDate = new Date(app.timestamp || app.detectedAt);
    return appDate >= startDate && appDate <= endDate;
  });
  displayApplications(filtered, targetList);
}

function deleteApplication(index) {
  const itemType = currentTab === 'submitted' ? 'application' : 'opened job ad';
  if (confirm(`Are you sure you want to delete this ${itemType}?`)) {
    if (currentTab === 'submitted') {
      allApplications.splice(index, 1);
      chrome.storage.local.set({jobApplications: allApplications}, () => {
        displayApplications(allApplications, applicationsListSubmitted);
        updateStats();
      });
    } else {
      openedJobAds.splice(index, 1);
      chrome.storage.local.remove('applicationInProgress', () => {
        displayApplications(openedJobAds, applicationsListOpened);
        updateStats();
      });
    }
  }
}

function clearAllApplications() {
  const confirmMessage = currentTab === 'submitted'
    ? 'Are you sure you want to clear ALL submitted applications? This cannot be undone.'
    : 'Are you sure you want to clear ALL opened job ads? This cannot be undone.';

  if (confirm(confirmMessage)) {
    if (currentTab === 'submitted') {
      allApplications = [];
      chrome.storage.local.set({jobApplications: []}, () => {
        displayApplications(allApplications, applicationsListSubmitted);
        updateStats();
      });
    } else {
      openedJobAds = [];
      chrome.storage.local.remove('applicationInProgress', () => {
        displayApplications(openedJobAds, applicationsListOpened);
        updateStats();
      });
    }
  }
}

function exportToCSV() {
  if (currentTab !== 'submitted') {
    alert('Export is only available for submitted applications. Please switch to the "Submitted Applications" tab.');
    return;
  }

  if (allApplications.length === 0) {
    alert('No applications to export');
    return;
  }

  let csv = 'Job Title,Company,Date & Time,Type,URL\n';

  allApplications.forEach(app => {
    const date = new Date(app.timestamp).toLocaleString();
    const title = (app.title || 'Untitled').replace(/"/g, '""');
    const company = (app.company || '').replace(/"/g, '""');
    let type = 'Unknown';
    if (app.eventType === 'form-submit') {
      type = 'Form Submitted';
    } else if (app.eventType === 'button-click') {
      type = 'Button Clicked';
    } else if (app.eventType === 'email-import') {
      type = 'Email Import';
    }
    const url = (app.url || '').replace(/"/g, '""');

    csv += `"${title}","${company}","${date}","${type}","${url}"\n`;
  });

  const blob = new Blob([csv], {type: 'text/csv'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function truncateUrl(url) {
  if (url.length > 60) {
    return url.substring(0, 60) + '...';
  }
  return url;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Modal handling
document.querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('upload-modal').style.display = 'none';
  resetUploadModal();
});

window.addEventListener('click', (e) => {
  const modal = document.getElementById('upload-modal');
  if (e.target === modal) {
    modal.style.display = 'none';
    resetUploadModal();
  }
});

document.getElementById('file-select-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', handleFileSelection);
document.getElementById('drop-zone').addEventListener('dragover', (e) => {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
});

document.getElementById('drop-zone').addEventListener('dragleave', (e) => {
  e.currentTarget.classList.remove('drag-over');
});

document.getElementById('drop-zone').addEventListener('drop', (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  handleFiles(files);
});

document.getElementById('import-extracted').addEventListener('click', importExtractedApplications);
document.getElementById('cancel-import').addEventListener('click', () => {
  document.getElementById('upload-modal').style.display = 'none';
  resetUploadModal();
});

function resetUploadModal() {
  document.getElementById('upload-status').style.display = 'none';
  document.getElementById('extracted-applications').style.display = 'none';
  document.getElementById('file-input').value = '';
  document.getElementById('extracted-list').innerHTML = '';
}

function handleFileSelection(e) {
  const files = Array.from(e.target.files);
  handleFiles(files);
}

function handleFiles(files) {
  const emlFiles = files.filter(file => file.name.toLowerCase().endsWith('.eml'));
  if (emlFiles.length === 0) {
    alert('Please select .eml files only.');
    return;
  }

  const statusDiv = document.getElementById('upload-status');
  statusDiv.style.display = 'block';
  statusDiv.textContent = `Processing ${emlFiles.length} email file(s)...`;

  processEMLFiles(emlFiles);
}

function processEMLFiles(files) {
  const extractedApplications = [];

  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const emlContent = e.target.result;
        const parsedEmail = EMLParser.parseEML(emlContent);
        
        if (parsedEmail && parsedEmail.title && parsedEmail.company) {
          extractedApplications.push({
            title: parsedEmail.title,
            company: parsedEmail.company,
            url: parsedEmail.url || '',
            timestamp: Date.now(),
            eventType: 'email-import'
          });
        }

        // Check if all files are processed
        if (extractedApplications.length + (files.length - index - 1) === files.length) {
          displayExtractedApplications(extractedApplications);
        }
      } catch (error) {
        console.error('Error parsing EML file:', error);
        // Continue with other files
        if (index === files.length - 1) {
          displayExtractedApplications(extractedApplications);
        }
      }
    };
    reader.readAsText(file);
  });
}

function displayExtractedApplications(applications) {
  const statusDiv = document.getElementById('upload-status');
  const extractedDiv = document.getElementById('extracted-applications');
  const extractedList = document.getElementById('extracted-list');

  statusDiv.style.display = 'none';
  extractedDiv.style.display = 'block';

  if (applications.length === 0) {
    extractedList.innerHTML = '<p>No valid job applications found in the email files.</p>';
    document.getElementById('import-extracted').disabled = true;
    return;
  }

  extractedList.innerHTML = '';
  applications.forEach((app, index) => {
    const appDiv = document.createElement('div');
    appDiv.className = 'extracted-app-item';
    appDiv.innerHTML = `
      <div class="app-info">
        <strong>${escapeHtml(app.title)}</strong> at ${escapeHtml(app.company)}
        ${app.url ? `<br><small>${escapeHtml(app.url)}</small>` : ''}
      </div>
      <div class="app-actions">
        <button class="btn-small" onclick="removeExtractedApp(${index})">Remove</button>
      </div>
    `;
    extractedList.appendChild(appDiv);
  });

  // Store applications for import
  window.extractedApplications = applications;
  document.getElementById('import-extracted').disabled = false;
}

function removeExtractedApp(index) {
  window.extractedApplications.splice(index, 1);
  displayExtractedApplications(window.extractedApplications);
}

function importExtractedApplications() {
  if (!window.extractedApplications || window.extractedApplications.length === 0) {
    return;
  }

  // Add to existing applications
  allApplications = allApplications.concat(window.extractedApplications);
  
  // Save to storage
  chrome.storage.local.set({jobApplications: allApplications}, () => {
    document.getElementById('upload-modal').style.display = 'none';
    resetUploadModal();
    displayApplications(allApplications, applicationsListSubmitted);
    updateStats();
    alert(`Successfully imported ${window.extractedApplications.length} application(s) from email!`);
  });
}

// Refresh applications every 5 seconds
setInterval(() => {
  loadAllData();
  updateStats();
}, 5000);
