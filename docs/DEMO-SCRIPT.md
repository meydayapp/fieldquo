# FieldQuo demo — 15 minutes, for a solo painter about to hire

Who this is for: one person, one van, quoting on paper or in a spreadsheet
today, about to take on their first employee. Canadian, not technical, will
watch most of this on a laptop but cares whether it works on a phone in a
driveway because that is where they actually work. Every minute below has to
earn its place with that person — nothing in here is staged for a 20-person
shop.

Read `AGENTS.md` before this document if you haven't: the pipeline this
script walks is Lead → Quote → (client approves) → Job → Invoice → Payment,
and that pipeline is the product.

---

## 0. The account, and what "demo" means here

Sales demos run on one of ten fixture companies — `demo1.fieldquo.com`
through `demo10` — seeded by `lib/demo/industries.js` and provisioned by
`lib/demo/seedDemo.js`. Each one is pinned to a trade; **`demo1` is the
painting preset** (`Northside Painting Co.`, brand colour `#1E5F8C`) unless
someone has switched it since. Confirm the trade before you rely on this
script: `/platform/demo` shows every demo's current `demoIndustry` and lets
you switch it back with one click (destructive — it wipes that demo's
quotes/jobs/clients/invoices, so only do it if it's actually wrong).

**Getting in:** `/platform/demo` → find the painting demo → **"Run the
demo."** This opens `/app` in a new tab as that company's owner, in
`demo_sandbox` impersonation — the one impersonation mode allowed to *write*
(`lib/currentMember.js`). Real owner permissions, nothing hidden. The session
is time-boxed to **30 minutes**, so a 15-minute script fits with room to
recover from a wrong click, but don't set up 20 minutes before the call and
expect the session to still be open — do the setup, then re-enter fresh
right before you dial in.

**What survives a reset, what doesn't.** `wipeContent()` in `seedDemo.js`
deletes quotes, jobs, invoices, appointments, leads, clients,
`CompanyServiceCategory` rows (which carry both the enabled/disabled state
*and* any rate-card overrides) and the seeded demo voice calls. It does
**not** touch `ForecastSettings` (the jobs/week capacity), `FixedCost`,
`Salary`, `Debt`, `Asset`, `MaterialRecipeSetting`, or `Worker` rows. So:
Overhead and Material Costs, once set up, survive a "Reset" or even an
industry switch. Service-category rate overrides do not — if someone
resets `demo1` for another call, the custom rates you typed into the rate
card are gone (the trade's own price-book defaults still apply — see below —
only your *overrides* are lost).

---

## PART A — Setup checklist, in dependency order

This is the part the owner asked for by name: a quote demo against an empty
account renders "—" everywhere, correctly, because the product refuses to
invent numbers (`lib/analytics/minimumPrice.js`'s whole header is about this).
Do these in order — each one either produces figures the next step reads, or
the next screen's controls quietly refuse to show up.

### 1. Confirm the trade and reseed if needed
**Where:** `/platform/demo`.
**What:** the card for `demo1` should say `painting`. If it says anything
else, click "Change trade" → Painting → confirm. This re-seeds four sample
clients, a spread of quotes/jobs/invoices across statuses, opening hours
(Mon–Fri 8–5, Sat 9–1), four seeded receptionist calls, and enables
`interior_painting`, `exterior_painting` and `drywall` as service categories
with plausible rates already on them (`Interior painting — walls & ceilings`
$3.25/sqft, `Exterior painting — siding` $4.75/sqft, etc. —
`lib/demo/industries.js`).
**Breaks if skipped:** wrong trade on screen mid-call, or (if genuinely never
seeded) an empty dashboard with nothing to click through.

### 2. Add the one employee
**Where:** `Settings → Team → Workers` (`/app/settings/team/workers`), "Add
worker."
**What:** a name and an **hourly rate** — e.g. `Mike`, `$28/hr`. This is not
decoration: `worker.hourlyRate` is what `CostMarginPanel`
(`app/components/quotes/builder/CostMarginPanel.js`) multiplies against crew
hours to produce the internal labour cost on every quote. It is also,
narratively, the exact thing this prospect is about to do for real — "here's
where you'd add the person you're about to hire" lands harder than an
abstract feature tour.
**Breaks if skipped:** the cost/margin panel still opens, but its crew-hours
row has no rate to multiply — labour cost reads as $0, which undersells the
margin badge that is the whole point of that panel.

### 3. Settings → Overhead — the one that gates everything
**Where:** `/app/settings/overhead`. Requires the `jobCosting` toggle, which
`demo_sandbox`'s owner role has by default.

**3a. Jobs-per-week capacity — REQUIRED, do this first.**
`lib/analytics/minimumPrice.js` divides monthly cost by
`capacity × 4.33` to get a cost-per-job. There is **no default** — the code
comment is explicit that a made-up "3 jobs/week" used to be silently assumed
here, and that was treated as a bug and removed. Without a capacity number,
`/api/analytics/minimum-price` returns `needsCapacity: true` and the whole
card on this page — and the margin context inside the quote builder — renders
nothing but the sentence "Tell us how many jobs a week you can take on."
**Plausible value:** `2` (a solo painter picking up a second set of hands can
realistically run two jobs a week, not five).
**Breaks if skipped:** the minimum-price card is blank, and worse, it's
blank *silently* — nothing on screen says "you forgot a step," it just says
"we need this," which reads fine in isolation but terrible mid-sentence in a
demo.

**3b. Fixed costs.** Rent, insurance, the phone bill — a repeating amount,
weekly/monthly/yearly. Add two or three real-sounding lines:
- Liability insurance — $175/mo
- Phone + software subscriptions — $90/mo
- Storage/shop space — $220/mo

**3c. Salaries (business overhead, not payroll).** The screen's own header
comment is explicit that this is the *owner's draw* or an office wage counted
as overhead, not the worker you just added in step 2 — don't conflate them.
Add one: **Owner's draw — $4,200/month.**

**3d. Debt and assets — optional, and a genuine trap if done carelessly.**
You *can* add a truck loan (`Debt`) and the truck itself (`Asset`), and the
screen will compute depreciation and interest-only cost correctly — but only
if the asset's `debtId` is linked to the loan. An **unlinked** debt+asset
pair triggers a "double-count risk" banner (`burn.doubleCountRisk` in
`lib/analytics/minimumPrice.js`), because the naive reading would charge both
the full loan payment *and* the asset's full depreciation for the same
truck. That banner is real, correct, and exactly the kind of thing that
derails a 15-minute call into an unplanned explanation. **Recommendation:
skip debt/assets for this demo.** Fixed costs + salary + capacity already
produces a believable, defensible number.

**What this produces:** with the numbers above, the card shows four tiles —
Monthly Fixed Costs, Jobs/Month, Cost/Job, Minimum Price — computed live from
`calculateBurnRate()`. (Exact figures depend on the burn-rate math; the point
for the demo is that a real number appears where "—" was, not a specific
digit to memorize.)

### 4. Material costs — optional, defaults already ship
**Where:** `/app/settings/material-costs`.
**What:** this screen lets a company override the TrueFinish-derived
defaults baked into `app/data/materialRecipes.js` — coverage rates,
per-gallon paint cost, coat counts. For the two painting categories seeded in
step 1, **the defaults already produce a real cost estimate with zero setup**
— the "Default" badge next to each category confirms nothing has been
overridden and nothing needs to be. Only touch this if you want to show a
prospect that their own numbers can replace the defaults (type a different
coverage rate, watch "Custom" replace "Default").
**Breaks if skipped:** nothing. This is the one item on the checklist that is
genuinely optional — call it out that way if asked, don't over-set-up.

### 5. Services — confirm, don't rebuild
**Where:** `/app/settings/services`.
**What:** `interior_painting` and `exterior_painting` should already show
enabled (from step 1's seed) with a rate card, not a single rate box — a
trade with a price book (`app/data/tradePriceBooks.js`) hides the
single-number field entirely and uses the structured per-sqft/per-tier
pricing instead, which already carries real Canadian-market defaults
(`standard` interior wall $2.50/sqft, `moderate` $3.25/sqft, etc.) whether or
not the company has ever opened this screen. You do not need to fill
anything in here for the quote builder to produce real numbers.
**Breaks if skipped:** nothing, same as material costs — but if a category
shows disabled (can happen after a reset that landed on the wrong industry),
the quote builder has no scope group to build with, which is a hard blocker,
not a cosmetic one. Check it's on.

### 6. A client
**Where:** `/app/clients`, or created inline from the quote builder.
**What:** four fixture clients already exist from step 1 (Sarah Mitchell,
the Chens, the Okonkwo residence, Riverside Property Management). For the
live "lead arrives" beat in Part B, **create one fresh, live, in front of the
prospect** rather than picking a seeded one — it's ten seconds, and a real
name typed in real time is more convincing than a name that was clearly
sitting there waiting.
**Breaks if skipped:** the quote builder's client picker has nothing to
select and no address to put on the document — the "prepared for" line at
the top of the quote (which is the moment the "looks professional" feeling
lands) would be blank.

### 7. AI credit balance
**Where:** `/app/settings/ai-credit`.
**What:** every demo company gets a **one-time** grant of **1,000 AI
credits** the moment it's first seeded or re-seeded
(`grantDemoAiCredit`/`DEMO_AI_CREDIT_CENTS` in `lib/voice/credits.js`) — not
per call, per company, forever (the grant is idempotent on a unique ledger
ref, so re-running the seed does not top it up again). At 12 credits per
image generation and 25 per "deep read" (the AI vision pass over uploaded
photos), 1,000 credits is roughly **83 generations or 40 deep reads** — plenty
for one call, not infinite across a month of back-to-back demos on the same
account. **Check the balance before you dial in.** If a previous call burned
it down, either use a different demo account or have a superadmin top it up
— don't discover a "your balance is too low" refusal live.
**Breaks if skipped:** the AI upsell review and any live image generation
mid-call fail with an honest "not enough credit" message rather than
anything worse, but it's an avoidable stall.

### 8. Payments (Stripe Connect) — check, don't attempt to set up live
**Where:** `/app/settings/payments`.
**What:** whether this demo company has completed Stripe Connect onboarding.
There is no special-cased demo path in the codebase for this — it's the same
real OAuth onboarding a paying contractor goes through, which is not
something to start live in front of a prospect. **Check ahead of time**
whether `hasAccount` is true for this demo company. If it's connected (even
in Stripe test mode), the invoice's "Pay now" flow is genuinely clickable. If
not, plan to narrate that step (see Part B, beat 6) rather than click it —
the invoice still sends fine either way; only the client-side pay button is
affected.
**Breaks if skipped and you try it live anyway:** you either eat several
minutes of a real onboarding flow with fictional business details, or hit a
dead end mid-call.

### 9. The AI receptionist's number — check it's actually live
**Where:** `/app/settings/voice` on the demo account, plus (ahead of time,
platform-side) `PlatformVoiceAgent` with id `fieldquo` — whether it's
`enabled`.
**What:** see Part C below for the full explanation. In short: the demo
line cannot ring, and the settings screen only offers "ring our real sales
line to hear it" when FieldQuo's own line is actually configured and live.
**If you plan to have the prospect call it, place that call yourself once
before the demo** to confirm it answers. If it's not live, skip that
moment entirely rather than promise it and go quiet.

---

## PART B — The 15-minute script

Shape: the contractor's own day, not the product's menu. A job shows up, it
becomes a priced document in front of the customer, the customer says yes on
their own phone, and — without another click — a job appears on the
schedule and a draft invoice is already sitting there. Then the invoice goes
out, gets paid, and the numbers underneath say whether it was worth doing.
The receptionist gets one deliberate slot in the middle, not the opening,
because speed-and-professional-looking is what makes this person switch on
day one; a phone robot is the thing that keeps them once they're in.

Total: 15:00.

### 1. Open — the contrast, fast (1:30)
**Click:** land on `/app` (the dashboard).
**Say:** "This is what you'd see every morning instead of the spreadsheet.
Everything on this page is real — money owed, what came in this month, what's
scheduled." Point at the **Needs You** panel at the top if it's showing
anything (it will, from the seeded receptionist calls) — "and this is what
happened while you were on a ladder: a call came in, the AI answered it, and
it's sitting here waiting on you, not lost in a voicemail you'll check at 9pm."
**Feel:** relief — this is not one more app to babysit, it's a summary of a
day that already happened.
**The number that lands:** whatever the receivables tile shows (real money,
not a zero) — say it out loud once.
**Don't linger** — this is the appetizer. Under two minutes.

### 2. Build the quote, live, in front of "the customer" (4:00)
**Click:** `+ New Quote` from the dashboard (or `/app/quotes/new`).
**Say:** "Say you just walked the outside of a house with someone — this is
what you'd do standing in their driveway, or that evening at the kitchen
table." Create the client live (step 6 above) with a real-sounding name and
address. Pick **Exterior painting — siding**, punch in a plausible
square footage, let the rate card price it. Add a second line — trim, or a
drywall repair hour — to show it isn't a one-line calculator.
**Say, while it's pricing itself:** "Every number here is coming off your own
rate card, not something I typed in — the one we set up in Settings a minute
ago." (Don't over-explain the setup; just gesture at the fact that it's
theirs.)
**Feel:** speed and competence — a quote that looks like it came from a
five-person shop, built in under two minutes, by one person, out loud.
**The number that lands:** the total, printed on a document with the
company's own brand colour and logo on it (`data-brand`/`BrandTheme` — this
is the non-negotiable: nothing here says FieldQuo). Say: "That took less time
than finding the estimate you wrote on the back of a business card last
month."

### 3. The AI review — upsell, without the hard sell (2:00)
**Click:** save the quote as a draft, then **"Review"** (`SuggestAddOns`,
which needs a saved `quoteId` — it reads the quote back from the database,
so this only works after the save, not while still typing).
**Say:** "Before you send it, one click asks: what did I usually sell
alongside this that I might have forgotten?" Let it propose an add-on (a
second coat upgrade, a deck stain, whatever the AI surfaces) and add one to
the quote.
**Feel:** being coached by someone who's seen a thousand of these, not sold
to.
**The number that lands:** the dollar amount the single suggested add-on
adds to the total — a real, small increase that came from one click, not
from remembering to upsell under pressure.
**If photos exist on the quote,** this is also where you could mention the
"deep read" (AI vision pass over uploaded jobsite photos) — one sentence,
not a demo of its own: "if you'd attached photos, this same button reads them
and catches things like missed prep work." Don't run it live unless there's
time to spare; it costs AI credit (25 credits) and isn't the core beat.

### 4. Send it, and the customer accepts on their own phone (2:00)
**Click:** `Send` on the quote detail page (real email, via Resend — say so:
"that just actually sent"). Then click **"Get approved"** →
`/app/quote-approval/[id]` — this is the internal page that mints the same
public link a client gets, specifically so it can be opened on a *second*
device right now. Open that link (your own phone, or a second browser tab
styled as "the customer's phone") — this is `/q/[token]`, the real
client-facing document.
**Say:** "This is exactly what they'd see — nothing fake about this screen,
it's the same link that went out in the email." Walk through the two-step
confirm, sign with a finger/mouse on the actual signature pad
(`SignaturePad`), and accept.
**Feel:** this is where "does this work on a phone in a driveway" gets
answered without anyone having to ask it — you just showed them.
**The number that lands:** flip back to the quote detail tab. **Without
touching anything else**, the quote now shows `accepted`, a **Job** already
exists (unscheduled, waiting for a date), and a **draft Invoice** already
exists — both created automatically the instant the client signed
(`onQuoteAccepted()` in `lib/quotes/quoteLifecycle.js` fires both
`ensureJobForAcceptedQuote` and `ensureInvoiceForQuote`). Say it plainly:
"You didn't do anything else. That's the whole pipeline moving on its own."

### 5. The job, and — briefly — the receptionist (1:30)
**Click:** the new job, or `/app/appointments` to show a visit can be
scheduled against it. Then pivot: "and this happens on the phone too, not
just online" → open `/app/receptionist`.
**Say:** "Every call your business gets, answered, every time, even at 9pm on
a Sunday." Show the seeded call list — a real summary, a flagged voicemail
that needs a callback. **Do not attempt to demonstrate a live call on this
account** — see Part C for exactly why, and only offer the real dial-in if
you confirmed beforehand (checklist item 9) that FieldQuo's own line is live:
"Want to actually hear it? Call {number} right now." If you didn't confirm
it's live, skip the invitation entirely rather than promise it.
**Feel:** this is the thing that keeps working when the painter is up a
ladder with wet hands — the reason to stay, not the reason to start.

### 6. Invoice and payment (2:00)
**Click:** the draft invoice created in beat 4 → `Send`.
**Say:** "Same as the quote — real email, and it mirrors the quote's design
exactly, because your client shouldn't have to re-recognize your business
between the two documents."
**If Stripe Connect is connected on this demo account** (checklist item 8):
open the client's payment view and actually click "Pay now" through a Stripe
test card. **If it is not connected:** narrate instead — "from here your
client pays by card, right in the email or the portal, and the money lands
in your bank account, not ours — that's Stripe Connect, and you'd set it up
once in Settings, the same real bank-verification flow any payment processor
uses." Do not attempt to start that onboarding live.
**Feel:** the loop closes — quoted, accepted, scheduled, billed, paid,
without leaving one app.
**The number that lands:** the amount, marked paid, on the invoice.

### 7. The numbers underneath (1:30)
**Click:** `/app/analytics/kpis`.
**Say:** "And this is the part most software never shows you — not just what
you billed, but whether it was worth doing." Point at the minimum-price
figures from Settings → Overhead if they're visible here too, and at
whichever KPI tile has real data from the seeded jobs (win rate, a
receivables aging bucket, anything that isn't a dash). Say clearly: **"a
number you were never shown here shows as a dash, on purpose — we don't make
up a business's numbers."** That's a feature, not a gap, and naming it builds
trust faster than pretending every tile is full.
**Feel:** this isn't a toy — it's the same discipline an accountant would
insist on.
**The number that lands:** the minimum price figure from step 3 of the
checklist, said out loud: "so you now know that under $X, you're losing
money on a job, and nothing before today told you that."

### 8. Close (0:30)
**Say:** "That's lead to paid, one app, your brand on every page the client
sees. First month's free, and at two of you it's $90 a month after that."
Ask what they want to see again, or what didn't fit — don't cram in a second
feature in the last thirty seconds.

**Total: 1:30 + 4:00 + 2:00 + 2:00 + 1:30 + 2:00 + 1:30 + 0:30 = 15:00.**

---

## PART C — What cannot be demoed live, and what to do instead

### The AI receptionist cannot take a real call on this account
`lib/voice/demoLine.js` is explicit about this by design, not by omission: a
demo account cannot buy a real, dialable number
(`app/api/settings/voice/number/route.js` refuses it — a purchased number
outlives the demo, keeps billing FieldQuo, and is a real line a stranger
could dial after the account gets re-dressed as a different trade next
week). Instead, the demo line is a **simulated** number from NANP's reserved
fictional block (`555-01XX`), with a real agent built from the company's real
data attached to it — everything about the *setup* is genuine, only the
number itself cannot ring.

The settings screen (`/app/settings/voice`) says this to the contractor in
plain language and, when FieldQuo's own real sales line is configured and
live, invites them to **"Ring {number} to hear the real receptionist
answer"** — `demo.fieldquoNumberDisplay` in `app/api/settings/voice/route.js`,
which only ever populates when `PlatformVoiceAgent` (id `fieldquo`) is
actually `enabled` in the database. **This is not guaranteed to be true at
demo time** — confirm it yourself by placing the call once before the
prospect call (checklist item 9). If it's off, do not promise the live-call
moment; show the call log and the settings screen instead, both of which are
completely real.

### Stripe Connect cannot be onboarded live
Covered in checklist item 8 and script beat 6. There is no demo-specific
shortcut for this in the codebase — it's the same real onboarding flow a
paying company uses, and starting it live either burns several minutes on
fictional business details or dead-ends. Check the connection status ahead
of time and plan accordingly.

### Marketing Designer is ad-creative generation, not a website builder
Walked as requested, and worth naming precisely so nobody promises the wrong
thing: `/app/marketing/designer` (`app/app/marketing/designer/page.js`)
generates social **ad images** organized by campaign — it is not the site
builder. It's a genuinely nice feature but it is not a fit for this
audience's first fifteen minutes (a solo painter who hasn't quoted digitally
before does not yet need paid ad creative), and it spends AI image credit
(12 credits/generation) that this script is deliberately conserving for the
core loop. **Cut from the 15-minute script on purpose** — mention it exists,
in one sentence, only if there's time left over or they ask about
marketing.

### AI credit is finite and shared across a whole call queue
One shared wallet backs image generation *and* the vision "deep read"
(`lib/ai/imageEconomics.js` — deliberately one pool, because a contractor
who paid for "AI" and is then told this particular AI needs a separate
wallet feels cheated). 1,000 credits is a comfortable one-call budget (~83
generations or ~40 deep reads) but it is **not refilled automatically**
between calls on the same demo account — see checklist item 7.

---

## PART D — "If they ask about X"

**"What does it cost?"**
$45 per licensed seat for up to 9 employees (`lib/pricing.js`,
`calculatePricing()`). A solo painter plus the one new hire is 2 licenses =
**$90/month**. The first month is genuinely free — `TRIAL_PRICE = 0`, not a
$1 token charge, on purpose, so there's no card-form friction before they've
even tried it. At 10+ employees the per-seat price steps down.

**"Is my data mine?"**
Two separate guarantees, both enforced twice in code, not just promised in
copy:
- FieldQuo's own staff can **view but never edit** a company's data through
  the platform console (non-negotiable #3), and even a superadmin's
  impersonation session is read-only by default, checked in both
  `middleware.js` and `lib/currentMember.js` deliberately twice
  (non-negotiable #2). The one exception — write-enabled `demo_sandbox`
  mode — only ever applies to the ten fixture demo companies, gated on
  `Company.isDemo` read fresh from the database every time, never from
  anything a request claims about itself.
- Cancelling doesn't delete anything. It drops the account to read-only
  immediately (see below) — the data stays, visible, exportable in the
  normal ways; nothing is purged on cancel.

**"Does it work on a phone, in a driveway, on bad signal?"**
You just showed them, in beat 4 — the client-facing quote-approval page
(`/q/[token]`) is the same page whether it's opened on a laptop or a phone,
including the signature capture. The booking page (`/book/[slug]`) is
explicitly built to run inside a 600px iframe embed on someone else's site,
which is the same "small screen, no assumptions about surrounding layout"
constraint a phone imposes. The back office (`/app`) itself is responsive
throughout — usable, if not ideal, from a phone mid-job.

**"What happens if I cancel?"**
Immediately, not at the end of the billing period — pressing Cancel calls
`stripe.subscriptions.cancel()` with no `cancel_at_period_end`, so the
subscription ends right then, and there's no refund of the unused remainder
of the month. Access drops to **read-only** the moment that happens — the
company can see everything (quotes, clients, invoice history) but can't
create anything new until they resubscribe. The cancellation screen itself
shows the *specific* consequences for that company before the final click
(a phone number that would be released, a website that would go offline,
etc.) rather than a generic warning — and it asks why first, before offering
anything to keep them, on the theory that a discount offered before anyone
asked the right question is expensive and unconvincing.

---

## What's genuinely half-built or unverifiable from this pass

Said plainly, per the project's own rule about never promising a screen that
isn't there:

- **Whether FieldQuo's own sales line is actually live in production right
  now** could not be confirmed by reading code — it depends on
  `PlatformVoiceAgent.enabled` in the live database, which this pass did not
  query. Confirm by placing the call yourself (checklist item 9) before
  offering it to a prospect.
- **Whether the `demo1` Stripe Connect account is currently onboarded**,
  same caveat — a database/Stripe-dashboard fact, not a code fact. Confirm
  ahead of time (checklist item 8).
- The exact dollar figures the minimum-price card will show for the sample
  overhead numbers in checklist step 3 were not hand-computed against
  `lib/analytics/burnRate.js`'s full logic (interest-only debt handling,
  double-count guards) — they will be real and self-consistent once entered,
  but don't quote a specific dollar figure from this document as gospel;
  read it off the screen live.
