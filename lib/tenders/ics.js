// lib/tenders/ics.js
//
// A tender's deadlines as an .ics file the member adds to their OWN calendar
// — the "put the closing on the calendar" half of the brief.
//
// ══ Why a download and not the company calendar ═══════════════════════════
//
// The company calendar that takes events not tied to a job is ScheduleEvent
// (app/api/schedule-events): the week board's Events row, shown on EVERY
// worker's Home. GET /api/schedule-events answers anyone on the roster, so a
// tender written there would show "PSPC bid closes 14:00" to Crew, who sit at
// quotes: none and may not open a tender at all. The appointments calendar
// (lib/schedule/feed.js) is appointments, jobs and bookings — a closing is
// none of those, and adding a fourth kind there is a change to every
// calendar surface at once. So: a file, generated for the member asking, from
// the same instants the reminders use. Whether closings should ALSO appear
// on a manager-only calendar is a product decision, named in the ROADMAP.
//
// Only times go in: a deadline printed as a date alone has no instant, and
// inventing one for a calendar is the padding AGENTS.md forbids — it is
// listed in the description instead. No contact details and no money: a
// phone calendar syncs to Google or Apple, which is a third party.
import { buildIcsCalendar } from "@/lib/calendar/ics";

const HOUR_MS = 60 * 60 * 1000;

/**
 * @param {object} t        the tender (TENDER_SELECT fields)
 * @param {object} words    { closing, questions, siteVisit, siteVisitMandatory, dateOnly } — sentences in the reader's language
 * @param {Date}   now
 */
export function tenderCalendar(t, words, now = new Date()) {
  const label = t.solicitationNumber ? `${t.solicitationNumber} — ${t.title}` : t.title;
  const events = [];
  const dateOnly = [];
  const at = (v) => (v ? new Date(v) : null);

  const closingAt = at(t.closingAt);
  if (closingAt && Number.isFinite(closingAt.getTime())) {
    events.push({
      uid: `tender-${t.id}-closing@fieldquo.com`,
      start: new Date(closingAt.getTime() - HOUR_MS),
      end: closingAt,
      summary: `${words.closing}: ${label}`,
    });
  }
  const questionsAt = at(t.questionsDeadlineAt);
  if (questionsAt && Number.isFinite(questionsAt.getTime())) {
    events.push({
      uid: `tender-${t.id}-questions@fieldquo.com`,
      start: new Date(questionsAt.getTime() - HOUR_MS),
      end: questionsAt,
      summary: `${words.questions}: ${label}`,
    });
  } else if (t.questionsDeadlineDate) {
    dateOnly.push(`${words.questions}: ${t.questionsDeadlineDate}`);
  }
  const visitAt = at(t.siteVisitAt);
  const visitWord = t.siteVisitMandatory ? words.siteVisitMandatory : words.siteVisit;
  if (visitAt && Number.isFinite(visitAt.getTime())) {
    events.push({
      uid: `tender-${t.id}-site-visit@fieldquo.com`,
      start: visitAt,
      end: new Date(visitAt.getTime() + HOUR_MS),
      summary: `${visitWord}: ${label}`,
      location: t.siteVisitLocation || undefined,
    });
  } else if (t.siteVisitDate) {
    dateOnly.push(`${visitWord}: ${t.siteVisitDate}`);
  }
  if (dateOnly.length && events.length) {
    events[0].description = `${words.dateOnly}\n${dateOnly.join("\n")}`;
  }
  return buildIcsCalendar({ events, calendarName: label, prodId: "-//FieldQuo//Tenders//EN", dtstamp: now });
}
