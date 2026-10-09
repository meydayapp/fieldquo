// scripts/check-request-pay-checkout.mjs
//
//   npm run check:request-pay-checkout
//
// ── What this proves (2026-10-09) ───────────────────────────────────────────
//
// The owner's goal: after "Request Payment → A different amount → $6,500" on
// Maureen Faulkner's invoice, the checkout she reaches charges $6,500 — not
// the full balance, not the next stage — and is built so financing can
// appear on it. scripts/check-payment-request.mjs proves the FIGURE
// (resolvePortalCharge); nothing executed the last step, where the figure
// becomes a Stripe Checkout Session. This runs the SHIPPED pay route
// (POST /api/portal/[token]/pay) against an in-memory tenant shaped like
// hers and a scripted Stripe client, and reads the session params:
//
//   - unit_amount is 650000 (the open request), with a body that also tries
//     to send an amount (ignored — non-negotiable #5);
//   - the session uses the financing-ALLOWED payment-method configuration
//     (offerFinancing on) and Dynamic Payment Methods — no hard-coded method
//     list, so Stripe offers whatever financing the account has for THAT
//     amount (the owner's screen: Card, Klarna, Apple Pay at CA$6,500;
//     Affirm declined by Stripe — rejected.unsupported_business);
//   - without the request id, the balance; with a spent request, the balance;
//   - $6,500 CAD is inside Affirm's published CAD bounds, and affirmOffered
//     stays false while Stripe has Affirm inactive.
import { register } from "node:module";

let pass = 0;
const failures = [];
const check = (label, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}${detail ? `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`); }
};

const HOOKS = `
const STUBS = { "@/lib/db": "fq-stub:db", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") return { format: "module", shortCircuit: true,
    source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] }); export default db;" };
  if (url === "fq-stub:next") return { format: "module", shortCircuit: true,
    source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

// A placeholder so the lazy client constructs; every call it would make is
// scripted below — nothing reaches Stripe.
process.env.STRIPE_SECRET_KEY = "sk_test_check_request_pay_checkout";
process.env.STRIPE_INVOICE_PMC_FINANCING_OFF = "pmc_testfinancingoff";
process.env.STRIPE_INVOICE_PMC_FINANCING_ALLOWED = "pmc_testfinancingallowed";
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.example.test";

const clone = (x) => JSON.parse(JSON.stringify(x));
const TOTAL = 892_700; // $8,927.00 — any balance above the request will do
function tenant() {
  return {
    company: [{
      id: "co_tf", name: "TrueFinish", currency: "CAD", country: "CA", isDemo: false,
      stripeAccountId: "acct_truefinish", stripeChargesEnabled: true, stripeBankDebitEnabled: false,
      offerFinancing: true, stripeAffirmStatus: "inactive", paymentMethods: [], language: "en",
    }],
    client: [{ id: "c_maureen", companyId: "co_tf", name: "Maureen Faulkner", email: "maureen@example.test", portalToken: "tok_maureen", language: "en" }],
    invoice: [{
      id: "inv22", companyId: "co_tf", clientId: "c_maureen", invoiceNumber: "INV-2026-0022", status: "sent",
      sentAt: "2026-10-07T12:00:00Z", total: TOTAL / 100, amountPaid: 0, parentInvoiceId: null, language: "en",
    }],
    invoicePaymentRequest: [{ id: "req_6500", companyId: "co_tf", invoiceId: "inv22", amountCents: 650_000, paidCentsAtRequest: 0, status: "open" }],
    jobPaymentStage: [],
    payment: [],
  };
}
let T = tenant();

function matches(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    if (k === "AND" || k === "NOT") continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if ("not" in v) { if ((row[k] ?? null) === v.not) return false; continue; }
      if ("in" in v) { if (!v.in.includes(row[k])) return false; continue; }
      continue;
    }
    if (v === undefined) continue;
    if ((row[k] ?? null) !== v) return false;
  }
  return true;
}
function table(name) {
  const rows = () => (T[name] ||= []);
  const withInc = (r, args) => {
    if (!r) return null;
    const out = clone(r);
    if (args?.include?.client) out.client = clone(T.client.find((c) => c.id === r.clientId) || null);
    return out;
  };
  return {
    async findFirst(args = {}) { return withInc(rows().find((r) => matches(r, args.where)), args); },
    async findUnique(args = {}) { return withInc(rows().find((r) => matches(r, args.where)), args); },
    async findMany(args = {}) { return rows().filter((r) => matches(r, args.where)).map((r) => withInc(r, args)); },
    async count(args = {}) { return rows().filter((r) => matches(r, args.where)).length; },
    async aggregate() { return { _sum: { amount: 0, amountCents: 0 }, _count: { _all: 0 } }; },
    async groupBy() { return []; },
    async update({ where, data }) { const r = rows().find((x) => x.id === where.id); if (r) Object.assign(r, data); return clone(r); },
    async updateMany() { return { count: 0 }; },
    async create({ data }) { rows().push(clone(data)); return clone(data); },
  };
}
const db = new Proxy({}, {
  get(_t, name) {
    if (name === "$transaction") return async (fn) => (typeof fn === "function" ? fn(db) : Promise.all(fn));
    if (name === "$queryRaw" || name === "$executeRaw") return async () => [];
    return table(name);
  },
});
globalThis.__FQ_DB = db;

const stripeLib = await import("@/lib/stripe.js");
const captured = [];
stripeLib.stripe.checkout.sessions.create = async (params, opts) => {
  captured.push({ params, opts });
  return { id: `cs_${captured.length}`, url: "https://checkout.stripe.com/c/pay/cs_test" };
};
const pay = await import("@/app/api/portal/[token]/pay/route.js");
const affirm = await import("@/lib/stripe/affirm.js");

const post = (body) =>
  pay.POST(
    { url: "https://app.example.test/api/portal/tok_maureen/pay", headers: new Headers({ host: "app.example.test" }), json: async () => body },
    { params: Promise.resolve({ token: "tok_maureen" }) },
  );

console.log("\nMaureen's link: /portal/tok_maureen/invoices/inv22?request=req_6500 → Pay\n");
captured.length = 0;
let res = await post({ invoiceId: "inv22", requestId: "req_6500", method: "card", amount: 1, amountCents: 1 });
check("200 with a Stripe checkout URL", res.status === 200 && /checkout\.stripe\.com/.test(res.body?.checkoutUrl || ""), res.body);
const s = captured[0]?.params;
check("exactly one Checkout Session created", captured.length === 1);
check("it charges the REQUEST: unit_amount 650000 ($6,500.00)", s?.line_items?.[0]?.price_data?.unit_amount === 650_000, s?.line_items);
check("…in CAD", s?.line_items?.[0]?.price_data?.currency === "cad");
check("…and the body's own amount (1 cent) was ignored", s?.line_items?.[0]?.price_data?.unit_amount !== 1);
check("financing ON: the financing-ALLOWED payment-method configuration", s?.payment_method_configuration === "pmc_testfinancingallowed", s?.payment_method_configuration);
check("Dynamic Payment Methods: no hard-coded payment_method_types — Stripe offers what the account has for THIS amount", s && !("payment_method_types" in s));
check("the contractor is the settlement merchant (on_behalf_of) and the destination",
  s?.payment_intent_data?.on_behalf_of === "acct_truefinish" && s?.payment_intent_data?.transfer_data?.destination === "acct_truefinish");
const { processingFeeCents } = await import("@/lib/stripe/processingFee.js");
const feeOn6500 = processingFeeCents({ amountCents: 650_000, currency: "cad", method: "card" });
check(`the fee estimate is on $6,500 (${feeOn6500}¢), not the balance (${processingFeeCents({ amountCents: TOTAL, currency: "cad", method: "card" })}¢)`,
  s?.payment_intent_data?.metadata?.fq_fee_estimate_cents === String(feeOn6500), s?.payment_intent_data?.metadata);

console.log("\nThe other figures\n");
captured.length = 0;
res = await post({ invoiceId: "inv22", method: "card" });
check("no request id → the whole balance ($8,927.00)", captured[0]?.params?.line_items?.[0]?.price_data?.unit_amount === TOTAL);
captured.length = 0;
res = await post({ invoiceId: "inv22", requestId: "req_not_hers", method: "card" });
check("a request id that isn't this invoice's → the balance, never someone else's figure", captured[0]?.params?.line_items?.[0]?.price_data?.unit_amount === TOTAL);
T.invoicePaymentRequest[0].status = "paid";
captured.length = 0;
res = await post({ invoiceId: "inv22", requestId: "req_6500", method: "card" });
check("a spent request → the balance", captured[0]?.params?.line_items?.[0]?.price_data?.unit_amount === TOTAL);
T = tenant();

console.log("\nAffirm, specifically\n");
check("$6,500 CAD is inside Affirm's CAD bounds ($50–$30,000; monthly instalments CAD 100–30,000)",
  affirm.affirmAmountEligible({ amountCents: 650_000, currency: "cad" }));
check("while Stripe has Affirm INACTIVE (TrueFinish today) it is not offered by us", !affirm.affirmOffered({ company: T.company[0], amountCents: 650_000, currency: "cad" }));
check("once Stripe activates it, $6,500 qualifies", affirm.affirmOffered({ company: { ...T.company[0], stripeAffirmStatus: "active" }, amountCents: 650_000, currency: "cad" }));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
