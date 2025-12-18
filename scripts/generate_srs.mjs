import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function H(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level });
}

function P(text) {
  return new Paragraph({ children: [new TextRun(text)] });
}

function Bullets(items) {
  return items.map(
    (t) =>
      new Paragraph({
        text: t,
        bullet: { level: 0 },
      }),
  );
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        H("Adaptive Smart Assessment System – Final SRS", HeadingLevel.TITLE),
        P("Product: ProctorLess – Smart assessment tool (Next.js + Supabase)"),
        P("Version: 1.0"),
        P("Date: " + new Date().toISOString().slice(0, 10)),

        H("1. Introduction", HeadingLevel.HEADING_1),
        H("1.1 Purpose"),
        P(
          "Define complete, testable requirements for an adaptive online assessment system with real-time integrity monitoring, AI-assisted grading, and role-based administration.",
        ),
        H("1.2 Scope"),
        Bullets([
          "Web application delivering quizzes and courses to students",
          "Professors manage courses, quizzes, results, integrity logs",
          "Admins manage roles, users, and global system resources",
          "AI-assisted features for grading and quiz variation generation",
        ]),
        H("1.3 Overview"),
        P(
          "The system provides dashboards for distinct roles, secure authentication, scalable storage, integrity monitoring via a browser extension, and analytics for performance.",
        ),

        H("2. General Description", HeadingLevel.HEADING_1),
        H("2.1 User Classes and Characteristics"),
        Bullets([
          "Student: takes quizzes, joins courses, receives feedback",
          "Professor: creates courses/quizzes, reviews results, uses AI tools",
          "Admin: assigns roles, manages users, audits system health",
        ]),
        H("2.2 Product Functions"),
        Bullets([
          "Authentication and role-based navigation",
          "Course creation and join codes",
          "Quiz creation with integrity monitor and allowed websites",
          "Student quiz engine with autosave and submission",
          "Results dashboard with integrity logs and AI grading",
          "Admin dashboard with overview, roles, users, courses, quizzes tabs",
        ]),
        H("2.3 Operating Environment"),
        Bullets([
          "Frontend: Next.js 16 (App Router, Turbopack), React 19",
          "Backend: Next.js API routes, Supabase (DB, Auth, Storage, Realtime)",
          "Browser extension: Chrome-based, background service logs",
          "Runtime: Node.js on development; Vercel/Supabase in production",
        ]),
        H("2.4 Design and Implementation Constraints"),
        Bullets([
          "Supabase schema for users, courses, quizzes, submissions, integrity_logs",
          "Environment secrets required for Gemini AI integration",
          "Storage buckets used for question banks, drafts, grades, avatars",
          "Middleware session management for protected routes",
        ]),
        H("2.5 Assumptions and Dependencies"),
        Bullets([
          "Users have modern browsers and stable internet",
          "Supabase services available and correctly configured",
          "GEMINI_API_KEY present for AI endpoints",
        ]),

        H("3. System Features and Requirements", HeadingLevel.HEADING_1),
        H("3.1 Functional Requirements"),
        H("3.1.1 Authentication and Roles"),
        Bullets([
          "System authenticates users with Supabase",
          "System assigns roles: student, professor, admin",
          "System routes dashboard view based on role",
        ]),
        H("3.1.2 Courses"),
        Bullets([
          "Professor creates courses with title and description",
          "System generates unique join codes",
          "Student joins a course using a valid join code",
        ]),
        H("3.1.3 Quizzes"),
        Bullets([
          "Professor creates quizzes linked to courses",
          "Professor configures integrity monitor and allowed websites",
          "Professor uploads question banks and sets options",
        ]),
        H("3.1.4 Student Quiz Engine"),
        Bullets([
          "System presents randomized questions and captures answers",
          "System autosaves progress and enforces timing",
          "System submits answers and records a submission",
        ]),
        H("3.1.5 Integrity Monitoring"),
        Bullets([
          "Extension detects tab switches and posts logs to API",
          "System ignores allowed websites as configured",
          "Results dashboard displays per-student integrity events",
        ]),
        H("3.1.6 Results and Grading"),
        Bullets([
          "System lists submissions and grades per quiz",
          "Professor uses AI grading via Supabase Edge Function",
          "Professor edits per-question grading and saves updates",
        ]),
        H("3.1.7 Administration"),
        Bullets([
          "Admin assigns roles to users",
          "Admin creates and deletes users",
          "Admin views courses and quizzes overview",
        ]),

        H("3.2 Non-Functional Requirements"),
        H("3.2.1 Performance"),
        Bullets([
          "95% of dashboard page loads complete under 2 seconds on broadband",
          "Quiz autosave completes within 1 second under nominal load",
          "Results queries paginate and respond under 3 seconds for 1k items",
        ]),
        H("3.2.2 Security"),
        Bullets([
          "Only authenticated users access protected routes",
          "Role-based authorization enforced for admin/professor actions",
          "Secrets never logged; environment variables managed securely",
        ]),
        H("3.2.3 Reliability and Availability"),
        Bullets([
          "Realtime subscriptions reconnect on transient failures",
          "Retry/backoff for AI endpoints when service is unavailable",
          "Graceful error messages for user-facing failures",
        ]),
        H("3.2.4 Usability"),
        Bullets([
          "Responsive UI across devices",
          "High-contrast text for admin users list and wrapped long emails",
          "Clear tabbed navigation for admin dashboard",
        ]),
        H("3.2.5 Scalability"),
        Bullets([
          "Supabase handles growing data volumes with indexing",
          "Storage buckets support large question banks and grades",
          "Edge functions scale with concurrent grading requests",
        ]),

        H("3.3 External Interface Requirements"),
        H("3.3.1 APIs"),
        Bullets([
          "POST /api/gemini/extract: parse questions from images/PDFs",
          "POST /api/gemini/variations: generate quiz variations",
          "GET /api/gemini/test, /api/gemini/diag: diagnostics",
          "POST supabase edge function /ai-grader: AI-assisted grading",
        ]),
        H("3.3.2 Storage"),
        Bullets([
          "Buckets: question_banks, drafts, grades, avatars",
          "Grades stored per submission; signed URLs for avatars",
        ]),
        H("3.3.3 Browser Extension"),
        Bullets([
          "Background script posts tab-switch logs to app API",
          "Configurable allowed websites to avoid false positives",
        ]),

        H("4. Data Requirements", HeadingLevel.HEADING_1),
        Bullets([
          "Tables: users, user_roles, courses, quizzes, submissions, integrity_logs",
          "Relationships: quizzes belong to courses; submissions belong to quizzes and users",
          "Audit: timestamps for creation, updates, event logs",
        ]),

        H("5. System Architecture", HeadingLevel.HEADING_1),
        Bullets([
          "Next.js frontend with role-based dashboard views",
          "API routes for parsing, variations, OCR fallback, diagnostics",
          "Supabase for auth, database, storage, realtime",
          "Edge functions for AI grading",
        ]),

        H("6. Constraints and Policies", HeadingLevel.HEADING_1),
        Bullets([
          "Compliance: privacy-first logging of integrity events",
          "Security: do not store secrets client-side",
          "No exposure of service role keys in browser",
        ]),

        H("7. Acceptance Criteria", HeadingLevel.HEADING_1),
        Bullets([
          "Users sign up, log in, and access role-appropriate dashboards",
          "Professors create courses/quizzes; students join and take quizzes",
          "Integrity logs appear in results dashboard and exclude allowed sites",
          "AI grader returns scores and feedback; professors can override",
          "Admin tabs function: roles, users, courses, quizzes",
        ]),

        H("8. Preliminary Schedule and Budget", HeadingLevel.HEADING_1),
        Bullets([
          "Development complete; stabilization and testing ongoing",
          "Operational costs: Supabase, hosting, storage, AI API usage",
        ]),

        H("9. Appendices", HeadingLevel.HEADING_1),
        Bullets([
          "Glossary: quiz, submission, integrity event, allowed website",
          "Reference: SRS formats and best practices",
        ]),
      ],
    },
  ],
});

const outPath = resolve(__dirname, "../../doc/Final_SRS_ProctorLess.docx");
Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(outPath, buffer);
  console.log("Generated:", outPath);
});
