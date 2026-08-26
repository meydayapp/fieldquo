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

const monthly = (sub) => Number(sub?.plan?.priceMonthly || 0);
const round2 = (n) => Math.round(n * 100) / 100;

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
 * The revenue outlook.
 *
 * @param subs  [{ status, stripeSubscriptionId, trialEndsAt, plan:{priceMonthly, stripePriceId}, company:{name} }]
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

  const nominalMrr = round2(active.reduce((n, s) => n + monthly(s), 0));
  const collectableMrr = round2(collectable.reduce((n, s) => n + monthly(s), 0));
  const blockedMrr = round2(blocked.reduce((n, s) => n + monthly(s), 0));

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

  const pipelineValue = (rows) =>
    round2(rows.filter(isCollectable).reduce((n, s) => n + monthly(s), 0));
  const nominalValue = (rows) => round2(rows.reduce((n, s) => n + monthly(s), 0));

  // Trials whose end date has already passed and which are still marked
  // trialing — nothing transitioned them. Surfaced rather than counted: they
  // are neither revenue nor pipeline until somebody decides which.
  const lapsed = trialing.filter(
    (s) => s.trialEndsAt && new Date(s.trialEndsAt) < now,
  );

  return {
    // What is real.
    collectableMrr,
    collectableCount: collectable.length,
    annualRunRate: round2(collectableMrr * 12),

    // What is claimed, and the gap.
    nominalMrr,
    nominalCount: active.length,
    blockedMrr,
    blocked: blocked.map((s) => ({
      company: s.company?.name || "—",
      plan: s.plan?.name || "—",
      monthly: monthly(s),
      reason: !s.stripeSubscriptionId
        ? "no Stripe subscription"
        : "the plan has no Stripe price",
    })),

    // Forward.
    thisMonth: {
      // Already-billing subscriptions renew this month; trials ending inside
      // it are the only additions.
      expected: round2(collectableMrr + pipelineValue(convertingThisMonth)),
      nominal: round2(nominalMrr + nominalValue(convertingThisMonth)),
      converting: convertingThisMonth.length,
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
      converting: convertingNextMonth.length,
    },

    trials: {
      count: trialing.length,
      nominalValue: nominalValue(trialing),
      collectableValue: pipelineValue(trialing),
      lapsed: lapsed.length,
      lapsedCompanies: lapsed.map((s) => s.company?.name || "—"),
    },

    // True when the whole top line is aspirational. The dashboard should say
    // so in words rather than printing a confident $1,335.
    nothingCollectable: active.length > 0 && collectable.length === 0,
  };
}
