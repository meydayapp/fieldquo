// lib/demo/slots.js
//
// The bookable slots for a FieldQuo product demo: 30 minutes, 6:00–10:00pm
// America/Toronto, for the next two weeks. Toronto observes DST, so "6pm
// Eastern" is a different UTC instant in July than in January — the offset math
// below is the whole reason this file exists rather than a naive `+18h`.
//
// Slots are computed server-side and the booking route re-checks that a
// submitted time is one of them, so a client can't book 3am or a time we don't
// offer by posting a hand-crafted timestamp.

export const DEMO_TZ = "America/Toronto";
export const SLOT_MINUTES = 30;

const START_HOUR = 18; // 6:00pm
const SLOTS_PER_DAY = 8; // 6:00, 6:30 … 9:30pm — the last runs 9:30–10:00pm
const DAYS_AHEAD = 14;
const LEAD_MS = 2 * 60 * 60 * 1000; // nothing bookable within the next 2 hours

// The offset (ms) of `tz` at a given UTC instant. Derived from Intl rather than
// hardcoded, so DST is always correct without a timezone database of our own.
function tzOffsetMs(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  // Intl renders midnight as "24" in some engines; normalise to 0.
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  return asUTC - utcMs;
}

// The UTC instant for a wall-clock time (Y-M-D H:M) IN `tz`. Two correction
// passes settle the DST edge cases; away from the twice-a-year transition the
// first pass is already exact.
export function zonedTimeToUtc(y, m, d, hh, mm, tz = DEMO_TZ) {
  let ms = Date.UTC(y, m - 1, d, hh, mm, 0);
  for (let i = 0; i < 2; i++) ms = Date.UTC(y, m - 1, d, hh, mm, 0) - tzOffsetMs(ms, tz);
  return new Date(ms);
}

// The calendar Y/M/D that a UTC instant falls on IN `tz`.
function tzYmd(utcMs, tz = DEMO_TZ) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day };
}

function slotStartsForDay(y, m, d) {
  const out = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const mins = i * SLOT_MINUTES;
    out.push(zonedTimeToUtc(y, m, d, START_HOUR + Math.floor(mins / 60), mins % 60));
  }
  return out;
}

// Every slot start (Date) from now through DAYS_AHEAD, in chronological order,
// excluding anything inside the lead window. The set the booking route validates
// against.
export function generateSlots(now = new Date()) {
  const today = tzYmd(now.getTime());
  // Anchor on local noon so adding whole days can't slip across a DST boundary
  // into the previous/next calendar day.
  const noonAnchor = zonedTimeToUtc(today.y, today.m, today.d, 12, 0).getTime();
  const cutoff = now.getTime() + LEAD_MS;

  const slots = [];
  for (let offset = 0; offset <= DAYS_AHEAD; offset++) {
    const { y, m, d } = tzYmd(noonAnchor + offset * 24 * 60 * 60 * 1000);
    for (const start of slotStartsForDay(y, m, d)) {
      if (start.getTime() >= cutoff) slots.push(start);
    }
  }
  return slots;
}

// True when `iso` is one of the slots we currently offer. The booking route's
// guard against a hand-posted timestamp.
export function isOfferedSlot(iso, now = new Date()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return generateSlots(now).some((s) => s.getTime() === t);
}

// Slots grouped by local day, each with display labels, for the picker UI.
// `booked` is a Set of ISO strings already taken.
export function availableSlotsByDay(now = new Date(), booked = new Set()) {
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TZ, weekday: "short", month: "short", day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TZ, hour: "numeric", minute: "2-digit", hour12: true,
  });

  const days = new Map();
  for (const start of generateSlots(now)) {
    const iso = start.toISOString();
    if (booked.has(iso)) continue;
    const dayKey = dayFmt.format(start);
    if (!days.has(dayKey)) days.set(dayKey, { day: dayKey, slots: [] });
    days.get(dayKey).slots.push({ iso, label: timeFmt.format(start) });
  }
  return [...days.values()].filter((d) => d.slots.length > 0);
}
