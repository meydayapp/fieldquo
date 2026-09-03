# AUDIT — the notification feed

Research only. Nothing in this document has been built. It establishes what a
feed would be built *on*, what already tells a human (so a feed does not
double-notify), who is allowed to see what, and what the smallest genuinely
useful first version is.

The owner's words:

> a notification feed — "like a little banner or social media notification. all
> notifications should go there. quote approval, invoice payments, a new call
> coming in answered by AI, an instant-quote, an estimate request, a booking
> event in the calendar, somebody calling in sick — things people need to know,
> especially managers, admins, owners."

Plus: notify when a document or job log has been changed by someone else on the
team.

---

## 0. The one-paragraph answer

There is no `Notification` model, no bell, no read state, no service worker, no
web-push dependency, and no per-user delivery preference anywhere in the
product. What *does* exist is (a) `ActivityLog` — a company-wide, owner/admin-only,
append-only trail of *staff actions*, read by one page that fetches once on
mount; (b) `NotificationRule` — two company-level on/off switches that gate two
emails; and (c) four hand-rolled "email the owners and admins" blocks that each
re-derive their own recipient list. Roughly two thirds of the events on the
owner's list currently tell **nobody**. The events that *do* notify almost all
notify the **client**, not the company. So a feed is mostly greenfield, but it
lands on top of a real permission system that it can very easily leak through.

---

## 1. What exists today

### 1.1 `NotificationRule` — the whole of the current preference system

`prisma/schema.prisma:5825-5834`

```
model NotificationRule {
  id, companyId, type, threshold Decimal?, channel String @default("email"),
  active Boolean @default(true), createdAt
}
```

Read by exactly three files:

| File | What it does |
|---|---|
| `app/api/settings/notification-rules/route.js:15-32` | Owns `RULE_TYPES` — the closed catalog. Two entries only: `large_quote` (threshold, default OFF because the row must be created) and `invoice_paid` (no threshold, default **ON** — absence of a row means notify). |
| `lib/notifications/invoicePaymentNotice.js:70-78` | Reads the `invoice_paid` rule. |
| `app/api/cron/large-quote-check/route.js:58` | Reads `large_quote` rules, emails owners/admins. |

Three properties of this model matter for the design:

- **`channel` is written and read by nothing.** It defaults to `"email"`; POST
  writes it (`route.js:97`) and PATCH updates it (`route.js:139`); no consumer
  branches on it — `grep "\.channel"` across both readers and the route returns
  nothing.
  This is a live instance of AGENTS.md failure class #1, sitting in the exact
  table a feed would want to extend. A feed that adds `"in_app"` as a channel
  value must actually read the column, or delete it.
- **It is company-level, not per-user.** There is no way for one admin to mute
  something another admin wants. The owner's framing ("especially managers,
  admins, owners") is a *per-user* framing, and this table cannot express it.
- **The default-ON/default-OFF split is deliberate and documented**
  (`invoicePaymentNotice.js:18-26`): a rule type that ships after companies
  exist must default ON, or every existing company stays as blind as before.
  A feed inherits that reasoning.

### 1.2 `ActivityLog` — the closest thing to a feed that exists

`prisma/schema.prisma:6477-6504`, written only through `lib/activity/log.js`'s
`recordActivity()`, read only by `app/api/activity/route.js` →
`app/app/activity/page.js`.

Shape: `companyId`, `actorUserId`/`actorMemberId`/`actorName`/`actorRole`,
`viaImpersonation`, `action` (dotted verb), `entityType`, `entityId`, `summary`
(composed at write time), `metadata` Json, `createdAt`. Indexed
`[companyId, createdAt]` and `[companyId, entityType, entityId]`.

~80 call sites. The vocabulary already in use includes `quote.created`,
`quote.accepted`, `quote.declined`, `quote.deleted`, `invoice.sent`,
`payment.recorded`, `client.created/updated/deleted`, `job.deleted`,
`lead.converted`, `estimate.approved`, `expense.created`, `leave.requested`,
`leave.approved`, `leave.declined`, `leave.cancelled`, `timeEntry.createdForOther`,
`timeEntry.selfApproved`, `member.deactivated`, `billing.cancelled`,
`voice.callback.booked`, `accounting.exported`, `payroll.exported`, and a long
tail of `settings.*`.

**Why it is not a feed, precisely:**

1. It records **who did what**, not **what happened**. Client-driven events
   are shoehorned in with a fake actor —
   `app/api/public/quotes/[token]/route.js:513-534` passes
   `{ companyId }` with no member and `actorName: "Client (approval link)"`.
   That works for an audit trail and reads badly as a notification.
2. It is **owner/admin only** (`app/api/activity/route.js:26-31`), plus
   impersonation. A supervisor sees nothing. There is no per-recipient concept
   at all.
3. **No read state.** No `readAt`, no per-user join, no unread count.
4. **Never throws, and may silently drop rows** (`lib/activity/log.js:44-46`,
   documented as the deliberate trade). Acceptable for an audit trail whose
   purpose is "consult it when something looks wrong"; **not** acceptable as
   the sole store behind "you were told a $12,000 quote was accepted".
5. It fetches **once on mount** (`app/app/activity/page.js:47`) with no polling
   and no revalidation.
6. Every action is equal weight. The page's `toneFor()`
   (`app/app/activity/page.js:14-26`) already dot-colours a handful by family,
   which is a hand-rolled stand-in for the severity axis a feed needs.

**Conclusion:** `ActivityLog` is a good *source* of some feed events and a bad
*store* for a feed. Keep it as the audit trail it is. Do not overload it.

### 1.3 The four hand-rolled "email owners and admins" blocks

Each re-derives its own recipient list. All four use
`role: { in: ["owner", "admin"] }`. This is the copy-paste-instead-of-helper
failure class (AGENTS.md #4) already three-quarters of the way through
happening:

| File:line | Event | Recipients | Channel | Gated by |
|---|---|---|---|---|
| `lib/notifications/invoicePaymentNotice.js:80-83` | Stripe invoice payment landed | owner+admin, `active` | email | `invoice_paid` rule (default ON) |
| `app/api/cron/large-quote-check/route.js:55-62` | Quote created above threshold | owner+admin, `active` | email | `large_quote` rule (must be created) |
| `app/api/public/quotes/[token]/route.js:577-586` | Quote accepted or declined by client | owner+admin, `active`, `distinct: ["userId"]` | email | nothing |
| `app/api/self-quote/kitchen/route.js:203-208` | Kitchen designer request | owner+admin, `active`, `distinct: ["userId"]` | email | nothing |

The drift has already started: two use `distinct: ["userId"]` and two do not,
so a person who somehow holds two Member rows gets one email from two of these
and two from the others. All four hardcode the same role pair, so raising
supervisors into the audience means editing four files. `lib/ai/monthlyDigest.js:182`
is a fifth copy of the same query. A feed must consolidate this into one
recipient resolver or it will make the drift worse.

### 1.4 `JobPhotoMention` — the one existing per-person delivery record

`prisma/schema.prisma:7568-7593`, written by `lib/photoComments/notify.js`.

This is the closest thing in the codebase to a per-user notification row, and
its header says so explicitly (`lib/photoComments/notify.js:5-19`):

> This codebase has NotificationRule … and nothing else: no Notification model,
> no inbox, no bell icon backed by a table. Checked before building anything
> here. … If a real in-app notification centre gets built later, this table is
> exactly the data it would want to read; nothing here needs to be re-shaped
> for that.

Its columns are the vocabulary a feed should reuse: `notifiedVia`
(`sms | email | none`), `notifiedAt`, `skipReason`
(`self_mention | no_channel | crew_line_not_set_up | opted_out |
insufficient_balance | send_failed`). Its channel ladder — crew-line SMS first,
email as fallback, never both — is the only worked example of per-person
channel selection in the product.

### 1.5 `AiDigest` and the monthly digest — the batching precedent

`prisma/schema.prisma:5836-5849`; `lib/ai/monthlyDigest.js`;
cron `0 8 1 * *` (`vercel.json`).

Shape worth copying: a stored row (`periodStart`, `periodEnd`, `summaryText`,
`highlightsJson`, `sentAt`) created first, sent second, then stamped `sentAt`
(`monthlyDigest.js:167-206`). `sentAt` null means "built but not delivered",
which is exactly the state a digest job needs to be resumable.

Also worth copying: when the AI half is unavailable, the digest **still sends**
with the real numbers and substitutes the quota sentence
(`monthlyDigest.js:56-66`) rather than going silent — "a feature that stops
working with no explanation" is named there as the failure class.

The other batching precedent is `lib/billing/graceWarning.js`: `grace_start` /
`grace_remind` / `grace_wait`, with **two separate dedupe columns** because one
timestamp cannot distinguish "warned at the start" from "warned near the end"
(`graceWarning.js:32-40`). Its cron claims a send with a guarded `updateMany`
before sending and reverts the claim on failure
(`app/api/cron/grace-warning/route.js:104-131`). Any digest/rollup in a feed
should use that claim pattern.

---

## 2. Event inventory

Every moment the product already detects that is worth notifying. "Tells a
human today" is the load-bearing column — a feed must not double-notify.

### 2.1 Money

| Event | Detected at | Tells a human today? |
|---|---|---|
| **Client accepted a quote** | `app/api/public/quotes/[token]/route.js:499` → `dispatchDecisionEmails` (`:562`); `onQuoteAccepted` at `:513` creates job + draft invoice + task; `recordActivity("quote.accepted")` at `:514` | **YES — email** to owner+admin, ungated, with the signed PDF attached. Extras go in the subject line deliberately (`:637-639`). A feed entry must be additive to this, not a second copy. |
| **Client declined a quote** | same route, `else` branch at `:541`, `onQuoteDeclined` | **YES — email**, plain internal note. |
| **Stripe invoice payment landed** | `lib/invoices/recordStripePayment.js:41` calls `notifyInvoicePayment` fire-and-forget | **YES — email**, gated by `invoice_paid` (default ON). Deliberately scoped to Stripe only: a manually recorded payment needs no notice because a staff member is typing it in (`invoicePaymentNotice.js:11-16`). |
| **Manual payment recorded** | `app/api/payments/route.js:172` `recordActivity("payment.recorded")` | No, and correctly so. |
| **Refund / chargeback / dispute opened** | `app/api/stripe/webhook/route.js:176-181` → `lib/stripe/settleChargeEvent.js` | **NOBODY.** No email, no SMS, no `recordActivity`, no `recordError`. A homeowner disputing a charge is invisible until someone opens Stripe. This is the highest-value silent event found. |
| **Service-plan occurrence charge failed** | `app/api/stripe/webhook/route.js:164-171` → `settleOccurrenceFromIntent`; also reconciled by the `service-plans` cron | Settles the occurrence; nobody is told the charge failed. |
| **Large quote created above threshold** | `app/api/cron/large-quote-check/route.js` (daily 09:00) | **YES — email**, but only if the company created the rule. Daily, not immediate. |
| **FieldQuo subscription past due** | `lib/billing/access.js:226-245` moves to `past_due`; `app/api/cron/grace-warning/route.js` (daily 09:00) | **YES — email**, twice (`grace_start`, `grace_remind`), plus the in-app `BillingBanner`. This one is well covered; a feed should not duplicate it. |

### 2.2 Inbound demand

All of these go through the one lead creator, `lib/leads/createLead.js:43`
(`createScoredLead`) — which is the single natural hook point for a
"new enquiry" event.

| Source | Route | Tells a human today? |
|---|---|---|
| Self-quote form | `app/api/self-quote/route.js:137` | Emails the **homeowner** a confirmation (`:177`). **Nobody at the company.** |
| Kitchen designer | `app/api/self-quote/kitchen/route.js:150` | **YES — email** to owner+admin (`:199-232`). The only inbound source that notifies the company. |
| Instant quote (measured estimate) | `app/api/instant-quote/[companySlug]/request/route.js:204` | Emails the **homeowner** the estimate (`:167`). **Nobody at the company** — including when the draft lands in the review queue below. |
| Embed / public lead form | `app/api/leads/public/route.js:42` | **NOBODY.** Fires `onLeadCreated` (`lib/voice/triggers.js:349`), which queues an *outbound AI call to the lead* if the company enabled it — not a notification to staff. |
| Funnel submission | `app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js:72` | **NOBODY.** |
| Client portal request | `app/api/portal/[token]/request/route.js:27` | **NOBODY.** |
| Phone (AI receptionist tool) | `app/api/voice/tools/[tool]/route.js:251` | **NOBODY.** |
| CSV import | `app/api/leads/import/route.js:57` | N/A — the importer is watching. |

**Estimate awaiting sign-off** is a separate, related event:
`Quote.needsReview` + `autoEstimated` feed
`app/api/quotes/estimate-reviews/route.js:31` and the
`/app/estimate-reviews` queue. Set by `lib/voice/autoDraft.js` (a quote drafted
off a recorded call) and by the instant-quote path. **Nobody is told the queue
has something in it.** A quote drafted from a phone call at 6pm sits unseen
until someone happens to open that screen.

### 2.3 Voice

| Event | Detected at | Tells a human today? |
|---|---|---|
| **AI answered a call** (`call_started`) | `app/api/voice/webhook/route.js:138` upsert | No. |
| **Call ended / analysed** — transcript, summary, disposition | `app/api/voice/webhook/route.js:157-165` | No. Bills the call, tops up, re-checks the ceiling, auto-drafts a quote (`:278-289`). Nothing tells a human a call happened. |
| **Call missed** | Not modelled as its own event. `VoiceCall.disposition` carries the provider's `disconnection_reason`; there is no `missed` concept and no route reads disposition to decide anything. | No. **This one needs a product decision before it can be a feed event** — "missed" would have to be defined (agent didn't pick up? caller hung up in under N seconds? no transcript?). |
| **Voice credit exhausted → agent detached** | `app/api/voice/webhook/route.js:242-252` | `recordError` to `/platform/errors` — FieldQuo sees it, the **contractor does not**. Their phone stops answering and nothing in `/app` says why. |
| **Callback booked by the agent** | `recordActivity("voice.callback.booked")` | Activity log only. |

### 2.4 Calendar and field work

| Event | Detected at | Tells a human today? |
|---|---|---|
| **Booking made** (free path) | `app/api/booking/[companySlug]/confirm/route.js:300-345`, then `finalizeBooking` | `lib/booking/finalizeBooking.js:79-102` emails the **client** a confirmation and queues a reminder call. **Nobody at the company.** The appointment appears on the schedule; that is the whole notification. |
| **Booking made** (paid, visit fee) | Stripe webhook → `lib/booking/settleBookingFee.js:46` → same `finalizeBooking` | Same — client only. |
| **Booking cancelled / rescheduled by the client** | `lib/booking/manageVisit.js` (the manage-token path) | Client-facing notices only. |
| **Visit marked "on my way"** | `app/api/jobs/[id]/visits/[visitId]/route.js:98-110` | SMS to the **client**. Correct audience. |
| **Visit completed** | same route, `:133` — spawns the next recurring visit | Nobody. |
| **Job status change** | job routes | `recordActivity` in some cases; no notification. |
| **Change order approved / billed** | `ChangeOrder.status`, `decidedAt` (`schema.prisma:3763-3826`); `POST /api/jobs/[id]/change-orders/bill` | Nobody. A figure that moves the job's contract value. |
| **Safety incident reported** | `app/api/safety-incidents/route.js:135` `recordActivity` | **Activity log only.** Somebody got hurt on a site and the owner finds out by scrolling a log they have to remember to open. |

### 2.5 Team

| Event | Detected at | Tells a human today? |
|---|---|---|
| **Leave requested (calling in sick)** | `app/api/leave/route.js:268` + `recordActivity("leave.requested")` at `:295` | **NOBODY.** See §4 — this is the single best-prepared event in the whole audit and it notifies no one. |
| **Leave approved / declined / cancelled** | `app/api/leave/[id]/route.js:162,195,237` + `recordActivity` | Nobody. The requester is not told their own request was answered. |
| **Crew texted the crew line** | `app/api/crew/inbound/route.js` → `lib/crew/inbox.js:461` `crewInboundMessage.create` | Auto-replies to the **crew member**. The office inbox (`/app/crew-inbox`) shows it. **Nobody in the office is told** — including when a message is held `pending` because attribution was ambiguous and a human has to pick the job. |
| **@mention on a job photo** | `app/api/jobs/[id]/photos/[photoId]/comments/route.js:179` → `lib/photoComments/notify.js:172` | **YES — crew-line SMS, email fallback**, with a full per-person delivery record. Only for `@mentions`; a plain comment notifies nobody, deliberately. |
| **Timesheet submitted / edited back to pending** | `app/api/time-entries/[id]/route.js` — a crew self-edit returns an approved entry to `pending` (`lib/payroll/timesheetEdit.js`, `scripts/check-timesheet-approval.mjs`) | Nobody. A supervisor has to notice. |
| **Task completed** | `app/api/tasks/[id]` | Nobody. **And should stay that way** — see §8. |
| **Member deactivated** | `recordActivity("member.deactivated")`, already red-dotted on the activity page | Activity log only. |

### 2.6 "A document or job log was changed by someone else"

This is the owner's second ask and it has **no existing event at all** in the
shape he means. What exists:

- `ActivityLog` rows for `quote.created`, `client.updated`, `invoice.sent`, etc.
  — but keyed to the *actor*, with no notion of "who else cares about this
  record".
- `Quote.assignedToId`, `LeadRequest.assignedToId`, `Job` → `JobVisit.assignedToId`,
  `Appointment.assignedToId`, `Task.assignedToId`. These are the "who else
  cares" signal, and nothing currently reads them for notification purposes.

So "somebody changed my quote" is derivable — `entityType`/`entityId` from
`ActivityLog`, joined against the record's assignee — but it is a new query
nobody writes today. It is also the event most likely to become noise (§8).

---

## 3. Who should see what — the vocabulary, and the traps

### 3.1 The two layers, and which one a feed must respect

`lib/permissions.js` documents this at length. Summarised:

**Layer 1 — coarse.** Four roles: `owner`, `admin`, `supervisor`, `employee`
(`MemberRole` enum, `schema.prisma:5998`). `PERMISSIONS.owner`/`admin` are
`["*"]`. `can(role, permission)` at `lib/permissions.js:99-112`.

**Layer 2 — granular.** `PERMISSION_CATEGORIES` on `Member.permissions` (Json),
enforced by `lib/permissions/enforce.js`. Categories relevant to a feed:
`quotes`, `invoices`, `jobs`, `requests`, `clientsProperties`, `schedule`,
`timeTracking`, `payroll`, `expenses`, `safety`, `notes`; toggles
`showPricing`, `jobCosting`, `payments`.

The functions a feed must use, not reimplement:

- `hasLevel(member, category, level)` — `enforce.js:42-67`
- `hasToggle(member, toggle)` — `enforce.js:69-77`
- `scopeFilter(member, category, ownerField, userId)` — `enforce.js:108+`
- `assignedJobWhere(member)` / `seesOnlyAssignedJobs(member)` — `enforce.js:228-233`
- `loadEnforceableMember(db, memberId)` — `enforce.js:239-275` (the only way to
  get `permissions` + `userId`; `getCurrentMember` does not return them)
- `UNRESTRICTED_ROLES` — `enforce.js:34`, exported precisely so guards assert
  against the set enforcement uses rather than a copy

Presets that map onto these (`lib/permissions.js:421+`, `PRESET_TO_ROLE` at
`:610`): **Crew** (`worker`), **Estimator**, **Dispatcher**, **Manager**.

### 3.2 The traps, named

**Trap 1 — `hasLevel` fails OPEN.** Three separate fall-through returns are
`true`: unknown category (`enforce.js:47`), no permissions object
(`enforce.js:52`), category undefined on the member (`enforce.js:57`). This is
correct for gating a route (existing members predate the grid), and **wrong as
the sole test for what goes in a feed**. `app/api/settings/notification-rules/route.js:35-44`
already documents exactly this trap and refuses to route through `requireLevel`
for that reason:

> `hasLevel()` returns true for categories it doesn't recognise — so routing
> this through requireLevel would look like a permission check while enforcing
> nothing at all.

A feed must decide visibility with an **allowlist of (event type → required
category+level / required toggle)**, and refuse to emit an event whose
requirement is unrecognised. Fail closed.

**Trap 2 — money to Crew.** `PERMISSION_PRESETS.worker` sets
`showPricing: false`, `jobCosting: false`, `quotes: "none"`, `invoices: "none"`,
`requests: "none"`. The preset's own comment records that this tier previously
sat at `view_only` on all four ladders and "could read every quote, invoice, job
and lead in the company, including what the client was charged wherever
showPricing didn't reach". **A feed entry whose summary contains a dollar
figure is a price.** `"Quote #204 accepted — $12,400"` in a crew member's feed
re-opens the hole the preset was rewritten to close. Either the event does not
reach them, or the *rendered summary* is redacted — and redaction of a stored
string is fragile, so prefer not reaching them.

The redaction precedent is `lib/permissions/enforce.js`'s REDACTION section
(`:284+`), written after QA found `GET /api/clients` returning every client's
email, phone, notes and `portalToken` to a member set to `name_address_only`.
A feed that stores a pre-composed `summary` string (as `ActivityLog` does) is
the same shape of hazard: the string is composed once, by the writer, who does
not know who will read it.

**Trap 3 — one rep seeing another rep's leads.** `LeadRequest.assignedToId`
exists (`User.leadsAssigned`). `GET /api/leads` (`app/api/leads/route.js:37,54`)
treats `assignedToId` as an **optional query filter**, not an enforced scope —
so leads are already company-wide-visible to anyone holding `requests:view_only`.
A feed does not create this exposure, but it *amplifies* it: an unread badge
that counts other people's leads makes a passive exposure into an active one.
Establish the intended rule before shipping "new enquiry" to anyone below
`requests: view_create_edit`.

**Trap 4 — job scope.** `assignedJobWhere(member)` narrows job reads to jobs the
member has a visit on, and returns `{}` for everyone else. Its refusing case
filters on `visits`, never on `id`, specifically so a spread cannot widen a
query. **A job with no visits is assigned to nobody and is hidden**
(`enforce.js:214-222`) — deliberate. Any job-scoped feed query must spread
`assignedJobWhere`, and must do it *inside* an already-`companyId`-scoped where,
which is the contract that fragment documents.

**Trap 5 — supervisors are not admins.** `PERMISSIONS.supervisor` holds
`user:manage`, `job:assign`, `task:assign` etc. but not `*`. Every existing
notification block targets `owner`+`admin` only, so today a Dispatcher or
Manager is told **nothing**. The owner explicitly named "managers" first. A
feed that copies the existing `role: { in: ["owner","admin"] }` recipient query
misses the audience he asked for.

**Trap 6 — impersonation.** A support session's role is `"viewer"`, which is
neither owner nor admin; `app/api/activity/route.js:20-31` documents letting it
through for reads. A feed's GET should follow the same rule (read-only support
needs to see what the customer sees), and its mark-as-read **must not** —
marking a customer's notification read from a support session is a write to
customer data, which non-negotiable #2 forbids. `member.impersonation` is the
flag; `lib/currentMember.js` and `middleware.js` are the two enforcement points.

**Trap 7 — leave and the reporting line.** See §4.

---

## 4. "Somebody calling in sick"

This is **not** the item with no underlying event. It is the best-prepared
event on the owner's whole list, and it notifies nobody.

What exists:

- `LeavePolicy` (`schema.prisma:5196-5235`) — `kind` includes `sick`;
  `requiresApproval` is per-policy and its comment notes "Some companies
  auto-approve sick days".
- `LeaveBalance` (`:5242-5261`) — remaining is derived, never stored.
- `LeaveRequest` (`:5263-5307`) — `startDate`, `endDate`, `days`, `halfDay`,
  `reason`, `status` (`pending | approved | declined | cancelled`),
  `reviewedById`, `reviewedAt`, `reviewNote`. Indexed
  `[companyId, startDate]` and `[workerId, status]`.
- Routes: `POST /api/leave` (`app/api/leave/route.js:268`),
  `PATCH /api/leave/[id]` (`:162` approve, `:195` decline, `:237` cancel).
- UI: `/app/time-off`.
- `lib/leave/accrual.js`, `lib/leave/balances.js`, `lib/leave/policyTemplates.js`,
  `scripts/check-leave-templates.mjs`, `scripts/check-leave-escalation.mjs`.
- **`recordActivity` fires on all four transitions** — `leave.requested`,
  `leave.approved`, `leave.declined`, `leave.cancelled`.

And, crucially, **the recipient is already computed**:
`lib/org/leaveRouting.js` (`annotateRouting`) joins `lib/org/reportingLine.js`'s
`approverFor()` / `canApprove()` with `lib/org/availability.js`'s away lookup,
and returns both *who this request waits on* and *who may act*. Its header
(`leaveRouting.js:12-38`) explains why routing is computed on **today**, not on
the leave's start date, and why nothing is stored on the row:

> Routing is computed on every read, so a request escalated past a manager on
> Monday returns to that manager on the Friday they get back… A stored approver
> would be a snapshot of who was away once.

**Consequence for the design:** a leave notification's recipient must be
resolved through `approverFor()` at **send** time, and the feed entry must not
freeze the approver — otherwise a notification sitting in the wrong person's
feed contradicts the routing the screen shows. The safest shape is to notify
`canApprove()`'s wider set (who may act) rather than `approverFor()`'s narrower
one (who it waits on), and let the feed entry link to the screen that computes
the live answer.

Second consequence: a sick day is often on an **auto-approving** policy
(`requiresApproval: false`, `app/api/leave/route.js:281-286`), so there is no
approval to chase — the notification is purely informational ("Dana is out
today"), and its audience is whoever is running tomorrow's schedule, which is
`user:manage` (owner/admin/supervisor), not just the approver.

---

## 5. Delivery channels

### 5.1 What exists

**Email — Resend.** `lib/email/resend.js` is the only module that constructs a
client (stated in `lib/photoComments/notify.js:119-123`). Two sender
conventions, and the split is load-bearing:

- **Client-facing:** `resolveSender(company, companyId)` from
  `lib/email/companySender.js` — the company's own verified domain when they
  have one. White-label applies.
- **Internal staff notice:** `from: "${company.name} <notifications@fieldquo.com>"`.
  Documented in `invoicePaymentNotice.js:96-105` and copied verbatim in
  `photoComments/notify.js:134-139`: the white-label rule does not apply
  because the audience is the contractor's own team.

`sendEmail` takes `companyId` as the **demo seam** (`lib/email/demoMail.js`) —
a demo tenant's mail is simulated. Any new sender must pass `companyId` or a
demo will send real mail to fictional addresses. `sendEmail` **reports failures
rather than throwing** (`photoComments/notify.js:142-144`), so `if (result?.error
|| result?.skipped)` is required — a bare `await` marks a bounced address
delivered.

**SMS — Twilio.** `lib/sms/twilioClient.js` (`sendSms`, `toE164`).
`lib/sms/optOut.js`'s `maySms()` guards **client** sends; crew-line sends to
staff are deliberately not gated by it (`crew/inbound/route.js:74-77`). Every
outbound crew text is metered through `chargeOutboundCrewReply` against the
company's crew balance, and gated on the company having connected a
`CrewInboxNumber` — see `photoComments/notify.js:21-41`. `lib/sms/demoSms.js`
is the demo seam, again keyed on `companyId`.

**Critically: SMS to staff costs the contractor money.** A feed that defaults
any event to SMS is a feed that bills them per notification. The existing
mention notifier is the model: SMS only for a deliberate, person-to-person
interruption, and only when the company has already opted into crew texting.

### 5.2 In-app — what it would require

The app is on Vercel serverless. **WebSocket is not available** (no persistent
process to hold the connection). SSE is technically possible from a Node
runtime route but holds a function invocation open for its duration, which on
Vercel is billed wall-clock and capped — for a back office where staff leave a
tab open all day, this is the expensive option and the one most likely to fail
quietly on a bad connection in a driveway.

**Polling is the right answer, and there is already a precedent:**
`app/components/jennifer/JenniferPanel.js:72,123` — `POLL_MS = 5000`, an
interval in a `useEffect` with a `cancelled` flag and `clearInterval` on
cleanup, **gated on a condition** (`status !== "escalated"` returns early) so it
does not poll when there is nothing to poll for. Two other intervals exist:
`app/app/settings/email-domain/page.js:104` (30s) and
`ImpersonationBanner.js:44`.

For a feed, 5s is far too hot. An unread-count endpoint polled at 60s from the
app shell, returning `{ count, latestId }` and nothing else, is the cheap
version; the full list is fetched only when the panel opens. The shell already
makes one such call per load (`/api/ui-state`, whose header at
`app/api/ui-state/route.js:9-14` explains why account standing was folded into
it rather than getting its own endpoint — *"a second endpoint would be a second
round trip on every page"*). **The unread count should almost certainly ride
`/api/ui-state` for the initial load**, following that stated precedent, with a
separate lightweight poll thereafter.

Where the bell goes: `app/components/layout/AdminSidebar.js:757` is the
`lg:hidden sticky top-0 z-40 h-14` mobile top bar (hamburger + logo, with a
comment that `h-14` is load-bearing because `SettingsSidebar` stacks at
`top-14`). Desktop has **no top bar at all** — the sidebar is the only chrome
(`AdminSidebar.js:776+`), so a desktop bell has to live in the sidebar rail or
a new element. `app/components/mobile/AppBar.js` is a per-page detail header
that *replaces* the sidebar's mobile bar, so a bell placed only in the latter
disappears on quote/job/invoice detail screens — the screens where a
contractor spends the most time on a phone.

### 5.3 Push — what it would require

**Nothing exists.** Confirmed:

- No `web-push` in `package.json` dependencies (`:279-312`).
- No service worker anywhere: `find app public -name "sw.js" -o -name "service-worker*"` returns nothing.
- No VAPID keys in the env docs (`npm run check:env` enforces
  `scripts/check-env-docs.mjs` against documented vars).
- `app/manifest.js` exists and is installable — `display: "standalone"`,
  `start_url: "/app"` — but returns **`null` on any tenant subdomain**
  (`manifest.js:36-44`) so a homeowner never gets a FieldQuo install prompt.
  That is correct and unrelated to push.

So push means: a service worker, a `PushSubscription` store (per user *per
device*), VAPID key generation and two env vars, a subscribe/unsubscribe UI,
and handling of expired subscriptions (410 Gone → delete the row).

**The iOS constraint is decisive.** iOS Safari supports the Web Push API only
for web apps **added to the Home Screen** — a page in a Safari tab cannot
subscribe, and `Notification.requestPermission()` is not even callable there.
`docs/MOBILE-INSTALL.md` documents that the app was made installable, but there
is **no install prompt, no A2HS coaching UI, and no tracking of who has
installed it** — nothing in the codebase reads `display-mode: standalone`.

For a contractor on an iPhone who has not added FieldQuo to their Home Screen —
which is the default state of every user today — **web push cannot reach them
at all**. Not "degraded": impossible. So push is:

- valuable on Android/desktop Chrome,
- valuable on iOS *only after* a Home Screen install the product currently
  never asks for,
- and therefore **not the first version**. It is the second, and shipping it
  first would mean shipping a notification channel that silently reaches a
  minority of users — which is the "control that appears to work and doesn't"
  failure with the control being the permission prompt.

---

## 6. Read state and noise

### 6.1 Read state

There is **no read/unread concept anywhere** in the product. The nearest
adjacent things:

- `User.uiState` Json (`schema.prisma:1533-1537`) — `{ seenTours: string[] }`,
  dismissed hints. Server-side so a dismissal survives devices, served by
  `/api/ui-state`. **Scoped to the USER, not the member** — which is a trap: a
  user in two companies shares one `uiState`. Read state for a company-scoped
  feed must live on a company-scoped row, not here.
- `SeatSharingBanner`'s `noticeKey` (`app/api/ui-state/route.js:52-56`) —
  `seat-sharing:<ISO timestamp>`, keyed to the most recent strike so
  *"dismissing the warning silences THAT observation and no other. A permanent
  dismissal would let the first false positive hide every later real one."*
  That reasoning transfers directly: mute must be per-event-type, never
  "dismiss notifications".
- `JobPhotoMention.notifiedAt` / `skipReason` — delivered-state, not read-state.
- `CrewInboundMessage.status` (`pending | filed | ignored | superseded`) and
  `resolvedAt` — the closest thing to an inbox with a worked-through state, and
  its `superseded` value exists specifically so a stale open question does not
  get silently resolved by an unrelated later answer. Same discipline a feed
  needs for superseded notifications (quote accepted, then the job cancelled).

### 6.2 Noise control — what the codebase already knows

1. **Digest over drip.** `AiDigest` + monthly cron; `graceWarning`'s
   `grace_start` / `grace_remind` / `grace_wait` with a *deliberate silence* in
   between (`graceWarning.js:28-31`: *"a daily reminder would be exactly the nag
   grace_wait exists to prevent"*).
2. **Dedupe columns must carry WHICH notice, not just THAT one went**
   (`graceWarning.js:32-40`). Two columns, not one timestamp.
3. **Claim before send.** `app/api/cron/grace-warning/route.js:104-112` — a
   guarded `updateMany` claims the send, reverted on failure (`:117`). Any
   feed digest job needs this or a concurrent cron double-sends.
4. **Self-actions never notify the actor.** `resolveMentions`
   (`lib/photoComments/mentionable.js`) drops the author's own id *before* any
   `JobPhotoMention` row is created — the filtering happens at write time, not
   at delivery. A feed must do the same: `actorUserId === recipientUserId` →
   no row at all, not a row that is skipped later.
5. **One rule row per type per company** — `notification-rules/route.js:85-88`:
   *"Without this you can create three large_quote rules and get three identical
   emails per quote."*
6. **Default ON for a type that ships after the companies do**
   (`invoicePaymentNotice.js:18-26`).

---

## 7. The multi-tenant trap

`scripts/check-tenant-scope.mjs` + `scripts/tenantScopeScan.mjs` enumerate the
boundary **off the filesystem and off the schema**, so a new model and a new
route are covered the day they land, with no list to update.

What that means concretely for a `Notification` model:

1. **Adding a `companyId` column enrolls the model automatically.**
   `tenantDelegates()` (`tenantScopeScan.mjs:100-113`) regexes every
   `model X { … }` containing a `companyId` field and returns the Prisma
   delegate name. `notification` will be in that set the moment the model is
   pushed.

2. **Every single-record lookup keyed by an id must be company-scoped.**
   `SINGLE_RECORD = { findUnique, findUniqueOrThrow, findFirst, findFirstOrThrow,
   update, delete, upsert }` (`tenantScopeScan.mjs:115-118`). So
   `db.notification.update({ where: { id } })` — the obvious way to write
   mark-as-read — **fails the check**. It must be
   `db.notification.updateMany({ where: { id, companyId: member.companyId,
   recipientUserId: member.userId }, data: { readAt } })`, or a scoped
   `findFirst` first.

3. **Every foreign key written from request data must be in `OWNED_ID_FIELDS`
   or proved inline.** `lib/tenant/ownedIds.js:66-119` already covers
   `clientId`, `quoteId`, `invoiceId`, `jobId`, `leadId`, `appointmentId`,
   `workerId`, `policyId`, `assignedToId`, `userId` (both proved against
   `Member` by `{ userId, companyId }` — *"that person isn't on your team"*).
   A `Notification.recipientUserId` written from a request body would need an
   entry; **it should never be written from a request body at all** — the
   recipient is derived server-side from the event, and mark-as-read keys off
   the session's own `member.userId`. Design it so no route ever accepts a
   recipient id and the whole class of problem does not arise.

4. **`provenRowVars`** (`tenantScopeScan.mjs:160-205`) recognises a row as
   proven when it came from a call whose `where` or `data` named `companyId`,
   or from a helper handed `companyId`/`member`. So a
   `notifyEvent({ companyId, … })` helper is recognised as safe; a
   `notifyEvent(eventId)` that looks the company up internally is not, from the
   caller's side.

5. **`CALLER_IDENTITY`** (`tenantScopeScan.mjs:207-212`) — `member`, `actor`,
   `session`, `full`, `me` are the recognised names for "the caller's own
   identity". Naming the loaded member anything else makes the scanner report
   correct code.

6. **A declared exception that stops matching is itself a failure**
   (`check-tenant-scope.mjs:49-52`). Do not add a `GLOBAL_BY_DESIGN` entry for
   a feed route; there is no legitimate global read of notifications.

7. **`npm run check:route-callers`** — every new route must have a caller
   outside `app/api`, matched on its static path prefix as a **URL** not a file
   path (`check-route-callers.mjs:26-41`). Crons are read from `vercel.json`, so
   a digest cron must be scheduled there or it fails. Two real bugs are recorded
   in that header as the reason it exists.

Also relevant, from the memory file *"Ask whether a route has a caller"*: every
check in this repo proved code correct, none proved it reachable, and three
features shipped unreachable. A feed API with no bell rendered is that failure
exactly.

---

## 8. Proposed design

### 8.1 The model

Two tables. The split is the point: an **event** happened once; a **delivery**
is per-person and carries that person's read state.

```prisma
/// One notable thing that happened inside one company. Written once,
/// regardless of how many people are told — so "the quote was accepted" is one
/// row and "Ann and Bo were told" is two.
///
/// Deliberately NOT ActivityLog. That table records who DID what for audit,
/// is owner/admin-only, and swallows its own write failures by design
/// (lib/activity/log.js) — acceptable for a trail you consult, wrong for the
/// only record that somebody was told a $12,000 quote was accepted.
model NotificationEvent {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(...)

  /// Dotted verb from the closed catalog in lib/notifications/catalog.js.
  /// Reuses ActivityLog's vocabulary where one already exists
  /// ("quote.accepted", "leave.requested") so the two never invent two names
  /// for one thing.
  type       String
  entityType String?
  entityId   String?

  /// Composed at write time, like ActivityLog.summary — BUT see catalog.js:
  /// a type whose money flag is set stores the figure in `amount` and keeps it
  /// OUT of this string, because the string is composed by someone who does
  /// not know who will read it. showPricing:false readers get the string; the
  /// amount is joined in at render time only for readers who may see money.
  title   String
  body    String?
  amount  Decimal? @db.Decimal(12, 2)

  /// Who caused it. Null for a client-driven or system event — and null is a
  /// real answer, not a gap: "the homeowner approved it" has no member.
  actorUserId String?
  actorName   String?

  createdAt DateTime @default(now())

  deliveries NotificationDelivery[]

  @@index([companyId, createdAt])
  @@index([companyId, type, createdAt])
}

/// One person's copy. The read state lives here and nowhere else.
model NotificationDelivery {
  id        String @id @default(cuid())
  eventId   String
  event     NotificationEvent @relation(..., onDelete: Cascade)
  /// Denormalised so every query is companyId-scoped without a join — which is
  /// what scripts/check-tenant-scope.mjs requires of every single-record
  /// lookup on this model.
  companyId String
  /// The Member, not the User: read state is per (person, company), and a user
  /// in two companies must not carry one company's read state into the other.
  /// User.uiState is the counter-example — it is user-global and would leak.
  memberId  String
  member    Member @relation(...)

  readAt      DateTime?
  /// Delivered-state, mirroring JobPhotoMention exactly: in_app | email | sms.
  /// in_app always; the others only when a channel rule fired.
  channels    String[] @default(["in_app"])
  emailedAt   DateTime?
  smsedAt     DateTime?
  skipReason  String?

  createdAt DateTime @default(now())

  @@unique([eventId, memberId])
  @@index([companyId, memberId, readAt, createdAt])
}

/// Extends the EXISTING NotificationRule rather than adding a second
/// preferences surface — same decision invoicePaymentNotice.js made.
/// `memberId` null = the company default (what NotificationRule means today);
/// a row with a memberId is that person's override.
model NotificationPreference {   // or: add memberId String? to NotificationRule
  ...
}
```

**`@@unique([eventId, memberId])`** is load-bearing: it makes fan-out
idempotent, so a retried webhook cannot put the same acceptance in someone's
feed twice — the same guarantee `chargeCall` gets from keying on the call id.

### 8.2 The event vocabulary

One file, `lib/notifications/catalog.js`, modelled on
`notification-rules/route.js`'s `RULE_TYPES` and on `OWNED_ID_FIELDS` — a
**table**, not a switch, so the check script can import it and assert every
emitted type is declared:

```js
export const NOTIFICATION_TYPES = {
  "quote.accepted": {
    label: "Quote approved",
    severity: "high",
    money: true,                       // amount is redacted for !showPricing
    audience: { permission: "quotes", level: "view_only" },
    alsoEmails: true,                  // an email ALREADY goes — see §8.4
  },
  "invoice.disputed": { severity: "critical", money: true, audience: { toggle: "payments" } },
  ...
};
```

Rules the catalog enforces:

- Every type declares its audience as a `{ category, level }` or `{ toggle }`
  from `PERMISSION_CATEGORIES`. **A type whose audience key is not recognised
  is refused at emit time** — the opposite of `hasLevel`'s fail-open, and the
  reason the audience is declared here rather than resolved by calling
  `hasLevel` directly.
- Every type declares `alsoEmails`, so the fan-out knows whether an email is
  already going and does not send a second one.
- Names reuse `ActivityLog`'s existing dotted verbs wherever one exists.

### 8.3 How an event becomes a notification

```
  the moment                                  fan-out
  ──────────                                  ───────
  route / webhook / cron
        │
        │  after the real mutation commits, fire-and-forget,
        │  wrapped in its own try/catch — the pattern
        │  recordStripePayment.js:41 and the visit "on my way"
        │  SMS both already use
        ▼
  notifyEvent({ companyId, type, entityType, entityId, actor, ... })
        │
        ├─ 1. look the type up in the catalog; unknown type → throw in dev,
        │     no-op + console.error in prod (never a silent success)
        │
        ├─ 2. create the NotificationEvent row
        │
        ├─ 3. resolve recipients ONCE, in lib/notifications/recipients.js —
        │     the helper that replaces the four copy-pasted
        │     role: { in: ["owner","admin"] } queries in §1.3:
        │       • load active members with loadEnforceableMember's select
        │       • keep those satisfying the catalog's audience requirement
        │       • drop the actor (mentionable.js's rule: filter at write time)
        │       • for job-scoped types, intersect with assignedJobWhere
        │       • for leave types, union with canApprove() from
        │         lib/org/reportingLine.js
        │
        ├─ 4. createMany NotificationDelivery, skipDuplicates: true
        │     (the @@unique makes a retry a no-op)
        │
        └─ 5. decide extra channels — see 8.4
```

`notifyEvent` **never throws** into its caller, for the same reason
`recordActivity` doesn't — but unlike `recordActivity` it records its own
failures to `recordError` (`lib/platform/errorLog.js`), so a feed that stops
working is visible at `/platform/errors` rather than only invisible to the
contractor.

### 8.4 How delivery is decided

Three channels, and the rule for each:

- **In-app: always.** Free, and the whole point.
- **Email: only where one already goes, or where the catalog says
  `emailWorthy` AND the company/person hasn't muted it.** The four existing
  emails (§1.3) must be *moved behind* `notifyEvent` rather than left running
  alongside it — otherwise a quote acceptance produces one email and one feed
  entry today and two emails tomorrow. This is the single biggest
  implementation risk in the whole feature.
- **SMS: never by default.** It costs the contractor money per message
  (`chargeOutboundCrewReply`), requires a connected `CrewInboxNumber`, and
  already has exactly one sanctioned use (an `@mention`). Leave that use alone
  and add none.
- **Push: not in v1.** See §5.3.

### 8.5 Read state and the unread count

- `PATCH /api/notifications/read` with `{ ids }` or `{ before }` →
  `updateMany({ where: { id: { in: ids }, companyId: member.companyId,
  memberId: member.id, readAt: null }, data: { readAt: new Date() } })`.
  `updateMany` not `update`, for the tenant-scope reason in §7.2.
- **Refused under impersonation.** Read-only means read-only.
- Unread count on the initial page load rides `/api/ui-state`
  (its header states the precedent); thereafter a 60s poll of a
  count-only endpoint, using `JenniferPanel`'s cancelled-flag +
  `clearInterval` shape.
- **Mute is per type, never global** — the `SeatSharingBanner` `noticeKey`
  reasoning: a permanent dismissal lets the first false positive hide every
  later real one.

### 8.6 The smallest genuinely useful first version

Ship this and nothing else:

1. Two models (`NotificationEvent`, `NotificationDelivery`) + `prisma db push`.
2. `lib/notifications/catalog.js` with **six** types (see §9's tier 1).
3. `lib/notifications/notify.js` (`notifyEvent`) and
   `lib/notifications/recipients.js` (the one recipient resolver).
4. Six emit call sites, all fire-and-forget after commit.
5. `GET /api/notifications` (scoped, paginated) +
   `PATCH /api/notifications/read`.
6. A bell in **both** `AdminSidebar`'s mobile bar and the desktop rail, and a
   decision about `AppBar` detail screens — a bell that vanishes on the quote
   page is a bell contractors won't trust.
7. Unread count folded into `/api/ui-state`'s existing response.
8. `scripts/check-notifications.mjs`: executes `recipients.js` against a
   Crew member, an Estimator, a Dispatcher, a supervisor and an owner for
   every catalog type, and asserts (a) no money-flagged event reaches a
   `showPricing:false` member, (b) no event reaches its own actor, (c) every
   emitted type is in the catalog, (d) an unrecognised audience key refuses.
   Wire it into `check:all`.

Explicitly **not** in v1: push, service worker, SMS, digests, per-user
preferences UI, the "document changed by someone else" event, grouping.
Company-level mute reuses the existing `NotificationRule` settings screen.

---

## 9. Ranking — value to the owner per unit of work

**Tier 1 — ship these six.** High value, event already detected, recipient
already resolvable.

| # | Event | Why it wins | Work |
|---|---|---|---|
| 1 | **Refund / chargeback / dispute opened** | Money leaving, a deadline attached (Stripe evidence windows), and it currently tells **nobody at all**. Highest value-per-line in the audit. | Emit at `app/api/stripe/webhook/route.js:176-181`. |
| 2 | **Quote accepted** (with amount) | The event the owner named first. Already emailed, so the feed entry is pure upside — but it also converts the email into something a Dispatcher/Manager sees, which today they don't. | Emit at `app/api/public/quotes/[token]/route.js:513`; fold the existing email behind the same helper. |
| 3 | **Invoice paid** | Already emailed and already has a preference row; the feed makes it visible without opening mail on a phone in a driveway. | Emit inside `lib/invoices/recordStripePayment.js:41`, beside `notifyInvoicePayment`. |
| 4 | **New enquiry** (any source) | Six inbound routes, five of which tell nobody. Response time is what wins the job. One hook covers all six. | Emit inside `lib/leads/createLead.js:72`, after the create — one call site for every source. |
| 5 | **Leave requested / sick day** | Fully modelled, fully routed, notifies nobody. The recipient resolver already exists (`approverFor`/`canApprove`). Directly on the owner's list. | Emit at `app/api/leave/route.js:268` and the three transitions in `[id]/route.js`. |
| 6 | **Estimate awaiting sign-off** | An auto-drafted quote — from a phone call or an instant estimate — sits in `/app/estimate-reviews` unseen. The homeowner has already been given a number; nobody is closing it. | Emit where `needsReview` is set (`lib/voice/autoDraft.js`, the instant-quote path). |

**Tier 2 — next, but each needs a small decision first.**

| Event | Blocker |
|---|---|
| **Safety incident reported** | Genuinely high value (someone got hurt). Needs a decision on whether it also SMSes, given the audience is `safety` + `user:manage` and the urgency is real. |
| **Booking made / cancelled / rescheduled** | Owner named it. Low work — emit in `lib/booking/finalizeBooking.js` (one place, both paths). Question: does an appointment appearing on the schedule already count as the notification? For a **cancellation** it clearly doesn't. |
| **Voice credit exhausted → phone stopped answering** | Currently only FieldQuo sees it (`recordError`). The contractor's phone stops ringing and `/app` says nothing. Fix may belong in the billing banner rather than the feed. |
| **AI answered a call** | Owner named it. But this is the highest-frequency event in the product and could single-handedly train people to ignore the feed. Probably belongs as a **daily rollup** ("14 calls answered, 3 became leads"), not per call. |
| **Crew message held pending attribution** | A photo the crew believes was filed and wasn't. Needs the `pending`/`superseded` states respected. |
| **Timesheet returned to pending by a self-edit** | Money moves on the number. Recipient is the supervisor who approved it. |

**Tier 3 — build only if asked.**

| Event | Why it ranks low |
|---|---|
| Change order approved / billed | Real money, but the person doing it is the person who'd be told. |
| Visit completed | Volume, low information. Better as a rollup. |
| Job status change | Same. |
| Quote declined | Already emailed. A feed entry is fine but adds little. |
| "A document was changed by someone else" | The owner asked for it, and it is the **most likely single feature to ruin the feed**. Every quote edit, every note, every price tweak. Only viable if scoped hard: *only* when the record has an `assignedToId` that is **not** the actor, *only* on a whitelist of material fields (price, dates, status — not a typo in a description), and *only* on documents already sent to a client. That is a product decision, not an implementation detail. |

---

## 10. What should NOT be in the feed

A feed that fires on everything trains people to ignore it, which then hides the
chargeback. Explicitly out:

1. **Task completion.** The owner's list did not include it; volume is high and
   information is near zero. A ticked checkbox is not news.
2. **Anything the actor did themselves.** Filtered at write time, not delivery
   — `resolveMentions`'s rule.
3. **Manually recorded payments.** `invoicePaymentNotice.js:11-16` already
   decided this and is right: a staff member is on the invoice page typing it
   in. Telling them they just did that is noise.
4. **Every settings change.** ~30 `settings.*` actions already flow to
   `ActivityLog`. That is where they belong — a record to consult, not an
   interruption. Two exceptions worth arguing: a member being deactivated, and
   a bank/payout detail changing.
5. **Every AI call.** Rollup, not per-event (tier 2).
6. **Client-facing sends.** Quote sent, invoice sent, reminder sent, review
   request sent — the staff member pressed the button.
7. **Cron completions.** `follow-ups`, `recurring-jobs`, `review-requests`,
   `voice-reconcile`, `social-scheduled-publish`. Nobody needs to know a job
   ran; they need to know when one *didn't*, and that already goes to
   `/platform/errors`.
8. **Anything with a dollar figure, to anyone with `showPricing: false`.**
   Not "redacted for" — not delivered to. Storing a pre-composed summary string
   and hoping to strip money at render time is the `GET /api/clients` failure
   again (`enforce.js:284+`).
9. **FieldQuo's own platform events** — `PlatformErrorLog`, sales pipeline,
   prospect scoring, `SALES_NOTIFICATION_EMAIL`. Different tenant, different
   console. `/platform` has its own surfaces.
10. **Anything a client-facing surface would see.** The feed is `/app` only. It
    is internal, so the white-label rule doesn't constrain its wording — the
    same carve-out `invoicePaymentNotice.js:96-105` documents — but that carve-out
    exists *because* the audience is the contractor's own team, and it stops
    being true the moment a notification string is rendered anywhere a homeowner
    can reach.

---

## 11. Open questions for the owner

1. **Supervisors.** Every existing notification goes to owner+admin only. He
   said "managers, admins, owners". Should Dispatcher and Manager get the money
   events (`quote.accepted`, `invoice.paid`), or only the operational ones?
2. **Leads and reps.** `GET /api/leads` is company-wide today, with
   `assignedToId` as an optional filter. Should a new enquiry notify everyone
   who can see leads, or only the assignee once assigned (and everyone while
   unassigned)?
3. **"Call missed."** Not modelled. What counts — no answer, a hang-up under N
   seconds, no transcript?
4. **"A document was changed by someone else."** Which fields, which documents,
   and only-if-assigned or always? Ranked tier 3 for exactly this reason.
5. **Home Screen install.** Push on iOS is impossible without it, and the
   product never asks. Is an install prompt worth building as the precondition
   for push, or is in-app + email enough?
