// scripts/check-ungated-routes.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-ungated-routes.mjs
//
// Three GET handlers answered anybody who was signed in.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// `memberOrRefusal` answers one question — "are you a member of this company?"
// — and three routes treated that answer as the whole of access control:
//
//   GET /api/marketing/campaigns   every campaign's advertising BUDGET and
//                                  reach, for the whole company
//   GET /api/funnels               every lead funnel, live or draft, with the
//                                  number of leads each has captured
//   GET /api/voice/calls           the last hundred inbound calls: the
//                                  caller's phone number, what the assistant
//                                  understood them to say, and a link to the
//                                  recording of them saying it
//
// In each case the WRITES beside them were gated and the read was not, which
// is the shape this repo keeps finding: the half nobody demos.
//
// Crew — the lowest preset, role `employee` — read all three.
//
// ══ Why this file executes the handlers ════════════════════════════════════
//
// A regex over a route file proves a gate is written down. It does not prove
// the gate REFUSES, and it passes happily against a guard disabled with
// `false &&` — which is exactly how a check comes to certify a hole. So the
// real GET and PATCH handlers are imported and called, with "@/lib/db",
// "@/lib/currentMember" and "next/server" swapped for stubs, and the
// assertions are made against the status and the body that come back. The
// technique is scripts/check-crew-access.mjs section 10's; its evaluator lives
// inside that file and is not exported, and that file belongs to another
// change, so a smaller one is built here rather than reaching into it.
//
// Two things in here are NOT executed, and this file says so rather than
// pretending otherwise: app/app/tasks/page.js and app/app/page.js are React
// components with JSX, and nothing in the alias-loader run can parse JSX
// (esbuild is fetched by npx in the two scripts that need it, so it is not
// importable here). For those, the parts that CAN be executed are: the real
// endpoint they lead to, called through the same stub harness — which is what
// makes the claim "this control ends in a 403" a fact rather than a memory —
// and the guard EXPRESSION itself, lifted out of the source and evaluated
// against the real permission table. Only the JSX placement is matched as
// text, and it is matched positionally so that deleting the guard or replacing
// it with a constant fails.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { register } from "node:module";

import { can, PERMISSION_PRESETS } from "@/lib/permissions";
import { NAV_REQUIREMENTS, navRowAllowed } from "@/lib/permissions/nav";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
const notes = [];
const ok = (label, condition) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};

/**
 * A file's source with whole-line comments dropped.
 *
 * Every source assertion in this file uses it, because a comment explaining a
 * bug quotes the expression it describes — the first version of section 7
 * failed on its own documentation, which is the assertion being wrong rather
 * than the code. Whole-line only, deliberately: a trailing `//` strip would
 * cut every `https://` in the file in half.
 */
const source = (relative) =>
  readFileSync(join(ROOT, relative), "utf8")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");

// ═══════════════════════════════════════════════════════════════════════════
// The stub harness
// ═══════════════════════════════════════════════════════════════════════════
//
// Deliberately small. It models only what these five handlers ask of Prisma —
// findMany / findFirst / findUnique / count / updateMany — and throws loudly
// on anything else, because a check that passes because a query it did not
// model answered "nothing" is worse than no check.

globalThis.__FQ_ROWS = {};
globalThis.__FQ_WRITES = [];

const RELATIONS = new Set([
  "assignedTo",
  "stops",
  "template",
  "client",
  "number",
  "eventType",
  "visits",
  "job",
  "workArea",
]);

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      const terms = Array.isArray(cond) ? cond : [cond];
      if (!terms.every((c) => matchWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      const terms = Array.isArray(cond) ? cond : [cond];
      if (!terms.some((c) => matchWhere(row, c))) return false;
      continue;
    }
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("some" in cond) {
        if (!Array.isArray(value) || !value.some((v) => matchWhere(v, cond.some)))
          return false;
        continue;
      }
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}

/** `select` builds up, `include` starts from the row — same as Prisma. */
function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    }
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!RELATIONS.has(key)) out[key] = value;
  }
  for (const [key, sub] of Object.entries(spec.include || {})) {
    out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  }
  return out;
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) {
      return all()
        .filter((r) => matchWhere(r, args.where))
        .map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async count(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).length;
    },
    // Writes land in __FQ_WRITES as well as in the row list, because the
    // assertions are about whether a refused caller wrote AT ALL — and a stub
    // that quietly succeeded would make a refusal indistinguishable from a
    // write that happened to return nothing.
    async create(args = {}) {
      const row = { id: `${name}_${all().length + 1}`, ...args.data };
      (globalThis.__FQ_ROWS[name] ||= []).push(row);
      globalThis.__FQ_WRITES.push({ model: name, data: args.data });
      return projectRow(row, args);
    },
    async updateMany(args = {}) {
      const hits = all().filter((r) => matchWhere(r, args.where));
      globalThis.__FQ_WRITES.push({ model: name, where: args.where, data: args.data });
      return { count: hits.length };
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      // `$`-prefixed Prisma internals and Symbol lookups are not modelled.
      if (prop.startsWith("$") || prop === "then") return undefined;
      if (!(prop in globalThis.__FQ_ROWS)) {
        throw new Error(`dbStub: db.${prop} is not scripted in this check`);
      }
      return stubModel(prop);
    },
  },
);

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

// ── The callers ────────────────────────────────────────────────────────────
//
// Built from the REAL presets rather than from hand-written grids. A preset
// that loosens tomorrow has to fail here, not quietly satisfy a copy of what
// it used to say.
const CO = "co_1";
const caller = (id, userId, role, permissions) => ({
  id,
  userId,
  role,
  companyId: CO,
  permissions,
});

const crew = caller("m_crew", "u_crew", "employee", PERMISSION_PRESETS.worker.values);
const estimator = caller("m_est", "u_est", "employee", PERMISSION_PRESETS.estimator.values);
const dispatcher = caller("m_disp", "u_disp", "supervisor", PERMISSION_PRESETS.dispatcher.values);
const owner = caller("m_own", "u_own", "owner", null);
const ALL_CALLERS = [crew, estimator, dispatcher, owner];

globalThis.__FQ_ROWS.member = ALL_CALLERS.map((m) => ({ ...m }));

/** Run a handler as somebody, and hand back { status, body, json }. */
async function as(who, handler, { url = "http://x/api", body, params } = {}) {
  globalThis.__FQ_SESSION = who;
  globalThis.__FQ_WRITES = [];
  const request = {
    url,
    json: async () => body ?? {},
  };
  const res = await handler(request, params ? { params: Promise.resolve(params) } : undefined);
  return { status: res.status, body: res.body, json: JSON.stringify(res.body ?? null) };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The floor these gates stand on\n");
//
// Every assertion below is only as good as the claim that Crew is `employee`
// and `employee` holds neither user:manage nor task:create. Read off the real
// table, so a permission handed to employees later fails here first.

ok("Crew maps to the `employee` role", PERMISSION_PRESETS.worker.label === "Crew");
ok("employee does NOT hold user:manage", can("employee", "user:manage") === false);
ok("supervisor DOES hold user:manage", can("supervisor", "user:manage") === true);
ok("owner holds everything", can("owner", "user:manage") === true);
ok("employee does NOT hold task:create", can("employee", "task:create") === false);
ok("supervisor DOES hold task:create", can("supervisor", "task:create") === true);
ok(
  "Crew sits at clientsProperties: name_address_only",
  PERMISSION_PRESETS.worker.values.clientsProperties === "name_address_only",
);
ok(
  "…and an Estimator sits above full_view, so the calls gate keeps them",
  PERMISSION_PRESETS.estimator.values.clientsProperties === "full_edit",
);
ok(
  "Crew has showPricing off — the dashboard's revenue tile 403s for them",
  PERMISSION_PRESETS.worker.values.showPricing === false,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. GET /api/marketing/campaigns, EXECUTED\n");
//
// The budget is the point. A refusal that still shipped the number in an error
// body would be no refusal at all, so the assertion looks for the FIGURE in
// the serialised response rather than for the absence of a key.

const BUDGET = 1250;
globalThis.__FQ_ROWS.marketingCampaign = [
  {
    id: "camp_1",
    companyId: CO,
    name: "Spring flyers, Verdun",
    type: "pamphlet",
    status: "active",
    assignedToId: "u_crew",
    budget: BUDGET,
    externalUrl: null,
    notes: "Don't exceed $1250 without asking me first.",
    templateId: null,
    sentAt: null,
    recipientCount: 400,
    createdAt: new Date("2026-08-01"),
    assignedTo: { id: "u_crew", name: "Dani" },
    stops: [
      { id: "s1", status: "pending", sortOrder: 0, assignedTo: null, client: null },
      { id: "s2", status: "spoke", sortOrder: 1, assignedTo: null, client: null },
    ],
    template: null,
  },
];

const campaigns = await import("@/app/api/marketing/campaigns/route.js");

for (const who of [crew, estimator]) {
  const res = await as(who, campaigns.GET);
  ok(`${who.id}: refused with 403`, res.status === 403);
  ok(`${who.id}: the budget is not in the body`, !res.json.includes(String(BUDGET)));
  ok(`${who.id}: no campaign name either`, !res.json.includes("Verdun"));
}
for (const who of [dispatcher, owner]) {
  const res = await as(who, campaigns.GET);
  ok(`${who.id}: allowed`, res.status === 200);
  ok(
    `${who.id}: and still gets the budget it exists to show`,
    Array.isArray(res.body) && res.body[0]?.budget === BUDGET,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. GET /api/marketing/campaigns/[id] — redacted, not refused\n");
//
// The stop list is fieldwork. app/api/marketing/stops/[id]/route.js PATCH is
// deliberately open to any member because the person at the door is usually an
// employee, so refusing this read would take the addresses away from them.
// What has to go is the money.

const campaignDetail = await import("@/app/api/marketing/campaigns/[id]/route.js");

{
  const res = await as(crew, campaignDetail.GET, { params: { id: "camp_1" } });
  ok("crew: still gets the campaign", res.status === 200);
  ok("crew: budget is gone", res.body?.budget === undefined);
  ok("crew: the manager's notes are gone", res.body?.notes === undefined);
  ok("crew: the FIGURE is nowhere in the body", !res.json.includes(String(BUDGET)));
  ok("crew: marked restricted, so a UI can say why", res.body?.restricted === true);
  ok("crew: the stops survive — that is the work", res.body?.stops?.length === 2);
}
{
  const res = await as(dispatcher, campaignDetail.GET, { params: { id: "camp_1" } });
  ok("dispatcher: gets the budget", res.body?.budget === BUDGET);
  ok("dispatcher: and is not marked restricted", res.body?.restricted === undefined);
}
{
  // Tenant scoping was already right; asserted so the redaction branch cannot
  // become a way in for another company's campaign.
  globalThis.__FQ_ROWS.marketingCampaign.push({
    ...globalThis.__FQ_ROWS.marketingCampaign[0],
    id: "camp_other",
    companyId: "co_2",
  });
  const res = await as(crew, campaignDetail.GET, { params: { id: "camp_other" } });
  ok("another tenant's campaign is 404, not a redacted 200", res.status === 404);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. GET /api/funnels and /api/funnels/[id], EXECUTED\n");

globalThis.__FQ_ROWS.funnel = [
  {
    id: "f_1",
    companyId: CO,
    name: "Kitchen cabinet refinishing",
    slug: "kitchen-cabinet-refinishing",
    status: "published",
    channel: "meta",
    steps: [],
    theme: null,
    metaPixelId: "PIXEL-1234",
    tiktokPixelId: null,
    ga4Id: null,
    updatedAt: new Date("2026-08-10"),
    _count: { responses: 37 },
  },
];
globalThis.__FQ_ROWS.company = [
  { id: CO, name: "Truefinish", slug: "truefinish", logoUrl: null, brandColor: "#123456" },
];

const funnels = await import("@/app/api/funnels/route.js");
const funnelDetail = await import("@/app/api/funnels/[id]/route.js");

for (const who of [crew, estimator]) {
  const list = await as(who, funnels.GET);
  ok(`${who.id}: funnel list refused with 403`, list.status === 403);
  ok(`${who.id}: no slug leaked`, !list.json.includes("kitchen-cabinet-refinishing"));
  ok(`${who.id}: no lead count leaked`, !list.json.includes("37"));

  const one = await as(who, funnelDetail.GET, { params: { id: "f_1" } });
  ok(`${who.id}: funnel detail refused with 403`, one.status === 403);
  ok(`${who.id}: no advertising pixel leaked`, !one.json.includes("PIXEL-1234"));
}
for (const who of [dispatcher, owner]) {
  const list = await as(who, funnels.GET);
  ok(`${who.id}: funnel list allowed`, list.status === 200 && list.body.length === 1);
  const one = await as(who, funnelDetail.GET, { params: { id: "f_1" } });
  ok(`${who.id}: funnel detail allowed`, one.status === 200 && one.body?.id === "f_1");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. GET/PATCH /api/voice/calls, EXECUTED\n");
//
// The most exposed of the three. A recording URL is not a reference into
// FieldQuo — app/api/voice/webhook/route.js stores Retell's `recording_url`
// verbatim and app/app/receptionist/page.js renders it as a plain <a href>, so
// it is a bearer link: whoever holds it can play the call with no session at
// all. Copying one out of a JSON response is the whole attack.

const CALLER_PHONE = "+15145550142";
const RECORDING = "https://retell-recordings.example.com/rec_abc?sig=deadbeef";

globalThis.__FQ_ROWS.voiceCall = [
  {
    id: "vc_1",
    companyId: CO,
    direction: "inbound",
    fromE164: CALLER_PHONE,
    toE164: "+15145550199",
    startedAt: new Date("2026-08-20T15:00:00Z"),
    durationSec: 184,
    summary: "Wants a quote for kitchen cabinets, asked us to call back after 5.",
    disposition: "user_hangup",
    recordingUrl: RECORDING,
    needsReview: true,
    reviewedAt: null,
    leadId: "lead_1",
    bookingId: null,
    recoveredAt: null,
    leadRecoveredAt: null,
    transcript: "…",
    quoteDraftAt: null,
    number: { numberType: "local" },
  },
];
globalThis.__FQ_ROWS.booking = [];
// Scripted empty rather than omitted: the db stub is a strict allowlist, and
// GET now joins Quote.sourceCallId to work out which calls already became one.
globalThis.__FQ_ROWS.quote = [];
globalThis.__FQ_ROWS.voicePhoneNumber = [{ id: "n1", companyId: CO, status: "active" }];
globalThis.__FQ_ROWS.voiceAgent = [{ companyId: CO, enabled: true }];

const voiceCalls = await import("@/app/api/voice/calls/route.js");

{
  const res = await as(crew, voiceCalls.GET, { url: "http://x/api/voice/calls" });
  ok("crew: refused with 403", res.status === 403);
  ok("crew: no caller phone number in the body", !res.json.includes("5550142"));
  ok("crew: no recording URL in the body", !res.json.includes("retell-recordings"));
  ok("crew: no call summary in the body", !res.json.includes("kitchen cabinets"));
}
for (const who of [estimator, dispatcher, owner]) {
  const res = await as(who, voiceCalls.GET, { url: "http://x/api/voice/calls" });
  ok(`${who.id}: allowed — this is the person who rings back`, res.status === 200);
  ok(`${who.id}: and gets the call`, res.body?.calls?.length === 1);
}
{
  const res = await as(crew, voiceCalls.PATCH, { body: { id: "vc_1" } });
  ok("crew: PATCH refused with 403", res.status === 403);
  ok("crew: …and nothing was written", globalThis.__FQ_WRITES.length === 0);
}
{
  const res = await as(estimator, voiceCalls.PATCH, { body: { id: "vc_1" } });
  ok("estimator: PATCH allowed", res.status === 200);
  ok("estimator: …and the review really was recorded", globalThis.__FQ_WRITES.length === 1);
  ok(
    "estimator: …scoped to their own company in the WHERE",
    globalThis.__FQ_WRITES[0]?.where?.companyId === CO,
  );
}

/* ── The working list: archived is a different verb from reviewed ───────── */
//
// The receptionist screen was flagged-vs-everything-else, and "everything else"
// was a reverse-chronological log. An ordinary call that should have become a
// quote and never did sank down it, indistinguishable from a call about opening
// hours — nothing was wrong with it, so nothing flagged it, and the only person
// who noticed was the customer who never heard back.
//
// So PATCH carries two verbs on one row and they must not be confused: clearing
// the FLAG, and clearing it off the WORKING LIST.
{
  globalThis.__FQ_WRITES = [];
  const res = await as(estimator, voiceCalls.PATCH, { body: { id: "vc_1", archived: true } });
  const wrote = globalThis.__FQ_WRITES[0]?.data || {};
  ok("archiving is allowed for the person who works the list", res.status === 200);
  ok("archiving sets archivedAt", wrote.archivedAt instanceof Date);
  ok(
    "and does NOT touch reviewedAt — a flag nobody looked at must not be cleared by tidying",
    wrote.reviewedAt === undefined,
  );
  ok("it records who did it", wrote.archivedById === estimator.userId);
}
{
  globalThis.__FQ_WRITES = [];
  await as(estimator, voiceCalls.PATCH, { body: { id: "vc_1", archived: false } });
  const wrote = globalThis.__FQ_WRITES[0]?.data || {};
  ok(
    "un-archiving clears it, because triage is wrong sometimes",
    wrote.archivedAt === null && wrote.archivedById === null,
  );
}
{
  globalThis.__FQ_WRITES = [];
  await as(estimator, voiceCalls.PATCH, { body: { id: "vc_1" } });
  const wrote = globalThis.__FQ_WRITES[0]?.data || {};
  ok(
    "and with no `archived` in the body it is still the old verb: mark reviewed",
    wrote.reviewedAt instanceof Date && wrote.archivedAt === undefined,
  );
}
{
  // Derived, never stored. A copy on the call would outlive a deleted quote and
  // keep a call archived by a quote that no longer exists.
  globalThis.__FQ_ROWS.quote = [
    { id: "q_1", companyId: CO, sourceCallId: "vc_1", quoteNumber: 1042, needsReview: true, createdAt: new Date() },
  ];
  const res = await as(estimator, voiceCalls.GET, { url: "http://x/api/voice/calls" });
  const row = res.body?.calls?.[0];
  ok("a call whose quote exists is archived without anything being written to it", row?.archived === true);
  ok("and it carries the quote so the row can LINK rather than just claim", row?.quote?.number === 1042);
  ok(
    "with archivedAt still null, so the screen knows nobody can un-archive it by hand",
    row?.archivedAt == null,
  );
  globalThis.__FQ_ROWS.quote = [];
  const back = await as(estimator, voiceCalls.GET, { url: "http://x/api/voice/calls" });
  ok(
    "delete the quote and the call comes back onto the working list",
    back.body?.calls?.[0]?.archived === false,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The platform console still sees all three\n");
//
// Non-negotiable #3: FieldQuo views everything and edits nothing. A support
// session has no Member row — `id: null`, role "viewer" — so it holds no
// coarse permission and hasLevel denies it outright. All three of these routes
// ANSWERED the console yesterday, and a gate that blinds support to the screen
// they are on the phone about is a regression dressed as a fix.
//
// Executed, not read: the same handlers, called as the same synthesised member
// lib/currentMember.js builds.

const support = {
  id: null,
  userId: null,
  companyId: CO,
  role: "viewer",
  impersonation: true,
  impersonationMode: "read_only",
  permissions: null,
};

{
  const list = await as(support, campaigns.GET);
  ok("support sees the campaign list", list.status === 200);
  ok("…with the budget it is being asked about", list.body?.[0]?.budget === BUDGET);

  const detail = await as(support, campaignDetail.GET, { params: { id: "camp_1" } });
  ok("support sees the whole campaign, unredacted", detail.body?.budget === BUDGET);
  ok("…and is not marked restricted", detail.body?.restricted === undefined);

  const funnelList = await as(support, funnels.GET);
  ok("support sees the funnel list", funnelList.status === 200);
  const funnelOne = await as(support, funnelDetail.GET, { params: { id: "f_1" } });
  ok("support sees a funnel", funnelOne.status === 200);

  const calls = await as(support, voiceCalls.GET, { url: "http://x/api/voice/calls" });
  ok("support sees the call list", calls.status === 200);
}

// The carve-out is a READ carve-out. It must appear in the GET handlers and
// nowhere near a write — a write that acquired it would hand FieldQuo staff
// edit rights on a customer's data, which #3 forbids in the same sentence.
for (const [file, reads] of [
  ["app/api/marketing/campaigns/route.js", 1],
  ["app/api/marketing/campaigns/[id]/route.js", 1],
  ["app/api/voice/calls/route.js", 1],
]) {
  const src = source(file);
  ok(
    `${file}: the impersonation branch appears exactly ${reads}x, on the read`,
    src.split("member.impersonation").length - 1 === reads,
  );
}
for (const file of ["app/api/funnels/route.js", "app/api/funnels/[id]/route.js"]) {
  const src = source(file);
  ok(
    `${file}: the carve-out is an argument the read opts into`,
    /if \(read && member\.impersonation\) return \{ member \};/.test(src),
  );
  ok(
    `${file}: and no write passes { read: true }`,
    src.split("requireAdmin(request, { read: true })").length - 1 === 1,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The '+ New task' button, and the 403 behind it\n");
//
// Two halves. The first is executable and is the premise: POST /api/tasks
// really does refuse a crew member, so the button really was offering work the
// server would throw away.

globalThis.__FQ_ROWS.task = [];
const tasks = await import("@/app/api/tasks/route.js");
{
  const res = await as(crew, tasks.POST, { body: { title: "Order 4L of eggshell" } });
  ok("POST /api/tasks refuses a crew member", res.status === 403);
  ok("…and nothing was created", (globalThis.__FQ_ROWS.task || []).length === 0);
}
for (const who of [dispatcher, owner]) {
  const res = await as(who, tasks.POST, { body: { title: "Order 4L of eggshell" } });
  ok(`POST /api/tasks allows ${who.id}`, res.status !== 403);
}

// The second half is the page. It cannot be rendered here — see the header —
// so the GUARD EXPRESSION is lifted out of the shipped source and evaluated
// against the real `can`. That is what makes this resistant to the mutation a
// regex misses: `const canCreateTask = true` still MATCHES a pattern looking
// for the constant's name, and fails the moment it is run for an employee.
const tasksSrc = source("app/app/tasks/page.js");
const guardMatch = tasksSrc.match(/const canCreateTask\s*=\s*([^;]+);/);
ok("the page declares a canCreateTask guard", Boolean(guardMatch));

if (guardMatch) {
  const expr = guardMatch[1];
  ok(
    "…asking the same capability the endpoint asks",
    expr.includes('"task:create"') && expr.includes("can("),
  );
  // eslint-disable-next-line no-new-func
  const evaluate = new Function("caller", "can", `return (${expr});`);
  ok("…refuses an employee", evaluate({ role: "employee" }, can) === false);
  ok("…allows a supervisor", evaluate({ role: "supervisor" }, can) === true);
  ok("…allows an owner", evaluate({ role: "owner" }, can) === true);
  // PermissionProvider's rule, restated here because a screen that hides
  // itself while a lookup is slow looks like the account broke.
  ok("…falls OPEN when the provider has not resolved", evaluate(null, can) === true);
  ok("…and when the resolved caller has no role", evaluate({}, can) === true);
}

// Placement, matched positionally rather than by presence. Deleting the guard,
// or replacing `canCreateTask ?` with `true ?`, moves or removes these anchors.
const guardOpen = tasksSrc.indexOf("{canCreateTask && (");
const buttonAt = tasksSrc.indexOf('data-tour="tasks-new"');
ok("the button is rendered inside the guard", guardOpen !== -1 && buttonAt > guardOpen);
ok(
  "the button appears exactly once, so there is no ungated copy",
  tasksSrc.split('data-tour="tasks-new"').length === 2,
);
// Found by mutation: a SECOND create button carrying no data-tour slipped past
// the assertion above, because that one anchors on the tour marker rather than
// on the thing the button does. The call that opens the compose form is the
// real thing to count — there is exactly one way to start a task on this page,
// and it is inside the guard.
// `setDraft({ ...draft, … }` is a field edit INSIDE the form and must not be
// counted; only a fresh object opens it.
const OPEN_FORM = /setDraft\(\{(?!\s*\.\.\.)/g;
const openerHits = [...tasksSrc.matchAll(OPEN_FORM)];
ok("there is exactly one way to open the compose form", openerHits.length === 1);
ok(
  "…and it is inside the guard",
  openerHits.length === 1 && guardOpen !== -1 && openerHits[0].index > guardOpen,
);
ok(
  "the compose form answers the same question",
  /\{canCreateTask && draft && \(/.test(tasksSrc),
);
ok(
  "the LIST is not gated — a crew member's own to-dos stay visible",
  !/canCreateTask[^\n]*ListState/.test(tasksSrc) && tasksSrc.includes("<ListState"),
);
// No replacement notice, deliberately — nav.js's rule, and it keeps this
// change from introducing an i18n key that app/i18n/appMessages.js (owned by
// another change in flight) cannot yet define. A t() call with a fallback for a
// key nobody has added FAILS check:translations, so the honest options were an
// untranslated sentence or no sentence, and nav.js already picked one.
ok(
  "no new untranslated string was introduced on this page",
  !tasksSrc.includes("app.tasks.createRestricted"),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. The dashboard's confident $0\n");
//
// Same two halves. GET /api/analytics/overview is executable, and it is the
// premise: it really does 403 a member without showPricing, so the tile really
// was reporting a refusal as a number.

globalThis.__FQ_ROWS.quote = [];
globalThis.__FQ_ROWS.invoice = [];
const analytics = await import("@/app/api/analytics/overview/route.js");
{
  const res = await as(crew, analytics.GET);
  ok("GET /api/analytics/overview refuses a crew member", res.status === 403);
  ok("…with no revenue figure in the refusal", !/\d{3,}/.test(res.json));
}

const dashCode = source("app/app/page.js");

// The boundary the rest of the app already goes through. `fetchList` is what
// makes a refusal arrive as `{ ok: false, status }` instead of as `null`, and
// there is no way to write a fabricated zero on its failure path — it returns
// no `data` field at all.
ok(
  "the money figures load through lib/loadState, not a bare r.ok ternary",
  dashCode.includes('fetchList("/api/analytics/overview")') &&
    dashCode.includes('fetchArray("/api/quotes")'),
);
ok(
  "…and neither endpoint is still flattened with `r.ok ? r.json() : null`",
  !/fetch\("\/api\/(analytics\/overview|quotes)"\)\.then\(\(r\) => \(r\.ok/.test(dashCode),
);

// The padding pattern itself, gone. This is the exact string that produced
// "$0 revenue this month" out of a 403.
ok(
  "no tile reads `overview?.revenue || 0` any more",
  !dashCode.includes("overview?.revenue"),
);
ok("…nor `overview?.quotesSent || 0`", !dashCode.includes("overview?.quotesSent"));
// ── This used to grep for `{overview && (` and an indexOf ordering ─────────
//
// Two problems, and the dashboard rebuild surfaced both. It asserted an
// IMPLEMENTATION (one particular guard expression typed inline) rather than
// the guarantee, and it compared two indexOf results — which passes trivially
// when the first marker is absent, since -1 is less than everything.
//
// The guarantee itself is unchanged and is now stronger: the tiles render from
// lib/dashboard/rank.js's view model, every metric carries `known`, and
// scripts/check-dashboard-rank.mjs section 6 EXECUTES that function with
// `overview: null` — the state a 403 leaves behind — and asserts that not one
// money figure comes back as a number. That is the thing this line was
// reaching for by grepping.
//
// What is still worth asserting HERE is the wiring: the page hands the raw
// payloads to the view model, and never reaches around it to read a money
// figure straight off a body that may not exist.
ok(
  "the money tiles render only from a body the server actually sent",
  /buildDashboardRank\(\{\s*overview,\s*money,\s*upcomingCount\s*\}\)/.test(dashCode) &&
    !/\boverview\.(revenue|quotesSent|conversionRate)\b/.test(dashCode),
);

// The 403-vs-outage decision, lifted out and RUN. A refusal must leave no
// error key (nothing to retry, nothing to apologise for); anything else must
// keep its sentence. `loadErrorKey` is imported from the real module so the
// assertion cannot agree with a private copy of the mapping.
const { loadErrorKey, LOAD_ERROR_KEYS } = await import("@/lib/loadState");
const branch = dashCode.match(
  /setOverviewErrorKey\(\s*(result\.status === 403 \? "" : result\.errorKey)\s*\)/,
);
ok("the refusal branch can be read out of the source", Boolean(branch));
if (branch) {
  // eslint-disable-next-line no-new-func
  const decide = new Function("result", `return (${branch[1]});`);
  ok(
    "a 403 produces no error banner — the tiles are simply absent",
    decide({ status: 403, errorKey: loadErrorKey(403) }) === "",
  );
  ok(
    "a 500 keeps its sentence",
    decide({ status: 500, errorKey: loadErrorKey(500) }) === LOAD_ERROR_KEYS.server,
  );
  ok(
    "a network failure keeps its sentence",
    decide({ status: null, errorKey: LOAD_ERROR_KEYS.network }) === LOAD_ERROR_KEYS.network,
  );
}
ok(
  "a failed (not refused) load gets the app's one error rendering",
  /\{overviewErrorKey && \(\s*\n\s*<ListState/.test(dashCode),
);

// The recent-quotes panel, same class. GET /api/quotes refuses a member at
// quotes:none, and the panel invited them to write their first quote over it.
ok(
  "recentQuotes starts as null, so its emptiness is never assumed",
  /const \[recentQuotes, setRecentQuotes\] = useState\(null\);/.test(dashCode),
);
ok(
  "…and its empty state only fires on a real array",
  /isEmpty=\{Array\.isArray\(recentQuotes\) && recentQuotes\.length === 0\}/.test(dashCode),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The other two compose forms that ended in a 403\n");
//
// /app/funnels offered "New funnel", an AI generator and a per-row bin;
// /app/marketing offered "New campaign". Every one of those endpoints requires
// user:manage, which is the same expression in both files — so both are lifted
// out and evaluated, for the reason given in section 6.

const PAGE_GUARDS = [
  {
    file: "app/app/funnels/page.js",
    name: "canManageFunnels",
    // Ordered pairs of [anchor that must open the guard, control it guards].
    guards: [
      ["{canManageFunnels && (", 'data-tour="funnels-new"'],
      ["{canManageFunnels && showNew && (", "Describe it and let AI build it"],
      ["{canManageFunnels && (", 'title="Delete"'],
    ],
    // The same lesson as section 6's mutation: count the call that OPENS the
    // panel, not the decoration on the button that makes it.
    opener: "setShowNew(",
  },
  {
    file: "app/app/marketing/page.js",
    name: "canManageMarketing",
    guards: [
      ["{canManageMarketing && (", 'data-tour="marketing-new"'],
      ["{canManageMarketing && showModal && (", "app.marketing.namePlaceholder"],
    ],
    opener: "setShowModal(true)",
  },
];

for (const page of PAGE_GUARDS) {
  const src = source(page.file);
  const match = src.match(new RegExp(`const ${page.name}\\s*=\\s*([^;]+);`));
  ok(`${page.file}: declares ${page.name}`, Boolean(match));
  if (match) {
    const expr = match[1];
    ok(
      `${page.file}: asks the capability the endpoint asks`,
      expr.includes('"user:manage"') && expr.includes("can("),
    );
    // eslint-disable-next-line no-new-func
    const evaluate = new Function("caller", "can", `return (${expr});`);
    ok(`${page.file}: refuses an employee`, evaluate({ role: "employee" }, can) === false);
    ok(`${page.file}: allows a supervisor`, evaluate({ role: "supervisor" }, can) === true);
    ok(`${page.file}: allows an owner`, evaluate({ role: "owner" }, can) === true);
    ok(`${page.file}: falls open with no provider`, evaluate(null, can) === true);
  }
  for (const [anchor, control] of page.guards) {
    const at = src.indexOf(anchor);
    const controlAt = src.indexOf(control, at === -1 ? 0 : at);
    ok(
      `${page.file}: "${control.slice(0, 28)}" sits inside ${anchor.trim()}`,
      at !== -1 && controlAt > at,
    );
  }
  // One way in, and it is behind the guard.
  const openers = src.split(page.opener).length - 1;
  ok(`${page.file}: exactly one control opens the compose panel`, openers === 1);
  ok(
    `${page.file}: …and it sits behind ${page.name}`,
    openers === 1 && src.indexOf(page.opener) > src.indexOf(`{${page.name} && (`),
  );

  // The list itself is NOT gated on either page — the server refuses the read
  // on its own terms, and a page that hid its own list would be guessing.
  ok(
    `${page.file}: the list still renders through ListState`,
    src.includes("<ListState") && !new RegExp(`${page.name}[^\\n]*<ListState`).test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. The nav rows that lead to these three screens\n");
//
// lib/permissions/nav.js belongs to another change in flight, so this section
// asserts CONSISTENCY rather than presence: whatever rule is there must agree
// with the endpoint, and what is missing is reported instead of failed. A row
// with no rule still shows, which is the file's documented fall-open posture —
// cosmetics, not the boundary.

const EXPECTED_NAV = [
  {
    key: "app.nav.marketing",
    why: "GET /api/marketing/campaigns now requires user:manage",
    allows: (member) => can(member.role, "user:manage"),
  },
  {
    key: "app.nav.funnels",
    why: "GET /api/funnels now requires user:manage",
    allows: (member) => can(member.role, "user:manage"),
  },
  {
    key: "app.nav.receptionist",
    why: "GET /api/voice/calls now requires clientsProperties: full_view",
    allows: (member) => member.permissions?.clientsProperties !== "name_address_only",
  },
];

for (const row of EXPECTED_NAV) {
  if (!NAV_REQUIREMENTS[row.key]) {
    notes.push(`${row.key} has no NAV_REQUIREMENTS entry — ${row.why}`);
    console.log(`  note ${row.key}: no rule yet (${row.why})`);
    continue;
  }
  for (const who of ALL_CALLERS) {
    ok(
      `${row.key}: the rule agrees with the endpoint for ${who.id}`,
      navRowAllowed(row.key, who) === row.allows(who),
    );
  }
}

// Whatever happens above, the row must never vanish for an owner or for a
// caller the provider could not resolve.
for (const row of EXPECTED_NAV) {
  ok(`${row.key}: still shown to an owner`, navRowAllowed(row.key, owner) === true);
  ok(`${row.key}: still shown when the provider is missing`, navRowAllowed(row.key, null) === true);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n11. The two the fan-out named and could not reach\n");
//
// Both were reported as still-open rather than quietly skipped, and both are
// now closed. They are asserted here by EXECUTION for the same reason as the
// rest: "the file mentions requirePermission" is a claim about the source, and
// a guard can be present and dead.
//
// The funnel analytics route was defended by nothing but an id. It is
// unreachable through the UI now that the list refuses — but "you would have to
// know the id" is an obstacle, not a permission, and a funnel's cuid appears in
// its own public URL, so the obstacle is a published one.
//
// The subscriber list is the plainer case: every subscriber's email, name,
// phone and address, to anybody with a login. Its POST has required user:manage
// since it was written, so the read was the last door open on that table.

globalThis.__FQ_ROWS.funnelEvent = [];
globalThis.__FQ_ROWS.funnelResponse = [];
globalThis.__FQ_ROWS.marketingSubscriber = [
  {
    id: "sub_1",
    companyId: CO,
    email: "hstroud@example.com",
    name: "Hannah Stroud",
    createdAt: new Date("2026-02-02"),
  },
];

const funnelAnalytics = await import("@/app/api/funnels/[id]/analytics/route.js");
const subscribers = await import("@/app/api/marketing/subscribers/route.js");

for (const who of [crew, estimator]) {
  const a = await as(who, funnelAnalytics.GET, { params: { id: "f_1" } });
  ok(`${who.id}: funnel analytics refused with 403`, a.status === 403);
  // A 404 would be the wrong refusal here and worth catching: it would mean the
  // gate is the row lookup rather than the permission, which stops being true
  // the moment somebody guesses right.
  ok(`${who.id}: …403, not a 404 that only looks like a gate`, a.status !== 404);

  const sub = await as(who, subscribers.GET);
  ok(`${who.id}: subscriber list refused with 403`, sub.status === 403);
  // The point of the gate, asserted on the payload rather than the status:
  // a mailing list is the exportable-customer-list exposure redactClient
  // exists to prevent, handed over whole.
  ok(`${who.id}: no subscriber email leaked`, !sub.json.includes("hstroud@example.com"));
  ok(`${who.id}: …and no subscriber name either`, !sub.json.includes("Hannah Stroud"));
}

// The people whose job it is still get both.
for (const who of [dispatcher, owner]) {
  ok(
    `${who.id}: funnel analytics still answers`,
    (await as(who, funnelAnalytics.GET, { params: { id: "f_1" } })).status === 200,
  );
  const sub = await as(who, subscribers.GET);
  ok(`${who.id}: subscriber list still answers`, sub.status === 200);
  ok(`${who.id}: …with the subscriber in it`, sub.json.includes("hstroud@example.com"));
}

// Read-only, like every other carve-out in this change: the console may look
// and may not write. Asserted on the source because an impersonation session
// cannot reach the write at all — getCurrentMember stops it one layer up — so
// there is no executable difference to observe, only a rule to keep.
for (const file of [
  "app/api/funnels/[id]/analytics/route.js",
  "app/api/marketing/subscribers/route.js",
]) {
  const src = source(file);
  ok(`${file}: the read carves impersonation out`, /if \(!member\.impersonation\)/.test(src));
  ok(
    `${file}: …exactly once, so no write acquired it`,
    (src.match(/if \(!member\.impersonation\)/g) || []).length === 1,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
for (const n of notes) console.log(`  · ${n}`);
if (notes.length) console.log("");
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}
