// lib/attribution/conversionEvidence.js
//
// "This lead came from Facebook — did it actually become a paying job, and how
// do we know?" Answered with the evidence attached, and with a line drawn
// between what is CONFIRMED and what is merely POSSIBLE.
//
// ══ Not a parallel system ══════════════════════════════════════════════════
//
// The verdict itself — won / quoted / lost / no_quote / unmatched, the 60-day
// window, "a quote raised before the conversation belongs to something else",
// "a recorded link beats an inference" — is lib/attribution/conversationOutcome.js,
// called unchanged. Who the person is, is lib/contacts/matchContact.js. This
// file adds the two things those did not have:
//
//   1. ADDRESS as evidence, against where the work IS. loadMonthlyConversations
//      deliberately never matches a typed address against Client.address,
//      because the address in a chat is usually the job site and a client's
//      record is usually their home, so a disagreement there would wrongly
//      lower confidence. Here an address is compared with the client's
//      address AND with Quote.siteAddress / Job.siteAddress — and it only
//      ever ADDS evidence. A disagreement is never a conflict.
//   2. The sentence a contractor reads: "matched on phone + address to Quote
//      Q-0123 · accepted · invoice INV-0045 paid $4,200". Every match carries
//      the fields that matched and the record they matched on.
//
// ══ The thresholds ═════════════════════════════════════════════════════════
//
//   confirmed  a RECORDED link (LeadRequest.quoteId, MessageThread.quoteId,
//              Quote.sourceThreadId), or one client matched at
//              AUTO_LINK_CONFIDENCE ("likely") or better and not tied with
//              another: an exact email or phone ("certain"), or a full name —
//              exact or one typo away — PLUS an agreeing address on their
//              record or on one of their quotes/jobs ("likely").
//   possible   a name alone (exact or one typo away), an address alone, or a
//              tie between two clients nothing separates (two clients sharing
//              one phone, say). Shown, labelled "possible", and NEVER counted:
//              not in a won rate, not in a campaign's revenue, not in a total.
//   none       nobody on file agrees with anything.
//
// A shared phone is the ordinary household case, and an address is what
// separates the two: when a tie on phone has exactly one client whose address
// (home, or a quote's site) agrees, that client is the answer; otherwise the
// tie stands and the match is only possible.
//
// Pure: rows in, verdict out, executed by scripts/check-social-leads.mjs.
import {
  addressAgreement,
  addressKey,
  matchContactAgainst,
  meetsConfidence,
} from "@/lib/contacts/matchContact";
import {
  ATTRIBUTION_WINDOW_DAYS,
  AUTO_LINK_CONFIDENCE,
  conversationOutcome,
  toAmount,
} from "./conversationOutcome";
import { invoiceFamilies } from "@/lib/export/accountingExport";

export const CONVERSION_STATUS = Object.freeze(["confirmed", "possible", "none"]);

/** Where an address agreed, for one client. Pure. */
function addressHits(contactAddr, client, quotes, jobs) {
  if (!contactAddr || !client) return [];
  const hits = [];
  const home = addressKey([client.address, client.city, client.province].filter(Boolean).join(", "));
  if (addressAgreement(contactAddr, home) === "agree") hits.push({ type: "client", id: client.id });
  for (const q of quotes || []) {
    if (!q || q.clientId !== client.id || !q.siteAddress) continue;
    if (addressAgreement(contactAddr, addressKey(q.siteAddress)) === "agree") hits.push({ type: "quote", id: q.id, number: q.quoteNumber || null });
  }
  for (const j of jobs || []) {
    if (!j || j.clientId !== client.id || !j.siteAddress) continue;
    if (addressAgreement(contactAddr, addressKey(j.siteAddress)) === "agree") hits.push({ type: "job", id: j.id });
  }
  return hits;
}

/**
 * Who this contact is — matchContact, plus address as additive evidence.
 *
 * Returns matchContactAgainst's shape (so conversationOutcome takes it as its
 * `match`) with `addressOn` added: the records an address agreed with.
 */
export function matchConversation({ clients = [], quotes = [], jobs = [], companyId, contact = {} } = {}) {
  const base = matchContactAgainst({
    clients,
    companyId,
    // Address deliberately left out of the CLIENT score — see the header.
    contact: { name: contact.name || null, email: contact.email || null, phone: contact.phone || null, address: null },
    minConfidence: AUTO_LINK_CONFIDENCE,
    tolerantNames: true,
  });
  const addr = addressKey(contact.address);
  const byId = new Map((clients || []).filter((c) => c && c.id && c.companyId === companyId).map((c) => [c.id, c]));

  // A tie: an agreeing address on exactly one of the tied clients settles it.
  if (base.ambiguous) {
    const tied = (base.tiedIds || []).filter((id) => byId.has(id));
    const withAddr = tied.filter((id) => addressHits(addr, byId.get(id), quotes, jobs).length);
    if (withAddr.length === 1) {
      const c = byId.get(withAddr[0]);
      const reasons = [...new Set([...base.reasons, "address"])];
      return {
        ...base,
        client: c,
        clientId: c.id,
        ambiguous: false,
        reasons,
        addressOn: addressHits(addr, c, quotes, jobs),
        tieBrokenBy: "address",
        candidateIds: [],
        why: `${c.name || "A client"} matches on ${reasons.join(" + ")} — another client shares the ${base.reasons.join(" and ")}, and the address is what tells them apart.`,
      };
    }
    return { ...base, addressOn: [], candidateIds: tied };
  }

  const bestId = base.bestId && byId.has(base.bestId) ? base.bestId : null;
  if (!bestId) {
    // Nobody agreed on name, email or phone. An address alone can point at a
    // client, but only ever as `possible`.
    if (addr) {
      const hitsBy = [...byId.values()]
        .map((c) => ({ c, hits: addressHits(addr, c, quotes, jobs) }))
        .filter((x) => x.hits.length);
      if (hitsBy.length === 1) {
        return {
          ...base,
          confidence: "possible",
          reasons: ["address"],
          addressOn: hitsBy[0].hits,
          candidateIds: [hitsBy[0].c.id],
          why: `Only the address agrees, with ${hitsBy[0].c.name || "one client"}. An address alone is not enough to say it was them.`,
        };
      }
    }
    return { ...base, addressOn: [], candidateIds: [] };
  }

  const best = byId.get(bestId);
  const hits = addressHits(addr, best, quotes, jobs);
  const reasons = hits.length ? [...new Set([...base.reasons, "address"])] : base.reasons;
  let confidence = base.confidence;
  // The one upgrade this file makes: a name (exact or one typo away) with no
  // conflict, plus an address agreeing on their record or their job site, is
  // `likely` — the same rule matchContact's confidenceFor applies to a home
  // address, extended to where the work is.
  if (confidence === "possible" && hits.length && !(base.conflicts || []).length && (reasons.includes("name") || reasons.includes("name_similar"))) {
    confidence = "likely";
  }
  const linkable = meetsConfidence(confidence, AUTO_LINK_CONFIDENCE);
  return {
    ...base,
    client: linkable ? best : null,
    clientId: linkable ? best.id : null,
    confidence,
    reasons,
    addressOn: hits,
    candidateIds: linkable ? [] : [best.id],
    why: linkable
      ? `${best.name || "A client"} matches on ${reasons.join(" + ")}.`
      : `${best.name || "A client"} is a possible match on ${reasons.join(" + ")} — not enough to say it was them.`,
  };
}

/** The paid figure for the documents a conversion produced. Pure. */
function invoiceFacts(invoices, { quoteId, jobId }) {
  const rows = (invoices || []).filter((i) => i && i.status !== "draft" && ((quoteId && i.quoteId === quoteId) || (jobId && i.jobId === jobId)));
  if (!rows.length) return null;
  const families = invoiceFamilies(rows);
  let total = 0;
  let paid = 0;
  let known = false;
  const numbers = [];
  for (const f of families) {
    const latest = f.latest;
    const t = toAmount(latest.total);
    const p = toAmount(latest.amountPaid);
    if (t !== null) { total += t; known = true; }
    if (p !== null) paid += p;
    if (latest.invoiceNumber) numbers.push(latest.invoiceNumber);
  }
  const anyPaid = families.some((f) => f.latest.status === "paid");
  return {
    count: families.length,
    numbers,
    total: known ? Math.round(total * 100) / 100 : null,
    paid: Math.round(paid * 100) / 100,
    fullyPaid: families.every((f) => f.latest.status === "paid"),
    anyPaid,
  };
}

/**
 * Did this conversation (or the lead built from it) become a sale — with the
 * evidence and the confirmed/possible line. Pure.
 *
 * @param conversation { id, source, startedAt, quoteId?, clientId? } —
 *        quoteId/clientId are RECORDED links and win, as conversationOutcome says.
 * @param contact { name, email, phone, address }
 * @param clients CLIENT_MATCH_SELECT rows; quotes { id, clientId, status,
 *        createdAt, total, acceptedTotal, quoteNumber, siteAddress };
 *        jobs { id, quoteId, clientId, status, siteAddress };
 *        invoices { id, quoteId, jobId, total, amountPaid, status,
 *        invoiceNumber, parentInvoiceId, version }
 */
export function verifyConversion({
  conversation = {},
  contact = {},
  clients = [],
  quotes = [],
  jobs = [],
  invoices = [],
  companyId,
  windowDays = ATTRIBUTION_WINDOW_DAYS,
} = {}) {
  if (!companyId) throw new Error("verifyConversion: companyId is required");
  const match = matchConversation({ clients, quotes, jobs, companyId, contact });
  // A recorded quote names its own client. conversationOutcome asks "who?"
  // before it looks at a recorded link, so a lead linked to its quote by hand
  // whose contact details match nobody would otherwise come back `unmatched`
  // — the statement losing to the absence of a guess. The quote's clientId is
  // passed as the STATED client, which is what the link says.
  const recordedQuote = conversation.quoteId ? (quotes || []).find((q) => q && q.id === conversation.quoteId) : null;
  const stated = conversation.clientId || recordedQuote?.clientId || null;
  const outcome = conversationOutcome({ conversation: { ...conversation, clientId: stated }, match, quotes, jobs, invoices, windowDays });

  const recorded = outcome.link === "recorded";
  const linkedClient = Boolean(outcome.clientId);
  let status = "none";
  if (recorded || (linkedClient && outcome.link === "stated")) status = "confirmed";
  else if (linkedClient && meetsConfidence(match.confidence, AUTO_LINK_CONFIDENCE) && !match.ambiguous) status = "confirmed";
  else if (match.confidence !== "none" || (match.candidateIds || []).length) status = "possible";

  // For a POSSIBLE match, what the sale would be if it were them — shown so a
  // person can confirm it, never counted. Computed by stating the candidate
  // as the client, which is exactly what confirming it would do.
  let wouldBe = null;
  if (status === "possible" && (match.candidateIds || []).length === 1) {
    const o = conversationOutcome({ conversation: { ...conversation, clientId: match.candidateIds[0] }, match: null, quotes, jobs, invoices, windowDays });
    if (o.quoteId) wouldBe = describe(o, quotes, jobs, invoices);
  }

  const facts = status === "confirmed" ? describe(outcome, quotes, jobs, invoices) : null;
  return {
    status,
    outcome: status === "confirmed" ? outcome.outcome : status === "possible" ? "unmatched" : outcome.outcome,
    link: outcome.link,
    clientId: status === "confirmed" ? outcome.clientId : null,
    confidence: match.confidence,
    matchedOn: recorded ? ["recorded_link"] : match.reasons || [],
    addressOn: match.addressOn || [],
    conflicts: match.conflicts || [],
    tieBrokenBy: match.tieBrokenBy || null,
    ambiguous: Boolean(match.ambiguous),
    candidateIds: status === "possible" ? match.candidateIds || (match.alternatives || []).map((a) => a.id) : [],
    why: recorded ? outcome.why : match.why,
    ...(facts || {}),
    possible: wouldBe,
    // What may be COUNTED: only a confirmed conversion with a quote. Money is
    // what the invoices say was paid — never the quote total, never a
    // possible match.
    countable: status === "confirmed" && Boolean(outcome.quoteId),
  };
}

function describe(outcome, quotes, jobs, invoices) {
  const q = (quotes || []).find((x) => x && x.id === outcome.quoteId) || null;
  const inv = q ? invoiceFacts(invoices, { quoteId: q.id, jobId: outcome.jobId }) : null;
  return {
    outcomeState: outcome.outcome,
    quote: q ? { id: q.id, number: q.quoteNumber || null, status: q.status || null, total: toAmount(q.acceptedTotal ?? q.total) } : null,
    jobId: outcome.jobId || null,
    invoices: inv,
  };
}
