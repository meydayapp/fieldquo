// scripts/fakePrisma.mjs
//
// The in-memory Prisma stand-in behind scripts/companyChatFakeDb.mjs and
// scripts/staffChatFakeDb.mjs, so the two chat checks can EXECUTE the
// stores — the tenant boundary, the membership rule, and now the unread
// count as a query — rather than grep for them.
//
// It was the company fake's own engine; the staff fake had a smaller one
// of its own that knew no relations, no orderBy and no groupBy, which was
// enough while the staff check only drove lib/staff/teams.js and is not
// enough to drive lib/staff/store.js. One engine, two table maps, rather
// than a second copy that would be the one nobody looks at.
//
// Just enough Prisma, and modelled honestly where it matters:
//
//   * where — flat equality, null, { in }, { not }, { gt, gte, lt, lte } on
//     dates and numbers, { has } on a scalar list, relation `some`, NOT,
//     OR/AND; compound-unique wrappers ({ companyId_key: {…} }) are
//     flattened the way scripts/fixtures/dbStub.mjs flattens them.
//   * select / include — to-one and to-many relations, with nested select,
//     where, orderBy and take, because a store loads a room with its
//     members and its last message in one call and a fake that could not
//     follow the relation would make that call untestable.
//   * groupBy — `by` one column, `where`, `_count: { _all }`, the shape
//     lib/chat/unreadQuery.js builds; the two stores count unread with it.
//   * uniques — a second row on a declared unique throws P2002, the way
//     Postgres would, because openDirect's race handling is a catch of
//     exactly that and a fake that never threw would let a broken catch pass.
//   * $transaction — the array form awaits already-started promises. It does
//     NOT roll back, and a check must not read a passing run as proof of
//     atomicity; what it can prove is that the writes happened, in order.
//
// Deliberately not a general mock: every unsupported shape throws by name, so
// a test that reaches for something this does not model fails loudly instead
// of passing on an undefined.
let seq = 0;
const nextId = (p) => `${p}${++seq}`;

// Every insert waits two milliseconds first, so no two rows share a
// timestamp and a row is never stamped BEFORE a `new Date()` the store took
// a moment earlier. "Unread is what was written after lastSeenAt" is a
// comparison a same-millisecond tie breaks in a direction Postgres's
// microsecond timestamps never would — and a synthetic clock that ran ahead
// of real time broke it the other way, against the store's own real-time
// lastSeenAt. Real time, spaced out, is the only clock both sides share.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const asTime = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : v == null ? NaN : new Date(v).getTime());

/**
 * @param tables     { name: [] } — every table the stores under test touch
 * @param relations  { table: { field: { table, kind: "one"|"many", localKey | foreignKey } } }
 * @param uniques    { table: [[col, col], …] }
 * @param defaults   { table: object | () => object } — columns a create fills in
 * @param idPrefix   { table: "abc" } — for readable ids; defaults to the
 *                   first three letters of the table name
 */
export function makeFakeDb({ tables: names, relations = {}, uniques = {}, defaults = {}, idPrefix = {} }, seed = {}) {
  const tables = Object.fromEntries(names.map((n) => [n, []]));
  const defaultsFor = (table) => {
    const d = defaults[table];
    return typeof d === "function" ? d() : d || {};
  };
  // A seeded row is an EXISTING row, and an existing row has the column
  // defaults Postgres gave it on insert — a membership seeded without
  // `open` is open, the way one created through the store is.
  for (const [k, rows] of Object.entries(seed)) {
    if (!tables[k]) throw new Error(`fake db: no table ${k}`);
    tables[k].push(...rows.map((r) => ({ ...defaultsFor(k), ...r })));
  }
  const relationNames = new Set(Object.values(relations).flatMap((r) => Object.keys(r)));

  function flatten(where = {}) {
    const out = {};
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && k.includes("_") && !relationNames.has(k)) {
        Object.assign(out, v);
      } else out[k] = v;
    }
    return out;
  }

  function matches(table, row, where) {
    for (const [k, v] of Object.entries(flatten(where))) {
      if (k === "OR") { if (!v.some((w) => matches(table, row, w))) return false; continue; }
      if (k === "AND") { if (!v.every((w) => matches(table, row, w))) return false; continue; }
      if (k === "NOT") { if (matches(table, row, v)) return false; continue; }
      const rel = relations[table]?.[k];
      if (rel) {
        if (rel.kind !== "many" || !v || typeof v.some !== "object") throw new Error(`fake db: unsupported relation filter on ${table}.${k}`);
        const related = tables[rel.table].filter((r) => r[rel.foreignKey] === row.id);
        if (!related.some((r) => matches(rel.table, r, v.some))) return false;
        continue;
      }
      if (v === null) { if (row[k] !== null && row[k] !== undefined) return false; continue; }
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) { if (!v.in.includes(row[k])) return false; continue; }
        // SQL's `<> x` is false for NULL; Prisma's `not` is the same. A store
        // that wants "null or not x" says so with an OR, as both stores do.
        if ("not" in v) { if (row[k] == null || row[k] === v.not) return false; continue; }
        if ("has" in v) { if (!Array.isArray(row[k]) || !row[k].includes(v.has)) return false; continue; }
        let ok = true;
        let ranged = false;
        for (const op of ["gt", "gte", "lt", "lte"]) {
          if (!(op in v)) continue;
          ranged = true;
          const a = asTime(row[k]);
          const b = asTime(v[op]);
          if (Number.isNaN(a) || Number.isNaN(b)) { ok = false; break; }
          if (op === "gt" && !(a > b)) ok = false;
          if (op === "gte" && !(a >= b)) ok = false;
          if (op === "lt" && !(a < b)) ok = false;
          if (op === "lte" && !(a <= b)) ok = false;
        }
        if (ranged) { if (!ok) return false; continue; }
        throw new Error(`fake db: unsupported where on ${table}.${k}: ${JSON.stringify(v)}`);
      }
      if (v instanceof Date) { if (asTime(row[k]) !== v.getTime()) return false; continue; }
      if ((row[k] ?? null) !== (v ?? null)) return false;
    }
    return true;
  }

  function sortBy(rows, orderBy) {
    if (!orderBy) return rows;
    const list = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const o of list) {
        const [k, dir] = Object.entries(o)[0];
        const av = a[k] instanceof Date ? a[k].getTime() : a[k] ?? "";
        const bv = b[k] instanceof Date ? b[k].getTime() : b[k] ?? "";
        if (av < bv) return dir === "desc" ? 1 : -1;
        if (av > bv) return dir === "desc" ? -1 : 1;
      }
      return 0;
    });
  }

  /** Shape one row by select/include, following relations. */
  function shape(table, row, { select, include } = {}) {
    if (!row) return null;
    const out = select ? {} : { ...row };
    const spec = select || include || {};
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      const rel = relations[table]?.[k];
      if (!rel) { if (select) out[k] = row[k] ?? null; continue; }
      const args = typeof v === "object" ? v : {};
      if (rel.kind === "one") {
        const target = tables[rel.table].find((r) => r.id === row[rel.localKey]) || null;
        out[k] = shape(rel.table, target, args);
      } else {
        let rows = tables[rel.table].filter((r) => r[rel.foreignKey] === row.id);
        if (args.where) rows = rows.filter((r) => matches(rel.table, r, args.where));
        rows = sortBy(rows, args.orderBy);
        if (args.take) rows = rows.slice(0, args.take);
        out[k] = rows.map((r) => shape(rel.table, r, args));
      }
    }
    return out;
  }

  function assertUnique(table, row, ignoreId = null) {
    for (const u of uniques[table] || []) {
      if (!u.every((k) => row[k] != null)) continue;
      if (tables[table].some((r) => r.id !== ignoreId && u.every((k) => r[k] === row[k]))) {
        const err = new Error(`Unique constraint failed on ${table}(${u.join(",")})`);
        err.code = "P2002";
        throw err;
      }
    }
  }

  function insert(table, data) {
    const row = { id: nextId(idPrefix[table] || table.slice(0, 3)), createdAt: new Date(), ...defaultsFor(table) };
    for (const [k, v] of Object.entries(data)) {
      const rel = relations[table]?.[k];
      if (rel && v && typeof v === "object" && "create" in v) continue; // nested, below
      row[k] = v;
    }
    assertUnique(table, row);
    tables[table].push(row);
    for (const [k, v] of Object.entries(data)) {
      const rel = relations[table]?.[k];
      if (rel && v && typeof v === "object" && "create" in v) {
        const list = Array.isArray(v.create) ? v.create : [v.create];
        for (const child of list) insert(rel.table, { ...child, [rel.foreignKey]: row.id });
      }
    }
    return row;
  }

  function delegate(table) {
    const find = (where) => tables[table].find((r) => matches(table, r, where)) || null;
    return {
      findUnique: async ({ where, select, include } = {}) => shape(table, find(where), { select, include }),
      findFirst: async ({ where, select, include, orderBy } = {}) => {
        const rows = sortBy(tables[table].filter((r) => matches(table, r, where || {})), orderBy);
        return shape(table, rows[0] || null, { select, include });
      },
      findMany: async ({ where, select, include, orderBy, take } = {}) => {
        let rows = sortBy(tables[table].filter((r) => matches(table, r, where || {})), orderBy);
        if (take) rows = rows.slice(0, take);
        return rows.map((r) => shape(table, r, { select, include }));
      },
      count: async ({ where } = {}) => tables[table].filter((r) => matches(table, r, where || {})).length,
      groupBy: async ({ by, where, _count } = {}) => {
        if (!Array.isArray(by) || by.length !== 1) throw new Error(`fake db: groupBy on ${table} models one column, got ${JSON.stringify(by)}`);
        if (!_count || _count._all !== true) throw new Error(`fake db: groupBy on ${table} models _count: { _all: true } only`);
        const [col] = by;
        const counts = new Map();
        for (const r of tables[table]) {
          if (!matches(table, r, where || {})) continue;
          counts.set(r[col], (counts.get(r[col]) || 0) + 1);
        }
        return [...counts].map(([k, n]) => ({ [col]: k, _count: { _all: n } }));
      },
      create: async ({ data, select, include }) => {
        await sleep(2);
        return shape(table, insert(table, data), { select, include });
      },
      update: async ({ where, data, select, include }) => {
        const row = find(where);
        if (!row) throw new Error(`fake db: ${table}.update of a row that is not there: ${JSON.stringify(where)}`);
        const next = { ...row, ...data };
        assertUnique(table, next, row.id);
        Object.assign(row, data);
        return shape(table, row, { select, include });
      },
      updateMany: async ({ where, data }) => {
        const hits = tables[table].filter((r) => matches(table, r, where || {}));
        for (const r of hits) Object.assign(r, data);
        return { count: hits.length };
      },
      upsert: async ({ where, update, create, select, include }) => {
        const row = find(where);
        if (row) {
          for (const [k, v] of Object.entries(update || {})) if (v !== undefined) row[k] = v;
          return shape(table, row, { select, include });
        }
        await sleep(2);
        return shape(table, insert(table, create), { select, include });
      },
      _rows: tables[table],
    };
  }

  const db = {};
  for (const name of Object.keys(tables)) db[name] = delegate(name);
  db.$transaction = async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(db));
  db.tables = tables;
  return new Proxy(db, {
    get(target, prop) {
      if (prop in target || typeof prop === "symbol") return target[prop];
      throw new Error(`fake db: db.${String(prop)} is not modelled — add it to the table map that built this fake`);
    },
  });
}
