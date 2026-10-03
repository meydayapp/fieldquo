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
//
// The company's name, and its logo as the tab icon, since 2026-10-03
// (lib/whiteLabel/pageMetadata.js). This used to be deliberately generic, to
// spare the route a database read on one bar of signal. That reasoning no
// longer holds: Next 16 streams metadata to browsers, so the read does not
// hold the page body back — only an HTML-limited link-preview bot waits for
// it, and the bot is exactly who needs the name. And a generic title left
// the root layout's FieldQuo favicon in the tab, which is the leak.
export const dynamic = "force-dynamic";

import PlanAuthorisation from "./PlanAuthorisation";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { servicePlanCompany } from "@/lib/whiteLabel/metadataLoaders";

const ROBOTS = { index: false, follow: false };

export async function generateMetadata({ params }) {
  const { token } = await params;
  const company = await servicePlanCompany(token);
  return company
    ? clientPageMetadata(company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Payment authorisation", robots: ROBOTS });
}

export default function PlanPage() {
  return <PlanAuthorisation />;
}
