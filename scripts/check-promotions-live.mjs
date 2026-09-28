// scripts/check-promotions-live.mjs
//
//   npm run check:promotions-live
//
// PlatformPromotion was a DEAD CONTROL until 2026-09-28: rows were created,
// validated, previewed and audit-logged at /platform/billing/promotions and
// read by nothing a customer touches — the pricing page, the in-app picker,
// signup and the Stripe checkout all ignored them, so a promotion switched
// on discounted nobody. This check executes the wiring end to end:
//
//   1. the resolver matrix — tier × currency × commitment × promotion state
//      (live, none, expired, not started, switched off, scoped elsewhere),
//      through lib/pricing/planOffer.js, the one function every surface and
//      the checkout price with;
//   2. the owner's promotion, exactly: "40% off the MONTHLY price, applied to
//      the 1-year commitment, all plans, all currencies" — Solo 712.80 for
//      year one (59.40/mo), Crew 1,216.80, Shop 1,936.80, Scale 2,656.80,
//      custom sizes at the same 40% off twelve months, renewing at the
//      standing 1-year offer (990 / 1,690 / 2,690 / 3,690); never stacked on
//      the standing offer (40% off 990 = 594 is wrong); a 10% sale (1,069.20)
//      loses to the standing 990 and is flagged;
//   3. the promotion form's validation (AUD, "Applies to", custom tier);
//   4. checkout against a RECORDING fake Stripe: the coupon's amount,
//      currency and duration, the idempotent find-or-mint, the Checkout
//      Session carrying it on the regular lines with Stripe Tax still on,
//      the trial window, the plan-change and schedule paths, and what the
//      webhook records;
//   5. a static sweep: every customer price surface calls the shared
//      resolver, and the renderers do no discount arithmetic of their own;
//   6. contrast of the ribbon, badge and saving line, light and dark, against
//      the cards they sit on (read from app/globals.css);
//   7. every new string in all nine languages.
//
// Run against the pre-2026-09-28 tree it fails in every section — see the
// ROADMAP entry for the before/after counts.

import { readFileSync, existsSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, resolve as resolvePath } from "node:path";

register("./promotions-stub-hooks.mjs", import.meta.url);

const ROOT = resolvePath(dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "");
// Comments explain themselves in this repo and name the very strings the
// assertions look for, so they are stripped — but only real ones: a JSX
// comment, a block comment opening a line, a line comment. A bare "/*"
// regex would also open on a "/*" inside a string and eat real code.
const code = (p) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(label);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — got ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
};
const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
async function load(spec) {
  try {
    return await import(spec);
  } catch (err) {
    return { __error: err };
  }
}

const ladder = await load("@/lib/pricing/ladder");
const offerMod = await load("@/lib/pricing/planOffer");
const fieldsMod = await load("@/lib/billing/promotionFields");
const promosMod = await load("@/lib/billing/promotions");
const stubs = await import("./fixtures/promotionsStubs.mjs");

const NOW = new Date("2026-10-15T12:00:00Z");
const ENDS = "2026-11-01T04:00:00.000Z"; // "ends October 31", Toronto
const OWNER = {
  id: "promo_owner",
  label: "40% off the yearly plan",
  active: true,
  startsAt: null,
  endsAt: ENDS,
  discountKind: "percent",
  discountValue: 40,
  durationMonths: 3,
  tierKeys: null,
  currencies: null,
  appliesTo: "year",
};
const RUNGS = [
  ["solo", 99, 990, 712.8, 59.4],
  ["crew", 169, 1690, 1216.8, 101.4],
  ["shop", 269, 2690, 1936.8, 161.4],
  ["scale", 369, 3690, 2656.8, 221.4],
];
const CURRENCIES = ["CAD", "USD", "AUD"];
const row = (tierKey, currency, monthly, annual) => ({ id: `${tierKey}-${currency.toLowerCase()}`, name: tierKey, tierKey, currency, priceMonthly: monthly, priceAnnual: annual });

const planOffer = offerMod.planOffer;
const offer = (plan, interval, promotions, now = NOW) =>
  typeof planOffer === "function" ? planOffer({ plan, interval, promotions, now }) : { available: false, missing: true };

// ── 1 ────────────────────────────────────────────────────────────────────────
section("1. The resolver matrix");
ok("lib/pricing/planOffer.js exists and exports planOffer — the one resolver", typeof planOffer === "function", offerMod.__error?.message);
{
  const states = {
    live: OWNER,
    none: null,
    expired: { ...OWNER, endsAt: "2026-10-01T00:00:00Z" },
    future: { ...OWNER, startsAt: "2026-10-20T00:00:00Z" },
    off: { ...OWNER, active: false },
  };
  let cells = 0;
  let wrong = [];
  for (const [tierKey, m, a, sale] of RUNGS) {
    for (const currency of CURRENCIES) {
      for (const [state, promo] of Object.entries(states)) {
        const plan = row(tierKey, currency, m, a);
        const y = offer(plan, "year", promo ? [promo] : []);
        const mo = offer(plan, "month", promo ? [promo] : []);
        const wantYear = state === "live" ? sale : a;
        cells++;
        if (!(y.available && y.charge === wantYear && y.renewal === a && Boolean(y.promo) === (state === "live"))) wrong.push(`${tierKey}/${currency}/year/${state}: ${y.charge}`);
        // A 1-year sale never touches the monthly price.
        if (!(mo.available && mo.charge === m && !mo.promo)) wrong.push(`${tierKey}/${currency}/month/${state}: ${mo.charge}`);
      }
    }
  }
  ok(`${cells} cells (4 tiers × 3 currencies × 5 states × 2 commitments): year one is the sale only while live; month untouched by a 1-year sale`, wrong.length === 0, wrong.slice(0, 4));

  // A monthly sale: monthly price for N months, the year untouched.
  const monthly = { ...OWNER, id: "promo_m", appliesTo: "month", discountValue: 30 };
  const solo = row("solo", "CAD", 99, 990);
  const mo = offer(solo, "month", [monthly]);
  ok("a monthly 30% sale: CA$69.30 for 3 months, then CA$99", mo.charge === 69.3 && mo.promoMonths === 3 && mo.renewal === 99 && mo.percent === 30, mo);
  ok("...and leaves the year at the standing CA$990", offer(solo, "year", [monthly]).charge === 990);
  const both = { ...monthly, id: "promo_b", appliesTo: "both" };
  ok('"both" discounts the month (69.30) and the year (12 × 99 × 0.7 = 831.60)',
    offer(solo, "month", [both]).charge === 69.3 && offer(solo, "year", [both]).charge === 831.6);
  const legacy = { ...monthly, id: "promo_legacy" };
  delete legacy.appliesTo;
  ok("a row saved before appliesTo existed reads as monthly — what priceFor always did",
    offer(solo, "month", [legacy]).charge === 69.3 && offer(solo, "year", [legacy]).charge === 990);
  ok("tier scope: a Crew-only sale leaves Solo alone", offer(solo, "year", [{ ...OWNER, tierKeys: ["crew"] }]).charge === 990 &&
    offer(row("crew", "CAD", 169, 1690), "year", [{ ...OWNER, tierKeys: ["crew"] }]).charge === 1216.8);
  ok("currency scope: an AUD-only sale reaches AUD rows and no others",
    offer(row("solo", "AUD", 99, 990), "year", [{ ...OWNER, currencies: ["AUD"] }]).charge === 712.8 &&
      offer(solo, "year", [{ ...OWNER, currencies: ["AUD"] }]).charge === 990);
  const c20 = typeof ladder.customTier === "function" ? ladder.customTier(20) : null;
  const custom20 = c20 ? { tierKey: c20.tierKey, currency: "USD", priceMonthly: c20.price, priceAnnual: c20.priceAnnual } : null;
  ok('custom scope: "custom" in a sale\'s tiers reaches custom-20; a rungs-only sale does not',
    custom20 && offer(custom20, "year", [{ ...OWNER, tierKeys: ["custom"] }]).promo && !offer(custom20, "year", [{ ...OWNER, tierKeys: ["solo", "crew", "shop", "scale"] }]).promo);
  ok("a legacy/bespoke row (no tierKey) is never discounted by a public sale",
    !offer({ tierKey: null, currency: "CAD", priceMonthly: 90, priceAnnual: 900 }, "year", [OWNER]).promo);
  ok("a plan with no annual price has no 1-year offer — not a year invented from twelve months",
    offer(row("solo", "CAD", 99, null), "year", [OWNER]).available === false);
  ok("two sales running: the lower wins", offer(solo, "year", [OWNER, { ...OWNER, id: "promo_z", discountValue: 50 }]).charge === 594);
  ok("the boundary: dead ON the end date", !offer(solo, "year", [OWNER], new Date(ENDS)).promo);
}

// ── 2 ────────────────────────────────────────────────────────────────────────
section("2. The owner's promotion — exact numbers");
{
  for (const [tierKey, m, a, sale, perMonth] of RUNGS) {
    for (const currency of CURRENCIES) {
      const y = offer(row(tierKey, currency, m, a), "year", [OWNER]);
      ok(`${tierKey} ${currency}: ${a} → ${sale.toFixed(2)} for year one (${perMonth.toFixed(2)}/mo), ribbon 40%, crossed ${m}/mo, renews ${a}`,
        y.charge === sale && y.perMonth === perMonth && y.percent === 40 && y.crossedPerMonth === m && y.renewal === a && y.twelveMonths === m * 12 && y.promo?.label === OWNER.label,
        { charge: y.charge, perMonth: y.perMonth, percent: y.percent, renewal: y.renewal });
    }
  }
  const standing = offer(row("solo", "USD", 99, 990), "year", []);
  ok("no sale: the standing offer — US$990, US$82.50/mo, save US$198, ribbon 17%",
    standing.charge === 990 && standing.perMonth === 82.5 && standing.saves === 198 && standing.percent === 17 && !standing.promo);
  ok("no stacking: the sale is never 40% off the standing year (594 / 1,014 / 1,614 / 2,214)",
    RUNGS.every(([t, m, a]) => offer(row(t, "CAD", m, a), "year", [OWNER]).charge !== Math.round(a * 0.6 * 100) / 100));
  const ten = offer(row("solo", "CAD", 99, 990), "year", [{ ...OWNER, discountValue: 10 }]);
  ok("a 10% monthly-price sale (1,069.20) loses to the standing 990: charged 990, flagged as outranked",
    ten.charge === 990 && !ten.promo && ten.outranked?.[0]?.wouldCharge === 1069.2, ten);

  // Custom sizes: how a custom year is priced (customTier: Scale's ratio,
  // ten months today), then the same 40% off twelve monthly payments.
  const bad = [];
  if (typeof ladder.customTier === "function") {
    for (let seats = ladder.CUSTOM_MIN_SEATS; seats <= ladder.CUSTOM_MAX_SEATS; seats++) {
      const t = ladder.customTier(seats);
      for (const currency of CURRENCIES) {
        const y = offer({ tierKey: t.tierKey, currency, priceMonthly: t.price, priceAnnual: t.priceAnnual }, "year", [OWNER]);
        const want = Math.round(t.price * 12 * 0.6 * 100) / 100;
        if (!(t.priceAnnual === t.price * 10 && y.charge === want && y.renewal === t.priceAnnual && y.percent === 40)) bad.push(`${seats}/${currency}: ${y.charge} vs ${want}`);
      }
    }
  }
  ok("every custom size (11–47 seats × 3 currencies): standing = 10 × monthly, year one = 12 × monthly × 0.6, renews at standing", typeof ladder.customTier === "function" && bad.length === 0, bad.slice(0, 3));
  const t20 = ladder.customTier?.(20);
  const y20 = t20 && offer({ tierKey: t20.tierKey, currency: "CAD", priceMonthly: t20.price, priceAnnual: t20.priceAnnual }, "year", [OWNER]);
  ok("Custom · 20 seats: 619/mo, standing 6,190, year one 4,456.80 (371.40/mo)", y20?.charge === 4456.8 && y20?.perMonth === 371.4 && y20?.standing === 6190, y20);

  const tab = offerMod.yearTabSaving;
  ok('the 1-year tab says "save 17%" on the standing ladder and "save 40%" during the sale; "up to" when cards differ',
    typeof tab === "function" &&
      tab(RUNGS.map(([t, m, a]) => offer(row(t, "CAD", m, a), "year", []))).percent === 17 &&
      tab(RUNGS.map(([t, m, a]) => offer(row(t, "CAD", m, a), "year", [OWNER]))).percent === 40 &&
      tab(RUNGS.map(([t, m, a]) => offer(row(t, "CAD", m, a), "year", [{ ...OWNER, tierKeys: ["solo"] }]))).upTo === true);
}

// ── 3 ────────────────────────────────────────────────────────────────────────
section("3. The promotion form's validation");
{
  const parse = fieldsMod.parsePromotionFields;
  const base = { label: OWNER.label, endsAt: ENDS, discountKind: "percent", discountValue: 40, durationMonths: 3 };
  const at = new Date("2026-09-28T12:00:00Z");
  const r1 = parse?.({ ...base, currencies: ["CAD", "USD", "AUD"], appliesTo: "year" }, { now: at });
  ok("AUD is accepted — the form has offered A$ AUD since 2026-09-24", r1 && !r1.error && r1.data.currencies.includes("AUD"), r1?.error);
  ok('"Applies to: 1-year commitment" is stored', r1?.data?.appliesTo === "year");
  const r2 = parse?.(base, { now: at });
  ok('a create without appliesTo is "month" — what every row meant before the field', r2?.data?.appliesTo === "month");
  ok('"decade" is refused', Boolean(parse?.({ ...base, appliesTo: "decade" }, { now: at })?.error));
  ok('"custom" is a tier a sale can scope to', !parse?.({ ...base, tierKeys: ["scale", "custom"] }, { now: at })?.error);
  ok("an unknown tier is still refused", Boolean(parse?.({ ...base, tierKeys: ["platinum"] }, { now: at })?.error));
  const noEnd = parse?.({ ...base, endsAt: "" }, { now: at });
  ok("a sale with no end is still refused — and told where the one standing offer lives",
    Boolean(noEnd?.error) && /1-year commitment offer/.test(noEnd?.error || ""), noEnd?.error);
  const partial = parse?.({ active: true }, { partial: true, existing: { ...OWNER, endsAt: ENDS }, now: at });
  ok("a toggle (PATCH) does not rewrite appliesTo", partial && !("appliesTo" in partial.data));
  const so = offerMod.standingAnnualFor;
  ok("the standing offer editor: 2 months free on 99/169/269/369 = 990/1,690/2,690/3,690",
    typeof so === "function" && [99, 169, 269, 369].map((m) => so(m, { kind: "months", value: 2 })).join() === "990,1690,2690,3690");
  ok("...17% off twelve months on 99 = 986.04; 12 months free is refused",
    so?.(99, { kind: "percent", value: 17 }) === 986.04 && so?.(99, { kind: "months", value: 12 }) === null);
}

// ── 4 ────────────────────────────────────────────────────────────────────────
section("4. Checkout, against a recording fake Stripe");
const billing = await load("@/lib/platform/stripeBilling");
{
  const { state, calls, resetStubs } = stubs;
  const company = { id: "co_1", name: "Luma Painting", email: "o@luma.test", currency: "CAD" };
  const solo = { id: "plan_solo_cad", name: "Solo", tierKey: "solo", currency: "CAD", priceMonthly: 99, priceAnnual: 990, retiredAt: null };
  const byMethod = (m) => calls.filter((c) => c.method === m);
  const create = billing.createBillingCheckoutSession;
  ok("stripeBilling loads under the fakes", typeof create === "function", billing.__error?.message);

  const openSession = async (opts = {}) => {
    try {
      await create({ company, plan: solo, interval: "year", successUrl: "https://x/s", cancelUrl: "https://x/c", ...opts });
    } catch (err) {
      return err;
    }
    return null;
  };

  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  const realNow = Date.now;
  // The checkout decides "is it running" at the moment of purchase.
  Date.now = () => NOW.getTime();
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [NOW.getTime()]));
    }
    static now() {
      return NOW.getTime();
    }
  };
  let err = await openSession();
  const session = byMethod("checkout.sessions.create")[0]?.args[0];
  const minted = byMethod("coupons.create")[0];
  ok("a live 1-year sale mints ONE coupon: 27,720¢ off, CAD, duration once", minted && minted.args[0].amount_off === 27720 && minted.args[0].currency === "cad" && minted.args[0].duration === "once", minted?.args[0] || err?.message);
  ok("...under a deterministic id, with the id as the idempotency key",
    minted && /^fqpromo_promoowner_cad_y_27720_once$/.test(minted.args[0].id) && minted.args[1]?.idempotencyKey === `fq-coupon-${minted.args[0].id}`, minted?.args);
  ok("...named for the promotion, within Stripe's 40 characters", minted && minted.args[0].name === OWNER.label && minted.args[0].name.length <= 40);
  ok("the Checkout Session carries it: discounts [{ coupon }]", Boolean(minted) && session?.discounts?.[0]?.coupon === minted.args[0].id, session?.discounts);
  ok("...on the REGULAR line (99,000¢ a year) — the invoice shows plan, coupon and difference",
    session?.line_items?.[0]?.price_data?.unit_amount === 99000 && session.line_items[0].price_data.recurring.interval === "year");
  ok("...with Stripe Tax still on (tax computes on the discounted subtotal)", session?.automatic_tax?.enabled === true && session?.billing_address_collection === "required");
  const meta = session?.metadata?.promotion ? JSON.parse(session.metadata.promotion) : null;
  ok("...and metadata the webhook records: regular 99,000¢, charged 71,280¢, promotion id",
    meta?.r === 99000 && meta?.ch === 71280 && meta?.p === "promo_owner" && session.metadata.promotion.length <= 500, meta);

  const before = byMethod("coupons.create").length;
  await openSession();
  ok("a re-run FINDS the coupon — no duplicate minted", byMethod("coupons.create").length === before && byMethod("coupons.retrieve").length >= 2);
  ok("...and the second session carries the same coupon", Boolean(minted) && byMethod("checkout.sessions.create")[1]?.args[0]?.discounts?.[0]?.coupon === minted.args[0].id);

  // USD and AUD mint their own coupons in their own money.
  for (const [cur, id] of [["USD", "plan_solo_usd"], ["AUD", "plan_solo_aud"]]) {
    await create({ company: { ...company, currency: cur }, plan: { ...solo, id, currency: cur }, interval: "year", successUrl: "s", cancelUrl: "c" });
  }
  ok("USD and AUD: the same 27,720 off, in their own currency, one coupon each",
    ["usd", "aud"].every((c) => byMethod("coupons.create").some((x) => x.args[0].currency === c && x.args[0].amount_off === 27720)));

  // Race: another checkout minted it between our retrieve and create.
  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  state.raceOnCreate = true;
  err = await openSession();
  ok("a race (resource_already_exists) reads the winner's coupon and proceeds", !err && byMethod("checkout.sessions.create")[0]?.args[0]?.discounts?.length === 1, err?.message);

  // A coupon tampered with in the dashboard is refused, never charged.
  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  state.coupons.set("fqpromo_promoowner_cad_y_27720_once", { id: "fqpromo_promoowner_cad_y_27720_once", amount_off: 50000, currency: "cad", duration: "once", valid: true });
  err = await openSession();
  ok("a coupon under our id with a different amount is refused — no session opened", Boolean(err) && byMethod("checkout.sessions.create").length === 0, err?.message);

  // States where nothing may be discounted.
  for (const [label, promos, plan, interval] of [
    ["expired", [{ ...OWNER, endsAt: "2026-10-01T00:00:00Z" }], solo, "year"],
    ["switched off", [{ ...OWNER, active: false }], solo, "year"],
    ["not started", [{ ...OWNER, startsAt: "2026-10-20T00:00:00Z" }], solo, "year"],
    ["USD-only sale, CAD plan", [{ ...OWNER, currencies: ["USD"] }], solo, "year"],
    ["1-year sale, monthly purchase", [OWNER], solo, "month"],
    ["10% sale that loses to the standing offer", [{ ...OWNER, discountValue: 10 }], solo, "year"],
  ]) {
    resetStubs();
    state.promotions = promos.map((p) => ({ ...p, createdAt: NOW }));
    await create({ company, plan, interval, successUrl: "s", cancelUrl: "c" });
    const s = byMethod("checkout.sessions.create")[0]?.args[0];
    ok(`${label}: no coupon, no discount, regular line`, s && !s.discounts && byMethod("coupons.create").length === 0 && !s.metadata.promotion);
  }

  // A trial precedes the first charge: the coupon must survive the $0 trial invoice.
  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  await create({ company, plan: solo, interval: "year", trialDays: 30, successUrl: "s", cancelUrl: "c" });
  const trialCoupon = byMethod("coupons.create")[0]?.args[0];
  ok("with a 30-day trial the 1-year coupon is repeating for 3 months — covers the first paid invoice (day 30), long gone by the renewal (month 13)",
    trialCoupon?.duration === "repeating" && trialCoupon?.duration_in_months === 3 && trialCoupon?.amount_off === 27720, trialCoupon);
  ok("...and the trial still rides on the session", byMethod("checkout.sessions.create")[0]?.args[0]?.subscription_data?.trial_period_days === 30);

  // The signup (trial) checkout: same wiring.
  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  if (typeof billing.createTrialCheckoutSession === "function") {
    await billing.createTrialCheckoutSession({ company, plan: solo, pricing: { trialTotal: 0, employeeCount: 6 }, interval: "year", trialDays: 30, successUrl: "s", cancelUrl: "c" });
  }
  const signup = byMethod("checkout.sessions.create")[0]?.args[0];
  ok("the SIGNUP checkout applies the sale too (repeating 3, 27,720 off), with Stripe Tax", signup?.discounts?.length === 1 && signup?.automatic_tax?.enabled === true && byMethod("coupons.create")[0]?.args[0]?.duration_in_months === 3);
  ok("...and records it on the subscription's metadata", Boolean(signup?.subscription_data?.metadata?.promotion));

  // A monthly sale: repeating for its months, amount per invoice.
  resetStubs();
  state.promotions = [{ ...OWNER, id: "promo_m", appliesTo: "month", discountValue: 30, durationMonths: 3, createdAt: NOW }];
  await create({ company, plan: solo, interval: "month", successUrl: "s", cancelUrl: "c" });
  const mc = byMethod("coupons.create")[0]?.args[0];
  ok("a monthly sale: repeating 3 months, 2,970¢ off each CA$99 invoice", mc?.duration === "repeating" && mc?.duration_in_months === 3 && mc?.amount_off === 2970, mc);

  // A custom size: two Stripe lines, one coupon for the difference.
  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  const t20 = ladder.customTier(20);
  await create({ company, plan: { id: "plan_c20", name: t20.name, tierKey: t20.tierKey, currency: "CAD", priceMonthly: t20.price, priceAnnual: t20.priceAnnual, retiredAt: null }, interval: "year", successUrl: "s", cancelUrl: "c" });
  const cs = byMethod("checkout.sessions.create")[0]?.args[0];
  ok("custom 20 seats: Scale's line + 10 extra seats, one coupon of 173,320¢ (6,190 → 4,456.80)",
    cs?.line_items?.length === 2 && byMethod("coupons.create")[0]?.args[0]?.amount_off === 173320, byMethod("coupons.create")[0]?.args[0]);

  // Plan changes on a live subscription.
  const sub = (status, interval) => ({
    id: "sub_row", companyId: "co_1", planId: "plan_x", stripeSubscriptionId: "sub_live", billingInterval: interval, stripeScheduleId: null,
  });
  const liveStripe = (status, interval, extra = {}) => ({
    id: "sub_live", status, currency: "cad", trial_end: status === "trialing" ? Math.floor(NOW.getTime() / 1000) + 10 * 86400 : null,
    current_period_start: Math.floor(NOW.getTime() / 1000) - 86400, current_period_end: Math.floor(NOW.getTime() / 1000) + 20 * 86400,
    items: { data: [{ id: "si_1", price: { id: "price_old", recurring: { interval } }, quantity: 1 }] },
    discounts: ["di_retention"], metadata: {}, ...extra,
  });

  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  state.subscriptions.set("sub_live", liveStripe("trialing", "month"));
  state.subscription = sub("trialing", "month");
  await billing.changeSubscriptionPlan?.({ subscription: sub("trialing", "month"), plan: solo, interval: "year", currency: "cad" });
  const up = byMethod("subscriptions.update")[0]?.args[1];
  ok("a TRIALING company changing now: the coupon goes on the update, the retention discount it already had is kept",
    up?.discounts?.some((d) => d.discount === "di_retention") && up?.discounts?.some((d) => /^fqpromo_/.test(d.coupon || "")), up?.discounts);
  const wrote = byMethod("db.subscription.update")[0]?.args[0]?.data?.promotionApplied;
  ok("...and the row records the promotion it was sold under", wrote?.promotionId === "promo_owner" && wrote?.chargeCents === 71280);

  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  state.subscriptions.set("sub_live", liveStripe("active", "year"));
  await billing.changeSubscriptionPlan?.({ subscription: sub("active", "year"), plan: { ...solo, id: "plan_crew", tierKey: "crew", priceMonthly: 169, priceAnnual: 1690 }, interval: "year", currency: "cad" });
  const upYear = byMethod("subscriptions.update")[0]?.args[1];
  ok("a PAID yearly plan upgraded to another yearly plan mid-year: no coupon (it would be spent on next year's renewal)",
    upYear && !upYear.discounts && byMethod("coupons.create").length === 0);

  resetStubs();
  state.promotions = [{ ...OWNER, createdAt: NOW }];
  state.subscriptions.set("sub_live", liveStripe("active", "month"));
  await billing.schedulePlanChange?.({ subscription: sub("active", "month"), plan: solo, interval: "year", currency: "cad" });
  const sched = byMethod("subscriptionSchedules.update")[0]?.args[1];
  ok("a month→year switch booked for the period end: the NEW phase carries the coupon (once)",
    sched?.phases?.[1]?.discounts?.[0]?.coupon === "fqpromo_promoowner_cad_y_27720_once", sched?.phases?.[1]);
  ok("...the current phase is restated with its own discount by id (not re-redeemed)",
    sched?.phases?.[0]?.discounts?.[0]?.discount === "di_retention" && !sched.phases[0].discounts[0].coupon);
  ok("...and Stripe Tax carried onto the new phase", sched?.phases?.[1]?.automatic_tax?.enabled === true);

  globalThis.Date = RealDate;
  Date.now = realNow;

  // A database that cannot answer (the deploy that lands before the
  // appliesTo column) is "no sale" everywhere — never a failed checkout.
  {
    const lp = promosMod.livePromotions;
    const broken = { platformPromotion: { findMany: async () => { throw new Error('column "appliesTo" does not exist'); } } };
    const got = typeof lp === "function" ? await lp({ now: NOW, client: broken }).catch((e) => e) : null;
    ok("an unreadable promotions table answers [] (recorded), so the page and the checkout keep the regular price", Array.isArray(got) && got.length === 0, got?.message);
  }

  // What the webhook records.
  const fromSession = promosMod.promotionFromCheckoutSession;
  const charged = promosMod.promotionChargedFromInvoice;
  const rec = fromSession?.({ id: "cs_1", metadata: session?.metadata || {}, amount_total: 0, total_details: { amount_discount: 0, amount_tax: 0 } });
  ok("checkout.session.completed → the record: promotion, coupon, 99,000 → 71,280", rec?.promotionId === "promo_owner" && rec?.regularCents === 99000 && rec?.chargeCents === 71280);
  const inv = {
    id: "in_1", amount_paid: 80546, subtotal: 99000, tax: 9266, currency: "cad", status_transitions: { paid_at: 1793000000 },
    discounts: [{ id: "di_1", coupon: { id: rec?.coupon } }], total_discount_amounts: [{ amount: 27720, discount: "di_1" }],
  };
  const after = charged?.(rec, inv);
  ok("invoice.payment_succeeded with the coupon → charged: paid 80,546¢ (712.80 + 13% tax), discount 27,720¢, tax 9,266¢",
    after?.charged?.amountPaidCents === 80546 && after.charged.discountCents === 27720 && after.charged.taxCents === 9266, after?.charged);
  ok("...a replay, or an invoice without our coupon (an AI bundle on the same customer), records nothing",
    charged?.(after, inv) === null && charged?.(rec, { ...inv, discounts: [], total_discount_amounts: [] }) === null);
  const sb = code("lib/platform/stripeBilling.js");
  ok("the webhook writes both: the session's record on upsert, the invoice's charge on payment",
    /promotionApplied: \{ \.\.\.soldUnder, path: "checkout" \}/.test(sb) && /promotionChargedFromInvoice\(promoted\?\.promotionApplied, obj\)/.test(sb));
}

// ── 5 ────────────────────────────────────────────────────────────────────────
section("5. Every customer price surface calls the shared resolver");
{
  const surfaces = [
    ["app/api/settings/plans/route.js", ["livePromotions(", "withOffers(", "customOfferTable("]],
    ["app/api/marketing/plans/route.js", ["livePromotions(", "withOffers("]],
    ["app/(marketing)/pricing/page.js", ["livePromotions(", "universalPromotions(", "withOffers(", "customOfferTable("]],
  ];
  for (const [file, needles] of surfaces) {
    const src = code(file);
    ok(`${file} resolves prices through lib/billing/promotions.js (${needles.join(", ")})`, needles.every((n) => src.includes(n)));
  }
  const sb = code("lib/platform/stripeBilling.js");
  ok("stripeBilling: both Checkout builders, the immediate change and the schedule ask checkoutPromotion (4 calls)",
    (sb.match(/await checkoutPromotion\(/g) || []).length === 4, (sb.match(/await checkoutPromotion\(/g) || []).length);
  const renderers = [
    "app/app/settings/account-billing/page.js",
    "app/(marketing)/pricing/PricingPlans.js",
    "app/components/marketing/PricingCard.js",
  ];
  for (const file of renderers) {
    const src = code(file);
    ok(`${file} renders through PlanOfferPrice and reads the server's offers`, src.includes("<PlanOfferPrice") && /\.offers\b/.test(src));
    ok(`${file} does no discount or deal arithmetic (no discountValue, annualComparison, annualSaving(, yearly / 12)`,
      !/discountValue|annualComparison|annualSaving\(|yearly \/ 12|\* \(1 -/.test(src));
  }
  const signup = code("app/signup/page.js");
  ok("signup reads the server's offers for the pill, the year line and the charge", /selectedPlan\?\.offers\?\.\[effectiveInterval\]/.test(signup) && /yearTabSaving\(visiblePlans\.map\(\(p\) => p\.offers\)\)/.test(signup) && !/annualComparison/.test(signup));
  const comp = code("app/components/billing/PlanOfferPrice.js");
  ok("PlanOfferPrice does no arithmetic on a price (no priceMonthly, priceAnnual, discountValue, * 12, / 12)",
    comp.length > 0 && !/priceMonthly|priceAnnual|discountValue|\* ?12|\/ ?12/.test(comp));
  ok("the picker, /pricing and signup open on the 1-year tab",
    /some\(\(p\) => annualPriceOf\(p\) !== null\) \? "year" : "month"/.test(code("app/app/settings/account-billing/page.js")) &&
      /useState\(anyYear \? "year" : "month"\)/.test(code("app/(marketing)/pricing/PricingPlans.js")) &&
      /useState\("year"\)/.test(signup));
  const console_ = code("app/platform/billing/promotions/page.js");
  ok("the console preview prices with planOffer, per tier × currency × commitment, custom size included",
    /planOffer\(\{ plan: row\.plan, interval: "year"/.test(console_) && /planOffer\(\{ plan: row\.plan, interval: "month"/.test(console_) && /customTier\(CUSTOM_EXAMPLE_SEATS/.test(console_));
  ok("...says what a 1-year sale is measured against, and warns when it loses to the standing offer",
    /instead of 12 × monthly/.test(read("app/platform/billing/promotions/page.js")) && /data-year-warning/.test(console_));
  ok('...and has the "Applies to" field and the standing 1-year offer panel', /name="appliesTo"/.test(console_) && /<StandingOfferPanel/.test(console_));
  const schema = read("prisma/schema.prisma");
  ok("schema: PlatformPromotion.appliesTo defaults to month; Subscription.promotionApplied records the sale",
    /appliesTo String @default\("month"\)/.test(schema) && /promotionApplied Json\?/.test(schema));
  ok("the promotion routes audit-log appliesTo", /appliesTo: promotion\.appliesTo/.test(code("app/api/platform/billing/promotions/route.js")) && /newAppliesTo: promotion\.appliesTo/.test(code("app/api/platform/billing/promotions/[id]/route.js")));
  ok("the subscription route sends promotionApplied to the page that reads it",
    /select: \{ promotionApplied: true \}/.test(code("app/api/settings/subscription/route.js")) && /subscription\?\.promotionApplied/.test(code("app/app/settings/account-billing/page.js")));
}

// ── 6 ────────────────────────────────────────────────────────────────────────
section("6. Contrast — ribbon, badge, saving line, light and dark");
{
  const comp = read("app/components/billing/PlanOfferPrice.js");
  const cls = (name) => (comp.match(new RegExp(`export const ${name} =\\s*"([^"]+)"`)) || [])[1] || (comp.match(new RegExp(`export const ${name} =\\s*\\n\\s*"([^"]+)"`)) || [])[1] || "";
  const hex = (s, re) => (s.match(re) || [])[1];
  const lum = (h) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const css = read("app/globals.css");
  const token = (block, name) => {
    const m = css.match(new RegExp(`${block}\\s*\\{[\\s\\S]*?--${name}:\\s*(#[0-9a-fA-F]{6})`));
    return m ? m[1].toLowerCase() : null;
  };
  const light = { card: token(":root", "card"), background: token(":root", "background"), muted: token(":root", "muted") };
  const dark = { card: token("\\.dark", "card"), background: token("\\.dark", "background"), muted: token("\\.dark", "muted") };
  ok("card, page and muted backgrounds read from app/globals.css, light and dark", Object.values(light).every(Boolean) && Object.values(dark).every(Boolean), { light, dark });
  const R = cls("RIBBON_CLASS"), B = cls("BADGE_CLASS"), S = cls("SAVE_CLASS");
  const ribbon = [hex(R, /text-\[(#[0-9a-f]{6})\]/i), hex(R, /bg-\[(#[0-9a-f]{6})\]/i)];
  const badgeL = [hex(B, /(?<!dark:)text-\[(#[0-9a-f]{6})\]/i), hex(B, /(?<!dark:)bg-\[(#[0-9a-f]{6})\]/i)];
  const badgeD = [hex(B, /dark:text-\[(#[0-9a-f]{6})\]/i), hex(B, /dark:bg-\[(#[0-9a-f]{6})\]/i)];
  const saveL = hex(S, /(?<!dark:)text-\[(#[0-9a-f]{6})\]/i), saveD = hex(S, /dark:text-\[(#[0-9a-f]{6})\]/i);
  const pairs = [
    ["ribbon text on ribbon (both themes — the ribbon brings its own ground)", ribbon[0], ribbon[1]],
    ["badge text on badge, light", badgeL[0], badgeL[1]],
    ["badge text on badge, dark", badgeD[0], badgeD[1]],
    ["saving line on a light card", saveL, light.card],
    ["saving line on the light page (marketing /pricing cards)", saveL, light.background],
    ["saving line on the muted wash (a selected signup card)", saveL, light.muted],
    ["saving line on a dark card", saveD, dark.card],
    ["saving line on the dark muted wash", saveD, dark.muted],
  ];
  for (const [label, fg, bg] of pairs) {
    const r = fg && bg ? ratio(fg, bg) : 0;
    ok(`${label}: ${fg} on ${bg} = ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5);
  }
}

// ── 7 ────────────────────────────────────────────────────────────────────────
section("7. Every new string in all nine languages");
{
  const { MESSAGES } = await import("../app/i18n/messages.js");
  const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  const keys = [
    "pricing.offer.perMonth", "pricing.offer.regularPrice", "pricing.offer.billedYearly", "pricing.offer.billedYearOne",
    "pricing.offer.youSaveYear", "pricing.offer.youSaveYearOne", "pricing.offer.firstYearThen", "pricing.offer.firstMonthsThen",
    "pricing.offer.firstMonthThen", "pricing.offer.endsOn", "pricing.offer.ribbon", "pricing.offer.tabYear", "pricing.offer.tabSave",
    "pricing.offer.tabSaveUpTo", "pricing.offer.tabMonthly", "pricing.offer.withheld",
    "app.billing.promoYearOne", "app.billing.promoMonths", "app.signup.plan.yearlyPromoLine", "app.signup.plan.yearOne",
    "app.signup.plan.perMonthFor", "app.signup.plan.perMonthForOne",
  ];
  const holes = [];
  for (const k of keys) {
    const want = (MESSAGES.en?.[k] || "").match(/\{\w+\}/g)?.sort().join() || "";
    for (const l of LANGS) {
      const v = MESSAGES[l]?.[k];
      if (!v) holes.push(`${l}:${k} missing`);
      else if (((v.match(/\{\w+\}/g) || []).sort().join()) !== want) holes.push(`${l}:${k} placeholders`);
      else if (l !== "en" && v === MESSAGES.en[k] && !/^\{amount\}\/mo$/.test(v)) holes.push(`${l}:${k} untranslated`);
    }
  }
  ok(`${keys.length} keys × 9 languages, placeholders intact`, holes.length === 0, holes.slice(0, 6));
}

console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}` : `\nPASSED — ${pass}/${pass}`);
process.exit(fails.length ? 1 : 0);
