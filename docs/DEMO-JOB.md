# FieldQuo demo — Job Execution — 15 minutes, for a solo painter hiring their first employee

This is one block in a series. Same account, same audience as `docs/DEMO-SCRIPT.md`
(the solo painter about to hire their first person), same `demo_sandbox`
mechanics, same 30-minute session window — read that document's section 0
first if you haven't, this one doesn't repeat it.

This block picks up exactly where `DEMO-SCRIPT.md` leaves off: the client
said yes. This is everything between "they said yes" and "send the invoice" —
the job itself. `docs/DEMO-CREW.md` owns crew scheduling and payroll;
`docs/DEMO-MONEY.md` owns the costing arithmetic and the KPI page. This block
does not repeat either — it's about the record of the job: what's on it,
who's going, what has to get bought, what it looked like, what the client can
actually see, and how it turns into a bill.

Their real problem: with one job, it's all in their head and their van — which
materials are bought, what the customer asked for on day two, whether the
second coat is done. With one job that works. With three, it doesn't, and
nothing writes any of it down except this.

**How to use this document.** Part B is written to be read aloud, word for
word, off a second screen while you click through the product live. Plain
text is what you say. Stage directions are in **`[brackets, on their own
line]`** — those are for you, never read them out loud. Bold headers over
each block are timings. Parts A, C and D are reference material for before
and after the call — not read aloud.

---

## PART A — Setup checklist, in dependency order

**NOT READ ALOUD. Done before the call, alone, with no prospect watching.**

### 0. Continue the session, or start fresh
If you're running this straight after `DEMO-SCRIPT.md`'s quote-to-cash block,
you're already in `/app` as the painting demo's owner in `demo_sandbox` mode
— keep going, and skip straight to step 2 below, because you already have the
job this script needs. Cold start: `/platform/demo` → the painting demo →
**"Run the demo."** Remember the 30-minute session box.

### 1. Confirm the trade
Same as `DEMO-SCRIPT.md` checklist item 1: `demo1` should be on the painting
preset (`Northside Painting Co.`, brand colour `#1E5F8C`) before you rely on
any of this.

### 2. THE ONE THAT MATTERS: build a live job, don't reuse a seeded one
**Why:** every job this script needs — a schedulable visit, a materials list
that derives from a real takeoff, a client-facing document with a real
invoice at the end of it — depends on the job having gone through the actual
acceptance path (`lib/quotes/quoteLifecycle.js`'s `onQuoteAccepted`), which
mints the job AND the draft invoice together and links the invoice to the
quote (`quoteId`) at the moment it's created.

The four sample jobs `lib/demo/seedDemo.js` seeds on a reset do **not** go
through that path — they're written with direct `db.job.create` /
`db.invoice.create` calls that skip it entirely. Concretely, that means:
- The seeded "done" job's invoice is created with no `quoteId` and no
  `jobId` set. `lib/invoices/jobLink.js`'s `resolveInvoiceJob` — the one
  function that answers "which job does this invoice bill for" — returns
  **null** for it, and the quote page's own "already converted" banner
  (`quote.invoices?.length`) never fires either, because that also reads off
  `Invoice.quoteId`. The last beat of this script, which walks from the job
  to its invoice, has nothing to walk to on a seeded job.
- Each seeded job carries exactly **one** `JobVisit`, with no
  `checklistItems`, and **zero** `JobMaterial` and **zero** `JobPhoto` rows.
  Every other beat in this script — schedule a visit, apply a checklist,
  build the buy-list, upload a photo — opens on an empty panel on a seeded
  job.

None of this is a setup gap you can patch by clicking around for a minute —
it's a property of how the fixture data is written. **Build a real one.**
If you already ran `DEMO-SCRIPT.md`'s beats 2 and 4 earlier in this session,
that job is real and current — use it, skip to step 3. Otherwise, two
minutes: new client (use **an email address you can actually check** — see
step 4 below, this matters later in this script), one line of exterior
painting, save, send, then open the approval link on a second tab and accept
it as the client — identical to `DEMO-SCRIPT.md`'s beats 2 and 4. You now
have a job that starts `unscheduled`, with no visit yet, and a draft invoice
sitting behind it, properly linked.

**Breaks if skipped:** every beat below opens on a blank panel, or — worse —
the closing beat looks broken live when the invoice link simply isn't there.

### 3. An email inbox you can open live
**Why:** the last beat of this script opens the client portal, and there is
no button anywhere in `/app` that hands you a portal link directly — the only
way the portal link ever reaches anyone is inside the actual invoice email
(`lib/clientPortal.js`'s `portalInvoiceUrl`, sent by
`app/api/invoices/[id]/send/route.js`). That email is real, the same way
`DEMO-SCRIPT.md` treats the quote email as real. **Use your own email address
as the client's** when you create the client in step 2, and have that inbox
open on a phone or a second tab before you start talking.
**Breaks if skipped:** beat 7 has no link to click, and improvising one from
memory is not something to attempt live.

### 4. Material costs and checklists — nothing to do, confirm they're not missing
Two things this script depends on ship by default and don't need setup:
- **Material cost defaults.** `lib/costing/tradeMaterials.js` derives a real
  bill of materials for `interior_painting` and `exterior_painting` from the
  quote's own takeoff, priced off `app/data/materialRecipes.js`'s defaults —
  the same defaults `DEMO-SCRIPT.md`'s checklist item 4 already covers. If
  that step was skipped and every category shows "Custom" with blank rates,
  the buy-list beat below will show "no price set" on every line instead of a
  real estimate.
- **The painting starter checklists.** `prisma/seed-checklists.js` ships a
  three-part system checklist (before the work / on the job / before you
  leave) for both `interior_painting` and `exterior_painting`, seeded once
  for the whole platform, not per-demo — nothing to set up, it's just there
  under Settings → Checklists whenever you look.
**Breaks if skipped:** the buy-list beat undersells itself with "no price
set" everywhere instead of real numbers.

### 5. Confirm job costing is on for this member
**Where:** you're already in as the owner in `demo_sandbox`, which carries
`jobCosting` by default — nothing to do. Named here only so you know why the
"What this job has cost" panel is visible at all: without that toggle,
`GET /api/jobs/[id]/costing` answers 403 and the whole panel silently isn't
there for that person, which is correct behaviour, not a bug to explain away.

---

## PART B — The 15-minute script

**READ ALOUD, VERBATIM.** Plain text is what you say. Bracketed lines are
what you do — don't say them. Bold headers are timings.

Shape: the job is where the promise from the quote either gets kept or
doesn't. One screen holds what has to happen, who's going, what has to get
bought, what it actually looked like, and what the client is allowed to see
— and then it turns into the bill.

Total: 15:00.

### 1. Open — the job is the promise, kept or not — **(0:45)**

[Land on the job you built in Part A — `/app/jobs/<id>`.]

Your customer just said yes. This is what happens to that yes.

[Point at the top of the page — client name, address, the "From quote"
line.]

This isn't a new record. It's the same quote, still connected — same
client, same price, same job. Nothing gets retyped between saying yes and
doing the work.

### 2. The job record and visits — **(2:15)**

[Point at the purple "This job needs a date" banner.]

Right now this job exists and nobody's told it when. That's honest — you
haven't decided yet either.

[Click "Schedule a visit."]

A job and a visit are not the same thing. The job is the whole project — one
price, one client. A visit is one trip out there. A repaint might be one
visit. A kitchen could be four.

[Fill in a date, assign it — pick a crew member if one exists on this
account, otherwise leave "Not assigned yet."]

[Click "Schedule visit."]

[Back on the job page.]

Watch — I didn't touch the status anywhere. It went from "needs a date" to
"scheduled" the second I put a date on a visit. One less thing to remember to
update by hand.

**If they interrupt here — "what if the job needs more than one visit?":**
Say: "Same button, again, whenever. A job can carry as many visits as it
actually takes — this list just grows." Then continue.

### 3. The checklist — copied, not shared — **(2:00)**

[On the visit you just created, click "Add a checklist."]

Every visit can carry its own checklist. Not a generic one — yours, or the
ones we wrote for your trade.

[Point at "Starter lists for your trades." Pick the painting one for
whichever phase — before the work, on the job, or before you leave.]

These didn't come from nowhere — that's an actual painter's prep list.
Mask the trim, check you've got enough paint for two coats before you start,
photograph the damage that was already there before anyone touches it.

[Click it to apply.]

[Point at the phase groups: Before the work / On the job / Before you
leave.]

And this is a **copy**. The second it lands on this visit, it's yours — edit
it, delete a line, doesn't touch the original list, and doesn't touch any
other visit that used the same one.

[Tick one or two items live.]

That's what your guy ticks off standing in the room, on his phone. Not a
paper list that lives in the truck.

**If they interrupt here — "do I have to use your checklists?":**
Say: "No — write your own under Settings, or use ours, or use neither. Ours
are offered, never applied. Nothing lands on a real visit unless somebody
actually picks it." Then continue.

### 4. The materials buy-list — and the trap, shown honestly — **(3:00)**

[Scroll to "Materials to buy."]

Nothing here yet — same as the checklist, nothing invents itself.

[Click "Rebuild from the quote."]

This derives what the job actually needs from the same numbers that priced
it — square footage into gallons, not a guess.

[Point at the list that appears — paint, primer, whatever the takeoff
produced.]

That's your buy-list for this job, in the trade counter, on your phone.

[Tick one item as bought. Type a real cost into "What it cost" — e.g. the
paint total.]

I check it off when I've actually bought it, and I can log what it cost me
right there.

[Point at "Actually paid, so far" at the bottom of the panel.]

Now — here's something I want to show you straight, because it'll bite you
if nobody tells you. Look at that number.

[Scroll up to "What this job has cost."]

And look at this one — Expenses.

[Point at the Expenses tile, which still reads what it read before.]

I just told the buy-list I paid for paint. That did **not** show up here.
Ticking a box in the buy-list is not the same as logging an expense — job
costing only counts real logged expenses, and the buy-list doesn't write
one for you automatically. If you use that checkbox as your bookkeeping and
never go log the receipt as an expense, this job looks like it cost you
nothing on materials, and your margin looks better than it is. That's not a
bug I'm hiding from you — it's a real gap, and the software knows it's a gap.
On the numbers page, if this pattern shows up across your jobs, it actually
flags it and tells you to go log the expense. I'd rather show you the trap
than pretend it isn't there.

**If they interrupt here — "so what do I actually do?":**
Say: "Tick the box for your crew, log the real expense for your books — two
different jobs, two minutes each. If you forget the second one on enough
jobs, the numbers page catches it and tells you." Then continue.

### 5. Job photos — **(2:15)**

[Scroll to "Job photos."]

This job has no photos yet — until recently, the only way one got here at
all was your guy texting it to your crew line, and if nobody used that, this
whole section just wasn't there at all. It looked like the feature didn't
exist. It did — it just had exactly one door.

[Upload one or two photos through the panel directly.]

Now there's a second door — straight off your laptop or your phone, right
here.

[Point at the stage dropdown on one photo — defaults to "progress."]

Every photo gets a stage — start, progress, finish, or issue. Start and
finish of the same job is your before-and-after.

[Change one photo's stage to "issue."]

And "issue" is different from the other three on purpose.

[Try to star the issue photo — point at it refusing, with the warning
tooltip.]

Watch — it won't let me put that one on the website. A shot of water damage
you found behind a wall isn't marketing. It's a record, for your file, for
the conversation with the client about why the price changed. The software
knows the difference even if nobody tells it to, every time.

[Star a non-issue photo instead.]

That one, though — tap the star, and it's a candidate for your website
gallery. Nothing goes public until somebody actually picks it.

### 6. Turning the finished job into an invoice — **(2:15)**

[Set the job's status to "Completed" using the dropdown at the top of the
page.]

Job's done. Say it, and it's done.

[Click the "From quote" link at the top of the page to open the quote.]

Here's the thing worth seeing — this was never a separate step waiting to
happen. The moment your client said yes, back at the start, this invoice got
created too, as a draft, sitting here the whole time you were doing the
work.

[Point at the blue "already converted" banner, click through to the
invoice.]

[Scroll down the invoice to the job panel near the bottom.]

And it goes the other way too. Open the invoice, and there's the job, right
there — the visit, who did it, whether the hours on it have made it into a
pay run yet. You're not hunting across three screens to explain a bill —
it's all one thread.

[Click Send.]

That's a real email, out the door, right now — same design as the quote,
same brand, so your client doesn't have to work out it's the same company
twice.

### 7. What the client can actually see — honestly — **(1:30)**

[Open the email you just sent, on the second device or tab from Part A.
Click through to the invoice, then click "Back to your account."]

This is what your client sees. Their own account — your logo, your colour,
nothing that says FieldQuo anywhere on it.

[Point at the balance owing, then the invoice list.]

Balance owing, right up top, because that's what most people open this for.
Every invoice you've actually sent them — never a draft, they can't see a
number you haven't committed to yet.

[Point at anything under "Quotes," if present.]

And any quote that's still open, if there is one.

I'll say plainly what's on this page and what isn't — there's no job
timeline here, no photo gallery of the work in progress. What your client
gets is their bill and their quotes. If you want them seeing progress
photos, that's the star you tapped a minute ago, going out through your
website, not through this account page.

**If they interrupt here — "can my client see the crew's schedule?":**
Say: "No — and they shouldn't need to. This page answers 'what do I owe and
what did I agree to.' If they want to know when you're showing up, that's a
phone call or a text, same as it always was." Then continue.

### 8. Close — **(1:00)**

So that's the whole middle of the job. One record instead of your head and
your van. A visit's not the job — a job can carry several. A checklist's a
copy the second it lands, so editing it never touches anyone else's. The
buy-list is honest about what it doesn't know. A photo's got a place it
belongs, public or not. And the invoice was never a separate step — it was
sitting there the whole time, waiting for you to say the job was done.

What part of this would actually save you time next week?

*[Stop talking after asking. Let them answer.]*

---

**Recovery, if something breaks mid-demo:** Same rule as `DEMO-SCRIPT.md` —
don't troubleshoot live. Say "that's a display hiccup on the demo account,
not something your business would see," move to the next beat, come back if
time allows.

**Total: 0:45 + 2:15 + 2:00 + 3:00 + 2:15 + 2:15 + 1:30 + 1:00 = 15:00.**

---

## PART C — What cannot, or should not, be demoed live here

**NOT READ ALOUD — reference only.**

### The client portal genuinely does not show job progress, and the API half-promises it
`app/api/portal/[token]/route.js` loads `jobs: { include: { visits: true },
orderBy: { createdAt: "desc" } }` and returns it in the JSON payload as
`data.jobs` — but `app/portal/[token]/ClientPortal.js` (checked in full, the
whole file) never references `data.jobs` anywhere. The field is fetched and
shipped to the browser and then simply not rendered. Whether that's an
unfinished feature or dead code wasn't something this pass could determine —
either way, **do not describe the portal as showing job or visit status**,
because right now, on screen, it doesn't. Beat 7 above is written to state
plainly what the page does show (balance, invoices, quotes) rather than what
the API happens to also fetch.

### Two other job panels exist on this page and are deliberately left out
`JobTasks.js` (a read-only mirror of the office to-do list filtered to this
job) and `SuggestedTasks.js` (an AI button that reads the job's notes and
proposes to-dos, with the source sentence quoted under each suggestion) both
render on the job detail page, beneath the visits list. Neither made it into
the 15 minutes — `JobTasks` is a read-only view of a feature better shown on
its own, and `SuggestedTasks` spends AI credit for a payoff that isn't this
script's core loop. One sentence if asked; not worth a beat.

### The materials-buy-list trap has a company-wide version too, and it isn't repeated here
Beat 4 shows the trap on ONE job, live, because it's visibly true right there
on the job page — the buy-list's "actually paid" figure and the costing
panel's "Expenses" figure disagree, with no need to leave the screen.
`docs/DEMO-MONEY.md`'s own materials-trap beat is the company-wide version
of the same fact, surfaced on the KPI page's Money flow section across every
job in a period (`detectMaterialsBuyListTrap()` in `lib/analytics/kpis.js`).
Don't run both trap demonstrations back-to-back for the same prospect without
saying so — they're the same underlying gap shown at two different zoom
levels, not two different features.

### A visit's checklist has no per-item photo requirement enforced yet
`VisitChecklist.js` renders a "Photo expected" badge on any inspection-style
item that carries `photoRequired`, but the code comment is explicit: this is
informational only. There is no control on this screen that refuses a tick
without an attached photo — "the gate lands with the control," which does
not exist yet. Don't demonstrate or promise photo-gated checklist items.

### Regenerating the buy-list is safe to press twice, but don't demonstrate deleting a hand-added line as if it were fragile
`lib/jobs/sourcingList.js`'s `regenerateSourcingList` explicitly preserves
anything already bought and anything added by hand — only un-bought, derived
lines get replaced. This is real and correct, but it's a code-comment fact,
not something with an obvious visual payoff live; mention it only if asked
"what happens if I click Rebuild again."

---

## PART D — "If they ask about X"

**NOT READ ALOUD — reference only. Answer in your own words.**

**"Can the customer tell when we're actually turning up?"**
Yes, and this landed on 2026-08-31, after the beats above were written — so
if you have thirty spare seconds, it's worth showing on the visit you created
in beat 2. Each visit now carries "On my way", "Mark complete" and "Cancel
visit". "On my way" texts the client the wording the company set in
Settings → Client messages, and the button says so on its face with the
number underneath it. Two things worth knowing before you press it on a live
demo: it really sends, so do it against a visit whose client is you; and a
success on screen means the status saved, not that the text was delivered —
the send is fired detached so a carrier outage can't lose the status change.
"Mark complete" is what moves the "1 of 3 complete" counter at the top of the
visits panel, and on a recurring job it puts the next visit on the calendar
immediately instead of waiting for the overnight run.

Only the person the visit is assigned to sees these buttons, plus anyone with
schedule edit-all, plus anyone at all if the visit is unassigned — the same
three clauses the API enforces (`lib/jobs/visitStatus.js`, `mayMoveVisit`).
If you're demoing as the owner it'll be there.

**"Can my crew see prices anywhere on this job?"**
Not on the buy-list. `app/api/jobs/[id]/materials/route.js` strips both
`estUnitCost` and `actualCost` server-side for anyone without the
`jobCosting` toggle — the row shows `costHidden: true` instead of a stripped
number, so a crew member sees the checklist and the shopping list with the
quantities, never the money. A crew member is jobs-scoped to their own
assigned jobs too, by the same `assignedJobWhere()` check the costing
endpoint uses.

**"What if a photo gets tagged the wrong stage?"**
One tap re-stages it — the dropdown on every photo card is always editable,
not locked once set. The AI tagging (when a photo arrives by crew text) is
usually right; when it isn't, this is the fix.

**"Does a checklist template change if I edit it later?"**
No, not on jobs it's already been copied onto. `VisitChecklist.js`'s own
design: applying a template copies the items onto that one visit at that
moment. Editing the template in Settings afterwards only affects the next
visit it's applied to.

**"Can I delete a job by mistake?"**
`DELETE /api/jobs/[id]` refuses outright if the job carries time entries or
tasks — you'd hit a 409 with an explanation, not a silent failure. Cancelling
or archiving are the real options for a job that's already had work logged
against it; delete is really for a job created by mistake with nothing on it
yet.

**"What happens to the photos if I regenerate the buy-list?"**
Different systems entirely — `JobPhoto` (the photo gallery) and
`JobMaterial` (the buy-list) don't touch each other. Regenerating materials
from the quote has no effect on photos at all.

---

## What's genuinely half-built or unverifiable from this pass

**NOT READ ALOUD — reference only.**

- **The client portal fetches job and visit data it never renders.** Covered
  in Part C. This reads as a genuine half-finished feature — the data is one
  API response away from a "your project" section on that page — but nothing
  in the current `ClientPortal.js` uses it, and this pass did not find a
  second consumer of that field anywhere else. Worth flagging to the team as
  a real gap, not a demo-only limitation.
- **Whether `demo1`'s Settings → Material Costs currently shows "Default" or
  "Custom" badges** on the painting categories is a live-database fact this
  pass could not check — `DEMO-SCRIPT.md`'s own checklist item 4 already
  covers confirming this; Part A step 4 above just restates why it matters
  for this block specifically.
- **Whether the demo account already has a second crew member (from
  `DEMO-CREW.md`'s setup) to assign the visit to in beat 2** wasn't assumed.
  The script's bracket says "if one exists... otherwise leave 'Not assigned
  yet'" for exactly this reason — both states are real, working, and
  demonstrable; neither needs to be staged specifically for this block.
- **The exact wording FieldQuo's starter checklist items show on screen**
  was read directly from `prisma/seed-checklists.js`, which is the actual
  seed source — not a translation catalogue, so what's quoted in beat 3
  should match what's on screen. A copy edit to that file since this pass
  could move it; glance at the actual list before reading a quoted line
  verbatim.
- **Whether sending a test invoice through this script's own beat 6 actually
  delivers to an inbox in this environment** depends on Resend being live and
  configured the same way `DEMO-SCRIPT.md` already assumes for the quote
  email — not re-verified separately here. If quote email delivery already
  works in your environment, invoice email delivery uses the same sender
  path (`lib/email/platformSender.js`) and should too.
