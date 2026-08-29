// lib/voice/availability.js
//
// Real bookable times, for the phone agent.
//
// ── It reuses the booking engine, it does not reimplement it ───────────────
//
// `computeAvailableSlots` already knows about weekly schedules, existing
// bookings, buffers, and — importantly — approved leave. A second availability
// calculation for the phone would drift from the web one, and the drift shows
// up as a stranger in a driveway waiting for somebody who booked the day off.
//
// What this file adds is only the translation between that engine and a
// conversation: fewer options, spoken labels, and a slot id the agent can hand
// back without having to carry a timestamp through a phone call.
import { db } from "@/lib/db";
import { computeAvailableSlots } from "@/lib/booking/computeAvailability";
import { effectiveBookingFeeCents } from "@/lib/booking/fee";
import { visitPolicy, offeredModes } from "./visitPath";

/** How far ahead to look when they haven't asked for a particular day. */
const LOOKAHEAD_DAYS = 10;

/** The EventType columns visitPolicy() needs to price a booking. */
const POLICY_SELECT = {
  id: true,
  name: true,
  active: true,
  feeCents: true,
  promoFeeCents: true,
  promoActive: true,
};

/**
 * Which of the four visit paths this company's receptionist is on, from the
 * database.
 *
 * ── Why the loader lives here and not in visitPath.js ─────────────────────
 *
 * visitPath.js is kept pure so scripts/check-voice-visit.mjs can drive every
 * branch of it without a database — that is where the real bugs get found. This
 * is the one query that feeds it, and it is written once: lib/voice/provision.js
 * builds the PROMPT from it and this file decides which slots may be OFFERED
 * from it. Two queries would be two chances for the agent to be told it can book
 * something the availability endpoint refuses to show, which is the exact shape
 * of "a control that appears to work and doesn't".
 *
 * @param origin       absolute origin, so a booking link can be built. Omit when
 *                     the caller only needs to know what is bookable — the link
 *                     is the only part that depends on it.
 * @param canTransfer  a dialable transfer destination exists
 */
export async function visitPolicyFor(companyId, { origin = null, canTransfer = false } = {}) {
  const [company, eventTypes] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        // What a fee costs and whether it can be collected at all — see
        // effectiveBookingFeeCents, which falls a paid type back to free when
        // the company cannot take card payments.
        stripeChargesEnabled: true,
        currency: true,
        // How this company is willing to meet somebody. It no longer decides
        // WHETHER the phone may book — a free appointment is bookable in any
        // mode the company offers, see visitPolicy — but it decides which mode
        // is written on the booking, whether an address is wanted, and what the
        // agent is allowed to say it has arranged.
        bookingModes: true,
        bookingSlug: true,
        slug: true,
      },
    }),
    db.eventType.findMany({
      where: { companyId, active: true },
      select: POLICY_SELECT,
      take: 20,
    }),
  ]);

  // bookingSlug first, the same order findBookingCompany() resolves them in — a
  // company that chose a custom booking slug has an agent reading out the URL
  // they actually published.
  const slug = company?.bookingSlug || company?.slug || null;

  return visitPolicy({
    company: company || {},
    eventTypes,
    canTransfer,
    bookingUrl: origin && slug ? `${origin}/book/${slug}` : null,
  });
}

/**
 * A slot id the model can repeat back without mangling it.
 *
 * Deliberately opaque and short. A model asked to carry
 * "2026-08-04T13:30:00.000Z" through three conversational turns will drop the
 * milliseconds or shift the timezone about a third of the time; a token it
 * treats as a word survives. It also means a caller can't invent one.
 */
function slotId(eventTypeId, iso) {
  return `${eventTypeId.slice(-6)}_${Date.parse(iso)}`;
}

function parseSlotId(id) {
  const [, ms] = String(id || "").split("_");
  const t = Number(ms);
  return Number.isFinite(t) && t > 0 ? new Date(t) : null;
}

/** "Tuesday morning at half nine" beats "2026-08-04T09:30Z" on a phone call. */
function speak(date, timeZone) {
  const day = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
  const time = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
  return `${day} at ${time}`;
}

/**
 * Slots this company could actually honour.
 *
 * @param preferredDate  YYYY-MM-DD, or null for "the next few"
 * @returns [{ id, iso, label }]
 */
export async function bookableSlots(companyId, preferredDate = null) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timeZone = company?.timezone || "America/Toronto";

  // ── Only what the phone is allowed to take ──────────────────────────────
  //
  // This used to be every active event type. That meant a company charging a
  // $79 diagnostic visit had its receptionist offering those slots and booking
  // them as CONFIRMED, free, with no Stripe session — while their own booking
  // page put the identical slot behind a pending_payment hold. The fee was not
  // waived, it was simply never collected, and nothing on either side said so.
  //
  // visitPolicyFor is the one place that decides, and it is the same answer the
  // prompt was built from, so the agent is never told it can book something
  // this endpoint then declines to offer.
  const policy = await visitPolicyFor(companyId);
  if (!policy.canBook) return [];
  const allowed = new Set(policy.bookableEventTypeIds);

  // Every event type the company books through, not just one. A shop where the
  // owner and one estimator both do visits should offer either — the caller
  // doesn't care whose calendar it lands in, and offering only the first
  // person's makes the business look fully booked when it isn't.
  const eventTypes = await db.eventType.findMany({
    where: { companyId, active: true, id: { in: [...allowed] } },
    take: 5,
  });
  if (!eventTypes.length) return [];

  const from = preferredDate ? new Date(`${preferredDate}T00:00:00Z`) : new Date();
  if (Number.isNaN(from.getTime())) return [];
  const to = new Date(from.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const found = [];
  for (const eventType of eventTypes) {
    let byDate = {};
    try {
      byDate = await computeAvailableSlots({ eventType, fromDate: from, toDate: to });
    } catch {
      // One broken calendar must not silence the others. A company with two
      // estimators shouldn't lose all availability because one has a malformed
      // schedule row.
      continue;
    }
    for (const [, slots] of Object.entries(byDate || {})) {
      for (const iso of slots || []) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()) || date <= new Date()) continue;
        found.push({
          id: slotId(eventType.id, iso),
          eventTypeId: eventType.id,
          iso,
          at: date.getTime(),
          label: speak(date, timeZone),
        });
      }
    }
  }

  // Soonest first, and de-duplicated by the minute: two estimators free at the
  // same time is one option to the caller, not two.
  const seen = new Set();
  return found
    .sort((a, b) => a.at - b.at)
    .filter((s) => {
      if (seen.has(s.at)) return false;
      seen.add(s.at);
      return true;
    })
    .slice(0, 6)
    .map(({ id, iso, label }) => ({ id, iso, label }));
}

/**
 * Take a slot.
 *
 * Re-checked at booking time rather than trusted from when it was offered. Two
 * callers can be told about the same slot seconds apart — one on the phone, one
 * on the website — and the second must not be promised it. The agent is given a
 * sentence to say when that happens.
 *
 * ── It creates an Appointment, and that is the point ──────────────────────
 *
 * This used to write a bare Booking row and stop. The slot really was taken —
 * computeAvailableSlots counts bookings, so nobody else could have it — but the
 * contractor's CALENDAR is built from Appointment + JobVisit
 * (lib/schedule/jobVisits.js, /api/appointments), and a Booking is only reached
 * there through `appointment.booking`. So a visit the phone agent booked
 * appeared on the dashboard and the calendar nowhere at all: one line on
 * /app/schedule for managers, within fourteen days, showing a time and the
 * words "Phone caller". Somebody was expected in a driveway and the only person
 * who knew was the caller.
 *
 * The `address` argument was worse than missing: it was accepted, documented,
 * and thrown away. The crew got no street to drive to.
 *
 * So this now does what the public booking route does — find-or-create the
 * client, geocode the address, create the appointment, link it, and hand off to
 * finalizeBooking for the manage token, the consent record and the reminder.
 * One difference, and it is deliberate: no confirmation email, because a caller
 * on the phone rarely spells out an address and inventing one is worse than
 * having none. finalizeBooking skips the send when there is nothing to send to.
 */
export async function bookSlot({ companyId, slotId: id, name, phone, address, mode = null }) {
  const when = parseSlotId(id);
  if (!when) return { ok: false, reason: "bad_slot" };

  const suffix = String(id).split("_")[0];

  // Match the event type by the id fragment the slot carried. Scoped to the
  // COMPANY, so a slot id from another tenant can't be replayed here.
  //
  // The company is read alongside rather than after, because the fee check
  // below needs both: whether this event type charges depends on the company's
  // Stripe state as much as on the event type's own column.
  const [eventTypes, company] = await Promise.all([
    db.eventType.findMany({
      where: { companyId, active: true },
      select: {
        id: true,
        durationMinutes: true,
        // Whose calendar this lands on. The appointment is assigned to them, the
        // same as the public booking route does — an appointment with no owner
        // sits on nobody's day.
        userId: true,
        name: true,
        location: true,
        ...POLICY_SELECT,
      },
    }),
    db.company.findUnique({ where: { id: companyId } }),
  ]);
  if (!company) return { ok: false, reason: "unknown_company" };
  const eventType = eventTypes.find((e) => e.id.slice(-6) === suffix);
  if (!eventType) return { ok: false, reason: "unknown_event_type" };

  // ── Re-checked here, not just when the slot was offered ─────────────────
  //
  // bookableSlots already refuses to show a paid visit, and the prompt already
  // says the agent cannot take one. Neither is a guarantee: the slot id is a
  // six-character event-type fragment plus a timestamp, the caller can hear it
  // read out, and a fee can be switched on between the offer and the booking.
  // Filtering what is DISPLAYED is not access control — the same reason
  // impersonation is gated twice — and the thing on the other side of this
  // check is a $79 charge that would silently never be made.
  //
  // Refused rather than converted into a payment link: taking money is the
  // booking page's job, and it already does it properly (hold, Stripe session,
  // settle, reconcile). The agent reads the caller the link instead.
  const { feeCents } = effectiveBookingFeeCents(company, eventType);
  if (feeCents > 0) return { ok: false, reason: "fee_due" };

  // ── Which mode, decided here rather than taken from the agent ───────────
  //
  // This wrote `mode: "visit"` unconditionally, which was harmless while only
  // visit-offering companies could book at all and is not now. The model's
  // choice is honoured only when the company actually offers it; anything else
  // falls to the first mode they DO offer, because a booking in a mode the
  // company does not do is a person waiting for a knock that was never coming.
  const offered = offeredModes(company);
  const bookedMode = offered.includes(mode) ? mode : offered[0];
  // An address is a fact about an in-person visit. Asking a caller to spell
  // their street out to arrange a phone call is the sort of thing that makes an
  // assistant feel broken, and storing one anyway would put a driving
  // destination on an appointment nobody is driving to.
  const wantsAddress = bookedMode === "visit";

  const durationMin = eventType.durationMinutes || 60;
  const end = new Date(when.getTime() + durationMin * 60 * 1000);

  // Still free? Anything overlapping counts, not just an exact start match — a
  // 30-minute booking starting fifteen minutes into this slot blocks it just as
  // thoroughly.
  const clash = await db.booking.findFirst({
    where: {
      eventTypeId: eventType.id,
      status: { not: "cancelled" },
      startTime: { lt: end },
      endTime: { gt: when },
    },
    select: { id: true },
  });
  if (clash) return { ok: false, reason: "taken" };

  const clientName = name || "Phone caller";
  const visitAddress =
    wantsAddress && typeof address === "string" && address.trim()
      ? address.trim()
      : null;

  // Match before creating, the same way lead conversion does — a repeat caller
  // must not spawn a second client record every time they ring.
  let client = phone
    ? await db.client.findFirst({
        where: { companyId, phone },
        select: { id: true },
      })
    : null;
  if (!client) {
    client = await db.client.create({
      data: {
        companyId,
        name: clientName,
        // Null, not "". A caller on the phone rarely spells out an email, and
        // an empty string reads as "we asked and they have none" while null
        // reads as "nobody asked" — which is the true one.
        email: null,
        phone: phone || null,
        address: visitAddress,
      },
      select: { id: true },
    });
  }

  // Geocoded so the scheduler can tell whether the estimator can physically get
  // there from their previous job. A failure stores the street with null
  // coordinates, which travel filtering reads as "unknown" and never as the
  // middle of the ocean.
  let point = null;
  if (visitAddress) {
    try {
      const { geocodeAddress } = await import("@/lib/measure/roofMeasurement");
      const hit = await geocodeAddress(visitAddress);
      if (hit) point = { lat: hit.lat, lng: hit.lng };
    } catch {
      point = null;
    }
  }

  const appointment = await db.appointment.create({
    data: {
      companyId,
      clientId: client.id,
      scheduledAt: when,
      // Where the van goes. eventType.location is a label ("On-site visit"),
      // not a destination — same fallback order as the public booking route.
      // Null for a call or a video meeting: `location` is where the van goes,
      // and eventType.location is a label ("On-site visit") that would read as
      // a destination on an appointment that has none.
      location: wantsAddress ? visitAddress || eventType.location || null : null,
      ...(point && { latitude: point.lat, longitude: point.lng }),
      status: "scheduled",
      createdById: eventType.userId,
      assignedToId: eventType.userId,
    },
  });

  const booking = await db.booking.create({
    data: {
      eventTypeId: eventType.id,
      clientName,
      // Required by the schema and we genuinely don't have one. Empty rather
      // than a placeholder that looks like an address — finalizeBooking reads
      // it and skips the confirmation letter rather than mailing nowhere.
      clientEmail: "",
      clientPhone: phone || null,
      startTime: when,
      endTime: end,
      mode: bookedMode,
      status: "confirmed",
      address: visitAddress,
      ...(point && { latitude: point.lat, longitude: point.lng }),
      appointmentId: appointment.id,
    },
  });

  // The manage token, the consent record and the day-before reminder call —
  // shared with both web paths so the three can't drift. Best-effort by
  // contract: the visit is booked, and the caller is still on the line.
  try {
    const { finalizeBooking } = await import("@/lib/booking/finalizeBooking");
    await finalizeBooking({ company, eventType, booking, clientId: client.id });
  } catch (err) {
    console.error("[voice] booking follow-up failed:", err?.message);
  }

  return {
    ok: true,
    bookingId: booking.id,
    appointmentId: appointment.id,
    // Whether the caller will actually get anything in writing. The agent says
    // "you'll get a confirmation shortly" off the back of this, and it was
    // saying it to people who were never sent one.
    confirmationSent: Boolean(booking.clientEmail),
    // What was actually booked, so the agent's closing sentence names the same
    // thing the row does. It read "you're booked in" with no mode in it while
    // the tools said "come out"; a caller told somebody is driving over to a
    // phone call is the failure a customer notices first.
    mode: bookedMode,
    label: speak(when, company?.timezone || "America/Toronto"),
  };
}
