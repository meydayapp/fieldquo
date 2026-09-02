// scripts/fixtures/timeClockDb.mjs
//
// A scriptable stand-in for Prisma AND for lib/apiMember, so
// scripts/check-time-clock-job.mjs can execute the real
// app/api/time-clock/route.js rather than read it.
//
// ── Why not scripts/fixtures/dbStub.mjs ────────────────────────────────────
//
// That one is shared by a dozen checks and its `matches()` treats any nested
// object it doesn't recognise as a pass. The claims this check has to make are
// exactly about nested filters — `worker: { companyId }`, `visits: { some: {
// assignedToId } }`, `scheduledAt: { gte, lt }`, `status: { not: "cancelled" }`
// — so a matcher that waves those through would let "a punch on another
// company's job is refused" pass on a route that had no companyId in its query
// at all. Teaching the shared stub those operators would change what every
// other check's fixtures mean, which is somebody else's build to break.
//
// So: a small filter engine that actually APPLIES the operators this path uses.
// The engine is the thing under test as much as the route is — if
// clockableJobWhere stops emitting `companyId`, the foreign job matches here
// and the assertion fails. That is the whole point of writing one.
//
// Anything the engine does not understand THROWS, rather than passing. A stub
// that quietly ignores a filter is how a check comes to certify a route that
// never had the guard.

/** Fixture tables. A check assigns these before exercising the route. */
export const rows = {
  worker: [],
  member: [],
  company: [],
  job: [],
  jobVisit: [],
  timeEntry: [],
};

/** Every write attempted, in order. */
export const writes = [];

/** The member `memberOrRefusal` will hand back, or null to refuse. */
export const session = { member: null };

export function reset() {
  for (const k of Object.keys(rows)) rows[k] = [];
  writes.length = 0;
  session.member = null;
}

// ───────────────────────────────────────────────────────────────────────────
// Relations, by the field name the product asks for them under.
// ───────────────────────────────────────────────────────────────────────────
const RELATIONS = {
  job: {
    visits: { list: true, of: "jobVisit", on: (job, v) => v.jobId === job.id },
    client: { list: false, get: (job) => job.client || null },
    company: { list: false, get: (job) => rows.company.find((c) => c.id === job.companyId) || null },
  },
  jobVisit: {
    job: { list: false, get: (v) => rows.job.find((j) => j.id === v.jobId) || null },
  },
  timeEntry: {
    worker: { list: false, get: (e) => rows.worker.find((w) => w.id === e.workerId) || null },
    job: { list: false, get: (e) => (e.jobId ? rows.job.find((j) => j.id === e.jobId) || null : null) },
  },
};

const OPERATORS = new Set(["not", "in", "notIn", "gt", "gte", "lt", "lte", "some", "every", "none"]);

function eq(a, b) {
  if (a instanceof Date || b instanceof Date) {
    if (a == null || b == null) return a === b;
    return new Date(a).getTime() === new Date(b).getTime();
  }
  return a === b;
}
const cmp = (a, b) =>
  a instanceof Date || b instanceof Date ? new Date(a).getTime() - new Date(b).getTime() : a < b ? -1 : a > b ? 1 : 0;

function match(model, row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      if (!(Array.isArray(cond) ? cond : [cond]).every((c) => match(model, row, c))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(Array.isArray(cond) ? cond : [cond]).some((c) => match(model, row, c))) return false;
      continue;
    }
    if (key === "NOT") {
      if ((Array.isArray(cond) ? cond : [cond]).some((c) => match(model, row, c))) return false;
      continue;
    }

    const relation = RELATIONS[model]?.[key];

    if (cond === null || cond === undefined) {
      if (relation) {
        const value = relation.list ? rows[relation.of].filter((r) => relation.on(row, r)) : relation.get(row);
        if (relation.list ? value.length : value) return false;
      } else if (row[key] !== null && row[key] !== undefined) {
        return false;
      }
      continue;
    }

    if (cond instanceof Date || typeof cond !== "object") {
      if (relation) throw new Error(`timeClockDb: scalar filter on relation ${model}.${key}`);
      if (!eq(row[key], cond)) return false;
      continue;
    }

    const keys = Object.keys(cond);
    const operators = keys.filter((k) => OPERATORS.has(k));
    if (operators.length && operators.length !== keys.length) {
      throw new Error(`timeClockDb: mixed operator/field filter on ${model}.${key}`);
    }

    if (!operators.length) {
      // A plain nested object: a to-one relation filter.
      if (!relation || relation.list) {
        throw new Error(`timeClockDb: no to-one relation ${model}.${key} to filter through`);
      }
      const target = relation.get(row);
      if (!target || !match(relationModel(model, key), target, cond)) return false;
      continue;
    }

    for (const op of operators) {
      const value = cond[op];
      if (op === "some" || op === "every" || op === "none") {
        if (!relation?.list) throw new Error(`timeClockDb: ${op} on non-list ${model}.${key}`);
        const list = rows[relation.of].filter((r) => relation.on(row, r));
        const hits = list.filter((r) => match(relation.of, r, value));
        if (op === "some" && !hits.length) return false;
        if (op === "every" && hits.length !== list.length) return false;
        if (op === "none" && hits.length) return false;
        continue;
      }
      const actual = row[key];
      if (op === "not" && eq(actual, value)) return false;
      if (op === "in" && !value.some((v) => eq(actual, v))) return false;
      if (op === "notIn" && value.some((v) => eq(actual, v))) return false;
      if (actual == null && ["gt", "gte", "lt", "lte"].includes(op)) return false;
      if (op === "gt" && !(cmp(actual, value) > 0)) return false;
      if (op === "gte" && !(cmp(actual, value) >= 0)) return false;
      if (op === "lt" && !(cmp(actual, value) < 0)) return false;
      if (op === "lte" && !(cmp(actual, value) <= 0)) return false;
    }
  }
  return true;
}

function relationModel(model, key) {
  if (model === "job" && key === "client") return "client";
  if (model === "job" && key === "company") return "company";
  if (model === "jobVisit" && key === "job") return "job";
  if (model === "timeEntry" && key === "worker") return "worker";
  if (model === "timeEntry" && key === "job") return "job";
  throw new Error(`timeClockDb: unknown relation ${model}.${key}`);
}

/** Shape a row the way `select` asked for it, resolving nested relations. */
function project(model, row, select) {
  if (!row || !select) return row;
  const out = {};
  for (const [key, spec] of Object.entries(select)) {
    if (spec === true) {
      out[key] = row[key] ?? null;
      continue;
    }
    if (spec && typeof spec === "object") {
      const relation = RELATIONS[model]?.[key];
      if (!relation) throw new Error(`timeClockDb: select on unknown relation ${model}.${key}`);
      const target = relation.list
        ? rows[relation.of].filter((r) => relation.on(row, r))
        : relation.get(row);
      const child = relationModel(model, key);
      out[key] = relation.list
        ? target.map((r) => project(child, r, spec.select))
        : target
          ? project(child, target, spec.select)
          : null;
    }
  }
  return out;
}

function sort(list, orderBy) {
  if (!orderBy) return list;
  const [field, dir] = Object.entries(orderBy)[0];
  return [...list].sort((a, b) => (dir === "desc" ? -cmp(a[field], b[field]) : cmp(a[field], b[field])));
}

let sequence = 0;

function model(name) {
  const find = (args = {}) => rows[name].filter((r) => match(name, r, args.where));
  return {
    findFirst: async (args = {}) => {
      const hit = sort(find(args), args.orderBy)[0] || null;
      return hit ? project(name, hit, args.select) : null;
    },
    findUnique: async (args = {}) => {
      const hit = find(args)[0] || null;
      return hit ? project(name, hit, args.select) : null;
    },
    findMany: async (args = {}) => {
      let list = sort(find(args), args.orderBy);
      if (args.take != null) list = list.slice(0, args.take);
      return list.map((r) => project(name, r, args.select));
    },
    create: async ({ data, select } = {}) => {
      writes.push({ model: name, action: "create", data });
      const row = { id: `${name}_${++sequence}`, ...data };
      rows[name].push(row);
      return select ? project(name, row, select) : row;
    },
    update: async ({ where, data, select } = {}) => {
      writes.push({ model: name, action: "update", where, data });
      const row = find({ where })[0];
      if (!row) throw new Error(`timeClockDb: ${name}.update matched no row`);
      Object.assign(row, data);
      return select ? project(name, row, select) : row;
    },
  };
}

export const db = new Proxy(
  {
    worker: model("worker"),
    member: model("member"),
    company: model("company"),
    job: model("job"),
    jobVisit: model("jobVisit"),
    timeEntry: model("timeEntry"),
    // Prisma's batch form invokes each call eagerly and awaits the array. The
    // stub's methods are already-running promises by the time they arrive here,
    // so awaiting them is the same sequence a batch would produce — enough to
    // assert that BOTH writes happen, which is the guarantee the switch path
    // needs (a close with no reopen leaves somebody off the clock).
    $transaction: async (operations) => Promise.all(operations),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`timeClockDb: db.${String(prop)} is not scripted`);
    },
  },
);

// ── lib/apiMember's half ───────────────────────────────────────────────────
export async function memberOrRefusal() {
  if (!session.member) {
    return { member: null, response: { status: 401, body: { error: "Unauthorized" } } };
  }
  return { member: session.member, response: null };
}
