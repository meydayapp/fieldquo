// scripts/check-marketing-agency-role.mjs
//
//   npm run check:marketing-agency-role
//
// The "Marketing agency" team role (owner, 2026-10-09), EXECUTED. A company
// invites its marketing agency as a team member who may build lead funnels,
// read Marketing results and the marketing leads — at the agency API's
// privacy level — and NOTHING else: no clients, jobs, quotes, invoices,
// money, payments, messages, calls, settings, team or billing.
//
//   A. The preset, the invite guard, the seat — it is a preset in the
//      existing grid, a supervisor's invite keeps it, and it is a PAID seat.
//   B. The API boundary, executed through the REAL lib/currentMember.js (only
//      the database, Better Auth and the device sampler are stubbed —
//      scripts/impersonation-stub-hooks.mjs): every route file under app/api,
//      every exported method, asked as the agency, as the owner and as Crew.
//      The agency is let through on exactly the list written out below — an
//      oracle written here, not read back from the code — and refused on the
//      other ~1,600; nobody else is ever refused by it. Hostile spellings of
//      a path, the fallback session branch, and the marker on other tiers.
//   C. Real handlers end to end: the clients, quotes, invoices, jobs, leads,
//      payments, payouts, inbox, chat, calls, settings, team, search,
//      notifications, KPI and campaign routes answer the agency 403 without
//      touching one business row; funnels, Marketing › Leads and the role
//      route answer it 200; Marketing results drops job values unless shared.
//   D. Pages: every /app page refused except the agency's own; /app sends
//      them home; the gate is mounted around every page; the server pages
//      that read the database refuse them themselves.
//   E. The shell: the nav shows only what they can open, the phone bar is
//      theirs, they are not Crew, settings show only their language, search,
//      bell, Jennifer and the tours are not drawn.
//   F. Never notified, in no chat room.
//   G. Mutation pass: each change below must fail this check (cp backups).
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/impersonation-stub-loader.mjs scripts/check-marketing-agency-role.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

for (const k of ["STRIPE_SECRET_KEY", "OPENAI_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "RETELL_API_KEY", "CLOUDINARY_API_SECRET", "GOOGLE_CLIENT_SECRET", "META_APP_SECRET", "DATABASE_URL"]) {
  delete process.env[k];
}
globalThis.fetch = async (url) => {
  throw new Error(`network disabled in check-marketing-agency-role (${String(url).slice(0, 80)})`);
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANT = process.argv.includes("--mutant");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

let pass = 0;
const fails = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    if (!MUTANT) console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${got !== undefined ? `  got: ${JSON.stringify(got).slice(0, 600)}` : ""}`);
    if (!MUTANT) console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got).slice(0, 600)}` : ""}`);
  }
};
const section = (s) => !MUTANT && console.log(`\n${s}`);

const { rows, writes, resetImpersonationDb } = await import("./fixtures/impersonationDb.mjs");
const { authStub } = await import("./fixtures/authStub.mjs");
const { getCurrentMember } = await import("@/lib/currentMember");
const { NextRequest } = await import("next/server.js");
const perms = await import("@/lib/permissions");
const { PERMISSION_PRESETS, PRESET_TO_ROLE, PERMISSION_CATEGORIES, PERMISSION_TOGGLES } = perms;
const ma = await import("@/lib/permissions/marketingAgency");
const { presetForValues, describeAccess, emptyPermissionValues } = await import("@/lib/permissions/accessPresets");
const { clampPermissions } = await import("@/lib/permissions/roleManagement");
const { validateInvite } = await import("@/lib/permissions/inviteGuard");
const { isBillableSeat, countSeats } = await import("@/lib/pricing/ladder");
const { seatCheck } = await import("@/lib/pricing/seatLimit");
const { navRowAllowed } = await import("@/lib/permissions/nav");
const { phoneBarFor } = await import("@/lib/nav/phoneBar");
const { usesCrewShell } = await import("@/lib/nav/crewShell");
const { isCrewHome } = await import("@/lib/dashboard/crewHome");
const { canSeeSettingsRow, SETTINGS_ROW_CAPABILITY } = await import("@/lib/permissions/settingsAccess");
const { selectRecipients } = await import("@/lib/notifications/recipients");
const { NOTIFICATION_TYPES } = await import("@/lib/notifications/catalog");
const { activeRoster } = await import("@/lib/company/chat/store");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

// ── The people ─────────────────────────────────────────────────────────────
const CO = "co";
const AGENCY_GRID = { ...PERMISSION_PRESETS.marketingAgency.values };
const P = {
  agency: { id: "m-agency", userId: "u-agency", role: PRESET_TO_ROLE.marketingAgency, permissions: AGENCY_GRID },
  owner: { id: "m-owner", userId: "u-owner", role: "owner", permissions: null },
  crew: { id: "m-crew", userId: "u-crew", role: PRESET_TO_ROLE.worker, permissions: { ...PERMISSION_PRESETS.worker.values } },
  dispatcher: { id: "m-disp", userId: "u-disp", role: PRESET_TO_ROLE.dispatcher, permissions: { ...PERMISSION_PRESETS.dispatcher.values } },
  // The marker where no invite puts it, to pin the rule down.
  supervisorMarked: { id: "m-supm", userId: "u-supm", role: "supervisor", permissions: { ...PERMISSION_PRESETS.dispatcher.values, marketingAgency: true } },
  adminMarked: { id: "m-admm", userId: "u-admm", role: "admin", permissions: { marketingAgency: true } },
  ownerMarked: { id: "m-ownm", userId: "u-ownm", role: "owner", permissions: { marketingAgency: true } },
};
const COMPANY = { id: CO, authOrgId: "org", name: "Tremblay Painting", slug: "tremblay", currency: "CAD", country: "CA", defaultLanguage: "en", isDemo: false, agencyShareContacts: false, agencyShareMoney: true, createdAt: new Date("2025-01-01") };

// Reads of the company's business rows, for section C's "refused BEFORE a
// row is touched". Every other model answers the stub's empty default.
const BUSINESS = ["client", "quote", "invoice", "job", "jobVisit", "leadRequest", "payment", "payout", "expense", "messageThread", "message", "companyChatRoom", "companyChatMessage", "voiceCall", "notification", "worker", "marketingCampaign", "marketingSubscriber"];
const businessReads = [];
let memberTable = [];
function script(personaKey, { fallback = false } = {}) {
  resetImpersonationDb();
  businessReads.length = 0;
  memberTable = Object.values(P).map((p) => ({ ...p, companyId: CO, active: true, createdAt: new Date("2025-02-01"), company: { authOrgId: "org" } }));
  rows["company.findUnique"] = () => ({ ...COMPANY });
  rows["company.findFirst"] = () => ({ ...COMPANY });
  rows["subscription.findUnique"] = () => ({ status: "active", companyId: CO, plan: { maxUsers: 10, seats: 10, crewSeats: null } });
  rows["subscription.findFirst"] = () => ({ status: "active", companyId: CO, plan: { maxUsers: 10, seats: 10, crewSeats: null } });
  rows["platformAdmin.findUnique"] = () => null;
  const find = (where = {}) =>
    memberTable.find((r) =>
      (where.id === undefined || r.id === where.id) &&
      (!where.userId_companyId || (r.userId === where.userId_companyId.userId && r.companyId === where.userId_companyId.companyId)) &&
      (where.userId === undefined || r.userId === where.userId) &&
      (where.active === undefined || r.active === where.active),
    ) || null;
  rows["member.findUnique"] = (args) => find(args?.where);
  rows["member.findFirst"] = (args) => find(args?.where);
  rows["member.findMany"] = () => memberTable;
  for (const m of BUSINESS) {
    for (const method of ["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"]) {
      rows[`${m}.${method}`] = (args) => {
        businessReads.push(`${m}.${method}`);
        return method === "findMany" || method === "groupBy" ? [] : method === "count" ? 0 : method === "aggregate" ? { _sum: {}, _count: {} } : null;
      };
    }
  }
  const p = P[personaKey];
  authStub.session = { user: { id: p.userId, email: `${p.userId}@x.test` }, session: fallback ? {} : { activeOrganizationId: "org" } };
}
const request = (method, path) => new NextRequest(`https://app.fieldquo.com${path}`, { method, headers: new Headers({ host: "app.fieldquo.com" }) });
async function resolveAs(persona, method, path, opts) {
  script(persona, opts);
  try {
    const m = await getCurrentMember(request(method, path));
    return { member: m };
  } catch (err) {
    return { status: err?.status, message: err?.message };
  }
}
const isAgencyRefusal = (r) => r.status === 403 && r.message === ma.AGENCY_API_REFUSAL;

// ═══ A. The preset, the invite, the seat ════════════════════════════════════
section("A. A preset in the existing grid — and a paid seat");
{
  ok("PERMISSION_PRESETS.marketingAgency exists, on the employee tier", Boolean(PERMISSION_PRESETS.marketingAgency) && PRESET_TO_ROLE.marketingAgency === "employee");
  ok("…no new MemberRole: the tier is one the enum already has", ["owner", "admin", "supervisor", "employee"].includes(PRESET_TO_ROLE.marketingAgency));
  ok("every category is STATED (absent reads as unrestricted) and sits at its bottom rung",
    Object.entries(PERMISSION_CATEGORIES).every(([k, c]) => AGENCY_GRID[k] === c.levels[0].value), Object.keys(PERMISSION_CATEGORIES).filter((k) => AGENCY_GRID[k] !== PERMISSION_CATEGORIES[k].levels[0].value));
  ok("every toggle is stated and off", Object.keys(PERMISSION_TOGGLES).every((k) => AGENCY_GRID[k] === false));
  ok("the marker is on the grid, === true", AGENCY_GRID[ma.MARKETING_AGENCY_KEY] === true);
  ok("not an administrator", PERMISSION_PRESETS.marketingAgency.isAdministrator === false);
  const stored = { ...emptyPermissionValues(), ...AGENCY_GRID };
  ok("a stored agency grid reads back as the agency preset", presetForValues(stored, "employee") === "marketingAgency");
  ok("…and is labelled so on Manage Team", describeAccess({ role: "employee", permissions: AGENCY_GRID }).label === "Marketing agency");
  ok("the same dials WITHOUT the marker are not the agency (Custom)", presetForValues({ ...stored, marketingAgency: false }, "employee") === null);
  ok("Crew's dials WITH the marker are not labelled Crew — the label must not lie",
    presetForValues({ ...emptyPermissionValues(), ...PERMISSION_PRESETS.worker.values, marketingAgency: true }, "employee") !== "worker");
  for (const k of ["worker", "estimator", "dispatcher", "manager"]) {
    ok(`${k} still round-trips as ${k}`, presetForValues({ ...emptyPermissionValues(), ...PERMISSION_PRESETS[k].values }, PRESET_TO_ROLE[k]) === k);
  }

  section("A2. Who is confined");
  ok("the agency (grid shape)", ma.isMarketingAgency(P.agency));
  ok("the agency (session shape: one boolean, no grid)", ma.isMarketingAgency({ role: "employee", marketingAgency: true }));
  ok("a supervisor carrying the marker is confined — the narrow reading", ma.isMarketingAgency(P.supervisorMarked));
  ok("an owner never (they could lock the account)", !ma.isMarketingAgency(P.ownerMarked));
  ok("an admin never (unrestricted by definition)", !ma.isMarketingAgency(P.adminMarked));
  for (const [label, m] of [
    ["the string \"true\"", { role: "employee", permissions: { marketingAgency: "true" } }],
    ["1", { role: "employee", permissions: { marketingAgency: 1 } }],
    ["an array grid", { role: "employee", permissions: [{ marketingAgency: true }] }],
    ["null", null],
    ["a string", "marketingAgency"],
    ["Crew", P.crew],
  ]) ok(`not confined: ${label}`, !ma.isMarketingAgency(m));
  ok("canManageMarketing: owner, supervisor, the agency — not Crew, not an Estimator",
    ma.canManageMarketing(P.owner) && ma.canManageMarketing(P.dispatcher) && ma.canManageMarketing(P.agency) &&
    !ma.canManageMarketing(P.crew) && !ma.canManageMarketing({ role: "employee", permissions: PERMISSION_PRESETS.estimator.values }));

  section("A3. The invite guard keeps it — and never invents it");
  const supActor = { role: "supervisor", permissions: PERMISSION_PRESETS.dispatcher.values };
  const vetSup = validateInvite({ actor: supActor, role: "employee", permissions: AGENCY_GRID });
  ok("a supervisor's 'Marketing agency' invite keeps the marker through clampPermissions", vetSup.ok && vetSup.permissions.marketingAgency === true, vetSup);
  ok("…and the dials it was sent", vetSup.permissions.requests === "none" && vetSup.permissions.clientsProperties === "name_address_only");
  const vetOwner = validateInvite({ actor: { role: "owner" }, role: "employee", permissions: AGENCY_GRID });
  ok("an owner's invite keeps it", vetOwner.ok && vetOwner.permissions.marketingAgency === true);
  ok("clamping never ADDS it", clampPermissions("supervisor", supActor.permissions, { ...PERMISSION_PRESETS.worker.values }).marketingAgency === undefined);
  ok("a string 'true' is not carried", clampPermissions("supervisor", supActor.permissions, { marketingAgency: "true" }).marketingAgency === undefined);
  ok("Crew may not invite one (no assignable tier)", !validateInvite({ actor: P.crew, role: "employee", permissions: AGENCY_GRID }).ok);

  section("A4. A seat like any member — never free");
  ok("isBillableSeat(agency) — although its grid is BELOW the Crew ceiling", isBillableSeat(P.agency));
  ok("…the same dials without the marker would be free (so the marker is what bills it)", !isBillableSeat({ role: "employee", permissions: { ...AGENCY_GRID, marketingAgency: false } }));
  const roster = [P.owner, P.agency, P.crew].map((m) => ({ ...m, active: true }));
  ok("countSeats: owner + agency = 2 seats, Crew 1", JSON.stringify(countSeats(roster)) === JSON.stringify({ seats: 2, crew: 1, total: 3 }), countSeats(roster));
  const full = seatCheck({ roster: [{ ...P.owner, active: true }], plan: { seats: 1, crewSeats: 5 }, incoming: { role: "employee", permissions: AGENCY_GRID } });
  ok("a one-seat plan that is full refuses an agency invite", full.allowed === false, full);
  const crewInvite = seatCheck({ roster: [{ ...P.owner, active: true }], plan: { seats: 1, crewSeats: 5 }, incoming: { role: "employee", permissions: PERMISSION_PRESETS.worker.values } });
  ok("…where it would still take a Crew member (the difference is the seat)", crewInvite.allowed === true);
}

// ═══ B. The API boundary, through the real getCurrentMember ═════════════════
section("B. Every API route, every method, through lib/currentMember.js");
function walkFiles(dir, want) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p, want));
    else if (want(name)) out.push(p);
  }
  return out;
}
const walk = (dir) => walkFiles(dir, (name) => name === "route.js");
const METHOD_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=|export\s*\{([^}]*)\}/g;
const inventory = [];
for (const file of walk(join(ROOT, "app/api"))) {
  const rel = relative(join(ROOT, "app"), dirname(file)).split("/").filter((s) => !/^\(.*\)$/.test(s));
  const path = "/" + rel.map((s) => (/^\[.*\]$/.test(s) ? "x1" : s)).join("/");
  const src = readFileSync(file, "utf8");
  const methods = new Set();
  for (const m of src.matchAll(METHOD_RE)) {
    if (m[1] || m[2]) methods.add(m[1] || m[2]);
    else for (const v of (m[3] || "").matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\b/g)) methods.add(v[1]);
  }
  for (const method of methods) inventory.push({ method, path, file: relative(ROOT, file) });
}
ok(`the inventory is the whole tree (${inventory.length} route × method pairs)`, inventory.length > 1000, inventory.length);

// The ORACLE: exactly what the agency may call, written out here rather than
// read back from AGENCY_API_RULES — the test is whether the two agree.
const EXPECTED = (method, path) =>
  path === "/api/funnels" || path.startsWith("/api/funnels/") ||
  (path === "/api/marketing/results" && method === "GET") ||
  (path === "/api/marketing/leads" && method === "GET") ||
  (path === "/api/settings/language" && (method === "GET" || method === "PATCH")) ||
  path === "/api/me/language" || path === "/api/presence" || path === "/api/track" || path === "/api/ui-state";

const letThrough = [];
const wronglyRefused = [];
const notRefusedProperly = [];
const ownerHit = [];
const crewHit = [];
for (const { method, path } of inventory) {
  const a = await resolveAs("agency", method, path);
  if (a.member) {
    letThrough.push(`${method} ${path}`);
    if (!EXPECTED(method, path)) notRefusedProperly.push(`${method} ${path} (resolved)`);
  } else if (EXPECTED(method, path)) {
    wronglyRefused.push(`${method} ${path} → ${a.status}`);
  } else if (!(isAgencyRefusal(a) || a.status === 404)) {
    notRefusedProperly.push(`${method} ${path} → ${a.status} ${a.message}`);
  }
  if (isAgencyRefusal(await resolveAs("owner", method, path))) ownerHit.push(`${method} ${path}`);
  if (isAgencyRefusal(await resolveAs("crew", method, path))) crewHit.push(`${method} ${path}`);
}
ok("the agency is refused on every route outside its list", notRefusedProperly.length === 0, notRefusedProperly.slice(0, 20));
ok("…and let through on every route on it", wronglyRefused.length === 0, wronglyRefused);
ok(`…which is ${letThrough.length} route × method pairs, all marketing or their own`, letThrough.every((s) => EXPECTED(...s.split(" "))) && letThrough.length >= 8, letThrough);
ok("the owner is never refused by it", ownerHit.length === 0, ownerHit.slice(0, 10));
ok("Crew is never refused by it (their own gates decide)", crewHit.length === 0, crewHit.slice(0, 10));

// Every category the owner named, by the routes that carry it.
const CATEGORIES = {
  clients: ["/api/clients"], jobs: ["/api/jobs"], quotes: ["/api/quotes"], invoices: ["/api/invoices"],
  money: ["/api/payments", "/api/payouts", "/api/expenses", "/api/payroll", "/api/analytics", "/api/marketing-spend", "/api/stripe"],
  "messages / inbox": ["/api/messaging", "/api/chat", "/api/crew"],
  calls: ["/api/voice"],
  settings: ["/api/settings"], team: ["/api/team", "/api/settings/members", "/api/workers"],
  billing: ["/api/settings/subscription", "/api/settings/account"],
  "the lead board (contact details)": ["/api/leads"],
  "the rest of marketing (campaigns, subscribers, designer)": ["/api/marketing/campaigns", "/api/marketing/subscribers", "/api/marketing/designer"],
  "search, notifications, AI": ["/api/search", "/api/notifications", "/api/jennifer", "/api/ai"],
};
for (const [name, prefixes] of Object.entries(CATEGORIES)) {
  const hits = inventory.filter(({ path }) => prefixes.some((p) => path === p || path.startsWith(`${p}/`)));
  const open = hits.filter(({ method, path }) => letThrough.includes(`${method} ${path}`) && !(path === "/api/settings/language"));
  ok(`${name}: ${hits.length} route × method pairs, every one refused`, hits.length > 0 && open.length === 0, open.map((h) => `${h.method} ${h.path}`));
}

section("B2. Hostile spellings and edges");
for (const [method, path, allowed, why] of [
  ["GET", "/api/settings/members/self/role", true, "who am I — the rail asks it"],
  ["PATCH", "/api/settings/members/self/role", false, "re-grading people"],
  ["GET", "/api/marketing/results/", true, "a trailing slash"],
  ["GET", "/api/marketing/results?period=thisMonth", true, "a query string"],
  ["HEAD", "/api/marketing/results", true, "HEAD of an allowed GET"],
  ["POST", "/api/marketing/results", false, "a method the rule does not name"],
  ["DELETE", "/api/marketing/leads", false, "a method the rule does not name"],
  ["GET", "//api/quotes", false, "a doubled slash"],
  ["GET", "/api//quotes", false, "a doubled slash inside"],
  ["GET", "/api/funnelsX", false, "a prefix that is not a path segment"],
  ["GET", "/api/funnels%2F..%2Fquotes", false, "an encoded slash matches no rule"],
  ["GET", "/api/funnels/../quotes", false, "a dot-dot traversal (the URL resolves it to /api/quotes)"],
  ["GET", "/api/marketing/results/../../clients", false, "a traversal out of an allowed path"],
  ["GET", "/api/fun%6Eels", false, "a percent-encoded letter matches nothing"],
  ["GET", "/api/marketing/resultsX", false, "a lookalike"],
  ["GET", "/api/settings/language/../business-info", false, "a traversal out of their language"],
]) {
  const r = await resolveAs("agency", method, path);
  ok(`${method} ${path} — ${why}: ${allowed ? "allowed" : "refused"}`, allowed ? Boolean(r.member) : isAgencyRefusal(r) || r.status === 404, r.member ? "resolved" : r);
}
const fb = await resolveAs("agency", "GET", "/api/clients", { fallback: true });
ok("the fallback branch (a session with no active organisation) refuses too", isAgencyRefusal(fb), fb);
const fbOk = await resolveAs("agency", "GET", "/api/funnels", { fallback: true });
ok("…and lets the agency's own routes through", fbOk.member?.marketingAgency === true, fbOk);
const sup = await resolveAs("supervisorMarked", "GET", "/api/clients");
ok("a supervisor carrying the marker is refused like the agency", isAgencyRefusal(sup), sup);
const adm = await resolveAs("adminMarked", "GET", "/api/clients");
ok("an admin carrying it is not (unrestricted)", Boolean(adm.member) && adm.member.marketingAgency === false, adm);
const own = await resolveAs("ownerMarked", "GET", "/api/clients");
ok("an owner carrying it is not", Boolean(own.member) && own.member.marketingAgency === false, own);
const shape = await resolveAs("agency", "GET", "/api/funnels");
ok("the session member carries ONE boolean, never the grid", shape.member?.marketingAgency === true && !("permissions" in (shape.member || {})), shape.member && Object.keys(shape.member));
const page = await (async () => {
  script("agency");
  try {
    return { member: await getCurrentMember({ headers: request("GET", "/x").headers, method: "GET", url: "" }) };
  } catch (err) {
    return { status: err.status };
  }
})();
ok("a server component's call (no /api URL) is the page gate's to judge, not this one's", Boolean(page.member));
const sessionRoutes = walk(join(ROOT, "app/api")).filter((f) => /getSession\(|auth\.api\./.test(readFileSync(f, "utf8")) && !/getCurrentMember|memberOrRefusal/.test(readFileSync(f, "utf8")));
ok("no route reads the session without going through getCurrentMember, except the signup and email-verify routes (a person with no company yet)",
  sessionRoutes.every((f) => /app\/api\/(signup\/(setup|lead)|verify-email)\/route\.js$/.test(f)), sessionRoutes.map((f) => relative(ROOT, f)));
const outside = walk(join(ROOT, "app")).filter((f) => !f.includes("/app/api/") && /getCurrentMember|memberOrRefusal|getSession\(/.test(readFileSync(f, "utf8")));
ok("no route handler outside /api reads a member (the gate judges /api paths)", outside.length === 0, outside.map((f) => relative(ROOT, f)));

// ═══ C. Real handlers ═══════════════════════════════════════════════════════
section("C. Real handlers: refused before a business row is read");
async function call(persona, method, path, file, { params = {} } = {}) {
  script(persona);
  let mod;
  try {
    mod = await import(join(ROOT, file));
  } catch (err) {
    return { error: `import failed: ${String(err?.message || err).slice(0, 200)}` };
  }
  const handler = mod[method];
  if (typeof handler !== "function") return { error: `no ${method} export` };
  try {
    const res = await handler(request(method, path), { params: Promise.resolve(params) });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (err) {
    return { error: `threw: ${String(err?.message || err).slice(0, 200)}` };
  }
}
const SENSITIVE = [
  ["GET", "/api/clients", "app/api/clients/route.js"], ["POST", "/api/clients", "app/api/clients/route.js"],
  ["GET", "/api/quotes", "app/api/quotes/route.js"], ["GET", "/api/invoices", "app/api/invoices/route.js"],
  ["GET", "/api/jobs", "app/api/jobs/route.js"], ["GET", "/api/leads", "app/api/leads/route.js"],
  ["GET", "/api/payments", "app/api/payments/route.js"], ["GET", "/api/payouts", "app/api/payouts/route.js"],
  ["GET", "/api/expenses", "app/api/expenses/route.js"], ["GET", "/api/messaging/threads", "app/api/messaging/threads/route.js"],
  ["GET", "/api/chat/rooms", "app/api/chat/rooms/route.js"], ["GET", "/api/voice/calls", "app/api/voice/calls/route.js"],
  ["GET", "/api/settings/business-info", "app/api/settings/business-info/route.js"], ["GET", "/api/settings/members", "app/api/settings/members/route.js"],
  ["POST", "/api/team/quick-add", "app/api/team/quick-add/route.js"], ["GET", "/api/search?q=ana", "app/api/search/route.js"],
  ["GET", "/api/notifications", "app/api/notifications/route.js"], ["GET", "/api/analytics/kpis", "app/api/analytics/kpis/route.js"],
  ["GET", "/api/marketing/campaigns", "app/api/marketing/campaigns/route.js"], ["GET", "/api/marketing/subscribers", "app/api/marketing/subscribers/route.js"],
];
for (const [method, path, file] of SENSITIVE) {
  const r = await call("agency", method, path, file);
  ok(`${method} ${path} → 403, the agency sentence, no business row read`,
    r.status === 403 && r.body?.error === ma.AGENCY_API_REFUSAL && businessReads.length === 0 && writes.length === 0,
    r.error || { status: r.status, error: r.body?.error, reads: businessReads.slice(0, 5), writes: writes.length });
}
// Jennifer catches any refusal from getCurrentMember and treats the caller as
// a stranger on the marketing site (app/api/jennifer/route.js
// resolveCompanyMember) — so the agency reaches the anonymous assistant, which
// holds no company data, and the company conversation is a 401.
{
  const r = await call("agency", "GET", "/api/jennifer?conversationId=c1", "app/api/jennifer/route.js");
  ok("GET /api/jennifer → 401 for the agency (the company's support thread is not theirs), no row read",
    r.status === 401 && businessReads.length === 0 && writes.length === 0, r.error || { status: r.status, reads: businessReads });
}

section("C2. Their own routes answer them");
{
  const f = await call("agency", "GET", "/api/funnels", "app/api/funnels/route.js");
  ok("GET /api/funnels → 200, a list", f.status === 200 && Array.isArray(f.body), f.error || f);
  const ml = await call("agency", "GET", "/api/marketing/leads", "app/api/marketing/leads/route.js");
  ok("GET /api/marketing/leads → 200, the sharing switches stated", ml.status === 200 && Array.isArray(ml.body?.leads) && ml.body.sharing?.contactDetails === false, ml.error || ml);
  const me = await call("agency", "GET", "/api/settings/members/self/role", "app/api/settings/members/[id]/role/route.js", { params: { id: "self" } });
  ok("GET /api/settings/members/self/role → 200, yourRole employee, nothing assignable", me.status === 200 && me.body?.yourRole === "employee" && me.body.assignableRoles.length === 0 && me.body.canGrantAccess === false, me.error || me);
  const crewF = await call("crew", "GET", "/api/funnels", "app/api/funnels/route.js");
  ok("Crew are still refused funnels (the widening is the agency only)", crewF.status === 403, crewF.error || crewF.status);
  const crewL = await call("crew", "GET", "/api/marketing/leads", "app/api/marketing/leads/route.js");
  ok("…and Marketing › Leads", crewL.status === 403, crewL.error || crewL.status);
}

section("C3. Marketing results: job values only while shared");
{
  const routeSrc = decomment(read("app/api/marketing/results/route.js"));
  ok("the route gates with requireMarketingAccess", /requireMarketingAccess\(member\)/.test(routeSrc));
  ok("…and passes includeMoney from the company's switch for the agency (companySharing, the agency API's reader)",
    /includeMoney: agency \? sharing\.shareMoney : true/.test(routeSrc) && /companySharing\(db, member\.companyId\)/.test(routeSrc));
  const { loadMarketingResults } = await import("@/lib/agency/metricsData");
  ok("loadMarketingResults takes the includeMoney the route passes (the agency API path, executed in check:agency-api §5c)", typeof loadMarketingResults === "function");
  for (const file of ["app/api/funnels/route.js", "app/api/funnels/generate/route.js", "app/api/funnels/[id]/route.js", "app/api/funnels/[id]/analytics/route.js", "app/api/marketing/leads/route.js"]) {
    const s = decomment(read(file));
    ok(`${file} gates with requireMarketingAccess, not a role of its own`, /requireMarketingAccess\(member\)/.test(s) && !/requirePermission\(member\.role, "user:manage"\)/.test(s));
  }
  for (const file of ["app/api/marketing/campaigns/route.js", "app/api/marketing/designer/designs/route.js", "app/api/marketing/subscribers/route.js"]) {
    ok(`${file} stays on user:manage (the designer and campaigns are not the agency's — see the report)`, !/requireMarketingAccess|canManageMarketing/.test(read(file)));
  }
}

// ═══ D. Pages ═══════════════════════════════════════════════════════════════
section("D. Every /app page refused except their own");
{
  const pages = [];
  const pageFiles = walkFiles(join(ROOT, "app/app"), (name) => name === "page.js");
  for (const f of pageFiles) {
    const rel = relative(join(ROOT, "app"), dirname(f)).split("/").filter((s) => !/^\(.*\)$/.test(s));
    pages.push("/" + rel.map((s) => (/^\[.*\]$/.test(s) ? "x1" : s)).join("/"));
  }
  const OWN = (p) => p === "/app/funnels" || p.startsWith("/app/funnels/") || ["/app/marketing/results", "/app/marketing/leads", "/app/settings", "/app/settings/language", "/app/more"].includes(p);
  const wrong = pages.filter((p) => p !== "/app" && (ma.agencyPageDecision(P.agency, p).action === "allow") !== OWN(p));
  ok(`${pages.length} pages: refused except the agency's own`, pages.length > 100 && wrong.length === 0, wrong);
  ok("every one of their own pages exists", ["/app/funnels", "/app/marketing/results", "/app/marketing/leads", "/app/settings/language", "/app/more"].every((p) => pages.includes(p)));
  ok("/app sends them to their results", JSON.stringify(ma.agencyPageDecision(P.agency, "/app")) === JSON.stringify({ action: "redirect", path: "/app/marketing/results" }));
  ok("a missing pathname refuses them", ma.agencyPageDecision(P.agency, null).action === "refuse" && ma.agencyPageDecision(P.agency, "").action === "refuse");
  ok("nobody else is ever refused or redirected by it", pages.every((p) => ["owner", "crew", "dispatcher", "adminMarked"].every((k) => ma.agencyPageDecision(P[k], p).action === "allow")) && ma.agencyPageDecision(null, "/app/clients").action === "allow");
  ok("hostile page paths: //app/clients and /app/funnelsX refused", ma.agencyPageDecision(P.agency, "//app/clients").action === "refuse" && ma.agencyPageDecision(P.agency, "/app/funnelsX").action === "refuse");
  const layout = decomment(read("app/app/layout.js"));
  ok("the gate wraps every page in the /app layout", /<AgencyPageGate>\s*<PersonalPageGate>\{children\}<\/PersonalPageGate>\s*<\/AgencyPageGate>/.test(layout));
  const gate = decomment(read("app/components/team/AgencyPageGate.js"));
  ok("…re-decided on every navigation (usePathname), never once per layout", /usePathname\(\)/.test(gate) && /agencyPageDecision\(caller, pathname\)/.test(gate));
  ok("…and renders the refusal INSTEAD of the page", /if \(decision\.action === "allow"\) return children;[\s\S]{0,120}return <AgencyScopePanel \/>;/.test(gate));
  ok("the server pages that read the database refuse them themselves",
    /if \(member\.marketingAgency\) notFound\(\);/.test(decomment(read("app/app/quotes/[id]/kitchen/page.js"))) &&
    /if \(member\.marketingAgency\) notFound\(\);/.test(decomment(read("app/app/settings/cabinet-rates/layout.js"))) &&
    /hasLevel\(full, "requests", "view_create_edit"\)/.test(decomment(read("app/app/leads/new/page.js"))) && AGENCY_GRID.requests === "none");
  const serverDataPages = walkFiles(join(ROOT, "app/app"), (name) => /^(page|layout|template)\.js$/.test(name))
    .filter((f) => !/^\s*"use client"/m.test(readFileSync(f, "utf8")) && /from "@\/lib\/db"|getCurrentMember|loadEnforceableMember/.test(readFileSync(f, "utf8")))
    .map((f) => relative(ROOT, f));
  ok("…and those are ALL the server pages that read data (a new one must be added here)",
    JSON.stringify(serverDataPages.sort()) === JSON.stringify(["app/app/layout.js", "app/app/leads/new/page.js", "app/app/quotes/[id]/kitchen/page.js", "app/app/settings/cabinet-rates/layout.js"]), serverDataPages);
}

// ═══ E. The shell ═══════════════════════════════════════════════════════════
section("E. The nav shows only what they can open");
{
  const sidebar = read("app/components/layout/AdminSidebar.js");
  const navRows = [...sidebar.matchAll(/\{ key: "(app\.(?:nav|quickAdd)\.[\w.]+)", href: "([^"]+)"/g)].map((m) => ({ key: m[1], href: m[2] }));
  ok(`every rail, More, Create and account row parsed (${navRows.length})`, navRows.length > 40);
  const shown = navRows.filter((r) => navRowAllowed(r.key, P.agency));
  ok("the agency sees exactly its rows", JSON.stringify([...new Set(shown.map((r) => r.key))].sort()) === JSON.stringify([...ma.AGENCY_NAV_ROWS].sort()), shown.map((r) => r.key));
  ok("…and every one opens (an allowed page)", shown.every((r) => ma.agencyPageAllowed(r.href.split("?")[0])), shown);
  ok("no Create entry at all (the Create menu draws nothing)", !navRows.filter((r) => r.key.startsWith("app.quickAdd.")).some((r) => navRowAllowed(r.key, P.agency)));
  ok("the agency's two rows are hidden from the owner, Crew and a missing provider", ma.AGENCY_ONLY_NAV_ROWS.every((k) => !navRowAllowed(k, P.owner) && !navRowAllowed(k, P.crew) && !navRowAllowed(k, null)));
  ok("…and both exist in the rail with their pages", ma.AGENCY_ONLY_NAV_ROWS.every((k) => navRows.some((r) => r.key === k && ma.agencyPageAllowed(r.href))));
  const bar = phoneBarFor(P.agency);
  ok("their phone bar is the marketing set: Results · Leads · Funnels, More is the sheet",
    bar.set === "marketing" && JSON.stringify(bar.tabs.map((t) => t.href)) === JSON.stringify(["/app/marketing/results", "/app/marketing/leads", "/app/funnels"]) && bar.more.kind === "sheet", bar);
  ok("…every tab opens", bar.tabs.every((t) => ma.agencyPageAllowed(t.href)));
  ok("they are not Crew (no crew shell, no My day, no clock)", !isCrewHome(P.agency) && !usesCrewShell(P.agency) && phoneBarFor(P.crew).set === "crew");
  const settingsRows = Object.keys(SETTINGS_ROW_CAPABILITY).filter((k) => canSeeSettingsRow({ role: "employee", impersonation: false }, k, P.agency));
  ok("settings: their language and nothing else", JSON.stringify(settingsRows) === JSON.stringify(["app.settings.language"]), settingsRows);
  ok("…while an Estimator still sees the rows everyone sees", Object.keys(SETTINGS_ROW_CAPABILITY).filter((k) => canSeeSettingsRow({ role: "employee" }, k, { role: "employee", permissions: PERMISSION_PRESETS.estimator.values })).length > 5);
  const topbar = decomment(read("app/components/layout/TopBar.js"));
  ok("TopBar: no search and no bell for them", /const agency = isMarketingAgency\(caller\);/.test(topbar) && /\{!agency && <NotificationBell tone="bar" \/>\}/.test(topbar) && /\{!agency && <GlobalSearch \/>\}/.test(topbar));
  ok("the rail draws no Create/Search buttons for them", /showLabel && !slid && !agencyRail/.test(decomment(sidebar)));
  const layout = decomment(read("app/app/layout.js"));
  ok("no Jennifer and no tours for them", /\{!agencyMember && <AppTours \/>\}/.test(layout) && /\{!agencyMember && <JenniferPanel/.test(layout));
}

// ═══ F. Never notified, in no room ══════════════════════════════════════════
section("F. Never notified; in no chat room");
{
  const members = [P.owner, P.agency, P.crew, P.dispatcher].map((m) => ({ ...m, companyId: CO, active: true }));
  const leaked = Object.keys(NOTIFICATION_TYPES).filter((type) => selectRecipients({ members, type }).some((m) => m.id === P.agency.id));
  ok(`no notification type of ${Object.keys(NOTIFICATION_TYPES).length} ever reaches the agency`, leaked.length === 0, leaked);
  const named = Object.keys(NOTIFICATION_TYPES).filter((type) => selectRecipients({ members, type, recipientUserIds: [P.agency.userId] }).length > 0);
  ok("…not even when a caller names them", named.length === 0, named);
  ok("…while the owner still gets them", Object.keys(NOTIFICATION_TYPES).some((type) => selectRecipients({ members, type }).some((m) => m.id === P.owner.id)));
  const roster = await activeRoster(CO, { client: { member: { findMany: async () => members.map((m) => ({ ...m, user: { name: m.id, email: null, language: null } })) } } });
  ok("the chat roster leaves them out (so no #general, no job room, no directory entry)", roster.length === 3 && !roster.some((m) => m.id === P.agency.id), roster.map((m) => m.id));
}

// ═══ Strings ═══════════════════════════════════════════════════════════════
section("Strings: every new one in every app locale");
{
  const keys = [
    "app.nav.marketingResults", "app.nav.marketingLeads", "app.me.tab.results", "app.me.tab.marketingLeads",
    "app.agencyRole.gateTitle", "app.agencyRole.gateBody", "app.marketingLeads.title", "app.marketingLeads.subtitleAgency",
    "app.marketingLeads.subtitleCompany", "app.marketingLeads.contactsShared", "app.marketingLeads.contactsNotShared",
    "app.marketingLeads.moneyShared", "app.marketingLeads.moneyNotShared", "app.marketingLeads.empty", "app.marketingLeads.noName",
    "app.marketingLeads.won", "app.marketingLeads.truncated", "app.agencyMetrics.subtitleAgency", "app.agencyMetrics.spendNotConnectedAgency",
    "app.agencyMetrics.agencyMoneyOn", "app.agencyMetrics.agencyMoneyOff", "app.setTeamNew.agencyPreset.label",
    "app.setTeamNew.agencyPreset.description", "app.setTeamNew.agencyFixed", "app.setTeamNew.agencySeat",
    ...["lead", "qualified", "appointment", "quote_sent", "won", "lost"].map((s) => `app.marketingLeads.stage.${s}`),
  ];
  const missing = [];
  for (const [code, dict] of Object.entries(APP_MESSAGES)) for (const k of keys) if (typeof dict[k] !== "string" || !dict[k].trim()) missing.push(`${code}:${k}`);
  ok(`${keys.length} keys × ${Object.keys(APP_MESSAGES).length} locales`, missing.length === 0, missing);
  ok("non-English locales are translated, not copied", Object.entries(APP_MESSAGES).filter(([c]) => c !== "en").every(([, d]) => d["app.setTeamNew.agencySeat"] !== APP_MESSAGES.en["app.setTeamNew.agencySeat"]));
  ok("{amount} survives in every locale", Object.values(APP_MESSAGES).every((d) => /\{amount\}/.test(d["app.marketingLeads.won"])));
  const editor = decomment(read("app/components/team/AccessEditor.js"));
  ok("the invite/edit panel shows the agency as FIXED (no dials) and says it takes a seat",
    /activePreset === AGENCY_PRESET \? \([\s\S]{0,400}app\.setTeamNew\.agencyFixed[\s\S]{0,300}app\.setTeamNew\.agencySeat/.test(editor));
  ok("Custom from the agency drops the marker (a raised dial under it would be a dead control)", /onValueChange\(MARKETING_AGENCY_KEY, false\)/.test(editor));
}

// ═══ G. Mutation pass ═══════════════════════════════════════════════════════
if (!MUTANT && fails.length) console.log("\nMutation pass skipped: the baseline fails.");
if (!MUTANT && !fails.length) {
  console.log("\nMutation pass — each change must fail this check");
  const MUTATIONS = [
    ["lib/currentMember.js", "the API gate removed from the main path", "        assertMarketingAgencyScope(resolved, request);\n", ""],
    ["lib/currentMember.js", "the API gate removed from the fallback path", "  assertMarketingAgencyScope(resolved, request);\n\n  return assertBillingAccess", "  return assertBillingAccess"],
    ["lib/permissions/marketingAgency.js", "the stored marker ignored", "p[MARKETING_AGENCY_KEY] === true);", "false);"],
    ["lib/permissions/marketingAgency.js", "owners and admins confined", '  if (member.role === "owner" || member.role === "admin") return false;\n  if (member.marketingAgency', "  if (member.marketingAgency"],
    ["lib/permissions/marketingAgency.js", "doubled slashes not collapsed", '  s = s.replace(/\\/{2,}/g, "/");\n', ""],
    ["lib/permissions/marketingAgency.js", "methods ignored", '(!rule.methods || rule.methods.includes(verb) || (verb === "HEAD" && rule.methods.includes("GET")))', "true"],
    ["lib/permissions/marketingAgency.js", "a prefix that is not a segment", "path.startsWith(`${rule.path}/`)", "path.startsWith(rule.path)"],
    ["lib/permissions/marketingAgency.js", "the page list opened to settings", '  Object.freeze({ path: "/app/settings" }),', '  Object.freeze({ path: "/app/settings", prefix: true }),'],
    ["lib/permissions/nav.js", "the nav allowlist removed", "  if (isMarketingAgency(member)) return AGENCY_NAV_ROWS.includes(navKey);\n", ""],
    ["lib/pricing/ladder.js", "the agency counted as free", "  if (isMarketingAgency(member)) return true;\n", ""],
    ["lib/permissions/roleManagement.js", "a supervisor's invite drops the marker", "  if (requested[MARKETING_AGENCY_KEY] === true) out[MARKETING_AGENCY_KEY] = true;\n", ""],
    ["lib/permissions/accessPresets.js", "a marked grid labelled as another preset", "    if (agency !== (preset.values?.[MARKETING_AGENCY_KEY] === true)) continue;\n", ""],
    ["lib/notifications/recipients.js", "the agency notified", "    if (isMarketingAgency(member)) return false;\n", ""],
    ["lib/nav/phoneBar.js", "the agency given the crew bar", '  if (isMarketingAgency(caller)) return "marketing";\n', ""],
    ["lib/permissions/settingsAccess.js", "the agency shown company settings", "  if (isMarketingAgency(member)) return AGENCY_SETTINGS_ROWS.includes(navKey);\n", ""],
    ["lib/company/chat/store.js", "the agency put in the chat rooms", ".filter((m) => !isMarketingAgency(m));", ".filter(() => true);"],
    ["app/api/funnels/route.js", "funnels back on user:manage alone", "    requireMarketingAccess(member);", '    if (member.role !== "owner") throw Object.assign(new Error("no"), { status: 403 });'],
  ];
  const backupDir = join(ROOT, ".mutation-backup-marketing-agency-role");
  mkdirSync(backupDir, { recursive: true });
  const escaped = [];
  try {
    for (const [file, label, from, to] of MUTATIONS) {
      const path = join(ROOT, file);
      const backup = join(backupDir, file.replace(/\//g, "__"));
      copyFileSync(path, backup);
      const original = readFileSync(path, "utf8");
      if (!original.includes(from)) {
        escaped.push(`${label} — mutation target not found`);
        continue;
      }
      writeFileSync(path, original.replace(from, to));
      let survived = false;
      try {
        execFileSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/impersonation-stub-loader.mjs", "scripts/check-marketing-agency-role.mjs", "--mutant"], { cwd: ROOT, stdio: "pipe" });
        survived = true;
      } catch {
        survived = false;
      } finally {
        copyFileSync(backup, path);
      }
      if (survived) escaped.push(`${label} — NOT caught`);
      else console.log(`  ✓ caught: ${label}`);
    }
  } finally {
    rmSync(backupDir, { recursive: true, force: true });
  }
  ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
}

if (!MUTANT) console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n  ${fails.join("\n  ")}` : `\nPASSED — ${pass}/${pass} assertions`);
process.exit(fails.length ? 1 : 0);
