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

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createScoredLead } from "@/lib/leads/createLead";
import { toE164 } from "@/lib/voice/numbers";
import { cleanPhone, cleanText, normaliseEmail, TOOL_NAMES, SAY_ON_REFUSAL } from "@/lib/voice/tools";
import { recordError } from "@/lib/platform/errorLog";
import { recordConsent } from "@/lib/voice/outbound";
import { photoDestination } from "@/lib/voice/quoteQuestions";
import { MODE_WORDS } from "@/lib/voice/visitPath";
import { verifyRetellSignature, signingKeys } from "@/lib/voice/webhookSignature";
import { recordRejectedDelivery } from "@/lib/voice/webhookHealth";

/**
 * The caller's email, unless it is the company's own.
 *
 * ── A real call, and the record it nearly poisoned ─────────────────────────
 *
 * The agent asked the caller to email photos in and read the address out. The
 * address is the CONTRACTOR's — photoDestination(company), which is
 * Company.email — and it came back on the next save_caller call as the
 * caller's own. Nobody spelled an address out on that call at all.
 *
 * That is not one bad row. Every caller who is read the same address gets the
 * same email, so the client matcher in lib/ai/callQuoteDraft.js — which keys on
 * email precisely because it is the strongest identifier a caller gives — would
 * fold every one of them onto whichever client got there first, and attach a
 * stranger's quote to a real customer's record. That is the exact failure the
 * matcher is built to avoid, arriving through the front door.
 *
 * So the company's own addresses are refused here, at the write, rather than
 * filtered at every read. Returns null, which `update` reads as "leave what is
 * there alone" — an agent misreading an address must not erase a good one.
 */
async function callerEmail(companyId, raw) {
  const email = normaliseEmail(raw);
  if (!email) return null;
  const company = await db.company
    .findUnique({ where: { id: companyId }, select: { email: true } })
    .catch(() => null);
  // photoDestination is the exact string the agent was given to read out, and
  // Company.email is where it comes from. Both are compared because the first
  // can be null while the second is set.
  const ours = new Set(
    [normaliseEmail(company?.email), normaliseEmail(photoDestination(company))].filter(
      Boolean,
    ),
  );
  return ours.has(email) ? null : email;
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

  // Same verifier as /api/voice/webhook, and the same bug lived here: the old
  // hand-rolled compare rejected every real tool call, so the receptionist
  // could take a caller's details mid-call and never once save them. See
  // lib/voice/webhookSignature.js.
  const check = verifyRetellSignature({
    rawBody: raw,
    header: request.headers.get("x-retell-signature"),
    keys: signingKeys(),
  });
  if (!check.ok) {
    await recordRejectedDelivery({
      reason: check.reason,
      endpoint: `/api/voice/tools/${tool}`,
    });
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

  // Theirs, or nothing. See callerEmail — the agent reads the COMPANY's address
  // out loud for photos, and it came back here as the caller's.
  const email = await callerEmail(ctx.companyId, args.email);

  const summary = cleanText(args.summary, 2000);
  const address = cleanText(args.address, 300);
  const urgency = ["emergency", "soon", "planning"].includes(args.urgency)
    ? args.urgency
    : null;

  // ── A callback request, written down rather than only said ──────────────
  //
  // The receptionist's honest fallback is "someone will ring you back", and
  // until now that sentence went nowhere: the lead was created, but nothing on
  // it distinguished a caller waiting for a call from one who just asked a
  // question, and the times they said they were reachable were lost entirely.
  //
  // First line of the message on purpose. Whoever opens the lead reads the top
  // of it, and this is the part with a person's expectation attached.
  const callbackWanted = args.callback_requested === true;
  const preferredTimes = cleanText(args.preferred_times, 200);

  const detail = [
    callbackWanted
      ? `CALLBACK REQUESTED${preferredTimes ? ` — best time: ${preferredTimes}` : ""}`
      : // Kept even without the flag: a caller who volunteered when they're free
        // said something useful, and dropping it because a boolean was missing
        // is how the useful half of a lead disappears.
        preferredTimes
        ? `Best time to reach them: ${preferredTimes}`
        : null,
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
          email: email || undefined,
          // undefined leaves the existing text alone; a string replaces it.
          message,
        },
      })
    : await createScoredLead({
        companyId: ctx.companyId,
        name: name || "Caller",
        phone: toE164(phone),
        email,
        message: message || "— taken by the phone assistant",
        source: "phone_agent",
      });

  // ── "I asked them to email photos" ─────────────────────────────────────
  //
  // A call cannot carry a picture, so the receptionist asks for them by email
  // (lib/voice/prompt.js, and only ever to the company's OWN published address
  // — see photoDestination). Recording that it asked is what lets whoever picks
  // the lead up tell a quote that is deliberately photo-less from one where
  // nobody thought to ask. Whether the photos arrived is answered by
  // `clientPhotos`, never by a second flag that could disagree with them.
  //
  // Stamped once. The agent is told to call this tool repeatedly, and a later
  // call must not move the timestamp — "when did we ask" is the useful fact.
  if (args.photos_requested === true && !lead.photosRequestedAt) {
    const company = await db.company
      .findUnique({ where: { id: ctx.companyId }, select: { email: true } })
      .catch(() => null);
    await db.leadRequest
      .update({
        where: { id: lead.id },
        data: {
          photosRequestedAt: new Date(),
          // Null when the company has published no address — which is also the
          // case in which the agent was never told to ask. Recorded as absent
          // rather than filled in with something plausible.
          photosRequestedTo: photoDestination(company),
        },
      })
      .catch((err) => console.error("[voice/tools] photo request not recorded:", err.message));
  }

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

  // ── The callback is booked HERE, by the server ──────────────────────────
  //
  // Four calls in a row ended with no booking, for four different reasons, and
  // the through-line was always the same: booking depended on the model
  // choosing to call check_availability and then book_visit, and it does not
  // reliably do either. On the last one it never called either tool — it read
  // "Opening hours: Mon – Thu 8:00 a.m. – 5:00 p.m." out of its own prompt,
  // invented "8:00, 8:15 or 8:30" from that line, offered those to the caller,
  // and hung up. Three attempts at fixing that with prompt wording did not.
  //
  // So the discretion is removed. save_caller is the one tool the model calls
  // without fail — it called it TWICE on the call that booked nothing — so the
  // booking hangs off that instead of off a decision. The agent is handed a
  // time it did not choose and reads it out.
  //
  // Bounded deliberately: only a company whose phone books CALLBACKS, only when
  // there is a name and a number to ring, and only once per call. A visit still
  // goes through book_visit, because a visit needs an address and a person
  // agreeing to be in.
  const booked = await autoBookCallback(ctx, { name, phone });

  // What the agent says next. Given explicitly so it doesn't invent a promise —
  // "someone will call you back" is true; "we'll be there tomorrow" is not.
  return NextResponse.json({
    saved: true,
    ...(booked ? { booked: true, at: booked.label } : {}),
    say: booked
      ? `Got it — someone will call you back ${booked.label}.`
      : "Got it — I've passed that on and someone will call you back.",
  });
}

/**
 * Book the next callback slot, without asking the model to decide.
 *
 * Returns { label } when a booking was made, or null — and null is the ordinary
 * case for a visit-only company, a company with no opening hours on file, or a
 * call that already booked something. Never throws: a failure here must not
 * lose the LEAD, which is the thing this endpoint exists to save.
 */
async function autoBookCallback(ctx, { name, phone }) {
  try {
    if (!name || !phone) return null;

    // Already booked on this call — the model calls save_caller more than once
    // and the second one must not book a second slot.
    const call = await db.voiceCall.findUnique({
      where: { id: ctx.id },
      select: { bookingId: true },
    });
    if (call?.bookingId) return null;

    const { visitPolicyFor, bookableSlots, bookSlot } = await import("@/lib/voice/availability");
    const policy = await visitPolicyFor(ctx.companyId);
    // Only where a CALLBACK is what this company's phone arranges. A visit
    // needs an address and somebody agreeing to be in, which is a conversation
    // and belongs in book_visit.
    if (!policy.canBook || policy.bookableModes[0] !== "call") return null;

    const slots = await bookableSlots(ctx.companyId);
    if (!slots.length) return null;

    const result = await bookSlot({
      companyId: ctx.companyId,
      callId: ctx.id,
      slotId: slots[0].id,
      name,
      phone,
      email: null,
      mode: "call",
      reason: "Callback requested on the phone.",
    });
    return result?.ok ? { label: result.label } : null;
  } catch (err) {
    console.error("[voice/tools] auto callback failed:", err?.message);
    return null;
  }
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
    // So the client the appointment lands on is the client the quote drafted
    // from this same call lands on.
    callId: ctx.id,
    slotId: String(args.slot || ""),
    name,
    phone: toE164(phone),
    // Passed through, never trusted: bookSlot refuses a mode the company does
    // not offer and drops the address for anything that is not a visit, so a
    // model that fills `address` in for a phone call cannot get an invented
    // street onto an appointment.
    mode: typeof args.mode === "string" ? args.mode : null,
    address: cleanText(args.address, 300),
    // Why they want it, in their words. Written to Appointment.notes, which is
    // what the estimator reads before they turn up.
    reason: cleanText(args.reason, 1000),
    // Normalised and refused if it isn't one — same guard save_caller uses, so
    // the company's own photo address can never become the client's.
    email: args.email,
  });

  if (!result.ok) {
    // ── "That one's just gone" is only true when it's true ────────────────
    //
    // Every failure used to be reported as a clash, which is a plausible thing
    // to say and, for a visit the company CHARGES for, a false one — the slot
    // is sitting there and the caller has just been told it isn't. They ring
    // back tomorrow and get told the same thing.
    //
    // A fee is refused here rather than collected: taking money is the booking
    // page's job (hold, Stripe session, settle, reconcile) and it already does
    // it properly. So the agent says why and points at the link, which the
    // prompt has already given it — no figure is invented here, because the
    // prompt carries the published one.
    return NextResponse.json({
      booked: false,
      reason: result.reason,
      say: SAY_ON_REFUSAL[result.reason] || SAY_ON_REFUSAL.taken,
    });
  }

  await db.voiceCall.update({
    where: { id: ctx.id },
    data: { bookingId: result.bookingId },
  });

  // What was actually booked, in the words for that mode. "You're booked in"
  // told a caller nothing about whether to expect a knock or a ring, and the
  // tool description above it said "come out" whatever had been arranged.
  // bookSlot reports the mode it wrote, so the sentence and the row agree.
  const what = MODE_WORDS[result.mode]?.booked || MODE_WORDS.visit.booked;

  return NextResponse.json({
    booked: true,
    mode: result.mode,
    // Only promises the letter when one was actually sent. A caller who never
    // gave an email was being told a confirmation was coming, waited for it,
    // and had no way to reach the visit — bookSlot reports which happened
    // rather than leaving the agent to assume the good case.
    say: result.confirmationSent
      ? `Done — ${what} ${result.label}. You'll get a confirmation shortly.`
      : `Done — ${what} ${result.label}. I've put it in the calendar; if you'd like it in writing, give me an email address.`,
  });
}
