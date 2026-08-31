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

## How to use this document

Open **Part B** on a second screen and read it out loud, word for word,
while you click through the demo on the main screen. That's the whole
system:

- **Plain text = say it.** Read it as written. It's written the way you
  already talk, so reading it straight should sound normal, not like you're
  reading.
- **`[Bracketed lines] = do it, don't say it.`** Every stage direction is
  bracketed and on its own line, separate from anything you speak. If you
  ever catch yourself about to read a bracket out loud, stop — that's the
  signal you drifted off-script.
- **Bold headers over each block are timings**, e.g. `(1:30)`. They tell you
  the pace, not a stopwatch to watch — glance at the clock once or twice
  during the call, not constantly.
- **Part A is a checklist, done before you dial in — never read aloud.** It's
  in dependency order: skip a step and a later screen goes blank or a control
  disappears, silently.
- **Parts C and D are reference, not spoken.** Part C explains what you
  cannot demo live and why. Part D is your answer key for questions that come
  up — read the answer that matches the question, in your own words, if
  asked; don't recite it as prose.

Five minutes before a call: skim Part A's checklist top to bottom, confirm
each box, then open Part B and start reading from "1. Open."

---

## 0. The account, and what "demo" means here

*(Not read aloud — background, done once, not per call.)*

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

**NOT READ ALOUD. Done before the call, alone, with no prospect watching.**

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

**READ ALOUD, VERBATIM.** Plain text is what you say. Bracketed lines are
what you do — don't say them. Bold headers are timings. Read straight down
the page in order.

Shape: the contractor's own day, not the product's menu. A job shows up, it
becomes a priced document in front of the customer, the customer says yes on
their own phone, and — without another click — a job appears on the
schedule and a draft invoice is already sitting there. Then the invoice goes
out, gets paid, and the numbers underneath say whether it was worth doing.
The receptionist gets one deliberate slot in the middle, not the opening,
because speed-and-professional-looking is what makes this person switch on
day one; a phone robot is the thing that keeps them once they're in.

Total: 15:00.

### 1. Open — the contrast, fast — **(1:30)**

[Land on `/app`, the dashboard.]

This is what you'd see every morning instead of the spreadsheet. Everything
on this page is real — money owed, what came in this month, what's
scheduled.

[Point at the Needs You panel at the top, if it's showing anything — it will
be, from the seeded receptionist calls.]

And this is what happened while you were on a ladder. A call came in, the AI
answered it, and it's sitting here waiting on you — not lost in a voicemail
you'll check at nine tonight.

[Point at the receivables tile.]

That's real money owed, right there. Not a demo number.

[Move on. Don't linger here — this is the appetizer, not the meal.]

### 2. Build the quote, live, in front of "the customer" — **(4:00)**

[Click `+ New Quote` from the dashboard, or go to `/app/quotes/new`.]

Say you just walked the outside of a house with someone. This is what you'd
do standing in their driveway, or that evening at the kitchen table.

[Create the client live — a real-sounding name and address, typed in front
of them.]

[Pick Exterior painting — siding. Punch in a plausible square footage.]

[While it's pricing itself, keep talking — this is dead air otherwise:]

Every number here is coming off your own rate card, not something I typed
in. We set that up in Settings a minute ago.

[Add a second line — trim, or a drywall repair hour.]

That's so it's not a one-line calculator — real jobs have more than one
line, and so does this.

[Point at the total.]

That took less time than finding the estimate you wrote on the back of a
business card last month.

*[If the price feels slow to calculate: keep talking through it — "it's
pulling live off your rate card, one second" — do not go silent while you
wait.]*

**If they interrupt here — "how much is it":**
Say: "Good question — I'll show you exactly what this quote costs to send
in a second. What FieldQuo itself costs is ninety bucks a month for the two
of you, and I'll come back to that at the end." Then keep building.

### 3. The AI review — upsell, without the hard sell — **(2:00)**

[Save the quote as a draft. Click "Review."]

*[Review needs a saved quote — if the button looks inactive, the save
hasn't landed yet. Say "just saving it" and wait a beat rather than
re-clicking.]*

Before you send it, one click asks: what did I usually sell alongside this
that I might have forgotten?

[Let it propose an add-on — a second coat upgrade, a deck stain, whatever it
surfaces. Add one to the quote.]

That's not a script telling you to upsell. That's someone who's seen a
thousand of these jobs, tapping you on the shoulder before you hit send.

[Point at the new total.]

That's real money, added with one click, that you might have just forgotten
to ask for.

*[If photos are on the quote, add one line, don't demo it live: "If you'd
attached photos, this same button reads them too, and catches things like
missed prep work." Don't run a live deep read here — it spends AI credit and
it's not today's story.]*

### 4. Send it, and the customer accepts on their own phone — **(2:00)**

[Click Send on the quote detail page.]

That just actually sent — real email, not a mockup.

[Click "Get approved" on the quote detail page. Open the resulting link on a
second device — your own phone, or a second browser tab.]

This is exactly what they'd see. Nothing fake about this screen — it's the
same link that just went out in their inbox.

[Walk the two-step confirm. Sign on the pad with a finger or the mouse.
Accept.]

*[If the signature pad doesn't respond first tap: tap again, closer to the
line — it's a real canvas, not a bug, but it can miss a light first touch.]*

[Flip back to the quote detail tab. Don't touch anything else.]

Look at that — you didn't do anything else, and the quote now says accepted.
There's already a job sitting on your schedule, and there's already a draft
invoice, both created the second they signed. That's the whole pipeline
moving on its own.

**If they interrupt here — "can I do this on my phone":**
Say: "You're looking at it — that's the same page whether it's a laptop or
a phone, signature and all. Your back office is the same story, usable from
a truck." Then continue.

**If they interrupt here — "what if my customer doesn't have email":**
Say: "Then you send the same link by text instead — it's the identical page,
it just doesn't require an inbox." Then continue.

### 5. The job, and — briefly — the receptionist — **(1:30)**

[Click into the new job, or open `/app/appointments` to show a visit can be
scheduled against it.]

And this happens on the phone too, not just online.

[Open `/app/receptionist`.]

Every call your business gets, answered, every time, even nine o'clock on a
Sunday.

[Show the seeded call list — a real summary, a flagged voicemail that needs
a callback.]

That's a real summary of a real call, not a transcript nobody reads.

*[Only say the next line if you personally confirmed FieldQuo's own line was
live before this call — checklist item 9. If you didn't confirm it, skip
straight to beat 6 without offering the call.]*

Want to actually hear it? Call {number} right now.

**If they interrupt here — "I already use QuickBooks":**
Say: "Good — keep it. This isn't your books, it's everything upstream of
them: the quote, the job, the invoice. It hands off cleanly whenever you're
ready to export." Then continue to the job or the receptionist, whichever
you were on.

### 6. Invoice and payment — **(2:00)**

[Open the draft invoice created in beat 4. Click Send.]

Same as the quote — real email, and it mirrors the quote's design exactly,
because your client shouldn't have to re-recognize your business between the
two documents.

*[If Stripe Connect is connected on this demo account — checklist item 8 —
continue with the next line and actually click Pay now with a Stripe test
card. If it is not connected, skip straight to the line after that instead.]*

[If connected: open the client's payment view, click Pay now, use a Stripe
test card.]

From here your client pays by card, right in the email or the portal.

[If not connected, say instead:]

From here your client pays by card, right in the email or the portal, and
the money lands in your bank account, not ours — that's Stripe Connect. You
set it up once in Settings, same real bank-verification flow any payment
processor uses. I'm not going to run that live today, it's a few minutes of
paperwork, not a demo.

[Point at the invoice total, marked paid — or, if not run live, describe
what the paid state looks like.]

Quoted, accepted, scheduled, billed, paid — without leaving one app.

### 7. The numbers underneath — **(1:30)**

[Open `/app/analytics/kpis`.]

And this is the part most software never shows you — not just what you
billed, but whether it was worth doing.

[Point at whichever KPI tile has real data — win rate, a receivables aging
bucket, anything that isn't a dash.]

*[If a tile does show a dash, don't skip past it — name it:]*

That dash isn't a bug. A number we were never given shows as a dash, on
purpose — this app doesn't make up your numbers for you.

[Point at the minimum price figure, read off the screen live — don't recite
a number from memory.]

So now you know that under that number, you're losing money on a job. Until
today, nothing told you that.

### 8. Close — **(0:30)**

That's lead to paid, one app, your brand on every page your client sees.
First month's free. After that, at two of you, it's ninety dollars a month.

What do you want to see again, or what didn't we get to?

*[Stop talking after asking. Let them answer. Don't add a second feature in
the last thirty seconds.]*

---

**Recovery, if something breaks mid-demo:** Don't apologize at length and
don't troubleshoot live with the prospect watching. Say: "That's a display
hiccup on the demo account, not something your business would ever see" —
true in every case above, since every genuine gap here is a documented
demo-only limitation, not a broken feature — then move to the next beat and
come back to the skipped one only if time allows. If the whole session
looks dead, say "let me get you a cleaner window in one second," open
`/platform/demo` in another tab, and re-enter fresh (see Part 0, "Getting
in") rather than reloading and hoping.

**Total: 1:30 + 4:00 + 2:00 + 2:00 + 1:30 + 2:00 + 1:30 + 0:30 = 15:00.**

---

## PART C — What cannot be demoed live, and what to do instead

**NOT READ ALOUD — reference only.**

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

**NOT READ ALOUD — reference only. Answer in your own words, matched to the
question asked; don't recite this as prose.**

**"What does it cost?"**
Four flat-rate plans (`lib/pricing/ladder.js`, `SEAT_LADDER`), not a
per-licence rate: **Solo $99** (1 seat + 5 free crew), **Crew $169** (3 seats
+ 8 crew), **Shop $269** (6 seats + 11 crew), **Scale $369** (10 seats + 15
crew). A seat is anyone who can create or change a quote, job or invoice;
crew — schedule, clock-in, photos — are free. The first month is genuinely
free — `TRIAL_PRICE = 0`, not a $1 token charge, on purpose, so there's no
card-form friction before they've even tried it. A team bigger than Scale is
a conversation, not a self-serve price — point them at Contact.

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

**NOT READ ALOUD — reference only.**

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
