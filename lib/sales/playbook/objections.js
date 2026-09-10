// lib/sales/playbook/objections.js
//
// What to say when they push back — as data, not as prose inside a playbook.
//
// ══ Why the responses are their own store ═════════════════════════════════
//
// §22 asks for objection responses as configurable data, and there is a
// second, sharper reason than configurability: the same eight objections come
// up on every call whichever playbook is open. Written inline, each playbook
// would carry its own copy of "we already use Jobber", four copies would drift,
// and the copy nobody looks at is the one a rep reads out — AGENTS.md failure
// class 4, with a customer listening.
//
// ══ Nothing here is generated ═════════════════════════════════════════════
//
// A model may personalise a TALKING POINT, which cites an opportunity row that
// cites evidence. An objection response is the answer to a challenge, it is
// often about our own pricing and our own limits, and there is nothing for a
// generated sentence to cite. So these are written by a superadmin, edited by a
// superadmin, and rendered verbatim. That is also why they may contain a
// figure and an AI talking point may not: a person put it there and can answer
// for it.
//
// ══ Prospect evidence attaches where it exists, and NOWHERE else ══════════
//
// "We already use Jobber" is a different sentence when we detected Jobber than
// when we did not. So an objection may name a `contextSelectorKey` out of the
// same closed selector vocabulary the playbooks use, and when that selector
// matches, the response carries the observations behind it. When it does not
// match — or the objection names no selector at all — the response is still
// shown, with `context: null` and the screen saying it is a general answer.
//
// It is NOT filtered out. A rep hears what a rep hears, and hiding the
// too-expensive answer because we have no evidence about this prospect's
// budget would be hiding the answer to the most common objection there is.
import { runSelector, selector } from "./selectors";

/** Bounds a superadmin's edit has to satisfy. Shape, not judgement. */
export const MAX_OBJECTION_LABEL = 120;
export const MAX_OBJECTION_RESPONSE = 1200;
export const MAX_CUES = 12;
export const MAX_CUE_LENGTH = 80;

/**
 * The starter library.
 *
 * Written here and then living in the database, exactly like
 * lib/sales/intel/rules.js's seeds and for the same reason: which answers work
 * is a sales judgement that changes monthly, and a judgement that needs a
 * deploy to change is a judgement nobody revises.
 *
 * `cues` are the words a prospect actually says, so a rep scanning on a phone
 * mid-call finds the row by what they just heard rather than by our name for
 * it. They are matched as lower-cased substrings — no stemming, no fuzzy
 * matching: a near-match that opens the wrong answer is worse than no match,
 * because the rep reads it out.
 */
//
// ══ The shape every response follows, and why ═════════════════════════════
//
// Saylor ch.11 §2's own six strategies, in his order: view the objection as a
// QUESTION rather than an attack; restate it before answering, which proves
// you listened and buys a beat; answer with reframed economics or third-party
// evidence rather than a discount; never argue. Futrell adds forestalling —
// raise the objection the answer itself creates before the prospect has to.
//
// So: restate → welcome → answer → a small next step. Every one of the eight
// ends in something the prospect can do, and NONE of them ends the sequence.
//
// ══ The rule that got three of these rewritten ════════════════════════════
//
// They used to end "I will leave you alone", "say so and I will just send it"
// and "one question and then I will go". Saylor ch.13 puts 81% of sales on or
// after the FIFTH call and has a prospect saying no about five times before
// buying; Futrell's twelfth key to a close is to leave the door open. A
// response a single word can end throws four contacts away — and it does it at
// the exact moment the prospect is engaged enough to push back, which Saylor
// calls a gift rather than a rejection.
//
// The ONE exception is NOT_INTERESTED's do-not-call promise. That is not a
// rhetorical exit, it is a switch: the `do_not_call` disposition writes
// doNotContact permanently and lib/sales/suppression's ALL_CHANNELS default
// stops the email and the texts with it. A promise we keep may be made; a
// promise made only to sound reasonable may not. scripts/check-playbook-copy.mjs
// exempts exactly that sentence and requires it to say what the switch does.
const OBJECTIONS = [
  {
    code: "ALREADY_USE_COMPETITOR",
    label: "We already use [another platform]",
    priority: 100,
    contextSelectorKey: "competitor_detected",
    cues: ["already use", "we have jobber", "we use jobber", "housecall", "servicetitan", "we're on"],
    // Restate → welcome → the ONE narrow claim → a next step that costs them
    // nothing. The retired version ended "if that is not a problem you have, I
    // will leave you alone", which threw the other four contacts away on a
    // single word (Saylor ch.13: 81% on or after the fifth call).
    response:
      "So you have already got that solved, and it works. Good — that is the right order to " +
      "solve it in, and I am not going to tell you your scheduler is broken. Two things it may " +
      "not be doing. Whose name the homeowner sees: with us the quote, the invoice, the booking " +
      "page and every email between them carry yours and none of them carry ours. And what " +
      "happens before the quote goes out — every one gets read back to you, free, every time: " +
      "what you have left off it, and whether the price is above or below what you have " +
      "actually been winning at. Your own accepted and declined jobs, not other contractors' " +
      "numbers — yours do not go anywhere either. Does the one you use now do that? Give me " +
      "your logo and your colour and I will build one real quote with your name on it, review " +
      "and all — put it next to the last one you sent and tell me what is wrong with it.",
  },
  {
    code: "TOO_EXPENSIVE",
    label: "That sounds expensive / we can't afford another subscription",
    priority: 90,
    contextSelectorKey: null,
    cues: ["expensive", "too much", "can't afford", "cannot afford", "cost", "another subscription"],
    // Saylor ch.11 §2 on price: answer with value and differentiation, never a
    // discount — and his own figure is that 40% of buyers ask for a concession
    // only "because they had to ask", while 50% of sellers concede on the first
    // request. So the response refuses to discount and hands the arithmetic
    // back with THEIR number in it (Futrell: attach a bottom-line figure to the
    // implication, and get the prospect to state it).
    response:
      "So what you are saying is you are not sure it pays for itself. That is the right " +
      "question and I would rather you put it now than three months in. I am not going to " +
      "discount it, because the number that decides this is not ours — it is what one quote you " +
      "never got round to sending is worth to you, and what a quote priced under what you " +
      "usually win at costs you when it is accepted too fast. The second one you cannot see " +
      "without something reading your own history back to you, which is the part that is free " +
      "and runs on every quote. You are the only one who knows your average job. Tell me " +
      "roughly what that is and I will do the arithmetic with your figure instead of mine, in " +
      "writing, so you can read it when you are not standing on somebody's drive.",
  },
  {
    code: "NO_TIME_TO_SWITCH",
    label: "I don't have time to learn new software",
    priority: 85,
    contextSelectorKey: null,
    cues: ["no time", "too busy", "learn", "set up", "switch"],
    // Barron's "reduce the cost of change": the competitor here is inertia, not
    // a rival. The proof is a demonstration rather than an assurance, because
    // an assurance about effort is exactly the claim a busy person discounts.
    response:
      "So it is the changeover you are weighing, not the thing itself. That is the honest " +
      "reason most people stay where they are and it is the one I would want answered too. " +
      "Nothing has to move at once — the next quote goes out of the new one and everything else " +
      "stays exactly where it is until you decide otherwise. If you want the old records " +
      "brought across, that is a paid job we do for you, not an import screen we hand you. " +
      "Rather than argue about how long it takes: give me one job you have already done and I " +
      "will set it up the way it would really run, and you tell me whether that was the effort " +
      "you were picturing.",
  },
  {
    code: "DONT_NEED_A_WEBSITE",
    label: "All my work is word of mouth, I don't need a website",
    priority: 80,
    contextSelectorKey: "no_website",
    cues: ["word of mouth", "referral", "don't need a website", "do not need a website", "busy enough"],
    // Cialdini ch.7 loss framing, on a loss that is REAL: the enquiry you never
    // hear about. Godin's broker statistic sits underneath it — more than 80%
    // of people who hire one choose the first to come back to them, so being
    // findable at all is most of the contest.
    response:
      "So the work comes from people who already know you. That is the best kind there is and I " +
      "am not going to argue it down. The narrow thing word of mouth cannot do is answer at " +
      "nine at night: your customer gives your name to a neighbour, the neighbour looks you up " +
      "on their phone, finds nothing, and rings the second name instead. You would never hear " +
      "about that one, which is exactly why it is worth a look rather than a shrug. Send me " +
      "three photos of a job you are proud of and I will show you what that neighbour would " +
      "have found — then tell me what is wrong with it.",
  },
  {
    code: "BOOKING_NOT_FOR_US",
    label: "People need to talk to me before I can book anything",
    priority: 75,
    contextSelectorKey: "website_without_booking",
    cues: ["need to talk", "every job is different", "can't just book", "site visit"],
    // Saylor's rule that you never argue: the objection is conceded outright,
    // because it is true. What follows corrects the subject of the sentence
    // (the visit, not the job) rather than the prospect.
    response:
      "So what you are saying is a job like yours cannot be priced without seeing it. Agreed — " +
      "nobody is booking a kitchen off a form, and if I told you otherwise you would be right " +
      "not to believe the rest of it. What gets booked is the visit, not the job: they pick " +
      "from hours you have already said you will accept, it lands in your calendar with the " +
      "address and their photos already attached, and the four texts to arrange it never " +
      "happen. Tell me the hours you would genuinely accept and I will set it up inside those, " +
      "and you look at it before anybody else can.",
  },
  {
    code: "EMAIL_WORKS_FINE",
    label: "My email address is on the site, that works fine",
    priority: 70,
    contextSelectorKey: "email_only_quote_request",
    cues: ["email works", "they email me", "my email is on there", "inbox"],
    // Forestalls the objection the answer itself creates — "so I lose the email
    // address" — before they raise it. Futrell: once an objection is said aloud
    // the prospect has to defend it, so the answer arrives first.
    response:
      "So the address on the site is doing the job. For the people who write to you it is — the " +
      "question is what happens between them writing and you answering. It works right up until " +
      "you are on a roof, and then it is an email you will answer tonight, and tonight you are " +
      "doing invoices. A form asks the four things you always end up asking anyway, and what " +
      "lands is a job in a list with the answers already on it rather than a note in an inbox. " +
      "You keep the address either way — anyone who would rather just email you still can. Tell " +
      "me the four things you always end up asking and I will build it round yours, not ours.",
  },
  {
    code: "SEND_ME_INFO",
    label: "Just send me some information",
    priority: 60,
    contextSelectorKey: null,
    cues: ["send me", "email me something", "send information", "brochure"],
    // Saylor ch.11: "just send me something" is a STALL, not an objection —
    // it masks unaddressed risk. So the material is promised unconditionally
    // (refusing it would be the argument he forbids) and the ask that follows
    // is an alternative-choice one. The retired version ended "if you would
    // rather I did not, say so and I will just send it", which handed the
    // prospect a one-word way out of the only thing being asked for.
    response:
      "So you want to see something in writing before you spend any more time on the phone. " +
      "Fair — I would want the same, and I will send it. I would rather send the one that is " +
      "about your problem than the one that is about all of them, so which is it more: the " +
      "quotes going out, or the money " +
      "coming back in? That is in your inbox today either way. The reason I would still like " +
      "fifteen minutes on top is that a document read at eleven at night answers no questions " +
      "back. Thursday morning, before you are out — and if Thursday is the wrong day, give me " +
      "one that is not.",
  },
  {
    code: "NOT_INTERESTED",
    label: "Not interested",
    priority: 50,
    contextSelectorKey: null,
    cues: ["not interested", "no thanks", "we're fine", "we are fine"],
    // ── The one response that MAY end the sequence, and only honestly ──────
    //
    // "I will take you off the list" is not a rhetorical exit here: it is the
    // suppression promise FieldQuo actually keeps. The `do_not_call`
    // disposition sets doNotContact permanently, and lib/sales/suppression's
    // ALL_CHANNELS default is the widest reading — a stop given on the phone
    // stops the email and the texts too. So the sentence says what the switch
    // really does, and points the rep at the switch.
    //
    // What was retired is the rest of it. "One question and then I will go"
    // spent the other four contacts on a single word before the question had
    // even been answered.
    response:
      "Understood, and I am not going to talk you round. One thing before you get on, and it is " +
      "a question rather than a pitch: when a quote goes out, is that you at the kitchen table " +
      "at nine at night? If it is not, then this really is not for you and I would rather say " +
      "so than keep ringing. If it is, that is the whole of what I called about, and it is " +
      "worth one more conversation rather than none. And if you would rather we did not ring " +
      "at all, tell me now and I will put you on the do-not-call list today — that is a switch " +
      "in here rather than a form of words: it is permanent, and it stops the email and the " +
      "texts as well.",
  },

  // ══ The twelve that were missing ══════════════════════════════════════════
  //
  // The library shipped with eight, and eight is what the four playbooks
  // needed: each one answers a challenge to something a playbook claims. The
  // owner asked for twenty, for a salesperson meeting, and the gap he was
  // pointing at is real — the eight above are all objections to the PITCH.
  // Not one of them answers the objections that end a cold call before the
  // pitch has happened at all: who gave you my number, ring me in the autumn,
  // I would have to ask my wife, just tell me what it costs.
  //
  // Cognism's script set is where the shape of these came from — their five
  // scripts spend most of their length on the gatekeeper and the first thirty
  // seconds rather than on the demonstration, which is the right weighting for
  // a business where the meeting is the sale being made.
  //
  // Every one of them follows the same four beats as the eight above (restate
  // → welcome → answer → a small next step) and none of them ends the
  // sequence. Three of them concede something real and costly, because the
  // three that would otherwise be the most tempting to bluff are the three a
  // contractor can check: what it costs, whether he is tied in, and where his
  // customer list ends up.
  {
    code: "NOT_THE_DECISION_MAKER",
    label: "I'd have to ask my wife / my partner / the boss",
    priority: 95,
    contextSelectorKey: null,
    cues: ["ask my wife", "ask the wife", "my partner", "my husband", "the boss", "not my call", "speak to my"],
    // Saylor ch.8 on the buying centre: the person who answers the phone in a
    // small contractor is rarely the only decider, and the failure is asking
    // HIM to sell it for you. What travels to the other person unaided is a
    // document, not a description.
    response:
      "So it is not only your decision, and whoever else is in it has not heard any of this. " +
      "That is normal at this size and it is the right way round. What I would not do is ask " +
      "you to sell it for me — my description of it arriving second hand at teatime is the " +
      "worst version either of you could get. Two ways round it: fifteen minutes with both of " +
      "you on the phone, or give me your logo and the colour you use and I will build one real " +
      "quote with your name on it and send it over, so what they are looking at is the thing " +
      "itself. Tell me which of those is easier this week.",
  },
  {
    code: "CALL_ME_BACK_LATER",
    label: "Ring me after the season / in the new year",
    priority: 78,
    contextSelectorKey: null,
    cues: ["call me back", "ring me next", "after the summer", "after christmas", "new year", "busy season", "try me later", "not right now"],
    // Saylor ch.11 calls this a stall rather than an objection, and the
    // difference matters: a stall is answered by making the next contact
    // specific rather than by arguing. The date is THEIRS, and it goes in the
    // calendar — lib/sales/calendar is where it lands, which is why the last
    // sentence promises a diary entry rather than a vague "I'll be in touch".
    response:
      "So the timing is wrong rather than the thing itself. Fair — the middle of a season is a " +
      "bad week to change anything and I am not going to pretend otherwise. Two things though. " +
      "The part that would take an afternoon is an afternoon of mine, not yours. And the month " +
      "you are describing is the month the quotes go out late, which is the thing I called " +
      "about — so waiting for it to be quiet means testing it in the week it matters least. " +
      "Tell me the month you would want it working by and I will work backwards from that. " +
      "Give me a date and it goes in my diary for that day rather than me ringing you at random.",
  },
  {
    code: "HOW_DID_YOU_GET_MY_NUMBER",
    label: "Where did you get my number?",
    priority: 72,
    contextSelectorKey: null,
    cues: ["where did you get", "how did you get my number", "who gave you", "how do you have my", "who gave my"],
    // A straight answer, because the true one is good: the number came off the
    // business's own public listing and lib/sales/intel keeps the evidence row
    // that says which. Deliberately does NOT make the do-not-call promise —
    // that switch belongs to NOT_INTERESTED and to the `do_not_call`
    // disposition, and a second sentence that sounds like it, made by a rep who
    // has not reached for the switch, is the "form of words" the whole
    // suppression exemption exists to refuse.
    response:
      "So you want to know how I got hold of you before anything else. That is a fair thing to " +
      "ask and you are owed a straight answer rather than a deflection. It came off your own " +
      "public business listing — the one a homeowner would find searching for you — and that is " +
      "recorded against your name here, so I can tell you which page it was on. Nobody sold it " +
      "to us and nobody passed it on; there is no traded list of contractors behind this call. " +
      "If that bothers you it is a reasonable thing to be bothered by and I would rather know. " +
      "Give me the thirty seconds I asked for and you can decide on the reason I called rather " +
      "than on how I found you.",
  },
  {
    code: "TOO_SMALL_FOR_THIS",
    label: "It's just me — I'm too small for something like that",
    priority: 65,
    contextSelectorKey: null,
    cues: ["just me", "one man", "one-man", "only me", "too small", "on my own", "sole trader", "small outfit"],
    // The commonest disqualification a contractor makes on his own behalf, and
    // it is backwards: the sole trader is the one for whom the office work has
    // nowhere else to go. The seat arithmetic is real — lib/pricing/ladder.js's
    // first rung is one seat and five crew — and it is the answer to the
    // unspoken half of the objection, which is that growing will punish him.
    response:
      "So it is you, and there is nobody to hand any of it to. That is the case this was built " +
      "for rather than the exception to it — the whole of the office job lands on the person " +
      "who is also on the tools, which is why the evenings go the way they do. It starts at one " +
      "seat, and anybody who ever works with you in a van is carried at no charge rather than " +
      "billed per head, so taking somebody on does not become a reason to leave. Give me one " +
      "job you have already done and I will set it up the way it would really run for one " +
      "person, and you tell me whether that is more work than what you do now or less.",
  },
  {
    code: "PLENTY_OF_WORK",
    label: "I've got more work than I can handle already",
    priority: 62,
    contextSelectorKey: null,
    cues: ["more work than", "booked out", "turning work away", "don't need more work", "do not need more work", "plenty of work", "flat out"],
    // Futrell: if the customer does not have the need, accept it and move on —
    // so half the pitch is dropped out loud rather than argued for. What is
    // left is the half that gets WORSE when the diary is full, which is the
    // only honest thing to say to somebody who is turning work away.
    response:
      "So the problem is not finding work. Good — then half of what I could say is irrelevant " +
      "and I will leave it out rather than talk you into a problem you do not have. The part " +
      "that still applies when you are flat out is the other end of it: the quotes that go out " +
      "late because you were on a roof, and the ones priced from memory because there was no " +
      "evening left to check them against what you have actually been winning at. Being busy is " +
      "when both of those cost the most, not the least. Tell me roughly how many quotes are " +
      "sitting waiting on you right now and I will tell you straight whether this is worth a " +
      "conversation in the middle of a season.",
  },
  {
    code: "TRIED_SOFTWARE_BEFORE",
    label: "We tried one of these before and it didn't stick",
    priority: 58,
    contextSelectorKey: null,
    cues: ["tried one", "we had one", "didn't stick", "did not stick", "gave up on", "wasted money", "tried that before"],
    // The strongest objection in the library, because it is evidence rather
    // than an opinion, and the only answer to evidence is to ask what the
    // evidence was. Cialdini ch.6: the response names the condition under which
    // the prospect should NOT buy, which is the move that cannot be faked.
    response:
      "So you have paid for one of these before and it did not survive a real week. That is " +
      "worth more than a fresh opinion and I would rather hear it than talk over it. What " +
      "usually kills them is the setting up: somebody hands over an empty system and your own " +
      "prices have to be typed into it before it can do anything at all, and that never happens " +
      "in July. Tell me which one it was and where it fell over. If we do the same thing at the " +
      "same point I will say so and you should not buy it; if we do not, I will show you the " +
      "part that is different and you can judge it against the one that failed.",
  },
  {
    code: "PAPER_WORKS_FINE",
    label: "Pen and paper works fine / it's all in a spreadsheet",
    priority: 55,
    contextSelectorKey: null,
    cues: ["pen and paper", "paper", "spreadsheet", "excel", "notebook", "in my head", "word document"],
    // Saylor's rule that you never argue: the notebook is conceded as adequate
    // for the job in front of him, because it is. What follows names the two
    // things it cannot do — one client-facing, one arithmetic — rather than
    // calling the method primitive, which is the version that loses the call.
    response:
      "So the notebook works, and it has worked for years. Agreed, and I am not going to tell " +
      "you it is broken, because for the job in front of you it is not. Two things it cannot " +
      "do. It cannot hand a homeowner something with your name and your colours on it while you " +
      "are still standing in their kitchen. And it cannot tell you that the price you have just " +
      "written is under what you have been winning at, because that needs your own history read " +
      "back to you. Give me one job out of the book — a real one, your own numbers — and I will " +
      "put it next to what you would have sent, and you say which one you would rather a " +
      "customer opened.",
  },
  {
    code: "NEED_TO_THINK",
    label: "Let me think about it",
    priority: 45,
    contextSelectorKey: null,
    cues: ["think about it", "let me think", "need to think", "have a think", "sleep on it", "get back to you"],
    // Saylor ch.11: a stall masks unaddressed risk, and the risk here is that
    // in three weeks the thing being weighed is a rep's description rather than
    // the product. So the answer removes the decision instead of pressing it —
    // there is nothing to decide about a quote that costs nothing and commits
    // to nothing.
    response:
      "Understood, and a decision like this should not be made on a phone call anyway. The " +
      "reason I would rather not leave it there is what thinking about it turns into: in three " +
      "weeks the thing you are weighing up is my description of it rather than the thing " +
      "itself. So let me take the deciding out of it. Give me your logo and the colour you use " +
      "and I will build one real quote with your name on it, at no cost and with nothing " +
      "attached to it, and you can think about that instead of about me. Tell me which day next " +
      "week I should keep clear of, and I will ring you on a different one.",
  },
  {
    code: "JUST_TELL_ME_THE_PRICE",
    label: "Just tell me what it costs",
    priority: 40,
    contextSelectorKey: null,
    cues: ["what does it cost", "how much is it", "tell me the price", "what's the price", "what is the price", "how much"],
    // ── The one response that MUST carry a figure ──────────────────────────
    //
    // objections.js's header says a response may contain a number because a
    // person put it there and can answer for it. This is the case that was
    // written for. A rep who will not say the price out loud has told the
    // contractor the price is bad, and every page on fieldquo.com publishes it
    // anyway — a comparison page that opens with the number would be absurd
    // beside a rep who ducks it.
    //
    // scripts/check-playbook-copy.mjs asserts the figure against
    // SEAT_LADDER[0] itself, so the day the entry rung moves this sentence
    // fails rather than quietly lying on a call.
    response:
      "Fair, and I am not going to dodge it — a price you have to ring somebody for is its own " +
      "answer. It is ninety-nine dollars a month for one person who prices work, and everybody " +
      "else in a van is carried at no charge rather than billed per head. Every feature is in " +
      "every plan, so there is no cheaper one that turns out not to do the thing you wanted. " +
      "What I cannot tell you from here is whether it is worth ninety-nine dollars to you, " +
      "because that turns on how many quotes a month go out of your hands. Tell me roughly what " +
      "that number is and I will do that arithmetic with you rather than at you.",
  },
  {
    code: "CONTRACT_LOCK_IN",
    label: "Am I tied into a contract?",
    priority: 35,
    contextSelectorKey: null,
    cues: ["tied in", "contract", "locked in", "how long am i", "commitment", "notice period"],
    // The concession is the second half and it is genuinely against interest:
    // there is no switching cost holding a customer in, which is the thing a
    // sales team would rather not point out. It is true — see the cancellation
    // path in lib/billing — and it is the answer to the fear underneath the
    // question, which is not about the contract but about being trapped.
    response:
      "So the worry is being stuck with it rather than the thing itself. That is the right " +
      "worry, and a year signed up front is how most of this is sold, which is why people end " +
      "up paying for software they stopped opening. There is no year to sign here: you pay " +
      "month to month and you leave at the end of one. Said against my own interest, since you " +
      "will find it out anyway — that also means there is nothing holding you in if it turns " +
      "out to be no good, so it is on us to be worth the next month every month. Give me one " +
      "month with it and if it has not paid for itself, stop it.",
  },
  {
    code: "WHO_OWNS_MY_DATA",
    label: "Who owns my customer list? Is my data safe?",
    priority: 30,
    contextSelectorKey: null,
    cues: ["my data", "who owns", "is it safe", "customer list", "security", "privacy", "gdpr"],
    // Non-negotiable 8, said out loud to the person it protects: the quote
    // review reads THIS company's own accepted and declined history and never
    // another tenant's. lib/ai/quoteReview.js's header calls the alternative "a
    // data leak dressed up as a feature", and a rep asking a contractor to put
    // his prices into somebody else's software should be the one to raise it.
    response:
      "So the thing you want settled first is where your customer list ends up. That is the " +
      "right question to ask first and most people ask it last. Your clients, your prices and " +
      "your quotes are yours: they are not pooled, they are not shown to another contractor, " +
      "and nothing you put in is used to price somebody else's job. The one place your own " +
      "history gets read is the review that runs on your own quotes, and it reads only yours. " +
      "If you want it all back, or gone, that is a written request we act on rather than a " +
      "button that quietly does half of it. Tell me what you would need to see in writing and " +
      "I will send exactly that.",
  },
  {
    code: "BOOKKEEPER_USES_SOMETHING_ELSE",
    label: "My bookkeeper uses QuickBooks / Sage / Xero",
    priority: 25,
    contextSelectorKey: null,
    cues: ["quickbooks", "my accountant", "bookkeeper", "sage", "xero", "does the books"],
    // Forestalls the objection the answer creates. There is no live accounting
    // integration — lib/export/accountingExport.js is a file, not a sync — and
    // a rep who lets a contractor discover that after signing has sold the one
    // thing that gets a refund demanded. Futrell: raise it first and the
    // prospect has nothing left to catch you on.
    response:
      "So the person who does your books has a system already, and you are not about to move " +
      "them off it. Agreed, and you should not — that is their tool, not yours. Here is the " +
      "limit before you find it yourself: there is no live link that pushes invoices into it as " +
      "they go out. What there is is an export of the invoices and the job costs in a shape a " +
      "bookkeeper can take, so month end stops being you reading numbers down a phone. Send me " +
      "one month you have already closed and I will show you exactly what they would receive, " +
      "and they can tell you whether that is useful or not.",
  },
];

export const OBJECTION_CODES = Object.freeze(OBJECTIONS.map((o) => o.code));

/**
 * The starter rows, validated before anybody sees them.
 *
 * Throws rather than filtering, on the same argument seedOpportunityRules
 * makes: a starter row that silently did not ship is a library that looks
 * complete and is not, and this is the cheapest moment to see it.
 */
export function seedObjections() {
  const rows = OBJECTIONS.map((o) => ({
    code: o.code,
    label: o.label,
    cues: [...o.cues],
    response: o.response,
    contextSelectorKey: o.contextSelectorKey,
    priority: o.priority,
    active: true,
    version: "1",
  }));

  const problems = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.code)) problems.push(`${row.code}: duplicate objection code`);
    seen.add(row.code);
    const { ok, problems: found } = validateObjection(row);
    if (!ok) problems.push(`${row.code}: ${found.join(", ")}`);
  }
  if (problems.length) throw new Error(`seedObjections: ${problems.join("; ")}`);
  return rows;
}

/** Why an objection row cannot be written. */
export const OBJECTION_PROBLEMS = Object.freeze({
  no_code: "An objection needs a code.",
  no_label: "An objection needs a label — it is what a rep scans for mid-call.",
  no_response: "An objection with no response is a row that answers nothing.",
  response_too_long:
    "The response is longer than anybody reads while somebody is waiting on the phone.",
  unknown_selector:
    "The context rule names a selector this engine does not implement, so the response could never pick up any evidence.",
  too_many_cues: "Too many cues — a list nobody can scan is a list nobody uses.",
  cue_too_long: "A cue is the words a prospect says, not a sentence.",
  empty_cue: "A blank cue matches everything, which would open this answer on every objection.",
});

export function validateObjection(row) {
  const problems = [];
  if (!row?.code) problems.push("no_code");
  if (!row?.label || !String(row.label).trim()) problems.push("no_label");

  const response = typeof row?.response === "string" ? row.response.trim() : "";
  if (!response) problems.push("no_response");
  else if (response.length > MAX_OBJECTION_RESPONSE) problems.push("response_too_long");

  if (row?.contextSelectorKey && !selector(row.contextSelectorKey)) {
    problems.push("unknown_selector");
  }

  const cues = Array.isArray(row?.cues) ? row.cues : [];
  if (cues.length > MAX_CUES) problems.push("too_many_cues");
  for (const cue of cues) {
    const text = typeof cue === "string" ? cue.trim() : "";
    if (!text) problems.push("empty_cue");
    else if (text.length > MAX_CUE_LENGTH) problems.push("cue_too_long");
  }

  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/**
 * The objection list for one prospect: every active row, in call order, each
 * carrying this prospect's observations where its context rule matched.
 *
 * Nothing is dropped for want of evidence. See the header — hiding an answer
 * because we know nothing about this prospect's version of the objection is
 * hiding it exactly when the rep needs it.
 */
export function objectionsForProspect({ objections = [], index = {} } = {}) {
  const rows = (Array.isArray(objections) ? objections : []).filter((o) => o?.active !== false);

  return rows
    .slice()
    .sort(
      (a, b) =>
        (Number(b?.priority) || 0) - (Number(a?.priority) || 0) ||
        String(a?.code || "").localeCompare(String(b?.code || "")),
    )
    .map((o) => {
      let context = null;
      if (o.contextSelectorKey && selector(o.contextSelectorKey)) {
        const run = runSelector(o.contextSelectorKey, index);
        if (run.matched) {
          context = {
            selectorKey: run.key,
            describe: run.describe,
            facts: run.facts,
            evidenceIds: run.observationEvidenceIds,
          };
        }
      }
      return {
        code: o.code,
        label: o.label,
        cues: Array.isArray(o.cues) ? o.cues : [],
        response: o.response,
        priority: Number(o.priority) || 0,
        contextSelectorKey: o.contextSelectorKey ?? null,
        // Null means "this is the general answer", and the screen says so. It
        // does NOT mean the objection does not apply.
        context,
      };
    });
}

/**
 * Find the rows whose cues contain what the prospect just said.
 *
 * Substring, lower-cased, no stemming and no fuzziness — see the seed's
 * comment. Returns ALL matches rather than a best one: two objections often
 * arrive in one sentence ("we already use Jobber and it's expensive enough"),
 * and picking one would hide the other.
 */
export function matchObjectionText(text, objections) {
  const heard = typeof text === "string" ? text.toLowerCase().trim() : "";
  if (!heard) return [];
  return (Array.isArray(objections) ? objections : []).filter((o) =>
    (Array.isArray(o?.cues) ? o.cues : []).some(
      (cue) => typeof cue === "string" && cue.trim() && heard.includes(cue.toLowerCase().trim()),
    ),
  );
}

/**
 * What the mid-call objection list shows when a rep types what they just heard.
 *
 * ══ A miss shows EVERYTHING, and that is the whole point ══════════════════
 *
 * `matchObjectionText` is substring-exact by design — no stemming, no fuzzy
 * matching, because a near-match opens the wrong answer and the rep reads it
 * out. The cost of that strictness is that it misses often: "we've already got
 * something for that" matches no cue in the library, and a filter that emptied
 * the panel on it would take all eight answers off the screen at the exact
 * second the rep needed one, with a stranger waiting. So a miss is not a
 * result — it falls back to the full list and the screen says the typing
 * matched nothing.
 *
 * ══ Order is never recomputed ═════════════════════════════════════════════
 *
 * `objectionsForProspect` has already ranked these for this prospect. Re-sorting
 * a filtered subset would move a different answer under the rep's thumb than
 * the one that was there a moment ago — muscle memory is most of what makes a
 * mid-call panel usable at all. This function only ever removes rows, never
 * reorders them.
 *
 * @returns {{ rows: Array, filtered: boolean, heard: string, missed: boolean }}
 *   `filtered` false means the rows are the whole list — either nothing was
 *   typed, or what was typed matched nothing. `missed` distinguishes the two,
 *   so the screen can say which without inferring it from a count.
 */
export function objectionsToShow(heard, objections) {
  const rows = Array.isArray(objections) ? objections : [];
  const text = typeof heard === "string" ? heard.trim() : "";
  if (!text) return { rows, filtered: false, heard: "", missed: false };

  const hits = matchObjectionText(text, rows);
  if (hits.length === 0) return { rows, filtered: false, heard: text, missed: true };
  return { rows: hits, filtered: true, heard: text, missed: false };
}
