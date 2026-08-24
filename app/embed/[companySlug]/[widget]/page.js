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
//
// ── The third widget: reviews ───────────────────────────────────────────────
//
// Same argument as the two above, pointed the other way. A contractor with
// their own site has nowhere to put the reviews they collect through FieldQuo,
// so they sit in a database doing no selling. This is the one embed that
// renders NOTHING when it has nothing — see app/embed/Reviews.js.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { loadPublicReviews } from "@/lib/reviews/publicReviews";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";
import InstantQuoteFlow from "@/app/instant-quote/[companySlug]/InstantQuoteFlow";
import EmbedFrame from "../../EmbedFrame";
import Reviews from "../../Reviews";

// ── The fourth widget: the instant estimate ────────────────────────────────
//
// This one was the odd gap. Settings → Lead Capture Form has offered a
// shareable /instant-quote link since it shipped, next to two cards that DO
// hand out embed code — so a contractor could put "book a visit" and "request
// a quote" on their own site and, for the one feature that answers a
// homeowner's actual question in thirty seconds, only had a link to somewhere
// else. The flow already exists and takes the same single prop as the other
// two; it was never served here.
const WIDGETS = new Set(["book", "quote", "reviews", "instant-quote"]);

// ── The tab title is a white-label surface too ────────────────────────────
//
// A static `metadata` export inherits the root layout's title, which is
// "FieldQuo". Inside an iframe nobody sees it — but an embed URL opened
// directly, or dragged into a new tab from a right-click, is a page carrying
// the contractor's brand and our name in the tab. That is the leak
// non-negotiable #1 exists to prevent, and it costs one lookup to close.
//
// generateMetadata rather than a hardcoded string: the company is resolved
// here anyway a few lines down, and Next dedupes the two calls in a request.
// An unknown slug falls back to a bare, unbranded title instead of throwing —
// the 404 below is what answers that case, and metadata must not pre-empt it.
export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, { name: true });
  return {
    title: company?.name || " ",
    // Never indexed. The company's OWN page is what should rank; an embed
    // competing with it in search results splits their traffic between the
    // real page and a chrome-less fragment of it.
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({ params }) {
  const { companySlug, widget } = await params;

  if (!WIDGETS.has(widget)) notFound();

  // Checked before rendering rather than letting the flow's own fetch fail:
  // an iframe that loads and then shows "not found" is indistinguishable from
  // a broken embed, and the company pasting it in has no way to tell which.
  const company = await findBookingCompany(companySlug, {
    id: true,
    brandColor: true,
  });
  if (!company) notFound();

  if (widget === "reviews") {
    const reviews = await loadPublicReviews(company.id);
    return (
      // Transparent rather than the white page the two form widgets want: this
      // one is a strip of cards dropped into someone else's layout, and a white
      // rectangle behind them is the thing that gives away that it's an iframe.
      <EmbedFrame className="bg-transparent">
        <Reviews company={company} reviews={reviews} />
      </EmbedFrame>
    );
  }

  return (
    <EmbedFrame>
      {widget === "book" ? (
        <BookingFlow companySlug={companySlug} />
      ) : widget === "instant-quote" ? (
        <InstantQuoteFlow companySlug={companySlug} />
      ) : (
        <SelfQuoteFlow companySlug={companySlug} />
      )}
    </EmbedFrame>
  );
}
