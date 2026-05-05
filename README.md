# Job Hunter Tracker

A local-first browser extension that detects when you are working on a job application and records when you submit it. All data is stored in browser storage and never leaves your machine.


## Installation
1. Open your browser's extension page.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Firefox: `about:debugging#/runtime/this-firefox`
2. Enable developer mode.
3. Load unpacked extension and select this folder.

## How to Use

### From the Extension Popup
1. Click the extension icon to open the popup
2. See current page application status
3. View recent applications
4. Click ** View Dashboard** to access the full dashboard

### Using the Dashboard
1. Open `dashboard.html` as a standalone page
   - Right-click the extension icon → "Manage Extensions" → "Allow access to file URLs"
   - Or bookmark the dashboard link from the popup
2. View all your job applications in one place
3. **Filter** by date, search by job title or URL
4. **Export** to CSV for records
5. **Delete** individual applications or clear all
6. **View Statistics** - track applications by time period

### Importing Applications from Email
1. Click the **📧 Import from Email** button on the dashboard
2. Drag and drop .eml files or select them
3. Review the extracted company names and job titles
4. Edit any missing or incorrect information
5. Click **✓ Import All** to add them to your tracker

The parser will automatically extract:
- Company name from email headers, sender domain, or email body
- Job title from subject line and body content
- Date from email timestamp

## Files

- `manifest.json` - Extension configuration
- `content-script.js` - Detects job application pages
- `background.js` - Handles storage operations
- `popup.html` / `popup.js` / `styles.css` - Quick popup interface
- `dashboard.html` / `dashboard.js` / `dashboard-styles.css` - Full dashboard
- `eml-parser.js` - Email file parser for importing applications
- `test-page.html` - Test application form for development
- `sample-email.eml` - Sample email file for testing import
- `sample-email-2.eml` - Another sample email for testing

## How it Works

1. **Content script** scans each page for job application forms and submit buttons
2. When it finds application activity, it sends a message to the background script
3. **Background script** saves all application records to `chrome.storage.local`
4. Both the **popup** and **dashboard** read from this storage to display your history
5. No data ever leaves your device





