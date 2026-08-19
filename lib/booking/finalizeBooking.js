// lib/booking/finalizeBooking.js
//
// The post-confirmation side-effects of a booking, shared by BOTH paths:
//  • the free confirm route (app/api/booking/[companySlug]/confirm), and
//  • the paid path, where the Stripe webhook flips a pending_payment booking to
//    confirmed once the visit fee is paid.
//
// One place so the two can't drift — a paid booking must get the same
// confirmation email, consent record and reminder as a free one. Every step is
// best-effort: the booking already exists, so a Resend/consent/reminder hiccup
// must never surface as "couldn't book that time".

import { sendBookingConfirmationEmail } from "@/app/admin/lib/email/templates";
import { recordConsent, DISCLOSURE } from "@/lib/voice/outbound";
import { onBookingConfirmed } from "@/lib/voice/triggers";
import { db } from "@/lib/db";
import { mintManageToken, visitManagePath, visitWhere } from "@/lib/booking/manageVisit";
import { getAppOrigin } from "@/lib/appUrl";

/**
 * The client's own link to this booking, minted here and nowhere else.
 *
 * Here specifically because this is the one point BOTH paths pass through: the
 * free confirm route creates the booking directly, the paid one is flipped to
 * confirmed by the Stripe webhook, and a token minted in either would leave the
 * other's clients with a confirmation email whose "manage this visit" link goes
 * nowhere. Minted only when absent, so a re-delivered webhook doesn't rotate a
 * token the client has already been sent.
 *
 * Returns null rather than throwing when the origin can't be worked out — the
 * booking exists and the email is worth more than the link on it.
 */
async function ensureManageUrl(booking) {
  try {
    let token = booking.manageToken;
    if (!token) {
      token = mintManageToken();
      await db.booking.update({
        where: { id: booking.id },
        data: { manageToken: token },
      });
      booking.manageToken = token;
    }
    return `${getAppOrigin()}${visitManagePath(token)}`;
  } catch (err) {
    console.error("[booking] manage link unavailable:", err?.message);
    return null;
  }
}

export async function finalizeBooking({ company, eventType, booking, clientId }) {
  const mode = booking.mode;

  const manageUrl = await ensureManageUrl(booking);

  // Which estimate this visit is about, when the booking came from one. Looked
  // up rather than passed in because both callers create the booking from a
  // bare `data` object and neither has the quote loaded — and the letter is the
  // only place the homeowner finds out the two are connected. Best-effort: a
  // failed lookup drops the line, it never costs the email.
  let quoteNumber = null;
  if (booking.quoteId) {
    quoteNumber = await db.quote
      .findUnique({ where: { id: booking.quoteId }, select: { quoteNumber: true } })
      .then((q) => q?.quoteNumber || null)
      .catch(() => null);
  }

  await sendBookingConfirmationEmail({
    to: booking.clientEmail,
    manageUrl,
    quoteNumber,
    // Zero = an exact time (the default). Only widened when the company asked.
    arrivalWindowMinutes: mode === "visit" ? company.arrivalWindowMinutes : 0,
    companyName: company.name,
    // The full row, so the mail leaves from the company's own verified domain
    // when they have one — it was sending under the shared sender even for
    // companies that had verified theirs, which is a FieldQuo leak on the one
    // surface the homeowner reads. And their zone, so "2:00 PM" is 2pm where the
    // van is going rather than wherever the lambda happened to run.
    company,
    timezone: company.timezone,
    clientName: booking.clientName,
    eventTypeName: eventType.name,
    startTime: booking.startTime,
    // Shared with the cancel and reschedule notices, so all three letters
    // describe the same visit the same way.
    location: visitWhere({ booking, eventType, company }),
  }).catch((err) =>
    console.error("[booking] confirmation email failed:", err?.message),
  );

  // Booking a visit is an evidenced request to be contacted — record the consent
  // (with the exact disclosure shown) so the reminder call and any future
  // outbound contact can check it.
  if (booking.clientPhone && clientId) {
    await recordConsent({
      companyId: company.id,
      phone: booking.clientPhone,
      source: "booking",
      disclosure: DISCLOSURE.booking,
      clientId,
    }).catch((err) =>
      console.error("[booking] consent record failed:", err?.message),
    );
  }

  await onBookingConfirmed({ bookingId: booking.id }).catch((err) =>
    console.error("[booking] couldn't queue reminder:", err?.message),
  );
}
