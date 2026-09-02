# Sales Portal — schema and attribution research

**Status: research only. No product code changed.** This document proposes a
schema and attribution model for FieldQuo's own Sales Portal (FieldQuo
salespeople prospecting contractors, selling FieldQuo, earning commission up
to $125 per attributed company). It does not implement anything, does not
design the Stripe milestone triggers that fire a commission, and does not
design RBAC for the portal itself — those are explicitly out of scope per the
brief and belong to other agents.

Every claim below is backed by a `file:line` citation into this repository as
it stands today. Where I could not determine something, it's called out
explicitly rather than guessed at (AGENTS.md failure class #5 — padding
absent data with defaults — applies to research documents too).

---

## 1. What already exists, and whether it can carry sales attribution

FieldQuo has **three** existing acquisition/reward mechanisms. None of them
is sales attribution, and none should be repurposed to become it — but each
established a convention worth reusing or explicitly rejecting.

### 1a. Contractor referrals (`lib/referrals/index.js`) — closest in *shape*, wrong in *kind*

This is contractor-tells-contractor: the referee gets `REFEREE_BONUS_MONTHS`
(1) of free trial, the referrer gets a Stripe balance credit worth one month,
paid only on the referred company's **first real payment**
(`lib/referrals/index.js:16-22`, `281-380`). The header is explicit about why
that's not paid at signup: "twenty throwaway addresses would earn a couple of
free years" (`lib/referrals/index.js:19-20`). This same fraud shape applies
directly to sales commission — a rep should not get paid $125 for a company
that never converts, for the identical reason.

Mechanisms worth reusing conceptually:
- **Idempotency via a compound unique constraint**, not a re-read-then-write
  check: `ReferralCredit` has `@@unique([companyId, role,
  counterpartyCompanyId])` (`prisma/schema.prisma:6115`), so a retried
  webhook or double-click can't grant twice (`lib/referrals/index.js:306-316`
  checks it explicitly, but the constraint is the real guarantee).
- **Self-referral checked on the code, not the email** (`lib/referrals/index.js:14`,
  `112-120`) — email is trivially varied; a rep's own signup link should be
  checked the same structural way (the rep's own company/account, not their
  email).
- **A grant that's a bonus must never block the operation it rides on.**
  `applySignupReferral` wraps everything in try/catch and returns `null` on
  any failure, logging loudly but never throwing (`lib/referrals/index.js:152-162`,
  `202-206`). Attribution capture at signup must follow the same rule — a
  broken sales-code lookup cannot 500 a signup.
- **A pending-credit sweep for a company with no Stripe customer yet**
  (`applyPendingReferralCredits`, `lib/referrals/index.js:387-407`) — commission
  will have the identical problem: a company attributed to a rep before they
  have a `stripeCustomerId` still needs its milestone applied once one exists.

What it is FOR and why it can't carry sales attribution: it is a two-sided
**reward-swap between companies** (both sides are `Company` rows). A sales
rep is not a `Company` — there is no tenant row to hang a referrer side off
of, and conflating the namespaces would mean a company redeeming `SALES-0042`
and a company redeeming a peer's `sunsetinc` code go through the same
`referralCode` field and the same `applySignupReferral` fraud logic that
doesn't apply to them (no self-referral concept, no "existing companies can't
redeem" rule — a rep's own past customer re-signing up under a different
company should very much be attributable). **Must stay separate.**

### 1b. Platform promo codes (`lib/platform/promoCodes.js`) — the real precedent for a *third code namespace*

Promo codes are `FQ-XXXXXXXX` tokens, deliberately namespaced apart from
referral codes (lowercase company slugs) "so the two namespaces never
collide and the signup path can tell them apart"
(`lib/platform/promoCodes.js:6-9`). `app/api/companies/route.js:270-276`
tries promo first; only a `null` result (not a promo code at all) falls
through to referral. **This is the pattern a sales code has to slot into** —
a third prefix, tried in the same waterfall, because the signup form has
exactly one `referralCode` field and one `?ref=` query param today (see §3).

What it is FOR: platform-minted, single-purpose trial extensions for
influencers/testers, redeemed at most once per company
(`PlatformPromoRedemption.companyId @unique`, `prisma/schema.prisma:467`).
It has no counterparty reward, no ledger, no "who gets paid" concept at all
— it cannot carry commission. **Must stay separate**, but its
`@@unique([promoCodeId, companyId])` + `companyId @unique` idempotency
pattern (one redemption per company, full stop) is exactly the shape a
"one company, one attributed rep, ever" lock needs (see §4).

### 1c. `ReferralLink` — a documented cautionary tale, not reusable

`ReferralLink` (`prisma/schema.prisma:4451-4463`) is a **homeowner-refers-a-
neighbour** model that was scaffolded, wired to one route, and deliberately
never finished. The model comment (`prisma/schema.prisma:4431-4450`) is
unusually direct about why: its landing page read *"{company} thinks you'd
like FieldQuo"* — a **client-facing surface leaking the FieldQuo brand**,
which is the product's first non-negotiable (AGENTS.md: "Anything that leaks
'FieldQuo' into a client-facing surface needs a deliberate reason"). It's kept
in the schema with zero rows rather than dropped, on the reasoning that
removing a table to tidy up is a worse trade than a documented unused one.

This is directly relevant here for a different reason than the brief names:
it's proof this codebase has a **precedent for scaffolding a whole model and
never wiring it up**, and proof the owner would rather that model sit
documented-and-unused than be half-finished. If the Sales Portal schema
ships before the portal itself, it must be documented as clearly as this one
is, not silently present. Structurally it offers nothing reusable — it's a
per-`Client` (a contractor's own customer) `code`, and sales attribution has
no `Client` in the loop at all.

### 1d. Data-migration write path (`lib/migrations/writes.js`, `MigrationWrite`) — the audit-row precedent

The newest audited-write pattern in the codebase, and the direct model for
"an admin correction with an audit trail" (§4 below):

- `MigrationWrite` is created **in the same transaction** as the write it
  describes (`lib/migrations/writes.js:97-105`, `205-213`) — "the write
  happened" and "the write is logged" can never come apart.
- It carries a **frozen snapshot** (`snapshot Json?`,
  `prisma/schema.prisma:3249`) specifically so a later edit to the live row
  "can't rewrite the log's account of what FieldQuo actually wrote"
  (`prisma/schema.prisma:3244-3248`).
- The actor id (`platformAdminId`) is a **plain column, not a relation** —
  "same convention as `Quote.sourceCallId`: this is looked up for display
  ... and never listed FROM the [actor] side" (`prisma/schema.prisma:3237`,
  echoing the same reasoning at `3124-3128` for `MigrationRequest.requestedById`).
  A `SalesAttribution.correctedByAdminId` should follow the identical
  convention.
- Every write is gated by re-reading state **fresh, inside the transaction**,
  never trusting a status read a request earlier
  (`lib/migrations/writes.js:29-38`, `docs/MIGRATION-SERVICE.md`'s "checked
  fresh, inside the write's own transaction" language). The lock check for
  attribution (§4) must do the same: read the current attribution row inside
  the transaction that's about to change it, not trust a value the route
  handler read on an earlier query.

What it is FOR: a narrow, sanctioned exception letting a superadmin create
(never edit) rows inside a *company's* tenant data. Not reusable as a model —
sales attribution isn't creating `Client`/`Quote` rows — but its
**audit-row-in-the-same-transaction** shape is exactly what "correctable by
an admin only with an audit trail" (the brief's own words) requires.

### 1e. `VoiceCreditEntry` — the ledger precedent, and the strongest fit

Already an append-only money ledger with a company-scoped balance and a
nullable-but-meaningfully-unique `ref` for idempotency
(`prisma/schema.prisma:6725-6785`, `lib/voice/credits.js`). Its own header
states the two design decisions that matter most here:

> "The balance is a SUM, not a counter... A counter column would be one bad
> write away from disagreeing with the calls that moved it"
> (`lib/voice/credits.js:17-24`).

> `ref` is "Idempotency key for anything that must happen EXACTLY ONCE,
> enforced by the database rather than by a read-then-write that two
> concurrent callers can both pass" (`prisma/schema.prisma:6781-6784`), with
> worked examples: `"voice_trial"` (once per company forever),
> `"number_rent:<numberId>:<date>"` (once per period), `"voice_topup:<paymentIntentId>"`
> (once per paid top-up, however many of the two settlement paths — redirect
> and webhook — reach it first) (`prisma/schema.prisma:6787-6807`).

This is the model I'm proposing the commission ledger copy almost verbatim
(§5). What it is FOR: metering a *company's* spend against a wallet they
topped up. It has no notion of a third party (a rep) being paid, and no
notion of one company attributed to one person — reusing the table itself
would mean bolting rep-payout semantics onto a table `lib/voice/credits.js`
already carefully scopes to "what a call costs the company." **Must stay
separate**, but its shape is the template.

### 1f. `PlatformAuditLog` — general admin action log, not a ledger

`prisma/schema.prisma:293-301`: `platformAdminId`, `action` (free string),
`targetCompanyId`, `details Json?`. This is FieldQuo's general "an admin did
X to company Y" trail (used for things like extending a trial). It could log
*that* an admin corrected an attribution, but it has no schema for *what
changed to what* the way `MigrationWrite`'s `entityType`/`entityId`/
`snapshot` does, and no reversal/ledger semantics at all. Worth writing to in
addition to a dedicated audit row, not instead of one — see §4.

### 1g. `Company` lifecycle timestamps — see §6. Already exist; no new field needed for several milestones.

**Verdict for §1:** nothing existing can carry sales attribution or a
commission ledger without corrupting what it already means. Four small new
models are justified: `SalesAttribution` (or similar — see §2),
`SalesAttributionAudit` (the correction trail), a rep-generated invite model
(the true analog of `ReferralInvite`, §3), and a commission ledger modeled on
`VoiceCreditEntry` (§5). Everything else — the fraud posture, the
idempotency convention, the audit-in-transaction convention, the "never
block the primary operation" convention — should be copied from what's
already here, not reinvented.

---

## 2. Where the attribution fields belong: a separate row, not `Company` columns

**Argued conclusion: a separate `SalesAttribution` row, one per company, not
columns on `Company`.**

The case for columns on `Company` (simpler queries, no join, matches how
`referralCode`/`referredByCode`/`referredAt` were done for the referral
programme — `prisma/schema.prisma:970-975`) is real and I'm not dismissing
it: three plain columns (`salesRepId`, `attributedAt`, `attributionSource`)
would answer "who gets credit for this company" with no join, exactly like
`referredByCode` does today.

But the brief's own requirement breaks that: **attribution must be
correctable by an admin, with an audit trail, and it must survive a second
rep's link being used.** Both of those need *history*, and a column can only
ever hold the current value. Consider the sequence the brief explicitly
names: Rep A's link is used at signup; three months later Rep B's link is
also used (already-attributed company, must be handled — see §4); an admin
later corrects it to Rep C because of a dispute. On `Company` columns, that's
three separate concepts:

- the column value (Rep A, then possibly still Rep A after the lock refuses
  Rep B, then Rep C after the correction),
- a "losing touch" record for Rep B's attempt, which needs its own table
  anyway because a column can't hold two things,
- an audit trail for the correction, which — per `MigrationWrite`'s own
  precedent — should be a **different row than the value it's describing**,
  so the log survives independent of what the live value says right now.

So even the "just add columns" option ends up needing at least one
additional table (for losing touches, and for the correction audit). At that
point a single `SalesAttribution` row *is* the simpler design, not the more
complex one — it makes "who currently gets credit" (`WHERE companyId = ? AND
status = 'active'`, or, per §4, simply the one unlocked-or-locked row per
company) and "what happened to this company's attribution over time"
(`WHERE companyId = ? ORDER BY createdAt`) the same table, indexed the same
way `ReferralCredit` already is for its own "history + current state"
question (`prisma/schema.prisma:6116-6118`).

One `Company` column *is* still worth adding, though, mirroring
`referredAt`/`referredByCode`: a **denormalized `Company.salesAttributedAt`
and `Company.hasSalesAttribution` (or equivalently, keep it entirely off
`Company` and just index `SalesAttribution.companyId`)**. I'd lean toward
**no denormalized column at all** — `Company` already carries
`referralCode`/`referredByCode`/`referredAt` for the *other* acquisition
channel, and a company can plausibly have both a referral and a sales
attribution (a rep sold a company that also happens to have a referrer, or
vice versa — nothing in the brief says these are mutually exclusive). Adding
sales columns to `Company` risks exactly the confusion `AvailabilitySchedule`
vs. `Company.businessHours` was written to avoid (AGENTS.md: "The two are
allowed to disagree, and conflating them [publishes/pays] the wrong thing").
Keep `Company` untouched; `SalesAttribution.companyId` is the only pointer,
queried the direction it's needed.

---

## 3. Capturing attribution reliably across three paths

The brief names three paths: a rep's signup URL, a rep-generated prospect
invitation, and a code typed during signup. Before proposing anything, the
existing signup flow constrains what's actually possible:

### What the signup flow does today (and where it already breaks under exactly this stress)

- `?ref=` is read **once, from `window.location.search`, on mount**
  (`app/signup/page.js:540-543`), and stored into a plain `referralCode`
  React state variable (`app/signup/page.js:471`).
- That state is **not part of the persisted draft.** The draft-save effect
  (`app/signup/page.js:710-720`) serializes `form`, `selectedPlanId`,
  `selectedIndustries`, `selectedCategoryIds`, `showAllServices`, and
  `billingInterval` into `sessionStorage` — `referralCode` is conspicuously
  absent from that list. The draft-restore effect (`app/signup/page.js:678-708`)
  correspondingly never restores it.
- **This means the existing referral capture already fails a page refresh**
  once the visitor has navigated off the URL that carried `?ref=` (the funnel
  has multiple steps — `lib/signup/funnel.js` — and nothing re-appends `?ref=`
  to the URL as the visitor moves through them). A closed tab reopened from
  a bookmark, or a resumed draft on a second visit, loses the code today.
  This is not hypothetical — it's the exact failure mode the brief is
  worried about, already present in the one mechanism that most resembles
  what's being asked for. Don't copy this part.
- `referralCode` is finally sent once, in the POST body of
  `app/api/companies/route.js` (`app/signup/page.js:1085`, request body
  destructured at `app/api/companies/route.js:73-77`), and resolved
  **server-side**, after the `Company` row exists, in a promo-then-referral
  waterfall (`app/api/companies/route.js:270-276`).
- **The `?ref=` param and the `referralCode` body field are both already
  claimed** by the promo/referral system. `SALES-0042` cannot reuse either
  name without colliding — a company clicking a sales link and then also
  having a referral code pre-filled (or vice versa) would silently pick
  whichever the waterfall tries first. A sales code needs its **own query
  param** (e.g. `?sales=` or `?rep=`) and its **own POST body field**
  (`salesCode`), extending the existing waterfall rather than overloading it
  — same pattern as promo-then-referral, now promo-then-referral-then-sales,
  each tried in order, first non-null match wins, exactly like
  `app/api/companies/route.js:270-276` already does for two.

### Path 1 — rep's signup URL (`fieldquo.com/signup?sales=SALES-0042`)

Not "don't rely exclusively on cookies" in the literal sense — this repo's
signup flow doesn't set a cookie for referral/promo capture at all; it's
already URL → React state → POST body, no cookie in the loop. The owner's
instruction reads as a warning against building a *new*, cookie-based
capture mechanism for the sales case specifically (marketing-attribution
cookies are the obvious first instinct and the fragile one: blocked by
Safari ITP/ad blockers, cleared on browser switch, lost on a different
device). **Given that, the fix is smaller than "avoid cookies" — it's "fix
the bug the existing mechanism already has,"** by doing the two things
referral capture doesn't:

1. **Persist the sales code into the same `sessionStorage` draft** the rest
   of the form already survives on (`DRAFT_KEY`,
   `app/signup/page.js:75`, `710-720`) — add it to the saved/restored fields
   list, the same as `selectedPlanId` etc. This survives a refresh and a
   closed-then-reopened tab **within the same browser**, which is the
   documented scope of that store (`app/signup/page.js:69-73`: "one person's
   unfinished form in one tab... should die with the tab").
   - **Failure mode this does NOT fix**: a different device, a different
     browser, or a cleared site data. A contractor who clicks the link on
     their phone and finishes signup on a laptop loses it. This is
     structural to any client-held state (cookie or sessionStorage alike)
     and is exactly why path 3 (a typed code) has to exist as a fallback —
     it's the one path that survives any device, any session gap, any
     amount of time.
2. **Resolve and validate the code server-side, early, the way `/refer/[code]`
   already does** (`app/api/public/refer/[code]/route.js` pattern referenced
   at `app/signup/page.js:548`) — so a stale or typo'd sales code is caught
   before the confirmation banner promises attribution the backend will then
   silently refuse. Same reasoning as `checkRedeemable` being separate from
   the granting call (`lib/referrals/index.js:100-105`): "someone should be
   told 'this link has already been used' on the page, not after they've
   filled in a form."

Failure mode of this mechanism specifically: **the rep and the contractor on
the same office IP** (named in the brief) is a non-issue for URL-param
capture — IP has nothing to do with it, the code travels in the URL/session,
not inferred from network. I flag this because it's the classic tell of a
design that *was* going to use IP or fingerprint-based attribution, which
this mechanism correctly avoids. The real failure mode is **link sharing**:
the code is visible in the URL, so it can be forwarded, screenshotted, or
reused by someone other than the intended prospect — same as promo codes
already are, which is why promo/referral both allow the reuse ("a forwarded
link should still count for the sender," `prisma/schema.prisma:6065-6067`)
rather than trying to fight it. Sales attribution should decide the same way
explicitly: is a forwarded sales link still that rep's credit? (Almost
certainly yes, same reasoning as `ReferralInvite` — the rep did the outreach
that produced the eventual signup, forwarding doesn't erase that.)

### Path 2 — rep-generated prospect invitation

The direct structural analog already exists: **`ReferralInvite`**
(`prisma/schema.prisma:6050-6078`). Its shape is close to exactly right for
"a rep sends a specific prospect a personal invite, tracked, redeemed on
signup":

- One row per invite, `email`/`phone` (exactly one set —
  `prisma/schema.prisma:6056-6060`), a `channel` enum (`email`/`sms`/`link`),
  a `status` enum (`sent`/`failed`/`redeemed`), `providerMessageId`/`error`
  for delivery tracing (`prisma/schema.prisma:6070-6072`), and —
  critically — `redeemedByCompanyId String? @unique`
  (`prisma/schema.prisma:6067`), which is where the "one invite, one
  eventual company, matched loosely by contact details rather than a hard
  link" idea (`prisma/schema.prisma:6064-6067`) lives.

A **sales-equivalent invite model** (`SalesProspectInvite` or similar) would
carry the same shape, but pointed at a rep instead of a company, and would
be the thing a rep-generated *code* (a `ReferralLink`-shaped per-prospect
token, not a shared per-rep code) resolves against at signup. Reusing
`ReferralInvite` directly is wrong for the same reason reusing `Company`
referral columns is wrong: its `companyId` FK
(`prisma/schema.prisma:6053-6054`, `"ReferralInvitesSent"` relation) is the
**sender**, always a contractor company — a FieldQuo rep sending it has no
`Company` row to be the sender of. It needs its own table with a rep-side FK
in the sender position, everything else copied.

Failure mode: **an invitation opened days later.** This is the one path that
doesn't depend on a live browser session at all — the invite row exists
server-side from the moment the rep generates it, keyed by its own token/code,
matched at signup by that token (best case) or contact-detail matching as a
fallback (worst case, mirroring `ReferralInvite`'s own loose match). Time
elapsed doesn't degrade it the way it degrades a cookie or even
`sessionStorage`. The real failure mode here is a **prospect who signs up
through a completely different path than the one they were invited on** (the
email invite sits unopened, they later just Google FieldQuo and self-serve
sign up) — that's not a bug in the mechanism, it's a case where attribution
correctly stays null (§7) unless the typed-code path (below) catches it.

### Path 3 — a code typed during signup

This is the fallback that survives every failure mode above (different
device, closed tab, days-later, no cookie/session at all) because it asks
the human to be the persistence layer. It's the same UI surface the referral
code already occupies conceptually — a plain text field on the signup form —
but, per the namespace collision above, needs its own field (`salesCode`),
tried in the same server-side waterfall.

Failure mode: **a rep and a contractor on the same office IP** is where this
path actually matters, and the brief's naming it here (not on path 1) is
telling — it's worried about someone typing the *wrong* code, deliberately
or by confusion, not about IP inference (this codebase infers nothing from
IP for attribution anywhere I found). The mitigation is the same
`checkRedeemable`-style validation before commit (does this code belong to
an active rep? is it well-formed?) plus the lock in §4 doing the real work:
if the company already has attribution, a second typed code is a **losing
touch**, recorded, not silently overwritten and not blocking signup.

### What survives what — summary table

| Mechanism | Refresh (same tab) | Closed tab, same browser | Different device | Days later | Forwarded/shared |
|---|---|---|---|---|---|
| URL param, session-persisted | survives (once fixed) | survives (once fixed) | **lost** | survives if tab kept | attributes to whoever clicks |
| Rep-generated invite (token) | irrelevant — server-side | survives | survives | **survives — the point of this path** | attributes to whoever redeems the token, which may not be the invited person (loose match, same tradeoff as `ReferralInvite`) |
| Typed code | irrelevant — server-side | survives | survives | survives | requires someone to *know* the code — the intentional friction |

No single mechanism covers every case, which is exactly why the brief asks
for three. They're complementary, not redundant, and the waterfall (§2 of
`app/api/companies/route.js`, extended) is how a signup that arrives with
more than one signal (e.g., clicked the link *and* typed a code) picks one
deterministically — first non-null match, same as promo-before-referral
today.

---

## 4. What "locked" means, concretely

**Both a DB constraint and an application guard — the constraint alone isn't
enough, because "locked" here means something richer than "can't insert a
duplicate row."**

- **DB constraint**: `SalesAttribution.companyId @unique` (a company has at
  most one *active* attribution row — see below for why "at most one row,
  period" isn't quite right). This is the same idempotency-by-schema
  convention as `PlatformPromoRedemption.companyId @unique`
  (`prisma/schema.prisma:467`) and `ReferralInvite.redeemedByCompanyId
  @unique` (`prisma/schema.prisma:6067`) — a database-enforced "this can only
  ever happen once for this company," not a race-prone read-then-write.
- **Application guard**: the brief asks specifically what happens to a
  *second* rep's link on an already-attributed company — "silently ignored,
  recorded as a losing touch, or refused?" Given the fraud posture the
  referral code already establishes (never block the primary operation,
  `lib/referrals/index.js:152-162`), the answer should be **recorded as a
  losing touch, silent to the visitor, loud to the reps/admins**: a signup
  must never be interrupted or refused over an attribution collision — that
  would be the exact "control that appears to work and doesn't" AGENTS.md
  warns about, this time in the shape of a working signup that suddenly
  fails because of an internal sales-commission dispute the contractor has
  no part in. So:
  - The **first** valid attribution signal for a company (by whichever path,
    first-touch, matching how `applySignupReferral` treats the referral code
    present *at signup* as authoritative) creates the locked `SalesAttribution`
    row and is the one commission is ever paid against.
  - A **later** signal for an already-attributed company (a second rep's
    link, a different typed code, an invite redeemed after the fact) is
    recorded — not discarded — as a **losing-touch row**, same table or a
    sibling table (`SalesAttributionTouch`, all touches including the
    winning one, with the winning one flagged), so a rep who later disputes
    "I sold that account" has something to point at, and so FieldQuo can see
    when its own reps are colliding in the field (a real business signal,
    not just a fraud check).
  - This needs its own re-check-fresh-inside-the-transaction pattern, same
    as `loadWritableMigration` (`lib/migrations/writes.js:29-38`): the
    "does this company already have attribution" check and the "create the
    row" write happen in one `$transaction`, closing the same race the
    `companyId @unique` constraint backstops if two attribution attempts
    land concurrently.
- **Admin correction is a different operation than "locking," not an
  exception to it.** Per the brief: correctable by an admin only, with an
  audit trail. This should not be an `UPDATE` on the `SalesAttribution` row —
  following the `MigrationWrite` precedent (§1d) and the append-only
  principle (§5), a correction should be a **new row that supersedes the
  old one**, plus a `SalesAttributionCorrection` audit row (actor, reason,
  before/after, timestamp) written in the same transaction, exactly like
  `MigrationWrite` is written alongside the `Client`/`Quote` it describes
  (`lib/migrations/writes.js:97-105`). This keeps the "locked" guarantee
  intact for everyone except a superadmin acting through one narrow,
  logged, superadmin-only path — the identical shape non-negotiable #3's
  migration-write exception already uses for a structurally similar
  problem (an otherwise-absolute rule with one sanctioned, audited hole).
  Whether that permission is a new entry in `SUPERADMIN_ONLY_PERMISSIONS`
  (`lib/platform/permissions.js:37-42`, e.g. `sales_attribution:correct`) is
  an RBAC decision I'm flagging, not making (out of scope per the brief).

---

## 5. The commission ledger

**Proposed: append-only, modeled directly on `VoiceCreditEntry`
(`prisma/schema.prisma:6725-6785`), with reversals as new negative rows,
never edits.**

Concretely:

```
model SalesCommissionEntry {
  id               String   @id @default(cuid())
  salesRepId       String   // plain column, same convention as MigrationWrite.platformAdminId —
                             // looked up for display, never listed FROM the rep side here
  companyId        String
  company          Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  salesAttributionId String // which attribution this entry is paying out against —
                             // ties every cent back to the locked row in §4

  cents            Int      // positive = commission owed/earned, negative = a reversal.
                             // Same "balance is a SUM, not a counter" reasoning as
                             // VoiceCreditEntry (lib/voice/credits.js:17-24) — a rep's
                             // total owed is SUM(cents) WHERE salesRepId = ?, never a
                             // column that can drift from the entries that produced it.

  milestone        String   // e.g. "signup" | "first_payment" — NOT designed here,
                             // this is a placeholder for whatever the Stripe-milestone
                             // agent defines. Kept as a string, same as VoiceCreditEntry.kind
                             // (prisma/schema.prisma:6775), so a new milestone type doesn't
                             // need a migration.

  ref              String?  // THE idempotency key — see below
  note             String?

  createdAt        DateTime @default(now())

  @@unique([ref])            // mirrors the *intent* of VoiceCreditEntry.ref, made a real
                              // constraint rather than left nullable-and-hoped, because unlike
                              // voice (which has legacy rows keyed on callId/stripeRef alone —
                              // prisma/schema.prisma:6803-6805) this ledger has no legacy rows
                              // to be backward-compatible with (§7) — it can require ref from day one.
  @@index([salesRepId])
  @@index([companyId])
}
```

**The natural idempotency key**, mirroring `VoiceCreditEntry`'s worked
examples (`prisma/schema.prisma:6787-6807`):

- For a milestone triggered directly by a Stripe webhook event (e.g. "first
  payment cleared"): `commission:<companyId>:<milestone>:<stripeEventId or
  paymentIntentId>` — the same shape as `"voice_topup:<paymentIntentId>"`
  (`prisma/schema.prisma:6800-6801`), which explicitly exists to handle "the
  success-URL redirect and the `checkout.session.completed` webhook both
  credit, in either order" (`prisma/schema.prisma:6805-6807`). A replayed
  Stripe webhook computes the identical `ref` string and collides on the
  unique constraint — it can never pay twice, by construction, not by a
  check.
- For a milestone that isn't payment-triggered (e.g. "signup," if any
  commission is owed simply for a completed, attributed signup):
  `commission:<companyId>:signup` — once per company forever, same shape as
  `"voice_trial"` (`prisma/schema.prisma:6789-6791`, "once per company
  FOREVER... instead [guarding on state] would let a company release and
  re-buy," i.e. guard on the fact, not on a mutable state that can reset).
- A **reversal** (a chargeback, a fraud finding, an admin correction that
  changes who's owed) is a **new row with negative `cents`** and its own
  `ref` (e.g. `reversal:<original ref>`), never an edit or delete of the
  original row — this is the append-only guarantee the brief explicitly
  asks for, and it's the same principle `ReferralCredit` already applies at
  smaller scale (a credit row records what was granted at the time; the
  code comment is explicit that a later change to the reward size "can't
  retroactively rewrite what a company was actually given,"
  `prisma/schema.prisma:6098-6100`).

**Why not reuse `VoiceCreditEntry` itself** (beyond the "different money,
different owner" argument in §1e): its `pool` discriminator
(`prisma/schema.prisma:6773`) exists specifically to keep two *company-side*
wallets (voice vs. AI) from cross-contaminating, with the comment noting
"never set by a caller... so a new spender cannot put a row in the wrong
wallet by forgetting an argument" (`prisma/schema.prisma:6741-6743`). A
commission ledger has a structurally different subject (paying a *rep*, not
metering a *company*) — bolting it on as a third `pool` value would make
`companyId` mean two incompatible things depending on the row (whose wallet
this is, vs. whose signup this commission is about), which is exactly the
kind of conflation `lib/company/businessHours.js` vs. `AvailabilitySchedule`
was written to avoid.

---

## 6. Existing `Company`/`Subscription` timestamps — several milestones need no new field

Confirmed present today, all readable without any schema change:

| Milestone | Field | Location |
|---|---|---|
| Company created (signup instant) | `Company.createdAt` | `prisma/schema.prisma:989` region (`992` in the version read) |
| Trial end date | `Company.trialEndsAt` | `prisma/schema.prisma:930` |
| Lifecycle state (pending/active/suspended/churned) | `Company.onboardingStatus` | `prisma/schema.prisma:929`, enum at `5756-5761` |
| Stripe Connect verified (a real, payable business — the referral programme's own proxy for "not a burner signup," `lib/referrals/index.js:298-301`) | `Company.stripeChargesEnabled` / `stripeOnboarded` | `prisma/schema.prisma:988-990` |
| Referral/promo already present (relevant if a company can carry both a referral and a sales attribution) | `Company.referredByCode` / `referredAt` | `prisma/schema.prisma:970-975` |
| Subscription created | `Subscription.createdAt` | `prisma/schema.prisma:689` |
| Trial end (subscription's own, may differ from `Company.trialEndsAt` after a referral/promo extension — see `lib/referrals/index.js:170-183`'s "whichever is later" logic) | `Subscription.trialEndsAt` | `prisma/schema.prisma:688` |
| Current billing period end | `Subscription.currentPeriodEnd` | `prisma/schema.prisma:687` |
| Subscription state (trialing/active/past_due/canceled) | `Subscription.status` | `prisma/schema.prisma:686`, enum `5763-5768` |
| First went unpaid (grace period anchor — deliberately not `updatedAt`, see the comment) | `Subscription.pastDueSince` | `prisma/schema.prisma:717` |
| Cancelled | `Subscription.canceledAt` | `prisma/schema.prisma:771` |
| "You're subscribed" confirmation sent (proof of first real conversion, arguably the cleanest "first payment" proxy already in the schema) | `Subscription.welcomeEmailSentAt` | `prisma/schema.prisma:699` |

**What's genuinely missing**, if the eventual milestone design needs it:
there is no `Subscription.firstPaidAt`/`firstInvoicePaidCents` distinct from
`welcomeEmailSentAt` (which fires on *any* successful checkout reconciliation,
trial included, not specifically a *paid* invoice — `grantReferrerCredit`
sidesteps this entirely by keying off the webhook's own
`paidAmountCents > 0`, `lib/referrals/index.js:284`, rather than a stored
column). If the commission design needs "first dollar actually collected"
as a trigger, the referral programme's approach — read it off the live
Stripe webhook payload at the moment it fires, don't store it — is the
existing precedent, and I'd flag inventing a stored `firstPaidAt` column as
something to discuss with whoever designs the milestone triggers, not
something to add here speculatively.

---

## 7. Migration risk — `prisma db push`, no migration files, every existing company has no sales attribution

Confirmed: this repo has no migration history (`AGENTS.md`: "Migrations:
`prisma db push` — no migration files"), and `prisma db push` cannot run
data backfills — it can only add/alter columns and tables, and any new
column without `@default(...)` on a table with existing rows either fails or
requires `--force-reset` (which drops the database — the exact hazard
`Company.updatedAt`'s own comment documents fighting,
`prisma/schema.prisma:989`ish: "`@default(now())` is required, not
stylistic... the only remedy [Prisma] offers is `--force-reset`, which drops
the database").

**Everything proposed here avoids that hazard by construction, not by
discipline**, because every new model (`SalesAttribution`,
`SalesAttributionTouch`, `SalesAttributionCorrection`,
`SalesCommissionEntry`, the rep-invite model) is a **brand-new table**, not a
new column on an existing one. A new table with **zero existing rows** needs
no default, no backfill, and no migration of anything — `prisma db push`
just creates it. This is the same shape the `MigrationRequest`/
`MigrationWrite` feature already shipped in this exact way (two entirely new
tables, `prisma/schema.prisma:3108-3255`), and the same reasoning
`ReferralLink`'s own comment gives for why an *unused* table is a fine state
to be in (`prisma/schema.prisma:4448-4450`: "a migration that removes a
table to tidy up dead code is a worse trade than a documented unused one" —
the inverse claim, that adding an empty table is a fine and cheap trade, is
the same argument run forward).

**"Null attribution" must mean, everywhere a query touches it**: *this
company was never sold by a FieldQuo rep* — not "unknown," not "pending," not
"organic-but-untracked." Concretely:

- **No backfill, ever, for any existing company.** Every company that exists
  today gets zero rows in `SalesAttribution`. That's not a data gap to fill
  later; it's the correct, permanent, honest answer for a company that
  genuinely wasn't attributed to a rep, in exactly the sense AGENTS.md's
  failure class #5 means by "absence of a statement is not a statement" — a
  company with no `SalesAttribution` row is not "attribution pending," it's
  "there is no sales attribution for this company," full stop, forever,
  unless a real signal (one of the three paths) arrives for it in the
  future (which is legitimate — an existing organic company *could* later
  be claimed by a rep through a typed code, same as an existing company can
  redeem nothing else it missed at signup).
- **Every read path must LEFT JOIN / optional-relate, never assume
  presence.** A commission report, a rep's dashboard, an admin's "who sold
  this" screen — all must render "no rep attributed" as a real, distinct
  state (mirroring how `Company.brandColors` being `null` explicitly means
  "derive sensible defaults" rather than being padded with an invented
  value, `prisma/schema.prisma:862-864`), not a blank that could be mistaken
  for a loading state or an error.
- **The commission ledger has nothing to reverse for pre-existing companies**,
  because it can only ever contain entries created going forward, referencing
  `SalesAttribution` rows that also only exist going forward. There is no
  "should we retroactively credit reps for the last two years of signups"
  question this schema needs to answer — that's a policy decision, not a
  migration risk, and explicitly not mine to make.
- Nothing proposed here requires reading, mutating, or backfilling a single
  existing `Company`, `Subscription`, `Member`, or any other pre-existing
  row. The only touch on `Company` is a new *relation* declaration (Prisma's
  `company SalesCommissionEntry[]`-style back-reference, which is metadata,
  not a data change) if the ledger's `companyId` gets a `@relation` — even
  that's optional; `MigrationWrite.platformAdminId` and
  `MigrationRequest.requestedById` both show the established convention of
  a **plain string column with no relation at all** for exactly this reason
  (`prisma/schema.prisma:3124-3128`), which sidesteps even that question.

---

## Proposed schema (illustrative — not a final DDL, and not to be applied)

```prisma
// Locked, one-per-company. The row that answers "who currently gets credit."
model SalesAttribution {
  id               String   @id @default(cuid())
  companyId        String   @unique
  company          Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  salesRepId       String   // plain column — see lib/migrations/writes.js convention
  source           String   // "signup_link" | "prospect_invite" | "typed_code"
  sourceRef        String?  // the code/token/invite id that produced this row

  createdAt        DateTime @default(now())

  // Superseded by a correction — see SalesAttributionCorrection. The live
  // row's salesRepId is always current; corrections are a separate audited
  // event, not an in-place edit history.
}

// Every signal that touched a company's attribution, winning or not — the
// "losing touch" record §4 asks for, and the field-collision signal for
// FieldQuo's own sales ops.
model SalesAttributionTouch {
  id          String   @id @default(cuid())
  companyId   String
  salesRepId  String
  source      String
  sourceRef   String?
  won         Boolean  // true for exactly one touch per company — the one
                        // that became the SalesAttribution row
  createdAt   DateTime @default(now())

  @@index([companyId])
  @@index([salesRepId])
}

// The audit trail for an admin correction. Append-only, same transaction as
// the SalesAttribution update it describes — mirrors MigrationWrite.
model SalesAttributionCorrection {
  id                  String   @id @default(cuid())
  companyId           String
  fromSalesRepId      String?
  toSalesRepId        String
  reason              String
  correctedByAdminId  String   // plain column, same convention as MigrationWrite.platformAdminId
  createdAt           DateTime @default(now())

  @@index([companyId])
}

// Append-only commission ledger, modeled on VoiceCreditEntry.
model SalesCommissionEntry {
  id                  String   @id @default(cuid())
  salesRepId          String
  companyId           String
  company             Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  salesAttributionId  String

  cents               Int      // + earned, − reversed
  milestone           String   // not designed here — placeholder for the Stripe-milestone agent's vocabulary
  ref                 String   @unique // idempotency key — see §5
  note                String?

  createdAt           DateTime @default(now())

  @@index([salesRepId])
  @@index([companyId])
}

// The rep-generated-prospect-invitation path — the true analog of
// ReferralInvite, with a rep in the sender position instead of a Company.
model SalesProspectInvite {
  id                   String   @id @default(cuid())
  salesRepId           String
  email                String?
  phone                String?
  code                 String   @unique // the per-prospect token, resolved at signup
  channel              String   // "email" | "sms" | "link" — mirrors ReferralChannel
  status               String   @default("sent") // "sent" | "failed" | "redeemed"
  redeemedByCompanyId  String?  @unique
  redeemedAt           DateTime?
  providerMessageId    String?
  error                String?
  createdAt            DateTime @default(now())

  @@index([salesRepId, createdAt])
}
```

Deliberately not designed here: the `salesRepId` FK target (no `SalesRep` or
equivalent model exists in this schema today — see "Could not determine"
below), any enum vs. string tradeoff for `source`/`channel`/`status` (this
repo does both — `ReferralChannel` is an enum, `PlatformPromoCode.kind` is a
string with a comment explaining why — and the choice should follow whoever
owns the portal's actual redemption code), and RBAC for who can write which
of these tables.

---

## What I could not determine

- **What represents a FieldQuo salesperson.** `PlatformAdmin`
  (`prisma/schema.prisma:45-56`) is `support`/`superadmin` only
  (`PlatformAdminRole`, `prisma/schema.prisma:5751-5754`) — there's no third
  role, and no separate "sales rep" identity model anywhere in the schema.
  Every `salesRepId` above is written as a bare string precisely because I
  don't know whether a rep will be a new `PlatformAdmin` role, a wholly new
  model, or something else — that's an identity/RBAC decision for whoever
  designs the portal's auth, not something I should invent here.
- **The commission trigger design** (what "milestone" fires $X of the $125,
  whether it's one lump sum on first payment or split across signup/
  first-payment/some-later-point) — explicitly out of scope per the brief.
  `SalesCommissionEntry.milestone` is a placeholder string for that design.
- **Whether a company can be attributed to a sales rep AND have a referral
  code active at the same time**, and if so which programme's reward takes
  priority, if they'd ever conflict. Nothing in the referral code suggests
  they're mutually exclusive today (a referred company is still free to be
  sold by a rep later, or vice versa), but I found no explicit product
  ruling either way and didn't want to invent one.
- **Whether reps see or interact with commission amounts in dollars anywhere
  the browser could send a number back** — non-negotiable #5 ("the browser
  never sends money amounts") almost certainly extends to a rep-facing
  portal the same way it applies to the client-facing add-on flow, but I
  didn't find an existing rep-facing surface to confirm the pattern against,
  so this is a flag for whoever builds the portal UI rather than a verified
  finding.
- **Whether `PlatformPromoCode`/`ReferralCode` and a future `SalesCode`
  should live in one unified "redemption code" table** with a `kind`
  discriminator, versus three separate tables as they are today (and as
  proposed above). I found real precedent for keeping them apart (their
  fraud rules genuinely differ — no self-referral concept applies to a
  promo code, no "existing companies can't redeem" rule would apply to a
  sales code) but didn't find a strong argument either way once a *third*
  namespace is added, and this is a call for whoever implements it, weighing
  code-reuse against the "the copy is the one that rots" convention this
  repo already leans toward keeping things apart over.

---

## Cross-check against `AGENTS.md` non-negotiables

- **#1 (signup open, joining invite-only)**: sales attribution doesn't touch
  who can *join* a company — it's purely "who gets credit," orthogonal to
  membership. No conflict found.
- **#3 (platform console views everything, edits nothing on a company's
  data)**: `SalesAttribution`/`SalesCommissionEntry` etc. are **not**
  company tenant data (no `Client`, `Quote`, `Invoice`, `Job` touched) — same
  category as `PlatformAuditLog` or `DemoHostAvailability`
  (`prisma/schema.prisma:303-310`'s own reasoning for why FieldQuo's-own
  data is a different question than a company's data). The one place this
  gets close is the admin correction (§4) — modeled explicitly on the
  migration-write exception's audit shape rather than as a silent edit.
- **#5 (browser never sends money amounts)**: the ledger design (§5) never
  takes a `cents` value from anything the portal's frontend would post —
  every proposed entry is server-computed from Stripe events or admin
  action, same posture as `grantReferrerCredit` computing its own amount
  server-side (`lib/referrals/index.js:281-284`).
- **Recurring failure class #1 (fields written and never read, or read and
  never written)**: flagged directly at the `SalesAttribution` design
  itself — if the portal ships the schema before the redemption UI, this
  document is the record that it's a deliberate, documented gap (like
  `ReferralLink`), not a silent one.
