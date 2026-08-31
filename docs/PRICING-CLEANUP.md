# Removing the per-licence pricing model

Owner's ruling, 2026-08-31 (verbatim): *"We already have pricing model.
Please review the $45 per license was an older version. Remember we have 4
models starting at 99$ so can you make sure we keep it clean obviously when
you did the price change you didn't remove the $45 from the previous
pricing."*

So: the four-tier seat ladder (`lib/pricing/ladder.js` — Solo $99, Crew $169,
Shop $269, Scale $369) is the pricing. The $45/licence model in the old
`lib/pricing.js` was leftover from before that change and has been removed.

## No existing data was touched — read this first

**No `Plan` row, no `Subscription`, and no company's bill changed.** This
removal is entirely about the *code that mints new plans from a typed
headcount*. It never ran a migration, never renamed a plan, never repriced
anybody, and never deleted a row.

- The four legacy per-headcount plans ("1 Employee", "10 Employees", "20
  Employees") and every bespoke "Custom (N employees)" row — including the
  `Custom (2 employees)` at $90.00 named in the brief — are exactly as they
  were. Companies subscribed to them keep billing at exactly the same price,
  on exactly the same Stripe subscription, indefinitely.
- `lib/billing/retention.js`'s `perSeat` branch (cancel-flow "reduce your
  licences" offer) is untouched and still runs correctly for those companies
  — it is how the retention screen tells a flat ladder tier apart from a
  plan that genuinely bills per seat.
- `/platform/billing/plans` still lists them under "Legacy and bespoke
  plans" and still lets an operator edit or delete them by hand, same as
  before.
- Verified by running the actual `check:seat-limit`, `check:seat-ladder`,
  `check:signup-order`, `check:billing-interval` and `check:pricing-console`
  suites against the real code (not just reading it) — see the results
  below. `check:seat-limit`'s "A flat tier is not offered a licence
  reduction" section specifically exercises the legacy-plan code path this
  removal did not touch.

## Every place $45 / the per-licence model lived, and what happened to it

| Location | What it was | What happened |
|---|---|---|
| `lib/pricing.js` — `calculatePricing()` | 1–9 employees $45/licence, blend to $35 by 20, no price above 40 | Deleted, with a comment explaining why and pointing at the ladder |
| `lib/pricing.js` — `perLicense` | The per-seat rate the function computed | Deleted (nothing computes a per-licence rate any more) |
| `lib/pricing.js` — `NAMED_TIERS` | "1 Employee" / "10 Employees" / "20 Employees" promoted cards | Deleted — nothing imported it once `PricingCard`'s `tier` prop was removed |
| `lib/pricing.js` — band comments at the top of the file | Described the 1–9/10/11–19/20/21–40/41+ bands | Replaced with a note pointing at `lib/pricing/ladder.js` and this doc |
| `lib/billing/customPlan.js` | `findOrCreateCustomPlan()` — minted a "Custom (N employees)" Plan from `calculatePricing()` output | **Deleted.** Its one job doesn't exist any more — see the decision below |
| `prisma/seed-plans.js` | A seeder that `upsert`s the three `NAMED_TIERS` plans from `calculatePricing()`, **with an `update` clause that overwrites price** — the exact "dead control" bug `lib/billing/customPlan.js`'s own header warned about, in a second file | **Deleted.** It wasn't wired into any npm script, but `scripts/backfill-my-subscription.js` pointed an operator at it by name in an error message — fixed to point at `npm run seed:seat-ladder` instead |
| `app/api/companies/route.js` (company creation, signup) | Required `employeeCount`, called `calculatePricing()`, minted a Custom plan when no `planId` was given | Now requires `planId`. See the `employeeCount` decision below |
| `app/api/platform/billing/checkout/route.js` (upgrade checkout, "Add licences") | Accepted `employeeCount` OR `planId`; the `employeeCount` branch called `calculatePricing()` and minted a Custom plan | Now requires `planId` only. As a side effect, the mid-trial "keep it free until the trial ends" carry-over — previously scoped only to the `employeeCount` branch — now applies to *any* plan change through this route, since there's no longer a reason to treat a seat upgrade differently from a tier change. Flagging this as a small behaviour change beyond pure removal: a company that upgrades tier mid-trial via "Choose plan" now also keeps its free days, where before only "Add licences" did |
| `app/components/marketing/PricingCard.js` | `calculatePricing(employeeCount \|\| 1)` computed a `perLicense` figure and rendered `"($X/licence)"` next to *every* plan card, including flat ladder tiers (Solo showed "$99/mo ($17/licence)") | The `perLicense` line and the `tier`-prop code path (dead — nothing has passed a bare `tier` since the ladder moved to real `Plan` rows) are both removed. This is the exact bug in the owner's complaint: the ladder went live, but every tier card kept printing a derived per-licence number underneath it |
| `app/signup/page.js` — the "Custom" card | Typed employee count → `calculatePricing()` → "$X/mo" preview → posted `employeeCount` | Removed. Replaced with a plain "Need more than Scale? Contact us" card — see the `employeeCount` decision below |
| `app/components/SeatUpgradePanel.js` | Team page's "Add licences" panel — typed employee count → POST to the checkout route above | **Deleted**, replaced by `app/components/SeatCapUpgradeNotice.js`, which points at Account & Billing's plan picker instead of taking a number. Used on `app/app/settings/team/page.js` and `app/app/settings/team/new/page.js` |
| `app/i18n/messages.js` — `pricing.perLicense` | `"(${amount}/license)"` and its 5 translations | Removed from all 6 languages (`check:translations` confirmed 100% coverage stayed intact — see below) |
| `app/(marketing)/terms/page.js` §3 | "FieldQuo is billed per licensed seat, at the rate shown on the pricing page for your team size" | Rewritten to describe the flat per-plan rate and the seats+free-crew shape |
| `docs/DEMO-SCRIPT.md` "What does it cost?" | Quoted the $45/seat figure verbatim, with the $90/month worked example, for a live sales call | Rewritten to the four real tier prices |
| `docs/DEMO-CREW.md` | Had an open item — **"Two live pricing models, not reconciled"** — flagging exactly this problem, unresolved | Marked resolved, with a pointer to this doc |
| `docs/ROADMAP.md` | An entry describing the find-or-create fix to `lib/billing/customPlan.js`, from before it was known the model itself needed to go | Left as accurate history; a new entry added directly after it describing this full removal |
| `docs/TODO.md` — "Decide before the next demo — two live pricing models" | The section another agent is working in, per your instruction not to touch it | **Not edited**, per instruction. It describes exactly the problem this session fixed — the decision has been made and the code changed. Please update or close that section; I did not touch the file |

Comments that mention `calculatePricing()` / `seed-plans.js` purely as
**historical explanation** of an already-completed fix (`lib/platform/
stripeBilling.js`'s changelog header, `scripts/check-pricing-page.mjs` and
`scripts/check-signup-order.mjs`'s synthetic test fixtures describing the
*shape* of a legacy row) were left alone or lightly corrected to no longer
point at a deleted file — they describe what was true at the time, not a
present-tense claim, and rewriting every historical note was out of scope.

## The `employeeCount` decision, and why

The hard question: what happens to a request that still carries an
`employeeCount`, now that there are four tiers instead of a continuous
per-seat rate?

**I read `lib/pricing/ladder.js` in full first, per the instruction.** It
does have a headcount → tier function: `tierFor({ seats, crew })`. It is
*not* usable as a drop-in replacement, because it needs **seats and crew as
two separate numbers**, and a plain `employeeCount` is one number. The split
matters and isn't guessable: `isBillableSeat()` in the same file exists
specifically because a seat is defined by what a person's permission grid
lets them do (originate money — create/edit a quote, job or invoice), not
by a headcount or a job title. Turning `employeeCount: 6` into "1 seat + 5
crew" (or "6 seats + 0 crew", or anything else) would be inventing a split
that isn't in the request — the exact "padding absent data with a default"
failure class AGENTS.md names, except the padding here is a price.

**Decision: reject the parameter, require `tierKey`/`planId`.** Both routes
(`app/api/companies/route.js`, `app/api/platform/billing/checkout/route.js`)
now return 400 `"planId is required"` if no `planId` is given. This is
option (b) from the brief, chosen over (a) "map headcount → smallest tier
that fits" because (a) requires guessing the seats/crew split, which is
exactly the guess the ladder's own design goes out of its way to avoid
making silently.

In practice this cost nothing on the signup page: it already resolves a real
`planId` for every ladder tier via `/api/marketing/plans` and `PricingCard`
— the `employeeCount`/`isCustom` path was *only* reachable through the
"Custom" card, which is what's being removed. The Team page's "Add licences"
panel is the other caller; it's replaced with a redirect to Account &
Billing's plan picker (see `SeatCapUpgradeNotice` above), which was already
the *other* upgrade path shown on that same page for a ladder-based seat/crew
cap — so this removes a second, redundant, dead-end mechanism for the same
job rather than degrading anything.

## The 41+ / above-Scale gap

**There is no ladder equivalent above Scale, and that is a real gap — no
price was invented for it.** `SEAT_LADDER` has exactly four rungs; `tierFor()`
returns `null` when nothing fits, by design (its own comment: *"a shop that
needs twelve seats is a conversation, and silently seating them on Scale
would bill them for ten and leave two people locked out with no
explanation"*).

The good news: the rest of the app already treats this correctly.
`lib/pricing/seatLimit.js`'s `seatLimitMessage()` already says *"Talk to us
about a plan that fits"* when `nextTier` is null, and the Team page already
renders that. I followed the same pattern in the two places I touched:

- **Signup's plan step** — the removed "Custom" card is replaced with a
  plain card: *"Need more than Scale? Scale covers up to 10 seats and 15
  crew. For a bigger team, we'll work out a plan by hand."* with a link to
  `/contact`. No price is shown or implied.
- **`SeatCapUpgradeNotice`** (Team + New User pages) — falls back to the same
  `"app.setTeam.capTalkToUs"` copy the page already used, when `nextTier` is
  `null`.

## Did `findOrCreateCustomPlan` survive?

**No — deleted, along with `lib/billing/customPlan.js`.** I checked both
things it might still be needed for before deciding:

1. **Is there still a way for an operator to create a genuinely negotiated
   one-off plan?** Yes — `/platform/billing/plans` → "New plan" (`POST
   /api/platform/billing/plans`, validated by `parsePlanFields`). This path
   writes a `Plan` row directly and was **always independent** of
   `customPlan.js` — it doesn't call `calculatePricing()` or
   `findOrCreateCustomPlan()` at all. So deleting the helper doesn't remove
   any capability an operator has today.
2. **Is anything else importing it?** Grepped the whole repo — only the two
   routes being fixed here ever imported it.

So its one job — mint a `Custom (N employees)` Plan automatically from
`calculatePricing()` output — no longer exists, and nothing else used it.

**A gap I found in passing, out of scope for this task:** the console's "New
plan" form has no `isPublic` checkbox, and `Plan.isPublic` defaults to `true`
in the schema. `findOrCreateCustomPlan` used to set `isPublic: false`
automatically for every bespoke row it minted, specifically to keep a
negotiated rate off the public picker. That automatic protection is gone
along with the function — and it was never present for a plan created by
hand through the console. So today, an operator using "New plan" to write a
genuinely negotiated one-off rate would have it show up in the public
picker and pricing page unless they separately go edit `isPublic` some other
way (there's no field for it in the UI at all). This is a real, live
exposure and predates this session's change, but is adjacent to it — I've
flagged it as a separate task rather than fixing it here, since it's a
console UI gap, not a per-licence pricing question.

## Checks — what ran, what failed against the removal, what I fixed vs. reworded

Ran the actual scripts, not just read them.

| Check | Result | What, if anything, needed fixing |
|---|---|---|
| `check:pricing-console` | **4 assertions initially referenced the removed model/file and had to change** | These asserted the *old* invariant — "both routes share `findOrCreateCustomPlan`" and "the helper never updates a row" — which is now false by design. Rewrote them to assert the *new* invariant instead: neither route calls `calculatePricing`/`findOrCreateCustomPlan` any more, both require `planId`, `lib/pricing.js` carries no `calculatePricing`/`perLicense`/`45`/`NAMED_TIERS`, and `lib/billing/customPlan.js` no longer exists. **This is where the "prove it can't come back" assertions live** — see mutation testing below |
| `check:seat-ladder` | 79/79 passed, no changes needed | Tests the ladder itself, untouched |
| `check:seat-limit` | 36/36 passed, no changes needed | Confirms the legacy per-seat retention path still works correctly — proof the legacy-plan handling elsewhere in the app wasn't broken |
| `check:signup-order` | 87/87 passed; **2 stale comments reworded, no assertion logic changed** | Two synthetic test fixtures describe a bespoke Plan row's shape "exactly as `lib/billing/customPlan.js` mints it" — that file is now deleted, so the comment was corrected to describe the shape as a legacy row's, not point at a file that no longer exists. The fixtures and assertions themselves were already correct and needed no change |
| `check:pricing-page` | 137/137 passed; **1 stale comment reworded** | Same kind of fix — a comment naming `lib/billing/customPlan.js` as the writer of `isPublic: false`, corrected to describe existing legacy data instead |
| `check:cost-compare` | 291/291 passed, no changes needed | |
| `check:competitors` | 1050/1050 passed, no changes needed | |
| `check:savings` | 298/298 passed, no changes needed | |
| `check:billing-interval` | 41/41 passed, no changes needed | Confirms the trial-days carry-over change to the checkout route didn't break cadence handling |
| `check:referral-reward` | 23/23 passed, no changes needed | |
| `check:translations` | Marketing catalogue 100% in all 6 languages both before and after removing `pricing.perLicense` — no missing/extra keys | Removed the key from all 6 language blocks at once (`MESSAGE_KEYS` is derived from the English catalogue, so a partial removal would have failed this check with "not in English" on the other 5) |
| `check:imports` / full `npm run build` | Clean, exit 0 | |

## New assertions proving the old model can't come back

Added to `scripts/check-platform-pricing-console.mjs` (not a new script —
the instruction was explicit that `check:all` is being edited by other
agents right now):

- **"neither signup nor a seat upgrade mints a plan from a headcount any
  more"** — asserts neither route's source contains `calculatePricing` or
  `findOrCreateCustomPlan`, and that both still resolve a plan via `planId`.
- **"the per-licence pricing model is gone, not just unused"** — asserts
  `lib/pricing.js` contains none of `calculatePricing`, `perLicense`, the
  literal `45`, or `NAMED_TIERS`.
- **"the find-or-create-a-custom-plan helper is gone, not just
  unreachable"** — asserts `lib/billing/customPlan.js` does not exist on
  disk.

### Mutations run, and the result

Backed up the three files first (`cp`, never `git checkout`, per the
standing rule against destructive git commands on uncommitted work), then:

1. Appended `export const perLicense = 45;` to `lib/pricing.js` → **failed**:
   `✗ the per-licence pricing model is gone, not just unused — perLicense
   should be removed`. Restored from backup, diffed clean.
2. Reintroduced a `calculatePricing(employeeCount)` call in
   `app/api/companies/route.js` → **failed**: `✗ neither signup nor a seat
   upgrade mints a plan from a headcount any more — app/api/companies/
   route.js still calls calculatePricing`. Restored from backup, diffed
   clean.
3. Recreated `lib/billing/customPlan.js` with a stub `findOrCreateCustomPlan`
   → **failed**: `✗ the find-or-create-a-custom-plan helper is gone, not
   just unreachable — lib/billing/customPlan.js should be deleted...`.
   Deleted it again, confirmed the file is gone.

After each mutation and restore, re-ran the check: `PASSED — 50/50
assertions` every time it should have passed, `FAILED — 1 of 50` every time
it should have failed. All three mutations were caught.

## Files touched

Removed:
- `lib/billing/customPlan.js`
- `prisma/seed-plans.js`
- `app/components/SeatUpgradePanel.js`

Added:
- `app/components/SeatCapUpgradeNotice.js`
- `docs/PRICING-CLEANUP.md` (this file)

Edited:
- `lib/pricing.js`
- `app/api/companies/route.js`
- `app/api/platform/billing/checkout/route.js`
- `app/components/marketing/PricingCard.js`
- `app/signup/page.js`
- `app/app/settings/team/page.js`
- `app/app/settings/team/new/page.js`
- `app/i18n/messages.js`
- `app/(marketing)/terms/page.js`
- `scripts/backfill-my-subscription.js`
- `scripts/check-platform-pricing-console.mjs`
- `scripts/check-pricing-page.mjs`
- `scripts/check-signup-order.mjs`
- `docs/DEMO-SCRIPT.md`
- `docs/DEMO-CREW.md`
- `docs/ROADMAP.md`

Not touched, as instructed: `app/globals.css`, `app/layout.js`,
`app/app/layout.js`, `docs/TODO.md`, `package.json`'s `check:all` chain,
`app/components/layout/**`, `app/components/mobile/**`,
`app/components/jennifer/**`, `app/components/designer/**`,
`lib/ai/crisisRule.js`, `lib/voice/prompt.js`,
`lib/voice/outboundPrompt.js`, `lib/platform/salesPrompt.js`,
`scripts/check-crisis.mjs`, `scripts/check-mobile-safety.mjs`.
