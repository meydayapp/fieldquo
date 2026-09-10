// app/(marketing)/compare/page.js
//
// Server half of the /compare index: the metadata export, and nothing else.
//
// The markup moved to ./CompareIndex.js when these pages stopped being
// English-only — translation lives in React context and `metadata` cannot be
// exported from a client module, which is the same split /pricing and
// /industries/[slug] already carry. ./summary.js holds the pure function that
// decides what each card may claim.
//
// `comparisonSummary` is re-exported so scripts/check-compare-pages.mjs keeps
// importing it from where it has always imported it. It is a plain function
// with no JSX and no React, so passing back through this module costs nothing.

import { marketingMetadata } from "@/lib/marketing/metadata";

import CompareIndex from "./CompareIndex";
import { COMPARE_CHROME } from "./compareCopy";

export { comparisonSummary } from "./summary";

// Deliberately English, like every other generateMetadata on this site: it is
// what a crawler indexes, and serving a French title to an English crawler
// because the last visitor switched languages is worse than not translating it.
// Locale-prefixed routes are the real fix and are scoped in docs/ROADMAP.md.
export const metadata = marketingMetadata({
  path: "/compare",
  title: `${COMPARE_CHROME.indexMetaTitle} | FieldQuo`,
  description: COMPARE_CHROME.indexMetaDescription,
});

export default function CompareIndexPage() {
  return <CompareIndex />;
}
