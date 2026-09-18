// lib/sales/callQuality.js
//
// Call quality, rolled up: per rep, per agency, and for the floor.
//
// ══ Pure. Every row arrives as an argument ════════════════════════════════
//
// Same discipline as lib/sales/performance.js and lib/sales/calls/reporting.js,
// for the same reason: scripts/check-call-qa.mjs executes every branch — a
// rep with two scored calls and one unscorable, a reviewed call whose
// human score disagrees with the model's, a test-line dial that must not be
// counted — without a database.
//
// ══ Three numbers, never one ══════════════════════════════════════════════
//
// "Average 71" over four calls out of forty recorded is a different fact from
// the same average over thirty-eight. So every summary carries `recorded`,
// `scored` and `notYetScored` side by side, plus `unscorable` (no
// conversation to score) and `failed` (the model call did not come back) as
// their own counts — a call that could not be scored is not a call waiting
// to be, and folding it into either bucket would misstate the backlog.
//
// ══ The human pass wins ═══════════════════════════════════════════════════
//
// `effectiveOverall` is the reviewer's number when there is one and the
// model's otherwise. Every average here is over effective numbers — the
// owner who listened to the call and wrote 40 over the model's 80 has
// decided, and a rollup that averaged the model's 80 would be reporting a
// figure the owner has already corrected.
//
// ══ Rates use the same floor as everything else ═══════════════════════════
//
// "Disclosure said" and "permission asked" are percentages and go through
// performance.js's rate(): under ten scored calls they are "3 of 4", never
// 75%. The floor that gates a rep's conversion rate is the one integer that
// gates their disclosure rate, so the two screens cannot disagree about when
// a number is safe to print.
import { rate } from "./performance";
import { agencyOf } from "./agencyLabel";
import { withoutTestDials } from "./testLines";

/** The reviewer's number when there is one; the model's otherwise; null when neither. */
export function effectiveOverall(qa) {
  if (!qa || typeof qa !== "object") return null;
  if (Number.isFinite(qa.reviewerOverall)) return qa.reviewerOverall;
  if (Number.isFinite(qa.overall)) return qa.overall;
  return null;
}

/** A model failure, as opposed to a call that had nothing to score. */
export function isFailedScore(qa) {
  return typeof qa?.skippedReason === "string" && qa.skippedReason.startsWith("ai_failed");
}

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function inRange(at, from, to) {
  const d = when(at);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** Round to one decimal, or null. */
function mean(values) {
  const list = values.filter((v) => Number.isFinite(v));
  if (!list.length) return null;
  return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
}

/**
 * One summary over a set of attempt rows that carry `qa` (the relation) —
 * or `qa: null` when nothing has been written yet.
 *
 * Only RECORDED calls count — a handset dial has no recording and cannot be
 * scored, and it must not swell `notYetScored`.
 */
export function qualitySummary(attempts = []) {
  const recordedRows = (Array.isArray(attempts) ? attempts : []).filter((a) => a?.recordingUrl);
  const recorded = recordedRows.length;
  const scoredRows = recordedRows.filter((a) => effectiveOverall(a.qa) !== null);
  const unscorable = recordedRows.filter((a) => a.qa && effectiveOverall(a.qa) === null && a.qa.skippedReason && !isFailedScore(a.qa)).length;
  const failed = recordedRows.filter((a) => a.qa && effectiveOverall(a.qa) === null && isFailedScore(a.qa)).length;
  const scored = scoredRows.length;
  // Everything recorded that has neither a number nor a stated reason — the
  // transcript is still coming, or the scorer has not run.
  const notYetScored = recorded - scored - unscorable - failed;

  // The component rates are over MODEL-scored calls: a reviewer writes a
  // number and a note, not a disclosure verdict, so a review-only row has
  // nothing to say about these.
  const modelScored = scoredRows.filter((a) => a.qa?.deterministic && a.qa?.scores);
  const disclosureSaid = modelScored.filter((a) => a.qa.deterministic?.disclosure?.said).length;
  const permissionAsked = modelScored.filter((a) => a.qa.scores?.permissionAsk?.asked).length;
  const bannedMove = modelScored.filter(
    (a) => (a.qa.deterministic?.bannedMoves?.length || 0) > 0 || (a.qa.scores?.bannedMoves?.length || 0) > 0,
  ).length;
  const reviewed = scoredRows.filter((a) => a.qa?.reviewedAt).length;

  return {
    recorded,
    scored,
    notYetScored,
    unscorable,
    failed,
    reviewed,
    averageOverall: mean(scoredRows.map((a) => effectiveOverall(a.qa))),
    disclosureSaid: rate(disclosureSaid, modelScored.length),
    permissionAsked: rate(permissionAsked, modelScored.length),
    bannedMoveRate: rate(bannedMove, modelScored.length),
    meanTalkRatio: mean(modelScored.map((a) => a.qa.deterministic?.talk?.ratio).filter((r) => typeof r === "number")),
  };
}

/** The period before this one, of the same length, ending where this one starts. */
export function previousPeriod(from, to) {
  const a = when(from);
  const b = when(to);
  if (!a || !b || b <= a) return { from: null, to: null };
  const span = b.getTime() - a.getTime();
  return { from: new Date(a.getTime() - span - 1), to: new Date(a.getTime() - 1) };
}

/**
 * The section the performance page draws.
 *
 * @param {{ reps: Array, attempts: Array, from: Date, to: Date }} args
 *   `attempts` are SalesCallAttempt rows for the current AND previous period,
 *   each with `qa` selected. Test-line dials are dropped here whatever the
 *   query did, the same double guard reporting.js keeps.
 */
export function buildCallQuality({ reps = [], attempts = [], from = null, to = null } = {}) {
  const a = when(from);
  const b = when(to);
  const prev = previousPeriod(a, b);
  const clean = withoutTestDials(Array.isArray(attempts) ? attempts : []);

  const current = clean.filter((row) => !(a || b) || inRange(row?.dialledAt, a, b));
  const before = prev.from ? clean.filter((row) => inRange(row?.dialledAt, prev.from, prev.to)) : [];

  const byRep = (rows) => {
    const m = new Map();
    for (const row of rows) {
      if (!row?.salesRepId) continue;
      if (!m.has(row.salesRepId)) m.set(row.salesRepId, []);
      m.get(row.salesRepId).push(row);
    }
    return m;
  };
  const nowByRep = byRep(current);
  const thenByRep = byRep(before);

  const trend = (nowSummary, thenSummary) =>
    nowSummary.averageOverall !== null && thenSummary.averageOverall !== null
      ? Math.round((nowSummary.averageOverall - thenSummary.averageOverall) * 10) / 10
      : null;

  const repRows = reps.map((rep) => {
    const summary = qualitySummary(nowByRep.get(rep.id) || []);
    const previous = qualitySummary(thenByRep.get(rep.id) || []);
    return {
      id: rep.id,
      name: rep.name,
      agency: agencyOf(rep),
      active: Boolean(rep.active),
      ...summary,
      previousAverageOverall: previous.averageOverall,
      previousScored: previous.scored,
      trend: trend(summary, previous),
    };
  });

  // Per agency: the union of its employees' calls, summarised once — never a
  // mean of the rep means, which would weight a rep with two calls the same
  // as one with forty.
  const agencies = new Map();
  for (const rep of reps) {
    const ag = agencyOf(rep);
    if (!ag) continue;
    if (!agencies.has(ag.id)) agencies.set(ag.id, { id: ag.id, name: ag.name, repIds: [] });
    agencies.get(ag.id).repIds.push(rep.id);
  }
  const agencyRows = [...agencies.values()].map((ag) => {
    const nowRows = ag.repIds.flatMap((id) => nowByRep.get(id) || []);
    const thenRows = ag.repIds.flatMap((id) => thenByRep.get(id) || []);
    const summary = qualitySummary(nowRows);
    const previous = qualitySummary(thenRows);
    return { id: ag.id, name: ag.name, reps: ag.repIds.length, ...summary, previousAverageOverall: previous.averageOverall, previousScored: previous.scored, trend: trend(summary, previous) };
  });

  const total = qualitySummary(current);
  const totalBefore = qualitySummary(before);

  repRows.sort((x, y) => (y.scored - x.scored) || String(x.name).localeCompare(String(y.name)));
  agencyRows.sort((x, y) => (y.scored - x.scored) || String(x.name).localeCompare(String(y.name)));

  return {
    period: { from: a, to: b },
    previous: prev,
    total: { ...total, previousAverageOverall: totalBefore.averageOverall, previousScored: totalBefore.scored, trend: trend(total, totalBefore) },
    reps: repRows,
    agencies: agencyRows,
  };
}
