// scripts/fixtures/teamAccessStub.mjs
//
// The world scripts/check-invite-accept-access.mjs runs the real invite,
// accept and kitchen code in. Resolved in place of several specifiers by
// scripts/team-access-stub-hooks.mjs — @/lib/db, @/lib/auth,
// @/lib/currentMember, the worker/onboarding side effects, next/headers and
// next/navigation — so ONE module holds the state every one of them shares.
//
// ── Why not scripts/fixtures/dbStub.mjs ────────────────────────────────────
//
// Its $transaction runs the callback against the same client and never rolls
// back, and says so. The claim under test here IS atomicity: "a member is
// never left active with no permission grid because the grid write failed".
// A transaction that cannot roll back would let that claim pass vacuously,
// so this one snapshots every table on entry and restores it on a throw,
// which is what Postgres does with a failed interactive transaction.

export const rows = {};
const MODELS = ["member", "pendingTeamProfile", "company", "invitation", "user", "subscription", "quote", "worker"];
export const writes = [];
// Force the next N calls of model.action to throw the way a Neon cold start
// does (P1001). Each entry: { model, action, times }.
export const failures = [];
// Session and member state, declared before resetStub() first runs.
let session = null;
let currentMember = null;
export const authCalls = [];

export function resetStub() {
  for (const m of MODELS) rows[m] = [];
  writes.length = 0;
  failures.length = 0;
  session = null;
  currentMember = null;
  authCalls.length = 0;
}
resetStub();

function maybeFail(model, action) {
  const f = failures.find((x) => x.model === model && x.action === action && x.times > 0);
  if (!f) return;
  f.times--;
  const err = new Error(`teamAccessStub: forced failure on ${model}.${action} (stands in for P1001)`);
  err.code = "P1001";
  throw err;
}

function flatten(where = {}) {
  const out = {};
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v) && k.includes("_")) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function decorate(model, row) {
  if (!row) return row;
  // Member.user is a relation; answered from the user table the way a join
  // would, so reconcilePendingProfiles' email match reads real data.
  if (model === "member") return { ...row, user: rows.user.find((u) => u.id === row.userId) || null };
  return { ...row };
}

function matches(model, row, where = {}) {
  const r = decorate(model, row);
  return Object.entries(flatten(where)).every(([k, v]) => {
    if (v === undefined) return true;
    if (v === null) return r[k] == null;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("in" in v) return v.in.includes(r[k]);
      if ("not" in v) return r[k] !== v.not;
      if ("equals" in v) {
        if (v.mode === "insensitive") return String(r[k] ?? "").toLowerCase() === String(v.equals).toLowerCase();
        return r[k] === v.equals;
      }
      if (r[k] && typeof r[k] === "object") return Object.entries(v).every(([kk, vv]) => r[k][kk] === vv);
      return false;
    }
    return r[k] === v;
  });
}

// Prisma returns only the selected columns. Honoured here because the
// kitchen page's claim is precisely "the server reads the design but hands
// the browser only what it selected" — a stub that returned whole rows would
// fail that claim for a reason the database never would.
function project(row, select) {
  if (!row || !select) return row;
  const out = {};
  for (const [k, v] of Object.entries(select)) if (v && k in row) out[k] = row[k];
  return out;
}

function model(name) {
  const find = (where) => rows[name].find((r) => matches(name, r, where));
  return {
    findUnique: async ({ where, select } = {}) => { maybeFail(name, "findUnique"); return project(decorate(name, find(where) || null), select); },
    findFirst: async ({ where, select } = {}) => { maybeFail(name, "findFirst"); return project(decorate(name, find(where) || null), select); },
    findMany: async ({ where, select } = {}) => { maybeFail(name, "findMany"); return rows[name].filter((r) => matches(name, r, where)).map((r) => project(decorate(name, r), select)); },
    count: async ({ where } = {}) => rows[name].filter((r) => matches(name, r, where)).length,
    create: async ({ data }) => {
      maybeFail(name, "create");
      const row = { id: `${name}_${rows[name].length + 1}_${Math.random().toString(36).slice(2, 6)}`, ...data };
      rows[name].push(row);
      writes.push({ model: name, action: "create", data });
      return decorate(name, row);
    },
    update: async ({ where, data }) => {
      maybeFail(name, "update");
      const row = find(where);
      if (!row) { const e = new Error(`No ${name} for update`); e.code = "P2025"; throw e; }
      for (const [k, v] of Object.entries(data)) if (v !== undefined) row[k] = v;
      writes.push({ model: name, action: "update", where, data });
      return decorate(name, row);
    },
    updateMany: async ({ where, data }) => {
      maybeFail(name, "updateMany");
      const hits = rows[name].filter((r) => matches(name, r, where));
      for (const row of hits) for (const [k, v] of Object.entries(data)) if (v !== undefined) row[k] = v;
      writes.push({ model: name, action: "updateMany", where, data });
      return { count: hits.length };
    },
    upsert: async ({ where, create, update }) => {
      maybeFail(name, "upsert");
      const row = find(where);
      if (row) {
        for (const [k, v] of Object.entries(update || {})) if (v !== undefined) row[k] = v;
        writes.push({ model: name, action: "upsert:update", where, data: update });
        return decorate(name, row);
      }
      const created = { id: `${name}_${rows[name].length + 1}`, ...flatten(where), ...create };
      rows[name].push(created);
      writes.push({ model: name, action: "upsert:create", where, data: create });
      return decorate(name, created);
    },
    delete: async ({ where }) => {
      maybeFail(name, "delete");
      const idx = rows[name].findIndex((r) => matches(name, r, where));
      if (idx === -1) { const e = new Error(`No ${name} to delete`); e.code = "P2025"; throw e; }
      writes.push({ model: name, action: "delete", where });
      return rows[name].splice(idx, 1)[0];
    },
    deleteMany: async ({ where } = {}) => {
      maybeFail(name, "deleteMany");
      const keep = rows[name].filter((r) => !matches(name, r, where));
      const count = rows[name].length - keep.length;
      rows[name].splice(0, rows[name].length, ...keep);
      writes.push({ model: name, action: "deleteMany", where });
      return { count };
    },
  };
}

const client = Object.fromEntries(MODELS.map((m) => [m, model(m)]));

/** Interactive transactions roll back on a throw — see the header. */
client.$transaction = async (arg) => {
  if (Array.isArray(arg)) return Promise.all(arg);
  const snapshot = structuredClone(rows);
  const mark = writes.length;
  try {
    return await arg(client);
  } catch (err) {
    for (const m of MODELS) rows[m] = snapshot[m];
    writes.length = mark;
    throw err;
  }
};

export const db = new Proxy(client, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (prop === "then") return undefined;
    throw new Error(`teamAccessStub: db.${String(prop)} is not scripted`);
  },
});

// ── Better Auth ──────────────────────────────────────────────────────────────
export function setSession(user) {
  session = user ? { user } : null;
}
export const auth = {
  api: {
    getSession: async () => session,
    // Better Auth throws for a non-pending invitation; the accept route
    // swallows it. Modelled the same way, and it flips a pending one to
    // accepted as the real call does.
    acceptInvitation: async ({ body }) => {
      authCalls.push({ fn: "acceptInvitation", body });
      const inv = rows.invitation.find((i) => i.id === body.invitationId);
      if (!inv || inv.status !== "pending") throw new Error("Invitation not found or not pending");
      inv.status = "accepted";
      return { ok: true };
    },
    setActiveOrganization: async ({ body }) => {
      authCalls.push({ fn: "setActiveOrganization", body });
      return { ok: true };
    },
    createInvitation: async ({ body }) => {
      authCalls.push({ fn: "createInvitation", body });
      const inv = { id: `inv_${rows.invitation.length + 1}`, status: "pending", expiresAt: new Date(Date.now() + 864e5), ...body };
      rows.invitation.push(inv);
      return inv;
    },
  },
};

// ── @/lib/currentMember ──────────────────────────────────────────────────────
export function setCurrentMember(m) {
  currentMember = m;
}
export async function getCurrentMember() {
  return currentMember;
}

// ── side effects the accept / invite routes call but this check is not about ─
export async function ensureWorkerForMember() {
  return null;
}
export async function ensureWorkersForCompany() {
  return null;
}
export async function resolveQuickAddWorker({ cleanEmail, fullName }) {
  return { worker: { id: `w_${cleanEmail}`, name: fullName }, created: true };
}
export async function startRun() {
  return null;
}
export function takeInviteEmailOutcome() {
  return { sent: true };
}
export async function checkUserLimit() {
  return { allowed: true, currentCount: 0, limit: 999 };
}
export async function recordError() {}
export async function recordActivity() {}

// ── next/headers, next/navigation (the kitchen page) ─────────────────────────
export async function headers() {
  return new Headers();
}
export function notFound() {
  const err = new Error("NEXT_NOT_FOUND");
  err.digest = "NEXT_NOT_FOUND";
  throw err;
}

// The kitchen page's client component, replaced by a function that only
// records what it was handed — that set of props is the whole of what the
// server sends a browser, which is the claim under test.
export const renderedProps = [];
export default function KitchenPageStub(props) {
  renderedProps.push(props);
  return null;
}
