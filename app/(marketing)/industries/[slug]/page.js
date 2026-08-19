// app/(marketing)/industries/[slug]/page.js
//
// Server half: routing, static params and metadata. All rendering lives in
// IndustryPageContent, which is a client component because translation is in
// React context. generateMetadata and generateStaticParams can't move there,
// which is why the page is split rather than simply marked "use client".

import { notFound } from "next/navigation";
import { INDUSTRIES } from "@/app/data/industries";
import { INDUSTRY_CONTENT } from "@/app/data/industryContent";
import { marketingMetadata } from "@/lib/marketing/metadata";
import IndustryPageContent from "./IndustryPageContent";

export function generateStaticParams() {
  return INDUSTRIES.map((ind) => ({ slug: ind.slug }));
}

// Metadata stays English-only for now. It's what search engines index, and
// serving a French title to an English crawler because the last visitor
// switched languages would be worse than not translating it. Proper
// multilingual SEO needs locale-prefixed routes (/fr/industries/...), which
// is a routing change rather than a copy change — scoped out at the end of
// docs/ROADMAP.md.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const industry = INDUSTRY_CONTENT[slug];
  if (!industry) return {};

  // Each trade gets its own headline as the title, which is the point of
  // having twelve pages: a dozen tabs all reading "FieldQuo" is a dozen pages
  // competing for the same query.
  return marketingMetadata({
    path: `/industries/${slug}`,
    title: `${industry.headline} | FieldQuo`,
    description: industry.description,
  });
}

export default async function IndustryPage({ params }) {
  // Next 16: params is a Promise. Reading it synchronously logged a
  // sync-dynamic-apis error on every render of every industry page.
  const { slug } = await params;
  const industry = INDUSTRY_CONTENT[slug];
  if (!industry) return notFound();

  return <IndustryPageContent slug={slug} videoId={industry.videoId} />;
}
