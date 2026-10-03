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
import { loadPublicFormLook } from "@/lib/estimate/publicFormLook";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import {
  CLIENT_META_COMPANY_SELECT,
  clientPageMetadata,
  neutralClientMetadata,
} from "@/lib/whiteLabel/pageMetadata";

// The company's name in the tab, its logo as the icon and the share image —
// this is the link a company puts in an ad, so the preview is theirs
// (lib/whiteLabel/pageMetadata.js). The sentence is the one this page always
// carried, in the company's own voice; it now replaces the root layout's
// FieldQuo description instead of sitting beside it in the head.
const DESCRIPTION = "Tell us about your project and we'll get back to you with a price.";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const canonical = { alternates: { canonical: `/quote/${companySlug}` } };
  const company = await findBookingCompany(companySlug, CLIENT_META_COMPANY_SELECT).catch(() => null);
  if (!company) return { ...neutralClientMetadata({ title: "Request a quote", description: DESCRIPTION }), ...canonical };
  return {
    ...clientPageMetadata(company, {
      title: `Request a quote · ${company.name}`,
      description: DESCRIPTION,
    }),
    ...canonical,
  };
}

export default async function SelfQuotePage({ params }) {
  const { companySlug } = await params;
  // The company's chosen look (lib/estimate/publicFormLook.js) — server-read,
  // never a URL parameter.
  const look = await loadPublicFormLook(companySlug);
  return <SelfQuoteFlow companySlug={companySlug} look={look} />;
}
