![][image1]  
**Adaptive Smart Assessment System (ProctorLess) — Software Requirements Specification (SRS)** 

Final Version  
**Course Title: Web Application and Internet**  
**Course ID: CSE309**  
**Section: 01**  
**Semester: Autumn 2025**  
**Submitted To: Md. Abu Sayed**

**Submitted By:**

| Name | ID |
| :---: | :---: |
| **Taif ur rahman** | **2221456** |

**Submission Date: December 13, 2025**  

## Table of Contents
- [SRS Approval Letter](#srs-approval-letter)
- [1. Introduction](#1-introduction)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Scope of Work (Project Overview)](#12-scope-of-work-project-overview)
  - [1.3 Intended Audience](#13-intended-audience)
  - [1.4 Definitions, Acronyms, and Abbreviations](#14-definitions-acronyms-and-abbreviations)
- [2. General Description](#2-general-description)
  - [2.1 Product Perspective and System Architecture](#21-product-perspective-and-system-architecture)
  - [2.2 User Characteristics](#22-user-characteristics)
  - [2.3 Data Collection and Framework](#23-data-collection-and-framework)
  - [2.4 Survey and Requirements Validation](#24-survey-and-requirements-validation)
- [3. Functional Requirements](#3-functional-requirements)
  - [3.1 Authentication and Roles](#31-authentication-and-roles)
  - [3.2 Course Management](#32-course-management)
  - [3.3 Quiz Management](#33-quiz-management)
  - [3.4 Student Quiz Engine](#34-student-quiz-engine)
  - [3.5 Integrity Monitoring](#35-integrity-monitoring)
  - [3.6 Results and Grading](#36-results-and-grading)
  - [3.7 Administration](#37-administration)
  - [3.8 API Integration](#38-api-integration)
  - [3.9 Browser Extension](#39-browser-extension)
- [4. Interface Requirements](#4-interface-requirements)
  - [4.1 User Interface (HCI Layer)](#41-user-interface-hci-layer)
  - [4.2 Software Interfaces](#42-software-interfaces)
  - [4.3 Hardware Interfaces](#43-hardware-interfaces)
- [5. Non-Functional Attributes](#5-non-functional-attributes)
  - [5.1 Security](#51-security)
  - [5.2 Usability and Maintainability](#52-usability-and-maintainability)
  - [5.3 Reliability and Data Management](#53-reliability-and-data-management)
  - [5.4 Performance Requirements](#54-performance-requirements)
  - [5.5 Scalability](#55-scalability)
  - [5.6 Compliance and Privacy](#56-compliance-and-privacy)
- [6. Risk Management](#6-risk-management)
  - [6.1 Purpose and Scope](#61-purpose-and-scope)
  - [6.2 Major Identified Risk Factors](#62-major-identified-risk-factors)
- [7. Change Management Process](#7-change-management-process)
  - [7.1 Goal and Responsibility](#71-goal-and-responsibility)
  - [7.2 Change Management Process Steps](#72-change-management-process-steps)
  - [7.3 Documentation and Control](#73-documentation-and-control)
- [8. Preliminary Schedule and Budget](#8-preliminary-schedule-and-budget)
- [9. Acceptance Criteria](#9-acceptance-criteria)
- [Appendices](#appendices)
  - [A. Glossary of Terms](#a-glossary-of-terms)
  - [B. Document Revision History](#b-document-revision-history)
  - [C. Change Log](#c-change-log)
  - [D. References](#d-references)

---

## SRS Approval Letter
I ……………………..…. understand that this SRS contains all the Software Requirements precisely documented for understanding how the Adaptive Smart Assessment System (ProctorLess) will operate in the real world. I also understand that by approving this SRS, I will not be able to add further requirements. I hereby provide authorization to proceed with the design and development phase.  
Name:  
Designation:  
Signature:  
Date:  

---

## 1. Introduction
The Introduction section sets the stage by defining the document's purpose, scope, audience, and key terms.

### 1.1 Purpose
The primary purpose of this SRS is to describe what ProctorLess will do and how it is expected to perform. It aims to gain agreement with stakeholders regarding system requirements and functionality.  
The system is developed to provide privacy-first integrity monitoring and a robust assessment workflow, removing invasive proctoring while enabling professors to run quizzes, capture integrity events, and leverage AI-assisted grading.

### 1.2 Scope of Work (Project Overview)
Build a web application that enables:
- Professors to create courses and quizzes with integrity monitoring and optional AI-assisted grading
- Students to join courses and take quizzes with autosave, timers, and clear rules
- Admins to manage roles, users, and system resources via a tabbed dashboard  
Key capabilities: role-based dashboards, integrity logs (tab-switch monitoring with allowed website exclusions), OCR/Gemini for parsing question banks, quiz variation generation, and AI-assisted grading via Supabase Edge Functions.

### 1.3 Intended Audience
Development team, project managers, QA engineers, testers, supporting staff, supervisors, and stakeholders. This document is organized in order of increasing specificity and is binding for implementation and testing.

### 1.4 Definitions, Acronyms, and Abbreviations
- SRS: Software Requirements Specification  
- HCI: Human-Computer Interaction  
- RLS: Row Level Security  
- AI: Artificial Intelligence  
- OCR: Optical Character Recognition  
- SLM/RAG: Not applicable in this product; AI features rely on Gemini via Edge Functions  
- Supabase: Backend-as-a-Service (Postgres DB, Auth, Storage, Realtime, Edge Functions)

---

## 2. General Description
### 2.1 Product Perspective and System Architecture
- Frontend: Next.js 16 (App Router), React 19, Tailwind CSS  
- Backend: Next.js API routes; Supabase (Auth, Database, Storage, Realtime)  
- AI: Supabase Edge Functions calling Gemini APIs  
- Extension: Chrome background service posting tab-switch logs to `http://localhost:3003` (dev)  
Architecture follows modular separation of dashboards (student/professor/admin), API endpoints for parsing/variations/diagnostics, storage buckets for assets, and edge functions for secure AI calls.

### 2.2 User Characteristics
- Student: needs clarity, timed quizzes, autosave, and trust-respecting integrity rules  
- Professor: needs simple creation flows, results dashboards, integrity visibility, and grading acceleration  
- Admin: needs role/user/course/quiz oversight with clear, high-contrast UI

### 2.3 Data Collection and Framework
- Question banks uploaded to Storage (`question_banks`)  
- Drafts and grades stored in structured storage paths; submissions, integrity events, users, roles in Postgres tables  
- Allowed websites configured per quiz to prevent false positives in integrity logs

### 2.4 Survey and Requirements Validation
User needs validated through PRD and Tech Design workflows emphasizing minimal, academic UI, privacy-first monitoring, and professor-centric workflows. Success metrics include end-to-end demo, integrity logs visibility, and functional AI grading button.

---

## 3. Functional Requirements
All requirements use “shall” and are testable.

### 3.1 Authentication and Roles
- FR-1.1: The system shall authenticate users via Supabase Auth.  
- FR-1.2: The system shall associate each user with one role: student, professor, or admin.  
- FR-1.3: The system shall route users to role-appropriate dashboard views after login.  
- FR-1.4: The system shall show profile settings for avatar upload and password updates.

### 3.2 Course Management
- FR-2.1: Professors shall create courses with title and description.  
- FR-2.2: The system shall generate unique join codes.  
- FR-2.3: Students shall join courses using valid join codes.  
- FR-2.4: The system shall list course quizzes and provide access based on role.

### 3.3 Quiz Management
- FR-3.1: Professors shall create quizzes linked to courses.  
- FR-3.2: Professors shall enable integrity monitoring and configure allowed websites.  
- FR-3.3: Professors shall upload question banks to Storage.  
- FR-3.4: The system shall parse uploaded assets via OCR/Gemini extract with graceful fallback.  
- FR-3.5: The system shall generate quiz variations from master text or sets.  
- FR-3.6: The system shall persist quiz configuration and metadata.

### 3.4 Student Quiz Engine
- FR-4.1: The system shall present randomized questions and capture answers.  
- FR-4.2: The system shall autosave draft answers and restore as needed.  
- FR-4.3: The system shall enforce timing rules and display a floating timer.  
- FR-4.4: The system shall persist submissions with unique IDs and server-side validation.

### 3.5 Integrity Monitoring
- FR-5.1: The extension shall detect tab switches when monitoring is armed.  
- FR-5.2: The system shall record integrity events with timestamps and referrer context.  
- FR-5.3: The system shall exclude allowed websites from violation logs.  
- FR-5.4: The results dashboard shall display integrity events per student submission.  
- FR-5.5: The system shall provide diagnostics for tab-switch detection and logging status.

### 3.6 Results and Grading
- FR-6.1: The system shall list submissions and grades per quiz.  
- FR-6.2: Professors shall invoke AI-assisted grading via a Supabase Edge Function.  
- FR-6.3: Professors shall override per-question grades and save updates.  
- FR-6.4: The system shall show summary statistics and integrity counts.  
- FR-6.5: The system shall link to detailed violation lists per submission.

### 3.7 Administration
- FR-7.1: Admins shall assign roles to users.  
- FR-7.2: Admins shall create and delete users.  
- FR-7.3: Admins shall view overview counts of users, quizzes, submissions.  
- FR-7.4: Admins shall browse lists of courses and quizzes and open details.  
- FR-7.5: The admin dropdown shall exclude redundant links; dashboard consolidates admin UI.

### 3.8 API Integration
- FR-8.1: The system shall provide endpoints:  
  - `POST /api/gemini/extract` — parse questions from images/PDFs  
  - `POST /api/gemini/variations` — generate quiz variations (master or set mode)  
  - `GET /api/gemini/test`, `GET /api/gemini/diag` — diagnostics  
  - Supabase Edge Function `ai-grader` — AI-assisted grading  
- FR-8.2: The system shall validate payloads and return structured responses or error details.  
- FR-8.3: The system shall store parsed/generated questions in normalized formats.

### 3.9 Browser Extension
- FR-9.1: The extension shall post tab-switch log events to the backend when armed.  
- FR-9.2: The extension shall use app origin `http://localhost:3003` in development.  
- FR-9.3: The extension shall avoid logging allowed domains.  
- FR-9.4: The extension shall provide status indicators for monitoring state.

---

## 4. Interface Requirements
### 4.1 User Interface (HCI Layer)
- Minimal, academic design; high-contrast text; responsive layout  
- Role-based dashboards with clear navigation and tabbed admin interface  
- Wrapped long text in admin user lists; scrollable containers for large lists

### 4.2 Software Interfaces
- Next.js App Router; Supabase Auth/DB/Storage/Realtime; Edge Functions  
- REST API endpoints for OCR/Gemini extract, variations, diagnostics  
- Storage buckets: `question_banks`, `drafts`, `grades`, `avatars`

### 4.3 Hardware Interfaces
- Desktop browsers; standard internet connectivity (LAN/WAN/Ethernet/Wi-Fi)  
- No specialized hardware required; privacy-first approach avoids webcam usage

---

## 5. Non-Functional Attributes
### 5.1 Security
- Role-based authorization for admin/professor actions  
- Protected routes require authentication; secrets never logged; keys server-side  
- RLS policies applied to tables for least-privilege access (to be finalized)

### 5.2 Usability and Maintainability
- Responsive UI; accessible color contrast; consistent patterns and naming  
- Linting and standard conventions enforced via project scripts

### 5.3 Reliability and Data Management
- Autosave drafts; persisted submissions; integrity logs captured reliably  
- Periodic backups and signed URLs for controlled asset access

### 5.4 Performance Requirements
- 95% of dashboard loads complete within 2s on broadband  
- Quiz autosave completes within 1s under nominal load  
- Results queries paginate and respond within 3s for up to 1k items  
- Edge Functions respond within acceptable limits for AI grading interactions

### 5.5 Scalability
- Indexed queries; pagination; storage supports large assets and grade artifacts  
- Edge Functions scale for concurrent grading requests

### 5.6 Compliance and Privacy
- Privacy-first integrity: no webcam; allowed websites for open-book scenarios  
- Data handling aligned to academic project context; avoid storing sensitive PII beyond auth requirements

---

## 6. Risk Management
### 6.1 Purpose and Scope
Identify and mitigate risks across scope, team environment, and technical aspects.

### 6.2 Major Identified Risk Factors
- Personnel shortfalls; unrealistic schedules; wrong feature focus  
- Incorrect UI design; scope creep; dependency shortfalls  
- Realtime performance shortfalls; misconfigured secrets; RLS complexity  
- AI endpoint availability and rate limits

---

## 7. Change Management Process
### 7.1 Goal and Responsibility
Control requirement changes; minimize impact. Project lead coordinates change incorporation.

### 7.2 Change Management Process Steps
Log changes; perform impact analysis; estimate effort; re-estimate schedule; cumulative cost impact; review; sign-off; rework work products.

### 7.3 Documentation and Control
Maintain change log; update SRS (appendices); monitor implementation via configuration management.

---

## 8. Preliminary Schedule and Budget
- Schedule derived from project progress and Tech Design; phases cover Auth, Courses, Quizzes, Integrity Monitor, Results, AI Grading, Deployment  
- Budget: free-tier friendly (Supabase, Vercel); AI API usage may incur costs; manage via secrets and controlled calls

---

## 9. Acceptance Criteria
- Users sign up, log in, and access role-appropriate dashboards  
- Professors create courses/quizzes; students join and take quizzes  
- Integrity logs appear in results and exclude allowed sites  
- AI grading returns score and feedback; professors can override and save  
- Admin tabs function: Overview, Roles, Users, Courses, Quizzes

---

## Appendices
### A. Glossary of Terms
- Quiz: Set of questions presented to a student  
- Submission: Student’s saved quiz attempt  
- Integrity event: Tab-switch log linked to a submission  
- Allowed websites: Domains excluded from violation logs  
- Edge Function: Supabase serverless function used for secure AI calls

### B. Document Revision History
- v1.0 — December 13, 2025 — Initial final SRS release

### C. Change Log
- CL-001 — Consolidated admin panel into `/dashboard` admin view; removed redundant dropdown admin link  
- CL-002 — Improved contrast and text wrapping in admin Users tab  
- CL-003 — Integrated OCR/Gemini parsing and variation generation in quiz flows

### D. References
- PRD — `doc/PRD-Adaptive Smart Assessment System with Real-Time Integrity Detection-MVP.md`  
- Tech Design — `doc/TechDesign-Adaptive Smart Assessment System with Real-Time Integrity Detection-MVP.md`  
- Progress — `doc/CSE309-Project-Progress-Filled.md`  
- Notes — `/NOTES.md`  
- Research Prompt — `doc/research-Adaptive Smart Assessment System with Real-Time Integrity Detection.txt.txt`  
- Code references:  
  - Admin Dashboard tabs — `proctorless-app/app/dashboard/page.tsx`  
  - Results Dashboard — `proctorless-app/app/dashboard/results/[quizId]/page.tsx`  
  - AI endpoints — `proctorless-app/app/api/gemini/*`  
  - Edge Functions — `proctorless-app/supabase/functions/ai-grader/index.ts`, `jit-variant/index.ts`  
  - Extension background — `proctorless-extension/background.js`

