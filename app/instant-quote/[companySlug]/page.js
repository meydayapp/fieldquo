// app/instant-quote/[companySlug]/page.js
//
// "Get an instant estimate" — the public page behind the Cossette-style flow.
// A homeowner enters their address (or traces their lawn, or types an area),
// picks a material, and sees a real starting RANGE in seconds. It creates a
// draft the company must approve; it never promises a binding price.
//
// Indexed like the request-a-quote page — a company running an ad wants it
// findable, and nothing on it is private.
export const dynamic = "force-dynamic";

import InstantQuoteFlow from "./InstantQuoteFlow";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  return {
    title: "Get an instant estimate",
    description:
      "Enter your address for a real starting price in seconds — measured from satellite imagery.",
    alternates: { canonical: `/instant-quote/${companySlug}` },
  };
}

export default async function InstantQuotePage({ params }) {
  const { companySlug } = await params;
  return <InstantQuoteFlow companySlug={companySlug} />;
}
