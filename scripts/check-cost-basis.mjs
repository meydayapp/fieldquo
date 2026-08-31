// scripts/check-cost-basis.mjs
//
//   npm run check:cost-basis
//
// The company's COST BASIS — what the business costs to run, and therefore its
// margin — asserted by EXECUTING the route handlers against fixture members at
// every access preset, not by reading them.
//
// ── What went wrong ────────────────────────────────────────────────────────
//
// jobCosting was enforced on three screens (the quote, job and invoice costing
// panels) and nowhere else. QA signed in as a Dispatcher — showPricing:true,
// jobCosting:FALSE — and read COST PER JOB $2,886, a 20% target margin,
// $12,495 of monthly fixed costs, the itemised rent rows and a $25,000 truck
// loan, from six endpoints that all gated on `user:manage`, which a supervisor
// holds.
//
// And the read gate and the write gate disagreed. GET /api/salaries refused
// him; POST /api/salaries accepted a row from him and DELETE removed it again.
// A write that succeeds where the read 403s is the sharpest version of this,
// because the record moves the price floor on every quote written afterwards
// and its author cannot see what he did.
//
// ── Why this executes rather than greps ────────────────────────────────────
//
// Every previous guard in this area asserts that a gate EXPRESSION appears in
// a file. That catches a deleted gate and misses a wrong one — it would have
// passed happily on the day POST checked `user:manage` while GET checked the
// payroll ladder, because both files contained a gate. The only assertion that
// distinguishes those two is calling the handler and reading the status.
//
// Run:
//   node --import ./scripts/alias-loader.mjs scripts/check-cost-basis.mjs

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}${detail ? `   ${detail}` : ""}`);
  if (!cond) fail++;
};

/* ═══════════════════════════════════════════════════════════════════════════
   The scriptable world these handlers run in
   ═══════════════════════════════════════════════════════════════════════════

   Three specifiers are swapped, the same trio check-feature-flags.mjs swaps and
   for the same reasons: "@/lib/db" constructs a Prisma pool against Neon at
   module load, "@/lib/currentMember" drags in Better Auth, and bare node cannot
   resolve "next/server" at all. Everything else — apiMember, enforce,
   costBasis, the route handlers themselves — is the shipped file.  */

// Whose row loadEnforceableMember finds. Set per scenario.
globalThis.__FQ_ENFORCEABLE = null;
// Whose session memberOrRefusal resolves. Set per scenario.
globalThis.__FQ_MEMBER = async () => ({
  id: "m1",
  userId: "u1",
  companyId: "co",
  role: "owner",
  impersonation: false,
});

/**
 * A Prisma-shaped fake.
 *
 * The default for an unnamed method is chosen by NAME rather than being null
 * for everything: a route doing `rows.map(...)` on a null findMany throws a
 * TypeError, and a check that cannot tell a thrown TypeError from a refusal is
 * worse than no check.
 */
function makeDb() {
  const row = { id: "row1", companyId: "co", category: "Rent", amount: 100 };
  const explicit = {
    member: {
      // The whole point of the fixture: the handler asks the database who is
      // calling, and gets the preset under test.
      async findUnique() {
        return globalThis.__FQ_ENFORCEABLE;
      },
    },
    expense: {
      async findMany() {
        return [{ ...row, frequency: "monthly", notes: null }];
      },
      async findFirst() {
        return { id: "row1", category: "Rent" };
      },
      async create() {
        return { ...row, frequency: "monthly", notes: null };
      },
      async delete() {
        return row;
      },
      async aggregate() {
        return { _sum: { amount: 0 } };
      },
    },
    debt: {
      async findMany() {
        return [{ id: "d1", name: "Truck", principal: 25000, monthlyPayment: 1000 }];
      },
      async findFirst() {
        return { id: "d1", companyId: "co", name: "Truck" };
      },
      async create() {
        return { id: "d1" };
      },
      async update() {
        return { id: "d1" };
      },
      async delete() {
        return { id: "d1" };
      },
    },
    salary: {
      async findMany() {
        return [{ id: "s1", name: "Owner draw", amount: 4000, frequency: "monthly" }];
      },
      async findFirst() {
        return {
          id: "s1",
          companyId: "co",
          name: "Owner draw",
          amount: 4000,
          frequency: "monthly",
          hoursPerWeek: null,
        };
      },
      async create() {
        return { id: "s1" };
      },
      async update() {
        return { id: "s1" };
      },
      async delete() {
        return { id: "s1" };
      },
    },
    materialRecipeSetting: {
      async findMany() {
        return [];
      },
      async upsert() {
        return { overrides: {} };
      },
      async delete() {
        return {};
      },
    },
    // The material-recipes PUT/DELETE fixtures below write categoryKey
    // "cabinet_refinishing" — added when GET/PUT/DELETE were also gated by
    // TRADE (lib/settings/tradeGate.js), on top of the cost-basis grid this
    // file exists to test. Without a category enabled, canUseMaterialCostsCategory
    // would refuse every role including the owner, which would make this
    // file's PUT/DELETE cases test "does the company sell cabinet_refinishing"
    // instead of "does this role hold cost-basis write" — a different
    // question than the one this file is for. This company sells the trade
    // its own fixtures write to, same as any real company saving an override
    // would.
    companyServiceCategory: {
      async findMany() {
        return [
          { companyId: "co", enabled: true, category: { key: "cabinet_refinishing" } },
        ];
      },
    },
    forecastSettings: {
      async findUnique() {
        return { jobsPerWeekCapacity: 3 };
      },
    },
  };

  const byName = (prop) => {
    if (/^(findMany|groupBy)$/.test(prop)) return async () => [];
    if (/^count$/.test(prop)) return async () => 0;
    if (/^aggregate$/.test(prop)) return async () => ({ _sum: {}, _count: {} });
    return async () => null;
  };

  return new Proxy(explicit, {
    get(target, model) {
      if (model in target) {
        // Still proxied, so a model we DID name can grow a method we didn't.
        return new Proxy(target[model], {
          get: (t, prop) => (prop in t ? t[prop] : byName(prop)),
        });
      }
      return new Proxy({}, { get: (_t, prop) => byName(prop) });
    },
  });
}

globalThis.__FQ_DB = makeDb();

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

const { PERMISSION_PRESETS, PRESET_TO_ROLE } = await import("@/lib/permissions");
const {
  COST_BASIS_RESOURCES,
  COST_BASIS_KEYS,
  canReadCostBasis,
  canWriteCostBasis,
} = await import("@/lib/permissions/costBasis");
const { copilotToolsFor } = await import("@/lib/ai/copilotTools");
// The job scope, asserted alongside the tool list: getUpcomingWork is granted
// on the LEVEL and made safe by the SCOPE, and a check that saw only the first
// half would pass on the exact code this pair was written to prevent.
const { seesOnlyAssignedJobs } = await import("@/lib/permissions/enforce");
const {
  SETTINGS_ROW_REQUIREMENTS,
  canSeeSettingsRow,
} = await import("@/lib/permissions/settingsAccess");

/* ═══════════════════════════════════════════════════════════════════════════
   The people
   ═══════════════════════════════════════════════════════════════════════════

   Built FROM PERMISSION_PRESETS rather than typed out, so a preset that gains
   or loses jobCosting tomorrow is covered without anyone remembering to edit
   this list. The two "no grid" rows are the members who predate the grid
   entirely; enforce.js falls back to their coarse role for them and this has
   to keep doing the same, or a deploy locks out working accounts. */

const memberFor = (name, role, permissions) => ({
  name,
  member: { id: `m-${name}`, userId: `u-${name}`, companyId: "co", role, permissions },
});

const FIXTURES = [
  memberFor("owner", "owner", {}),
  memberFor("admin", "admin", {}),
  ...Object.entries(PERMISSION_PRESETS).map(([key, preset]) =>
    memberFor(`${key}`, PRESET_TO_ROLE[key], { ...preset.values }),
  ),
  memberFor("legacy-supervisor-no-grid", "supervisor", null),
  memberFor("legacy-employee-no-grid", "employee", null),
];

const byName = Object.fromEntries(FIXTURES.map((f) => [f.name, f.member]));

/* ═══════════════════════════════════════════════════════════════════════════
   1. The matrix, written down
   ═══════════════════════════════════════════════════════════════════════════

   Spelled out per preset rather than derived from the predicate, because a
   check that asks the rule what the rule says proves nothing. This is the
   thing a reviewer reads to see whether the line moved for anyone it should
   not have — in particular that a Manager, who holds jobCosting, kept
   everything a Manager held.  */

const R = true;
const X = false;
//                       fixedCosts   debt     salaries   materialRecipes  minimumPrice  burnRate
const EXPECTED_READ = {
  owner:                      [R,      R,        R,          R,               R,           R],
  admin:                      [R,      R,        R,          R,               R,           R],
  worker:                     [X,      X,        X,          X,               X,           X],
  estimator:             [X,      X,        X,          X,               X,           X],
  dispatcher:                 [X,      X,        X,          X,               X,           X],
  manager:                    [R,      R,        X,          R,               R,           R],
  // No grid stored: hasLevel/hasToggle fall back to the coarse role, so a
  // supervisor who predates the editor keeps what the role gave them. Written
  // down because it is the one row where "false" would be a regression rather
  // than a fix.
  "legacy-supervisor-no-grid": [R,     R,        R,          R,               R,           R],
  // An employee holds no user:manage, so the three company-commitment lists
  // refuse — but the payroll ladder and both toggles fall open with no grid,
  // which is why salaries and the two computed figures do not. Pre-existing
  // behaviour, unchanged by this sweep, and recorded so that changing it is a
  // decision rather than an accident.
  "legacy-employee-no-grid":  [X,      X,        R,          X,               R,           R],
};

const RESOURCE_ORDER = [
  "fixedCosts",
  "debt",
  "salaries",
  "materialRecipes",
  "minimumPrice",
  "burnRate",
];

console.log("\n1. Who may read the cost basis\n");

ok(
  COST_BASIS_KEYS.length === RESOURCE_ORDER.length &&
    RESOURCE_ORDER.every((k) => COST_BASIS_KEYS.includes(k)),
  "the expectation table covers every declared resource",
  COST_BASIS_KEYS.join(" "),
);
ok(
  Object.keys(EXPECTED_READ).length === FIXTURES.length,
  "…and every fixture member",
  `${FIXTURES.length} members`,
);

for (const { name, member } of FIXTURES) {
  const expected = EXPECTED_READ[name];
  for (let i = 0; i < RESOURCE_ORDER.length; i++) {
    const resource = RESOURCE_ORDER[i];
    ok(
      canReadCostBasis(member, resource) === expected[i],
      `${name} ${expected[i] ? "reads" : "is refused"} ${resource}`,
    );
  }
}

console.log("\n2. A write can never reach further than the read it goes with\n");

// The invariant that makes "POST 201 where GET 403" impossible to reintroduce
// by editing one handler. Asserted over every member, every resource — not
// over the two that happened to be reported.
for (const { name, member } of FIXTURES) {
  for (const resource of RESOURCE_ORDER) {
    if (!COST_BASIS_RESOURCES[resource].write) continue;
    const w = canWriteCostBasis(member, resource);
    const r = canReadCostBasis(member, resource);
    ok(!w || r, `${name}: write(${resource}) implies read(${resource})`, `w=${w} r=${r}`);
  }
}
for (const resource of ["minimumPrice", "burnRate"]) {
  ok(
    COST_BASIS_RESOURCES[resource].write === null,
    `${resource} declares no write path`,
  );
  for (const { name, member } of FIXTURES) {
    ok(!canWriteCostBasis(member, resource), `…so ${name} cannot write it either`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The endpoints, executed
   ═══════════════════════════════════════════════════════════════════════════ */

/** A request the handlers can read. `url` is absolute: they call new URL(). */
function makeRequest(url, body) {
  return {
    url,
    method: "POST",
    headers: new Map(),
    async json() {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  };
}

async function call(mod, verb, { url, body, params }) {
  const handler = mod[verb];
  if (typeof handler !== "function") return { missing: true };
  try {
    const res = params
      ? await handler(makeRequest(url, body), { params: Promise.resolve(params) })
      : await handler(makeRequest(url, body));
    return { status: res?.status ?? 200, body: res?.body };
  } catch (err) {
    // A gate that throws instead of answering is a 500 in production. Reported
    // as its own failure rather than counted as a refusal.
    return { threw: String(err?.message || err) };
  }
}

const ENDPOINTS = [
  {
    label: "GET /api/analytics/minimum-price",
    spec: "@/app/api/analytics/minimum-price/route",
    verb: "GET",
    resource: "minimumPrice",
    mode: "read",
    url: "http://x/api/analytics/minimum-price",
  },
  {
    label: "GET /api/analytics/burn-rate",
    spec: "@/app/api/analytics/burn-rate/route",
    verb: "GET",
    resource: "burnRate",
    mode: "read",
    url: "http://x/api/analytics/burn-rate",
  },
  {
    label: "GET /api/overhead/fixed-costs",
    spec: "@/app/api/overhead/fixed-costs/route",
    verb: "GET",
    resource: "fixedCosts",
    mode: "read",
    url: "http://x/api/overhead/fixed-costs",
  },
  {
    label: "POST /api/overhead/fixed-costs",
    spec: "@/app/api/overhead/fixed-costs/route",
    verb: "POST",
    resource: "fixedCosts",
    mode: "write",
    url: "http://x/api/overhead/fixed-costs",
    body: { name: "Shop rent", amount: 1200, frequency: "monthly" },
  },
  {
    label: "DELETE /api/overhead/fixed-costs/[id]",
    spec: "@/app/api/overhead/fixed-costs/[id]/route",
    verb: "DELETE",
    resource: "fixedCosts",
    mode: "write",
    url: "http://x/api/overhead/fixed-costs/row1",
    params: { id: "row1" },
  },
  {
    label: "GET /api/debt",
    spec: "@/app/api/debt/route",
    verb: "GET",
    resource: "debt",
    mode: "read",
    url: "http://x/api/debt",
  },
  {
    label: "POST /api/debt",
    spec: "@/app/api/debt/route",
    verb: "POST",
    resource: "debt",
    mode: "write",
    url: "http://x/api/debt",
    body: { name: "Truck loan", principal: 25000, monthlyPayment: 1000 },
  },
  {
    label: "PATCH /api/debt/[id]",
    spec: "@/app/api/debt/[id]/route",
    verb: "PATCH",
    resource: "debt",
    mode: "write",
    url: "http://x/api/debt/d1",
    params: { id: "d1" },
    body: { monthlyPayment: 999 },
  },
  {
    label: "DELETE /api/debt/[id]",
    spec: "@/app/api/debt/[id]/route",
    verb: "DELETE",
    resource: "debt",
    mode: "write",
    url: "http://x/api/debt/d1",
    params: { id: "d1" },
  },
  {
    label: "GET /api/salaries",
    spec: "@/app/api/salaries/route",
    verb: "GET",
    resource: "salaries",
    mode: "read",
    url: "http://x/api/salaries",
  },
  {
    // The exact request QA made: {name, amount: 1} → 201 CREATED from an
    // account the GET above refused.
    label: "POST /api/salaries",
    spec: "@/app/api/salaries/route",
    verb: "POST",
    resource: "salaries",
    mode: "write",
    url: "http://x/api/salaries",
    body: { name: "QA probe", amount: 1, frequency: "monthly" },
  },
  {
    label: "PATCH /api/salaries/[id]",
    spec: "@/app/api/salaries/[id]/route",
    verb: "PATCH",
    resource: "salaries",
    mode: "write",
    url: "http://x/api/salaries/s1",
    params: { id: "s1" },
    body: { amount: 4100 },
  },
  {
    label: "DELETE /api/salaries/[id]",
    spec: "@/app/api/salaries/[id]/route",
    verb: "DELETE",
    resource: "salaries",
    mode: "write",
    url: "http://x/api/salaries/s1",
    params: { id: "s1" },
  },
  {
    label: "GET /api/settings/material-recipes",
    spec: "@/app/api/settings/material-recipes/route",
    verb: "GET",
    resource: "materialRecipes",
    mode: "read",
    url: "http://x/api/settings/material-recipes",
  },
  {
    label: "PUT /api/settings/material-recipes",
    spec: "@/app/api/settings/material-recipes/route",
    verb: "PUT",
    resource: "materialRecipes",
    mode: "write",
    url: "http://x/api/settings/material-recipes",
    body: { categoryKey: "cabinet_refinishing", overrides: { coats: 3 } },
  },
  {
    label: "DELETE /api/settings/material-recipes",
    spec: "@/app/api/settings/material-recipes/route",
    verb: "DELETE",
    resource: "materialRecipes",
    mode: "write",
    url: "http://x/api/settings/material-recipes?categoryKey=cabinet_refinishing",
  },
];

/** Point the stubbed session and the stubbed member row at one fixture. */
function become(member) {
  globalThis.__FQ_ENFORCEABLE = member;
  globalThis.__FQ_MEMBER = async () => ({
    id: member.id,
    userId: member.userId,
    companyId: member.companyId,
    role: member.role,
    impersonation: false,
  });
}

const modules = new Map();
async function moduleFor(spec) {
  if (!modules.has(spec)) modules.set(spec, await import(spec));
  return modules.get(spec);
}

console.log("\n3. The endpoints, called for real\n");

for (const endpoint of ENDPOINTS) {
  const mod = await moduleFor(endpoint.spec);
  const results = [];

  for (const { name, member } of FIXTURES) {
    become(member);
    const res = await call(mod, endpoint.verb, endpoint);
    results.push({ name, res });

    if (res.missing) {
      ok(false, `${endpoint.label}: the handler does not exist`);
      continue;
    }
    if (res.threw) {
      ok(false, `${endpoint.label} as ${name}: threw instead of answering`, res.threw);
      continue;
    }

    const allowed =
      endpoint.mode === "read"
        ? canReadCostBasis(member, endpoint.resource)
        : canWriteCostBasis(member, endpoint.resource);

    if (allowed) {
      // Not "=== 200": a 400 from validation or a 404 from a missing row both
      // mean the gate let them past, which is what is being asserted. Only 403
      // is a refusal.
      ok(res.status !== 403, `${endpoint.label}: ${name} gets through`, `status ${res.status}`);
    } else {
      ok(res.status === 403, `${endpoint.label}: ${name} is refused`, `status ${res.status}`);
      // AGENTS.md and the brief both: refusals are 403, never 500, and never a
      // raw permission identifier in the sentence the user reads.
      const message = String(res.body?.error || "");
      ok(message.length > 20, `…with a sentence, not an empty body`, JSON.stringify(message.slice(0, 50)));
      ok(
        !/user:manage|jobCosting|showPricing|view_record_edit|view_all/.test(message),
        `…that names no internal permission identifier`,
      );
    }
  }

  // The headline shape, stated per endpoint so a regression names itself
  // rather than hiding inside the loop above.
  const dispatcher = results.find((r) => r.name === "dispatcher");
  ok(
    dispatcher?.res?.status === 403,
    `${endpoint.label}: refuses a Dispatcher (jobCosting:false)`,
    `status ${dispatcher?.res?.status}`,
  );
  const owner = results.find((r) => r.name === "owner");
  ok(owner?.res?.status !== 403, `${endpoint.label}: still opens for the owner`);
}

console.log("\n4. Read and write agree, endpoint by endpoint\n");

// The F-08 shape, asserted on the routes rather than on the predicate: for each
// resource, no member may get a non-403 from a WRITE while getting a 403 from
// the READ on the same resource.
for (const resource of RESOURCE_ORDER) {
  const reads = ENDPOINTS.filter((e) => e.resource === resource && e.mode === "read");
  const writes = ENDPOINTS.filter((e) => e.resource === resource && e.mode === "write");
  if (!writes.length) continue;

  for (const { name, member } of FIXTURES) {
    become(member);
    let readRefused = false;
    for (const e of reads) {
      const res = await call(await moduleFor(e.spec), e.verb, e);
      if (res.status === 403) readRefused = true;
    }
    if (!readRefused) continue;
    for (const e of writes) {
      const res = await call(await moduleFor(e.spec), e.verb, e);
      ok(
        res.status === 403,
        `${name}: refused the ${resource} read, so ${e.label} refuses too`,
        `status ${res.status}`,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Mutation test — prove the assertions above can fail
   ═══════════════════════════════════════════════════════════════════════════

   Everything in section 3 would also pass against a file with no gate in it if
   the expectation table happened to say "allowed" everywhere. So one route is
   recompiled with its gate deleted and re-run: the Dispatcher assertion has to
   go from pass to fail. A guard that cannot be made to fail is not a guard. */

console.log("\n5. Mutation: delete the gate and watch it break\n");

const MUTANT = path.join(ROOT, ".cost-basis-mutant.js");
const original = fs.readFileSync(path.join(ROOT, "app/api/debt/route.js"), "utf8");
// Both halves, so the mutant is the pre-fix file rather than half of it.
const mutated = original
  .replace('requireCostBasisRead(full, "debt");', "void full;")
  .replace('requireCostBasisWrite(full, "debt");', "void full;");

ok(mutated !== original, "the mutation actually changed the source");

let mutantGet = null;
let mutantPost = null;
try {
  fs.writeFileSync(MUTANT, mutated);
  const mod = await import(`${pathToFileURL(MUTANT).href}?v=${Date.now()}`);
  become(byName.dispatcher);
  mutantGet = await call(mod, "GET", { url: "http://x/api/debt" });
  mutantPost = await call(mod, "POST", {
    url: "http://x/api/debt",
    body: { name: "Truck loan", principal: 25000, monthlyPayment: 1000 },
  });
} finally {
  fs.rmSync(MUTANT, { force: true });
}

ok(
  mutantGet?.status !== 403,
  "without the gate, a Dispatcher reads the company's debt again",
  `status ${mutantGet?.status}`,
);
ok(
  mutantPost?.status !== 403,
  "…and writes one",
  `status ${mutantPost?.status}`,
);
// And the shipped file does not behave that way. Same member, same request.
become(byName.dispatcher);
const realGet = await call(await moduleFor("@/app/api/debt/route"), "GET", {
  url: "http://x/api/debt",
});
ok(realGet.status === 403, "…while the real route refuses both", `status ${realGet.status}`);

/* ═══════════════════════════════════════════════════════════════════════════
   6. The copilot cannot answer what the REST layer refuses
   ═══════════════════════════════════════════════════════════════════════════

   F-09: GET /api/expenses/summary answered 403 — "You don't have access to
   company-wide expenses." — and the same person asked FieldQuo AI and was told
   "Total expenses (3mo) $9,120.50, Net cash flow $624.50". The model had been
   handed a tool whose access rule was showPricing alone.

   So the assertion is not "the tool has a rule". It is: for every tool the
   model is given, EXECUTE the REST endpoint that serves the same data and
   confirm it does not refuse the same member. The REST route is the authority;
   the tool list has to be a subset of it.  */

console.log("\n6. Every copilot tool is a subset of what REST would serve\n");

const TOOL_REST_EQUIVALENT = {
  // Revenue and conversion: the analytics dashboard serves both.
  getConversionRate: ["@/app/api/analytics/overview/route"],
  getRepeatCustomerRate: ["@/app/api/analytics/overview/route"],
  getProfitByCategory: ["@/app/api/analytics/overview/route"],
  getTopClients: ["@/app/api/analytics/overview/route"],
  // Both halves of the payload, both endpoints. This is the pairing that was
  // missing: the expense aggregate has its own gate and the tool ignored it.
  getCashFlow: [
    "@/app/api/analytics/overview/route",
    "@/app/api/expenses/summary/route",
  ],
  // No REST pairing asserted here: these three read documents whose list
  // endpoints redact rather than refuse (see redactQuotes/redactInvoices in
  // enforce.js), so "the REST route 403s" is the wrong question for them. Their
  // rules are asserted directly below instead.
  getUpcomingWork: [],
  findQuote: [],
  findInvoice: [],
  findJob: [],
};

const toolNamesFor = (member) =>
  copilotToolsFor(member).definitions.map((d) => d.name);

// A tool added tomorrow without a pairing fails here rather than shipping with
// nothing checking it — the same posture copilotToolsFor itself takes when a
// tool has no access rule.
const { COPILOT_TOOL_DEFINITIONS } = await import("@/lib/ai/copilotTools");
for (const def of COPILOT_TOOL_DEFINITIONS) {
  ok(
    TOOL_REST_EQUIVALENT[def.name] !== undefined,
    `${def.name}: declares which REST endpoint serves the same data`,
  );
}

for (const { name, member } of FIXTURES) {
  const tools = toolNamesFor(member);
  for (const tool of tools) {
    for (const spec of TOOL_REST_EQUIVALENT[tool] || []) {
      become(member);
      const res = await call(await moduleFor(spec), "GET", {
        url: "http://x/api/whatever",
      });
      ok(
        res.status !== 403,
        `${name}: holds ${tool}, and ${spec.split("/api/")[1].replace("/route", "")} serves them`,
        `status ${res.status}`,
      );
    }
  }
}

// The reported leak, named. A Dispatcher records his own expenses and is
// refused the company roll-up, so the tool that sums every expense row in the
// company must not be in his list.
{
  const dispatcherTools = toolNamesFor(byName.dispatcher);
  ok(
    !dispatcherTools.includes("getCashFlow"),
    "a Dispatcher is not handed getCashFlow",
    dispatcherTools.join(" "),
  );
  become(byName.dispatcher);
  const summary = await call(await moduleFor("@/app/api/expenses/summary/route"), "GET", {
    url: "http://x/api/expenses/summary",
  });
  ok(summary.status === 403, "…because /api/expenses/summary refuses him", `status ${summary.status}`);

  const managerTools = toolNamesFor(byName.manager);
  ok(
    managerTools.includes("getCashFlow"),
    "a Manager keeps it — expenses:view_record_edit_all",
  );
  ok(
    toolNamesFor(byName.owner).includes("getCashFlow"),
    "…and so does the owner",
  );
  ok(
    !toolNamesFor(byName.worker).includes("getCashFlow"),
    "a Worker never had it",
  );
}

// The document tools, asserted against the grid directly.
{
  const worker = toolNamesFor(byName.worker);
  // This used to assert the opposite, and the reason it flipped matters.
  // getUpcomingWork queried `job: { companyId }` with no assignee filter, so at
  // jobs:view_only it returned the COMPANY's calendar — and Crew were denied
  // the tool rather than the query being fixed, which was the safe direction
  // available at the time.
  //
  // The filter now exists in one place (assignedJobWhere in
  // lib/permissions/enforce.js) and the implementation spreads it, so Crew get
  // their own week and nobody else's. The tool comes back on the level alone,
  // which is the point of gating on the grid rather than on a preset name.
  ok(worker.includes("getUpcomingWork"),
    "Crew are handed the schedule tool again, now that it is scoped");
  ok(seesOnlyAssignedJobs(byName.worker) === true,
    "…and scoped is what they are — their own jobs, not the company's");
  ok(toolNamesFor(byName.estimator).includes("getUpcomingWork"),
    "…while an Estimator at jobs:view_only still sees the whole board");
  ok(seesOnlyAssignedJobs(byName.estimator) === false,
    "…which is the difference the scope draws at the same level");
  ok(!worker.includes("findQuote"), "…and is not handed quote lookups");
  ok(!worker.includes("findInvoice"), "…nor invoice lookups");
  const dispatcher = toolNamesFor(byName.dispatcher);
  ok(dispatcher.includes("findJob"), "a Dispatcher keeps findJob");
  const findJob = copilotToolsFor(byName.dispatcher).definitions.find(
    (d) => d.name === "findJob",
  );
  ok(
    /returns hours, not labour cost/.test(findJob.description),
    "…described without the labour-cost block they may not see",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The two screens stop offering themselves
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n7. The sidebar and the pages agree with the routes\n");

const access = (role) => ({ role, impersonation: false });

// The two cost-basis rows, named rather than taken as "every key in
// SETTINGS_ROW_REQUIREMENTS". That map is the general grid-rule map for the
// settings sidebar and has since grown rules about the price book and the
// expense roll-up — rows a Dispatcher legitimately sees, which would fail the
// "a Dispatcher does not" assertion below. This section is about the two
// screens that carry the company's cost basis, and now says so.
//
// Asserted to still BE cost-basis rows: if one loses its jobCosting rule, this
// list is describing something that stopped being true.
const COST_BASIS_ROWS = ["app.settings.overhead", "app.settings.materialCosts"];

for (const key of COST_BASIS_ROWS) {
  ok(
    SETTINGS_ROW_REQUIREMENTS[key]?.toggle === "jobCosting",
    `${key}: still gated on the jobCosting toggle`,
  );
  ok(
    canSeeSettingsRow(access("supervisor"), key, byName.manager),
    `${key}: a Manager still sees the row`,
  );
  ok(
    !canSeeSettingsRow(access("supervisor"), key, byName.dispatcher),
    `${key}: a Dispatcher does not`,
  );
  ok(
    canSeeSettingsRow(access("owner"), key, byName.owner),
    `${key}: the owner does`,
  );
  ok(
    canSeeSettingsRow({ role: "viewer", impersonation: true }, key, null),
    `${key}: a read-only support session does — non-negotiable #3`,
  );
  ok(
    canSeeSettingsRow(access("supervisor"), key, null),
    `${key}: an unresolved grid hides nothing`,
  );
}

// Hiding a row is not the gate, and neither is hiding a page — but a page that
// fetches five endpoints it will be refused is the "assembled from refusals"
// screen the settings sweep already fixed once. Asserted on the source because
// it is a React tree, not a function: the gate has to run BEFORE the component
// that owns the effect, or the fetches fire anyway.
for (const [file, inner] of [
  ["app/app/settings/overhead/page.js", "OverheadEditor"],
  ["app/app/settings/material-costs/page.js", "MaterialCostsEditor"],
]) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  ok(src.includes("usePermissions"), `${file}: asks who is looking`);
  ok(
    /hasToggle\(caller, "jobCosting"\)/.test(src),
    `${file}: on the jobCosting toggle, the same one the routes read`,
  );
  ok(src.includes("NoAccessPanel"), `${file}: renders the no-access panel`);
  ok(
    new RegExp(`return <${inner} />`).test(src),
    `${file}: the fetching component is separate, so a refusal never fetches`,
  );
  ok(
    src.indexOf("NoAccessPanel capability") < src.indexOf(`function ${inner}`),
    `${file}: …and the gate is decided before it`,
  );
}

console.log(
  fail === 0
    ? "\nALL PASS — the cost basis is one rule, read and write, and the copilot is inside it\n"
    : `\n${fail} FAILED\n`,
);
process.exit(fail ? 1 : 0);
