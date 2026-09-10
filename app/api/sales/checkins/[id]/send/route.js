// app/api/sales/checkins/[id]/send/route.js
//
// The one and only way a drafted check-in becomes a text message.
//
// ══ Its own route, on purpose ══════════════════════════════════════════════
//
// It could have been `PATCH { status: "sent" }` on the row next door. It is
// not, and the reason is that the send has to be GREPPABLE. The promise this
// whole feature rests on — nothing texts a contractor without a rep pressing
// send — is only worth having if it can be checked mechanically, and
// scripts/check-sales-messages.mjs checks it by proving that sendCheckIn() is
// referenced by exactly this file and by nothing under app/api/cron,
// vercel.json, or any client effect. A send hidden inside a general-purpose
// update handler is a send nobody can find.
//
// ══ Everything is re-read, nothing is trusted ══════════════════════════════
//
// The row, the rep, the lead, the prospect's time zone and the do-not-contact
// list are all read fresh inside sendCheckIn(), in the request that sends —
// the discipline lib/migrations/state.js's canWrite() sets, for the same
// reason: an opt-out that landed while the rep was reading the screen has to
// win. The request body carries nothing but the id, so there is nothing in it
// to trust.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSmsRep } from "@/lib/sales/smsGate";
import { getAppOrigin } from "@/lib/appUrl";
import { salesThread } from "@/lib/sales/salesSms";
import { readCheckIn, sendCheckIn, openCheckIns } from "@/lib/sales/checkin/store";

export async function POST(request, { params }) {
  const { rep, refusal } = await requireSmsRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;

  // Read once before the send only so the response can carry the refreshed
  // thread for the right number. sendCheckIn re-reads it itself and refuses on
  // its own terms; this read grants nothing.
  const row = await readCheckIn({ salesRepId: rep.id, id });
  if (!row) return NextResponse.json({ error: "That draft is not one of yours." }, { status: 404 });

  const result = await sendCheckIn({ rep, id, origin: getAppOrigin(request) });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers || null, suppressed: Boolean(result.suppressed) },
      { status: result.status || 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    checkIn: result.checkIn,
    messages: await salesThread({ salesRepId: rep.id, withE164: row.toE164 }),
    checkIns: await openCheckIns({ salesRepId: rep.id, toE164: row.toE164 }),
  });
}
