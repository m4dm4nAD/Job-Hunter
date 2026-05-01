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
  chrome.storage.local.get(['jobApplications', 'openedJobAds'], (result) => {
    allApplications = Array.isArray(result.jobApplications) ? result.jobApplications : [];
    openedJobAds = Array.isArray(result.openedJobAds) ? result.openedJobAds : [];
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
    targetList.innerHTML = `
      <div class="empty-state">
        <p>${emptyMessage}</p>
      </div>
    `;
    return;
  }

  targetList.innerHTML = '';
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
        <button class="btn-copy" data-url="${escapeHtml(app.url || '')}" title="Copy URL">Copy</button>
        <button class="btn-delete" data-index="${index}" title="Delete">Delete</button>
      </div>
    `;

    targetList.appendChild(appCard);
  });

  // Add event listeners for copy and delete buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          const originalText = e.target.textContent;
          e.target.textContent = 'Copied';
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
  updateAnalytics();
}

function updateAnalytics() {
  const data = allApplications;
  const companies = getTopCompanies(data, 5);
  const breakdown = getEventTypeBreakdown(data);
  const weeklyTrend = getWeeklyTrend(data);

  renderTopCompanies(companies);
  renderEventBreakdown(breakdown);
  renderTrendChart(weeklyTrend);
}

function getTopCompanies(data, limit = 5) {
  const counts = data.reduce((acc, app) => {
    const company = app.company ? app.company.trim() : 'Unknown';
    acc[company] = (acc[company] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([company, count]) => ({ company, count }));
}

function getEventTypeBreakdown(data) {
  const breakdown = {
    'Form Submitted': 0,
    'Button Clicked': 0,
    'Email Import': 0,
    'Unknown': 0
  };

  data.forEach(app => {
    if (app.eventType === 'form-submit') {
      breakdown['Form Submitted'] += 1;
    } else if (app.eventType === 'button-click') {
      breakdown['Button Clicked'] += 1;
    } else if (app.eventType === 'email-import') {
      breakdown['Email Import'] += 1;
    } else {
      breakdown['Unknown'] += 1;
    }
  });

  return breakdown;
}

function getWeeklyTrend(data) {
  const trend = [];
  const today = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const label = day.toLocaleDateString(undefined, { weekday: 'short' });
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const count = data.filter(app => {
      const appDate = new Date(app.timestamp || app.detectedAt);
      return appDate >= start && appDate < end;
    }).length;

    trend.push({ label, count });
  }

  return trend;
}

function renderTopCompanies(companies) {
  const list = document.getElementById('top-companies-list');

  if (companies.length === 0) {
    list.innerHTML = '<li>No submitted applications yet.</li>';
    return;
  }

  list.innerHTML = companies.map(({ company, count }) => `
    <li>
      <span class="company-name">${escapeHtml(company)}</span>
      <span class="company-count">${count}</span>
    </li>
  `).join('');
}

function renderEventBreakdown(breakdown) {
  const container = document.getElementById('event-breakdown');
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    container.innerHTML = '<p class="empty-analytics">No submitted applications yet.</p>';
    return;
  }

  container.innerHTML = Object.entries(breakdown).map(([label, count]) => {
    const width = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="breakdown-item">
        <div class="breakdown-label">
          <span>${escapeHtml(label)}</span>
          <span>${count}</span>
        </div>
        <div class="breakdown-bar" style="width:${width}%"></div>
      </div>
    `;
  }).join('');
}

function renderTrendChart(trend) {
  const container = document.getElementById('trend-chart');
  const maxValue = Math.max(1, ...trend.map(item => item.count));

  if (trend.every(item => item.count === 0)) {
    container.innerHTML = '<p class="empty-analytics">No submissions in the last 7 days.</p>';
    return;
  }

  container.innerHTML = trend.map(item => `
    <div class="trend-row">
      <span class="trend-label">${escapeHtml(item.label)}</span>
      <div class="trend-bar-wrapper">
        <div class="trend-bar-fill" style="width:${(item.count / maxValue) * 100}%"></div>
      </div>
      <span class="trend-count">${item.count}</span>
    </div>
  `).join('');
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
      chrome.storage.local.set({openedJobAds}, () => {
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
      chrome.storage.local.set({openedJobAds: []}, () => {
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

//some of the email parsing isn't work perfectly, trying to figure out why it's not picking up the job titles
function processEMLFiles(files) {
  const extracted = [];
  let processed = 0;

  const onDone = () => {
    if (processed === files.length) displayExtractedApplications(extracted);
  };

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = EMLParser.parseEML(e.target.result);
        const info = EMLParser.extractJobInfo(parsed);
        extracted.push({
          file: file.name,
          title: info.title || '',
          company: info.company || '',
          url: '',
          timestamp: info.date || new Date().toISOString(),
          eventType: 'email-import',
          confidence: info.confidence
        });
      } catch (err) {
        console.error('Error parsing EML file:', file.name, err);
        extracted.push({
          file: file.name,
          title: '',
          company: '',
          url: '',
          timestamp: new Date().toISOString(),
          eventType: 'email-import',
          confidence: { company: 'manual-required', title: 'manual-required' },
          error: String(err && err.message || err)
        });
      } finally {
        processed++;
        onDone();
      }
    };
    reader.onerror = () => {
      processed++;
      onDone();
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
    extractedList.innerHTML = '<p>No emails were processed.</p>';
    document.getElementById('import-extracted').disabled = true;
    return;
  }

  extractedList.innerHTML = '';
  applications.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = 'extracted-app-item';
    item.innerHTML = `
      <div class="extracted-header">
        <h4>${escapeHtml(app.file || 'email')}</h4>
        <button class="btn-small btn-remove" data-index="${index}">Remove</button>
      </div>
      <div class="extracted-form">
        <div class="form-group">
          <label>Company:</label>
          <input type="text" class="company-input" data-index="${index}"
                 value="${escapeHtml(app.company)}"
                 placeholder="Enter company name" />
        </div>
        <div class="form-group">
          <label>Job Title:</label>
          <input type="text" class="title-input" data-index="${index}"
                 value="${escapeHtml(app.title)}"
                 placeholder="Enter job title" />
        </div>
        <div class="form-group">
          <label>Date:</label>
          <span>${escapeHtml(new Date(app.timestamp).toLocaleString())}</span>
        </div>
        ${app.error ? `<div class="form-group error-msg">${escapeHtml(app.error)}</div>` : ''}
      </div>
    `;
    extractedList.appendChild(item);
  });

  extractedList.querySelectorAll('.company-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.index, 10);
      applications[i].company = e.target.value;
    });
  });
  extractedList.querySelectorAll('.title-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.index, 10);
      applications[i].title = e.target.value;
    });
  });
  extractedList.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.currentTarget.dataset.index, 10);
      applications.splice(i, 1);
      displayExtractedApplications(applications);
    });
  });

  window.extractedApplications = applications;
  document.getElementById('import-extracted').disabled = false;
}

function importExtractedApplications() {
  if (!window.extractedApplications || window.extractedApplications.length === 0) return;

  const toAdd = window.extractedApplications.map(app => ({
    title: (app.title || '').trim() || 'Untitled Position',
    company: (app.company || '').trim() || null,
    url: app.url || '',
    timestamp: app.timestamp || new Date().toISOString(),
    eventType: 'email-import'
  }));

  allApplications = toAdd.concat(allApplications);

  chrome.storage.local.set({jobApplications: allApplications}, () => {
    document.getElementById('upload-modal').style.display = 'none';
    resetUploadModal();
    displayApplications(allApplications, applicationsListSubmitted);
    updateStats();
    alert(`Imported ${toAdd.length} application(s) from email.`);
  });
}

// Refresh applications every 2 seconds
setInterval(() => {
  loadAllData();
  updateStats();
}, 2000);
