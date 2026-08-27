// lib/payroll/timesheetEdit.js
//
// Whether an edited timesheet still counts as approved.
//
// ══ Why this is its own file ═══════════════════════════════════════════════
//
// The rule was correct and lived inside a route handler, so nothing asserted
// it. `hours` is what a pay run multiplies by a rate — an approved figure that
// can change under an approval nobody re-gave is money — and "correct today,
// unasserted" is one refactor from being money that moves quietly.
//
// Pure, so both branches can be executed against the states that matter rather
// than reasoned about from a handler that needs a database and a session.

/**
 * May this person change an entry that has already been approved AT ALL?
 *
 * Deliberately NOT keyed on the timeTracking level. `view_record_edit_all` is a
 * Dispatcher's grant over other people's hours — a question of scope. Undoing
 * an approval is a question of authority, and the two are not the same person.
 *
 * A Crew member therefore cannot touch an approved row even though the grid
 * lets them edit their own pending ones, which is the whole point: the approval
 * is the boundary, not the ownership.
 */
export function canEditApprovedEntry(role) {
  return ["owner", "admin", "supervisor"].includes(role);
}

/**
 * Should this edit send the entry back for approval?
 *
 * Yes when the person whose hours these are changes the TIMES on an entry that
 * somebody had already signed off, and does not say what the status should be.
 *
 * Not when a supervisor corrects somebody else's entry — that IS the reviewing.
 * Not when the caller states a status explicitly, because then they have made
 * the decision. Not when the entry is already pending, because there is nothing
 * to undo.
 *
 * Self-approval is allowed elsewhere and stays allowed — a sole trader has
 * nobody else to ask — which is exactly why this applies to an owner editing
 * their OWN approved row too. The one thing it closes is an approved number
 * changing while the approval stands.
 */
export function shouldReopenForApproval({
  existingStatus,
  existingWorkerUserId,
  editorUserId,
  timesChanged,
  statusProvided,
}) {
  if (!timesChanged) return false;
  if (statusProvided) return false;
  if (existingStatus === "pending") return false;
  // Both must be present AND equal. Two undefineds are not the same person, and
  // treating them as one would reopen every entry edited by a session we could
  // not identify.
  if (!existingWorkerUserId || !editorUserId) return false;
  return existingWorkerUserId === editorUserId;
}
