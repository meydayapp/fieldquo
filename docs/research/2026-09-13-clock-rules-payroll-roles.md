# Clock rules, payroll provider, custom roles — research and proposal

Written 2026-09-13; every source was read that day (list at the end). Each
section ends in a Recommendation the owner can accept with one word. Zeal,
Finch, Rippling and ADP Run were checked and add nothing over the rows below.

---

## 1. Clock rules — rounding and early/late punch control

### What exists

- Raw `clockIn`/`clockOut` on `TimeEntry`; paid `hours` computed in one place,
  `lib/timeclock/entryHours.js`. No rounding.
- `lib/shifts/attendance.js` flags late (10 min), early-out (15), no-show (60),
  forgotten clock-out; takes a `thresholds` argument and reserves
  "Settings → Time clock" in a comment. Flags never touch pay.
- Location stamps never gate a punch (browser GPS is one-shot, by design).
- Breaks are punched; nothing checks one was taken. The cron never closes an
  entry — a forgotten clock-out is a question to a person.

### What the competitors offer

| Product | Rounding | Early-punch block | Auto clock-out | Break enforcement | Geofence gate | PIN / photo |
|---|---|---|---|---|---|---|
| Homebase | nearest X (setting) | minutes before shift; not for Managers | 10–120 min after shift | blocks early return from break | radius setting | photo on tablet (paid) |
| When I Work | nearest 5 / 6 / 15; exports raw and rounded | Anytime / 0 / 5 / 15 / 30 min | — | auto-deduct scheduled; attestation | ≥100 m, optional | photo on iOS terminal |
| Connecteam | 5 / 10 / 15 / 30; rewrites past timesheets | hours window | after N hours | manual (Basic) / automatic (Advanced) | required per site; auto-out on exit | — |
| QuickBooks Time | up / down / nearest, 1–30 min; default nearest minute; ships an FLSA warning | — | — | — | — | — |
| Buddy Punch | up / down / nearest, or "to the schedule" with before/after windows | via schedule rounding | — | — | yes | yes |
| Workyard | nearest 1–30 (global) | "Time limits" (Pro) | trim to last geofence exit (Pro) | auto-insert meal (Pro) | restrict clock-in (Pro) | facial photo (Pro) |
| Jobber | none | none | timer stops with the visit | — | location timers (Grow) | — |
| Housecall Pro | none | none | — | — | location prompts only | — |

Jobber and Housecall Pro have **no rounding at all**; it is a shift-work
feature. Everyone who rounds keeps the raw punch.

### The law

**US.** 29 CFR 785.48(b) accepts rounding "to the nearest 5 minutes, or to
the nearest one-tenth or quarter of an hour" only if it "will not result,
over a period of time, in failure to compensate the employees properly" —
the 7-minute rule. The trend is against it where exact records exist:
*Camp v. Home Depot* (Cal. Ct. App. 2022) — an employer that "can capture and
has captured the exact amount of time" must pay all of it; review granted
(S277518, Feb 2023), no decision found. Every US vendor ships a warning beside
the toggle. Break floors: CA 30-min meal >5 h + paid 10-min rest per 4 h, premium if
missed; WA, CO similar; OR 30 per 8 h + two 10s; IL 20 min within 5 h; NY
30-min noon meal only.

**Canada.** No statute mentions rounding; all three provinces require pay for
all time worked and a daily record of hours — Ontario ESA (kept 3 years), BC
ESA s.28 (4 years), Quebec LNT via CNESST ("if the employer asks to arrive 10
or 15 minutes before … this time must be remunerated"). Rounding that ever
takes a minute off a worker is a wage claim; rounding that only adds is a
gift. **Not advisable in Canada.** Meal floors: ON, QC, BC 30 min per
5 consecutive hours, unpaid unless the person must stay at the station; AB
30 min in a 5–10 h shift, two over 10 h.

### Proposal

A `TimeClockPolicy` per company (JSON), read by the punch route and the
timesheet, edited at **Settings → Time clock**.

| Rule | Default | Enforced at punch | Flagged only | Effort |
|---|---|---|---|---|
| Rounding: Off / Nearest 5 / 6 / 15 / In the worker's favour | **Off** everywhere. Opt-in shows the Camp/FLSA warning, plus "not recommended in Canada". No "round down" control — a dial that can only shortchange people is one we will not ship. Raw instants stay; `hours` rounds; export carries both. | at clock-out/switch | — | S |
| Earliest clock-in: Any / 0 / 5 / 15 / 30 min before a **published** shift | Any | Yes, 409 naming the shift start. No shift = no gate. | — | S |
| Late / early-out / no-show / forgot thresholds | today's constants | — | already flagged; expose | S |
| Auto clock-out | **Never** | — | keep the cron's question | — |
| Break check: entry > 5 h, no ≥ 30-min break | On for Canada and CA/WA/OR/CO/IL | — | amber on timesheet; manager confirms or adds the break. Blocking a clock-out is how you get a 19:00 punch typed by hand. | M |
| Location: stamp required to clock in on a job; punch > X m from the job address | Off / 300 m | stamp required = yes | distance = flag | M |
| PIN / photo | not built — no kiosk surface | | | — |

Rounding goes in `entryHours()` (already shared by all three clock-out
paths) plus a `roundingApplied` note on the entry.

**Recommendation: build — M, about two weeks. No rounding by default,
opt-in nearest-only with a warning; block early punches against a published
shift; flag breaks and distance, never block; never auto clock-out.**
Owner's word: **yes / no**.

---

## 2. Payroll provider / embedded payroll

### What exists

Gross → net from company-owned deduction rows (`computePayRun.js`; templates
CA/US/UK federal only, 2024), payslips, CSV export, Stripe Connect payouts. No
remittance, no filing. `Worker.payrollProviderEmployeeId` is written and read
by nothing; `lib/payroll/embeddedPayrollClient.js` is scaffolding against no
provider — dead code by AGENTS.md's standard.

### What Jobber and Housecall Pro actually do

- **Jobber**: a *sync*, not an embed — approved timesheets and expenses flow
  to Gusto; the contractor pays Gusto's price (Simple $49 + $6/employee/mo,
  Plus $80 + $12), three months free. US only; Gusto has no Canadian payroll.
- **Housecall Pro**: embedded "HCP Payroll", **powered by Check, not Gusto**
  (Check's case study: 45,000 customers, $100M+ wages). The brief's assumption
  is wrong for HCP. Price unpublished — sold by demo.

### The options

| Provider | Country | Model | List price | Notes |
|---|---|---|---|---|
| Gusto Embedded | US | embedded API | unpublished; norm $35–70 base + $6–10 PEPM, platform keeps ~2/3 | "basic production payroll in weeks" with two engineers (Gusto's claim) |
| Check | US | embedded | unpublished; same norm | what HCP runs on |
| **Salsa** | **US + Canada** | embedded (REST/GraphQL + UI kit) | unpublished | the only embed with Canadian payroll (June 2024, Mangomint); ROE and provincial WCB named; **Quebec/RQ unconfirmed** |
| Wagepoint | Canada | payroll app; **hours import CSV**; API by application | Solo $20 + $4, Unlimited $40 + $6 (CAD) | CRA + RQ remittances, T4, RL-1, ROE included |
| QuickBooks Payroll CA | Canada | payroll app; timesheet CSV import | reported $50 + $6.50 to $130 + $11 — Intuit's page renders no table | inside QBO, which contractors already have |
| PaymentEvolution | Canada | payroll app + open API | ~C$2–3.50/employee/run | oldest Canadian API |
| Knit People | Canada | payroll app | $40–50 + $6–8 | one source: not in Quebec (unverified) |
| Payworks / Humi / Rise / ADP | Canada | apps; APIs read-only or gated | quote / $30–49 + $3–8 | no embed |
| Deel / Remote / Justworks | both | EOR, $599/employee/mo | — | wrong product for a six-person painter |

### Liability

The **contractor stays the employer** in every model. A US embed files as a
reporting agent (Form 8655); the IRS says that "does not relieve the employer
from its responsibility", and the CRA treats a third-party remitter the same
way. FieldQuo is the platform, the provider the filer, the company the liable
party — who will still phone FieldQuo when a T4 is wrong. An embed needs a
support owner who understands payroll.

### Two paths

**(a) Export/sync — S, one week.** Two more formats on the existing CSV
route: Wagepoint's hours-import layout and QuickBooks Payroll CA's (Gusto's
for US companies). Make `payrollProviderEmployeeId` live as the employee key
those files need. Delete `embeddedPayrollClient.js`. No direct revenue; it is
what stops a company leaving for a tool that "does payroll".

**(b) Embedded — L, 3–6 months plus ongoing.** Check or Gusto for the US;
Salsa for both if its Quebec coverage checks out (a Quebec-first product
cannot ship Canadian payroll without RQ). Six-person company at the norm ≈
$40 + 6 × $8 = $88/mo, ~$58 to FieldQuo; fifty attached companies ≈ $35k/yr —
under the cost of the compliance owner it needs. Interesting at several
hundred, a later-phase number.

**Recommendation: (a) now; revisit (b) at 200+ companies running pay runs,
and talk to Salsa first because it is the only embed covering Canada.**
Owner's word: **export / embed**.

---

## 3. Custom named roles

### What exists

Two layers (`lib/permissions.js`): a 4-value tier enum every route floors on
(Owner/Administrator/Manager/Worker), and a per-person grid on
`Member.permissions` that `enforce.js` narrows with. Four presets are starting
points only — `describeAccess()` reverse-matches the grid, one moved dial reads
"Custom". `roleManagement.js`: assign only below yourself, grant only what you
hold (`clampPermissions`). Job titles are free text, separate.

### How the others model it

| Product | Model | Named custom roles? | Per-user override? | Paid tier? |
|---|---|---|---|---|
| Jobber | 4 presets + per-user custom | **No** | yes — that is the model | permissions "on select plans" (Connect and up) |
| Housecall Pro | Admin / Office Staff / Field Tech + checkboxes | No | yes | Advanced Reporting on MAX only |
| ServiceTitan | Settings → People → Role Permissions: create, assign to many | **Yes** | yes; a role re-save can wipe them (warned) | enterprise |
| Homebase | Employee / Manager / GM, edited per level company-wide | No | no | Manager/GM on Essentials+ |
| Connecteam | Owner / Admin / User; admins scoped by feature + group | No | per admin | deep permissions on Expert |

Only ServiceTitan has named roles. Jobber has what FieldQuo has now, gated.

### Proposal

```
model CompanyRole {
  id, companyId, name, tier MemberRole,  // the coarse floor a route checks
  permissions Json,                       // same shape as Member.permissions
  basedOn String?                         // preset key it started from
  @@unique([companyId, name])
}
Member.companyRoleId String?              // null = today's behaviour
```

- **Resolution in `enforce.js`**: per-person grid if it has keys → role's
  grid → tier. The tier enum stays (Better Auth and `can()` key on it).
- **Overrides kept.** "Lead painter, and Marc also sees job costing" is the
  real case; `describeAccess()` says "Lead painter (+1 change)".
- **Migration: nothing moves.** Existing grids stay; the four presets become
  seed rows; the dropdown reads Crew · Estimator · Dispatcher · Manager ·
  *your roles* · Custom. "Save as role" on any grid creates one.
- **Guards**: create/edit passes `clampPermissions` (rule 3) and
  `assignableRoles` (rule 1); `canGrantAccess` gates the screen. Editing a
  role re-clamps every member on it in one transaction, logged.
- **UI**: Settings → Team → Roles (list, edit, member count, delete only when
  unassigned).
- **Plan gate: no.** The dials are free today; a name for a set of dials is
  convenience, and Jobber gating it is a reason to be the one that does not.

**Recommendation: build — M, one to one-and-a-half weeks; keep overrides; no
gate.** Owner's word: **yes / no / gate**.

---

## Sources (all read 2026-09-13)

Clock rules — vendors: Homebase time-clock options and early clock-in
(support.joinhomebase.com/s/article/Settings-Time-Clock-Options; …/Labor-Control-Forecasting; …/PreventEarlyClockInFromBreaks65b94d9d23579; timeero.com/reviews/homebase-review) ·
When I Work (help.wheniwork.com/articles/how-timesheet-rounding-works/; …/attendance-settings/; …/restricting-when-users-can-clock-in-computer/) ·
Connecteam (help.connecteam.com/en/articles/6420265-time-clock-general-settings; …/10692218-auto-clock-out-employees-when-they-leave-a-worksite) ·
QuickBooks Time (quickbooks.intuit.com/learn-support/en-us/help-article/product-preferences/set-timesheet-rounding-quickbooks-time/L6C15B9YA_US_en_US) ·
Buddy Punch (docs.buddypunch.com/en/articles/3658460-how-to-set-up-punch-rounding) ·
Workyard (help.workyard.com/en/articles/12367059-time-clock-project-settings-new-accounts; …/11174299-time-tracking-settings; …/8440951-time-clock-rule-auto-trim-clock-out-by-geofence-exit) ·
Jobber (help.getjobber.com/hc/en-us/articles/7447924360855-Timers-and-Timesheets-in-the-Jobber-App) ·
Housecall Pro (help.housecallpro.com/en/articles/2795146-time-tracking-overview-guide).

Clock rules — law: 29 CFR 785.48 (law.cornell.edu/cfr/text/29/785.48) ·
Camp v. Home Depot, H049033 (law.justia.com/cases/california/court-of-appeal/2022/h049033.html; review S277518 status at gmsr.com/camp-v-home-depot-u-s-a-inc-s277518/; proskauer.com blog "dismantles rounding") ·
US state breaks (buddypunch.com/resources/lunch-break-laws-by-state/; clockify.me/learn/business-management/break-laws/) ·
Ontario ESA record-keeping and eating periods (ontario.ca/document/your-guide-employment-standards-act-0/record-keeping; achkarlaw.com/insights/ontario/are-you-legally-entitled-to-breaks-in-the-workplace/) ·
BC ESA s.28 and breaks (www2.gov.bc.ca/…/igm/esa-part-3-section-28; achkarlaw.com/insights/bc/workplace-break-laws/) ·
Quebec CNESST (cnesst.gouv.qc.ca/en/working-conditions/…/presence-work-breaks-and-weekly-rest-period; aubasdelechelle.ca/vos-droits-au-travail/normes-du-travail/3-la-duree-du-travail/) ·
Alberta (alberta.ca/hours-work-rest).

Payroll: Check × Housecall Pro (checkhq.com/partners/housecall-pro) · HCP Payroll onboarding (help.housecallpro.com/en/articles/9763189-hcp-payroll-onboarding-guide) · Jobber–Gusto (prnewswire.com "Jobber Partners with Gusto", 2023-09; support.gusto.com/article/230913112019060) · Gusto pricing (gusto.com/product/pricing; casrai.org/guides/gusto-pricing) · Gusto no Canadian payroll (workzoom.com/compare/workzoom-vs-gusto/) · Gusto Embedded build time (embedded.gusto.com/blog/tips-managing-embedded-payroll-integrations/) · embedded economics (openbankingtracker.com/embedded-finance/category/payroll; tidemarkcap.com/vskp-chapter/payroll) · Check US-only, Salsa Canada (payrollex.io/articles/embedded-payroll-apis.html; salsa.dev/blog-post/country-launch-announcing-salsas-embedded-payroll-solution-in-canada; businesswire 2024-06-19) · Finch pricing (merge.dev/blog/finch-api-pricing) · Wagepoint (wagepoint.com/pricing/; wagepointhelp.zendesk.com/…/1500000625081-Hours-import-CSV-integration; wagepoint.com/people/developer-api-agreement) · QuickBooks Payroll CA (milesopedia.com/en/small-business/quickbooks-payroll-canada/; hr.software/reviews/quickbooks-online-payroll) · PaymentEvolution (blog.paymentevolution.com/api-overview/; paymentevolution.com/pricing/business) · Knit People (getapp.ca/software/127827/knit) · Payworks/Humi/Rise (payworks.ca; softwarefinder.com/hr/humi; risepeople.com/pricing/) · ADP Run (adp.com/…/payroll-packages.aspx; forbes.com/advisor/business/software/adp-payroll-pricing/) · Deel/Remote (pin.com/blog/deel-pricing/; whichpayroll.com/pricing/remote) · IRS third-party arrangements and Form 8655 (irs.gov/government-entities/third-party-payer-arrangements-payroll-service-providers-and-reporting-agents) · CRA T4001 employer's guide (canada.ca/…/t4001-employers-guide-payroll-deductions-remittances.html).

Roles: Jobber (help.getjobber.com/hc/en-us/articles/115009568687-User-Permissions; getjobber.com/pricing/) · Housecall Pro (help.housecallpro.com/en/articles/1073431-employee-roles-permissions-explained) · ServiceTitan (help.servicetitan.com/how-to/set-permissions-for-role; …/set-permissions-for-an-individual-employee-or-technician) · Homebase (support.joinhomebase.com/hc/en-us/articles/360012113092-Customize-manager-permissions) · Connecteam (help.connecteam.com/en/articles/1981698-admin-permissions).
