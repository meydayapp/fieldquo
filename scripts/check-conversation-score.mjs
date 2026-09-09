// scripts/check-conversation-score.mjs
//
//   npm run check:conversation-score
//
// Twenty real conversations, executed rather than read.
//
// ══ Why this file is the design document ═══════════════════════════════════
//
// The owner handed over twenty real Facebook Messenger threads from his own
// cabinet-refinishing business, with the real outcomes attached, precisely so
// this scorer would be built from customer behaviour rather than from someone's
// idea of it. The decisive lines of each are encoded below — paraphrased down
// to what mattered, with the real phrasing kept where the phrasing IS the
// signal ("shall the draft be for Truefinish Cabinets or your name?",
// "sharpen your pencil", "you are at the high end… I am looking for b grade").
//
// ══ THE FAILURE BEING DESIGNED AGAINST ═════════════════════════════════════
//
// Sylvaine Champagne outscores Davidpaul Kingsbury on every structured field
// this product has: she stated a budget, gave three ways to reach her, sent
// photographs, took a scheduled call, and wrote long, careful, specific
// messages. She was quoted $13,050 and never answered again. Davidpaul stated
// no budget, was on a cruise, gave his address late — and paid.
//
// The Meta AI already in that inbox got it exactly backwards: it transferred
// her chat with "your customer is ready to buy". Any scorer that rewards
// detail, length or enthusiasm reproduces that failure, so this file asserts
// the ranking AND mutation-tests it: a version of the scorer that adds points
// for message count is written to disk, this file is re-run against it, and it
// must FAIL. A check that passes against a scorer rewarding effort certifies
// the bug.
//
// ══ The acceptance test, in the corpus's own words ═════════════════════════
//
//   "At the moment each quote goes out, it must rank Davidpaul, Lyne, Ayse and
//    Ian above Sylvaine, Alena, Nicole and Dee. Dunia must be cold from her
//    first message. Khan, Tracey, Guirlène and Phil must be identifiable as
//    structurally unwinnable BEFORE a quote is written. And it must say why in
//    the contractor's own words."
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  flatten,
  quoteFor,
  moneyFigures,
  statedPlaces,
  serviceAreaPlaces,
  placeIsServed,
  extractSignals,
  SIGNAL_IDS,
  DISQUALIFYING_SIGNALS,
  signalLabelKey,
  SILENCE_DAYS,
} from "../lib/messaging/conversationSignals.js";
import {
  scoreConversation,
  applyAiRead,
  storableScore,
  readStoredScore,
  bandFor,
  TEMPERATURES,
  BASE_SCORE,
  WEIGHTS,
  AI_ADJUSTMENT,
  MIN_MESSAGES_FOR_CONFIDENCE,
} from "../lib/messaging/conversationScore.js";
import {
  readConversationTemperature,
  buildExamples,
  aiReadIsStale,
  CONVERSATION_TEMPERATURE_FEATURE,
  MIN_MESSAGES_FOR_AI_READ,
} from "../lib/ai/conversationTemperature.js";
import { ConversationReviewTenantError } from "../lib/ai/conversationReview.js";
import { buildMonthlyReview } from "../lib/messaging/monthlyReview.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments removed — a comment QUOTING a shape is not the shape. */
const code = (p) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

let checks = 0;
let failures = 0;
const ok = (cond, label, detail) => {
  if (typeof cond === "string") throw new TypeError(`ok() called label-first: ${JSON.stringify(cond)}`);
  if (typeof label !== "string") throw new TypeError("ok() needs a string label second");
  checks++;
  if (!cond) failures++;
  console.log(
    (cond ? "  ok   " : "  FAIL ") +
      label +
      (cond || detail === undefined ? "" : `  — ${JSON.stringify(detail).slice(0, 320)}`),
  );
};
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// The corpus, as fixtures
// ═══════════════════════════════════════════════════════════════════════════
//
// One paraphrased thread each. Day numbers so the silence measurement has real
// gaps to work with; everything else is the words.

const DAY = 86400000;
const T0 = Date.parse("2026-02-02T09:00:00Z");
const at = (day, hour = 9) => new Date(T0 + day * DAY + hour * 3600000);

const inb = (day, body, hour) => ({ direction: "in", private: false, body, sentAt: at(day, hour), failedReason: null });
const out = (day, body, hour) => ({ direction: "out", private: false, body, sentAt: at(day, hour), failedReason: null });

/** TrueFinish's own words about where it works, as the site interview holds them. */
const SERVICE_AREA = {
  places: serviceAreaPlaces({
    serviceAreaText: "Gatineau, Ottawa, Aylmer and Orleans, and about an hour either side.",
    city: "Gatineau",
  }),
};
/** The floor a whole-kitchen refinish can be done for, as the shop sets it. */
const FLOOR = 4000;

const CTX = { serviceArea: SERVICE_AREA, minimumJobPrice: FLOOR };

// ── WON ───────────────────────────────────────────────────────────────────

/** Davidpaul Kingsbury — $3,060, invoiced, booked 26 Oct. No budget. On a cruise. */
const DAVIDPAUL = [
  inb(0, "Hi, I saw your page. Can I give you a call?"),
  out(0, "Sure — any time this afternoon.", 10),
  inb(0, "Do it.", 11),
  inb(1, "How much of a deposit do you need, and can I pay by cheque?"),
  inb(2, "What is your shop address? Are you open saturday?"),
  inb(3, "I would also like the cabinet over the hood taken out, and a wine fridge put in."),
  inb(4, "I am on a cruise until the 12th. Can we push it to monday the 26th instead?"),
  out(5, "No problem, the 26th is yours."),
];

/** Lyne Tremblay — two kitchens, deposit paid, job run in May. */
const LYNE = [
  inb(0, "Bonjour! I want my kitchen cabinets refinished, white."),
  out(0, "Happy to take a look. Whereabouts are you?", 10),
  inb(0, "We are in Aylmer. When you get here, come in through the garage door.", 11),
  inb(1, "I am flexible, whatever works for you."),
  inb(2, "Can you also do my mother's kitchen? It would be a second kitchen, same colour."),
  out(3, "Yes — I will price both."),
];

/** Ayse Akgun — $11,800, $5,900 bank draft, job run. Haggled over the hinges. */
const AYSE = [
  inb(0, "Hello, I need my kitchen doors sprayed."),
  out(0, "I can do that. How many doors and drawers?", 10),
  inb(0, "Twenty-six doors and seven drawers.", 11),
  out(1, "Here is your quote."),
  inb(1, "Putting the hinges back on doors are charged? Please sharpen your pencil.", 12),
  inb(2, "Shall the draft be for Truefinish Cabinets or your name?"),
];

/** Ian Pereira — a renovation contractor subcontracting, 20% markup agreed. */
const IAN = [
  inb(0, "I am a reno contractor, I have a kitchen for you if the numbers work."),
  out(0, "Send me the counts and I will price it.", 10),
  inb(0, "Thirty-two doors. Is the hardware included in the price?", 11),
  inb(1, "When can you start? The site is ready."),
  inb(2, "Who do I make the cheque out to?"),
  out(3, "The company. I will send the invoice."),
];

// ── QUOTED, THEN SILENCE ──────────────────────────────────────────────────

/** Sylvaine Champagne — $13,050, budget stated, photos, a call, and nothing. */
const SYLVAINE = [
  inb(0, "Hello! We just bought a house in Ottawa and the kitchen needs doing."),
  out(0, "Happy to help. Tell me about it.", 10),
  inb(
    0,
    "There are thirty-one doors and nine drawers. I have attached photographs of every wall, the sink run and the corner. The uppers are oak and the lowers might be MDF — is it wood or mdf that takes the finish better? I would like shaker in white.",
    11,
  ),
  inb(
    1,
    "One more thing: the corner cabinet has a glass door. Can that be sprayed too, and can trim be added to hide the light fixture above the sink?",
  ),
  inb(
    1,
    "I would like to stay around 15K even though that might be ambitious. I am willing to compromise on the island if that helps.",
    12,
  ),
  inb(2, "Tuesday afternoon is fine for the call."),
  out(3, "Here is your quote."),
];

/** Alena McCarrell — offered times once, then went quiet. */
const ALENA = [
  inb(0, "Hi, how much to refinish kitchen cabinets?"),
  out(0, "Depends on the counts — how many doors?", 10),
  inb(0, "About twenty. How about thursday morning for you to come look?", 11),
  inb(1, "I am getting a few other quotes before I decide."),
  inb(2, "I will let you know either way."),
  out(3, "Here is your quote."),
];

/** Nicole Benjamin — quoted, then silence. Nothing decisive was ever said. */
const NICOLE = [
  inb(0, "Hi there, do you do kitchen cabinets?"),
  out(0, "We do — refinishing and refacing.", 10),
  inb(0, "Okay. Mine are oak.", 11),
  out(1, "How many doors and drawers?"),
  inb(1, "Eighteen doors I think.", 12),
  out(2, "Here is your quote."),
];

/** Dee Stefano — chose a shop that paints off-site, which TrueFinish also does. */
const DEE = [
  inb(0, "Hello, looking at getting my cabinets done."),
  out(0, "Happy to quote it.", 10),
  inb(0, "We are getting a few quotes first.", 11),
  inb(1, "I will let you know either way, promise."),
  out(2, "Here is your quote."),
  inb(2, "Thanks.", 12),
];

// ── DEAD ON ARRIVAL, AND THE STRUCTURALLY UNWINNABLE ──────────────────────

/** Dunia Coulombe — clicked an ad by accident. ONE message. */
const DUNIA = [inb(0, "I did not message you. Nothing is needed.")];

/** Khan Mushtaq — Cornwall. The visit is not free. First three messages. */
const KHAN = [
  inb(0, "Hi, I want a quote for kitchen cabinets."),
  out(0, "Sure — whereabouts are you?", 10),
  inb(0, "I am in Cornwall, is that too far for you?", 11),
];

/** Tracey Leroux — Pembroke. Went silent right after the wall of questions. */
const TRACEY = [
  inb(0, "Do you refinish cabinets?"),
  out(0, "We do. Where is the house?", 10),
  inb(0, "The house is in Pembroke.", 11),
];

/** Guirlène Roche — $3,500 for a kitchen that cannot be done for it. */
const GUIRLENE = [
  inb(0, "Bonjour, I would like the kitchen cabinets painted."),
  out(0, "Happy to price it — how many doors?", 10),
  inb(0, "My budget is $3,500 for the whole kitchen.", 11),
];

/** Phil Assad — "landlord special", a $5,000 quote for BRAND NEW cabinets. */
const PHIL = [
  inb(0, "What do you charge for a kitchen?"),
  out(0, "It depends on counts and condition.", 10),
  inb(
    0,
    "You are at the high end. I am looking for b grade, a landlord special — I have a quote for new cabinets already.",
    11,
  ),
];

/** Mario Laroche — quoted, quiet, won back with a revised number, then a car repair. */
const MARIO_AT_QUOTE = [
  inb(0, "Hi, kitchen cabinets, twenty-two doors."),
  out(0, "I can price that.", 10),
  inb(0, "Sounds good, send it over.", 11),
  out(1, "Here is your quote."),
  out(4, "Any thoughts on the quote?"),
];

const WON_AT_QUOTE = { Davidpaul: DAVIDPAUL, Lyne: LYNE, Ayse: AYSE, Ian: IAN };
const LOST_AT_QUOTE = { Sylvaine: SYLVAINE, Alena: ALENA, Nicole: NICOLE, Dee: DEE };
const UNWINNABLE = { Khan: KHAN, Tracey: TRACEY, "Guirlène": GUIRLENE, Phil: PHIL };

/** Score a fixture at the moment its quote goes out — the day of the last message. */
const scoreAtQuote = (messages, extra = {}) =>
  scoreConversation({
    messages,
    // The instant the last message landed: no silence has happened yet, which
    // is the whole point of "at the moment each quote goes out".
    now: new Date(messages[messages.length - 1].sentAt.getTime() + 60000),
    ...CTX,
    ...extra,
  });

// ═══════════════════════════════════════════════════════════════════════════
section("1. Matching — dumb on purpose, and it has to survive real typing");
// ═══════════════════════════════════════════════════════════════════════════

ok(flatten("HOW do I pay?!") === " how do i pay ", "case and punctuation are flattened away", flatten("HOW do I pay?!"));
ok(flatten("I'll let you know") === " ill let you know ", "apostrophes are deleted, not kept — one spelling of three otherwise", flatten("I'll let you know"));
ok(flatten("Café déjà") === " cafe deja ", "accents fold", flatten("Café déjà"));
ok(flatten(null) === "  ", "null text flattens to nothing and throws nothing", flatten(null));
{
  // The bug that would have made half the phrase list dead: a trailing comma.
  const s = extractSignals({ messages: [inb(0, "How do I pay, and when can you start?")] });
  ok(s.signals.some((x) => x.id === "logistics_initiated"), "a phrase followed by a comma still matches");
}
{
  const s = extractSignals({ messages: [inb(0, "hOw Do I PaY")] });
  ok(s.signals.some((x) => x.id === "logistics_initiated"), "...and so does one typed in any case");
}
ok(
  quoteFor("Hello there. How do I pay? Thanks.", "how do i pay") === "How do I pay?",
  "the quote is the SENTENCE it was found in, from the original text",
  quoteFor("Hello there. How do I pay? Thanks.", "how do i pay"),
);
ok(quoteFor("x".repeat(400), "").length <= 160, "a quote is capped — a reason line is not a transcript");
ok(quoteFor(null, "x") === "", "no text, no quote, no crash");

// ── Money: only what is written as money ─────────────────────────────────
ok(moneyFigures("my budget is $3,500").join() === "3500", "a dollar figure with a separator is read", moneyFigures("my budget is $3,500"));
ok(moneyFigures("stay around 15K").join() === "15000", "a k suffix is thousands", moneyFigures("stay around 15K"));
ok(
  moneyFigures("26 doors and 7 drawers").length === 0,
  "bare numbers are NOT money — this trade's messages are full of door counts",
  moneyFigures("26 doors and 7 drawers"),
);
ok(moneyFigures("the house is at 4120 Oak Avenue").length === 0, "and neither is a house number");

// ── Places: only what was claimed ────────────────────────────────────────
ok(statedPlaces("I'm in Cornwall, is that too far?").includes("cornwall"), "a stated place is captured", statedPlaces("I'm in Cornwall, is that too far?"));
ok(statedPlaces("The house is in Pembroke.").includes("pembroke"), "...in the other common form too", statedPlaces("The house is in Pembroke."));
ok(
  statedPlaces("My daughter lives in Cornwall but the kitchen is here").length === 0,
  "a place somebody else lives in is NOT a claim about the job",
  statedPlaces("My daughter lives in Cornwall but the kitchen is here"),
);
ok(statedPlaces("I'm in a bit of a rush").length === 0, "'in a bit of a rush' is not a town", statedPlaces("I'm in a bit of a rush"));
ok(statedPlaces("we're in the middle of a reno").length === 0, "and neither is 'the middle of a reno'");
ok(SERVICE_AREA.places.includes("gatineau") && SERVICE_AREA.places.includes("ottawa"), "the company's own words become place tokens", SERVICE_AREA.places);
ok(
  !SERVICE_AREA.places.some((p) => /hour|side|about/.test(p)),
  "...and the prose around them does not ('about an hour either side' is not a town)",
  SERVICE_AREA.places,
);
ok(placeIsServed("ottawa", SERVICE_AREA.places), "a served place is served");
ok(!placeIsServed("pembroke", SERVICE_AREA.places), "an unserved one is not");
ok(placeIsServed("anywhere", []), "with NO configured area, nothing is out of area — absence is not a statement");

// ═══════════════════════════════════════════════════════════════════════════
section("2. THE ACCEPTANCE TEST — the four who bought outrank the four who did not");
// ═══════════════════════════════════════════════════════════════════════════

const WON_SCORES = Object.fromEntries(
  Object.entries(WON_AT_QUOTE).map(([name, m]) => [name, scoreAtQuote(m)]),
);
const LOST_SCORES = Object.fromEntries(
  Object.entries(LOST_AT_QUOTE).map(([name, m]) => [name, scoreAtQuote(m)]),
);

for (const [name, s] of Object.entries({ ...WON_SCORES, ...LOST_SCORES })) {
  console.log(`       ${name.padEnd(10)} ${String(s.score).padStart(3)}  ${s.temperature.padEnd(5)} ${s.confidence.padEnd(5)} ${s.signals.join(", ") || "(nothing decisive)"}`);
}

const lowestWinner = Math.min(...Object.values(WON_SCORES).map((s) => s.score));
const highestLoser = Math.max(...Object.values(LOST_SCORES).map((s) => s.score));
ok(
  lowestWinner > highestLoser,
  "AT QUOTE TIME: Davidpaul, Lyne, Ayse and Ian all rank ABOVE Sylvaine, Alena, Nicole and Dee",
  { lowestWinner, highestLoser },
);
for (const [w, ws] of Object.entries(WON_SCORES)) {
  for (const [l, ls] of Object.entries(LOST_SCORES)) {
    ok(ws.score > ls.score, `${w} (${ws.score}) outranks ${l} (${ls.score})`);
  }
}
ok(
  Object.values(WON_SCORES).every((s) => s.temperature === "hot"),
  "all four who bought read as hot",
  Object.fromEntries(Object.entries(WON_SCORES).map(([k, v]) => [k, v.temperature])),
);
ok(
  LOST_SCORES.Alena.temperature === "cold" && LOST_SCORES.Dee.temperature === "cold",
  "the two who said they were shopping around and would 'let you know either way' read as cold",
  { alena: LOST_SCORES.Alena.temperature, dee: LOST_SCORES.Dee.temperature },
);

// ── The trap, stated as an assertion ─────────────────────────────────────
ok(
  !LOST_SCORES.Sylvaine.signals.includes("logistics_initiated") &&
    !LOST_SCORES.Sylvaine.signals.includes("scope_growth"),
  "Sylvaine's detail earns her none of the positive signals — product questions are not scope growth",
  LOST_SCORES.Sylvaine.signals,
);
ok(
  LOST_SCORES.Sylvaine.reasons.filter((r) => r.weight > 0).length === 0,
  "...and nothing she did is worth a single point",
  LOST_SCORES.Sylvaine.reasons,
);
ok(
  LOST_SCORES.Sylvaine.signals.includes("budget_stated") &&
    LOST_SCORES.Sylvaine.reasons.find((r) => r.id === "budget_stated").weight === 0,
  "her stated budget is RECORDED and worth exactly zero — the trap, made visible",
);
ok(
  LOST_SCORES.Sylvaine.signals.includes("product_questions") &&
    LOST_SCORES.Sylvaine.reasons.find((r) => r.id === "product_questions").weight === 0,
  "and so are her material questions",
);
{
  // Length and count, isolated: the same nothing said at four times the volume.
  const short = scoreConversation({ messages: [inb(0, "Hi"), out(0, "Hello"), inb(1, "Ok"), inb(2, "Sure"), inb(3, "Right")], ...CTX });
  const long = scoreConversation({
    messages: [
      inb(0, "Hi ".repeat(300)),
      out(0, "Hello"),
      inb(1, "Ok ".repeat(300)),
      inb(2, "Sure ".repeat(300)),
      inb(3, "Right ".repeat(300)),
    ],
    ...CTX,
  });
  ok(short.score === long.score, "four long messages score exactly what four short ones do", { short: short.score, long: long.score });
}
{
  const one = scoreConversation({ messages: [inb(0, "How do I pay?"), out(0, "x"), inb(1, "y"), inb(2, "z"), inb(3, "w")], ...CTX });
  const many = scoreConversation({
    messages: [inb(0, "How do I pay?"), out(0, "x"), inb(1, "How do I pay?"), inb(2, "How do I pay?"), inb(3, "How do I pay?"), inb(4, "How do I pay?"), inb(5, "How do I pay?")],
    ...CTX,
  });
  ok(
    many.score - one.score <= 12,
    "asking logistics repeatedly is CAPPED — an uncapped count is a length score wearing a disguise",
    { one: one.score, many: many.score },
  );
}

// ── Every verdict says why ───────────────────────────────────────────────
for (const [name, s] of Object.entries({ ...WON_SCORES, ...LOST_SCORES })) {
  ok(Array.isArray(s.reasons), `${name}: reasons is always a list`);
  if (s.score !== BASE_SCORE) {
    ok(s.reasons.length > 0, `${name}: a score that moved off the base carries at least one reason`, s.score);
  }
  for (const r of s.reasons) {
    ok(typeof r.labelKey === "string" && r.labelKey.startsWith("app.messages.signal."), `${name}: every reason names a translatable label`, r);
    if (r.id !== "silence_after_quote" && r.id !== "ai_read") {
      ok(Boolean(r.quote), `${name}: the ${r.id} reason carries the fragment it matched`, r);
    }
  }
}
ok(
  LOST_SCORES.Nicole.score === BASE_SCORE && LOST_SCORES.Nicole.reasons.length === 0,
  "a conversation in which nothing decisive was said sits at the base with NO reasons — the screen says so rather than inventing one",
  LOST_SCORES.Nicole,
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Dunia — cold from one message, because of a refusal, not a length");
// ═══════════════════════════════════════════════════════════════════════════

const DUNIA_SCORE = scoreConversation({ messages: DUNIA, ...CTX });
ok(DUNIA_SCORE.temperature === "cold", "Dunia is cold after her FIRST message", DUNIA_SCORE);
ok(DUNIA_SCORE.confidence === "clear", "...and confidently so: a stated refusal is not a small sample, it is an answer");
ok(DUNIA_SCORE.disqualified?.reason === "explicit_rejection", "the reason named is the refusal itself", DUNIA_SCORE.disqualified);
ok(/did not message/i.test(DUNIA_SCORE.disqualified.quote), "and it quotes her", DUNIA_SCORE.disqualified.quote);
{
  // The distinction that matters: SHORT is not COLD.
  const shortAndKeen = scoreConversation({
    messages: [inb(0, "Hi, when can you start? How do I pay the deposit?"), out(0, "Next week."), inb(1, "Do it.")],
    ...CTX,
  });
  ok(shortAndKeen.confidence === "thin", "a three-message thread is THIN", shortAndKeen);
  ok(shortAndKeen.temperature !== "hot", "...and is NOT called hot, however keen it reads", shortAndKeen.temperature);
  ok(shortAndKeen.messageCount < MIN_MESSAGES_FOR_CONFIDENCE, "because it is under the floor", { have: shortAndKeen.messageCount, need: MIN_MESSAGES_FOR_CONFIDENCE });
  ok(shortAndKeen.reasons.length > 0, "it still SAYS what it saw rather than refusing to answer", shortAndKeen.reasons.map((r) => r.id));
}
ok(
  Object.values(WON_SCORES).every((s) => s.confidence === "clear"),
  "the four long winning threads are not thin",
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Structurally unwinnable — known BEFORE a quote is written");
// ═══════════════════════════════════════════════════════════════════════════

const UNWINNABLE_SCORES = Object.fromEntries(
  Object.entries(UNWINNABLE).map(([n, m]) => [n, scoreConversation({ messages: m, now: at(1), ...CTX })]),
);
for (const [name, s] of Object.entries(UNWINNABLE_SCORES)) {
  ok(Boolean(s.disqualified), `${name} is flagged structurally unwinnable`, s.signals);
  ok(s.temperature === "cold", `${name} reads cold`, s.temperature);
  ok(Boolean(s.disqualified.quote), `${name}'s refusal quotes what they actually typed`, s.disqualified.quote);
  ok(s.messageCount <= 3, `${name} is decided within the first three messages — before a quote is written`, s.messageCount);
}
ok(UNWINNABLE_SCORES.Khan.disqualified.reason === "out_of_area", "Khan is out of area (Cornwall)", UNWINNABLE_SCORES.Khan.disqualified);
ok(UNWINNABLE_SCORES.Tracey.disqualified.reason === "out_of_area", "Tracey is out of area (Pembroke)", UNWINNABLE_SCORES.Tracey.disqualified);
ok(UNWINNABLE_SCORES["Guirlène"].disqualified.reason === "budget_below_floor", "Guirlène's $3,500 is below what the job can be done for", UNWINNABLE_SCORES["Guirlène"].disqualified);
ok(UNWINNABLE_SCORES.Phil.disqualified.reason === "price_tier_rejection", "Phil wants a cheaper grade of work than the shop sells", UNWINNABLE_SCORES.Phil.disqualified);

// ── The two facts that must come from the company, never from a default ──
{
  const noArea = scoreConversation({ messages: KHAN, minimumJobPrice: FLOOR, serviceArea: null });
  ok(!noArea.disqualified, "a company that has never said where it works can disqualify NOBODY for being outside it", noArea);
  const noFloor = scoreConversation({ messages: GUIRLENE, serviceArea: SERVICE_AREA, minimumJobPrice: null });
  ok(!noFloor.disqualified, "a company with no job minimum set can disqualify NOBODY on budget");
  ok(
    noFloor.signals.includes("budget_stated"),
    "...and the stated budget is still recorded, so the contractor sees the number even when the software cannot judge it",
    noFloor.signals,
  );
  const zeroFloor = scoreConversation({ messages: GUIRLENE, serviceArea: SERVICE_AREA, minimumJobPrice: 0 });
  ok(!zeroFloor.disqualified, "a floor of zero is not a floor — it is 'nobody has said', and it judges nothing");
}
{
  // A bigger budget must be worth exactly as much as a smaller one: nothing.
  const small = scoreConversation({ messages: [inb(0, "My budget is $9,000"), out(0, "ok"), inb(1, "a"), inb(2, "b"), inb(3, "c")], ...CTX });
  const big = scoreConversation({ messages: [inb(0, "My budget is $90,000"), out(0, "ok"), inb(1, "a"), inb(2, "b"), inb(3, "c")], ...CTX });
  ok(small.score === big.score, "a ten-times-bigger stated budget scores identically — the field that fooled the old scorer", { small: small.score, big: big.score });
}

// ── Line-item haggling is NOT tier rejection ─────────────────────────────
ok(
  scoreAtQuote(AYSE).signals.includes("line_item_negotiation"),
  "Ayse arguing about the hinge charge is a POSITIVE",
  scoreAtQuote(AYSE).signals,
);
ok(!scoreAtQuote(AYSE).disqualified, "...and never disqualifies her — she paid $11,800");
{
  const expected = scoreConversation({
    messages: [inb(0, "That is a bit more than I expected, honestly."), out(0, "ok"), inb(1, "a"), inb(2, "b"), inb(3, "c")],
    ...CTX,
  });
  ok(!expected.disqualified, "'more than I expected' is what winners say too, and it disqualifies nobody", expected.signals);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Silence after a quote, with a follow-up nobody answered");
// ═══════════════════════════════════════════════════════════════════════════

{
  const atQuote = scoreAtQuote(MARIO_AT_QUOTE);
  ok(!atQuote.signals.includes("silence_after_quote"), "a quote sent this minute is not silence", atQuote.signals);

  const later = scoreConversation({
    messages: MARIO_AT_QUOTE,
    now: at(2 + SILENCE_DAYS + 1),
    ...CTX,
  });
  ok(later.signals.includes("silence_after_quote"), `after ${SILENCE_DAYS} days with an unanswered follow-up, it fires`, later.signals);
  ok(later.score < atQuote.score, "...and it costs him", { atQuote: atQuote.score, later: later.score });

  const oneChase = scoreConversation({
    messages: MARIO_AT_QUOTE.slice(0, 4),
    now: at(2 + SILENCE_DAYS + 1),
    ...CTX,
  });
  ok(
    !oneChase.signals.includes("silence_after_quote"),
    "a quote with NO follow-up behind it is not the same fact — the corpus says 'with an unanswered follow-up'",
    oneChase.signals,
  );
  const noQuote = scoreConversation({
    messages: [inb(0, "hi"), out(0, "hello"), inb(1, "ok"), out(2, "still there?"), out(3, "let me know")],
    now: at(20),
    ...CTX,
  });
  ok(!noQuote.signals.includes("silence_after_quote"), "and silence with no quote behind it is just a quiet chat");
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The shape of a verdict, and the vocabulary it shares with a lead");
// ═══════════════════════════════════════════════════════════════════════════

ok(TEMPERATURES.join() === "hot,warm,cold", "the three bands are the lead scorer's three bands", TEMPERATURES);
{
  const lead = read("lib/leads/score.js");
  ok(/score >= 60 \? "hot" : score >= 30 \? "warm" : "cold"/.test(lead), "lib/leads/score.js really does cut at 60 and 30 — the copy this file matches");
  ok(bandFor(60) === "hot" && bandFor(59) === "warm" && bandFor(30) === "warm" && bandFor(29) === "cold", "and so does this one");
  ok(/temperature/.test(lead) && /reasons/.test(lead), "and the field names are the same two words, so one lead carries one vocabulary");
}
ok(SIGNAL_IDS.length === new Set(SIGNAL_IDS).size, "the signal list has no duplicates");
for (const id of DISQUALIFYING_SIGNALS) {
  ok(SIGNAL_IDS.includes(id), `${id} is in the signal list it disqualifies from`);
}
for (const id of Object.keys(WEIGHTS)) {
  ok(SIGNAL_IDS.includes(id), `weighted signal ${id} exists`);
  ok(!DISQUALIFYING_SIGNALS.includes(id), `${id} is weighted OR structural, never both`);
}
ok(WEIGHTS.budget_stated === 0 && WEIGHTS.product_questions === 0, "the two trap signals are weighted zero in the table itself, not just in a comment");
ok(
  WEIGHTS.logistics_initiated > WEIGHTS.scope_growth &&
    WEIGHTS.scope_growth > WEIGHTS.schedule_accommodation &&
    WEIGHTS.schedule_accommodation > WEIGHTS.line_item_negotiation,
  "the positive weights are ordered as the corpus ranks them",
  WEIGHTS,
);
ok(Math.abs(WEIGHTS.comparison_shopping) > Math.abs(WEIGHTS.polite_pre_decline), "comparison shopping is the heaviest cold signal, as the corpus says");

// ── Storage round trip ───────────────────────────────────────────────────
{
  const s = scoreAtQuote(DAVIDPAUL);
  const stored = storableScore(s, { at: new Date("2026-03-01") });
  ok(stored.temperature === s.temperature && stored.score === s.score, "the columns carry the verdict", stored);
  const back = readStoredScore({ ...stored });
  ok(back.temperature === s.temperature && back.reasons.length === s.reasons.length, "and it reads back whole", back);
  ok(readStoredScore({}) === null, "a row that was never scored reads as NULL, never as cold");
  ok(readStoredScore({ temperature: "lukewarm" }) === null, "and a value this version does not know reads as null too");
  ok(readStoredScore({ temperature: "hot", score: 70, scoreReasons: null }).confidence === "thin", "a row with no stored confidence is treated as thin, which is the safe direction");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The paid layer — it may nudge, it may never overturn");
// ═══════════════════════════════════════════════════════════════════════════

{
  const rule = scoreAtQuote(NICOLE);
  const up = applyAiRead(rule, { direction: "up", note: "They wrote like someone who has decided.", basedOnMessages: rule.messageCount });
  ok(up.score === rule.score + AI_ADJUSTMENT, "an 'up' reading moves the score by exactly the cap", { before: rule.score, after: up.score });
  const down = applyAiRead(rule, { direction: "down", note: "Every sentence is hedged.", basedOnMessages: rule.messageCount });
  ok(down.score === rule.score - AI_ADJUSTMENT, "and a 'down' reading moves it the other way");
  const none = applyAiRead(rule, { direction: "none", note: "Nothing here settles it.", basedOnMessages: rule.messageCount });
  ok(none.score === rule.score, "'none' moves nothing");
  ok(
    none.reasons.some((r) => r.id === "ai_read" && r.weight === 0),
    "...and its sentence is still carried, because 'the model found nothing' is worth seeing on a paid feature",
  );
  const silly = applyAiRead(rule, { direction: "sideways", note: "x", basedOnMessages: 1 });
  ok(silly.score === rule.score, "a direction the schema does not know moves nothing", silly.ai);
  ok(applyAiRead(rule, null).score === rule.score, "no reading at all leaves the rule score exactly as it was");
  ok(applyAiRead(rule, { direction: "up", note: "" }).score === rule.score, "and neither does a reading with no sentence in it");
  ok(
    Math.abs(AI_ADJUSTMENT) < 30,
    "the cap is smaller than a band, so a reading can nudge across a line but never jump one",
    AI_ADJUSTMENT,
  );
}
{
  // THE ONE IT MUST NOT DO.
  for (const [name, s] of Object.entries(UNWINNABLE_SCORES)) {
    const pushed = applyAiRead(s, {
      direction: "up",
      note: "They sound lovely and very keen indeed.",
      basedOnMessages: s.messageCount,
    });
    ok(pushed.temperature === "cold", `${name}: a warm AI reading cannot overturn a structural disqualifier`, pushed);
    ok(pushed.score === s.score, `${name}: ...and cannot move the score either`, { before: s.score, after: pushed.score });
    ok(pushed.ai.blocked === "disqualified", `${name}: the refusal is recorded rather than silent`, pushed.ai);
    ok(pushed.ai.note.length > 0, `${name}: and the reading is kept on the record so the contractor can disagree with the RULE`);
  }
}
{
  const thin = scoreConversation({ messages: [inb(0, "When can you start? How do I pay?"), out(0, "soon"), inb(1, "Do it.")], ...CTX });
  const pushed = applyAiRead(thin, { direction: "up", note: "Committed language.", basedOnMessages: 3 });
  ok(pushed.temperature !== "hot", "a paid reading cannot make a THIN thread hot either", pushed);
}
{
  const rule = scoreAtQuote(DAVIDPAUL);
  const readAt5 = { direction: "up", note: "n", basedOnMessages: 5 };
  ok(applyAiRead(rule, readAt5).ai.messagesSince === rule.messageCount - 5, "the screen can say how many messages arrived after the reading", applyAiRead(rule, readAt5).ai);
  ok(aiReadIsStale(readAt5, 9), "a thread that has grown since the reading is stale");
  ok(!aiReadIsStale(readAt5, 5), "one that has not is NOT — which is why a chatty thread is not charged twice");
  ok(aiReadIsStale(null, 9), "never read at all counts as stale");
}

// ── The model call: quota first, meter after, no numbers out ─────────────
{
  const calls = [];
  const conversation = { id: "t1", companyId: "co_1", participantName: "Sam Doe", messages: DAVIDPAUL };
  const result = await readConversationTemperature({
    companyId: "co_1",
    conversation,
    examples: buildExamples({
      conversations: [
        { id: "w1", companyId: "co_1", outcome: "won", participantName: "A B", messages: LYNE },
        { id: "l1", companyId: "co_1", outcome: "lost", participantName: "C D", messages: DEE },
      ],
      companyId: "co_1",
      excludeId: "t1",
    }),
    ruleScore: scoreAtQuote(DAVIDPAUL),
    checkAiQuota: async () => { calls.push("checkAiQuota"); return { allowed: true, remaining: 500000, cap: 750000 }; },
    complete: async (args) => {
      calls.push("complete");
      calls.push({ prompt: args.prompt, system: args.system });
      if (args.onUsage) await args.onUsage({ model: "stub-model", promptTokens: 700, completionTokens: 120 });
      return {
        ok: true,
        data: {
          commitment: "committed",
          disclosure: true,
          direction: "up",
          note: "He wrote “Do it” before any price existed, and he is 87% likely to buy at $3,060.",
        },
      };
    },
    recordAiUsage: async (u) => { calls.push("recordAiUsage"); calls.push({ feature: u.feature }); },
  });

  const names = calls.filter((c) => typeof c === "string");
  ok(names[0] === "checkAiQuota", "checkAiQuota runs BEFORE the model call", names);
  ok(names.indexOf("complete") > names.indexOf("checkAiQuota"), "...and complete() after it, never beside it");
  ok(names.includes("recordAiUsage"), "recordAiUsage runs on the way back out");
  ok(
    calls.find((c) => c && c.feature) ?.feature === CONVERSATION_TEMPERATURE_FEATURE,
    "usage is metered under its own feature name, so its cost is separable in the platform view",
    CONVERSATION_TEMPERATURE_FEATURE,
  );

  ok(result.status === "ready" && result.read.direction === "up", "a reading comes back", result.status);
  ok(!/87%/.test(result.read.note) && !/3,060/.test(result.read.note), "every figure the model invented is removed — this reading is entitled to NO numbers", result.read.note);
  ok(result.read.scrubbedFigures >= 2, "...and the removals are counted rather than swallowed", result.read.scrubbedFigures);
  ok(/Do it/.test(result.read.note), "the words it quoted from the conversation survive", result.read.note);

  const sent = calls.find((c) => typeof c === "object" && c.prompt);
  ok(/BEGIN CALL RECORDING/.test(sent.prompt), "the transcripts reach the prompt inside a data fence, like every other transcript in this codebase");
  ok(!/Sam Doe/.test(sent.prompt) && !/Doe/.test(sent.prompt), "no participant surname reaches the prompt", sent.prompt.slice(0, 160));
  ok(/DO NOT reward effort/i.test(sent.system), "the prompt itself forbids rewarding effort — belt and braces with the weights");
  ok(/COMMITMENT versus CONDITIONAL/i.test(sent.system), "it is told what it is for: commitment versus conditional language");
  ok(/PERSONAL DISCLOSURE/i.test(sent.system), "...and personal disclosure");
  ok(/BECAME PAID WORK/.test(sent.prompt), "the few-shot really is the company's OWN won conversations");
  ok(/Write NO numbers/i.test(sent.system), "and it is told not to write figures");
  ok(!/\b(hot|warm|cold)\b/.test(sent.prompt.replace(/BEGIN[\s\S]*?END/g, "")), "the model is NOT shown the rule verdict — a model handed a number agrees with it", sent.prompt.slice(0, 200));
}
{
  // NO CREDIT: nothing is spent, nothing is stored, and the rule score stands.
  const calls = [];
  const result = await readConversationTemperature({
    companyId: "co_1",
    conversation: { id: "t1", companyId: "co_1", messages: DAVIDPAUL },
    ruleScore: scoreAtQuote(DAVIDPAUL),
    checkAiQuota: async () => ({ allowed: false, reason: "You've used this month's FieldQuo AI allowance.", cap: 1, remaining: 0 }),
    complete: async () => { calls.push("complete"); return { ok: true, data: {} }; },
    recordAiUsage: async () => { calls.push("recordAiUsage"); },
  });
  ok(result.status === "quota" && /allowance/.test(result.refusal), "a company over its allowance is refused by name", result.refusal);
  ok(calls.length === 0, "...and no model call is made", calls);
  const still = applyAiRead(scoreAtQuote(DAVIDPAUL), null);
  ok(still.temperature === "hot" && still.reasons.length > 0, "and the FREE score is still a full verdict with its reasons — never a blank", { t: still.temperature, n: still.reasons.length });
}
{
  const calls = [];
  const result = await readConversationTemperature({
    companyId: "co_1",
    conversation: { id: "t1", companyId: "co_1", messages: DUNIA },
    ruleScore: scoreConversation({ messages: DUNIA, ...CTX }),
    checkAiQuota: async () => { calls.push("checkAiQuota"); return { allowed: true }; },
    complete: async () => { calls.push("complete"); return { ok: true, data: {} }; },
    recordAiUsage: async () => {},
  });
  ok(result.status === "too_short", "a one-message thread is refused as too short to read", result);
  ok(calls.length === 0, "...before the quota is even checked, so it costs nothing at all", calls);
  ok(result.refusalValues.need === MIN_MESSAGES_FOR_AI_READ, "and the refusal quotes the constant rather than a copy of it");
}
{
  const result = await readConversationTemperature({
    companyId: "co_1",
    conversation: { id: "t1", companyId: "co_1", messages: DAVIDPAUL },
    ruleScore: scoreAtQuote(DAVIDPAUL),
    checkAiQuota: async () => ({ allowed: true }),
    complete: async () => ({ ok: false, reason: "vendor_error", message: "429" }),
    recordAiUsage: async () => {},
  });
  ok(result.status === "ai_unavailable" && result.failure === "vendor_error", "a vendor failure is its own status and says what failed", result);
}

// ── The tenant fence ─────────────────────────────────────────────────────
{
  let threw = null;
  try {
    buildExamples({
      conversations: [
        { id: "a", companyId: "co_1", outcome: "won", messages: LYNE },
        { id: "b", companyId: "co_2", outcome: "won", messages: AYSE },
      ],
      companyId: "co_1",
    });
  } catch (err) { threw = err; }
  ok(threw instanceof ConversationReviewTenantError, "another company's conversation THROWS rather than being quietly dropped into the prompt", threw?.message);
}
{
  let threw = null;
  try {
    buildExamples({ conversations: [{ id: "a", outcome: "won", messages: LYNE }], companyId: "co_1" });
  } catch (err) { threw = err; }
  ok(threw instanceof ConversationReviewTenantError, "a row that cannot PROVE which company it belongs to is refused too");
}
ok(
  buildExamples({
    conversations: [
      { id: "t1", companyId: "co_1", outcome: "won", messages: DAVIDPAUL },
      { id: "w1", companyId: "co_1", outcome: "won", messages: LYNE },
    ],
    companyId: "co_1",
    excludeId: "t1",
  }).every((e) => e.id !== "t1"),
  "the thread being read is never shown to the model as an example of its own outcome",
);
{
  const route = code("app/api/messaging/threads/[id]/temperature/route.js");
  ok(/companyId: member\.companyId/.test(route), "the route's own query is company-scoped — the fence above is the SECOND check, not the only one");
  ok(/findFirst/.test(route) && !/messageThread\.findUnique/.test(route), "the thread is found by findFirst with the company, never by id alone");
  ok(/ConversationReviewTenantError/.test(route), "and the fence's throw is handled explicitly rather than becoming an anonymous 500");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Wired in: written continuously, read on three screens, never a filter");
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA = read("prisma/schema.prisma");
for (const col of ["temperature String?", "score       Int?", "scoreReasons Json?", "scoredAt     DateTime?"]) {
  ok(SCHEMA.includes(col), `MessageThread.${col.split(" ")[0]} exists and is nullable — never scored is not cold`);
}
ok(!/temperature String\?\s*@default/.test(SCHEMA), "no default on temperature: a default is a back-fill, one row at a time");

// ── Written ──────────────────────────────────────────────────────────────
ok(/rescoreThread/.test(code("lib/messaging/ingest.js")), "every new message rescores the thread — free, so it can run always");
ok(/rescoreThread/.test(code("app/api/messaging/threads/[id]/reply/route.js")), "so does every reply we send — that is what creates the silence shape");
ok(/rescoreThread/.test(code("app/api/cron/messaging-snooze/route.js")), "and the cron rescores the quiet ones, which is the only way silence can ever be noticed");
ok(/SILENCE_DAYS/.test(code("app/api/cron/messaging-snooze/route.js")), "...using the same constant the signal does, not a second copy of the number");
{
  const rescore = code("lib/messaging/rescoreThread.js");
  ok(/scoreConversation/.test(rescore), "the writer calls the ONE pure scorer");
  ok(/applyAiRead\(rule, previousAi\)/.test(rescore), "and re-applies the stored paid reading, so a free rescore cannot erase something a company bought");
  ok(/minCharge/.test(rescore), "the budget floor comes from the company's OWN saved estimator minimum");
  ok(/floors\.length \? Math\.max\(\.\.\.floors\) : null/.test(rescore), "...and is null when they have never set one — absent, not zero");
  ok(/interview/.test(rescore) && /serviceAreaPlaces/.test(rescore), "the service area comes from the company's own sentence about where it works");
}

// ── Read ─────────────────────────────────────────────────────────────────
ok(/temperature: true/.test(code("app/api/messaging/threads/route.js")), "the inbox list selects it");
ok(/temperature: true/.test(code("app/api/messaging/review/route.js")), "the month-end report selects it");
ok(/TemperatureChip/.test(read("app/app/messages/page.js")), "the inbox row draws it");
ok(/ConversationTemperature/.test(read("app/app/messages/page.js")), "the conversation draws the whole panel, with its reasons");
ok(/TemperatureChip/.test(read("app/app/messages/review/page.js")), "the month-end screen draws it");
ok(/review\.ranked/.test(read("app/app/messages/review/page.js")), "...and ranks by it");
ok(
  /reportResponseError/.test(read("app/components/messaging/ConversationTemperature.js")),
  "a failed POST reports the API's own sentence, never a silent no-op",
);
ok(
  /r\.quote/.test(read("app/components/messaging/ConversationTemperature.js")) ||
    /reason\.quote/.test(read("app/components/messaging/ConversationTemperature.js")),
  "the panel prints the QUOTED FRAGMENT — a score nobody can check is a score nobody can argue with",
);
ok(
  /app\.messages\.temperature\.notCounted/.test(read("app/components/messaging/ConversationTemperature.js")),
  "and it says out loud which observations were noticed and deliberately not counted",
);
{
  // The one moment the corpus's acceptance test is written about. The button
  // is not automatic — nothing here spends an allowance without a click — but
  // it is NAMED at the moment it is worth pressing, which is the difference
  // between a control and a control somebody notices.
  const route = code("app/api/messaging/threads/[id]/temperature/route.js");
  ok(/recommended: Boolean\(thread\.quoteId\)/.test(route), "the route flags the read as recommended once a quote has gone out");
  ok(/stale/.test(route.slice(route.indexOf("recommended:"), route.indexOf("recommended:") + 120)), "...and only while nothing has been read since");
  ok(
    /state\?\.recommended/.test(read("app/components/messaging/ConversationTemperature.js")) &&
      /app\.messages\.temperature\.recommended/.test(read("app/components/messaging/ConversationTemperature.js")),
    "and the panel actually draws that sentence — a flag nothing reads is the column this repo keeps deleting",
  );
}

// ── NEVER a filter ───────────────────────────────────────────────────────
{
  const list = code("app/api/messaging/threads/route.js");
  const where = list.slice(list.indexOf("where: {"), list.indexOf("orderBy: { lastMessageAt"));
  ok(!/temperature/.test(where), "the inbox query NEVER filters on temperature — a low score must not hide a conversation", where.slice(0, 200));
  ok(!/temperature/.test(list.slice(list.indexOf("searchParams"), list.indexOf("const connection"))), "and no query parameter can ask it to");
}
{
  const rows = [
    { id: "a", createdAt: at(1), outcome: null, temperature: "cold", score: 4, scoreReasons: { confidence: "clear", reasons: [] }, messages: [] },
    { id: "b", createdAt: at(2), outcome: null, temperature: "hot", score: 90, scoreReasons: { confidence: "clear", reasons: [] }, messages: [] },
    { id: "c", createdAt: at(3), outcome: null, messages: [] },
  ];
  const review = buildMonthlyReview({ threads: rows, year: 2026, month: 2 });
  ok(review.ranked.length === 3, "every conversation in the month is in the ranked list, including the cold one and the unscored one", review.ranked.map((r) => r.id));
  ok(review.ranked[0].id === "b" && review.ranked[1].id === "a", "hot first, cold second — ranked, not filtered", review.ranked.map((r) => r.id));
  ok(review.ranked[2].id === "c", "and 'we do not know' sorts last rather than being dropped or guessed at");
  ok(review.ranked[2].score === null, "an unscored thread carries null, which the screen prints as 'not scored yet'");
  ok(review.threads.length === review.ranked.length, "the ranked list and the full list hold exactly the same conversations");
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Every new key, in all nine languages, with no currency symbol");
// ═══════════════════════════════════════════════════════════════════════════

const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
const NEW_KEYS = [
  ...[
    "hot", "warm", "cold", "thinShort", "thin", "notCounted", "quoted", "fromMessages",
    "disqualifiedHint", "nothingYet", "notedTitle", "notScored", "loadError", "runError",
    "retry", "aiTitle", "aiSubtitle", "aiBlocked", "aiMoved", "aiNoChange", "aiSince",
    "price", "priceNoRemaining", "examples", "read", "readAgain", "demoUnavailable",
    "aiUnavailable", "tooShort", "unchanged", "recommended",
  ].map((k) => `app.messages.temperature.${k}`),
  ...SIGNAL_IDS.map(signalLabelKey),
  "app.messages.signal.ai_read",
  "app.messages.review.rankedTitle",
  "app.messages.review.rankedHint",
];
ok(LANGS.length === 9, "nine languages, as the catalogue has");
{
  const missing = [];
  for (const lang of LANGS) {
    for (const key of NEW_KEYS) {
      if (typeof APP_MESSAGES[lang]?.[key] !== "string" || !APP_MESSAGES[lang][key].trim()) missing.push(`${lang}:${key}`);
    }
  }
  ok(missing.length === 0, `all ${NEW_KEYS.length} new keys exist in all nine languages`, missing.slice(0, 12));
}
{
  const withDollar = [];
  for (const lang of LANGS) {
    for (const key of NEW_KEYS) if (/[$€£]/.test(APP_MESSAGES[lang]?.[key] || "")) withDollar.push(`${lang}:${key}`);
  }
  ok(withDollar.length === 0, "no new string types a currency symbol", withDollar);
}
{
  const broken = [];
  for (const key of NEW_KEYS) {
    const want = [...(APP_MESSAGES.en[key] || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const lang of LANGS) {
      const got = [...(APP_MESSAGES[lang]?.[key] || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
      if (got !== want) broken.push(`${lang}:${key} (${got || "none"} vs ${want || "none"})`);
    }
  }
  ok(broken.length === 0, "every translation carries the same placeholders as the English", broken.slice(0, 8));
}
{
  // Every label a reason can print really exists — a reason with a dead key is
  // a blank line where the argument should be.
  const dead = [];
  for (const [name, s] of Object.entries({ ...WON_SCORES, ...LOST_SCORES, ...UNWINNABLE_SCORES, Dunia: DUNIA_SCORE })) {
    for (const r of s.reasons) if (!APP_MESSAGES.en[r.labelKey]) dead.push(`${name}:${r.labelKey}`);
    if (s.disqualified && !APP_MESSAGES.en[s.disqualified.labelKey]) dead.push(`${name}:${s.disqualified.labelKey}`);
  }
  ok(dead.length === 0, "every reason the twenty fixtures produce has a label to print", dead);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Mutation pass — proving the ranking and the disqualifier are real");
// ═══════════════════════════════════════════════════════════════════════════
//
// A check that passes against a broken scorer certifies the bug. So two
// deliberate breaks are written to disk, this file is re-run against them, and
// each has to FAIL.
//
// The first is the ACTUAL HISTORICAL BUG: a scorer that rewards effort. That is
// what the Meta AI in this contractor's inbox did when it announced his most
// detailed customer was ready to buy, and it is the one mutation that matters
// most, because it is the version of this file somebody would write by accident.
//
// The file is restored from an in-memory copy taken before the write, never
// with git — a `git checkout` here would discard whatever else is uncommitted
// in the working tree.
if (!process.argv.includes("--no-mutate")) {
  const SELF = fileURLToPath(import.meta.url);
  const LOADER = path.join(ROOT, "scripts/alias-loader.mjs");

  const MUTATIONS = [
    [
      "lib/messaging/conversationScore.js",
      "THE HISTORICAL BUG: the scorer rewards effort (points per message)",
      (s) =>
        s.replace(
          "  const score = clamp(total);",
          "  const score = clamp(total + extracted.inboundCount * 12);",
        ),
    ],
    [
      "lib/messaging/conversationScore.js",
      "a structural disqualifier is no longer recognised as one",
      // The DETECTION, not the `temperature = "cold"` line beside it. That line
      // is belt and braces over DISQUALIFIER_PENALTY — with the penalty at -100
      // nothing can score its way back into warm, so removing the line alone
      // changes no output, and a mutation that changes no output would sit here
      // passing forever while proving nothing.
      (s) =>
        s.replace(
          "  const disqualifyingSignal = extracted.signals.find((s) => DISQUALIFYING_SIGNALS.includes(s.id));",
          "  const disqualifyingSignal = null;",
        ),
    ],
    [
      "lib/messaging/conversationScore.js",
      "the paid layer is allowed to overturn a disqualifier",
      (s) => s.replace("  if (rule.disqualified) {", "  if (false) {"),
    ],
    [
      "lib/messaging/conversationScore.js",
      "a thin thread may be called hot",
      (s) => s.replace('  if (thin && temperature === "hot") temperature = "warm";', ""),
    ],
    [
      "lib/messaging/conversationSignals.js",
      "comparison shopping is no longer detected",
      (s) => s.replace("    const shopping = firstPhrase(flat, COMPARISON_SHOPPING);", "    const shopping = null;"),
    ],
    [
      "lib/messaging/conversationSignals.js",
      "a stated budget below the floor no longer disqualifies",
      (s) =>
        s.replace(
          "        if (Number.isFinite(minimumJobPrice) && minimumJobPrice > 0 && stated < minimumJobPrice) {",
          "        if (false) {",
        ),
    ],
    [
      "lib/messaging/conversationSignals.js",
      "an unconfigured service area starts disqualifying people anyway",
      // BOTH guards, because there are deliberately two: the caller-side
      // `served.length` and placeIsServed's own empty check. Breaking one and
      // finding the check still passes would be evidence of the doubling, not
      // of a hole — so the mutation removes both and the check must fail.
      (s) =>
        s
          .replace("    if (served.length) {", "    if (true) {")
          .replace(
            "  if (!Array.isArray(served) || !served.length) return true;",
            "",
          ),
    ],
  ];

  for (const [rel, label, mutate] of MUTATIONS) {
    const file = path.join(ROOT, rel);
    const ORIGINAL = fs.readFileSync(file, "utf8");
    const mutated = mutate(ORIGINAL);
    if (mutated === ORIGINAL) {
      ok(false, `mutation applies: ${label}`, "the source moved under it — rewrite the mutation, do not delete it");
      continue;
    }
    fs.writeFileSync(file, mutated);
    let caught = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      caught = true;
    } finally {
      fs.writeFileSync(file, ORIGINAL);
    }
    ok(caught, `mutation caught: ${label}`);
  }
}

console.log(`\ncheck-conversation-score: ${checks - failures}/${checks} passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
