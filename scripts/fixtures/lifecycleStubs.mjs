// scripts/fixtures/lifecycleStubs.mjs
//
// One module standing in for every specifier scripts/lifecycle-stub-hooks.mjs
// redirects. Each importer takes only the names it asked for, so a single
// file can be `@/lib/db`, `@/lib/stripe`, `@/lib/email/resend` and the rest
// at once — the shape scripts/fixtures/platformCancelStubs.mjs already uses.
//
// The state lives on `harness`, which the check resets between scenarios:
//
//   harness.db      a FakePrisma (scripts/fixtures/fakePrisma.mjs) — `where`
//                   is EVALUATED, so a query that drops its companyId reads
//                   another tenant's rows and the check sees it
//   harness.stripe  whatever object the scenario scripts; calls are recorded
//   harness.sent    every sendEmail call, in order — the anti-double-send
//                   property is a count over this array
//   harness.failFor addresses Resend should "reject"
//   harness.errors  every recordError call
//
// Nothing here can reach the network: there is no Resend client, no Stripe
// key and no Postgres behind any of it.
import { NextResponse } from "next/server";
import { FakePrisma } from "./fakePrisma.mjs";

export const harness = {
  db: null,
  stripe: null,
  stripeCalls: [],
  sent: [],
  failFor: new Set(),
  errors: [],
  member: null,
  activity: [],
  digestCalls: [],
  digestAnswer: null,
};

/** A FakePrisma with the few extra delegate methods these paths call. */
export function makeDb(tables, relations = {}) {
  const all = {
    company: [], subscription: [], member: [], user: [], plan: [],
    referralCredit: [], voiceCreditEntry: [], client: [],
    ...tables,
  };
  const fake = new FakePrisma(all, relations);
  for (const model of Object.keys(all)) {
    const d = fake[model];
    d.aggregate = async ({ where, _sum = {} }) => {
      fake.calls.push({ model, op: "aggregate", where: where || {} });
      const hits = fake.t[model].filter((r) => fake.match(model, r, where));
      const sum = {};
      for (const k of Object.keys(_sum)) sum[k] = hits.length ? hits.reduce((s, r) => s + (Number(r[k]) || 0), 0) : null;
      return { _sum: sum };
    };
  }
  return fake;
}

export function resetHarness({ tables = {}, relations = {}, stripe = null, member = null } = {}) {
  harness.db = makeDb(tables, relations);
  harness.stripe = stripe;
  harness.stripeCalls.length = 0;
  harness.sent.length = 0;
  harness.failFor.clear();
  harness.errors.length = 0;
  harness.member = member;
  harness.activity.length = 0;
  harness.digestCalls.length = 0;
  harness.digestAnswer = null;
  return harness.db;
}

// ── @/lib/db ────────────────────────────────────────────────────────────────
const forward = (get) =>
  new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === "then") return undefined;
        const target = get();
        if (!target) throw new Error(`lifecycleStubs: ${String(key)} used before resetHarness()`);
        const v = target[key];
        return typeof v === "function" ? v.bind(target) : v;
      },
    },
  );

export const db = forward(() => harness.db);
export const prisma = db;

// ── @/lib/stripe ────────────────────────────────────────────────────────────
export const stripe = forward(() => harness.stripe);

// ── @/lib/email/resend ──────────────────────────────────────────────────────
export const SENDER_SELECT = { name: true, email: true, emailDomain: true, emailDomainStatus: true, emailFromLocal: true };
export function senderFor(company = {}, platformFrom = "FieldQuo <hello@fieldquo.test>") {
  return { from: `${company?.name || "Company"} <quotes@fieldquo.test>`, replyTo: company?.email || undefined, platformFrom };
}
export function replyToHeader(replyTo) {
  return replyTo || undefined;
}
export async function sendEmail(mail) {
  if (harness.failFor.has(mail.to)) return { error: { message: "stubbed rejection" } };
  harness.sent.push(mail);
  return { id: `email_${harness.sent.length}` };
}

// ── @/lib/email/platformSender ──────────────────────────────────────────────
export async function getPlatformFrom() {
  return "FieldQuo <hello@fieldquo.test>";
}

// ── @/lib/platform/errorLog ─────────────────────────────────────────────────
export async function recordError(e) {
  harness.errors.push(e);
}
export function errorDetail(err, extra = {}) {
  return { message: err?.message, ...extra };
}

// ── @/lib/apiMember ─────────────────────────────────────────────────────────
export async function memberOrRefusal() {
  if (!harness.member) return { member: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { member: harness.member, response: null };
}
export async function memberOrRefusalPlain() {
  if (!harness.member) return { refusal: { error: "Unauthorized", status: 401 } };
  return { member: harness.member };
}

// ── @/lib/ai/monthlyDigest (for app/api/cron/monthly-digest only) ───────────
// Records which companies the cron asked for, and with what skipWhenEmpty;
// answers what harness.digestAnswer(companyId) says (default: a digest row).
export async function generateMonthlyDigest(args) {
  harness.digestCalls.push(args);
  const answer = typeof harness.digestAnswer === "function" ? harness.digestAnswer(args) : null;
  return answer || { id: `digest_${args.companyId}` };
}

// ── @/lib/activity/log ──────────────────────────────────────────────────────
export async function recordActivity(member, entry) {
  harness.activity.push({ member, entry });
}
