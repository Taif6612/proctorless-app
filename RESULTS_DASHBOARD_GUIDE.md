# ProctorLess: Results & Integrity Dashboard Guide

## Overview

You now have a **complete integrity monitoring system** that allows professors to:

✅ Create quizzes with integrity monitoring enabled  
✅ Students take quizzes while their tab switches are detected  
✅ View comprehensive results dashboard with:
  - All student submissions
  - Integrity violations per student (tab switches)
  - Timestamp of each violation
  - Website/referrer that was visited
  - Duration student was away from quiz
  - Status (allowed domain vs. unauthorized)

---

## Architecture

### Database Tables

```
┌─────────────────┐
│    quizzes      │
│  ├─ id          │
│  ├─ title       │
│  ├─ max_part... │
│  ├─ integrity.. │
│  └─ allowed_... │
└────────┬────────┘
         │
    ┌────▼────────────┐
    │  submissions    │
    │  ├─ id          │
    │  ├─ quiz_id     │
    │  ├─ student_id  │
    │  ├─ started_at  │
    │  └─ submitted_at│
    └────┬────────────┘
         │
    ┌────▼──────────────┐
    │ integrity_logs    │
    │ ├─ id             │
    │ ├─ submission_id  │
    │ ├─ violation_type │
    │ ├─ referrer       │
    │ ├─ is_allowed     │
    │ └─ created_at     │
    └───────────────────┘
```

### Pages

**Professor Flow:**
```
Dashboard
  ├─ Create Course
  ├─ Your Courses
  │  ├─ [Course Name]
  │  ├─ "View Quizzes" button
  │  │  └─ Shows list of quizzes for course
  │  │     └─ "View Results" button per quiz
  │  │        └─ Results Dashboard (new page)
```

**Student Flow:**
```
Dashboard
  ├─ Your Enrolled Courses
  │  ├─ [Course Name]
  │  ├─ "Load Quizzes" button
  │  │  └─ Shows quizzes
  │  │     └─ "Take Quiz" button
  │  │        └─ Quiz Taker Page
  │  │           └─ Submit button
  │  │              └─ Violations logged in real-time
```

### Results Dashboard Features

**File:** `app/dashboard/results/[quizId]/page.tsx`

#### Key Features:

1. **Submission List (Expandable)**
   - Student email
   - Start time
   - Submit time (if submitted)
   - Violation count badge

2. **Violation Details (Expanded View)**
   - **Timestamp** — exact time of tab switch
   - **Website/Tab** — referrer URL (what student clicked on)
   - **Duration Off Quiz** — minutes between this switch and next (shows how long student was away)
   - **Status** — "Allowed" (on allowed domain) or "Flagged" (unauthorized)
   - **Visual Indicator** — Red for unauthorized, Yellow for allowed domain

3. **Summary Statistics**
   - Total submissions
   - Total violations
   - Students with violations

4. **Real-Time Updates**
   - New violations appear instantly as they're logged
   - Uses Supabase Realtime subscriptions

---

## Testing the Complete Flow

### 🧪 Test 1: Create Quiz with Integrity Monitoring

**Step 1: Professor Dashboard**
1. Go to `/dashboard`
2. You should see "Your Courses" section
3. Create a new course:
   - Title: "Test Integrity"
   - Join Code: (auto-generated)
4. Click "Create Quiz"
5. Fill in:
   - Title: "Integrity Test Quiz"
   - Max Participants: `3`
   - ✓ Check "Enable Integrity Monitor"
   - Allowed websites: `localhost` (or your domain)
6. Click "Create Quiz"

**Step 2: View Quizzes**
1. Click "View Quizzes" button on the course card
2. You should see the quiz you just created
3. Click "View Results" button

**Expected:** Results Dashboard opens (empty, no submissions yet)

---

### 🧪 Test 2: Student Takes Quiz & Switches Tabs

**Step 1: Switch to Student Account (or open private/incognito window)**
1. Sign up/log in as a different user
2. Go to `/dashboard`
3. Join the course using the professor's join code
4. Click "Load Quizzes"
5. Click "Take Quiz" on the integrity test quiz

**Expected:** Quiz page loads

**Step 2: Trigger Tab Switch Detection**
1. In the quiz page, press **F12** to open DevTools
2. Go to **Console** tab
3. Click your browser window, then click another app (e.g., Notepad, browser tab, etc.)
4. Wait 1-2 seconds
5. Click back to the quiz tab

**Check Console Output:**
```
Tab switch detected. Referrer: [URL]
Allowed websites: ['localhost']
Is referrer allowed? true/false
Integrity violation logged successfully
```

**Check UI:**
- "Integrity Status" card should turn RED
- "Tab switches detected: 1"
- Violation list should show the event

---

### 🧪 Test 3: View Results Dashboard (Professor)

**Step 1: Go Back to Professor Account**
1. Log out student, log back in as professor
2. Go to `/dashboard`
3. Click "View Quizzes" on the course
4. Click "View Results" on the quiz

**Expected Results:**

**Submission Card:**
```
Student: student@example.com
Started: Nov 12, 2025, 3:45:00 PM
Status: In Progress

1 violation(s)
▶ Click to expand
```

**Click to Expand:**
```
Integrity Violations (1)

🚨 UNAUTHORIZED TAB  or  ⚠️ ALLOWED DOMAIN (depends on referrer)

TIMESTAMP:
Nov 12, 2025, 3:45:15 PM

WEBSITE/TAB:
https://google.com/search?q=...

DURATION OFF QUIZ:
(shows if there's a next violation)

STATUS:
Flagged  or  Allowed

⚠️ Student accessed unauthorized website during quiz
```

---

### 🧪 Test 4: Multiple Tab Switches

**Repeat Tab Switch Test (Step 2) 3-4 times:**

1. Switch to another tab/window
2. Wait 1-2 minutes
3. Switch back to quiz
4. Repeat 3-4 times

**Expected in Results Dashboard:**

```
Integrity Violations (4)

Violation #1: 3:45:15 PM → Duration: 2 minutes
Violation #2: 3:47:18 PM → Duration: 1 minute
Violation #3: 3:48:22 PM → Duration: 3 minutes
Violation #4: 3:51:30 PM → No duration (latest)
```

---

### 🧪 Test 5: Multiple Students

**Step 1: Create multiple student accounts**
1. Sign up/log in as Student 2
2. Join the same course
3. Click "Take Quiz"
4. Do a few tab switches
5. Sign up/log in as Student 3
6. Join and do the same

**Step 2: View Results**
1. Switch to professor account
2. Click "View Results"
3. You should see:
   ```
   ✓ 3 submissions total
   ✓ 4 violations total (from students)
   ✓ 3 students with violations (if each had some)
   ```

Each student's card is expandable independently.

---

### 🧪 Test 6: Real-Time Updates

**Step 1: Open Results Dashboard (Professor)**
1. Prof opens `/dashboard/results/[quizId]`
2. Leave it open

**Step 2: Student Tab Switch (in another window)**
1. Keep student account in another window
2. Have student switch tabs in quiz
3. Check console: "Integrity violation logged successfully"

**Step 3: Watch Results Dashboard (Professor)**
- Look at the student's card
- **NEW:** The violation count badge should update automatically
- **NEW:** If you expand the violations list, the new violation should appear at the top

(This uses Supabase Realtime subscriptions)

---

## Debugging

### Issue: Violations not appearing in Results Dashboard

**Checklist:**
- [ ] `integrity_logs` table exists in Supabase
- [ ] Tab switch was detected in student's console
- [ ] Supabase insert didn't fail (check browser Network tab)
- [ ] Professor's browser is connected to the course quiz

**Solution:**
1. Check **Supabase → Table Editor → integrity_logs**
2. Look for rows with your submission_id
3. If rows exist but don't show in UI:
   - Refresh the Results page
   - Check browser console for errors (F12 > Console)

### Issue: Referrer always shows as unauthorized

**Checklist:**
- [ ] `allowed_websites` field is set correctly on quiz
- [ ] You entered the domain correctly (e.g., `localhost` not `http://localhost`)
- [ ] Referrer URL is being sent (some browsers block this)

**Debug:**
1. Check the `is_allowed` field in `integrity_logs` table
2. Check the `referrer` field in the same table
3. Make sure your domain/localhost is in the `allowed_websites` comma-separated list

---

## Summary of New Features

| Feature | Location | What It Does |
|---------|----------|-------------|
| **View Quizzes Button** | Professor Dashboard (course card) | Shows all quizzes for a course |
| **Quiz List** | Below "Create Quiz" form | Lists quizzes with quick "View Results" link |
| **Results Dashboard** | `/dashboard/results/[quizId]` | Shows all submissions + violations per student |
| **Expandable Violations** | Results Dashboard | Click student card to see detailed violation list |
| **Real-Time Updates** | Results Dashboard | New violations appear instantly (Realtime) |
| **Duration Calculation** | Violation Detail | Shows minutes between consecutive tab switches |
| **Statistics** | Results Dashboard (bottom) | Total submissions, violations, and affected students |

---

## Next Steps

1. **Test the full workflow** (follow testing section above)
2. **Verify Supabase tables** have the data
3. **Check real-time updates** work
4. **Move on to AI Grading** (optional, for full MVP)

---

## Files Modified/Created

- ✅ `app/dashboard/results/[quizId]/page.tsx` — Results dashboard (NEW)
- ✅ `app/dashboard/page.tsx` — Added quiz list UI to professor dashboard
- ✅ `QUIZ_TABLES_SETUP.sql` — Added integrity_logs table
- ✅ `supabase/migrations/001_create_quizzes_and_submissions_and_rpc.sql` — Updated with integrity_logs

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROFESSOR DASHBOARD                          │
│                   (app/dashboard/page.tsx)                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Your Courses                                            │   │
│  │ ┌──────────────────────────────┐                        │   │
│  │ │ Course: Test Integrity       │                        │   │
│  │ │ Students: 3 | Participants: 2│                        │   │
│  │ │                              │                        │   │
│  │ │ [Delete] [Create Quiz]       │                        │   │
│  │ │ [View Quizzes]    ◄─────────────────────┐            │   │
│  │ └──────────────────────────────┘          │            │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │ Fetches quizzes for course
                          │
         ┌────────────────▼──────────────────────┐
         │   Quiz List (Expanded View)           │
         │  ┌────────────────────────────────┐  │
         │  │ Quiz: Integrity Test Quiz      │  │
         │  │ 🔒 Monitored | Max: 3          │  │
         │  │                                │  │
         │  │ [View Results] ◄──────┐        │  │
         │  └────────────────────────────────┘  │
         └────────────────────────────────────────┘
                          │
                          │ Opens Results Dashboard
                          │
         ┌────────────────▼──────────────────────────────────────┐
         │ RESULTS DASHBOARD (app/dashboard/results/[quizId])   │
         │ ┌────────────────────────────────────────────────────┐ │
         │ │ Test Integrity Quiz                              │ │
         │ │ 3 submissions | Integrity: ✓ Enabled             │ │
         │ └────────────────────────────────────────────────────┘ │
         │ ┌────────────────────────────────────────────────────┐ │
         │ │ alice@example.com                    [1 violation] │ │
         │ │ Started: 3:45 PM | Submitted: 3:52 PM             │ │
         │ │ ▼ Click to expand                                 │ │
         │ └────────────────────────────────────────────────────┘ │
         │   ┌──────────────────────────────────────────────────┐  │
         │   │ 🚨 UNAUTHORIZED TAB #1                          │  │
         │   │                                                  │  │
         │   │ TIMESTAMP: 3:45:15 PM                            │  │
         │   │ WEBSITE: https://google.com/search?q=exam        │  │
         │   │ DURATION: 2 minutes                              │  │
         │   │ STATUS: Flagged                                  │  │
         │   │ ⚠️ Student accessed unauthorized website         │  │
         │   └──────────────────────────────────────────────────┘  │
         │ ┌────────────────────────────────────────────────────┐ │
         │ │ bob@example.com                      [0 violations]│ │
         │ │ Started: 3:45 PM | Submitted: 3:50 PM             │ │
         │ │ ▶ Click to expand                                 │ │
         │ └────────────────────────────────────────────────────┘ │
         │                                                        │
         │ Summary:                                              │
         │ • Total Submissions: 3                                │
         │ • Total Violations: 1                                 │
         │ • Students with Violations: 1                         │
         └────────────────────────────────────────────────────────┘
```

---

**You now have a full integrity monitoring dashboard!** 🎉
