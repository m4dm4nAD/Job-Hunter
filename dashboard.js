let allApplications = [];
const applicationsList = document.getElementById('applications-list');
const dateFilter = document.getElementById('date-filter');
const customDatePicker = document.getElementById('custom-date-picker');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const searchInput = document.getElementById('search-input');

// Load and display applications on page load
document.addEventListener('DOMContentLoaded', () => {
  loadApplications();
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

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  displayApplications(
    allApplications.filter(
      app =>
        (app.title && app.title.toLowerCase().includes(query)) ||
        (app.url && app.url.toLowerCase().includes(query))
    )
  );
});

document.getElementById('export-csv').addEventListener('click', exportToCSV);
document.getElementById('clear-all').addEventListener('click', clearAllApplications);

function loadApplications() {
  chrome.storage.local.get({jobApplications: []}, (result) => {
    allApplications = Array.isArray(result.jobApplications) ? result.jobApplications : [];
    console.log('Loaded applications:', allApplications);
    displayApplications(allApplications);
  });
}

function displayApplications(applications) {
  if (applications.length === 0) {
    applicationsList.innerHTML = `
      <div class="empty-state">
        <p>No applications found matching your filters.</p>
      </div>
    `;
    return;
  }

  applicationsList.innerHTML = '';
  applications.forEach((app, index) => {
    const date = new Date(app.timestamp);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();
    let eventLabel = 'Unknown';
    if (app.eventType === 'form-submit') {
      eventLabel = 'Form Submitted';
    } else if (app.eventType === 'button-click') {
      eventLabel = 'Button Clicked';
    } else if (app.eventType === 'email-import') {
      eventLabel = 'Email Import';
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
        <span class="event-badge ${app.eventType}">${eventLabel}</span>
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

  const totalCount = allApplications.length;
  const todayCount = allApplications.filter(
    app => new Date(app.timestamp) >= today
  ).length;
  const weekCount = allApplications.filter(
    app => new Date(app.timestamp) >= weekAgo
  ).length;
  const monthCount = allApplications.filter(
    app => new Date(app.timestamp) >= monthAgo
  ).length;

  document.getElementById('total-applications').textContent = totalCount;
  document.getElementById('applications-today').textContent = todayCount;
  document.getElementById('applications-this-week').textContent = weekCount;
  document.getElementById('applications-this-month').textContent = monthCount;
}

function filterAndDisplay(filterType) {
  let filtered = allApplications;

  if (filterType === 'today') {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    filtered = allApplications.filter(app => new Date(app.timestamp) >= todayStart);
  } else if (filterType === 'week') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    filtered = allApplications.filter(app => new Date(app.timestamp) >= weekAgo);
  } else if (filterType === 'month') {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = allApplications.filter(app => new Date(app.timestamp) >= monthAgo);
  }

  displayApplications(filtered);
}

function filterByDateRange(startDate, endDate) {
  const filtered = allApplications.filter(app => {
    const appDate = new Date(app.timestamp);
    return appDate >= startDate && appDate <= endDate;
  });
  displayApplications(filtered);
}

function deleteApplication(index) {
  if (confirm('Are you sure you want to delete this application?')) {
    allApplications.splice(index, 1);
    chrome.storage.local.set({jobApplications: allApplications}, () => {
      loadApplications();
      updateStats();
    });
  }
}

function clearAllApplications() {
  if (
    confirm(
      'Are you sure you want to clear ALL applications? This cannot be undone.'
    )
  ) {
    allApplications = [];
    chrome.storage.local.set({jobApplications: []}, () => {
      loadApplications();
      updateStats();
    });
  }
}

function exportToCSV() {
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

// Refresh applications every 5 seconds
setInterval(() => {
  loadApplications();
  updateStats();
}, 5000);
