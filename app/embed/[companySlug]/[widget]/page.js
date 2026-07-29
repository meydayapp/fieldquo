// app/embed/[companySlug]/[widget]/page.js
//
// The booking calendar and the quote form, as things a company can drop into a
// website they already have.
//
// ── Why this matters more than the site builder ─────────────────────────────
//
// Most established contractors already have a website. They are not going to
// throw it away for a one-page FieldQuo site, and telling them to is how a
// feature gets ignored by the customers who need it least but pay the most.
//
// What they WILL do is paste an iframe into the page they already have, so
// that "book a visit" and "request a quote" stop being a phone number and
// start being a row in their pipeline. Same two flows, no FieldQuo chrome.
//
// ── Same components, not copies ─────────────────────────────────────────────
//
// BookingFlow and SelfQuoteFlow are the ones behind /book and /quote. A second
// implementation for embedding would be a second implementation to keep
// correct, and the embedded one — running on someone else's site, where nobody
// at FieldQuo will ever look at it — is the one that would rot.
//
// ── Height, not scrollbars ──────────────────────────────────────────────────
//
// The single worst thing about an embedded form is a fixed-height box that
// clips the confirmation message, so the visitor completes the form and sees
// nothing happen. EmbedFrame measures itself and posts the height to the
// parent; the snippet FieldQuo hands out listens and resizes. Without the
// snippet it still works — it just scrolls, which is the old behaviour rather
// than a broken one.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";
import EmbedFrame from "../../EmbedFrame";

const WIDGETS = new Set(["book", "quote"]);

export const metadata = {
  // Never indexed. The company's OWN page is what should rank; an embed
  // competing with it in search results splits their traffic between the real
  // page and a chrome-less fragment of it.
  robots: { index: false, follow: false },
};

export default async function EmbedPage({ params }) {
  const { companySlug, widget } = await params;

  if (!WIDGETS.has(widget)) notFound();

  // Checked before rendering rather than letting the flow's own fetch fail:
  // an iframe that loads and then shows "not found" is indistinguishable from
  // a broken embed, and the company pasting it in has no way to tell which.
  const company = await findBookingCompany(companySlug, { id: true });
  if (!company) notFound();

  return (
    <EmbedFrame>
      {widget === "book" ? (
        <BookingFlow companySlug={companySlug} />
      ) : (
        <SelfQuoteFlow companySlug={companySlug} />
      )}
    </EmbedFrame>
  );
}
