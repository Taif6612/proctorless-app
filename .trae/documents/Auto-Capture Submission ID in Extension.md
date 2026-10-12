## Goal
- The extension should automatically pick up the quiz submission ID without manual paste.

## Approach
- Use a content script injected on your app’s pages to listen for a page signal and persist the submission ID into chrome.storage.
- Emit a lightweight window.postMessage from the quiz page once the submission is available.

## Changes
- Extension manifest: add `content_scripts` for your app URLs.
- New content script `content.js`: listens for `{ type: 'PROCTORLESS_SUBMISSION_ID', submissionId }` and stores it.
- Quiz page: after fetching `submission`, post the message with the ID.

## Verification
- Reload the extension.
- Start a quiz; the popup’s Submission ID field is automatically populated (no manual entry).

Approve to implement these changes and test end-to-end.