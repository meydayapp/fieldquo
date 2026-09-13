// lib/hr/compliance.js
//
// The HR & compliance overview: one row per person, four columns of "is
// there something to chase". This is the screen the owner asked for by
// name; it composes the four modules and adds nothing of its own.
//
// ══ What is NOT here ═══════════════════════════════════════════════════════
//
// No labour-law alerts — no "this person worked 13 hours without a break in
// Ontario", no provincial overtime thresholds. Those are legal claims per
// jurisdiction and per employment class, and a wrong one on a compliance
// screen is worse than none. The columns here are all facts the company
// itself recorded: a date on a certificate, a checklist it wrote, a policy
// it published, a note it asked to be signed.
//
// ══ Pure aggregation, one loader ═══════════════════════════════════════════
//
// `complianceRows()` takes rows and returns rows, so scripts/check-hr.mjs
// can feed it two companies' worth of data through the loader's fake db
// and assert the other company's people never appear. `loadCompliance()` is
// the five reads, all filtered on companyId.
import { expiringDocuments } from "@/lib/hr/documentExpiry";
import { EXPIRY_STATES } from "@/lib/expiry/window";
import { progress, overdueItems } from "@/lib/onboarding/run";
import { pendingPolicies } from "@/lib/hr/policies";
import { pendingNotes } from "@/lib/hr/notes";

/**
 * @returns {Array<{ workerId, name, title, active, userId,
 *   documents: { expired, dueSoon, unverified, worst },
 *   onboarding: null | { runId, done, total, requiredDone, requiredTotal, complete, overdue, startedAt, completedAt },
 *   policies: { pending },
 *   notes: { pending },
 *   attention: boolean }>}
 */
export function complianceRows({ workers, documents, runs, policies, acknowledgements, notes, asOf = new Date() }) {
  const docsBy = groupBy(documents, "workerId");
  const runsBy = groupBy(runs, "workerId");
  const acksBy = groupBy(acknowledgements, "workerId");
  const notesBy = groupBy(notes, "workerId");

  return (workers || []).map((w) => {
    const docs = docsBy.get(w.id) || [];
    const expiring = expiringDocuments(docs, { asOf });
    const expired = expiring.filter((d) => d.state === EXPIRY_STATES.EXPIRED).length;
    const dueSoon = expiring.filter((d) => d.state === EXPIRY_STATES.DUE_SOON).length;
    const unverified = docs.filter((d) => !d.archivedAt && d.uploadedByKind === "worker" && !d.verifiedAt).length;

    // The most recent run is the one that counts; an older completed run is
    // history. Sorted newest first by startedAt.
    const run = (runsBy.get(w.id) || []).slice().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null;
    let onboarding = null;
    if (run) {
      const p = progress(run.items);
      onboarding = {
        runId: run.id,
        ...p,
        overdue: run.completedAt ? 0 : overdueItems(run.items, run.startedAt, asOf).length,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      };
    }

    const pendingPol = pendingPolicies(policies, w, acksBy.get(w.id) || []).length;
    const pendingN = pendingNotes(notesBy.get(w.id) || []).length;

    return {
      workerId: w.id,
      name: w.name,
      title: w.title || null,
      active: w.active !== false,
      userId: w.userId || null,
      documents: {
        expired,
        dueSoon,
        unverified,
        worst: expired ? EXPIRY_STATES.EXPIRED : dueSoon ? EXPIRY_STATES.DUE_SOON : EXPIRY_STATES.OK,
      },
      onboarding,
      policies: { pending: pendingPol },
      notes: { pending: pendingN },
      attention: expired > 0 || dueSoon > 0 || (onboarding && !onboarding.complete) || pendingPol > 0 || pendingN > 0,
    };
  });
}

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows || []) {
    const k = r?.[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/** The five reads, every one filtered on the caller's company. */
export async function loadCompliance(db, companyId, { asOf = new Date(), includeInactive = false } = {}) {
  const workers = await db.worker.findMany({
    where: { companyId, ...(includeInactive ? {} : { active: true }) },
    select: { id: true, name: true, title: true, active: true, userId: true },
    orderBy: { name: "asc" },
  });
  const [documents, runs, policies, acknowledgements, notes] = await Promise.all([
    db.workerDocument.findMany({
      where: { companyId, archivedAt: null },
      select: { id: true, workerId: true, kind: true, expiresAt: true, archivedAt: true, uploadedByKind: true, verifiedAt: true, createdAt: true },
    }),
    db.onboardingRun.findMany({
      where: { companyId },
      select: { id: true, workerId: true, items: true, startedAt: true, completedAt: true },
    }),
    db.companyPolicy.findMany({
      where: { companyId, archivedAt: null },
      select: { id: true, version: true, archivedAt: true, requiresAcknowledgement: true, audienceTitles: true },
    }),
    db.policyAcknowledgement.findMany({ where: { companyId }, select: { workerId: true, policyId: true, policyVersion: true } }),
    db.workerNote.findMany({
      where: { companyId, visibleToWorker: true, requiresAcknowledgement: true },
      select: { workerId: true, visibleToWorker: true, requiresAcknowledgement: true, acknowledgedAt: true },
    }),
  ]);
  return complianceRows({ workers, documents, runs, policies, acknowledgements, notes, asOf });
}
