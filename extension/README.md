# ProctorLess Focus Chrome Extension

## Overview

**ProctorLess Focus** is a Manifest V3 Chrome extension that logs the active tab URL and timestamp while a student is taking an exam. This solves the browser security limitation we discovered earlier—the extension can see which websites students actually visit.

### What it does
- ✅ Logs active tab URL + timestamp to your ProctorLess backend
- ✅ Can be armed/disarmed by the student with clear UI
- ✅ Privacy-respecting (no webcam, no page contents, no keystrokes)
- ✅ Real-time monitoring while armed
- ✅ Transparent about what is being collected

### What it doesn't do
- ❌ Read page contents
- ❌ Access webcam or microphone
- ❌ Log keystrokes or form inputs
- ❌ Bypass student consent (they must install and arm it)
- ❌ Work in Incognito unless user explicitly enables it

---

## Installation & Setup

### Step 1: Install the Extension Locally

1. Open Chrome and go to `chrome://extensions/`
2. Toggle **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the `proctorless-extension` folder from this workspace
5. The extension should appear in your extensions list
6. Pin it to your toolbar for easy access

### Step 2: Test Locally

1. Click the ProctorLess Focus icon in your toolbar
2. You should see the popup with:
   - Status: **Disarmed**
   - Button: **Arm Monitoring**
   - Log count: **0**
3. Click **Arm Monitoring**
4. Open different websites in tabs and switch between them
5. The log count should increment in the popup
6. Check your browser console (`F12` → Console) for `[ProctorLess]` debug logs

### Step 3: Configure the Backend URL

In `background.js`, update the `API_BASE_URL`:

```javascript
const API_BASE_URL = 'http://localhost:3000'; // Change to your deployed Vercel URL
```

For production:
```javascript
const API_BASE_URL = 'https://your-app.vercel.app';
```

---

## How It Works

### File Structure

```
proctorless-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html             # Popup UI shown when you click the extension icon
├── popup.js               # Popup logic (arm/disarm, show stats)
├── background.js          # Service worker (monitors tab changes, sends logs)
├── icons/
│   └── icon128.svg        # Extension icon
└── README.md              # This file
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Student's Chrome Browser                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Tab 1: ProctorLess Quiz       │  Tab 2: Facebook    │ │
│  │  (Student takes quiz)          │  (Student switched) │ │
│  └────────────────────────────────────────────────────────┘ │
│           ↓                                  ↓               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ProctorLess Focus Extension (armed = true)              │ │
│  │  ┌─────────────────────┐                                 │ │
│  │  │ popup.js/popup.html │ ← Student sees "Armed ✓"      │ │
│  │  └─────────────────────┘                                 │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │ background.js (Service Worker)                   │   │ │
│  │  │ - Detects tab change to Facebook                 │   │ │
│  │  │ - Sends POST /api/integrity/tab                  │   │ │
│  │  │   { url: "https://facebook.com", ts: ... }      │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
│           ↓ (HTTPS POST request)                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
     ┌──────────────────────────────────────────┐
     │  Your ProctorLess Backend (Next.js)      │
     │  POST /api/integrity/tab                 │
     │  ├─ Authenticate (Bearer token)          │
     │  ├─ Extract user_id from token           │
     │  ├─ Store in DB: integrity_tab_logs      │
     │  └─ Return { ok: true }                  │
     └──────────────────────────────────────────┘
                        ↓
     ┌──────────────────────────────────────────┐
     │  Supabase PostgreSQL Database            │
     │  integrity_tab_logs table                │
     │  - user_id                               │
     │  - url                                   │
     │  - ts_ms (timestamp)                     │
     │  - submission_id                         │
     │  - created_at                            │
     └──────────────────────────────────────────┘
```

### Key Components

#### 1. **popup.js** (UI Controller)
- Shows status: **Armed** (red) or **Disarmed** (green)
- Displays log count (number of URLs logged so far)
- ARM/DISARM button
- Listens to messages from the website to auto-arm/disarm on exam start

#### 2. **background.js** (Service Worker - The Brain)
- `chrome.tabs.onActivated` — Fires when user switches to a different tab
- `chrome.tabs.onUpdated` — Fires when a page finishes loading
- When armed, sends a POST request to `API_ENDPOINT` with the active tab URL
- Increments the popup's log count

#### 3. **manifest.json** (Configuration)
- Declares permissions (`tabs`, `storage`)
- Declares `host_permissions` (which URLs the extension can access)
- Specifies the popup and background service worker

---

## Data Sent to Backend

When the extension is armed and detects a tab change, it sends:

```json
{
  "url": "https://facebook.com",
  "ts": 1699874400000,
  "kind": "ACTIVE_TAB_URL",
  "examToken": "eyJhbGci...",
  "submissionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Fields:
- **url** (string) — The active tab's URL
- **ts** (number) — Millisecond timestamp (Date.now())
- **kind** (string) — Always `"ACTIVE_TAB_URL"` for now (extensible for future events)
- **examToken** (string, optional) — JWT or session code (if provided by your site)
- **submissionId** (string, optional) — Links log to a specific quiz attempt

---

## Backend Integration

### Expected API Endpoint

Your Next.js app needs:

```
POST /api/integrity/tab
Content-Type: application/json
Authorization: Bearer <examToken> (optional)

{
  "url": "https://facebook.com",
  "ts": 1699874400000,
  "kind": "ACTIVE_TAB_URL",
  "examToken": "...",
  "submissionId": "..."
}
```

### Response Expected

```json
{
  "ok": true,
  "id": 12345
}
```

### Database Table (PostgreSQL in Supabase)

```sql
CREATE TABLE integrity_tab_logs (
  id BIGSERIAL PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  url TEXT NOT NULL,
  ts_ms BIGINT NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'ACTIVE_TAB_URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_integrity_tab_logs_submission_id ON integrity_tab_logs(submission_id);
CREATE INDEX idx_integrity_tab_logs_user_id ON integrity_tab_logs(user_id);
```

---

## Auto-Arm via Website

Optionally, when a student starts an exam on your website, you can automatically **arm** the extension without requiring them to click the popup button.

### How It Works:

1. Student clicks "Start Exam" on your ProctorLess website
2. Your Next.js page sends a message to the extension
3. Extension auto-arms and stores the exam token
4. Student starts taking the quiz; URLs are automatically logged

### Website Code (Next.js Client Component):

```typescript
// app/dashboard/quiz/[id]/page.tsx

useEffect(() => {
  // Auto-arm extension when quiz starts
  chrome.runtime.sendMessage(
    {
      action: 'setArmedState',
      armed: true,
      examToken: `Bearer ${submissionId}`, // or your JWT
      submissionId
    },
    (response) => {
      if (response?.success) {
        console.log('✅ Extension armed automatically');
      }
    }
  );
}, [submissionId]);
```

### Important Note:
This requires `externally_connectable` in `manifest.json`, which we've already configured to allow `localhost:3000` and your Vercel domain.

---

## Testing the Extension

### Manual Test (5 minutes)

1. **Load the extension** in Chrome (Developer Mode)
2. **Open your ProctorLess app** at `http://localhost:3000`
3. **Sign in as a student** and navigate to a quiz
4. **Click the ProctorLess Focus extension icon**
   - You should see: `Status: Disarmed` and `Arm Monitoring` button
5. **Click Arm Monitoring**
   - Status changes to: `Armed ✓`
   - Log count: `0`
6. **Open multiple tabs and switch between them:**
   - Tab 1: ProctorLess quiz (localhost:3000)
   - Tab 2: Google (google.com)
   - Tab 3: Stack Overflow (stackoverflow.com)
7. **Watch the log count increment** in the extension popup
8. **Check the backend:**
   - Check your Supabase `integrity_tab_logs` table
   - You should see new rows with the visited URLs

### Expected Console Output (F12 → Console)

```
[ProctorLess] Background service worker loaded
[ProctorLess] Sending log: { url: 'https://google.com', ts: 1699874400000, kind: 'ACTIVE_TAB_URL' }
[ProctorLess] Log sent successfully: { ok: true, id: 12345 }
[ProctorLess] Sending log: { url: 'https://stackoverflow.com', ts: 1699874401000, kind: 'ACTIVE_TAB_URL' }
[ProctorLess] Log sent successfully: { ok: true, id: 12346 }
```

---

## Troubleshooting

### Extension doesn't appear in toolbar
- Go to `chrome://extensions/`
- Toggle **Developer mode** (top-right)
- Verify the folder path is correct
- Click the refresh icon on the extension card

### Popup shows "Disarmed" but logs aren't sending
1. Check console (`F12` → Console) for `[ProctorLess]` error messages
2. Ensure `API_BASE_URL` in `background.js` is correct
3. Make sure your backend is running (`npm run dev` on your Next.js app)
4. Check browser network tab (`F12` → Network → XHR) to see the POST requests

### Getting "Extension messaging error"
- This is normal if the background service worker isn't ready
- The extension is designed to handle this gracefully
- No action needed

### Backend returns 401 Unauthorized
- Your API endpoint is rejecting the Bearer token
- Verify the token format in `background.js`
- Check your Next.js API route authentication logic

### Logs don't appear in Supabase
- Verify your table schema matches the one in this README
- Check that RLS (Row Level Security) policies allow inserts
- Make sure your API endpoint is actually inserting (not just returning 200)

---

## Privacy & Consent

### What Students See
- Clear popup showing: "Only active tab URL logged while Armed"
- Button labeled: "Arm Monitoring"
- They must explicitly click to enable

### What You Log
- Active tab URL
- Timestamp
- Optional: submission_id, exam token

### What You DON'T Log
- Page contents
- Webcam/microphone
- Keystrokes
- Form input values
- Tab history

### Recommendations
- Disclose in your Terms of Service that you use this extension
- Explain in exam instructions: "Click 'Arm' to start monitoring"
- Only enable this for quiz-taking, not browsing after exam ends

---

## Next Steps

1. **Implement the backend API** (`POST /api/integrity/tab`) — see next section
2. **Create the database table** in Supabase
3. **Test end-to-end** (extension → backend → database)
4. **Wire the Results Dashboard** to show extension logs alongside in-page logs
5. **Deploy the extension** to the Chrome Web Store (optional, for production)

---

## Advanced: Deploying to Chrome Web Store

Once you're happy with the extension, you can publish it to the [Chrome Web Store](https://chrome.google.com/webstore/) for your students to install:

1. Create a Google Play developer account ($5)
2. Zip the extension folder (exclude node_modules if any)
3. Upload to Chrome Web Store
4. Provide students with a direct link to install
5. Updates are automatic once published

For now, students can load it manually in Developer Mode, or you can distribute the folder to them.

---

## File Reference

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration and permissions |
| `popup.html` | User interface (what student sees) |
| `popup.js` | Popup logic (arm/disarm, stats) |
| `background.js` | Service worker (monitors tabs, sends logs) |
| `icons/icon128.svg` | Extension icon (replace with your own) |
| `README.md` | This documentation |

---

## Questions?

Refer to the main project documentation:
- `CURRENT_STATUS.md` — Overall system architecture
- `UNDERSTANDING_TAB_DETECTION.md` — How to interpret the logs
- Your Next.js codebase — For API implementation
