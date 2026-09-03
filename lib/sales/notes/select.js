// lib/sales/notes/select.js
//
// The columns each surface may read. `select` lists, never omit-lists, for the
// reason lib/sales/scope.js gives about REP_COMPANY_SELECT: a column added to
// the model tomorrow is invisible here by default, where an omit-list would
// leak it on the day it lands.
//
// Two lists rather than one, and the difference between them is the point. A
// rep reading their own note gets the note. A superadmin reading somebody
// else's gets the note plus who wrote it — and NOT one field more, because the
// platform screen's job is to read what reps wrote, not to become a second
// place where a rep's employment details are shown.

/** The list rows on a rep's own index. No body — a listing is not a read. */
export const NOTE_LIST_SELECT = {
  id: true,
  title: true,
  // The first line is the list's fallback title (lib/sales/notes/body.js's
  // displayTitle), so SOME body has to travel. Prisma cannot slice a string in
  // a select, so the route truncates — see the comment at the call site.
  body: true,
  bodyFormat: true,
  leadId: true,
  threadId: true,
  prospectId: true,
  parentLabel: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
};

/** One note, opened. The same columns; the body arrives whole. */
export const NOTE_DETAIL_SELECT = {
  ...NOTE_LIST_SELECT,
  salesRepId: true,
};

/**
 * What the platform console reads. The note, plus its author's name and login.
 *
 * `workEmail` is deliberately absent: which mailbox a rep sends outreach from
 * is a fact about the outreach system and it already has a screen
 * (/platform/sales/reps). Repeating it here would be a second copy of a
 * setting, which is how the two drift.
 */
export const PLATFORM_NOTE_SELECT = {
  ...NOTE_DETAIL_SELECT,
  salesRep: { select: { id: true, name: true, email: true, active: true } },
};

/**
 * How much body a listing carries.
 *
 * Enough for displayTitle's 80 characters and a one-line preview, and not the
 * whole note. A rep with 400 notes would otherwise pull every word of every one
 * of them to render a list of titles — and on the platform screen that is
 * every word of every rep's notes, which is a lot of somebody else's personal
 * information travelling for no reason.
 */
export const LIST_BODY_PREVIEW = 200;

/** Truncate a listed row's body in place. Pure; the routes map over it. */
export function previewRow(note) {
  if (!note || typeof note.body !== "string") return note;
  if (note.body.length <= LIST_BODY_PREVIEW) return note;
  return { ...note, body: note.body.slice(0, LIST_BODY_PREVIEW), bodyTruncated: true };
}
