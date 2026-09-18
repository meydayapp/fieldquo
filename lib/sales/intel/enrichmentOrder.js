// lib/sales/intel/enrichmentOrder.js
//
// The one order every enrichment pass walks the prospects in — Google
// Places, the register personnel lookup, the BBB batch, the bulk vendor
// runs — so they all agree, and so the console can say where a sweep is
// relative to the dispatcher.
//
// ══ The owner's rule ══════════════════════════════════════════════════════
//
//   1. Every prospect with an OPEN CLAIM, all reps, in the reps' queue
//      order (claimedAt, then position) — these are being dialled today.
//   2. Then, progressively, the prospects in the TRADES CURRENTLY BEING
//      WORKED — the trade keys of the open claims and of the batches
//      handed out recently — in the order the dispatcher would hand them
//      out next, so the enrichment runs just ahead of the reps.
//   3. Never the rest of the pool.
//
// ══ "The order the dispatcher would hand them out next" ═══════════════════
//
// lib/sales/queueBatch.js selectClaimBatch reads claim candidates
// (prospectView.js claimCandidateWhere: the trade, a claimable status, no
// DNC, not retired, not leased, retry-available) in two reads — RESEARCHED
// rows first, then unresearched — each `createdAt asc`, and selectBatch
// then re-sorts the page by calling window. The window part is a property
// of the hour the rep presses the button, not of the row, so this file
// reproduces the STABLE part: researched first, then createdAt ascending,
// per trade. That is the order a rep who pressed "claim" right now would
// see, before the clock moved anything.
//
// ══ Pure, with the database reads beside it ═══════════════════════════════
//
// `orderCandidates()` is the pure function the check drives: given the open
// claims, the recently worked trades and the per-trade candidate lists,
// it returns one list with a `tier` and a `reason` on every row.
// `loadEnrichmentOrder()` does the four reads and calls it. Callers filter
// the result through their own "already done" stamp (placesCheckedAt,
// principalCheckedAt, bbbCheckedAt) — the ORDER is shared, the stamp is
// each source's own.
import { db as defaultDb } from "@/lib/db";
import { claimCandidateWhere } from "@/lib/sales/prospectView";
import { researchedWhere, unresearchedWhere } from "@/lib/sales/queueBatch";
import { discoveryTradeKeys } from "@/lib/sales/discovery/trades";

/** How far back a claim log row still says "this trade is being worked". */
export const WORKED_TRADE_DAYS = 7;
/** How deep into each worked trade's dispatch order a pass may look. */
export const AHEAD_PER_TRADE = 400;

export const ENRICHMENT_TIERS = Object.freeze({
  CLAIMED: "claimed",
  NEXT_IN_TRADE: "next_in_trade",
});

/**
 * The pure ordering.
 *
 * @param claims     [{ prospectId, salesRepId, claimedAt, position, tradeKey }]
 *                   open claims, any order
 * @param trades     [{ tradeKey, lastWorkedAt, claims }] the trades being
 *                   worked, any order — more recently worked first wins
 * @param candidates { [tradeKey]: [{ id, tradeKey, researched, createdAt }] }
 *                   each trade's claim candidates, already in dispatch order
 * @returns [{ id, tier, tradeKey, repId|null, reason, rank }]
 */
export function orderCandidates({ claims = [], trades = [], candidates = {} } = {}) {
  const out = [];
  const seen = new Set();
  const sortedClaims = [...(Array.isArray(claims) ? claims : [])].sort((a, b) => {
    const t = new Date(a.claimedAt || 0) - new Date(b.claimedAt || 0);
    if (t) return t;
    return (a.position ?? 0) - (b.position ?? 0);
  });
  for (const c of sortedClaims) {
    if (!c?.prospectId || seen.has(c.prospectId)) continue;
    seen.add(c.prospectId);
    out.push({ id: c.prospectId, tier: ENRICHMENT_TIERS.CLAIMED, tradeKey: c.tradeKey || null, repId: c.salesRepId || null, reason: "open claim" });
  }
  // Trades by how recently they were worked, most recent first; ties by how
  // many open claims they carry.
  const tradeOrder = [...(Array.isArray(trades) ? trades : [])]
    .filter((t) => t?.tradeKey)
    .sort((a, b) => {
      const t = new Date(b.lastWorkedAt || 0) - new Date(a.lastWorkedAt || 0);
      if (t) return t;
      return (b.claims || 0) - (a.claims || 0);
    });
  // Interleave the trades round-robin rather than exhaust one before the
  // next: two reps on two trades each get their next rows enriched at the
  // same pace, and "just ahead of the dispatcher" holds for both.
  const cursors = tradeOrder.map((t) => ({ tradeKey: t.tradeKey, rows: candidates?.[t.tradeKey] || [], i: 0 }));
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const cur of cursors) {
      while (cur.i < cur.rows.length) {
        const row = cur.rows[cur.i++];
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push({ id: row.id, tier: ENRICHMENT_TIERS.NEXT_IN_TRADE, tradeKey: cur.tradeKey, repId: null, reason: `next in ${cur.tradeKey}${row.researched ? ", researched" : ""}` });
        progressed = true;
        break;
      }
    }
  }
  return out.map((row, rank) => ({ ...row, rank }));
}

/**
 * How far ahead of the dispatcher a pass is, per trade: the number of rows
 * at the HEAD of the trade's dispatch order already carrying the stamp,
 * before the first one that does not.
 *
 * @param candidates the trade's rows in dispatch order, each with `done`
 * @returns { ahead, total, nextId } — nextId is the first undone row
 */
export function aheadOfDispatcher(candidates = []) {
  let ahead = 0;
  let nextId = null;
  for (const row of Array.isArray(candidates) ? candidates : []) {
    if (row?.done) ahead += 1;
    else {
      nextId = row?.id || null;
      break;
    }
  }
  return { ahead, total: Array.isArray(candidates) ? candidates.length : 0, nextId };
}

const CANDIDATE_SELECT = { id: true, tradeKey: true, createdAt: true, lastCrawledAt: true };

/**
 * The four reads, then the pure order.
 *
 * @param stampField  the Prospect column that says "this source has done
 *                    this row" — placesCheckedAt, principalCheckedAt,
 *                    bbbCheckedAt — reported per row as `done` so a caller
 *                    can filter and the console can say how far ahead.
 * @param since       a stamp older than this counts as not done
 * @returns { rows, trades: [{ tradeKey, claims, lastWorkedAt, ahead, total, nextId }], claimed }
 */
export async function loadEnrichmentOrder({ db = defaultDb, now = new Date(), stampField = null, since = null, aheadPerTrade = AHEAD_PER_TRADE } = {}) {
  const workedSince = new Date(now.getTime() - WORKED_TRADE_DAYS * 24 * 60 * 60 * 1000);
  const [open, recent] = await Promise.all([
    db.salesQueueClaim.findMany({
      where: { releasedAt: null },
      select: { prospectId: true, salesRepId: true, claimedAt: true, position: true, prospect: { select: { tradeKey: true, mergedIntoId: true, doNotContactAt: true } } },
      orderBy: [{ claimedAt: "asc" }, { position: "asc" }],
    }),
    db.salesQueueClaim.findMany({
      where: { claimedAt: { gte: workedSince } },
      select: { claimedAt: true, prospect: { select: { tradeKey: true } } },
      orderBy: { claimedAt: "desc" },
    }),
  ]);
  const claims = open
    .filter((c) => c.prospect && !c.prospect.mergedIntoId && !c.prospect.doNotContactAt)
    .map((c) => ({ prospectId: c.prospectId, salesRepId: c.salesRepId, claimedAt: c.claimedAt, position: c.position, tradeKey: c.prospect.tradeKey || null }));

  const known = new Set(discoveryTradeKeys());
  const tradeMap = new Map();
  for (const c of [...open, ...recent]) {
    const key = c.prospect?.tradeKey;
    if (!key || !known.has(key)) continue;
    const t = tradeMap.get(key) || { tradeKey: key, claims: 0, lastWorkedAt: null };
    if (!c.releasedAt && open.includes(c)) t.claims += 1;
    if (!t.lastWorkedAt || c.claimedAt > t.lastWorkedAt) t.lastWorkedAt = c.claimedAt;
    tradeMap.set(key, t);
  }
  const trades = [...tradeMap.values()];

  const select = stampField ? { ...CANDIDATE_SELECT, [stampField]: true } : CANDIDATE_SELECT;
  const candidates = {};
  for (const t of trades) {
    const base = claimCandidateWhere({ tradeKey: t.tradeKey, now });
    const [researched, unresearched] = await Promise.all([
      db.prospect.findMany({ where: { AND: [base, researchedWhere()] }, orderBy: { createdAt: "asc" }, take: aheadPerTrade, select }),
      db.prospect.findMany({ where: { AND: [base, unresearchedWhere()] }, orderBy: { createdAt: "asc" }, take: aheadPerTrade, select }),
    ]);
    candidates[t.tradeKey] = [
      ...researched.map((r) => ({ ...r, researched: true })),
      ...unresearched.map((r) => ({ ...r, researched: false })),
    ]
      .slice(0, aheadPerTrade)
      .map((r) => ({ ...r, done: stampField ? isDone(r[stampField], since) : false }));
  }

  const rows = orderCandidates({ claims, trades, candidates });
  const claimedIds = new Set(claims.map((c) => c.prospectId));
  let claimedDone = 0;
  if (stampField && claimedIds.size) {
    const stamped = await db.prospect.findMany({ where: { id: { in: [...claimedIds] } }, select: { id: true, [stampField]: true } });
    const doneIds = new Set(stamped.filter((p) => isDone(p[stampField], since)).map((p) => p.id));
    claimedDone = doneIds.size;
    for (const row of rows) if (row.tier === ENRICHMENT_TIERS.CLAIMED) row.done = doneIds.has(row.id);
  }
  for (const row of rows) {
    if (row.tier === ENRICHMENT_TIERS.NEXT_IN_TRADE) {
      row.done = Boolean((candidates[row.tradeKey] || []).find((c) => c.id === row.id)?.done);
    }
  }
  return {
    rows,
    claimed: { total: claimedIds.size, done: claimedDone },
    trades: trades
      .map((t) => ({ ...t, ...aheadOfDispatcher(candidates[t.tradeKey] || []) }))
      .sort((a, b) => new Date(b.lastWorkedAt || 0) - new Date(a.lastWorkedAt || 0)),
  };
}

function isDone(stamp, since) {
  if (!stamp) return false;
  const at = stamp instanceof Date ? stamp : new Date(stamp);
  if (Number.isNaN(at.getTime())) return false;
  return since ? at >= since : true;
}

/** The (tradeKey, city, province, country) pairs the order implies, most
 *  urgent first — what a bulk vendor run is keyed on. Pure. */
export function pairsFromRows(rows = [], prospectsById = new Map()) {
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const p = prospectsById.get(row.id);
    if (!p?.tradeKey || !p?.city || !p?.country) continue;
    const key = `${p.tradeKey}|${String(p.city).toLowerCase()}|${String(p.province || "").toLowerCase()}|${String(p.country).toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tradeKey: p.tradeKey, city: p.city, province: p.province || null, country: String(p.country).toUpperCase(), tier: row.tier, firstRank: row.rank });
  }
  return out;
}
