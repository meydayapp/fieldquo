# FieldQuo demo — AI Receptionist, 15 minutes

Same account, same audience as `docs/DEMO-SCRIPT.md`: one person, one van,
about to hire their first employee, Canadian, not technical, cares whether it
works on a phone in a driveway. Read that document's section 0 first if you
haven't — this is a second 15-minute block from the same family, built around
one feature instead of the whole pipeline. `docs/SUPPORT-GUIDE.md`'s "To turn
on the AI phone receptionist" section is the other document this one leans on;
its three-step order (number, credit, switch) is why Part A below is ordered
the way it is.

**How to use this document.** Part B is written to be read aloud, live, off a
second screen while you click. Anything in a blockquote is a sentence you can
say word for word. Anything in *[italic brackets]* is a stage direction — what
to click, what to point at — never read those out loud. Parts A, C and D are
reference material for you, not for the call; they are marked as such.

The pitch for this feature is not "look what the robot can do." It is: **you
are on a ladder, the phone rings, and right now that call goes to whoever
answers next — a competitor, or nobody.** Everything else is in service of
that one sentence.

---

## PART A — Setup checklist, in dependency order (NOT read aloud — do this before the call)

### 1. The account and the trade
Same as `DEMO-SCRIPT.md` checklist item 1: confirm `demo1` is on the painting
preset at `/platform/demo` before you rely on any of this. Company name
**Northside Painting Co.**, brand colour `#1E5F8C`, unless it's been switched.

### 2. Business hours — required, and it is the same hours the receptionist reads
**Where:** `/app/settings/company`.
**What:** the seeded hours from step 1 (Mon–Fri 8–5, Sat 9–1) should already be
there. This is `lib/company/businessHours.js` — deliberately the *company's*
opening hours, not any one estimator's personal booking calendar
(`AvailabilitySchedule`), because those two are allowed to disagree and
conflating them is how a receptionist announces an estimator's day off as the
whole business being closed. The receptionist's prompt gets this sentence
verbatim (`companyFacts()` in `lib/voice/prompt.js`) — with no hours on file,
the line is simply omitted, and the agent is instructed to say it doesn't know
rather than invent Mon–Fri.
**Also required for booking a visit on the call.** The manual "Book a
callback" button on `/app/receptionist` fails with `no_times` and points back
to this exact page if hours are missing — that failure is a real, working
guardrail, not a bug, but it is a bad thing to discover live.

### 3. THE ONE TO CHECK FIRST: does this demo already have a receptionist number and voice credit?
**Where:** `/app/settings/voice`, Cards 1 and 2.

This is the item most likely to trip up a live demo, so it gets its own
explanation. `lib/voice/spendGate.js` prices a number's first month against
the company's **real** balance before the "Purchased" button on this screen
will even light up — that check runs the same way for a demo account as for a
paying one, because the button's disabled state is computed by the same
`spendVerdict()` either way. The $10.50 of starting credit a company gets (
`grantFreeTrial` in `lib/voice/credits.js`) is only granted **after** a number
is bought, not before — so a demo account that has never had a number bought
on it starts this screen with $0 of voice credit and a **greyed-out**
"Purchased" button. The server itself would let a demo through for free (see
`lib/voice/demoLine.js` — the demo path is $0 regardless), but the UI's own
affordability gate doesn't know that, so nothing on screen invites the click.

**What this means in practice:** if `demo1` has never had its receptionist set
up, buying the number is not something you can casually do thirty seconds
before the call — it needs real credit on the account first, and that credit
comes from the same Stripe top-up flow a paying company uses. **Check this
days ahead of the call, not minutes.** If a number and a "demo line" badge are
already showing on this screen, you're done — this has clearly been used
before and the row survives resets on purpose (`VoicePhoneNumber`,
`VoiceAgent` and `VoiceCreditEntry` are explicitly excluded from what a demo
reset wipes). If the card is empty, get someone who can push a top-up through
first.

### 4. FieldQuo's own sales line — check it's actually live
**Where:** ring it yourself, once, before the call. The settings screen only
offers this invitation when `PlatformVoiceAgent` (id `fieldquo`) is `enabled`
in the live database — a fact this document cannot check for you. See Part C.

### 5. The words, the voice, the tuning — sensible defaults are fine
**Where:** `/app/settings/voice`, Card 3.
**What:** if nobody has touched this, the greeting defaults to "Thanks for
calling Northside Painting Co, how can I help?", the voice defaults to the
first English voice on the shortlist (Cartesia's **Andrew**), and the four
tuning dials default to balanced / normal background / quick / professional.
All of that is fine to demo as-is — Part B's beat on this card is about
*showing* it's editable, not about needing to have pre-edited it. If you'd
rather not improvise a greeting live, decide what you're going to type ahead
of time.

### 6. Nothing else is required
The instant-quote trades that feed the receptionist's intake questions
(interior/exterior painting) were already enabled by the quote-to-cash setup
in `DEMO-SCRIPT.md`'s checklist. AI credit (the *other* wallet — see Part C)
is not required for the receptionist to work at all; it only powers the
optional "Draft this from my company profile" button, which this script
doesn't use live.

---

## PART B — The 15-minute script (READ THIS ALOUD)

Total: 15:00. Land on `/app/settings/voice` before you start talking.

### 0:00–1:00 — Open

*[Land on /app/settings/voice. Don't click anything yet.]*

> Right now, if you're up a ladder or you've got your hands under a sink, you
> can't get to the phone. And every call you miss isn't a call that waits for
> you — it's a job that goes to whoever picks up next. That's the thing this
> fixes.

*[Point at the line under the page title: "Answers the calls you can't, takes the details, and books visits against your real availability. It never quotes a price."]*

> Read that last part again — it never quotes a price. That's not a slogan,
> that's a rule it physically can't break. I'll show you exactly why that
> matters in a minute, because that's the part that should actually sell you
> on this, not the fact that it answers the phone.

**[If they jump in here with "does it sound like a robot?"]**
> Good question — hang on, I'll play you the actual voice in about a minute
> and you can judge for yourself.

---

### 1:00–4:00 — The words and the voice, live

*[Scroll to Card 3, "What it says."]*

> This is everything that decides what it actually says on your phone. Not a
> script written by us — yours.

*[Point at the greeting field.]*

> This is the first thing a caller hears. Right now it says "Thanks for
> calling Northside Painting Co, how can I help?" — that's it, that's the
> greeting, and you can change it to whatever you'd actually say.

*[Type a short edit into the greeting field — something plain, e.g. "Thanks for calling Northside, what can I do for you?"]*

> See, I just changed that. That's not a mock-up, that's the actual thing your
> phone would say tonight if I hit save.

*[Point at the "Anything it should know" box.]*

> And this box is where you tell it the stuff that isn't obvious from your
> settings — "we don't do commercial jobs," "if someone mentions a leak, treat
> it as urgent," whatever you'd want a new hire to know on their first day.

*[Scroll to the voice picker. Play a sample if the picker supports it.]*

> And this is the actual voice. We don't hand you thirty options that all
> sound the same — we picked three, because nobody wants to sit here
> auditioning voices, they want a good one and to get back to work. Have a
> listen.

*[Play the sample. Pick "Andrew" if nothing is chosen yet.]*

> That's the one that answers your phone if you pick it. Not a demo voice —
> the actual one.

*[Scroll to the four tuning options: interruptions, background, pace, manner.]*

> And these four are the only things about how it sounds that you get a say
> in — everything else is stuff you'd never notice, so we didn't put it on the
> screen. This one matters for you specifically —

*[Point at "background."]*

> — because your callers aren't ringing from a quiet office, they're ringing
> while you're in a van or on a job site. It's already set to filter out
> engine noise and traffic. That's not a guess, that's set for exactly your
> situation.

---

### 4:00–6:30 — The guardrails ARE the pitch

*[Point back at the hint under Card 3's title: "It will never give a price, promise a time it hasn't checked, or claim to be a person."]*

> Now here's the part I actually want you to care about. Your worry isn't "can
> it answer the phone" — anything can pick up and say hello. Your worry is
> "what does it PROMISE while it's got my business's name on it." So let me
> tell you exactly what it will and won't say, because these aren't
> suggestions, they're hard rules it cannot get talked out of.

> Rule one: it never gives a price. Not a figure, not a range, not "probably a
> couple grand." If someone asks what a job costs, it tells them someone will
> put a proper quote together, and it takes their number. Because the second
> it says a number out loud, that's a number your business might get held to
> — and you never even saw it.

> Rule two: it never promises a time it hasn't actually checked. It won't say
> "we can be there Tuesday" unless it's looking at a real opening in your
> calendar right then. No slot, no promise — it takes their preferred times
> and says someone will confirm.

> Rule three: if someone asks straight out whether they're talking to a
> person or a robot, it tells them the truth. It doesn't lie about that — in a
> lot of places that's actually illegal, and it's also just the honest way to
> run a business.

> And one more thing, because this matters and you should know it's in there:
> every call is recorded, and it tells the caller that, once, early, in one
> line — "just so you know, this call's recorded" — then it moves on and keeps
> helping them. It doesn't make a big legal announcement out of it. It just
> says it, honestly, and carries on.

**[If they ask "what if it messes up and books something wrong?"]**
> It physically can't say "you're booked in" unless the booking tool comes
> back and confirms it worked. If the booking fails for any reason, it tells
> the caller straight — "I couldn't get that booked, someone will call you
> back" — and takes their number. It never tells someone they have an
> appointment that doesn't exist.

---

### 6:30–8:30 — Money, honestly

*[Scroll up to Card 1, "Credit."]*

> Let's talk about what this actually costs, because I'm not going to wave my
> hands at you about that.

> It's thirty-five cents a minute. Rounded up to the next minute, one-minute
> minimum — same as any phone system's always billed. Your number itself
> rents for four dollars a month. That's it. No monthly minimum on top of
> that, no charge for a slow month — if nobody calls, you don't pay for
> minutes nobody used.

*[Point at the top-up buttons.]*

> You buy credit in advance — ten dollars gets you about twenty-eight
> minutes, thirty dollars gets you about eighty-five, and so on. It's prepaid
> on purpose. The worst thing that can happen is it stops answering when the
> credit runs out — which is exactly where you were before you had this at
> all. You don't wake up to a four-hundred-dollar surprise bill because a
> robocaller found your number.

*[Point at the call-cap text, if a number with credit is showing.]*

> And that's not a hand-wave — look, it says it right here. A call only runs
> as long as your credit covers, and it ends there. Not "we'll bill you for
> whatever happens," it just stops and asks someone to call back. Top up, and
> that limit lifts immediately.

> Compare that to a live answering service. Those typically run you a monthly
> minimum whether you get one call or none, plus a per-call charge on top.
> This has no floor. A quiet February costs you nothing.

---

### 8:30–10:00 — Turn it on

*[Scroll to Card 4, "Answer my calls."]*

> This is the switch. One click, and this number starts taking every call you
> don't get to.

*[Click the switch to turn it on, if it isn't already.]*

> That's it. It's live. On a real number, that's the whole setup — number,
> credit, words, switch, done.

*[Point at the amber "demo line" badge on Card 2's number.]*

> Now, I have to be straight with you about one thing on THIS particular
> screen — this number, right here, is a demo line. It's simulated on
> purpose, so nobody can actually dial it — it's drawn from a block of numbers
> that was set aside specifically so it can never ring a real phone. Every
> other part of what I just showed you is completely real — the greeting, the
> voice, the rules, the setup. It's only this one number that can't take an
> actual call, because it's not supposed to be dialable by a stranger after
> this demo's over.

---

### 10:00–11:00 — Hear it

**[Branch A — only if you confirmed FieldQuo's own sales line is live before this call:]**

*[Dial the number shown, on speaker.]*

> Want to actually hear it answer? I'm going to call our own line right now
> so you can hear the exact same setup, live.

*[Let it answer. Say nothing else until it speaks.]*

> That's it. That's the same voice, the same rules, live on a real phone
> line.

**[Branch B — if you did not confirm it's live, use this instead. Do not promise a live call.]**

> I'm not going to fake a phone call for you — I'd rather show you something
> real than something staged. What I can show you is exactly what happens
> once a call comes in, because we've got real examples sitting right here.

---

### 11:00–14:30 — What a call actually becomes

*[Click through to /app/receptionist.]*

> This is where every call lands. Let me walk you through what's actually
> here.

*[Point at the flagged section at the top, if it has an entry — the seeded voicemail.]*

> See this one at the top? Someone called, hung up before leaving details.
> Twenty-one seconds, cost you thirty-five cents. It's flagged, and it stays
> flagged until somebody here marks it dealt with — it doesn't just scroll
> away and get forgotten.

*[Point at an answered call in the list below — the 143-second one.]*

> And here's a real one — someone called asking about a project, the
> assistant took the address and told them someone would follow up with a
> quote. Two minutes twenty-three seconds, a dollar five. You can see exactly
> what it cost and exactly what was said — no mystery bill, no guessing what
> happened on a call you weren't on.

*[Point at any booking badge and lead link, if present.]*

> If it booked something, that shows up right here, linked straight to your
> calendar. If it took someone's details, that's a lead — linked straight to
> your leads list. Nothing lives only inside a phone call and disappears when
> it ends.

**[Be honest about one thing here — do not click "Listen" and pretend it works on these rows:]**

> One honest note — these particular calls are sample data, so there's no
> audio to actually play back on these specific ones. On a real call, there
> is a recording, and there's a Listen button right here to play it back.
> These four are here so you can see what the LIST looks like on a normal
> week, not to fake a phone call.

*[If a row has no booking, point at "Book a callback."]*

> And if a call comes in and doesn't end with a time booked — say they wanted
> to think about it — there's a manual button right here so a real person can
> still put them in the calendar afterwards. Nothing falls through just
> because the call ended without a yes.

**[If they ask "what if it can't answer their question at all?"]**
> Then it does the honest thing — it says it doesn't know, and it takes their
> name and number so a real person calls back. It never guesses at your
> hours, your services, or your prices. Only what you've actually told it.

---

### 14:30–15:00 — Close

> So here's the actual math. Thirty-five cents a minute, four bucks a month
> for the number, no minimum. Compare that to one missed call turning into a
> job somebody else got instead — that's the whole trade. It answers every
> time, it never promises something you can't deliver, and it's sitting right
> there in the same place as your quotes and your invoices.

> What do you want another look at?

---

## PART C — What cannot be demoed live, and why (reference — NOT read aloud)

### The demo line cannot take a real call
Covered in the script above, but the mechanism is worth having in your own
words if a technical prospect pushes on it: `lib/voice/demoLine.js` buys a
number in NANP's reserved fictional block (`555-01XX`) rather than a real one,
specifically so a demo cannot outlive the sales call and cannot be dialled by
a stranger after the account gets re-dressed as a different trade next week.
Everything wired to that number — the agent, the prompt, the greeting, the
voice, the tuning — is the same real machinery a paying company's number
uses. Only the number itself is fictional.

### The invitation to ring FieldQuo's own line is not guaranteed to be there
`app/api/settings/voice/route.js`'s `fieldquoInviteNumber()` only populates
when `PlatformVoiceAgent` (id `fieldquo`) is read from the database as
`enabled` — a live production fact this pass of the codebase cannot confirm.
**Ring it yourself before every single call.** If it's off, use Branch B in
the script above and do not promise the live-call moment.

### The seeded call list has no real audio
Confirmed by reading `lib/demo/seedDemo.js`: the four fixture calls it writes
into `VoiceCall` never set `recordingUrl`, and `app/api/voice/calls/route.js`
only returns a `recordingHref` when that field is present. So the "Listen"
button — which does exist and does work on a real call — will never appear on
these four rows. This is stated in the script above; do not click for a
Listen button that isn't there.

### "Draft this from my company profile" and "read the call as a quote" need real data
Two AI-assisted buttons on these screens — the knowledge-gap drafting on
Settings → Voice, and `CallQuoteDraft` on the receptionist call list — both
read a real transcript or a real company profile to produce something useful.
Against the fixture calls specifically, `CallQuoteDraft` has no real
transcript to read and will show its "nothing drafted" state rather than
anything worth clicking through live. Neither is in the 15-minute script for
this reason; mention them only if asked, in one sentence.

### The demo's voice credit and number are a one-time setup, not something to do live
Explained fully in Part A, item 3. Buying the very first number for any
company — demo or paying — needs real credit on the account first, because
the free trial minutes are only granted after the purchase, not before. This
is not something to attempt for the first time in front of a prospect.

### Turning the switch off has one honestly unresolved question
The settings page itself says this plainly, and it is worth repeating rather
than promising something unverified: when the "Answer my calls" switch is
turned off, Retell's documentation does not state whether a caller then hears
normal ringing or a busy tone. The code comment names three separate
assertions in this codebase that claimed to know and hadn't checked. If you
demonstrate turning it off, don't claim to know what the caller would hear.

---

## PART D — "If they ask about X" (reference — NOT read aloud)

**"What if I run out of credit mid-call, with someone still on the line?"**
The call ends when the balance stops covering it (`lib/voice/callCeiling.js`
enforces a hard ceiling at the provider level, not just in the UI), rather
than running the company into debt. It is not graceful for the caller —
nobody has built a "one moment while I check something" off-ramp — but it is
bounded and it is never a surprise bill.

**"Can it answer in French, or Spanish?"**
Yes, in the languages the shortlist currently covers: English, French
(Canadian) and Spanish (Latin American). It's set at the company level, and
if a caller speaks to it in a different one of those two, it switches and
stays there for the rest of the call. Outside those two, the caller is heard
in whichever language the company itself is set to.

**"What if it can't reach a person — does it just leave them hanging?"**
No — if transfer is switched on, it tells the caller "I'm putting you
through" and does exactly that, live, before it finishes the sentence. If
transfer isn't set up, it says a real person will call back and takes their
details — it never pretends it's putting someone through when nothing is
actually on the other end.

**"Can it call people back too, not just answer?"**
There's a separate switch for that — off by default — that has it call
clients back after a quote goes out, the day before a booked visit, and to
follow up on a new lead. It only calls within business hours, and anyone who
says stop is taken off the list permanently. It's a real feature; it's just
not part of this 15 minutes.

**"Is recording it legal? What about consent?"**
It tells every caller, once, early in the call, that the call is recorded.
Consent requirements vary by province and this is not a legal opinion — if a
prospect pushes on the legal specifics, say plainly that's a question for
their own advice, not something to answer on the spot.

---

## What's genuinely unverifiable from this pass, said plainly

- **Whether `demo1` currently has a phone number and voice credit set up at
  all.** This is a live database fact, not something readable from the code.
  Confirmed procedure is in Part A, item 3 — check it days ahead, not minutes
  before.
- **Whether FieldQuo's own sales line is actually live right now**, same as
  `DEMO-SCRIPT.md` says about the same fact — depends on
  `PlatformVoiceAgent.enabled` in the live database. Ring it yourself before
  every call.
- **Whether a demo account's Stripe top-up runs in test mode or would
  genuinely charge a card.** Nothing in `app/api/settings/voice/topup/route.js`
  special-cases a demo company, so if a number has never been bought on this
  account, getting the first one requires whatever real top-up flow a paying
  company would go through. Whether that flow is configured against Stripe
  test keys for this environment was not something this pass could confirm —
  ask whoever manages the demo companies' payment configuration rather than
  attempting a top-up cold.
- **Whether `/app/settings/voice`'s exact on-screen wording matches what's
  quoted in Part B word for word** at the moment you present — the English
  fallback strings were read directly from `app/app/settings/voice/page.js`
  and `lib/voice/agentTuning.js`, but a translation catalogue edit or a copy
  change since this was written could have moved the exact phrasing on
  screen. Glance at the actual screen before reading a quoted line aloud.
