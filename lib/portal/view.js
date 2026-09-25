// lib/portal/view.js
//
// What the client portal shows about plans and visits, shaped from rows the
// route has already narrowed with a `select`.
//
// Pure. No database, no clock that isn't injected — the portal route calls
// these, and scripts/check-client-portal.mjs executes them against hostile
// input (a cancelled plan, a malformed anchor, a visit from another company,
// an "issue" photo) rather than trusting a read of them.
//
// ── Why a module and not more lines in the route ────────────────────────────
//
// The route is an allow-list: a field has to be NAMED to leave the building.
// These functions are the second half of that promise — each builds a new
// object field by field, never `...row`, so a column added to JobVisit or
// ServicePlan tomorrow cannot ride along to a homeowner's browser by default.

import {
  occurrenceDate,
  seqWithinTerm,
  planBlockedReason,
} from "@/lib/servicePlans/schedule";
import { occurrenceAmounts } from "@/lib/servicePlans/pricing";
import { windowFor } from "@/lib/booking/arrivalWindow";

/** How many plan dates the card lists. The owner's ask: "next 3". */
export const PLAN_DATES_SHOWN = 3;

/** Lists are capped — the portal is a statement, not an archive. */
export const UPCOMING_SHOWN = 10;
export const PAST_SHOWN = 10;
export const PAST_PHOTOS_PER_VISIT = 6;

/** A visit that has not happened yet may still be asked about for this long
 *  before it starts: inside it, the crew is already loading the van and a
 *  message is the wrong channel — the page says to call instead. */
export const CHANGE_REQUEST_CUTOFF_HOURS = 24;

/** The photo stage a client may NOT see. "issue" is the office's record of a
 *  problem found on site — lib/gallery/stages.js says it is never to publish.
 *  A deny-list of one rather than an allow-list, on purpose and matching the
 *  job card's own rule (`stage: { not: "issue" }` in the portal route): the
 *  live table also holds "before" / "after" rows, which lib/gallery treats as
 *  "progress" (normaliseStage) — an allow-list of the four canonical keys
 *  would have hidden every one of them from the client whose house they show. */
export const HIDDEN_PHOTO_STAGES = ["issue"];

const WALK_GUARD = 2000;

function toDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC midnight of the day `now` falls on — plan dates are calendar dates
 *  stored as UTC midnight (see lib/servicePlans/schedule.js), so "today's
 *  visit" must still count as upcoming all day. */
function startOfUtcDay(now) {
  const d = toDate(now) || new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "2026-10-14" — the stable key a plan occurrence is requested against. */
export function isoDay(date) {
  const d = toDate(date);
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * The next `count` dates a plan will fall on, from today.
 *
 * Not nextDueDate(): that answers "when will this BILL next" and returns null
 * for a plan whose start is still in the future, which is exactly the plan a
 * client who just signed up most wants to see the dates of. This walks the
 * same anchor-based series (occurrenceDate) inside the same term
 * (seqWithinTerm), so it can never list a date the billing engine would not.
 *
 * Returns [] for anything that will not produce a visit — cancelled,
 * completed, malformed — rather than a plausible-looking date.
 */
export function upcomingPlanDates(plan, { now = new Date(), count = PLAN_DATES_SHOWN } = {}) {
  if (!plan) return [];
  const blocked = planBlockedReason(plan, { now });
  // not_started is the one blocked reason that still has dates ahead of it.
  if (blocked && blocked !== "not_started") return [];
  const floor = startOfUtcDay(now);
  const out = [];
  for (let seq = 0; seq < WALK_GUARD && out.length < count; seq++) {
    if (!seqWithinTerm(plan, seq)) break;
    const date = occurrenceDate(plan.startDate, plan.frequency, seq);
    if (!date) break;
    if (date >= floor) out.push(date);
  }
  return out;
}

/**
 * One plan as the client sees it. Money is what THEY pay per visit — the
 * figure each of their invoices will carry — never the company's gross rate
 * sheet; the member discount is stated because it is part of what they agreed.
 *
 * @returns null for a plan that should not be on the page at all.
 */
export function shapePlanForPortal(plan, { now = new Date() } = {}) {
  if (!plan || plan.status !== "active") return null;
  const blocked = planBlockedReason(plan, { now });
  if (blocked && blocked !== "not_started") return null;

  const amounts = occurrenceAmounts(plan);
  const discountPct = Number(plan.discountPct) > 0 ? Math.min(100, Number(plan.discountPct)) : 0;
  return {
    id: plan.id,
    name: String(plan.name || ""),
    // What's included: the service as frozen on the plan when it was sold —
    // see ServicePlan.serviceName for why it is a copy and not a join.
    serviceName: String(plan.serviceName || ""),
    frequency: plan.frequency,
    next: upcomingPlanDates(plan, { now }).map((d) => d.toISOString()),
    perVisit: amounts.total,
    // Only said when the plan actually carries one; 0 is "no discount", not a
    // discount of nothing to print.
    discountPct,
    // Whether perVisit includes tax. A null rate is the contractor's stated
    // "no tax on this plan" (ServicePlan.taxRatePct) — nothing to mention.
    taxIncluded: amounts.taxCents > 0,
    // Open-ended plans have no end; a count/until plan says when it stops.
    endsOn: plan.endMode === "until" && toDate(plan.endDate) ? toDate(plan.endDate).toISOString() : null,
    visitsSold: plan.endMode === "count" && Number.isInteger(Number(plan.occurrenceCount)) ? Number(plan.occurrenceCount) : null,
  };
}

/** A crew member's first name, never the whole name or an id. */
export function firstName(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  return first || null;
}

const CANCELLED = new Set(["cancelled", "canceled"]);

/**
 * The key a change request is filed and found under — one per visit (or per
 * plan date), whichever action was asked for. Built in one place so the POST
 * that files a request and the GET that marks a row "requested" can't drift.
 */
export function changeRequestPrefix({ kind, id, occurrence = null }) {
  if (!["visit", "appointment", "plan"].includes(kind) || !id) return null;
  if (kind === "plan" && !/^\d{4}-\d{2}-\d{2}$/.test(String(occurrence || ""))) return null;
  return `portal_change:${kind}:${id}:${kind === "plan" ? occurrence : "-"}:`;
}

/** Whether a start time is still far enough away to ask about by message. */
export function canRequestChange(at, { now = new Date() } = {}) {
  const when = toDate(at);
  if (!when) return false;
  return when.getTime() - toDate(now).getTime() > CHANGE_REQUEST_CUTOFF_HOURS * 3600000;
}

/**
 * The client's visits, split into next / upcoming / past.
 *
 * @param visits        JobVisit rows (the route's select): id, scheduledAt,
 *                      status, returnReason, assignedTo{name},
 *                      job{title, siteAddress, clientId, companyId}
 * @param appointments  Appointment rows: id, scheduledAt, status, location,
 *                      assignedTo{name}, job{title}, booking{startTime,
 *                      endTime, mode, status}, clientId, companyId
 * @param photos        JobPhoto rows already filtered to client-safe ones:
 *                      id, url, jobVisitId
 * @param client        { id, companyId, type, address, city, province, postalCode }
 * @param company       { arrivalWindowMinutes }
 * @param requested     Set of changeRequestPrefix() values with an open request
 *
 * Every row is re-checked against the client's own id AND company here, on
 * top of the route's where. The route is the boundary; this is the second
 * lock, and the check script feeds it a row from another company to prove it.
 */
export function shapeVisits({
  visits = [],
  appointments = [],
  photos = [],
  client,
  company = {},
  requested = new Set(),
  now = new Date(),
} = {}) {
  if (!client?.id || !client?.companyId) return { next: null, upcoming: [], past: [] };
  const nowDate = toDate(now) || new Date();
  const homeAddress =
    client.type === "company" ? null : formatHome(client);

  const photosByVisit = new Map();
  for (const p of photos || []) {
    if (!p?.jobVisitId || !p?.url) continue;
    const list = photosByVisit.get(p.jobVisitId) || [];
    if (list.length < PAST_PHOTOS_PER_VISIT) list.push({ id: p.id, url: p.url });
    photosByVisit.set(p.jobVisitId, list);
  }

  const items = [];

  for (const v of visits || []) {
    if (!v?.job || v.job.clientId !== client.id || v.job.companyId !== client.companyId) continue;
    if (CANCELLED.has(String(v.status || ""))) continue;
    const at = toDate(v.scheduledAt);
    if (!at) continue;
    const w = windowFor(at, company.arrivalWindowMinutes);
    const key = changeRequestPrefix({ kind: "visit", id: v.id });
    items.push({
      kind: "visit",
      id: v.id,
      at: at.toISOString(),
      windowStart: w ? w.start.toISOString() : null,
      windowEnd: w ? w.end.toISOString() : null,
      // A return visit — the "callback" a homeowner books when something
      // needs looking at again — is labelled as one; the reason code itself
      // (rework / warranty / not_our_fault) is the office's judgement and
      // stays in the office.
      type: v.returnReason ? "return" : "crew",
      title: String(v.job.title || ""),
      crew: firstName(v.assignedTo?.name),
      address: String(v.job.siteAddress || "").trim() || homeAddress,
      completed: v.status === "completed",
      photos: [],
      _photos: photosByVisit.get(v.id) || [],
      requested: requested.has(key),
    });
  }

  for (const a of appointments || []) {
    if (!a || a.clientId !== client.id || a.companyId !== client.companyId) continue;
    if (a.status === "cancelled") continue;
    if (a.booking && a.booking.status === "cancelled") continue;
    const start = toDate(a.booking?.startTime) || toDate(a.scheduledAt);
    if (!start) continue;
    const mode = a.booking?.mode || "visit";
    // A booked slot has a real end; a crew-style visit gets the company's
    // arrival window (Company.arrivalWindowMinutes) and nothing invented when
    // that is zero. Calls and video calls are an exact time — the same rule
    // lib/schedule/clientNotice.js applies to the confirmation letter.
    const w = mode === "visit" ? windowFor(start, company.arrivalWindowMinutes) : null;
    const key = changeRequestPrefix({ kind: "appointment", id: a.id });
    items.push({
      kind: "appointment",
      id: a.id,
      at: start.toISOString(),
      windowStart: w ? w.start.toISOString() : null,
      windowEnd: w ? w.end.toISOString() : null,
      type: mode === "call" ? "call" : mode === "video" ? "video" : "appointment",
      title: String(a.job?.title || ""),
      crew: firstName(a.assignedTo?.name),
      // Nobody comes to the house for a phone or video call, so no address.
      address: mode === "visit" ? String(a.location || "").trim() || homeAddress : null,
      completed: a.status === "completed" || a.booking?.status === "completed",
      photos: [],
      _photos: [],
      requested: requested.has(key),
    });
  }

  items.sort((x, y) => new Date(x.at) - new Date(y.at));

  const upcoming = [];
  const past = [];
  for (const it of items) {
    const isPast = it.completed || new Date(it.at) < nowDate;
    const { _photos, completed, ...rest } = it;
    if (isPast) {
      // Photos only on visits that have happened — that is where the crew's
      // record of the work belongs, and a future visit has none.
      past.push({ ...rest, photos: _photos, canRequest: false, requested: false });
    } else {
      upcoming.push({ ...rest, canRequest: canRequestChange(it.at, { now: nowDate }) });
    }
  }
  past.reverse();

  return {
    next: upcoming[0] || null,
    upcoming: upcoming.slice(0, UPCOMING_SHOWN),
    past: past.slice(0, PAST_SHOWN),
  };
}

function formatHome(client) {
  const base = String(client?.address || "").trim();
  if (!base) return null;
  const parts = [base];
  for (const v of [client.city, client.province, client.postalCode]) {
    const s = String(v || "").trim();
    if (s && !base.toLowerCase().includes(s.toLowerCase())) parts.push(s);
  }
  return parts.join(", ");
}

/**
 * A change request's body, checked. The browser sends WHICH visit and WHAT it
 * wants, never a date to move it to: the company picks the new date, and
 * nothing moves until it does.
 *
 * @returns {{ ok: true, value } | { ok: false, error }}
 */
export function parseChangeRequest(body) {
  const kind = String(body?.kind || "");
  const action = String(body?.action || "");
  const id = String(body?.id || "").slice(0, 64);
  const occurrence = body?.occurrence == null ? null : String(body.occurrence).slice(0, 10);
  if (!["visit", "appointment", "plan"].includes(kind)) return { ok: false, error: "bad_kind" };
  if (!["reschedule", "skip"].includes(action)) return { ok: false, error: "bad_action" };
  // Skipping is a plan idea — one visit of a series. A one-off visit asked to
  // be "skipped" is a cancellation, and that conversation belongs on the phone.
  if (action === "skip" && kind !== "plan") return { ok: false, error: "bad_action" };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, error: "bad_id" };
  if (kind === "plan" && !/^\d{4}-\d{2}-\d{2}$/.test(occurrence || "")) return { ok: false, error: "bad_occurrence" };
  const message = String(body?.message ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 1000);
  return { ok: true, value: { kind, action, id, occurrence: kind === "plan" ? occurrence : null, message } };
}

/**
 * An email address as a login lookup key: trimmed, lower-cased, and refused
 * when it is not shaped like one. Refusing early costs nothing — it says
 * nothing about who is a client — and keeps garbage out of the rate-limit map.
 */
export function normaliseLoginEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s.length < 3 || s.length > 254) return null;
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s)) return null;
  return s;
}
