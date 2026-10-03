// lib/payroll/ownerPay.js
//
// Whether a Worker row is paid through a pay run.
//
// ── Why this exists (2026-10-03) ────────────────────────────────────────────
//
// The owner can now set "Your own rate" (lib/team/ownRate.js), which gives
// them a Worker row with an hourly rate — so job costing counts their hours
// at a real cost, which is the point. But a pay run takes every active
// Worker row, and an owner who clocks in would then be PAID by it: wages
// for the person who takes the profit, on a payslip with statutory
// deductions, because they wanted their jobs costed honestly.
//
// So: an OWNER's row is left out of pay runs unless it is explicitly marked
// as paid (Worker.paidByPayroll = true — "Pay me through payroll" on the
// Your own rate card). Everyone else is paid exactly as before; an explicit
// `false` leaves anyone out. Null is "not decided", which is every row that
// existed before the column, and resolves by role — so no employee's pay
// moves. The run says, by name, who it left out and why; silence there
// would read as a person forgotten.
//
// Pure, so the pay-run checks execute it.

/** Is this worker paid by a pay run? `ownerUserIds` — the company's owners. */
export function isOnPayroll(worker, ownerUserIds) {
  if (!worker) return false;
  if (worker.paidByPayroll === true) return true;
  if (worker.paidByPayroll === false) return false;
  const owners = ownerUserIds instanceof Set ? ownerUserIds : new Set(ownerUserIds || []);
  return !(worker.userId && owners.has(worker.userId));
}
