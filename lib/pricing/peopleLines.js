// lib/pricing/peopleLines.js
//
// Moved out of app/(marketing)/pricing/PricingPlans.js on 2026-09-29,
// unchanged, because the homepage's pricing band says the same thing about
// each plan and must say it the same way. PricingPlans re-exports it, so
// scripts/check-pricing-page.mjs still imports it from there. Pure: keys and
// counts only, the caller translates.

/**
 * What a plan says about people — as two separate statements, or one legacy one.
 *
 * ══ "6 employee accounts" was the wrong number ═════════════════════════════
 *
 * The cards printed `maxUsers`, which is seats PLUS crew: Solo showed "6
 * employee accounts" for a plan that bills ONE seat and throws in five crew.
 * The owner read that same sum on the in-app billing screen and created an
 * Administrator he was not entitled to; seatLine() in
 * app/app/settings/account-billing/page.js is where it was fixed there, and
 * this is the marketing surface that still said it.
 *
 * Returns t() descriptors rather than finished strings so the rule is pure and
 * executable — the thing being asserted is which numbers are stated, not how
 * they were rendered.
 *
 * A row with `crewSeats == null` is a legacy per-headcount plan that has no
 * crew concept at all. It keeps the old wording rather than being handed an
 * invented zero: "0 crew included" is a statement nobody made about it.
 */
export function peopleLines(plan) {
  if (!plan) return [];

  if (plan.crewSeats == null) {
    const count = Number(plan.maxUsers) || 0;
    if (count <= 0) return [];
    // Separate keys, not an appended "s" — see the note at the call site.
    return [
      count === 1
        ? { key: "pricing.seatsOne", fallback: "1 employee account" }
        : {
            key: "pricing.seatsMany",
            fallback: "{count} employee accounts",
            values: { count },
          },
    ];
  }

  const lines = [];
  const seats = Number(plan.seats) || 0;
  if (seats > 0) {
    lines.push(
      seats === 1
        ? {
            key: "pricing.seatsOneIncluded",
            fallback: "1 seat — quoting, jobs and invoicing",
          }
        : {
            key: "pricing.seatsManyIncluded",
            fallback: "{count} seats — quoting, jobs and invoicing",
            values: { count: seats },
          },
    );
  }

  const crew = Number(plan.crewSeats) || 0;
  // Only when there are some. A tier with zero crew has nothing to say here,
  // and "0 crew members included — free" reads as a taunt.
  if (crew > 0) {
    lines.push({
      key: "pricing.crewIncluded",
      fallback: "{count} crew members included — free",
      values: { count: crew },
    });
  }

  return lines;
}
