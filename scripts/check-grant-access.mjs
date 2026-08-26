// scripts/check-grant-access.mjs
//
// A Dispatcher could re-grade a colleague.
//
// QA logged in as Jonny, a Dispatcher, opened Daniel's row on Manage Team and
// moved him from "Worker (limited access)" to "Worker". That hands over every
// client's contact details and every price in the company. It went through:
// the route was gated on `user:manage`, which SUPERVISORS hold — it means "may
// run a crew" and is checked in a hundred places — plus the hierarchy rules,
// which only say "strictly below you". An employee is strictly below a
// supervisor, so nothing objected.
//
// The asymmetry is what makes it a bug rather than a policy choice: the same
// Dispatcher could NOT have deactivated Daniel afterwards, because
// canRevokeAccess is owner/admin. Granting access was the wider of the two
// powers and it was the one left open.
//
// The owner's ruling: a dispatcher's job is assigning work, not deciding who
// sees what. canGrantAccess is that rule, and these assert it holds on the
// server, that the screen offers exactly what the server accepts, and — the
// part that actually rots — that INVITING is still a supervisor's job. A fix
// that quietly took invites away too would look identical from the route file.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-grant-access.mjs

import { readFileSync } from "node:fs";
import {
  canGrantAccess,
  canRevokeAccess,
  assignableRoles,
  clampPermissions,
  validateRoleChange,
} from "@/lib/permissions/roleManagement";
import { validateInvite } from "@/lib/permissions/inviteGuard";
import { can } from "@/lib/permissions";

let pass = 0;
const fails = [];
const ok = (label, cond) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(label);

const ROLES = ["owner", "admin", "supervisor", "employee"];

console.log("\ncanGrantAccess — the rule itself");
ok("owner may grant", canGrantAccess("owner") === true);
ok("administrator may grant", canGrantAccess("admin") === true);
ok("supervisor may NOT grant", canGrantAccess("supervisor") === false);
ok("worker may NOT grant", canGrantAccess("employee") === false);
ok("an unknown role may not grant", canGrantAccess("cousin") === false);
ok("undefined may not grant", canGrantAccess(undefined) === false);

// The asymmetry that was the bug. Assert the two now agree for every role —
// not that they are the same function, which they deliberately are not.
for (const r of ROLES) {
  ok(
    `${r}: granting and revoking agree`,
    canGrantAccess(r) === canRevokeAccess(r),
  );
}

console.log("\nThe hole it closes");
// The exact QA walkthrough. Rank alone said yes; this is what says no.
const jonny = { id: "m_jonny", role: "supervisor", permissions: {} };
const daniel = { id: "m_daniel", role: "employee", permissions: {} };
ok(
  "user:manage still says yes (so the entry gate was never the fix)",
  can(jonny.role, "user:manage") === true,
);
ok(
  "the hierarchy rules still say yes (rank is not the fix either)",
  validateRoleChange({
    actor: jonny,
    target: daniel,
    nextRole: "employee",
    ownerCount: 1,
  }).ok === true,
);
ok("canGrantAccess is what refuses", canGrantAccess(jonny.role) === false);

console.log("\nWhat a supervisor KEEPS");
// If this section ever fails, the fix went too far: a Dispatcher who cannot
// staff their own crew is a worse product than the bug was.
const invite = validateInvite({
  actor: jonny,
  role: "employee",
  permissions: { quotes: "view_only" },
  laborCostPerHour: null,
});
ok("a supervisor may still invite a worker", invite.ok === true);
ok(
  "a supervisor still may not invite a peer",
  validateInvite({ actor: jonny, role: "supervisor", permissions: {} }).ok ===
    false,
);
ok(
  "assignableRoles is untouched for supervisors",
  JSON.stringify(assignableRoles("supervisor")) === JSON.stringify(["employee"]),
);
ok(
  "clampPermissions still clamps rather than refusing",
  clampPermissions("supervisor", { quotes: "view_only" }, {
    quotes: "view_create_edit_delete",
  }).quotes === "view_only",
);

console.log("\nThe route enforces it, and the screen agrees");
const route = readFileSync(
  "app/api/settings/members/[id]/role/route.js",
  "utf8",
);
ok(
  "PATCH /members/[id]/role imports canGrantAccess",
  /import \{[^}]*canGrantAccess/s.test(route),
);
ok("PATCH refuses when it is false", /if \(!canGrantAccess\(/.test(route));
// Ordering matters: the refusal has to come before the member is loaded and
// before anything is written, not as a branch somewhere inside the handler.
ok(
  "the refusal precedes the target lookup",
  route.indexOf("if (!canGrantAccess(") <
    route.indexOf("const target = await db.member.findUnique"),
);
ok(
  "GET returns canGrantAccess so the UI need not re-derive it",
  /canGrantAccess: canGrantAccess\(actorMember\?\.role\)/.test(route),
);

const screen = readFileSync("app/app/settings/team/page.js", "utf8");
ok(
  "Manage Team gates canEdit on it",
  /function canEdit\([^)]*\) \{\s*if \(!canGrantAccess\(/.test(screen),
);
ok(
  "the read-only badge explains why rather than just appearing",
  screen.includes("app.setTeam.accessOwnerOnlyHint"),
);

// The general member PATCH is the obvious way around a gate on one route.
const general = readFileSync("app/api/settings/members/route.js", "utf8");
ok(
  "the general member PATCH still refuses role and permissions outright",
  /body\.role !== undefined \|\| body\.permissions !== undefined/.test(general),
);

const messages = readFileSync("app/i18n/appMessages.js", "utf8");
for (const lang of ["en", "fr"]) {
  const block = messages.split(`const ${lang} = {`)[1] || "";
  ok(
    `app.setTeam.accessOwnerOnlyHint exists in ${lang}`,
    block.split("\nconst ")[0].includes('"app.setTeam.accessOwnerOnlyHint"'),
  );
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
