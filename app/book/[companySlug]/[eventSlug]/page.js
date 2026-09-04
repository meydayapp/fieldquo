// app/book/[companySlug]/[eventSlug]/page.js
//
// A direct link to one bookable service — "book my in-home estimate" in an
// email signature, rather than making someone pick from a menu first.
//
// Reuses BookingFlow with the service preselected instead of duplicating the
// calendar and the form. The flow is identical from step two onward; the only
// difference is where the visitor entered it.

export const dynamic = "force-dynamic";

import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { documentTheme } from "@/lib/documents/theme";
import BookingFlow from "../BookingFlow";

// Same reasoning as the parent route's, and it applies harder here: this is the
// URL that goes in an email signature, so it is the one a stranger opens in a
// tab. Inherited metadata would put "FieldQuo" in that tab.
//
// The COMPANY, not the event: the event name is already the heading on the page
// and a tab reading "Consultation with Dave" says nothing about whose business
// it is — which is the one thing the title has to carry.
export async function generateMetadata({ params }) {
  const { companySlug } = await params;
  const company = await findBookingCompany(companySlug, { name: true });
  return {
    title: company?.name || " ",
    robots: { index: false, follow: false },
  };
}

export default async function DirectBookingPage({ params }) {
  const { companySlug, eventSlug } = await params;
  // Same full-height page as the parent route — see the note there. This URL is
  // the one that goes in an email signature, so it is if anything MORE likely
  // to be opened as a standalone tab than /book/<slug> is.
  const company = await findBookingCompany(companySlug, { brandColor: true });
  const theme = documentTheme(company || {});
  return (
    <div className="min-h-dvh" style={{ backgroundColor: theme.page }}>
      <BookingFlow companySlug={companySlug} initialEventSlug={eventSlug} />
    </div>
  );
}
