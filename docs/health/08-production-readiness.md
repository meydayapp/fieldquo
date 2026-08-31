## 8. Production readiness and recovery

**Everything in this document was derived from the repository.** I have no
Vercel dashboard access, no Neon console, no Retell/Stripe/Twilio/Cloudinary
dashboard access, and no production logs. I could not check which env vars
are actually set, whether the last `prisma db push` matches `schema.prisma`,
what plan tier the Vercel project is on, or whether any webhook is actually
registered where the code assumes it is. Where a claim depends on that kind
of access, it is written as a question for the owner's checklist, not as a
finding.

### Verdict

The code side of this is in good shape: `npm run build` passes clean (see
below), every cron and every inbound webhook enforces its own auth or
signature check, the reserved-subdomain boundary is enforced both in app
code and at the database level, and the observability that exists
(`PlatformErrorLog` / `/platform/errors`) is real and reads what it claims to
read. The risk is almost entirely **outside the repo** — env vars that may or
may not be set, webhook URLs registered in vendor dashboards this audit
cannot see, and a Vercel plan tier that determines whether nine of the
sixteen crons in `vercel.json` run on the schedule they claim to. There is
**no backup or restore procedure anywhere in this codebase** — that is stated
plainly in its own section below, not implied. `docs/TODO.md`'s "Waiting on
the owner, not on me" list is current as of last check and none of it is
resolved in code; the largest of those (which Stripe endpoint receives which
event category) is now backstopped by an hourly reconciler either way, so a
wrong dashboard setting delays money by up to an hour rather than losing it.

---

### Environment variables

Sourced from `docs/VERCEL.md`, which `npm run build` enforces cannot drift
from the code (`scripts/check-env-docs.mjs` — confirmed 52 variables, build
passed clean). The columns below add what VERCEL.md doesn't state as a
column: whether the failure mode is loud (visible immediately, to someone) or
silent (nothing tells anyone, anywhere).

Marked **Sensitive in Vercel** (cannot be read back or pulled locally, per
AGENTS.md) — only `OPENAI_API_KEY` is flagged that way in this codebase; no
other key carries that property here.

| Variable | Breaks without it | Required? | Fails loud or silent |
|---|---|---|---|
| `DATABASE_URL` | Nothing works | Required | Loud — Prisma throws (`P1001` on Neon cold-start; **see finding below, there is no retry**) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Login / sessions | Required | Loud-ish — Better Auth logs a warning on a weak secret at boot; a wrong `URL` breaks redirects visibly |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails/PDFs | Required | Silent — links just resolve wrong, nothing errors |
| `STRIPE_SECRET_KEY` | Both Stripe integrations | Required | Loud — SDK throws on missing key |
| `RESEND_API_KEY` | All outbound email | Required | **Silent** — confirmed in `lib/email/resend.js`: missing key returns `{skipped:true}` with only a `console.warn`, no `recordError()` call, so a missing key here produces **no entry in `/platform/errors`** — only Vercel's own function logs would show it |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Signed uploads, quote/invoice PDFs | Required | Loud — `app/api/upload/route.js` returns specific, actionable error text per failure mode (unset, wrong cloud, mismatched secret) |
| `OPENAI_API_KEY` | Every AI feature | Required | **Silent** — Sensitive in Vercel, cannot be pulled locally; `lib/ai/provider.js` catches and degrades, confirmed by its own doc comment: "every AI feature returns nothing, silently, with no error in any log" |
| `TWILIO_ACCOUNT_SID` / `_AUTH_TOKEN` / `_API_KEY_SID` / `_API_KEY_SECRET` / `_PHONE_NUMBER` | SMS, crew inbox, voice number provisioning | Required | Mixed — `twilioAvailable()` gates callers; number lookups without a `from` number throw explicitly, but callers can choose to swallow that |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser maps/autocomplete | Required | Silent in the browser — a blank map, console error only |
| `RETELL_API_KEY` | Phone receptionist entirely | Required | Loud-ish — every voice screen shows "not configured", an honest message |
| `RETELL_WEBHOOK_SECRET` | Only the rare account whose signing key differs from `RETELL_API_KEY` | Optional | N/A in the normal case |
| `STRIPE_BILLING_WEBHOOK_SECRET` | FieldQuo's own subscription billing | Required | **Silent** — "nobody is ever marked past-due, so the 7-day grace never starts and a dead card bills forever" |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Contractor payouts | Required | Silent-ish, now backstopped — `/api/cron/booking-fees` reconciles hourly regardless, so this degrades from "instant" to "up to an hour late" rather than "never" |
| `GOOGLE_MAPS_SERVER_KEY` | Roof measurement (dead without it), travel-time booking (silent straight-line fallback) | Required | Split — roof measurement fails visibly; travel-time booking degrades silently |
| `CRON_SECRET` | Every `/api/cron/*` route | Required | **Loud but misleading** — 401s, and Vercel's own dashboard reports the invocation as "run" regardless, because the 401 response is still a completed HTTP response. **See finding below: if this is unset, the check is bypassable.** |
| `PLATFORM_JWT_SECRET` | Superadmin console session | Required | **Silent** — jose refuses a zero-length key; login "appears to work and bounces you straight back out with nothing in any log" (VERCEL.md's own words, confirmed by reading the verification path) |
| `IMPERSONATION_JWT_SECRET` | Read-only support sessions | Required | Loud — throws a 500 with instructions |
| `UNSPLASH_ACCESS_KEY` | Stock-photo tab in the Marketing Designer | Optional | Loud — explicit "not set up on this deployment" message |

Optional variables with code defaults (`OPENAI_MODEL`, `VOICE_CENTS_PER_MINUTE`,
`CREW_SMS_CENTS`, etc.) are listed in full in `docs/VERCEL.md` and were not
re-derived here — none of them gate a whole feature the way the table above
does.

**Finding — the `CRON_SECRET` check is bypassable while unset.** Every one of
the 16 cron routes gates on:

```js
if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
```

If `CRON_SECRET` is not set in the deployment environment,
`` `Bearer ${process.env.CRON_SECRET}` `` evaluates to the literal string
`"Bearer undefined"` (confirmed by running it: `node -e 'console.log(\`Bearer ${process.env.CRON_SECRET}\`)'`
prints `Bearer undefined`). Anyone who sends
`Authorization: Bearer undefined` to any of the 16 cron paths would pass this
check while the secret is unset. This is on top of the already-documented
problem (crons 401 without it, looking successful in the Vercel dashboard
either way) — it means an unset `CRON_SECRET` isn't just "crons don't run",
it's "crons can be triggered by a stranger who knows this exact pattern,"
which after this audit is now written down in a place a stranger could read
it. **BLOCKER**: confirm `CRON_SECRET` is actually set before launch, not
just that it's in the Vercel dashboard's variable list (per AGENTS.md,
setting it there does nothing until the next redeploy applies it).

**Finding — no retry around Neon's cold-start `P1001`, anywhere.** AGENTS.md
documents this as a known gotcha ("the first connection after idle can fail
with P1001... retry once before believing the database is down") but no code
implements it: `lib/db.js` is a plain `PrismaClient` over a `pg` `Pool`, no
retry wrapper, and a repo-wide search for `P1001` returns zero matches
outside AGENTS.md itself. Every route — including all 16 crons, none of
which wrap their top-level handler in try/catch (see the cron table below) —
will hard-fail on a cold-start connection with no retry and, for most crons,
no record in `/platform/errors` either.

---

### Crons

All 16 paths in `vercel.json` have a matching route under `app/api/cron/`;
re-verified directly (`ls app/api/cron/` against the 16 `path` entries) —
confirmed still true. Every route checks `CRON_SECRET` (see the bypass
finding above). "Visible on failure" means a failure produces a
`platformErrorLog` row an owner would see on `/platform/errors` — not just a
Vercel function log, which this audit cannot check and the owner would have
to think to look at.

| Path | Schedule | What it does | If it doesn't run | Idempotent if run twice | Visible on failure |
|---|---|---|---|---|---|
| `/large-quote-check` | `0 9 * * *` (daily) | Emails admins about quotes above a threshold created since the last run | A large quote goes unflagged for a day | **No** — by the route's own comment: "no per-quote 'already notified' flag; the [lookback] window is the only thing preventing repeats." The window (`LARGE_QUOTE_LOOKBACK_MINUTES`, default 24h) **must** match the cron schedule or it silently double-notifies or drops quotes. See the plan-tier finding below — this coupling is the reason the comment insists on daily. | No — no `recordError` call in this route |
| `/follow-ups` | `0 8 * * *` (daily) | Sends rule-based follow-up emails (quote no-response, invoice overdue, job completed) | Follow-ups delayed a day | Yes — claims `(rule, entity)` via a unique constraint on `FollowUpLog` before sending; a race or re-run just hits the constraint and skips | No top-level catch; a thrown error before the loop starts (e.g. a cold-start `P1001`) is unrecorded |
| `/recurring-jobs` | `0 5 * * *` (daily) | Materialises the next visit for recurring jobs | Recurring jobs stop generating new visits | Yes — delegates to `ensureUpcomingVisit`, documented idempotent | No `recordError` in this route |
| `/appointment-reminders` | `0 * * * *` (hourly) | Texts/emails clients ahead of an appointment | Reminders missed for that hour's window | Yes — claims via `reminderSentAt: null` filter, stamped before send | No `recordError` in this route |
| `/monthly-digest` | `0 8 1 * *` (monthly) | AI-generated monthly summary per company | A company misses a month's digest | Not verified in depth — single run per company per month, low collision risk | No `recordError` in this route |
| `/review-requests` | `0 * * * *` (hourly) | Asks clients for a review after a job | A review ask is late by up to an hour | Guarded — "asking twice costs more than not asking," per its own comment | No `recordError` in this route |
| `/voice-outbound` | `*/15 * * * *` | Places due/allowed outbound calls | Outbound calls (e.g. quote-confirmation calls) delayed | Yes by design — every gate (consent, hours, credit) is re-checked at dial time inside `placeQueuedCall`, not cached in the task | No `recordError` in this route |
| `/voice-rent` | `0 7 * * *` (daily) | Bills the monthly rental on live voice numbers, or starts the loss clock | FieldQuo eats the Retell rental cost for that day; a company that should lose a number for non-payment doesn't yet | Not fully verified; daily cadence limits blast radius | No `recordError` in this route |
| `/service-plans` | `0 6 * * *` (daily) | Bills recurring service-plan occurrences that are due | Plan billing delayed a day | Yes — double-guarded (`status: "active"` in the query, `planBlockedReason` again inside `runServicePlan`) and "at most one occurrence per plan per run" per its own comment | No `recordError` in this route |
| `/booking-fees` | `15 * * * *` (hourly) | Reconciles held booking-fee checkouts against Stripe — the backstop for a missed webhook | A paid booking fee stays unconfirmed until the next run; an abandoned checkout keeps holding a slot | Yes, explicitly the point of the route | **Yes** — logs `webhook_missed` via `recordError` on every reconciled payment, which is also the only live signal that the Stripe dashboard endpoint is misconfigured |
| `/voice-reconcile` | `35 * * * *` (hourly) | Asks Retell for calls it handled that were never billed via webhook | Calls go unbilled until the next run (bounded — `callCeiling.js` caps exposure per call) | Yes, explicitly the point of the route | Yes — calls `recordError` |
| `/voice-resync` | `50 * * * *` (hourly) | Pushes current agent instructions/prompt to any Retell agent running a stale copy | Contractors' receptionists keep running whatever prompt was live at their last manual Save — the exact bug this route was built to close | Yes by design (hash comparison, re-pushes only if changed) | Yes — 2 `recordError` call sites |
| `/voice-auto-topup` | `*/15 * * * *` | Tops up voice balance for companies under threshold who opted in | A company can go quiet mid-day if the hot-path top-up (triggered on call billing) didn't catch it — covered scenarios: crew-text/rental spend, a company that goes quiet and never re-triggers the hot path, a stuck in-flight claim | Yes — reuses the same Stripe idempotency key on retry | No `recordError` in this route |
| `/crew-line-rent` | `0 7 * * *` (daily) | Twin of `voice-rent` for crew SMS lines; deliberately separate so one failing table doesn't stop the other | Same class as `voice-rent`, scoped to crew lines | Delegates to `billCrewLineRent`, not independently verified | No `recordError` in this route |
| `/renewal-reminders` | `0 9 * * *` (daily) | 7-day (monthly) / 30-day (annual) renewal notice emails | A renewal reminder is missed for a customer whose window fell that day | Not independently verified | Not verified |
| `/grace-warning` | `0 9 * * *` (daily) | Past-due, read-only grace-period warning emails (up to two per episode) | A past-due company doesn't get warned before losing write access | Uses the same `grace_start`/`grace_remind`/`grace_wait` pattern as number release — appears idempotent by construction | Yes — calls `recordError` |

**Finding — nine of these sixteen schedules run more often than once a day,
and one route's own comment says the account can't do that.**
`app/api/cron/large-quote-check/route.js` states outright: *"Currently daily,
because Vercel's Hobby plan permits at most one cron run per day. On Pro,
drop both this and the schedule to something tighter."* Vercel's Hobby
(free) tier is documented by Vercel itself to only invoke cron jobs once per
day regardless of the schedule string, and to cap the number of cron jobs
per project. `vercel.json` schedules `appointment-reminders` and
`review-requests` hourly, `voice-outbound` and `voice-auto-topup` every 15
minutes, and `booking-fees`/`voice-reconcile`/`voice-resync` at fixed hourly
offsets — nine schedules total that only make sense on a paid plan. **If
this project is on Hobby, most of the reconciliation and reminder
infrastructure above silently runs at most once a day** (or may not run at
all, depending on how Vercel handles an over-limit cron count) **with no
error anywhere** — Vercel would still show the ones that do run as
successful. This cannot be checked from the repo. **BLOCKER**: confirm the
Vercel project's plan tier before launch.

---

### Webhooks

| Endpoint | Provider | URL configured | Signature verification |
|---|---|---|---|
| `/api/stripe/webhook` | Stripe (platform account) | Vendor dashboard (Stripe) — invisible to this repo. **Per `docs/ROADMAP.md`, this is currently registered as a Connect endpoint, which only receives connected-account events — the booking/invoice/voice-topup checkout events it needs are platform-account events, so it structurally cannot receive them as configured.** Both routes dispatch through the same `lib/stripe/settleCheckoutSession.js`, and `/api/cron/booking-fees` reconciles hourly regardless, so this is now a latency problem (up to an hour), not a total-loss problem — but it is still misconfigured. | Enforced — `stripe.webhooks.constructEvent(...)` with the signature header |
| `/api/platform/billing/webhook` | Stripe (FieldQuo's own subscription billing) | Vendor dashboard | Enforced — same `constructEvent` pattern |
| `/api/voice/webhook` | Retell | **Not set by hand** — FieldQuo sets `webhook_url` on each agent itself at provisioning time, derived from the request origin that triggered provisioning. A save made from a preview URL or a laptop silently repoints a live agent at an address that stops existing; the phone still answers, but events go nowhere until the hourly `voice-reconcile` cron bills them late. `lib/voice/webhookAudit.js` exists specifically for this — it reads from anywhere but **refuses to repair from an unstable origin**, on purpose, so a diagnostic tool run from a preview deployment can't rewrite every tenant's live agent at once. `/platform/voice-webhooks` is the operator screen for this. | Enforced — `verifyRetellSignature`, HMAC-SHA256 over the raw body + timestamp, keyed on `RETELL_API_KEY` (the badge-marked key in Retell's dashboard, not an invented secret — see VERCEL.md for the full explanation of why `RETELL_WEBHOOK_SECRET` almost never needs to be set) |
| `/api/crew/inbound` | Twilio (crew SMS inbox) | **Vendor dashboard, per-number** — VERCEL.md: "Point Twilio's inbound Messaging webhook at `/api/crew/inbound`" — this has to be set by hand per company SMS-capable number, and is invisible to this repo entirely | Enforced — `verifyTwilioWebhook`, `X-Twilio-Signature` validated against `TWILIO_AUTH_TOKEN`. Its own comment warns: a deployment with Twilio keys but no auth token "cannot verify a signature" — check that `TWILIO_AUTH_TOKEN` specifically (not just the API key pair) is set |
| `/api/sms/inbound` | Twilio (general inbound SMS, e.g. STOP/START opt-out) | Vendor dashboard | Enforced — same `verifyTwilioWebhook` |

**Same class of problem as the documented root cause, found in one place.**
`lib/voice/webhookAudit.js` exists precisely because a webhook silently
pointing nowhere was the root cause of "booking fees, invoices and voice
calls all failing silently" (per the user's own framing and confirmed by
`docs/ROADMAP.md`'s Stripe-Connect-endpoint finding above). The Retell case
has a purpose-built audit/repair tool with an explicit safety rail
(`mayRepair` refuses on an unstable origin). **The Stripe case has no
equivalent tool** — there's no code path that reads back which Stripe
webhook events a given endpoint is subscribed to and flags a mismatch; the
Connect-vs-platform-account misconfiguration above was found by reading the
code and Stripe's docs, not by anything the app itself would tell you. The
hourly `booking-fees` cron is the only automated defense, and it exists for
exactly this reason. Twilio has no equivalent audit either, but its failure
mode is narrower (per-number, and `crewInboxCapability` gates the feature
off with a stated reason when signature verification isn't configured,
rather than silently accepting unsigned requests).

---

### Domains, subdomains, cookies

`lib/site/subdomain.js`'s `RESERVED_SUBDOMAINS` set (~70 names) is exactly
what the header comment says it is: a security boundary, not a naming
preference — `app`, `api`, `admin`, `platform`, `login`, `auth`, `account`,
`billing`, etc. are all blocked from tenant registration because
`.fieldquo.com`-scoped cookies would otherwise be readable by a page a
tenant controls.

**Enforced in two places, confirmed by reading both:**
1. App-level: `validateSubdomain()` is called from the single write path,
   `app/api/settings/website/route.js` (`PUT`) — the only place in the
   codebase that sets a `subdomain` value, confirmed by grep. It checks the
   reserved list and re-checks uniqueness excluding the caller's own company.
2. DB-level: `subdomain String @unique` on the Site model in
   `prisma/schema.prisma` — a second, independent backstop if the app check
   were ever bypassed.

`middleware.js`'s subdomain rewrite runs first, before every other gate, and
explicitly excludes `/app` and `/platform` from the passthrough list — a
tenant's own back office can never resolve on a hostname the tenant
controls the name of, closing the same class of hole from the other
direction.

**Custom domains do not exist as a feature.** No `customDomain` field, no
route, nothing — grep across `app`, `lib`, and `prisma/schema.prisma` for
`customDomain`/`CustomDomain` returns nothing. Every tenant site lives at
`<subdomain>.fieldquo.com` behind the wildcard DNS record. If a custom
domain is wanted later, it needs, at minimum: a schema field, a Vercel
domain-verification flow (TXT/CNAME), an update to `subdomainFromHost`'s
host resolution, and a decision on whether cookies still scope to
`.fieldquo.com` (they should — a custom domain should serve the public site
only, never `/app`, for the same reason subdomains don't).

**The wildcard `*.fieldquo.com` domain itself is the one blocker here**, and
it's a Vercel dashboard action, not code: per `docs/VERCEL.md`, "until it
exists no tenant website resolves at all." Locally, `sunset.localhost:3000`
works with no setup, which is exactly why this is easy to miss in testing
and only surfaces in production.

---

### Migrations and data

The repo uses `prisma db push` — confirmed no `prisma/migrations/` directory
exists at all. Plainly, what that means:

- **No migration history.** There is no record, anywhere, of the sequence of
  schema changes that produced the current production schema — only
  `schema.prisma`'s current state and git's history of that one file (144
  commits have touched it).
- **No down path.** A `db push` that removes a column or changes a type
  applies directly; there is no generated migration to reverse, and no tool
  in this repo attempts to build one.
- **A destructive change applies directly**, with whatever confirmation
  `prisma db push` itself prompts for interactively — there is no CI gate or
  script in this repo that reviews a pending schema diff before it's pushed.
- **Whether `schema.prisma` matches the deployed database cannot be
  determined from the repo.** The only way to know is to run
  `npx prisma db push` (which reports a diff and asks before applying
  anything) or `npx prisma validate` against the real `DATABASE_URL` — this
  audit has no such connection string and could not do either.

**Safe deploy procedure**, given the above: before any deploy that changed
`prisma/schema.prisma`, run `npx prisma db push` against production
**first**, review what it says it's about to do, confirm only additive/safe
changes are listed, and only then deploy the application code that depends
on the new shape. Deploying app code that assumes a column exists before
`db push` has created it will 500 on first use of that path.

---

### Backups and recovery

**No evidence of a backup policy in this repo.** Searched for `backup`,
`pg_dump`, `restore`, Neon branching/point-in-time-recovery references, and
any operator script that would create or restore a snapshot — nothing. Neon
itself offers point-in-time restore as a platform feature, but whether it's
enabled, what retention window is configured, and whether a restore has ever
been tested are all Neon-console questions this repo cannot answer.
**This has never been proven to work**, as far as this audit can tell — not
"probably fine," genuinely unverified. This is the single most important
line in this checklist for the owner to close personally before real
customer data accumulates.

---

### Observability

**What exists, confirmed by reading the code:**
- `PlatformErrorLog` (Prisma model) + `lib/platform/errorLog.js`'s
  `recordError()` — the one shared, deliberately-never-throws error sink.
  Read by `/platform/errors` (the "failure queue," per its own header
  comment) via `/api/platform/errors`.
- **Client-side crashes are captured too** — `/api/app-errors` receives
  React error-boundary reports from the browser and writes them to the same
  table under `area: "app"`, specifically because "a quote page threw and
  the owner saw... nothing was written anywhere" before this existed.
- Several crons (`booking-fees`, `voice-reconcile`, `voice-resync`,
  `grace-warning`, `renewal-reminders`) call `recordError` for real business
  failures — e.g. `booking-fees` logs `webhook_missed` on every payment it
  had to rescue, which doubles as the live signal that the Stripe dashboard
  endpoint is misconfigured.

**What has no coverage:**
- **No external APM/error-tracking service** — grepped for Sentry, Datadog,
  LogRocket, Bugsnag, Rollbar, New Relic: zero matches anywhere in the repo.
  Everything is either the in-house `PlatformErrorLog` (pull — someone has
  to open `/platform/errors`) or Vercel's own function logs (pull — someone
  has to open the Vercel dashboard), which this audit cannot check.
- **No alerting.** Nothing pushes — no email, Slack, or webhook fires when a
  critical error is recorded. `/platform/errors` and Vercel's dashboard are
  both pull-only.
- **222 `console.error` call sites** across `app/` and `lib/` — only a
  fraction of these are paired with a `recordError()` call. The rest go to
  Vercel's runtime logs and nowhere else. `RESEND_API_KEY` missing is a
  concrete example already in the env table above: a `console.warn`, not a
  `recordError`, so a dead email pipeline would not appear on
  `/platform/errors` at all.
- **Most crons have no top-level try/catch and no `recordError` call for a
  total route failure** (see the cron table — only 5 of 16 record errors,
  and those are for specific business conditions, not for the route
  crashing outright). A cold-start `P1001` on, say, `follow-ups` produces a
  500 that Vercel logs and nothing else sees.

---

### Build and deploy

`npm run build` **passes clean** — run for real in this worktree (not
statically checked), using placeholder values for the four env vars that
gate the build itself:

```
DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL
```

Build order, confirmed from `package.json`:
`check-imports.mjs` → `check-exports.mjs` → eslint (`check-undef.config.mjs`)
→ `check-env-docs.mjs` → `prisma generate` → `next build`. All five stages
passed. Only warnings emitted: a Turbopack workspace-root inference notice,
one CSS optimization warning, and repeated Better Auth "secret too short /
low-entropy" warnings — expected, since a throwaway placeholder secret was
used for this run and is not a finding about production.

**Build-time vs. runtime env vars.** Four variables are required just to get
through `next build` (`DATABASE_URL` for `prisma generate` — it only needs a
parseable connection string, not a live one; `BETTER_AUTH_SECRET`/`_URL` and
`NEXT_PUBLIC_APP_URL` because modules that read them are imported while Next
collects route metadata). Exactly two `NEXT_PUBLIC_*` variables exist in the
whole codebase (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) —
both get inlined into the client bundle at build time, so if either changes,
the app needs a rebuild, not just a redeploy of the same build artifact.
Every other required variable (Stripe, Resend, Twilio, Cloudinary, OpenAI,
Retell, the JWT secrets) is read only at request time and was **not** needed
to complete this build — confirmed by the build succeeding without any of
them set.

**Static-generation pages that don't touch the database at build time.**
`/compare/[slug]`, `/features/[slug]`, `/glossary/[slug]`,
`/industries/[slug]`, and `/product/[slug]` all use
`generateStaticParams` and built successfully against a `DATABASE_URL`
pointing at a Postgres server that does not exist (`localhost:5432`, nothing
listening) — confirming these pull from static data files, not Prisma, so a
database outage cannot break the marketing-content build.

**`force-dynamic` usage** — 19 occurrences, all in files that plausibly need
per-request personalization or live tenant data: `/app` and `/platform`
layouts (session-gated), every client-facing token page (`/q`, `/portal`,
`/visit`, `/unsubscribe`, `/design`, `/refer`, `/l`), the tenant site
renderer, `/book`, `/quote`, `/instant-quote`, `/embed`, and `/pricing` +
`/cost` (server-rendered per request rather than statically, per their own
comments). None looked gratuitous on inspection — no finding here.

---

### Cross-browser and device (static only — no real browser testing was done)

Grepped for the APIs the prompt named:

- **`structuredClone`** — 2 call sites (`app/data/emailTemplateBlocks.js`,
  `app/app/settings/services/RateCard.js`). No polyfill. Requires Safari
  15.4+ / iOS 15.4+ (spring 2022).
- **`Array.prototype.at`** — 1 call site (`lib/analytics/kpis.js`, server-side
  analytics code, not client-facing — lower risk even on an old browser).
  Same Safari 15.4+ requirement.
- **`Object.groupBy`** — 0 matches, not used.
- **`:has()` CSS selector** — 0 matches, not used.
- **Container queries (`@container`, `container-type`)** — 0 matches, not
  used.
- **`dvh` units** — 4 sites, all in `app/components/mobile/BottomSheet.js`
  (mobile sheet sizing). Needs Safari 15.4+.
- **`env(safe-area-inset-*)`** — used for mobile tab bar / bottom sheet /
  Jennifer panel positioning. This one is old and safe — supported since
  iOS 11 (2017).

None of these need a fallback for a genuinely old browser under any
reasonable support target for a contractor-facing SaaS in 2026 (Safari
15.4 shipped over four years before this launch), but this is a grep, not a
test. **Real cross-browser and device testing needs real browsers and real
devices — this audit has none and did not attempt to simulate any.**

---

### Owner's pre-launch checklist

Ordered so a launch-blocking item comes before a nice-to-have. Items marked
**(unverifiable from the repo)** need the owner's own access — Vercel,
Neon, Stripe, Twilio, Cloudinary, Retell dashboards.

**BLOCKER**

1. **Confirm the Vercel project's plan tier.** `large-quote-check`'s own
   code comment says Hobby only runs a cron once a day; nine of the sixteen
   crons in `vercel.json` are scheduled hourly or every 15 minutes. On
   Hobby, most of the reconciliation and reminder system may be silently
   running far less often than the schedule claims, with no error anywhere
   to say so. **(unverifiable from the repo)**
2. **Set `CRON_SECRET` before anything else, and verify it actually took
   effect** (redeploy after setting — per AGENTS.md, Vercel doesn't apply
   new env vars to a running deployment). Until it's set, every cron 401s
   *and* is bypassable by anyone who sends the literal header
   `Authorization: Bearer undefined` — a concrete, exploitable gap, not a
   theoretical one, confirmed by running the template literal directly.
   **(unverifiable from the repo whether it's already set)**
3. **Register the `*.fieldquo.com` wildcard domain in Vercel → Domains.**
   Until it exists, no tenant website resolves at all. **(owner action, not
   in the repo)**
4. **Set both Stripe webhook secrets** (`STRIPE_BILLING_WEBHOOK_SECRET`,
   `STRIPE_CONNECT_WEBHOOK_SECRET`) and **register the corresponding
   endpoints in the Stripe dashboard, in both test and live mode** — four
   separate endpoints total. Specifically check which category
   `/api/stripe/webhook` is registered under: per `docs/ROADMAP.md` it is
   currently a **Connect** endpoint, which cannot receive the
   platform-account `checkout.session.completed` events booking fees,
   invoices, and voice top-ups need. The hourly `booking-fees` cron
   backstops this now, so it's a latency problem rather than data loss —
   but it should still be fixed at the source. **(owner action — Stripe
   dashboard)**
5. **Set `PLATFORM_JWT_SECRET` and `IMPERSONATION_JWT_SECRET`.** The first
   fails *silently* — superadmin login "works" and bounces back out with
   nothing in any log if this is unset or empty; verify by actually logging
   into `/platform` after deploy, not just by checking the Vercel variable
   list exists. **(unverifiable from the repo whether it's set correctly)**
6. **Verify Cloudinary "Allow delivery of PDF and ZIP files" is enabled**
   in Cloudinary → Settings → Security. New/free accounts block PDF
   delivery by default — uploads return 200 and appear in the Media
   Library, but every delivery URL then 401s forever, which would silently
   break every quote/invoice PDF link the app has ever generated.
   `npm run check:cloudinary-pdf` is built to verify this directly but
   needs a working `.env` with the real Cloudinary values (the repo's own
   local `.env` had the wrong `CLOUDINARY_CLOUD_NAME` — the key's *label*,
   not its product-environment id — per `docs/ROADMAP.md`; check that
   before trusting a local run). **(owner action — Cloudinary dashboard,
   plus a script that needs real credentials this audit doesn't have)**
7. **Prove a database restore actually works, once, before this goes live
   with real customer data.** No backup/restore procedure exists anywhere
   in this repo. Whatever Neon offers (point-in-time restore) needs to be
   confirmed enabled and tested end-to-end. **(owner action — Neon
   console; nothing in the repo to check)**
8. **Run `npx prisma db push` against production and read what it reports
   before deploying any change that touched `prisma/schema.prisma`.** There
   is no migration history and no down path — the diff `db push` shows you
   before applying is the only safety check that exists.
   **(unverifiable from the repo — needs the real `DATABASE_URL`)**

**SOON**

9. **Set `GOOGLE_MAPS_SERVER_KEY`.** Without it, roof measurement is fully
   dead and travel-time booking silently falls back to straight-line
   distance — the estimate still looks normal, just wrong near any real
   geographic obstacle.
10. **Point Twilio's inbound Messaging webhook at `/api/crew/inbound`** for
    every SMS-capable company number that has the crew inbox switched on,
    and separately confirm `TWILIO_AUTH_TOKEN` specifically is set — the
    code notes a deployment can have working Twilio API keys but still be
    unable to verify inbound signatures without it. **(owner action —
    Twilio console, per-number)**
11. **Check Twilio's Advanced Opt-Out setting** (per-number or account-wide
    Messaging → Settings) before deciding `SMS_OPT_OUT_SEND_CONFIRMATION` —
    if Twilio is already sending STOP/START confirmations, setting this
    `true` double-sends; if it isn't, leaving it unset means nobody
    confirms an unsubscribe.
12. **Turn off Stripe's own "upcoming renewal" emails** (Settings → Billing
    → Subscriptions and emails) before `/api/cron/renewal-reminders` goes
    live — it's a single account-wide toggle this repo cannot read or set,
    and leaving it on double-emails monthly customers and mis-times annual
    ones.
13. **Rotate the three secrets that were pasted into a chat transcript**
    (Cloudinary API secret, Neon database password, `BETTER_AUTH_SECRET`)
    per `docs/TODO.md`.
14. **Fix the Resend DNS** for `fieldquo.com` — TXT at `resend._domainkey`,
    delete the stale `privateemail._domainkey` record, one SPF record only.
15. **Add a retry-once wrapper around the first database call in
    request-critical paths** (especially the crons — none currently have
    one) for Neon's documented `P1001` cold-start failure. AGENTS.md states
    the expectation; no code implements it.
16. **Decide whether `RESEND_API_KEY` going missing should call
    `recordError()`, not just `console.warn`** — right now a dead email
    pipeline produces zero rows in `/platform/errors`, the one place staff
    are told to look.
17. **Give the Stripe webhook the same audit/repair tooling Retell has.**
    `lib/voice/webhookAudit.js` exists because a misrouted webhook was
    already the root cause of one outage; the Stripe Connect-vs-platform
    misconfiguration above is the same class of bug and currently has no
    equivalent detection — it was found here by reading code and Stripe's
    docs, not by anything the app itself surfaces.

**TIDY**

18. Consider basic push alerting (even a single email) on new
    `PlatformErrorLog` rows above some severity, or on a cron returning a
    non-2xx — right now everything here is pull-only.
19. Wire the remaining 11 crons to call `recordError()` on an unhandled
    top-level exception, not just for the specific business conditions a
    few of them already cover.
20. `structuredClone`, `Array.at`, and `dvh` all need Safari 15.4+
    (2022) — almost certainly fine for this launch, worth a one-line note
    in the support playbook if a very old device ever gets reported.
