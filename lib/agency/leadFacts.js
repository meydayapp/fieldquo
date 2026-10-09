// lib/agency/leadFacts.js
//
// The database half of the agency rows and metrics: one lead → everything
// that became of it. Read by lib/agency/api.js (the agency's API, webhooks,
// samples) and lib/agency/metricsData.js (the API's metrics AND FieldQuo's
// own Marketing results page), so the agency and the owner are looking at
// one set of joins.
//
// A "fact" holds contact details (the matching needs them) and is NEVER
// returned from anywhere as-is: lib/agency/leadRow.js turns it into the row
// an agency may see.
//
// ══ How a lead is followed ═════════════════════════════════════════════════
//
//   conversation  MessageThread.leadId — first contact, first reply (speed to
//                 lead), Meta's ad marker, the tier (lib/leads/qualification.js)
//   quote         LeadRequest.quoteId; else a CONFIRMED inferred match
//                 (lib/analytics/campaignRollupData.js inferLeadQuotes — the
//                 same rule the campaign rollup counts by); a tier-group
//                 sibling the client accepted wins over the one linked
//   client        the quote's client, and any client the lead's own email or
//                 phone matches with certainty (lib/contacts/matchContact.js —
//                 never a name alone)
//   appointment   the first in-person appointment for that client or quote,
//                 booked no earlier than a day before the lead, and before
//                 the win — a visit booked after the job was sold is the
//                 work, not the sales appointment. Video and phone bookings
//                 are not in-person. Counted once.
//   money         jobs and invoices on the won quote, through the shared
//                 followLeadsToMoney / buildOutcomeIndex chain
//
// Every query carries companyId, or is keyed on ids that one already
// returned. A db is passed in so scripts/check-agency-api.mjs can run this
// against an in-memory store that refuses an unscoped query.

import { inferLeadQuotes, followLeadsToMoney } from "@/lib/analytics/campaignRollupData";
import { buildOutcomeIndex, outcomesForLeads } from "@/lib/analytics/campaignRollup";
import { CLIENT_MATCH_SELECT, CANDIDATE_SCAN_LIMIT, matchContactAgainst } from "@/lib/contacts/matchContact";
import { effectiveTier } from "@/lib/leads/qualification";
import { channelOf, adAttributionOf, threadViewOf } from "@/lib/agency/channels";
import { ensureLeadRefs } from "@/lib/agency/leadRef";

const DAY = 24 * 60 * 60 * 1000;
/** The most leads one call follows. A company past this is told so (`truncated`). */
export const MAX_FACT_LEADS = 5000;

const LEAD_SELECT = {
  id: true,
  companyId: true,
  agencyRef: true,
  name: true,
  email: true,
  phone: true,
  categoryId: true,
  status: true,
  lostReason: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  intake: true,
  temperature: true,
  qualifiedAt: true,
  quoteId: true,
  metaLeadId: true,
  metaCampaignId: true,
  metaCampaignName: true,
  attribution: true,
  conversationEvidence: true,
};

const time = (d) => (d ? new Date(d).getTime() : NaN);
const minDate = (...ds) => {
  let best = null;
  for (const d of ds) if (Number.isFinite(time(d)) && (best === null || time(d) < time(best))) best = new Date(d);
  return best;
};
const maxDate = (...ds) => {
  let best = null;
  for (const d of ds) if (Number.isFinite(time(d)) && (best === null || time(d) > time(best))) best = new Date(d);
  return best;
};
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

/** What the homeowner asked for, from the columns that say so. */
function serviceRequestedOf(lead, categoryLabel) {
  if (categoryLabel) return categoryLabel;
  const intake = obj(lead.intake) || {};
  const ev = obj(lead.conversationEvidence);
  return (
    str(intake.service) ||
    str(intake.serviceRequested) ||
    str(intake.trade) ||
    str(obj(obj(ev?.fields)?.service)?.value) ||
    null
  );
}

/** The window an agency (or the homeowner) asked the visit to fall in. */
function requestedVisitOf(lead) {
  const r = obj(obj(lead.intake)?.requestedVisit);
  if (!r) return null;
  const from = Number.isFinite(time(r.from)) ? new Date(r.from) : null;
  const to = Number.isFinite(time(r.to)) ? new Date(r.to) : null;
  return from || to ? { from, to } : null;
}

/**
 * @param {object} p
 * @param p.db
 * @param p.companyId
 * @param p.where      extra LeadRequest filter ({ createdAt }, { id: { in } }, …)
 * @param p.now
 * @param p.assignRefs write a reference onto leads that have none (default true)
 * @returns {{ facts: object[], truncated: boolean }}
 */
export async function loadLeadFacts({ db, companyId, where = {}, now = new Date(), assignRefs = true, take = MAX_FACT_LEADS }) {
  if (!companyId) throw new Error("loadLeadFacts: companyId is required");
  const leads = await db.leadRequest.findMany({
    where: { ...where, companyId },
    select: LEAD_SELECT,
    orderBy: { createdAt: "desc" },
    take: take + 1,
  });
  const truncated = leads.length > take;
  if (truncated) leads.length = take;
  if (!leads.length) return { facts: [], truncated: false };
  if (assignRefs) await ensureLeadRefs(db, companyId, leads);

  const leadIds = leads.map((l) => l.id);
  const categoryIds = [...new Set(leads.map((l) => l.categoryId).filter(Boolean))];

  const [threads, categories, company] = await Promise.all([
    db.messageThread.findMany({
      where: { companyId, leadId: { in: leadIds } },
      select: { id: true, leadId: true, channelId: true, createdAt: true, firstInboundAt: true, firstReplyAt: true, adReferral: true, leadCapture: true },
    }),
    categoryIds.length
      ? db.serviceCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, key: true, label: true } })
      : [],
    db.company.findUnique({ where: { id: companyId }, select: { country: true, currency: true } }),
  ]);
  const channelIds = [...new Set(threads.map((t) => t.channelId).filter(Boolean))];
  const channels = channelIds.length
    ? await db.messagingChannel.findMany({ where: { companyId, id: { in: channelIds } }, select: { id: true, platform: true } })
    : [];
  const platformOf = new Map(channels.map((c) => [c.id, c.platform]));
  const threadsByLead = new Map();
  for (const t of threads) {
    if (!threadsByLead.has(t.leadId)) threadsByLead.set(t.leadId, []);
    threadsByLead.get(t.leadId).push(t);
  }

  // ── Quotes: recorded, else a confirmed inferred match ────────────────────
  await inferLeadQuotes({ db, companyId, leads });
  const linkedQuoteIds = [...new Set(leads.map((l) => l.quoteId || l.inferredQuoteId).filter(Boolean))];
  const QUOTE_SELECT = {
    id: true, clientId: true, status: true, createdAt: true, updatedAt: true, sentAt: true, viewedAt: true,
    total: true, acceptedTotal: true, acceptedAt: true, declinedAt: true, declineReason: true,
    quoteType: true, tierGroupId: true, siteAddress: true,
  };
  const linkedQuotes = linkedQuoteIds.length
    ? await db.quote.findMany({ where: { companyId, id: { in: linkedQuoteIds } }, select: QUOTE_SELECT })
    : [];
  const groupIds = [...new Set(linkedQuotes.map((q) => q.tierGroupId).filter(Boolean))];
  const siblings = groupIds.length
    ? await db.quote.findMany({ where: { companyId, tierGroupId: { in: groupIds }, status: "accepted" }, select: QUOTE_SELECT })
    : [];
  const quoteById = new Map([...linkedQuotes, ...siblings].map((q) => [q.id, q]));
  const acceptedSiblingOf = new Map();
  for (const s of siblings) if (!acceptedSiblingOf.has(s.tierGroupId)) acceptedSiblingOf.set(s.tierGroupId, s);
  const effectiveQuoteOf = (lead) => {
    const linked = quoteById.get(lead.quoteId || lead.inferredQuoteId) || null;
    if (!linked) return null;
    if (linked.status !== "accepted" && linked.tierGroupId && acceptedSiblingOf.has(linked.tierGroupId)) {
      return acceptedSiblingOf.get(linked.tierGroupId);
    }
    return linked;
  };

  const effectiveQuoteIds = [...new Set(leads.map((l) => effectiveQuoteOf(l)?.id).filter(Boolean))];
  const scopeGroups = effectiveQuoteIds.length
    ? await db.quoteScopeGroup.findMany({ where: { quoteId: { in: effectiveQuoteIds } }, select: { quoteId: true, categoryId: true, label: true } })
    : [];
  const scopeCategoryIds = [...new Set(scopeGroups.map((g) => g.categoryId).filter((id) => id && !categoryIds.includes(id)))];
  const quoteTypeKeys = [...new Set(effectiveQuoteIds.map((id) => quoteById.get(id)?.quoteType).filter(Boolean))];
  const moreCategories = scopeCategoryIds.length || quoteTypeKeys.length
    ? await db.serviceCategory.findMany({
        where: { OR: [...(scopeCategoryIds.length ? [{ id: { in: scopeCategoryIds } }] : []), ...(quoteTypeKeys.length ? [{ key: { in: quoteTypeKeys } }] : [])] },
        select: { id: true, key: true, label: true },
      })
    : [];
  const categoryById = new Map([...categories, ...moreCategories].map((c) => [c.id, c]));
  const categoryByKey = new Map([...categories, ...moreCategories].map((c) => [c.key, c]));

  // ── Clients: the quote's, and any the lead's own email/phone names ──────
  const candidates = await db.client.findMany({
    where: { companyId },
    select: { ...CLIENT_MATCH_SELECT, postalCode: true },
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_SCAN_LIMIT,
  });
  const clientById = new Map(candidates.map((c) => [c.id, c]));
  const clientIdsOf = new Map();
  for (const lead of leads) {
    const ids = new Set();
    const q = effectiveQuoteOf(lead);
    if (q?.clientId) ids.add(q.clientId);
    if (lead.email || lead.phone) {
      const m = matchContactAgainst({
        clients: candidates,
        companyId,
        contact: { email: lead.email, phone: lead.phone },
        minConfidence: "certain",
      });
      if (m.clientId && m.confidence === "certain") ids.add(m.clientId);
    }
    clientIdsOf.set(lead.id, [...ids]);
  }
  const allClientIds = [...new Set([...clientIdsOf.values()].flat())];

  // ── Bookings that name their lead (Booking.leadRequestId) ────────────────
  //
  // A booking confirmed on the booking page or by an AI is linked to its lead
  // (lib/booking/bookingLead.js) — the lead it MADE when the booker never
  // enquired. Its appointment is that lead's whatever the contact matching
  // below makes of the details. Keyed on lead ids this company's query just
  // returned. Before the column exists (SQL not yet applied) there are none,
  // and the client matching carries on as before.
  const leadBookings = await db.booking
    .findMany({ where: { leadRequestId: { in: leadIds }, appointmentId: { not: null } }, select: { leadRequestId: true, appointmentId: true } })
    .catch((err) => {
      if (!/leadRequestId|does not exist|Unknown argument/i.test(String(err?.message || ""))) throw err;
      return [];
    });
  const bookedApptsOf = new Map();
  for (const b of leadBookings) {
    if (!bookedApptsOf.has(b.leadRequestId)) bookedApptsOf.set(b.leadRequestId, new Set());
    bookedApptsOf.get(b.leadRequestId).add(b.appointmentId);
  }
  const bookedApptIds = [...new Set(leadBookings.map((b) => b.appointmentId))];

  // ── Appointments ──────────────────────────────────────────────────────────
  const appointments = allClientIds.length || effectiveQuoteIds.length || linkedQuoteIds.length || bookedApptIds.length
    ? await db.appointment.findMany({
        where: {
          companyId,
          OR: [
            ...(allClientIds.length ? [{ clientId: { in: allClientIds } }] : []),
            ...(linkedQuoteIds.length || effectiveQuoteIds.length ? [{ quoteId: { in: [...new Set([...linkedQuoteIds, ...effectiveQuoteIds])] } }] : []),
            ...(bookedApptIds.length ? [{ id: { in: bookedApptIds } }] : []),
          ],
        },
        select: { id: true, clientId: true, quoteId: true, jobId: true, invoiceId: true, scheduledAt: true, status: true, createdAt: true, updatedAt: true, location: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const bookings = appointments.length
    ? await db.booking.findMany({
        where: { appointmentId: { in: appointments.map((a) => a.id) } },
        select: { appointmentId: true, mode: true, address: true },
      })
    : [];
  const bookingOf = new Map(bookings.map((b) => [b.appointmentId, b]));

  // ── Money: the shared lead → job → invoice chain ─────────────────────────
  const moneyLeads = leads
    .map((l) => ({ id: l.id, quoteId: effectiveQuoteOf(l)?.id || null, name: l.name, email: l.email, phone: l.phone, intake: l.intake, createdAt: l.createdAt }))
    .filter((l) => l.quoteId);
  const { jobs, invoices } = moneyLeads.length ? await followLeadsToMoney({ db, companyId, leads: moneyLeads }) : { jobs: [], invoices: [] };
  const index = buildOutcomeIndex({ jobs, invoices });
  const invoiceIds = invoices.map((i) => i.id);
  const jobIds = jobs.map((j) => j.id);
  const [invoiceDates, payments, jobRows] = await Promise.all([
    invoiceIds.length
      ? db.invoice.findMany({ where: { companyId, id: { in: invoiceIds } }, select: { id: true, jobId: true, quoteId: true, status: true, createdAt: true, sentAt: true, paidDate: true } })
      : [],
    invoiceIds.length
      ? db.payment.findMany({ where: { invoiceId: { in: invoiceIds }, kind: "payment" }, select: { id: true, invoiceId: true, amount: true, date: true, createdAt: true } })
      : [],
    jobIds.length ? db.job.findMany({ where: { companyId, id: { in: jobIds } }, select: { id: true, quoteId: true, status: true, completedAt: true, createdAt: true } }) : [],
  ]);

  const facts = leads.map((lead) => {
    const leadThreads = threadsByLead.get(lead.id) || [];
    // The thread the lead came from: the earliest one.
    const thread = leadThreads.slice().sort((a, b) => time(a.firstInboundAt || a.createdAt) - time(b.firstInboundAt || b.createdAt))[0] || null;
    const q = obj(obj(thread?.leadCapture)?.qualification);
    // channels.js builds it, so the Leads board (GET /api/leads) places a lead
    // from the same three facts this does.
    const threadView = thread ? threadViewOf(thread, platformOf.get(thread.channelId)) : null;
    const quote = effectiveQuoteOf(lead);
    const won = Boolean(quote && quote.status === "accepted") || lead.status === "converted";
    const quoteJobs = quote ? jobRows.filter((j) => j.quoteId === quote.id).sort((a, b) => time(a.createdAt) - time(b.createdAt)) : [];
    const wonAt = won ? minDate(quote?.acceptedAt, quoteJobs[0]?.createdAt) || (lead.status === "converted" ? new Date(lead.updatedAt) : null) : null;

    // The sales appointment: in person, for this lead's client or quote,
    // booked no earlier than a day before the lead and before the win.
    const clientIds = new Set(clientIdsOf.get(lead.id) || []);
    const quoteIds = new Set([lead.quoteId, lead.inferredQuoteId, quote?.id].filter(Boolean));
    const floor = time(lead.createdAt) - DAY;
    const booked = bookedApptsOf.get(lead.id) || new Set();
    const eligible = appointments.filter((a) => {
      if (!(clientIds.has(a.clientId) || (a.quoteId && quoteIds.has(a.quoteId)) || booked.has(a.id))) return false;
      if (time(a.createdAt) < floor) return false;
      if (wonAt && time(a.createdAt) > time(wonAt)) return false;
      if (a.jobId || a.invoiceId) return false;
      const mode = bookingOf.get(a.id)?.mode;
      return !mode || mode === "visit";
    });
    // A rescheduled visit was replaced by its new time, which is the one
    // that says what happened; a cancelled one only when there is no other.
    const appt = eligible.find((a) => a.status !== "cancelled" && a.status !== "rescheduled") || eligible.find((a) => a.status !== "cancelled") || eligible[0] || null;

    const outcome = quote ? outcomesForLeads([{ id: lead.id, quoteId: quote.id }], index) : null;
    const leadInvoices = invoiceDates.filter((i) => (i.jobId && quoteJobs.some((j) => j.id === i.jobId)) || (quote && i.quoteId === quote.id));
    const leadPayments = payments.filter((p) => leadInvoices.some((i) => i.id === p.invoiceId));
    const issued = leadInvoices.filter((i) => i.status !== "draft");
    const invoicedAt = minDate(...issued.map((i) => i.sentAt || i.createdAt));
    const paidInvoices = issued.filter((i) => i.status === "paid");
    const paidAt = paidInvoices.length && paidInvoices.length === issued.length ? maxDate(...paidInvoices.map((i) => i.paidDate)) : null;
    const jobCompletedAt = maxDate(...quoteJobs.filter((j) => j.status === "completed").map((j) => j.completedAt));

    const category = lead.categoryId ? categoryById.get(lead.categoryId) : null;
    const soldLabels = [];
    if (quote) {
      for (const g of scopeGroups.filter((g) => g.quoteId === quote.id)) {
        const label = categoryById.get(g.categoryId)?.label || str(g.label);
        if (label && !soldLabels.includes(label)) soldLabels.push(label);
      }
      if (!soldLabels.length && quote.quoteType) soldLabels.push(categoryByKey.get(quote.quoteType)?.label || quote.quoteType);
    }

    const clients = [...clientIds].map((id) => clientById.get(id)).filter(Boolean);
    const intake = obj(lead.intake) || {};
    const postalCandidates = [
      ...clients.map((c) => ({ value: c.postalCode, field: true })),
      { value: str(intake.postalCode) || str(intake.zip) || str(intake.postal), field: true },
      { value: str(intake.address), field: false },
      ...clients.map((c) => ({ value: [c.address, c.city, c.province].filter(Boolean).join(", "), field: false })),
      { value: quote?.siteAddress || null, field: false },
      { value: appt ? bookingOf.get(appt.id)?.address || appt.location || null : null, field: false },
    ].filter((c) => c.value);

    const firstContactAt = minDate(thread?.firstInboundAt, thread ? thread.createdAt : null, lead.createdAt);
    const firstResponseAt = thread?.firstReplyAt && thread?.firstInboundAt && time(thread.firstReplyAt) >= time(thread.firstInboundAt) ? new Date(thread.firstReplyAt) : null;

    const fact = {
      id: lead.id,
      ref: lead.agencyRef || null,
      createdAt: new Date(lead.createdAt),
      status: lead.status,
      lostReason: lead.lostReason || null,
      name: lead.name,
      email: lead.email || null,
      phone: lead.phone || null,
      source: lead.source || null,
      channel: channelOf(lead, threadView),
      attribution: adAttributionOf(lead, threadView),
      // A conversation's tier is lib/leads/qualification.js's; a form, a call
      // or a staff-typed lead is a request someone made, so "lead".
      tier: thread ? effectiveTier(q) : "lead",
      temperature: lead.temperature || null,
      qualifiedAt: lead.qualifiedAt || null,
      firstContactAt,
      firstResponseAt,
      serviceRequested: serviceRequestedOf(lead, category?.label || null),
      serviceSold: soldLabels.length ? soldLabels.join(", ") : null,
      requestedVisit: requestedVisitOf(lead),
      postalCandidates,
      appointment: appt
        ? { id: appt.id, bookedAt: appt.createdAt, scheduledAt: appt.scheduledAt, status: appt.status, type: "estimate", mode: bookingOf.get(appt.id)?.mode || "visit", updatedAt: appt.updatedAt }
        : null,
      quote: quote
        ? {
            id: quote.id,
            status: quote.status,
            createdAt: quote.createdAt,
            sentAt: quote.sentAt,
            viewedAt: quote.viewedAt,
            amount: Number(quote.total),
            acceptedAt: quote.acceptedAt,
            declinedAt: quote.declinedAt,
            declineReason: quote.declineReason || null,
            inferred: !lead.quoteId,
            updatedAt: quote.updatedAt,
          }
        : null,
      won,
      wonAt,
      wonAmount: won && quote ? Number(quote.acceptedTotal ?? quote.total) : null,
      invoicedAt,
      invoicedAmount: outcome?.revenue ?? null,
      paidAt,
      collectedAmount: outcome?.paid ?? null,
      payments: leadPayments.map((p) => ({ id: p.id, invoiceId: p.invoiceId, at: p.date || p.createdAt, amount: Number(p.amount) })),
      jobCompletedAt,
      jobs: quoteJobs.map((j) => ({ id: j.id, status: j.status, completedAt: j.completedAt })),
      invoices: issued.map((i) => ({ id: i.id, status: i.status, paidDate: i.paidDate })),
    };
    fact.updatedAt = maxDate(
      lead.updatedAt, lead.createdAt, appt?.updatedAt, quote?.updatedAt, quote?.sentAt, quote?.viewedAt, quote?.acceptedAt,
      quote?.declinedAt, invoicedAt, paidAt, jobCompletedAt, ...fact.payments.map((p) => p.at),
    );
    return fact;
  });

  return { facts, truncated, currency: company?.currency || null, country: company?.country || null };
}
