// lib/sales/calls/recordingMarks.js
//
// Bookmarks on a call recording.
//
// ══ The model, from OMniLeads ═════════════════════════════════════════════
//
// GrabacionMarca (ominicontacto_app/models.py ~2878–2890): a callid and a
// descripcion — ONE description per recording, get_or_create'd by
// views_grabacion.py MarcarGrabacionView (~85–100) and read back by
// GrabacionDescripcionView. A recording is either marked or not.
//
// What is added: WHERE. A mark here has `atSeconds` from the recording's
// own zero — the prospect leg's answer, which is when <Dial record> starts
// — so a superadmin's player can draw it as a tick on the scrubber and jump
// to it, and a call can carry several. And WHO: a rep pressing Mark during
// the call (the server stamps now − answeredAt; the browser's clock started
// at the press and counted the ringing) or a superadmin on playback typing
// the second.
//
// Marks are handed to the AI review as "moments the rep flagged"
// (lib/sales/calls/qa.js) so the model reads the rep's own view of the call.
//
// Pure helpers first; the store below.

import { db } from "@/lib/db";

export const MARK_AUTHOR_REP = "rep";
export const MARK_AUTHOR_PLATFORM = "platform";
export const MAX_MARK_NOTE = 200;
export const MAX_MARKS_PER_CALL = 40;

/**
 * Where "now" falls in the recording — pure. The recording starts at the
 * prospect leg's answer; before that there is no recording to mark.
 *
 * @returns {{ ok: true, atSeconds } | { ok: false, reason }}
 */
export function markSecondsFor({ answeredAt = null, now = new Date() } = {}) {
  const a = answeredAt instanceof Date ? answeredAt : answeredAt ? new Date(answeredAt) : null;
  if (!a || Number.isNaN(a.getTime())) return { ok: false, reason: "not_answered" };
  const s = Math.floor((now.getTime() - a.getTime()) / 1000);
  if (s < 0) return { ok: false, reason: "clock" };
  return { ok: true, atSeconds: s };
}

/** Validate a posted mark. `atSeconds` may be absent for a live mark — the caller stamps it. */
export function parseMark(body, { requireSeconds = false } = {}) {
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_MARK_NOTE) : "";
  let atSeconds = null;
  if (body?.atSeconds !== undefined && body?.atSeconds !== null && body?.atSeconds !== "") {
    const n = Number(body.atSeconds);
    if (!Number.isFinite(n) || n < 0 || n > 24 * 3600) return { ok: false, error: "The second has to be a number inside the call." };
    atSeconds = Math.floor(n);
  }
  if (requireSeconds && atSeconds === null) return { ok: false, error: "Say where in the recording — the second." };
  return { ok: true, note, atSeconds };
}

/** "[00:42] rep flagged: they asked about pricing" lines for the model. Pure. */
export function marksForPrompt(marks = []) {
  const rows = (Array.isArray(marks) ? marks : []).filter((m) => Number.isFinite(m?.atSeconds)).sort((a, b) => a.atSeconds - b.atSeconds);
  if (!rows.length) return "";
  const stamp = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return rows.map((m) => `[${stamp(m.atSeconds)}] ${m.authorKind === MARK_AUTHOR_REP ? "the rep flagged" : "a reviewer flagged"}: ${String(m.note || "").replace(/\s+/g, " ").trim() || "(no note)"}`).join("\n");
}

const MARK_SELECT = { id: true, attemptId: true, authorKind: true, authorId: true, authorName: true, atSeconds: true, note: true, createdAt: true };

function shape(m) {
  return { ...m, createdAt: m.createdAt?.toISOString?.() || null };
}

/** The marks on one call, earliest first. */
export async function listMarks({ attemptId, client = db } = {}) {
  if (!attemptId || typeof client?.salesRecordingMark?.findMany !== "function") return [];
  const rows = await client.salesRecordingMark.findMany({ where: { attemptId }, orderBy: [{ atSeconds: "asc" }, { createdAt: "asc" }], select: MARK_SELECT });
  return rows.map(shape);
}

/**
 * Add a mark. `where` is the ownership clause the caller has already
 * decided (a rep: `{ id, salesRepId }`; the platform: `{ id }`), so nobody
 * can mark a call that is not theirs to see. A live mark (no atSeconds)
 * is stamped from the row's answeredAt.
 */
export async function addMark({ where, author, body, now = new Date(), client = db } = {}) {
  const parsed = parseMark(body, { requireSeconds: false });
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (!author?.kind || !author?.id) return { ok: false, status: 403, error: "No author." };
  const attempt = await client.salesCallAttempt.findFirst({ where, select: { id: true, answeredAt: true, _count: { select: { recordingMarks: true } } } });
  if (!attempt) return { ok: false, status: 404, error: "That call is not yours to mark." };
  if ((attempt._count?.recordingMarks || 0) >= MAX_MARKS_PER_CALL) return { ok: false, status: 409, error: `At most ${MAX_MARKS_PER_CALL} marks on one call.` };
  let atSeconds = parsed.atSeconds;
  if (atSeconds === null) {
    const stamped = markSecondsFor({ answeredAt: attempt.answeredAt, now });
    if (!stamped.ok) {
      return { ok: false, status: 409, error: "The line has not reported the pickup yet — there is no recording to mark. Try again in a second.", reason: stamped.reason };
    }
    atSeconds = stamped.atSeconds;
  }
  const row = await client.salesRecordingMark.create({
    data: { attemptId: attempt.id, authorKind: author.kind, authorId: author.id, authorName: author.name || null, atSeconds, note: parsed.note },
    select: MARK_SELECT,
  });
  return { ok: true, mark: shape(row) };
}
