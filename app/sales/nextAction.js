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

/** Which fetch feeds each rung, so an unknown answer can name what failed. */
export const RUNG_SOURCES = {
  replies: "your conversations",
  call: "your queue",
  claim: "your queue",
  write: "your leads",
};

/**
 * The ladder, in order. Each rung reads one count off the argument object.
 *
 * Data rather than an if-chain so the check script can assert the ORDER
 * independently of the wording — reordering these two lines is a behaviour
 * change and it should read like one.
 */
const LADDER = [
  {
    code: "replies",
    field: "repliesWaiting",
    href: "/sales/threads",
    cta: "Open conversations",
    headline: (n) => `${n} ${n === 1 ? "prospect has" : "prospects have"} written back`,
    detail: () =>
      "A reply is the only thing on this screen where somebody is already waiting on you.",
  },
  {
    code: "call",
    field: "prospectsToCall",
    href: "/sales/queue",
    cta: "Open the queue",
    headline: (n) => `${n} claimed ${n === 1 ? "prospect" : "prospects"} you have not called yet`,
    detail: () =>
      "A claim stops every other rep phoning them. Working it is what makes holding it fair.",
  },
  {
    code: "claim",
    field: "freeToClaim",
    href: "/sales/queue",
    cta: "Claim the next one",
    headline: (n) => `${n} researched ${n === 1 ? "contractor is" : "contractors are"} free to claim`,
    detail: () => "Pick one trade and stay on it — the script gets better by repetition.",
  },
  {
    code: "write",
    field: "newLeads",
    href: "/sales/leads",
    cta: "Open my leads",
    headline: (n) => `${n} ${n === 1 ? "lead" : "leads"} you added and have not contacted`,
    detail: () => "Yours, typed in by you. Nothing else is going to pick them up.",
  },
];

/** The rung order, exported so a check can assert it without re-deriving it. */
export const LADDER_ORDER = LADDER.map((rung) => rung.code);

/**
 * @param {object} counts every value is `number | null`; null means unknown.
 * @returns {{code: string, headline: string, detail: string, href: string|null,
 *            cta: string|null, blockedBy: string|null}}
 */
export function nextAction(counts = {}) {
  for (const rung of LADDER) {
    const raw = counts?.[rung.field];
    // Undefined is treated exactly as null. A caller that forgot to pass a
    // field must not get a confident answer computed from the rungs below it.
    if (raw === null || raw === undefined) {
      return {
        code: "unknown",
        blockedBy: rung.code,
        headline: "We can’t tell you what’s next",
        detail: `${RUNG_SOURCES[rung.code]} didn’t load, and everything below it in the list could be outranked by what’s in there. Retry the card that failed.`,
        href: null,
        cta: null,
      };
    }
    // A non-finite or negative count is a broken payload, not a zero.
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return {
        code: "unknown",
        blockedBy: rung.code,
        headline: "We can’t tell you what’s next",
        detail: `${RUNG_SOURCES[rung.code]} came back in a shape we don’t recognise, so nothing below it can be trusted either.`,
        href: null,
        cta: null,
      };
    }
    if (raw > 0) {
      return {
        code: rung.code,
        blockedBy: null,
        headline: rung.headline(raw),
        detail: rung.detail(raw),
        href: rung.href,
        cta: rung.cta,
      };
    }
  }

  return {
    code: "clear",
    blockedBy: null,
    headline: "Nothing is waiting on you",
    detail:
      "No replies, no unworked claims, nothing free in the pool and no untouched leads. That is a real answer, not an empty screen.",
    href: null,
    cta: null,
  };
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
  return threads.filter((t) => t?.messages?.[0]?.direction === "in").length;
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
          (sum, t) => (sum === null || !Number.isFinite(t?.available) ? null : sum + t.available),
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
