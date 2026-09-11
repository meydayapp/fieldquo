// lib/subcontractors/expiry.js
//
// Which subs can go on site: is the certificate of insurance still valid, is
// the workers' compensation clearance (WSIB in Ontario, WCB elsewhere) still
// valid, and which of them lapse this month.
//
// ══ One rule, borrowed, not copied ═════════════════════════════════════════
//
// lib/expiry/window.js is the same question asked about a homeowner's
// warranty and a van's insurance, and its one rule applies unchanged here:
//
//   A MISSING DATE IS "unknown". IT IS NEVER "expired".
//
// `Subcontractor.insuranceExpiresAt` is nullable and the schema comment says
// why — null means "not recorded", never "not required". A GC who never typed
// the roofer's COI date has a gap in the paperwork, not an uninsured roofer,
// and the two are different sentences with different consequences: one is a
// phone call, the other is a sub pulled off tomorrow's visit.
//
// So the window, the four states, the sort order and the "worst of several"
// rule are all imported. This file adds only the nouns.
import {
  EXPIRY_STATES,
  DEFAULT_SOON_DAYS,
  expiryState,
  needsAttention,
  worstState,
  byUrgency,
} from "@/lib/expiry/window";

export { EXPIRY_STATES, DEFAULT_SOON_DAYS };

/**
 * The two dated expiries on a sub, in the order they matter.
 *
 * Insurance first: a lapsed COI is the one that makes the GC liable for the
 * sub's damage the moment they step on site. Clearance second: a lapsed WSIB
 * clearance makes the GC liable for the sub's PREMIUMS, which is a bill
 * rather than a lawsuit.
 */
export const SUBCONTRACTOR_EXPIRIES = Object.freeze([
  { kind: "insurance", field: "insuranceExpiresAt" },
  { kind: "clearance", field: "clearanceExpiresAt" },
]);

/**
 * Both expiries on one sub, `unknown` included.
 *
 * Both are always returned because this is what the sub's own detail panel
 * renders, and a row silently missing from a list of two is how "we never
 * recorded the clearance" becomes invisible. The call list below filters.
 */
export function subcontractorExpiries(sub, { asOf, soonDays = DEFAULT_SOON_DAYS } = {}) {
  return SUBCONTRACTOR_EXPIRIES.map(({ kind, field }) => {
    const state = expiryState(sub?.[field], { asOf, soonDays });
    return {
      kind,
      state: state.state,
      endsAt: state.endsAt,
      daysRemaining: state.daysRemaining,
    };
  });
}

/**
 * One badge for the whole sub, plus the reasons behind it.
 *
 * `unknown` only wins when nothing else has anything to say — a sub with a
 * lapsed COI and an unrecorded clearance is a sub with a lapsed COI, not a sub
 * we know nothing about. worstState() is what encodes that.
 *
 * @returns {{ state, reasons: object[], expiries: object[] }}
 */
export function subcontractorAttention(sub, opts = {}) {
  const expiries = subcontractorExpiries(sub, opts);
  const state = worstState(expiries.map((e) => e.state));
  return {
    state,
    // Only the ones actually raising the alarm, so a screen can say
    // "insurance" rather than show a red dot with no reason.
    reasons: expiries.filter((e) => needsAttention(e.state)),
    expiries,
  };
}

/**
 * The call list: every sub with something lapsed or about to lapse, most
 * urgent first, then soonest date first.
 *
 * Same shape and same sort as lib/fleet/expiry.js's fleetDueSoon, because
 * /app/subcontractors and /app/fleet do the same job and should feel like it.
 * Inactive subs are left out: a company the GC no longer hires does not need
 * its insurance chased.
 */
export function subcontractorsDueSoon(subs, opts = {}) {
  const rows = (Array.isArray(subs) ? subs : [])
    .filter((s) => s && s.active !== false)
    .map((sub) => ({ sub, ...subcontractorAttention(sub, opts) }))
    .filter((row) => needsAttention(row.state));

  return byUrgency(
    rows,
    (r) => r.state,
    (r) => {
      const dated = r.reasons.map((x) => x.endsAt).filter(Boolean);
      return dated.length ? new Date(Math.min(...dated.map((d) => d.getTime()))) : null;
    },
  );
}

/** Counts for the header — the same four buckets the fleet tally reports. */
export function subcontractorTally(subs, opts = {}) {
  const tally = { expired: 0, dueSoon: 0, ok: 0, unknown: 0, total: 0 };
  for (const sub of Array.isArray(subs) ? subs : []) {
    if (!sub || sub.active === false) continue;
    tally.total += 1;
    switch (subcontractorAttention(sub, opts).state) {
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
