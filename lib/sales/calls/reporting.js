// lib/sales/calls/reporting.js
//
// The numbers a rep sees about themselves, a team lead sees about their line,
// and a superadmin sees about the floor — and the ones this build refuses to
// print.
//
// ══ Pure. Every row arrives as an argument ═════════════════════════════════
//
// No `@/lib/db` here, for the reason lib/sales/performance.js gives in the
// same words: it is what lets a check script execute every branch — a rep with
// one dial, a callback nobody kept, an attempt with no outcome, a row with a
// broken timestamp — without a database and without a fixture nobody
// maintains.
//
// ══ What is REUSED, so nothing here re-derives it ══════════════════════════
//
//   rate / rateStatement   lib/sales/performance.js. The floor that gates a
//                          rep's conversion rate is literally the same integer
//                          that gates their reported-reach rate, and a second
//                          floor would let the two screens disagree about when
//                          a number is safe to show.
//   describeDuration       ./agentState.js.
//   DISPOSITIONS           ./dispositions.js — the vocabulary, not a copy of it.
//
// ══ Talk time is real, on the calls that were measured, and on no others ═══
//
// A browser call is bridged through Twilio, which reports ring, answer, hangup
// and price. Those are measurements and this module prints them as such. A
// handset call — a rep tapping `tel:` on their own phone — is taken by the
// operating system and reported by nobody.
//
// Both exist in the same table, which is the whole hazard. A mean taken over
// every attempt would divide measured seconds by a count that includes calls
// nothing timed, and quietly halve the number. So EVERY duration this module
// returns travels with `measuredOf` / `measuredTotal`: the count it was
// actually computed from, and the count of calls in the period. A screen that
// prints the first without the second is printing an average of an unstated
// subset, and scripts/check-sales-call-handling.mjs asserts they travel
// together.
//
// Separately, `onCallMs` — time between a rep pressing dial and logging the
// outcome — is NOT talk time and is never labelled as one. It includes looking
// up the postcode and writing the note. It exists because it is the only
// figure available for handset rows, and because "time spent on this prospect"
// is a real coaching number in its own right.

import { rate, rateStatement } from "../performance";
import { agencyOf } from "@/lib/sales/agencyLabel";
import { DISPOSITIONS, DISPOSITION_ORDER, dispositionFor } from "./dispositions";
import { withoutTestDials } from "../testLines";
import { wasConnected } from "./conversation";
import { dialTableRow } from "./dialTable";
import { callbackState, inRange, isOutbound, when } from "./attemptRows";
import {
  PAUSE_REASONS,
  PAUSE_REASON_ORDER,
  activityTotals,
  describeDuration,
  pauseBreakdown,
} from "./agentState";

// isOutbound and callbackState moved to ./attemptRows.js on 2026-09-21 (its
// header says why: dialTable.js needs them and this file now needs
// dialTable.js). Re-exported so every caller's import still resolves.
export { callbackState, isOutbound };

/**
 * How the outcomes fell.
 *
 * ── `pending` is a first-class bucket, not a rounding error ──────────────
 *
 * An attempt with no disposition is a rep who dialled and never said what
 * happened. It is the single most useful number on a team lead's screen —
 * OMniLeads carries the same idea as a synthetic outcome for "connected and
 * the agent never dispositioned it" — and folding it into "no answer" would
 * hide a coaching problem inside a telephony statistic.
 *
 * Every known disposition is present with a zero. That IS a measurement here:
 * the vocabulary is closed, so an absent key is a counted zero rather than a
 * missing count. An outcome code the vocabulary does not know is counted in
 * `unknown` and never silently dropped — a row written by an older build is a
 * fact, and a fact we cannot read is not a fact we may delete.
 */
export function dispositionMix(attempts, { from = null, to = null } = {}) {
  if (!Array.isArray(attempts)) return null;
  const a = when(from);
  const b = when(to);

  const byCode = {};
  for (const code of DISPOSITION_ORDER) byCode[code] = 0;

  let total = 0;
  let pending = 0;
  let unknown = 0;
  let reached = 0;

  for (const row of attempts) {
    if ((a || b) && !inRange(row?.dialledAt, a, b)) continue;
    total += 1;
    const code = row?.disposition;
    if (!code) {
      pending += 1;
      continue;
    }
    const d = dispositionFor(code);
    if (!d) {
      unknown += 1;
      continue;
    }
    byCode[code] += 1;
    if (d.reached) reached += 1;
  }

  return {
    total,
    pending,
    unknown,
    reached,
    /** Dispositioned and readable. The denominator every rate below uses. */
    logged: total - pending - unknown,
    byCode,
    rows: DISPOSITION_ORDER.map((code) => ({
      code,
      label: DISPOSITIONS[code].label,
      count: byCode[code],
      reached: DISPOSITIONS[code].reached,
    })),
  };
}

/**
 * Durations the carrier actually reported, and how many calls they came from.
 *
 * ══ The denominator is not optional ════════════════════════════════════════
 *
 * `measuredOf` is the number of attempts in the period that carry a provider
 * figure; `total` is every attempt in it. A period of forty calls where six
 * were bridged has a real mean talk time over six calls and NOTHING to say
 * about the other thirty-four. Returning the mean alone would let a screen
 * present it as the floor's average, so it does not travel alone.
 *
 * `talkMs` is null — not zero — when nothing was measured. AGENTS.md failure
 * class 5, applied to the number most likely to be believed.
 *
 * Only ANSWERED calls contribute to the mean. A no-answer has a real billed
 * duration of zero seconds and including it would report a floor that talks
 * for nineteen seconds a call.
 */
export function measuredDurations(attempts, { from = null, to = null } = {}) {
  if (!Array.isArray(attempts)) return null;
  const a = when(from);
  const b = when(to);

  let total = 0;
  let bridged = 0;
  let answered = 0;
  let talkSeconds = 0;
  let holdSeconds = 0;
  let holdOf = 0;
  let costCents = 0;
  let costOf = 0;

  for (const row of attempts) {
    if ((a || b) && !inRange(row?.dialledAt, a, b)) continue;
    total += 1;
    if (row?.dialChannel === "browser") bridged += 1;

    const talk = Number.isFinite(row?.talkSeconds) ? row.talkSeconds : null;
    if (talk !== null && talk > 0) {
      answered += 1;
      talkSeconds += talk;
    }
    const hold = Number.isFinite(row?.holdSeconds) ? row.holdSeconds : null;
    if (hold !== null) {
      holdOf += 1;
      holdSeconds += hold;
    }
    const cost = row?.providerCostCents;
    const cents = cost === null || cost === undefined ? null : Number(cost);
    if (cents !== null && Number.isFinite(cents)) {
      costOf += 1;
      costCents += cents;
    }
  }

  return {
    total,
    bridged,
    /** Calls that were bridged AND answered — the only ones with talk time. */
    measuredOf: answered,
    talkMs: answered > 0 ? talkSeconds * 1000 : null,
    meanTalkMs: answered > 0 ? Math.round((talkSeconds * 1000) / answered) : null,
    meanTalkText: answered > 0 ? describeDuration(Math.round((talkSeconds * 1000) / answered)) : null,
    holdMs: holdOf > 0 ? holdSeconds * 1000 : null,
    holdOf,
    /** FieldQuo's own carrier spend on these calls. Null when none was reported. */
    costCents: costOf > 0 ? Math.round(costCents * 100) / 100 : null,
    costOf,
  };
}

/**
 * A gap between two dials longer than this is a break, not dialler time, and
 * is left out of the time-between-calls figure. Thirty minutes: longer than
 * any write-up, shorter than lunch. The count of gaps measured travels with
 * the figure so the exclusion is visible.
 */
export const DIALLER_GAP_BREAK_MS = 30 * 60 * 1000;

/** Below this much floor time, calls-per-hour is a projection, not a rate. */
export const DIALLER_MIN_FLOOR_MS = 15 * 60 * 1000;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * What the dialler did — the statistics the board refused until 2026-09-17,
 * when it said "FieldQuo has no dialler". lib/sales/autodial.js is one, a
 * progressive one, and these are its numbers, from the store:
 *
 *   source        autodial presses vs a rep's own, from `dialSource`; rows
 *                 written before the column existed are `unrecorded`, never
 *                 folded into manual.
 *   answered / rangOut / abandoned / open
 *                 bridged outbound calls only. `abandoned` is the progressive
 *                 dialler's analogue of a predictive dialler's abandon: the REP
 *                 hung up before anybody answered (hungUpBy "rep" and no
 *                 answer) — the one number the TCPA's abandon rule is about,
 *                 which a progressive dialler should keep near zero because a
 *                 human is on the line from the first ring.
 *   perFloorHour  dials per hour of floor time — available, on a call or
 *                 writing up; pauses excluded. Null without presence rows or
 *                 under DIALLER_MIN_FLOOR_MS of floor time.
 *   gap           time from one call ending (or, unmeasured, its dial) to the
 *                 next dial, median, with breaks over DIALLER_GAP_BREAK_MS
 *                 left out and the count of gaps measured beside it.
 *
 * @param attempts  outbound and inbound rows, in window, without test dials
 * @param times     activityTotals() for the same window, or null
 */
export function diallerStats(attempts, { times = null } = {}) {
  const rows = (Array.isArray(attempts) ? attempts : []).filter(isOutbound);
  const source = { autodial: 0, manual: 0, unrecorded: 0 };
  let browserPlaced = 0;
  let answered = 0;
  let rangOut = 0;
  let abandoned = 0;
  let open = 0;

  for (const row of rows) {
    if (row?.dialSource === "autodial") source.autodial += 1;
    else if (row?.dialSource === "manual") source.manual += 1;
    else source.unrecorded += 1;

    if (row?.dialChannel !== "browser") continue;
    browserPlaced += 1;
    const connected = wasConnected(row);
    if (connected === true) answered += 1;
    else if (connected === false) {
      if (row.hungUpBy === "rep") abandoned += 1;
      else rangOut += 1;
    } else open += 1;
  }

  // Gaps: sorted by dial time, one rep's rows (the caller scoped them).
  const timed = rows
    .map((r) => ({ at: when(r?.dialledAt), end: when(r?.endedAt) || when(r?.dispositionAt) || when(r?.dialledAt) }))
    .filter((r) => r.at)
    .sort((a, b) => a.at - b.at);
  const gaps = [];
  for (let i = 1; i < timed.length; i += 1) {
    const prevEnd = timed[i - 1].end && timed[i - 1].end <= timed[i].at ? timed[i - 1].end : timed[i - 1].at;
    const gap = timed[i].at - prevEnd;
    if (gap < 0 || gap > DIALLER_GAP_BREAK_MS) continue;
    gaps.push(gap);
  }
  const medianMs = median(gaps);

  const floorMs = times ? Math.max(0, (times.workingMs || 0) - (times.pausedMs || 0)) : null;
  const perFloorHour =
    floorMs !== null && floorMs >= DIALLER_MIN_FLOOR_MS
      ? Math.round((rows.length / (floorMs / 3_600_000)) * 10) / 10
      : null;

  return {
    placed: rows.length,
    browserPlaced,
    handsetPlaced: rows.length - browserPlaced,
    source,
    answered,
    rangOut,
    abandoned,
    open,
    floorMs,
    perFloorHour,
    gap: {
      medianMs,
      medianText: medianMs === null ? null : describeDuration(medianMs),
      measuredOf: gaps.length,
      breakMs: DIALLER_GAP_BREAK_MS,
    },
  };
}

/**
 * Everything one rep's own screen shows about their calling.
 *
 * `activity` may be null — the presence tables landing later than the attempt
 * tables is a real intermediate state, and the honest rendering of it is
 * "dials: 31, time on calls: not recorded", not "time on calls: 0".
 */
export function repCallStats({
  attempts = [],
  activity = null,
  from = null,
  to = new Date(),
  now = new Date(),
} = {}) {
  const a = when(from);
  const b = when(to);
  // A dial to one of FieldQuo's own test lines (lib/sales/testLines.js) is
  // dropped before anything is counted — dials, outcomes, durations, the
  // reach rate — whatever door the rows came in by. The console's own load
  // passes every row of the day so the panel can find an unlogged one; this
  // is where the stats stop seeing it.
  const inWindow = Array.isArray(attempts)
    ? withoutTestDials(attempts).filter((row) => !(a || b) || inRange(row?.dialledAt, a, b))
    : null;

  // Outcomes cover BOTH directions on purpose: a rep who takes a callback and
  // logs it as "reached, interested" has had exactly the conversation the mix
  // is counting, and excluding it would report their day as worse than it was.
  // Only the count of calls PLACED is direction-scoped — see isOutbound.
  const mix = dispositionMix(inWindow || []);
  const times = Array.isArray(activity) ? activityTotals(activity, { from: a, to: b }) : null;
  const pauses = Array.isArray(activity) ? pauseBreakdown(activity, { from: a, to: b }) : null;

  const placed = inWindow ? inWindow.filter(isOutbound) : null;
  const received = inWindow ? inWindow.filter((row) => !isOutbound(row)) : null;
  const dials = placed ? placed.length : null;

  // Reported, not measured, and the key says so. A rep chose this answer; the
  // network never told us. `reportedReachRate` cannot be renamed to
  // "connect rate" without the check script noticing.
  const reportedReachRate = mix ? rate(mix.reached, mix.logged) : null;

  return {
    period: { from: a, to: b },
    /** Calls this rep PLACED. Never inflated by a prospect ringing back. */
    dials,
    /** The dialler's own numbers — see diallerStats. */
    dialler: inWindow ? diallerStats(inWindow, { times }) : null,
    /**
     * The four measured buckets — Nobody answered · Hung up fast · Voicemail
     * or brief · Real conversation — over the calls this rep PLACED, joined
     * to the carrier by the prospect leg's sid and never by the line they
     * went out on, with the rep's own word, the lines used, the transcript's
     * count and the mean talk time over real conversations beside them.
     * lib/sales/calls/dialTable.js is the ONE definition; the floor board
     * and both performance pages print this same object, so a rep's day on
     * the floor and their week on the performance page cannot disagree
     * about what a "real conversation" is. It replaced two earlier figures
     * here on 2026-09-21: an "Answered (carrier)" rate that counted a
     * voicemail greeting, and a "Conversation (transcript)" rate that was
     * transcript COVERAGE printed as if it were conversations.
     */
    table: placed ? dialTableRow(placed, { now }) : null,
    /**
     * Calls that came back to them, on a number they called from. Its own
     * figure rather than a share of `dials`, because they are different work:
     * one is a rep making something happen and the other is one landing. Null
     * — not zero — when there were no attempts to read at all.
     */
    callbacksReceived: received ? received.length : null,
    dispositions: mix,
    /** Carrier-reported figures, with the count they were measured from. */
    measured: inWindow ? measuredDurations(inWindow) : null,
    reportedReachRate,
    reportedReachStatement: reportedReachRate ? rateStatement(reportedReachRate) : null,
    callbacks: inWindow ? callbackState(inWindow, now) : null,
    /** Null when the presence tables are absent. Never zero. */
    onCallMs: times ? times.onCallMs : null,
    afterCallMs: times ? times.afterCallMs : null,
    pausedMs: times ? times.pausedMs : null,
    workingMs: times ? times.workingMs : null,
    onCallText: times ? describeDuration(times.onCallMs) : null,
    pausedText: times ? describeDuration(times.pausedMs) : null,
    pauses: pauses
      ? {
          totalMs: pauses.totalMs,
          totalText: describeDuration(pauses.totalMs),
          unattributedMs: pauses.unattributedMs,
          /** Productive vs recreational, in ms and words — the split the board prints beside "Paused". */
          byType: Object.fromEntries(Object.entries(pauses.byType).map(([type, ms]) => [type, { ms, text: describeDuration(ms) }])),
          rows: PAUSE_REASON_ORDER.map((code) => ({
            code,
            label: PAUSE_REASONS[code].label,
            paid: PAUSE_REASONS[code].paid,
            type: PAUSE_REASONS[code].type,
            ms: pauses.byReason[code].ms,
            text: describeDuration(pauses.byReason[code].ms),
            count: pauses.byReason[code].count,
          })),
        }
      : null,
  };
}

/**
 * The team board's table: one row per rep, already scoped by the caller.
 *
 * Sorted by dials descending because that is the number a lead scans for, then
 * by name so the order is stable when two reps tie. Never sorted by a rate —
 * a rate with a suppressed value would sort as null and float somewhere
 * arbitrary, and sorting a coaching screen by a suppressed number is how the
 * floor learns to game the denominator.
 */
export function teamCallRows({
  reps = [],
  attempts = [],
  activity = [],
  presence = [],
  from = null,
  to = new Date(),
  now = new Date(),
} = {}) {
  const attemptsByRep = new Map();
  for (const row of withoutTestDials(attempts)) {
    if (!row?.salesRepId) continue;
    if (!attemptsByRep.has(row.salesRepId)) attemptsByRep.set(row.salesRepId, []);
    attemptsByRep.get(row.salesRepId).push(row);
  }
  const activityByRep = new Map();
  for (const row of activity) {
    if (!row?.salesRepId) continue;
    if (!activityByRep.has(row.salesRepId)) activityByRep.set(row.salesRepId, []);
    activityByRep.get(row.salesRepId).push(row);
  }
  const presenceByRep = new Map(
    (Array.isArray(presence) ? presence : []).map((p) => [p?.salesRepId, p?.presence || null]),
  );

  const rows = reps.map((rep) => ({
    id: rep.id,
    name: rep.name,
    agency: agencyOf(rep),
    active: Boolean(rep.active),
    presence: presenceByRep.get(rep.id) ?? null,
    stats: repCallStats({
      attempts: attemptsByRep.get(rep.id) || [],
      activity: activityByRep.get(rep.id) || null,
      from,
      to,
      now,
    }),
  }));

  rows.sort(
    (x, y) =>
      (y.stats.dials ?? 0) - (x.stats.dials ?? 0) ||
      String(x.name).localeCompare(String(y.name)),
  );
  return rows;
}

/**
 * Outcomes grouped by campaign or trade — OMniLeads's per-campaign disposition
 * histogram, done against FieldQuo's own shape.
 *
 * The caller attaches a `groupKey` and `groupLabel` to each attempt (from the
 * prospect's `campaignId` or `tradeKey`) because this module has no database
 * and must not guess which of the two a screen meant. Attempts with no group
 * are collected under a named "no campaign" bucket rather than dropped: a
 * hand-typed lead a rep rang is real work, and a report that silently omits it
 * under-counts the rep.
 */
export function campaignCallRows({ attempts = [], from = null, to = new Date() } = {}) {
  const a = when(from);
  const b = when(to);
  const groups = new Map();

  for (const row of withoutTestDials(attempts)) {
    if ((a || b) && !inRange(row?.dialledAt, a, b)) continue;
    const key = row?.groupKey || "__ungrouped__";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: row?.groupLabel || (key === "__ungrouped__" ? "No campaign — leads typed in by a rep" : key),
        attempts: [],
      });
    }
    groups.get(key).attempts.push(row);
  }

  const rows = [...groups.values()].map((g) => {
    const mix = dispositionMix(g.attempts);
    const reachRate = rate(mix.reached, mix.logged);
    return {
      key: g.key,
      label: g.label,
      // Placed, not received — the same rule repCallStats follows, said once
      // more here rather than shared, because sharing would mean this function
      // taking a pre-filtered array and losing the ability to count both.
      dials: g.attempts.filter(isOutbound).length,
      callbacksReceived: g.attempts.filter((row) => !isOutbound(row)).length,
      dispositions: mix,
      reportedReachRate: reachRate,
      reportedReachStatement: rateStatement(reachRate),
    };
  });

  rows.sort((x, y) => y.dials - x.dials || String(x.label).localeCompare(String(y.label)));
  return rows;
}

/**
 * What a call report deliberately does not print, and the missing input.
 *
 * Same shape and same discipline as lib/sales/performance.js's NOT_TRACKED and
 * lib/analytics/kpis.js's before it. Every one of these is a figure a call
 * report is normally expected to carry; a zero or a dash in its place would
 * read as a measurement of a very quiet phone.
 *
 * ── Four entries left this list on 2026-09-17, and the reasons are kept ───
 *
 * The owner reviewed the list and three of the five were stale, because the
 * things they said did not exist had been built the same week:
 *
 *   abandonRate           "FieldQuo has no dialler" — lib/sales/autodial.js is
 *                         one. diallerStats() prints its numbers now.
 *   connectRate           the transcript is the third fact the refusal said
 *                         was missing — lib/sales/calls/conversation.js.
 *   voicemail             lib/sales/calls/voicemail.js, /sales/voicemail, and
 *                         the floor's own inbound table play them.
 *   costPerConversation   the objection was a self-reported denominator; the
 *                         denominator is the transcript's now, and the
 *                         numerator is lib/sales/calls/costs.js.
 *
 * One remains, and it is not going anywhere: nothing can time a call the
 * operating system placed.
 */
export const NOT_TRACKED_CALLS = Object.freeze([
  {
    key: "handsetDurations",
    label: "Talk time on calls placed from a rep's own phone",
    reason:
      "A handset dial is a tel: handoff — the operating system takes the call and FieldQuo never learns it was answered, let alone for how long. Those rows are excluded from every duration rather than counted as zero, and the count they were excluded from is printed beside the figure. Bridging the call through the browser is what makes it measurable, and only for calls placed that way.",
  },
]);
