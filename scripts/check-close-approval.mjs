// scripts/check-close-approval.mjs
//
// Two questions, because proving the function correct proves nothing about
// whether anything calls it:
//   1. Does closeApproval() decide right, against hostile input?
//   2. Does EVERY path that closes a time entry actually pass through it?
//
// (2) is the one that matters. The reason an owner's labour read $0.00 was
// never a wrong number — it was three writers setting clockOut and none of
// them asking whether the entry was now approved.
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (cond, what) => {
  if (!cond) {
    failed += 1;
    console.error(`  ✗ ${what}`);
  } else {
    console.log(`  ✓ ${what}`);
  }
};

// Run through scripts/alias-loader.mjs so `@/` resolves — the real module is
// executed, not a copy of it, because a copy is the thing that rots.
const { closeApproval, didSelfApprove } = await import("@/lib/timeclock/closeApproval");

const owner = { role: "owner", permissions: null };
const admin = { role: "admin", permissions: null };
const lead = { role: "member", permissions: { timeTracking: "view_record_edit_all" } };
const estimator = { role: "member", permissions: { timeTracking: "view_record_edit_own" } };
const crew = { role: "member", permissions: { timeTracking: "view_record_own" } };

console.log("closeApproval — who gets approved");
const U = "user_1";
ok(
  closeApproval({ full: owner, userId: U, workerUserId: U }).status === "approved",
  "an owner closing their own entry lands approved",
);
ok(
  closeApproval({ full: owner, userId: U, workerUserId: U }).approvedById === U,
  "and is attributed to them, not left null",
);
ok(
  closeApproval({ full: admin, userId: U, workerUserId: U }).status === "approved",
  "an admin closing their own entry lands approved",
);
ok(
  closeApproval({ full: lead, userId: U, workerUserId: U }).status === "approved",
  "a lead at view_record_edit_all lands approved",
);
ok(
  Object.keys(closeApproval({ full: estimator, userId: U, workerUserId: U })).length === 0,
  "an estimator (edit_own) stays pending — they cannot approve anyone",
);
ok(
  Object.keys(closeApproval({ full: crew, userId: U, workerUserId: U })).length === 0,
  "crew stay pending, which is the point of the queue",
);

console.log("closeApproval — whose entry it is");
ok(
  Object.keys(closeApproval({ full: owner, userId: U, workerUserId: "user_2" })).length === 0,
  "an owner closing SOMEONE ELSE's entry approves nothing",
);
// Two unknowns are not a match. `undefined === undefined` is true in JS, and
// that is exactly how an unlinked Worker row would have been auto-approved.
ok(
  Object.keys(closeApproval({ full: owner, userId: undefined, workerUserId: undefined })).length === 0,
  "two missing ids are not a match",
);
ok(
  Object.keys(closeApproval({ full: owner, userId: null, workerUserId: null })).length === 0,
  "two nulls are not a match either",
);
ok(
  Object.keys(closeApproval({ full: owner, userId: U, workerUserId: null })).length === 0,
  "a worker with no login never self-approves",
);
ok(
  Object.keys(closeApproval({ full: null, userId: U, workerUserId: U })).length === 0,
  "no member loaded means no approval",
);
ok(Object.keys(closeApproval({})).length === 0, "an empty call approves nothing");

console.log("didSelfApprove");
ok(didSelfApprove({ status: "approved" }) === true, "true for an approval");
ok(didSelfApprove({}) === false, "false for the pending case");
ok(didSelfApprove(undefined) === false, "false, not a throw, for nothing at all");

console.log("every door that closes an entry uses it");
const clock = readFileSync("app/api/time-clock/route.js", "utf8");
const editor = readFileSync("app/api/time-entries/[id]/route.js", "utf8");

// The three writes in the clock route that set clockOut, and the one in the
// editor. Each must carry an approval spread — a bare `{ clockOut, hours }` is
// the bug this file exists to prevent coming back.
const closes = [
  [clock, "data: { clockOut, hours, ...approval },", "clock out"],
  [clock, "data: { clockOut: at, hours, ...switchApproval },", "job switch"],
  [clock, "data: { clockOut: now, hours, ...segmentApproval } }", "activity segment change"],
  [editor, "...editorApproval,", "timesheet editor's clock-out"],
];
for (const [file, needle, name] of closes) {
  ok(file.includes(needle), `${name} passes the entry through closeApproval`);
}
ok(
  (clock.match(/closeApproval\(\{/g) || []).length === 3,
  "all three clock-route closes call it — no fourth door added without one",
);
ok(
  !/data:\s*\{\s*clockOut[^}]*hours\s*\}/.test(clock),
  "no close in the clock route still writes a bare { clockOut, hours }",
);

console.log("the approval is reviewable");
ok(
  clock.includes('action: "timeEntry.selfApproved"') &&
    (clock.match(/function logSelfApproval/g) || []).length === 1,
  "the clock route records timeEntry.selfApproved, through one shared writer",
);
ok(
  (clock.match(/didSelfApprove\(/g) || []).length === 3,
  "each of the three closes logs its own approval, not just the first",
);
ok(
  (editor.match(/action: ["`]timeEntry\.selfApproved["`]/g) || []).length === 1 &&
    editor.includes("selfApproved ? \"timeEntry.selfApproved\""),
  "the editor records it for the manual approval AND the clock-out approval",
);
ok(
  editor.includes("status === undefined && !reopen"),
  "an explicit status, and a reopen, still win over the automatic approval",
);

console.log(failed ? `\nFAILED — ${failed} assertion(s)` : "\nPASSED — all assertions");
process.exit(failed ? 1 : 0);
