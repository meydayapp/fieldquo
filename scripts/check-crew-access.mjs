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
import { PERMISSION_CATEGORIES, PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { hasLevel, UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";
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
console.log("\n4. The Crew preset holds none of the four\n");

const crewPreset = PERMISSION_PRESETS.worker;
ok('the preset is called "Crew"', crewPreset.label === "Crew");
ok(
  "…and still maps to the employee tier (no role change)",
  PRESET_TO_ROLE.worker === "employee",
);

const crew = member(PRESET_TO_ROLE.worker, { ...crewPreset.values });
for (const category of DOCUMENT_CATEGORIES) {
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
  ok(`${row} is hidden from Crew`, navRowAllowed(row, crew) === false);
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

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}
