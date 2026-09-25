// lib/messaging/coachContext.js
//
// Everything "Coach me on this conversation" reads from the database, in one
// place, every query scoped by companyId — so the route stays about gates and
// the coach itself (lib/ai/conversationCoach.js) stays pure and executable
// against plain objects.
//
// ══ What "the same trade" means here ═══════════════════════════════════════
//
// A conversation has no trade of its own. It gets one from what it turned
// into: the ServiceCategory of the QUOTE it produced (QuoteScopeGroup
// .categoryId — a quote can span several trades, so a thread can have
// several), or failing that the category of the LEAD it was linked to. A
// thread with neither has no trade yet, and the rollup says "all judged
// enquiries" rather than pretending to be trade-specific.
//
// ══ The tenant fence is doubled, as everywhere else in this feature ════════
//
// Every query below carries `companyId` in its WHERE, including the joins
// through Quote and LeadRequest (a quoteId on a thread is a plain column —
// nothing stops a bad write pointing it at another company's quote, so the
// join proves ownership rather than trusting the id). The rows then pass
// through assertOneTenant() inside tradeRollup() and buildExamples(), which
// THROW on a stranger's row rather than dropping it.
import { db as defaultDb } from "@/lib/db";

/** Judged conversations read for the rollup. Bounded — a company's recent record, not its archive. */
export const ROLLUP_THREADS = 400;

/** Candidate example threads whose messages are loaded. buildExamples keeps at most 3 + 3. */
export const EXAMPLE_CANDIDATES = 12;

/** Messages loaded per example thread. The renderer truncates further. */
export const EXAMPLE_MESSAGES = 40;

const MESSAGE_SELECT = { direction: true, private: true, body: true, sentAt: true, failedReason: true };

/** The thread being coached, company-scoped by findFirst. Null when it is not this company's. */
export async function loadCoachThread({ db = defaultDb, companyId, id }) {
  const row = await db.messageThread.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      companyId: true,
      channel: { select: { platform: true } },
      participantName: true,
      quoteId: true,
      leadId: true,
      clientId: true,
      scoreReasons: true,
      client: { select: { name: true, language: true } },
      messages: { orderBy: { sentAt: "asc" }, select: MESSAGE_SELECT },
    },
  });
  if (!row) return null;
  return { ...row, platform: row.channel?.platform || null, clientName: row.client?.name || null };
}

/**
 * thread id → the trade category ids it resolved to, for a set of threads.
 * Quote categories first; the lead's category only when the quote gave none.
 */
async function categoriesFor(db, companyId, threads) {
  const quoteIds = [...new Set(threads.map((t) => t.quoteId).filter(Boolean))];
  const leadIds = [...new Set(threads.map((t) => t.leadId).filter(Boolean))];
  const [groups, leads] = await Promise.all([
    quoteIds.length
      ? db.quoteScopeGroup.findMany({
          where: { quoteId: { in: quoteIds }, quote: { companyId } },
          select: { quoteId: true, categoryId: true },
        })
      : [],
    leadIds.length
      ? db.leadRequest.findMany({
          where: { id: { in: leadIds }, companyId, categoryId: { not: null } },
          select: { id: true, categoryId: true },
        })
      : [],
  ]);
  const byQuote = new Map();
  for (const g of groups) {
    if (!byQuote.has(g.quoteId)) byQuote.set(g.quoteId, new Set());
    byQuote.get(g.quoteId).add(g.categoryId);
  }
  const byLead = new Map(leads.map((l) => [l.id, l.categoryId]));
  const out = new Map();
  for (const t of threads) {
    const fromQuote = t.quoteId ? [...(byQuote.get(t.quoteId) || [])] : [];
    const fromLead = !fromQuote.length && t.leadId && byLead.get(t.leadId) ? [byLead.get(t.leadId)] : [];
    out.set(t.id, [...fromQuote, ...fromLead]);
  }
  return out;
}

/**
 * The grounding for one coaching: this thread's trade, the company's judged
 * record, example conversations (same trade first), and the latest monthly
 * review that found a pattern.
 *
 * @returns {{ categoryIds, tradeLabel, rollupRows, exampleThreads, reviewRow }}
 */
export async function loadCoachContext({ db = defaultDb, companyId, thread }) {
  const judged = await db.messageThread.findMany({
    where: { companyId, outcome: { in: ["won", "lost", "no_reply"] }, id: { not: thread.id } },
    orderBy: { lastMessageAt: "desc" },
    take: ROLLUP_THREADS,
    select: { id: true, companyId: true, outcome: true, quoteId: true, leadId: true },
  });

  const cats = await categoriesFor(db, companyId, [thread, ...judged]);
  const categoryIds = cats.get(thread.id) || [];
  const wanted = new Set(categoryIds);

  const rollupRows = judged.map((t) => ({
    id: t.id,
    companyId: t.companyId,
    outcome: t.outcome,
    categoryIds: cats.get(t.id) || [],
  }));

  // Examples: same trade first, then the rest, newest first within each —
  // buildExamples() takes won and not-won in input order, so the order here
  // IS the preference. A kitchen shop's coaching on a kitchen enquiry should
  // be shown its kitchen wins before its fence repairs.
  const sameTrade = rollupRows.filter((r) => r.categoryIds.some((c) => wanted.has(c)));
  const rest = rollupRows.filter((r) => !r.categoryIds.some((c) => wanted.has(c)));
  const pick = (rows, outcomes, n) => rows.filter((r) => outcomes.includes(r.outcome)).slice(0, n);
  const candidateIds = [
    ...pick([...sameTrade, ...rest], ["won"], EXAMPLE_CANDIDATES / 2),
    ...pick([...sameTrade, ...rest], ["lost", "no_reply"], EXAMPLE_CANDIDATES / 2),
  ].map((r) => r.id);

  const [exampleRows, category, reviewRow] = await Promise.all([
    candidateIds.length
      ? db.messageThread.findMany({
          where: { companyId, id: { in: candidateIds } },
          select: {
            id: true,
            companyId: true,
            outcome: true,
            participantName: true,
            client: { select: { name: true } },
            messages: { orderBy: { sentAt: "asc" }, take: EXAMPLE_MESSAGES, select: MESSAGE_SELECT },
          },
        })
      : [],
    categoryIds.length
      ? db.serviceCategory.findFirst({ where: { id: categoryIds[0] }, select: { label: true } }).catch(() => null)
      : null,
    db.conversationReview
      .findFirst({
        where: { companyId, status: "ready" },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { year: true, month: true, status: true, findings: true },
      })
      .catch(() => null),
  ]);

  // Restore the preference order the IN query threw away.
  const rank = new Map(candidateIds.map((id, i) => [id, i]));
  const exampleThreads = exampleRows
    .map((r) => ({ ...r, clientName: r.client?.name || null }))
    .sort((a, b) => rank.get(a.id) - rank.get(b.id));

  return {
    categoryIds,
    tradeLabel: category?.label || null,
    rollupRows,
    exampleThreads,
    reviewRow,
  };
}

/** The stored coaching for a thread — by (companyId, threadId), never threadId alone. */
export async function loadStoredCoach({ db = defaultDb, companyId, threadId }) {
  return db.conversationCoach.findFirst({ where: { companyId, threadId } });
}
