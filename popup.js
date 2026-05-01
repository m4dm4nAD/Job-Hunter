const statusEl = document.getElementById('status');
const historyEl = document.getElementById('history');
const openedHistoryEl = document.getElementById('opened-history');
const clearButton = document.getElementById('clear-history');

const MAX_VISIBLE = 5;

function formatTimestamp(isoString) {
  return new Date(isoString).toLocaleString();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function renderOpened(records) {
  if (!records || records.length === 0) {
    openedHistoryEl.innerHTML = '<p class="empty">No job ads detected yet.</p>';
    return;
  }

  openedHistoryEl.innerHTML = '';
  records.slice(0, MAX_VISIBLE).forEach(record => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const meta = [escapeHtml(formatTimestamp(record.detectedAt))];
    if (record.ats) meta.push(escapeHtml(record.ats));
    if (record.company) meta.push(escapeHtml(record.company));

    item.innerHTML = `
      <div class="job-title">${escapeHtml(record.title || 'Untitled job')}</div>
      <div class="job-meta">
        ${meta.map(m => `<span>${m}</span>`).join('')}
      </div>
      <div class="job-url"><a href="${escapeHtml(record.url || '#')}" target="_blank" rel="noopener noreferrer">Open page</a></div>
    `;
    openedHistoryEl.appendChild(item);
  });
}

function renderHistory(records) {
  if (!records || records.length === 0) {
    historyEl.innerHTML = '<p class="empty">No submitted applications yet.</p>';
    return;
  }

  historyEl.innerHTML = '';
  records.slice(0, MAX_VISIBLE).forEach(record => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const meta = [escapeHtml(formatTimestamp(record.timestamp))];
    if (record.eventType) meta.push(escapeHtml(record.eventType.replace('-', ' ')));
    if (record.company) meta.push(escapeHtml(record.company));

    item.innerHTML = `
      <div class="job-title">${escapeHtml(record.title || 'Untitled job')}</div>
      <div class="job-meta">
        ${meta.map(m => `<span>${m}</span>`).join('')}
      </div>
      <div class="job-url"><a href="${escapeHtml(record.url || '#')}" target="_blank" rel="noopener noreferrer">Open page</a></div>
    `;
    historyEl.appendChild(item);
  });
}

function refreshStatus() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeUrl = tabs && tabs[0] ? tabs[0].url : null;

    chrome.storage.local.get(['openedJobAds', 'jobApplications'], (result) => {
      const openedJobAds = Array.isArray(result.openedJobAds) ? result.openedJobAds : [];
      const matchForActiveTab = activeUrl
        ? openedJobAds.find(entry => entry.url === activeUrl)
        : null;

      if (matchForActiveTab) {
        statusEl.textContent = `Job ad detected on this page at ${formatTimestamp(matchForActiveTab.detectedAt)}.`;
      } else if (openedJobAds.length > 0) {
        statusEl.textContent = `Tracking ${openedJobAds.length} opened job ad${openedJobAds.length === 1 ? '' : 's'}.`;
      } else {
        statusEl.textContent = 'No application activity detected yet.';
      }

      renderOpened(openedJobAds);
      renderHistory(result.jobApplications || []);
    });
  });
}

clearButton.addEventListener('click', () => {
  chrome.storage.local.set({jobApplications: []}, () => {
    renderHistory([]);
  });
});

refreshStatus();
