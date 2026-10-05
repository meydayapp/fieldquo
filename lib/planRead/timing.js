// lib/planRead/timing.js
//
// How long a drawing read took, stage by stage — recorded on the read itself
// (PlanRead.usage.timing) so the first real reads can be MEASURED rather than
// estimated. docs/ROADMAP.md's 3–5 minute target was set on budgets
// (SHEET_NEEDS_MS, PHOTOS_NEED_MS, SYNTHESIS_NEEDS_MS in run.js), not on a
// single run; this is what replaces those guesses with numbers.
//
// ══ Why inside `usage` and not a column of its own ═════════════════════════
//
// `usage` is already the read's bookkeeping JSON (tokens per step, this run's
// spend), it is written on every save of a running read, and a new column
// would have to reach the live database before the code that writes it — or
// every save of every read would fail. The timing is the same kind of fact as
// the tokens beside it, so it lives beside them.
//
// ══ Shape ══════════════════════════════════════════════════════════════════
//
//   { v: 1,
//     startedAt,                    the click that held the credit (epoch ms)
//     uploadFirstAt, uploadDoneAt,  the first and last of the read's current
//                                   files to land — "upload done"
//     invocations: [ms…],           each time a worker took the lease (≤ 40)
//     sheets: { <key>: { start, end, attempts } },
//     steps: { sheets|photos|synthesis: { start, end } },
//     endedAt, outcome }            "ready" | "failed"
//
// Every time is epoch milliseconds from the worker's clock (run.js `now`), so
// the check can drive it with a fake clock. Pure: nothing here touches a
// database or the wall clock.

export const TIMING_VERSION = 1;
const MAX_INVOCATIONS = 40;

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ms = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : new Date(v).getTime();
  return Number.isFinite(n) ? n : null;
};

/** A fresh record for a run that starts now. `documents` are the read's
 *  current files — when they finished landing is the "upload done" mark. */
export function startTiming({ now, documents = [] }) {
  const landed = (documents || []).map((d) => ms(d?.uploadedAt)).filter((x) => x !== null);
  return {
    v: TIMING_VERSION,
    startedAt: now,
    uploadFirstAt: landed.length ? Math.min(...landed) : null,
    uploadDoneAt: landed.length ? Math.max(...landed) : null,
    invocations: [],
    sheets: {},
    steps: {},
    endedAt: null,
    outcome: null,
  };
}

const base = (t) => (t && typeof t === "object" && t.v === TIMING_VERSION ? t : null);

/** A worker took the lease. */
export function markInvocation(timing, at) {
  const t = base(timing);
  if (!t) return timing;
  return { ...t, invocations: [...(t.invocations || []), at].slice(-MAX_INVOCATIONS) };
}

/** A stage started or finished. The FIRST start and the LAST end are kept:
 *  a stage that spans a lease pause is measured from its first call to its
 *  last answer, and the pause shows up as the gap in `invocations`. */
export function markStep(timing, step, edge, at) {
  const t = base(timing);
  if (!t) return timing;
  const cur = { ...(t.steps?.[step] || {}) };
  if (edge === "start") cur.start = num(cur.start) ?? at;
  else cur.end = at;
  return { ...t, steps: { ...(t.steps || {}), [step]: cur } };
}

/** One sheet's pass: when its first attempt began and its answer landed. */
export function markSheet(timing, key, { start, end, attempts }) {
  const t = base(timing);
  if (!t) return timing;
  return { ...t, sheets: { ...(t.sheets || {}), [key]: { start, end, attempts } } };
}

export function endTiming(timing, at, outcome) {
  const t = base(timing);
  if (!t) return timing;
  return { ...t, endedAt: at, outcome };
}

const span = (s) => (s && num(s.start) !== null && num(s.end) !== null ? Math.max(0, s.end - s.start) : null);

/**
 * The numbers a person reads. Absent is null, never 0 — a read that had no
 * photo pass has photosMs null, not "0 s".
 */
export function timingSummary(timing) {
  const t = base(timing);
  if (!t) return null;
  const sheetSpans = Object.values(t.sheets || {}).map(span).filter((x) => x !== null);
  const sheetsMs = span(t.steps?.sheets);
  const photosMs = span(t.steps?.photos);
  const synthesisMs = span(t.steps?.synthesis);
  const totalMs = num(t.endedAt) !== null && num(t.startedAt) !== null ? Math.max(0, t.endedAt - t.startedAt) : null;
  // Sheets and photos run side by side, so the machine's working time is the
  // later of the two to finish, then the synthesis — not their sum.
  const firstStart = [t.steps?.sheets?.start, t.steps?.photos?.start].map(num).filter((x) => x !== null);
  const lastEnd = [t.steps?.sheets?.end, t.steps?.photos?.end].map(num).filter((x) => x !== null);
  const readingMs = firstStart.length && lastEnd.length ? Math.max(0, Math.max(...lastEnd) - Math.min(...firstStart)) : null;
  const workMs = readingMs === null && synthesisMs === null ? null : (readingMs || 0) + (synthesisMs || 0);
  return {
    totalMs,
    uploadSpanMs:
      num(t.uploadFirstAt) !== null && num(t.uploadDoneAt) !== null ? Math.max(0, t.uploadDoneAt - t.uploadFirstAt) : null,
    // From the last file landing to the click: the human gap decision #4
    // ("start reading at upload") would close.
    waitBeforeReadMs:
      num(t.uploadDoneAt) !== null && num(t.startedAt) !== null ? Math.max(0, t.startedAt - t.uploadDoneAt) : null,
    sheetsMs,
    sheetCount: sheetSpans.length,
    slowestSheetMs: sheetSpans.length ? Math.max(...sheetSpans) : null,
    averageSheetMs: sheetSpans.length ? Math.round(sheetSpans.reduce((a, b) => a + b, 0) / sheetSpans.length) : null,
    retriedSheets: Object.values(t.sheets || {}).filter((s) => (s?.attempts || 1) > 1).length,
    photosMs,
    synthesisMs,
    // Time the read spent waiting between invocations (a lease pause, a
    // closed tab before the backstop came by): total minus the work.
    idleMs: totalMs !== null && workMs !== null ? Math.max(0, totalMs - workMs) : null,
    invocations: (t.invocations || []).length,
    outcome: t.outcome || null,
  };
}

/** The middle of each stage across several reads' summaries — null where no
 *  read had that stage. Pure. */
export function timingMedians(summaries) {
  const median = (xs) => {
    const v = xs.filter((x) => num(x) !== null).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  };
  const list = (Array.isArray(summaries) ? summaries : []).filter((s) => s && s.outcome === "ready");
  const pick = (k) => median(list.map((s) => s[k]));
  return {
    reads: list.length,
    totalMs: pick("totalMs"),
    sheetsMs: pick("sheetsMs"),
    photosMs: pick("photosMs"),
    synthesisMs: pick("synthesisMs"),
    idleMs: pick("idleMs"),
  };
}

/** "4m 05s" / "42s" — the compact form /platform shows. */
export function formatDuration(totalMs) {
  const n = num(totalMs);
  if (n === null) return null;
  const s = Math.round(n / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}
