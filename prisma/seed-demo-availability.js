// prisma/seed-demo-availability.js
//
//   npm run seed:demo-availability
//
// Writes the hours FieldQuo's demo calendar used to hard-code — 6:00–10:00 PM
// America/Toronto, seven days a week — as REAL DemoHostAvailability rows for
// every active superadmin.
//
// ── Why seed something that used to be a constant ──────────────────────────
//
// So the change is invisible to a prospect on day one and visible to whoever
// owns the calendar from then on. Before this, lib/demo/slots.js said
// START_HOUR = 18, SLOTS_PER_DAY = 8, every day for a fortnight, with no
// connection to any person's diary — a promise made on a superadmin's behalf
// that they had never made. Same hours, now stated by somebody, editable in the
// console under Demo availability.
//
// ── Why superadmins, and why 7 days ────────────────────────────────────────
//
// Superadmins because they are the accounts the booking route already emailed
// about every demo; they were, in practice, the people running them. Seven days
// because that is genuinely what the old grid published — seeding Mon–Fri here
// would quietly REMOVE weekend availability under cover of a refactor, which is
// a product decision, not a migration. Open the console and clear Saturday if
// that's the intent.
//
// Idempotent: matched on (adminId, dayOfWeek, startTime), so re-running fixes
// the end time and timezone rather than duplicating the week. It never deletes
// windows somebody added by hand.
import "dotenv/config";
import { db } from "../lib/db.js";

// Kept as literals rather than imported from lib/demo/slots.js: this runs under
// plain node, where the "@/" alias that file's own imports use doesn't resolve.
const START_TIME = "18:00";
const END_TIME = "22:00";
const TIMEZONE = "America/Toronto";
const DAYS = [0, 1, 2, 3, 4, 5, 6];

async function main() {
  const admins = await db.platformAdmin.findMany({
    where: { role: "superadmin", active: true },
    select: { id: true, email: true },
  });

  if (admins.length === 0) {
    // Loud, not silent. An empty run here means the marketing hero offers
    // nothing, which is correct behaviour but a surprising thing to discover
    // from a prospect's email.
    console.warn(
      "⚠️  No active superadmin found. Nothing seeded — the demo booker will " +
        "offer zero slots until somebody sets hours in /platform/demo-availability. " +
        "Create an admin with scripts/seed-platform-admin.mjs first.",
    );
    return;
  }

  let written = 0;
  for (const admin of admins) {
    for (const dayOfWeek of DAYS) {
      await db.demoHostAvailability.upsert({
        where: {
          adminId_dayOfWeek_startTime: { adminId: admin.id, dayOfWeek, startTime: START_TIME },
        },
        update: { endTime: END_TIME, timezone: TIMEZONE },
        create: {
          adminId: admin.id,
          dayOfWeek,
          startTime: START_TIME,
          endTime: END_TIME,
          timezone: TIMEZONE,
        },
      });
      written += 1;
    }
    console.log(`  ✓ ${admin.email} — ${START_TIME}–${END_TIME} ${TIMEZONE}, all 7 days`);
  }

  console.log(
    `Seeded ${written} demo availability windows for ${admins.length} superadmin(s).`,
  );
}

main()
  .catch((err) => {
    console.error("Demo availability seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
