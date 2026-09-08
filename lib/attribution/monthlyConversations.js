// lib/attribution/monthlyConversations.js
//
// A month of Meta conversations, rolled up into the numbers the owner asked
// for: how many became jobs, what those were worth, how fast they were
// answered, and which ones nobody answered at all.
//
// Pure — rows in, numbers out, no database and no clock beyond the month it is
// handed — so scripts/check-conversation-attribution.mjs EXECUTES it against
// the three months that get arithmetic wrong everywhere else: an empty one, a
// month where nothing could be matched, and a month where nobody ever replied.
//
// ══ Every number here has a stated denominator ═════════════════════════════
//
// The won rate is over the conversations that COULD BE MATCHED to a client,
// and the object says so in `wonRate.denominator` and `wonRate.denominatorLabel`
// rather than leaving a screen to imply it. Fifty-two conversations of which
// forty were matched and ten became jobs is a 25% win rate on forty, not a 19%
// win rate on fifty-two, and printing the second number under the word "rate"
// tells a contractor their Facebook page is worse than it is.
//
// `unmatched` is excluded from that denominator and from nothing else: it is
// counted, listed, and reported — it just cannot be scored, because "we could
// not tell who this was" is not a lost sale. See conversationOutcome.js.
//
// ══ Absence is not zero ════════════════════════════════════════════════════
//
//   * a conversation nobody replied to has NO reply time — not 0, not
//     infinity. It is counted in its own bucket, listed FIRST, and kept out of
//     the median entirely.
//   * a month with nothing in it has NO won rate and NO median. Null, and the
//     screen prints a sentence.
//   * a won conversation whose job has not been invoiced yet has NO revenue
//     figure. The month's total says how many of those it is missing rather
//     than adding a zero and calling itself complete.
//
// ══ The two helpers that are NOT redefined here ════════════════════════════
//
// monthRange() and median() come from lib/messaging/monthlyReview.js. A second
// month boundary is how one screen reports March and another reports March
// plus one evening; a second median is how two reports disagree on an
// even-sized month. That file owns both definitions and this one uses them.
//
// The first-reply MEASUREMENT is likewise not recomputed here. monthlyReview's
// firstResponse() defines it — first inbound message to first outbound that is
// not a failed send — and this module takes its output (`answered`,
// `firstReplyMinutes`) as an input. One definition of "we replied", used by
// both the inbox's own report and this one.
import { median, monthRange } from "@/lib/messaging/monthlyReview";
import { ATTRIBUTION_OUTCOMES, CONVERSATION_SOURCES } from "./conversationOutcome";

const ms = (d) => {
  if (d === null || d === undefined) return null;
  const t = d instanceof Date ? d.getTime() : Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

const emptyCounts = () => {
  const c = {};
  for (const o of ATTRIBUTION_OUTCOMES) c[o] = 0;
  return c;
};

/**
 * Won rate over a set of rows, with its denominator attached.
 *
 * Returned as an object rather than a number on purpose: a bare rate has to be
 * labelled by whoever prints it, and the label is the part that gets it wrong.
 */
export function wonRateOf(rows) {
  const matched = rows.filter((r) => r.outcome !== "unmatched");
  const won = matched.filter((r) => r.outcome === "won").length;
  return {
    won,
    denominator: matched.length,
    denominatorLabel: "conversations we could match to a client",
    unmatched: rows.length - matched.length,
    // Null, never 0: a month with nothing to score has no rate, and 0% reads
    // as a failure that did not happen.
    rate: matched.length ? won / matched.length : null,
  };
}

function revenueOf(rows) {
  const won = rows.filter((r) => r.outcome === "won");
  const known = won.filter((r) => Number.isFinite(r.invoiceTotal));
  const missing = won.length - known.length;
  const total = known.reduce((sum, r) => sum + r.invoiceTotal, 0);
  return {
    // Zero only when nothing was won — that is a derived fact. When something
    // WAS won and none of it has been invoiced, the total is null and the
    // screen says "not invoiced yet" instead of "$0".
    total: won.length === 0 ? 0 : known.length ? total : null,
    wonConversations: won.length,
    invoiced: known.length,
    notInvoicedYet: missing,
    complete: missing === 0,
  };
}

/**
 * Roll a month of conversations up.
 *
 * @param conversations rows shaped
 *   { id, source, startedAt, participantName?, answered, firstReplyMinutes,
 *     outcome: <the object lib/attribution/conversationOutcome.js returns> }
 *
 *   `answered` / `firstReplyMinutes` come from lib/messaging/monthlyReview.js's
 *   firstResponse(). A row that reports neither is treated as UNKNOWN, not as
 *   unanswered — a Lead Ad form submission has no thread to reply on, and
 *   counting it as "we never got back to them" would invent a failure.
 * @param year / month  1-12, as monthRange. Conversations outside the month
 *   are dropped here so "started in this month" has one definition.
 */
export function monthlyConversations({ conversations = [], year, month } = {}) {
  const range = monthRange(year, month);
  if (!range) return { ok: false, reason: "bad_month" };

  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  const rows = [];
  let outsideMonth = 0;
  for (const c of conversations || []) {
    if (!c) continue;
    const started = ms(c.startedAt ?? c.outcome?.startedAt);
    if (started === null || started < startMs || started >= endMs) { outsideMonth += 1; continue; }

    const o = c.outcome || {};
    const outcome = ATTRIBUTION_OUTCOMES.includes(o.outcome) ? o.outcome : "unmatched";
    const minutes = Number.isFinite(c.firstReplyMinutes) ? c.firstReplyMinutes : null;
    rows.push({
      id: c.id ?? o.conversationId ?? null,
      participantName: c.participantName ?? null,
      source: CONVERSATION_SOURCES.includes(c.source ?? o.source) ? (c.source ?? o.source) : null,
      startedAt: c.startedAt ?? o.startedAt ?? null,
      outcome,
      confidence: o.confidence ?? "none",
      reasons: o.reasons ?? [],
      quoteId: o.quoteId ?? null,
      jobId: o.jobId ?? null,
      invoiceTotal: Number.isFinite(o.invoiceTotal) ? o.invoiceTotal : null,
      // Three states, and the third is the point. true = somebody replied;
      // false = a homeowner wrote and nobody did; null = there was nothing to
      // reply to, or the thread's messages were not read.
      answered: c.answered === true ? true : c.answered === false ? false : null,
      firstReplyMinutes: minutes,
    });
  }

  const counts = emptyCounts();
  for (const r of rows) counts[r.outcome] += 1;

  const unanswered = rows.filter((r) => r.answered === false);
  const answered = rows.filter((r) => r.answered === true);
  const timed = answered.filter((r) => Number.isFinite(r.firstReplyMinutes));
  const medianMinutes = median(timed.map((r) => r.firstReplyMinutes));

  // The split, and why it is a split and not a correlation: a contractor's
  // month holds five to fifty conversations, and an r computed on that is
  // noise that reads as a finding. Same reasoning as monthlyReview.js.
  const faster = medianMinutes === null ? [] : timed.filter((r) => r.firstReplyMinutes <= medianMinutes);
  const slower = medianMinutes === null ? [] : timed.filter((r) => r.firstReplyMinutes > medianMinutes);

  const bucket = (group) => ({
    conversations: group.length,
    counts: group.reduce((acc, r) => { acc[r.outcome] += 1; return acc; }, emptyCounts()),
    wonRate: wonRateOf(group),
    medianMinutes: median(group.map((r) => r.firstReplyMinutes)),
  });

  const bySource = {};
  for (const s of CONVERSATION_SOURCES) {
    const group = rows.filter((r) => r.source === s);
    bySource[s] = {
      conversations: group.length,
      counts: group.reduce((acc, r) => { acc[r.outcome] += 1; return acc; }, emptyCounts()),
      wonRate: wonRateOf(group),
      revenue: revenueOf(group),
    };
  }

  return {
    ok: true,
    month: range.key,
    range: { start: range.start, end: range.end },
    total: rows.length,
    outsideMonth,
    counts,
    wonRate: wonRateOf(rows),
    revenue: revenueOf(rows),
    reply: {
      answered: answered.length,
      // The number the contractor can act on today, which is why it leads.
      unanswered: unanswered.length,
      // Not "answered instantly" and not "unanswered" — a conversation with no
      // reply measurement at all, e.g. a Lead Ad form with no thread.
      unknown: rows.filter((r) => r.answered === null).length,
      medianMinutes,
      atOrFasterThanMedian: bucket(faster),
      slowerThanMedian: bucket(slower),
    },
    bySource,
    // Unanswered first, then oldest first. The order IS the report: the top of
    // this list is every homeowner who wrote to this company and got nothing.
    conversations: rows.slice().sort((a, b) => {
      const au = a.answered === false ? 0 : 1;
      const bu = b.answered === false ? 0 : 1;
      if (au !== bu) return au - bu;
      return (ms(a.startedAt) || 0) - (ms(b.startedAt) || 0);
    }),
    unanswered,
  };
}
