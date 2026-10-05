// app/api/cron/ai-plan-reset/route.js
//
// The daily half of the AI credit plan's monthly reset (owner, 2026-10-04:
// plan credit resets each month and does not roll over; top-ups persist).
//
// The usual reset happens at renewal, inside grantAiBundlePeriod, just before
// the new month's credit lands. This sweep is for the month that ended with
// NO renewal — the plan was cancelled, or the renewal card failed — whose
// unused credit would otherwise roll over by default, which is the opposite
// of the rule. lib/ai/planCreditReset.js holds the arithmetic and the draw
// order; the ledger ref makes a sweep that overlaps a renewal reset once.
//
// Listed in vercel.json, gated by requireCronSecret like every other cron.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { expireDuePlanCredit } from "@/lib/ai/planCreditReset";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const result = await expireDuePlanCredit({ now: new Date() });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // Nothing half-done to undo: each reset is one idempotent ledger row, and
    // tomorrow's run picks up whatever this one did not reach.
    await recordError({
      area: "cron",
      code: "ai_plan_reset_failed",
      message: `AI credit plan reset sweep failed: ${String(err?.message || err).slice(0, 200)}. Unused plan credit stays on balances until a run succeeds.`,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "reset_failed" }, { status: 500 });
  }
}
