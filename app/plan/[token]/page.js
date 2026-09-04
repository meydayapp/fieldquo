// app/plan/[token]/page.js
//
// The shell around the client's payment authorisation. Everything the page
// does is in ./PlanAuthorisation.js; what lives here is the one thing a
// "use client" file cannot express.
//
// ── robots ──────────────────────────────────────────────────────────────────
//
// This page was a client component all the way up, so it could export no
// `metadata` — and it was therefore the only token-gated client-facing page in
// the product with no crawler block on it. /q, /portal, /visit, /survey,
// /unsubscribe and /no-contact all carry one, each with the same note: a token
// in a search index is a token in the hands of whoever reads the index.
//
// The token on THIS page opens a Stripe setup session for a standing
// arrangement to charge somebody. It is the last one that should have been
// crawlable, and it was the only one that was.
//
// ── The title ───────────────────────────────────────────────────────────────
//
// Not "FieldQuo", which is what the root layout would otherwise put in the tab
// of a page the homeowner is being asked to trust with their bank details.
// Deliberately generic rather than the company's name: naming the company
// would need a database read on a route whose whole point is to be fast on one
// bar of signal, and the brand band at the top of the page — logo, colour,
// name — is the identification that matters. Nothing here says FieldQuo.
export const dynamic = "force-dynamic";

import PlanAuthorisation from "./PlanAuthorisation";

export const metadata = {
  title: "Payment authorisation",
  robots: { index: false, follow: false },
};

export default function PlanPage() {
  return <PlanAuthorisation />;
}
