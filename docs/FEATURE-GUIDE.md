# FieldQuo — Feature Guide (Sales & Demo)

_The single source of truth for what FieldQuo does, told for a demo and a
sales conversation. Two layers: a **Quick summary** to skim, and an
**Expanded guide** detailed enough to script a demo._

> **This file drifted before, and the lesson is worth stating rather than
> just fixing quietly.** This page previously claimed to be updated "every
> time a feature is added or changed." It wasn't — it went three weeks
> without a touch while the Marketing Designer, paid AI image features,
> bank-statement import, the KPI dashboard's money-flow section, direct
> job-photo upload, the curated voice picker (with French/Spanish and a
> recorded-call disclosure), simulated demo phone lines and the platform's
> webhook-repair screen all shipped. A document asserting something false
> about itself is exactly the failure class AGENTS.md is built against,
> so the honest claim is a weaker one: **this file is updated when someone
> remembers to, and it should be checked against `docs/ROADMAP.md`'s
> "Recently completed" log (newest first) before being trusted for a demo
> script.** For a support ticket rather than a demo, use
> `docs/SUPPORT-GUIDE.md` instead — it's task-oriented, names exact pages,
> and is scoped to answering a contractor rather than pitching one.

> **Maturity is labelled honestly** — ✅ shipped · 🟡 in progress · ⚠️ configured-but-not-wired.
> A sales guide that promises a dead control burns trust on the first demo, so the
> few half-built areas are flagged with "don't demo yet."

---

## What FieldQuo is

A **white-label** operating system for field-service contractors — painters,
plumbers, cabinet makers, flooring installers, landscapers, handymen. It runs the
whole job, and **every document the homeowner sees looks like it came from the
contractor, not from us**: the quote, the invoice, the booking page, the website,
the emails — all carry the company's logo, brand colour, and name in the From
line. A homeowner comparing three contractors can't tell two of them run the same
software.

**The pipeline it serves:**

```
Lead ──▶ Quote ──▶ (client approves) ──▶ Job ──▶ Invoice ──▶ Payment
  ▲         │                              │
  │         └─ AI review + upsell add-ons  └─ scheduling, visits, photos,
  └─ website, booking, self-quote,            materials, expenses, job costing
     instant estimate, referrals, phone
```

**Three things that consistently win the demo:**
1. **White-label everywhere** — measured contrast means a lime-green landscaper and a navy roofer both get documents that look deliberately theirs.
2. **FieldQuo takes no cut and never holds the money** — payments go straight to the contractor's own Stripe account.
3. **Nothing pretends to work that doesn't** — the product is swept for dead controls; that honesty is a selling point to a skeptical tradesperson.

---

# Part 1 — Quick summary

### Win the work (quoting & estimates)
- **Quote builder** — multi-service, on-brand quotes priced from your own rates.
- **Scope groups** — one quote, several trades, each its own priced colour-coded card.
- **Product catalog + suggested extras** — add priced lines, or the commonly-forgotten ones (at $0, so no fake price ever ships).
- **Per-unit & package pricing** — by the door/drawer with complexity tiers; or fixed menus (junk load, detailing Bronze/Silver/Gold, chimney level).
- **Location-aware tax, discount, expiry, "what happens next."**
- **Cost & margin preview** — see your profit before you send (internal only).
- **AI quote review + upsell add-ons** — catches gaps, checks your price against *your own* wins, suggests profitable extras.
- **Client approval page + real e-signature** — branded, hash-anchored, on a phone.
- **Send by email + branded PDF**, from your own domain, in the client's language.
- **Contractor-to-contractor import** — pull a sub's quote in as a marked-up cost.

### Get leads in
- **Instant estimates** — a real starting price from your website in seconds (measured from the address or a traced map).
- **Estimate review queue** — nothing auto-generated goes out until a human confirms it.
- **Self-quote request form** — photos + job size + budget/timeline, no prices, becomes a scored lead.
- **Homeowner kitchen self-design** — they draw it, you price it.
- **Lead scoring** — every lead auto-triaged hot / warm / cold, with a plain-English reason for the score.
- **Leads pipeline** — a working board with search, filters, owner assignment, a call-back log, and one-tap convert-to-quote.
- **Lead funnels** — mobile-first, tap-through quiz funnels for your ads and link-in-bio; build from a TikTok/Instagram/YouTube/Web template or describe it to AI, publish to a shareable link, and watch where people drop off.

### Do the work (jobs & scheduling)
- **Accepted quote → job automatically.**
- **Jobs board + driveway-view job detail** (tap to call / navigate).
- **Recurring jobs** — the next visit schedules itself.
- **"On my way" text** fires when a visit flips to en-route.
- **Team schedule, shift rostering, appointments with travel legs.**
- **Working hours vs bookable hours** kept separate.
- **Travel-aware availability** — never sells a time you can't reach.
- **Arrival windows** — "between 1:45 and 2:15," honestly.

### Online booking
- **White-label booking page** — pick a real open time, branded as you.
- **Meeting modes** — phone / video / on-site visit.
- **Estimator picker** — book a specific person.
- **Paid estimate visits** — charge a diagnostic/estimate fee (with optional promo price) by card at booking via your Stripe, then credit it back onto the job if they hire you.
- **Embeddable booking + quote widgets** — one iframe into your existing site.

### Get paid
- **Quote → invoice in one click**; deposits, partial payments, running balance.
- **Online card payments** straight to your bank (Stripe Connect, we take 0%).
- **Record cash / cheque / e-transfer** manually.
- **Affirm pay-over-time** — clients pay monthly, you're paid in full up front.
- **Client portal** — branded page to see the balance and pay, no account needed.

### Know your numbers
- **Expense tracking** — burn rate, runway, job-vs-overhead split.
- **Bank-statement CSV import** for expenses — upload, map the columns, review, commit; the stepping stone to a real bank feed.
- **Overhead → minimum price** you can't go below.
- **Job cost & margin** with a green/amber/red signal.
- **KPI dashboard** — one screen for sales, profit, execution and cash, including a **money-flow section** (income vs. expenses over time).
- **Revenue goal & pace, monthly digest email** (now reads the *calls* behind won and lost quotes, not just the numbers) **, "how you compare" benchmark.**

### Grow
- **Refer & earn** — bring another contractor, earn account credit worth a month of *their* plan.
- **Marketing Designer** — a real canvas ad editor (templates, stock photos, AI image generation, background removal) that exports one design across five ad sizes at once.
- **Automated follow-ups** on unanswered quotes; **automated review requests.**
- **Large-quote alerts, appointment reminders.**

### Your brand & website
- **AI-drafted, multi-page website** at yourname.fieldquo.com — facts locked, can't invent a claim.
- **One brand colour** flows onto every surface with **measured contrast.**
- **Job photos → website gallery & before/after** — and photos can now be added straight from the job page, not only by texting the crew line.
- **Send emails from your own domain.**

### AI
- **FieldQuo AI copilot** — ask your own business anything; never sees another tenant.
- **AI phone receptionist + outbound follow-up calls** (never quotes a price, discloses on request that it's an assistant, and now discloses once, early, that the call is recorded). Curated, spelling-accurate voice picker; French and Spanish are now genuinely spoken, not just transcribed.
- **AI photo "deep read" on a quote** and **AI image generation** (Marketing Designer) — the two *paid* AI features, spending a company's own AI credit balance rather than FieldQuo's free quota.
- **AI website copy, monthly digest, expense summary** — all metered & quota-safe.

### Crew & mobile
- **Crew auto-attribution** — a crew member texts a photo, it files onto the right job (no app to install).
- **Direct job-photo upload** on the job page itself, for shops that don't use the crew SMS line.
- **Time clock, mobile-first everything.**

### Team & platform
- **Invite teammates against licensed seats, role-based access.**
- **Payroll runs, timesheets, time off, shifts.**
- **Open signup** (first month free), industry/category selection, language + currency-by-country.
- **Internal platform console** — company oversight, plans, promo/influencer codes, demos, audit log, health.

---

# Part 2 — Expanded guide (demo-ready)

Each entry: what it does · the benefit · who it's for · maturity. Read top-to-bottom
and it doubles as a demo script that follows the contractor's own workflow.

## A. Win the work — Quoting & documents

**Quote builder** ✅ — A single screen where a contractor picks a client, drops in
one or more "scope groups" (one per trade), and fills each with line items from
their own saved rates. Live totals, tax, and a "Save draft" vs "Save & send"
split. *Benefit:* a painter assembles a real, itemised, on-brand quote in minutes
instead of retyping the same job in Word. *Location:* `/app/quotes/new`.

**Scope groups (multi-service quotes)** ✅ — One quote can hold several independent
trades ("Waterlines", "Gas", "Painting"), each a colour-coded card that renders
identically on the client's copy and the PDF. *For:* GCs and multi-trade shops.

**Product catalog + suggested extras** ✅ — Line items come from the company's
Products catalog (filtered so a flooring group never offers cabinet hinges) or a
list of habitual trade extras (e.g. a disposal fee). Suggested items are added at
**rate 0 on purpose** — the app supplies the checklist of what to bill, never a
fake default price that could reach a client unread.

**Per-unit & package pricing** ✅ — Door-and-drawer trades price by units ×
final-unit-price with a complexity tier and finish fields (colour, sheen, style).
Fixed-menu trades (junk removal by load fraction, auto detailing Bronze→Platinum,
chimney by NFPA level) price from a package selector. Three distinct pricing
patterns, matched to how each trade actually sells.

**Good / Better / Best tiers** 🟡 — Three linked price options a client chooses
between exist at the data/API layer, but there's **no builder button wiring it
up** yet. *Demo as a concept, not a clickable flow.*

**Totals controls — tax, discount, expiry, "what happens next"** ✅ — Real tax with
an on/off toggle that genuinely persists, a flat discount, a valid-until date, and
a plain-language "what happens next" block on the client's copy. Re-editing an old
quote recovers the rate actually applied, never silently re-priced at today's.

**Location-aware tax** ✅ — With "apply the client's local rate" on, selecting a
client re-resolves tax from the company's own rate table and explains why the
figure moved. It only ever picks between rates the company created.

**Cost & margin preview** ✅ (internal) — A private panel estimates job cost from
material recipes (paint coverage, coats, labour minutes) + a labour rate + overhead
%, against a 30% margin target. *Never shown to the client.* Recipe-backed for
painting/cabinets today.

**AI quote review + upsell add-ons** ✅ — Before sending, it flags gaps (no expiry,
no client email, vague "Labour — $2,400" lines, deep discounts), compares the
total against the company's **own** accepted/declined history for that trade, and
suggests add-ons at prices they've actually won at — each a real number, not a
guess. Only the *writing* uses AI; the arithmetic always runs even if AI is off.
*Never a cross-tenant benchmark — no other company's prices leak.*

**Client approval page + e-signature** ✅ — At `/q/[token]` a stranger on a phone
sees the company's letterhead, per-service cards, optional extras, and the total
in the brand colour. Approving is a two-step confirm with typed name, a **drawn
signature**, and consent; the server records IP, device, timestamp, and a document
hash. Contrast on the total band is measured so a yellow-brand company doesn't get
invisible numerals. **Zero FieldQuo branding on the document.**

**Optional add-ons (client-selectable)** ✅ — Upgrades appear as a tick list; the
total updates live. The browser only ever posts the chosen **IDs** — the server
reprices from its own rows, so the client can't tamper with what's charged.

**Send quote (email + PDF)** ✅ — One click emails a branded covering email in the
quote's language, a working approval link, and the PDF. `sentAt` is written only
**after** the email is accepted; a failure returns a specific reason and leaves a
draft to retry (fixing the old "Send that emailed nobody" bug).

**Quote PDF** ✅ — Server-rendered from shared document sections so the attachment,
the `/q` page, and the invoice all look like one system on the company's
letterhead.

**Quote editor** ✅ — A line-item editor (not a second builder) to tweak price,
lines, discount, tax, or expiry after the quote exists.

**Multi-language documents** ✅ — A quote's language is set once at creation and
baked into the PDF; it's deliberately not a viewer toggle, because a signed PDF
must keep saying what it said. English, French, Spanish, Ukrainian, Punjabi,
Tagalog.

**Contractor-to-contractor import** ✅ — When one FieldQuo company quotes another
(an electrician quoting a GC), the GC pulls that price into their own quote as a
marked-up cost, picks a markup, and shows it as one blended line or itemised. Every
figure is derived server-side. The **homeowner never sees the sub or the markup**;
on acceptance the cost flows into the job's expenses. The sub sees an honest
"used in another company's quote — pending" status.

## B. Get leads in

**Instant estimates** ✅ — A public flow where a homeowner picks a trade, describes
the property (address, a traced map polygon, or typed area), and gets a real price
**range** computed server-side from the company's rates — then leaves contact
details. Each one creates a **draft quote flagged for review**; never binding.
Trades: roofing, lawn, epoxy, parging, cabinet refacing, countertop, flooring.

**Estimate review queue** ✅ — Auto-generated estimates land in a queue showing
exactly what the homeowner saw; a supervisor confirms the price before it can be
sent. The send route hard-blocks an unreviewed estimate, so the gate is real.

**Self-quote request form** ✅ — A public 3-step form (service → size + photos →
contact) that returns **no prices** and produces a lead. Now also asks two
universal qualifiers — **when they want to start** and **rough budget** — which
feed the lead-scoring engine. Photos/video of the job come in with it.

**Homeowner kitchen self-design** ✅ — A homeowner lays out a kitchen and submits it
as a lead; the cabinet maker prices it by hand and sends a real quote.

**Lead scoring — hot / warm / cold** ✅ — Every inbound lead (self-quote, kitchen
designer, embed form, client portal, phone agent) is triaged the moment it lands,
scored 0–100 from timeline urgency, stated budget, emergency flags, contactability
and effort (photos, a drawn kitchen, a real description). It's a transparent,
explainable heuristic — not a black box — so every lead carries a **"why this
score"** breakdown the rep can see and overrule. "ASAP + $15k" lands hot; a burst
pipe lands hot whatever the budget; "just exploring" lands cold.

**Leads pipeline** ✅ — A working pipeline board (New → Contacted → Won → Lost),
cards led by the temperature badge + budget/timeline, with search, a
hot/warm/cold filter, and a hottest-first sort. Each card opens a **detail
panel**: the score breakdown, editable qualifiers (re-triages on change), contact
with "do not call", structured intake, photos, the drawn kitchen, **owner
assignment**, status, and a **call-back notes log**. The **"Convert to quote"**
button is now real — it builds a draft quote carrying the client, category, photos
and the homeowner's answers, links the two, and drops the estimator straight into
it. (It used to be a dead link to a blank page.)

**Lead funnels** ✅ — Perspective.co-style, mobile-first **tap-through funnels** for
paid social and link-in-bio — the "TikTok ad → 60-second quiz → qualified lead →
booked estimate" loop. Build one from a **channel template** (TikTok / Instagram /
YouTube / Web), or **describe it and let AI generate it** (grounded on your real
services; falls back to a template if AI is unavailable — never a broken funnel).
Each funnel is a sequence of full-screen steps — intro hook, single/multiple-choice
questions (with branching), photo upload, contact form, thank-you — edited in a
builder with a live branded preview. Budget and timeline questions **feed the same
lead-scoring engine**, so a funnel drops a *scored* lead straight into the pipeline.
Publish to a shareable `/f/…` link (QR-friendly, embeds on the site), wire up **Meta
/ TikTok / GA4 pixels**, and read **per-step drop-off analytics** ("60% quit at the
budget question"). Publishing is blocked unless the funnel actually captures a
contact — no funnel that collects nothing. *English-first; a full i18n pass is a
follow-up.*

## C. Do the work — Jobs & scheduling

**Accepted quote → job (auto)** ✅ — A "yes" creates a job in an "unscheduled"
state, idempotently, and materialises any imported subcontractor costs onto it.
Nothing falls through the gap between quoting and doing.

**Jobs board + job detail** ✅ — A filterable board across five statuses, and a
driveway-view detail: tap-to-call phone, tap-to-navigate address, the visit list
with checklist progress, photo counts, and notes.

**Visits & checklists** ✅ — Visits (scheduling, crew, checklists, photos) are
fully built and display everywhere, **and now have a real "create a visit"
screen** — the "Add visit" button used to point at a page that didn't exist;
it now opens a builder that offers the company's own checklist templates
alongside FieldQuo's 168 per-trade system templates, phased pre/during/post,
and genuinely stamps the chosen items onto the new visit (they used to save
and go nowhere). Safe to demo end to end.

**"On my way" text** ✅ — Flipping a visit to en-route texts the client (the
company's own wording or a safe fallback), non-blocking.

**Recurring jobs** ✅ — Weekly/biweekly/monthly jobs keep exactly one upcoming visit
on the calendar, carrying the crew and checklist forward, correct across short
months. Runs from a nightly cron and on visit completion.

**Job photo curation → website** ✅ — Select crew photos to publish to the website
gallery.

**Scheduling** ✅ — Team schedule overview (managers get edit links only where
allowed), an appointments calendar that flags a drive that can't be made in time,
and a shift rosterer where each worker sees only their own published shifts.

**Availability, travel-aware slots, arrival windows** ✅ — Working hours and bookable
hours are separate. A booking slot is only offered if the estimator can physically
reach it (real road times, with an offline fallback labelled as an estimate).
Arrival windows widen the client-facing time honestly, off by default.

## D. Online booking

**White-label booking page** ✅ — A 3-step flow (service → time → details) that
works in a 600px iframe, shows only genuinely free times, re-checks the slot at
submit, and creates the appointment + client, branded as the company with a
branded confirmation email.

**Meeting modes** ✅ — Phone / video / on-site; a single-mode company shows no
needless control; a visit can collect an address that filters times by drive time.

**Estimator picker** ✅ — "Choose who you'd like to meet" when bookable members
exist.

**Paid estimate visits** ✅ — Charge a per-event-type visit fee (with an optional
promo price, e.g. a "$20 estimate special" instead of the standard $79) collected by
**card at booking** through the company's own Stripe Connect. The fee is resolved
entirely server-side — the browser never says what a visit costs, and a company that
hasn't connected Stripe simply can't set one (the config shows a "connect Stripe to
collect this fee" prompt). A paid slot is *held* (`pending_payment`) rather than
booked: no appointment lands on the crew's calendar until the Stripe webhook confirms
payment, at which point the client, appointment and branded confirmation are all
created. The contractor later credits the paid fee back onto the client's invoice
with a one-tap, reversible toggle on the invoice — the John-the-Plumber model, where
the visit is free *if you go ahead with the work*. The credit records as its own
`visit_credit` payment so it flows through the normal balance math and can be switched
off again. Configure it in **Settings → Booking page** (per event type).

**Embeddable widgets** ✅ — `/embed/[slug]/book` and `/embed/[slug]/quote` drop the
real booking/quote flows into an existing website with no FieldQuo chrome; the
frame self-measures its height and is noindexed so it never competes with the
company's own page.

## E. Get paid — Invoicing & payments

**Quote → invoice** ✅ — "Convert" flattens the accepted quote (and any
client-selected add-ons) into a matching invoice at the exact total agreed;
refuses anything not accepted and blocks a duplicate.

**Deposits, partials, running balance** ✅ — Every payment recomputes the balance
from all payment rows; status flips to paid only when it hits zero. The pay link
always charges the **remaining** balance, never the full total twice.

**Send + PDF + mirror-of-quote design** ✅ — Branded invoice email (only stamped
sent after it's accepted), downloadable PDF, and the same document engine as
quotes so invoices are a true mirror, not a lesser cousin.

**Record a manual payment** ✅ — Cash / e-transfer / cheque, recomputing the
balance; gated behind a dedicated high-trust "payments" permission and logged.

**Online card payment (Stripe Connect)** ✅ — Client taps Pay; a Checkout session in
the company's currency charges the balance and transfers to **their** connected
account. `application_fee_amount` is 0 — **FieldQuo takes no cut and never holds
the money.**

**Request-payment link** ✅ — Emails a durable pay link via the client portal (not a
raw Stripe URL that expires in 24h); mints a fresh session at click time. Warns the
contractor instead of sending a dead button when Stripe isn't connected.

**Stripe webhook → auto balance** ✅ — A paid-online invoice marks itself paid,
recomputing from all payments so a Stripe **deposit** stays part-paid rather than
falsely paid-in-full.

**Stripe Connect onboarding** ✅ — Settings → Payments runs Stripe Express
onboarding and drives its badge from a **live** status call, not just the webhook
column (which can lag forever), naming exact outstanding requirements. Payouts to
the contractor's bank follow Stripe's own schedule.

**Contractor payouts** ✅ (employee payroll ⚠️) — Pay 1099-type subcontractors their
share straight to their Stripe account. *Employee payroll via the embedded provider
is not wired yet — don't demo it.*

**Affirm pay-over-time** ✅ — Opt-in; on eligible invoices ($50–$30,000, USD/CAD)
Checkout offers Affirm alongside card. Affirm pays the contractor in full; the
homeowner pays monthly. Falls back to card-only if Affirm isn't activated on the
account, so the pay link is never broken.

## F. Know your numbers

**Expense tracking** ✅ — Log costs, tag them job/overhead/general, optionally
recurring; the dashboard shows burn rate, runway, the job-vs-overhead split, a
6-month trend, and an AI plain-English summary. Restricted members see only their
own entries.

**Bank-statement CSV import** ✅ — Upload a statement exported from any bank,
map the columns, review the parsed rows, commit. Deliberately the low-cost
stand-in for a paid bank-aggregator (evaluated and rejected — no Canadian
support, four-figure monthly minimums), but built so a real bank feed can slot
in later as a backfill rather than a rework: every imported row records its
source, and duplicate detection is source-blind, so a future aggregator
redelivering months of transactions a contractor already imported by hand gets
caught, not double-booked.

**KPI dashboard** ✅ — One screen for sales, profit, execution and cash: win
rate, average job value, backlog (expressed in weeks, not months — a
residential shop isn't a commercial GC), margin roll-up, revenue per employee,
on-time completion, utilisation. Includes a **money-flow section** — income
vs. expenses over a chosen period, compared against the equivalent prior
period. Every figure is `value / incomplete / reason` under the hood: a
company with no history for a metric sees an honest "—", never a fabricated
zero, and margin figures specifically go silent (rather than print a
misleading percentage) when logged expenses and a job's material buy-list
disagree by an amount that suggests double bookkeeping.

**Overhead → minimum price** ✅ — Enter fixed costs (salaries, debt) and weekly
capacity, and get the price you can't go below. It refuses to compute without a
real capacity (no invented "3 jobs/week").

**Job cost & margin** ✅ — A unit-tested model turns scope intake + a recipe + a
labour rate into itemised material + labour cost and a green/amber/red margin
signal against a target.

**Subcontractor costs → job expenses** ✅ — An imported sub quote becomes a job
expense when the quote becomes a job, feeding margin — idempotent and
company-scoped.

**Revenue goal, monthly digest, "how you compare"** ✅ — A revenue target that
reports ahead/behind pace; a plain-English monthly recap emailed automatically; and
an opt-in benchmark of your average pricing vs the anonymised platform average per
category (only shown when the sample is ≥5, so competitors can't be
de-anonymised).

## G. Grow — referrals & marketing automation

**Refer & earn** ✅ — Share your `/refer/<company>` link. The **new company** gets 1
free month; **you** earn a Stripe account credit equal to **one month of the
referred company's plan** — so referring a big team is worth more than a small one.
Paid only once that company is a **verified paying customer** (onboarding done +
Stripe Connect + first payment), capped at 50 referrals/month. Send email/SMS
invites and track credit earned + per-referral status.

**Automated follow-ups** ✅ — "N days after an unanswered quote, send this email,"
with soft-then-final sequences; a cron actually fires them.

**Automated review requests** ✅ — Ask a happy customer for a Google review at the
right delay after the job; the toggle refuses to turn on without a valid review
URL, and live counts prove it's sending.

**Alerts** ✅ — Large-quote email alerts and appointment reminder texts, each backed
by a cron that honours the setting.

**Marketing Designer** ✅ — A real canvas ad editor (`/app/marketing/designer`),
reached from a company's marketing campaigns. Templates, a stock-photo library,
and one advert exported as five ad-network sizes at once (Facebook banner,
Instagram Story/square, etc.) are all free; AI image generation and background
removal are the one paid piece, spending the company's AI credit balance. A
design keeps one saved layout **per aspect ratio** rather than one shared
layout stretched five ways, because a headline that fits a square doesn't fit
a Story without adjustment — and each ratio starts from a sensible automatic
reflow, then can be hand-tuned.

## H. Your brand & website (white-label)

**AI-drafted website** ✅ — A 4–5 question interview generates a complete multi-page
site (hero, services, gallery, booking, FAQ, contact). The AI writes **sentences
only**; services, testimonials, photos, and prices come from the database and are
merged back, so it can't invent a service, a warranty, or years in business. Every
path falls back to a factual site, so AI being down produces plainer copy, never a
broken page. Publishes to **yourname.fieldquo.com** (reserved subdomains are a
security boundary). SEO title/description/structured data included.

**One-hex brand system** ✅ — Pick one colour and a logo; every quote, invoice,
email, site, and portal recolours to match, with **measured 4.5:1 contrast** — and
when a mid-tone can't be made legible it deepens the company's own colour rather
than falling back to grey.

**White-label across every surface** ✅ — The only FieldQuo mark anywhere
client-facing is a small "Site by FieldQuo" footer on free websites.

**Job photos → gallery & before/after** ✅ — Crew photos become the website
portfolio; a featured "start" beside a featured "finish" becomes a real
before/after slider. Never places stock imagery in slots that assert "we did this
work."

**Send from your own domain** ✅ — Register your domain with guided DNS; once
verified, client emails send from you@yourbusiness.com (with a multi-tenant guard
so two companies can't claim the same domain).

## I. AI

**FieldQuo AI copilot** ✅ — Ask your business anything ("what's my conversion this
month?") and get an answer from your **own** numbers via read-only, company-scoped
tools; it drafts client messages using real figures and declines general-assistant
requests. The security property: `companyId` is injected in code, never taken from
the model, so it can't reach another tenant's books.

**AI phone receptionist + outbound calls** ✅ (newer; needs Retell + prepaid voice
credits) — A voice that answers as the business, captures the lead, and **never
quotes a price**, escalating emergencies to a human; and outbound quote follow-ups
/ review calls that disclose they're an assistant and honour "stop calling." The
call now discloses, once, early and in one short clause, that it's being recorded
— it wasn't, until this pass; FieldQuo's own sales line already did. The voice
picker is **curated** to three providers chosen for phone-call clarity and
spelling accuracy over the previous default, which was the single most
expensive voice its own vendor offers and the one it warns sounds least
reliable at spelling addresses and numbers back. French and Spanish companies
now genuinely get a French- or Spanish-speaking agent (a real prompt-level
fix — setting the "language" field alone changed transcription and the voice
but never told the model what language to actually reply in, so a French
company was answered in English until this shipped).

**AI image generation + "deep read" quote review** ✅ (paid) — Two AI features
that spend a company's own **AI credit balance** rather than FieldQuo's free
quota: generating an image (Marketing Designer, with background removal) and a
closer, higher-resolution AI read of the photos already on a quote — on top of
the free quote review, which still runs on every quote regardless of AI credit.
Buy AI credit as a pay-as-you-go top-up or a monthly bundle at Settings → AI
credit. **This is a separate balance from the phone/crew wallet** — topping up
one does nothing for the other, and this is the most common AI-billing support
question (see `docs/SUPPORT-GUIDE.md`).

**AI website copy, monthly digest, expense summary** ✅ — All go through one
metered, quota-checked provider so AI never breaks a page or blows a budget.
The monthly digest now reads the **calls** behind a company's won and lost
quotes, not just the numbers — pointing at up to three things an actual caller
said, never counting or concluding on its own (every count in the digest is
still real arithmetic on real rows; the model only adds what a transcript
alone can supply).

> **Accuracy note:** the crew photo auto-attribution below is **not** an LLM — it's
> a deterministic engine. Sell it as "smart auto-filing," not "AI."

## J. Crew & mobile

**Crew auto-attribution + inbox** ✅ — A crew member texts a photo from any phone;
it files onto the right job visit using confidence tiers (text match, GPS
proximity, or only-one-job-today) and **asks when it can't be sure** — never guesses
silently. The office inbox surfaces only the exceptions. No app to install; FieldQuo
owns the schema, so the photo lands with no third party.

**Direct job-photo upload** ✅ — A job's photos no longer have to arrive by
crew text: an upload control on the job page itself files a photo the same
way, for the (common) shop that doesn't use the crew SMS line. The panel also
stopped hiding itself on a job with zero photos yet — "nothing filed" and "no
such feature" used to render identically.

**Time clock + mobile** ✅ — One big in/out button with live hours; the whole `/app`
is mobile-first for a phone on a bad driveway connection, add-to-home-screen
capable, and crew see only their own shifts and assigned jobs.

## K. Clients

**Client list, CSV import, white-label portal** ✅ — Searchable clients with
quote/invoice history and a contractor badge for company-type clients; a CSV
importer that accepts common column variants; and a token-linked **portal** that
reads as a statement from the contractor (balance first, pay button next), zero
FieldQuo chrome.

## L. Team & onboarding

**Team & roles** ✅ — Invite teammates against licensed seats (a full plan returns
a real "no seats" error, not a broken invite). **Four ranked roles** (owner /
admin / supervisor / employee) genuinely gate every API route, with
privilege-escalation protection (you can't promote yourself, out-rank a superior,
or delete the last owner). A **granular per-category permission grid** (Schedule,
Payroll, Clients, Quotes… with presets) exists and saves — but 🟡 **its
enforcement is only wired into the sensitive routes (notably payroll); elsewhere
the coarse role is still the real gate.** *Demo the four roles as fully enforced;
be careful claiming per-category enforcement everywhere.* Workers (non-login crew)
carry an hourly rate + optional Stripe Connect for payouts.

**Payroll & time** ✅ — **Two distinct surfaces, don't conflate them:**
- **`/app/payroll`** computes payslips (approved hours × rate − deductions) →
  draft → approve → **"record as paid"**; FieldQuo **moves no money** here, and
  says so. Self-service "My earnings" payslips, payslip PDFs, run CSV export,
  regional deduction/allowance templates.
- **`/app/settings/team/payroll`** runs **Stripe Connect payouts to 1099-type
  contractors** — this one *does* move money. ⚠️ Employee payroll via an embedded
  provider is scaffolding only (not wired) — don't demo it.
- Plus **timesheets** (server computes hours from clock in/out), **leave policies
  & accrual**, **time-off requests** (balance checked server-side), and **shift
  scheduling** (workers see only published shifts).

**Onboarding & signup** ✅ — Open company signup with a **free first month**;
industry + service-category selection; **language** (becomes the company default)
and **currency derived from country** (a Canadian shop is never asked to pick
USD/EUR unless they say they serve abroad); referral and influencer/tester codes
apply here.

## M. Settings surface (config that actually applies)

Branding, Company (name/address/tax/hours/regional), Payments, Email domain,
Language, Translations (review AI-drafted service names before a client sees them),
Notifications, Instant-quotes rate cards, Booking page, Lead-form links + embeds,
Website, Reviews, Follow-ups, Expense tracking (+ its bank-statement CSV import),
Messages ("on my way" wording), Overhead, Materials, Services, Products,
Checklists (now genuinely stamped onto a visit, see section C), Account &
billing, AI credit (a separate balance from phone/crew credit — section I),
Document (PDF) templates. **All of the above are fully read-and-written.** Two
are **not** wired and should be hidden or skipped in a demo:

- ⚠️ **Email templates** — the block editor and "Set Active" work, but the real
  **quote/invoice** sends use a hardcoded (still-branded) email and ignore the
  Active template. Active templates only drive marketing campaigns and follow-ups.
- ⚠️ **Custom fields** — definable but never collected or displayed.
- ⚠️ **Voice `transferTo`** — a dead field (saved, never used).

## N. FieldQuo subscription (the contractor's own plan)

**Account & billing** ✅ — Current plan/seats, trial countdown, upgrade via Stripe
Checkout, the Stripe billing portal, and a self-healing "Check with Stripe"
reconcile so a delayed webhook can't strand a paying company on "No active plan."
Cancellation runs through a save-flow, not a bare confirm. This is Stripe **Billing**
— entirely separate from Connect.

---

# Part 3 — Internal platform console (superadmin only)

FieldQuo's own back office — not customer-facing. Included so the team knows the
tooling exists; it's not part of the customer sales deck. All ✅ shipped.

**Oversight & support**
- **Platform dashboard** — FieldQuo's own MRR/ARR, paying companies, and churn,
  kept **separate** from "flowing through FieldQuo" (what tenants' clients paid
  them) so product volume is never mistaken for FieldQuo income. Plus two
  silent-failure alarms (client-email delivery, AI down).
- **Companies directory** — server-side search + status filter, flags trials
  ending within 7 days.
- **Company detail (read-only)** — the tenant's whole record mirrored read-only
  (a "Read-only" badge, no write path); usage shown as **counts only**, never the
  client's actual records.
- **Company health score** — a 0–100 red/amber/green read backed by 30-day
  metrics, shown problems-first so support acts on the cause.
- **Read-only impersonation ("View account")** — superadmin-only, 30-minute,
  read-only session on a dedicated token; **every non-GET is blocked in
  middleware and re-checked in code**; start/end are logged to the audit trail
  and the company is **not** notified (it can't write anything).
- **Support actions** — extend a company's free period (reason required, logged,
  warns if Stripe wasn't synced); suspend/reactivate.
- **Financial history + activity trail** — including any action taken under a
  support session, flagged as `viaImpersonation`.

**Billing & growth**
- **Plans** — the public pricing page reads this table live; editing a plan with
  subscribers warns it won't re-bill existing Stripe subscriptions.
- **Subscriptions monitor** — MRR, trials ending, and the key one: **"not
  billable"** (active but no Stripe subscription — looks normal, charges no one).
- **Promo / influencer codes** — mint labelled, single-use free-month signup
  codes (no referrer, no credit to anyone) and see who redeemed each.

**Sales tooling**
- **Demo accounts** — one re-skinnable demo per rep; "Change trade" re-dresses it
  as any industry (wiping that demo's data, with a confirm). A demo can now
  demo the **phone receptionist end to end on a phone number that is never
  real** — a simulated line drawn from the numbering plan's reserved
  fictional block, run through the exact same provisioning a paying company
  gets, so the settings, voice picker and call list all genuinely work
  without ever risking a real, dialable number outliving the demo or
  answering as the wrong trade next week. A demo cannot buy a real number at
  all — refused server-side, on purpose.
- **Demo bookings** — product demos prospects booked from the marketing site, as
  a sales queue.

**Operations & reliability**
- **Feedback queue** — in-app bug reports/requests, aged oldest-first, with
  private internal notes.
- **Voice webhook repair** — when a receptionist answers perfectly but its
  calls never appear in the log, this screen (`/platform/voice-webhooks`)
  shows where each company's call events are actually being delivered and can
  repair a stale delivery address — but refuses to run the repair from
  anywhere that won't still exist next month, since a bad repair would break
  every other company's receptionist at once, not just the one being looked
  at.
- **AI usage metering + per-company caps** — sorts tenants by token spend, flags
  3×+ spikes, and lets staff cap a company (blank = plan default, 0 = AI off).
- **AI health & Email health checks** — the AI check runs one real completion
  where the Sensitive key lives (a listed model isn't proof it answers); the
  email check catches the worst silent failure — client mail accepted and thrown
  away — and drives the loudest dashboard banner.
- **Service categories** — the global trade catalogue onboarding pulls from
  (keys are code-referenced, so renames warn about a migration).
- **Reports** — three board-ready CSV exports (growth, companies, subscriptions).
- **Audit log** — every staff action, with impersonation entries visually
  distinct (the only record of access to a customer's live data).
- **Errors queue** — a to-do list of silent failures (rejected emails, Stripe
  syncs, PDFs, cron/AI/webhook errors); acknowledge to clear.
- **Platform team** — FieldQuo's own admins in a separate table/auth, three tiers
  (superadmin / admin / support), no self-signup, last-superadmin protected.
- **Support runbook + a deliberately bare, separate staff login.**

---

# Part 4 — "Handle carefully" in a demo (honest status)

| Feature | Status | Demo guidance |
|---|---|---|
| Good/Better/Best tiers | data/API only, no UI | Describe as a concept, don't click |
| Email templates "Set Active" | editor works, real quote/invoice sends ignore it | Don't claim your custom email is what clients get |
| Custom fields | definable, never collected | Skip |
| Employee payroll payout | not wired (contractor payouts work) | Demo contractor payouts only |
| AI phone receptionist | shipped but newer; needs Retell + credits | Demo on a configured account |
| Instant estimates / cost engine | real but trade-limited | Stick to supported trades |
| Granular permission grid | saves, enforced only on sensitive routes | Demo the 4 roles, not per-category everywhere |
| Product `costPrice` / Materials page | captured but not read by any calc | Don't imply product-cost margin or material-driven quoting |

_Resolved since the last pass through this table — kept out of it now, not
forgotten: **"Add visit"** has a real create screen (`/app/jobs/[id]/visits/new`)
and is safe to demo; **checklist templates** (company-built and FieldQuo's own
168 system templates) are now offered when creating a visit and genuinely
stamp onto it; **paid estimate visits** collect a real Stripe charge at
booking, not just a config screen — see section D above for all three._

---

_Maintained by the team. When a feature ships or changes, update this file so the
sales guide and the product never drift._
