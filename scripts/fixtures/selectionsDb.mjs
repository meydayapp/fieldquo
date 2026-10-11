// scripts/fixtures/selectionsDb.mjs
//
// The in-memory Prisma stand-in scripts/check-job-selections.mjs runs the
// colours-and-materials routes, the quote → job copy and job creation against.
//
// Why not the shared scripts/fixtures/dbStub.mjs: the claims here are about
// WHERE clauses — a crew member's assignedJobWhere (an AND of an OR of two
// relation `some` filters), another company's job, a row id from another job
// — and dbStub's matcher compares flat keys. This one evaluates the nested
// filter the route actually sends, so "another company's job is refused" is
// decided by the query that ships, not by a matcher that happens to ignore
// half of it.
//
// Same two rules as dbStub: a model nobody scripted THROWS by name (so a
// best-effort helper that swallows it is visible as exactly that, and a path
// that needed it fails loudly), and every write is RECORDED.

export const state = {
  rows: {},
  writes: [],
  seq: 0,
};

const MODELS = ["member", "job", "quote", "company", "jobSelection"];

export function resetDb(rows = {}) {
  state.rows = Object.fromEntries(MODELS.map((m) => [m, structuredClone(rows[m] || [])]));
  state.writes = [];
  state.seq = 0;
}
resetDb();

const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
const OPS = new Set(["in", "notIn", "not", "gte", "gt", "lte", "lt", "equals", "startsWith", "contains"]);

function cmp(a, b) {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchValue(actual, cond) {
  if (isPlain(cond) && Object.keys(cond).some((k) => OPS.has(k))) {
    return Object.entries(cond).every(([op, v]) => {
      switch (op) {
        case "in": return v.includes(actual);
        case "notIn": return !v.includes(actual);
        case "not": return isPlain(v) ? !matchValue(actual, v) : (actual ?? null) !== v;
        case "equals": return (actual ?? null) === v;
        case "gte": return actual != null && cmp(actual, v) >= 0;
        case "gt": return actual != null && cmp(actual, v) > 0;
        case "lte": return actual != null && cmp(actual, v) <= 0;
        case "lt": return actual != null && cmp(actual, v) < 0;
        case "startsWith": return typeof actual === "string" && actual.startsWith(v);
        case "contains": return typeof actual === "string" && actual.includes(v);
        default: return false;
      }
    });
  }
  if (isPlain(cond)) return matches(actual, cond);
  return (actual ?? null) === (cond ?? null);
}

export function matches(row, where = {}) {
  if (!where) return true;
  if (!row) return false;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (Array.isArray(cond) ? cond : [cond]).every((w) => matches(row, w));
    if (key === "OR") return cond.some((w) => matches(row, w));
    if (key === "NOT") return !(Array.isArray(cond) ? cond : [cond]).some((w) => matches(row, w));
    const actual = row[key];
    if (Array.isArray(actual) && isPlain(cond) && ("some" in cond || "none" in cond || "every" in cond)) {
      if ("some" in cond) return actual.some((r) => matches(r, cond.some));
      if ("none" in cond) return !actual.some((r) => matches(r, cond.none));
      return actual.every((r) => matches(r, cond.every));
    }
    return matchValue(actual, cond);
  });
}

function sortRows(list, orderBy) {
  const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) => Object.entries(o));
  if (!keys.length) return list;
  return [...list].sort((a, b) => {
    for (const [k, dir] of keys) {
      const c = cmp(a[k], b[k]);
      if (c) return dir === "desc" ? -c : c;
    }
    return 0;
  });
}

const copy = (r) => (r ? structuredClone(r) : r);

function uniqueClash(model, data, exceptId = null) {
  if (model !== "jobSelection" || data.sourceKey == null) return false;
  return state.rows.jobSelection.some((r) => r.id !== exceptId && r.jobId === data.jobId && r.sourceKey === data.sourceKey);
}

function p2002() {
  const err = new Error("Unique constraint failed on the fields: (`jobId`,`sourceKey`)");
  err.code = "P2002";
  return err;
}

function delegate(model) {
  const table = () => state.rows[model];
  return {
    async findFirst({ where, orderBy } = {}) {
      return copy(sortRows(table().filter((r) => matches(r, where)), orderBy)[0] || null);
    },
    async findUnique({ where } = {}) {
      return copy(table().find((r) => matches(r, where)) || null);
    },
    async findMany({ where, orderBy } = {}) {
      return sortRows(table().filter((r) => matches(r, where)), orderBy).map(copy);
    },
    async count({ where } = {}) {
      return table().filter((r) => matches(r, where)).length;
    },
    async create({ data }) {
      if (uniqueClash(model, data)) throw p2002();
      const row = { id: `${model}_${++state.seq}`, createdAt: new Date(2026, 9, 10, 0, 0, state.seq), ...structuredClone(data) };
      if (model === "jobSelection") row.updatedAt = row.createdAt;
      if (model === "job") Object.assign(row, { visits: [], shifts: [], ...row });
      table().push(row);
      state.writes.push({ model, op: "create", data: copy(data), id: row.id });
      return copy(row);
    },
    async createMany({ data, skipDuplicates = false }) {
      let count = 0;
      for (const d of Array.isArray(data) ? data : [data]) {
        if (uniqueClash(model, d)) {
          if (skipDuplicates) continue;
          throw p2002();
        }
        const row = { id: `${model}_${++state.seq}`, createdAt: new Date(2026, 9, 10, 0, 0, state.seq), ...structuredClone(d) };
        table().push(row);
        count += 1;
      }
      state.writes.push({ model, op: "createMany", data: copy(data), count });
      return { count };
    },
    async update({ where, data }) {
      const row = table().find((r) => matches(r, where));
      if (!row) {
        const err = new Error("Record to update not found.");
        err.code = "P2025";
        throw err;
      }
      Object.assign(row, structuredClone(data));
      state.writes.push({ model, op: "update", where: copy(where), data: copy(data) });
      return copy(row);
    },
    async updateMany({ where, data }) {
      const hit = table().filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, structuredClone(data));
      state.writes.push({ model, op: "updateMany", where: copy(where), data: copy(data), count: hit.length });
      return { count: hit.length };
    },
    async deleteMany({ where }) {
      const keep = [];
      let count = 0;
      for (const r of table()) {
        if (matches(r, where)) count += 1;
        else keep.push(r);
      }
      state.rows[model] = keep;
      state.writes.push({ model, op: "deleteMany", where: copy(where), count });
      return { count };
    },
    async delete({ where }) {
      const res = await this.deleteMany({ where });
      if (!res.count) {
        const err = new Error("Record to delete does not exist.");
        err.code = "P2025";
        throw err;
      }
      return {};
    },
  };
}

const delegates = Object.fromEntries(MODELS.map((m) => [m, delegate(m)]));

export const db = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === "then") return undefined; // not a thenable
      if (prop === "$transaction") {
        return async (arg) => (typeof arg === "function" ? arg(db) : Promise.all(arg));
      }
      if (prop === "$queryRaw") return async () => [];
      if (typeof prop === "symbol") return undefined;
      if (delegates[prop]) return delegates[prop];
      throw new Error(`selectionsDb: model "${String(prop)}" is not scripted`);
    },
  },
);

export default db;
