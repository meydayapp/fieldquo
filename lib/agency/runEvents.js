// lib/agency/runEvents.js
//
// Sweep one company's lead events into the outbox and send what is due —
// the body of a nudge (lib/agency/nudge.js) and of the cron's per-company
// loop (app/api/cron/agency-events). A company with no live subscription
// costs one indexed count and stops.

import { db } from "@/lib/db";
import { sweepCompanyEvents } from "@/lib/agency/events";
import { deliverDue } from "@/lib/agency/delivery";

export async function runAgencyEventsForCompany(companyId, { client = db, now = new Date(), fetchImpl } = {}) {
  const live = await client.agencyHookSubscription.count({ where: { companyId, endedAt: null } });
  if (!live) return { skipped: true };
  const sweep = await sweepCompanyEvents({ db: client, companyId, now });
  const delivery = await deliverDue({ db: client, companyId, now, ...(fetchImpl ? { fetchImpl } : {}) });
  return { ...sweep, delivery };
}
