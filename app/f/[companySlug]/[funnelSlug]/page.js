// app/f/[companySlug]/[funnelSlug]/page.js
//
// The public funnel — a full-screen, mobile-first tap-through reached from an ad,
// a link-in-bio, or a QR code. Thin server shell; the runner is a client
// component because the whole experience is stateful (one step at a time,
// branching, uploads). noindex: a funnel is an ad landing page, not something
// that should compete with the company's real site in search.

import FunnelRunner from "./FunnelRunner";

export const metadata = { robots: { index: false, follow: false } };

export default async function FunnelPage({ params }) {
  // Next 16: params is a Promise.
  const { companySlug, funnelSlug } = await params;
  return <FunnelRunner companySlug={companySlug} funnelSlug={funnelSlug} />;
}
