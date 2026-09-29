// lib/platform/errorLog.js
//
// One way to record a real failure so support can see it later.
//
// Contract: recordError NEVER throws and never blocks. It is called from inside
// catch blocks — a logger that can fail there would turn a handled problem into
// an unhandled one. Every failure inside it is swallowed after a console.error.
//
// Keep it to genuine failures. If this becomes a debug log it stops being worth
// opening, and "no errors" stops meaning anything.

import { db } from "@/lib/db";
import { currentEnvironment } from "@/lib/platform/errorKinds";

/**
 * @param {object} p
 * @param {string} p.area     email | sms | ai | stripe | webhook | pdf | upload | cron | api
 * @param {string} p.message  human-readable; what failed
 * @param {string} [p.code]   groupable short code
 * @param {string} [p.companyId]
 * @param {object} [p.detail] ids, status codes, trimmed stack
 */
export async function recordError({ area, message, code, companyId, detail } = {}) {
  try {
    if (!area || !message) return;
    await db.platformErrorLog.create({
      data: {
        area: String(area).slice(0, 40),
        code: code ? String(code).slice(0, 60) : null,
        message: String(message).slice(0, 1000),
        companyId: companyId || null,
        detail: withEnvironment(detail),
      },
    });
  } catch (err) {
    // Deliberately terminal. If the error log itself is broken, the last thing
    // to do is throw from a catch block.
    console.error("[errorLog] could not record:", err?.message);
  }
}

/**
 * `detail` with `env` stamped on it — where this write happened
 * (lib/platform/errorKinds.js currentEnvironment). The owner's Mac writes to
 * the production database, and a local run's failure read as fieldquo.com's.
 * An object gains the key (a caller's own `env` is kept: it said so); no
 * detail becomes `{ env }`; anything else (an array, a string) is wrapped
 * rather than altered, so nothing a caller stored changes shape.
 */
export function withEnvironment(detail, env = currentEnvironment()) {
  if (detail === undefined || detail === null) return { env };
  if (typeof detail === "object" && !Array.isArray(detail)) return { env, ...detail };
  return { env, value: detail };
}

/** Trim a thrown value into something worth storing. */
export function errorDetail(err, extra = {}) {
  return {
    ...extra,
    ...(err?.name ? { name: err.name } : {}),
    ...(err?.status || err?.http_code ? { status: err.status || err.http_code } : {}),
    // First few frames only — enough to locate it, not a wall of node_modules.
    ...(err?.stack ? { stack: String(err.stack).split("\n").slice(0, 4).join("\n") } : {}),
  };
}

// ── Reviewed ────────────────────────────────────────────────────────────────
//
// The one write on /platform/errors: "somebody looked at this, and here is why
// it is fine". Both directions — a wrong review is unmarked, not deleted; the
// row is never deleted (see the model comment on resolvedAt). Reads as
// "reviewed" on the screen and in the audit log; the columns keep their older
// name because renaming a column through `prisma db push` drops and recreates
// it, and the rows in it are the record.

/** Most rows one PATCH may touch. A larger sweep is two PATCHes on purpose. */
export const REVIEW_BULK_MAX = 200;
/** One line. Long enough to say "key rotated, see #123"; not a post-mortem. */
export const REVIEW_NOTE_MAX = 300;

/**
 * Mark (or unmark) error rows reviewed and write ONE audit row for the batch,
 * in the same transaction — a stamp with no audit row, or the reverse, is the
 * split this codebase keeps finding.
 *
 * `note` is stored on every row in the batch (a bulk review of twelve
 * `resend_rejected` rows has one reason) and cleared on unmark: a note that
 * outlives the review it explains reads as if the review still stood.
 *
 * Permission is the caller's job. `deps.db` exists so scripts/check-platform-
 * errors.mjs can execute this against a fake client.
 */
export async function reviewErrors({ ids, reviewed = true, note = null, adminId }, deps = {}) {
  const database = deps.db || db;
  const now = deps.now || new Date();
  const list = Array.isArray(ids)
    ? [...new Set(ids.filter((i) => typeof i === "string" && i.length > 0))]
    : [];
  if (!adminId) return { ok: false, status: 400, error: "adminId is required" };
  if (!list.length) return { ok: false, status: 400, error: "No error ids given" };
  if (list.length > REVIEW_BULK_MAX) {
    return {
      ok: false,
      status: 400,
      error: `At most ${REVIEW_BULK_MAX} errors per request (got ${list.length}).`,
    };
  }
  const text = reviewed && typeof note === "string" ? note.trim().slice(0, REVIEW_NOTE_MAX) : "";

  return database.$transaction(async (tx) => {
    const result = await tx.platformErrorLog.updateMany({
      where: { id: { in: list } },
      data: reviewed
        ? { resolvedAt: now, resolvedBy: adminId, resolvedNote: text || null }
        : { resolvedAt: null, resolvedBy: null, resolvedNote: null },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: adminId,
        action: reviewed ? "error_reviewed" : "error_unreviewed",
        details: { errorIds: list, count: result.count, note: text || null },
      },
    });
    return { ok: true, status: 200, count: result.count, reviewed };
  });
}

// ── "Mark all like this reviewed" ───────────────────────────────────────────
//
// 2026-09-29: one stuck sales-dial attempt logged the same
// leg_time_match_failed entry every minute for five days — 7,360 rows, each
// with its own "Mark reviewed", and the 200-id batch cap above meant 37
// rounds of select-all. The set here is described, not listed: same area,
// same code, optionally the same detail.attemptId, unreviewed, and created
// no later than `before` — the newest matching row when the count was shown
// to the person confirming. Anything that arrives after they read the count
// is not swept up in a decision they did not see; it lands in the queue.
//
// A code is required. Rows with no code are the uncategorised ones, and
// "everything in this area with no code" is not "like this" — it is the
// area. The stamp and the audit row are the single action's, in one
// transaction; the audit row names the filter and the count, not 7,000 ids.

/** The WHERE for "like this", or null when the request cannot name a set. */
export function errorsLikeWhere({ area, code, attemptId, before } = {}) {
  const a = typeof area === "string" ? area.trim() : "";
  const c = typeof code === "string" ? code.trim() : "";
  if (!a || !c) return null;
  const at = typeof attemptId === "string" ? attemptId.trim() : "";
  const cut = before ? new Date(before) : null;
  if (before && (!cut || Number.isNaN(cut.getTime()))) return null;
  return {
    area: a,
    code: c,
    resolvedAt: null,
    ...(cut ? { createdAt: { lte: cut } } : {}),
    ...(at ? { detail: { path: ["attemptId"], equals: at } } : {}),
  };
}

/** How many unreviewed rows are like this one, and the newest one's time — what the confirm shows. */
export async function countErrorsLike({ area, code, attemptId } = {}, deps = {}) {
  const database = deps.db || db;
  const where = errorsLikeWhere({ area, code, attemptId });
  if (!where) return { ok: false, status: 400, error: "An area and a code are required." };
  const agg = await database.platformErrorLog.aggregate({ where, _count: { _all: true }, _max: { createdAt: true }, _min: { createdAt: true } });
  return { ok: true, count: agg._count._all, newestAt: agg._max.createdAt, oldestAt: agg._min.createdAt };
}

/**
 * Mark every unreviewed row like this one reviewed. `before` is required —
 * the newest createdAt the person was shown — so the sweep is exactly what
 * they confirmed, or fewer (somebody reviewed some meanwhile), never more.
 */
export async function reviewErrorsLike({ area, code, attemptId = null, before, note = null, adminId }, deps = {}) {
  const database = deps.db || db;
  const now = deps.now || new Date();
  if (!adminId) return { ok: false, status: 400, error: "adminId is required" };
  if (!before) return { ok: false, status: 400, error: "Load the count first: `before` is required." };
  const where = errorsLikeWhere({ area, code, attemptId, before });
  if (!where) return { ok: false, status: 400, error: "An area, a code and a valid `before` are required." };
  const text = typeof note === "string" ? note.trim().slice(0, REVIEW_NOTE_MAX) : "";

  return database.$transaction(async (tx) => {
    const result = await tx.platformErrorLog.updateMany({
      where,
      data: { resolvedAt: now, resolvedBy: adminId, resolvedNote: text || null },
    });
    if (result.count > 0) {
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: adminId,
          action: "error_reviewed",
          details: {
            like: { area: where.area, code: where.code, attemptId: where.detail?.equals || null },
            before: where.createdAt.lte.toISOString(),
            count: result.count,
            note: text || null,
          },
        },
      });
    }
    return { ok: true, status: 200, count: result.count, reviewed: true };
  });
}

// ── The retired Places sweep's rows ─────────────────────────────────────────
//
// From 2026-09-18T11:48Z to 2026-09-20 the sales cron asked the Google Places
// API about a prospect every minute and was refused every time —
// PERMISSION_DENIED, "Requests to this API places.googleapis.com method
// google.maps.places.v1.Places.SearchText are blocked" — 9,181 rows under
// area "places". The sweep is gone (lib/sales/intel/places.js's header says
// why: Google data comes from the owner's Mac scrape, never the API). The rows
// stay: this table is never deleted from (the model comment on resolvedAt).
// So they are marked reviewed the way a person would mark them, by the system,
// with the reason on every row, and the review is audited like every other —
// except that the actor is not a PlatformAdmin, so the audit row names it in
// `details` and leaves platformAdminId null, the way an agency's acts do.
//
// Called from the cron on every tick. The first call stamps them all; every
// later call matches nothing and writes nothing — no audit row for a review
// of zero rows. One statement, on the (area, createdAt) index by its `area`
// prefix; the code and the null check narrow it from there.

/** What the stamped rows say — `resolvedBy` is not an admin id, so the
 *  errors screen prints it as written: "Reviewed by system:places-retired". */
export const PLACES_RETIRED_REVIEWER = "system:places-retired";
export const PLACES_RETIRED_NOTE =
  "The Places API sweep was retired on 2026-09-20: Google data comes from the owner's Mac scrape (scripts/scrape/maps.mjs), never the API. These rows were the sweep being refused, every minute, from 2026-09-18.";
/** Exactly the rows the sweep wrote — its area and Google's status. Any
 *  other "places" row (a crawl that could not be queued) is a person's to
 *  review. */
export const PLACES_RETIRED_WHERE = Object.freeze({ area: "places", code: "PERMISSION_DENIED", resolvedAt: null });

/**
 * @returns { count } rows stamped this call — 0 on every call after the first.
 */
export async function retirePlacesRefusals({ db: database = db, now = new Date() } = {}) {
  return database.$transaction(async (tx) => {
    const result = await tx.platformErrorLog.updateMany({
      where: { ...PLACES_RETIRED_WHERE },
      data: { resolvedAt: now, resolvedBy: PLACES_RETIRED_REVIEWER, resolvedNote: PLACES_RETIRED_NOTE },
    });
    if (result.count > 0) {
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: null,
          action: "error_reviewed",
          details: { by: PLACES_RETIRED_REVIEWER, area: "places", code: "PERMISSION_DENIED", count: result.count, note: PLACES_RETIRED_NOTE },
        },
      });
    }
    return { count: result.count };
  });
}
