// lib/sales/playbook/reverseSellingScripts.js
//
// The Reverse Selling playbook's SHORT SCRIPTS — one per lead source, the
// follow-up calls, the demo, the customer check-ins through the year, the
// referral-partner call — and the Backup of version 1's long answers.
//
// ══ Why these are not stages, and not rows ═══════════════════════════════
//
// stages.js fixes nine stages, and the Reverse Selling playbook's nine are
// the cold call (reverseSelling.js). But the owner's method (2026-10-01) is a
// DIFFERENT short script for each kind of lead — a trial user is not opened
// the way a stranger off the directory is — plus the meeting the call books,
// plus calls that happen weeks later. None of those is a tenth stage, for the
// reason moments.js gives: a stage that only some calls have makes two
// playbooks incomparable. They are reference scripts, like the moments, and
// they belong to this playbook alone: the call screen and the reading screen
// show them only when the playbook in front of the rep IS Reverse Selling
// (approaches.js), so while the owner keeps it switched off, nobody sees them.
//
// They are code, not rows, for the same reason the moments are: the console
// edits a playbook's nine stages and its objection answers, and building an
// editor for a second kind of script is a product decision nobody has made.
// docs/sales/REVERSE-SELLING-SCRIPTS.md is the same text for the owner's own
// document, and check:reverse-selling-playbook fails when the two drift.
//
// ══ The shape every call script has ══════════════════════════════════════
//
// Six to ten lines, almost all questions: who you are and the recording
// aside; a one-line reason and the hand-over ("you decide… fair enough?");
// two questions — what has them thinking about it, and when; the demo,
// booked with two choices of time; their email; the foreshadow; a few prep
// questions so the demo is about them; and the referral question. The trial
// appears only as "(only if they ask…)" — the owner's rule, never pushed.
//
// ══ Facts come from the code ═════════════════════════════════════════════
//
// The demo length is REP_DEMO_MINUTES, the trial TRIAL_DAYS and
// TRIAL_CARD_REQUIRED, the plans SEAT_LADDER, the referral months
// lib/referrals — all through reverseSelling.js, which already reads them.
// No digit in any line. Placeholders: {businessName} {repName} {first} are
// filled where the screen knows them; [day] [time] [their words] are the
// rep's to fill, off the calendar and the call notes.
//
// ══ Which script a lead gets ═════════════════════════════════════════════
//
// leadSourceFor() picks from what the call route already reads, and nothing
// else: a cancelled subscription (former customer), Prospect.signupKind
// (lib/signup/leads.js SIGNUP_KINDS: abandoned / new / stalled), and a
// competitor detected on their site. Three sources have no marker on a
// prospect row — a customer's referral before signup, a link texted and never
// opened (that lives on the LEAD, lib/sales/checkin/linkNoSignup.js), and an
// inbound caller (the call, not the prospect) — so on a cold call the script
// carries a small "Not a cold call?" switch to those three (NOT_A_COLD_CALL).
// Absence of a marker is never read as a source (AGENTS.md failure class 5).
//
// ══ ONE script on the call screen (owner, 2026-10-02) ════════════════════
//
// "Why are there two scripts in the sales rep? Shouldn't they have one?" The
// call screen showed the nine-stage stepper AND every script under it, two
// cold calls (1.0 and 2.0), and — for a prospect nothing was recorded for —
// the old AI script instead. Now callScreenScripts() decides the ONE script
// the call screen draws: this lead's source, or the demo when a demo with
// this lead is booked for today and has not finished. The route sends only
// that script and the ones its switch may swap in, so a second script cannot
// reach the screen. The follow-ups, the check-ins, the partner call and the
// Backup are reading for the Playbook tab, not the call.
import { RECORDING_ASIDE } from "./recordingDisclosure";
import {
  DEMO_MINUTES_WORDS,
  DEMO_OFFER,
  PLAN_SENTENCE,
  REFEREE_OFFER,
  REFERRAL_OFFER,
  STARTS_AT,
  WHAT_IT_IS,
  reverseSellingBackup,
  trialLines,
} from "./reverseSelling";
import { integerInWords } from "@/lib/sales/intel/pageExcerpts";
import { REP_DEMO_MINUTES, usableTimeZone } from "@/lib/sales/demoBooking/slots";
import { dayKeyIn } from "@/lib/booking/slotGrid";
import { REFERRAL_ASK } from "@/lib/sales/technique";

/** The groups, in the order the screen draws them. Headings are catalogue keys. */
export const SCRIPT_GROUPS = Object.freeze(["lead_source", "follow_up", "demo", "check_in", "partner", "backup"]);

/** Every lead source with its own script. The check holds each to having one. */
export const LEAD_SOURCE_KEYS = Object.freeze([
  "cold_call",
  "signup_unfinished",
  "trial_not_converted",
  "link_no_signup",
  "inbound_caller",
  "referred_by_customer",
  "uses_competitor",
  "former_customer",
]);

// ── The pieces every call script shares, built once ─────────────────────────
const D = DEMO_MINUTES_WORDS;
const ASIDE = RECORDING_ASIDE.en;
const HELLO_BUSINESS = `Hi, is this {businessName}? It's {repName} with FieldQuo — ${ASIDE}.`;
const HELLO_NAMED = `Hi {first}, it's {repName} with FieldQuo — ${ASIDE}.`;
const BOOK = `Let's do this: let's set up ${DEMO_OFFER}. I've got [day] or [day]. Which is better for you, morning or afternoon?`;
// The cold call's booking line carries version 2.0's "who else would want a
// say" in one clause, so the merged script qualifies the decision-maker
// without a separate question.
const BOOK_EVERYONE = `Let's do this: let's book ${DEMO_OFFER} for a time when everyone who decides is around. I've got [day] or [day]. Which is better for you, morning or afternoon?`;
const EMAIL = "What's the best email for the invite? I'll send you something useful before we talk.";
const FORESHADOW = `Here's how the ${D} minutes go: I'll ask a few questions, show you only the parts that fit, then you decide if it makes sense. Fair enough?`;
const PREP_SHORT = "So it's about you: what trade are you in, and how many on the crew?";
const PREP_WORRY = "What's your biggest worry about changing anything? Anything you want to be sure we cover?";
const ASK_REFERRAL = `Last thing before I let you go: ${REFERRAL_ASK.charAt(0).toLowerCase()}${REFERRAL_ASK.slice(1)}`;
const L = (text, label = null) => (label ? { label, text } : { text });

function trialOnAsk() {
  return `(Only if they ask to start now: "${trialLines().start}" Text the signup link from the call panel and stay on the line.)`;
}

function leadSourceScripts() {
  return [
    {
      // Version 1.0 and 2.0 merged (owner, 2026-10-02): 1.0's lines, the
      // shortest, with 2.0's "who else would want a say" folded into the
      // booking line. One cold call.
      key: "cold_call",
      name: "Cold call by trade",
      when: "A business off the directory list. You have never spoken.",
      source: "A researched prospect (Prospect.sourceProvider) with no signup behind it, whether or not anything has been recorded about the business yet.",
      lines: [
        L(HELLO_BUSINESS),
        L("I know you weren't expecting my call. We support contractors who are doing their quotes and invoices at night after a full day on site."),
        L("I'm calling to see if that's something we can take off your plate. If it's worth a couple of minutes, I'll ask you two quick questions and you decide from there. Fair enough?"),
        L("Out of curiosity, how are you handling your quotes and invoices right now?"),
        L("And is that something you'd want sorted before the busy season, or more of a someday thing?"),
        L(BOOK_EVERYONE),
        L(EMAIL),
        L(PREP_SHORT),
        L(ASK_REFERRAL),
      ],
      notes: [
        "Two questions, book the demo, one prep question, done. Demos booked is the number that matters.",
        `No pitch. If they ask what it is: "${WHAT_IT_IS}" Then back to the booking line.`,
        "Someone else decides with them, a partner or a co-owner? The booking line already covers it: a time when everyone who decides is around.",
        "No trial push. If the timing is \"someday\", book it anyway, or set the callback for when they said.",
      ],
    },
    {
      key: "signup_unfinished",
      name: "Started signing up, didn't finish",
      when: "They started setting up FieldQuo and stopped partway.",
      source: "Prospect.signupKind \"abandoned\" (lib/signup/leads.js). The line above the script names the step they reached.",
      lines: [
        L(HELLO_NAMED),
        L("You started setting up FieldQuo the other day and stopped partway. I'm calling to see if something got in the way, and you decide if it's worth a couple of minutes. Fair enough?"),
        L("What had you looking at it in the first place?"),
        L("And where did it lose you?"),
        L(`Easiest is to look at it together: ${DEMO_OFFER}, [day] or [day]. Which is better, morning or afternoon?`),
        L("(If they'd rather finish it now, that's them asking: text the signup link from the call panel and stay on the line while they do it.)"),
        L(EMAIL),
        L(PREP_SHORT),
        L(ASK_REFERRAL),
      ],
      notes: [
        "They wanted it once. Find out what stopped them before anything else. It's usually one thing, and it's usually small.",
        "Never tell them what step they stopped at as if you were watching them. The opener says it plainly; leave it there.",
      ],
    },
    {
      key: "trial_not_converted",
      name: "On the free trial, hasn't picked a plan",
      when: "They signed up and are on the trial, or it stalled: no plan chosen yet.",
      source: "Prospect.signupKind \"new\" or \"stalled\" with no active subscription (lib/signup/salesFloor.js). The trial is TRIAL_DAYS long and takes no card.",
      lines: [
        L(HELLO_NAMED),
        L("You've been trying FieldQuo, and I'm calling to support you, not to sell you. If it's worth a couple of minutes, you decide from there. Fair enough?"),
        L("What had you trying it in the first place?"),
        L("How has it gone so far? What have you sent out of it?"),
        L("What would have to be true for you to keep using it after the trial?"),
        L(`Let's do this: ${DEMO_OFFER}, and we go through whatever's in the way together. [day] or [day], morning or afternoon?`),
        L(EMAIL),
        L("Anything you want to be sure we cover?"),
        L(ASK_REFERRAL),
      ],
      notes: [
        "Don't ask them to pick a plan on this call. Find what's in the way, book the time, and let the demo do it.",
        "If nothing has gone out of it yet, that's the whole call: one real quote, together, in the demo.",
      ],
    },
    {
      key: "link_no_signup",
      name: "Got the link, never signed up",
      when: "You texted them the signup link and nothing happened.",
      source: "A link sent from the call panel with no signup after it (SalesSignupProgress.linkSentAt, lib/sales/checkin/linkNoSignup.js). Lives on the lead, so you pick this script.",
      lines: [
        L(HELLO_NAMED),
        L("I texted you the FieldQuo link a little while back, and I'm calling to see if it's still on your list or if it dropped off. Either answer is fine. Fair enough?"),
        L("What had you interested when we spoke?"),
        L("What got in the way?"),
        L("Is it still something for this season, or more of a later thing?"),
        L(`Let's do this: ${DEMO_OFFER}, and you'll see the parts that fit before you sign up for anything. [day] or [day], morning or afternoon?`),
        L(EMAIL),
        L(PREP_WORRY),
        L(ASK_REFERRAL),
      ],
      notes: [
        "\"Either answer is fine\" is meant. A clear \"not now\" with a date is a good outcome; a polite yes that never opens the link again is not.",
        "If it's later, ask when and book the callback for half that time.",
      ],
    },
    {
      key: "inbound_caller",
      name: "They called us",
      when: "A contractor rang FieldQuo.",
      source: "An inbound call to the sales line (lib/sales/calls/inboundRouting.js). The call, not the prospect, carries this, so you pick the script.",
      lines: [
        L(`Thanks for calling FieldQuo, it's {repName} — ${ASIDE}. How can I help?`),
        L("Happy to help. What had you looking at FieldQuo?"),
        L("And when are you hoping to have something in place?"),
        L("What are you using now?"),
        L(`The best way to see if it fits is ${DEMO_OFFER}. I've got [day] or [day]. Which is better, morning or afternoon?`),
        L(trialOnAsk()),
        L(EMAIL),
        L(FORESHADOW),
        L(PREP_SHORT),
        L(ASK_REFERRAL),
      ],
      notes: [
        "They called you, so they're further along than any cold call. Still two questions, still the demo. If they ask to start today, help them start today.",
        "Answer what they asked first. A caller who asked the price and got a question back hangs up.",
      ],
    },
    {
      key: "referred_by_customer",
      name: "Referred by a customer",
      when: "A customer gave you their name, or they came through a customer's link.",
      source: "A name a customer gave you on a call, or a company that arrived through a customer's referral link (Company.referredAt, lib/referrals). You pick this script.",
      lines: [
        L(HELLO_BUSINESS),
        L("[Customer's first name] gave me your name and said you might be buried in quotes too. I don't know if that's true, so you tell me. Fair enough?"),
        L("How are you handling your quotes and invoices right now?"),
        L("What's the part of that you'd most like to get off your plate?"),
        L(`Let's do this: ${DEMO_OFFER}, [day] or [day]. Which is better, morning or afternoon?`),
        L(REFEREE_OFFER),
        L(EMAIL),
        L(PREP_SHORT),
        L(ASK_REFERRAL),
      ],
      notes: [
        "Only say the customer's name if they said you could. First name only, never their business.",
        "The extra trial month only lands when they sign up through the customer's own link (Settings, Refer & Earn). Never promise it any other way.",
      ],
    },
    {
      key: "uses_competitor",
      name: "Uses another app",
      when: "They run Jobber, Housecall Pro or another app already.",
      source: "A competitor's platform detected on their site (the competitor_detected rule), or they say so on the call.",
      lines: [
        L(HELLO_BUSINESS),
        L("Most of the contractors I call use something already. We support contractors who want their quotes out faster, and I'm calling to see if there's anything yours doesn't do for you. Fair enough?"),
        L("What are you using right now?"),
        L("If you could change one thing about it, what would it be?"),
        L("Are you tied in for a while, or is it month to month?"),
        L(`Let's not change anything today: ${DEMO_OFFER}, and you'll see if it does that one thing better. [day] or [day], morning or afternoon?`),
        L(EMAIL),
        L("So it's about you: how many people use it, and what would you need to bring over?"),
        L(ASK_REFERRAL),
      ],
      notes: [
        "That app's battlecard is on the Playbook tab: type its name in the search. Read the honest half out loud if they ask.",
        "Never trash the other app. Never claim a difference you can't show in the demo.",
      ],
    },
    {
      key: "former_customer",
      name: "Former customer",
      when: "They used FieldQuo and cancelled.",
      source: "A company whose subscription is cancelled (lib/platform/stripeSync.js marks it churned).",
      lines: [
        L(HELLO_NAMED),
        L("You used FieldQuo for a while and then stopped, and I'm not calling to talk you back into anything. I'd like to know what we got wrong, and you decide if it's worth a couple of minutes. Fair enough?"),
        L("What made you stop?"),
        L("What are you doing for quotes now?"),
        L("Is that working better, or about the same?"),
        L(`If that one thing were sorted, would it be worth another look? Let's not decide now: ${DEMO_OFFER}, [day] or [day]. Which is better?`),
        L(EMAIL),
        L(ASK_REFERRAL),
      ],
      notes: [
        "If what made them stop still isn't fixed, say so plainly and don't book the demo. Thank them; it's worth more than the booking.",
        "Never promise what is still in their old account. Check before you say anything about it.",
      ],
    },
  ];
}

function followUpScripts() {
  return [
    {
      key: "follow_up_hot",
      name: "Hot lead — demo in the next few days",
      when: "The demo is booked for the next few days. Call every day until it happens.",
      source: "Your calendar: a demo booked under Next step.",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. Just checking you're still good for [day] at [time]."),
        L("If it needs moving, would [day] or [day] be better?"),
      ],
      notes: ["Short, and about the time, not the product. If they move it twice, ask what's changed."],
    },
    {
      key: "follow_up_later",
      name: "Later lead — \"last time you said…\"",
      when: "Interested, but not now. Call back at half the time they gave you, then monthly.",
      source: "A callback booked with a reason.",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. Last time we talked you said [their words, e.g. after the season]. Is that still the case?"),
        L(`If yes: when's better for ${DEMO_OFFER}, [day] or [day]?`),
        L("The Friday text, for warm leads: \"Hi {first}, it's {repName} from FieldQuo. I'm around this weekend if you need anything. Anything I can help with right now?\""),
      ],
      notes: ["Use their words, from your notes. \"Last time you said…\" is the reason for the call."],
    },
    {
      key: "follow_up_after_demo",
      name: "After the demo, if they didn't start",
      when: "You did the demo and they didn't start.",
      source: "A demo on your calendar that has passed.",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. After we looked at it on [day], you said you wanted to [their words]. Where did you land?"),
        L("If they're still deciding: \"Want to go through the one part that's holding you up? [day] or [day]?\""),
      ],
      notes: ["If they say no, ask what's making them say no, once, calmly. Then the referral question."],
    },
  ];
}

/**
 * The demo's clock, from REP_DEMO_MINUTES — so a different demo length re-paces
 * the notes instead of leaving "fifteen means fifteen" on a thirty-minute
 * meeting (owner, 2026-10-02). Parts one and two are a minute or two; part
 * three, their answers, is the longest, about a third; part seven, the plan
 * and the close, keeps the last sixth; showing, pricing and what they gain
 * take what is left. Minute marks, not durations, so the rep glances at the
 * clock once rather than timing seven parts.
 */
export function demoPacing(minutes = REP_DEMO_MINUTES) {
  const m = Math.max(10, Math.round(Number(minutes) || 0));
  const open = Math.max(1, Math.round(m / 15));
  const discovery = Math.round(m / 3);
  const close = Math.max(2, Math.round(m / 6));
  return { minutes: m, openBy: open, discoveryBy: open + discovery, showBy: m - close, close };
}

function demoScript() {
  const trial = trialLines();
  const pace = demoPacing();
  const W = integerInWords;
  return {
    key: "demo",
    name: `The demo — ${D} minutes, seven parts`,
    when: "The meeting the cold call booked. Have their prep answers in front of you.",
    source: `A demo booked under Next step or from the rep's demo page (REP_DEMO_MINUTES: ${D} minutes, the length the call panel books and the intro email and the demo page promise).`,
    lines: [
      L(`Here's what I'd suggest for the next ${D} minutes: a few questions about how you work, the two or three parts of FieldQuo that fit, and what it would cost for your size. Then we decide together if it makes sense. Fair?`, "1. Agenda"),
      L("I'll be straight with you the whole way, including what we don't do. And the way I know I did my job is if you'd tell another contractor about this, whether you go ahead or not. Fair enough?", "2. Honesty, and the referral up front"),
      L("What had you looking at this? When do you want something in place? Could you keep doing it the way you do it now, and what happens if you do? What's your biggest concern about changing?", "3. Discovery"),
      L("(If you need more:) \"How many evenings a week does that eat up?\" \"If nothing changes, where is that in a year, when you're busier?\" \"What's stopped you from fixing this before?\" \"On a scale of one to ten, how important is fixing this right now?\" Under six, pull back and ask what's missing.", "3. Discovery — the cost questions"),
      L("Show it by asking. \"If a quote goes out two days late, what usually happens?\" Then show the quote built on site. \"When a customer pays late, what do you do today?\" Then show them paying from the invoice. Only what answers what they told you.", "4. Show it with questions"),
      L("So you said [their words from your notes]. FieldQuo lets you build the quote on your phone on site, the customer signs and pays online, and it all goes out with your logo and your name.", "4. The present, in their words"),
      L(`${PLAN_SENTENCE} It's month to month, and you can stop at the end of any month. ${trial.start}`, "5. Value, with the risk taken off them"),
      L("You said quotes take you [their number] a week. What would you do with those evenings back? And if quoting faster won you one more job a month, what's that worth to you?", "6. What they gain, from their own numbers"),
      L("When could you send your first real quote out of it? Who on the crew would use it? Would you take card payments on it?", "7. The plan — small yes questions"),
      L("From what you've seen, would you feel comfortable running your quotes on this? And the price for your size, does that work for you? Then let's get you started. Anything else you want to go over first?", "7. The reverse close"),
      L("If they say no: \"That's fair. Can I ask what's making you say no?\" Then stay quiet. \"Is that the only thing, or is there something else?\" Resolve it, check \"Does that take care of it for you?\", then \"So with that out of the way, does it make sense to get started?\"", "7. Ask, resolve, ask again"),
    ],
    notes: [
      `${D} minutes means ${D} minutes. Pace it by the clock: the agenda and the honesty done by minute ${W(pace.openBy)}; part three, their answers, the longest part, to about minute ${W(pace.discoveryBy)}; showing it, the present, the price and what they gain to minute ${W(pace.showBy)}; and keep the last ${W(pace.close)} for part seven, the plan and the close.`,
      "If it runs over, stop at the time you promised, say so, and book a second call for the rest. A demo that runs long has stopped being about them.",
      "You know the product and how it helps. That's why you ask why, resolve concerns, and ask again: not to push, but because this contractor is better off with it than without it.",
      "Watch out for the too-easy yes. \"Sounds great, I'll sign up tonight\" with no questions asked usually means no. Give them an out to test it: \"Glad it fits. Will it be hard to switch from how you do it now?\" If they argue for it, it's real.",
      "If they say no: ask, resolve, ask again. The same firm no twice with no new reason: stop, thank them, and ask the referral question.",
      `Starting: text the signup link and stay on the line. No card needed. "${trial.plain}" Then help them connect Stripe, and have them send one real quote while you're on.`,
      "The stories, best case / worst case and \"let's play it out\" (Backup, on the Playbook tab) belong here, when they're needed.",
      "Do not demonstrate on their real data. The demo company is there so nothing typed in a meeting becomes a record somebody has to unpick.",
    ],
  };
}

function checkInScripts() {
  // There is no customer-success caller in FieldQuo: lib/sales/checkin drafts
  // TEXTS for a rep's own signups, on day one and day seven, up to the
  // retention milestone. These four are calls a rep makes to their customers
  // through the year, as scripts only.
  const note = "There is no check-in caller or queue for this in FieldQuo yet; book it on your own calendar. The check-in texts (day one and day seven after signup) are a separate thing.";
  return [
    {
      key: "checkin_new_year",
      name: "Start of the year — the plan and their goals",
      when: "January, every customer you signed.",
      source: "Your own customers (Companies → yours).",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. I'm calling my customers at the start of the year to look at their plans with them."),
        L("What do you want this year to look like: more crews, more jobs, more time at home?"),
        L(`Let's take ${DEMO_OFFER} and set FieldQuo up for that. [day] or [day], morning or afternoon?`),
        L(ASK_REFERRAL),
      ],
      notes: [note],
    },
    {
      key: "checkin_busy_season",
      name: "Before the busy season — a setup tune-up",
      when: "A few weeks before their busy season starts.",
      source: "Your own customers.",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. The busy season's coming, and I'm calling to make sure FieldQuo is ready before it hits."),
        L("What slowed you down last season that you'd want sorted this time?"),
        L(`Let's take ${DEMO_OFFER} and go through your price list, your quote templates and your payment settings together. [day] or [day]?`),
        L(ASK_REFERRAL),
      ],
      notes: [note],
    },
    {
      key: "checkin_mid_year",
      name: "Mid-year — one useful tip",
      when: "The middle of the season.",
      source: "Your own customers.",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. Quick one: I've got one thing in FieldQuo you're not using yet that could save you time this season: [the one feature]."),
        L(`Want me to show you? It's ${DEMO_OFFER}, [day] or [day].`),
        L(ASK_REFERRAL),
      ],
      notes: [
        note,
        "Only a feature that exists and that they don't use yet. If there's a customer event on, invite them to it; never invent one.",
      ],
    },
    {
      key: "checkin_slow_season",
      name: "Before the slow season — a pricing review",
      when: "As the season winds down.",
      source: "Your own customers.",
      lines: [
        L("Hi {first}, it's {repName} from FieldQuo. The slow season's a good time to look at your prices, and I'm calling to offer you that."),
        L("How did your prices hold up this year? Any jobs you think you priced too low?"),
        L(`Let's take ${DEMO_OFFER} and look at what you've been winning and losing at, from your own quotes. [day] or [day]?`),
        L(ASK_REFERRAL),
      ],
      notes: [note, "Their own quotes only. Never another company's prices, never \"what others charge\"."],
    },
  ];
}

function partnerScript() {
  return {
    key: "partner",
    name: "Referral partners — businesses that serve contractors",
    when: "Paint and lumber suppliers, bookkeepers and accountants, insurance brokers.",
    source: "A business you found yourself. This is a script, not a programme: FieldQuo has no partner programme, fees or referral payments for partners.",
    lines: [
      L(HELLO_BUSINESS),
      L("We support contractors who are doing their quotes and invoices at night, and the same contractors walk through your door. I'm calling to see if it makes sense for us to send each other people. You decide if it's worth a couple of minutes. Fair enough?"),
      L("Who are the contractors you deal with most: what trades, what size?"),
      L("What do you hear from them about the paperwork side?"),
      L("When one of them is drowning in quotes, what do you usually tell them?"),
      L(`Let's not decide anything now: ${DEMO_OFFER}, so you know exactly what you'd be pointing people to. [day] or [day]?`),
      L("And when we hear a contractor needs [a supplier / a bookkeeper / insurance], who should we send them to?"),
      L(ASK_REFERRAL),
    ],
    notes: [
      "Never offer money, a fee, a discount or a commission for referrals. There is no partner programme; the customer referral months are for FieldQuo customers' own links only.",
      "Never promise to send them business. \"We'll mention you when it comes up\" is the most you say.",
    ],
  };
}

function backupScript() {
  return {
    key: "backup",
    name: "Backup — the long answers, for the demo or when they ask for more",
    when: "Not for the cold call. In the demo, or for a prospect who wants more than the short answer.",
    source: "Version one of the owner's answers, word for word.",
    lines: reverseSellingBackup().map((b) => L(b.response, b.label)),
    notes: [
      "The stories here are the pattern form only. Tell your own real story instead when you have one: first name only.",
      "Best case / worst case and \"let's play it out\" work best in the demo, after they've seen it.",
      `If they want every price: ${PLAN_SENTENCE}`,
      `The referral offer, for anyone with an account: "${REFERRAL_OFFER}"`,
      `It starts at ${STARTS_AT}.`,
    ],
  };
}

/** Every script, grouped. Pure; built fresh each call so nobody mutates a shared copy. */
export function reverseSellingScripts() {
  const tag = (group) => (s) => ({ group, ...s });
  return [
    ...leadSourceScripts().map(tag("lead_source")),
    ...followUpScripts().map(tag("follow_up")),
    tag("demo")(demoScript()),
    ...checkInScripts().map(tag("check_in")),
    tag("partner")(partnerScript()),
    tag("backup")(backupScript()),
  ];
}

/**
 * Which lead-source script a prospect gets first. Only from what the call
 * route already read; null when nothing marks a source a script exists for
 * (a paying customer, say) — never a guess.
 *
 * @param signupKind          Prospect.signupKind: "abandoned" | "new" | "stalled" | null
 * @param subscriptionStatus  the signup company's Subscription.status, or null
 * @param competitorDetected  a competitor platform was observed on their site
 */
export function leadSourceFor({ signupKind = null, subscriptionStatus = null, competitorDetected = false } = {}) {
  if (subscriptionStatus === "canceled") return "former_customer";
  if (signupKind === "abandoned") return "signup_unfinished";
  if (signupKind === "new" || signupKind === "stalled") {
    return subscriptionStatus === "active" ? null : "trial_not_converted";
  }
  if (signupKind) return null;
  if (competitorDetected === true) return "uses_competitor";
  return "cold_call";
}

/**
 * The scripts with {businessName} / {repName} / {first} filled where the
 * screen knows them. A value it does not know stays a visible placeholder —
 * never an empty hole in a sentence somebody reads out.
 */
export function fillScripts(scripts, { businessName = null, repName = null, first = null } = {}) {
  const values = { businessName, repName, first };
  const fill = (text) =>
    String(text).replace(/\{(businessName|repName|first)\}/g, (whole, k) => {
      const v = typeof values[k] === "string" ? values[k].trim() : "";
      return v || whole;
    });
  return scripts.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, text: fill(l.text) })) }));
}

// ══ The call screen: one script ══════════════════════════════════════════

/**
 * The three sources nothing on a prospect row marks. A cold call carries a
 * small "Not a cold call?" switch to these — on the same script, swapping it,
 * never a second one beside it.
 */
export const NOT_A_COLD_CALL = Object.freeze(["referred_by_customer", "link_no_signup", "inbound_caller"]);

/** The detected sources that ARE a cold call, and so carry that switch. */
export const COLD_SOURCES = Object.freeze(["cold_call", "uses_competitor"]);

/** The switch's question, in the rep's language (catalogue keys). */
export const SWITCH_LABEL_KEYS = Object.freeze({
  not_cold: "app.salesScripts.notColdCall",
  not_demo: "app.salesScripts.notTheDemo",
});

/**
 * A demo with this lead that the call screen should open on instead of the
 * call script: booked for TODAY in the rep's zone, and not over yet (a
 * running one counts). Cancelled and done ones never do. An entry with no end
 * lasts one demo. Pure — the route reads the rows and hands them in.
 *
 * @param events   [{ startAt, endAt, status, type }] — the rep's demos with this lead
 * @returns { at: ISO, running: boolean } | null
 */
export function demoBookedNow(events = [], { now = new Date(), timeZone = null, minutes = REP_DEMO_MINUTES } = {}) {
  const zone = usableTimeZone(timeZone) ? timeZone.trim() : "America/Toronto";
  const today = dayKeyIn(now, zone);
  const live = (Array.isArray(events) ? events : [])
    .filter((e) => e && (e.type == null || e.type === "demo") && e.status !== "cancelled" && e.status !== "done")
    .map((e) => {
      const start = new Date(e.startAt);
      const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + minutes * 60_000);
      return { start, end };
    })
    .filter(({ start, end }) => !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > now && dayKeyIn(start, zone) === today)
    .sort((a, b) => a.start - b.start);
  if (!live.length) return null;
  return { at: live[0].start.toISOString(), running: live[0].start <= now };
}

/**
 * The ONE script the call screen draws for a Reverse Selling call, and the
 * scripts its switch may swap in — and nothing else, so the route cannot send
 * a second script for the screen to draw.
 *
 *   demo booked for today    the demo script, with "Not the demo?" back to
 *                            this lead's call script;
 *   a cold source            that script, with "Not a cold call?" to the three
 *                            sources nothing marks (NOT_A_COLD_CALL);
 *   any other source         that script, alone;
 *   no source (a paying      nothing: the screen says why, and the check-ins
 *   customer, an unknown     are on the Playbook tab. Never a guessed script.
 *   signup kind)
 *
 * @param scripts    reverseSellingScripts(), filled
 * @param suggested  leadSourceFor()
 * @param demoNow    demoBookedNow()
 */
export function callScreenScripts(scripts, { suggested = null, demoNow = null } = {}) {
  const byKey = new Map((Array.isArray(scripts) ? scripts : []).filter((s) => s?.key).map((s) => [s.key, s]));
  const lead = suggested && byKey.get(suggested)?.group === "lead_source" ? suggested : null;
  let shown = lead;
  let reason = lead ? "lead_source" : "no_source";
  let options = null;
  let kind = null;
  if (demoNow && byKey.has("demo")) {
    shown = "demo";
    reason = "demo_now";
    if (lead) {
      kind = "not_demo";
      options = ["demo", lead];
    }
  } else if (lead && COLD_SOURCES.includes(lead)) {
    kind = "not_cold";
    options = [lead, ...NOT_A_COLD_CALL.filter((k) => byKey.has(k))];
  }
  const keys = options || (shown ? [shown] : []);
  return {
    shown,
    reason,
    suggested: lead,
    demoAt: reason === "demo_now" ? demoNow.at : null,
    demoRunning: reason === "demo_now" ? Boolean(demoNow.running) : false,
    switch: options ? { kind, labelKey: SWITCH_LABEL_KEYS[kind], options } : null,
    scripts: keys.map((k) => byKey.get(k)).filter(Boolean),
  };
}
