// lib/sales/calls/dispositionAudit.js
//
// A supervisor's verdict on what a rep SAID happened on a call.
//
// ══ Two reviews, two questions ════════════════════════════════════════════
//
// lib/sales/calls/qa.js scores HOW the rep spoke — disclosure, permission,
// banned moves — from the transcript, by a model, with a human pass over the
// number. This is a different question: was the OUTCOME the rep logged the
// truth? "Not now" on a call the transcript shows was a hang-up, "callback"
// with no time agreed, "wrong number" on a business that answered by name.
// Both are shown on the same review screen; neither replaces the other.
//
// ══ The model, from OMniLeads ═════════════════════════════════════════════
//
// AuditoriaCalificacion (ominicontacto_app/models.py ~3149–3197): a
// OneToOne on the disposition, `resultado` in APROBADA / RECHAZADA /
// OBSERVADA, `observaciones`, and `revisada` — whether the agent has read
// it. views_auditorias.py (~145–225) lets a supervisor of the campaign open
// one disposition with its history and recordings and save a verdict;
// reportes_app/reportes/reporte_estadisticas_agentes.py (~160–215) prints
// the verdict beside each call and counts OBSERVADA per agent.
//
// Kept: three verdicts, one row per disposition, the agent sees it.
// Changed: `revisada` is not a column here — the rep sees the verdict on
// the call's own row in their history and a count on their dashboard, and
// there is no button to "mark read" because a rep clicking away a rejection
// is not a control the owner asked for. History is PlatformAuditLog, the
// table every superadmin act on this console already writes to.
//
// Pure functions first (executed by scripts/check-sales-outcomes.mjs), then
// the store.

import { db } from "@/lib/db";

export const AUDIT_APPROVED = "approved";
export const AUDIT_REJECTED = "rejected";
export const AUDIT_OBSERVED = "observed";
export const AUDIT_VERDICTS = Object.freeze([AUDIT_APPROVED, AUDIT_REJECTED, AUDIT_OBSERVED]);
export const MAX_AUDIT_NOTE = 1000;

/**
 * Validate a verdict as posted. Rejected and observed need words: the rep
 * reads them, and "rejected" with nothing to act on is a mark, not a review.
 *
 * @returns {{ ok: true, verdict, notes } | { ok: false, error }}
 */
export function parseAuditVerdict(body) {
  const verdict = typeof body?.verdict === "string" ? body.verdict.trim() : "";
  if (!AUDIT_VERDICTS.includes(verdict)) return { ok: false, error: `Verdict has to be one of ${AUDIT_VERDICTS.join(", ")}.` };
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, MAX_AUDIT_NOTE) : "";
  if (verdict !== AUDIT_APPROVED && !notes) return { ok: false, error: `"${verdict}" needs a note — the rep reads it, and a verdict with no reason is one they cannot act on.` };
  return { ok: true, verdict, notes: notes || null };
}

/**
 * Audited vs unaudited and the rejection rate, per rep and overall — pure
 * over attempt rows that carry `dispositionAudit` (or null). Only rows a
 * REP wrote up count as auditable: a line-written outcome has no claim to
 * audit. The rate is over AUDITED rows, and the counts travel with it.
 */
export function auditFigures(attempts = []) {
  const perRep = new Map();
  const total = { auditable: 0, audited: 0, approved: 0, rejected: 0, observed: 0 };
  const bump = (o, row) => {
    o.auditable += 1;
    const a = row.dispositionAudit;
    if (!a) return;
    o.audited += 1;
    if (a.verdict === AUDIT_APPROVED) o.approved += 1;
    else if (a.verdict === AUDIT_REJECTED) o.rejected += 1;
    else if (a.verdict === AUDIT_OBSERVED) o.observed += 1;
  };
  for (const row of Array.isArray(attempts) ? attempts : []) {
    if (!row?.disposition || row.dispositionAutoLogged === true) continue;
    bump(total, row);
    const key = row.salesRepId || "none";
    if (!perRep.has(key)) perRep.set(key, { repId: row.salesRepId || null, auditable: 0, audited: 0, approved: 0, rejected: 0, observed: 0 });
    bump(perRep.get(key), row);
  }
  const finish = (o) => ({
    ...o,
    unaudited: o.auditable - o.audited,
    rejectionRate: o.audited > 0 ? Math.round((o.rejected / o.audited) * 100) : null,
  });
  return { total: finish(total), perRep: [...perRep.values()].map(finish).sort((a, b) => b.auditable - a.auditable) };
}

/**
 * Save (or re-save) the verdict. The current row is upserted; every save is
 * also written to PlatformAuditLog with the verdict before and after, which
 * is the history the brief asked for. The rep's outcome is copied onto the
 * verdict at this moment so a later overwrite of the outcome does not
 * silently change what was approved.
 */
export async function saveDispositionAudit({ attemptId, auditor, body, now = new Date(), client = db } = {}) {
  const parsed = parseAuditVerdict(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (!auditor?.id) return { ok: false, status: 403, error: "No auditor." };
  const attempt = await client.salesCallAttempt.findUnique({
    where: { id: String(attemptId || "") },
    select: { id: true, disposition: true, subDisposition: true, dispositionAutoLogged: true, salesRepId: true, dispositionAudit: { select: { verdict: true, notes: true } } },
  });
  if (!attempt) return { ok: false, status: 404, error: "No such call." };
  if (!attempt.disposition) return { ok: false, status: 409, error: "This call has no outcome yet — there is nothing to audit." };
  const before = attempt.dispositionAudit || null;
  const data = {
    auditorId: auditor.id,
    auditorName: auditor.name || null,
    verdict: parsed.verdict,
    notes: parsed.notes,
    disposition: attempt.disposition,
    subDisposition: attempt.subDisposition || null,
  };
  const audit = await client.$transaction(async (tx) => {
    const row = await tx.salesDispositionAudit.upsert({
      where: { attemptId: attempt.id },
      create: { attemptId: attempt.id, ...data },
      update: data,
    });
    if (typeof tx.platformAuditLog?.create === "function") {
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: auditor.id,
          action: "sales_disposition_audited",
          details: {
            attemptId: attempt.id,
            salesRepId: attempt.salesRepId,
            disposition: attempt.disposition,
            subDisposition: attempt.subDisposition || null,
            before: before ? { verdict: before.verdict, notes: before.notes } : null,
            after: { verdict: parsed.verdict, notes: parsed.notes },
            at: now.toISOString(),
          },
        },
      });
    }
    return row;
  });
  return { ok: true, audit: { ...audit, createdAt: audit.createdAt?.toISOString?.() || null, updatedAt: audit.updatedAt?.toISOString?.() || null } };
}

/** A rep's own count of rejected outcomes, for the dashboard badge. */
export async function rejectedAuditCount({ salesRepId, sinceDays = 30, now = new Date(), client = db } = {}) {
  if (!salesRepId || typeof client?.salesDispositionAudit?.count !== "function") return null;
  try {
    return await client.salesDispositionAudit.count({
      where: { verdict: AUDIT_REJECTED, updatedAt: { gte: new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000) }, attempt: { salesRepId } },
    });
  } catch {
    return null;
  }
}
