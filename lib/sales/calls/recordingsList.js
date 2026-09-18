// lib/sales/calls/recordingsList.js
//
// The recorded calls, read for the platform page and the export. One query,
// two shapes: the page's rows and the export's per-call records — the export
// is the same data flattened, never a second query that could disagree.
//
// Superadmin only at the route; nothing here gates, because the gate belongs
// where it can be read (app/api/platform/sales/recordings). Never a public
// or rep-facing caller: a rep does not hear their own recordings by decision
// — the owner reviews, the rep is told the call is recorded.
import { db } from "@/lib/db";

export const RECORDINGS_PAGE_MAX = 200;

/**
 * @param {{ from?: Date|null, to?: Date|null, repId?: string|null,
 *           transcribed?: "yes"|"no"|"failed"|null, limit?: number }} args
 */
export async function recordedCalls({ from = null, to = null, repId = null, transcribed = null, limit = RECORDINGS_PAGE_MAX } = {}) {
  const where = { recordingUrl: { not: null } };
  if (from || to) where.dialledAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (repId) where.salesRepId = repId;
  if (transcribed === "yes") where.transcribedAt = { not: null };
  if (transcribed === "no") where.AND = [{ transcribedAt: null }, { transcriptError: null }];
  if (transcribed === "failed") where.transcriptError = { not: null };

  const rows = await db.salesCallAttempt.findMany({
    where,
    orderBy: { dialledAt: "desc" },
    take: Math.max(1, Math.min(2000, Number(limit) || RECORDINGS_PAGE_MAX)),
    select: {
      id: true,
      direction: true,
      dialledAt: true,
      answeredAt: true,
      talkSeconds: true,
      disposition: true,
      toE164: true,
      fromE164: true,
      recordingSid: true,
      recordingSeconds: true,
      recordingChannels: true,
      recordedAt: true,
      transcript: true,
      transcriptText: true,
      transcribedAt: true,
      transcriptError: true,
      playbookKey: true,
      salesRep: { select: { id: true, name: true, email: true } },
      prospect: { select: { id: true, businessName: true, city: true, province: true, tradeKey: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    dialledAt: r.dialledAt?.toISOString?.() || null,
    answeredAt: r.answeredAt?.toISOString?.() || null,
    talkSeconds: Number.isFinite(r.talkSeconds) ? r.talkSeconds : null,
    disposition: r.disposition || null,
    // `toE164` is the contractor whichever way the call went — the schema's
    // direction header fixes that so counts never depend on who dialled.
    contractorE164: r.toE164,
    ourE164: r.fromE164,
    rep: r.salesRep ? { id: r.salesRep.id, name: r.salesRep.name, email: r.salesRep.email } : null,
    business: r.prospect
      ? { id: r.prospect.id, name: r.prospect.businessName, city: r.prospect.city, province: r.prospect.province, trade: r.prospect.tradeKey }
      : null,
    playbookKey: r.playbookKey || null,
    recordingSeconds: Number.isFinite(r.recordingSeconds) ? r.recordingSeconds : null,
    recordingChannels: Number.isFinite(r.recordingChannels) ? r.recordingChannels : null,
    recordedAt: r.recordedAt?.toISOString?.() || null,
    transcript: Array.isArray(r.transcript) ? r.transcript : null,
    transcriptText: r.transcriptText || null,
    transcribedAt: r.transcribedAt?.toISOString?.() || null,
    transcriptError: r.transcriptError || null,
  }));
}

/** CSV with one row per call; the transcript is one cell with newlines quoted. */
export function recordingsCsv(rows = []) {
  const cell = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [
    "attemptId", "direction", "dialledAt", "answeredAt", "talkSeconds", "disposition",
    "repName", "repEmail", "business", "city", "province", "trade", "contractorE164",
    "playbookKey", "recordingSeconds", "recordingChannels", "transcribedAt", "transcriptError", "transcript",
  ];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.direction, r.dialledAt, r.answeredAt, r.talkSeconds, r.disposition,
        r.rep?.name, r.rep?.email, r.business?.name, r.business?.city, r.business?.province, r.business?.trade, r.contractorE164,
        r.playbookKey, r.recordingSeconds, r.recordingChannels, r.transcribedAt, r.transcriptError, r.transcriptText,
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}
