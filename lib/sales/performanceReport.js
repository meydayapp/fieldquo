// lib/sales/performanceReport.js
//
// The whole performance page in one object: signups and commission
// (lib/sales/performance.js), the calling figures (lib/sales/calls/reporting.js
// — the SAME repCallStats / teamCallRows the floor board draws from, never a
// second count), and call quality (lib/sales/callQuality.js).
//
// ══ Why a composer and not three more lines in performance.js ═════════════
//
// reporting.js imports rate() from performance.js. performance.js importing
// reporting.js back would be a cycle that happens to work today because
// every export involved is a hoisted function declaration, and would stop
// working the day one of them becomes a const. So the composition lives one
// level up, where it can import both.
//
// ══ One scope, two callers ════════════════════════════════════════════════
//
// `repIds: null` is everyone — the platform's page. An array is a team —
// the agency's page, handed visibleRepIds() by its route after a fresh
// agencyTeamIds() read. The scope is applied ONCE here, to every input, so
// the agency's headline, rep table, call figures and quality section are
// all the same subset; a route that scoped three of the four would ship a
// page whose totals disagree with its rows.
//
// Pure. scripts/check-call-qa.mjs executes it with a team of two out of
// three reps and asserts the third appears nowhere in the result.
import { buildSalesPerformance } from "./performance";
import { repCallStats, teamCallRows, NOT_TRACKED_CALLS } from "./calls/reporting";
import { buildCallQuality } from "./callQuality";
import { agencyOf } from "./agencyLabel";
import { withoutTestDials } from "./testLines";

const inScope = (repIds) => (repIds === null ? () => true : (id) => repIds.includes(id));

/**
 * The calling section: per rep (teamCallRows, so the floor and this page
 * cannot disagree), per agency (repCallStats over the union of the agency's
 * rows — one summary, not a mean of means), and the floor total.
 */
export function buildCallActivity({ reps = [], attempts = [], from = null, to = null, now = new Date() } = {}) {
  const rows = teamCallRows({ reps, attempts, activity: [], presence: [], from, to, now });
  const clean = withoutTestDials(attempts);

  const agencies = new Map();
  for (const rep of reps) {
    const ag = agencyOf(rep);
    if (!ag) continue;
    if (!agencies.has(ag.id)) agencies.set(ag.id, { id: ag.id, name: ag.name, repIds: [] });
    agencies.get(ag.id).repIds.push(rep.id);
  }
  const agencyRows = [...agencies.values()].map((ag) => ({
    id: ag.id,
    name: ag.name,
    reps: ag.repIds.length,
    stats: repCallStats({ attempts: clean.filter((a) => ag.repIds.includes(a?.salesRepId)), from, to, now }),
  }));

  return {
    reps: rows,
    agencies: agencyRows,
    total: repCallStats({ attempts: clean.filter((a) => reps.some((r) => r.id === a?.salesRepId)), from, to, now }),
    notTracked: NOT_TRACKED_CALLS,
  };
}

/**
 * @param {object} args  everything buildSalesPerformance takes, plus
 *   `attempts` (SalesCallAttempt rows for the current AND previous period,
 *   each with `qa` selected) and `repIds` (null = everyone).
 */
export function buildPerformanceReport({
  reps = [],
  attributions = [],
  entries = [],
  batches = [],
  leads = [],
  companies = [],
  attempts = [],
  from = null,
  to = null,
  now = new Date(),
  repIds = null,
} = {}) {
  const scope = Array.isArray(repIds) ? [...new Set(repIds.filter((id) => typeof id === "string" && id))] : null;
  const keep = inScope(scope);

  const scopedReps = reps.filter((r) => keep(r?.id));
  const scopedAttempts = attempts.filter((a) => keep(a?.salesRepId));

  const report = buildSalesPerformance({
    reps: scopedReps,
    attributions: attributions.filter((a) => keep(a?.salesRepId)),
    entries: entries.filter((e) => keep(e?.salesRepId)),
    batches: batches.filter((b) => keep(b?.salesRepId)),
    leads: leads.filter((l) => keep(l?.salesRepId)),
    companies,
    from,
    to,
    now,
    repIds: scope,
  });

  return {
    ...report,
    scope: { repIds: scope },
    calls: buildCallActivity({ reps: scopedReps, attempts: scopedAttempts, from, to, now }),
    callQuality: buildCallQuality({ reps: scopedReps, attempts: scopedAttempts, from, to }),
  };
}
