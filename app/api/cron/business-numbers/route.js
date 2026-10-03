// app/api/cron/business-numbers/route.js
//
// Hourly: move every in-flight "Bring your number" request forward, wire in
// any that have landed, and take the month's rent on the live ones.
//
// ══ Why a cron and not only the settings screen ═══════════════════════════════
//
// The screen syncs a request when somebody looks at it. A port completes when
// the CARRIER says so — often overnight, with nobody looking — and until the
// number is wired (store.activate()) a homeowner's text to it reaches Twilio
// and goes nowhere. So the number must be connected by the clock, not by the
// owner happening to open Settings that day.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { syncRequest, billRent } from "@/lib/businessNumber/store";
import { IN_FLIGHT } from "@/lib/businessNumber/state";
import { settlePending } from "@/lib/phoneUsage/settle";

const BATCH = 200;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const origin = getAppOrigin(request);

  const [inFlight, live] = await Promise.all([
    db.broughtNumber.findMany({
      where: { simulated: false, status: { in: IN_FLIGHT.filter((s) => s !== "active") } },
      orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
      take: BATCH,
    }),
    db.broughtNumber.findMany({ where: { simulated: false, status: "active" }, take: BATCH }),
  ]);

  const counts = { synced: 0, changed: 0, activated: 0, rent: 0, errors: 0 };
  for (const row of inFlight) {
    try {
      const r = await syncRequest(row, { origin });
      counts.synced++;
      if (r.changed) counts.changed++;
      if (r.activated) counts.activated++;
    } catch (err) {
      console.error(`[business-numbers] sync ${row.id} failed:`, err?.message);
      counts.errors++;
    }
  }
  for (const row of live) {
    try {
      // A live number whose wiring failed is retried by syncRequest only while
      // in flight; once active, rent is the one thing left to do.
      const r = await billRent(row);
      if (r.charged) counts.rent++;
    } catch (err) {
      console.error(`[business-numbers] rent ${row.id} failed:`, err?.message);
      counts.errors++;
    }
  }
  // ── Texts and calls: from the floor to Twilio's price × 2 ─────────────────
  //
  // Crew texts and business-number texts and calls alike (lib/phoneUsage/
  // settle.js): each was charged its floor when it happened; here the ones
  // Twilio has since rated are topped up, and the observed prices feed the
  // cost table and the price-change detector. Own try: a settlement failure
  // must not stop rent or syncing, nor the other way round.
  let usage = null;
  try {
    usage = await settlePending();
  } catch (err) {
    console.error("[business-numbers] usage settlement failed:", err?.message);
    counts.errors++;
  }
  return NextResponse.json({ success: true, inFlight: inFlight.length, live: live.length, ...counts, usage });
}
