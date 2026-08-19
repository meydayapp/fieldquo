// app/(marketing)/pricing/page.js
//
// Server half: the Plan read, the visitor's currency, and the metadata export.
// All rendering is in PricingPlans, which is a client component because
// translation lives in React context. Same split as /industries/[slug].
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { currencyForCountry } from "@/lib/currency";
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

export default async function PricingPage() {
  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });

  // Which currency the visitor would actually be billed in.
  //
  // A Plan row stores ONE number; lib/platform/stripeBilling.js charges it in
  // company.currency, which is derived from the country chosen at signup. So
  // the page has to name a currency or it isn't quoting a price at all.
  //
  // x-vercel-ip-country is set by the edge in production and absent locally
  // and on other hosts, which is why currencyForCountry falls back rather than
  // throwing. It's a starting guess, not a promise — the copy under the grid
  // says the billing currency is fixed by the country picked at signup, which
  // is the thing that's actually true.
  const country = (await headers()).get("x-vercel-ip-country");
  const currency = currencyForCountry(country);

  // Prisma Decimal doesn't cross the server/client boundary. Serialise here
  // rather than letting the RSC payload throw at render time.
  const serialised = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceMonthly: Number(plan.priceMonthly),
    maxUsers: plan.maxUsers,
    maxQuotesPerMonth: plan.maxQuotesPerMonth,
    aiCopilotEnabled: plan.aiCopilotEnabled,
    features: plan.features || null,
  }));

  return <PricingPlans plans={serialised} currency={currency} />;
}
