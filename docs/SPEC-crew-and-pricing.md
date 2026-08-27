# Crew, seats and pricing — the owner's spec, tracked

Written because the specs in this area arrived across many messages and were
being tracked in one person's head, which is how the billing-interval toggle
got left out of an agent brief and had to be caught by the owner.

Every line is either **verified against code** or **explicitly not built**.
Nothing here is "probably fine". If a row says DONE, there is a check asserting
it; if it says OPEN, nobody has built it.

Update this file in the same commit as the work. A spec tracked in a transcript
is a spec that gets half-remembered.

---

## 1. The Crew role

| # | Requirement | State | Where |
|---|---|---|---|
| 1.1 | Renamed from "Worker (limited access)" to **Crew** | DONE | `PERMISSION_PRESETS.worker.label` |
| 1.2 | Cannot see leads / requests | DONE | `requests: none` |
| 1.3 | Cannot see quotes | DONE | `quotes: none` |
| 1.4 | Cannot see quote / estimate review | DONE | route gated |
| 1.5 | Cannot see invoices | DONE | `invoices: none` |
| 1.6 | Cannot see service plans | DONE | `app.nav.plans` gated on invoices |
| 1.7 | Cannot see the client book | DONE | `app.nav.clients` gated; `name_address_only` keeps the site address |
| 1.8 | Cannot see expenses (company-wide) | DONE | `app.nav.expenses` needs `view_record_edit_all` |
| 1.9 | Cannot see insights | DONE | gated on `showPricing` |
| 1.10 | Cannot see marketing / funnels / receptionist | DONE | nav gated |
| 1.11 | Cannot see Refer a friend | DONE | settings row gated |
| 1.12 | Own work schedule | DONE | `schedule: view_complete_own` |
| 1.13 | Time clock | DONE | |
| 1.14 | Own timesheets — past, current, upcoming | DONE | `timeTracking: view_record_edit_own` |
| 1.15 | A timesheet edit by the worker returns to **pending approval** | DONE | two guards: Crew cannot touch an approved row at all, and a self-edit of a signed-off one reopens it. Extracted to `lib/payroll/timesheetEdit.js` and asserted (18) — it was correct but unasserted |
| 1.16 | Own time off, and can request it | DONE | |
| 1.17 | Own payroll — earned and expected | DONE | `payroll: view_own` |
| 1.18 | **Jobs assigned to them only** | DONE | `assignedJobWhere` — a relation filter on `JobVisit.assignedToId`; not theirs = **404** |
| 1.19 | Those jobs carry **no prices** | DONE | no `redactJobMoney` needed — `Job` has no money column; costing already behind `jobCosting` |
| 1.20 | Those jobs show visits, materials to buy, tasks from notes, **site address** | **OPEN** | the crew work-order document is not built |
| 1.21 | Calendar shows only their schedule + their assigned jobs | PARTIAL | `getUpcomingWork` fixed and re-granted; the calendar screens themselves are UNVERIFIED |
| 1.22 | To-dos assigned to them | **OPEN** | unverified |
| 1.23 | Team visible **read-only** | DONE | Manage Team settings row hidden — the main rail already gated the same page |
| 1.24 | Cannot "assign shift" | **OPEN** | unverified |
| 1.25 | Team calendar shows only their own work | **OPEN** | unverified |
| 1.26 | Crew inbox — only messages pertinent to them | DONE | scoped on `senderUserId` |
| 1.27 | Crew inbox **setup** = owner / admin / manager, not dispatcher | DONE | `canSetUpCrewTexting` |
| 1.28 | No AI buttons on jobs, "unless it's empty" | **OPEN — NEEDS THE OWNER** | the empty-field clause was never understood; nothing built on a guess |

### Crew settings surface
Only three rows: **Product updates, Language (their own), Availability.**
Verified by execution: Crew sees exactly 3 of 36. Estimator sees 6 — the extra
three are the price book, which is why those rows are grid rules and not role
capabilities.

| # | Requirement | State |
|---|---|---|
| 1.29 | 16 rows with a capability rule already hide from Crew | DONE |
| 1.30 | ~~22~~ **20** rows had no rule (2 of the 38 are chrome, not rows) | DONE |
| 1.31 | Invert the default to **deny**, with a completeness check | DONE | unlisted row hides from employee AND owner; still visible to a support session |
| 1.32 | Every hidden row's **route** refuses Crew too | DONE | all already gated; 2 dead controls found and fixed instead |

---

## 2. Roles and seats

| # | Requirement | State |
|---|---|---|
| 2.1 | A **seat** = can create/change a quote, job or invoice | DONE |
| 2.2 | Counted off the **grid**, not the role name | DONE |
| 2.3 | Crew are free | DONE |
| 2.4 | Deactivated members cost nothing | DONE |
| 2.5 | **Estimator** replaces "Worker (full view)" — writes quotes, paid seat, role stays `employee` | DONE |
| 2.6 | Seat counter split seats / crew, with a per-kind breakdown | DONE |
| 2.7 | "Add crew — free" and "Add a seat" as separate buttons | DONE |
| 2.8 | A button to increase their licence | PARTIAL — `SeatUpgradePanel` shows only at the limit |
| 2.9 | Seat **enforcement** (blocking or auto-adding at the limit) | **OPEN** — nothing enforces the tier's seat count yet |

---

## 3. Pricing

| # | Requirement | State |
|---|---|---|
| 3.1 | Four tiers: 1 / 3 / 6 / 10 seats | DONE |
| 3.2 | Crew 5 / 8 / 11 / 15 → **6 / 11 / 17 / 25 people** | DONE |
| 3.3 | 129 / 189 / 289 / 389 | DONE |
| 3.4 | **CAD for Canada, USD for the USA** | DONE |
| 3.5 | Currency from the **company address**, never selectable | DONE |
| 3.6 | Falls back to the address and province when the column is empty | DONE |
| 3.7 | Prices editable in the back end | DONE |
| 3.8 | Promotion: enable/disable, set an expiry | DONE |
| 3.9 | Promotion shows what it reverts to, and for how long | DONE |
| 3.10 | Old per-headcount plans retired, existing subscribers keep theirs | DONE |
| 3.11 | **Monthly vs 1-year commitment**, same rate | IN FLIGHT |
| 3.12 | Checkout honours the chosen interval | IN FLIGHT — `recurring: { interval: "month" }` is hardcoded |
| 3.13 | Plan selection moves **last** at signup, after the address | IN FLIGHT |
| 3.14 | What "first month free" means on an annual prepay | DONE | owner confirmed: 30 free days, then the full year, then a normal yearly cycle |

---

## 4. Referrals

| # | Requirement | State |
|---|---|---|
| 4.1 | Referrer and invitee each get **1 free month** (owner overrode the 3 in AGENTS.md) | DONE |
| 4.2 | The reward is **extended access**, not a dollar credit | DONE |
| 4.3 | Annual: free month runs from the year end and **does not trigger a renewal** | DONE |
| 4.4 | Monthly: applied to the next month | DONE |
| 4.5 | Referrals **stack** — a second extends the first | DONE |
| 4.6 | AGENTS.md corrected so it does not contradict the code | DONE |

---

## Needs a decision from the owner

1. **1.28** — "no AI buttons, unless it's empty, then it can read it so it can be filled."
3. **2.9** — at the seat limit: block the save, or auto-add a seat at the extra-seat price? (Blocking mid-job is how software gets uninstalled.)
4. A 1-seat owner with 9 crew fits neither Solo (5 crew) nor Crew (8 crew) and lands on Shop at 289. Correct, or should crew overflow into paid seats?
