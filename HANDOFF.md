# ProctorLess — Session Handoff

**Written:** 2026-09-21
**Why:** previous session restarted to pick up the Supabase MCP server.
**Delete this file once the demo is done.**

---

## 🔴 Immediate situation

**A demo must be running by tomorrow. It needs to be working today.**

Everything below is in service of that. Architecture work is explicitly parked.

---

## Where things stand

| Thing | State |
|---|---|
| Repo | `D:\Github\ProctorLess` — app / extension / tests / docs / archives |
| `npm install` | ✅ Done. `node_modules` present. |
| Dev server | ⚠️ Was running on **port 3003**. A session restart kills it — **restart it**. |
| `.env.local` | ❌ **Still points at the DELETED project.** App cannot reach any database. |
| Old Supabase project | ☠️ `opklqnpeviogsdmgqgbw` — **deleted**. NXDOMAIN on 3 resolvers. Data unrecoverable. |
| New Supabase project | ✅ `mdlqnrjkqyuicfzirclb` — live, verified reachable. Schema **not yet applied**. |
| Supabase MCP | ✅ Connected, user scope. **Use it — that's why we restarted.** |

Start the dev server with:

```bash
cd "D:/Github/ProctorLess/app" && npm run dev
```

**Must be port 3003** — the Chrome extension is hardcoded to `http://localhost:3003`.

---

## ⛔ BLOCKING: `.env.local` needs the new keys

The user has not yet supplied them. Ask for:

```
NEXT_PUBLIC_SUPABASE_URL=https://mdlqnrjkqyuicfzirclb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / public  — or sb_publishable_...>
SUPABASE_SERVICE_ROLE_KEY=<service_role — or sb_secret_...>
GEMINI_API_KEY=<already present in the file, keep it>
```

From **Supabase → Settings → API Keys**.

⚠️ Newer projects may issue `sb_publishable_` / `sb_secret_` style keys instead of legacy JWTs. The code reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Note that `.env.example` disagrees with the code — it says `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Code wins.

---

## 🔑 The schema — read this before touching the database

### Critical finding

**`courses` and `enrollments` had NO `CREATE TABLE` anywhere in the repo.** They were made by hand in the old dashboard and died with it. The app uses them 10 times; `001` line 10 has `course_id uuid NOT NULL REFERENCES public.courses(id)` and **fails without them**.

They have been reconstructed from the app's insert paths into:

```
app/supabase/migrations/000_courses_and_enrollments.sql
```

Every column in that file cites the source line it was inferred from. It leaves RLS **off** deliberately and carries a reviewed policy set in comments for later.

### Run order — alphabetical order FAILS

```
 1.  supabase/migrations/000_courses_and_enrollments.sql   ← NEW, must be first
 2.  supabase/migrations/001_create_quizzes_and_submissions_and_rpc.sql
 3.  supabase/migrations/002_create_users_table_and_storage.sql
 4.  supabase/migrations/003_create_generated_questions.sql
 5.  supabase/migrations/004_admin_role_and_audit.sql
 6.  supabase/migrations/005_create_machine_registry.sql
 7.  SEATING_MIGRATION.sql                                  ← MUST precede 006
 8.  supabase/migrations/006_add_participant_fingerprint.sql
 9.  INTEGRITY_TAB_LOGS_MIGRATION.sql
```

`006` does `ALTER TABLE session_participants`, which only `SEATING_MIGRATION.sql` creates. That's why order is explicit.

### ⛔ Do NOT run these

| File | Why |
|---|---|
| `MACHINE_REGISTRY_SETUP.sql` | Duplicate of `005` |
| `QUIZ_TABLES_SETUP.sql` | Duplicate of `001` |
| `DUMMY_DATA.sql` | References user/quiz UUIDs from the dead project |
| `disable_all_rls.sql` | Turns RLS off — this is review blocker #8 |
| `enable_rls_policies.sql` | Conflicts with the other three |
| `clean_rls_setup.sql` | Conflicts with the other three |
| `fix_rls_recursion.sql` | Exists because a prior policy set caused infinite recursion |

**RLS is intentionally OFF for the demo.** It's localhost-only. Do not deploy publicly in this state. Never write a `user_roles` policy that queries `user_roles` — that was the recursion.

---

## 👤 Accounts

**No passwords are recoverable** — bcrypt-hashed, and that project is gone anyway. All accounts must be created fresh.

- **Admin:** sign up as `storage12002@gmail.com`. Migration `004` auto-promotes that exact address. Nothing else grants admin.
- **Professor:** ⚠️ **Nothing in the app ever assigns `professor`.** The signup trigger only issues `admin` or `student`. Create one manually:

```sql
update user_roles set role = 'professor'
where user_id = (select id from auth.users where email = 'EMAIL_HERE');
```

- **Student:** any fresh signup defaults to student.

You need a professor **and** a student live at once — normal window plus incognito.

---

## 🎬 Demo gotchas

1. **Set variants to 4, not 3.** At the default of 3 the Latin square collapses — `row * 3 ≡ 0 (mod 3)` — and vertical neighbours get identical papers, visibly, on screen. This is review blocker #2.
2. **Port 3003.** Extension is hardcoded to it.
3. **Extension:** `chrome://extensions` → Developer mode → Load unpacked → `D:\Github\ProctorLess\extension`.

---

## Remaining demo checklist

- [ ] Restart dev server on 3003
- [ ] Get API keys, rewrite `.env.local`
- [ ] Run the 9 SQL files in order (**use the MCP server**)
- [ ] Sign up admin + professor + student
- [ ] Promote the professor via SQL
- [ ] Seed a demo course + quiz + questions
- [ ] Register machines to lab seats
- [ ] Load extension, verify logging
- [ ] Rehearse once end to end

---

## Context worth keeping

### The code review
A full audit was completed. **8 blocking issues**, verdict "request changes." Headline: the variant Latin square is broken at its default, and `/api/admin/set-role` is unauthenticated (anyone can make themselves admin). Published deck:

https://claude.ai/artifact/LUvZV5QKnGm4KMqiMyFn1o

Two known errors in that deck, to correct later:
- Says "Next.js 15" — actually resolves to **16.0.1** (`package.json` pins `next` to `"latest"`, which is its own problem: builds are not reproducible).
- Says the 5 root-level SQL files "duplicate" the migrations. **Wrong** — only 2 duplicate. `SEATING_MIGRATION.sql` and `INTEGRITY_TAB_LOGS_MIGRATION.sql` are the sole definition of `quiz_sessions`, `session_participants` and `integrity_tab_logs`. They are load-bearing. Do not delete them.

### Architecture — PARKED until after the demo
User asked about restructuring into a modular monolith (`router → service → repository`, from their own notebook). Answer: yes, worth doing, and the deleted database makes now the cheapest moment — but **not before the demo**. Revisit after.

The audit's findings all share one root cause: there is no service layer. The browser calls `supabase.from(...)` directly, so there's no chokepoint for authorization. Target shape: `lib/modules/{identity,courses,quizzes,sessions,integrity,grading}/` each with `service.ts` / `repository.ts` / `types.ts`, plus a lint rule that `supabase.from('<table>')` may appear only in that table's repository.

### Standing instruction from the user
**No code fixes without a plan approved first.** The user was explicit: *"do not implement anything as of yet... we will be first planning everything out instead of rapid building."* Demo-enabling work (schema, env, seeds) is in scope. Rewriting app code is not.
