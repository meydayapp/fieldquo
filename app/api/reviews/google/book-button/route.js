// app/api/reviews/google/book-button/route.js
//
// The "Book" button on the company's Google Business Profile, for the card on
// Settings › Booking Page (app/app/settings/booking-page/GoogleBookButton.js).
//
// GET     the booking link, whether the booking page is bookable, and — only
//         when Google can be asked — whether our link is on the listing now.
// POST    { preferred } — "Add it for me": list, and create only if absent.
// DELETE  "Remove from Google": delete OUR link, found by listing; the browser
//         never names a link (lib/reviews/googleBusiness/bookButton.js).
//
// ── Who ─────────────────────────────────────────────────────────────────────
//
// `user:manage`, through refuseUnlessAdmin — the same capability the Booking
// Page screen is gated on (the whole page renders NoAccessPanel without it)
// and the one every other /api/reviews/google route checks, so the person
// who can connect the listing and edit the booking page is the person who can
// put one on the other. It is held by owners, admins AND supervisors.
//
// ── When the POST/DELETE refuse ─────────────────────────────────────────────
//
// Not approved (googleBusinessAvailable() false), not connected, no listing
// picked, booking page not bookable, or a non-https link. The card never
// draws the button in any of those states — the GET below is what it reads —
// so these refusals are the backstop for a stale tab, not a UX path. Each has
// a `kind` the card translates.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";
import { getAppOrigin } from "@/lib/appUrl";
import { getBusinessConnection } from "@/lib/reviews/googleBusiness/connection";
import { googleBusinessAvailable } from "@/lib/reviews/googleBusiness/availability";
import { placeActionParent } from "@/lib/reviews/googleBusiness/client";
import {
  addBookButton,
  removeBookButton,
  bookButtonStatus,
  bookingPageLive,
  bookingPageUrl,
  pushableUrl,
} from "@/lib/reviews/googleBusiness/bookButton";

/** Everything both verbs and the GET need to decide, read once. */
async function situation(request, companyId) {
  const [company, connection, live] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { slug: true, bookingSlug: true } }),
    getBusinessConnection(companyId),
    bookingPageLive(companyId),
  ]);
  const bookingUrl = bookingPageUrl(getAppOrigin(request), company);
  const available = googleBusinessAvailable();
  const hasListing = Boolean(connection && placeActionParent(connection.locationName));
  return {
    bookingUrl,
    live: Boolean(bookingUrl) && live,
    available,
    connection,
    hasListing,
    canAutomate: available && hasListing && Boolean(bookingUrl) && live && pushableUrl(bookingUrl),
  };
}

function refusalFor(s) {
  if (!s.available) return { kind: "not_approved", error: "Adding the Book button automatically is not available yet." };
  if (!s.connection) return { kind: "not_connected", error: "Connect your Google Business Profile in Settings › Reviews first." };
  if (!s.hasListing) return { kind: "no_location", error: "Pick your Google listing in Settings › Reviews first." };
  if (!s.live) return { kind: "not_live", error: "Set up your booking page first — nobody can book on it yet." };
  if (!pushableUrl(s.bookingUrl)) return { kind: "not_https", error: "Google needs a public https address for the Book button." };
  return null;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const s = await situation(request, member.companyId);
  const google = {
    available: s.available,
    connected: Boolean(s.connection),
    locationTitle: s.connection?.locationTitle || null,
    canAutomate: s.canAutomate,
    onGoogle: null,
    link: null,
    error: null,
    errorKind: null,
  };
  // Asked of Google only when the button would be drawn. A read: nothing is
  // stamped on the connection row, so a read-only support session changes
  // nothing by opening the page.
  if (s.canAutomate) {
    const status = await bookButtonStatus({ connection: s.connection, bookingUrl: s.bookingUrl });
    if (status.ok) {
      google.onGoogle = status.onGoogle;
      google.link = status.link;
    } else {
      google.error = status.message;
      google.errorKind = status.kind;
    }
  }
  return NextResponse.json({ bookingUrl: s.live ? s.bookingUrl : null, bookingLive: s.live, google });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;
  // getCurrentMember already refuses every non-GET for a read-only session;
  // this writes to a listing outside FieldQuo, so it says so twice.
  if (member.impersonationMode === "read_only") {
    return NextResponse.json({ error: "Read-only session." }, { status: 403 });
  }

  const s = await situation(request, member.companyId);
  const refused = refusalFor(s);
  if (refused) return NextResponse.json(refused, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const result = await addBookButton({
    connection: s.connection,
    bookingUrl: s.bookingUrl,
    preferred: body?.preferred === true,
  });
  if (!result.ok) return NextResponse.json({ error: result.message, kind: result.kind }, { status: 502 });
  return NextResponse.json(result);
}

export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;
  if (member.impersonationMode === "read_only") {
    return NextResponse.json({ error: "Read-only session." }, { status: 403 });
  }

  const s = await situation(request, member.companyId);
  // Removing needs the connection and the link's address, not a bookable
  // page: a company that has since switched its hours off must still be able
  // to take the button down.
  if (!s.available) return NextResponse.json(refusalFor(s), { status: 409 });
  if (!s.connection) return NextResponse.json(refusalFor(s), { status: 409 });
  if (!s.hasListing) return NextResponse.json(refusalFor(s), { status: 409 });
  if (!s.bookingUrl) return NextResponse.json({ kind: "not_live", error: "There is no booking link to remove." }, { status: 409 });

  const result = await removeBookButton({ connection: s.connection, bookingUrl: s.bookingUrl });
  if (!result.ok) return NextResponse.json({ error: result.message, kind: result.kind }, { status: 502 });
  return NextResponse.json(result);
}
