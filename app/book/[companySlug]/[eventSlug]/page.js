// app/book/[companySlug]/[eventSlug]/page.js
//
// A direct link to one bookable service — "book my in-home estimate" in an
// email signature, rather than making someone pick from a menu first.
//
// Reuses BookingFlow with the service preselected instead of duplicating the
// calendar and the form. The flow is identical from step two onward; the only
// difference is where the visitor entered it.

export const dynamic = "force-dynamic";

import BookingFlow from "../BookingFlow";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DirectBookingPage({ params }) {
  const { companySlug, eventSlug } = await params;
  return <BookingFlow companySlug={companySlug} initialEventSlug={eventSlug} />;
}
