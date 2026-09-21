// lib/sales/pipeline/recrawl.js
//
// The standing re-crawl: a second look at the websites that matter now,
// ahead of the reps, at a bounded cost — and the console's count of it.
//
// ══ What was true before ══════════════════════════════════════════════════
//
// The crawler could re-crawl (lib/sales/crawl/policy.js recrawlDecision,
// MIN_RECRAWL_MS = 30 days) and could tell an unchanged site from a changed
// one (fingerprint.js, Prospect.contentHash). Nothing ever asked it to.
// research.js queued CRAWL_WEBSITE only for a row with no lastCrawledAt, so
// every site was read exactly once, in the state it was in that week. The
// owner: "is the web crawler able to reassess if the website is changed?"
//
// ══ Which rows, and why not the pool ══════════════════════════════════════
//
// The shared enrichment order (lib/sales/intel/enrichmentOrder.js): the
// rows reps HOLD, in their queue order, then the rows next in dispatch in
// the trades being worked. Never the rest. A re-crawl is a crawl — robots,
// up to six pages, three seconds between each — and 46,000 sites with a
// URL, again every month, is 1,500 a day for rows nobody will dial this
// quarter. The order is what "matters now" already means to the register
// lookup and the BBB batch; the crawler walks the same list.
//
// ══ The cap ═══════════════════════════════════════════════════════════════
//
// Twenty a tick. The number was the Google Places sweep's SWEEP_PER_TICK,
// chosen for a reason that outlived the sweep (retired 2026-09-20 —
// lib/sales/intel/places.js's header): a tick is one invocation of a cron
// that fires every minute, and the hour's total is what bounds the work,
// not the tick. Twenty crawls a minute is 1,200 an
// hour at most — above the drain's own crawl rate (research.js's
// arithmetic: ~840 an hour at the run's wall clock), so the queue fills and
// the drain, not this file, sets the pace. RECRAWL_PENDING_CEILING keeps
// the queued re-crawls from piling up while it does.
//
// ══ Lanes ═════════════════════════════════════════════════════════════════
//
// A held row is queued in the claimed lane — a rep is dialling it — and
// phrased, exactly as the claim route queues research today. A next-in-
// dispatch row goes to the backlog lane: `phrase: false` rides the chain,
// so a changed site costs the local stages and a plain brief, and no model
// is asked until somebody claims it. An unchanged site costs the crawl and
// nothing else (crawlWebsite.js `advance: false`).
//
// ══ Idempotent ════════════════════════════════════════════════════════════
//
// A row with a CRAWL_WEBSITE task queued or running is not offered again
// (the sweep filters them out before the planner sees them, so the tick's
// budget is spent on rows that need it), and research.js's own key dedupes
// two callers arriving together. The planner's recrawlDue() refuses a row
// crawled inside the interval and a row tried inside the interval — so a
// refusal is retried once a month, not once a minute.
import { db as defaultDb } from "@/lib/db";
import { MIN_RECRAWL_MS } from "@/lib/sales/crawl/policy";
import { ENRICHMENT_TIERS, loadEnrichmentOrder } from "@/lib/sales/intel/enrichmentOrder";
import { ensureResearchQueued } from "./research";

/** Re-crawls queued per cron tick, across both tiers. The header says why
 *  twenty. */
export const RECRAWL_PER_TICK = 20;

/** Queued-or-running re-crawls above which a tick adds none. Ten ticks'
 *  worth: enough that the drain never starves between ticks, small enough
 *  that a stalled drain does not bank a day of crawls nobody asked for. */
export const RECRAWL_PENDING_CEILING = 200;

/** The clock hour `now` falls in, for the console's "this hour" line. */
const HOUR_MS = 60 * 60 * 1000;

const LIVE = ["queued", "claimed"];

/**
 * Which rows of the order this tick queues, and in which lane. Pure.
 *
 * @param rows     loadEnrichmentOrder rows with `done` = crawled inside the
 *                 interval, plus `lastCrawledAt` (the sweep attaches it)
 * @param live     prospect ids with a CRAWL_WEBSITE task queued or running
 * @param pending  how many re-crawls are queued or running right now
 * @returns { room, due, claimed: [id], nextInTrade: [id], skipped: { live } }
 */
export function planRecrawlTick({ rows = [], live = [], pending = 0, perTick = RECRAWL_PER_TICK, ceiling = RECRAWL_PENDING_CEILING } = {}) {
  const waiting = Math.max(0, Math.floor(Number(pending) || 0));
  const room = Math.max(0, Math.min(Math.floor(Number(perTick) || 0), Math.floor(Number(ceiling) || 0) - waiting));
  const inFlight = new Set(Array.isArray(live) ? live : []);
  const out = { room, due: 0, claimed: [], nextInTrade: [], skipped: { live: 0 } };
  for (const row of Array.isArray(rows) ? rows : []) {
    // Never crawled is the first-crawl path's (research.js, the claim
    // route, the backlog top-up). This file only ever asks for a SECOND
    // look, so a row with no first one is not its business.
    if (!row?.id || !row.lastCrawledAt || row.done) continue;
    out.due += 1;
    if (inFlight.has(row.id)) {
      out.skipped.live += 1;
      continue;
    }
    if (out.claimed.length + out.nextInTrade.length >= room) continue;
    if (row.tier === ENRICHMENT_TIERS.CLAIMED) out.claimed.push(row.id);
    else out.nextInTrade.push(row.id);
  }
  return out;
}

/**
 * One tick of the standing job. Called once per run of
 * /api/cron/sales-pipeline, after the drain.
 *
 * @returns { due, pending, room, queued: { claimed, nextInTrade }, skipped }
 */
export async function sweepRecrawls({ db = defaultDb, now = new Date(), perTick = RECRAWL_PER_TICK, ceiling = RECRAWL_PENDING_CEILING } = {}) {
  const since = new Date(now.getTime() - MIN_RECRAWL_MS);
  const [order, pending] = await Promise.all([
    loadEnrichmentOrder({ db, now, stampField: "lastCrawledAt", since }),
    db.salesPipelineTask.count({
      where: { kind: "CRAWL_WEBSITE", status: { in: LIVE }, payload: { path: ["recrawl"], equals: true } },
    }),
  ]);

  // loadEnrichmentOrder reports the stamp as `done` per row but keeps the
  // column itself on the candidate rows only; the claimed tier is stamped
  // from a second read. Re-read the column for every row that is not done
  // so the plan can tell "never crawled" (not ours) from "crawled, due".
  const undone = order.rows.filter((r) => !r.done).map((r) => r.id);
  const stamped = undone.length
    ? await db.prospect.findMany({ where: { id: { in: undone } }, select: { id: true, lastCrawledAt: true } })
    : [];
  const stampById = new Map(stamped.map((p) => [p.id, p.lastCrawledAt]));
  const rows = order.rows.map((r) => ({ ...r, lastCrawledAt: stampById.get(r.id) ?? null }));

  const dueIds = rows.filter((r) => !r.done && r.lastCrawledAt).map((r) => r.id);
  const live = dueIds.length
    ? (
        await db.salesPipelineTask.findMany({
          where: { kind: "CRAWL_WEBSITE", status: { in: LIVE }, prospectId: { in: dueIds } },
          select: { prospectId: true },
        })
      ).map((t) => t.prospectId)
    : [];

  const plan = planRecrawlTick({ rows, live, pending, perTick, ceiling });
  const result = { due: plan.due, pending, room: plan.room, queued: { claimed: 0, nextInTrade: 0 }, skipped: plan.skipped };
  if (plan.claimed.length) {
    const r = await ensureResearchQueued({ db, prospectIds: plan.claimed, priority: "claimed", recrawl: true, now });
    result.queued.claimed = r.prospects.filter((p) => p.queued.includes("CRAWL_WEBSITE")).length;
  }
  if (plan.nextInTrade.length) {
    const r = await ensureResearchQueued({ db, prospectIds: plan.nextInTrade, priority: "backlog", recrawl: true, now });
    result.queued.nextInTrade = r.prospects.filter((p) => p.queued.includes("CRAWL_WEBSITE")).length;
  }
  return result;
}

/**
 * What a settled re-crawl task found. Pure.
 *
 * The runner keeps the handler's note in `lastError` on a done row
 * (runner.js completeTask), and crawlWebsite.js leads its note with the
 * crawler's outcome word — `crawled` (changed), `unchanged`, `skipped`
 * (somebody else crawled it first). A failed or abandoned row is
 * `failed`; a queued or claimed one is `waiting`.
 */
export function recrawlOutcome(task) {
  const status = task?.status;
  if (status === "queued" || status === "claimed") return "waiting";
  if (status !== "done") return "failed";
  const note = String(task?.lastError || "");
  if (/^crawled\b/.test(note)) return "changed";
  if (/^unchanged\b/.test(note)) return "unchanged";
  if (/^skipped\b/.test(note)) return "skipped";
  return "done";
}

/**
 * The console's numbers, from re-crawl task rows. Pure.
 *
 * "The last run" is the newest minute in which any re-crawl was queued —
 * a cron tick — and the counts are what those tasks have found so far.
 * The 24-hour line is the same tally over a day, so a tick that queued
 * three rows does not read as the whole picture.
 *
 * @param tasks  CRAWL_WEBSITE rows with payload.recrawl, any status
 */
export function recrawlReport({ tasks = [], now = new Date() } = {}) {
  const empty = () => ({ queued: 0, waiting: 0, unchanged: 0, changed: 0, skipped: 0, failed: 0 });
  const tally = (list) => {
    const t = empty();
    for (const task of list) {
      t.queued += 1;
      const outcome = recrawlOutcome(task);
      if (outcome in t) t[outcome] += 1;
    }
    return t;
  };
  const rows = (Array.isArray(tasks) ? tasks : []).filter((t) => t?.createdAt);
  const dayAgo = now.getTime() - 24 * HOUR_MS;
  const last24h = rows.filter((t) => new Date(t.createdAt).getTime() >= dayAgo);

  const newest = rows.reduce((max, t) => Math.max(max, new Date(t.createdAt).getTime()), 0);
  const minute = newest ? Math.floor(newest / 60_000) * 60_000 : null;
  const lastRun = minute == null ? null : rows.filter((t) => Math.floor(new Date(t.createdAt).getTime() / 60_000) * 60_000 === minute);

  return {
    lastRun: lastRun ? { at: new Date(minute).toISOString(), ...tally(lastRun) } : null,
    last24h: tally(last24h),
  };
}

/**
 * Where the re-crawl stands, for /platform/sales/prospects' enrichment
 * panel: how many rows in the order are due a second look right now, how
 * many re-crawls are waiting, and what the last run and the last day found.
 */
export async function recrawlStatus({ db = defaultDb, now = new Date() } = {}) {
  const since = new Date(now.getTime() - MIN_RECRAWL_MS);
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS);
  const [order, tasks] = await Promise.all([
    loadEnrichmentOrder({ db, now, stampField: "lastCrawledAt", since }),
    db.salesPipelineTask.findMany({
      where: {
        kind: "CRAWL_WEBSITE",
        payload: { path: ["recrawl"], equals: true },
        OR: [{ createdAt: { gte: dayAgo } }, { status: { in: LIVE } }],
      },
      select: { id: true, prospectId: true, status: true, lastError: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2_000,
    }),
  ]);
  const undone = order.rows.filter((r) => !r.done).map((r) => r.id);
  const stamped = undone.length
    ? await db.prospect.findMany({ where: { id: { in: undone } }, select: { id: true, lastCrawledAt: true } })
    : [];
  const crawledOnce = new Set(stamped.filter((p) => p.lastCrawledAt).map((p) => p.id));
  const due = { claimed: 0, nextInTrade: 0 };
  for (const row of order.rows) {
    if (row.done || !crawledOnce.has(row.id)) continue;
    if (row.tier === ENRICHMENT_TIERS.CLAIMED) due.claimed += 1;
    else due.nextInTrade += 1;
  }
  const report = recrawlReport({ tasks, now });
  return {
    due,
    inOrder: order.rows.length,
    waiting: tasks.filter((t) => LIVE.includes(t.status)).length,
    perTick: RECRAWL_PER_TICK,
    ceiling: RECRAWL_PENDING_CEILING,
    intervalDays: Math.round(MIN_RECRAWL_MS / (24 * HOUR_MS)),
    ...report,
  };
}
