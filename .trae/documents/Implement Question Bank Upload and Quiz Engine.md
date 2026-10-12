## Goal
- Accept question images like the sample path provided and extract text reliably using Optiiic.dev, then parse into structured questions for the quiz editor.

## Input & Preprocessing
- Accepted formats: JPEG/PNG images (768x1024 or similar), PDFs.
- Preprocess client-side (optional): warn on very low resolution; suggest capturing portrait, good lighting, no skew.
- Upload original image(s) to Supabase Storage bucket `question_assets` with unique path (course/quiz/date/uuid).

## OCR Pipeline (Server)
- Add secure server handler `POST /api/ocr/parse`:
  - Inputs: `{ asset_path, asset_type: 'image'|'pdf' }` or signed URL.
  - Fetch asset from Storage; stream to Optiiic.dev.
  - Env: `OPTIIC_API_KEY` (stored in secrets). Never hardcode.
  - Receive OCR text; normalize whitespace, preserve numbering.

## Parsing Strategy
- Split by question numbering:
  - Regex: `^\s*(\d+)[\).]\s+` (multiline) to find question starts.
  - Each block becomes one question.
- Detect type:
  - MCQ: presence of choice lines like `A)` `B)` or `a.` `b.`; capture `choices`.
  - True/False: keywords; or two choices.
  - Short Answer/Numeric: fallback when no choices.
- Detect marks:
  - Pattern: `(\d+)\s*marks` or `[\[(](\d+)\s*m[\])}]`; assign `max_marks`.
- Build structure: `{ order_index, prompt, type, choices?, max_marks? }`.
- Return JSON to client and store a copy in `question_banks` for fast reuse.

## Professor Review & Edit
- Show parsed questions in an editor:
  - Editable fields: prompt, type, choices, max marks; reorder/add/delete.
  - Save to `questions` table (linked to quiz) and persist a versioned JSON to `question_banks`.

## Student Rendering
- Quiz page loads `questions` by quiz_id; renders per type (MCQ/TF/Text/Numeric).
- Track answers; on submit update `submissions.answers_json`.

## Edge Cases & Quality Control
- Skewed/blurred images: surface a “Low readability” warning; allow manual copy/paste.
- Multi-page scans: support multiple images; concatenate OCR outputs before parsing.
- Non-English text: document language setting for OCR (if supported by Optiiic.dev).

## Security & RLS
- Use signed URLs for OCR fetch if assets are private.
- RLS policies: professors can upload/parse; students can read questions; only own submissions update.

## Testing
- Use the sample image path to simulate OCR; verify numbering split and types detected.
- Confirm editor adjustments and saving to DB.
- Student flow: complete and submit; answers persist.

## Deliverables
- OCR API handler (server route) integrated with Optiiic.dev.
- Parsing routine for numbered questions and types.
- Question editor UI to correct OCR output.
- Quiz load and answer submission.

Confirm to proceed and I will implement upload → OCR → parse → edit → render → submit, starting with the server handler and parsing routine, then UI integration.