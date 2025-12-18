# Integrity Monitoring Fix & Testing Guide

## What Was Wrong

1. **Missing `integrity_logs` table** — Your quiz page was trying to insert into `integrity_logs`, but the table didn't exist in your SQL migration.
2. **Referrer matching was too strict** — The code was checking `allowedWebsites.includes(document.referrer)`, but referrer is a full URL (e.g., `https://google.com/search`), not just the domain. This caused all tab switches to fail the check.
3. **Violations weren't being fetched from DB** — The page only stored violations in React state, so they wouldn't persist or update in real-time if the database insert succeeded.

## Changes Made

### 1. Added `integrity_logs` Table

Updated both:
- `supabase/migrations/001_create_quizzes_and_submissions_and_rpc.sql`
- `QUIZ_TABLES_SETUP.sql`

New table schema:
```sql
CREATE TABLE IF NOT EXISTS public.integrity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  violation_type text NOT NULL,
  referrer text NULL,
  is_allowed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Column Details:**
- `submission_id` — Links to the student's submission
- `violation_type` — e.g., 'tab_switch'
- `referrer` — The full referrer URL (e.g., 'https://google.com/search')
- `is_allowed` — Whether the referrer was in the allowed list
- `created_at` — When the violation occurred

### 2. Fixed Referrer Matching Logic

Changed from strict equality:
```typescript
const isAllowed = allowedWebsites.includes(document.referrer);
```

To substring matching:
```typescript
const isAllowed = allowedWebsites.some((site) => document.referrer.includes(site));
```

**Why:** If you set `allowed_websites = "google.com,gmail.com"`, the referrer will be something like `https://google.com/search?q=...`, so we need `.includes()` to match the domain within the full URL.

### 3. Added Real-Time Violation Fetching

New `useEffect` hook:
- Fetches existing violations from the database on mount
- Subscribes to real-time `integrity_logs` INSERT events for this submission
- Updates the UI immediately when a new violation is logged to the DB
- Displays violations fetched from DB + real-time updates

### 4. Added Console Logging

For debugging, the handler now logs:
```javascript
console.log('Tab switch detected. Referrer:', document.referrer);
console.log('Allowed websites:', allowedWebsites);
console.log('Is referrer allowed?', isAllowed);
```

Check your browser console to see what's being detected.

## How to Test

### Step 1: Run the SQL Migration

Run this in your Supabase SQL Editor:

```sql
-- Copy-paste the ENTIRE content of QUIZ_TABLES_SETUP.sql
-- Run it to create/update the integrity_logs table
```

Or run the migration via CLI:
```bash
supabase db push
```

### Step 2: Create a Test Quiz

1. **Professor Dashboard:**
   - Create a new course (or use existing)
   - Create a new quiz with:
     - **Title:** "Integrity Test"
     - **Integrity Monitor:** ✓ Checked
     - **Allowed Websites:** `localhost,127.0.0.1` (or leave empty)
     - **Max Participants:** 10

2. **Student Dashboard:**
   - Join the course (use the join code)
   - Load quizzes for that course
   - Click "Take Quiz"

### Step 3: Test Tab Switch Detection

Once inside the quiz page:

1. **Open DevTools:** Press F12, go to **Console**
2. **Switch tabs:**
   - Click the quiz browser tab
   - Click another app/tab
   - Wait 1 second
   - Click back to the quiz tab
3. **Check the output:**
   - **In Console:** Look for "Tab switch detected" logs
   - **In UI:** "Integrity Status" card should show red and count should increase
   - **In Supabase:** Go to `integrity_logs` table and look for new rows

### Step 4: Verify in Supabase Dashboard

Go to your Supabase project:

1. **Table Editor** → `integrity_logs`
2. Look for rows with:
   - `submission_id` = your submission ID
   - `violation_type` = 'tab_switch'
   - `referrer` = the URL of the tab you switched to
   - `is_allowed` = true/false based on your allowed websites

### Step 5: Test Allowed Websites

1. **Edit the quiz** and set `allowed_websites = "localhost"` (or your domain)
2. **Start a new submission** (student takes quiz again)
3. **Switch to a localhost tab** → Should log as `is_allowed = true`
4. **Switch to another domain** → Should log as `is_allowed = false`

## Testing Checklist

- [ ] SQL migration runs without errors
- [ ] `integrity_logs` table appears in Supabase Table Editor
- [ ] Quiz page loads without errors
- [ ] "Integrity Monitor: Enabled" appears on quiz page
- [ ] Tab switch triggers console logs
- [ ] Tab switch count increases on UI
- [ ] New rows appear in `integrity_logs` table
- [ ] `created_at` timestamps are correct
- [ ] Allowed websites filtering works (`is_allowed` is true/false correctly)

## Debugging Tips

**Issue:** Tab switches not being detected
- **Solution:** Check browser console for errors. Ensure `integrity_monitor_enabled = true` on the quiz.

**Issue:** Violations aren't persisting to database
- **Solution:** 
  - Check browser DevTools > Network tab for failed requests
  - Verify `integrity_logs` table exists (check Supabase Table Editor)
  - Check RLS policies (try disabling them for now with `disable_all_rls.sql`)

**Issue:** Violations appear in DB but not in UI
- **Solution:** Check that the realtime subscription is active. Refresh the page.

**Issue:** Referrer is empty
- **Solution:** Some browsers hide referrer in certain contexts. This is normal. The code logs it as 'unknown'.

## Next Steps

Once integrity monitoring is working, you can:

1. **Display violations on Results Dashboard** — Show professors a list of students with integrity violations
2. **Add more violation types** — e.g., 'submission_late', 'copy_detected'
3. **Trigger AI review** — If `is_allowed = false`, flag the submission for AI grading review
