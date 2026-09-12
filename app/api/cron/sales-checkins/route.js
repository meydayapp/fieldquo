// app/api/cron/sales-checkins/route.js
//
// Before the reps' day starts, the check-ins their companies are owed exist.
//
// ══ What this writes, and what it must never do ════════════════════════════
//
// DRAFTS. Rows in SalesCheckIn with status "draft", one per company per
// touchpoint (day 1, day 7, the milestone approach — lib/sales/checkin/
// signals.js's SCHEDULED_CHECKIN_DAYS and RETENTION_NEAR_DAYS), and the lead
// that stands for a company nobody had a lead for. It does not send. It
// cannot: it imports lib/sales/checkin/materialise.js, which has no send path
// in it, and scripts/check-sales-messages.mjs asserts that no file under
// app/api/cron reaches lib/sales/checkin/store.js — the module the send lives
// in — or lib/sales/salesSms.js. "Nothing texts a contractor without a rep
// pressing send" is the owner's requirement and it survives this cron by
// construction, not by promise.
//
// ══ Why a cron at all, when the screens materialise on load ════════════════
//
// GET /api/sales/companies and the texts list both run the same materialiser
// on request, so a rep who opens the portal sees the backlog whether or not
// this ran. This exists for the rep who does not open the portal: a day-7
// draft written at 07:00 UTC is waiting at 9am in Toronto, and a rep on a
// dashboard elsewhere (the queue's Tasks tab, a notification some day) is
// looking at rows that exist rather than at rows that would have existed
// had they opened the right tab first.
//
// 07:00 UTC is before the texting window opens anywhere in North America
// (SALES_SMS_WINDOW starts at 08:00 local; 07:00 UTC is 03:00 in Halifax),
// so every draft's scheduledFor is the coming morning's opening, not a moment
// already passed.
//
// ══ Idempotent, so a re-run is free ════════════════════════════════════════
//
// Every row is keyed; a second tick finds the first tick's rows. The count in
// the response says what was NEW, so a day with nothing to add reads as zero
// created and not as a failure.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { materialiseCheckInsForAllReps } from "@/lib/sales/checkin/materialise";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  try {
    const report = await materialiseCheckInsForAllReps({
      client: db,
      now,
      log: (line) => console.error(line),
    });
    // The per-rep detail carries draft wording and numbers; the cron's
    // response is a count, the way the other sales crons answer.
    const { perRep: _perRep, ...counts } = report;
    return NextResponse.json({ ok: true, at: now.toISOString(), ...counts });
  } catch (err) {
    await recordError({
      area: "cron:sales-checkins",
      message: `Check-in backlog failed: ${err?.message}`,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err?.message || "failed" }, { status: 500 });
  }
}
