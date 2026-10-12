Technical Design Document: ProctorLess MVP
1. Overview
This document defines the HOW for building the "ProctorLess" MVP. It is based on the PRD-ProctorLess-MVP.md document.
Product: ProctorLess (Privacy-First Smart Assessment Platform)
Goal: High-fidelity prototype in 1 week.
Skill Level: "In-Between" (React/Next.js skills, but new to Supabase & Auth).
Budget: $0 (with pre-paid access to AI APIs).
2. Recommended Approach & Tech Stack
The PRD specifies a "Pro-Code" path. This is the optimal stack to balance speed, power, and your $0 budget.
Frontend: Next.js 14+ (App Router)
Why: You already know React. This is the industry standard, and Vercel hosting is free and instant.
Backend (BaaS): Supabase
Why: It's an all-in-one solution with a generous free tier that provides exactly what you need:
Database (Postgres)
Auth (User logins/roles)
Storage (For question bank file uploads)
Edge Functions (For the AI-Grading API call)
Deployment: Vercel
Why: Connects directly to GitHub. git push = deployed. The free tier is perfect.
UI / Styling: Tailwind CSS
Why: Fastest way to build a "minimal and academic" UI directly in your React components.
AI Assistance: Claude 3.5 Sonnet / Gemini 1.5 Pro
Why: Essential for meeting the 1-week deadline. You will use AI to generate boilerplate for Supabase logic, RLS policies, and React components.
3. Project Structure (Next.js App Router)
You will use the official Supabase Next.js starter. This gives you User Authentication (Feature 1) for free.
# 1. Start with the official Supabase + Next.js template
npx create-next-app -e with-supabase proctorless-app

# 2. cd into the project
cd proctorless-app

# 3. Your folder structure will look like this:
proctorless-app/
├── app/
│   ├── (auth)/             # Auth routes (login, signup) - PRE-BUILT!
│   ├── (dashboard)/        # PROTECTED ROUTES (Prof/Student)
│   │   ├── dashboard/      # Main dashboard page
│   │   ├── course/[id]/    # Course details page
│   │   ├── quiz/           # Quiz creation / taking pages
│   │   └── results/[id]/   # Results/Integrity Log page
│   └── page.tsx            # Homepage
├── components/
│   ├── ui/                 # Simple components (Button, Input, etc.)
│   └── Header.tsx          # Will show Login/Logout
├── lib/
│   └── supabase/           # Supabase client setup - PRE-BUILT!
├── supabase/
│   └── functions/
│       └── ai-grader/      # <-- Your **LIVE** AI Grading Edge Function
│           └── index.ts
└── .env.local              # <-- YOUR SUPABASE & AI API KEYS GO HERE


4. Database Schema (Supabase Postgres)
This is the most important part. You will create these tables in the Supabase UI.
user_roles (To handle "Professor" vs "Student")
user_id (uuid, foreign key to auth.users.id)
role (text, e.g., "professor" or "student")
courses
id (uuid, primary key)
professor_id (uuid, foreign key to auth.users.id)
name (text, e.g., "CSE309")
join_code (text, unique 6-char code)
enrollments (Links students to courses)
course_id (uuid, foreign key to courses.id)
student_id (uuid, foreign key to auth.users.id)
quizzes
id (uuid, primary key)
course_id (uuid, foreign key to courses.id)
title (text)
integrity_monitor_enabled (boolean)
ai_grading_enabled (boolean)
allowed_websites (text[], an array of strings)
question_bank_path (text, path to the file in Supabase Storage)
submissions
id (uuid, primary key)
quiz_id (uuid, foreign key to quizzes.id)
student_id (uuid, foreign key to auth.users.id)
answers (jsonb, e.g., {"q1": "A", "q2": "Essay text..."})
score (integer, can be null)
integrity_logs
id (bigint, primary key)
submission_id (uuid, foreign key to submissions.id)
student_id (uuid, foreign key to auth.users.id)
timestamp (timestamptz, now())
event_type (text, e.g., "tab_switch_violation")
5. Building Each MVP Feature (1-Week Plan)
Day 1-2: Setup & Authentication (Feature 1)
Create Supabase Project:
Go to supabase.com, create a new project.
Copy the Project URL and anon key into your .env.local file.
Run the Starter Template:
Run npx create-next-app -e with-supabase proctorless-app.
Run npm install.
Run npm run dev.
You will have a working app with Login, Signup, and a protected "account" page. Feature 1 is 80% done.
Add User Roles:
In Supabase, create the user_roles table (see schema).
AI PROMPT: "Using Supabase, how do I create a trigger that inserts a new row into my user_roles table every time a new user signs up in auth.users? The role should be 'student' by default."
This will automatically assign roles. You'll need to manually change your own role to "professor" in the Supabase UI for testing.
Day 3: Courses & Enrollment (Feature 2)
Create Tables: In the Supabase UI, create the courses and enrollments tables.
Professor UI:
Create a new page app/(dashboard)/dashboard/page.tsx.
AI PROMPT: "Create a React Server Component for Next.js that checks a user's role from my 'user_roles' table in Supabase. If the role is 'professor', show a 'Create Course' form. If the role is 'student', show a 'Join Course' form."
Professor Logic:
AI PROMPT: "Write a Next.js Server Action that takes form data, generates a 6-character random string, and inserts a new row into my courses table in Supabase. The professor_id should be the currently logged-in user's ID."
Student Logic:
AI PROMPT: "Write a Next.js Server Action that takes a 'join_code'. It must find the course_id from the courses table with that code, then insert a new row into the enrollments table with the course_id and the current user's ID."
Day 4: Quiz Creation (Feature 3 & 4 Placeholder)
Create Tables: In Supabase UI, create the quizzes table.
Create UI: Create a page app/(dashboard)/course/[id]/page.tsx.
This page will show course details and a "Create Quiz" button.
Create a form for the new quiz (title, 3 checkboxes, allowed websites).
AI PROMPT: "How do I use the Supabase Storage upload function in a Next.js Server Action to upload a JSON file? It should return the file path."
Create Logic:
The form submission will call a Server Action.
This action will first upload the file (getting the path), then create a new row in the quizzes table with all the form data and the question_bank_path.
Day 5: Quiz Engine & Integrity Monitor (Feature 4 & 5)
Create UI: Create page app/(dashboard)/quiz/[id]/page.tsx.
Quiz Logic:
AI PROMPT: "In a Next.js Client Component, how do I fetch a JSON file from a Supabase Storage path, parse it, and show one question at a time in React state?"
Integrity Monitor (THE "SPECIAL SAUCE"):
This is a Client Component.
AI PROMPT: "I need a React component for my quiz. It needs to:
Create a submission record in Supabase when the quiz starts, and store the submission.id in state.
Use a useEffect hook to add a visibilitychange event listener.
When document.hidden is true, it must check the new document.referrer against a list of 'allowedWebsites' (passed as a prop).
If the new site is NOT allowed, it must call a Supabase RPC function (or a Server Action) named log_integrity_violation and pass it the submission.id."
This is your most complex feature. This prompt is your key.
Day 6: AI Grading & Results (Feature 6 & 7)
Create UI: Create page app/(dashboard)/results/[id]/page.tsx.
Results Dashboard:
AI PROMPT: "I am a 'professor'. How do I fetch all submissions for my quiz, along with the student's email? For each submission, I also need to fetch all rows from integrity_logs that match the submission.id."
AI Grading (LIVE API CALL):
This is now a live feature.
Step 1: Create a Supabase Edge Function.
supabase functions new ai-grader
Step 2: Securely store your API key.
supabase secrets set GEMINI_API_KEY YOUR_API_KEY_HERE
Step 3: Write the function code.
AI PROMPT: "Write a Supabase Edge Function in TypeScript. It needs to:
Receive a POST request with studentAnswer and correctAnswer.
Get the GEMINI_API_KEY from the environment secrets.
Send a request to the Google Gemini API (gemini-2.5-flash-preview-09-2025).
The prompt should be: 'You are an AI teaching assistant. Compare this student's answer:$$studentAnswer$$
to the professor's correct answer:$$correctAnswer$$
. Return a JSON object with two keys: score (a number 0-100) and feedback (a short explanation).'
Return the JSON response from the Gemini API."
Step 4: Call the function from your React UI.
AI PROMPT: "In my React component, how do I use the Supabase client to invoke my 'ai-grader' Edge Function when a button is clicked? Show me how to display the returned score and feedback in state."
Day 7: Polish & Deploy
Styling: Use Tailwind CSS to apply your "minimal and academic" theme.
Deploy:
Create a new GitHub repository and push your code.
Go to vercel.com and log in with GitHub.
Click "Import Project" and select your repository.
Vercel will ask for your Environment Variables. Copy/paste them from your .env.local file.
CRITICAL: You must also add your GEMINI_API_KEY to Vercel's environment variables so your Supabase function (when deployed) can access it.
Click "Deploy." Your project will be live in 2 minutes.
6. Risk Mitigation
RISK: "I've never used Supabase Auth/RLS."
MITIGATION: Use the starter template. It handles 80% of auth for you. For Row Level Security (RLS), use AI. AI PROMPT: "Write Supabase RLS policies for my courses table so that only the 'professor' who created the course can see it, and only 'students' who are enrolled can see it."
RISK: "Implementing a secure server-side API call to Gemini is technically complex."
MITIGATION: Use a Supabase Edge Function. This is the correct, secure pattern. It keeps your paid API key 100% secure on the server. Follow the AI PROMPT from Day 6 exactly to generate the function code.
RISK: "The 1-week timeline."
MITIGATION: Be ruthless. Stick to this plan. Do not add any new features. Use AI to write your boilerplate. A "working" prototype is better than a "perfect" half-finished one.
