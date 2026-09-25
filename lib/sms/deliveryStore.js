// lib/sms/deliveryStore.js
//
// SmsDelivery rows: opened by sendSms(), advanced by Twilio's statusCallback
// (/api/sms/status) and by the reconcile cron (/api/cron/sms-delivery-reconcile).
// The ordering rules are in lib/sms/deliveryStatus.js; this file only applies
// them to the database.
//
// ══ Tracking must never stop a text ════════════════════════════════════════
//
// Every function here that sendSms() calls swallows its own failure. A
// database blip, or a deployment that shipped before the SmsDelivery table was
// created, must cost us the RECEIPT, never the text itself — a booking
// confirmation that does not go out because we could not write down that it
// went out would be the tracking breaking the thing it tracks.

import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import {
  normaliseStatus,
  normaliseErrorCode,
  normalisePurpose,
  statusesThatMayAdvanceTo,
  FAILED_STATUSES,
  reasonText,
  maskPhone,
} from "@/lib/sms/deliveryStatus";

/**
 * Where Twilio should post this text's status changes, or null when this
 * deployment has no address Twilio could reach.
 *
 * `d` is the row's id — opaque (a cuid names nothing and guesses nothing), and
 * it lets a callback find its row even when it lands before sendSms() has
 * written the SID back. It is NOT the access control: the route verifies
 * X-Twilio-Signature, and Twilio signs the full URL including `?d=`, so the
 * id cannot be swapped on a genuine callback either.
 *
 * Null on localhost: Twilio cannot post to a developer's laptop, and a
 * callback URL it will fail on every time would only fill Twilio's debugger.
 * The reconcile cron covers those rows the same way it covers a misrouted
 * webhook in production.
 */
export function statusCallbackUrl(deliveryId, origin = null) {
  if (!deliveryId) return null;
  let base = origin;
  if (!base) {
    try {
      base = getAppOrigin();
    } catch {
      return null;
    }
  }
  if (!/^https:\/\//i.test(base) || /\/\/(localhost|127\.|0\.0\.0\.0)/i.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/api/sms/status?d=${encodeURIComponent(deliveryId)}`;
}

/**
 * The row, written BEFORE the send. Returns null (and the send goes ahead
 * untracked) when it cannot be written.
 */
export async function openDelivery({ companyId, purpose, ref, clientId, to, from }, prisma = db) {
  try {
    return await prisma.smsDelivery.create({
      data: {
        companyId: companyId || null,
        purpose: normalisePurpose(purpose),
        refType: ref?.type ? String(ref.type).slice(0, 40) : null,
        refId: ref?.id ? String(ref.id).slice(0, 64) : null,
        clientId: clientId || null,
        toE164: String(to),
        fromE164: from ? String(from) : null,
        status: "pending",
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[sms] couldn't open a delivery row — sending untracked:", err?.message);
    return null;
  }
}

/** What Twilio's create call answered. Never throws. */
export async function recordSendAccepted(row, { sid, status, errorCode = null, errorMessage = null }, prisma = db) {
  if (!row?.id || !sid) return;
  try {
    // The SID first, unconditionally: a callback may already have advanced
    // the status past what the create call reported (it can land first), and
    // the SID is how the reconcile cron finds the row either way.
    await prisma.smsDelivery.updateMany({ where: { id: row.id, sid: null }, data: { sid: String(sid) } });
    await applyStatus(
      { id: row.id, sid, status: status || "queued", errorCode, errorMessage, source: "send" },
      prisma,
    );
  } catch (err) {
    console.error("[sms] couldn't record the SID:", err?.message);
  }
}

/** Twilio refused the create call outright — nothing was queued. Never throws. */
export async function recordSendRefused(row, err, prisma = db) {
  if (!row?.id) return;
  try {
    await applyStatus(
      {
        id: row.id,
        status: "failed",
        // Twilio's RestException carries the numeric code (21211, 21610 …).
        errorCode: err?.code,
        errorMessage: err?.message || null,
        source: "send",
      },
      prisma,
    );
  } catch (e) {
    console.error("[sms] couldn't record the refusal:", e?.message);
  }
}

/**
 * Move a row forward, once. Shared by the send, the callback and the cron.
 *
 * Looked up by `id` when the caller has it (the callback's `?d=`), else by
 * `sid`. When both are given they must agree — a signed callback naming one
 * row's id and another text's SID is refused rather than half-applied.
 *
 * Idempotent and race-safe: the update is conditional on the stored status
 * being one this status may advance from, so a duplicate or out-of-order
 * webhook matches no row and changes nothing.
 *
 * @returns {{ applied: boolean, reason?: string, row?: object }}
 */
export async function applyStatus(
  { id = null, sid = null, status, errorCode = null, errorMessage = null, source, at = new Date() },
  prisma = db,
) {
  const next = normaliseStatus(status);
  if (!next) return { applied: false, reason: "unknown_status" };
  if (!id && !sid) return { applied: false, reason: "no_key" };

  const row = await prisma.smsDelivery.findUnique({
    where: id ? { id: String(id) } : { sid: String(sid) },
    select: { id: true, sid: true, companyId: true, purpose: true, status: true },
  });
  if (!row) return { applied: false, reason: "unknown_row" };
  if (id && sid && row.sid && row.sid !== String(sid)) return { applied: false, reason: "sid_mismatch" };

  const code = normaliseErrorCode(errorCode);
  const evidence =
    source === "callback"
      ? { lastCallbackAt: at, callbackCount: { increment: 1 } }
      : source === "reconcile"
        ? { reconciledAt: at }
        : {};

  const res = await prisma.smsDelivery.updateMany({
    where: { id: row.id, status: { in: statusesThatMayAdvanceTo(next) } },
    data: {
      status: next,
      statusAt: at,
      ...(sid && !row.sid ? { sid: String(sid) } : {}),
      // A code arrives with the failure; a later success carries none, and
      // must not blank the one a failure left (a failure is final anyway).
      ...(code != null ? { errorCode: code } : {}),
      ...(errorMessage ? { errorMessage: String(errorMessage).slice(0, 500) } : {}),
      ...evidence,
    },
  });

  if (res.count === 0) {
    // Not an advance — but the callback still ARRIVED, and that is the
    // evidence /platform/sms-health counts to tell a working webhook from a
    // misrouted one. Without this, a text whose "sent" callback lost the race
    // to its "delivered" one would read as never having had a callback.
    if (source === "callback" || source === "reconcile") {
      await prisma.smsDelivery.update({ where: { id: row.id }, data: evidence }).catch(() => {});
    }
    return { applied: false, reason: "not_an_advance", row };
  }

  const effectiveSid = row.sid || (sid ? String(sid) : null);
  if (row.purpose === "thread_reply" && row.companyId && effectiveSid) {
    await mirrorOntoMessage({ companyId: row.companyId, sid: effectiveSid, status: next, errorCode: code, at }, prisma)
      .catch((err) => console.error("[sms] couldn't mirror the status onto the thread:", err?.message));
  }
  return { applied: true, row: { ...row, status: next } };
}

/**
 * A conversation reply's fate, written onto its Message row the way a
 * WhatsApp receipt already is (lib/messaging/ingest.js markReceipt): the
 * thread's own fields, read by everything that asks "did the homeowner get
 * our last reply" — the waiting list, the monthly review, the AI employee.
 *
 * The SMS Message row's externalId IS the Twilio SID (lib/messaging/ownSend.js
 * returns it and the caller stores it), scoped by the thread's company so a
 * SID can never reach another tenant's row. deliveredAt is only ever filled,
 * never cleared; failedReason only ever filled — same rule as markReceipt.
 */
async function mirrorOntoMessage({ companyId, sid, status, errorCode, at }, prisma) {
  const base = { externalId: sid, direction: "out", thread: { companyId } };
  if (status === "delivered" || status === "read") {
    await prisma.message.updateMany({ where: { ...base, deliveredAt: null }, data: { deliveredAt: at } });
  } else if (FAILED_STATUSES.includes(status)) {
    await prisma.message.updateMany({
      where: { ...base, failedReason: null },
      data: { failedReason: `sms_${errorCode || status}: ${reasonText(errorCode)}` },
    });
  }
}

/**
 * Receipts for a thread's outbound texts, by SID, scoped to the company.
 * Twilio SIDs start SM (text) or MM (picture message); anything else on a
 * Message row (a `local:` id for a send that failed before Twilio) has none.
 *
 * @returns Map<sid, { status, errorCode }>
 */
export async function smsReceiptsBySid(companyId, sids, prisma = db) {
  const out = new Map();
  const list = [...new Set((sids || []).filter((s) => typeof s === "string" && /^(SM|MM)[0-9a-f]{32}$/i.test(s)))];
  if (!companyId || !list.length) return out;
  const rows = await prisma.smsDelivery.findMany({
    where: { companyId, sid: { in: list } },
    select: { sid: true, status: true, errorCode: true },
  });
  for (const r of rows) out.set(r.sid, { status: r.status, errorCode: r.errorCode });
  return out;
}

/** The calendar's three kinds of entry — each is the refType its texts carry. */
const CALENDAR_REF_TYPES = ["appointment", "visit", "booking"];
const CALENDAR_LOOKBACK_MS = 120 * 24 * 60 * 60 * 1000;

/**
 * Put each calendar entry's texts beside it: `entry.texts = [{ purpose,
 * status, errorCode, sentAt }]`, newest first, only on entries that have any.
 *
 * Read by company and recency rather than by an IN-list of the entries' ids:
 * the calendar feed is every appointment the company ever had, and the texts
 * worth showing are the recent ones. An entry with no row gets no `texts` —
 * which the screen draws as nothing, never as "no text was sent", because a
 * text sent before receipts existed has no row either.
 */
export async function attachCalendarTexts(companyId, entries, prisma = db, now = new Date()) {
  if (!companyId || !Array.isArray(entries) || !entries.length) return entries;
  const rows = await prisma.smsDelivery.findMany({
    where: {
      companyId,
      refType: { in: CALENDAR_REF_TYPES },
      sentAt: { gte: new Date(now.getTime() - CALENDAR_LOOKBACK_MS) },
    },
    orderBy: { sentAt: "desc" },
    select: { refType: true, refId: true, purpose: true, status: true, errorCode: true, sentAt: true },
    take: 5000,
  });
  if (!rows.length) return entries;
  const byRef = new Map();
  for (const r of rows) {
    const key = `${r.refType}:${r.refId}`;
    if (!byRef.has(key)) byRef.set(key, []);
    byRef.get(key).push({ purpose: r.purpose, status: r.status, errorCode: r.errorCode, sentAt: r.sentAt });
  }
  return entries.map((e) => {
    const texts = byRef.get(`${e?.kind}:${e?.id}`);
    return texts ? { ...e, texts } : e;
  });
}

/**
 * The texts a client was sent, newest first — the client page's list.
 * Numbers are masked here, server-side, so the full number never needs to
 * reach the browser for this.
 */
export async function textsForClient(companyId, clientId, prisma = db, limit = 20) {
  if (!companyId || !clientId) return [];
  const rows = await prisma.smsDelivery.findMany({
    where: { companyId, clientId },
    orderBy: { sentAt: "desc" },
    take: limit,
    select: { id: true, purpose: true, status: true, errorCode: true, sentAt: true, toE164: true },
  });
  return rows.map(({ toE164, ...r }) => ({ ...r, to: maskPhone(toE164) }));
}
