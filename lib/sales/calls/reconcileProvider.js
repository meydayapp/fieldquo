// lib/sales/calls/reconcileProvider.js
//
// The net under the Twilio webhooks: what the carrier holds that our rows
// do not, read back from the Calls and Recordings resources.
//
// ══ Why a net, when the webhooks exist ════════════════════════════════════
//
// From 2026-09-18 every call-status and recording callback answered 500
// (app/api/rep-dial/status's header has the one-line cause). Twilio sends a
// call-progress event ONCE and does not retry it, so anything a webhook
// drops is dropped for good unless something asks the carrier afterwards.
// The price sweep beside this (costs.js reconcileCarrierPrices) already
// made that argument for prices; this file makes it for the two things the
// webhooks carry that a supervisor board reads — did the far end pick up,
// and where is the recording — and for the one column the first version of
// the status route wrote wrong (answeredAt, stamped at the hang-up).
//
// Runs from the every-minute sales-pipeline cron in its own try, small
// batches, and every write is a fact the carrier stated, never a guess:
// a row is only touched when Twilio has the leg or the file.
//
// ══ Which leg is which ════════════════════════════════════════════════════
//
// An outbound browser dial is two Twilio calls: the rep's browser leg
// (the PARENT, `repCallSid`, direction "inbound" from client:…) and the
// prospect leg the <Dial><Number> makes (the CHILD, `providerCallSid`,
// direction "outbound-dial", ParentCallSid = the rep's). Pickup, duration
// and status are the CHILD's. A recording made by <Dial record> is
// reported on the PARENT — Recording.callSid is the rep's leg — which is
// why recordCallRecording matches either column.
//
// ══ What it deliberately does not do ══════════════════════════════════════
//
// It does not turn on Twilio's answering-machine detection. AMD would tell
// "a person" from "a greeting" — the 20–60 second band the performance
// page labels as mostly voicemail — but it is billed per call and the
// owner has not said yes. Where it would go: `machineDetection: "Enable"`
// on the <Number> in app/api/rep-dial/bridge, with AnsweredBy landing on
// the status callback. Until then the band is stated, not resolved.
import { db } from "@/lib/db";
import { twilioRest, twilioConfigured } from "@/lib/sms/twilioClient";
import { recordError } from "@/lib/platform/errorLog";
import { recordCallRecording } from "./store";
import { answeredAtFrom } from "./providerStatus";
import { PROVIDER_ENDED } from "./dispositions";

/** How far back the carrier is asked. Recordings older than this are the platform page's job, by hand. */
export const RECONCILE_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
/** A call still running has no final status; ask no sooner than this after the dial. */
export const RECONCILE_SETTLE_MS = 10 * 60 * 1000;
/** Twilio's word for a recording made by <Dial record>. */
export const DIAL_RECORDING_SOURCE = "DialVerb";

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A Twilio Recording resource, read into the shape recordCallRecording
 * files. Pure. Null for anything that is not a completed file with a sid
 * — the same refusals lib/sales/calls/recording.js makes of the webhook
 * body, because this is the same file arriving by a different door.
 */
export function recordingFromResource(rec = {}) {
  const sid = typeof rec?.sid === "string" ? rec.sid.trim() : "";
  if (!/^RE[0-9a-f]{32}$/i.test(sid)) return null;
  if (rec.status && rec.status !== "completed") return null;
  const uri = typeof rec.uri === "string" ? rec.uri : "";
  if (!uri.startsWith("/2010-04-01/")) return null;
  const seconds = Number(rec.duration);
  const channels = Number(rec.channels);
  return {
    sid,
    url: `https://api.twilio.com${uri.replace(/\.json$/i, "")}`,
    seconds: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : null,
    channels: channels === 1 || channels === 2 ? channels : null,
    callSid: typeof rec.callSid === "string" ? rec.callSid : null,
    conferenceSid: typeof rec.conferenceSid === "string" ? rec.conferenceSid : null,
  };
}

/**
 * Recordings the carrier holds that no row carries — filed.
 *
 * One list call a tick (the last fortnight, newest first, `limit` rows),
 * one query for the sids already on a row, and a write per file that is
 * not. A recording no row claims — a test-line dial, a call whose row was
 * never written — is counted as `unmatched` and not logged: it would be
 * the same sid every minute, and the platform recordings page lists what
 * is on the provider for a person to look at.
 *
 * @returns {{ listed, filed, unmatched, alreadyFiled, filedAttemptIds, skipped? }}
 */
export async function reconcileRecordings({ client = db, twilio = twilioRest, now = new Date(), limit = 50, log = () => {} } = {}) {
  if (!twilioConfigured()) return { listed: 0, filed: 0, unmatched: 0, alreadyFiled: 0, filedAttemptIds: [], skipped: "twilio_not_configured" };
  const since = new Date(now.getTime() - RECONCILE_LOOKBACK_MS);
  const list = await twilio.recordings.list({ dateCreatedAfter: since, limit: Math.max(1, Math.min(200, Number(limit) || 50)) });
  const files = (Array.isArray(list) ? list : []).map(recordingFromResource).filter(Boolean);
  if (files.length === 0) return { listed: 0, filed: 0, unmatched: 0, alreadyFiled: 0, filedAttemptIds: [] };

  const existing = await client.salesCallAttempt.findMany({
    where: { recordingSid: { in: files.map((f) => f.sid) } },
    select: { recordingSid: true },
  });
  const onARow = new Set(existing.map((r) => r.recordingSid));

  let filed = 0;
  let unmatched = 0;
  const filedAttemptIds = [];
  for (const file of files) {
    if (onARow.has(file.sid)) continue;
    if (!file.callSid) {
      unmatched += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const r = await recordCallRecording({ callSid: file.callSid, recording: file, client });
    if (r.ok && r.updated > 0) {
      filed += 1;
      if (r.attemptId) filedAttemptIds.push(r.attemptId);
      log(`recording reconciled: ${file.sid} → attempt ${r.attemptId} (${file.seconds}s, ${file.channels} ch)`);
    } else if (!r.ok) {
      unmatched += 1;
    }
  }
  return { listed: files.length, filed, unmatched, alreadyFiled: onARow.size, filedAttemptIds };
}

/**
 * What a fetched Twilio Call says about a prospect leg, as the columns the
 * status webhook would have written. Pure; null when the call has not
 * ended. `status` is Twilio's own word ("completed", "no-answer", "busy",
 * "failed", "canceled"); duration is the connected seconds; end minus
 * duration is the pickup, exactly as providerStatus.js derives it from the
 * `completed` event.
 */
export function legColumnsFromCall(call = {}) {
  const status = typeof call?.status === "string" ? call.status : null;
  if (!status || !PROVIDER_ENDED.includes(status)) return null;
  const endedAt = toDate(call.endTime);
  const seconds = Number(call.duration);
  const data = { providerStatus: status };
  if (typeof call.sid === "string" && call.sid) data.providerCallSid = call.sid;
  if (Number.isFinite(seconds)) data.talkSeconds = Math.max(0, Math.round(seconds));
  if (status === "completed") {
    if (endedAt) data.endedAt = endedAt;
    const answeredAt = answeredAtFrom({ status, at: endedAt, seconds });
    if (answeredAt) data.answeredAt = answeredAt;
  } else {
    data.endReason = status;
  }
  return data;
}

/**
 * Prospect legs the webhook did not finish: three kinds, in order.
 *
 *  1. `answeredAt` equal to `endedAt` on a completed call with talk time —
 *     the first-day overwrite, repaired from the row alone (no carrier
 *     read): pickup = end minus duration.
 *  2. A row with the prospect leg's sid and no final status — the
 *     `completed` event was dropped. Fetched by sid.
 *  3. A browser dial with the rep's leg and no prospect leg at all — the
 *     bridge ran and no status event reached us. The children of the rep's
 *     leg are listed and the outbound-dial child to the dialled number is
 *     the prospect leg. A rep leg with no such child is written as
 *     `failed` / endReason "no_prospect_leg": the carrier has no leg, and
 *     leaving the row open would ask the same question every minute.
 *
 * Carrier reads are capped at `limit` a tick; the repair in (1) is not,
 * because it costs no request and the rows it applies to are finite.
 *
 * @returns {{ repairedAnsweredAt, fetched, updated, noLeg, failed }}
 */
export async function reconcileProspectLegs({ client = db, twilio = twilioRest, now = new Date(), limit = 10, log = () => {} } = {}) {
  const since = new Date(now.getTime() - RECONCILE_LOOKBACK_MS);
  const settled = new Date(now.getTime() - RECONCILE_SETTLE_MS);
  const out = { repairedAnsweredAt: 0, fetched: 0, updated: 0, noLeg: 0, failed: 0 };

  // (1) The overwrite. Prisma cannot compare two columns in a WHERE, so the
  // candidates are narrowed by what CAN be said (completed, both stamps,
  // some talk time, this fortnight) and the equality is read here.
  const stamped = await client.salesCallAttempt.findMany({
    where: {
      direction: "out",
      providerStatus: "completed",
      answeredAt: { not: null },
      endedAt: { not: null },
      talkSeconds: { gt: 0 },
      dialledAt: { gte: since },
    },
    select: { id: true, answeredAt: true, endedAt: true, talkSeconds: true },
    take: 500,
  });
  for (const row of stamped) {
    if (row.answeredAt.getTime() !== row.endedAt.getTime()) continue;
    const answeredAt = new Date(row.endedAt.getTime() - row.talkSeconds * 1000);
    // eslint-disable-next-line no-await-in-loop
    const r = await client.salesCallAttempt.updateMany({ where: { id: row.id, answeredAt: row.endedAt }, data: { answeredAt } });
    out.repairedAnsweredAt += r.count;
  }

  if (!twilioConfigured()) return { ...out, skipped: "twilio_not_configured" };
  const cap = Math.max(1, Math.min(50, Number(limit) || 10));

  // (2) Sid known, status not.
  const unfinished = await client.salesCallAttempt.findMany({
    where: { direction: "out", dialChannel: "browser", providerCallSid: { not: null }, providerStatus: null, dialledAt: { gte: since, lte: settled } },
    select: { id: true, providerCallSid: true },
    orderBy: { dialledAt: "desc" },
    take: cap,
  });
  for (const row of unfinished) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const call = await twilio.calls(row.providerCallSid).fetch();
      out.fetched += 1;
      const data = legColumnsFromCall(call);
      if (!data) continue;
      // eslint-disable-next-line no-await-in-loop
      const r = await client.salesCallAttempt.updateMany({ where: { id: row.id, providerStatus: null }, data });
      out.updated += r.count;
      log(`prospect leg reconciled: attempt ${row.id} ${data.providerStatus} ${data.talkSeconds ?? "?"}s`);
    } catch (err) {
      out.failed += 1;
      const gone = err?.status === 404 || err?.code === 20404;
      if (gone) {
        // eslint-disable-next-line no-await-in-loop
        await client.salesCallAttempt.updateMany({ where: { id: row.id, providerStatus: null }, data: { providerStatus: "failed", endReason: "not_found" } }).catch(() => {});
      }
      // eslint-disable-next-line no-await-in-loop
      await recordError({
        area: "sales_dial",
        code: gone ? "leg_not_found" : "leg_fetch_failed",
        message: `Could not read prospect leg ${row.providerCallSid} for attempt ${row.id}: ${err?.message || err}`,
        detail: { attemptId: row.id, callSid: row.providerCallSid },
      }).catch(() => {});
    }
  }

  // (3) Rep leg known, prospect leg not.
  const remaining = cap - unfinished.length;
  if (remaining <= 0) return out;
  const bridged = await client.salesCallAttempt.findMany({
    where: { direction: "out", dialChannel: "browser", repCallSid: { not: null }, providerCallSid: null, providerStatus: null, dialledAt: { gte: since, lte: settled } },
    select: { id: true, repCallSid: true, toE164: true },
    orderBy: { dialledAt: "desc" },
    take: remaining,
  });
  for (const row of bridged) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const children = await twilio.calls.list({ parentCallSid: row.repCallSid, limit: 20 });
      out.fetched += 1;
      const leg = pickProspectLeg(children, row.toE164);
      if (!leg) {
        // eslint-disable-next-line no-await-in-loop
        const r = await client.salesCallAttempt.updateMany({ where: { id: row.id, providerCallSid: null, providerStatus: null }, data: { providerStatus: "failed", endReason: "no_prospect_leg" } });
        out.noLeg += r.count;
        continue;
      }
      const data = legColumnsFromCall(leg);
      if (!data) continue;
      // eslint-disable-next-line no-await-in-loop
      const r = await client.salesCallAttempt.updateMany({ where: { id: row.id, providerCallSid: null }, data });
      out.updated += r.count;
      log(`prospect leg found: attempt ${row.id} ← ${leg.sid} ${data.providerStatus} ${data.talkSeconds ?? "?"}s`);
    } catch (err) {
      out.failed += 1;
      // eslint-disable-next-line no-await-in-loop
      await recordError({
        area: "sales_dial",
        code: "leg_list_failed",
        message: `Could not list the legs of rep call ${row.repCallSid} for attempt ${row.id}: ${err?.message || err}`,
        detail: { attemptId: row.id, repCallSid: row.repCallSid },
      }).catch(() => {});
    }
  }
  return out;
}

/**
 * The prospect leg among a rep leg's children: the outbound-dial child to
 * the number that was dialled, or — when no child carries that number (a
 * <Number> to a formatted variant) — the one outbound-dial child there is.
 * Two candidates and no number match is nobody: a guess here would pin a
 * transfer's leg on the wrong row. Pure.
 */
export function pickProspectLeg(children = [], toE164 = null) {
  const legs = (Array.isArray(children) ? children : []).filter((c) => c && c.direction === "outbound-dial");
  if (legs.length === 0) return null;
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const want = digits(toE164);
  if (want) {
    const hit = legs.find((c) => digits(c.to) === want);
    if (hit) return hit;
  }
  return legs.length === 1 ? legs[0] : null;
}
