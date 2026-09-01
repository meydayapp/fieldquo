// app/api/cron/voice-reconcile/route.js
//
// Hourly: ask Retell what calls it handled, and bill the ones we were never
// told about.
//
// This is the backstop that makes a lost call webhook survivable. Until it
// existed, the entire pay-per-use meter hung off one delivery path: no
// `call_ended`, no charge, no falling balance, no cut-off — a company at zero
// credit talking indefinitely on FieldQuo's pooled account, with nothing
// anywhere to see. See lib/voice/reconcileCalls.js for the whole argument, and
// app/api/cron/booking-fees for the same fix applied to Stripe.
//
// ── Hourly, and why not more often ─────────────────────────────────────────
//
// The cost of a late charge is bounded: the ceiling in lib/voice/callCeiling.js
// caps any single call at what the balance already covered, so an hour of
// unbilled calls cannot run away. The cost of running this every minute is a
// provider list call every minute, for ever, to find nothing. Hourly is the
// same cadence the booking-fee reconciler settled on for the same reason.
//
// ── `days` ─────────────────────────────────────────────────────────────────
//
// A manual catch-up after an outage, without a deploy. Bounded at 30 because a
// window wider than that is a data-repair job someone should be watching, not
// something a cron URL should be able to start.
//
// ── What this run does NOT do ──────────────────────────────────────────────
//
// It recovers the CALL — the row, the transcript, the summary, the recording,
// the duration and the charge — and stops there. Reconstructing the LEAD from a
// transcript costs a model call against the contractor's own AI allowance, per
// call, and an hourly job doing that unasked would spend somebody's quota on a
// schedule they never agreed to. So `recoverLead` is deliberately not passed
// here; it comes from POST /api/voice/calls/recover, which a person presses.
// See lib/ai/callLeadRecovery.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { reconcileVoiceCalls, RECONCILE_AREA } from "@/lib/voice/reconcileCalls";
import { recordError } from "@/lib/platform/errorLog";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const days = Number(new URL(request.url).searchParams.get("days"));
  const lookbackMs =
    Number.isFinite(days) && days > 0 ? Math.min(30, days) * DAY : undefined;

  let result;
  try {
    result = await reconcileVoiceCalls({ ...(lookbackMs ? { lookbackMs } : {}) });
  } catch (err) {
    // An unexpected throw charges nobody — reconcileVoiceCalls writes charges
    // one at a time and swallows per-call failures, so anything reaching here
    // happened before or between them. 500 so a monitored cron shows red.
    await recordError({
      area: RECONCILE_AREA,
      code: "reconcile_threw",
      message: `Voice call reconciliation failed: ${err?.message}`,
    }).catch(() => {});
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  // ── An unreachable provider is reported, not treated as "nothing to do" ──
  //
  // 200, because the cron itself worked and retrying in a tight loop helps
  // nobody. But `ok: false` and a reason, so a run that silently stopped
  // metering is distinguishable in the logs from a quiet hour. Not written to
  // the error log: Retell being briefly slow is normal, and a row an hour would
  // bury the rescues that matter.
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason, detail: result.detail });
  }

  return NextResponse.json({ ok: true, ...result });
}
