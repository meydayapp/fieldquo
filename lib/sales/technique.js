// lib/sales/technique.js
//
// HOW FieldQuo's AI sales surfaces talk — never WHAT is true.
//
// ══ Where this comes from ══════════════════════════════════════════════════
//
// The owner-approved "FieldQuo Closer Call Script — Reverse Selling" (Claude
// Docs 898d9c5c-cc87-40b0-972e-711a66e4c440, read in full 2026-10-01). The
// owner's ask: "teach the sales AI this selling technique". The wording below
// is ours — the doc is already FieldQuo's own rewrite, and nothing here is
// taken from the book it draws on.
//
// ══ The goal of a call is a demo (owner, 2026-10-01) ═══════════════════════
//
// The owner then read the book behind the doc and took its core: the first
// call books the MEETING, it does not close. So the phone agent's goal is a
// demo with a person, or a person (transfer_to_human), and the free trial
// only when the caller asks for it or clearly wants to start now — never
// offered as the next step, never pushed. Two questions, not ten; times
// offered as two choices; objection answers two to four sentences that agree
// and move to the next step instead of arguing; the referral question last.
//
// The agent CANNOT book a demo itself, and that is structural:
// lib/platform/salesAgent.js gives it one tool, transfer_to_human, and its
// header explains why there is no booking tool (FieldQuo's demo calendar is
// a separate surface and wiring a phone agent into it is a product decision
// nobody has made). So "book a demo" means: with a transfer number, put them
// through to a person who books it; without one but recorded, have their
// choice of time said clearly for the recording and promise nobody will ring
// at it; with neither, the contact page.
//
// ══ Why it is one module and not three paraphrases ═════════════════════════
//
// Four surfaces use it: the phone agent (lib/platform/salesPrompt.js), the
// check-in text drafts (lib/sales/checkin/draft.js), the reply triage
// (lib/sales/replyTriage.js), and — since 2026-10-02 — Jennifer's VISITOR
// mode on fieldquo.com (lib/ai/jennifer/prompt.js, chatTechnique below).
// Each one used to carry its own idea of tone, and a technique copied four
// times is AGENTS.md failure class 4 with a prospect listening — the copy
// nobody reads is the one that drifts. That is why the objection answers and
// the stories rule are data (OBJECTIONS, STORIES_RULE) the phone and the chat
// both render, with a chat variant only where the phone wording is about a
// phone. Jennifer's COMPANY mode gets none of this: a customer whose invoice
// will not send is not a prospect, and scripts/check-jennifer.mjs pins that
// prompt's bytes so a support answer cannot quietly become a pitch.
//
// ══ It sits BELOW every existing rule, by construction ═════════════════════
//
// Each surface keeps its own absolute rules first and adds this as its own
// labelled section after them, and each section says out loud that it cannot
// override those rules. Where the doc and an existing rule disagree, the
// existing rule wins and this text is written around it:
//
//   - "Callback agreed: a day and time" vs the phone agent's "never say WHEN
//     somebody will ring": the agent asks for a day and time and makes sure it
//     is said aloud for the recording, and still promises nobody will ring then.
//   - The doc's stories ("I spoke with a painter…", "I talked to a [trade]
//     owner…", "five jobs a month… at fifteen") are a person's real calls. An
//     AI has had none, so it only ever gets the PATTERN form, without "I talk
//     to", without a number and without a result.
//   - "Too expensive: …it pays for itself many times over" is a result
//     promise; rule 7 (no guarantee) wins and only the question survives.
//   - "That's the end of it", "Ten minutes, and…", "is that okay?" trip
//     lib/sales/playbook/bannedMoves.js (foreclosing exit line, time-limit
//     promise, yes/no opener). The same intent is said without them, and
//     scripts/check-sales-ai-technique.mjs fires bannedMovesIn() at every
//     section here to keep it that way.
//   - The referral months against rule 3 ("never offer a free extension"):
//     the programme is stated as published terms from lib/referrals, for a
//     link the CALLER would send once they have an account and a plan — never as
//     something the agent grants, and never to the caller themselves.
//
// ══ No figure is typed here ════════════════════════════════════════════════
//
// The trial length, the card rule and the referral months arrive from
// lib/pricing.js and lib/referrals/index.js as arguments with those constants
// as defaults, so a change there changes every surface and the check can
// render this with different values and watch them move. Plan prices are NOT
// here at all: the phone agent reads them from the Plan rows
// (lib/platform/salesKnowledge.js), and a second source of prices beside the
// rows is exactly the drift that file was built to stop.
import { TRIAL_DAYS, TRIAL_CARD_REQUIRED, trialLabel } from "@/lib/pricing";
import { REFEREE_BONUS_MONTHS, REFERRER_BONUS_MONTHS } from "@/lib/referrals";

/** The heading every surface's technique section opens with. Asserted by the check. */
export const TECHNIQUE_HEADING = "HOW TO HAVE THE CONVERSATION";

/** Where the technique came from, for the platform screen and the check. */
export const TECHNIQUE_SOURCE = Object.freeze({
  title: "FieldQuo Closer Call Script — Reverse Selling",
  docId: "898d9c5c-cc87-40b0-972e-711a66e4c440",
});

/** The referral question the doc ends every call with. One spelling, everywhere. */
export const REFERRAL_ASK = "Who do you know who's trying to grow their company?";

const monthsPhrase = (n) => {
  const m = Number(n);
  if (!Number.isFinite(m) || m <= 0) return null;
  return m === 1 ? "a month" : `${m} months`;
};

/**
 * The trial, as a sentence a person can say.
 *
 * The card half is read from TRIAL_CARD_REQUIRED rather than assumed. It has
 * been both values in the last month (owner decisions 2026-09-06 and
 * 2026-09-24), and a sales line still saying "no card" the week it flips back
 * is a false statement made to every caller.
 */
export function trialTerms({ days = TRIAL_DAYS, label = null, cardRequired = TRIAL_CARD_REQUIRED } = {}) {
  const said = String(label || trialLabel(undefined, days)).trim();
  return {
    days,
    label: said,
    cardRequired: Boolean(cardRequired),
    sentence: cardRequired
      ? `The trial is ${said}. A card is asked for when they start it.`
      : `The trial is ${said} and needs no card to start. A card is only entered if they choose a plan when it ends.`,
    worstCase: cardRequired
      ? "they try it and it is not for them"
      : "they try it, it is not for them, they do not choose a plan, and it cost them nothing but a few minutes — no card was ever taken",
  };
}

/**
 * The referral programme, as published terms.
 *
 * Both sides from lib/referrals/index.js: the newcomer's month lands when it
 * CHOOSES A PLAN (grantRefereeBonus — its first charge moves a month later;
 * until 2026-10-03 it was added to the trial at signup), the referrer's when
 * the referred company first PAYS (grantReferrerCredit) — not at signup,
 * which is the fraud target that file's header explains. And only a customer
 * that has chosen a plan can refer at all (the owner, 2026-10-03). Saying
 * "when they sign up" for either side would be a promise the code does not
 * keep.
 */
export function referralTerms({ referee = REFEREE_BONUS_MONTHS, referrer = REFERRER_BONUS_MONTHS } = {}) {
  const forNew = monthsPhrase(referee);
  const forOld = monthsPhrase(referrer);
  if (!forNew && !forOld) return { referee, referrer, sentence: null };
  const parts = [];
  if (forNew) parts.push(`a contractor who signs up through such a customer's referral link gets ${forNew} free when they choose a plan, so their first charge moves ${forNew} later`);
  if (forOld) parts.push(`the customer who referred them gets ${forOld} added to their own account once the new company starts paying`);
  return {
    referee,
    referrer,
    sentence:
      `FieldQuo's referral programme, for customers who have chosen a plan: ${parts.join(", and ")}. ` +
      "Each customer's link is inside their account, under Refer & Earn, once they have chosen a plan.",
  };
}

/**
 * The moves, in our words — shared by every surface that talks.
 *
 * Kept as data so the phone prompt and any written surface say the same
 * thing, and so the check can assert each move is present by key.
 */
export const MOVES = Object.freeze([
  {
    key: "reflex_no",
    text:
      "A quick \"not interested\" in the first seconds is a reflex, like \"just looking\" in a shop. " +
      "Do not argue with it and do not take it literally.",
  },
  {
    key: "asp",
    text:
      "Answer the first resistance with A-S-P. Agree (\"Totally fair.\"). Speak from their side " +
      "(\"If I were running crews all day, I wouldn't want another app to learn either.\"). Then " +
      "Pivot straight to a question about them, with no pause in between (\"Out of curiosity, how " +
      "are you getting quotes out right now?\"). The pause is where people hang up.",
  },
  {
    key: "foreshadow",
    text:
      "Say what the conversation will be before it starts: a couple of quick questions, then, if it " +
      "looks like a fit, a demo with a person where they see the parts that fit and decide for " +
      "themselves. \"Fair enough?\"",
  },
  {
    key: "two_choices",
    text:
      "When a time comes up, offer two choices — earlier or later in the week, morning or afternoon — " +
      "never an open \"what time works for you?\". Two choices make it easy to pick one.",
  },
  {
    key: "hypothetical",
    text:
      "Ask hypotheticals people are happy to answer: \"If, by some off chance, you're still writing " +
      "quotes at night when it gets busy, would you consider looking at another way?\"",
  },
  {
    key: "no_why",
    text:
      "Never ask \"why\" — \"why do you do it that way?\" sounds like an accusation. Ask with " +
      "\"what\" and \"how\", and soft words: typically, potentially, consider, reasonable. " +
      "\"What's typically the worst part of quoting for you?\"",
  },
  {
    key: "no_pounce",
    text:
      "Do not pounce on a pain. When they name a problem, ask one more question about it before " +
      "saying anything about FieldQuo: \"What does that end up costing you?\"",
  },
  {
    key: "fair_enough",
    text:
      "Check agreement as you go. End a suggestion with \"fair enough?\" or \"does that sound " +
      "reasonable?\" and listen to how they say yes. A flat \"yeah, sure\" means something was " +
      "skipped — ask what is on their mind.",
  },
  {
    key: "label_feeling",
    text:
      "If you sense hesitation, say it: \"I get the feeling this might not be the right fit for " +
      "you right now. Am I right?\" It brings the real concern out.",
  },
  {
    key: "listen",
    text: "Listen far more than you talk. Ask, then stop. Silence is fine; whoever fills it tells you the most.",
  },
  {
    key: "match_style",
    text:
      "Match their style. In a hurry: short, results, no small talk. A talker: let them talk. " +
      "Easygoing: warm, ask what they think, never steamroll. Detail-minded: specifics from the " +
      "facts, give them time, never rush them.",
  },
  {
    key: "give_control",
    text:
      "Give them control. \"Let's not decide anything right now\" and \"then you decide if it's " +
      "worth keeping\" take the pressure off, and people move forward more easily without it.",
  },
]);

/**
 * The five-step objection answer, in order — said in two to four sentences,
 * and step three is never an argument: it moves to the next step (owner,
 * 2026-10-01: you cannot win an objection on the phone, so do not try).
 */
export const FIVE_STEP_ANSWER = Object.freeze([
  "Agree: \"Totally fair.\"",
  "Speak from their side: \"If I were you, I'd be sceptical of another app too.\"",
  "Move to the next step instead of arguing: \"Let's not decide anything now…\" — and the demo with a person",
  "Say what is in it for them: \"…and you'll see whether it gets your evenings back.\"",
  "Give them control and check: \"Then you decide, and either way it's no big deal. Fair enough?\"",
]);

/**
 * The stories rule, as the phone prompt wraps it. Shared with the chat
 * section so the one sentence check-sales-ai-technique's STORY_RULE regex
 * scrubs before scanning for invented customers is the same sentence on
 * every surface.
 */
export const STORIES_RULE = Object.freeze([
  "Stories: you have not met any customers, so never tell a story about one — no name, no",
  "\"I spoke with a painter\", no \"owners I talk to\", no number and no result. Only the pattern",
  "form: \"A lot of owners say the same thing, then…\". Never invent a customer.",
]);

/**
 * The common objections, each answered in the five-step shape.
 *
 * `lines` is the phone prompt's own wording, line-wrapped exactly as
 * phoneTechnique() has always rendered it — it is spread in verbatim, so the
 * phone agent's prompt did not change by one byte when this became data.
 * `chat` exists only where the phone wording is about a phone ("from this
 * call", "off one phone call") or would collide with a rule the chat surface
 * already has (Jennifer's savings tool, her "don't tell them something wrong"
 * rule for anything not in the facts). Everything else is said identically,
 * because the copy nobody reads is the one that drifts.
 */
export const OBJECTIONS = Object.freeze([
  {
    key: "busy",
    lines: [
      "- \"I'm busy\": totally fair, busy means work is coming in. If they are truly up a ladder or",
      "  driving, go to the next step below. Otherwise: let's not do it now — the demo, at a time that",
      "  suits them better, and then they decide.",
    ],
  },
  {
    key: "partner",
    lines: [
      "- \"I need to talk to my partner first\": that makes sense, it's a decision you make together.",
      "  Let's not decide anything now — a demo at a time they are both around. If the partner signs",
      "  off on spending, do not push past that.",
    ],
  },
  {
    key: "no_time_to_learn",
    lines: [
      "- \"I don't have time to learn new software\": totally fair, they're on site all day. Let's not",
      "  decide anything now — the demo will show whether it's quicker than how they quote today.",
    ],
  },
  {
    key: "paper_works",
    lines: [
      "- \"Pen and paper / a spreadsheet works fine\": if it works, don't fix it. Let's not change",
      "  anything now — the demo will show whether it holds up better when they're busy.",
    ],
  },
  {
    key: "too_expensive",
    lines: [
      "- \"Too expensive\": I hear you, nobody needs another bill. Let's not decide anything now — the",
      "  demo will show what it's worth for their size. Never say it pays for itself and never work out",
      "  a return.",
    ],
    chat: [
      "- \"Too expensive\": I hear you, nobody needs another bill. Let's not decide anything now — the",
      "  demo will show what it's worth for their size. Never say it pays for itself and never promise a",
      "  saving. If they ask what it costs or what it would save, the figure comes only from your tools,",
      "  exactly as the rules above say, and it is an estimate, not a promise.",
    ],
  },
  {
    key: "tried_before",
    lines: [
      "- \"I tried software before and hated it\": ask what they didn't like and let them finish. That's",
      "  fair. Let's not decide anything now — the demo will show whether it feels like the last one.",
    ],
  },
  {
    key: "send_info",
    lines: [
      "- \"Just send me some info\": you cannot send anything from this call. A brochure can't tell them",
      "  whether it fits; the demo can.",
    ],
    chat: [
      "- \"Just send me some info\": you cannot send anything, and this chat keeps no email address. A",
      "  page can show what is included, but it can't tell them whether it fits their business; the",
      "  demo can.",
    ],
  },
  {
    key: "think_about_it",
    lines: [
      "- \"I want to think about it\": makes sense, it's a real decision. Let's not decide anything now —",
      "  the demo gives them the facts to think it over.",
    ],
  },
  {
    key: "other_app",
    lines: [
      "- \"I already use another app\": that makes sense. Ask: if you could change one thing about it,",
      "  what would it be? Let's not change anything now — the demo will show whether that one thing is",
      "  better. Never criticise the other app, and never claim a difference that is not in the facts.",
    ],
  },
  {
    key: "do_you_have",
    lines: [
      "- \"Do you have …?\": if it is in the facts, yes. If not, \"not right now\" — never a date.",
    ],
    chat: [
      "- \"Do you have …?\": if it is in the facts, yes, in a sentence. If it is not, never guess either",
      "  way — say you don't want to tell them something wrong, as the rules above say — and never a date.",
    ],
  },
  {
    key: "not_sure",
    lines: [
      "- \"Not sure\": fair enough, nobody has to be sure off one phone call. The demo is where they find out.",
    ],
    chat: [
      "- \"Not sure\": fair enough, nobody has to be sure from one chat. The demo is where they find out.",
    ],
  },
]);

/**
 * The phone agent's technique section.
 *
 * @param trial          from salesKnowledge (kb.trial) — its days and label
 *                       already come from lib/pricing.js; passed through so
 *                       the phone says exactly what the facts block says.
 * @param canTransfer    whether transfer_to_human exists. When it does not,
 *                       the tool name must not appear here either —
 *                       check:sales-agent asserts the no-transfer prompt never
 *                       hands the agent a tool it does not have.
 * @param callsRecorded  whether anything said is kept. Without it there is no
 *                       callback to arrange, and saying otherwise is a
 *                       promise nobody can keep.
 * @param contactUrl     the real, monitored route when nobody can be reached.
 * @param signupUrl      where a caller starts the trial themselves.
 */
export function phoneTechnique({
  trial = null,
  cardRequired = TRIAL_CARD_REQUIRED,
  canTransfer = false,
  callsRecorded = false,
  contactUrl = "fieldquo.com/contact",
  signupUrl = "fieldquo.com/signup",
  referral = referralTerms(),
} = {}) {
  const terms = trialTerms({ days: trial?.days ?? TRIAL_DAYS, label: trial?.label || null, cardRequired });
  const person = canTransfer ? "put them through to a person with transfer_to_human" : `send them to ${contactUrl}`;

  const lines = [
    "",
    TECHNIQUE_HEADING,
    "This is how to talk, not what is true. It never overrides the absolute rules above: every",
    "capability, price and term you mention still comes only from the facts above, and you still",
    "never promise, discount or guarantee anything.",
    "",
    "You are not chasing a sale. You are finding out whether FieldQuo fixes a problem this caller",
    "has, and letting them tell you. Be calm and curious, and sound fine either way. Ask, do not",
    "tell: people believe what they say out loud. Neutral words — \"see if it's a fit\", never hype.",
    "Keep it short: a few questions, almost no talking about the product, and one next step.",
    "",
    "THE MOVES",
    ...MOVES.map((m) => `- ${m.text}`),
    "",
    "DISCOVERY BEFORE FEATURES — TWO QUESTIONS, NOT TEN",
    "Before describing anything, ask one question at a time and let them answer: what has them",
    "looking at this, and when they want something in place. That is enough for this call; the",
    "deeper questions belong in the demo. Say their own words back to them. If they ask what FieldQuo",
    "does, answer in a sentence or two, from the facts above, only the parts that fix what they named,",
    "then go back to the next step. If they say everything is fine, pull back: \"Sounds like you've got",
    "it figured out. What made it work for you?\" Either they convince you, or they name the gap.",
    "",
    "ANSWERING AN OBJECTION — TWO TO FOUR SENTENCES, NEVER AN ARGUMENT",
    "Nobody is talked out of an objection on the phone, so do not try. Use the five steps, then move on:",
    ...FIVE_STEP_ANSWER.map((s, i) => `${["One", "Two", "Three", "Four", "Five"][i]}. ${s}`),
    "If the same objection comes back, do not answer it harder: agree, and say the demo will show",
    "them either way.",
    "",
    ...STORIES_RULE,
    "",
    "How the common ones go, in that shape:",
    ...OBJECTIONS.flatMap((o) => o.lines),
    "If they ask not to be contacted, or are annoyed, end politely and ask nothing more.",
    "",
    "THE GOAL OF THIS CALL: A DEMO WITH A PERSON",
    "The call does not close a sale and does not push the trial. Its goal is a demo with a person at",
    "FieldQuo, who shows them the parts that fit and lets them decide. Offer it as the next step:",
    "\"The best way to see if it fits is a short demo with one of the team. Fair enough?\"",
  ];

  if (canTransfer) {
    lines.push(
      "If they want it, tell them you are putting them through to someone who can book it, and use",
      "transfer_to_human. You cannot book a time yourself; the person they reach does.",
    );
  } else if (callsRecorded) {
    lines.push(
      "You cannot book it yourself and you cannot put them through. Ask which suits them better —",
      "earlier or later in the week, morning or afternoon — and make sure their name, their number,",
      "their email and that choice are said clearly, because that is what gets read. Never promise",
      "anyone will ring at that time (see WHEN YOU CANNOT ANSWER).",
      `If they would rather reach someone in writing, send them to ${contactUrl}.`,
    );
  } else {
    lines.push(
      `You cannot book it, put them through, or keep anything said here. To get the demo, ${person}.`,
    );
  }

  lines.push(
    "",
    "THE FREE TRIAL — ONLY WHEN THEY ASK",
    "If they ask to start now, or clearly want to, tell them how: they sign up themselves at",
    `${signupUrl}. ${terms.sentence} Offer to stay on the line while they do it. Never offer the`,
    "trial as the next step yourself, and never push it.",
    "",
    "EVERY CALL ENDS WITH A CONCRETE NEXT STEP, best first:",
    `First: the demo with a person — ${canTransfer ? "put them through with transfer_to_human" : callsRecorded ? "their choice of time, said clearly for the recording" : `send them to ${contactUrl}`}.`,
    "Next: the trial, at their own request, while you are on the phone.",
  );

  if (callsRecorded) {
    lines.push(
      "Next: a callback. Ask what day and time suits them, offered as two choices, and make sure their",
      "name, number, that day and time, and what they want to look at are said clearly — that is what",
      "gets read. Never promise anyone will ring at that time (see WHEN YOU CANNOT ANSWER).",
      "Next: later — interested, but not now. Ask when would be a better time, and say it back clearly.",
    );
  } else {
    lines.push(
      "Nothing said on this call is kept, so you cannot arrange a callback or a later time. If it",
      `is not now, ${person}.`,
    );
  }
  lines.push(
    "Last: not a fit, or asked not to be contacted — thank them and end politely.",
    "Never end on \"I'll get back to you\" or \"I'll think it over\" without one of these.",
  );

  lines.push(
    "",
    "THE REFERRAL QUESTION — at the end of every call, signed up or not",
    `Unless they asked not to be contacted or were annoyed, ask before you put them through or end the call: "Before you go — ${REFERRAL_ASK.charAt(0).toLowerCase()}${REFERRAL_ASK.slice(1)}`,
    "Another contractor who's buried in paperwork?\" If they hesitate, help them think: someone they",
    "sub for or sub out to, a friend in another trade, someone trying to add a crew this year.",
    "Do not ask for the other person's phone number. The way to pass it on is for them to tell that",
    "person about FieldQuo.",
  );
  if (referral?.sentence) {
    lines.push(
      `${referral.sentence} Say this as the published programme it is, for when they have an`,
      "account and have chosen a plan. It is not a deal you are offering: rule 3 still stands, you never give anyone extra",
      "time yourself, and you cannot apply it to this caller.",
    );
  }

  return lines.join("\n");
}

/**
 * The three moves whose phone wording is about a phone.
 *
 * "The pause is where people hang up" and "silence is fine" describe a call;
 * in a chat window the equivalent failure is a reply that agrees and stops,
 * and the equivalent discipline is one question per message. Two choices of
 * TIME is the phone's move because the phone is where a time gets picked —
 * Jennifer cannot see the demo calendar at all (the booker on the homepage
 * reads it, /api/demo/slots), so naming a time in chat would be inventing
 * one. The two-choices discipline is kept, aimed at the choice she can
 * actually offer: which next step.
 */
const CHAT_MOVE_TEXT = Object.freeze({
  asp:
    "Answer the first resistance with A-S-P. Agree (\"Totally fair.\"). Speak from their side " +
    "(\"If I were running crews all day, I wouldn't want another app to learn either.\"). Then " +
    "Pivot straight to a question about them, in the same message (\"Out of curiosity, how " +
    "are you getting quotes out right now?\"). A reply that only agrees is where people close the chat.",
  two_choices:
    "When it is time to choose a next step, offer two choices — the booking page for a demo, or a " +
    "person by message — never an open \"what would you like to do?\". You cannot see the demo " +
    "calendar, so never name or suggest a day or a time yourself: the booking page shows the times " +
    "that are really open, and they pick one there.",
  listen:
    "Write far less than you ask. One question per message, then stop and let them answer; " +
    "whoever says more tells you the most.",
});

/** MOVES, with the chat wording swapped in by key — same moves, same order. */
export const CHAT_MOVES = Object.freeze(
  MOVES.map((m) => (CHAT_MOVE_TEXT[m.key] ? Object.freeze({ key: m.key, text: CHAT_MOVE_TEXT[m.key] }) : m)),
);

/**
 * The website chat's technique section (Jennifer, visitor mode only).
 *
 * The phone agent's goal and moves, for a stranger typing on fieldquo.com.
 * What differs is what the chat can actually DO, and that is passed in rather
 * than assumed:
 *
 * @param demoMinutes      the length of the demo the booking page books —
 *                         the caller reads it from the constant that governs
 *                         that booking. Absent, the text says "a demo" and
 *                         states no length rather than guessing one.
 * @param demoRouteKey     the offerNavigation key that lands on the demo
 *                         booker, if one exists. Jennifer cannot book: the
 *                         booker is a page the VISITOR uses. Absent, the demo
 *                         goes through the contact route instead.
 * @param contactRouteKey  the offerNavigation key for a person by message.
 * @param signupRouteKey   the offerNavigation key for the trial signup.
 *
 * Deliberately NOT here: escalateToHuman as a way to a demo. In visitor mode
 * that tool files a one-line ticket with no name, email or number on it
 * (app/api/jennifer/route.js, recordAnonymousEscalation) — nobody can book a
 * demo from it, so offering it as one would be a promise the code does not
 * keep.
 */
export function chatTechnique({
  trial = null,
  cardRequired = TRIAL_CARD_REQUIRED,
  demoMinutes = null,
  demoRouteKey = null,
  contactRouteKey = null,
  signupRouteKey = null,
  referral = referralTerms(),
} = {}) {
  const terms = trialTerms({ days: trial?.days ?? TRIAL_DAYS, label: trial?.label || null, cardRequired });
  const mins = Number(demoMinutes);
  const demo = Number.isInteger(mins) && mins > 0 ? `a ${mins}-minute demo` : "a demo";
  const nav = (key) => `offerNavigation with "${key}"`;
  const demoStep = demoRouteKey
    ? `${nav(demoRouteKey)} — the booking page`
    : contactRouteKey
      ? `${nav(contactRouteKey)} — a person, who books it`
      : "tell them to ask for it on the contact page";

  const lines = [
    TECHNIQUE_HEADING,
    "This is how to talk, not what is true. It never overrides the rules above: every capability,",
    "price and term you mention still comes only from WHAT FIELDQUO IS and your tools, you still never",
    "offer a discount or a deal, and ESCALATE, DON'T ANSWER still comes before anything here.",
    "",
    "WHO THIS IS FOR",
    "Someone deciding whether FieldQuo is right for their business. If they say they already use",
    "FieldQuo, or something of theirs is not working, none of this section applies: help them or get",
    "them to a person, and do not ask discovery questions, suggest a demo or ask the referral question.",
    "A support answer never turns into a pitch.",
    "",
    "You are not chasing a sale. You are finding out whether FieldQuo fixes a problem they have, and",
    "letting them tell you. Be calm and curious, and sound fine either way. Ask, do not tell: people",
    "believe what they say themselves. Neutral words — \"see if it's a fit\", never hype. Keep each",
    "reply short: a sentence or two, then at most one question.",
    "",
    "THE MOVES",
    ...CHAT_MOVES.map((m) => `- ${m.text}`),
    "",
    "ASK BEFORE TELLING — ONE OR TWO QUESTIONS, NOT TEN",
    "Before describing FieldQuo, ask one question at a time and let them answer: how they handle",
    "quotes and invoices today, and when they want something better in place. That is enough here;",
    "the deeper questions belong in the demo. Say their own words back to them. If they ask something",
    "direct first — what it costs, whether it does something — answer that first, briefly and from",
    "the facts and your tools, then ask; never make them answer questions to get an answer. Describe",
    "only the parts that fix what they named. If they say everything is fine, pull back: \"Sounds like",
    "you've got it figured out. What made it work for you?\" Either they convince you, or they name the gap.",
    "",
    "ANSWERING AN OBJECTION — TWO TO FOUR SENTENCES, NEVER AN ARGUMENT",
    "Nobody is talked out of an objection in a chat window, so do not try. Use the five steps, then move on:",
    ...FIVE_STEP_ANSWER.map((s, i) => `${["One", "Two", "Three", "Four", "Five"][i]}. ${s}`),
    "If the same objection comes back, do not answer it harder: agree, and say the demo will show",
    "them either way.",
    "",
    ...STORIES_RULE,
    "",
    "How the common ones go, in that shape:",
    ...OBJECTIONS.flatMap((o) => o.chat || o.lines),
    "If they are annoyed or want to be left alone, stop asking: answer only what they ask.",
    "",
    `THE GOAL OF THIS CHAT: ${demo.toUpperCase()} WITH A PERSON`,
    "The chat does not close a sale and does not push the trial. Its goal is",
    `${demo} with a person at FieldQuo, who shows them the parts that fit and lets them decide.`,
    "Once they have told you enough to see a fit, offer it as the next step: \"The best way to see",
    `if it fits is ${demo} with one of the team. Fair enough?\"`,
    "You cannot book it, see the calendar or hold a time, so never say it is booked and never name",
  ];

  if (demoRouteKey) {
    lines.push(
      `a time. When they want it, call ${nav(demoRouteKey)}: it shows them a button to the booking`,
      "page, where they pick a day and a time from the ones really open, or leave their number for a",
      "call back. Nothing is booked until they finish it there; say so plainly.",
    );
    if (contactRouteKey) {
      lines.push(`If they would rather write to a person first, ${nav(contactRouteKey)} instead.`);
    }
  } else if (contactRouteKey) {
    lines.push(
      `a time. When they want it, call ${nav(contactRouteKey)}: a person reads that and books it.`,
    );
  } else {
    lines.push("a time.");
  }
  lines.push(
    "Never use escalateToHuman to get a demo — it is only for what ESCALATE, DON'T ANSWER lists.",
    "",
    "THE FREE TRIAL — ONLY WHEN THEY ASK",
    `If they ask to start now, or clearly want to, tell them how: they sign up themselves${signupRouteKey ? ` (${nav(signupRouteKey)})` : ""}.`,
    `${terms.sentence} Never offer the trial as the next step yourself, and never push it.`,
    "",
    "EVERY CONVERSATION ENDS WITH A CONCRETE NEXT STEP, best first:",
    `First: ${demo} with a person — ${demoStep}.`,
    "Next: the trial, only at their own request.",
  );
  if (demoRouteKey && contactRouteKey) {
    lines.push(`Next: a person by message — ${nav(contactRouteKey)}.`);
  }
  lines.push(
    "Last: not a fit, or they want to be left alone — thank them and stop.",
    "Never end on \"let me know if you have any questions\" without one of these.",
    "",
    "THE REFERRAL QUESTION — once, after the next step",
    "Unless they were annoyed or want to be left alone, ask it once, after the next step is settled:",
    `"Before you go — ${REFERRAL_ASK.charAt(0).toLowerCase()}${REFERRAL_ASK.slice(1)} Another contractor who's buried in paperwork?"`,
    "Never ask for that person's name, number or email — this chat keeps nothing. The way to pass it",
    "on is for them to tell that person about FieldQuo.",
  );
  if (referral?.sentence) {
    lines.push(
      `${referral.sentence} Say this as the published programme it is, for when they have an`,
      "account and have chosen a plan. It is not a deal you are offering: you never give anyone extra time yourself, and you",
      "cannot apply it to this visitor.",
    );
  }

  return lines.join("\n");
}

/**
 * The written technique, for a short text a rep sends.
 *
 * The drafts are rewrites of a deterministic sentence (draft.js), so this is
 * about voice only — it adds no fact and no question the draft did not ask.
 */
export const WRITTEN_TECHNIQUE = Object.freeze([
  `${TECHNIQUE_HEADING} (FieldQuo's selling technique, for a text message):`,
  "- Give them control. No pressure and no hurry; they decide. Never push.",
  "- A reason to talk, tied to what the draft says about them. Never a generic \"just checking in\" when the draft gives a reason.",
  "- Never ask \"why\". Use \"what\" and \"how\", and soft words: typically, consider, reasonable.",
  "- If the draft asks them for a day and time that suits them, keep that. Never suggest a day or a time yourself.",
  "- If the draft says the rep is around this weekend if they need anything, keep that sentence.",
  "- One easy question, then stop. No hype words.",
]);

/**
 * The line a rep's weekend text carries.
 *
 * The doc's warm-lead Friday text, as the closing sentence of a check-in that
 * goes out on a Friday. GSM-7 only — see draft.js's MAX_SMS_CHARS header.
 */
export const WEEKEND_LINE = "I am around this weekend if you need anything.";

/**
 * The day-and-time ask a check-in offer ends with.
 *
 * A statement, not a question, on purpose: the check-in's one question is
 * "how is it going", and the technique is one easy question, then stop. Two
 * question marks back to back read as a form to fill in.
 */
export const DAY_AND_TIME_ASK = "just tell me a day and time that suits you.";

/**
 * Is `date` a Friday where the recipient is?
 *
 * Only with a zone. A Friday evening in Toronto is Saturday in UTC, and a
 * guessed zone would put "this weekend" on a Saturday text — absence of a
 * zone is not a statement of one (AGENTS.md failure class 5), so no zone
 * means no weekend line.
 */
export function isFridayIn(date, timeZone) {
  if (!timeZone || !date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  try {
    const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(d);
    return day === "Friday";
  } catch {
    return false;
  }
}
