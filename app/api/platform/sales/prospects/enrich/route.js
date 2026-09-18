// app/api/platform/sales/prospects/enrich/route.js
//
// Ask Google Places about prospects — the held ones, a named few, or
// (with the owner's explicit yes) the pool.
//
// ══ Superadmin, and why a POST here is not a breach of "edit nothing" ═════
//
// The platform console views a company's data and edits nothing; a
// Prospect is FieldQuo's own row, not a tenant's, and what this writes is
// a directory's corroboration into blanks (lib/sales/intel/places.js says
// exactly which blanks). Gated to superadmin because each request costs
// money and the pool is 321,000 rows: "check the pool" pressed by a support
// admin is an eleven-thousand-dollar button.
//
// ══ Scopes ════════════════════════════════════════════════════════════════
//
//   { scope: "held" }        every prospect with an open SalesQueueClaim.
//                            The owner's first ask: the leads already in
//                            reps' hands.
//   { ids: [...] }           named rows — the detail panel's "Check Google"
//                            sends one, with `force: true` to re-ask inside
//                            the 90-day window.
//   { scope: "queue" }       the claimable pool. REFUSED unless
//                            `confirm: true` travels with it, and the
//                            refusal carries the pool size and the projected
//                            cost at list price so the owner is saying yes
//                            to a number. `limit` bounds one call.
//
// Idempotent: a row checked inside PLACES_RECHECK_DAYS is skipped and
// counted as such. The report says matched / no confident match / no
// results / permanently closed / websites gained, requests made and what
// they cost.
//
// GET returns the counters the list page shows: how many held rows are
// unchecked, the verdict tallies, this month's requests and spend, and the
// pool's size with its projected cost.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { claimCandidateWhere } from "@/lib/sales/prospectView";
import {
  ENRICH_MAX_PER_CALL,
  PLACES_COST_MICROS,
  PLACES_FREE_PER_MONTH,
  PLACES_RECHECK_DAYS,
  PLACES_SKU,
  PLACES_VERDICTS,
  enableInstructions,
  enrichProspects,
  heldProspectIds,
  placesSpendThisMonth,
  projectedCents,
} from "@/lib/sales/intel/places";
import { PLACES_PER_REP_PER_HOUR, placesWindowStatus } from "@/lib/sales/intel/placesSweep";

/** The pool: what a rep could claim right now, minus rows already checked
 *  inside the window. The same WHERE the queue uses, so "the pool" here is
 *  the pool a rep sees. */
async function poolIds({ now, limit }) {
  const since = new Date(now.getTime() - PLACES_RECHECK_DAYS * 24 * 60 * 60 * 1000);
  // claimCandidateWhere is per trade and its top-level OR is the lease
  // clause, so the trade is widened to "any trade" and the recheck window
  // rides in AND beside the retry-pool rule rather than over the lease.
  const { tradeKey: _perTrade, AND = [], ...claimable } = claimCandidateWhere({ tradeKey: null, now, rep: null });
  const where = {
    ...claimable,
    tradeKey: { not: null },
    AND: [...AND, { OR: [{ placesCheckedAt: null }, { placesCheckedAt: { lt: since } }] }],
  };
  const [count, rows] = await Promise.all([
    db.prospect.count({ where }),
    limit > 0 ? db.prospect.findMany({ where, select: { id: true }, take: limit, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);
  return { count, ids: rows.map((r) => r.id) };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();

  const [held, heldUnchecked, verdicts, month, pool, windows] = await Promise.all([
    heldProspectIds({ db, now }),
    heldProspectIds({ db, onlyUnchecked: true, now }),
    db.prospect.groupBy({ by: ["placesVerdict"], where: { placesCheckedAt: { not: null } }, _count: { _all: true } }),
    placesSpendThisMonth({ db, now }),
    poolIds({ now, limit: 0 }),
    placesWindowStatus({ db, now }),
  ]);

  const tally = Object.fromEntries(verdicts.map((v) => [v.placesVerdict || "unknown", v._count._all]));
  return NextResponse.json({
    sku: PLACES_SKU,
    costPerRequestMicros: PLACES_COST_MICROS,
    freePerMonth: PLACES_FREE_PER_MONTH,
    recheckDays: PLACES_RECHECK_DAYS,
    held: { total: held.length, unchecked: heldUnchecked.length, projectedCents: projectedCents(heldUnchecked.length) },
    checked: {
      total: Object.values(tally).reduce((a, b) => a + b, 0),
      matched: tally[PLACES_VERDICTS.MATCHED] || 0,
      noConfidentMatch: tally[PLACES_VERDICTS.NO_CONFIDENT_MATCH] || 0,
      noResults: tally[PLACES_VERDICTS.NO_RESULTS] || 0,
      duplicatePlace: tally[PLACES_VERDICTS.DUPLICATE_PLACE] || 0,
    },
    month: { requests: month.requests, cents: month.cents },
    pool: { unchecked: pool.count, projectedCents: projectedCents(pool.count) },
    // The standing job's window per rep — lib/sales/intel/placesSweep.js.
    // `nextIds` stays server-side: a counter is not a list of rows.
    perRepPerHour: PLACES_PER_REP_PER_HOUR,
    windows: windows.map(({ nextIds: _next, ...w }) => w),
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const now = new Date();
  const force = body?.force === true;
  const limit = Math.max(1, Math.min(ENRICH_MAX_PER_CALL, Number(body?.limit) || ENRICH_MAX_PER_CALL));

  let ids = [];
  let scope = null;
  if (Array.isArray(body?.ids) && body.ids.length) {
    scope = "ids";
    ids = body.ids.filter((id) => typeof id === "string" && id).slice(0, limit);
  } else if (body?.scope === "held") {
    scope = "held";
    ids = (await heldProspectIds({ db, onlyUnchecked: !force, now })).slice(0, limit);
  } else if (body?.scope === "queue") {
    scope = "queue";
    const pool = await poolIds({ now, limit: body?.confirm === true ? limit : 0 });
    if (body?.confirm !== true) {
      // Not an error: a projection. The owner asked for the size and the
      // price before anything is spent on the pool.
      return NextResponse.json({
        scope,
        refused: "confirm_required",
        pool: { unchecked: pool.count, projectedCents: projectedCents(pool.count), perCall: limit },
        message: `The pool has ${pool.count} claimable prospects not checked in the last ${PLACES_RECHECK_DAYS} days. At US$${(PLACES_COST_MICROS / 10_000 / 100).toFixed(3)} a request that is about US$${(projectedCents(pool.count) / 100).toFixed(2)} at list price (the first ${PLACES_FREE_PER_MONTH} requests a month are free). Send confirm: true to check up to ${limit} of them per call.`,
      });
    }
    ids = pool.ids;
  } else {
    return NextResponse.json({ error: "Send scope: \"held\" | \"queue\", or ids: [...]" }, { status: 400 });
  }

  const report = await enrichProspects({ db, ids, force, now });
  return NextResponse.json({
    scope,
    by: admin?.email || admin?.id || null,
    at: now.toISOString(),
    ...report,
    costCents: Math.round(report.costMicros / 10_000 * 100) / 100,
    stopped: report.stopped ? { ...report.stopped, howToEnable: enableInstructions() } : null,
    // The per-row detail is for the detail panel's single check; a batch
    // of hundreds reads the tallies.
    rows: report.rows.length <= 25 ? report.rows : report.rows.filter((r) => r.outcome === "error").slice(0, 25),
  });
}
