// scripts/check-image-economics.mjs
//
// What an AI image costs us, what it costs a company, and what stops either
// number drifting quietly.
//
// ══ Why this file EXECUTES the arithmetic ══════════════════════════════════
//
// Because reading it does not work. `bundleMargin` was first written against a
// cost basis of 0.0006 dollars per credit — a slipped decimal, one zero too
// many — which reported every bundle at a 92% margin instead of the ~30% that
// had been agreed. It read fine. It was reviewed twice. It only fell over when
// the numbers were printed, which is why section 3 prints them.
//
// A margin that looks too good is the one nobody questions. That is the whole
// argument for this file.
//
// ══ detail is a cost ceiling, not a quality dial ═══════════════════════════
//
// The costly mistake this guards is treating `detail` as taste. On this model
// "original" carries NO patch budget, so a photograph's price scales with
// whichever phone the estimator happens to own — a 48MP handset costs 19x a
// capped read of the same scene. Section 2 pins that difference numerically.
import {
  photoTokens,
  photoCostDollars,
  VENDOR_RATES,
  VISION_PASS_CENTS,
  VISION_MAX_PHOTOS,
  IMAGE_GENERATION_CENTS,
  BUNDLES,
  CREDIT_COST,
  COST_PER_CREDIT_DOLLARS,
  bundleMargin,
} from "@/lib/ai/imageEconomics";
import { priceSpend, spendVerdict, SPEND_KINDS, FEATURE_FOR_KIND } from "@/lib/voice/spendGate";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

section("1. The token maths agrees with OpenAI's own calculator");

// Four readings taken from developers.openai.com's image cost calculator for
// gpt-5.6-sol. These are the external check on our arithmetic: if the patch
// formula or the 1.2x multiplier is wrong, these stop matching. They are not
// our numbers to change — if OpenAI's calculator moves, this file is the thing
// that tells us, and the prices below all need revisiting.
for (const [w, h, detail, tokens] of [
  [1024, 1024, "original", 1229],
  [3024, 4032, "original", 14364],
  [3024, 4032, "high", 2942],
  [6048, 8064, "original", 57154],
]) {
  const got = photoTokens(w, h, detail);
  // "high" clamps to the patch budget, so our figure is the ceiling (3,000) and
  // the calculator's 2,942 is the same image measured after its own rounding.
  // Within 2% is agreement; a different formula would be out by multiples.
  const close = Math.abs(got - tokens) / tokens < 0.02;
  ok(close, `${w}x${h} ${detail} ≈ ${tokens} tokens`, got);
}

section("2. detail:high is a CEILING — the property the price depends on");

const PHONE = [3024, 4032];
const BIG = [6048, 8064];
ok(photoTokens(...PHONE, "high") === photoTokens(...BIG, "high"),
  "a 48MP photo and a 12MP photo cost the SAME at high — the cap is what makes the price knowable",
  [photoTokens(...PHONE, "high"), photoTokens(...BIG, "high")]);
ok(photoCostDollars(...BIG, "high") <= 0.012 + 1e-9,
  "…and that ceiling is at most $0.012 a photograph, whatever the camera",
  photoCostDollars(...BIG, "high"));
ok(photoTokens(...BIG, "original") > photoTokens(...BIG, "high") * 15,
  "original is more than 15x the capped read of the same picture — this is why it is not the default",
  photoTokens(...BIG, "original") / photoTokens(...BIG, "high"));
ok(photoTokens(0, 0) === 0 && photoTokens(null, undefined) === 0 && photoTokens("x", "y") === 0,
  "junk dimensions cost nothing rather than NaN tokens");
ok(photoTokens(-5, -5) === 0, "negative dimensions cost nothing");

section("3. The prices, and the margins they actually earn");

// A vision pass at the cap: 8 photos + the quote in + the notes out.
const visionCost =
  VISION_MAX_PHOTOS * photoCostDollars(...PHONE, "high") +
  (4000 * VENDOR_RATES.visionInput) / 1e6 +
  (1200 * VENDOR_RATES.visionOutput) / 1e6;
const visionMargin = (VISION_PASS_CENTS / 100 - visionCost) / (VISION_PASS_CENTS / 100);
console.log(`         vision pass: cost $${visionCost.toFixed(4)}  charge $${(VISION_PASS_CENTS / 100).toFixed(2)}  margin ${(visionMargin * 100).toFixed(1)}%`);
// Priced flat rather than per photo, so the margin floats with photo count.
// Worst case is the cap; it must still be comfortably profitable there.
ok(visionMargin > 0.35, "a vision pass at the FULL photo cap still clears 35%", visionMargin);
ok(visionMargin < 0.75, "…and is not silently gouging either", visionMargin);

const genCost = 0.06;
const genMargin = (IMAGE_GENERATION_CENTS / 100 - genCost) / (IMAGE_GENERATION_CENTS / 100);
console.log(`         generation:  cost $${genCost.toFixed(4)}  charge $${(IMAGE_GENERATION_CENTS / 100).toFixed(2)}  margin ${(genMargin * 100).toFixed(1)}%`);
ok(Math.abs(genMargin - 0.5) < 0.02, "a generated image earns the ~50% that was agreed", genMargin);

for (const b of BUNDLES) {
  const m = bundleMargin(b.key);
  const cost = b.credits * COST_PER_CREDIT_DOLLARS;
  console.log(`         ${b.key.padEnd(8)} $${b.priceCents / 100}  ${String(b.credits).padStart(6)} cr  cost $${cost.toFixed(2)}  margin ${(m * 100).toFixed(1)}%`);
  // The point of a bundle is that committing costs LESS per image than not
  // committing. A bundle at pay-as-you-go margin is not a bundle, it is a
  // prepayment we charged for.
  ok(m > 0.2 && m < 0.4, `${b.key} lands near the 30% a bundle was meant to earn`, m);
  ok(m < 0.5, `…and is genuinely cheaper per image than paying as you go`, m);
}
// Bigger commitment, better rate — or there is no reason to take the bigger one.
const rates = BUNDLES.map((b) => b.priceCents / b.credits);
ok(rates.every((r, i) => i === 0 || r < rates[i - 1]),
  "each bigger bundle costs less per credit than the one below it", rates);
ok(bundleMargin("nope") === null, "an unknown bundle has no margin rather than an invented one");

section("4. The ledger prices them, and refuses what it does not know");

ok(SPEND_KINDS.image_generation && SPEND_KINDS.image_vision, "both kinds are on the one prepaid balance");
ok(!SPEND_KINDS.image_generation.recurring && !SPEND_KINDS.image_vision.recurring,
  "…and neither recurs — generate nothing, pay nothing");
ok(priceSpend("image_generation") === IMAGE_GENERATION_CENTS, "generation is priced from the economics file, not a literal", priceSpend("image_generation"));
ok(priceSpend("image_vision") === VISION_PASS_CENTS, "so is vision", priceSpend("image_vision"));
ok(CREDIT_COST.image_generation === IMAGE_GENERATION_CENTS && CREDIT_COST.image_vision === VISION_PASS_CENTS,
  "the bundle credit cost and the cash price cannot disagree — both derive from one constant");
ok(spendVerdict({ kind: "image_vision", balanceCents: 10 }).reason === "insufficient_balance",
  "too little credit is refused with the shortfall, not a silent free pass");
ok(spendVerdict({ kind: "image_vision", balanceCents: 10 }).shortfallCents === VISION_PASS_CENTS - 10,
  "…and says exactly how short");
ok(spendVerdict({ kind: "image_typo", balanceCents: 99999 }).reason === "unknown_spend",
  "a typo'd kind fails closed however much credit there is");

section("5. An image spend is not gated on the telephone");

// The bug this prevents: spendAvailable() asked `voice_receptionist` for every
// kind. A company FieldQuo has withdrawn the receptionist from must still be
// able to make an advert.
ok(FEATURE_FOR_KIND.image_generation === "marketing_designer", "generation is gated on the designer", FEATURE_FOR_KIND.image_generation);
ok(FEATURE_FOR_KIND.image_vision === "ai_vision", "vision is gated on vision", FEATURE_FOR_KIND.image_vision);
ok(!Object.values(FEATURE_FOR_KIND).includes("voice_receptionist"),
  "…and neither is gated on the phone");
for (const k of ["number_setup", "number_rent", "call"]) {
  ok(!FEATURE_FOR_KIND[k], `${k} is untouched and still resolves to the voice default`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
