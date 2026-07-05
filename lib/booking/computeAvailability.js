// lib/booking/computeAvailability.js
import { db } from "@/lib/db";
import { scheduleTimeToUtc } from "@/lib/booking/timezone";

const SLOT_INCREMENT_MINUTES = 15;

export async function computeAvailableSlots({ eventType, fromDate, toDate }) {
  const schedules = await db.availabilitySchedule.findMany({
    where: { userId: eventType.userId },
  });

  if (schedules.length === 0) return {};

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
    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

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
