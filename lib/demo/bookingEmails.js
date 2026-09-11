// lib/demo/bookingEmails.js
//
// The two emails a booking on FieldQuo's own calendar sends: the
// confirmation to the person who booked, and the heads-up to the host and
// the superadmins — both carrying the same .ics.
//
// Extracted from app/api/demo/book/route.js the day the sales walkthrough
// (lib/sales/nextSteps.js) needed the same two emails for a booking made
// from the rep's console rather than the homepage. Two copies of "put it on
// everyone's calendar" is the duplication AGENTS.md names as failure class
// 4, and the copy that rots is the one nobody re-reads. The homepage route
// still calls these with `kind: "demo"` and sends exactly what it sent.
//
// Not white-label: this is FieldQuo writing to its own prospect or customer
// about a meeting with FieldQuo. The name belongs in the From line here.
import { db } from "@/lib/db";
import { buildIcs } from "@/lib/calendar/ics";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { DEMO_TZ, SLOT_MINUTES } from "@/lib/demo/slots";

/** What each kind is called in the subject lines and the invite. */
export const BOOKING_KINDS = Object.freeze({
  demo: { minutes: SLOT_MINUTES, noun: "demo", summary: "FieldQuo demo", body: "It's a 30-minute online walkthrough. We'll email a video link before the call." },
  walkthrough: {
    minutes: 60,
    noun: "walkthrough",
    summary: "FieldQuo walkthrough",
    body: "It's a one-hour online walkthrough of your own account with a FieldQuo specialist. We'll email a video link before the call.",
  },
});

/** Pull the bare address out of a "Name <addr@x>" From, for the ICS ORGANIZER. */
export function emailAddressOf(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim() || "demos@fieldquo.com";
}

export function whenLabelFor(start) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TZ, weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  }).format(start);
}

/**
 * The .ics for one booking, plus the labels the two emails share.
 *
 * @param booking  a DemoBooking row: id, name, email, companyName, phone,
 *                 notes, scheduledAt
 * @param kind     "demo" | "walkthrough"
 */
export async function bookingInvite(booking, { kind = "demo" } = {}) {
  const spec = BOOKING_KINDS[kind] || BOOKING_KINDS.demo;
  const start = booking.scheduledAt;
  const end = new Date(start.getTime() + spec.minutes * 60 * 1000);
  const from = await getPlatformFrom();
  const who = booking.companyName ? `${booking.name} (${booking.companyName})` : booking.name;
  const whenLabel = whenLabelFor(start);
  const ics = buildIcs({
    uid: `${kind}-${booking.id}@fieldquo.com`,
    start, end,
    summary: `${spec.summary} — ${who}`,
    description: `${spec.minutes}-minute FieldQuo ${spec.noun}.\\n\\nBooked by: ${who}\\nEmail: ${booking.email}${booking.phone ? `\\nPhone: ${booking.phone}` : ""}${booking.notes ? `\\n\\nNotes: ${booking.notes}` : ""}`,
    location: "Online",
    organizerName: "FieldQuo",
    organizerEmail: emailAddressOf(from),
    attendeeName: booking.name,
    attendeeEmail: booking.email,
  });
  return {
    spec,
    from,
    who,
    whenLabel,
    attachments: [{ filename: `fieldquo-${kind}.ics`, content: Buffer.from(ics).toString("base64") }],
  };
}

/** Confirmation to the person who booked. */
export async function sendBookingConfirmation(booking, { kind = "demo" } = {}) {
  const { spec, from, whenLabel, attachments } = await bookingInvite(booking, { kind });
  return sendEmail({
    from,
    to: booking.email,
    subject: `Your FieldQuo ${spec.noun} — ${whenLabel}`,
    html: prospectHtml({ name: booking.name, whenLabel, body: spec.body, noun: spec.noun }),
    text: `Hi ${booking.name}, your FieldQuo ${spec.noun} is booked for ${whenLabel}. We'll send a video link before the call. The calendar invite is attached.`,
    attachments,
  });
}

/**
 * Heads-up internally — the "it's on somebody's calendar" half.
 *
 * The ASSIGNED HOST comes first and is not optional: a host who doesn't get
 * the invite hasn't really been assigned anything. Superadmins keep the
 * heads-up they had before this had hosts at all, deduped so a superadmin
 * who is also the host gets one email rather than two.
 *
 * @param bookedBy  a sentence naming who made the booking, when it was not
 *                  the person themselves ("booked by rep Daniel Ortega from
 *                  lead …") — printed in the heads-up so the specialist
 *                  knows whom to ask.
 */
export async function sendHostHeadsUp(booking, hostEmail, { kind = "demo", bookedBy = null } = {}) {
  const { spec, from, who, whenLabel, attachments } = await bookingInvite(booking, { kind });
  const superadmins = await db.platformAdmin.findMany({
    where: { role: "superadmin", active: true },
    select: { email: true },
  });
  const recipients = [...new Set([hostEmail, ...superadmins.map((a) => a.email)].filter(Boolean))];
  for (const to of recipients) {
    await sendEmail({
      from,
      to,
      subject: `New ${spec.noun} booked — ${who}, ${whenLabel}`,
      html: adminHtml({ who, whenLabel, booking, noun: spec.noun, bookedBy }),
      text: `New FieldQuo ${spec.noun}: ${who} <${booking.email}> on ${whenLabel}.${booking.phone ? ` Phone: ${booking.phone}.` : ""}${bookedBy ? ` ${bookedBy}.` : ""}${booking.notes ? ` Notes: ${booking.notes}` : ""}`,
      attachments,
    });
  }
  return recipients;
}

function prospectHtml({ name, whenLabel, body, noun }) {
  const safe = (s) => String(s || "").replace(/[<>&]/g, "");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1a2e">
    <div style="background:#1A1917;padding:22px 28px;border-radius:14px 14px 0 0">
      <span style="color:#ff5a00;font-weight:bold;letter-spacing:.16em;font-size:12px;text-transform:uppercase">FieldQuo</span>
    </div>
    <div style="border:1px solid #e8e2d6;border-top:none;border-radius:0 0 14px 14px;padding:28px">
      <p style="margin:0 0 14px">Hi ${safe(name)},</p>
      <p style="margin:0 0 14px">Your FieldQuo ${safe(noun)} is booked for:</p>
      <p style="margin:0 0 18px;font-size:17px;font-weight:bold">${safe(whenLabel)}</p>
      <p style="margin:0 0 14px">${safe(body)} A calendar invite is attached — add it so you don't miss it.</p>
      <p style="margin:0;font-size:12px;color:#6b6257">Need to change it? Just reply to this email.</p>
    </div>
  </div>`;
}

function adminHtml({ who, whenLabel, booking, noun, bookedBy }) {
  const safe = (s) => String(s || "").replace(/[<>&]/g, "");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1a2e">
    <p style="margin:0 0 10px;font-weight:bold">New ${safe(noun)} booked</p>
    <p style="margin:0 0 6px">${safe(who)} — <a href="mailto:${safe(booking.email)}">${safe(booking.email)}</a></p>
    ${booking.phone ? `<p style="margin:0 0 6px">${safe(booking.phone)}</p>` : ""}
    <p style="margin:0 0 6px"><strong>${safe(whenLabel)}</strong></p>
    ${bookedBy ? `<p style="margin:0 0 6px">${safe(bookedBy)}</p>` : ""}
    ${booking.notes ? `<p style="margin:10px 0 0;white-space:pre-wrap">${safe(booking.notes)}</p>` : ""}
    <p style="margin:14px 0 0;font-size:12px;color:#6b6257">The calendar invite is attached. It's also in the platform console under Demos.</p>
  </div>`;
}
