// lib/messaging/conversationSignals.js
//
// What a homeowner actually SAID that separates the ones who buy from the ones
// who don't. Pure, free, no model, and every hit carries the fragment it
// matched.
//
// ══ Where this comes from ══════════════════════════════════════════════════
//
// Twenty real Facebook Messenger threads from the owner's own cabinet shop,
// with the real outcomes attached (docs are in the session brief; the decisive
// lines are encoded as fixtures in scripts/check-conversation-score.mjs). Not
// invented, and not a general "lead scoring" idea borrowed from a CRM blog.
//
// ══ THE TRAP THIS FILE EXISTS TO AVOID ═════════════════════════════════════
//
// EFFORT IS NOT INTENT.
//
// Sylvaine wrote more than Davidpaul. She stated a budget, gave an address, an
// email and a phone number, sent photos, and took a scheduled call. She asked
// careful questions about wood versus MDF and about a glass door on the corner
// cabinet. She was quoted $13,050 and never answered again.
//
// Davidpaul stated no budget, was on a cruise, gave his address late — and
// asked how to pay, whether the shop was open Saturday, and moved his own
// dates twice. He paid.
//
// The Meta AI already in the thread got this backwards: it transferred
// Sylvaine's chat with "your customer is ready to buy" and transferred
// Davidpaul's with no such note. It read detail and enthusiasm as intent.
//
// So NOTHING here scores length, message count, reply speed, photo count,
// contactability, politeness or the SIZE of a stated budget. Those are all
// effort. What is scored is BEHAVIOUR — the things somebody does when they are
// arranging a purchase rather than researching one.
//
// Two of them are recorded at weight ZERO on purpose (`noted: true`): a stated
// budget, and product questions. They are the trap, they are worth nothing,
// and a contractor reading the reasons should be able to SEE that they were
// noticed and deliberately not counted.
//
// ══ Detection is deliberately dumb ═════════════════════════════════════════
//
// Phrase lists, matched case- and punctuation-insensitively on whole words.
// No stemming, no fuzzy match, no classifier. A cleverer matcher is a matcher
// nobody can predict, and the whole point of a free rule score is that the
// contractor can read the quoted fragment and agree or disagree with it in one
// second. When a rule cannot tell, it does not fire — it never guesses.

import { isDeliveredReply } from "./messageKinds";

// ═══════════════════════════════════════════════════════════════════════════
// 0. Normalisation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One message body, flattened so a phrase list can match it.
 *
 * Accents folded, lowercased, apostrophes DELETED rather than kept — "I'll",
 * "Ill" and "I ll" are one word to a homeowner typing on a phone, and a list
 * written with apostrophes would match one spelling of three. Everything else
 * that is not a letter or a digit becomes a space — punctuation INCLUDED, which
 * is the half that matters: "how do i pay," is the same question as "how do i
 * pay", and a matcher that kept the comma would find neither. Money is parsed
 * from the ORIGINAL text by moneyFigures(), so nothing is lost by flattening
 * the dollar sign away here.
 *
 * The result is padded with spaces at both ends so `includes(" phrase ")` is a
 * whole-word match without a regex per phrase.
 */
export function flatten(text) {
  const body = String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ` ${body} `;
}

/** Does this flattened body contain any of these phrases, as whole words? */
function firstPhrase(flat, phrases) {
  for (const p of phrases) {
    if (flat.includes(` ${p} `)) return p;
  }
  return null;
}

/**
 * The sentence a phrase was found in, from the ORIGINAL text.
 *
 * The contractor is shown what the person actually typed, accents, capitals
 * and all — a normalised fragment reads like something the software made up,
 * and the entire argument for showing a quote is that it is checkable.
 *
 * Falls back to the whole message when the sentence cannot be located, and is
 * capped: a reason line is not a transcript.
 */
export function quoteFor(original, phrase, { max = 160 } = {}) {
  const raw = String(original ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const clip = (s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
  // No phrase to find — a structural signal (silence) quotes the whole line.
  if (!String(phrase ?? "").trim()) return clip(raw);
  const parts = raw.split(/(?<=[.!?])\s+|\n+/);
  for (const part of parts) {
    if (flatten(part).includes(` ${phrase} `)) {
      return clip(part);
    }
  }
  return clip(raw);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The phrase lists
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LOGISTICS, raised by the customer. The strongest positive in the corpus —
 * no loser in twenty ever did it.
 *
 * Ayse: "shall the draft be for Truefinish Cabinets or your name?" — asking
 * how to pay before anyone asked her to. Davidpaul: the deposit method, a
 * cheque, the shop address, whether it is open Saturday. Lyne: "when you get
 * here, come in through the garage door."
 *
 * These are the questions of somebody ARRANGING a purchase. Split into four
 * groups because they are four different acts, and a contractor reading the
 * reason wants to know which one happened.
 */
const LOGISTICS_PAYMENT = [
  "how do i pay", "how do we pay", "when do i pay", "how should i pay",
  "can i pay", "how would you like to be paid", "how do you want to be paid",
  "who do i make", "make it out to", "make the cheque out", "make the check out",
  "the draft be for", "bank draft", "certified cheque", "e transfer", "etransfer",
  "interac", "do you take cheque", "do you take a cheque", "do you accept cheque",
  "do you take cash", "do you take credit", "do you accept credit", "credit card",
  "how much deposit", "how much of a deposit", "what deposit", "do you need a deposit",
  "is there a deposit", "when do you need the deposit", "send me the invoice",
  "send the invoice", "where do i send", "do you invoice",
];
const LOGISTICS_START = [
  "when can you start", "when could you start", "when would you start",
  "how soon can you start", "how soon could you start", "when do you start",
  "when can we start", "when can you come", "when could you come",
  "when can you get", "when can we book", "can we book", "lets book",
  "book it in", "put me on the schedule", "get me on the schedule",
  "how soon can you", "what is your lead time", "whats your lead time",
];
const LOGISTICS_ACCESS = [
  "come in through", "come in the", "garage door", "side door", "back door",
  "leave the key", "key will be", "key under", "door code", "the code is",
  "let yourself in", "ill leave it unlocked", "leave it unlocked", "ill be home",
  "i will be home", "someone will be home", "somebody will be home",
  "ill leave the door", "park in the driveway",
];
const LOGISTICS_SHOP = [
  "are you open", "what time do you open", "what are your hours", "your hours",
  "open on saturday", "open saturday", "open sunday", "where is your shop",
  "shop address", "your shop address", "can i drop", "drop them off",
  "when do you pick up", "when will you pick up", "do you pick up",
];

/**
 * SCHEDULE ACCOMMODATION — they move THEIR dates to fit yours.
 *
 * Davidpaul moved his twice. Lyne rebooked three times and kept re-proposing.
 * Alena offered times once and then went quiet.
 *
 * Two tiers, because "how about" on its own is not a signal. A soft phrase has
 * to land in the same message as a day or a time word; a strong phrase stands
 * alone. This is the one place a rule looks at two things at once, and it is
 * still one `includes` per list — not cleverness, arithmetic.
 */
const SCHEDULE_STRONG = [
  "im flexible", "i am flexible", "we are flexible", "whatever works for you",
  "whatever suits you", "reschedule", "ill work around", "i can work around",
  "we can work around", "ill make it work", "i can make it work",
  "ill move things", "i can move things", "no rush on my end",
];
const SCHEDULE_SOFT = [
  "how about", "would that work", "does that work", "that works for me",
  "works for me", "i can do", "we can do", "ill be free", "im free",
  "i am free", "im available", "i am available", "can we push", "push it to",
  "move it to", "shift it to", "ill be back", "when i get back",
  "after i get back", "could we do", "can we do it",
];
const WHEN_WORDS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "today", "tomorrow", "tonight", "morning", "afternoon", "evening", "weekend",
  "next week", "this week", "next month", "am", "pm", "oclock",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
];

/**
 * SCOPE GROWTH, unprompted. Somebody spending more is somebody buying.
 *
 * Davidpaul added the cabinet over the hood, tiling and a wine fridge. Lyne
 * added a second kitchen and the porch cabinets.
 *
 * Deliberately narrow. "What about the corner cabinet?" is NOT here, because
 * that is Sylvaine asking a product question about a job she never bought —
 * and a list loose enough to catch it would score the trap as the signal.
 * Every phrase below carries explicit ADD intent: also, add, as well, another,
 * second, include, extra.
 */
const SCOPE_GROWTH = [
  "can you also", "could you also", "would you also", "can we also",
  "i would also like", "id also like", "we would also like", "wed also like",
  "also like to", "also want", "also need", "also do the", "also doing",
  "while you are here", "while youre here", "while you are there",
  "while youre there", "while you have", "can we add", "can you add",
  "id like to add", "we want to add", "add another", "add a second",
  "second kitchen", "another kitchen", "the other kitchen", "as well as",
  "can you include", "throw in", "how much more would", "how much extra would",
  "what would it cost to add", "what would you charge to add",
];

/**
 * LINE-ITEM NEGOTIATION — arguing about an item on the sheet.
 *
 * Ayse challenged "putting the hinges back on doors are charged?" and asked
 * him to "sharpen your pencil", and paid $11,800. Haggling over a line is what
 * somebody does when they have already decided to buy the thing and is now
 * buying it well.
 *
 * Its mirror image is PRICE_TIER_REJECTION below, and the two must never be
 * confused: one is a customer, the other never was.
 */
const LINE_ITEM = [
  "sharpen your pencil", "sharpen the pencil", "is that included",
  "are those included", "is it included", "included in the price",
  "included in that", "do you charge for", "are charged", "is charged",
  "extra charge", "charge extra", "can you take off", "take that off",
  "if i skip", "if we skip", "if i remove", "if i do it myself",
  "ill supply", "i can supply", "i will supply", "any discount",
  "is there a discount", "knock off", "come down a bit", "split the difference",
  "meet me in the middle", "best you can do on the",
];

/**
 * PRICE-TIER REJECTION — a structural disqualifier, and the judgement call in
 * this file.
 *
 * Phil Assad: "you are at the high end… I am looking for b grade", wanting a
 * "landlord special", holding a $5,000 quote for BRAND NEW cabinets. He argued
 * about the tier, not about a line, and he was never a customer.
 *
 * Treated as structural rather than as "a big negative" because it is not a
 * price objection you can answer with a revised number — the corpus's own
 * win-back play (Mario, $7,051 → $5,876) works on somebody who wanted the
 * work. Somebody asking for a different GRADE of work is asking for a
 * different business.
 *
 * The list is kept to unambiguous grade language for exactly that reason.
 * "That's more than I expected" is NOT here: winners say it, Ayse effectively
 * said it, and disqualifying on it would close the door on the negotiation
 * that produced this corpus's second-biggest job.
 */
const PRICE_TIER_REJECTION = [
  "high end", "higher end", "b grade", "landlord special", "budget option",
  "cheaper option", "something cheaper", "cheapest option", "low end",
  "out of my price range", "out of our price range", "out of my budget",
  "out of our budget", "not in my budget", "not in our budget",
  "cant afford", "cannot afford", "more than i want to spend",
  "more than we want to spend", "way out of", "looking for something cheap",
];

/**
 * COMPARISON SHOPPING, stated explicitly. The single most reliable cold signal
 * in the corpus.
 *
 * Alena, Dee and Manny all said a version of it — Manny's was "I shop around
 * why give me the best price". None of the three bought.
 */
const COMPARISON_SHOPPING = [
  "other quotes", "another quote", "a few quotes", "few other quotes",
  "couple of quotes", "getting quotes", "get some quotes", "get a few quotes",
  "getting a few", "shop around", "shopping around", "i shop around",
  "comparing quotes", "compare quotes", "comparing prices", "compare prices",
  "other estimates", "other companies", "other contractors", "someone else",
  "a few others", "three quotes", "second opinion", "also talking to",
  "also spoke to", "waiting on another",
];

/**
 * THE POLITE PRE-DECLINE. Dee, Alena and Concetta all wrote a version of
 * "I'll let you know either way". None of them let anybody know.
 *
 * "I'll get back to you" is deliberately NOT here: it is what everybody says,
 * including people who get back to you. "Either way" is the tell — it is a
 * promise about the shape of the answer, made by somebody who already knows
 * what the answer is.
 */
const POLITE_PRE_DECLINE = [
  "either way", "ill think about it", "think it over", "need to think about",
  "have to think about", "let me think about", "talk it over and",
  "keep you posted", "well be in touch", "ill be in touch",
  "put this on hold", "on hold for now", "hold off for now",
  "not right now", "down the road", "maybe in the fall", "maybe in the spring",
];

/**
 * AN EXPLICIT REJECTION — a disqualifier that may fire on message one.
 *
 * Dunia Coulombe clicked an ad by accident: "I did not message you… nothing is
 * needed." One turn, and it is over. This is the one place a thread can be
 * called cold with almost nothing in it, and the reason it is allowed is that
 * a stated refusal is not a small sample — it is an answer.
 */
const EXPLICIT_REJECTION = [
  "i did not message", "i didnt message", "i did not contact", "i didnt contact",
  "nothing is needed", "nothing needed", "not interested", "im not interested",
  "i am not interested", "no thanks", "no thank you", "wrong number",
  "by mistake", "by accident", "clicked by accident", "didnt mean to",
  "did not mean to", "remove me", "unsubscribe", "stop messaging me",
  "sorry wrong", "not looking for anything",
];

/**
 * PRODUCT QUESTIONS — recorded, and worth ZERO.
 *
 * Sylvaine's whole thread is this: wood versus MDF, shaker in white, a glass
 * door on the corner cabinet, trim to hide a light fixture. It is engagement,
 * and engagement is not intent. It is kept as a noted observation rather than
 * dropped so that the contractor can see the scorer NOTICED the detail and
 * deliberately gave it nothing — which is the sentence this whole feature
 * exists to be able to say.
 */
const PRODUCT_QUESTIONS = [
  "wood or mdf", "mdf or wood", "solid wood", "what kind of paint",
  "which paint", "what finish", "matte or", "satin or", "shaker",
  "what colours", "what colors", "colour options", "color options",
  "glass door", "soft close", "what brand", "how many coats",
  "does it chip", "will it chip", "how long does it last", "what is the process",
  "whats the process", "how does it work",
];

/** Words that make a money figure in the same message a stated BUDGET. */
const BUDGET_WORDS = [
  "budget", "budgeted", "spend", "spending", "afford", "price range",
  "looking to spend", "hoping to spend", "hoping to stay", "stay around",
  "stay under", "keep it under", "up to", "no more than", "maximum", "max",
  "ballpark", "around", "about",
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Money, and why a bigger number is worth nothing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The money figures a message states, in dollars.
 *
 * Only figures written with a currency sign or a "k" suffix count. A bare
 * number in this trade is 26 doors, 7 drawers or a house number far more often
 * than it is money, and reading "26" as a budget is how a scorer comes to
 * disqualify a real kitchen.
 */
export function moneyFigures(text) {
  const raw = String(text ?? "");
  const out = [];
  for (const m of raw.matchAll(/\$\s?(\d[\d,\s]*(?:\.\d+)?)\s*(k\b)?/gi)) {
    const n = Number(String(m[1]).replace(/[,\s]/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(m[2] ? n * 1000 : n);
  }
  for (const m of raw.matchAll(/(?<![$\d.,])\b(\d{1,3}(?:\.\d+)?)\s?k\b/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) out.push(n * 1000);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Where they said they are
// ═══════════════════════════════════════════════════════════════════════════

/** Words a capture can end on that are not part of a place name. */
const PLACE_TAIL = new Set([
  "and", "but", "so", "the", "a", "is", "it", "we", "i", "just", "about",
  "area", "ontario", "quebec", "on", "qc", "canada", "with", "for", "if",
  "right", "now", "still", "also", "too", "my", "our", "your", "his", "her",
]);

/**
 * Captures that are not places, however well they fit the pattern.
 *
 * "I'm in a bit of a rush", "we're in the middle of a reno", "I'm in love with
 * the colour" all parse as somebody naming a town. Listed rather than
 * pattern-matched, because the honest description of this rule is that it is a
 * regex with a short blocklist, and pretending otherwise is how a guess starts
 * looking like a fact.
 */
const NOT_A_PLACE = new Set([
  "a bit", "a rush", "a hurry", "the middle", "the process", "the market",
  "the works", "love", "the same", "no rush", "the meantime", "a while",
  "the morning", "the afternoon", "the evening", "the kitchen", "the house",
  "the basement", "the trades", "town", "the trade", "a jam", "the dark",
  "touch", "need", "the meanwhile", "charge", "any case", "that case",
]);

const PLACE_PATTERNS = [
  /\b(?:i ?a?m|we ?a?re|i live|we live|were located|im located|we are located|i am located|located|based|the house is|the home is|the property is|the job is|the kitchen is|it ?s|its)\s+(?:in|at|near|out in|over in|way out in)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/g,
  /\b(?:i ?a?m|we ?a?re)\s+from\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/g,
];

/**
 * Places a homeowner said they are in, normalised.
 *
 * Deliberately only the explicit forms — "I'm in Cornwall", "we're located in
 * Pembroke", "the house is in Aylmer". A bare place name dropped into a
 * sentence is not claimed: half the time it is where somebody's daughter
 * lives, and inventing a job site from it is exactly the padding this codebase
 * keeps deleting.
 */
export function statedPlaces(text) {
  const flat = flatten(text);
  const out = [];
  for (const pattern of PLACE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of flat.matchAll(pattern)) {
      let place = String(m[1] || "").trim();
      // Trailing filler: "cornwall and" is Cornwall.
      const words = place.split(" ");
      while (words.length > 1 && PLACE_TAIL.has(words[words.length - 1])) words.pop();
      place = words.join(" ");
      if (place.length < 3) continue;
      if (PLACE_TAIL.has(place) || NOT_A_PLACE.has(place)) continue;
      if (!out.includes(place)) out.push(place);
    }
  }
  return out;
}

/**
 * The place names a company works in, from the words the company itself wrote.
 *
 * Source in production is CompanySite.interview.serviceArea ("Gatineau,
 * Ottawa, and about an hour either side") plus Company.city. Split on commas
 * and joining words, and everything that reads as prose rather than a place is
 * dropped.
 *
 * An EMPTY result is the important case: a company that has never said where
 * it works can never have a conversation disqualified for being outside an
 * area it has not described. Absence of a statement is not a statement.
 */
export function serviceAreaPlaces({ serviceAreaText = "", city = "" } = {}) {
  const out = [];
  const push = (raw) => {
    const flat = flatten(raw).trim();
    if (!flat || flat.length < 3) return;
    if (PLACE_TAIL.has(flat) || NOT_A_PLACE.has(flat)) return;
    // "about an hour either side" and friends: prose, not a place.
    if (flat.split(" ").length > 3) return;
    if (/\b(hour|hours|minute|minutes|km|mile|miles|radius|side|around|within|surrounding)\b/.test(flat)) return;
    if (!out.includes(flat)) out.push(flat);
  };
  for (const part of String(serviceAreaText ?? "").split(/[,;/\n]|\band\b|\bor\b|\bplus\b/i)) push(part);
  push(city);
  return out;
}

/** Is a stated place inside the company's own list? Substring, both ways. */
export function placeIsServed(place, served = []) {
  const p = String(place || "").trim();
  if (!p) return true;
  // Nothing to check against. A company that has never said where it works
  // serves everywhere as far as this rule is concerned — the alternative is a
  // homeowner disqualified by a list that does not exist.
  if (!Array.isArray(served) || !served.length) return true;
  for (const s of served) {
    if (!s) continue;
    if (p === s || p.includes(s) || s.includes(p)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. What a quote going out looks like from the transcript
// ═══════════════════════════════════════════════════════════════════════════

const QUOTE_SENT = [
  "here is your quote", "heres your quote", "here is the quote", "heres the quote",
  "attached is the quote", "attached is your quote", "ive sent the quote",
  "i sent the quote", "sent you the quote", "sent you a quote", "your quote is",
  "here is your estimate", "heres your estimate", "sent you the estimate",
  "your estimate is", "the estimate is attached", "quote is attached",
  "estimate is attached", "i have sent you a quote",
];

/** Days of nothing before "they went quiet" is a fact rather than a weekend. */
export const SILENCE_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════
// 5. The extractor
// ═══════════════════════════════════════════════════════════════════════════

/** Every signal id this file can produce. Closed, so a screen can switch. */
export const SIGNAL_IDS = Object.freeze([
  "logistics_initiated",
  "schedule_accommodation",
  "scope_growth",
  "line_item_negotiation",
  "price_tier_rejection",
  "comparison_shopping",
  "polite_pre_decline",
  "explicit_rejection",
  "out_of_area",
  "budget_below_floor",
  "silence_after_quote",
  "budget_stated",
  "product_questions",
]);

/** The ones that end the conversation before a quote is worth writing. */
export const DISQUALIFYING_SIGNALS = Object.freeze([
  "explicit_rejection",
  "out_of_area",
  "budget_below_floor",
  "price_tier_rejection",
]);

/** The i18n key for a signal's label. One place, so a chip and a report agree. */
export function signalLabelKey(id) {
  return `app.messages.signal.${id}`;
}

const ms = (d) => {
  const t = d instanceof Date ? d.getTime() : Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

/**
 * Read a conversation and say what was in it.
 *
 * @param messages  rows shaped like Message: { direction, private, body,
 *                  sentAt, failedReason }. Notes and system lines are ignored
 *                  — a colleague's note about a customer is not the customer
 *                  saying something.
 * @param now       for the silence measurement only.
 * @param serviceArea  { places: string[] } — the company's OWN words. Empty
 *                  means the out-of-area rule cannot fire at all.
 * @param minimumJobPrice  the lowest a job can go out at, from the company's
 *                  own configuration. Null means the budget rule cannot fire.
 * @param quoteSentAt  when a quote actually left, if the caller knows. Null is
 *                  fine — the transcript is read for it as a fallback.
 *
 * @returns {{ signals: Array<{id,direction,quote,labelKey,detail}>,
 *             inboundCount:number, messageCount:number }}
 */
export function extractSignals({
  messages = [],
  now = new Date(),
  serviceArea = null,
  minimumJobPrice = null,
  quoteSentAt = null,
} = {}) {
  const rows = (Array.isArray(messages) ? messages : []).filter(
    (m) => m && (m.direction === "in" || m.direction === "out") && m.private !== true,
  );
  const inbound = rows.filter((m) => m.direction === "in");
  const outbound = rows.filter((m) => isDeliveredReply(m));

  const signals = [];
  const seen = new Set();
  const add = (id, direction, quote, detail = null) => {
    if (seen.has(id)) return;
    seen.add(id);
    signals.push({ id, direction, labelKey: signalLabelKey(id), quote: quote || "", detail });
  };

  // ── The customer's own words ────────────────────────────────────────────
  //
  // Only inbound. A logistics question the CONTRACTOR asked is the contractor
  // doing their job, and counting it would score every thread the company
  // handled well as a thread the customer was buying in.
  let logisticsMessages = 0;
  const logisticsGroups = [];

  for (const m of inbound) {
    const body = m.body || "";
    const flat = flatten(body);
    if (!flat.trim()) continue;

    // Logistics — counted per MESSAGE, because Davidpaul asking four separate
    // arranging questions across four days is a stronger fact than one aside.
    let hitThisMessage = false;
    for (const [group, list] of [
      ["payment", LOGISTICS_PAYMENT],
      ["start", LOGISTICS_START],
      ["access", LOGISTICS_ACCESS],
      ["shop", LOGISTICS_SHOP],
    ]) {
      const phrase = firstPhrase(flat, list);
      if (!phrase) continue;
      if (!hitThisMessage) {
        hitThisMessage = true;
        logisticsMessages += 1;
      }
      if (!logisticsGroups.includes(group)) logisticsGroups.push(group);
      add("logistics_initiated", "positive", quoteFor(body, phrase), { group });
    }

    const strongWhen = firstPhrase(flat, SCHEDULE_STRONG);
    if (strongWhen) add("schedule_accommodation", "positive", quoteFor(body, strongWhen));
    else {
      const softWhen = firstPhrase(flat, SCHEDULE_SOFT);
      // A soft phrase only counts beside a day or a time. "How about" on its
      // own is how people ask about anything.
      if (softWhen && firstPhrase(flat, WHEN_WORDS)) {
        add("schedule_accommodation", "positive", quoteFor(body, softWhen));
      }
    }

    const grew = firstPhrase(flat, SCOPE_GROWTH);
    if (grew) add("scope_growth", "positive", quoteFor(body, grew));

    const line = firstPhrase(flat, LINE_ITEM);
    if (line) add("line_item_negotiation", "positive", quoteFor(body, line));

    const tier = firstPhrase(flat, PRICE_TIER_REJECTION);
    if (tier) add("price_tier_rejection", "structural", quoteFor(body, tier));

    const shopping = firstPhrase(flat, COMPARISON_SHOPPING);
    if (shopping) add("comparison_shopping", "negative", quoteFor(body, shopping));

    const predecline = firstPhrase(flat, POLITE_PRE_DECLINE);
    if (predecline) add("polite_pre_decline", "negative", quoteFor(body, predecline));

    const rejected = firstPhrase(flat, EXPLICIT_REJECTION);
    if (rejected) add("explicit_rejection", "structural", quoteFor(body, rejected));

    const product = firstPhrase(flat, PRODUCT_QUESTIONS);
    if (product) add("product_questions", "noted", quoteFor(body, product));

    // ── A stated budget: recorded, worth nothing, and able to disqualify ──
    const budgetWord = firstPhrase(flat, BUDGET_WORDS);
    if (budgetWord) {
      const figures = moneyFigures(body);
      if (figures.length) {
        const stated = Math.min(...figures);
        add("budget_stated", "noted", quoteFor(body, budgetWord), { amount: stated });
        if (Number.isFinite(minimumJobPrice) && minimumJobPrice > 0 && stated < minimumJobPrice) {
          add("budget_below_floor", "structural", quoteFor(body, budgetWord), {
            amount: stated,
            floor: minimumJobPrice,
          });
        }
      }
    }

    // ── Outside the area ─────────────────────────────────────────────────
    const served = Array.isArray(serviceArea?.places) ? serviceArea.places : [];
    if (served.length) {
      for (const place of statedPlaces(body)) {
        if (!placeIsServed(place, served)) {
          add("out_of_area", "structural", quoteFor(body, place), { place, served });
        }
      }
    }
  }

  // ── Silence after a quote, with an unanswered follow-up ─────────────────
  //
  // Structural rather than textual: the last thing that happened is that WE
  // wrote twice and nobody wrote back. Sylvaine, Nicole, Milad and Prabhjot
  // all end exactly like this.
  const last = rows[rows.length - 1];
  const lastInboundAt = inbound.length ? ms(inbound[inbound.length - 1].sentAt) : null;
  const quoteWentOut =
    Boolean(quoteSentAt) || outbound.some((m) => firstPhrase(flatten(m.body || ""), QUOTE_SENT));
  if (quoteWentOut && last && last.direction === "out" && lastInboundAt !== null) {
    const chasers = outbound.filter((m) => {
      const t = ms(m.sentAt);
      return t !== null && t > lastInboundAt;
    });
    const gapDays = (ms(now) - lastInboundAt) / 86400000;
    // Two outbound since they last spoke: the quote, and a follow-up nobody
    // answered. One outbound is a quote sent yesterday, which is not silence.
    if (chasers.length >= 2 && gapDays >= SILENCE_DAYS) {
      add("silence_after_quote", "negative", quoteFor(chasers[chasers.length - 1].body, ""), {
        days: Math.floor(gapDays),
      });
    }
  }

  return {
    signals,
    // Carried out because the SCORE is forbidden to use them and the
    // confidence is required to. Two different jobs, one measurement.
    inboundCount: inbound.length,
    messageCount: rows.length,
    logisticsMessages,
    logisticsGroups,
  };
}
