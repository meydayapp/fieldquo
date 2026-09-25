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

**What the call data says about this opener.** Gong measured four openers
across 300 million calls: "did I catch you at a bad time?" books 2.15% of
the time, "how's it going?" 7.6%, a permission-based opener 11.18%. The one
above *is* the permission-based opener — own that it is a cold call, then ask
for thirty seconds. Their older set has "how've you been?" at 6.6 times the
baseline; it is not scripted here because the permission opener measured
higher in the larger set and because it claims an acquaintance you do not
have. Stating the reason for the call is 2.1 times more successful, and
the pivot states it inside the first minute on his own words. The full
reading, with what was refused, is in `docs/sales/RESEARCH-cold-calling-2026.md`.

**The AI script's opener** on a claimed prospect goes one step further,
because it has a detail from the contractor's own site that the rules script
does not: it says it is a cold call, then "the reason I'm calling is…" on
that detail, then asks for thirty seconds and hands the decision back. The
example every generated script is held to:

> Hi — is that South County Electric, LLC? My name's Daniel and I'm from FieldQuo — quick heads-up, this call may be recorded. I'll be straight with you, this is a cold call, but I've read your website. The reason I'm calling is your site promises a same-day quote, and I wanted to ask how it gets to the customer. Can I take thirty seconds on why, and then you tell me if it's worth talking?

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
| "An all-in-one platform", "seamlessly", "streamline" | A pitch built on buzzwords books at 5.5% in Gong's data; the same pitch in the contractor's own words at 16%. |
| "I'll be really quick, I promise" | Cognism recommends it for the busy prospect. It is the time promise above with a promise on top. |
| "This isn't a sales call" | It is. A rep who opens with a lie has nothing left to be believed about. |

## 3. Discovery — a survey, not an interrogation

A contractor will not answer a generic open question from a stranger, because
every answer discloses something. But **he will correct you when you are wrong
about his business.** So every question below states a guess with two options
in it, and the cheapest possible reply is a correction.

Ask permission before asking. Say out loud that you are not asking about money.
Then do not interrogate: every question has its answers in it, so a one-word
correction is a full reply, and the open "how do you…" questions wait for the
fifteen minutes. The twelve-question block pasted at five prospects correlates
with silence; the two conversations that became the biggest wins were dialogue.

**On the talk ratio.** The seventy-thirty rule — the prospect talks
seventy per cent — is for the demo, not the cold call. On a cold call the
rep carries the conversation: Gong's successful cold calls have the rep
talking about fifty-five per cent of the time, in bursts of up to about
thirty-five seconds, and the number of questions asked makes no measurable
difference to whether the meeting gets booked. So once he has said yes to the
thirty seconds, say the *What we do* stage in one go — do not stop after one
sentence to check he is still there. Under twenty-five seconds of talking
halves the odds.

And when you get to the pain, **ask him for the number.** Never bring one of
your own. "In a normal month, how many quotes go out later than you meant them
to?" is worth more later than any figure you could have supplied.

**The turnaround question is in every script, and it is the one to get an
answer to.** "When someone reaches out today, how long is it usually before they've actually got a quote in their hands — same day, a couple of days, a week?" Then the
implication, still as his number: "And in that time, how often do you reckon they've already had one from somebody else?"
Whatever he says — an hour, a couple of days, a week — that is the number the
*What we do* stage answers, in his own words, with the one product claim the
owner wants stated against it: the quote built while you are still standing in
the driveway, under two minutes from your own price list, approved from the
homeowner's phone. On the call screen the three sentences sit beside the
script in its language — English, French or Spanish — whatever the AI wrote.

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

> Hi — is that {businessName}? {repName} here, from FieldQuo — quick heads-up, this call may be recorded. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. Quick question before I do — when you go out and look at a job, are you usually able to give them a price while you're standing there, or does it get put together back at the house afterwards?

**Why them** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. You're already running {competitor} — so I'm not calling to tell you your scheduling is broken. You solved that, and I'm not going to pretend I know your business better than you do from the outside. The narrow thing I called about is whose name and whose colours a homeowner sees on the quote, the invoice and the emails in between. And the unhelpful half first: if that has never once bothered you, I'm the wrong call, and I'd rather hear that now than fifteen minutes in.

**Ask** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about how the work comes in? Nothing about what you charge — I'm trying to work out whether there's anything here for you or not.

> - How many of you are on the tools at the moment — you and a crew, or you and a couple of subs?
> - Is most of it repeat and referral now, or are you still bidding against two others on a lot of jobs?
> - When someone reaches out today, how long is it usually before they've actually got a quote in their hands — same day, a couple of days, a week?

**How it works today** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> Everything I could see from outside is a guess. You're the only one who knows how it actually runs, so correct me where I've got it wrong.

> - A homeowner calls on a Tuesday — who writes that quote, and when? Evenings?
> - Does {competitor} carry it all the way through to the invoice, or is part of it still in a notebook?
> - When the quote lands in their inbox, whose name is on the email it came from?

**What it costs them** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - Which part of that is the one that annoys you?
> - In a normal month, how many quotes go out later than you meant them to?
> - And in that time, how often do you reckon they've already had one from somebody else?

**What we do** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Then three things, and they answer what you just said. First, the time you just gave me. Whatever that number is for you today — an hour, a couple of days, weeks — with FieldQuo the quote is built while you're still standing in the driveway, under two minutes from your own price list, and they approve it from their phone. Second, whose name is on it: the quote, the invoice, the booking page and every email between them carry yours, and none of them carry ours. Third, what happens before it goes: every quote gets read back to you, free — what you have left off, and whether the price sits above or below what you have actually been winning at. Your own jobs, nobody else's. Does the one you use now tell you that before you send it? And before you have to raise it: nothing comes off {competitor} to look at this — nothing switched off, nothing imported, nobody learning anything this week.

**If they push back** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> So here's what I'd like. Give me fifteen minutes and I can show you in fifteen minutes how it works for a business like yours: a quote with your name on it next to the one you send now, and what the review says before it goes out. Nothing to set up on your side. You just watch.

**Wrap up** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.* The calendar question is Gong's: it is the one question their data names as securing the next step, and the invite goes while he is still on the line because an invitation already accepted is harder to decline than one unanswered. The next-step form on the call screen books it and sends it.

> What works better for you, mornings or afternoons? Have you got your calendar handy? I'll send the invite while we're on the phone, and a reminder the night before. And if the day falls apart — it's a job site, it happens — tell me and we'll move it rather than drop it. If I don't hear anything I'll try you again in a couple of weeks.

### Online presence — no website  `ONLINE_PRESENCE`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo — quick heads-up, this call may be recorded. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. One question before I do — when somebody who's never met you goes looking to see whether you're any good, is there somewhere you'd send them, or is it whatever comes up when they search your name?

**Why them** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. There's no website I could find. Your number's out there, so anyone who already has your name gets to you fine — it's the ones who don't have your name I called about. They search, they find two others with photographs of finished work, and you were never in that comparison at all. Now the part that costs me: what we'd build isn't a site somebody designed for you. It's put together out of jobs you've already done, it lives at an address on fieldquo.com, and while it's free it carries a small "Site by FieldQuo" line at the bottom. If that's beneath how you want to look, tell me — that's a real reason not to do this.

**Ask** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about where the work comes from? Nothing about money — I want to know whether this is even for you.

> - Where does most of it come from now — word of mouth, a board, or the ads?
> - How many of you are there?
> - When someone reaches out today, how long is it usually before they've actually got a quote in their hands — same day, a couple of days, a week?

**How it works today** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> You're the authority on this and I'm guessing from outside. Tell me where I'm wrong.

> - When somebody wants a price, what do they actually do — call the mobile?
> - How do they get that number in the first place, if nobody's given it to them?
> - Has anyone ever said they nearly went elsewhere because they couldn't find anything about you?

**What it costs them** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - How many of those calls come in while you're up a ladder?
> - In a week, how many go to voicemail and never call back?
> - And in that time, how often do you reckon they've already had one from somebody else?
> - Do people ask you for photos of previous work before they'll commit?

**What we do** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Then the photos you've just described are the site. We build it out of the jobs you've already done: your name at the top, your colour, the work, and a way for somebody to ask you for a price at nine at night while you're asleep. You don't write anything. And the objection you're about to have — that it's a project — it isn't. It's built out of what you've already done, and I can show you one in fifteen minutes. And the time you gave me a minute ago: Whatever that number is for you today — an hour, a couple of days, weeks — with FieldQuo the quote is built while you're still standing in the driveway, under two minutes from your own price list, and they approve it from their phone.

**If they push back** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> Here's what I'd like. Give me fifteen minutes and I can show you in fifteen minutes how it works for a business like yours: a site built out of jobs you've already done, with your name on it, and what a homeowner sees at nine at night. Send me three photos of a job you're proud of, to the number I'm calling from, and we'll use those.

**Wrap up** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> What works better for you, mornings or afternoons? Have you got your calendar handy? I'll send the invite while we're on the phone, and a reminder the night before. Three photos to this number whenever you get a minute. If the photos don't happen before then, that's fine — I'll call anyway and we'll use what's on your phone.

### Booking gap — a website with no way to book  `BOOKING_GAP`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo — quick heads-up, this call may be recorded. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. One question first — when somebody's on your site at nine at night and wants you, can they put themselves in your diary there and then, or does it hang on them remembering to ring in the morning?

**Why them** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. The site does its job — that's not what I called about. What it hasn't got is any way for somebody to put themselves into your diary: every page ends with give us a call. And the honest limit on it, before you spend anything: a booking page will not bring you one extra enquiry. It doesn't get you found. If the problem is that the phone isn't ringing enough, this is the wrong conversation and I'd rather say so now.

**Ask** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about the enquiries you do get? Nothing about your rates.

> - Roughly how many does the site bring you in a week?
> - When someone reaches out today, how long is it usually before they've actually got a quote in their hands — same day, a couple of days, a week?
> - Are you booking a visit to measure, or quoting off photos people send?

**How it works today** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> Tell me where my guess is wrong here.

> - Somebody's on the site at nine at night and they want you — what do they do next?
> - How many messages back and forth before a time is actually agreed?
> - Does that time go into a calendar, or is it in your head until the morning?

**What it costs them** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - Out of the ones who message you, how many go quiet before a time's agreed?
> - And in that time, how often do you reckon they've already had one from somebody else?
> - Have you ever turned up and they'd forgotten, or had somebody else in?

**What we do** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Nobody books a kitchen off a form and I'm not going to suggest they should. What gets booked is you turning up to measure — a slot you've allowed, the address, the photos already attached, and none of that back-and-forth to arrange it. And the bit you'd raise: you keep the site you've got. It gains a button. It doesn't get rebuilt. And once you're there, the time you gave me: Whatever that number is for you today — an hour, a couple of days, weeks — with FieldQuo the quote is built while you're still standing in the driveway, under two minutes from your own price list, and they approve it from their phone.

**If they push back** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> Give me fifteen minutes and I can show you in fifteen minutes how it works for a business like yours: somebody on your site at nine at night, picking a time you've already said you'll accept, and where that lands for you in the morning. Nothing gets rebuilt. You keep the site you've got.

**Wrap up** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> What works better for you, mornings or afternoons? Have you got your calendar handy? I'll send the invite while we're on the phone, and a reminder the night before. If the day goes wrong, message me and we'll find another one — and if I don't hear back I'll try you again after month end.

### Quote automation — enquiries arrive as email  `QUOTE_AUTOMATION`

**Open** — *Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.*

> Hi — is that {businessName}? {repName} here, from FieldQuo — quick heads-up, this call may be recorded. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

> - Thanks. One question before I do — when an enquiry comes in, does it usually arrive with enough on it to price, or are you writing back to ask the same few things before you can even start?

**Why them** — *One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.*

> If that's how it goes, that's exactly why I'm calling. And if I've got it wrong — if it works the other way round for you — say so now, because then most of what I was going to say doesn't apply. There's an email address on the site and nothing else — no form, no questions. So every enquiry arrives as somebody's free text, and you're the one writing back to ask the same four things before you can price any of it. What I should say straight away: a form doesn't fix all of that. Some people won't fill one in, and those will still land in your inbox exactly as they do now. What changes is the ones who do.

**Ask** — *Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.*

> Can I ask you three things about that inbox? Nothing about your prices.

> - Roughly how many enquiries a week land in it?
> - What do you always end up having to ask them?
> - When someone reaches out today, how long is it usually before they've actually got a quote in their hands — same day, a couple of days, a week?

**How it works today** — *How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.*

> Correct me where I've got this wrong.

> - An email arrives on a Tuesday morning while you're on site — then what?
> - How long is it usually before you get to reply?
> - How do you know which ones you've already answered?

**What it costs them** — *Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.*

> - How many go cold while they're waiting on you?
> - And in that time, how often do you reckon they've already had one from somebody else?
> - Have you ever priced the same job twice because the first one got lost?

**What we do** — *What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.*

> Then it's the four things you just named. They get asked before the enquiry reaches you, and what arrives isn't a note in an inbox — it's a job in a list, with the answers and the photos on it, one press from a quote you can send from the van. And before you ask: you keep the address that's on the site. Anyone who'd rather just email you still can. And the time you gave me: Whatever that number is for you today — an hour, a couple of days, weeks — with FieldQuo the quote is built while you're still standing in the driveway, under two minutes from your own price list, and they approve it from their phone.

**If they push back** — *What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.*

> *(rendered from the objection library — never written into a script)*

**Next step** — *One specific thing with a date on it. 'I'll send you some information' is not a next step.*

> Tell me the four things you always end up asking, and give me fifteen minutes. I can show you in fifteen minutes how it works for a business like yours: those four questions asked before the enquiry reaches you, and what lands in your list with the answers already on it. Your questions, not ours.

**Wrap up** — *Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.*

> What works better for you, mornings or afternoons? Have you got your calendar handy? I'll send the invite while we're on the phone, and a reminder the night before. Send me the four questions whenever they come to you, a text is fine. If they don't arrive I'll bring my guess at them and you can cross them out — and if the day moves, I'll find you the week after.

## 5. Either side of the call

### Whoever answers the phone

*Somebody who is not the person you called for has picked up.*

Who answers the phone at a plumbing company is not a receptionist. It is the
apprentice with the phone on speaker in the van, or the office — which is
usually the spouse or a bookkeeper — or the owner's partner at home. Two of
those three may be the person who types the quotes up in the evening, which
makes them the user this product is for and not a gatekeeper at all. The
lines sort the three before you ask to be handed on.

**Opening**

> Morning — it's {repName} from FieldQuo. Who's the best person to talk to about how the quotes go out — is that the owner, or is that you?

**If they ask what it is regarding**

> It's about how a quote gets from the driveway to the customer. I've not spoken to him before — I read your website this morning and rang off the back of it. Is he the one who prices the work, or is that somebody else?

**The apprentice, or somebody in the van**

> No problem. When's he easiest to catch — first thing before you're on site, or the end of the day? And what's his name, so I'm not asking for the boss next time?

**The office, or the spouse who does the paperwork**

> Then you might be the one I should be talking to. When a quote goes out, is it you typing it up, or does it land on him in the evening?

**If he is not there**

> When's he easiest to catch — first thing, or the end of the day? I'll ring then rather than keep landing on you.

**If they offer to take a message**

> Do both if you can: put my name down, and tell me when he's about. I'd rather catch him than have him ring a number he doesn't know.

- Whoever picks up at a business this size is often the person who types the quotes up — the spouse, the office, the bookkeeper. That is not a gatekeeper, that is the user. The fourth line finds out before you ask to be handed on.
- Never say he is expecting your call, or that you are following up an email. There is no email, and the person who finds out is the person you needed.
- The apprentice cannot buy anything and does not want to hear why it is good. Give them a name, a subject and a time, and get off — and get HIS name, so the next call asks for him and not for the boss.
- A gatekeeper cuts the odds of a meeting by about two-fifths in Gong's data. Where the listing carries a mobile, dial that. Where it does not, the first and last slots the calling window allows are when an owner-operator answers his own phone.
- The second line is doing real work: it finds out whether the person you have been asking for is even the right one. Write down what they say.

### The beep

*It rang out, or they sent you to voicemail.*

**The message, about twenty seconds**

> {repName} at FieldQuo, for {businessName}. I read your website this morning and there's one thing on it I wanted to put to whoever writes your quotes — it's a question rather than a sales call. I'm on {repPhone}. That's {repPhone}. I'll try you again in a couple of days either way.

- Say the number twice and slow the second one down. Somebody writing it down misses the first three digits of the first.
- Leave one on the first attempt, not the fourth. Four unexplained missed calls from a number nobody knows is how you get blocked.
- One or two, then stop leaving them. In Gong's data a voicemail cuts the next dial's connect rate by about a quarter and roughly doubles the reply rate on the email — so after the second, the email carries the sequence and the dials stay silent.
- After the fifth dial the odds of connecting fall away. The sixth dial is the next name on the list, not this one again.
- The last sentence is the one that matters: the next contact happens either way, so there is nothing for them to decide right now.

### The text, same day

*You spoke and agreed something, or you left a voicemail and want the number in their phone.*

**After a call that agreed a time**

> {repName} from FieldQuo. Good to talk - the invite for our fifteen minutes is in your inbox. Reply here if it needs moving.

**After a voicemail**

> {repName} from FieldQuo. Left you a message about your quotes - no need to ring back, I'll try you again in a couple of days.

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
> The time we agreed still suits me. If it stops suiting you, tell me and we'll move it rather than drop it.
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

> Good. I'm texting you the link now — open it while we're on, it's two minutes. Company details, pick the plan, card: you're not charged for a month and you can cancel from Settings in one click. Then your rates go in however they exist — a spreadsheet, a photo of a page — and send one real quote out of it and ring me if it feels wrong.

- Stay on the line through the card step. The signup dies at the card when nobody is on the phone; your screen shows where they are, so you never have to ask.
- After you ask, stop talking. Futrell is emphatic about this: anything said after the question takes the pressure off the decision, and the pressure is the only thing making it happen now.
- Waiting is a real answer and gets a real date. A rep who treats it as a loss argues, and arguing at the close is how a maybe becomes a no.
- Do not discount to get the yes. Saylor's own figure: forty per cent of buyers ask for a concession only because they had to ask, and half of sellers give one on the first request.

## 6. The twenty-four objections

Every one has the same shape: **restate what he said → welcome it → answer →
one small thing he can actually do.** None of them ends the sequence. The
data says plan for two of them before the meeting: the median booked cold
call in Gong's set is under five minutes and gets through at least two
objections, and the top five — not interested, a hang-up, no budget, not
made for us, not my responsibility — are three-quarters of everything you
will hear. The last four below are the ones that end a call before the pitch
has happened, and they are the ones a rep needs word-perfect.

The single exception is "not interested", where the offer to take him off the
list is a real switch and not a form of words: it is permanent, and it stops
the email and the texts as well. Make that promise only by actually setting the
disposition.

### 1. We already use [another platform]

*You will hear it as:* already use, we have jobber, we use jobber, housecall, servicetitan, we're on

> So you've already got that solved, and it works. Good — that's the right order to solve it in, and I'm not here to tell you your scheduler's broken. Two things it may not be doing, and you tell me. First, whose name the homeowner sees. With us the quote, the invoice, the booking page and every email between them carry your name, and none of them carry ours. Second, what happens before a quote goes out. Every one gets read back to you, free, every time: what you've left off it, and whether the price sits above or below what you've actually been winning at. That's your own accepted and declined jobs, not other contractors' numbers, and yours don't go anywhere either. Does the one you use now do that? Give me fifteen minutes and I'll show you how it works for a business like yours. That's a quote with your name on it, review and all, next to the last one you sent. Then tell me what's wrong with it.

### 2. That sounds expensive / we can't afford another subscription

*You will hear it as:* expensive, too much, can't afford, cannot afford, cost, another subscription

> So you're not sure it pays for itself. That's the right question, and I'd sooner you put it now than three months in. I'm not going to discount it, because the number that decides this isn't ours. It's what one quote you never got round to sending is worth to you. And it's what a quote priced under your usual win rate costs you when it's accepted too fast. You can't see the second one without something reading your own history back to you, and that part is free and runs on every quote. You're the only one who knows your average job. Tell me roughly what that is and I'll do the arithmetic with your figure, not mine, in writing. Then you can read it when you're not standing on somebody's drive.

### 3. I don't have time to learn new software

*You will hear it as:* no time, too busy, learn, set up, switch

> So it's the changeover you're weighing, not the thing itself. That's the honest reason most people stay where they are, and I'd want it answered too. Nothing has to move at once. The next quote goes out of the new one, and everything else stays exactly where it is until you decide otherwise. If you want the old records brought across, that's a paid job we do for you, not an import screen we hand you. Let's not argue about how long it takes. Give me fifteen minutes and one job you've already done, and I'll show you how it would really run for you. Then you tell me whether that was the effort you were picturing.

### 4. All my work is word of mouth, I don't need a website

*You will hear it as:* word of mouth, referral, don't need a website, do not need a website, busy enough

> So the work comes from people who already know you. That's the best kind there is, and I'm not going to argue it down. The one thing word of mouth can't do is answer at nine at night. Your customer gives your name to a neighbour. The neighbour looks you up on their phone, finds nothing, and rings the second name instead. You'd never hear about that one, and that's exactly why it's worth a look. Give me fifteen minutes and three photos of a job you're proud of, and I'll show you what that neighbour would have found. Then tell me what's wrong with it.

### 5. People need to talk to me before I can book anything

*You will hear it as:* need to talk, every job is different, can't just book, site visit

> So a job like yours can't be priced without seeing it. Agreed — nobody's booking a kitchen off a form, and if I told you otherwise you'd be right not to believe the rest. What gets booked is the visit, not the job. They pick from hours you've already said you'll accept. It lands in your calendar with the address and their photos already on it, and the four texts to arrange it never happen. Tell me the hours you'd genuinely accept, and give me fifteen minutes. I'll show you how it works inside those hours, and you look at it before anybody else can.

### 6. My email address is on the site, that works fine

*You will hear it as:* email works, they email me, my email is on there, inbox

> So the address on the site is doing the job. For the people who write to you, it is. The question is what happens between them writing and you answering. It works right up until you're on a roof. Then it's an email you'll answer tonight, and tonight you're doing invoices. A form asks the four things you always end up asking anyway. What lands is a job in a list with the answers already on it, not a note in an inbox. You keep the address either way, and anyone who'd sooner just email you still can. Tell me the four things you always end up asking, and give me fifteen minutes. I'll show you how it works with your questions, not ours.

### 7. Just send me some information

*You will hear it as:* send me, email me something, send information, brochure

> So you want to see something in writing before you spend any more time on the phone. Fair — I'd want the same, and I'll send it. I'd sooner send the one about your problem than the one about all of them. So tell me which it is more: the quotes going out, or the money coming back in? That's in your inbox today either way. The reason I'd still like fifteen minutes on top is that a document read at eleven at night answers no questions back. What works better for you, mornings or afternoons?

### 8. Not interested

*You will hear it as:* not interested, no thanks, we're fine, we are fine

> Understood, and I'm not going to talk you round. One thing before you get on, and it's a question, not a pitch. When a quote goes out, is that you at the kitchen table at nine at night? If it isn't, then this really isn't for you, and I'd sooner say so than keep ringing. If it is, that's the whole of what I called about, and it's worth one more conversation. And if you'd sooner we didn't ring at all, tell me now and I'll put you on the do-not-call list today. That's a switch in here, not a form of words: it's permanent, and it stops the email and the texts as well.

### 9. I'd have to ask my wife / my partner / the boss

*You will hear it as:* ask my wife, ask the wife, my partner, my husband, the boss, not my call, speak to my

> So it's not only your decision, and whoever else is in it hasn't heard any of this. That's normal at this size, and it's the right way round. What I won't do is ask you to sell it for me. My description of it, arriving second hand at teatime, is the worst version either of you could get. Two ways round it. Fifteen minutes with both of you on the phone, or fifteen minutes with you now and I'll send over what we looked at, so they see the thing itself. Tell me which of those is easier this week.

### 10. Ring me after the season / in the new year

*You will hear it as:* call me back, ring me next, after the summer, after christmas, new year, busy season, try me later, not right now

> So the timing's wrong, not the thing itself. Fair — the middle of a season is a bad week to change anything, and I'm not going to pretend otherwise. Two things though. The part that'd take an afternoon is fifteen minutes on a screen, not an afternoon of yours. And the month you're describing is the month the quotes go out late, which is what I called about. So waiting for it to go quiet means testing it in the week it matters least. Tell me the month you'd want it working by and I'll work backwards from that. Give me a date and it goes in my diary for that day, so I'm not ringing you at random.

### 11. Where did you get my number?

*You will hear it as:* where did you get, how did you get my number, who gave you, how do you have my, who gave my

> So you want to know how I got hold of you before anything else. That's a fair thing to ask, and you're owed a straight answer. It came off your own public business listing, the one a homeowner would find searching for you. It's recorded against your name here, so I can tell you which page it was on. Nobody sold it to us and nobody passed it on. There's no traded list of contractors behind this call. If that bothers you, that's reasonable, and I'd sooner know. Give me the thirty seconds I asked for, and then you can decide on the reason I called, not on how I found you.

### 12. It's just me — I'm too small for something like that

*You will hear it as:* just me, one man, one-man, only me, too small, on my own, sole trader, small outfit

> So it's you, and there's nobody to hand any of it to. That's the case this was built for, not the exception to it. The whole office job lands on the person who's also on the tools, and that's why the evenings go the way they do. It starts at one seat. Anybody who ever works with you in a van is carried at no charge, not billed per head, so taking somebody on doesn't become a reason to leave. Give me fifteen minutes and one job you've already done, and I'll show you how it would really run for one person. Then you tell me whether that's more work than what you do now, or less.

### 13. I've got more work than I can handle already

*You will hear it as:* more work than, booked out, turning work away, don't need more work, do not need more work, plenty of work, flat out

> So the problem isn't finding work. Good — then half of what I could say is irrelevant, and I'll leave it out. I'm not going to talk you into a problem you don't have. The part that still applies when you're flat out is the other end of it. The quotes that go out late because you were on a roof. And the ones priced from memory because there was no evening left to check them against what you've actually been winning at. Being busy is when both of those cost the most, not the least. Tell me roughly how many quotes are sitting waiting on you right now. Then I'll tell you straight whether this is worth a conversation in the middle of a season.

### 14. We tried one of these before and it didn't stick

*You will hear it as:* tried one, we had one, didn't stick, did not stick, gave up on, wasted money, tried that before

> So you've paid for one of these before, and it didn't survive a real week. That's worth more than a fresh opinion, and I'd sooner hear it than talk over it. What usually kills them is the setting up. Somebody hands over an empty system, and your own prices have to be typed into it before it does anything at all. That never happens in July. Tell me which one it was and where it fell over. If we do the same thing at the same point, I'll say so and you shouldn't buy it. If we don't, I'll show you the part that's different, and you can judge it against the one that failed.

### 15. Pen and paper works fine / it's all in a spreadsheet

*You will hear it as:* pen and paper, paper, spreadsheet, excel, notebook, in my head, word document

> So the notebook works, and it's worked for years. Agreed, and I'm not going to tell you it's broken, because for the job in front of you it isn't. Two things it can't do. It can't hand a homeowner something with your name and your colours on it while you're still standing in their kitchen. And it can't tell you the price you've just written is under what you've been winning at, because that needs your own history read back to you. Give me fifteen minutes and one job out of the book — a real one, your own numbers. I'll show you it next to what you'd have sent, and you say which one you'd sooner a customer opened.

### 16. Let me think about it

*You will hear it as:* think about it, let me think, need to think, have a think, sleep on it, get back to you

> Understood, and a decision like this shouldn't be made on a phone call anyway. The reason I'd sooner not leave it there is what thinking about it turns into. In three weeks the thing you're weighing up is my description of it, not the thing itself. So let me take the deciding out of it. Give me fifteen minutes and I'll show you how it works for a business like yours. That's a real quote with your name on it, at no cost, with nothing attached. Then you can think about that instead of about me. Tell me which day next week I should keep clear of, and I'll ring you on a different one.

### 17. Just tell me what it costs

*You will hear it as:* what does it cost, how much is it, tell me the price, what's the price, what is the price, how much

> Fair, and I'm not going to dodge it. A price you have to ring somebody for is its own answer. It's ninety-nine dollars a month for one person who prices work. Everybody else in a van is carried at no charge, not billed per head. Every feature is in every plan, so there's no cheaper one that turns out not to do the thing you wanted. What I can't tell you from here is whether it's worth ninety-nine dollars to you. That turns on how many quotes a month go out of your hands. Tell me roughly what that number is and I'll do that arithmetic with you, not at you.

### 18. Am I tied into a contract?

*You will hear it as:* tied in, contract, locked in, how long am i, commitment, notice period

> So the worry is being stuck with it, not the thing itself. That's the right worry. A year signed up front is how most of this is sold, and it's why people end up paying for software they stopped opening. There's no year to sign here. You pay month to month, and you leave at the end of one. I'll say this against my own interest, since you'll find it out anyway: that also means there's nothing holding you in if it turns out to be no good. So it's on us to be worth the next month, every month. Give me one month with it, and if it hasn't paid for itself, stop it.

### 19. Who owns my customer list? Is my data safe?

*You will hear it as:* my data, who owns, is it safe, customer list, security, privacy, gdpr

> So the thing you want settled first is where your customer list ends up. That's the right question to ask first, and most people ask it last. Your clients, your prices and your quotes are yours. They're not pooled, they're not shown to another contractor, and nothing you put in is used to price somebody else's job. The one place your own history gets read is the review that runs on your own quotes, and it reads only yours. You should hear this from me now: your list comes in easily, but there's no button that exports it all back out. Quotes, invoices and payslips download as PDFs, one at a time. If you want a copy of your data, or want it gone, that's a written request we act on, not a button that quietly does half of it. Tell me what you'd need to see in writing and I'll send exactly that.

### 20. My bookkeeper uses QuickBooks / Sage / Xero

*You will hear it as:* quickbooks, my accountant, bookkeeper, sage, xero, does the books

> So the person who does your books has a system already, and you're not about to move them off it. Agreed, and you shouldn't — that's their tool, not yours. Here's the limit before you find it yourself: there's no link that pushes invoices into it, and there's no export file to hand them either. What they can have is each invoice as a PDF, one at a time. If a monthly file for your bookkeeper is a must, you should know that now, not after you've signed. Tell me how they get the numbers today and I'll tell you straight whether this changes that.

### 21. I'm busy / I'm on a job right now

*You will hear it as:* i'm busy, on a job, in the middle of, on site, up a ladder, can't talk, driving, not a good time

Cognism's answer is "I will be really quick — I promise!". Do not say it; it
is the time promise from §2 with a promise on top. Validate, give him one
sentence of reason so the callback is a decision and not a favour, and get a
time with the two options in it.

> So you're in the middle of something, and I've landed on top of it. Fair — you're on a job and I'm not, and I'm not going to squeeze this in now. One sentence so you know what it's about, and then a time: it's about how a quote gets from the driveway to the customer's phone, and it's fifteen minutes on a screen, not a sales call. When's better — first thing before you're on site, or the end of the day? Give me the time and I'll ring then, not before.

### 22. I'm not the one who deals with that / you want the owner

*You will hear it as:* wrong person, not the right person, not my department, you want the owner, speak to the boss, i just answer the phone, the apprentice, just the office, not me

At this size the person who "just answers the phone" is often the person who
types the quotes up. Find that out before you ask to be handed on, and get
the owner's name so the next call asks for him by it.

> So it lands on somebody else, and I've got the wrong person. Fair, and thanks for saying so instead of letting me carry on. Two quick things, so I don't do this to you twice. Who writes the quotes up and sends them out — is that the owner, or is that actually you in the office? And tell me his name and when he's easiest to catch — first thing, or the end of the day. I'll ring then and ask for him by name, so you're not passing on a message from a stranger.

### 23. Is this a sales call? / What are you selling?

*You will hear it as:* sales call, selling something, is this a pitch, cold call, telemarketer, what are you selling

Cognism's answer is "this actually is not a sales call". It is one. Say so,
and give him the one question that decides whether it is worth either
person's minute.

> Fair question — it is. It's a sales call with one question in it, and I'd sooner say so than dress it up. The question is how your quotes get to a customer — same day from the van, or later that night at the table — because that's the whole of what we do, and half the people I ring have it sorted already. If you've got it sorted, tell me how, because then I've learnt something and you've lost a minute. If it's the evenings at the table, that's worth fifteen minutes on a screen and not a minute more on this call. Which is it?

### 24. Never heard of you — who are you?

*You will hear it as:* never heard of, who are you, what's fieldquo, what company, who's this

No case study, no "contractors like you" — we never quote one contractor to
another, and Gong's data has social proof losing to a plain description of
the problem anyway. Concede that we are small and new, say what we do in one
sentence, and ask the one question.

> So you've never heard of us, and there's no reason you should have. We're small and we're new, and I'm not going to pretend otherwise. What we do in a sentence: the quote gets built while you're still standing in the driveway, from your own price list, with your name on it, and the customer approves it from their phone. That's the whole company. Whether it's any use to you turns on one thing, which is how your quotes go out today — same day from the van, or later that night at the table. Tell me which, and I'll tell you straight whether it's worth fifteen minutes.

## 7. Battlecards — the seven they will name

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
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of Housecall Pro — and you tell me what is wrong with it.

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
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of ServiceTitan — and you tell me what is wrong with it.

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
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of Projul — and you tell me what is wrong with it.

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
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of Jobber — and you tell me what is wrong with it.

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

> Start with what QuoteIQ has that we do not: A plan priced below FieldQuo's cheapest rung. Their own page says: "QuoteIQ starts at $29.99 a month for one user; FieldQuo's cheapest rung is $99". If that is what decides it for you, they are the better buy and I would rather say so now.
> The narrow thing worth knowing: your own website is on their Max plan at $699 a month. It is on every plan of ours, and ours starts at $99.
> For 6 of you — say 2 pricing work and 4 in vans — their Elite is $299 and our Crew is $169. Tell me your real numbers and I will do it again with yours.
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of QuoteIQ — and you tell me what is wrong with it.

**What they genuinely do well**

- A plan priced below FieldQuo's cheapest rung — their page: “QuoteIQ starts at $29.99 a month for one user; FieldQuo's cheapest rung is $99”
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

### Roofr

Read on 2026-09-21 from a Canadian connection. Their page says "All pricing
in USD." Roofr does not bill per head — "Unlimited users" on every plan card —
so there is no headcount arithmetic on this card and you do not do any.

**Say this when they name them**

> Start with what Roofr has that we do not: A plan priced below FieldQuo's cheapest rung. Their own page says: "Roofr's Starter plan is $0 a month with no time limit; FieldQuo's cheapest rung is $99". If that is what decides it for you, they are the better buy and I would rather say so now.
> The narrow thing worth knowing: crew shifts is on their Scale plan at $349 a month. It is on every plan of ours, and ours starts at $99.
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of Roofr — and you tell me what is wrong with it.

**What they genuinely do well**

- A plan priced below FieldQuo's cheapest rung — their page: “Roofr's Starter plan is $0 a month with no time limit; FieldQuo's cheapest rung is $99” (Starter caps proposals, invoices and work orders at ten in total — say that too)
- A roof measurement report with measured edge lengths — their page: “Roofr sells a measurement report per roof — total squares, pitch, and edges (hips, valleys, ridges, flashing) — delivered in as little as two hours, or the report is free”
- Two-way sync with QuickBooks or Xero — their page: “Roofr's Scale plan lists a QuickBooks integration — marked Beta, US businesses only, no QuickBooks Desktop”
- Connects to other tools (Zapier, CompanyCam) — their page: “Roofr connects to Zapier and CompanyCam on every plan, Starter included”
- Book a guided demo with a salesperson — their page: “Roofr's page offers Talk to sales, Book a call and onboarding at no extra charge on the paid plans”

**Where we win**

- Roofr's AI Receptionist is a $99 a month add-on on top of the plan
- Roofr Payments is listed as U.S businesses only, and so is their financing partner
- Company logo & branding is listed on Roofr's Measure+ card, not on the free Starter plan
- SMS ($49), the Instant Estimator ($149), Roofr Sites ($99) and the AI Receptionist ($99) are add-ons — $396/mo on top of the plan, at the monthly toggle. All four are in every plan of ours.
- Crew shifts: their Scale at $349/mo; every plan of ours, from $99.
- 42 things we ship are not listed on any tier of their pricing page — including Lead tracking, Lead form for your website, AI quote review, Suggested add-ons, Confirmation calls, Quote drafted from the call.

**The price**

- They count: Nobody — every plan says unlimited users. What is metered is each roof measured, not each person.
- Starter: Free (USD), unlimited users (read 2026-09-21) — "10 trial proposals, invoices & work orders"
- Measure+ (6 hour): USD 109 /month, or 95 billed yearly (read 2026-09-21)
- Measure+ (2 hour): USD 169 /month, or 145 billed yearly (read 2026-09-21)
- Essentials: USD 249 /month, or 209 billed yearly (read 2026-09-21)
- Scale: USD 349 /month, or 299 billed yearly (read 2026-09-21)
- Per report, on every plan: Roofr Report $19 on Starter, $13 on the paid plans; Report + ESX $31 / $23. Never fold these into a monthly number — you do not know how many roofs they measure.
- No headcount arithmetic: their price does not move with people. Compare plan against plan, and name the add-ons and the per-report charge.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-roofr

### PaintScout

Read on 2026-09-21 from a Canadian connection. PaintScout is a Calgary
company that prices in USD. One plan, one add-on, and every person after the
first is $20 a month — that is the whole card.

**Say this when they name them**

> Start with what PaintScout has that we do not: native mobile app (iOS / Android). Their own page says: "PaintScout's pricing page declares iOS and Android apps in its own structured data". If that is what decides it for you, they are the better buy and I would rather say so now.
> They count people differently to us: each included user, plus a stated price per additional user. We bill the people who price work and carry field crew at no charge, so the same shop can be two very different bills.
> For 6 of you — say 2 pricing work and 4 in vans — their Sales is $219 and our Crew is $169. Tell me your real numbers and I will do it again with yours.
> Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of PaintScout — and you tell me what is wrong with it.

**What they genuinely do well**

- Native mobile app (iOS / Android) — their page: “PaintScout's pricing page declares iOS and Android apps in its own structured data”
- Works offline — their page: “PaintScout lists offline mode for field use among its features”
- Two-way sync with QuickBooks or Xero — their page: “PaintScout exports invoices to QuickBooks”
- Connects to other tools (Zapier, CompanyCam) — their page: “PaintScout connects to CompanyCam and, through Zapier, to other tools”
- A customer community to ask other contractors — their page: “PaintScout links a community — a Facebook group for pricing painting projects — from its site”
- Book a guided demo with a salesperson — their page: “PaintScout's page says to book a personalized demo, and sells three onboarding packages”
- Painting only, with production-rate defaults built from years of painting companies. Ours price by production rate too — hours from rates, gallons from coverage — and ship as opening positions the company tunes. Say that plainly; do not claim parity of defaults.

**Where we win**

- PaintScout includes one user and charges $20 a month for each additional team seat; FieldQuo bills only the people who originate money and includes field crew free
- PaintScout's 14-day trial takes no card; FieldQuo's month is free with a card on file and you leave at the end of any month (the first half is a point for them — say it)
- Operations — scheduling, the pipeline, jobs, tasks, reminders — is a $99/mo add-on on top of Sales. All of it is in every plan of ours.
- 50 things we ship are not listed on any tier of their pricing page — including Lead form for your website, AI quote review, AI receptionist, Confirmation calls, Quote drafted from the call, Your own website.

**The price**

- They count: Each included user, plus a stated price per additional user.
- Sales: USD 119 /month, 1 included, $20/user/month after (read 2026-09-21)
- Sales: USD 99 /month billed annually, 1 included, $20/user/month after (read 2026-09-21)
- Operations add-on: USD 99 /month, or 79 billed annually (read 2026-09-21)
- Success packages are one-time onboarding purchases ($999 / $1,499 / $1,999), optional — never in a monthly comparison.
- Six of you (2 pricing work, 4 in vans): their Sales $219 ($119 + 5 × $20) against our Crew $169.

Full page a contractor reads: https://www.fieldquo.com/compare/fieldquo-vs-paintscout

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
- **Cognism's cold-calling scripts, objection guides and gatekeeper
  piece** — the permission-based opener, the gatekeeper's brevity, the
  objection shape (listen, clarify, answer, confirm, move on), and the
  definition of a gatekeeper that includes spouses and relatives. Their
  70/30 talk ratio is kept for the demo and dropped for the cold call. Their
  "I'm just following up on an email", "I promise I'll be quick" and "this
  isn't a sales call" lines are deliberately *not* taken: they work and they
  are lies.
- **Gong's cold-call data** (100k calls in 2019, 300M in 2024) — the
  permission opener at 11.18% against 2.15% for "bad time"; stating the
  reason at 2.1x; the rep talking 55% of a successful cold call in bursts of
  about thirty-five seconds; problem language at 16% against buzzwords at
  5.5%; the top five objections at 74%; a gatekeeper at −39%; "do you have
  your calendar handy?" and the invite sent before you hang up. Read source
  by source, with what was refused, in `docs/sales/RESEARCH-cold-calling-2026.md`.
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
permission ask, the pivot, every close, every gatekeeper line and every
objection answer in this file are still the ones the software uses.*
