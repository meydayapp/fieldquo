// app/quote/[companySlug]/page.js
//
// "Request a quote" — the public form a company puts on their own site, in an
// ad, or on the back of a van.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Both the APIs behind it were already built (/api/self-quote and
// /api/leads/public), and neither had a page. So the endpoints sat there,
// working, unreachable — and Settings → Lead Capture Form handed companies an
// iframe pointing at the BOOKING flow instead, which asks a stranger to pick a
// time slot before they've said what the job is.
//
// ── Booking and quoting are different requests ──────────────────────────────
//
// Someone who knows what they want books a visit. Someone comparing three
// contractors wants a number first, and asking them to commit to a Tuesday
// morning loses them. Both links now exist and a company can use either or
// both.
//
// Indexed, unlike /book — a company sharing this on social or in an ad wants
// it to be findable, and there's nothing private on the page.

export const dynamic = "force-dynamic";

import SelfQuoteFlow from "./SelfQuoteFlow";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  return {
    title: "Request a quote",
    description: `Tell us about your project and we'll get back to you with a price.`,
    alternates: { canonical: `/quote/${companySlug}` },
  };
}

export default async function SelfQuotePage({ params }) {
  const { companySlug } = await params;
  return <SelfQuoteFlow companySlug={companySlug} />;
}
