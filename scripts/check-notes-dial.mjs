// scripts/check-notes-dial.mjs
//
//   npm run check:notes-dial
//
// The Notes dial, executed.
//
// lib/permissions.js carried "notes" in the editor and in every preset since
// the grid existed, and its own header said the dial gated no note anywhere.
// The help-centre writers found it while documenting Custom access: an owner
// could set a hire to "View notes on jobs and visits only" and that hire read
// and wrote the call-back log on every lead and the private notes on every
// client. This runs the shipped handlers at each rung and asserts the rung
// does what its label says — see the Notes section of
// lib/permissions/enforce.js for what a "note" is here and why a quote's
// notes paragraph is not one.
//
// The stub trio is the same one scripts/check-rbac-redaction.mjs uses and for
// the same reasons: "@/lib/db" opens a pool at import, "@/lib/currentMember"
// drags in Better Auth, and bare node cannot resolve "next/server".
import { readFileSync } from "node:fs";
import {
  canSeeAllNotes,
  canEditNotes,
  canDeleteNotes,
  redactNotesField,
  redactClient,
  redactLead,
} from "../lib/permissions/enforce.js";
import { PERMISSION_PRESETS, PERMISSION_CATEGORIES } from "../lib/permissions.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};
const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ── The ladder itself ─────────────────────────────────────────────────────
console.log("\nThe ladder\n");
const rungs = PERMISSION_CATEGORIES.notes.levels.map((l) => l.value);
check("four rungs, floor first",
  rungs.join(",") === "jobs_visits_only,view_all,view_edit_all,view_edit_delete_all");

const at = (notes, extra = {}) => ({
  role: "employee",
  permissions: { ...PERMISSION_PRESETS.dispatcher.values, notes, ...extra },
});
const floor = at("jobs_visits_only");
const viewer = at("view_all");
const editor = at("view_edit_all");
const deleter = at("view_edit_delete_all");
const owner = { role: "owner", permissions: null };
const legacy = { role: "employee", permissions: null };

console.log("\nPure predicates\n");
check("floor: cannot read lead/client notes", !canSeeAllNotes(floor));
check("floor: cannot write them", !canEditNotes(floor));
check("view_all: reads", canSeeAllNotes(viewer));
check("view_all: does not write", !canEditNotes(viewer));
check("view_edit_all: writes", canEditNotes(editor));
check("view_edit_all: does not delete", !canDeleteNotes(editor));
check("view_edit_delete_all: deletes", canDeleteNotes(deleter));
check("owner: everything, no grid consulted", canDeleteNotes(owner));
check("a member with no grid falls OPEN, as hasLevel does", canDeleteNotes(legacy));
check("a null member falls CLOSED", !canSeeAllNotes(null));

console.log("\nPresets\n");
check("Crew sits on the floor", PERMISSION_PRESETS.worker.values.notes === "jobs_visits_only");
check("Estimator reads and does not write", PERMISSION_PRESETS.estimator.values.notes === "view_all");
check("Dispatcher writes and does not delete", PERMISSION_PRESETS.dispatcher.values.notes === "view_edit_all");
check("Manager deletes", PERMISSION_PRESETS.manager.values.notes === "view_edit_delete_all");

console.log("\nredactNotesField\n");
const CLIENT = {
  id: "c1", companyId: "co", name: "Marie Tremblay", email: "m@x.ca", phone: "819-555-0100",
  address: "755 Rue Saint-Louis", notes: "Gate code 4417. Dog is friendly.", language: "fr",
  contactName: null, portalToken: "tok", createdAt: "2026-08-01",
};
const stripped = redactNotesField(floor, CLIENT);
check("floor: notes removed", stripped.notes === undefined);
check("…and the row says so (absence and restriction are different statements)",
  stripped.notesRestricted === true);
check("…without mutating the input", CLIENT.notes === "Gate code 4417. Dog is friendly.");
check("view_all: row untouched", redactNotesField(viewer, CLIENT) === CLIENT);
check("a row with no notes field is not marked restricted",
  redactNotesField(floor, { id: "x" }).notesRestricted === undefined);

console.log("\nredactClient carries it — at BOTH client levels\n");
const fullViewFloor = at("jobs_visits_only", { clientsProperties: "full_edit" });
const rc = redactClient(fullViewFloor, CLIENT);
check("full_edit + notes floor: phone survives", rc.phone === CLIENT.phone);
check("…and notes do not", rc.notes === undefined && rc.notesRestricted === true);
check("…and the row is not marked `restricted` (that flag is the client dial's)", rc.restricted === undefined);
const nameOnlyFloor = at("jobs_visits_only", { clientsProperties: "name_address_only" });
const rc2 = redactClient(nameOnlyFloor, CLIENT);
// The client dial removed the notes here before the notes dial looked, so
// `restricted` is the flag that says why and `notesRestricted` is not also
// set — one restriction, said once.
check("name_address_only + notes floor: no notes, and the CLIENT dial is the one that says so",
  rc2.notes === undefined && rc2.restricted === true && rc2.notesRestricted === undefined);
const rc3 = redactClient(at("view_all", { clientsProperties: "full_view" }), CLIENT);
check("full_view + view_all: the notes are there", rc3.notes === CLIENT.notes);

console.log("\nredactLead carries it\n");
const LEAD = {
  id: "l1", companyId: "co", name: "Emilio", email: "e@x.ca", phone: "819-555-0101",
  message: "32 doors", status: "new", budgetBand: "15k_plus", scoreReasons: [],
  notes: [{ id: "n1", body: "left a voicemail", author: { id: "u1", name: "Sam" } }],
};
const rl = redactLead(at("jobs_visits_only", { clientsProperties: "full_view" }), LEAD);
check("full_view + notes floor: the call-back log is gone", rl.notes === undefined && rl.notesRestricted === true);
check("…and the phone is still there", rl.phone === LEAD.phone);
const rl2 = redactLead(nameOnlyFloor, LEAD);
check("name_address_only + notes floor: log gone, contact gone", rl2.notes === undefined && rl2.phone === undefined);
const rl3 = redactLead(at("view_all", { clientsProperties: "full_view" }), LEAD);
check("view_all: the log arrives", Array.isArray(rl3.notes) && rl3.notes.length === 1);

// ═══════════════════════════════════════════════════════════════════════════
// THE ROUTES, EXECUTED
// ═══════════════════════════════════════════════════════════════════════════
const { register } = await import("node:module");
globalThis.__FQ_ENFORCEABLE = null;
globalThis.__FQ_MEMBER = async () => null;
globalThis.__FQ_DB = null;

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

// What the handlers wrote, so an assertion can read the decision rather than
// trust the status code.
const writes = { clientUpdate: null, clientCreate: null, noteCreate: null, noteDelete: null, leadTouch: 0 };
let existingClient = { ...CLIENT };
function makeDb() {
  const explicit = {
    member: { async findUnique() { return globalThis.__FQ_ENFORCEABLE; } },
    client: {
      async findFirst() { return { ...existingClient, quotes: [], invoices: [], jobs: [] }; },
      async findMany() { return [{ ...existingClient }]; },
      async update({ data }) { writes.clientUpdate = data; return { ...existingClient, ...data }; },
      async create({ data }) { writes.clientCreate = data; return { id: "c-new", ...data }; },
    },
    leadRequest: {
      async findFirst() { return { ...LEAD }; },
      async update() { writes.leadTouch += 1; return {}; },
    },
    leadNote: {
      async findMany() { return LEAD.notes; },
      async findFirst({ where }) { return where.id === "n1" ? { id: "n1" } : null; },
      async create({ data }) { writes.noteCreate = data; return { id: "n2", ...data, author: { id: "u1", name: "Sam" } }; },
      async delete({ where }) { writes.noteDelete = where; return { id: where.id }; },
    },
    callConsent: { async findFirst() { return null; }, async findMany() { return []; } },
    activityLog: { async create() { return {}; } },
    company: { async findUnique() { return { id: "co", timezone: "America/Toronto", currency: "CAD" }; } },
  };
  const byName = (prop) => {
    if (/^(findMany|groupBy)$/.test(prop)) return async () => [];
    if (/^count$/.test(prop)) return async () => 0;
    if (/^aggregate$/.test(prop)) return async () => ({ _sum: {}, _count: {} });
    return async () => null;
  };
  return new Proxy(explicit, {
    get(target, model) {
      if (model in target)
        return new Proxy(target[model], { get: (t, prop) => (prop in t ? t[prop] : byName(prop)) });
      return new Proxy({}, { get: (_t, prop) => byName(prop) });
    },
  });
}
globalThis.__FQ_DB = makeDb();

function become(p) {
  const row = { id: "m-x", userId: "u1", companyId: "co", role: p.role, permissions: p.permissions };
  globalThis.__FQ_ENFORCEABLE = row;
  globalThis.__FQ_MEMBER = async () => ({ ...row, impersonation: false });
}
const req = (url, body) => ({ url, json: async () => body ?? {}, headers: new Map() });
const params = (o) => Promise.resolve(o);
const reset = () => { for (const k of Object.keys(writes)) writes[k] = typeof writes[k] === "number" ? 0 : null; };

const leadDetail = await import("@/app/api/leads/[id]/route");
const leadNotes = await import("@/app/api/leads/[id]/notes/route");
const leadNote = await import("@/app/api/leads/[id]/notes/[noteId]/route");
const clients = await import("@/app/api/clients/route");
const clientDetail = await import("@/app/api/clients/[id]/route");

console.log("\nGET /api/leads/[id] — the call-back log rides along as `notes`\n");
become(at("jobs_visits_only", { clientsProperties: "full_view" }));
let res = await leadDetail.GET(req("http://x/api/leads/l1"), { params: params({ id: "l1" }) });
check("floor: 200 — the lead itself is still theirs to read", res.status === 200);
check("floor: the log is absent and the row says why", res.body.notes === undefined && res.body.notesRestricted === true);
become(viewer);
res = await leadDetail.GET(req("http://x/api/leads/l1"), { params: params({ id: "l1" }) });
check("view_all: the log arrives", Array.isArray(res.body.notes) && res.body.notes[0].body === "left a voicemail");

console.log("\nGET /api/leads/[id]/notes\n");
become(floor);
res = await leadNotes.GET(req("http://x/api/leads/l1/notes"), { params: params({ id: "l1" }) });
check("floor: 403", res.status === 403);
check("…and the refusal names the dial", /Notes/.test(res.body.error || ""));
become(viewer);
res = await leadNotes.GET(req("http://x/api/leads/l1/notes"), { params: params({ id: "l1" }) });
check("view_all: 200 with the log", res.status === 200 && res.body.length === 1);
become(at("view_all", { requests: "none" }));
res = await leadNotes.GET(req("http://x/api/leads/l1/notes"), { params: params({ id: "l1" }) });
check("requests:none refuses first — the notes dial does not open a lead the requests dial closed", res.status === 403);

console.log("\nPOST /api/leads/[id]/notes\n");
reset(); become(viewer);
res = await leadNotes.POST(req("http://x/api/leads/l1/notes", { body: "called back" }), { params: params({ id: "l1" }) });
check("view_all: 403 and nothing written", res.status === 403 && writes.noteCreate === null);
reset(); become(editor);
res = await leadNotes.POST(req("http://x/api/leads/l1/notes", { body: "called back" }), { params: params({ id: "l1" }) });
check("view_edit_all: 201 and the note is written", res.status === 201 && writes.noteCreate?.body === "called back");
reset(); become(at("view_edit_all", { requests: "view_only" }));
res = await leadNotes.POST(req("http://x/api/leads/l1/notes", { body: "x" }), { params: params({ id: "l1" }) });
check("requests:view_only still cannot write a lead note (the requests gate is the floor)", res.status === 403 && writes.noteCreate === null);

console.log("\nDELETE /api/leads/[id]/notes/[noteId]\n");
reset(); become(editor);
res = await leadNote.DELETE(req("http://x/api/leads/l1/notes/n1"), { params: params({ id: "l1", noteId: "n1" }) });
check("view_edit_all: 403 and nothing deleted", res.status === 403 && writes.noteDelete === null);
reset(); become(deleter);
res = await leadNote.DELETE(req("http://x/api/leads/l1/notes/n1"), { params: params({ id: "l1", noteId: "n1" }) });
check("view_edit_delete_all: 200 and the note is deleted", res.status === 200 && writes.noteDelete?.id === "n1");
check("…and the lead is touched, as adding a note touches it", writes.leadTouch === 1);
reset(); become(deleter);
res = await leadNote.DELETE(req("http://x/api/leads/l1/notes/n-other"), { params: params({ id: "l1", noteId: "n-other" }) });
check("a note that is not on this lead (or not this tenant's) is 404, not deleted", res.status === 404 && writes.noteDelete === null);
reset(); become(owner);
res = await leadNote.DELETE(req("http://x/api/leads/l1/notes/n1"), { params: params({ id: "l1", noteId: "n1" }) });
check("owner: deletes with no grid consulted", res.status === 200);

console.log("\nGET /api/clients and /api/clients/[id]\n");
become(fullViewFloor);
res = await clients.GET(req("http://x/api/clients"));
const row = Array.isArray(res.body) ? res.body[0] : res.body?.clients?.[0];
check("list at the notes floor: the client's phone is there and the notes are not",
  row && row.phone === CLIENT.phone && row.notes === undefined && row.notesRestricted === true);
res = await clientDetail.GET(req("http://x/api/clients/c1"), { params: params({ id: "c1" }) });
check("detail at the notes floor: same", res.status === 200 && res.body.notes === undefined && res.body.notesRestricted === true);
become(at("view_all", { clientsProperties: "full_view" }));
res = await clientDetail.GET(req("http://x/api/clients/c1"), { params: params({ id: "c1" }) });
check("detail at view_all: the notes are there", res.body.notes === CLIENT.notes);

console.log("\nPATCH /api/clients/[id]\n");
reset(); become(at("view_all", { clientsProperties: "full_edit" }));
res = await clientDetail.PATCH(req("http://x/api/clients/c1", { name: "Marie T.", notes: "new gate code" }), { params: params({ id: "c1" }) });
check("view_all (may edit the client): a body that CHANGES the notes is 403 and nothing is written",
  res.status === 403 && writes.clientUpdate === null);
reset();
res = await clientDetail.PATCH(req("http://x/api/clients/c1", { name: "Marie T.", notes: CLIENT.notes }), { params: params({ id: "c1" }) });
check("…but echoing the notes it was shown is not a change, and the rename lands",
  res.status === 200 && writes.clientUpdate?.name === "Marie T.");
reset();
res = await clientDetail.PATCH(req("http://x/api/clients/c1", { name: "Marie T." }), { params: params({ id: "c1" }) });
check("…and omitting the field (what the form does below the rung) lands too", res.status === 200 && writes.clientUpdate?.name === "Marie T.");
reset(); become(at("jobs_visits_only", { clientsProperties: "full_edit" }));
res = await clientDetail.PATCH(req("http://x/api/clients/c1", { notes: "" }), { params: params({ id: "c1" }) });
check("floor: blanking notes it never saw is 403 — not dropped, not applied", res.status === 403 && writes.clientUpdate === null);
reset(); become(at("view_edit_all", { clientsProperties: "full_edit" }));
res = await clientDetail.PATCH(req("http://x/api/clients/c1", { notes: "new gate code" }), { params: params({ id: "c1" }) });
check("view_edit_all: the notes are written", res.status === 200 && writes.clientUpdate?.notes === "new gate code");

console.log("\nPOST /api/clients\n");
reset(); become(at("view_all", { clientsProperties: "full_edit" }));
res = await clients.POST(req("http://x/api/clients", { name: "New Client", notes: "private" }));
check("view_all: a client WITH notes is 403 and not created", res.status === 403 && writes.clientCreate === null);
reset();
res = await clients.POST(req("http://x/api/clients", { name: "New Client", notes: "" }));
check("view_all: a client with empty notes is created (nothing to gate)", res.status === 201 || res.status === 200);
check("…with notes null", writes.clientCreate?.notes === null);
reset(); become(at("view_edit_all", { clientsProperties: "full_edit" }));
res = await clients.POST(req("http://x/api/clients", { name: "New Client", notes: "private" }));
check("view_edit_all: created with the note", (res.status === 201 || res.status === 200) && writes.clientCreate?.notes === "private");

// ── The screens offer only what the server accepts ────────────────────────
console.log("\nThe screens\n");
const leadsPage = src("app/app/leads/page.js");
check("lead drawer: the composer is behind notes:view_edit_all",
  /useHasLevel\("notes", "view_edit_all"\)/.test(leadsPage) && /canWriteNotes && !lead\.notesRestricted && \(/.test(leadsPage));
check("lead drawer: delete is behind notes:view_edit_delete_all and posts DELETE",
  /useHasLevel\("notes", "view_edit_delete_all"\)/.test(leadsPage) && /\/notes\/\$\{noteId\}`, \{ method: "DELETE" \}/.test(leadsPage));
check("lead drawer: restriction is said, not shown as an empty log", /lead\.notesRestricted \?/.test(leadsPage));
const clientPage = src("app/app/clients/[id]/page.js");
check("client page: the notes textarea is behind notes:view_edit_all",
  /useHasLevel\("notes", "view_edit_all"\)/.test(clientPage) && /\{canEditNotes && \(\s*<textarea/.test(clientPage));
check("client page: the field is not SENT below the rung", /canEditNotes \? form : withoutNotes/.test(clientPage));
check("client page: restriction is said", /client\.notesRestricted/.test(clientPage));
const newClient = src("app/app/clients/new/page.js");
check("new client: the notes field is behind notes:view_edit_all",
  /useHasLevel\("notes", "view_edit_all"\)/.test(newClient) && /\{canEditNotes && \(/.test(newClient));

// ── The header tells the truth ────────────────────────────────────────────
const HEADER = src("lib/permissions.js");
check("lib/permissions.js no longer calls notes inert",
  !/notes — saved, shown back, gates no note anywhere/.test(HEADER));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
