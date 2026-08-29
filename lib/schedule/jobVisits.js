// lib/schedule/jobVisits.js
//
// Job visits, shaped like calendar entries.
//
// ── The failure this closes ────────────────────────────────────────────────
//
// Scheduling a visit on a job set the job's status to "scheduled" and put
// nothing on the Calendar. /api/appointments reads the Appointment table;
// visits live in JobVisit; nothing joined them. So a manager scheduled crew
// work for Tuesday, opened the Calendar — the one place you go to ask "what is
// happening this week" — and saw an empty week. The dashboard's "Upcoming
// visits" tile read 0 while the job itself said `visits: 1`.
//
// Two dashboard tiles were therefore permanently wrong for any company that
// schedules through jobs, which is the normal way to use the product.
//
// ── Why union at read time rather than writing an Appointment ──────────────
//
// The obvious alternative is to create a backing Appointment whenever a visit
// is scheduled. That doubles the row, and then the two can disagree: reschedule
// the visit and the Appointment is stale, delete one and the other is orphaned.
// A calendar showing a visit that no longer exists is worse than one missing it.
//
// Reading from both keeps one row per real thing. The cost is that every
// consumer must handle two shapes, so they are normalised HERE, once, and
// carry `kind` so a UI can tell them apart — a visit is not editable as an
// appointment and must not be offered as one.
//
// ── Three sources now, not two ─────────────────────────────────────────────
//
// Booking joined them for the same reason JobVisit did: a confirmed booking
// whose Appointment was never created is a real visit that the calendar cannot
// see. The same rule applies to all three — one row per real thing, `kind`
// carried so nothing offers an editor that would 404 on the id.

/** Fields a JobVisit needs loaded for toCalendarEntry to work. */
export const VISIT_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  job: {
    select: {
      id: true,
      title: true,
      client: { select: { id: true, name: true, address: true } },
    },
  },
};

/**
 * One JobVisit as a calendar entry.
 *
 * `kind: "visit"` is load-bearing: it is how a screen knows this row links to
 * a job rather than to an appointment editor, and it is why the ids are
 * deliberately NOT made to look interchangeable.
 */
export function toCalendarEntry(visit) {
  if (!visit?.id) return null;
  return {
    kind: "visit",
    id: visit.id,
    jobId: visit.jobId ?? visit.job?.id ?? null,
    scheduledAt: visit.scheduledAt,
    status: visit.status || "scheduled",
    notes: visit.notes || null,
    title: visit.job?.title || null,
    client: visit.job?.client || null,
    // A visit has no location column of its own — it happens at the client's
    // address. Null when the client has none: an empty address is better than
    // an invented one on a screen someone drives from.
    location: visit.job?.client?.address || null,
    assignedTo: visit.assignedTo || null,
    // The Calendar filters by person on assignedToId, not on assignedTo.id —
    // without this a visit disappears the moment anyone picks a name from the
    // filter, which is a worse bug than not showing it at all.
    assignedToId: visit.assignedToId ?? visit.assignedTo?.id ?? null,
    // Fields the Calendar reads off appointments. Stated explicitly as absent
    // rather than left undefined: a visit genuinely has no booking and no
    // supervisor flag, and the travel-leg code must see null coordinates, not
    // a missing key it might treat as "not loaded yet".
    booking: null,
    requiresSupervisor: false,
    latitude: null,
    longitude: null,
  };
}

/**
 * A client-made Booking as a calendar entry.
 *
 * ── Why this is here at all ────────────────────────────────────────────────
 *
 * A confirmed booking is supposed to become an Appointment, and when it does
 * it reaches the calendar as one. When it does not — the link is nullable, and
 * rows predating it have none — the visit exists, the client has had a
 * confirmation email, and the calendar shows an empty morning. Somebody is
 * expected at a house and nobody in the company can see it.
 *
 * So bookings are read as a THIRD source, and the caller excludes any booking
 * that already has an appointmentId. Exactly one row per real visit either
 * way, which means this stays correct whether or not the booking→appointment
 * link is working — it is a floor under that mechanism, not a second copy of
 * it.
 *
 * A booking has no Client row (a stranger booked it; there may be no client on
 * file), so `client` is synthesised from the name the booking carries and
 * marked `synthetic` — a screen must not offer to open a client page for an id
 * that does not exist.
 */
export function bookingToCalendarEntry(booking) {
  if (!booking?.id) return null;
  return {
    kind: "booking",
    id: booking.id,
    jobId: null,
    scheduledAt: booking.startTime,
    // BookingStatus is its own enum (confirmed · cancelled · pending_payment),
    // and it is passed through rather than mapped onto AppointmentStatus:
    // countUpcoming already excludes "cancelled", and inventing a "scheduled"
    // here would claim a pending_payment hold is a booked visit.
    status: booking.status || "confirmed",
    notes: booking.mode ? `${booking.mode}` : null,
    title: booking.eventType?.name || null,
    client: booking.clientName
      ? { id: null, name: booking.clientName, address: booking.address || null, synthetic: true }
      : null,
    location: booking.address || null,
    assignedTo: booking.eventType?.user || null,
    // A booking is assigned by whose booking page took it. EventType.userId is
    // nullable — a company-wide booking type belongs to nobody in particular,
    // and that is "unassigned", not "assigned to the company".
    assignedToId: booking.eventType?.userId ?? null,
    // The one entry kind that knows its own end time, which is why the travel
    // check can say anything definite about a booking-shaped day.
    // Shaped to match the appointment branch above, `source` included: the
    // calendar reads one field for both kinds, so dropping it here would make
    // the badge appear on converted bookings and vanish on identical ones that
    // happen not to have an appointment yet.
    booking: booking.endTime
      ? { endTime: booking.endTime, source: booking.source ?? null }
      : null,
    requiresSupervisor: false,
    latitude: booking.latitude ?? null,
    longitude: booking.longitude ?? null,
  };
}

/** An Appointment in the same shape, so a caller can merge the two lists. */
export function appointmentToCalendarEntry(appointment) {
  if (!appointment?.id) return null;
  return {
    kind: "appointment",
    id: appointment.id,
    jobId: null,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status || "scheduled",
    notes: appointment.notes || null,
    title: null,
    client: appointment.client || null,
    location: appointment.location || appointment.client?.address || null,
    assignedTo: appointment.assignedTo || null,
  };
}

/**
 * Both sources, one list, soonest first.
 *
 * Rows missing a date are dropped rather than sorted to an arbitrary end — an
 * undated entry on a calendar has no position to be in.
 */
export function mergeSchedule(appointments = [], visits = [], bookings = []) {
  return [
    ...(Array.isArray(appointments) ? appointments : []).map(appointmentToCalendarEntry),
    ...(Array.isArray(visits) ? visits : []).map(toCalendarEntry),
    ...(Array.isArray(bookings) ? bookings : []).map(bookingToCalendarEntry),
  ]
    .filter((e) => e && e.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

/** How many entries fall from `now` forward. What the dashboard tile counts. */
export function countUpcoming(entries = [], now = new Date()) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return (Array.isArray(entries) ? entries : []).filter((e) => {
    if (!e?.scheduledAt) return false;
    const at = new Date(e.scheduledAt).getTime();
    if (Number.isNaN(at)) return false;
    // Cancelled work is not upcoming. It is still ON the calendar — you want
    // to see that Tuesday was called off — but it must not inflate a count of
    // what is coming.
    if (e.status === "cancelled" || e.status === "canceled") return false;
    return at >= t;
  }).length;
}
