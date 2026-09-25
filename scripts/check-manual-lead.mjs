// scripts/check-manual-lead.mjs
//
//   npm run check:manual-lead
//
// Create › Request, end to end: the Create row opens a real form, the form
// posts to the lead-creation path every inbound channel already uses, and a
// member the row is hidden from is refused by the route as well.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Until 2026-09-25 the Create menu's Request row opened the leads board, which
// had no way to enter a lead by hand — a Create row that created nothing. The
// fix is /app/leads/new posting to POST /api/leads, and three things about it
// are easy to get quietly wrong later:
//
//   1. A second creation path. The route must hand the lead to
//      createScoredLead (lib/leads/createLead.js), not write its own
//      db.leadRequest.create — an unscored, un-notified lead in a sixth intake
//      layout is the copy that rots.
//   2. The gate. The row is shown at requests:view_create_edit
//      (lib/permissions/nav.js). Hiding the row is not access control, so the
//      route has to refuse below that level on its own — EXECUTED here with
//      the real handler, not read.
//   3. The form drifting off the route: a fetch to some other URL, or a row
//      pointing somewhere else again.
//
// Same stub technique as scripts/check-ungated-routes.mjs: the real handler is
// imported with "@/lib/db", "@/lib/currentMember", "next/server" and the
// notification feed swapped for recording stubs. The real createScoredLead
// runs — so a written row carrying a score is proof the lead went through it.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { register } from "node:module";

import { PERMISSION_PRESETS } from "@/lib/permissions";
import { NAV_REQUIREMENTS } from "@/lib/permissions/nav";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail !== undefined ? `  — ${JSON.stringify(detail)}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}\n`);

/** Source with comments removed — a comment describing a call is not the call. */
const code = (rel) =>
  readFileSync(join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");

// ═══════════════════════════════════════════════════════════════════════════
// The stub harness — only what this handler asks of Prisma; anything else
// throws, so an unmodelled query cannot pass by answering "nothing".
// ═══════════════════════════════════════════════════════════════════════════

globalThis.__FQ_ROWS = {};
globalThis.__FQ_WRITES = [];
globalThis.__FQ_NOTIFY = [];

function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => v === undefined || row[k] === v);
}
function project(row, args = {}) {
  if (!row || !args.select) return row;
  return Object.fromEntries(Object.keys(args.select).map((k) => [k, row[k]]));
}
function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findUnique(args = {}) {
      return project(all().find((r) => matches(r, args.where)) || null, args);
    },
    async findFirst(args = {}) {
      return project(all().find((r) => matches(r, args.where)) || null, args);
    },
    async create(args = {}) {
      const row = { id: `${name}_${all().length + 1}`, createdAt: new Date(), ...args.data };
      (globalThis.__FQ_ROWS[name] ||= []).push(row);
      globalThis.__FQ_WRITES.push({ model: name, data: args.data });
      return row;
    },
  };
}
globalThis.__FQ_DB = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop !== "string" || prop.startsWith("$") || prop === "then") return undefined;
      if (!(prop in globalThis.__FQ_ROWS)) throw new Error(`stub: db.${prop} is not scripted in this check`);
      return stubModel(prop);
    },
  },
);
globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "@/lib/notifications/notify": "fq-stub:notify",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") return { format: "module", shortCircuit: true,
    source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  if (url === "fq-stub:member") return { format: "module", shortCircuit: true,
    source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  if (url === "fq-stub:notify") return { format: "module", shortCircuit: true,
    source: "export const notifyEvent = async (e) => { globalThis.__FQ_NOTIFY.push(e); };" };
  if (url === "fq-stub:next") return { format: "module", shortCircuit: true,
    source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const CO = "co_1";
const member = (id, userId, role, permissions) => ({ id, userId, role, companyId: CO, permissions });
const owner = member("m_own", "u_own", "owner", null);
const estimator = member("m_est", "u_est", "employee", PERMISSION_PRESETS.estimator.values);
const crew = member("m_crew", "u_crew", "employee", PERMISSION_PRESETS.worker.values);
// One rung below the gate, whatever the presets say tomorrow.
const viewOnly = member("m_view", "u_view", "employee", { ...PERMISSION_PRESETS.estimator.values, requests: "view_only" });
// lib/currentMember.js's read-only support stand-in: no Member row, role viewer.
const support = { id: null, userId: null, role: "viewer", companyId: CO, impersonation: true, impersonationMode: "read_only" };

function reset() {
  globalThis.__FQ_ROWS = {
    member: [owner, estimator, crew, viewOnly].map((m) => ({ ...m })),
    companyServiceCategory: [
      { companyId: CO, categoryId: "cat_paint", enabled: true },
      { companyId: CO, categoryId: "cat_off", enabled: false },
      { companyId: "co_other", categoryId: "cat_theirs", enabled: true },
    ],
    leadRequest: [],
  };
  globalThis.__FQ_WRITES = [];
  globalThis.__FQ_NOTIFY = [];
}

const { POST } = await import("../app/api/leads/route.js");

async function post(who, body) {
  reset();
  globalThis.__FQ_SESSION = who;
  const res = await POST({ url: "http://x/api/leads", method: "POST", json: async () => body });
  return { status: res.status, body: res.body, writes: globalThis.__FQ_WRITES, notify: globalThis.__FQ_NOTIFY };
}
const leadWrites = (r) => r.writes.filter((w) => w.model === "leadRequest");

const VALID = {
  name: "  Dana Whitfield ",
  phone: "613-555-0142",
  email: "",
  address: "12 Elm St, Ottawa, ON K1A 0B1, Canada",
  city: "Ottawa",
  province: "ON",
  country: "CA",
  categoryId: "cat_paint",
  note: "Rang the office. Wants the deck stained before June.",
};

// ═══════════════════════════════════════════════════════════════════════════
section("1. The row, the page and the form point at one another");
// ═══════════════════════════════════════════════════════════════════════════
{
  const sidebar = code("app/components/layout/AdminSidebar.js");
  const row = sidebar.match(/key:\s*"app\.quickAdd\.request",\s*href:\s*"([^"]+)"/);
  ok("Create › Request opens /app/leads/new", row?.[1] === "/app/leads/new", row?.[1]);
  ok("…which is a real page file", existsSync(join(ROOT, "app/app/leads/new/page.js")));

  const form = code("app/app/leads/new/NewLeadForm.js");
  ok(
    "the form POSTs to /api/leads",
    /fetchJson\(\s*"\/api\/leads"\s*,\s*\{\s*method:\s*"POST"/.test(form),
  );
  ok("…through fetchJson, never a bare fetch with an unchecked res.ok", !/\bfetch\(/.test(form) && !/res\.ok/.test(form));
  ok("…and lands on the board with the new lead's drawer open", /\/app\/leads\?lead=\$\{/.test(form));
  ok("…with a success toast", /showToast\(\{[\s\S]{0,200}?tone:\s*"success"/.test(form));

  // Exactly the owner's six: name, phone, email, address, service, note.
  const ids = [...form.matchAll(/\bid="(lead-[a-z]+)"/g)].map((m) => m[1]).sort();
  ok(
    "the form carries exactly name, phone, email, service and note inputs (+ the address box)",
    JSON.stringify(ids) === JSON.stringify(["lead-email", "lead-name", "lead-note", "lead-phone", "lead-service", "lead-service"].sort()),
    ids,
  );
  ok("…and the address is the shared Places box", /<AddressAutocomplete\b/.test(form));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. One creation path — the route hands the lead to createScoredLead");
// ═══════════════════════════════════════════════════════════════════════════
{
  const route = code("app/api/leads/route.js");
  ok("app/api/leads/route.js imports createScoredLead", /import\s*\{\s*createScoredLead\s*\}\s*from\s*"@\/lib\/leads\/createLead"/.test(route));
  ok("…and never writes a LeadRequest itself", !/leadRequest\.create\(/.test(route));

  const r = await post(owner, VALID);
  ok("an owner's valid lead is created (201)", r.status === 201, r);
  const w = leadWrites(r);
  ok("…as exactly one LeadRequest row", w.length === 1, w.length);
  const d = w[0]?.data || {};
  ok("…scored — the row carries createScoredLead's score and temperature", typeof d.score === "number" && typeof d.temperature === "string", d);
  ok('…with source "manual" (the word lib/analytics/kpis.js already uses)', d.source === "manual", d.source);
  ok("…the name trimmed", d.name === "Dana Whitfield", d.name);
  ok("…the note as the message", d.message === VALID.note, d.message);
  ok("…the service it was given", d.categoryId === "cat_paint", d.categoryId);
  ok(
    "…the address in the shared intake shape, with the Places halves",
    JSON.stringify(d.intake) === JSON.stringify({ address: VALID.address, city: "Ottawa", province: "ON", country: "CA" }),
    d.intake,
  );
  ok("…no document language nobody chose", d.language === null, d.language);
  ok("…and the id comes back for the redirect", r.body?.id === "leadRequest_1", r.body);
  ok(
    "the feed is told, with the staff member as the actor (so it does not tell them)",
    r.notify.length === 1 && r.notify[0].type === "lead.created" && r.notify[0].actorUserId === "u_own",
    r.notify,
  );

  const typed = await post(owner, { name: "Sam", email: "sam@example.com", address: "4 Pine Rd" });
  const td = leadWrites(typed)[0]?.data || {};
  ok("a hand-typed address stores the address alone — no invented province", JSON.stringify(td.intake) === JSON.stringify({ address: "4 Pine Rd" }), td.intake);
  ok("…no service is fine", typed.status === 201 && td.categoryId === null, td.categoryId);
  ok("…the email stored normalised by the shared sink", td.email === "sam@example.com", td.email);

  const bare = await post(owner, { name: "Pat", phone: "613-555-0100" });
  ok("a name and a phone alone is a lead, with no intake stamped", bare.status === 201 && leadWrites(bare)[0]?.data?.intake === undefined, leadWrites(bare)[0]?.data);

  const again = await post(owner, VALID);
  ok("no dedupe of its own — createScoredLead writes one row per call on every channel", again.status === 201 && leadWrites(again).length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The intake rules — refused, and nothing written");
// ═══════════════════════════════════════════════════════════════════════════
{
  const cases = [
    ["no name", { ...VALID, name: "   " }, "name_required"],
    ["neither phone nor email", { ...VALID, phone: "", email: " " }, "contact_required"],
    ["an email nothing can be delivered to", { ...VALID, email: "Macksab  1@hotmail.com" }, "invalid_email"],
    ["a service this company has switched off", { ...VALID, categoryId: "cat_off" }, "bad_categoryId"],
    ["another company's service", { ...VALID, categoryId: "cat_theirs" }, "bad_categoryId"],
  ];
  for (const [label, body, code] of cases) {
    const r = await post(owner, body);
    ok(`${label} → 400 ${code}, no row`, r.status === 400 && r.body?.code === code && leadWrites(r).length === 0, { status: r.status, body: r.body });
  }
  const unreadable = await post(owner, null);
  ok("an unreadable body → 400, no row", unreadable.status === 400 && leadWrites(unreadable).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The gate — the route refuses whoever the row is hidden from");
// ═══════════════════════════════════════════════════════════════════════════
{
  const req = NAV_REQUIREMENTS["app.quickAdd.request"];
  ok("the Create row is gated at requests:view_create_edit", req?.category === "requests" && req?.level === "view_create_edit", req);

  for (const [label, who] of [
    ["requests: view_only (one rung below)", viewOnly],
    ["the Crew preset", crew],
    ["a read-only support session", support],
  ]) {
    const r = await post(who, VALID);
    ok(`${label} → 403, nothing written, nobody notified`, r.status === 403 && leadWrites(r).length === 0 && r.notify.length === 0, { status: r.status, body: r.body });
  }
  const est = await post(estimator, VALID);
  ok("an Estimator (view_create_edit) is let through", est.status === 201 && leadWrites(est).length === 1, est.status);

  // The page's server shell asks the SAME pair of the SAME enforceable member,
  // so the page and the route cannot disagree about who may use the form.
  const page = code("app/app/leads/new/page.js");
  ok(
    "the page refuses on loadEnforceableMember + hasLevel(requests, view_create_edit)",
    /loadEnforceableMember\(db,\s*member\.id\)/.test(page) &&
      /if\s*\(\s*!hasLevel\(full,\s*"requests",\s*"view_create_edit"\)\)\s*\{\s*return\s*<NoAccessPanel/.test(page),
  );
  ok(
    "…before it loads anything for the form",
    page.indexOf("NoAccessPanel capability") !== -1 && page.indexOf("NoAccessPanel capability") < page.indexOf("companyServiceCategory"),
  );
}

console.log(
  failures.length === 0
    ? `\ncheck:manual-lead passed — ${pass} checks.\n`
    : `\ncheck:manual-lead: ${failures.length} failure(s) of ${pass + failures.length}.\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
