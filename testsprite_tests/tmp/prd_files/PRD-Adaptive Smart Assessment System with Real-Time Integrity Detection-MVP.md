Product Requirements Document: ProctorLess MVP
Overview
Product Name: ProctorLess
Problem Statement: University professors need to ensure exam integrity without using invasive, high-stress proctoring tools. They also spend too much time on manual grading, while students suffer from anxiety and false accusations from current "spyware" tools.
MVP Goal: Create a high-fidelity, functional prototype in 1 week to demonstrate the full vision of a privacy-first, all-in-one smart assessment system for a university project.
Target Launch: 1 Week (University Project Deadline)
Target Users
Primary User Profile (The "Customer")
Who: "Professor Smith" — A university professor (moderately tech-savvy) who teaches multiple courses and is frustrated by the current state of online assessment.
Problem: Hates managing clunky, invasive proctoring tools and the "police" role it forces them into. Spends too many hours manually grading.
Current Solution: A patchwork of tools: a clunky LMS (like Canvas), an invasive add-on (like Respondus or ProctorU), and manual grading.
Why They'll Switch: ProctorLess combines integrity, grading, and adaptive quizzes into one clean, privacy-first platform that respects students and saves the professor time.
Secondary User Profile (The "End-User")
Who: "Alex the Student" — A university student who feels stressed and unfairly monitored by current proctoring software.
Problem: Worries that normal behavior (like looking away to think) will be flagged as cheating, leading to unfair accusations.
User Journey
1. The Professor's Flow
Login/Setup: Prof. Smith logs in, sees her main Dashboard.
Course: She selects a course (e.g., "CSE309") or creates a new one.
Quiz Creation: She clicks "Create New Quiz" and fills out a simple form:
[Checkbox] Enable Integrity Monitor: Enables the tab-switch log.
[Text Box] Allowed Websites (Optional): Lists URLs students are allowed to visit (your "open book" idea).
[Checkbox] Enable AI-Assisted Grading: Enables the AI grading button on the results page.
[File Upload] Upload Question Bank: (V1 Placeholder) She uploads a simple list of questions (e.g., a .csv or .json file) for the quiz.
Launch: The quiz is created and a unique "Join Code" is generated.
Review: After students finish, she goes to the Results Dashboard to see grades and the Integrity Log for each student.
2. The Student's Flow
Login/Join: Alex logs in, sees their dashboard.
Join Course: Alex clicks "Join Course" and enters the "Join Code" from Prof. Smith.
Take Quiz: Alex opens the quiz, sees the rules (e.g., "Tab-switching will be logged," "cnn.com is allowed"), and completes the questions.
Submit: Alex submits the quiz and sees a confirmation page.
MVP Features
Core Features (Must Have for 1-Week Prototype) ✅
1. User Auth & Roles
Description: Users can sign up and log in as either a "Professor" or "Student."
User Value: Differentiates permissions. Professors create, students take.
Success Criteria:
Users can sign up with an email and password.
Users are assigned a "Professor" or "Student" role.
Professors see the creator dashboard; Students see the quiz-taker dashboard.
Priority: Critical
2. Course Management (Classrooms)
Description: Professors can create a "Course" (e.g., "CSE309") which generates a unique "Join Code." Students can use this code to join the course.
User Value: Organizes quizzes and students, just like Google Classroom.
Success Criteria:
Professor can create a course and see a join code.
Student can enter a code on their dashboard to join the course.
Priority: Critical
3. Quiz Creator & Configuration
Description: A form where a professor can create a quiz and configure the 3 main features.
User Value: This is the professor's main control panel.
Success Criteria:
Professor can set a quiz title.
Professor can upload a simple question bank file (e.g., .json).
Form includes checkboxes for "Integrity Monitor" and "AI Grading."
Form includes a text field for "Allowed Websites."
Priority: High
4. Quiz Engine (Placeholder for Adaptive)
Description: The "Take Quiz" page for the student. For the 1-week prototype, this will not be truly adaptive.
User Value: Demonstrates the concept of the adaptive quiz.
User Story: "As a student, I want to take the quiz."
Success Criteria:
The page loads questions (e.g., 5-10) randomized from the professor's uploaded question bank.
Student can answer (multiple choice, short essay) and submit.
This will be demoed as "V1 of our adaptive engine."
Priority: High
5. Integrity Monitor (Privacy-First)
Description: The core "special sauce." Detects tab-switches without a webcam.
User Value: Gives professors peace of mind without invading student privacy.
Success Criteria:
Uses a JavaScript visibilitychange listener.
If a student switches tabs, a new row is created in the IntegrityLog table in the database (linking the student, quiz, and timestamp).
Ignores switches to URLs listed in the "Allowed Websites" field.
Priority: Critical
6. AI-Assisted Grading (LIVE PROTOTYPE)
Description: A button on the Results page for the professor to get a real AI suggestion for an essay question.
User Value: Saves professors hours of grading time.
Success Criteria:
Professor sees a student's essay answer.
A "Grade with AI" button is visible.
Clicking the button calls a Supabase Edge Function, which sends the essay and answer key to the live AI API (Gemini or OpenAI).
The AI's real suggested grade and feedback are displayed.
Professor can manually override the grade.
Priority: High (High Risk)
7. Results & Integrity Log Dashboard
Description: A page for the professor to see quiz results.
User Value: The "payoff" where the professor gets all the information.
Success Criteria:
Professor can see a list of student submissions and their grades.
Professor can click a student's name to see their "Integrity Log" (e.g., "Switched tabs 3 times").
Priority: Critical
Future Features (Not in 1-Week MVP) ⏳
Feature
Why Wait
Planned For
True AI Adaptive Engine
Extremely complex AI/ML. Placeholder is enough for demo.
Version 2
AI Question Generation
Reading lecture slides is a massive AI task.
Version 2
Advanced Integrity
Copy/paste detection, multiple monitors, etc.
Version 1.1
Automated AI Grading
Grading happens automatically on submit (no button).
Version 1.1

Success Metrics
Primary Metrics (for Project Demo)
End-to-End Demo: Successfully demonstrate the full user loop live:
Professor creates a quiz with all 3 features enabled.
Student joins and takes the quiz (and switches tabs).
Professor reviews the results, clicks the live "AI-Grade" button, and sees the Integrity Log.
Functionality: All 7 "Must Have" features are functional on a desktop browser.
UI/UX Direction
Design Feel: Minimal and academic. Clean, professional, and trustworthy. Use a simple color palette (e.g., blues, greys, white) and clear, legible typography.
Inspiration: Google Classroom, Canvas (but cleaner), modern documentation sites.
Key Screens
Login / Sign Up (with role selection)
Main Dashboard (Professor: list of courses; Student: list of joined courses)
Course Page (Professor: "Create Quiz" button, list of quizzes; Student: "Take Quiz" button)
Create Quiz Page (The main form for professors)
Take Quiz Page (The student-facing quiz)
Results Dashboard (Professor's view of grades and logs)
User Profile Page (Simple: change name/password)
Settings Page (Simple: account settings)
Technical Considerations
Platform: Web (Desktop-first)
Frontend: Next.js / React
Backend: Supabase
Database: Supabase Postgres (for users, courses, quizzes, questions, submissions, integrity logs)
Auth: Supabase Auth (for managing users, roles, and logins)
Storage: Supabase Storage (for professor's question bank file uploads)
Serverless: Supabase Edge Functions (to securely call the AI API for grading)
Constraints & Requirements
Budget: $0 (Except for pre-paid AI APIs)
AI Grading (Feature 6): This will be implemented using the developer's existing paid access to Gemini or ChatGPT APIs.
Risk: The primary risk is no longer budget, but the technical complexity of securely implementing the server-side API call within 1 week.
Mitigation: Use Supabase Edge Functions to house the API key, preventing it from being exposed on the frontend. Rely on AI assistance to generate the Edge Function code.
Timeline: 1 Week
This is extremely ambitious for a pro-code (Next.js/Supabase) build.
Mitigation: You must rely heavily on AI coding assistants (Claude, Gemini) to generate boilerplate for you. Focus 80% of your time on the 7 critical features and 20% on making it look "minimal and academic." Do not get stuck on pixel-perfect design.
MVP Completion Checklist
Development Complete
[ ] All 7 core features are functional.
[ ] User can log in as Professor and Student.
[ ] The visibilitychange script logs to the Supabase database.
[ ] The "AI Grading" button successfully calls a live AI API via a Supabase Edge Function and returns a real grade.
Launch Ready (for Demo)
[ ] Deployed to a free host (like Vercel).
[ ] The end-to-end demo loop has been tested 5 times and works.
[ ] No critical, demo-breaking bugs.
Created: November 10, 2025
Status: Ready for Technical Design
