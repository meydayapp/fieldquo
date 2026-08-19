// app/visit/[token]/page.js
//
// The page a homeowner lands on from the link in their booking confirmation.
//
// No account, no login, usually a phone in a driveway. It sits outside the app
// shell for the same reason /q/[token] does: nothing here should suggest the
// client has an account somewhere, and nothing should carry FieldQuo's name.
// What they see is their appointment with the company they hired.
//
// The token is the whole of the authorisation — see Booking.manageToken. That
// is also why it must stay out of a search index.

export const dynamic = "force-dynamic";

import VisitManager from "./VisitManager";

export const metadata = {
  title: "Your visit",
  robots: { index: false, follow: false },
};

export default async function VisitPage({ params }) {
  // Next 16: `params` is a Promise. Reading it synchronously gives undefined,
  // and the page then asks the API about the token "undefined".
  const { token } = await params;
  return <VisitManager token={token} />;
}
