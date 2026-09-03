// scripts/check-plan-sellability.mjs
//
// What a plan actually needs in order to be bought, and the promise that no
// screen says otherwise.
//
//   npm run check:plan-sellability
//
// ══ The warning that cried wolf ════════════════════════════════════════════
//
// /platform/billing/plans printed two sentences on EVERY plan card:
//
//   "No Stripe price ID — checkout will fail"
//   "Annual price with no Stripe ID — annual checkout will fail"
//
// Both were false, on every plan the product has ever had. Neither checkout
// builder has looked a Stripe Price up by id since lib/platform/
// stripeBilling.js moved to inline `price_data` (its header, point 2) — it
// builds the line from Plan.priceMonthly / Plan.priceAnnual, exactly as the
// trial checkout already did, *because* requiring the id made "Choose Plan"
// 500 for every plan and permanently for custom tiers. All four production
// plans carry a null id and all four sell, monthly and annually.
//
// A warning that is always wrong is worse than no warning: it teaches the
// owner to skip the line that matters. And the same wrong sentence had spread
// to three more places — the plan-creation audit log recorded every plan it
// ever created as `sellable: false`, the public /api/marketing/plans alert
// told an operator to go and look in a Stripe dashboard, and the form hint
// under the field said checkout could not bill without it.
//
// ══ What is actually true ══════════════════════════════════════════════════
//
//   sellable monthly  = isPublic !== false  AND  priceMonthly is a finite
//                       number > 0
//   sellable annually = the same, with priceAnnual
//   stripePriceId     = irrelevant to both. It is a REVERSE lookup key:
//                       recoverPlanId() maps a Stripe subscription back to a
//                       Plan row when a checkout session carries no planId.
//
// The `> 0` half is not pedantry and it is where the real gap was. Plan.
// priceMonthly defaults to 0 in the schema and lib/billing/planFields.js only
// refuses NEGATIVE prices, so "save the new plan, then type the price" made a
// $0 row — which the OLD isSellable (`price >= 0`) called sellable, which the
// public pricing page therefore advertised, and which threw inside
// recurringLine() the moment anybody pressed the button. The console warned
// about a Stripe id that did not matter and said nothing about the blank price
// that did.
//
// ══ Why these assertions are executed and not read ═════════════════════════
//
// The sentence each card prints is derived by planStatus() in
// lib/platform/sellablePlans.js rather than written beside the card, precisely
// so it can be RUN here against the five plan shapes that exist. A regex over
// the JSX would have passed just as happily on the false version.
//
// The source scans at the end cover the two things no fixture can reach: that
// the card renders the derived line rather than a fourth hand-rolled opinion,
// and that /api/companies still refuses a plan it cannot bill BEFORE it
// creates a company row.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  isSellable,
  isSellableAnnually,
  planStatus,
  partitionPlans,
  withheldReasons,
} from "@/lib/platform/sellablePlans";
import { chargeFor, supportsInterval } from "@/lib/billing/interval";

let pass = 0;
const fails = [];
const ok = (label, fn) => {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    fails.push(`${label} — ${err.message}`);
  }
};

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/**
 * Source with comments removed.
 *
 * Mandatory here, not tidiness: every file this checks EXPLAINS the false
 * warning it no longer prints, quoting it in full. A scan for "checkout will
 * fail" matches the prose that says the sentence was wrong.
 */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

/**
 * One brace-matched function body, so a string rule cannot pass on a match
 * somewhere else in the file.
 *
 * The rules below are about what the CARD renders and what the signup POST
 * does in what order. /platform/billing/plans/page.js is 700 lines with an
 * editor form, a header and a grid in it; "the file mentions planStatus"
 * proves nothing about the card. Comments are already stripped, so brace
 * counting is safe against the /* *​/ blocks that describe braces.
 *
 * A signature ending in "(" has its PARAMETER list skipped first. Every
 * function here destructures its arguments — `function PlanCard({ plan: p })`
 * — so "the next {" is the parameter object, and matching from there returns a
 * 28-character body that every string rule then passes on vacuously. The
 * length floor below is what caught that, and it stays as the tripwire.
 */
function body(src, signature) {
  const at = src.indexOf(signature);
  assert.ok(at >= 0, `couldn't find \`${signature}\` — the check is stale`);

  let from = at + signature.length;
  if (signature.endsWith("(")) {
    let depth = 1;
    let i = from;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    assert.ok(depth === 0, `\`${signature}\` has an unclosed parameter list`);
    from = i;
  }

  const open = src.indexOf("{", from);
  assert.ok(open >= 0, `\`${signature}\` has no body`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        const out = src.slice(open, i + 1);
        assert.ok(
          out.length > 120,
          `\`${signature}\` matched a body of ${out.length} chars — brace matching went wrong`,
        );
        return out;
      }
    }
  }
  throw new Error(`\`${signature}\` is never closed`);
}

/**
 * "a comes before b", refusing to answer when either is missing.
 *
 * `src.indexOf(a) < src.indexOf(b)` FALSE-PASSES when `a` is absent: -1 is
 * less than everything, so deleting the guard makes the ordering assertion
 * greener. Both halves are asserted present first, and that is the whole
 * reason this is a function rather than a comparison written five times.
 */
function before(src, a, b, what) {
  const i = src.indexOf(a);
  const j = src.indexOf(b);
  assert.ok(i >= 0, `${what}: \`${a}\` is gone`);
  assert.ok(j >= 0, `${what}: \`${b}\` is gone`);
  assert.ok(i < j, `${what}: \`${a}\` no longer comes before \`${b}\``);
}

/* ══ The five plan shapes ═════════════════════════════════════════════════ */

// 1. The shape of every plan in production: no Stripe id, a real price.
const noStripeId = {
  id: "plan_solo_cad",
  name: "Solo",
  tierKey: "solo",
  currency: "CAD",
  priceMonthly: 99,
  priceAnnual: 990,
  stripePriceId: null,
  stripePriceIdAnnual: null,
  isPublic: true,
};

// 2. Saved before the price was typed. Plan.priceMonthly defaults to 0.
const noPrice = {
  id: "plan_blank",
  name: "New tier",
  priceMonthly: 0,
  priceAnnual: null,
  stripePriceId: null,
  isPublic: true,
};

// 3. A real, public, buyable plan that is simply not sold by the year.
const monthlyOnly = {
  id: "plan_starter",
  name: "Starter",
  priceMonthly: 45,
  priceAnnual: null,
  stripePriceId: null,
  stripePriceIdAnnual: null,
  isPublic: true,
};

// 4. Negotiated with one company. Healthy in every other respect — that is
//    the point: nothing about its wiring is wrong, it is simply not on offer.
const negotiated = {
  id: "plan_bespoke",
  name: "Custom (2 employees)",
  priceMonthly: 90,
  priceAnnual: 1080,
  stripePriceId: "price_1BespokeMonthly",
  stripePriceIdAnnual: "price_1BespokeAnnual",
  isPublic: false,
};

// 5. The row an operator produced with the -5 incident, and a row read through
//    a select that omitted the price.
const negative = { ...noPrice, id: "plan_negative", name: "Oops", priceMonthly: -5 };
// isPublic and priceMonthly both absent — not false, not zero. Absent.
const narrowSelect = { id: "plan_narrow", name: "Solo" };

const ALL = [noStripeId, noPrice, monthlyOnly, negotiated, negative, narrowSelect];

/* ══ 1. A Stripe price id decides nothing ═════════════════════════════════ */

console.log("\nA missing Stripe price id does not make a plan unsellable");

ok("the production shape — no id, a real price — is sellable monthly", () => {
  assert.equal(isSellable(noStripeId), true);
});

ok("...and annually, with no annual id either", () => {
  assert.equal(isSellableAnnually(noStripeId), true);
});

ok("adding an id changes nothing, in either direction", () => {
  // The claim under test is that the column is irrelevant, which means it must
  // be irrelevant BOTH ways — a check that only proves "null is fine" would
  // still pass on code that secretly preferred a populated id.
  const withId = { ...noStripeId, stripePriceId: "price_123", stripePriceIdAnnual: "price_456" };
  assert.equal(isSellable(withId), isSellable(noStripeId));
  assert.equal(isSellableAnnually(withId), isSellableAnnually(noStripeId));
  assert.deepEqual(planStatus(withId), planStatus(noStripeId));
});

ok("a plan that HAS both ids is still refused when the price is blank", () => {
  // The inverse of the bug: an id was never sufficient either.
  const idButNoPrice = { ...noPrice, stripePriceId: "price_123", stripePriceIdAnnual: "price_456" };
  assert.equal(isSellable(idButNoPrice), false);
  assert.equal(planStatus(idButNoPrice).code, "no_price");
});

/* ══ 2. What genuinely blocks a sale ══════════════════════════════════════ */

console.log("\nWhat actually stops a plan being bought");

ok("a plan with no price at all is not sellable", () => {
  assert.equal(isSellable(noPrice), false);
  assert.equal(isSellableAnnually(noPrice), false);
});

ok("...because Stripe will not bill 0, and checkout refuses first", () => {
  // The gap the OLD isSellable had: `price >= 0` called this sellable, the
  // pricing page advertised it, and recurringLine() threw at the till.
  assert.equal(chargeFor(noPrice, "month"), null);
  assert.equal(supportsInterval(noPrice, "month"), false);
});

ok("a negative price is refused", () => {
  assert.equal(isSellable(negative), false);
});

ok("a company-negotiated plan is withheld however healthy its wiring", () => {
  assert.equal(isSellable(negotiated), false);
  assert.equal(isSellableAnnually(negotiated), false);
  // It has both Stripe ids and both prices. isPublic is the only reason.
  assert.equal(isSellable({ ...negotiated, isPublic: true }), true);
});

ok("a narrow select that omits isPublic does NOT hide a plan", () => {
  // Deliberate asymmetry: `=== false`, not falsy. A missing column is "not
  // stated", so a caller who forgets to select it empties nothing.
  assert.equal(narrowSelect.isPublic, undefined);
  // ...but it still has no price in this fixture, so it is unsellable for the
  // honest reason.
  assert.equal(planStatus(narrowSelect).code, "no_price");
  assert.equal(isSellable({ ...narrowSelect, priceMonthly: 99 }), true);
});

/* ══ 3. Monthly and annual are separate questions ═════════════════════════ */

console.log("\nThe two cadences, decided separately");

ok("a monthly-priced plan with no annual price sells monthly only", () => {
  assert.equal(isSellable(monthlyOnly), true);
  assert.equal(isSellableAnnually(monthlyOnly), false);
});

ok("...and checkout agrees, refusing the year rather than billing monthly", () => {
  assert.ok(chargeFor(monthlyOnly, "month"));
  assert.equal(chargeFor(monthlyOnly, "year"), null);
});

ok("a zero annual price is 'no annual option', not 'free for a year'", () => {
  assert.equal(isSellableAnnually({ ...monthlyOnly, priceAnnual: 0 }), false);
});

/* ══ 4. The sentence the card prints ══════════════════════════════════════ */

console.log("\nThe one line the plan card is allowed to say");

ok("a sellable production plan is warned about at all", () => {
  const s = planStatus(noStripeId);
  assert.equal(s.code, null, `still warns: ${s.text}`);
  assert.equal(s.text, null);
  assert.equal(s.tone, null);
});

ok("a plan with no price gets a warning that names the field to fix", () => {
  const s = planStatus(noPrice);
  assert.equal(s.code, "no_price");
  assert.equal(s.tone, "warning");
  assert.match(s.text, /monthly price/i);
});

ok("a private plan is explained, not alarmed about", () => {
  const s = planStatus(negotiated);
  assert.equal(s.code, "private");
  assert.equal(s.tone, "note");
});

ok("the ANNUAL line appears only on a monthly-only plan", () => {
  // The assertion this whole file was written for. The old card printed an
  // annual warning on every plan that HAD an annual price; the honest annual
  // statement belongs on the plan that does NOT.
  assert.equal(planStatus(monthlyOnly).code, "monthly_only");
  const others = ALL.filter((p) => p !== monthlyOnly);
  for (const p of others) {
    assert.notEqual(
      planStatus(p).code,
      "monthly_only",
      `${p.name} should not carry the annual line`,
    );
  }
});

ok("no status line ever mentions Stripe price ids", () => {
  for (const p of ALL) {
    const text = planStatus(p).text || "";
    assert.ok(
      !/price id/i.test(text),
      `${p.name} still blames a Stripe price id: ${text}`,
    );
  }
});

ok("exactly one line per plan, never two", () => {
  for (const p of ALL) {
    const s = planStatus(p);
    assert.ok(
      (s.code === null) === (s.text === null),
      `${p.name}: code and text disagree about whether there is a line`,
    );
  }
});

/* ══ 5. One opinion, not two ══════════════════════════════════════════════ */

console.log("\nThe console and the till cannot disagree");

ok("isSellable is exactly 'public, and checkout can charge it monthly'", () => {
  for (const p of ALL) {
    assert.equal(
      isSellable(p),
      p.isPublic !== false && chargeFor(p, "month") !== null,
      `${p.name} disagrees with what createBillingCheckoutSession would do`,
    );
  }
});

ok("...and the annual half likewise", () => {
  for (const p of ALL) {
    assert.equal(
      isSellableAnnually(p),
      p.isPublic !== false && chargeFor(p, "year") !== null,
      `${p.name} disagrees on the yearly cadence`,
    );
  }
});

ok("partitionPlans keeps the two sellable rows and withholds three", () => {
  const { sellable, withheld, allWithheld } = partitionPlans(ALL);
  assert.deepEqual(
    sellable.map((p) => p.id),
    ["plan_solo_cad", "plan_starter"],
  );
  assert.deepEqual(
    withheld.map((p) => p.id),
    ["plan_blank", "plan_bespoke", "plan_negative", "plan_narrow"],
  );
  assert.equal(allWithheld, false);
});

ok("allWithheld fires only when there is genuinely nothing to sell", () => {
  assert.equal(partitionPlans([noPrice, negotiated]).allWithheld, true);
  assert.equal(partitionPlans([]).allWithheld, false, "no plans is not the same as none sellable");
});

ok("the outage alert names the real reason per plan", () => {
  // It used to say "all N are missing a Stripe price ID", which sent whoever
  // read it to a dashboard that had nothing to do with it.
  assert.deepEqual(withheldReasons([noPrice, negotiated]), [
    { name: "New tier", reason: "no_price" },
    { name: "Custom (2 employees)", reason: "private" },
  ]);
});

/* ══ 6. The screens read it ═══════════════════════════════════════════════ */

console.log("\nThe screens say what that decided, and nothing else");

const CARD = body(code("app/platform/billing/plans/page.js"), "function PlanCard(");

ok("the plan card renders the derived status line", () => {
  assert.match(CARD, /planStatus\(/, "PlanCard no longer calls planStatus");
  assert.match(CARD, /status\.text/, "PlanCard does not render the derived text");
});

ok("...and both false sentences are gone from the card", () => {
  assert.ok(
    !/checkout will fail/i.test(CARD),
    "the card still tells the owner checkout will fail",
  );
  assert.ok(
    !/stripePriceId/.test(CARD),
    "the card still branches on a Stripe price id",
  );
});

ok("the card's status line is not a second hand-rolled test beside it", () => {
  // The exact shape of the bug: a condition written in the JSX about a
  // question sellablePlans.js already answers. Any `!p.someField &&` guard in
  // the card is how the two came to disagree.
  assert.ok(
    !/!p\.(stripePriceId|stripePriceIdAnnual)/.test(CARD),
    "the card is deciding sellability for itself again",
  );
});

ok("the form hint under the Stripe id field no longer claims it is required", () => {
  const src = code("app/platform/billing/plans/page.js");
  const hints = src.match(/hint="[^"]*"/g) || [];
  const idHints = hints.filter((h) => /Checkout prices this plan|same as above/.test(h));
  assert.equal(idHints.length, 2, "the two Stripe-id hints were not both rewritten");
  for (const h of hints) {
    assert.ok(
      !/without it, checkout can't bill/i.test(h),
      `a hint still says the id is required: ${h}`,
    );
  }
});

ok("the plan-creation audit log records real sellability", () => {
  const src = code("app/api/platform/billing/plans/route.js");
  assert.ok(
    !/sellable:\s*Boolean\(plan\.stripePriceId\)/.test(src),
    "the audit log still records every plan as unsellable",
  );
  assert.match(src, /sellable:\s*isSellable\(plan\)/);
});

ok("the public plans endpoint no longer selects an internal price id at all", () => {
  const src = code("app/api/marketing/plans/route.js");
  assert.ok(
    !/stripePriceId:\s*true/.test(src),
    "a public handler still selects stripePriceId and relies on remembering to strip it",
  );
  assert.match(src, /partitionPlans\(/);
  assert.match(src, /withheldReasons\(/);
});

/* ══ 7. stripePriceId still has a job, and it is not this one ═════════════ */

console.log("\nThe column is not deleted — it has a different job");

ok("recoverPlanId is what reads it, and a null id cannot match anything", () => {
  const src = code("lib/platform/stripeBilling.js");
  const recover = body(src, "async function recoverPlanId(");
  assert.match(recover, /stripePriceId: priceId/, "the reverse lookup is gone");
  // The guard that keeps a null-id plan out of the lookup: priceId itself must
  // be non-null before the query runs, or `where: { stripePriceId: null }`
  // would match every plan in the table and attach a payment to a random one.
  before(recover, "if (!priceId) return null", "db.plan.findFirst", "recoverPlanId");
});

ok("neither checkout builder consults it", () => {
  const src = code("lib/platform/stripeBilling.js");
  for (const fn of [
    "export async function createTrialCheckoutSession(",
    "export async function createBillingCheckoutSession(",
  ]) {
    const b = body(src, fn);
    assert.ok(!/stripePriceId/.test(b), `${fn} reads stripePriceId again`);
    assert.match(b, /recurringLine\(/, `${fn} no longer builds its line from the plan`);
  }
});

ok("the shared line builder prices from the plan and refuses rather than falls back", () => {
  const line = body(code("lib/platform/stripeBilling.js"), "function recurringLine(");
  assert.match(line, /chargeFor\(plan, interval\)/);
  before(line, "if (!charge)", "price_data", "recurringLine");
  assert.match(line, /throw new Error/);
  // The literal that made "1 year commitment" bill monthly.
  assert.ok(
    !/interval:\s*"month"/.test(line),
    "the recurring line hardcodes a monthly interval again",
  );
});

/* ══ 8. A failed sale must not leave a company behind ═════════════════════ */

console.log("\nA refused plan does not mint a company row");

const SIGNUP = body(code("app/api/companies/route.js"), "export async function POST(");

ok("one login, one company — a retry is refused, not duplicated", () => {
  // The five "sunset" companies: one person whose checkout kept failing, whose
  // every retry created another tenant. This route used to create a second
  // company for anybody with a session.
  before(SIGNUP, "db.member.findFirst", "tx.company.create", "signup");
  before(SIGNUP, "already_has_company", "tx.company.create", "signup");
  assert.match(SIGNUP, /status: 409/, "the duplicate refusal no longer returns 409");
});

ok("a plan checkout cannot bill is refused BEFORE the company is created", () => {
  // The other half, and the one this brief is about: with the old code the
  // refusal happened inside Stripe, after the company row was committed. Now
  // chargeFor decides first, so an unbillable plan 400s with nothing left
  // behind.
  before(SIGNUP, "chargeFor(plan, interval)", "tx.company.create", "signup");
  before(SIGNUP, "status: 400", "tx.company.create", "signup");
});

ok("company and member are one transaction, so no company is memberless", () => {
  // A Company with no Member is worse than an orphan: the "one login, one
  // company" guard keys off Member, so the stranded row blocks nothing and the
  // next retry silently mints a second one beside it.
  before(SIGNUP, "db.$transaction", "tx.company.create", "signup");
  const tx = body(SIGNUP, "await db.$transaction(async (tx) =>");
  assert.match(tx, /tx\.company\.create/);
  assert.match(tx, /tx\.member\.create/);
});

ok("a Stripe failure after that point is recoverable, not a dead end", () => {
  // The one company row a failure can still leave: Stripe itself being
  // unavailable when the session is created. Deliberate — Company, Member and
  // org are all real by then — but only defensible because the owner is told
  // where to finish, and because the cancel URL does not send them back to a
  // page that offers to build a SECOND business.
  assert.match(SIGNUP, /code: "checkout_failed"/);
  assert.match(SIGNUP, /recoverable: true/);
  // ── This assertion was inverted on 2026-09-02, and the reason matters ──
  //
  // It used to demand /app/settings/account-billing and FORBID /signup, on the
  // grounds that /signup would greet a signed-in owner and offer to set up an
  // ADDITIONAL business. That was true of /signup as it stood.
  //
  // It is not true any more. /signup now asks /api/signup/resume first and
  // recognises exactly this person, landing them on the plan step with their
  // own company. And lib/signup/setupGate.js bounces a no-subscription company
  // off every /app route — so the old destination is now a redirect back to
  // the new one, with a flash of a page they cannot use in between.
  //
  // The CONCERN the old assertion encoded is unchanged and still asserted
  // above: a Stripe failure after the company exists must be recoverable
  // rather than a dead end. Only the address of the recovery moved.
  assert.match(SIGNUP, /cancelUrl: `\$\{baseUrl\}\/signup`/);
  assert.ok(
    !/cancelUrl: `\$\{baseUrl\}\/app\/settings\/account-billing`/.test(SIGNUP),
    "cancel sends the owner to a page the setup gate will bounce them off",
  );
});

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
