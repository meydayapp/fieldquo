// lib/messaging/conversationScore.js
//
// Hot, warm or cold — from what the person actually said, with the reasons
// attached. Pure, free, and the answer every screen shows by default.
//
// ══ Same vocabulary as a lead, on purpose ══════════════════════════════════
//
// lib/leads/score.js already turns a self-quote submission into
// `{ score, temperature, reasons }` with hot ≥ 60, warm ≥ 30. A conversation
// and a form submission are the same question asked of two channels, and one
// lead carrying two different words for one idea is how a screen ends up with
// a "priority" chip beside a "temperature" chip that disagree. So the bands
// and the field names are lifted unchanged.
//
// What is NOT lifted is the WEIGHTING, and that is the whole point of this
// file. scoreLead scores a form: budget, timeline, contactability, photos,
// how much they typed. Every one of those is effort, and effort is what the
// corpus says gets it wrong — Sylvaine outscores Davidpaul on all five and
// bought nothing. A conversation has something a form does not: what somebody
// DID in it. That is all this scores.
//
// ══ The one extension to the shape ═════════════════════════════════════════
//
// A reason here carries `quote` — the fragment it matched — and `labelKey`
// rather than an English label. scoreLead writes English strings, which is a
// wart it can carry because its reasons are read next to a form; a
// conversation score is read on a screen a contractor may be using in French,
// and a number nobody can read the reason for is a number nobody trusts.

import { extractSignals, DISQUALIFYING_SIGNALS } from "./conversationSignals";

/** The three bands, in the order a filter draws them. Same list as a lead's. */
export const TEMPERATURES = Object.freeze(["hot", "warm", "cold"]);

/**
 * Where a conversation starts before anybody has done anything.
 *
 * 35, which is the bottom of "warm". A conversation nobody has said anything
 * decisive in is NOT cold — somebody wrote to a contractor, which is more than
 * most people do — and starting at zero would paint every quiet thread red and
 * teach the contractor to ignore the colour. Cold has to be EARNED by
 * something that was said.
 */
export const BASE_SCORE = 35;

/**
 * What each signal is worth.
 *
 * Ordered by how well it separates the twenty real conversations, not by how
 * it feels:
 *
 *   logistics       the strongest. Nobody who lost ever asked how to pay,
 *                   when work could start, or how to let the crew in.
 *   scope growth    somebody spending more is somebody buying.
 *   schedule        they moved THEIR dates. Davidpaul twice, Lyne three times.
 *   line items      haggling over the hinges is a customer buying well.
 *                   Worth less than the three above only because two people
 *                   who never bought also asked one line-item question.
 *
 *   comparison      the single most reliable cold signal in the set, and the
 *                   only negative big enough on its own to take a conversation
 *                   from warm to cold.
 *   pre-decline     "I'll let you know either way" — three people said it,
 *                   none of them let anybody know.
 *   silence         after a quote, with a follow-up nobody answered. Outranks
 *                   everything that came before it, per the fixtures doc.
 */
export const WEIGHTS = Object.freeze({
  logistics_initiated: 30,
  scope_growth: 20,
  schedule_accommodation: 18,
  line_item_negotiation: 12,
  comparison_shopping: -30,
  polite_pre_decline: -22,
  silence_after_quote: -25,
  // Recorded, deliberately worth nothing. See conversationSignals.js.
  budget_stated: 0,
  product_questions: 0,
});

/**
 * Extra for a customer who raised logistics more than once.
 *
 * Davidpaul asked about the deposit, the cheque, the shop address and Saturday
 * opening across four different messages. Ayse asked one question about a bank
 * draft. Both bought, so the escalation is small and CAPPED — the fact that
 * they asked at all is what matters, and an uncapped count would quietly turn
 * this back into a length score.
 */
export const LOGISTICS_STEP = 6;
export const LOGISTICS_STEP_MAX = 12;

/**
 * What a structural disqualifier costs.
 *
 * Large enough that nothing can outweigh it, because it is not a weight — it
 * is a different kind of statement. "I'm in Pembroke", "my budget is $3,500
 * for a whole kitchen", "I'm looking for B grade", "I didn't message you" are
 * facts about whether this job can exist, not evidence about how keen somebody
 * is. Expressed as a number rather than as an early return so there is ONE
 * arithmetic path and the score a disqualified thread carries is still the
 * output of the same sum.
 */
export const DISQUALIFIER_PENALTY = -100;

/**
 * Conversation messages needed before a verdict is confident.
 *
 * FIVE — inbound and outbound together. Three messages is a greeting, an
 * answer and a question, and a scorer that called that HOT would be reading
 * one sentence and rounding it up. The fixtures doc says it outright: "a model
 * that has read three messages must say it is unsure rather than produce a
 * confident Hot."
 *
 * Below it the verdict is capped at warm and the confidence reads "thin". It
 * is NOT suppressed: a thin warm with its reasons showing is more useful than
 * a blank, and the contractor can see exactly how much it was built from.
 *
 * A DISQUALIFIER is exempt, and that exemption is the point of separating the
 * two ideas. Dunia Coulombe is cold after one message — not because the thread
 * is short, but because she said "I did not message you… nothing is needed".
 * A stated refusal is not a small sample; it is an answer.
 */
export const MIN_MESSAGES_FOR_CONFIDENCE = 5;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** hot ≥ 60, warm ≥ 30, else cold — the same cut points scoreLead uses. */
export function bandFor(score) {
  return score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";
}

/**
 * Score one conversation.
 *
 * @param messages / now / serviceArea / minimumJobPrice / quoteSentAt — passed
 *        straight through to extractSignals; see that file for what each one
 *        is allowed to decide.
 *
 * @returns {{
 *   temperature: "hot"|"warm"|"cold",
 *   score: number,
 *   reasons: Array<{ id, labelKey, weight, quote, direction, detail }>,
 *   disqualified: { reason, quote, labelKey }|null,
 *   confidence: "clear"|"thin",
 *   messageCount: number,
 *   signals: string[],
 * }}
 */
export function scoreConversation({
  messages = [],
  now = new Date(),
  serviceArea = null,
  minimumJobPrice = null,
  quoteSentAt = null,
} = {}) {
  const extracted = extractSignals({ messages, now, serviceArea, minimumJobPrice, quoteSentAt });

  const reasons = [];
  let total = BASE_SCORE;

  for (const signal of extracted.signals) {
    const structural = DISQUALIFYING_SIGNALS.includes(signal.id);
    let weight = structural ? DISQUALIFIER_PENALTY : WEIGHTS[signal.id] ?? 0;

    if (signal.id === "logistics_initiated") {
      // Capped escalation — see LOGISTICS_STEP.
      const extra = Math.min(
        LOGISTICS_STEP_MAX,
        Math.max(0, extracted.logisticsMessages - 1) * LOGISTICS_STEP,
      );
      weight += extra;
    }

    total += weight;
    reasons.push({
      id: signal.id,
      labelKey: signal.labelKey,
      weight,
      // The fragment the rule matched, verbatim from what they typed. A score
      // nobody can check is a score nobody argues with, and a score nobody
      // argues with gets obeyed when it is wrong.
      quote: signal.quote,
      direction: signal.direction,
      detail: signal.detail ?? null,
    });
  }

  // Heaviest first, so the top line of a two-line summary is the reason that
  // actually moved it. Ties keep extraction order (i.e. the order it was said).
  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  const disqualifyingSignal = extracted.signals.find((s) => DISQUALIFYING_SIGNALS.includes(s.id));
  const disqualified = disqualifyingSignal
    ? {
        reason: disqualifyingSignal.id,
        labelKey: disqualifyingSignal.labelKey,
        quote: disqualifyingSignal.quote,
        detail: disqualifyingSignal.detail ?? null,
      }
    : null;

  const score = clamp(total);
  const thin = !disqualified && extracted.messageCount < MIN_MESSAGES_FOR_CONFIDENCE;

  let temperature = bandFor(score);
  // Thin caps the HOT end only. A short thread can be cold — somebody said
  // something cold — but it can never be called hot on two messages.
  if (thin && temperature === "hot") temperature = "warm";
  if (disqualified) temperature = "cold";

  return {
    temperature,
    score,
    reasons,
    disqualified,
    confidence: thin ? "thin" : "clear",
    messageCount: extracted.messageCount,
    inboundCount: extracted.inboundCount,
    signals: extracted.signals.map((s) => s.id),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The paid layer's one permitted move
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How far a model reading may move a score. ONE band's worth, at most.
 *
 * 15 points, against bands 30 wide: enough to move a 55 to hot or a 45 to
 * cold, never enough to jump warm entirely. The paid pass reads for two things
 * rules cannot — commitment versus conditional language, and personal
 * disclosure — and both are real, but neither is worth more than the fact that
 * somebody asked how to pay.
 */
export const AI_ADJUSTMENT = 15;

/**
 * Fold a stored AI read into the rule score.
 *
 * PURE, and separate from the model call on purpose: the rule score is
 * recomputed on every new message, and re-applying a paid read has to be free
 * and identical every time. It is also the file the check attacks, because
 * this is where a model could overturn a fact.
 *
 * Three rules, in order:
 *
 *   1. A STRUCTURAL DISQUALIFIER IS NEVER OVERTURNED. Somebody in Pembroke is
 *      still in Pembroke however warmly they wrote. The read is kept and shown
 *      — the contractor may disagree with the rule — but it moves nothing.
 *   2. The move is capped at AI_ADJUSTMENT, whatever the model asked for.
 *   3. Its sentence is carried as a reason of weight 0 even when it adjusted
 *      nothing, because "the model read this and found nothing to change" is
 *      worth seeing on a paid feature.
 *
 * @param rule  a scoreConversation() result.
 * @param ai    a stored read: { direction: "up"|"down"|"none", note, model,
 *              basedOnMessages, at }. Null returns the rule score untouched.
 */
export function applyAiRead(rule, ai) {
  if (!rule) return rule;
  if (!ai || !ai.note) return { ...rule, ai: null };

  const kept = {
    direction: ai.direction === "up" || ai.direction === "down" ? ai.direction : "none",
    note: String(ai.note),
    model: ai.model || null,
    at: ai.at || null,
    basedOnMessages: Number.isFinite(ai.basedOnMessages) ? ai.basedOnMessages : null,
    // "Read after eight messages; three more have arrived since." Shown rather
    // than used to invalidate the read: new messages ADD to a conversation,
    // they do not unsay what was already in it, and re-reading a chatty thread
    // on every message is exactly the cost this feature refuses to incur.
    messagesSince: Number.isFinite(ai.basedOnMessages)
      ? Math.max(0, (rule.messageCount || 0) - ai.basedOnMessages)
      : null,
  };

  if (rule.disqualified) {
    return {
      ...rule,
      ai: { ...kept, applied: 0, blocked: "disqualified" },
      reasons: [
        ...rule.reasons,
        { id: "ai_read", labelKey: "app.messages.signal.ai_read", weight: 0, quote: kept.note, direction: "noted", detail: null },
      ],
    };
  }

  const applied =
    kept.direction === "up" ? AI_ADJUSTMENT : kept.direction === "down" ? -AI_ADJUSTMENT : 0;
  const score = clamp(rule.score + applied);
  let temperature = bandFor(score);
  if (rule.confidence === "thin" && temperature === "hot") temperature = "warm";

  return {
    ...rule,
    score,
    temperature,
    ai: { ...kept, applied, blocked: null },
    reasons: [
      ...rule.reasons,
      {
        id: "ai_read",
        labelKey: "app.messages.signal.ai_read",
        weight: applied,
        quote: kept.note,
        direction: applied > 0 ? "positive" : applied < 0 ? "negative" : "noted",
        detail: null,
      },
    ],
  };
}

/**
 * The columns MessageThread stores, from a scored result.
 *
 * One place, so the ingest path and the on-demand path cannot write two
 * different shapes into one column.
 */
export function storableScore(scored, { at = new Date() } = {}) {
  return {
    temperature: scored.temperature,
    score: scored.score,
    scoreReasons: {
      reasons: scored.reasons,
      confidence: scored.confidence,
      disqualified: scored.disqualified,
      messageCount: scored.messageCount,
      ai: scored.ai ?? null,
    },
    scoredAt: at,
  };
}

/**
 * Read the stored json back into the shape the screens use.
 *
 * Tolerant of a row written before this existed (null everywhere) and of a row
 * whose json predates a field — it returns null rather than a fabricated
 * "cold", because a conversation nobody has scored is not a cold one.
 */
export function readStoredScore(thread) {
  if (!thread || !thread.temperature || !TEMPERATURES.includes(thread.temperature)) return null;
  const stored = thread.scoreReasons && typeof thread.scoreReasons === "object" ? thread.scoreReasons : {};
  return {
    temperature: thread.temperature,
    score: Number.isFinite(thread.score) ? thread.score : null,
    reasons: Array.isArray(stored.reasons) ? stored.reasons : [],
    confidence: stored.confidence === "clear" ? "clear" : "thin",
    disqualified: stored.disqualified || null,
    messageCount: Number.isFinite(stored.messageCount) ? stored.messageCount : null,
    ai: stored.ai || null,
    scoredAt: thread.scoredAt || null,
  };
}
