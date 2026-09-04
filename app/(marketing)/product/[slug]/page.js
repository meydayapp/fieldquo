// app/(marketing)/product/[slug]/page.js
//
// Server half: routing, static params and metadata. All rendering lives in
// ProductPageContent, which is a client component because translation is in
// React context. generateMetadata and generateStaticParams cannot move there,
// which is why the page is split rather than simply marked "use client" —
// the same split as /industries/[slug] and /features/[slug].
import { notFound } from "next/navigation";
import { PRODUCT_FEATURES } from "@/app/data/productFeatures";
import { marketingMetadata } from "@/lib/marketing/metadata";
import ProductPageContent from "./ProductPageContent";

export function generateStaticParams() {
  return Object.keys(PRODUCT_FEATURES).map((slug) => ({ slug }));
}

// Metadata stays English. It is what search engines index, and serving a
// French title to an English crawler because the last visitor switched
// languages would be worse than not translating it. Proper multilingual SEO
// needs locale-prefixed routes (/fr/product/...), which is a routing change
// rather than a copy change — the same decision recorded on /industries/[slug]
// and /features/[slug], and scoped out at the end of docs/ROADMAP.md.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const feature = PRODUCT_FEATURES[slug];
  if (!feature) return {};

  return marketingMetadata({
    path: `/product/${slug}`,
    title: `${feature.label} — FieldQuo`,
    description: feature.description,
  });
}

export default async function ProductFeaturePage({ params }) {
  // Next 16: params is a Promise. Read synchronously it's undefined, so every
  // /product/* page hit notFound() and returned a 404 — the content was there
  // the whole time. Same bug class as the API routes, but pages weren't in
  // that sweep.
  const { slug } = await params;

  if (!PRODUCT_FEATURES[slug]) return notFound();

  return <ProductPageContent slug={slug} />;
}
