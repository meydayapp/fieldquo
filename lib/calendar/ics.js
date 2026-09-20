// lib/calendar/ics.js
//
// A minimal iCalendar (.ics) builder for the demo booking — enough for the
// confirmation email to carry a "add to calendar" invite that Google, Apple and
// Outlook all accept. METHOD:REQUEST + an ORGANIZER/ATTENDEE pair is what makes
// a mail client show "Yes / Maybe / No" rather than a plain attachment.
//
// No external library: the format is a handful of CRLF-joined lines, and pulling
// in a dependency for that is the kind of weight this file exists to avoid.

// Escape the characters iCalendar treats as special in a text value.
//
// Exported for lib/calendar/feed.js, which builds the subscribe feed's
// VEVENTs itself (it needs TZID-qualified dates, SEQUENCE and STATUS that
// buildIcsCalendar does not carry). One escaper, not a second copy: the copy
// is the one that forgets the backslash.
export function esc(v) {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// iCalendar UTC stamp: 20260716T220000Z
export function stamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * @param dtstamp  the "now" instant for DTSTAMP — pass it in so the caller
 *                 controls it (and tests stay deterministic).
 */
export function buildIcs({
  uid,
  start,
  end,
  summary,
  description,
  location,
  organizerName,
  organizerEmail,
  attendeeName,
  attendeeEmail,
  dtstamp = new Date(),
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FieldQuo//Demo Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(dtstamp)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(summary)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    location ? `LOCATION:${esc(location)}` : null,
    organizerEmail ? `ORGANIZER;CN=${esc(organizerName || organizerEmail)}:mailto:${organizerEmail}` : null,
    attendeeEmail
      ? `ATTENDEE;CN=${esc(attendeeName || attendeeEmail)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${attendeeEmail}`
      : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  // iCalendar requires CRLF line endings.
  return lines.join("\r\n");
}

/**
 * A whole calendar of events — the worker's published shifts as one .ics
 * file they add to their phone. METHOD:PUBLISH, no organizer/attendee: it is
 * their own schedule, not an invitation with a Yes/No, and the same file
 * re-downloaded next week replaces the events by UID rather than doubling
 * them (Apple and Google both key on UID within a calendar).
 *
 * @param {object} p
 * @param {Array<{ uid, start, end, summary, description?, location? }>} p.events
 * @param {string} [p.calendarName]  X-WR-CALNAME, what the phone calls it
 * @param {string} [p.prodId]
 * @param {Date}   [p.dtstamp]
 */
export function buildIcsCalendar({ events, calendarName, prodId = "-//FieldQuo//Schedule//EN", dtstamp = new Date() }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    calendarName ? `X-WR-CALNAME:${esc(calendarName)}` : null,
  ];
  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev?.uid || !ev.start || !ev.end) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp(dtstamp)}`,
      `DTSTART:${stamp(ev.start)}`,
      `DTEND:${stamp(ev.end)}`,
      `SUMMARY:${esc(ev.summary || "")}`,
      ev.description ? `DESCRIPTION:${esc(ev.description)}` : null,
      ev.location ? `LOCATION:${esc(ev.location)}` : null,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}
