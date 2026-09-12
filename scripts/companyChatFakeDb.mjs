// scripts/companyChatFakeDb.mjs
//
// An in-memory stand-in for the Prisma delegates lib/company/chat/store.js
// touches, so scripts/check-company-chat.mjs can EXECUTE the tenant boundary
// and the membership rule rather than grep for them.
//
// Just enough Prisma, and modelled honestly where it matters:
//
//   * where — flat equality, null, { in }, { not }, relation `some`, NOT,
//     OR/AND; compound-unique wrappers ({ companyId_key: {…} }) are flattened
//     the way scripts/fixtures/dbStub.mjs flattens them.
//   * select / include — to-one and to-many relations, with nested select,
//     orderBy and take, because the store loads a room with its members and
//     its last 200 messages in one call and a fake that could not follow the
//     relation would make that call untestable.
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
// createdAt and a row is never stamped BEFORE a `new Date()` the store took
// a moment earlier. "Unread is what was written after lastSeenAt" is a
// comparison a same-millisecond tie breaks in a direction Postgres's
// microsecond timestamps never would — and a synthetic clock that ran ahead
// of real time broke it the other way, against the store's own real-time
// lastSeenAt. Real time, spaced out, is the only clock both sides share.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Relations, per table: name → { table, kind, localKey | foreignKey }. */
const RELATIONS = {
  member: {
    user: { table: "user", kind: "one", localKey: "userId" },
  },
  job: {
    visits: { table: "jobVisit", kind: "many", foreignKey: "jobId" },
  },
  companyChatRoom: {
    job: { table: "job", kind: "one", localKey: "jobId" },
    members: { table: "companyChatMember", kind: "many", foreignKey: "roomId" },
    messages: { table: "companyChatMessage", kind: "many", foreignKey: "roomId" },
  },
  companyChatMember: {
    member: { table: "member", kind: "one", localKey: "memberId" },
    room: { table: "companyChatRoom", kind: "one", localKey: "roomId" },
  },
  companyChatMessage: {
    author: { table: "member", kind: "one", localKey: "authorMemberId" },
  },
};

const UNIQUES = {
  companyChatRoom: [["companyId", "key"], ["jobId"]],
  companyChatMember: [["roomId", "memberId"]],
  member: [["userId", "companyId"]],
};

function flatten(where = {}) {
  const out = {};
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && k.includes("_") && !RELATIONS_ANY.has(k)) {
      Object.assign(out, v);
    } else out[k] = v;
  }
  return out;
}
const RELATIONS_ANY = new Set(Object.values(RELATIONS).flatMap((r) => Object.keys(r)));

export function fakeDb(seed = {}) {
  const tables = {
    company: [],
    user: [],
    member: [],
    job: [],
    jobVisit: [],
    companyChatRoom: [],
    companyChatMember: [],
    companyChatMessage: [],
    pushSubscription: [],
  };
  for (const [k, rows] of Object.entries(seed)) {
    if (!tables[k]) throw new Error(`fake db: no table ${k}`);
    tables[k].push(...rows.map((r) => ({ ...r })));
  }

  function matches(table, row, where) {
    for (const [k, v] of Object.entries(flatten(where))) {
      if (k === "OR") { if (!v.some((w) => matches(table, row, w))) return false; continue; }
      if (k === "AND") { if (!v.every((w) => matches(table, row, w))) return false; continue; }
      if (k === "NOT") { if (matches(table, row, v)) return false; continue; }
      const rel = RELATIONS[table]?.[k];
      if (rel) {
        if (rel.kind !== "many" || !v || typeof v.some !== "object") throw new Error(`fake db: unsupported relation filter on ${table}.${k}`);
        const related = tables[rel.table].filter((r) => r[rel.foreignKey] === row.id);
        if (!related.some((r) => matches(rel.table, r, v.some))) return false;
        continue;
      }
      if (v === null) { if (row[k] !== null && row[k] !== undefined) return false; continue; }
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) { if (!v.in.includes(row[k])) return false; continue; }
        if ("not" in v) { if (row[k] === v.not) return false; continue; }
        if ("gt" in v) { if (!(new Date(row[k]) > new Date(v.gt))) return false; continue; }
        throw new Error(`fake db: unsupported where on ${table}.${k}: ${JSON.stringify(v)}`);
      }
      if (v instanceof Date) { if (new Date(row[k]).getTime() !== v.getTime()) return false; continue; }
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
      const rel = RELATIONS[table]?.[k];
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
    for (const u of UNIQUES[table] || []) {
      if (!u.every((k) => row[k] != null)) continue;
      if (tables[table].some((r) => r.id !== ignoreId && u.every((k) => r[k] === row[k]))) {
        const err = new Error(`Unique constraint failed on ${table}(${u.join(",")})`);
        err.code = "P2002";
        throw err;
      }
    }
  }

  const defaults = {
    companyChatMember: { open: true, lastSeenAt: null, removedAt: null },
    companyChatMessage: { kind: "message", mentions: [], meta: null },
    companyChatRoom: { name: null, jobId: null, lastMessageAt: null },
  };

  function insert(table, data) {
    const row = { id: nextId(table.slice(0, 3)), createdAt: new Date(), ...(defaults[table] || {}) };
    for (const [k, v] of Object.entries(data)) {
      const rel = RELATIONS[table]?.[k];
      if (rel && v && typeof v === "object" && "create" in v) continue; // nested, below
      row[k] = v;
    }
    assertUnique(table, row);
    tables[table].push(row);
    for (const [k, v] of Object.entries(data)) {
      const rel = RELATIONS[table]?.[k];
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
      throw new Error(`fake db: db.${String(prop)} is not modelled — add it to scripts/companyChatFakeDb.mjs`);
    },
  });
}
