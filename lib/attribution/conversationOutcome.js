// lib/attribution/conversationOutcome.js
//
// "This Facebook message — did it turn into a job?"
//
// The owner's question, answered from the pipeline itself rather than from
// somebody remembering to tick a box. Pure: it takes a conversation, the match
// lib/contacts/matchContact.js made, and the company's quotes/jobs/invoices,
// and returns a verdict with the evidence attached. No database, no clock
// beyond the dates it is handed.
//
// ══ Two "outcomes", and they are allowed to disagree ═══════════════════════
//
// lib/messaging/outcomes.js holds THREAD_OUTCOMES — won / lost / no_reply /
// not_a_job — which is what a PERSON judged the thread to be, set by hand on
// the thread. This file computes what the DATA can prove: a quote exists, it
// was accepted, a job was created, an invoice was raised.
//
// They are deliberately separate vocabularies and neither overrides the other.
// A thread somebody marked `won` that this file calls `no_quote` was almost
// certainly quoted on paper or won over the phone, and that gap is worth
// seeing rather than flattening — the same argument monthlyReview.js already
// makes about a thread measured as unanswered but marked won.
//
// ══ The five states, and why `unmatched` is not `lost` ═════════════════════
//
//   won        a quote followed the conversation and was accepted, or a job
//              exists for it. The one that pays for the feature.
//   quoted     a quote followed and is still open. A REAL state: a live quote
//              is not a loss, and folding it into `lost` would make every
//              month look worse than it is until the client answers.
//   lost       a quote followed and was declined. They said no.
//   no_quote   we know who they are, and no quote ever followed. This is the
//              actionable one — an enquiry from somebody already on file that
//              produced nothing.
//   unmatched  we could not tell who this was. NOT a loss. "We could not tell"
//              and "we failed" are different sentences, and every rate in
//              lib/attribution/monthlyConversations.js keeps this state out of
//              its denominator for that reason.
//
// ══ A recorded link beats an inferred one ═════════════════════════════════
//
// MessageThread.quoteId and LeadRequest.quoteId exist. When one of them points
// at a quote, THAT is the attributed quote: somebody stated the link, and no
// window rule or name match may overrule a statement with a guess. The window
// below applies only to inference.
import { meetsConfidence } from "@/lib/contacts/matchContact";

/**
 * How long after a conversation a quote may still be attributed to it.
 *
 * Sixty days. A homeowner messages in March about a deck, gets a quote, thinks
 * about it over two pay cheques and books in May — that is one conversation,
 * and a 30-day window would drop the half of this trade that involves saving
 * up. Past 60 days the link stops being evidence and starts being coincidence:
 * a repeat customer messaging in March and buying a bathroom in September was
 * sold by something else, and crediting Facebook for it would inflate the one
 * number this feature exists to report honestly.
 *
 * Named, exported, and passed as `windowDays` by any caller that disagrees —
 * so the assumption is visible on screen instead of buried in a comparison.
 */
export const ATTRIBUTION_WINDOW_DAYS = 60;

/**
 * Where a conversation came from. Meta's four, spelled the same everywhere.
 *
 * The first three map one-to-one onto lib/messaging/platforms.js's
 * SOURCE_FOR_PLATFORM; `meta_lead_ad` has no messaging platform behind it (a
 * lead form is not a conversation anybody replied to) and so appears only
 * here. scripts/check-whatsapp.mjs asserts the two lists agree, because a
 * platform whose source is not in this list drops silently out of the whole
 * month-end rollup — a missing number, which is the kind nobody notices.
 */
export const CONVERSATION_SOURCES = Object.freeze([
  "meta_messenger",
  "meta_instagram",
  "meta_whatsapp",
  "meta_lead_ad",
]);

/** Every value `outcome` may hold. Closed list, so a screen can switch on it. */
export const ATTRIBUTION_OUTCOMES = Object.freeze(["won", "quoted", "lost", "no_quote", "unmatched"]);

/**
 * The confidence at which a conversation may be attributed WITHOUT anybody
 * confirming it.
 *
 * "likely" — an email or phone identifier, or a full name plus an agreeing
 * address. A name on its own is `possible` and stops here, because two
 * homeowners called J. Smith in one city is the ordinary case and a wrongly
 * credited job is a number nobody can ever un-believe.
 */
export const AUTO_LINK_CONFIDENCE = "likely";

const ms = (d) => {
  if (d === null || d === undefined) return null;
  const t = d instanceof Date ? d.getTime() : Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

/**
 * A money column as a number, or null.
 *
 * Prisma Decimals arrive as objects. `Number(decimal)` on one of those is NaN
 * on some shapes, and a NaN that reaches a sum turns a month's revenue into
 * "NaN" on screen — so this goes through the string form and returns null for
 * anything that will not parse. Null, never 0: a missing invoice total is not
 * a free job.
 */
export function toAmount(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide what one conversation produced.
 *
 * @param conversation {{ id, source, startedAt, quoteId?, clientId?,
 *                        contact?: { name, email, phone, address } }}
 *        `quoteId` is a RECORDED link (MessageThread.quoteId /
 *        LeadRequest.quoteId) and wins over inference when it is present.
 * @param match  the result of lib/contacts/matchContact.js, or null. Passing
 *        null is the honest representation of "nobody has looked yet" and
 *        produces `unmatched`, not `lost`.
 * @param quotes  the company's quotes for the window, each
 *        { id, clientId, status, createdAt, total, acceptedTotal, acceptedAt, declinedAt }
 * @param jobs    { id, quoteId, clientId, status }
 * @param invoices { id, quoteId, jobId, total, status }
 * @param windowDays  see ATTRIBUTION_WINDOW_DAYS.
 *
 * Rows are passed in rather than queried for the reason every pure module in
 * this repo gives: the cases that matter — a quote raised the day BEFORE the
 * message, a client with two quotes, a won quote with no invoice yet — are
 * then executed rather than argued about.
 */
export function conversationOutcome({
  conversation = {},
  match = null,
  quotes = [],
  jobs = [],
  invoices = [],
  windowDays = ATTRIBUTION_WINDOW_DAYS,
} = {}) {
  const startedAt = ms(conversation.startedAt);
  const source = CONVERSATION_SOURCES.includes(conversation.source) ? conversation.source : null;

  const base = {
    conversationId: conversation.id ?? null,
    source,
    startedAt: conversation.startedAt ?? null,
    windowDays,
    clientId: null,
    confidence: match?.confidence || "none",
    reasons: match?.reasons || [],
    conflicts: match?.conflicts || [],
    ambiguous: Boolean(match?.ambiguous),
    alternatives: match?.alternatives || [],
    link: null,
    quoteId: null,
    quoteStatus: null,
    quoteCreatedAt: null,
    quoteTotal: null,
    jobId: null,
    invoiceId: null,
    invoiceTotal: null,
    consideredQuotes: 0,
    excluded: { beforeConversation: 0, afterWindow: 0, otherClient: 0 },
  };

  // ── Who was it? ─────────────────────────────────────────────────────────
  //
  // A client the caller states (`conversation.clientId`, written when somebody
  // linked the thread by hand) is taken as given. Otherwise the matcher's
  // answer is used, and only at AUTO_LINK_CONFIDENCE or better.
  const statedClientId = conversation.clientId || null;
  const matchedClientId = match?.client?.id || match?.clientId || null;
  const autoLinkable = matchedClientId && meetsConfidence(match?.confidence, AUTO_LINK_CONFIDENCE) && !match?.ambiguous;
  const clientId = statedClientId || (autoLinkable ? matchedClientId : null);

  if (!clientId) {
    return {
      ...base,
      outcome: "unmatched",
      why: match?.ambiguous
        ? `${(match.alternatives || []).length + 1} clients match this conversation equally well, so it is left unattached rather than credited to the wrong one.`
        : match?.why || "Nobody on file could be matched to this conversation, so what it produced is not known. That is not the same as it producing nothing.",
    };
  }

  const linkedBy = statedClientId ? "stated" : "matched";
  const withClient = { ...base, clientId, link: linkedBy };

  // ── A recorded quote link ends the question ─────────────────────────────
  const recorded = conversation.quoteId
    ? (quotes || []).find((q) => q && q.id === conversation.quoteId)
    : null;
  if (recorded) {
    return decide(withClient, recorded, jobs, invoices, {
      link: "recorded",
      why: "This conversation is linked to a quote on the record — no window or name match was needed.",
    });
  }

  // ── Otherwise: quotes for this client, inside the window, AFTER the start ─
  const windowEnd = startedAt === null ? null : startedAt + windowDays * 24 * 60 * 60 * 1000;
  const eligible = [];
  for (const q of quotes || []) {
    if (!q || !q.id) continue;
    if (q.clientId !== clientId) { withClient.excluded.otherClient += 1; continue; }
    const created = ms(q.createdAt);
    if (startedAt !== null && created !== null) {
      // A quote that predates the conversation was produced by something else.
      // Attributing it here would let one Facebook message take credit for
      // work that was already quoted before it arrived.
      if (created < startedAt) { withClient.excluded.beforeConversation += 1; continue; }
      if (windowEnd !== null && created > windowEnd) { withClient.excluded.afterWindow += 1; continue; }
    }
    eligible.push(q);
  }
  withClient.consideredQuotes = eligible.length;

  if (!eligible.length) {
    const extra = withClient.excluded.beforeConversation
      ? ` ${withClient.excluded.beforeConversation} quote${withClient.excluded.beforeConversation > 1 ? "s" : ""} for them predates the conversation and belongs to whatever produced it.`
      : "";
    return {
      ...withClient,
      outcome: "no_quote",
      why: `${matchLabel(match, linkedBy)} No quote followed this conversation within ${windowDays} days.${extra}`,
    };
  }

  // Oldest first: the quote that FOLLOWED the conversation is the one it
  // produced. A later, larger quote for the same client is a second sale.
  eligible.sort((a, b) => (ms(a.createdAt) || 0) - (ms(b.createdAt) || 0));

  const isWon = (q) => q.status === "accepted" || (jobs || []).some((j) => j && j.quoteId === q.id);
  const won = eligible.find(isWon);
  if (won) return decide(withClient, won, jobs, invoices, { link: linkedBy, why: matchLabel(match, linkedBy) });

  // An OPEN quote outranks a declined one. A client who declined a bathroom
  // and is still considering a deck has not finished producing, and reporting
  // that conversation as `lost` while a live quote sits in the pipeline would
  // be wrong the moment they accept it.
  const open = eligible.find((q) => q.status === "draft" || q.status === "sent");
  if (open) return decide(withClient, open, jobs, invoices, { link: linkedBy, why: matchLabel(match, linkedBy) });

  return decide(withClient, eligible[0], jobs, invoices, { link: linkedBy, why: matchLabel(match, linkedBy) });
}

function matchLabel(match, linkedBy) {
  if (linkedBy === "stated") return "This conversation was linked to a client by hand.";
  const reasons = match?.reasons?.length ? match.reasons.join(" + ") : "no stated evidence";
  return `Matched to a client on ${reasons} (${match?.confidence || "none"}).`;
}

/** Turn one attributed quote into the verdict, with its job and invoice. */
function decide(carrier, quote, jobs, invoices, { link, why }) {
  const job = (jobs || []).find((j) => j && j.quoteId === quote.id) || null;
  const invoice =
    (invoices || []).find((i) => i && i.quoteId === quote.id) ||
    (job ? (invoices || []).find((i) => i && i.jobId === job.id) : null) ||
    null;

  const wonByStatus = quote.status === "accepted";
  const outcome = wonByStatus || job ? "won" : quote.status === "declined" ? "lost" : "quoted";

  const evidence = wonByStatus && job ? "accepted, and a job exists" : wonByStatus ? "accepted" : job ? "a job exists for it" : quote.status;

  return {
    ...carrier,
    link,
    outcome,
    quoteId: quote.id,
    quoteStatus: quote.status ?? null,
    quoteCreatedAt: quote.createdAt ?? null,
    // What the client agreed to, when they agreed to something — the same
    // preference lib/analytics and the past-jobs importer use. Falls back to
    // the quoted total, and stays null rather than 0 when neither is set.
    quoteTotal: toAmount(quote.acceptedTotal ?? quote.total ?? null),
    jobId: job ? job.id : null,
    invoiceId: invoice ? invoice.id : null,
    // Null when a won job has not been invoiced yet. A screen must print "not
    // invoiced yet", never "$0" — and monthlyConversations counts these
    // separately so a month's revenue can say how much of it is unknown.
    invoiceTotal: invoice ? toAmount(invoice.total) : null,
    why: `${why} The quote is ${evidence}.`,
  };
}
