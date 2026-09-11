// lib/location/stamps.js
//
// Keep where the phone said it was when somebody tapped clock in, clock out,
// on my way or complete. One row per tap, beside the event it belongs to.
//
// ── What this is not ───────────────────────────────────────────────────────
//
// Not tracking. A browser can only read position while its tab is in the
// foreground — iOS suspends it the moment the screen locks — and this product
// does not pretend otherwise. Nothing here polls, nothing runs on a timer,
// and there is no `watchPosition` anywhere in app/ or lib/
// (scripts/check-location-stamps.mjs fails if one appears). The phone is
// asked once, at the tap, with the OS's own permission prompt in front of it;
// see lib/location/capture.js for the client half.
//
// ── A stamp never blocks the tap ───────────────────────────────────────────
//
// The clock-in and the status change are the product. The stamp is a note
// beside them. Every route that records one does so AFTER its own write has
// succeeded, inside a catch that logs and moves on — a refused permission, a
// phone with no fix, a malformed body or a database hiccup on this table all
// leave the event exactly as it would have been without the feature. The
// route's response shape does not change either way.
//
// ── The phone's clock is not trusted ───────────────────────────────────────
//
// `at` is the tap time as the client saw it, and a phone's clock can be wrong
// by hours (a dead battery, a manual setting, a deliberate lie). It is kept
// because it is the honest timestamp for "when the phone was here", but only
// inside a window around the server's own now; outside that the stamp is
// refused rather than stored with a time nobody can vouch for. Fifteen minutes
// covers a slow connection in a basement and a phone that has drifted; it does
// not cover somebody clocking in from home and submitting the tap from the
// site an hour later.

import { haversineM } from "@/lib/geo/distance";

/** How far the phone's `at` may sit from the server's now, either way. */
export const AT_TOLERANCE_MS = 15 * 60 * 1000;

/** The events a stamp may describe — JobVisit.status vocabulary plus the clock. */
export const STAMP_KINDS = new Set(["clock_in", "clock_out", "on_the_way", "completed", "cancelled"]);

/**
 * The pure half: is this a stamp we are willing to store?
 *
 * Takes the raw body a client sent and the server's `now` (injectable so the
 * check script can run every branch without waiting for a clock). Returns
 * `{ ok: true, value }` with the cleaned numbers, or `{ ok: false, reason }`.
 * Never throws — a malformed stamp is an ordinary refusal, and the caller has
 * already finished the write that mattered.
 */
export function validateStamp(raw, { now = new Date() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "not_an_object" };
  }
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, reason: "latitude_out_of_range" };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, reason: "longitude_out_of_range" };
  }

  // Accuracy is optional — a phone that did not say is stored as null, and
  // the verdict treats null as "no reason to distrust the point". A negative
  // or non-numeric accuracy is a malformed body, not a missing figure.
  let accuracyM = null;
  if (raw.accuracyM !== undefined && raw.accuracyM !== null) {
    const acc = Number(raw.accuracyM);
    if (!Number.isFinite(acc) || acc < 0) return { ok: false, reason: "accuracy_invalid" };
    // Capped rather than refused: a 40,000 m reading is a real thing a phone
    // says, and it produces an honest "unknown" verdict downstream.
    accuracyM = Math.round(Math.min(acc, 1_000_000));
  }

  const at = raw.at ? new Date(raw.at) : null;
  if (!at || Number.isNaN(at.getTime())) return { ok: false, reason: "at_invalid" };
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (Math.abs(at.getTime() - nowMs) > AT_TOLERANCE_MS) {
    return { ok: false, reason: "at_out_of_window" };
  }

  return {
    ok: true,
    value: {
      // Six decimals is what the column holds (Decimal(9,6)) and is ~11 cm —
      // more precision than any phone has; rounding here keeps the stored
      // number honest about that.
      latitude: Math.round(latitude * 1e6) / 1e6,
      longitude: Math.round(longitude * 1e6) / 1e6,
      accuracyM,
      at,
    },
  };
}

/**
 * Distance from a stamp to a job's geocoded site, or null when the job has no
 * coordinates. Split out so the check script can run it against fixtures.
 */
export function distanceToSite(stamp, job) {
  if (!job || job.latitude == null || job.longitude == null) return null;
  const m = haversineM(stamp, { latitude: Number(job.latitude), longitude: Number(job.longitude) });
  return m == null ? null : Math.round(m);
}

/**
 * Validate and write one stamp.
 *
 * @param {object} args
 * @param {object} args.db        Prisma client (or transaction client).
 * @param {string} args.companyId
 * @param {string} args.kind      One of STAMP_KINDS.
 * @param {object} args.stamp     The raw body the client sent.
 * @param {string} [args.workerId]
 * @param {string} [args.timeEntryId]
 * @param {string} [args.jobId]
 * @param {string} [args.visitId]
 * @param {Date}   [args.now]     Injectable for tests.
 * @returns {Promise<{ ok: boolean, reason?: string, stamp?: object }>}
 *   Never throws. A database error is caught and returned as a reason — the
 *   caller has already answered the tap and must not fail it now.
 */
export async function recordStamp({
  db,
  companyId,
  kind,
  stamp,
  workerId = null,
  timeEntryId = null,
  jobId = null,
  visitId = null,
  now = new Date(),
}) {
  if (!companyId) return { ok: false, reason: "no_company" };
  if (!STAMP_KINDS.has(kind)) return { ok: false, reason: "unknown_kind" };
  const checked = validateStamp(stamp, { now });
  if (!checked.ok) return checked;

  try {
    // The job's coordinates are read fresh here rather than trusted from the
    // caller, and the distance is computed ONCE and stored: a later edit to
    // the site address must not silently rewrite where somebody was last
    // Tuesday. Null when the job has no coordinates — never a guess.
    const job = jobId
      ? await db.job.findFirst({
          where: { id: jobId, companyId },
          select: { latitude: true, longitude: true },
        })
      : null;
    const distanceToSiteM = distanceToSite(checked.value, job);

    const row = await db.locationStamp.create({
      data: {
        companyId,
        kind,
        workerId,
        timeEntryId,
        jobId,
        visitId,
        latitude: checked.value.latitude,
        longitude: checked.value.longitude,
        accuracyM: checked.value.accuracyM,
        distanceToSiteM,
        at: checked.value.at,
      },
    });
    return { ok: true, stamp: row };
  } catch (err) {
    console.error(`[location/stamps] ${kind} stamp not recorded:`, err?.message);
    return { ok: false, reason: "write_failed" };
  }
}

/**
 * Record a stamp only if the request carried one, swallowing every failure.
 *
 * The one call every route makes, after its own write. `stamp` absent or
 * malformed is the ordinary case (permission refused, desktop browser, old
 * client) and produces no log line at all — only a stamp that was well-formed
 * and still failed to store is worth a line in the log.
 */
export async function recordStampIfPresent(args) {
  if (args?.stamp == null) return { ok: false, reason: "absent" };
  try {
    return await recordStamp(args);
  } catch (err) {
    // recordStamp is written not to throw; this is the belt to its braces.
    console.error("[location/stamps] unexpected:", err?.message);
    return { ok: false, reason: "unexpected" };
  }
}
