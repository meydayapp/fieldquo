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
//  5. The drive. While the calendar is being SHOWN: the straight-line
//     distance × 1.35, at 32 km/h (lib/booking/travel.js estimateTravel) —
//     offline, free, and deliberately slow, because offering a time nobody
//     can make is worse than losing one. When a time is being BOOKED: Google's
//     real driving time (Distance Matrix) for the two legs around that one
//     time, in lib/booking/verifyTravel.js — and if Google says the estimator
//     can't make it, the booking is refused in plain words with the next time
//     that passes the same check. Never a silent double-booking. (Since
//     2026-10-03; it was Google for every distinct address on every calendar
//     load before — see "Why the calendar no longer asks Google" below.)
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
import { estimateTravel, reachable, hasPoint, slotNeighbours } from "@/lib/booking/travel";
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
 * ══ Why the calendar no longer asks Google (owner-approved, 2026-10-03) ════
 *
 * This used to call Distance Matrix once per distinct address on the day,
 * on every availability request. The booking calendar asks for a whole month
 * at a time and asks again on every month flip and every address edit, and a
 * stranger browsing three months and two addresses costs a few dozen
 * elements before booking nothing. At Google's US$5 per 1,000 elements the
 * heavy case — a busy estimator, a few hundred calendar loads a day — ran to
 * roughly US$105 a month for numbers nobody booked against.
 *
 * Now the calendar uses the offline estimate (straight line × 1.35 road
 * factor at 32 km/h — free, and deliberately slow, so it hides a borderline
 * time rather than offering one that can't be made), and Google is asked
 * ONLY when a time is actually being booked: two elements (the leg in and the
 * leg out) for that one time, cached, in lib/booking/verifyTravel.js. A month
 * of browsing costs nothing; a booking costs about one cent. If Google's real
 * drive disagrees with the estimate and the time can't be made, the booker is
 * told so and offered the next time that passes — never booked into a slot
 * the estimator can't reach.
 *
 * Still computed per DISTINCT location, so the hot loop below is a lookup.
 * Driving time is not symmetric in general, but the estimate is: one figure
 * serves both directions.
 */
function travelIndex(busyRanges, destination) {
  const index = new Map();
  if (!destination) return index;
  for (const b of busyRanges) {
    if (!b.point) continue;
    const k = `${b.point.lat.toFixed(4)},${b.point.lng.toFixed(4)}`;
    if (!index.has(k)) index.set(k, estimateTravel(b.point, destination)?.minutes ?? null);
    b.travel = index.get(k);
  }
  return index;
}

/**
 * Everything that occupies this person's calendar around [fromDate, toDate],
 * chronological: confirmed bookings, scheduled appointments (an hour each —
 * DEFAULT_STOP_MINUTES) and their Google busy time (no place). Shared by the
 * calendar below and by the booking-time Google check in verifyTravel.js, so
 * the two can never disagree about what the neighbours of a time are.
 *
 * `fromDate`/`toDate` are widened by the caller — see the note in
 * computeAvailableSlots on why busy time is read a day wider than the slots.
 */
export async function loadBusyRanges({ eventType, busyFrom, busyTo, exclude = null }) {
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
  return busyRanges;
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

  const busyRanges = await loadBusyRanges({ eventType, busyFrom, busyTo, exclude });
  travelIndex(busyRanges, destination);

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
          const { before, after } = slotNeighbours(busyRanges, bufferedStart, bufferedEnd);

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
