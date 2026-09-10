// app/sales/nextAction.js
//
// "What do I do next?" — computed, and refused when it cannot be computed.
//
// ══ Why this is a module and not four lines inside the page ════════════════
//
// Because it is the one thing on the home screen that can be WRONG rather than
// merely ugly. A rep reads one sentence at the top of the portal and does what
// it says; if that sentence is derived from a list that failed to load, it
// tells them to go home when three people are waiting on a reply. So the
// derivation is pure, exported, and executed against hostile input by
// scripts/check-sales-home.mjs — the discipline AGENTS.md asks for ("execute
// pure functions against hostile input"), applied to the sentence that decides
// a rep's next hour.
//
// ══ null is not zero, and the ladder stops at the first null ═══════════════
//
// Every count here is `number | null`, and null means "we did not get an
// answer", never "none". The ladder is walked in priority order and stops the
// moment it meets a null: rungs BELOW an unknown rung cannot be trusted to be
// the answer, because the unknown one might have outranked them. That is
// deliberately different from "if anything failed, say nothing" — a known
// three replies at the top rung is still the right answer even when the queue
// below it is unreachable, and suppressing it would be its own dishonesty.
//
// ══ The order, and why ════════════════════════════════════════════════════
//
//   1. replies      — somebody is waiting on this rep specifically.
//   2. call         — prospects already claimed and not yet spoken to. A claim
//                     is a lease on somebody else's ability to call them; it is
//                     rude and expensive to hold one and not use it.
//   3. claim        — the pool has stock, the rep has nothing on lease.
//   4. write        — leads the rep typed in and has never contacted.
//
// Nothing "recommended" is invented below that: an empty ladder says the day's
// queue is clear, which is a real statement, rather than manufacturing busywork.
//
// ══ Two renderings of the same sentence, and why both are returned ════════
//
// The rep reads this sentence in THEIR language, so every rung names a
// translation key and app/sales/page.js resolves it through t(). But this
// module is also a pure function that scripts/check-sales-home.mjs executes
// against hostile input — null counts, NaN, Infinity, a string, no argument at
// all — and those assertions are about the WORDS ("a failed load is described
// as a failed load, and names the card"), not about a key name. A check that
// only compared key names would pass while the sentence said the wrong thing.
//
// So each answer carries both: `headlineKey`/`detailKey`/`ctaKey` for the
// screen, and `headline`/`detail`/`cta` rendered in English for the check. The
// English is NOT a second copy of the wording — it is resolved out of
// APP_MESSAGES.en, the same entry t() falls back to — so there is exactly one
// place the English lives and the two cannot drift.

import { APP_MESSAGES } from "@/app/i18n/appMessages";

/**
 * The English rendering of a catalogue entry.
 *
 * Deliberately not useTranslation(): that is a React hook and this module is
 * imported by a check script under bare node, with no React tree and no
 * LanguageProvider. Function-valued entries (the counted nouns) are called with
 * the values object exactly as t() calls them — see app/hooks/useTranslation.js.
 */
function en(key, values = {}) {
  const entry = APP_MESSAGES.en[key];
  if (typeof entry === "function") return entry(values);
  return String(entry ?? key).replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined ? whole : String(values[name]),
  );
}

/**
 * Which fetch feeds each rung, so an unknown answer can name what failed.
 *
 * Keys rather than English since the portal was translated: the sentence
 * "your conversations didn't load" is assembled from two catalogue entries and
 * BOTH have to move when the rep reads French, or the screen ships the
 * half-translated sentence this whole change exists to remove.
 */
export const RUNG_SOURCES = {
  replies: "app.salesToday.sourceReplies",
  call: "app.salesToday.sourceQueue",
  claim: "app.salesToday.sourceQueue",
  write: "app.salesToday.sourceLeads",
};

/**
 * The ladder, in order. Each rung reads one count off the argument object.
 *
 * Data rather than an if-chain so the check script can assert the ORDER
 * independently of the wording — reordering these two lines is a behaviour
 * change and it should read like one.
 */
// The singular/plural switch that used to live in each `headline` below is
// gone on purpose, not lost. "n === 1 ? one : other" is an ENGLISH rule, and it
// is wrong in four of the nine languages this portal ships in — French makes 0
// singular, Ukrainian has three forms by the last digits, Mandarin has one.
// The catalogue entries these keys name are countedNoun-shaped functions asking
// Intl.PluralRules for the category, so each language declines by its own rule.
// See lib/i18n/plurals.js.
const LADDER = [
  {
    code: "replies",
    field: "repliesWaiting",
    href: "/sales/threads",
    ctaKey: "app.salesToday.ladderRepliesCta",
    headlineKey: "app.salesToday.ladderRepliesHeadline",
    detailKey: "app.salesToday.ladderRepliesDetail",
  },
  {
    code: "call",
    field: "prospectsToCall",
    href: "/sales/queue",
    ctaKey: "app.salesToday.ladderCallCta",
    headlineKey: "app.salesToday.ladderCallHeadline",
    detailKey: "app.salesToday.ladderCallDetail",
  },
  {
    code: "claim",
    field: "freeToClaim",
    href: "/sales/queue",
    ctaKey: "app.salesToday.ladderClaimCta",
    headlineKey: "app.salesToday.ladderClaimHeadline",
    detailKey: "app.salesToday.ladderClaimDetail",
  },
  {
    code: "write",
    field: "newLeads",
    href: "/sales/leads",
    ctaKey: "app.salesToday.ladderWriteCta",
    headlineKey: "app.salesToday.ladderWriteHeadline",
    detailKey: "app.salesToday.ladderWriteDetail",
  },
];

/** The rung order, exported so a check can assert it without re-deriving it. */
export const LADDER_ORDER = LADDER.map((rung) => rung.code);

/**
 * One answer, in both renderings.
 *
 * `sourceKey` is separate from `values` because the sentence it goes into has
 * to be assembled in ONE language: the screen passes `t(sourceKey)` into
 * `t(detailKey)`, so a French rep reads "vos conversations n'ont pas chargé"
 * rather than a French frame around an English fragment. That half-and-half
 * sentence is the shape AGENTS.md records under "the payroll intro was not a
 * missing translation".
 */
function answer({ code, blockedBy, href, headlineKey, detailKey, ctaKey, values, sourceKey }) {
  const forEnglish = { ...values, ...(sourceKey ? { source: en(sourceKey) } : {}) };
  return {
    code,
    blockedBy,
    href,
    headlineKey,
    detailKey,
    ctaKey,
    sourceKey: sourceKey ?? null,
    values: values ?? {},
    headline: en(headlineKey, forEnglish),
    detail: en(detailKey, forEnglish),
    cta: ctaKey ? en(ctaKey) : null,
  };
}

/**
 * @param {object} counts every value is `number | null`; null means unknown.
 * @returns {{code: string, headline: string, detail: string, href: string|null,
 *            cta: string|null, blockedBy: string|null, headlineKey: string,
 *            detailKey: string, ctaKey: string|null, sourceKey: string|null,
 *            values: object}}
 */
export function nextAction(counts = {}) {
  for (const rung of LADDER) {
    const raw = counts?.[rung.field];
    // Undefined is treated exactly as null. A caller that forgot to pass a
    // field must not get a confident answer computed from the rungs below it.
    if (raw === null || raw === undefined) {
      return answer({
        code: "unknown",
        blockedBy: rung.code,
        href: null,
        headlineKey: "app.salesToday.unknownHeadline",
        detailKey: "app.salesToday.unknownDetailLoad",
        ctaKey: null,
        sourceKey: RUNG_SOURCES[rung.code],
      });
    }
    // A non-finite or negative count is a broken payload, not a zero.
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return answer({
        code: "unknown",
        blockedBy: rung.code,
        href: null,
        headlineKey: "app.salesToday.unknownHeadline",
        detailKey: "app.salesToday.unknownDetailShape",
        ctaKey: null,
        sourceKey: RUNG_SOURCES[rung.code],
      });
    }
    if (raw > 0) {
      return answer({
        code: rung.code,
        blockedBy: null,
        href: rung.href,
        headlineKey: rung.headlineKey,
        detailKey: rung.detailKey,
        ctaKey: rung.ctaKey,
        values: { value: raw },
      });
    }
  }

  return answer({
    code: "clear",
    blockedBy: null,
    href: null,
    headlineKey: "app.salesToday.clearHeadline",
    detailKey: "app.salesToday.clearDetail",
    ctaKey: null,
  });
}

/**
 * How many threads are sitting on an inbound message.
 *
 * The list route sends the newest message per thread (`take: 1`, newest first),
 * so "the last thing that happened was them writing to us" is exactly
 * `messages[0].direction === "in"`. A thread with no messages at all cannot be
 * waiting on anybody and is not counted.
 *
 * Returns null for a null argument, so a failed load stays a failed load all
 * the way up to the sentence. `[]` is a real answer and returns 0.
 */
export function repliesWaiting(threads) {
  if (!Array.isArray(threads)) return null;
  return threads.filter((thread) => thread?.messages?.[0]?.direction === "in").length;
}

/**
 * Everything the home screen needs from one /api/sales/queue GET.
 *
 * `toCall` counts claims in state "mine" only — a lease that has not been
 * worked. "mine_worked" means the rep already spoke to them and the prospect
 * stays theirs forever, so counting those would make the number grow with
 * every successful call and never come down. That is the opposite of what a
 * "what's left" figure is for.
 *
 * `freeToClaim` sums the per-trade availability counts. The route sends counts,
 * never rows — a rep may not browse the pool (see the route's header) — so a
 * sum is the most this screen can honestly say.
 */
export function queueSummary(data) {
  if (!data || typeof data !== "object") {
    return { toCall: null, freeToClaim: null, claimed: null, lapsingSoon: null };
  }
  const items = Array.isArray(data.queue?.items) ? data.queue.items : null;
  const trades = Array.isArray(data.trades) ? data.trades : null;

  return {
    claimed: items ? items.length : null,
    toCall: items
      ? items.filter((i) => i?.claim?.state === "mine" && i?.contact?.callable).length
      : null,
    lapsingSoon: items ? lapsingWithin(items, LAPSE_WARNING_HOURS) : null,
    freeToClaim: trades
      ? trades.reduce(
          (sum, trade) => (sum === null || !Number.isFinite(trade?.available) ? null : sum + trade.available),
          0,
        )
      : null,
  };
}

/**
 * A claim about to expire is the one genuinely time-critical thing on this
 * screen, so it is measured rather than eyeballed off a list of timestamps.
 *
 * Twelve hours because CLAIM_HOURS is 48: a third of the lease left is late
 * enough to be worth saying and early enough to still act on. Not imported
 * from lib/sales/prospectView.js — that module reaches the database through its
 * neighbours, and this file is bundled into a client component.
 */
export const LAPSE_WARNING_HOURS = 12;

export function lapsingWithin(items, hours = LAPSE_WARNING_HOURS, now = new Date()) {
  if (!Array.isArray(items)) return null;
  const at = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : Date.now();
  const limit = at + hours * 60 * 60 * 1000;
  let count = 0;
  for (const item of items) {
    if (item?.claim?.state !== "mine") continue;
    const raw = item?.claim?.expiresAt;
    if (!raw) continue;
    const expires = raw instanceof Date ? raw : new Date(raw);
    const ms = expires.getTime();
    // An unparseable date is not an imminent expiry and is not a distant one
    // either. Skipped rather than counted — inventing urgency is the same
    // failure as inventing calm.
    if (Number.isNaN(ms)) continue;
    if (ms > at && ms <= limit) count += 1;
  }
  return count;
}

/**
 * Leads the rep typed in and has never contacted.
 *
 * Reads the `counts` map the leads route sends, which is grouped over the whole
 * book rather than the filtered page. A missing key is a real zero — groupBy
 * omits a status with no rows — but a missing MAP is unknown.
 */
export function untouchedLeads(counts) {
  if (!counts || typeof counts !== "object") return null;
  const n = counts.new;
  if (n === undefined) return 0;
  return Number.isFinite(n) ? n : null;
}
