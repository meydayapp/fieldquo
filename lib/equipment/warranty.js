// lib/equipment/warranty.js
//
// The warranty on a thing installed at a customer's address, and the list of
// the ones about to run out.
//
// ══ What this is for ═══════════════════════════════════════════════════════
//
// `ClientEquipment` is the customer's kit — their furnace, their panel, their
// unit. It is NOT `Asset`, which is the contractor's own van and spray rig and
// carries depreciation into job costing. A homeowner's furnace is not a
// depreciating asset of the contractor's, and conflating the two would put a
// customer's boiler into the company's price floor.
//
// What makes the record worth keeping is the warranty. "Installed 2019,
// covered to 2029, serviced three times" is what turns a cold call into a
// renewal, and `expiringWarranties` below is that call list — the commercial
// point of the whole feature, not a report at the end of it.
//
// ══ The rule ═══════════════════════════════════════════════════════════════
//
// A null `warrantyEndsAt` is UNKNOWN. Never "out of warranty". The maths lives
// in lib/expiry/window.js, which the van expiries share, and the schema
// comment on the column says the same thing — three places agreeing on
// purpose, because this is the one mistake in this feature that reaches a
// customer as an insult.
import {
  EXPIRY_STATES,
  DEFAULT_SOON_DAYS,
  expiryState,
  needsAttention,
  byUrgency,
} from "@/lib/expiry/window";

export { EXPIRY_STATES, DEFAULT_SOON_DAYS };

/**
 * How far ahead the renewal call list looks by default.
 *
 * Sixty rather than the shared thirty: a warranty renewal is a sale that needs
 * a quote, a conversation and a booking, and thirty days is the window for
 * "this lapses next month", not for "start selling now". Insurance on a van is
 * the opposite — you want to know late, not early — so the two features
 * deliberately do NOT share this number even though they share the maths.
 */
export const WARRANTY_SOON_DAYS = 60;

/**
 * The warranty state of one equipment row.
 *
 * Safe against null, `{}`, and a row loaded with the column deselected — all
 * of which mean "nobody told us", which is `unknown`.
 */
export function warrantyState(equipment, opts = {}) {
  const { asOf, soonDays = WARRANTY_SOON_DAYS } = opts;
  return expiryState(equipment?.warrantyEndsAt, { asOf, soonDays });
}

/** True when a warranty is genuinely known to have run out. Never for a blank. */
export function isOutOfWarranty(equipment, opts = {}) {
  return warrantyState(equipment, opts).state === EXPIRY_STATES.EXPIRED;
}

/**
 * True when we cannot say either way.
 *
 * Exists as its own named predicate so a screen can render the honest third
 * option instead of picking one of the two it has a colour for.
 */
export function isWarrantyUnknown(equipment, opts = {}) {
  return warrantyState(equipment, opts).state === EXPIRY_STATES.UNKNOWN;
}

/** The row with its warranty state attached, for a screen or an API payload. */
export function withWarranty(equipment, opts = {}) {
  if (!equipment) return null;
  const warranty = warrantyState(equipment, opts);
  return {
    ...equipment,
    warranty: {
      state: warranty.state,
      daysRemaining: warranty.daysRemaining,
      // Echoed back so the client renders the same date the state was computed
      // from, rather than re-parsing the raw column and disagreeing with the
      // badge sitting next to it.
      endsAt: warranty.endsAt,
    },
  };
}

/**
 * The call list: equipment whose warranty has lapsed or is about to.
 *
 * Rows with no warranty date are EXCLUDED, and that exclusion is the feature.
 * A blank has no expiry to be soon, and padding the list with "we don't know
 * about this one" would bury the twelve real renewals under two hundred rows
 * nobody can act on.
 *
 * Expired first, then soonest — an already-lapsed warranty is the more urgent
 * call, because that customer is currently paying for their own repairs.
 */
export function expiringWarranties(equipment, opts = {}) {
  const { asOf, soonDays = WARRANTY_SOON_DAYS } = opts;
  const rows = (Array.isArray(equipment) ? equipment : [])
    .map((row) => withWarranty(row, { asOf, soonDays }))
    .filter((row) => row && needsAttention(row.warranty.state));
  return byUrgency(
    rows,
    (r) => r.warranty.state,
    (r) => r.warranty.endsAt,
  );
}

/**
 * Counts for the header of that list.
 *
 * `unknown` is reported alongside the two actionable numbers rather than
 * folded into either. A company with 200 pieces of equipment and 180 blank
 * warranty dates has a data-entry problem, and the honest way to say so is a
 * third number — not a call list of 180.
 */
export function warrantyTally(equipment, opts = {}) {
  const tally = { expired: 0, dueSoon: 0, ok: 0, unknown: 0, total: 0 };
  for (const row of Array.isArray(equipment) ? equipment : []) {
    tally.total += 1;
    switch (warrantyState(row, opts).state) {
      case EXPIRY_STATES.EXPIRED:
        tally.expired += 1;
        break;
      case EXPIRY_STATES.DUE_SOON:
        tally.dueSoon += 1;
        break;
      case EXPIRY_STATES.OK:
        tally.ok += 1;
        break;
      default:
        tally.unknown += 1;
    }
  }
  return tally;
}
