// lib/team/personLabel.js
//
// A person's JOB TITLE — Receptionist, Foreman, Lead installer — as distinct
// from their SEAT (Owner / Administrator / Manager / Worker, the permission
// tier in lib/permissions/roleManagement.js).
//
// ── Why one helper ──────────────────────────────────────────────────────────
//
// The seat label kept appearing beside names on rosters, pickers and the
// schedule because it was the only word anybody had. The owner's ask: "add a
// title that is more honorific, like receptionist or clerk … so some are only
// used for the seat and not for the crew, so there is no confusion." So the
// rule is now: where the seat is the SUBJECT (the access editor, the invite
// form, seat counts, billing) the seat word stays; where a person is merely
// LISTED, their title shows and the seat word is at most a hint.
//
// Everything that prints a title goes through here so nobody re-invents the
// fallback. There is no fallback: absence of a title is absence. A row with
// no title shows nothing — never "Staff", never the seat word smuggled back in
// under another name. Padding absent data with defaults is failure class 5 in
// AGENTS.md, and "Staff" on a receptionist's row is exactly the confusion this
// field exists to remove.
//
// Pure and dependency-free on purpose: imported by client components, API
// routes and check scripts alike.

/** Longest a title can be. Sixty holds "Senior residential project manager". */
export const TITLE_MAX = 60;

/**
 * Catalogue keys for the suggestions the title input offers. Suggestions
 * ONLY — they feed a <datalist>, never a validator. The owner's examples
 * (receptionist, clerk, supervisor, estimator) are all here; a company that
 * calls its people something else types it and it is saved as typed.
 */
export const TITLE_SUGGESTION_KEYS = [
  "app.jobTitle.suggest.receptionist",
  "app.jobTitle.suggest.clerk",
  "app.jobTitle.suggest.officeManager",
  "app.jobTitle.suggest.dispatcher",
  "app.jobTitle.suggest.foreman",
  "app.jobTitle.suggest.leadInstaller",
  "app.jobTitle.suggest.installer",
  "app.jobTitle.suggest.apprentice",
  "app.jobTitle.suggest.estimator",
  "app.jobTitle.suggest.supervisor",
];

/**
 * The title to print for a person, or null when they have none.
 *
 * Accepts anything that carries a `title` — a Worker row, a member row the
 * API has decorated with the worker's title, a chat directory entry — so the
 * caller never has to know which table the word came from.
 */
export function personTitle(person) {
  const raw = person?.title;
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  return t ? t : null;
}

/**
 * "Jane Doe — Receptionist" for an <option> or any single-line label; just
 * the name when there is no title. Name first, so a sorted list stays sorted
 * by the thing people scan for.
 */
export function personOptionLabel(person, name) {
  const n = name ?? person?.name ?? "";
  const title = personTitle(person);
  return title ? `${n} — ${title}` : n;
}

/**
 * Clean a title off a request body, server-side.
 *
 * @returns {{ ok: true, value: string|null } | { ok: false, error: string }}
 *   `value` is null for "", null or whitespace — clearing a title is a real
 *   edit and lands as NULL, never as an empty string that then prints as a
 *   blank line under somebody's name. Inner whitespace is collapsed so
 *   "Lead   installer" and "Lead installer" are one title, not two.
 */
export function normaliseTitle(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "A job title has to be text." };
  }
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: true, value: null };
  if (value.length > TITLE_MAX) {
    return {
      ok: false,
      error: `A job title can be at most ${TITLE_MAX} characters.`,
    };
  }
  return { ok: true, value };
}
