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
//
// ══ THE DISTANCE RULE, in plain words (the owner asked, 2026-09-24) ════════
//
// Also in docs/BOOKING.md. If this changes, change both.
//
//  1. Candidate times. Every 15 minutes inside the person's weekly hours, a
//     slot as long as the appointment (plus the event's own before/after
//     buffers). Anything that overlaps a confirmed booking, a scheduled
//     appointment (counted as one hour — DEFAULT_STOP_MINUTES), their Google
//     busy time, or a day of approved leave is gone. Distance plays no part
//     in this step.
//
//  2. Distance only REMOVES times; it never ranks or prefers them. There is
//     no "cluster my day" logic and no "closest first" ordering: what is left
//     is listed in time order, earliest first. A time next door to another
//     visit and a time across town are offered the same way, as long as the
//     estimator can make both.
//
//  3. For each remaining time, only the two NEIGHBOURS matter: the visit just
//     before it and the visit just after it (either may be on the previous or
//     next day). Visits further away are not looked at — the day around them
//     was already planned, and the new visit only has to fit between two.
//
//  4. The test, both directions:
//        gap before  ≥ drive from the previous visit + travel buffer
//        gap after   ≥ drive to the next visit      + travel buffer
//     "Travel buffer" is Settings → Booking page → "Extra time between jobs"
//     (travelBufferMinutes: parking, unloading; 0 by default). A time failing
//     either leg is not offered. There is no fixed km threshold — a 10-minute
//     drive needs a 10-minute gap, a 3-hour drive needs 3 hours.
//
//  5. The drive. Google's driving time (Distance Matrix) from the other
//     visit's address to the new one, looked up once per distinct address per
//     request and used for both directions. If Google can't answer, the
//     straight-line distance × 1.35, at 32 km/h (lib/booking/travel.js) — a
//     deliberately slow guess, because offering a time nobody can make is
//     worse than losing one.
//
//  6. No other visits that day → nothing to drive from or to → every free
//     time is offered. Same when the neighbour visit has no coordinates, when
//     the neighbour is Google busy time (it carries no place), when the
//     visitor's address can't be found on the map, or when it's a phone or
//     video appointment: unknown never hides a time.
//
//  7. When it runs at all: an on-site visit, with an address typed or picked
//     on the booking page (the SERVER geocodes the text — a picked suggestion
//     and a typed address are treated identically), and Settings → Booking
//     page → "Don't offer times you can't drive to" on (travelCheckEnabled,
//     on by default). The visit-reschedule page uses the
//     booking's stored point. The phone receptionist and the AI employee ask
//     without an address, so their times are never distance-filtered.
//
//  The service area (lib/company/serviceArea.js) is a separate question —
//  "do we go there at all?" — and it never removes a time; it only adds a
//  line to the page and a badge on the booking.
import { db } from "@/lib/db";
import { scheduleTimeToUtc } from "@/lib/booking/timezone";
import { travelMinutes, reachable, hasPoint } from "@/lib/booking/travel";
import { serverMapsKey } from "@/lib/measure/roofMeasurement";
import { DEFAULT_STOP_MINUTES } from "@/lib/schedule/moveEntry";
import { googleBusyRanges } from "@/lib/calendar/googleBusy";

const SLOT_INCREMENT_MINUTES = 15;
const DAY_MS = 86400000;

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

  // ── Busy time is read a day wider than the slots on both sides ─────────
  //
  // The booking page asks "from=2026-09-25&to=2026-09-30", which arrives as
  // midnight UTC at the START of the 30th. The loop below still slots the
  // whole of the 30th (cursor <= toDate), but busy time used to be read only
  // up to that midnight — so on the last day of every range, which on the
  // booking calendar is the last day of every month, existing visits were
  // invisible: their times were offered as free, and no drive was checked
  // against them. Reproduced 2026-09-25 on a demo company: a booked 4pm
  // visit showed 4:00 as open whenever the 30th was the end of the range.
  //
  // +2 days on the end covers the rest of that last day in any timezone
  // (a Toronto 4–8pm shift runs to 00:00 UTC the NEXT day); −1 on the start
  // lets the first slot of the range see the visit it would drive from.
  // Reading extra busy time can only ever remove or correctly leg a slot,
  // never add one.
  const busyFrom = new Date(fromDate.getTime() - DAY_MS);
  const busyTo = new Date(toDate.getTime() + 2 * DAY_MS);

  const [existingBookings, existingAppointments] = await Promise.all([
    db.booking.findMany({
      where: {
        eventType: { userId: eventType.userId },
        status: "confirmed",
        startTime: { gte: busyFrom, lte: busyTo },
        ...(exclude?.bookingId && { id: { not: exclude.bookingId } }),
      },
      select: { startTime: true, endTime: true, latitude: true, longitude: true },
    }),
    db.appointment.findMany({
      where: {
        assignedToId: eventType.userId,
        status: { in: ["scheduled", "needs_supervisor"] },
        scheduledAt: { gte: busyFrom, lte: busyTo },
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
      // An Appointment has no duration column. The same assumed hour the
      // office's own move check uses — one constant, so the two never disagree
      // about how long a stop blocks the day.
      end: new Date(a.scheduledAt.getTime() + DEFAULT_STOP_MINUTES * 60000),
      point: point(a),
    })),
  ];

  // ── The member's own Google Calendar, as opaque busy time ─────────────
  //
  // A connected member with "use my busy time" on has their personal events
  // block slots here exactly as an appointment does — and only here, so the
  // booking page, the voice receptionist, the AI employee and the office's
  // move check all refuse the same slot for the same reason. The ranges
  // carry no title and no point: freebusy.query never returns one, and a
  // personal event is nowhere the van goes, so travel filtering reads it
  // as "unknown" and never as a leg. A Google failure answers [] and is
  // stamped on the connection row (lib/calendar/googleBusy.js).
  const googleBusy = await googleBusyRanges({
    userId: eventType.userId,
    companyId: eventType.companyId || null,
    from: busyFrom,
    to: busyTo,
  });
  for (const b of googleBusy) busyRanges.push({ start: b.start, end: b.end, point: null });

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
