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
import { DISPOSITIONS, DISPOSITION_ORDER, dispositionFor } from "./dispositions";
import {
  PAUSE_REASONS,
  PAUSE_REASON_ORDER,
  activityTotals,
  describeDuration,
  pauseBreakdown,
} from "./agentState";

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Did FieldQuo place this call?
 *
 * ══ Why every count of WORK filters on this ═══════════════════════════════
 *
 * SalesCallAttempt holds both directions now — app/api/rep-dial/inbound writes
 * a row when a contractor rings a sales_voice number back. A contractor
 * ringing three times is three rows in the same table as three dials, and a
 * `dials` figure computed over the lot would report a rep as having worked
 * calls they never placed. It would flatter exactly the rep whose prospects
 * chase them, which is the wrong direction for a coaching number to lie in.
 *
 * Anything OTHER than the literal "in" counts as outbound, deliberately: rows
 * written before the column had a second value carry the "out" default, and a
 * row with an unreadable direction is far more likely to be an old dial than a
 * callback. Failing that way round undercounts nothing.
 */
function isOutbound(row) {
  return row?.direction !== "in";
}

function inRange(at, from, to) {
  const d = when(at);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

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
 * Callbacks: booked, still ahead, and overdue.
 *
 * "Kept" is deliberately NOT here. Keeping a callback means dialling the same
 * number again after the promised time, and while two Prospect rows may share
 * one number (dedupe flags rather than merges) that match is a heuristic, not
 * a fact. What IS a fact is that a callback time has passed and no later
 * attempt to that number exists — that is `overdue`, it is exactly what a rep
 * needs to see, and it makes no claim about intent.
 */
export function callbackState(attempts, now = new Date()) {
  if (!Array.isArray(attempts)) return null;
  const at = when(now) || new Date();

  // Latest dial per number, so "was there a later call" is one lookup.
  const latestByNumber = new Map();
  for (const row of attempts) {
    const d = when(row?.dialledAt);
    const num = typeof row?.toE164 === "string" ? row.toE164 : null;
    if (!d || !num) continue;
    const prev = latestByNumber.get(num);
    if (!prev || d > prev) latestByNumber.set(num, d);
  }

  const upcoming = [];
  const overdue = [];
  for (const row of attempts) {
    const due = when(row?.callbackAt);
    if (!due) continue;
    const num = typeof row?.toE164 === "string" ? row.toE164 : null;
    if (due > at) {
      upcoming.push({ attemptId: row.id ?? null, toE164: num, dueAt: due });
      continue;
    }
    const latest = num ? latestByNumber.get(num) : null;
    // A later dial to the same number is the only evidence available that the
    // callback was acted on. Absence of it is what puts the row on the list.
    if (!latest || latest <= when(row.dialledAt)) {
      overdue.push({ attemptId: row.id ?? null, toE164: num, dueAt: due });
    }
  }

  upcoming.sort((x, y) => x.dueAt - y.dueAt);
  overdue.sort((x, y) => x.dueAt - y.dueAt);
  return { booked: upcoming.length + overdue.length, upcoming, overdue };
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
  const inWindow = Array.isArray(attempts)
    ? attempts.filter((row) => !(a || b) || inRange(row?.dialledAt, a, b))
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
          rows: PAUSE_REASON_ORDER.map((code) => ({
            code,
            label: PAUSE_REASONS[code].label,
            paid: PAUSE_REASONS[code].paid,
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
  for (const row of attempts) {
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

  for (const row of attempts) {
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
 * The first four all have ONE cause, said once here so it is not four separate
 * mysteries: nothing bridges the call. A rep taps a number and their own
 * handset places it.
 */
export const NOT_TRACKED_CALLS = Object.freeze([
  {
    key: "handsetDurations",
    label: "Talk time on calls placed from a rep's own phone",
    reason:
      "A handset dial is a tel: handoff — the operating system takes the call and FieldQuo never learns it was answered, let alone for how long. Those rows are excluded from every duration rather than counted as zero, and the count they were excluded from is printed beside the figure. Bridging the call through the browser is what makes it measurable, and only for calls placed that way.",
  },
  {
    key: "abandonRate",
    label: "Abandon rate and dialler statistics",
    reason:
      "These describe a dialler's behaviour, and FieldQuo has no dialler — a human presses the button, once, per call. There is nothing to abandon and nothing to over-dial.",
  },
  {
    key: "recording",
    label: "Call recording and QA scoring",
    reason:
      "Recording is off. Recording a two-party call is consent law rather than a setting — several of the states the calling window already enumerates require every party to agree — so it needs a per-jurisdiction disclosure played to both legs and stored, which the contractor side of this codebase already has a check script for. Shipping a recording toggle before that produces recordings nobody may listen to. Nothing to score follows from nothing recorded.",
  },
  {
    key: "connectRate",
    label: "Connect rate, as a description of what a rep achieved",
    reason:
      "Twilio reports whether a call was answered, and that is printed. What it cannot report is whether the person answering was the one the rep needed — an apprentice picking up is an answered call and not a conversation. So the human figure stays the REPORTED reach rate, labelled as the self-report it is, and sits beside the carrier's answer rate rather than replacing it.",
  },
  {
    key: "voicemail",
    label: "Messages left by a contractor who rang back",
    reason:
      "A sales_voice number is answered now — the call is logged, and put through to the transfer destination when one is set and somebody is on the floor — but nobody who reaches the message can leave one. A voicemail is a recording, and a recording needs somewhere to be kept, a rule for how long, a way to play it back that does not hand out Twilio's media URLs, and a disclosure before the beep. None of that exists, and a recording nobody can listen to is worse than the honest sentence the caller hears instead.",
  },
  {
    key: "costPerConversation",
    label: "Cost per conversation",
    reason:
      "Carrier cost per call is real and is reported. Dividing it by conversations would mix a measured numerator with a self-reported denominator and produce a figure that improves when a rep logs fewer outcomes.",
  },
]);
