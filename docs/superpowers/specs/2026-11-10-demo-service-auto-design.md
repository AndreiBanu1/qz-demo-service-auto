# Demo 4: Turbo Garaj, a fictional car service (design)

**Status:** spec approved 2026-11-10. Hosting changed from Netlify to Cloudflare on 2026-11-11 (sections 2, 3, 6, 8–11); those changes await review.
**Roadmap:** demo 4 in `~/Documents/Proiecte/quality-zone/roadmap.md`. Proves the `AUTOMAT` keyword. Main episode: 018 („Ce poți automatiza azi într-o firmă mică”), plus later `AUTOMAT` coding episodes.

## 1. Purpose

Quality Zone lacks proof. A small Romanian business owner who comments `AUTOMAT` on TikTok should be able to open a live site and *see* automation that ran on its own: a booking confirmed, a „mașina ta e gata” link sent, and reminders for ITP and oil changes sent every morning. They shouldn't have to imagine it. The automation's log is the centrepiece and must be easy to film.

Success means:

- A visitor can open `/automatizari` and see real, timestamped runs from this morning's scheduled job.
- On camera, the owner can book a car, mark it ready, open the status link and press „Rulează acum”, watching each step appear in the log and in the Mailtrap inbox.
- No message ever reaches a real person, and no stranger's personal data is ever stored.

## 2. Decisions

| Topic | Decision |
|---|---|
| Brand | **Turbo Garaj** (invented). Web and registry searches on 2026-11-10 found no Romanian business with this name; the nearest match is a garage called TurboGaraje in Mallorca. Check the ONRC registry by name once more before launch |
| Who drives it | Only the owner, on camera. Public visitors browse, and they can see the read-only log |
| Code | `~/Documents/Proiecte/qz-demo-service-auto`, its own git repo |
| Hosting | **Cloudflare Workers, free plan**, on the same account as the Bucla Verde demo. Address: `turbo-garaj-demo.<subdomain>.workers.dev`, where `<subdomain>` is the account's `workers.dev` subdomain (suggested in the Bucla Verde spec: `qualityzone`). Changed from Netlify on 2026-11-11: the Netlify free plan's 300 credits a month are shared with qualityzone.netlify.app, and running out pauses every site |
| Stack | Vite + React + TypeScript + Tailwind + react-router for the SPA. **One Worker** (TypeScript) that serves the API under `/api/*` and the built SPA through Workers Static Assets, with single-page-application fallback. **Cron Triggers** for the two schedules. **D1** for data |
| Local copy | `wrangler dev` at `http://127.0.0.1:8787`, the same code with a local D1 database |
| Email | Mailtrap **Email Sandbox** (catches every message and delivers none). The free plan allows 50 test emails a month and keeps 10 in the inbox (Mailtrap docs, checked 2026-11-10) |
| SMS | Preview only: written to the outbox as „SMS (simulare, netrimis)”, never sent |
| Time | A real daily cron plus a „Rulează acum” button that runs the same code. No simulated clock |
| Public form | Demo-locked: it saves only when the admin is logged in |
| Language | Romanian only, addressing the reader as „tu”, with no jargon. Code, comments and README in English |

## 3. Rules every page follows

- A banner at the top of every page: „Site demonstrativ realizat de Quality Zone”, linking to https://qualityzone.netlify.app/ro.
- `noindex, nofollow` set both as a `<meta name="robots">` tag and as an `X-Robots-Tag` header. Static files get the header from a `public/_headers` file, because the Worker code doesn't see them; Worker responses get it from middleware. A test checks both. `robots.txt` stays permissive so crawlers can read the noindex.
- No phone numbers, street addresses, maps, opening-hours claims tied to a real place, reviews, testimonials or invented clients. Where a real business would put its contact details, the site says the service is invented and links to Quality Zone.
- Any number shown about the site itself (speed, accessibility) comes from a real tool run.

## 4. Pages

| Route | Who | Content |
|---|---|---|
| `/` | Public | Hero; services (revizie, schimb de ulei, pregătire ITP, frâne, diagnoză); „Cum funcționează” in 3 steps (programezi → primești link de status → primești reminder); button to the booking form; a link to `/automatizari` |
| `/programare` | Public view, saves for admin only | Booking form (fields in section 6). Logged out: submitting shows „Formular demonstrativ, programarea nu a fost trimisă.” and sends nothing to the server. Logged in: saves and shows the status link |
| `/status/:token` | Anyone with the link | „Mașina ta e gata” page: a timeline running Primită → În lucru → Gata de ridicare → Predată, with car, type of work, first name and last update. Unknown token: „Linkul nu mai e valid.” |
| `/automatizari` | Public, read-only | The last 50 runs, newest first: job, trigger, real start time (Romanian time), duration, result, and one line per message (channel, masked recipient, subject, outcome). Explains in one paragraph what each job does |
| `/admin` | Admin | Password login. Lists bookings with a status selector; „Rulează acum”; the outbox (the full text of each email and SMS preview, plus the budget used this month); „Șterge clientul” per booking; „Resetează demo”. The log refreshes every 3 seconds while open |
| `/confidentialitate` | Public | What is stored, why, for how long, and how it gets deleted (section 8) |

## 5. Automations

Each run writes one log entry (section 7).

| # | Job | Trigger | What it does |
|---|---|---|---|
| 1 | `confirmare-programare` | `formular` (admin saves a booking) | An email to the customer with the status link; an email notification to the service (`service@turbo-garaj.test`) |
| 2 | `masina-gata` | `schimbare-status` (status set to „Gata de ridicare”) | An email „Mașina ta e gata” with the status link, plus an SMS preview |
| 3 | `remindere-zilnice` | `cron` (`0 5 * * *` UTC, which is 07:00 Romanian time in winter and 08:00 in summer) or `buton` („Rulează acum”) | For every car with reminders accepted, finds the due reminders (rules below) and sends an email and an SMS preview for each one |
| 4 | `curatenie` | `cron` (`0 2 * * *` UTC) or `buton` („Resetează demo”) | Deletes admin-created bookings and cars older than 7 days and log entries older than 30 days. Then it deletes the seed cars and their `sent_reminders` rows, and recreates the seed with dates relative to today |

**Reminder rules** (in whole days, Romanian calendar date):
- **ITP**, with `d` = days from today to `itpExpiry`:
  - threshold `30` is due when 7 < d ≤ 30
  - threshold `7` is due when 0 ≤ d ≤ 7
  - nothing is sent once the ITP has expired (d < 0)
- **Oil:** the due date is `lastOilChange` + 12 months. Threshold `14` is due when the due date is 14 days away or less, including when it's already overdue.
- **No duplicates:** each reminder is sent once per (car, type, threshold). If a car becomes due for a more urgent threshold first (for example, it's added with its ITP 5 days away), only that threshold is sent, and the less urgent one for the same type is marked as sent too.
- **The seed:** `buildSeed(today)` returns 3 fictional cars. Exactly **one** of them has a reminder due on `today`, and the other two show the idle states („ITP valabil”, oil not yet due). Cars added by the admin can add more reminders on top of that.

Reminder thresholds and the seed rule are pure functions, so they can be tested.

## 6. Data

Everything is in one Cloudflare **D1** (SQLite) database, `turbo-garaj-demo`, managed with plain SQL migrations in `migrations/` and no ORM. It has seven tables:

| Table | Key | Columns |
|---|---|---|
| `appointments` | `id` | `token` (unique), `first_name`, `email`, `make`, `model`, `work`, `preferred_date`, `status`, `created_at`, `updated_at`, `seed` |
| `cars` | `id` | `appointment_id` (nullable, cascades on delete), `first_name`, `email`, `make`, `model`, `itp_expiry`, `last_oil_change`, `reminders_accepted`, `seed`, `created_at` |
| `runs` | `id` | `job`, `trigger`, `started_at` (indexed), `finished_at`, `duration_ms`, `result`, `items` (JSON text), `error` |
| `outbox` | `id` | `run_id`, `appointment_id` (nullable), `channel`, `to_addr`, `subject`, `body`, `outcome`, `created_at` |
| `sent_reminders` | `key` (`<carId>:<type>:<threshold>`) | `sent_at` |
| `email_budget` | `month` (`YYYY-MM`, Bucharest) | `used` |
| `login_attempts` | `id` | `at` |

**Why D1 and not KV:** KV is eventually consistent, so two runs a second apart could both read „not yet sent” and send twice. D1 gives atomic single statements:
- **Each reminder:** the job *claims* it with `INSERT INTO sent_reminders … ON CONFLICT DO NOTHING RETURNING key` before sending. If the send fails, it deletes the claim so the next run retries.
- **Each sandbox email:** the job reserves budget with `UPDATE email_budget SET used = used + 1 WHERE month = ? AND used < 40 RETURNING used`, and gives the slot back if the send fails.

Because of this, the cron and the button pressed at the same moment can't send a reminder twice, or go over the cap.

**Form fields:**
- required: first name (2–40 characters), email (must end in `.test`), make and model, type of work, preferred date (today or later)
- optional: ITP expiry date, last oil change date, and a „Vreau remindere pentru ITP și ulei” checkbox

No phone number, number plate, surname or address is ever collected.

**Status token:** 32 random bytes, base64url, from `crypto.getRandomValues`.

## 7. Log entry

```ts
type Run = {
  id: string;
  job: 'confirmare-programare' | 'masina-gata' | 'remindere-zilnice' | 'curatenie';
  trigger: 'cron' | 'buton' | 'formular' | 'schimbare-status';
  startedAt: string;   // ISO, real time
  finishedAt: string;
  durationMs: number;
  result: 'ok' | 'eroare' | 'nimic-de-trimis';
  items: { channel: 'email' | 'sms-simulat'; to: string /* masked: i***@turbo-garaj.test */; subject: string;
           outcome: 'trimis-sandbox' | 'simulat' | 'netrimis-limita' | 'eroare'; error?: string }[];
  error?: string;
};
```

## 8. Safety and privacy

**Only test recipients, enforced in three places:**
1. The form and the server reject any email that doesn't end in `.test`, with: „În demo folosește o adresă de test, de exemplu ion@turbo-garaj.test.”
2. The email adapter only knows Mailtrap's sandbox send endpoint. The code has no route to real inboxes.
3. SMS is never sent. The SMS adapter makes no network call.

**Email budget:**
- At most 40 sandbox emails a month, counted in the `email_budget` table and reserved atomically (section 6).
- The cron uses about 30 a month (one reminder a day); the rest are for filming.
- Once the budget runs out, messages are still written to the outbox and logged as `netrimis-limita` („netrimis: limita lunară a sandbox-ului”).

**Personal data:**
- **What's stored:** the minimum listed in section 6.
- **Deletion:**
  - „Șterge clientul” removes the booking, the car and their outbox entries, and blanks the first name in log entries.
  - The nightly cleanup deletes admin-created data after 7 days.
  - „Resetează demo” wipes every table except `email_budget`.
  - Log entries are kept 30 days and hold only masked emails.
- **Visitors:** strangers never store anything, because the form is demo-locked.
- **Privacy page:** `/confidentialitate` states all of this in plain Romanian.

**Admin:**
- One password, `ADMIN_PASSWORD`. A successful login sets an HttpOnly, Secure, SameSite=Strict cookie signed with HMAC-SHA256 (`SESSION_SECRET`), valid for 8 hours.
- After 5 failed logins in 15 minutes, login is locked for 15 minutes, and failures are logged.
- Every admin function checks the cookie.

**Secrets**, never committed:
- set with `wrangler secret put`: `ADMIN_PASSWORD`, `SESSION_SECRET`, `MAILTRAP_API_TOKEN`, `MAILTRAP_INBOX_ID`
- plain `[vars]` in `wrangler.toml`: `MAIL_MODE` (`sandbox` | `memory`) and `SITE_URL`
- locally, they come from `.dev.vars`, which is git-ignored; `.dev.vars.example` holds placeholders only

## 9. Architecture

```
src/                      React app (pages, components, Romanian copy in src/copy.ts)
core/                     pure TypeScript, no I/O, shared by the Worker and tests
  reminders.ts            findDueReminders(cars, sentKeys, today)
  seed.ts                 buildSeed(today): cars so that exactly one reminder is due today
  messages.ts             Romanian email/SMS templates
  recipients.ts           isTestAddress, maskEmail
  budget.ts               canSendEmail(count, cap)
  session.ts              sign/verify cookie, lockout rule
worker/
  index.ts                fetch(): /api/* → router, anything else → env.ASSETS; scheduled(): picks the job by cron
  router.ts  routes/      thin HTTP handlers: auth, appointments, status, outbox, log, run-reminders, reset
  db.ts                   typed queries over D1 (the only file with SQL)
  notifier.ts             EmailSender interface: MailtrapSandbox, Memory (SMS preview is just an outbox row)
  runner.ts               runJob(job, trigger, fn): timing, log entry, error capture
  jobs.ts                 createBooking, setStatus, runReminders, cleanup, deleteCustomer
migrations/               D1 SQL migrations
wrangler.toml             assets (./dist, SPA fallback), D1 binding DB, [vars], crons
```

**Cron Triggers:** `crons = ["0 5 * * *", "0 2 * * *"]` (UTC). The Worker's `scheduled` handler reads `controller.cron`: `0 5 * * *` runs `runReminders('cron')`, and `0 2 * * *` runs `cleanup('cron', 'nightly')`.

The cron and „Rulează acum” both call `runReminders(trigger)`, so what's filmed is exactly what runs every morning.

**Cloudflare limits to respect** (free plan; re-check on Cloudflare's own pages before launch, as the Bucla Verde spec also requires):
- **CPU:** 10 ms per request or cron run. Waiting on D1 or `fetch` doesn't count, and our work is mostly waiting, so it fits. Crypto uses Web Crypto (`crypto.subtle`), not `node:crypto`.
- **Requests:** 100,000 Worker requests a day. Static files don't count.
- **Cron Triggers:** they are counted per account. This demo uses 2 and Bucla Verde uses 1, so check that the account's free limit covers both.

## 10. Errors

- Each message is sent separately. A failed send is logged with its reason, the run's result becomes `eroare`, and that reminder's claim in `sent_reminders` is removed, so the next run retries it.
- Cron Triggers fire only on the deployed Worker. Locally, `wrangler dev --test-scheduled` exposes `/__scheduled?cron=<expression>` to fire one by hand. The README records this.
- API errors return a plain Romanian message (`{ error: "..." }`) and never a stack trace. The UI shows that message.

## 11. Testing

- **Vitest (core):**
  - reminder thresholds at the boundaries (30, 7, 0 days; overdue oil)
  - no duplicates
  - the seed always produces exactly one due reminder, across a year of dates
  - the budget cap
  - `isTestAddress` and `maskEmail`
  - the templates contain the status link
  - cookie sign and verify, expiry and tampering
  - the lockout window
- **Vitest with `@cloudflare/vitest-pool-workers`** (real local D1, in-memory email): log entries, outbox, the budget fallback, a send failure leading to a retry, and two runs started at the same moment sending each reminder once.
- **Playwright** against `wrangler dev` on `127.0.0.1:8787` with `MAIL_MODE=memory` and a fresh local D1:
  - the banner, plus `noindex` in both the meta tag and the header, on every page
  - the demo-locked form while logged out
  - the full flow: login → book → confirmation in the outbox → „Gata de ridicare” → status page → „Rulează acum” → a new entry on `/automatizari`
  - „Șterge clientul” removes the data
- **Manual smoke test** after the first deploy: the confirmation email arrives in the Mailtrap inbox, and the next morning's cron entry appears on `/automatizari`.

## 12. Filming run sheet (in the README)

1. Open `/automatizari` and show this morning's cron run.
2. Log into `/admin` and book a car for `ion@turbo-garaj.test`.
3. Show the confirmation in Mailtrap.
4. Change the status to „Gata de ridicare” and show the email, the SMS preview and the status page.
5. Press „Rulează acum” and watch the log entry appear.
6. Press „Șterge clientul” to show the data is gone.

## 13. Out of scope

- real SMS or WhatsApp
- an English version
- the „Exemple” page on the Quality Zone site
- payments
- public self-service booking
- a simulated clock
