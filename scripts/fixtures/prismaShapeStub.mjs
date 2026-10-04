// scripts/fixtures/prismaShapeStub.mjs
//
// A Prisma stand-in that PROJECTS — honours `select` and `include` the way
// the real client does — for scripts/check-role-access.mjs.
//
// ── Why not scripts/fixtures/dbStub.mjs ─────────────────────────────────────
//
// The shared stub hands back whole fixture rows whatever the query asked for.
// That is fine for "was this row written", and useless for the question the
// role-access check asks: "which FIELDS reach a crew member?". A route that
// keeps the price out with a narrow `select` would read as leaking it, and a
// route that leaks a relation through `include: { client: true }` would read
// the same as one that selected two columns. The answer to a field question
// has to come from a stub that answers the query the route actually wrote.
//
// ── Where the relations come from ───────────────────────────────────────────
//
// prisma/schema.prisma itself, parsed at load: a field whose type is another
// model is a relation (a list when it ends in []). Fixture rows carry their
// relations INLINE (a job row holds `client: {...}` and `visits: [...]`), and
// the projector walks them with the schema's types, so nested selects and
// relation filters (`visits: { some: { assignedToId } }` — the crew scope)
// run as they would against Postgres. A hand-written relation map would be a
// copy of the schema, and the copy is the one that rots.
//
// Unscripted delegates and methods THROW by name, the shared stub's rule: a
// check must never pass because a query silently answered nothing.
import { readFileSync } from "node:fs";

const SCHEMA = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

/** model (camelCase delegate name) → { field → { model, many } } for relations; scalars listed too. */
export const MODELS = (() => {
  const out = {};
  const blocks = SCHEMA.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  const names = new Set([...SCHEMA.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]));
  for (const [, name, body] of blocks) {
    const relations = {};
    const scalars = new Set();
    for (const raw of body.split("\n")) {
      const line = raw.replace(/\/\/.*$/, "").trim();
      if (!line || line.startsWith("@@")) continue;
      const m = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
      if (!m) continue;
      const [, field, type, list] = m;
      if (names.has(type)) relations[field] = { model: lcFirst(type), many: Boolean(list) };
      else scalars.add(field);
    }
    out[lcFirst(name)] = { relations, scalars };
  }
  return out;
})();

function lcFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Fixture rows per delegate. A check assigns these. */
export const tables = {};
/** Every write attempted: { model, action, args }. */
export const writes = [];
/** Every read attempted: { model, action, args }. */
export const reads = [];

export function resetShapeStub() {
  for (const k of Object.keys(tables)) delete tables[k];
  writes.length = 0;
  reads.length = 0;
}

const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

function cmp(a, b) {
  if (a == null || b == null) return null;
  const x = a instanceof Date ? a.getTime() : typeof a === "string" && isNaN(Number(a)) ? Date.parse(a) : Number(a);
  const y = b instanceof Date ? b.getTime() : typeof b === "string" && isNaN(Number(b)) ? Date.parse(b) : Number(b);
  return Number.isFinite(x) && Number.isFinite(y) ? x - y : null;
}

function scalarMatches(actual, cond) {
  if (cond === null) return actual === null || actual === undefined;
  if (!isPlain(cond)) {
    if (Array.isArray(actual)) return false;
    return actual === cond || (actual instanceof Date && cond instanceof Date && actual.getTime() === cond.getTime());
  }
  const insensitive = cond.mode === "insensitive";
  const norm = (v) => (insensitive && typeof v === "string" ? v.toLowerCase() : v);
  for (const [op, v] of Object.entries(cond)) {
    if (op === "mode") continue;
    if (op === "equals" && norm(actual) !== norm(v)) return false;
    if (op === "in" && !v.includes(actual)) return false;
    if (op === "notIn" && (actual == null || v.includes(actual))) return false;
    if (op === "not") {
      if (v === null ? actual == null : isPlain(v) ? scalarMatches(actual, v) : actual === v) return false;
    }
    if (op === "contains" && !(typeof actual === "string" && norm(actual).includes(norm(v)))) return false;
    if (op === "startsWith" && !(typeof actual === "string" && norm(actual).startsWith(norm(v)))) return false;
    if (op === "endsWith" && !(typeof actual === "string" && norm(actual).endsWith(norm(v)))) return false;
    if (op === "has" && !(Array.isArray(actual) && actual.includes(v))) return false;
    if (op === "hasSome" && !(Array.isArray(actual) && v.some((x) => actual.includes(x)))) return false;
    if (["lt", "lte", "gt", "gte"].includes(op)) {
      const d = cmp(actual, v);
      if (d === null) return false;
      if (op === "lt" && !(d < 0)) return false;
      if (op === "lte" && !(d <= 0)) return false;
      if (op === "gt" && !(d > 0)) return false;
      if (op === "gte" && !(d >= 0)) return false;
    }
  }
  return true;
}

export function matches(model, row, where) {
  if (!where) return true;
  const rel = MODELS[model]?.relations || {};
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      const list = Array.isArray(cond) ? cond : [cond];
      if (!list.every((w) => matches(model, row, w))) return false;
      continue;
    }
    if (key === "OR") {
      if (!cond.some((w) => matches(model, row, w))) return false;
      continue;
    }
    if (key === "NOT") {
      const list = Array.isArray(cond) ? cond : [cond];
      if (list.some((w) => matches(model, row, w))) return false;
      continue;
    }
    if (rel[key]) {
      const r = rel[key];
      const v = row[key];
      if (r.many) {
        const arr = Array.isArray(v) ? v : [];
        if (cond.some && !arr.some((x) => matches(r.model, x, cond.some))) return false;
        if (cond.none && arr.some((x) => matches(r.model, x, cond.none))) return false;
        if (cond.every && !arr.every((x) => matches(r.model, x, cond.every))) return false;
      } else {
        if (cond === null) {
          if (v != null) return false;
        } else if ("is" in cond || "isNot" in cond) {
          if ("is" in cond && (cond.is === null ? v != null : !(v && matches(r.model, v, cond.is)))) return false;
          if ("isNot" in cond && (cond.isNot === null ? v == null : v && matches(r.model, v, cond.isNot))) return false;
        } else if (!(v && matches(r.model, v, cond))) return false;
      }
      continue;
    }
    // Compound unique: { userId_companyId: { userId, companyId } }.
    if (isPlain(cond) && key.includes("_") && !(key in row) && Object.keys(cond).every((k) => k in row || true) &&
      !Object.keys(cond).some((k) => ["equals", "in", "not", "lt", "gt", "lte", "gte", "contains"].includes(k))) {
      if (!matches(model, row, cond)) return false;
      continue;
    }
    if (!scalarMatches(row[key], cond)) return false;
  }
  return true;
}

function order(list, orderBy) {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!orders.length) return list;
  return [...list].sort((a, b) => {
    for (const o of orders) {
      const [k, dirRaw] = Object.entries(o)[0] || [];
      if (!k || isPlain(dirRaw)) continue;
      const d = cmp(a[k], b[k]);
      if (d === null || d === 0) {
        if (a[k] === b[k]) continue;
        const c = String(a[k]) < String(b[k]) ? -1 : 1;
        return dirRaw === "desc" ? -c : c;
      }
      return dirRaw === "desc" ? -d : d;
    }
    return 0;
  });
}

function windowList(model, list, args = {}) {
  let out = list.filter((r) => matches(model, r, args.where));
  out = order(out, args.orderBy);
  if (Number.isFinite(args.skip)) out = out.slice(args.skip);
  if (Number.isFinite(args.take)) out = out.slice(0, args.take);
  return out;
}

/** Project one row the way Prisma would for these args. */
export function project(model, row, args = {}) {
  if (!row) return row ?? null;
  const meta = MODELS[model] || { relations: {}, scalars: new Set() };
  const out = {};
  const relationValue = (field, sub) => {
    const r = meta.relations[field];
    const v = row[field];
    const subArgs = sub === true ? {} : sub || {};
    if (r.many) {
      const list = windowList(r.model, Array.isArray(v) ? v : [], subArgs);
      return list.map((x) => project(r.model, x, subArgs));
    }
    if (v == null) return null;
    return project(r.model, v, subArgs);
  };
  const countValue = (sub) => {
    const sel = sub === true ? null : sub?.select;
    const c = {};
    for (const [field, r] of Object.entries(meta.relations)) {
      if (!r.many) continue;
      if (sel && !sel[field]) continue;
      const arr = Array.isArray(row[field]) ? row[field] : [];
      const w = sel && isPlain(sel[field]) ? sel[field].where : null;
      c[field] = arr.filter((x) => matches(r.model, x, w)).length;
    }
    return c;
  };
  if (args.select) {
    for (const [field, sub] of Object.entries(args.select)) {
      if (!sub) continue;
      if (field === "_count") out._count = countValue(sub);
      else if (meta.relations[field]) out[field] = relationValue(field, sub);
      else out[field] = row[field] === undefined ? null : row[field];
    }
    return out;
  }
  for (const [k, v] of Object.entries(row)) {
    if (meta.relations[k] || k.startsWith("_")) continue;
    out[k] = v;
  }
  for (const [field, sub] of Object.entries(args.include || {})) {
    if (!sub) continue;
    if (field === "_count") out._count = countValue(sub);
    else if (meta.relations[field]) out[field] = relationValue(field, sub);
  }
  return out;
}

function delegate(model) {
  const rowsOf = () => {
    if (!tables[model]) throw new Error(`prismaShapeStub: no fixture table for db.${model} — script it (even as []).`);
    return tables[model];
  };
  const find = (args = {}) => windowList(model, rowsOf(), args);
  const api = {
    async findFirst(args = {}) {
      reads.push({ model, action: "findFirst", args });
      const [hit] = find({ ...args, take: 1 });
      return hit ? project(model, hit, args) : null;
    },
    async findUnique(args = {}) {
      reads.push({ model, action: "findUnique", args });
      const [hit] = find(args);
      return hit ? project(model, hit, args) : null;
    },
    async findMany(args = {}) {
      reads.push({ model, action: "findMany", args });
      return find(args).map((r) => project(model, r, args));
    },
    async count(args = {}) {
      reads.push({ model, action: "count", args });
      return find({ where: args.where }).length;
    },
    async aggregate(args = {}) {
      reads.push({ model, action: "aggregate", args });
      const list = find({ where: args.where });
      const out = {};
      if (args._sum) {
        out._sum = {};
        for (const f of Object.keys(args._sum)) out._sum[f] = list.length ? list.reduce((s, r) => s + Number(r[f] || 0), 0) : null;
      }
      if (args._count) out._count = list.length;
      return out;
    },
    // One row per distinct `by` tuple, with _sum / _count over its rows — the
    // shape GET /api/leave's accrual records read (check:role-access §11).
    async groupBy(args = {}) {
      reads.push({ model, action: "groupBy", args });
      const by = Array.isArray(args.by) ? args.by : [args.by];
      const groups = new Map();
      for (const r of find({ where: args.where })) {
        const k = JSON.stringify(by.map((f) => r[f] ?? null));
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      return [...groups.values()].map((rows) => {
        const out = Object.fromEntries(by.map((f) => [f, rows[0][f] ?? null]));
        if (args._sum) out._sum = Object.fromEntries(Object.keys(args._sum).map((f) => [f, rows.reduce((s, r) => s + Number(r[f] || 0), 0)]));
        if (args._count) out._count = typeof args._count === "object" ? Object.fromEntries(Object.keys(args._count).map((f) => [f, rows.length])) : rows.length;
        return out;
      });
    },
  };
  for (const action of ["findUniqueOrThrow", "findFirstOrThrow"]) {
    api[action] = async (args) => {
      const hit = await api[action.replace("OrThrow", "")](args);
      if (!hit) throw Object.assign(new Error("Not found"), { code: "P2025" });
      return hit;
    };
  }
  for (const action of ["create", "update", "upsert", "delete", "updateMany", "deleteMany", "createMany"]) {
    api[action] = async (args = {}) => {
      writes.push({ model, action, args });
      if (action === "updateMany" || action === "deleteMany" || action === "createMany") return { count: 0 };
      if (action === "create") return project(model, { id: `new_${model}_${writes.length}`, ...(args.data || {}) }, args);
      const [hit] = find({ where: args.where });
      if (!hit && action !== "upsert") throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
      return project(model, { ...(hit || {}), ...(action === "upsert" ? (hit ? args.update : args.create) : args.data || {}) }, args);
    };
  }
  return new Proxy(api, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol" || prop === "then") return undefined;
      throw new Error(`prismaShapeStub: db.${model}.${String(prop)} is not scripted`);
    },
  });
}

const delegates = {};
export const db = new Proxy(
  {
    async $transaction(arg) {
      if (typeof arg === "function") return arg(db);
      return Promise.all(arg);
    },
    async $queryRaw() {
      return [];
    },
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol" || prop === "then") return undefined;
      if (!MODELS[prop]) throw new Error(`prismaShapeStub: db.${String(prop)} is not a model in prisma/schema.prisma`);
      delegates[prop] ||= delegate(prop);
      return delegates[prop];
    },
  },
);

export default db;
export const prisma = db;
