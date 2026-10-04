// scripts/fixtures/countingFakeDb.mjs
//
// An in-memory Prisma stand-in that ANSWERS a where clause instead of
// returning a scripted number — for scripts/check-historical-rows.mjs, whose
// whole subject is which rows a count admits.
//
// The other fakes don't fit: scripts/fixtures/dbStub.mjs returns on the first
// comparison operator it meets, so `{ gte, lt }` is tested on `lt` alone and
// a month window admits every earlier row; scripts/fakePrisma.mjs has no
// aggregate and no to-one relation filter. A check about "is this row inside
// the month, and is it an import" cannot run on either without reading a
// pass into a stub's blind spot.
//
// Just enough Prisma, and every unmodelled shape THROWS by name:
//
//   * where — equality, null (unset counts as null, as an unwritten nullable
//     column does in Postgres), { in, notIn, not, gt, gte, lt, lte }, OR /
//     AND / NOT, and a to-one relation filter through `relations`
//     ({ quoteScopeGroup: { quote: ["quote", "quoteId"] } }).
//   * count, findMany, findFirst, findUnique (no select projection — the
//     whole row comes back, plus any `include`d to-one relation), and
//     aggregate with _sum / _avg / _min / _max / _count.
//   * a model with no seeded table is EMPTY rather than an error, so a loader
//     that reads twenty models can run with the three the check cares about.
//   * writes are recorded and refused — every function under test is a read.

const OPS = new Set(["in", "notIn", "not", "gt", "gte", "lt", "lte"]);
const time = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : v == null ? NaN : new Date(v).getTime());
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

export function countingFakeDb(seed = {}, { relations = {} } = {}) {
  const tables = {};
  for (const [k, rows] of Object.entries(seed)) tables[k] = rows.map((r) => ({ ...r }));
  const calls = [];
  const writes = [];
  const rowsOf = (model) => tables[model] || [];

  function related(model, row, field) {
    const rel = relations[model]?.[field];
    if (!rel) return undefined;
    const [target, key] = rel;
    return rowsOf(target).find((r) => r.id === row[key]) || null;
  }

  function cmp(model, field, value, ops) {
    for (const [op, arg] of Object.entries(ops)) {
      if (!OPS.has(op)) throw new Error(`countingFakeDb: unsupported operator ${model}.${field}.${op}`);
      if (op === "in") { if (!arg.includes(value)) return false; continue; }
      if (op === "notIn") { if (value == null || arg.includes(value)) return false; continue; }
      if (op === "not") {
        if (arg === null) { if (value == null) return false; continue; }
        if (value == null || value === arg) return false;
        continue;
      }
      const a = time(value);
      const b = time(arg);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (op === "gt" && !(a > b)) return false;
      if (op === "gte" && !(a >= b)) return false;
      if (op === "lt" && !(a < b)) return false;
      if (op === "lte" && !(a <= b)) return false;
    }
    return true;
  }

  function matches(model, row, where = {}) {
    for (const [k, v] of Object.entries(where || {})) {
      if (v === undefined) continue;
      if (k === "OR") { if (!v.some((w) => matches(model, row, w))) return false; continue; }
      if (k === "AND") { if (!(Array.isArray(v) ? v : [v]).every((w) => matches(model, row, w))) return false; continue; }
      if (k === "NOT") { if ((Array.isArray(v) ? v : [v]).some((w) => matches(model, row, w))) return false; continue; }
      const rel = relations[model]?.[k];
      if (rel) {
        const target = related(model, row, k);
        if (!target || !matches(rel[0], target, v)) return false;
        continue;
      }
      if (v === null) { if (row[k] !== null && row[k] !== undefined) return false; continue; }
      if (v instanceof Date) { if (time(row[k]) !== v.getTime()) return false; continue; }
      if (isPlain(v)) {
        if (!Object.keys(v).every((op) => OPS.has(op))) {
          throw new Error(`countingFakeDb: unsupported where on ${model}.${k}: ${JSON.stringify(v)}`);
        }
        if (!cmp(model, k, row[k], v)) return false;
        continue;
      }
      if ((row[k] ?? null) !== v) return false;
    }
    return true;
  }

  const shape = (model, row, include) => {
    if (!row) return null;
    const out = { ...row };
    for (const [k, v] of Object.entries(include || {})) {
      if (!v) continue;
      const target = related(model, row, k);
      if (target !== undefined) out[k] = target;
    }
    return out;
  };

  const num = (v) => (v == null ? null : Number(v));

  function aggregate(model, args = {}) {
    const hits = rowsOf(model).filter((r) => matches(model, r, args.where));
    const out = {};
    const over = (spec, fn) => {
      const res = {};
      for (const col of Object.keys(spec || {})) {
        const vals = hits.map((r) => num(r[col])).filter((n) => n !== null && Number.isFinite(n));
        res[col] = vals.length ? fn(vals) : null;
      }
      return res;
    };
    if (args._sum) out._sum = over(args._sum, (v) => v.reduce((s, n) => s + n, 0));
    if (args._avg) out._avg = over(args._avg, (v) => v.reduce((s, n) => s + n, 0) / v.length);
    if (args._min) out._min = over(args._min, (v) => Math.min(...v));
    if (args._max) out._max = over(args._max, (v) => Math.max(...v));
    if (args._count === true) out._count = hits.length;
    else if (isPlain(args._count)) out._count = { _all: hits.length };
    return out;
  }

  const delegate = (model) =>
    new Proxy(
      {},
      {
        get(_, method) {
          return async (args = {}) => {
            calls.push({ model, method: String(method), args });
            const where = args.where;
            switch (method) {
              case "count":
                return rowsOf(model).filter((r) => matches(model, r, where)).length;
              case "findMany": {
                let rows = rowsOf(model).filter((r) => matches(model, r, where));
                if (args.take) rows = rows.slice(0, args.take);
                return rows.map((r) => shape(model, r, args.include));
              }
              case "findFirst":
              case "findUnique":
                return shape(model, rowsOf(model).find((r) => matches(model, r, where)) || null, args.include);
              case "aggregate":
                return aggregate(model, args);
              default:
                if (/^(create|update|upsert|delete)/.test(String(method))) {
                  writes.push({ model, method: String(method) });
                  throw new Error(`countingFakeDb: ${model}.${String(method)} — the code under test must not write`);
                }
                throw new Error(`countingFakeDb: ${model}.${String(method)} is not modelled`);
            }
          };
        },
      },
    );

  const db = new Proxy({}, { get: (_, model) => (model === "then" ? undefined : delegate(String(model))) });
  return { db, calls, writes, tables };
}
