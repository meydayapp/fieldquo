// app/(marketing)/features/page.js
//
// Server half of the /features index: the metadata export, and nothing else.
// The page itself is FeaturesIndexContent, a client component, because
// translation is React context and `export const metadata` cannot live inside
// one. Same split as /features/[slug], /industries/[slug] and /pricing.
//
// The index was translated in the same pass as the pages under it, and it had
// to be: a directory listing 29 feature names in French over an English hero,
// pointing at 37 pages that now speak French, is the half-translated failure
// moved up one level rather than fixed.
//
// Metadata stays English here for the same reason it does on the page below —
// it is what a crawler indexes, and locale-prefixed routes are a routing change
// scoped out at the end of docs/ROADMAP.md.

import { marketingMetadata } from "@/lib/marketing/metadata";
import FeaturesIndexContent from "./FeaturesIndexContent";

export const metadata = marketingMetadata({
  path: "/features",
  title: "Everything FieldQuo does — FieldQuo",
  description:
    "Quoting, booking, scheduling, job costing, invoicing, payments and payroll for field-service contractors. Every feature listed, with the limits stated where there are any.",
});

export default function FeaturesIndexPage() {
  return <FeaturesIndexContent />;
}
