// scripts/check-ai-dollar-allowance.mjs
//
// The AI allowance in dollars per plan (owner-approved 2026-10-03).
//
//   npm run check:ai-dollar-allowance
//
// What must hold, executed rather than read wherever the code is pure:
//   1. Nothing changes until a plan row says so — resolveAiCap gives every
//      existing shape the cap it got before (company tokens → plan tokens →
//      750,000 default), and a NULL token cap is still the default, NOT
//      unlimited (what the code always did, whatever the comment said).
//   2. A plan dollar allowance is measured against costMicros, not tokens —
//      a best-model month that is tiny in tokens is still refused in dollars.
//   3. Hostile values (NaN, strings, negatives, the Number(null)=0 trap)
//      never turn into "unlimited" or "no AI".
//   4. The copilot's fair-use ceiling follows the same unit, from FieldQuo's
//      ledger.
//   5. Every company screen gets one shape (allowanceDisplay), same unit on
//      both sides of the percentage; the platform form writes the column and
//      only a superadmin may change it.
import { readFileSync } from "node:fs";
import {
  resolveAiCap,
  allowanceVerdict,
  allowanceDisplay,
  estimateCostMicros,
  tokensToCents,
  blendedMicrosPerMillion,
  DEFAULT_TRIAL_CAP,
  MICROS_PER_CENT,
} from "@/lib/ai/usage";
import { parsePlanFields } from "@/lib/billing/planFields";
import { meterFor, clearPayerCache } from "@/lib/ai/featurePayer";

let pass = 0;
let fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const co = (own, plan) => ({ aiMonthlyTokenCap: own, subscription: plan === undefined ? null : { plan } });

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n1. Nothing changes until a plan row says so");
ok("no plan, no override → the 750,000-token default", JSON.stringify(resolveAiCap(co(null))) === JSON.stringify({ cap: DEFAULT_TRIAL_CAP, unit: "tokens", source: "default" }));
ok("a plan token cap is still a token cap", JSON.stringify(resolveAiCap(co(null, { aiMonthlyTokenCap: 250_000, aiMonthlyAllowanceCents: null }))) === JSON.stringify({ cap: 250_000, unit: "tokens", source: "plan" }));
ok("a plan with NULL token cap and no dollars → the default (NOT unlimited — as before)", resolveAiCap(co(null, { aiMonthlyTokenCap: null, aiMonthlyAllowanceCents: null })).cap === DEFAULT_TRIAL_CAP);
ok("a row read before the column existed (undefined) behaves as null", resolveAiCap(co(null, { aiMonthlyTokenCap: 250_000 })).unit === "tokens");
ok("a company token override still beats the plan — even a dollar plan", JSON.stringify(resolveAiCap(co(1_000, { aiMonthlyTokenCap: 250_000, aiMonthlyAllowanceCents: 500 }))) === JSON.stringify({ cap: 1_000, unit: "tokens", source: "company" }));
ok("a company override of 0 is 'no AI'", resolveAiCap(co(0, { aiMonthlyAllowanceCents: 500 })).cap === 0);
ok("null/undefined company → default", resolveAiCap(null).cap === DEFAULT_TRIAL_CAP && resolveAiCap(undefined).cap === DEFAULT_TRIAL_CAP);

console.log("\n2. A dollar allowance is dollars");
const dollar = resolveAiCap(co(null, { aiMonthlyTokenCap: 250_000, aiMonthlyAllowanceCents: 500 }));
ok("US$5.00 replaces the token cap, in micros", dollar.unit === "dollars" && dollar.cap === 5_000_000 && dollar.source === "plan", dollar);
ok("…a cent is 10,000 micros", MICROS_PER_CENT === 10_000);
ok("allowance 0 cents → no AI on the plan", resolveAiCap(co(null, { aiMonthlyAllowanceCents: 0, aiMonthlyTokenCap: 250_000 })).cap === 0);
// 100k tokens of gpt-5.5 output-heavy work: few tokens, real money.
const best = estimateCostMicros({ model: "gpt-5.5", promptTokens: 60_000, completionTokens: 40_000 });
const v1 = allowanceVerdict({ usage: { tokens: 100_000, costMicros: best }, cap: dollar.cap, unit: "dollars" });
ok(`100k best-model tokens cost ${(best / 1e6).toFixed(2)} USD — measured in dollars that is ≥ US$1.50 of US$5`, best >= 1_500_000 && v1.allowed && v1.used === best && v1.unit === "dollars", { best, v1: v1.used });
const v2 = allowanceVerdict({ usage: { tokens: 150_000, costMicros: 5_000_001 }, cap: dollar.cap, unit: "dollars" });
ok("US$5.000001 of US$5 → refused even though 150k tokens is far under a 250k token cap", v2.allowed === false && /allowance/.test(v2.reason));
const v3 = allowanceVerdict({ usage: { tokens: 10_000_000, costMicros: 1_000_000 }, cap: dollar.cap, unit: "dollars" });
ok("10M mini tokens costing US$1 → allowed in dollars (a token cap would have refused)", v3.allowed && v3.remaining === 4_000_000 && !v3.nearLimit);
ok("warned at 80% of the dollars", allowanceVerdict({ usage: { costMicros: 4_000_000 }, cap: 5_000_000, unit: "dollars" }).nearLimit === true);
ok("cached input is priced at a tenth (the cost the allowance spends)", estimateCostMicros({ model: "gpt-5.4", promptTokens: 1_000_000, completionTokens: 0, cachedTokens: 1_000_000 }) === 250_000);
ok("tokens unit unchanged: 900 of 1,000 warned, 1,000 refused", allowanceVerdict({ usage: { tokens: 900 }, cap: 1000 }).nearLimit && !allowanceVerdict({ usage: { tokens: 1000 }, cap: 1000 }).allowed);

console.log("\n3. Hostile values");
for (const bad of [NaN, "abc", Infinity, -Infinity, {}, []]) {
  const r = resolveAiCap(co(null, { aiMonthlyAllowanceCents: bad, aiMonthlyTokenCap: 250_000 }));
  ok(`plan allowance ${JSON.stringify(bad)} is ignored, the token cap stands`, r.unit === "tokens" && r.cap === 250_000, r);
}
ok("a negative allowance clamps to 0 (no AI), never to unlimited", resolveAiCap(co(null, { aiMonthlyAllowanceCents: -500 })).cap === 0);
ok("a numeric-string allowance from a raw row is read as its number", resolveAiCap(co(null, { aiMonthlyAllowanceCents: "250" })).cap === 2_500_000);
ok("a NaN company override is ignored, not 'no AI'", resolveAiCap(co(NaN, { aiMonthlyTokenCap: 250_000 })).cap === 250_000);
for (const usage of [{}, { costMicros: NaN }, { costMicros: "x" }, { costMicros: -5 }, null, undefined]) {
  const v = allowanceVerdict({ usage, cap: 5_000_000, unit: "dollars" });
  ok(`usage ${JSON.stringify(usage)} counts as nothing used — allowed, used 0`, v.allowed && v.used === 0);
}
ok("an unknown unit is treated as tokens, never as unlimited", allowanceVerdict({ usage: { tokens: 10, costMicros: 0 }, cap: 5, unit: "bananas" }).allowed === false);

console.log("\n4. One shape for every company screen");
const d1 = allowanceDisplay(allowanceVerdict({ usage: { tokens: 3, costMicros: 1_234_567 }, cap: 5_000_000, unit: "dollars" }));
ok("dollars: usedCents 123, capCents 500, pct 25", d1.unit === "dollars" && d1.usedCents === 123 && d1.capCents === 500 && d1.pct === 25, d1);
const d2 = allowanceDisplay(allowanceVerdict({ usage: { tokens: 250, costMicros: 40_000 }, cap: 1000, unit: "tokens" }));
ok("tokens: no capCents (a token cap has no dollar ceiling to print), usedCents still shown", d2.unit === "tokens" && d2.capCents === null && d2.usedCents === 4 && d2.pct === 25, d2);
ok("uncapped → null (nothing rendered)", allowanceDisplay(allowanceVerdict({ usage: {}, cap: null })) === null);
ok("a refusal without a cap (FieldQuo budget pause) → null", allowanceDisplay({ allowed: false, reason: "paused" }) === null);
ok("over the cap the percentage stops at 100", allowanceDisplay(allowanceVerdict({ usage: { costMicros: 9e9 }, cap: 5_000_000, unit: "dollars" })).pct === 100);
ok("a cap of 0 does not divide by zero", allowanceDisplay(allowanceVerdict({ usage: {}, cap: 0 })).pct === 100);
for (const f of ["app/api/ai/copilot/route.js", "app/api/quotes/[id]/review/route.js", "app/api/invoices/[id]/review/route.js", "app/api/voice/calls/[id]/draft-quote/route.js", "app/api/ai/allowance/route.js"]) {
  const c = code(f);
  ok(`${f} ships allowanceDisplay, never tokens beside a dollar cap`, /allowanceDisplay\(/.test(c) && !/used: quota\.usage\.tokens/.test(c));
}
const comp = code("app/components/billing/AiAllowance.js");
ok("the company line says 'US$X of US$Y' only for a dollar cap", /app\.aiAllowance\.dollars/.test(comp) && /display\.unit === "dollars" && used && cap/.test(comp));
ok("…and formats in USD whatever the company's currency", /currency: "USD"/.test(comp));
ok("Account & billing renders the card, the copilot renders the line", /<AiAllowanceCard \/>/.test(code("app/app/settings/account-billing/page.js")) && /<AiAllowanceLine display=\{usage\}/.test(code("app/app/copilot/page.js")));

console.log("\n5. Conversion at the measured blended rate");
const rate = blendedMicrosPerMillion({ tokens: 2_000_000, costMicros: 400_000 });
ok("2M tokens that cost US$0.40 → 200,000 micros per million", rate === 200_000);
ok("250,000 tokens at that rate ≈ 5 cents", tokensToCents(250_000, rate) === 5);
ok("750,000 (the default) ≈ 15 cents", tokensToCents(DEFAULT_TRIAL_CAP, rate) === 15);
ok("no usage → no rate (never a made-up conversion)", blendedMicrosPerMillion({ tokens: 0, costMicros: 0 }) === null && blendedMicrosPerMillion({}) === null && tokensToCents(250_000, null) === null);
ok("hostile tokens → null", tokensToCents(NaN, rate) === null && tokensToCents(-1, rate) === null && tokensToCents(null, rate) === null);

console.log("\n6. The plan form writes it; only a superadmin may change it");
ok("blank → null (keep the token cap)", parsePlanFields({ aiMonthlyAllowanceCents: "" }, { partial: true }).data.aiMonthlyAllowanceCents === null);
ok("1250 → 1250 cents", parsePlanFields({ aiMonthlyAllowanceCents: 1250 }, { partial: true }).data.aiMonthlyAllowanceCents === 1250);
ok("0 → 0 (no AI), not blank", parsePlanFields({ aiMonthlyAllowanceCents: 0 }, { partial: true }).data.aiMonthlyAllowanceCents === 0);
for (const bad of [-1, 12.5, "abc", NaN, 1e12]) ok(`${JSON.stringify(bad)} refused with a sentence`, Boolean(parsePlanFields({ aiMonthlyAllowanceCents: bad }, { partial: true }).error));
ok("absent key → untouched on an edit", !("aiMonthlyAllowanceCents" in parsePlanFields({ name: "x" }, { partial: true }).data));
for (const f of ["app/api/platform/billing/plans/route.js", "app/api/platform/billing/plans/[id]/route.js"]) {
  ok(`${f} refuses a non-superadmin change`, /"aiMonthlyAllowanceCents" in data/.test(code(f)) && /admin\.role !== "superadmin"/.test(code(f)));
}
const plansPage = code("app/platform/billing/plans/page.js");
ok("the plans screen sends the field and shows each plan's allowance", /aiMonthlyAllowanceCents: aiAllowancePayload/.test(plansPage) && /aiAllowanceLine\(p, blended\)/.test(plansPage));
ok("…and imports the arithmetic from the database-free module", /from "@\/lib\/ai\/allowanceMath"/.test(plansPage) && !/from "@\/lib\/ai\/usage"/.test(plansPage));
ok("the platform usage table resolves caps with the same function", /resolveAiCap\(c\)/.test(code("app/api/platform/ai-usage/route.js")));
ok("schema has the column", /aiMonthlyAllowanceCents Int\?/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")));

console.log("\n7. The copilot's fair use follows the unit, on FieldQuo's ledger");
{
  clearPayerCache();
  const store = { platformAiUsage: [], aiFeaturePayer: [], platformAiBudget: [] };
  const db = {
    platformAiUsage: {
      aggregate: async ({ _sum = {} } = {}) => ({ _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, store.platformAiUsage.reduce((a, r) => a + (Number(r[k]) || 0), 0)])) }),
      count: async () => 0,
      create: async ({ data }) => { store.platformAiUsage.push(data); return data; },
    },
    aiFeaturePayer: { findMany: async () => [], findUnique: async () => null },
    platformAiBudget: { findMany: async () => [] },
  };
  const forbidden = async () => { throw new Error("company allowance touched"); };
  const deps = {
    checkAiQuota: forbidden,
    recordAiUsage: forbidden,
    getAiCap: async () => ({ cap: 5_000_000, unit: "dollars", source: "plan" }),
    checkPlatformAiBudget: async () => ({ allowed: true }),
  };
  const m = await meterFor("copilot", { companyId: "C1", prisma: db, deps });
  store.platformAiUsage.push({ totalTokens: 10_000_000, costMicros: 1_000_000 });
  const g1 = await m.check();
  ok("10M tokens costing US$1 against a US$5 plan: allowed, counted in dollars", g1.allowed && g1.unit === "dollars" && g1.used === 1_000_000, g1);
  store.platformAiUsage.push({ totalTokens: 1, costMicros: 4_100_000 });
  const g2 = await m.check();
  ok("past US$5: refused with the allowance's words, code quota", g2.allowed === false && g2.code === "quota", g2);
  clearPayerCache();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
