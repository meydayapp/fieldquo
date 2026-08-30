# Nav audit: what every page does, who can reach it, and how it's grouped

Produced before regrouping either sidebar, per the owner's instruction:
"make sure you understand what everything does each page so that you can
properly categorize them." Every `page.js` listed below was opened and read,
not inferred from its filename or route.

Scope note on counts: AGENTS.md says "roughly 62 `/app` pages, 12 `/platform`
pages." The filesystem has 93 `page.js` files under `app/app/` and 23 under
`app/platform/` once every dynamic/edit/new sub-route is counted (e.g.
`invoices/[id]/edit`, `jobs/[id]/visits/new`, `settings/team/payroll`). The
difference is drill-in workflow steps — reached by a button on their parent
list/detail page, never by their own nav entry. This audit covers every
**nav-reachable or nav-adjacent** page (the ~62 + ~12 AGENTS.md means) in
full, and lists the remaining drill-ins at the bottom of each section without
a full role/feature breakdown, since they inherit their parent's gating and
were never candidates for a sidebar row.

Columns:
- **Reached by** — the sidebar nav key that links here, or how else a user
  gets to it if it has no nav row of its own.
- **Role gate** — from `lib/permissions/nav.js` (`NAV_REQUIREMENTS`) for
  `/app` main-rail rows, or `lib/permissions/settingsAccess.js`
  (`SETTINGS_ROW_CAPABILITY` / `SETTINGS_ROW_REQUIREMENTS`) for
  `/app/settings/*` rows. "—" means no rule exists, which per both files'
  documented failure posture means **shown to everyone**, not "ungated" —
  the underlying API/page may still refuse; see the file's own comments.
- **Feature flag** — from `lib/features/registry.js`, the entry whose
  `routePrefixes` covers this page. "—" means no feature owns this route (it
  ships unconditionally).

---

## `/app` — main pages (reached from `AdminSidebar.js`)

| Route | What a user does here | Reached by | Role gate | Feature flag |
|---|---|---|---|---|
| `/app` | Home dashboard: revenue/quotes/conversion KPIs, money-owed aging with one-click chase, revenue trend, recent quotes, upcoming appointments, onboarding checklist. | Home | — | — |
| `/app/leads` | Kanban board of inbound leads (new/contacted/converted/lost), scored hot/warm/cold; open a card for scoring reasons, assign, log a callback, convert to a draft quote. | Requests | `requests` view_only | — |
| `/app/leads/import` | Bulk-import leads from a CSV, scored and filed like normal inbound leads. | Linked from Leads ("Import") | inherits Leads | — |
| `/app/quotes` | List/search quotes with status tiles. | Quotes | `quotes` view_only | — |
| `/app/quotes/new` | Build a new quote from scratch. | Quotes → New / Quick Add | `quotes` view_create_edit (quick-add) | — |
| `/app/quotes/[id]` | Full quote document view — send, convert to job, delete, edit. | Linked from quotes list, clients, leads, dashboard | `quotes` view_only to open | — |
| `/app/quote-approval/[id]` | Mint/manage a quote's public approval link, see what the client did with it, record a decision given verbally. | Linked from a quote's detail page | inherits Quotes | — |
| `/app/estimate-reviews` | Approve/adjust website-generated instant estimates before the underlying quote can be sent. | Quote reviews | role owner/admin/supervisor | `instant_quotes` (config only; this page itself is ungated by a routePrefix) |
| `/app/jobs` | List/search/filter jobs, including an archived view; scoped to "my jobs only" for some roles. | Jobs | `jobs` view_only | — |
| `/app/jobs/new` | Create a new job for a client, optionally recurring. | Jobs list, client page, Quick Add | `jobs` view_create_edit (quick-add) | — |
| `/app/jobs/[id]` | The job the crew works from — visits, checklist, materials, costing, photos, tasks, client contact. | Linked from clients, quotes, invoices, appointments | `jobs` view_only to open | — |
| `/app/invoices` | List/search invoices with status and outstanding-amount tiles. | Invoices | `invoices` view_only | — |
| `/app/invoices/new` | Build a new invoice: client, line items, tax, due date, optional job-costing detail. | Invoices list, Quick Add | `invoices` view_create_edit (quick-add) | — |
| `/app/invoices/[id]` | Full invoice document view, lifecycle banners, linked job/visits/hours/payroll panel, cost-vs-quote panel — send, record payment, download, delete. | Linked from invoices list, dashboard, clients, jobs | `invoices` view_only to open | — |
| `/app/plans` | List recurring service plans, with real payment-authorization status per row. | Plans | `invoices` view_only (plans share the invoices grid) | — |
| `/app/plans/new` | Sell a new recurring service plan — service, price, frequency, term. | Plans list ("New") | inherits Plans | — |
| `/app/plans/[id]` | One plan's billing history, ask-for-payment-method flow, cancel. | Linked from Plans list | inherits Plans | — |
| `/app/appointments` | Company-wide calendar of appointments/visits/bookings; assign, claim, travel-time warnings, manager team-schedule panel. | Calendar | — | — |
| `/app/tasks` | Internal to-do list (follow-ups, ordering material, chasing deposits), sorted by urgency. | To-do | — | — |
| `/app/clients` | List/search all clients. | Clients | `clientsProperties` full_view | — |
| `/app/clients/new` | Create a new client (homeowner or company). | Clients list, Quick Add | `clientsProperties` full_edit (quick-add) | — |
| `/app/clients/import` | Bulk-import clients from a CSV. | Clients list ("Import") | inherits Clients | — |
| `/app/clients/[id]` | View/edit one client's contact & language info; jump to their quotes/jobs/invoices. | Linked from clients list and many other pages | inherits Clients | — |
| `/app/settings/team` | View/manage the company roster: invite, edit roles/access, view last-active. | Your team | role owner/admin/supervisor | — |
| `/app/scheduler` | Draft and publish weekly work shifts (day-grouped); workers see only their own published shifts. | Team calendar (scheduler) | — | — |
| `/app/schedule` | Read-only manager view of the whole team's weekly availability. | Team calendar | role owner/admin/supervisor | — |
| `/app/clock` | An hourly worker's own time clock: punch in/out, see today's hours. No pay math. | Time clock | — | — |
| `/app/settings/team/timesheets` | Review/approve **everyone's** time entries; log or delete manual entries for any worker. Distinct from the personal `/app/clock` screen. | Timesheets | `timeTracking` view_record_edit_all | — |
| `/app/time-off` | Request/withdraw time off, see your balance; managers get a Team tab to approve/decline. | Time Off | — | — |
| `/app/payroll` | Two views by permission: managers build pay runs; everyone else sees only their own payslips. | Payroll | — (own payslips always visible; the manager view is implicitly grid-gated by the page itself) | — |
| `/app/payroll/[id]` | One pay run: every payslip line, approve it, record it as paid outside FieldQuo (FieldQuo never transfers wages). | Linked from Payroll list | inherits Payroll | — |
| `/app/settings/expense-tracking` | Log/categorize/report business expenses, export accounting data. | Expenses | `expenses` view_record_edit_all | — |
| `/app/analytics/benchmark` | Hub page: compares company pricing to the anonymized platform average, and links out to Digest, Statements, Win-loss and Estimate accuracy. | Insights | toggle `showPricing` | — |
| `/app/analytics/kpis` | One dashboard of sales/profit/execution/cash KPIs for a chosen period. | KPIs | toggle `jobCosting` | `kpi_dashboard` |
| `/app/analytics/digest` | Auto-generated monthly performance summaries (text + flags + metrics) per period. | Linked only from the Insights hub — no nav row of its own | inherits Insights | — |
| `/app/analytics/statements` | P&L, cash flow, sales-tax-charged and partial balance sheet, cash or accrual basis. | Linked from the Insights hub and the KPI dashboard's AR panel | inherits Insights | — |
| `/app/analytics/win-loss` | Quote win/loss counts, win rate, time-to-decision, verbatim loss reasons, win rate by estimator. | Linked from the Insights hub only | inherits Insights | — |
| `/app/analytics/estimate-accuracy` | Estimated vs. actual labour hours/cost/materials on completed jobs, segmented by trade/size/client/crew. | Linked from the Insights hub and the KPI dashboard | inherits Insights | — |
| `/app/marketing` | List/create marketing campaigns (pamphlet distribution, meta ads, email blast, other). | Marketing | role owner/admin/supervisor | `marketing_campaigns` |
| `/app/marketing/[id]` | One campaign's detail — route tracking or email campaign detail depending on type. | Linked from Marketing list | inherits Marketing | `marketing_campaigns` |
| `/app/marketing/subscribers` | Manage the email-blast recipient list. | Linked from Marketing list / email campaign detail | inherits Marketing | `marketing_campaigns` |
| `/app/funnels` | List all lead funnels, create from a template or AI prompt, delete. | Funnels | role owner/admin/supervisor | `funnels` |
| `/app/funnels/[id]` | Build/edit one funnel with a live preview; publish, copy link/embed, view drop-off analytics, set ad pixels. | Linked from Funnels list | inherits Funnels | `funnels` |
| `/app/receptionist` | Review AI phone receptionist call log — flagged/urgent first, per-call cost, recordings, convert calls to draft quotes/appointments. | Receptionist | `clientsProperties` full_view | `voice_receptionist` |
| `/app/crew-inbox` | Triage crew photos/texts: file to a job, see unknown senders, provision/manage the crew SMS line. | Crew inbox | — (feature-gated instead) | `crew_inbox` |
| `/app/settings/refer` | Get the referral link, send invites, see which referred companies converted and how much credit was earned. | Refer & Earn | role owner/admin | — |
| `/app/copilot` | Chat with FieldQuo AI about the company's own quotes/invoices/clients/material costs. | FieldQuo AI | — (permission-gated by showPricing inside the page) | `ai_copilot` |
| `/app/help` | In-app help center / knowledge base. | Help | — | — |
| `/app/settings/account-billing` | View/change the FieldQuo subscription plan, seats, payment card, cancel the account. | Plan | role owner/admin | — |
| `/app/settings` | Redirects to `/app/settings/company`. | Settings | — | — |
| `/app/activity` | Read-only audit log of who did what (sends, payments, hours, client/team/settings changes). | Activity Log (settings sidebar only — **not** in the main rail) | `owner-admin` | — |

**Drill-ins, not separate nav destinations** (reached only by a button on the page above them; inherit that page's gating): `invoices/[id]/edit`, `jobs/[id]/edit`, `jobs/[id]/visits/new`, `quotes/[id]/edit`, `quotes/[id]/kitchen`.

**Misleading-name check:** none of the pages above misrepresent what they do.
The one near-miss is `/app/analytics/benchmark` — its nav label is
"Insights" and the page itself is genuinely a benchmark comparison, but it
is *also* the hub every other analytics page hangs off, which its filename
alone doesn't suggest.

**Reachability finding:** `digest`, `statements`, `win-loss` and
`estimate-accuracy` have no sidebar row. All four are reachable only through
links the benchmark hub page added inline (its own comments describe this as
a deliberate fix for pages that previously "worked and were linked from
NOTHING"). They are not unreachable today, but they are one hub-page rewrite
away from becoming unreachable again, since nothing enforces those inline
links. See the Insights group rationale below for why this audit did not
turn all six into separate nav rows.

---

## `/app/settings/*` (reached from `SettingsSidebar.js`)

| Route | What a user does here | Company-wide or per-member? | Capability gate |
|---|---|---|---|
| `account-billing` | View/change the FieldQuo plan, seats, card; cancel the account. | Company-wide | `billing` |
| `refer` | Referral link, invites, which referred companies converted, credit earned. | Company-wide | `billing` |
| `product-updates` | Read FieldQuo's own changelog. | N/A — informational | `everyone` |
| `company` | Company profile, **public opening hours** (`businessHours`), tax/regional settings, quote scope/payment terms; separate read-only card for per-user booking availability. | Company-wide, with one explicitly-separate per-user card | `user:manage` |
| `branding` | Logo, primary/secondary/neutral brand colours. | Company-wide | `user:manage` |
| `language` | Your own interface language; company-default language if you hold `user:manage`. | Both — two clearly labeled cards | `everyone` (grid decides which card is editable) |
| `activity` | Company-wide action audit trail. | Company-wide | `owner-admin` |
| `team` | Roster: invite, edit roles/access, view last-active. | Company-wide | `user:manage` |
| `availability` | Your own working hours + bookable hours; a manager can pick a teammate instead. | Per-member (self by default) | `everyone` |
| `leave` | Leave policies: accrual method, roll-over. | Company-wide | `owner-admin` |
| `booking-page` | Public booking page: visit types, durations, notice window, deposit/hold fee. | Company-wide | `user:manage` |
| `work-areas` | Zones/projects and who's assigned. | Company-wide | `workarea:assign` |
| `products` | Product/service price catalogue. | Company-wide | `everyone` + grid `showPricing` |
| `services` | Trades/services offered, pricing basis, quote wording. | Company-wide | `everyone` + grid `showPricing` |
| `material-costs` | Real material coverage rates/costs for the internal cost & margin estimate. | Company-wide | `user:manage` + grid `jobCosting` |
| `cabinet-rates` | Cabinet-pricing rates for the kitchen quote builder. | Company-wide | `user:manage` |
| `overhead` | Fixed costs, salaries, debt payments — the price floor. | Company-wide | `user:manage` + grid `jobCosting` |
| `custom-fields` | Custom field definitions (Gate code, PO number, etc.) shown on every record. | Company-wide | `user:manage` |
| `quote-email` | Optional quote-email sections: reference customers, before/after photos. | Company-wide | `user:manage` |
| `email-templates` | All company email templates, one "Active" per type. | Company-wide | `user:manage` |
| `templates` | PDF layout templates (section order) for quote/invoice attachments. | Company-wide | `user:manage` |
| `translations` | Correct machine-drafted translations of product/service names & descriptions. | Company-wide | `user:manage` |
| `checklists` | Company job-visit checklists, or copy from FieldQuo's per-trade library. | Company-wide | `user:manage` |
| `messages` | Wording of automated client SMS (e.g. "on my way"). | Company-wide | `user:manage` |
| `follow-ups` | Automation rules ("N days after trigger, send template"). | Company-wide | `user:manage` |
| `notifications` | Internal large-quote alerts; client appointment-reminder SMS lead time. | Company-wide | `owner-admin` |
| `email-domain` | Connect/verify the company's own sending domain. | Company-wide | `user:manage` |
| `payments` | Stripe Connect payout account: connect, open dashboard, disconnect. | Company-wide | `billing` |
| `expense-tracking` | (Same page as the main-rail Expenses row.) | Company-wide | `everyone` + grid `expenses view_record_edit_all` |
| `payroll` | Deduction/earning components, tax bands, pay cycle. | Company-wide | `payroll` |
| `website` | AI-assisted website builder with a live preview of the public site. | Company-wide | `user:manage` (feature: `website_builder`) |
| `instant-quotes` | Public instant-estimate rate card per trade. | Company-wide | `everyone` + grid `showPricing` (feature: `instant_quotes`) |
| `lead-form` | Shareable links (quote request, booking, instant quote, funnels) and embed snippets. | Company-wide | `user:manage` |
| `links` | Public "bio link" page config. | Company-wide | `user:manage` |
| `voice` | AI phone receptionist setup: buy a number, greeting script, forwarding. | Company-wide (shared credit balance) | `user:manage` (feature: `voice_receptionist`) |
| `reviews` | Automatic review-request emails; testimonials shown on the website. | Company-wide | `user:manage` |

**Drill-ins, not separate sidebar rows** (reached from a button on `team`, inherit its `user:manage` gate): `team/new`, `team/workers`, `team/payroll`. Also not separate rows: `email-templates/[id]` (edit one template), `product-updates/[slug]` (read one changelog entry), `templates/[id]/edit` (edit one PDF template) — all drill-ins of the row above them.

**Misleading-name check, and the historical bug pattern named in AGENTS.md:**
none of the 36 rows reproduce the "Business Hours" mislabeling. `company` is
in fact the page where that exact bug was fixed — it carries inline comments
documenting the old confusion and now cleanly separates "Opening hours"
(public, company-wide, editable here) from "Booking availability" (per-user,
read-only summary here, edited on `availability`). `availability` and
`language` make the same personal/company split explicitly on their own
screens.

---

## `/platform` (reached from `PlatformSidebar.js`)

| Route | What FieldQuo staff does here | FieldQuo's own data or a customer's? | Misleading name? |
|---|---|---|---|
| `/platform` | Dashboard: MRR/revenue, growth, plan mix, trial pipeline, system-health banners, plus a separate tenant-health tab. | FieldQuo's own revenue (primary); aggregate customer metrics (separate tab, by design — a documented fix for a prior mislabeling bug). | No |
| `/platform/companies` | Search/filter/browse every company, click through to detail. | Customer list, view-only. | No |
| `/platform/companies/[id]` | Full company detail: billing, usage, phone numbers, read-only company-record mirror, health, history, team, plus read-only "View account" impersonation and Suspend/Reactivate. | Customer's own data (explicitly read-only), except the Suspend/Reactivate toggle — a genuine write to `Company.onboardingStatus`, audit-logged as `company_suspended`. | No, but flagged: this is the one write path onto a customer's own record in the whole console. Worth the product owner confirming it's the sanctioned exception to non-negotiable #3, not a stray one. |
| `/platform/billing/subscriptions` | Every company's subscription status, MRR, trial/lapse risk, billing gaps. | Customer billing data, view-only. | No |
| `/platform/reports` | CSV exports: growth, all companies, subscriptions. | Aggregated customer data, exported read-only. | No |
| `/platform/feedback` | Triage bug/feature/billing feedback: change status, add internal notes. | Customer-submitted content; staff edits metadata only. | No |
| `/platform/errors` | View/acknowledge a queue of backend failures (email, Stripe, PDF, AI, webhook, upload, cron). | Operational/system data. | No |
| `/platform/billing/plans` | Create/edit/delete FieldQuo's pricing plans. | FieldQuo's own pricing. | No |
| `/platform/billing/promotions` | Time-boxed discount rules across the plan ladder, with a live preview. | FieldQuo's own pricing. | No |
| `/platform/features` | Set global/per-company feature-availability state (on/preview/locked/hidden). | FieldQuo's own feature-gating data (targets specific companies, but is not their data). | No |
| `/platform/promo-codes` | Generate/revoke influencer & tester referral codes. | FieldQuo's own growth tool. | No |
| `/platform/demo` | Manage sales demo fixture companies: reset data, switch industry, enter as owner, create a login. | Fixture data (`Company.isDemo`), not a real customer. | Somewhat — "Demo accounts" reads like customer accounts; the sidebar's own `exact` comment already flags the confusion with `/demos` and `/demo-availability`. |
| `/platform/demos` | View/manage (mark done/cancel) demo bookings made by prospects. | FieldQuo's own sales pipeline. | No, but easily confused with `/platform/demo` — same note as above. |
| `/platform/demo-availability` | Edit FieldQuo staff's own availability windows for the demo-booking calendar. | FieldQuo's own sales calendar. | No |
| `/platform/ai-usage` | FieldQuo's own OpenAI token spend by company/feature; sets a per-company AI token cap. | Mostly FieldQuo's own cost data; the cap it writes is an operational limit, not customer content. | No |
| `/platform/sales-agent` | FieldQuo's own phone sales agent: readiness chain, prompt/knowledge, call transcripts, tone toggles. | FieldQuo's own phone agent — explicitly not the tenant receptionist. | No |
| `/platform/crew-lines` | FieldQuo's own Twilio number estate: holder, webhook drift/orphans; buy new numbers. | FieldQuo's own vendor account. | No |
| `/platform/voice-numbers` | FieldQuo's own Retell number estate: billed numbers, holder, orphaned/duplicated. | FieldQuo's own vendor account, view-only re: tenant impact. | No |
| `/platform/voice-webhooks` | Where Retell is actually posting call events for each agent, and a repair action when it's pointed at a dead deployment. | FieldQuo's own vendor/webhook configuration. | No, but it **was unreachable**: shipped with only a conditional link from the phone-pool alert banner on `/platform` (`app/platform/page.js`, shown only `if (voiceHealth.alerts.some(webhook-related))`). When that alert wasn't firing there was no way in at all — the exact "reachable from NOTHING" failure class. Fixed this pass: added as its own row in `PlatformSidebar.js`'s "FieldQuo's own systems" group, next to Voice numbers. |
| `/platform/service-categories` | Add entries to the global service-category catalogue every company's onboarding reads from. | FieldQuo's own shared catalogue (affects every tenant's onboarding options). | No |
| `/platform/audit-log` | Read-only feed of platform staff's own actions (impersonation, suspensions, edits). | FieldQuo's own staff-action record. | No |
| `/platform/help` | Internal support runbook. | FieldQuo's own knowledge base. | No |
| `/platform/team` | Create/deactivate FieldQuo staff accounts, set roles. | FieldQuo's own internal staff accounts. | No |
| `/platform/login` | Sign-in for FieldQuo staff. | N/A — auth screen; hides the sidebar entirely. | No |

**Note on permission gating:** unlike the two `/app` sidebars, no row here is
individually role-filtered — `/platform` access itself is superadmin-only,
enforced in `middleware.js` and `lib/currentMember.js` per non-negotiable #2.
Nothing found in this audit suggests a second tier of platform roles that
would need per-row hiding today.

---

# Regrouping: before and after

## `/app` main rail (`AdminSidebar.js`)

**Before** (already reorganized in an earlier pass — Work / People / Money /
Grow):

- **Work** (pinned): Requests, Quotes, Quote reviews, Jobs, Invoices, Plans,
  Calendar, To-do
- **People**: Clients, Your team, Team calendar, Timesheets, Time Off
- **Money**: Payroll, Expenses, Insights, KPIs
- **Grow**: Marketing, Funnels, Receptionist, Crew inbox, Refer & Earn

**After** — one change: **Insights split out of Money into its own group**,
placed between Money and Grow:

- **Work** (pinned) — unchanged
- **People** — unchanged
- **Money**: Payroll, Expenses
- **Insights** *(new)*: Insights (→ benchmark hub, which links to Digest,
  Statements, Win-loss, Estimate accuracy), KPIs
- **Grow** — unchanged (Marketing Designer's future nav row belongs here,
  directly after Marketing — see the comment left in the source)

**Why:** Payroll and Expenses are things a contractor RUNS — clicking them
moves money. Insights and KPIs are things a contractor READS — a lens over
quotes, jobs and invoices that changes nothing by itself. AGENTS.md already
draws this line for the whole product ("Analytics reads the whole thing.
Settings configures it."), so filing the read-only half under "Money" was a
mislabel, not a simplification. The new group holds only two rows on
purpose: `/app/analytics/benchmark` is a hub that already fans out to four
more analytics pages via in-page links, and giving each of those six screens
its own sidebar row would trade one clutter problem for another. KPIs keeps
its own row because it was previously built and unreachable — the exact
"nobody could find it" failure this codebase has hit before.

## `/app/settings/*` panel (`SettingsSidebar.js`)

**Before** (already reorganized in an earlier pass — 8 groups, 36 rows):

- **Account**: Account & Billing, Refer & Earn, Product Updates
- **Business**: Company Settings, Branding, Language
- **Team & scheduling**: Manage Team, Availability, Time Off Policies,
  Booking Page, Work Areas
- **Services & pricing**: Products & Services, Services & Pricing, Material
  Costs, Cabinet Pricing, Overhead, **Payroll**, Custom Fields
- **Documents & messaging** *(9 rows)*: Quote Email, Email Templates, PDF
  Templates, Email Domain, Translations, Follow-ups, Notifications, Client
  messages, Checklists
- **Getting paid**: Payments, Expense Tracking
- **Client-facing**: Your website, Instant Quotes, Share your links, Bio
  link, Phone receptionist, Reviews
- **Records** *(1 row)*: Activity Log

**After** — three changes, same 36 rows redistributed across 8 groups:

1. **Records (1 row) folded into Business.** A group holding exactly one row
   is the "group that shouldn't exist" the task's own rule names. The
   company's action history sits with the company's own identity.
2. **Documents & messaging (9 rows) split by what the row IS**, matching the
   same rule in the other direction ("nine is usually two"):
   - **Documents & templates**: Quote Email, Email Templates, PDF Templates,
     Translations, Checklists — things that sit still until someone opens
     them.
   - **Messaging & alerts**: Client messages, Follow-ups, Notifications,
     Email Domain — things that fire on their own schedule, or configure
     where a message comes from.
3. **Payroll moved from Services & pricing to Getting paid.** A deduction
   rate isn't a price charged to a client — it's money moving the *other*
   way, the same shelf as Payments and Expense Tracking, not the price book.

Result:

- **Account** (3): Account & Billing, Refer & Earn, Product Updates
- **Business** (4): Company Settings, Branding, Language, **Activity Log**
- **Team & scheduling** (5) — unchanged
- **Services & pricing** (6): Products & Services, Services & Pricing,
  Material Costs, Cabinet Pricing, Overhead, Custom Fields
- **Documents & templates** (5): Quote Email, Email Templates, PDF
  Templates, Translations, Checklists
- **Messaging & alerts** (4): Client messages, Follow-ups, Notifications,
  Email Domain
- **Getting paid** (3): Payments, Expense Tracking, **Payroll**
- **Client-facing** (6) — unchanged

## `/platform` console (`PlatformSidebar.js`)

**Before**: one flat list of 21 rows in ship order, no headers, no
collapsing. Individual placement decisions were already reasoned about in
per-row comments (Promotions next to Plans, Sales agent next to AI usage,
Demo availability next to Demo bookings) but nothing grouped them.

**After**: Dashboard stays outside every group (same treatment as
`AdminSidebar`'s Home row), and the other 20 rows split into six labeled,
always-open sections:

- **Companies** (3): Companies, Subscriptions, Reports
- **Support** (2): Feedback, Errors
- **Billing** (4): Plans, Promotions, Features, Promo codes
- **Demos & sales** (3): Demo accounts, Demo bookings, Demo availability
- **FieldQuo's own systems** (4): AI usage, Sales agent, Crew lines, Voice
  numbers
- **Admin** (4): Service categories, Audit log, Support runbook, Platform
  team

**Why this shape:** grouped by the job a FieldQuo staffer is doing, same
principle as the two `/app` sidebars. "FieldQuo's own systems" is the one
group worth calling out explicitly — every row in it is a vendor account or
outbound line FieldQuo itself pays for, never a customer's data, and keeping
that boundary visible in the group label (not just in per-row comments
nobody reads until something breaks) is the point of grouping it apart at
all. No collapse/disclosure was added: 20 rows in six short groups reads
fine without it, and `check-sidebar.mjs` doesn't exercise `/platform` at
all, so building fold/remember machinery here would be untested surface area
the audit didn't ask for.

---

# Uncertain calls, named honestly

- **`/app/analytics/{digest,statements,win-loss,estimate-accuracy}`** stay
  off the main rail, reachable only through the Insights hub's in-page
  links. This keeps the rail from growing to 28 items, but it means their
  reachability depends on nobody rewriting the hub page without preserving
  those links — there's no automated check tying "the hub links to these
  four" together the way `check-sidebar.mjs` ties nav rows to translations.
  If a future audit disagrees, promoting all four to first-class rows under
  Insights is the direct fix.
- **`/app/settings/checklists`** — filed under "Documents & templates" on the
  reasoning that it's a template filled in on a job visit rather than mailed
  out. It could just as defensibly sit under "Team & scheduling" (it's about
  how a crew executes a visit, not what gets sent to a client). Went with
  Documents because every other row in that group is "a form of words the
  company reuses," which a checklist also is — but this is a closer call
  than the rest of the regroup.
- **`/app/settings/custom-fields`** stayed in Services & pricing rather than
  moving to Business, even though "extra fields on a record" isn't really
  pricing. Left it because splitting it out would make a seventh settings
  group of one row (the exact problem this audit fixed twice elsewhere), and
  no existing group was a clearly better fit.
- **`/platform/companies/[id]`'s Suspend/Reactivate action** — flagged above,
  not fixed. It's the one write path onto a customer's own `Company` row in
  the whole platform console. It reads as the sanctioned "we can suspend
  abusive accounts" exception (audit-logged, and non-negotiable #3 is about
  a company's *quote* data specifically), but confirming that with the
  product owner is a decision this audit can surface, not make.

---

# Follow-up sweep (2026-08-30) — features shipped since the regroup above

The regroup above landed. Several features shipped afterward, and the owner's
complaint — "things get built and nobody can navigate to them" — had
reoccurred at least once. This pass re-swept both `app/app/page.js` and
`app/platform/page.js` (the original audit only enumerated the latter's
sidebar, never mechanically checked it for gaps the way `check-nav-audit.mjs`
does for `app/app`) and reconciled against `docs/TODO.md`.

**Found and fixed:**

- **`/platform/voice-webhooks` was unreachable when it mattered most.** Built
  to fix "the phone-pool warning named a fault and offered no way to fix it,"
  it was linked ONLY from that same warning banner on `/platform`'s dashboard
  — a conditional link, shown only while `voiceHealth.alerts` contains a
  webhook-related message. No sidebar row existed. The moment nobody's
  webhook was broken, the page had no path in at all — you'd have to already
  know the URL. Added as its own row in `PlatformSidebar.js`'s "FieldQuo's
  own systems" group, directly after Voice numbers (same vendor account,
  same "what is Retell doing with this account" question, just the
  delivery-endpoint half of it rather than the numbers-billed half).

**Confirmed already fixed by the features that shipped them** (no further
action — verified by reading the actual sidebar source and the page each row
points at, not inferred from a commit message):

- `/app/marketing/designer` — has its own row in `AdminSidebar.js`'s Grow
  group (`app.nav.marketingDesigner`), placed directly after Marketing per
  the comment left for it in the original regroup.
- `/app/settings/ai-credit` — has its own row in `SettingsSidebar.js`'s
  "Getting paid" group (`app.settings.aiCredit`), next to Payments and
  Expense Tracking — the same "money moving" shelf, which is where a credit
  top-up belongs.
- `/app/settings/expense-tracking/import` — reached via an "Import from bank
  CSV" button in the Expense Tracking page's own header row
  (`app/app/settings/expense-tracking/page.js`), sitting directly beside the
  primary "Add expense" button. Not buried — it's the second thing on the
  page.
- `/app/analytics/kpis` — already has its own row in the Insights group, not
  folded into the hub. A money-flow section is landing on this page from
  another agent's work in parallel with this sweep; per instruction, that
  work was left alone. The row stays prominent (own sidebar entry, not a
  drill-in) so the page keeps being findable as it grows.

**Reachability net widened.** `scripts/check-nav-audit.mjs` previously only
walked `app/app/` for orphan pages — `app/platform/` had no equivalent
mechanical check, which is exactly the gap that let `/platform/voice-webhooks`
ship unreachable in the first place. It now walks both trees: every
`app/platform/**/page.js` must be a `PlatformSidebar.js` href, a named
`PLATFORM_DRILL_INS` entry (a button on another platform page), or a named
`PLATFORM_EXCLUSIONS` entry (an auth screen with no nav path by design). Both
new assertions were mutation-tested — see the session report for which break
each one caught (removing the new sidebar row; a stale exclusion entry for a
renamed route; a brand-new page with no link anywhere).
