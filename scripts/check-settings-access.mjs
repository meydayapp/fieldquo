// scripts/check-settings-access.mjs
//
//   npm run check:settings-access
//
// The settings area's permission story, executed rather than described.
//
// Three things this has to prove, in order of how expensive being wrong is:
//
//   1. THE OWNER'S SCREEN DID NOT CHANGE. Every row, every capability, every
//      time. A permission sweep that quietly takes something away from the
//      person paying for the product is the worst possible outcome, and it is
//      the one nobody notices in review.
//
//   2. HIDING IS NOT THE GATE. For every row this removes from the sidebar,
//      the route behind it is grepped for its own server-side check. AGENTS.md:
//      hiding buttons is not access control. If a row is hidden and its route
//      is open, this fails — that is the pairing, asserted rather than trusted.
//
//   3. NO RAW PERMISSION STRINGS REACH A USER. requirePermission used to throw
//      `Forbidden: missing permission "workarea:assign"` straight into a toast.
//
// The predicates are IMPORTED from lib/permissions/settingsAccess.js, not
// restated here. A restatement agrees with the code the day it is written and
// stops agreeing later, which is the failure mode this file exists to catch.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SETTINGS_ROW_CAPABILITY,
  SETTINGS_CAPABILITIES,
  canSee,
  canChange,
  filterSettingsGroups,
} from "@/lib/permissions/settingsAccess";
import {
  requirePermission,
  permissionDenialMessage,
  PERMISSIONS,
} from "@/lib/permissions";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let fail = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${msg}${detail ? `  ${detail}` : ""}`);
  if (!cond) fail++;
};

const OWNER = { role: "owner" };
const ADMIN = { role: "admin" };
const SUPERVISOR = { role: "supervisor" };
const EMPLOYEE = { role: "employee" };
const SUPPORT = { role: "viewer", impersonation: true };

// ── 1. The owner's screen is untouched ─────────────────────────────────────

console.log("\nThe owner path\n");

for (const capability of SETTINGS_CAPABILITIES) {
  ok(canSee(OWNER, capability) && canChange(OWNER, capability),
    `owner holds "${capability}" — sees it and can change it`);
}

// Parsed from the component, so a row added tomorrow is covered without anyone
// remembering to list it here.
const sidebarSrc = read("app/components/layout/SettingsSidebar.js");
const rowKeys = [
  ...sidebarSrc.matchAll(/key:\s*"(app\.settings\.[A-Za-z0-9]+)",\s*href:/g),
].map((m) => m[1]);

ok(rowKeys.length >= 30, "parsed the settings sidebar rows", `${rowKeys.length} rows`);

const groups = [{ key: "g", items: rowKeys.map((key) => ({ key, href: `/x/${key}` })) }];
const ownerRows = filterSettingsGroups(groups, OWNER).flatMap((g) => g.items);
ok(ownerRows.length === rowKeys.length,
  "an owner still sees every settings row",
  `${ownerRows.length}/${rowKeys.length}`);
const adminRows = filterSettingsGroups(groups, ADMIN).flatMap((g) => g.items);
ok(adminRows.length === rowKeys.length,
  "so does an admin — PERMISSIONS.admin is ['*'] and nothing here narrows that");

ok(PERMISSIONS.owner.includes("*") && PERMISSIONS.admin.includes("*"),
  "…which is only true because owner/admin are still wildcards");

// ── 2. Everyone else, and the pairing with the server ──────────────────────

console.log("\nWhat a limited member sees\n");

const supervisorRows = filterSettingsGroups(groups, SUPERVISOR).flatMap((g) => g.items);
const employeeRows = filterSettingsGroups(groups, EMPLOYEE).flatMap((g) => g.items);

ok(employeeRows.length < rowKeys.length,
  "an employee sees fewer rows than an owner",
  `${employeeRows.length}/${rowKeys.length}`);
ok(supervisorRows.length > employeeRows.length,
  "a supervisor sees more than an employee and fewer than an owner",
  `${supervisorRows.length} rows`);

const named = (rows, key) => rows.some((r) => r.key === key);

for (const [key, capability] of Object.entries(SETTINGS_ROW_CAPABILITY)) {
  ok(rowKeys.includes(key), `${key} is a row that actually exists in the sidebar`);
  ok(named(employeeRows, key) === canSee(EMPLOYEE, capability),
    `${key}: employee row visibility follows "${capability}"`,
    canSee(EMPLOYEE, capability) ? "visible" : "hidden");
  ok(named(supervisorRows, key) === canSee(SUPERVISOR, capability),
    `${key}: supervisor row visibility follows "${capability}"`,
    canSee(SUPERVISOR, capability) ? "visible" : "hidden");
}

// The four screens the owner asked about, spelled out — a regression that
// re-showed billing to an employee should name itself, not hide inside a loop.
ok(!named(employeeRows, "app.settings.accountBilling"), "employee: Account & Billing is hidden");
ok(!named(employeeRows, "app.settings.refer"), "employee: Refer & Earn is hidden");
ok(!named(employeeRows, "app.settings.payroll"), "employee: Payroll is hidden");
ok(!named(employeeRows, "app.settings.bookingPage"), "employee: Booking Page is hidden");
ok(named(employeeRows, "app.settings.team"), "employee: Manage Team stays — the roster is reasonable to see");
ok(named(employeeRows, "app.settings.availability"), "employee: Availability stays — it is their own hours");
ok(named(employeeRows, "app.settings.company"), "employee: Company Settings stays, rendered read-only");
ok(named(employeeRows, "app.settings.workAreas"), "employee: Work Areas stays, rendered read-only");
ok(named(supervisorRows, "app.settings.bookingPage"),
  "supervisor: Booking Page stays — they hold user:manage, which is what the route checks");
ok(!named(supervisorRows, "app.settings.accountBilling"),
  "supervisor: Account & Billing is hidden — holding user:manage is not authority over the card");

console.log("\nHiding is not the gate — every hidden row's route enforces it too\n");

// route file → the expression that must appear in it.
const SERVER_ENFORCEMENT = [
  ["app/api/settings/referral/route.js", "isBillingAdmin(member.role)", "Refer & Earn (read)"],
  ["app/api/settings/referral/invite/route.js", '["owner", "admin"].includes(member.role)', "Refer & Earn (invite)"],
  ["app/api/settings/plans/route.js", "isBillingAdmin(member.role)", "plan list"],
  ["app/api/settings/subscription/route.js", "isBillingAdmin(member.role)", "current plan"],
  ["app/api/settings/payroll-components/route.js", "isPayrollAdmin(member.role)", "payroll settings"],
  ["app/api/event-types/route.js", 'requirePermission(member.role, "user:manage")', "booking types"],
  ["app/api/event-types/[id]/route.js", 'requirePermission(member.role, "user:manage")', "booking type + visit fee"],
  ["app/api/settings/business-info/route.js", 'requirePermission(member.role, "user:manage")', "company settings"],
  ["app/api/settings/members/route.js", 'requirePermission(member.role, "user:manage")', "adding a team member"],
  ["app/api/custom-fields/route.js", 'requirePermission(member.role, "user:manage")', "custom fields"],
  ["app/api/work-areas/route.js", 'requirePermission(member.role, "workarea:assign")', "work areas"],
];

for (const [file, expr, label] of SERVER_ENFORCEMENT) {
  let src = "";
  try {
    src = read(file);
  } catch {
    /* reported by the assertion below */
  }
  ok(src.includes(expr), `${label}: ${file} enforces it server-side`, expr);
}

// ── 3. Impersonation: view everything, edit nothing ────────────────────────

console.log("\nA read-only support session (non-negotiable #3)\n");

const supportRows = filterSettingsGroups(groups, SUPPORT).flatMap((g) => g.items);
ok(supportRows.length === rowKeys.length,
  "the platform console still sees every settings row",
  `${supportRows.length}/${rowKeys.length}`);
for (const capability of SETTINGS_CAPABILITIES) {
  ok(canSee(SUPPORT, capability), `support can SEE "${capability}"`);
  ok(!canChange(SUPPORT, capability), `support can NOT change "${capability}"`);
}
// The code generator WRITES a row. Opening the page used to run it
// unconditionally, so a support session created a referral code inside a
// customer's tenant just by looking — a write, from the console that is not
// allowed to make any. The mint must sit behind an impersonation branch.
{
  const src = read("app/api/settings/referral/route.js");
  // lastIndexOf: the first occurrence is the function's own declaration.
  const mint = src.lastIndexOf("getOrCreateReferralCode(company)");
  const branch = src.indexOf("member.impersonation");
  ok(branch !== -1 && branch < mint,
    "opening Refer & Earn under impersonation no longer mints a referral code");
  ok(/referralCode\s*\n?\s*\?\s*await db\.company\.findMany|referralCode\s*$/m.test(src) ||
      src.includes("referralCode\n    ? await db.company.findMany"),
    "…and a null code never becomes `where: { referredByCode: null }`, which matches every tenant");
}

// ── 4. No raw permission identifiers in user-facing errors ─────────────────

console.log("\nWhat a refused caller is told\n");

for (const permission of ["workarea:assign", "user:manage", "quote:convert"]) {
  let message = "";
  try {
    requirePermission("employee", permission);
  } catch (err) {
    message = err.message;
    ok(err.status === 403, `${permission}: still throws a 403-shaped error`);
    ok(err.permission === permission, `${permission}: the identifier is on the error, for logs`);
  }
  ok(message.length > 0, `${permission}: refuses an employee`);
  ok(!message.includes(permission),
    `${permission}: the message does NOT contain the raw permission name`,
    JSON.stringify(message.slice(0, 60)));
  ok(/owner|admin|supervisor/i.test(message),
    `${permission}: the message names who CAN do it`);
  ok(!/^Forbidden/.test(message), `${permission}: not "Forbidden: …"`);
}

ok(/owner|admin/i.test(permissionDenialMessage("something:unknown")),
  "an unlisted permission still gets a sentence naming who to ask",
  permissionDenialMessage("something:unknown"));

// An owner is never refused, which is the other half of "the owner path is
// identical" — the messages above only matter for people who are.
let ownerRefused = false;
try {
  requirePermission("owner", "workarea:assign");
} catch {
  ownerRefused = true;
}
ok(!ownerRefused, "an owner is never refused by requirePermission");

// ── 5. Read-only must LOOK read-only ───────────────────────────────────────

console.log("\nRead-only rendering\n");

for (const [file, label] of [
  ["app/app/settings/company/page.js", "Company Settings"],
  ["app/app/settings/work-areas/page.js", "Work Areas"],
  ["app/app/settings/custom-fields/page.js", "Custom Fields"],
]) {
  const src = read(file);
  ok(src.includes("useSettingsAccess"), `${label}: asks who is looking`);
  ok(!/disabled=\{!can/.test(src),
    `${label}: does not fall back to disabling inputs`);
}

const companySrc = read("app/app/settings/company/page.js");
ok(companySrc.includes("CompanyReadOnly"),
  "Company Settings has a separate read-only view, not a disabled form");
ok(companySrc.includes("hasBusinessHours"),
  "…and it never invents opening hours for a company that stated none");

console.log(
  fail === 0 ? "\nALL PASS\n" : `\n${fail} failure(s)\n`,
);
process.exitCode = fail === 0 ? 0 : 1;
