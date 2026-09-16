// lib/sales/calls/floorBoard.js
//
// The floor board's data, for a scope: who is on a call, who is paused and
// for how long, what the day's calls came to, by rep and by trade.
//
// ══ Why it left app/api/platform/sales/floor/route.js ═════════════════════
//
// That route's header said, for two weeks, why there was no team-lead
// version of the board: `SalesRep.managerId` existed, nothing filled it in,
// and "wiring it up before there is a way to fill the column in would ship a
// board that shows a team lead an empty team and calls it their floor". On
// 2026-09-16 the column got its first writer — a call-centre agency adds its
// own reps with itself as their manager (lib/sales/agency.js) — so the
// narrowing lib/sales/team.js was written for finally has rows to narrow.
//
// The reads moved here so the two callers cannot drift: the platform route
// asks with no scope (a superadmin sees the floor) and adds FieldQuo's own
// inbound line and number pool, which are nobody else's business; the
// agency route asks with visibleRepIds(repViewer(agency, team)) and gets
// exactly its team. Neither builds a query of its own.
//
// ══ The scope is a list or nothing ════════════════════════════════════════
//
// `repIds: null` means every active rep and is the PLATFORM's answer; a
// caller narrowing a team passes the list visibleRepIds produced, which is
// never empty — lib/sales/team.js returns `[NO_REP]` rather than `[]` for
// exactly this reason, and `NO_REP` matches no row. An empty array here is
// treated the same way, as "nobody", never as "everyone".
import { db } from "@/lib/db";
import { callStoreState, presenceFor } from "./store";
import { NOT_TRACKED_CALLS, campaignCallRows, teamCallRows } from "./reporting";
import { PAUSE_REASONS, REP_STATES, STATE_ORDER } from "./agentState";
import { DISCOVERY_TRADES } from "../discovery/trades";
import { NO_REP } from "../team";

/** How far back the day's figures run. UTC, matching bucketSignups. */
export function dayBounds(now) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { from, to: now };
}

/** The WHERE for the reps on the board. `null` scope = every active rep. */
export function boardRepWhere(repIds) {
  if (repIds === null || repIds === undefined) return { active: true };
  const ids = Array.isArray(repIds) ? repIds.filter((id) => typeof id === "string" && id) : [];
  // Nobody, said explicitly: an `in: []` is what Prisma would do with an
  // empty list anyway, but writing the sentinel makes the intent readable
  // in a check script's recorded query.
  return { active: true, id: { in: ids.length ? ids : [NO_REP] } };
}

/**
 * @param repIds  null for the whole floor; otherwise the ids the viewer may see.
 * @returns the board — `store.ready: false` carries the reps and nothing
 *          else, so the screen names what is missing rather than drawing a
 *          very quiet Tuesday.
 */
export async function floorBoard({ repIds = null, now = new Date(), client = db } = {}) {
  const { from, to } = dayBounds(now);
  const store = callStoreState(client);

  const reps = await client.salesRep.findMany({
    where: boardRepWhere(repIds),
    select: { id: true, name: true, active: true, engagement: true, manager: { select: { id: true, kind: true, name: true } } },
    orderBy: { name: "asc" },
  });
  const ids = reps.map((r) => r.id);

  const base = {
    store,
    period: { from, to },
    states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
    pauseReasons: Object.values(PAUSE_REASONS),
    notTracked: NOT_TRACKED_CALLS,
    serverNow: now.toISOString(),
  };

  if (!store.ready) {
    return {
      ...base,
      // The reps are real and are returned. The COLUMNS are what is missing,
      // and the screen renders the names with the reason beside them rather
      // than an empty table that reads as "nobody works here".
      reps: reps.map((r) => ({ id: r.id, name: r.name, active: r.active, presence: null, stats: null })),
      campaigns: null,
      presence: null,
      anyLive: null,
    };
  }

  const [attempts, activity, presence] = await Promise.all([
    client.salesCallAttempt.findMany({
      where: { salesRepId: { in: ids }, dialledAt: { gte: from } },
      orderBy: { dialledAt: "desc" },
      include: {
        // The trade is what a campaign report groups by here. Read through the
        // prospect rather than copied onto the attempt: a trade is a fact about
        // the business, and freezing it onto every call would make a
        // reclassification invisible in yesterday's report and present in
        // today's, for the same prospect.
        prospect: { select: { tradeKey: true } },
      },
    }),
    client.salesRepActivity.findMany({
      where: { salesRepId: { in: ids }, startedAt: { gte: from } },
      orderBy: { startedAt: "asc" },
    }),
    presenceFor(ids, { now, client }),
  ]);

  const rows = teamCallRows({ reps, attempts, activity, presence, from, to, now });

  const grouped = attempts.map((a) => ({
    ...a,
    groupKey: a.prospect?.tradeKey || null,
    groupLabel: a.prospect?.tradeKey
      ? DISCOVERY_TRADES[a.prospect.tradeKey]?.label || a.prospect.tradeKey
      : null,
  }));

  // Is anybody actually reachable? Computed from the same presence rows the
  // board is drawn from, so the two cannot disagree.
  const anyLive = presence
    ? presence.some((p) => p.presence?.everSeen && !p.presence.stale && REP_STATES[p.presence.state]?.live)
    : null;

  return {
    ...base,
    reps: rows,
    campaigns: campaignCallRows({ attempts: grouped, from, to }),
    presence,
    anyLive,
  };
}
