# Chrome Extension Setup Guide

## Overview

We've created **ProctorLess Focus**, a Chrome extension that solves the browser security limitation by directly logging the URLs students visit during exams. This guide walks you through setup, testing, and integration.

---

## Step 1: Create the Database Table

1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Create a **New query**
3. Copy the contents of `INTEGRITY_TAB_LOGS_MIGRATION.sql`
4. Paste into the query editor
5. Click **Execute**

You should see:
```
✅ CREATE TABLE
✅ CREATE INDEX (4x)
✅ ALTER TABLE
✅ CREATE POLICY (3x)
✅ COMMENT ON
```

**Verify it worked:**
- Go to **Table Editor** in Supabase
- Look for the new `integrity_tab_logs` table
- Click it and verify columns: `id`, `user_id`, `submission_id`, `url`, `ts_ms`, `kind`, `created_at`

---

## Step 2: Update Your Environment Variables

Your Next.js app needs the **service role key** to write to the database from the API.

1. Go to Supabase → **Project Settings** → **API**
2. Copy the **Service Role Secret** (NOT the anon key)
3. Open `.env.local` in your Next.js project
4. Add:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**⚠️ Security Warning:**
- Never commit this key to GitHub
- `.env.local` should be in `.gitignore` (it already is by default)
- This key has full database access; keep it secret

---

## Step 3: Load the Extension Locally

1. Open Chrome (or Chromium-based browser)
2. Go to `chrome://extensions/`
3. Toggle **Developer mode** (top-right corner)
4. Click **Load unpacked**
5. Navigate to: `c:\Users\ASUS\Desktop\Smart assessment tool\proctorless-extension`
6. Click **Select Folder**

You should see:
```
ProctorLess Focus
Version: 1.0.0
Privacy-first URL logging during exams (no webcam).
```

**📌 Pin the extension:**
- Click the extension icon in the Chrome toolbar
- Pin it so it's always visible

---

## Step 4: Test the Extension (5 minutes)

### Part A: Test Locally

1. **Start your Next.js dev server:**
   ```bash
   cd c:\Users\ASUS\Desktop\Smart assessment tool\proctorless-app
   npm run dev
   ```
   You should see: `✓ Local: http://localhost:3000`

2. **Open the extension popup:**
   - Click the **ProctorLess Focus** icon in your toolbar
   - You should see:
     ```
     ProctorLess Focus
     Status: Disarmed
     Logs sent: 0
     [Arm Monitoring] button
     ```

3. **Check the browser console:**
   - Press `F12` → Console tab
   - You should see:
     ```
     [ProctorLess] Background service worker loaded
     ```

4. **Arm the extension:**
   - Click the **Arm Monitoring** button in the popup
   - Status should change to: `Armed ✓`
   - Console should show:
     ```
     [ProctorLess] Armed state changed to: true
     ```

5. **Test by visiting websites:**
   - Open new tabs and visit different websites:
     - https://google.com
     - https://github.com
     - https://stackoverflow.com
   - Switch back and forth between tabs
   - Watch the **Logs sent** counter increment in the popup
   - Console should show:
     ```
     [ProctorLess] Sending log: { url: 'https://google.com', ts: ..., kind: 'ACTIVE_TAB_URL' }
     [ProctorLess] Log sent successfully: { ok: true, id: 12345 }
     ```

6. **Verify in the database:**
   - Go to Supabase → **Table Editor** → **integrity_tab_logs**
   - You should see new rows with the URLs you visited
   - Each row shows: `url`, `ts_ms`, `user_id` (should be your user ID)

### Part B: Troubleshooting

**Popup shows "Disarmed" but logs aren't sending:**
1. Check `F12` → **Console** for error messages
2. Check `F12` → **Network** tab
   - Look for POST requests to `http://localhost:3000/api/integrity/tab`
   - If requests are failing, you'll see them in red
   - Click on the failed request → **Response** tab to see the error

**Backend returns 401 Unauthorized:**
1. The API can't identify the user
2. Check your token format in `background.js`
3. For now, you can pass `submissionId` instead of a token
4. Example: When starting a quiz, pass the submission ID:
   ```javascript
   chrome.runtime.sendMessage({
     action: 'setArmedState',
     armed: true,
     submissionId: 'your-submission-uuid'
   });
   ```

**No logs appear in Supabase:**
1. Check the API response in the Network tab
2. Look for error messages in Supabase logs (Project Settings → Logs)
3. Verify the table exists: `SELECT COUNT(*) FROM integrity_tab_logs;`

---

## Step 5: Wire Up Auto-Arm (Optional but Recommended)

When a student starts a quiz, the extension can auto-arm automatically. This removes the manual step.

### Add to your Quiz Page (`app/dashboard/quiz/[id]/page.tsx`)

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function QuizPage({ params }: { params: { id: string } }) {
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    // When quiz starts, create submission and auto-arm extension
    const initializeQuiz = async () => {
      // 1. Create submission (existing code)
      const newSubmission = await createSubmission(params.id);
      setSubmissionId(newSubmission.id);

      // 2. Auto-arm the extension with submission ID
      if (typeof window !== 'undefined' && 'chrome' in window) {
        try {
          (chrome as any).runtime.sendMessage(
            {
              action: 'setArmedState',
              armed: true,
              submissionId: newSubmission.id
            },
            (response: any) => {
              if (response?.success) {
                console.log('✅ Extension armed automatically');
              }
            }
          );
        } catch (error) {
          // Extension not installed; that's ok
          console.log('📌 Extension not found (student may not have installed it)');
        }
      }
    };

    initializeQuiz();
  }, [params.id]);

  // ... rest of your quiz component
}
```

### Wire to When Quiz Ends

```typescript
const handleSubmitQuiz = async () => {
  // ... submit quiz logic

  // Disarm the extension when quiz ends
  if (typeof window !== 'undefined' && 'chrome' in window) {
    (chrome as any).runtime.sendMessage({
      action: 'setArmedState',
      armed: false
    });
  }
};
```

---

## Step 6: Display Extension Logs in Results Dashboard

Update your **Results Dashboard** to show both in-page violations AND extension URL logs.

### Add to `app/dashboard/results/[quizId]/page.tsx`

```typescript
// Fetch extension logs alongside existing integrity_logs
const { data: extensionLogs } = await supabase
  .from('integrity_tab_logs')
  .select('*')
  .eq('submission_id', submissionId)
  .order('ts_ms', { ascending: true });

// Combine both sets of logs in the UI
const allLogs = [
  ...integrity_logs.map(log => ({
    type: 'page_tab_switch',
    url: log.referrer,
    timestamp: log.created_at,
    status: log.is_allowed ? 'allowed' : 'flagged'
  })),
  ...extensionLogs.map(log => ({
    type: 'extension_url',
    url: log.url,
    timestamp: new Date(log.ts_ms).toISOString(),
    status: 'logged'
  }))
].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

// Render in UI
allLogs.forEach(log => {
  if (log.type === 'extension_url') {
    console.log(`✅ Extension logged: ${log.url}`);
  } else {
    console.log(`⚠️ In-page tab switch: ${log.url}`);
  }
});
```

---

## Step 7: For Production (Vercel Deployment)

When you deploy to Vercel:

1. **Add environment variable:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `SUPABASE_SERVICE_ROLE_KEY=<your-key>`

2. **Update extension URL in `background.js`:**
   ```javascript
   const API_BASE_URL = 'https://your-app.vercel.app';
   ```

3. **Update `manifest.json` to allow your production domain:**
   ```json
   "host_permissions": [
     "https://your-app.vercel.app/*"
   ]
   ```

4. **Publish to Chrome Web Store (optional):**
   - Once everything works, you can publish the extension
   - Students install it once; updates are automatic

---

## Architecture Summary

```
┌─────────────────────────────────────────┐
│  Student's Chrome Browser               │
│  ├─ Tab 1: Quiz (localhost:3000)        │
│  └─ Tab 2: Facebook (facebook.com)      │ ← Student switches here
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  ProctorLess Focus Extension (Armed)    │
│  - Detects tab switch                   │
│  - Sends: POST /api/integrity/tab       │
│    { url: "facebook.com", ts: ... }     │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  Next.js API Route                      │
│  POST /api/integrity/tab                │
│  - Validates request                    │
│  - Extracts user_id from token          │
│  - Inserts to DB                        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  Supabase PostgreSQL                    │
│  Table: integrity_tab_logs              │
│  Row: facebook.com logged at 14:23:45   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  Professor Results Dashboard            │
│  Shows:                                 │
│  - Student visited: facebook.com        │
│  - Time: 14:23:45                       │
│  - Quiz time: 14:20:00 - 14:30:00       │
└─────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ **Create database table** (INTEGRITY_TAB_LOGS_MIGRATION.sql)
2. ✅ **Load extension locally** (Developer Mode)
3. ✅ **Test arm/disarm** and verify logs in Supabase
4. ⬜ **Wire auto-arm** to quiz start (Step 5)
5. ⬜ **Display logs in Results Dashboard** (Step 6)
6. ⬜ **Deploy to Vercel** when ready (Step 7)

---

## Questions?

Refer to:
- `proctorless-extension/README.md` — Extension documentation
- `CURRENT_STATUS.md` — System architecture
- `UNDERSTANDING_TAB_DETECTION.md` — How to interpret logs
