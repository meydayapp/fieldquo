// app/(marketing)/pricing/page.js
//
// Server half: the Plan read, the collapse of the currency pairs, and the
// metadata export. It deliberately knows nothing about the visitor — see the
// note where the geo read used to be.
// All rendering is in PricingPlans, which is a client component because
// translation lives in React context. Same split as /industries/[slug].
import { db } from "@/lib/db";
import { partitionPlans } from "@/lib/platform/sellablePlans";
import { marketingMetadata } from "@/lib/marketing/metadata";
import PricingPlans from "./PricingPlans";

// Rendered per request, not at build time.
//
// Without this, Next statically prerenders the page during `next build`,
// which means the BUILD needs a reachable database — a deploy then fails
// with "Can't reach database server" for reasons that have nothing to do
// with the code being deployed. It also contradicts the intent below: a
// prerendered page would freeze whatever plans existed at build time and
// keep serving them until the next deploy.
export const dynamic = "force-dynamic";

export const metadata = marketingMetadata({
  path: "/pricing",
  title: "Pricing — FieldQuo",
  description:
    "Simple monthly pricing for field service teams, by headcount. Quotes, invoicing, scheduling and payments in every plan. First month free, no contract.",
});

const priceOf = (plan) => {
  const n = Number(plan?.priceMonthly);
  return Number.isFinite(n) ? n : 0;
};

/**
 * One card per TIER, not one card per Plan row.
 *
 * ══ Why the naive read renders eight cards ═════════════════════════════════
 *
 * Every rung of the ladder exists TWICE in the Plan table — once with currency
 * CAD, once with USD — carrying the SAME NUMBER rather than a conversion (see
 * SEAT_LADDER in lib/pricing/ladder.js for why). A findMany with no currency
 * filter therefore returns Solo, Solo, Crew, Crew, Shop, Shop, Scale, Scale,
 * and the page printed all eight: four pairs of identical prices, each pair
 * with a different buy link. /api/marketing/plans already selects `currency`
 * and `tierKey` precisely because of this; the public page never got the fix.
 *
 * ══ Why it does not filter by the visitor's currency instead ═══════════════
 *
 * That was the previous shape and it is the thing the owner objected to: you
 * cannot tell from an IP whether somebody is in Canada, the USA or Europe, and
 * a geo guess that picks a row is a guess that names a price in a currency. So
 * the page collapses the pair instead of choosing between them. Both rows say
 * the same number, so there is nothing to choose — and the buy link now carries
 * the TIER, which is currency-free, so the visitor's actual currency is
 * resolved at signup from the address they give.
 *
 * ══ The row that represents the pair ═══════════════════════════════════════
 *
 * Highest price wins, ties broken by currency code so the same card renders on
 * every request. "First row wins" was rejected: if an operator ever edits one
 * currency's row and not its twin, first-wins can advertise the lower of two
 * real prices and bill the higher, which is a number the visitor was shown and
 * is right to expect. Quoting the higher of a disagreeing pair is the error
 * that costs us a signup rather than the one that costs a customer money.
 *
 * A row with no tierKey is a legacy per-headcount plan with no twin to collapse
 * into, so it stands alone under its own id — folding all of them together
 * would delete plans rather than de-duplicate them.
 */
export function oneRowPerTier(plans) {
  const list = Array.isArray(plans) ? plans : [];
  const ranked = [...list].sort(
    (a, b) =>
      priceOf(b) - priceOf(a) ||
      String(a?.currency ?? "").localeCompare(String(b?.currency ?? "")),
  );

  const byTier = new Map();
  for (const plan of ranked) {
    const key = plan?.tierKey ? `tier:${plan.tierKey}` : `row:${plan?.id}`;
    if (!byTier.has(key)) byTier.set(key, plan);
  }

  // Cheapest first, which is the order the grid was already read in. sortOrder
  // breaks a tie rather than the map's insertion order, so two rungs that ever
  // share a price still render in the order an operator set.
  return [...byTier.values()].sort(
    (a, b) =>
      priceOf(a) - priceOf(b) || (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0),
  );
}

export default async function PricingPage() {
  // Deliberately no `select`. A narrow one would have to remember `isPublic`,
  // and isSellable reads a MISSING column as "not stated" rather than as
  // "private" — so the day somebody trims this query for tidiness, a rate
  // negotiated with one company (lib/billing/customPlan.js writes
  // isPublic: false) starts advertising itself to every visitor. The route at
  // /api/marketing/plans carries the same warning over its own select.
  const allPlans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });

  // Only what can actually be bought. A plan with no Stripe price id renders
  // here with a live buy button and fails the moment someone presses it —
  // which reads to the visitor as their card being declined, not as our
  // configuration being incomplete. See lib/platform/sellablePlans.js.
  //
  // The page's existing empty state routes to /contact, which is the right
  // answer when there is nothing to sell: a human beats a checkout that can't
  // complete.
  const { sellable } = partitionPlans(allPlans);
  const plans = oneRowPerTier(sellable);

  // There is no geo read here any more, and that is the fix rather than an
  // omission. x-vercel-ip-country told us where the REQUEST came from, which is
  // not where the business is; the copy under the grid now explains that the
  // billing currency comes from the address given at signup, which is the only
  // thing about it that is knowable from this page.

  // Prisma Decimal doesn't cross the server/client boundary. Serialise here
  // rather than letting the RSC payload throw at render time.
  const serialised = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceMonthly: Number(plan.priceMonthly),
    // The row's OWN currency column, not a guess about the reader. It picks the
    // symbol and is never printed as a code — see the price block in
    // PricingPlans.
    currency: plan.currency,
    // Currency-free, and what the buy link is built from.
    tierKey: plan.tierKey,
    // Seats and crew separately. maxUsers is their SUM and is kept only for the
    // legacy rows that have no crew concept at all.
    seats: plan.seats,
    crewSeats: plan.crewSeats,
    maxUsers: plan.maxUsers,
    maxQuotesPerMonth: plan.maxQuotesPerMonth,
    aiCopilotEnabled: plan.aiCopilotEnabled,
    features: plan.features || null,
  }));

  return <PricingPlans plans={serialised} />;
}
