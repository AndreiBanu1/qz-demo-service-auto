# Turbo Garaj (demo 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the Turbo Garaj demo site, whose bookings, „mașina ta e gata” links and daily ITP/oil reminders run as real, logged automations that can be filmed.

**Architecture:**
- **Front end:** a Vite + React single-page app.
- **Server:** one Cloudflare Worker serving `/api/*` and, through Workers Static Assets, the built SPA. The handlers are thin, over a pure `core/` (date rules, seed, templates, guards) and `worker/` (D1 queries, notifier, job runner, jobs). Every handler gets its I/O through a `Deps` object, so tests use a real local D1 and in-memory email.
- **Scheduling:** two Cron Triggers call the same `runReminders` and `cleanup` the admin buttons call.

**Tech Stack:** Node 20, TypeScript, Vite, React 18, react-router 6, Tailwind 3, Cloudflare Workers + Static Assets + D1 + Cron Triggers, `wrangler`, Mailtrap Email Sandbox HTTP API, Vitest + Testing Library + `@cloudflare/vitest-pool-workers`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-demo-service-auto-design.md` (in the quality-zone repo). Read it before starting. Hosting changed from Netlify to Cloudflare on 2026-11-11.

## Global Constraints

- **Repo:** `~/Documents/Proiecte/qz-demo-service-auto`, a new git repo. Worker name and D1 database name: `turbo-garaj-demo`, at `https://turbo-garaj-demo.<subdomain>.workers.dev`. Local: `http://127.0.0.1:8787`.
- **No Cloudflare account actions** (creating the D1 database, setting secrets, `wrangler deploy`, `--remote` commands) until the user says yes at Task 12, Step 3. Everything before that runs locally.
- **Copy:** all visible copy is Romanian, addressing the reader as „tu”, with no jargon. Code, comments and README are in English. Use real diacritics (ă, â, î, ș, ț with comma below).
- **Banner:** every page shows the banner „Site demonstrativ realizat de Quality Zone”, linking to `https://qualityzone.netlify.app/ro`.
- **Indexing:** `<meta name="robots" content="noindex, nofollow">` in `index.html`, and `X-Robots-Tag: noindex, nofollow` on every response: from `public/_headers` for static files and from `withHeaders` for Worker responses. `public/robots.txt` is `User-agent: *` / `Allow: /`.
- **No contact details:** no phone numbers, street addresses, maps, reviews, testimonials or invented clients anywhere.
- **Email recipients:** only addresses matching `/^[^\s@]+@[^\s@]+\.test$/` after trim and lowercase. Rejection copy: „În demo folosește o adresă de test, de exemplu ion@turbo-garaj.test.”
- **Email budget:** `EMAIL_BUDGET_CAP = 40` sandbox emails per Bucharest calendar month. Over the cap, the outcome is `netrimis-limita` („netrimis: limita lunară a sandbox-ului”).
- **SMS:** SMS never touches the network. Outcome `simulat`, label „SMS (simulare, netrimis)”.
- **Time:** all calendar logic uses the `Europe/Bucharest` date as a `YYYY-MM-DD` string. Stored timestamps are ISO UTC.
- **Cron Triggers:** reminders `0 5 * * *`; cleanup `0 2 * * *` (both UTC).
- **Workers runtime:** use Web Crypto (`crypto.subtle`, `crypto.getRandomValues`), not `node:crypto`, and don't enable `nodejs_compat`. Keep request work I/O-bound (the free plan allows 10 ms of CPU).
- **Retention:** admin-created bookings and cars are deleted after 7 days; log entries after 30 days.
- **Admin session:** an HttpOnly, Secure, SameSite=Strict cookie named `tg_admin`, valid for 8 hours, signed with HMAC-SHA256. Lockout: 5 failures within 15 minutes locks login.
- **Environment:** the secrets `ADMIN_PASSWORD`, `SESSION_SECRET`, `MAILTRAP_API_TOKEN` and `MAILTRAP_INBOX_ID` (`wrangler secret put` in production, `.dev.vars` locally, git-ignored), and the `[vars]` `MAIL_MODE` (`sandbox` | `memory`) and `SITE_URL`. Never commit real values. Commit `.dev.vars.example` with placeholders only.
- **Errors:** API errors are JSON `{ "error": "<Romanian message>" }` and never include a stack trace.

## Review Focus

1. **Bucharest midnight vs UTC.** A run at 22:30 UTC on 10 November is already 11 November in Bucharest, and the reminder maths must use 11 November. Tested in Task 3 (`todayInBucharest`).
2. **„Rulează acum” pressed twice, pressed after this morning's cron, or pressed while the cron is running.** The second run must send nothing and log `nimic-de-trimis`, and two runs at the same moment must send each reminder once. Tested in Task 7 (`second run sends nothing`, `concurrent runs send each reminder once`); the button is also disabled while a request is in flight (Task 10).
3. **Status links that no longer work:** an unknown token, a malformed token, or a token of a deleted customer. Each gets a 404 with „Linkul nu mai e valid.” and nothing else. Tested in Task 8.
4. **Emails typed as `Ion@Turbo-Garaj.TEST `** (capitals, trailing space) are accepted and stored normalized, and `ion@gmail.com` is rejected. Tested in Task 2 and Task 7.
5. **Month rollover of the email budget:** the 31 December count must not block 1 January. Tested in Task 2 (`budgetKey`).

---

## File Structure

```
qz-demo-service-auto/
  index.html                    robots meta, lang="ro"
  wrangler.toml                 Worker, assets (./dist, SPA fallback), D1 binding DB, [vars], crons
  package.json, tsconfig*.json, vite.config.ts, tailwind.config.js, postcss.config.js
  vitest.config.ts, playwright.config.ts, .dev.vars.example, README.md
  public/robots.txt  public/_headers
  migrations/0001_init.sql      (Task 7)
  core/                         pure, no I/O
    types.ts                    shared types (Task 2)
    recipients.ts  budget.ts    (Task 2)
    dates.ts  reminders.ts      (Task 3)
    seed.ts                     (Task 4)
    booking.ts  messages.ts     (Task 5)
    session.ts                  (Task 6)
  worker/
    db.ts  notifier.ts  deps.ts  runner.ts  jobs.ts      (Task 7)
    index.ts  http.ts  router.ts                          (Task 8)
    routes/auth.ts appointments.ts status.ts outbox.ts log.ts run-reminders.ts reset.ts   (Task 8)
  src/
    main.tsx App.tsx api.ts copy.ts
    components/Banner.tsx Layout.tsx StatusTimeline.tsx RunList.tsx
    pages/Home.tsx Programare.tsx Status.tsx Automatizari.tsx Confidentialitate.tsx Admin.tsx NotFound.tsx
  tests/core/*.test.ts  tests/worker/*.test.ts  tests/ui/*.test.tsx
  e2e/*.spec.ts
```

---

### Task 1: Scaffold, banner, noindex

**Files:**
- Create: everything at the top level listed above, plus `src/main.tsx`, `src/App.tsx`, `src/copy.ts`, `src/components/Banner.tsx`, `src/components/Layout.tsx`, `src/pages/NotFound.tsx`
- Test: `tests/ui/layout.test.tsx`

**Interfaces:**
- Produces:
  - `<Layout>` (renders `<Banner>` above `children`, and a footer linking to `/confidentialitate` and `/automatizari`)
  - `copy` (a typed object of Romanian strings, which later tasks extend)
  - Router routes `/`, `/programare`, `/status/:token`, `/automatizari`, `/confidentialitate`, `/admin`, `*`, with placeholder pages that later tasks replace

- [ ] **Step 1:** In the new repo folder, run `git init` and create a Vite React-TS app. Add Tailwind, react-router-dom 6, Vitest, @testing-library/react, jsdom, @playwright/test, wrangler, @cloudflare/workers-types and @cloudflare/vitest-pool-workers (dev dependencies). Git-ignore `.dev.vars`, `.wrangler/`, `dist/`.
- [ ] **Step 2:** Write the `wrangler.toml` (the cron triggers come in Task 8) and `public/_headers`:

```toml
name = "turbo-garaj-demo"
main = "worker/index.ts"
compatibility_date = "2026-11-01"
[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
[[d1_databases]]
binding = "DB"
database_name = "turbo-garaj-demo"
database_id = "local-placeholder"   # replaced with the real id at Task 12
migrations_dir = "migrations"
[vars]
MAIL_MODE = "memory"
SITE_URL = "http://127.0.0.1:8787"
```

```
/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
```

Add a minimal `worker/index.ts` that returns `env.ASSETS.fetch(req)` for every request (Task 8 replaces it).

- [ ] **Step 3: Write the failing test.** `tests/ui/layout.test.tsx`: `renders the demo banner` renders `<Layout><p>x</p></Layout>` in a MemoryRouter, then:
  - expects the text `Site demonstrativ realizat de Quality Zone`
  - expects the link `href` to be `https://qualityzone.netlify.app/ro`
- [ ] **Step 4:** Run `npx vitest run tests/ui/layout.test.tsx`. Expected: FAIL, because Layout doesn't exist yet.
- [ ] **Step 5:** Implement `Banner`, `Layout`, `App` routes and `NotFound` („Pagina nu există.”). In `index.html`, set `lang="ro"`, the robots meta, and `<title>Turbo Garaj (demo)</title>`. Write `public/robots.txt` and `.dev.vars.example`.
- [ ] **Step 6:** Run `npx vitest run`, `npm run build`, then `npx wrangler dev --ip 127.0.0.1 --port 8787` and `curl -sI http://127.0.0.1:8787/programare`. Expected: the test passes, the build exits 0, and curl shows `200` with `x-robots-tag: noindex, nofollow`.
- [ ] **Step 7:** Commit with `chore: scaffold Turbo Garaj demo with banner and noindex`.

### Task 2: Shared types, test-address guard, email budget

**Files:**
- Create: `core/types.ts`, `core/recipients.ts`, `core/budget.ts`
- Test: `tests/core/recipients.test.ts`, `tests/core/budget.test.ts`

**Interfaces:**
- Produces, in `core/types.ts`:

```ts
export type IsoDate = string; // 'YYYY-MM-DD', Bucharest calendar
export type Status = 'primita' | 'in-lucru' | 'gata' | 'predata';
export type Work = 'revizie' | 'ulei' | 'itp' | 'frane' | 'diagnoza';
export type Appointment = { id: string; token: string; firstName: string; email: string;
  car: { make: string; model: string }; work: Work; preferredDate: IsoDate; status: Status;
  createdAt: string; updatedAt: string; seed: boolean };
export type Car = { id: string; appointmentId?: string; firstName: string; email: string; make: string;
  model: string; itpExpiry?: IsoDate; lastOilChange?: IsoDate; remindersAccepted: boolean; seed: boolean;
  createdAt: string };
export type ReminderType = 'itp' | 'ulei';
export type Threshold = 30 | 7 | 14;
export type DueReminder = { carId: string; type: ReminderType; threshold: Threshold; daysLeft: number;
  key: string; alsoMarkSent: string[] };
export type Job = 'confirmare-programare' | 'masina-gata' | 'remindere-zilnice' | 'curatenie';
export type Trigger = 'cron' | 'buton' | 'formular' | 'schimbare-status';
export type Outcome = 'trimis-sandbox' | 'simulat' | 'netrimis-limita' | 'eroare';
export type Channel = 'email' | 'sms-simulat';
export type RunItem = { channel: Channel; to: string; subject: string; outcome: Outcome; error?: string };
export type Run = { id: string; job: Job; trigger: Trigger; startedAt: string; finishedAt: string;
  durationMs: number; result: 'ok' | 'eroare' | 'nimic-de-trimis'; items: RunItem[]; error?: string };
export type OutboxMessage = { id: string; runId: string; channel: Channel; to: string; subject: string;
  body: string; outcome: Outcome; createdAt: string; appointmentId?: string };
```

- Produces, in `core/recipients.ts`:
  - `normalizeEmail(s: string): string` (trim, lowercase)
  - `isTestAddress(s: string): boolean` (normalizes first)
  - `maskEmail(s: string): string`
- Produces, in `core/budget.ts`:
  - `EMAIL_BUDGET_CAP = 40`
  - `budgetKey(now: Date): string`, which returns `email-budget-YYYY-MM` for the Bucharest month
  - `canSendEmail(used: number, cap = EMAIL_BUDGET_CAP): boolean`

- [ ] **Step 1: Write the failing tests.**
  - `isTestAddress`:
    - `'ion@turbo-garaj.test'` → true
    - `'Ion@Turbo-Garaj.TEST '` → true
    - `'ion@gmail.com'` → false
    - `'ion@test'` → false
    - `'@x.test'` → false
    - `'a b@x.test'` → false
  - `normalizeEmail('Ion@Turbo-Garaj.TEST ')` → `'ion@turbo-garaj.test'`
  - `maskEmail('ion@turbo-garaj.test')` → `'i***@turbo-garaj.test'`
  - `canSendEmail`: `(39)` → true, `(40)` → false
  - `budgetKey`:
    - `new Date('2026-12-31T21:30:00Z')` → `'email-budget-2027-01'` (already 1 January in Bucharest)
    - `new Date('2026-12-31T21:00:00Z')` → `'email-budget-2026-12'` (Bucharest time 23:00)
- [ ] **Step 2:** Run `npx vitest run tests/core`. Expected: FAIL, because the modules aren't there yet.
- [ ] **Step 3:** Implement the functions. `budgetKey` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit' })`.
- [ ] **Step 4:** Run `npx vitest run tests/core`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(core): add types, test-address guard and email budget`.

### Task 3: Bucharest dates and reminder rules

**Files:**
- Create: `core/dates.ts`, `core/reminders.ts`
- Test: `tests/core/dates.test.ts`, `tests/core/reminders.test.ts`

**Interfaces:**
- Consumes: `Car`, `DueReminder`, `IsoDate` (Task 2)
- Produces:
  - `todayInBucharest(now: Date): IsoDate`
  - `daysBetween(from: IsoDate, to: IsoDate): number` (whole days, `to - from`)
  - `addDays(d: IsoDate, n: number): IsoDate`
  - `addMonths(d: IsoDate, n: number): IsoDate` (clamps to the last day of the month)
  - `reminderKey(carId: string, type: ReminderType, threshold: Threshold): string` → `` `${carId}:${type}:${threshold}` ``
  - `findDueReminders(cars: Car[], sentKeys: Set<string>, today: IsoDate): DueReminder[]`

**Rules, from the spec:**
- Only cars with `remindersAccepted` are checked.
- **ITP**, with `d = daysBetween(today, itpExpiry)`:
  - threshold 30 when `7 < d <= 30`
  - threshold 7 when `0 <= d <= 7`, with `alsoMarkSent = [key(itp,30)]`
  - nothing when `d < 0`
- **Oil**, with due date = `addMonths(lastOilChange, 12)` and `d = daysBetween(today, due)`: threshold 14 when `d <= 14`, including negative values.
- A reminder whose `key` is in `sentKeys` is skipped.

- [ ] **Step 1: Write the failing tests.**
  - `todayInBucharest(new Date('2026-11-10T22:30:00Z'))` → `'2026-11-11'`
  - `todayInBucharest(new Date('2026-07-01T20:59:00Z'))` → `'2026-07-01'`
  - `addMonths('2025-01-31', 1)` → `'2025-02-28'`
  - `addMonths('2024-02-29', 12)` → `'2025-02-28'`
  - `daysBetween('2026-03-28', '2026-03-30')` → `2` (across the DST change)
  - Each test below uses `today = '2026-11-10'` and a car `c1` with reminders accepted:
    - ITP on `2026-12-10` (d = 30) → one reminder `{ type: 'itp', threshold: 30, key: 'c1:itp:30' }`
    - ITP on `2026-12-11` (d = 31) → `[]`
    - ITP on `2026-11-17` (d = 7) → threshold 7, `alsoMarkSent: ['c1:itp:30']`
    - ITP on `2026-11-10` (d = 0) → threshold 7
    - ITP on `2026-11-09` → `[]`
    - oil last changed `2025-11-24` (due `2026-11-24`, d = 14) → `{ type: 'ulei', threshold: 14 }`
    - oil last changed `2025-11-25` → `[]`
    - oil last changed `2025-01-01` (overdue) → threshold 14, `daysLeft < 0`
    - `remindersAccepted: false` → `[]`
    - key already in `sentKeys` → `[]`
- [ ] **Step 2:** Run `npx vitest run tests/core/dates.test.ts tests/core/reminders.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Do the date arithmetic on `Date.UTC(y, m-1, d)` values divided by 86 400 000, never on local time.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(core): add Bucharest dates and reminder rules`.

### Task 4: Demo seed

**Files:**
- Create: `core/seed.ts`
- Test: `tests/core/seed.test.ts`

**Interfaces:**
- Consumes: `addDays`, `addMonths`, `daysBetween`, `findDueReminders` (Task 3), `Car` (Task 2)
- Produces:
  - `SEED_IDS = ['seed-1', 'seed-2', 'seed-3'] as const`
  - `buildSeed(today: IsoDate, createdAt: string): Car[]`

**The seed:** three cars, all `seed: true`, all `remindersAccepted: true`, all on `.test` emails.

| id | Person and car | Dates |
|---|---|---|
| `seed-1` | Mihai, `mihai@turbo-garaj.test`, Dacia Logan | The day's due reminder. Even day of the year: `itpExpiry = today + 30`, `lastOilChange = today − 3 months`. Odd day: `lastOilChange = addMonths(today, −12) + 10 days`, `itpExpiry = today + 200` |
| `seed-2` | Elena, `elena@turbo-garaj.test`, Skoda Octavia | Idle: `itpExpiry = today + 120`, `lastOilChange = today − 2 months` |
| `seed-3` | Radu, `radu@turbo-garaj.test`, Volkswagen Golf | Idle: `itpExpiry = today + 300`, `lastOilChange = today − 5 months` |

The odd-day oil date has to give an oil due date within 14 days, and the even-day `lastOilChange` must not.

- [ ] **Step 1: Write the failing tests.**
  - `exactly one reminder is due on every day of a year`: for each of the 366 days starting at `'2027-01-01'`, `findDueReminders(buildSeed(day, iso), new Set(), day).length === 1`. This range covers a non-leap February and both DST changes.
  - `seed uses only test addresses`: every email passes `isTestAddress`.
  - `ids are stable`: `buildSeed(...).map(c => c.id)` deep-equals `SEED_IDS`.
- [ ] **Step 2:** Run `npx vitest run tests/core/seed.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `buildSeed` from the table above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(core): add daily demo seed with exactly one due reminder`.

### Task 5: Booking validation and message templates

**Files:**
- Create: `core/booking.ts`, `core/messages.ts`
- Test: `tests/core/booking.test.ts`, `tests/core/messages.test.ts`

**Interfaces:**
- Consumes: `isTestAddress`, `normalizeEmail` (Task 2); `Appointment`, `Car`, `DueReminder`, `Work`, `Status` (Task 2)
- Produces:
  - `type BookingInput = { firstName: string; email: string; make: string; model: string; work: Work; preferredDate: IsoDate; itpExpiry?: IsoDate; lastOilChange?: IsoDate; remindersAccepted: boolean }`
  - `validateBooking(input: unknown, today: IsoDate): { ok: true; value: BookingInput } | { ok: false; error: string }` (trims strings and normalizes the email)
  - `WORK_LABELS: Record<Work, string>` = revizie „Revizie”, ulei „Schimb de ulei”, itp „Pregătire ITP”, frane „Frâne”, diagnoza „Diagnoză”
  - `STATUS_LABELS: Record<Status, string>` = primita „Primită”, in-lucru „În lucru”, gata „Gata de ridicare”, predata „Predată”
  - `type Message = { subject: string; text: string }`
  - `bookingConfirmation(a: Appointment, statusUrl: string): Message`
  - `serviceNotification(a: Appointment): Message`
  - `carReady(a: Appointment, statusUrl: string): Message`
  - `carReadySms(a: Appointment, statusUrl: string): Message`
  - `reminderEmail(c: Car, r: DueReminder): Message`
  - `reminderSms(c: Car, r: DueReminder): Message`
  - `FOOTER`

**Validation errors (exact copy):**
- firstName with fewer than 2 or more than 40 characters → „Scrie un prenume între 2 și 40 de caractere.”
- an email that isn't a test address → the rejection copy from Global Constraints
- an empty make or model → „Completează marca și modelul.”
- an unknown work type → „Alege tipul lucrării.”
- a preferredDate missing or before today → „Alege o dată de azi încolo.”
- a malformed optional date → „Data nu e validă.”

**Subjects (exact copy):**
- `bookingConfirmation`: „Programarea ta la Turbo Garaj a fost primită”
- `serviceNotification`: „Programare nouă: {make} {model}, {preferredDate}”
- `carReady`: „Mașina ta e gata”
- `reminderEmail`, ITP: „Reminder: ITP-ul expiră în {daysLeft} zile” (when `daysLeft === 0`: „Reminder: ITP-ul expiră azi”)
- `reminderEmail`, oil: „Reminder: e timpul pentru schimbul de ulei”

**Bodies:** each body greets with „Salut, {firstName}!”. Every body ends with `FOOTER` = „Mesaj demonstrativ trimis de site-ul Turbo Garaj, realizat de Quality Zone. Service-ul nu există.” SMS texts stay under 160 characters, excluding the URL.

- [ ] **Step 1: Write the failing tests.**
  - one test per validation error, asserting the exact copy
  - a valid input with email `' Ion@Turbo-Garaj.TEST'` returns `value.email === 'ion@turbo-garaj.test'`
  - `bookingConfirmation` and `carReady` texts contain the statusUrl
  - every template's text ends with `FOOTER`
  - the ITP reminder subject with `daysLeft` 7 is `'Reminder: ITP-ul expiră în 7 zile'`
  - `carReadySms(...).text.replace(url, '').length < 160`
- [ ] **Step 2:** Run `npx vitest run tests/core/booking.test.ts tests/core/messages.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(core): add booking validation and Romanian message templates`.

### Task 6: Admin session and lockout

**Files:**
- Create: `core/session.ts`
- Test: `tests/core/session.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_TTL_MS = 8 * 3600_000`
  - `LOCKOUT_WINDOW_MS = 15 * 60_000`
  - `LOCKOUT_MAX = 5`
  - `signSession(expiresAt: number, secret: string): Promise<string>` → `` `${expiresAt}.${base64url(hmacSha256(secret, String(expiresAt)))}` ``
  - `verifySession(token: string | undefined, secret: string, now: number): Promise<boolean>` (verifies with `crypto.subtle.verify`, which compares in constant time)
  - `passwordMatches(given: string, expected: string): Promise<boolean>` (constant-time XOR comparison of the two SHA-256 digests)
  - `isLockedOut(failures: number[], now: number): boolean` (true when `failures.filter(t => now - t < LOCKOUT_WINDOW_MS).length >= LOCKOUT_MAX`)

- [ ] **Step 1: Write the failing tests.**
  - a token signed with `exp = now + 1000` verifies
  - the same token at `now + 1001` fails
  - a token with its expiry changed fails
  - a token signed with another secret fails
  - `undefined` and `'garbage'` fail
  - `passwordMatches('a', 'a')` → true; `('a', 'b')` → false; `('', 'a')` → false
  - `isLockedOut` with 4 failures in the window → false
  - `isLockedOut` with 5 failures in the window → true
  - `isLockedOut` with 5 failures where the oldest is 15 minutes 1 second old → false
- [ ] **Step 2:** Run `npx vitest run tests/core/session.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with Web Crypto (`crypto.subtle` HMAC-SHA256 and SHA-256), which works both in Node 20 tests and in the Workers runtime.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(core): add signed admin session and login lockout`.

### Task 7: D1 schema, notifier, job runner and jobs

**Files:**
- Create: `migrations/0001_init.sql`, `worker/db.ts`, `worker/notifier.ts`, `worker/deps.ts`, `worker/runner.ts`, `worker/jobs.ts`
- Modify: `vitest.config.ts` (add a `workers` project using `@cloudflare/vitest-pool-workers`, reading `wrangler.toml`, with migrations applied in a setup file via `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`)
- Test: `tests/worker/notifier.test.ts`, `tests/worker/jobs.test.ts`, `tests/worker/helpers.ts` (`testDeps(overrides?)`: `env.DB` from `cloudflare:test`, memory email, fixed clock, deterministic ids; every test starts from empty tables)

**Interfaces:**
- Consumes: everything in `core/`
- Produces:

```ts
// db.ts — the only file with SQL; every function takes the D1Database first
export function insertAppointment(db: D1Database, a: Appointment): Promise<void>;
export function getAppointment(db: D1Database, id: string): Promise<Appointment | null>;
export function getAppointmentByToken(db: D1Database, token: string): Promise<Appointment | null>;
export function listAppointments(db: D1Database): Promise<Appointment[]>;          // newest first
export function updateAppointmentStatus(db: D1Database, id: string, s: Status, at: string): Promise<boolean>;
export function insertCar(db: D1Database, c: Car): Promise<void>;
export function listReminderCars(db: D1Database): Promise<Car[]>;                  // reminders_accepted = 1
export function claimReminder(db: D1Database, key: string, at: string): Promise<boolean>; // INSERT … ON CONFLICT DO NOTHING RETURNING key
export function releaseReminder(db: D1Database, key: string): Promise<void>;
export function listSentKeys(db: D1Database): Promise<Set<string>>;
export function reserveEmail(db: D1Database, month: string, cap: number): Promise<boolean>; // upsert row, then UPDATE … WHERE used < cap RETURNING used
export function releaseEmail(db: D1Database, month: string): Promise<void>;
export function emailsUsed(db: D1Database, month: string): Promise<number>;
export function insertOutbox(db: D1Database, m: OutboxMessage): Promise<void>;
export function listOutbox(db: D1Database, limit: number): Promise<OutboxMessage[]>;
export function insertRun(db: D1Database, r: Run): Promise<void>;
export function listRuns(db: D1Database, limit: number): Promise<Run[]>;           // newest first
export function recordLoginFailure(db: D1Database, at: number): Promise<void>;
export function recentLoginFailures(db: D1Database, since: number): Promise<number[]>;
export function deleteAppointmentCascade(db: D1Database, id: string, maskedTo: string): Promise<boolean>; // one db.batch
export function purgeOld(db: D1Database, dataBefore: string, runsBefore: string): Promise<void>;        // one db.batch
export function wipeAll(db: D1Database): Promise<void>;     // every table except email_budget, one db.batch
export function replaceSeed(db: D1Database, cars: Car[]): Promise<void>; // delete seed cars + 'seed-%' keys, insert, one db.batch
// notifier.ts
export type Email = { to: string; subject: string; text: string };
export interface EmailSender { send(e: Email): Promise<void> }   // throws on failure
export function createMailtrapSandbox(o: { token: string; inboxId: string; fetchFn?: typeof fetch }): EmailSender;
export function createMemoryEmail(): EmailSender & { sent: Email[]; failNext(msg: string): void };
// deps.ts
export type Env = { DB: D1Database; ASSETS: Fetcher; MAIL_MODE: 'sandbox' | 'memory'; SITE_URL: string;
  ADMIN_PASSWORD: string; SESSION_SECRET: string; MAILTRAP_API_TOKEN?: string; MAILTRAP_INBOX_ID?: string };
export type Deps = { db: D1Database; email: EmailSender; now: () => Date; siteUrl: string;
  newId: () => string; newToken: () => string; adminPassword: string; sessionSecret: string };
export function createDeps(env: Env): Deps;   // MAIL_MODE picks sandbox | memory; throws if sandbox and the token or inbox id is missing
// runner.ts
export type RunContext = { runId: string;
  sendEmail(to: string, m: Message, appointmentId?: string): Promise<Outcome>;
  sendSmsPreview(to: string, m: Message, appointmentId?: string): Promise<Outcome> };
export function runJob(deps: Deps, job: Job, trigger: Trigger, fn: (ctx: RunContext) => Promise<void>): Promise<Run>;
// jobs.ts
export function statusUrl(deps: Deps, token: string): string;          // `${siteUrl}/status/${token}`
export function createBooking(deps: Deps, input: BookingInput): Promise<{ appointment: Appointment; run: Run }>;
export function setStatus(deps: Deps, id: string, status: Status): Promise<{ appointment: Appointment; run?: Run } | null>;
export function runReminders(deps: Deps, trigger: 'cron' | 'buton'): Promise<Run>;
export function cleanup(deps: Deps, trigger: 'cron' | 'buton', mode: 'nightly' | 'reset'): Promise<Run>;
export function deleteCustomer(deps: Deps, appointmentId: string): Promise<boolean>;
export function recentRuns(deps: Deps, limit?: number): Promise<Run[]>; // default 50
export function outboxWithBudget(deps: Deps): Promise<{ messages: OutboxMessage[]; used: number; cap: number }>;
export const SERVICE_EMAIL = 'service@turbo-garaj.test';
```

**Schema:** the seven tables and columns from spec §6. Add `CREATE INDEX` on `runs(started_at)` and `outbox(created_at)`. `cars.appointment_id` references `appointments(id) ON DELETE CASCADE`. Booleans are `INTEGER` 0/1, dates are `TEXT`, and `runs.items` is JSON `TEXT`. Map snake_case rows to the camelCase types in `db.ts` only.

**Behaviour:**
- **Mailtrap sandbox:** POST `https://sandbox.api.mailtrap.io/api/send/${inboxId}` with headers `Authorization: Bearer ${token}` and `Content-Type: application/json`, and body `{ from: { email: 'robot@turbo-garaj.test', name: 'Turbo Garaj (demo)' }, to: [{ email }], subject, text }`. A non-2xx response throws an Error carrying the status. Check the endpoint and auth header against Mailtrap's current sandbox API docs before coding; this URL is the only send URL in the codebase.
- **`sendEmail`:**
  - A recipient that isn't a test address gets outcome `eroare`, error „adresă care nu e de test”, and is never sent.
  - Otherwise it calls `reserveEmail(db, monthOf(budgetKey(now)), EMAIL_BUDGET_CAP)`. False means outcome `netrimis-limita`. True means it calls `email.send`: success gives `trimis-sandbox`; a throw calls `releaseEmail` and gives `eroare` with the error message.
  - In every case it writes an outbox row and pushes a `RunItem` with a masked recipient.
- **`sendSmsPreview`:** always writes the outbox with outcome `simulat`, and its RunItem shows `to: 'telefon de test'`.
- **`runJob`:**
  - Times the run and catches a throw from `fn`, which gives `result: 'eroare'` and `error` set to the message.
  - Otherwise: no items → `nimic-de-trimis`; any item `eroare` → `eroare`; anything else → `ok`.
  - Saves the run with `insertRun` and returns it.
- **`createBooking`:** inserts the Appointment (`status: 'primita'`, `seed: false`). When `remindersAccepted` is set or either date is given, it also inserts a Car linked by `appointmentId`. Then it runs `confirmare-programare` with trigger `formular`: a confirmation email to the customer and a notification to `SERVICE_EMAIL`.
- **`setStatus`:** returns null for an unknown id. Moving to `gata` runs `masina-gata` with trigger `schimbare-status`: an email plus an SMS preview.
- **`runReminders`:**
  - Calls `findDueReminders(await listReminderCars(db), await listSentKeys(db), todayInBucharest(now))`.
  - For each reminder: `claimReminder(key)`. False means another run took it, so skip. True means send the email and the SMS preview. On email `eroare`, call `releaseReminder(key)` so the next run retries. Otherwise also claim every key in `alsoMarkSent`.
- **`cleanup`:**
  - `nightly` calls `purgeOld`, which deletes non-seed appointments (cascading to cars) and their outbox rows with `created_at` older than 7 days, and runs older than 30 days.
  - `reset` calls `wipeAll`.
  - Both then call `replaceSeed(buildSeed(today))`.
  - Job `curatenie`. It sends nothing, so the result is `nimic-de-trimis`. That's acceptable: the log shows it ran.
- **`deleteCustomer`:** `deleteAppointmentCascade` deletes the appointment, its car and its outbox rows, and rewrites `runs.items` so any item whose `to` equals the masked email becomes `'(șters)'`, all in one batch. Returns false for an unknown id.

- [ ] **Step 1: Write the failing tests** with `testDeps` (`now = 2026-11-10T06:00:00Z`):
  - **Mailtrap sandbox:** with a stub `fetchFn`, `createMailtrapSandbox` posts to `https://sandbox.api.mailtrap.io/api/send/123` with a Bearer header and throws on a 500.
  - **`createDeps`:** throws when `MAIL_MODE` is `sandbox` and `MAILTRAP_API_TOKEN` is missing.
  - `booking sends confirmation and service notification`: `run.items` has two emails with outcome `trimis-sandbox`, `email.sent[0].text` contains `statusUrl`, and `listOutbox` has 2 rows.
  - `booking stores normalized email`: input `'Ion@Turbo-Garaj.TEST '` is stored as `'ion@turbo-garaj.test'`.
  - `non-test recipient is never sent`: calling `ctx.sendEmail('ion@gmail.com', …)` inside `runJob` gives outcome `eroare` and `email.sent.length === 0`.
  - `car ready sends email and sms preview`: `setStatus(id, 'gata')` gives items with outcomes `['trimis-sandbox', 'simulat']`.
  - `seed day sends exactly one reminder`: after `cleanup('cron', 'reset')`, `runReminders('cron')` gives 2 items (an email and an SMS) and `result: 'ok'`.
  - `second run sends nothing`: a second `runReminders('buton')` has `result: 'nimic-de-trimis'`.
  - `concurrent runs send each reminder once`: `Promise.all([runReminders('cron'), runReminders('buton')])` after a reset gives `email.sent.length === 1` in total.
  - `failed send is retried next run`: `email.failNext('boom')` makes the first run end in `eroare`; the second run sends the reminder.
  - `budget cap`: with `email_budget` at `('2026-11', 40)`, booking items are `netrimis-limita`, `email.sent.length === 0`, and the outbox still has rows.
  - `failed send gives the budget slot back`: with `failNext`, `emailsUsed` stays 0.
  - `nightly cleanup keeps recent data and drops old`: an appointment 8 days old is gone, one 6 days old stays, and the seed cars exist.
  - `delete customer`: the appointment, car and outbox rows are gone, and earlier run items show `'(șters)'`.
  - `thrown error marks run eroare`: `runJob` with `fn` throwing `'x'` gives `{ result: 'eroare', error: 'x' }`.
- [ ] **Step 2:** Run `npx vitest run --project workers`. Expected: FAIL.
- [ ] **Step 3:** Write the migration and implement the five files. Use `db.batch([...])` wherever the Interfaces block says one batch.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all projects pass.
- [ ] **Step 5:** Commit with `feat(worker): add D1 schema, sandbox notifier, job runner and jobs`.

### Task 8: Worker entry, API routes and Cron Triggers

**Files:**
- Create: `worker/index.ts`, `worker/http.ts`, `worker/router.ts`, `worker/routes/auth.ts`, `worker/routes/appointments.ts`, `worker/routes/status.ts`, `worker/routes/outbox.ts`, `worker/routes/log.ts`, `worker/routes/run-reminders.ts`, `worker/routes/reset.ts`
- Modify: `wrangler.toml` (add `[triggers] crons = ["0 5 * * *", "0 2 * * *"]`)
- Test: `tests/worker/routes.test.ts`, `tests/worker/scheduled.test.ts`

**Interfaces:**
- Consumes: Task 6 (session), Task 7 (jobs, `Deps`, `Env`, `createDeps`, db)
- Produces:
  - `route(req: Request, deps: Deps): Promise<Response>` in `router.ts`, which matches method and path
  - each `routes/*.ts` exports handlers of the form `(req: Request, deps: Deps, params: Record<string, string>) => Promise<Response>`
  - `worker/index.ts` default export `{ fetch(req, env, ctx), scheduled(controller, env, ctx) }`:
    - `fetch`: `/api/*` goes to `route(req, createDeps(env))` wrapped by the header middleware; anything else goes to `env.ASSETS.fetch(req)`
    - `scheduled`: `controller.cron === '0 5 * * *'` runs `runReminders(deps, 'cron')`, and `'0 2 * * *'` runs `cleanup(deps, 'cron', 'nightly')`, both through `ctx.waitUntil`
  - `http.ts` has:
    - `json(body, status = 200)`
    - `fail(status, message)`
    - `withHeaders(res)` (adds `X-Robots-Tag`, `Referrer-Policy`, `X-Content-Type-Options`)
    - `isAdmin(req, deps): Promise<boolean>` (reads the `tg_admin` cookie)
    - `adminCookie(deps): Promise<string>`
    - `clearCookie(): string`

**Routes:**

| Method and path | Admin | Response |
|---|---|---|
| `POST /api/login` `{ password }` | – | Locked (`isLockedOut(recentLoginFailures)`): 429 „Prea multe încercări. Mai încearcă peste 15 minute.” Wrong password: `recordLoginFailure`, then 401 „Parolă greșită.” Right: 200 with `Set-Cookie` |
| `POST /api/logout` | – | 200 and clear the cookie |
| `GET /api/session` | – | `{ admin: boolean }` |
| `GET /api/appointments` | yes | `Appointment[]`, newest first |
| `POST /api/appointments` | yes | Invalid: 400 with the validation copy. Valid: 201 `{ appointment, statusUrl, run }` |
| `PATCH /api/appointments/:id` `{ status }` | yes | 200 or 404 |
| `DELETE /api/appointments/:id` | yes | 204 or 404 |
| `GET /api/status/:token` | – | 200 `{ firstName, car, work, status, updatedAt }` with no email and no id, or 404 „Linkul nu mai e valid.” |
| `POST /api/run-reminders` | yes | 200 `Run` |
| `POST /api/reset` | yes | 200 `Run` |
| `GET /api/outbox` | yes | `{ messages, used, cap }` |
| `GET /api/log` | – | `Run[]` (50, newest first) |
| any other `/api/*` | – | 404 „Pagina nu există.” |

Any admin route without a valid cookie returns 401 „Intră în cont ca administrator.” An unexpected error returns 500 „Ceva n-a mers. Încearcă din nou.” and is logged with `console.error`.

- [ ] **Step 1: Write the failing tests.**
  - **Routes**, calling `route(new Request('http://127.0.0.1:8787/api/...'), testDeps())`:
    - `login sets a cookie` (Set-Cookie includes `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=28800`)
    - `wrong password 401`
    - `sixth attempt in 15 min is 429`
    - `admin routes 401 without cookie` (POST appointments, run-reminders, reset, outbox)
    - `POST appointments 400 with non-test email copy`
    - `POST appointments 201 returns statusUrl`
    - `status by token hides email`: the body has no `email` and no `id` keys
    - `status unknown token 404`, `status malformed token 404`, and `status of deleted customer 404`, all with body `{ error: 'Linkul nu mai e valid.' }`
    - `log is public and masked`: no item's `to` contains a full local part
    - `api responses carry X-Robots-Tag`
  - **Scheduled**, using `createScheduledController` and `createExecutionContext` from `cloudflare:test`:
    - `0 5 cron runs reminders`: after a reset, a `remindere-zilnice` run exists with trigger `cron`
    - `0 2 cron runs cleanup`: a `curatenie` run exists with trigger `cron`
- [ ] **Step 2:** Run `npx vitest run --project workers`. Expected: FAIL.
- [ ] **Step 3:** Implement. Parse path params in `router.ts` from `new URL(req.url).pathname`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(worker): add API routes and cron triggers`.

### Task 9: Public pages

**Files:**
- Create: `src/api.ts`; the pages `Home.tsx`, `Programare.tsx`, `Status.tsx`, `Automatizari.tsx` and `Confidentialitate.tsx` in `src/pages/`; the components `StatusTimeline.tsx` and `RunList.tsx` in `src/components/`; extend `src/copy.ts`
- Test: `tests/ui/programare.test.tsx`, `tests/ui/runlist.test.tsx`

**Interfaces:**
- Consumes: the route shapes from Task 8; `WORK_LABELS` and `STATUS_LABELS` (Task 5); the `Run` type (Task 2)
- Produces:
  - `api` with typed fetch wrappers: `getSession`, `login`, `logout`, `listAppointments`, `createAppointment`, `updateStatus`, `deleteAppointment`, `getStatus`, `runReminders`, `resetDemo`, `getOutbox`, `getLog`. Each throws `ApiError(message)` built from `{ error }`.
  - `<RunList runs={Run[]} />`
  - `<StatusTimeline status={Status} />`

**Page content (spec §4):**
- **Home:**
  - hero „Turbo Garaj, service auto (demonstrativ)”
  - the five services, from `WORK_LABELS`
  - „Cum funcționează”, in 3 steps: „Îți faci programarea”, „Primești un link unde vezi când e gata mașina”, „Primești reminder înainte de ITP și de schimbul de ulei”
  - a button „Fă o programare” → `/programare`
  - a link „Vezi automatizările care au rulat azi” → `/automatizari`
  - the box „Service-ul Turbo Garaj nu există. E un site demonstrativ făcut de Quality Zone.”, with the link
- **Programare:**
  - the fields from spec §6, with Romanian labels
  - the email placeholder `ion@turbo-garaj.test`
  - the checkbox „Vreau remindere pentru ITP și ulei”
  - when `getSession().admin` is false, submitting shows „Formular demonstrativ, programarea nu a fost trimisă.” and makes no POST
  - when it's true, submitting POSTs and shows the status link
- **Status:** `getStatus(token)`, then the timeline and the details. A 404 shows „Linkul nu mai e valid.”
- **Automatizari:**
  - a paragraph per job explaining it in plain words
  - `<RunList>` of `getLog()`, with times formatted `ro-RO` in `Europe/Bucharest`, the trigger and result in Romanian labels („pornit automat”, „buton”, „formular”, „schimbare de status”; „ok”, „eroare”, „nimic de trimis”), and the outcome labels from Global Constraints
- **Confidentialitate:** the deletion and storage rules from spec §8 in plain Romanian: what is stored, that strangers' data is never saved, the 7-day and 30-day retention periods, „Șterge clientul” and „Resetează demo”, and that the emails go only to a test inbox.

- [ ] **Step 1: Write the failing tests.**
  - `logged-out submit shows demo notice and does not post`: with a mocked `fetch` where session returns `{ admin: false }`, the notice appears and fetch is never called with `POST /api/appointments`.
  - `RunList shows sms-simulat as „SMS (simulare, netrimis)”`.
  - `RunList shows netrimis-limita copy`.
- [ ] **Step 2:** Run `npx vitest run tests/ui`. Expected: FAIL.
- [ ] **Step 3:** Implement the pages. Keep them mobile-first, because the filming is vertical.
- [ ] **Step 4:** Run `npx vitest run` and `npm run build`. Expected: PASS, and the build exits 0.
- [ ] **Step 5:** Commit with `feat(ui): add public pages, status page and automation log`.

### Task 10: Admin page

**Files:**
- Create: `src/pages/Admin.tsx`
- Test: `tests/ui/admin.test.tsx`

**Interfaces:**
- Consumes: `api` (Task 9), `RunList` (Task 9), `STATUS_LABELS` (Task 5)

**Behaviour:**
- **Logged out:** a password form. Shows the server error copy.
- **Logged in:**
  - Booking table: first name, car, work, date, a status `<select>` (PATCH on change), a link to the status page, and „Șterge clientul” (asks with `confirm()` first).
  - A button „Rulează acum” (disabled while its request is in flight, showing „Rulează…”).
  - „Resetează demo” (asks with `confirm()`).
  - The outbox, showing the full subject and body, plus „{used} din {cap} emailuri de test folosite luna asta”.
  - A live `<RunList>` that polls `getLog()` every 3000 ms while the page is visible.
  - „Ieși din cont”.

- [ ] **Step 1: Write the failing tests.**
  - `run now button disables while running`: clicking it twice with a pending mocked fetch gives exactly one `POST /api/run-reminders`.
  - `status change calls PATCH with the new status`.
- [ ] **Step 2:** Run `npx vitest run tests/ui/admin.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(ui): add admin page with live automation log`.

### Task 11: End-to-end tests

**Files:**
- Create: `playwright.config.ts`, `e2e/public.spec.ts`, `e2e/flow.spec.ts`, `.dev.vars.e2e` (committed; e2e-only values, no real secrets)

**Setup:**
- `webServer.command`: `npm run build && wrangler d1 migrations apply turbo-garaj-demo --local --persist-to .wrangler/e2e && wrangler dev --ip 127.0.0.1 --port 8787 --persist-to .wrangler/e2e --env-file .dev.vars.e2e`. The file `.dev.vars.e2e` holds `MAIL_MODE=memory`, `ADMIN_PASSWORD=e2e-admin`, `SESSION_SECRET=e2e-secret` and `SITE_URL=http://127.0.0.1:8787`. If the installed wrangler has no `--env-file`, pass the same values with `--var KEY:VALUE`.
- Delete `.wrangler/e2e` before each run (`globalSetup`), so every run starts from an empty database.
- `baseURL`: `http://127.0.0.1:8787`.
- Projects: one Chromium project with a mobile viewport (390×844).

**Tests:**
- [ ] **Step 1:** `public.spec.ts`:
  - `banner and noindex on every page`: for each of `/`, `/programare`, `/automatizari`, `/confidentialitate`, `/admin` and `/status/x`, check the banner text, the meta robots content `noindex, nofollow`, and the response header `x-robots-tag`. This covers both static files (`_headers`) and SPA fallback responses.
  - `demo-locked form`: fill it in and submit while logged out, see the notice.
- [ ] **Step 2:** `flow.spec.ts`, `full automation flow`:
  1. Log in.
  2. Reset the demo.
  3. Book a car for `ion@turbo-garaj.test` with reminders accepted; the outbox shows „Programarea ta la Turbo Garaj a fost primită”.
  4. Set it to „Gata de ridicare”; the outbox shows „Mașina ta e gata” and „SMS (simulare, netrimis)”.
  5. Open the status link in a new page; „Gata de ridicare” is active.
  6. Press „Rulează acum”; within 5 s the log shows a new `remindere-zilnice` entry triggered by „buton”.
  7. Press „Șterge clientul”; the status link now shows „Linkul nu mai e valid.”
- [ ] **Step 3:** Run `npx playwright test`. Expected: all pass.
- [ ] **Step 4:** Add the npm scripts `test` (`vitest run`) and `e2e` (`playwright test`). Commit with `test: add Playwright end-to-end flow`.

### Task 12: README, deploy and smoke test

**Files:**
- Create or modify: `README.md`

- [ ] **Step 1:** Write the README:
  - what the demo is, plus the rules in Global Constraints
  - local setup:
    1. `npm i`
    2. copy `.dev.vars.example` to `.dev.vars`
    3. `npx wrangler d1 migrations apply turbo-garaj-demo --local`
    4. `npm run build && npx wrangler dev --test-scheduled`
    5. fire a cron by hand with `curl "http://127.0.0.1:8787/__scheduled?cron=0+5+*+*+*"`
  - the secrets and vars
  - the Cloudflare free-plan limits from spec §9, and that Cron Triggers fire only on the deployed Worker
  - that the Mailtrap free sandbox allows 50 emails a month and keeps 10 (checked 2026-11-10)
  - the **filming run sheet**, copied from spec §12
- [ ] **Step 2 (the user does this):**
  - Check the ONRC registry for „Turbo Garaj”. Stop and rename if a firm uses it.
  - Create a free Mailtrap account and a sandbox, and note the API token and inbox id.
- [ ] **Step 3: STOP. Ask the user before doing anything on Cloudflare.**
  - Ask the user to confirm the Cloudflare account (the one shared with Bucla Verde) and its `workers.dev` subdomain.
  - Check on Cloudflare's own pages that the account's free Cron Trigger limit covers this demo's 2 crons plus Bucla Verde's 1, and report what you found.
  - Wait for the user's explicit yes before going on.
- [ ] **Step 4 (after the yes):**
  1. `wrangler d1 create turbo-garaj-demo` and put the id in `wrangler.toml`.
  2. `wrangler d1 migrations apply turbo-garaj-demo --remote`.
  3. Set the four secrets with `wrangler secret put` (a strong `ADMIN_PASSWORD`, a random `SESSION_SECRET` of 32+ bytes, and the Mailtrap token and inbox id). The user types the secret values, never the agent.
  4. Set `[vars]` `MAIL_MODE = "sandbox"` and `SITE_URL = "https://turbo-garaj-demo.<subdomain>.workers.dev"`.
  5. `npm run build && wrangler deploy`.
- [ ] **Step 5: Smoke test on the live site.**
  - `curl -sI https://turbo-garaj-demo.<subdomain>.workers.dev/ | grep -i x-robots-tag` prints `noindex, nofollow`.
  - In `/admin`, „Resetează demo” then a booking. The confirmation email appears in the Mailtrap inbox, and `/automatizari` shows both runs.
- [ ] **Step 6: Next morning.** `/automatizari` shows a `curatenie` run after 02:00 UTC and a `remindere-zilnice` run, „pornit automat”, after 05:00 UTC, with one email sent.
- [ ] **Step 7:** Commit the README with `docs: add README with setup and filming run sheet`. Then update the „Planning status” row for Service auto in `~/Documents/Proiecte/quality-zone/roadmap.md` to note that it was built and its address.
