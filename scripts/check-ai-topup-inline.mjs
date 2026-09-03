// scripts/check-ai-topup-inline.mjs
//
// Buying AI credit from inside the thing that just refused you.
//
//   npm run check:ai-topup-inline
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// lib/voice/spendGate.js computed the price, the balance and the exact
// shortfall. app/api/designer/generate/route.js put all three in a 402. The
// designer's sidebars rendered the sentence and threw the numbers away, so a
// contractor who opened the AI panel with an empty wallet was told to the cent
// what he was short and given nowhere to pay it. A refusal that is correct and
// inescapable is the same failure as a dead button with the label swapped.
//
// ══ What is asserted, and why each one is executed rather than read ════════
//
//   1. THE OFFER IS NEVER LESS THAN ENOUGH. A dialog that offers $10 against a
//      $12 shortfall produces a payment, a redirect, and a button that is
//      still disabled — which reads as the top-up having failed. Checked
//      exhaustively across every shortfall from a cent to past the top tier,
//      because "the smallest one that covers it" is an off-by-one away from
//      "the smallest one".
//   2. THE BROWSER IS NEVER TOLD A PRICE AND CANNOT SEND ONE. AGENTS.md
//      non-negotiable #5. The public offer is scanned for any amount-shaped
//      field, and the route is called with one to prove it REFUSES rather than
//      ignores — an ignored parameter and a used one look identical on the
//      wire.
//   3. A DEMO NEVER REACHES STRIPE. The Stripe stub throws on every property,
//      so "no call" is a fact rather than a count that could be zero because
//      nothing ran.
//   4. NOBODY IS SHOWN A CONTROL THAT WOULD FAIL. Buying needs "user:manage"
//      and generating does not, so a crew member can reach the refusal and not
//      the purchase. And nothing anywhere attempts an off-session charge
//      against the subscription's saved card — see section 4 for why that is
//      the honest path and not a missing feature.
//   5. A DOUBLE CONFIRM CREDITS ONCE. Two returns, a return plus a webhook, a
//      React double-effect — all of them settle through creditAiTopup against
//      a ledger that enforces the real unique (companyId, ref) index.
//   6. THE UI NEVER CLAIMS CREDIT THAT HAS NOT LANDED. A session Stripe has
//      accepted but not settled leaves the balance where it was, and the
//      confirm reports that rather than reporting a payment.
//   7. A COMPANY THAT CAN AFFORD IT IS NEVER OFFERED A TOP-UP. An offer
//      attached to an `ok` verdict is an upsell in a refusal dialog.
//
// ══ NO DATABASE, NO STRIPE, NO NETWORK ═════════════════════════════════════
//
// The real route handlers, the real adapter, the real spend gate, the real
// ledger arithmetic and the real permission table all run. Only the four
// things that need a secret or a socket are stubbed — Prisma, Stripe, the
// Stripe customer lookup, and the activity log — and the Prisma stub enforces
// the unique (companyId, ref) index rather than pretending to, because that
// index is the entire idempotency argument.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let fail = 0;
let passed = 0;
function ok(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail === undefined ? "" : `  — ${detail}`}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

/**
 * The body of ONE named function, by brace matching from its signature.
 *
 * Every source assertion below is scoped through this. A bare `src.includes()`
 * passes as soon as the string appears anywhere in a file — including inside
 * the comment explaining the bug — which is how a check comes to certify the
 * thing it was written to catch.
 */
function fnBody(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) return null;

  // The parameter list has to be skipped by matching PARENTHESES first. Every
  // function here destructures its arguments, so the first "{" after the name
  // opens the parameter object, not the body — a brace matcher that starts
  // there returns the arguments and every assertion against it fails while
  // looking like the code is wrong. That is not hypothetical; it is what the
  // first run of this check did.
  const paren = src.indexOf("(", start);
  if (paren === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return null;

  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// The stub world
// ═══════════════════════════════════════════════════════════════════════════

/** The ledger, with the real unique (companyId, ref) index. */
globalThis.__FQ_LEDGER = [];
let ledgerSeq = 0;

const voiceCreditEntry = {
  async create({ data }) {
    if (
      data.ref &&
      globalThis.__FQ_LEDGER.some((r) => r.companyId === data.companyId && r.ref === data.ref)
    ) {
      // Exactly what Postgres raises, because writeEntry() in credits.js
      // catches P2002 specifically and treats it as success. A stub that
      // silently skipped the insert would let a broken catch pass.
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }
    const row = { id: `e${++ledgerSeq}`, ...data };
    globalThis.__FQ_LEDGER.push(row);
    return row;
  },
  async findFirst({ where }) {
    return (
      globalThis.__FQ_LEDGER.find((r) => {
        if (where.companyId && r.companyId !== where.companyId) return false;
        if (where.OR) {
          return where.OR.some((c) =>
            Object.entries(c).every(([k, v]) => v != null && r[k] === v),
          );
        }
        return Object.entries(where)
          .filter(([k]) => k !== "companyId")
          .every(([k, v]) => r[k] === v);
      }) || null
    );
  },
  async aggregate({ where }) {
    const sum = globalThis.__FQ_LEDGER.filter(
      (r) => r.companyId === where.companyId && r.pool === where.pool,
    ).reduce((s, r) => s + r.cents, 0);
    return { _sum: { cents: sum } };
  },
};

globalThis.__FQ_COMPANIES = [];
const company = {
  async findUnique({ where }) {
    return globalThis.__FQ_COMPANIES.find((c) => c.id === where.id) || null;
  },
};

globalThis.__FQ_DB = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop !== "string" || prop.startsWith("$") || prop === "then") return undefined;
      if (prop === "voiceCreditEntry") return voiceCreditEntry;
      if (prop === "company") return company;
      throw new Error(`dbStub: db.${prop} is not scripted in this check`);
    },
  },
);

/**
 * Stripe, as a tripwire.
 *
 * Every property throws unless the test being run has explicitly armed it.
 * "The demo made no Stripe call" is then a fact about what would have happened
 * rather than a counter that reads zero because the code path never ran.
 */
globalThis.__FQ_STRIPE_CALLS = [];
globalThis.__FQ_STRIPE_SESSION = null;
globalThis.__FQ_STRIPE_ALLOW = false;

globalThis.__FQ_STRIPE = {
  checkout: {
    sessions: {
      async create(params) {
        // RECORDED FIRST, then refused. Throwing before the push would let
        // "no Stripe call at all" pass on a mutation that DID call Stripe and
        // was only stopped by the tripwire — the assertion would be measuring
        // its own stub instead of the code.
        globalThis.__FQ_STRIPE_CALLS.push({ op: "sessions.create", params });
        if (!globalThis.__FQ_STRIPE_ALLOW) throw new Error("Stripe was called and must not be");
        return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
      },
      async retrieve(id) {
        globalThis.__FQ_STRIPE_CALLS.push({ op: "sessions.retrieve", id });
        if (!globalThis.__FQ_STRIPE_SESSION) throw new Error("no session");
        return globalThis.__FQ_STRIPE_SESSION;
      },
    },
  },
  // Named explicitly rather than left off: touching it is the exact edit that
  // would turn this flow into an off-session charge against the subscription's
  // card, and it must fail loudly rather than be undefined.
  paymentIntents: {
    create() {
      throw new Error(
        "paymentIntents.create — an off-session charge against a card saved for the subscription",
      );
    },
  },
};

globalThis.__FQ_MEMBER = null;
globalThis.__FQ_FEATURE_AVAILABLE = true;

const HOOKS = `
const STUBS = {
  "next/server": "fq:next",
  "@/lib/db": "fq:db",
  "@/lib/stripe": "fq:stripe",
  "@/lib/apiMember": "fq:member",
  "@/lib/platform/stripeBilling": "fq:billing",
  "@/lib/activity/log": "fq:activity",
  "@/lib/features/gate": "fq:gate",
  "@/lib/ai/images": "fq:images",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
const SOURCE = {
  "fq:next": "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };",
  "fq:db": "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
  "fq:stripe": "export const stripe = new Proxy({}, { get: (_t, p) => globalThis.__FQ_STRIPE[p] });",
  "fq:member": "export const memberOrRefusalPlain = async () => globalThis.__FQ_MEMBER; export const memberOrRefusal = async () => globalThis.__FQ_MEMBER;",
  "fq:billing": "export const getOrCreateStripeCustomer = async (c) => 'cus_' + c.id;",
  "fq:activity": "export const recordActivity = async () => {};",
  "fq:gate": "export const featureAllowsSpend = async () => globalThis.__FQ_FEATURE_AVAILABLE;",
  "fq:images": "export const generateMarketingImage = async () => { throw new Error('vendor must not be reached'); };",
};
export async function load(url, context, nextLoad) {
  if (SOURCE[url]) return { format: "module", shortCircuit: true, source: SOURCE[url] };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { TOPUP_OPTIONS, POOLS, balanceFor } = await import("@/lib/voice/credits");
const { can } = await import("@/lib/permissions");
const {
  AI_TOPUP_TIERS,
  tierCentsFor,
  recommendedTierId,
  publicTopupOffer,
  bodyNamesAnAmount,
  safeReturnPath,
} = await import("@/lib/ai/topupOffer");
const { statusForCompany, requestAiImage } = await import("@/lib/designer/aiImageAdapter");
const { creditAiTopup } = await import("@/lib/ai/topup");
const inlineRoute = await import("@/app/api/ai/topup/route");
const settingsRoute = await import("@/app/api/settings/ai/topup/route");

const CO = "co_1";

/** A request the real getAppOrigin() can read a host off. */
function makeRequest({ url = "http://x/api/ai/topup", body } = {}) {
  return {
    url,
    headers: { get: (k) => (k === "host" ? "localhost:3000" : null) },
    json: async () => body ?? {},
  };
}

function reset({ isDemo = false, aiCents = 0, role = "owner" } = {}) {
  globalThis.__FQ_LEDGER = [];
  ledgerSeq = 0;
  globalThis.__FQ_COMPANIES = [{ id: CO, name: "Acme Painting", isDemo }];
  globalThis.__FQ_STRIPE_CALLS = [];
  globalThis.__FQ_STRIPE_SESSION = null;
  globalThis.__FQ_STRIPE_ALLOW = false;
  globalThis.__FQ_FEATURE_AVAILABLE = true;
  globalThis.__FQ_MEMBER = { member: { id: "m1", companyId: CO, role } };
  if (aiCents) {
    globalThis.__FQ_LEDGER.push({
      id: `e${++ledgerSeq}`,
      companyId: CO,
      cents: aiCents,
      kind: "ai_topup",
      pool: POOLS.AI,
      ref: "seed",
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("0. The floor everything below stands on");
// A price list re-typed here would let the offer and the charge drift apart
// silently, so the tiers are read off the SAME constant the settings page and
// the auto-top-up terms use.

ok(
  "the tiers are the real TOPUP_OPTIONS, in order",
  JSON.stringify(AI_TOPUP_TIERS.map((t) => t.cents)) ===
    JSON.stringify(TOPUP_OPTIONS.map((t) => t.cents)),
  JSON.stringify(AI_TOPUP_TIERS),
);
ok("every tier id resolves back to its amount", AI_TOPUP_TIERS.every((t) => tierCentsFor(t.id) === t.cents));
ok("an unknown tier id is null, not a default", tierCentsFor("topup_1") === null && tierCentsFor(undefined) === null);
ok("generating does not need user:manage, buying does", can("employee", "user:manage") === false);
ok("an owner may buy", can("owner", "user:manage") === true);

// ═══════════════════════════════════════════════════════════════════════════
section("1. A 402 with a shortfall — the offer is never less than enough");

const biggest = Math.max(...AI_TOPUP_TIERS.map((t) => t.cents));
let tooSmall = 0;
let notSmallest = 0;
for (let shortfall = 1; shortfall <= biggest + 5000; shortfall += 1) {
  const cents = tierCentsFor(recommendedTierId(shortfall));
  if (shortfall <= biggest) {
    if (cents < shortfall) tooSmall++;
    // The SMALLEST that covers it — offering $100 for a 4¢ shortfall is a
    // different kind of dishonest.
    const smallest = Math.min(...AI_TOPUP_TIERS.filter((t) => t.cents >= shortfall).map((t) => t.cents));
    if (cents !== smallest) notSmallest++;
  } else if (cents !== biggest) {
    tooSmall++;
  }
}
ok(`no shortfall from 1¢ to $${(biggest + 5000) / 100} gets an offer that is too small`, tooSmall === 0, `${tooSmall} bad`);
ok("and it is always the smallest tier that covers it", notSmallest === 0, `${notSmallest} oversized`);

{
  const offer = publicTopupOffer(1234, true);
  const short = offer.tiers.filter((t) => !t.covers).map((t) => t.label);
  ok(
    "tiers that cannot cover the shortfall are flagged, not hidden",
    short.length > 0 && offer.tiers.length === AI_TOPUP_TIERS.length,
    JSON.stringify(short),
  );
  ok(
    "a shortfall past the top tier still offers the top tier, marked as not enough",
    (() => {
      const o = publicTopupOffer(biggest + 1, true);
      return o.recommendedId === `topup_${biggest}` && o.tiers.every((t) => t.covers === false);
    })(),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The browser is never told a price, and cannot send one");

{
  const payload = JSON.stringify(publicTopupOffer(4, true));
  ok(
    "the public offer carries no amount-shaped field",
    !/"(cents|amount|amountCents|unit_amount|price)"/.test(payload),
    payload,
  );
  ok(
    "…and no bare number that equals a tier price",
    !AI_TOPUP_TIERS.some((t) => payload.includes(`:${t.cents}`)),
    payload,
  );
}

ok("a body naming cents is recognised", bodyNamesAnAmount({ tierId: "topup_1000", cents: 1 }) === true);
ok("…including a zero or null one — the shape is what is refused", bodyNamesAnAmount({ cents: 0 }) === true && bodyNamesAnAmount({ amount: null }) === true);
ok("a clean body is not", bodyNamesAnAmount({ tierId: "topup_1000", returnTo: "/app/x" }) === false);

{
  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  const res = await inlineRoute.POST(makeRequest({ body: { tierId: "topup_1000", cents: 1 } }));
  ok("the route REFUSES a body that names its own amount", res.status === 400 && res.body.reason === "amount_from_client", JSON.stringify(res.body));
  ok("…and reached no Stripe and wrote no ledger row", globalThis.__FQ_STRIPE_CALLS.length === 0 && globalThis.__FQ_LEDGER.length === 0);
}

{
  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  const res = await inlineRoute.POST(makeRequest({ body: { cents: 5000 } }));
  ok("an amount with no tier at all is refused the same way", res.status === 400 && res.body.reason === "amount_from_client");
}

{
  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  const res = await inlineRoute.POST(makeRequest({ body: { tierId: "topup_7" } }));
  ok("an invented tier is refused", res.status === 400 && res.body.reason === "bad_tier");
  ok("…with nothing charged", globalThis.__FQ_STRIPE_CALLS.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. A real refusal, end to end — the numbers the dialog opens on");

{
  reset({ aiCents: 0 });
  const status = await statusForCompany(CO, "owner");
  ok("a zero balance refuses for money, with a real shortfall", status.reason === "insufficient_balance" && status.shortfallCents === status.priceCents && status.priceCents > 0, JSON.stringify(status));
  ok("…and the refusal carries an offer", Boolean(status.topup) && status.topup.tiers.length === AI_TOPUP_TIERS.length);
  ok(
    "…whose recommended tier covers the shortfall",
    tierCentsFor(status.topup.recommendedId) >= status.shortfallCents,
  );

  const refusal = await requestAiImage({ companyId: CO, action: "generate", payload: { prompt: "x" }, role: "owner" });
  ok("the POST path refuses identically, and carries the same offer", refusal.ok === false && refusal.reason === "insufficient_balance" && Boolean(refusal.topup));
  ok("…having taken no money on the way", globalThis.__FQ_LEDGER.length === 0);

  // The whole point of the round trip: the tier the dialog would send buys
  // enough to clear the refusal that opened it.
  globalThis.__FQ_STRIPE_ALLOW = true;
  const res = await inlineRoute.POST(makeRequest({ body: { tierId: status.topup.recommendedId, returnTo: "/app/marketing/designer/abc" } }));
  const params = globalThis.__FQ_STRIPE_CALLS[0].params;
  ok("the server prices the tier itself", params.line_items[0].price_data.unit_amount === tierCentsFor(status.topup.recommendedId));
  ok("…and it is more than the shortfall it was offered for", params.line_items[0].price_data.unit_amount >= status.shortfallCents);
  ok("the checkout URL is handed back", res.status === 200 && typeof res.body.checkoutUrl === "string");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Nobody is shown a control that would fail");

{
  reset({ role: "employee" });
  const status = await statusForCompany(CO, "employee");
  ok("a crew member sees the offer with canBuy false", status.topup?.canBuy === false);
  ok("an owner sees canBuy true", (await statusForCompany(CO, "owner")).topup.canBuy === true);
  ok("no role at all fails closed", publicTopupOffer(4, can(null, "user:manage")).canBuy === false);

  globalThis.__FQ_STRIPE_ALLOW = true;
  const res = await inlineRoute.POST(makeRequest({ body: { tierId: "topup_1000" } }));
  ok("…and the route agrees: a crew member cannot buy", res.status === 403, JSON.stringify(res.body));
  ok("…having reached no Stripe", globalThis.__FQ_STRIPE_CALLS.length === 0);
}

{
  // The dialog only renders its confirm button inside `offer.canBuy`, and only
  // renders the sidebar's "Add AI credit" button when the refusal actually
  // carried an offer. Both are scoped to one brace-matched function so the
  // assertion cannot pass off the back of the comment that explains it.
  const dialog = fnBody(read("app/components/ai/AiCreditTopupDialog.js"), "export function AiCreditTopupDialog(");
  ok("the dialog's confirm button is gated on canBuy", /!outcome && !offer\.standalone && offer\.canBuy && \(\s*<Button/.test(dialog || ""));
  ok("…and an unable buyer is told who can", (dialog || "").includes("app.aiTopup.askOwner"));

  const sidebar = fnBody(read("app/components/designer/AiSidebar.js"), "export function AiSidebar(");
  ok("the sidebar's top-up button only appears where money is the problem", /status\?\.topup && \(/.test(sidebar || ""));
  const removeBg = fnBody(read("app/components/designer/RemoveBgSidebar.js"), "export function RemoveBgSidebar(");
  ok("…and the background-removal panel adopts the same component", /status\?\.topup && \(/.test(removeBg || "") && (removeBg || "").includes("AiCreditTopupDialog"));
}

{
  // ── Why there is no one-click off-session charge ──────────────────────────
  //
  // Stripe: "When you save a payment method, you can only use it for the
  // specific usage you've included in your terms." The subscription's terms
  // named the subscription. lib/platform/stripeBilling.js additionally never
  // passes saved_payment_method_options.payment_method_save, so Stripe saves
  // that card with allow_redisplay: limited and Checkout will not even offer it
  // back on a one-off purchase. Both halves are asserted, because the dialog
  // says both out loud to the contractor.
  const billing = read("lib/platform/stripeBilling.js");
  const trial = fnBody(billing, "export async function createTrialCheckoutSession(");
  const upgrade = fnBody(billing, "export async function createBillingCheckoutSession(");
  ok(
    "subscription checkout does not opt the card into being redisplayed",
    !/saved_payment_method_options/.test(trial || "x") && !/saved_payment_method_options/.test(upgrade || "x"),
  );

  const intent = read("lib/ai/topupIntent.js");
  const start = fnBody(intent, "export async function startAiTopup(");
  ok("startAiTopup opens an on-session payment page", /mode: "payment"/.test(start || ""));
  ok("…and never sets off_session", !/off_session/.test(start || ""));

  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  const res = await inlineRoute.POST(makeRequest({ body: { tierId: "topup_3000" } }));
  ok("…which the Stripe tripwire confirms: no PaymentIntent was ever attempted", res.status === 200 && globalThis.__FQ_STRIPE_CALLS.every((c) => c.op !== "paymentIntents.create"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. A demo company never reaches Stripe");

{
  reset({ isDemo: true });
  // Left disarmed on purpose: the tripwire throws on any Stripe property, so
  // this passing means the demo branch returned before touching it.
  globalThis.__FQ_STRIPE_ALLOW = false;
  const res = await inlineRoute.POST(makeRequest({ body: { tierId: "topup_3000" } }));
  ok("the demo top-up succeeds", res.status === 200 && res.body.simulated === true, JSON.stringify(res.body));
  ok("…with no Stripe call at all", globalThis.__FQ_STRIPE_CALLS.length === 0);
  ok("…crediting the AI wallet, not the phone one", globalThis.__FQ_LEDGER.length === 1 && globalThis.__FQ_LEDGER[0].pool === POOLS.AI);
  ok("…under a kind that names it simulated", globalThis.__FQ_LEDGER[0].kind === "ai_demo_topup");
  ok("…and the balance it reports is the one on the ledger", res.body.balanceCents === (await balanceFor(CO, globalThis.__FQ_DB, POOLS.AI)));

  const status = await statusForCompany(CO, "owner");
  ok("…so the demo can now afford the image it was refused", status.allowed === true && status.topup === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. A double confirm credits once");

const paidSession = (id = "cs_1", intentId = "pi_1", cents = 3000) => ({
  id,
  payment_status: "paid",
  amount_total: cents,
  payment_intent: intentId,
  metadata: { companyId: CO, kind: "ai_topup", cents: String(cents) },
});

{
  reset();
  globalThis.__FQ_STRIPE_SESSION = paidSession();
  const first = await inlineRoute.GET(makeRequest({ url: "http://x/api/ai/topup?session_id=cs_1" }));
  const second = await inlineRoute.GET(makeRequest({ url: "http://x/api/ai/topup?session_id=cs_1" }));

  ok("the first confirm credits", first.status === 200 && first.body.credited === true && first.body.alreadyCredited === false);
  ok("the second says it was already credited", second.status === 200 && second.body.credited === true && second.body.alreadyCredited === true);
  ok("exactly one row on the ledger", globalThis.__FQ_LEDGER.length === 1, JSON.stringify(globalThis.__FQ_LEDGER));
  ok("the balance moved once", (await balanceFor(CO, globalThis.__FQ_DB, POOLS.AI)) === 3000);
}

{
  // The other pair: the browser's return and the webhook, in either order.
  reset();
  globalThis.__FQ_STRIPE_SESSION = paidSession("cs_2", "pi_2");
  await creditAiTopup(paidSession("cs_2", "pi_2")); // webhook first
  const back = await inlineRoute.GET(makeRequest({ url: "http://x/api/ai/topup?session_id=cs_2" }));
  ok("a webhook that beat the redirect leaves one row", globalThis.__FQ_LEDGER.length === 1);
  ok("…and the redirect reports it rather than crediting again", back.body.alreadyCredited === true);

  // And the settings route's GET, which is the same confirmation from the
  // other screen — a person who paid from the dialog and then opened settings.
  const settings = await settingsRoute.GET(makeRequest({ url: "http://x/api/settings/ai/topup?session_id=cs_2" }));
  ok("a third door, the settings page, still credits nothing extra", globalThis.__FQ_LEDGER.length === 1 && settings.body.alreadyCredited === true);
}

{
  reset();
  globalThis.__FQ_STRIPE_SESSION = { ...paidSession("cs_3", "pi_3"), metadata: { companyId: "co_other", kind: "ai_topup" } };
  const res = await inlineRoute.GET(makeRequest({ url: "http://x/api/ai/topup?session_id=cs_3" }));
  ok("somebody else's session is refused", res.status === 403);
  ok("…and credits nobody", globalThis.__FQ_LEDGER.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. A slow webhook — the UI must not claim credit that has not landed");

{
  reset();
  // Stripe has the session and it is not settled. This is what a
  // delayed-notification method looks like between "the customer finished" and
  // "the money arrived".
  globalThis.__FQ_STRIPE_SESSION = { ...paidSession("cs_4", "pi_4"), payment_status: "unpaid" };
  const res = await inlineRoute.GET(makeRequest({ url: "http://x/api/ai/topup?session_id=cs_4" }));

  ok("the confirm reports NOT credited", res.status === 200 && res.body.credited === false, JSON.stringify(res.body));
  ok("…the reason is the payment state, not a generic error", res.body.reason === "unpaid");
  ok("…nothing was written to the ledger", globalThis.__FQ_LEDGER.length === 0);
  ok("…and the balance it reports is still zero", res.body.balanceCents === 0);

  const status = await statusForCompany(CO, "owner");
  ok("…so the button stays refused, which is the honest state", status.allowed === false);

  // The client half of the same rule: the dialog decides on `data.credited`,
  // and calls onCredited — the thing that re-enables the button — only there.
  const src = read("app/components/ai/AiCreditTopupDialog.js");
  const hook = fnBody(src, "export function useAiCreditTopup(");
  ok('the dialog only says "credited" when the server said so', /if \(data\?\.credited\) \{/.test(hook || ""));
  ok("…and shows a not-landed-yet state otherwise", (hook || "").includes('kind: "pending"'));
  ok(
    "…with onCredited called inside the credited branch only",
    (() => {
      const after = (hook || "").split("if (data?.credited) {")[1] || "";
      const elseAt = after.indexOf("} else {");
      if (elseAt <= 0) return false;
      const credited = after.slice(0, elseAt);
      // Brace-matched, not "everything after the else": `onCredited` is also
      // called by the recheck button further down the same function, and a
      // slice to the end of the file would find it there and report a bug
      // that isn't one.
      const rest = after.slice(elseAt + "} else ".length);
      let depth = 0;
      let notCredited = "";
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "{") depth++;
        else if (rest[i] === "}") {
          depth--;
          if (depth === 0) {
            notCredited = rest.slice(0, i + 1);
            break;
          }
        }
      }
      return credited.includes("onCredited?.()") && !notCredited.includes("onCredited?.()");
    })(),
  );
  // Rule 3: paying does not spend again on your behalf.
  ok("…and nothing is auto-submitted on the way back", !/onSubmit\(|generate\(/.test(hook || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. A company that can afford it is never offered a top-up");

{
  reset({ aiCents: 5000 });
  const status = await statusForCompany(CO, "owner");
  ok("an affordable company is allowed", status.allowed === true);
  ok("…and gets no offer at all", status.topup === null, JSON.stringify(status.topup));
  ok("…and no shortfall", status.shortfallCents === 0);

  // The dialog cannot open on it either: `open()` is only reachable from a
  // refusal that carried a `topup`, and both sidebars guard on that.
  const sidebar = fnBody(read("app/components/designer/AiSidebar.js"), "export function AiSidebar(");
  ok("the 402 branch requires an offer before opening the dialog", /res\.status === 402 && data\?\.topup/.test(sidebar || ""));
}

{
  // The other half of "never offer money as the answer to a problem money
  // cannot fix".
  reset();
  globalThis.__FQ_FEATURE_AVAILABLE = false;
  const status = await statusForCompany(CO, "owner");
  ok("a withdrawn feature refuses without an offer", status.reason === "feature_unavailable" && status.topup === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Coming back to the canvas, not to somebody else's domain");

const HOSTILE = [
  "//evil.com",
  "https://evil.com",
  "/app/../platform/companies",
  "/platform/companies",
  "/app/marketing/designer/abc?aitopup=cs_evil",
  "/app/marketing\\designer",
  "/appsomething",
  "",
  null,
  undefined,
  42,
  "/app/" + "a".repeat(300),
];
ok(
  "every hostile return path is refused",
  HOSTILE.every((p) => safeReturnPath(p) === null),
  JSON.stringify(HOSTILE.filter((p) => safeReturnPath(p) !== null)),
);
ok("a real designer path survives", safeReturnPath("/app/marketing/designer/clx123abc") === "/app/marketing/designer/clx123abc");

{
  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  await inlineRoute.POST(makeRequest({ body: { tierId: "topup_1000", returnTo: "/app/marketing/designer/abc" } }));
  const p = globalThis.__FQ_STRIPE_CALLS[0].params;
  ok("the success URL comes back to the design", p.success_url === "http://localhost:3000/app/marketing/designer/abc?aitopup={CHECKOUT_SESSION_ID}");
  ok("…with exactly one query string", (p.success_url.match(/\?/g) || []).length === 1);
  ok("the cancel URL comes back to the same place", p.cancel_url === "http://localhost:3000/app/marketing/designer/abc");
}

{
  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  await inlineRoute.POST(makeRequest({ body: { tierId: "topup_1000", returnTo: "https://evil.com/x" } }));
  const p = globalThis.__FQ_STRIPE_CALLS[0].params;
  ok("a rejected return path falls back to the credit page rather than refusing the purchase", p.success_url.startsWith("http://localhost:3000/app/settings/ai-credit?"));
  ok("…and never reaches the attacker's host", !p.success_url.includes("evil.com") && !p.cancel_url.includes("evil.com"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The settings route still sends Stripe exactly what it used to");
// The Checkout session moved out of app/api/settings/ai/topup/route.js into
// lib/ai/topupIntent.js so the dialog could share it. A refactor on a money
// path is only safe if the bytes on the wire are identical, so this is an md5
// of the serialised parameters against the shape that route built inline
// before the move — not a re-reading of the new code.

{
  reset();
  globalThis.__FQ_STRIPE_ALLOW = true;
  await settingsRoute.POST(makeRequest({ url: "http://x/api/settings/ai/topup", body: { cents: 3000 } }));
  const sent = globalThis.__FQ_STRIPE_CALLS[0].params;

  const expected = {
    mode: "payment",
    customer: `cus_${CO}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "FieldQuo — AI credit top-up" },
          unit_amount: 3000,
        },
        quantity: 1,
      },
    ],
    metadata: { companyId: CO, kind: "ai_topup", cents: "3000" },
    success_url: "http://localhost:3000/app/settings/ai-credit?aitopup={CHECKOUT_SESSION_ID}",
    cancel_url: "http://localhost:3000/app/settings/ai-credit",
  };
  const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
  ok("byte-identical Checkout parameters", md5(sent) === md5(expected), `\n    sent:     ${JSON.stringify(sent)}\n    expected: ${JSON.stringify(expected)}`);
}

{
  reset({ isDemo: true });
  globalThis.__FQ_STRIPE_ALLOW = false;
  const res = await settingsRoute.POST(makeRequest({ url: "http://x/api/settings/ai/topup", body: { cents: 3000 } }));
  ok("the settings page's demo branch still returns a local URL to navigate to", res.body.simulated === true && res.body.checkoutUrl.endsWith("/app/settings/ai-credit?demo_topup=1"));
  ok("…and still credits the AI wallet", globalThis.__FQ_LEDGER.length === 1 && globalThis.__FQ_LEDGER[0].pool === POOLS.AI);
}

{
  reset();
  const res = await settingsRoute.POST(makeRequest({ url: "http://x/api/settings/ai/topup", body: { cents: 1 } }));
  ok("a below-floor custom amount is still refused there", res.status === 400);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${fail} failed.\n`);
process.exitCode = fail ? 1 : 0;
