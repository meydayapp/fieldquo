// lib/booking/bookingText.js
//
// Is the booking-confirmation text on for this company? One answer, read by
// the send path (lib/booking/finalizeBooking.js) and the switch on Settings ›
// Messages (app/api/settings/message-templates/route.js), so the screen can
// never say "Off" while texts go out or the reverse.
//
// ON unless the company deliberately switched it off. It used to be off by
// default "because a text is billable" — and since nobody ever found the
// switch, no booking in FieldQuo ever sent a text (every company read false
// on 2026-09-25). The owner: a client who books should get the text, on the
// line FieldQuo pays for. A company that does not want it turns it off, and
// bookingSmsChosenAt records that it was a choice.

/**
 * @param company  { bookingSmsConfirmation, bookingSmsChosenAt } — both must
 *                 be selected; an unselected stamp would read as "never chose"
 *                 and turn texts on for a company that turned them off.
 */
export function bookingTextOn(company) {
  if (!company) return false;
  if (!("bookingSmsChosenAt" in company)) {
    throw new Error("bookingTextOn: bookingSmsChosenAt was not selected");
  }
  if (!company.bookingSmsChosenAt) return true;
  return Boolean(company.bookingSmsConfirmation);
}
