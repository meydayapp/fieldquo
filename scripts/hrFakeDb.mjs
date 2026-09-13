// scripts/hrFakeDb.mjs
//
// An in-memory Prisma stand-in for the HR module's loaders, so
// scripts/check-hr.mjs can EXECUTE "a company never reads another company's
// file" instead of reading the routes and hoping. Supports exactly the query
// shapes lib/hr/* and lib/onboarding/* use: flat equality, `in`, `not`,
// `has`, `gte/lte`, select/orderBy/take/distinct, create/update/updateMany/
// count, and $transaction over a callback. Anything else throws, so a new
// query shape is a visible failure rather than a silent pass.
const TABLES = [
  "worker", "company", "user", "member",
  "workerDocument", "onboardingTemplate", "onboardingRun", "taxFormSubmission",
  "companyPolicy", "companyPolicyVersion", "policyAcknowledgement", "workerNote", "managerLogEntry",
  "notificationEvent", "notificationDelivery",
];

function matchValue(actual, cond) {
  if (cond === null || cond === undefined) return actual === null || actual === undefined;
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime();
  if (typeof cond !== "object" || Array.isArray(cond)) return actual === cond;
  for (const [op, v] of Object.entries(cond)) {
    switch (op) {
      case "in": if (!v.includes(actual)) return false; break;
      case "not": if (v === null ? actual === null || actual === undefined : actual === v) return false; break;
      case "has": if (!Array.isArray(actual) || !actual.includes(v)) return false; break;
      case "gte": if (!(actual >= v)) return false; break;
      case "lte": if (!(actual <= v)) return false; break;
      case "lt": if (!(actual < v)) return false; break;
      case "gt": if (!(actual > v)) return false; break;
      case "equals": if (actual !== v) return false; break;
      default: throw new Error(`hrFakeDb: unsupported operator ${op}`);
    }
  }
  return true;
}

function matches(row, where) {
  for (const [k, cond] of Object.entries(where || {})) {
    if (k === "shift") continue; // relation filter used only by the cron; ignored here
    if (!matchValue(row[k], cond)) return false;
  }
  return true;
}

function pick(row, select) {
  if (!select) return { ...row };
  const out = {};
  for (const [k, v] of Object.entries(select)) if (v) out[k] = row[k];
  return out;
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  return rows.slice().sort((a, b) => {
    for (const o of list) {
      const [k, dir] = Object.entries(o)[0];
      const av = a[k], bv = b[k];
      if (av === bv) continue;
      const cmp = av instanceof Date ? av - bv : av > bv ? 1 : -1;
      return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

export function fakeDb(seed = {}) {
  const tables = {};
  for (const t of TABLES) tables[t] = (seed[t] || []).map((r) => ({ ...r }));
  let n = 0;
  const id = (t) => `${t}_${++n}`;
  const db = { tables };
  for (const t of TABLES) {
    const rows = () => tables[t];
    db[t] = {
      async findMany({ where, select, orderBy, take, distinct } = {}) {
        let out = sortRows(rows().filter((r) => matches(r, where)), orderBy);
        if (distinct) {
          const seen = new Set();
          out = out.filter((r) => { const k = distinct.map((d) => r[d]).join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
        }
        if (take) out = out.slice(0, take);
        return out.map((r) => pick(r, select));
      },
      async findFirst({ where, select, orderBy } = {}) {
        const out = sortRows(rows().filter((r) => matches(r, where)), orderBy);
        return out.length ? pick(out[0], select) : null;
      },
      async findUnique({ where, select } = {}) {
        // Compound uniques arrive as { policyId_version: { policyId, version } }.
        const flat = {};
        for (const [k, v] of Object.entries(where)) {
          if (v && typeof v === "object" && !(v instanceof Date) && k.includes("_")) Object.assign(flat, v);
          else flat[k] = v;
        }
        const r = rows().find((r) => matches(r, flat));
        return r ? pick(r, select) : null;
      },
      async count({ where } = {}) {
        return rows().filter((r) => matches(r, where)).length;
      },
      async create({ data, select }) {
        const row = { id: id(t), createdAt: new Date(), updatedAt: new Date(), ...data };
        if (t === "onboardingRun" && !row.startedAt) row.startedAt = new Date();
        if (t === "policyAcknowledgement" && !row.acknowledgedAt) row.acknowledgedAt = new Date();
        if (t === "taxFormSubmission" && !row.submittedAt) row.submittedAt = new Date();
        rows().push(row);
        return pick(row, select);
      },
      async update({ where, data, select }) {
        const r = await db[t].findUnique({ where });
        if (!r) throw new Error(`hrFakeDb: ${t}.update found no row`);
        const real = rows().find((x) => x.id === r.id);
        Object.assign(real, data, { updatedAt: new Date() });
        return pick(real, select);
      },
      async updateMany({ where, data }) {
        const hit = rows().filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
      async createMany({ data }) {
        for (const d of data) rows().push({ id: id(t), createdAt: new Date(), ...d });
        return { count: data.length };
      },
    };
  }
  db.$transaction = async (arg) => (typeof arg === "function" ? arg(db) : Promise.all(arg));
  return db;
}
