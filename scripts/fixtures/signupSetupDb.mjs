// scripts/fixtures/signupSetupDb.mjs
//
// The Prisma stand-in scripts/check-signup-creating.mjs aliases `@/lib/db` to,
// so the REAL seeders behind the signup progress screen (lib/signup/
// setupStages.js → seedStandardAddOns, seedServicesForTrade, the checklist and
// plan seeders, the email templates, the follow-up rules) and the REAL
// POST /api/signup/setup run end to end with no database.
//
// Not scripts/fixtures/dbStub.mjs, deliberately: that stub throws on any model
// it has not been taught, which is right for the checks built on it, and the
// seeding touches half a dozen models it has never needed. This one makes
// every model on demand and applies writes to memory, so "a second run creates
// nothing" is a count a check can read rather than a claim about a query.
//
// It understands only what the seeding asks: equality, `in`, `not: null`,
// `select` passed through (plus a product's `categories`), createMany with
// skipDuplicates on a key the check names, and the advisory-lock query.

export const state = {
  rows: {},
  writes: [],
  // pg_try_advisory_xact_lock's answer; flip to false to play "another run holds it".
  lockFree: true,
  lockQueries: 0,
  // { model: "product", method: "create", times: n, message } — the next n calls throw.
  failNext: null,
  // unique keys for createMany({ skipDuplicates: true }), per model
  uniques: { jobChecklistTemplate: ["companyId", "seedKey"], servicePlanTemplate: ["companyId", "seedKey"], companyServiceCategory: ["companyId", "categoryId"] },
};

let seq = 0;
const table = (m) => (state.rows[m] ||= []);

export function resetSignupSetupDb() {
  state.rows = {};
  state.writes = [];
  state.lockFree = true;
  state.lockQueries = 0;
  state.failNext = null;
}

function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where || {})) {
    const rv = row[k];
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      if ("in" in v && !(Array.isArray(v.in) && v.in.includes(rv))) return false;
      if ("not" in v && v.not === null && (rv === null || rv === undefined)) return false;
      if ("equals" in v && rv !== v.equals) return false;
      continue;
    }
    if (v === null ? !(rv === null || rv === undefined) : rv !== v) return false;
  }
  return true;
}

function maybeFail(model, method) {
  const f = state.failNext;
  if (f && f.model === model && (!f.method || f.method === method) && f.times > 0) {
    f.times--;
    throw new Error(f.message || `signupSetupDb: injected failure on ${model}.${method}`);
  }
}

function project(row, select) {
  if (!select) return row;
  const out = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    if (k === "categories" && v?.select) out.categories = (row.__cats || []).map((id) => ({ id }));
    else if (v && typeof v === "object" && v.select) {
      const rel = row[k];
      out[k] = rel && typeof rel === "object" ? project(rel, v.select) : rel ?? null;
    } else out[k] = row[k];
  }
  return out;
}

function connectIds(data) {
  const c = data?.categories?.connect;
  if (!c) return null;
  return (Array.isArray(c) ? c : [c]).map((x) => x.id);
}

function model(name) {
  return {
    findMany: async ({ where, select, orderBy } = {}) => {
      maybeFail(name, "findMany");
      return table(name).filter((r) => matches(r, where)).map((r) => project(r, select));
    },
    findFirst: async ({ where, select } = {}) => {
      maybeFail(name, "findFirst");
      const hit = table(name).find((r) => matches(r, where));
      return hit ? project(hit, select) : null;
    },
    findUnique: async ({ where, select } = {}) => {
      maybeFail(name, "findUnique");
      const hit = table(name).find((r) => matches(r, where));
      return hit ? project(hit, select) : null;
    },
    count: async ({ where } = {}) => table(name).filter((r) => matches(r, where)).length,
    create: async ({ data } = {}) => {
      maybeFail(name, "create");
      const row = { id: `${name}_${++seq}`, ...data };
      const cats = connectIds(data);
      if (cats) row.__cats = cats;
      delete row.categories;
      table(name).push(row);
      state.writes.push({ model: name, action: "create", data });
      return row;
    },
    createMany: async ({ data, skipDuplicates } = {}) => {
      maybeFail(name, "createMany");
      const list = Array.isArray(data) ? data : [data];
      const keys = state.uniques[name];
      let count = 0;
      for (const d of list) {
        if (skipDuplicates && keys && table(name).some((r) => keys.every((k) => r[k] === d[k]))) continue;
        table(name).push({ id: `${name}_${++seq}`, ...d });
        count++;
      }
      state.writes.push({ model: name, action: "createMany", count });
      return { count };
    },
    update: async ({ where, data } = {}) => {
      maybeFail(name, "update");
      const hit = table(name).find((r) => matches(r, where));
      if (!hit) throw new Error(`signupSetupDb: ${name}.update found no row`);
      const cats = connectIds(data);
      if (cats) hit.__cats = [...new Set([...(hit.__cats || []), ...cats])];
      for (const [k, v] of Object.entries(data || {})) if (k !== "categories") hit[k] = v;
      state.writes.push({ model: name, action: "update", where, data });
      return hit;
    },
    updateMany: async ({ where, data } = {}) => {
      const hits = table(name).filter((r) => matches(r, where));
      for (const h of hits) Object.assign(h, data);
      return { count: hits.length };
    },
  };
}

const models = {};
export const db = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === "then") return undefined;
      if (prop === "$transaction") {
        return async (fn, opts) => {
          state.writes.push({ model: "$transaction", action: "open", opts });
          return typeof fn === "function" ? fn(db) : Promise.all(fn);
        };
      }
      if (prop === "$queryRaw") {
        return async (strings, ...values) => {
          state.lockQueries++;
          state.writes.push({ model: "$queryRaw", action: "query", sql: strings.join("?"), values });
          return [{ locked: state.lockFree }];
        };
      }
      if (prop === "$executeRaw") return async () => 1;
      return (models[prop] ||= model(prop));
    },
  },
);
export default db;
