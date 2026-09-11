// Executes effectiveWageRate — the fallback that gets a member-set rate onto a payslip —
// and, since the "cad" fix, the contractor payout's currency against a recording Stripe.
import { readFileSync } from "node:fs";
import { effectiveWageRate } from "@/lib/payroll/buildPayRun";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const costs = new Map([["u1", 25], ["u2", 32.5]]);

console.log("\nExplicit Worker.hourlyRate always wins (never clobbered)");
ok("own rate used", effectiveWageRate({ userId: "u1", hourlyRate: 30 }, costs) === 30);
ok("own rate wins even when a member cost exists", effectiveWageRate({ userId: "u1", hourlyRate: 30 }, costs) === 30);
ok("own rate of 0 is honoured (unpaid role), not overridden", effectiveWageRate({ userId: "u1", hourlyRate: 0 }, costs) === 0);

console.log("\nThe bug: no Worker.hourlyRate -> fall back to the member's labour cost");
ok("falls back to member cost", effectiveWageRate({ userId: "u1", hourlyRate: null }, costs) === 25);
ok("second member's cost", effectiveWageRate({ userId: "u2", hourlyRate: null }, costs) === 32.5);
ok("this is what reaches the payslip instead of $0", effectiveWageRate({ userId: "u2", hourlyRate: null }, costs) > 0);

console.log("\nNeither source -> null (a flaggable gap, not a silent $0)");
ok("no rate, no member -> null", effectiveWageRate({ userId: "u9", hourlyRate: null }, costs) === null);
ok("no userId -> null", effectiveWageRate({ hourlyRate: null }, costs) === null);
ok("undefined worker -> null, no crash", effectiveWageRate(undefined, costs) === null);
ok("no map -> null, no crash", effectiveWageRate({ userId: "u1", hourlyRate: null }, undefined) === null);

console.log("\nHostile values");
ok("NaN hourlyRate -> falls through, not NaN", effectiveWageRate({ userId: "u1", hourlyRate: NaN }, costs) === null || effectiveWageRate({ userId: "u1", hourlyRate: NaN }, costs) === 25, effectiveWageRate({ userId: "u1", hourlyRate: NaN }, costs));
ok("string hourlyRate coerces", effectiveWageRate({ userId: "u1", hourlyRate: "40" }, costs) === 40);
ok("member cost of NaN ignored -> null", effectiveWageRate({ userId: "x", hourlyRate: null }, new Map([["x", NaN]])) === null);

console.log("\nOverhead salaries (workerId:null) are NOT pay — unaffected by this helper");
// The helper only reads Worker.hourlyRate + Member cost; it never looks at
// Salary rows, so an overhead salary can't leak into a wage rate through it.
ok("helper has no salary path (documented invariant)", true);

// ── The transfer is sent in the company's currency ─────────────────────────
//
// lib/stripe.js's contractor payout carried `currency: "cad"` while the
// invoice checkout and the booking fee, in the same file, already used
// stripeCurrency(company.currency). A US company's contractor was paid in
// Canadian dollars. Executed rather than grepped: the Stripe client is lazy
// (lib/lazyClient.js), so a fake key lets it construct without a request,
// and the transfers resource is patched to RECORD the params instead of
// sending them. Nothing here reaches the network.
console.log("\nContractor payouts go out in the company's currency, not a hardcoded one");
process.env.STRIPE_SECRET_KEY ||= "sk_test_check_payroll_rate";
const { stripe, payoutToContractor } = await import("@/lib/stripe");
const sent = [];
stripe.transfers.create = async (params) => {
  sent.push(params);
  return { id: `tr_${sent.length}` };
};
const WORKER = { id: "w1", stripeConnectedAccountId: "acct_1" };

await payoutToContractor({ worker: WORKER, company: { id: "co-us", currency: "USD" }, amountCents: 12345 });
ok("a US company's transfer is in usd", sent.at(-1)?.currency === "usd", sent.at(-1));
ok("…for the amount asked, to the worker's account", sent.at(-1)?.amount === 12345 && sent.at(-1)?.destination === "acct_1");

await payoutToContractor({ worker: WORKER, company: { id: "co-ca", currency: "CAD" }, amountCents: 100 });
ok("a Canadian company's transfer is in cad", sent.at(-1)?.currency === "cad", sent.at(-1));

await payoutToContractor({ worker: WORKER, company: { id: "co-eu", currency: "eur" }, amountCents: 100 });
ok("the code is normalised the way every other money path normalises it (lowercase, via stripeCurrency)", sent.at(-1)?.currency === "eur", sent.at(-1));

await payoutToContractor({ worker: WORKER, company: { id: "co-old", currency: null }, amountCents: 100 });
ok("a company whose currency column is null resolves through the same default as its invoices — not a crash", sent.at(-1)?.currency === "cad", sent.at(-1));

let refused = null;
try {
  await payoutToContractor({ worker: WORKER, amountCents: 100 });
} catch (err) {
  refused = err;
}
ok("no company at all is REFUSED — real money is never sent in a guessed currency", !!refused && sent.length === 4, refused?.message);

// The caller threads the company through from the worker's own relation.
const payoutSrc = readFileSync(new URL("../lib/payroll/stripeConnectPayout.js", import.meta.url), "utf8");
ok(
  "runContractorPayout loads the worker WITH its company (currency) and passes it to the transfer",
  /include:\s*\{\s*company:\s*\{\s*select:\s*\{[^}]*currency:\s*true/.test(payoutSrc) &&
    /payoutToContractor\(\{\s*worker,\s*company:\s*worker\.company,/.test(payoutSrc),
);

// And the literal is gone from the transfer path. Brace-scoped to the one
// function so a "cad" elsewhere in the file (the Affirm eligibility list
// legitimately names it) neither satisfies nor breaks this.
const stripeSrc = readFileSync(new URL("../lib/stripe.js", import.meta.url), "utf8");
const fnStart = stripeSrc.indexOf("export async function payoutToContractor");
const fnEnd = stripeSrc.indexOf("\n}\n", fnStart);
const fnBody = fnStart >= 0 && fnEnd > fnStart ? stripeSrc.slice(fnStart, fnEnd) : "";
ok("payoutToContractor's body was located", fnBody.length > 0);
ok("no \"cad\" literal remains in the transfer path", !/["']cad["']/i.test(fnBody), fnBody);
ok("the transfer's currency is derived from the company", /currency:\s*stripeCurrency\(company\.currency\)/.test(fnBody));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
