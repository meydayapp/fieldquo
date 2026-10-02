// lib/sales/playbook/reverseSelling.js
//
// The Reverse Selling playbook — the owner's call script, in the nine stages,
// with its own objection answers — installed SWITCHED OFF.
//
// ══ Version 2 (2026-10-01): the first call books the demo ═════════════════
//
// Version 1 (2026-09-30) was the owner's closer script: open as someone
// calling to SUPPORT the contractor, ask rather than tell, close on the free
// trial while they were on the phone, and end every call with a referral ask.
// The owner then read the book the method is named after and decided the core
// of it, not just its techniques (2026-10-01): **the job of a first or cold
// call is to BOOK A DEMO**. Starting the trial on the call stays available
// ONLY when the prospect asks for it or clearly wants it now — never pushed.
//
// So the call is short and almost all questions:
//
//   open        who you are, the recording aside, "I know you weren't
//               expecting my call", the owner's own support line, and THEY
//               decide whether it is worth a couple of minutes ("fair
//               enough?");
//   relevance   lay out the call: two questions, then maybe a time on a
//               screen, nothing decided today;
//   discovery   two questions only — what has them thinking about it, and
//               when. Deep discovery is the demo's (reverseSellingScripts.js,
//               the demo script, part three);
//   next_step   BOOK THE DEMO: two concrete choices of time, their email for
//               the invite, a foreshadow of the meeting, then prep questions
//               so the demo is about them;
//   close       the referral ask, on every call.
//
// The other four stages stay (stages.js fixes nine) and become the "only if"
// branches of a short call: everything-is-fine, a pain they name themselves,
// "what is it?", and pushback. Every objection answer is two to four spoken
// sentences that agree, speak from their side, say "let's not decide anything
// now", offer the demo and hand control back — you cannot win an objection on
// the phone, so the answer does not try.
//
// ══ Nothing the owner wrote is deleted ═══════════════════════════════════
//
// Version 1's long answers — the stories, best case / worst case, "let's play
// it out", the narrow-down for "I want to think about it", the beliefs and
// their pictures — are REVERSE_SELLING_BACKUP below, word for word, shown to
// the rep as Backup on the Playbook tab: for the demo, or for a prospect who
// asks for more. Version 1's present, its cost questions, its reverse close
// and ask-resolve-ask moved into the demo script (reverseSellingScripts.js),
// because they belong to the meeting, not the cold call. Version 1's rows are
// fingerprinted in seedHistory.js, so "refresh the built-ins" can bring an
// unedited v1 install up to this one.
//
// ══ The one rule about its words ═════════════════════════════════════════
//
// The owner's lines are kept where he wrote them; the new lines are ours,
// written for trade contractors. Nothing is taken from the book. Where the
// CODE contradicts a line, the code wins and the line says what the code says:
//
//   · the opener carries the recording aside (recordingDisclosure.js) — the
//     call is recorded and the rep is the one who says so;
//   · "I may be catching you at a bad time" is the bad-time move bannedMoves.js
//     refuses (Gong: 2.15% against 11.18%), so the admission is "I know you
//     weren't expecting my call", and the decision is handed over with "fair
//     enough?" instead of "is now a bad time?";
//   · the demo is REP_DEMO_MINUTES long (lib/sales/demoBooking/slots.js) —
//     the length the intro email and the rep's demo page promise — not a
//     number typed here;
//   · prices, seats and crew come from SEAT_LADDER, the trial from TRIAL_DAYS
//     and TRIAL_CARD_REQUIRED, the referral months from lib/referrals — never
//     typed, so a reprice changes the sentence or fails the check;
//   · no line names a day: the next step offers "[day] or [day]" and the rep
//     reads two real days off their own calendar;
//   · the signup link is TEXTED from the call panel, not read out.
//
// ══ Stories: never an invented customer ═══════════════════════════════════
//
// Only the pattern form ("A lot of owners I talk to…") until a rep has a real
// story of their own. scripts/check-reverse-selling-playbook.mjs refuses a
// story that names a person.
//
// ══ Why it is installed switched off, and how it opens ════════════════════
//
// installDefaults() creates it with `active: false`; nothing a rep sees moves
// until the owner presses "Switch on" in the platform console. It opens on
// EVERY prospect (`every_prospect`, selectors.js), at a priority above the
// four starter playbooks — so once it is on, every prospect gets it, including
// one nothing has been recorded for yet (version 3, owner 2026-10-02: those
// used to fall through to no playbook and the old AI script, a second,
// different script). That rule is refused on any playbook that is not an
// approach, so it cannot become the general starter playbook defaults.js
// argues against. The four stay in the database exactly as they are;
// switching this off puts every call back on them. Its objection answers are
// scoped to it (objectionsForPlaybook), so the starter playbooks' library does
// not change by one row while it is installed.
//
// ══ Version 3 (2026-10-02): one script, a thirty-minute demo ══════════════
//
// The demo is REP_DEMO_MINUTES, now thirty — one number with the call panel's
// "Book a demo" — so DEMO_OFFER and every answer that offers it say thirty.
// The call screen draws ONE script for this playbook (reverseSellingScripts.js
// callScreenScripts), not the nine-stage stepper; the stages below are kept
// as they are, because the coach, the experiments, the AI script and the
// Playbook tab read them.
//
// ══ English only, like every playbook line ════════════════════════════════
//
// Stage lines and objection answers are read verbatim and are English, as the
// four starter playbooks are. The headings around them are the rep's language.
import { TRIAL_CARD_REQUIRED, TRIAL_DAYS } from "@/lib/pricing";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { REFEREE_BONUS_MONTHS, REFERRER_BONUS_MONTHS } from "@/lib/referrals";
import { REP_DEMO_MINUTES } from "@/lib/sales/demoBooking/slots";
import { integerInWords } from "@/lib/sales/intel/pageExcerpts";
import { REVERSE_SELLING_KEY } from "./approaches";
import { validatePlaybook } from "./defaults";
import { RECORDING_ASIDE } from "./recordingDisclosure";
import { STAGE_KEYS } from "./stages";
import { seedObjections, validateObjection } from "./objections";

export { REVERSE_SELLING_KEY };

export const REVERSE_SELLING_NAME = "Reverse Selling";
export const REVERSE_SELLING_SELECTOR = "every_prospect";

/**
 * "2" when the first call became "book the demo" (2026-10-01); "3" when the
 * demo became thirty minutes and the playbook began opening on every
 * prospect (2026-10-02). Version 2's rows are fingerprinted in seedHistory.js
 * so "refresh the built-ins" can bring an unedited v2 install up to this one.
 */
export const REVERSE_SELLING_VERSION = "3";

/**
 * Above the four starter playbooks (100 / 90 / 80 / 70), so that switching it
 * on makes it the script. A superadmin who wants it only where nothing else
 * matches sets it below 70 instead — the selector still opens it there.
 */
export const REVERSE_SELLING_PRIORITY = 200;

// ── Facts, from the code that owns them ─────────────────────────────────────
//
// In words, because a digit in a line a rep reads out is what every sweep in
// scripts/ treats as an invented fact, and because the AI call script (which
// is shown these stage lines) may not carry a digit at all.
const W = (n) => integerInWords(n);

/** "fourteen" — TRIAL_DAYS, in words. */
export const TRIAL_DAYS_WORDS = W(TRIAL_DAYS);

/** "thirty" — REP_DEMO_MINUTES, in words: the demo the call books. */
export const DEMO_MINUTES_WORDS = W(REP_DEMO_MINUTES);

/** The meeting, as every answer offers it. One spelling, so the check can find it. */
export const DEMO_OFFER = `${DEMO_MINUTES_WORDS} minutes on a screen`;

const RUNGS = [...SEAT_LADDER].sort((a, b) => a.sortOrder - b.sortOrder);
const seatsPhrase = (n) => (n === 1 ? "one seat" : `${W(n)} seats`);

/**
 * The plan sentence. The ladder's three is SEATS (people who quote, schedule
 * and invoice) and every rung also carries crew, so the line says both rather
 * than under-selling the plan by eight people.
 */
export const PLAN_SENTENCE =
  "Every plan has every feature. You just pick by team size: " +
  RUNGS.map(
    (r, i) => `${r.label}, ${W(r.price)}${i === 0 ? " dollars a month" : ""} for ${seatsPhrase(r.seats)} and ${W(r.crewSeats)} crew`,
  ).join("; ") +
  ".";

/** The cheapest rung, in words — "ninety-nine dollars a month". */
export const STARTS_AT = `${W(RUNGS[0].price)} dollars a month`;

const monthsWords = (n) => (n === 1 ? "a month" : `${W(n)} months`);
const extraMonthsWords = (n) => (n === 1 ? "an extra free month" : `${W(n)} extra free months`);

/**
 * The referral offer, said to the contractor. lib/referrals: the referrer's
 * REFERRER_BONUS_MONTHS land once the referred company PAYS; the newcomer's
 * REFEREE_BONUS_MONTHS land on their trial at signup — when they sign up
 * through the referrer's link.
 */
export const REFERRAL_OFFER =
  `For every contractor you refer who signs up and starts paying, you get ${monthsWords(REFERRER_BONUS_MONTHS)} of FieldQuo free. ` +
  `They get ${extraMonthsWords(REFEREE_BONUS_MONTHS)} on their trial when they sign up with your link.`;

/** What a referred newcomer gets, said to THEM: only through the referrer's link. */
export const REFEREE_OFFER = `If you do try it, sign up through their link and you get ${extraMonthsWords(REFEREE_BONUS_MONTHS)} on your trial.`;

/**
 * The trial sentences. Their only true version is the one where signup takes
 * no card, so if that ever changes this throws rather than putting a false
 * promise on every call.
 */
export function trialLines() {
  if (TRIAL_CARD_REQUIRED !== false) {
    throw new Error(
      "reverseSelling.js: the script promises 'no card needed to start', and TRIAL_CARD_REQUIRED is no longer false. Rewrite the trial lines before installing it.",
    );
  }
  return {
    start: `The first ${TRIAL_DAYS_WORDS} days are free and no card is needed to start. If a sale is running, the pricing page shows it.`,
    plain: `It's free for ${TRIAL_DAYS_WORDS} days. You only add a card if you pick a plan when the trial ends.`,
    rule: `If they ask about trying it, say it clearly: ${TRIAL_DAYS_WORDS} days free, no card needed to start. They only add a card if they choose a plan when the trial ends.`,
  };
}

/**
 * The spoken sentences of a line: directions to the rep (in parentheses) left
 * out, split where a sentence ends. One definition, used by the check that
 * holds every cold-call answer to four.
 */
export function spokenSentences(text) {
  const spoken = String(text || "")
    .replace(/\([^()]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spoken) return [];
  return spoken
    .split(/(?<=[.?!]["”]?)\s+(?=["“]?[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z]/.test(s));
}

/**
 * What FieldQuo is, in two sentences, for a contractor who asks. The "what is
 * it?" stage says it, and the cold-call script's note points at the same words
 * (reverseSellingScripts.js), so the two cannot drift.
 */
export const WHAT_IT_IS =
  "In short: you build the quote on your phone on site, the customer signs and pays online, and it all goes out with your logo and your name.";

// ── The redirect every answer ends on ───────────────────────────────────────
//
// "Let's not decide anything now" + the demo + what's in it for them, then
// control handed back. Built once so forty answers cannot drift apart.
const LETS_NOT = `Let's not decide anything now: let's book ${DEMO_OFFER} this week or next`;
const LETS_NOT_CHANGE = `Let's not change anything now: let's book ${DEMO_OFFER} this week or next`;
const CONTROL = "Then you decide, and either way it's no big deal, fair enough?";

function buildStages() {
  const trial = trialLines();
  const D = DEMO_MINUTES_WORDS;

  return {
    // ── Open: support, then they decide ────────────────────────────────────
    // The owner's support line, verbatim, between the admission and the
    // hand-over. The recording aside sits where the starter opener puts it.
    // "[trade] contractors" is not {tradeName}: a missing trade would refuse
    // the whole opener the second the call connects (defaults.js on why OPEN
    // lines use only the two variables that are always there).
    open: {
      say:
        `Hi, is this {businessName}? … Hey, it's {repName} with FieldQuo — ${RECORDING_ASIDE.en}. ` +
        "I know you weren't expecting my call. We support contractors who are doing their quotes and " +
        "invoices at night after a full day on site. I'm calling to see if that's something we can take " +
        "off your plate. If it's worth a couple of minutes, I'll ask you two quick questions and you " +
        "decide from there. Fair enough?",
      prompts: [
        "If yes, straight to a question about them: \"Out of curiosity, how are you handling your quotes and invoices right now?\"",
        "Truly on a ladder or driving? \"No problem at all. When's better, later today or tomorrow morning?\" Book the callback in the dialer.",
      ],
      tips: [
        "The cold call has one job: book the demo. Not to sell, not to start a trial, not to run the whole discovery. Say who you are and why you're calling in one line, let them decide if it's worth a couple of minutes, ask two questions, book a time. The rest is for the demo.",
        "The rep who cares most about the prospect wins the sale. You're not chasing a sale: you're finding out if this contractor has a problem FieldQuo fixes, and letting them tell you. Letting them hang up still stuck at the kitchen table at nine at night is the real failure.",
        "Detach from the outcome. Sound like you are fine either way. The less you need the sale, the more they lean in. Slow down: a little slower and softer than feels natural. Pauses are fine.",
        "A fast \"not interested\" in the first ten seconds isn't a real no. It's a reflex, like \"just looking\" in a store. Don't argue with it and don't take it literally.",
        "Answer first resistance with A-S-P: Agree (\"Totally fair.\"), Speak from their side (\"If I was running crews all day, I wouldn't want another app to learn either.\"), then Pivot straight to a question with no pause. The pause is where they hang up.",
        "If they say they're busy, use the \"I'm busy right now\" answer under If they push back.",
        "Match their style. Driver: short, results, no small talk. Talker: let them talk, bring energy. Easygoing: be warm, ask what they think, don't steamroll. Detail person: numbers and specifics, give them time, never rush them.",
        "Voice goes up on questions, down on statements. Up invites an answer. Down sounds sure of itself.",
        "Only call within the calling hours the dialer allows; it enforces them by state and province.",
      ],
    },

    // ── Lay out the call, check agreement, give control ───────────────────
    relevance: {
      say:
        "Great. And if it sounds like we can help, we book a proper look on a screen another day. " +
        "Nothing gets decided today. Fair enough?",
      prompts: [],
      tips: [
        "Lay out the call before you start. People relax when they know what's coming.",
        "Check agreement as you go. End every suggestion with \"fair enough?\" or \"does that sound reasonable?\" and listen to how they say yes. A flat \"yeah, sure\" means you skipped something.",
        "Give them control. \"Let's not decide anything right now\" and \"then you decide if it makes sense\" take the pressure off, and people move forward more easily without it.",
        "Neutral words. Say \"see if it's a fit,\" not \"let me show you how amazing this is.\" No hype words.",
      ],
    },

    // ── Discovery: two questions, no more ─────────────────────────────────
    discovery: {
      say: "What's the part of that you'd most like to get off your plate?",
      prompts: [
        "\"And is that something you'd want sorted before the busy season, or is it more of a someday thing?\"",
        "That's enough for today. Say their words back, write them in the call notes, and go to Next step.",
      ],
      tips: [
        "Two questions on a cold call: what has them thinking about it, and when. The deep questions are the demo's job (Demo script, part three), once they've agreed to give you the time.",
        "Ask one question, then listen. Repeat their words back. Write their exact phrases in the call notes; you'll open the demo with them.",
        "Ask, don't tell. People believe what they say out loud, not what you say.",
        "Talk thirty per cent, listen seventy. Ask, then stop. Let the silence sit. Whoever fills it tells you the most.",
        "Skip \"why\". \"Why do you do it that way?\" sounds like an accusation. Use \"what\" and \"how\", plus soft words: typically, potentially, consider, reasonable.",
      ],
    },

    // ── Only if: everything is fine ───────────────────────────────────────
    current_process: {
      say: "Honestly, sounds like you've got it figured out. Most guys I talk to don't. What made it work for you?",
      prompts: [
        "\"If by some off chance you're still writing quotes at night when spring gets busy, would you consider looking at another way?\"",
        "If they want to keep talking about how it works today, let them, write it down, then go to Next step: \"That's exactly what the demo is for.\"",
      ],
      tips: [
        "Everything fine? Either they convince you (end politely and ask for a referral — Wrap up) or they admit the gap.",
        "Pull back instead of pushing. When they hesitate, give them room: \"Maybe this isn't a fit, and that's okay.\" It lowers their guard and they often argue for it.",
        "Ask hypotheticals they're happy to answer. They say yes because they don't expect it to happen, and now you have a reason to call back.",
        "If you feel something, say it: \"I get the feeling this might not be the right fit for you right now. Am I right?\" It brings the real concern out.",
      ],
    },

    // ── Only if: they name a problem ──────────────────────────────────────
    pain: {
      say: "What does that end up costing you?",
      prompts: [
        "\"How many evenings a week does that eat up?\"",
        "Then straight to Next step. The rest of the cost questions are in the Demo script, part three.",
      ],
      tips: [
        "Don't pounce. When they name a pain, don't jump in with \"we fix that!\" Ask one more question about it first. Pitching the second someone opens up makes them close up.",
        "One question about the pain on a cold call, not five. Helping them feel what it costs, and picture life without it, is what the demo is for.",
      ],
    },

    // ── Only if: they ask what it is ──────────────────────────────────────
    fit: {
      say: `${WHAT_IT_IS} The easiest way to see if it fits how you work is a quick demo on a screen.`,
      prompts: [
        `If they ask the price: "It starts at ${STARTS_AT}, every plan has every feature, and you pick by team size. I'll show you yours in the demo."`,
        `Only if they ask to try it: "${trial.start}" Text the signup link from the call panel.`,
      ],
      tips: [
        "Don't present on a cold call. Two sentences, then back to booking the demo. The full present, in their own words, is in the Demo script, part four.",
        trial.rule,
        `If they want every price now: ${PLAN_SENTENCE}`,
        "Never promise income, results, or numbers you can't back up.",
      ],
    },

    // ── If they push back: short, then the next step ──────────────────────
    // The library below the stage is this playbook's own answers (ownCodes),
    // and every shared answer is hidden on this screen (hideCodes), because
    // each has a short Reverse Selling version.
    objections: {
      say: `Totally fair. If I was you, I'd be skeptical of another app too. ${LETS_NOT}, and you'll see if it gets your evenings back. ${CONTROL}`,
      prompts: [],
      tips: [
        "You can't win an objection on the phone, so don't try. Two to four sentences, then the next step: agree; speak from their side; \"let's not decide anything now\" and the demo; what's in it for them; then they decide, either way no big deal, fair enough?",
        "Never argue. If the same objection comes back, don't answer it harder: \"Totally fair. That's exactly what the demo will show you, either way.\"",
        "The longer answers, the stories, best case / worst case and \"let's play it out\" are under Backup on the Playbook tab. They're for the demo, or for a prospect who asks for more. Not for the cold call.",
        "Story rule: only tell stories that really happened. Use a real contractor you spoke to (first name only, never their business name). Until you have your own, use the pattern version: \"A lot of owners I talk to…\" Never invent a customer. If a prospect later asks for that person's number, you need to be able to stand behind it.",
        "Every story has the same three beats: same situation as the prospect, what they decided, where it left them.",
        "Story bank: after every call, write one real story in the notes (trade, situation, what they decided, what happened). Share the good ones with the team so everyone has real stories within the first few weeks.",
        "A belief they've held for years can't be argued away on a cold call. Agree, book the demo, and use the picture from their own trade (Backup) there.",
        "Build your own: when you hear a new belief, ask yourself \"what's the equivalent on a job site?\" Share the ones that land with the team.",
        "Wife or partner: book the demo for a time you're both around. Never leave it open-ended.",
        "Already on Jobber, Housecall Pro or another app? Its battlecard is on the Playbook tab: type the app's name in the search. Never trash the other app.",
      ],
    },

    // ── Next step: BOOK THE DEMO ──────────────────────────────────────────
    // Two choices, never "what time works". Then the email for the invite,
    // the foreshadow, the prep questions. The trial is here only for the
    // prospect who asks for it.
    next_step: {
      say: `Let's do this: let's set up ${DEMO_OFFER}. I've got [day] or [day]. Which is better for you, morning or afternoon?`,
      prompts: [
        "Then their email: \"What's the best email for the invite? I'll send you something useful before we talk.\"",
        `Foreshadow: "Here's how the ${D} minutes go: I'll ask a few questions, show you only the parts that fit, then you decide if it makes sense. Fair enough?"`,
        "Prep, so the demo is about them: \"What trade are you in, and how many on the crew?\"",
        "\"What are you using now for quotes and invoices, and how does a quote usually go out?\"",
        "\"What's your biggest worry about changing anything? Anything you want to be sure we cover?\"",
        `Only if they ask to start now: "Sure. ${trial.start}" Text the signup link and stay on the line.`,
        "Won't book? \"No problem. When's better to talk again, [day] or [day]?\" Book the callback with a day, a time and a reason.",
      ],
      tips: [
        "The cold call ends in a booked demo. Book it under Next step in the call panel: it goes on your calendar, and the invite goes to the email they give you.",
        "Two real choices off your calendar, never \"what time works for you?\". An open question makes them do the work; two choices make it easy to pick one.",
        "Starting the free trial on the call is for when THEY ask for it, or clearly want it now. Never push it. A trial they didn't ask for is one they don't open.",
        "The prep questions make the demo about them. Write the answers in the call notes; the demo opens with them.",
        "Send something useful before the meeting: the follow-up email (The email, the day after) with one real quote for a job like theirs.",
        "Every call ends with one of these, best first: demo booked (a day and time, invite sent); trial started, only because they asked; callback agreed (a day and time, their email, and a reason to call).",
        "Later lead: interested, but not now. Ask when, then call back at half that time (\"you said spring, so I'll check in early February\"), then monthly until then. Not a fit (rude, out of business, or asked not to be called): mark it and move on.",
        "Never end on \"I'll get back to you\" without a day and time.",
        "Follow-up: it takes about eight tries to reach someone, so try the same day and every day after, at different times. Hot (demo in the next few days): every day until it happens. Warm: every Monday, and the Friday text in Follow-up calls on the Playbook tab.",
        "End of day: call your five hottest leads before you log off; people pick up more in the evening. Know your numbers: dials, conversations, demos booked, demos held, paying customers. Your ratios show which step to work on.",
      ],
    },

    // ── Wrap up: the referral ask, every call ─────────────────────────────
    close: {
      say:
        "You're all set for [day] at [time], and the invite's on its way. Quick question before I let you " +
        "go: who do you know that could benefit from this too? Another contractor who's trying to grow " +
        "their company and is buried in paperwork?",
      prompts: [
        "If they hesitate: \"Maybe a guy you sub for, or someone you sub out to? A buddy in another trade, roofing, HVAC, plumbing? Someone who's trying to add a crew this year?\"",
        "\"Who else do you know who wants to scale their business?\"",
        "If they didn't book: \"No problem at all, I appreciate your time. One last thing: who do you know that's growing their company and might need something like this?\"",
        "If they started the trial because they asked: \"Congrats, you're going to love getting your evenings back.\" Then the same question.",
        `"${REFERRAL_OFFER}"`,
        "\"Your link is in FieldQuo under Settings, Refer & Earn, and it can send the invite for you.\"",
        "Get the details: name, trade, phone number, and whether you can say they sent you.",
      ],
      tips: [
        "Ask on every call, whether they booked or not. People who said no often still know someone who needs it.",
        "The referral offer is for people with an account: say it to anyone who signed up. It works through their own link.",
        `Only when they asked to start now: sign them up while on the phone. Text them the signup link from the call panel and stay on the line. They fill in their company details. No card needed. Tell them plainly: "${trial.plain}"`,
        "Then help them connect Stripe so they can take payments, and don't treat the call as done until it's connected. Have them create one real quote while you're on the phone, so they see it work tonight.",
        "Plant the referral ask early, while you book the demo or while they sign up: \"The way I know I did my job is if a month from now you'd tell another contractor about this. Fair enough?\" It makes the ask at the end feel natural.",
        "After every call, log: disposition, their exact words about the problem, objection heard, demo time, prep answers, referrals collected, and callback time if any.",
        "If someone asks not to be called again, mark it in the dialer and end politely.",
        "Never promise income, results, or numbers you can't back up. Never make up a customer or a story.",
      ],
    },
  };
}

// ══ The objection answers this playbook owns ════════════════════════════════
//
// Two to four spoken sentences each, in the book's order: agree; speak from
// their side; "let's not decide anything now" + the demo + what's in it for
// them; control handed back. Words in (parentheses) are directions to the rep;
// the rest is said. `hides` is the shared row each one replaces on this
// playbook's screen, so a rep never sees two answers to one objection. Rows
// with `cuesFrom` take their cues, context rule and priority from that shared
// row, so a rep finds both answers by the same words.
function buildObjections() {
  const shared = new Map(seedObjections().map((o) => [o.code, o]));
  const from = (code) => {
    const row = shared.get(code);
    if (!row) throw new Error(`reverseSelling.js: the shared answer ${code} no longer exists.`);
    return { cues: [...row.cues], contextSelectorKey: row.contextSelectorKey ?? null, priority: row.priority };
  };

  return [
    {
      code: "RS_IM_BUSY",
      hides: ["IM_BUSY_RIGHT_NOW", "CALL_ME_BACK_LATER"],
      label: "I'm busy right now, call me later",
      priority: 98,
      contextSelectorKey: null,
      cues: ["i'm busy", "im busy", "busy right now", "call me later", "call me back", "call back later", "not a good time", "on a ladder", "driving", "slow down", "after the season", "try me later"],
      response:
        "(Truly on a ladder or driving? Respect it and give two choices: \"Later today or tomorrow morning, which is better?\") " +
        "Totally fair, busy means work is coming in. If I was on a job right now, I wouldn't want to talk about software either. " +
        `${LETS_NOT}, and you'll see if it gets the quotes off your evenings. ${CONTROL}`,
    },
    {
      code: "RS_PARTNER",
      hides: ["NOT_THE_DECISION_MAKER"],
      label: "I need to talk to my wife / partner first",
      priority: 95,
      contextSelectorKey: null,
      cues: ["my wife", "the wife", "my partner", "my husband", "talk to my", "ask my", "run it by", "co-owner", "talk it over"],
      response:
        "That makes total sense, it's a decision you make together. If I was you, I'd want them to see it too. " +
        `${LETS_NOT} when you're both around, and you'll both see if it fits. Then you decide together, and either way it's no big deal, fair enough?`,
    },
    {
      code: "RS_NO_TIME_TO_LEARN",
      hides: ["NO_TIME_TO_SWITCH"],
      label: "I don't have time to learn new software",
      priority: 85,
      contextSelectorKey: null,
      cues: ["no time", "don't have time", "learn new", "learn another", "new software", "time to learn", "too busy to learn"],
      response:
        "Totally fair, you're on site all day. If I was you, the last thing I'd want is another app to learn. " +
        `${LETS_NOT}, and you'll see if it's quicker than the way you quote today. ${CONTROL}`,
    },
    {
      code: "RS_PAPER_WORKS",
      hides: ["PAPER_WORKS_FINE"],
      label: "Pen and paper / Excel works fine",
      priority: 55,
      contextSelectorKey: null,
      cues: ["pen and paper", "paper", "spreadsheet", "excel", "notebook", "in my head", "works fine"],
      response:
        "If it works, don't fix it. I wouldn't change a system that works either. " +
        `${LETS_NOT_CHANGE}, and you'll see if it holds up better when you're slammed. ${CONTROL}`,
    },
    {
      code: "RS_TOO_EXPENSIVE",
      hides: ["TOO_EXPENSIVE"],
      label: "Too expensive",
      priority: 90,
      contextSelectorKey: null,
      cues: ["expensive", "too much", "can't afford", "cannot afford", "pricey", "another subscription", "budget"],
      response:
        "I hear you, nobody needs another bill. If I was you, I'd want to know what it's worth before I worried about what it costs. " +
        `${LETS_NOT}, and you'll see if it could win you even one more job a month. ${CONTROL}`,
    },
    {
      code: "RS_TRIED_SOFTWARE",
      hides: ["TRIED_SOFTWARE_BEFORE"],
      label: "I tried software before and hated it",
      priority: 58,
      contextSelectorKey: null,
      cues: ["tried software", "tried one", "tried that before", "we had one", "hated it", "didn't stick", "did not stick", "gave up on", "wasted money"],
      response:
        "That's fair, and after that I'd be skeptical too. What didn't you like about it? (Let them vent fully.) " +
        `${LETS_NOT}, and you'll see straight away whether it feels like the last one. ${CONTROL}`,
    },
    {
      code: "RS_SEND_INFO",
      hides: ["SEND_ME_INFO"],
      label: "Just send me some info",
      priority: 60,
      contextSelectorKey: null,
      cues: ["send me", "send info", "send some info", "email me", "send information", "brochure", "look it over"],
      response:
        "I can, though honestly a brochure can't tell you if it fits how you work. If I was you, I'd want to see the one part I care about, not read about all of it. " +
        `Let's do this: let's book ${DEMO_OFFER} this week or next, and I'll send you something useful before we talk. ${CONTROL}`,
    },
    {
      code: "RS_THINK_ABOUT_IT",
      hides: ["NEED_TO_THINK"],
      label: "I want to think about it",
      priority: 45,
      contextSelectorKey: null,
      cues: ["think about it", "let me think", "need to think", "have a think", "sleep on it", "get back to you", "mull it over"],
      response:
        "Makes sense, it's a real decision. If I was you, I'd want to think it over too, and it's easier with the facts in front of you. " +
        `${LETS_NOT}, and you'll have what you need to think it over. ${CONTROL}`,
    },
    {
      code: "RS_ALREADY_USE_APP",
      hides: ["ALREADY_USE_COMPETITOR"],
      label: "I already use Jobber / Housecall Pro / another app",
      priority: 100,
      contextSelectorKey: "competitor_detected",
      cues: ["already use", "already have", "we use jobber", "we have jobber", "jobber", "housecall", "servicetitan", "another app", "we're on"],
      response:
        "That's smart, most of the contractors I call use something. If I was happy with my app, I wouldn't go looking either. " +
        `${LETS_NOT_CHANGE}, and you'll see if it does the one thing yours doesn't. ${CONTROL} ` +
        "(That app's battlecard is on the Playbook tab: type its name in the search. Never trash the other app.)",
    },
    {
      code: "RS_DO_YOU_HAVE",
      hides: [],
      label: "Do you have [feature]?",
      priority: 44,
      contextSelectorKey: null,
      cues: ["do you have", "does it do", "can it do", "does it have", "is there a way", "can you do"],
      response:
        "(If it's in FieldQuo, say yes. If not, say \"Not right now\" plainly. Never promise it's coming.) " +
        "Good question, and I'd rather show you than tell you. " +
        `Let's book ${DEMO_OFFER} this week or next, and you'll see what it does and doesn't do for how you work. ${CONTROL}`,
    },
    {
      code: "RS_NOT_INTERESTED",
      hides: ["NOT_INTERESTED"],
      label: "Not interested (in the first ten seconds)",
      priority: 97,
      contextSelectorKey: null,
      cues: ["not interested", "no thanks", "no thank you", "we're fine", "we are fine", "we're good", "not for me"],
      response:
        "(A fast \"not interested\" isn't a real no. In the first ten seconds it's a reflex. Don't argue with it and don't " +
        "take it literally. A-S-P, and no pause before the question.) Totally fair. If I was running crews all day, I " +
        "wouldn't want another app to learn either. Out of curiosity, how are you getting quotes out right now? (If they " +
        "ask not to be called again, mark do-not-call in the dialer and end politely. It's permanent and stops the email " +
        "and the texts too.)",
    },
    {
      code: "RS_BEST_WORST_CASE",
      hides: [],
      label: "Not sure / maybe / on the fence",
      priority: 84,
      contextSelectorKey: null,
      cues: ["not sure", "i don't know", "i dont know", "maybe", "on the fence", "unsure", "hesitant", "i guess"],
      response:
        "Fair enough, you don't have to be sure today. If I was you, I wouldn't be either, off one phone call. " +
        `${LETS_NOT}, and you'll know whether it's worth a second look. ${CONTROL}`,
    },
    // ── Beliefs: agree, book the demo. The picture from their trade is in
    // the backup, for the demo, where there is time for it.
    {
      code: "RS_BELIEF_BIG_COMPANIES",
      hides: ["TOO_SMALL_FOR_THIS"],
      label: "Belief: software is for big companies / I'm too small",
      priority: 65,
      contextSelectorKey: null,
      cues: ["big companies", "too small", "just me", "one man", "one-man", "only me", "small outfit", "on my own", "sole trader"],
      response:
        "Totally fair, a lot of software is built for big outfits. If I was running a small crew, I'd think the same. " +
        `${LETS_NOT}, and you'll see if it fits a business your size. ${CONTROL}`,
    },
    {
      code: "RS_BELIEF_NOT_COMPUTER_GUY",
      hides: [],
      label: "Belief: I'm not a computer guy",
      priority: 64,
      contextSelectorKey: null,
      cues: ["computer guy", "not a computer", "not good with computers", "not techy", "not good with tech", "not good with phones", "technology"],
      response:
        "Totally fair, you didn't get into the trade to sit at a computer. If you can send a text, you can send a quote. " +
        `Let's book ${DEMO_OFFER} this week or next, and you'll see if it's as simple as I say. ${CONTROL}`,
    },
    {
      code: "RS_BELIEF_PAPERWORK_IS_THE_JOB",
      hides: [],
      label: "Belief: paperwork is just part of the job",
      priority: 63,
      contextSelectorKey: null,
      cues: ["part of the job", "comes with the job", "just paperwork", "that's the job"],
      response:
        "It's part of the job, sure, and nobody gets out of it completely. Doing it the hardest way isn't part of the job, though. " +
        `${LETS_NOT}, and you'll see if it takes less of your week. ${CONTROL}`,
    },
    {
      code: "RS_BELIEF_QUOTE_LOOKS",
      hides: [],
      label: "Belief: my customers don't care what the quote looks like",
      priority: 62,
      contextSelectorKey: null,
      cues: ["don't care what", "doesn't matter what it looks", "looks don't matter", "customers don't care", "handwritten"],
      response:
        "Fair, the work is what they're paying for. If I was a homeowner, though, the quote is the first job of yours I'd see. " +
        `${LETS_NOT}, and you'll see a quote with your logo and your name on it. ${CONTROL}`,
    },
    {
      code: "RS_BELIEF_PAY_WHEN_THEY_PAY",
      hides: [],
      label: "Belief: customers pay when they pay",
      priority: 61,
      contextSelectorKey: null,
      cues: ["pay when they pay", "they always pay", "pay eventually", "paid eventually", "chasing is normal"],
      response:
        "True, most of them do pay in the end. If I was you, though, I'd want that money in my account, not in their pocket. " +
        `${LETS_NOT}, and you'll see how a customer pays by card straight from the invoice. ${CONTROL}`,
    },
    {
      code: "RS_BELIEF_HIRE_OFFICE_LATER",
      hides: [],
      label: "Belief: I'll hire an office person later",
      priority: 59,
      contextSelectorKey: null,
      cues: ["office person", "hire someone", "hire a secretary", "hire an admin", "office manager", "admin later"],
      response:
        "That might be the right call one day. If I was you, I'd want to know what the office work actually takes before I hired for it. " +
        `${LETS_NOT}, and you'll see how much of it can come off your plate first. ${CONTROL}`,
    },
    // ── The rest of the shared library, in the same short shape ──────────
    // Version 1 showed these twelve shared answers beside its own. Each runs
    // six to ten sentences and ends somewhere other than the demo, so on this
    // playbook's screen each is replaced by a short one with the same facts.
    // The shared rows are untouched and still answer every starter playbook.
    {
      code: "RS_HOW_DID_YOU_GET_MY_NUMBER",
      hides: ["HOW_DID_YOU_GET_MY_NUMBER"],
      label: "Where did you get my number?",
      ...from("HOW_DID_YOU_GET_MY_NUMBER"),
      response:
        "Fair question, and you're owed a straight answer. It came off your own public business listing, the one a homeowner finds when they search for you, and nobody sold it to us. " +
        "(If they want it gone, mark do-not-call in the dialer. It's permanent.) " +
        "We support contractors who are doing their quotes at night, and you decide if it's worth a couple of minutes. Fair enough?",
    },
    {
      code: "RS_IS_THIS_A_SALES_CALL",
      hides: ["IS_THIS_A_SALES_CALL"],
      label: "Is this a sales call? / What are you selling?",
      ...from("IS_THIS_A_SALES_CALL"),
      response:
        "Fair question, it is, and I'd rather say so. We support contractors who are doing their quotes and invoices at night, and I'm calling to see if that's you. " +
        "If it's worth a couple of minutes, I'll ask you two quick questions and you decide from there. Fair enough?",
    },
    {
      code: "RS_NEVER_HEARD_OF_YOU",
      hides: ["NEVER_HEARD_OF_YOU"],
      label: "Never heard of you — who are you?",
      ...from("NEVER_HEARD_OF_YOU"),
      response:
        "No reason you should have, we're small and we're new. In a sentence: the quote gets built on your phone in the driveway, with your name on it, and the customer approves it from theirs. " +
        `${LETS_NOT}, and you'll see if it fits. ${CONTROL}`,
    },
    {
      code: "RS_WRONG_PERSON",
      hides: ["WRONG_PERSON"],
      label: "I'm not the one who deals with that / you want the owner",
      ...from("WRONG_PERSON"),
      response:
        "Fair, thanks for telling me. Who writes the quotes up, the owner or you in the office? And when's the owner easiest to catch, first thing or the end of the day? " +
        "(If they write the quotes up, they're who you wanted: go back to the opener with them.)",
    },
    {
      code: "RS_JUST_TELL_ME_THE_PRICE",
      hides: ["JUST_TELL_ME_THE_PRICE"],
      label: "Just tell me what it costs",
      ...from("JUST_TELL_ME_THE_PRICE"),
      response:
        `Fair, and I won't dodge it: it starts at ${STARTS_AT}, every plan has every feature, and you pick by team size. ` +
        "Whether it's worth it depends on how you work, and that's what a short demo is for. " +
        `${LETS_NOT}. ${CONTROL}`,
    },
    {
      code: "RS_CONTRACT_LOCK_IN",
      hides: ["CONTRACT_LOCK_IN"],
      label: "Am I tied into a contract?",
      ...from("CONTRACT_LOCK_IN"),
      response:
        "That's the right worry. There's nothing to sign for a year: you can pay month to month and stop at the end of any month. " +
        `${LETS_NOT}, and you'll see if it's worth a month of your time. ${CONTROL}`,
    },
    {
      code: "RS_WHO_OWNS_MY_DATA",
      hides: ["WHO_OWNS_MY_DATA"],
      label: "Who owns my customer list? Is my data safe?",
      ...from("WHO_OWNS_MY_DATA"),
      response:
        "That's the right question to ask first. Your clients, your prices and your quotes are yours, and they're never shown to another contractor. " +
        `${LETS_NOT}, and you can ask me anything else about it there. ${CONTROL}`,
    },
    {
      code: "RS_BOOKKEEPER_USES_SOMETHING_ELSE",
      hides: ["BOOKKEEPER_USES_SOMETHING_ELSE"],
      label: "My bookkeeper uses QuickBooks / Sage / Xero",
      ...from("BOOKKEEPER_USES_SOMETHING_ELSE"),
      response:
        "Agreed, that's their tool and you shouldn't move them off it. To be straight with you, nothing pushes invoices into it, and they'd get each invoice as a PDF. " +
        `${LETS_NOT}, and you'll see if that works for how your books get done. ${CONTROL}`,
    },
    {
      code: "RS_DONT_NEED_A_WEBSITE",
      hides: ["DONT_NEED_A_WEBSITE"],
      label: "All my work is word of mouth, I don't need a website",
      ...from("DONT_NEED_A_WEBSITE"),
      response:
        "Word of mouth is the best work there is. If I had that, I wouldn't want to mess with it either. " +
        `${LETS_NOT_CHANGE}, and you'll see what happens when someone who heard your name looks you up. ${CONTROL}`,
    },
    {
      code: "RS_BOOKING_NOT_FOR_US",
      hides: ["BOOKING_NOT_FOR_US"],
      label: "People need to talk to me before I can book anything",
      ...from("BOOKING_NOT_FOR_US"),
      response:
        "Agreed, nobody books a kitchen off a form. If I was you, I'd want to see the job first too. " +
        `${LETS_NOT}, and you'll see how booking the visit, not the job, could work for you. ${CONTROL}`,
    },
    {
      code: "RS_EMAIL_WORKS_FINE",
      hides: ["EMAIL_WORKS_FINE"],
      label: "My email address is on the site, that works fine",
      ...from("EMAIL_WORKS_FINE"),
      response:
        "For the people who write to you, it does. I wouldn't change something that works either. " +
        `${LETS_NOT_CHANGE}, and you'll see what happens to an enquiry while you're up on a roof. ${CONTROL}`,
    },
    {
      code: "RS_PLENTY_OF_WORK",
      hides: ["PLENTY_OF_WORK"],
      label: "I've got more work than I can handle already",
      ...from("PLENTY_OF_WORK"),
      response:
        "Good, then finding work isn't your problem, and I won't pretend it is. If I was flat out, the last thing I'd want is another phone call. " +
        `${LETS_NOT}, and you'll see if it gets your quotes out faster when you're slammed. ${CONTROL}`,
    },
  ];
}

// ══ Backup: version 1's long answers, word for word ═════════════════════════
//
// The owner wrote these (2026-09-30). On a cold call they are too long and
// they argue for the trial; in the demo, or for a prospect who asks for more,
// they are exactly right. Rendered under Backup on the Playbook tab
// (reverseSellingScripts.js), never seeded as rows. Words in (parentheses) are
// directions to the rep, as the document writes them.
const T = TRIAL_DAYS_WORDS;
const V1_CONTROL = "Then you decide if it's worth keeping. Either way, no big deal. Fair enough?";

function buildV1Answers() {
  return [
    {
      code: "RS_IM_BUSY",
      hides: ["IM_BUSY_RIGHT_NOW", "CALL_ME_BACK_LATER"],
      label: "I'm busy right now, call me later",
      priority: 98,
      contextSelectorKey: null,
      cues: ["i'm busy", "im busy", "busy right now", "call me later", "call me back", "call back later", "not a good time", "on a ladder", "driving", "slow down", "after the season", "try me later"],
      response:
        "(First check: if they're literally on a ladder or driving, respect it and book a real callback time.) " +
        "I totally get it, and honestly that's a good sign, busy means business is coming in. Can I ask you something though? " +
        "When do you think you won't be busy? (Let them answer.) Right. And the busier you get, the more quotes and invoices " +
        "pile up at night. That's exactly why the best time to fix it is while you're busy, so you can stay busy all the time " +
        "without drowning in paperwork. A lot of owners I talk to tell me to call back when things slow down. When I do, " +
        "they're either still slammed and still doing paperwork at ten at night, or it slowed down because jobs slipped " +
        "through the cracks. Neither one is where they wanted to be. Give me ten minutes now and you'll be set up before " +
        "your next job. Or if right now truly doesn't work, what time tonight or tomorrow can you give me ten minutes, for " +
        "real? (Still unsure? \"It's okay if this isn't the right time. Do you want me to leave it here?\" Many will say " +
        "\"No, wait…\")",
    },
    {
      code: "RS_PARTNER",
      hides: ["NOT_THE_DECISION_MAKER"],
      label: "I need to talk to my wife / partner first",
      priority: 95,
      contextSelectorKey: null,
      cues: ["my wife", "the wife", "my partner", "my husband", "talk to my", "ask my", "run it by", "co-owner", "talk it over"],
      // The document's story is one painter "[first name]"; here it is the
      // pattern version, same three beats (see the header).
      response:
        "That makes total sense, it's a decision you make together. Can I ask, what do you think they'll say? " +
        "A lot of owners I talk to tell me the exact same thing. When I call back a few months later it's the same answer: " +
        "still doing quotes at night, still chasing payments. They never actually sat down to decide, so nothing changed, " +
        "and the business never got to where they wanted it. " +
        "Can I ask you something straight? What happens if you decide to do this without them? What are you afraid of " +
        "happening? Let's play it out. (Let them describe the worst case, then walk through it together.) Okay, so you " +
        "start the free trial, you send a few quotes from your phone, and you show them tonight. Worst case, they say " +
        "\"I don't like it.\" What happens then? You don't pick a plan when the trial ends, and it cost you nothing. " +
        "Best case, they see you got paid faster and you're home for dinner. Which one sounds more likely? (If a co-owner " +
        "truly signs off on every purchase, don't push past that:) I don't want that for you. How about we get them on the " +
        "phone now for five minutes, or book a time tonight when you're both around?",
    },
    {
      code: "RS_NO_TIME_TO_LEARN",
      hides: ["NO_TIME_TO_SWITCH"],
      label: "I don't have time to learn new software",
      priority: 85,
      contextSelectorKey: null,
      cues: ["no time", "don't have time", "learn new", "learn another", "new software", "time to learn", "too busy to learn"],
      response:
        "Totally fair, you're on site all day. How long did your last quote take you? (Let them answer.) A lot of owners I " +
        "talk to say the same thing, then realize they're already spending hours every week on paperwork. The ones who stay " +
        "stuck are usually the ones who never find a free afternoon to set it up. That's why I do it with you on the call. " +
        `In ten minutes you've sent your first quote. ${V1_CONTROL}`,
    },
    {
      code: "RS_PAPER_WORKS",
      hides: ["PAPER_WORKS_FINE"],
      label: "Pen and paper / Excel works fine",
      priority: 55,
      contextSelectorKey: null,
      cues: ["pen and paper", "paper", "spreadsheet", "excel", "notebook", "in my head", "works fine"],
      response:
        "If it works, don't fix it. Let me ask, when you're busiest, does it still work? (Let them answer.) A lot of owners " +
        "I talk to are proud of their spreadsheet, and they should be. It works great at five jobs a month. At fifteen, " +
        "they start losing jobs because quotes go out days late. The system that got them there isn't the one that gets " +
        `them to the next level. Let's do this: try it free for ${T} days next to the spreadsheet, and you'll see if your ` +
        `quotes go out faster when you're slammed. ${V1_CONTROL}`,
    },
    {
      code: "RS_TOO_EXPENSIVE",
      hides: ["TOO_EXPENSIVE"],
      label: "Too expensive",
      priority: 90,
      contextSelectorKey: null,
      cues: ["expensive", "too much", "can't afford", "cannot afford", "pricey", "another subscription", "budget"],
      response:
        "I hear you. Compared to what, though? What's one lost job worth to you? (Let them answer.) Most guys I talk to " +
        "only need to win one extra job a month, or get paid a week faster, and it pays for itself many times over. And the " +
        `first ${T} days are free with no card, so you'll know before you pay a dollar. Let's do this: start the trial now, ` +
        `and you'll see if it wins you that one job. ${V1_CONTROL}`,
    },
    {
      code: "RS_TRIED_SOFTWARE",
      hides: ["TRIED_SOFTWARE_BEFORE"],
      label: "I tried software before and hated it",
      priority: 58,
      contextSelectorKey: null,
      cues: ["tried software", "tried one", "tried that before", "we had one", "hated it", "didn't stick", "did not stick", "gave up on", "wasted money"],
      response:
        "What didn't you like about it? (Let them vent fully.) That's fair, and after that I'd be skeptical too. That's " +
        "exactly why the trial is free with no card. If it feels like that, you just don't pick a plan and it costs you " +
        "nothing. Let's do this: start it while we're on the phone, and you'll see on your first quote whether it feels " +
        `like the last one. ${V1_CONTROL}`,
    },
    {
      code: "RS_SEND_INFO",
      hides: ["SEND_ME_INFO"],
      label: "Just send me some info",
      priority: 60,
      contextSelectorKey: null,
      cues: ["send me", "send info", "send some info", "email me", "send information", "brochure", "look it over"],
      response:
        "I can. Honestly, most people who ask for info never open it, and I don't want to waste your inbox. What " +
        "specifically would you want to see? Let's just look at that right now. (Let them answer.) Let's do this: I'll " +
        `show you that one thing while we're on the phone, and you'll see if it fits how you work. ${V1_CONTROL}`,
    },
    {
      code: "RS_THINK_ABOUT_IT",
      hides: ["NEED_TO_THINK"],
      label: "I want to think about it",
      priority: 45,
      contextSelectorKey: null,
      cues: ["think about it", "let me think", "need to think", "have a think", "sleep on it", "get back to you", "mull it over"],
      // Two words differ from the document, both because bannedMoves.js
      // refuses the original: "is that okay?" is the yes/no-opener pattern,
      // so the price check reads as the reverse close's own "does that work
      // for you?"; "and that's the end of it" is the foreclosing-exit pattern,
      // so the line ends on the document's other sentence for the same fact,
      // "it cost you nothing".
      response:
        "(Don't let it stay vague. Narrow it down, one piece at a time.) Makes sense, it's a real decision. Can I ask: " +
        "does the way it works fit how you run your jobs? … And the price for your size, does that work for you? … And " +
        "are you comfortable working with us? (If one of those is a no, that's the real objection. Go back to it. If all " +
        "three are yes:) So it's just that you want a little time to be sure. Is that right? Let's do this: the trial is " +
        `free for ${T} days and doesn't take a card. Start it now while we're on the phone and use those ${T} days as ` +
        "your thinking time. If it's not for you, you don't pick a plan and it cost you nothing. Fair enough?",
    },
    {
      code: "RS_ALREADY_USE_APP",
      hides: ["ALREADY_USE_COMPETITOR"],
      label: "I already use Jobber / Housecall Pro / another app",
      priority: 100,
      contextSelectorKey: "competitor_detected",
      cues: ["already use", "already have", "we use jobber", "we have jobber", "jobber", "housecall", "servicetitan", "another app", "we're on"],
      response:
        "That's smart, most of the contractors I call use something. Which is exactly why it might be worth a look, so you " +
        "know what else is out there. You're not changing anything unless it makes sense, right? If you could change one " +
        "thing about it, what would it be? (Let them answer. That app's battlecard is on the Playbook tab: type its name in " +
        `the search. Never trash the other app.) Let's do this: try it free for ${T} days next to what you have, and ` +
        `you'll see if it fixes that one thing. ${V1_CONTROL}`,
    },
    {
      code: "RS_DO_YOU_HAVE",
      hides: [],
      label: "Do you have [feature]?",
      priority: 44,
      contextSelectorKey: null,
      cues: ["do you have", "does it do", "can it do", "does it have", "is there a way", "can you do"],
      response:
        "(If yes, show it. If no, say no plainly. Never promise it's coming.) Yes, let me show you right now. / Not right " +
        `now. (Then:) Let's do this: try what's there free for ${T} days, and you'll see if it covers how you work. ${V1_CONTROL}`,
    },
    {
      code: "RS_NOT_INTERESTED",
      hides: ["NOT_INTERESTED"],
      label: "Not interested (in the first ten seconds)",
      priority: 97,
      contextSelectorKey: null,
      cues: ["not interested", "no thanks", "no thank you", "we're fine", "we are fine", "we're good", "not for me"],
      response:
        "(A fast \"not interested\" isn't a real no. In the first ten seconds it's a reflex. Don't argue with it and don't " +
        "take it literally. A-S-P, and no pause before the question:) Totally fair. If I was running crews all day, I " +
        "wouldn't want another app to learn either. Out of curiosity, how are you getting quotes out right now? (If they " +
        "ask not to be called again, mark do-not-call in the dialer and end politely. It's permanent and stops the email " +
        "and the texts too.)",
    },
    {
      code: "RS_BEST_WORST_CASE",
      hides: [],
      label: "Any hesitation: best case / worst case",
      priority: 84,
      contextSelectorKey: null,
      cues: ["not sure", "i don't know", "i dont know", "maybe", "on the fence", "unsure", "hesitant", "i guess"],
      response:
        "(Calm voice, no pressure. Lay out all three side by side and let them pick.) Let's look at it both ways. Worst " +
        `case: you try it free for ${T} days, it's not for you, you don't pick a plan, and it cost you nothing but a few ` +
        "minutes. No card was ever taken. Best case: you're sending quotes from the customer's driveway, getting paid " +
        "without chasing anyone, and you're home for dinner. And if you do nothing? A year from now, you're right where you " +
        "are today, just busier. Which of those can you live with? (Then be quiet and let them answer.)",
    },
    // ── False beliefs: name the belief, a metaphor from their world, a short
    // story, a question. The document's own pattern for these, not the five
    // steps — a belief is loosened by a picture, not answered.
    {
      code: "RS_BELIEF_BIG_COMPANIES",
      hides: ["TOO_SMALL_FOR_THIS"],
      label: "Belief: software is for big companies / I'm too small",
      priority: 65,
      contextSelectorKey: null,
      cues: ["big companies", "too small", "just me", "one man", "one-man", "only me", "small outfit", "on my own", "sole trader"],
      response:
        "Did you wait until you had twenty guys to buy a good truck? No. You bought the truck so you could get to twenty " +
        "guys. The tools come first, then the growth. A lot of the owners I talk to are just one or two people. They say " +
        "the same thing, then realize the big companies got big partly because they stopped doing everything by hand. " +
        "What would you do with the time if the paperwork just took care of itself?",
    },
    {
      code: "RS_BELIEF_NOT_COMPUTER_GUY",
      hides: [],
      label: "Belief: I'm not a computer guy",
      priority: 64,
      contextSelectorKey: null,
      cues: ["computer guy", "not a computer", "not good with computers", "not techy", "not good with tech", "not good with phones", "technology"],
      response:
        "Were you born knowing how to use a sprayer? Someone showed you once, you messed up a few times, and now you can't " +
        "imagine going back to a brush for a whole kitchen. If you can send a text, you can send a quote. I'll walk you " +
        "through the first one right now, on the phone.",
    },
    {
      code: "RS_BELIEF_PAPERWORK_IS_THE_JOB",
      hides: [],
      label: "Belief: paperwork is just part of the job",
      priority: 63,
      contextSelectorKey: null,
      cues: ["part of the job", "comes with the job", "just paperwork", "that's the job"],
      response:
        "So is carrying ladders. But you don't carry them on your back from job to job, you've got a truck with a rack. " +
        "It's part of the job, sure. Doing it the hardest way isn't. How many hours would you say it takes you each week? " +
        "(Let them do the math out loud.)",
    },
    {
      code: "RS_BELIEF_QUOTE_LOOKS",
      hides: [],
      label: "Belief: my customers don't care what the quote looks like",
      priority: 62,
      contextSelectorKey: null,
      cues: ["don't care what", "doesn't matter what it looks", "looks don't matter", "customers don't care", "handwritten"],
      response:
        "You know how a customer judges a paint job in the first two seconds, before they look close? The quote is the " +
        "first job they see from you. Handwritten or a messy PDF next to a clean quote with your logo they can sign on " +
        "their phone. Which contractor looks like the pro? A lot of owners I talk to only notice it when they start losing " +
        "jobs to someone who isn't better at the work, just faster and more professional on paper.",
    },
    {
      code: "RS_BELIEF_PAY_WHEN_THEY_PAY",
      hides: [],
      label: "Belief: customers pay when they pay",
      priority: 61,
      contextSelectorKey: null,
      cues: ["pay when they pay", "they always pay", "pay eventually", "paid eventually", "chasing is normal"],
      response:
        "That's like finishing the job and leaving your tools at their house until they call you back. Your money is " +
        "sitting in someone else's pocket. When the customer can pay by card right from the invoice, most of the chasing " +
        "just goes away. How many are you waiting on right now?",
    },
    {
      code: "RS_BELIEF_HIRE_OFFICE_LATER",
      hides: [],
      label: "Belief: I'll hire an office person later",
      priority: 59,
      contextSelectorKey: null,
      cues: ["office person", "hire someone", "hire a secretary", "hire an admin", "office manager", "admin later"],
      response:
        "Building on a crooked foundation and planning to fix it later never works. The more jobs you add, the bigger the " +
        `mess the office person inherits. FieldQuo starts at ${STARTS_AT}. What does an office person cost you?`,
    },
  ];
}

/**
 * Version 1's answers, label and words, for the Backup panel. Never seeded.
 * Each is keyed by the code of the short answer that replaced it.
 */
export function reverseSellingBackup() {
  return buildV1Answers().map(({ code, label, response }) => ({ code, label, response }));
}

/** The codes this playbook owns, in the order they are defined. */
export function reverseSellingObjectionCodes() {
  return buildObjections().map((o) => o.code);
}

/**
 * The library rows, validated. Installed `active: true`: they are scoped to
 * this playbook by ownership, so they reach no screen while it is switched off.
 * Throws rather than filtering, the seedObjections argument.
 */
export function seedReverseSellingObjections() {
  const rows = buildObjections().map((o) => ({
    code: o.code,
    label: o.label,
    cues: [...o.cues],
    response: o.response,
    contextSelectorKey: o.contextSelectorKey,
    priority: o.priority,
    active: true,
    version: REVERSE_SELLING_VERSION,
  }));
  const problems = [];
  for (const row of rows) {
    const { ok, problems: found } = validateObjection(row);
    if (!ok) problems.push(`${row.code}: ${found.join(", ")}`);
  }
  if (problems.length) throw new Error(`seedReverseSellingObjections: ${problems.join("; ")}`);
  return rows;
}

/**
 * The playbook row, validated, SWITCHED OFF. The owner switches it on in the
 * platform console; installDefaults() never does.
 */
export function seedReverseSellingPlaybook() {
  const stages = buildStages();
  const objections = buildObjections();
  const row = {
    key: REVERSE_SELLING_KEY,
    name: REVERSE_SELLING_NAME,
    selectorKey: REVERSE_SELLING_SELECTOR,
    priority: REVERSE_SELLING_PRIORITY,
    active: false,
    version: REVERSE_SELLING_VERSION,
    stages: STAGE_KEYS.map((stageKey) => {
      const s = stages[stageKey] || {};
      const out = { stageKey, say: s.say ?? "", prompts: [...(s.prompts ?? [])] };
      if (s.tips?.length) out.tips = [...s.tips];
      if (stageKey === "objections") {
        out.ownObjectionCodes = objections.map((o) => o.code);
        out.hideObjectionCodes = [...new Set(objections.flatMap((o) => o.hides))];
      }
      return out;
    }),
  };
  const { ok, problems } = validatePlaybook(row);
  if (!ok) throw new Error(`seedReverseSellingPlaybook: ${problems.join(", ")}`);
  return row;
}
