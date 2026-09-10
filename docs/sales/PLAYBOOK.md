# The FieldQuo Sales Playbook

For the person who is going to pick up a phone and ring a contractor who has
never heard of us.

Everything in this document is what the software says. The scripts come out of
`lib/sales/playbook/defaults.js`, the objections out of `objections.js`, the
moments either side of the call out of `moments.js`, and every competitor fact
out of the same rows that build the public comparison pages on fieldquo.com.
That is deliberate: a rep and a homeowner must never be told two different
versions of the same fact. If a sentence in here is wrong, it is wrong on the
calls and on the website as well — say so rather than working around it.

The rep-facing version of all of this is at **/sales/playbook** in the portal,
and it is searchable by what the contractor just said. This document is the
version you can print and read on a Sunday.

---

## 1. What the call is for

**The call's only job is to earn the next conversation.** Not to close, not to
price, not to diagnose. Every script below asks for one small, dated thing and
nothing else. Nothing quotes a price. Nothing asks for a decision.

Why that is not softness: in the owner's own twenty conversations with
contractors, not one win closed on first contact, and the largest recovered
deal came from a follow-up months later. The standard figure is that 81% of
sales happen on or after the fifth call. So a sentence that lets the sequence
end — "tell me to go away", "I'll leave you alone", "if you're interested give
me a ring" — throws four contacts away to sound polite in one.

## 2. The opener, and why it changed

The old opener said why we were calling in its second sentence. It was
textbook-correct and it sounded like a SaaS salesperson reading a script. The
owner's correction is that the first call should ask permission, then ask a
question about the contractor's own day, and only then give the reason —
attached to what he just said.

So the call now runs:

```
Rep:        Hi — is that Eco Painting? Dan here, from FieldQuo. I know I'm
            catching you out of nowhere, and you've never heard of me.
            Can I give you thirty seconds on why I called?

Contractor: Go on then.

Rep:        Thanks. Quick question before I do — when you go out and look at a
            job, are you usually able to give them a price while you're
            standing there, or does it get put together back at the house
            afterwards?

Contractor: Usually later that night.

Rep:        If that's how it goes, that's exactly why I'm calling.
```

Three things are doing the work, and each is worth knowing by name:

1. **The candour line.** "I know I'm catching you out of nowhere, and you've
   never heard of me." It is simply true, and volunteering something true and
   costly is the fastest trust available to a stranger on a phone. It is a
   *statement*, not a question — the moment it becomes "have I caught you at a
   bad time?" the contractor can end the call by agreeing with you.

2. **The permission ask, phrased for a yes.** "Can I give you thirty seconds on
   why I called?" This is **not** the banned "I'll only take thirty seconds".
   The difference is one word wide and it matters: the banned version is a
   promise about *your* behaviour, volunteered and unasked, and it reads as low
   confidence. This one is a question that hands him control and names the size
   of what you are asking for, so a yes is cheap and a no is real.

3. **The pivot.** "If that's how it goes, that's exactly why I'm calling." Said
   the second he describes his own week. And it is conditional out loud on
   purpose — if he says he prices on the spot, you carry straight on with "and
   if I've got it wrong, say so now, because then most of what I was going to
   say doesn't apply." A pivot that only works on the expected answer is no
   pivot at all.

**Never say any of these.** Each one is a named failure, not a matter of taste:

| Don't say | Why |
|---|---|
| "Sorry to bother you", "thanks for your time" | Apologising for their time fails on arrival. |
| "I'll be ninety seconds", "I won't waste your time" | Promising not to waste their time suggests you are somebody who might. |
| "Did I catch you at a bad time?" | He agrees, and agreeing ends the call. |
| "Would you be interested in saving money?" | A question a single word can end — hanging up the telephone on yourself. |
| Any feature, before he has described a problem | Naming what you sell before he perceives a need raises the odds of a no. |
| "Only a few places left this month" | There is no real scarcity in a subscription, so any limit you state is invented. |
| "Most of our customers are painters like you" | We never quote one contractor's business to another. Ever. |
| "I love what you've done with the site" | Flattery works even when it is false and even when he knows you want something. That is exactly why it is off the table. |
| "Tell me to go away and I will" | See §1. |

## 3. Discovery — a survey, not an interrogation

A contractor will not answer a generic open question from a stranger, because
every answer discloses something. But **he will correct you when you are wrong
about his business.** So every question below states a guess with two options
in it, and the cheapest possible reply is a correction.

Ask permission before asking. Say out loud that you are not asking about money.
Then shut up: the prospect should be doing about seventy per cent of the
talking. The twelve-question block pasted at five prospects correlates with
silence; the two conversations that became the biggest wins were dialogue.

And when you get to the pain, **ask him for the number.** Never bring one of
your own. "In a normal month, how many quotes go out later than you meant them
to?" is worth more later than any figure you could have supplied.

## 4. The four scripts

Which one opens is decided by what our own research found about that business.
A prospect nothing has been observed about gets **no script at all** — that is
on purpose, because a script that claims to know something about a stranger we
have not looked at is the thing that gets caught.

Every one of them runs the same nine stages, and every one of them contains a
concession in the *relevance* stage that could genuinely lose the call. Leave
them in. A conceded drawback engineered to be painless is a trick; one that
could cost you the meeting is the only honest move you have.

### Competitive displacement  `COMPETITIVE_DISPLACEMENT`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. Quick question before I do — when you go out and look at a job, are you usually able to give them a price while you're standing there, or does it get put together back at the house afterwards?

**Establish relevance** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. You're already running {competitor} — so I'm not calling to tell you your scheduling is broken. You solved that, and I'm not going to pretend I know your business better than you do from the outside. The narrow thing I called about is whose name and whose colours a homeowner sees on the quote, the invoice and the emails in between. And the unhelpful half first: if that has never once bothered you, I'm the wrong call, and I'd rather hear that now than after I've built you something.

**Discovery** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about how the work comes in? Nothing about what you charge — I'm trying to work out whether there's anything here for you or not.

> - How many of you are on the tools at the moment — you and a crew, or you and a couple of subs?
> - Is most of it repeat and referral now, or are you still bidding against two others on a lot of jobs?
> - How far out are you booked — weeks, or months?

**Current process** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> Everything I could see from outside is a guess. You're the only one who knows how it actually runs, so correct me where I've got it wrong.

> - A homeowner calls on a Tuesday — who writes that quote, and when? Evenings?
> - Does {competitor} carry it all the way through to the invoice, or is part of it still in a notebook?
> - When the quote lands in their inbox, whose name is on the email it came from?

**Pain** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - Which part of that is the one that annoys you?
> - In a normal month, how many quotes go out later than you meant them to?
> - And when one goes out late, what usually happens to it?

**FieldQuo fit** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Then two things, and they answer what you just said. The first is whose name is on it: the quote, the invoice, the booking page and every email between them carry yours, and none of them carry ours — somebody holding three quotes cannot tell that two were written in the same software. The second is what happens before it goes: every quote gets read back to you, free, on every quote — what you have left off, and whether the price sits above or below what you have actually been winning at. Not what other contractors charge; your own accepted and declined jobs. Nobody else's numbers come into it and yours do not go out. Does the one you use now tell you that before you send it? And before you have to raise it: nothing comes off {competitor} to look at this. Nothing gets switched off, nothing gets imported, nobody learns anything this week.

**Objection handling** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> So here's what I'd like: give me your logo and the colour you use, and I'll build one real quote with your name on it and send it over. Then fifteen minutes on Thursday to look at it next to the last one you sent. You pick — first thing before you're out, or the end of the day.

**Close** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> Thursday at half seven then, and the quote's with you Wednesday night so you've read it before we speak. I'll text you the morning of. And if Thursday falls apart — it's a job site, it happens — tell me and we'll move it rather than drop it. If I don't hear anything I'll try you again in a couple of weeks.

### Online presence — no website  `ONLINE_PRESENCE`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. One question before I do — when somebody who's never met you goes looking to see whether you're any good, is there somewhere you'd send them, or is it whatever comes up when they search your name?

**Establish relevance** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. There's no website I could find. Your number's out there, so anyone who already has your name gets to you fine — it's the ones who don't have your name I called about. They search, they find two others with photographs of finished work, and you were never in that comparison at all. Now the part that costs me: what we'd build isn't a site somebody designed for you. It's put together out of jobs you've already done, it lives at an address on fieldquo.com, and while it's free it carries a small "Site by FieldQuo" line at the bottom. If that's beneath how you want to look, tell me — that's a real reason not to do this.

**Discovery** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about where the work comes from? Nothing about money — I want to know whether this is even for you.

> - Where does most of it come from now — word of mouth, a board, or the ads?
> - How many of you are there?
> - How far will you travel for a job worth having?

**Current process** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> You're the authority on this and I'm guessing from outside. Tell me where I'm wrong.

> - When somebody wants a price, what do they actually do — call the mobile?
> - How do they get that number in the first place, if nobody's given it to them?
> - Has anyone ever said they nearly went elsewhere because they couldn't find anything about you?

**Pain** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - How many of those calls come in while you're up a ladder?
> - In a week, how many go to voicemail and never call back?
> - Do people ask you for photos of previous work before they'll commit?

**FieldQuo fit** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Then the photos you've just described are the site. We build it out of the jobs you've already done: your name at the top, your colour, the work, and a way for somebody to ask you for a price at nine at night while you're asleep. You don't write anything. And the objection you're about to have — that it's a project — it isn't. It's an afternoon, and the afternoon is mine.

**Objection handling** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> Here's what I'd like: send me three photos of a job you're proud of, to the number I'm calling from. I'll have something with your name on it to show you by Thursday. If you hate it, tell me what's wrong with it and I'll take another run at it.

**Close** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> Three photos to this number, then, and I'll call you Thursday morning with something to look at. If the photos don't happen this week that's fine — I'll call anyway and we'll do it on the phone.

### Booking gap — a website with no way to book  `BOOKING_GAP`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. One question first — when somebody's on your site at nine at night and wants you, can they put themselves in your diary there and then, or does it hang on them remembering to ring in the morning?

**Establish relevance** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. The site does its job — that's not what I called about. What it hasn't got is any way for somebody to put themselves into your diary: every page ends with give us a call. And the honest limit on it, before you spend anything: a booking page will not bring you one extra enquiry. It doesn't get you found. If the problem is that the phone isn't ringing enough, this is the wrong conversation and I'd rather say so now.

**Discovery** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about the enquiries you do get? Nothing about your rates.

> - Roughly how many does the site bring you in a week?
> - Who picks up when you're out on a job?
> - Are you booking a visit to measure, or quoting off photos people send?

**Current process** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> Tell me where my guess is wrong here.

> - Somebody's on the site at nine at night and they want you — what do they do next?
> - How many messages back and forth before a time is actually agreed?
> - Does that time go into a calendar, or is it in your head until the morning?

**Pain** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - Out of the ones who message you, how many go quiet before a time's agreed?
> - Have you ever turned up and they'd forgotten, or had somebody else in?

**FieldQuo fit** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Nobody books a kitchen off a form and I'm not going to suggest they should. What gets booked is you turning up to measure — a slot you've allowed, the address, the photos already attached, and none of that back-and-forth to arrange it. And the bit you'd raise: you keep the site you've got. It gains a button. It doesn't get rebuilt.

**Objection handling** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> Fifteen minutes and I'll put that button on the site you already have, with the hours you're willing to accept and nothing outside them. You choose the hours before I build it, not after.

**Close** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> Thursday at eight then, before you're out. I'll send the link the night before so you've clicked it yourself first. If Thursday goes wrong, message me and we'll find another one — and if I don't hear back I'll try you again after month end.

### Quote automation — enquiries arrive as email  `QUOTE_AUTOMATION`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. One question before I do — when an enquiry comes in, does it usually arrive with enough on it to price, or are you writing back to ask the same few things before you can even start?

**Establish relevance** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. There's an email address on the site and nothing else — no form, no questions. So every enquiry arrives as somebody's free text, and you're the one writing back to ask the same four things before you can price any of it. What I should say straight away: a form doesn't fix all of that. Some people won't fill one in, and those will still land in your inbox exactly as they do now. What changes is the ones who do.

**Discovery** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about that inbox? Nothing about your prices.

> - Roughly how many enquiries a week land in it?
> - What do you always end up having to ask them?
> - Who else can see it — anybody, or just you?

**Current process** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> Correct me where I've got this wrong.

> - An email arrives on a Tuesday morning while you're on site — then what?
> - How long is it usually before you get to reply?
> - How do you know which ones you've already answered?

**Pain** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - How many go cold while they're waiting on you?
> - Have you ever priced the same job twice because the first one got lost?

**FieldQuo fit** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Then it's the four things you just named. They get asked before the enquiry reaches you, and what arrives isn't a note in an inbox — it's a job in a list, with the answers and the photos on it, one press from a quote you can send from the van. And before you ask: you keep the address that's on the site. Anyone who'd rather just email you still can.

**Objection handling** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> Tell me the four things you always end up asking and I'll build the form round them — your questions, not ours — on the site you already have. Fifteen minutes on Thursday and you'll see what comes out the other end.

**Close** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> Thursday morning then. Send me the four questions whenever they come to you, a text is fine. If they don't arrive I'll bring my guess at them and you can cross them out — and if Thursday moves, I'll find you the week after.

## 5. Either side of the call

### Whoever answers the phone

*Somebody who is not the person you called for has picked up.*

**Opening**

> Morning — it's {repName} from FieldQuo. Is {businessName}'s guv about?

**If they ask what it is regarding**

> It's about how quotes go out of the business. I've not spoken to him before — I read your website this morning and rang off the back of it. Is he the one who prices the work, or is that somebody else?

**If he is not there**

> When's he easiest to catch — first thing, or the end of the day? I'll ring then rather than keep landing on you.

**If they offer to take a message**

> Do both if you can: put my name down, and tell me when he's about. I'd rather catch him than have him ring a number he doesn't know.

- Never say he is expecting your call, or that you are following up an email. There is no email, and the person who finds out is the person you needed.
- The receptionist cannot buy anything and does not want to hear why it is good. Give them a name, a subject and a time, and get off.
- The second line is doing real work: it finds out whether the person you have been asking for is even the right one. Write down what they say.

### The beep

*It rang out, or they sent you to voicemail.*

**The message, about twenty seconds**

> {repName} at FieldQuo, for {businessName}. I read your website this morning and there's one thing on it I wanted to put to whoever writes your quotes — it's a question rather than a sales call. I'm on {repPhone}. That's {repPhone}. I'll try you again Thursday morning either way.

- Say the number twice and slow the second one down. Somebody writing it down misses the first three digits of the first.
- Leave one on the first attempt, not the fourth. Four unexplained missed calls from a number nobody knows is how you get blocked.
- The last sentence is the one that matters: the next contact happens either way, so there is nothing for them to decide right now.

### The text, same day

*You spoke and agreed something, or you left a voicemail and want the number in their phone.*

**After a call that agreed a time**

> {repName} from FieldQuo. Thursday half seven as agreed - quote with your name on it lands Wednesday night.

**After a voicemail**

> {repName} from FieldQuo. Left you a message about your quotes - no need to ring back, I'll try you Thursday.

**After a call that went nowhere in particular**

> {repName} from FieldQuo. My number, in case the quoting comes up. I'll leave you be till month end.

- Plain hyphens, no em dashes, no curly quotes. One character outside GSM-7 halves the segment size and roughly doubles the bill on every text the team sends.
- Two segments is the ceiling the product enforces, footer included. The check does that arithmetic with the real send function rather than counting the template.
- Do not type an opt-out line. The route adds the identification, the address and the STOP line — typing a second one is not extra care, it is a message with two of them.
- Never text a landline. The dial controls refuse it and say so out loud; do not work around them by hand.

### The email, the day after

*They asked for something in writing, or the call ended with a date.*

**Subject**

> The quote with your name on it — {businessName}

**Body**

> {contactName},
> 
> Attached is one real quote for a job like the ones you do, with your name at the top, your colour, and nothing of ours anywhere on it. It took me twenty minutes and you did not have to do anything.
> 
> Two things to look at when you have a minute: whose name is on the email it would have arrived from, and the part underneath that says what the quote has left off.
> 
> Thursday at half seven still suits me. If it stops suiting you, tell me and we'll move it rather than drop it.
> 
> {repName}

- The attachment is the point. An email that only describes what you would build is the 'send me some information' stall answering itself.
- Do not add an opt-out line or a signature block with an address. buildOutboundEmail adds both, and it adds the reply token that files their answer against the right thread.
- Write it the day after, not the same night. A call and an email inside an hour reads as a system rather than a person.

### The fifteen minutes

*The meeting the whole call existed to earn.*

**1. Their words first, before anything is on screen**

> Before I show you anything — on the phone you said {theirWords}. Is that still the shape of it, or has this week been different?

**2. The thing you promised, and nothing else**

> This is the quote I built. Your name, your colour, and a job like the ones you do. Read it the way a homeowner would and tell me what's wrong with it.

**3. The one part they have not seen**

> The bit underneath is what I meant on the phone: before that goes out, it gets read back to you — what's missing, and whether the price sits above or below what you've actually been winning at. Your own jobs. Nobody else's numbers come into it.

**4. Stop showing things**

> That's the whole of what I wanted you to see. What would have to be true for this to be worth doing?

- Fifteen minutes means fifteen minutes. A demonstration that runs to forty has stopped being about them.
- Show the thing they asked about and nothing adjacent. Every extra screen is a new objection you invited.
- If they name something we do not have, say so and say it plainly. It is in the battlecards; read the honest half out.
- Do not demonstrate on their real data. The demo company is there so nothing typed in a meeting becomes a record somebody has to unpick.

### The ask

*The fifteen minutes are up and nothing is left to show.*

**The close**

> Two ways from here, and I'm happy either way. Either I put your own prices in it and the next quote you send goes out of it this week — or you leave it, and I ring you after month end when the season's calmer. Which is it?

**If they choose to wait**

> Right — month end. I'll put it in for the second week and text you the day before. The quote stays where it is, so there's nothing to set up again when we speak.

**If they say yes**

> Good. Send me your rates however they exist — a spreadsheet, a photo of a page, whatever you actually use — and I'll have it ready to send from tomorrow. Then send one real quote out of it and ring me if it feels wrong.

- After you ask, stop talking. Futrell is emphatic about this: anything said after the question takes the pressure off the decision, and the pressure is the only thing making it happen now.
- Waiting is a real answer and gets a real date. A rep who treats it as a loss argues, and arguing at the close is how a maybe becomes a no.
- Do not discount to get the yes. Saylor's own figure: forty per cent of buyers ask for a concession only because they had to ask, and half of sellers give one on the first request.

## 6. The twenty objections

Every one has the same shape: **restate what he said → welcome it → answer →
one small thing he can actually do.** None of them ends the sequence.

The single exception is "not interested", where the offer to take him off the
list is a real switch and not a form of words: it is permanent, and it stops
the email and the texts as well. Make that promise only by actually setting the
disposition.

### 1. We already use [another platform]

*You will hear it as:* already use, we have jobber, we use jobber, housecall, servicetitan, we're on

> So you have already got that solved, and it works. Good — that is the right order to solve it in, and I am not going to tell you your scheduler is broken. Two things it may not be doing. Whose name the homeowner sees: with us the quote, the invoice, the booking page and every email between them carry yours and none of them carry ours. And what happens before the quote goes out — every one gets read back to you, free, every time: what you have left off it, and whether the price is above or below what you have actually been winning at. Your own accepted and declined jobs, not other contractors' numbers — yours do not go anywhere either. Does the one you use now do that? Give me your logo and your colour and I will build one real quote with your name on it, review and all — put it next to the last one you sent and tell me what is wrong with it.

### 2. That sounds expensive / we can't afford another subscription

*You will hear it as:* expensive, too much, can't afford, cannot afford, cost, another subscription

> So what you are saying is you are not sure it pays for itself. That is the right question and I would rather you put it now than three months in. I am not going to discount it, because the number that decides this is not ours — it is what one quote you never got round to sending is worth to you, and what a quote priced under what you usually win at costs you when it is accepted too fast. The second one you cannot see without something reading your own history back to you, which is the part that is free and runs on every quote. You are the only one who knows your average job. Tell me roughly what that is and I will do the arithmetic with your figure instead of mine, in writing, so you can read it when you are not standing on somebody's drive.

### 3. I don't have time to learn new software

*You will hear it as:* no time, too busy, learn, set up, switch

> So it is the changeover you are weighing, not the thing itself. That is the honest reason most people stay where they are and it is the one I would want answered too. Nothing has to move at once — the next quote goes out of the new one and everything else stays exactly where it is until you decide otherwise. If you want the old records brought across, that is a paid job we do for you, not an import screen we hand you. Rather than argue about how long it takes: give me one job you have already done and I will set it up the way it would really run, and you tell me whether that was the effort you were picturing.

### 4. All my work is word of mouth, I don't need a website

*You will hear it as:* word of mouth, referral, don't need a website, do not need a website, busy enough

> So the work comes from people who already know you. That is the best kind there is and I am not going to argue it down. The narrow thing word of mouth cannot do is answer at nine at night: your customer gives your name to a neighbour, the neighbour looks you up on their phone, finds nothing, and rings the second name instead. You would never hear about that one, which is exactly why it is worth a look rather than a shrug. Send me three photos of a job you are proud of and I will show you what that neighbour would have found — then tell me what is wrong with it.

### 5. People need to talk to me before I can book anything

*You will hear it as:* need to talk, every job is different, can't just book, site visit

> So what you are saying is a job like yours cannot be priced without seeing it. Agreed — nobody is booking a kitchen off a form, and if I told you otherwise you would be right not to believe the rest of it. What gets booked is the visit, not the job: they pick from hours you have already said you will accept, it lands in your calendar with the address and their photos already attached, and the four texts to arrange it never happen. Tell me the hours you would genuinely accept and I will set it up inside those, and you look at it before anybody else can.

### 6. My email address is on the site, that works fine

*You will hear it as:* email works, they email me, my email is on there, inbox

> So the address on the site is doing the job. For the people who write to you it is — the question is what happens between them writing and you answering. It works right up until you are on a roof, and then it is an email you will answer tonight, and tonight you are doing invoices. A form asks the four things you always end up asking anyway, and what lands is a job in a list with the answers already on it rather than a note in an inbox. You keep the address either way — anyone who would rather just email you still can. Tell me the four things you always end up asking and I will build it round yours, not ours.

### 7. Just send me some information

*You will hear it as:* send me, email me something, send information, brochure

> So you want to see something in writing before you spend any more time on the phone. Fair — I would want the same, and I will send it. I would rather send the one that is about your problem than the one that is about all of them, so which is it more: the quotes going out, or the money coming back in? That is in your inbox today either way. The reason I would still like fifteen minutes on top is that a document read at eleven at night answers no questions back. Thursday morning, before you are out — and if Thursday is the wrong day, give me one that is not.

### 8. Not interested

*You will hear it as:* not interested, no thanks, we're fine, we are fine

> Understood, and I am not going to talk you round. One thing before you get on, and it is a question rather than a pitch: when a quote goes out, is that you at the kitchen table at nine at night? If it is not, then this really is not for you and I would rather say so than keep ringing. If it is, that is the whole of what I called about, and it is worth one more conversation rather than none. And if you would rather we did not ring at all, tell me now and I will put you on the do-not-call list today — that is a switch in here rather than a form of words: it is permanent, and it stops the email and the texts as well.

### 9. I'd have to ask my wife / my partner / the boss

*You will hear it as:* ask my wife, ask the wife, my partner, my husband, the boss, not my call, speak to my

> So it is not only your decision, and whoever else is in it has not heard any of this. That is normal at this size and it is the right way round. What I would not do is ask you to sell it for me — my description of it arriving second hand at teatime is the worst version either of you could get. Two ways round it: fifteen minutes with both of you on the phone, or give me your logo and the colour you use and I will build one real quote with your name on it and send it over, so what they are looking at is the thing itself. Tell me which of those is easier this week.

### 10. Ring me after the season / in the new year

*You will hear it as:* call me back, ring me next, after the summer, after christmas, new year, busy season, try me later, not right now

> So the timing is wrong rather than the thing itself. Fair — the middle of a season is a bad week to change anything and I am not going to pretend otherwise. Two things though. The part that would take an afternoon is an afternoon of mine, not yours. And the month you are describing is the month the quotes go out late, which is the thing I called about — so waiting for it to be quiet means testing it in the week it matters least. Tell me the month you would want it working by and I will work backwards from that. Give me a date and it goes in my diary for that day rather than me ringing you at random.

### 11. Where did you get my number?

*You will hear it as:* where did you get, how did you get my number, who gave you, how do you have my, who gave my

> So you want to know how I got hold of you before anything else. That is a fair thing to ask and you are owed a straight answer rather than a deflection. It came off your own public business listing — the one a homeowner would find searching for you — and that is recorded against your name here, so I can tell you which page it was on. Nobody sold it to us and nobody passed it on; there is no traded list of contractors behind this call. If that bothers you it is a reasonable thing to be bothered by and I would rather know. Give me the thirty seconds I asked for and you can decide on the reason I called rather than on how I found you.

### 12. It's just me — I'm too small for something like that

*You will hear it as:* just me, one man, one-man, only me, too small, on my own, sole trader, small outfit

> So it is you, and there is nobody to hand any of it to. That is the case this was built for rather than the exception to it — the whole of the office job lands on the person who is also on the tools, which is why the evenings go the way they do. It starts at one seat, and anybody who ever works with you in a van is carried at no charge rather than billed per head, so taking somebody on does not become a reason to leave. Give me one job you have already done and I will set it up the way it would really run for one person, and you tell me whether that is more work than what you do now or less.

### 13. I've got more work than I can handle already

*You will hear it as:* more work than, booked out, turning work away, don't need more work, do not need more work, plenty of work, flat out

> So the problem is not finding work. Good — then half of what I could say is irrelevant and I will leave it out rather than talk you into a problem you do not have. The part that still applies when you are flat out is the other end of it: the quotes that go out late because you were on a roof, and the ones priced from memory because there was no evening left to check them against what you have actually been winning at. Being busy is when both of those cost the most, not the least. Tell me roughly how many quotes are sitting waiting on you right now and I will tell you straight whether this is worth a conversation in the middle of a season.

### 14. We tried one of these before and it didn't stick

*You will hear it as:* tried one, we had one, didn't stick, did not stick, gave up on, wasted money, tried that before

> So you have paid for one of these before and it did not survive a real week. That is worth more than a fresh opinion and I would rather hear it than talk over it. What usually kills them is the setting up: somebody hands over an empty system and your own prices have to be typed into it before it can do anything at all, and that never happens in July. Tell me which one it was and where it fell over. If we do the same thing at the same point I will say so and you should not buy it; if we do not, I will show you the part that is different and you can judge it against the one that failed.

### 15. Pen and paper works fine / it's all in a spreadsheet

*You will hear it as:* pen and paper, paper, spreadsheet, excel, notebook, in my head, word document

> So the notebook works, and it has worked for years. Agreed, and I am not going to tell you it is broken, because for the job in front of you it is not. Two things it cannot do. It cannot hand a homeowner something with your name and your colours on it while you are still standing in their kitchen. And it cannot tell you that the price you have just written is under what you have been winning at, because that needs your own history read back to you. Give me one job out of the book — a real one, your own numbers — and I will put it next to what you would have sent, and you say which one you would rather a customer opened.

### 16. Let me think about it

*You will hear it as:* think about it, let me think, need to think, have a think, sleep on it, get back to you

> Understood, and a decision like this should not be made on a phone call anyway. The reason I would rather not leave it there is what thinking about it turns into: in three weeks the thing you are weighing up is my description of it rather than the thing itself. So let me take the deciding out of it. Give me your logo and the colour you use and I will build one real quote with your name on it, at no cost and with nothing attached to it, and you can think about that instead of about me. Tell me which day next week I should keep clear of, and I will ring you on a different one.

### 17. Just tell me what it costs

*You will hear it as:* what does it cost, how much is it, tell me the price, what's the price, what is the price, how much

> Fair, and I am not going to dodge it — a price you have to ring somebody for is its own answer. It is ninety-nine dollars a month for one person who prices work, and everybody else in a van is carried at no charge rather than billed per head. Every feature is in every plan, so there is no cheaper one that turns out not to do the thing you wanted. What I cannot tell you from here is whether it is worth ninety-nine dollars to you, because that turns on how many quotes a month go out of your hands. Tell me roughly what that number is and I will do that arithmetic with you rather than at you.

### 18. Am I tied into a contract?

*You will hear it as:* tied in, contract, locked in, how long am i, commitment, notice period

> So the worry is being stuck with it rather than the thing itself. That is the right worry, and a year signed up front is how most of this is sold, which is why people end up paying for software they stopped opening. There is no year to sign here: you pay month to month and you leave at the end of one. Said against my own interest, since you will find it out anyway — that also means there is nothing holding you in if it turns out to be no good, so it is on us to be worth the next month every month. Give me one month with it and if it has not paid for itself, stop it.

### 19. Who owns my customer list? Is my data safe?

*You will hear it as:* my data, who owns, is it safe, customer list, security, privacy, gdpr

> So the thing you want settled first is where your customer list ends up. That is the right question to ask first and most people ask it last. Your clients, your prices and your quotes are yours: they are not pooled, they are not shown to another contractor, and nothing you put in is used to price somebody else's job. The one place your own history gets read is the review that runs on your own quotes, and it reads only yours. If you want it all back, or gone, that is a written request we act on rather than a button that quietly does half of it. Tell me what you would need to see in writing and I will send exactly that.

### 20. My bookkeeper uses QuickBooks / Sage / Xero

*You will hear it as:* quickbooks, my accountant, bookkeeper, sage, xero, does the books

> So the person who does your books has a system already, and you are not about to move them off it. Agreed, and you should not — that is their tool, not yours. Here is the limit before you find it yourself: there is no live link that pushes invoices into it as they go out. What there is is an export of the invoices and the job costs in a shape a bookkeeper can take, so month end stops being you reading numbers down a phone. Send me one month you have already closed and I will show you exactly what they would receive, and they can tell you whether that is useful or not.

## 7. Battlecards — the five they will name

Read the honest half out loud. A rep who oversells gets caught on the call, and
a contractor who buys on something we do not have asks for a refund.

Three rules for this section:

- **Never claim what their software does or does not do.** You may quote their
  own published page, and you may state their published prices. You may not say
  their product is bad. You have not used it.
- **Never invent a saving.** Where a competitor publishes no price a headcount
  can be priced against — ServiceTitan — there is no arithmetic and you do not
  do any.
- **Third-hand is said as third-hand.** ServiceTitan's numbers come from a
  video summary and a forum thread. Say "what contractors report", never "what
  they charge".

### Housecall Pro

**Say this when they name them**

> Start with what Housecall Pro has that we do not: native mobile app (iOS / Android). Their own page says: "Free mobile app for iOS and Android". If that is what decides it for you, they are the better buy and I would rather say so now.
> The narrow thing worth knowing: repeat jobs is on their Max plan at $329 a month. It is on every plan of ours, and ours starts at $99.
> For 6 of you — say 2 pricing work and 4 in vans — their Max is $329 and our Crew is $169. Tell me your real numbers and I will do it again with yours.
> Give me your logo and the colour you use and I will build one real quote with your name on it — put it next to the last one you sent out of Housecall Pro and tell me what is wrong with it.

**What they genuinely do well**

- Native mobile app (iOS / Android) — their page: “Free mobile app for iOS and Android”
- Works offline — their page: “Offline viewing”
- Book a guided demo with a salesperson — their page: “Get a free demo and tailored pricing information for your business”

**Where we win**

- Their top tier's call to action is Book Demo, not a trial
- Repeat jobs: their Max at $329/mo; every plan of ours, from $99.
- 42 things we ship are not listed on any tier of their pricing page — including Lead tracking, Lead form for your website, AI quote review, Suggested add-ons, Automatic follow-ups, Confirmation calls.

**The price**

- They count: Each included user, plus a stated price per additional user.
- Basic: USD 59 /month, 1 included (read 2026-08-28)
- Basic: USD 79 /month, 1 included (read 2026-08-28)
- Essentials: USD 149 /month, 5 included (read 2026-08-28)
- Max: USD 299 /month, 8 included (read 2026-08-28)
- Six of you (2 pricing work, 4 in vans): their Max $329 against our Crew $169.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-housecall-pro

### ServiceTitan

**Say this when they name them**

> Before anything else, what we do not have: native mobile app (iOS / Android). That is true whoever you compare us with, and if it decides it for you then it decides it.
> The thing to know about the price: ServiceTitan is reported to price per technician, not per company. That is what contractors report rather than anything they publish, so take it as that — but it is the term that decides the bill.
> Give me your logo and the colour you use and I will build one real quote with your name on it — put it next to the last one you sent out of ServiceTitan and tell me what is wrong with it.

**What they genuinely do well**

- Nothing about them has been read off their own page and verified. That is a gap in our research, not in their product — do not read it out as one.

**Where we win**

- ServiceTitan publishes no price; every tier says Request Pricing
- 56 things we ship are not listed on any tier of their pricing page — including Lead form for your website, Quotes, Send a quote by email, Quote PDF in your colours, Client approves and signs online, AI quote review.

**The price**

- They count: Every field technician on the payroll.
- Starter: null null /null (read 2026-08-28)
- Essentials: null null /null (read 2026-08-28)
- The Works: null null /null (read 2026-08-28)
- Third-hand: Contractors report paying $245–$300 per technician per month, plus an implementation fee of $5,000–$15,000 one-time. Reported in a video summary and a forum thread, not published by ServiceTitan. Neither source states a currency.
- Third-hand: Contractors report paying $300–$400 per technician per month, plus an implementation fee of $10,000–$30,000 one-time. Reported in a video summary and a forum thread, not published by ServiceTitan. Neither source states a currency.
- Third-hand: Contractors report paying $400–$500 per technician per month, plus an implementation fee of $15,000–$50,000 one-time. Reported in a video summary and a forum thread, not published by ServiceTitan. Neither source states a currency.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-servicetitan

### Projul

**Say this when they name them**

> Start with what Projul has that we do not: book a guided demo with a salesperson. Their own page says: "Every Projul tier offers a scheduled demo". If that is what decides it for you, they are the better buy and I would rather say so now.
> The narrow thing worth knowing: suggested add-ons is on their Pro plan at $1199 a month. It is on every plan of ours, and ours starts at $99.
> For 6 of you — say 2 pricing work and 4 in vans — their Core is $399 and our Crew is $169. Tell me your real numbers and I will do it again with yours.
> Give me your logo and the colour you use and I will build one real quote with your name on it — put it next to the last one you sent out of Projul and tell me what is wrong with it.

**What they genuinely do well**

- Book a guided demo with a salesperson — their page: “Every Projul tier offers a scheduled demo”
- Native mobile app (iOS / Android) — their page: “Projul lists a full-featured mobile app on its entry tier, with mobile notifications”
- Gantt charts and linked project timelines — their page: “Projul's Core+ tier adds Gantt charts and linear project timelines”
- Two-way sync with QuickBooks or Xero — their page: “Projul syncs with QuickBooks Online at Core+ and QuickBooks Desktop at Pro”
- Purchase orders to suppliers — their page: “Projul's Pro tier adds purchase orders”
- Daily site logs — their page: “Projul's Pro tier adds daily site logs and photo reports”
- Geolocation and geofenced clock-in — their page: “Projul's Pro tier adds geolocation and geofencing”

**Where we win**

- Projul is annual only — all three tiers are priced Annually
- Suggested add-ons: their Pro at $1199/mo; every plan of ours, from $99.
- 38 things we ship are not listed on any tier of their pricing page — including AI quote review, AI receptionist, Confirmation calls, Quote drafted from the call, Online booking page, Take a deposit to hold the slot.

**The price**

- They count: Nobody — headcount does not enter the price.
- Core: USD 4788 /year (read 2026-08-28)
- Core+: USD 7188 /year (read 2026-08-28)
- Pro: USD 14388 /year (read 2026-08-28)
- Six of you (2 pricing work, 4 in vans): their Core $399 against our Crew $169.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-projul

### Jobber

**Say this when they name them**

> Before anything else, what we do not have: native mobile app (iOS / Android). That is true whoever you compare us with, and if it decides it for you then it decides it.
> The narrow thing worth knowing: lead tracking is on their Plus plan at $499 a month. It is on every plan of ours, and ours starts at $99.
> For 6 of you — say 2 pricing work and 4 in vans — their Plus is $499 and our Crew is $169. Tell me your real numbers and I will do it again with yours.
> Give me your logo and the colour you use and I will build one real quote with your name on it — put it next to the last one you sent out of Jobber and tell me what is wrong with it.

**What they genuinely do well**

- Nothing about them has been read off their own page and verified. That is a gap in our research, not in their product — do not read it out as one.
- (1 further claim(s) recorded and held back: Recorded, but nobody has read it off their own page — so it is not something to say on a call.)

**Where we win**

- Jobber's AI receptionist is a $29/mo add-on at one user, and otherwise sits in the $599/mo Plus tier
- Lead tracking: their Plus at $499/mo; every plan of ours, from $99.
- 40 things we ship are not listed on any tier of their pricing page — including Lead form for your website, Client approves and signs online, AI quote review, Confirmation calls, Quote drafted from the call, Take a deposit to hold the slot.

**The price**

- They count: Everyone in the business, selected as a bracket rather than a count.
- Plus: null null /null (read 2026-08-28)
- Grow: USD 399 /month, 10 included (read 2026-08-28)
- Plus: USD 599 /month, 10 included (read 2026-08-28)
- Six of you (2 pricing work, 4 in vans): their Plus $499 against our Crew $169.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-jobber

### QuoteIQ

**Say this when they name them**

> Start with what QuoteIQ has that we do not: A paid plan below FieldQuo's cheapest rung. Their own page says: "QuoteIQ starts at $29.99 a month for one user; FieldQuo's cheapest rung is $99". If that is what decides it for you, they are the better buy and I would rather say so now.
> The narrow thing worth knowing: your own website is on their Max plan at $699 a month. It is on every plan of ours, and ours starts at $99.
> For 6 of you — say 2 pricing work and 4 in vans — their Elite is $299 and our Crew is $169. Tell me your real numbers and I will do it again with yours.
> Give me your logo and the colour you use and I will build one real quote with your name on it — put it next to the last one you sent out of QuoteIQ and tell me what is wrong with it.

**What they genuinely do well**

- A paid plan below FieldQuo's cheapest rung — their page: “QuoteIQ starts at $29.99 a month for one user; FieldQuo's cheapest rung is $99”
- Native mobile app (iOS / Android) — their page: “QuoteIQ ships iOS and Android apps and tells you to download one during signup”
- Two-way sync with QuickBooks or Xero — their page: “QuoteIQ includes a QuickBooks integration from its Pro tier”
- Book a guided demo with a salesperson — their page: “QuoteIQ offers a scheduled demo and a phone number”

**Where we win**

- Every QuoteIQ user is a paid user; FieldQuo bills only the people who originate money and includes field crew free
- Your own website: their Max at $699/mo; every plan of ours, from $99.
- 41 things we ship are not listed on any tier of their pricing page — including Lead tracking, AI quote review, Suggested add-ons, Confirmation calls, Quote drafted from the call, Take a deposit to hold the slot.

**The price**

- They count: Anybody with a login, whatever they do with it.
- Essentials: USD 29.99 /month, 1 included (read 2026-08-29)
- Essentials: USD 25 /month, 1 included (read 2026-08-29)
- Beginner: USD 74.99 /month, 2 included (read 2026-08-29)
- Beginner: USD 62.5 /month, 2 included (read 2026-08-29)
- Pro: USD 149.99 /month, 4 included (read 2026-08-29)
- Pro: USD 125 /month, 4 included (read 2026-08-29)
- Elite: USD 299 /month, 10 included (read 2026-08-29)
- Elite: USD 249 /month, 10 included (read 2026-08-29)
- Max: USD 699 /month (read 2026-08-29)
- Max: USD 582.5 /month (read 2026-08-29)
- Six of you (2 pricing work, 4 in vans): their Elite $299 against our Crew $169.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-quoteiq

---

## Appendix — where each rule comes from

The reasoning behind every line in this document, with the study under it, is
in `docs/sales/SCRIPT-PRINCIPLES.md`. The short version:

- **Saylor / Richmond, *The Power of Selling*** — fifteen seconds to win them;
  name, company and purpose inside twenty; permission phrased for a yes; the
  survey approach; never knock the competition; 81% of sales on or after the
  fifth call.
- **Futrell, *Fundamentals of Selling*** — questions beat statements; never a
  question a single word can end; never apologise for their time; forestall the
  objection your own answer creates; leave the door open; after you ask, stop
  talking.
- **Rackham (SPIN)** — benefits tied to a need the buyer has already stated
  meet materially fewer objections than generic advantages. Which is why
  nothing is pitched before discovery.
- **Cialdini, *Influence*** — the admission against your own interest is the
  one move available to a stranger in ninety seconds; a loss persuades more
  than the same fact stated as a gain; fabricated scarcity and counterfeit
  social proof are the two things his own epilogue says warrant boycott.
- **Barron, *Selling Made Simple*** — the only goal of outreach is the next
  conversation.
- **Cognism's cold-calling scripts** — the permission-based opener, the
  gatekeeper's brevity, and the 70/30 talk ratio. Their "I'm just following up
  on an email" line is deliberately *not* taken: it works and it is a lie.
- **Close's guide to training an AI sales agent** — define the escalation
  boundary explicitly, and review the reasoning rather than only the output.
  Both are built into how the software generates a talking point: it is handed
  a closed list of things observed about that business, it may cite nothing
  else, and when the list does not answer what the contractor described it is
  instructed to say nothing rather than reach for the nearest adjacent thing.
  Their advice to feed the agent historical customer data is refused — no
  contractor's data is ever shown to another.
- **The owner's own twenty TrueFinish conversations** — how these buyers
  actually behave, with the outcomes known.

*Generated from the modules named at the top. `npm run check:playbook-copy` and
`npm run check:sales-playbook-battlecards` assert that the opener, the
permission ask, the pivot and every objection label in this file are still the
ones the software uses.*
