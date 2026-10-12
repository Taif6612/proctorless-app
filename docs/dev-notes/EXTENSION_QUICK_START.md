# ProctorLess Focus - Quick Start (5 Minutes)

## What You Get

A Chrome extension that logs **exactly which websites students visit** during exams.

```
Student visits Google → Extension sees it → Backend logs it → Professor sees it
Student visits Facebook → Extension sees it → Backend logs it → Professor sees it
```

## Installation (3 Steps)

### 1. Create Database Table (1 minute)

```bash
# Go to Supabase SQL Editor → New Query
# Copy this file and run it:
INTEGRITY_TAB_LOGS_MIGRATION.sql
```

**Check it worked:** Table Editor → Look for `integrity_tab_logs` table ✅

### 2. Update Environment (1 minute)

In `.env.local` add:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

Get it from: Supabase → Settings → API → Service Role Secret

### 3. Load Extension (1 minute)

```
1. Chrome → chrome://extensions/
2. Developer Mode ON (top-right)
3. Load Unpacked → Select proctorless-extension folder
4. Pin to toolbar
```

## Test It (2 Minutes)

1. **Click the extension icon** → You see "Status: Disarmed"
2. **Click "Arm Monitoring"** → Status becomes "Armed ✓"
3. **Open multiple tabs** and switch between them
4. **Watch "Logs sent" counter increment**
5. **Check Supabase** → Table Editor → `integrity_tab_logs` → See your URLs ✅

## Files

| File | What It Does |
|------|--------------|
| `manifest.json` | Extension configuration |
| `background.js` | Detects tabs, sends logs |
| `popup.html/js` | Arm/Disarm button |
| `app/api/integrity/tab/route.ts` | Backend API endpoint |
| `lib/extensionHelper.ts` | Auto-arm from quiz page |

## Key Endpoints

**Extension Sends:**
```
POST /api/integrity/tab
{
  "url": "https://facebook.com",
  "ts": 1699874400000,
  "submissionId": "uuid-here"
}
```

**Backend Returns:**
```json
{
  "ok": true,
  "id": 12345
}
```

## Auto-Arm Quiz (Optional)

When quiz starts, auto-arm the extension:

```typescript
// app/dashboard/quiz/[id]/page.tsx
import { armExtension, disarmExtension } from '@/lib/extensionHelper';

useEffect(() => {
  const startQuiz = async () => {
    const submission = await createSubmission(quizId);
    await armExtension(submission.id); // Auto-arm! ✅
  };
  startQuiz();
}, []);

// When quiz ends:
const handleSubmit = async () => {
  await submitAnswers();
  await disarmExtension(); // Auto-disarm! ✅
};
```

## Results Dashboard

Show extension logs alongside in-page violations:

```typescript
// Fetch extension logs
const { data: urlLogs } = await supabase
  .from('integrity_tab_logs')
  .select('*')
  .eq('submission_id', submissionId);

// Display
urlLogs.forEach(log => {
  console.log(`✅ Visited: ${log.url} at ${log.created_at}`);
});
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension doesn't load | Go to `chrome://extensions/`, toggle Developer Mode |
| Logs not sending | Check `F12` → Console for errors, verify API_BASE_URL |
| 401 Unauthorized | Ensure `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` |
| No database table | Run INTEGRITY_TAB_LOGS_MIGRATION.sql in Supabase |

## Privacy

What's logged:
- ✅ Active tab URL
- ✅ Timestamp
- ✅ User ID

What's NOT logged:
- ❌ Page contents
- ❌ Webcam/Microphone
- ❌ Keystrokes
- ❌ Other tabs (only active tab)

## Done ✅

Your extension is ready. Next:

1. **Test it:** Follow "Test It" section above
2. **Wire to quiz:** Add armExtension/disarmExtension calls
3. **Show in dashboard:** Fetch integrity_tab_logs in results page
4. **Deploy:** Update API_BASE_URL to Vercel, add env vars to Vercel

## Links

- Full Setup: `CHROME_EXTENSION_SETUP.md`
- Extension Docs: `proctorless-extension/README.md`
- Backend API: `app/api/integrity/tab/route.ts`
- Helper Functions: `lib/extensionHelper.ts`
- Database Migration: `INTEGRITY_TAB_LOGS_MIGRATION.sql`
