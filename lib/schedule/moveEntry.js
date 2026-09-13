// lib/schedule/moveEntry.js
//
// The office moving a visit or an appointment: what is decided, minus the doing.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The calendar could reassign a visit and nothing else. Moving one, calling it
// off, marking it done — the three things an office does to a booked slot all
// day — had no control anywhere on the office side. The crew had "Mark
// complete" on the job page; the client had "Change or cancel" on their own
// link; the person answering the phone had neither.
//
// ── The same rules the client's link already applies ───────────────────────
//
// A homeowner moving their own visit gets a slot only if the estimator can
// physically reach it from the job before and get to the one after
// (lib/booking/computeAvailability.js, through `reachable` in
// lib/booking/travel.js, padded by the company's travel buffer). The office is
// held to the same arithmetic — the same function, not a paraphrase — with one
// difference: the office may overrule it. A dispatcher who knows the crew is
// already parked next door is right and the straight-line estimate is wrong,
// so a short gap is a 409 the dialog explains and a `force` re-post accepts,
// never a silent refusal and never a silent acceptance.
//
// The arrival window is the client's side of the same promise: the letter
// telling them the new time says "between 1:45 and 2:15" when the company set
// a window, exactly as the confirmation did. That lives in the letter builder
// (app/admin/lib/email/templates.js), which this route reuses rather than
// re-describes.
//
// Pure. `neighbouringStops` in ./entryNeighbours.js loads the day; this only
// decides, so scripts/check-visit-manage.mjs runs the real verdict against a
// crafted day without Postgres.

import { reachable } from "@/lib/booking/travel";

/**
 * How long an appointment or a visit is assumed to take when the row does not
 * say. The same hour computeAvailableSlots blocks for an Appointment — one
 * constant, exported from here and imported there, so the two cannot drift.
 */
export const DEFAULT_STOP_MINUTES = 60;

/**
 * @param {object} args
 * @param {*}       args.scheduledAt   what the office posted — anything
 * @param {Date}    args.now
 * @param {boolean} args.force         the office has read the warning and
 *                                     still wants this time
 * @param {object|null} args.previous  { endAt } — the stop before the new time
 * @param {object|null} args.next      { startAt } — the stop after it
 * @param {number|null} args.travelFromPrevious  minutes, or null when unknown
 * @param {number|null} args.travelToNext        minutes, or null when unknown
 * @param {number}  args.travelBuffer  company padding, minutes
 * @param {number}  args.durationMinutes how long THIS stop runs
 * @returns {{ ok, httpStatus, reason, start: Date|null, end: Date|null,
 *             travel: { known: boolean, shortBy: number, against: "previous"|"next"|null } }}
 */
export function planOfficeMove({
  scheduledAt,
  now = new Date(),
  force = false,
  previous = null,
  next = null,
  travelFromPrevious = null,
  travelToNext = null,
  travelBuffer = 0,
  durationMinutes = DEFAULT_STOP_MINUTES,
}) {
  const none = { known: false, shortBy: 0, against: null };
  const deny = (httpStatus, reason, travel = none) => ({
    ok: false,
    httpStatus,
    reason,
    start: null,
    end: null,
    travel,
  });

  // new Date(null) is the epoch and new Date(undefined) is Invalid Date; both
  // arrive from a browser as easily as a real timestamp.
  if (scheduledAt == null || scheduledAt === "") return deny(400, "no_time");
  const start = new Date(scheduledAt);
  if (!Number.isFinite(start.getTime())) return deny(400, "bad_time");

  const minutes =
    Number.isFinite(Number(durationMinutes)) && Number(durationMinutes) > 0
      ? Number(durationMinutes)
      : DEFAULT_STOP_MINUTES;
  const end = new Date(start.getTime() + minutes * 60000);

  // ── The past is a warning, not a wall ────────────────────────────────────
  //
  // The client's link refuses a past time outright, because a stranger has no
  // business backdating anything. The office does: "the visit actually happened
  // yesterday at three" is a correction, not a mistake, and refusing it means
  // the record stays wrong. So it is refused once, with the reason, and
  // accepted on `force`.
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (start.getTime() < nowMs && !force) return deny(409, "in_the_past");

  // ── Can the crew get there, and get away again ───────────────────────────
  //
  // Both legs go through `reachable` — the one function the booking page
  // trusts — so an office move is held to the same buffer the client's link
  // is. Unknown travel (no coordinates on one end) never blocks, per that
  // function's own rule: a silently missing slot is worse than a phone call.
  const buffer = Math.max(0, Number(travelBuffer) || 0);

  if (previous?.endAt) {
    const before = reachable({
      previousEnd: previous.endAt,
      slotStart: start,
      travel: travelFromPrevious,
      buffer,
    });
    if (before.known && !before.ok && !force) {
      return deny(409, "travel_short", { known: true, shortBy: before.shortBy, against: "previous" });
    }
  }

  if (next?.startAt) {
    const after = reachable({
      previousEnd: end,
      slotStart: next.startAt,
      travel: travelToNext,
      buffer,
    });
    if (after.known && !after.ok && !force) {
      return deny(409, "travel_short", { known: true, shortBy: after.shortBy, against: "next" });
    }
  }

  return { ok: true, httpStatus: 200, reason: "ok", start, end, travel: none };
}

/**
 * The stops either side of a candidate time, from a day already loaded.
 *
 * `stops` is every OTHER stop the assignee has that day, in any order:
 * [{ startAt, endAt, point }]. The previous stop is the latest one starting
 * before the candidate; the next is the earliest starting at or after it. A
 * stop that overlaps the candidate counts as previous — it ends after the new
 * start, so `reachable` reports the whole overlap as minutes short, which is
 * the honest number.
 */
export function bracketStops(stops = [], start) {
  const at = new Date(start).getTime();
  let previous = null;
  let next = null;
  for (const s of Array.isArray(stops) ? stops : []) {
    // new Date(null) is the epoch, not "no time" — a stop with no start would
    // otherwise bracket every candidate as its previous.
    if (s?.startAt == null || s.startAt === "") continue;
    const sAt = new Date(s.startAt).getTime();
    if (!Number.isFinite(sAt)) continue;
    if (sAt < at) {
      if (!previous || sAt > new Date(previous.startAt).getTime()) previous = s;
    } else if (!next || sAt < new Date(next.startAt).getTime()) {
      next = s;
    }
  }
  return { previous, next };
}

/**
 * Plain-English fallback for a reason key, for the JSON `error` string. The
 * dialog renders from the KEY in the caller's language; this is for logs and
 * for the shared fetch helpers.
 */
export function moveReasonMessage(reason, travel) {
  switch (reason) {
    case "no_time":
    case "bad_time":
      return "That isn't a time we can read.";
    case "in_the_past":
      return "That time has already passed. Move it anyway if you're correcting the record.";
    case "travel_short":
      return `That leaves ${travel?.shortBy ?? "some"} minutes too little to get ${
        travel?.against === "next" ? "to the next stop" : "there from the stop before"
      }. Move it anyway if you know better.`;
    default:
      return "That change can't be made.";
  }
}

/** Every reason planOfficeMove can return, for the dialog's key table. */
export const MOVE_REASONS = Object.freeze(["no_time", "bad_time", "in_the_past", "travel_short"]);
