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

export async function finalizeBooking({ company, eventType, booking, clientId }) {
  const mode = booking.mode;

  await sendBookingConfirmationEmail({
    to: booking.clientEmail,
    // Zero = an exact time (the default). Only widened when the company asked.
    arrivalWindowMinutes: mode === "visit" ? company.arrivalWindowMinutes : 0,
    companyName: company.name,
    clientName: booking.clientName,
    eventTypeName: eventType.name,
    startTime: booking.startTime,
    location:
      mode === "call"
        ? `Phone call${company.phone ? ` — we'll ring you${booking.clientPhone ? ` on ${booking.clientPhone}` : ""}` : ""}`
        : mode === "video"
          ? "Video call — we'll email a link"
          : booking.address || eventType.location || "On-site visit",
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
