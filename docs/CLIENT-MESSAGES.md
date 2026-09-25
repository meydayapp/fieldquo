# Client messages — what FieldQuo sends to a homeowner on its own

What reaches a contractor's client (a homeowner, a property manager) without
anybody at the company pressing Send in that moment, and the policy that
decides whether it may.

"Client" here means the contractor's customer. FieldQuo's own emails to the
companies that subscribe (trial reminders, onboarding) are in
`docs/ONBOARDING-EMAILS.md`; the sales team's outreach to prospects is not a
client message either.

---

## The auto-send policy (owner, 2026-09-22)

In the owner's words, what may go to a client automatically:

> "the invoice yes and any receipts, the follow-ups, the thank-you email, the
> change orders, the booking or reschedule confirmation — but not the quote"

As a standing rule:

| May send automatically | Never sends automatically |
|---|---|
| Invoices (including payment-schedule stages and service-plan invoices) | **The quote.** A quote reaches a client only when a person presses Send on it (`POST /api/quotes/[id]/send`, the one route that emails a quote). |
| Receipts for any payment | |
| Follow-ups | |
| The thank-you email (and the review request that is FieldQuo's version of it) | |
| Change orders | |
| Booking confirmations, reschedule confirmations (and cancellations) | |

What "not the quote" means in code:

- Anything that **creates** a quote without a person — the instant-quote
  form, a call, the AI employee, a migration import — creates it as a
  **draft** (`needsReview: true` where the source is automated) and tells the
  company. It never sets `status: "sent"` and never emails the quote or its
  `/q/<token>` link.
- A new automatic path that would send a quote must instead stop at **draft +
  notify the company**. That is the rule for any future feature, not a
  default somebody can flip in Settings.
- Follow-ups that re-share the link of a quote a **person already sent** are
  follow-ups, and are allowed.
- The client's own signed copy after they accept is a receipt of their
  signature, not the quote being sent to them for a decision, and is allowed.

A company can still turn any of the allowed automations off where a setting
exists (below). The policy is a ceiling on what FieldQuo automates, not a
promise that every allowed message is on for every company.

Adding a NEW automation that sends something (even one on the allowed list)
costs money per message — Resend per email, Twilio per SMS — and changes what
every company's clients receive. It needs the owner's yes first; say what it
costs when asking.

---

## Audit — every automatic client-facing sender (2026-09-25)

Read from the code, not from settings screens. "Human press" means a person
at the company pressed a button in the same request that sends.

### Allowed by the policy, and sending automatically today

| Sender | Trigger | What goes out | Gate (default) | Policy |
|---|---|---|---|---|
| Payment-schedule deposit / stage request — `lib/paymentSchedule/run.js` `requestStagePayment` | Quote accepted (`onQuoteAccepted`) for the deposit; `/api/cron/payment-schedule` daily for job-start / halfway / job-end stages | Invoice email asking for that stage's share, with a pay link; the invoice becomes `sent` | Only when the company saved a payment schedule (default: none) | Invoice — allowed |
| Service-plan visit invoice — `lib/servicePlans/run.js` `emailInvoice` | `/api/cron/service-plans` daily | Invoice email with pay link, or a paid receipt when a saved card/debit succeeds | An active `ServicePlan` | Invoice + receipt — allowed |
| Service-plan payment receipt — `lib/servicePlans/run.js` (via Stripe `payment_intent.succeeded`) | Stripe webhook | Paid-invoice email | Same | Receipt — allowed |
| Quote follow-ups — `app/api/cron/follow-ups/route.js` | Cron, daily 08:00 | The follow-up wording plus the link to a quote a person already sent | `FollowUpRule` rows; three built-in rules (1, 7, 14 days after send) are seeded ON for every company; stop when answered/expired/replied | Follow-up — allowed |
| Opt-in follow-ups: `invoice_overdue`, `lead_no_response`, `job_completed` | Same cron | Company-written templates | Off until the company creates the rule | Follow-up / thank-you — allowed |
| Review request — `app/api/cron/review-requests/route.js` | Cron, hourly; `reviewDelayHours` (24) after the job is completed | Thank-you + review email with the satisfaction link | `Company.reviewRequestsEnabled` (default **off**) and a review URL | Thank-you — allowed |
| Booking confirmation — `lib/booking/finalizeBooking.js` | Client books online; a booking fee settles (Stripe webhook / cron); the voice AI or AI employee books | Email + calendar invite; SMS | Email always when there is an address; SMS on unless the company chose off (`bookingTextOn`) | Booking confirmation — allowed |
| Client moves / cancels on the manage page — `app/api/visit/[token]/route.js`, `.../reschedule/route.js` | Client action | Email + SMS confirming the move or cancellation | Same SMS switch | Reschedule confirmation — allowed |
| Office moves / cancels a visit — `app/api/appointments/[id]/route.js`, `app/api/jobs/[id]/visits/[visitId]/route.js` | Staff save (a human press, with a "don't notify" tick) | Email + SMS | `notifyClient` tick | Reschedule confirmation — allowed |
| Appointment confirmation on create — `app/api/appointments/route.js` | Staff save | Confirmation email | None | Booking confirmation — allowed |
| Appointment / visit reminder SMS — `app/api/cron/appointment-reminders/route.js` | Cron, hourly | Reminder text | `Company.appointmentReminderHours` (default **off**) | Booking family — allowed |

### Not named by the policy, sending automatically, and not a quote

| Sender | Trigger | What goes out | Gate (default) | Note |
|---|---|---|---|---|
| Prep guide — `app/api/cron/prep-guides` → `lib/prepGuide/send.js` | Cron, daily; `prepGuideLeadDays` (3) before the job start | Preparation email + PDF + technical documents | Per job "Don't send"; no company-wide off switch | Not a quote. Left as is. |
| Signed quote copy — `app/api/public/quotes/[token]/route.js` | The client accepts | Their signed PDF | None | The client's own receipt of their signature. Allowed. |
| Instant-estimate report — `app/api/instant-quote/[companySlug]/request/route.js` → `lib/estimate/report/publish.js` | The homeowner submits the public instant-quote form | "Your estimate" email + report PDF + `/estimate-report/<token>` link; "Starting at $X" figures only where the trade's visibility is `after_submit` or `range` (default `gated`: no figures) | `InstantQuoteConfig.enabled` per trade (default off) | **See "Decision for the owner" below.** The Quote itself stays `draft` + `needsReview`; nothing sets `sent`; `/q/<token>` refuses a draft. |
| AI employee replies — `lib/aiEmployee/inbound.js` | A client writes on Messenger / Instagram / WhatsApp / SMS / web chat | The AI's reply; in auto mode it may quote an instant-estimate **range** in chat (`create_instant_quote` tool) unless the trade is gated. No Quote row. | `AiEmployee.enabled` (off) **and** `mode: "auto"` (default `"ask"`, drafts only) | Not a quote document. Since 2026-09-22 it also never replies outside Meta's 24-hour window on any Meta platform. |
| SMS auto-acknowledgement — `lib/aiEmployee/smsChannel.js` `maybeAck` | A client texts the shared number and no AI replied | "Thanks — someone will reply shortly", at most once per thread per 24 h | None | Not a quote. |
| STOP/START confirmation — `app/api/sms/inbound/route.js` | The client texts STOP/START | Carrier-required confirmation | None | Required by law. |
| Portal login link — `lib/portal/loginLink.js` | The client asks for it on the company's site | Magic link | None | Client-initiated. |
| Signed waiver copy — `lib/waivers/service.js` | The client signs | Their copy | None | Client-initiated. |
| "On my way" SMS — `app/api/jobs/[id]/visits/[visitId]/route.js` | Crew taps On my way (human press) | Text | None | Human press. |

### The quote — never sent without a human press (verified)

| Path | What it does | Sends the quote? |
|---|---|---|
| `POST /api/quotes/[id]/send` | The only route that emails a quote (from the quote page and the builder's Send) | Only on a person's press |
| Instant-quote form → `createEstimateDraft` | Draft, `needsReview: true`, `createdVia: "instant_quote"` | No (the estimate report above is separate) |
| Voice call → `lib/voice/autoDraft.js`, `lib/estimate/callEstimate.js` | Draft kept for review | No |
| AI employee `create_instant_quote` | A range for the reply; no Quote row | No |
| Kitchen self-quote, funnel estimate, self-quote form, Meta lead ads | Lead / on-screen range / confirmation without price | No |
| `app/api/quotes/[id]/approve-estimate` | Approves the draft for sending | No — Send is still a separate press |
| `lib/estimate/estimateEmail.js` (`buildEstimateEmail`) | Builds a price-range email | Dead code — called only by `scripts/check-estimate-email.mjs` |

**Nothing needed changing to draft + notify**: no path auto-sends a quote.

### Allowed by the policy but NOT automatic today (listed, not built)

Each of these would be a new automation, so each needs the owner's yes and a
cost line before anyone builds it.

| Item | Today | What automating it would cost |
|---|---|---|
| **Invoice when a quote is accepted** (no payment schedule) | `ensureInvoiceForQuote` creates it as `draft`; someone presses Send | One email per accepted quote (Resend) |
| **Invoice when a job is completed** | Job completion creates tasks only; no invoice is made or sent | One email per completed job; needs a rule for which invoice (deposit already sent? balance?) |
| **Receipt for an ordinary Stripe invoice payment** | The company's owners/admins get `invoice_paid`; the client gets nothing from FieldQuo (Stripe's own receipt only if the connected account has it on) | One email per payment |
| **Receipt for a manually recorded payment** (cash, e-transfer, cheque) | None | One email per payment |
| **Thank-you email** | Only the review request (off by default, needs a review URL) and the opt-in `job_completed` follow-up rule | Turning the review request on by default: one email per completed job |
| **Change orders** | Sent on the creator's Send in the same form (`app/api/jobs/[id]/change-orders`, `.../[changeOrderId]/send`) — a change order does not exist until a person writes it, so this is already as automatic as it can be | — |
| **Change-order decision confirmation** | When the client approves or declines at `/api/public/change-orders/[token]`, nothing goes back to them | One email per decision |

---

## Decision for the owner

**The instant-estimate report email.** On 2026-09-18 the owner asked for the
QuickQuote-style report (ROADMAP: "The instant estimate becomes a report"),
and it is emailed to the homeowner the moment they submit the instant-quote
form — with "Starting at $X" figures when the company set that trade's
visibility to show them. On 2026-09-22 the policy became "not the quote".

This audit reads the report as **not the quote**: the Quote record stays a
draft for review, nothing marks it sent, `/q/<token>` refuses it, and the
report says "starting at", not a price for the job. So it was left alone.
If the owner means the report too, the change is small and specific: stop
`publishEstimateReport` from emailing (keep the page the homeowner is sent
to on screen), and email the report when the company approves and sends the
quote.

---

## Where each rule is enforced

- The one quote-send route: `app/api/quotes/[id]/send/route.js`.
- Automated drafts: `lib/estimate/createEstimateQuote.js` (`status: "draft"`,
  `needsReview: true`).
- Follow-up stop conditions: `lib/followUps/stopConditions.js`,
  `lib/followUps/readiness.js`.
- Meta's 24-hour window (WhatsApp, Facebook, Instagram):
  `lib/messaging/serviceWindow.js`, `lib/aiEmployee/decide.js`.
