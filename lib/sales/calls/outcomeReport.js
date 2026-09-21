// lib/sales/calls/outcomeReport.js
//
// The "outcomes" block on /platform/sales/performance: outcomes broken down
// by sub-reason, audited vs unaudited per rep with the rejection rate, and
// the inbound service level. One loader, three pure modules.
//
// Read separately from loadPerformanceReport() rather than folded into it:
// that loader is shared with the agency page, and an audit verdict is the
// owner's business — an agency never sees it. The platform route calls this
// beside the shared report and merges the answer in.

import { db } from "@/lib/db";
import { excludingTestDials } from "@/lib/sales/testLines";
import { subDispositionCounts } from "./subDispositions";
import { auditFigures } from "./dispositionAudit";
import { serviceLevelFigures } from "./serviceLevel";
import { loadSubDispositions, outcomeSettingValues } from "./outcomeSettingsStore";

export async function loadOutcomeReport({ from, to, client = db } = {}) {
  const [subs, settings, outbound, inbound, reps] = await Promise.all([
    loadSubDispositions({ client }),
    outcomeSettingValues({ client }),
    client.salesCallAttempt.findMany({
      where: excludingTestDials({ dialledAt: { gte: from, lte: to }, direction: "out", disposition: { not: null } }),
      select: {
        id: true,
        salesRepId: true,
        disposition: true,
        subDisposition: true,
        subDispositionDetail: true,
        dispositionAutoLogged: true,
        amdResult: true,
        dispositionAudit: { select: { verdict: true } },
      },
    }),
    client.salesCallAttempt.findMany({
      where: { dialledAt: { gte: from, lte: to }, direction: "in" },
      select: { id: true, direction: true, salesRepId: true, answeredByRepId: true, dialledAt: true, answeredAt: true, missedAt: true, voicemailUrl: true, voicemailSeconds: true },
    }),
    client.salesRep.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(reps.map((r) => [r.id, r.name]));
  const withNames = (rows) => rows.map((r) => ({ ...r, repName: r.repId ? nameOf.get(r.repId) || null : null }));

  const audits = auditFigures(outbound);
  const sl = serviceLevelFigures(inbound, { serviceLevelSeconds: settings["sales.inbound.serviceLevelSeconds"] });

  // AMD, measured where it ran: how many outbound rows carry a verdict in
  // the period, and the split. Null counts when none did — the feature is
  // off by default and a zero would read as "no machines".
  const amdRows = outbound.filter((r) => r.amdResult);
  const amd = amdRows.length
    ? {
        verdicts: amdRows.length,
        machine: amdRows.filter((r) => r.amdResult.startsWith("machine_")).length,
        human: amdRows.filter((r) => r.amdResult === "human").length,
        unknown: amdRows.filter((r) => r.amdResult === "unknown" || r.amdResult === "fax").length,
      }
    : null;

  return {
    subDispositions: subDispositionCounts(outbound, { lists: subs.lists }),
    audits: { total: audits.total, perRep: withNames(audits.perRep) },
    serviceLevel: { ...sl, perRep: withNames(sl.perRep) },
    amd: { enabled: settings["sales.amd.enabled"] === true, ...(amd || { verdicts: 0, machine: null, human: null, unknown: null }) },
    sampling: { transcriptionPercent: settings["sales.transcription.percent"], aiReviewPercent: settings["sales.aiReview.percent"] },
  };
}
