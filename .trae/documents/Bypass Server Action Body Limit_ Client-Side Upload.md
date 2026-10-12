## Problem
- Next.js rejects >1MB Server Action bodies; `serverActions` option is not recognized in your current setup.

## Fix
- Move file upload to client-side using Supabase browser client, then pass only the Storage public URL to the OCR API.
- Keep `saveQuestionBank` Server Action (payload is small JSON).

## Changes
- In `app/dashboard/page.tsx` upload form handler:
  - Replace call to `uploadQuestionAsset` with `supabase.storage.from('question_assets').upload(...)` and `getPublicUrl(...)`.
  - Then POST to `/api/ocr/parse` with `{ fileUrl }`.

## Outcome
- No large payloads sent through Server Actions; uploads succeed for larger images/PDFs.
- The rest of the flow (parse preview → save to quiz) remains the same.

## Verify
- Upload medium/large file, parse, preview, and save question bank without body size errors.