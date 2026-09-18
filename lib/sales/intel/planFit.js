// lib/sales/intel/planFit.js
//
// BBB's employee band → the FieldQuo plan that band most likely fits.
//
// ══ What this is, and is not ═══════════════════════════════════════════════
//
// A rep opening a card wants one number to anchor the pitch on: "a shop that
// size is a Crew plan, a hundred and sixty-nine a month". BBB gives a BAND
// ("6-10"), self-reported by the business when it registered with BBB — not
// counted by anyone, and possibly years old — so every sentence this writes
// says "about", says "per BBB", and says the count is the business's own.
// It is a fact about what BBB holds and a guess about the plan; the card
// prints both halves and the script prompt is told which is which.
//
// ══ The split ══════════════════════════════════════════════════════════════
//
// A plan is seats plus crew, and a headcount alone does not say which are
// which (lib/pricing/ladder.js: a seat is read off the permission grid).
// The ladder's own proportions are the only defensible guess: Solo is 1 of
// 6, Crew 3 of 11, Shop 6 of 17, Scale 10 of 25 — about one seat in three.
// So the band's UPPER bound is split one seat per three people (rounded
// DOWN, never below one — a crew of ten is three in the office and seven in
// the vans, which is the owner's own reading: "6–10 employees → Crew"; the
// rest crew) and handed to tierFor(), which is the same function that
// prices a real roster. Above Scale that is a custom size ("Custom,
// about 23 seats"); above a hundred people it is a conversation, and the
// sentence says so rather than naming a plan we do not sell.
//
// Pure: every band BBB uses is executed by scripts/check-plan-fit.mjs.

import { tierFor, SEAT_LADDER } from "@/lib/pricing/ladder";

/** People per seat, from the ladder's own proportions. */
export const PEOPLE_PER_SEAT = 3;

/**
 * "6-10" → { min: 6, max: 10 }; "201+" → { min: 201, max: null };
 * "1" → { min: 1, max: 1 }. Null for anything that is not a band —
 * a blank, a word, a negative — so an unknown says nothing.
 */
export function parseEmployeeRange(raw) {
  const s = String(raw ?? "").trim().replace(/\s+/g, "").replace(/[–—]/g, "-");
  if (!s) return null;
  let m = /^(\d+)\+$/.exec(s);
  if (m) return { min: Number(m[1]), max: null };
  m = /^(\d+)-(\d+)$/.exec(s);
  if (m) {
    const min = Number(m[1]);
    const max = Number(m[2]);
    return min > 0 && max >= min ? { min, max } : null;
  }
  m = /^(\d+)$/.exec(s);
  if (m) return Number(m[1]) > 0 ? { min: Number(m[1]), max: Number(m[1]) } : null;
  return null;
}

/** The ladder's split of a headcount: one seat in three, the rest crew. */
export function splitPeople(people) {
  const n = Math.max(1, Math.floor(Number(people) || 0));
  const seats = Math.max(1, Math.floor(n / PEOPLE_PER_SEAT));
  return { seats, crew: n - seats };
}

const money = (n) => `$${Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;

function describe(tier) {
  if (!tier) return null;
  return tier.custom
    ? `a custom plan, about ${tier.seats} seats (${money(tier.price)}: ${tier.seats} seats, ${tier.crewSeats} crew)`
    : `the ${tier.label} plan (${money(tier.price)}: ${tier.seats} ${tier.seats === 1 ? "seat" : "seats"}, ${tier.crewSeats} crew)`;
}

/**
 * The plan a BBB band most likely fits.
 *
 * @returns {null | {
 *   range: string,             the band as BBB wrote it, with an en dash
 *   people: number,            the bound the plan was sized on
 *   seats, crew: number,       the split of that bound
 *   kind: "ladder"|"custom"|"straddles"|"beyond",
 *   tier: object|null,         the tierFor() result the sentence names
 *   sentence: string,          the rep-facing line, with the caveat
 *   note: string,              the caveat on its own, for a footnote
 * }}
 */
export function planFitForRange(raw) {
  const band = parseEmployeeRange(raw);
  if (!band) return null;
  const range = band.max === null ? `${band.min}+` : band.min === band.max ? `${band.min}` : `${band.min}–${band.max}`;
  const employees = band.max === 1 ? "employee" : "employees";
  const note = "the employee count is what the business reported to BBB, not a count";
  const top = SEAT_LADDER[SEAT_LADDER.length - 1];

  const atMax = band.max === null ? null : tierFor(splitPeople(band.max));
  const atMin = tierFor(splitPeople(band.min));

  if (band.max !== null && atMax) {
    const { seats, crew } = splitPeople(band.max);
    return {
      range, people: band.max, seats, crew, tier: atMax,
      kind: atMax.custom ? "custom" : "ladder",
      sentence: `About ${range} ${employees} per BBB → likely fits ${describe(atMax)}. (Self-reported to BBB.)`,
      note,
    };
  }
  if (atMin) {
    // The band starts inside what we sell and ends past it (or is open-ended).
    const { seats, crew } = splitPeople(band.min);
    return {
      range, people: band.min, seats, crew, tier: atMin,
      kind: "straddles",
      sentence: `About ${range} ${employees} per BBB → at the low end ${describe(atMin)}; past a hundred people it is a conversation, not a plan. (Self-reported to BBB.)`,
      note,
    };
  }
  const { seats, crew } = splitPeople(band.min);
  return {
    range, people: band.min, seats, crew, tier: null,
    kind: "beyond",
    sentence: `About ${range} ${employees} per BBB → bigger than FieldQuo sells on its own (plans stop at a hundred people; ${top.label} is ${top.seats} seats and ${top.crewSeats} crew) — a conversation, not a plan. (Self-reported to BBB.)`,
    note,
  };
}
