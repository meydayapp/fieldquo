// app/quote/[companySlug]/kitchen/page.js
//
// Public "design your own kitchen" page, reached from the contractor's website.
//
// Server shell so the company's name, logo and brand colour are in the FIRST
// paint. Fetching them client-side would show a stranger an unbranded page for
// a beat, and on the one surface where FieldQuo must be invisible, a flash of
// generic chrome is the thing that gives it away.
import { notFound } from "next/navigation";
import { companyOffersKitchenDesign } from "@/lib/kitchen/access";
// The SAME resolver as /quote/[companySlug] next door — bookingSlug first,
// then slug. This page read `Company.slug` alone, so the link Share your
// links hands out (built from bookingSlug, like every other public link) 404'd
// for any company whose two slugs differ, and nothing said why.
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import KitchenSelfQuote from "./KitchenSelfQuote";
import {
  CLIENT_META_COMPANY_SELECT,
  clientPageMetadata,
  neutralClientMetadata,
} from "@/lib/whiteLabel/pageMetadata";

// Title and description as before; the icon, share image and the rest of the
// head are now the company's too (lib/whiteLabel/pageMetadata.js) instead of
// the root layout's FieldQuo favicon.
export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, CLIENT_META_COMPANY_SELECT);
  if (!company) return neutralClientMetadata({ title: "Not found" });
  return clientPageMetadata(company, {
    title: `Design your kitchen — ${company.name}`,
    description: `Lay out your kitchen and get a price from ${company.name}.`,
  });
}

export default async function Page({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, {
    id: true,
    slug: true,
    name: true,
    logoUrl: true,
    brandColor: true,
  });
  // A wrong slug is a 404, not an empty designer. Someone who mistypes a
  // contractor's link should be told, not handed a blank kitchen to fill in for
  // a company that doesn't exist.
  if (!company) notFound();

  // A company without the designer — no kitchen-building trade enabled, or
  // its own override set to off (lib/kitchen/access.js, the one gate) — gets
  // the same 404 a wrong slug does. There's no logged-in session and no
  // existing quote to fall back on here, unlike the internal designer, so
  // there's nothing to preserve access to. A link a company never published
  // (nothing links here until the gate opens) must not still work by URL.
  if (!(await companyOffersKitchenDesign(company.id))) notFound();

  return <KitchenSelfQuote company={company} />;
}
