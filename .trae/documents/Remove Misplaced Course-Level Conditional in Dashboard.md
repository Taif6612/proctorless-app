## Issue
- A stray course-level conditional `{addingQuestionsFor === course.id && (...)}` remains at the end of `app/dashboard/page.tsx`, outside the quiz map.
- This references `addingQuestionsFor` out of scope during server evaluation, causing a ReferenceError.

## Fix
- Delete the entire course-level conditional block.
- Rely on the per-quiz conditional panel already implemented (`{addingQuestionsFor === quiz.id && (...)}`) inside the `.map` wrapper.

## Verification
- Dashboards compile and render.
- Professor can upload → parse → preview → save questions per quiz.
- Student dashboard loads normally.