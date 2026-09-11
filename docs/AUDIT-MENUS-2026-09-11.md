# Menu audit — is each screen a partial build? (2026-09-11)

The owner asked one question about every screen in the contractor app's menu.
Four read-only agents (plus their sub-audits) answered it against the code with
a strict definition: a control that writes what nothing reads, a fetch to a
route that does not exist, "coming soon" copy, a silent `res.ok` path, or copy
promising what the code does not do. Every finding carries a `file:line`.

**The owner's belief — "only the Designer is partial" — is not correct.** But
the pattern matters more than the count: almost nothing here is a missing
feature. It is fields saved and never read, copy that outran the code, and
three finished features sitting dark in production behind env vars.

## The one change that beats every code edit

`META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY` and
`UNSPLASH_ACCESS_KEY` are **not set in production** (`vercel env ls`).
Executed: `metaAppConfigured() === false`. That alone darkens:
- Designer → Publish, Calendar, scheduled posts (`CampaignEditor.js:505-524`)
- Designer → Stock photos tab (`ImageSidebar.js:170-176`)
- Marketing → "Connect your ad account to import spend" → dead end at `/app/settings/meta-ads`
- Messages (PREVIEW) → in prod reads `not_configured`, not "awaiting approval" — nothing can arrive or be sent

## Broken (a control whose success path does the wrong thing)

| Screen | What | Where |
|---|---|---|
| Quote reviews | "Approve at" an adjusted total writes `total = X; subtotal = X`, leaves `tax` and `lineItems` alone → homeowner's PDF does not add up ({6000, 780, 6780} → {7000, 780, 7000}) | `app/api/quotes/[id]/approve-estimate/route.js:69-73` |
| Designer | Settings "Frame" presets call `changeRatio` directly, bypassing the tab handler → a Story layout autosaves into the Square row | `SettingsSidebar.js:102`, `CampaignEditor.js:53-63` |
| Manage Team | Invitation-language picker is decorative: `PendingTeamProfile` stored AFTER `createInvitation` fires the email, and `teamInvite.js:111` looks up by `Company.id` where the org id is `authOrgId` — every invite goes out in English | `members/route.js:369,401`, `lib/email/teamInvite.js:111,121` |
| Language | `Company.defaultLanguage` never reaches the quote/invoice builders (`business-info` GET does not select it) → a French-default company's client with no language gets English documents | `QuoteBuilder.js:378,671`, `app/api/invoices/route.js:265` |
| Availability | Timezone hardcoded `America/Toronto` in the page and both routes → a Vancouver 9–5 is offered 6am–2pm Pacific | `availability/page.js:45`, `api/availability/route.js:111`, `api/working-hours/route.js:35` |
| Account & Billing | "Pause" retention offer sets `pause_collection: void` with no `resumes_at`, no resume control, no paused state in access → indefinite free access | `subscription/retention/route.js:162`, `lib/billing/retention.js:139-142` |

## Partial — written and never read (rule 1)

| Screen | Field | Writer | Reader |
|---|---|---|---|
| Invoices | `changeLog.reason` — REQUIRED on edit, "goes in the version history" | `[id]/route.js:380-384` | only `/versions` route, which no screen fetches |
| Jobs | `Job.costReviewNote` | `costing/review/route.js:89` | none |
| Jobs | `expectedUpdatedAt` stale-write guard | route parses it | no job screen sends it |
| Leads | `lostReason` — required, "tells a real inquiry from a wrong number in your numbers" | both lead routes | analytics never exclude `not_real_inquiry` |
| Clients | `installedAt`, `warrantyProvider`, `installedByJobId`, `warrantyNotes` on equipment | `lib/equipment/payload.js` | only the edit form |
| Your team | Invite "Personal information" block (photo, phone, address) → `Member.*` | `reconcilePendingProfile.js:30-43` | none; crew SMS reads `Worker.phone`, never copied |
| Your team | `laborCostPerHour` — hint says "used for job costing"; job costing reads `Worker.hourlyRate`; payroll uses it as a WAGE fallback | `new/page.js:481-503` | `buildPayRun.js:49-56` (wrong consumer) |
| Assign shifts | `Shift.jobId` — selected and rendered, no picker sends it | — | `scheduler/page.js:365` |
| Team calendar | "what's booked" omits published `Shift`s and assigned `JobVisit`s | — | `api/team/schedules/route.js` |
| Time Off | `reviewNote` rendered but the only caller sends `{ action }` | `time-off/page.js:561-565` | `:600` |
| Calendar | `PATCH {status}` accepted, nothing sends it → appointments stay "scheduled" forever; modal assignee select offered to roles the POST refuses; `clientPhone` in state with no input | `[id]/route.js:224`, `page.js:1286-1300,1199` | — |
| Company Settings | `TaxRate.isDefault` checkbox; fallback `Company.taxRate` has no editor | `tax-rate/route.js:46-58` | `resolveTaxRate.js:157` reads the OTHER field |
| Work Areas | `WorkAreaAssignment` chips | `route.js:124-133` | none |
| Products | `costPrice` — screen itself says "nothing reads it yet" | — | CSV export only |
| Account & Billing | `cancelReason` — "the only way we find out what to fix" | `cancel/route.js:54` | none |
| Services & Pricing | garage_door `doorSpec/installNote/warrantyNote` text fields — `sanitiseRates` coerces to Number and drops them on every save | `service-categories/route.js:421-422` | `tradeScope.js:791` would print them |
| Phone receptionist | `VoiceAgent.transferTo` — consumed for real by Retell's `transfer_call`, has NO input on the screen (commit 26b7159b assumed one existed) | — | `lib/voice/tools.js:364-374` |
| Your website | Uploaded photos → `photoLibrary`, never reaches generation or the gallery; service name/add/remove inert; no Unpublish control for the existing DELETE | `photos/route.js:155-167` | — |
| Reviews | "N showing on your website" true for the embed only; hosted site shows testimonials only after regeneration | `Testimonials.js:16-19` | `SiteBlocks.js:1068` |

## Partial — copy promises what the code does not do (rule 6)

- Insights: "{count} quotes in your region this quarter" — query has no region, date or currency filter (`pricingBenchmark.js:50-56`)
- FieldQuo AI: subtitle promises "material costs"; no tool reads them; `findJob` says expenses aren't job-linked — `Expense.projectId` exists
- Marketing: "including an automatic import from Meta Ads" — dead end in prod; paid campaigns are record cards
- Data Migration: subtitle promises "quotes, invoices and jobs" — only clients & quotes are written; "we'll be in touch" — no notification exists in either direction
- Refer & Earn: reward also requires Stripe Connect; copy says "paying customer"; SMS invites can never show "Signed up"
- Activity Log: "team changes", "pricing" — role changes and product price edits write no row
- Branding: neutral "email header bar" applies to campaign emails only, not quote/invoice emails
- Assign shifts: missing-hours banner promises a payroll check that does not exist
- Phone receptionist: port-a-number card still says "We'll email you what your provider needs" in nine catalogues — nothing sends it (`appMessages.js:4435` etc.)
- Instant Quotes: the ESTIMATE EMAIL hardcodes `$` and "CAD" (`estimateEmail.js:63,103`)
- Home: `RevenueGoalCard` formats `"$" + n` ignoring company currency (`RevenueGoalCard.js:23-28`)

## Security, found in passing

- `POST /api/products` connects `categoryIds` with no tenant filter
  (`app/api/products/route.js:141-143`); PATCH on the same model applies
  `usableCategoryIds()` for exactly this reason (`[id]/route.js:30-42`). A
  hand-posted create can attach another tenant's custom quote type. One-line fix.
- `PATCH /api/leads/[id]` returns the raw row without `redactLead`
  (`[id]/route.js:154-163`) while GET redacts — a `name_address_only` member
  gets email/phone/budget back in the response.
- `/api/designer/remove-bg` fetches whatever `image` URL it is handed;
  the sibling `/api/designer/generate` refuses non-upload URLs (`isUploadedUrl`).

## Dead controls for real presets (the headline rule)

- Invoices: "New Invoice", Send, Request payment, Edit, Record payment are all offered to Estimator/Dispatcher presets whose routes 403 them (`invoices/page.js:120-126`, `[id]/page.js:544-591`). Quotes fixed this at `quotes/page.js:44-57`; invoices did not.
- Invoices: due date cannot be cleared (`edit/page.js:192` sends `undefined` = leave alone)

## Complete (verified, no findings under the rules)

Expenses · Purchasing · Vehicles · KPIs · Funnels · Receptionist (call log) ·
Crew inbox · Refer & Earn (mechanics) · Help · Plan · Product Updates ·
Time Off Policies · Booking Page · Services & Pricing (bar the garage_door
text fields) · Overhead · Cabinet rates · Material costs · Instant Quotes
(screen) · Share your links / Bio link · Service Plans · To-do · Jobs (three
small honesty gaps) · Quotes · Client equipment

## Honest partials (declared on the screen — fine)

Custom Fields (Coming soon panel, `FIELDS_REACH_RECORDS = false`) ·
Payroll (says it does not pay or file) · Messages (PREVIEW) · AI employee (PREVIEW)

## Designer specifically (the one the owner named)

Real fabric.js editor, five ratios autosaved per row, PNG/JPG/SVG/JSON export,
"download all formats", AI headline/caption, AI image + background removal
metered against credit, approval gate, IG/FB publish with a real cron. What is
partial: the frame-preset corruption above; publish/calendar/stock dark in
prod (env); two generic sample templates (`prisma/seed-design-templates.js`),
no trade templates; "Remove background" is a square re-render via
`images.edit` without `background: "transparent"`; orphan duplicate route
`app/api/marketing/designer/images/`; three stale headers claiming the vendor
isn't wired; **the entire editor chrome is English-only** in a nine-language
app (`Sidebar.js`, `Navbar.js`, `Toolbar.js`, every sidebar).

## Settings part 2 — Documents, Messaging, Getting paid (16 screens: 9 complete, 7 partial)

**Broken-adjacent, real dead controls:**
- Email Templates: the **Active star is read by no sender** (`[id]/activate/route.js` writes `isDefault`; follow-ups use `rule.template`, campaigns use `campaign.template`). Templates of type `quote_email`, `receipt_email`, `instructions_email` can be created, edited, activated, seeded — **and nothing sends them** (quote send uses `buildQuoteEmail`; invoice send uses `invoiceEmail.js`). Header copy: "The template marked Active for each type is the one that's actually sent" (`email-templates/page.js:183-185`) — false for three of the types. `featureMatrix.js:40-42` already documents this and excludes it from marketing; the in-app screen still promises it.
- Payroll: a percent-of-gross or banded **earning** saves, lists as "10% of gross", and **pays $0** — `buildPayRun.js:248` pushes `entry.amount ?? 0`, set only for `calculation === "fixed"`.
- Expense Tracking: Runway KPI says "Add cash on hand to estimate"; the only input is a `?cashOnHand=` query param no UI sends. Permanently "—".
- Payments: `Company.paymentMethods` (cash / e-transfer / cheque) is read by the client portal and the voice prompt, accepted by the API — **no page writes it**. Every homeowner sees the schema default.

**Copy-only:** PDF Templates' invoice blurb "Attached to invoices and payment requests" — the send route deliberately links the portal instead, zero attachments. Translations subtitle says unreviewed drafts are held back; `resolveProductText` uses them identically. Client messages offers an `{eta}` token the sender never fills.

**Verified complete:** Quote Email · Checklists · Job photo tags · Client messages · Follow-ups · Notifications · Email Domain · AI credit · SettingsSidebar (all 39 hrefs resolve).

**AI employee "Loading…"**: fixed in `95646169` — `Promise.all` left `loading` true on any refused load; now `allSettled` + `finally` + an error state with Retry. Tables exist, GET responds. Preview state is deliberate (Meta `page_messaging` approval).

**Post-audit note:** the appointment-reminder and on-my-way SMS observations above (English-only, `en-US` date, reminder bypassing `renderMessage`) were fixed in `c4ccb9aa` after this audit ran.

## Pending

Time clock / Timesheets / Time Off / Safety: sub-audit ran (one finding — Time
Off `reviewNote` never sent, listed above); parent compilation pending.
