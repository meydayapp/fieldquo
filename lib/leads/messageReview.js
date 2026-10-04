// lib/leads/messageReview.js
//
// The message reviewer's verdict on a Facebook / Instagram / WhatsApp
// conversation: is this person a GENUINE LEAD, NOT A LEAD (spam, a wrong
// number, a job seeker, a supplier), an EXISTING CLIENT, or somebody who has
// already CONVERTED (a quote, a job or an invoice exists for them) — with the
// evidence that says so.
//
// ══ Why ════════════════════════════════════════════════════════════════════
//
// The owner, 2026-10-03: "the AI agent that handles AI message review should
// be able to validate FB leads with messages to not create a copy… read
// through the messages, determine if a client is a lead, if it is a converted
// client etc., based on the quote, invoices and jobs that have been created —
// because fb leads are pretty bad and deceptive."
//
// ══ Two readers, and which one decides what ════════════════════════════════
//
//   The MODEL (lib/ai/conversationLeadExtract.js, company-paid, metered)
//   reads the words: work_request / existing_customer_issue / spam /
//   not_work, plus — since this file — WHICH kind of not-a-lead
//   (notLeadReason) and the message that shows it (kindMessage).
//
//   The RECORDS (lib/attribution/conversionEvidence.js, free) decide who the
//   person is and what they already became: a matched client, and the
//   quote / job / invoice on file. A model is never asked whether somebody
//   is a client — the database knows, and a model asked would guess.
//
// Without AI credit the model does not run, and the verdict is the records'
// alone: "converted" and "existing client" still come out (they need no
// judgement), "genuine lead" and "not a lead" do not (they do), and the
// verdict carries `aiUnavailable` so the screen says so instead of implying
// the words were read.
//
// Pure, except reviewRecords() at the bottom, which reads.
import { loadVerifiedConversion } from "@/lib/leads/linkedDocuments";

export const REVIEW_VERDICTS = Object.freeze(["genuine_lead", "not_a_lead", "existing_client", "converted", "undetermined"]);

/** The model's sub-kinds of "not a lead". Closed; anything else is "other". */
export const NOT_LEAD_REASONS = Object.freeze(["spam", "wrong_number", "job_seeker", "vendor", "other"]);

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The documents a confirmed conversion rests on, as the drawer lists them. Pure. */
export function conversionDocuments(conversion) {
  if (!conversion || conversion.status !== "confirmed") return [];
  const docs = [];
  if (conversion.quote?.id) {
    docs.push({ type: "quote", id: conversion.quote.id, number: conversion.quote.number || null, status: conversion.quote.status || null });
  }
  if (conversion.jobId) docs.push({ type: "job", id: conversion.jobId, number: null, status: null });
  for (const n of conversion.invoices?.numbers || []) docs.push({ type: "invoice", id: null, number: n, status: conversion.invoices.fullyPaid ? "paid" : null });
  return docs;
}

/**
 * The verdict. Pure — executed against a lying model, a missing model and
 * hostile records by scripts/check-meta-history.mjs.
 *
 * @param ai          the model's verified answer for this pass, or null
 * @param capture     MessageThread.leadCapture — a reading an EARLIER pass made
 * @param conversion  verifyConversion() for this conversation, or null
 * @param clientDocs  the matched client's documents from any time (quotes,
 *                    jobs, invoices) — an existing client's history, which the
 *                    60-day conversion window deliberately does not count
 * @param aiUnavailable why the model did not run, or null when it did / was
 *                    not needed
 * @param decidedKind decideKind()'s answer when the model did not give one
 *                    (the front desk's intent) — never overrides the model
 */
export function reviewVerdict({ ai = null, capture = null, conversion = null, clientDocs = [], aiUnavailable = null, decidedKind = null } = {}) {
  const fromAi = ai?.ok ? ai : null;
  const aiKind = fromAi?.kind || (capture?.kindMethod === "ai" ? capture.kind : null) || null;
  // Without the model, the front desk's read stands in exactly where
  // lib/leads/conversationLead.js's decideKind lets it ("book" / "price" are
  // somebody wanting work) — so a known client booking through the AI
  // employee is still "asking for new work", not silently no lead.
  const kind = aiKind || decidedKind || null;
  const rawReason = fromAi ? fromAi.notLeadReason : capture?.review?.notLeadReason;
  const notLeadReason = NOT_LEAD_REASONS.includes(rawReason) ? rawReason : null;
  const kindMessage = fromAi?.kindMessage
    ? { messageId: fromAi.kindMessage.id ?? null, sentAt: fromAi.kindMessage.sentAt ?? null, quote: str(fromAi.kindMessage.body)?.slice(0, 200) || null }
    : capture?.review?.evidence?.message || null;
  const method = aiKind ? "ai" : "deterministic";

  const confirmed = conversion?.status === "confirmed";
  const client = confirmed && conversion.clientId ? { id: conversion.clientId, matchedOn: conversion.matchedOn || [] } : null;
  const documents = conversionDocuments(conversion);
  const base = {
    notLeadReason: null,
    method,
    aiUnavailable: aiKind ? null : aiUnavailable,
    evidence: {
      message: kindMessage,
      client,
      documents: documents.length ? documents : client ? (clientDocs || []).slice(0, 6) : [],
      outcome: confirmed ? conversion.outcome || null : null,
      possible: conversion?.status === "possible" ? { candidateIds: conversion.candidateIds || [], matchedOn: conversion.matchedOn || [] } : null,
    },
  };

  // Spam first: a scam that happens to quote a client's number is still a scam.
  if (kind === "spam") return { ...base, verdict: "not_a_lead", notLeadReason: "spam", newWork: false };

  // What the RECORDS say — no judgement needed, so it stands with or without
  // the model. A quote (or a job, or an invoice) raised for this person after
  // the conversation began is a conversion.
  if (confirmed && documents.some((d) => d.type === "quote" || d.type === "job" || d.type === "invoice")) {
    return { ...base, verdict: "converted", newWork: false };
  }
  if (client) {
    // A known client asking for NEW work is still a lead — on the board, tied
    // to the client so converting it does not make a second client record.
    return { ...base, verdict: "existing_client", newWork: kind === "work_request" };
  }

  if (kind === "existing_customer_issue") return { ...base, verdict: "existing_client", newWork: false };
  if (kind === "not_work") return { ...base, verdict: "not_a_lead", notLeadReason: notLeadReason || "other", newWork: false };
  if (kind === "work_request") return { ...base, verdict: "genuine_lead", newWork: true };
  return { ...base, verdict: "undetermined", newWork: false };
}

/**
 * Should this verdict make a NEW lead? Pure. A converted person, an existing
 * client with no new work, and a not-a-lead never do; an existing client
 * asking for new work and a genuine lead do.
 */
export function verdictMakesLead(review) {
  if (!review) return true;
  if (review.verdict === "converted" || review.verdict === "not_a_lead") return false;
  if (review.verdict === "existing_client") return Boolean(review.newWork);
  return true;
}

/**
 * A stored review, as one member may see it. Pure.
 *
 * The verdict and the message are the requests dial's (they describe the
 * conversation); a quote number is a quotes-dial fact, a job a jobs-dial
 * fact, an invoice an invoices-dial fact — the same three dials
 * lib/leads/linkedDocuments.js applies to the drawer's own sections, so a
 * member is never shown here what /app/invoices would refuse them.
 *
 * @param access { quotes, jobs, invoices } — lib/leads/linkedDocuments.js's
 *               documentAccess(member)
 */
export function publicReview(review, access = {}) {
  if (!review || typeof review !== "object" || !REVIEW_VERDICTS.includes(review.verdict)) return null;
  const ev = review.evidence && typeof review.evidence === "object" ? review.evidence : {};
  const allowed = { quote: Boolean(access.quotes), job: Boolean(access.jobs), invoice: Boolean(access.invoices) };
  const documents = (Array.isArray(ev.documents) ? ev.documents : [])
    .filter((d) => d && ["quote", "job", "invoice"].includes(d.type))
    .slice(0, 6)
    .map((d) => (allowed[d.type] ? { type: d.type, id: d.id || null, number: d.number || null, status: d.status || null } : { type: d.type, restricted: true }));
  const message = ev.message && typeof ev.message === "object" ? { messageId: ev.message.messageId || null, quote: str(ev.message.quote), sentAt: ev.message.sentAt || null } : null;
  return {
    verdict: review.verdict,
    notLeadReason: NOT_LEAD_REASONS.includes(review.notLeadReason) ? review.notLeadReason : null,
    newWork: review.newWork === true,
    method: review.method === "ai" ? "ai" : "deterministic",
    aiUnavailable: str(review.aiUnavailable),
    reviewedAt: review.reviewedAt || null,
    message,
    client: ev.client?.id ? { id: ev.client.id, matchedOn: Array.isArray(ev.client.matchedOn) ? ev.client.matchedOn : [] } : null,
    documents,
    outcome: str(ev.outcome),
    // The reviewer pointed the thread at this client itself — the inbox's
    // "Not this client" is drawn only for that.
    wroteClientId: str(review.wroteClientId),
  };
}

/**
 * The review as it is copied onto a LEAD (conversationEvidence.review): the
 * documents keep their type, id and status but not their numbers — the lead
 * row reaches screens gated only on the requests dial, and a number is read
 * back through publicReview on the dials that own it. Pure.
 */
export function reviewForLead(review) {
  if (!review) return null;
  const ev = review.evidence || {};
  return {
    verdict: review.verdict,
    notLeadReason: review.notLeadReason || null,
    newWork: review.newWork === true,
    method: review.method,
    aiUnavailable: review.aiUnavailable || null,
    reviewedAt: review.reviewedAt || null,
    evidence: {
      message: ev.message || null,
      client: ev.client || null,
      documents: (ev.documents || []).map((d) => ({ type: d.type, id: d.id || null, status: d.status || null })),
      outcome: ev.outcome || null,
    },
  };
}

/**
 * The records half: who this is and what they became. Reads; never writes.
 *
 * @returns {{ conversion, clientDocs }}
 */
export async function reviewRecords(prisma, { companyId, thread, contact, platformSource }) {
  const conversion = await loadVerifiedConversion(prisma, {
    companyId,
    conversation: {
      id: thread.id,
      source: platformSource || null,
      startedAt: thread.createdAt || null,
      quoteId: thread.quoteId || null,
      clientId: thread.clientId || null,
    },
    contact,
  });
  let clientDocs = [];
  if (conversion?.status === "confirmed" && conversion.clientId) {
    const where = { companyId, clientId: conversion.clientId };
    const [quotes, jobs, invoices] = await Promise.all([
      prisma.quote.findMany({ where, select: { id: true, quoteNumber: true, status: true }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => []),
      prisma.job.findMany({ where, select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => []),
      prisma.invoice.findMany({ where: { ...where, parentInvoiceId: null }, select: { id: true, invoiceNumber: true, status: true }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => []),
    ]);
    clientDocs = [
      ...quotes.map((q) => ({ type: "quote", id: q.id, number: q.quoteNumber || null, status: q.status || null })),
      ...jobs.map((j) => ({ type: "job", id: j.id, number: j.title || null, status: j.status || null })),
      ...invoices.map((i) => ({ type: "invoice", id: i.id, number: i.invoiceNumber || null, status: i.status || null })),
    ];
  }
  return { conversion, clientDocs };
}
