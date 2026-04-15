const statusEl = document.getElementById('status');
const historyEl = document.getElementById('history');
const clearButton = document.getElementById('clear-history');

function formatTimestamp(isoString) {
  return new Date(isoString).toLocaleString();
}

function renderHistory(records) {
  if (!records || records.length === 0) {
    historyEl.innerHTML = '<p class="empty">No recorded applications yet.</p>';
    return;
  }

  historyEl.innerHTML = '';
  records.slice(0, 20).forEach(record => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="job-title">${record.title || 'Untitled job'}</div>
      <div class="job-meta">
        <span>${formatTimestamp(record.timestamp)}</span>
        <span>${record.eventType.replace('-', ' ')}</span>
      </div>
      <div class="job-url"><a href="${record.url}" target="_blank" rel="noopener noreferrer">Open page</a></div>
    `;
    historyEl.appendChild(item);
  });
}

function refreshStatus() {
  chrome.storage.local.get(['applicationInProgress', 'jobApplications'], (result) => {
    const progress = result.applicationInProgress;
    if (progress && progress.url === window.location.href) {
      statusEl.textContent = `Application activity detected on this page since ${formatTimestamp(progress.detectedAt)}.`;
    } else if (progress) {
      statusEl.textContent = `Application activity detected on another page: ${progress.title}`;
    } else {
      statusEl.textContent = 'No application activity detected yet.';
    }

    renderHistory(result.jobApplications || []);
  });
}

clearButton.addEventListener('click', () => {
  chrome.storage.local.set({jobApplications: []}, () => {
    renderHistory([]);
  });
});

refreshStatus();
