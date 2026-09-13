// lib/hr/notify.js
//
// The HR module's notifications, all through notifyEvent — the one way a
// feed row (and its Web Push copy) comes into existence — with the
// recipient NAMED. Fire-and-forget at every call site: the document is
// filed, the run is started, the policy is published; a feed problem must
// not undo any of that.
//
// `db` is the caller's Prisma handle. It is passed to notifyEvent as its
// injection seam ONLY when it is not the real client — scripts/check-hr.mjs
// runs the service layer against scripts/hrFakeDb.mjs and must see the
// delivery rows land there. With the real client the seam stays empty, so
// the Web Push copy (which notifyEvent skips whenever a seam is present) is
// still sent in production.
import { db as defaultDb } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";

function seam(db) {
  return db && db !== defaultDb ? { db } : {};
}

/** Tell one worker something about their own file. No-op without a login. */
export function notifyWorker(worker, { companyId, type, entityId = null, params = null, actorUserId = null }, { db } = {}) {
  if (!worker?.userId) return Promise.resolve({ created: false, delivered: 0, reason: "no_login" });
  return notifyEvent(
    { companyId, type, entityId, params, actorUserId, recipientUserIds: [worker.userId] },
    seam(db),
  ).catch(() => ({ created: false, delivered: 0, reason: "error" }));
}

/** Tell the managers (everyone with user:manage) about a person's file. */
export function notifyManagers({ companyId, type, entityId = null, params = null, actorUserId = null }, { db } = {}) {
  return notifyEvent({ companyId, type, entityId, params, actorUserId }, seam(db)).catch(() => ({
    created: false,
    delivered: 0,
    reason: "error",
  }));
}
