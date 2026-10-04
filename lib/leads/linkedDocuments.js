// lib/leads/linkedDocuments.js
//
// What a lead turned into: the quote linked to it, the jobs that quote became,
// and the invoices billed from it — the "Linked documents" block in the lead
// drawer (app/app/leads/page.js), and the quote picker behind "Link an
// existing quote".
//
// ── The one link is LeadRequest.quoteId ────────────────────────────────────
//
// A lead has no clientId and no jobId (prisma/schema.prisma, model
// LeadRequest). Everything downstream hangs off the quote: Job.quoteId,
// Invoice.quoteId. So "the jobs on this lead" IS "the jobs on its quote", and
// linking the right quote is what makes the rest appear. That is also why the
// owner's lead could not go back to Won (2026-09-24): the win lived on a quote
// nobody had linked, and there was no control to link one.
//
// ── Each section answers to its own dial ───────────────────────────────────
//
// Reading the lead is the requests dial. The quote, the jobs and the invoices
// are three OTHER categories, and a member allowed the lead is not thereby
// allowed its documents — an Estimator on invoices:none must not read an
// invoice number and a balance off the lead drawer that /app/invoices would
// refuse them. So each section is gated on its own level, and a section the
// member may not see comes back as `{ restricted: true }` rather than empty:
// "no jobs yet" over jobs that exist would send somebody to create one
// (AGENTS.md failure class #5 — absence is not a statement).
//
// Jobs are additionally narrowed by assignedJobWhere, the same scope /app/jobs
// applies, so a crew member sees the lead's job only if they are on it.
//
// Money follows the showPricing toggle through canSeeMoney — the same test
// redactQuoteMoney/redactInvoiceMoney use. Amounts are simply not selected
// for a member without it, and `pricingHidden` says so.
//
// Pure shaping lives here beside the loader so scripts/check-lead-linking.mjs
// can execute it against hostile rows without a database.

import {
  hasLevel,
  canSeeMoney,
  assignedJobWhere,
  redactClient,
} from "@/lib/permissions/enforce";
import { LEAD_QUOTE_EVIDENCE_SELECT, quoteEvidence, wonCheck } from "@/lib/leads/pipeline";
import { CLIENT_MATCH_SELECT, CANDIDATE_SCAN_LIMIT } from "@/lib/contacts/matchContact";
import { verifyConversion } from "@/lib/attribution/conversionEvidence";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/conversationOutcome";
import { sourceForPlatform } from "@/lib/messaging/platforms";

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * What each category lets this member see of the lead's documents.
 * One object so the loader, the candidate search and the tests agree.
 */
export function documentAccess(member) {
  return {
    quotes: hasLevel(member, "quotes", "view_only"),
    jobs: hasLevel(member, "jobs", "view_only"),
    invoices: hasLevel(member, "invoices", "view_only"),
    money: canSeeMoney(member),
  };
}

/** A quote row as the drawer shows it. Money only when `money`. */
export function shapeLinkedQuote(row, { money = false } = {}) {
  if (!row || !row.id) return null;
  const evidence = quoteEvidence(row);
  return {
    id: row.id,
    quoteNumber: row.quoteNumber || null,
    status: row.status || null,
    hasWork: evidence?.hasWork || false,
    createdAt: row.createdAt || null,
    client: row.client ? { id: row.client.id || null, name: row.client.name || null } : null,
    ...(money
      ? { total: num(row.acceptedTotal) ?? num(row.total) }
      : { pricingHidden: true }),
  };
}

export function shapeLinkedJob(row) {
  if (!row || !row.id) return null;
  return {
    id: row.id,
    title: row.title || null,
    status: row.status || null,
    startDate: row.startDate || null,
  };
}

/**
 * One invoice FAMILY as one row: the root's identity, the latest version's
 * state. A revised invoice is a new row pointing at its root
 * (parentInvoiceId), and listing every version would print one invoice three
 * times — the same one-row-per-family rule GET /api/invoices follows.
 */
export function shapeLinkedInvoice(root, { money = false } = {}) {
  if (!root || !root.id) return null;
  const latest = Array.isArray(root.versions) && root.versions[0] ? root.versions[0] : root;
  return {
    id: latest.id || root.id,
    invoiceNumber: latest.invoiceNumber || root.invoiceNumber || null,
    status: latest.status || root.status || null,
    ...(money
      ? { total: num(latest.total), amountDue: num(latest.amountDue) }
      : { pricingHidden: true }),
  };
}

const INVOICE_FIELDS = { id: true, invoiceNumber: true, status: true };
const INVOICE_MONEY_FIELDS = { total: true, amountDue: true };

/**
 * Load the linked documents for a lead this member may already read.
 *
 * @param db       Prisma client
 * @param lead     { id, quoteId } — already tenant-checked by the caller
 * @param full     loadEnforceableMember row (grid + userId)
 * @param companyId
 */
export async function loadLeadDocuments(db, { lead, full, companyId }) {
  const access = documentAccess(full);
  const out = {
    canSeeMoney: access.money,
    quote: null,
    jobs: [],
    invoices: [],
    won: null,
  };

  if (!lead?.quoteId) {
    out.won = wonCheck({ quote: null });
    return out;
  }

  const quote = await db.quote.findFirst({
    // companyId again, not just the id: a quoteId on a lead is trusted only
    // as far as it points inside the same tenant.
    where: { id: lead.quoteId, companyId },
    select: {
      ...LEAD_QUOTE_EVIDENCE_SELECT,
      createdAt: true,
      client: { select: { id: true, name: true } },
      ...(access.money && { total: true, acceptedTotal: true }),
    },
  });
  if (!quote) {
    out.won = wonCheck({ quote: null });
    return out;
  }

  // The Won verdict is computed from the quote whatever the member's quotes
  // level: it is the reason the status control gives, and GET /api/leads
  // already carries the quote's number and status on the card.
  out.won = wonCheck({ quote });

  out.quote = access.quotes
    ? shapeLinkedQuote(
        { ...quote, client: quote.client ? redactClient(full, quote.client) : null },
        { money: access.money },
      )
    : { restricted: true, quoteNumber: quote.quoteNumber, status: quote.status };

  if (access.jobs) {
    const jobs = await db.job.findMany({
      where: { quoteId: quote.id, companyId, archivedAt: null, ...assignedJobWhere(full) },
      select: { id: true, title: true, status: true, startDate: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    out.jobs = jobs.map(shapeLinkedJob).filter(Boolean);
  } else {
    out.jobs = { restricted: true };
  }

  if (access.invoices) {
    const fields = { ...INVOICE_FIELDS, ...(access.money && INVOICE_MONEY_FIELDS) };
    const roots = await db.invoice.findMany({
      where: { quoteId: quote.id, companyId, parentInvoiceId: null },
      select: {
        ...fields,
        versions: { select: fields, orderBy: { version: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    out.invoices = roots
      .map((r) => shapeLinkedInvoice(r, { money: access.money }))
      .filter(Boolean);
  } else {
    out.invoices = { restricted: true };
  }

  return out;
}

// ── "Link an existing quote" — the candidates ─────────────────────────────
//
// Which quotes to offer. Two sources, one list:
//
//   * the lead's own client — matched the way convertLead.findOrCreateClient
//     matches (email, then phone), so "the quote for this person" means the
//     same thing in both directions. Offered first, with no typing, because
//     the usual case is "the quote is right there under their name".
//   * a search the person types — quote number or client name, company-wide,
//     for the lead that came in under a spouse's name or a typo.
//
// Only quotes NOT already linked to another lead: LeadRequest.quoteId is
// @unique (one lead becomes at most one quote), so offering one would be
// offering a row the write refuses.

/** Normalise a lead's contact details into the where-clauses they can match. */
export function leadClientMatch(lead) {
  const email = typeof lead?.email === "string" ? lead.email.trim().toLowerCase() : "";
  const phone = typeof lead?.phone === "string" ? lead.phone.trim() : "";
  const or = [];
  if (email && email.includes("@")) or.push({ email: { equals: email, mode: "insensitive" } });
  if (phone && phone.replace(/\D/g, "").length >= 7) or.push({ phone });
  return or;
}

const STATUS_RANK = { accepted: 0, sent: 1, draft: 2, declined: 3 };

/**
 * Order the candidates: this lead's client first, then the quotes that could
 * actually make the lead Won (approved, or with work on it), then newest.
 * Pure, for the check script.
 */
export function rankQuoteCandidates(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .filter((r) => r && r.id)
    .sort((a, b) => {
      if (Boolean(b.matchesLead) !== Boolean(a.matchesLead)) return b.matchesLead ? 1 : -1;
      const wa = wonCheck({ quote: a }).ok ? 0 : 1;
      const wb = wonCheck({ quote: b }).ok ? 0 : 1;
      if (wa !== wb) return wa - wb;
      const sa = STATUS_RANK[a.status] ?? 9;
      const sb = STATUS_RANK[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

/** A typed search term, trimmed and bounded; "" when there is nothing to search. */
export function cleanQuoteSearch(q) {
  if (typeof q !== "string") return "";
  return q.trim().slice(0, 80);
}

/**
 * Quotes this lead could be linked to.
 *
 * @returns {Promise<object[]>} shaped rows, `matchesLead` true for the lead's
 *   own client, each carrying `wouldWin` so the picker can say which ones
 *   make the lead Won before anybody taps.
 */
export async function findQuoteCandidates(db, { lead, full, companyId, q = "" }) {
  const access = documentAccess(full);
  const term = cleanQuoteSearch(q);
  const clientOr = leadClientMatch(lead);

  const base = {
    companyId,
    archivedAt: null,
    // Not linked to any lead yet — see the header.
    lead: { is: null },
  };
  const select = {
    ...LEAD_QUOTE_EVIDENCE_SELECT,
    createdAt: true,
    clientId: true,
    client: { select: { id: true, name: true } },
    ...(access.money && { total: true, acceptedTotal: true }),
  };

  const [mine, searched] = await Promise.all([
    clientOr.length
      ? db.quote.findMany({
          where: { ...base, client: { OR: clientOr } },
          select,
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [],
    term
      ? db.quote.findMany({
          where: {
            ...base,
            OR: [
              { quoteNumber: { contains: term, mode: "insensitive" } },
              { client: { name: { contains: term, mode: "insensitive" } } },
            ],
          },
          select,
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [],
  ]);

  const mineIds = new Set(mine.map((r) => r.id));
  const merged = new Map();
  for (const r of [...mine, ...searched]) {
    if (!merged.has(r.id)) merged.set(r.id, { ...r, matchesLead: mineIds.has(r.id) });
  }

  return rankQuoteCandidates(
    [...merged.values()].map((r) => ({
      ...shapeLinkedQuote(
        { ...r, client: r.client ? redactClient(full, r.client) : null },
        { money: access.money },
      ),
      matchesLead: r.matchesLead,
    })),
  ).map((r) => ({ ...r, wouldWin: wonCheck({ quote: r }).ok }));
}

// ── "Did it convert?" — for a lead from Facebook, Instagram or WhatsApp ───
//
// lib/attribution/conversionEvidence.js decides; this reads the rows and
// redacts the answer to what this member may see, by the same three dials as
// the sections above. A quote number is a quotes-dial fact, an invoice number
// an invoices-dial fact, and a paid amount a money fact — the verdict itself
// ("confirmed", "matched on phone + address") is the requests dial's, because
// it describes the lead.

/** Shape a verifyConversion() answer for one member. Pure. */
export function shapeConversion(v, access) {
  if (!v) return null;
  const docs = (facts) => {
    if (!facts) return null;
    return {
      outcome: facts.outcomeState || null,
      quote: facts.quote
        ? access.quotes
          ? { id: facts.quote.id, number: facts.quote.number, status: facts.quote.status, ...(access.money ? { total: facts.quote.total } : {}) }
          : { restricted: true }
        : null,
      invoices: facts.invoices
        ? access.invoices
          ? {
              count: facts.invoices.count,
              numbers: facts.invoices.numbers,
              fullyPaid: facts.invoices.fullyPaid,
              anyPaid: facts.invoices.anyPaid,
              ...(access.money ? { paid: facts.invoices.paid, total: facts.invoices.total } : { pricingHidden: true }),
            }
          : { restricted: true }
        : null,
    };
  };
  return {
    status: v.status,
    outcome: v.outcome,
    confidence: v.confidence,
    matchedOn: v.matchedOn || [],
    addressOn: [...new Set((v.addressOn || []).map((a) => a.type))],
    tieBrokenBy: v.tieBrokenBy || null,
    ambiguous: Boolean(v.ambiguous),
    conflicts: v.conflicts || [],
    countable: Boolean(v.countable),
    ...(v.status === "confirmed" ? docs(v) : {}),
    possible: v.status === "possible" ? docs(v.possible) : null,
  };
}

/** Where a social lead can come from. A lead-form lead counts: it is Meta. */
export const SOCIAL_LEAD_SOURCES = Object.freeze(["meta_messenger", "meta_instagram", "meta_whatsapp", "meta_lead_form"]);

/**
 * Read and decide, for one lead. Null for a lead that is not from a social
 * source and has no linked conversation — there is nothing to verify, and
 * the drawer then shows nothing rather than "not matched".
 *
 * @param lead { id, name, email, phone, intake, source, createdAt, quoteId,
 *               conversationEvidence } — already tenant-checked by the caller
 */
export async function loadLeadConversion(db, { lead, full, companyId }) {
  if (!lead?.id) return null;
  const thread = await db.messageThread.findFirst({
    where: { companyId, leadId: lead.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, quoteId: true, clientId: true, channel: { select: { platform: true } } },
  });
  if (!thread && !SOCIAL_LEAD_SOURCES.includes(lead.source)) return null;

  const evidence = lead.conversationEvidence && typeof lead.conversationEvidence === "object" ? lead.conversationEvidence : {};
  const v = await loadVerifiedConversion(db, {
    companyId,
    conversation: {
      id: thread?.id || lead.id,
      source: thread ? sourceForPlatform(thread.channel?.platform) : lead.source === "meta_lead_form" ? "meta_lead_ad" : null,
      startedAt: thread?.createdAt || lead.createdAt,
      // Recorded links, strongest first: the lead's own quote, then one a
      // person set on the thread.
      quoteId: lead.quoteId || thread?.quoteId || null,
      clientId: thread?.clientId || null,
    },
    contact: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: (typeof lead.intake?.address === "string" && lead.intake.address) || evidence.fields?.address?.value || null,
    },
  });
  return {
    ...shapeConversion(v, documentAccess(full)),
    platform: thread?.channel?.platform || null,
    threadId: thread?.id || null,
  };
}

/**
 * Read the rows verifyConversion needs for one conversation and decide.
 *
 * Shared by the lead drawer (loadLeadConversion above) and the message
 * reviewer (lib/leads/messageReview.js), which asks the same question of a
 * conversation that has no lead yet: "is this somebody who already became a
 * quote, a job or an invoice?". One loader, so the two can never disagree
 * about which quotes were in the window.
 *
 * @param conversation { id, source, startedAt, quoteId?, clientId? }
 * @param contact      { name, email, phone, address }
 */
export async function loadVerifiedConversion(db, { companyId, conversation, contact }) {
  const DAY = 24 * 60 * 60 * 1000;
  const startedAt = conversation.startedAt || new Date();
  const startMs = new Date(startedAt).getTime();
  // From a day before (conversationOutcome counts the quotes it excludes for
  // predating the conversation, so it needs to see them) to the end of the
  // attribution window, plus the recorded quotes wherever they fall.
  const since = new Date(startMs - DAY);
  const until = new Date(startMs + (ATTRIBUTION_WINDOW_DAYS + 1) * DAY);
  const [clients, quotes] = await Promise.all([
    db.client.findMany({ where: { companyId }, select: CLIENT_MATCH_SELECT, orderBy: { createdAt: "desc" }, take: CANDIDATE_SCAN_LIMIT }),
    db.quote.findMany({
      where: {
        companyId,
        OR: [
          { createdAt: { gte: since, lt: until } },
          ...(conversation.quoteId ? [{ id: conversation.quoteId }] : []),
        ],
      },
      select: { id: true, clientId: true, status: true, createdAt: true, total: true, acceptedTotal: true, quoteNumber: true, siteAddress: true },
    }),
  ]);
  const quoteIds = quotes.map((q) => q.id);
  const [jobs, invoices] = await Promise.all([
    quoteIds.length
      ? db.job.findMany({ where: { companyId, quoteId: { in: quoteIds } }, select: { id: true, quoteId: true, clientId: true, status: true, siteAddress: true } })
      : [],
    quoteIds.length
      ? db.invoice.findMany({
          where: { companyId, quoteId: { in: quoteIds } },
          select: { id: true, quoteId: true, jobId: true, total: true, amountPaid: true, status: true, invoiceNumber: true, parentInvoiceId: true, version: true },
        })
      : [],
  ]);

  return verifyConversion({
    conversation: { ...conversation, startedAt },
    contact,
    clients,
    quotes,
    jobs,
    invoices,
    companyId,
  });
}
