// app/(marketing)/page.js
//
// The homepage, rebuilt 2026-09-29 to the owner-approved structure from a UX
// designer's review: hero, product demo, results, how it works, your trade,
// outcomes, FieldQuo AI, why one system, customer story, pricing, FAQ, final
// ask. Every section lives in app/components/marketing/home/ and is listed,
// in order, in scripts/check-homepage-sections.mjs.
//
// ══ Why this file reads the database now ═══════════════════════════════════
//
// Two sections print things that change without a deploy: the sale pill
// above the headline (a PlatformPromotion switched on at /platform) and the
// plan prices. Both are resolved HERE, on the server, through the functions
// /pricing uses — livePromotions → universalPromotions → withOffers — so the
// homepage cannot announce a sale the checkout would not charge, or a price
// /pricing does not show. The browser receives the resolved offers, never a
// promotion to apply (non-negotiable #5).
//
// ══ ISR at 60 seconds, not force-dynamic ═══════════════════════════════════
//
// /pricing is force-dynamic. The homepage is the most-visited page and Neon
// scales to zero, so a per-request read would put a cold database start in
// front of every first visitor. A minute of staleness is the trade: a sale
// switched on or off shows within a minute. Every read below is guarded, so a
// build or a revalidation that cannot reach the database renders the page
// without prices and without a pill — plainer, never broken, and never a
// price nobody resolved.
import { db } from "@/lib/db";
import { partitionPlans } from "@/lib/platform/sellablePlans";
import { livePromotions, universalPromotions, withOffers } from "@/lib/billing/promotions";
import { oneRowPerTier } from "@/lib/pricing/oneRowPerTier";
import { homeSalePill } from "@/lib/marketing/homeSale";
import { recordError } from "@/lib/platform/errorLog";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { GRACE_DAYS } from "@/lib/billing/access";
import { LANGUAGES } from "@/app/i18n/languages";
import { SUPPORTED_EMAIL_LANGUAGES } from "@/lib/i18n/emailCopy";
import { APP_LANGUAGES } from "@/app/i18n/appMessages";
import HomeHero from "@/app/components/marketing/home/HomeHero";
import ProductDemo from "@/app/components/marketing/home/ProductDemo";
import ResultsResearch from "@/app/components/marketing/home/ResultsResearch";
import HowItWorks from "@/app/components/marketing/home/HowItWorks";
import TradeSelector from "@/app/components/marketing/home/TradeSelector";
import OutcomeGroups from "@/app/components/marketing/home/OutcomeGroups";
import AskAI from "@/app/components/marketing/home/AskAI";
import OneSystem from "@/app/components/marketing/home/OneSystem";
import CustomerStory from "@/app/components/marketing/home/CustomerStory";
import HomePricing from "@/app/components/marketing/home/HomePricing";
import HomeFAQ from "@/app/components/marketing/home/HomeFAQ";
import FinalCTA from "@/app/components/marketing/home/FinalCTA";

export const revalidate = 60;

// Per-page metadata across the marketing site — see lib/marketing/metadata.js,
// including why there is no root-level title template.
export const metadata = marketingMetadata({
  path: "/",
  title: "FieldQuo — run your entire field service business from one place",
  description:
    "Quote jobs, schedule your crew, invoice customers and get paid — one system for painters, roofers, plumbers, electricians, landscapers and every other trade, instead of five different apps.",
});

/** Native names, from the one list of languages — never typed on the page. */
const namesOf = (codes) =>
  LANGUAGES.filter((l) => codes.includes(l.code)).map((l) => l.nativeName);

async function pricingAndSale(now) {
  try {
    // No `select`, for the reason /pricing gives over the same read:
    // isSellable reads a missing isPublic as "not stated", so a narrowed read
    // would let a privately negotiated rate advertise itself here.
    const allPlans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
    const { sellable } = partitionPlans(allPlans);
    const ladder = oneRowPerTier(sellable).filter((p) => p.tierKey);
    const promotions = universalPromotions(
      await livePromotions({ now }),
      [...new Set(sellable.filter((p) => p.tierKey).map((p) => p.currency))],
    );
    const priced = withOffers(ladder, { promotions, now });
    return {
      sale: homeSalePill({ promotions, plans: priced }),
      // Decimals do not cross into a client component; the offers are plain.
      plans: priced.map((p) => ({
        id: p.id,
        name: p.name,
        tierKey: p.tierKey,
        currency: p.currency,
        seats: p.seats,
        crewSeats: p.crewSeats,
        maxUsers: p.maxUsers,
        offers: p.offers,
      })),
    };
  } catch (err) {
    await recordError({
      area: "marketing",
      code: "homepage_pricing_unreadable",
      message: `Homepage rendered without prices or a sale pill: ${err?.message || err}`,
    }).catch(() => {});
    return { sale: null, plans: [] };
  }
}

export default async function HomePage() {
  const { sale, plans } = await pricingAndSale(new Date());

  const languages = {
    email: namesOf(SUPPORTED_EMAIL_LANGUAGES),
    app: namesOf(APP_LANGUAGES),
  };

  return (
    <>
      <HomeHero sale={sale} />
      <ProductDemo />
      <ResultsResearch />
      <HowItWorks />
      <TradeSelector />
      <OutcomeGroups />
      <AskAI />
      <OneSystem />
      <CustomerStory />
      <HomePricing plans={plans} />
      <HomeFAQ graceDays={GRACE_DAYS} languages={languages} />
      <FinalCTA />
    </>
  );
}
