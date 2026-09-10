// app/(marketing)/compare/[slug]/page.js
//
// Server half of a comparison page: routing, static params, metadata, and the
// one decision this route has to make on its own — what day it is speaking as
// of. Rendering lives in ComparisonPage.
//
// The split is now exactly /industries/[slug]'s and /pricing's: this half holds
// generateMetadata and generateStaticParams, which cannot live in a client
// module, and ComparisonPage is a client component because translation lives in
// React context. It used to be a server component on the grounds that these
// pages were English-only; they are not any more.
//
// `asOf` still arrives as a PROP rather than being read inside the render, and
// that has not changed for a different reason: the check script renders
// ComparisonPage at dates of its choosing, which is how the staleness path gets
// exercised rather than assumed.

import { notFound } from "next/navigation";

import { marketingMetadata } from "@/lib/marketing/metadata";
import { competitor as findCompetitor } from "@/lib/marketing/competitors";

import { renderAsOf } from "../asOf";
import { COMPARE_PAGES, comparePage } from "../compareCopy";
import ComparisonPage from "./ComparisonPage";

export function generateStaticParams() {
  return COMPARE_PAGES.map((p) => ({ slug: p.slug }));
}

// Metadata stays English-only, matching /industries/[slug]: it is what search
// engines index, and serving a French title to an English crawler because the
// last visitor switched languages is worse than not translating it. Proper
// multilingual SEO needs locale-prefixed routes, which is a routing change and
// is scoped at the end of docs/ROADMAP.md.
export async function generateMetadata({ params }) {
  // Next 16: params is a Promise. Reading it synchronously logs a
  // sync-dynamic-apis error on every render.
  const { slug } = await params;
  const page = comparePage(slug);
  if (!page) return {};

  return marketingMetadata({
    path: `/compare/${slug}`,
    title: `${page.title} | FieldQuo`,
    description: page.description,
  });
}

export default async function CompareSlugPage({ params }) {
  const { slug } = await params;
  const page = comparePage(slug);
  // A slug with no research behind it is a 404, not an empty page. There is
  // deliberately no way to add a comparison here without adding the verified
  // figures to lib/marketing/competitors.js first.
  if (!page || !findCompetitor(page.competitorId)) return notFound();

  // The single call that answers "what day is it" for this whole page. Every
  // downstream helper in competitors.js requires it explicitly and throws
  // without it; see ../asOf.js for why it is the render moment rather than a
  // date typed into the copy.
  return <ComparisonPage slug={slug} asOf={renderAsOf()} />;
}
