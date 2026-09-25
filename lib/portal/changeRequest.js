// lib/portal/changeRequest.js
//
// "Request to reschedule / Skip this visit" from the client portal → a
// client ticket of type "reschedule" for the office. Nothing else.
//
// ── Why a ticket, and why nothing moves ────────────────────────────────────
//
// The owner's rule for this button: the company approves, and nothing moves
// automatically. So the request never touches the visit, the appointment or
// the plan — it files one ClientTicket (lib/clientTickets/service.js) linked
// to the visit / plan and job, which lands in the office's Tickets queue with
// a notification, and which the client sees in "Your requests" with the
// office's answer. The office moves the date (or doesn't) with the controls it
// already has. A homeowner who could shift a crew visit from a web page would
// be rearranging somebody else's day.
//
// It was a Task (a to-do) in the first cut of this feature; client tickets
// arrived in the same change set and are the better home — the client gets
// the reply, and the office has one queue for everything a client asks.
//
// Not the portal's /request route: that feeds createScoredLead, the NEW-WORK
// pipeline. A reschedule filed there would sit on the lead board as a lead.
//
// ── Scoped twice ───────────────────────────────────────────────────────────
//
// Every target is looked up with BOTH the client's id and the client's
// company in the where. The token names one client of one company; a visit id
// from another household, or another company, finds nothing and is answered
// exactly like an id that does not exist.

import { db as defaultDb } from "@/lib/db";
import { openTicket } from "@/lib/clientTickets/service";
import { OPEN_STATUSES } from "@/lib/clientTickets/rules";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  changeRequestPrefix,
  upcomingPlanDates,
  isoDay,
  canRequestChange,
} from "@/lib/portal/view";

const PLAN_SELECT = {
  id: true,
  name: true,
  status: true,
  frequency: true,
  startDate: true,
  endMode: true,
  occurrenceCount: true,
  endDate: true,
  cancelledAt: true,
  completedAt: true,
};

/** A date in the client's language. A plan date is a calendar date (UTC
 *  midnight); a visit is an instant, shown in the company's own timezone. */
function clientDate(value, { language, timezone, calendar = false }) {
  try {
    return new Date(value).toLocaleDateString(documentFormatters(language).locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(calendar ? { timeZone: "UTC" } : timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
}

/**
 * @param client   { id, companyId, name, language } — from the portal token
 * @param request  parseChangeRequest(body).value
 * @returns {{ ok: true, alreadyRequested?: boolean, ticket?, notice? } | { ok: false, status, error }}
 */
export async function fileChangeRequest({ client, request, now = new Date(), db = defaultDb }) {
  if (!client?.id || !client?.companyId) return { ok: false, status: 404, error: "not_found" };
  const { kind, action, id, occurrence, message } = request;

  let what = "";
  let when = null;
  let calendar = false;
  let jobId = null;
  const links = {};

  if (kind === "visit") {
    const visit = await db.jobVisit.findFirst({
      where: { id, job: { clientId: client.id, companyId: client.companyId, archivedAt: null } },
      select: { scheduledAt: true, status: true, jobId: true, job: { select: { title: true } } },
    });
    if (!visit || ["cancelled", "canceled", "completed"].includes(visit.status)) {
      return { ok: false, status: 404, error: "not_found" };
    }
    what = visit.job?.title || "";
    when = visit.scheduledAt;
    jobId = visit.jobId;
    links.jobVisitId = id;
  } else if (kind === "appointment") {
    const appt = await db.appointment.findFirst({
      where: { id, clientId: client.id, companyId: client.companyId },
      select: { scheduledAt: true, status: true, jobId: true, booking: { select: { startTime: true, status: true } } },
    });
    if (!appt || appt.status === "cancelled" || appt.status === "completed" || appt.booking?.status === "cancelled") {
      return { ok: false, status: 404, error: "not_found" };
    }
    when = appt.booking?.startTime || appt.scheduledAt;
    jobId = appt.jobId || null;
  } else if (kind === "plan") {
    const plan = await db.servicePlan.findFirst({
      where: { id, clientId: client.id, companyId: client.companyId, status: "active" },
      select: PLAN_SELECT,
    });
    // The date must be one the portal actually showed: one of the plan's own
    // next dates, recomputed here. A made-up date is refused, not filed.
    const match = plan ? upcomingPlanDates(plan, { now }).find((d) => isoDay(d) === occurrence) : null;
    if (!match) return { ok: false, status: 404, error: "not_found" };
    what = plan.name || "";
    when = match;
    calendar = true;
    links.servicePlanId = id;
  } else {
    return { ok: false, status: 400, error: "bad_kind" };
  }

  if (!canRequestChange(when, { now })) return { ok: false, status: 409, error: "too_late" };

  const prefix = changeRequestPrefix({ kind, id, occurrence });
  if (!prefix) return { ok: false, status: 400, error: "bad_request" };

  // One open request per visit. A second tap is answered as done — the
  // office already has it — rather than filing a duplicate ticket.
  const open = await db.clientTicket.findFirst({
    where: {
      companyId: client.companyId,
      clientId: client.id,
      requestKey: prefix,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true },
  });
  if (open) return { ok: true, alreadyRequested: true };

  const company = await db.company.findUnique({
    where: { id: client.companyId },
    select: { defaultLanguage: true, timezone: true },
  });
  // The CLIENT's language: the ticket is their words, and they read it back
  // in "Your requests". The office sees the same subject in its queue.
  const language = resolveClientLanguage({ client, company });
  const c = clientDocCopy(language).portal;
  const date = clientDate(when, { language, timezone: company?.timezone, calendar });
  const whatText = what || (kind === "appointment" ? c.typeAppointment : c.typeVisit);
  const subject = action === "skip" ? c.skipSubject(whatText, date) : c.rescheduleSubject(whatText, date);

  const result = await openTicket({
    client,
    input: {
      type: "reschedule",
      subject,
      body: message || c.requestNoMessage,
      ...links,
      ...(jobId ? { jobId } : {}),
    },
    allowedTypes: ["reschedule"],
    requestKey: prefix,
    db,
  });
  if (!result.ok) return result;
  return { ok: true, ticket: result.ticket, notice: result.notice };
}

/**
 * The open requests for one client, as the prefixes the portal marks rows
 * with. Best-effort: a failure here shows the buttons again, never an error.
 */
export async function openChangeRequestKeys({ client, db = defaultDb }) {
  try {
    const rows = await db.clientTicket.findMany({
      where: {
        companyId: client.companyId,
        clientId: client.id,
        requestKey: { startsWith: "portal_change:" },
        status: { in: OPEN_STATUSES },
      },
      select: { requestKey: true },
      take: 200,
    });
    return new Set(rows.map((r) => String(r.requestKey || "")));
  } catch (err) {
    console.error("[portal] open change requests unreadable:", err?.message);
    return new Set();
  }
}
