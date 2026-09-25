// lib/clientTickets/service.js
//
// Client tickets: the writes, the reads, and who hears about each.
//
//   client opens / replies  → in-app + push to the office (notifyEvent,
//                             "client_ticket.opened" / ".replied"), and one
//                             email to the assignee — or the owner while it is
//                             unassigned — after the response
//   staff reply             → the client is emailed, from the company, in the
//                             client's language, with their portal link
//
// ── Scoped, every time ─────────────────────────────────────────────────────
//
// A client reaches this ONLY through their own portal token, which names one
// client of one company. Every ticket read is `where: { id, clientId,
// companyId }`; every link a client attaches (job, visit, invoice, quote,
// plan) is re-found under that same client and company before it is stored,
// and a link that does not resolve is refused, not dropped silently. Staff
// reads are `where: { id, companyId: member.companyId }`.

import { db as defaultDb } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { appSentence } from "@/lib/notify/push";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender, ownerEmailFor } from "@/lib/email/companySender";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { escapeHtml } from "@/lib/email/documentEmailLayout";
import { ensurePortalToken, portalUrl } from "@/lib/clientPortal";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { getAppOrigin } from "@/lib/appUrl";
import { createJob } from "@/lib/jobs/createJob";
import {
  TICKET_TYPES,
  OPEN_STATUSES,
  CONVERTIBLE_TYPES,
  normaliseType,
  normalisePriority,
  sanitiseSubject,
  sanitiseBody,
  ownUploads,
  decideStatus,
  afterReply,
  jobDraftFromTicket,
} from "@/lib/clientTickets/rules";
import { buildTicketReplyEmail } from "@/lib/clientTickets/emails";

const TICKET_SELECT = {
  id: true,
  companyId: true,
  clientId: true,
  jobId: true,
  jobVisitId: true,
  invoiceId: true,
  quoteId: true,
  servicePlanId: true,
  type: true,
  subject: true,
  body: true,
  photos: true,
  status: true,
  priority: true,
  assignedToId: true,
  convertedJobId: true,
  firstResponseAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
};

const MESSAGE_SELECT = { id: true, author: true, memberId: true, authorName: true, body: true, photos: true, createdAt: true };

/**
 * Each link a client attached, proved to be theirs. `null`/absent is fine;
 * a link that doesn't resolve under this client and company is an error —
 * a ticket "about" a job the client can't see must not be written.
 */
export async function verifyClientLinks(db, client, links = {}) {
  const scope = { companyId: client.companyId };
  const out = {};
  const want = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);
  const checks = [
    ["jobId", (id) => db.job.findFirst({ where: { id, clientId: client.id, ...scope }, select: { id: true } })],
    ["jobVisitId", (id) => db.jobVisit.findFirst({ where: { id, job: { clientId: client.id, ...scope } }, select: { id: true, jobId: true } })],
    ["invoiceId", (id) => db.invoice.findFirst({ where: { id, clientId: client.id, ...scope }, select: { id: true } })],
    ["quoteId", (id) => db.quote.findFirst({ where: { id, clientId: client.id, ...scope }, select: { id: true } })],
    ["servicePlanId", (id) => db.servicePlan.findFirst({ where: { id, clientId: client.id, ...scope }, select: { id: true } })],
  ];
  for (const [key, find] of checks) {
    if (links[key] == null || links[key] === "") continue;
    const id = want(links[key]);
    if (!id) return { ok: false, error: `bad_${key}` };
    const row = await find(id);
    if (!row) return { ok: false, error: `bad_${key}` };
    out[key] = id;
    // A visit carries its job — the office sees which job the issue is about
    // without the client having to know it.
    if (key === "jobVisitId" && row.jobId && !out.jobId) out.jobId = row.jobId;
  }
  return { ok: true, links: out };
}

/** The office's notice: in-app + push through the feed, fire-and-forget. */
function notifyOffice({ ticket, client, type }) {
  notifyEvent({
    companyId: ticket.companyId,
    type,
    entityId: ticket.id,
    params: { clientName: client.name || "", subject: ticket.subject },
    recipientUserIds: ticket.assignedToId ? [ticket.assignedToId] : undefined,
  }).catch((err) => console.error("[client-tickets] notify failed:", err?.message));
}

/** One email to whoever holds the ticket (the owner while unassigned), in the
 *  company's language. The client's own words are escaped — they are text a
 *  stranger typed, going into staff's inbox. */
export async function emailOffice({ ticket, client, kind, text, request = null, db = defaultDb, send = sendEmail }) {
  try {
    const company = await db.company.findUnique({
      where: { id: ticket.companyId },
      select: { name: true, defaultLanguage: true },
    });
    const language = company?.defaultLanguage || "en";
    let to = null;
    if (ticket.assignedToId) {
      const user = await db.member.findFirst({
        where: { companyId: ticket.companyId, userId: ticket.assignedToId, active: true },
        select: { user: { select: { email: true } } },
      });
      to = user?.user?.email || null;
    }
    if (!to) to = await ownerEmailFor(ticket.companyId);
    if (!to) return { sent: false, reason: "no_recipient" };
    const params = { clientName: client.name || "", subject: ticket.subject };
    const heading = await appSentence(language, kind === "replied" ? "app.clientTickets.email.repliedHeading" : "app.clientTickets.email.openedHeading", params);
    const { subject, html } = buildPlatformNotice({
      subject: heading,
      heading,
      sub: company?.name || "",
      paragraphs: [escapeHtml(text || "").replace(/\n/g, "<br>")],
      cta: { url: `${getAppOrigin(request)}/app/tickets/${ticket.id}`, label: await appSentence(language, "app.clientTickets.email.open") },
    });
    const result = await send({ companyId: ticket.companyId, from: await getPlatformFrom(), to, subject, html });
    return { sent: !result?.error && !result?.skipped };
  } catch (err) {
    console.error("[client-tickets] office email failed:", err?.message);
    return { sent: false, reason: "error" };
  }
}

/**
 * The client opens a ticket.
 * @param input { type, subject, body, photos, jobId, jobVisitId, invoiceId, quoteId, servicePlanId }
 * @param allowedTypes which types this entry point may create
 */
export async function openTicket({ client, input, allowedTypes = TICKET_TYPES, requestKey = null, db = defaultDb }) {
  const type = normaliseType(input?.type, allowedTypes);
  if (!type) return { ok: false, status: 400, error: "bad_type" };
  const subject = sanitiseSubject(input?.subject);
  const body = sanitiseBody(input?.body);
  if (!subject) return { ok: false, status: 400, error: "subject_required" };
  if (!body) return { ok: false, status: 400, error: "body_required" };
  const linked = await verifyClientLinks(db, client, input || {});
  if (!linked.ok) return { ok: false, status: 404, error: linked.error };
  const photos = ownUploads(input?.photos, { companyId: client.companyId });

  const ticket = await db.clientTicket.create({
    data: {
      companyId: client.companyId,
      clientId: client.id,
      type,
      subject,
      body,
      photos: photos.length ? photos : undefined,
      requestKey: requestKey || null,
      ...linked.links,
    },
    select: TICKET_SELECT,
  });
  notifyOffice({ ticket, client, type: "client_ticket.opened" });
  return { ok: true, ticket, notice: { kind: "opened", text: body } };
}

/** The client's own tickets, newest first, with their threads. */
export async function clientTickets({ client, db = defaultDb, take = 30 }) {
  return db.clientTicket.findMany({
    where: { clientId: client.id, companyId: client.companyId },
    orderBy: { updatedAt: "desc" },
    take,
    select: { ...TICKET_SELECT, messages: { orderBy: { createdAt: "asc" }, select: MESSAGE_SELECT } },
  });
}

export async function clientReply({ client, ticketId, body, photos, db = defaultDb, now = new Date() }) {
  const ticket = await db.clientTicket.findFirst({
    where: { id: String(ticketId || ""), clientId: client.id, companyId: client.companyId },
    select: TICKET_SELECT,
  });
  if (!ticket) return { ok: false, status: 404, error: "not_found" };
  const text = sanitiseBody(body);
  if (!text) return { ok: false, status: 400, error: "body_required" };
  const decision = afterReply({ ticket, by: "client", now });
  if (!decision.ok) return { ok: false, status: 409, error: decision.error };
  const media = ownUploads(photos, { companyId: client.companyId });
  await db.$transaction([
    db.clientTicketMessage.create({
      data: { ticketId: ticket.id, author: "client", body: text, photos: media.length ? media : undefined },
    }),
    db.clientTicket.update({ where: { id: ticket.id }, data: { ...decision.data, updatedAt: now } }),
  ]);
  notifyOffice({ ticket, client, type: "client_ticket.replied" });
  return { ok: true, ticket, notice: { kind: "replied", text } };
}

/** A ticket for the office, company-scoped. */
export async function staffTicket({ companyId, ticketId, db = defaultDb }) {
  return db.clientTicket.findFirst({
    where: { id: String(ticketId || ""), companyId },
    select: {
      ...TICKET_SELECT,
      client: { select: { id: true, name: true, email: true, phone: true } },
      messages: { orderBy: { createdAt: "asc" }, select: MESSAGE_SELECT },
    },
  });
}

/**
 * Staff reply: write it, move the status, email the client from the company
 * in the client's language with their portal link. The email result is
 * returned — a reply the client never received must be said on screen, not
 * assumed.
 */
export async function staffReply({ member, ticketId, body, request = null, db = defaultDb, send = sendEmail, now = new Date() }) {
  const ticket = await db.clientTicket.findFirst({
    where: { id: String(ticketId || ""), companyId: member.companyId },
    select: { ...TICKET_SELECT, client: { select: { id: true, name: true, email: true, language: true } } },
  });
  if (!ticket) return { ok: false, status: 404, error: "not_found" };
  const text = sanitiseBody(body);
  if (!text) return { ok: false, status: 400, error: "body_required" };
  const decision = afterReply({ ticket, by: "member", now });
  const user = member.userId
    ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } })
    : null;
  await db.$transaction([
    db.clientTicketMessage.create({
      data: { ticketId: ticket.id, author: "member", memberId: member.id || null, authorName: user?.name || null, body: text },
    }),
    db.clientTicket.update({ where: { id: ticket.id }, data: { ...decision.data, updatedAt: now } }),
  ]);

  let emailed = { sent: false, reason: "no_email" };
  if (ticket.client?.email) {
    try {
      const company = await db.company.findUnique({
        where: { id: member.companyId },
        select: { ...SENDER_SELECT, logoUrl: true, brandColor: true, phone: true, defaultLanguage: true },
      });
      const token = await ensurePortalToken(db, ticket.client.id, member.companyId);
      const language = resolveClientLanguage({ client: ticket.client, company });
      const { from, replyTo } = await resolveSender(company || {}, member.companyId);
      const mail = buildTicketReplyEmail({
        company: company || {},
        client: ticket.client,
        ticket,
        reply: text,
        staffName: user?.name || "",
        url: token ? portalUrl(token, request) : null,
        language,
      });
      const result = await send({ companyId: member.companyId, from, replyTo, to: ticket.client.email, ...mail });
      emailed = result?.skipped
        ? { sent: false, reason: "email_not_configured" }
        : result?.error
          ? { sent: false, reason: "send_failed" }
          : { sent: true, to: ticket.client.email };
    } catch (err) {
      console.error("[client-tickets] client email failed:", err?.message);
      emailed = { sent: false, reason: "send_failed" };
    }
  }
  return { ok: true, emailed };
}

/**
 * Status, priority and assignee — each optional. The assignee must be an
 * active member of THIS company; anyone else is refused, not silently cleared.
 */
export async function updateTicket({ member, ticketId, patch = {}, db = defaultDb, now = new Date() }) {
  const ticket = await db.clientTicket.findFirst({
    where: { id: String(ticketId || ""), companyId: member.companyId },
    select: TICKET_SELECT,
  });
  if (!ticket) return { ok: false, status: 404, error: "not_found" };
  const data = {};
  if (patch.status !== undefined) {
    const d = decideStatus({ ticket, to: patch.status, by: "member", now });
    if (!d.ok) return { ok: false, status: 400, error: d.error };
    Object.assign(data, d.data);
  }
  if (patch.priority !== undefined) {
    const p = normalisePriority(patch.priority);
    if (!p) return { ok: false, status: 400, error: "bad_priority" };
    data.priority = p;
  }
  if (patch.assignedToId !== undefined) {
    if (patch.assignedToId === null || patch.assignedToId === "") data.assignedToId = null;
    else {
      const m = await db.member.findFirst({
        where: { companyId: member.companyId, userId: String(patch.assignedToId), active: true },
        select: { userId: true },
      });
      if (!m) return { ok: false, status: 400, error: "bad_assignee" };
      data.assignedToId = m.userId;
    }
  }
  if (!Object.keys(data).length) return { ok: true, ticket };
  const updated = await db.clientTicket.update({ where: { id: ticket.id }, data, select: TICKET_SELECT });
  return { ok: true, ticket: updated };
}

/**
 * Repair / warranty → a job, through lib/jobs/createJob.js (the same path
 * New Job uses, with its tenant proofs). Once: a ticket already converted
 * answers with the job it became.
 */
export async function convertToJob({ member, ticketId, db = defaultDb }) {
  const ticket = await db.clientTicket.findFirst({
    where: { id: String(ticketId || ""), companyId: member.companyId },
    select: TICKET_SELECT,
  });
  if (!ticket) return { ok: false, status: 404, error: "not_found" };
  if (!CONVERTIBLE_TYPES.includes(ticket.type)) return { ok: false, status: 400, error: "not_convertible" };
  if (ticket.convertedJobId) return { ok: true, jobId: ticket.convertedJobId, already: true };
  const originalJob = ticket.jobId
    ? await db.job.findFirst({ where: { id: ticket.jobId, companyId: member.companyId }, select: { id: true, title: true, siteAddress: true } })
    : null;
  const draft = jobDraftFromTicket({ ticket, originalJob });
  const { job, error, status } = await createJob(db, {
    companyId: member.companyId,
    createdByUserId: member.userId,
    clientId: ticket.clientId,
    title: draft.title,
    siteAddress: draft.siteAddress,
    originalJobId: draft.originalJobId || undefined,
    callbackReason: draft.callbackReason || undefined,
  });
  if (!job) return { ok: false, status: status || 400, error: error || "create_failed" };
  // No dates yet, so it says so: "unscheduled", the same state an accepted
  // quote's job starts in, rather than createJob's default "scheduled" on a
  // job nobody has put in the diary.
  await db.job.update({ where: { id: job.id }, data: { status: "unscheduled" } });
  await db.clientTicket.update({
    where: { id: ticket.id },
    data: { convertedJobId: job.id, ...(ticket.status === "open" ? { status: "in_progress" } : {}) },
  });
  return { ok: true, jobId: job.id };
}

/** Open-ticket counts for a client or a job, for the badges on their pages. */
export async function openTicketCount({ companyId, clientId, jobId, db = defaultDb }) {
  return db.clientTicket.count({
    where: { companyId, status: { in: OPEN_STATUSES }, ...(clientId ? { clientId } : {}), ...(jobId ? { jobId } : {}) },
  });
}
