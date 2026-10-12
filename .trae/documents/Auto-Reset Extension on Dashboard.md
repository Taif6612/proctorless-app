## Goal
- Automatically reset the extension (disarm, clear log count, clear submissionId/examToken) whenever the user navigates to the dashboard.

## Changes
- Background script: detect dashboard URLs on tab activation/update and perform an immediate reset.
  - Reset when URL is under your app origin and path starts with `/dashboard` but not `/dashboard/quiz`.

## Verification
- Reload the extension.
- From a quiz, navigate back to `/dashboard`.
- Open the popup and confirm Status is Disarmed, Submission ID is empty, and Logs sent is 0 immediately (no refresh needed).

Approve to apply this change in the background script.