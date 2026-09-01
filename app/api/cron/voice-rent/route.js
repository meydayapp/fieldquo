// app/api/cron/voice-rent/route.js
//
// Once a day: take the monthly rental for every live number, or start the clock
// on losing it.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The rental was recorded on VoicePhoneNumber.monthlyCents at purchase and never
// billed — talk time drew down the prepaid balance correctly, the $4/$9 a month
// did not leave the database. FieldQuo holds the one Retell account, so that was
// a real recurring charge to FieldQuo for every number ever provisioned, forever,
// including for companies that stopped using the product.
//
// ══ Daily, not monthly ═════════════════════════════════════════════════════
//
// Each number has its own anniversary — they're bought on whatever day someone
// signs up — so a monthly cron would bill everyone on the 1st and be wrong for
// all of them. Daily means "charge whatever is due today", and the paid-through
// column makes running twice in one day a no-op.
//
// ══ Every judgement lives in the gate, not here ════════════════════════════
//
// Same shape as /api/cron/voice-outbound: this route finds the rows and counts
// the outcomes; `billNumberRent` decides and acts. Keeping the rules in one
// place is what lets a platform "bill now" button reuse them without re-deriving
// when a grace period starts.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { billNumberRent } from "@/lib/voice/spendGate";
import { getAppOrigin } from "@/lib/appUrl";

// Generous, because the work per row is a balance sum and at most one email.
// A company with more numbers than this doesn't exist yet; if it ever does, the
// leftovers are picked up by tomorrow's run rather than dropped.
const BATCH = 500;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const origin = getAppOrigin(request);

  // Only ACTIVE numbers cost money. A porting request is a piece of paperwork —
  // nothing is rented until it lands, at which point its null paid-through makes
  // it due on the first run after it goes active.
  const numbers = await db.voicePhoneNumber.findMany({
    where: { status: "active" },
    orderBy: { rentPaidThroughAt: { sort: "asc", nulls: "first" } },
    take: BATCH,
  });

  const counts = {};
  const tally = (action) => { counts[action] = (counts[action] || 0) + 1; };

  for (const number of numbers) {
    try {
      const result = await billNumberRent(number, { now, origin });
      tally(result.action);
    } catch (err) {
      // One company's bad row must not stop every other company's rent. The
      // paid-through column is untouched on a throw, so tomorrow's run retries
      // the same period under the same ref — no double charge, no skipped month.
      console.error(`[voice-rent] ${number.id} failed:`, err?.message);
      tally("error");
    }
  }

  return NextResponse.json({ success: true, considered: numbers.length, ...counts });
}
