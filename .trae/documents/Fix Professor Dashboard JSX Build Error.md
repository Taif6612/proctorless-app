## Issue
- JSX parse error: "Expected '</', got '{'" at `app/dashboard/page.tsx (512:25)`.
- Cause: The `.map()` returns two sibling elements (`<div>...</div>` and a conditional block) without a single parent wrapper.

## Fix
- Wrap the quiz card and the conditional "Add Questions" panel inside a single parent element per `.map()` iteration, e.g., `<div key={quiz.id}>...{conditional}...</div>`.
- Keep existing state (`addingQuestionsFor`, `assetUploadingFor`, etc.) and handlers; only restructure the JSX.

## Steps
1. Replace the return inside `courseQuizzes[course.id].map((quiz) => ( ... ))` with:
   - `<div key={quiz.id}>` containing both the quiz summary card and the conditional upload+parse panel.
2. Ensure no duplicate keys and that the conditional panel sits directly below its quiz card.
3. Rebuild and verify professor and student dashboards render.

## Verification
- Dashboards compile without errors.
- "Add Questions" button toggles the panel.
- Upload → OCR parse → preview → save works.