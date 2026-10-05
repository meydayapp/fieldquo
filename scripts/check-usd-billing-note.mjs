// scripts/check-usd-billing-note.mjs
//
//   npm run check:usd-billing-note
//
// The owner, 2026-10-04: "this price is in USD so there should be a disclaimer
// for Canadian companies that the pricing is in USD, same for the AI
// subscription and the Retell/text credits; explain that the companies
// providing those services do charge in USD." (His 2026-09-06 rule: add-ons
// and bundles are USD-only.)
//
// Proves two things per surface: the money really is charged in USD (the
// Stripe line's currency, read from source), and the note is drawn there.
import { readFileSync } from "node:fs";
import { needsUsdNote, approxRounded } from "@/lib/billing/usdNote";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

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

console.log("\n1. Who reads it\n");
ok("a CAD company does", needsUsdNote("CAD") && needsUsdNote("cad"));
ok("an AUD company does", needsUsdNote("AUD"));
ok("a USD company never reads a disclaimer about itself", !needsUsdNote("USD") && !needsUsdNote("usd"));
ok("an unknown currency says nothing rather than guess", !needsUsdNote(null) && !needsUsdNote(undefined) && !needsUsdNote(""));

console.log("\n2. The approximate hint: two significant figures, never a cent\n");
ok("US$77 at 1.4246 = CA$109.69 → about CA$110", approxRounded(77 * 1.4246) === 110);
ok("US$10 at 1.4246 = 14.25 → 14", approxRounded(10 * 1.4246) === 14);
ok("under half a dollar rounds to nothing, so no hint is drawn", approxRounded(0.4) === 0);
for (const bad of [0, -5, NaN, Infinity]) ok(`no hint for ${bad}`, approxRounded(bad) === null);

console.log("\n3. Every USD surface is USD at Stripe — and carries the note\n");
const SURFACES = [
  // [what, where it is charged (Stripe currency in source), where it is shown]
  ["Video pack (subscription)", "lib/marketing/videoPack.js", /const currency = VIDEO_PACK\.currency;[\s\S]*currency: currency\.toLowerCase\(\)/, ["app/components/designer/VideoAllowance.js"]],
  ["AI credit plans (subscription)", "lib/ai/creditBundle.js", /currency: "usd"/, ["app/app/settings/ai-credit/page.js"]],
  ["AI credit top-up (one-time)", "lib/ai/topupIntent.js", /currency: "usd"/, ["app/app/settings/ai-credit/AiCreditCard.js", "app/components/ai/AiCreditTopupDialog.js"]],
  ["Phone & text credit top-up (Retell + Twilio, one-time)", "app/api/settings/voice/topup/route.js", /currency: "usd"/, ["app/app/settings/voice/page.js", "app/app/settings/ai-credit/page.js", "app/app/settings/verify-phone/page.js"]],
  ["Phone & text automatic top-up", "lib/voice/autoTopup.js", /currency: CREDIT_CURRENCY\.toLowerCase\(\)/, ["app/app/settings/voice/page.js"]],
];
for (const [what, charged, re, shown] of SURFACES) {
  ok(`${what}: charged in USD (${charged})`, re.test(src(charged)));
  for (const f of shown) ok(`${what}: the note is on ${f}`, /<UsdBillingNote\b/.test(src(f)) && /import UsdBillingNote from "@\/app\/components\/billing\/UsdBillingNote"/.test(src(f)));
}
ok("the credit's own currency constant is USD", /export const CREDIT_CURRENCY = "USD"/.test(src("lib/voice/creditCurrency.js")));
ok("the AI advisor's AI-credit sentence carries it too", /<UsdBillingNote cents=/.test(src("app/components/billing/AiPlanAdvisor.js")));

console.log("\n4. The words, in every language, and the rate behind the hint\n");
ok("the sentence names the providers and the bank conversion in every language", Object.values(APP_MESSAGES).every((m) => String(m["app.usdNote.body"] || "").length > 40));
ok("the hint is labelled approximate in every language, with {amount}", Object.values(APP_MESSAGES).every((m) => String(m["app.usdNote.approx"] || "").includes("{amount}")));
const fx = src("app/api/fx/usd/route.js");
ok("the hint's rate is the ExchangeRate table else the checked-in rate (loadLiveRates), never a constant here", /loadLiveRates\(\)/.test(fx) && !/1\.4\d/.test(fx));
ok("a currency with no rate gets no hint (AUD today) — nothing is guessed", /if \(live && Number\.isFinite\(r\) && r > 0\) setRate\(r\)/.test(src("app/components/billing/UsdBillingNote.js")));

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
