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

import { bookingTextOn } from "@/lib/booking/bookingText";
import { sendBookingConfirmationEmail } from "@/app/admin/lib/email/templates";
import { recordConsent, DISCLOSURE } from "@/lib/voice/outbound";
import { onBookingConfirmed } from "@/lib/voice/triggers";
import { db } from "@/lib/db";
import { recordFeatureUse } from "@/lib/analytics/product/server";
import { mintManageToken, visitManagePath, visitFacts } from "@/lib/booking/manageVisit";
import { getAppOrigin } from "@/lib/appUrl";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { maySms } from "@/lib/sms/optOut";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { loadSmsTemplateTranslations } from "@/lib/i18n/companyText";
import { formatWhen as smsWhen } from "@/lib/sms/templates";
import { bookingModeLine, bookingFeeLine } from "@/lib/booking/bookingModes";
import { bookingInviteAttachment } from "@/lib/booking/bookingInvite";
import { formatMoney } from "@/lib/currency";

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
  let quote = null;
  if (booking.quoteId) {
    quote = await db.quote
      .findUnique({ where: { id: booking.quoteId }, select: { quoteNumber: true, language: true } })
      .catch(() => null);
    quoteNumber = quote?.quoteNumber || null;
  }

  // The letter's language, by the one rule every client-facing send follows
  // (lib/i18n/clientLanguage.js): the quote this visit is about, else the
  // client's own preference, else the company default. Booking carries no
  // client relation, so the Client row is read by the id the caller resolved.
  // Best-effort like everything else here — a failed read means the company
  // default, never a missing letter.
  const client = clientId
    ? await db.client
        .findUnique({ where: { id: clientId }, select: { language: true } })
        .catch(() => null)
    : null;
  // The language the booker chose on the form (Booking.language) stands in
  // for the client's preference when it is stated: it is the newer statement
  // and the one the person reading this letter just made. The quote's
  // fixed language still wins above both (non-negotiable 6).
  const language = resolveClientLanguage({
    document: quote,
    client: booking.language ? { language: booking.language } : client,
    company,
  });

  // No address, no letter — and say so rather than posting into the void.
  //
  // Every web booking collects an email, but a booking taken over the phone
  // cannot: the receptionist would have to spell an address back down a phone
  // line, and a mistyped one is a confirmation the homeowner never gets and the
  // contractor believes was sent. Resend rejects an empty `to`, the rejection
  // was caught and logged, and the caller was told "you'll get a confirmation
  // shortly" regardless. Skipped explicitly, and the result is returned so the
  // caller can be honest about what happened.
  const emailed = Boolean(String(booking.clientEmail || "").trim());

  if (emailed) {
    // The calendar invite — one tap into their Google, Apple or Outlook
    // calendar, in the mode they chose and their language. UID fixed per
    // booking, SEQUENCE from the row, so the moved and cancelled letters can
    // replace or drop this same event later (lib/booking/bookingInvite.js).
    const invite = await bookingInviteAttachment({ booking, company, language, manageUrl });
    await sendBookingConfirmationEmail({
      to: booking.clientEmail,
      manageUrl,
      ...(invite && { attachments: [invite] }),
      quoteNumber,
      // Zero = an exact time (the default). Only widened when the company asked.
      arrivalWindowMinutes: mode === "visit" ? company.arrivalWindowMinutes : 0,
      companyName: company.name,
      // The full row, so the mail leaves from the company's own verified domain
      // when they have one — it was sending under the shared sender even for
      // companies that had verified theirs, which is a FieldQuo leak on the one
      // surface the homeowner reads. And their zone, so "2:00 PM" is 2pm where
      // the van is going rather than wherever the lambda happened to run.
      company,
      timezone: company.timezone,
      clientName: booking.clientName,
      eventTypeName: eventType.name,
      startTime: booking.startTime,
      // The booking's own facts — mode, address, phone, email — from which
      // the letter names WHAT was booked ("Confirmed: Phone call with
      // Northline") and where ("Phone call — we'll ring 819-238-7263") in its
      // own language. Shared with the cancel and reschedule notices, so all
      // three letters describe the same appointment the same way.
      where: visitFacts(booking),
      // "$49 paid" / "No charge" — the row's own receipt, never today's price
      // list: feePaidCents is what settleBookingFee recorded, 0 on the free
      // path.
      feePaid: { cents: booking.feePaidCents || 0, currency: booking.feeCurrency || company.currency },
      language,
    }).catch((err) =>
      console.error("[booking] confirmation email failed:", err?.message),
    );
  }

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

  // ── The text, when the company asked for it ─────────────────────────────
  //
  // Four gates, every one re-read here rather than trusted from the caller:
  //   1. The switch beside the template on Settings → Messages, through
  //      bookingTextOn: ON unless the company deliberately turned it off
  //      (off-by-default meant no booking ever texted — owner, 2026-09-25).
  //   2. a phone the client gave, in a shape Twilio can dial.
  //   3. maySms — a STOP to this company, or a call opt-out, always wins.
  //   4. sendSms itself refuses with no from-number; clientSmsFrom gives the
  //      company's own line when they have one, else the shared system line.
  // The body is the same line the letter carries — "On-site visit at 12 Elm
  // St" / "Phone call — we'll ring 819-238-7263" — in the client's language,
  // through renderMessage so the company's own wording is used when they set
  // it and the reader speaks its language. Best-effort like the email: a
  // failed text is logged, never a failed booking.
  const texted = await textConfirmation({ company, eventType, booking, language, manageUrl });

  await onBookingConfirmed({ bookingId: booking.id }).catch((err) =>
    console.error("[booking] couldn't queue reminder:", err?.message),
  );

  // Usage count — see lib/analytics/product/server.js. Here rather than in
  // the confirm route so a booking that paid its fee (settleBookingFee) and
  // one that did not are counted by the same line. No member: a homeowner
  // booked it.
  await recordFeatureUse("booking_created", { companyId: company.id });

  // Whether anything was actually posted. The phone path reads this to decide
  // what the agent is allowed to promise the caller.
  return { emailed, texted };
}

/**
 * Whether this booking gets a text, and why not when it doesn't.
 *
 * Exported so scripts/check-booking-modes.mjs can run the gates the send
 * path runs — the same three, in the same order — rather than assert about
 * them from the source. `to` is the E.164 the text would go to.
 *
 * @returns {Promise<{ send: boolean, reason: string, to: string|null }>}
 */
export async function bookingTextVerdict({ company, booking }) {
  // Re-read fresh: callers pass company rows loaded with different selects,
  // and the choice stamp must never be read as "missing" (lib/booking/
  // bookingText.js — on unless the company deliberately switched it off).
  const setting = company?.id
    ? await db.company.findUnique({
        where: { id: company.id },
        select: { bookingSmsConfirmation: true, bookingSmsChosenAt: true },
      })
    : null;
  if (!bookingTextOn(setting)) return { send: false, reason: "switched_off", to: null };
  const to = toE164(booking?.clientPhone);
  if (!to) return { send: false, reason: "no_phone", to: null };
  if (!(await maySms({ companyId: company.id, phone: to }))) return { send: false, reason: "opted_out", to };
  return { send: true, reason: "ok", to };
}

/**
 * @returns {boolean} whether a text was actually sent.
 */
async function textConfirmation({ company, eventType, booking, language }) {
  try {
    const verdict = await bookingTextVerdict({ company, booking });
    if (!verdict.send) return false;
    const to = verdict.to;

    const result = await sendSms({
      to,
      body: renderMessage({
        type: "booking_confirmation",
        templates: company.smsTemplates,
        language,
        templateLanguage: company.defaultLanguage || "en",
        // The company's wording in THIS client's language, when its draft
        // exists (lib/i18n/autoTranslate.js) — else the built-in text.
        translatedTemplates: await loadSmsTemplateTranslations(db, company, { companyId: company.id, language }),
        values: {
          company: company.name,
          service: eventType?.name || "",
          when: smsWhen(booking.startTime, { language, timezone: company.timezone }),
          where: bookingModeLine({
            mode: booking.mode,
            address: booking.address,
            phone: booking.clientPhone,
            email: booking.clientEmail,
            language,
          }),
          fee: bookingFeeLine({
            amountText:
              booking.feePaidCents > 0
                ? formatMoney(booking.feePaidCents / 100, booking.feeCurrency || company.currency)
                : null,
            language,
          }),
        },
      }),
      from: clientSmsFrom(company),
      // The tenant, so a demo company's confirmation is simulated rather than
      // texted to whoever booked — see lib/sms/demoSms.js.
      companyId: company.id,
    });
    if (!result?.success) {
      console.error("[booking] confirmation text failed:", result?.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[booking] confirmation text failed:", err?.message);
    return false;
  }
}
