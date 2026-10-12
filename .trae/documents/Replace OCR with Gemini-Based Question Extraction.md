## Goal
- Use your Gemini API key to extract questions from uploaded files and produce a structured question list for professor review and editing.

## Security & Config
- Add `GEMINI_API_KEY` to `.env.local` (do not hardcode in code).
- Restart the dev server to load env.

## API Route
- Create `app/api/gemini/extract/route.ts`:
  - Accept `{ fileUrl, contentType }`.
  - For images (`image/*`): fetch file, base64 encode, call Gemini (gemini-1.5-flash) with `inline_data` and a strict JSON output instruction (questions array with type, prompt, choices, max_marks).
  - For PDFs/Word: initial MVP fallback to fetch and attempt text extraction where possible; if not feasible without extra libs, return a clear error message and keep the existing upload path for now.

## Professor Flow Update
- In the “Add Questions” panel:
  - After upload to `question_assets`, call `/api/gemini/extract` with the `publicUrl` and `contentType`.
  - Render the returned structured questions in the preview and allow saving to `question_banks`.

## Question Structure
- Expected JSON per question:
  - `{ order_index, type: 'mcq'|'text'|'boolean'|'numeric', prompt, choices?: string[], max_marks?: number }`

## Editing & Grading
- Keep current preview; allow save to quiz.
- Next step (optional in this pass): extend Results page to show answers and add per-question manual marks.

## Verification
- Upload an image of questions → preview appears using Gemini extraction → save.
- The quiz page can then load and render questions from `question_banks`.

## Note
- PDFs/Word robust handling requires either the Gemini Files API or a server-side parser; we will prioritize images first to get faculty demo-ready, then add document support.