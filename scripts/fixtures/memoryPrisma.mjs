// scripts/fixtures/memoryPrisma.mjs
//
// An in-memory Prisma for the demo-content seed, so scripts/check-demo-content
// .mjs can EXECUTE lib/demo/seedContent.js — and every product writer it calls
// (recordStripePayment, the chat store, the task resolver) — without Neon.
//
// Grown from scripts/companyChatFakeDb.mjs, which models "just enough Prisma"
// for one module. The seed touches fifty models, so this one creates a table
// the first time a delegate is asked for rather than listing them — but keeps
// the two things that made the chat fake worth trusting:
//
//   * declared uniques throw P2002, the way Postgres does, so a seed that
//     wrote the same client twice would fail here rather than in production;
//   * unsupported query shapes throw by name, never answer "nothing".
//
// Served in place of `@/lib/db` by scripts/memory-db-loader.mjs, so a product
// writer that imports the module-level db (lib/tasks/autoCreate.js) lands in
// the same store the seed is writing to.

let seq = 0;
const nextId = (p) => `${p}_${++seq}`;

/** Relations the seed's writers follow through select/include. */
const RELATIONS = {
  member: { user: { table: "user", kind: "one", localKey: "userId" } },
  job: { visits: { table: "jobVisit", kind: "many", foreignKey: "jobId" } },
  invoice: {
    client: { table: "client", kind: "one", localKey: "clientId" },
    payments: { table: "payment", kind: "many", foreignKey: "invoiceId" },
  },
  quote: { client: { table: "client", kind: "one", localKey: "clientId" } },
  companyChatRoom: {
    job: { table: "job", kind: "one", localKey: "jobId" },
    members: { table: "companyChatMember", kind: "many", foreignKey: "roomId" },
    messages: { table: "companyChatMessage", kind: "many", foreignKey: "roomId" },
  },
  companyChatMember: {
    member: { table: "member", kind: "one", localKey: "memberId" },
    room: { table: "companyChatRoom", kind: "one", localKey: "roomId" },
  },
  companyChatMessage: { author: { table: "member", kind: "one", localKey: "authorMemberId" } },
};
const RELATION_NAMES = new Set(Object.values(RELATIONS).flatMap((r) => Object.keys(r)));

/** The unique indexes from prisma/schema.prisma the seed relies on. */
const UNIQUES = {
  user: [["email"]],
  member: [["userId", "companyId"]],
  worker: [["userId"]],
  quote: [["companyId", "quoteNumber"], ["shareToken"]],
  quoteCosting: [["quoteId"]],
  invoiceCosting: [["invoiceId"]],
  payment: [["stripePaymentIntentId"], ["stripeRefundId"]],
  leadRequest: [["quoteId"], ["companyId", "metaLeadId"]],
  task: [["sourceKey"]],
  stockMovement: [["ref"]],
  purchaseOrder: [["companyId", "number"]],
  eventType: [["companyId", "slug"]],
  booking: [["manageToken"], ["appointmentId"]],
  vehicleDetail: [["assetId"]],
  servicePlan: [["authToken"]],
  servicePlanAuthorisation: [["planId"]],
  servicePlanOccurrence: [["planId", "seq"], ["invoiceId"], ["stripePaymentIntentId"]],
  leavePolicy: [["companyId", "name"]],
  leaveBalance: [["policyId", "workerId", "year"]],
  marketingSubscriber: [["companyId", "email"], ["unsubscribeToken"]],
  smsOptOut: [["companyId", "e164"]],
  testimonial: [["companyId", "externalId"]],
  expense: [["companyId", "externalId"]],
  workingHours: [["userId", "dayOfWeek"]],
  payRunLine: [["payRunId", "workerId"]],
  jobDailyLog: [["jobId", "logDate"]],
  paymentScheduleStage: [["companyId", "seq"]],
  jobPaymentStage: [["jobId", "seq"]],
  voiceCall: [["providerCallId"]],
  satisfactionResponse: [["jobId"], ["token"]],
  forecastSettings: [["companyId"]],
  companyChatRoom: [["companyId", "key"], ["jobId"]],
  companyChatMember: [["roomId", "memberId"]],
  company: [["slug"]],
};

/**
 * Column defaults Postgres would apply and a writer reads back. Only the ones
 * a seeded path actually depends on: the chat store reads `open`, the invoice
 * family reads `version`, the ledger reads `kind`.
 */
const DEFAULTS = {
  companyChatMember: { open: true, lastSeenAt: null, removedAt: null },
  companyChatMessage: { kind: "message", mentions: [], meta: null },
  companyChatRoom: { name: null, jobId: null, lastMessageAt: null },
  invoice: { version: 1, parentInvoiceId: null, status: "draft", amountPaid: 0, amountDue: 0, amountRefunded: 0, chaseCount: 0 },
  payment: { kind: "payment", refundedAmount: 0, disputeStatus: null, method: "e_transfer" },
  quote: { status: "draft", followUpCount: 0, taxEnabled: true, needsReview: false },
  task: { status: "open", priority: "normal" },
  member: { active: true, role: "employee", permissions: null },
  job: { status: "scheduled", archivedAt: null, recurring: false },
  jobVisit: { status: "scheduled", photos: [] },
  timeEntry: { status: "pending" },
  leadRequest: { status: "new" },
  marketingSubscriber: { subscribed: true },
  servicePlanOccurrence: { status: "pending" },
};

function flatten(where = {}) {
  const out = {};
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && k.includes("_") && !RELATION_NAMES.has(k)) {
      Object.assign(out, v);
    } else out[k] = v;
  }
  return out;
}

const time = (v) => (v instanceof Date ? v.getTime() : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : Number(v));

export function fakeDb() {
  const tables = {};
  const table = (name) => (tables[name] ||= []);

  function matches(t, row, where) {
    for (const [k, v] of Object.entries(flatten(where || {}))) {
      if (k === "OR") { if (!v.some((w) => matches(t, row, w))) return false; continue; }
      if (k === "AND") { if (!(Array.isArray(v) ? v : [v]).every((w) => matches(t, row, w))) return false; continue; }
      if (k === "NOT") { if (matches(t, row, v)) return false; continue; }
      const rel = RELATIONS[t]?.[k];
      if (rel) {
        if (rel.kind !== "many" || !v || typeof v.some !== "object") throw new Error(`memory db: unsupported relation filter ${t}.${k}`);
        const related = table(rel.table).filter((r) => r[rel.foreignKey] === row.id);
        if (!related.some((r) => matches(rel.table, r, v.some))) return false;
        continue;
      }
      const actual = row[k];
      if (v === null) { if (actual !== null && actual !== undefined) return false; continue; }
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) { if (!v.in.includes(actual)) return false; continue; }
        if ("notIn" in v) { if (v.notIn.includes(actual)) return false; continue; }
        if ("not" in v) { if ((actual ?? null) === (v.not ?? null)) return false; continue; }
        let ok = true;
        if ("gt" in v) ok = ok && time(actual) > time(v.gt);
        if ("gte" in v) ok = ok && time(actual) >= time(v.gte);
        if ("lt" in v) ok = ok && time(actual) < time(v.lt);
        if ("lte" in v) ok = ok && time(actual) <= time(v.lte);
        if ("equals" in v) ok = ok && actual === v.equals;
        if ("contains" in v) ok = ok && String(actual ?? "").includes(v.contains);
        if ("startsWith" in v) ok = ok && String(actual ?? "").startsWith(v.startsWith);
        const known = ["gt", "gte", "lt", "lte", "equals", "contains", "startsWith", "mode"];
        if (!Object.keys(v).every((op) => known.includes(op))) throw new Error(`memory db: unsupported where ${t}.${k}: ${JSON.stringify(v)}`);
        if (!ok) return false;
        continue;
      }
      if (v instanceof Date) { if (time(actual) !== v.getTime()) return false; continue; }
      if ((actual ?? null) !== (v ?? null)) return false;
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

  function shape(t, row, { select, include } = {}) {
    if (!row) return null;
    const out = select ? {} : { ...row };
    const spec = select || include || {};
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      const rel = RELATIONS[t]?.[k];
      if (!rel) {
        if (k === "_count") { out._count = countRelations(t, row, v); continue; }
        if (select) out[k] = row[k] ?? null;
        continue;
      }
      const args = typeof v === "object" ? v : {};
      if (rel.kind === "one") {
        const target = table(rel.table).find((r) => r.id === row[rel.localKey]) || null;
        out[k] = shape(rel.table, target, args);
      } else {
        let rows = table(rel.table).filter((r) => r[rel.foreignKey] === row.id);
        if (args.where) rows = rows.filter((r) => matches(rel.table, r, args.where));
        rows = sortBy(rows, args.orderBy);
        if (args.take) rows = rows.slice(0, args.take);
        out[k] = rows.map((r) => shape(rel.table, r, args));
      }
    }
    return out;
  }

  function countRelations(t, row, spec) {
    const out = {};
    for (const k of Object.keys(spec?.select || {})) {
      const rel = RELATIONS[t]?.[k];
      out[k] = rel && rel.kind === "many" ? table(rel.table).filter((r) => r[rel.foreignKey] === row.id).length : 0;
    }
    return out;
  }

  function assertUnique(t, row, ignoreId = null) {
    for (const u of UNIQUES[t] || []) {
      if (!u.every((k) => row[k] != null)) continue;
      if (table(t).some((r) => r.id !== ignoreId && u.every((k) => sameValue(r[k], row[k])))) {
        const err = new Error(`Unique constraint failed on the fields: (${u.join(",")}) in ${t}`);
        err.code = "P2002";
        throw err;
      }
    }
  }
  const sameValue = (a, b) => (a instanceof Date || b instanceof Date ? time(a) === time(b) : a === b);

  function insert(t, data) {
    const row = { id: nextId(t), createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[t] || {}) };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && ("create" in v || "connect" in v) && RELATIONS[t]?.[k]) continue;
      row[k] = v;
    }
    assertUnique(t, row);
    table(t).push(row);
    for (const [k, v] of Object.entries(data)) {
      const rel = RELATIONS[t]?.[k];
      if (rel && v && typeof v === "object" && "create" in v) {
        const list = Array.isArray(v.create) ? v.create : [v.create];
        for (const child of list) insert(rel.table, { ...child, [rel.foreignKey]: row.id });
      }
    }
    return row;
  }

  function delegate(t) {
    const find = (where) => table(t).find((r) => matches(t, r, where)) || null;
    return {
      findUnique: async ({ where, select, include } = {}) => shape(t, find(where), { select, include }),
      findFirst: async ({ where, select, include, orderBy } = {}) => {
        const rows = sortBy(table(t).filter((r) => matches(t, r, where)), orderBy);
        return shape(t, rows[0] || null, { select, include });
      },
      findMany: async ({ where, select, include, orderBy, take, skip } = {}) => {
        let rows = sortBy(table(t).filter((r) => matches(t, r, where)), orderBy);
        if (skip) rows = rows.slice(skip);
        if (take) rows = rows.slice(0, take);
        return rows.map((r) => shape(t, r, { select, include }));
      },
      count: async ({ where } = {}) => table(t).filter((r) => matches(t, r, where)).length,
      create: async ({ data, select, include }) => shape(t, insert(t, data), { select, include }),
      createMany: async ({ data }) => {
        for (const d of Array.isArray(data) ? data : [data]) insert(t, d);
        return { count: Array.isArray(data) ? data.length : 1 };
      },
      update: async ({ where, data, select, include }) => {
        const row = find(where);
        if (!row) {
          const err = new Error(`memory db: ${t}.update found no row for ${JSON.stringify(where)}`);
          err.code = "P2025";
          throw err;
        }
        const next = { ...row };
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && ("increment" in v || "decrement" in v)) {
            next[k] = Number(row[k] || 0) + Number(v.increment || 0) - Number(v.decrement || 0);
          } else if (v !== undefined) next[k] = v;
        }
        assertUnique(t, next, row.id);
        Object.assign(row, next, { updatedAt: new Date() });
        return shape(t, row, { select, include });
      },
      updateMany: async ({ where, data }) => {
        const hits = table(t).filter((r) => matches(t, r, where));
        for (const r of hits) Object.assign(r, data);
        return { count: hits.length };
      },
      upsert: async ({ where, update, create, select, include }) => {
        const row = find(where);
        if (row) {
          for (const [k, v] of Object.entries(update || {})) if (v !== undefined) row[k] = v;
          return shape(t, row, { select, include });
        }
        return shape(t, insert(t, create), { select, include });
      },
      delete: async ({ where }) => {
        const row = find(where);
        if (row) tables[t] = table(t).filter((r) => r !== row);
        return row;
      },
      deleteMany: async ({ where } = {}) => {
        const before = table(t).length;
        tables[t] = table(t).filter((r) => !matches(t, r, where));
        return { count: before - tables[t].length };
      },
    };
  }

  const delegates = {};
  const db = {
    $transaction: async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(db)),
    $queryRaw: async () => [],
    $disconnect: async () => {},
    /** Row counts per table — what the idempotency assertion compares. */
    __counts: () => Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    __tables: tables,
    __reset: () => {
      for (const k of Object.keys(tables)) delete tables[k];
    },
  };
  return new Proxy(db, {
    get(target, prop) {
      if (prop in target || typeof prop === "symbol") return target[prop];
      if (typeof prop !== "string" || prop.startsWith("$")) return undefined;
      return (delegates[prop] ||= delegate(prop));
    },
  });
}

/** The singleton served as `@/lib/db` under memory-db-loader.mjs. */
export const db = fakeDb();
