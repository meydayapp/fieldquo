// app/api/visit/[token]/calendar/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getAppOrigin } from "@/lib/appUrl";
import { loadVisitByToken, visitView, visitManagePath, reasonMessage } from "@/lib/booking/manageVisit";
import { bookingInviteAttachment } from "@/lib/booking/bookingInvite";

// Public, token-only — the "Add to calendar" link on the client's manage
// page. Serves the SAME .ics the confirmation letter attached: same UID, the
// row's current SEQUENCE and times, METHOD:CANCEL once the booking is
// cancelled — so a client who lost the email, or whose mail client stripped
// the attachment, gets the identical event, and one that has since moved or
// been cancelled gets its current state rather than a stale copy.
//
// Same read bucket as the manage page itself: it is the same person loading
// the same booking.
const READ_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };

export async function GET(request, { params }) {
  const limited = rateLimit(request, "visit-manage-read", READ_LIMIT);
  if (limited) return limited;

  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;

  const visit = await loadVisitByToken(token);
  if (!visit) {
    return NextResponse.json(
      { error: reasonMessage("not_found"), reason: "not_found" },
      { status: 404 },
    );
  }

  const { booking, company } = visit;
  const cancelled = booking.status === "cancelled";
  let manageUrl = null;
  try {
    manageUrl = `${getAppOrigin(request)}${visitManagePath(token)}`;
  } catch {
    manageUrl = null;
  }

  const invite = await bookingInviteAttachment({
    booking,
    company,
    language: visitView(visit).language,
    method: cancelled ? "CANCEL" : "REQUEST",
    manageUrl,
  });
  if (!invite) {
    return NextResponse.json({ error: "Couldn't build the calendar file." }, { status: 500 });
  }

  return new NextResponse(Buffer.from(invite.content, "base64"), {
    status: 200,
    headers: {
      "Content-Type": `text/calendar; charset=utf-8; method=${cancelled ? "CANCEL" : "REQUEST"}`,
      "Content-Disposition": `attachment; filename="${invite.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
