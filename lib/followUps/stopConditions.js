// lib/followUps/stopConditions.js
//
// When a quote must NOT be chased, decided in one place.
//
// ── Why this is not just the cron's `where` clause ──────────────────────────
//
// findQuoteNoResponse() in app/api/cron/follow-ups/route.js selects quotes
// whose status is still "sent". That is the one condition a Prisma `where`
// can state cheaply. The others — the quote has expired, the client wrote
// back, the company has since quoted the same client again — each need a
// second read, and a cron that inlines four of them is a cron whose stop
// conditions nobody can list. The settings page prints these conditions to
// the company in words, and the words have to be derived from the same
// decision the cron makes, so the decision is a pure function here and the
// cron only gathers the facts it takes.
//
// quoteChaseBlocker() is pure and executed by scripts/check-follow-up-
// defaults.mjs against every combination. gatherQuoteChaseFacts() is the
// only I/O.

/**
 * The reasons a quote is left alone. Each maps to a sentence the page prints
 * (app.followFlow.stop*), so a reason cannot exist without its explanation.
 */
export const QUOTE_STOP_REASONS = Object.freeze([
  "answered", // accepted or declined — status is no longer "sent"
  "expired", // validUntil is in the past
  "replied", // the client wrote back on a thread tied to the quote or to them
  "superseded", // a newer quote to the same client exists
  "before_rule", // the quote went out before a FieldQuo default was switched on
]);

/**
 * @param quote          needs status, sentAt, validUntil
 * @param rule           needs builtInKey, createdAt
 * @param facts          { laterQuoteExists: boolean, clientRepliedAt: Date|null }
 * @param now            injectable clock
 * @returns {string|null} the reason to stop, or null to chase
 */
export function quoteChaseBlocker({ quote, rule, facts = {}, now = new Date() } = {}) {
  if (!quote) return "answered";
  if (quote.status !== "sent") return "answered";

  if (quote.validUntil && new Date(quote.validUntil).getTime() < now.getTime()) {
    return "expired";
  }

  // A reply AFTER the quote went out. A message from before the send is the
  // conversation that produced the quote, not a response to it.
  if (facts.clientRepliedAt && quote.sentAt) {
    if (new Date(facts.clientRepliedAt).getTime() > new Date(quote.sentAt).getTime()) {
      return "replied";
    }
  }

  if (facts.laterQuoteExists) return "superseded";

  // ── The defaults start from the day they were switched on ─────────────────
  //
  // The finders deliberately have no time floor — a hand-made rule created
  // today catches up on last month, and the cron comment says so. A FieldQuo
  // default is different: it was seeded onto every company at once, over
  // quotes that had been sitting at "sent" for months. Without this line the
  // first cron run after the backfill would send day-1, day-7 AND day-14 in
  // the same minute to every one of those clients, each saying "the quote we
  // sent yesterday". So a built-in only chases a quote sent after the rule
  // existed. Hand-made rules keep their catch-up behaviour.
  if (rule?.builtInKey && rule?.createdAt && quote.sentAt) {
    if (new Date(quote.sentAt).getTime() < new Date(rule.createdAt).getTime()) {
      return "before_rule";
    }
  }

  return null;
}

/**
 * The two facts the decision needs that are not on the quote row.
 *
 * "Replied" is the latest INBOUND message on any of the company's threads
 * that name this quote (MessageThread.quoteId) or this client
 * (MessageThread.clientId). Email replies to the quote go straight to the
 * company's own inbox (resolveSender sets Reply-To to it), so FieldQuo can only
 * see replies that arrived through channels it carries — SMS, WhatsApp, Meta.
 * That is the honest limit and the page says so.
 *
 * "Superseded" is any newer, non-historical quote to the same client.
 */
export async function gatherQuoteChaseFacts(db, quote) {
  const [laterQuote, reply] = await Promise.all([
    db.quote.findFirst({
      where: {
        companyId: quote.companyId,
        clientId: quote.clientId,
        id: { not: quote.id },
        createdAt: { gt: quote.createdAt },
        historicalImportedAt: null,
      },
      select: { id: true },
    }),
    db.message.findFirst({
      where: {
        direction: "in",
        thread: {
          companyId: quote.companyId,
          OR: [{ quoteId: quote.id }, { clientId: quote.clientId }],
        },
        ...(quote.sentAt && { createdAt: { gt: quote.sentAt } }),
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    laterQuoteExists: Boolean(laterQuote),
    clientRepliedAt: reply?.createdAt || null,
  };
}
