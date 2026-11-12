# Turbo Garaj (demo)

Turbo Garaj is a **fictional** Romanian car service. It is demo 4 by [Quality Zone](https://qualityzone.netlify.app/ro) and it exists to show automation that runs on its own: a booking is confirmed, a "your car is ready" link goes out, and reminders for ITP and oil changes are sent every morning. The log at `/automatizari` is the centrepiece.

It is a Vite + React single-page app served by one Cloudflare Worker (static assets), with a D1 database and two Cron Triggers.

## Demo rules

- Every page shows the banner "Site demonstrativ realizat de Quality Zone", linking to `https://qualityzone.netlify.app/ro`.
- The site is not indexed: `<meta name="robots" content="noindex, nofollow">` plus an `X-Robots-Tag: noindex, nofollow` header on every response.
- No contact details: no phone numbers, street addresses, maps, reviews, testimonials or invented clients.
- Emails go only to test addresses (`something@something.test`). Nothing reaches a real person.
- SMS never touches the network. It is shown as a preview, labelled "SMS (simulare, netrimis)".
- Real numbers only: the log shows what actually ran.
- All visible copy is Romanian; code, comments and this README are English.

## Local setup

```sh
npm i
cp .dev.vars.example .dev.vars          # placeholders; edit if you like
npx wrangler d1 migrations apply turbo-garaj-demo --local
npm run build && npx wrangler dev --test-scheduled
```

The site is then at `http://127.0.0.1:8787`. Locally `MAIL_MODE=memory`, so no email leaves the machine.

Fire a cron by hand (needs `--test-scheduled`):

```sh
curl "http://127.0.0.1:8787/__scheduled?cron=0+5+*+*+*"   # daily reminders
curl "http://127.0.0.1:8787/__scheduled?cron=0+2+*+*+*"   # nightly cleanup
```

Open `/automatizari` to see the runs.

## Tests

- `npm test`: Vitest. Pure `core` tests, UI tests, and Worker tests with `@cloudflare/vitest-plugin` against a local D1.
- `npm run e2e`: Playwright (mobile viewport) against `wrangler dev` on `127.0.0.1:8787`, with `MAIL_MODE=memory` and a fresh local D1 each run (values in `.dev.vars.e2e`).

## Secrets and variables

Secrets (`wrangler secret put NAME` in production, `.dev.vars` locally; never commit real values):

| Name | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `SESSION_SECRET` | Signs the `tg_admin` cookie (HMAC-SHA256); use 32+ random bytes |
| `MAILTRAP_API_TOKEN` | Mailtrap sandbox API token |
| `MAILTRAP_INBOX_ID` | Mailtrap sandbox inbox id |

Variables (`[vars]` in `wrangler.toml`):

| Name | Purpose |
| --- | --- |
| `MAIL_MODE` | `sandbox` (Mailtrap) or `memory` (kept in memory, for dev and tests) |
| `SITE_URL` | Public address, used in links inside messages |

## Limits

**Mailtrap free sandbox:** 50 test emails a month, and it keeps 10 (checked 2026-11-10). The app caps itself at 40 a month (`EMAIL_BUDGET_CAP`); over the cap the outcome is `netrimis-limita`.

**Cloudflare free plan** (re-check on Cloudflare's own pages before launch):

- CPU: 10 ms per request or cron run. Waiting on D1 or `fetch` doesn't count. Crypto uses Web Crypto, not `node:crypto`.
- Requests: 100,000 Worker requests a day. Static files don't count.
- Cron Triggers are counted per account. This demo uses 2 and Bucla Verde uses 1, so the account's free limit must cover both.
- Cron Triggers fire **only on the deployed Worker**, never in local dev. Use the `curl` above locally.

Retention: admin-created bookings and cars are deleted after 7 days, log entries after 30 days.

## Filming run sheet

1. Open `/automatizari` and show this morning's cron run.
2. Log into `/admin` and book a car for `ion@turbo-garaj.test`.
3. Show the confirmation in Mailtrap.
4. Change the status to "Gata de ridicare" and show the email, the SMS preview and the status page.
5. Press "Rulează acum" and watch the log entry appear.
6. Press "Șterge clientul" to show the data is gone.

## Deploying (not done yet)

Nothing has been deployed. The user does the account steps and types the secret values; an agent never does.

- [ ] Check the ONRC registry for "Turbo Garaj"; rename if a firm uses it.
- [ ] Create a free Mailtrap account and sandbox; note the API token and inbox id.
- [ ] Confirm the Cloudflare account (shared with Bucla Verde) and its `workers.dev` subdomain, and that the free Cron Trigger limit covers 2 + 1 crons. Explicit yes before anything below.
- [ ] `wrangler d1 create turbo-garaj-demo`; put the id in `wrangler.toml`.
- [ ] `wrangler d1 migrations apply turbo-garaj-demo --remote`.
- [ ] `wrangler secret put` for the four secrets above (strong `ADMIN_PASSWORD`, random `SESSION_SECRET` of 32+ bytes).
- [ ] Set `[vars]` `MAIL_MODE = "sandbox"` and `SITE_URL = "https://turbo-garaj-demo.<subdomain>.workers.dev"`.
- [ ] `npm run build && wrangler deploy`.
- [ ] Smoke test: `curl -sI https://turbo-garaj-demo.<subdomain>.workers.dev/ | grep -i x-robots-tag` prints `noindex, nofollow`; in `/admin` press "Resetează demo", make a booking, see the email in Mailtrap and both runs in `/automatizari`.
- [ ] Next morning: `/automatizari` shows a `curatenie` run after 02:00 UTC and a `remindere-zilnice` run ("pornit automat") after 05:00 UTC, with one email sent.
