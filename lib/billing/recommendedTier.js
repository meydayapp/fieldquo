// lib/billing/recommendedTier.js
//
// "Recommended: Crew · 3 seats + 8 crew" — the rung a company's roster fits.
//
// One helper because the trial banner and the trial reminder email both print
// it, and the copy that drifts is the one nobody looks at. Counts through
// countSeats (who is billable is its rule, not a second one here) and picks
// through tierFor, which already knows that crew may sit in spare seats and
// that above Scale is a custom plan. Null past the cap — "talk to us" is the
// honest answer there, and the callers print nothing rather than a guess.
import { countSeats, tierFor } from "@/lib/pricing/ladder";

/**
 * @param members  active members, each { role, permissions, active }
 * @returns {{ tierKey, label, seats, crewSeats, counts: { seats, crew } } | null}
 */
export function recommendedTierFor(members = []) {
  const counts = countSeats(members);
  const tier = tierFor({ seats: counts.seats, crew: counts.crew });
  if (!tier) return null;
  return {
    tierKey: tier.tierKey,
    label: tier.label,
    seats: tier.seats,
    crewSeats: tier.crewSeats,
    counts: { seats: counts.seats, crew: counts.crew },
  };
}
