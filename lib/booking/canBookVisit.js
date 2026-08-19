// lib/booking/canBookVisit.js
//
// Can this company actually take a booking for an IN-PERSON visit, right now?
//
// ── Why this is a question and not an assumption ────────────────────────────
//
// The self-quote confirmation offers "book your in-person visit" underneath the
// document. That offer is only honest if pressing it lands on a calendar with
// something on it. Two things have to be true, and both are ordinary states for
// a company that has never opened the booking screen:
//
//   • at least one ACTIVE event type — the thing being booked. A company with
//     none gets a booking page that renders an empty service list.
//   • "visit" among the offered modes. A company that only does phone
//     consultations has switched this off deliberately, and offering a
//     home visit on their behalf is a promise they didn't make.
//
// Availability itself is NOT checked here. That needs a date range, a member
// and a travel calculation (lib/booking/computeAvailability.js), and a company
// whose next free slot is three weeks out is still bookable — the calendar
// says so plainly. What this rules out is the case where there is no calendar.
//
// Pure. Give it the two fields; it answers.

/**
 * @param company { bookingModes: string[], eventTypes: {id}[] }
 * @returns boolean
 */
export function canBookVisit(company) {
  const activeTypes = Array.isArray(company?.eventTypes) ? company.eventTypes : [];
  if (!activeTypes.length) return false;

  // Empty/absent means the schema default, which is ["visit"] — the same
  // fallback BookingFlow applies when it decides which modes to offer. Read as
  // "nothing chosen yet", never as "nothing offered", or a company that has
  // never touched the setting would look unbookable while its booking page
  // works perfectly.
  const modes = Array.isArray(company?.bookingModes) && company.bookingModes.length
    ? company.bookingModes
    : ["visit"];

  return modes.includes("visit");
}
