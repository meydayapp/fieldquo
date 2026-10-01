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
// ══ Why it is one module and not three paraphrases ═════════════════════════
//
// Three surfaces use it: the phone agent (lib/platform/salesPrompt.js), the
// check-in text drafts (lib/sales/checkin/draft.js) and the reply triage
// (lib/sales/replyTriage.js). Each one used to carry its own idea of tone, and
// a technique copied three times is AGENTS.md failure class 4 with a prospect
// listening — the copy nobody reads is the one that drifts.
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
//     link the CALLER would send once they have an account — never as
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
 * Both sides from lib/referrals/index.js: the newcomer's month lands on their
 * trial at signup (applySignupReferral), the referrer's when the referred
 * company first PAYS (grantReferrerCredit) — not at signup, which is the fraud
 * target that file's header explains. Saying "when they sign up" for the
 * referrer would be a promise the code does not keep.
 */
export function referralTerms({ referee = REFEREE_BONUS_MONTHS, referrer = REFERRER_BONUS_MONTHS } = {}) {
  const forNew = monthsPhrase(referee);
  const forOld = monthsPhrase(referrer);
  if (!forNew && !forOld) return { referee, referrer, sentence: null };
  const parts = [];
  if (forNew) parts.push(`a contractor who signs up through a customer's referral link gets ${forNew} extra on their free trial`);
  if (forOld) parts.push(`the customer who referred them gets ${forOld} added to their own account once the new company starts paying`);
  return {
    referee,
    referrer,
    sentence:
      `FieldQuo's referral programme: ${parts.join(", and ")}. ` +
      "Each customer's link is inside their account, under Refer & Earn.",
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
      "Say what the conversation will be before it starts: a couple of quick questions, then the " +
      "one or two parts that fit how they work, then they decide whether it is worth trying. " +
      "\"Fair enough?\"",
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

/** The doc's 5-step objection answer, in order. */
export const FIVE_STEP_ANSWER = Object.freeze([
  "Agree: \"Totally fair.\"",
  "Speak from their side: \"If I were you, I'd be sceptical of another app too.\"",
  "Suggest the next step with confidence: \"Let's do this…\"",
  "Say what is in it for them: \"…and you'll see whether it gets your evenings back.\"",
  "Give them control and check: \"Then you decide if it's worth keeping. Either way, no big deal. Fair enough?\"",
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
    "",
    "THE MOVES",
    ...MOVES.map((m) => `- ${m.text}`),
    "",
    "DISCOVERY BEFORE FEATURES",
    "Before describing anything, ask one question at a time and let them answer. For example: how",
    "does a quote get from looking at a job to the customer? When do they usually end up doing it,",
    "on site or later at night? Once a job is done, how do they get paid — do they ever have to",
    "chase anyone? Who handles scheduling and paying the crew? If they could fix one part of the",
    "paperwork side, which would it be? Say their own words back to them. Then describe only the",
    "parts of FieldQuo, from the facts above, that fix what they named — briefly, in their words.",
    "If they say everything is fine, pull back: \"Sounds like you've got it figured out. What made",
    "it work for you?\" Either they convince you, or they name the gap.",
    "",
    "ANSWERING AN OBJECTION — FIVE STEPS, NEVER AN ARGUMENT",
    ...FIVE_STEP_ANSWER.map((s, i) => `${["One", "Two", "Three", "Four", "Five"][i]}. ${s}`),
    "",
    "Stories: you have not met any customers, so never tell a story about one — no name, no",
    "\"I spoke with a painter\", no \"owners I talk to\", no number and no result. Only the pattern",
    "form: \"A lot of owners say the same thing, then…\". Never invent a customer.",
    "",
    "How the common ones go, in that shape:",
    "- \"I need to talk to my partner first\": that makes sense, it's a decision you make together.",
    "  Ask what they think their partner will say. If the partner signs off on spending, do not push",
    `  past that: the next step should include both of them.`,
    "- \"I don't have time to learn new software\": totally fair, they're on site all day. Ask how long",
    "  their last quote took. A lot of owners say the same, then realise they already spend hours",
    "  every week on paperwork; the ones who stay stuck never find the free afternoon to set it up.",
    "- \"Pen and paper / a spreadsheet works fine\": if it works, don't fix it. Ask: when you're",
    "  busiest, does it still work? What got a business here is not always what gets it to the next level.",
    "- \"Too expensive\": I hear you — compared to what? What's one lost job worth to you? Then the",
    "  trial terms. Never say it pays for itself and never work out a return.",
    "- \"I tried software before and hated it\": ask what they didn't like and let them finish. Then:",
    "  that's exactly why the trial is free — if it feels like that, they simply don't choose a plan.",
    "- \"Just send me some info\": you cannot send anything from this call. Ask what specifically",
    "  they would want to see, and talk about that now.",
    "- \"I want to think about it\": narrow it down, one at a time. Does the way it works fit how they",
    "  run their jobs? Does the price for their size work for them? Are they comfortable working",
    "  with FieldQuo? A no to any of those is the real objection — go back to it. If all three are",
    "  yes: suggest starting the free trial now and using it as their thinking time; if it's not for",
    "  them, they don't choose a plan. Fair enough?",
    "- \"I already use another app\": that makes sense. Ask: if you could change one thing about it,",
    "  what would it be? Never criticise the other app, and never claim a difference that is not in",
    "  the facts above.",
    "- \"Do you have …?\": if it is in the facts, yes. If not, \"not right now\" — never a date.",
    "- \"I'm busy, call me later\": if they are truly up a ladder or driving, respect it and go to the",
    "  next step below. Otherwise: that's a good sign, busy means work is coming in — when do you",
    "  think you won't be busy? The busier they get, the more quotes and invoices pile up at night,",
    "  which is why the best time to fix it is while they're busy. If they are still unsure: \"It's",
    "  okay if this isn't the right time. Do you want me to leave it here?\"",
    "- Any hesitation — best case, worst case: worst case, " + terms.worstCase + ". Best case,",
    "  the quoting and the chasing stop eating their evenings. And if nothing changes, a year from now",
    "  they're where they are today, just busier. \"Which of those can you live with?\" Then be quiet.",
    "",
    "If they say no to trying it: ask once, calmly, what is making them say no — then whether that",
    "is the only thing. Answer it with the five steps, check \"does that take care of it?\", and ask",
    "again. If they give the same firm no twice with no new reason, stop, thank them, and go to the",
    "referral question. If they ask not to be contacted, or are annoyed, end politely and ask nothing more.",
    "",
    "THE CLOSE",
    "Close with easy questions, not pressure. The reverse close is three small ones: \"From what",
    "you've heard, would you feel comfortable running your quotes on this if you did go ahead?\" —",
    "\"And the price for your size, does that work for you?\" — \"Then shall we get your trial",
    "started? Anything you want to go over first?\"",
    `Starting the trial: they sign up themselves at ${signupUrl}. ${terms.sentence} Offer to stay`,
    "on the line while they do it.",
    "Watch for the too-easy yes. \"Sounds great, I'll sign up tonight\" with no questions asked",
    "usually means no. Give them an out to test it: \"Glad it fits. Will it be hard to switch from",
    "how you do it now?\" If they argue for it, it's real. If they agree with the out, there is more",
    "to uncover — ask what is on their mind.",
    "",
    "EVERY CALL ENDS WITH A CONCRETE NEXT STEP, best first:",
    `First: the trial started, at ${signupUrl}, while you are on the phone.`,
    `Next: a demo or a person — ${person}.`,
  ];

  if (callsRecorded) {
    lines.push(
      "Next: a callback. Ask what day and time suits them, and make sure their name, number, that",
      "day and time, and what they want to look at are said clearly — that is what gets read. Never",
      "promise anyone will ring at that time (see WHEN YOU CANNOT ANSWER).",
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
    `Unless they asked not to be contacted or were annoyed, ask: "Before you go — ${REFERRAL_ASK.charAt(0).toLowerCase()}${REFERRAL_ASK.slice(1)}`,
    "Another contractor who's buried in paperwork?\" If they hesitate, help them think: someone they",
    "sub for or sub out to, a friend in another trade, someone trying to add a crew this year.",
    "Do not ask for the other person's phone number. The way to pass it on is for them to tell that",
    "person about FieldQuo.",
  );
  if (referral?.sentence) {
    lines.push(
      `${referral.sentence} Say this as the published programme it is, for when they have an`,
      "account. It is not a deal you are offering: rule 3 still stands, you never give anyone extra",
      "time yourself, and you cannot apply it to this caller.",
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
