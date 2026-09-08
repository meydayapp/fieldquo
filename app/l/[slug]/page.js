// app/l/[slug]/page.js
//
// The bio link. One page listing everything a contractor can send traffic to,
// for the single link Instagram and TikTok allow in a profile.
//
// This file is the route: it loads the data and 404s. The markup is
// app/components/links/LinkPageView.js, kept separate so a check script can
// render it with fixture data and no database — which is how its look was
// verified against hostile brand colours in both colour schemes.
//
// ── Why /l/<slug> ───────────────────────────────────────────────────────────
//
// The string IS the product here. It gets typed into a phone keyboard by the
// contractor, read aloud in a reel, and squeezed into a bio with a character
// limit — so it is as short as it can be while still being a word.
// `fieldquo.com/l/northline` is 24 characters; `/links/` would be four more on
// every one of them for no gain. The slug is the same one /quote, /book and
// /f already use (bookingSlug falling back to slug — see
// lib/booking/findBookingCompany.js), so a company that customised its booking
// address gets one address for everything rather than two.
//
// `l` is a PATH, not a subdomain, so it is outside the reserved-subdomain
// boundary in lib/site/subdomain.js — nothing here can be claimed by a tenant.
// (It could not be a subdomain anyway: that list requires three characters.)
//
// ── Why noindex, but follow ─────────────────────────────────────────────────
//
// Not obvious, and it goes the other way from /quote/<slug>, which is
// deliberately indexed.
//
// Against indexing, decisively: a search result shows its domain. A homeowner
// googling "Northline Painting" and seeing `fieldquo.com/l/northline` has just
// been told which software their contractor uses, on the most public surface
// there is — the exact leak the white-label rule exists to prevent, and one we
// would be creating on purpose. Second, this page is 100% outbound links, so
// ranking it INTERCEPTS a search that would otherwise have landed on the
// contractor's real site or booking page, adds a tap, and costs a lead on a
// bad connection. Third, its traffic comes from a bio, never from a query;
// there is no search intent it is the best answer to.
//
// But `follow: true`, unlike the funnel pages, which are noindex,nofollow. A
// funnel is a closed ad landing page with nothing to pass on. This page is
// nothing BUT links to the contractor's own properties, and nofollowing them
// would throw away the one search signal it can generate — theirs, not ours.
//
// ── "Made by FieldQuo" in the footer — the owner's decision, 2026-09-08 ──────
//
// This used to say the opposite: that the "Site by FieldQuo" credit on free
// websites was a rule about one product, and that extending it here was a
// product decision nobody had made. The owner has now made it. The bio link
// carries a small, muted "Made by FieldQuo" beside the copyright line, as a
// plain link to fieldquo.com.
//
// The reasoning for the exception: unlike a quote or an invoice, a bio link
// is not a document the homeowner reads as coming from the contractor — it is
// a menu, and every menu of this kind on the internet carries its maker's name
// at the bottom. The credit is held to the same measured contrast as the
// copyright line next to it (pageMuted, 4.5:1) so it is legible without being
// the thing you see. Everything ABOVE the footer is still the contractor's
// alone. The settings screen's subtitle says this too, in as many words, so
// nobody discovers it from their own page.
//
// ── Dark mode, on a client-facing page ──────────────────────────────────────
//
// app/layout.js forces client-facing routes to light and explains why (a
// quote must not arrive dark). This page follows the visitor's
// prefers-color-scheme anyway, by media query, with no JavaScript — the
// reasoning is in lib/links/theme.js. The layout's script only pins
// `color-scheme` on <html>; the page's own <style> sets it again on its
// subtree, so form controls and scrollbars follow the scheme the page chose.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { loadLinkPageData } from "@/lib/links/load";
import LinkPageView from "@/app/components/links/LinkPageView";

export async function generateMetadata({ params }) {
  // Next 16: params is a Promise.
  const { slug } = await params;
  const data = await loadLinkPageData(slug);
  if (!data || !data.config.published) {
    return { robots: { index: false, follow: false } };
  }
  const { company, config } = data;
  return {
    title: config.headline || company.name,
    // No invented description. A company that wrote nothing gets nothing,
    // rather than a sentence FieldQuo made up appearing under their name.
    ...(config.bio ? { description: config.bio } : {}),
    robots: { index: false, follow: true },
    openGraph: {
      title: config.headline || company.name,
      ...(config.bio ? { description: config.bio } : {}),
      ...(company.logoUrl ? { images: [company.logoUrl] } : {}),
    },
  };
}

export default async function BioLinkPage({ params }) {
  const { slug } = await params;
  const data = await loadLinkPageData(slug);
  if (!data || !data.config.published) notFound();

  const { company, config, candidates } = data;
  return <LinkPageView company={company} config={config} candidates={candidates} />;
}
