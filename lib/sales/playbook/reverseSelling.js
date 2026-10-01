// lib/sales/playbook/reverseSelling.js
//
// The Reverse Selling playbook — the owner's call script of 2026-09-30, in the
// nine stages, with its own objection answers — installed SWITCHED OFF.
//
// ══ Where it came from, and the one rule about its words ═════════════════
//
// The owner approved a closer script, "FieldQuo Closer Call Script — Reverse
// Selling" (a Claude Docs document, 2026-09-30, revised 2026-10-01). Its method
// is the reverse of the four starter playbooks in defaults.js: open as someone
// calling to SUPPORT the contractor, ask rather than tell, let them describe
// the problem in their own words, pull back instead of pushing, close on the
// free trial while they are on the phone, and end EVERY call with a referral
// ask. Every line below is the document's own wording, already written for
// contractors in FieldQuo's voice. Nothing is taken from the book the method
// is named after, and nothing is added that the document does not say —
// except where the CODE contradicts it, and then the code wins and the line
// says what the code says. Each such place is commented where it happens:
//
//   · the opener carries the recording aside (recordingDisclosure.js) — the
//     call is recorded and the rep is the one who says so;
//   · prices, seats and crew come from SEAT_LADDER, the trial from TRIAL_DAYS
//     and TRIAL_CARD_REQUIRED, the referral months from lib/referrals — never
//     typed, so a reprice changes the sentence or fails the check;
//   · the signup link is TEXTED from the call panel (it carries the rep's
//     attribution and drives the progress the panel draws), not read out as
//     "fieldquo.com/signup";
//   · the referral reward is a month of access for the referrer once the
//     referred company PAYS, and an extra trial month for the newcomer at
//     signup — through the referrer's own link (Settings, Refer & Earn).
//
// ══ Stories: never an invented customer ═══════════════════════════════════
//
// The document's own rule: tell only stories that really happened, first name
// only, and until a rep has their own, use the pattern version — "A lot of
// owners I talk to…". Two of its stories were written as one person ("I spoke
// with a painter, [first name]…", "I talked to a [trade] owner who was proud
// of his spreadsheet"). Printed on every rep's screen those become a customer
// nobody can stand behind, so they are here in the document's pattern form,
// same three beats. A rep with a real story of their own tells that instead —
// the objections stage says so. scripts/check-reverse-selling-playbook.mjs
// refuses a story that names a person.
//
// ══ Why it is installed switched off, and how it opens ════════════════════
//
// installDefaults() creates it with `active: false`; nothing a rep sees moves
// until the owner presses "Switch on" in the platform console. It opens on
// any business something has been recorded about (`anything_observed`,
// selectors.js), at a priority above the four starter playbooks, so once it
// is on it is the script on every researched prospect. The four stay in the
// database exactly as they are; switching this off puts every call back on
// them. Its objection answers are scoped to it (objectionsForPlaybook), so the
// starter playbooks' library does not change by one row while it is installed.
//
// ══ English only, like every playbook line ════════════════════════════════
//
// Stage lines and objection answers are read verbatim and are English, as the
// four starter playbooks are (CallPlaybook.js: translating what a rep is about
// to read aloud is the one change that cannot be undone by the time they heard
// it). The headings around them are the rep's language. The pieces that ARE
// in EN / FR / ES — the referral plant beside "stay on the line", and the AI
// script's trial close — live in stayOnTheLine.js and callScript.js.
import { TRIAL_CARD_REQUIRED, TRIAL_DAYS } from "@/lib/pricing";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { REFEREE_BONUS_MONTHS, REFERRER_BONUS_MONTHS } from "@/lib/referrals";
import { integerInWords } from "@/lib/sales/intel/pageExcerpts";
import { REVERSE_SELLING_KEY } from "./approaches";
import { validatePlaybook } from "./defaults";
import { RECORDING_ASIDE } from "./recordingDisclosure";
import { STAGE_KEYS } from "./stages";
import { validateObjection } from "./objections";

export { REVERSE_SELLING_KEY };

export const REVERSE_SELLING_NAME = "Reverse Selling";
export const REVERSE_SELLING_SELECTOR = "anything_observed";

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

const RUNGS = [...SEAT_LADDER].sort((a, b) => a.sortOrder - b.sortOrder);
const seatsPhrase = (n) => (n === 1 ? "one seat" : `${W(n)} seats`);

/**
 * The plan sentence. The document says "Crew $169 for up to 3"; the ladder's
 * three is SEATS (people who quote, schedule and invoice) and every rung also
 * carries crew (5 / 8 / 11 / 15), so the line says both rather than
 * under-selling the plan by eight people.
 */
export const PLAN_SENTENCE =
  "Every plan has every feature. You just pick by team size: " +
  RUNGS.map(
    (r, i) => `${r.label}, ${W(r.price)}${i === 0 ? " dollars a month" : ""} for ${seatsPhrase(r.seats)} and ${W(r.crewSeats)} crew`,
  ).join("; ") +
  ".";

/** The cheapest rung, in words — "FieldQuo starts at ninety-nine dollars a month." */
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

/**
 * The trial sentence the document says to say "always, clearly". Its only true
 * version is the one where signup takes no card, so if that ever changes this
 * throws rather than putting a false promise on every call.
 */
function trialLines() {
  if (TRIAL_CARD_REQUIRED !== false) {
    throw new Error(
      "reverseSelling.js: the script promises 'no card needed to start', and TRIAL_CARD_REQUIRED is no longer false. Rewrite the trial lines before installing it.",
    );
  }
  return {
    start: `The first ${TRIAL_DAYS_WORDS} days are free and no card is needed to start. If a sale is running, the pricing page shows it.`,
    plain: `It's free for ${TRIAL_DAYS_WORDS} days. You only add a card if you pick a plan when the trial ends.`,
    rule: `Always say it clearly: ${TRIAL_DAYS_WORDS} days free, no card needed to start. They only add a card if they choose a plan when the trial ends.`,
  };
}

// ── The five-step answer, closing lines reused by the objection answers ────
const CONTROL = "Then you decide if it's worth keeping. Either way, no big deal. Fair enough?";

function buildStages() {
  const trial = trialLines();

  return {
    // ── 1. Opener ───────────────────────────────────────────────────────────
    // Open as someone calling to support them, not someone asking for a
    // favour; then one easy question. The recording aside sits where the
    // starter opener puts it, right after the rep says who they are. The
    // document's "[trade] contractors" is not {tradeName}: a missing trade
    // would refuse the whole opener at the second the call connects
    // (defaults.js on why OPEN lines use only the two variables that are
    // always there).
    open: {
      say:
        `Hi, is this {businessName}? … Hey, it's {repName} with FieldQuo — ${RECORDING_ASIDE.en}. ` +
        "We support contractors who are doing their quotes and invoices at night after a full day " +
        "on site. I'm calling to see if that's something we can take off your plate.",
      prompts: [
        "Then straight to a question about them: \"Out of curiosity, how are you handling your quotes and invoices right now?\"",
        "Truly on a ladder or driving? \"No problem at all. When's a better time, later today or tomorrow morning?\" Book the callback in the dialer.",
      ],
      tips: [
        "The rep who cares most about the prospect wins the sale. You're not chasing a sale: you're finding out if this contractor has a problem FieldQuo fixes, and letting them tell you. Letting them hang up still stuck at the kitchen table at nine at night is the real failure.",
        "You know the product and how it helps. That's why you ask why, resolve concerns, and ask again: not to push, but because this contractor is better off with it than without it. Trade owners hang up on pushy callers; they stay on the line with someone calm and curious.",
        "Detach from the outcome. Sound like you are fine either way. The less you need the sale, the more they lean in. Slow down: a little slower and softer than feels natural. Pauses are fine.",
        "A fast \"not interested\" in the first ten seconds isn't a real no. It's a reflex, like \"just looking\" in a store. Don't argue with it and don't take it literally.",
        "Answer first resistance with A-S-P: Agree (\"Totally fair.\"), Speak from their side (\"If I was running crews all day, I wouldn't want another app to learn either.\"), then Pivot straight to a question with no pause. The pause is where they hang up.",
        "If they say they're busy, use the \"I'm busy right now\" answer under If they push back.",
        "Match their style. Driver: short, results, no small talk. Talker: let them talk, bring energy. Easygoing: be warm, ask what they think, don't steamroll. Detail person: numbers and specifics, give them time, never rush them.",
        "Voice goes up on questions, down on statements. Up invites an answer. Down sounds sure of itself.",
        "Only call within the calling hours the dialer allows; it enforces them by state and province.",
      ],
    },

    // ── "The moves": lay out the call, check agreement, give control ───────
    // The document has no "why them" stage; this slot is the beat after their
    // first answer, which is where it says to lay out the call. Per-prospect
    // talking points, when there are any, still appear here beneath it.
    relevance: {
      say:
        "I'll ask a couple of quick questions, show you the one or two things that fit how you " +
        "work, and then you decide if it's worth trying. Fair enough?",
      prompts: [],
      tips: [
        "Lay out the call before you start. People relax when they know what's coming.",
        "Check agreement as you go. End every suggestion with \"fair enough?\" or \"does that sound reasonable?\" and listen to how they say yes. A flat \"yeah, sure\" means you skipped something.",
        "Give them control. \"Let's not decide anything right now\" and \"then you decide if it's worth keeping\" take the pressure off, and people move forward more easily without it.",
        "Neutral words. Say \"see if it's a fit,\" not \"let me show you how amazing this is.\" No hype words.",
      ],
    },

    // ── 2. Discovery: let them describe the problem (first half) ───────────
    discovery: {
      say: "Walk me through what happens after you look at a job. How does the quote get to the customer?",
      prompts: [
        "\"When do you usually end up doing that, on site or later at night?\"",
        "\"How long does a typical quote take you?\"",
      ],
      tips: [
        "Ask one question, then listen. Repeat their words back. Write their exact phrases in the call notes; you'll use them at the close.",
        "Ask, don't tell. People believe what they say out loud, not what you say. Get them to describe the late-night quoting and the chasing payments in their own words.",
        "Talk thirty per cent, listen seventy. Ask, then stop. Let the silence sit. Whoever fills it tells you the most.",
        "Skip \"why\". \"Why do you do it that way?\" sounds like an accusation. Use \"what\" and \"how\", plus soft words: typically, potentially, consider, reasonable. \"What's typically the worst part of quoting for you?\"",
      ],
    },

    // ── 2. Discovery (second half), and "everything is fine" ───────────────
    current_process: {
      say: "Once the job's done, how do you get paid? Do you ever have to chase anyone?",
      prompts: [
        "\"Who handles scheduling and paying your guys?\"",
        "\"If you could fix one part of the paperwork side, which would it be?\"",
        "If they say everything is fine, pull back: \"Honestly, sounds like you've got it figured out. Most guys I talk to don't. What made it work for you?\"",
        "\"If by some off chance you're still writing quotes at night when spring gets busy, would you consider looking at another way?\"",
      ],
      tips: [
        "Everything fine? Either they convince you (end politely and ask for a referral — Wrap up) or they admit the gap.",
        "Pull back instead of pushing. When they hesitate, give them room: \"Maybe this isn't a fit, and that's okay.\" It lowers their guard and they often argue for it.",
        "Ask hypotheticals they're happy to answer. They say yes because they don't expect it to happen, and now you have a reason to call back.",
        "If you feel something, say it: \"I get the feeling this might not be the right fit for you right now. Am I right?\" It brings the real concern out.",
      ],
    },

    // ── 3. Consequence and outcome ─────────────────────────────────────────
    pain: {
      say: "What does that cost you? Jobs you lose because the quote went out two days late?",
      prompts: [
        "\"How many evenings a week does that eat up?\"",
        "\"If nothing changes, where is that in a year, when you're busier?\"",
        "\"If you could hand the customer a quote before you leave their driveway, what would that change?\"",
        "\"Where do you want the business to be a year from now? More crews, more jobs, more time at home?\"",
        "\"What's stopped you from fixing this before?\"",
        "Then check commitment: \"On a scale of one to ten, how important is fixing this for you right now?\"",
      ],
      tips: [
        "Help them feel what the problem costs, then picture life without it. Stay calm; you're curious, not dramatic.",
        "Don't pounce. When they name a pain, don't jump in with \"we fix that!\" Ask one more question about it first (\"What does that end up costing you?\"). Pitching the second someone opens up makes them close up.",
        "On the scale: under six, pull back and ask why. Seven or more, move to the close.",
      ],
    },

    // ── 4. Present ─────────────────────────────────────────────────────────
    fit: {
      say:
        "So you said [their words from your notes, e.g. \"I'm doing quotes at nine at night and " +
        "chasing two customers right now\"]. FieldQuo lets you build the quote on your phone on " +
        "site, the customer signs and pays online, and it all goes out with your logo and your " +
        `name. Scheduling and payroll are in there too. ${PLAN_SENTENCE} ${trial.start}`,
      prompts: [],
      tips: [
        "Only present what fixes the problems they named, in their words. Keep it under a minute.",
        trial.rule,
        "Never promise income, results, or numbers you can't back up.",
      ],
    },

    // ── 5. Objections: agree, ask, then tell a story ───────────────────────
    // The library below the stage is this playbook's own answers (ownCodes)
    // plus the shared ones it does not replace (hideCodes says which).
    objections: {
      say:
        "Totally fair. If I was you, I'd be skeptical of another app too. Let's do this: give me " +
        "ten minutes right now to build one real quote together, and you'll see if it saves you " +
        "the evening. Then you decide if it's worth keeping. Either way, no big deal, fair enough?",
      prompts: [],
      tips: [
        "Never argue. Agree with the concern, ask one question, then tell a short story about a contractor in the same spot. A story lets them see the outcome without you pushing.",
        "The five-step answer, for any objection: agree (\"Totally fair.\"); speak from their side (\"If I was you, I'd be skeptical of another app too.\"); suggest the next step with confidence (\"Let's do this…\"); say what's in it for them (\"…and you'll see if it gets your evenings back.\"); give them control and check (\"Then you decide if it's worth keeping. Either way, no big deal. Fair enough?\").",
        "Story rule: only tell stories that really happened. Use a real contractor you spoke to (first name only, never their business name). Until you have your own, use the pattern version: \"A lot of owners I talk to…\" Never invent a customer. If a prospect later asks for that person's number, you need to be able to stand behind it.",
        "Every story has the same three beats: same situation as the prospect, what they decided, where it left them.",
        "Story bank: after every call, write one real story in the notes (trade, situation, what they decided, what happened). Share the good ones with the team so everyone has real stories within the first few weeks.",
        "An objection is often a belief they've held for years. You can't argue a belief away, but a picture from their own trade can loosen it in seconds. Pattern: name the belief, a metaphor from their world, a short story, a question. The belief answers are in the list below.",
        "Build your own: when you hear a new belief, ask yourself \"what's the equivalent on a job site?\" Share the ones that land with the team.",
        "Best case / worst case works on any hesitation. It's in the list below.",
        "Wife or partner: confront the land mine. Don't tiptoe around it; say it out loud, calmly. Most of the time, once the fear is said out loud, it's smaller than it felt. Never leave it open-ended: either they start on their own after playing it out, or there's a booked callback with both people.",
        "Already on Jobber, Housecall Pro or another app? Its battlecard is on the Playbook tab: type the app's name in the search. Never trash the other app.",
      ],
    },

    // ── 4. Close on the call: the ask, the reverse close, ask-resolve-ask ──
    // "Next step" is the stage whose job is one specific thing with a date on
    // it; in this playbook that thing is the trial, started on the call.
    next_step: {
      say: `Based on what you told me, do you think it makes sense to try it free for ${TRIAL_DAYS_WORDS} days?`,
      prompts: [
        "Or the reverse close, first: \"From what you've seen, would you feel comfortable running your quotes on this if you did go ahead?\"",
        "Second: \"And the price for your size, does that work for you?\"",
        "Third: \"Then let's get your trial started. Anything you want to go over first, or should we set it up now?\"",
        "If they say no, ask why, calmly: \"That's fair. Can I ask what's making you say no?\" Then stay quiet.",
        "Dig one level deeper: \"Is that the only thing, or is there something else?\" The first reason is often not the real one.",
        "Resolve it: agree, then use the matching answer under If they push back, a story, or best case / worst case.",
        "Check it's resolved: \"Does that take care of it for you?\"",
        "Go for the sale again: \"So with that out of the way, does it make sense to start your free trial?\"",
      ],
      tips: [
        "Close with a question, not pressure. The reverse close is three easy questions instead of one big one.",
        "Watch out for the too-easy yes. \"Sounds great, I'll sign up tonight\" with no questions asked usually means no. Give them an out to test it: \"Glad it fits. Will it be hard to switch from how you do it now?\" If they argue for it, it's real. If they agree with the out, there's more to uncover.",
        "If they say no: ask, resolve, ask again. A first no is usually a concern they haven't said yet. Don't argue and don't give up. Repeat the loop if a new concern comes up. The same firm no twice with no new reason: stop, thank them, and go to the referral ask.",
        "Most signups won't happen on the first call; they come from follow-up. Every call ends with one of these, best first: trial started on the call; demo booked (a day and time in the calendar, invite sent); callback agreed (a day and time, their email, and a reason to call).",
        "Callback example: \"I'll send you a sample quote for a [trade] job. Let's look at it together [day] at [time]. Fair enough?\" Later: interested, but not now — ask when, then call back at half that time (\"you said spring, so I'll check in early February\"), then monthly until then. Not a fit (rude, out of business, or asked not to be called): mark it and move on.",
        "Never end on \"I'll get back to you\" without a day and time.",
        "Before you hang up on a booked demo, ask a few prep questions so the demo is about them: their trade, how many people, what they use now, how they quote, and their biggest worry. \"Anything you want to be sure we cover?\"",
        "Follow-up: not reached yet — it takes about eight tries to reach someone; try again the same day and every day after, at different times. Hot (demo or trial in the next few days): contact every day until it happens.",
        "Warm (interested, weeks away): call every Monday, and text on Friday: \"Hi [Name], it's [Rep] from FieldQuo. I'm around this weekend if you need anything. Anything I can help with right now?\"",
        "End of day: call your five hottest leads before you log off; people pick up more in the evening. Know your numbers: dials, conversations, demos, trials, paying customers. Your ratios show which step to work on.",
      ],
    },

    // ── 6. Referral ask: end of every call (Wrap up) ───────────────────────
    close: {
      say:
        "Congrats, you're going to love getting your evenings back. Quick question before I let " +
        "you go: who do you know that could benefit from this too? Another contractor who's " +
        "trying to grow their company and is buried in paperwork?",
      prompts: [
        "If they hesitate: \"Maybe a guy you sub for, or someone you sub out to? A buddy in another trade, roofing, HVAC, plumbing? Someone who's trying to add a crew this year?\"",
        "\"Who else do you know who wants to scale their business?\"",
        `"${REFERRAL_OFFER}"`,
        "\"Your link is in FieldQuo under Settings, Refer & Earn, and it can send the invite for you.\"",
        "If they didn't sign up: \"No problem at all, I appreciate your time. One last thing: who do you know that's growing their company and might need something like this?\"",
        "Get the details: name, trade, phone number, and whether you can say they sent you.",
      ],
      tips: [
        "Ask on every call, whether they signed up or not. People who said no often still know someone who needs it.",
        `If yes, sign them up while on the phone: text them the signup link from the call panel and stay on the line. They fill in their company details. No card needed. Tell them plainly: "${trial.plain}"`,
        "Then help them connect Stripe so they can take payments, and don't treat the call as done until it's connected. Have them create one real quote while you're on the phone, so they see it work tonight.",
        "While they sign up, plant the referral ask early: \"The way I know I did my job is if a month from now you'd tell another contractor about this. Fair enough?\" It makes the ask at the end feel natural.",
        "Mention the referral offer on every signup. Log each referral in the call notes right away.",
        "After every call, log: disposition, their exact words about the problem, objection heard, story used, referrals collected, and callback time if any.",
        "If someone asks not to be called again, mark it in the dialer and end politely.",
        "Never promise income, results, or numbers you can't back up. Never make up a customer or a story.",
      ],
    },
  };
}

// ══ The objection answers this playbook owns ════════════════════════════════
//
// Each follows the document's five-step answer — agree, speak from their side,
// suggest the next step with confidence, say what's in it for them, give them
// control and check — with the document's story where it has one. Words in
// (parentheses) are directions to the rep, as the document writes them; the
// rest is said. `hides` is the shared row each one replaces on this playbook's
// screen, so a rep never sees two answers to one objection.
const T = TRIAL_DAYS_WORDS;

function buildObjections() {
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
        `In ten minutes you've sent your first quote. ${CONTROL}`,
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
        `quotes go out faster when you're slammed. ${CONTROL}`,
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
        `and you'll see if it wins you that one job. ${CONTROL}`,
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
        `like the last one. ${CONTROL}`,
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
        `show you that one thing while we're on the phone, and you'll see if it fits how you work. ${CONTROL}`,
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
        `you'll see if it fixes that one thing. ${CONTROL}`,
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
        `now. (Then:) Let's do this: try what's there free for ${T} days, and you'll see if it covers how you work. ${CONTROL}`,
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
    version: "1",
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
    version: "1",
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
