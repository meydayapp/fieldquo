# FieldQuo — volume scenarios, 1 to 7 signups a day

What each level of production actually means: the daily activity behind it, the
earnings ramp it produces, the prospect throughput it demands, and what breaks
first when you run at it.

**Why this is its own file rather than another section of `SOP.md`.** The SOP
tells a rep what to do with the controls that exist, screen by screen. This
answers a different question — "what does 4 a day mean for me and for the
pipeline behind me" — and it is read by a rep *and* by whoever manages them, at
planning time rather than mid-call. Bolting it onto a 400-line procedure would
bury both. `SOP.md §6` links here.

**Every earnings figure below is output from executing `lib/sales/commission.js`
and `lib/sales/payouts.js`**, against the schema-default plan. Nothing was
computed by hand. The script is reproduced in full in Appendix A and its raw
output in Appendix B. Where a number could not be grounded in code it is an
**assumption**, is labelled one, and is listed in §6.

---

## 0. Two preconditions. Neither is optional.

**A rep with no commission plan earns nothing at all, silently.** Every table
here is void for that rep. `earnMilestone()` returns `null` when
`SalesRep.commissionPlan` is missing — it does not guess an amount — so no
ledger row is ever written and the rep's companies are invisible to the
ledger-sourced funnel on `/platform/sales/performance`. There is no error and
no screen a rep can reach that would show them the gap. *Confirm the plan is
assigned before quoting any of these numbers to anybody.*

**The calling window is enforced nowhere.** `withinSalesCallingHours()` in
`lib/sales/callingWindow.js` has no production caller — only
`scripts/check-sales-suppression.mjs` imports it — and the `tel:` link on the
queue has no gate in front of it. Every activity figure below is stated as a
count per working day and deliberately **not** as a dialling rate, because a
rate implies a pace and a pace at these volumes is how a rep ends up dialling
outside the legal window:

    Weekdays  09:00 – 21:30    in the PROSPECT's own time zone
    Weekends  10:00 – 18:00

That is 12.5 legal hours on a weekday and 8 on a weekend — 62.5 hours across a
five-weekday week, per time zone. It is a legal *envelope*, not a shift. CASL,
the CRTC's Unsolicited Telecommunications Rules and the TCPA all bite here, and
the TCPA has no B2B exemption for prerecorded or autodialled calls to mobiles —
which small contractors answer on. **Check the prospect's clock yourself, every
time.** No scenario in this document authorises a single call outside it, and
if a target cannot be hit inside it, the target is wrong.

---

## 1. Why a signup today is not $125 today

The three milestones do not fire together, and two of them are not waiting on
the rep at all.

| Milestone | Amount | Gate | What it waits for |
|---|---:|---|---|
| Activated | **$20** | `qualifiesForActivation()` — `stripeChargesEnabled` alone | The contractor finishing Stripe Connect onboarding |
| Renewed | **$40** | `qualifiesForBillingCycle()` — `billing_reason === "subscription_cycle"`, free or paid | The free first month ending (`TRIAL_PRICE = 0`) and the cycle turning |
| Still paying | **$65** | `qualifiesForRetention()` — 60 days from **subscription start, trial included** | 60 days, then the next nightly sweep |

**$65 of the $125 — 52% — arrives last and is the piece that can be taken
back.** A refund, a lost chargeback or a `past_due` card denies it; an open
dispute *holds* it rather than denying it, and the sweep asks again tomorrow.

### Which nightly sweep actually pays retention — derived, not assumed

`qualifiesForRetention()` compares elapsed milliseconds against
`retentionDays × 24h` exactly, and `/api/cron/sales-retention` runs at **09:20
UTC** (`vercel.json`). So whether the milestone lands on day 60 or day 61
depends on the UTC hour the subscription started — which nobody controls and
nobody should try to. Executed:

    subscription starts 06:00 UTC  ->  pays on the day-60 sweep   (day-59 sweep: too_early)
    subscription starts 09:00 UTC  ->  pays on the day-60 sweep   (day-59 sweep: too_early)
    subscription starts 15:00 UTC  ->  pays on the day-61 sweep   (day-60 sweep: too_early)
    subscription starts 23:00 UTC  ->  pays on the day-61 sweep   (day-60 sweep: too_early)

A contractor who signs up in the afternoon Eastern is paid a day later than one
who signs up before breakfast. It is a day, it is not a bug, and it is worth
knowing before somebody reports one.

### Then the money waits for a Monday

`/api/cron/sales-payouts` runs **Mondays 10:07 UTC** and closes the *previous*
Monday-to-Monday UTC week, half-open `[start, end)`. So a milestone occurring on
a Tuesday is not in a batch until the Monday **six days later**, and the batch
closes to `ready` — **a person pays it.** Nothing moves money to a rep
automatically.

**Consequence, computed rather than asserted:** at every rate from 1 to 7 a day,
the first payout containing an activation closes at the end of **week 1**, the
first containing a first payment at the end of **week 5**, and the first
containing a retention at the end of **week 9**.

---

## 2. The seven scenarios

Read each one as: *this is what the week looks like, this is what lands in the
bank and when, this is what the pipeline behind you has to produce, and this is
the thing that gives way first.*

Two notes that apply to all seven:

- **Weekly figures oscillate; the four-week block does not.** The funnel used
  here is a 10-signup cycle (7 activate, 5 pay, 4 retain), and a 25-signup week
  does not divide into it. Consecutive weekly batches therefore alternate
  between two legitimate figures for ever. **The four-week block is the number
  to plan on**; a single week that reads high or low is the cycle, not a trend.
- **Steady state is exactly `signups/weekday × $300/week`** under the assumed
  funnel — $60 expected per signup × 5 selling days. The ceiling, if every
  single signup completed all three stages, is `× $625/week`. The gap between
  those two numbers is the entire argument for qualifying hard.

---

### 1 signup a weekday — 5/week, 20 per 4 weeks

**Daily activity.** One conversation that ends in a signup, out of the prospects
you work that day. At an assumed 1% conversion that is 100 worked prospects a
day; at 5%, 20. The queue hands you one prospect at a time (`Claim the next
one`) and a claim lapses after 48 hours unworked.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $60.00 | — | — | **$60.00** |
| Week 4 | $80.00 | — | — | **$80.00** |
| Week 8 | $80.00 | $40.00 | — | **$120.00** |
| Week 12 | $80.00 | $40.00 | $130.00 | **$250.00** |

Four-week blocks: **$280 · $680 · $1,200 · $1,200 · $1,200.**
Steady state from the block starting week 9: **$300/week, $15,600/year.**
First 12 weeks: **$2,160** — 60% of twelve steady weeks.

**Prospect throughput required.** ~100/day at 1%, 20/day at 5%. Comfortably
inside the pipeline's ~514/day ceiling (§3) with room for four more reps.

**What breaks first: the rep cannot see any of this.** `/api/sales/me` computes
the signup counts and the link, and **nothing in the rep portal renders them**.
At one a day, a rep has no way to tell a good week from a bad one, and the
$60-week-1 / $250-week-12 shape reads as failure without the ramp explained.
This is a management problem long before it is a capacity problem.

---

### 2 signups a weekday — 10/week, 40 per 4 weeks

**Daily activity.** ~200 worked prospects/day at 1%, 40 at 5%.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $120.00 | — | — | **$120.00** |
| Week 4 | $140.00 | — | — | **$140.00** |
| Week 8 | $140.00 | $200.00 | — | **$340.00** |
| Week 12 | $140.00 | $200.00 | $260.00 | **$600.00** |

Four-week blocks: **$540 · $1,360 · $2,400 · $2,400 · $2,400.**
Steady state from the block starting week 9: **$600/week, $31,200/year.**
First 12 weeks: **$4,300** — 60% of twelve steady weeks.

**Prospect throughput required.** ~200/day at 1%. Still inside the ceiling.

**What breaks first: the queue stops being a queue.** Marking a prospect
`worked` sets `claimExpiresAt: null`, which is exactly what `queueWhere`
matches — so **worked prospects never leave your queue**. At two a day the
worked pile is tens of rows within a fortnight and hundreds within a quarter,
and there is no way to browse or filter it. The route's own comment says a
worked prospect "leaves the rep's active queue". It does not.

---

### 3 signups a weekday — 15/week, 60 per 4 weeks

**Daily activity.** ~300 worked prospects/day at 1%, 60 at 5%.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $140.00 | — | — | **$140.00** |
| Week 4 | $220.00 | — | — | **$220.00** |
| Week 8 | $220.00 | $320.00 | — | **$540.00** |
| Week 12 | $220.00 | $320.00 | $325.00 | **$865.00** |

Four-week blocks: **$780 · $2,040 · $3,405 · $3,600 · $3,600.**
Steady state from the block starting week 13: **$900/week, $46,800/year.**
First 12 weeks: **$6,225** — 58% of twelve steady weeks.

**Prospect throughput required.** ~300/day at 1%. Inside the ceiling for one
rep; **a second rep at this rate exceeds it**, because the 3,600 tasks/day is
shared across the whole platform, not allocated per rep.

**What breaks first: the retyping.** There is **no control that turns a claimed
prospect into a lead.** `SalesLead.prospectId` exists in the schema and no route
ever writes it. Every prospect you want to email or text has to be retyped by
hand into `/sales/leads` — including a time zone, which is stated by the rep and
**never inferred from an area code**, and without which no text can be sent at
all. At three signups a day this manual bridge is the largest single consumer of
a rep's time, and it scales linearly with prospects worked, not with signups.

---

### 4 signups a weekday — 20/week, 80 per 4 weeks

**Daily activity.** ~400 worked prospects/day at 1%, 80 at 5%.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $180.00 | — | — | **$180.00** |
| Week 4 | $280.00 | — | — | **$280.00** |
| Week 8 | $280.00 | $400.00 | — | **$680.00** |
| Week 12 | $280.00 | $400.00 | $520.00 | **$1,200.00** |

Four-week blocks: **$1,020 · $2,720 · $4,540 · $4,800 · $4,800.**
Steady state from the block starting week 13: **$1,200/week, $62,400/year.**
First 12 weeks: **$8,280** — 58% of twelve steady weeks.

**Prospect throughput required.** ~400/day at 1% — **78% of the entire
platform's daily enrichment ceiling, for one rep.**

**What breaks first: the shared sales number and the shared suppression list.**
There is **one `sales`-purpose number for the whole team**, not one per rep. A
single STOP arriving on it **stops every rep at once**, permanently — `START`
does not reverse it on the sales side, and only a superadmin can lift it with a
written reason. Suppression also widens on lookup: an entry against one domain
suppresses **every mailbox at that company**, and an unqualified "stop" closes
email, phone *and* SMS together. At four a day the volume of touches makes at
least one STOP a week near-certain, and each one is a permanent, team-wide loss.

---

### 5 signups a weekday — 25/week, 100 per 4 weeks

**Daily activity.** ~500 worked prospects/day at 1%, 100 at 5%.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $240.00 | — | — | **$240.00** |
| Week 4 | $320.00 | — | — | **$320.00** |
| Week 8 | $320.00 | $600.00 | — | **$920.00** |
| Week 12 | $320.00 | $600.00 | $780.00 | **$1,700.00** |

Four-week blocks: **$1,260 · $3,400 · $5,740 · $6,000 · $6,000.**
Steady state from the block starting week 13: **$1,500/week, $78,000/year.**
First 12 weeks: **$10,400** — 58% of twelve steady weeks.

> Week 12 reads **$1,700** against a steady weekly average of **$1,500**. That
> is the 10-signup funnel cycle against a 25-signup week, not a good week. Use
> the four-week block.

**Prospect throughput required.** ~500/day at 1% — essentially **the entire
platform ceiling of ~514/day, consumed by one rep.**

**What breaks first: nobody can feed the pipeline fast enough by hand.** A
campaign **cannot discover anything until somebody has produced its Overture
snapshot offline** — `npm run overture:snapshot` runs the DuckDB CLI on a
workstation, and the handler refuses with that sentence rather than reporting an
empty result. There is also **no screen to rename or re-draw a territory**. At
five a day a rep burns through a city's callable records in weeks — Ottawa has
**2,802 callable records across all trades**, and 70 painting contractors in the
whole city — so somebody must be producing new snapshots and new territories
continuously, by hand, offline. That human is the bottleneck before the servers
are.

---

### 6 signups a weekday — 30/week, 120 per 4 weeks

**Daily activity.** ~600 worked prospects/day at 1%, 120 at 5%.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $280.00 | — | — | **$280.00** |
| Week 4 | $420.00 | — | — | **$420.00** |
| Week 8 | $420.00 | $600.00 | — | **$1,020.00** |
| Week 12 | $420.00 | $600.00 | $780.00 | **$1,800.00** |

Four-week blocks: **$1,540 · $4,040 · $6,810 · $7,200 · $7,200.**
Steady state from the block starting week 13: **$1,800/week, $93,600/year.**
First 12 weeks: **$12,390** — 57% of twelve steady weeks.

**Prospect throughput required.** ~600/day at 1% — **above the ceiling.**

**What breaks first: the enrichment pipeline, arithmetically.** 600 > 514. See
§3 for the full working. Six a day is reachable only if the real conversion rate
is materially better than 1%, or if `BATCH` is raised — and `BATCH = 25` was
chosen deliberately against an unknown function timeout, because **no
`maxDuration` is exported anywhere in this repo**. Raising it is a real decision
with evidence behind it, not a config tweak.

---

### 7 signups a weekday — 35/week, 140 per 4 weeks

**Daily activity.** ~700 worked prospects/day at 1%, 140 at 5%.

**The ramp.**

| Payout closing | Activation | First payment | Retention | **Paid** |
|---|---:|---:|---:|---:|
| Week 1 | $300.00 | — | — | **$300.00** |
| Week 4 | $520.00 | — | — | **$520.00** |
| Week 8 | $520.00 | $720.00 | — | **$1,240.00** |
| Week 12 | $520.00 | $720.00 | $780.00 | **$2,020.00** |

Four-week blocks: **$1,800 · $4,680 · $7,880 · $8,400 · $8,400.**
Steady state from the block starting week 13: **$2,100/week, $109,200/year.**
First 12 weeks: **$14,360** — 57% of twelve steady weeks.

**Prospect throughput required.** ~700/day at 1% — **36% above the ceiling.**

**What breaks first: this tier is not supportable at a 1% conversion rate, and
the arithmetic is in §3.** It is presented here because it was asked for, not
because the current build can feed it. If it is attempted anyway, the thing that
actually gives way is not a server — it is the **unenforced calling window**. A
rep told to produce seven a day, with no dialler, no queue-to-lead bridge, no
visible scoreboard and a hand-retyped time zone standing between them and every
text, will make up the shortfall in the evening. The product will let them. That
is the single largest compliance exposure in this document, and pushing a
number the pipeline cannot feed is what converts it from a latent risk into an
incident.

---

## 3. The upstream constraint, in full

### The reachable bank is not the problem

**775,628** field-service businesses with a findable location — **79,736 Canada
+ 695,892 USA**, 99% with a phone. (Measured; corrected upward 48% from an
earlier wrong 522,123 that had four non-existent Overture category keys silently
matching zero rows. `docs/sales-intel/STATUS.md`.)

Even at 7 a weekday and an assumed 1% conversion — 700 worked prospects a day,
182,000 a year — the bank lasts **4 years for one rep**. Ingestion is not the
constraint at any tier in this document.

### Enrichment is the problem, and here is the arithmetic

Every figure is read out of code, not out of a plan:

| Input | Value | Source |
|---|---:|---|
| Pipeline ticks per day | 144 | `vercel.json`, `"3-59/10 * * * *"` = 6/hour × 24 |
| Tasks claimed per tick | 25 | `BATCH` in `app/api/cron/sales-pipeline/route.js` |
| **Task ceiling** | **3,600/day** | 144 × 25 |
| `openai` lane | 10/run → 1,440/day | `PROVIDER_LIMITS` in `lib/sales/pipeline/limits.js` |
| `http_crawl` lane | 20/run → 2,880/day | same |
| `discovery` lane | 10/run → 1,440/day | same |
| Stages per prospect **with** a website | **7** | `NEXT_STAGE` in `chain.js` |
| Stages per prospect **without** one | **4** | `routeAfterEnrich()` in `handlers/enrichBusiness.js` |
| Website fill rate | 92.7% | measured, `STATUS.md` |

The seven stages for a prospect with a website are `ENRICH_BUSINESS` →
`CRAWL_WEBSITE` → `DETECT_TECHNOLOGY` → `ANALYZE_CAPABILITIES` →
`DETECT_OPPORTUNITIES` → `CALCULATE_LEAD_SCORE` → `GENERATE_RESEARCH_BRIEF`. One
without a website routes straight from enrichment to the opportunity analysis,
skipping three, for four tasks.

    blended: 0.927 × 7 + 0.073 × 4 = 6.78 tasks per fully-researched prospect
    3,600 / 6.78  =  530 prospects/day
    3,600 / 7     =  514 prospects/day   (worst case, every prospect has a site)

**Use 514.** It is the conservative end and the difference does not change any
conclusion.

> **A correction to `STATUS.md`, found by reading `kinds.js` rather than the
> summary.** That file still says *"the binding lane is OpenAI: three of the
> eight stages share one budget of 10 per run = 1,440/day against 3,000 tasks"*.
> That was true when it was written and is **no longer true of the code**:
> `ANALYZE_CAPABILITIES` and `DETECT_OPPORTUNITIES` were both re-mapped to
> `local` when they were actually built, because neither calls a model. Only
> `GENERATE_RESEARCH_BRIEF` draws on `openai` today — one task per prospect
> against 1,440/day, which supports 1,440 prospects/day, nearly three times the
> batch ceiling. **The binding lane is now `BATCH`, not OpenAI.** Whoever owns
> `docs/sales-intel/STATUS.md` should correct that paragraph; this document does
> not edit files outside `docs/sales/`.

### What each tier demands, against that ceiling

The conversion rate is an **assumption** — nothing in this repo measures a
prospect-to-signup rate, and `RATE_FLOOR = 10` means the platform console will
not even print a percentage below ten outcomes. Three rates are shown so the
sensitivity is visible rather than hidden inside one chosen number.

| Signups/weekday | @ 1% | @ 2% | @ 5% | Verdict against ~514/day |
|---:|---:|---:|---:|---|
| 1 | 100 | 50 | 20 | fits at every rate |
| 2 | 200 | 100 | 40 | fits at every rate |
| 3 | 300 | 150 | 60 | fits at every rate |
| 4 | 400 | 200 | 80 | fits, using 78% of the platform |
| 5 | 500 | 250 | 100 | fits at 1% with **14 prospects/day of headroom** |
| 6 | **600** | 300 | 120 | **exceeds the ceiling at 1%** |
| 7 | **700** | 350 | 140 | **exceeds the ceiling by 36% at 1%** |

**The honest answer on 6 and 7 a day.** They are not supportable by the current
enrichment budget at a 1% conversion rate: 600 and 700 fully-researched
prospects a day against a measured ceiling of ~514. They become supportable if
the real rate is 2% or better, or if `BATCH` is raised — but `BATCH = 25` exists
because no `maxDuration` is declared anywhere in this repo and nobody knows how
long one invocation may run. **Raising it is a decision with a measurement
attached, not a number to pick.**

**And this ceiling is the whole platform's, not each rep's.** 3,600 tasks a day
is shared across every rep and every campaign. Two reps at 3 a day, or one at 6,
hit the same wall. Any tier above roughly 5 a day is a **one-rep-only** figure
under the current build.

---

## 4. The comparison, on one page

| /weekday | /week | /4wk | First 12 weeks | Steady $/week | Steady $/year | Prospects/day @1% | Supportable? |
|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 5 | 20 | $2,160 | $300 | $15,600 | 100 | yes |
| 2 | 10 | 40 | $4,300 | $600 | $31,200 | 200 | yes |
| 3 | 15 | 60 | $6,225 | $900 | $46,800 | 300 | yes |
| 4 | 20 | 80 | $8,280 | $1,200 | $62,400 | 400 | yes, 78% of platform |
| 5 | 25 | 100 | $10,400 | $1,500 | $78,000 | 500 | at the ceiling |
| 6 | 30 | 120 | $12,390 | $1,800 | $93,600 | 600 | **no, at 1%** |
| 7 | 35 | 140 | $14,360 | $2,100 | $109,200 | 700 | **no, at 1%** |

**The first twelve weeks pay 57–60% of twelve steady weeks, at every rate.** Not
because anything is wrong — because $40 of every $125 is 31 days out and $65 is
60 days out, and the first two payout batches of a rep's career contain
activations only. A rep judged on their first month is being judged on 16% of
what that month will eventually pay.

**Ceiling, if every signup completed all three stages:** multiply the steady
weekly figure by `625/300` — $625/week per signup/weekday instead of $300. Ten
signups that all complete are $1,250; ten realistic ones are $600. That gap is
the argument for qualifying hard, and it is worth more than any extra dial.

---

## 5. What is *not* in these numbers

- **No salary, no cost per acquisition.** Nothing in the product holds what a
  rep costs — a commission plan is per-sale, not employment — so the dashboard
  prints `NOT_TRACKED` with the missing input named rather than a zero. These
  are gross commission figures and nothing else.
- **No reversals.** A refund or a lost chargeback writes a **new negative row**
  and the batch is re-summed at payment time from its own rows, never from
  `totalCentsAtClose`. A week whose reversals outweigh its earnings nets
  negative and the batch is still created, because the debt carries.
- **Annual subscribers.** They qualify for retention at day 60 having made no
  second payment — the condition is "still a paying customer". Their refund
  exposure is twelve times larger. That is a commercial risk to price, and it is
  not modelled here.
- **No automatic payment.** Every batch closes to `ready` and a human marks it
  `paid`. A tier that assumes weekly cash needs a human on a Monday.

---

## 6. Assumptions, named

The owner's standing instruction is that assumptions must never be presented as
findings. These are the assumptions. Every other number in this document came
out of executing code.

| # | Assumption | Value used | Why, and what would change it |
|---|---|---|---|
| 1 | Selling days per week | 5 (Mon–Fri) | "Per day" is read as per *selling* day. A 7-day week multiplies steady state by 1.4. |
| 2 | Activation lag | +4 days | Stripe Connect onboarding time; nothing in the repo measures it. Matches Example A in `ONBOARDING-AND-COMP.md`. Only shifts week 1, not steady state. |
| 3 | First-payment lag | +31 days | The free first month ending. `TRIAL_PRICE = 0` is code; 31 days is the calendar reading of "first month". |
| 4 | Funnel shape | 7 activate / 5 pay / 4 retain per 10 | Inherited from Example E in `ONBOARDING-AND-COMP.md`, which is itself illustrative. **This is the single most load-bearing assumption in the document** — steady state is linear in it. |
| 5 | Conversion rate | 1% / 2% / 5%, shown side by side | **Nothing in this repo measures it.** No rate was chosen; the sensitivity is shown instead. |
| 6 | Signup instant | 15:00 UTC | Chosen to expose the day-60 vs day-61 sweep boundary. Shifts retention by one day, nothing else. |
| 7 | Tasks per prospect | 7 with a website / 4 without | *Not* an assumption — read from `chain.js` and `enrichBusiness.js`. The 92.7% website fill blending them is measured. |

Assumption 4 is the one to attack first with real data. Once thirty companies
have passed day 60, the actual funnel is computable from `SalesCommissionEntry`
directly, and these tables should be regenerated rather than argued with.

---

## Appendix A — the script

Written to the repo root as `check-volume-scenarios.mjs`, executed, and then
deleted (AGENTS.md: throwaway checks go in the repo root and get deleted). It is
reproduced here in full so that regenerating these tables means pasting it back
and running it, not rewriting it. `@/` does not resolve under bare Node, hence
the loader:

    node --import ./scripts/alias-loader.mjs check-volume-scenarios.mjs

Every amount comes from `amountForMilestone()`; every milestone is gated by the
real predicate rather than by an `if` written in the script; the retention sweep
day is *found* by walking the 09:20 UTC sweep forward until
`qualifiesForRetention()` returns `qualifies: true`; every payout window comes
from `previousWeekBounds()` and every batch total from `batchTotalCents()`. That
is what makes the output below evidence rather than arithmetic.

```js
// Throwaway. Computes the volume-scenario tables in docs/sales/VOLUME-SCENARIOS.md
// by EXECUTING lib/sales/commission.js and lib/sales/payouts.js — no hand maths.
//
//   node --import ./scripts/alias-loader.mjs check-volume-scenarios.mjs
//
// Delete after the doc is written (AGENTS.md: throwaway checks go in the repo
// root and get deleted).
import {
  MILESTONES,
  amountForMilestone,
  qualifiesForActivation,
  qualifiesForBillingCycle,
  qualifiesForRetention,
  balanceCents,
} from "@/lib/sales/commission";
import {
  previousWeekBounds,
  entriesForWindow,
  batchTotalCents,
} from "@/lib/sales/payouts";

// ── Grounded inputs ────────────────────────────────────────────────────────
// prisma/schema.prisma, model SalesCommissionPlan — the @default values.
const PLAN = {
  activationCents: 2000,
  firstPaymentCents: 4000,
  retentionCents: 6500,
  retentionDays: 60,
};
// lib/pricing/ladder.js — the Solo tier, the one a one-van contractor buys.
const FIRST_INVOICE_CENTS = 9900;
// vercel.json — "20 9 * * *" and "7 10 * * 1".
const RETENTION_SWEEP_UTC_MINUTES = 9 * 60 + 20;
const PAYOUT_RUN_UTC_MINUTES = 10 * 60 + 7;

// ── Named assumptions. Nothing in the repo measures any of these. ──────────
const ASSUMPTIONS = {
  // A rep sells on weekdays. Signups land Mon–Fri only.
  signupsPerWeek: 5,
  // Stripe Connect onboarding finishing. Matches Example A in
  // docs/sales/ONBOARDING-AND-COMP.md.
  activationLagDays: 4,
  // The free first month ending (TRIAL_PRICE = 0 in lib/pricing.js).
  firstPaymentLagDays: 31,
  // The funnel shape from Example E: 10 signups -> 7 activate, 5 pay, 4 retain.
  funnelOutOfTen: { activate: 7, pay: 5, retain: 4 },
  // Signup instant of day, UTC. 15:00 is AFTER the 09:20 retention sweep, so
  // day 60's sweep is still short of 60 days and the milestone lands on day 61.
  signupHourUtc: 15,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const money = (c) => `$${(c / 100).toFixed(2)}`;
const iso = (d) => d.toISOString().slice(0, 10);

function utc(y, m, d, minutes = 0) {
  return new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
}
function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}
function atUtcMinutes(date, minutes) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      Math.floor(minutes / 60),
      minutes % 60,
    ),
  );
}

// Week 1 begins on a Monday so the payout windows line up with the calendar.
const START = utc(2026, 3, 2, ASSUMPTIONS.signupHourUtc * 60);
const HORIZON_WEEKS = 20;

/**
 * The ledger one rep's cohort produces at `perDay` signups per weekday.
 * Every amount comes from amountForMilestone(); every milestone is gated by
 * the real predicate, not by an `if` written here.
 */
function buildLedger(perDay) {
  const entries = [];
  const first = ASSUMPTIONS.funnelOutOfTen;
  let i = 0;

  for (let week = 0; week < HORIZON_WEEKS; week++) {
    for (let weekday = 0; weekday < ASSUMPTIONS.signupsPerWeek; weekday++) {
      for (let n = 0; n < perDay; n++) {
        const slot = i % 10;
        i++;
        const subscriptionStartedAt = addDays(START, week * 7 + weekday);

        // Milestone 1 — activation.
        if (slot >= first.activate) continue;
        const company = { stripeChargesEnabled: true };
        if (!qualifiesForActivation(company)) continue;
        entries.push({
          milestone: MILESTONES.ACTIVATION,
          amountCents: amountForMilestone(PLAN, MILESTONES.ACTIVATION),
          occurredAt: addDays(subscriptionStartedAt, ASSUMPTIONS.activationLagDays),
          payoutBatchId: null,
        });

        // Milestone 2 — the first billing cycle. Free or paid; the model
        // charges it, which is the common case.
        if (slot >= first.pay) continue;
        const invoice = {
          billing_reason: "subscription_cycle",
          amount_paid: FIRST_INVOICE_CENTS,
          subtotal: FIRST_INVOICE_CENTS,
        };
        if (!qualifiesForBillingCycle(invoice)) continue;
        const firstPaymentAt = addDays(
          subscriptionStartedAt,
          ASSUMPTIONS.firstPaymentLagDays,
        );
        entries.push({
          milestone: MILESTONES.FIRST_PAYMENT,
          amountCents: amountForMilestone(PLAN, MILESTONES.FIRST_PAYMENT),
          occurredAt: firstPaymentAt,
          payoutBatchId: null,
        });

        // Milestone 3 — retention. Walk the nightly 09:20 UTC sweep forward
        // until the real predicate says yes. The sweep day is DERIVED, not
        // assumed: qualifiesForRetention() decides it.
        if (slot >= first.retain) continue;
        const subscription = { status: "active", refundedAmountCents: 0 };
        let landed = null;
        for (let d = 55; d <= 70; d++) {
          const sweepAt = atUtcMinutes(
            addDays(subscriptionStartedAt, d),
            RETENTION_SWEEP_UTC_MINUTES,
          );
          const verdict = qualifiesForRetention({
            subscriptionStartedAt,
            subscription,
            retentionDays: PLAN.retentionDays,
            now: sweepAt,
          });
          if (verdict.qualifies) {
            landed = { sweepAt, dayIndex: d };
            break;
          }
        }
        if (!landed) throw new Error("retention never landed inside 70 days");
        entries.push({
          milestone: MILESTONES.RETENTION,
          amountCents: amountForMilestone(PLAN, MILESTONES.RETENTION),
          occurredAt: landed.sweepAt,
          retentionDayIndex: landed.dayIndex,
          payoutBatchId: null,
        });
      }
    }
  }
  return entries;
}

/** Every Monday payout run, closing the PREVIOUS week, via the real functions. */
function weeklyBatches(entries) {
  const rows = [];
  for (let w = 1; w <= HORIZON_WEEKS; w++) {
    // The Monday of week w+1 closes week w.
    const runAt = atUtcMinutes(addDays(START, w * 7), PAYOUT_RUN_UTC_MINUTES);
    const { start, end } = previousWeekBounds(runAt);
    const inWindow = entriesForWindow(entries, start, end);
    rows.push({
      week: w,
      runAt,
      start,
      end,
      count: inWindow.length,
      cents: batchTotalCents(inWindow),
      byMilestone: inWindow.reduce((acc, e) => {
        acc[e.milestone] = (acc[e.milestone] || 0) + e.amountCents;
        return acc;
      }, {}),
    });
  }
  return rows;
}

// ── Run ────────────────────────────────────────────────────────────────────
console.log("FieldQuo — volume scenarios, computed from lib/sales/*.js");
console.log("=".repeat(78));
console.log(`plan            activation ${money(PLAN.activationCents)}  first payment ${money(PLAN.firstPaymentCents)}  retention ${money(PLAN.retentionCents)}`);
console.log(`                total per acquisition ${money(PLAN.activationCents + PLAN.firstPaymentCents + PLAN.retentionCents)}  ·  retentionDays ${PLAN.retentionDays}`);
console.log(`week 1 Monday   ${iso(START)}  (signups at ${String(ASSUMPTIONS.signupHourUtc).padStart(2, "0")}:00 UTC)`);
console.log(`assumptions     ${ASSUMPTIONS.signupsPerWeek} selling days/week · activation +${ASSUMPTIONS.activationLagDays}d · first payment +${ASSUMPTIONS.firstPaymentLagDays}d`);
console.log(`                funnel ${ASSUMPTIONS.funnelOutOfTen.activate}/${ASSUMPTIONS.funnelOutOfTen.pay}/${ASSUMPTIONS.funnelOutOfTen.retain} out of every 10 signups`);
console.log("");

// -- 1. Which sweep the retention milestone actually lands on ---------------
console.log("── Which nightly sweep pays retention (derived, not assumed) ──");
for (const hour of [6, 9, 15, 23]) {
  const sub = utc(2026, 3, 2, hour * 60);
  let day = null;
  for (let d = 55; d <= 70; d++) {
    const sweepAt = atUtcMinutes(addDays(sub, d), RETENTION_SWEEP_UTC_MINUTES);
    const v = qualifiesForRetention({
      subscriptionStartedAt: sub,
      subscription: { status: "active", refundedAmountCents: 0 },
      retentionDays: 60,
      now: sweepAt,
    });
    if (v.qualifies) { day = d; break; }
  }
  const d59 = qualifiesForRetention({
    subscriptionStartedAt: sub,
    subscription: { status: "active", refundedAmountCents: 0 },
    retentionDays: 60,
    now: atUtcMinutes(addDays(sub, day - 1), RETENTION_SWEEP_UTC_MINUTES),
  });
  console.log(
    `  subscription starts ${String(hour).padStart(2, "0")}:00 UTC  ->  pays on the day-${day} sweep` +
      `   (day-${day - 1} sweep: ${d59.reason})`,
  );
}
console.log("");

// -- 2. Per-scenario ramp ---------------------------------------------------
const MARKS = [1, 2, 4, 6, 8, 10, 12, 16];
const summary = [];

for (let perDay = 1; perDay <= 7; perDay++) {
  const ledger = buildLedger(perDay);
  const batches = weeklyBatches(ledger);

  // Steady state is detected over FOUR-WEEK BLOCKS, not single weeks.
  //
  // The funnel is a 10-signup cycle (7 activate / 5 pay / 4 retain), and an odd
  // rate like 5 signups a week does not divide into it — so consecutive weekly
  // batches legitimately alternate between two figures for ever, and a
  // "first week that never changes again" test would report week 20 for every
  // odd rate. That is an artefact of the cycle, not a property of the pipeline.
  // A four-week block (20·perDay signups) always contains a whole number of
  // cycles, so it settles.
  const blocks = [];
  for (let k = 0; k + 4 <= batches.length; k += 4) {
    blocks.push({
      firstWeek: batches[k].week,
      cents: batches.slice(k, k + 4).reduce((s, b) => s + b.cents, 0),
    });
  }
  const finalBlock = blocks[blocks.length - 1].cents;
  const steadyBlock = blocks.find((b) => b.cents === finalBlock);
  const steadyWeek = { week: steadyBlock.firstWeek, cents: Math.round(finalBlock / 4) };

  console.log(`── ${perDay} signup${perDay > 1 ? "s" : ""}/weekday  (${perDay * 5}/week, ${perDay * 5 * 4} per 4 weeks) ──`);
  console.log("  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID");
  for (const w of MARKS) {
    const b = batches[w - 1];
    const a = b.byMilestone.activation || 0;
    const f = b.byMilestone.first_payment || 0;
    const r = b.byMilestone.retention || 0;
    console.log(
      `  ${String(w).padStart(4)}  [${iso(b.start)} , ${iso(b.end)})  ${String(b.count).padStart(4)}  ` +
        `${money(a).padStart(10)}  ${money(f).padStart(9)}  ${money(r).padStart(10)}  ${money(b.cents).padStart(9)}`,
    );
  }
  const cum12 = batches.slice(0, 12).reduce((s, b) => s + b.cents, 0);
  const steadyCents = steadyWeek.cents;
  console.log(
    `  4-week blocks: ` +
      blocks.map((b) => `w${b.firstWeek}-${b.firstWeek + 3} ${money(b.cents)}`).join("  ·  "),
  );
  console.log(
    `  steady from the block starting week ${steadyWeek.week}: ${money(steadyCents)}/week average` +
      `  ·  ${money(steadyCents * 52)}/year  ·  first 12 weeks total ${money(cum12)}`,
  );
  const firstWeekWith = (m) =>
    batches.find((b) => (b.byMilestone[m] || 0) > 0)?.week ?? "never";
  console.log(
    `  first payout containing: activation week ${firstWeekWith("activation")} · ` +
      `first payment week ${firstWeekWith("first_payment")} · retention week ${firstWeekWith("retention")}`,
  );
  console.log(
    `  ledger check: balanceCents over the whole ${HORIZON_WEEKS}-week ledger = ${money(balanceCents(ledger))} across ${ledger.length} rows`,
  );
  console.log("");

  summary.push({ perDay, steadyWeek: steadyWeek.week, steadyCents, cum12 });
}

// -- 3. The one-page comparison --------------------------------------------
console.log("── Comparison ──");
console.log("  /weekday  /week  /4wk   steady from   steady $/week   $/year      first 12 weeks");
for (const s of summary) {
  console.log(
    `  ${String(s.perDay).padStart(8)}  ${String(s.perDay * 5).padStart(5)}  ${String(s.perDay * 20).padStart(4)}   ` +
      `week ${String(s.steadyWeek).padStart(2)}      ${money(s.steadyCents).padStart(12)}   ${money(s.steadyCents * 52).padStart(10)}  ${money(s.cum12).padStart(13)}`,
  );
}
console.log("");

// -- 4. What the pipeline must produce -------------------------------------
// Grounded: vercel.json cron "3-59/10 * * * *" = 6 ticks/hour; BATCH = 25 in
// app/api/cron/sales-pipeline/route.js; per-provider caps in
// lib/sales/pipeline/limits.js; the seven-stage chain in chain.js/kinds.js.
const TICKS_PER_DAY = 6 * 24;
const BATCH = 25;
const TASK_CEILING = TICKS_PER_DAY * BATCH;
const TASKS_PER_PROSPECT_WITH_SITE = 7; // enrich, crawl, tech, capabilities, opportunities, score, brief
const TASKS_PER_PROSPECT_NO_SITE = 4; // enrich, opportunities, score, brief
const WEBSITE_FILL = 0.927; // docs/sales-intel/STATUS.md, measured
const blended =
  WEBSITE_FILL * TASKS_PER_PROSPECT_WITH_SITE +
  (1 - WEBSITE_FILL) * TASKS_PER_PROSPECT_NO_SITE;

console.log("── Pipeline ceiling, from vercel.json + BATCH + limits.js + chain.js ──");
console.log(`  ticks/day ${TICKS_PER_DAY} × BATCH ${BATCH} = ${TASK_CEILING} tasks/day`);
console.log(`  openai lane   maxPerRun 10 × ${TICKS_PER_DAY} = ${10 * TICKS_PER_DAY} tasks/day  (1 per prospect: GENERATE_RESEARCH_BRIEF)`);
console.log(`  http_crawl    maxPerRun 20 × ${TICKS_PER_DAY} = ${20 * TICKS_PER_DAY} tasks/day  (1 per prospect: CRAWL_WEBSITE)`);
console.log(`  discovery     maxPerRun 10 × ${TICKS_PER_DAY} = ${10 * TICKS_PER_DAY} tasks/day  (paging, shared)`);
console.log(`  tasks/prospect: ${TASKS_PER_PROSPECT_WITH_SITE} with a website, ${TASKS_PER_PROSPECT_NO_SITE} without; blended at ${(WEBSITE_FILL * 100).toFixed(1)}% fill = ${blended.toFixed(2)}`);
console.log(`  BINDING LANE: the batch. ${TASK_CEILING} / ${blended.toFixed(2)} = ${Math.floor(TASK_CEILING / blended)} fully-researched prospects/day`);
console.log(`  (worst case, every prospect has a website: ${TASK_CEILING} / ${TASKS_PER_PROSPECT_WITH_SITE} = ${Math.floor(TASK_CEILING / TASKS_PER_PROSPECT_WITH_SITE)}/day)`);
console.log("");

const RESEARCHED_PER_DAY = Math.floor(TASK_CEILING / TASKS_PER_PROSPECT_WITH_SITE);
console.log("  prospects a rep must be handed per signup, at an ASSUMED conversion rate");
console.log("  /weekday   at 1%     at 2%     at 5%    | pipeline supplies ~" + RESEARCHED_PER_DAY + "/day");
for (let perDay = 1; perDay <= 7; perDay++) {
  const at = (r) => Math.ceil(perDay / r);
  console.log(
    `  ${String(perDay).padStart(8)}   ${String(at(0.01)).padStart(6)}    ${String(at(0.02)).padStart(6)}    ${String(at(0.05)).padStart(6)}    | ${at(0.01) > RESEARCHED_PER_DAY ? "1% EXCEEDS the pipeline" : "all three fit"}`,
  );
}
console.log("");

// -- 5. Legal calling envelope ---------------------------------------------
// lib/sales/callingWindow.js SALES_CALL_WINDOW, in the PROSPECT's zone.
const WEEKDAY_MINUTES = 21 * 60 + 30 - 9 * 60;
const WEEKEND_MINUTES = 18 * 60 - 10 * 60;
console.log("── Legal calling envelope (lib/sales/callingWindow.js) ──");
console.log(`  weekday 09:00–21:30 = ${(WEEKDAY_MINUTES / 60).toFixed(1)} h   weekend 10:00–18:00 = ${(WEEKEND_MINUTES / 60).toFixed(1)} h`);
console.log(`  a five-weekday week: ${((WEEKDAY_MINUTES * 5) / 60).toFixed(1)} h of legal dialling per prospect time zone`);
console.log("  NOT ENFORCED anywhere in production — withinSalesCallingHours() has no caller.");
console.log("");

// -- 6. Reachable bank ------------------------------------------------------
const BANK = 775628;
console.log("── Reachable bank (docs/sales-intel/STATUS.md, measured) ──");
console.log(`  ${BANK.toLocaleString("en-CA")} = 79,736 CA + 695,892 US`);
for (let perDay = 1; perDay <= 7; perDay++) {
  const at1 = perDay / 0.01;
  const years = BANK / (at1 * 260);
  console.log(
    `  ${perDay}/weekday at an assumed 1%: ${at1}/day worked, ${(at1 * 260).toLocaleString("en-CA")}/yr — the bank lasts ${years.toFixed(0)} yr for one rep`,
  );
}
```

---

## Appendix B — its output, verbatim

```
FieldQuo — volume scenarios, computed from lib/sales/*.js
==============================================================================
plan            activation $20.00  first payment $40.00  retention $65.00
                total per acquisition $125.00  ·  retentionDays 60
week 1 Monday   2026-03-02  (signups at 15:00 UTC)
assumptions     5 selling days/week · activation +4d · first payment +31d
                funnel 7/5/4 out of every 10 signups

── Which nightly sweep pays retention (derived, not assumed) ──
  subscription starts 06:00 UTC  ->  pays on the day-60 sweep   (day-59 sweep: too_early)
  subscription starts 09:00 UTC  ->  pays on the day-60 sweep   (day-59 sweep: too_early)
  subscription starts 15:00 UTC  ->  pays on the day-61 sweep   (day-60 sweep: too_early)
  subscription starts 23:00 UTC  ->  pays on the day-61 sweep   (day-60 sweep: too_early)

── 1 signup/weekday  (5/week, 20 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)     3      $60.00      $0.00       $0.00     $60.00
     2  [2026-03-09 , 2026-03-16)     4      $80.00      $0.00       $0.00     $80.00
     4  [2026-03-23 , 2026-03-30)     4      $80.00      $0.00       $0.00     $80.00
     6  [2026-04-06 , 2026-04-13)     5      $80.00     $40.00       $0.00    $120.00
     8  [2026-04-20 , 2026-04-27)     5      $80.00     $40.00       $0.00    $120.00
    10  [2026-05-04 , 2026-05-11)     7      $80.00     $40.00     $130.00    $250.00
    12  [2026-05-18 , 2026-05-25)     7      $80.00     $40.00     $130.00    $250.00
    16  [2026-06-15 , 2026-06-22)     7      $80.00     $40.00     $130.00    $250.00
  4-week blocks: w1-4 $280.00  ·  w5-8 $680.00  ·  w9-12 $1200.00  ·  w13-16 $1200.00  ·  w17-20 $1200.00
  steady from the block starting week 9: $300.00/week average  ·  $15600.00/year  ·  first 12 weeks total $2160.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $6000.00 across 160 rows

── 2 signups/weekday  (10/week, 40 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)     6     $120.00      $0.00       $0.00    $120.00
     2  [2026-03-09 , 2026-03-16)     7     $140.00      $0.00       $0.00    $140.00
     4  [2026-03-23 , 2026-03-30)     7     $140.00      $0.00       $0.00    $140.00
     6  [2026-04-06 , 2026-04-13)    12     $140.00    $200.00       $0.00    $340.00
     8  [2026-04-20 , 2026-04-27)    12     $140.00    $200.00       $0.00    $340.00
    10  [2026-05-04 , 2026-05-11)    16     $140.00    $200.00     $260.00    $600.00
    12  [2026-05-18 , 2026-05-25)    16     $140.00    $200.00     $260.00    $600.00
    16  [2026-06-15 , 2026-06-22)    16     $140.00    $200.00     $260.00    $600.00
  4-week blocks: w1-4 $540.00  ·  w5-8 $1360.00  ·  w9-12 $2400.00  ·  w13-16 $2400.00  ·  w17-20 $2400.00
  steady from the block starting week 9: $600.00/week average  ·  $31200.00/year  ·  first 12 weeks total $4300.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $12000.00 across 320 rows

── 3 signups/weekday  (15/week, 60 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)     7     $140.00      $0.00       $0.00    $140.00
     2  [2026-03-09 , 2026-03-16)    11     $220.00      $0.00       $0.00    $220.00
     4  [2026-03-23 , 2026-03-30)    11     $220.00      $0.00       $0.00    $220.00
     6  [2026-04-06 , 2026-04-13)    19     $220.00    $320.00       $0.00    $540.00
     8  [2026-04-20 , 2026-04-27)    19     $220.00    $320.00       $0.00    $540.00
    10  [2026-05-04 , 2026-05-11)    24     $220.00    $320.00     $325.00    $865.00
    12  [2026-05-18 , 2026-05-25)    24     $220.00    $320.00     $325.00    $865.00
    16  [2026-06-15 , 2026-06-22)    24     $220.00    $320.00     $325.00    $865.00
  4-week blocks: w1-4 $780.00  ·  w5-8 $2040.00  ·  w9-12 $3405.00  ·  w13-16 $3600.00  ·  w17-20 $3600.00
  steady from the block starting week 13: $900.00/week average  ·  $46800.00/year  ·  first 12 weeks total $6225.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $18000.00 across 480 rows

── 4 signups/weekday  (20/week, 80 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)     9     $180.00      $0.00       $0.00    $180.00
     2  [2026-03-09 , 2026-03-16)    14     $280.00      $0.00       $0.00    $280.00
     4  [2026-03-23 , 2026-03-30)    14     $280.00      $0.00       $0.00    $280.00
     6  [2026-04-06 , 2026-04-13)    24     $280.00    $400.00       $0.00    $680.00
     8  [2026-04-20 , 2026-04-27)    24     $280.00    $400.00       $0.00    $680.00
    10  [2026-05-04 , 2026-05-11)    32     $280.00    $400.00     $520.00   $1200.00
    12  [2026-05-18 , 2026-05-25)    32     $280.00    $400.00     $520.00   $1200.00
    16  [2026-06-15 , 2026-06-22)    32     $280.00    $400.00     $520.00   $1200.00
  4-week blocks: w1-4 $1020.00  ·  w5-8 $2720.00  ·  w9-12 $4540.00  ·  w13-16 $4800.00  ·  w17-20 $4800.00
  steady from the block starting week 13: $1200.00/week average  ·  $62400.00/year  ·  first 12 weeks total $8280.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $24000.00 across 640 rows

── 5 signups/weekday  (25/week, 100 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)    12     $240.00      $0.00       $0.00    $240.00
     2  [2026-03-09 , 2026-03-16)    16     $320.00      $0.00       $0.00    $320.00
     4  [2026-03-23 , 2026-03-30)    16     $320.00      $0.00       $0.00    $320.00
     6  [2026-04-06 , 2026-04-13)    31     $320.00    $600.00       $0.00    $920.00
     8  [2026-04-20 , 2026-04-27)    31     $320.00    $600.00       $0.00    $920.00
    10  [2026-05-04 , 2026-05-11)    43     $320.00    $600.00     $780.00   $1700.00
    12  [2026-05-18 , 2026-05-25)    43     $320.00    $600.00     $780.00   $1700.00
    16  [2026-06-15 , 2026-06-22)    43     $320.00    $600.00     $780.00   $1700.00
  4-week blocks: w1-4 $1260.00  ·  w5-8 $3400.00  ·  w9-12 $5740.00  ·  w13-16 $6000.00  ·  w17-20 $6000.00
  steady from the block starting week 13: $1500.00/week average  ·  $78000.00/year  ·  first 12 weeks total $10400.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $30000.00 across 800 rows

── 6 signups/weekday  (30/week, 120 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)    14     $280.00      $0.00       $0.00    $280.00
     2  [2026-03-09 , 2026-03-16)    21     $420.00      $0.00       $0.00    $420.00
     4  [2026-03-23 , 2026-03-30)    21     $420.00      $0.00       $0.00    $420.00
     6  [2026-04-06 , 2026-04-13)    36     $420.00    $600.00       $0.00   $1020.00
     8  [2026-04-20 , 2026-04-27)    36     $420.00    $600.00       $0.00   $1020.00
    10  [2026-05-04 , 2026-05-11)    48     $420.00    $600.00     $780.00   $1800.00
    12  [2026-05-18 , 2026-05-25)    48     $420.00    $600.00     $780.00   $1800.00
    16  [2026-06-15 , 2026-06-22)    48     $420.00    $600.00     $780.00   $1800.00
  4-week blocks: w1-4 $1540.00  ·  w5-8 $4040.00  ·  w9-12 $6810.00  ·  w13-16 $7200.00  ·  w17-20 $7200.00
  steady from the block starting week 13: $1800.00/week average  ·  $93600.00/year  ·  first 12 weeks total $12390.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $36000.00 across 960 rows

── 7 signups/weekday  (35/week, 140 per 4 weeks) ──
  week  window (UTC, half-open)          rows   activation  first pay   retention   PAID
     1  [2026-03-02 , 2026-03-09)    15     $300.00      $0.00       $0.00    $300.00
     2  [2026-03-09 , 2026-03-16)    26     $520.00      $0.00       $0.00    $520.00
     4  [2026-03-23 , 2026-03-30)    26     $520.00      $0.00       $0.00    $520.00
     6  [2026-04-06 , 2026-04-13)    44     $520.00    $720.00       $0.00   $1240.00
     8  [2026-04-20 , 2026-04-27)    44     $520.00    $720.00       $0.00   $1240.00
    10  [2026-05-04 , 2026-05-11)    56     $520.00    $720.00     $780.00   $2020.00
    12  [2026-05-18 , 2026-05-25)    56     $520.00    $720.00     $780.00   $2020.00
    16  [2026-06-15 , 2026-06-22)    56     $520.00    $720.00     $780.00   $2020.00
  4-week blocks: w1-4 $1800.00  ·  w5-8 $4680.00  ·  w9-12 $7880.00  ·  w13-16 $8400.00  ·  w17-20 $8400.00
  steady from the block starting week 13: $2100.00/week average  ·  $109200.00/year  ·  first 12 weeks total $14360.00
  first payout containing: activation week 1 · first payment week 5 · retention week 9
  ledger check: balanceCents over the whole 20-week ledger = $42000.00 across 1120 rows

── Comparison ──
  /weekday  /week  /4wk   steady from   steady $/week   $/year      first 12 weeks
         1      5    20   week  9           $300.00    $15600.00       $2160.00
         2     10    40   week  9           $600.00    $31200.00       $4300.00
         3     15    60   week 13           $900.00    $46800.00       $6225.00
         4     20    80   week 13          $1200.00    $62400.00       $8280.00
         5     25   100   week 13          $1500.00    $78000.00      $10400.00
         6     30   120   week 13          $1800.00    $93600.00      $12390.00
         7     35   140   week 13          $2100.00   $109200.00      $14360.00

── Pipeline ceiling, from vercel.json + BATCH + limits.js + chain.js ──
  ticks/day 144 × BATCH 25 = 3600 tasks/day
  openai lane   maxPerRun 10 × 144 = 1440 tasks/day  (1 per prospect: GENERATE_RESEARCH_BRIEF)
  http_crawl    maxPerRun 20 × 144 = 2880 tasks/day  (1 per prospect: CRAWL_WEBSITE)
  discovery     maxPerRun 10 × 144 = 1440 tasks/day  (paging, shared)
  tasks/prospect: 7 with a website, 4 without; blended at 92.7% fill = 6.78
  BINDING LANE: the batch. 3600 / 6.78 = 530 fully-researched prospects/day
  (worst case, every prospect has a website: 3600 / 7 = 514/day)

  prospects a rep must be handed per signup, at an ASSUMED conversion rate
  /weekday   at 1%     at 2%     at 5%    | pipeline supplies ~514/day
         1      100        50        20    | all three fit
         2      200       100        40    | all three fit
         3      300       150        60    | all three fit
         4      400       200        80    | all three fit
         5      500       250       100    | all three fit
         6      600       300       120    | 1% EXCEEDS the pipeline
         7      700       350       140    | 1% EXCEEDS the pipeline

── Legal calling envelope (lib/sales/callingWindow.js) ──
  weekday 09:00–21:30 = 12.5 h   weekend 10:00–18:00 = 8.0 h
  a five-weekday week: 62.5 h of legal dialling per prospect time zone
  NOT ENFORCED anywhere in production — withinSalesCallingHours() has no caller.

── Reachable bank (docs/sales-intel/STATUS.md, measured) ──
  775,628 = 79,736 CA + 695,892 US
  1/weekday at an assumed 1%: 100/day worked, 26,000/yr — the bank lasts 30 yr for one rep
  2/weekday at an assumed 1%: 200/day worked, 52,000/yr — the bank lasts 15 yr for one rep
  3/weekday at an assumed 1%: 300/day worked, 78,000/yr — the bank lasts 10 yr for one rep
  4/weekday at an assumed 1%: 400/day worked, 104,000/yr — the bank lasts 7 yr for one rep
  5/weekday at an assumed 1%: 500/day worked, 130,000/yr — the bank lasts 6 yr for one rep
  6/weekday at an assumed 1%: 600/day worked, 156,000/yr — the bank lasts 5 yr for one rep
  7/weekday at an assumed 1%: 700/day worked, 182,000/yr — the bank lasts 4 yr for one rep
```

---

## Appendix C — regenerating this

Paste Appendix A back into the repo root and run it. Two things are worth
changing when there is real data:

- **Assumption 4, the funnel.** Once thirty companies have passed day 60, the
  actual 7/5/4 shape is computable from `SalesCommissionEntry` directly. Replace
  `ASSUMPTIONS.funnelOutOfTen` and regenerate; steady state is linear in it.
- **Assumption 5, the conversion rate.** The moment a prospect-to-signup rate
  exists, §3's three-column sensitivity table collapses into one honest column,
  and the verdict on 6 and 7 a day stops being conditional.

Everything else in this document is read out of code and survives.

Delete the script again afterwards.
