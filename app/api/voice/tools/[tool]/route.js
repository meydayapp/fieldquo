// app/api/voice/tools/[tool]/route.js
//
// The receptionist doing something, mid-call.
//
//   save-caller   create or update the LeadRequest for this call
//   availability  real bookable slots
//   book          take one of them
//
// ── Public, and bound to a call ────────────────────────────────────────────
//
// Retell posts here server-to-server, so there's no session. Two things stand
// in for one:
//
//   1. The shared secret, checked the same way as the main webhook.
//   2. The CALL ID. Every payload carries it; we look it up to find the number,
//      and the number tells us the company. Nothing in the body is trusted to
//      name a tenant — the agent is talking to a stranger, and a stranger who
//      works out the shape of these endpoints must not be able to write into
//      somebody else's account.
//
// A call id that isn't in our table is refused. That also means a tool call
// arriving before call_started — which happens, the events race — is rejected
// rather than silently writing an orphan lead.
export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createScoredLead } from "@/lib/leads/createLead";
import { toE164 } from "@/lib/voice/numbers";
import { cleanPhone, cleanText, TOOL_NAMES } from "@/lib/voice/tools";
import { recordError } from "@/lib/platform/errorLog";
import { recordConsent } from "@/lib/voice/outbound";

function verify(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** The call, the number and the company — or null. */
async function contextFor(callId) {
  if (!callId) return null;
  const call = await db.voiceCall.findUnique({
    where: { providerCallId: String(callId) },
    select: {
      id: true,
      companyId: true,
      fromE164: true,
      leadId: true,
      number: { select: { agentId: true } },
    },
  });
  return call || null;
}

export async function POST(request, { params }) {
  const { tool } = await params;
  const raw = await request.text();

  if (!verify(raw, request.headers.get("x-retell-signature"), process.env.RETELL_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOOL_NAMES.includes(tool)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  // Retell nests the model's arguments under `args` and the call under `call`.
  const args = body?.args || body?.arguments || {};
  const callId = body?.call?.call_id || body?.call_id;

  const ctx = await contextFor(callId);
  if (!ctx) {
    return NextResponse.json(
      // Spoken back to the caller, so it's a sentence rather than a code.
      { error: "I couldn't save that just now." },
      { status: 404 },
    );
  }

  try {
    if (tool === "save-caller") return await saveCaller(ctx, args);
    if (tool === "availability") return await availability(ctx, args);
    if (tool === "book") return await book(ctx, args);
  } catch (err) {
    await recordError({
      area: "voice_tool",
      message: `Voice tool "${tool}" failed: ${err.message}`,
      detail: { callId, companyId: ctx.companyId },
    }).catch(() => {});
    // The agent reads this out. "Something went wrong" mid-call is better than
    // silence, and far better than the agent believing it succeeded.
    return NextResponse.json(
      { error: "I couldn't save that — someone will call you back." },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
}

/* ─────────────────────────────── save-caller ───────────────────────────── */

async function saveCaller(ctx, args) {
  const name = cleanText(args.name, 200);
  // Falls back to caller ID. The model asking twice for a number we already
  // have is the most annoying thing a phone robot does, and the number they're
  // calling from is usually the right one.
  const phone = cleanPhone(args.phone) || ctx.fromE164;

  // A phone number alone is a usable lead — caller ID gives us one even when
  // they've said nothing. A call with neither is not.
  if (!name && !phone) {
    return NextResponse.json({ error: "I need a name or a number." }, { status: 400 });
  }

  const summary = cleanText(args.summary, 2000);
  const address = cleanText(args.address, 300);
  const urgency = ["emergency", "soon", "planning"].includes(args.urgency)
    ? args.urgency
    : null;

  const detail = [
    address ? `Address: ${address}` : null,
    urgency ? `Urgency: ${urgency}` : null,
    summary,
  ].filter(Boolean);

  // ── Only overwrite with something ──────────────────────────────────────
  //
  // The agent is told to save early and call again as it learns more, so a
  // later call can legitimately carry LESS than the first — it might only be
  // confirming a spelling. Writing an empty message on top of a good one erases
  // the detail that made the lead worth following up, and nobody notices,
  // because the lead still looks filled in.
  //
  // Caught by a probe that called save-caller with nothing after a real
  // emergency: the emergency vanished and the lead read as a blank enquiry.
  const message = detail.length
    ? [...detail, "— taken by the phone assistant"].join("\n")
    : undefined;

  // Updated in place when the agent calls this twice in one call, which it is
  // told to do. A second row for the same caller is a duplicate somebody has to
  // spot and merge.
  const lead = ctx.leadId
    ? await db.leadRequest.update({
        where: { id: ctx.leadId },
        data: {
          name: name || undefined,
          phone: toE164(phone) || undefined,
          email: cleanText(args.email, 200) || undefined,
          // undefined leaves the existing text alone; a string replaces it.
          message,
        },
      })
    : await createScoredLead({
        companyId: ctx.companyId,
        name: name || "Caller",
        phone: toE164(phone),
        email: cleanText(args.email, 200),
        message: message || "— taken by the phone assistant",
        source: "phone_agent",
      });

  // They rang US, which is about as clear a request to be reachable as there
  // is — but it still needs a row, or a call BACK would be refused by the same
  // gate that stops cold calling. The consent is the inbound call itself.
  if (phone) {
    await recordConsent({
      companyId: ctx.companyId,
      phone,
      source: "manual",
      note: "Called in and left their details with the assistant",
      leadId: lead.id,
    }).catch((err) => console.error("[voice/tools] consent not recorded:", err));
  }

  await db.voiceCall.update({
    where: { id: ctx.id },
    data: {
      leadId: lead.id,
      // An emergency is the one thing on a call that can't wait for someone to
      // work through the list in the morning. Only ever SET, never cleared — a
      // later, calmer tool call must not un-flag a call that mentioned a flood.
      needsReview: urgency === "emergency" ? true : undefined,
    },
  });

  // What the agent says next. Given explicitly so it doesn't invent a promise —
  // "someone will call you back" is true; "we'll be there tomorrow" is not.
  return NextResponse.json({
    saved: true,
    say: "Got it — I've passed that on and someone will call you back.",
  });
}

/* ────────────────────────────── availability ───────────────────────────── */

async function availability(ctx, args) {
  const { bookableSlots } = await import("@/lib/voice/availability");
  const slots = await bookableSlots(ctx.companyId, args.preferred_date);

  if (!slots.length) {
    return NextResponse.json({
      slots: [],
      say: "I haven't got anything to offer right now — let me take your details and someone will ring you back with times.",
    });
  }

  // Three at most. A voice agent reading eight options is unlistenable, and the
  // caller remembers none of them.
  const offered = slots.slice(0, 3);
  return NextResponse.json({
    slots: offered,
    say: `I can do ${offered.map((s) => s.label).join(", or ")}. Which suits?`,
  });
}

/* ────────────────────────────────── book ──────────────────────────────── */

async function book(ctx, args) {
  const { bookSlot } = await import("@/lib/voice/availability");
  const name = cleanText(args.name, 200);
  const phone = cleanPhone(args.phone) || ctx.fromE164;

  const result = await bookSlot({
    companyId: ctx.companyId,
    slotId: String(args.slot || ""),
    name,
    phone: toE164(phone),
    address: cleanText(args.address, 300),
  });

  if (!result.ok) {
    // Re-checked at booking time, not just when offered. Two callers can be
    // told about the same slot seconds apart, and the second one must not be
    // promised it.
    return NextResponse.json({
      booked: false,
      say: "That one's just gone. Would another time work?",
    });
  }

  await db.voiceCall.update({
    where: { id: ctx.id },
    data: { bookingId: result.bookingId },
  });

  return NextResponse.json({
    booked: true,
    // Only promises the letter when one was actually sent. A caller who never
    // gave an email was being told a confirmation was coming, waited for it,
    // and had no way to reach the visit — bookSlot reports which happened
    // rather than leaving the agent to assume the good case.
    say: result.confirmationSent
      ? `Done — you're booked in for ${result.label}. You'll get a confirmation shortly.`
      : `Done — you're booked in for ${result.label}. I've put it in the calendar; if you'd like it in writing, give me an email address.`,
  });
}
