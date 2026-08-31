# FieldQuo demo — Crew, Scheduling and Payroll — 15 minutes, for a solo painter hiring their first employee

Who this is for: the same painter from the quote-to-cash demo, at the moment
they take on their first person. This is not a workforce-management pitch —
they are not managing twelve people, they are about to be responsible for
somebody else's wages for the first time, and they are nervous about it. The
whole block is one promise: *you will not lose track of what you owe him, and
you will not have to chase him for hours.*

This is one block in a series (see `docs/DEMO-SCRIPT.md` for the quote-to-cash
block). Same account, same fixture company, same rules about what "demo"
means here — read `docs/DEMO-SCRIPT.md` section 0 if you haven't already.

**How to use this document.** Part B is written to be read aloud, word for
word, off a second screen while you click through the product live. Stage
directions are in **`[brackets, their own line]`** — those are for you, don't
read them out loud. Everything else in Part B is the sentence you actually
say. Parts A, C and D are reference material for before and after the call —
not read aloud.

---

## PART A — Setup checklist, in dependency order (done before the call)

### 0. Continue the session, or start fresh
If you're running this straight after the quote-to-cash block, you're already
in `/app` as the painting demo's owner in `demo_sandbox` mode — keep going. If
you're opening this block cold, follow `docs/DEMO-SCRIPT.md` section 0 first:
`/platform/demo` → the painting demo → **"Run the demo."** Remember the
30-minute session box — do the setup, then re-enter fresh before you dial in.

### 1. Confirm the plan has room for a live add
**Where:** `/app/settings/team`.
**What:** look at the two counters — "**{n} seats used**" and "**{n} crew —
included free**". You need at least one free crew place for the live add in
Beat 1. If crew is full, the "Add crew — free" button is disabled with "You've
used every crew place on your plan." — either bump the demo company to a
higher tier ahead of time, or use the disabled state on purpose (see Part C).
**Breaks if skipped:** the live "add a person" moment turns into an upgrade
screen instead of a person being created.

### 2. Add Mike — the hire, with a real hourly rate
**Where:** `/app/settings/team` → **"Add crew — free"** →
`/app/settings/team/new?kind=crew` (this opens with the **Crew** preset
already selected — role `worker`).
**What:** if Mike already exists from the quote-to-cash demo (checklist item
2 there), confirm he's `active` on `/app/settings/team/workers` and has an
hourly rate. If not, create him now: name, email, and — the field that
matters — **Labour cost** ($/hr), e.g. `$28.00`. This is the same
`worker.hourlyRate` the quote builder's cost/margin panel reads, so setting it
here keeps both demos consistent.
**Note for yourself:** the submit button says **"Send invite"** even though a
Crew member never touches the office side — that's just the button's label
everywhere on this screen, don't stumble over it live.
**Breaks if skipped:** Beat 3's job-costing panel has no approved hours to
show, and the whole "approval gates money" beat has nothing to point at.

### 3. Add Jordan — deliberately no hourly rate
**Where:** same screen, `/app/settings/team/new?kind=crew`.
**What:** a second crew member, **leave Labour cost blank**. This is the demo
prop for two beats: the unrated-worker flag (Beat 3) and nobody-gets-deleted
(Beat 5). Don't fill in a rate "to be safe" — the blank is the point.
**Breaks if skipped:** Beat 3 loses its second half (the flagged-zero-cost
moment), which is the beat that does the most to earn trust.

### 4. Put hours on a real job for both of them
**Where:** pick any job on the account (or create one quickly), then log time
against it — either through `/app/clock` as each worker, or the manual-entry
option on `/app/settings/team/timesheets`.
**What:** give **Mike** one time entry that is still **pending** (don't
approve it yet — you'll approve it live in Beat 3). Give **Jordan** one time
entry that is already **approved** (approve it now, ahead of time, since the
point of Jordan's entry is the unrated flag, not the approval click).
**Breaks if skipped:** the job page's "What this job has cost" panel renders
nothing, or shows neither warning, and Beat 3 has nothing real on screen.

### 5. A shift for Mike on the scheduler, still in draft
**Where:** `/app/scheduler`.
**What:** add a shift for Mike later this week. Leave it unpublished — you'll
hit **Publish week** live in Beat 2.
**Breaks if skipped:** Beat 2 has nothing to publish, and the "shifts stay
hidden until you publish" line has nothing behind it.

### 6. Optional, and worth the extra two minutes: a real availability conflict
**Where:** `/app/settings/availability`, using the manager picker to select
Mike, then unset the day of the shift you just added.
**What:** this makes the live "Schedule anyway" moment in Beat 2 actually
fire, instead of you describing it. **Genuinely optional** — if Mike hasn't
accepted his invite yet and doesn't appear in the picker, skip this and use
the fallback script in Beat 2 (narrate the rule instead of triggering it).
**Breaks if skipped:** nothing breaks — Beat 2 just becomes a description
instead of a demonstration. Worth doing if you have five extra minutes before
the call.

### 7. Confirm Settings → Payroll has no deductions configured
**Where:** `/app/settings/payroll`.
**What:** this should already be empty on a fresh demo company — confirm it.
The pay run in Beat 4 is supposed to show the honest "no deductions are set
up" message live; if someone previously configured `SalaryComponent` rows on
this demo account, that message won't appear and Beat 4's most important line
falls flat.
**Breaks if skipped:** you might get a pay run with numbers already broken
into deductions, which contradicts the "this is gross, we don't guess your
remittances" line.

### 8. Crew inbox — check there's at least one filed item
**Where:** `/app/crew-inbox`.
**What:** if the fixture data doesn't already seed an inbound photo, this beat
is 90 seconds of screen with nothing on it. Either rely on whatever's already
there from prior demo runs, or text a photo to the demo company's crew number
yourself ahead of time so there's something to point at live.
**Breaks if skipped:** Beat 6 becomes a tour of an empty inbox, which is a
weak note to end the working part of the script on.

---

## PART B — The 15-minute script (read this part aloud)

### 0:00–0:45 — Open

**[No click yet — wherever the dashboard left off]**

Right, so last time we did lead to paid — quote, sign, invoice. This bit's
different. This is the day you hire your first guy.

And I'll say it straight — most people are more nervous about this part than
about losing a job. You're now responsible for somebody else's hours and
somebody else's money, and if you get that wrong, it's not a bad quote, it's
a paycheque.

So this whole section really comes down to one promise. You will always know
what you owe him. And you will never have to chase him for hours.

---

### 0:45–3:00 — Crew and seats: the first thing that confuses people

**[click Settings → Team, land on `/app/settings/team`]**

First thing that trips everybody up, so let's get it out of the way early.
There's two kinds of people in this software. Crew — that's anybody actually
on the tools. Painting, driving, on a ladder. And staff — that's anybody who
touches prices, quotes, invoices, money, from a desk or a laptop. Crew is
free. As many as you want. Staff costs money, because staff can move money
around, and that's worth paying for.

Your guy — the one you're hiring — he's crew. He's not writing quotes. He's
not touching a dollar figure anywhere in here. Doesn't matter whether he ever
logs in or not — what matters is what he's allowed to touch, and he can't
touch money.

**[point at the seat/crew counters]**

See these two numbers — seats used, and crew, included free. Used to be one
number, and that confused people, because "used" was doing two jobs at once.
Now it's honest: this many people can touch money, this many people can just
work.

**[click "Add crew — free"]**

So let's add him.

**[fill in name and email on the Crew preset — it's preselected]**

Name, email, so he gets a text when there's a shift. That's it for him. It
says "Send invite" down here — ignore that, he's not logging into an office
screen, that's just what this button's called for everyone who goes through
this form.

**[point at the Labour cost field]**

This one actually matters, though. His true hourly cost — not necessarily
what you hand him, what it actually costs you to have him on a job. This is
the number that turns into a real figure on every job he touches. Skip it,
and on paper he works for free. We'll come back to why that's dangerous in a
minute.

**[Send invite]**

**→ If they jump in here and ask "what's this cost me per person?":** say —
*"Crew's free, so nothing, for him. You're already paying for your own seat.
The day you bring on somebody writing quotes off a laptop, that's a seat, and
that's where it costs something. Him? Free."* — then keep moving.

---

### 3:00–5:30 — Three things that look the same and aren't

**[click Scheduler, `/app/scheduler`]**

Now — three things in here look like the same thing, and they're not, and I
actually want you to get this, because it's the whole reason this doesn't
turn into a mess. There's when he says he **can** work. There's when you've
**planned** for him to work. And there's when he **actually** worked. Three
different screens, on purpose, and they're allowed to disagree with each
other.

**[click Add shift, pick Mike, pick the day you scheduled]**

So this is me planning his week. I'm putting him on a job Thursday.

**[if you set up the availability conflict in Part A step 6 — try to save it]**

Watch what happens if I try to put him on a day he already told me he can't
work.

**[point at the refusal: "Check with them before you go ahead — they won't have agreed to this yet."]**

It doesn't block me. It's my business, my call. But it stops me doing it by
accident — it makes me actually look at it first. If I go ahead anyway, it's
marked right on the shift, and he'll see "outside stated availability" when
it's published. No surprise for him either.

**[if you skipped the availability setup, say this instead:]**
*If I try to schedule him on a day he's told the system he can't work, it
doesn't stop me — but it does stop and ask me first. And it won't let me
override approved time off at all — that one it just says "change the date."*

**[click Publish week]**

And shifts stay hidden until I hit this — publish week. So I can rearrange
his whole week wrong four times before he ever sees a version of it.

**[click Schedule, `/app/schedule`]**

This is the read-only view — what the whole team's week actually looks like,
once it's published.

**[click Clock, `/app/clock`, or narrate if you're not switching accounts]**

And this — this is what **he** sees, on his own phone. Clock in, clock out.
That's the third thing. What he said he could do, what I planned, and what he
actually did. Three separate records. None of them quietly get merged into
one.

---

### 5:30–8:00 — Approval gates money

**[click into the job you logged Mike and Jordan's hours against — `/app/jobs/<id>`]**

Now here's the bit I actually want you to feel, because this is the
difference between this and a spreadsheet.

**[point at the "What this job has cost" panel]**

Mike clocked hours on this job yesterday. They're sitting there **pending**.
Until somebody approves them, they don't cost anything on this job. Not zero
because nobody's counting — zero because it isn't a real cost yet.

**[point at the amber note: "Xh are still waiting for approval and aren't counted yet."]**

See that line. It's not a bug. That's the software refusing to guess.

**[click through to Timesheets, `/app/settings/team/timesheets`, click Approve on Mike's entry]**

I approve it —

**[back to the job page, refresh]**

— and now it's in the number.

**[point at Jordan's line and the second amber note: "Xh were worked by someone with no hourly rate on file, so they're costing nothing here."]**

Now look at this one. Jordan worked hours on this job too. But I never gave
Jordan an hourly rate. Watch what it does — it doesn't just quietly let that
sit at zero. It **flags** it. Tells you exactly why. Because if it just let
an unrated guy's hours disappear, every job he touched would look like your
best job of the month, and it'd be lying to you about why.

That right there — that's the whole point of this software. It's not going
to make your numbers look better than they are.

---

### 8:00–10:30 — Payroll: what it does, and what it honestly doesn't

**[click Payroll, `/app/payroll`]**

Okay — payroll. I want to be straight with you here, because I've seen
software promise more than this, and it burns people. This is **not** going
to file your taxes. It's not going to remit anything to the government. What
it does is take everyone's approved hours, work out what they're owed, and
hand you a clean number to actually pay them with — through your own bank,
same as you already do it.

**[click Calculate]**

Calculate pulls in every approved hour for the period.

**[point at "Not included: unapproved hours for {name} ({N}h). Approve their timesheets to pay these."]**

See this line — anything that isn't approved yet, it's not in here. Same rule
as the job page. Approve the timesheet first, or that person just doesn't get
paid on this run — which is exactly what you want. Not a silent underpay.

**[point at "No deductions are set up, so these are gross figures."]**

And this — no deductions are set up, so this is **gross**. If you want CPP,
EI, income tax off this before he sees it, that's a conversation with your
accountant, not a button in here. It'll do the math once you've told it the
rates. It's not going to guess your remittances for you, and honestly, you
wouldn't want software that did.

**→ If they ask "does it do my taxes?":** say — *"No, straight answer. It
works out what you owe him, gross. What actually gets remitted to the
government — that's still your accountant or your payroll service. This is
the record and the number, not the filing."* — then keep going.

**[mark a run "paid"]**

Once you've actually paid him — e-transfer, cheque, whatever — you come back
and mark it paid. Notice it says "**paid (recorded)**", not just "paid" —
because that's honestly what it is. It's not claiming it moved the money.
You moved the money. It's just never going to lose track of it now.

**[one sentence, don't click into it]**

One separate thing, quickly, because people mix these two up — if you ever
bring on a sub who invoices you instead of being on your payroll, there's a
different screen, under Team → Payroll, that actually **does** pay them
directly, through Stripe. That one moves real money. This one doesn't.
Different people, different button, on purpose.

---

### 10:30–12:30 — Nobody's ever deleted

**[click Settings → Team → Workers, `/app/settings/team/workers`]**

Last thing, and honestly the one I want you to remember, because it's the
thing that would keep me up at night if I were about to hire somebody. What
happens when somebody leaves. Or you hire the wrong guy and it doesn't work
out two weeks in.

**[find Jordan, uncheck "Active"]**

Watch. I take Jordan off active.

**[go to Manage Team, or the scheduler's worker picker]**

He's gone from the schedule. Gone from the list you pick from when you're
adding a shift. Doesn't count against your crew number anymore.

**[no click here — this part is narrated]**

But his hours — the ones already sitting on this job, the ones already on a
past pay run — none of that disappears. That protection landed **today**,
actually. Before, if somebody had ever been paid or logged an hour and you
tried to properly remove them, it either quietly deleted them anyway and left
a hole in an old pay run, or it just failed outright. Now, the moment the
software sees a payout, a time entry, or a line on a past pay run with
someone's name on it, it will not erase them. It archives instead. Same
person, same history — they just stop showing up as someone you can
schedule.

**[re-check "Active" on Jordan]**

And if you ever bring the same person back — same email — all of that
history reattaches. It's not a new person starting from nothing. It's the
same guy, picking back up where he left off.

I'm telling you this because it's the boring, unglamorous thing that actually
matters the day your accountant asks you to explain last year's numbers.

---

### 12:30–14:00 — The crew line

**[click Crew inbox, `/app/crew-inbox`]**

Quick one. He's not downloading an app. Nobody's crew does. So there's one
phone number for your whole business, and he just texts it. A photo from the
job. "Done here." Whatever.

**[point at a filed item]**

It lands on the job on its own — it matches his number to him, and matches
the day to whatever he was actually scheduled on.

**[point at "From numbers not on your team", if there's anything there]**

And if a number texts in that isn't anybody you've added yet, it doesn't just
vanish — it sits here, unmatched, until you tell it who it is. Nothing gets
lost. It just doesn't know whose job to put it on yet.

---

### 14:00–15:00 — Close

**[back to the dashboard, or just stop clicking]**

So that's the whole thing. He's free to add. He clocks in on his own phone.
His hours don't cost you a cent until somebody's actually looked at them and
said yes. And payroll hands you a clean number every period instead of you
doing it on the back of an envelope on a Sunday night.

And if it doesn't work out — if he leaves, or you have to let him go — none
of his history disappears. Your books stay whole.

That's it. What do you want to see again?

**Total: 0:45 + 2:15 + 2:30 + 2:30 + 2:30 + 2:00 + 1:30 + 1:00 = 15:00.**

---

## PART C — What cannot be demoed live (reference — not read aloud)

### The "nobody's ever deleted" beat has no delete button to click
The archive-not-delete protection is real and code-verified: `DELETE
/api/workers/[id]` (in `app/api/workers/[id]/route.js`) checks `Payout`,
`TimeEntry` and `PayRunLine` counts before doing anything, and converts a
delete into `{ active: false }` whenever any of the three is nonzero. But no
button in the current UI calls that route — the Workers page (checked in
full) only offers the **Active** checkbox, which is a manual `PATCH`, not the
history-gated `DELETE`. **Do not stage a "watch it refuse to delete" moment**
— it isn't clickable today. Beat 5 above is written around this: you
demonstrate deactivation (real, clickable, and it does remove Jordan from the
scheduler's picker) and narrate the deeper delete-protection as a fact about
the product, not something you click. If a "Remove worker" button gets added
later, this beat gets stronger and easier — flag that to the team as a
worthwhile follow-up.

### The availability-conflict moment depends on setup that might not be possible
`AvailabilitySchedule` is keyed to a `userId`. If Mike's invitation hasn't
been accepted yet on this demo account, he may not have a linked login at all
and won't appear in the manager's availability picker on
`/app/settings/availability`. This wasn't verified end-to-end against a live
invite-acceptance flow. Part A step 6 is marked optional for exactly this
reason, with a fallback line built into Beat 2's script.

### Seeing the worker's own `/app/clock` view live needs a second session
Same limitation as the client-facing pages in `docs/DEMO-SCRIPT.md`: to
actually show what Mike sees, you need a second browser/device logged in as
him, not just narrate over the manager's screen. If you don't have that set
up, narrate instead of clicking into `/app/clock`.

### Embedded payroll for employees is not built — do not imply otherwise
`lib/payroll/embeddedPayrollClient.js` has a literal header comment: *"this is
scaffolding, not a working integration... Do not deploy this as-is."* Every
function throws `"No embedded payroll provider configured"` unless
`PAYROLL_PROVIDER_API_BASE`/`PAYROLL_PROVIDER_API_KEY` are set — they are not
set anywhere in this codebase. `/app/payroll` computes gross pay and lets a
manager record it as paid; it does not move money for an employee, and there
is no live or in-progress direct-deposit path to gesture at as "coming soon."

### Statutory deductions are never computed by the product
The `PayRun` schema comment is explicit: it computes gross pay; CPP/EI/income
tax are **not** calculated from tax tables — only company-defined
`SalaryComponent` deductions the company itself configured. Don't let "add
your statutory components under Settings → Payroll" be heard as "FieldQuo
knows the tax rates" — it doesn't, on purpose, because getting them wrong
bills the employer for penalties.

---

## PART D — "If they ask about X" (reference — not read aloud)

**"What does adding him actually cost me?"**
On the live pricing ladder (`lib/pricing/ladder.js`, `SEAT_LADDER`, also what
`app/(marketing)/pricing/page.js` and the seat-add gate both use): **Solo** —
1 seat + 5 crew free, **$99/month**. Crew is free on every tier, so a solo
painter adding their first hire as crew stays on Solo at $99/month; the price
only moves if that person is later given seat-level (money-touching)
permissions. Extra seats beyond a tier's allotment are **$29/month** each.
**Flag before quoting this on a call:** `docs/DEMO-SCRIPT.md`'s Part D quotes
a different, older pricing model (`lib/pricing.js`, flat $45/seat under 9
employees) — both files are live in the codebase and both are referenced from
`app/signup/page.js`. This document uses the ladder because it's what the
public marketing pricing page and the seat-limit enforcement actually run on
today, but the two docs will contradict each other if used back-to-back in
front of the same prospect. Reconcile this before running both demo blocks
for the same customer.

**"Does it handle T4s, ROEs, year-end slips?"**
No. Not built, not scaffolded beyond the inert `embeddedPayrollClient.js`
stub described in Part C. Say plainly that FieldQuo computes and records pay;
year-end filing stays with their accountant or payroll provider.

**"Can I pay him by direct deposit through FieldQuo?"**
Not for an employee. The only path that actually moves money is Settings →
Team → Payroll, and it's restricted to `worker.type === "contractor"` — 1099
subcontractors who invoice, paid through Stripe Connect. An employee is
always a record-and-recall, paid through the company's own bank.

**"Can a manager see everyone's pay, or just their own?"**
Depends on the payroll permission level specifically — `none` /
`view_own` / `view_all` / `run_payroll` — which is independent of the four
role presets (Crew/Estimator/Dispatcher/Manager) and is one of the only
places in the product where the granular permission grid is actually
enforced end-to-end, not just displayed. Elsewhere (outside payroll), the
simpler four-role system is the real gate — don't promise fine-grained
enforcement on other screens.

**"What if he never logs in — do I still see his hours?"**
Yes — that's exactly the Crew model. A Worker row tracks schedule, time
entries and pay whether or not the linked invitation was ever accepted.

---

## What's genuinely half-built or unverifiable from this pass

- **No UI control triggers the history-based archive-vs-delete branch.**
  Searched the Workers page and Manage Team page in full; only the `Active`
  checkbox (a plain `PATCH`) is wired to a button. The `DELETE` route's
  archive protection is real, but there's nothing to click that exercises it.
  If a "Remove worker" control gets added later, re-check this section.
- **Resolved: the two live pricing models are down to one.** `lib/pricing.js`
  used to export `calculatePricing()` ($45/seat under 9 employees), and it was
  still reachable from signup and the Team page's "Add licenses" upgrade even
  after `lib/pricing/ladder.js` (`SEAT_LADDER`, seats + free crew, Solo at
  $99) shipped as the intended pricing — the owner's ruling, 2026-08-31, was
  that the four-tier ladder is the only pricing. `calculatePricing()`,
  `NAMED_TIERS` and the `$45` figure are gone from `lib/pricing.js`; the two
  routes that used to mint a "Custom (N employees)" Plan from a typed
  headcount (`app/api/companies/route.js`, `app/api/platform/billing/
  checkout/route.js`) now require a real `planId` instead. See
  `docs/PRICING-CLEANUP.md`. A company already on a legacy per-headcount or
  bespoke Custom plan is untouched and keeps billing exactly as before —
  nothing here was a data migration.
- **The availability-override demo (Beat 2, Part A step 6) depends on Mike
  having a linked login already**, which depends on invite-acceptance state
  this pass didn't verify against a live database. Built a fallback line into
  the script for when it isn't set up.
- **`/api/shifts/publish` and `/app/clock`'s punch endpoint** were confirmed
  to exist and be wired to their buttons, but their full route-handler logic
  wasn't read line by line — only `app/api/shifts/route.js` (the shift-create
  path with the availability/leave conflict check) was read in full.
- **Leave/time-off (`/app/time-off`, `/app/settings/leave`) exists** as a
  model and a pair of pages but was deliberately kept out of the 15-minute
  live click path to protect the timing budget — it's only referenced
  narratively (the "no override for approved leave" line in Beat 2). Worth
  its own beat if this ever becomes a longer demo.
- **Whether the demo company's crew-inbox number is currently live and has
  any filed messages** wasn't checked against a live database — same caveat
  as the AI receptionist number in `docs/DEMO-SCRIPT.md`'s checklist item 9.
  Check before the call; Part A step 8 covers the fallback.
