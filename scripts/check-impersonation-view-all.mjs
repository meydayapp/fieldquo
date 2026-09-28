// scripts/check-impersonation-view-all.mjs
//
//   npm run check:impersonation
//
// "View as company" is the owner of FieldQuo auditing a customer. The rule is
// non-negotiable #3: the platform console VIEWS EVERYTHING and EDITS NOTHING.
//
// The owner reported the first half broken: on a client page the contact
// details said "Hidden by your access level", the Equipment & warranties card
// said "Your account doesn't have access to this", and the Quotes list would
// not load at all. Root cause: lib/currentMember.js resolved the session to NO
// membership — `{ id: null, role: "viewer" }` — and loadEnforceableMember(db,
// null) returned null, which every grid gate refuses and every redactor strips.
//
// The fix is narrow: an ACTIVE superadmin's read-only session resolves to the
// company's real OWNER membership (earliest active role-"owner" row), still
// marked impersonation/read_only. Every existing loadEnforceableMember(db,
// member.id) then answers with the owner's row, unchanged.
//
// This check EXECUTES the fix and the half that must not move:
//
//   1. the resolver: a superadmin resolves to the earliest active owner of
//      THIS company; admin, support, a deactivated/demoted/missing superadmin,
//      and a company with no active owner keep the inert stub;
//   2. the grid: loadEnforceableMember(db, auditor.id) is the owner's row —
//      every category at its top level, every redactor a no-op;
//   3. writes, gate one: middleware.js, run for EVERY non-GET handler under
//      app/api with the impersonation cookie, and for the GETs that act
//      rather than read (OAuth connect/callback, Stripe returns) — all refused;
//   4. writes, gate two: assertReadOnly (getCurrentMember) refuses the same,
//      though the member id is now a real owner's, and every tenant write
//      handler called directly (middleware skipped) writes nothing;
//   5. every GET handler under app/api, as the auditor and as the real owner:
//      the auditor is never refused where the owner is served, and never
//      writes into the tenant or calls out with a non-GET;
//   6. a read matrix — the screens in the owner's report and the core lists —
//      for the auditor and five real personas (owner, admin, office, crew, a
//      restricted custom role), so a real member's restriction is unchanged;
//   7. the GETs that write on read, each scripted down its write path: the
//      real owner's request writes (proof the path is live), the auditor's
//      writes nothing and still answers.
//
// --matrix-out=<file> writes every real-member cell as status:md5, for diffing
// this tree against another (real members' answers must not move).
//
// Run against the tree before the fix, 91 assertions fail.
// The heal-on-read specs added to section 7 afterwards (schedule/map geocode,
// business-info geocode, voice number repair heal, Business Profile location
// stamps) fail 11 more against those routes before their skips; the ones for
// the writes inside shared libs (shift-request expiry + notifications,
// onboarding stamp, gallery merge on seven reads, voice readiness heal, Google
// busy stamps) fail 13 more against those libs before theirs.

process.env.IMPERSONATION_JWT_SECRET ||= "test-secret-for-guard-only-not-a-real-key";
// Nothing here may reach a real service. Unset so every "is it configured?"
// branch answers no, and fetch is replaced below so an unconfigured branch
// that calls out anyway is recorded rather than sent.
for (const k of ["STRIPE_SECRET_KEY", "OPENAI_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "RETELL_API_KEY", "CLOUDINARY_API_SECRET", "GOOGLE_CLIENT_SECRET", "META_APP_SECRET", "DATABASE_URL"]) {
  delete process.env[k];
}

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SignJWT } from "jose";
// A namespace import with a fallback, so that run against the tree BEFORE the
// fix this check fails on behaviour (a write-shaped GET let through) rather
// than on a missing export.
import * as tokenMod from "@/lib/platform/impersonationToken";
const { IMPERSONATION_COOKIE, impersonationSecret } = tokenMod;
const isWriteShapedGet = tokenMod.isWriteShapedGet || (() => false);
// The GETs that act rather than read, as this check expects them. Stated here
// as well as in lib/platform/impersonationToken.js so removing one from the
// product's list is a failure, not a silent widening.
const WRITE_SHAPED_GET_PATHS = [
  "/api/calendar/google/connect", "/api/calendar/google/callback",
  "/api/reviews/google/connect", "/api/reviews/google/callback",
  "/api/settings/social/connect", "/api/settings/social/callback",
  "/api/settings/whatsapp/connect", "/api/settings/whatsapp/callback",
  "/api/meta-ads/callback", "/api/stripe/connect/refresh",
  "/api/settings/voice/topup", "/api/settings/voice/auto-topup",
];
import { rows, writes, resetImpersonationDb, db } from "./fixtures/impersonationDb.mjs";
import { authStub } from "./fixtures/authStub.mjs";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  hasLevel,
  hasToggle,
  scopeFilter,
  assignedJobWhere,
  seesOnlyAssignedJobs,
  redactClient,
  redactLead,
  redactQuote,
  redactInvoice,
  redactPay,
  redactNotesField,
} from "@/lib/permissions/enforce";
import { PERMISSION_CATEGORIES, PERMISSION_TOGGLES, PERMISSION_PRESETS, can } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUIET = process.argv.includes("--quiet");
let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass += 1;
    if (!QUIET) console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
};

// ── Outbound calls are recorded, never made ────────────────────────────────
const outbound = [];
// A spec in section 7 may answer a provider's READ (a Retell number lookup)
// so a heal path is reachable; everything else still fails.
let fetchResponder = null;
globalThis.fetch = async (url, init = {}) => {
  outbound.push({ url: String(url), method: String(init.method || "GET").toUpperCase() });
  const scripted = fetchResponder?.(String(url), init);
  if (scripted) return scripted;
  throw new Error("network disabled in check-impersonation-view-all");
};

// ── The company, and who is asking ─────────────────────────────────────────
const CO = "co";
const COMPANY = {
  id: CO, authOrgId: "org", name: "Zlla Painting", slug: "zlla", bookingSlug: "zlla",
  timezone: "America/Toronto", currency: "CAD", defaultLanguage: "en", country: "CA",
  province: "ON", city: "Toronto", address: "1 Main St", postalCode: "M1M 1M1",
  latitude: 43.6, longitude: -79.4, isDemo: false, createdAt: new Date("2025-01-01"),
  galleryMergedAt: new Date("2025-02-01"), onboardingCompletedAt: new Date("2025-02-01"),
  email: "office@zlla.example", phone: "4165550100",
};
const CLIENT = {
  id: "c1", companyId: CO, name: "Zlla", type: "individual", contactName: "Zed Zlla",
  email: "zed@zlla.example", phone: "4165550199", notes: "Gate code 4417",
  address: "9 Elm St", city: "Toronto", province: "ON", postalCode: "M2M 2M2",
  portalToken: "portal_tok", language: "en", createdAt: new Date("2025-03-01"),
  quotes: [], invoices: [], jobs: [], _count: { quotes: 1 },
};
const QUOTE = {
  id: "q1", companyId: CO, quoteNumber: "Q-0001", status: "sent", clientId: "c1",
  subtotal: "7000", discount: "0", tax: "645", total: "7645", shareToken: "share_tok",
  lineItems: [{ description: "Paint 14 doors", quantity: 14, rate: 150, amount: 2100 }],
  client: { ...CLIENT }, createdAt: new Date("2025-04-01"), language: "en",
};
const INVOICE = {
  id: "i1", companyId: CO, invoiceNumber: "INV-0001", status: "sent", clientId: "c1",
  subtotal: "7000", discount: "0", tax: "645", total: "7645", amountPaid: "0", amountDue: "7645",
  version: 1, parentInvoiceId: null, client: { ...CLIENT }, payments: [], createdAt: new Date("2025-05-01"),
};
const LEAD = {
  id: "l1", companyId: CO, name: "Emilio B", email: "e@lead.example", phone: "4165550111",
  message: "32 doors", budgetBand: "15k_plus", scoreReasons: ["Budget $15k+"], score: 78,
  temperature: "hot", status: "new", createdAt: new Date("2025-06-01"),
};
const WORKER = { id: "w1", companyId: CO, userId: "u-crew", name: "Jonny", hourlyRate: 25, active: true };
const EQUIPMENT = { id: "e1", companyId: CO, clientId: "c1", name: "Furnace", serialNumber: "SN-1", installedAt: new Date("2024-01-01"), warrantyEndsAt: new Date("2030-01-01"), createdAt: new Date("2024-01-01") };

// Personas: the grids exactly as the product saves them. The owner persona IS
// the company's earliest active owner — the row the auditor must resolve to —
// so the auditor's reads can be compared to the owner's byte for byte.
const PERSONAS = {
  owner: { id: "m-owner", userId: "u-owner", role: "owner", permissions: null },
  admin: { id: "m-admin", userId: "u-admin", role: "admin", permissions: PERMISSION_PRESETS.manager.values },
  office: { id: "m-office", userId: "u-office", role: "supervisor", permissions: PERMISSION_PRESETS.dispatcher.values },
  crew: { id: "m-crew", userId: "u-crew", role: "employee", permissions: PERMISSION_PRESETS.worker.values },
  restricted: {
    id: "m-restricted", userId: "u-restricted", role: "employee",
    permissions: {
      ...PERMISSION_PRESETS.estimator.values,
      clientsProperties: "name_address_only", quotes: "view_only", invoices: "view_only",
      showPricing: false, notes: "jobs_visits_only", payroll: "none",
    },
  },
};

// The company's membership table. Deliberately awkward for the owner lookup:
// a LATER owner, an EARLIER but deactivated owner, and an even earlier owner
// of ANOTHER company — the resolver must pick m-owner and nothing else.
const MEMBER_ROWS = [
  { ...PERSONAS.owner, companyId: CO, active: true, createdAt: new Date("2025-01-01") },
  { id: "m-owner-late", userId: "u-owner-late", role: "owner", permissions: null, companyId: CO, active: true, createdAt: new Date("2025-06-01") },
  { id: "m-owner-gone", userId: "u-owner-gone", role: "owner", permissions: null, companyId: CO, active: false, createdAt: new Date("2024-01-01") },
  { id: "m-other-owner", userId: "u-other", role: "owner", permissions: null, companyId: "other-co", active: true, createdAt: new Date("2023-01-01") },
  ...["admin", "office", "crew", "restricted"].map((n) => ({ ...PERSONAS[n], companyId: CO, active: true, createdAt: new Date("2025-02-01") })),
];
let memberTable = MEMBER_ROWS;
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => {
  if (v === undefined) return true;
  if (k === "userId_companyId") return row.userId === v.userId && row.companyId === v.companyId;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("in" in v) return v.in.includes(row[k]);
    if ("not" in v) return row[k] !== v.not;
    return true; // relation filters etc.: not modelled, pass
  }
  return row[k] === v;
});
const withCompany = (r) => (r ? { ...r, company: { authOrgId: r.companyId === CO ? "org" : "other-org" } } : null);
const sorted = (list, orderBy) => {
  const o = Array.isArray(orderBy) ? orderBy[0] : orderBy;
  if (!o?.createdAt) return list;
  return [...list].sort((a, b) => (o.createdAt === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
};
const memberLookups = [];

function scriptCompany() {
  resetImpersonationDb();
  memberTable = MEMBER_ROWS;
  memberLookups.length = 0;
  rows["company.findUnique"] = () => ({ ...COMPANY });
  rows["company.findFirst"] = () => ({ ...COMPANY });
  rows["subscription.findUnique"] = () => ({ status: "active", companyId: CO, plan: { maxUsers: 10, seats: 10, crewSeats: null } });
  rows["client.findFirst"] = () => ({ ...CLIENT });
  rows["client.findUnique"] = () => ({ ...CLIENT });
  rows["client.findMany"] = () => [{ ...CLIENT }];
  rows["quote.findMany"] = () => [{ ...QUOTE }];
  rows["quote.findFirst"] = () => ({ ...QUOTE });
  rows["invoice.findMany"] = () => [{ ...INVOICE }];
  rows["invoice.findFirst"] = () => ({ ...INVOICE });
  rows["leadRequest.findMany"] = () => [{ ...LEAD }];
  rows["leadRequest.findFirst"] = () => ({ ...LEAD, notes: [] });
  rows["worker.findMany"] = () => [{ ...WORKER }];
  rows["clientEquipment.findMany"] = () => [{ ...EQUIPMENT }];
  rows["member.findFirst"] = (args) => {
    memberLookups.push(args);
    return withCompany(sorted(memberTable.filter((r) => matches(r, args?.where)), args?.orderBy)[0] || null);
  };
  rows["member.findUnique"] = (args) => withCompany(memberTable.find((r) => matches(r, args?.where)) || null);
  rows["member.findMany"] = (args) => sorted(memberTable.filter((r) => matches(r, args?.where)), args?.orderBy).map(withCompany);
}

let session = { kind: "nobody" };
function becomeAuditor(adminRow = { role: "superadmin", active: true }, mode = "read_only", table = MEMBER_ROWS) {
  scriptCompany();
  memberTable = table;
  rows["platformAdmin.findUnique"] = () => (adminRow ? { ...adminRow } : null);
  authStub.session = null;
  session = { kind: "auditor", mode };
}
function becomePersona(name) {
  scriptCompany();
  const p = PERSONAS[name];
  rows["platformAdmin.findUnique"] = () => null;
  authStub.session = { user: { id: p.userId }, session: { activeOrganizationId: "org" } };
  session = { kind: "persona", name };
}

const TOKENS = {};
async function token(mode) {
  if (!TOKENS[mode]) {
    TOKENS[mode] = await new SignJWT({ impersonation: true, mode, companyId: CO, platformAdminId: "pa-owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(impersonationSecret());
  }
  return TOKENS[mode];
}
async function request(method, path, body, extraCookie = "") {
  const headers = new Headers({ host: "app.fieldquo.com", "content-type": "application/json" });
  const cookies = [];
  if (session.kind === "auditor") cookies.push(`${IMPERSONATION_COOKIE}=${await token(session.mode)}`);
  if (extraCookie) cookies.push(extraCookie);
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  const url = `https://app.fieldquo.com${path}`;
  const { NextRequest } = await import("next/server.js");
  return new NextRequest(url, {
    method,
    headers,
    ...(body !== undefined && !["GET", "HEAD"].includes(method) ? { body: JSON.stringify(body) } : {}),
  });
}
const tenantWritesOf = (list) => list.filter((w) => !/^platform(ErrorLog|AuditLog)$/.test(w.model));

// ═══════════════ 1. The resolver ═══════════════════════════════════════════
console.log("\n1. Who the auditor resolves to (lib/currentMember.js, executed)\n");

becomeAuditor();
const auditor = await getCurrentMember(await request("GET", "/api/clients/c1"));
ok("a superadmin's session resolves (it is not null / 401)", Boolean(auditor));
ok("…to the company's real owner membership: id m-owner, user u-owner, role owner",
  auditor?.id === "m-owner" && auditor?.userId === "u-owner" && auditor?.role === "owner",
  JSON.stringify(auditor && { id: auditor.id, userId: auditor.userId, role: auditor.role }));
ok("…the EARLIEST active owner of THIS company (not the later owner, the deactivated one, or another company's)",
  auditor?.id === "m-owner" && auditor?.companyId === CO);
const ownerLookup = memberLookups.find((a) => a?.where?.role === "owner");
ok("…looked up by companyId + active + role owner, oldest first",
  ownerLookup?.where?.companyId === CO && ownerLookup?.where?.active === true && ownerLookup?.orderBy?.createdAt === "asc",
  JSON.stringify(ownerLookup));
ok("…still marked impersonation, read_only, with the platform admin id",
  auditor?.impersonation === true && auditor?.impersonationMode === "read_only" && auditor?.platformAdminId === "pa-owner");
ok("the coarse layer answers yes to every read gate a route asks (user:view)", can(auditor?.role, "user:view"));

for (const [label, adminRow, table] of [
  ["an ADMIN platform account", { role: "admin", active: true }],
  ["a SUPPORT platform account", { role: "support", active: true }],
  ["a DEACTIVATED superadmin (token still inside its 30 minutes)", { role: "superadmin", active: false }],
  ["a platform account that no longer exists", null],
  ["a superadmin viewing a company with NO active owner", { role: "superadmin", active: true },
    MEMBER_ROWS.filter((r) => !(r.companyId === CO && r.role === "owner" && r.active))],
]) {
  becomeAuditor(adminRow, "read_only", table || MEMBER_ROWS);
  const m = await getCurrentMember(await request("GET", "/api/clients/c1"));
  ok(`${label} keeps today's inert stub: id null, user null, role "viewer"`, m?.id === null && m?.userId === null && m?.role === "viewer" && m?.impersonation === true);
  ok("…and loadEnforceableMember still answers null for it", (await loadEnforceableMember(db, m?.id)) === null);
}

becomeAuditor({ role: "superadmin", active: true }, "demo_sandbox");
const demo = await getCurrentMember(await request("POST", "/api/quotes"));
ok("the demo sandbox is untouched: the demo owner, still write-capable",
  demo?.role === "owner" && demo?.id === "m-owner" && demo?.impersonationMode === "demo_sandbox");

// ═══════════════ 2. The grid ═══════════════════════════════════════════════
console.log("\n2. What loadEnforceableMember(db, auditor.id) grants (lib/permissions/enforce.js, executed)\n");

becomeAuditor();
const full = await loadEnforceableMember(db, auditor?.id);
ok("loadEnforceableMember returns a row for the auditor (it returned null — the whole bug)", Boolean(full));
ok("…the owner's own row: role owner, no restricting grid", full?.id === "m-owner" && full?.role === "owner" && full?.permissions === null);
for (const [cat, cfg] of Object.entries(PERMISSION_CATEGORIES)) {
  const top = cfg.levels[cfg.levels.length - 1].value;
  ok(`${cat}: the top level (${top})`, hasLevel(full, cat, top));
}
for (const t of Object.keys(PERMISSION_TOGGLES)) ok(`toggle ${t}: on`, hasToggle(full, t));
ok("schedule / time / expenses scope: everyone's", JSON.stringify(scopeFilter(full, "schedule", "assignedToId", null)) === "{}");
ok("jobs: the whole board, not \"assigned to me\"", !seesOnlyAssignedJobs(full) && JSON.stringify(assignedJobWhere(full)) === "{}");

const c = full ? redactClient(full, { ...CLIENT }) : {};
ok("a client's email, phone, contact name and notes all survive — no \"Hidden by your access level\"",
  c.email === CLIENT.email && c.phone === CLIENT.phone && c.contactName === CLIENT.contactName && c.notes === CLIENT.notes && !c.restricted && !c.notesRestricted);
const l = full ? redactLead(full, { ...LEAD, notes: [{ body: "left a voicemail" }] }) : {};
ok("a lead's contact, budget and call-back log survive", l.email === LEAD.email && l.budgetBand === LEAD.budgetBand && Array.isArray(l.notes) && !l.restricted);
const q = full ? redactQuote(full, { ...QUOTE }) : {};
ok("a quote's money and share token survive", q.total === QUOTE.total && q.shareToken === QUOTE.shareToken && !q.pricingHidden);
const inv = full ? redactInvoice(full, { ...INVOICE }) : {};
ok("an invoice's money survives", inv.amountDue === INVOICE.amountDue && !inv.pricingHidden);
ok("everyone's pay rate survives", full ? redactPay(full, { ...WORKER }, { ownUserId: null }).hourlyRate === 25 : false);
ok("notes survive the notes dial", full ? redactNotesField(full, { notes: "x" }).notes === "x" : false);

// ═══════════════ 3. Writes, gate one: middleware.js ════════════════════════
console.log("\n3. Every write is refused by middleware.js (executed per handler)\n");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.js") out.push(p);
  }
  return out;
}
const ROUTES = walk(join(ROOT, "app/api")).map((file) => {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const methods = [...src.matchAll(/export\s+(?:async\s+function|const|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  const path = "/" + rel.replace(/^app\//, "").replace(/\/route\.js$/, "").replace(/\[\.\.\.[^\]]+\]/g, "x/y").replace(/\[[^\]]+\]/g, "x");
  return { file, rel, src, methods: [...new Set(methods)], path };
});
const STAFF = (p) => /^\/api\/(platform|sales)(\/|$)/.test(p);

const { middleware } = await import("../middleware.js");
becomeAuditor();
let writeHandlers = 0;
const mwLeaks = [];
for (const r of ROUTES) {
  for (const m of r.methods.filter((x) => x !== "GET")) {
    writeHandlers += 1;
    const res = await middleware(await request(m, r.path, {}));
    if (STAFF(r.path)) {
      // FieldQuo's own console and the reps' portal: outside the company
      // surface, authenticated by their own tokens (the paid migration writes
      // live here, behind lib/migrations/state.js). The impersonation cookie
      // must be no credential there: the answer is exactly what the same
      // request gets without it.
      const saved = session;
      session = { kind: "nobody" };
      const bare = await middleware(await request(m, r.path, {}));
      session = saved;
      if (res.status !== bare.status || res.headers.get("x-middleware-next") !== bare.headers.get("x-middleware-next")) {
        mwLeaks.push(`${m} ${r.path} → ${res.status} with the cookie, ${bare.status} without (staff surface)`);
      }
      continue;
    }
    const body = res.status === 403 ? await res.json().catch(() => ({})) : {};
    if (!(res.status === 403 && body.readOnly === true)) mwLeaks.push(`${m} ${r.path} → ${res.status}`);
  }
}
ok(`all ${writeHandlers} non-GET handlers under app/api are refused for the auditor before any handler runs`,
  mwLeaks.length === 0, mwLeaks.slice(0, 10).join("\n       "));
ok("a plain GET passes through to its handler", (await middleware(await request("GET", "/api/quotes"))).headers.get("x-middleware-next") === "1");
for (const p of WRITE_SHAPED_GET_PATHS) {
  const res = await middleware(await request("GET", p));
  ok(`GET ${p} (acts rather than reads) is refused by middleware too`, res.status === 403 && isWriteShapedGet(p));
}
ok("/api/stripe/connect/status (a plain read beside them) is not", !isWriteShapedGet("/api/stripe/connect/status"));
// Every GET that starts an OAuth / onboarding hand-off or settles a checkout
// return is either on the list or refuses a support session itself.
const handOffs = ROUTES.filter((r) => r.methods.includes("GET") && !STAFF(r.path) &&
  /build\w*(Authorize|Auth|Signup)\w*Url|authorizeUrl|AuthorizeUrl|createConnectOnboardingLink|checkout\.sessions\.retrieve|creditVoiceTopup|recordAutoTopupMandate/.test(r.src.split(/export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/)[0]));
const unlisted = handOffs.filter((r) => !isWriteShapedGet(r.path) && !/member\.impersonation/.test(r.src));
ok(`every GET hand-off (OAuth, Stripe onboarding, checkout return) is listed or guards itself (${handOffs.length} found)`,
  unlisted.length === 0, unlisted.map((r) => r.path).join(", "));
becomeAuditor({ role: "superadmin", active: true }, "demo_sandbox");
ok("the demo sandbox may still write (a FieldQuo-owned fixture)", (await middleware(await request("POST", "/api/quotes", {}))).headers.get("x-middleware-next") === "1");

// ═══════════════ 4. Writes, gate two: assertReadOnly + the handlers ════════
console.log("\n4. assertReadOnly refuses every write though the id is a real owner's\n");

const READ_ONLY_MESSAGE = /viewing this account read-only/;
for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  becomeAuditor();
  let err = null;
  let got = null;
  try { got = await getCurrentMember(await request(method, "/api/quotes/q1", {})); } catch (e) { err = e; }
  ok(`getCurrentMember(${method}) as the auditor throws 403 read-only (member id would have been m-owner)`,
    !got && err?.status === 403 && READ_ONLY_MESSAGE.test(err?.message || ""), err ? `${err.status} ${err.message}` : `returned ${got?.id}`);
}
for (const p of WRITE_SHAPED_GET_PATHS) {
  becomeAuditor();
  let err = null;
  try { await getCurrentMember(await request("GET", p)); } catch (e) { err = e; }
  ok(`getCurrentMember(GET ${p}) as the auditor throws 403 read-only`, err?.status === 403 && READ_ONLY_MESSAGE.test(err?.message || ""));
}
for (const method of ["GET", "HEAD", "OPTIONS"]) {
  becomeAuditor();
  const got = await getCurrentMember(await request(method, "/api/quotes"));
  ok(`getCurrentMember(${method}) as the auditor resolves (reads only)`, got?.id === "m-owner");
}

const secondGate = { refused: 0, sessionless: [], leaked: [], errored: [] };
const importCache = new Map();
async function load(r) {
  if (!importCache.has(r.file)) {
    importCache.set(r.file, await import(pathToFileURL(r.file).href).catch((err) => ({ __error: err })));
  }
  return importCache.get(r.file);
}
function params() {
  return { params: Promise.resolve(new Proxy({}, { get: (_t, k) => (typeof k === "string" ? (k === "then" ? undefined : "x") : undefined) })) };
}
async function run(handler, req) {
  let timer;
  return Promise.race([
    Promise.resolve().then(() => handler(req, params())),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), 8000); }),
  ]).finally(() => clearTimeout(timer));
}
const usesSession = (src) => /@\/lib\/(apiMember|currentMember)|getCurrentMember|memberOrRefusal|OrRefusal\(/.test(src);
for (const r of ROUTES.filter((x) => !STAFF(x.path))) {
  const mod = await load(r);
  for (const m of r.methods.filter((x) => x !== "GET")) {
    if (mod.__error || typeof mod[m] !== "function") { secondGate.errored.push(`${m} ${r.path}: ${mod.__error?.message?.slice(0, 80) || "no export"}`); continue; }
    becomeAuditor();
    outbound.length = 0;
    let res;
    try {
      res = await run(mod[m], await request(m, r.path, {}));
    } catch (err) {
      res = { status: 500, json: async () => ({ error: String(err?.message || err) }) };
    }
    const tw = tenantWritesOf(writes);
    const body = await res.json?.().catch(() => ({})) ?? {};
    if (res.status === 403 && READ_ONLY_MESSAGE.test(body.error || "")) secondGate.refused += 1;
    else if (tw.length || outbound.some((o) => o.method !== "GET")) secondGate.leaked.push(`${m} ${r.path} → ${res.status}, wrote ${tw.map((w) => `${w.model}.${w.method}`).join(",") || "nothing"}`);
    else if (usesSession(r.src)) secondGate.errored.push(`${m} ${r.path} → ${res.status} ${String(body.error || "").slice(0, 60)}`);
    else secondGate.sessionless.push(`${m} ${r.path}`);
  }
}
ok(`no tenant write handler writes for the auditor even with the middleware skipped (${secondGate.refused} refused with the read-only message)`,
  secondGate.leaked.length === 0, secondGate.leaked.slice(0, 15).join("\n       "));
if (!QUIET) {
  console.log(`       ${secondGate.sessionless.length} handlers do not act on a session at all (public forms, webhooks, token links, cron): middleware refuses the method anyway.`);
  console.log(`       ${secondGate.errored.length} returned before reaching the gate without writing (import/400/404/500):`);
  for (const e of secondGate.errored) console.log(`         · ${e}`);
}

// ═══════════════ 5. Every GET: served, and silent ══════════════════════════
console.log("\n5. Every GET handler, as the auditor and as the real owner\n");

const personaHashes = {};
const EXCLUDED_GET = /^\/api\/(platform|sales|cron|webhooks|public|portal|auth)(\/|$)/;
// GETs that refuse the auditor ON PURPOSE — each is an act on the company's
// behalf (an OAuth hand-off that saves a connection, a Stripe onboarding link,
// a checkout return that credits the account), not a read the console is
// missing. Adding a path here is a decision, and it has to say why.
const DELIBERATE_GET_REFUSALS = {
  ...Object.fromEntries(WRITE_SHAPED_GET_PATHS.map((p) => [p, "acts rather than reads (lib/platform/impersonationToken.js)"])),
  "/api/migrations/x/checkout": "settles a Stripe payment for the company (Stripe return URL)",
  // Pre-dates this change and is NOT a decision: the route's one loader
  // refuses support for its upload POST and so for the list GET too. Named
  // here so it is visible; a follow-up, not this fix.
  "/api/migrations/x/documents": "PRE-EXISTING: shared loader refuses support sessions for the GET as well as the upload",
};
const sweep = { served: 0, sameAsOwner: 0, refused: [], deliberate: [], wrote: [], sentOut: [], ownerWrites: [], notRun: [] };
const REFUSAL = /access|permission|only an owner|only the owner|not allowed|can't see|cannot see|forbidden|Unauthorized/i;
async function outcome(handler, req) {
  outbound.length = 0;
  let res;
  try {
    res = await run(handler, req);
  } catch (err) {
    return { status: 599, error: String(err?.message || err).slice(0, 80), writes: writes.slice(), out: outbound.slice(), hash: "-" };
  }
  const text = res?.text ? await res.text().catch(() => "") : "";
  let body = {};
  try { body = JSON.parse(text); } catch {}
  return {
    status: res?.status ?? 0,
    error: body?.error,
    location: res?.headers?.get?.("location") || null,
    body,
    writes: writes.slice(),
    out: outbound.slice(),
    hash: createHash("md5").update(text).digest("hex").slice(0, 10),
  };
}
for (const r of ROUTES.filter((x) => x.methods.includes("GET") && !EXCLUDED_GET.test(x.path))) {
  const mod = await load(r);
  if (mod.__error || typeof mod.GET !== "function") { sweep.notRun.push(`${r.path}: ${String(mod.__error?.message || "no GET").slice(0, 70)}`); continue; }
  for (const name of ["crew", "restricted"]) {
    becomePersona(name);
    const o = await outcome(mod.GET, await request("GET", r.path));
    personaHashes[`sweep ${name} ${r.path}`] = `${o.status}:${o.hash}`;
  }
  becomePersona("owner");
  const asOwner = await outcome(mod.GET, await request("GET", r.path));
  personaHashes[`sweep owner ${r.path}`] = `${asOwner.status}:${asOwner.hash}`;
  becomeAuditor();
  const asAuditor = await outcome(mod.GET, await request("GET", r.path));
  const tw = tenantWritesOf(asAuditor.writes);
  const refusedStatus = asAuditor.status === 401 || asAuditor.status === 403;
  if (DELIBERATE_GET_REFUSALS[r.path]) {
    sweep.deliberate.push(`${r.path} → ${asAuditor.status}${asAuditor.location ? ` ${asAuditor.location}` : ""}: ${DELIBERATE_GET_REFUSALS[r.path]}`);
  } else if (refusedStatus && !(asOwner.status === 401 || asOwner.status === 403)) {
    sweep.refused.push(`${r.path} → ${asAuditor.status} "${String(asAuditor.error || "").slice(0, 70)}" (owner: ${asOwner.status})`);
  } else if (refusedStatus && REFUSAL.test(String(asAuditor.error || ""))) {
    sweep.refused.push(`${r.path} → ${asAuditor.status} "${String(asAuditor.error || "").slice(0, 70)}" (owner refused too)`);
  } else {
    sweep.served += 1;
    if (asAuditor.status === asOwner.status && asAuditor.hash === asOwner.hash) sweep.sameAsOwner += 1;
  }
  if (tw.length) sweep.wrote.push(`${r.path}: ${tw.map((w) => `${w.model}.${w.method}`).join(", ")}`);
  if (asAuditor.out.some((o) => o.method !== "GET")) sweep.sentOut.push(`${r.path}: ${asAuditor.out.map((o) => `${o.method} ${o.url}`).join(", ")}`);
  const ow = tenantWritesOf(asOwner.writes);
  if (ow.length) sweep.ownerWrites.push(`${r.path}: ${ow.map((w) => `${w.model}.${w.method}`).join(", ")}`);
}
ok(`no GET refuses the auditor where the owner is served — ${sweep.served} served, ${sweep.sameAsOwner} byte-identical to the owner's own response`,
  sweep.refused.length === 0, sweep.refused.join("\n       "));
ok("no GET writes into the company for the auditor", sweep.wrote.length === 0, sweep.wrote.join("\n       "));
ok("no GET sends a non-GET request out for the auditor", sweep.sentOut.length === 0, sweep.sentOut.join("\n       "));
if (!QUIET) {
  console.log(`       refused on purpose (acts, not reads): ${sweep.deliberate.length}`);
  for (const d of sweep.deliberate) console.log(`         · ${d}`);
  console.log(`       GETs that DO write for the real owner on this fixture (silent for the auditor): ${sweep.ownerWrites.length}`);
  for (const w of sweep.ownerWrites) console.log(`         · ${w}`);
  console.log(`       not executed offline (import needs a live service): ${sweep.notRun.length}`);
  for (const n of sweep.notRun) console.log(`         · ${n}`);
}

// ═══════════════ 6. The read matrix ═══════════════════════════════════════
console.log("\n6. The owner's screens and the core lists — auditor vs five real personas\n");

const MATRIX = [
  ["/api/clients/c1", "app/api/clients/[id]/route.js"],
  ["/api/clients/c1/equipment", "app/api/clients/[id]/equipment/route.js"],
  ["/api/clients", "app/api/clients/route.js"],
  ["/api/quotes", "app/api/quotes/route.js"],
  ["/api/quotes/q1", "app/api/quotes/[id]/route.js"],
  ["/api/jobs", "app/api/jobs/route.js"],
  ["/api/invoices", "app/api/invoices/route.js"],
  ["/api/leads", "app/api/leads/route.js"],
  ["/api/leads/l1", "app/api/leads/[id]/route.js"],
  ["/api/appointments", "app/api/appointments/route.js"],
  ["/api/payroll/runs", "app/api/payroll/runs/route.js"],
  ["/api/workers", "app/api/workers/route.js"],
  ["/api/analytics/overview", "app/api/analytics/overview/route.js"],
  ["/api/analytics/kpis", "app/api/analytics/kpis/route.js"],
  ["/api/messaging/threads", "app/api/messaging/threads/route.js"],
  ["/api/voice/calls", "app/api/voice/calls/route.js"],
  ["/api/jennifer", "app/api/jennifer/route.js"],
  ["/api/time-clock", "app/api/time-clock/route.js"],
  ["/api/settings/business-info", "app/api/settings/business-info/route.js"],
  ["/api/settings/members", "app/api/settings/members/route.js"],
  ["/api/settings/ai/credit", "app/api/settings/ai/credit/route.js"],
  ["/api/settings/subscription", "app/api/settings/subscription/route.js"],
  ["/api/commissions/rates", "app/api/commissions/rates/route.js"],
  ["/api/expenses", "app/api/expenses/route.js"],
];
const MARKERS = ["restricted", "notesRestricted", "pricingHidden", "payHidden"];
function markersIn(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => markersIn(v, found));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (MARKERS.includes(k) && v === true) found.add(k);
      markersIn(v, found);
    }
  }
  return found;
}
async function matrixCell(path, file) {
  const r = ROUTES.find((x) => x.rel === file);
  const mod = r && (await load(r));
  if (!mod || mod.__error) return { status: "import-error", markers: [], hash: "-" };
  writes.length = 0;
  let res;
  try {
    res = await run(mod.GET, await request("GET", path));
  } catch (err) {
    return { status: `threw:${String(err?.message).slice(0, 30)}`, markers: [], hash: "-" };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {
    status: res.status,
    markers: [...markersIn(json)].sort(),
    hash: createHash("md5").update(text).digest("hex").slice(0, 10),
    json,
  };
}
const matrix = {};
for (const [path, file] of MATRIX) {
  matrix[path] = {};
  becomeAuditor();
  matrix[path].auditor = await matrixCell(path, file);
  for (const name of Object.keys(PERSONAS)) {
    becomePersona(name);
    matrix[path][name] = await matrixCell(path, file);
    personaHashes[`${name} ${path}`] = `${matrix[path][name].status}:${matrix[path][name].hash}`;
  }
}
const cols = ["auditor", ...Object.keys(PERSONAS)];
console.log(`       ${"endpoint".padEnd(30)} ${cols.map((col) => col.padEnd(18)).join("")}`);
for (const [path] of MATRIX) {
  const cell = (col) => `${matrix[path][col].status}${matrix[path][col].markers.length ? ` ${matrix[path][col].markers.map((m) => m.replace("Restricted", "R").replace("Hidden", "H")).join("/")}` : ""}`;
  console.log(`       ${path.padEnd(30)} ${cols.map((col) => cell(col).padEnd(18)).join("")}`);
}
for (const [path] of MATRIX) {
  const a = matrix[path].auditor;
  ok(`auditor ${path}: served as the owner is (${a.status}), nothing hidden`,
    a.status === matrix[path].owner.status && a.status !== 401 && a.status !== 403 && a.markers.length === 0,
    `auditor ${a.status} ${a.markers.join(",")} / owner ${matrix[path].owner.status}`);
}
const cd = matrix["/api/clients/c1"].auditor.json;
ok("the client page's contact details reach the auditor (email, phone, contact)", cd?.email === CLIENT.email && cd?.phone === CLIENT.phone && cd?.contactName === CLIENT.contactName);
const eq = matrix["/api/clients/c1/equipment"].auditor.json;
ok("the Equipment & warranties card loads for the auditor", Array.isArray(eq?.equipment) && eq.equipment.length === 1);
ok("the quotes list loads for the auditor, with its money", matrix["/api/quotes"].auditor.status === 200 && JSON.stringify(matrix["/api/quotes"].auditor.json || "").includes("7645"));
ok("crew: the client's contact details are still hidden", matrix["/api/clients/c1"].crew.markers.includes("restricted"));
ok("crew: equipment still refused below full_view", matrix["/api/clients/c1/equipment"].crew.status === 403);
ok("crew: quotes still refused (quotes: none)", matrix["/api/quotes"].crew.status === 403);
ok("restricted custom role: quote money still hidden", matrix["/api/quotes"].restricted.markers.includes("pricingHidden"));
ok("restricted custom role: client contact still hidden", matrix["/api/clients/c1"].restricted.markers.includes("restricted"));
ok("owner and admin: nothing hidden", ["owner", "admin"].every((p) => MATRIX.every(([path]) => matrix[path][p].markers.length === 0)));

// ═══════════════ 7. The side-effect GETs ══════════════════════════════════
console.log("\n7. The GETs that write on read, driven down their write path\n");
//
// Section 5 only reaches the writes an empty fixture walks into. Each GET
// below is scripted so its write path is LIVE: the real owner's request must
// write (or call a provider with a write) — proof the fixture reaches it — and
// the auditor's, on the SAME fixture, must write nothing and still answer.
//
// Last on purpose: Stripe is given a fake key here and its client pinned to a
// closed local port, with the few methods these routes use answered in-process
// — nothing may reach api.stripe.com, and nothing after this section runs
// against a Stripe client that exists.
process.env.STRIPE_SECRET_KEY = "sk_test_check_impersonation_not_a_real_key";
const { stripe } = await import("@/lib/stripe");
Object.assign(stripe._api, { host: "127.0.0.1", port: "9", protocol: "http", maxNetworkRetries: 0 });
const STRIPE_ACCOUNT = {
  id: "acct_1", country: "CA", charges_enabled: true, details_submitted: true,
  capabilities: {}, requirements: { currently_due: [] }, email: "o@zlla.example",
};
const LIVE_SUB = {
  id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false,
  current_period_end: 1893456000, items: { data: [{ id: "si_1", quantity: 3, price: { id: "price_1" } }] },
};
const stripeRead = (name, value) => async () => { outbound.push({ url: `stripe:${name}`, method: "GET" }); return structuredClone(value); };
const stripeWrite = (name, value) => async () => { outbound.push({ url: `stripe:${name}`, method: "POST" }); return structuredClone(value); };
stripe.accounts.retrieve = stripeRead("accounts.retrieve", STRIPE_ACCOUNT);
stripe.accounts.update = stripeWrite("accounts.update", { ...STRIPE_ACCOUNT, capabilities: { card_payments: "active", transfers: "active" } });
stripe.accounts.retrieveCapability = stripeRead("accounts.retrieveCapability", { id: "affirm_payments", status: "inactive", requirements: {} });
stripe.subscriptions.retrieve = async (id) => {
  outbound.push({ url: "stripe:subscriptions.retrieve", method: "GET" });
  return id === "sub_ai" ? { ...structuredClone(LIVE_SUB), id, metadata: { companyId: CO, bundleKey: "starter" } } : structuredClone(LIVE_SUB);
};
stripe.checkout.sessions.retrieve = stripeRead("checkout.sessions.retrieve", {
  id: "cs_1", payment_status: "paid", status: "complete", mode: "subscription",
  metadata: { companyId: CO, kind: "ai_bundle_subscription" }, subscription: "sub_ai",
});
// Exports are switched off deployment-wide (lib/export/companyDataExport.js);
// switched on here so the activity-log line they write is reachable.
const exportSwitch = await import("@/lib/export/companyDataExport");
exportSwitch.companyDataExport.available = true;

// Google answered in-process for the heal-on-read specs below: a rooftop
// geocode, and the Business Profile token / accounts / locations reads.
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const GEOCODE_HIT = () => json({ status: "OK", results: [{ formatted_address: "1 Main St, Toronto", geometry: { location: { lat: 43.65, lng: -79.38 }, location_type: "ROOFTOP" } }] });
const tokenCrypto = await import("@/lib/meta/tokenCrypto");
const GOOGLE_ENV = { GOOGLE_OAUTH_CLIENT_ID: "cid_check_only", GOOGLE_OAUTH_CLIENT_SECRET: "cs_check_only_not_real", META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
// `refuse` names the one call Google turns down, so each of the route's
// four stamps (token, accounts, locations page, success) is reached alone.
const googleBusinessResponder = ({ refuse = null } = {}) => (url) => {
  const no = () => json({ error: { message: "Quota exceeded for quota metric" } }, 403);
  if (url === "https://oauth2.googleapis.com/token") return refuse === "token" ? json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400) : json({ access_token: "at_check_only" });
  if (/mybusinessaccountmanagement\.googleapis\.com\/v1\/accounts$/.test(url)) {
    return refuse === "accounts" ? no() : json({ accounts: [{ name: "accounts/1", accountName: "Zlla Painting" }] });
  }
  if (/mybusinessbusinessinformation\.googleapis\.com\/v1\/accounts\/1\/locations/.test(url)) {
    return refuse === "locations" ? no() : json({ locations: [{ name: "locations/9", title: "Zlla Painting", storefrontAddress: { addressLines: ["1 Main St"], locality: "Toronto", administrativeArea: "ON" } }] });
  }
  return null;
};

// A cover request whose shift began before anyone answered: listFor's expiry
// moves it to "expired" and tells Jonny (u-crew).
const STALE_SHIFT_REQUEST = {
  id: "sr1", companyId: CO, shiftId: "s1", kind: "cover", fromWorkerId: "w1", toWorkerId: null, offeredShiftId: null,
  status: "pending_peer", note: null, decisionNote: null, decidedById: null, decidedAt: null, createdAt: new Date("2025-05-01"),
  shift: { id: "s1", start: new Date("2025-06-01T12:00:00Z"), end: new Date("2025-06-01T20:00:00Z") }, offeredShift: null,
  fromWorker: { id: "w1", name: "Jonny", title: null, userId: "u-crew" }, toWorker: null, decidedBy: null,
};

const SUB_ROW = { id: "sub-row", companyId: CO, status: "trialing", stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1", plan: { maxUsers: 10, seats: 10, crewSeats: null } };
const SIDE_EFFECT_GETS = [
  { label: "GET /api/ai-employee/sources (creates the default AI employee)", file: "app/api/ai-employee/sources/route.js", path: "/api/ai-employee/sources", script() {}, auditorStillReads: true },
  { label: "GET /api/calendar/feed (mints a feed token onto the member)", file: "app/api/calendar/feed/route.js", path: "/api/calendar/feed", script() {} },
  { label: "GET /api/settings/follow-up-rules (seeds the defaults)", file: "app/api/settings/follow-up-rules/route.js", path: "/api/settings/follow-up-rules", script() {}, auditorStillReads: true },
  { label: "GET /api/hr/onboarding/templates (seeds a template)", file: "app/api/hr/onboarding/templates/route.js", path: "/api/hr/onboarding/templates", script() {}, auditorStillReads: true },
  {
    label: "GET /api/quote-text-blocks (seeds the library)", file: "app/api/quote-text-blocks/route.js", path: "/api/quote-text-blocks",
    script(r) { r["companyServiceCategory.count"] = 1; }, auditorStillReads: true,
  },
  {
    label: "GET /api/stripe/connect/status (capability request, company write-back, sales milestone)", file: "app/api/stripe/connect/status/route.js", path: "/api/stripe/connect/status",
    script(r) { r["company.findUnique"] = () => ({ ...COMPANY, stripeAccountId: "acct_1", stripeOnboarded: false, stripeChargesEnabled: false, stripeBankDebitEnabled: false, stripeAffirmStatus: null, offerFinancing: false }); },
    auditorStillReads: true,
  },
  {
    label: "GET /api/settings/subscription?live=1 (syncs the row from Stripe)", file: "app/api/settings/subscription/route.js", path: "/api/settings/subscription?live=1",
    script(r) { r["subscription.findUnique"] = () => ({ ...SUB_ROW }); r["subscription.findFirst"] = () => ({ ...SUB_ROW }); }, auditorStillReads: true,
  },
  {
    label: "GET /api/settings/subscription/retention (heals the row from Stripe)", file: "app/api/settings/subscription/retention/route.js", path: "/api/settings/subscription/retention",
    script(r) { r["subscription.findUnique"] = () => ({ ...SUB_ROW }); r["subscription.findFirst"] = () => ({ ...SUB_ROW }); r["member.count"] = 3; }, auditorStillReads: true,
  },
  {
    label: "GET /api/settings/ai/bundle?session_id= (settles a checkout return)", file: "app/api/settings/ai/bundle/route.js", path: "/api/settings/ai/bundle?session_id=cs_1",
    script() {}, auditorStillReads: true,
  },
  {
    label: "GET /api/settings/voice (heals a stalled number status)", file: "app/api/settings/voice/route.js", path: "/api/settings/voice",
    script(r) {
      r["voicePhoneNumber.findFirst"] = () => ({ id: "n1", companyId: CO, e164: "+14165550123", status: "provisioning", source: "retell", numberType: "local", createdAt: new Date("2025-01-01") });
    },
    env: { RETELL_API_KEY: "key_check_only_not_real" },
    fetch: (url) => (/retellai\.com\/get-phone-number/.test(url) ? new Response(JSON.stringify({ phone_number: "+14165550123", inbound_agent_id: null }), { status: 200, headers: { "content-type": "application/json" } }) : null),
    auditorStillReads: true,
  },
  {
    label: "GET /api/export/accounting (logs the export as the member)", file: "app/api/export/accounting/route.js", path: "/api/export/accounting?from=2025-01-01&to=2025-12-31",
    script() {}, auditorStillReads: true,
  },
  {
    label: "GET /api/leave (creates the caller a Worker, refreshes accruals)", file: "app/api/leave/route.js", path: "/api/leave",
    script(r) {
      r["worker.findFirst"] = () => null;
      r["leavePolicy.findMany"] = () => [{ id: "lp1", companyId: CO, name: "Vacation", kind: "vacation", active: true, paid: true, accrualMethod: "annual_grant", annualDays: 10 }];
    },
    auditorStillReads: true,
  },
  {
    label: "GET /api/hr/workers/[id]/onboarding (reconciles runs as the caller)", file: "app/api/hr/workers/[workerId]/onboarding/route.js", path: "/api/hr/workers/w1/onboarding",
    script(r) {
      r["worker.findFirst"] = () => ({ ...WORKER });
      r["onboardingRun.findMany"] = (args) => (args?.where?.completedAt === null ? [{ id: "run1", workerId: "w1", templateId: "t1", items: [], startedAt: new Date("2025-01-01"), completedAt: null, startedById: "u-owner" }] : []);
    },
    auditorStillReads: true,
  },
  {
    label: "GET /api/hr/me/onboarding (reconciles the caller's own run)", file: "app/api/hr/me/onboarding/route.js", path: "/api/hr/me/onboarding",
    script(r) {
      r["worker.findFirst"] = () => ({ ...WORKER, userId: "u-owner" });
      r["onboardingRun.findMany"] = (args) => (args?.where?.completedAt === null ? [{ id: "run1", workerId: "w1", templateId: "t1", items: [], startedAt: new Date("2025-01-01"), completedAt: null, startedById: "u-owner" }] : []);
    },
    auditorStillReads: true,
  },
  {
    label: "GET /api/invoices/[id]/lifecycle (refreshes the family ledger onto the invoice)", file: "app/api/invoices/[id]/lifecycle/route.js", path: "/api/invoices/i1/lifecycle",
    script(r) {
      r["invoice.findFirst"] = () => ({ ...INVOICE, jobId: null, quoteId: null, parentInvoiceId: null, version: 1, payments: [] });
      r["invoice.findUnique"] = () => ({ ...INVOICE, parentInvoiceId: null, version: 1 });
      r["invoice.findMany"] = () => [{ ...INVOICE, parentInvoiceId: null, version: 1 }];
    },
    auditorStillReads: true,
  },
  {
    label: "GET /api/quotes/[id] (links an instant estimate's visits)", file: "app/api/quotes/[id]/route.js", path: "/api/quotes/q1",
    script(r) { r["quote.findFirst"] = () => ({ ...QUOTE, autoEstimated: true, appointments: [] }); },
    auditorStillReads: true,
  },
  {
    label: "GET /api/jobs/[id]/photos (files the quote's photos onto the job)", file: "app/api/jobs/[id]/photos/route.js", path: "/api/jobs/j1/photos",
    script(r) {
      r["job.findFirst"] = () => ({ id: "j1", companyId: CO, quoteId: "q1" });
      r["quote.findUnique"] = () => ({ id: "q1", companyId: CO, quoteNumber: "Q-0001", clientPhotos: [{ url: "https://res.cloudinary.com/demo/image/upload/v1/fq/a.jpg" }], company: { defaultLanguage: "en" } });
    },
    env: { CLOUDINARY_CLOUD_NAME: "demo" },
    auditorStillReads: true,
  },
  // ── Heal-on-read writes left over from the first pass (ROADMAP, 28 Sep) ──
  //
  // Each is the route's own write, skipped in the route. `sameRead` compares
  // what the auditor was answered with what the owner was, less the fields
  // the write itself produced — a skipped geocode answers the stored nulls,
  // which is the truth about the row, not a different read.
  {
    label: "GET /api/schedule/map (geocodes the company's own address for the centre)", file: "app/api/schedule/map/route.js", path: "/api/schedule/map?day=2025-06-02",
    script(r) { r["company.findUnique"] = () => ({ ...COMPANY, latitude: null, longitude: null }); },
    env: { GOOGLE_MAPS_SERVER_KEY: "maps_check_only_not_real" },
    fetch: (url) => (/maps\.googleapis\.com\/maps\/api\/geocode/.test(url) ? GEOCODE_HIT() : null),
    auditorStillReads: true,
    sameRead: (own, aud) => own.centre?.lat === 43.65 && aud.centre === null && aud.day === own.day && JSON.stringify(aud.entries) === JSON.stringify(own.entries),
  },
  {
    label: "GET /api/schedule/map (backfills an appointment's coordinates)", file: "app/api/schedule/map/route.js", path: "/api/schedule/map?day=2025-06-02",
    script(r) {
      r["appointment.findMany"] = () => [{ id: "a1", companyId: CO, scheduledAt: new Date("2025-06-02T15:00:00Z"), status: "scheduled", location: "9 Elm St, Toronto", client: { ...CLIENT }, latitude: null, longitude: null, geocodedAt: null }];
    },
    env: { GOOGLE_MAPS_SERVER_KEY: "maps_check_only_not_real" },
    fetch: (url) => (/maps\.googleapis\.com\/maps\/api\/geocode/.test(url) ? GEOCODE_HIT() : null),
    auditorStillReads: true,
    sameRead: (own, aud) => own.geocoded?.tried === 1 && aud.geocoded?.tried === 0 && aud.geocoded?.remaining === 1 &&
      aud.entries?.length === 1 && aud.entries[0].id === "a1" && aud.entries[0].latitude === null && JSON.stringify(aud.centre) === JSON.stringify(own.centre),
  },
  {
    label: "GET /api/settings/business-info (geocodes the company's address)", file: "app/api/settings/business-info/route.js", path: "/api/settings/business-info",
    script(r) { r["company.findUnique"] = () => ({ ...COMPANY, latitude: null, longitude: null }); },
    env: { GOOGLE_MAPS_SERVER_KEY: "maps_check_only_not_real" },
    fetch: (url) => (/maps\.googleapis\.com\/maps\/api\/geocode/.test(url) ? GEOCODE_HIT() : null),
    auditorStillReads: true,
    sameRead: (own, aud) => {
      const strip = ({ latitude, longitude, ...rest }) => JSON.stringify(rest);
      return own.latitude === 43.65 && aud.latitude === null && aud.longitude === null && strip(aud) === strip(own);
    },
  },
  {
    label: "GET /api/settings/voice/number/repair (heals a stalled number status)", file: "app/api/settings/voice/number/repair/route.js", path: "/api/settings/voice/number/repair",
    script(r) {
      r["voicePhoneNumber.findFirst"] = () => ({ id: "n1", companyId: CO, e164: "+14165550123", status: "provisioning", source: "retell", numberType: "local", createdAt: new Date("2025-01-01") });
    },
    env: { RETELL_API_KEY: "key_check_only_not_real" },
    fetch: (url) => (/retellai\.com\/get-phone-number/.test(url) ? new Response(JSON.stringify({ phone_number: "+14165550123", inbound_agent_id: null }), { status: 200, headers: { "content-type": "application/json" } }) : null),
    auditorStillReads: true,
    sameRead: (own, aud) => aud.e164 === "+14165550123" && aud.verdict === own.verdict && aud.statusStale === true,
  },
  {
    label: "GET /api/reviews/google/locations (stamps lastSyncAt on the Business Profile connection)", file: "app/api/reviews/google/locations/route.js", path: "/api/reviews/google/locations",
    script(r) { r["companyGoogleBusiness.findUnique"] = () => ({ companyId: CO, refreshTokenEnc: tokenCrypto.encryptToken("rt_check_only"), email: "o@zlla.example" }); },
    env: GOOGLE_ENV,
    fetch: googleBusinessResponder(),
    // Minting a short-lived access token is a POST, and is the read's own
    // precondition: nothing is stored (lib/calendar/googleClient.js).
    readCalls: /^https:\/\/oauth2\.googleapis\.com\/token$/,
    auditorStillReads: true,
    sameRead: (own, aud) => aud.locations?.length === 1 && JSON.stringify(aud) === JSON.stringify(own),
  },
  ...["token", "accounts", "locations"].map((refuse) => ({
    label: `GET /api/reviews/google/locations (stamps Google's refusal of the ${refuse} call as lastError)`, file: "app/api/reviews/google/locations/route.js", path: "/api/reviews/google/locations",
    script(r) { r["companyGoogleBusiness.findUnique"] = () => ({ companyId: CO, refreshTokenEnc: tokenCrypto.encryptToken("rt_check_only"), email: "o@zlla.example" }); },
    env: GOOGLE_ENV,
    fetch: googleBusinessResponder({ refuse }),
    readCalls: /^https:\/\/oauth2\.googleapis\.com\/token$/,
    // Google's refusal is the read here: the auditor is told the same 502.
    sameRead: (own, aud, ownOut, audOut) => ownOut.status === 502 && audOut.status === 502 && Boolean(aud.error) && aud.error === own.error,
  })),
  // ── The same, where the write lives in a shared lib (a `readOnly` option,
  // or the member itself, passed through; every other caller unchanged) ──
  {
    label: "GET /api/shift-requests (expires a stale request and notifies the crew on it)", file: "app/api/shift-requests/route.js", path: "/api/shift-requests",
    script(r) { r["shiftRequest.findMany"] = () => [{ ...STALE_SHIFT_REQUEST }]; },
    notifies: true,
    auditorStillReads: true,
    sameAsOwner: true,
  },
  {
    label: "GET /api/onboarding-status (stamps onboardingCompletedAt on a finished checklist)", file: "app/api/onboarding-status/route.js", path: "/api/onboarding-status",
    script(r) {
      r["company.findUnique"] = () => ({ ...COMPANY, logoUrl: "https://res.cloudinary.com/demo/logo.png", stripeChargesEnabled: true, taxIdNumber: "123456789RT0001", onboardingCompletedAt: null });
      r["companyServiceCategory.count"] = 1;
      r["companyServiceCategory.findMany"] = () => [{ defaultRate: 45, category: { key: "painting" } }];
    },
    auditorStillReads: true,
    sameAsOwner: true,
  },
  ...[
    ["/api/settings/gallery", "app/api/settings/gallery/route.js"],
    ["/api/settings/website", "app/api/settings/website/route.js"],
    ["/api/settings/quote-email", "app/api/settings/quote-email/route.js"],
    ["/api/quotes/q1/email-sections", "app/api/quotes/[id]/email-sections/route.js"],
    ["/api/settings/presentation", "app/api/settings/presentation/route.js"],
    ["/api/quotes/q1/presentation", "app/api/quotes/[id]/presentation/route.js"],
    ["/api/setup-steps", "app/api/setup-steps/route.js"],
  ].map(([path, file]) => ({
    label: `GET ${path} (runs the one-time gallery merge)`, file, path,
    script(r) {
      r["company.findUnique"] = () => ({ ...COMPANY, galleryMergedAt: null, quoteEmailBeforeAfter: [{ beforeUrl: "https://res.cloudinary.com/demo/b1.jpg", afterUrl: "https://res.cloudinary.com/demo/a1.jpg" }], site: null });
      r["companyGalleryPair.findMany"] = () => [{ id: "g0", beforeUrl: "https://res.cloudinary.com/demo/b0.jpg", afterUrl: "https://res.cloudinary.com/demo/a0.jpg", beforePublicId: null, afterPublicId: null, caption: "Kitchen", sortOrder: 0, source: "manual" }];
    },
    auditorStillReads: true,
    sameAsOwner: true,
  })),
  {
    label: "GET /api/settings/voice/readiness (heals a stalled number status)", file: "app/api/settings/voice/readiness/route.js", path: "/api/settings/voice/readiness",
    script(r) {
      r["voicePhoneNumber.findFirst"] = () => ({ id: "n1", companyId: CO, e164: "+14165550123", status: "provisioning", source: "retell", numberType: "local", createdAt: new Date("2025-01-01") });
    },
    env: { RETELL_API_KEY: "key_check_only_not_real" },
    fetch: (url) => (/retellai\.com\/get-phone-number/.test(url) ? json({ phone_number: "+14165550123", inbound_agent_id: null }) : null),
    auditorStillReads: true,
    sameAsOwner: true,
  },
  ...["token", "freeBusy"].map((refuse) => ({
    label: `GET /api/calendar/google/busy (stamps Google's refusal of the ${refuse} call as the connection's lastError)`, file: "app/api/calendar/google/busy/route.js",
    path: "/api/calendar/google/busy?from=2025-06-01T00:00:00Z&to=2025-06-08T00:00:00Z",
    script(r) {
      r["memberGoogleCalendar.findMany"] = () => [{
        memberId: "m-owner", refreshTokenEnc: tokenCrypto.encryptToken("rt_check_only"), calendarId: "primary", busyReadEnabled: true,
        member: { userId: "u-owner", user: { name: "Zed Owner" } },
      }];
    },
    env: GOOGLE_ENV,
    fetch: (url) => {
      if (url === "https://oauth2.googleapis.com/token") return refuse === "token" ? json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400) : json({ access_token: "at_check_only" });
      if (url === "https://www.googleapis.com/calendar/v3/freeBusy") return json({ error: { message: "Calendar usage limits exceeded." } }, 403);
      return null;
    },
    // Both are POSTs and both are the read itself: a token mint (nothing
    // stored) and a free/busy QUERY. Neither changes anything at Google.
    readCalls: /^https:\/\/(oauth2\.googleapis\.com\/token|www\.googleapis\.com\/calendar\/v3\/freeBusy)$/,
    auditorStillReads: true,
    sameAsOwner: true,
  })),
];
for (const spec of SIDE_EFFECT_GETS) {
  const r = ROUTES.find((x) => x.rel === spec.file);
  const mod = r && (await load(r));
  if (!mod || mod.__error || typeof mod.GET !== "function") { ok(`${spec.label}: route loads`, false, String(mod?.__error?.message || spec.file)); continue; }
  const drive = async () => {
    spec.script(rows);
    const saved = {};
    for (const [k, v] of Object.entries(spec.env || {})) { saved[k] = process.env[k]; process.env[k] = v; }
    fetchResponder = spec.fetch || null;
    try {
      const o = await outcome(mod.GET, await request("GET", spec.path));
      // Fire-and-forget work (`void notifyDecided(...)` in the shift-request
      // expiry) lands after the response: read the writes once it has.
      await new Promise((r) => setTimeout(r, 50));
      return { ...o, writes: writes.slice(), out: outbound.slice() };
    } finally {
      fetchResponder = null;
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  };
  becomePersona("owner");
  const own = await drive();
  const acts = (o) => [
    ...tenantWritesOf(o.writes).map((w) => `${w.model}.${w.method}`),
    ...o.out.filter((x) => x.method !== "GET" && !spec.readCalls?.test(x.url)).map((x) => x.url),
  ];
  const ownActs = acts(own);
  becomeAuditor();
  const aud = await drive();
  const audActs = acts(aud);
  ok(`${spec.label}: the real owner's request reaches the write (${ownActs.join(", ") || "nothing"})`, ownActs.length > 0, `owner ${own.status} ${own.error || ""}`);
  ok(`${spec.label}: the auditor's performs 0 writes (status ${aud.status})`, audActs.length === 0, audActs.join(", "));
  if (spec.auditorStillReads) ok(`${spec.label}: …and still answers the read`, aud.status === 200, `${aud.status} ${aud.error || ""}`);
  if (spec.notifies) {
    const notes = (o) => tenantWritesOf(o.writes).filter((w) => /^notification/.test(w.model)).length + o.out.filter((x) => x.method !== "GET").length;
    ok(`${spec.label}: the owner's request notifies (${notes(own)}), the auditor's notifies nobody (${notes(aud)})`, notes(own) > 0 && notes(aud) === 0);
  }
  if (spec.sameAsOwner) {
    ok(`${spec.label}: …byte-identical to the owner's answer (${aud.status}:${aud.hash} / ${own.status}:${own.hash})`, aud.status === own.status && aud.hash === own.hash);
  }
  if (spec.sameRead) {
    ok(`${spec.label}: …with the owner's read, less only what the skipped write would have added`,
      spec.sameRead(own.body || {}, aud.body || {}, own, aud), `owner ${own.status} ${JSON.stringify(own.body).slice(0, 160)}\n       auditor ${aud.status} ${JSON.stringify(aud.body).slice(0, 160)}`);
  }
}
exportSwitch.companyDataExport.available = false;
delete process.env.STRIPE_SECRET_KEY;

// --matrix-out=<file>: every real-member cell as status:md5, for diffing this
// tree against another (a flag, not an env var: nothing here is deployment
// configuration — scripts/check-env-docs.mjs).
const MATRIX_OUT = process.argv.find((a) => a.startsWith("--matrix-out="))?.slice("--matrix-out=".length);
if (MATRIX_OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(MATRIX_OUT, JSON.stringify(personaHashes, null, 1));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
