// app/api/demo/book/route.js
//
// Public: books a FieldQuo product demo from the marketing homepage. Creates a
// DemoBooking (FieldQuo's own sales calendar, not a tenant's), then emails a
// confirmation to the prospect and a heads-up to the superadmin(s) — both with a
// calendar (.ics) invite so it lands on everyone's calendar.
//
// Three guards keep it honest: a per-IP throttle (the endpoint is public and
// every booking emails two people), the submitted time must be one we actually
// offer (isOfferedSlot re-derives the set — a hand-posted 3am timestamp is
// rejected), and the DB's unique constraint on scheduledAt settles the race
// where two prospects grab the same slot between the check and the write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { isOfferedSlot, SLOT_MINUTES, DEMO_TZ } from "@/lib/demo/slots";
import { buildIcs } from "@/lib/calendar/ics";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request) {
  // A third guard on top of the two above, and a different kind: those keep one
  // booking honest, this keeps someone from taking every slot on the sales
  // calendar and sending an .ics to a stranger's inbox for each one.
  const limited = rateLimit(request, "demo-book");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 120);
  const email = String(body?.email || "").trim().toLowerCase();
  const companyName = String(body?.companyName || "").trim().slice(0, 160) || null;
  const phone = String(body?.phone || "").trim().slice(0, 40) || null;
  const notes = String(body?.notes || "").trim().slice(0, 1000) || null;
  const slot = String(body?.slot || "");

  if (!name) return bad("Enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad("Enter a valid email address.");

  const now = new Date();
  if (!isOfferedSlot(slot, now)) {
    return bad("That time isn't available anymore — please pick another slot.");
  }
  const scheduledAt = new Date(slot);

  let booking;
  try {
    booking = await db.demoBooking.create({
      data: {
        name, email, companyName, phone, notes, scheduledAt,
        source: String(body?.source || "hero").slice(0, 40),
      },
    });
  } catch {
    // Unique-constraint violation on scheduledAt → taken since the slots loaded.
    return bad("Someone just booked that slot — please pick another.", 409);
  }

  // Emails are best-effort: the booking is saved, so a mail hiccup must not make
  // the prospect think it failed and book twice.
  try {
    await sendDemoEmails(booking);
  } catch (err) {
    console.error("[demo book] email send failed:", err.message);
  }

  return NextResponse.json({ ok: true, scheduledAt: scheduledAt.toISOString() });
}

async function sendDemoEmails(booking) {
  const start = booking.scheduledAt;
  const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

  const whenLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TZ, weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  }).format(start);

  const from = await getPlatformFrom();
  const who = booking.companyName ? `${booking.name} (${booking.companyName})` : booking.name;

  const ics = buildIcs({
    uid: `demo-${booking.id}@fieldquo.com`,
    start, end,
    summary: `FieldQuo demo — ${who}`,
    description: `30-minute FieldQuo product demo.\\n\\nBooked by: ${who}\\nEmail: ${booking.email}${booking.phone ? `\\nPhone: ${booking.phone}` : ""}${booking.notes ? `\\n\\nNotes: ${booking.notes}` : ""}`,
    location: "Online",
    organizerName: "FieldQuo",
    organizerEmail: emailAddressOf(from),
    attendeeName: booking.name,
    attendeeEmail: booking.email,
  });
  const attachments = [
    { filename: "fieldquo-demo.ics", content: Buffer.from(ics).toString("base64") },
  ];

  // Confirmation to the prospect.
  await sendEmail({
    from,
    to: booking.email,
    subject: `Your FieldQuo demo — ${whenLabel}`,
    html: prospectHtml({ name: booking.name, whenLabel }),
    text: `Hi ${booking.name}, your FieldQuo demo is booked for ${whenLabel}. We'll send a video link before the call. The calendar invite is attached.`,
    attachments,
  });

  // Heads-up to the superadmin(s) — this is the "on Emilio's calendar" half.
  const admins = await db.platformAdmin.findMany({
    where: { role: "superadmin", active: true },
    select: { email: true },
  });
  for (const admin of admins) {
    await sendEmail({
      from,
      to: admin.email,
      subject: `New demo booked — ${who}, ${whenLabel}`,
      html: adminHtml({ who, whenLabel, booking }),
      text: `New FieldQuo demo: ${who} <${booking.email}> on ${whenLabel}.${booking.phone ? ` Phone: ${booking.phone}.` : ""}${booking.notes ? ` Notes: ${booking.notes}` : ""}`,
      attachments,
    });
  }
}

// Pull the bare address out of a "Name <addr@x>" From, for the ICS ORGANIZER.
function emailAddressOf(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim() || "demos@fieldquo.com";
}

function prospectHtml({ name, whenLabel }) {
  const safe = (s) => String(s || "").replace(/[<>&]/g, "");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1a2e">
    <div style="background:#1A1917;padding:22px 28px;border-radius:14px 14px 0 0">
      <span style="color:#ff5a00;font-weight:bold;letter-spacing:.16em;font-size:12px;text-transform:uppercase">FieldQuo</span>
    </div>
    <div style="border:1px solid #e8e2d6;border-top:none;border-radius:0 0 14px 14px;padding:28px">
      <p style="margin:0 0 14px">Hi ${safe(name)},</p>
      <p style="margin:0 0 14px">Your FieldQuo demo is booked for:</p>
      <p style="margin:0 0 18px;font-size:17px;font-weight:bold">${safe(whenLabel)}</p>
      <p style="margin:0 0 14px">It's a 30-minute online walkthrough. We'll email a video link before the call. A calendar invite is attached — add it so you don't miss it.</p>
      <p style="margin:0;font-size:12px;color:#6b6257">Need to change it? Just reply to this email.</p>
    </div>
  </div>`;
}

function adminHtml({ who, whenLabel, booking }) {
  const safe = (s) => String(s || "").replace(/[<>&]/g, "");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1a2e">
    <p style="margin:0 0 10px;font-weight:bold">New demo booked</p>
    <p style="margin:0 0 6px">${safe(who)} — <a href="mailto:${safe(booking.email)}">${safe(booking.email)}</a></p>
    ${booking.phone ? `<p style="margin:0 0 6px">${safe(booking.phone)}</p>` : ""}
    <p style="margin:0 0 6px"><strong>${safe(whenLabel)}</strong></p>
    ${booking.notes ? `<p style="margin:10px 0 0;white-space:pre-wrap">${safe(booking.notes)}</p>` : ""}
    <p style="margin:14px 0 0;font-size:12px;color:#6b6257">The calendar invite is attached. It's also in the platform console under Demos.</p>
  </div>`;
}
