// app/f/[companySlug]/[funnelSlug]/page.js
//
// The public funnel — a full-screen, mobile-first tap-through reached from an ad,
// a link-in-bio, or a QR code. Thin server shell; the runner is a client
// component because the whole experience is stateful (one step at a time,
// branching, uploads). noindex: a funnel is an ad landing page, not something
// that should compete with the company's real site in search.
//
// ── The tab title ───────────────────────────────────────────────────────────
//
// This was a static `metadata` export with `robots` and nothing else, and a
// static metadata export inherits every field it does not set from the root
// layout — where `title` is "FieldQuo". So a homeowner tapping a contractor's
// Instagram ad landed on a full-screen page in the contractor's colours with
// our name in the browser tab.
//
// The embed sibling of this route
// (app/embed/[companySlug]/funnel/[funnelSlug]/page.js) already writes the
// argument down and already fixes it — and it noted that the leak matters even
// though an embed is normally inside an iframe where nobody reads the tab.
// This page is never in an iframe. It IS the tab. It was the one left behind.
//
// generateMetadata rather than a hardcoded string: the runner resolves the
// company anyway, Next dedupes the two lookups within a request, and an
// unknown slug falls back to a bare unbranded title rather than throwing —
// the runner's own not-available state answers that case, and metadata must
// not pre-empt it.

import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import FunnelRunner from "./FunnelRunner";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, { name: true });
  return {
    title: company?.name || " ",
    robots: { index: false, follow: false },
  };
}

export default async function FunnelPage({ params }) {
  // Next 16: params is a Promise.
  const { companySlug, funnelSlug } = await params;
  return <FunnelRunner companySlug={companySlug} funnelSlug={funnelSlug} />;
}
