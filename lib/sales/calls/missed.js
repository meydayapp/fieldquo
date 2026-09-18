// lib/sales/calls/missed.js
//
// A contractor rang a sales number back and nobody picked up. This is the
// record of that, and the push that tells somebody.
//
// ══ The three outcomes, and the one that had no record ════════════════════
//
// Every inbound call to a sales number must end in exactly one of:
//
//   ANSWERED    a rep picked up — `answeredAt` on the attempt, written by the
//               after-dial stage or by app/api/sales/calls/answered.
//   VOICEMAIL   nobody picked up and the caller left a message —
//               `voicemailUrl` on the attempt, written by the after-voicemail
//               stage. Shown on /sales/voicemail.
//   MISSED      nobody picked up and no message was left — the caller hung up
//               while it rang, while they held, or at the beep. `missedAt`
//               here.
//
// Until 2026-09-17 the third had nothing. The attempt row was written when
// the call arrived (recordInbound), and if the caller then hung up during the
// ring, Twilio ended the session without requesting any action URL — that is
// documented <Dial> behaviour, "if the initial caller hangs up, the Twilio
// session ends" — and no callback of ours ever ran again for that CallSid.
// The row sat with every provider column null, indistinguishable from a call
// still in progress, and nobody was told. A rep found it an hour later on her
// unlogged list and reported that a client "called her back but she received
// no notification and there was no voicemail". Both true.
//
// ══ Two writers, one guard ════════════════════════════════════════════════
//
// The number's STATUS CALLBACK is the honest signal: Twilio posts the parent
// call's final status (`?stage=status` on app/api/rep-dial/inbound) whatever
// TwiML was running when the caller hung up. It is set on every number bought
// from now on (lib/crew/platformNumber.js) and has to be set by hand on the
// six already held — the report that ships with this change gives the
// console path. Until it is, the SWEEP below catches the same rows late:
// inbound, unanswered, no message, older than the longest the queue can
// possibly hold a caller.
//
// Both go through markMissed(), and its `missedAt: null` WHERE is the whole
// idempotency story. A Twilio retry, a sweep overlapping a callback, a
// callback arriving after a sweep — each updates zero rows, and a push is
// only sent when the update wrote one. There is no "notified" column because
// the write and the notification are the same decision.
//
// ══ Not in store.js, deliberately ═════════════════════════════════════════
//
// store.js is the outbound call ledger and is edited by the call-outcome
// work concurrently with this. The inbound outcome is its own concern with
// its own callers (the status stage, the sweep, the voicemail screen), so it
// lives beside voicemail.js, which it mirrors: pure `*Where` and `*View`
// helpers a route can compose, and the writes below them.

import { db } from "@/lib/db";
import { callStoreState } from "./store";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { recordError } from "@/lib/platform/errorLog";
import { maxHoldSeconds } from "./queue";
import { RING_SECONDS } from "./inboundDistribution";

/** The statuses Twilio's status callback reports for a call that is over. */
export const ENDED_STATUSES = Object.freeze(["completed", "busy", "no-answer", "failed", "canceled"]);

/**
 * How old an unresolved inbound row has to be before the sweep calls it
 * missed. Derived, not guessed: the first ring, every queue round, and the
 * two-minute voicemail window, plus a margin for Twilio's own retries. A row
 * younger than this may still be a caller on hold.
 */
export const MISSED_SWEEP_AFTER_SECONDS = RING_SECONDS + maxHoldSeconds() + 120 + 60;

/** How many rows one sweep will mark. A backlog drains over a few minutes. */
export const SWEEP_LIMIT = 50;

/**
 * Which of the three outcomes an inbound attempt row is in — or "open" while
 * it is none of them yet, or null for a row that is not inbound at all.
 *
 * Voicemail outranks missed: the status callback can land after the caller's
 * message was attached, and a row carrying both is a message, not a miss.
 */
export function inboundOutcome(attempt) {
  if (!attempt || attempt.direction !== "in") return null;
  if (attempt.answeredAt) return "answered";
  if (typeof attempt.voicemailUrl === "string" && attempt.voicemailUrl.trim()) return "voicemail";
  if (attempt.missedAt) return "missed";
  return "open";
}

/** Is this status one Twilio only sends once the call is over? */
export function isEndedStatus(status) {
  return typeof status === "string" && ENDED_STATUSES.includes(status);
}

/**
 * The rows a rep's Voicemail screen lists under "Missed calls". Same
 * ownership rule as voicemailWhere(): filed to them, or rang one of their
 * numbers. Rows with a message are excluded here because they are already on
 * the same screen as voicemails.
 */
export function missedWhere({ salesRepId, ourNumbers = [] } = {}) {
  const mine = (Array.isArray(ourNumbers) ? ourNumbers : []).filter(
    (n) => typeof n === "string" && n.trim(),
  );
  const or = [{ salesRepId: salesRepId || "__none__" }];
  if (mine.length) or.push({ fromE164: { in: mine } });
  return {
    direction: "in",
    missedAt: { not: null },
    voicemailUrl: null,
    answeredAt: null,
    OR: or,
  };
}

/** What the rep's screen needs for one missed call. */
export function missedView(attempt = {}) {
  return {
    id: attempt.id,
    fromE164: attempt.toE164 || null,
    ourE164: attempt.fromE164 || null,
    at: attempt.dialledAt || null,
    missedAt: attempt.missedAt || null,
    providerStatus: attempt.providerStatus || null,
    prospectId: attempt.prospectId || null,
    leadId: attempt.leadId || null,
    businessName: attempt.prospect?.businessName || attempt.lead?.businessName || null,
    href: attempt.leadId
      ? `/sales/leads/${attempt.leadId}`
      : attempt.prospectId
        ? `/sales/queue?prospectId=${encodeURIComponent(attempt.prospectId)}`
        : null,
    logged: Boolean(attempt.disposition),
  };
}

/**
 * Who to tell. The rep the call is filed to, and the owner of the number it
 * rang — usually the same person, sometimes two, never nobody when either is
 * known. Order-preserving and de-duplicated so the payload builder runs once
 * per recipient.
 */
export function recipientsFor({ salesRepId = null, assignedRepId = null } = {}) {
  return [...new Set([salesRepId, assignedRepId].filter((id) => typeof id === "string" && id))];
}

/** "just now" / "N min ago" — timezone-free, because reps carry no zone. */
export function agoMinutes(at, now = new Date()) {
  const t = at ? new Date(at) : null;
  if (!t || Number.isNaN(t.getTime())) return null;
  return Math.max(0, Math.round((now.getTime() - t.getTime()) / 60000));
}

function pretty(e164) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s;
}

/**
 * Mark one inbound attempt missed, if it is not answered and carries no
 * message. Returns whether THIS call did the marking, which is what decides
 * whether a push goes out.
 *
 * @param attemptId        the row, or
 * @param providerCallSid  Twilio's CallSid for it (the status callback has
 *                         only this)
 * @param providerStatus   what Twilio said, or null from the sweep, which
 *                         heard nothing from Twilio and must not invent it
 */
export async function markMissed({
  attemptId = null,
  providerCallSid = null,
  providerStatus = null,
  now = new Date(),
  client = db,
} = {}) {
  if (!callStoreState(client).ready) return { ok: false, marked: false, reason: "store_unavailable", attempt: null };
  if (!attemptId && !providerCallSid) return { ok: false, marked: false, reason: "no_key", attempt: null };

  const attempt = await client.salesCallAttempt.findFirst({
    where: attemptId ? { id: attemptId, direction: "in" } : { providerCallSid, direction: "in" },
    select: {
      id: true,
      salesRepId: true,
      toE164: true,
      fromE164: true,
      dialledAt: true,
      answeredAt: true,
      endedAt: true,
      voicemailUrl: true,
      missedAt: true,
      prospectId: true,
      leadId: true,
      prospect: { select: { businessName: true } },
      lead: { select: { businessName: true } },
    },
  });
  if (!attempt) return { ok: false, marked: false, reason: "no_attempt", attempt: null };

  const outcome = inboundOutcome({ ...attempt, direction: "in" });
  if (outcome === "answered" || outcome === "voicemail") {
    // Close the row's carrier columns if the callback brought them, and stop.
    // Not a miss, whatever Twilio's final status says about the leg.
    const data = {};
    if (isEndedStatus(providerStatus) && !attempt.endedAt) {
      data.providerStatus = providerStatus;
      data.endedAt = now;
    }
    if (Object.keys(data).length) {
      await client.salesCallAttempt.updateMany({ where: { id: attempt.id }, data });
    }
    return { ok: true, marked: false, reason: outcome, attempt };
  }

  const data = { missedAt: now };
  if (isEndedStatus(providerStatus)) {
    data.providerStatus = providerStatus;
    data.endedAt = now;
  }
  const res = await client.salesCallAttempt.updateMany({
    // The guard. See the header.
    where: { id: attempt.id, missedAt: null },
    data,
  });
  return { ok: true, marked: res.count === 1, reason: res.count === 1 ? "marked" : "already_marked", attempt };
}

/**
 * "Missed call from Benchmark Painting, just now" to the reps who own it.
 *
 * Fire-and-forget by the callers, exactly like pushRing() in the inbound
 * route: Twilio is waiting on the same request. Every failure inside
 * pushToReps is already written to /platform/errors by its guard.
 */
export function notifyMissed({ attempt, assignedRepId = null, now = new Date() } = {}) {
  const salesRepIds = recipientsFor({ salesRepId: attempt?.salesRepId, assignedRepId });
  if (!salesRepIds.length || !attempt) return Promise.resolve({ sent: 0, failed: 0, disabled: 0, reason: "no_recipients" });
  const who = attempt.prospect?.businessName || attempt.lead?.businessName || pretty(attempt.toE164);
  const mins = agoMinutes(attempt.dialledAt, now);
  return pushToReps({
    salesRepIds,
    payload: async (language) => ({
      title: await appSentence(language, "app.notify.missedCall.title"),
      body: await appSentence(language, "app.notify.missedCall.body", {
        who,
        ago:
          mins === null || mins < 1
            ? await appSentence(language, "app.notify.ago.justNow")
            : await appSentence(language, "app.notify.ago.minutes", { minutes: mins }),
      }),
      tag: `sales-missed:${attempt.id}`,
      url: "/sales/voicemail",
    }),
  });
}

/** "New voicemail from Benchmark Painting, 12 seconds" to the same people. */
export function notifyVoicemail({ attempt, assignedRepId = null, seconds = null } = {}) {
  const salesRepIds = recipientsFor({ salesRepId: attempt?.salesRepId, assignedRepId });
  if (!salesRepIds.length || !attempt) return Promise.resolve({ sent: 0, failed: 0, disabled: 0, reason: "no_recipients" });
  const who = attempt.prospect?.businessName || attempt.lead?.businessName || pretty(attempt.toE164);
  const secs = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : null;
  return pushToReps({
    salesRepIds,
    payload: async (language) => ({
      title: await appSentence(language, "app.notify.voicemail.title"),
      body:
        secs === null
          ? await appSentence(language, "app.notify.voicemail.bodyNoLength", { who })
          : await appSentence(language, "app.notify.voicemail.body", { who, seconds: secs }),
      tag: `sales-voicemail:${attempt.id}`,
      url: "/sales/voicemail",
    }),
  });
}

/** The owner of the number that was rung, for the recipients list. */
export async function assignedRepForNumber(e164, { client = db } = {}) {
  if (!e164) return null;
  const row = await client.platformSmsNumber
    .findFirst({ where: { e164, active: true }, select: { assignedRepId: true } })
    .catch(() => null);
  return row?.assignedRepId || null;
}

/**
 * The late net: every inbound row old enough that no TwiML of ours can still
 * be running for it, with no answer, no message and no verdict. Marks each
 * missed and tells the rep. Runs from the per-minute sales cron, so a number
 * whose status callback is not pointed at us yet still produces the record
 * and the push, a few minutes late instead of never.
 */
export async function sweepMissedInbound({ now = new Date(), client = db, log = () => {} } = {}) {
  if (!callStoreState(client).ready) return { considered: 0, marked: 0, notified: 0, skipped: "store_unavailable" };
  const before = new Date(now.getTime() - MISSED_SWEEP_AFTER_SECONDS * 1000);
  const rows = await client.salesCallAttempt.findMany({
    where: {
      direction: "in",
      missedAt: null,
      answeredAt: null,
      voicemailUrl: null,
      endedAt: null,
      dialledAt: { lt: before },
    },
    orderBy: { dialledAt: "asc" },
    take: SWEEP_LIMIT,
    select: { id: true, fromE164: true },
  });
  let marked = 0;
  let notified = 0;
  for (const row of rows) {
    try {
      const res = await markMissed({ attemptId: row.id, providerStatus: null, now, client });
      if (!res.marked) continue;
      marked++;
      const assignedRepId = await assignedRepForNumber(row.fromE164, { client });
      const push = await notifyMissed({ attempt: res.attempt, assignedRepId, now });
      if (push?.sent) notified++;
      log(`missed-call sweep: attempt ${row.id} marked missed (push: ${push?.reason || push?.sent})`);
    } catch (err) {
      await recordError({
        area: "sales_inbound",
        code: "missed_sweep_failed",
        message: `The missed-call sweep could not mark attempt ${row.id}: ${err?.message}`,
        detail: { attemptId: row.id },
      }).catch(() => {});
    }
  }
  return { considered: rows.length, marked, notified, before: before.toISOString() };
}
