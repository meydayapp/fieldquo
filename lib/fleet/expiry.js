// lib/fleet/expiry.js
//
// What is due and what is expiring on a van — the whole point of the fleet
// feature for a contractor with three of them.
//
// ══ Why this and not telematics ════════════════════════════════════════════
//
// ServiceTitan's fleet product is aimed at a two-hundred-truck operation:
// live GPS, route history, driver scorecards. A painter with three vans has a
// different question, and it is a boring one — what is due, what is expiring,
// and who has the van. An insurance certificate that lapsed is a van that
// should not be on the road, and that is a fact this product can hold and act
// on today. Live tracking is not: the routing audit already established that a
// browser cannot do background location, so a "where is the van" feature would
// be a map that is right when somebody happens to have the tab open.
//
// ══ Two kinds of due, and one of them can be unknowable ════════════════════
//
// A service is due by DATE (`nextServiceDueAt`) or by DISTANCE
// (`nextServiceDueKm`), and a contractor sets whichever their garage told
// them. The distance one needs a second number to mean anything — the current
// odometer — and `odometerKm` is nullable. So "due at 90,000 km" on a van
// whose mileage nobody has recorded is UNKNOWN, not due and not fine. Padding
// the missing odometer with 0 would report that van as 90,000 km from its
// service, which is the most dangerous possible direction for this particular
// error.
import {
  EXPIRY_STATES,
  DEFAULT_SOON_DAYS,
  expiryState,
  needsAttention,
  worstState,
  byUrgency,
} from "@/lib/expiry/window";
import { odometerReading } from "./vehicle";

export { EXPIRY_STATES, DEFAULT_SOON_DAYS };

/**
 * How close to a service, in kilometres, counts as "soon".
 *
 * 500 km is roughly a fortnight of a working van, which is the same shape of
 * warning the 30-day date window gives — enough time to book the garage.
 */
export const SERVICE_SOON_KM = 500;

/**
 * The date-driven expiries, in the order they matter when everything is fine.
 *
 * Insurance first: it is the one that stops the van being legally driven, and
 * a lapsed certificate is the only item on this list with a same-day
 * consequence.
 */
export const VEHICLE_DATE_EXPIRIES = Object.freeze([
  { kind: "insurance", field: "insuranceExpiresAt" },
  { kind: "registration", field: "registrationExpiresAt" },
  { kind: "service", field: "nextServiceDueAt" },
]);

/**
 * Service due by distance.
 *
 * @returns {{ kind: "serviceKm", state, remainingKm: number|null, dueKm: number|null, odometerKm: number|null }}
 *
 * `unknown` whenever EITHER number is missing, and that includes an odometer
 * of null on a van with a target set. `remainingKm` is null in that case, not
 * the target: a screen printing "90,000 km to go" from a target alone would be
 * inventing the mileage.
 */
export function serviceDueByKm(vehicle, { soonKm = SERVICE_SOON_KM } = {}) {
  const dueRaw = vehicle?.nextServiceDueKm;
  const due =
    typeof dueRaw === "number" && Number.isFinite(dueRaw) && dueRaw >= 0 ? dueRaw : null;
  const odo = odometerReading(vehicle);

  if (due === null || !odo.known) {
    return {
      kind: "serviceKm",
      state: EXPIRY_STATES.UNKNOWN,
      remainingKm: null,
      dueKm: due,
      odometerKm: odo.km,
    };
  }

  const window =
    Number.isFinite(soonKm) && soonKm >= 0 ? Math.floor(soonKm) : SERVICE_SOON_KM;
  const remainingKm = due - odo.km;
  let state = EXPIRY_STATES.OK;
  if (remainingKm < 0) state = EXPIRY_STATES.EXPIRED;
  else if (remainingKm <= window) state = EXPIRY_STATES.DUE_SOON;

  return { kind: "serviceKm", state, remainingKm, dueKm: due, odometerKm: odo.km };
}

/**
 * Every expiry on one van: three dates plus the distance-based service.
 *
 * All four are always returned, `unknown` included, because this is what the
 * van's own detail panel renders — and a row silently missing from a list of
 * four is how "we never recorded the insurance" becomes invisible. The call
 * list below is what filters.
 */
export function vehicleExpiries(vehicle, { asOf, soonDays = DEFAULT_SOON_DAYS, soonKm } = {}) {
  const dated = VEHICLE_DATE_EXPIRIES.map(({ kind, field }) => {
    const state = expiryState(vehicle?.[field], { asOf, soonDays });
    return {
      kind,
      state: state.state,
      endsAt: state.endsAt,
      daysRemaining: state.daysRemaining,
    };
  });
  return [...dated, serviceDueByKm(vehicle, { soonKm })];
}

/**
 * One badge for the whole van.
 *
 * `unknown` only wins when nothing else has anything to say — a van with
 * lapsed insurance and an unrecorded odometer is a van with lapsed insurance,
 * not a van we know nothing about.
 */
export function vehicleAttention(vehicle, opts = {}) {
  const expiries = vehicleExpiries(vehicle, opts);
  const state = worstState(expiries.map((e) => e.state));
  return {
    state,
    // Only the ones actually raising the alarm, so a screen can name them
    // ("insurance, service") instead of showing a red dot with no reason.
    reasons: expiries.filter((e) => needsAttention(e.state)),
    expiries,
  };
}

/**
 * The fleet call list: every van with something lapsed or about to lapse,
 * most urgent first.
 *
 * Deliberately the same shape and the same sort as
 * lib/equipment/warranty.js's `expiringWarranties`, and for the same reason:
 * the two screens do the same job and should feel like it.
 */
export function fleetDueSoon(vehicles, opts = {}) {
  const rows = (Array.isArray(vehicles) ? vehicles : [])
    .filter(Boolean)
    .map((vehicle) => ({ vehicle, ...vehicleAttention(vehicle, opts) }))
    .filter((row) => needsAttention(row.state));

  return byUrgency(
    rows,
    (r) => r.state,
    // Sort within a rank by the soonest DATED reason. A distance-based service
    // has no date, so it sorts after the dated ones at the same urgency —
    // which is right: "due in 200 km" is a softer deadline than "expires
    // Tuesday".
    (r) => {
      const dated = r.reasons.map((x) => x.endsAt).filter(Boolean);
      return dated.length ? new Date(Math.min(...dated.map((d) => d.getTime()))) : null;
    },
  );
}

/** Counts for the header — same three buckets the warranty tally reports. */
export function fleetTally(vehicles, opts = {}) {
  const tally = { expired: 0, dueSoon: 0, ok: 0, unknown: 0, total: 0 };
  for (const vehicle of Array.isArray(vehicles) ? vehicles : []) {
    if (!vehicle) continue;
    tally.total += 1;
    switch (vehicleAttention(vehicle, opts).state) {
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
