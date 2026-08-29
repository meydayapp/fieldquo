// app/(marketing)/features/[slug]/page.js
//
// Server half of the feature pages: routing, static params and metadata.
// Everything a visitor reads is rendered by FeaturePageContent, which is a
// client component because translation is React context.
//
// ══ Two levels in one namespace, and why there is no third URL ═════════════
//
// /pricing names 29 features. The owner asked for a page for each of them. This
// route already served 25 pages, and 17 of those 25 were ALREADY the page about
// one of the 29 — /features/invoicing is the invoices page, /features/team is
// the team-access page. Minting /features/invoices beside /features/invoicing
// would put two pages about one subject on one site: they compete for the same
// search, they drift apart the first time one is edited, and a visitor who
// finds the thinner one gets the worse answer. That is the marketing form of
// shipping two controls that look like they do the same thing.
//
// So there is one page per subject and one namespace, and a page declares which
// role it is playing in DATA rather than by convention:
//
//   page.feature      set → this is the canonical page for that one of the 29.
//                     The hero says so, in the matrix's own words, and the
//                     page owes the reader `details` — the specifics.
//   page.features     everything the page claims. When it carries keys beyond
//                     its own `feature`, the page is also a HUB, and the "More
//                     in this area" strip links each of those to ITS canonical
//                     page. Derived, so it cannot go stale.
//
// A page with no `feature` (leads, marketing, crew, reporting, languages…) is a
// pure hub: it sells an area and hands off to the pages under it.
//
// ══ Why this file is now a shell ═══════════════════════════════════════════
//
// It used to render the whole page, as a server component with no translation
// context, and its own header said so: "the prose on these pages — headline,
// one-liner, the pains, the how, the specifics — renders in English in all six
// languages, and that is a real debt written down rather than hidden".
//
// The owner opened /features/quotes and /features/quote-from-the-call and read
// that debt back as the bug it is. A page whose title and feature bullets speak
// French over four sections of English prose is not "not translated yet"; it is
// the half-translated failure lib/marketing/featureLabels.js was written to fix
// on /pricing, arriving one route over.
//
// So the split is the same one /industries/[slug] and /pricing already make,
// for the same reason and in the same shape: generateStaticParams and
// generateMetadata cannot move into a client component, and t() cannot come out
// of one. The boundary is drawn here — at the top of the page body, the
// smallest place that still covers every sentence a visitor reads, because
// every section of this page carries prose. Nothing below the boundary reads
// the database or the request, so the pages still prerender for every slug in
// generateStaticParams; what changes is that the markup is produced by a client
// component during that prerender instead of a server one.
//
// ══ Metadata stays English, on purpose ═════════════════════════════════════
//
// The same decision recorded on /industries/[slug]: this is what a crawler
// indexes, and serving a French <title> because the last visitor switched
// languages would be worse than not translating it. Proper multilingual SEO
// needs locale-prefixed routes (/fr/features/…), which is a routing change
// rather than a copy change — scoped out at the end of docs/ROADMAP.md. The
// French title is already WRITTEN, in app/i18n/featurePages/fr.js, so the day
// those routes land this function gains a language and nothing else.
//
// ══ Images: four real screenshots, and the pages that do not get one ═══════
//
// public/marketing holds exactly four product images and no more can be made —
// the app is behind a login. `page.image` is therefore rare and each one is
// assigned to the page whose subject the picture actually shows, which is NOT
// always what the filename says: hero-scheduling.webp is the client's booking
// page, not the dispatch calendar, and hero-invoicing.webp is a quote with an
// Approve button, not an invoice. Their own alt text in app/i18n/messages.js
// says as much — and it is now actually READ, through `altKey`; see
// featurePageCopy() in app/data/featurePages.js for the field that was written
// and rendered by nothing.

import { notFound } from "next/navigation";
import { FEATURE_PAGES, featurePage } from "@/app/data/featurePages";
import { marketingMetadata } from "@/lib/marketing/metadata";
import FeaturePageContent from "./FeaturePageContent";

export function generateStaticParams() {
  return FEATURE_PAGES.map((p) => ({ slug: p.slug }));
}

// Next 16: params is a Promise. /product/[slug] shipped a version of this file
// that read it synchronously and 404'd every page it was meant to serve; the
// comment there records it. Awaited here for the same reason.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = featurePage(slug);
  if (!page) return {};

  return marketingMetadata({
    path: `/features/${slug}`,
    // Each page gets its own headline as the title. Two dozen tabs all reading
    // "FieldQuo" is two dozen pages competing for one query.
    title: `${page.headline} | FieldQuo`,
    description: page.description,
  });
}

export default async function FeaturePage({ params }) {
  const { slug } = await params;
  // The 404 stays here rather than moving down with the markup: a missing slug
  // is a routing answer, and notFound() thrown from a client component would
  // have already sent a 200 with a shell in it.
  if (!featurePage(slug)) return notFound();

  return <FeaturePageContent slug={slug} />;
}
