# Tab Switch Detection: Browser Limitations & Solutions

## **The Problem You Discovered**

You noticed that when you switch to Facebook.com or other sites, the system only logs:
```
Referrer: http://localhost:3003/dashboard
```

Instead of:
```
Referrer: https://facebook.com
```

## **Why This Happens: Browser Security**

Modern browsers **intentionally prevent JavaScript** from accessing information about where users navigate outside your app. This is a **privacy and security feature**.

```
┌──────────────────────────────────────────────────────┐
│ User's Browser                                       │
│                                                      │
│ Can Access:                      Cannot Access:      │
│ ✅ Current page (quiz)           ❌ Other open tabs  │
│ ✅ Where they came FROM          ❌ Where they went  │
│ ✅ Tab visibility (hidden)       ❌ User's history   │
│ ✅ Mouse/keyboard events         ❌ Clipboard        │
└──────────────────────────────────────────────────────┘
```

## **What `document.referrer` Actually Does**

```javascript
// When user is on your quiz page:
document.referrer = "http://localhost:3003/dashboard"
// ^ This is the PAGE that navigated TO your site, NOT where they went

// When user switches tabs:
// document.referrer stays the same (it doesn't change)
// It tells us WHERE THEY CAME FROM, not where they switched to
```

### Timeline Example:
```
1. User on Dashboard (localhost:3003/dashboard)
2. User clicks "Take Quiz" → goes to Quiz page
   document.referrer = "localhost:3003/dashboard"

3. User switches to Facebook.com
   visibilitychange fires
   document.referrer = "localhost:3003/dashboard" (unchanged!)
   ❌ We don't know they switched to Facebook

4. User switches back to Quiz
   visibilitychange fires again
   document.referrer = still "localhost:3003/dashboard"
   ❌ Still can't see they visited Facebook
```

## **Current Solution (Implemented)**

Since we can't detect WHERE students switch to, we:

1. **Flag ALL tab switches** as violations (safer approach)
2. **Log the timestamp** of each switch
3. **Record the referrer** (where they came from, not where they went)
4. Display: `"User switched tabs (destination unknown)"`

This is the **most honest and transparent** approach for an MVP.

```javascript
// Current logic (conservative):
const isAllowed = false; // Always flag tab switches
const referrer = 'User switched tabs (destination unknown)';
```

---

## **Advanced Solutions (For Production)**

### ❌ Solution 1: Use Full-Screen Mode (Won't Work)
Some proctoring services use `requestFullscreen()` to prevent tab switching, but this:
- Is easy to bypass
- Frustrates users
- Doesn't work on all devices
- Not compliant with accessibility standards

### ✅ Solution 2: Server-Side Monitoring (More Complex)
Track actual quiz session activity:
- Last keystroke/mouse movement
- Time gaps in activity
- Submission timing patterns
- AI anomaly detection

```
Quiz Session Timeline:
┌─────────────┬──────────┬──────────┬──────────┐
│ Keystroke   │ (5 sec   │ Keystroke│ Gap: 2m  │
│ 3:45:00 PM  │ gap OK)  │ 3:45:10  │ (likely  │
│             │          │          │ tab loss)│
└─────────────┴──────────┴──────────┴──────────┘
```

### ✅ Solution 3: Browser Extension (Most Accurate, Not Recommended)
A browser extension could theoretically track tab switches, but:
- Requires installation
- Privacy concerns
- Easily disabled
- Vendor lock-in

### ✅ Solution 4: Use Allowed Websites List (Current Best Approach)
Even though we can't see WHERE they go, we can:
- Set `allowed_websites = "calculator.com,google.com,wikipedia.org"`
- Assume students need access to certain resources
- Flag everything else as potentially suspicious
- Use AI to analyze patterns (did they just take 20 seconds on a math problem then check calculator? Suspicious)

---

## **How Other Proctoring Systems Handle This**

### **Proctor.com, Respondus LockDown Browser:**
- Install **browser extension** (invasive, detects everything)
- Lock down browser completely (UX nightmare)
- May have legal/privacy issues

### **Honorlock, ProctorU:**
- Use **combination approach**:
  - Monitor browser window focus (what we do)
  - Track eye movement (webcam required)
  - AI analysis of behavior patterns
  - Human proctors in premium tiers

### **Google Forms, Blackboard:**
- Accept that cheating is possible
- Focus on **test design** (harder questions, randomization)
- Use **integrity flags** but don't block
- Let professors use discretion

---

## **ProctorLess Philosophy: Privacy-First**

**We intentionally don't:**
- Track every keystroke
- Force full-screen mode
- Block access to all websites
- Require camera access
- Install browser extensions

**We do:**
- Detect suspicious patterns (tab switches, timing gaps)
- Let professors decide how to interpret data
- Respect student privacy
- Make it easy to explain false positives

---

## **How to Improve Detection (Without Browser Tracking)**

### Option 1: Trust-Based (Current)
```
Tab Switch Detected ⚠️
└─ Student can explain in comments
└─ Professor reviews context
```

### Option 2: Resource-Based
When setting `allowed_websites`, be specific:
```
allowed_websites = "calculator.com, periodic-table.org, textbook-pdf.edu"
```

Even though we can't verify WHERE they went, we can infer:
- "Took 30 seconds then switched tabs" = maybe needed calculator
- "Switched tabs 20 times in 5 minutes" = likely cheating

### Option 3: Behavior Analysis (Advanced)
Analyze **submission patterns**:
```
Analysis.js (pseudo-code):
if (tabSwitches > 5 && answerTime < 30 seconds) {
  flag = "LIKELY_CHEATING" // Too fast with too many switches
}

if (tabSwitches == 0 && answerTime > 2 minutes) {
  flag = "GENUINE_EFFORT" // Stayed focused, took time
}

if (answerTime == 3:45 && tabSwitch.count == 1) {
  flag = "PROBABLY_OK" // One quick search is normal
}
```

---

## **Updated Display Logic**

The Results Dashboard now shows:

```
🚨 Unauthorized Tab
#1
TIMESTAMP: 11/12/2025, 7:21:03 PM
TAB SWITCH DETECTED: User switched tabs (destination unknown)
DURATION: 0 minutes
STATUS: Flagged

ℹ️ Note: We can detect tab switches but cannot determine 
the destination due to browser security. All tab switches 
are flagged.
```

This is **transparent** about the limitation.

---

## **Recommended Approach for Your App**

1. **Keep current implementation** (honest about what we can detect)
2. **Add comment system** to Results Dashboard:
   ```
   "Add note about this student's integrity..."
   Professor can explain: "She needed calculator for stats"
   ```
3. **Add AI analysis** (Phase 2):
   ```
   "Analyze submission patterns to detect cheating"
   Compare against class baseline
   ```
4. **Trust the professor's judgment**:
   ```
   The system flags suspicious activity,
   but professors decide what to do about it.
   ```

---

## **Code Changes Made**

**File:** `app/dashboard/quiz/[id]/page.tsx`
- Updated tab switch handler to log: `"User switched tabs (destination unknown)"`
- Changed logic to flag ALL tab switches (since we can't verify destination)
- Added detailed console logging with emojis for clarity

**File:** `app/dashboard/results/[quizId]/page.tsx`
- Updated label from "WEBSITE/TAB" to "TAB SWITCH DETECTED"
- Added explanatory note about browser security limitations
- Made the display clearer about what we CAN vs CAN'T detect

---

## **Testing Your Updated Implementation**

1. Open quiz page
2. Switch to ANY website (Facebook, Google, etc.)
3. Look at Results Dashboard
4. You'll see:
   ```
   TAB SWITCH DETECTED
   User switched tabs (destination unknown)
   ```
5. Check the note explaining the browser limitation

---

## **Future Improvements (Not in MVP)**

- [ ] Add "Add Note" field for professor to explain flag
- [ ] Implement AI submission pattern analysis
- [ ] Add rubric-based grading (reduces need for cheating detection)
- [ ] Allow students to submit explanation with assignment
- [ ] Build reputation system (students with no flags get trust)

---

## **Key Takeaway**

**This is not a limitation—it's a feature.**

We're being honest about what we can detect instead of pretending to see things we can't. Professors appreciate transparency more than false security.

Real academic integrity comes from:
1. Good test design (hard to cheat on)
2. Clear expectations (students know what's allowed)
3. Trust and conversation (not surveillance)
4. Context awareness (professor knows their students)

ProctorLess focuses on **support and transparency**, not **control**.

