// app/book/[companySlug]/page.js
//
// The public booking page — a SHAREABLE LINK. This file used to say it was
// also the iframe target, and that stopped being true: lib/embed/snippet.js
// points at /embed/<slug>/book instead, and says why ("same flow, no FieldQuo
// chrome, and it reports its own height"). Settings → Lead Capture Form hands
// out this URL for a text message, an email signature or a Google listing, and
// the embed snippet for a website.
//
// BookingFlow keeps its no-fixed-positioning, no-viewport-units discipline
// regardless — it is mounted directly by the embed route AND by the website
// builder's booking block, where a 600px box is still the constraint. What
// belongs HERE, and only here, is what a full standalone page needs: a page
// that fills the window.
export const dynamic = "force-dynamic";

import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { documentTheme } from "@/lib/documents/theme";
import BookingFlow from "./BookingFlow";

// ── The tab title is a white-label surface ────────────────────────────────
//
// A static `metadata` export with no `title` inherits the root layout's, which
// is "FieldQuo" — and this page is handed out as a LINK far more often than it
// is framed: in an email signature, in a text message, on a business card. The
// homeowner who opens it sees the contractor's logo, the contractor's colour,
// and our name in the browser tab.
//
// app/embed/[companySlug]/[widget]/page.js closed exactly this hole and wrote
// down why; the booking page it embeds was left open. Same fix, same shape: one
// lookup, which Next dedupes against the flow's own within a request.
//
// A bare space rather than a name for an unknown slug: the flow renders its own
// "booking page not found" card, and a title guessed from the URL would be a
// second, contradictory answer.
export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, { name: true });
  return {
    title: company?.name || " ",
    robots: { index: false, follow: false },
  };
}

export default async function BookingPage({ params }) {
  const { companySlug } = await params;

  // ── The rest of the window ───────────────────────────────────────────────
  //
  // BookingFlow's shell paints `theme.page` behind its card and stops there,
  // because inside a 600px iframe a min-height would force a scrollbar on
  // content that fits. On the standalone page that left the bottom two-thirds
  // of a phone screen showing the ROOT LAYOUT's `bg-background` — the app's
  // blue-grey — under the contractor's cream card: two backgrounds, neither of
  // them theirs, on a page carrying their logo.
  //
  // Fixed here rather than in the flow, so the embed and the website builder's
  // booking block (both of which mount BookingFlow directly) keep the short-box
  // behaviour that comment is defending.
  //
  // documentTheme falls back to the default navy for a company with no colour
  // set, and to the same default for an unknown slug — where the flow renders
  // its own "not found" card on the same paper rather than on a bare stripe.
  const company = await findBookingCompany(companySlug, { brandColor: true });
  const theme = documentTheme(company || {});

  return (
    <div className="min-h-dvh" style={{ backgroundColor: theme.page }}>
      <BookingFlow companySlug={companySlug} />
    </div>
  );
}
