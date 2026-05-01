// Registry of known Applicant Tracking Systems and job-board apply widgets.
// Each provider entry is consumed by the generic page scorer in content-script.js.
//
// Fields:
//   name                  Display name (used as "ats" attribution in stored records)
//   urlPatterns           RegExps tested against location.href for cheap match
//   selectors             CSS selectors highly specific to this ATS (DOM fingerprint)
//   applyButtonSelectors  CSS selectors for the actual apply/submit button(s)

const JHT_ATS_PROVIDERS = [
  {
    name: 'Greenhouse',
    urlPatterns: [
      /(^|\.)greenhouse\.io/i,
      /boards-api\.greenhouse\.io/i,
      /boards\.greenhouse\.io/i,
      /job-boards\.greenhouse\.io/i
    ],
    selectors: [
      '#grnhse_app',
      '#grnhse_iframe',
      '#application_form',
      '#main_fields',
      'div[id^="grnhse_"]',
      'iframe[src*="greenhouse.io"]'
    ],
    applyButtonSelectors: [
      // Final submission (form is filled out)
      '#submit_app',
      'input#submit_app',
      'button#submit_app',
      'a.template-btn-submit',
      // Listing-page apply button (opens / scrolls to the form)
      '#main_apply_btn',
      '#apply_button',
      'a.btn[href*="#app"]',
      'a[href*="greenhouse.io"][href*="apply"]'
    ]
  },
  {
    name: 'Lever',
    urlPatterns: [/jobs\.lever\.co/i],
    selectors: ['.posting-page', '.posting-headline', '.application-form .application-question'],
    applyButtonSelectors: ['a.template-btn-submit', '.posting-btn-submit', 'a.postings-btn[href*="/apply"]']
  },
  {
    name: 'Workday',
    urlPatterns: [/myworkdayjobs\.com/i, /workday\.com\/.*\/job/i, /\/wday\//i],
    selectors: [
      '[data-automation-id="jobPostingPage"]',
      '[data-automation-id="jobPostingHeader"]',
      '[data-automation-id="jobPostingDescription"]'
    ],
    applyButtonSelectors: [
      '[data-automation-id="adventureButton"]',
      '[data-automation-id="apply"]',
      'a[data-automation-id*="apply" i]',
      'button[data-automation-id*="apply" i]',
      'button[data-automation-id*="submit" i]'
    ]
  },
  {
    name: 'Ashby',
    urlPatterns: [/jobs\.ashbyhq\.com/i, /ashbyhq\.com\/[^/]+\/[A-Za-z0-9-]+/i],
    selectors: ['div[class*="ashby-job" i]', 'a[href*="ashbyhq.com"][href*="/application"]'],
    applyButtonSelectors: ['a[href*="/application"]', 'button[class*="apply" i]']
  },
  {
    name: 'SmartRecruiters',
    urlPatterns: [/smartrecruiters\.com/i],
    selectors: ['.job-content', '.sr-job', '#st-jobDescription', '[data-test*="smart" i]'],
    applyButtonSelectors: ['#applyButton', '#st-applyManually', 'a[data-test*="apply" i]']
  },
  {
    name: 'iCIMS',
    urlPatterns: [/\.icims\.com/i],
    selectors: ['#iCIMS_main', '#iCIMS_JobHeader', 'iframe[src*="icims.com"]'],
    applyButtonSelectors: ['#icims_button_apply', 'a[id*="apply" i][id*="icims" i]']
  },
  {
    name: 'Taleo',
    urlPatterns: [/taleo\.net/i],
    selectors: ['form[name*="taleo" i]', 'div[id*="taleo" i]', '.taleo-section'],
    applyButtonSelectors: ['button[id*="applyOnline" i]', 'a[id*="apply" i]', 'input[name*="apply" i]']
  },
  {
    name: 'Workable',
    urlPatterns: [/apply\.workable\.com/i, /workable\.com\/j\//i, /workable\.com\/jobs\//i],
    selectors: ['[data-ui="job-description"]', '.workable-application'],
    applyButtonSelectors: ['button[data-ui*="apply" i]', 'a[data-ui*="apply" i]']
  },
  {
    name: 'Recruitee',
    urlPatterns: [/\.recruitee\.com/i],
    selectors: ['.c-job', '.c-job__apply', 'main[class*="job" i][class*="recruitee" i]'],
    applyButtonSelectors: ['.c-job__apply a', 'a[href*="/o/"][href*="/c/"]', 'a[href*="/apply"]']
  },
  {
    name: 'BambooHR',
    urlPatterns: [/bamboohr\.com\/jobs/i, /bamboohr\.com\/careers/i],
    selectors: ['.BambooHR-ATS-board-list', '.BambooHR-ATS-Jobs', '#BambooHR-ATS'],
    applyButtonSelectors: ['.BambooHR-ATS-board-list a', 'a[id*="apply" i]']
  },
  {
    name: 'JazzHR',
    urlPatterns: [/applytojob\.com/i, /jazz\.co/i, /jazzhr\.com/i],
    selectors: ['.jazzhr-content', '#resumator-job', '.job-description-container'],
    applyButtonSelectors: ['#resumator-apply-button', 'a[id*="apply" i]']
  },
  {
    name: 'Jobvite',
    urlPatterns: [/jobvite\.com/i],
    selectors: ['.jv-careersite', '.jv-job-detail', '#jv-job-listing'],
    applyButtonSelectors: ['.jv-button-apply', 'a.jv-button[href*="apply"]']
  },
  {
    name: 'Breezy HR',
    urlPatterns: [/\.breezy\.hr/i],
    selectors: ['.position', '.position-form', '.position-details'],
    applyButtonSelectors: ['.position-cta a', 'a[href*="/p/"][href*="/apply"]']
  },
  {
    name: 'Personio',
    urlPatterns: [/jobs\.personio\.(com|de)/i, /personio\.de\/job/i],
    selectors: ['[data-test*="personio" i]', '.jobad', '.job-description'],
    applyButtonSelectors: ['a[href*="apply"]', 'button[data-test*="apply" i]']
  },
  {
    name: 'Eightfold',
    urlPatterns: [/\.eightfold\.ai/i],
    selectors: ['.position-detail', '.eight-job-details', '[class*="position-card" i]'],
    applyButtonSelectors: ['button[class*="apply" i]', 'a[class*="apply" i]']
  },
  {
    name: 'LinkedIn Jobs',
    // ONLY dedicated job pages — `/jobs/search/`, `/jobs/collections/`,
    // `/jobs/application/` are browsing views and should not auto-mark.
    // Apply-button text patterns ("Easy Apply") still capture clicks even
    // on browsing pages where this provider does not match.
    urlPatterns: [/linkedin\.com\/jobs\/view\/\d+/i],
    selectors: [],
    applyButtonSelectors: [
      'button.jobs-apply-button',
      'button[aria-label*="Easy Apply" i]',
      'button[data-control-name*="apply" i]'
    ]
  },
  {
    name: 'Indeed',
    urlPatterns: [/indeed\.com\/(viewjob|jobs|q-|apply|cmp)/i],
    selectors: ['#jobDescriptionText', '.jobsearch-JobInfoHeader-title', '#viewJobSSRRoot'],
    applyButtonSelectors: ['#indeedApplyButton', 'button[id*="apply" i]', 'a[id*="apply" i]']
  },
  {
    name: 'Glassdoor',
    urlPatterns: [/glassdoor\.com\/(job|Job|partner)/i],
    selectors: ['#JobView', '.jobDescriptionContent', '[data-test="jobDescriptionContainer"]'],
    applyButtonSelectors: ['button[data-test*="apply" i]', 'a[data-test*="apply" i]']
  },
  {
    name: 'Pinpoint',
    urlPatterns: [/\.pinpointhq\.com/i],
    selectors: ['.job-page', '.job-application'],
    applyButtonSelectors: ['a[href*="/apply"]', 'button[class*="apply" i]']
  },
  {
    name: 'Rippling',
    urlPatterns: [/ats\.rippling\.com/i],
    selectors: ['[class*="job-detail" i]', '[class*="rippling" i][class*="job" i]'],
    applyButtonSelectors: ['button[class*="apply" i]', 'a[href*="/apply"]']
  },
  {
    name: 'Polymer',
    urlPatterns: [/jobs\.polymer\.co/i],
    selectors: ['main [class*="job" i]'],
    applyButtonSelectors: ['button[class*="apply" i]', 'a[href*="/apply"]']
  }
];

// Make it discoverable to the content script (same isolated world).
if (typeof window !== 'undefined') {
  window.JHT_ATS_PROVIDERS = JHT_ATS_PROVIDERS;
}
