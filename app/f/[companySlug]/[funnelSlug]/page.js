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
// generateMetadata rather than a hardcoded string: an unknown slug falls back
// to a bare unbranded title rather than throwing — the runner's own
// not-available state answers that case, and metadata must not pre-empt it.
//
// ── The page's language ─────────────────────────────────────────────────────
//
// Resolved here, on the server, from the company alone
// (lib/i18n/funnelCopy.js funnelPageLanguage — why the company's and never
// the visitor's is written there). Handed to the runner as a prop so its
// chrome is in the right language from the first paint, including the
// "isn't available" state it draws when its own fetch fails and it has no
// payload to read a language from. An unknown slug is English: there is no
// company whose copy the chrome could match.
//
// The company is read once per request for both the title and the language:
// this used to say Next dedupes the two lookups, which is true of fetch() and
// not of a Prisma call; React's cache() is what actually makes it one read.

import { cache } from "react";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { funnelPageLanguage } from "@/lib/i18n/funnelCopy";
import FunnelRunner from "./FunnelRunner";

const companyFor = cache((slug) => findBookingCompany(slug, { name: true, defaultLanguage: true }));

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await companyFor(companySlug);
  return {
    title: company?.name || " ",
    robots: { index: false, follow: false },
  };
}

export default async function FunnelPage({ params }) {
  // Next 16: params is a Promise.
  const { companySlug, funnelSlug } = await params;
  const company = await companyFor(companySlug);
  return (
    <FunnelRunner
      companySlug={companySlug}
      funnelSlug={funnelSlug}
      language={funnelPageLanguage(company)}
    />
  );
}
