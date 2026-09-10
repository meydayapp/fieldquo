# How you work — the FieldQuo sales rep's SOP

This is the whole job, from the first name in the queue to the third commission
payment sixty days after they sign. It is written for the person doing it, not
for the person who built it. Where a rule exists, this document tells you what
the rule does *for you*; where the product does not do something, it says so
plainly instead of describing a workflow you cannot perform.

One standing rule about this document: **if it disagrees with the screen, the
screen is right.** Tell somebody, and it gets fixed here. That has happened
several times already and the corrections are the reason you can trust the rest.

There is an appendix at the end naming the file behind every claim. It is for
whoever maintains the software. You can ignore it entirely.

---

## 1. Five things you cannot get wrong

Not because anybody is watching. Because the software will not let you, and
that is worth knowing before you start worrying about it.

**Nobody can touch your commission — including us.** Your attribution, the
commission ledger, the payout batches, and your own rep record all refuse every
write that comes from a rep account. That cuts both ways, and the second way is
the one that matters to you: you cannot quietly adjust your own record, and
neither can anybody else. If something is wrong, a superadmin corrects it and
the correction is on the record.

**If somebody says stop, we stop, and you never have to remember who.** A STOP
text lands on the do-not-contact list the second it arrives, and it covers
calls, texts and email at once. Next time you open that business the dial
control simply is not there. Undoing one takes a superadmin and a written
reason, so it never happens by accident — and if a block looks wrong to you,
say so rather than working around it.

**You cannot accidentally sign up your own company.** If your email matches the
company's, or you are already a member of it, the system refuses before it
checks anything else. It saves an awkward conversation three months later.

**Write notes as though a colleague will read them, because one might.**
FieldQuo superadmins can read every note you write, and the screen says so above
the box rather than letting you find out. Other reps cannot — a note belongs to
whoever wrote it. There is no private mode, because a superadmin has the
database and a private label they could read past would be a promise nobody can
keep.

**Their rules win, not yours.** Wherever the contractor is decides what is
legal — the hours you may ring, whether we may ring at all, what has to be in a
text. The screen works it out from their country and state and simply does not
offer you the button outside it.

---

## 2. Getting set up

### Your invite

Your invite link lasts **seven days** and works exactly once. Only a hash of the
token is stored, so a lost link cannot be dug out — it has to be reissued.

Set a password of **at least twelve characters**, and write it down somewhere
safe, because of the next paragraph.

**There is no forgotten-password flow. None.** There is no reset link on the
sign-in page and no route behind one. And re-inviting you does not work as a
back door either — once you have set a password, the re-invite is refused
outright, on the grounds that handing out a second way in beside the one you
already have is worse than the problem. If you lock yourself out, somebody has
to deactivate the account and start again. So: write it down.

Your session lasts **twelve hours**, after which you sign in again.

### Straight after you accept

You land on a welcome screen with two questions on it. Neither is required and
skipping is a real button, not small print — but do them now, because the first
one is how you get paid:

1. **Where should we send your commission?** Pick a method and give the one
   detail it asks for. Nothing is paid until this is set.
2. **What language should the portal be in?** See §13 for what that actually
   changes, which is less than you would hope.

You can set both later from the **Pay** tab.

### Four things to check on your first morning

| Check | Where | If it is missing |
|---|---|---|
| A commission plan is assigned to you | ask a superadmin | **You earn nothing at all, and it is silent.** With no plan the earnings calculation returns nothing rather than guessing an amount. One question, worth asking. |
| Your work mailbox is set | ask a superadmin | You cannot send a single email. The compose box does not appear and it names this. |
| The sending domain is verified | the leads screen tells you | Same — no compose box until it is. |
| Your signup code | it is on your Today screen | Without it you have no link to give anybody. |

**Your code cannot be changed after it is created.** By the time you have been
selling a week it is on a card and in an email signature, and editing it would
quietly stop some of your signups counting.

### Your signup link

    https://<the real app>/signup?sales=<your code>

It is printed on your Today screen with a Copy button. The link is built from
whatever address you happened to load the portal at, so **copy it from the real
production app**, never from a preview.

Two things to be straight about on the phone:

**The link gives the contractor nothing extra.** No discount, no free month
beyond the normal trial, no credit, no banner. The referral programme *does*
give a free month; your link does not. **Never promise a discount for using
it.** What it does is make sure the signup is credited to you.

**Your own numbers are on the Today screen** — signups today, this week, and
all time, counted in UTC so you and the office always mean the same thing by
"today". What is *not* there is money: no commission balance, no running total.
That is deliberate rather than missing — the milestone state is shown on your
companies book, and a figure on screen that no payout run can yet pay would be
a promise the product cannot keep. Ask a superadmin for the money.

---

## 3. Your day

There are twelve tabs. Four of them are your morning and the rest you visit
when something happens. Do not try to learn them all on day one.

| Tab | How often | What it is |
|---|---|---|
| **Today** | daily | One sentence: what to do next. |
| **Queue** | daily | Claim a prospect, read the research, call, close it out. |
| **Leads** | daily | The businesses you typed in or carried across yourself. Email goes from here, and so does a first text. |
| **Conversations** | daily | Email replies. Somebody is waiting on you. |
| **Texts** | when it buzzes | Two-way SMS threads, and your check-in drafts. |
| **Voicemail** | when it buzzes | Messages left on the number you rang from. |
| **Calendar** | when it buzzes | Your appointments and callbacks. |
| **My companies** | weekly | The contractors you signed up. Your retention book. |
| **Support** | when it breaks | Send a technical problem to FieldQuo. |
| **Notes** | whenever | Autosaves. Archive only — nothing deletes. |
| **Demo** | on a call | The account you drive in front of a prospect. |
| **Pay** | day one, then never | How you want the money, and your language. |

**Start on Today.** It answers one question — what to do next — by walking a
four-rung ladder in this order and stopping at the first thing that is waiting:

1. **Somebody wrote back.** A person is holding while you decide what to do
   with your morning.
2. **Ring the ones you are holding.** Prospects you claimed and have not spoken
   to yet.
3. **Claim a new one.** The pool has stock and you are holding nothing.
4. **Write to a lead.** Leads you added and never contacted.

Rung 2 outranks rung 3 on purpose. A claim is a lease on everybody else's
ability to phone that business, so sitting on claims you are not working is not
a neutral act — it costs another rep the call.

An empty ladder means your day's queue is genuinely clear; it never invents
busywork. And it never reads a failed load as a zero — if one of the counts
could not be fetched it says which one, rather than telling you to go home
while three people wait. You will also see a line when claims are about to
lapse within twelve hours.

---

## 4. The queue

### Claim before you call

Pick a trade — there are **thirty-nine** in the picker — and press **"Claim the
next one"**. You get the next one in that trade, not the one you liked the look
of.

**You cannot browse the pool.** You get a count per trade, never a list. That is
deliberate: a rep who can see the pool cherry-picks, and one rep claiming two
hundred and calling nine freezes the board for everybody.

**The claim is the lock.** While you hold it, no other rep can ring that
business. That is the whole fairness mechanism.

**A claim lapses after 48 hours** if you do nothing with it, and the prospect
goes back to the pool. It measures inactivity, not age.

You cannot trigger discovery — it runs on a schedule. If a trade is empty the
screen tells you which of three reasons applies, in words: nothing free to
claim, everything contended, or the pool is dry until discovery runs again.

Claims come out oldest-first, explicitly not by any kind of score. Nothing in
this build writes a prospect score yet, so there is nothing to sort by and the
screen does not pretend otherwise.

### Read the research, and keep the layers apart

The screen gives you three separate sections and never merges them. Neither
should you on a call.

| On screen | What it is | How to use it |
|---|---|---|
| **What we observed** | Facts. Each one was seen, or deliberately looked for and not seen. | Safe to state directly. |
| **What we infer** | A conclusion the evidence supports and does not prove, with how sure we are. | Say it as a question, never as a claim. |
| **What to pitch** | An argument built from the two above, carrying the reason it fired. | A suggestion, not a script. |
| **What we do not know** | Named gaps. | Ask about these. |

When a line cannot be stated safely, the screen prints a **refusal** where the
claim would have been, rather than dropping the row quietly. You will see four
of them, and all four are the screen protecting you:

- an inference with no confidence figure behind it;
- an inference whose value contains a number, because that field holds
  classifications — "small team", never "twelve employees";
- a recommendation citing no evidence, shown as broken rather than read out;
- a recommendation with no stated reason.

**Do not repair a refusal by guessing on the call.**

### Three things the research does not mean

Getting these backwards is how a call goes wrong in the first ten seconds.

- **A website that will not load is not a business without a website.** That is
  the single most damaging inversion available, because "no website" is the
  strongest pitch there is.
- **A page that loads with no links is not proof they offer nothing.** It is
  usually a JavaScript site our crawler cannot execute.
- **"We could not look today" never overwrites "we looked last week and there
  was a booking page."**

And the general form of all three: a capability marked *no* is a real
observation. *Unknown* means we did not find out. The screen keeps them as
three different sentences, and the unknown sentence deliberately never contains
the word "no".

---

## 5. The phone

### A call, end to end

It all happens on one screen. You never leave the record.

1. **Claim one.** One at a time.
2. **Read the layers.** Two minutes. This is where the call is won.
3. **Press Call.** It rings in your browser through a headset. If the browser
   dial is not available to you, the screen offers the number as a handset link
   instead — never both, and never neither with no explanation.
4. **Say who you are and give a callback number.** Required on every call, and
   the screen shows you the number being presented so you can read it out.
5. **Type while they talk.** The note box sits beside the dial. A note written
   afterwards is a summary of a memory.
6. **Close it out.** Say what happened, from the list.

**The number the contractor sees** is one of FieldQuo's own sales numbers,
chosen to match their area code where we hold one — a contractor in Tulsa
answers a 918 and lets an unknown number ring out. It is always a number we
actually own; nothing here invents a plausible local number, which is spoofing
and would get the whole operation cut off. Two calls to the same business come
from the same number, so they do not see two strangers. Give out **that**
number, never your personal mobile: a call to the number the product dialled
from can be routed to you and picked up; a call to your mobile cannot.

**Calls are not recorded.** There is no setting for it. Recording a two-party
call is consent law rather than a feature flag, and turning it on properly
means a disclosure to both parties, per state, with the consent stored.

### The hours you may ring — the screen works them out

**There is no single calling window, and anybody who tells you 8-to-9 is
oversimplifying.** Whose rule applies depends on where the contractor is, and
it is judged on *their* clock.

- **Canada** is one federal rule for every province: **09:00–21:30 on
  weekdays, 10:00–18:00 at weekends.**
- **The commonest US state window is 08:00–21:00**, but several states are
  narrower — Oklahoma, Florida and Washington are **08:00–20:00** — and most
  states' rules are written for a residence and do not reach a business line at
  all.
- **Arizona is a flat ban.** Not a window: an unsolicited sales call to a
  mobile number is unlawful there at any hour, and a large share of contractors
  publish a mobile as their business number. Waiting does not fix it, so the
  screen refuses outright rather than telling you to try later.
- **Alabama, Mississippi and Pennsylvania ban Sunday calls** while leaving
  Saturday open.
- **Nevada was read and imposes nothing at all.** So FieldQuo's own courtesy
  window — 08:00–20:00 — applies there instead, and the refusal *says* it is
  our rule and not the state's. You will never be told a state forbids
  something it does not.
- **Iowa and Vermont say "we cannot confirm this is allowed."** Nobody has read
  those two to the standard the rest were read to. That is an honest refusal,
  not a bug, and it is not a rule you may talk your way past.

You do not do this arithmetic. The screen reads their country and state, finds
the rule, converts to their local clock and decides. **Outside the window there
is no dial control at all** — not greyed out, absent — and no handset link
either. When it can, the screen tells you when it opens: *"the window opens at
08:00 Thu 11 Sept."* Go and work somebody who is open instead of watching the
clock. Pressing Call posts to a route that re-reads the entire decision from
the database, so a screen you left open an hour ago cannot authorise anything.

Two things the software knows and cannot enforce for you, and it says so on
screen rather than pretending:

- **Oklahoma and Florida cap you at three calls to the same business on the
  same subject in 24 hours.** Nothing in FieldQuo counts call attempts yet, so
  keep track yourself. Both states carry a private right of action.
- **Alabama and Rhode Island also ban solicitation on holidays.** Holidays are
  a moving per-state list and a half-built calendar that is right about Labor
  Day and wrong about a state holiday would be worse than none, so that one is
  named on screen and left to you.

You may also see a warning that **FieldQuo is not yet registered** to make
sales calls into a particular state — Washington, Texas and Vermont each
require a solicitor to register, and Vermont makes an unregistered call a
criminal offence. That is a filing and a bond, not code, and it is a warning
rather than a refusal because nothing in the software can know whether the
certificate is in the drawer. If you see it, ask before you dial into that
state. Canada's National DNCL registration was filed on 6 September 2026.

Finally: **a human dials, one call at a time, always.** The US TCPA has no
business exemption for autodialled or prerecorded calls to mobiles, and small
contractors answer on mobiles. There is no autodialler here and there must not
be one.

### The playbook is on the screen while you talk

You do not have to remember the words. The call panel carries the playbook
beside the dial: nine call stages, and eight written objection responses with
the cues a contractor actually says — already use a competitor, too expensive,
no time to switch, don't need a website, booking isn't for us, email works
fine, send me info, not interested.

One honest limit: the playbook is built from the discovery behind a **prospect**.
A lead you typed in by hand has no discovery behind it, so there is no playbook
for it, and the screen says so rather than showing you a blank one.

### Closing out

Ten ways a call can end, and the screen keeps the unfinished one in front of
you until you say which it was: no answer, busy, voicemail left, someone
answered but not the owner, they asked me to ring back, spoke — interested,
spoke — not interested, asked not to be called again, wrong or dead number, and
not a business we can sell to.

Each does something different to the claim behind it. **"Wrong or dead number"**
releases the claim *and* flags the record for review, so the pool cannot hand
the same dead number to the next rep. **"Asked not to be called again"** will
not save without their words in the note, and it is permanent.

The queue also has three buttons of its own, and one of them is not what its
old name suggested:

| Button | What it does |
|---|---|
| **"I spoke to them — keep this one"** | Marks it worked. The claim stops lapsing and stays yours. |
| **"Put it back in the pool"** | Releases it. Use it the moment you know you are not working it. |
| **"Stop working this one"** | Needs a written reason. Permanent on that one prospect. |

**Read the difference between the last one and the disposition, because it
matters.** "Stop working this one" writes a flag on that single prospect
record. It is permanent, nothing lifts it, and it survives every pipeline
stage — but **it does not put the number on FieldQuo's do-not-contact list.**
If they said it on the phone, close the call with **"Asked not to be called
again"** instead. *That* one writes both, and it binds every rep and every
channel. The screen says this above both controls; it is repeated here because
it is the single easiest thing to get wrong.

### One thing that will look like a bug

**Prospects you mark "worked" stay in your queue permanently.** Marking one
worked clears its expiry so it stops lapsing, and the queue matches on exactly
that. So your queue accumulates rather than emptying. That is how it behaves
today, it is not something you have broken, and worked prospects are excluded
from the "claimed, not called yet" figure on Today so your morning number still
comes down as you work.

---

## 6. When they ring you back

A contractor who calls the number you rang them from reaches a real person, and
usually you.

**You answer in the browser.** A dock appears on whatever portal screen you are
on, showing the caller's number and two buttons: Pick up and Decline. It is
mounted once and rings everywhere, so you do not have to be sitting on the
queue.

**The ring order**, in this order:

1. **The rep the number belongs to** — rung even if they are already on a call;
   their browser decides whether to show the second one.
2. **Whoever spoke to that contractor last.** On a shared line the call log
   already knows, so a contractor ringing from a mobile we have never seen
   still reaches the right person.
3. **Whoever is free**, longest idle first, so one rep does not take every call
   while another sits waiting.
4. **A handset somebody carries**, for when nobody is at a desk.

Up to three browsers are offered the call at once, each ringing for twenty
seconds. "Available" in that list is a claim rather than proof: a rep whose
browser has been shut for a quarter of an hour is skipped rather than rung, so
a contractor does not listen to twenty seconds of a dead machine.

**Declining does not hang up on them.** It hands the call back so the next
person on the list gets it, and the dock says so on the button while it is
ringing. Use it freely.

**If nobody picks up** the caller is held and we keep trying — up to four
rounds, a little over two minutes — and then they are offered a message. They
are never held in silence and never held forever, and they are never told "you
are number three in the queue", because each caller is looked after on their
own timer and we genuinely do not know their position. The message says what
is true.

### Handing a caller to somebody else

Two ways, and the caller is never let go of either way.

- **Warm — "Speak first."** You talk to the other rep privately while the
  caller waits on hold, then put them through when you are ready. Use it when
  the context has to travel with the call.
- **Cold — "Straight through."** They go across the moment the other rep picks
  up. Right when the reason is obvious: wrong trade, wrong province.

**If the person you chose does not answer, the caller comes back to you.** They
hear hold music, not a dial tone. The transfer list only offers reps who are
genuinely reachable — if a name is not there, they are not there, and the
screen says so in words rather than showing you a greyed-out row.

The one case that cannot be recovered is **you** hanging up mid-transfer. Then
the caller goes into the hold queue instead, which ends at a voicemail rather
than at nothing. So do not hang up on a transfer; wait the extra few seconds.

### Voicemail

`/sales/voicemail` holds the messages left on your number — yours, playable by
you. Before this screen existed the only place a sales voicemail could be
played was a superadmin board, so the person the message was *for* could not
hear it.

Each message shows the business if we can match it, the caller's number, when
it came in, how long it is, and a link straight to the record. Unmatched ones
say **"Not matched to a business"** rather than being hidden — a contractor
ringing from a mobile we have never seen matches nobody, and those are exactly
the callbacks worth having.

**A zero-second message means they rang, heard the beep and thought better of
it.** The screen labels it *"no words spoken"* and says so: warmer than a
missed call, colder than a message, and worth a callback the same day. It is
the highest-intent contact you will get all week and most people ignore it.

The audio plays inside FieldQuo, never off a link from the phone company. There
is no transcription — a rep listening to a ninety-second message is cheaper
than transcribing every wrong number.

---

## 7. Turning a prospect into a lead

When you have spoken to somebody in the queue and want to email or text them,
press **"Work this one as a lead."**

It copies the business name, the phone number, and the country and province
across onto a lead of your own, and it links the two records so neither screen
loses the other. It stays claimed by you either way. Pressing it twice hands
back the lead that already exists rather than making a second one.

Three refusals, all sensible:

- A prospect **somebody else** has claimed cannot be carried across. Claim it
  in the queue first.
- A prospect flagged **do-not-contact** is refused rather than copied, because
  the leads screen is where the email and text controls live.
- The country and province come across, but **the time zone does not**, because
  the prospect record does not carry one. Set it on the lead — see §9.

One gap to know about: the duplicate check is on *that prospect*. If you had
already typed the same business in by hand as a separate lead, pressing the
button still makes a second one.

---

## 8. Email

### The compose box, or the reason there isn't one

The box **does not render at all** when something is blocking a send. You get a
notice in its place naming the blocker, so you are never typing a message that
was going to be refused.

Blockers — no box, and a send would be refused:

| What it says | Who fixes it |
|---|---|
| No work mailbox assigned | superadmin |
| Your work email is malformed | superadmin |
| The sending domain is not verified | owner, in DNS |
| Reply addressing not configured | owner |
| No mailing address set — the law requires one in the footer | owner |

Warnings — the box still appears, but read them:

- **We could not ask the provider about the domain.** Not a refusal; we simply
  do not know.
- **Inbound is not configured, so replies are not being filed.** Watch your own
  mailbox until it is.

### What actually goes out

From is your work mailbox with your name on it — `Your Name <you@…>` — with no
fallback to your sign-in address. Reply-To is either a tagged version of that
address or the plain one with the reference carried in the visible footer,
depending on how the mail is set up.

Every email carries a four-line footer that is **not optional**: your name and
address, FieldQuo's postal address, how to make you stop, and a reference. The
builder throws rather than send a degraded version — there is no path that
sends one without it.

**The order of checks on send**, and the first one is first on purpose:

    do-not-contact → is your mail set up → reply address → build → send → then write the row

Telling somebody "your domain isn't verified" when they were trying to email a
person who asked us to stop answers the wrong question.

**The row is written only after the provider accepts it.** A failed send leaves
you nothing to retry from, rather than an empty conversation in your list for a
message that never happened.

### Statuses

Five, on the lead: **New, Contacted, Demoed, Signed, Lost.** A successful send
moves New to Contacted and nothing else — nothing ever walks a status
backwards, and Signed and Lost are your judgement, not the mail's.

### Replies

Replies are routed by the reference token, never by the From address. If
somebody replies from a different mailbox it still lands in the right
conversation.

---

## 9. Texts

### Two different things, and the first is fixed

**The first message to a number is the signup-link text, and you cannot compose
it.** Your name, FieldQuo, your link, our mailing address, and "Reply STOP to
opt out". That fixed shape is what makes a first contact legal — it carries the
identification the law wants — and it is sent from the lead.

**After that it is a conversation.** They write back, you reply in your own
words, in a thread that looks like your phone. What you type is not rewritten,
trimmed of your sign-off or checked for tone; FieldQuo appends the required
identification line at the bottom and that is all.

**You cannot open a free-text thread with a stranger.** Trying it is refused,
in words: *"You have not texted this number before. Start from the lead — the
first message carries your signup link and the identification the law wants on
a first contact."* Typing "hey, remember me?" to somebody who has never heard
from you is exactly what that refusal exists to stop.

Keep replies short. Two segments is the practical ceiling, and one emoji or one
curly quote re-encodes the whole message and can quintuple what it costs to
send.

### The texting window is 08:00–21:00, flat, every day

In **their** time zone. 20:59 is in; 21:00 is out. There is no weekend
difference, deliberately — a weekend split copied over from the calling rules
would look like diligence and would be an invented restriction with no statute
behind it. Canadian law times commercial texts not at all, so what binds a text
is the US rule, and this one **is enforced**: outside the window the send is
refused and nothing is queued. You press send.

**You have to state their time zone yourself**, on the lead, from a list of ten
North American zones. Nothing is inferred from the area code — that is wrong
for every ported number, and a guessed state is a guessed statute. Without one
you cannot text at all, and it is the one blocker on the list you can clear
without asking anybody.

### The number your texts come from

**Texts do not go from the number that rang them.** Every rep's texts go out on
one shared FieldQuo sales number. Your **calls** are the opposite — those
present a sales number matched to their area code, and a callback to it is
routed to you by the ring order in §6.

So: **do not tell a contractor to "text back the number that rang you."** Tell
them to reply to the text you sent them, or to ring the number that rang them.

Why is the texting number shared? The honest reason is cost, not compliance.
Every sending number has to be registered for A2P/10DLC before it may text a US
contractor at all, so numbers are not free to add, and one number is one
registration and one reputation to keep clean. (An older version of this
document said the sharing was needed so that a STOP could not fragment across
reps. That was not true — the opt-out is recorded against the *contractor's*
number and is already global — and the reasoning was corrected in the code
rather than quietly deleted.)

Your conversations are still yours. No other rep reads them.

### Why a text will not send

If the send is refused, the screen names it: Twilio not configured, no sales
number held, no mailing address set, your name missing, no signup link, no
phone on the lead, a phone that will not parse, a number outside North America,
the do-not-contact list unreadable, they are on the do-not-contact list, no
time zone, outside the window, or a time zone we cannot read.

Note the third-from-last. **If the do-not-contact list cannot be read, the text
is blocked.** That is the deliberate opposite of how the email path treats an
unreachable provider, and it is the right way round: "we could not check" is not
permission.

---

## 10. Opt-outs

This is the one thing in the job you cannot undo, so it is worth two minutes.

**By text, STOP.** It is written across every channel — email, phone and SMS —
the second it arrives, against the contractor's own number. A STOP text
therefore stops the calls and the email too, for every rep. And **START does not
reverse it.** The tenant side of FieldQuo does reverse a STOP on a START,
because that is what carriers expect of a contractor texting their own
customers; this side deliberately does not.

**By email**, only what they actually wrote counts — quoted history is stripped
first, or our own footer would flag every reply — and only the first three
non-empty lines, matched whole against a list of twenty phrases: unsubscribe,
remove me, take me off your list, opt out, do not contact me, and so on. A bare
"stop" is not an email opt-out phrase.

**On a call**, the "Asked not to be called again" disposition writes the same
row, in the same transaction as the disposition, and marks the prospect so the
dial control disappears.

Some properties worth knowing:

- **An unqualified "stop" closes every channel.** A phone opt-out stops the
  email too. Over-suppression is the failure this list is allowed to have.
- **One domain entry suppresses every mailbox at that company.** The lookup
  widens on the way out — the exact address, then the address with any tag
  stripped, then the whole domain.
- **It applies across every lead and every rep sharing that contact**, not just
  your copy. The rep-scoped version was a bug: two reps holding the same
  business meant an opt-out silenced only one of them.
- **Retention is three years and fourteen days**, computed on the calendar so a
  leap year cannot shorten it. Nothing prunes these rows and nothing deletes
  them. Removal is a superadmin-only flag with a mandatory reason, and the
  evidence stays.
- **Where a number came from can block a send before the list is even
  consulted.** A number lifted from a public licence register carries no
  implied consent to email it, and the check knows the difference.

What to say when you hear it: *"Understood — I'll take you off our list now.
Sorry to have bothered you."* Then stop talking. Do not ask why, do not offer
to email instead, do not say "can I just send you the link" — email is closed
too, the moment you press the button. Nine of these a week is a rep working the
phone properly, and nobody is judged on it. A rep who gets nervous about
opt-outs starts fudging them, and a fudged opt-out is the one that costs real
money.

One asymmetry, deliberate: somebody on the list who rings **us** is still
connected. Answering a call they placed is not a breach of their request.

---

## 11. After they sign up — your second job

A signup that cancels in five weeks pays you twice. One that is still there at
day 60 pays you three times. The second job is the difference.

### Check-ins

FieldQuo tracks all thirty of your companies, ranks them, and tells you *why*
each one came up. There are two scheduled touchpoints, set by the owner:

- **Day 1 — about setup.** Did anything stop them finishing? A person who hit a
  wall on their first evening will not come back to it on their own, and by day
  three they have decided the product is hard.
- **Day 7 — about use.** They have had a working week to try it on a real job,
  so "is everything okay" is finally a question with an answer.

Beyond those, a company comes up when something looks wrong, ranked by how
wrong: their payment is failing, their free period ends before the milestone,
they cannot take a payment yet, they never finished onboarding, set-up steps
still open, the milestone is close, we cannot see how they are doing, and
finally — a legitimate reason, not filler — nothing looks wrong, say hello.

Note that "we cannot see how they are doing" sits *above* "nothing looks
wrong". Not knowing is a worse place to be than knowing things are fine, and the
order says so.

Some companies will not come up at all and the screen says why: a demo company,
a subscription that already ended, one you texted recently, or one past its
milestone with nothing wrong. Absence of a row is explained, never blank.

**Nothing is ever sent on a schedule.** A check-in is a **draft** — it appears
in the text thread where an outgoing message would sit, marked DRAFT, with the
reason printed above it. You read it, edit it, and send it. There is no
"scheduled" state anywhere in this, because calling it that would be exactly
the kind of control that looks like it works and does not; scheduling a draft
means *when you want to see it*, not when it goes out. You can also park a note
to yourself as a draft for a date of your choosing.

The wording is drafted from facts already on the record and may be rephrased to
sound more like a person. It may **not** add a number, a price, a link or an
emoji — a model that decides they have "3 quotes waiting" has invented a fact
about somebody's business, and you would send it, because it reads exactly like
the true ones. If the rephrasing is refused or the model is down you get the
plain version. The worst outcome is duller wording, never an empty box.

### Support

`/sales/support` is for something that **does not work**, at one of your own
companies. "How do I add a crew member" is a question you answer. "Their quote
PDF is coming out with no logo" is a ticket.

You pick the company from your own book, write one line and what happened, and
say how urgent it is — low, normal, high or urgent. Leave it out and it is
normal; send something we do not recognise and it is refused rather than
quietly downgraded. It goes to a FieldQuo superadmin as a ticket with a thread
you can follow, not to an inbox where it can evaporate.

If nobody is assigned yet, the screen says **"Recorded, but not assigned to
anyone yet"** in words. A ticket showing "Open" either way would be the
reassuring lie this channel exists to stop.

Three states and no fourth: Open, In progress, Resolved. Something that turns
out not to be fixed is reopened rather than replaced by a second ticket that
loses the first one's history. You can reply on the thread; you cannot change
the status — that is FieldQuo's.

You can also raise one straight from a lead once it has been linked to a
company: **"Raise a support ticket for them."** It goes to FieldQuo, not to
them. Raise it while you are still on the phone — a problem you meant to write
up after lunch is a problem the contractor reported to nobody.

### Your demo account

`/sales/demo` gives you **one** demo company. You claim it once and it is yours
permanently — it does not expire and nobody reclaims it, so the walkthrough you
set up is where you left it next time. You cannot take a second and you cannot
take one off a colleague.

You choose what trade it is set up as, and you can wipe it clean and reseed it
between calls. Both take two presses.

One state to expect: the company may be yours before the login exists, because
creating the sign-in is a superadmin action. In that case the screen gives you
the exact sentence to send them, naming the company and the address, and
deliberately offers no sign-in button rather than one that would fail.

### The milestones

You stop being involved with the paperwork and the milestones run on their own.

| Stage | What triggers it | When |
|---|---|---|
| Signup | The company uses your link | Attribution locks immediately |
| **Activated** | Stripe enables charges on their account | Webhook, minutes |
| **Renewed** | Their next billing cycle turns — paid, or free if a credit covered it | Around day 30, when the free month ends |
| **Still paying** | Still active 60 days after the **subscription started**, trial included | Nightly sweep, 09:20 UTC |

Default amounts are **$20 / $40 / $65 — $125 in total.** They are set per
commission plan and a superadmin can change them, so treat those as the
defaults rather than as fixed law.

Read the third row carefully: the clock runs from when the subscription
started, trial and all, not from their first payment. An annual subscriber
qualifies — the test is "still a paying customer", not "paid again". A refund,
or a dispute they lose, denies it. A trial still running, an overdue payment,
or a dispute still open **holds** it rather than denying it, and the sweep asks
again the next night.

Two things worth knowing on a call:

- **A contractor who cancels during the free month never produces a billing
  cycle**, so two of your three milestones never fire. Qualify hard.
- **Retention money from a March cohort lands in May.** Your first two months
  look worse than your steady state. That is arithmetic, not performance.

**Payouts close weekly** — Mondays, for the previous Monday-to-Monday week,
into a batch. **A person pays it.** Nothing transfers money to a rep
automatically, and nothing is paid at all until your Pay tab is set.

What a given rate of production actually pays, week by week, is in
`docs/sales/VOLUME-SCENARIOS.md` — seven scenarios from one to seven signups a
weekday, each with the ramp to steady state. Read it before agreeing to a
number. The short version: steady state is roughly **signups per weekday × $300
a week**, it is not reached until week 9–13, and the first twelve weeks pay
57–60% of twelve steady weeks at every rate.

---

## 12. Your pay details

The Pay tab, on your first day. Nobody is paid until it is set, and a method
with no destination is refused rather than saved half-done.

**Where the money goes** — five choices, each stating its own trade-off before
you pick, not after the money arrives short:

| | Best for | What it asks for |
|---|---|---|
| **Upwork** | how the first reps are engaged | Your contract or profile link. Released against the contract's milestones; Upwork's fee comes off what lands. |
| **PayPal** | anywhere | Your PayPal email. Fees depend on the receiving account. |
| **Interac e-Transfer** | Canada | The email registered for Interac. Usually free and same-day. |
| **Wise** | a rep outside Canada | Your Wise email or account details. Converts at the mid-market rate with the fee shown up front, so what arrives is predictable, and it can land in your own currency. |
| **Bank transfer** | a large batch | Account details or the IBAN. Slowest to arrive, cheapest to send. |

The screen shows **when you last confirmed it** as a date rather than a tick —
an account confirmed two years ago is not the same claim as one confirmed last
week — and after six months it suggests re-confirming.

**Freelancer or employee is shown, not chosen.** It decides paid leave and what
is withheld, so FieldQuo sets it. If it looks wrong, say so and it is corrected.

Every change to your payout destination is written to an audit line with the
old and new details masked. That is there to protect you.

---

## 13. Language, honestly

There is a language picker on the Pay tab and on the welcome screen. It offers
eight languages plus **"Follow my browser"**, and choosing nothing is a real,
stored answer rather than a silent English.

**Be clear about what it changes, because it is less than the name suggests.**
The portal is only partly translated: the shell and its menus, the sign-in
screen, the invite screen and your companies book go through the translation
system. **The prospecting screens are written in English** — queue, leads,
conversations, texts, notes, calendar, demo, support, voicemail, Today, and the
settings screen holding the picker itself. So choosing French moves the frame
and leaves most of the pages in English.

The picker says this on screen rather than implying a fully translated console.
Hiding the control until everything is translated would have been worse: it
leaves a francophone rep with nothing at all.

Even the tab names are split for the same reason — a translated tab opening an
English page is a worse inconsistency than an English tab, so four tabs are
translated and eight are not. They each become a key the day the screen behind
them is translated.

---

## 14. What is not built — do not wait for it

Each of these is something you might reasonably expect. None of it exists
today, and knowing now beats discovering it in week two.

1. **No password reset.** Covered in §2 and repeated here because it is the one
   that ruins a morning.
2. **No commission balance you can see.** Your signups and your link are on
   Today; the money is not. Ask a superadmin.
3. **No manager tier.** The reporting-line column exists in the database, but
   nothing reads it, no screen sets one, and nobody has decided from what date
   a team lead may read a report's notes. So notes are visible to you and to
   superadmins, and to nobody in between — which is exactly what the screen
   above the box promises.
4. **No lead score ordering your queue.** Claims come out oldest-first. Nothing
   writes a score yet, so there is nothing to sort by.
5. **No guided tour.** It is fully built and it cannot run: its table could not
   be created because the database is at its storage cap. It fails silently on
   purpose — you get no launcher and no broken panel, just nothing. Do not go
   looking for it.
6. **No automated or drip outreach.** Every email, every text and every
   check-in needs you pressing send. There is no cron behind any of them, and
   that is a design decision rather than a gap.
7. **No call recording.** See §5.
8. **No queue-position announcement for a caller on hold.** Each caller is on
   their own timer, so we do not know their position and will not invent one.

### Rough edges known today

These are live faults rather than missing features. They are written down so
you do not think you have broken something, and they are being fixed.

- **Worked prospects stay in your queue.** §5. Behaving as designed in the
  code, not as its comment claims.
- **A free-text reply reports a failure even when it went out.** The provider
  accepts the message and the screen tells you it was refused, and no copy is
  kept in the thread. **Do not resend** — check with somebody first, or you
  will text the contractor twice.
- **A contractor who texted STOP shows up as "No sales number yet."** The dial
  control is correctly gone, and the sentence underneath does say they asked us
  to stop — but the heading is wrong and it will invite you to go and find a
  number they do not want you to use. Read the sentence, not the heading.
- **The voicemail screen may not load for a rep who has been given their own
  number.** If it errors, say so — it is a query fault, not your account.

---

## 15. Quick reference

```
Signup link      https://<production origin>/signup?sales=<your code>
Session          12 hours
Password         12 characters minimum, and there is NO reset
Invite expires   7 days, single use
Claim expires    48 hours of inactivity, unless worked

TEXTS            08:00–21:00 daily, THEIR zone, flat          ENFORCED
                 from one shared FieldQuo sales number
                 first message fixed; replies are yours to write

CALLS            no single window — the screen decides        ENFORCED
                 Canada        09:00–21:30 wkdy / 10:00–18:00 wknd
                 most US       08:00–21:00, some 08:00–20:00
                 Arizona       no unsolicited call to a mobile, any hour
                 Nevada        no state rule; FieldQuo's 08:00–20:00, said so
                 Iowa/Vermont  "cannot confirm this is allowed"
                 AL/MS/PA      no Sunday calls
                 OK/FL         3 calls per business per 24h — NOT counted, yours
                 identify yourself and give a callback number, every call

INBOUND          rings your browser; decline passes it on, never hangs up
                 3 targets at once, 20s each, then hold (≈2 min) then voicemail
                 0-second voicemail = they rang and hung up. Call them back.

OPT-OUT          permanent, all three channels, global across reps
                 superadmin-only removal, written reason, evidence kept
                 retained 3 years + 14 days. STOP is not reversed by START.
                 queue "Stop working this one"  = ONE prospect row
                 call "Asked not to be called"  = the platform list

CHECK-INS        day 1 (setup) and day 7 (how is it going), then by reason
                 drafted, never auto-sent

MILESTONES       Activated $20 · Renewed $40 · Still paying $65 = $125 default
Retention clock  60 days from SUBSCRIPTION START, trial included
Payouts          weekly, Monday batches, paid by a person
Steady state     signups per weekday × $300/week, reached week 9–13
                 Full tables: docs/sales/VOLUME-SCENARIOS.md
```

**The one sentence to carry into every call:** never promise a control that does
not exist. There is no mobile app, no discount for using your link, and no
recording of the call. Everything else on the feature list is real, and this
document says exactly where the rest stops.

---

## Appendix — for whoever maintains this

Every claim above, and the module it was checked against on 10 September 2026.
Nothing in this section is for a rep.

| Section | Modules |
|---|---|
| §1 rules | `lib/sales/gate.js` (`REP_FORBIDDEN_WRITES`, and the non-GET refusal), `lib/sales/attribution.js` (`selfDealReason`), `lib/sales/notes/visibility.js` (`VISIBILITY_NOTICE`, `NOTE_READING_PLATFORM_ROLES`), `lib/sales/suppression.js` |
| §2 invite, session | `lib/sales/invite.js` (`INVITE_TTL_DAYS = 7`, `MIN_PASSWORD_LENGTH = 12`), `lib/sales/auth.js` (`SESSION_HOURS = 12`, `canAuthenticate` re-read per request), `app/api/sales/auth/*` — no reset route exists; `app/api/platform/sales/reps/[id]/invite/route.js` 409s on an accepted rep |
| §2 welcome | `app/sales/welcome/page.js`, `app/components/sales/PayoutDestinationForm.js`, `RepLanguageChoice.js` |
| §2 link and counts | `lib/sales/repStats.js` (`signupLinkFor`, `repSignupStats`), `app/sales/page.js`, `app/api/sales/me`; `app/api/companies/route.js` resolves `salesCode` independently of the promo waterfall |
| §2 no commission on screen | `lib/sales/scope.js` `REP_MILESTONE_SELECT` excludes amounts; `lib/sales/performance.js` has no importer under `app/sales/` |
| §3 tabs and Today | `app/sales/SalesShell.js`, `app/sales/nextAction.js` (`LAPSE_WARNING_HOURS = 12`, null-stops-the-ladder) |
| §4 queue | `app/api/sales/queue/route.js` (`ACTIONS`, compare-and-set claim, `CLAIM_ATTEMPTS = 3`), `lib/sales/prospectView.js` (`CLAIM_HOURS = 48`, `queueWhere`, `claimState`), `lib/sales/queueGate.js` (`REP_QUEUE_WRITES`), `lib/sales/discovery/trades.js` (39 keys) |
| §4 layers and refusals | `lib/sales/prospectView.js` `presentInference` / `presentOpportunity`; `lib/sales/intel/capabilityDetect.js` (`CAPABILITY_WORDS`, the load-failure inversion) |
| §5 calling rules | `lib/sales/callingRules.js` — `CALLING_JURISDICTIONS`, `salesCallReadiness`, `dialHref`, `FIELDQUO_COURTESY_WINDOW` (08:00–20:00), `prohibition` (US-AZ), `closedWeekdays` (AL/MS/PA), `handEnforced` (holidays), `maxCallsPer24h` (OK/FL, reported not enforced), `registration` (WA/TX/VT outstanding; CA filed 2026-09-06), unread rows US-IA and US-VT. Canada's window is `SALES_CALL_WINDOW` in `lib/sales/callingWindow.js` |
| §5 dial path | `app/sales/queue/page.js` and `app/sales/leads/[id]/page.js` hold no `tel:` string; `lib/sales/dialSpace.js` decides the space; `app/api/sales/calls/route.js` re-reads the whole decision server-side. `scripts/check-sales-calling-window.mjs` walks the import graph from every sales entry point |
| §5 caller ID | `lib/sales/calls/browserDial.js` `chooseCallerId` (area-code match, stable sort fallback, never spoofs) over `lib/sales/calls/store.js` `salesCallerNumbers`. **Note:** `lib/sales/numbers.js` `callerIdForRep` implements assignment-beats-locality and has no caller on the outbound path; assignment today affects inbound ringing only. `record: false` in `callPlan` with the consent-law reasoning |
| §5 playbook | `lib/sales/playbook/stages.js` (9), `objections.js` (8 codes), reaching the rep via `app/components/sales/CallPanel.js` → `CallPlaybook.js` → `app/api/sales/playbook/route.js`. No file under `app/sales/` imports the library directly |
| §5 dispositions | `lib/sales/calls/dispositions.js` — 10 codes; `do_not_call` sets `doNotContact` and `requiresNote`; `bad_number` releases and flags `needs_review` |
| §5 two do-not-contacts | queue action writes `Prospect.doNotContactAt` only (`REP_QUEUE_WRITES = ["prospect"]`); the `do_not_call` disposition writes the row **and** a `SalesSuppression` on the phone channel, in one transaction — `lib/sales/calls/gate.js` argues the seam |
| §6 inbound | `lib/sales/calls/inboundDistribution.js` (`RING_SECONDS = 20`, `MAX_RING_TARGETS = 3`, `reachable`), `lib/sales/calls/agentState.js` (`PRESENCE_STALE_MINUTES = 15`), `app/components/sales/IncomingCallDock.js` (`call.reject()`, not `disconnect()`), `app/api/rep-dial/inbound/route.js`, `app/api/sales/calls/answered/route.js`. Requires `FIELDQUO_SALES_TRANSFER_TO`; unset, `inboundPlan` speaks and hangs up before any rep is rung |
| §6 transfer and hold | `lib/sales/calls/transfer.js` (`TRANSFER_WARM`/`TRANSFER_COLD`, `conferenceMoveLeg`, `onTargetEnded` → returned/failed), `lib/sales/calls/queue.js` (`MAX_QUEUE_ROUNDS = 4`, `QUIET_PAUSE_SECONDS = 10`, `maxHoldSeconds()` ≈ 140s, no `<Enqueue>` and why), `app/components/sales/TransferControl.js` |
| §6 voicemail | `lib/sales/calls/voicemail.js` (`spoken(0)` → "no words spoken"), `app/sales/voicemail/page.js`, `app/api/sales/voicemail/[id]/audio/route.js` (proxied, `private, no-store`). `<Record>` is `maxLength: 120, transcribe: false` |
| §7 prospect → lead | `app/api/sales/leads/route.js` — reads the prospect rather than trusting the body, refuses another rep's claim (409) and a do-not-contact prospect (409), dedupes on `prospectId + salesRepId`, writes `SalesLead.prospectId`, carries `country`/`province`. Button at `app/sales/queue/page.js` |
| §8 email | `lib/sales/outreachReadiness.js` (blockers and warnings), `lib/sales/outreachSender.js` (`deliverOutreach` order; suppression before readiness; row after the provider id), `lib/sales/outreach.js` (`caslFooterLines`, `buildOutboundEmail` throws), `lib/sales/outreachPipeline.js` (`LEAD_STATUSES`, `statusAfterSend`), `lib/sales/outreachInbound.js` (routing by `replyToken`) |
| §9 texts | `lib/sales/salesSmsRules.js` (`signupLinkSmsBody` fixed, `replySmsBody` free, `salesSmsReadiness` blocker list), `lib/sales/smsWindow.js` (`SALES_SMS_WINDOW` 08:00–21:00 flat, `SALES_SMS_TIME_ZONES` — 10), `lib/sales/salesSms.js` (`salesSmsNumber` = oldest active `purpose: "sales"`; `deliverReplySms` requires an existing thread), `app/api/sales/messages/route.js` |
| §9 why shared | `lib/sales/repAdmin.js` — the A2P/10DLC argument, and the explicit retraction of the "a STOP would fragment" one. **Stale copy still in that file:** `NUMBER_CAPABILITIES.sms.detail` repeats the retired mechanism, and `NUMBER_CAPABILITIES.voice` says no model links a number to a rep although `PlatformSmsNumber.assignedRepId` exists with an assignment control at `app/api/platform/crew-lines/route.js` |
| §10 opt-outs | `lib/sales/suppression.js` (`suppress`, `unsuppress` — superadmin + reason, no delete), `lib/sales/suppressionRules.js` (`ALL_CHANNELS`, `emailLookupKeys` widening, `INTERNAL_DNC_RETENTION` 3y+14d), `lib/sales/outreachInbound.js` `detectOptOut` (visible text, first 3 lines, 20 phrases), `lib/sales/contactBasis.js` (provenance refusals) |
| §10 STOP blocks calls | `lib/sales/prospectView.js` `contactability(prospect, { suppression })`, fed by `app/api/sales/queue/route.js` (fails closed) and re-checked in `app/api/sales/calls/route.js`; `lib/sales/leadDial.js` for the lead screen |
| §11 check-ins | `lib/sales/checkin/signals.js` (`SCHEDULED_CHECKIN_DAYS = [1, 7]`, `SCHEDULED_MIN_GAP_DAYS = 3`, `SCHEDULED_GRACE_DAYS = 14`, `CHECKIN_REASONS` urgencies, six suppressions), `lib/sales/checkin/schedule.js` (no `scheduled` status, and why), `lib/sales/checkin/draft.js` (the gate on numbers, links, prices, emoji; metered to FieldQuo's own AI budget, not the tenant's) |
| §11 support | `app/sales/support/page.js`, `app/api/sales/support/*`, `lib/support/repClient.js`, `lib/support/escalation.js` (`SUPPORT_STATUSES`, `SUPPORT_PRIORITIES`, `assignedAdminFor`, `repVisibleNotes`) |
| §11 demo | `lib/sales/demoAssign.js` (`claimDemoForRep`, retry on `P2002`), `demoPool.js`, `demoGate.js` (`DEMO_GATE_WRITES`), `SalesRep.demoCompanyId` is `@unique` and write-once |
| §11 milestones | `lib/sales/commission.js` (`MILESTONE_ORDER`, `MILESTONE_LABELS` — note the stored value is still `first_payment` while the label is "Renewed"; defaults 2000/4000/6500 are Prisma column defaults and are per-plan), `qualifiesForActivation`, `qualifiesForBillingCycle`, the 60-day rule from `Subscription.createdAt`, `vercel.json` crons `20 9 * * *` and `7 10 * * 1` |
| §12 pay | `lib/sales/payoutDetails.js` (`PAYOUT_METHODS` — 5, `ENGAGEMENTS`, `payoutReadiness`, 180-day re-confirm), `lib/sales/payoutWrite.js` (`PAYOUT_WRITES_ON_SALES_REP`, masked audit line) |
| §13 language | `lib/sales/repLanguage.js` — `REP_LANGUAGE_OPTIONS` from `app/i18n/languages.js`, null means inherit and never "en", and the file's own honest statement of the partial translation. Verified by grep: `t()` appears in `app/sales/SalesShell.js`, `companies/page.js`, `invite/[token]/page.js`, `login/page.js` and nowhere else under `app/sales/` |
| §14 tour | `app/sales/tourSteps.js` (18 steps, all i18n keys), `app/components/sales/SalesTour.js` (null progress → renders nothing), `lib/sales/tourProgress.js`, `SalesRepTourProgress` declared in the schema and **not created** — `docs/ROADMAP.md` records the Neon 512 MB cap. Run `npx prisma db push` when there is room |
| §14 manager tier | `lib/sales/notes/visibility.js` — `HAS_REPORTING_LINE = true` (the column landed 2026-09-03) but `MANAGER_TIER_LIVE = false`; `lib/sales/team.js` `TEAM_LEAD_NOTE_VISIBILITY_FROM = null` is the owner's decision, not a code gap |

### Known drift in the code, found while checking this document

Not fixed here — this file is documentation — but recorded so it is not
rediscovered from scratch.

1. **`deliverReplySms` in `lib/sales/salesSms.js` checks `!result?.ok`, and
   `sendSms` in `lib/sms/twilioClient.js` returns `{ success, sid }`.** Every
   free-text reply is delivered and then reported to the rep as a 502, with no
   `SalesSmsMessage` row written. `deliverSignupLinkSms` gets it right in the
   same file. This is §14's second rough edge.
2. **`voicemailWhere` in `lib/sales/calls/voicemail.js` puts `ourE164` into a
   Prisma `where`.** There is no such column — `SalesCallAttempt` has `toE164`
   and `fromE164`. The clause is only added when the rep has an assigned
   number, so `/api/sales/voicemail` fails for exactly those reps. The audio
   route already maps `ourE164: attempt.fromE164` before calling `ownsVoicemail`.
3. **`lib/sales/dialSpace.js` has no `opted_out` state.** A prospect on the
   suppression list falls through to `DIAL_NO_NUMBER`, headed "No sales number
   yet." and inviting the rep to go and find one.
4. **The `worked` branch comment in `app/api/sales/queue/route.js` says the
   prospect "leaves the rep's active queue".** `queueWhere` matches
   `claimExpiresAt: null`, which is what `worked` sets, so it does the
   opposite. The UI copy and `claimState`'s `mine_worked` are both correct; only
   the comment is wrong.
5. **`lib/sales/callingWindow.js`'s header says "there is no outbound sales
   dialler in this repo — the telephony audit confirmed Twilio Voice is not
   wired at all".** It is wired: `app/api/sales/calls`, `app/api/rep-dial/*`,
   `lib/sales/calls/*`.
6. **`NUMBER_CAPABILITIES` in `lib/sales/repAdmin.js`** — both entries carry
   stale detail; see the §9 row above.
7. **`docs/sales/decks/train.js`** predates two changes and still teaches them:
   its check-in slide says the first touchpoint is day 3 with a ~15-day cadence
   (it is days 1 and 7), and its opt-out slide names "one gap" where the queue's
   handset link ignores the suppression list (the queue reads it now, failing
   closed). Its inbound slide also says a rep's own number shows on the
   contractor's handset, which the outbound path does not do — see the §5
   caller-ID row.
