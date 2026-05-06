# Privacy Policy — Job Hunter Tracker

**Effective date:** 2026-05-01
**Last updated:** 2026-05-01

## Summary

Job Hunter Tracker is a local-first browser extension. It detects when you are
viewing or submitting a job application and records the event on your own
device. **Nothing you record is sent to the developer, to any server, or to any
third party.** There is no account, no telemetry, no analytics, and no remote
storage.

## What data the extension processes

When the extension's content script runs on a page that matches its
job-detection criteria, it reads the following from the page in order to decide
whether the page is a job posting and, if so, to label the entry:

- The page URL
- The page title
- Job posting metadata published by the page itself, where available — for
  example a JSON-LD `JobPosting` schema's `title` and `hiringOrganization.name`
- The presence and text of apply / submit buttons
- The presence of resume / CV upload form fields
- The detected Applicant Tracking System (e.g. Greenhouse, Lever, Workday,
  Ashby, iCIMS, etc.) inferred from URL patterns and DOM signatures
- A confidence score and the list of reasons that led the extension to classify
  the page as a job posting (used for debugging)

When you import a `.eml` email file via the dashboard, the extension parses it
in your browser to extract:

- The email subject, sender, and date
- A best-effort guess at the company and job title

## How the data is stored

All recorded entries are stored exclusively in `chrome.storage.local`, the
browser's per-extension local storage. This storage is on your device only and
is not synced to any cloud service.

Two storage keys are used:

- `openedJobAds` — pages the extension classified as a job posting, deduplicated
  by URL, capped at 100 entries
- `jobApplications` — events where the extension detected a submission (form
  submit or apply-button click) or where you imported a record from an `.eml`
  file

A legacy key `applicationInProgress` from earlier versions is migrated into
`openedJobAds` on first run after upgrade and then removed.

## What is **not** collected or transmitted

- The extension does not contain any tracking, analytics, or telemetry code
- The extension does not load or execute any remote code, scripts, fonts, or
  stylesheets
- The extension does not make any network requests of its own — no `fetch`,
  no `XMLHttpRequest`, no WebSocket, no remote font or image load
- The extension does not collect your name, email address, login credentials,
  payment information, health data, location, contacts, files outside the `.eml`
  files you explicitly drag into the import dialog, browsing history outside
  pages it classified as job postings, or any other personal information beyond
  what is described above
- The extension does not sell, share, or transfer any data to any party

## Permissions and why they are needed

| Permission | Why it is requested |
|---|---|
| `<all_urls>` host access | Job applications happen on a wide range of domains — major job boards, ~20 ATS providers, and the careers pages of every individual company. A static allow-list would miss most real-world applications. The host permission lets the extension run its detection logic on any page; the detection itself filters out non-job pages. |
| `all_frames: true` content scripts | ATS providers like Greenhouse and Workday are routinely embedded as iframes on companies' own careers pages. Without iframe access, application forms inside those embeds would be invisible to the extension. |
| `storage` | Persists your recorded entries in `chrome.storage.local`. |
| `tabs` | The popup reads the active tab's URL to show whether the currently viewed page has been recorded. |
| `activeTab` | Reliability fallback alongside the `tabs` permission. |

## Your control over the data

- You can view all recorded entries at any time from the extension's dashboard.
- You can delete any single entry from the dashboard.
- You can clear all entries with the **Clear All** button on the dashboard, or
  clear submitted applications only via the popup's **Clear submitted** button.
- Uninstalling the extension removes all extension storage, including every
  recorded entry.
- You may also clear the extension's storage via Chrome's `chrome://extensions`
  page → Job Hunter Tracker → Site settings → Clear data.

## Children's privacy

The extension is not directed at children under 13 and the developer does not
knowingly process data from children.

## Changes to this policy

If this policy changes in a way that affects what the extension does with
locally stored data, the change will be reflected in this document and the
**Last updated** date will be revised. Because no data leaves your device, no
notification mechanism is necessary; reviewing this document is sufficient.

## Contact

For questions about this policy, open an issue on the project's repository or
contact the developer at:

`<your-contact-email-here>`

---

*This extension's source code is local-first by design and contains no remote
code execution paths. The list of network calls made by the extension itself is
the empty list.*
