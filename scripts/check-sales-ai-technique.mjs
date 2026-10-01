// scripts/check-sales-ai-technique.mjs
//
//   npm run check:sales-ai-technique
//
// The owner's selling technique (the "FieldQuo Closer Call Script — Reverse
// Selling" doc, 2026-10-01) reaches every AI sales surface it was meant for,
// and brings nothing with it that those surfaces already forbid.
//
// Executed, not read: each surface's prompt is ASSEMBLED here the way
// production assembles it — buildSalesPrompt for the phone agent, the
// exported system prompts for the check-in drafts and the reply triage — and
// the assertions run on that text. No model is called anywhere in this file.
//
// What it proves, per surface:
//
//   1. the technique section is there (A-S-P, no "why", "fair enough?", the
//      five-step answer, the reverse close, the referral question, a concrete
//      next step) and sits AFTER the surface's own rules;
//   2. no prompt names, numbers or invents a customer;
//   3. the trial, card and referral wording comes from lib/pricing.js and
//      lib/referrals/index.js — rendered with different values, the text
//      moves with them — and no plan price is typed into the technique;
//   4. none of it makes a move lib/sales/playbook/bannedMoves.js forbids.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-sales-ai-technique.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

// No vendor key: this file must never be able to reach a model, and the
// check-in path must take its deterministic branch.
delete process.env.OPENAI_API_KEY;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const flat = (s) => String(s).replace(/\s+/g, " ");

let fail = 0;
let checks = 0;
const ok = (cond, msg, detail) => {
  checks++;
  console.log((cond ? "✓ " : "✗ ") + msg);
  if (!cond) {
    fail++;
    if (detail !== undefined) console.log("    " + String(detail).replace(/\n/g, "\n    ").slice(0, 600));
  }
};

const technique = await import("@/lib/sales/technique");
const pricing = await import("@/lib/pricing");
const referrals = await import("@/lib/referrals");
const { SEAT_LADDER } = await import("@/lib/pricing/ladder");
const { bannedMovesIn } = await import("@/lib/sales/playbook/bannedMoves");
const kbMod = await import("@/lib/platform/salesKnowledge");
const promptMod = await import("@/lib/platform/salesPrompt");
const draftMod = await import("@/lib/sales/checkin/draft");
const signals = await import("@/lib/sales/checkin/signals");
const triageMod = await import("@/lib/sales/replyTriage");
const triageKinds = await import("@/lib/sales/messages/triage");

const {
  TECHNIQUE_HEADING,
  MOVES,
  FIVE_STEP_ANSWER,
  REFERRAL_ASK,
  WRITTEN_TECHNIQUE,
  WEEKEND_LINE,
  DAY_AND_TIME_ASK,
  phoneTechnique,
  trialTerms,
  referralTerms,
  isFridayIn,
} = technique;

/** The section of a prompt from the technique heading to the next fenced part. */
function techniqueSection(prompt) {
  const start = prompt.indexOf(TECHNIQUE_HEADING);
  if (start < 0) return "";
  const end = prompt.indexOf("NOTES FROM FIELDQUO", start);
  return end < 0 ? prompt.slice(start) : prompt.slice(start, end);
}

// ── What "naming a customer" looks like ──────────────────────────────────────
//
// The doc's own stories are a person's real calls: "I spoke with a painter,
// [first name]", "I talked to a [trade] owner who…". An AI has had no calls,
// so every one of these shapes is an invented customer when it says it. The
// phone prompt QUOTES two of them inside the instruction forbidding them, so
// that one sentence is removed before scanning — and asserted present on its
// own, so removing it cannot be how this passes.
const CUSTOMER_PATTERNS = [
  /\bI (?:spoke|talked|was talking) (?:with|to)\b/i,
  /\bowners I (?:talk|spoke|speak) to\b/i,
  /\[first name\]/i,
  /\b(?:painter|plumber|roofer|owner|contractor|landscaper|electrician|guy|customer)s?,\s+[A-Z][a-z]+,/,
  /\b(?:called|named)\s+[A-Z][a-z]+\b/,
  /\b(?:one|a) (?:of our )?customers?,? [A-Z][a-z]+\b/,
];
const STORY_RULE = /Stories: you have not met any customers[\s\S]*?Never invent a customer\./;
const namesACustomer = (text) => {
  const scrubbed = String(text).replace(STORY_RULE, " ");
  return CUSTOMER_PATTERNS.filter((re) => re.test(scrubbed)).map(String);
};

// The same money and date shapes check-sales-agent.mjs refuses in the rules.
const MONEY = /[$€£]\s*\d|\d+\s*(?:seats?|users?|people|licen[cs]es?|quotes?)\b|\b\d+\s*(?:\/|per\s+)\s*month/i;
const DATES = /\b20\d{2}\b|\bQ[1-4]\b|\b(?:january|february|march|april|june|july|august|september|october|november|december)\b|\bcoming soon\b|\bnext (?:month|quarter|year)\b/i;

/* ═══════════════════════════════════════════════════════════════════════════
   1. The phone agent
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The phone agent converses with the technique ────────────────\n");

// Nonsense plan names and prices, for the same reason check-sales-agent uses
// them: anything plausible collides with a word that belongs in both renders.
const plan = (over = {}) => ({
  name: "Zorbex",
  priceMonthly: 47,
  maxUsers: 1,
  maxQuotesPerMonth: null,
  aiCopilotEnabled: true,
  aiMonthlyTokenCap: 1000,
  features: null,
  stripePriceId: "price_x",
  isPublic: true,
  ...over,
});
const kb = kbMod.deriveSalesKnowledge({
  plans: [plan(), plan({ name: "Quibbet", priceMonthly: 412, maxUsers: 7 })],
  featureMap: {},
});

const combos = [];
for (const canTransfer of [true, false]) {
  for (const callsRecorded of [true, false]) {
    combos.push({
      canTransfer,
      callsRecorded,
      prompt: promptMod.buildSalesPrompt({
        knowledge: kb,
        canTransfer,
        callsRecorded,
        notes: "Keep it friendly.",
      }),
    });
  }
}
const full = combos[0].prompt; // transfer + recorded: the richest render
const section = techniqueSection(full);

ok(combos.every((c) => c.prompt.includes(TECHNIQUE_HEADING)),
   "every variant of the phone prompt carries the technique section");
ok(full.indexOf("ABSOLUTE RULES") < full.indexOf(TECHNIQUE_HEADING) &&
   full.indexOf("WHAT FIELDQUO IS") < full.indexOf(TECHNIQUE_HEADING),
   "it comes AFTER the absolute rules and the derived facts");
ok(full.indexOf(TECHNIQUE_HEADING) < full.indexOf("NOTES FROM FIELDQUO"),
   "…and BEFORE the hand-written notes, which stay last");
ok(/never overrides the absolute rules above/i.test(flat(section)),
   "it says outright that it cannot override the rules");

const REQUIRED_MOVES = [
  "reflex_no", "asp", "foreshadow", "hypothetical", "no_why", "no_pounce",
  "fair_enough", "label_feeling", "listen", "match_style", "give_control",
];
const keys = MOVES.map((m) => m.key);
ok(REQUIRED_MOVES.every((k) => keys.includes(k)), "every move in the doc is in MOVES",
   REQUIRED_MOVES.filter((k) => !keys.includes(k)).join(", "));
ok(MOVES.every((m) => section.includes(m.text)), "…and every one of them reaches the prompt");

const s = flat(section);
ok(/A-S-P/.test(s) && /Agree \("Totally fair\."\)/.test(s) && /Speak from their side/.test(s) && /Pivot straight to a question/.test(s),
   "A-S-P: agree, speak from their side, pivot to a question");
ok(/with no pause/i.test(s), "…with no pause before the question");
ok(/Never ask "why"/.test(s) && /"what" and "how"/.test(s) && /soft words/i.test(s),
   "no \"why\" questions, soft words instead");
ok(/fair enough\?/i.test(s), "\"fair enough?\" agreement checks");
ok(/DISCOVERY BEFORE FEATURES/.test(section) && /Before describing anything, ask one question at a time/.test(s),
   "discovery questions come before features");
ok(/Do not pounce on a pain/.test(s), "it does not pounce on a pain");
ok(/I get the feeling this might not be the right fit/.test(s), "it labels a feeling");
ok(/Listen far more than you talk/.test(s), "it listens more than it talks");
ok(/Match their style/.test(s), "it matches the caller's style");
ok(/then you decide if it's worth keeping/.test(s), "it gives them control");
ok(FIVE_STEP_ANSWER.length === 5 && FIVE_STEP_ANSWER.every((step) => s.includes(step)),
   "the five-step objection answer, all five, in order of the doc");
ok(/reverse close/i.test(s) && /would you feel comfortable running your quotes on this/.test(s),
   "the reverse close: easy questions instead of one big one");
ok(/too-easy yes/i.test(s) && /Will it be hard to switch/.test(s), "…and the too-easy-yes test");
ok(s.toLowerCase().includes(REFERRAL_ASK.toLowerCase().replace(/\?$/, "")),
   "the referral question, in the doc's words", REFERRAL_ASK);
ok(/at the end of every call, signed up or not/i.test(s), "…asked on every call, signed up or not");
ok(/EVERY CALL ENDS WITH A CONCRETE NEXT STEP/.test(section), "every call ends with a concrete next step");
ok(/Never end on "I'll get back to you"/.test(s), "…and never on \"I'll get back to you\"");
ok(/asked not to be contacted/i.test(s) && /end politely and ask nothing more/i.test(s),
   "someone who asks not to be contacted gets no further asks");

// The next step depends on what is true on this deployment.
const [tr, tn, nr, nn] = combos.map((c) => techniqueSection(c.prompt));
ok(tr.includes("transfer_to_human") && !nr.includes("transfer_to_human") && !nn.includes("transfer_to_human"),
   "the next step names transfer_to_human only when a destination exists");
ok(nr.includes("fieldquo.com/contact"), "…and the contact page when it does not");
ok(/Ask what day and time suits them/.test(flat(tr)) && !/Ask what day and time suits them/.test(flat(tn)),
   "a callback day and time is only asked for when the call is actually recorded");
ok(/cannot arrange a callback/.test(flat(tn)), "…and otherwise it is told it cannot arrange one");
ok(/Never\s+promise anyone will ring at that time/i.test(tr),
   "asking for a time never becomes promising a call — the existing rule still wins");

// ── Trial, card and referral terms come from the constants ───────────────────
console.log("\n── The terms come from lib/pricing.js and lib/referrals ────────\n");

const liveTrial = trialTerms();
ok(liveTrial.days === pricing.TRIAL_DAYS && liveTrial.label === pricing.trialLabel(),
   "the trial terms are TRIAL_DAYS and trialLabel()");
ok(liveTrial.cardRequired === pricing.TRIAL_CARD_REQUIRED, "the card rule is TRIAL_CARD_REQUIRED");
ok(s.includes(liveTrial.sentence), "the phone prompt says exactly that sentence");
ok(s.includes(`fieldquo.com/signup`), "and where they start it themselves");

const moved = flat(phoneTechnique({ trial: { days: 37, label: "37 days free" }, cardRequired: true }));
ok(moved.includes("37 days free") && !moved.includes(pricing.trialLabel()),
   "a different trial renders a different trial — nothing about it is typed in");
ok(/A card is asked for/.test(moved) && !/needs no card/.test(moved) && !/no card was ever taken/.test(moved),
   "…and a card-required trial stops saying \"no card\" everywhere in the technique");
const noCard = flat(phoneTechnique({ cardRequired: false }));
ok(/needs no card to start/.test(noCard), "a no-card trial says so");

const liveRef = referralTerms();
ok(liveRef.referee === referrals.REFEREE_BONUS_MONTHS && liveRef.referrer === referrals.REFERRER_BONUS_MONTHS,
   "the referral months are REFEREE_BONUS_MONTHS and REFERRER_BONUS_MONTHS");
ok(s.includes(flat(liveRef.sentence)), "the phone prompt states that programme");
ok(/once the new company starts paying/.test(liveRef.sentence),
   "the referrer's month is said to land on the referred company's first payment, as grantReferrerCredit does");
const movedRef = referralTerms({ referee: 3, referrer: 2 }).sentence;
ok(/3 months extra/.test(movedRef) && /2 months added/.test(movedRef),
   "different referral months render different words");
ok(/not a deal you are offering: rule 3 still stands/i.test(s),
   "the referral programme is framed so rule 3 (no free extension) still holds");

// No figure of its own. The trial label and the "rule 3" reference are the
// only digits allowed through; everything else would be typed in.
const digits = section.replace(liveTrial.label, "").replace(/rule \d+/gi, "").match(/\d+/g) || [];
ok(digits.length === 0, "the technique section carries no number of its own", digits.join(", "));
ok(!MONEY.test(section), "no price, seat count or per-month figure", (section.match(MONEY) || [])[0]);
ok(!DATES.test(section), "no date and no \"coming soon\"", (section.match(DATES) || [])[0]);
const ladderPrices = SEAT_LADDER.map((r) => String(r.price));
ok(!ladderPrices.some((p) => section.includes(p)), "no seat-ladder price is typed into the technique",
   ladderPrices.filter((p) => section.includes(p)).join(", "));
ok(full.includes("Zorbex") && full.includes("47"), "the plan prices still reach the phone from the Plan rows");

/* ═══════════════════════════════════════════════════════════════════════════
   2. The check-in drafts
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The check-in drafts follow it ───────────────────────────────\n");

const SYS = draftMod.CHECKIN_SYSTEM;
ok(typeof SYS === "string" && SYS.includes(TECHNIQUE_HEADING), "the check-in system prompt carries the technique");
ok(SYS.indexOf("Plain ASCII only.") < SYS.indexOf(TECHNIQUE_HEADING),
   "…after its own absolute rules");
ok(WRITTEN_TECHNIQUE.every((l) => SYS.includes(l)), "…all of it");
ok(/Say nothing the draft does not already say/.test(SYS), "and the rewrite-only rule is still there");
ok(/Give them control/.test(SYS) && /No pressure/.test(SYS), "give control, no pressure");
ok(/Never ask "why"/.test(SYS), "no \"why\"");
ok(/day and time/.test(SYS) && /Never suggest a day or a time yourself/.test(SYS),
   "keep the day-and-time ask, never invent the time");

const OFFER_CODES = ["payment_failing", "trial_ends_before_retention", "payments_not_connected", "onboarding_unfinished", "setup_steps_outstanding"];
const facts = { companyName: "Easy Roofers Inc.", setupRemainingCount: 3, dayInLife: 5 };
for (const code of Object.keys(signals.CHECKIN_REASONS)) {
  const decision = { primary: { code, ...signals.CHECKIN_REASONS[code] }, facts };
  for (const weekendAhead of [false, true]) {
    const text = draftMod.ruleDraft(decision, { repName: "Daniel", weekendAhead });
    const tag = `${code}${weekendAhead ? " (Friday)" : ""}`;
    ok(draftMod.judgeDraft(text, decision).ok, `${tag}: passes the same gate the model's text must`, text);
    ok(bannedMovesIn(text).length === 0, `${tag}: makes no banned move`, bannedMovesIn(text).join(", "));
    if (OFFER_CODES.includes(code)) {
      ok(text.includes(DAY_AND_TIME_ASK), `${tag}: asks them for a day and time rather than "whenever suits"`, text);
      ok(!/whenever suits/i.test(text), `${tag}: no open-ended "whenever suits"`);
    }
  }
}
const allGood = { primary: { code: "all_good", ...signals.CHECKIN_REASONS.all_good }, facts };
ok(draftMod.ruleDraft(allGood, { repName: "Daniel", weekendAhead: true }).includes(WEEKEND_LINE),
   "a Friday send carries \"I am around this weekend if you need anything\"");
ok(!draftMod.ruleDraft(allGood, { repName: "Daniel" }).includes(WEEKEND_LINE), "…and no other day does");
const trialEnd = { primary: { code: "trial_ends_before_retention", ...signals.CHECKIN_REASONS.trial_ends_before_retention }, facts };
ok(draftMod.ruleDraft(trialEnd, { repName: "Daniel", weekendAhead: true }).includes(WEEKEND_LINE),
   "…including one with an offer in it, which gives up the business name before the weekend line");

// 2026-01-02 is a Friday. 17:00Z is noon in Toronto; 02:00Z on the 3rd is
// still Friday evening in Toronto and already Saturday in UTC.
const FRI_NOON = new Date("2026-01-02T17:00:00Z");
const FRI_NIGHT_TORONTO = new Date("2026-01-03T02:00:00Z");
ok(isFridayIn(FRI_NOON, "America/Toronto"), "isFridayIn: a Friday in the recipient's zone is a Friday");
ok(isFridayIn(FRI_NIGHT_TORONTO, "America/Toronto") && !isFridayIn(FRI_NIGHT_TORONTO, "UTC"),
   "…judged in THEIR zone, not the server's");
ok(!isFridayIn(FRI_NOON, null), "…and with no zone it is never guessed");
ok(!isFridayIn(FRI_NOON, "Not/AZone") && !isFridayIn("garbage", "America/Toronto"), "…nor with a broken one");

const friday = await draftMod.draftCheckIn({ decision: allGood, repName: "Daniel", now: FRI_NOON, sendAt: FRI_NOON, timeZone: "America/Toronto" });
ok(friday.source === "rule" && friday.text.includes(WEEKEND_LINE),
   "draftCheckIn: a Friday send in a known zone gets the weekend line (no model asked)");
const noZone = await draftMod.draftCheckIn({ decision: allGood, repName: "Daniel", now: FRI_NOON, sendAt: FRI_NOON });
ok(!noZone.text.includes(WEEKEND_LINE), "…and the same send with no zone does not");
const thursdayForFriday = await draftMod.draftCheckIn({
  decision: allGood, repName: "Daniel", now: new Date("2026-01-01T17:00:00Z"), sendAt: FRI_NOON, timeZone: "America/Toronto",
});
ok(thursdayForFriday.text.includes(WEEKEND_LINE), "…it follows the day the text is aimed at, not the day it was drafted");

// The surfaces that write a rule draft for a row pass the send day and zone.
const storeSrc = codeOnly(read("lib/sales/checkin/store.js"));
const materialiseSrc = codeOnly(read("lib/sales/checkin/materialise.js"));
const checkinsRoute = codeOnly(read("app/api/sales/checkins/route.js"));
ok(/weekendAhead:\s*isFridayIn\(scheduledFor,\s*timeZone\)/.test(storeSrc),
   "store.js: the on-screen suggestion judges the weekend on its own scheduledFor and zone");
ok(/sendAt:\s*scheduledFor,\s*timeZone,/.test(storeSrc), "store.js: the materialised AI draft is told when it will land");
ok(/weekendAhead:\s*isFridayIn\(plan\.scheduledFor,\s*zone\.timeZone\)/.test(materialiseSrc),
   "materialise.js: the backlog draft does the same, so a refresh re-judges it");
ok(/createCheckIn\(\{[\s\S]*?timeZone,[\s\S]*?\}\)/.test(checkinsRoute), "the check-ins route hands createCheckIn the zone");

/* ═══════════════════════════════════════════════════════════════════════════
   3. The reply triage
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The reply triage hears a referral ───────────────────────────\n");

const TRI = triageMod.TRIAGE_SYSTEM;
ok(/referral/i.test(TRI) && /is positive/.test(TRI),
   "a reply that names another contractor is triaged as positive — something to act on, not small talk");
ok(!triageKinds.TRIAGE_KINDS.includes("referral"),
   "no new triage kind was invented without a product decision");
ok(/Never answer stop/.test(TRI), "and STOP is still not the model's to decide");

/* ═══════════════════════════════════════════════════════════════════════════
   4. Across every surface
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Nothing the surfaces forbid comes in with it ────────────────\n");

for (const c of combos) {
  const tag = `phone (transfer ${c.canTransfer ? "on" : "off"}, recorded ${c.callsRecorded ? "on" : "off"})`;
  ok(namesACustomer(c.prompt).length === 0, `${tag}: names no customer`, namesACustomer(c.prompt).join(" | "));
}
ok(STORY_RULE.test(full), "the stories rule itself is present — removing it is not how the scan passes");
ok(/A lot of owners say the same thing/.test(s), "stories are in the pattern form only");
ok(namesACustomer(SYS).length === 0, "check-in drafts: names no customer");
ok(namesACustomer(TRI).length === 0, "reply triage: names no customer");

ok(bannedMovesIn(section).length === 0, "the phone technique makes no banned move",
   bannedMovesIn(section).join(", "));
ok(bannedMovesIn(WRITTEN_TECHNIQUE.join("\n")).length === 0, "nor does the written one",
   bannedMovesIn(WRITTEN_TECHNIQUE.join("\n")).join(", "));
const OFFERS = /\bwe (?:can|could|will) (?:do|offer|throw|knock)\b|\bspecial (?:price|rate|offer)\b|\b\d+%\s*off\b/i;
ok(!OFFERS.test(section), "no offer language in the technique", (section.match(OFFERS) || [])[0]);
ok(!/pays for itself/i.test(section.replace(/Never say it pays for itself/g, "")),
   "no \"pays for itself\" result claim — only the instruction never to make one");

const techSrc = read("lib/sales/technique.js");
const techCode = codeOnly(techSrc);
ok(/from "@\/lib\/pricing"/.test(techCode) && /TRIAL_DAYS/.test(techCode) && /TRIAL_CARD_REQUIRED/.test(techCode) && /trialLabel/.test(techCode),
   "technique.js takes the trial from lib/pricing.js");
ok(/from "@\/lib\/referrals"/.test(techCode) && /REFEREE_BONUS_MONTHS/.test(techCode) && /REFERRER_BONUS_MONTHS/.test(techCode),
   "…and the referral months from lib/referrals");
ok(!/[$€£]\s*\d/.test(techCode) && !new RegExp(`\\b${pricing.TRIAL_DAYS}\\b`).test(techCode),
   "…and types neither a price nor the trial length");
ok(!/lib\/ai\/provider|openai/i.test(techCode), "technique.js calls no model — it is text");
ok(/phoneTechnique\(/.test(codeOnly(read("lib/platform/salesPrompt.js"))), "salesPrompt.js uses phoneTechnique");
ok(/WRITTEN_TECHNIQUE/.test(codeOnly(read("lib/sales/checkin/draft.js"))), "draft.js uses WRITTEN_TECHNIQUE");

console.log(`\n${fail ? `${fail} FAILED of ${checks}` : `ALL PASS (${checks} checks)`}`);
process.exit(fail ? 1 : 0);
