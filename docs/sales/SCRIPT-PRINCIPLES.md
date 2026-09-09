# What the books say, and why each rule is in the script

The cold-call scripts in `lib/sales/playbook/defaults.js` and the system prompt
in `lib/sales/playbook/generate.js` were rebuilt from source rather than
written from an impression of what a sales call sounds like. The first version
of both was written the second way, and it reproduced — almost line for line —
the openers the standard textbooks name as failures.

This file exists so the reasoning survives the next rewrite. If you are about
to change a line, the finding it rests on is here. Argue with the finding, not
with the sentence.

`scripts/check-playbook-copy.mjs` enforces the parts of this that can be
enforced mechanically. It cannot tell whether a concession is true; it can only
tell that one is still there.

---

## The sources

| Source | What it contributes |
|---|---|
| Kimberly Richmond, *The Power of Selling* (Saylor / Flat World, open text) | The approach chapter (ch.9): the Six Cs, the timing, the named openers, the banned phrases, the permission question. Ch.13: the follow-up arithmetic. |
| Charles M. Futrell, *Fundamentals of Selling*, 12e | The Right to Approach; questions beat statements; the direct-negative-no rule; forestalling; the twelve keys to a close. |
| Will Barron, *Selling Made Simple* | The single goal of outreach; micro-closing; diagnosis before pitching. |
| Neil Rackham's SPIN, as carried by Saylor ch.10 | Situation questions sparingly; implication questions with a number attached; benefits beat advantages, and only after investigation. |
| Robert Cialdini, *Influence* | What is honestly available to a stranger in ninety seconds, and what is counterfeit. |
| Seth Godin, *This Is Marketing* | Frequency, locality, tension-not-fear, and the arithmetic that licenses outbound at all. |
| The owner's twenty TrueFinish conversations | How these buyers actually behave, with the outcomes known. |

---

## 1. The call has one job: earn the next conversation

Barron's rule for the whole cold-outreach stage is that its only goal is to
book the follow-up meeting — no product pitches, no pricing discussion, no
further analysis of the buyer's problems. Saylor says the same from the
classical side twice over: the goal of a cold call is to work out whether the
prospect's needs match your solutions, **not** to close; and "you are not
selling during the approach."

Saylor's pre-call chapter (ch.8 §3) makes the objective concrete: the framing
question is "what will success look like for this call?", and the answer is
usually not a sale. A successful complex-sale call is any call that ends with an
action that moves the sale forward.

**In the script:** every `next_step` stage asks for one small, dated thing and
nothing else. No stage quotes a price. Nothing asks for a decision.

## 2. Fifteen seconds, twenty seconds, thirty seconds

Saylor ch.9 §1, quoting Tonya Murphy: "you only have fifteen seconds to win
over the customer." The telephone do's in ch.9 §2: give your name and the
purpose of the call **within the first twenty seconds**, because prospects
decide their interest immediately. Ch.7 §3, on cold calling specifically:
establish a connection **in the first thirty seconds**.

**In the script:** every `open` stage is name → company → the reason for this
particular call → permission. Read aloud, each runs about fourteen seconds.

## 3. Give a real reason — and know why "because" alone is not enough

Ellen Langer's photocopier experiment, as Cialdini reports it in ch.1:

| Request | Compliance |
|---|---|
| "I have five pages. May I use the Xerox machine?" | **60%** |
| "…because I'm in a rush?" | **94%** |
| "…because I have to make some copies?" | **93%** |

The third condition adds no information at all, and performed
indistinguishably from the real reason. Cialdini's reading is that the word
*because* is doing the work.

**The limit that is almost always dropped when this is retold**, and the reason
it matters here: Cialdini's book reports only the five-page version. In Langer,
Blank & Chanowitz's own paper the request was also run at **twenty pages**, and
at that size the placebic reason stopped working and fell back to the no-reason
level. Only the genuine reason still lifted compliance. When the cost of saying
yes is real, people process the content of the justification rather than its
form.

A meeting is a twenty-page ask. So a reason is mandatory and a vacuous one is
worthless.

**In the script:** every opener says *because*, and what follows it is a fact
about that specific business that we actually observed — a website we read this
morning, a search we ran, a contact page we looked at.

## 4. Credibility is bought with research, not credentials

Saylor ch.8, quoting Jeff Thull: "it's not what you know about your company and
your product that will impress your customer; it's what you know about your
customer and his situation." And Thomas Freese: "without credibility, sellers
won't even get a chance to take a swing at the ball."

The book's cleanest illustration is Ben Duffy in 1946, who asked himself what
questions he would have if he were the president of American Tobacco, wrote
fifty, cut them to ten — and found the prospect had independently written a
nearly identical list, seven of ten matching. He won the account.

Saylor's **customer benefit approach** is built on it, and the structural point
is that the *second* sentence is the one that proves the research happened.

**In the script:** the `relevance` stage of every playbook is the researched
sentence, and it is a fact from the crawl rather than a compliment.

## 5. Ask permission — and phrase it so YES is the helpful answer

Saylor's telephone do's include asking "**Is this a good time?**", because
asking permission builds trust and hands the prospect control. The matching
don't is sharper: never ask "**Did I catch you at a bad time?**" — the prospect
will simply agree, and agreeing ends the call. Ask whether it is a *good* time
and a yes works in your favour, while the only reason for a no is a real one,
which leaves you positioned to propose a specific alternative slot.

Rackham's SPIN opening, via Saylor ch.10 §4, makes the same move at the next
stage: the most important element of the opening is getting the customer's
agreement to let you ask questions.

**In the script:** every opener ends with "Is this a good time?", and every
`discovery` stage opens by asking permission to ask.

## 6. The banned openers, each with the reason it fails

Saylor ch.9 §2 and Futrell ch.10, collected:

- **"Would you be interested in saving money?"** — puts people on guard; reads
  as an obvious ploy.
- **"You're probably busy, so I promise I'm not going to waste your time."** —
  mentioning time-wasting up front suggests you are somebody who might. It
  conveys a lack of confidence and sets a negative tone.
- **"I just happened to be in the area."** — tells the customer they are a
  gap-filler between more important visits.
- **"I heard you've been having trouble in your X department."** — puts them on
  guard and makes them wonder who has been talking about them.
- **"How are you today?"** — from a stranger who has not said why he is
  calling, it reads as insincere.
- **"Can I help you?"** — mechanically produces "just looking."
- **Any question a single word can end.** Futrell's phrase for the
  direct-negative-no question is that it is like *hanging up the telephone on
  yourself*.
- **Apologising for taking their time**, and **implying the call was
  unplanned**. Both are on Futrell's list of what fails on arrival.
- **Exaggerating the benefit to buy attention.** Futrell names the pressure —
  reps know that failing to get attention fast means no presentation at all —
  and the cost: overpromising loses the sale and destroys the relationship.

**In the script:** none of these appear, and the check refuses them by name.
The retired opener — *"I'll be ninety seconds and then you can tell me to go
away. Have I caught you on site?"* — managed three of them in two sentences.

## 7. Discovery is a survey, not an interrogation

Saylor's **survey approach**: open by asking for information only, with no
services and no costs discussed. Its named virtue is that it is
**non-threatening**, because you are only gathering information.

Futrell adds the trap on the other side: opening with questions that are too
specific makes the prospect uncomfortable and unwilling to admit problems —
they may even deny them. Rackham's rule via Saylor is that situation questions
are asked *sparingly*, and research beforehand should mean the only ones you
ask are the ones you could not answer any other way.

Saylor's three-rung ladder for an opening question: a **closed** question risks
ending the conversation on a yes; an **open** question is too broad and invites
a vague answer; a **leading** question that shows you already know the likely
problem is best, because it builds credibility by showing the research.

**The owner's own reading of his twenty conversations sharpens this.** He is a
contractor himself: a contractor will not answer a generic open question from a
stranger, because every answer discloses something. But he will correct you
when you are wrong about his business. In his corpus, the twelve-question block
pasted at five prospects correlates with silence; the two conversations that
became the biggest wins were dialogue.

**In the script:** discovery asks permission first, says explicitly that
nothing about money is being asked, and every prompt is a leading question with
two options in it, so the cheapest possible reply is a correction. The
`current_process` stage states outright that we are guessing from the outside
and asks to be corrected.

## 8. Attach a number — theirs, not ours

Futrell's most practical instruction on implication questions: attach a
bottom-line figure to them, and get the prospect to state or agree to the
number, so that you can use their own data later.

**In the script:** the `pain` stage asks *them* for the count. No stage in any
playbook contains a figure of our own, and the AI half is forbidden figures
entirely — the schema in `generate.js` has no numeric field at any depth.

## 9. Benefits, not advantages — and only after investigation

Rackham's research on 35,000+ calls, carried by Saylor: reps who demonstrate
capability by presenting **benefits** (what a feature does for *this*
prospect's stated need) rather than **advantages** (what it could do for a
generic customer) face materially fewer objections. But it only works if the
questioning surfaced the explicit needs first. This is the strongest empirical
claim in the whole source set, and it means pitching early is not merely rude —
it is measurably less effective.

Futrell's related structural point: do not name the product during a
question-led opening at all, because announcing what you sell before the buyer
perceives a need raises the odds of a negative response.

**In the script:** the `fit` stage begins by pointing back at what the prospect
just said, and it is the first stage in the call that describes what FieldQuo
does.

## 10. Forestall the objection before they say it

Futrell's forestalling: raise the likely objection *before* the prospect does.
His reason is the mechanism, not the manners — a customer who has voiced an
objection feels compelled to defend it, and if you acknowledge it first they
never have to.

**In the script:** the switching objection is raised by the rep, in `fit`, in
every playbook where it applies ("nothing has to come off {competitor}", "you
keep the site you've got", "you keep the address that's on the site").

## 11. What is honestly available to a stranger in ninety seconds

This is Cialdini's material, read against his own thresholds.

**Available:**

- **Demonstrated relevant expertise.** Cialdini's authority chapter is about
  **connotation, not content**: we defer to the symbols rather than the
  substance, and all the symbols are fakeable. Bickman's street study is the
  cleanest measure of it — a young man asked passers-by to do an odd thing
  (give a stranger at a parking meter a dime), then walked round the corner so
  he was gone before they got there. In a security guard's uniform **92%**
  complied; in street clothes, **42%**. Students asked to predict it guessed
  the street-clothes figure almost exactly (50% against 42%) and badly
  underestimated the uniform (63% against 92%) — so self-report about what
  "wouldn't work on me" is worthless here.

  The useful half for a phone call is that **none of those symbols transmit
  down a line**. No uniform, no suit, no office. What transmits is naming the
  problem in the trade's own vocabulary, and Cialdini's own first defensive
  question is whether the authority is a *relevant* expert. A caller who can
  pass that test is sending a true signal, and one who cannot has nothing to
  fake it with.
- **A true, costly self-damaging admission.** Cialdini ch.6: we are far more
  swayed by experts who appear impartial than by those with something to gain,
  and practitioners simulate impartiality by seeming to argue against
  themselves. His examples are Listerine's bad taste, Avis being number two,
  L'Oréal costing more — and he names the mechanics precisely: **the conceded
  drawback is invariably secondary and easily outweighed.** That is the
  theatrical version. His extended case, Vincent the waiter, is presented as a
  *trick* for exactly one reason: the dish was not actually worse that night.
  The admission was fabricated, and it cost him nothing.

  **So the test is: could this sentence lose the call?** If it cannot, it is
  not doing the work Cialdini describes.

- **Loss framing, when the loss is real.** Homeowners told how much they would
  *lose* through inadequate insulation insulate more often than those told how
  much they would save (Gonzales, Costanzo & Aronson). Breast self-examination
  pamphlets phrased as what stands to be *lost* by not spending five minutes a
  month outperform the identically-valued gain phrasing (Meyerowitz & Chaiken).
  Godin arrived at the same asymmetry in the field: at VisionSpring he took the
  glasses off the table and changed the pitch from a shopping choice to "here
  are your new glasses; if you don't want them, give them back" — and that
  **doubled** the percentage sold.
- **Genuinely exclusive information.** Cialdini's beef-importer study: the
  standard pitch is the baseline; adding news that imported beef would be
  scarce **more than doubled** orders; adding that this news was not publicly
  available, having come from the company's exclusive contacts, produced **six
  times** the baseline. Note the condition that makes it honest — in the study,
  the exclusivity claim was true.
- **A real reason for the call** (§3 above).

**Not available in the time:**

- **Liking.** Cialdini's own alarm threshold is the twenty-five minutes he has
  known "Dealin' Dan" the car salesman. Ninety seconds is far inside it, and
  the methods that manufacture warmth that fast are the cheap ones: claimed
  similarity, mirrored speech, flattery. Car salespeople are trained to read
  the trade-in's boot for camping gear or golf balls; Cialdini advises "special
  caution in the presence of requesters who claim to be 'just like you.'"
- **Commitment and consistency.** Foot-in-the-door needs a prior commitment,
  and on a first call there is none. His four conditions — active, public,
  effortful, freely chosen — are all failed by a yes extracted from a leading
  question in the first minute.
- **Reciprocation.** We have given nothing. Regan's Coca-Cola experiment is the
  most cold-call-relevant result in the book (a ten-cent favour doubled ticket
  sales, and wiped out the effect of liking entirely) — and that is precisely
  why deploying it as an opener would be a technique rather than a courtesy.

**Never:**

- **Lowball.** Cialdini's clearest prohibition: a price or condition offered to
  produce the decision and never intended to be honoured. His verdict on who
  favours it is the sentence to keep in view — it makes a person feel pleased
  with a poor choice, which is why those with only poor choices to offer like
  it.
- **Manufactured urgency and fabricated exclusivity.** The vacuum-cleaner
  script he infiltrated ("company policy that even if you decide later, I can't
  come back and sell it to you") had a stated internal purpose: to keep
  prospects from taking the time to think the deal over. It is not merely a lie
  — it is a lie that disables the check on itself, because scarcity produces
  arousal that suppresses exactly the deliberation the target would need.
- **Counterfeit social proof.** Invented peer counts, fictional local
  customers, testimonials that are not real. This is the category his epilogue
  says warrants boycott and confrontation. It is also barred by FieldQuo's own
  non-negotiable 8: no tenant's data is ever quoted to another.
- **Flattery.** It deserves its own line because of the North Carolina study:
  the pure flatterer was liked best; this held **even though the recipients
  knew the flatterer wanted something**; and, unlike other comment types, the
  praise **did not have to be accurate**. That combination is the definition of
  a device that exploits the shortcut rather than informing it.
- **Engineered door-in-the-face.** Structurally it fits ninety seconds, which
  is why it is tempting. Cialdini's zoo study is the evidence it works — asked
  cold, 83% refused to chaperone juvenile delinquents on a day trip and 17%
  agreed; preceded by a much larger request (two hours a week for two years,
  which everyone refused), **50% agreed, three times the rate**. But the
  Bar-Ilan finding is the practical reason to leave it alone: if the first
  demand is extreme enough to look unreasonable, the requester is not seen to
  be bargaining in good faith, the retreat is not read as a concession, and
  nothing is reciprocated. A cold caller starts with less good faith than
  anyone.

Cialdini's line is not between principles but between true and counterfeit
signals. His epilogue is explicit that compliance professionals who play fairly
"are not to be considered the enemy… The proper targets for counteraggression
are only those individuals who falsify, counterfeit, or misrepresent the
evidence."

## 12. Godin, honestly

He never uses the phrase "cold call." It does not appear in *This Is
Marketing*, and neither does "telemarketing." That absence is a position: he
defines marketing as permission-based service and is hostile to interruption
throughout. He picked an unsolicited phone call as his paradigm case of the
profession's shame — "you won't find civil engineers who call senior citizens
in the middle of the night to sell them worthless collectible coins" — and he
names the failure mode of the channel at the level of audio: "when we get a
phone call and hear the telltale clicks and pauses before the stranger begins
to speak, we remember all the robocalls and phone spam we've gotten and hang up
before the caller even utters a word."

Nothing in these scripts claims his endorsement. What he does supply is real,
and four things carry:

- **"Take a room in town."** Zig Ziglar sold pots and pans door to door in the
  1960s. Most of the three thousand reps filled the car, worked a town's easy
  sales, and drove to the next one. Ziglar moved in — took a room for weeks,
  kept showing up, and engaged someone in the middle of the curve "five or six
  or seven times over the course of a month, which is precisely what this sort
  of person wants before they make a decision." There were days with no sales
  at all. Godin's summary: *the easy sales aren't always the important ones.*
  He says the same thing as strategy elsewhere — "for a local craftsperson, it
  means hunkering down in a single neighborhood until a reputation is assured."
  That is a trade territory, described exactly.
- **The stamp arithmetic.** "If you need to send a thousand stamped letters to
  get one order, that means each order costs you five hundred dollars. If your
  lifetime value of a customer is seven hundred dollars, buy as many stamps as
  you can possibly afford. On the other hand, if the lifetime value is four
  hundred dollars, you have no business buying stamps. You need a better letter
  or a better business." There is no principled difference between a stamp and
  a dial. Every step of a calling programme has to be measurable against
  lifetime value, or it should not be run.
- **Tension is not fear.** "If you feel like you're coercing people,
  manipulating them or causing them to be afraid, you're probably doing it
  wrong… Fear's a dream killer. It puts people into suspended animation… There
  might be fear, but tension is the promise that we can get through that fear
  to the other side." This is the line a script sits on either side of.
- **Speed of response.** "More than eighty percent of the people who hire a
  broker do so by choosing the first person to return their call." Availability
  and promptness beat argument in a low-consideration local decision — an
  argument for follow-up and for calling back fast, not for talking longer.

## 13. Follow-up is the strategy, not the fallback

Saylor ch.13 carries the Association of Sales Executives' figure: **81% of all
sales happen on or after the fifth sales call.** Ch.11 gives the companion — a
prospect says no roughly five times before buying. Futrell says three closes is
the minimum for a successful salesperson and never to take the first no as an
absolute refusal, and his twelfth key to a successful close is simply **leave
the door open**. Saylor's cold-calling rules add: if asked to call back later,
schedule a **specific** time.

Godin's frequency chapter is the same claim from the marketing side: "we
remember what we rehearse… the familiar is normal and the normal is trusted,"
and there is "a very real dip — a gap between when we get bored and when people
get the message. If you quit right in the middle of building that frequency,
it's no wonder you never got a chance to earn the trust."

**And the owner's corpus agrees.** Of twenty real TrueFinish conversations, not
one win closed on first contact. The single most valuable play in the set is a
stale-quote win-back months later: Mario Laroche was quoted in February, went
quiet, and re-engaged immediately when followed up in May with a rebuilt
number.

**In the script:** the retired close said *"say so and that's the end of it."*
A single word from the prospect ended a sequence that the evidence says usually
takes five contacts. Every close now confirms the specific next step and adds a
contingency that keeps the sequence alive — and none of them invites a refusal.

## 14. What the check can and cannot prove

`scripts/check-playbook-copy.mjs` executes what can be executed and pins by
hand what cannot:

- It sweeps every seed script and every prompt for the banned moves, and it
  self-tests each detector against the retired sentence it was written for, so
  a pattern that has stopped recognising the failure fails loudly rather than
  passing silently.
- It asserts each opener names the rep and the company, states a reason, and
  asks permission phrased for a yes.
- It asserts each close names a specific next step, does not invite refusal,
  and carries a clause that keeps follow-up open.
- It asserts the generator's system prompt forbids each banned move **by
  name**, against the exported string that is actually sent to the vendor.

Its scope is the four playbook scripts, the generator prompt, **and the eight
objection seeds** in `lib/sales/playbook/objections.js`.

The objection library was originally left out, on the argument that some of
what reads as foreclosure in a response is correct behaviour. That was half
true, and the half that was false protected three sentences which were the
retired close wearing a different coat:

| Objection | The retired ending |
|---|---|
| `ALREADY_USE_COMPETITOR` | "If that is not a problem you have, I will leave you alone." |
| `SEND_ME_INFO` | "If you would rather I did not, say so and I will just send it." |
| `NOT_INTERESTED` | "One question and then I will go…" |

Each ends the sequence on one word, at the exact moment the prospect has
engaged enough to push back — which Saylor ch.11 calls a gift, not a
rejection. Against 81% of sales landing on or after the fifth call, that is
four contacts thrown away to sound reasonable. All eight are now rewritten on
Saylor ch.11 §2's shape: **restate → welcome → answer with reframed economics
or evidence → a small next step**, and none of them ends the sequence.

**The one exemption, and the condition on it.** `NOT_INTERESTED` may still say
"I will take you off the list", because that is not a rhetorical exit — the
`do_not_call` disposition writes `doNotContact` permanently, and
`lib/sales/suppression`'s `ALL_CHANNELS` default carries the stop to the email
and the texts. A promise FieldQuo keeps may be made. The check therefore
exempts that sentence *conditionally*: the response must say the promise is
permanent, say it covers the other channels, and distinguish it from a form of
words. A response that promises to stop without saying what the switch does
fails — that is the retired move with better manners. It must also offer one
more conversation **before** it offers the list, which the check asserts by
character position.

Note the detector fix that came out of this sweep: the foreclosing-exit-line
pattern matched `i'll` and not `i will`, so it had been passing over
"I will leave you alone" — and the objection seeds are written expanded
throughout. A detector that catches only one spelling of a banned move catches
whichever spelling the last author did not use.

It cannot tell whether a concession is *true*, or whether it could really lose
the call. So the four concessions are listed in the check by hand, and changing
one means changing that table — which is the moment to ask the Cialdini
question again: could this sentence cost us the meeting? If not, it is
theatre, and it should be replaced rather than softened.


## 15. The seeds live in the database, and a rewrite has to reach them

Everything above describes the words in `lib/sales/playbook/defaults.js` and
`objections.js`. Those are **seeds**. The words a rep actually reads come from
`SalesPlaybook` and `SalesObjection` rows, put there once by "install the
starter library".

`installDefaults()` creates and never updates — deliberately, so that a
superadmin who has rewritten `COMPETITIVE_DISPLACEMENT` cannot have their words
replaced by a button labelled "install the defaults".

The cost of that rule showed up the day these scripts were rebuilt. Source was
correct, production was word for word the old script, and a deploy changed
nothing. The owner opened a live prospect and read back the exact sentence the
rebuild had deleted — *"if that is not a problem you have, I will leave you
alone"* — from a screen that was, from its own point of view, working
perfectly.

**So there is a second control: "Update the unedited built-ins."** It updates a
row only when that row still says, character for character, what *some shipped
version of the seed* said. A row like that is nobody's writing. Anything else
is skipped and named in the response, so "left alone" is a list of keys rather
than a count.

That test needs a record of what has been shipped, which is
`lib/sales/playbook/seedHistory.js`: a truncated SHA-256 of each retired
version's label and text. The words themselves stay in git, where deleted words
belong.

**When you change the built-in words, append the outgoing fingerprint.**
`check:playbook-copy` computes the current seeds' fingerprints and fails if one
is already listed as retired, or if any built-in has no retired fingerprint at
all — because a rewrite that forgets to record what it retired silently loses
the ability to refresh the rows it just made stale, and nobody finds out until
a rep reads the old words down a phone.

Cues are excluded from the fingerprint on purpose: they are how a rep finds an
answer mid-call, they get tuned independently of the words, and a refresh that
skipped a row because somebody added a cue would fail exactly the people who
use the library most. Stage order **is** included — the same sentences in a
different order are a different script.
