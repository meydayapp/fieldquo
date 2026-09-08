// lib/attribution/loadMonthlyConversations.js
//
// The database half of the conversation attribution — the part that was
// missing.
//
// lib/attribution/conversationOutcome.js and lib/attribution/monthlyConversations.js
// were written pure and, until this file, had NO caller at all: the arithmetic
// existed, was executed by scripts/check-conversation-attribution.mjs, and
// nothing in the product ever ran it against a real month. This is the loader
// that reads the rows and hands them over, and it is deliberately the only
// thing in this path that touches Prisma. Nothing here computes a rate, a
// median or a total — a number computed in a loader is a number no check can
// reach.
//
// ══ How a Facebook stranger becomes a client, honestly ═════════════════════
//
// Meta gives us a display name and a page-scoped id. A name on its own is a
// `possible` match and lib/contacts/matchContact.js refuses to auto-link on
// one — deliberately, because two homeowners called J. Smith in one city is
// the ordinary case. Left there, essentially every conversation would report
// `unmatched` forever, which is honest and useless.
//
// So three sources of evidence are used, in this order:
//
//   1. A RECORDED link. MessageThread.clientId / .quoteId, set by a person in
//      the inbox, and Quote.sourceThreadId, stamped at creation by whoever
//      made the quote out of the thread. A stated link beats every inference
//      and ends the question (see conversationOutcome.js's header).
//   2. What the homeowner TYPED. People put their email and their phone number
//      into the second message — "can you call me on 613-555-0142" — and that
//      is a certain-tier identifier, not a name guess. Extracted with the same
//      patterns lib/ai/conversationReview.js redacts with, from
//      lib/attribution/contactPatterns.js, so the redactor can never be
//      narrower than the extractor.
//   3. The display name, as a candidate only. It reaches `possible` and stops
//      there, exactly as it should.
//
// Evidence 2 is read from INBOUND messages only. An outbound message contains
// the CONTRACTOR's phone number and email in the signature, and matching on
// those would attach every conversation to whichever client happens to share
// the company's own details.
import {
  CLIENT_MATCH_SELECT,
  matchContactAgainst,
} from "@/lib/contacts/matchContact";
import { firstResponse, monthRange } from "@/lib/messaging/monthlyReview";
import {
  ATTRIBUTION_WINDOW_DAYS,
  conversationOutcome,
} from "./conversationOutcome";
import { monthlyConversations } from "./monthlyConversations";
import { firstEmail, firstPhone } from "./contactPatterns";

/**
 * How many messages of one conversation are read.
 *
 * A month of threads with every message body is the query that is fine until
 * it isn't — see the same caution in app/api/messaging/review/route.js, which
 * fetches no bodies at all for exactly that reason. This one needs the bodies
 * (there is no transcript without them), so it caps instead: the opening
 * exchange is where a conversation is won or lost, and message ninety of a
 * long back-and-forth about paint colours is not what an assessment turns on.
 */
export const MAX_MESSAGES_PER_THREAD = 40;

// Meta's platform strings, as CONVERSATION_SOURCES spells them. Imported
// rather than declared: this map used to exist here AND in
// lib/aiEmployee/respond.js's platformSource(), and a third platform added to
// one copy and not the other is a month of WhatsApp conversations attributed
// to nothing at all. One map now — lib/messaging/platforms.js.
import { sourceForPlatform } from "@/lib/messaging/platforms";

/**
 * The contact evidence one thread carries. Pure, exported, executed by the
 * check — this is the function that decides what gets matched on, and getting
 * it wrong attaches one homeowner's conversation to another's invoice.
 *
 * @param thread { participantName, messages: [{ direction, body }] }
 */
export function contactFromThread(thread) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  let email = null;
  let phone = null;
  for (const m of messages) {
    // Inbound only. See the header: an outbound signature carries the
    // CONTRACTOR's own details.
    if (!m || m.direction !== "in") continue;
    if (!email) email = firstEmail(m.body);
    if (!phone) phone = firstPhone(m.body);
    if (email && phone) break;
  }
  return {
    name: thread?.participantName || null,
    email,
    phone,
    // Never matched on. A street address typed into a chat is where the WORK
    // is, which is often not where the client record says they live, and
    // addressAgreement treats a disagreement as a conflict that lowers
    // confidence. Extracting it would make matching worse, not better.
    address: null,
  };
}

/**
 * A month of this company's Meta conversations, attributed and rolled up.
 *
 * @param db         a Prisma client. Passed in rather than imported so a check
 *                   can stub it — the same convention matchContact() uses.
 * @param companyId  the tenant. Every query below carries it.
 * @param year/month 1-12, as monthRange.
 * @param windowDays how long after a conversation a quote may still be
 *                   attributed to it. Defaults to ATTRIBUTION_WINDOW_DAYS.
 *
 * @returns { ok, month, range, rollup, threads }
 *          `rollup` is monthlyConversations()' object, untouched.
 *          `threads` carries the message bodies, for the ONE caller that needs
 *          them — lib/ai/conversationReview.js, which redacts them before a
 *          model sees a word. Nothing else should read them.
 */
export async function loadMonthlyConversations({
  db,
  companyId,
  year,
  month,
  windowDays = ATTRIBUTION_WINDOW_DAYS,
}) {
  if (!companyId) throw new Error("loadMonthlyConversations: companyId is required");
  const range = monthRange(year, month);
  if (!range) return { ok: false, reason: "bad_month" };

  // Threads that STARTED in the month — createdAt, not lastMessageAt, matching
  // app/api/messaging/review/route.js. A conversation that opened in August and
  // ran into September belongs to August, and counting it in both would let one
  // enquiry be won twice.
  const threads = await db.messageThread.findMany({
    where: { companyId, createdAt: { gte: range.start, lt: range.end } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      participantName: true,
      createdAt: true,
      clientId: true,
      quoteId: true,
      channel: { select: { platform: true, name: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        take: MAX_MESSAGES_PER_THREAD,
        select: { direction: true, body: true, sentAt: true, failedReason: true },
      },
    },
  });

  if (!threads.length) {
    return {
      ok: true,
      month: range.key,
      range,
      rollup: monthlyConversations({ conversations: [], year, month }),
      threads: [],
    };
  }

  // The attribution window extends PAST the month: a March conversation may
  // still be quoted in May. Reading only March's quotes would report every one
  // of those as `no_quote` and understate the month permanently, since a
  // month's review is usually opened while the window is still open.
  const quoteWindowEnd = new Date(range.end.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const [clients, quotes] = await Promise.all([
    db.client.findMany({ where: { companyId }, select: CLIENT_MATCH_SELECT }),
    db.quote.findMany({
      // From the start of the month — a quote raised BEFORE a conversation is
      // excluded by conversationOutcome itself, and reading a little wider than
      // needed lets it count those exclusions instead of never seeing them.
      where: { companyId, createdAt: { gte: range.start, lt: quoteWindowEnd } },
      select: {
        id: true,
        clientId: true,
        status: true,
        createdAt: true,
        total: true,
        acceptedTotal: true,
        acceptedAt: true,
        declinedAt: true,
        // The provenance column. Read here — this is what makes
        // Quote.sourceThreadId a recorded link rather than a write nobody
        // consults.
        sourceThreadId: true,
        createdVia: true,
      },
    }),
  ]);

  const quoteIds = quotes.map((q) => q.id);
  const [jobs, invoices] = await Promise.all([
    quoteIds.length
      ? db.job.findMany({
          where: { companyId, quoteId: { in: quoteIds } },
          select: { id: true, quoteId: true, clientId: true, status: true },
        })
      : Promise.resolve([]),
    quoteIds.length
      ? db.invoice.findMany({
          where: { companyId, quoteId: { in: quoteIds } },
          select: { id: true, quoteId: true, jobId: true, total: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  // Quote.sourceThreadId, indexed by thread. FIRST wins: a conversation that
  // produced two quotes was won by the one that followed it, and
  // conversationOutcome's own rule is oldest-first for the same reason.
  const quoteByThread = new Map();
  for (const q of quotes) {
    if (!q.sourceThreadId) continue;
    const held = quoteByThread.get(q.sourceThreadId);
    if (!held || new Date(q.createdAt) < new Date(held.createdAt)) {
      quoteByThread.set(q.sourceThreadId, q);
    }
  }

  // Every quote by id, so a conversation's attributed quote can carry its
  // origin. A lookup, not a computation — nothing here counts anything.
  const quoteById = new Map(quotes.map((q) => [q.id, q]));

  const rows = threads.map((t) => {
    const reply = firstResponse(t);
    const match = matchContactAgainst({
      clients,
      companyId,
      contact: contactFromThread(t),
    });

    const outcome = conversationOutcome({
      conversation: {
        id: t.id,
        source: sourceForPlatform(t.channel?.platform),
        startedAt: t.createdAt,
        clientId: t.clientId || null,
        // Either recorded link. The one a person set in the inbox comes first
        // because it is the more deliberate statement; the stamped one is the
        // fallback for a quote nobody thought to link by hand.
        quoteId: t.quoteId || quoteByThread.get(t.id)?.id || null,
      },
      match,
      quotes,
      jobs,
      invoices,
      windowDays,
    });

    return {
      id: t.id,
      participantName: t.participantName || null,
      source: sourceForPlatform(t.channel?.platform),
      channelName: t.channel?.name || null,
      startedAt: t.createdAt,
      // firstResponse returns { answered, minutes }. monthlyConversations wants
      // `answered` and `firstReplyMinutes`, and treats a thread with NO inbound
      // message as unknown rather than unanswered — nothing was asked of the
      // company there, so nobody failed to reply.
      answered: reply.noInbound ? null : reply.answered,
      firstReplyMinutes: reply.minutes,
      outcome,
      // WHO made the quote this conversation produced — the second half of the
      // owner's question ("by the company, and by the AI agent"). Null when the
      // conversation produced no quote, and null when it produced one written
      // before Quote.createdVia existed. Those are two different absences and
      // neither is "staff": see lib/quotes/createdVia.js.
      quoteCreatedVia: outcome.quoteId ? quoteById.get(outcome.quoteId)?.createdVia ?? null : null,
      // Raw. Redacted downstream, never here — a loader that half-redacts is
      // how a caller comes to believe text is safe when it is not.
      messages: (t.messages || []).map((m) => ({
        direction: m.direction,
        body: m.body,
        sentAt: m.sentAt,
        failedReason: m.failedReason || null,
      })),
      // Carried so the caller can prove tenancy on rows it did not query
      // itself. lib/ai/conversationReview.js REFUSES on a mismatch rather than
      // dropping the row.
      companyId,
    };
  });

  return {
    ok: true,
    month: range.key,
    range,
    rollup: monthlyConversations({ conversations: rows, year, month }),
    threads: rows,
  };
}
