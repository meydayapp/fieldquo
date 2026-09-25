// app/api/visit/[token]/reschedule/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { getAppOrigin } from "@/lib/appUrl";
import { computeAvailableSlots } from "@/lib/booking/computeAvailability";
import { eventTypeForMode } from "@/lib/booking/bookingModes";
import { canClientChange, changeNoticeHours } from "@/lib/booking/changePolicy";
import {
  loadVisitByToken,
  visitView,
  visitFacts,
  visitManagePath,
  planReschedule,
  slotIsOffered,
  reasonMessage,
} from "@/lib/booking/manageVisit";
import { sendVisitRescheduledEmails } from "@/app/admin/lib/email/templates";
import { bookingInviteAttachment, nextSequence } from "@/lib/booking/bookingInvite";
import { scheduleSync } from "@/lib/calendar/googleSync";
import { textClientOfChange, bookingTextTarget } from "@/lib/schedule/changeText";

// Public, token-only — the client moving their own visit.
//
// ── Why its own route rather than another `action` on the parent ──────────
//
// The parent POST does one irreversible thing and can move money; keeping it
// short is the point of it. This one takes a different body, needs a different
// allowance (someone picking a time will legitimately try more than once, while
// six cancels in ten minutes is already odd), and its expensive part — real
// availability, which can reach Google for travel time — has no business
// sitting behind a switch in the money path. Token resolution and the policy
// decisions are shared through lib/booking/manageVisit.js, so the split costs no
// duplication.
//
// ── The fee carries over ─────────────────────────────────────────────────
//
// Nothing here touches feePaidCents, feeStripePaymentIntentId or the refund
// columns. A client moving a visit has not asked to be re-charged and has not
// asked for their deposit back; the same fee follows the same visit to its new
// time. That is why this is a reschedule and not a cancel-and-rebook.

const RESCHEDULE_LIMIT = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
  message: "Too many attempts. Please wait a few minutes, or call us.",
};

/** UTC midnight, n days either side — the window availability is computed over. */
function dayWindow(start) {
  const midnight = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  // ±1 day because a schedule is anchored to the WORKER's timezone: a 9am
  // Toronto slot on the 20th is 13:00Z on the 20th, but a 9pm one is 01:00Z on
  // the 21st. Asking only for the UTC day the requested instant falls in would
  // miss the evening slots of the day before.
  return {
    fromDate: new Date(midnight - 86400000),
    toDate: new Date(midnight + 86400000),
  };
}

const SLOTS_LIMIT = {
  limit: 40,
  windowMs: 10 * 60 * 1000,
  message: "Too many requests. Please wait a few minutes, or call us.",
};

/** A YYYY-MM-DD from the query, or null. Never a partially-parsed date. */
function queryDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — the times this visit could move to.
 *
 * ── Why the calendar cannot compute this itself ──────────────────────────
 *
 * Availability is a server question: the worker's bookable hours, approved
 * leave, every other appointment in the way, and — for an on-site visit —
 * whether the estimator can physically reach the address from whatever is
 * before it. The browser knows none of that and must not guess.
 *
 * ── Every slot returned must survive the POST ────────────────────────────
 *
 * This offers only times planReschedule would accept. Availability alone is
 * not enough: a slot can be genuinely free and still be refused for being
 * inside the notice window, and a calendar that shows a time the next request
 * rejects is a control that appears to work and doesn't — on a page whose
 * whole job is letting someone move an appointment without ringing anyone.
 *
 * So the same two filters the POST applies are applied here, in the same order:
 * the client must be allowed to change at all, and each candidate must clear
 * the notice window measured from now.
 */
export async function GET(request, { params }) {
  const limited = rateLimit(request, "visit-manage-slots", SLOTS_LIMIT);
  if (limited) return limited;

  const { token } = await params;
  const visit = await loadVisitByToken(token);
  if (!visit) {
    return NextResponse.json(
      { error: reasonMessage("not_found"), reason: "not_found" },
      { status: 404 },
    );
  }

  const { booking, company, eventType } = visit;

  // Asked before anything expensive: a client who may not change this booking
  // gets the reason, not a month of times they cannot take. computeAvailableSlots
  // can reach Google for travel time, and that is not work to do for someone
  // whose answer is already no.
  const change = canClientChange(booking, company);
  if (!change.allowed) {
    return NextResponse.json(
      { error: reasonMessage(change.reason), reason: change.reason, slots: {} },
      { status: 409 },
    );
  }

  const url = new URL(request.url);
  const from = queryDate(url.searchParams.get("from"));
  const to = queryDate(url.searchParams.get("to"));
  if (!from || !to || to < from) {
    return NextResponse.json(
      { error: reasonMessage("bad_time"), reason: "bad_range", slots: {} },
      { status: 400 },
    );
  }

  // A month at a time is what the calendar asks for. Capped so a crafted range
  // cannot turn one public request into a year of availability computation —
  // and travel time makes each day genuinely expensive.
  const MAX_DAYS = 62;
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (spanDays > MAX_DAYS) {
    return NextResponse.json(
      { error: reasonMessage("bad_time"), reason: "range_too_wide", slots: {} },
      { status: 400 },
    );
  }

  const destination =
    company.travelCheckEnabled &&
    booking.mode === "visit" &&
    booking.latitude != null &&
    booking.longitude != null
      ? { lat: Number(booking.latitude), lng: Number(booking.longitude) }
      : null;

  const slotsByDate = await computeAvailableSlots({
    // The booking keeps its mode on a move, so the new time is found at that
    // mode's length — a phone call re-slotted at the call's twenty minutes,
    // a visit at the visit's hour. Same function planReschedule sizes the
    // new end time with, so the two cannot disagree.
    eventType: eventTypeForMode({ company, eventType, mode: booking.mode }),
    fromDate: from,
    toDate: to,
    destination,
    travelBuffer: company.travelBufferMinutes || 0,
    // The same exclusion the POST uses: without it this visit's own slot blocks
    // every candidate overlapping it, and the times nearest the one they have
    // — the ones they are most likely to want — are the ones missing.
    exclude: { bookingId: booking.id, appointmentId: booking.appointmentId },
  });

  // Drop anything the POST would refuse for being too soon, and any date left
  // empty by that filter, so the calendar's "nothing free" and the server's
  // agree exactly.
  const notice = changeNoticeHours(company);
  const now = Date.now();
  const offered = {};
  for (const [date, times] of Object.entries(slotsByDate || {})) {
    const usable = (times || []).filter(
      (t) => (new Date(t).getTime() - now) / 3_600_000 >= notice,
    );
    if (usable.length) offered[date] = usable;
  }

  return NextResponse.json({
    slots: offered,
    noticeHours: notice,
    timezone: company.timezone || null,
  });
}

export async function POST(request, { params }) {
  const limited = rateLimit(request, "visit-manage-reschedule", RESCHEDULE_LIMIT);
  if (limited) return limited;

  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;
  const body = await request.json().catch(() => ({}));

  const visit = await loadVisitByToken(token);
  if (!visit) {
    return NextResponse.json(
      { error: reasonMessage("not_found"), reason: "not_found" },
      { status: 404 },
    );
  }

  const { booking, eventType, company } = visit;
  const now = new Date();

  // Policy, parsing and the notice window on the NEW time — everything that can
  // be decided without asking the calendar, decided before we pay for the
  // calendar. Re-taken server-side: the page may have rendered a "move" button
  // an hour ago, and it is not the thing that decides.
  const plan = planReschedule(booking, company, eventType, body?.startTime, now);
  if (!plan.ok) {
    return NextResponse.json(
      { error: reasonMessage(plan.reason), reason: plan.reason },
      { status: plan.httpStatus },
    );
  }

  // ── The new time has to be a time the company actually offers ────────────
  //
  // Against the SAME availability the booking page uses, not against "is it in
  // the future". Accepting any timestamp would let a client post 3am on a
  // Sunday, or a slot the estimator cannot physically reach from the job before
  // it — the booking flow spends real effort on both, and a reschedule that
  // skipped it would be the back door into an unbookable calendar.
  //
  // Their own booking and its appointment are excluded, or their current slot
  // would block every candidate overlapping it and "half an hour later" would
  // come back unavailable for no reason they could see.
  const { fromDate, toDate } = dayWindow(plan.start);
  const destination =
    company.travelCheckEnabled &&
    booking.mode === "visit" &&
    booking.latitude != null &&
    booking.longitude != null
      ? { lat: Number(booking.latitude), lng: Number(booking.longitude) }
      : null;

  const slotsByDate = await computeAvailableSlots({
    // The booking keeps its mode on a move, so the new time is found at that
    // mode's length — a phone call re-slotted at the call's twenty minutes,
    // a visit at the visit's hour. Same function planReschedule sizes the
    // new end time with, so the two cannot disagree.
    eventType: eventTypeForMode({ company, eventType, mode: booking.mode }),
    fromDate,
    toDate,
    destination,
    travelBuffer: company.travelBufferMinutes || 0,
    exclude: { bookingId: booking.id, appointmentId: booking.appointmentId },
  });

  const offered = Object.values(slotsByDate).flat();
  if (!slotIsOffered(offered, plan.start)) {
    return NextResponse.json(
      { error: reasonMessage("slot_unavailable"), reason: "slot_unavailable" },
      { status: 409 },
    );
  }

  // No second conflict query before the write, unlike the confirm route. There
  // it is needed because availability was computed by the browser minutes
  // earlier; here it was computed server-side a few milliseconds ago from the
  // same rows, so a re-check would be the same query asked twice. The residual
  // race — two people writing the same slot in the same instant — is the one
  // the booking flow already carries, and closing it properly means a
  // constraint, not another read.
  const previousStartTime = booking.startTime;

  // The invite's SEQUENCE goes up in the same write: the letter re-sends the
  // confirmation's UID one higher, which is what makes the client's calendar
  // replace the event rather than add a second beside it.
  const sequence = nextSequence(booking);
  await db.booking.update({
    where: { id: booking.id },
    data: { startTime: plan.start, endTime: plan.end, calendarSequence: sequence },
  });

  // The crew's calendar moves with it. Without this the appointment stays at
  // the old time: the client would be told the visit moved and the estimator
  // would still be looking at the original slot.
  if (booking.appointmentId) {
    await db.appointment
      .update({ where: { id: booking.appointmentId }, data: { scheduledAt: plan.start } })
      .catch((err) => console.error("[visit] moving appointment failed:", err?.message));
  }
  // And the estimator's Google Calendar moves with it.
  if (booking.appointmentId) scheduleSync("appointment", booking.appointmentId);
  else scheduleSync("booking", booking.id);

  const after = {
    ...visit,
    booking: { ...booking, startTime: plan.start, endTime: plan.end, calendarSequence: sequence },
  };

  // The link they are already holding, so the new confirmation can be acted on
  // the same way. Built from the token in the URL rather than re-read from the
  // row — it never has to enter a response body to get here.
  let manageUrl = null;
  try {
    manageUrl = `${getAppOrigin(request)}${visitManagePath(token)}`;
  } catch (err) {
    console.error("[visit] manage link unavailable:", err?.message);
  }

  const movedView = visitView(after, now);
  const movedLanguage = movedView.language;
  const invite = await bookingInviteAttachment({
    booking: after.booking,
    company,
    language: movedLanguage,
    sequence,
    manageUrl,
  });

  // Both sides get told. Best-effort — the visit has already moved.
  await sendVisitRescheduledEmails({
    company,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    // The client's copy in the page's language (the stored draft, via
    // visitView); the office's copy in the company's own words.
    eventTypeName: movedView.eventTypeName,
    officeEventTypeName: eventType.name,
    previousStartTime,
    startTime: plan.start,
    where: visitFacts(after.booking),
    timezone: company.timezone,
    quoteNumber: booking.quote?.quoteNumber || null,
    arrivalWindowMinutes: booking.mode === "visit" ? company.arrivalWindowMinutes : 0,
    manageUrl,
    // The language the page was rendered in — the quote's, else the company
    // default (visitView decides, so the letter and the page agree).
    language: movedLanguage,
    initiatedBy: "client",
    ...(invite && { attachments: [invite] }),
  }).catch((err) => console.error("[visit] reschedule emails failed:", err?.message));

  // And the text, when they booked with a phone: the new time and the same
  // link, in the page's language, behind the confirmation's gates
  // (lib/schedule/changeText.js). Their own move deserves the same receipt
  // an office move gets — "did it take?" is the question either way.
  const target = await bookingTextTarget(booking);
  await textClientOfChange({
    kind: "moved",
    company,
    phone: booking.clientPhone,
    language: movedLanguage,
    startTime: plan.start,
    previousStartTime,
    where: visitFacts(after.booking),
    service: movedView.eventTypeName,
    manageUrl,
    ref: target.ref,
    clientId: target.clientId,
  });

  return NextResponse.json({ ...visitView(after, now), rescheduled: true });
}
