// lib/sales/calls/history.js
//
// A lead's calls, as a rep reads them: when, how it ended, how long, what was
// logged (and whether the line logged it), the callback booked, the words.
//
// ══ Why a pure shaper, and why the rep sees other reps' calls ═════════════
//
// The rows come from SalesCallAttempt by prospect or lead; the shape a screen
// prints is decided HERE, once, so the queue's strip, the lead page and the
// Texts header agree, and scripts/check-sales-call-panel.mjs can hand this
// function rows and read the payload back. Another rep's attempt on the same
// business is included, marked `mine: false` and without the note: the fact
// that it was rung last Tuesday is why the rep should not open with "first
// time reaching out"; what the other rep typed is that rep's, and the pool
// already keeps a claim per rep for that reason.
//
// ══ "Last time" ═══════════════════════════════════════════════════════════
//
// The owner's line above the script when a lead comes back into rotation:
// "Last time (Aug 15): Not now — 'call after the season'". lastTime() picks
// the newest WRITTEN-UP attempt and says it only when that attempt is from
// an earlier local day than now — a lead rung twice this morning does not
// need to be told about the first ring, a lead back after thirty days does.

import { endOfCall } from "./dispositions";

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const iso = (d) => (when(d) ? when(d).toISOString() : null);

/**
 * @param rows   SalesCallAttempt rows (any select that carries the fields below).
 * @param repId  the reader; decides `mine` and whether the note travels.
 * @returns [{ id, dialledAt, direction, dialChannel, mine, ended: {key, talkSeconds}|null,
 *            endReason, hungUpBy, talkSeconds, answered, disposition, dispositionAt,
 *            autoLogged, deferred, note, callbackAt }], newest first.
 */
export function callHistoryRows(rows, { repId = null } = {}) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const dialledAt = when(r.dialledAt);
      if (!dialledAt) return null;
      const mine = Boolean(repId) && r.salesRepId === repId;
      return {
        id: r.id,
        dialledAt: dialledAt.toISOString(),
        direction: r.direction === "in" ? "in" : "out",
        dialChannel: r.dialChannel || "handset",
        mine,
        ended: endOfCall(r),
        endReason: r.endReason || null,
        hungUpBy: r.hungUpBy || null,
        talkSeconds: typeof r.talkSeconds === "number" ? r.talkSeconds : null,
        answered: Boolean(when(r.answeredAt)),
        disposition: r.disposition || null,
        dispositionAt: iso(r.dispositionAt),
        autoLogged: r.dispositionAutoLogged === true,
        deferred: !r.disposition && Boolean(when(r.dispositionDeferredAt)),
        // The words are the rep's own. Another rep's stay with that rep.
        note: mine && typeof r.dispositionNote === "string" && r.dispositionNote.trim() ? r.dispositionNote.trim() : null,
        callbackAt: iso(r.callbackAt),
        // The sub-reason under the outcome, the rep's own (subDispositions.js).
        subDisposition: mine && typeof r.subDisposition === "string" && r.subDisposition ? r.subDisposition : null,
        subDispositionDetail: mine && typeof r.subDispositionDetail === "string" && r.subDispositionDetail.trim() ? r.subDispositionDetail.trim() : null,
        // The carrier said a machine picked up (amd.js). Shown as a chip
        // so an auto-logged "voicemail" is read as the line's verdict.
        amdMachine: typeof r.amdResult === "string" && r.amdResult.startsWith("machine_"),
        // The owner's verdict on this outcome — the rep's own calls only,
        // and only a REJECTED or OBSERVED one is worth a line on the row;
        // an approval is silence (dispositionAudit.js).
        audit:
          mine && r.dispositionAudit && r.dispositionAudit.verdict && r.dispositionAudit.verdict !== "approved"
            ? { verdict: r.dispositionAudit.verdict, note: r.dispositionAudit.notes || null, at: iso(r.dispositionAudit.updatedAt) }
            : null,
        // The rep's own bookmarks on the recording (recordingMarks.js).
        marks: mine && Array.isArray(r.recordingMarks) ? r.recordingMarks.map((m) => ({ atSeconds: m.atSeconds, note: m.note || "" })) : [],
        // What an inbound call ENDED in, on the card the rep is looking at.
        // Before 2026-09-17 a ring-back that went to voicemail rendered
        // here as "inbound · unlogged" and the message itself was playable
        // only on /sales/voicemail, twelve entries down the nav, and on the
        // superadmin floor board. lib/sales/calls/missed.js has the three
        // outcomes; voicemail.js serves the audio through FieldQuo.
        voicemail:
          r.direction === "in" && typeof r.voicemailUrl === "string" && r.voicemailUrl.trim()
            ? {
                seconds: typeof r.voicemailSeconds === "number" ? r.voicemailSeconds : null,
                href: `/api/sales/voicemail/${encodeURIComponent(r.id)}/audio`,
              }
            : null,
        missed: r.direction === "in" && Boolean(when(r.missedAt)) && !when(r.answeredAt) && !(typeof r.voicemailUrl === "string" && r.voicemailUrl.trim()),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.dialledAt < b.dialledAt ? 1 : a.dialledAt > b.dialledAt ? -1 : 0));
}

function localDate(d, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
}

/**
 * The newest written-up call from an EARLIER day, for the line above the
 * script. Null when there is none, or when the last write-up is today's.
 *
 * @param history  callHistoryRows()' answer.
 * @returns { dialledAt, disposition, autoLogged, note, callbackAt } | null
 */
export function lastTime(history, { now = new Date(), timeZone = null } = {}) {
  if (!Array.isArray(history)) return null;
  const at = when(now) || new Date();
  const today = localDate(at, timeZone);
  const last = history.find((h) => h && h.disposition);
  if (!last) return null;
  const d = when(last.dialledAt);
  if (!d) return null;
  if (localDate(d, timeZone) >= today) return null;
  return {
    dialledAt: last.dialledAt,
    disposition: last.disposition,
    autoLogged: last.autoLogged,
    note: last.note,
    callbackAt: last.callbackAt,
  };
}

/** The select a history read needs, so every caller reads the same columns. */
export const HISTORY_SELECT = Object.freeze({
  id: true,
  salesRepId: true,
  dialledAt: true,
  direction: true,
  dialChannel: true,
  providerStatus: true,
  answeredAt: true,
  endedAt: true,
  talkSeconds: true,
  hungUpBy: true,
  endReason: true,
  disposition: true,
  dispositionAt: true,
  dispositionAutoLogged: true,
  dispositionDeferredAt: true,
  dispositionNote: true,
  callbackAt: true,
  voicemailUrl: true,
  voicemailSeconds: true,
  missedAt: true,
  subDisposition: true,
  subDispositionDetail: true,
  amdResult: true,
  dispositionAudit: { select: { verdict: true, notes: true, updatedAt: true } },
  recordingMarks: { select: { atSeconds: true, note: true }, orderBy: { atSeconds: "asc" } },
});
