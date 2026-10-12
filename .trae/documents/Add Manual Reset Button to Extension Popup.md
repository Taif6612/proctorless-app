## Goal
- Provide a manual reset in the extension popup to clear `submissionId` and `logCount`, and disarm monitoring when needed.

## Changes
- Popup UI: Add a `Reset Extension` button next to the arm/disarm controls.
- Popup logic: On click, send `resetState` to background and update local UI state.

## Verification
- Reload the extension, open the popup, click `Reset Extension`.
- Confirm Status becomes Disarmed, Submission ID field becomes empty, and Logs sent is 0.

Approve to implement and wire the reset button in the popup.