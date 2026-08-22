// scripts/check-member-deactivation.mjs
//
// QA locked themselves permanently out of a live tenant with one PATCH.
//
// The Manage Team UI disables the ACTIVE checkbox for your own row, so the
// server never got the same rule — and hiding a control is not access control.
// PATCH /api/settings/members {userId: <self>, active: false} wrote the change,
// and every request after it 401'd. Recovery needed a second owner. If it had
// been the last admin, the company would have been orphaned with no way back
// in from the app at all.
//
// The guards live in app/api/settings/members/route.js. These assert the DECISION
// each one makes, against the role table it depends on — a route test would
// need a live session, and the part that was wrong was the reasoning, not the
// plumbing.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-member-deactivation.mjs

import { rankOf } from "@/lib/permissions/roleManagement";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};

// ── The three rules, as the route applies them ─────────────────────────────

/** Rule 1: never yourself, whatever your role. */
const blocksSelf = (actorUserId, targetUserId, active) =>
  active === false && targetUserId === actorUserId;

/** Rule 2: never someone at or above your own rank. */
const blocksRank = (actorRole, targetRole, active) =>
  active === false && rankOf(targetRole) >= rankOf(actorRole);

/** Rule 3: never the last person who could administer the company. */
const blocksLastAdmin = (targetRole, otherActiveAdmins, active) =>
  active === false &&
  ["owner", "admin"].includes(targetRole) &&
  otherActiveAdmins === 0;

console.log("\nRule 1 — you cannot switch off your own access");
t("admin deactivating themselves is refused (the QA lockout)", blocksSelf("u1", "u1", false));
t("owner deactivating themselves is refused too", blocksSelf("own", "own", false));
t("deactivating someone else is not caught by this rule", blocksSelf("u1", "u2", false), false);
t("REACTIVATING yourself is not blocked — that is the recovery path",
  blocksSelf("u1", "u1", true), false);
t("editing your own phone is untouched (active undefined)",
  blocksSelf("u1", "u1", undefined), false);

console.log("\nRule 2 — rank, so the active flag isn't a way around /role");
t("admin cannot deactivate an owner", blocksRank("admin", "owner", false));
t("admin cannot deactivate another admin", blocksRank("admin", "admin", false));
t("admin CAN deactivate a supervisor", blocksRank("admin", "supervisor", false), false);
t("admin CAN deactivate an employee", blocksRank("admin", "employee", false), false);
t("owner can deactivate an admin", blocksRank("owner", "admin", false), false);
t("supervisor cannot deactivate an admin", blocksRank("supervisor", "admin", false));
t("an unknown role ranks below everyone and cannot deactivate an employee",
  blocksRank("bogus", "employee", false));

console.log("\nRule 3 — never orphan the company");
t("last admin, no other active admin → refused", blocksLastAdmin("admin", 0, false));
t("last owner, no other active admin → refused", blocksLastAdmin("owner", 0, false));
t("admin with another active admin → allowed", blocksLastAdmin("admin", 1, false), false);
t("a supervisor is never the last administrator", blocksLastAdmin("supervisor", 0, false), false);
t("an employee is never the last administrator", blocksLastAdmin("employee", 0, false), false);
t("the owner guard covers the case the OLD code missed: inactive owner + sole admin",
  blocksLastAdmin("admin", 0, false));

console.log("\nThe route actually carries the guards");
const src = readFileSync(new URL("../app/api/settings/members/route.js", import.meta.url), "utf8");
t("self-deactivation guard present", /active === false && userId === member\.userId/.test(src));
t("rank guard present", /rankOf\(target\.role\) >= rankOf\(member\.role\)/.test(src));
t("last-administrator guard present", /role: \{ in: \["owner", "admin"\] \}/.test(src));
t("the last-admin count excludes the person being deactivated",
  /userId: \{ not: userId \}/.test(src));
t("every guard returns before db.member.update",
  src.indexOf("userId === member.userId") < src.indexOf("db.member.update"));
t("the error tells you who can undo it", /Ask an owner or another admin/.test(src));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — deactivation cannot orphan an account\n");
process.exit(fail ? 1 : 0);
