// lib/team/ownRate.js
//
// "Your own rate" — the owner's (or an admin's) own hourly pay rate, set by
// themselves. Pure: no database, so app/api/me/own-rate/route.js and
// scripts/check-own-rate.mjs share one set of rules.
//
// ── Why there was nowhere to set it (the owner, 2026-10-03) ─────────────────
//
// "We can set the rate of a new team member but I don't know where to change
// my own rate."
//
// A rate lives on the person's Worker row (Worker.hourlyRate) — what job
// costing (lib/costing/actualJobCost.js), quote crew costing (lib/costing/
// crew.js) and payroll read. Team → Workers lists Worker rows, and an invited
// member gets one when they accept (lib/team/ensureWorker.js). The OWNER never
// accepted an invitation: they created the company, so unless they once
// self-enrolled at the time clock they have no Worker row, nothing to open on
// Team → Workers, and their hours — clocked or not — cost nothing on any job.
// For a one-person company that is every job's labour.
//
// ── Which rate ───────────────────────────────────────────────────────────────
//
// Worker.hourlyRate — the one the Workers page edits for everybody else, and
// the one job costing multiplies time entries by. Not Member.laborCostPerHour,
// the New User form's "labour cost": no screen edits it after the invite, job
// costing never reads it (payroll uses it only as a fallback), and offering it
// here would be a second number for the same hour.
//
// ── The rules ────────────────────────────────────────────────────────────────
//
//   • Setting a rate is payroll, wherever it is set from: payroll:view_all,
//     the same rung PATCH /api/workers/[id] refuses below. Owners and admins
//     hold it; a Manager does not, and does not get this card.
//   • Creating your own Worker row is the time clock's self-enrol rule
//     (lib/timeclock/selfEnrol.js, user:manage, never under impersonation).
//   • Never overwrite: the browser sends the rate it was SHOWN (`expected`)
//     and the write only lands if that is still the rate on the row. A rate
//     somebody else set in the meantime — or a hand-entered Worker row the
//     owner's login gets linked to, already carrying a rate — comes back as
//     a conflict with the real number, never silently replaced.
//   • Nothing is ever written that the person did not type and save. The
//     card suggests FieldQuo's $35/h default (the rate an unassigned quote is
//     costed at today) as the starting value, labelled as that; it is not
//     stored until Save is pressed.

/** Above this an hourly rate is a typo (a salary, a day rate, cents). */
export const OWN_RATE_MAX = 10000;

/**
 * Parse what the person typed.
 * @returns {{ ok: true, value: number } | { ok: false, error: "empty" | "not_a_number" | "not_positive" | "too_high" }}
 */
export function parseOwnRate(input) {
  if (input === null || input === undefined) return { ok: false, error: "empty" };
  // Only what a form field or JSON number can be. String([45]) is "45", so an
  // array would otherwise slip through the pattern below.
  if (typeof input !== "string" && typeof input !== "number") return { ok: false, error: "not_a_number" };
  const raw = typeof input === "string" ? input.trim().replace(",", ".") : input;
  if (raw === "") return { ok: false, error: "empty" };
  if (typeof raw !== "number" && !/^\d+(\.\d+)?$/.test(String(raw))) return { ok: false, error: "not_a_number" };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, error: "not_a_number" };
  if (n <= 0) return { ok: false, error: "not_positive" };
  if (n > OWN_RATE_MAX) return { ok: false, error: "too_high" };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** Two rates as cents, null-safe: the comparison the optimistic write makes. */
export function sameRate(a, b) {
  const na = a === null || a === undefined || a === "" ? null : Number(a);
  const nb = b === null || b === undefined || b === "" ? null : Number(b);
  if (na === null || nb === null) return na === nb;
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.round(na * 100) === Math.round(nb * 100);
}

/**
 * What the card may do for this member.
 *
 * @param {object} p
 * @param {object} p.member          { role, impersonation }
 * @param {boolean} p.canSetPay      payroll:view_all, resolved by the caller
 * @param {boolean} p.canSelfEnrol   lib/timeclock/selfEnrol.js canSelfEnrol(member)
 * @param {object|null} p.worker     their Worker row in this company, if any
 * @returns {{ show: boolean, canSave: boolean, reason: string|null }}
 */
export function ownRateAccess({ member, canSetPay = false, canSelfEnrol = false, worker = null } = {}) {
  if (!member) return { show: false, canSave: false, reason: "signed_out" };
  // A Manager without payroll access never sees the card: their rate is set
  // by whoever runs payroll, and a card they could read but not save would
  // be a control that appears to work and doesn't.
  if (!canSetPay) return { show: false, canSave: false, reason: "no_pay_access" };
  if (member.impersonation) return { show: true, canSave: false, reason: "read_only" };
  if (!worker && !canSelfEnrol) return { show: true, canSave: false, reason: "no_worker" };
  return { show: true, canSave: true, reason: null };
}

/**
 * The verdict on a save, given what the database holds NOW.
 *
 * @param {object} p
 * @param {*} p.expected   the rate the card showed (null when it showed none)
 * @param {*} p.current    the row's hourlyRate as read just before the write
 * @returns {{ ok: true } | { ok: false, reason: "changed", current: number|null }}
 */
export function ownRateWriteVerdict({ expected = null, current = null } = {}) {
  if (sameRate(expected, current)) return { ok: true };
  return { ok: false, reason: "changed", current: current === null || current === undefined ? null : Number(current) };
}
