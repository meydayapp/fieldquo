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
 * @param method   "REQUEST" (an invitation, the default) or "CANCEL" — the
 *                 second, sent with the SAME uid, is what makes Google,
 *                 Apple and Outlook remove the event from the client's
 *                 calendar rather than leave a ghost.
 * @param sequence RFC 5545 SEQUENCE. 0 for the first invitation; a re-issue
 *                 of the same uid with a HIGHER number is what makes a mail
 *                 client replace the event it already has (a moved visit)
 *                 instead of adding a second one beside it. Same number or
 *                 lower is ignored by every major client, which is why the
 *                 caller has to keep count (Booking.calendarSequence).
 * @param prodId   who produced it; the demo booking keeps its own.
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
  method = "REQUEST",
  sequence = 0,
  prodId = "-//FieldQuo//Demo Booking//EN",
}) {
  const cancel = method === "CANCEL";
  const seq = Number.isFinite(Number(sequence)) && Number(sequence) > 0 ? Math.floor(Number(sequence)) : 0;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${cancel ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SEQUENCE:${seq}`,
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
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
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
