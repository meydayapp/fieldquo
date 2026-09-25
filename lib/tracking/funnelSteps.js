// lib/tracking/funnelSteps.js
//
// The step order a FunnelVisit is measured against, per surface, and the rule
// that a visit's furthest step never moves backwards. Pure: no database, no
// imports — the funnel runner, the instant estimate, the visit route and the
// /app report all read the same order from here.
//
// ══ Two kinds of order ═════════════════════════════════════════════════════
//
//   instant_quote  a fixed list, because the page is one form with the same
//                  shape for every company: opened → chose a service →
//                  described the job (address typed, lawn traced, counts
//                  entered) → started typing contact details → sent it.
//                  There is no "saw a price" step on purpose: in two of the
//                  three display modes the price is never on screen before the
//                  submit, so a rank for it would count people who never saw
//                  one as having reached it.
//
//   funnel         the company's own steps, in the order the builder saved
//                  them. A step's rank is its index; "submitted" ranks after
//                  every step. The thank-you step is not reported — it is
//                  only ever reached by submitting, which is its own row.
//                  A branching funnel can skip steps, so the report reads
//                  "reached this step OR FURTHER" — the same definition for
//                  every step, and never more people at a later step than an
//                  earlier one.
//
//   booking        the booking page (/book/<slug>, and the booking block on
//                  the company's website): opened → picked a time → booked.
//                  "Booked" is its submitted step; what it makes is a Booking,
//                  not a lead, and the visit links it (FunnelVisit.bookingId).
//
//   website        the company's FieldQuo-hosted site: opened, and nothing
//                  after. A website asks for nothing itself — its requests
//                  and bookings are made on the forms it links to or embeds,
//                  each counted on its own surface, which inherits the
//                  website visit's landing (visits.js openVisit). So a
//                  website visit never "submits", and the report says where
//                  its requests are credited instead of printing a zero.
//
// The browser names the STEP; the rank is always computed here from the
// server's own copy of the order. A posted rank is never read.

export const SURFACES = Object.freeze(["funnel", "instant_quote", "booking", "website"]);

export const INSTANT_QUOTE_STEPS = Object.freeze(["landed", "service", "details", "contact", "submitted"]);
export const BOOKING_STEPS = Object.freeze(["landed", "slot", "submitted"]);
export const WEBSITE_STEPS = Object.freeze(["landed"]);

/** The fixed order of a surface that has one; null for a funnel (its own steps). */
function fixedSteps(surface) {
  if (surface === "instant_quote") return INSTANT_QUOTE_STEPS;
  if (surface === "booking") return BOOKING_STEPS;
  if (surface === "website") return WEBSITE_STEPS;
  return null;
}

export const SUBMITTED = "submitted";

/** A funnel's reportable steps: its step ids in order, the thank-you left out. */
export function funnelStepIds(steps) {
  return (Array.isArray(steps) ? steps : [])
    .filter((s) => s && typeof s.id === "string" && s.kind !== "thankyou")
    .map((s) => s.id);
}

/**
 * The rank of `stepKey` on this surface, or null when it is not a step there.
 * For a funnel, `funnelSteps` is the stored steps array.
 */
export function stepRank(surface, stepKey, funnelSteps = []) {
  if (typeof stepKey !== "string" || !stepKey) return null;
  const fixed = fixedSteps(surface);
  if (fixed) {
    const i = fixed.indexOf(stepKey);
    return i >= 0 ? i : null;
  }
  if (surface === "funnel") {
    const ids = funnelStepIds(funnelSteps);
    if (stepKey === SUBMITTED) return ids.length;
    if (stepKey === "landed") return 0;
    const i = ids.indexOf(stepKey);
    return i >= 0 ? i : null;
  }
  return null;
}

/** The rank that counts as "started": anything past the first screen. */
export const STARTED_RANK = 1;

/**
 * The step to store after a report of `incoming`: whichever is further. A
 * visitor who taps Back has not un-reached the step they left.
 */
export function furthestStep(existing, incoming) {
  if (!incoming || incoming.rank == null) return existing || { key: "landed", rank: 0 };
  if (!existing || existing.rank == null || incoming.rank > existing.rank) return incoming;
  return existing;
}

/**
 * The rows of the step report, in order: { key, rank }. `submitted` is last
 * on every surface except the website, which has none (see the header).
 */
export function reportSteps(surface, funnelSteps = []) {
  const fixed = fixedSteps(surface);
  if (fixed) return fixed.map((key, rank) => ({ key, rank }));
  const ids = funnelStepIds(funnelSteps);
  return [...ids.map((key, rank) => ({ key, rank })), { key: SUBMITTED, rank: ids.length }];
}

/**
 * Counts for one surface from its visits' furthest ranks: how many reached
 * each step or further, visits, starts and submissions. `visits` is
 * [{ stepRank, completed }]. Pure, so the report and the check run the same
 * arithmetic.
 */
export function countSteps(rows, visits) {
  const list = Array.isArray(visits) ? visits : [];
  const total = list.length;
  const started = list.filter((v) => (v.stepRank ?? 0) >= STARTED_RANK || v.completed).length;
  const submitted = list.filter((v) => v.completed).length;
  const steps = rows.map((r) => ({
    ...r,
    reached:
      r.key === SUBMITTED
        ? submitted
        : list.filter((v) => v.completed || (v.stepRank ?? 0) >= r.rank).length,
  }));
  return {
    visits: total,
    started,
    submitted,
    completionRate: total > 0 ? Math.round((submitted / total) * 1000) / 10 : null,
    steps,
  };
}
