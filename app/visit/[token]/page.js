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

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import VisitManager from "./VisitManager";

export const metadata = {
  title: "Your visit",
  robots: { index: false, follow: false },
};

export default async function VisitPage({ params }) {
  // Next 16: `params` is a Promise. Reading it synchronously gives undefined,
  // and the page then asks the API about the token "undefined".
  const { token } = await params;

  // ── An unknown link is a 404, not a 200 ────────────────────────────────
  //
  // This route rendered 200 for any string at all; VisitManager then fetched,
  // failed, and drew a friendly "we couldn't find that" message. The words
  // were right and the status code was a lie — the same fault
  // app/q/[token]/page.js was fixed for, and app/survey/[token]/page.js after
  // it. The two of them are the precedent; this was the one left behind.
  //
  // One indexed lookup of the id and nothing else — manageToken is unique in
  // the schema. That is cheap enough for a page whose whole audience is a
  // phone in a driveway, and it means a bad link costs one query instead of a
  // full page render plus an API round trip.
  //
  // notFound() renders ./not-found.js, which carries wording as good as the
  // one the client component draws. Without that file this would trade a good
  // message for a correct status code, which is not a trade worth making.
  const exists = token
    ? await db.booking.findUnique({
        where: { manageToken: token },
        select: { id: true },
      })
    : null;
  if (!exists) notFound();

  return <VisitManager token={token} />;
}
