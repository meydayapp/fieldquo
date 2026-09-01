// app/api/cron/crew-line-rent/route.js
//
// The monthly rental on crew texting lines companies have BOUGHT.
//
// A twin of /api/cron/voice-rent, and deliberately a separate cron rather than
// a second loop inside that one: they walk different tables, and a failure in
// one must not stop the other. A company can hold a voice number and a crew
// line, and the day the voice cron throws on somebody's bad row is not the day
// every crew line should also go unbilled.
//
// This route counts and reports the outcomes; billCrewLineRent decides and
// acts. Keeping the rules in one place is what stops the cron from growing its
// own opinion about grace periods.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { billCrewLineRent } from "@/lib/crew/lineRent";
import { getAppOrigin } from "@/lib/appUrl";

// Generous — the work per row is a balance sum and at most one email. Leftovers
// are picked up by tomorrow's run rather than dropped.
const BATCH = 500;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const origin = getAppOrigin(request);

  // Only DEDICATED lines cost anything. A shared_test loan is FieldQuo's own
  // number lent out to prove the feature works; it expires rather than being
  // billed, and charging for it would be charging for the trial. Filtered in
  // the query rather than skipped in the loop so the `considered` count means
  // what it says.
  const lines = await db.crewInboxNumber.findMany({
    where: { source: "dedicated" },
    orderBy: { rentPaidThroughAt: { sort: "asc", nulls: "first" } },
    take: BATCH,
  });

  const counts = {};
  const tally = (action) => { counts[action] = (counts[action] || 0) + 1; };

  for (const line of lines) {
    try {
      const result = await billCrewLineRent(line, { now, origin });
      tally(result.action);
    } catch (err) {
      // One company's bad row must not stop every other company's rent. The
      // paid-through column is untouched on a throw, so tomorrow's run retries
      // the same period under the same ref — no double charge, no skipped month.
      console.error(`[crew-line-rent] ${line.id} failed:`, err?.message);
      tally("error");
    }
  }

  return NextResponse.json({ success: true, considered: lines.length, ...counts });
}
