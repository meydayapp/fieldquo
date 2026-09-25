// scripts/fixtures/mailboxFakeDb.mjs
//
// "Just enough Prisma" for lib/mailbox/ — the tables the sync, the filing and
// the connection code touch, with the two properties that make a fake worth
// trusting (the same two scripts/fixtures/memoryPrisma.mjs keeps):
//
//   * the schema's UNIQUE indexes throw P2002, so a double-file that
//     Postgres would refuse is refused here too — which is what the dedupe
//     assertions depend on;
//   * a query shape this file does not model throws by name, never answers
//     "nothing".
//
// $transaction snapshots every table and restores it if the callback throws,
// so "the Message and its EmailMessage are written together or not at all"
// is executable.

let seq = 0;
const nextId = (p) => `${p}_${++seq}`;

// Relations the mailbox code filters or selects through.
const REL = {
  emailMessage: { message: { table: "message", local: "messageId" }, mailbox: { table: "mailboxConnection", local: "mailboxId" } },
  message: { thread: { table: "messageThread", local: "threadId" }, email: { table: "emailMessage", foreign: "messageId", one: true } },
  messageThread: { channel: { table: "messagingChannel", local: "channelId" }, messages: { table: "message", foreign: "threadId" } },
  member: { user: { table: "user", local: "userId" } },
  mailboxConnection: { company: { table: "company", local: "companyId" } },
};

const UNIQUES = {
  mailboxConnection: [["companyId", "address"], ["channelId"]],
  emailMessage: [["companyId", "rfcMessageId"], ["messageId"]],
  message: [["threadId", "externalId"]],
  messageThread: [["channelId", "externalThreadId"], ["companyId", "threadNumber"]],
  messagingChannel: [["platform", "externalId"]],
};
const COMPOUND = {
  channelId_externalThreadId: ["channelId", "externalThreadId"],
  platform_externalId: ["platform", "externalId"],
  threadId_externalId: ["threadId", "externalId"],
  companyId_address: ["companyId", "address"],
};

const DEFAULTS = {
  message: () => ({ private: false, mediaPending: false, failedReason: null, createdAt: new Date() }),
  messageThread: () => ({ unread: 0, status: "open", createdAt: new Date(), clientId: null, leadId: null, jobId: null, quoteId: null, threadNumber: null, waitingSince: null, firstInboundAt: null, firstReplyAt: null, lastInboundAt: null }),
  emailMessage: () => ({ createdAt: new Date(), filedBy: "sync", sentVia: null }),
  mailboxConnection: () => ({ status: "connected", filedCount: 0, skippedCount: 0, sendEnabled: false, sendWindowCount: 0, syncingSince: null, channelId: null, cursor: {}, connectedAt: new Date() }),
  messagingChannel: () => ({ disconnectedAt: null, status: "connected" }),
};

export function createFakeDb(seed = {}) {
  const tables = {};
  const table = (name) => (tables[name] ||= []);
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  const log = [];

  const cmp = (a, b) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? b.getTime() : b);

  function matchValue(v, cond) {
    if (cond === null) return v === null || v === undefined;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond !== "object") return v === cond;
    for (const [op, arg] of Object.entries(cond)) {
      if (op === "in") { if (!arg.includes(v)) return false; }
      else if (op === "not") { if (arg === null ? v === null || v === undefined : v === arg) return false; }
      else if (op === "gte") { if (v == null || cmp(v, arg) < 0) return false; }
      else if (op === "gt") { if (v == null || cmp(v, arg) <= 0) return false; }
      else if (op === "lt") { if (v == null || cmp(v, arg) >= 0) return false; }
      else if (op === "lte") { if (v == null || cmp(v, arg) > 0) return false; }
      else if (op === "contains") { if (!String(v || "").toLowerCase().includes(String(arg).toLowerCase())) return false; }
      else if (op === "mode") continue;
      else throw new Error(`fake db: unsupported operator ${op}`);
    }
    return true;
  }

  function matches(name, row, where = {}) {
    for (const [k, cond] of Object.entries(where || {})) {
      if (k === "OR") { if (!cond.some((w) => matches(name, row, w))) return false; continue; }
      if (k === "AND") { if (!cond.every((w) => matches(name, row, w))) return false; continue; }
      const rel = REL[name]?.[k];
      if (rel) {
        if (rel.foreign) {
          const kids = table(rel.table).filter((r) => r[rel.foreign] === row.id);
          if (cond.some) { if (!kids.some((r) => matches(rel.table, r, cond.some))) return false; continue; }
          throw new Error(`fake db: unsupported relation filter on ${name}.${k}`);
        }
        const target = table(rel.table).find((r) => r.id === row[rel.local]);
        if (!target || !matches(rel.table, target, cond)) return false;
        continue;
      }
      if (!matchValue(row[k], cond)) return false;
    }
    return true;
  }

  function shape(name, row, select, include) {
    if (!row) return row;
    const out = select ? {} : { ...row };
    const spec = select || include || {};
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      const rel = REL[name]?.[k];
      if (!rel) { if (select) out[k] = row[k]; continue; }
      const sub = v === true ? {} : v;
      if (rel.foreign) {
        let kids = table(rel.table).filter((r) => r[rel.foreign] === row.id && (!sub.where || matches(rel.table, r, sub.where)));
        if (sub.orderBy) kids = order(kids, sub.orderBy);
        if (rel.one) out[k] = kids[0] ? shape(rel.table, kids[0], sub.select, sub.include) : null;
        else out[k] = kids.map((r) => shape(rel.table, r, sub.select, sub.include));
      } else {
        const target = table(rel.table).find((r) => r.id === row[rel.local]);
        out[k] = target ? shape(rel.table, target, sub.select, sub.include) : null;
      }
    }
    return out;
  }

  function order(rows, orderBy) {
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const s of specs) {
        const [k, dir] = Object.entries(s)[0];
        const d = typeof dir === "object" ? dir.sort : dir;
        const nullsFirst = typeof dir === "object" && dir.nulls === "first";
        const av = a[k], bv = b[k];
        if (av == null && bv == null) continue;
        if (av == null) return nullsFirst ? -1 : 1;
        if (bv == null) return nullsFirst ? 1 : -1;
        const c = cmp(av, bv) || String(av).localeCompare(String(bv));
        if (c) return d === "desc" ? -c : c;
      }
      return 0;
    });
  }

  function checkUnique(name, row, exceptId) {
    for (const cols of UNIQUES[name] || []) {
      if (cols.some((c) => row[c] === null || row[c] === undefined)) continue;
      const clash = table(name).find((r) => r.id !== exceptId && cols.every((c) => r[c] === row[c]));
      if (clash) throw Object.assign(new Error(`Unique constraint failed on ${name}(${cols.join(",")})`), { code: "P2002" });
    }
  }

  function applyData(row, data) {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (v && typeof v === "object" && !(v instanceof Date) && "increment" in v) row[k] = (row[k] || 0) + v.increment;
      else row[k] = v;
    }
  }

  function whereUnique(name, where) {
    const [k, v] = Object.entries(where)[0];
    if (COMPOUND[k]) return (r) => COMPOUND[k].every((c) => r[c] === v[c]);
    return (r) => Object.entries(where).every(([kk, vv]) => r[kk] === vv);
  }

  function delegate(name) {
    return {
      async findMany({ where, select, include, orderBy, take } = {}) {
        let rows = table(name).filter((r) => matches(name, r, where));
        if (orderBy) rows = order(rows, orderBy);
        if (take) rows = rows.slice(0, take);
        return rows.map((r) => shape(name, r, select, include));
      },
      async findFirst(args = {}) {
        return (await this.findMany({ ...args, take: 1 }))[0] || null;
      },
      async findUnique({ where, select, include }) {
        const row = table(name).find(whereUnique(name, where));
        return row ? shape(name, row, select, include) : null;
      },
      async count({ where } = {}) {
        return table(name).filter((r) => matches(name, r, where)).length;
      },
      async create({ data, select }) {
        const row = { ...(DEFAULTS[name]?.() || {}), id: data.id || nextId(name) };
        applyData(row, data);
        checkUnique(name, row);
        table(name).push(row);
        log.push({ op: "create", name, row: { ...row } });
        return shape(name, row, select);
      },
      async update({ where, data, select }) {
        const row = table(name).find(whereUnique(name, where));
        if (!row) throw Object.assign(new Error(`fake db: ${name}.update found nothing`), { code: "P2025" });
        const next = { ...row };
        applyData(next, data);
        checkUnique(name, next, row.id);
        Object.assign(row, next);
        log.push({ op: "update", name, id: row.id, data });
        return shape(name, row, select);
      },
      async updateMany({ where, data }) {
        const rows = table(name).filter((r) => matches(name, r, where));
        for (const r of rows) applyData(r, data);
        return { count: rows.length };
      },
      async upsert({ where, create, update }) {
        const row = table(name).find(whereUnique(name, where));
        if (row) return this.update({ where: { id: row.id }, data: update });
        return this.create({ data: create });
      },
      async groupBy({ by, where, _count }) {
        const rows = table(name).filter((r) => matches(name, r, where));
        const groups = new Map();
        for (const r of rows) {
          const key = JSON.stringify(by.map((b) => r[b]));
          if (!groups.has(key)) groups.set(key, { ...Object.fromEntries(by.map((b) => [b, r[b]])), _count: { _all: 0 } });
          groups.get(key)._count._all += 1;
        }
        return [...groups.values()];
      },
    };
  }

  const db = new Proxy(
    {
      tables,
      log,
      async $transaction(fn) {
        const snapshot = JSON.stringify(tables, (k, v) => v);
        const dates = {};
        for (const [n, rows] of Object.entries(tables)) dates[n] = rows.map((r) => ({ ...r }));
        try {
          return await fn(db);
        } catch (err) {
          for (const n of Object.keys(tables)) tables[n] = dates[n] || [];
          void snapshot;
          throw err;
        }
      },
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== "string") return undefined;
        return delegate(prop);
      },
    },
  );
  return db;
}
