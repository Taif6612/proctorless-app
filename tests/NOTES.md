# **NOTES.md \- AI Agent Instructions for ProctorLess**

## **🎯 Project Overview**

You are building **ProctorLess** as a developer who is "somewhere in between" (you know React/Next.js but are learning Supabase). Please:

* Explain Supabase-specific concepts (Auth, RLS, Edge Functions) clearly as we build them.  
* Provide working, high-quality code with clear comments.  
* Balance building fast (for the 1-week sprint) with learning the "why" behind the code.  
* We will be using **GitHub Copilot** as our primary AI assistant.

## **📚 What We're Building**

App: ProctorLess  
Purpose: A privacy-first smart assessment platform for universities. It replaces invasive proctoring with a smart tab-switch monitor, saves professors time with live AI-assisted grading, and demonstrates an adaptive quiz engine.  
Tech Stack:

* **Frontend Framework:** **Next.js 14+ (App Router)**. Why: You know React, and this gives us Server Components, Server Actions, and easy Vercel deployment.  
* **Backend/Database:** **Supabase (BaaS)**. Why: It's an all-in-one free-tier backend. We get a Postgres Database, Auth, Storage (for files), and Edge Functions (for secure AI calls) in one place.  
* Deployment Platform: Vercel. Why: Free, instant, and integrates perfectly with Next.js and GitHub.  
  Learning Goals: You will learn the full Supabase workflow: database setup, Auth (logins/roles), Row Level Security (RLS), Storage (file uploads), and Edge Functions (serverless API calls).

## **🛠 Setup Instructions**

### **Prerequisites Check**

\# Ensure you have Node.js installed  
node \--version \# Should be v18 or higher  
\# Ensure you have the Supabase CLI installed  
supabase \--version

### **Project Initialization**

\# 1\. Start with the official Supabase \+ Next.js template  
\# This completes 80% of Feature 1 (Auth) for us\!  
npx create-next-app \-e with-supabase proctorless-app

\# 2\. Go into your new project folder  
cd proctorless-app

\# 3\. Install the Supabase CLI (if you don't have it)  
npm install supabase \--save-dev

\# 4\. Link your local project to your Supabase project  
\# (Get the \[project-id\] from your Supabase project's URL)  
npx supabase link \--project-ref \[project-id\]  
\# This will ask for your database password

\# 5\. Pull any schema changes from your remote DB (if you made any)  
npx supabase db pull

\# 6\. Run the app  
npm run dev

### **Project Structure**

proctorless-app/  
├── app/  
│   ├── (auth)/             \# Auth routes (login, signup) \- PRE-BUILT\!  
│   ├── (dashboard)/        \# PROTECTED ROUTES (Prof/Student)  
│   │   ├── dashboard/      \# Main dashboard page  
│   │   ├── course/\[id\]/    \# Course details page  
│   │   ├── quiz/           \# Quiz creation / taking pages  
│   │   └── results/\[id\]/   \# Results/Integrity Log page  
│   └── page.tsx            \# Homepage  
├── components/  
│   ├── ui/                 \# Simple components (Button, Input, etc.)  
│   └── Header.tsx          \# Will show Login/Logout  
├── lib/  
│   └── supabase/           \# Supabase client setup \- PRE-BUILT\!  
├── supabase/  
│   └── functions/  
│       └── ai-grader/      \# \<-- Your LIVE AI Grading Edge Function  
│           └── index.ts  
└── .env.local              \# \<-- YOUR SUPABASE & AI API KEYS GO HERE

## **🚀 Implementation Phases (1-Week Sprint)**

### **Phase 1: Foundation & Auth (Day 1-2)**

**Goal:** Get the project running with working, role-based user authentication.

1. **Create Supabase Project**  
   * Go to [supabase.com](https://supabase.com), create a new project.  
   * Find your Project URL and anon key in **Project Settings \> API**.  
   * Paste them into .env.local (this file is created by the starter template).  
2. **Run Starter Template**  
   * Follow the npx create-next-app... command from the Setup section.  
   * Run npm run dev and test it. You should be able to sign up, log out, and log in.  
3. **Set Up user\_roles Table**  
   * Go to the Supabase UI **Table Editor** \> **New Table**.  
   * Create user\_roles:  
     * user\_id (Type: uuid, Foreign Key to auth.users \> id)  
     * role (Type: text, e.g., "professor" or "student")  
4. **Create SQL Trigger for Roles**  
   * Go to **SQL Editor** \> **New query**.  
   * **Copilot Chat Prompt:** "Give me a Supabase SQL trigger function that automatically inserts a new row into my user\_roles table when a new user signs up in auth.users. The default role should be 'student'."  
   * *Test:* Sign up as a new user. Go to your user\_roles table and see the new row.  
   * *Manual Step:* Manually change *your own* user role to "professor" in the table so you can test professor features.

### **Phase 2: Core Features (Day 3-6)**

**Goal:** Build the 7 core features from the PRD.

#### **Feature 2: Course Management (Classrooms)**

**Learning Focus:** Supabase DB tables and Next.js Server Actions.

1. **Create Tables:** In Supabase, create the courses and enrollments tables (schema in Tech Design).  
2. **Create UI:** Build app/(dashboard)/dashboard/page.tsx.  
   * **Copilot Chat Prompt:** "I'm in a Next.js Server Component. How do I get the current logged-in user's ID from Supabase? Then, how do I query my user\_roles table to get their 'role'?"  
   * Use the role to conditionally show a "Create Course" form (for professors) or a "Join Course" form (for students).  
3. **Implement Server Actions:**  
   * **Copilot Chat Prompt:** "Write a Next.js Server Action named createCourse. It should take formData, generate a 6-character random string for join\_code, get the current user's ID, and insert it all into my Supabase courses table."  
   * **Copilot Chat Prompt:** "Write a Next.js Server Action named joinCourse. It should take a join\_code. It needs to find the course\_id for that code, get the current user's ID, and insert them into my enrollments table."

#### **Feature 3 & 4: Quiz Creator & Engine (Placeholder)**

**Learning Focus:** Supabase Storage (File Uploads) and JSON handling.

1. **Create Table:** In Supabase, create the quizzes table.  
2. **Enable Storage:** Go to **Storage** in Supabase and create a new **Bucket** named question\_banks. Make it public (for now, for simplicity).  
3. **Create UI:** Build app/(dashboard)/course/\[id\]/page.tsx.  
   * This page should show course details and a "Create Quiz" form.  
   * The form needs: title (text), integrity\_monitor\_enabled (checkbox), ai\_grading\_enabled (checkbox), allowed\_websites (text, comma-separated), and question\_bank\_file (file input).  
4. **Implement Server Action:**  
   * **Copilot Chat Prompt:** "Write a Next.js Server Action for my 'Create Quiz' form. It needs to:  
     1. Take the formData.  
     2. Upload the question\_bank\_file to my Supabase Storage bucket 'question\_banks'.  
     3. Get the public path of the uploaded file.  
     4. Insert all the quiz data, including the question\_bank\_path, into my Supabase quizzes table."

#### **Feature 5: Integrity Monitor (The "Special Sauce")**

**Learning Focus:** useEffect hooks and client-side event listeners.

1. **Create UI:** Build app/(dashboard)/quiz/\[id\]/page.tsx. This must be a **Client Component** ('use client').  
2. **Implement Logic:**  
   * **Copilot Chat Prompt:** "I'm building a React quiz component. I need a useEffect hook that does the following:  
     1. When the component mounts, it should call a Server Action startQuiz which creates a submission record in Supabase and returns the new submission\_id.  
     2. It needs to add a visibilitychange event listener.  
     3. When document.hidden becomes true, it must call a Server Action named logTabSwitch and pass it the submission\_id and the document.referrer.  
     4. The logTabSwitch action must check if the document.referrer is in the 'allowed\_websites' list for the quiz. If it's NOT, it should insert a row into my integrity\_logs table."

#### **Feature 6 & 7: AI Grading & Results Dashboard**

**Learning Focus:** Supabase Edge Functions (Secure Serverless API Calls).

1. **Create UI:** Build app/(dashboard)/results/\[id\]/page.tsx.  
2. **Fetch Data:**  
   * **Copilot Chat Prompt:** "I'm a 'professor' on a Next.js Server Component. How do I write a Supabase query to get all submissions for a quiz? For each submission, I also need to get all the related integrity\_logs."  
   * Render this data in a table. Show the student's answers and a list of their integrity log events.  
3. **Implement AI Grading (Live API):**  
   * **Step 1:** In your terminal, create the Edge Function: npx supabase functions new ai-grader.  
   * **Step 2:** Securely store your API key: npx supabase secrets set GEMINI\_API\_KEY YOUR\_API\_KEY\_HERE.  
   * **Step 3:** Open supabase/functions/ai-grader/index.ts.  
   * **Copilot Chat Prompt:** "Write the code for a Supabase Edge Function in TypeScript. It must:  
     1. Get the GEMINI\_API\_KEY from the environment.  
     2. Receive a POST request with studentAnswer and correctAnswer.  
     3. Send a fetch request to the Google Gemini API (gemini-2.5-flash-preview-09-2025).  
     4. The prompt must be: 'You are an AI TA. Compare this student answer: \[studentAnswer\] to the correct answer: \[correctAnswer\]. Return a JSON object: {"score": number, "feedback": string}.'  
     5. Return the JSON from the Gemini API."  
   * **Step 4:** In your React component (Client Component), add the button.  
   * **Copilot Chat Prompt:** "How do I use the Supabase client to invoke my 'ai-grader' Edge Function when I click a button? I need to pass it studentAnswer and correctAnswer and then store the returned score and feedback in React state."

### **Phase 3: Polish & Deploy (Day 7\)**

**Goal:** Clean up the UI and get it live on the web.

1. **Style & Responsiveness:**  
   * Use Tailwind CSS classes to apply your "minimal and academic" theme.  
   * Focus on the desktop layout first, as per your PRD.  
2. **Deploy to Vercel:**  
   * Create a new GitHub repository and push your code.  
   * Go to [vercel.com](https://vercel.com), import your Git repository.  
   * Vercel will auto-detect Next.js.  
   * **CRITICAL:** Go to **Project Settings \> Environment Variables** on Vercel. Add all your keys from .env.local:  
     * NEXT\_PUBLIC\_SUPABASE\_URL  
     * NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY  
     * GEMINI\_API\_KEY (This is so your deployed Supabase function can access it)  
   * Click "Deploy." Your prototype will be live.

## **📜 Modification History**

- 2025-11-19 12:00 UTC — Removed all references to external test tooling from project documentation in `doc/` and ensured scope alignment to in-repo QA plans.
- 2025-11-19 12:05 UTC — Scheduled comprehensive UI improvements for dashboards and admin page due by 2025-12-08.
- 2025-11-19 12:20 UTC — Wired AI grading UI on Results page to the Supabase Edge Function; prefilled per-question score and feedback, saving via existing storage flow.
 - 2025-11-19 12:35 UTC — Restored Upload & Parse (Gemini) on Edit Quiz page; allows image/PDF upload to Storage and merges parsed questions with manual editor.

## **🧭 UI Improvement Plan (Due 2025-12-08)**

- Navigation and layout: intuitive menus, optimized component placement, responsive across device sizes.
- Role-specific features: professor course/quiz management; student enrollments and quiz actions; contextual action panels.
- Data visualization: summary cards for counts; per-course metrics; violation indicators.
- Visual design: consistent theming, improved hierarchy/readability, optimized interactive elements.
- Admin page: core operations (role management), validation and error handling, clear workflows and feedback.

## **📌 Status & Remaining Tasks**

- Completed: Auth, roles, course management, quiz creation, integrity monitor, results dashboard, OCR/Gemini extract, Edge Function scaffolding.
- Pending: Wire AI grading UI to Edge Function; finalize RLS policies; deploy to Vercel; dashboard UI enhancements; admin validation workflows.

## **🔗 Related Implementation Tickets**

- .trae/documents/Implement Question Bank Upload and Quiz Engine.md
- .trae/documents/Fix Professor Dashboard JSX Build Error.md
- .trae/documents/Restart Next.js Dev Server on Port 3003.md

## **💡 Learning Resources**

### **For Supabase:**

* **Quick Start:** [Supabase \+ Next.js App Router Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)  
* **Deep Dive:** [Supabase Crash Course (YouTube)](https://www.google.com/search?q=https://www.youtube.com/watch?v%3DsOn-f7iR_Jk)  
* **Key Concept:** [Supabase Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)

### **For Next.js & Tailwind:**

* **Quick Start:** [Next.js App Router Docs](https://nextjs.org/docs/app)  
* **Key Concept:** [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)  
* **Styling:** [Tailwind CSS Docs](https://tailwindcss.com/docs)

## **🐛 Common Issues & Solutions**

### **"Supabase query returns no data or 'RLS policy violation'"**

Why it happens: Row Level Security (RLS) is enabled by default on new tables. It blocks all requests unless you write a policy.  
Fix:

* For testing, you can disable it (not recommended).  
* **The Right Fix:** Use Copilot to write policies. **Copilot Chat Prompt:** "Write a Supabase RLS policy for my courses table that allows a user to SELECT a course *only if* their user\_id matches the professor\_id OR if they are enrolled in the enrollments table."

### **"My useEffect hook is running twice"**

Why it happens: In development mode (npm run dev), React 18+ runs effects twice to check for bugs.  
Fix: This is normal and will not happen in your deployed (production) app. Don't worry about it.

### **"My Edge Function gives a 500 error on Vercel"**

Why it happens: You probably forgot to add your GEMINI\_API\_KEY to Vercel's environment variables.  
Fix: Go to your Vercel project settings and add the secret.

## **🧪 Testing Your Features (Manual Checklist)**

* \[ \] **Auth:** Can you sign up as a new "student"? Can you log out and log back in?  
* \[ \] **Roles:** Does the 'professor' user see the "Create Course" form? Does the 'student' user see the "Join Course" form?  
* \[ \] **Courses:** Can a professor create a course? Can a student use the join code to join it?  
* \[ \] **Quiz Creation:** Can a professor create a quiz and upload a .json question bank? Check Supabase Storage to see the file.  
* \[ \] **Integrity Monitor:** Start a quiz. Switch tabs. Go back. Check the integrity\_logs table in Supabase. Is there a new row?  
* \[ \] **Live AI Grading:** Click the "Grade with AI" button. Does it show a loading state, then return a *real* score and feedback?

## **🎯 Definition of Done**

Your MVP is complete when:

* \[ \] All 7 PRD features are functional.  
* \[ \] **User Auth & Roles** (Working)  
* \[ \] **Course Management** (Working)  
* \[ \] **Quiz Creator** (Working, with file upload)  
* \[ \] **Quiz Engine** (Working, placeholder logic)  
* \[ \] **Integrity Monitor** (Working, logs to DB)  
* \[ \] **AI-Assisted Grading** (Working, **live API call**)  
* \[ \] **Results Dashboard** (Working, shows grades & logs)  
* \[ \] The app is deployed to a live Vercel URL.  
* \[ \] You can demo the *full* professor and student journeys.

## **📁 Reference Documents**

* **Requirements:** PRD-ProctorLess-MVP.md  
* **Technical Plan:** TechDesign-ProctorLess-MVP.md

## **💬 Final Notes for GitHub Copilot**

* This is a 1-week sprint. We must be fast.  
* **Use Copilot Chat constantly.** Don't write boilerplate.  
* **Good Chat Prompt:** "Read the schema in NOTES.md. Now, write the code for my app/(dashboard)/dashboard/page.tsx component to fetch and display the user's courses."  
* **Bad Chat Prompt:** "make a page"  
* Trust the plan. Follow the 7-day phases. The goal is a *working demo*, not perfect, refactored code.

Start with Phase 1 and good luck\!