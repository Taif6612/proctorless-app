## Goal
- When the student clicks Submit on the quiz page, the extension resets its counters and clears submission context so the next quiz starts fresh.

## Changes
- Extension (background.js):
  - Add a message handler `resetState` that sets `logCount` to 0 and clears `submissionId` and `examToken`.
- Client helper (lib/extensionHelper.ts):
  - Add `resetExtensionState()` that sends `resetState` to the extension.
- Quiz page (app/dashboard/quiz/[id]/page.tsx):
  - After `disarmExtension()` in `handleSubmitQuiz`, call `resetExtensionState()`.

## Verification
- Start a quiz, arm extension, switch tabs once (Logs sent: 1+).
- Click Submit; extension disarms and `Logs sent` resets to 0.
- Start a new quiz; arm again; logs count starts from 0.

Approve and I will implement and test this behavior end-to-end.