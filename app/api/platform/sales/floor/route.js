// app/api/platform/sales/floor/route.js
//
// The sales floor, live: who is on a call, who is writing one up, who is
// paused and for how long — and what the day's calls actually came to.
//
// ══ Read-only, and superadmin-only ════════════════════════════════════════
//
// Behind the platform-token check in middleware.js and checked again here,
// because hiding a screen is not access control. Tighter than a plain admin
// read for the same reason /api/platform/sales/performance is: this returns
// every rep's activity, their pause reasons and what they said happened on
// each call. `admin.role !== "superadmin"` is tested directly rather than
// through a permission key, following the precedent
// app/api/platform/sales/reps/route.js sets and explains — PLATFORM_PERMISSIONS
// has no sales permission, and adding one would imply the map has a scoping
// concept it does not have.
//
// ══ Why there is no team-lead version of this yet ═════════════════════════
//
// The column arrived and the tier did not. `SalesRep.managerId` landed on
// 2026-09-03, so "my reps" is now COMPUTABLE — but nothing computes it: no
// query reads the reporting line, and no screen sets one, so every SalesRep in
// the database currently has a null manager. The scope function that would do
// the narrowing is written and tested, lib/sales/team.js's visibleRepIds(),
// and it still has no caller.
//
// Wiring it up here before there is a way to fill the column in would ship a
// board that shows a team lead an empty team and calls it their floor — worse
// than no board, and the exact failure AGENTS.md's rule is about. So this stays
// superadmin-only until the org chart can actually be edited.
//
// ══ Nothing here is invented when the tables are absent ═══════════════════
//
// The store is probed, not asserted. Without SalesCallAttempt and
// SalesRepActivity this returns `store.ready: false` and the screen says what
// is missing — a floor board full of zeroes reads as a very quiet Tuesday.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { callStoreState, presenceFor } from "@/lib/sales/calls/store";
import { NOT_TRACKED_CALLS, campaignCallRows, teamCallRows } from "@/lib/sales/calls/reporting";
import { PAUSE_REASONS, REP_STATES, STATE_ORDER } from "@/lib/sales/calls/agentState";
import { TEAM_LEAD_CANNOT_SEE } from "@/lib/sales/team";
import { dialModeState } from "@/lib/sales/calls/dialMode";
import { inboundHandling } from "@/lib/sales/calls/inboundMatch";
import { salesAgentRow } from "@/lib/platform/salesAgent";
import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";

/** How far back the day's figures run. UTC, matching bucketSignups. */
function dayBounds(now) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { from, to: now };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can see the sales floor" },
      { status: 403 },
    );
  }

  const now = new Date();
  const { from, to } = dayBounds(now);
  const store = callStoreState();

  const reps = await db.salesRep.findMany({
    where: { active: true },
    select: { id: true, name: true, active: true },
    orderBy: { name: "asc" },
  });
  const repIds = reps.map((r) => r.id);

  if (!store.ready) {
    return NextResponse.json({
      store,
      period: { from, to },
      // The reps are real and are returned. The COLUMNS are what is missing,
      // and the screen renders the names with the reason beside them rather
      // than an empty table that reads as "nobody works here".
      reps: reps.map((r) => ({ id: r.id, name: r.name, active: r.active, presence: null, stats: null })),
      states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
      pauseReasons: Object.values(PAUSE_REASONS),
      campaigns: null,
      inbound: null,
      dialMode: dialModeState(),
      notTracked: NOT_TRACKED_CALLS,
      teamLeadCannotSee: TEAM_LEAD_CANNOT_SEE,
      serverNow: now.toISOString(),
    });
  }

  const [attempts, activity, presence, agent] = await Promise.all([
    db.salesCallAttempt.findMany({
      where: { salesRepId: { in: repIds }, dialledAt: { gte: from } },
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
    db.salesRepActivity.findMany({
      where: { salesRepId: { in: repIds }, startedAt: { gte: from } },
      orderBy: { startedAt: "asc" },
    }),
    presenceFor(repIds, { now }),
    salesAgentRow().catch(() => null),
  ]);

  const rows = teamCallRows({ reps, attempts, activity, presence, from, to, now });

  const grouped = attempts.map((a) => ({
    ...a,
    groupKey: a.prospect?.tradeKey || null,
    groupLabel: a.prospect?.tradeKey
      ? DISCOVERY_TRADES[a.prospect.tradeKey]?.label || a.prospect.tradeKey
      : null,
  }));

  // Is anybody actually reachable behind the inbound agent? Computed from the
  // same presence rows the board is drawn from, so the two cannot disagree.
  const anyLive = presence
    ? presence.some((p) => p.presence?.everSeen && !p.presence.stale && REP_STATES[p.presence.state]?.live)
    : null;

  return NextResponse.json({
    store,
    period: { from, to },
    reps: rows,
    states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
    pauseReasons: Object.values(PAUSE_REASONS),
    campaigns: campaignCallRows({ attempts: grouped, from, to }),
    inbound: inboundHandling({
      agentEnabled: Boolean(agent?.enabled),
      canTransfer: Boolean(process.env.FIELDQUO_SALES_TRANSFER_TO),
      anyRepLive: anyLive,
    }),
    dialMode: dialModeState(),
    notTracked: NOT_TRACKED_CALLS,
    teamLeadCannotSee: TEAM_LEAD_CANNOT_SEE,
    serverNow: now.toISOString(),
  });
}
