// lib/voice/webhookHealth.js
//
// Whether Retell's call events are actually landing.
//
// ── The failure this exists to make visible ────────────────────────────────
//
// A webhook that 401s on every delivery is byte-for-byte indistinguishable
// from a phone nobody rang: no VoiceCall row, no charge, no lead, no error
// anywhere. That is exactly the state the owner's account was in — zero calls
// recorded, and no way to tell "it never rang" from "it rang and we threw the
// evidence away" (see lib/voice/webhookSignature.js for why every delivery was
// being thrown away).
//
// So a rejection is now written down, and the readiness panel reads it back.
// Two facts, and they answer different questions:
//
//   accepted   a VoiceCall row exists ⇒ a signed delivery got through. This is
//              the only positive proof the loop closes, and it is evidence of a
//              PROVIDER action, not of one of our own columns.
//   rejected   we turned a delivery away, and why. Platform-wide rather than
//              per company, and it has to be: a delivery we refuse is one we
//              never parsed, so there is no number in it to resolve a tenant
//              from. Reported as "this deployment", never attributed to a
//              company we did not identify.
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { SIGNATURE_REASON_TEXT } from "./webhookSignature";

/** area on PlatformErrorLog. Kept in one place so the read matches the write. */
export const WEBHOOK_AREA = "voice_webhook";
const REJECT_CODE_PREFIX = "webhook_rejected_";

/**
 * How often one rejection reason may be logged.
 *
 * An unsigned endpoint on the public internet is probed. Writing a row per
 * probe turns the platform error log into a denial-of-service against the
 * people who read it, and a log nobody reads is the same as no log — which is
 * the state we are climbing out of. One row an hour per reason is enough to
 * see a pattern and cheap enough to survive a scanner.
 */
const QUIET_MS = 60 * 60 * 1000;

/**
 * Note that we refused a delivery, at most once an hour per reason.
 *
 * Never throws: a broken log must not turn a 401 into a 500, because a 500
 * makes Retell retry a request we are going to refuse again anyway.
 */
export async function recordRejectedDelivery({ reason, endpoint, detail } = {}) {
  const code = `${REJECT_CODE_PREFIX}${reason || "unknown"}`;
  try {
    const since = new Date(Date.now() - QUIET_MS);
    const recent = await db.platformErrorLog.findFirst({
      where: { area: WEBHOOK_AREA, code, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) return;
    await recordError({
      area: WEBHOOK_AREA,
      code,
      message:
        `Turned away a call event from the phone provider (${reason}). ` +
        (SIGNATURE_REASON_TEXT[reason] || ""),
      detail: { endpoint: endpoint || null, ...(detail || {}) },
    });
  } catch {
    /* see above — deliberately terminal */
  }
}

/**
 * What we know about deliveries reaching this deployment.
 *
 * @returns {{ accepted: number, lastAcceptedAt: Date|null,
 *             rejection: { reason: string, at: Date }|null }}
 */
export async function webhookHealth(companyId) {
  const [lastCall, accepted, lastReject] = await Promise.all([
    companyId
      ? db.voiceCall.findFirst({
          where: { companyId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : null,
    companyId ? db.voiceCall.count({ where: { companyId } }) : 0,
    db.platformErrorLog.findFirst({
      where: { area: WEBHOOK_AREA, code: { startsWith: REJECT_CODE_PREFIX } },
      orderBy: { createdAt: "desc" },
      select: { code: true, createdAt: true },
    }),
  ]);

  return {
    accepted,
    lastAcceptedAt: lastCall?.createdAt || null,
    rejection: lastReject
      ? {
          reason: String(lastReject.code).slice(REJECT_CODE_PREFIX.length),
          at: lastReject.createdAt,
        }
      : null,
  };
}
