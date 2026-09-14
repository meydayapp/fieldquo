// scripts/auditFakeDb.mjs
//
// An in-memory stand-in for the Prisma delegates lib/staff/audit.js and
// lib/sales/conversationAudit.js touch, so scripts/check-staff-chat.mjs and
// scripts/check-platform-conversation-audit.mjs can EXECUTE the audit write
// path — "every open writes the row and the line, never a membership" —
// rather than grep for it.
//
// Just enough Prisma, and deliberately no more (the same discipline as
// staffChatFakeDb.mjs): findUnique/findFirst/findMany with flat equality,
// `in`, `lt`, `OR`, `AND`, and JSON `{ path, equals }`; `select` and
// `include` over the handful of relations these two files read (a room's
// members and message count, a row's admin/rep/author/lead); `orderBy`
// (one or several, with `sort`/`nulls`), `take`, `create`, and
// `$transaction` over already-built promises. Every unsupported shape throws
// so a test that reaches for something this does not model fails loudly.
let seq = 0;
const nextId = (p) => `${p}${++seq}`;

/** Relations, by table then field: which table a relation reads and how. */
const RELATIONS = {
  staffRoom: {
    members: { table: "staffRoomMember", many: true, on: (room, m) => m.roomId === room.id },
    messages: { table: "staffMessage", many: true, on: (room, m) => m.roomId === room.id },
    _count: { count: { messages: (db, room) => db.staffMessage.filter((m) => m.roomId === room.id).length } },
  },
  staffRoomMember: {
    platformAdmin: { table: "platformAdmin", on: (row, a) => a.id === row.platformAdminId },
    salesRep: { table: "salesRep", on: (row, r) => r.id === row.salesRepId },
  },
  staffMessage: {
    authorPlatformAdmin: { table: "platformAdmin", on: (row, a) => a.id === row.authorPlatformAdminId },
    authorSalesRep: { table: "salesRep", on: (row, r) => r.id === row.authorSalesRepId },
  },
  salesSmsMessage: {
    lead: { table: "salesLead", on: (row, l) => l.id === row.leadId },
  },
  salesThread: {
    salesRep: { table: "salesRep", on: (row, r) => r.id === row.salesRepId },
    lead: { table: "salesLead", on: (row, l) => l.id === row.leadId },
    messages: { table: "salesMessage", many: true, on: (t, m) => m.threadId === t.id },
  },
  platformAuditLog: {
    platformAdmin: { table: "platformAdmin", on: (row, a) => a.id === row.platformAdminId },
  },
};

function valueAt(row, path) {
  let v = row;
  for (const k of path) v = v == null ? undefined : v[k];
  return v;
}

function matches(row, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (k === "OR") {
      if (!v.some((w) => matches(row, w))) return false;
      continue;
    }
    if (k === "AND") {
      if (!v.every((w) => matches(row, w))) return false;
      continue;
    }
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if (Array.isArray(v.in)) {
        if (!v.in.includes(row[k])) return false;
        continue;
      }
      if (v.lt instanceof Date) {
        const at = row[k] ? new Date(row[k]).getTime() : NaN;
        if (!(at < v.lt.getTime())) return false;
        continue;
      }
      if (Array.isArray(v.path)) {
        if (valueAt(row[k], v.path) !== v.equals) return false;
        continue;
      }
      throw new Error(`audit fake db: unsupported where on ${k}: ${JSON.stringify(v)}`);
    }
    if ((row[k] ?? null) !== (v ?? null)) return false;
  }
  return true;
}

function sorter(orderBy) {
  const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return (a, b) => {
    for (const o of list) {
      const [field, spec] = Object.entries(o)[0];
      const dir = typeof spec === "string" ? spec : spec.sort;
      const nulls = typeof spec === "object" ? spec.nulls : null;
      const av = a[field] ?? null;
      const bv = b[field] ?? null;
      if (av === null && bv === null) continue;
      if (av === null) return nulls === "last" ? 1 : dir === "desc" ? 1 : -1;
      if (bv === null) return nulls === "last" ? -1 : dir === "desc" ? -1 : 1;
      const x = av instanceof Date ? av.getTime() : av;
      const y = bv instanceof Date ? bv.getTime() : bv;
      if (x === y) continue;
      return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  };
}

export function fakeAuditDb(seed = {}) {
  const tables = {
    platformAdmin: [],
    salesRep: [],
    salesLead: [],
    staffRoom: [],
    staffRoomMember: [],
    staffMessage: [],
    salesSmsMessage: [],
    salesThread: [],
    salesMessage: [],
    platformAuditLog: [],
  };
  for (const [k, rows] of Object.entries(seed)) {
    if (!tables[k]) throw new Error(`audit fake db: no table ${k}`);
    tables[k].push(...rows.map((r) => ({ ...r })));
  }

  function shape(tableName, row, { select, include } = {}) {
    if (!row) return null;
    const rels = RELATIONS[tableName] || {};
    const out = {};
    const spec = select || null;
    // With `include`, every scalar comes; with `select`, only the named ones.
    if (!spec) for (const [k, v] of Object.entries(row)) if (!rels[k]) out[k] = v;
    const wanted = { ...(spec || {}), ...(include || {}) };
    for (const [k, v] of Object.entries(wanted)) {
      if (!v) continue;
      const rel = rels[k];
      if (!rel) {
        if (spec) out[k] = row[k] ?? null;
        continue;
      }
      if (rel.count) {
        out[k] = Object.fromEntries(Object.keys(v.select || {}).map((c) => [c, rel.count[c](tables, row)]));
        continue;
      }
      const opts = typeof v === "object" ? v : {};
      let rows = tables[rel.table].filter((r) => rel.on(row, r));
      if (opts.where) rows = rows.filter((r) => matches(r, opts.where));
      if (opts.orderBy) rows = [...rows].sort(sorter(opts.orderBy));
      if (opts.take) rows = rows.slice(0, opts.take);
      const shaped = rows.map((r) => shape(rel.table, r, { select: opts.select, include: opts.include }));
      out[k] = rel.many ? shaped : shaped[0] || null;
    }
    return out;
  }

  function delegate(tableName, idPrefix) {
    const table = tables[tableName];
    const query = ({ where, orderBy, take } = {}) => {
      let rows = table.filter((r) => matches(r, where));
      if (orderBy) rows = [...rows].sort(sorter(orderBy));
      if (take) rows = rows.slice(0, take);
      return rows;
    };
    return {
      findUnique: async ({ where, select, include }) => shape(tableName, query({ where })[0] || null, { select, include }),
      findFirst: async ({ where, select, include, orderBy }) => shape(tableName, query({ where, orderBy })[0] || null, { select, include }),
      findMany: async ({ where, select, include, orderBy, take } = {}) => query({ where, orderBy, take }).map((r) => shape(tableName, r, { select, include })),
      count: async ({ where } = {}) => query({ where }).length,
      create: async ({ data, select, include }) => {
        const row = { id: nextId(idPrefix), createdAt: new Date(), ...data };
        table.push(row);
        return shape(tableName, row, { select, include });
      },
      _rows: table,
    };
  }

  return {
    platformAdmin: delegate("platformAdmin", "a"),
    salesRep: delegate("salesRep", "r"),
    salesLead: delegate("salesLead", "l"),
    staffRoom: delegate("staffRoom", "room"),
    staffRoomMember: delegate("staffRoomMember", "m"),
    staffMessage: delegate("staffMessage", "msg"),
    salesSmsMessage: delegate("salesSmsMessage", "sms"),
    salesThread: delegate("salesThread", "t"),
    salesMessage: delegate("salesMessage", "em"),
    platformAuditLog: delegate("platformAuditLog", "log"),
    $transaction: async (ops) => Promise.all(ops),
    tables,
  };
}
