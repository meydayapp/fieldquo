// lib/booking/computeAvailability.js
//
// ── Approved leave removes the whole day ────────────────────────────────────
//
// Someone with approved time off must not be offered to a homeowner. Their
// weekly availability still says Tuesday 9–5 — that's their normal week, not a
// promise about a specific Tuesday — so leave is applied on top as a day-level
// block.
//
// A HALF day blocks the day too. The request records half a day but not WHICH
// half, and inventing "mornings" would put a stranger in a driveway waiting for
// someone who isn't coming. Over-blocking one afternoon costs a bookable slot;
// under-blocking costs a missed appointment, so the day goes.
//
// ── Travel time removes slots you can't physically reach ────────────────────
//
// When the visitor has given an address, a slot is only offered if the
// estimator can get there from wherever they were before, and get to whatever
// is after. 5:00 in the east end and 5:30 across town is not availability, it's
// a homeowner in a driveway at 5:45.
//
// This only ever engages with real coordinates on BOTH ends. No address, a
// failed geocode, an appointment with no location — all resolve to "unknown",
// and unknown never hides a slot. The alternative is a contractor asking why
// nobody can book them at 2pm with nothing on screen to explain it.
import { db } from "@/lib/db";
import { scheduleTimeToUtc } from "@/lib/booking/timezone";
import { travelMinutes, reachable, hasPoint } from "@/lib/booking/travel";
import { serverMapsKey } from "@/lib/measure/roofMeasurement";

const SLOT_INCREMENT_MINUTES = 15;

/** Prisma Decimal columns arrive as objects; Number() on them is exact enough here. */
function point(row) {
  const p = { lat: Number(row?.latitude), lng: Number(row?.longitude) };
  return hasPoint(p) ? p : null;
}

/**
 * Travel time to and from the destination for each place the day already has.
 *
 * Computed per DISTINCT location rather than per slot. A day with four
 * appointments at three addresses costs three lookups, not one per 15-minute
 * candidate — which would be several hundred, and Distance Matrix is billed
 * per element.
 *
 * Driving time is not symmetric in general (one-way systems, ramps), but the
 * difference is small next to the buffer this feeds, and halving the call count
 * matters more. Noted here rather than silently assumed.
 */
async function travelIndex(busyRanges, destination) {
  const index = new Map();
  if (!destination) return index;

  const key = serverMapsKey();
  const seen = new Map();
  for (const b of busyRanges) {
    if (!b.point) continue;
    const k = `${b.point.lat.toFixed(4)},${b.point.lng.toFixed(4)}`;
    if (!seen.has(k)) seen.set(k, b.point);
  }

  await Promise.all(
    [...seen].map(async ([k, p]) => {
      const t = await travelMinutes(p, destination, { key });
      if (t) index.set(k, t.minutes);
    }),
  );

  // Re-key onto the ranges themselves so the hot loop is a plain lookup.
  for (const b of busyRanges) {
    if (!b.point) continue;
    b.travel = index.get(`${b.point.lat.toFixed(4)},${b.point.lng.toFixed(4)}`) ?? null;
  }
  return index;
}

/** UTC midnight key for a date, matching how leave dates are stored. */
function dayKey(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * @param {object|null} destination  { lat, lng } where the visitor wants to be
 *                                   seen. Omit for phone/video, or when they
 *                                   haven't given an address yet — the result
 *                                   is then identical to before this existed.
 * @param {number}      travelBuffer company padding, minutes
 * @param {object|null} exclude      { bookingId, appointmentId } to ignore.
 *
 * `exclude` exists for RESCHEDULING. A client moving their own visit is asking
 * which times are free if theirs weren't there — without this their current
 * slot (and the appointment it created) blocks every overlapping candidate, so
 * "move it half an hour later" comes back unavailable with nothing on screen to
 * explain why. Null for every other caller, whose answer is unchanged.
 */
export async function computeAvailableSlots({
  eventType,
  fromDate,
  toDate,
  destination = null,
  travelBuffer = 0,
  exclude = null,
}) {
  const schedules = await db.availabilitySchedule.findMany({
    where: { userId: eventType.userId },
  });

  if (schedules.length === 0) return {};

  // Days this person is on approved leave. Best-effort: a leave lookup failing
  // must not take the whole booking page down, but it IS logged, because the
  // silent version of this bug books someone who's away.
  const leaveDays = new Set();
  try {
    const requests = await db.leaveRequest.findMany({
      where: {
        status: "approved",
        worker: { userId: eventType.userId },
        startDate: { lte: toDate },
        endDate: { gte: fromDate },
      },
      select: { startDate: true, endDate: true },
    });
    for (const r of requests) {
      for (let t = dayKey(r.startDate); t <= dayKey(r.endDate); t += 86400000) {
        leaveDays.add(t);
      }
    }
  } catch (err) {
    console.error("[availability] leave lookup failed:", err?.message);
  }

  const [existingBookings, existingAppointments] = await Promise.all([
    db.booking.findMany({
      where: {
        eventType: { userId: eventType.userId },
        status: "confirmed",
        startTime: { gte: fromDate, lte: toDate },
        ...(exclude?.bookingId && { id: { not: exclude.bookingId } }),
      },
      select: { startTime: true, endTime: true, latitude: true, longitude: true },
    }),
    db.appointment.findMany({
      where: {
        assignedToId: eventType.userId,
        status: { in: ["scheduled", "needs_supervisor"] },
        scheduledAt: { gte: fromDate, lte: toDate },
        ...(exclude?.appointmentId && { id: { not: exclude.appointmentId } }),
      },
      select: { scheduledAt: true, latitude: true, longitude: true },
    }),
  ]);

  const busyRanges = [
    ...existingBookings.map((b) => ({
      start: b.startTime,
      end: b.endTime,
      point: point(b),
    })),
    ...existingAppointments.map((a) => ({
      start: a.scheduledAt,
      end: new Date(a.scheduledAt.getTime() + 60 * 60000),
      point: point(a),
    })),
  ];

  // Chronological, so "what came before this slot" is the last range that ends
  // at or before it — a scan, not a sort per candidate.
  busyRanges.sort((x, y) => x.start - y.start);
  await travelIndex(busyRanges, destination);

  const slotsByDate = {};
  const cursor = new Date(fromDate);

  while (cursor <= toDate) {
    const dayOfWeek = cursor.getUTCDay();
    const onLeave = leaveDays.has(dayKey(cursor));
    const daySchedules = onLeave
      ? []
      : schedules.filter((s) => s.dayOfWeek === dayOfWeek);

    for (const schedule of daySchedules) {
      // These are now real UTC instants, correctly anchored to the worker's own timezone —
      // not the server's.
      const dayStart = scheduleTimeToUtc(
        cursor,
        schedule.startTime,
        schedule.timezone,
      );
      const dayEnd = scheduleTimeToUtc(
        cursor,
        schedule.endTime,
        schedule.timezone,
      );

      let slotStart = new Date(dayStart);

      while (
        slotStart.getTime() + eventType.durationMinutes * 60000 <=
        dayEnd.getTime()
      ) {
        const slotEnd = new Date(
          slotStart.getTime() + eventType.durationMinutes * 60000,
        );
        const bufferedStart = new Date(
          slotStart.getTime() - eventType.bufferBefore * 60000,
        );
        const bufferedEnd = new Date(
          slotEnd.getTime() + eventType.bufferAfter * 60000,
        );

        const overlaps = busyRanges.some(
          (b) => bufferedStart < b.end && bufferedEnd > b.start,
        );

        // ── Can they get here, and get to the next one? ────────────────────
        //
        // Both directions. Checking only the inbound leg offers a slot that
        // strands the estimator: they arrive on time and then can't make the
        // job that was already on the books after it — which is worse, because
        // that customer was promised first.
        let makeable = true;
        if (destination && !overlaps) {
          const before = busyRanges.filter((b) => b.end <= bufferedStart).pop();
          const after = busyRanges.find((b) => b.start >= bufferedEnd);

          if (before) {
            makeable = reachable({
              previousEnd: before.end,
              slotStart: bufferedStart,
              travel: before.travel,
              buffer: travelBuffer,
            }).ok;
          }
          if (makeable && after) {
            makeable = reachable({
              previousEnd: bufferedEnd,
              slotStart: after.start,
              travel: after.travel,
              buffer: travelBuffer,
            }).ok;
          }
        }

        if (!overlaps && makeable && slotStart > new Date()) {
          const dateKey = cursor.toISOString().split("T")[0];
          if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
          slotsByDate[dateKey].push(slotStart.toISOString());
        }

        slotStart = new Date(
          slotStart.getTime() + SLOT_INCREMENT_MINUTES * 60000,
        );
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slotsByDate;
}
