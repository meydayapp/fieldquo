// lib/team/separation.js
//
// Ending somebody's employment — the reasons, the validation, and the shape
// of the HR record it leaves behind. Pure and DB-free: the Workers page, Manage
// Team and the cancel-invitation dialog import the constants, the route
// (app/api/workers/[id]/separation) imports the parser, and
// scripts/check-worker-archive.mjs throws hostile input at both.
//
// ══ Why this exists ═════════════════════════════════════════════════════════
//
// The owner took a worker off the team and could not find how to take him off
// payroll. The only control was an "Active" checkbox inside the Edit form, and
// even that could only say THAT he was gone — not that he was dismissed, not
// what happened. "There should be fire / dismissed, and a proper explanation
// from HR." So ending employment is a recorded act: what kind of separation,
// the last day worked, an explanation in the manager's words, and whether
// they'd be taken back. The flag alone stays available (the Edit form's
// checkbox still works exactly as before), but the visible action records why.
//
// ══ What this deliberately does not model ═══════════════════════════════════
//
// Final pay, notice periods, and any government separation form (a Record of
// Employment, a P45, a US state's separation notice). Those differ by country
// and province, carry legal weight, and a screen that half-models one invites
// somebody to believe it was filed. This records what happened for the
// company's own HR file, and says nothing about anything filed elsewhere.

/**
 * The kinds of separation, in the order the dialog offers them. The codes are
 * stored in Worker.separationType; the labels are app.separation.type.<code>
 * in every language. One list — the dialog, the parser, the HR summary and
 * the note all read this, so a new kind is added in exactly one place.
 */
export const SEPARATION_TYPES = Object.freeze([
  "quit",
  "dismissed",
  "laid_off",
  "end_of_contract",
  "retired",
  "other",
]);
const TYPE_SET = new Set(SEPARATION_TYPES);

/** The catalogue key for a separation type's label. */
export function separationTypeKey(type) {
  return `app.separation.type.${TYPE_SET.has(type) ? type : "other"}`;
}

/** Short enough to be one sentence of fact, long enough to be one. "Fired" is
 *  not an HR explanation; "Fired — see above" is still not one, but at least
 *  the bar is visible in the form rather than a surprise on save. */
export const EXPLANATION_MIN = 10;
/** Same ceiling as an HR note body (lib/hr/notes.js), since that is where the
 *  explanation is stored. */
export const EXPLANATION_MAX = 5000;
/** A last day may be a little ahead — somebody who has handed in notice — but
 *  not open-ended: they come off payroll NOW, and a last day half a year out
 *  is almost certainly a typo in the year. */
export const LAST_DAY_MAX_AHEAD_DAYS = 60;

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-09-29" → a UTC-midnight Date, or null. Calendar days only, stored
 *  the way Worker.hiredOn is, so the two compare as days. */
export function parseCalendarDay(value) {
  if (typeof value !== "string") return null;
  const m = ISO_DAY.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // Date.UTC rolls 2026-02-31 into March; a roll means the input wasn't a day.
  if (
    d.getUTCFullYear() !== Number(m[1]) ||
    d.getUTCMonth() !== Number(m[2]) - 1 ||
    d.getUTCDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

/** A Date → "YYYY-MM-DD" in UTC, the inverse of parseCalendarDay. */
export function calendarDayOf(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Validate what the End-employment dialog sent.
 *
 * Returns { data } or { error, field }. The error is an English sentence (the
 * route's convention); `field` is the catalogue suffix the dialog shows in the
 * reader's language — app.separation.err.<field>.
 *
 * `now` is the server's clock. "Today" is compared a day loosely in both
 * directions, because the browser picked its default in the company's local
 * day and the server counts in UTC.
 *
 * @param body     { type, lastDay, explanation, rehireEligible }
 * @param options  { now, hiredOn } — hiredOn is the worker's start date, if any
 */
export function parseSeparation(body, { now = new Date(), hiredOn = null } = {}) {
  const type = typeof body?.type === "string" ? body.type : "";
  // No default. A dialog that pre-picked "Quit" would record a dismissal as a
  // resignation for everybody who didn't look — the one field on this record
  // with legal weight is the one that must never be assumed.
  if (!TYPE_SET.has(type)) {
    return { error: "Choose what happened.", field: "type" };
  }

  const lastDay = parseCalendarDay(body?.lastDay);
  if (!lastDay) {
    return { error: "Enter their last day worked.", field: "lastDay" };
  }
  if (lastDay.getUTCFullYear() < 1950) {
    return { error: "Enter their last day worked.", field: "lastDay" };
  }
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (lastDay.getTime() > todayUtc + (LAST_DAY_MAX_AHEAD_DAYS + 1) * DAY_MS) {
    return {
      error: `The last day can't be more than ${LAST_DAY_MAX_AHEAD_DAYS} days from today.`,
      field: "lastDayFuture",
    };
  }
  if (hiredOn) {
    const hired = new Date(hiredOn);
    if (!Number.isNaN(hired.getTime())) {
      const hiredDay = Date.UTC(hired.getUTCFullYear(), hired.getUTCMonth(), hired.getUTCDate());
      if (lastDay.getTime() < hiredDay) {
        return {
          error: "The last day can't be before their start date.",
          field: "lastDayBeforeHire",
        };
      }
    }
  }

  const explanation =
    typeof body?.explanation === "string" ? body.explanation.trim() : "";
  if (explanation.length < EXPLANATION_MIN) {
    return {
      error: `Write at least ${EXPLANATION_MIN} characters about what happened.`,
      field: "explanation",
    };
  }
  if (explanation.length > EXPLANATION_MAX) {
    return {
      error: `Keep the explanation under ${EXPLANATION_MAX} characters.`,
      field: "explanationLong",
    };
  }

  // Three states, and the third is not "no". Unanswered is recorded as null
  // — a rehire question nobody answered must not read as a refusal later.
  const r = body?.rehireEligible;
  const rehireEligible = r === true ? true : r === false ? false : null;

  return { data: { type, lastDay, explanation, rehireEligible } };
}

/**
 * Is this worker's employment currently ended with a recorded separation?
 * A re-activated worker keeps separatedOn as history, so both halves matter.
 */
export function isSeparated(worker) {
  return !!worker && worker.active === false && !!worker.separatedOn;
}

/**
 * The HR note's body: one header line of facts, a blank line, then the
 * manager's explanation verbatim. The header is composed by the route in the
 * company's language; this only fixes the shape so splitSeparationNote can
 * take it apart again for the HR file's summary card.
 */
export function separationNoteBody(header, explanation) {
  return `${String(header).trim()}\n\n${String(explanation).trim()}`;
}

/** { header, explanation } from a note written by separationNoteBody. A body
 *  with no blank line (never written by this code) is all explanation. */
export function splitSeparationNote(body) {
  const text = typeof body === "string" ? body : "";
  const at = text.indexOf("\n\n");
  if (at === -1) return { header: "", explanation: text.trim() };
  return { header: text.slice(0, at).trim(), explanation: text.slice(at + 2).trim() };
}

/** The Worker columns only HR managers may read. */
export const SEPARATION_FIELDS = Object.freeze([
  "separatedOn",
  "separationType",
  "separationRehireEligible",
  "separatedById",
]);

/**
 * Strip the separation facts from a worker row for a caller who cannot open
 * HR files. GET /api/workers serves the whole roster to anyone signed in —
 * the scheduler needs it — and "dismissed, not eligible for rehire" is not
 * roster information. Stripped rather than nulled, so a screen can't mistake
 * "hidden" for "never separated".
 */
export function redactSeparation(row, canSeeHr) {
  if (canSeeHr || !row || typeof row !== "object") return row;
  const out = { ...row };
  for (const f of SEPARATION_FIELDS) delete out[f];
  return out;
}
