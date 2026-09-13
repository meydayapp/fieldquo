// lib/hr/policyService.js
//
// The database half of policies: create (freezing version 1), edit (the
// version decision from lib/hr/policies.js, freezing N+1 when it says so),
// the roster-vs-signatures report, and telling the people in scope.
import { policyHash, nextVersionFor, policyAppliesTo, acknowledgedCurrent } from "@/lib/hr/policies";
import { notifyWorker } from "@/lib/hr/notify";

export const POLICY_SELECT = {
  id: true,
  title: true,
  body: true,
  version: true,
  effectiveFrom: true,
  requiresAcknowledgement: true,
  audienceTitles: true,
  templateKey: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
};

/** Create a policy and freeze version 1 in the same transaction. */
export async function createPolicy(db, { companyId, data, actorUserId = null }) {
  return db.$transaction(async (tx) => {
    const policy = await tx.companyPolicy.create({
      data: { companyId, ...data, version: 1, createdById: actorUserId },
      select: POLICY_SELECT,
    });
    await tx.companyPolicyVersion.create({
      data: {
        companyId,
        policyId: policy.id,
        version: 1,
        title: policy.title,
        body: policy.body,
        bodyHash: policyHash(policy.title, policy.body),
        effectiveFrom: policy.effectiveFrom,
      },
    });
    return policy;
  });
}

/**
 * Edit a policy. A text change after a signature freezes a new version;
 * before one, corrects the frozen row in place (it was never signed —
 * mayRewriteVersion). Scope and flag changes never bump the version: who
 * must sign is not what they sign.
 */
export async function updatePolicy(db, { companyId, policy, patch }) {
  const signed = await db.policyAcknowledgement.findMany({
    where: { companyId, policyId: policy.id },
    select: { policyVersion: true },
    distinct: ["policyVersion"],
  });
  const signedVersions = new Set(signed.map((s) => s.policyVersion));
  const decision = nextVersionFor(policy, patch, { signedVersions });

  return db.$transaction(async (tx) => {
    const data = { ...patch, title: decision.title, body: decision.body, version: decision.version };
    const updated = await tx.companyPolicy.update({ where: { id: policy.id }, data, select: POLICY_SELECT });
    const textChanged = decision.title !== policy.title || decision.body !== policy.body;
    if (decision.newVersion) {
      await tx.companyPolicyVersion.create({
        data: {
          companyId,
          policyId: policy.id,
          version: decision.version,
          title: decision.title,
          body: decision.body,
          bodyHash: policyHash(decision.title, decision.body),
          effectiveFrom: updated.effectiveFrom,
        },
      });
    } else if (textChanged) {
      // The unsigned draft corrected in place. The unique (policyId, version)
      // row is the current version's, and nobody has signed it.
      await tx.companyPolicyVersion.update({
        where: { policyId_version: { policyId: policy.id, version: policy.version } },
        data: { title: decision.title, body: decision.body, bodyHash: policyHash(decision.title, decision.body) },
      });
    }
    return { policy: updated, newVersion: decision.newVersion };
  });
}

/**
 * Who has signed the current version and who has not, for one policy.
 * Active workers in scope only — a policy for "Foreman" lists the foremen.
 */
export async function acknowledgementReport(db, { companyId, policy }) {
  const [workers, acks] = await Promise.all([
    db.worker.findMany({ where: { companyId, active: true }, select: { id: true, name: true, title: true, userId: true }, orderBy: { name: "asc" } }),
    db.policyAcknowledgement.findMany({
      where: { companyId, policyId: policy.id },
      select: { id: true, workerId: true, policyVersion: true, acknowledgedAt: true, signatureName: true },
      orderBy: { acknowledgedAt: "desc" },
    }),
  ]);
  const inScope = workers.filter((w) => policyAppliesTo(policy, w));
  const rows = inScope.map((w) => {
    const current = acks.find((a) => a.workerId === w.id && a.policyVersion === policy.version) || null;
    const older = current ? null : acks.find((a) => a.workerId === w.id) || null;
    return {
      workerId: w.id,
      name: w.name,
      title: w.title,
      hasLogin: !!w.userId,
      acknowledged: !!current,
      acknowledgedAt: current?.acknowledgedAt || null,
      signatureName: current?.signatureName || null,
      olderVersion: older?.policyVersion || null,
    };
  });
  return {
    rows,
    counts: { inScope: rows.length, acknowledged: rows.filter((r) => r.acknowledged).length, pending: rows.filter((r) => !r.acknowledged).length },
  };
}

/** Tell everyone in scope who has not signed the current version. */
export async function remindPending(db, { companyId, policy, actorUserId = null }) {
  const report = await acknowledgementReport(db, { companyId, policy });
  const pending = report.rows.filter((r) => !r.acknowledged && r.hasLogin);
  const workers = pending.length
    ? await db.worker.findMany({ where: { companyId, id: { in: pending.map((p) => p.workerId) } }, select: { id: true, userId: true } })
    : [];
  let told = 0;
  for (const w of workers) {
    const r = await notifyWorker(w, { companyId, type: "hr.policy.toAcknowledge", entityId: policy.id, params: { title: policy.title }, actorUserId }, { db });
    if (r?.delivered) told += r.delivered;
  }
  return { told, pending: pending.length, noLogin: report.rows.filter((r) => !r.acknowledged && !r.hasLogin).length };
}

/** The worker's view of the policies that apply to them. */
export async function policiesForWorker(db, { companyId, worker }) {
  const [policies, acks] = await Promise.all([
    db.companyPolicy.findMany({ where: { companyId, archivedAt: null }, select: POLICY_SELECT, orderBy: [{ requiresAcknowledgement: "desc" }, { title: "asc" }] }),
    db.policyAcknowledgement.findMany({ where: { companyId, workerId: worker.id }, select: { policyId: true, policyVersion: true, acknowledgedAt: true, signatureName: true } }),
  ]);
  return policies
    .filter((p) => policyAppliesTo(p, worker))
    .map((p) => {
      const mine = acks.find((a) => a.policyId === p.id && a.policyVersion === p.version) || null;
      return {
        id: p.id,
        title: p.title,
        body: p.body,
        version: p.version,
        effectiveFrom: p.effectiveFrom,
        requiresAcknowledgement: p.requiresAcknowledgement,
        bodyHash: policyHash(p.title, p.body),
        acknowledged: acknowledgedCurrent(p, acks),
        acknowledgedAt: mine?.acknowledgedAt || null,
        signatureName: mine?.signatureName || null,
        // An older signature exists: the text changed and they are asked again.
        reacknowledge: !mine && acks.some((a) => a.policyId === p.id),
      };
    });
}
