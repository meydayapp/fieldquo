// scripts/check-crew-access.mjs
//
//   npm run check:crew-access
//
// The lowest access tier is called Crew, and it genuinely cannot read the
// company's documents.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// The tier was called "Worker (limited access)" and its floor for quotes,
// jobs, invoices and requests was `view_only` — the BOTTOM of those ladders.
// So "limited access" could open every quote in the company, every invoice,
// every lead and every job, and the only thing standing between that person
// and the prices was the showPricing toggle, which several endpoints did not
// consult. There was no level below view_only to put them on.
//
// ══ Why this file executes rather than reads ═══════════════════════════════
//
// The dangerous half of adding a rung is not the rung — it is what happens to
// everybody already standing on the ladder. hasLevel compares INDEXES within
// the levels array, so inserting `none` at the front shifts every stored value
// up by one. A regex over lib/permissions.js cannot tell you whether a member
// stored as "view_only" still resolves to view_only; running hasLevel can, and
// that assertion is the reason this file exists.
//
// Verified by mutation when it was written: moving `none` to the END of the
// quotes levels array (i.e. making it the MOST access) fails 9 assertions
// here, and swapping the Crew preset's `none` back to `view_only` fails 11.
// `can` for section 14: the nav rule mirrors a COARSE role check, so the
// assertion has to read the same table the endpoint does rather than restate
// which roles are supervisors.
import { can, PERMISSION_CATEGORIES, PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import {
  hasLevel,
  UNRESTRICTED_ROLES,
  seesOnlyAssignedJobs,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { navRowAllowed, NAV_REQUIREMENTS } from "@/lib/permissions/nav";
import { isBillableSeat } from "@/lib/pricing/ladder";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

let pass = 0;
const failures = [];
const ok = (label, condition) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};

// The four categories that carry a company's documents. `requests` counts: a
// lead is a quote one screen earlier, and it carries the homeowner's name,
// phone, address and stated budget.
const DOCUMENT_CATEGORIES = ["quotes", "jobs", "invoices", "requests"];

const gridOf = (level) =>
  Object.fromEntries(DOCUMENT_CATEGORIES.map((c) => [c, level]));
const member = (role, permissions) => ({ id: "m1", role, permissions });

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. `none` exists, and it is the BOTTOM rung\n");

for (const category of DOCUMENT_CATEGORIES) {
  const levels = PERMISSION_CATEGORIES[category].levels.map((l) => l.value);
  ok(`${category} declares a "none" level`, levels.includes("none"));
  ok(`${category}: none is FIRST — least access first`, levels[0] === "none");
  ok(
    `${category}: view_only sits directly above it`,
    levels[1] === "view_only",
  );
  // The convention payroll already follows, asserted rather than assumed.
  ok(
    `${category}: the label says No access`,
    PERMISSION_CATEGORIES[category].levels[0].label === "No access",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. `none` refuses, and view_only still permits\n");

const atNone = member("employee", gridOf("none"));
const atViewOnly = member("employee", gridOf("view_only"));
const atEdit = member("employee", gridOf("view_create_edit"));

for (const category of DOCUMENT_CATEGORIES) {
  ok(
    `${category}: none is refused view_only`,
    hasLevel(atNone, category, "view_only") === false,
  );
  ok(
    `${category}: none is refused view_create_edit`,
    hasLevel(atNone, category, "view_create_edit") === false,
  );
  ok(
    `${category}: none satisfies none (the rung is real, not a hole)`,
    hasLevel(atNone, category, "none") === true,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Nobody already on the ladder moved\n");
//
// This is the assertion the whole change turns on. Every member in the
// database today is stored at view_only or above; inserting a rung below them
// must not demote a single one.

for (const category of DOCUMENT_CATEGORIES) {
  ok(
    `${category}: a stored "view_only" still resolves to view_only`,
    hasLevel(atViewOnly, category, "view_only") === true,
  );
  ok(
    `${category}: …and still does NOT reach view_create_edit`,
    hasLevel(atViewOnly, category, "view_create_edit") === false,
  );
  ok(
    `${category}: a stored "view_create_edit" keeps everything below it`,
    hasLevel(atEdit, category, "view_only") === true &&
      hasLevel(atEdit, category, "view_create_edit") === true,
  );
  ok(
    `${category}: …and still stops short of delete`,
    hasLevel(atEdit, category, "view_create_edit_delete") === false,
  );
}

// The fall-open cases, unchanged. A member who predates the grid must not be
// locked out on deploy — enforce.js says so at length, and `none` being the
// new first level is exactly the kind of change that could quietly become the
// default for them.
const legacy = member("employee", null);
const partialGrid = member("employee", { schedule: "view_own" });
for (const category of DOCUMENT_CATEGORIES) {
  ok(
    `${category}: a member with NO grid still falls open`,
    hasLevel(legacy, category, "view_create_edit_delete") === true,
  );
  ok(
    `${category}: a grid that never mentions ${category} falls open`,
    hasLevel(partialGrid, category, "view_only") === true,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The Crew preset holds none of the three, and SCOPED jobs\n");
//
// Jobs left this list. It sat at `none` because view_only meant "every job in
// the company", and the owner's answer is neither: "jobs only the ones assigned
// to them". That is a scope, not a rung, so the level went back to view_only
// and section 9 below is what makes it safe. The two have to be asserted
// together or the pair can be half-reverted — which is the shape of the
// original hole.

const crewPreset = PERMISSION_PRESETS.worker;
ok('the preset is called "Crew"', crewPreset.label === "Crew");
ok(
  "…and still maps to the employee tier (no role change)",
  PRESET_TO_ROLE.worker === "employee",
);

const NONE_CATEGORIES = ["quotes", "invoices", "requests"];
const crew = member(PRESET_TO_ROLE.worker, { ...crewPreset.values });
for (const category of NONE_CATEGORIES) {
  ok(
    `Crew: ${category} is stored as "none"`,
    crewPreset.values[category] === "none",
  );
  ok(
    `Crew: refused ${category} at every level above none`,
    hasLevel(crew, category, "view_only") === false &&
      hasLevel(crew, category, "view_create_edit") === false,
  );
}

ok('Crew: jobs is stored as "view_only"', crewPreset.values.jobs === "view_only");
ok("Crew: …so the job routes answer them", hasLevel(crew, "jobs", "view_only") === true);
ok(
  "Crew: …and they still cannot create or edit one",
  hasLevel(crew, "jobs", "view_create_edit") === false,
);
// The pairing, stated as an assertion rather than as a comment: view_only is
// only tolerable here because the scope narrows it.
ok(
  "Crew: jobs at view_only is SCOPED to what they are assigned",
  seesOnlyAssignedJobs(crew) === true,
);
ok(
  "Crew: …and they still see no prices",
  crewPreset.values.showPricing === false && crewPreset.values.jobCosting === false,
);

// What Crew KEEPS. A tier that loses its own schedule and its own hours is not
// the tier the owner asked for, and hiding those would be a different bug.
ok(
  "Crew keeps their own schedule",
  hasLevel(crew, "schedule", "view_complete_own") === true,
);
ok(
  "Crew keeps their own payslips",
  hasLevel(crew, "payroll", "view_own") === true,
);
ok(
  "Crew can correct their own timesheet",
  hasLevel(crew, "timeTracking", "view_record_edit_own") === true,
);
ok(
  "…but not touch anyone else's",
  hasLevel(crew, "timeTracking", "view_record_edit_all") === false,
);
ok(
  "Crew keeps the site address they have to drive to",
  hasLevel(crew, "clientsProperties", "name_address_only") === true,
);
ok(
  "…and no more of the client record than that",
  hasLevel(crew, "clientsProperties", "full_view") === false,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The other presets are untouched\n");

for (const key of ["estimator", "dispatcher", "manager"]) {
  const preset = PERMISSION_PRESETS[key];
  const m = member(PRESET_TO_ROLE[key], { ...preset.values });
  for (const category of DOCUMENT_CATEGORIES) {
    ok(
      `${preset.label}: still reads ${category}`,
      hasLevel(m, category, "view_only") === true,
    );
  }
}

// The two that write. Spelled out per preset rather than derived, so a
// reviewer can see the line did not move for anyone it should not have.
const dispatcher = member(
  PRESET_TO_ROLE.dispatcher,
  { ...PERMISSION_PRESETS.dispatcher.values },
);
const manager = member(PRESET_TO_ROLE.manager, {
  ...PERMISSION_PRESETS.manager.values,
});
for (const category of DOCUMENT_CATEGORIES) {
  ok(
    `Dispatcher still creates and edits ${category}`,
    hasLevel(dispatcher, category, "view_create_edit") === true,
  );
  ok(
    `Dispatcher still stops short of deleting ${category}`,
    hasLevel(dispatcher, category, "view_create_edit_delete") === false,
  );
  ok(
    `Manager still deletes ${category}`,
    hasLevel(manager, category, "view_create_edit_delete") === true,
  );
}

// Owner and admin skip the grid entirely — asserted because a new bottom rung
// is exactly the sort of change that could accidentally start applying to them.
const owner = member("owner", gridOf("none"));
ok("an owner with a none-grid is still unrestricted", UNRESTRICTED_ROLES.has("owner"));
for (const category of DOCUMENT_CATEGORIES) {
  ok(
    `owner bypasses the ${category} grid`,
    hasLevel(owner, category, "view_create_edit_delete") === true,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. Billing did not move — Crew was already free\n");
//
// isBillableSeat reads these same four categories through hasLevel to decide
// who is a paid seat. Adding a rung BELOW the level it asks about must change
// nothing, and this is cheaper to assert than to argue.

ok("Crew is not a billable seat", isBillableSeat(crew) === false);
// A member sitting at view_only on all four is still free — that is the rung
// this file is really about, and adding `none` beneath it must not disturb it.
// Written as an explicit grid rather than as a preset: the preset that used to
// hold this shape is Estimator now and CREATES quotes, so naming it here would
// assert the opposite of what this line means.
ok(
  "…nor is a member at view_only on all four",
  isBillableSeat(
    member("employee", {
      quotes: "view_only",
      jobs: "view_only",
      invoices: "view_only",
      requests: "view_only",
    }),
  ) === false,
);
// And Estimator, which sits just above it, IS billed — because it writes.
ok(
  "…but Estimator is, because it creates quotes",
  isBillableSeat(member("employee", { ...PERMISSION_PRESETS.estimator.values })) === true,
);
ok("a Dispatcher still is", isBillableSeat(dispatcher) === true);
ok("a Manager still is", isBillableSeat(manager) === true);
ok("an owner still is", isBillableSeat(member("owner", null)) === true);
ok(
  "a member with no grid is still billed on their role",
  isBillableSeat(member("supervisor", null)) === true &&
    isBillableSeat(member("employee", null)) === false,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The nav rows follow the same rule\n");

const DOCUMENT_ROWS = {
  "app.nav.quotes": "quotes",
  "app.nav.jobs": "jobs",
  "app.nav.invoices": "invoices",
  "app.nav.requests": "requests",
};

for (const [row, category] of Object.entries(DOCUMENT_ROWS)) {
  ok(`${row} has a rule at all`, Boolean(NAV_REQUIREMENTS[row]));
  ok(
    `${row} is gated on ${category} at view_only`,
    NAV_REQUIREMENTS[row]?.category === category &&
      NAV_REQUIREMENTS[row]?.level === "view_only",
  );
  // Jobs is the one row Crew keeps, and it has to be: a scoped list they
  // cannot navigate to is the same as no list. The row leads to their own
  // jobs — section 10 executes the endpoint behind it.
  ok(
    row === "app.nav.jobs"
      ? `${row} is SHOWN to Crew — it leads to their own jobs`
      : `${row} is hidden from Crew`,
    navRowAllowed(row, crew) === (row === "app.nav.jobs"),
  );
  ok(
    `${row} still shows for a Worker at view_only`,
    navRowAllowed(row, atViewOnly) === true,
  );
  ok(`${row} still shows for a Dispatcher`, navRowAllowed(row, dispatcher) === true);
  ok(`${row} still shows for an owner`, navRowAllowed(row, owner) === true);
  // The failure posture the whole nav module is built around.
  ok(`${row} shows when the provider is missing`, navRowAllowed(row, null) === true);
  ok(`${row} shows for a member with no grid`, navRowAllowed(row, legacy) === true);
}

// The client BOOK, which is not the same thing as one client's address.
ok(
  "the Clients row is hidden from Crew",
  navRowAllowed("app.nav.clients", crew) === false,
);
ok(
  "…and kept for a Worker on full_view",
  navRowAllowed(
    "app.nav.clients",
    member("employee", { ...PERMISSION_PRESETS.estimator.values }),
  ) === true,
);
ok(
  "service plans follow invoices",
  navRowAllowed("app.nav.plans", crew) === false &&
    navRowAllowed("app.nav.plans", dispatcher) === true,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Every document route asks the grid\n");
//
// The one assertion here that reads source rather than running it, and it is
// deliberate: the question is "did anybody add a handler and forget", which is
// a question about the FILES, not about a function. Executing the routes would
// need a database and a session; this catches the omission that actually
// happens.
//
// It looks for any enforcement call — levelOrRefusal, requireLevel or a
// hasLevel branch — inside each exported handler of the four API trees. A
// handler with none of them answers the same to everybody.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_DIRS = ["quotes", "invoices", "jobs", "leads"].map((d) =>
  join(ROOT, "app/api", d),
);

// Handlers that legitimately ask nothing of the grid, each with the reason.
// An allowlist rather than a silent skip: adding to it is visible in review.
const UNGATED_BY_DESIGN = {
  "leads/public/route.js POST":
    "the public intake form — a stranger with no session creates the lead",
  "quotes/received/[token]/route.js GET":
    "a cross-company share link, answerable to a signed-out stranger; the grid decides canImport inside it",
  "leads/import/route.js POST": "gated on requests:view_create_edit inside a try/catch",
};

function routeFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.js") out.push(full);
  }
  return out;
}

const HANDLER = /export async function (GET|POST|PATCH|PUT|DELETE)\s*\(/g;

for (const dir of API_DIRS) {
  for (const file of routeFiles(dir)) {
    const src = readFileSync(file, "utf8");
    const rel = file.slice(join(ROOT, "app/api/").length);
    const marks = [...src.matchAll(HANDLER)];
    for (let i = 0; i < marks.length; i += 1) {
      const start = marks[i].index;
      const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
      const body = src.slice(start, end);
      const label = `${rel} ${marks[i][1]}`;
      if (UNGATED_BY_DESIGN[label]) continue;
      const asks =
        /levelOrRefusal\(/.test(body) ||
        /requireLevel\(/.test(body) ||
        /hasLevel\(/.test(body) ||
        // The two routes whose gate is a helper defined above the handler.
        /requireAdmin\(/.test(body);
      ok(`${label} asks the grid`, asks);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The scope itself — who is narrowed, and to what\n");
//
// assignedJobWhere is the whole of the "only the ones assigned to them" rule.
// It is a pure function returning a Prisma fragment, so it can be executed
// rather than argued about, and section 10 then runs the real handlers with it.

const estimator = member("employee", { ...PERMISSION_PRESETS.estimator.values });

ok(
  "Crew are scoped to their own jobs",
  seesOnlyAssignedJobs({ ...crew, userId: "u_crew" }) === true,
);
// The assertion the whole design turns on. Estimator also sits at
// jobs:view_only, and must keep the whole board — the job their quote became is
// usually not one they have a visit on. If the rule ever collapses to "level
// === view_only", this is the line that fails.
ok(
  "…but an Estimator, also at jobs:view_only, is NOT",
  seesOnlyAssignedJobs(estimator) === false,
);
ok("a Dispatcher is not scoped", seesOnlyAssignedJobs(dispatcher) === false);
ok("a Manager is not scoped", seesOnlyAssignedJobs(manager) === false);
ok("an owner is not scoped", seesOnlyAssignedJobs(owner) === false);
ok(
  "a member with NO grid is not scoped — same fall-open as hasLevel",
  seesOnlyAssignedJobs(legacy) === false,
);
ok(
  "a grid that never mentions jobs is not scoped",
  seesOnlyAssignedJobs(partialGrid) === false,
);
// The only direction it fails closed in.
ok("a member we cannot identify at all IS scoped", seesOnlyAssignedJobs(null) === true);

const crewWhere = assignedJobWhere({ ...crew, userId: "u_crew" });
ok(
  "the fragment filters on a visit assigned to that user",
  crewWhere?.visits?.some?.assignedToId === "u_crew",
);
ok(
  "…and on nothing else — no id key to collide with the caller's own",
  Object.keys(crewWhere).length === 1 && crewWhere.id === undefined,
);
ok(
  "an unscoped member gets an empty fragment, so the spread is a no-op",
  Object.keys(assignedJobWhere(dispatcher)).length === 0,
);
ok(
  "a scoped member with no userId matches NOTHING rather than everything",
  assignedJobWhere({ ...crew })?.visits?.some?.assignedToId === "__none__",
);
ok(
  "…and so does a null member",
  assignedJobWhere(null)?.visits?.some?.assignedToId === "__none__",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. The job routes, EXECUTED against a scripted database\n");
//
// ── Why this half runs the handlers ────────────────────────────────────────
//
// Section 9 proves the fragment says the right thing. It cannot prove any
// route uses it, which is the half that actually leaks — and the failure this
// file exists to catch is precisely "the filter is defined and one endpoint
// forgot it". So the real GET handlers are imported and called, with
// "@/lib/db", "@/lib/currentMember" and "next/server" swapped for stubs, the
// same technique scripts/check-feature-flags.mjs uses on the feature gate.
//
// The stub applies `where` AND `select`/`include`, because both are load-
// bearing: the where decides which jobs come back and the select decides
// whether a price rides along on one that does. A stub that ignored `select`
// would let section 11's money assertions pass on a route that returns the
// quote whole.

const { register } = await import("node:module");

globalThis.__FQ_ROWS = { member: [], job: [], jobMaterial: [], task: [] };

// Relation keys on the fixtures, so the projection can drop what Prisma drops.
const RELATIONS = new Set([
  "client",
  "quote",
  "visits",
  "assignedTo",
  "job",
  "invoices",
  // Section 13's to-do rows carry one.
  "workArea",
]);

/** A small, general Prisma `where` evaluator — including relation filters. */
function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;

    // ── The boolean combinators, added for section 13 ────────────────────────
    //
    // The task scope is `AND: [{ OR: [...] }]` beside a caller-supplied
    // `assignedToId`, and the whole point of that assertion is that the two
    // INTERSECT. Without these two branches `OR` would fall through to the
    // relation-filter case below, be compared against a column no row has, and
    // match nothing — which would make section 13 pass on a route returning
    // everything as readily as on a correct one.
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
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      // A to-one relation filter, e.g. `job: { companyId, visits: { some } }`.
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
  };
}

globalThis.__FQ_DB = new Proxy(
  {
    member: stubModel("member"),
    job: stubModel("job"),
    jobMaterial: stubModel("jobMaterial"),
    // Section 13. Registered here rather than in a second stub, because the
    // whole value of this harness is that every executed route answers the
    // SAME evaluator — a private stub for tasks could be lenient in a way the
    // job stub is not, and then agree with itself.
    task: stubModel("task"),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, not quiet: a check must never pass because a query it did not
      // model answered "nothing".
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
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

const jobsList = await import("@/app/api/jobs/route.js");
const jobDetail = await import("@/app/api/jobs/[id]/route.js");
const jobMaterials = await import("@/app/api/jobs/[id]/materials/route.js");

// ── The fixtures ───────────────────────────────────────────────────────────
//
// Two crews and three jobs: one the crew member has a visit on, one a
// colleague's, and one nobody has been sent to yet. The client and quote rows
// are deliberately fat — a real client record with a phone and private notes, a
// real quote with a total — because the point is what does NOT come back.

const MINE = "job_mine";
const THEIRS = "job_theirs";
const UNVISITED = "job_unvisited";
const QUOTE_TOTAL = 7645;
const ACCEPTED_TOTAL = 6100;

const clientRow = {
  id: "c1",
  name: "Ana Ruiz",
  email: "ana@example.com",
  phone: "+15145550100",
  notes: "Gate code 4417. Dog is friendly.",
  portalToken: "tok_abc",
};

const jobRow = (id, title, visits) => ({
  id,
  companyId: "co",
  clientId: "c1",
  quoteId: "q1",
  title,
  status: "scheduled",
  recurring: false,
  recurrenceRule: null,
  archivedAt: null,
  completedAt: null,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-02"),
  client: clientRow,
  quote: {
    id: "q1",
    quoteNumber: "Q-1001",
    total: QUOTE_TOTAL,
    acceptedTotal: ACCEPTED_TOTAL,
  },
  visits,
});

const visit = (id, jobId, userId, name) => ({
  id,
  jobId,
  scheduledAt: new Date("2026-08-25T13:00:00Z"),
  status: "scheduled",
  assignedToId: userId,
  notes: null,
  checklistItems: null,
  photos: [],
  assignedTo: { id: userId, name },
});

globalThis.__FQ_ROWS.job = [
  jobRow(MINE, "Repaint 14 Elm St", [visit("v1", MINE, "u_crew", "Dani")]),
  jobRow(THEIRS, "Deck stain, 9 Oak Ave", [visit("v2", THEIRS, "u_other", "Sam")]),
  // Nobody has been sent here yet. See the note on assignedJobWhere: `some`
  // cannot match an empty list, and that is the decision, not an accident.
  jobRow(UNVISITED, "Kitchen repaint — unscheduled", []),
];

globalThis.__FQ_ROWS.jobMaterial = [
  {
    id: "mat1",
    jobId: MINE,
    name: "Benjamin Moore Aura, eggshell",
    qty: 4,
    unit: "gal",
    categoryKey: "paint",
    estUnitCost: 92.5,
    actualCost: 88.4,
    supplier: "Dulux",
    purchasedAt: new Date("2026-08-20"),
    addedByHand: false,
    sortOrder: 1,
    createdAt: new Date("2026-08-19"),
  },
];

const memberRow = (id, userId, role, permissions) => ({
  id,
  userId,
  companyId: "co",
  role,
  permissions,
});

globalThis.__FQ_ROWS.member = [
  memberRow("m_crew", "u_crew", "employee", { ...crewPreset.values }),
  memberRow("m_disp", "u_disp", "supervisor", {
    ...PERMISSION_PRESETS.dispatcher.values,
  }),
  // A custom member the owner has taken all the way down. The gate, not the
  // scope, is what must answer this one.
  memberRow("m_none", "u_none", "employee", {
    ...crewPreset.values,
    jobs: "none",
  }),
];

const asMember = (id) => {
  const row = globalThis.__FQ_ROWS.member.find((m) => m.id === id);
  // The shape getCurrentMember returns: no `permissions`, which is exactly why
  // loadEnforceableMember exists and why the grid has to be re-read per route.
  globalThis.__FQ_SESSION = {
    id: row.id,
    userId: row.userId,
    companyId: row.companyId,
    role: row.role,
  };
};

const req = (url = "http://local/api/jobs") => ({ url, json: async () => ({}) });
const ctx = (id) => ({ params: Promise.resolve({ id }) });

// ── The list ───────────────────────────────────────────────────────────────

asMember("m_crew");
const crewList = await jobsList.GET(req());
ok("GET /api/jobs answers Crew at all (200)", crewList.status === 200);
ok(
  "Crew's list contains the job they have a visit on",
  crewList.body.some((j) => j.id === MINE),
);
ok(
  "…and NOT the one assigned to a colleague",
  !crewList.body.some((j) => j.id === THEIRS),
);
ok(
  "…and NOT the one nobody has been sent to yet",
  !crewList.body.some((j) => j.id === UNVISITED),
);
ok("…which is one job, not three", crewList.body.length === 1);

asMember("m_disp");
const dispList = await jobsList.GET(req());
ok(
  "a Dispatcher still gets the whole board",
  dispList.status === 200 && dispList.body.length === 3,
);

asMember("m_none");
const noneList = await jobsList.GET(req());
ok(
  "a member at jobs:none is still refused outright (403)",
  noneList.status === 403,
);

// ── One job ────────────────────────────────────────────────────────────────

asMember("m_crew");
const mine = await jobDetail.GET(req(), ctx(MINE));
ok("Crew can open the job they are on (200)", mine.status === 200);
ok("…and it is the right job", mine.body?.id === MINE);

const theirs = await jobDetail.GET(req(), ctx(THEIRS));
// 404, not 403. A 403 would confirm the id names a real job in this company,
// which is the same leak one step removed — enumerable off any shared screen.
ok("a job they are NOT on answers 404, not 403", theirs.status === 404);
ok(
  "…and says only Not found — no hint that the record exists",
  theirs.body?.error === "Not found",
);

const unvisited = await jobDetail.GET(req(), ctx(UNVISITED));
ok("a job with no visits at all answers 404 too", unvisited.status === 404);

asMember("m_disp");
const dispTheirs = await jobDetail.GET(req(), ctx(THEIRS));
ok("…while a Dispatcher opens the same job fine", dispTheirs.status === 200);

// ── The nested routes ──────────────────────────────────────────────────────

asMember("m_crew");
const myMaterials = await jobMaterials.GET(req(), ctx(MINE));
ok("Crew get the shopping list for their own job", myMaterials.status === 200);
ok(
  "…with the lines on it",
  myMaterials.body?.materials?.length === 1 &&
    myMaterials.body.materials[0].name.startsWith("Benjamin Moore"),
);
const theirMaterials = await jobMaterials.GET(req(), ctx(THEIRS));
ok(
  "…and 404 on the shopping list for a job that is not theirs",
  theirMaterials.status === 404,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n11. No prices on the job they CAN see\n");
//
// There is no redactJobMoney, and this section is the argument that none is
// needed rather than an assumption that none is needed. Job carries no money
// column at all (prisma/schema.prisma), the nested quote is selected down to
// { id, quoteNumber }, and the two cost surfaces — the sourcing list's
// estUnitCost/actualCost and GET /api/jobs/[id]/costing — are already gated on
// the jobCosting toggle, which Crew hold as false.
//
// So the assertion is on the PAYLOAD rather than on a redactor: walk what the
// handler actually returned and fail on any money key, or on any of the
// fixture's amounts appearing under a name nobody thought to look for.

const MONEY_KEYS = new Set([
  "total", "subtotal", "tax", "discount",
  "amountPaid", "amountDue", "balance",
  "acceptedTotal", "acceptedSubtotal", "acceptedTax",
  "estUnitCost", "actualCost", "estimatedTotal", "actualTotal",
  "rate", "unitPrice", "unitCost", "price", "amount", "cost",
  "hourlyRate", "margin",
]);
const SECRET_AMOUNTS = new Set([QUOTE_TOTAL, ACCEPTED_TOTAL, 92.5, 88.4]);

// One exemption, by full path and with its reason — the same posture as
// UNGATED_BY_DESIGN above. `progress.total` is how many LINES are on the
// sourcing list (sourcingProgress names it that); the two money figures beside
// it are estimatedTotal and actualTotal, which are not exempt. The value is
// asserted below, so this cannot quietly start covering an amount.
const NOT_MONEY_PATHS = new Set(["progress.total"]);

function moneyIn(value, path = "") {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => found.push(...moneyIn(v, `${path}[${i}]`)));
    return found;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [key, v] of Object.entries(value)) {
      const here = path ? `${path}.${key}` : key;
      if (NOT_MONEY_PATHS.has(here)) continue;
      if (MONEY_KEYS.has(key) && v != null) found.push(here);
      else if (typeof v === "number" && SECRET_AMOUNTS.has(v))
        found.push(`${here} (=${v})`);
      else found.push(...moneyIn(v, here));
    }
  }
  return found;
}

const moneyOnDetail = moneyIn(mine.body);
ok(
  `the job Crew can open carries no money${moneyOnDetail.length ? `: ${moneyOnDetail.join(", ")}` : ""}`,
  moneyOnDetail.length === 0,
);
const moneyOnList = moneyIn(crewList.body);
ok(
  `…nor does the list${moneyOnList.length ? `: ${moneyOnList.join(", ")}` : ""}`,
  moneyOnList.length === 0,
);
// The quote is REACHED from the job — it is the record the price lives on —
// so this is the one worth naming separately.
ok(
  "the linked quote comes back as a number and a status, never a total",
  mine.body?.quote?.quoteNumber === "Q-1001" && mine.body.quote.total === undefined,
);
// The client's private notes and phone are a different restriction on the same
// payload, and they were leaking here before redactClient was wired in. Crew
// hold clientsProperties: name_address_only, which is also the second half of
// what makes them scoped, so it is asserted where it can be seen.
ok(
  "…and the client comes back name-only, marked as restricted",
  mine.body?.client?.name === "Ana Ruiz" &&
    mine.body.client.phone === undefined &&
    mine.body.client.notes === undefined &&
    mine.body.client.restricted === true,
);

const moneyOnMaterials = moneyIn(myMaterials.body);
ok(
  `the sourcing list carries no costs${moneyOnMaterials.length ? `: ${moneyOnMaterials.join(", ")}` : ""}`,
  moneyOnMaterials.length === 0,
);
ok(
  "…and says so, rather than reading as an unpriced line",
  myMaterials.body?.materials?.[0]?.costHidden === true &&
    myMaterials.body?.progress?.costHidden === true,
);
// The exemption above, held honest: `total` here counts lines. The counts are
// what makes the panel usable without the money — "1 line, 1 bought".
ok(
  "…and the progress counts are still true (total = lines, not dollars)",
  myMaterials.body?.progress?.total === 1 &&
    myMaterials.body.progress.bought === 1 &&
    myMaterials.body.progress.estimatedTotal === undefined &&
    myMaterials.body.progress.actualTotal === undefined,
);
// What survives, because a crew member cannot shop without it.
ok(
  "…while the quantity and unit survive",
  myMaterials.body?.materials?.[0]?.qty === 4 &&
    myMaterials.body.materials[0].unit === "gal",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n12. Every job read applies the scope\n");
//
// Section 10 executes three of them. This is the same question asked of the
// whole tree, the way section 8 asks about the grid: a handler that reads a
// job and never mentions assignedJobWhere is the copy that rots.

const JOBS_API = join(ROOT, "app/api/jobs");
for (const file of routeFiles(JOBS_API)) {
  const src = readFileSync(file, "utf8");
  const rel = file.slice(join(ROOT, "app/api/").length);
  // Reads a job (or a row hanging off one) at all?
  const touchesJob = /db\.job\b|db\.jobMaterial\b|db\.jobPhoto\b/.test(src);
  if (!touchesJob) continue;
  ok(`${rel} spreads assignedJobWhere`, /assignedJobWhere\(/.test(src));
}

// The copilot is the fourth door onto the same rows, and it is the one that
// was closed by REMOVING the tool rather than by filtering it.
const COPILOT = readFileSync(join(ROOT, "lib/ai/copilotTools.js"), "utf8");
ok(
  "the copilot's schedule tool is scoped by the same fragment",
  /assignedJobWhere\(member\)/.test(COPILOT),
);
ok(
  "…and so is its job search",
  (COPILOT.match(/assignedJobWhere\(member\)/g) || []).length >= 2,
);
ok(
  "…and it no longer queries the company's whole calendar",
  !/where: \{ job: \{ companyId \}, scheduledAt/.test(COPILOT),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n13. The to-do list, EXECUTED — the fifth door onto the same rows\n");
//
// GET /api/tasks had no assignee scoping at all. `assignedToId` on the query
// string is a filter the CALLER chooses, not a gate, so a crew member on
// quotes:none whose job list is narrowed to their own visits could still read
// every to-do in the company — and a Task carries the linked client's name and
// the linked job's title, which is the leak sections 10 and 11 close on the
// job routes arriving through a different route file.
//
// The write side already held the predicate (app/api/tasks/[id]/route.js:
// yours, or claimable-if-unassigned). This asserts the read mirrors it, and it
// EXECUTES rather than greps for two reasons: the composition with the query
// parameter is the part that goes wrong, and "the clause is present" says
// nothing about whether it intersects or overwrites.

const tasksList = await import("@/app/api/tasks/route.js");

const T_MINE = "task_mine";
const T_I_MADE = "task_i_made";
const T_THEIRS = "task_theirs";
const T_ORPHAN = "task_orphan";

// The colleague's to-do is deliberately fat: a client the crew member may not
// look up and the job they answer 404 on in section 10. Those two strings are
// what section 11's argument is about, one model over.
const taskRow = (id, fields) => ({
  id,
  companyId: "co",
  title: "Order material",
  description: null,
  status: "open",
  priority: "normal",
  dueDate: null,
  assignedToId: null,
  createdById: "u_disp",
  clientId: null,
  jobId: null,
  workAreaId: null,
  assignedTo: null,
  client: null,
  workArea: null,
  job: null,
  ...fields,
});

globalThis.__FQ_ROWS.task = [
  taskRow(T_MINE, {
    title: "Pick up the keys",
    assignedToId: "u_crew",
    assignedTo: { id: "u_crew", name: "Dani" },
  }),
  // Assigned to somebody else but RAISED by the crew member. The PATCH counts
  // this as theirs, so the list has to as well or they cannot see what they
  // asked for.
  taskRow(T_I_MADE, {
    title: "Confirm the paint colour",
    assignedToId: "u_other",
    createdById: "u_crew",
    assignedTo: { id: "u_other", name: "Sam" },
  }),
  taskRow(T_THEIRS, {
    title: "Chase the deposit",
    assignedToId: "u_other",
    assignedTo: { id: "u_other", name: "Sam" },
    clientId: "c2",
    client: { id: "c2", name: "Bea Nolan" },
    jobId: THEIRS,
    job: { id: THEIRS, title: "Deck stain, 9 Oak Ave", status: "scheduled" },
  }),
  // Nobody's yet. PATCH lets anyone claim it, so hiding it here would leave
  // that claim path unreachable.
  taskRow(T_ORPHAN, { title: "Book the skip", status: "open" }),
  // A different tenant's row, to prove the scope was added ON TOP of the
  // company filter rather than in place of it.
  taskRow("task_other_co", { companyId: "co2", assignedToId: "u_crew" }),
];

const taskReq = (qs = "") => ({ url: `http://local/api/tasks${qs}`, json: async () => ({}) });
const idsOf = (res) => (res.body || []).map((t) => t.id);

asMember("m_crew");
const crewTasks = await tasksList.GET(taskReq());
ok("GET /api/tasks answers Crew at all (200)", crewTasks.status === 200);
ok("Crew see the to-do assigned to them", idsOf(crewTasks).includes(T_MINE));
ok(
  "…and the one they raised for somebody else",
  idsOf(crewTasks).includes(T_I_MADE),
);
ok(
  "…and NOT a colleague's, which is the whole exposure",
  !idsOf(crewTasks).includes(T_THEIRS),
);
ok(
  "…and NOT another tenant's, so the company filter still stands",
  !idsOf(crewTasks).includes("task_other_co"),
);
ok("…which is three rows, not five", crewTasks.body.length === 3);

// The claim path, asserted as a behaviour rather than trusted to the comment.
ok(
  "an unassigned to-do stays visible — PATCH lets them claim it",
  idsOf(crewTasks).includes(T_ORPHAN),
);

// What a Task carries that a Job read would have refused them. Asserted on the
// serialised payload, the same posture as section 11's moneyIn walk: the point
// is that the string is nowhere in the response, not that one field is absent.
const crewTaskJson = JSON.stringify(crewTasks.body);
ok(
  "no client name from a to-do they cannot see",
  !crewTaskJson.includes("Bea Nolan"),
);
ok(
  "…and no job title from one either",
  !crewTaskJson.includes("Deck stain"),
);

// ── The query parameter must not be a way out of the scope ─────────────────
//
// This is the assertion the composition turns on. `?assignedToId=u_other` is a
// filter, and a scoped caller passing it must be INTERSECTED with the scope,
// not have the scope replaced by it. If the two clauses ever collide, this
// line returns the colleague's to-do.
const crewProbe = await tasksList.GET(taskReq("?assignedToId=u_other"));
ok(
  "Crew asking for a colleague's to-dos do not get them",
  !idsOf(crewProbe).includes(T_THEIRS),
);
ok(
  "…they get the intersection: the one assigned to that colleague that THEY raised",
  crewProbe.body.length === 1 && crewProbe.body[0].id === T_I_MADE,
);
// And the parameter still does its job for the person it was built for.
asMember("m_disp");
const dispProbe = await tasksList.GET(taskReq("?assignedToId=u_other"));
ok(
  "…while a supervisor's filter still returns both of that colleague's",
  dispProbe.body.length === 2 &&
    idsOf(dispProbe).includes(T_THEIRS) &&
    idsOf(dispProbe).includes(T_I_MADE),
);

const dispTasks = await tasksList.GET(taskReq());
ok(
  "a supervisor is NOT narrowed — they hold task:assign",
  dispTasks.status === 200 && dispTasks.body.length === 4,
);
ok(
  "…including the colleague's to-do with the client on it",
  idsOf(dispTasks).includes(T_THEIRS),
);

// The other filter, kept honest: the scope is an extra term, not a replacement
// for `status`.
asMember("m_crew");
globalThis.__FQ_ROWS.task.push(
  taskRow("task_mine_done", { assignedToId: "u_crew", status: "done" }),
);
const crewOpen = await tasksList.GET(taskReq("?status=open"));
ok(
  "the status filter still composes with the scope",
  !idsOf(crewOpen).includes("task_mine_done") && idsOf(crewOpen).includes(T_MINE),
);
globalThis.__FQ_ROWS.task.pop();

// The fail-closed direction, the same one assignedJobWhere is asserted on in
// section 9. A scoped caller whose userId we could not load must match nothing
// of their own — NOT everything.
//
// `userId` is ABSENT here rather than null, and the difference is the whole
// assertion: Prisma treats `assignedToId: null` as a real IS NULL filter, but
// DROPS `assignedToId: undefined` — and an OR with a dropped arm is an OR that
// is always true, so the route would answer with the entire company. Written
// with null first, this check passed against a route with no sentinel at all.
globalThis.__FQ_SESSION = { id: "m_ghost", companyId: "co", role: "employee" };
const ghostTasks = await tasksList.GET(taskReq());
ok(
  "a scoped caller with no userId gets only the unclaimed one, never the company's",
  ghostTasks.body.length === 1 && ghostTasks.body[0].id === T_ORPHAN,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n14. The Team schedule row, which led straight to a refusal\n");
//
// navRowAllowed shows any row it has no rule for — the deliberate fall-open in
// nav.js's header — and "app.nav.teamSchedule" had no rule. So Crew were shown
// the row, opened /app/schedule, and got a red banner: GET
// /api/team/schedules refuses on can(member.role, "user:view"), which
// PERMISSIONS.employee does not carry. That is the exact failure the
// "Rows that led straight to a refusal" block in nav.js exists for.

ok(
  "app.nav.teamSchedule has a rule at all",
  Boolean(NAV_REQUIREMENTS["app.nav.teamSchedule"]),
);
// Gated the same way as the roster row beside it, and asserted against that
// row rather than against a copied literal: if somebody widens Team, this
// notices that the two stopped agreeing.
ok(
  "…the same rule as the roster row it sits with",
  JSON.stringify(NAV_REQUIREMENTS["app.nav.teamSchedule"]) ===
    JSON.stringify(NAV_REQUIREMENTS["app.nav.team"]),
);
ok("the row is hidden from Crew", navRowAllowed("app.nav.teamSchedule", crew) === false);
ok(
  "…and from an Estimator, who also lacks user:view",
  navRowAllowed("app.nav.teamSchedule", estimator) === false,
);
ok(
  "…and SHOWN to a Dispatcher, who is a supervisor and holds it",
  navRowAllowed("app.nav.teamSchedule", dispatcher) === true,
);
ok("…and to a Manager", navRowAllowed("app.nav.teamSchedule", manager) === true);
ok("…and to an owner", navRowAllowed("app.nav.teamSchedule", owner) === true);
// The role that gates it, read off PERMISSIONS rather than assumed — this is
// the link between the nav rule and the endpoint's actual check.
ok(
  "the endpoint's gate is what the rule mirrors: employee lacks user:view",
  can("employee", "user:view") === false && can("supervisor", "user:view") === true,
);
ok(
  "GET /api/team/schedules really does gate on user:view",
  /can\(member\.role, "user:view"\)/.test(
    readFileSync(join(ROOT, "app/api/team/schedules/route.js"), "utf8"),
  ),
);
// The fall-open posture is unchanged for this row too — a missing provider
// must not empty the sidebar.
ok(
  "the row still shows when the provider is missing",
  navRowAllowed("app.nav.teamSchedule", null) === true,
);
ok(
  "…and for a member with no grid, who is gated by their role alone",
  navRowAllowed("app.nav.teamSchedule", legacy) === false,
);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}
