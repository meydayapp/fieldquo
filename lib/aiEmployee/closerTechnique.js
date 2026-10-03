// lib/aiEmployee/closerTechnique.js
//
// HOW the closer talks to a homeowner — never WHAT is true.
//
// ══ Where this comes from (owner, 2026-10-02) ═════════════════════════════
//
// FieldQuo's own sales surfaces learnt the Reverse Selling technique on
// 2026-10-01 (lib/sales/technique.js). The owner then asked for the same
// technique in the contractors' AI employees — in particular the closer, the
// one that sells the CONTRACTOR's work to a homeowner over web chat, SMS and
// Meta — and, a few hours later, that it be "industry specific based on the
// services the company offers … because any client messaging the company is a
// lead". The words below are ours; nothing is taken from the book.
//
// ══ Why a separate module and not a parameter on lib/sales/technique.js ════
//
// Three reasons, each sufficient:
//
//   1. White-label. Every move in that file is written about FieldQuo, for a
//      contractor deciding whether to buy FieldQuo ("before saying anything
//      about FieldQuo", "running crews all day"). A homeowner must never meet
//      that word (AGENTS.md: everything a homeowner sees looks like the
//      contractor's), and a shared MOVES array is one careless edit from
//      putting it in every company's closer at once.
//   2. Its import graph. technique.js imports lib/referrals, which imports
//      lib/db and lib/stripe — for FieldQuo's own referral months. roles.js is
//      pure assembly run on every reply and executed by check:ai-employee
//      without a database stub; it has no business loading Stripe.
//   3. Its outputs are pinned byte-for-byte by check:sales-ai-technique and
//      check:jennifer, and another agent is editing the rep playbook beside
//      it. A homeowner variant threaded through it would put two audiences'
//      wording behind one set of pins.
//
// What IS shared is the shape — agree, speak from their side, move to the
// next step instead of arguing; two choices, never an open time; no "why";
// "fair enough?"; give them control; the referral question last — and the
// heading, which scripts/check-closer-technique.mjs asserts is the same words
// as lib/sales/technique.js's TECHNIQUE_HEADING.
//
// ══ It sits BELOW every existing rule, by construction ═════════════════════
//
// buildEmployeePrompt places this after WHAT YOU NEVER DO, the attachment
// fact, HOW MANY QUESTIONS, the crisis rule, the data rule and HANDING OFF,
// and the section says out loud that it cannot override them. Where the
// technique and an existing rule meet, the rule wins and this text is written
// around it:
//
//   - "Offer two times" vs rule 2 and check_availability's "at most three":
//     two of the times the tool RETURNED, by their labels. Every time in a
//     reply still comes from the tool in this conversation; the examples here
//     are placeholders, never a day.
//   - "Not ready yet — when?" vs book_callback, which books no time: their
//     words go in preferred_times and nobody is promised a call then.
//   - "Too expensive" vs rule 4: never a discount, never "it pays for itself",
//     never another company's price. Only the visit survives.
//   - "Just give me a price" vs rule 1: a price only from
//     look_up_service_prices, create_instant_quote or the instant-quote link,
//     exactly as HOW YOU HANDLE MONEY says. The closer is allowed to price, so
//     it does not hide a figure a tool gave it — it gives it and says the
//     visit confirms it for their job.
//   - Stories vs rule 7: the closer has met nobody. No past customer, no
//     result, no "people like you". A testimonial only when the company's own
//     material above carries one, word for word.
//   - The referral question vs rule 4 (no discount) and rule 3 (no invented
//     policy): it offers nothing in return, and names no referral programme
//     the company's material does not describe. Nothing already in the
//     prompt forbids asking it; these two rules shape it.
//
// ══ No figure is typed here ════════════════════════════════════════════════
//
// No price, no duration, no day, no date, no count of anything a customer
// could hold the company to. scripts/check-closer-technique.mjs fails on a
// digit, a currency mark, a weekday or month name, or a number of
// minutes/hours/days anywhere in this file's output.
//
// ══ Trade-specific, from the company's own services ════════════════════════
//
// The owner's ask. The section lists the trades THIS company has switched on
// (CompanyServiceCategory.enabled — the same rows Settings › Services writes
// and the instant estimator reads), grouped into families, and for each one
// gives the closer the questions that matter, what the visit is for, and the
// objection that trade hears. Only the company's own trades; nothing else.
//
// What the repo already had per trade, and why none of it is copied in:
//
//   - app/data/quoteIntakeFields.js — PRICING inputs ("Labor Rate per Hour",
//     "Waste Factor (%)", "Pitch (rise/12)"). Several are the company's own
//     rates; read into a homeowner chat they would be a price leak. The
//     discovery questions below were chosen to AGREE with them (doors and
//     drawers for cabinets, what is down now for floors, urgency for
//     plumbing), not derived from them.
//   - lib/documents/serviceContent.js — what a QUOTE says happens, step by
//     step. The visit lines below match its first steps for each family
//     (walkthrough and colours for coatings, consultation and measurement for
//     installs, on-site assessment for repairs) so the chat never promises a
//     different first meeting from the one the company's own quote describes.
//   - lib/sales/tradeSellingPoints.js — FieldQuo selling TO contractors. The
//     wrong audience entirely.
//
// Nothing in the repo held homeowner objections per trade, so those are new
// and written to state no trade fact: each one agrees, takes their side and
// moves to the visit. A trade with no family here gets the general approach,
// and genericTradeKeys() lists which those are so the gap is visible.

import { TRADE_CATALOG } from "@/lib/trades/catalog";

// ══ Short, because it is resent on every round ═════════════════════════════
//
// This section rides in the system prompt of every closer reply, and a reply
// is up to four model rounds (respond.js's maxRounds), each resending it at
// the company's expense on the best model. So it is written tight: one line
// per move, one to two sentences per objection, at most MAX_TRADE_FAMILIES
// trades written out — roughly 1,100 to 1,600 tokens. That is still MORE than
// lib/ai/usage.js's TYPICAL_CONVERSATION_TOKENS was told (it assumes a
// ~2,500-token system prompt, and the closer's is now nearer 3,500). The
// estimate the settings screen prints has NOT been raised here: changing a
// money figure a contractor reads is the owner's call, and it is reported
// rather than made. scripts/check-closer-technique.mjs bounds this section's
// length so it cannot grow further without somebody deciding to.

/** Same words as lib/sales/technique.js's TECHNIQUE_HEADING — asserted by the check. */
export const CLOSER_TECHNIQUE_HEADING = "HOW TO HAVE THE CONVERSATION";

/** The trade section's heading. */
export const CLOSER_TRADES_HEADING = "THE WORK THIS BUSINESS DOES";

/** The referral line, once, so the check can find it and nobody rewords it in two places. */
export const HOMEOWNER_REFERRAL_ASK =
  "If you know a neighbour who's thinking about the same kind of work, we'd be glad to help them too.";

/** The moves, as data — the check asserts each one reaches the prompt. */
export const CLOSER_MOVES = Object.freeze([
  {
    key: "ask_before_telling",
    text:
      "Ask before you tell: one question per message, the ones listed for their kind of work below, then " +
      "the visit. Do not interrogate — the visit is where the details get worked out.",
  },
  {
    key: "no_pounce",
    text: "Do not pounce: when they describe the problem, ask one more question about it before suggesting anything.",
  },
  {
    key: "no_why",
    text:
      "Never ask \"why\" — it reads as blame. Use \"what\" and \"how\", and soft words: typically, " +
      "potentially, consider, reasonable.",
  },
  {
    key: "asp",
    text:
      "On hesitation, A-S-P in one message, with no gap to drop out through: Agree (\"That's fair.\"), " +
      "Speak from their side (\"I'd want to know what I was getting into too.\"), then a question about " +
      "them (\"What would you want to know before deciding?\").",
  },
  {
    key: "fair_enough",
    text: "Check as you go: end a suggestion with \"fair enough?\". A flat one-word yes may hide something — ask what is on their mind.",
  },
  {
    key: "give_control",
    text: "Give them control: \"No commitment — someone takes a look, then you decide.\"",
  },
  {
    key: "never_argue",
    text: "Never argue. If a concern comes back, do not answer it harder: agree, and say the visit is where they will find out.",
  },
]);

/**
 * The objections every trade hears: what the homeowner writes, and the shape
 * of a two-to-four-sentence answer that ends at the visit. The model words it
 * in the customer's language and the company's voice.
 */
export const HOMEOWNER_OBJECTIONS = Object.freeze([
  {
    key: "just_a_price",
    says: "Just give me a price",
    answer:
      "if a tool can price it, give that figure as HOW YOU HANDLE MONEY says and say the visit confirms " +
      "it for their job; if none can, an exact price needs someone to see the job — then the visit.",
  },
  {
    key: "other_quotes",
    says: "I'm getting other quotes",
    answer:
      "agree it's sensible; a visit gives them something real to compare, then they decide. Never mention " +
      "another company or its prices.",
  },
  {
    key: "partner",
    says: "I need to talk to my partner first",
    answer: "it's a decision they make together — offer two of the returned times when they are both home.",
  },
  {
    key: "too_expensive",
    says: "That's too expensive",
    answer:
      "agree nobody wants to overspend. No arguing about value, no discount, no comparison, never \"it pays " +
      "for itself\" — someone sees the job and goes through it with them, then they decide.",
  },
  {
    key: "not_ready",
    says: "I'm not ready yet",
    answer:
      "fair enough, no rush. Ask when would suit them better and record it with book_callback, their words " +
      "in preferred_times — never promise anyone will be in touch then.",
  },
]);

/**
 * Trade families: what to ask, what the visit is, and the objection that
 * trade hears. `keys` are ServiceCategory keys; a key in no family gets
 * GENERIC_TRADE. Nothing here is a fact about a job — no material lasts N
 * years, no insurer pays, nothing takes N days.
 */
const FAMILIES = Object.freeze({
  painting: {
    keys: ["interior_painting", "exterior_painting"],
    discover: ["which rooms or surfaces", "when they would like it done"],
    visit: "a walk-through to measure up and talk colours and finish",
    objection: {
      says: "I might just do it myself",
      answer: "fair enough, it's your house; a look costs no commitment, and then you decide whether it's one for you or for us.",
    },
  },
  cabinets: {
    keys: ["cabinet_refinishing", "cabinet_refacing", "kitchen_design"],
    discover: ["refresh the cabinets they have, or replace them", "roughly how many doors and drawers"],
    visit: "someone sees the doors, drawers and boxes, their condition, and talks colour and finish",
    objection: {
      says: "Not sure whether to refinish or replace",
      answer: "fair thing to be unsure about — it's hard to judge without seeing them; someone looks in person, then you decide.",
    },
  },
  surfaces: {
    keys: ["flooring", "flooring_install", "tiling", "countertop", "stairs", "epoxy"],
    discover: ["which rooms or areas, roughly how big", "what is there now"],
    visit: "someone measures up and sees what is there now and underneath it",
    objection: {
      says: "I haven't picked a material yet",
      answer: "no need to have chosen; someone measures up and talks it through, and you decide after.",
    },
  },
  roofing: {
    keys: ["roofing_service", "gutter_services", "siding"],
    discover: ["leaking, or thinking about replacing", "roughly how old it is, and whether an insurance claim is involved"],
    visit: "someone looks at it in person and measures it",
    objection: {
      says: "I'm waiting to hear from my insurance",
      answer:
        "makes sense; a look commits them to nothing and they'll know what they're dealing with whatever " +
        "the insurer decides. Never say what an insurer will or won't cover.",
    },
  },
  systems: {
    keys: [
      "plumbing",
      "well_water",
      "sewer_septic",
      "hvac_install",
      "hvac_repair",
      "mechanical_contracting",
      "electrical",
      "lighting",
      "security_systems",
      "smart_home",
      "solar_energy",
      "appliance_repair",
      "garage_door",
      "locksmith",
    ],
    discover: ["what is happening, or what they want installed", "whether it's urgent (an emergency goes to the emergency rule first)"],
    visit: "someone sees it in person and works out what is needed",
    objection: {
      says: "Can't you just tell me what's wrong?",
      answer: "from here you'd only be guessing, and that isn't fair to them; someone sees it, then they decide. Never talk them through a fix.",
    },
  },
  outdoor: {
    keys: [
      "landscaping_design",
      "lawn_care",
      "lawn_mowing",
      "irrigation",
      "tree_care_service",
      "snow_removal",
      "deck_patio",
      "fence_services",
      "fence_repair",
      "fence_restoration",
      "paving",
      "driveway_sealing",
      "concrete",
      "masonry",
      "parging",
      "pressure_washing_house",
      "pressure_washing_driveway",
    ],
    discover: ["what they want done, and where on the property", "when they would like it done"],
    visit: "someone walks the property, measures the area and sees what is there now",
    objection: {
      says: "It's not the right time of year yet",
      answer: "fair enough; a look commits them to nothing and they'll know what's involved ahead of time — or ask when suits them and record it with book_callback.",
    },
  },
  renovation: {
    keys: [
      "general_contracting",
      "general_contracting_reno",
      "remodeling",
      "construction",
      "carpentry",
      "drywall",
      "drywall_install",
      "demolition",
      "demolition_contractor",
      "excavation",
      "doors_windows",
      "glass",
      "insulation",
    ],
    discover: ["what space or project they have in mind", "when they're hoping to start"],
    visit: "someone sees the space, measures up and talks through what they have in mind",
    objection: {
      says: "We're still working out what we want",
      answer: "that's a normal place to be; a visit is a good way to work it out, then you decide.",
    },
  },
  cleaning: {
    keys: [
      "residential_cleaning",
      "deep_cleaning",
      "commercial_cleaning",
      "janitorial",
      "carpet_cleaning",
      "window_cleaning",
      "air_duct_cleaning",
    ],
    discover: ["what kind of clean, for what size of place", "a one-off or regular"],
    visit: "someone sees the place so the work fits it",
    objection: {
      says: "Do you really need to come and see it?",
      answer: "fair question; every place is different and seeing it beats a guess — and if a tool can price it from what they told you, offer that too.",
    },
  },
});

/** The approach for a trade with no family, and for a company with no services listed. */
export const GENERIC_TRADE = Object.freeze({
  discover: ["what they want done", "when they would like it done"],
  visit: "someone sees the job in person and works out what is needed",
  objection: null,
});

const FAMILY_OF = (() => {
  const map = new Map();
  for (const [family, def] of Object.entries(FAMILIES)) {
    for (const key of def.keys) map.set(key, family);
  }
  return map;
})();

/** The family a ServiceCategory key belongs to, or null for the general approach. */
export function familyFor(categoryKey) {
  return FAMILY_OF.get(categoryKey) || null;
}

/** Every family's keys — the check asserts each is a real catalogue key. */
export function familyKeys() {
  return Object.fromEntries(Object.entries(FAMILIES).map(([f, d]) => [f, [...d.keys]]));
}

/**
 * Catalogue trades that get the general approach — reported, not hidden, so
 * the gap is a list somebody can read rather than a silence.
 */
export function genericTradeKeys() {
  return Object.keys(TRADE_CATALOG).filter((k) => !FAMILY_OF.has(k));
}

/** At most this many families are written out in full. A prompt is not a manual. */
export const MAX_TRADE_FAMILIES = 5;
/** At most this many service names on one line. */
const MAX_LABELS = 6;

// A label goes into the prompt a stranger's reply is written from. The loader
// (lib/aiEmployee/closerTrades.js) already rejects money-shaped and
// instruction-shaped company labels through lib/voice/quoteQuestions.js's
// safeMaterialLabel; this is the structural floor for any OTHER caller —
// one line, no fence characters, bounded.
function plainLabel(label) {
  const s = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 80 || /[`{}<>|]|--|^#/.test(s)) return null;
  return s;
}

/**
 * The company's trades, grouped. Pure.
 *
 * @param trades [{ key, label }] — this company's ENABLED service categories.
 * @returns { families: [{ family, labels, discover, visit, objection }],
 *            otherLabels } — trades with no family, and families beyond the
 *            cap, are named in otherLabels and get the general approach.
 */
export function tradeBriefs(trades = []) {
  const groups = new Map();
  const generic = [];
  const seen = new Set();
  for (const t of Array.isArray(trades) ? trades : []) {
    const key = String(t?.key || "");
    const label = plainLabel(t?.label) || plainLabel(TRADE_CATALOG[key]?.label);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const family = familyFor(key);
    if (!family) {
      generic.push(label);
      continue;
    }
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(label);
  }

  const families = [];
  const overflow = [];
  for (const [family, labels] of groups) {
    if (families.length >= MAX_TRADE_FAMILIES) {
      overflow.push(...labels);
      continue;
    }
    const def = FAMILIES[family];
    families.push({ family, labels, discover: def.discover, visit: def.visit, objection: def.objection });
  }
  return { families, otherLabels: [...overflow, ...generic] };
}

function namesLine(labels) {
  const shown = labels.slice(0, MAX_LABELS);
  return shown.join(", ") + (labels.length > shown.length ? ", and more" : "");
}

function tradeLines(names, { discover, visit, objection }) {
  const out = [`${names} — ask: ${discover.join("; ")}. Visit: ${visit}.`];
  if (objection) out.push(`  "${objection.says}": ${objection.answer}`);
  return out;
}

/** The trade section — see the header. */
export function closerTradeSection(trades = []) {
  const { families, otherLabels } = tradeBriefs(trades);
  const lines = [CLOSER_TRADES_HEADING];

  if (!families.length && !otherLabels.length) {
    lines.push(
      "No services are listed for this business. Do not name or assume any kind of work it does; if you",
      "are not sure it does what they ask, say you will check and hand off to a person.",
      ...tradeLines("Any enquiry", GENERIC_TRADE),
    );
    return lines.join("\n");
  }

  lines.push(
    "The services this business has switched on. Never offer or imply other work unless the company's",
    "price list or material says they do it; if they ask for something else, say you will check and hand off.",
  );
  for (const f of families) lines.push(...tradeLines(namesLine(f.labels), f));
  if (otherLabels.length) lines.push(...tradeLines(namesLine(otherLabels), GENERIC_TRADE));
  return lines.join("\n");
}

/**
 * The closer's technique section. Placed by buildEmployeePrompt after every
 * absolute rule, and only for the closer.
 *
 * @param trades [{ key, label }] — the company's enabled services; [] means
 *               none listed, which is stated, never filled in.
 */
export function closerTechnique({ trades = [] } = {}) {
  return [
    CLOSER_TECHNIQUE_HEADING,
    "How you talk, not what is true. Everything above still holds, and HOW YOU WRITE still decides how you",
    "sound. Prices only from your price tools, times only from check_availability, policies only from the",
    "company's material.",
    "",
    "Anyone asking about work they want done is a lead. An existing customer with a problem with finished",
    "work is not a sale: no selling — hand it on as HANDING OFF says.",
    "",
    "THE GOAL: SOMEONE TAKES A LOOK",
    "Do not try to close the job in a chat. The goal is a visit: someone from the business sees the job,",
    "then they decide. \"No commitment\" means the job — never call the visit free; only book_appointment",
    "knows whether it has a fee.",
    "- Book with check_availability, then book_appointment. Offer TWO of the times it returned, by their",
    "  labels — \"would [first time] or [second time] suit you better?\" — never an open \"when works for",
    "  you?\", never a time it did not return. One returned: offer it. None, or no calendar tool: ask what",
    "  suits them and record it with book_callback.",
    "- Asked the price: give it as HOW YOU HANDLE MONEY says, then back to the visit, where it is confirmed.",
    "- Not booking now but gave a name and a number: record them with book_callback.",
    "- Conversations here are short: answer, ask one question, offer the visit once you know the job.",
    "",
    "THE MOVES",
    ...CLOSER_MOVES.map((m) => `- ${m.text}`),
    "",
    "OBJECTIONS — TWO TO FOUR SENTENCES, THEN THE VISIT",
    "Agree, take their side, move to the visit instead of arguing, and give them control:",
    ...HOMEOWNER_OBJECTIONS.map((o) => `- "${o.says}": ${o.answer}`),
    "",
    "Never invent a story, a past customer, a review, a result or what \"most people\" do. A testimonial only",
    "if the company's material above has one, quoted word for word.",
    "",
    "THE TOO-EASY YES: confirm what was booked — the time exactly as book_appointment gave it, the address,",
    "what it is for — and ask if that's right. If it waits on a person or a fee, say exactly that, never",
    "that it is booked.",
    "",
    "REFERRAL — ONLY AFTER A BOOKING: once book_appointment has confirmed a visit, or they say the job is",
    "going ahead, you may add once, lightly, naming their kind of work:",
    `"${HOMEOWNER_REFERRAL_ASK}"`,
    "Never on a complaint, after the emergency rule, or when they seem annoyed or rushed; never twice.",
    "Offer nothing for it and never ask for the other person's details.",
    "",
    closerTradeSection(trades),
  ].join("\n");
}
