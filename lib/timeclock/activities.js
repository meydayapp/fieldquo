// lib/timeclock/activities.js
//
// The time clock's activities — what a person can say they are doing while on
// the clock — and the company's policy for them. Pure: no database, no React,
// so the route, the clock screen, the settings card and
// scripts/check-time-activities.mjs all read ONE table.
//
// ── Two kinds of tile, on purpose ──────────────────────────────────────────
//
// Visit, Driving, Office, Supplies and General are WORK: each is a TimeEntry
// with `activity` set, and tapping one closes the running entry and opens the
// next at the same instant (the job switch the clock already had, widened).
//
// Break and Lunch are NOT entries. They stay TimeEntryBreak rows inside the
// entry they interrupt, exactly as the clock has recorded them since
// 2026-09: an unpaid one comes off that entry's hours, a paid one is recorded
// and changes nothing (lib/timeclock/entryHours.js). Modelling a break as its
// own entry would have meant payroll learning to subtract a row instead of
// reading `hours` — a second pay rule beside the first, which is the copy that
// rots.
//
// ── Where the money rule lives ─────────────────────────────────────────────
//
// `hours` on a TimeEntry is PAID hours — it always was: clock-in to clock-out
// less the unpaid breaks. An activity the company marks unpaid closes with
// hours 0 (TimeEntry.paid false, stamped at clock-in), so payroll, job costing
// and every report that sums `hours` get the right answer without a change.
//
// ── Which job, per activity ────────────────────────────────────────────────
//
//   visit     required  — on site AT a job; that is what the tile means
//   driving   optional  — to a job (its labour) or not (overhead)
//   supplies  optional  — for a job, or stocking the van
//   office    never     — overhead by definition
//   general   never     — the catch-all, and what an old null-job entry reads as
//
// Visit and General cannot be switched off: Visit is the job-labour tile the
// whole costing chain is built on, and General is where every entry written
// before the tiles existed is shown — hiding it would hide those hours' kind.
// Visit is always paid for the same reason: a job's labour is the work.

export const WORK_ACTIVITIES = Object.freeze(["visit", "driving", "office", "supplies", "general"]);
export const BREAK_ACTIVITIES = Object.freeze(["break", "lunch"]);

/**
 * Every activity, in the order the tiles are drawn. `icon` is a lucide name
 * (a string, so this file needs no React); the screen maps it.
 */
export const ACTIVITIES = Object.freeze([
  { key: "visit", icon: "MapPin", job: "required", defaultPaid: true, fixedPaid: true, alwaysOn: true },
  { key: "driving", icon: "Truck", job: "optional", defaultPaid: true },
  { key: "office", icon: "Building2", job: "none", defaultPaid: true },
  { key: "supplies", icon: "ShoppingCart", job: "optional", defaultPaid: true },
  // Unpaid by default — the rule the clock has always applied to a break
  // punched from it (TimeEntryBreak.paid defaults false, and "a lunch is the
  // common case and an unpaid one is the one that must never be silently
  // counted as work" — the schema's own note on ShiftBreak).
  { key: "break", icon: "Coffee", job: "none", defaultPaid: false, isBreak: true },
  { key: "lunch", icon: "Utensils", job: "none", defaultPaid: false, isBreak: true },
  { key: "general", icon: "Clock", job: "none", defaultPaid: true, alwaysOn: true },
]);

const BY_KEY = Object.freeze(Object.fromEntries(ACTIVITIES.map((a) => [a.key, a])));

/** The catalogue row for a key, or null. */
export function activityMeta(key) {
  return BY_KEY[key] || null;
}

export const isWorkActivity = (key) => WORK_ACTIVITIES.includes(key);
export const isBreakActivity = (key) => BREAK_ACTIVITIES.includes(key);

/** Longest custom name a company may give a tile — it has to fit on one. */
export const LABEL_MAX = 24;

function cleanLabel(raw) {
  if (typeof raw !== "string") return null;
  // Control characters out, whitespace collapsed: a label is one short line
  // on a tile, never markup and never a paragraph.
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.slice(0, LABEL_MAX);
}

/**
 * The company's policy, complete: one row per activity with `enabled`,
 * `label` (the company's own name, or null for the built-in translated one)
 * and `paid`. Junk, unknown keys and missing keys all resolve to the
 * defaults — what is stored is never trusted to be well-formed, and null
 * (never configured) is every tile on, built-in names, the old pay rule.
 */
export function resolveTimeActivities(stored) {
  const src = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  return ACTIVITIES.map((a) => {
    const row = src[a.key] && typeof src[a.key] === "object" ? src[a.key] : {};
    return {
      key: a.key,
      icon: a.icon,
      job: a.job,
      isBreak: Boolean(a.isBreak),
      alwaysOn: Boolean(a.alwaysOn),
      fixedPaid: Boolean(a.fixedPaid),
      enabled: a.alwaysOn ? true : row.enabled !== false,
      label: cleanLabel(row.label),
      paid: a.fixedPaid ? true : typeof row.paid === "boolean" ? row.paid : a.defaultPaid,
    };
  });
}

/** The resolved row for one activity under a stored policy. */
export function activityPolicy(stored, key) {
  return resolveTimeActivities(stored).find((a) => a.key === key) || null;
}

/**
 * What a PATCH may store: only known keys, only the three fields, only the
 * fields that can differ for that activity. Returns the compact object to
 * write — a row equal to the defaults is dropped, so "never configured" and
 * "configured to the defaults" store the same thing.
 */
export function sanitiseTimeActivities(body) {
  const src = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const out = {};
  for (const a of ACTIVITIES) {
    const row = src[a.key];
    if (!row || typeof row !== "object") continue;
    const next = {};
    if (!a.alwaysOn && row.enabled === false) next.enabled = false;
    const label = cleanLabel(row.label);
    if (label) next.label = label;
    if (!a.fixedPaid && typeof row.paid === "boolean" && row.paid !== a.defaultPaid) next.paid = row.paid;
    if (Object.keys(next).length) out[a.key] = next;
  }
  return out;
}

/**
 * What an entry IS, for display and for "is this the same thing?".
 *
 * A null activity is an entry written before the tiles existed, and it is
 * read, never rewritten: with a job it was time on that job (the clock's
 * job picker meant exactly "I'm working on this"), without one it is general.
 */
export function effectiveActivity(entry) {
  const a = entry?.activity;
  if (isWorkActivity(a)) return a;
  return entry?.jobId ? "visit" : "general";
}

/**
 * The job rule for a requested activity. Returns `{ error }` for a request
 * the activity cannot take, else `{}`. The job itself is proved separately
 * (clockableJobWhere) — this only says whether one is wanted.
 */
export function checkActivityJob(activity, jobId, taskId) {
  const meta = activityMeta(activity);
  if (!meta || meta.isBreak) return { error: "unknown_activity" };
  const hasJob = typeof jobId === "string" && jobId !== "";
  const hasTask = typeof taskId === "string" && taskId !== "";
  if (meta.job === "required" && !hasJob) return { error: "job_required" };
  if (meta.job === "none" && hasJob) return { error: "job_not_allowed" };
  // A plan step is a step OF the job's work — only a visit books to one.
  if (hasTask && activity !== "visit") return { error: "step_not_allowed" };
  return {};
}
