## Goals
- Count one extension log per tab switch away from the quiz, not two.
- Show the destination site for each tab switch in the Results dashboard by correlating extension URL logs.
- Prevent rapid duplicate in-page tab-switch logs via debounce.

## Changes
- Extension (background.js):
  - Add app-origin filter to ignore URLs from your app (localhost:3003).
  - Dedupe by caching last URL and timestamp; skip near-duplicates (≈1s window).
  - Keep logging on tab activation and gate page-update logging with dedupe.
- Results dashboard (results/[quizId]/page.tsx):
  - For each `integrity_logs` entry, find the closest `integrity_tab_logs` within a small time window (±5s).
  - Display the destination hostname next to the tab switch and mark Allowed/Flagged based on `allowed_websites`.
- Quiz page (quiz/[id]/page.tsx):
  - Debounce `visibilitychange` handling (≈800ms) so flickers don’t create multiple logs.

## Verification
- Arm extension with a submission ID; switch tabs.
- Popup “Logs sent” increments once per switch away; returning to the quiz doesn’t add a destination log.
- Results show destinations next to tab switches and Allowed/Flagged status based on the allowed list.
- In-page violation count increases once per switch.

Approve to apply these changes and test end-to-end on localhost:3003.