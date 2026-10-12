# ProctorLess — Implementation Plan

**For the agent taking over coding.** Read `CLAUDE.md` first — it holds the traps.

Written 2026-09-22 by Opus 5 after a full audit and a from-scratch database rebuild.
Nothing here is implemented. Human-readable rationale: https://claude.ai/artifact/RhoCFiNB4esKhAvcCrTmVH

---

## How to work this plan

1. **One task per change.** Each has a Definition of Done. Do not batch.
2. **Verify before claiming done.** Every task has a check that must actually be run.
3. **Review your own work** against `.agents/skills/code-review-skill/assets/review-checklist.md`
   before reporting completion.
4. **Do not skip ahead.** Dependencies are stated and they are real.
5. **Ask before deviating.** The user's standing rule is plan-then-build.

Severity: 🔴 blocking · 🟡 important · 🟢 cleanup
Effort: **S** under half a day · **M** half to one day · **L** two days or more

---

## ⚠️ Read before Phase 2

The seat-based variant system — the product's central claim — **is not connected to anything.**

- `app/dashboard/quiz/[id]/join/page.tsx:272` pushes `?variant=N`
- `app/dashboard/quiz/[id]/page.tsx:27` calls `useSearchParams()` but line 30 only reads `get('view')`
- Question selection (`app/dashboard/quiz/[id]/page.tsx:158–200`) uses a separate
  `variations/<quizId>.json` file and picks with `Math.random()`
- The only consumer of `variant_index` is `join/page.tsx:374`, which renders the letter A/B/C/D

Every student currently receives the same questions. Fixing the Latin-square maths changes
nothing until the value is consumed. **Task 2.1 is a design decision and gates the rest of Phase 2.**

---

# Phase 0 — Make the repo describe the system

Blocks everything. Five pieces of infrastructure existed only in the old Supabase dashboard and
broke the rebuild in five different ways. Until a clone produces a working system, no other fix
is verifiable.

### 0.1 🔴 Consolidate the recovery migrations · S

**Files:** `app/supabase/migrations/000_*.sql`, `007_*.sql`, `008_*.sql`, `009_*.sql`, `app/BOOTSTRAP_ALL.sql`

`000` (courses + enrollments), `007` (realtime publication), `008` (storage buckets) and
`009` (storage policies) were written during the rebuild. They work but are not yet a documented,
ordered set.

**Do:** Establish one ordered sequence. Regenerate `BOOTSTRAP_ALL.sql` from it. Document the order
in `app/supabase/migrations/README.md`.

**Done when:** `BOOTSTRAP_ALL.sql` contains all migrations in dependency order and a comment
explains why alphabetical order fails.

---

### 0.2 🔴 Prove reproducibility from zero · M

**Depends on:** 0.1

The single most valuable task in this plan. Five hidden-state bugs were found in one evening;
there is no reason to believe five is the total.

**Do:**
1. Create a throwaway Supabase project
2. Run **only** what is in the repo — no dashboard clicks
3. Point a clean checkout at it
4. Exercise: sign up → create course → author quiz → upload a paper → parse → join → submit

**Done when:** all six steps pass with zero manual dashboard configuration. Every gap found
becomes a new migration, not a manual fix.

---

### 0.3 🔴 Pin every dependency · S

**File:** `app/package.json`

```json
"next": "latest",
"@supabase/supabase-js": "latest",
"@supabase/ssr": "latest"
```

`"latest"` resolved `next` to 16.0.1, above the major the code targets. See CLAUDE.md trap 4.

**Do:** Pin exact versions. Decide explicitly: stay on 15.x, **or** complete the move to 16 by
renaming `app/middleware.ts` → `app/proxy.ts` and adapting it.

**Done when:** `npm ci` twice on different machines produces identical `next` versions, and
`npm run build` succeeds.

**Verify:** `node -e "console.log(require('./node_modules/next/package.json').version)"`

---

### 0.4 🟡 Resolve the four conflicting RLS files · M

**Files:** `app/supabase/migrations/{enable_rls_policies,fix_rls_recursion,clean_rls_setup,disable_all_rls}.sql`

Current state is a hybrid: RLS on for 6 tables, off for 7 (see CLAUDE.md). That is a demo
posture, not a decision.

**Do:** Produce one deliberate policy set as a new numbered migration. Delete the four.
**Never write a `user_roles` policy that selects from `user_roles`** — that recursion is why
`fix_rls_recursion.sql` exists.

**Done when:** every table has an explicit, intentional RLS state, and the app still works
end-to-end using an **anon-key** client (not service-role — see CLAUDE.md trap 6).

---

### 0.5 🟢 Delete the two verified duplicates · S

**Delete:** `app/MACHINE_REGISTRY_SETUP.sql`, `app/QUIZ_TABLES_SETUP.sql`
**Do NOT delete:** `app/SEATING_MIGRATION.sql`, `app/INTEGRITY_TAB_LOGS_MIGRATION.sql`

**Verify first:**
```bash
grep -c "CREATE TABLE" app/MACHINE_REGISTRY_SETUP.sql app/QUIZ_TABLES_SETUP.sql
```
Confirm every table they create also exists in `005` / `001` before deleting.

---

# Phase 1 — Authorization

**9 of 12 API routes contain no authentication call. 5 of those construct a service-role client.**

`app/api/machine/register/route.ts` is the only correct route in the codebase.
**Use it as the template:** authenticate → check role → validate input → handle conflicts.

| Route | Auth | Service role |
|---|---|---|
| `admin/users` | none | yes |
| `admin/user-map` | none | yes |
| `admin/set-role` | none | yes |
| `admin/get-role` | none | yes |
| `integrity/tab` | none | yes |
| `machine/identify` | none | yes |
| `gemini/{extract,diag,test,variations}` | none | no |
| `ocr/parse` | none | no |
| `machine/register` | **yes** | yes |

### 1.1 🔴 Stop excluding the admin surface from middleware · S

**File:** `app/middleware.ts:18`

The matcher excludes `api/admin/.*` and `admin(?:/.*)?`, so no session check runs for them.

**Do:** Remove both exclusions. Keep only static-asset exclusions.

**Verify:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api/admin/users`
must not be `200` when unauthenticated.

---

### 1.2 🔴 Authenticate and role-check all four admin routes · M

**Depends on:** 1.1 (necessary but not sufficient — each route must verify independently)

**Files:** `app/api/admin/{set-role,users,user-map,get-role}/route.ts`

`set-role` currently reads `{ email, role, actorEmail }` from the body and performs **no caller
verification at all**. `actorEmail` comes from the client, so `admin_audit_logs` is self-reported
and forgeable.

**Do:** In each route — resolve the session, load the caller's role, reject non-admins, and
derive the actor from the **session**, never the payload.

**Done when:** an authenticated *student* calling `set-role` receives 403, and the audit log
records the real caller.

---

### 1.3 🔴 Ownership checks on every write path · M

**File:** `app/dashboard/actions.ts`

| Function | Line | Missing check |
|---|---|---|
| `createQuiz` | ~214 | caller owns `course_id` |
| `uploadQuestionAsset` | ~356 | caller owns the quiz |
| `saveQuestionBank` | ~370 | caller owns the quiz |

All three verify only that *a* user is signed in. Any student can overwrite any exam's questions.

`deleteQuiz` (~385) already does this correctly — join `quizzes → courses` and compare
`professor_id` to `user.id`. **Copy that pattern.**

**Done when:** a student session calling `saveQuestionBank` on a professor's quiz is rejected,
verified with a real anon-key session.

---

### 1.4 🔴 Sign and verify exam tokens · M

**File:** `app/api/integrity/tab/route.ts:42`

```js
// Decode JWT (simple base64 decode, not validating signature)
```

The comment is accurate. Any student can forge a `sub` and attribute browsing to anyone.

**Do:** Verify the signature using Supabase's JWT secret, or resolve the user from a real
server-side session instead of decoding a client-supplied token.

**Done when:** a token with a tampered payload is rejected.

---

### 1.5 🔴 Authenticate integrity log reads · S

**File:** `app/api/integrity/tab/route.ts:161` — carries `// TODO: Add authentication check`

Anyone with a submission UUID can read a student's full browsing history.

**Do:** Require a session; allow the owning student or the professor of the owning course.

---

### 1.6 🔴 Close the SSRF in the extract route · M

**File:** `app/api/gemini/extract/route.ts:210` — `fetchBase64(url)` fetches any caller-supplied
`fileUrl` server-side, unauthenticated, and forwards it to a third-party OCR service.

**Do:** Accept a **storage object key**, not a URL. Read it server-side with the service role.

This single change closes the SSRF *and* removes the need for public buckets, which unblocks 1.9.
Prefer it over URL allow-listing — deleting the capability beats validating it.

---

### 1.7 🔴 Delete `gemini/diag`; authenticate the rest · S

`app/api/gemini/diag/route.ts:22` publicly returns the API key's prefix, suffix and length.

**Do:** Delete the route entirely. Add auth to `gemini/{extract,test,variations}` and `ocr/parse` —
they are open proxies onto metered APIs.

---

### 1.8 🟡 Role-check the machine registry GET · S

**File:** `app/api/machine/register/route.ts`

POST and DELETE check for professor/admin. GET does not — any student can dump every
fingerprint hash and seat position.

---

### 1.9 🟡 Make the storage buckets private · M

**Depends on:** 1.6

**Files:** `app/supabase/migrations/008_*.sql`, `009_*.sql`, `app/dashboard/actions.ts`

All three buckets are public, so exam papers are readable by URL before the exam. Current policies
also let any authenticated user write.

**Do:** Private buckets, short-lived signed URLs, path-derived ownership policies. Question banks
live at `question_banks/<quizId>/<ts>.json`, so the quiz id is path segment 2 and joins back to
the owning professor — a worked policy is in the comments of `009_storage_policies.sql`.

⚠️ This breaks upload and extract if done before 1.6.

---

### 1.10 🟡 Stop logging student PII · S

**File:** `app/api/integrity/tab/route.ts:136` — writes `user_id` and visited URL to server logs.

---

# Phase 2 — Correctness

**Gated by 2.1.** Phase 1 protects a system that does not yet do what it claims.

### 2.1 🔴 Decide which variant system is authoritative · L

**This is a design decision. Bring options to the user; do not choose unilaterally.**

Two mechanisms coexist and contradict:

| | Seat-based | Variations file |
|---|---|---|
| Source | `lib/seating.ts` Latin square | `variations/<quizId>.json` |
| Selection | row/column | `Math.random()` |
| Stored | `session_participants.variant_index` | `generated_questions` |
| Consumed by | **nothing** | the quiz page |

**Recommendation:** the seat-based route is what the thesis requires. `variant_index` should index
into the variations file instead of `Math.random()` choosing. Use `grill-me` to run this decision
with the user if it is not obvious.

**Done when:** two students in adjacent seats demonstrably receive different questions, and the
same student re-joining receives the same ones.

---

### 2.2 🔴 Fix the multiplier and centralise the formula · M

**Depends on:** 2.1

`app/lib/seating.ts:35`
```ts
return ((row * 3) + column) % totalVariants;
```

The hardcoded `3` makes the square collapse when `totalVariants === 3`: `row * 3 ≡ 0 (mod 3)`,
so the row term cancels and **vertical neighbours get identical papers**. The docstring's own
worked example (lines 25–31) is for 4 variants and does not match the code.

Duplicated in four places, three of which disagree on the default:

| Location | Multiplier | Default variants |
|---|---|---|
| `app/lib/seating.ts:35` | `3` | caller-supplied |
| `app/api/machine/identify/route.ts:55` | `3` | **3** |
| `app/dashboard/machines/page.tsx:390` | `3` | **3** hardcoded modulus too |
| `005_create_machine_registry.sql:92` | `3` | **3** |
| `app/dashboard/quiz/[id]/session/page.tsx:48` | — | **4** |

**Do:** The multiplier must be `totalVariants`, not a constant. One definition, server-side; all
others call it. Delete the other three copies.

**Done when:** a unit test asserts no two orthogonally adjacent seats share a variant, for
`totalVariants` 2 through 8, on a 6×6 grid.

---

### 2.3 🔴 Assign variants server-side · M

**Depends on:** 2.2

`app/dashboard/quiz/[id]/join/page.tsx:185` — the **client** writes its own `variant_index` into
`session_participants`. Line 272 then passes it in a URL query parameter.

**Do:** Server computes and persists the variant. Client never sends it, never reads it from the URL.

---

### 2.4 🟡 Remove the join race condition · S

`app/dashboard/actions.ts:308`

The atomic RPC `create_submission_if_space` is correct, but a JS fallback does count-then-insert.
Two students racing both pass, and `max_participants` is exceeded — the fallback silently defeats
the RPC's entire purpose.

**Do:** Delete the fallback. Fail loudly if the RPC is absent.

---

### 2.5 🟡 Crypto join codes with collision handling · S

`app/dashboard/actions.ts:9` — `generateJoinCode()` uses `Math.random()` with no retry despite a
unique constraint on `courses.join_code`.

---

### 2.6 🟡 Provide a way to grant the professor role · M

`004_admin_role_and_audit.sql:37` — the trigger issues only `admin` (one hardcoded email) or
`student`. `'professor'` is read in 14 places and written in none.

**Do:** Expose role assignment through the admin console, behind the checks from 1.2.

---

# Phase 3 — Structure

Every Phase 1 issue has one root cause: **there is no service layer.** Pages call
`supabase.from(...)` directly, so there is no single place where "may this user do this?" gets
answered — which is why it got answered differently, or not at all, in each file.

Patching Phase 1 without this leaves the same shape and the bugs regrow.

### 3.1 🔴 Introduce a service layer · L

```
app/lib/modules/
  identity/     auth, roles, profile
  courses/      enrolment, rosters
  quizzes/      authoring, question banks
  sessions/     seating, variants, join
  integrity/    tab logs, fingerprints, machine registry
  grading/
```

Each module: `service.ts` (rules + authorization), `repository.ts` (the only code touching
Supabase for those tables), `types.ts`. Route handlers and server actions become thin.

**Pilot with `sessions/`** — it owns the variant logic from Phase 2, so the two efforts reinforce
each other instead of competing for the same files.

---

### 3.2 🔴 Enforce the boundary with a lint rule · S

**Depends on:** 3.1

One mechanically checkable rule makes the layer real rather than decorative:

> `supabase.from('<table>')` may appear only inside that table's repository.

Without enforcement the boundary erodes within weeks. Use `no-restricted-syntax`.

---

### 3.3 🟡 Decompose the dashboard page · L

`app/dashboard/page.tsx` — **1,582 lines**, holding 43 of the codebase's 170 type escapes.
Over the thermo-nuclear 1,000-line threshold.

Also over 480 lines: `quiz/[id]/page.tsx` (850), `results/[quizId]/page.tsx` (820),
`quiz/[id]/session/page.tsx` (612), `quiz/[id]/edit/page.tsx` (557).

---

### 3.4 🟢 Delete dead code · S

- `extension/fingerprint.js` — **never called.** `content.js:32` reimplements the whole hash
  inline and the two copies have already drifted (`window.screen.devicePixelRatio` vs
  `window.devicePixelRatio`). Two divergent copies of a hash that must be byte-stable is a latent
  fingerprint-invalidation bug, not clutter.
- `app/QUIZ_PAGE_INTEGRATION_EXAMPLE.tsx` — example code shipping as source
- `app/lib/extensionHelper.ts` — roughly half is commented-out example
- `app/components/tutorial/*`, `deploy-button`, `next-logo`, `supabase-logo` — starter boilerplate
- ~20 scratchpad markdown files in `app/`

---

# Phase 4 — Cost and performance

### 4.1 🟡 Two of four Gemini models do not exist · S

`app/api/gemini/extract/route.ts:66`

```ts
const models = ["gemini-3-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"];
```

Verified live against the project key on 2026-09-22:

| Model | Exists |
|---|---|
| `gemini-3-flash` | ❌ (`gemini-3-flash-preview` does) |
| `gemini-2.5-flash-lite` | ✅ |
| `gemini-2.5-flash` | ✅ |
| `gemini-1.5-flash` | ❌ retired |

The dead model is **first**, and line 80 retries each model three times with `800 * (attempt + 1)`
backoff. Every extraction burns 3 failed calls and **4.8 s of sleeping** before a working model is
tried.

**Do:** Drop the dead entries. Do not retry a 404 — a missing model will not appear on attempt two.
Also check `gemini-1.5-pro` at line ~116, likely retired too.

**Verify:**
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
  | grep -o '"name": *"models/[^"]*"'
```

---

### 4.2 🟡 Dashboard analytics is N+1 over the network · M

`app/dashboard/page.tsx:1248–1268`

Queries all courses → quizzes per course → submissions per course → **then downloads a storage
file per submission**, sequentially, in a client component. Ten courses × twenty submissions is
200+ round trips for one chart.

**Root cause:** grades live in storage JSON (`grades/<submissionId>.json`), not a database column,
so aggregation is impossible in SQL.

**Do:** Move `total_score` into a `submissions` column. The chart becomes one query.
See `.agents/skills/code-review-skill/reference/cross-cutting/n-plus-one-queries.md`.

---

# Phase 5 — Types, tests, hygiene

Ride these along with Phase 3 rather than treating them as separate work.

### 5.1 🟡 170 type escapes across 20 files · L
Densest in `app/dashboard/page.tsx` (43), so this lands naturally with 3.3.

### 5.2 🟡 No executing tests · L
`app/testsprite_tests/` holds JSON plans, not runnable tests.
**Start with `calculateVariantIndex`** — a four-line test would have caught the `* 3` collapse.
The variant formula, seat assignment and join race are all pure logic and trivially testable.

### 5.3 🟢 76 console statements · S
Including PII (1.10). Replace with a level-aware logger.

### 5.4 🟢 `.env.example` contradicts the code · S
Declares `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; code reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
A fresh clone fails silently.

---

# Track B — Chrome extension

Independent of the backend phases; shares no code. **Everything here is invisible locally**,
because the hardcoded dev origin happens to be correct on a developer machine.

### B.1 🔴 Hardcoded to `http://localhost:3003` · S
`extension/background.js:9`. In production nothing is sent and the content script never injects —
the entire monitoring feature is inert.

### B.2 🔴 Any `*.vercel.app` page can disarm it · S
`extension/manifest.json:42` — `externally_connectable` matches the wildcard, so an
attacker-deployed page can send `resetState`. The app deploys to **Netlify** and no Netlify origin
is listed at all.

### B.3 🟡 Three ways for a student to disarm monitoring · M
Dashboard visit auto-disarms (`background.js:110`), the popup has a plain Disarm button
(`popup.js:67`), plus B.2. Whether this matters depends on the threat model — see open questions.

### B.4 🟡 No origin validation on incoming messages · S
`extension/content.js:146` listens for `window.message` with no origin check and accepts
submission and machine identifiers from any page script.

---

# Open questions — settle before Phase 1

Unanswered since the original review. Each changes how deep the work goes.
Run these with `grill-me` if the user wants to work through them properly.

1. **Threat model** — casual cheating, or a student who will edit the sideloaded extension?
   No client-side scheme survives the second. Determines whether Track B is a real defence, and
   whether the honest claim is "deters" rather than "prevents".
2. **Netlify or Vercel?** Both are configured. B.1 and B.2 cannot be fixed until one is chosen.
3. **Intended RLS posture?** Currently hybrid — defensible for a demo, indefensible deployed.
4. **Graded, and when?** With a deadline, Phase 0 plus tasks 1.1–1.5 is the defensible minimum and
   the rest becomes a documented known-limitations section — which reads far better in a defence
   than a silent hole.

---

# Suggested order

1. Settle the four open questions
2. **Phase 0 entirely** — cheapest phase, and nothing after it is verifiable without it
3. **Tasks 1.1–1.5** as direct patches — exploitable now, should not wait for a restructure
4. **Task 3.1 pilot** — build `lib/modules/sessions/` as the template
5. **Phase 2 inside that module** — the variant work and the service layer are the same work
6. Extend the module pattern outward, folding in remaining Phase 1 tasks per area
7. **Phase 4** whenever — independent, and 4.1 is a one-line change
8. **Phase 5** continuously, alongside Phase 3
