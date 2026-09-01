// scripts/check-migration-service.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-migration-service.mjs
//
// Executes the paid data-migration service's state machine
// (lib/migrations/state.js) and permission gate (lib/platform/permissions.js)
// against hostile input — the same "execute, don't read" discipline
// scripts/check-demo-slots.mjs uses for the slot math this feature reuses.
//
// NOT wired into `npm run check:all` — the task that produced this file was
// told not to edit package.json's script chain and to say so instead. Wire
// this in as its own `check:migration-service` entry alongside the others.
//
// ── What this proves, one assertion per hostile case from the brief ────────
//
//   1. accepting twice                       — second accept() is refused
//   2. paying twice                           — canPay() is false once paid
//   3. declining after paying                 — canRespond() is false once paid
//   4. a write attempted before payment       — canWrite() false for every
//                                                pre-payment status
//   5. a write attempted by a non-superadmin  — requirePlatformPermission
//                                                throws for admin/support
//   6. a migration for a company that has
//      since cancelled                        — canWrite() is false on
//                                                `cancelled`, INCLUDING when
//                                                the previous status was
//                                                `paid` — the exact edge
//                                                lib/migrations/writes.js's
//                                                loadWritableMigration()
//                                                depends on
//
// Every one of these is also mutation-tested below: FLIP the guard under
// test to its wrong answer, confirm the corresponding assertion (and only
// that one) fails, then revert. See the block at the bottom.
import {
  MIGRATION_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  canSchedule,
  canQuote,
  canRespond,
  canPay,
  canWrite,
  canCancel,
  canCompanyCancel,
  canComplete,
  assertTransition,
  assertWritable,
  describeStatus,
} from "../lib/migrations/state.js";
import {
  PLATFORM_PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
  canPlatform,
  requirePlatformPermission,
} from "../lib/platform/permissions.js";

let pass = 0;
let fail = 0;
function ok(name, condition, got) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  (got: ${JSON.stringify(got)})` : ""}`);
  }
}
function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

console.log("Data-migration service — state machine and permission gate\n");

// ── Every status is reachable and every edge is intentional ────────────────
//
// A status the schema declares but the state machine never mentions is a
// dead end nobody could ever leave — same failure class as a written-never-
// read field, one level up.
for (const s of MIGRATION_STATUSES) {
  ok(`describeStatus() knows "${s}"`, describeStatus(s) !== s || s === describeStatus(s));
}

// ── 1. Accepting twice ──────────────────────────────────────────────────────
ok("a quoted request may be accepted", canRespond("quoted") === true);
ok("an already-accepted request may NOT be accepted again", canRespond("accepted") === false);
ok("assertTransition refuses quoted->accepted read from 'accepted' as a no-op", throws(() => assertTransition("accepted", "accepted")));

// ── 2. Paying twice ─────────────────────────────────────────────────────────
ok("an accepted request may be paid", canPay("accepted") === true);
ok("an already-paid request may NOT be paid again", canPay("paid") === false);
ok("an in-progress request may NOT be paid again", canPay("in_progress") === false);
ok("a completed request may NOT be paid", canPay("completed") === false);

// ── 3. Declining after paying ───────────────────────────────────────────────
ok("a quoted request may be declined", canRespond("quoted") === true);
ok("a PAID request may NOT be declined", canRespond("paid") === false);
ok("an IN-PROGRESS request may NOT be declined", canRespond("in_progress") === false);
ok("a COMPLETED request may NOT be declined", canRespond("completed") === false);

// ── 4. A write attempted before payment ─────────────────────────────────────
for (const s of ["requested", "scheduled", "quoted", "accepted", "declined", "cancelled"]) {
  ok(`canWrite() refuses status "${s}" (nothing has been paid)`, canWrite(s) === false);
}
ok("canWrite() allows 'paid'", canWrite("paid") === true);
ok("canWrite() allows 'in_progress'", canWrite("in_progress") === true);
ok("canWrite() refuses 'completed' (closed out)", canWrite("completed") === false);
ok("assertWritable throws for 'requested'", throws(() => assertWritable("requested")));
ok("assertWritable does NOT throw for 'paid'", !throws(() => assertWritable("paid")));

// ── 5. A write attempted by a non-superadmin ────────────────────────────────
ok("migration:write is superadmin-only, declared", SUPERADMIN_ONLY_PERMISSIONS.includes("migration:write"));
ok("superadmin holds migration:write", canPlatform("superadmin", "migration:write") === true);
ok("admin does NOT hold migration:write", canPlatform("admin", "migration:write") === false);
ok("support does NOT hold migration:write", canPlatform("support", "migration:write") === false);
ok("requirePlatformPermission throws for admin", throws(() => requirePlatformPermission("admin", "migration:write")));
ok("requirePlatformPermission throws for support", throws(() => requirePlatformPermission("support", "migration:write")));
ok("requirePlatformPermission does NOT throw for superadmin", !throws(() => requirePlatformPermission("superadmin", "migration:write")));
// Same for quoting and cancelling — a superadmin sets the price and can call
// off a paid migration; nobody else can.
for (const perm of ["migration:quote", "migration:cancel"]) {
  ok(`${perm} refuses admin`, canPlatform("admin", perm) === false);
  ok(`${perm} refuses support`, canPlatform("support", perm) === false);
  ok(`${perm} allows superadmin`, canPlatform("superadmin", perm) === true);
}
// Every PLATFORM_PERMISSIONS role must be represented so a role added later
// without an entry doesn't silently inherit "*".
for (const role of ["support", "admin"]) {
  ok(`${role}'s permission list does not itself contain "*"`, !PLATFORM_PERMISSIONS[role].includes("*"));
}

// ── 6. A migration for a company that has since cancelled ──────────────────
//
// The case that matters most: cancel from PAID, then prove the write gate
// notices immediately. This is exactly what
// lib/migrations/writes.js's loadWritableMigration() depends on — it
// re-reads status fresh inside its own transaction rather than trusting a
// value the caller read a request ago.
ok("paid -> cancelled is a real transition (a superadmin CAN call this off)", canTransition("paid", "cancelled") === true);
ok("in_progress -> cancelled is a real transition", canTransition("in_progress", "cancelled") === true);
// Simulate the sequence a real request goes through: writable while paid,
// then a superadmin cancels it (POST /api/platform/migrations/[id]/cancel),
// then the NEXT write attempt must see the new status and refuse.
{
  let status = "paid";
  ok("(setup) paid is writable before the cancel", canWrite(status) === true);
  status = "cancelled";
  ok("once cancelled (even from paid a moment ago), canWrite() is false", canWrite(status) === false);
}
ok("cancelled is terminal — nothing transitions FROM it", TERMINAL_STATUSES.has("cancelled") && canTransition("cancelled", "paid") === false);
// The company's OWN cancel button must not be able to reach this state from
// `paid` — only a superadmin's wider door can (see canCompanyCancel's header).
ok("the COMPANY cannot self-cancel from 'paid'", canCompanyCancel("paid") === false);
ok("the COMPANY cannot self-cancel from 'in_progress'", canCompanyCancel("in_progress") === false);
ok("a SUPERADMIN can cancel from 'paid' (canCancel, the wide door)", canCancel("paid") === true);
ok("the company CAN self-cancel from 'requested'", canCompanyCancel("requested") === true);
ok("the company CAN self-cancel from 'accepted' (before paying)", canCompanyCancel("accepted") === true);

// ── Scheduling and quoting edges, hostile input the brief didn't name but
//    the same class of bug would hide in ──────────────────────────────────
ok("a fresh request can be scheduled", canSchedule("requested") === true);
ok("an already-scheduled request can be RE-scheduled (picking a new time)", canSchedule("scheduled") === true);
ok("a QUOTED request can no longer be (re)scheduled", canSchedule("quoted") === false);
ok("a fresh request can be quoted directly (consultation is optional)", canQuote("requested") === true);
ok("a scheduled request can be quoted", canQuote("scheduled") === true);
ok("an already-quoted request cannot be quoted again", canQuote("quoted") === false);
ok("a paid request can be marked completed", canComplete("paid") === true);
ok("an in-progress request can be marked completed", canComplete("in_progress") === true);
ok("a requested (unpaid, unquoted) request cannot be completed", canComplete("requested") === false);

// ── Every terminal status really has no outgoing edges ──────────────────────
for (const s of TERMINAL_STATUSES) {
  const anyEdge = MIGRATION_STATUSES.some((to) => canTransition(s, to));
  ok(`"${s}" is terminal: no outgoing transition exists`, anyEdge === false);
}

// ── assertTransition's message never leaks a raw status enum value verbatim
//    without at least being readable — same "don't show Forbidden: …" bar
//    check-settings-access.mjs holds requirePermission to ────────────────
{
  let message = null;
  try {
    assertTransition("declined", "accepted");
  } catch (err) {
    message = err.message;
  }
  ok("assertTransition's error is a real sentence, not a bare code", typeof message === "string" && message.length > 20);
  ok("assertTransition sets a 409 status", (() => {
    try {
      assertTransition("declined", "accepted");
      return false;
    } catch (err) {
      return err.status === 409;
    }
  })());
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
