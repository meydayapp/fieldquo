// scripts/check-credit-currency.mjs
//
// Voice and crew-text credit must be collected in the SAME currency it is spent
// in, and that currency is USD — because both providers bill FieldQuo in USD.
// Retell publishes USD; Twilio quotes and bills USD (a contractor paying for
// US$20 of credit was charged CA$27.74 by their own card issuer, an FX rate of
// 1.387 applied by the bank, not by us — FieldQuo received the full $20).
//
// Collecting in the company's own currency would put a CAD price against a USD
// cost and hand the whole exchange-rate movement to FieldQuo on every top-up.
// At 1.387 a $35/minute retail rate becomes about 25 US cents against a 17.4
// cent cost, which is most of the margin gone.
//
// The top-up is the ONE place real money enters this ledger. `addCredit` in
// spendGate.js is a refund of a reservation, not a purchase. Everything else —
// calls, crew texts, number rent — is a debit against a balance already funded
// in USD, so it carries no exchange-rate exposure at all.
//
// This is asserted rather than commented because the hardcoded "usd" in the
// checkout looks exactly like an oversight: every other price_data in the repo
// goes through stripeCurrency(company.currency), and a tidy-minded refactor
// would "fix" it in the direction that loses money.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CREDIT_CURRENCY } from "../lib/voice/creditCurrency.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`); }
  else console.log(`pass  ${name}`);
};

const topup = readFileSync(join(ROOT, "app/api/settings/voice/topup/route.js"), "utf8");

ok("the ledger's currency is USD", CREDIT_CURRENCY === "USD", CREDIT_CURRENCY);
ok("the top-up charges in that currency",
   new RegExp(`currency:\\s*"${CREDIT_CURRENCY.toLowerCase()}"`).test(topup));
// The direction that loses money, named so the failure message says why.
ok("the top-up does NOT charge in the company's own currency",
   !/currency:\s*stripeCurrency\(/.test(topup) && !/currency:\s*company\.currency/.test(topup),
   "collecting CAD against a USD cost hands FieldQuo the exchange rate");

// The screen must say WHICH dollars. A bare $ on a CAD account beside a USD
// charge is how a contractor reads $30 and pays about $41 of their own money.
const page = readFileSync(join(ROOT, "app/app/settings/voice/page.js"), "utf8");
// Matched across the whole helper body rather than with [^)]* — the call
// contains a nested `Number(c || 0)`, so a naive negated-paren class stops at
// the wrong bracket and reports a false failure.
{
  const helper = page.slice(page.indexOf("const money ="), page.indexOf("const money =") + 200);
  ok("the voice page formats credit with an explicit currency",
     /formatAppMoney/.test(helper) && /CREDIT_CURRENCY/.test(helper), helper.split("\n")[1]);
}
ok("and no longer builds a bare dollar sign by hand",
   !/const money = \(c\) => `\$\$\{/.test(page));

// creditCurrency.js exists precisely because credits.js imports Prisma; a client
// component pulling from there drags the database driver into the browser.
const cc = readFileSync(join(ROOT, "lib/voice/creditCurrency.js"), "utf8");
ok("the constant's own file imports nothing", !/^import /m.test(cc));

// ── Only one path may put real money into the ledger ─────────────────────
//
// Asserted on the IMPORT rather than the call. lib/voice/topup.js takes
// `deps.addCredit || addCredit` so its check can execute the settlement against
// an injected ledger — a better design than a direct call, and one a grep for
// `addCredit(` cannot see. The invariant is which modules may credit at all,
// not how they spell the invocation.
const crediters = execLines("grep -rln 'addCredit' app lib")
  .filter((f) => !f.endsWith("lib/voice/credits.js"));
ok("exactly two modules may add credit", crediters.length === 2, crediters.join(" | "));
ok("one is the top-up settlement — the single place money buys credit",
   crediters.some((f) => f.endsWith("lib/voice/topup.js")), crediters.join(" | "));
ok("the other is the reservation refund, not a second purchase",
   crediters.some((f) => f.endsWith("lib/voice/spendGate.js")));
// And that settlement is reached from BOTH doors, so a browser that never comes
// back from Stripe is not the only thing standing between a charge and a
// credit — which is exactly what it used to be.
{
  const dispatcher = readFileSync(join(ROOT, "lib/stripe/settleCheckoutSession.js"), "utf8");
  ok("the webhook settles a top-up too", /voice_topup/.test(dispatcher));
  const route = readFileSync(join(ROOT, "app/api/settings/voice/topup/route.js"), "utf8");
  ok("and the return redirect uses the same settlement", /creditVoiceTopup/.test(route));
}

function execLines(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
}

// ── The margin compares like with like ───────────────────────────────────
//
// Retell's call_cost is USD and the credit ledger is USD, so measuredMargin
// subtracts one from the other directly. If a conversion ever appears in that
// path it means somebody saw a Canadian company and reached for an exchange
// rate, which would corrupt a figure that is currently correct.
{
  const cost = readFileSync(join(ROOT, "lib/voice/providerCost.js"), "utf8");
  const code = cost.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("the margin path applies no exchange rate",
     !/exchangeRate|fxRate|convertCurrency|\bCAD\b/.test(code));
  ok("and the file says which currency it is in",
     /US DOLLARS|USD/.test(cost));
}

console.log(fail === 0 ? "\nALL PASS — credit is bought and spent in the same currency" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
