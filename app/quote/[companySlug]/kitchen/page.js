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
    select: { slug: true, name: true, logoUrl: true, brandColor: true },
  });
  // A wrong slug is a 404, not an empty designer. Someone who mistypes a
  // contractor's link should be told, not handed a blank kitchen to fill in for
  // a company that doesn't exist.
  if (!company) notFound();

  return <KitchenSelfQuote company={company} />;
}
