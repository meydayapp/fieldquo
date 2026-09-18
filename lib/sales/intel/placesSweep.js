// lib/sales/intel/placesSweep.js
//
// The standing Google Places job: work through what reps hold, in each
// rep's queue order, at most 25 lookups per rep per clock hour.
//
// ══ The owner's figure, and why it is per rep and per hour ════════════════
//
// "25 lookups per rep per 1-hour window" — his number. Per rep because the
// rows that matter are the ones a rep is about to dial, in the order they
// will dial them; a global cap would let one rep's four hundred claims eat
// the hour. Per clock hour because that is what a counter on a screen can
// say — "Google check: 25/25 this hour for Favor · next window 23:00" — and
// a sliding window cannot be read off a wall clock.
//
// ══ Where it runs ═════════════════════════════════════════════════════════
//
// A slice of /api/cron/sales-pipeline, which fires every minute. Each tick
// takes at most SWEEP_PER_TICK lookups across every rep, so a tick costs a
// few seconds and never the invocation; a rep's remaining allowance for
// the hour is what bounds the total, and the next tick continues. Nothing
// is queued as a pipeline task: a Places lookup is one HTTP call and the
// cap is a wall-clock rule, which SalesPipelineTask's FIFO cannot express.
//
// ══ Idempotent ════════════════════════════════════════════════════════════
//
// A row checked inside PLACES_RECHECK_DAYS is never taken (places.js's own
// skip, and the candidate query excludes it before the request is made). A
// row's check counts against the hour of the rep who held it at the time —
// derived from `placesCheckedAt` over the rep's OPEN claims, so a check the
// console button made counts too, and there is no second counter to drift.
//
// ══ What it is not ════════════════════════════════════════════════════════
//
// The pool. Rows nobody holds are not touched here: the whole-pool
// projection is reported by GET /api/platform/sales/prospects/enrich and
// run only on the owner's explicit yes.
import { db as defaultDb } from "@/lib/db";
import { PLACES_RECHECK_DAYS, enrichProspects } from "./places";

/** The owner's figure. */
export const PLACES_PER_REP_PER_HOUR = 25;
/** Across every rep, per cron tick — a few seconds of one invocation. */
export const SWEEP_PER_TICK = 20;
/** Per rep per tick, so a tick with three reps waiting serves all three. */
export const SWEEP_PER_REP_PER_TICK = 10;

/** The clock hour `now` falls in, UTC. Pure. */
export function hourWindow(now = new Date()) {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

/** How many more lookups a rep may have this hour. Pure. */
export function remainingThisHour(checkedThisHour, cap = PLACES_PER_REP_PER_HOUR) {
  return Math.max(0, cap - (Number(checkedThisHour) || 0));
}

/**
 * Every rep with an open claim, with this hour's count and what is left.
 *
 * @returns [{ repId, name, held, heldUnchecked, checkedThisHour, cap,
 *             remaining, windowStart, nextWindowAt }]
 */
export async function placesWindowStatus({ db = defaultDb, now = new Date() } = {}) {
  const { start, end } = hourWindow(now);
  const since = new Date(now.getTime() - PLACES_RECHECK_DAYS * 24 * 60 * 60 * 1000);

  const claims = await db.salesQueueClaim.findMany({
    where: { releasedAt: null },
    select: { salesRepId: true, prospectId: true, claimedAt: true, position: true },
    orderBy: [{ claimedAt: "asc" }, { position: "asc" }],
  });
  if (!claims.length) return [];

  const prospectIds = [...new Set(claims.map((c) => c.prospectId))];
  const repIds = [...new Set(claims.map((c) => c.salesRepId))];
  const [prospects, reps] = await Promise.all([
    db.prospect.findMany({
      where: { id: { in: prospectIds } },
      select: { id: true, placesCheckedAt: true, doNotContactAt: true, mergedIntoId: true },
    }),
    db.salesRep.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true, email: true } }),
  ]);
  const byProspect = new Map(prospects.map((p) => [p.id, p]));
  const byRep = new Map(reps.map((r) => [r.id, r]));

  const out = new Map();
  for (const c of claims) {
    const p = byProspect.get(c.prospectId);
    if (!p) continue;
    if (!out.has(c.salesRepId)) {
      const rep = byRep.get(c.salesRepId);
      out.set(c.salesRepId, {
        repId: c.salesRepId,
        name: rep?.name || rep?.email || c.salesRepId,
        held: 0,
        heldUnchecked: 0,
        checkedThisHour: 0,
        cap: PLACES_PER_REP_PER_HOUR,
        remaining: PLACES_PER_REP_PER_HOUR,
        windowStart: start.toISOString(),
        nextWindowAt: end.toISOString(),
        // Queue order, unchecked only — what the sweep will take next.
        nextIds: [],
        seen: new Set(),
      });
    }
    const row = out.get(c.salesRepId);
    if (row.seen.has(p.id)) continue;
    row.seen.add(p.id);
    row.held += 1;
    const at = p.placesCheckedAt ? new Date(p.placesCheckedAt) : null;
    if (at && at >= start && at < end) row.checkedThisHour += 1;
    const unchecked = !at || at < since;
    if (unchecked && !p.doNotContactAt && !p.mergedIntoId) {
      row.heldUnchecked += 1;
      row.nextIds.push(p.id);
    }
  }
  return [...out.values()].map(({ seen: _seen, ...row }) => ({
    ...row,
    remaining: remainingThisHour(row.checkedThisHour, row.cap),
  }));
}

/**
 * One tick of the standing job.
 *
 * @returns { reps: [{ repId, name, took, remainingAfter }], asked,
 *            requests, costMicros, matched, websitesGained, stopped }
 */
export async function sweepQueuedPlaces({ db = defaultDb, now = new Date(), perTick = SWEEP_PER_TICK, perRep = SWEEP_PER_REP_PER_TICK, deps = {} } = {}) {
  const status = await placesWindowStatus({ db, now });
  const plan = [];
  let budget = perTick;
  for (const rep of status) {
    if (budget <= 0) break;
    const take = Math.min(rep.remaining, perRep, budget, rep.nextIds.length);
    if (take <= 0) continue;
    plan.push({ repId: rep.repId, name: rep.name, ids: rep.nextIds.slice(0, take), remainingBefore: rep.remaining });
    budget -= take;
  }

  const result = { reps: [], asked: 0, checked: 0, requests: 0, costMicros: 0, matched: 0, noConfidentMatch: 0, noResults: 0, closedPermanently: 0, websitesGained: 0, stopped: null };
  for (const entry of plan) {
    if (result.stopped) break;
    const report = await enrichProspects({ db, ids: entry.ids, now, deps });
    result.asked += report.asked;
    result.checked += report.checked;
    result.requests += report.requests;
    result.costMicros += report.costMicros;
    result.matched += report.matched;
    result.noConfidentMatch += report.noConfidentMatch;
    result.noResults += report.noResults;
    result.closedPermanently += report.closedPermanently;
    result.websitesGained += report.websitesGained;
    result.reps.push({
      repId: entry.repId,
      name: entry.name,
      took: report.requests,
      remainingAfter: Math.max(0, entry.remainingBefore - report.requests),
    });
    if (report.stopped) result.stopped = report.stopped;
  }
  return result;
}
