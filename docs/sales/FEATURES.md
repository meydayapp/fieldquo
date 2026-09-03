# FieldQuo — feature reference for salespeople

Everything FieldQuo actually does, and — just as important — the things a
competitor's deck would list that FieldQuo does **not** do.

## How to use this document

**A rep who knows the limits sells better than one who is surprised by them.**
Every "Partial" row below carries a sentence saying exactly where the feature
stops. Those sentences are not disclaimers to be buried; they are the reason a
contractor believes the rest of the page. Read them out loud on a call. The
public feature pages already show them to strangers — you will not be revealing
anything.

**Where this comes from.** The tables are generated from
`lib/marketing/featureMatrix.js`, which is not marketing copy: it is a list of
claims, each carrying the route or library that implements it, and
`npm run check:feature-matrix` **fails the build** when a proof path stops
existing or stops containing what the claim says. Delete a route and the
sentence about it goes red instead of quietly becoming a lie.

The limit sentences are pinned to `app/i18n/featurePages/en.js`, and
`scripts/check-feature-pages.mjs` asserts they stay character-identical.

**As of this writing: 76 features, 9 of them partial, 12 explicit exclusions.**

---

## The single most useful fact about our pricing

**Solo, Crew, Shop and Scale differ in how many people they seat and what they
cost, and in nothing else.** Every rung gets the AI receptionist, the website,
the AI quote review, the payouts, all of it. All 76 features are `every_plan`.

This is asserted by `check:feature-matrix` against `SEAT_LADDER` itself, so the
day a rung gains a feature the claim fails rather than going stale.

It is an unusual answer and the temptation is to invent a difference, because a
comparison grid with a tick in every cell looks broken. **Do not invent one.** A
dash in the Solo column is a promise that Solo does not get something, and
there is no code anywhere that makes it true.

| Tier | Billable seats | Free crew | People | Price / month |
|---|---|---|---|---|
| Solo | 1 | 5 | 6 | 99 |
| Crew | 3 | 8 | 11 | 169 |
| Shop | 6 | 11 | 17 | 269 |
| Scale | 10 | 15 | 25 | 369 |

`lib/pricing/ladder.js`, `SEAT_LADDER`.

**Say the number without a currency.** A Canadian pays 99 in Canadian dollars
and an American 99 in US dollars — it is the same number, not a conversion, and
currency is decided by the signup address, never by a picker (a currency
selector on a subscription is an arbitrage button). This is also the rule
FieldQuo's own inbound phone agent follows in `lib/platform/salesKnowledge.js`.

**A seat is not a job title.** A seat is somebody whose *permissions* let them
originate money — read off the permission grid, not the role label, because an
owner can call twenty estimators "Crew" and still hand each one quote-editing
rights. Crew are free because they cost almost nothing to serve.

**The first month is free.** `TRIAL_PRICE = 0` in `lib/pricing.js`. Write it as
"Free first month", never "$0 first month" — that reads like a bug.

**Annual: pay for ten months, get twelve** (`ANNUAL_FREE_MONTHS = 2`, 16.7%).
Deliberately less than the competitor's ~29%, because this ladder already
undercuts them on the monthly rate.

**Two real caps exist and no shipped rung uses them.** `Plan.maxQuotesPerMonth`
is genuinely enforced but empty on every rung, so no plan limits how many quotes
you write. **`Plan.aiCopilotEnabled` is printed on the public pricing card and
enforced nowhere** — unticking it would remove a line from the pricing page and
change nothing about who can use the assistant.

---

## The features
<!-- Tables below generated from lib/marketing/featureMatrix.js -->

### Winning the work (29)

Everything between a stranger hearing your name and a signed price: where the enquiry comes from, what you send back, and how fast.

| Feature | What it does | Gate | State |
|---|---|---|---|
| **Lead tracking** | Every enquiry in one list, scored hot to cold, with a one-click turn into a quote. | — | Shipped |
| **Lead form for your website** | A form you can drop on any site; what comes back lands in your leads list, not an inbox. | — | Shipped |
| **Quotes** | Build a quote from your own rates, group it by room or scope, and add photos. | — | Shipped |
| **Good, better, best options** | Send one job at three prices and let the client pick the one they want. | — | Shipped |
| **Send a quote by email** | One button emails the quote from your address, with the PDF attached, in the client's language. | — | Shipped |
| **Quote PDF in your colours** | A PDF that carries your logo and brand colour — nothing on it says FieldQuo. | — | Shipped |
| **Client approves and signs online** | The client opens a link, picks any extras, signs, and the job is on — no printing, no phone tag. | — | Shipped |
| **AI quote review** | Before you send it: what you forgot, how the price sits against the ones you have won, and clearer wording. | — | Shipped |
| **Suggested add-ons** | Optional extras at the bottom of the quote, priced from your own history, that the client can tick. | — | Shipped |
| **Automatic follow-ups** | A quote that goes quiet gets chased on your schedule, in your words, without you remembering. | — | Shipped |
| **AI receptionist** | Answers your phone when you are on a ladder, takes the details, books the visit, and leaves you the recording. | `voice_receptionist` | Shipped |
| **Confirmation calls** | The assistant rings ahead to confirm tomorrow's appointments so you do not lose the morning to no-shows. | `voice_receptionist` | Shipped |
| **Quote drafted from the call** | What the caller described comes back as a draft quote you open, correct and send. | `voice_receptionist` | Shipped |
| **Online booking page** | Clients pick a slot from your real availability, with travel time and arrival windows built in. | — | Shipped |
| **Take a deposit to hold the slot** | Charge a visit fee at booking and credit it against the invoice when the work goes ahead. | — | Shipped |
| **Your own website** | A site written from what you already told us, on your own address, that you can edit block by block. | `website_builder` | Shipped |
| **Instant online estimate** | A visitor answers a few questions and gets a price range on the spot, from rates you set. | `instant_quotes` | Shipped |
| **Clients can price their own job** | A public form where a homeowner describes the work and uploads photos; it arrives as a started quote. | — | Shipped |
| **Kitchen and cabinet designer** | Draw the run, pick the finishes, and the cabinet prices and the floor plan go straight into the quote. | — | Shipped |
| **Measure from the sky** | Type the address and get roof area and pitch, or trace a driveway or patio, without going out there. | — | Shipped |
| **Lead funnels** | Multi-step landing pages for an ad or a flyer, with numbers on where people drop out. | `funnels` | Shipped |
| **Email campaigns** | Write once, send to your client list from your own address, and see who it reached. | `marketing_campaigns` | Shipped |
| **Door-hanger routes** | Plan the streets, assign them, and tick off the stops as your crew works the neighbourhood. | `marketing_campaigns` | **Partial** |
| **Review requests** | After the job is done and paid, the client gets one polite ask for a review. | — | Shipped |
| **Testimonials on your site** | Collect what clients said and show it on your website and in your quotes. | — | Shipped |
| **Refer another contractor** | Send an invite; when they sign up you both get a free month added to your account. | — | Shipped |
| **Drop-in widgets** | Paste one line into any website you already have to embed your booking, quote form or reviews. | — | Shipped |
| **One link for your profiles** | A single branded page for your Instagram or truck decal that points at everything you offer. | — | Shipped |
| **Subcontractor prices in your bid** | Pull a sub's quote straight into yours as a cost, mark it up, and your client sees only your price. | — | **Partial** |

**Limits in this group — say these out loud:**

- **Door-hanger routes.** FieldQuo plans and tracks the route. It does not print the door hangers or arrange delivery — you supply the printed material.

- **Subcontractor prices in your bid.** This works when the subcontractor is also on FieldQuo and sends you their quote link. There is no list of the subs you use, no way to put one on a job or a visit, no way to pay the company whose price you took, and no insurance or tax-form tracking.


### Doing the job (17)

Getting the right person to the right address with the right information, and knowing what the job actually cost you.

| Feature | What it does | Gate | State |
|---|---|---|---|
| **Jobs** | An approved quote becomes a job with the scope, the address and the paperwork already on it. | — | Shipped |
| **Scheduling and dispatch** | Put visits on the calendar, assign the person going, and see the whole crew's week at once. | — | Shipped |
| **Crew shifts** | Build next week's rota, publish it, and everyone sees their own shifts. | — | Shipped |
| **Repeat jobs** | Weekly, monthly or seasonal work that puts itself back on the calendar. | — | Shipped |
| **Appointment reminders** | The client gets a text before you arrive, so fewer doors are locked when you get there. | — | **Partial** |
| **Clients reschedule themselves** | A link in the confirmation lets the client move the visit without ringing you. | — | Shipped |
| **Job costing** | Labour, materials and expenses against the price you quoted, so you know what you actually made. | — | Shipped |
| **Materials on the job** | What went on site, what it cost, and what is still to buy. | — | Shipped |
| **Before and after photos** | Photos filed against the job, ready to go into the quote, the invoice or your website. | — | Shipped |
| **Job checklists** | A list of what has to be done on site, ticked off by the person doing it. | — | **Partial** |
| **Suggested next steps** | The job proposes the tasks a job like this usually needs, so nothing gets forgotten. | — | Shipped |
| **To-do list** | Everything that needs chasing, sorted by what will hurt most if you leave it. | — | Shipped |
| **Work areas** | Break a big job into rooms or zones and hand each one to a different person. | — | Shipped |
| **Clock in and out** | Crew clock on against the job they are on, from whatever phone they have. | — | Shipped |
| **Timesheets you approve** | Hours land tied to real jobs; you approve them before they can turn into pay. | — | Shipped |
| **Crew inbox** | Your crew text photos and updates to one number and they file themselves against the right job. | `crew_inbox` | Shipped |
| **Time off and holidays** | Requests go to the right manager, balances build up on their own, and the calendar knows. | — | Shipped |

**Limits in this group — say these out loud:**

- **Appointment reminders.** Reminders go by text message only. There is no email reminder, and the reminder wording is not editable yet — the on-my-way message is.

- **Job checklists.** Checklist templates are pulled in when you create a visit from the visit screen. A visit created any other way starts with an empty list.


### Getting paid (9)

Invoicing that mirrors your quote, payment the client can make from their phone, and the money landing in your account.

| Feature | What it does | Gate | State |
|---|---|---|---|
| **Invoices** | An approved quote turns into an invoice that looks like the quote, because it is built from it. | — | Shipped |
| **Send an invoice** | Emailed from your address with the PDF attached and a pay-now link inside. | — | Shipped |
| **Changed invoices, tracked** | Amend an issued invoice and the old one is kept, so there is never a question about what was agreed. | — | Shipped |
| **Get paid by card** | The client pays from their phone and the money goes to your account, not ours. | — | Shipped |
| **Your own payout account** | Connect your bank once; every client payment settles into it directly. | — | Shipped |
| **Let clients pay monthly** | Turn on pay-over-time at checkout for the big jobs homeowners put off. | — | **Partial** |
| **Maintenance plans** | Sign a client up to a recurring plan and the card is charged on schedule without you asking. | — | Shipped |
| **Client portal** | One link where a client sees their quotes, invoices and what they still owe. | — | Shipped |
| **Sales tax that matches the address** | Set your rates once; the right one lands on the document for where the work is. | — | Shipped |

**Limits in this group — say these out loud:**

- **Let clients pay monthly.** Pay-over-time is offered at checkout through Stripe, where the lender decides. FieldQuo does not lend and does not approve anyone. The monthly figure shown on a quote appears only if you enter your own rate and term — we never invent one.


### Running the business (21)

Your numbers, your people, your prices, and your name on every document the homeowner sees.

| Feature | What it does | Gate | State |
|---|---|---|---|
| **Dashboard** | What is quoted, won, scheduled and owed, on one screen, as of this morning. | — | Shipped |
| **Your break-even price** | What a day has to bring in before you make a cent, worked out from your real overhead. | — | Shipped |
| **How your prices compare** | Where your rates and your win rate sit against other shops in your trade — nobody named, including you. | — | Shipped |
| **Monthly write-up** | Once a month, your numbers explained in sentences instead of charts. | — | Shipped |
| **Revenue goal** | Set a target for the year and see how far ahead or behind you are. | — | Shipped |
| **Expenses and overhead** | Record what you spend, split what belongs to a job from what belongs to the business. | — | Shipped |
| **What your advertising is worth** | Log what you spend by channel — including an automatic import from Meta Ads — and see a blended cost per lead across everything you do to bring in work. | `marketing_campaigns` | **Partial** |
| **Payroll** | Approved hours become a pay run with payslips you can hand over or export for your accountant. | — | **Partial** |
| **Pay contractors from the app** | Approved hours for someone on your roster marked as a contractor go out as a real transfer to their bank. | — | **Partial** |
| **Your price book** | Your services and rates in one place, importable from a spreadsheet and exportable back out. | — | Shipped |
| **Material costs and recipes** | What a litre of paint or a sheet of ply costs you, and how much of it a job of this size eats. | — | Shipped |
| **Team roles and access** | Decide, dial by dial, what each person can see and change — and it holds on the server, not just on screen. | — | Shipped |
| **Everything carries your name** | Your logo and your colour on every quote, invoice, page and email a homeowner sees. | — | Shipped |
| **Email from your own address** | Verify your domain once and everything goes out from you, not from a shared address. | — | Shipped |
| **Write your own covering email** | Change what the quote email says, section by section, and it stays in the language the quote was written in. | — | Shipped |
| **Your own quote and invoice layout** | Choose which sections appear on the printed document, and which one is the default. | — | Shipped |
| **Your terms on every document** | Payment terms and contract wording that attach themselves to what you send. | — | Shipped |
| **English and French** | Send a quote in the language your client speaks; a signed document keeps the words it was signed with. | — | **Partial** |
| **Ask FieldQuo AI** | Ask a question about your own business in plain English and get the answer from your own numbers. | `ai_copilot` | Shipped |
| **Who changed what** | A running record of every send, edit and approval, with a name and a time against it. | — | Shipped |
| **Client list** | Every client, their properties and their history, imported from wherever it lives now. | — | Shipped |

**Limits in this group — say these out loud:**

- **What your advertising is worth.** Cost per lead is blended across every channel, not broken out per channel or per campaign — nothing in FieldQuo links a specific dollar of spend to a specific lead yet.

- **Payroll.** FieldQuo works out gross pay, produces the payslips and exports the run. It does not pay employees or file your payroll taxes — deductions are the ones you or your accountant supply.

- **Pay contractors from the app.** This pays a person on your own roster, for hours they clocked, at the rate you set. It cannot pay a fixed bid to another company. Transfers are sent in Canadian dollars today, so it is not ready for a US payout.

- **English and French.** English and French are finished. Spanish, Ukrainian, Punjabi and Tagalog are translated and still being checked by a speaker, so they are not switched on yet.




---

## What FieldQuo does NOT do

**This is the most valuable page in this document.** Every row below is
something a competitor's deck lists, or something a contractor will reasonably
assume, and which FieldQuo either does not have or has not wired up. Promising
any of them is how a refund and a support thread start.

The three worth memorising, because they come up constantly:

1. **There is no mobile app.** None, on any store. The back office is
   responsive and works in a phone browser — that is a different sentence and
   it is the only one you may say. Every competitor we compare against ships
   real iOS and Android apps, and our own comparison pages concede it.
2. **There is no demo a prospect can look at.** Nothing self-serve. The seeded
   sandbox tenants are FieldQuo's own, for staff to show on a call.
3. **The receptionist cannot transfer a call to a person.** No warm transfer.
   A column for it is saved and nothing reads it.

### The full exclusion list

| Not a feature | Why |
|---|---|
| **A marketing design canvas with AI image tools** | The editor (app/components/designer/) is built and its spend gate is real, but no /app page mounts DesignerLoader yet — see that file's own comment — and the AI actions have no vendor wired behind them (lib/designer/aiImageAdapter.js's TODO seam, pending a sibling worktree's lib/ai/images.js). Claiming this on a public page before a contractor can actually open the screen is the exact promise-before-the-product failure this file exists to catch. Move this into the table once DesignerLoader is reachable from a real page. |
| **Publishing an ad straight from the designer to Instagram or a Facebook Page** | A Publish control is built (app/components/designer/PublishModal.js) and the container-then-publish flow it calls (lib/social/) is real code, but there is no Meta app connection behind it yet — lib/social/metaConnection.js always reports not connected, honestly, until a sibling worktree's per-tenant Meta OAuth lands. Even once it does, Meta's own instagram_content_publish and pages_manage_posts permissions require App Review and Business Verification, both unstarted and each measured in weeks, not days. Claiming a working publish-to-social feature before a contractor can actually connect an account and Meta has approved the app is the exact promise-before-the-product failure this file exists to catch — see docs/SOCIAL-PUBLISHING.md for the full state and what's blocked. |
| **A phone application** | There is no application to install, on any store. The back office is responsive and works in a phone browser, and that is the only claim that may ever be made about it. Nothing in this file may say otherwise. |
| **A self-serve trial you can look at before signing up** | There is nothing a visitor can start and look around. The seeded sandbox tenants and the booking routes under app/api/demo belong to FieldQuo's own sales calls, are not sold to anybody, and must never be described on a public page as something a visitor gets. |
| **Custom fields on jobs, clients and quotes** | The settings screen saves field definitions and nothing anywhere reads the values, so a required field is never rendered, collected or printed. Excluded until something reads it. See app/api/custom-fields/route.js. |
| **Custom email templates chosen by an Active flag** | Setting a quote or receipt email template Active moves a badge; the real send uses lib/email/quoteEmail.js and lib/email/invoiceEmail.js and never reads it. The covering-email wording that IS editable is claimed above as quote_email_wording. |
| **One inbox for Google, Thumbtack and Angi leads** | Not built. It needs a signed-in account with each marketplace before any of it can be written or tested, and docs/ROADMAP.md records the decision to wait rather than ship an untested integration. |
| **Importing your Google reviews** | Researched and blocked on Google's own approval, not on our code. Review requests are claimed above; importing what Google already holds is not, and must not be implied by the review-request row. |
| **Transferring a call to a person** | The receptionist cannot hand a caller over to you mid-call. A column for it is saved but no screen offers it and nothing in lib/voice reads it, so the receptionist row must not imply a warm transfer. |
| **A paid, closer AI read of a quote's own photos** | Real and shipped — app/components/quotes/SuggestAddOns.js — but it is an in-context upsell inside the quote builder, priced per use in AI credit, not a plan-tier differentiator a painter compares Solo against Scale on. It belongs next to the quote it reviews, not on this table. |
| **Generating marketing images with AI** | The generation endpoint is built and gated (lib/ai/images.js, app/api/marketing/designer/images/route.js) but the canvas editor a contractor would actually use is separate, unshipped work, and the registry entry defaults to hidden until it lands. Naming it here would claim a product surface nobody can reach yet. |
| **The KPI dashboard** | Shipped and reachable in the app (app/api/analytics/kpis, app/app/analytics/kpis) — win rate, margin, on-time completion, what's owed. Excluded here because no public /features page has been written for it yet; claim it once one exists rather than pointing this row at a page that doesn't. |

---

## Competitors

Grounded in `lib/marketing/competitors.js` and the five pages under
`app/(marketing)/compare/`. Five comparisons exist, all English-only by
decision:

| Page | Competitor | What we actually claim |
|---|---|---|
| `/compare/fieldquo-vs-jobber` | Jobber | No single Jobber price — it moves on team size × billing. Their AI receptionist is a $29/mo add-on at one user, otherwise in the $599/mo Plus tier. |
| `/compare/fieldquo-vs-housecall-pro` | Housecall Pro | Their top tier's call to action is Book Demo, not a trial. (Basic and Essentials **are** self-serve — say so.) |
| `/compare/fieldquo-vs-servicetitan` | ServiceTitan | They publish no price. Every tier says Request Pricing. |
| `/compare/fieldquo-vs-projul` | Projul | Annual only — all three tiers priced annually. |
| `/compare/fieldquo-vs-quoteiq` | QuoteIQ | Starts at $29.99/mo for one user against our $99 floor. Every QuoteIQ user is a paid login; our crew seats are free. |

### The rules the code enforces on you

These are not style preferences. `lib/marketing/competitors.js` refuses to
publish a figure that breaks them, and you should hold yourself to the same
bar on a call.

- **Every figure carries a source URL, a check date and a vantage point.** All
  observations were made from a **US** egress. Jobber is Canadian and may serve
  CAD in Canada — a Canadian prospect's Jobber price has not been verified.
- **`STALE_AFTER_DAYS = 90`.** Figures checked 2026-08-28 stop publishing on
  **2026-11-27**; QuoteIQ's on 2026-11-28. After that the compare pages empty
  themselves and say "last checked N days ago". **If the page is blank, the
  data is stale — do not quote the number from memory.**
- **Promotions never publish.** Jobber's "Save up to 40%" promo ended
  2026-08-31 and is already expired.
- **ServiceTitan's dollar figures are third-hand** — a video summary and a
  Reddit thread. They are permanently `UNVERIFIED`, live in `reportedCosts`
  rather than `figures`, and are **not rendered on the compare page at all**.
  They appear only on `/cost`. Reported bands: $245–500 per technician per
  month, plus a $5,000–50,000 one-time implementation fee. **Present these as
  what users report, never as ServiceTitan's price.**
- **Projul's currency is asserted by the owner, not read from their page.**
  Their HTML contains no dollar code and no instance of the word "dollars".
- **Projul's feature list is owner-relayed and unverified.**
- **No currency conversion happens anywhere, ever.**

### Concessions we make in our own material — make them first

A concession you volunteer is credibility; the same fact discovered by the
prospect is a lost deal.

- Housecall Pro's own included-plan list gives them a **free iOS/Android app**,
  **offline viewing** and a **free demo** — all verified verbatim from their
  page.
- Projul gets six concessions: demo, mobile app, Gantt charts, QuickBooks sync,
  purchase orders, daily logs and photo reports, geofencing.
- QuoteIQ and Jobber both ship mobile apps.
- **`entry_price_below_our_floor` is `has: false` for FieldQuo** — a structural
  concession that flows onto every compare page. Two competitors genuinely
  start cheaper than our cheapest: **QuoteIQ Essentials at $29.99/mo** and
  **Housecall Pro Basic at $79/mo**, both against Solo at $99.

> **A copy bug worth knowing.** The "They start cheaper than we do" panel is
> data-driven and fires on **both** the QuoteIQ and Housecall Pro pages, but
> the surrounding copy in `compareCopy.js` reads as though QuoteIQ is the only
> one. Do not be caught out by the Housecall Pro page saying it too.

### The add-on argument — the strongest honest one we have

Only Jobber has add-ons in the data, read at the same coordinates ("Just me ·
Annual, prepaid"):

    Marketing Suite        $99/mo
    AI Receptionist        $29/mo
    Sales Pipeline         $49/mo
    ──────────────────────────────
                          $177/mo   on top of the plan price

Their $29/mo receptionist buys **30 conversations**, then $0.79 each.

**The one thing you may not say:** that FieldQuo's receptionist is "included".
Talk time is prepaid credit. `AddOnStack.js` narrows the claim to **"no monthly
minimum"** and you should too.

---

## Screenshot decks — status

The owner asked for a feature deck with screenshots exactly as they render, one
for web and one for mobile. **No screenshots are in this document.** Two
blockers, in order of severity:

**1. The dev server currently returns HTTP 500 on every route.** Not an auth
problem — a build failure. `app/components/layout/MobileTabBar.js:96` contains
a code comment reading `// pb-[env(...)] carries the safe-area inset...`.
Tailwind v4 scans raw file text including comments, matches the literal
candidate `pb-[env(...)]`, and emits `padding-bottom: env(...)` into the
generated stylesheet, which is not valid CSS. PostCSS fails, `app/layout.js`
fails, and `/`, `/features`, `/pricing` and `/compare` were all confirmed
returning 500. `grep -rn 'env(\.\.\.)' app lib` returns exactly that one
comment. The sibling comment line references `pb-[calc(4rem+...)]` and has the
same defect. This is almost certainly a **production build blocker**, not just
a dev one.

**2. `/app/*` requires authentication and credentials must not be entered.**
`middleware.js` gates `/app`, `/platform` and `/sales`; all three 307-redirect
to their login pages, confirmed. Every authenticated screen therefore needs
either a login supplied by the owner or shots taken by hand.

**What is reachable with no credentials once blocker 1 is fixed** — all
statically prerendered, all safe to screenshot:

- Static: `/`, `/pricing`, `/compare`, `/features`, `/savings`, `/cost`,
  `/resources`, `/resources/help`, `/glossary`, `/contact`, `/about`,
  `/careers`, `/security`, `/privacy`, `/terms`
- `/compare/[slug]` — 5 pages
- `/features/[slug]` — 37 pages
- `/industries/[slug]` — 12 pages
- `/product/[slug]` — 4 pages
- `/glossary/[slug]` — 100 pages

**Placeholders for the authenticated deck.** Each needs the route and both
viewports: **web 1440×900** and **mobile 375×812**.

| # | Route | What it shows | Access |
|---|---|---|---|
| 1 | `/app` | Dashboard — quoted, won, scheduled, owed | login |
| 2 | `/app/quotes/new` | Quote builder | login |
| 3 | `/app/leads` | Lead list, scored | login |
| 4 | `/app/estimate-reviews` | AI quote review | login |
| 5 | `/app/scheduler` | Team scheduling | login |
| 6 | `/app/jobs/[id]` | A job with costing and photos | login + seeded job |
| 7 | `/app/clock` | Crew clock-in | login |
| 8 | `/app/crew-inbox` | Crew inbox | login |
| 9 | `/app/copilot` | Ask FieldQuo AI | login |
| 10 | `/app/analytics/benchmark` | Price benchmark | login |
| 11 | `/app/receptionist` | AI receptionist | login |
| 12 | `/app/purchasing` | Suppliers and POs | login |
| 13 | `/platform/sales/performance` | Rep leaderboard | superadmin |
| 14 | `/sales` | Rep console | rep login |

Client-facing surfaces (`/q/[token]`, `/portal/[token]`, `/book/...`) need a
real token from seeded data rather than a login, and are the highest-value
shots in the whole deck — they are what the homeowner sees.

**No screenshot in this repository was faked and no page was described as
though it had been seen.**

---

## Where our real limits differ from what a rep would assume

1. **"AI included on every plan" is true of access and false of usage.** Plans
   do not differ by feature, but AI and voice are **metered** — talk time is
   prepaid credit. Saying "AI included" is a false claim about our own pricing.
2. **`Plan.aiCopilotEnabled` appears on the pricing card and gates nothing.**
3. **Contractor payouts send Canadian dollars only.** Not ready for a US
   payout — and most of the addressable market is American (695,892 US vs
   79,736 CA businesses, measured).
4. **Payroll does not pay anyone and does not file taxes.** It computes gross
   pay, makes payslips, exports the run.
5. **Financing: FieldQuo does not lend and approves nobody.** Stripe's lender
   decides. A monthly figure appears on a quote only if the contractor typed
   their own rate and term.
6. **Marketing spend is blended across channels.** Nothing links a dollar of
   spend to a specific lead. A contractor asking "which ad worked" cannot be
   answered.
7. **Subcontractor bids only work if the sub is also on FieldQuo.** No sub
   list, no way to put one on a job, no way to pay them, no insurance tracking.
8. **Checklists only populate from one entry point** — a visit created from the
   visit screen. Any other route starts empty.
9. **Custom fields save and are never read.** The settings screen works; the
   values go nowhere.
10. **The "Active" flag on email templates moves a badge and nothing else.**
11. **Language support is narrower than the language list looks.** Only English
    and French are switched on. Note that `app/i18n/featurePages/` has since
    gained German, Chinese and Italian, so the shipped limit sentence — which
    names only Spanish, Ukrainian, Punjabi and Tagalog as pending — is now
    **out of date and understates how much is unreleased.**
12. **A quote keeps the language it was created in, forever.** Nothing is
    machine-translated at send time. A signed PDF must keep saying what it
    said.
13. **Reserved subdomains are a security boundary.** A tenant cannot have any
    subdomain they like.
14. **Impersonation is read-only, superadmin-only, and enforced twice.**
    FieldQuo staff can view a customer's data and cannot edit it. The single
    sanctioned exception is the paid data-migration service, which may only
    CREATE records, only for a company that asked and paid, and logs every
    write.
