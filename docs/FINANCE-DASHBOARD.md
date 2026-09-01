# The finance dashboard — what happened to it, and what's here now

The owner's ask, verbatim: *"Shouldn't this data be integrated into the
source code I gave you for the finance code? I think we should have enough
in order to implement that UI and logic. I know that until the company
uploads their banking statement in CSV format it doesn't show its full
power, but we have all the information from expenses, payroll, jobs etc. to
use most of it."*

The owner has also said, with visible frustration, *"the finance source code
I gave you didn't integrate into my app"* and *"where did you put the
finance dashboard you were building? I don't see anything."* Both things are
true, at different times. This document says which is true now, with file
paths, and then finishes the part that genuinely wasn't done.

## Part one — the honest audit

### The reference repo

`/Users/emilioboves/nextjs-finance-saas-master` is present. It's a Next.js
14 / Clerk / Drizzle / Neon / Hono / Plaid personal-finance tutorial app,
single-tenant, with one signed `amount` column standing in for both income
and expense. It offers:

- `app/api/[[...route]]/summary.ts` — a Hono endpoint computing income,
  expenses and remaining for a period, with a same-length prior window for
  comparison and a daily series for a chart.
- `app/(dashboard)/transactions/*` — a transaction table with a CSV import
  flow (`react-papaparse`), column mapping, and a category/account model
  (`categories`, `accounts` tables) a transaction belongs to.
- `recharts`-based chart components (area chart, pie chart, radial chart).
- Clerk auth, Plaid bank-account linking, LemonSqueezy subscriptions — none
  of which apply to a multi-tenant, Better-Auth, Stripe-Connect product.

### What was adopted, and where

**The shape of the summary endpoint was adopted — not the code, not the
stack, not the transaction model.** It shipped as commit `8c14f93` ("Add
money flow (income/expenses/remaining) as a section on the KPI dashboard"),
**2026-08-30**, one day before the most recent commit this worktree branched
from. Concretely:

- `lib/analytics/moneyFlow.js` — the conditional-aggregate-per-period
  arithmetic, the same-length prior window (`priorWindow()`), the gap-free
  daily series (`eachDayUTC()` + `sumByDay()`). Its own header names the
  reference file directly and explains what was kept and what wasn't — see
  "Ported from a good reference, not copied" in that file.
- `app/api/analytics/money-flow/route.js` — the route that feeds it,
  reading `Payment` (income) and `Expense` (spend) instead of one signed
  `amount` column, because FieldQuo has no such column.
- `app/components/charts/FlowChart.js` — a hand-built SVG chart, **not**
  `recharts`. `recharts` is not, and has never been, a dependency of this
  project (`grep -n recharts package.json` returns nothing) — every chart on
  `/app/analytics/kpis` (`FlowChart`, `Sparkline`, `BarComparison`,
  `GanttStrip`) is bespoke SVG, matching AGENTS.md's zero-new-dependency
  discipline.
- `app/app/analytics/kpis/page.js` — a **"Money flow" section**, added to
  the *existing* KPI dashboard rather than a new page. The file's own
  comment explains why: "a contractor already has one place to check
  business health, and a second screen for 'money' would be the
  `/app/tasks` failure again (built, and findable only by someone who
  already knew it existed)."
- `scripts/check-money-flow.mjs` — the reference's CSV-import column-mapping
  UX was adopted too, but for `lib/expenses/csvImport.js` /
  `app/app/settings/expense-tracking/import`, fixing four real bugs
  documented in `docs/ROADMAP.md` (date-format detection instead of
  guessing, server-side tenant scoping, a real permission gate, no deletes).

Two of the reference's own bugs were fixed, not carried over, and both are
proven in the check script rather than asserted in a comment:

- The reference's category query INNER JOINs to a categories table, so an
  uncategorised transaction silently vanishes from the total. FieldQuo
  buckets a blank category into a named `"Uncategorised"` slice instead —
  `top + Other` always sums to the true total (`scripts/check-money-flow.mjs`
  Section 5 asserts this against a fixture, not just describes it).
- The reference sums `amount` directly off the transaction table. FieldQuo
  sums `Payment`, never `Invoice.total` — an amended invoice (a new row,
  same `invoiceNumber`, higher `version`) would double-count if income were
  summed off invoices instead. Section 3 of the same check script proves
  this with an amended-invoice fixture.

### What was not adopted

- No transaction list UI, no manual "add a transaction" form, no
  category/account CRUD screens — FieldQuo already has this, split across
  `Expense`/`Payment`/`Invoice`, each with its own screen.
- No Plaid. The owner evaluated it and rejected it — four-figure monthly
  minimums, no published pricing, no Canadian bank support. The CSV import
  is the deliberate stepping stone (`lib/expenses/csvImport.js`'s own header
  says so), reserving a nullable `Expense.externalId` for a Plaid sync to
  backfill later without a data migration.
- No Clerk, no Drizzle, no Hono, no LemonSqueezy, no `recharts` — none of
  these fit the existing Better-Auth / Prisma / Stripe-Connect / hand-built-
  SVG stack, and none were pulled in.

### Was "it wasn't integrated" a fair complaint?

**Not anymore, and it's worth being precise about when it stopped being
fair.** The money-flow work landed 2026-08-30. If the owner's "I don't see
anything" comment predates that commit, it was accurate — there was, at that
point, genuinely no finance surface built from this reference at all. As of
this session, `lib/analytics/moneyFlow.js`, its route, its chart, and its
check script all exist, are wired into a real page, and pass
`scripts/check-money-flow.mjs` (109 fixture assertions, 11 mutations, all
caught) and `npm run build`.

What's more likely still true, and is the actual subject of this session's
Part Two request: **the owner went looking for something called "the
finance dashboard" and didn't find it**, because it isn't a separate page —
it's a section titled "Money flow" halfway down `/app/analytics/kpis`, a
page named "KPI dashboard," not "Finance." Nothing about that placement is
broken — `docs/NAV-AUDIT.md`'s own sweep already confirmed the KPI page
itself is reachable from the sidebar — but a section with no page of its own
and no distinct nav label is exactly the kind of "built, and findable only
by someone who already knew it existed" the file's own header warns against
for a *second* screen. It's genuinely there. It's also genuinely easy to
miss if you're looking for a page named "Finance."

## Part two — what this session built

The owner's real point, restated: the product already holds expenses,
payroll, jobs, invoices and payments, so a finance view should be useful
**before** any bank statement is uploaded. Money flow (income/expenses) only
answers half of that — it reads `Payment` and `Expense`, and nothing else.
Payroll, fixed costs, marketing spend and committed-but-unbilled work each
already had a screen that computed them, but none of those numbers were
anywhere near a money dashboard.

### New: the "Business costs" section, on the same KPI page

`app/app/analytics/kpis/page.js` gained a second money section, directly
below Money flow, called **"Business costs"**. Four tiles:

| Tile | Source | New code? |
|---|---|---|
| Payroll this period | Approved `TimeEntry` hours × each worker's rate | **New** — `lib/analytics/payrollCost.js` |
| Fixed costs | `lib/analytics/burnRate.js`'s `totalMonthlyCost` (rent, overhead pay, debt/depreciation) | Reused unchanged from Settings → Overhead |
| Marketing spend | `lib/analytics/marketingRollup.js`'s period total | Reused unchanged from the marketing-spend screen |
| Committed, not yet invoiced | `lib/analytics/kpis.js`'s `buildBacklogWeeks().raw.backlogValue` | Reused — **not** re-fetched; read off the KPI payload the page already has |

New files:

- **`lib/analytics/payrollCost.js`** — pure. Approved `TimeEntry` hours,
  summed per worker, × `effectiveWageRate()` (imported from
  `lib/payroll/buildPayRun.js`, **not** re-derived — see "why this doesn't
  add a fourth pay-rate path" below). Same honesty rules as `moneyFlow.js`:
  `everRecordedTime` required and not defaulted (no approved time *ever* →
  `null`, not `$0`); hours with no resolvable rate are excluded from the
  total, counted, and flagged `incomplete` rather than priced at $0; pending
  (unapproved) hours are reported for visibility but never paid, matching
  `buildPayRun.js`'s own "only approved time is paid" rule.
- **`app/api/analytics/finance-overview/route.js`** — the route. Gates on
  the union of every permission the three pieces it touches already carry
  on their own screens: `jobCosting` + `payroll:view_all` (payroll),
  `jobCosting` + `showPricing` via `canReadCostBasis(full, "burnRate")`
  (fixed costs), `user:manage` (marketing spend) — same "union of every gate,
  one 403, name what's missing" pattern `money-flow/route.js` already uses.
  An owner or admin passes all three without a single toggle, same as
  everywhere else in this permission model.

### Why this doesn't add a fourth pay-rate path

`docs/ROADMAP.md` §5 records three pay-rate paths that used to disagree:
`AddEmployeeModal` writes `Worker.hourlyRate`; the New-User/edit-member
screen writes `Member.laborCostPerHour` and no `Worker` at all; the overhead
screen writes `Salary` rows with `workerId: null` (a business cost, never a
person's pay). `lib/payroll/buildPayRun.js`'s `effectiveWageRate()` is the
fix already shipped for the first two (`Worker.hourlyRate` wins, else the
`Member` fallback). `lib/analytics/payrollCost.js` **imports that function**
rather than writing a fourth resolution rule, and never reads `Salary` at
all — an overhead salary is already counted, once, in the Fixed costs tile.

### Why nothing here is summed into one "total money out" figure

This was the deliberate scope limit, not an oversight. Payroll and
marketing spend are both real spending that **may already be double-counted**
if a contractor also logs the same cost by hand as an `Expense` — a
Facebook ad invoice entered in both the marketing-spend screen and Settings
→ Expense Tracking; a payroll transfer entered as both a wage line and a
manual expense. Nothing in this schema links those two tables to detect
that overlap. A combined total would look precise and sometimes be wrong —
the exact trap AGENTS.md's "never ship a control that appears to work and
doesn't" exists to catch. Each figure is shown separately, with an explicit
note on the Marketing tile that it may overlap with Expense Tracking. Adding
real deduplication (e.g. linking a `MarketingSpend` row to the `Expense` row
a contractor also typed for the same bill) is a product decision, not one
this session made unilaterally.

### Why Fixed costs is shown as "per month," not scaled to the period

`calculateBurnRate()`'s `totalMonthlyCost` is a **projection** (what the
business costs to run in an average month, from recurring overhead,
overhead salaries and debt/depreciation), not a **transaction sum** for the
selected date range. Prorating a monthly figure onto an arbitrary
`from`–`to` window would require inventing a proration rule nobody asked
for (7/30ths of a month? working days only? calendar days?) — exactly the
"padding absent data with defaults" AGENTS.md's failure class 5 warns
against, just aimed at a different kind of guess. It's shown as a flat
monthly number with a link to Settings → Overhead for the itemised
breakdown that already exists there, unchanged.

### What needs the bank CSV, and what doesn't

**Doesn't need it** — built from data FieldQuo already has, useful before
any statement is ever uploaded:

- Money flow's income (`Payment`) and, for anything logged by hand,
  expenses (`Expense`).
- Payroll this period (approved `TimeEntry` × rate).
- Fixed costs (recurring overhead `Expense` rows, overhead `Salary`, `Debt`,
  `Asset` depreciation).
- Marketing spend (`MarketingSpend`, hand-typed or Meta-synced).
- Committed, not yet invoiced (accepted `Quote`s on open `Job`s).

**Still needs it** — the honest gap, unchanged by this session:

- Any expense a contractor pays for but never logs by hand and never
  imports — a debit-card purchase at a supplier, a cash payment, a cheque.
  `Expense` and `MarketingSpend` are both only as complete as what someone
  typed in or synced from Meta. The CSV import
  (`lib/expenses/csvImport.js`, `/app/settings/expense-tracking/import`) is
  the existing, real answer to that gap, linked from every "no data yet"
  state on the Money flow tiles — this session added no new link to it,
  because payroll/fixed-costs/marketing spend aren't things a bank statement
  would ever contain in a form this product could import (a bank line item
  is one lump sum a bookkeeper would still have to allocate by hand).

### What this session did not build

- **No refund/dispute netting in "income."** `Payment.amount` is the gross
  charge; `refundedAmount`/`disputeStatus` live on the same row. Checked
  whether this is a live gap: it is not new, and it is not inconsistent —
  `lib/analytics/receivables.js`'s own revenue trend (`buildRevenueTrend`)
  sums raw `Payment.amount` the same way, and
  `lib/export/accountingExport.js` documents the same choice explicitly:
  *"FieldQuo records no refunds and no credit notes. If money went back to
  a client, it is not in this file."* This is an established, reasoned
  convention across every money screen in the product (gross received,
  matching how a bookkeeper would enter a refund as its own outflow rather
  than editing the original sale) — not something this session should
  quietly change on one screen and leave inconsistent everywhere else. A
  real fix (showing refunds as their own labelled outflow) is a product
  decision that touches Money flow, receivables and the accounting export
  together, flagged here rather than picked unilaterally.
- **No schema changes, no `npx prisma db push`.** Nothing here needed a new
  column. `npx prisma validate` was run (it can't reach a real database
  locally — `DATABASE_URL` is Sensitive in Vercel, per AGENTS.md's own
  environment note — but no schema edits were made in the first place).
- **No new npm dependency.** Nothing here needed one; asked first regardless
  per this session's instructions.
- **No combined marketing/payroll de-duplication against Expense** — see
  above.
- **No new database index.** `docs/health/07-performance.md` was read
  before writing any query. The new `TimeEntry` queries in
  `finance-overview/route.js` use the identical scoping pattern
  `app/api/analytics/kpis/route.js` and `lib/payroll/buildPayRun.js` already
  use (`worker: { companyId }`, bounded by `clockIn` date range, no
  unbounded `findMany`) — not a new risk, and not a new index was invented
  for it either; that doc's own missing-index list doesn't name `TimeEntry`
  as unindexed on the columns this query filters by.

## Verification

`scripts/check-money-flow.mjs` gained Section 17 (17 fixture assertions
against `buildPayrollCost()`, executed with no database) and Section 18 (5
mutations against `lib/analytics/payrollCost.js`, all caught). Real output,
this session:

```
17. lib/analytics/payrollCost.js — approved hours × each worker's own rate

  ✓ value is null, unavailable, no_time_entries_recorded          (no company history — never a $0)
  ✓ a real $0 — the crew has clocked before, just not this period (real history, quiet period)
  ✓ 10h × $25 = $250                                              (one rated worker)
  ✓ 5h × the Member fallback rate ($20) = $100, when Worker.hourlyRate is unset
  ✓ Worker.hourlyRate ($25) wins over a Member fallback that's also on file
  ✓ only the rated worker's hours are priced: 10h × $25 = $250, the unrated 8h excluded
  ✓ incomplete — a real worker logged real hours this file can't price
  ✓ the excluded hours and the worker count both ride along, not silently dropped
  ✓ pending hours don't inflate the paid total
  ✓ refuses to guess everRecordedTime when the caller doesn't supply it
  ✓ 0.1 + 0.2, accumulated one worker at a time, still lands on exactly $0.30

18. lib/analytics/payrollCost.js mutants
  ✓ caught: shows a real $0 of payroll for a company that has never had approved time
  ✓ caught: folds unrated hours in as free labour instead of excluding them
  ✓ caught: stops flagging incomplete when a real worker's hours couldn't be priced
  ✓ caught: prices PENDING hours as if they were approved
  ✓ caught: stops rounding the running total, letting float dust leak into every figure

PASSED — 143/143 assertions
```

`node --import ./scripts/alias-loader.mjs scripts/check-money-flow.mjs`
(full run, with mutations): **143/143 assertions, 29/29 mutations caught,
exit 0.**

`npm run check:all`: **exit 0** (all ~200 check scripts, including the
above).

`npm run build`: **exit 0** — `check:imports`, `check:exports`, ESLint,
`check:env-docs`, `prisma generate`, `next build` all clean. (Local build
needed a placeholder `DATABASE_URL` in a gitignored `.env` — `prisma
generate` fails to even load its config without one present, though it
never connects; this affects nothing checked into the repo or deployed.)

No fixture was run against a live database — every number above comes from
executing the pure functions directly, the technique AGENTS.md itself asks
for ("execute pure functions against hostile input... most of the real bugs
in this repo were found that way, not by reading").
