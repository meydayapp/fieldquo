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
import { loadPublicFormLook } from "@/lib/estimate/publicFormLook";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import {
  CLIENT_META_COMPANY_SELECT,
  clientPageMetadata,
  neutralClientMetadata,
} from "@/lib/whiteLabel/pageMetadata";

// Same sentence as always; the company's name in the tab, and its icon and
// share image, now replace the root layout's FieldQuo ones — this is the link
// a company runs an ad with (lib/whiteLabel/pageMetadata.js).
const DESCRIPTION =
  "Enter your address for a real starting price in seconds — measured from satellite imagery.";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const canonical = { alternates: { canonical: `/instant-quote/${companySlug}` } };
  const company = await findBookingCompany(companySlug, CLIENT_META_COMPANY_SELECT).catch(() => null);
  if (!company) {
    return { ...neutralClientMetadata({ title: "Get an instant estimate", description: DESCRIPTION }), ...canonical };
  }
  return {
    ...clientPageMetadata(company, {
      title: `Get an instant estimate · ${company.name}`,
      description: DESCRIPTION,
    }),
    ...canonical,
  };
}

export default async function InstantQuotePage({ params }) {
  const { companySlug } = await params;
  // The company's chosen look, read here so it is in the server-rendered
  // HTML (the font link before first paint) and never on the URL.
  const look = await loadPublicFormLook(companySlug);
  return <InstantQuoteFlow companySlug={companySlug} look={look} />;
}
