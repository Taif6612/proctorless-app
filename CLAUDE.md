# ProctorLess — Agent Guardrails

Exam-integrity system for physical computer labs. Next.js + Supabase + Gemini + a Chrome MV3
extension. "Smart Integrity, Zero Surveillance" — no webcam, no screen capture. Integrity comes
from seat-based question variants plus browser tab monitoring.

**This file is loaded every session. Read it before touching anything.**

---

## Standing rule

**Plan before implementing.** The user has stated this repeatedly. Propose the change, get
agreement, then write code. Do not "helpfully" fix things you notice in passing — flag them.

The full task list is in `.claude/plan.md`. Work from it.

---

## Traps — each of these cost an hour to find

**1. Three SQL files are load-bearing despite looking like duplicates.**
`SEATING_MIGRATION.sql` and `INTEGRITY_TAB_LOGS_MIGRATION.sql` in the app root are the *only*
definition of `quiz_sessions`, `session_participants` and `integrity_tab_logs`. Deleting them
destroys the seating system. Only `MACHINE_REGISTRY_SETUP.sql` and `QUIZ_TABLES_SETUP.sql` are
genuine duplicates.

**2. Migrations do not run in alphabetical order.**
`006` does `ALTER TABLE session_participants`, which only `SEATING_MIGRATION.sql` creates.
Correct order:

```
000_courses_and_enrollments  →  001  →  002  →  003  →  004  →  005
  →  SEATING_MIGRATION  →  006  →  INTEGRITY_TAB_LOGS_MIGRATION  →  007  →  008  →  009
```

`app/BOOTSTRAP_ALL.sql` is this sequence concatenated.

**3. Never run the four standalone RLS files.**
`disable_all_rls.sql`, `enable_rls_policies.sql`, `clean_rls_setup.sql`, `fix_rls_recursion.sql`
contradict each other. `fix_rls_recursion` exists because a `user_roles` policy that queried
`user_roles` caused infinite recursion. **Never write a policy that selects from its own table.**

**4. Do not reinstall dependencies casually.**
`package.json` pins `next`, `@supabase/supabase-js` and `@supabase/ssr` to `"latest"`.
A reinstall resolved `next` to **16.0.1** — a major above what the code targets. The app now runs
the deprecated `middleware.ts` through a compat shim (server logs say `proxy.ts:` for a file that
does not exist). Pin versions before running `npm install` again.

**5. Dynamic routes 404 when Turbopack's manifest goes stale.**
Symptom: every `[id]` route 404s on direct load while static routes are fine; client-side
navigation still works, so it looks intermittent. It is not a code bug.

```bash
rm -rf .next    # then restart the dev server
```

**6. The service-role key bypasses RLS — never verify permissions with it.**
Seeding with it hid a storage-policy bug for hours: uploads "worked" for the agent and failed for
every real user. Verify permissions using an anon-key client with a real user session.

**7. The dev server must run on port 3003.**
The extension hardcodes `http://localhost:3003`. On any other port, monitoring silently does
nothing.

---

## Environment

| | |
|---|---|
| App | `app/` · `npm run dev` · **port 3003** |
| Extension | `extension/` · load unpacked via `chrome://extensions` |
| Supabase ref | `mdlqnrjkqyuicfzirclb` |
| Keys | `app/.env.local` (not tracked; `.env.example` has the **wrong** key name) |
| Tables | 13 |
| Buckets | `avatars`, `question_banks`, `question_assets` — **all public** |

**RLS is hybrid.** On: `users`, `user_roles`, `machine_registry`, `quiz_sessions`,
`session_participants`, `integrity_tab_logs`. Off: `courses`, `enrollments`, `quizzes`,
`submissions`, `integrity_logs`, `generated_questions`, `admin_audit_logs`.
This is a demo posture, not a decision. See plan task 0.4.

### Test accounts — password `zxcv12345`

| Role | Email |
|---|---|
| professor | `taifurrahman66123@gmail.com` |
| student | `abdullahesthiak@gmail.com` |
| student | `xihif43899@mekuron.com` |

Course join code: `CSE309`. **No code path grants the `professor` role** — it is only settable by
writing to `user_roles` directly. That is plan task 2.6, not a bug to work around.

---

## Skills

Installed in `.agents/skills/`, symlinked into `.claude/skills/`. Newly installed skills need a
session restart before the `Skill` tool sees them; read their `SKILL.md` directly otherwise.

| Skill | Use for |
|---|---|
| `code-review-skill` | Reviewing changes. Severity tiers 🔴 blocking / 🟡 important / 🟢 nit. Ships `reference/react.md`, `reference/typescript.md`, `reference/security-review-guide.md`, `reference/cross-cutting/n-plus-one-queries.md`. |
| `thermo-nuclear-code-quality-review` | Structural audits. User-invoked only (`disable-model-invocation: true`). Be ambitious — look for restructurings that delete complexity, not rearrange it. |
| `grill-me` → `grilling` | Design interviews. Ask only questions whose prerequisites are settled; number them; give a recommended answer; wait between rounds. |

**Use `code-review-skill` before declaring any task complete.** Its `assets/review-checklist.md`
is the standard to check against.

---

## Known-wrong things that are not yours to fix mid-task

- `.env.example` declares `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the code reads
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Plan task 5.4.
- Two of four Gemini models in the extract ladder do not exist, costing ~6s per request.
  Plan task 4.1.
- `app/dashboard/page.tsx` is 1,582 lines. Plan task 3.3.
- There are no executing tests. Plan task 5.2.
