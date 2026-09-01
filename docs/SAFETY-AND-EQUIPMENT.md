# Safety incidents and equipment depreciation

Two things the schema had no data source for at all. The owner's own framing:

> "Safety incident rate — there is no incident log anywhere in the schema. How
> can they log it, and what is important and relevant?"
>
> "Equipment utilisation — Asset only records depreciation... there is no
> per-use log of when a piece of equipment was actually on a job. And the
> depreciation on it goes into costing too... some way to understand the type
> of tool and its life cycle / life expectancy in order to add it into the
> cost / depreciation."

This is the build log: what got built, why it's shaped the way it is, what
the numbers actually do, and what was deliberately left out.

---

## Part One — Safety incidents

### What a record holds, and why

`SafetyIncident` (`prisma/schema.prisma`):

| Field | Why it's there |
|---|---|
| `kind` | `injury \| near_miss \| property_damage \| other`. **Near-miss is the default**, not injury — a report defaults toward the harmless case, and the person filing it upgrades it deliberately. A trade that only logs injuries learns nothing until someone is hurt; a near-miss is the same hazard that hasn't hurt anyone *yet*. |
| `occurredAt` | When it happened, not when it was typed up. A crew member filing this from the truck an hour later still records the real time. |
| `location` | Free text. Not derived from the job's address — an incident during transport, at the shop, or with no job at all has no job address to fall back to. |
| `jobId` | Optional. Most incidents will carry one; a shop accident or a drive between jobs won't. |
| `involvedWorkerId` | Optional. A near-miss often involves nobody in particular, and a client or passerby on site is not a `Worker` row. |
| `reportedByMemberId` | Required. Who is accountable for having filed it — set from the session, never from the request body. |
| `description` | Required. The one field the record cannot be usable without. |
| `workStopped` | Did the crew stop work because of this. The single fact a follow-up review asks first. |
| `regulatoryNote` | Free text **the company writes**. See below — this is not a computed compliance field. |
| `status` | `open → reviewed → closed`. Never deleted; see "Never deleted" below. |
| `followUpNotes`, `followUpAt`, `reviewedByMemberId`, `reviewedAt` | The trail of what was done about it, and by whom. |
| `photos` | Reuses `JobPhoto`, hardcoded to `stage: "issue"` — see below. |

### Why `regulatoryNote` is free text, not a computed claim

The task was explicit that I should **not invent a regulatory claim** — no
statute, no reporting deadline, no authority named — unless verified, and I
did not verify one. Quebec is CNESST, Ontario is WSIB, and every province has
its own thresholds and deadlines for what counts as reportable and by when.
Saying "reportable to CNESST within 24 hours" without having checked is worse
than a blank field: it would be confidently wrong on a legal question, in a
product that is not a compliance product.

So `regulatoryNote` is exactly what it sounds like — a place for the company
to write down its own decision ("called CNESST, ref #12345" or "not
reportable, discussed with J."), never a system-computed answer. The form
says this outright: *"FieldQuo doesn't know your province's reporting rules
or deadlines — this is a place to write down what you decide, not a
compliance check."*

### Who can log one, and who can see it

New permission category, `safety`, in `lib/permissions.js` — same ladder
shape as every other category, enforced through `lib/permissions/enforce.js`
exactly like the rest of the grid (nothing new invented):

| Level | What it grants |
|---|---|
| `none` | No access. |
| `report_own` | **The floor.** File a report; see the ones you filed. |
| `view_all` | See every incident in the company. |
| `view_edit_all` | See every incident, and follow up (status, notes). |

The floor is `report_own`, not `none` — the owner's own framing was "a crew
member should be able to report one," so a member who cannot see the whole
company's safety record must still be able to report what happened to them.
Presets: Crew and Estimator get `report_own` (they're the ones on site);
Dispatcher and Manager get `view_edit_all` (a team lead needs to escalate and
close things out). Owner/admin bypass the grid entirely, as everywhere else.

**"Own" means "reported by you"**, not "incidents you were involved in." A
worker who wants to see an incident a supervisor filed about them has to ask
that supervisor. Resolving that properly would mean matching `full.userId` to
a `Worker` row on every request (`Member` and `Worker` are separate tables,
both pointing at the same `User`), and I judged the simpler rule — the one
that matches what the person filing actually controls — worth shipping now
rather than not shipping the feature. Named here as a real gap, not silently
assumed away.

**The reporter cannot edit their own report afterwards.** `PATCH
/api/safety-incidents/[id]` requires `view_edit_all`. This is a legal
record — potentially the one a WCB/CNESST claim or an insurer asks for
later — and letting the person who filed it quietly rewrite it, even to fix a
typo, undermines the one thing that makes the record worth keeping: that it
says what was reported, when. A correction goes through someone with
`view_edit_all`, the same way a supervisor countersigns a correction on a
paper form rather than the original filer erasing it.

### On a phone, in the moment

The report form (`app/app/safety/page.js`) is short: kind, when, what
happened, where, an optional job link, a work-stopped checkbox, an optional
reporting note. Six fields, one of which (description) is required. Photos
are a **second step**, offered only after the report is filed — "filed" comes
first, "photo of the scene" is optional and doesn't block it.

Photos reuse `JobPhoto` rather than a second photo table. Same signed
Cloudinary path (`/api/upload`), and — the reason that actually
matters — the same `stage: "issue"` that already never reaches the public
gallery, the marketing AI's image context, the website builder's image
picker, or any client-facing PDF (`lib/gallery/stages.js` and every consumer
listed in its header comment). `stage` is hardcoded server-side in
`POST /api/safety-incidents/[id]/photos` — never accepted from the
request — so this can't be pointed anywhere else by a crafted call.

### Never deleted

There is no `DELETE` route for `SafetyIncident`, anywhere. `status` moves a
record open → reviewed → closed; nothing removes the row. Same posture the
codebase already keeps for workers (`lib/team/workerArchive.js`) — a company
can put something away, never make it disappear.

### The KPI, and its honest limits

`lib/analytics/safety.js` — **incidents per 1,000 approved labour
hours**, for the period.

**Why hours, not jobs.** Jobs vary too much in size to be a fair
denominator — a one-day tune-up and a three-week kitchen gut are both "one
job" but expose a crew to a hazard for very different lengths of time.
Approved `TimeEntry` hours are the same exposure measure
`lib/costing/utilisation.js` already trusts elsewhere, company-wide for the
period (not scoped to completed jobs — someone can be hurt on a job that
never finishes).

**This is explicitly NOT an OSHA, CNESST or WSIB rate.** The standard US
formula (incidents × 200,000 ÷ hours) isn't used, and no Canadian provincial
formula is claimed either — those bodies compute and report this differently
and I have not verified either one. The KPI card is titled and documented as
an internal, directional number for one company to watch trend on, never a
figure to hand to a regulator or an insurer as their official rate.

**Floored on hours, not on incident count.** Every other rate in
`lib/analytics/kpis.js` (win rate, on-time completion) floors on how many
things were *decided* — ten quotes, ten completions — because those are
common events and a handful is genuinely too small a sample. An incident is
supposed to be *rare*: requiring ten of them before printing a rate would
mean a well-run company never sees this card at all, while a company having a
genuinely bad month deserves to see that immediately. So the floor
(`MIN_HOURS_FOR_RATE = 500`, roughly three months of one full-time worker, or
three weeks of a five-person crew) is on the **denominator** instead.

**Weaknesses, stated plainly:**

- **Self-reported.** The rate is only as good as what gets filed. A crew that
  under-reports near-misses shows a *better* rate — the same optimistic bias
  `actualJobCost`'s `incomplete` flag exists to catch on the cost side, and
  there is no equivalent safeguard here, because there's no independent
  source to check self-reporting against.
- **Severity-blind.** One injury and one broken fingernail both count as one
  incident. A rate is not a substitute for reading the incidents themselves.
- **Small-company volatility.** Even at the 500-hour floor, a two-person crew
  can swing the rate hard with one incident. The floor makes the number
  *computable*, not necessarily *stable* for a very small company — it's
  still one more data point than none.
- **Not comparable across companies or to any published benchmark.** It's
  this company's own trend line, nothing else.

### What was not built

- **No "involved worker" picker in the form.** The API accepts
  `involvedWorkerId`; the UI doesn't offer it yet, to keep the report form
  fast for someone standing on site. Schema and API are ready for this to be
  added without a migration.
- **No escalation/notification** (an email or SMS to a supervisor the moment
  an injury is filed). Everything here is pull (visit the page), not push.
- **No cross-company benchmark or industry comparison.**
- **No "own = involved in" scoping**, as covered above.

---

## Part Two — Equipment, depreciation, and job costing

### The trap, found before writing anything

Before adding any per-job equipment cost, I read
`lib/analytics/minimumPrice.js`, `lib/analytics/burnRate.js`, and
`lib/accounting/depreciation.js` (per the task's own instruction). Here is
what they already do, with the call chain:

```
lib/accounting/depreciation.js  assetOverhead({ assets, debts })
    → sums monthlyDepreciation for EVERY asset the company owns
lib/analytics/burnRate.js       calculateBurnRate()
    → totalMonthlyCost = overhead + salaries + capital.monthlyCost
      (capital.monthlyCost INCLUDES that whole-company depreciation sum)
lib/analytics/minimumPrice.js   calculateMinimumPrice()
    → costPerJob = totalMonthlyCost / jobsPerMonth   (an EVEN split)
app/api/jobs/[id]/costing/route.js
    → overheadPerJob = costPerJob   (fed into every job's actualJobCost)
```

**Finding, stated plainly: yes, overhead already absorbs depreciation.**
Whenever a company has filled in Settings → Overhead (set a
`jobsPerWeekCapacity`), `overheadPerJob` on *every* job already contains an
even share of *every* asset's monthly depreciation — the $9,000 spray rig's
$150/month is already being divided across the whole month's worth of jobs,
whether or not a given job used it.

This means the owner's literal ask — "log which asset was on which job, and
let that cost land on the job" — would **double-count** for any company that
has the overhead screen filled in: once through the even overhead share (paid
by every job regardless of use), and again through a new per-job,
per-asset charge for the job that actually logged it.

### The rule this codebase already has for exactly this shape of problem

`lib/accounting/depreciation.js` already solved an analogous double-count —
the truck loan vs. the truck's own depreciation — with one rule: *a debt with
a linked asset contributes interest only; the asset's depreciation is already
carrying the capital cost.* The equipment-use case needed the same kind of
rule, so I built one instead of building a second, disagreeing accounting
policy:

**`lib/costing/actualJobCost.js`: equipment is *reported* on every job that
has any, but only *added to the job's total* when `overheadPerJob` is
`null`** — i.e. when nothing else in the calculation is already carrying
depreciation, because the company has never set a jobs-per-week capacity.

```js
const equipmentAddedToTotal = overhead === null ? equipmentTotal : 0;
```

- **Overhead known (the common case once a company sets up Settings →
  Overhead):** the job's `equipment` section shows the logged asset(s), the
  dollar figure `equipmentCostForJob` computed, and
  `includedInOverhead: true` — informational only, never added to `total`.
  The job cost panel says so in words: *"Equipment logged on this job
  ($X) is already covered by the overhead share above — it isn't added
  again."*
- **Overhead unknown (no capacity set — a common state for a newer or
  smaller company):** nothing else in the calculation captures depreciation
  at all today, so this is strictly an improvement over the status quo
  (zero). `equipmentAddedToTotal` becomes real cost, `includedInOverhead:
  false`, and the panel says: *"Equipment logged on this job added $X to
  the total — set up Settings → Overhead and this stops being counted
  twice."* — an honest nudge rather than a silent state.

The regression this had to not create: **a job with nothing logged against
it must cost exactly what it cost before this feature existed.** Asserted
directly in `scripts/check-job-costing.mjs` (`equipment` omitted vs.
explicitly `null` produce identical totals to a build with no `equipment`
concept at all), and mutation-tested — reintroducing the double count (always
adding `equipmentTotal` regardless of overhead) is caught by the test suite,
and removing the "no equipment logged → section is `null`, not an object with
a zero" guard crashes the function outright rather than silently passing.

### Worked numbers (from `scripts/check-job-costing.mjs` and
`scripts/check-depreciation.mjs`, executed, not hand-computed)

A spray rig: $9,000, no salvage, 60-month life, bought two years before the
pinned test clock (2026-08-28). `monthlyDepreciation = 9000 / 60 = $150/mo`.
Spread across an average month (`365.25 / 12 = 30.4375` days, the same
averaging payroll/accounting systems use rather than a flat 30):
**`dailyRate ≈ $4.928.../day`**, rounded for display to **$4.93**.

| Scenario | Input | `equipmentCostForJob` output |
|---|---|---|
| One full day logged (no hours given) | 1 row, `hours: null` | `total: 4.93` |
| Two logged days: one full, one half (4 of 8 hrs) | 2 rows | `total: 7.39` (`4.93 + 2.46`) |
| Hours above a standard 8-hour day | `hours: 11` | `total: 4.93` — capped at one day, **not** 1.375× |
| Zero `usefulLifeMonths` | — | `$0/day`, `reason: "incomplete"` |
| Asset already past its life (12-month life, bought 10 years ago) | — | `$0/day`, `reason: "fully_depreciated"` |
| Disposed a month before "now" | — | `$0/day`, `reason: "disposed"` |
| `inServiceDate` in the future | — | `$0/day`, `reason: "not_in_service"` |
| Same asset logged on two different jobs, same day | 2 independent calls | **Both** charged $4.93 in full — see below |

**`actualJobCost()` wiring**, same rig, $100 materials + $200 approved
labour as the base:

| Overhead | Equipment logged | `total` | `equipment.includedInOverhead` | `equipment.addedToTotal` |
|---|---|---|---|---|
| none passed at all | none | **$300** (unchanged from before this feature existed) | — | — |
| $200 (known) | none | **$500** | — | — |
| $200 (known) | $4.93 (spray rig, one day) | **$500** — equipment NOT folded in | `true` | `false` |
| unknown (`null`) | $4.93 | **$304.93** — equipment genuinely added | `false` | `true` |

### The honesty gap I found and named rather than "fixed"

**Nothing stops the same physical asset being logged on two different jobs
the same day.** `equipmentCostForJob` only ever sees one job's rows — it has
no way to know a company's only spray rig was also logged on a second roof
that day. Detecting that would need a company-wide query this per-job
function deliberately doesn't make (and even then, "logged twice" doesn't
prove which job is wrong — a genuine same-day rental swap is legitimate).
Executed and asserted in both check scripts: two independent calls for the
same asset, same day, on different jobs, both return the full $4.93. This is
recorded as a known limitation, not silently handled and not silently
ignored.

### "Type of tool and its life expectancy" — a suggestion, never applied

`Asset.category` (nullable string) plus `lib/costing/assetLifeSuggestions.js`
— ten categories (vehicle, trailer, power tool, hand tool, ladder/scaffold,
spray equipment, compressor/generator, measuring/electronic tool, safety
equipment, other), each with a rough, commonly-cited planning life in months.

**These numbers are explicitly not authoritative.** They are not taken from a
CRA capital cost allowance class, a manufacturer's spec sheet, or any
verified source — the file's own header says so, and the UI repeats it:
*"Typical range for this category — a starting point, not a rule. Confirm or
change it before saving."* Per `AGENTS.md` failure class 5, a suggestion that
gets written to the database without the person confirming it is exactly as
invented as a hard-coded default with extra steps. So:

- Picking a category in the add-asset form pre-fills `usefulLifeMonths`
  **only when that field is still blank**.
- Picking a *different* category after already typing a life **never
  overwrites it**.
- `POST /api/assets` never reads `Asset.category` to backfill a life on its
  own — the life a company saves is always the number that was actually in
  the form field when they submitted, exactly as before this feature existed.

### Equipment utilisation — built as data and API, not yet as a UI screen

`AssetUseLog` (companyId, assetId, jobId?, `usedOn`, optional `hours`,
`loggedByMemberId`, note) is the per-use log the owner asked for. Logging is
deliberately cheap: a multi-select-shaped picker on the job page
(`EquipmentUseLog.js`, next to `JobMaterials` — the same "tick it off" shape),
gated exactly like filing a job photo (`jobs: view_only`, scoped to a Crew
member's own assigned jobs) rather than the stricter asset-register gate —
logging that a compressor came along is not the same act as editing what the
compressor is worth.

`GET /api/assets/utilisation` rolls this up company-wide: which assets have
been logged how many days, on how many distinct jobs, when last used, and —
the useful case — which assets have **never been logged at all**. Gated like
the asset register itself (`jobCosting` + `user:manage`).

**What's built:** the model, both API routes, the per-job logging UI. **What
is not built:** a dedicated screen rendering the utilisation report. It has
an API and no page yet — a deliberate scope cut given everything else in this
session, not a decorative endpoint. `lib/analytics/kpis.js`'s
`equipmentUtilisation` entry stays in `NOT_TRACKED`, with its reason updated
to say exactly this (the old reason — "no per-use log exists" — stopped being
true and would itself have become the kind of stale claim AGENTS.md calls
out) rather than silently removed, because forcing utilisation into a
*per-period rate* the way the rest of the KPI page works would invent a claim
about how many days an asset *should* have been in use — nothing in the
product states that.

### What was not built (equipment, summary)

- The utilisation report's own screen (API exists, UI doesn't).
- Any adjustment to `usefulLifeMonths` based on ACTUAL measured wear (this
  stays a straight-line, calendar-based figure exactly as
  `lib/accounting/depreciation.js` already argues for — a trades business
  wants one number it can defend, not units-of-production accounting).
- Detection of an asset logged on two jobs at once (named above as a gap,
  not fixed).
- Any change to `lib/analytics/minimumPrice.js`/`burnRate.js` itself — the
  even-split overhead share is untouched. Making that allocation
  usage-weighted instead of even-per-job would be a much larger, riskier
  change touching every quote and every existing company's price floor, and
  was out of scope for this session.

---

## Verification

- `npx prisma validate` — passes. No `db push` run, per instruction; every
  change is additive and nullable (`SafetyIncident`, `AssetUseLog`,
  `Asset.category`, `JobPhoto.safetyIncidentId`).
- `scripts/check-depreciation.mjs` — 175/175 assertions, including the new
  equipment-allocation section (hostile assets: zero life, past life,
  disposed, not-in-service; the day-cap; the same-asset-two-jobs gap).
  Mutation-tested by hand (removed the one-day cap, forced `chargeable: true`
  unconditionally) — both caught, both reverted.
- `scripts/check-job-costing.mjs` — the double-count guard, executed against
  real numbers, plus the "nothing logged → total unchanged" regression.
  Mutation-tested (reintroduced the double count; broke the
  `equipment == null` guard) — the first is caught by an assertion, the
  second by an outright crash; both reverted.
- `scripts/check-kpis.mjs` — 187/187, `NOT_TRACKED` count updated (6 → 5),
  the new `not_enough_hours` reason follows the same "no hardcoded digit"
  rule every other reason string does.
- `scripts/check-tenant-scope.mjs` — 121/121. `assetId` and
  `involvedWorkerId` added to `lib/tenant/ownedIds.js` as their own proven
  foreign keys.
- `scripts/check-cost-basis.mjs`, `check-access-editor.mjs`,
  `check-access-labels.mjs`, `check-crew-access.mjs`,
  `check-role-vocabulary.mjs`, `check-nav-audit.mjs`, `check-sidebar.mjs`,
  `check-t-shadow.mjs`, `check-imports.mjs`, `check-exports.mjs` — all pass,
  no regressions.
- `scripts/check-translations.mjs` — "All gated languages complete" (every
  new `app.*` key defined in both English and French).
- `npm run check:all` — every check in the chain ran to completion
  (`&&`-chained; the final entry, `check:leads-drag`, completed with
  "95 checks, 0 failure(s)"), exit code 0.
- `npm run build` — `✓ Compiled successfully`, `/app/safety` present in the
  route output, exit code 0.
