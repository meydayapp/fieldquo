// scripts/check-ai-plan-advice.mjs
//
//   npm run check:ai-plan-advice
//
// The owner, 2026-10-04: "AI plans: every plan keeps a cap (no unlimited).
// Add a recommendation in the plan picker: based on what the company says it
// will use (AI employees answering messages; commercial deep reads of
// drawings; quote reviews), recommend the plan whose AI allowance fits, with a
// short 'about N conversations / N drawing reads a month' estimate computed
// from real metered costs."
//
// Executes lib/ai/planAdvice.js (pure) against hostile input, and
// lib/ai/planAdviceUnits.js against the REAL metering functions, with the
// worked numbers written out so a price change shows up here as a diff.
import { readFileSync } from "node:fs";
import { recommendAiPlan, reviewsPerMonth, bundleCovers, usageCount } from "@/lib/ai/planAdvice";
import { aiAdviceUnits, aiAdviceBundles, QUOTE_REVIEW_TOKENS, TYPICAL_SET_SHEETS } from "@/lib/ai/planAdviceUnits";
import { resolveAiCap, DEFAULT_TRIAL_CAP } from "@/lib/ai/usage";
import { estimateChargeCents } from "@/lib/ai/walletMeter";
import { estimateRead } from "@/lib/planRead/billing";
import { BUNDLES } from "@/lib/ai/imageEconomics";

let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`);
  }
};
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

console.log("\n1. The unit costs are the metering's own\n");
const units = aiAdviceUnits();
ok("a conversation = walletMeter's own estimate for an AI-employee reply", units.conversationCents === estimateChargeCents("ai_employee_reply"));
ok(`a drawing read = estimateRead's EXPECTED charge for a ${TYPICAL_SET_SHEETS}-sheet set`, units.drawingReadCents === estimateRead({ sheets: TYPICAL_SET_SHEETS }).expectedCents && units.drawingReadSheets === 20);
ok("a quote review = the stated 3,500 + 2,500 tokens", units.quoteReview.tokens === QUOTE_REVIEW_TOKENS.prompt + QUOTE_REVIEW_TOKENS.completion && units.quoteReview.tokens === 6000);
// Worked, at today's PRICING (lib/ai/usage.js) and models (gpt-5.5 best, gpt-5-mini standard):
//   conversation  9,000 × $5/M + 600 × $30/M = $0.063 × 2 = 12.6¢ → 13¢
//   20-sheet read 20 × (26,050 × $0.13/M + 3,000 × $1/M) + (19,000 × $5/M + 14,000 × $30/M)
//                 = $0.1277 + $0.515 = $0.6427 × 2 = 128.5¢ → 129¢ (162¢ held)
//   quote review  3,500 × $0.13/M + 2,500 × $1/M = $0.002955 → 2,955 micros
ok("worked: a conversation is 13¢ of AI credit", units.conversationCents === 13, String(units.conversationCents));
ok("worked: a 20-sheet drawing read is $1.29 (held at $1.62)", units.drawingReadCents === 129 && units.drawingReadCeilingCents === 162, `${units.drawingReadCents}/${units.drawingReadCeilingCents}`);
ok("worked: a quote review costs FieldQuo ~0.3¢ (2,955 micros)", units.quoteReview.micros === 2955, String(units.quoteReview.micros));
ok("the AI credit plans are BUNDLES, prices and credits only", JSON.stringify(aiAdviceBundles()) === JSON.stringify(BUNDLES.map((b) => ({ key: b.key, priceCents: b.priceCents, credits: b.credits }))));

console.log("\n2. Every plan is capped — the advisor reads the gate's own cap\n");
const capOf = (plan) => resolveAiCap({ subscription: { plan } });
ok("a plan with no AI columns gets the 750,000-token default, never unlimited", capOf({ aiMonthlyTokenCap: null, aiMonthlyAllowanceCents: null }).cap === DEFAULT_TRIAL_CAP);
ok("…which is about 125 quote reviews a month", reviewsPerMonth(capOf({}), units) === 125);
ok("a dollar allowance of $1.50 is about 507 reviews (150¢ ÷ 0.2955¢)", reviewsPerMonth(capOf({ aiMonthlyAllowanceCents: 150 }), units) === 507, String(reviewsPerMonth(capOf({ aiMonthlyAllowanceCents: 150 }), units)));
ok("an explicit 0 is no AI: 0 reviews", reviewsPerMonth(capOf({ aiMonthlyTokenCap: 0 }), units) === 0);
for (const bad of [null, undefined, {}, { cap: "x", unit: "tokens" }, { cap: -5, unit: "tokens" }, { cap: NaN, unit: "dollars" }]) {
  ok(`a junk allowance (${JSON.stringify(bad)}) reads as unknown, never a number`, reviewsPerMonth(bad, units) === null);
}
ok("no unit cost → unknown, never Infinity", reviewsPerMonth({ cap: 1000, unit: "tokens" }, {}) === null);

console.log("\n3. The AI credit plans, in conversations and drawing reads\n");
const [starter, busy, agency] = aiAdviceBundles();
ok("Starter (US$30, 4,000 credits): ~307 conversations or ~31 drawing reads", JSON.stringify(bundleCovers(starter, units)) === JSON.stringify({ conversations: 307, drawingReads: 31 }), JSON.stringify(bundleCovers(starter, units)));
ok("Busy (US$50, 7,000): ~538 or ~54", JSON.stringify(bundleCovers(busy, units)) === JSON.stringify({ conversations: 538, drawingReads: 54 }));
ok("Agency (US$80, 11,500): ~884 or ~89", JSON.stringify(bundleCovers(agency, units)) === JSON.stringify({ conversations: 884, drawingReads: 89 }));
ok("rounded DOWN — 'about N' never promises more than the credit buys", bundleCovers({ credits: 25 }, units).conversations === 1);

console.log("\n4. The recommendation\n");
const plans = [
  { id: "solo", name: "Solo", priceMonthly: 99, allowance: { cap: 750_000, unit: "tokens" } },
  // A $5.00 dollar allowance, in resolveAiCap's unit: micros (500¢ × 10,000).
  { id: "shop", name: "Shop", priceMonthly: 269, allowance: capOf({ aiMonthlyAllowanceCents: 500 }) },
];
const bundles = aiAdviceBundles();
const r0 = recommendAiPlan({ input: {}, units, plans, bundles });
ok("nothing typed: no recommendation, but every plan's reviews are known", r0.credit === null && r0.plan === null && r0.reviewsByPlanId.solo === 125 && r0.reviewsByPlanId.shop === Math.floor(5_000_000 / 2955));
const r1 = recommendAiPlan({ input: { conversations: 200, drawingReads: 5, quoteReviews: 60 }, units, plans, bundles });
ok("200 conversations + 5 reads = 200×13¢ + 5×129¢ = $32.45 of AI credit", r1.credit.walletCents === 3245, String(r1.credit?.walletCents));
ok("…the smallest AI credit plan that covers it: Starter (4,000)", r1.credit.bundle.key === "starter" && r1.credit.fits && r1.credit.topUpCents === 0);
ok("…60 quote reviews: the cheapest plan that covers them (Solo, ~125)", r1.plan.id === "solo" && r1.plan.fits && r1.plan.reviews === 125);
const r2 = recommendAiPlan({ input: { quoteReviews: 1000 }, units, plans, bundles });
ok("1,000 reviews: only Shop's dollar allowance covers it (~1,692)", r2.plan.id === "shop" && r2.plan.fits);
const r3 = recommendAiPlan({ input: { quoteReviews: 9999 }, units, plans, bundles });
ok("more than any plan covers: says the most there is, and that it doesn't fit", r3.plan.id === "shop" && r3.plan.fits === false);
const r4 = recommendAiPlan({ input: { conversations: 2000 }, units, plans, bundles });
ok("2,000 conversations ($260) > Agency's 11,500: Agency + $145 a month of top-ups", r4.credit.bundle.key === "agency" && !r4.credit.fits && r4.credit.topUpCents === 26000 - 11500);
for (const junk of ["-5", "abc", null, {}, "1e309", -1]) {
  const r = recommendAiPlan({ input: { conversations: junk, drawingReads: junk, quoteReviews: junk }, units, plans, bundles });
  ok(`junk input ${JSON.stringify(junk)} reads as none`, r.credit === null && r.plan === null);
}
ok("a huge typed number is clamped, not a crash", usageCount(1e12) === 100_000);
ok("junk plans/bundles/units never throw", (() => { try { recommendAiPlan({ input: { conversations: 5, quoteReviews: 5 }, units: null, plans: "x", bundles: null }); return true; } catch { return false; } })());

console.log("\n5. Wired on the three pickers, from the server's numbers\n");
const plansRoute = src("app/api/settings/plans/route.js");
ok("Account & Billing's plans carry the gate's cap (resolveAiCap) and the unit costs", /aiAllowance: resolveAiCap\(\{ subscription: \{ plan: p \} \}\)/.test(plansRoute) && /units: aiAdviceUnits\(\)/.test(plansRoute));
const billing = src("app/app/settings/account-billing/page.js");
ok("…the advisor is on the page, and each card says its reviews and whether it covers", /<AiPlanAdvisor/.test(billing) && /app\.aiAdvisor\.planLine/.test(billing) && /app\.aiAdvisor\.coversBadge/.test(billing));
ok("…its plan list is memoised (the advisor hands its answer back — a fresh array would loop)", /const advisorPlans = useMemo\(/.test(billing));
const credit = src("app/app/settings/ai-credit/page.js");
ok("the AI credit page: advisor + each plan's conversations/drawing reads + the fitting one marked", /<AiPlanAdvisor/.test(credit) && /app\.aiAdvisor\.bundleCovers/.test(credit) && /app\.aiAdvisor\.recommendedBadge/.test(credit) && /adviceUnits: aiAdviceUnits\(\)/.test(src("app/api/settings/ai/credit/route.js")));
const pricingPage = src("app/(marketing)/pricing/page.js");
const pricingPlans = src("app/(marketing)/pricing/PricingPlans.js");
ok("/pricing lists AI, so it says each plan's reviews and offers the advisor", /aiAllowance: resolveAiCap/.test(pricingPage) && /<AiPlanAdvisor/.test(pricingPlans) && /app\.aiAdvisor\.planLine/.test(pricingPlans));
const advisor = src("app/components/billing/AiPlanAdvisor.js");
ok("the advisor says the two allowances apart (plan: reviews; AI credit: employee + reads)", /app\.aiAdvisor\.planFits/.test(advisor) && /app\.aiAdvisor\.credit"/.test(advisor) && /app\.aiAdvisor\.creditTopups/.test(advisor));
ok("…and offers no AI credit plan to a company that cannot start one", /bundlesAvailable/.test(advisor) && /bundlesAvailable: bundleAvailability\(companyRow\?\.currency\)\.ok/.test(plansRoute));
ok("a cap that cannot be read is never drawn as a number (or as 'unlimited'): the line needs reviews != null", /reviewsByPlanId\?\.\[plan\.id\] != null/.test(billing) && /reviewsByPlanId\[plan\.id\] != null/.test(pricingPlans) && reviewsPerMonth({ cap: null, unit: "tokens" }, units) === null);
ok("no plan price or cap was changed (planAdviceUnits writes nothing)", !/db\./.test(src("lib/ai/planAdviceUnits.js")) && !/\.update\(|\.create\(/.test(src("lib/ai/planAdvice.js")));

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
