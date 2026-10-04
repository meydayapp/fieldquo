// lib/booking/verifyTravel.js
//
// Google's real driving time, asked once, at the moment a time is BOOKED.
//
// ══ The saving (owner-approved cost saver, 2026-10-03) ═════════════════════
//
// The booking calendar now filters times with the free offline estimate
// (lib/booking/computeAvailability.js travelIndex — straight line × 1.35 at
// 32 km/h). It used to ask Distance Matrix for every distinct address on the
// day, on every month the calendar loaded, for every address the visitor
// typed: about US$105 a month in the heavy case, nearly all of it for times
// nobody booked. Now Google is asked here, for the ONE time being booked:
//
//     leg in   the visit before → this address      1 element
//     leg out  this address    → the visit after     1 element
//
// At US$5 per 1,000 elements that is about one cent per booking, and nothing
// at all for browsing. Results are cached in memory (DRIVE_CACHE_MS) so a
// refusal followed by "book the next time instead" does not pay twice for
// the same two addresses.
//
// ══ Never a silent double-booking ══════════════════════════════════════════
//
// The estimate is a guess. When Google's real drive says the estimator cannot
// make a time the calendar offered (a river with one bridge, a highway that
// isn't one), verifySlotTravel says so, the confirm route refuses the booking
// in plain words, and nextVerifiedSlot offers the first later time that passes
// the SAME Google check — the booker chooses; nothing is booked for them.
//
// ══ Unknown never refuses ══════════════════════════════════════════════════
//
// The rule from lib/booking/travel.js holds here too: no key, Google down, a
// neighbour with no coordinates → travelMinutes falls back to the estimate,
// which is what the calendar offered on, so the time stands. Google can only
// ever take away a time the estimate allowed — never refuse on a failure.
//
// Why memory and not a table: the cache only has to bridge a refusal and the
// retry a minute later, Google's terms limit how long route results may be
// kept, and two elements a booking is too little money to justify a schema.
import { travelMinutes, reachable, hasPoint, slotNeighbours } from "@/lib/booking/travel";
import { loadBusyRanges, computeAvailableSlots } from "@/lib/booking/computeAvailability";
import { serverMapsKey } from "@/lib/measure/roofMeasurement";

export const DRIVE_CACHE_MS = 6 * 60 * 60 * 1000;
export const DRIVE_CACHE_MAX = 500;
// How many later times nextVerifiedSlot will check with Google before it
// gives up and just says "pick another time". Each costs at most two
// elements; three is enough to step past one unreachable neighbour.
export const NEXT_SLOT_CHECKS = 3;
export const NEXT_SLOT_DAYS = 7;

const cache = new Map();

/** For the check script. */
export function clearDriveCache() {
  cache.clear();
}

const key = (a, b) =>
  `${Number(a.lat).toFixed(4)},${Number(a.lng).toFixed(4)}>${Number(b.lat).toFixed(4)},${Number(b.lng).toFixed(4)}`;

/**
 * Driving minutes a → b, Google first, cached; the estimate when Google can't
 * answer (and that is NOT cached, so a later call can still reach Google).
 * Null only without coordinates.
 */
export async function drivingMinutes(a, b, { mapsKey = null, fetchImpl = fetch, now = Date.now() } = {}) {
  if (!hasPoint(a) || !hasPoint(b)) return null;
  const k = key(a, b);
  const hit = cache.get(k);
  if (hit && now - hit.at < DRIVE_CACHE_MS) return { ...hit.value, cached: true };
  const value = await travelMinutes(a, b, { key: mapsKey, fetchImpl });
  if (value?.source === "driving") {
    if (cache.size >= DRIVE_CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(k, { at: now, value });
  }
  return value;
}

/**
 * May this one time be booked, by Google's real drive? PURE apart from the
 * injected `ranges` and `drive` — the check script hands both in.
 *
 * @param ranges       chronological busy ranges ({ start, end, point })
 * @param start/end    the booking's own start and end (Date)
 * @param bufferBefore/bufferAfter  the event type's buffers, minutes
 * @param destination  { lat, lng } of the visit
 * @param travelBuffer company padding, minutes
 * @param drive        async (from, to) → { minutes, source } | null
 * @returns {{ ok, legs: [{ leg, minutes, source, shortBy, known }] }}
 */
export async function judgeSlotTravel({ ranges, start, end, bufferBefore = 0, bufferAfter = 0, destination, travelBuffer = 0, drive }) {
  if (!hasPoint(destination)) return { ok: true, legs: [] };
  const bufferedStart = new Date(new Date(start).getTime() - (Number(bufferBefore) || 0) * 60000);
  const bufferedEnd = new Date(new Date(end).getTime() + (Number(bufferAfter) || 0) * 60000);
  // An overlap is the conflict check's job (the confirm route asks it first);
  // here only the two neighbours matter, exactly as on the calendar.
  const { before, after } = slotNeighbours(ranges, bufferedStart, bufferedEnd);
  const legs = [];
  if (before?.point) {
    const t = await drive(before.point, destination);
    const r = reachable({ previousEnd: before.end, slotStart: bufferedStart, travel: t?.minutes ?? null, buffer: travelBuffer });
    legs.push({ leg: "in", minutes: t?.minutes ?? null, source: t?.source || null, shortBy: r.shortBy, known: r.known, ok: r.ok });
  }
  if (after?.point) {
    const t = await drive(destination, after.point);
    const r = reachable({ previousEnd: bufferedEnd, slotStart: after.start, travel: t?.minutes ?? null, buffer: travelBuffer });
    legs.push({ leg: "out", minutes: t?.minutes ?? null, source: t?.source || null, shortBy: r.shortBy, known: r.known, ok: r.ok });
  }
  return { ok: legs.every((l) => l.ok), legs };
}

/**
 * The booking-time check against the live calendar. `deps` are seams for the
 * check script (loadBusyRanges, mapsKey, fetchImpl).
 */
export async function verifySlotTravel({ eventType, start, end, destination, travelBuffer = 0, exclude = null, deps = {} }) {
  if (!hasPoint(destination)) return { ok: true, legs: [] };
  const load = deps.loadBusyRanges || loadBusyRanges;
  const mapsKey = deps.mapsKey !== undefined ? deps.mapsKey : serverMapsKey();
  const s = new Date(start);
  const ranges = await load({
    eventType,
    busyFrom: new Date(s.getTime() - 86400000),
    busyTo: new Date(s.getTime() + 2 * 86400000),
    exclude,
  });
  return judgeSlotTravel({
    ranges,
    start,
    end,
    bufferBefore: eventType?.bufferBefore || 0,
    bufferAfter: eventType?.bufferAfter || 0,
    destination,
    travelBuffer,
    drive: (a, b) => drivingMinutes(a, b, { mapsKey, fetchImpl: deps.fetchImpl || fetch }),
  });
}

/**
 * The first time after `after` that the calendar offers AND Google's drive
 * allows, or null. At most NEXT_SLOT_CHECKS Google checks, within
 * NEXT_SLOT_DAYS. `eventType` must already carry the mode's length
 * (eventTypeForMode), as the calendar was computed with it.
 */
export async function nextVerifiedSlot({ eventType, after, destination, travelBuffer = 0, exclude = null, minStart = null, deps = {} }) {
  const compute = deps.computeAvailableSlots || computeAvailableSlots;
  const from = new Date(after);
  const fromDate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const toDate = new Date(fromDate.getTime() + NEXT_SLOT_DAYS * 86400000);
  const byDate = await compute({ eventType, fromDate, toDate, destination, travelBuffer, exclude });
  const floor = Math.max(from.getTime(), minStart ? new Date(minStart).getTime() : 0);
  const later = Object.values(byDate || {})
    .flat()
    .filter((iso) => new Date(iso).getTime() > floor)
    .sort();
  const minutes = Number(eventType?.durationMinutes) || 0;
  for (const iso of later.slice(0, NEXT_SLOT_CHECKS)) {
    const s = new Date(iso);
    const verdict = await verifySlotTravel({
      eventType,
      start: s,
      end: new Date(s.getTime() + minutes * 60000),
      destination,
      travelBuffer,
      exclude,
      deps,
    });
    if (verdict.ok) return iso;
  }
  return null;
}

// ── What the booker reads ───────────────────────────────────────────────────
//
// In the visitor's language (the confirm route's three — en, fr, es — as its
// other refusals). The next time itself is formatted by the page, in the
// visitor's own clock, from `nextSlot`; the sentence only says what happened.
const TRAVEL_REFUSAL = {
  en: {
    withNext: "We can't get to you in time for that slot — the visit before or after it is too far away by road. The next time we can make is now selected — use the button below to book it.",
    none: "We can't get to you in time for that slot — the visit before or after it is too far away by road. Please pick another time.",
  },
  fr: {
    withNext: "Nous ne pouvons pas arriver chez vous à temps pour ce créneau : la visite d'avant ou d'après est trop loin par la route. Le prochain moment possible est maintenant sélectionné — réservez-le avec le bouton ci-dessous.",
    none: "Nous ne pouvons pas arriver chez vous à temps pour ce créneau : la visite d'avant ou d'après est trop loin par la route. Veuillez choisir un autre moment.",
  },
  es: {
    withNext: "No podemos llegar a tiempo para ese horario: la visita anterior o posterior está demasiado lejos por carretera. El siguiente horario posible ya está seleccionado — resérvelo con el botón de abajo.",
    none: "No podemos llegar a tiempo para ese horario: la visita anterior o posterior está demasiado lejos por carretera. Elija otro horario, por favor.",
  },
};

export function travelRefusal(language, nextSlot) {
  const copy = TRAVEL_REFUSAL[String(language || "").toLowerCase()] || TRAVEL_REFUSAL.en;
  return nextSlot ? copy.withNext : copy.none;
}
