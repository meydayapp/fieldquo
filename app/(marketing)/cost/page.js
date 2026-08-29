// app/(marketing)/cost/page.js
//
// Server half of /cost: the metadata, and nothing else.
//
// The calculator is a client component because it is a form that recomputes as
// you type. Same split as /pricing and /savings — the page export owns the
// metadata, the component owns the rendering — and like /savings it reads no
// database at all: every figure comes from the visitor's two answers and from
// lib/marketing/competitors.js.
//
// ── Why this page is NOT statically rendered ────────────────────────────────
//
// Every figure it can print goes through withholdReason(), which stops
// publishing a competitor's price 90 days after somebody last read their page.
// That clock is measured against `asOf`, and app/(marketing)/compare/asOf.js
// answers with the RENDER MOMENT — so on a prerendered page the moment is the
// build, and a deploy that sits untouched for a quarter keeps printing figures
// its own module considers stale. /compare accepts that trade because a static
// deploy re-renders on every push. This page is the one a salesperson sends a
// prospect a link to in the middle of a quarter, so it renders per request and
// the staleness rule stays live. That is one server render of a page with no
// database read on it, which is the cheapest possible way to buy the guarantee.
import { marketingMetadata } from "@/lib/marketing/metadata";
import CostCalculator from "./CostCalculator";

export const dynamic = "force-dynamic";

export const metadata = marketingMetadata({
  path: "/cost",
  title: "What field service software actually costs — FieldQuo",
  description:
    "Say how many people quote and how many are in the field, and see what ServiceTitan, Jobber, Housecall Pro, QuoteIQ, Projul and FieldQuo would each charge — with the figures nobody will publish shown as the reason rather than a blank.",
});

export default function CostPage() {
  return <CostCalculator />;
}
