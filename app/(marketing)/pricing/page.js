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
import { marketingMetadata, siteOrigin } from "@/lib/marketing/metadata";
import { pricingProductLd } from "@/lib/seo/structuredData";
import { scriptSafeJson } from "@/lib/security/scriptSafeJson";
import { currencyMeta } from "@/lib/currency";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { recordError } from "@/lib/platform/errorLog";
import { oneRowPerTier } from "@/lib/pricing/oneRowPerTier";
import PricingPlans from "./PricingPlans";
import { resolveAiCap } from "@/lib/ai/usage";
import { chosenCurrency, currencyOptions } from "@/lib/pricing/visitorCurrency";
import { aiAdviceUnits, aiAdviceBundles } from "@/lib/ai/planAdviceUnits";

// Rendered per request, not at build time.
//
// Without this, Next statically prerenders the page during `next build`,
// which means the BUILD needs a reachable database — a deploy then fails
// with "Can't reach database server" for reasons that have nothing to do
// with the code being deployed. It also contradicts the intent below: a
// prerendered page would freeze whatever plans existed at build time and
// keep serving them until the next deploy.
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Simple monthly pricing for field service teams, by headcount. Quotes, invoicing, scheduling and payments in every plan. 14 days free, no contract.";

/** The currency the one-per-URL statements (the <title>, the JSON-LD) speak in. */
export const CANONICAL_CURRENCY = "CAD";

/**
 * The promotions the DEFAULT page shows: only those that apply in every
 * currency the ladder is sold in, because the unchosen page stands in for
 * all of them. One function, called by the render AND by generateMetadata.
 *
 * ══ The live bug this replaced (2026-10-15) ═══════════════════════════════
 *
 * The title used to compute its own promotion set from the COLLAPSED rows
 * (oneRowPerTier keeps one row per tier, so its currencies are a subset of
 * what is sold). A sale scoped to that subset passed universalPromotions
 * there and failed it here, so production's title read "from $59.40/mo"
 * — a 28%-off year — while every card and the JSON-LD said $82.50 with no
 * sale. Two places deciding which sale applies is how they came to disagree;
 * now there is one.
 */
function defaultPromotions(live, sellable) {
  return universalPromotions(live, [...new Set(sellable.filter((p) => p.tierKey).map((p) => p.currency))]);
}

/**
 * The canonical ladder: the CAD tier rows priced under the DEFAULT page's
 * promotions. What the <title> and the Product JSON-LD both read — never a
 * visitor's chosen currency, because a title and a structured-data block are
 * one per URL and a search engine sees exactly one of them.
 */
export function canonicalLadder({ sellable, promotions, now }) {
  const rows = oneRowPerTier(sellable.filter((p) => p.tierKey && p.currency === CANONICAL_CURRENCY));
  return withOffers(rows, { promotions, now });
}

/** The cheapest 1-year monthly-equivalent on the canonical ladder, or null. */
export function entryYearPerMonth(ladder) {
  const perMonth = (ladder || [])
    .map((p) => (p.offers?.year?.available ? Number(p.offers.year.perMonth) : null))
    .filter((n) => Number.isFinite(n) && n > 0);
  return perMonth.length ? Math.min(...perMonth) : null;
}

/**
 * 82.5 → "$82.50", 99 → "$99", 1234 → "$1,234": the canonical currency's
 * symbol and the English card's own rule — offerMoney in
 * app/components/billing/PlanOfferPrice.js, which this server module cannot
 * import because that file is a client module. check:site-seo renders the
 * default card and asserts the title's string equals the card's, so the two
 * cannot drift apart unnoticed.
 */
export function titlePrice(n) {
  const v = Number(n);
  const whole = Math.round(v * 100) % 100 === 0;
  return `${currencyMeta(CANONICAL_CURRENCY).symbol}${v.toLocaleString(
    numberLocaleFor("en"),
    whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;
}

// ── The <title> (site audit D5.1, 2026-10-15) ────────────────────────────
//
// It was "Pricing — FieldQuo": no category keyword, no price. Now the
// category and the entry price, with the honest marker the owner asked for:
// the page opens on the 1-year tab, so the figure is the 1-year price per
// month, and a title cannot carry the asterisk the cards have — so it says
// "billed yearly" in words. Generated per request, because /pricing is
// force-dynamic and the price lives in the Plan table, not in this file.
export async function generateMetadata() {
  let title = "Field service software pricing | FieldQuo";
  try {
    const now = new Date();
    const { sellable } = partitionPlans(await db.plan.findMany({ orderBy: { priceMonthly: "asc" } }));
    const promotions = defaultPromotions(await livePromotions({ now }), sellable);
    const entry = entryYearPerMonth(canonicalLadder({ sellable, promotions, now }));
    if (entry !== null) title = `Field service software from ${titlePrice(entry)}/mo billed yearly | FieldQuo`;
  } catch {
    // The fallback title, never a remembered price.
  }
  return marketingMetadata({ path: "/pricing", title, description: DESCRIPTION });
}

// Lives in lib/pricing/oneRowPerTier.js — the homepage's pricing band uses it
// too. Re-exported so check:pricing-page's import of it from here still holds.
export { oneRowPerTier };

export default async function PricingPage({ searchParams } = {}) {
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
  // searchParams is a Promise in Next 16; the check calls this with nothing.
  const query = (await searchParams) || {};
  const shownCurrency = chosenCurrency(query.currency, sellable);
  // A chosen currency shows ITS rows (plus any legacy row with no tierKey,
  // which has no twin and always stood alone); otherwise the collapse below.
  const plans = oneRowPerTier(
    shownCurrency ? sellable.filter((p) => !p.tierKey || p.currency === shownCurrency) : sellable,
  );

  // There is no geo read here, and that is the fix rather than an omission.
  // x-vercel-ip-country told us where the REQUEST came from, which is not
  // where the business is; the copy under the grid explains that the billing
  // currency comes from the address given at signup. The visitor may CHOOSE
  // the currency the cards are printed in (chosenCurrency above).

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
  // With a chosen currency the page stands in for that one alone, so a sale
  // scoped to it may be shown; otherwise every currency it collapses — the
  // same defaultPromotions the <title> uses.
  const live = await livePromotions({ now });
  const promotions = shownCurrency ? universalPromotions(live, [shownCurrency]) : defaultPromotions(live, sellable);
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
    // The plan's capped AI allowance (owner, 2026-10-04: every plan keeps a
    // cap) — resolved by the gate's own function and sent as { cap, unit },
    // never a price. The card turns it into "about N quote reviews a month".
    aiAllowance: resolveAiCap({ subscription: { plan } }),
    features: plan.features || null,
  }));
  // Unit costs for the AI advisor, from the metered prices — lib/ai/planAdviceUnits.js.
  const aiAdvice = { units: aiAdviceUnits(), bundles: aiAdviceBundles() };

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

  // Product JSON-LD (site audit D5.5): the canonical CAD ladder under the
  // DEFAULT page's promotions — exactly what the <title> reads, whatever
  // currency this visitor chose — so the two one-per-URL statements cannot
  // disagree with each other or with the default cards.
  // lib/seo/structuredData.js. Never allowed to break the page.
  let productLd = null;
  try {
    productLd = pricingProductLd({
      origin: siteOrigin(),
      plans: canonicalLadder({ sellable, promotions: defaultPromotions(live, sellable), now }),
    });
  } catch (err) {
    await recordError({
      area: "marketing",
      code: "pricing_jsonld",
      message: `Pricing structured data not built: ${err?.message || err}`,
    }).catch(() => {});
  }

  return (
    <>
    {productLd ? (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptSafeJson(productLd) }} />
    ) : null}
    <PricingPlans
      plans={serialised}
      customOffer={customOffer}
      aiAdvice={aiAdvice}
      currencyChoice={{ shown: shownCurrency, options: currencyOptions(sellable) }}
    />
    </>
  );
}
