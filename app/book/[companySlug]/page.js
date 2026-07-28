// app/book/[companySlug]/page.js
//
// The public booking page. Settings → Lead Capture Form hands companies an
// iframe embed pointing here, so this renders inside someone else's website
// as often as it does standalone.
//
// That constrains the design: no fixed positioning, no viewport-height units,
// no assumption about surrounding width. An iframe is 600px tall by default
// per that embed snippet, so the whole flow has to work in a short box.

export const dynamic = "force-dynamic";

import BookingFlow from "./BookingFlow";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }) {
  const { companySlug } = await params;
  return <BookingFlow companySlug={companySlug} />;
}
