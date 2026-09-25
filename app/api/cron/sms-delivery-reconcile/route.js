// app/api/cron/sms-delivery-reconcile/route.js
//
// Hourly. Asks Twilio what became of every text whose status callback never
// arrived.
//
// ══ Why a cron as well as a webhook ═══════════════════════════════════════
//
// Booking fees, invoices and voice calls in this codebase all once failed
// silently for one reason: a webhook that was pointed at the wrong place, or
// never registered, and nothing that noticed it hadn't come. /api/sms/status
// is a webhook like those. So this job does not trust it: any text still in
// flight half an hour after it was sent is looked up by SID in Twilio's own
// records and moved on from there. The row remembers WHICH mechanism settled
// it (lastCallbackAt vs reconciledAt), and /platform/sms-health shows the
// ratio — a webhook that stopped arriving becomes a number on a screen.
//
// Bounded: at most BATCH rows a run, oldest first, and a row is asked about at
// most once an hour and never after 72 hours (lib/sms/deliveryStatus.js
// needsReconcile says why). A text still "sent" after that is a carrier that
// returns no receipts, and it stays honestly "sent".
//
// Also closes rows whose send never returned a SID (the function died between
// writing the row and Twilio answering) as "unconfirmed", so none sits at
// "pending" for ever looking as though it might still go out.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { twilioRest, twilioConfigured } from "@/lib/sms/twilioClient";
import { applyStatus } from "@/lib/sms/deliveryStore";
import { reconcileWhere, lostSendWhere } from "@/lib/sms/deliveryStatus";

const BATCH = 150;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  const lost = await db.smsDelivery.updateMany({
    where: lostSendWhere(now),
    data: {
      status: "unconfirmed",
      statusAt: now,
      errorMessage: "The send was interrupted before Twilio confirmed it — it may or may not have gone out.",
    },
  });

  if (!twilioConfigured()) {
    return NextResponse.json({ success: true, skipped: "twilio_not_configured", closedLost: lost.count });
  }

  const due = await db.smsDelivery.findMany({
    where: reconcileWhere(now),
    orderBy: { sentAt: "asc" },
    take: BATCH,
    select: { id: true, sid: true },
  });

  let advanced = 0;
  let unchanged = 0;
  let errors = 0;
  for (const row of due) {
    try {
      const m = await twilioRest.messages(row.sid).fetch();
      const res = await applyStatus({
        id: row.id,
        sid: row.sid,
        status: m.status,
        errorCode: m.errorCode,
        errorMessage: m.errorMessage,
        source: "reconcile",
        at: new Date(),
      });
      if (res.applied) advanced++;
      else unchanged++;
    } catch (err) {
      errors++;
      // Stamped anyway, so one message Twilio cannot find (a 404 on a
      // deleted message) is not re-asked every hour until it ages out.
      await db.smsDelivery
        .update({ where: { id: row.id }, data: { reconciledAt: new Date() } })
        .catch(() => {});
      console.error(`[sms-delivery-reconcile] ${row.sid}: ${err?.message}`);
    }
  }

  return NextResponse.json({ success: true, checked: due.length, advanced, unchanged, errors, closedLost: lost.count });
}
