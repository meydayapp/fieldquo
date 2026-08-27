// scripts/check-timesheet-approval.mjs
//
// An approved figure must not change under an approval nobody re-gave.
//
// `hours` is what lib/payroll/buildPayRun.js multiplies by a rate. So an
// approved entry that can be edited afterwards, or edited and stay approved, is
// money moving on a number nobody checked. The rules were correct and lived
// inside a route handler where nothing asserted them — which is one refactor
// away from being wrong and silent.
//
// The owner asked for this directly: "if they make a modification it should be
// sent for approval?" — yes, and Crew were raised to view_record_edit_own so
// they can make one at all.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-timesheet-approval.mjs

import { canEditApprovedEntry, shouldReopenForApproval } from "@/lib/payroll/timesheetEdit";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

console.log("\nWho may touch an entry that is already approved");
ok("an owner may", canEditApprovedEntry("owner"));
ok("an admin may", canEditApprovedEntry("admin"));
ok("a supervisor may — Dispatcher and Manager both", canEditApprovedEntry("supervisor"));
// The boundary is the APPROVAL, not the ownership. Crew can edit their own
// pending rows and still cannot reopen a signed-off one.
ok("Crew may NOT, even on their own row", canEditApprovedEntry("employee") === false);
ok("Estimator may NOT either", canEditApprovedEntry(PRESET_TO_ROLE.estimator) === false);
ok("an unknown role may not", canEditApprovedEntry("cousin") === false);
ok("no role may not", canEditApprovedEntry(undefined) === false);
// Crew hold the grid level that lets them edit their own hours — so the guard
// above is the ONLY thing standing between them and an approved figure.
ok(
  "…and Crew do hold view_record_edit_own, which is why that guard matters",
  PERMISSION_PRESETS.worker.values.timeTracking === "view_record_edit_own",
);

console.log("\nWhen an edit goes back for approval");
const base = {
  existingStatus: "approved",
  existingWorkerUserId: "u1",
  editorUserId: "u1",
  timesChanged: true,
  statusProvided: false,
};
ok("the worker changes their own approved hours -> reopened", shouldReopenForApproval(base));
ok(
  "a rejected entry the worker corrects -> reopened",
  shouldReopenForApproval({ ...base, existingStatus: "rejected" }),
);
// A sole trader has nobody else to ask, so self-approval stays legal — which is
// precisely why this applies to an owner editing their own approved row.
ok(
  "an approver amending their OWN approved hours -> reopened",
  shouldReopenForApproval({ ...base, existingWorkerUserId: "owner1", editorUserId: "owner1" }),
);

console.log("\nWhen it does not");
ok(
  "a supervisor correcting somebody else's entry — that IS the reviewing",
  shouldReopenForApproval({ ...base, editorUserId: "sup9" }) === false,
);
ok(
  "an explicit status — they have made the decision",
  shouldReopenForApproval({ ...base, statusProvided: true }) === false,
);
ok(
  "already pending — nothing to undo",
  shouldReopenForApproval({ ...base, existingStatus: "pending" }) === false,
);
ok(
  "the times did not change — a note is not an hour",
  shouldReopenForApproval({ ...base, timesChanged: false }) === false,
);

console.log("\nAn unidentified editor is not 'the same person'");
// Two undefineds are equal in JS. Treating them as one would reopen every entry
// edited by a session we could not identify — noise that trains people to
// re-approve without looking.
ok(
  "both ids missing does NOT count as a self-edit",
  shouldReopenForApproval({ ...base, existingWorkerUserId: undefined, editorUserId: undefined }) === false,
);
ok(
  "a missing worker id does not",
  shouldReopenForApproval({ ...base, existingWorkerUserId: null }) === false,
);
ok(
  "a missing editor id does not",
  shouldReopenForApproval({ ...base, editorUserId: null }) === false,
);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
