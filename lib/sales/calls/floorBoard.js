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
import { NOT_TRACKED_CALLS, campaignCallRows, diallerStats, teamCallRows } from "./reporting";
import { dialTableRow } from "./dialTable";
import { PAUSE_REASONS, REP_STATES, STATE_ORDER, activityTotals } from "./agentState";
import { anyRepLive } from "./inboundRouting";
import { connectFigures } from "./conversation";
import { attemptCosts, costPerConversation } from "./costs";
import { DISCOVERY_TRADES } from "../discovery/trades";
import { NO_REP } from "../team";
import { prospectDialsOnly } from "../testLines";
import { LIVE_CALL_WINDOW_MINUTES, isLiveCall } from "./liveCall";
import { loadSupervisionSettings } from "./supervisionStore";
import { loadFloorSettings } from "./floorSettingsStore";
import { PRESENCE_OFF_MINUTES } from "./agentState";

/**
 * How far back the day's figures run. UTC midnight, matching bucketSignups.
 *
 * The board is the DAY view and this is its window — printed on both
 * screens as "Today, since <time>" in the viewer's own clock (a Montreal
 * screen reads "since 20:00 yesterday" for a UTC day, and says so rather
 * than letting the reader assume midnight). Kept as it is: the day the
 * performance page's presets cut on is the same UTC day, so "today" on the
 * floor and "today" in a period agree.
 */
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
 * @param repIds     null for the whole floor; otherwise the ids the viewer may see.
 * @param withCosts  read FieldQuo's own spend on the day's calls (the AI
 *                   ledger) and print cost per conversation. The platform
 *                   route asks; the agency route does not — what FieldQuo
 *                   pays Twilio is nobody else's business, and the read is
 *                   skipped rather than the field hidden.
 * @returns the board — `store.ready: false` carries the reps and nothing
 *          else, so the screen names what is missing rather than drawing a
 *          very quiet Tuesday.
 */
export async function floorBoard({ repIds = null, now = new Date(), client = db, withCosts = false } = {}) {
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

  // The write-up window and the outcome rule, read once for the board:
  // presenceFor() derives every rep's state from them, and the screen
  // prints them beside the Off rule so a supervisor reading "Busy · writing
  // it up 0:41" knows where the clock came from.
  const settings = await loadFloorSettings({ client });
  const [attempts, activity, presence] = await Promise.all([
    client.salesCallAttempt.findMany({
      // A dial to one of FieldQuo's own test lines (lib/sales/testLines.js)
      // is left out here AND again in reporting.js, so the board cannot
      // count one through either door.
      where: prospectDialsOnly({ salesRepId: { in: ids }, dialledAt: { gte: from } }),
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
    presenceFor(ids, { now, client, settings }),
  ]);

  const rows = teamCallRows({ reps, attempts, activity, presence, from, to, now });

  // ── The call each rep is on RIGHT NOW, as the carrier and the row know it ─
  //
  // Read apart from the day's counted attempts, and WITHOUT the prospect
  // filter: a colleague call or an off-campaign dial is not reach, but a rep
  // on one is on a call, and the board says which. lib/sales/calls/
  // liveCall.js decides "live" per row; this only fetches candidates from
  // the same fifteen-minute window. What the supervision buttons need is
  // here — the attempt id, whether it is in a conference, whether it is
  // held, who (if anybody) is on it — and none of it is inferred from
  // presence, which is a declaration.
  const liveRows = await client.salesCallAttempt
    .findMany({
      where: {
        OR: [{ salesRepId: { in: ids } }, { answeredByRepId: { in: ids } }],
        dialledAt: { gte: new Date(now.getTime() - LIVE_CALL_WINDOW_MINUTES * 60 * 1000), lte: now },
        endedAt: null,
      },
      select: {
        id: true,
        salesRepId: true,
        answeredByRepId: true,
        direction: true,
        dialledAt: true,
        endedAt: true,
        dialChannel: true,
        hungUpBy: true,
        providerStatus: true,
        kind: true,
        internalToRepId: true,
        conferenceName: true,
        heldAt: true,
        supervisedBy: true,
        supervisionKind: true,
        supervisedAt: true,
        supervisorCallSid: true,
        toE164: true,
      },
      orderBy: { dialledAt: "desc" },
    })
    .catch(() => []);
  const supervisorIds = [...new Set(liveRows.map((r) => r.supervisedBy).filter(Boolean))];
  const supervisors = supervisorIds.length
    ? await client.platformAdmin.findMany({ where: { id: { in: supervisorIds } }, select: { id: true, email: true } }).catch(() => [])
    : [];
  const supervisorName = new Map(supervisors.map((a) => [a.id, a.email ? a.email.split("@")[0] : null]));
  const colleagueName = new Map(reps.map((r) => [r.id, r.name]));
  const liveByRep = new Map();
  for (const rep of reps) {
    const row = liveRows.find((r) => isLiveCall(r, { repId: rep.id, now }));
    if (!row) continue;
    liveByRep.set(rep.id, {
      attemptId: row.id,
      direction: row.direction,
      kind: row.kind || "prospect",
      internalTo: row.internalToRepId ? { id: row.internalToRepId, name: colleagueName.get(row.internalToRepId) || null } : null,
      conference: Boolean(row.conferenceName),
      // A leg the bridge has not recorded yet, or an inbound call: nothing
      // to coach. Said as a fact so the buttons are not drawn.
      supervisable: Boolean(row.conferenceName) && row.direction === "out" && row.kind !== "internal",
      held: Boolean(row.heldAt),
      heldAt: row.heldAt ? new Date(row.heldAt).toISOString() : null,
      supervision: row.supervisedBy
        ? {
            adminId: row.supervisedBy,
            name: supervisorName.get(row.supervisedBy) || null,
            kind: row.supervisionKind,
            since: row.supervisedAt ? new Date(row.supervisedAt).toISOString() : null,
            joined: Boolean(row.supervisorCallSid),
          }
        : null,
      dialledAt: new Date(row.dialledAt).toISOString(),
    });
  }
  for (const r of rows) r.liveCall = liveByRep.get(r.id) || null;
  const supervision = await loadSupervisionSettings({ client }).catch(() => ({ enabled: false, tellRepOnListen: true, holdMusicUrl: null }));

  const grouped = attempts.map((a) => ({
    ...a,
    groupKey: a.prospect?.tradeKey || null,
    groupLabel: a.prospect?.tradeKey
      ? DISCOVERY_TRADES[a.prospect.tradeKey]?.label || a.prospect.tradeKey
      : null,
  }));

  // Is anybody actually reachable? The phone's own answer (inboundRouting.js
  // anyRepLive) over the same derived presence rows the board is drawn
  // from, so the two cannot disagree — and a present rep with no ledger
  // row counts, as they do for the ring plan.
  const anyLive = anyRepLive(presence);

  // ── The floor's dialler, buckets and cost figures, over everybody ───────
  //
  // The same functions the per-rep stats use, over the union — not a sum of
  // the per-rep rows, because a rate summed is not a rate. Test dials are
  // already out (the query above). Floor time is the sum of every rep's.
  //
  // `table` is lib/sales/calls/dialTable.js over every attempt on the board
  // today — the same four buckets, the same one denominator and the same
  // red rule the performance page prints, and the same object each rep's
  // `stats.table` is. It replaced a `connect` block (carrier answer rate,
  // transcript coverage rate) on 2026-09-21; that file's header has the
  // owner's reading of the old card.
  const times = activityTotals(activity, { from, to });
  const dialler = diallerStats(attempts, { times });
  const table = dialTableRow(attempts, { now });

  let cost = null;
  if (withCosts) {
    const browserRows = attempts.filter((a) => a.dialChannel === "browser");
    const { period } = await attemptCosts(browserRows, { client });
    // The transcript's conversation count (conversation.js) is the
    // denominator here on purpose and is labelled as such in the
    // definition: a cost per conversation over the clock's minute would
    // price a long voicemail as a conversation.
    const browserConnect = connectFigures(browserRows);
    cost = {
      ...period,
      perConversation: costPerConversation({
        knownCents: period.knownCents,
        conversations: browserConnect.conversations,
        unknownCalls: period.unknownCalls,
        unknownConversations: browserConnect.unknown,
      }),
      definition: `Today's browser calls — carrier price + recording + transcription + QA scoring, each from its own ledger — divided by conversations (a connected call on which the contractor said ${browserConnect.minContractorWords}+ words, from the transcript). Handset calls are not in it: nothing measured them.`,
    };
  }

  return {
    ...base,
    reps: rows,
    campaigns: campaignCallRows({ attempts: grouped, from, to }),
    presence,
    anyLive,
    dialler,
    table,
    cost,
    /** The floor's tunables and the Off rule, for the screen's settings card and its legend. */
    settings: { ...settings, offAfterMinutes: PRESENCE_OFF_MINUTES },
    // Whether the floor's Listen / Whisper / Barge / Take buttons can work
    // at all today, said once so the screen explains an absence rather
    // than drawing a dead control. The prices are on the setting's card.
    supervision: { enabled: supervision.enabled, tellRepOnListen: supervision.tellRepOnListen },
  };
}
