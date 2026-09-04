# Sales call handling — design, and what shipped

How FieldQuo's own sales reps make calls, take calls, get handed the next
prospect, record what happened, and are supervised. Informed by a close read of
OMniLeads; written against FieldQuo's own models.

Last updated: 2026-09-03.

---

## Status in one paragraph

**Dispositions, attempt capture, agent state, the three-tier scope rule,
in-browser calling and a live superadmin floor board are BUILT and in
`check:all`** (264 assertions; 24 mutations written against the check, every
one confirmed applied and every one caught). **Two Prisma models
and four columns are handed to the owner and NOT pushed** — everything degrades
honestly until they land, because `lib/sales/calls/store.js` probes the
generated client rather than asserting a state. **Nothing automated dials**:
progressive and predictive are designed, named and refused behind two switches.
The team-lead tier is written and tested but inert, because `SalesRep` still has
no reporting line.

---

## 1. What FieldQuo already had, and what was actually missing

Read before proposing anything, and it changed the shape of the answer twice.

| Already there | Where |
|---|---|
| The rep queue, one prospect at a time, single trade | `app/sales/queue/page.js` |
| Claim / release / worked / do-not-contact, compare-and-set | `app/api/sales/queue/route.js` |
| Claim state machine and its `where` fragments | `lib/sales/prospectView.js` |
| The jurisdiction gate — windows, caps, `allowed`/`refused`/`unknown` | `lib/sales/callingRules.js` |
| Four sales gates, each with an explicit write list | `gate.js`, `outreachGate.js`, `smsGate.js`, `queueGate.js` |
| Platform-wide do-not-contact list, cross-channel, cross-rep | `lib/sales/suppression.js` |
| Inbound VOICE to FieldQuo's own number — agent, transcript, summary, recording | `lib/platform/salesCall.js`, `/platform/sales-agent` |
| Inbound EMAIL filing by reply token | `lib/sales/outreachInbound.js` |
| Inbound SMS including STOP, on a `sales`-purpose number | `lib/sales/salesSms.js` |
| Commission ledger, payout batches, performance dashboard | `commission.js`, `payouts.js`, `performance.js` |
| A/B experiment framework with assignment stored BEFORE the call | `lib/sales/playbook/` |

**What was genuinely missing was narrower than it looked.** Not "inbound" —
inbound voice has answered, recorded and transcribed for a while; what it could
not do was say *who was calling*. Not "a supervisor tier" — the notes module had
already worked out that the blocker is an absent reporting line and had written
that down as a fact. What was missing was:

1. **Any record of a dial.** A `tel:` href and nothing after it. The Oklahoma
   and Florida three-per-24-hours caps were reported as `unenforced` on screen,
   in the rep's own words, because nothing counted.
2. **Any record of what a rep is doing.** No available / on a call / paused.
3. **A supervisor board**, which needs (2) before it means anything.
4. **A call that happens inside FieldQuo**, so any of it is measurable.

Everything below is built on the seven rows above rather than beside them.

---

## 2. What was taken from OMniLeads, and what was left

OMniLeads (LGPL-3.0, `~/Downloads/ominicontacto-master`, Django + Asterisk).
Licence confirmed first-hand: `LICENSE.txt` is LGPL-3.0 and every source file
carries the Freetech Solutions header. It was read for design. Nothing was
copied — it is Python/Django/Vue against Asterisk and FieldQuo is
Next.js/Prisma, so reimplementation was the only route available anyway.

### Taken

- **Preview dispatch as a reservation with a lease.** Its `AgenteEnContacto`
  row carries a state, an owner and a timestamp, and a sweep returns unworked
  reservations to the pool. FieldQuo's `Prospect.assignedRepId` /
  `claimExpiresAt` is the same idea and **already existed** — see §3 for the
  one place FieldQuo's version is better.
- **After-call work as a distinct state**, and the insight behind its
  `obligar_calificacion` flag: an agent who has not said what happened is not
  ready for the next call. FieldQuo has no dialler to hold back, so this became
  a screen decision rather than a lock — §5.
- **A closed pause vocabulary with a productive/recreative split.** Its
  `Pausa.tipo` is why FieldQuo's `PAUSE_REASONS` carry a `paid` flag rather
  than being free text: "where did the day go" is only answerable if two reps
  typing "lunch" land in one bucket.
- **Separating agent reporting from campaign reporting.** Its
  `reportes_app` splits per-agent times from per-campaign disposition
  histograms, and they answer different questions. `repCallStats` and
  `campaignCallRows` are that split.
- **The synthetic "connected and the agent never dispositioned it" outcome**
  in its recycling module. That is `dispositionMix().pending`, and making it a
  first-class bucket rather than folding it into "no answer" is the single most
  useful number on the supervisor board.
- **Disambiguating an inbound caller rather than guessing.** Its inbound
  console sends the agent to a chooser when a phone number matches two
  contacts. FieldQuo returns `ambiguous` with both candidates, for the same
  reason and one that is sharper here: `Prospect` dedupe *flags* duplicates
  rather than merging them, so two rows on one number is normal.

### Deliberately not taken

- **Everything that only exists because a dialler places the calls.** Ring
  state, abandon state, queue wait, agent-selected-by-the-system,
  `n_open_retries`. A human presses the button here. Those columns would never
  be written.
- **Scope enforced by a copied `if` at every view.** OMniLeads answers "which
  campaigns may this supervisor see" by hand at roughly twenty-five call sites,
  and one of them — its supervisor callback-reassignment endpoint — already
  disagrees with the other twenty-four and refuses an administrator. That is
  AGENTS.md failure class 4 in a live product. FieldQuo computes the scope once
  in `lib/sales/team.js` and every screen spreads the fragment.
- **A permission layer that fails open.** Its `tiene_permiso_oml()` returns
  true when the permission does not exist, so an unregistered view is
  unrestricted by default. That is the same shape `lib/permissions/enforce.js`'s
  `hasLevel()` has, and the same reason `lib/sales/notes/visibility.js` refuses
  to import it.
- **Live state in a second store.** Its truth for "now" is a Redis hash and its
  truth for "then" is Postgres, written by different components, with a
  vestigial `AgenteProfile.estado` column nothing writes. FieldQuo keeps one
  table: the log, whose newest open row *is* the current state. One table
  cannot disagree with itself.
- **A callback that removes the contact from the queue.** Booking a callback in
  OMniLeads finalises the preview reservation and the promise lives on in a
  separate agenda screen. FieldQuo does the opposite — see §4.
- **Supervisor control over an agent's session** — forced logout, forced pause,
  listen-in, whisper, barge. Every one is a separate product decision and none
  has been taken.
- The WhatsApp and Facebook trees entirely.

---

## 3. Next-lead dispatch

### What already works, and why it is better than the reference

`app/api/sales/queue/route.js` hands out the next prospect with an
`updateMany` whose `WHERE` still contains the whole availability condition, and
a zero count means another rep won the race — retried three times. Ordering is
`createdAt asc` so the pool drains. `CLAIM_HOURS` is 48; a claim with
`claimExpiresAt: null` has been *worked* and never lapses.

OMniLeads reaches the same safety with `SELECT … FOR UPDATE SKIP LOCKED` inside
a transaction — and depends on `ATOMIC_REQUESTS: True` in a settings file, with
no `transaction.atomic` at the call site. **FieldQuo's compare-and-set needs no
ambient transaction and no cron.** A lapse is *lazy*: `claimCandidateWhere`
admits rows whose expiry has passed and `queueWhere` excludes them, so the pool
self-heals on read. OMniLeads needs a five-minute sweep, which means its
effective lease is the configured window plus up to five minutes.

**No change proposed. This one is right.**

### What a disposition now does to the claim

| Disposition | Claim | Prospect | Lead |
|---|---|---|---|
| No answer · Busy · Voicemail | held, lease **restarts from now** | — | — |
| Someone answered, not the owner | held, lease restarts | — | — |
| They asked me to ring back | held, lease covers the callback | — | `contacted` |
| Spoke to them — interested | **worked**, never lapses | — | `contacted` |
| Spoke to them — not interested | **worked**, never lapses | — | `lost` |
| Asked not to be called again | worked | `doNotContactAt` + **suppression** | `lost` |
| Wrong or dead number | **released** | → `needs_review` | — |
| Not a business we can sell to | **released** | → `needs_review` | — |

Three decisions in that table are load-bearing:

- **The lease measures inactivity, not age.** A rep who has rung twice and is
  waiting on a callback is working the prospect; letting the claim die at hour
  48 would put that contractor back in the pool for a second rep to ring, which
  is the one thing ownership exists to prevent.
- **"Not interested" is WORKED, not released.** A released row goes back in the
  pool and a second rep makes the same call to the same annoyed contractor.
  That is how a lawful B2B call becomes a complaint.
- **A release is always paired with `needs_review`.** Releasing a workable
  prospect after a dead call just hands the next rep the same dead number.
  `claimCandidateWhere` admits `status: "discovered"` and nothing else, so
  `needs_review` takes it out of circulation without letting a rep reject a
  discovery row outright — that is a curation act and it stays with the
  superadmin console.

### Claims that are never worked

They lapse at 48 hours, lazily, and **nothing counts how often that happens**.
That is stated rather than hidden: once a lapsed row is re-claimed,
`assignedRepId` is overwritten and the history is gone. "Claims this rep let
lapse" is derivable only for claims still pointing at them, which makes it a
live figure and not a historical one. Recording lapses properly would mean a
claim-event log, which is a new model for one metric — **an owner decision, not
built.**

### Two known gaps, neither introduced here

1. **Suppression is still not consulted at claim time.** `claimCandidateWhere`
   filters `doNotContactAt: null` but does not read `SalesSuppression`, so a
   prospect on the platform list can still be claimed. It cannot be *dialled*
   any more — `saveDisposition` writes the list and the dial path re-reads the
   gate — but the claim itself is unguarded. Already recorded as open in
   `docs/ROADMAP.md`; the fix belongs in the claim loop, skipping a suppressed
   candidate and going round again.
2. **A rep can hand-type a `SalesLead` for a business another rep holds as a
   `Prospect`.** Nothing links them unless `prospectId` is set. Ownership is
   per-`Prospect`; suppression is cross-rep. Not new, not fixed here.

---

## 4. Call outcomes

`lib/sales/calls/dispositions.js`. A table, not a function full of branches —
the same argument `callingRules.js` opens with.

### The attempt row is written at the DIAL, not at the outcome

This is the load-bearing decision in the whole feature and it is easy to get
backwards. **Oklahoma and Florida cap CALLS, not conversations.** A rep who
dials five times and fills in one outcome has made five calls. So:

- the row exists the moment the gate clears, with `disposition: null`;
- an attempt with no disposition is a real, visible state — `pending` on every
  report — not a gap;
- the carrier's own figures are attached later, by a different route, and
  never overwrite the disposition.

### The cap is counted by NUMBER, not by prospect

`Prospect` dedupe flags duplicates rather than merging them — the schema says
merging destroys provenance — so one business can carry two rows. Counting per
row would turn a three-call cap into a six-call one by arithmetic nobody
intended. The index is `@@index([toE164, dialledAt])` and
`attemptsLast24h(toE164)` has **no `salesRepId` parameter to pass by mistake**:
the cap is per called party, which is what the gate's own refusal already says.

### Why the vocabulary is code and not a superadmin table

STATUS.md's standing rule 1 says every setting and every rule is editable from
the superadmin UI. **A disposition is neither.** Each entry carries code
behaviour — a claim transition, a prospect status, a suppression write — so a
superadmin adding "Left a message with the wife" would get a row that does
nothing to the queue: a dead control, added through a UI. What *is*
configurable is the playbook a rep reads, which already is.

**Pause reasons are the arguable case**, and they are flagged as such: a pause
reason carries no behaviour beyond bucketing, so it *could* be a table. It is
shipped as a closed list because a reason renamed after the fact makes last
month's report unreadable. **Candidate for the console; owner's call.**

### One transaction, or none of it

A "do not call" that writes the attempt and then fails to write the suppression
is the worst possible half-success: we can prove we were asked and prove we did
not act. `suppressWithin()` exists precisely so this can join an open
transaction, and a failed suppression **throws**, taking the outcome down with
it.

The suppression is written for the **phone channel only**. "Stop calling me"
said on a call is a narrower request than an unqualified "stop", and recording
it as a blanket stop across email and SMS would delete two channels the person
never mentioned — AGENTS.md failure class 5, pointed the other way.

---

## 5. Agent state

`lib/sales/calls/agentState.js`. Five states — off, available, on a call,
writing it up, paused with a named reason — one transition table, one log
table.

**Every state is DECLARED, not observed.** That sentence is the difference
between a supervisor board that is useful and one that is a lie. "On a call"
begins when a rep presses dial and ends when they say it ended. It is time on
the prospect. It is **not talk time**, the key is `onCallMs` so a screen cannot
mislabel it by accident, and the check script asserts no sales surface prints a
talk-time figure from it.

Three edges are worth their own sentence:

- **`on_call → paused` is absent.** A rep ends the call first. Allowing it
  would produce overlapping periods and a "time on calls" total that includes
  lunch.
- **`paused → on_call` is present.** A rep who pauses and then dials has plainly
  come back. Refusing the dial to protect a chart is a control that exists for
  the chart.
- **Every state → offline is present**, including from a live call, because a
  laptop closing mid-call happens and the log should say so.

### Stale is a third answer, not a shade of the first

A rep who closes their laptop leaves an open row that is true forever. So the
portal beats every 60 seconds, and past 15 minutes `livePresence` returns
`stale: true` **beside** the state rather than instead of it. The board renders
that in the dashed muted tone the rep queue already uses for "we could not
establish this", and says in words: *this is what they said they were doing, not
what they are doing.* Painting them the same green as somebody at their desk is
how a supervisor rings a rep who went home an hour ago.

A heartbeat can **age** a row and can never **open** one — otherwise a
background tab would put a rep back on the board after they signed out.

### After-call work, and the OMniLeads idea that did not survive intact

OMniLeads holds an agent in `PAUSE-ACW` until they disposition, because its
dialler would otherwise hand them another call. FieldQuo has no dialler, so
there is nothing to hold back. The equivalent that *is* honest: an unlogged
call is rendered **in place of the call button** on the rep's own screen until
it is written up. Not a modal — a modal on a phone over a rep who is still
talking is worse than useless — and not a lock on the rest of the portal. The
one thing it holds back is starting another call, because two unlogged calls is
how a day's numbers become unrecoverable.

---

## 6. Inbound

### What exists

A contractor ringing FieldQuo's own number already reaches something.
`FIELDQUO_SALES_NUMBER` resolves through `lib/platform/salesCall.js`, the Retell
agent answers, `recordSalesCall` upserts a `PlatformVoiceCall` with transcript,
summary, recording and duration, and `/platform/sales-agent` shows it to a
superadmin. There is an optional cold transfer to `FIELDQUO_SALES_TRANSFER_TO`.

**There is no voice equivalent of `outreachInbound.js`, and there did not need
to be one** — the filing is done. What was missing is that the row knows a
phone number and nothing else. Its own schema comment says so.

### The `sales_voice` pool — built 2026-09-04

**This is a second phone system, not a second door onto the first.**
`FIELDQUO_SALES_NUMBER` is one advertised line with a Retell agent on it. The
`sales_voice` numbers are the local numbers reps *dial from* — a contractor in
Tulsa answers a 918 number and lets an unknown one ring out — and until this
change, ringing one back reached nothing at all. No agent goes on them: putting
a conversational AI on a number whose entire point is that a roofer recognises
the area code would defeat the reason it was bought.

`app/api/rep-dial/inbound`, a sibling of `/bridge` and `/status` for the same
reason they are not under `/api/sales` — middleware refuses that prefix without
a rep cookie, and `"/api/sales-x".startsWith("/api/sales")` is true, so a hyphen
would not have helped. Signature-verified through the same
`lib/sms/verifyTwilioWebhook.js`; an unsigned endpoint here would let a stranger
make FieldQuo's Twilio account place calls.

**Who answers.** The rep who last dialled that contractor *from that number* —
the pair, not the caller alone, because the contractor is ringing back the
number on their screen and the person who put it there is the person with the
context. The claim holder is the fallback. A rep who has left is skipped:
filing a callback against a console nobody will open again is worse than filing
it unattributed, because a row with a name on it reads as handled.

**What the call reaches.** `FIELDQUO_SALES_TRANSFER_TO` when it is set and the
floor has not said it is empty; otherwise a spoken message. The message says the
call was logged — which is true, the row exists before it is spoken — and
**never promises a callback**, because a callback is an outbound call that has
to clear `salesCallReadiness` and cannot be promised from inside an inbound
webhook.

**Nothing is recorded, and there is no voicemail.** Recording a two-party call
is consent law; a voicemail would be a recording with somewhere to be written
and nowhere to be read — no retention rule, no playback surface, no proxy for
Twilio's media URLs. Both are stated in `NOT_TRACKED_CALLS` rather than left as
an absence.

**The row.** `SalesCallAttempt` with `direction: "in"`, `dialChannel:
"inbound"`, `toE164` the contractor and `fromE164` our number — the same shape
in both directions, so the 24-hour cap and the callback tracker key on the right
number. `salesRepId` became nullable for exactly one case: an inbound call that
matched nobody. The cap query and every dial count now filter on direction; a
contractor ringing three times consumes none of Oklahoma's three.

### The match, and what it is allowed to mean

`lib/sales/calls/inboundMatch.js`. Five outcomes: `prospect`, `lead`,
`ambiguous`, `none`, `unknown` — and `unknown` (a withheld number) is not
`none` (a number nobody carries).

**A caller ID is a hint. It is never proof.** `SalesThread.replyToken` is a
secret FieldQuo issued, so a reply carrying it *is* the thread. A calling number
is asserted by the network and spoofable. So a match may put the prospect's card
in front of whoever handles the call, may tell the rep who already holds the
claim that their prospect rang, and may be recorded as `matchedBy:
"phone_e164"`. It may **never** authenticate the caller, lift a suppression,
move a claim, or credit an attribution. The function returns only facts — there
is no field on the result a caller could read as permission, and the check
script asserts that.

### Outside hours

**There is no such thing as "outside hours" for taking a call, and building one
would be reading the rule backwards.** The calling window governs when FieldQuo
may *ring* a business. Refusing an inbound call at 21:00 because Oklahoma's
solicitation statute closes at 20:00 would be absurd. A contractor who calls the
number a rep gave them is answered.

What changes out of hours is who answers *behind* the agent, and the floor board
says which of three states it is in: no agent at all, agent with no transfer
destination, or agent with nobody on the floor to transfer to. That third answer
is computed from the same presence rows the board is drawn from, so the two
cannot disagree.

### The live compliance hole this exposes

**A caller saying "take me off your list" on an inbound call does not reach
`SalesSuppression`.** The transcript sits in `PlatformVoiceCall` and nobody
acts on it. The SMS side handles STOP; voice does not. That is a real
obligation, not a nicety — Canada's internal do-not-call list is about honouring
a *request*, whatever channel it arrives on.

**Not fixed in this pass.** The two candidate shapes are a Retell tool the agent
can call (`record_do_not_call`), or a superadmin review queue over transcripts.
The first is better and needs a prompt change plus a tool definition in
`lib/platform/salesAgent.js`. **Flagged as the highest-priority remaining item.**

### The callback number

Canada's Telemarketing Rules require identifying with a callback number. On a
handset dial, the number a contractor sees is the rep's own phone and ringing it
back reaches a person with no context. On a browser dial it is a number FieldQuo
owns and answers — and the queue screen now prints it beside the live call
timer, with the sentence *say it out loud*. This is the strongest single
argument for the in-browser path, independent of measurement.

---

## 7. Supervisor, manager, superadmin

### Three tiers, and the name

`lib/sales/team.js`. **The middle tier is called "team lead", not
"supervisor", and that is not a style preference.** `supervisor` is already a
tenant Member role — a contractor's own employee — and
`lib/permissions/roleManagement.js` labels it "Manager" on screen.
`scripts/check-role-vocabulary.mjs` exists *because* two screens used two names
for that one role and the owner reasonably concluded a member had escalated
their own permissions. A third meaning of "supervisor" inside FieldQuo's own
staff is how that happens again.

### The tier is derived, never stored

A rep is a team lead if somebody reports to them. There is no `tier` column and
there must not be one — storing it creates a second answer that can disagree
with the first.

### What each may NOT see

| | Rep | Team lead | Superadmin |
|---|---|---|---|
| The unclaimed pool | ✗ (counts only) | ✗ | ✓ |
| Another rep's claims / queue | ✗ | their line | ✓ |
| Another rep's call attempts and dispositions | ✗ | their line | ✓ |
| Another rep's live state and pause reasons | ✗ | their line | ✓ |
| Another rep's `SalesRepNote` | ✗ | **their line, from a boundary date** | ✓ |
| Commission amounts, payout batches | own state only | **✗** | ✓ |
| Lifting a suppression entry | ✗ | **✗** | ✓ |
| Transcripts of FieldQuo's own inbound line | ✗ | **✗** | ✓ |
| Changing who a company is credited to | ✗ | **✗** | ✓ |
| Editing or deleting anybody's note | ✗ | **✗** | **✗** |
| Changing what a rep said happened on a call | ✗ | **✗** | **✗** |
| Moving a claim to a *named* rep | ✗ | **✗** | ✗ |

The bottom three rows are the interesting ones. `canWriteNote` already refuses
every non-author *including a superadmin* — "a record a manager can rewrite is
not a record" — and a team lead is not a bigger exception than a superadmin. A
disposition is one person's account of a conversation; a lead who disagrees
writes a note.

Releasing a stuck claim back to the pool is a supervision act and would be
allowed. Choosing *who* gets it next is a routing act with a commission at the
end of it, and the pool decides that — the same reason a rep cannot browse the
pool and cherry-pick. **This one is arguable and is flagged in §12.**

### The defended answer on `SalesRepNote`

**Yes — a team lead reads their direct reports' notes, and only notes written
after the tier existed.**

*For:* a sales note is not a diary. It is FieldQuo's record of what a contractor
said, written on FieldQuo's time about FieldQuo's prospect, and it is the only
place the reason a deal died is ever written down. A lead who cannot read it can
coach on outcomes and never on causes, which is coaching on the scoreboard. When
a rep leaves, their book passes to someone; sealed notes mean the next rep
re-learns every objection by making the same call.

*Against, and it is real:* candour. A rep writes differently knowing their
manager reads it.

*What settles it:* the cost is paid **once, at the boundary, and honestly.**
Every rep who has typed a note so far read this sentence above the box: *"Other
sales reps cannot [read this] — a note is scoped to whoever wrote it."* A team
lead is a sales rep. Turning the tier on without a boundary would retroactively
falsify a promise those reps relied on when deciding what to write down, and a
promise you can revoke backwards was never a promise.

So `TEAM_LEAD_NOTE_VISIBILITY_FROM` is an ISO date, set on the day this is
enabled and never moved again. Notes older than it stay superadmin-only forever.
It is `null` today, which makes the whole tier inert:
`canReadTeamNote` refuses everything while there is no boundary. The compose
notice is **computed** from whether the tier is live, never asserted — the exact
mistake `lib/sales/playbook/store.js`'s header records.

### Why there is no team-lead screen yet

`SalesRep` carries no manager column. `lib/sales/notes/visibility.js` already
exported `HAS_REPORTING_LINE = false` as a fact and its platform screen says so
in as many words. The scope function is written and tested — `visibleRepIds()`
returns a lead's line including themselves, `[NO_REP]` for anything it cannot
make sense of, and `{}` **only** for a superadmin. The column it needs is in the
pending schema. **What is deliberately absent is a half-built version**: a board
that shows a team lead the whole floor and calls it their team is worse than no
board.

The reporting line also cannot be trusted to the database — a nullable
self-referencing FK is perfectly happy with A → B → A, and the first thing that
walks the chain hangs. `wouldCycle()` is the guard, and it refuses rather than
allows when it cannot terminate.

---

## 8. Stats — derivable, and not

Grounded in what exists. **No metric here is invented.**

### Already derivable, already computed (unchanged by this work)

Signups today / this week / total (`bucketSignups`, UTC, Monday weeks);
milestones reached; commission owed / paid / reversed (`balanceCents`,
`splitPayable` — summed from rows, never stored); lead pipeline by status;
conversion rate with `RATE_FLOOR` suppression and a printed fraction below it.

### Newly derivable — needs `SalesCallAttempt`, which is handed over not pushed

| Figure | How |
|---|---|
| Dials per rep per day | count of rows |
| Disposition mix, per rep and per trade | `dispositionMix` |
| **Calls not written up** | `pending` — the most useful number on the board |
| Reported reach rate | reached ÷ logged, with the same `RATE_FLOOR` |
| Cap headroom for a number | `attemptsLast24h` |
| Callbacks booked, upcoming, **overdue** | `callbackState` |
| Carrier cost per call and per day | `providerCostCents`, summed only over rows that reported one |

### Newly derivable — needs `SalesRepActivity`

Time on calls, time writing up, time available, time paused **split by reason**,
working time. All declared, all labelled as declared.

### Newly derivable — needs a call bridged through FieldQuo

Talk time, ring, answer, hangup, and the carrier's own final status. **These are
measurements and they are printed as such — with the count they were measured
from, every time.** A day of forty calls where six were bridged has a real mean
over six calls and nothing to say about the other thirty-four; `meanTalkMs`
never travels without `measuredOf` and `total`, and the check asserts it.

### Still not derivable, and named on screen

- **Talk time on handset calls.** The OS takes the call. Those rows are excluded
  from every duration rather than counted as zero.
- **Abandon rate and dialler statistics.** There is no dialler. Nothing to
  abandon.
- **Recording and QA scoring.** Recording is off — see §9.
- **Connect rate as a description of what a rep achieved.** Twilio reports
  whether a call was answered and that is printed. It cannot report whether the
  person answering was the one the rep needed. So the human figure stays the
  *reported* reach rate, labelled as the self-report it is, beside the carrier's
  answer rate rather than replacing it.
- **Cost per conversation.** A measured numerator over a self-reported
  denominator produces a figure that improves when a rep logs fewer outcomes.
- The four already in `performance.js`'s `NOT_TRACKED` — cost per acquisition,
  time to close, pipeline value — are unchanged. Only its `callsAndTalkTime`
  entry is superseded.

---

## 9. In-browser calling

The call happens inside FieldQuo. Twilio is the carrier and is never a surface
anybody sees.

- **`POST /api/sales/calls`** — re-asks the calling gate with the cap now
  counted, writes the attempt, returns the caller ID and the attempt id.
- **`POST /api/sales/calls/token`** — a 10-minute Twilio access token.
- **`POST /api/rep-dial/bridge`** — the TwiML that bridges the two legs.
- **`POST /api/rep-dial/status`** — ring / answer / hangup / price.

### Four properties that hold the whole thing

1. **The number dialled comes from OUR row, never from the request.** The
   browser sends an `attemptId` and nothing else that matters. A compromised or
   curious rep cannot turn FieldQuo's Twilio account into a way to ring anybody
   they like.
2. **The identity comes from the gate, never from the body.** There is no
   `salesRepId` parameter on the token route, so there is no shape of request
   that mints a credential for somebody else.
3. **The gate guards both doors.** `dialHref()` was structural — it cannot
   return a target from a refusal. A POST that bridges a call is a second door,
   and a gate on one door is not a gate. `callPlan()` refuses anything that is
   not `allowed`, and the check calls it with each decision.
4. **An attempt older than 120 seconds cannot be bridged.** An attempt id is a
   stable string that appears in a browser; bridging a four-hour-old one would
   place a call whose window was checked four hours ago.

### The webhooks are not under `/api/sales`

`middleware.js` refuses everything there without a rep cookie, and Twilio has no
cookie. Worth naming because it is a trap: `"/api/sales-dial".startsWith(
"/api/sales")` is **true**. Hence `/api/rep-dial`. The signature is the access
control, through the same verifier the SMS routes use.

### Caller ID

Local where FieldQuo holds a number in the prospect's area code, because a
contractor in Tulsa answers a 918 number and lets an unknown one ring out. The
candidate list is numbers actually bought — there is no path that constructs a
plausible-looking local number. Spec §25 forbids it, Twilio rejects it (21210),
and the refusal should not depend on the vendor noticing. With no local match a
real number is presented; the fallback is *stable* so the same prospect sees the
same number twice.

Numbers live on `PlatformSmsNumber` with `purpose: "sales_voice"`. They must not
live on `VoicePhoneNumber` — its `companyId` is a required FK and `heldNumber()`
enforces one per company, so a pool is structurally what that code treats as a
bug. **Admission: that model's name has outgrown it.** Renaming is the owner's
call; inventing a second tenant-free number table to avoid the rename would be
the parallel system AGENTS.md warns about.

### Recording is OFF, and that is the decision

Recording a two-party call is consent law, not a feature flag. Several states
this product already enumerates for calling hours require every party to agree.
Turning it on means a per-jurisdiction disclosure played to both legs and stored
— which is a feature, and which the contractor side of this codebase already has
a check script for. Shipping the toggle first produces recordings nobody may
listen to. There is no `record` parameter and the check asserts there is none.

### Microphone permission

A call button that silently does nothing because a permission prompt was
dismissed six weeks ago is exactly the control AGENTS.md opens by forbidding,
and this is its most likely cause. So permission is three-valued: `granted`,
`denied`, and `null` for "the browser will not tell us", which does **not**
block — some browsers do not implement the query and treating that as denied
would take the good path away for no reason. On `denied` the in-app button is
removed and replaced with the reason and the fix.

---

## 10. Automated dialling — built, named, switched off

`lib/sales/calls/dialMode.js`. Preview runs. Progressive and predictive are
defined, described in FieldQuo's own terms, and refused.

Two switches, not one: `SALES_DIAL_MODE` selects, and
`SALES_AUTOMATED_DIAL_ENABLED` must be **exactly the string `true`** — not
truthiness, not `1`, not `yes` — so a stray value in a deployment config cannot
start automated dialling by itself. The refusal says the position is *pending*,
not that the thing is impossible.

`canDialAutomatically()` exists with no caller. That is deliberate: a gate
written after the thing it gates is a gate somebody has to remember to add.

The permanent negative control in `check:sales-calling-window` — no sales path
reaches `lib/voice/outboundCall.js` — **still passes**, and the new check adds
its own: nothing in `lib/sales/calls/` references it, and the dial-mode module
imports no vendor client at all.

---

## 11. The Prisma — handed over, NOT pushed

Full definitions with their reasoning: **`lib/sales/calls/schema.pending.prisma`**.
Nothing in this session ran `prisma db push`. The check asserts no file in this
feature can shell out to run one.

Summary of what it contains:

- **`model SalesCallAttempt`** — the dial and its outcome. `toE164` is what the
  cap counts. `dialChannel` says whether the provider columns can ever be
  filled. Provider columns (`providerCallSid` @unique, `providerStatus`,
  `ringingAt`, `answeredAt`, `endedAt`, `talkSeconds`, `holdSeconds`,
  `providerCostCents`) are nullable and stay null on a handset row — never
  defaulted to zero. The gate's decision is frozen onto the row
  (`jurisdictionCode`, `decisionAtDial`, `windowText`, `prospectTimeZone`,
  `timeZoneSource`) so *"was this call lawful when it was made"* is answerable a
  year later, after the jurisdiction table has been edited. Playbook and
  experiment columns are the missing half of §38's A/B framework — the
  assignment has been stored before the call since it shipped, with nothing to
  measure it against.
- **`model SalesRepActivity`** — the state log, with `heartbeatAt`. One table,
  not a live row plus a log.
- **`SalesRep.managerId`** — self-relation shaped after
  `Worker.manager @relation("WorkerReports")`, `onDelete: SetNull`. This is the
  org chart `lib/sales/notes/visibility.js` records the absence of.
- **`PlatformVoiceCall`** gains `prospectId`, `salesLeadId`, `matchedBy`,
  `matchedAt` and an index on `fromE164`.
- **`PlatformSmsNumber`** gains `voiceUrl` and one documented `purpose` value.
- Four one-line relation backs.

**One thing to do in the same commit:** `check-sales-calling-window.mjs` carries
a tripwire asserting `SalesCallAttempt` is *not* in the schema. It is not stale
and not in the way — its message is *"if this fails, wire the cap up."* Adding
the model flips it, and the assertion that replaces it is already written in
`check-sales-call-handling.mjs`: if the model exists, the queue route must pass
`attemptsLast24h` into the gate.

---

## 12. The decision I am least sure of

**Whether a team lead may release a stuck claim.**

The design says yes to *release* (back to the pool) and no to *transfer to a
named rep*. The reasoning: transfer is a routing act with a commission at the
end of it, and letting a lead choose who gets the conversation is a lever on who
gets paid, however indirectly — attribution locks at signup via the rep's own
link, so the lever is one step removed, but it is a lever.

**The case against my own answer** is that it is theatre. A lead who wants to
give a prospect to a particular rep can release it and tell that rep to claim
the next one in that trade, and the pool drains oldest-first so they will
probably get it. If the control is trivially routable around, refusing it buys
nothing and costs a supervisor a legitimate tool — a rep goes on holiday holding
twelve claims and somebody has to move them.

OMniLeads allows the reassignment outright (`_reservar_contacto` takes a contact
from one agent and gives it to another) — and its own code carries a TODO saying
the supervisor's permission over that campaign is never validated, which is not
an argument for copying it.

The honest position: **this needs the owner, and it is a product decision, not
an implementation detail.** Nothing is built either way. If the answer is
"leads may reassign", the thing that must come with it is an audit row —
`SalesPlaybookAssignment.assignedBy` sets the precedent, and for the same
reason: a manual override that is indistinguishable from a system decision makes
every historical result unreadable.

Secondary, and nearly as uncertain: **whether pause reasons should be a
superadmin table** (§4). Standing rule 1 says yes; report readability says no. I
chose no and flagged it rather than deciding it quietly.

---

## 13. Where this stopped

**Landed and green:** dispositions and attempt capture; the 24-hour cap now
enforced rather than reported the moment the table exists; agent state;
in-browser calling end to end; the superadmin floor board at
`/platform/sales/floor`; the three-tier scope rule; `check:sales-call-handling`
in `check:all`, 264 assertions, 24 mutations each confirmed applied and every
one caught.

**Written, tested, inert:** the team-lead tier. Needs `SalesRep.managerId`.

**Designed, refused:** progressive and predictive dialling.

**Not started, highest priority:** an inbound "take me off your list" reaching
`SalesSuppression` (§6). It is the only live compliance gap this document
found.

**Not started, lower:** suppression consulted at claim time (§3); a claim-event
log so lapses can be counted (§3); the team-lead board (needs the column).
