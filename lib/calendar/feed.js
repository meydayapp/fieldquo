// lib/calendar/feed.js
//
// A member's personal calendar SUBSCRIBE feed: the rows their FieldQuo
// calendar shows, as an iCalendar file a phone polls.
//
// ── What this is, and what it is not ───────────────────────────────────────
//
// app/api/shifts/ics is a one-off DOWNLOAD — the worker's shifts, fetched
// once, imported once. This is the other thing: a URL Google Calendar,
// Apple Calendar and Outlook re-read on their own schedule, so an
// appointment booked at 10:00 is on the crew member's phone by lunch with
// nobody exporting anything. The owner's words: "connect your calendar so
// any appointment is added to their calendar."
//
// ── One definition of who sees what ────────────────────────────────────────
//
// The rows come from lib/schedule/feed.js loadScheduleFeed — the SAME
// function GET /api/appointments and the day map call, with the same
// scoping (ownScheduleFilter, assignedJobWhere) and the same redaction
// (redactClient). This file never queries a table. A second union written
// here would be a second definition of who sees whose schedule, and a
// subscribed feed is the worst place for the two to disagree: it is the one
// surface that keeps being read after the member has put the phone down.
//
// What this file adds is only what a subscription needs and a screen does
// not: a stable UID per row, a SEQUENCE that grows when a row moves, a
// STATUS a client can strike through, TZID-qualified times with a
// VTIMEZONE to back them, and RFC 5545 line folding.
//
// ── The window ─────────────────────────────────────────────────────────────
//
// now − 30 days to now + 365 days. The 365 is the horizon a phone shows;
// the −30 is what makes a CANCELLED row disappear: a cancelled appointment
// stays in the feed as STATUS:CANCELLED for a month so the phone removes or
// strikes it rather than keeping a stale confirmed copy, and after thirty
// days it drops out of the window and out of the phone. A feed that omitted
// cancellations immediately would leave a subscriber who had cached the
// event still driving to it.

import { esc, stamp } from "@/lib/calendar/ics";
import { feedCopy } from "@/lib/calendar/feedCopy";
import { BOOKING_MODES, bookingModeLabel } from "@/lib/booking/bookingModes";
import {
  buildVtimezone,
  localDayKey,
  localWallClock,
  resolveTimeZone,
} from "@/lib/calendar/vtimezone";
import { hasLevel } from "@/lib/permissions/enforce";

export const FEED_PAST_DAYS = 30;
export const FEED_FUTURE_DAYS = 365;
/** Fifteen minutes — what X-PUBLISHED-TTL and the route's Cache-Control say. */
export const FEED_TTL_SECONDS = 15 * 60;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The [from, to] loadScheduleFeed is asked for. */
export function feedWindow(now = new Date()) {
  const at = now instanceof Date ? now : new Date(now);
  return {
    from: new Date(at.getTime() - FEED_PAST_DAYS * DAY_MS),
    to: new Date(at.getTime() + FEED_FUTURE_DAYS * DAY_MS),
  };
}

/**
 * What kind of thing this row is, in the company's language.
 *
 * `booking.mode` is the Booking.mode word — "visit" | "call" | "video" —
 * carried onto both an appointment created from a booking and an
 * unconverted booking (lib/schedule/jobVisits.js). A plain appointment with
 * no booking behind it is just an appointment: nothing on the row says
 * whether somebody drives or dials.
 */
// The mode words come from lib/booking/bookingModes.js — the same
// bookingModeLabel the confirmation letter, the manage page and the calendar
// card print — so the phone's calendar cannot call a video call something
// the email did not. The feed's own copy table keeps only the words that
// module has no reason to own (job visit, a plain appointment, the caveats).
function whatIs(entry, copy, language) {
  if (entry.kind === "visit") {
    return entry.title ? `${copy.jobVisit}: ${entry.title}` : copy.jobVisit;
  }
  const mode = entry.booking?.mode || null;
  if (BOOKING_MODES.includes(mode)) return bookingModeLabel(mode, language);
  return copy.appointment;
}

function isCancelled(entry) {
  return entry.status === "cancelled" || entry.status === "canceled";
}

/**
 * The event list a feed is built from. Pure: no clock, no database, no
 * session — everything it needs is handed in, so the check can run it over
 * fixtures and a reader can see every rule in one place.
 *
 * @param {object} p
 * @param {Array}  p.entries  loadScheduleFeed's rows (kind: appointment | visit | booking)
 * @param {object} p.full     loadEnforceableMember's row — the grid the phone-number rule reads
 * @param {object} p.company  { name, timezone, defaultLanguage }
 * @param {string} p.origin   the app's absolute origin, for the deep links
 * @param {Date}   p.now      DTSTAMP fallback for a row with no updatedAt
 */
export function feedEventsFor({ entries, full, company, origin, now = new Date() }) {
  const language = company?.defaultLanguage || "en";
  const copy = feedCopy(language);
  const timeZone = resolveTimeZone(company?.timezone);
  // ── The one thing a synthesised client does not know ────────────────────
  //
  // loadScheduleFeed redacts an APPOINTMENT's client through redactClient,
  // so a member at name_address_only never receives the phone. A BOOKING's
  // client is synthesised from the booking's own columns and always carries
  // clientPhone — the calendar screen reads it, and the calendar screen
  // knows who is looking. This feed applies the same rule the redaction
  // would have: a number is printed only for a member who may see the full
  // client record.
  const mayPhone = hasLevel(full, "clientsProperties", "full_view");
  const base = String(origin || "").replace(/\/+$/, "");

  const events = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry?.id || !entry.scheduledAt) continue;
    const start = new Date(entry.scheduledAt);
    if (Number.isNaN(start.getTime())) continue;

    // End: the booking's real finish when there is one. Otherwise an hour,
    // and the description SAYS the hour is a placeholder — a phone must show
    // some block, but a made-up duration presented as a fact is how a crew
    // member leaves a two-hour job after sixty minutes.
    const knownEnd = entry.booking?.endTime ? new Date(entry.booking.endTime) : null;
    const hasEnd = knownEnd && !Number.isNaN(knownEnd.getTime()) && knownEnd > start;
    const end = hasEnd ? knownEnd : new Date(start.getTime() + HOUR_MS);

    const what = whatIs(entry, copy, language);
    const who = entry.client?.name ? String(entry.client.name).trim() : "";
    let summary = who ? `${what} — ${who}` : what;
    const cancelled = isCancelled(entry);
    if (cancelled) summary = `${copy.cancelled}: ${summary}`;

    // LOCATION: where to be — or, for a call, what to dial. The number is
    // the client's and appears only when the member may see it; otherwise
    // the location just says it is a call, which is still true.
    const mode = entry.booking?.mode || null;
    let location = null;
    if (mode === "call") {
      const phone = mayPhone && entry.client?.phone ? String(entry.client.phone).trim() : "";
      location = phone ? `${copy.phone}: ${phone}` : copy.phoneCall;
    } else if (mode === "video") {
      location = copy.videoCall;
    } else {
      location = entry.location || entry.client?.address || null;
    }

    // DESCRIPTION: the way back into FieldQuo, the notes, and the duration
    // caveat. Never a client's email or phone — the description is the one
    // field every calendar app surfaces in notifications and search.
    const link =
      entry.kind === "visit" && entry.jobId
        ? `${base}/app/jobs/${entry.jobId}`
        : `${base}/app/appointments?day=${localDayKey(start, timeZone)}`;
    const descriptionLines = [`${copy.openInFieldQuo}: ${link}`];
    // A booking's `notes` is the mode word (lib/schedule/jobVisits.js) —
    // already said in the summary, so it is not repeated here.
    if (entry.kind !== "booking" && entry.notes) descriptionLines.push(String(entry.notes).trim());
    if (!hasEnd) descriptionLines.push(copy.durationNotSet);

    // SEQUENCE and the stamps come from the row's own updatedAt, so a moved
    // appointment carries a higher number than the copy the phone holds and
    // the phone takes the new one. Whole seconds: RFC 5545 wants an integer
    // and a millisecond count overflows a 32-bit reader.
    const updated = entry.updatedAt ? new Date(entry.updatedAt) : null;
    const modified = updated && !Number.isNaN(updated.getTime()) ? updated : now;

    events.push({
      uid: `${entry.kind === "appointment" ? "appt" : entry.kind}-${entry.id}@fieldquo`,
      start,
      end,
      summary,
      location,
      description: descriptionLines.join("\n"),
      sequence: Math.floor(modified.getTime() / 1000),
      modified,
      cancelled,
    });
  }
  return events;
}

/**
 * RFC 5545 §3.1 line folding: a content line longer than 75 octets is split
 * with CRLF followed by one space. Counted in OCTETS and split between
 * CHARACTERS, so a multi-byte letter is never cut in half — a folded UTF-8
 * sequence is what turns "Rendez-vous — Léa" into replacement glyphs on the
 * phone.
 */
export function foldLine(line) {
  const LIMIT = 75;
  const out = [];
  let current = "";
  let bytes = 0;
  for (const ch of String(line)) {
    const n = Buffer.byteLength(ch, "utf8");
    if (bytes + n > LIMIT) {
      out.push(current);
      // The continuation's leading space counts toward its own 75.
      current = ` ${ch}`;
      bytes = 1 + n;
    } else {
      current += ch;
      bytes += n;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

/**
 * The ICS text.
 *
 * @param {object} p
 * @param {Array}  p.events     feedEventsFor's list
 * @param {object} p.company    { name, timezone }
 * @param {Date}   p.from / p.to  the window the VTIMEZONE must cover
 * @param {string} [p.language] the company's default language, for the calendar name
 */
export function buildFeedCalendar({ events, company, from, to, language }) {
  const copy = feedCopy(language ?? company?.defaultLanguage);
  const timeZone = resolveTimeZone(company?.timezone);
  const { tzid, lines: vtimezone } = buildVtimezone({ timeZone, from, to });
  const name = `${company?.name || "FieldQuo"} — ${copy.mySchedule}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FieldQuo//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${tzid}`,
    // Apple and Outlook honour this as the poll interval; Google ignores it
    // and re-reads on its own schedule, which the settings page says.
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    ...vtimezone,
  ];

  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev?.uid || !ev.start || !ev.end) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp(ev.modified)}`,
      `LAST-MODIFIED:${stamp(ev.modified)}`,
      `SEQUENCE:${Number.isFinite(ev.sequence) ? ev.sequence : 0}`,
      `DTSTART;TZID=${tzid}:${localWallClock(ev.start, tzid)}`,
      `DTEND;TZID=${tzid}:${localWallClock(ev.end, tzid)}`,
      `SUMMARY:${esc(ev.summary || "")}`,
      ev.location ? `LOCATION:${esc(ev.location)}` : null,
      ev.description ? `DESCRIPTION:${esc(ev.description)}` : null,
      `STATUS:${ev.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).map(foldLine).join("\r\n") + "\r\n";
}
