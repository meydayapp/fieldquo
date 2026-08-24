// app/embed/[companySlug]/funnel/[funnelSlug]/page.js
//
// A lead funnel as something a company can drop into their own website.
//
// ── Why this needs its own route ────────────────────────────────────────────
//
// Every other widget is one-per-company: there is one booking calendar, one
// quote form, one reviews strip. A company has MANY funnels — that is the
// point of them — so the widget needs to name which, and /embed/[slug]/[widget]
// has nowhere to put a second identifier. Encoding it as "funnel-summer-promo"
// in the widget segment would have worked and would have been a string that
// has to be parsed at both ends; a path segment is what a path segment is for.
//
// ── Why a funnel is worth embedding at all ──────────────────────────────────
//
// A funnel already has a public URL at /f/[companySlug]/[funnelSlug], and the
// funnel screen offers "Copy link" for exactly that. A link is right for an ad
// or a QR code, where the visitor is arriving from somewhere else. It is wrong
// for a company's own website, where sending a visitor OFF the page they are
// already on to a chrome-less landing page is how you lose them — and where
// the thing they came to do is right there.

import { notFound } from "next/navigation";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import FunnelRunner from "@/app/f/[companySlug]/[funnelSlug]/FunnelRunner";
import EmbedFrame from "../../../EmbedFrame";

export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, { name: true });
  // Same reasoning as the other embeds: the tab title is a white-label
  // surface, and an embed must never compete with the company's own page in
  // search results.
  return {
    title: company?.name || " ",
    robots: { index: false, follow: false },
  };
}

export default async function FunnelEmbedPage({ params }) {
  const { companySlug, funnelSlug } = await params;

  // Checked here rather than letting the runner's own fetch fail. An iframe
  // that loads and then says "not found" is indistinguishable from a broken
  // embed, and the company who pasted it in cannot tell which it is.
  const company = await findBookingCompany(companySlug, { id: true });
  if (!company || !funnelSlug) notFound();

  // The runner resolves and validates the funnel itself — including whether it
  // is published — so an unpublished funnel behaves here exactly as it does at
  // its public URL rather than acquiring a second, more permissive front door.
  return (
    <EmbedFrame>
      <FunnelRunner companySlug={companySlug} funnelSlug={funnelSlug} />
    </EmbedFrame>
  );
}
