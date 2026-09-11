// app/api/cron/sales-queue-release/route.js
//
// The end of a rep's day: what they never touched goes back.
//
// ══ Why hourly, and why the rep's day and not ours ═════════════════════════
//
// The owner: "any leads not contacted do have the release at the end." The
// queue already lapses a claim after 48 hours (CLAIM_HOURS), which is the
// right ceiling for a rep who worked a row and forgot to say so — and the
// wrong one for a hundred rows claimed in one press at nine in the morning
// and never dialled. Those would sit invisible to every other rep until the
// day after tomorrow.
//
// "The end of the day" is the REP's day. A closer in Kyiv and one in Vancouver
// do not go home at the same UTC instant, and nothing on SalesRep records a
// zone, so the zone the rep's browser reported at claim time travels on the
// claim row (SalesQueueClaim.repTimeZone) with the local date it was taken
// (localDate). A claim is due once today's date in that zone is later than
// the one it was taken on. Hourly, because that instant falls at a different
// hour for every zone and once a day would be up to 23 hours late for most
// of them.
//
// ══ What is released, and what is kept ════════════════════════════════════
//
// lib/sales/queueBatch.js's releaseUntouched() is the ONE definition of
// untouched — no call attempt by that rep since the claim — and it is the
// same function the "Release the rest" button calls. A row the rep dialled
// is kept on its 48-hour lease; a row a disposition already settled is out
// of scope. The claim row is closed with `day_end`, which is one of the
// reasons that sorts the row last for that rep for seven days.
//
// Nothing here deletes anything. A released row is a Prospect with
// assignedRepId back to null and a SalesQueueClaim that says when and why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { releaseDayEnded } from "@/lib/sales/queueBatch";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  try {
    const counts = await releaseDayEnded({
      db,
      now,
      log: (line) => console.error(line),
    });
    return NextResponse.json({ ok: true, at: now.toISOString(), ...counts });
  } catch (err) {
    await recordError({
      area: "cron:sales-queue-release",
      message: `Day-end release failed: ${err?.message}`,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err?.message || "failed" }, { status: 500 });
  }
}
