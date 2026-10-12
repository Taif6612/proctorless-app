## Goal
- Automatically arm the extension when the active tab is the quiz page and a submission ID is available.

## Changes
- Background script:
  - Detect quiz URLs (`/dashboard/quiz/...`) on tab activation/update.
  - If `submissionId` exists in storage, set `armed: true` and reset `logCount` to 0.

## Verification
- Reload the extension.
- Navigate to a quiz page; the popup should automatically show Status: Armed and Logs sent: 0.
- Switch tabs; logs should increment and correlate with destinations immediately.

Approve and I’ll implement this in the background script and verify behavior.