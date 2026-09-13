// lib/sales/playbook/moments.js
//
// The parts of the sequence that are not the nine in-call stages: getting past
// whoever answers, the voicemail, the two follow-ups, the fifteen minutes, and
// the ask at the end of it.
//
// ══ Why these are not stages ═════════════════════════════════════════════
//
// stages.js fixes nine stages and argues, correctly, that which stages exist
// is code: a call that skips "current process" is a different call, and a
// superadmin inventing a tenth would make two playbooks incomparable, which is
// exactly what §38's experiments need them not to be.
//
// None of the moments below is a stage of that call. The gatekeeper happens
// BEFORE it, the voicemail happens INSTEAD of it, the follow-ups happen after
// it in a different channel, and the demo is the second meeting the whole call
// exists to earn. Folding any of them into the nine would break the property
// stages.js is protecting.
//
// ══ Why they are here at all ═════════════════════════════════════════════
//
// Because the owner asked for a playbook a salesperson can be handed, and a
// playbook that stops at "book the meeting" hands a new rep the two hardest
// minutes of their day — the receptionist, and the beep — with nothing.
//
// ══ A TEMPLATE here is the rep's WORDS and nothing else ══════════════════
//
// The follow-up text and the follow-up email carry no sender identification,
// no mailing address and no opt-out line, and that is not an omission. CASL
// s.6 requires all three and the sending paths already add them:
// lib/sales/salesSmsRules.js's `replySmsBody` appends "FieldQuo, {address}.
// Reply STOP to opt out." to whatever a rep types, and
// lib/sales/outreach.js's `buildOutboundEmail` appends `caslFooterLines`.
//
// A template that typed its own STOP line would produce a message carrying two
// of them, and — much worse — would look like the compliance was the
// template's job. It is the path's job. scripts/check-playbook-copy.mjs
// asserts no template here contains one, so nobody adds it back "to be safe".
//
// ══ Everything below is swept by the same detectors as a script ══════════
//
// lib/sales/playbook/bannedMoves.js, the same table the four playbooks and the
// battlecards run through. A voicemail is a script; a text is a script. The
// retired opener's three failures — a time promise, a bad-time question and an
// exit line a single word could end — are all easier to write into a
// voicemail than into a call, because nobody is listening back.
import { PERMISSION_ASK } from "./defaults";

/** Where in the sequence each moment sits. Ordered, and the order is the day. */
export const MOMENT_KEYS = Object.freeze([
  "gatekeeper",
  "voicemail",
  "follow_up_sms",
  "follow_up_email",
  "demo",
  "ask_for_the_business",
]);

/**
 * The address a text's cost is judged against.
 *
 * ══ Why the check needs one at all ═══════════════════════════════════════
 *
 * A template is not what gets sent. lib/sales/salesSmsRules.js's
 * `replySmsBody` appends "FieldQuo, {address}. Reply STOP to opt out." to
 * whatever a rep types, and THAT is the message on the Twilio invoice. Judging
 * the template alone would pass a text that becomes three segments the moment
 * it is real.
 *
 * So the check builds the real body with the real function, and the address it
 * uses is this one — a plausible Canadian one, long enough to be honest. It
 * lives here rather than in the check because the templates below were written
 * against it: shortening it would silently loosen the budget they were cut to.
 *
 * ══ And why every line below uses a plain hyphen ══════════════════════════
 *
 * An em dash is not in GSM-7. One of them anywhere in the message pushes the
 * whole thing to UCS-2, where a segment is 70 characters instead of 160 — so a
 * single punctuation mark roughly doubles the bill on every text the team
 * sends. The four scripts in defaults.js are spoken and use em dashes freely;
 * these are typed, and they may not.
 */
export const SMS_COST_ADDRESS = "2500 boulevard Saint-Joseph, Gatineau QC J8Z 1T7";

const MOMENTS = [
  {
    key: "gatekeeper",
    name: "Whoever answers the phone",
    when: "Somebody who is not the person you called for has picked up.",
    // ══ The one Cognism move that is deliberately NOT taken ══════════════
    //
    // Their script answers "what is it regarding?" with "I'm just following up
    // on an email" or "chasing up on some emails". It works, and it is a lie:
    // there is no email. A rep who says it and is put through to somebody who
    // asks which email has lost the call and the relationship in one sentence,
    // and FieldQuo would be a company whose reps open by inventing a history.
    // Everything else in their gatekeeper script — brevity, first name, no
    // pitch to the person who cannot buy — is taken as written.
    lines: [
      {
        label: "Opening",
        text: "Morning — it's {repName} from FieldQuo. Is {businessName}'s guv about?",
      },
      {
        label: "If they ask what it is regarding",
        text:
          "It's about how quotes go out of the business. I've not spoken to him before — I read " +
          "your website this morning and rang off the back of it. Is he the one who prices the " +
          "work, or is that somebody else?",
      },
      {
        label: "If he is not there",
        text:
          "When's he easiest to catch — first thing, or the end of the day? I'll ring then rather " +
          "than keep landing on you.",
      },
      {
        label: "If they offer to take a message",
        text:
          "Do both if you can: put my name down, and tell me when he's about. I'd rather catch " +
          "him than have him ring a number he doesn't know.",
      },
    ],
    notes: [
      "Never say he is expecting your call, or that you are following up an email. There is no email, and the person who finds out is the person you needed.",
      "The receptionist cannot buy anything and does not want to hear why it is good. Give them a name, a subject and a time, and get off.",
      "The second line is doing real work: it finds out whether the person you have been asking for is even the right one. Write down what they say.",
    ],
  },

  {
    key: "voicemail",
    name: "The beep",
    when: "It rang out, or they sent you to voicemail.",
    // Saylor ch.9's telephone rules survive the beep: name and company and the
    // purpose inside twenty seconds, a real reason, and the number said twice
    // because a person writing it down misses the first half of it. What does
    // NOT survive is the permission question — there is nobody to grant it —
    // so the message states the next action instead, and states it as
    // something that happens whether or not they ring back. Saylor ch.13's 81%
    // is the reason: a voicemail that ends "if you're interested, give me a
    // ring" has moved the whole sequence onto the prospect.
    lines: [
      {
        label: "The message, about twenty seconds",
        text:
          "{repName} at FieldQuo, for {businessName}. I read your website this morning and there's " +
          "one thing on it I wanted to put to whoever writes your quotes — it's a question rather " +
          "than a sales call. I'm on {repPhone}. That's {repPhone}. I'll try you again in a couple " +
          "of days either way.",
      },
    ],
    notes: [
      "Say the number twice and slow the second one down. Somebody writing it down misses the first three digits of the first.",
      "Leave one on the first attempt, not the fourth. Four unexplained missed calls from a number nobody knows is how you get blocked.",
      "The last sentence is the one that matters: the next contact happens either way, so there is nothing for them to decide right now.",
    ],
  },

  {
    key: "follow_up_sms",
    name: "The text, same day",
    when:
      "You spoke and agreed something, or you left a voicemail and want the number in their phone.",
    // The send path adds "FieldQuo, {address}. Reply STOP to opt out." — see
    // the header. What a rep types is only what is below.
    lines: [
      {
        label: "After a call that agreed a time",
        text: "{repName} from FieldQuo. Good to talk - the invite for our fifteen minutes is in your inbox. Reply here if it needs moving.",
      },
      {
        label: "After a voicemail",
        text: "{repName} from FieldQuo. Left you a message about your quotes - no need to ring back, I'll try you again in a couple of days.",
      },
      {
        label: "After a call that went nowhere in particular",
        text: "{repName} from FieldQuo. My number, in case the quoting comes up. I'll leave you be till month end.",
      },
    ],
    notes: [
      "Plain hyphens, no em dashes, no curly quotes. One character outside GSM-7 halves the segment size and roughly doubles the bill on every text the team sends.",
      "Two segments is the ceiling the product enforces, footer included. The check does that arithmetic with the real send function rather than counting the template.",
      "Do not type an opt-out line. The route adds the identification, the address and the STOP line — typing a second one is not extra care, it is a message with two of them.",
      "Never text a landline. The dial controls refuse it and say so out loud; do not work around them by hand.",
    ],
  },

  {
    key: "follow_up_email",
    name: "The email, the day after",
    when: "They asked for something in writing, or the call ended with a date.",
    lines: [
      {
        label: "Subject",
        text: "The quote with your name on it — {businessName}",
      },
      {
        label: "Body",
        text:
          "{contactName},\n\n" +
          "Attached is one real quote for a job like the ones you do, with your name at the top, " +
          "your colour, and nothing of ours anywhere on it. It took me twenty minutes and you " +
          "did not have to do anything.\n\n" +
          "Two things to look at when you have a minute: whose name is on the email it would have " +
          "arrived from, and the part underneath that says what the quote has left off.\n\n" +
          "The time we agreed still suits me. If it stops suiting you, tell me and we'll move " +
          "it rather than drop it.\n\n" +
          "{repName}",
      },
    ],
    notes: [
      "The attachment is the point. An email that only describes what you would build is the 'send me some information' stall answering itself.",
      "Do not add an opt-out line or a signature block with an address. buildOutboundEmail adds both, and it adds the reply token that files their answer against the right thread.",
      "Write it the day after, not the same night. A call and an email inside an hour reads as a system rather than a person.",
    ],
  },

  {
    key: "demo",
    name: "The fifteen minutes",
    when: "The meeting the whole call existed to earn.",
    // Barron: the cold call's only job is this conversation, so this is the
    // one where diagnosis is allowed to become demonstration. Rackham's
    // finding via Saylor sets the ORDER: a benefit tied to a need the prospect
    // has already stated meets materially fewer objections than a generic
    // advantage, so nothing is shown until what they said on the phone has
    // been said back to them and agreed.
    lines: [
      {
        label: "1. Their words first, before anything is on screen",
        text:
          "Before I show you anything — on the phone you said {theirWords}. Is that still the " +
          "shape of it, or has this week been different?",
      },
      {
        label: "2. The thing you promised, and nothing else",
        text:
          "This is the quote I built. Your name, your colour, and a job like the ones you do. " +
          "Read it the way a homeowner would and tell me what's wrong with it.",
      },
      {
        label: "3. The one part they have not seen",
        text:
          "The bit underneath is what I meant on the phone: before that goes out, it gets read " +
          "back to you — what's missing, and whether the price sits above or below what you've " +
          "actually been winning at. Your own jobs. Nobody else's numbers come into it.",
      },
      {
        label: "4. Stop showing things",
        text: "That's the whole of what I wanted you to see. What would have to be true for this to be worth doing?",
      },
    ],
    notes: [
      "Fifteen minutes means fifteen minutes. A demonstration that runs to forty has stopped being about them.",
      "Show the thing they asked about and nothing adjacent. Every extra screen is a new objection you invited.",
      "If they name something we do not have, say so and say it plainly. It is in the battlecards; read the honest half out.",
      "Do not demonstrate on their real data. The demo company is there so nothing typed in a meeting becomes a record somebody has to unpick.",
    ],
  },

  {
    key: "ask_for_the_business",
    name: "The ask",
    when: "The fifteen minutes are up and nothing is left to show.",
    // Futrell's alternative-choice close, with two options that are both real.
    // Neither is "buy now": one of them is a dated next contact, and it is
    // offered as an equal rather than as a consolation, because a close that
    // treats waiting as failure is the one that produces a yes the prospect
    // reverses on Monday.
    lines: [
      {
        label: "The close",
        text:
          "Two ways from here, and I'm happy either way. Either I put your own prices in it and " +
          "the next quote you send goes out of it this week — or you leave it, and I ring you " +
          "after month end when the season's calmer. Which is it?",
      },
      {
        label: "If they choose to wait",
        text:
          "Right — month end. I'll put it in for the second week and text you the day before. The " +
          "quote stays where it is, so there's nothing to set up again when we speak.",
      },
      {
        // The owner's process, 2026-09-13: the rep does not take a card.
        // The link goes by text while they are still on the phone, and the
        // rep stays on through the card step — lib/sales/playbook/
        // stayOnTheLine.js is the same step in the lead's language.
        label: "If they say yes",
        text:
          "Good. I'm texting you the link now — open it while we're on, it's two minutes. " +
          "Company details, pick the plan, card: you're not charged for a month and you can " +
          "cancel from Settings in one click. Then your rates go in however they exist — a " +
          "spreadsheet, a photo of a page — and send one real quote out of it and ring me if it feels wrong.",
      },
    ],
    notes: [
      "Stay on the line through the card step. The signup dies at the card when nobody is on the phone; your screen shows where they are, so you never have to ask.",
      "After you ask, stop talking. Futrell is emphatic about this: anything said after the question takes the pressure off the decision, and the pressure is the only thing making it happen now.",
      "Waiting is a real answer and gets a real date. A rep who treats it as a loss argues, and arguing at the close is how a maybe becomes a no.",
      "Do not discount to get the yes. Saylor's own figure: forty per cent of buyers ask for a concession only because they had to ask, and half of sellers give one on the first request.",
    ],
  },
];

/** Every moment, in sequence order. */
export function playbookMoments() {
  return MOMENTS.map((m) => ({
    ...m,
    lines: m.lines.map((l) => ({ ...l })),
    notes: [...m.notes],
  }));
}

export function moment(key) {
  return playbookMoments().find((m) => m.key === key) || null;
}

/**
 * Every variable a moment may name.
 *
 * A superset of PLAYBOOK_VARS, because two of these are said in places a call
 * script never reaches: `repPhone` in a voicemail, and `theirWords` in the
 * meeting, which is what the rep wrote down on the call. Neither can be
 * interpolated from a prospect row — the rep fills them in — and that is why
 * these are reference text a rep reads rather than lines a renderer resolves.
 */
export const MOMENT_VARS = Object.freeze([
  "businessName",
  "contactName",
  "repName",
  "repPhone",
  "theirWords",
]);

/** The permission ask, re-exported so a screen showing both cannot drift. */
export { PERMISSION_ASK };
