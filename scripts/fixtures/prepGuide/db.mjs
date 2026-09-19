// scripts/fixtures/prepGuide/db.mjs
//
// An in-memory stand-in for the Prisma client, just wide enough for the
// preparation-guide paths: the cron, the job page's routes, the settings
// route, the sender. Aliased over `@/lib/db` by scripts/check-prep-guide.mjs's
// esbuild step. Writes are recorded in `writes` so the check can assert on
// arguments; unscripted models throw by name rather than answering "nothing".

export const rows = { job: [], company: [], client: [], serviceCategory: [], serviceDocument: [], jobDocument: [], member: [], user: [], activityLog: [], product: [] };
export const writes = [];
export function reset() {
  for (const k of Object.keys(rows)) rows[k] = [];
  writes.length = 0;
}

const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (k === "OR") return v.some((w) => matches(row, w));
    if (k === "AND") return v.every((w) => matches(row, w));
    const actual = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return v.in.includes(actual);
      if ("not" in v) return actual !== v.not;
      if ("is" in v) {
        const rel = relation(row, k);
        return v.is === null ? rel == null : rel ? matches(rel, v.is) : false;
      }
      if ("gte" in v || "lte" in v) {
        const t = actual instanceof Date ? actual.getTime() : actual == null ? null : new Date(actual).getTime();
        if (t === null) return false;
        if ("gte" in v && t < new Date(v.gte).getTime()) return false;
        if ("lte" in v && t > new Date(v.lte).getTime()) return false;
        return true;
      }
      // nested relation filter, e.g. client: { email: { not: null } } — resolve via ids
      const rel = relation(row, k);
      return rel ? matches(rel, v) : false;
    }
    if (v === null) return actual == null;
    return actual === v;
  });

function relation(row, name) {
  if (name === "client") return rows.client.find((c) => c.id === row.clientId) || null;
  if (name === "company") return rows.company.find((c) => c.id === row.companyId) || null;
  if (name === "quote") return row.quote || null;
  if (name === "supersededBy") return rows.jobDocument.find((d) => d.supersedesId === row.id) || null;
  return null;
}

let seq = 0;
const id = (p) => `${p}_${++seq}`;

function hydrateJob(job, companyId) {
  if (!job) return null;
  const client = rows.client.find((c) => c.id === job.clientId) || null;
  const company = rows.company.find((c) => c.id === job.companyId) || null;
  const quote = job.quote
    ? {
        ...job.quote,
        scopeGroups: (job.quote.scopeGroups || []).map((g) => ({
          ...g,
          category: hydrateCategory(rows.serviceCategory.find((c) => c.id === g.categoryId), companyId || job.companyId),
        })),
      }
    : null;
  return { ...job, client, company, quote };
}
function hydrateCategory(cat, companyId) {
  if (!cat) return null;
  return { ...cat, companySettings: (cat.companySettings || []).filter((s) => !companyId || s.companyId === companyId) };
}

function model(name, extra = {}) {
  return {
    findFirst: async ({ where }) => rows[name].find((r) => matches(r, where)) || null,
    findUnique: async ({ where }) => rows[name].find((r) => matches(r, where)) || null,
    findMany: async ({ where = {}, take } = {}) => {
      const out = rows[name].filter((r) => matches(r, where));
      return take ? out.slice(0, take) : out;
    },
    create: async ({ data }) => {
      const row = { id: id(name), createdAt: new Date(), uploadedAt: new Date(), ...data };
      rows[name].push(row);
      writes.push({ model: name, op: "create", data: row });
      return row;
    },
    update: async ({ where, data }) => {
      const row = rows[name].find((r) => matches(r, where));
      if (!row) throw new Error(`${name}.update: no row`);
      Object.assign(row, data);
      writes.push({ model: name, op: "update", where, data });
      return row;
    },
    updateMany: async ({ where, data }) => {
      const hit = rows[name].filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      writes.push({ model: name, op: "updateMany", where, data, count: hit.length });
      return { count: hit.length };
    },
    delete: async ({ where }) => {
      const i = rows[name].findIndex((r) => matches(r, where));
      if (i === -1) throw new Error(`${name}.delete: no row`);
      const [row] = rows[name].splice(i, 1);
      writes.push({ model: name, op: "delete", where });
      return row;
    },
    ...extra,
  };
}

export const db = {
  job: model("job", {
    findFirst: async ({ where }) => hydrateJob(rows.job.find((r) => matches(r, where)) || null, where?.companyId),
    findMany: async ({ where = {}, take } = {}) => {
      const out = rows.job.filter((r) => matches(r, where)).map((j) => hydrateJob(j));
      return take ? out.slice(0, take) : out;
    },
  }),
  company: model("company"),
  client: model("client"),
  serviceCategory: model("serviceCategory", {
    findUnique: async ({ where }) => hydrateCategory(rows.serviceCategory.find((r) => matches(r, where)) || null),
  }),
  serviceDocument: model("serviceDocument"),
  jobDocument: model("jobDocument"),
  member: model("member"),
  user: model("user"),
  activityLog: model("activityLog"),
  companyServiceCategory: model("companyServiceCategory"),
  product: model("product"),
};
// Anything else the product reaches for is a scripting gap, not an answer.
export default new Proxy(db, {
  get(target, prop) {
    if (prop in target || typeof prop === "symbol" || prop === "then") return target[prop];
    throw new Error(`prepGuide db fixture: model "${String(prop)}" is not scripted`);
  },
});
