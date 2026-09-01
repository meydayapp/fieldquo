// lib/migrations/hosts.js
//
// When a superadmin is free to take a migration consultation.
//
// ── Reuse, not a parallel calendar ──────────────────────────────────────────
//
// AGENTS.md asked this feature to read app/api/booking and the availability
// system before building a second one. There already IS a "when is FieldQuo's
// own staff free to talk to someone" calendar — DemoHostAvailability, plus the
// pure slot math in lib/demo/slots.js — built for product demos. It fits here
// almost exactly: same people, same instinct ("when am I free for a call"),
// same 30-minute grid.
//
// What does NOT fit is DemoBooking itself: it is shaped for an anonymous,
// pre-signup prospect (free-text name/email, no companyId, no auth, a status
// that is deliberately "a light internal sales record"). A migration
// consultation belongs to an authenticated Company via a MigrationRequest, and
// forcing it through DemoBooking would mean either inventing a fake prospect
// record per company or losing the link back to the request entirely. So
// scheduling data lives on MigrationRequest (hostAdminId, scheduledAt) and
// this file is the query layer for it — the sibling of lib/demo/hosts.js, not
// a copy of it.
//
// The one thing that MUST be shared rather than duplicated is busy time: a
// superadmin who is mid-demo cannot also take a migration call, and the
// reverse. So loadMigrationHosts() below folds bookings from BOTH DemoBooking
// and MigrationRequest into the same assembleHosts() call that
// lib/demo/hosts.js uses — the pure assembler already accepts a flat list of
// `{ hostAdminId, scheduledAt }` rows and does not care which table they came
// from, so no fork of that logic was needed, only a wider query.
import { db } from "@/lib/db";
import { demoRange, assembleHosts } from "@/lib/demo/slots";

/**
 * @returns {Promise<Array<{ adminId, email, windows, busy, load }>>}
 *          Empty when nobody has stated any availability — callers must treat
 *          that as "no slots" and never fall back to an invented grid, same
 *          rule as lib/demo/hosts.js.
 */
export async function loadMigrationHosts(now = new Date()) {
  const { from, to } = demoRange(now);

  const [windows, demoBookings, migrationBookings] = await Promise.all([
    // Only ACTIVE admins — deactivating someone must take them off every
    // calendar that reads this table, not just the demo one.
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
    // Any migration consultation still on the calendar — i.e. not yet
    // cancelled. `hostAdminId` is set only once a slot is actually booked
    // (see app/api/migrations/[id]/schedule/route.js), so a bare `requested`
    // row with no consultation booked contributes nothing here.
    db.migrationRequest.findMany({
      where: {
        hostAdminId: { not: null },
        scheduledAt: { gte: from, lt: to },
        status: { notIn: ["cancelled", "declined"] },
      },
      select: { hostAdminId: true, scheduledAt: true },
    }),
  ]);

  return assembleHosts(
    windows.map((w) => ({ ...w, email: w.admin?.email ?? null })),
    [...demoBookings, ...migrationBookings],
  );
}
