// lib/portal/changeRequest.js
//
// "Request to reschedule / skip" from the client portal → a to-do for the
// office. Nothing else.
//
// ── Why a Task, and why nothing moves ──────────────────────────────────────
//
// The owner's rule for this button: the company approves, and nothing moves
// automatically. So the request never touches the visit, the appointment or
// the plan — it files one Task on the office's to-do list, linked to the
// client and the job, and the office moves the date (or doesn't) with the
// controls it already has. A homeowner who could shift a crew visit from a
// web page would be rearranging somebody else's day.
//
// Not the portal's /request route: that feeds createScoredLead, the NEW-WORK
// pipeline. A reschedule filed there would sit on the lead board as a lead,
// count toward conversion rates, and be offered a quote.
//
// Not a new notification type either. The catalogue (lib/notifications/
// catalog.js) is audience-checked and translated per type; a to-do is what
// the office already works from for exactly this kind of "someone owes an
// action" — lib/tasks/autoCreate.js is the precedent, and its author helper
// (the company's owner) is reused rather than copied.
//
// ── Scoped twice ───────────────────────────────────────────────────────────
//
// Every target is looked up with BOTH the client's id and the client's
// company in the where. The token names one client of one company; a visit id
// from another household, or another company, finds nothing and is answered
// exactly like an id that does not exist.

import { db as defaultDb } from "@/lib/db";
import { fallbackAuthorId } from "@/lib/tasks/autoCreate";
import { appSentence } from "@/lib/notify/push";
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

/** A date in the office's language. A plan date is a calendar date (UTC
 *  midnight); a visit is an instant, shown in the company's own timezone. */
function officeDate(value, { language, timezone, calendar = false }) {
  try {
    return new Date(value).toLocaleDateString(language || "en", {
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
 * @param client   { id, companyId, name } — resolved from the portal token
 * @param request  parseChangeRequest(body).value
 * @returns {{ ok: true, alreadyRequested?: boolean } | { ok: false, status, error }}
 */
export async function fileChangeRequest({ client, request, now = new Date(), db = defaultDb }) {
  if (!client?.id || !client?.companyId) return { ok: false, status: 404, error: "not_found" };
  const { kind, action, id, occurrence, message } = request;

  let what = "";
  let when = null;
  let calendar = false;
  let jobId = null;

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
  } else {
    return { ok: false, status: 400, error: "bad_kind" };
  }

  if (!canRequestChange(when, { now })) return { ok: false, status: 409, error: "too_late" };

  const prefix = changeRequestPrefix({ kind, id, occurrence });
  if (!prefix) return { ok: false, status: 400, error: "bad_request" };

  // One open request per visit. A second tap is answered as done — the
  // office already has it — rather than filing a duplicate to-do.
  const open = await db.task.findFirst({
    where: {
      companyId: client.companyId,
      clientId: client.id,
      sourceKey: { startsWith: prefix },
      status: { in: ["open", "in_progress"] },
    },
    select: { id: true },
  });
  if (open) return { ok: true, alreadyRequested: true };

  const company = await db.company.findUnique({
    where: { id: client.companyId },
    select: { defaultLanguage: true, timezone: true },
  });
  const language = company?.defaultLanguage || "en";
  const date = officeDate(when, { language, timezone: company?.timezone, calendar });
  const whatText =
    what ||
    (await appSentence(language, kind === "appointment" ? "app.portalRequest.theAppointment" : "app.portalRequest.theVisit")) ||
    "";
  const params = { client: client.name || "", what: whatText, date };

  const title = await appSentence(
    language,
    action === "skip" ? "app.portalRequest.skipTitle" : "app.portalRequest.rescheduleTitle",
    params,
  );
  const lines = [await appSentence(language, "app.portalRequest.desc", params)];
  if (message) lines.push(await appSentence(language, "app.portalRequest.theirMessage", { message }));

  const createdById = await fallbackAuthorId(client.companyId, db);
  if (!createdById) return { ok: false, status: 503, error: "no_owner" };

  await db.task.create({
    data: {
      companyId: client.companyId,
      title: String(title || "").slice(0, 200),
      description: lines.filter(Boolean).join("\n\n"),
      // Due today: a client waiting on an answer about a date is the most
      // time-sensitive thing on the list.
      dueDate: new Date(now),
      priority: "high",
      createdById,
      // Unique per filing (the prefix + a stamp), so a request closed by the
      // office does not block the client from asking again about the same
      // visit later; the open-request check above is the duplicate guard.
      sourceKey: `${prefix}${new Date(now).getTime()}`,
      clientId: client.id,
      jobId,
    },
    select: { id: true },
  });
  return { ok: true };
}

/**
 * The open requests for one client, as the prefixes the portal marks rows
 * with. Best-effort: a failure here shows the buttons again, never an error.
 */
export async function openChangeRequestKeys({ client, db = defaultDb }) {
  try {
    const rows = await db.task.findMany({
      where: {
        companyId: client.companyId,
        clientId: client.id,
        sourceKey: { startsWith: "portal_change:" },
        status: { in: ["open", "in_progress"] },
      },
      select: { sourceKey: true },
      take: 200,
    });
    return new Set(rows.map((r) => String(r.sourceKey || "").replace(/\d+$/, "")));
  } catch (err) {
    console.error("[portal] open change requests unreadable:", err?.message);
    return new Set();
  }
}
