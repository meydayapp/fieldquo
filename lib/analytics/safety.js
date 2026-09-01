// lib/analytics/safety.js
//
// The safety incident rate, and the honest argument for what it divides by.
//
// ══ The denominator, decided ════════════════════════════════════════════════
//
// An incident COUNT means nothing on its own — three incidents at a five-person
// shop that ran flat out all quarter is a very different fact from three at a
// twenty-person shop that barely worked. A rate needs hours or jobs on the
// bottom, and this file uses APPROVED labour hours (TimeEntry.status ===
// "approved", the same set actualJobCost.js already trusts for payroll), not
// job count.
//
// Jobs were the other candidate and they lose for the same reason
// lib/analytics/minimumPrice.js divides overhead by capacity rather than by
// job count: jobs vary wildly in size. A one-day tune-up and a three-week
// kitchen gut are both "one job" but expose a crew to a hazard for very
// different lengths of time. Hours is the more honest exposure measure, and
// it is data the product already collects and already trusts elsewhere.
//
// ══ This is NOT an OSHA/CNESST/WSIB rate ═══════════════════════════════════
//
// The standard industry incident-rate formula (incidents × 200,000 ÷ hours,
// the US OSHA convention) is not used here, and no Canadian provincial
// formula is claimed either — CNESST (Quebec) and WSIB (Ontario) compute and
// report this differently, this file has not verified either one, and
// AGENTS.md is explicit that an unverified regulatory claim is worse than no
// claim at all. This is "incidents per 1,000 hours worked" — a plain,
// self-explanatory ratio, presented as an internal, directional number for
// THIS company to watch trend on, never as a figure to hand to a regulator or
// an insurer as their official rate.
export const HOURS_PER_RATE_UNIT = 1000;

// ══ Why a minimum-hours floor, not a minimum-incident floor ════════════════
//
// Every other rate in lib/analytics/kpis.js (win rate, on-time completion)
// floors on the COUNT of things decided, because those are meant to be common
// and a handful of them is a small sample. An incident is meant to be RARE —
// requiring ten of them before printing a rate would mean a well-run company
// never sees this KPI at all, and a company that has just had one bad month
// deserves to see that immediately, not be told to wait for nine more injuries.
//
// So the floor is on the DENOMINATOR instead: enough hours logged that one
// incident more or less does not swing the number wildly. 500 hours is
// roughly three months of one full-time worker, or three weeks of a
// five-person crew — enough that the ratio has started to mean something,
// while still being small enough that a young or small company sees a number
// within its first season rather than never.
export const MIN_HOURS_FOR_RATE = 500;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (v) => Math.round(num(v) * 10) / 10;
const round2 = (v) => Math.round(num(v) * 100) / 100;

/**
 * Pure — hand it rows, it answers. No database, no `t()`.
 *
 * @param {object[]} incidents      SafetyIncident rows for the period, each
 *                                  { kind, workStopped }
 * @param {number}   approvedHours  sum of approved TimeEntry.hours for the
 *                                  SAME period and company
 */
export function safetyIncidentSummary({ incidents = [], approvedHours = 0 } = {}) {
  const list = Array.isArray(incidents) ? incidents : [];
  const hours = round1(approvedHours);

  const count = list.length;
  const injuries = list.filter((i) => i?.kind === "injury").length;
  const nearMisses = list.filter((i) => i?.kind === "near_miss").length;
  const propertyDamage = list.filter((i) => i?.kind === "property_damage").length;
  const workStoppedCount = list.filter((i) => !!i?.workStopped).length;

  const raw = { count, injuries, nearMisses, propertyDamage, workStoppedCount, hours };

  if (hours < MIN_HOURS_FOR_RATE) {
    return {
      value: null,
      reason: "not_enough_hours",
      raw,
    };
  }

  return {
    value: round2((count / hours) * HOURS_PER_RATE_UNIT),
    reason: null,
    raw,
  };
}
