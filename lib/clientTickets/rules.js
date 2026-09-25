// lib/clientTickets/rules.js
//
// The closed sets and the pure decisions behind client tickets — what a client
// may raise from the portal, how a ticket moves, which photos may ride along,
// and exactly which fields of a ticket reach the client's browser.
//
// Pure: no database, no clock that isn't injected. scripts/check-client-
// tickets.mjs executes every function here against hostile input.
//
// Shaped after lib/support/escalation.js (the platform's own ticket queue) —
// same sanitisers, same "one function moves a status" rule — so the two queues
// behave alike, but nothing is shared at runtime: that queue is FieldQuo's
// record about a company, this one is a company's record about its client.

import { sanitiseSubject, sanitiseBody, MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH } from "@/lib/support/escalation";
import { normaliseMediaList } from "@/lib/media/validate";

export { MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH };

/** Every type a ticket can have. `maintenance` is the "book my next included
 *  visit" request from a plan — a ticket, so it has a conversation and a
 *  status like the rest, and the company confirms it by replying. */
export const TICKET_TYPES = ["repair", "warranty", "question", "billing", "reschedule", "maintenance"];

/** The ones the portal's "Report an issue" form offers. Reschedule and
 *  maintenance are raised from their own buttons (a visit, a plan). */
export const CLIENT_ISSUE_TYPES = ["repair", "warranty", "question", "billing"];

export const TICKET_STATUSES = ["open", "in_progress", "waiting_on_client", "resolved", "closed"];
export const OPEN_STATUSES = ["open", "in_progress", "waiting_on_client"];
export const DONE_STATUSES = ["resolved", "closed"];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];

/** Repair and warranty are work — the two a company can turn into a job. */
export const CONVERTIBLE_TYPES = ["repair", "warranty"];

export const MAX_PHOTOS = 6;

export function normaliseType(raw, allowed = TICKET_TYPES) {
  const t = String(raw || "").trim().toLowerCase();
  return allowed.includes(t) ? t : null;
}

export function normaliseStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  return TICKET_STATUSES.includes(s) ? s : null;
}

export function normalisePriority(raw) {
  const p = String(raw || "").trim().toLowerCase();
  return TICKET_PRIORITIES.includes(p) ? p : null;
}

export { sanitiseSubject, sanitiseBody };

/**
 * Photos a browser says it uploaded — kept only when each is THIS company's
 * own Cloudinary upload from the portal's upload route (folder
 * fieldquo/companies/<companyId>/portal). A URL a browser chose freely
 * would be an image of anything, from anywhere, shown to staff under the
 * client's name — or a tracking pixel in the office's own screen.
 */
export function ownUploads(list, { companyId, cloudName = process.env.CLOUDINARY_CLOUD_NAME } = {}) {
  if (!companyId || !cloudName) return [];
  const prefix = `https://res.cloudinary.com/${cloudName}/`;
  const folder = `/fieldquo/companies/${companyId}/portal/`;
  return normaliseMediaList(list, { max: MAX_PHOTOS })
    .filter((m) => m.url.startsWith(prefix) && m.url.includes(folder) && !/[\s"'<>]/.test(m.url))
    .map((m) => ({ url: m.url, kind: m.kind, filename: m.filename || null }));
}

/**
 * A status change, decided. `by` is "member" or "client": a client can only
 * REOPEN (by replying) — never resolve, close or move a ticket for the office.
 *
 * @returns {{ ok: true, data } | { ok: false, error }}
 */
export function decideStatus({ ticket, to, by = "member", now = new Date() }) {
  const next = normaliseStatus(to);
  if (!ticket || !next) return { ok: false, error: "bad_status" };
  if (by !== "member") return { ok: false, error: "not_allowed" };
  if (next === ticket.status) return { ok: true, data: {} };
  const data = { status: next };
  if (DONE_STATUSES.includes(next)) data.resolvedAt = ticket.resolvedAt || now;
  else data.resolvedAt = null;
  return { ok: true, data };
}

/**
 * What a reply does to the ticket's status.
 *
 *   client replies → waiting_on_client / resolved become "open" again (they
 *                    answered, or it isn't fixed); a CLOSED ticket takes no
 *                    replies — the office closed the conversation, and a new
 *                    issue is a new ticket.
 *   member replies → "open" becomes "in_progress" (somebody has it); the first
 *                    staff reply stamps firstResponseAt.
 */
export function afterReply({ ticket, by, now = new Date() }) {
  if (!ticket) return { ok: false, error: "not_found" };
  if (by === "client") {
    if (ticket.status === "closed") return { ok: false, error: "closed" };
    if (ticket.status === "waiting_on_client" || ticket.status === "resolved") {
      return { ok: true, data: { status: "open", resolvedAt: null } };
    }
    return { ok: true, data: {} };
  }
  const data = {};
  if (ticket.status === "open") data.status = "in_progress";
  if (!ticket.firstResponseAt) data.firstResponseAt = now;
  return { ok: true, data };
}

/** A first name for the client's view of a staff reply — never the full name. */
export function staffFirstName(name) {
  const f = String(name || "").trim().split(/\s+/)[0];
  return f || null;
}

/**
 * One ticket as the CLIENT sees it. Built field by field: no assignee id, no
 * member ids, no priority (the office's triage, not the client's business),
 * no internal links beyond what the client already holds.
 */
export function clientTicketView(t) {
  if (!t) return null;
  return {
    id: t.id,
    type: t.type,
    subject: t.subject,
    body: t.body,
    photos: Array.isArray(t.photos) ? t.photos.map((p) => ({ url: p.url, kind: p.kind })) : [],
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messages: (t.messages || []).map((m) => ({
      id: m.id,
      author: m.author === "member" ? "member" : "client",
      name: m.author === "member" ? staffFirstName(m.authorName) : null,
      body: m.body,
      photos: Array.isArray(m.photos) ? m.photos.map((p) => ({ url: p.url, kind: p.kind })) : [],
      createdAt: m.createdAt,
    })),
  };
}

/**
 * The job a repair / warranty ticket becomes, for the EXISTING create-job path
 * (lib/jobs/createJob.js): a title, the original job's site address, and —
 * when the ticket is about a job — the callback link that path already has
 * (Job.originalJobId + callbackReason): a warranty ticket is a "warranty"
 * callback, a repair is "rework". The office can still change either on the
 * job. Nothing is priced or scheduled here.
 */
export function jobDraftFromTicket({ ticket, originalJob = null }) {
  if (!ticket || !CONVERTIBLE_TYPES.includes(ticket.type)) return null;
  const kind = ticket.type === "warranty" ? "Warranty" : "Repair";
  const title = (originalJob?.title ? `${kind} — ${originalJob.title}` : `${kind} — ${ticket.subject}`).slice(0, 160);
  return {
    title,
    siteAddress: originalJob?.siteAddress || null,
    originalJobId: originalJob?.id || null,
    callbackReason: originalJob?.id ? (ticket.type === "warranty" ? "warranty" : "rework") : null,
  };
}
