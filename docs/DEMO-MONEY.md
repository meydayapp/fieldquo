# FieldQuo demo — Money, job costing & insights — 15 minutes

This is one block in a series. Same audience as `docs/DEMO-SCRIPT.md` (the
solo painter about to hire their first person), same account, same
`demo_sandbox` mechanics, same 30-minute session window — read that
document's section 0 first if you haven't, this one doesn't repeat it.

**This is a script, not a briefing.** Part B below is written to be read
**out loud, verbatim**, off a second screen, while you click. Every spoken
line is a full sentence in plain words — read it as written. Stage
directions are separate, in **brackets and italics, on their own line** —
never read those out loud.

Their real problem isn't "analytics." It's that they don't actually know
whether last month made money, and they suspect some jobs lose it. Everything
below answers exactly two questions and nothing else: **what's the least I
can charge and not lose money, and did the last job actually make what I
thought?**

---

## PART A — Setup checklist, in dependency order

*(Prose. Done before the call. Not read aloud.)*

The numbers spoken in Part B are not made up — every dollar figure in this
document was run through the real, unmodified production functions
(`lib/accounting/depreciation.js`, `lib/analytics/burnRate.js`,
`lib/analytics/minimumPrice.js`) with the exact inputs listed below, the same
way `scripts/check-overhead-arithmetic.mjs` proves the owner's own reported
figures. **If you type in different numbers, every dollar figure in Part B
changes** — read the screen, don't recite this document from memory, if your
setup differs from what's listed here.

### 0. A job with a real quote behind it — do this first if it doesn't exist
**Why first:** the job-costing beat (Part B, beat 5) needs a job whose quote
was actually saved through the quote builder, because that's what writes the
server-side `QuoteCosting` snapshot the comparison reads
(`quotedCostFor` in `app/api/jobs/[id]/costing/route.js`). A demo-seeded quote
from `wipeContent()`/`seedDemo.js` does **not** carry this snapshot — it was
never built through the browser, so `comparison.profit` will be `null` and
the "Quoted / Left after costs / Margin" row simply won't render.
**What to do:** if you already ran `DEMO-SCRIPT.md`'s quote-to-cash demo
earlier in this session, use that job — it's real, it has a snapshot, use it.
Otherwise, build and accept one quick quote first, the same two minutes as
that script's beats 2 and 4: new client, one line of exterior painting, save,
send, approve it as the client on a second tab. You now have a real job.
**Breaks if skipped:** the job-costing panel still shows Expenses/Labour/Total
cost, but the Quoted/Margin row — the one that actually answers "did this job
make money" — won't appear.

### 1. Capacity — the one number that gates everything, do this first among the money numbers
**Where:** `/app/settings/overhead`, "Jobs per week."
**What:** `lib/analytics/minimumPrice.js` divides your monthly cost by
`capacity × 4.33`. There is **no default** — the code comment says plainly
that a made-up "3 jobs/week" used to be silently assumed here, and that was
treated as a bug and removed. Without it, `needsCapacity: true` comes back and
the whole minimum-price card renders nothing but the sentence "How many jobs
can your crew take on in a normal week?"
**Set it to `2`.** Two jobs a week — a solo painter with one more set of
hands — is what every number below is computed against.
**Breaks if skipped:** the card is blank, silently, and nothing on screen
says why mid-sentence. This is also the beat where you'll clear it live on
purpose (Part B, beat 1) — leave it set to 2 walking in.

### 2. Fixed costs and salary
**Where:** same page, "Fixed costs" and "Salaries" sections.
**Add:**
- Liability insurance — $175/month
- Phone + software subscriptions — $90/month
- Storage/shop space — $220/month
- Salary: **Owner's draw — $4,200/month** (the screen's own note is explicit
  this is the owner's draw or an office wage counted as overhead, not the
  crew member's hourly rate — don't conflate them)

Fixed costs total: **$485/month.**

### 3. The truck — deliberately unlinked
**Where:** same page, "Debt" then "Assets & depreciation."
**Why this diverges from `DEMO-SCRIPT.md`:** that document recommends
*skipping* debt and assets entirely, because the double-count banner it can
trigger "derails a 15-minute call into an unplanned explanation." This block
is the one built specifically to have that explanation — on purpose, at a
controlled moment.
**Add a Debt:** name "Truck loan," monthly payment **$650**, interest rate
**0%** (principal left at 0 — matches the reported-numbers script's own
test case for a $0/mo interest loan).
**Add an Asset:** name "Truck," cost **$54,000**, useful life **60 months**,
in-service date **about a year ago**. **Leave "Bought with which loan?" set
to "Paid outright — no loan"** — do not link it yet. Linking it live is Part
B, beat 4.
**Verified output with this exact setup** (capacity 2, fixed $485, salary
$4,200, this truck, unlinked):
- Monthly cost (P&L): **$6,235** — cost/job **$720** — minimum price **$900**
  at 20% margin — and the double-count banner is showing.
- Cash actually leaving the bank: **$5,335/month.**
- Once linked (Part B, beat 4): monthly cost drops to **$5,585**, cost/job to
  **$645**, minimum price to **$806**. Cash stays $5,335 — linking never
  touches what leaves the bank.

### 4. Material costs — optional, confirm the badge, don't rebuild
**Where:** `/app/settings/material-costs`.
**What:** confirm "Exterior Painting" shows the **"Default"** badge, not
"Custom" — nothing needs to be typed in here for real numbers to already be
flowing. Only useful to touch live if there's spare time (see Part D).

### 5. One expense logged against the job from step 0
**Where:** Settings → Expense tracking, "Add expense," tag it to the job.
**What:** a real, plausible line — e.g. "Paint & materials — $410" — with the
category set to Materials, dated inside the current KPI period (this month).
This is what makes the job-costing panel's Expenses tile non-blank when you
open the job live.

### 6. Leave one buy-list item on that same job un-bought
**Where:** the job page, the materials buy list (`JobMaterials`), underneath
the costing panel.
**What:** don't touch it ahead of time — you're going to mark one item
"bought" and type a real cost into it **live**, in Part B beat 5, to trigger
the materials-trap warning on the KPI page on purpose. If every item is
already marked bought from a prior run-through, add one more line item first
so there's something left to check off.

### 7. Confirm the KPI page's period covers today
**Where:** `/app/analytics/kpis`.
**What:** the default preset (e.g. "This month") should cover the date you
logged the expense in step 5 and the date you'll mark the buy-list item
bought in Part B. If it doesn't, the money-flow section and the trap banner
will show nothing, silently, for a reason that has nothing to do with the
product working — just a date-range mismatch. Pick a period that covers
today.

**What this checklist does NOT include on purpose:** a live bank-statement
CSV import. See Part C for why.

---

## PART B — The script

*(Read this section aloud, verbatim, exactly as written. Stage directions are
in brackets and italics — those are for you, never say them out loud.)*

### 0:00–0:30 — Open

Every contractor I talk to can tell me what they billed last month. Almost
none of them can tell me if they made money. That's what this next part is
for. Two questions, that's it: what's the least I can charge and not lose
money, and did the last job I did actually make what I thought it did?

*[open /app/settings/overhead]*

### 0:30–2:00 — Capacity, the one number that gates everything

This page is where your price floor lives. But none of it works without one
number — how many jobs a week you can actually run. Watch what happens if I
take that away.

*[clear the "Jobs per week" field, click Save]*

Nothing. No price floor, no minimum price, no numbers at all. And that's on
purpose — the software isn't going to guess how busy you are and hand you a
price built on a guess. It used to assume three jobs a week for every
company, whether that was true or not, and that's exactly the kind of thing
that gets a contractor in trouble. So now it just asks you.

*[type "2", click Save]*

Two jobs a week — you, plus one more set of hands. Save it, and everything
underneath comes alive.

*[point at the four tiles: Monthly fixed costs / Jobs per month / Cost per
job / Minimum price]*

**If they interrupt — "I don't have time to fill all this in":**
It's four numbers, total — your rent and insurance, your own pay, this field,
and your truck if you've got one. Ten minutes, once. And it's the ten minutes
that tells you if you've been pricing yourself into the ground.

### 2:00–3:00 — Fixed costs and salary, building the floor

Under that is what it actually costs you to keep the lights on. I've put in
a hundred seventy-five for insurance, ninety for phone and software, two
twenty for storage.

*[point at the Fixed costs list]*

And your own pay — forty-two hundred a month. You paying yourself is a real
cost of running this business, not something that happens after everything
else is covered.

*[point at Salaries]*

Add that up and that's your floor before we've even talked about a truck.

### 3:00–6:30 — The truck: cash versus cost

Now the truck. This is the one thing every contractor gets tangled up on,
and it's worth slowing down for, because it's the single biggest thing your
bank balance is hiding from you.

Say you're paying six hundred fifty a month on a truck loan, and the truck
itself cost fifty-four thousand dollars and it'll last you five years.
Six-fifty a month is real money leaving your account — that's cash. But it
is not what the truck costs you. What the truck costs you is it wearing out.
Fifty-four thousand dollars over five years is nine hundred dollars a month
of wear, whether or not you've still got a payment on that loan. That's
depreciation — a real cost, but no money moves when it happens.

Here's the trap. If you only ever look at your bank account, you never see
the wear — and the month your loan ends, the truck disappears from your
numbers even though it's still wearing out and you'll still have to replace
it one day. If you count the whole loan payment **and** the wear, you're
charging yourself for the same truck twice. This screen does the honest
version. It shows you both numbers, and it tells you why they're different.

*[point at the minimum-price card, then the note below it: "Actual cash
leaving the bank is $5,335/mo"]*

Right now this says my real cost of running this business is six thousand
two hundred thirty-five dollars a month. But what's actually leaving my bank
account is five thousand three hundred thirty-five. Nine hundred dollars is
the gap, and that's not a mistake — that's the truck wearing out, sitting on
my books whether I go looking for it or not.

**If they interrupt — "I already have an accountant":**
Your accountant sees this once a year, after tax season's already told you
the answer. This is the same math, live, every time you type in a price —
so you find out before you quote the job, not after.

### 6:30–8:30 — The double-count warning, live

And here's the part that actually protects you. Right now I've got that
truck loan and that truck sitting on this screen as two separate things — a
loan, and an asset — and I haven't told it they're the same truck. Watch
what it does about that.

*[point at the amber double-count warning banner]*

It's telling me straight: you've got an asset with no loan linked, and a
loan with no asset linked — if these are the same truck, you're charging
yourself for it twice. It won't guess for me. It won't quietly fix it behind
my back. It just stops and tells me to go look.

*[click the truck's "Bought with which loan?" dropdown, select the truck
loan]*

So I tell it — yes, same truck. Watch the numbers.

*[point at the updated Monthly fixed costs / Cost per job / Minimum price
tiles, and the warning disappearing]*

My cost just dropped from six thousand two hundred thirty-five to five
thousand five hundred eighty-five a month. Six hundred fifty dollars I was
charging myself twice, every single month, without knowing it. That's real
money, and nothing about my bank account would ever have told me.

### 8:30–11:30 — Did the last job make money, and the materials trap

Now the second question. Did the last job actually make what I thought it
would? That's not a settings screen — that's on the job itself.

*[open the job from setup step 0]*

Every expense you've tagged to this job, every hour your crew logged and you
approved, shows up right here, next to what you quoted it at.

*[point at Expenses / Labour / Overhead / Total cost tiles, then the
Quoted / Left after costs / Margin row]*

That number — left after costs — that's not a percentage knocked off the top.
That's what actually stayed in the business from doing this one job. If
that's ever showing red, that's the job that was quietly losing you money,
and until today nothing told you that.

One more thing, because this is where most contractors get caught. Say I
buy the paint for this job.

*[open the materials buy list underneath, mark one item "bought," type in a
real cost — e.g. $340]*

I check it off here so I remember it's bought — but I never actually go log
it as an expense back on that other screen. That happens all the time.
You paid for it at the till, and it never made it into your books as a cost.

*[navigate to /app/analytics/kpis, Money flow section]*

Watch what the numbers page does about that.

*[point at the amber materials-trap banner]*

It's telling me: these jobs bought three hundred forty dollars of material
off the buy list, and none of that ever got logged as an expense. The
number below it is real — it just doesn't include that yet. It's not going
to quietly under-count your costs and let you think you made more than you
did. It flags it and tells you exactly what to go log.

### 11:30–14:00 — The numbers page: money in, money owed, what it won't guess at

This is the page I'd want open every Monday morning.

*[point at Income / Expenses / Remaining tiles]*

What actually came in. What's actually been logged, or pulled in off a bank
statement — never a guess at what's missing. And what's left over.

*[scroll to the Cash section, receivables aging]*

And this is what you're owed right now, and how old each part of it is.

*[scroll to the "Not tracked" panel]*

Now — this is the part I actually want you to notice. There's a whole
section on this page called "Not tracked." Cost per lead. Rework rate.
Customer satisfaction. It tells you flat out why it doesn't have those
numbers, instead of making one up. I'd rather show you six honest blanks
than one number I can't stand behind.

### 14:00–15:00 — Close

So that's it. One screen tells you the least you can charge and not lose
money. One screen tells you whether the last job actually made it. And
everywhere in between, if the software doesn't know something, it says so —
it doesn't make it up. That's the whole point of this part. Not more
numbers. Numbers you can actually trust.

What part of this would change how you price a job tomorrow?

**Total: 0:30 + 1:30 + 1:00 + 3:30 + 2:00 + 3:00 + 2:30 + 1:00 = 15:00.**

---

## PART C — What cannot, or should not, be demoed live here

*(Reference material. Not read aloud.)*

### The bank-statement CSV import is deliberately cut
`app/app/settings/expense-tracking/import/page.js` is a real, working
three-step flow — upload, map the columns (with date-format and sign-
convention auto-detection), then a review screen that flags likely
duplicates and separates deposits ("not expenses") from real spend. It's
genuinely good and worth five minutes of its own. It does not fit in this
15 minutes on top of everything else, and there's no seeded sample CSV in
the repo to import against — you'd need to bring your own tiny file. If
asked, point at the "Import a bank statement →" link on the KPI page's
Money flow section (it's already visible there) and say it's a five-minute
job you can walk them through separately, don't attempt it live.

### Win/loss, estimate accuracy, and the full P&L/cash-flow statements are not walked live
All three are real and reached via the Insights hub
(`/app/analytics/benchmark`) or linked directly from the KPI page's own
"Full report →" links (Execution section → estimate accuracy; Cash section →
statements). They're one sentence in Part D if asked, not a beat of their
own — this block is already full at 15 minutes with the two questions it's
built to answer.

### The materials-trap warning and the "Not tracked" panel are not bugs to fix live
If a prospect points at either and asks "when will that be built," don't
improvise a timeline. The trap banner is telling the truth about their own
bookkeeping, not describing a missing feature; the "Not tracked" panel names
real gaps (no campaign/UTM tracking on leads, no callback flag on a job, no
client satisfaction survey anywhere in the product, no equipment-usage log,
no change-order model distinct from a plain quote edit) — see
`lib/analytics/kpis.js`'s `NOT_TRACKED` array for the exact six and their
reasons, verbatim, if asked for detail.

---

## PART D — "If they ask about X"

*(Reference material. Not read aloud.)*

**"What if I don't have a truck, or any debt at all?"**
Skip the Debt and Assets sections entirely — the floor still computes fine
from fixed costs and salary alone. Nothing about the minimum-price math
requires a loan or an asset to exist.

**"Does this replace my accountant or bookkeeper?"**
No, and don't imply it does. `/app/analytics/statements` produces a real
P&L, cash flow, sales tax summary, and as much of a balance sheet as the
data honestly supports — genuinely useful for a lender or a bookkeeper — but
this 15 minutes is about a pricing decision made on the fly, not a filing.
Two different jobs.

**"Can I see profit across all my jobs at once, ranked?"**
Honestly, no — not yet. Per-job costing is real and feeds the company-wide
KPI dashboard, but there is no report that lists every job with its own
margin, ranked best to worst. Say that plainly if asked; don't describe a
workaround that isn't there.

**"What if my materials costs still look wrong after I fix the trap?"**
Point them at Settings → Material Costs — the coverage rates, per-gallon
cost, and coat counts there drive every quote's estimated material cost, and
a company's own numbers can replace the shipped defaults any time (the
Default/Custom badge on each category shows which is in effect).

**"Why does the job's total cost sometimes say it's incomplete?"**
Two honest reasons, both named right on the panel: hours still waiting on a
manager's approval aren't counted yet, and hours logged by someone with no
hourly rate on file cost nothing in the total because there's no rate to
multiply by. Neither is invented as zero silently — the panel says which one
applies.

---

## What's genuinely half-built or unverifiable from this pass

- **Whether `demo1` (or whichever demo account you're on) currently has a
  completed job with a real `QuoteCosting` snapshot and logged expenses** is
  a live-database fact, not a code fact — this pass could not confirm it.
  Part A, step 0 tells you how to build one if it's missing; check before you
  dial in, the same discipline `DEMO-SCRIPT.md` asks for Stripe Connect and
  the voice line.
- **No sample bank-statement CSV exists in this repository** to import
  against live. If you want to actually run that flow with a prospect
  (cut from this 15-minute script on purpose — see Part C), bring your own
  small file; nothing here builds or ships one.
- **The dollar figures throughout Part B are provably correct for the exact
  inputs listed in Part A** — they were run through the real, unmodified
  `assetOverhead`, `combineBurnRate`, and `priceFromBurn` functions during
  this pass, not hand-computed. They are **not** correct if you type in
  different numbers for capacity, fixed costs, salary, or the truck — reread
  the screen live in that case rather than reciting this document.
- **The quote builder's own cost/margin panel does *not* go blank without
  capacity**, which is worth knowing even though this block doesn't demo the
  quote builder: `CostMarginPanel.js` falls back to a flat 10% of the price,
  explicitly labelled "a flat percentage of the price because we don't know
  your capacity yet." Only the Settings → Overhead minimum-price card itself
  goes fully blank on `needsCapacity`. Don't describe the two screens as
  behaving identically if asked — they don't, and the difference is a
  deliberate design choice (a quote still needs *some* number to work with;
  the price-floor calculator does not).
- **Whether the seeded painting demo already has any buy-list items left
  un-bought** for the live materials-trap moment (Part A, step 6) was not
  checked against a live database — prepare this by hand regardless of what
  the seed produces.
