// scripts/fixtures/tendersDb.mjs
//
// An in-memory stand-in for the Prisma client, for scripts/check-tenders.mjs.
//
// Deliberately STRICT where the tender code relies on the database to be
// strict, so a route that forgot a rule fails here rather than passing:
//
//   * update({ where }) matches EVERY key in `where` (id AND companyId) and
//     throws P2025 when nothing matches — the same as Prisma, so an update
//     scoped by id alone against another company's row is visible;
//   * TenderReminder enforces its @@unique([tenderId, kind, dueAt]) with a
//     P2002, which is the whole once-only mechanism;
//   * an unscripted model or method throws by name.
//
// `select` is honoured only for the one nested read the code makes
// (Quote.jobs); otherwise whole rows come back, which is a superset of what a
// select returns and cannot make a missing field look present to a check
// that asserts on ABSENCE (redaction is asserted on the route's output, which
// is built field by field).

let seq = 0;
const nextId = (prefix) => `${prefix}_${++seq}`;

export const store = {
  tender: [],
  tenderDocument: [],
  tenderReminder: [],
  client: [],
  quote: [],
  job: [],
  company: [],
  member: [],
};

export function reset() {
  for (const k of Object.keys(store)) store[k].length = 0;
  seq = 0;
}

function matchValue(actual, cond) {
  if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
    if ("in" in cond && !cond.in.some((v) => same(actual, v))) return false;
    if ("not" in cond && same(actual, cond.not)) return false;
    if ("gt" in cond && !(toNum(actual) > toNum(cond.gt))) return false;
    if ("gte" in cond && !(toNum(actual) >= toNum(cond.gte))) return false;
    if ("lt" in cond && !(toNum(actual) < toNum(cond.lt))) return false;
    if ("lte" in cond && !(toNum(actual) <= toNum(cond.lte))) return false;
    return true;
  }
  return same(actual, cond);
}
function toNum(v) {
  return v instanceof Date ? v.getTime() : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : Number(v);
}
function same(a, b) {
  if (a instanceof Date || b instanceof Date) return toNum(a) === toNum(b);
  return (a ?? null) === (b ?? null);
}
function matches(row, where = {}) {
  for (const [k, cond] of Object.entries(where || {})) {
    if (cond === undefined) continue;
    if (!matchValue(row[k], cond)) return false;
  }
  return true;
}

function shape(model, row, select) {
  if (!row) return row;
  const out = { ...row };
  // A selected column the row never had reads as null, as Prisma returns it.
  if (select && typeof select === "object") {
    for (const [k, v] of Object.entries(select)) if (v === true && !(k in out)) out[k] = null;
  }
  if (model === "quote" && select?.jobs) {
    out.jobs = store.job.filter((j) => j.quoteId === row.id).map((j) => ({ id: j.id }));
  }
  return out;
}

function notFound() {
  const err = new Error("Record to update not found.");
  err.code = "P2025";
  return err;
}

function delegate(model) {
  const rows = () => store[model];
  return {
    async findMany({ where, select, orderBy, take } = {}) {
      let list = rows().filter((r) => matches(r, where));
      if (orderBy && !Array.isArray(orderBy)) {
        const [[key, dir]] = Object.entries(orderBy);
        list = [...list].sort((a, b) => (toNum(a[key]) - toNum(b[key])) * (dir === "desc" ? -1 : 1));
      }
      if (take) list = list.slice(0, take);
      return list.map((r) => shape(model, r, select));
    },
    async findFirst({ where, select } = {}) {
      return shape(model, rows().find((r) => matches(r, where)) || null, select);
    },
    async findUnique({ where, select } = {}) {
      return shape(model, rows().find((r) => matches(r, where)) || null, select);
    },
    async count({ where } = {}) {
      return rows().filter((r) => matches(r, where)).length;
    },
    async create({ data }) {
      if (model === "tenderReminder") {
        const clash = rows().find(
          (r) => r.tenderId === data.tenderId && r.kind === data.kind && toNum(r.dueAt) === toNum(data.dueAt),
        );
        if (clash) {
          const err = new Error("Unique constraint failed on the fields: (`tenderId`,`kind`,`dueAt`)");
          err.code = "P2002";
          throw err;
        }
      }
      const now = new Date();
      const row = {
        id: data.id || nextId(model),
        createdAt: now,
        updatedAt: now,
        ...(model === "tender" ? { status: "watching", siteVisitMandatory: false, bidSecurityRequired: false, source: "other" } : {}),
        ...(model === "tenderDocument" ? { uploadedAt: now } : {}),
        ...(model === "tenderReminder" ? { sentAt: now, delivered: 0 } : {}),
        ...data,
      };
      rows().push(row);
      return { ...row };
    },
    async update({ where, data }) {
      const row = rows().find((r) => matches(r, where));
      if (!row) throw notFound();
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    async updateMany({ where, data }) {
      const hit = rows().filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data, { updatedAt: new Date() });
      return { count: hit.length };
    },
    async deleteMany({ where }) {
      const keep = rows().filter((r) => !matches(r, where));
      const removed = rows().length - keep.length;
      store[model].splice(0, store[model].length, ...keep);
      return { count: removed };
    },
  };
}

const delegates = Object.fromEntries(Object.keys(store).map((m) => [m, delegate(m)]));

export const db = new Proxy(
  {
    ...delegates,
    async $transaction(fn) {
      return fn(db);
    },
    async $queryRaw() {
      return [];
    },
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol" || prop === "then") return undefined;
      throw new Error(`tendersDb: "${String(prop)}" is not scripted`);
    },
  },
);

export default db;
