// app/api/platform/voice-health/route.js
//
// Is FieldQuo's own phone pool healthy, and is the meter running?
//
// ── Why this can't live in any tenant's account ─────────────────────────────
//
// Two platform-wide facts, neither of which any company can see and both of
// which take every company down at once:
//
//   1. The SHARED Retell account — one concurrency ceiling, one credit balance,
//      every tenant drawing on both. See lib/voice/pool.js.
//   2. Whether the meter is running at all. Call billing hangs off a webhook;
//      when that webhook stops, the symptom inside a tenant account is a phone
//      that works beautifully and a balance that never moves.
//
// Same reasoning as email-health and ai-health next door: a dependency that is
// invisible from inside any single account has to be visible from outside all
// of them.
//
// ── Read-only, and it stays that way ────────────────────────────────────────
//
// AGENTS.md rule 3: the platform console views everything and edits nothing on
// a company's data. This reports; it does not detach, top up or reconcile.
// Running the reconciler is the cron's job, on a schedule, with CRON_SECRET.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { poolStatus } from "@/lib/voice/pool";
import { RECONCILE_AREA } from "@/lib/voice/reconcileCalls";
import { WEBHOOK_AREA } from "@/lib/voice/webhookHealth";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 7 * DAY);

  const [pool, rescues, unknownDuration, overdrawn, rejects, lastCall, negatives] =
    await Promise.all([
      poolStatus(),
      db.platformErrorLog.count({
        where: { area: RECONCILE_AREA, code: "webhook_missed", createdAt: { gte: since } },
      }),
      db.platformErrorLog.count({
        where: { area: RECONCILE_AREA, code: "unknown_duration", createdAt: { gte: since } },
      }),
      db.platformErrorLog.count({
        where: { area: RECONCILE_AREA, code: "overdrawn", createdAt: { gte: since } },
      }),
      db.platformErrorLog.findFirst({
        where: { area: WEBHOOK_AREA, code: { startsWith: "webhook_rejected_" } },
        orderBy: { createdAt: "desc" },
        select: { code: true, createdAt: true },
      }),
      db.voiceCall.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      // Companies actually in the red RIGHT NOW, from the ledger rather than
      // from a log of past events. groupBy over a sum is the same arithmetic
      // balanceFor does, done once for everyone instead of per company.
      db.voiceCreditEntry.groupBy({
        by: ["companyId"],
        _sum: { cents: true },
        having: { cents: { _sum: { lt: 0 } } },
      }),
    ]);

  const alerts = [...pool.alerts];

  // ── The meter itself ─────────────────────────────────────────────────────
  //
  // A rescue is a SUCCESS — the money was collected — and still an alert,
  // because it is the only evidence the webhook is broken. Exactly the rule the
  // booking-fee reconciler follows: repairing something in silence is how it
  // stays broken for five bookings.
  if (rescues > 0) {
    alerts.push({
      level: "warn",
      code: "meter_rescued",
      message:
        `${rescues} call(s) in the last 7 days were billed by the hourly reconciler ` +
        `because Retell's webhook never delivered them. The money was collected, but ` +
        `call events are not reaching /api/voice/webhook — check the agents' webhook_url ` +
        `and the signing key.`,
    });
  }

  if (rejects) {
    alerts.push({
      level: "warn",
      code: "webhook_rejected",
      message:
        `We turned away a call event from Retell (${String(rejects.code).replace("webhook_rejected_", "")}). ` +
        `Deliveries are arriving and being refused, which looks identical to an idle phone.`,
    });
  }

  if (unknownDuration > 0) {
    alerts.push({
      level: "warn",
      code: "unpriced_calls",
      message:
        `${unknownDuration} batch(es) of calls had no usable duration and were deliberately ` +
        `left unbilled. Nothing is estimated — these need pricing by hand or writing off.`,
    });
  }

  if (negatives.length) {
    alerts.push({
      level: negatives.length > 3 ? "warn" : "info",
      code: "companies_overdrawn",
      message:
        `${negatives.length} compan${negatives.length === 1 ? "y is" : "ies are"} ` +
        `carrying a negative voice balance — minutes served that FieldQuo paid for and ` +
        `nobody has covered. Their agents are detached until they top up.`,
    });
  }

  return NextResponse.json({
    // "Healthy" is the absence of anything critical, not the absence of
    // anything at all — a warn is a thing to do this week, not a page down.
    healthy: !alerts.some((a) => a.level === "critical"),
    ...pool,
    alerts,
    meter: {
      rescues7d: rescues,
      unknownDuration7d: unknownDuration,
      overdrawnEvents7d: overdrawn,
      companiesOverdrawn: negatives.length,
      overdrawnCents: negatives.reduce((n, r) => n + (r._sum.cents || 0), 0),
      lastCallAt: lastCall?.createdAt || null,
      lastRejection: rejects
        ? { reason: String(rejects.code).replace("webhook_rejected_", ""), at: rejects.createdAt }
        : null,
    },
  });
}
