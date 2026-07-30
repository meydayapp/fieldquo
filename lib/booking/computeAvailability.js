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
import { db } from "@/lib/db";
import { scheduleTimeToUtc } from "@/lib/booking/timezone";

const SLOT_INCREMENT_MINUTES = 15;

/** UTC midnight key for a date, matching how leave dates are stored. */
function dayKey(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export async function computeAvailableSlots({ eventType, fromDate, toDate }) {
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
      },
      select: { startTime: true, endTime: true },
    }),
    db.appointment.findMany({
      where: {
        assignedToId: eventType.userId,
        status: { in: ["scheduled", "needs_supervisor"] },
        scheduledAt: { gte: fromDate, lte: toDate },
      },
      select: { scheduledAt: true },
    }),
  ]);

  const busyRanges = [
    ...existingBookings.map((b) => ({ start: b.startTime, end: b.endTime })),
    ...existingAppointments.map((a) => ({
      start: a.scheduledAt,
      end: new Date(a.scheduledAt.getTime() + 60 * 60000),
    })),
  ];

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

        if (!overlaps && slotStart > new Date()) {
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
