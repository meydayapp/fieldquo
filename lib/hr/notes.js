// lib/hr/notes.js
//
// The performance file: what a manager wrote down about a person, and
// whether the person has seen it.
//
// ══ Four kinds, two of which can demand a signature ════════════════════════
//
//   note         — private to managers unless `visibleToWorker` is set
//   recognition  — the good ones; visible to the worker by default
//   warning      — visible by default; may require acknowledgement
//   write_up     — the formal one; visible AND requires acknowledgement by
//                  default. A write-up the person never saw is not a
//                  write-up, it is a diary.
//
// Requiring acknowledgement is only possible on a visible note — the parse
// refuses the other combination rather than storing a row that asks for a
// signature on text the person cannot read.
//
// ══ Never deleted, never edited ════════════════════════════════════════════
//
// No PATCH of a body and no DELETE. A note that can be reworded after the
// person signed it is worthless as a record, in either direction. A mistake
// is corrected by a new note that says so.
export const NOTE_KINDS = Object.freeze(["note", "recognition", "warning", "write_up"]);
const KIND_SET = new Set(NOTE_KINDS);
const BODY_MAX = 5000;

/** The defaults each kind starts from on the screen. */
export const NOTE_KIND_DEFAULTS = Object.freeze({
  note: { visibleToWorker: false, requiresAcknowledgement: false },
  recognition: { visibleToWorker: true, requiresAcknowledgement: false },
  warning: { visibleToWorker: true, requiresAcknowledgement: true },
  write_up: { visibleToWorker: true, requiresAcknowledgement: true },
});

export function parseNoteBody(body, { now = new Date() } = {}) {
  const kind = typeof body?.kind === "string" ? body.kind : "note";
  if (!KIND_SET.has(kind)) return { error: `"${String(body?.kind).slice(0, 30)}" isn't a note kind.` };
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, BODY_MAX) : "";
  if (!text) return { error: "Write something first." };
  const defaults = NOTE_KIND_DEFAULTS[kind];
  const visibleToWorker = body?.visibleToWorker === undefined ? defaults.visibleToWorker : body.visibleToWorker === true;
  const requiresAcknowledgement =
    body?.requiresAcknowledgement === undefined ? defaults.requiresAcknowledgement : body.requiresAcknowledgement === true;
  if (requiresAcknowledgement && !visibleToWorker) {
    return { error: "A note can only require an acknowledgement if the person can see it." };
  }
  let occurredAt = now;
  if (body?.occurredAt !== undefined && body.occurredAt !== null && body.occurredAt !== "") {
    const d = new Date(body.occurredAt);
    if (Number.isNaN(d.getTime())) return { error: "The date isn't a date." };
    if (d.getTime() > now.getTime() + 86400000) return { error: "A note can't be dated in the future." };
    occurredAt = d;
  }
  return { data: { kind, body: text, visibleToWorker, requiresAcknowledgement, occurredAt } };
}

/** What the WORKER may see of their own file: visible rows only, and never
 *  the author's member id. */
export function visibleToWorker(notes) {
  return (notes || []).filter((n) => n.visibleToWorker);
}

/** Notes still waiting for the person's signature. */
export function pendingNotes(notes) {
  return (notes || []).filter((n) => n.visibleToWorker && n.requiresAcknowledgement && !n.acknowledgedAt);
}

export const NOTE_SELECT = Object.freeze({
  id: true,
  workerId: true,
  kind: true,
  body: true,
  occurredAt: true,
  visibleToWorker: true,
  requiresAcknowledgement: true,
  acknowledgedAt: true,
  acknowledgedName: true,
  authorName: true,
  createdAt: true,
});

/** The worker-facing shape — no author member id, no visibility flag (every
 *  row they receive is visible by construction). */
export function serialiseForWorker(note) {
  return {
    id: note.id,
    kind: note.kind,
    body: note.body,
    occurredAt: note.occurredAt,
    requiresAcknowledgement: note.requiresAcknowledgement,
    acknowledgedAt: note.acknowledgedAt,
    authorName: note.authorName || null,
    createdAt: note.createdAt,
  };
}

// pendingNoteCount(workerId) lives in lib/hr/pending.js — see the note at
// the foot of lib/hr/policies.js for why no db import belongs here.
