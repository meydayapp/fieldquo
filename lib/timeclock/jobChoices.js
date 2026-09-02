// lib/timeclock/jobChoices.js
//
// Which job is this punch for?
//
// ── The hole this closes ───────────────────────────────────────────────────
//
// The self-serve clock (app/api/time-clock/route.js) wrote
// `{ workerId, clockIn, status: "pending" }` and no `jobId`. Job costing reads
// `db.timeEntry.findMany({ where: { jobId: job.id } })`, so every hour a crew
// member punched on their phone was invisible to the job it was worked on —
// while the same rows reached payroll fine, because payroll groups by worker.
// Labour cost on a job was understated by however much the crew clocked
// themselves, which on a field-service company is most of it.
//
// The manual path (POST /api/time-entries) already accepts a `jobId` and
// proves it with lib/tenant/ownedIds. This file is the self-serve half: it
// answers "what may this person attribute an hour to, and which of those is
// the obvious one right now", using the visits already on their day.
//
// ── No location, and none coming ───────────────────────────────────────────
//
// The obvious-looking version of this feature is "clock in when you arrive".
// It cannot be built in a browser — the Geolocation spec only delivers to
// "fully-active visible documents", it hangs off `Navigator` and not
// `WorkerNavigator` so a Service Worker cannot reach it, and the Geofencing
// API was withdrawn in 2017. See docs/construction/AUDIT-routing-geo.md §3.
// So this asks instead of guessing, defaults where the answer is unambiguous,
// and stores no coordinate anywhere. Nothing on the clock screen may imply
// arrival is detected, because it isn't.
//
// ── Absence stays absent ───────────────────────────────────────────────────
//
// An hour with no job is a real, common and legitimate thing: driving, the
// yard, a morning of quoting, a day of van maintenance. `TimeEntry.jobId` is
// nullable and stays nullable. A required job field would not produce better
// data, it would produce invented data — people pick the nearest plausible job
// to get past the screen, and an invented attribution is worse than a known
// gap. See lib/costing/unattributedHours.js for the other half of that
// promise: the hours with no job are counted and named on the costing screen
// rather than silently dropped.

import { assignedJobWhere } from "@/lib/permissions/enforce";
import { zonedYmd, zonedWallClockToUtc } from "@/lib/booking/timezone";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

/**
 * The `where` for a job an hour may be booked against.
 *
 * ONE definition, used by both the list the screen offers and the check the
 * write performs, so the server cannot accept something the picker never
 * showed — or, worse, refuse something it did. Two copies of this rule is
 * exactly the shape AGENTS.md failure class #4 describes.
 *
 * `companyId` is INSIDE this object rather than spread around it at the call
 * site. That is deliberate on two counts: it makes the tenant boundary part of
 * the definition rather than something each caller remembers, and it keeps
 * `companyId` visible in the `where` that scripts/check-tenant-scope.mjs reads
 * off the route.
 *
 * `assignedJobWhere(full)` is the product's existing answer to "which jobs are
 * theirs" — `{}` for anyone who sees the whole board (owner, admin, estimator),
 * and a filter on `visits.some.assignedToId` for scoped crew. Reused rather
 * than re-stated: the clock screen must not become a wider door onto the client
 * book than /app/jobs is, and a second definition of "their jobs" is how those
 * two come to disagree.
 *
 * Cancelled and archived jobs are excluded. A cancelled job is work that isn't
 * happening; an archived one is filed away. `completed` is deliberately KEPT —
 * snagging, touch-ups and warranty hours are real costs of the job they belong
 * to, and refusing them would push people to leave the field blank, which is
 * the lie this whole feature exists to avoid.
 */
export function clockableJobWhere({ companyId, full, jobId } = {}) {
  return {
    ...(jobId ? { id: jobId } : {}),
    companyId,
    archivedAt: null,
    status: { not: "cancelled" },
    ...assignedJobWhere(full),
  };
}

/**
 * The visits assigned to this person on a given calendar day, as a `where`.
 *
 * "Today" is the company's day, not the server's. `new Date().setHours(0,0,0,0)`
 * on Vercel is midnight UTC, which is 8pm the previous evening in Toronto — so
 * a 7am punch would have looked for visits on the wrong date for every company
 * west of Greenwich. lib/time/wallClock.js already made this exact argument
 * about manual entries; this is the same rule for the same reason.
 */
export function dayBoundsInZone(now, timezone) {
  const tz = timezone || DEFAULT_TIMEZONE;
  const { year, month, day } = zonedYmd(now, tz);
  const start = zonedWallClockToUtc({ year, month, day, hours: 0, minutes: 0 }, tz);
  // A day is defined as "up to the start of the next one" rather than
  // 23:59:59, so nothing can fall between the two ends — and the next day is
  // computed from a real Date rather than `day + 1`, which would produce the
  // 32nd of a month.
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const next = zonedWallClockToUtc(
    {
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hours: 0,
      minutes: 0,
    },
    tz,
  );
  return { start, next };
}

/** How many jobs the picker will carry. See buildJobOptions on why it is capped. */
export const MAX_JOB_OPTIONS = 60;

/**
 * Turn today's visits and the open job list into the picker's options.
 *
 * Pure, so the interesting behaviour — what gets defaulted, what doesn't — is
 * executable without a database. See scripts/check-time-clock-job.mjs.
 *
 * ── What gets defaulted, and what gets asked ───────────────────────────────
 *
 * EXACTLY ONE visit scheduled for this person today → that job is suggested,
 * because there is no ambiguity to resolve and making someone tap through a
 * list to confirm the only possible answer is the sort of friction that gets a
 * feature turned off.
 *
 * TWO OR MORE → nothing is suggested. Picking the earliest, or the nearest, or
 * the first alphabetically would be a guess wearing the clothes of an answer,
 * and it would be wrong roughly half the time on a two-visit day. Asking is the
 * only honest option, and the screen says how many there are so the question
 * reads as a real one.
 *
 * NONE → nothing is suggested either. A day with no scheduled visit is a
 * perfectly ordinary day (a two-week repaint has one visit on day one and
 * fourteen days of work after it), so the person's other open jobs are still
 * offered — but none of them is more likely than the others, so none is picked.
 *
 * @param {object[]} todayVisits [{ jobId, scheduledAt, job: { id, title, client } }]
 * @param {object[]} openJobs    [{ id, title, client, updatedAt }] — already scoped
 */
export function buildJobOptions(todayVisits = [], openJobs = []) {
  const visits = Array.isArray(todayVisits) ? todayVisits : [];
  const jobs = Array.isArray(openJobs) ? openJobs : [];

  // Visits first, in the order the day happens. A job with two visits today
  // (morning assessment, afternoon fit) is ONE option — you cannot clock into
  // the same job twice — but it still counts once toward "is this ambiguous".
  const byJob = new Map();
  const sortedVisits = [...visits]
    .filter((v) => v && (v.jobId || v.job?.id))
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

  for (const v of sortedVisits) {
    const id = v.jobId || v.job?.id;
    if (byJob.has(id)) continue;
    byJob.set(id, {
      id,
      title: v.job?.title || null,
      client: v.job?.client?.name || null,
      scheduledAt: v.scheduledAt ? new Date(v.scheduledAt).toISOString() : null,
      today: true,
    });
  }

  const todayCount = byJob.size;

  for (const j of jobs) {
    if (!j?.id || byJob.has(j.id)) continue;
    byJob.set(j.id, {
      id: j.id,
      title: j.title || null,
      client: j.client?.name || null,
      scheduledAt: null,
      today: false,
    });
  }

  // Capped, and the caller is told when it bit. A sole trader who is unscoped
  // sees every open job in the company here, and a company with four hundred
  // of them would otherwise ship a four-hundred-row <select> to a phone on a
  // driveway connection. The cap can only ever drop `today: false` rows,
  // because the visits are inserted first — the option somebody actually needs
  // is never the one that falls off the end.
  const all = [...byJob.values()];
  const options = all.slice(0, MAX_JOB_OPTIONS);

  return {
    options,
    todayCount,
    // Null unless there is exactly one, and that is the whole rule.
    suggestedJobId: todayCount === 1 ? options[0].id : null,
    truncated: all.length > options.length,
  };
}

/**
 * The picker's contents for one person, right now.
 *
 * `db` is a parameter rather than an import so this stays executable against a
 * fake client — the same reason lib/tenant/ownedIds.js takes one.
 */
export async function clockJobOptions(db, { companyId, full, userId, now, timezone } = {}) {
  const { start, next } = dayBoundsInZone(now || new Date(), timezone);

  const [todayVisits, openJobs] = await Promise.all([
    db.jobVisit.findMany({
      where: {
        assignedToId: userId || "__none__",
        scheduledAt: { gte: start, lt: next },
        // A cancelled visit is not somewhere anybody is going. The job filter
        // is the same one the write is checked against, walked through the
        // relation — so a visit on an archived job cannot smuggle that job
        // into the list.
        status: { not: "cancelled" },
        job: clockableJobWhere({ companyId, full }),
      },
      select: {
        jobId: true,
        scheduledAt: true,
        job: { select: { id: true, title: true, client: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.job.findMany({
      where: clockableJobWhere({ companyId, full }),
      select: { id: true, title: true, client: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      // One more than the cap, so `truncated` above can tell "exactly at the
      // limit" from "there were more".
      take: MAX_JOB_OPTIONS + 1,
    }),
  ]);

  return buildJobOptions(todayVisits, openJobs);
}
