// lib/demo/hosts.js
//
// Loads the people who run FieldQuo product demos — their stated hours and
// what is already on their calendars — and hands them to the pure assembler in
// lib/demo/slots.js.
//
// This file exists so the queries live in ONE place rather than two: if
// /api/demo/slots and /api/demo/book each grew their own, they would eventually
// disagree, and the symptom is a picker that offers a time the booking route
// then refuses. All the reasoning about who a booking blocks is in
// assembleHosts, where it can be tested without a database.
import { db } from "@/lib/db";
import { demoRange, assembleHosts } from "@/lib/demo/slots";

/**
 * @returns {Promise<Array<{ adminId, email, windows, busy, load }>>}
 *          Empty when nobody has stated any availability. Callers must treat
 *          that as "no slots", never as a reason to fall back to a default
 *          grid — see the header of lib/demo/slots.js.
 */
export async function loadDemoHosts(now = new Date()) {
  const { from, to } = demoRange(now);

  const [windows, bookings] = await Promise.all([
    // Only ACTIVE admins. Deactivating someone on the platform team page has to
    // take them off the sales calendar too, or the hero keeps selling times
    // belonging to a person who can no longer sign in.
    db.demoHostAvailability.findMany({
      where: { admin: { active: true } },
      select: {
        adminId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        timezone: true,
        admin: { select: { email: true } },
      },
    }),
    db.demoBooking.findMany({
      where: { status: "booked", scheduledAt: { gte: from, lt: to } },
      select: { hostAdminId: true, scheduledAt: true },
    }),
  ]);

  return assembleHosts(
    windows.map((w) => ({ ...w, email: w.admin?.email ?? null })),
    bookings,
  );
}
