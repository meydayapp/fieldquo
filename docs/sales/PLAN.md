# Sales Portal — analysis and implementation plan

Answers the twelve questions in the brief. Nothing has been built. Five
read-only research passes produced `RESEARCH-*.md` alongside this file; every
load-bearing claim below was re-verified by hand, and two of the research
findings were **wrong and are not carried forward** (noted in §14).

---

## 0. Three live bugs found on the way, unrelated to the sales portal

These are in shipped code. Two of them cost real money the day a rep starts
demoing, so they are Phase 0, before any rep exists.

**A. A demo account can buy a real, billable Twilio crew-texting number.**
`purchaseCrewLine()` (`lib/crew/line.js:305`) checks company, phone shape,
Twilio config, signature config, existing number and availability — and never
checks `isDemo`. The identical hazard on the voice side was found and fixed
by someone already; `lib/voice/demoLine.js`'s header states the reasoning
exactly: a purchased number "outlives the demo, keeps billing FieldQuo, and is
a real line a stranger can dial while the account is re-dressed as a different
trade next week." Every word applies here. Worse, `wipeContent()` doesn't
touch `CrewInboxNumber`, so the number survives every demo reset.
*Fix: mirror the voice approach — refuse the purchase for `isDemo`, or issue a
NANP 555-01XX fictional line so the screen still demos end to end.*

**B. The quote/invoice Send button emails for real from a demo account.**
No `isDemo` guard in `app/api/quotes/[id]/send/route.js` or anywhere in
`lib/email/`. What actually prevents real sends today is that seeded demo
clients have `@example.com` addresses — that is *data, not a guard*. A rep who
types a live prospect's address into a demo quote to make the walkthrough feel
real will send that prospect a real email from a fake company.
*Fix: a demo company's outbound send goes to a preview, not to Resend.*

**C. `PLATFORM_PERMISSIONS.admin` describes a role the database cannot store.**
`PlatformAdminRole` has exactly `support` and `superadmin`
(`prisma/schema.prisma:5751`). But `lib/platform/permissions.js:4` defines a
full eight-permission `admin` tier including `impersonate` and
`company:manage`, and `POST /api/platform/admins` accepts `"admin"` — its own
400 message advertises it — then hands it to Prisma, which throws on the enum.
A reader would reasonably believe FieldQuo has three platform tiers. It has
two. This matters here because the plan below extends that same enum.

None of these are fixed yet. Say the word and they go first.

---

## 1. What already exists that we can reuse

| Need | Reuse | Why it fits |
|---|---|---|
| Append-only money ledger | `VoiceCreditEntry` | Unique `ref` for idempotency; balance is **summed, never stored** |
| State machine w/ re-check in transaction | `lib/migrations/state.js` | `TRANSITIONS` + `canTransition()`, re-read inside the write |
| Audit row written in the same transaction | `MigrationWrite` | Exactly the shape an attribution correction needs |
| Payout gate on Connect readiness | `grantReferrerCredit()` | Already gates on `onboardingStatus === "active" && stripeChargesEnabled` |
| The right Stripe event for first payment | `lib/platform/stripeBilling.js:562` | Referrals already key on `billing_reason === "subscription_create"` |
| Demo tenants + reset | `lib/demo/seedDemo.js`, `/platform/demo` | Ten real `Company` rows, `assertDemo()` re-reads `isDemo` before every wipe |
| Mocking a vendor for demos | `lib/social/mockMetaGraphClient.js`, `lib/voice/demoLine.js` | Both substitute at the single vendor-call seam |
| Canned call playback | `VoiceCall.transcript` / `recordingUrl` + existing Listen button | The proxy route isn't domain-locked; Cloudinary-hosted audio plays with **no frontend change** |
| Period maths, trends | `lib/analytics/periodPresets.js`, `trend.js` | UTC-day discipline already correct |
| Sample-size honesty | `kpis.js` floors, `NOT_TRACKED` | Directly applicable to the leaderboard |
| Row-scoping primitive to generalise | `assignedJobWhere()` (`lib/permissions/enforce.js:189`) | The pattern, not the code — see §10 |

**Cannot be reused, despite looking like it can:**

- **`Member`.** The entire stack resolves one session to one company via
  `session.activeOrganizationId`. A rep is one identity across many companies,
  read-mostly. Making a rep a `Member` of each attributed company would
  consume the customer's licensed seats and put FieldQuo staff inside a
  contractor's tenant — the thing non-negotiable #2 exists to prevent.
- **`ReferralLink`.** Present in the schema, deliberately never wired, because
  its landing page said "FieldQuo" and broke white-label. Kept as a caution.
- **The `/api/settings/members` invite flow.** It assumes an actor who is a
  member, a seat check against that company's plan, and a Better Auth org
  invitation. None of that applies to FieldQuo hiring its own staff.

---

## 2. Identity — how "add a salesperson like an employee" gets honoured

The brief asks for the *feel* of the employee-invite screen. That is a UX
requirement, and it can be met without the `Member` substrate that can't carry
it.

**Recommendation: a sales rep is FieldQuo staff, so it joins the platform-admin
family.**

- Add `sales_rep` to `PlatformAdminRole` — **after fixing bug C**, so the enum
  is corrected once rather than extended while broken.
- New `SalesRep` profile row: `platformAdminId`, `code` (their attribution
  slug), `commissionPlanId`, `demoCompanyId`, `startedAt`, `active`.
- New screen `/platform/sales/reps` that *looks and reads* like
  `/app/settings/team`: name, email, invite, deactivate. Emailed-invite is a
  new pattern for FieldQuo staff (today `POST /api/platform/admins` sets a
  password directly), so it gets built once, here.

A rep gets its own gate in `middleware.js` at `/sales`, placed after the
subdomain rewrite and the impersonation gate, before the app gate. A rep must
never receive the `PlatformAdmin` cookie — sharing it would silently grant
whatever any unaudited `/api/platform/*` route grants a non-null admin.

---

## 3. Schema changes recommended

All new tables, zero existing rows, so `prisma db push` is additive with no
backfill. **Null attribution is a permanent, correct state** for all 31
existing companies — it is not a gap to fill in.

```
SalesRep              platformAdminId, code @unique, commissionPlanId,
                      demoCompanyId, startedAt, active

SalesAttribution      companyId @unique, salesRepId, source (link|manual|admin),
                      capturedAt, lockedAt, supersededById
                      -- a correction is a NEW row + audit, never an edit

SalesAttributionAudit companyId, fromRepId, toRepId, actorAdminId, reason, at

SalesCommissionEntry  companyId, salesRepId, milestone, amountCents,
                      ref @unique, status, stripeEventId, occurredAt
                      -- balance summed, never stored; reversal = negative row

SalesCommissionPlan   name, m1Cents, m2Cents, m3Cents, retentionDays, active

SalesPayoutBatch      salesRepId, periodStart, periodEnd, status, totalCents,
                      paidAt
```

Attribution lives in its own row rather than columns on `Company` because
"locked, admin-correctable, audited" is history, and a column has none.

Several milestones need **no new field**: `Company.stripeChargesEnabled`,
`Subscription.status`, `Subscription.canceledAt`, `trialEndsAt` all exist and
are already webhook-maintained.

---

## 4. How attribution is captured reliably

Three paths, one waterfall, first non-null wins and then locks:

1. **Rep link** — `/signup?sales=CODE`. It must be its own parameter: `?ref=`
   and the `referralCode` POST field are already claimed by the promo/referral
   waterfall in `app/api/companies/route.js:270`.
2. **Rep enters the company manually** from their portal, before or shortly
   after signup, matched on the company's email.
3. **Admin correction** — superadmin only, writes a new superseding row plus
   an audit row in one transaction, the `MigrationWrite` pattern.

One gap to close that the existing `?ref=` mechanism has: the signup draft
persists `form`, plan, industries, categories, interval and step to
`sessionStorage` (`app/signup/page.js:706`) but **not** the referral code. A
plain refresh is fine — the query string survives and the capture effect
re-runs. What loses it is leaving `/signup` by a link (Terms, Login) and
returning by a *fresh* navigation: the whole draft restores and the code is
gone. The sales code should be persisted in the draft.

**Locked** means: a DB unique on `companyId` (same shape as
`PlatformPromoRedemption.companyId`), plus an application guard that, on a
second rep's touch, **records the touch rather than refusing the signup**. A
contractor's ability to sign up must never depend on our commission
bookkeeping.

---

## 5. Milestone 1 — $20  ·  REOPENED, see 5b

**Decided by the owner, 1 Sept 2026: Stripe Connect activation alone. Onboarding
completeness is not part of this milestone and must never be added to it.**

The reasoning is the owner's and it is stronger than the recommendation it
replaced. Checking `lib/onboarding.js` after the fact shows the "onboarding
complete" option was not merely stricter — it was **unsatisfiable for a whole
segment**:

```
lib/onboarding.js:109   done: seatsUsed > 1,          // the "team" step
lib/onboarding.js:183   complete: doneCount === steps.length
```

`seatsUsed` is active members plus pending invites. A one-person shop has
exactly 1, forever, so the team step never ticks and `complete` is never true.
Not unlikely — impossible. Since a solo operator run from a van is a core
FieldQuo customer, option (b) would have paid **zero** commission on an entire
class of legitimate sale. That is the kind of rule that looks conservative and
is actually just wrong.

**What `stripeChargesEnabled` proves, precisely.** It is set from Stripe's own
`account.updated` webhook and means Stripe has run its KYC: government ID
verification, business details, and a real bank account attached. It is the
signal that the contractor can actually take a homeowner's money — which is
also the closest thing the product has to "this is a real business."

### The fraud trade, stated plainly so nobody re-litigates it later

`lib/referrals/index.js` deliberately pays the referrer on the referred
company's **first payment**, not at signup, because "twenty throwaway addresses
would earn a couple of free years." Milestone 1 pays $20 during the trial,
before FieldQuo has collected a cent. **The two programmes now have different
fraud postures on purpose.** Do not "harmonise" them.

What makes the trade defensible is that Connect activation is expensive to fake
in a way an email address is not:

- Stripe verifies a government ID and a bank account. Twenty throwaway
  addresses cannot produce twenty verified identities.
- Stripe runs its own fraud screening on the account before enabling charges.
- The friction is borne by the *contractor*, not by us, and it is friction they
  have to accept anyway to use the product.

What it does **not** prove, and what the controls in §9 therefore exist for:

- That the business has any customers, or will ever pay FieldQuo a dollar.
- That the person who verified is unconnected to the rep. A rep recruiting
  relatives to complete Connect and split $20 is the residual surface, and it
  is a velocity-and-duplicates problem, not an identity problem — Stripe does
  not expose the verified identity to us, so we cannot match on it.

Exposure is bounded and knowable: $20 × activations, per rep, before any
revenue. That is what the review threshold in §9 is sized against.

---

## 6. Milestone 2 — $40 on first subscription payment

`invoice.payment_succeeded`, filtered to `billing_reason === "subscription_create"`
**and `amount_paid > 0`**.

The amount filter is not defensive padding. First month is free
(`TRIAL_PRICE`), and the referral programme grants free months on top — a $0
invoice would otherwise pay a $40 commission on nothing collected.

**The trap to avoid:** `checkout.session.completed` fires at trial start with
zero collected, creates the `Subscription` row, and flips `onboardingStatus`
to `active`. It is the event that *looks* right.

Milestone 2's entry supplies the 60-day anchor for milestone 3 — there is no
`Subscription.firstPaidAt`, and `Subscription.createdAt` is trial start, not
first payment.

---

## 7. Milestone 3 — $65 at 60 days

A nightly cron sweep, matching all 18 existing crons (none of which is a
natural host, so this is new; `app/api/cron/grace-warning/route.js` is the
template — `requireCronSecret`, claim-before-act, batch not cursor).

Conditions: 60 days after milestone 2's `occurredAt`; `Subscription.status`
still `active`; `canceledAt` null; **no refund and no chargeback on the
qualifying charge.**

**That last condition cannot be evaluated today.** The billing webhook does
receive `charge.refunded` and all three dispute events and calls
`settleChargeEvent` — but that handler only recognises a refund landing on an
**Invoice `Payment`** row, and a subscription charge has no `Payment` row, so
it takes the "not one of ours" branch and silently no-ops. A contractor who
charges back their own FieldQuo subscription is invisible to this codebase.

**Subscription-side refund/dispute tracking has to be built before milestone 3
can be honest.** That is its own phase.

Reversal, when it happens, is a **new sign-flipped ledger row** and a status
transition — never an edit to the paid amount. Dated from Stripe's own event
timestamp, never `new Date()`, so a replay months later can't move it.

---

## 8. Weekly payout batches

Record intent, then apply as an idempotent side effect — the seam
`grantReferrerCredit()` → `applyCreditToBalance()` already uses.

- Boundaries in UTC, via `periodPresets.js`, so a Sunday-night close means the
  same instant for everyone.
- **Re-sum the ledger live at payout time.** Never a cached batch total; a
  reversal landing mid-batch must be reflected.
- Entries earned after the cutoff roll to next week rather than reopening a
  closed batch.
- **No money moves in this build.** A batch closes to `ready`, exports, and is
  marked `paid` by a human. Actually transferring funds to reps is a separate
  decision with its own compliance surface, and nothing in the brief requires
  automating it on day one.

---

## 9. Fraud controls — first versus later

**First (all detectable with what's stored):**
- A rep may not be attributed to a company they are a member of, or one whose
  signup email matches theirs — self-dealing is the cheapest fraud.
- Milestone 1 requires `stripeChargesEnabled`: a real Connect account with a
  real bank account is a meaningful cost to fake.
- Milestone 2 requires money actually collected (`amount_paid > 0`).
- Velocity: N signups from one rep in a window flags for review.
- Duplicate business name / address / phone across a rep's attributions.

**Later (needs new capture):**
- IP and device at signup. `deviceGuard.js` fingerprints, but only
  post-login. Capturing at signup has a privacy tradeoff worth deciding
  deliberately.
- Chargeback rate per rep — blocked on §7's refund tracking.

**Review state:** follow `deviceGuard.js` exactly — `under_review` is a flag
that holds a payout, **not a lockout**, requires more than one independent
signal, and is cleared only by a human. A rep must never be accused by a cron.

---

## 10. RBAC / security changes required

- **A new scoping primitive.** There is no `assignedCompanyWhere()` in
  `lib/platform/`. `assignedJobWhere()` is the right pattern but it scopes
  rows *inside* one already-scoped tenant; this scopes the tenant boundary
  itself, which is materially higher-stakes.
- **A rep has zero write path** to `SalesAttribution`, `SalesCommissionEntry`,
  `SalesPayoutBatch`, or any billing status — re-checked fresh at write time,
  the way `canWrite()` does in the migration service. Commission-on-influence
  means a rep who can write to their own ledger is a rep who can pay
  themselves.
- **What a rep can read** is the open product question in §11. Default to the
  narrowest thing that makes the dashboard work: company name, signup date,
  milestone states, subscription status. Not the contractor's quotes, clients,
  or revenue.
- `check:tenant-scope` needs a new assertion class; `check:rbac-side-doors`
  needs to know the `/sales` guard exists. Most other check scripts are
  `Member`-grid-specific and don't apply.

---

## 11. Edge cases the brief doesn't cover

1. **Annual billing.** `billingInterval` is `"month" | "year"` and live. An
   annual subscriber has made no second payment at day 60, and their refund
   exposure is 12× larger. Does milestone 3 fire at 60 days regardless?
2. **Subscription refund/chargeback is untracked** — §7. The largest one.
3. **A company cancels and later re-signs.** Same rep paid twice? New
   attribution, or does the lock persist?
4. **A rep leaves FieldQuo.** Do their companies keep generating commission?
   Milestone 3 lands 60 days after a payment — likely *after* some departures.
5. **Plan tier.** Commission is flat, but plans start at $99 and go up. Same
   $125 for the cheapest and dearest?
6. **Two reps, one company** — A demos, B closes. Split, first-touch, or
   last-touch? The lock makes this a real decision, not a formality.
7. **Promo code + sales code together.** The signup waterfall already resolves
   promo and referral; sales is a third namespace in the same queue.
8. **Clawback with no future earnings.** A reversal on a rep who has been paid
   out and earns nothing further leaves a negative balance. Ledger handles it
   arithmetically; what happens commercially is a policy call.
9. **A Stripe event arriving before attribution exists.** Must log the miss,
   not silently no-op — the exact failure the health check already found in
   the referral credit lookup.
10. **A demo company converting to real**, or a rep's demo being reset
    mid-walkthrough by another rep — today any platform admin can reset any of
    the ten demos, and "one demo per rep" is a naming convention with nothing
    enforcing it.
11. **Mid-cycle plan change / proration.**
12. **Timezone on the weekly boundary** — settled by UTC above, but worth
    naming since reps will ask why Sunday closed when it did.

---

## 12. Demo accounts and the mocked AI

Ten demo companies already exist as real `Company` rows with `isDemo: true`,
with a working reset that re-verifies `isDemo` before every wipe. So
"one resettable demo per rep" is mostly an **assignment** problem:
`SalesRep.demoCompanyId`, plus a guard so a rep can only reset their own.

**Phase 0's demo leaks (§0 A and B) must be closed first.** A rep giving a
live walkthrough is precisely the person who will type a real prospect's phone
number or email into a demo.

**The mocked AI call.** `VoiceCall.transcript` and `recordingUrl` exist, the
Listen button works, and its proxy route isn't domain-locked — so three canned
recordings hosted on Cloudinary, seeded against demo `VoiceCall` rows from the
transcripts already supplied, play with no frontend changes. The crew-text
mock follows `mockMetaGraphClient.js`: substitute at the single vendor-call
seam, re-deriving `isDemo` at call time rather than trusting a flag passed in.

One more leak to close while here: `lib/analytics/pricingBenchmark.js`'s
platform-wide "what similar contractors charge" average has **no `isDemo`
exclusion**. If a rep toggles a demo's `shareAnonymizedPricing` on during a
walkthrough, fabricated demo rates join the benchmark shown to real paying
customers.

---

## 13. Phased plan

**Phase 0 — safety, before any rep exists.** The three bugs in §0, plus the
benchmark leak. Small, independent, and all of them protect either money or
someone's inbox.

**Phase 1 — identity and attribution.** Fix the `PlatformAdminRole` enum, add
`sales_rep`, `SalesRep` + `SalesAttribution` + audit, the `/platform/sales/reps`
invite screen, the `/sales` middleware gate, `assignedCompanyWhere()`, and
demo assignment. *Nothing pays out yet.*

**Phase 2 — milestones 1 and 2 and the ledger.** Both are event-backed and
honest today. Reps start earning; payouts are visible but not batched.

**Phase 3 — subscription refund and dispute tracking.** Extend
`settleChargeEvent` to recognise a subscription's charge. Prerequisite for
Phase 4, and valuable on its own regardless of the sales portal.

**Phase 4 — milestone 3 and weekly batches.** The 60-day cron, reversal
handling, payout batches, export.

**Phase 5 — dashboards, leaderboard, CAC, cohorts, fraud review.** Leaderboard
rates use `RATE_FLOOR = 10`, not the count floor: ranking reps by conversion
is exactly the "small sample read as skill" failure the floors exist for.
Below floor, show "3 of 4", never a percentage.

Phases 0–2 are the ones that make the portal real. 3–5 can follow the first
reps into the field.

---

## 14. Two research findings NOT carried forward

Both were reported by research agents and both are wrong. Recorded so nobody
rediscovers them as fact.

1. *"The `?ref=` code is lost on refresh."* It isn't. Both `replaceState` and
   `pushState` in `app/signup/page.js` pass two arguments, so the URL and its
   query string are never modified; on refresh the capture effect re-runs. The
   real gap is narrower and is stated correctly in §4.
2. *"Refunds and disputes aren't handled."* They are — for Connect-side
   invoice payments, thoroughly. What's missing is specifically the
   subscription side. `docs/health/06-payments-integrations.md` is stale on
   this; it was accurate when written and `MONEY-FIXES` landed after it.

---

## What needs a decision from you

1. ~~Milestone 1 gate~~ — **decided: Stripe Connect activation alone.** (§5)
2. Annual subscribers and the 60-day milestone. (§11.1)
3. Two reps, one company — split, first-touch, or last-touch? (§11.6)
4. Flat commission across all four plan tiers? (§11.5)
5. Does a departed rep keep earning milestone 3? (§11.4)
6. How much of a contractor's data may a rep see? (§10)

---

## 15. Separate bug, found while confirming §5

A solo contractor can never finish the onboarding checklist. The "team" step is
`done: seatsUsed > 1` and `complete` requires every step, but only
`tax_registration` is dismissible (`app/api/onboarding-status/route.js`) — so a
one-person company is shown an "Invite your team" item it can never tick and a
progress figure that can never reach 100%.

This is not the sales portal's problem, but it is the same finding: a control
offered to someone who cannot act on it. The fix that matches the codebase's
own habits is to make the team step dismissible the way tax registration
already is — "I work alone" is a statement, and recording it is honest, whereas
leaving a permanent nag treats a solo shop as an incomplete company.

**Built.** See §5b for the shape it took (a statement recorded in Settings, not
a dismissal on the card) and `scripts/check-onboarding-solo.mjs` for the
executable proof that `complete` is now reachable for a one-person company.

---

## 16. Correction: onboarding completeness IS a definite signal

An earlier note in this analysis said "completed business onboarding" might
need defining before it could be measured. **That was wrong**, and the owner
was right to push back. It is defined, in `lib/onboarding.js`, as seven
concrete booleans:

| key | check |
|---|---|
| `logo` | `!!company.logoUrl` |
| `business_info` | phone AND address AND city AND province |
| `services` | at least one enabled category |
| `pricing` | a typed `defaultRate` OR a trade that ships priced |
| `payments` | `!!company.stripeChargesEnabled` |
| `team` | `seatsUsed > 1` (members + pending invites) |
| `tax_registration` | number saved — or absent from the list entirely if dismissed |

**`payments` is already one of the seven.** Onboarding-complete is therefore
not an alternative to the Connect signal; it is that signal plus six others.

Two things checked rather than assumed:

- The `logo` label promises "logo and brand color" but only reads `logoUrl`.
  This is **not** a bug: `brandColor` is `String? @default("#06356b")`, so every
  company has one from creation and checking it would always pass.
- The consequence for a solo shop is worse than a nag.
  `OnboardingProgress.js:46` is `if (!status?.steps?.length || status.complete)
  return null` — the card hides **only** on `complete`. A one-person company
  sees that checklist on its dashboard permanently.

### 5b. The solo checkbox, and what it unlocks

The precedent is in the same file, and its comment already argues the design
(lines 124–140): *"A step nobody can finish is worse than no step; a step
nobody can get rid of is the same bug wearing a hat."* It also settles where
the control belongs — Settings, beside the field, **not** a dismiss button on
the card, because dismissing says "stop showing me this" while ticking a box
records *why*, and an owner can change it when they hire.

So, following that precedent exactly:

- `Company.worksAloneAt DateTime?`, named after `taxRegistrationDismissedAt`.
- A checkbox in Settings > Team: "It's just me — no crew right now."
- When set, the `team` step is **not pushed into the array at all**, exactly
  as `tax_registration` isn't. Not greyed out, not ticked — absent.
- Verified: no such concept exists today under any other name.

**With that in place, `complete` becomes reachable for every company, and
milestone 1 can honestly gate on it.** That reopens the decision recorded in
§5. The remaining technical work is unchanged and small: `complete` is
recomputed on every read with no stored moment, so a commission milestone needs
`Company.onboardingCompletedAt` stamped the first time it computes true.

**Built, with one correction to the paragraph above.** The reopening closed the
other way: §5 is settled at Connect activation alone, and onboarding
completeness must never be part of milestone 1. So `Company.worksAloneAt` and
`Company.onboardingCompletedAt` both exist and are wired —
`getOnboardingStatus()` drops the team step when the box is ticked, and stamps
the completion date once, on the transition, guarded by
`updateMany({ where: { onboardingCompletedAt: null } })` so two simultaneous
dashboard loads cannot both write it. The date is read by the platform console
(Companies → company → Account → "Setup completed"), NOT by any payout.

### Dead code found while verifying this

`OnboardingProgress.js` has a `dismissTaxRegistration()` handler posting to
`POST /api/onboarding-status`, but the button renders only when
`step.dismissible` is truthy and `lib/onboarding.js:173` sets
`dismissible: false`. The button never renders; the handler and that POST
branch are unreachable. Leftovers from the design the comment describes
rejecting. The working path is the Settings checkbox via
`/api/settings/business-info`.

**Removed.** The handler, the button, the `onStatusChange` prop the dashboard
passed it, the POST route and its three orphaned translation keys are all gone;
`/api/onboarding-status` is GET-only. `scripts/check-tax-id.mjs` used to assert
that endpoint was correct and now asserts it does not exist, so the column has
one door.
