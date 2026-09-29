// app/(marketing)/pricing/page.js
//
// Server half: the Plan read, the collapse of the currency pairs, and the
// metadata export. It deliberately knows nothing about the visitor — see the
// note where the geo read used to be.
// All rendering is in PricingPlans, which is a client component because
// translation lives in React context. Same split as /industries/[slug].
import { db } from "@/lib/db";
import { partitionPlans } from "@/lib/platform/sellablePlans";
import { customOfferFromScale } from "@/lib/billing/customPlan";
import { livePromotions, universalPromotions, withOffers, customOfferTable } from "@/lib/billing/promotions";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { oneRowPerTier } from "@/lib/pricing/oneRowPerTier";
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
    "Simple monthly pricing for field service teams, by headcount. Quotes, invoicing, scheduling and payments in every plan. 14 days free, no contract.",
});

// Lives in lib/pricing/oneRowPerTier.js — the homepage's pricing band uses it
// too. Re-exported so check:pricing-page's import of it from here still holds.
export { oneRowPerTier };

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
  // ── The prices, resolved on the server ───────────────────────────────────
  //
  // Month and 1-year offers for every card under the promotions running now
  // (lib/billing/promotions.js — the resolver the checkout reprices with).
  // Only a promotion that applies in EVERY currency the page is standing in
  // for is shown: this page cannot know the visitor's currency, and a
  // CAD-only sale printed here would be promised to an American.
  const now = new Date();
  const promotions = universalPromotions(
    await livePromotions({ now }),
    [...new Set(sellable.filter((p) => p.tierKey).map((p) => p.currency))],
  );
  const offersById = new Map(withOffers(plans, { promotions, now }).map((p) => [p.id, p.offers]));

  const serialised = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceMonthly: Number(plan.priceMonthly),
    priceAnnual: plan.priceAnnual === null || plan.priceAnnual === undefined ? null : Number(plan.priceAnnual),
    offers: offersById.get(plan.id) || null,
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

  // The fifth card — "Need more people?" — prices itself from the Scale row
  // this page is already showing, through the same function the server mints
  // the row with (lib/billing/customPlan.js). No Scale row, no card: a
  // stepper with no price is a dead control.
  const scale = plans.find((p) => p.tierKey === "scale") || null;
  const rawOffer = scale ? customOfferFromScale(scale) : null;
  const customOffer = rawOffer
    ? { ...rawOffer, baseMonthly: Number(rawOffer.baseMonthly), baseAnnual: rawOffer.baseAnnual === null ? null : Number(rawOffer.baseAnnual) }
    : null;
  if (customOffer) customOffer.offers = customOfferTable(customOffer, { promotions, now });

  return <PricingPlans plans={serialised} customOffer={customOffer} />;
}
