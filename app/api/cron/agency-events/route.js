// app/api/cron/agency-events/route.js
//
// Every five minutes: the backstop for the marketing-agency webhooks.
//
// Each write path that moves a lead nudges the sweep after its response
// (lib/agency/nudge.js), so an event normally leaves within seconds. This
// cron is what makes a lost nudge — a lambda frozen mid-after(), a write path
// nobody remembered to nudge from — cost minutes rather than an event: it
// sweeps every company with a live subscription into the outbox and sends
// every delivery that is due, retries included (lib/agency/delivery.js).
//
// Same CRON_SECRET pattern as the other crons.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { runAgencyEventsForCompany } from "@/lib/agency/runEvents";
import { deliverDue } from "@/lib/agency/delivery";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const live = await db.agencyHookSubscription.findMany({
    where: { endedAt: null, key: { revokedAt: null } },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const tally = { companies: live.length, written: 0, fannedOut: 0, delivered: 0, retried: 0, failed: 0, gone: 0, errors: 0 };
  for (const { companyId } of live) {
    try {
      const r = await runAgencyEventsForCompany(companyId, { now });
      tally.written += r.written || 0;
      tally.fannedOut += r.fannedOut || 0;
      for (const k of ["delivered", "retried", "failed", "gone"]) tally[k] += r.delivery?.[k] || 0;
    } catch (err) {
      tally.errors += 1;
      console.error("[cron/agency-events] company failed:", companyId, err?.message);
    }
  }
  // Anything still due for a company whose subscriptions all ended between
  // the sweep and now is cancelled here rather than left pending for ever.
  const rest = await deliverDue({ db, now });
  for (const k of ["delivered", "retried", "failed", "gone"]) tally[k] += rest[k] || 0;
  return NextResponse.json(tally);
}
