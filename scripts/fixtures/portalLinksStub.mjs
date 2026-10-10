// scripts/fixtures/portalLinksStub.mjs
//
// The one module scripts/portal-links-stub-hooks.mjs points every outward
// dependency of the portal-link routes at, so scripts/check-portal-account-
// links.mjs can EXECUTE app/api/portal-login and app/api/clients/portal-links
// with hostile rows and read back what they did:
//
//   @/lib/db                  → `db`: in-memory rows, writes recorded. With
//                               `leak.on` every where clause is IGNORED, so a
//                               check proves the code re-checks tenancy and
//                               status itself rather than trusting a query.
//   @/lib/email/resend        → `sendEmail` records to `sent` — the real
//                               Resend module is never loaded, so nothing in
//                               this check can reach a real inbox.
//   @/lib/email/companySender → `resolveSender`
//   @/lib/activity/log        → `recordActivity`
//   @/lib/signup/planGate     → `planOrRefusal` (paid)
//   @/lib/permissions/enforce → `loadEnforceableMember` / `requireLevel`
//   @/lib/apiMember           → `memberOrRefusal`, scripted by `session`
//   next/server               → the real NextResponse, and an `after` that
//                               queues the callback so a check can tell what
//                               ran before the response and what ran after.
import { NextResponse } from "next/server.js";

export { NextResponse };

// ── next/server's after ─────────────────────────────────────────────────────
export const afterQueue = [];
export function after(fn) {
  afterQueue.push(fn);
}
export async function drainAfter() {
  while (afterQueue.length) await afterQueue.shift()();
}

// ── the session ─────────────────────────────────────────────────────────────
export const session = { member: null, refuseLevel: false };
export async function memberOrRefusal() {
  if (!session.member) return { member: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { member: session.member, response: null };
}
export async function memberOrRefusalPlain() {
  if (!session.member) return { refusal: { error: "Unauthorized", status: 401 } };
  return { member: session.member };
}
export async function planOrRefusal() {
  return { response: null };
}
export async function loadEnforceableMember() {
  return { id: session.member?.id || null };
}
export function requireLevel() {
  if (session.refuseLevel) {
    const err = new Error("refused");
    err.status = 403;
    throw err;
  }
}
export function permissionErrorResponse(err) {
  return { body: { error: err?.message || "Forbidden" }, status: err?.status || 403 };
}

// ── email ───────────────────────────────────────────────────────────────────
export const SENDER_SELECT = { name: true, email: true, emailDomain: true, emailDomainStatus: true, emailFromLocal: true };
export const sent = [];
export const sendBehaviour = { mode: "ok" }; // ok | error | skipped
export async function sendEmail(mail) {
  if (sendBehaviour.mode === "skipped") return { skipped: true };
  if (sendBehaviour.mode === "error") return { error: { message: "boom" } };
  sent.push(mail);
  return { id: `msg_${sent.length}` };
}
export async function resolveSender(company) {
  return { from: `${company?.name || "Company"} <hello@example.test>`, replyTo: company?.email || null };
}
export const activity = [];
export async function recordActivity(member, event) {
  activity.push({ member, event });
}

// ── the database ────────────────────────────────────────────────────────────
export const rows = { company: [], companySite: [], client: [], quote: [], job: [], marketingSubscriber: [], sentEmail: [], user: [] };
export const writes = [];
export const leak = { on: false };

export function resetStub() {
  for (const k of Object.keys(rows)) rows[k] = [];
  writes.length = 0;
  sent.length = 0;
  activity.length = 0;
  afterQueue.length = 0;
  leak.on = false;
  sendBehaviour.mode = "ok";
  session.member = null;
  session.refuseLevel = false;
}

function test(value, cond) {
  if (cond === null) return value == null;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    if ("in" in cond && !cond.in.includes(value)) return false;
    if ("notIn" in cond && cond.notIn.includes(value)) return false;
    if ("not" in cond && cond.not !== undefined && test(value, cond.not)) return false;
    if ("gte" in cond && !(value != null && new Date(value).getTime() >= new Date(cond.gte).getTime())) return false;
    if ("equals" in cond) {
      return cond.mode === "insensitive"
        ? String(value ?? "").toLowerCase() === String(cond.equals ?? "").toLowerCase()
        : value === cond.equals;
    }
    return true;
  }
  return value === cond;
}

function matches(row, where = {}) {
  if (leak.on) return true;
  for (const [k, v] of Object.entries(where || {})) {
    if (k === "OR") {
      if (!v.some((w) => matches(row, w))) return false;
      continue;
    }
    if (k === "AND") {
      if (!(Array.isArray(v) ? v : [v]).every((w) => matches(row, w))) return false;
      continue;
    }
    if (k.includes("_") && v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      // compound unique, e.g. companyId_email
      if (!Object.entries(v).every(([kk, vv]) => test(row[kk], vv))) return false;
      continue;
    }
    if (!test(row[k], v)) return false;
  }
  return true;
}

const RELATIONS = {
  client: {
    quotes: (row) => rows.quote.filter((q) => leak.on || q.clientId === row.id),
    jobs: (row) => rows.job.filter((j) => leak.on || j.clientId === row.id),
  },
  quote: {
    jobs: (row) => rows.job.filter((j) => leak.on || j.quoteId === row.id),
  },
};

function shape(model, row, select) {
  if (!select) return { ...row };
  const out = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    const rel = RELATIONS[model]?.[k];
    if (rel) {
      const child = k === "quotes" ? "quote" : k === "jobs" ? "job" : k;
      const spec = v === true ? {} : v;
      out[k] = rel(row)
        .filter((r) => matches(r, spec.where))
        .map((r) => shape(child, r, spec.select));
      continue;
    }
    out[k] = row[k];
  }
  return out;
}

function delegate(model) {
  return {
    async findMany({ where, select, take } = {}) {
      const list = rows[model].filter((r) => matches(r, where)).map((r) => shape(model, r, select));
      return take ? list.slice(0, take) : list;
    },
    async findFirst(args = {}) {
      return this.findUnique(args);
    },
    async findUnique({ where, select } = {}) {
      // Single-row lookups never "leak": they are keyed by id, and leaking
      // one would only return an arbitrary first row, which proves nothing.
      // The leak is a LIST that came back wider than asked.
      const on = leak.on;
      leak.on = false;
      try {
        const r = rows[model].find((x) => matches(x, where));
        return r ? shape(model, r, select) : null;
      } finally {
        leak.on = on;
      }
    },
    async update({ where, data }) {
      const r = rows[model].find((x) => x.id === where.id);
      writes.push({ model, action: "update", where, data });
      if (r) Object.assign(r, data);
      return r ? { ...r } : null;
    },
    async create({ data, select }) {
      const row = { id: `${model}_${rows[model].length + 1}`, createdAt: new Date(), ...data };
      rows[model].push(row);
      writes.push({ model, action: "create", data });
      return select ? shape(model, row, select) : { ...row };
    },
  };
}

export const db = new Proxy(
  {},
  {
    get(_, model) {
      if (typeof model !== "string") return undefined;
      if (model === "$disconnect") return async () => {};
      if (!rows[model]) throw new Error(`portalLinksStub: model ${model} is not scripted`);
      return delegate(model);
    },
  },
);
