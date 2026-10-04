// lib/platform/revenueOutlook.js
//
// What FieldQuo will actually be paid, as distinct from what it is owed on
// paper — and both kept well away from what its customers bill their own
// clients.
//
// ── The confusion this exists to end ───────────────────────────────────────
//
// The platform dashboard showed "$473,558 invoiced" beside FieldQuo's MRR.
// That figure is the face value of 22 invoices CONTRACTORS sent to THEIR
// homeowners. It is a product-health signal — volume flowing through the
// software — and it is not FieldQuo's money in any sense.
//
// The distinction was written down, accurately, in a comment at the top of
// app/api/platform/analytics/overview/route.js. It was not written down on the
// screen, so both the owner and an external QA pass read the number as
// revenue. A caveat only the author reads is not a caveat.
//
// ── Nominal vs collectable ─────────────────────────────────────────────────
//
// MRR was "sum of priceMonthly across active subscriptions", which counts a
// trial that will never convert and a subscription Stripe has no object for.
// Collectable asks the narrower question: can this actually raise a charge next
// cycle, and the gap between the two is the useful number on the page.
//
// It used to ALSO require plan.stripePriceId, on the reasoning that without one
// "not one of them can raise a charge" — and reported collectable MRR as zero
// against a nominal $1,335. That reasoning was wrong, and the error was the
// same one that emptied the public pricing page (see lib/platform/
// sellablePlans.js). Checkout builds `price_data` INLINE, so Stripe mints its
// own Price and the Subscription references THAT. Our Plan row's price id has
// nothing to do with whether Stripe will bill it — Stripe bills a subscription
// it created on its own schedule, and the ten live subscriptions attached to
// price-id-less plans are all perfectly collectable.
//
// Reporting a total billing outage that was not happening is not the cautious
// direction to be wrong in: it buries a real one when it comes.

import { normaliseCurrency, UNKNOWN_CURRENCY } from "./metricFormat";

/**
 * Can this subscription actually raise a charge next cycle?
 *
 * `stripeSubscriptionId` is the test: Stripe has an object, and that object
 * carries its own Price — minted from the `price_data` checkout sent. A plan
 * row with no `stripePriceId` bills exactly the same.
 *
 * A zero or missing price is still not collectable: there is nothing to raise.
 */
export function isCollectable(sub) {
  if (!sub) return false;
  if (!sub.stripeSubscriptionId) return false;
  // Optional chaining because the plan-id guard that used to sit above this
  // was what stopped a subscription with no plan relation from throwing here.
  const price = Number(sub.plan?.priceMonthly);
  return Number.isFinite(price) && price > 0;
}

/**
 * WHY this subscription cannot raise a charge, in the words of the test above.
 *
 * ── The sentence this replaces was false, and checkably so ─────────────────
 *
 * It read `!stripeSubscriptionId ? "no Stripe subscription" : "the plan has no
 * Stripe price"`. The else branch is a claim `isCollectable` stopped making
 * two paragraphs above it: `stripePriceId` is not consulted anywhere in this
 * file, so the only way to reach that branch is a plan whose `priceMonthly` is
 * zero or missing. The console therefore printed "the plan has no Stripe
 * price" over rows whose `stripePriceId` was set and visible on the very next
 * screen — sending the reader to the Stripe dashboard for a bug that lives in
 * a Plan row, which is the exact misdirection lib/platform/sellablePlans.js
 * was written to end on the pricing page.
 *
 * `$0` is not a hypothetical shape: `Plan.priceMonthly` defaults to 0 and
 * `parsePlanFields` only refuses NEGATIVE prices, so "save the plan before
 * typing the price" produces it, and it is the one an operator actually hits.
 *
 * Derived from `isCollectable` rather than restated beside it, so the two
 * cannot drift again — the third time this project has paid for two opinions
 * about one question.
 *
 * @returns {"no_stripe_subscription"|"no_plan_price"|null}  null when it CAN bill.
 */
export function blockedReason(sub) {
  if (isCollectable(sub)) return null;
  if (!sub?.stripeSubscriptionId) return "no_stripe_subscription";
  return "no_plan_price";
}

/**
 * The one sentence a screen may print for each code, naming the field and the
 * fix. Neither mentions a Stripe price id, because neither cause is one.
 */
export const BLOCKED_REASON_TEXT = {
  no_stripe_subscription:
    "No Stripe subscription — checkout never completed, so there is nothing " +
    "for Stripe to bill.",
  no_plan_price:
    "The plan's monthly price is 0 — set a price above 0 on the plan and this " +
    "starts billing.",
};

const monthly = (sub) => Number(sub?.plan?.priceMonthly || 0);
const round2 = (n) => Math.round(n * 100) / 100;

// The currency a subscription bills in: its Plan's (one ladder per currency —
// Plan.currency, the Stripe currency the company signed up in). A plan with
// no readable code is filed under UNKNOWN_CURRENCY, never under a guessed one.
const currencyOf = (sub) => normaliseCurrency(sub?.plan?.currency) || UNKNOWN_CURRENCY;

/** Last moment of the month `date` falls in. */
function endOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Last moment of the month AFTER the one `date` falls in. */
function endOfNextMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 2, 0, 23, 59, 59, 999);
}

/**
 * Every MONEY figure of the outlook for one set of subscriptions. Called once
 * per currency (byCurrency) and once over the whole list — the latter is only
 * ever published when the list is in ONE currency (see buildRevenueOutlook).
 */
function moneyFigures(active, trialing, now) {
  const collectable = active.filter(isCollectable);
  const blocked = active.filter((s) => !isCollectable(s));
  const nominalMrr = round2(active.reduce((n, s) => n + monthly(s), 0));
  const collectableMrr = round2(collectable.reduce((n, s) => n + monthly(s), 0));
  const blockedMrr = round2(blocked.reduce((n, s) => n + monthly(s), 0));

  const thisMonthEnd = endOfMonth(now);
  const nextMonthEnd = endOfNextMonth(now);
  const convertingThisMonth = trialing.filter(
    (s) => s.trialEndsAt && new Date(s.trialEndsAt) <= thisMonthEnd,
  );
  const convertingNextMonth = trialing.filter(
    (s) =>
      s.trialEndsAt &&
      new Date(s.trialEndsAt) > thisMonthEnd &&
      new Date(s.trialEndsAt) <= nextMonthEnd,
  );
  const pipelineValue = (rows) =>
    round2(rows.filter(isCollectable).reduce((n, s) => n + monthly(s), 0));
  const nominalValue = (rows) => round2(rows.reduce((n, s) => n + monthly(s), 0));

  return {
    collectableMrr,
    annualRunRate: round2(collectableMrr * 12),
    nominalMrr,
    blockedMrr,
    thisMonth: {
      expected: round2(collectableMrr + pipelineValue(convertingThisMonth)),
      nominal: round2(nominalMrr + nominalValue(convertingThisMonth)),
    },
    nextMonth: {
      expected: round2(
        collectableMrr +
          pipelineValue(convertingThisMonth) +
          pipelineValue(convertingNextMonth),
      ),
      nominal: round2(
        nominalMrr +
          nominalValue(convertingThisMonth) +
          nominalValue(convertingNextMonth),
      ),
    },
    trials: {
      nominalValue: nominalValue(trialing),
      collectableValue: pipelineValue(trialing),
    },
  };
}

/**
 * The revenue outlook.
 *
 * ── One currency per number (owner decision 2026-10-03) ────────────────────
 *
 * Plans exist once per currency, so the book holds CAD, USD, AUD… side by
 * side. Every money figure is therefore ALSO returned per currency in
 * `byCurrency` — { CAD: { collectableMrr, annualRunRate, nominalMrr,
 * blockedMrr, thisMonth, nextMonth, trials }, USD: {…} } — and that is what a
 * screen prints (lib/platform/metricFormat.js moneyByCurrency). The top-level
 * money fields keep their old meaning only while the book is in ONE currency;
 * the moment it holds two they are null, because a sum across currencies is
 * not a number FieldQuo can state. Null, not omitted: absent is not zero, and
 * a reader still using the scalar prints "—" rather than a mixed total.
 * Counts (collectableCount, nominalCount, converting…) are currency-free and
 * unchanged.
 *
 * @param subs  [{ status, stripeSubscriptionId, trialEndsAt, plan:{priceMonthly, stripePriceId, currency}, company:{name} }]
 * @param now   injected so this is testable without freezing the clock
 */
export function buildRevenueOutlook(subs, now = new Date()) {
  const list = Array.isArray(subs) ? subs : [];

  const active = list.filter((s) => s.status === "active");
  const trialing = list.filter((s) => s.status === "trialing");

  const collectable = active.filter(isCollectable);
  // Active, believed to be paying, and structurally incapable of paying. This
  // is the number that should be zero and currently is not.
  const blocked = active.filter((s) => !isCollectable(s));

  // ── Trials, split by whether converting them would produce anything ──────
  //
  // A trial on a plan with no Stripe price does not convert into revenue; it
  // converts into a support ticket. Counting it in "pipeline" would be the
  // same overstatement as counting blocked subscriptions in MRR.
  const thisMonthEnd = endOfMonth(now);
  const nextMonthEnd = endOfNextMonth(now);

  const convertingThisMonth = trialing.filter(
    (s) => s.trialEndsAt && new Date(s.trialEndsAt) <= thisMonthEnd,
  );
  const convertingNextMonth = trialing.filter(
    (s) =>
      s.trialEndsAt &&
      new Date(s.trialEndsAt) > thisMonthEnd &&
      new Date(s.trialEndsAt) <= nextMonthEnd,
  );

  // Trials whose end date has already passed and which are still marked
  // trialing — nothing transitioned them. Surfaced rather than counted: they
  // are neither revenue nor pipeline until somebody decides which.
  const lapsed = trialing.filter(
    (s) => s.trialEndsAt && new Date(s.trialEndsAt) < now,
  );

  const currencies = [...new Set([...active, ...trialing].map(currencyOf))].sort();
  const byCurrency = {};
  for (const code of currencies) {
    byCurrency[code] = moneyFigures(
      active.filter((s) => currencyOf(s) === code),
      trialing.filter((s) => currencyOf(s) === code),
      now,
    );
  }
  const single = currencies.length <= 1;
  const all = moneyFigures(active, trialing, now);
  // The whole-book figure only when there is one currency to state it in.
  const one = (v) => (single ? v : null);

  return {
    // Which currencies the book bills in, and the money split by them. The
    // screen prints these; see the header.
    currencies,
    currency: currencies.length === 1 ? currencies[0] : null,
    mixedCurrencies: !single,
    byCurrency,

    // What is real.
    collectableMrr: one(all.collectableMrr),
    collectableCount: collectable.length,
    annualRunRate: one(all.annualRunRate),

    // What is claimed, and the gap.
    nominalMrr: one(all.nominalMrr),
    nominalCount: active.length,
    blockedMrr: one(all.blockedMrr),
    // Both the code and the sentence: a screen renders the sentence, a check
    // asserts on the code, and neither has to parse the other. Each row
    // carries its own currency, so its price is written in it.
    blocked: blocked.map((s) => {
      const code = blockedReason(s);
      return {
        company: s.company?.name || "—",
        plan: s.plan?.name || "—",
        monthly: monthly(s),
        currency: currencyOf(s),
        reasonCode: code,
        reason: BLOCKED_REASON_TEXT[code],
      };
    }),

    // Forward.
    thisMonth: {
      // Already-billing subscriptions renew this month; trials ending inside
      // it are the only additions.
      expected: one(all.thisMonth.expected),
      nominal: one(all.thisMonth.nominal),
      converting: convertingThisMonth.length,
    },
    nextMonth: {
      expected: one(all.nextMonth.expected),
      nominal: one(all.nextMonth.nominal),
      converting: convertingNextMonth.length,
    },

    trials: {
      count: trialing.length,
      nominalValue: one(all.trials.nominalValue),
      collectableValue: one(all.trials.collectableValue),
      lapsed: lapsed.length,
      lapsedCompanies: lapsed.map((s) => s.company?.name || "—"),
    },

    // True when the whole top line is aspirational. The dashboard should say
    // so in words rather than printing a confident $1,335.
    nothingCollectable: active.length > 0 && collectable.length === 0,
  };
}
