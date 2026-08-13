// lib/demo/slots.js
//
// The bookable slots for a FieldQuo product demo, derived from the hours the
// people who run demos actually stated — DemoHostAvailability rows, one set per
// PlatformAdmin — and from what is already on their calendars.
//
// ── What this file used to be ──────────────────────────────────────────────
//
// Three constants: 6:00–10:00pm Eastern, eight slots, every day for fourteen
// days. Weekends, Christmas, the lot, with no connection to any person's
// calendar; and because the only conflict check was a global unique on
// DemoBooking.scheduledAt, the whole platform could run exactly one demo per
// half hour however many staff were free. The hours a prospect saw were not a
// statement anybody had made. Now they are rows somebody can edit, in the
// platform console under Demo availability.
//
// ── No hosts means no slots ────────────────────────────────────────────────
//
// If nobody has stated any availability, this returns nothing and the marketing
// hero says "No open times right now — email hello@fieldquo.com". It does not
// fall back to the old grid. Publishing invented hours to a stranger who then
// books against them is worse than showing an honest empty state.
//
// Everything here is PURE — hosts and their bookings are loaded by
// lib/demo/hosts.js and passed in — so the whole thing is testable against
// hostile input without a database. See scripts/check-demo-slots.mjs.
import { slotGrid } from "@/lib/booking/slotGrid";
import { zonedWallClockToUtc, zonedYmd } from "@/lib/booking/timezone";

export const DEMO_TZ = "America/Toronto";
export const SLOT_MINUTES = 30;
export const DAYS_AHEAD = 14;
export const LEAD_MS = 2 * 60 * 60 * 1000; // nothing bookable within 2 hours

/**
 * The window the picker covers: from now to the end of the 14th day after
 * today, Eastern. Eastern rather than the viewer's zone because that is the
 * zone the slots are labelled in and the calendar invite is written in — a day
 * boundary that moved with the visitor would make the last day of the list
 * appear and disappear depending on who was looking.
 */
export function demoRange(now = new Date()) {
  const today = zonedYmd(now, DEMO_TZ);
  // Anchor on local NOON before adding days: adding 24h to a local midnight
  // slips into the previous or next calendar date across a DST transition,
  // which is the bug the original file's comment warned about and this keeps.
  const noon = zonedWallClockToUtc({ ...today, hours: 12 }, DEMO_TZ).getTime();
  const dayAfterLast = zonedYmd(new Date(noon + (DAYS_AHEAD + 1) * 86400000), DEMO_TZ);
  return {
    from: new Date(now.getTime()),
    // Exclusive: midnight Eastern starting the day after the last offered one,
    // so the final day is whole.
    to: zonedWallClockToUtc({ ...dayAfterLast, hours: 0 }, DEMO_TZ),
  };
}

/**
 * One host's own free slots.
 *
 * @param {object} host { adminId, windows: [{dayOfWeek,startTime,endTime,timezone}],
 *                        busy: [{start,end}], load: number }
 */
export function hostGrid(host, now = new Date()) {
  const { from, to } = demoRange(now);
  return slotGrid({
    windows: host?.windows || [],
    from,
    to,
    slotMinutes: SLOT_MINUTES,
    leadMs: LEAD_MS,
    now,
    busy: host?.busy || [],
    timezone: DEMO_TZ,
  });
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: DEMO_TZ, weekday: "short", month: "short", day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: DEMO_TZ, hour: "numeric", minute: "2-digit", hour12: true,
});

/**
 * The union of every host's free slots, grouped and labelled for the picker.
 *
 * A union, not a per-host list: the prospect is booking "a demo", not "a demo
 * with Priya". Two hosts free at 7pm is one 7pm chip that two people can take
 * in turn — which is the capacity the old global unique constraint threw away.
 *
 * Shape is `{ day, slots: [{ iso, label }] }`, which is what
 * app/components/marketing/DemoBooking.js renders.
 */
export function availableSlotsByDay(hosts = [], now = new Date()) {
  const byIso = new Set();
  for (const host of hosts) {
    for (const group of hostGrid(host, now)) {
      for (const start of group.starts) byIso.add(start.getTime());
    }
  }

  const days = new Map();
  for (const t of [...byIso].sort((a, b) => a - b)) {
    const start = new Date(t);
    const day = dayFmt.format(start);
    if (!days.has(day)) days.set(day, { day, slots: [] });
    days.get(day).slots.push({ iso: start.toISOString(), label: timeFmt.format(start) });
  }
  return [...days.values()];
}

/**
 * The hosts genuinely free at `iso`, re-derived from their windows and their
 * calendars. The booking route's guard against a hand-posted timestamp: an
 * empty array means nobody offers that time, whatever the client sent.
 */
export function hostsFreeAt(hosts = [], iso, now = new Date()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return [];
  return hosts.filter((host) =>
    hostGrid(host, now).some((g) => g.starts.some((s) => s.getTime() === t)),
  );
}

/**
 * Availability rows + bookings → the host objects everything above consumes.
 *
 * Pure, and deliberately not inside lib/demo/hosts.js: that file imports the
 * Prisma client, and this rule — who a booking blocks — is the part worth
 * testing without a database.
 *
 * @param {Array} windows  DemoHostAvailability rows, each carrying adminId and
 *                         optionally an `email`.
 * @param {Array} bookings DemoBooking rows: { hostAdminId, scheduledAt }.
 */
export function assembleHosts(windows = [], bookings = []) {
  if (!Array.isArray(windows) || windows.length === 0) return [];

  const busyFor = new Map();
  // A booking with no host predates DemoHostAvailability, or its host account
  // was removed. We know the time is committed but not to whom, so it blocks
  // EVERY host. Over-blocking costs one slot; under-blocking books two
  // prospects into the same half hour, and only one of them finds out.
  const busyForEveryone = [];

  for (const b of Array.isArray(bookings) ? bookings : []) {
    const start = b?.scheduledAt instanceof Date ? b.scheduledAt : new Date(b?.scheduledAt);
    if (!Number.isFinite(start.getTime())) continue;
    const range = { start, end: new Date(start.getTime() + SLOT_MINUTES * 60000) };
    if (!b.hostAdminId) {
      busyForEveryone.push(range);
      continue;
    }
    if (!busyFor.has(b.hostAdminId)) busyFor.set(b.hostAdminId, []);
    busyFor.get(b.hostAdminId).push(range);
  }

  const hosts = new Map();
  for (const w of windows) {
    if (!hosts.has(w.adminId)) {
      hosts.set(w.adminId, {
        adminId: w.adminId,
        email: w.email ?? null,
        windows: [],
        busy: [...busyForEveryone, ...(busyFor.get(w.adminId) || [])],
        // Own bookings only. The shared block lands on everyone equally, so
        // counting it wouldn't change the order — but it would make "load" mean
        // something other than what it says.
        load: (busyFor.get(w.adminId) || []).length,
      });
    }
    hosts.get(w.adminId).windows.push({
      dayOfWeek: w.dayOfWeek,
      startTime: w.startTime,
      endTime: w.endTime,
      timezone: w.timezone,
    });
  }

  return [...hosts.values()];
}

/**
 * Which of several free hosts takes the booking.
 *
 * Least-loaded first — fewest demos already booked in the visible window — so
 * a second host actually shares the work instead of only catching overflow.
 * Ties break on adminId ascending, which is arbitrary but STABLE: the same
 * inputs always pick the same person, so a retried request can't land the
 * booking on someone else's calendar.
 */
export function pickHost(freeHosts = []) {
  return [...freeHosts].sort(
    (a, b) => (a.load ?? 0) - (b.load ?? 0) || String(a.adminId).localeCompare(String(b.adminId)),
  )[0] ?? null;
}
