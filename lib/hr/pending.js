// lib/hr/pending.js
//
// "How many things is this person being asked to sign?" — for the employee
// home's banner. Two counts, one worker id, never throws: a read failure is
// 0 pending rather than a crashed home screen (the pages behind the counts
// report the real error). Server-side only — this imports the Prisma
// client; the pure rules it applies are in lib/hr/policies.js and
// lib/hr/notes.js, which the screens may import.
import { db as defaultDb } from "@/lib/db";
import { pendingPolicies } from "@/lib/hr/policies";

/** Required policies in scope for the worker that they have not signed in
 *  the current version. */
export async function pendingPolicyCount(workerId, { db = defaultDb } = {}) {
  if (!workerId) return 0;
  try {
    const worker = await db.worker.findUnique({ where: { id: workerId }, select: { id: true, companyId: true, title: true } });
    if (!worker) return 0;
    const [policies, acks] = await Promise.all([
      db.companyPolicy.findMany({
        where: { companyId: worker.companyId, archivedAt: null, requiresAcknowledgement: true },
        select: { id: true, version: true, archivedAt: true, requiresAcknowledgement: true, audienceTitles: true },
      }),
      db.policyAcknowledgement.findMany({
        where: { companyId: worker.companyId, workerId: worker.id },
        select: { policyId: true, policyVersion: true },
      }),
    ]);
    return pendingPolicies(policies, worker, acks).length;
  } catch {
    return 0;
  }
}

/** Visible notes that ask for the worker's acknowledgement and have none. */
export async function pendingNoteCount(workerId, { db = defaultDb } = {}) {
  if (!workerId) return 0;
  try {
    return await db.workerNote.count({
      where: { workerId, visibleToWorker: true, requiresAcknowledgement: true, acknowledgedAt: null },
    });
  } catch {
    return 0;
  }
}
