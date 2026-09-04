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
// ── English only, and that is a gap rather than a decision ──────────────────
//
// The rest of the marketing site translates through app/i18n. Adding keys
// there means adding them in every language the catalogue carries, which
// check:translations gates
// — so a half-translated calculator would fail the build, and machine-filling
// five languages of financial copy is worse than shipping one. The page is
// English until the strings are written; /about, /careers and /terms are in
// the same position today.
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
