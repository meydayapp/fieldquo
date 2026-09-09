// lib/messaging/monthlyReview.js
//
// THE POINT OF THE FEATURE, as one pure function.
//
// The owner's ask: "once a month I want to see which conversations closed the
// job and which didn't, to understand the conversations and how to improve
// them." Everything else in app/app/messages exists so this has data to read.
//
// Pure — takes rows, returns numbers, touches no database and no clock beyond
// the month it is given — so scripts/check-messaging.mjs EXECUTES it against
// fixtures including the two months that get arithmetic wrong everywhere else:
// an empty one, and one where nobody ever replied.
//
// ══ The rule this file is built around ═════════════════════════════════════
//
// ABSENCE IS NOT ZERO. Three different nothings, three different answers:
//
//   * a thread nobody replied to has NO first-response time. Not 0 minutes,
//     not "instant" — unmeasurable, and it is counted in its own bucket and
//     reported FIRST, because it is the one the contractor can act on.
//   * a month with no threads has NO won rate. Not 0% — null, and the screen
//     says "no conversations started this month" rather than printing a
//     failure figure for a month nothing happened in.
//   * a thread nobody has judged yet has NO outcome. It is counted as `unset`
//     and kept out of the won-rate denominator; folding unjudged threads into
//     "lost" would let the rate fall every time somebody gets busy.
//
// ══ Why medians, and why no correlation coefficient ════════════════════════
//
// A mean first-response time is destroyed by one conversation somebody found
// three weeks later; the median is what "how fast do we usually answer" means.
//
// And the response-time-vs-outcome question is answered as a median PER
// OUTCOME, not as a correlation coefficient. A contractor's month holds five
// to fifty conversations: an r computed on that is noise with three decimal
// places, and it would be read as a finding. "Won conversations were answered
// in 8 minutes, lost ones in 4 hours" is the same insight, honest about being
// a comparison of two small groups, and it survives being read by somebody who
// has never met a p-value.

import { THREAD_OUTCOMES } from "./outcomes";
import { isDeliveredReply } from "./messageKinds";
import { readStoredScore } from "./conversationScore";

/**
 * The half-open UTC range [start, end) for a month.
 *
 * UTC on purpose: the alternative is the company's timezone, and a thread that
 * moves between months depending on which screen asks makes the monthly totals
 * irreproducible. Everything downstream compares against one boundary.
 *
 * @param {number} year   e.g. 2026
 * @param {number} month  1-12, NOT the JS 0-11 — a month argument that is off
 *                        by one silently reports the wrong month, so this
 *                        takes the number a person would type.
 */
export function monthRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return null;
  }
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)),
    key: `${y}-${String(m).padStart(2, "0")}`,
  };
}

/** Median of finite numbers. Null for an empty list — never 0. */
export function median(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

const ms = (d) => {
  const t = d instanceof Date ? d.getTime() : Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

/**
 * The stored answer, from MessageThread.firstInboundAt / firstReplyAt.
 *
 * ══ Why there are two implementations of one measurement ═══════════════════
 *
 * These columns were added because the inbox needs "waiting four hours" NOW,
 * not at month end (lib/messaging/waiting.js). Once they exist, the review
 * should read them rather than re-derive the same numbers from every message
 * of every thread — that is the whole point of storing them.
 *
 * The message SCAN below is kept, deliberately, as the BACKFILL. Every thread
 * that existed before these columns did has null in them, and `prisma db push`
 * carries no data migration step, so those rows can only be measured the old
 * way. Deleting the scan would silently report every conversation from before
 * the deploy as "never answered" — absence read as a fact, the exact failure
 * this file's header is written against.
 *
 * scripts/check-messaging.mjs runs BOTH over one fixture and asserts they
 * agree, which is the only way two implementations of one number stay honest.
 *
 * Returns null to mean "the columns cannot answer this" — never a guess.
 */
export function storedFirstResponse(thread) {
  const firstIn = ms(thread?.firstInboundAt);
  // Unstamped. Could be a pre-columns row, could be an outbound-only thread;
  // those are different answers and only the messages can tell them apart.
  if (firstIn === null) return null;

  const reply = ms(thread?.firstReplyAt);
  if (reply !== null) {
    return {
      answered: true,
      minutes: (reply - firstIn) / 60000,
      firstInboundAt: new Date(firstIn),
      noInbound: false,
      source: "stored",
    };
  }

  // Stamped as asked, never stamped as answered. Trustworthy on its own — but
  // NOT over the messages when they are in front of us: a thread whose inbound
  // arrived after the deploy and whose reply went out before it would read as
  // unanswered here and answered in the scan, and the messages are the record
  // while the columns are a cache of it.
  if (Array.isArray(thread?.messages) && thread.messages.length) return null;

  return {
    answered: false,
    minutes: null,
    firstInboundAt: new Date(firstIn),
    noInbound: false,
    source: "stored",
  };
}

/**
 * One thread's first-response time, in minutes.
 *
 * Defined as: the first INBOUND message, and the first OUTBOUND message sent
 * after it. Both halves matter —
 *
 *   * measuring from the thread's creation would credit a thread that opened
 *     with the contractor's own outbound message;
 *   * measuring to "any outbound" would let a reply sent BEFORE the homeowner
 *     wrote (an echo of an earlier broadcast) produce a negative gap.
 *
 * A failed outbound message does NOT count as a reply. It was recorded so the
 * screen could say it failed; counting it here would report a response the
 * homeowner never received, which is precisely the "appears to work" failure
 * this codebase keeps finding.
 *
 * @returns {{ answered: boolean, minutes: number|null, firstInboundAt: Date|null }}
 *          answered:false with minutes:null is the "nobody replied" case, and
 *          the two fields are separate so a caller cannot mistake a null for a
 *          zero.
 */
export function firstResponse(thread) {
  // The columns first — see storedFirstResponse for why the scan below stays.
  const stored = storedFirstResponse(thread);
  if (stored) return stored;

  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  const inbound = messages
    .filter((m) => m?.direction === "in")
    .map((m) => ms(m.sentAt))
    .filter((t) => t !== null)
    .sort((a, b) => a - b);

  if (!inbound.length) {
    // Nothing was ever asked of this company here — an outbound-only thread.
    // Not "unanswered": there was no question. Both flags say so.
    return { answered: false, minutes: null, firstInboundAt: null, noInbound: true, source: "scan" };
  }

  const firstIn = inbound[0];
  // isDeliveredReply, not `direction === "out"` written out again: it is the
  // one definition of "a reply the homeowner actually received", and it also
  // excludes the two kinds of row that did not exist when this was written —
  // a private note and a system line. Both are stored in this same array.
  const replies = messages
    .filter((m) => isDeliveredReply(m))
    .map((m) => ms(m.sentAt))
    .filter((t) => t !== null && t >= firstIn)
    .sort((a, b) => a - b);

  if (!replies.length) {
    return {
      answered: false,
      minutes: null,
      firstInboundAt: new Date(firstIn),
      noInbound: false,
      source: "scan",
    };
  }

  return {
    answered: true,
    minutes: (replies[0] - firstIn) / 60000,
    firstInboundAt: new Date(firstIn),
    noInbound: false,
    source: "scan",
  };
}

/**
 * The month-end report.
 *
 * @param threads  rows shaped like MessageThread with their `messages`:
 *                 { id, createdAt, outcome, participantName, platform,
 *                   channelName, lastMessageAt, messages: [{ direction,
 *                   sentAt, failedReason }] }
 *                 Threads OUTSIDE the month are filtered out here rather than
 *                 by the caller, so the "started in this month" definition
 *                 lives in one place and the check can exercise it.
 * @param year / month  as monthRange above.
 */
export function buildMonthlyReview({ threads = [], year, month } = {}) {
  const range = monthRange(year, month);
  if (!range) {
    return { ok: false, reason: "bad_month" };
  }

  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  const inMonth = (threads || []).filter((t) => {
    const created = ms(t?.createdAt);
    return created !== null && created >= startMs && created < endMs;
  });

  const rows = inMonth.map((t) => {
    const fr = firstResponse(t);
    return {
      id: t.id,
      participantName: t.participantName || null,
      platform: t.platform || null,
      channelName: t.channelName || null,
      outcome: THREAD_OUTCOMES.includes(t.outcome) ? t.outcome : null,
      createdAt: t.createdAt,
      lastMessageAt: t.lastMessageAt || null,
      // Only what two people actually said. A private note and a system line
      // live in the same array, and counting them here would tell a contractor
      // a five-message conversation had eleven messages in it.
      messageCount: Array.isArray(t.messages)
        ? t.messages.filter((m) => m?.direction === "in" || m?.direction === "out").length
        : 0,
      inboundCount: Array.isArray(t.messages)
        ? t.messages.filter((m) => m?.direction === "in").length
        : 0,
      // Which of the two implementations answered — see storedFirstResponse.
      // Carried out so a support conversation can tell "measured from the
      // columns" from "measured by walking a pre-columns thread".
      source: fr.source,
      answered: fr.answered,
      // Null, not 0. Every consumer of this field has to decide what to print
      // for "we never answered", and a 0 would let one print "0 min".
      firstResponseMinutes: fr.minutes,
      noInbound: fr.noInbound,
      // ── What the conversation itself said ──────────────────────────────
      //
      // Read from the STORED columns, not recomputed here. They are written on
      // ingest, on every reply, and by the quiet-thread pass of the messaging
      // cron (lib/messaging/rescoreThread.js), which is the only place that can
      // notice silence — nothing arrives to trigger a rescore when nothing is
      // being said. Recomputing here would mean pulling every message BODY of
      // every thread in the month to draw one column.
      //
      // NULL for a thread nobody has scored, and null is rendered as "not
      // scored", never as cold. A conversation that has said nothing about
      // itself has not said it is cold.
      score: readStoredScore(t),
    };
  });

  const byOutcome = { unset: 0 };
  for (const o of THREAD_OUTCOMES) byOutcome[o] = 0;
  for (const r of rows) byOutcome[r.outcome || "unset"] += 1;

  // The denominator is the threads somebody actually judged AND that were
  // real enquiries: won + lost + no_reply. `not_a_job` is excluded because a
  // supplier's message is not a lost sale, and `unset` is excluded because
  // nobody has said yet — see the header.
  const judged = byOutcome.won + byOutcome.lost + byOutcome.no_reply;
  const wonRate = judged > 0 ? byOutcome.won / judged : null;

  // Measured, not declared: threads where a homeowner wrote and no reply ever
  // left the building. First in the report, because it is the only line on it
  // that names something still fixable.
  const neverAnswered = rows.filter((r) => !r.answered && !r.noInbound);

  const answeredRows = rows.filter((r) => Number.isFinite(r.firstResponseMinutes));

  const perOutcome = {};
  for (const o of [...THREAD_OUTCOMES, "unset"]) {
    const group = answeredRows.filter((r) => (r.outcome || "unset") === o);
    perOutcome[o] = {
      // How many of that outcome's threads were answered at all, and the
      // median of those. `unanswered` is carried alongside rather than folded
      // in, so "won in 8 minutes" is never read over a group that mostly went
      // unanswered.
      answered: group.length,
      unanswered: rows.filter(
        (r) => (r.outcome || "unset") === o && !r.answered && !r.noInbound,
      ).length,
      medianMinutes: median(group.map((r) => r.firstResponseMinutes)),
    };
  }

  return {
    ok: true,
    month: range.key,
    range: { start: range.start, end: range.end },
    totals: {
      started: rows.length,
      // Answered/unanswered here counts only threads a homeowner wrote in —
      // an outbound-only thread is in neither, and is reported separately so
      // the three numbers add up to `started` and can be checked.
      answered: rows.filter((r) => r.answered).length,
      neverAnswered: neverAnswered.length,
      noInbound: rows.filter((r) => r.noInbound).length,
      judged,
    },
    byOutcome,
    wonRate,
    // Null when nothing was answerable — the screen prints a sentence, not
    // "0 min".
    medianFirstResponseMinutes: median(answeredRows.map((r) => r.firstResponseMinutes)),
    responseByOutcome: perOutcome,
    neverAnswered,
    threads: rows,
    // ── Ranked by what was said, and NEVER filtered by it ────────────────
    //
    // Every thread in the month is here, in score order, including the cold
    // ones. Mario Laroche scored badly for two months and was one revised
    // quote away from buying; a list that hid him to keep itself tidy would
    // have cost the job the whole feature exists to win. Unscored threads sort
    // last, because "we do not know" belongs below "we do know", never above
    // it — and they still appear.
    ranked: [...rows].sort((a, b) => {
      const as = Number.isFinite(a.score?.score) ? a.score.score : -1;
      const bs = Number.isFinite(b.score?.score) ? b.score.score : -1;
      if (bs !== as) return bs - as;
      return ms(b.createdAt) - ms(a.createdAt);
    }),
  };
}
