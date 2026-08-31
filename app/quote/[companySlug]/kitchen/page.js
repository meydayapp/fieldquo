// app/quote/[companySlug]/kitchen/page.js
//
// Public "design your own kitchen" page, reached from the contractor's website.
//
// Server shell so the company's name, logo and brand colour are in the FIRST
// paint. Fetching them client-side would show a stranger an unbranded page for
// a beat, and on the one surface where FieldQuo must be invisible, a flash of
// generic chrome is the thing that gives it away.
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companyOffersKitchenDesign } from "@/lib/kitchen/access";
import KitchenSelfQuote from "./KitchenSelfQuote";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { name: true },
  });
  if (!company) return { title: "Not found" };
  return {
    title: `Design your kitchen — ${company.name}`,
    description: `Lay out your kitchen and get a price from ${company.name}.`,
  };
}

export default async function Page({ params }) {
  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true },
  });
  // A wrong slug is a 404, not an empty designer. Someone who mistypes a
  // contractor's link should be told, not handed a blank kitchen to fill in for
  // a company that doesn't exist.
  if (!company) notFound();

  // A company that has never turned on "Kitchen Design & New Installs" gets
  // the same 404 a wrong slug does — there's no logged-in session and no
  // existing quote to fall back on here, unlike the internal designer, so
  // there's nothing to preserve access to. A link a company never published
  // (this page isn't linked from anywhere until they turn the service on)
  // must not still work by URL.
  if (!(await companyOffersKitchenDesign(company.id))) notFound();

  return <KitchenSelfQuote company={company} />;
}
