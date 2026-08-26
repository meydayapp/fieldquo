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
//   2b. AND THE CONVERSE — because asserting one direction is what let nine
//      rows through. "Hidden ⇒ gated" says nothing about a row that is SHOWN,
//      so nine screens stayed in an employee's sidebar whose GET answered 403:
//      the price book, cabinet rates, email and PDF templates, the sending
//      domain, follow-ups, the website, the receptionist, expense tracking —
//      and Overhead, which nobody had reported and this assertion found.
//      Being visible is a promise that the screen opens. So every row that is
//      NOT hidden has its page's own fetch() calls resolved to route files, and
//      each of those reads must let a plain member through — or the row must be
//      named in SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS with the reason.
//
//   2c. AND IMPERSONATION SURVIVES BOTH. canSee() waves a support session
//      through every row (non-negotiable #3), which is a lie if the route
//      behind the row refuses role "viewer". Every hidden row whose read
//      refuses must carve impersonation out of that read — and no WRITE in
//      those files may carry the carve-out.
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
  SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS,
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
// href as well as key: section 2b has to open the page each row points at.
const rows = [
  ...sidebarSrc.matchAll(
    /key:\s*"(app\.settings\.[A-Za-z0-9]+)",\s*href:\s*"([^"]+)"/g,
  ),
].map((m) => ({ key: m[1], href: m[2] }));
const rowKeys = rows.map((r) => r.key);

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
  // The rows added after QA walked the sidebar as a Worker. The first four
  // refuse the READ as well; the last three gate every write while leaving the
  // read open, which is written down beside them in settingsAccess.js.
  ["app/api/settings/cabinet-rates/route.js", 'requirePermission(member.role, "user:manage")', "cabinet rates"],
  ["app/api/settings/email-domain/route.js", 'requirePermission(member.role, "user:manage")', "sending domain"],
  ["app/api/settings/website/route.js", 'requirePermission(member.role, "user:manage")', "website builder"],
  ["app/api/settings/voice/route.js", 'requirePermission(member.role, "user:manage")', "AI receptionist"],
  ["app/api/overhead/fixed-costs/route.js", 'requirePermission(member.role, "user:manage")', "overhead (fixed costs)"],
  ["app/api/debt/route.js", 'requirePermission(member.role, "user:manage")', "overhead (debt)"],
  ["app/api/settings/leave-policies/route.js", "isLeaveAdmin(member.role)", "leave policies"],
  ["app/api/settings/document-templates/route.js", 'requirePermission(member.role, "user:manage")', "email + PDF templates (writes)"],
  ["app/api/settings/follow-up-rules/route.js", 'requirePermission(member.role, "user:manage")', "follow-up rules (writes)"],
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

// ── 2b. Being visible is a promise: the screen has to OPEN ─────────────────
//
// Nothing below is restated from the routes. Each row's page is read, the
// /api/… literals it fetches are resolved to route files, and each of those
// files' GET is examined for a refusal. A row added tomorrow is covered the day
// it is added; a route that grows a gate next month fails the row that points
// at it, which is the direction that was missing.

/** Source with comments and string bodies removed, so prose can't match. */
function stripNoise(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      let body = "";
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        body += src[i];
        i++;
      }
      i++;
      // Kept, not blanked: the gate expressions section 2 greps for include
      // string arguments — requirePermission(role, "user:manage").
      out += quote + body.replace(/[{}]/g, "") + quote;
      continue;
    }
    if (c === "`") {
      // Template literal: dropped whole, `${…}` and all. Nothing inside one is
      // a permission gate, and its braces are what would unbalance the scan.
      i++;
      let depth = 0;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          depth++;
          i += 2;
          continue;
        }
        if (src[i] === "}" && depth > 0) {
          depth--;
          i++;
          continue;
        }
        if (src[i] === "`" && depth === 0) {
          i++;
          break;
        }
        i++;
      }
      out += '""';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The body of `function NAME(...) { … }`, braces matched. Null if absent. */
function functionBody(src, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
  if (!match) return null;

  // Walk the PARAMETER list to its closing paren before looking for the body's
  // brace. A destructured parameter — requireAdmin(request, { read = false })
  // — opens a brace first, and matching that one returns the parameter as if it
  // were the function. Caught by testing this file against itself: with the
  // naive version, un-hiding a row whose route plainly refuses still passed,
  // which is the exact class of silent pass section 2b exists to end.
  let cursor = match.index + match[0].length - 1;
  let parens = 0;
  for (; cursor < src.length; cursor++) {
    if (src[cursor] === "(") parens++;
    else if (src[cursor] === ")") {
      parens--;
      if (parens === 0) {
        cursor++;
        break;
      }
    }
  }

  const open = src.indexOf("{", cursor);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

// What refusing a caller looks like in this codebase. Both halves matter: the
// helpers that THROW a 403 (requirePermission and friends) and the handlers
// that RETURN one — /api/expenses/summary refuses on hasLevel() and answers a
// plain NextResponse, which no list of helper names would have caught.
const REFUSAL_PATTERNS = [
  /requirePermission\s*\(/,
  /requireToggle\s*\(/,
  /requireLevel\s*\(/,
  /requireCatalogueWrite\s*\(/,
  /isBillingAdmin\s*\(/,
  /isPayrollAdmin\s*\(/,
  /status:\s*403/,
];

// A hand-written 403 is the ambiguous one, because plenty of them are about
// WHOSE record you asked for rather than about you: /api/working-hours and
// /api/availability both refuse `?userId=` for a teammate while serving your own
// row happily, and counting those would flag Availability — a screen that is
// exactly as usable as it claims to be — and teach the next reader that this
// check cries wolf. So a bare 403 is only a gate when nothing above it in the
// same function has looked at the request's target.
const TARGET_SCOPED = /searchParams|\brequested\b|\bparams\b/;

/**
 * Does this route's GET refuse somebody?
 *
 * Follows one level of local helper — `await requireAdmin(request)` — because
 * that is where five of these routes keep their gate.
 *
 * @returns { hasGet, refuses, evidence, impersonation }
 */
function readGate(file) {
  const src = stripNoise(read(file));
  if (!/export\s+async\s+function\s+GET\s*\(/.test(src))
    return { hasGet: false, refuses: false, evidence: "", impersonation: false };

  const body = functionBody(src, "GET");
  // A GET we could not parse must never read as "open" — that is a silent pass.
  if (body === null)
    return { hasGet: true, unparsed: true, refuses: true, evidence: "could not parse GET", impersonation: false };

  const scopes = [{ where: "GET", text: body }];
  for (const call of body.matchAll(/await\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const helper = functionBody(src, call[1]);
    if (helper) scopes.push({ where: `${call[1]}()`, text: helper });
  }

  for (const scope of scopes) {
    for (const pattern of REFUSAL_PATTERNS) {
      const hit = pattern.exec(scope.text);
      if (!hit) continue;
      const bare = pattern.source.startsWith("status");
      if (bare && TARGET_SCOPED.test(scope.text.slice(0, hit.index))) continue;
      return {
        hasGet: true,
        refuses: true,
        evidence: `${scope.where}: ${scope.text
          .slice(Math.max(0, hit.index - 30), hit.index + 50)
          .replace(/\s+/g, " ")
          .trim()}`,
        impersonation: scopes.some((s) => s.text.includes("member.impersonation")),
      };
    }
  }
  return { hasGet: true, refuses: false, evidence: "", impersonation: false };
}

/** The /api/… route files a page fetches, resolved on disk. */
function routesFetchedBy(pageFile) {
  const src = read(pageFile);
  const found = new Set();
  for (const match of src.matchAll(/["'`](\/api\/[^"'`]*)/g)) {
    // Query string and interpolated segments dropped: "/api/expenses/summary
    // ?month=${…}" is still /api/expenses/summary, and missing it is how the
    // one gate on the expense screen would have gone unexamined.
    const segments = match[1].split("?")[0].split("/").filter(Boolean).slice(1);
    let dir = "app/api";
    for (const segment of segments) {
      if (segment.includes("$") || segment.includes("`")) break;
      if (fs.existsSync(path.join(ROOT, dir, segment))) {
        dir = path.join(dir, segment);
        continue;
      }
      // A dynamic segment — /api/settings/document-templates/${id}.
      const dynamic = fs
        .readdirSync(path.join(ROOT, dir))
        .find((entry) => entry.startsWith("["));
      if (!dynamic) break;
      dir = path.join(dir, dynamic);
    }
    const route = path.join(dir, "route.js");
    if (fs.existsSync(path.join(ROOT, route))) found.add(route);
  }
  return [...found];
}

function pageFileFor(href) {
  const candidate = `app${href}/page.js`;
  return fs.existsSync(path.join(ROOT, candidate)) ? candidate : null;
}

console.log("\nEvery row that is SHOWN opens for the person it is shown to\n");

// The allow-list is only honest if it points at real, still-refusing rows.
for (const key of Object.keys(SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS)) {
  ok(rowKeys.includes(key), `${key}: allow-listed row exists in the sidebar`);
  ok(!SETTINGS_ROW_CAPABILITY[key],
    `${key}: allow-listed and hidden are exclusive — a row cannot be both`);
}

let examined = 0;
for (const row of rows) {
  if (SETTINGS_ROW_CAPABILITY[row.key]) continue; // hidden; covered by 2 and 2c

  const pageFile = pageFileFor(row.href);
  ok(!!pageFile, `${row.key}: the row points at a page that exists`, row.href);
  if (!pageFile) continue;

  const refusing = routesFetchedBy(pageFile)
    .map((file) => ({ file, ...readGate(file) }))
    .filter((r) => r.hasGet && r.refuses);
  examined++;

  const excuse = SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS[row.key];
  if (excuse) {
    // Asserted the other way round on purpose: when the route stops refusing,
    // the entry is stale and should be deleted rather than left to describe a
    // restriction that no longer exists.
    ok(refusing.length > 0,
      `${row.key}: still partially refuses, so its allow-list entry still applies`,
      excuse);
    continue;
  }

  ok(refusing.length === 0,
    `${row.key}: visible, and nothing its page reads refuses a plain member`,
    refusing.map((r) => `${r.file} — ${r.evidence}`).join(" | "));
}

ok(examined >= 15,
  "…and that examined a real number of rows, not an empty list",
  `${examined} visible rows`);

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

// ── 2c. …and the rows it sees have to open for it ──────────────────────────
//
// canSee() returning true for a support session is a claim about the SERVER.
// The platform role is "viewer", which holds no permission at all, so any read
// gated on can()/requirePermission refuses it unless the read says otherwise.
// Every hidden row whose read refuses is checked for that carve-out here.

console.log("\n…and every row it is shown actually opens for it\n");

// Reads that still refuse a support session. Listed by FILE, and asserted to be
// exactly the set that still refuses — so fixing one fails this until the line
// is deleted, and a new one fails it the day it appears. Named rather than
// skipped: an untested gap nobody wrote down is how the first nine rows
// survived a sweep.
//
// All of these sit outside the settings API that the impersonation pass covered.
// Each costs the console one panel, not the screen, except Leave and Overhead
// which are the whole screen.
const IMPERSONATION_STILL_REFUSED = [
  "app/api/settings/voice/topup/route.js", // the credit balance panel only
  // Costs the console NOTHING. Its GET is not a read at all — it settles a
  // Stripe setup session and arms automatic card charging, which is precisely
  // the thing a read-only support session must never be able to do. Everything
  // the console needs to SEE about automatic top-up already travels on
  // /api/settings/voice, whose read does admit an impersonation session.
  "app/api/settings/voice/auto-topup/route.js",
  "app/api/settings/leave-policies/route.js",
  "app/api/debt/route.js",
  "app/api/salaries/route.js", // gated on the payroll grid, which "viewer" fails
  "app/api/overhead/fixed-costs/route.js",
  "app/api/analytics/minimum-price/route.js",
];

const stillRefused = new Set();

for (const row of rows) {
  if (!SETTINGS_ROW_CAPABILITY[row.key]) continue; // shown to everyone: 2b
  const pageFile = pageFileFor(row.href);
  if (!pageFile) continue;

  const excused = [];
  const blind = routesFetchedBy(pageFile)
    .map((file) => ({ file, ...readGate(file) }))
    .filter((r) => r.hasGet && r.refuses && !r.impersonation)
    .map((r) => r.file)
    .filter((file) => {
      if (!IMPERSONATION_STILL_REFUSED.includes(file)) return true;
      stillRefused.add(file);
      excused.push(file);
      return false;
    });

  // The detail says which parts are still dark, so a passing line never reads
  // as "support sees all of this" when it doesn't.
  ok(blind.length === 0,
    `${row.key}: its read lets a read-only support session through`,
    blind.length
      ? blind.join(" | ")
      : excused.length
        ? `except, knowingly: ${excused.join(", ")}`
        : "");
}

for (const file of IMPERSONATION_STILL_REFUSED) {
  ok(stillRefused.has(file),
    `${file}: still refuses support — delete this line once it doesn't`);
}

// The other half of #3, and the one that would be a real incident: nothing that
// WRITES may have picked up the carve-out. In the five routes that share one
// gate between GET and their writes, the exemption is an argument the read opts
// into — `requireAdmin(request, { read: true })` — so this asserts no other
// handler passes it, and that no write branches on impersonation at all.
const IMPERSONATION_READS = [
  "app/api/activity/route.js",
  "app/api/settings/voice/route.js",
  "app/api/settings/website/route.js",
  "app/api/settings/email-domain/route.js",
  "app/api/settings/cabinet-rates/route.js",
];

for (const file of IMPERSONATION_READS) {
  const src = stripNoise(read(file));
  const get = functionBody(src, "GET");
  // Both halves: the GET opts in AND the gate it reaches actually branches on
  // member.impersonation. Checking only the call site would keep passing if the
  // branch inside the helper were deleted and the argument left behind.
  ok(get !== null && /impersonation|read:\s*true/.test(get) && readGate(file).impersonation,
    `${file}: the READ carves impersonation out`);

  for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
    const body = functionBody(src, verb);
    if (body === null) continue;
    ok(!/read:\s*true/.test(body),
      `${file}: ${verb} does not opt into the read-only carve-out`);
    ok(!/impersonation/.test(body),
      `${file}: ${verb} does not branch on impersonation at all`);
  }
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
