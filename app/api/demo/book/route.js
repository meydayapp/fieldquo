// app/api/demo/book/route.js
//
// Public: books a FieldQuo product demo from the marketing homepage. Creates a
// DemoBooking (FieldQuo's own sales calendar, not a tenant's), then emails a
// confirmation to the prospect and a heads-up to the superadmin(s) — both with a
// calendar (.ics) invite so it lands on everyone's calendar
// (lib/demo/bookingEmails.js, shared with the sales walkthrough).
//
// Three guards keep it honest: a per-IP throttle (the endpoint is public and
// every booking emails two people), the submitted time must be one a host
// genuinely offers (hostsFreeAt re-derives it from their stated hours and their
// calendar — a hand-posted 3am timestamp is rejected), and the DB's unique
// constraint on (hostAdminId, scheduledAt) settles the race where two prospects
// grab the same slot between the check and the write.
//
// The host is assigned here, server-side. The browser never names one — it
// posts a time, and the least-loaded free host takes it (see pickHost). That
// keeps the picker honest as a union: a prospect books "a demo", not a person.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { loadDemoHosts } from "@/lib/demo/hosts";
import { hostsFreeAt, pickHost } from "@/lib/demo/slots";
import { sendBookingConfirmation, sendHostHeadsUp } from "@/lib/demo/bookingEmails";

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
  const hosts = await loadDemoHosts(now);
  const free = hostsFreeAt(hosts, slot, now);
  if (free.length === 0) {
    // Covers all three: a time nobody offers, a time everyone free has since
    // filled, and a hand-posted timestamp that was never on the grid.
    return bad("That time isn't available anymore — please pick another slot.");
  }
  const host = pickHost(free);
  const scheduledAt = new Date(slot);

  let booking;
  try {
    booking = await db.demoBooking.create({
      data: {
        name, email, companyName, phone, notes, scheduledAt,
        hostAdminId: host.adminId,
        source: String(body?.source || "hero").slice(0, 40),
      },
    });
  } catch {
    // Unique violation on (hostAdminId, scheduledAt) → that host was taken
    // between the check and the write. The prospect picks again rather than
    // being silently moved to a colleague: a retry re-runs the whole check and
    // will land on whoever is genuinely still free.
    return bad("Someone just booked that slot — please pick another.", 409);
  }

  // Emails are best-effort: the booking is saved, so a mail hiccup must not make
  // the prospect think it failed and book twice. The two emails live in
  // lib/demo/bookingEmails.js now, shared with the sales walkthrough; what
  // they say and whom they reach is unchanged.
  try {
    await sendBookingConfirmation(booking, { kind: "demo" });
    await sendHostHeadsUp(booking, host.email, { kind: "demo" });
  } catch (err) {
    console.error("[demo book] email send failed:", err.message);
  }

  return NextResponse.json({ ok: true, scheduledAt: scheduledAt.toISOString() });
}
