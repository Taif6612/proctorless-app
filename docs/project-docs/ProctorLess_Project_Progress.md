# Web Application Project Progress

**CSE309 — Sec-___** **Autumn 2025**

## Student Information

| Student ID | Student Name | Email | Contact |
| :--- | :--- | :--- | :--- |
| 2221456 | Taif ur rahman | 2221456@iub.edu.bd | 01703306577 |

## Project Supervisor

| Project Supervisor | Email | Contact |
| :--- | :--- | :--- |
| Md Abu Sayed | asayed@iub.edu.bd | 01941016016 |

## Project Title

| Project Title |
| :--- |
| ProctorLess |

## Abstract

ProctorLess is a privacy‑first smart assessment platform that replaces invasive proctoring with lightweight integrity signals and a simple, reliable quiz engine.

**Problem:** Traditional proctoring tools (Respondus/ProctorU) are intrusive and raise anxiety; simple LMS quizzes don’t log tab‑switch integrity and require manual grading.

**Solution:** ProctorLess adds a tab‑switch monitor (no webcam), a robust quiz editor, a 5‑minute buffer and optional timer, draft autosave/restore, and a results dashboard with per‑question grading and an AI‑assist hook. OCR/Gemini parsing converts exam assets into MCQs/Q&A quickly.

**Impact:** Students retain privacy and clarity; professors save time and get actionable integrity logs. The MVP is scoped for a 1‑week, $0 budget using free tiers (Next.js, Supabase, Vercel; OCR/Gemini with fallbacks), guided by the PRD and Tech Design.

**Challenges:** Browser security constraints for destination URLs, resilient timers derived from persisted start time, RLS policies, stable OCR/Gemini integration, and end‑to‑end reliability under free‑tier limits.

---

## Tentative Task List for the Project

*(List all breakdown of tasks to complete your project. Break tasks into the smallest units possible.)*

| Sl | Task Name | Start Date | End Date | Comment |
| :--- | :--- | :--- | :--- | :--- |
| 1. | Initialize Next.js + Supabase | 2025-11-11 | 2025-11-12 | Done |
| 2. | Auth & role access (student/professor) | 2025-11-12 | 2025-11-13 | Done |
| 3. | Profile & settings pages (avatar, password) | 2025-11-13 | 2025-11-14 | Done |
| 4. | OCR/Gemini parse API (fallback + diag) | 2025-11-14 | 2025-11-15 | Done |
| 5. | Quiz editor (add/reorder/delete, max marks, correct) | 2025-11-15 | 2025-11-17 | Done |
| 6. | Student quiz buffer (5 min) + floating timer | 2025-11-16 | 2025-11-18 | Done |
| 7. | Draft autosave & restore answers | 2025-11-17 | 2025-11-18 | Done |
| 8. | Results dashboard (violations + extension URLs) | 2025-11-17 | 2025-11-18 | Done |
| 9. | Backend enforcement (timer lock & submission state) | 2025-11-18 | 2025-11-20 | Ongoing |
| 10. | AI grading Edge Function + UI wiring | 2025-11-19 | 2025-11-22 | Ongoing |
| 11. | Course management (create/join via code) | 2025-11-22 | 2025-11-24 | Planned |
| 12. | RLS policies for courses/quizzes/submissions | 2025-11-19 | 2025-11-20 | Planned |
| 13. | Deploy to Vercel + env vars | 2025-11-23 | 2025-11-24 | Planned |
| 14. | E2E demo run (Professor→Student→Results) | 2025-11-24 | 2025-11-24 | Planned |

## Project Resources

1.  Next.js App Router Docs — https://nextjs.org/docs/app
2.  Supabase Auth/Storage Docs — https://supabase.com/docs
3.  Gemini Image Understanding — https://ai.google.dev/gemini-api/docs/image-understanding
4.  PRD — doc/PRD-Adaptive Smart Assessment System with Real-Time Integrity Detection-MVP.md
5.  Tech Design — doc/TechDesign-Adaptive Smart Assessment System with Real-Time Integrity Detection-MVP.md
6.  Research — doc/research-Adaptive Smart Assessment System with Real-Time Integrity Detection.txt

## Version & Tracking

- Version: 2025-11-19
- Last Updated: 2025-11-19 12:10 UTC

## Modification History

- 2025-11-19 12:00 UTC — Removed all references to external test tooling from documentation in `doc/` and aligned QA scope to in-repo plans.
- 2025-11-19 12:05 UTC — Scheduled comprehensive UI improvements for dashboards and admin due by 2025-12-08.
- 2025-11-19 12:20 UTC — Added "Grade with AI" button on Results page; responses prefill per-question score and feedback; integrated with existing Save Grades.

## Current Status

- Completed: Initialize Next.js + Supabase; Auth & roles; Profile & settings; OCR/Gemini parse API; Quiz editor; Student buffer + timer; Draft autosave/restore; Results dashboard.
- Ongoing: Backend enforcement (timer lock & submission state).
- Planned: AI grading Edge Function UI wiring; Course management polish; RLS policies; Vercel deployment; E2E demo run.

## UI Improvement Plan (Due 2025-12-08)

- Navigation and layout: intuitive menus, optimized component placement, responsive across devices.
- Role-specific features: professor and student contextual actions and workflows.
- Data visualization: dashboard summary cards, per-course metrics, violation indicators.
- Visual design: consistent theming, improved hierarchy/readability, optimized interactive elements.
- Admin page: role management operations, validation and error handling, workflow clarity, consistent UI system.

## Implementation Tickets (References)

- .trae/documents/Implement Question Bank Upload and Quiz Engine.md
- .trae/documents/Fix Professor Dashboard JSX Build Error.md
- .trae/documents/Restart Next.js Dev Server on Port 3003.md

---

## Task Progress & Evaluation for Week No ……1……

*(Write your progress from Sunday to Saturday of the week.)*

| From Date: | 2025-11-11 | To Date: | 2025-11-17 |
| :--- | :--- | :--- | :--- |

### Progress Details

| Sl | Task Breakdown (from the list) | Challenges (during work) | Status | Comment |
| :--- | :--- | :--- | :--- | :--- |
| 1. | Initialize Next.js + Supabase | Env keys and auth scaffolding | Done | Project running on 3003 |
| 2. | Auth & roles | Role mapping and protected routes | Done | Login, role guard verified |
| 3. | Profile & settings pages | Storage policies for avatars | Done | Avatar upload + password change |
| 4. | OCR/Gemini parse API | Gemini 400/503 handling, fallback | Done | Retry/backoff + OCR fallback |
| 5. | Quiz editor | MCQ mapping, reordering | Done | Max marks + correct answer fields |
| 6. | Student quiz buffer/timer | Persisted start time | Done | Floating timer; input lock rules |
| 7. | Draft autosave & restore | Debounce, multi‑device restore | Done | LocalStorage + Supabase drafts |
| 8. | Results dashboard | Readable logs, per‑question grading | Done | Edit quiz link + URL logs rendered |
| 9. | Backend enforcement (timer lock & submission state) | 2025-11-18 | Ongoing | 2025-11-20 |

### Evaluation of Project Progress

| Evaluation of Project Progress | |
| :--- | :--- |
| **Self‑evaluation** | Solid foundation with core MVP features implemented per PRD; resilient OCR/Gemini parsing (with fallback), persisted timers/answers, and readable integrity logs; ready for backend enforcement, AI grading function, and deployment. |
| **Project Supervisor (Evaluation)** | |

---

## Task Progress & Evaluation for Week No ……2……

*(Write your progress from Sunday to Saturday of the week.)*

| From Date: | 2025-11-18 | To Date: | 2025-11-24 |
| :--- | :--- | :--- | :--- |

### Progress Details

| Sl | Task Breakdown (from the list) | Challenges (during work) | Status | Comment |
| :--- | :--- | :--- | :--- | :--- |
| 9. | Backend timer enforcement | DB locks and server guards | Planned | Prevent input after timer on server |
| 10. | AI grading Edge Function | Secure key, response shape | Planned | Per‑question grading with AI |
| 11. | Course management | Join code collisions, RLS | Planned | Create/join course flow |
| 12. | RLS policies | Table‑level SELECT/INSERT guards | Planned | Professor/student scoping |
| 13. | Deploy to Vercel | Env setup, preview URL | Planned | Add NEXT_PUBLIC_* and GEMINI_API_KEY |

### Evaluation of Project Progress

| Evaluation of Project Progress | |
| :--- | :--- |
| **Self‑evaluation** | On track for E2E flow per Tech Design timeline; next focus is backend enforcement (server locks), AI grading Edge Function, RLS policies, and deploy + demo rehearsals. |
| **Project Supervisor (Evaluation)** | |

---

## Additional Weeks

Duplicate the week sections above for Week No ……3……, ……4……, etc., as needed.

## Success Metrics (from PRD)

* End‑to‑End Demo: Professor creates quiz with integrity + AI options; Student takes quiz and triggers tab‑switch events; Professor reviews results, clicks AI‑Grade, and sees Integrity Log.
* All 7 core features functional on desktop.

## Risk Mitigation (from Tech Design)

* Auth/RLS complexity → use starter and AI‑assisted policy generation.
* Secure AI call → Supabase Edge Function with server‑side secret.
* 1‑week timeline → focus on PRD seven features; use AI assistants (Gemini/Claude) for boilerplate.
