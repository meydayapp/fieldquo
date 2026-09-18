# What the call data says, and what we did about it

Read on 2026-09-17, on the owner's instruction: four PDFs and a set of Gong
and Cognism articles, to be held against the cold-calling scripts in
`lib/sales/playbook/defaults.js`, the objection library in `objections.js`,
the moments in `moments.js`, and above all the model prompt in
`lib/sales/intel/callScript.js` — "make sure we make better AI instructions
for the script generation".

`docs/sales/SCRIPT-PRINCIPLES.md` is the reading of the textbooks (Saylor,
Futrell, Rackham, Cialdini, Godin) and the owner's twenty conversations. This
file is the reading of the *measured* material, and where the two disagree it
says which one won and why. The audience is contractors — painters, plumbers,
roofers — not the SaaS buyers the data was collected on, and every
"applies here" line below is an argument, not a citation.

`scripts/check-playbook-copy.mjs` and `scripts/check-call-script.mjs` pin the
decisions. This file is the reason; those files are the enforcement.

---

## 1. The sources, one by one

Three columns matter for each: what it claims, whether the claim is a
measurement or an opinion, and whether it survives the trip from a SaaS
buyer's desk to a contractor's van.

### 1.1 Gong, *3 Highly Effective Cold Calling Scripts* (PDF, 7 pages; also the gated template page)

Based on "100K cold calls" (p.1). The same material is the "bonus script" in
the longer Gong guide below (pp.17–21), word for word.

| Page | Claim | Kind | Number |
|---|---|---|---|
| 1 | Introduce yourself with your full name and company name — the next question is then yours, not "who is this?" | opinion (no figure) | — |
| 1 | "How've you been?" performs **6.6x** higher than calls that don't include it; it is a pattern interrupt | data (2019 set) | 6.6x |
| 2 | State the reason for the call: **2.1x** higher success | data | 2.1x |
| 2 | "Did I catch you at a bad time?" makes you **40%** less likely to book | data | −40% |
| 2 | "Did I catch you at a good time? If there is such a thing…" — "tactical apologies", humour | opinion | — |
| 2 | Successful calls are almost twice as long: **5:50** booked vs **3:14** not booked | data | 5:50 / 3:14 |
| 2 | Personalisation: "I know I'm calling out of the blue, but I was researching [company] and noticed [3x3]… Is this something your team is focused on?" | template | — |
| 3 | Limit open-ended questions — they require more work and the prospect does not yet know the effort is worth it; use simple ones ("Curious, have you heard of us before?") | opinion, stated as advice | — |
| 3 | Don't make assumptions; caveat with "I'm trying to put the pieces together…" | opinion | — |
| 3 | Social proof wrongly applied cuts win rates by **47%** in early-stage deals; pick logos from the prospect's "tribe" | data | −47% |
| 3 | The interest CTA ("does it make sense for me to give you more detail?") performs **2x** other CTAs — measured on cold *emails*, presented for calls | data, on email | 2x |
| 4 | Close: frame the ask as an offer; answer "what does it cost, what do I get, what do I need to do"; specific date | opinion | — |
| 4 | Get the meeting before you hang up: "do you have your calendar in front of you? I'm sending the invitation now, did you get it?" | opinion, mechanism argued | — |
| 5 | Objections: validate ("I totally understand if you're busy. When is a better time?"), label ("it sounds like I missed the mark"), secondary ask ("who is in charge of projects like this?") | opinion | — |
| 6 | Voicemail: name + company, reason, value prop, move to email | template | — |
| 7 | Follow-up email within five minutes of the voicemail | opinion | — |

### 1.2 Gong, *How to Master Cold Calls* (PDF, 7 pages; "300M+ cold calls")

The 2024 set, and the one that supersedes the 2019 opener figures where they
disagree.

| Page | Claim | Kind | Number |
|---|---|---|---|
| 2 | Connect rate: average rep **5.4%**, top rep **13.3%**; connects to meetings: **4.6%** vs **16.7%**; calls per meeting: **402** vs **45** | data | — |
| 2 | Cold calls that don't connect nearly double email reply rate: **1.81%** → **3.44%** | data | 1.9x |
| 3 | Opener success rates: "Did I catch you at a bad time?" **2.15%**; "How's it going?" **7.6%**; permission-based **11.18%**; "Heard the name tossed around?" **11.24%** | data | see left |
| 3 | The permission talk track: "…I'm gonna be honest, this is a cold call, but it is a well-researched one. Can I get 30 seconds to tell you why that press release prompted me to call you specifically, then you can tell me whether or not it makes sense for us to speak?" | template | — |
| 3 | "How's it going?": "You don't really care about their day, and they know it too" | opinion (with the 7.6% beside it) | — |
| 4 | Pitch language: buzzwords **5.5%**; social proof **12%**; problem language **16%** | data | see left |
| 4 | Objection taxonomy: dismissive (not interested, call me in 6 months, send info, not my responsibility, where'd you get my number, I'm in a meeting, is this a cold call, hang-up); situational (too expensive, no budget, no bandwidth, product fit); existing solution (in house, competitor, stuck in a contract) | classification | — |
| 5 | Most common: not interested **17%**, hang-up **17%**, no budget **16%**, product fit **13%**, not my responsibility **11%** — the top five are **74%** of all objections, most are brush-offs at the interruption itself | data | 74% |
| 5 | Median successful call **4.8 minutes**; you handle a minimum of **2** objections to land the meeting; success by minute rises to 24–30% past minute eight | data | 4.8 min |
| 5 | A gatekeeper reduces the chance of success by **39%**; dial off-hours or mobiles to avoid them | data + advice | −39% |
| 6 | A voicemail cuts the connect rate on later dials by **28%** (5.17% vs 7.18%) but nearly doubles email reply (2.73% → 5.87%) | data | −28% / 2.1x |
| 6 | Best time: the morning (8–10am connect 7.2–8%) | data — contradicts Gong's 2019 "11–12 and 4–5" | — |
| 6 | Connect chance by attempt: 7.1, 7.2, 6.3, 5.9, 5.0% — "after 5 dials, your chance of connecting begins to drop significantly"; leave 1–2 voicemails then rotate numbers | data + advice | 5 dials |

### 1.3 Gong, *9 Secret Elements of Highly Effective Cold Calls* (PDF, 22 pages; "100k cold calls")

Fetched as the source of the talk-ratio and monologue figures the brief named.

| Page | Claim | Kind | Number |
|---|---|---|---|
| 3 | Risk-reversal language improves win rates by 32% ("try it for 30 days with no obligation") | data, not cold-call specific | — |
| 6–7 | Full name + company; no "bad time" (−40%); "how've you been" 6.6x; say why you're calling 2.1x | data (same set as 1.1) | — |
| 8 | Optimal talk-to-listen for sales calls generally is 43:57; for successful *cold* calls it is **55:45** — "you're there to educate the buyer, not learn about them". Longest burst in successful calls **37 seconds**; shortest 25. Successful sellers monologue (5+ seconds) 20 times vs 12 | data | 55:45 / 37s |
| 9 | "Zero statistical difference in the number of questions asked on successful and unsuccessful cold calls." Sell the meeting, not the product; do the research beforehand | data | — |
| 10 | Take the burden: talk for up to 55% of a cold call | data | 55% |
| 11 | Successful calls 5:50 vs 3:14; craft a response to each conversational path (no time, not interested, no budget) | data + advice | — |
| 12 | "We" used **35%** more and "our" **55%** more in successful calls than "I"/"my" | data (correlational) | +35% / +55% |
| 13 | "Do you have your calendar handy?" — the closing question their data found; set a date then and there | data-derived | — |
| 14 | Wednesday and Thursday, **49%** better booking; 11am–noon and 4–5pm | data (2019; contradicted by 1.2 p.6 on the hour) | — |
| 15–16 | Cold email: interest CTA 30% vs 13% open-ended vs 15% specific; ROI language −15%; ~150 words beats 30 | data, on email | — |

### 1.4 Gong blog, *The best and worst cold call openers* (300M calls)

The same four openers as 1.2 p.3 with the same four numbers (2.15 / 7.6 /
11.18 / 11.24), plus the framing: lead with context, own the cold call, ask
permission; avoid apologetic framing. Nothing beyond the PDF. The
"cold-calling-scripts" template page is a form gate; the PDF (1.1) is its
content. The *Cold Calling Statistics* post restates 55% talk share, 53-second
average longest monologue (vs 25), "we" **65%** more — a third figure for the
same effect, which is a reason to treat the pronoun finding as "direction
right, size uncertain".

### 1.5 Cognism, *SaaS sales cold calling — one pager* (PDF, 2 pages)

"Cognism's proven formula for booking an enterprise demo every single day."
No data. Seven elements: intro, then ask "is now a bad time?" ("the prospect
will naturally want to say no, giving you an in"); opening pitch with company
context; discovery; second pitch off the discovery; value ("why current
clients switched"); case study; close ("suggest your cold call is a waste of
the prospect's time — wouldn't they rather see a demo?"). Ten tips: say the
prospect's name a lot; repeat what they say back; lead with a differentiator;
warm tone; ask how/why/what questions; don't ask closed questions; outcomes
not features; refer to similar customers; case studies from peers; evolve the
script.

Opinion throughout. Three of its recommendations are contradicted by Gong's
measurements ("is now a bad time", open questions, case studies), and two are
refused on principle below (say the name a lot; peer customers).

### 1.6 Close, *Sales script template* (PDF, 2 pages)

The founder's 2013 script. Opening: "I'm calling some startups in the area to
find out if they are a good fit for our product… What we do in a sentence is…
Does this in general sound interesting to you?" Qualifying: decision process,
current process, customers, how they solve it now. Test close: "we would want
to start in X weeks — does this work for you?" Next steps: brochure + a time
next week. Opinion, one company's anecdote (seven paying customers in
fourteen days). Two things carry: "to find out whether it's a fit" is an
honest reason-for-the-call that concedes it may not be; "what we do in a
sentence" is the right length for a stranger. "Does this sound interesting?"
is a yes/no opener and is refused.

### 1.7 Cognism, *Ultimate cold calling script for SaaS sales* (Joe Barron, 2025)

Four steps: introduction ("How's your day going?" and a thirty-second time
constraint "to demonstrate respect for the prospect's time"); value
proposition ("we've found that 89% of SMBs are struggling with…"); qualifying
questions, open who/what/how; next steps (trial, demo, case study). Data
cited: 57% of C-level buyers prefer phone (Cognism internal); 5,265 of 9,247
connects became conversations; CEOs are the most receptive. Objections: "send
me an email" → clarifying questions; "no time" → a two-minute window; "need
to consult others" → get the meeting details.

The time-constraint opener is Saylor's banned promise. The 89% line is an
invented-statistic template and would fail the digit rule anyway.

### 1.8 Cognism, *State of Cold Calling* (2024 report)

**55,701 dials**, 9,247 connects, 5,265 conversations, 254 meetings: **4.82%**
of conversations (from 2% in 2023). Average call length **83 seconds**; only
**31%** get past the pitch. **3** is the optimal number of attempts; ~75% of
pickups happen on the first. Commonest objections in order: I'm busy; not
interested / no problem; wrong person (**27%** of call endings); send me an
email; "not interested" ended 30% of calls. Best times 11am and 2pm; best day
Thursday; Friday lowest. The expert contributions round it are opinion.

Data, on one company's own SDR floor selling to B2B. The ordering of
objections is the useful part: "I'm busy" first, and "wrong person" at more
than a quarter of endings.

### 1.9 Cognism, *Get past the gatekeeper* (Ilse Van Rensburg)

Eleven tips, no data: use mobiles; research; be polite; show respect; don't
pitch; stay calm; sound confident; be honest; use the prospect's first name;
show empathy; call early or late. The definition is the useful line —
gatekeepers "include receptionists, personal assistants, secretaries,
**spouses and relatives**". Of its ten talk tracks, three are honest and
taken (ask the gatekeeper's opinion on fit; "could you please help me out, I'm
not sure who the best person to speak to would be"; give less information —
"could you put me through, can you tell them [name] is calling about
[topic]"). Two fabricate a history and are **refused**: "how was your son's
football match? I remember you mentioning it last time I was in the office",
and "I'd like to follow up on an email I sent earlier this week". A rep put
through to somebody who asks which email has lost the call and the
relationship in one sentence, and the earlier reading of Cognism
(SCRIPT-PRINCIPLES §5a) already refused the same line.

### 1.10 Cognism, *Sales tactics* / *Outbound sales* / *What is B2B sales*

Strategy pieces for managers: LinkedIn brand, discovery as free consultation,
triggers, group calls (Gong: more buyer-side attendees, higher win rates),
metrics. The one talk track is Mike Weinberg's "I head up new business at
[company], and lately [target type] come to us saying they're tired of
[pain]…" — social proof by implication, and refused here for the same reason
as every other peer-customer line. Nothing else touches a script. Recorded so
the reading is complete; nothing taken.

### 1.11 Cognism, *Cold calling scripts* (Van Rensburg / Frida Ottosson)

Five scripts. Gatekeeper opening "Hi, it's [name] from Cognism. Is [prospect]
available?"; "I'll keep it brief…"; "How are you generating new leads?";
close "Have you got 15 minutes free later this week?". The SaaS script:
"How are you?" and "Is this a bad time?". The enterprise script opens "This is
a well-researched B2B sales call" — Gong's own permission line. The 70/30
rule (prospect talks 70%) is stated as guidance; the "$0 to $4M ARR"
framing is company history, not a study. **The 70/30 rule is opinion and
Gong's 55:45 is a measurement on 100k calls**; see decision D5.

### 1.12 Cognism, *Perfecting your sales pitch* (Barron)

Nine-stage pitch structure; benefits over features; "in a perfect world, a
sales pitch sounds simple and human"; elevator pitch 30 seconds to 2 minutes.
No sourced statistics. Taken: benefit before feature (already Saylor's), and
the length band, which agrees with Gong's thirty-seven seconds.

### 1.13 Cognism, *Sales objections* (Van Rensburg) and *Cold call objections* (Reisert / Ivanova)

Twenty objections listed (long contract, competitor, competitor price, no
ROI, not interested, busy, data source, unknown company, complexity, budget
elsewhere, next quarter, price, missing features, comparison quotes, happy
with current, team too small, disconnection, send an email, negative review,
voicemail). Framework: prepare → listen → understand → validate → act → plan
→ confirm. The cold-call piece lists nine, with the responses that carry:
"send me an email" → "what in particular would you like me to include?";
competitor → "rate your experience out of ten — what would make it a ten?";
busy → **"I will be really quick — I promise!"** (refused: Saylor's promise,
`bannedMoves.js` catches it). Statistics: Gartner's 77% "last purchase was
complex", Challenger's buying group of 6 → 12 — enterprise figures that do
not describe a one-van business. The buyer's pyramid (3% buying now, 7% open,
30% not thinking about it, 60% not interested) is a heuristic, unsourced.

### 1.14 Cognism, *Objection handling* (Van Rensburg)

Five steps: **listen → ask open-ended questions → solve → confirm → move on**.
Examples: time ("all I'm asking for is 30 seconds" — Morgan Ingram); not
interested ("typically when I talk to sales directors they're struggling with
these three things…"); **"Is this a sales call?" → "this actually is not a
sales call. The reason for this call is to see if you're interested in
getting on a sales call."** Refused: it is a sales call, and a rep who opens
with a lie has nothing left to be believed about. The five-step shape is
taken, with one change: the clarifying question is asked only when the
objection is vague, because a cold call does not have room for a discovery
question after every brush-off.

### 1.15 SurveySensum, *Open-ended vs closed-ended questions*

A survey-design article, no field data. Open questions give reasons and
nuance and cost the respondent effort; closed questions (yes/no, scale,
multiple choice) are fast and unambiguous. Recommendation: closed first,
open to follow. What carries to a phone call: a **leading question with the
answers in it** is a multiple-choice question — fast to answer, and the
answer is a correction, which is the owner's own finding about how a
contractor talks to a stranger (SCRIPT-PRINCIPLES §7). Gong's "limit
open-ended questions" is the same advice from the field side. Cognism's "ask
how/why/what" is the opposite advice, unmeasured, and belongs to the fifteen
minutes rather than the cold call.

---

## 2. Evidence against opinion — the short table

| Finding | Evidence? | Where |
|---|---|---|
| Permission opener 11.18%, bad-time 2.15%, how's-it-going 7.6% | yes, 300M | Gong 1.2 p.3 |
| "How've you been" 6.6x | yes, 90k (2019); superseded in ranking by 1.2 | Gong 1.1 p.1 |
| Reason for the call 2.1x | yes | Gong 1.1 p.2 |
| Rep talks 55%, longest burst 37s, questions make no difference | yes, 100k | Gong 1.3 pp.8–10 |
| Problem language 16% vs social proof 12% vs buzzwords 5.5% | yes | Gong 1.2 p.4 |
| Top five objections = 74%; ≥2 objections per booked meeting; median 4.8 min | yes | Gong 1.2 p.5 |
| Gatekeeper −39% | yes | Gong 1.2 p.5 |
| Voicemail −28% connect, ~2x email reply; five-dial cliff | yes | Gong 1.2 p.6 |
| "We"/"our" +35%/+55% (or +65%) | correlational, three different sizes | Gong 1.3 p.12, blog |
| Calendar-handy close | data-derived, no figure given | Gong 1.3 p.13 |
| 4.82% conversations → meetings; 83s average; "I'm busy" first; wrong person 27% | yes, 55k dials, one floor | Cognism 1.8 |
| 70/30 talk ratio | no — guidance | Cognism 1.11, 1.14 |
| "Is now a bad time?" as an in | no — and contradicted by Gong | Cognism 1.5 |
| Say their name a lot; peer case studies; "not a sales call"; "I promise I'll be quick" | no | Cognism 1.5, 1.13, 1.14 |
| Closed-first questions | reasoning, not field data | SurveySensum 1.15 |

---

## 3. What applies to a contractor, and what does not

The data was collected on reps calling office workers with calendars in front
of them. Four translations are needed before any of it is a rule for a call to
a roofer.

1. **The prospect is on a ladder, not at a desk.** Gong's "successful calls
   are longer" and "55% rep talk" describe a buyer who can stay on the line.
   A contractor on site cannot, and the owner's transcript shows how the
   opener earns the second minute: permission, one question about his own
   day, the reason attached to his answer. Length is the *result* of a call
   going well, not something a script can buy. What carries is the shape —
   the rep carries the conversation once permission is given, in bursts, and
   does not interrogate.
2. **"Not my responsibility" is a different sentence at one to twenty
   people.** In the enterprise it means "wrong department". At a plumbing
   company the person who "just answers the phone" is the spouse or the
   bookkeeper who also types the quotes up in the evening — the user this
   product is for. So the gatekeeper line sorts the apprentice from the
   office before asking to be handed on (decision D10).
3. **Social proof is barred here whatever the data says.** Gong has it at
   12% and warns it collapses outside the prospect's tribe; non-negotiable 8
   forbids quoting one tenant to another regardless. The data and the rule
   agree on the replacement: describe *their* problem.
4. **The voicemail and dial-count figures are about the rep's own
   number.** Gong's "rotate numbers" is not something a rep does by hand
   here; the dialler and the retry pool own attempts. What carries is the
   advice to the rep: one or two voicemails, then let the email carry the
   sequence, and treat the sixth dial as the next name.

---

## 4. Where the data contradicts the current playbook

| Current playbook | The data | Verdict |
|---|---|---|
| Reason for the call deferred one beat, delivered in `relevance` as the PIVOT after the contractor's answer (owner's 2026-09-10 correction) | Gong: stating the reason is 2.1x; their template puts it in sentence two | **Both kept, on different surfaces.** The rules playbook keeps the owner's shape — the reason is stated inside the first minute, on his own words, which is the strongest reading of Langer. The AI script, which has a cited detail per prospect, states the reason *in* the opener in Gong's tailored-permission form. Decision D4. |
| Permission ask "Can I give you thirty seconds on why I called?" | Gong's permission talk track ends "…then you can tell me whether or not it makes sense for us to speak" | The handover goes into the AI opener ("then you tell me if it's worth talking"). The rules constant stays as the owner wrote it — the QA scorecard keys on it. D1. |
| No "how are you" anywhere, on Saylor's insincerity finding | "How've you been" 6.6x (2019); "how's it going" 7.6% vs permission 11.18% (2024) | **Not adopted, not banned.** The permission opener measured higher in the larger, later set, and the phrase claims an acquaintance a cold caller does not have. The data will not support a ban either, so `bannedMoves.js` does not gain one. D2. |
| "The prospect should be doing about seventy per cent of the talking" (PLAYBOOK.md §3, from Cognism) | Gong: successful cold calls have the rep at 55%, longest burst 37 seconds, and the number of questions makes no difference | **Replaced.** 70/30 is guidance; 55:45 is measured. The 70/30 rule is for the fifteen minutes. D5. |
| Three-question discovery block, current-process block, pain block — nine stages on a cold call | Gong: sell the meeting, not the product; do not use the cold call to learn about them | The nine stages stay — they are the owner's design and the owner's corpus says dialogue won — but the AI script's pitch is now the thirty-five-second burst, the questions come after it, and the instruction says the call's job is fifteen minutes on a screen. D5, D6. |
| Close: "What works better for you, mornings or afternoons? I'll send the invite and a reminder the night before." | Gong: "do you have your calendar handy?" and send the invite before you hang up | **Adopted.** `CLOSE_ASK` now asks for the calendar and sends the invite while they are on the phone; `NextSteps.js` can do that from the call panel. D9. |
| Objection library: twenty, none for "I'm busy", "wrong person", "is this a sales call", "never heard of you" | Gong: top five are 74%, "not my responsibility" 11%; Cognism: "I'm busy" first, wrong person 27% of endings | **Four added.** D8. |
| Gatekeeper moment: "Is {businessName}'s guv about?" — one path | Cognism: spouses and relatives are gatekeepers; Gong: −39% | **Rewritten** for the apprentice, the office and the spouse; "guv" gone. D10. |
| AI script not swept for banned moves | Gong: bad-time opener 2.15% | The voice lint now runs `bannedMovesIn` over every spoken sentence. D11. |
| No buzzword rule | Buzzwords 5.5% vs problem language 16% | New `buzzword` move; the prompt names the words. D7. |
| Opener need not name FieldQuo (the first live v2 script for SE-ME Roofing said "My name's Muhammad and I went through your website") | Gong: full name and company up front | The validator now refuses an opener without FieldQuo. D12. |

---

## 5. The decisions

**D1 — The rules opener stands: name, FieldQuo, the recording aside, the
candour line, the permission ask.** It *is* Gong's permission-based opener
(11.18%), one clause of which — "I know I'm catching you out of nowhere" —
is the honest pattern interrupt. `PERMISSION_ASK` is unchanged; the handover
Gong's talk track ends on goes into the AI opener instead, because the QA
scorecard and four checks key on the constant and the owner wrote it.

**D2 — "How've you been?" is neither scripted nor banned.** Reasons in §4.
The model prompt says "do not ask how they are" as an instruction, because a
model reaching for warmth reaches for exactly that line, and names the
permission opener as the pattern interrupt to use instead.

**D3 — "Did I catch you at a bad time?" stays banned, now with Gong's
number on the entry.** Saylor and Gong agree from opposite ends. Cognism's
one-pager recommends it; refused.

**D4 — The reason for the call.** Rules playbook: the PIVOT, inside the
first minute, on the contractor's own answer — the owner's correction is a
stronger reading of Langer than sentence two, and it is not touched. AI
script: `The reason I'm calling is…` in the opener, on a cited detail, in
Gong's tailored-permission shape — the per-prospect script has the detail the
rules script does not, which is the one thing that makes stating the reason
early work. `CALL_SCRIPT_REASON_LINE` is asserted in the prompt.

**D5 — Talk ratio and the thirty-five-second pitch.** `whyThemNow` is now a
pitch of 60–110 words the rep says in one go, validated by word count
(`pitchWords`), because the first live v2 scripts wrote two sentences of
about forty-five words — the under-twenty-five-second pitch Gong's data says
halves the odds. PLAYBOOK.md's 70/30 line is replaced with 55:45 for the cold
call and 70/30 for the demo. The QA scorecard's talk-ratio band should move
with it (§8).

**D6 — Questions are leading, with the answers in them, and come after the
pitch.** Saylor's ladder, Gong's "limit open-ended questions", SurveySensum's
closed-first, and the owner's corpus all point the same way. Open how/why
questions are for the fifteen minutes. The prompt says so in words with an
example.

**D7 — Problem language, no buzzwords, no other customers.** A `buzzword`
move in `bannedMoves.js` (all-in-one, single source of truth, revolutionise,
game-changer, seamlessly, end-to-end, cutting-edge, best-in-class,
next-generation, streamline, synergy). "Seamless" alone is not in it — it is
in prospects' business names. "Platform" and "solution" are banned in the
prompt's words but kept out of the regex because an objection *label* says
"another platform".

**D8 — Four objections added:** `IM_BUSY_RIGHT_NOW`, `WRONG_PERSON`,
`IS_THIS_A_SALES_CALL`, `NEVER_HEARD_OF_YOU`. Written in the owner's register
(contractions, short sentences) because they are said in the first thirty
seconds. Two recommended moves refused by name: "I'll be really quick, I
promise" and "this is not a sales call". The AI prompt's objection shape is
Cognism's five steps — acknowledge, clarify when vague, answer, check it
landed, next step — and it always writes the two commonest brush-offs.

**D9 — The close gets the invite sent on the line.** `CLOSE_ASK` gains "Have
you got your calendar handy? I'll send the invite while we're on the phone".
The outgoing fingerprints of all four playbooks are in `seedHistory.js` so
"refresh the built-ins" reaches the live rows.

**D10 — The gatekeeper is three people.** The moment now opens with "is that
the owner, or is that you?", has a line for the apprentice (get the owner's
name, honestly, for next time), a line for the office or the spouse (are you
the one typing the quotes up?), and notes carrying Gong's −39%, the mobile-
first advice, and the point that the office may be the user. The AI script
gains `ifSomeoneElseAnswers`, written per prospect so it can ask for the
owner by the first name the site inference found. "Following up on an email"
and the invented football match are refused, as before.

**D11 — The generated script is swept for banned moves.** Rule 8 in
`scriptVoice.js`: every spoken sentence runs through `bannedMovesIn`, the
prospect's own `they` lines and the rep's `doNotSay` list excepted, and a hit
is quoted back on the retry with the move named. The table is English; a
French or Spanish script passes through untouched, which is written down
rather than pretended.

**D12 — FieldQuo is required in the opener.** `no_company` in the validator.

**D13 — "We" and "our" for the product, "I" for the ask.** Gong's finding is
correlational and its size is reported three ways, so it is a style rule
with an example rather than a lint: a contractor hearing "we" for the request
("can we take thirty seconds") hears a company; hearing "I" for the product
("I build the quote") hears a rep overclaiming.

**D14 — Refused, by name, from the sources:** "is now a bad time?" (Cognism
1.5); "say the prospect's name a lot" (Cialdini's manufactured liking, and
Godin's robocall tell); peer case studies and "customers like you"
(non-negotiable 8, and Gong's own −47%); "suggest your call is a waste of
their time" (Saylor's time-wasting opener in a close); "I promise I'll be
quick"; "this actually is not a sales call"; "following up on an email" and
the football match; "does this in general sound interesting to you?" (Close —
a yes/no opener); Gong's "send the follow-up email within five minutes" (our
email carries an attachment built after the call; the same-day text does the
five-minute job).

**D15 — Timing is noted, not scripted.** Gong 2019 says Wed/Thu, 11–12 and
4–5; Gong 2024 says mornings; Cognism says 11 and 2, Thursday. They disagree
with each other and none of them measured a trade. `callWindowScore.js`
already learns the answer per prospect from outcomes; that is the right
place.

**D16 — The experiment to run.** `lib/sales/playbook/experiments.js` exists
for this. Hypothesis to register when the floor has volume: *for the
competitive-displacement playbook, an `open` stage that states the reason in
its second sentence (Gong's shape) books no more fifteen-minute demos than
the owner's question-first shape.* Counts only; no winner declared, per the
module's own policy.

---

## 6. The gatekeeper, for the sales floor

Who picks up at a plumbing company, and what to say to each:

| Who | How you can tell | What to say | What you want |
|---|---|---|---|
| **The apprentice / somebody in the van** | Phone on speaker, engine noise, "he's on a roof" | "No problem. When's he easiest to catch — first thing before you're on site, or the end of the day? And what's his name, so I'm not asking for the boss next time?" | A time and a first name. Nothing else. |
| **The office** — spouse, bookkeeper, a relative | "Can I ask what it's regarding?", a landline, daytime | "Then you might be the one I should be talking to. When a quote goes out, is it you typing it up, or does it land on him in the evening?" | To find out whether this *is* the user. If it is, run the quote-automation questions with them. |
| **The spouse at home** | The mobile answered by somebody else, evening | The same line as the office. | Same. |
| **Anyone asking what it's regarding** | — | "It's about how a quote gets from the driveway to the customer. I've not spoken to him before — I read your website this morning and rang off the back of it. Is he the one who prices the work, or is that somebody else?" | The honest subject, and confirmation you have the right name. |

Rules, from the data and the principles:

- A gatekeeper cuts the odds of a meeting by about two-fifths (Gong). Where
  the listing has a mobile, dial that first. Where it has not, the first and
  last slots the calling window allows are when an owner-operator answers
  his own phone.
- Never say he is expecting the call. Never say you are following up an
  email. Never claim to have been in the office. All three are in Cognism's
  talk tracks and all three are lies that the next sentence exposes.
- Do not pitch the apprentice. He cannot buy and does not want to hear why
  it is good. A name, a subject, a time.
- Ask for the owner's first name; do not pretend to know it. The site
  inference often supplies it, and the AI script's `ifSomeoneElseAnswers`
  line uses it when it does.
- If the person who answered is the one who types the quotes, stop treating
  the call as blocked. That is the person the evening at the kitchen table
  happens to.

---

## 7. What changed in the scripts — before and after

**The rules opener (`OPENER`)** — unchanged:

> Hi — is that {businessName}? {repName} here, from FieldQuo — quick heads-up, this call may be recorded. I know I'm catching you out of nowhere, and you've never heard of me. Can I give you thirty seconds on why I called?

**The AI opener example (`CALL_SCRIPT_STYLE_EXAMPLE`)** — before:

> Hi — is that South County Electric, LLC? My name's Daniel and I'm from FieldQuo — quick heads-up, this call may be recorded. I'm calling because I've been through your website and we noticed a few things that are missing that could help you bring in more clients and book more jobs. Do you have a few minutes so I can show you how?

After:

> Hi — is that South County Electric, LLC? My name's Daniel and I'm from FieldQuo — quick heads-up, this call may be recorded. I'll be straight with you, this is a cold call, but I've read your website. The reason I'm calling is your site promises a same-day quote, and I wanted to ask how it gets to the customer. Can I take thirty seconds on why, and then you tell me if it's worth talking?

What moved: the owner's first sentence is verbatim; "I'm calling because I've
been through your website and we noticed a few things missing" became an
honest cold-call admission plus a *specific* reason on a cited detail (the
generic "a few things that are missing" is the sentence a model writes for
every prospect); "Do you have a few minutes so I can show you how?" — a
yes/no question asking for minutes before a reason — became a thirty-second
ask that hands the decision back.

**The reason line** — before: none required; the v2 prompt said "say what we
noticed in plain words and the benefit". After: `The reason I'm calling is…`
required in the opener, on a detail from their site or the inferences.

**The close (`CLOSE_ASK`)** — before:

> What works better for you, mornings or afternoons? I'll send the invite and a reminder the night before.

After:

> What works better for you, mornings or afternoons? Have you got your calendar handy? I'll send the invite while we're on the phone, and a reminder the night before.

**The gatekeeper opening** — before: "Morning — it's {repName} from FieldQuo.
Is {businessName}'s guv about?" After: "Morning — it's {repName} from
FieldQuo. Who's the best person to talk to about how the quotes go out — is
that the owner, or is that you?" plus the apprentice and office lines above.

---

## 8. What the QA scorecard should measure differently

`lib/sales/calls/qa.js` (another agent's, not edited here) scores a recorded
call against the playbook. Given the above:

1. **`TALK_RATIO_BAND` {0.35, 0.6}** is a discovery-call band. For a cold
   call Gong's successful band centres on the rep at 55%; a band of roughly
   0.45–0.65 for calls under six minutes, and the current band for the
   fifteen-minute demo, would score the shape the prompt now asks for
   rather than penalising it.
2. **Longest rep burst.** Add a deterministic measure: the longest
   uninterrupted rep segment in seconds. Under 25 seconds is the pitch the
   data says halves the odds; 30–40 is the target. The transcript segments
   already carry the timings.
3. **The reason for the call, timed.** The scorecard reads the pivot; it
   should also read whether *any* reason was stated inside the first sixty
   seconds (the rules script) or inside the opener (the AI script), since
   that is the 2.1x finding.
4. **Objections handled, counted.** The median booked call handles two.
   Count objections heard and answered; a booked meeting after zero
   objections is rare enough to be worth a flag as an anomaly rather than a
   perfect score.
5. **Banned moves on the AI script, not only the transcript.** The scorecard
   runs `bannedMovesIn` over the rep's lines; the generated script the rep
   was reading is now swept the same way before it is stored, so a hit on the
   transcript that is *not* in the script is the rep's own words, and the
   coaching sentence can say so.
6. **The calendar question and the invite.** `CLOSE_ASK` changed; the
   `closeAsk` read should look for "calendar handy" and for the invite being
   sent during the call (a `SalesEvent` created inside the call's window),
   not only the mornings/afternoons choice.
7. **Gatekeeper outcome.** Whether the first speaker was the owner, and if
   not, whether the rep got a name and a time (two of the three lines above
   end in one). Today the scorecard has no gatekeeper read at all.
8. **Buzzwords** are now a banned move and will show up in the deterministic
   half with no change needed; the coaching prompt should name the
   replacement (problem language) rather than only the fault.

---

## 9. What was not done, and why

- ~~The twenty existing objection responses are written without contractions
  ("I am not going to") while the model prompt and the four new answers use
  the owner's spoken register.~~ **Done 2026-09-18.** All twenty were
  rewritten in the spoken register — contractions, a sentence under thirty
  words, no "rather than" — in the acknowledge → clarify → answer → confirm
  shape, substance unchanged; the twenty outgoing fingerprints are in
  `seedHistory.js` and `refreshBuiltIns` was run against production (20
  updated, 0 kept back).
- No experiment row is seeded. Experiments are created in the platform
  console with a written hypothesis (`experiments.js`); D16 is the one to
  create.
- The talking-point prompt in `generate.js` was not rewritten; it already
  forbids buzzwords in words ("no marketing adjectives, no 'leverage', no
  'solution'") and its output is a sentence inside `fit`, not an opener.
