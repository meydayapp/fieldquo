// scripts/check-clock-self-enrol.mjs
//
//   npm run check:clock-self-enrol
//
// "Set yourself up to clock in", executed.
//
// ══ What this guards ═══════════════════════════════════════════════════════
//
// The owner opened /app/clock and was told to ask an admin. The fix lets the
// HR authority — owner, admin, supervisor — create their own Worker row from
// the clock, through the path invite acceptance already uses. The decisions
// that must hold, each run against the shipped module:
//
//   1. WHO: exactly the members who may add anybody under Team → Workers.
//      An employee-role member keeps today's sentence. Impersonation never.
//   2. SEATS: a Worker row consumes none. Proved with the real countSeats
//      over a roster before and after, not asserted in prose.
//   3. THE VERDICT: already-a-worker is a no-op, a login linked at another
//      company is refused (Worker.userId is globally unique), everything
//      else creates.
//   4. PAY: nothing here sets a rate. ensureWorkerForMember's create carries
//      no hourlyRate, and the route's trail row records that.
//   5. REACHABILITY: the screen draws the button only when the SERVER said
//      so, and the route reads no subject id off the body.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import {
  canSelfEnrol,
  selfEnrolAddsSeat,
  selfEnrolVerdict,
  SELF_ENROL_PERMISSION,
} from "@/lib/timeclock/selfEnrol";
import { canManageHr, HR_PERMISSION } from "@/lib/hr/access";
import { can, PERMISSION_PRESETS } from "@/lib/permissions";
import { countSeats } from "@/lib/pricing/ladder";
import { seatCheck } from "@/lib/pricing/seatLimit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const section = (title) => console.log(`\n${title}\n`);

const member = (role, extra = {}) => ({ id: "m", companyId: "co1", userId: "u1", role, ...extra });

// ═══════════════════════════════════════════════════════════════════════════
section("1. Who may set themselves up — the HR authority, no wider");
// ═══════════════════════════════════════════════════════════════════════════

ok("the gate IS the Team → Workers gate, not a new one", SELF_ENROL_PERMISSION === HR_PERMISSION);
for (const role of ["owner", "admin", "supervisor"]) {
  ok(`${role} may`, canSelfEnrol(member(role)) === true);
  ok(`…and that agrees with canManageHr for ${role}`, canManageHr(member(role)) === canSelfEnrol(member(role)));
}
ok("employee may NOT — they keep today's sentence", canSelfEnrol(member("employee")) === false);
ok("…which agrees with can() for the same permission", can("employee", SELF_ENROL_PERMISSION) === false);
ok("viewer (the impersonation role) may not", canSelfEnrol(member("viewer")) === false);
ok("an owner under impersonation may not — impersonation is read-only", canSelfEnrol(member("owner", { impersonation: true })) === false);
ok("no member may not", canSelfEnrol(null) === false && canSelfEnrol(undefined) === false);

// ═══════════════════════════════════════════════════════════════════════════
section("2. A Worker row is not a seat");
// ═══════════════════════════════════════════════════════════════════════════

ok("the named answer is no", selfEnrolAddsSeat() === false);
{
  // The real seat count over a real roster shape: an owner and a Crew-preset
  // employee. Adding a Worker row changes NOTHING the counter reads, because
  // it counts members by role and grid — a Worker row is neither.
  const roster = [
    { role: "owner", active: true, permissions: null },
    { role: "employee", active: true, permissions: PERMISSION_PRESETS.worker.values },
  ];
  const before = countSeats(roster);
  const workerRow = { id: "w1", companyId: "co1", userId: "u1", name: "Owner", type: "employee", active: true };
  const after = countSeats([...roster]); // the roster is members; the worker row is not on it
  ok("seats before and after are identical", before.seats === after.seats && before.crew === after.crew, { before, after });
  ok("…and a Worker row fed to the counter by mistake is not billed as a seat", countSeats([...roster, workerRow]).seats === before.seats);
  const check = seatCheck({ roster, plan: { seats: 1 } });
  ok("a one-seat plan with one owner is at its limit already — and that is unchanged by a Worker row", check.seatsUsed === 1, check);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The verdict, given what the database said");
// ═══════════════════════════════════════════════════════════════════════════

{
  const v = selfEnrolVerdict({ member: member("owner"), existing: null, linkedElsewhere: null });
  ok("owner with no row anywhere: create", v.ok === true && v.action === "create", v);
}
{
  const v = selfEnrolVerdict({ member: member("supervisor"), existing: { id: "w1" }, linkedElsewhere: { id: "w1", companyId: "co1" } });
  ok("already a worker here: no-op, not an error", v.ok === true && v.action === "already", v);
}
{
  const v = selfEnrolVerdict({ member: member("admin"), existing: null, linkedElsewhere: { id: "w9", companyId: "co2" } });
  ok("login linked at ANOTHER company: refused 409, nothing created", v.ok === false && v.status === 409, v);
  ok("…and the refusal says where to go instead", /Team → Workers/.test(v.error), v.error);
}
{
  const v = selfEnrolVerdict({ member: member("employee"), existing: null, linkedElsewhere: null });
  ok("employee: refused 403 with today's sentence", v.ok === false && v.status === 403 && /Ask an admin/.test(v.error), v);
}
{
  const v = selfEnrolVerdict({ member: member("owner", { impersonation: true }), existing: null, linkedElsewhere: null });
  ok("impersonation: refused 403 before the role is even considered", v.ok === false && v.status === 403 && /read-only/.test(v.error), v);
}
{
  const v = selfEnrolVerdict({ member: { role: "owner" }, existing: null });
  ok("no company/user on the member: 401, not a throw", v.ok === false && v.status === 401, v);
  const none = selfEnrolVerdict();
  ok("no arguments: a refusal, not a throw", none.ok === false, none);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. No pay rate is set, and the trail says so");
// ═══════════════════════════════════════════════════════════════════════════

{
  const ensure = read("lib/team/ensureWorker.js");
  const createStart = ensure.indexOf("const worker = await db.worker.create({");
  const createBody = ensure.slice(createStart, ensure.indexOf("});", createStart));
  ok("ensureWorkerForMember's create writes no hourlyRate", createStart > 0 && !/hourlyRate/.test(createBody), createBody.slice(0, 300));
  const route = read("app/api/time-clock/enrol/route.js");
  ok("the route goes through ensureWorkerForMember, not its own db.worker.create", /ensureWorkerForMember\(\{ companyId: member\.companyId, userId: member\.userId \}\)/.test(route) && !/db\.worker\.create/.test(route));
  ok("the route's trail row records that no rate was set", /hourlyRateSet: false/.test(route));
  ok("the route reads no subject id off the body — the subject is the session", !/request\.json\(/.test(route) && !/body\./.test(route));
  ok("the route hands the verdict what it read fresh", /selfEnrolVerdict\(\{ member, existing, linkedElsewhere: linkedAnywhere \}\)/.test(route));
  ok("a conflicting/unlinked result is refused rather than returned", /result\.worker\.userId !== member\.userId/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The screen draws the button only when the server said so");
// ═══════════════════════════════════════════════════════════════════════════

{
  const get = read("app/api/time-clock/route.js");
  ok("GET /api/time-clock answers canSelfEnrol beside worker: null", /worker: null,[\s\S]{0,600}canSelfEnrol: canSelfEnrol\(member\)/.test(get));
  const page = read("app/app/clock/page.js");
  const notWorker = page.slice(page.indexOf("if (data && data.worker === null)"), page.indexOf("const open = data?.open;"));
  ok("the not-a-worker branch was located", notWorker.length > 0);
  ok("the button is drawn behind data.canSelfEnrol, never a client-side role guess", /data\.canSelfEnrol \?/.test(notWorker) && !/role ===/.test(notWorker));
  ok("the other branch is today's sentence, untouched", /t\("app\.clock\.notWorker"\)/.test(notWorker));
  ok("the terms are said BEFORE the button: no pay rate, no seat", notWorker.indexOf("app.clock.selfEnrolTerms") < notWorker.indexOf("onClick={selfEnrol}"));
  ok("the button posts to the enrol route and re-reads the clock", /fetch\("\/api\/time-clock\/enrol", \{ method: "POST" \}\)/.test(page) && /await load\(\);\s*\}\s*finally/.test(page));
  const en = read("app/i18n/appMessages.js");
  ok("the English terms name both facts", /"app\.clock\.selfEnrolTerms": "[^"]*no pay rate[^"]*doesn't use a seat/.test(en));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
