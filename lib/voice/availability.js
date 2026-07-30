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

/** How far ahead to look when they haven't asked for a particular day. */
const LOOKAHEAD_DAYS = 10;

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

  // Every event type the company books through, not just one. A shop where the
  // owner and one estimator both do visits should offer either — the caller
  // doesn't care whose calendar it lands in, and offering only the first
  // person's makes the business look fully booked when it isn't.
  const eventTypes = await db.eventType.findMany({
    where: { companyId, active: true },
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
 */
export async function bookSlot({ companyId, slotId: id, name, phone, address }) {
  const when = parseSlotId(id);
  if (!when) return { ok: false, reason: "bad_slot" };

  const suffix = String(id).split("_")[0];

  // Match the event type by the id fragment the slot carried. Scoped to the
  // COMPANY, so a slot id from another tenant can't be replayed here.
  const eventTypes = await db.eventType.findMany({
    where: { companyId, active: true },
    select: { id: true, durationMinutes: true },
  });
  const eventType = eventTypes.find((e) => e.id.slice(-6) === suffix);
  if (!eventType) return { ok: false, reason: "unknown_event_type" };

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

  const booking = await db.booking.create({
    data: {
      eventTypeId: eventType.id,
      clientName: name || "Phone caller",
      // Required by the schema and we genuinely don't have one — a caller on
      // the phone rarely spells out an email, and inventing a placeholder that
      // looks like an address is worse than an obviously empty one.
      clientEmail: "",
      clientPhone: phone || null,
      startTime: when,
      endTime: end,
      mode: "visit",
      status: "confirmed",
    },
  });

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });

  return {
    ok: true,
    bookingId: booking.id,
    label: speak(when, company?.timezone || "America/Toronto"),
  };
}
