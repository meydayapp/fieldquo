// lib/sales/calls/supervisionStore.js
//
// The database half of lib/sales/calls/supervision.js: the platform
// setting, the SalesCallEvent rows, and the conditional writes on the
// attempt that make "one supervisor at a time" and "hold once" true under
// two browsers pressing at the same second.
//
// Kept apart from the pure module for the reason testLinesStore.js gives:
// the decisions run in check scripts under bare node and must not hold a
// Prisma client.
//
// ══ A failed settings read is "off" ═══════════════════════════════════════
//
// If the row cannot be read the mode is off and the bridge is the plain
// `<Dial>` it always was. The other direction — a cold start putting every
// call in a conference the owner did not pay for — is the failure the
// setting exists to prevent.
import { db } from "@/lib/db";
import {
  DEFAULT_SUPERVISION_SETTINGS,
  SUPERVISION_SETTING_KEY,
  normaliseSupervisionSettings,
} from "./supervision";

/** Is the SalesCallEvent table in the generated client? Probed, never assumed. */
export function supervisionStoreState(client = db) {
  const missing = client?.salesCallEvent ? [] : ["SalesCallEvent"];
  return { ready: missing.length === 0, missing };
}

export async function loadSupervisionSettings({ client = db } = {}) {
  try {
    const row = await client.platformSetting.findUnique({ where: { key: SUPERVISION_SETTING_KEY } });
    return normaliseSupervisionSettings(row?.value);
  } catch (err) {
    console.error("[sales supervision] settings could not be read; supervision is off:", err?.message);
    return { ...DEFAULT_SUPERVISION_SETTINGS };
  }
}

/** Replace the setting. The route has checked the writer is a superadmin and logs it. */
export async function saveSupervisionSettings({ value, client = db } = {}) {
  const clean = normaliseSupervisionSettings(value);
  await client.platformSetting.upsert({
    where: { key: SUPERVISION_SETTING_KEY },
    update: { value: clean },
    create: { key: SUPERVISION_SETTING_KEY, value: clean },
  });
  return clean;
}

/** One event row. Soft: a log that cannot be written must not fail a live call. */
export async function recordCallEvent({ attemptId, event, salesRepId = null, platformAdminId = null, seconds = null, detail = null, at = new Date(), client = db } = {}) {
  if (!supervisionStoreState(client).ready || !attemptId || !event) return { ok: false };
  try {
    await client.salesCallEvent.create({
      data: {
        attemptId,
        event,
        salesRepId: salesRepId || null,
        platformAdminId: platformAdminId || null,
        seconds: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : null,
        detail: detail && typeof detail === "object" ? detail : undefined,
        at,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[sales supervision] event not written:", event, err?.message);
    return { ok: false };
  }
}

/**
 * Take the supervision lock on an attempt: conditional on nobody else
 * holding it. `count === 0` means somebody won the race; the caller
 * re-reads the row and refuses in words.
 */
export async function claimSupervision({ attemptId, adminId, lock, client = db } = {}) {
  if (!attemptId || !adminId || !lock) return { ok: false, claimed: false };
  const res = await client.salesCallAttempt.updateMany({
    where: { id: attemptId, endedAt: null, OR: [{ supervisedBy: null }, { supervisedBy: adminId }] },
    data: lock,
  });
  return { ok: true, claimed: res.count > 0 };
}

/** The supervisor's leg, from the signed bridge webhook only. */
export async function recordSupervisorLeg({ attemptId, adminId, callSid, client = db } = {}) {
  if (!attemptId || !adminId || !callSid) return { ok: false, updated: 0 };
  const res = await client.salesCallAttempt.updateMany({
    where: { id: attemptId, supervisedBy: adminId },
    data: { supervisorCallSid: callSid },
  });
  return { ok: true, updated: res.count };
}

/** The room's SID, once Twilio has said it. Written once; a redelivery is a no-op. */
export async function recordConferenceSid({ attemptId, conferenceSid, client = db } = {}) {
  if (!attemptId || !conferenceSid) return { ok: false, updated: 0 };
  const res = await client.salesCallAttempt.updateMany({
    where: { id: attemptId, conferenceSid: null },
    data: { conferenceSid },
  });
  return { ok: true, updated: res.count };
}

/** Plain columns on the attempt — hold edges, supervision end, take. */
export async function writeAttempt({ attemptId, data, client = db } = {}) {
  if (!attemptId || !data) return { ok: false, updated: 0 };
  const res = await client.salesCallAttempt.updateMany({ where: { id: attemptId }, data });
  return { ok: true, updated: res.count };
}

/**
 * The columns supervision.js reads, for one attempt. Every route re-reads
 * this immediately before acting — never trusting what a screen was told.
 */
export const SUPERVISION_SELECT = Object.freeze({
  id: true,
  salesRepId: true,
  kind: true,
  direction: true,
  dialledAt: true,
  endedAt: true,
  providerStatus: true,
  providerCallSid: true,
  repCallSid: true,
  conferenceName: true,
  conferenceSid: true,
  heldAt: true,
  holdSeconds: true,
  supervisedBy: true,
  supervisionKind: true,
  supervisionSeconds: true,
  supervisorCallSid: true,
  supervisedAt: true,
  toE164: true,
  fromE164: true,
});

export async function supervisionAttempt(attemptId, { client = db } = {}) {
  if (!attemptId) return null;
  return client.salesCallAttempt.findUnique({ where: { id: String(attemptId) }, select: SUPERVISION_SELECT }).catch(() => null);
}

/**
 * The hold and supervision events of one attempt, oldest first — what the
 * transcriber uses to blank hold music, and what a review screen lists.
 */
export async function callEventsFor(attemptId, { client = db } = {}) {
  if (!supervisionStoreState(client).ready || !attemptId) return [];
  return client.salesCallEvent.findMany({ where: { attemptId }, orderBy: { at: "asc" } }).catch(() => []);
}
