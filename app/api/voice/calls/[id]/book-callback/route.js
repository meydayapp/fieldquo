// app/api/voice/calls/[id]/book-callback/route.js
//
// The manual backup: book the callback the assistant didn't.
//
// ── Why a button exists when the server already books ─────────────────────
//
// save_caller books a callback by itself now, which removed the model's
// discretion from the path that kept failing. It does not remove every way a
// call can end without one: the caller hung up before giving a name, the
// company had no opening hours on file that day, the slot was taken between
// the offer and the write, or the assistant never called save_caller at all.
//
// Each of those leaves a lead on the receptionist screen with no time attached
// and a person looking at it who can see, in one glance, that somebody is
// waiting for a call. That person should not have to open the calendar and
// re-key a name and a number.
//
// It books the SAME way the assistant does — bookableSlots and bookSlot, the
// same opening-hours window, the same clash check, the same client matching.
// A second booking path would be the copy that rots.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { bookableSlots, bookSlot, visitPolicyFor } from "@/lib/voice/availability";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same gate the receptionist screen itself takes. Somebody allowed to see the
  // call and ring the person back is the somebody who books the callback.
  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit",
    "book a callback",
  );
  if (denied) return denied;

  // Scoped in the WHERE. A call id from another tenant resolves to nothing
  // rather than to their customer's number.
  const call = await db.voiceCall.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      companyId: true,
      fromE164: true,
      bookingId: true,
      // ── leadId is a COLUMN, not a relation ────────────────────────────
      //
      // Selecting `lead: { … }` here threw PrismaClientValidationError and the
      // whole endpoint 500'd, which the screen reported as "couldn't book the
      // callback". VoiceCall.leadId is deliberately a plain string — the schema
      // says so — so the lead is a second read.
      //
      // Nothing in the build catches this: check-imports resolves modules,
      // check-exports resolves names, and neither knows what a Prisma model
      // looks like. The only thing that finds an invalid select is running it.
      leadId: true,
    },
  });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already has one. Not an error — the thing they wanted is already true, and
  // a second booking would put the same person in the diary twice.
  if (call.bookingId) {
    return NextResponse.json({ booked: false, reason: "already_booked" });
  }

  const lead = call.leadId
    ? await db.leadRequest.findFirst({
        // Re-scoped. The id came off a row that was already scoped, and asking
        // again costs nothing.
        where: { id: call.leadId, companyId: member.companyId },
        select: { name: true, phone: true, email: true, message: true },
      })
    : null;

  // A number to ring. The lead's own is preferred over caller ID: somebody who
  // asked to be rung on a different phone gave that number for a reason.
  const phone = lead?.phone || call.fromE164;
  if (!phone) return NextResponse.json({ booked: false, reason: "no_phone" }, { status: 409 });

  const policy = await visitPolicyFor(call.companyId);
  if (!policy.canBook || policy.bookableModes[0] !== "call") {
    // A visit is not something to arrange from a screen without an address, and
    // a company with nothing bookable has nothing to offer.
    return NextResponse.json({ booked: false, reason: "not_callbacks" }, { status: 409 });
  }

  const slots = await bookableSlots(call.companyId);
  if (!slots.length) {
    // Almost always opening hours: a company that has never set them is offered
    // nothing, deliberately. The screen says which so it is fixable.
    return NextResponse.json({ booked: false, reason: "no_times" }, { status: 409 });
  }

  const result = await bookSlot({
    companyId: call.companyId,
    callId: call.id,
    slotId: slots[0].id,
    name: lead?.name || "Phone caller",
    phone,
    email: lead?.email || null,
    mode: "call",
    reason: lead?.message || "Callback booked by hand from the call.",
  });

  if (!result?.ok) {
    return NextResponse.json({ booked: false, reason: result?.reason || "failed" }, { status: 409 });
  }

  await recordActivity(member, {
    action: "voice.callback.booked",
    entityType: "voice_call",
    entityId: call.id,
    summary: `Booked a callback for ${lead?.name || "a caller"} — ${result.label}`,
  });

  return NextResponse.json({ booked: true, at: result.label, bookingId: result.bookingId });
}
