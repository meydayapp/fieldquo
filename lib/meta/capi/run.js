// lib/meta/capi/run.js
//
// One run of "Send lead results to Meta": sweep every switched-on company
// into the outbox, then send what is due. Shared by the quarter-hour cron
// (app/api/cron/meta-conversions) and the daily catch-up
// (app/api/cron/meta-conversions-daily) so the two cannot drift — the daily
// one only drains the queue in more passes.
//
// Meta asks for CRM stages "at least once a day". The daily run is the
// guarantee of that even on a day every quarter-hour run failed. The outbox is
// idempotent (MetaConversionEvent @@unique([companyId, kind, eventId])), so
// running both over the same rows queues nothing twice and sends nothing
// twice. A company whose sweep throws is logged with its id and the run
// carries on: one tenant's bad row never stops another tenant's events.
import { recordError } from "@/lib/platform/errorLog";
import { sweepCompany, enabledCompanyIds } from "./sweep";
import { deliverPending } from "./outbox";

export async function runMetaConversions(prisma, { daily = false, now = new Date(), deliver = deliverPending, sweep = sweepCompany } = {}) {
  const summary = { mode: daily ? "daily" : "quarter_hour", companies: 0, queued: 0, errors: 0, delivery: null };
  const ids = await enabledCompanyIds(prisma);
  for (const companyId of ids) {
    try {
      const r = await sweep(prisma, { companyId, now });
      summary.companies += 1;
      summary.queued += r.queued || 0;
    } catch (err) {
      summary.errors += 1;
      await recordError({
        area: "meta_capi",
        code: "sweep_failed",
        companyId,
        message: `Send lead results to Meta: the sweep failed for company ${companyId} — ${err?.message}`,
      });
    }
  }
  const passes = daily ? 5 : 1;
  const totals = { companies: 0, sent: 0, failed: 0, retried: 0, expired: 0, skipped: 0 };
  for (let i = 0; i < passes; i++) {
    let d = null;
    try {
      d = await deliver(prisma, { now: new Date() });
    } catch (err) {
      await recordError({ area: "meta_capi", code: "deliver_failed", message: `Send lead results to Meta: delivery run failed — ${err?.message}` });
    }
    if (!d) break;
    for (const k of Object.keys(totals)) totals[k] += d[k] || 0;
    if (!d.sent && !d.failed) break;
  }
  summary.delivery = totals;
  return summary;
}
