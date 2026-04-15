chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Job Hunter Tracker: Background received message:', message);

  if (message.action === 'recordApplicationEvent') {
    const record = {
      url: message.url,
      title: message.title,
      eventType: message.eventType,
      timestamp: new Date().toISOString()
    };

    console.log('Job Hunter Tracker: Recording application event:', record);

    chrome.storage.local.get({jobApplications: []}, (result) => {
      const jobApplications = Array.isArray(result.jobApplications) ? result.jobApplications : [];
      jobApplications.unshift(record);
      chrome.storage.local.set({jobApplications}, () => {
        if (chrome.runtime.lastError) {
          console.error('Job Hunter Tracker: Error saving application event:', chrome.runtime.lastError);
        } else {
          console.log('Job Hunter Tracker: Application event recorded successfully');
        }
      });
    });
  }

  if (message.action === 'markApplicationPage') {
    const progressData = {
      url: message.url,
      title: message.title,
      detectedAt: new Date().toISOString()
    };

    console.log('Job Hunter Tracker: Marking application page:', progressData);

    chrome.storage.local.set({applicationInProgress: progressData}, () => {
      if (chrome.runtime.lastError) {
        console.error('Job Hunter Tracker: Error marking application page:', chrome.runtime.lastError);
      } else {
        console.log('Job Hunter Tracker: Application page marked successfully');
      }
    });
  }
});