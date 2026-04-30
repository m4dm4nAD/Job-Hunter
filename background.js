const MAX_OPENED_JOB_ADS = 500;

function migrateLegacyOpenedJobAd() {
  chrome.storage.local.get(['applicationInProgress', 'openedJobAds'], (result) => {
    const legacy = result.applicationInProgress;
    if (!legacy || !legacy.url) return;

    const list = Array.isArray(result.openedJobAds) ? result.openedJobAds : [];
    if (!list.some(entry => entry.url === legacy.url)) {
      list.unshift({
        url: legacy.url,
        title: legacy.title,
        detectedAt: legacy.detectedAt || new Date().toISOString()
      });
    }
    chrome.storage.local.set({openedJobAds: list}, () => {
      chrome.storage.local.remove('applicationInProgress');
    });
  });
}

chrome.runtime.onInstalled.addListener(migrateLegacyOpenedJobAd);
chrome.runtime.onStartup.addListener(migrateLegacyOpenedJobAd);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'recordApplicationEvent') {
    const record = {
      url: message.url,
      title: message.title,
      company: message.company || null,
      ats: message.ats || null,
      eventType: message.eventType,
      timestamp: new Date().toISOString()
    };

    chrome.storage.local.get({jobApplications: []}, (result) => {
      const jobApplications = Array.isArray(result.jobApplications) ? result.jobApplications : [];
      jobApplications.unshift(record);
      chrome.storage.local.set({jobApplications}, () => {
        if (chrome.runtime.lastError) {
          console.error('Job Hunter Tracker: error saving event:', chrome.runtime.lastError);
        }
      });
    });
    return;
  }

  if (message.action === 'markApplicationPage') {
    const entry = {
      url: message.url,
      title: message.title,
      company: message.company || null,
      ats: message.ats || null,
      score: typeof message.score === 'number' ? message.score : null,
      reasons: Array.isArray(message.reasons) ? message.reasons : null,
      detectedAt: new Date().toISOString()
    };

    chrome.storage.local.get({openedJobAds: []}, (result) => {
      const list = Array.isArray(result.openedJobAds) ? result.openedJobAds : [];
      const existingIdx = list.findIndex(item => item.url === entry.url);
      if (existingIdx >= 0) list.splice(existingIdx, 1);
      list.unshift(entry);
      if (list.length > MAX_OPENED_JOB_ADS) list.length = MAX_OPENED_JOB_ADS;

      chrome.storage.local.set({openedJobAds: list}, () => {
        if (chrome.runtime.lastError) {
          console.error('Job Hunter Tracker: error saving opened job ad:', chrome.runtime.lastError);
        }
      });
    });
    return;
  }
});
