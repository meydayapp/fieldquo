// lib/meta/capi/sweep.js
//
// The database half of "Send lead results to Meta": read one company's recent
// leads and conversations, ask lib/meta/capi/events.js which stages each has
// reached, and queue the events not yet owed (lib/meta/capi/outbox.js — the
// queue is idempotent, so the sweep can run every fifteen minutes and the
// daily catch-up and the backfill can run over the same rows).
//
// Derived from what is STORED, not hooked into every route that can move a
// lead: a lead can be scored, linked to a conversation, quoted, booked and
// accepted from a dozen places, and a hook in each is a dozen places to
// forget. A stage the sweep can see is a stage Meta is told, whichever screen
// moved it. The three moments it cannot see — a lead deleted as "not a lead"
// and the website's two browser-side events — are written where they happen
// (lib/meta/capi/capture.js).
//
// Every query carries companyId. The company's own currency and country
// (phone country codes) are read once per company.
import { hashedContact } from "./hash";
import {
  CRM_STAGES,
  MESSAGING_STAGES,
  WEBSITE_STAGES,
  crmStagesForLead,
  messagingStagesForThread,
  threadVerdict,
  crmEvent,
  messagingEvent,
  websiteEvent,
  eventNameFor,
  messagingChannelFor,
  acceptedSale,
} from "./events";
import { capiReadiness, kindReady } from "./settings";
import { enqueueEvents } from "./outbox";

/** How far back the regular sweep looks — Meta's 28-day window plus slack. */
export const SWEEP_DAYS = 35;
const DAY_MS = 24 * 60 * 60 * 1000;

const QUOTE_SELECT = { id: true, status: true, sentAt: true, acceptedAt: true, total: true, acceptedTotal: true, clientId: true };

/** Zero counts for every stage of every kind — what the backfill prints. */
export function emptyCounts() {
  return {
    crm: Object.fromEntries(CRM_STAGES.map(([k]) => [k, 0])),
    messaging: Object.fromEntries(MESSAGING_STAGES.map(([k]) => [k, 0])),
    website: Object.fromEntries(WEBSITE_STAGES.map(([k]) => [k, 0])),
  };
}

/** The earliest appointment created for each quote / client. Pure. */
export function earliestAppointments(appointments = []) {
  const byQuote = new Map();
  const byClient = new Map();
  for (const a of appointments) {
    const t = new Date(a.createdAt);
    if (!Number.isFinite(t.getTime())) continue;
    if (a.quoteId && (!byQuote.has(a.quoteId) || t < byQuote.get(a.quoteId))) byQuote.set(a.quoteId, t);
    if (a.clientId && (!byClient.has(a.clientId) || t < byClient.get(a.clientId))) byClient.set(a.clientId, t);
  }
  return { byQuote, byClient };
}

/**
 * The CRM rows owed for one company's lead-form leads. Returns the rows and
 * the stage counts; writes nothing.
 */
export async function crmRows(prisma, { companyId, company, since, now }) {
  const leads = await prisma.leadRequest.findMany({
    where: { companyId, metaLeadId: { not: null }, createdAt: { gte: since } },
    select: {
      id: true,
      metaLeadId: true,
      createdAt: true,
      temperature: true,
      lostReason: true,
      email: true,
      phone: true,
      quoteId: true,
      quote: { select: QUOTE_SELECT },
    },
    take: 5000,
  });
  if (!leads.length) return [];
  const ids = leads.map((l) => l.id);
  const threads = await prisma.messageThread.findMany({
    where: { companyId, leadId: { in: ids } },
    select: { id: true, leadId: true, leadCapture: true, outcome: true, outcomeSetAt: true },
  });
  const threadByLead = new Map();
  for (const t of threads) if (t.leadId && !threadByLead.has(t.leadId)) threadByLead.set(t.leadId, t);
  const quoteIds = leads.map((l) => l.quote?.id).filter(Boolean);
  const clientIds = leads.map((l) => l.quote?.clientId).filter(Boolean);
  const appointments =
    quoteIds.length || clientIds.length
      ? await prisma.appointment.findMany({
          where: { companyId, OR: [{ quoteId: { in: quoteIds } }, { clientId: { in: clientIds } }] },
          select: { quoteId: true, clientId: true, createdAt: true },
        })
      : [];
  const appts = earliestAppointments(appointments);

  const rows = [];
  for (const lead of leads) {
    const t = threadByLead.get(lead.id);
    const v = t ? threadVerdict(t.leadCapture) : { tier: null, notALead: false };
    const apptAt = [appts.byQuote.get(lead.quote?.id), appts.byClient.get(lead.quote?.clientId)]
      .filter(Boolean)
      .sort((a, b) => a - b)[0] || null;
    const stages = crmStagesForLead({
      lead,
      tier: v.tier,
      notALead: v.notALead,
      quote: lead.quote,
      appointmentAt: apptAt,
      wonAt: t?.outcome === "won" ? t.outcomeSetAt : null,
      currency: company?.currency,
      now,
    });
    const contact = hashedContact({ email: lead.email, phone: lead.phone, country: company?.country });
    for (const s of stages) {
      const at = s.at > now ? now : s.at;
      const payload = crmEvent({ leadId: lead.id, metaLeadId: lead.metaLeadId, stage: s.stage, at, contact, value: s.value, currency: s.currency });
      if (!payload) continue;
      rows.push({ kind: "crm", stage: s.stage, eventName: payload.event_name, eventId: payload.event_id, leadId: lead.id, eventTime: at, payload });
    }
  }
  return rows;
}

/** The Business Messaging rows owed for one company's ad conversations. */
export async function messagingRows(prisma, { companyId, company, since, now, readiness }) {
  const threads = await prisma.messageThread.findMany({
    where: { companyId, createdAt: { gte: since }, channel: { platform: { in: ["facebook", "instagram"] } } },
    select: {
      id: true,
      createdAt: true,
      participantExternalId: true,
      adReferral: true,
      leadCapture: true,
      temperature: true,
      clientId: true,
      quoteId: true,
      leadId: true,
      channel: { select: { platform: true, externalId: true } },
    },
    take: 5000,
  });
  if (!threads.length) return [];
  const leadIds = threads.map((t) => t.leadId).filter(Boolean);
  const leads = leadIds.length
    ? await prisma.leadRequest.findMany({ where: { companyId, id: { in: leadIds } }, select: { id: true, temperature: true, quoteId: true } })
    : [];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const quoteIds = [...new Set([...threads.map((t) => t.quoteId), ...leads.map((l) => l.quoteId)].filter(Boolean))];
  const clientIds = [...new Set(threads.map((t) => t.clientId).filter(Boolean))];
  const quotes =
    quoteIds.length || clientIds.length
      ? await prisma.quote.findMany({
          where: { companyId, status: "accepted", OR: [{ id: { in: quoteIds } }, { clientId: { in: clientIds } }] },
          select: QUOTE_SELECT,
        })
      : [];
  const quoteById = new Map(quotes.map((q) => [q.id, q]));

  const rows = [];
  for (const t of threads) {
    const channel = messagingChannelFor(t.channel?.platform);
    if (!channel || !kindReady(readiness, "messaging", channel)) continue;
    const lead = t.leadId ? leadById.get(t.leadId) : null;
    // The sale this conversation led to: its own linked quote, its lead's,
    // else the client's latest quote accepted AFTER the conversation began.
    let quote = quoteById.get(t.quoteId) || quoteById.get(lead?.quoteId) || null;
    if (!quote && t.clientId) {
      quote =
        quotes
          .filter((q) => q.clientId === t.clientId && q.acceptedAt && new Date(q.acceptedAt) >= new Date(t.createdAt))
          .sort((a, b) => new Date(b.acceptedAt) - new Date(a.acceptedAt))[0] || null;
    }
    const stages = messagingStagesForThread({
      thread: { ...t, platform: t.channel?.platform },
      leadTemperature: lead?.temperature || null,
      quote,
      currency: company?.currency,
      now,
    });
    for (const s of stages) {
      const at = s.at > now ? now : s.at;
      const payload = messagingEvent({
        threadId: t.id,
        channel,
        ownerId: t.channel?.externalId,
        scopedUserId: t.participantExternalId,
        stage: s.stage,
        at,
        value: s.value,
        currency: s.currency,
      });
      if (!payload) continue;
      rows.push({ kind: "messaging", stage: s.stage, eventName: payload.event_name, eventId: payload.event_id, channel, threadId: t.id, leadId: t.leadId || null, eventTime: at, payload });
    }
  }
  return rows;
}

/**
 * Website Purchase rows: a website lead FieldQuo already told Meta about
 * (its `lead` row is in the outbox, carrying the browser's user agent and
 * click id) whose quote was then accepted. Without that row there is no user
 * agent to send, and Meta refuses a website event without one — so a website
 * lead captured while the switch was off never gets a Purchase. Said in the
 * help, not hidden.
 */
export async function websiteRows(prisma, { companyId, company, since, now }) {
  const sent = await prisma.metaConversionEvent.findMany({
    where: { companyId, kind: "website", stage: "lead", createdAt: { gte: since } },
    select: { leadId: true, payload: true },
    take: 5000,
  });
  if (!sent.length) return [];
  const leadIds = sent.map((r) => r.leadId).filter(Boolean);
  const leads = await prisma.leadRequest.findMany({
    where: { companyId, id: { in: leadIds }, quoteId: { not: null } },
    select: { id: true, createdAt: true, quote: { select: QUOTE_SELECT } },
  });
  const byLead = new Map(sent.map((r) => [r.leadId, r.payload]));
  const rows = [];
  for (const l of leads) {
    const sale = acceptedSale(l.quote, company?.currency);
    if (!sale || sale.value === null || !sale.currency) continue;
    const base = byLead.get(l.id);
    const ud = base?.user_data || {};
    const at0 = sale.at || now;
    const at = at0 > now ? now : at0 < new Date(l.createdAt) ? new Date(l.createdAt) : at0;
    const { client_user_agent, client_ip_address, fbc, fbp, ...contact } = ud;
    const payload = websiteEvent({
      eventId: `${l.id}:purchase`,
      stage: "purchase",
      at,
      eventSourceUrl: base?.event_source_url,
      userAgent: client_user_agent,
      ip: client_ip_address,
      fbc,
      fbp,
      contact,
      value: sale.value,
      currency: sale.currency,
    });
    if (!payload) continue;
    rows.push({ kind: "website", stage: "purchase", eventName: eventNameFor("website", "purchase"), eventId: payload.event_id, leadId: l.id, eventTime: at, payload });
  }
  return rows;
}

/**
 * Sweep ONE company. Reads its settings itself — never trusts a caller's copy
 * — and does nothing at all when the switch is off.
 *
 * @param p.days   how far back to look (SWEEP_DAYS; the backfill passes 90)
 * @param p.write  false: count only (the backfill's dry run)
 * @returns {{ enabled: boolean, readiness, counts, rows: number, queued: number }}
 */
export async function sweepCompany(prisma, { companyId, now = new Date(), days = SWEEP_DAYS, write = true }) {
  if (!companyId) throw new Error("sweepCompany needs a companyId");
  const [settings, pageConnection, company] = await Promise.all([
    prisma.metaConversionSettings.findUnique({ where: { companyId } }),
    prisma.metaPageConnection.findFirst({ where: { companyId, disconnectedAt: null }, orderBy: { connectedAt: "desc" } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, currency: true, country: true } }),
  ]);
  const readiness = capiReadiness({ settings, pageConnection });
  const counts = emptyCounts();
  if (!settings?.enabled) return { enabled: false, readiness, counts, rows: 0, queued: 0, expired: 0 };
  const since = new Date(now.getTime() - days * DAY_MS);
  const rows = [];
  if (kindReady(readiness, "crm")) rows.push(...(await crmRows(prisma, { companyId, company, since, now })));
  if (kindReady(readiness, "messaging", "messenger") || kindReady(readiness, "messaging", "instagram")) {
    rows.push(...(await messagingRows(prisma, { companyId, company, since, now, readiness })));
  }
  if (kindReady(readiness, "website")) rows.push(...(await websiteRows(prisma, { companyId, company, since, now })));
  for (const r of rows) counts[r.kind][r.stage] = (counts[r.kind][r.stage] || 0) + 1;
  let queued = 0;
  if (write && rows.length) queued = (await enqueueEvents(prisma, companyId, rows, { now })).queued;
  return { enabled: true, readiness, counts, rows: rows.length, queued, list: write ? undefined : rows };
}

/** Every company with the switch on — the cron's list. */
export async function enabledCompanyIds(prisma) {
  const rows = await prisma.metaConversionSettings.findMany({ where: { enabled: true }, select: { companyId: true } });
  return rows.map((r) => r.companyId);
}
