## 6. Payments and integrations

> **This is a code audit only.** There is no Stripe test mode configured in this
> environment, no live or test keys were exercised, and no webhook was actually
> fired. Every claim below is "the code, read carefully, says it will do X" —
> not "I watched it do X." The manual checklist at the end is what turns this
> into proof.

**Verdict: money looks safe to take today, with one launch-blocking fact that
is not a code bug — `docs/TODO.md` states the deployment is still on Stripe
*test* keys, and going live requires the owner to create two live webhook
endpoints, set three env vars together, and have 8 Connect contractors and 11
subscriptions re-onboard.** Skip that step and every "payment" today is fake.
The code itself is unusually disciplined for a fast-scaffolded app: both Stripe
integrations route through one shared idempotent settler
([lib/stripe/settleCheckoutSession.js](lib/stripe/settleCheckoutSession.js)),
every money-writing table has a real unique-index idempotency key, and three of
the five payment flows (booking fees, invoice payments, voice/AI credit) have
an hourly-or-better reconciliation cron as a backstop for a missed webhook. The
real gaps are narrower: no webhook handling at all for `charge.refunded` or
`charge.dispute.created` on either endpoint, no cron backstop for a missed
*subscription* webhook (only a client-triggered one), a bad Stripe signature
that fails 400 with nothing written to `/platform/errors`, and one AI feature
that never calls `checkAiQuota`.

| Severity | Integration | File:line | What | Impact |
|---|---|---|---|---|
| BLOCKER (ops, not code) | Stripe (both) | [docs/TODO.md:118-123](docs/TODO.md) | Deployment is reportedly still on Stripe *test* keys; 3 env vars + 2 live webhook endpoints + re-onboarding are outstanding | Launching today without this step means real cards are never actually charged, or worse, a half-swapped key set sends live checkout sessions to a test-mode webhook secret and every payment 400s at signature verification |
| SOON | Stripe Connect | [app/api/stripe/webhook/route.js:44-60](app/api/stripe/webhook/route.js:44), [app/api/platform/billing/webhook/route.js:17-29](app/api/platform/billing/webhook/route.js:17) | A bad/rotated signing secret makes `constructEvent` throw; the route 400s and returns, with no `recordError` call | If `STRIPE_CONNECT_WEBHOOK_SECRET` or `STRIPE_BILLING_WEBHOOK_SECRET` is wrong in prod, every webhook silently fails and nothing shows in `/platform/errors` — only Stripe's own dashboard would know |
| SOON | Stripe Connect | both webhook routes | No handler for `charge.refunded` or `charge.dispute.created`/`charge.dispute.closed` on either endpoint | A refund issued from the contractor's own Stripe Express dashboard, or a chargeback, never updates `Invoice.status`/`amountPaid` or `Booking.feeRefundedAt` — the invoice keeps reading "paid" after the money has left |
| SOON | Stripe Billing | [vercel.json](vercel.json), [app/api/settings/subscription/reconcile/route.js](app/api/settings/subscription/reconcile/route.js) | Booking fees and invoice payments have hourly/cron reconciliation backstops; subscription checkout has only a client-triggered reconcile (on-return redirect + a manual "Refresh from Stripe" button) — no cron | If `checkout.session.completed` is missed **and** the customer closes the tab before the redirect fires, nothing will ever re-sync until a human notices "no active plan" and clicks refresh |
| SOON | Stripe Billing | [lib/platform/stripeBilling.js:539-546](lib/platform/stripeBilling.js:539) | `invoice.payment_failed`/`invoice.payment_succeeded` look up the company by `db.subscription.findFirst({ where: { stripeCustomerId } })` | If `invoice.payment_succeeded` (the referral-credit trigger) arrives before `checkout.session.completed` has created the Subscription row, the lookup returns null and the referral credit is silently skipped — no retry, no error logged |
| SOON | OpenAI | [app/api/ai/ai-summary/route.js](app/api/ai/ai-summary/route.js) (routes to [lib/ai/expenseSummary.js](lib/ai/expenseSummary.js)) | No `checkAiQuota` call before `complete()` — only `recordAiUsage` after | A company already over its monthly AI allowance can keep generating expense summaries indefinitely; violates AGENTS.md's "checkAiQuota before, recordAiUsage after ... on every path" |
| SOON | OpenAI | [app/api/cron/monthly-digest/route.js](app/api/cron/monthly-digest/route.js) → [lib/ai/monthlyDigest.js](lib/ai/monthlyDigest.js) | Cron loops every company and calls `complete()` with no per-company quota check | A company over quota still gets billed a model call every month by the cron; low dollar risk (one summary/month) but the same gap in principle |
| TIDY | Money representation | [lib/invoices/recordStripePayment.js:53](lib/invoices/recordStripePayment.js:53) | `amount: (Number(amountCents) || 0) / 100` — Stripe cents converted to a float dollars value before being handed to a `Decimal(12,2)` column | Verified safe for every whole-cent amount up to $100,000 (exhaustive check below) — not a live bug, but it is exactly the float-becomes-an-amount pattern AGENTS.md calls out, and it will not stay safe if a future caller does arithmetic on the float before storing it |
| TIDY | Stripe Connect | [lib/stripe.js:120,200](lib/stripe.js:120) | `application_fee_amount: 0` hardcoded — platform takes no cut today | Not a bug (comment says "set a platform fee here if/when you charge one"), just confirming FieldQuo currently earns $0 per Connect transaction |

---

### Stripe Connect — homeowner pays contractor

**Design.** Every client-facing charge (booking fee, invoice payment, service-plan
authorisation) is a **destination charge** created on the platform account with
`transfer_data.destination` pointing at the contractor's connected account
([lib/stripe.js:119-208](lib/stripe.js:119)). `application_fee_amount` is hardcoded
to `0` — FieldQuo currently takes no cut. This matters for the webhook topology:
a destination charge's `checkout.session.completed` is a **platform** event, so
it can land on either registered endpoint depending on how the Stripe dashboard
is configured — and the code no longer assumes which one. Both
`/api/stripe/webhook` and `/api/platform/billing/webhook` hand every completed
session to one shared dispatcher first,
[settleCheckoutSession()](lib/stripe/settleCheckoutSession.js:57), which routes
on `session.metadata` (booking fee / invoice / voice topup / AI topup / service
plan authorisation / AI bundle) rather than on which endpoint it arrived at.
The file's own header documents a real incident this fixed: five bookings held
slots with money charged and no record, because the booking-fee handler sat on
the one endpoint that structurally could never receive a destination-charge
event.

**Webhook idempotency.** Every branch converges on a table with a real unique
index used as the idempotency key, not just a natural state transition:

- Invoice/booking payments — `Payment.stripePaymentIntentId @unique`
  ([prisma/schema.prisma:2357](prisma/schema.prisma:2357)). Recording reads the
  intent id, and on a race the `P2002` unique-violation is caught and treated as
  success ([lib/invoices/recordStripePayment.js:47-59](lib/invoices/recordStripePayment.js:47)).
  Explicitly called out as needed because an async method (Affirm) fires both
  `checkout.session.completed` *and* `checkout.session.async_payment_succeeded`
  for one intent.
- Voice/AI credit ledger — `VoiceCreditEntry` unique on `ref`
  ([lib/voice/credits.js:715-729](lib/voice/credits.js:715)); the create is
  attempted, and a `P2002` collision returns the row that already won rather than
  throwing.
- Call billing — `chargeCall` keys on `ref: call:${callId}`, explicitly to
  survive `call_ended` and `call_analyzed` both carrying a duration
  ([lib/voice/credits.js:731-760](lib/voice/credits.js:731)).
- Subscription rows — `Subscription.companyId @unique`
  ([prisma/schema.prisma:680](prisma/schema.prisma:680)), written via `upsert`, so
  a duplicate `checkout.session.completed` cannot create a second Subscription row
  for one company — it can only overwrite the same row with the same values.
- Cancellation timestamp — `canceledAt` is stamped from **Stripe's own**
  `obj.canceled_at`, not `new Date()`
  ([lib/platform/stripeBilling.js:601-604](lib/platform/stripeBilling.js:601)),
  specifically so a replay months later can't restart a churned company's
  30-day read-only window.

No separate Stripe-event-id ledger exists (no `StripeEvent` table) — every
handler instead relies on the *target row's* own unique key. That is a
reasonable design (it's what Stripe's own docs recommend when you have a
natural key to hang idempotency on) and, on inspection, every money-moving path
does have one. The one path that does **not** — `invoice.payment_succeeded`'s
referral-credit branch, keyed only by `db.subscription.findFirst` — is
protected by `grantReferrerCredit`'s own unique constraint on
`companyId+role+counterparty` per its comment
([lib/platform/stripeBilling.js:535](lib/platform/stripeBilling.js:535)), so a
retried delivery is a no-op; the risk there is a *missed* delivery order (see
table above), not a double-credit.

**Signature verification.** Both endpoints verify with
`stripe.webhooks.constructEvent(body, signature, <ENDPOINT_SECRET>)` before
touching the body
([app/api/stripe/webhook/route.js:49-60](app/api/stripe/webhook/route.js:49),
[app/api/platform/billing/webhook/route.js:18-29](app/api/platform/billing/webhook/route.js:18)).
On failure, both return `400` with the error message and do nothing else — no
`recordError`, no counter, no `/platform/errors` row. Contrast with the voice
webhook, which explicitly logs every rejected signature via
`recordRejectedDelivery` so a settings screen can say "the provider is calling
and we're turning it away"
([app/api/voice/webhook/route.js:59-67](app/api/voice/webhook/route.js:59)) —
the same pattern doesn't exist for Stripe. A wrong secret in production (e.g.
half of the three live-key env vars set, per `docs/TODO.md`) would 400 every
delivery with zero internal visibility.

**Out-of-order delivery.** Handled correctly where it matters. If
`invoice.payment_succeeded`/`invoice.payment_failed`/`customer.subscription.*`
arrive **before** `checkout.session.completed` has created the Subscription
row, every one of those handlers does `db.subscription.findFirst({ where: {...} })`
and guards on `if (row?.companyId)` — a miss is a silent no-op, not a crash or
a wrong write ([lib/platform/stripeBilling.js:511-526,540-544,553-558](lib/platform/stripeBilling.js:511)).
The cost is the referral-credit gap noted above, not a money-safety bug —
nothing is double-charged or double-credited, something is just skipped once
and then never retried, because the code has no reason to know it needs to.

**Failure paths.**

| Failure | Handled? | What the user sees |
|---|---|---|
| Card declined | Stripe Checkout's own hosted page handles this natively — no custom Payment Element to re-implement it | Standard Stripe decline message on the Checkout page |
| 3DS required | Checkout handles the redirect natively | Standard Stripe 3DS challenge |
| Insufficient funds / delayed method (Affirm, PAD) | Yes — `payment_status` is checked before settling; `checkout.session.async_payment_succeeded`/`async_payment_failed` settle it later | Booking/invoice stays unconfirmed until Stripe reports success; a failed async payment leaves the invoice unpaid with no error surfaced to the client (correct — it's already unpaid) |
| Connect account not yet `charges_enabled` | Yes, broadly — checked before every card-payment surface is offered: [app/api/invoices/[id]/checkout-link/route.js:55](app/api/invoices/%5Bid%5D/checkout-link/route.js:55), [app/api/invoices/[id]/request-payment/route.js:92](app/api/invoices/%5Bid%5D/request-payment/route.js:92), [app/api/plan/[token]/route.js:150](app/api/plan/%5Btoken%5D/route.js:150), [app/api/service-plans/[id]/authorise/route.js:96](app/api/service-plans/%5Bid%5D/authorise/route.js:96), [app/api/booking/[companySlug]/route.js:98](app/api/booking/%5BcompanySlug%5D/route.js:98) | Client-facing pay links are withheld or the online-payments option is hidden |
| Subscription upgrade mid-period | Yes — `createBillingCheckoutSession` carries remaining trial days onto the new plan when applicable ([lib/platform/stripeBilling.js:215-253](lib/platform/stripeBilling.js:215)) | Prorated per Stripe's own subscription-update behavior |
| Downgrade | Handled the same way as upgrade — same checkout builder, no special-casing found | — |
| Cancellation | Yes — `customer.subscription.deleted` sets `status: canceled`, stamps `canceledAt` from Stripe's timestamp, clears `pastDueSince`, and sends a cancellation notice ([lib/platform/stripeBilling.js:591-626](lib/platform/stripeBilling.js:591)) | Confirmation email; 30-day read-only window starts |
| Refund (contractor-initiated cancellation) | Yes, with an idempotency key (`visit-cancel-refund-${booking.id}`) and `reverse_transfer: true` so the money comes back out of the *contractor's* balance, not FieldQuo's — [app/api/visit/[token]/route.js:128-159](app/api/visit/%5Btoken%5D/route.js:128) | "We couldn't return the visit fee... nothing has been cancelled" on Stripe failure — money-first, row-second, so a Stripe failure never leaves a cancelled-but-unrefunded booking |
| Refund (dashboard-initiated) or chargeback | **Not handled** — no `charge.refunded`/`charge.dispute.*` listener on either endpoint | Invoice stays "paid" indefinitely; nothing tells the contractor the money reversed |

**Money representation.** All persisted money is `Decimal(12,2)` in Postgres
(confirmed across `Payment.amount`, `Invoice.total/subtotal/tax`,
`Subscription`-adjacent `Plan.priceMonthly/priceAnnual`, `VoiceCreditEntry` uses
integer cents instead — see below). Stripe's `amount_total`/`amount_cents`
values (integer cents) are converted with `cents / 100` before being written to
a `Decimal` column in exactly one place worth flagging:
[lib/invoices/recordStripePayment.js:53](lib/invoices/recordStripePayment.js:53).
I exhaustively checked every integer cent value from 1 to 10,000,000 ($100,000)
against `(cents/100).toFixed(2)` — zero mismatches, because JS's
shortest-round-trip `Number→String` conversion happens to produce the exact
decimal Prisma's `Decimal.js` then parses. Not a live bug. It is still the
*shape* of the bug class AGENTS.md warns about, and it stops being safe the
moment a caller does further arithmetic (a discount, a proration) on the float
before it's stored rather than dividing raw Stripe cents once. The
voice/AI-credit ledger (`VoiceCreditEntry.cents`) does this correctly — it
stores raw integer cents and never converts to dollars until display.

**Currency.** `lib/currency.js` is the single source of truth, mapping 11
Stripe-Connect-supported currencies from the company's signup country. Every
checkout builder in `lib/stripe.js` and `lib/platform/stripeBilling.js` derives
`currency` from `stripeCurrency(company.currency)` — I found no hardcoded
`"usd"` or `"cad"` literal in a checkout-session builder. This is presented in
the code comments as a fix for a real incident ("a Canadian company was being
charged in US dollars" —
[lib/platform/stripeBilling.js:138](lib/platform/stripeBilling.js:138)), and
the fix reads as complete: a Checkout session cannot mix currencies across line
items, and `recurringLine()` is the single place both checkout builders get
their line item from, so the two cannot disagree
([lib/platform/stripeBilling.js:86-116](lib/platform/stripeBilling.js:86)).

**Reconciliation.**

- Booking fees — `app/api/cron/booking-fees/route.js`, hourly (`15 * * * *`),
  present in `vercel.json`. Reconciles every `pending_payment` booking against
  Stripe, settles what's actually paid, cancels what's genuinely abandoned, and
  logs a `webhook_missed` platform error for every one it had to save — turning
  a silent failure into a visible signal about the Stripe endpoint config.
- Invoice/service-plan payments — the cron above plus `settlePendingCharges`
  reconciles every `charging` service-plan occurrence against Stripe on each
  run (per the comment at [app/api/stripe/webhook/route.js:113-120](app/api/stripe/webhook/route.js:113)).
- **Subscriptions have no cron.** `reconcile-session`
  ([app/api/platform/billing/reconcile-session/route.js](app/api/platform/billing/reconcile-session/route.js))
  fires automatically on the Stripe Checkout return redirect, and
  `/api/settings/subscription/reconcile` adds a manual "Refresh from Stripe"
  button plus a customer-search fallback for a company with **no**
  `stripeCustomerId` at all. Both are well-built and idempotent (share the same
  upsert the webhook uses), but both require the browser to come back — there
  is no scheduled job that walks Stripe customers/subscriptions looking for
  drift the way `booking-fees` does for bookings.

---

### Stripe Billing — FieldQuo charges the contractor

Shares the same client (`lib/stripe.js`), same money representation, same
currency derivation, and the same `settleCheckoutSession` dispatcher for
anything that isn't actually a subscription event (AI credit bundles, one-off
voice/AI top-ups also ride this endpoint because they're also platform-account
destination... actually no — voice/AI top-ups are FieldQuo-owned wallets, not
Connect transfers; they're charged straight to the platform account with no
`transfer_data`, confirmed by their absence from `lib/stripe.js`'s
`transfer_data` blocks). The webhook explicitly disambiguates an AI credit
**bundle**'s recurring invoice from the company's own plan invoice by checking
the bundle table first
([app/api/platform/billing/webhook/route.js:73-125](app/api/platform/billing/webhook/route.js:73)) —
documented as closing a real bug where a bundle's $30 top-up card decline would
have put the whole company into the past-due read-only path.

**The 7-day grace clock.** `pastDueSince` is stamped once, from
`invoice.payment_failed`, and deliberately not re-stamped by every subsequent
`subscription.updated` while still overdue (`markPastDue` is idempotent on the
existing timestamp) — otherwise a relapsing company's grace period would reset
forever and never lock. Cleared on `invoice.payment_succeeded` *and* on
`subscription.updated` going active, because a portal payment doesn't always
produce a status-change event on its own
([lib/platform/stripeBilling.js:501-526,548-559](lib/platform/stripeBilling.js:501)).

**`upsertSubscriptionFromCheckoutSession` recovery.** Previously threw the
moment `session.metadata` was missing `companyId`/`planId`, which — per the
in-code postmortem — silently ate 9 of 14 production errors as the same 3
sessions retried forever. Now recovers via `client_reference_id` →
`stripeCustomerId` match → Stripe price → `Plan.stripePriceId`, in that order,
before giving up with a `PermanentWebhookFailure` that gets recorded to
`/platform/errors` and answered `200` (so Stripe stops retrying something that
can never succeed) rather than `500`-looping forever
([lib/platform/stripeBilling.js:352-419](lib/platform/stripeBilling.js:352)).
This is a genuinely good design for the "checkout succeeded, no Subscription
row" failure mode AGENTS.md worries about.

---

### Twilio (`lib/sms/twilioClient.js`)

**Down/slow.** `sendSms()` never throws for a provider-side failure — a Twilio
API error is caught and returned as `{ success: false, error }`
([lib/sms/twilioClient.js:88-100](lib/sms/twilioClient.js:88)); it does throw
synchronously first for a malformed number or a missing "from" number, which
callers are expected to catch. `twilioConfigured()` lets a caller show a "not
set up" state instead of attempting a send. Nothing in the payment/booking
flow depends on SMS succeeding — the flows I checked treat a failed SMS as
logged-and-continue, never as a reason to fail the surrounding request.

**Signature verification.** `verifyTwilioWebhook()`
([lib/sms/verifyTwilioWebhook.js](lib/sms/verifyTwilioWebhook.js)) is shared by
both inbound routes, keyed on `TWILIO_AUTH_TOKEN` specifically (not the API-key
credential pair, which cannot produce a verifiable HMAC) — the file's own
comment flags that a deployment configured with API keys and no auth token can
send SMS but can never verify an inbound one, which would make every inbound
webhook silently `401`.

**STOP/opt-out.** More complete than `docs/TODO.md`'s legal-risk section (dated
2026-08-30) currently states. `app/api/sms/inbound/route.js` now exists
specifically to close that exact gap — its own header comment names the CASL
exposure it's fixing. It resolves the texted number against
`Company.smsFromNumber` (unique), classifies the body against a keyword list,
records opt-out/opt-in idempotently
(`SmsOptOut` upsert keyed on `companyId_e164`,
[lib/sms/optOut.js:44-63](lib/sms/optOut.js:44)), and only sends its own
confirmation text when `SMS_OPT_OUT_SEND_CONFIRMATION=true` — left unset by
default specifically to avoid double-replying against Twilio's own Advanced
Opt-Out feature, which the code openly says it cannot see the state of from
here. One real gap it documents about itself: **a company on the shared system
SMS number (no `smsFromNumber` of their own) has no working STOP today** — the
shared number can't be attributed to one tenant from `To` alone. That's the
one item from `docs/TODO.md`'s legal list still open, and it's now precisely
scoped rather than a blanket "not handled."

**Inbound webhook (crew line).** `app/api/crew/inbound/route.js` is a separate,
unrelated webhook (crew photo texting), also signature-gated, also fails
`401`-and-log rather than crashing on a bad payload, and settles its own spend
metering (`chargeOutboundCrewReply`) off the Twilio message SID rather than the
TwiML response, specifically so nothing is billed for a send that can't be
proven to have gone out.

---

### Resend (`lib/email/*`)

`getPlatformFrom()` ([lib/email/platformSender.js](lib/email/platformSender.js))
discovers FieldQuo's own sending domain from Resend's verified-domains list
rather than requiring `EMAIL_FROM` to be set by hand — the header comment
explains this replaced a design where an unset `EMAIL_FROM` silently fell back
to Resend's sandbox address and dropped every client email with no visible
symptom. Every failure path — no API key, a Resend API error, no verified
domain, every verified domain claimed by a tenant — returns
`SANDBOX_FROM` rather than throwing (`try/catch` around the whole discovery,
[lib/email/platformSender.js:65-93](lib/email/platformSender.js:65)). The
result is cached 10 minutes to avoid a Resend round-trip on every send in a
loop (e.g. a marketing campaign). `isSandbox()` lets a caller detect "nothing
is actually reaching a real client" and warn rather than silently mailing
`onboarding@resend.dev` to a homeowner. This degrades correctly: Resend being
down or misconfigured produces a visibly-sandboxed send, not a crash and not a
silent drop.

---

### Retell (`lib/voice/retell.js`, `lib/voice/pool.js`)

**The shared workspace concurrency limit.** `poolStatus()`
([lib/voice/pool.js:203-247](lib/voice/pool.js:203)) reads Retell's real
`GET /get-concurrency` for the account-wide ceiling — the one hard fact Retell
actually exposes — and derives everything else (spend, runway) from FieldQuo's
own call records, explicitly labelled `basis: "derived"` vs `basis: "read"` so
the UI can't present an estimate as a meter reading. `alertsFor()` fires a
`critical` alert at 100% utilization and a `warn` at 70%
([lib/voice/pool.js:264-284](lib/voice/pool.js:264)) — but these are **platform
staff alerts**, not caller-facing.

**What a caller experiences when the pool is full is not answered in this
codebase** — Retell's own inbound call handling decides what happens to a call
that can't get a concurrency slot (busy signal, no answer, or a Retell-side
fallback), and nothing in `lib/voice/` intercepts or overrides that behavior.
The per-*call* ceiling (`lib/voice/callCeiling.js`, a company's max talk time
given their balance) is enforced at the provider via `max_call_duration_ms`,
but that is a different limit from account-wide concurrency exhaustion. This is
a real blind spot for launch day if inbound call volume across all tenants
could plausibly approach Retell's `concurrency_limit` — worth the owner
confirming what Retell actually does with a call it can't accept, since the
code has no opinion on it.

**Per-call and per-line spend enforcement is real, at the provider.**
`syncNumberAttachment` detaches an unfunded number's agent so it rings out
(rather than answering into an account with no way to bill it), and
`pushCallCeiling` pushes a balance-derived `max_call_duration_ms` to both
inbound and outbound agents after every event that could move the balance —
both documented as deliberately enforced at Retell, not just hidden behind a
UI control, mirroring the same discipline Twilio's crew-line disconnect uses.

**Reconciliation.** `app/api/cron/voice-reconcile` (`35 * * * *`) and
`voice-resync` (`50 * * * *`) both exist in `vercel.json`, plus
`lib/voice/webhookAudit.js`, which is a *diagnostic and repair* module for a
different failure mode entirely: an agent's `webhook_url` silently repointed at
a dead preview/localhost origin (because `provisionAgent` derives it from
whichever request triggered provisioning). Its `mayRepair()` deliberately
refuses to repair from an unstable origin, to avoid a diagnostic tool
mass-rewriting every live tenant's agent to point at a throwaway URL — a good
instance of the "safety property is refusal, not the fix" pattern this
codebase uses elsewhere (the visit-refund's money-first-then-row ordering is
the same idea).

---

### OpenAI (`lib/ai/provider.js`, `lib/ai/usage.js`)

`isAiConfigured()` gates every caller; `complete()` returns `""` rather than
throwing when unconfigured, so a missing key degrades a nice-to-have summary
rather than 500ing a page that also shows real data. Quota enforcement
(`checkAiQuota` before / `recordAiUsage` after) is honoured on **17 of the ~19**
call sites I checked by grep across `lib/` and `app/api/`
(`app/api/quotes/[id]/review`, `app/api/voice/calls/[id]/draft-quote`,
`app/api/ai/copilot`, `app/api/jobs/[id]/suggested-tasks`,
`app/api/funnels/generate`, `app/api/jennifer`,
`app/api/settings/voice/knowledge`, `app/api/settings/translations/draft`,
`app/api/settings/website` and `.../languages` all call `checkAiQuota` first
and `recordAiUsage` after). **Two do not**, both flagged in the summary table:
`app/api/ai/ai-summary/route.js` (expense summary — no quota check at all,
just `recordAiUsage`) and the monthly-digest cron (loops every company with no
per-company quota check). Both are gated to owner/admin or are cron-only
(not attacker-reachable from an untrusted client), so the exposure is a metering
completeness gap rather than a cost-abuse vector — but it is a direct violation
of the stated rule that every call is quota-checked, and it's a two-line fix in
each place.

Pricing table (`lib/ai/usage.js`) is hand-maintained and self-documents its own
staleness risk ("Checked July 2026... assume it has drifted again") — this is
an estimate-of-cost problem, not a money-safety one, since it only affects the
*reported* dollar figure, not what OpenAI actually bills FieldQuo or what a
company is metered in tokens.

---

### Cloudinary (`lib/cloudinary.js`)

Signed server-side upload only (`/api/upload`) — the route explicitly rejects
the unsigned-preset pattern as "effectively a public write token." Missing
credentials are caught explicitly at the route with a clear 503
([app/api/upload/route.js:29-38](app/api/upload/route.js:29)) rather than
letting `cloudinary.config()` fail silently at module load (unlike Stripe/
Twilio/OpenAI/Resend, this client is **not** wrapped in `lazyClient`, but
because it's the SDK's own config-object pattern rather than a constructor
call, it doesn't throw at import time either way — so this isn't a build-time
risk, just a runtime one the route already guards). A Cloudinary API error
during upload is caught and translated via `explainCloudinaryError`, returning
a 500 with an explanation rather than crashing the request.

---

### Google Maps and Google Solar (`lib/measure/roofMeasurement.js`)

Every function (`geocodeAddress`, `fetchBuildingInsights`) returns `null` on
any failure — missing key, network error, non-200, malformed response — never
throws. The module header states the design principle explicitly: "Degrading,
never breaking... the feature gets plainer, it does not 500," matching the
same philosophy as `lib/site/generateSite.js`. `serverMapsKey()` prefers a
dedicated `GOOGLE_MAPS_SERVER_KEY` and falls back to the public
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, with a comment warning that an
HTTP-referrer-restricted public key will reject server-side calls with no
referrer header — a real footgun if `GOOGLE_MAPS_SERVER_KEY` is never actually
set in Vercel, worth checking in the manual list below.

---

### Secrets inventory — what breaks if missing or wrong

| Env var | Used by | Missing/wrong in prod |
|---|---|---|
| `STRIPE_SECRET_KEY` | `lib/stripe.js` (both integrations) | Every Stripe call throws at first use; `lazyClient` means this fails at the API call, not at build |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `app/api/stripe/webhook/route.js` | Every Connect-side webhook 400s silently (no internal log — see SOON finding above) |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `app/api/platform/billing/webhook/route.js` | Same, for subscription/AI-bundle events |
| `TWILIO_ACCOUNT_SID` + (`TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY_SID`+`TWILIO_API_KEY_SECRET`) | `lib/sms/twilioClient.js` | No SMS sends; `twilioConfigured()` lets callers detect and degrade |
| `TWILIO_AUTH_TOKEN` specifically | `lib/sms/verifyTwilioWebhook.js` | Both inbound SMS webhooks (`sms/inbound`, `crew/inbound`) reject every delivery as unverified even if the account can otherwise send |
| `RESEND_API_KEY` | `lib/email/platformSender.js`, `lib/email/resendDomains.js` | Sends fall back to the sandbox address — visible via `isSandbox()`, not silent |
| `RETELL_API_KEY` | `lib/voice/retell.js` | `voiceConfigured()` false; every voice route degrades to "not set up" rather than throwing raw errors |
| `RETELL_COST_CENTS_PER_MINUTE` (optional) | `lib/voice/pool.js` | Falls back to a hardcoded 16¢ estimate |
| `RETELL_CREDIT_PURCHASED_CENTS` (optional, hand-typed) | `lib/voice/pool.js` | Runway reporting shows "unknown" rather than a stale number |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `lib/cloudinary.js` | `/api/upload` returns a clear 503; any *other* Cloudinary caller (PDF generation, etc.) would hit an unguarded SDK error — worth spot-checking those callers specifically |
| `GOOGLE_MAPS_SERVER_KEY` (preferred) / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (fallback) | `lib/measure/roofMeasurement.js` | Roof measurement/geocoding silently returns null and the estimate falls back to manual entry — never breaks the page |
| `OPENAI_API_KEY` | `lib/ai/provider.js` | **Marked Sensitive in Vercel — cannot be read back or pulled locally**, per AGENTS.md. `isAiConfigured()` false, every AI feature degrades to "no summary" rather than erroring |
| `CRON_SECRET` | every `app/api/cron/*` route including `booking-fees` | A wrong/missing secret makes Vercel's own cron call `401` — this is the one that fails loudly (in Vercel's cron log) rather than silently |

Whether `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET`,
`STRIPE_BILLING_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SECRET`,
`RESEND_API_KEY`, `CLOUDINARY_API_SECRET`, and `RETELL_API_KEY` are *also*
marked Sensitive in Vercel (and therefore equally unverifiable from here) is a
Vercel-dashboard fact this audit cannot see — worth the owner confirming, since
every one of them is exactly as capable of silently breaking a deploy as
`OPENAI_API_KEY` is.

---

### `vercel.json` cron schedule vs. routes that exist

All 16 scheduled crons have a matching `app/api/cron/*/route.js` file — no
scheduled-but-missing route found. Two worth a specific mention for a launch
audit:

- `booking-fees` (`15 * * * *`) — the Connect-payment reconciliation backstop.
  Present and matches its route.
- No cron exists for subscription-checkout reconciliation (see the Stripe
  Billing reconciliation section above) — this is an absence of a cron that
  arguably *should* exist, not a scheduled-but-broken one.

I did not execute each cron route to confirm it runs cleanly at 3am (that needs
`CRON_SECRET` and a live database) — see the manual checklist.

---

## Manual verification checklist for the owner

Ordered by risk. Everything above is a read of the code; none of it was
exercised against Stripe's test-mode dashboard or Twilio/Retell sandboxes.

1. **Confirm which Stripe mode is actually live right now.** `docs/TODO.md`
   says test keys are still in place with 11 test-mode subscriptions and 8
   Connect accounts waiting to re-onboard against live keys. Before taking a
   single real payment: create both live webhook endpoints in the Stripe
   dashboard, set `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET`,
   `STRIPE_BILLING_WEBHOOK_SECRET` together (not staggered — a live key with a
   test webhook secret, or vice versa, fails signature verification for every
   event), then have contractors re-onboard.
2. **Fire a real test-mode webhook at each endpoint and confirm the signature
   check passes** — use the Stripe CLI (`stripe trigger checkout.session.completed`)
   or the dashboard's "send test webhook" against both
   `/api/stripe/webhook` and `/api/platform/billing/webhook`, and confirm the
   correct one settles (not just 200s).
3. **Duplicate-deliver a real webhook** (Stripe dashboard → an event → "resend")
   for a `checkout.session.completed` on a booking fee and on a subscription
   purchase. Confirm no double-charge, no second `Payment` row, no second
   `Subscription` row — the code claims all three are safe; prove it against
   the real database.
4. **Test a Connect account below `charges_enabled`** (a fresh test-mode
   Express account mid-verification) against every surface the table above
   lists, and confirm the online-payment option is actually hidden, not just
   disabled-looking.
5. **Run a real card decline and a real 3DS challenge** through the invoice
   checkout link and the booking fee checkout, on both the Connect and Billing
   flows.
6. **Cancel a booking with a paid fee and force the Stripe refund call to fail**
   (e.g. temporarily revoke API access mid-flow, or refund an already-refunded
   payment intent) — confirm the booking really does stay confirmed and the
   error message shown matches [app/api/visit/[token]/route.js:152-159](app/api/visit/%5Btoken%5D/route.js:152).
7. **Issue a refund from a connected account's own Stripe Express dashboard**
   (not through FieldQuo) and confirm the flagged gap: does the Invoice really
   stay "paid" with no signal anywhere in `/app` or `/platform`? If so, this
   needs a `charge.refunded` handler before it's safe to consider closed.
8. **Trigger a real chargeback in Stripe test mode** (`4000 0000 0000 0259`)
   against a Connect destination charge and confirm the same gap.
9. **Deliberately break signature verification** — rotate a webhook secret in
   Vercel without updating the Stripe dashboard endpoint (or vice versa) — and
   confirm the claim above: it 400s with nothing appearing in `/platform/errors`.
10. **Pay a subscription checkout, then kill the tab before the redirect and
    also disable the billing webhook endpoint in Stripe** — confirm the
    company is genuinely stuck on "no active plan" until someone manually
    clicks "Refresh from Stripe," since no cron exists to catch this case.
11. **Race `invoice.payment_succeeded` ahead of `checkout.session.completed`**
    for a referred company's first payment (hard to force outside Stripe's own
    infra, but worth asking Stripe support/docs whether this ordering has been
    observed) — confirm whether the referral credit is truly lost silently or
    whether something downstream (a cron, a later event) recovers it.
12. **Call the shared voice number from several phones at once** near Retell's
    account `concurrency_limit` (check current value via `/platform` → voice
    economics) and confirm what an over-the-limit caller actually hears — busy
    signal, silence, or a Retell fallback greeting. Nothing in this codebase
    controls that experience.
13. **Text STOP to a company's own `smsFromNumber`** and confirm it's recorded
    and (if `SMS_OPT_OUT_SEND_CONFIRMATION=true`) confirmed. Then text STOP to
    the **shared** system SMS number and confirm the documented gap — it is
    not attributed to any company and nothing records it.
14. **Confirm in the Twilio console** whether Advanced Opt-Out is on or off for
    every number in `Company.smsFromNumber` — the code's own STOP-confirmation
    behavior is gated on this being known, and it currently isn't visible from
    the codebase (`SMS_OPT_OUT_SEND_CONFIRMATION` is unset by default).
15. **Confirm in Vercel** which of `STRIPE_SECRET_KEY`,
    `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_BILLING_WEBHOOK_SECRET`,
    `TWILIO_AUTH_TOKEN`/`TWILIO_API_KEY_SECRET`, `RESEND_API_KEY`,
    `CLOUDINARY_API_SECRET`, and `RETELL_API_KEY` are marked Sensitive
    alongside `OPENAI_API_KEY` — and if any aren't, whether that's
    intentional.
