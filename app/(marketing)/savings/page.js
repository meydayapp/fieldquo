// app/(marketing)/savings/page.js
//
// Server half of /savings: the metadata, and nothing else.
//
// The calculator is a client component because it is a form that recomputes as
// you type. Same split as /pricing — the page export owns the metadata, the
// component owns the rendering — except that this one reads no database at
// all: every number on the page comes from the visitor's answers and from
// lib/marketing/savings.js, so there is nothing here to make dynamic.
//
// ── It is not English-only any more ─────────────────────────────────────────
//
// This comment used to say the page was English "until the strings are
// written", and the owner found it the way anybody would: he switched the site
// to Ukrainian, then Spanish, and read the calculator in English both times.
// The strings are written now — app/i18n/savingsPage/, nine languages, gated
// by check:translations like the rest of the marketing catalogue.
//
// The METADATA below stays English, and that is a decision rather than a gap.
// It is the same one /compare/[slug] records: a <title> is what a crawler
// keeps for months, and serving it in whichever language the last visitor
// happened to pick is worse than not translating it. Locale-prefixed routes
// are the real fix and are scoped at the end of docs/ROADMAP.md.
import { marketingMetadata } from "@/lib/marketing/metadata";
import SavingsCalculator from "./SavingsCalculator";

export const metadata = marketingMetadata({
  path: "/savings",
  title: "What FieldQuo saves you — FieldQuo",
  description:
    "Estimate what running quotes, scheduling and invoicing in one system is worth to your business, against what a plan costs. Every assumption behind the figure is published.",
});

export default function SavingsPage() {
  return <SavingsCalculator />;
}
