// lib/schedule/entryNeighbours.js
//
// The day around a candidate time, loaded for lib/schedule/moveEntry.js.
//
// Every stop the assignee already has near the new time, from all three
// calendar sources — the same three lib/schedule/jobVisits.js merges for the
// calendar, and the same two computeAvailableSlots reads for the booking page
// (plus JobVisit, which a booking page never has to consider but an office
// moving crew work must). The entry being moved is excluded, or its own old
// slot would block every time overlapping it.
//
// Coordinates come from wherever each source keeps them: an Appointment and
// a Booking carry their own, a JobVisit happens at the job's geocoded site.
// A stop with no coordinates still brackets the day (it occupies time) but
// contributes no travel — `reachable` treats unknown as never blocking.

import { db } from "@/lib/db";
import { hasPoint } from "@/lib/booking/travel";
import { DEFAULT_STOP_MINUTES } from "@/lib/schedule/moveEntry";

function point(lat, lng) {
  const p = { lat: Number(lat), lng: Number(lng) };
  return hasPoint(p) ? p : null;
}

/**
 * @param {object} args
 * @param {string}  args.companyId
 * @param {string|null} args.assignedToId  nobody's day can conflict with an
 *                                         unassigned entry — returns []
 * @param {Date}    args.start       the candidate time
 * @param {object}  [args.exclude]   { appointmentId, visitId, bookingId }
 * @returns {Promise<Array<{ id, kind, startAt: Date, endAt: Date, point }>>}
 */
export async function assigneeStopsAround({ companyId, assignedToId, start, exclude = {} }) {
  if (!assignedToId) return [];

  // ±1 day in UTC around the candidate: a stop's "same day" is the crew's
  // local day, which the server cannot know without the zone, and a day
  // either side is cheap. bracketStops only ever looks at the nearest stop
  // on each side, so extra rows never change the verdict.
  const from = new Date(start.getTime() - 86_400_000);
  const to = new Date(start.getTime() + 86_400_000);

  const [appointments, bookings, visits] = await Promise.all([
    db.appointment.findMany({
      where: {
        companyId,
        assignedToId,
        status: { in: ["scheduled", "needs_supervisor"] },
        scheduledAt: { gte: from, lte: to },
        ...(exclude.appointmentId && { id: { not: exclude.appointmentId } }),
      },
      select: { id: true, scheduledAt: true, latitude: true, longitude: true, booking: { select: { id: true, endTime: true } } },
    }),
    db.booking.findMany({
      where: {
        eventType: { companyId, userId: assignedToId },
        status: "confirmed",
        // A booking that already became an appointment is counted once, as
        // the appointment above (whose row carries the booking's end time).
        appointmentId: null,
        startTime: { gte: from, lte: to },
        ...(exclude.bookingId && { id: { not: exclude.bookingId } }),
      },
      select: { id: true, startTime: true, endTime: true, latitude: true, longitude: true },
    }),
    db.jobVisit.findMany({
      where: {
        assignedToId,
        job: { companyId },
        status: { notIn: ["completed", "cancelled", "canceled"] },
        scheduledAt: { gte: from, lte: to },
        ...(exclude.visitId && { id: { not: exclude.visitId } }),
      },
      select: {
        id: true,
        scheduledAt: true,
        job: { select: { latitude: true, longitude: true, siteLatitude: true, siteLongitude: true } },
      },
    }),
  ]);

  const hour = DEFAULT_STOP_MINUTES * 60000;
  return [
    ...appointments.map((a) => ({
      id: a.id,
      kind: "appointment",
      startAt: a.scheduledAt,
      endAt: a.booking?.endTime || new Date(a.scheduledAt.getTime() + hour),
      point: point(a.latitude, a.longitude),
    })),
    ...bookings.map((b) => ({
      id: b.id,
      kind: "booking",
      startAt: b.startTime,
      endAt: b.endTime || new Date(b.startTime.getTime() + hour),
      point: point(b.latitude, b.longitude),
    })),
    ...visits.map((v) => ({
      id: v.id,
      kind: "visit",
      startAt: v.scheduledAt,
      endAt: new Date(v.scheduledAt.getTime() + hour),
      // The site's own coordinates first; the billing-address geocode is the
      // fallback lib/location/stamps.js measures from too.
      point: point(v.job?.siteLatitude ?? v.job?.latitude, v.job?.siteLongitude ?? v.job?.longitude),
    })),
  ];
}
