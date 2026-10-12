## Context
- The dashboard at `http://localhost:3003/dashboard` renders professor vs student views based on `user_roles` (`proctorless-app/app/dashboard/page.tsx`).
- Extension and integrity APIs exist; AI grader function and Storage upload are pending.

## Goals
- Finish local E2E with extension logging and results display.
- Implement AI grading Edge Function and wire into Results.
- Prepare for deployment (Vercel) with correct env vars.

## Step 1: Environment & Roles Validation
- Ensure `.env.local` includes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Verify `user_roles` records exist with at least one `professor` and one `student` user.
- Run `npm run dev` and confirm role-based views on `dashboard` work.

## Step 2: Supabase Schema & Policies
- Apply migrations for `quizzes`, `submissions`, `integrity_logs`, `integrity_tab_logs`, and RPC `create_submission_if_space`.
- Confirm RLS allows:
  - Professors: read their courses/quizzes/submissions; students: read own enrollments/submissions.

## Step 3: Extension E2E (Local)
- In `proctorless-extension/background.js`, set `API_BASE_URL` to `http://localhost:3003`.
- Load extension in Chrome (Developer Mode), test arm/disarm.
- Verify `/api/integrity/tab` receives logs and rows appear in `integrity_tab_logs`.

## Step 4: Quiz Integration with Extension
- In `proctorless-app/app/dashboard/quiz/[id]/page.tsx`:
  - Call `armExtension(submission.id)` after fetching the submission.
  - Call `disarmExtension()` inside `handleSubmitQuiz` upon successful submit.
- Confirm auto-arm on start and auto-disarm on submit.

## Step 5: Results Dashboard: Combine Logs
- In `proctorless-app/app/dashboard/results/[quizId]/page.tsx`, fetch `integrity_tab_logs` per submission and merge with `integrity_logs`.
- Display source badges (Extension vs In-Page) and timestamps.

## Step 6: AI Grading Edge Function
- Create `supabase/functions/ai-grader/index.ts`:
  - Read `GEMINI_API_KEY` from secrets; accept `studentAnswer`, `correctAnswer`.
  - Call Gemini (`gemini-2.5-flash-preview-09-2025`) and return `{ score, feedback }`.
- Add a button in Results to invoke the function and show grades.

## Step 7: Storage for Question Banks (Optional MVP polish)
- Create Supabase bucket `question_banks`.
- Update quiz creation to upload JSON and set `question_bank_path`; load in quiz page.

## Step 8: Deploy to Vercel
- Push repo to GitHub; deploy to Vercel.
- Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.
- Test the live URL with extension and results.

## Deliverables
- Local app fully validated with extension logs and combined results view.
- Working AI grader Edge Function wired to UI.
- Deployed app with environment configured and live tests completed.

Confirm to proceed and I will implement each step, updating files and verifying end-to-end locally on port 3003.