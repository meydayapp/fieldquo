// scripts/fixtures/impersonationDb.mjs
//
// The database scripts/check-impersonation-view-all.mjs runs routes against.
//
// Every model answers every method. Reads return what the check scripted in
// `rows` (keyed "model.method"), else the empty answer for that shape — null
// for a single row, [] for a list, 0 for a count. Writes are RECORDED, never
// applied, so a check can assert that a support session's GET wrote nothing:
// `writes` is the whole point of this file.
//
// Scriptable through the exports rather than globalThis so two checks cannot
// share state by accident.

export const rows = {};
export const writes = [];

const WRITE = new Set([
  "create", "createMany", "createManyAndReturn", "update", "updateMany",
  "upsert", "delete", "deleteMany",
]);

export function resetImpersonationDb() {
  for (const k of Object.keys(rows)) delete rows[k];
  writes.length = 0;
}

function answer(model, method, args) {
  const key = `${model}.${method}`;
  if (key in rows) {
    const v = rows[key];
    return typeof v === "function" ? v(args) : structuredCloneSafe(v);
  }
  if (WRITE.has(method)) {
    writes.push({ model, method, args });
    if (method === "createMany" || method === "updateMany" || method === "deleteMany") return { count: 0 };
    return { id: `written-${writes.length}`, ...(args?.data || {}) };
  }
  if (method === "findMany" || method === "groupBy") return [];
  if (method === "count") return 0;
  if (method === "aggregate") return { _sum: {}, _count: {}, _max: {}, _min: {}, _avg: {} };
  return null;
}

// Decimal-ish and Date values survive; functions are not cloned.
function structuredCloneSafe(v) {
  try {
    return structuredClone(v);
  } catch {
    return v;
  }
}

function modelProxy(model) {
  return new Proxy(
    {},
    {
      get(_t, method) {
        if (typeof method !== "string") return undefined;
        return async (args) => answer(model, method, args);
      },
    },
  );
}

export const db = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop === "$transaction") {
        return async (arg) => (typeof arg === "function" ? arg(db) : Promise.all(arg));
      }
      if (prop === "$queryRaw" || prop === "$queryRawUnsafe") return async () => [];
      if (prop === "$executeRaw" || prop === "$executeRawUnsafe") {
        return async (...args) => {
          writes.push({ model: "$raw", method: prop, args });
          return 0;
        };
      }
      if (prop === "then") return undefined; // not a thenable
      if (prop.startsWith("$")) return async () => null;
      return modelProxy(prop);
    },
  },
);

export default db;
