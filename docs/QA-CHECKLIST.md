# FieldQuo — QA & UX Review Checklist

A pre-launch test plan. Each item is a flow to exercise with **steps** and the
**expected result**. Test on desktop **and** a real phone (or 375px width) —
the client-facing surfaces are used in driveways, not at desks.

**Legend:** ☐ not tested · ✅ pass · ❌ fail (file a bug with steps + screenshot)

**Two audiences, test both:**
- **Back office** (`/app`) — the contractor's staff view.
- **Client-facing** (`/q`, `/book`, `/portal`, `/quote`, `/site`, `/embed`, PDFs, emails) — a stranger with no account, on a phone.

**White-label rule (check on every client-facing surface):** the homeowner must
never see "FieldQuo" branding except the small "Site by FieldQuo" footer on free
websites. Any other leak is a bug.

---

## 0. Setup / environment
- ☐ App builds and loads; no console errors on first paint of `/app`, `/`, `/q/<token>`.
- ☐ Neon cold start: first request after idle may retry once — confirm no hard `P1001` surfaced to a user.
- ☐ A demo account is available with sample clients, quotes, jobs, invoices (see `npm run seed:demos`).

## 1. Auth & onboarding
- ☐ **Signup** (`/signup`): company name, plan, address → Stripe checkout → lands in `/app`. Header says **"first month free"** (not "$1").
- ☐ Referral link (`/signup?ref=<code>`): shows "3 months free" banner only for a valid code.
- ☐ **Login** (`/login`): valid creds → `/app`. Wrong creds → clear error, no crash.
- ☐ `/login?next=/q/<token>` → after login, lands back on that quote (internal paths only; `?next=//evil.com` must be ignored).
- ☐ **Invite a teammate** (Settings → Team): invited user can accept and sign in; role limits what they see.
- ☐ Platform admin cannot be self-created (invite/manual only).

## 2. Quotes
- ☐ **Create** (`Quotes → New`): pick client, add service groups + line items; total updates live; Save as draft.
- ☐ **Send** ("Save & send"): client receives an email; quote status → `sent`; `sentAt`/`sentToEmail` recorded. (A "Send" that changes status but emails nobody = BLOCKER.)
- ☐ **Client approves** (`/q/<token>`): reads the branded quote, ticks add-ons (total updates), signs, approves → status `accepted`; a **job is created**.
- ☐ **Client declines**: status `declined`; contractor notified.
- ☐ **Add-ons pricing**: client only posts add-on IDs; the server reprices — the browser never sends amounts. Confirm the accepted total matches server figures.
- ☐ **Expired / already-decided** quote link: shows a settled/expired state, not the approve buttons.
- ☐ **Edit** an open quote: change lines, save; totals persist on reload; `taxEnabled` toggle actually sticks.
- ☐ **PDF**: matches the on-screen quote exactly (same lines, same total, same branding).
- ☐ **Language**: a quote created in FR stays FR; the covering email matches the document language.

## 3. Contractor-to-contractor quotes (NEW — test thoroughly)
Set up: two companies, A (subcontractor) and B (general contractor).
- ☐ A sends a quote to B (B is a **company**-type client). B opens `/q/<token>` while signed in.
- ☐ **Contractor panel** appears below the quote for B; a **homeowner** (individual client) sees **no panel** (white-label intact).
- ☐ B imports it: pick one of B's open quotes, set markup (10/20/30/custom), blended/itemised → "Add to my quote".
- ☐ On B's quote, a **Subcontractor costs** section shows cost + markup = client price. B's client-facing quote shows the **marked-up** line only (never A's price or the markup).
- ☐ **Edit markup** (pencil): client price + quote total update; the **cost stays the same**.
- ☐ **Remove** (trash): line and total revert; can re-import a different bid ("swap the loser").
- ☐ **Editor**: the imported group renders **read-only** with a note; hand-editing isn't possible there; the total still includes it; saving the quote keeps the import linked.
- ☐ **Sub side** (A's quote detail): "Used in another company's quote" → **Pending their client's approval**. A sees **no markup/price**.
- ☐ B's client approves B's quote → A's status flips to **Confirmed**; the subcontractor cost appears as a **job expense** on B's job (Settings → Expense tracking, filtered by that job).
- ☐ B's client declines → A shows **Not proceeding**.
- ☐ **On-ramp**: a logged-out contractor sees "Start free / Sign in"; after auth they return to the quote to import.
- ☐ **Isolation**: confirm via the API that A can never retrieve B's markup/client price (`/api/quotes/<A's quote id>/imports` returns `asSource` only, no cost/markup).

## 4. Invoices & payments
- ☐ **Convert** an accepted quote → invoice: line items and total match what the client approved (incl. add-ons).
- ☐ **Send** invoice: client gets it with a **Pay** button.
- ☐ **Pay** (`/portal/<token>` or invoice email): Stripe checkout in the **company's currency**; success returns; invoice → paid; payout goes to the company.
- ☐ **Deposit / partial**: a client who paid 50% is billed the **balance**, not the full amount again.
- ☐ **Record a manual payment** (cash/e-transfer): balance updates; invoice reflects it.
- ☐ **Affirm financing (NEW)**: with `offerFinancing` on (Settings → Payments) and an eligible invoice ($50–$30,000, USD/CAD), Affirm appears next to card at checkout. With it **off**, only card. If Affirm isn't activated on Stripe, the pay link **still works** (card only) — never a broken link.
- ☐ Settings → Payments financing toggle: flips optimistically and **persists** on reload (a toggle that reverts = bug).

## 5. Jobs & scheduling
- ☐ Accepted quote → job appears in Jobs (unscheduled).
- ☐ Schedule a visit; assign a worker; the worker sees it in Schedule/Clock.
- ☐ **Recurring job**: set a cadence; the next visit is created automatically; editing one occurrence doesn't rewrite others.
- ☐ **Clock in/out** (mobile): hours recorded; visible in Timesheets.
- ☐ On-site: add notes + photos to a visit.

## 6. Clients
- ☐ Add a client (individual and company types).
- ☐ Import clients (CSV): validation + de-dupe.
- ☐ Client portal (`/portal/<token>`): shows their quotes/invoices; pay works; no other tenant's data.

## 7. Booking & leads
- ☐ **Online booking** (`/book/<slug>`): pick a service, an estimator, a slot → confirmation + calendar invite. Slots respect availability + travel buffer.
- ☐ **Self-quote / instant estimate** (`/quote/<slug>`): returns services + intake fields, **never rates**. Submitting creates a lead/quote.
- ☐ **Lead form** + **embed** (`/embed/<slug>/<book|quote>`): the copy-paste iframe loads and reports height on an external page.
- ☐ Leads pipeline: a submitted lead appears and can be worked.

## 8. Website builder & tenant sites
- ☐ Generate a site; multi-page menu renders (Services/Work/Book/FAQ/Contact).
- ☐ Regenerate does **not** destroy uploaded photos.
- ☐ Tenant site at `<slug>.fieldquo.com` (or the site route): loads with no session prompt; header nav works; booking/quote/contact function.
- ☐ Reserved subdomains (`app`, `www`, etc.) cannot be claimed by a tenant.

## 9. Team, payroll & time
- ☐ Add a worker; set pay rate; payroll run reflects hours + rate (the overhead-salary path reaches the payslip).
- ☐ Timesheets total correctly; time-off requests flow.
- ☐ Availability + shifts: a schedule change shows up in booking/slots.

## 10. Money management
- ☐ Record an expense; tie it to a job vs. mark overhead; restricted members see only their own.
- ☐ Overhead settings affect quote pricing.
- ☐ Materials/rates feed cost estimates on quotes.

## 11. FieldQuo AI
- ☐ Ask about your own quotes/jobs/invoices — answers use **your** data only.
- ☐ Declines general-assistant requests and never references another tenant.
- ☐ Quota: usage is metered; over-quota degrades gracefully.

## 12. Settings (spot-check each saves AND applies)
- ☐ Branding (logo/colour) → appears on client documents; contrast holds on hostile colours (yellow/white/black).
- ☐ Email domain → verified sends from the company address; unverified still sends (shared address).
- ☐ Language (app UI) → actually changes the interface.
- ☐ Regional (currency/timezone/date format/week start) → applied where shown.
- ☐ Business hours → drives the public "open now" + site hours; a partial week is not padded into an invented Mon–Fri.

## 13. Platform console (superadmin only)
- ☐ Can **view** any company's data; can **edit nothing** on it.
- ☐ Impersonation is **read-only** (write attempts blocked in middleware AND `currentMember`).
- ☐ Health banners (email/AI) surface real outages.

## 14. Cross-cutting
- ☐ **Mobile 375px**: no horizontal scroll; the sidebar's bottom section doesn't overlap; tap targets ≥ 40px.
- ☐ **Error handling**: kill the network mid-action on 3 key flows (send quote, pay, import) — each shows a clear error, not a silent no-op or a spinner forever.
- ☐ **i18n**: switch client language; emails + portal + documents follow it.
- ☐ **Contrast**: any client-facing text/background pair ≥ 4.5:1 across brand colours.
- ☐ **No dead controls**: every button does the thing it says; no `Coming soon` rendered as if active.

---

## Known limitations / out of scope for this launch
- **No per-job P&L view** — job costs are recorded (Settings → Expense tracking, filterable by job) and feed analytics, but there is no single per-job margin dashboard yet.
- **Sub notifications are passive** — a subcontractor sees "selected/confirmed" when they open their quote; there is no email/push nudge yet.
- **No received-quotes inbox** — a GC imports from the emailed quote link; there is no central list of quotes other contractors have sent them.
- **Signup→import return** works after Stripe checkout completes; if a signup is abandoned mid-checkout, the return isn't preserved.
- Marketing site does not yet headline **financing** or the **contractor network** as features (FAQ mentions financing).

## How to file a bug
Title · area · steps to reproduce · expected vs. actual · screenshot · device/browser · severity (Blocker/High/Medium/Low). Blockers stop launch; High = fix before GA; Medium/Low = backlog.
