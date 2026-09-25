// scripts/check-ai-wallet-meter.mjs
//
//   npm run check:ai-wallet-meter
//
// The owner, 2026-09-25: "FieldQuo AI is okay if it's us. But the AI chat
// settings in the agentic employee should be theirs to pay — their own chat
// bot." So the copilot and translation moved onto FieldQuo's budget, and the
// AI employee is charged in DOLLARS from the company's AI credit
// (lib/ai/walletMeter.js), with a one-time grace for companies whose wallet
// was empty on the day it shipped.
//
// Every claim below is EXECUTED against a scripted database, not read:
//
//   1. The charge: cost × the pay-as-you-go multiplier, rounded UP to the cent,
//      and hostile numbers (NaN, negative, Infinity, strings) charge nothing.
//   2. Debit idempotency: the same reply recorded twice is ONE ledger row —
//      the database's unique (companyId, ref) index is what enforces it here,
//      exactly as it does in Postgres.
//   3. An empty wallet after the grace: NO model call, the thread handed to a
//      person with the NO_CREDIT reason, the company notified, nothing debited.
//   4. The grace window: before AI_EMPLOYEE_GRACE_ENDS_ON an empty wallet
//      falls back to the monthly allowance exactly as before (and is refused
//      when the allowance is spent); a funded wallet is charged from day one.
//   5. The copilot never touches the company's allowance: its meter never
//      calls checkAiQuota or recordAiUsage, it records to FieldQuo's ledger,
//      and its per-company fair-use ceiling is counted on FieldQuo's ledger.
//   6. The /platform switch still works: move the AI employee to FieldQuo and
//      nothing is debited from anyone's credit.
import { readFileSync } from "node:fs";
import {
  walletVerdict,
  walletLedger,
  estimateChargeCents,
  chargeCentsForUsage,
  inAiEmployeeGrace,
  AI_EMPLOYEE_GRACE_ENDS_ON,
  AI_EMPLOYEE_GRACE_ENDS_AT,
  WALLET_EMPTY_REASON,
} from "@/lib/ai/walletMeter";
import { chatChargeCents, PAY_AS_YOU_GO_MULTIPLIER } from "@/lib/ai/imageEconomics";
import { estimateCostMicros, allowanceVerdict, TYPICAL_CONVERSATION_TOKENS } from "@/lib/ai/usage";
import { meterFor, clearPayerCache, PAYER_FEATURES, companyLedgerFor } from "@/lib/ai/featurePayer";
import { poolForKind, POOLS } from "@/lib/voice/credits";
import { spendVerdict } from "@/lib/voice/spendGate";
import { respondToMessage } from "@/lib/aiEmployee/respond";
import { SKIP } from "@/lib/aiEmployee/decide";
import { AI_BEST_MODEL, AI_MODEL } from "@/lib/ai/provider";

let passed = 0;
let failed = 0;
const ok = (label, cond, detail) => {
  if (cond) passed++;
  else failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || detail === undefined ? "" : `  — ${JSON.stringify(detail)}`}`);
};
const section = (t) => console.log(`\n${t}\n`);
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BEFORE_END = new Date("2026-09-28T12:00:00Z");
const AFTER_END = new Date("2026-10-02T12:00:00Z");

// ── A scripted Prisma: equality, in, not, gte/lt, OR, and the ledger's unique
//    (companyId, ref) index, enforced the way Postgres enforces it (P2002). ──
function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    const val = row[k];
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      if ("path" in v) { if ((val || {})[v.path[0]] !== v.equals) return false; continue; }
      if ("in" in v && !v.in.includes(val)) return false;
      if ("not" in v && (v.not === null ? val == null : val === v.not)) return false;
      if ("gte" in v && !(new Date(val) >= new Date(v.gte))) return false;
      if ("lt" in v && !(new Date(val) < new Date(v.lt))) return false;
      if (!["in", "not", "gte", "lt"].some((x) => x in v) && !matches(val || {}, v)) return false;
      continue;
    }
    if (val !== v) return false;
  }
  return true;
}
function makeDb(seed = {}) {
  const store = {
    aiEmployee: [], messageThread: [], message: [], aiEmployeeReply: [], aiEmployeeRoutingEvent: [],
    aiEmployeeSource: [], company: [], aiFeaturePayer: [], voiceCreditEntry: [], platformAiUsage: [], platformAiBudget: [],
    ...seed,
  };
  let seq = 0;
  const model = (name) => ({
    findMany: async ({ where, take } = {}) => { const r = store[name].filter((x) => matches(x, where)); return take ? r.slice(0, take) : r; },
    findFirst: async ({ where } = {}) => store[name].find((x) => matches(x, where)) || null,
    findUnique: async ({ where } = {}) => store[name].find((x) => matches(x, where)) || null,
    count: async ({ where } = {}) => store[name].filter((x) => matches(x, where)).length,
    create: async ({ data }) => {
      if (name === "voiceCreditEntry" && data.ref && store[name].some((r) => r.companyId === data.companyId && r.ref === data.ref)) {
        const err = new Error("Unique constraint failed on (companyId, ref)");
        err.code = "P2002";
        throw err;
      }
      const row = { id: `${name}_${++seq}`, createdAt: new Date(), ...data };
      store[name].push(row);
      return row;
    },
    update: async ({ where, data }) => { const row = store[name].find((x) => matches(x, where)); if (!row) throw new Error(`no ${name}`); Object.assign(row, data); return row; },
    aggregate: async ({ where, _sum = {} } = {}) => {
      const rows = store[name].filter((x) => matches(x, where));
      return { _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)])) };
    },
  });
  const db = { $store: store };
  for (const name of Object.keys(store)) db[name] = model(name);
  return db;
}
const credit = (cents, companyId = "C1") => ({ id: `seed_${cents}`, companyId, pool: "ai", kind: "ai_topup", cents });
const walletOf = (db, companyId = "C1") => db.$store.voiceCreditEntry.filter((r) => r.companyId === companyId && r.pool === "ai").reduce((a, r) => a + r.cents, 0);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The charge: cost × multiplier, rounded up, never a NaN debit");
// ═══════════════════════════════════════════════════════════════════════════
ok("the multiplier is the images' 2x (the ~50% margin approved 2026-08-30)", PAY_AS_YOU_GO_MULTIPLIER === 2);
for (const [input, want] of [[0, 0], [-5, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0], ["abc", 0], [null, 0], [undefined, 0], [1, 1], [4_999, 1], [5_000, 1], [5_001, 2], [10_000, 2], [63_000, 13], [84_000, 17], ["63000", 13]]) {
  ok(`chatChargeCents(${String(input)}) = ${want}¢`, chatChargeCents(input) === want, chatChargeCents(input));
}
const typical = estimateCostMicros({ model: "gpt-5.5", promptTokens: TYPICAL_CONVERSATION_TOKENS.prompt, completionTokens: TYPICAL_CONVERSATION_TOKENS.completion });
ok("a typical reply on gpt-5.5 costs 63,000 micros ($0.063) — 9,000 in at $5/M + 600 out at $30/M", typical === 63_000, typical);
ok("…so the pre-reply gate needs 13¢ (12.6¢ rounded up)", estimateChargeCents("ai_employee_reply", { model: "gpt-5.5" }) === 13, estimateChargeCents("ai_employee_reply", { model: "gpt-5.5" }));
ok(`…and the gate uses the employee's own tier by default (${AI_BEST_MODEL})`, estimateChargeCents("ai_employee_reply") === estimateChargeCents("ai_employee_reply", { model: AI_BEST_MODEL }));
ok(`the front desk's estimate on the standard tier (${AI_MODEL}) is the 1¢ floor — sub-cent cost, rounded up`, estimateChargeCents("ai_employee_front_desk") === 1, estimateChargeCents("ai_employee_front_desk"));
ok("a real reply is charged from its ACTUAL tokens: 12,000 in + 800 out on gpt-5.5 = 17¢", chargeCentsForUsage({ model: "gpt-5.5", promptTokens: 12_000, completionTokens: 800 }) === 17);
ok("a usage with garbage token counts charges nothing rather than NaN", chargeCentsForUsage({ model: "gpt-5.5", promptTokens: "lots", completionTokens: -3 }) === 0);
ok("no usage, no charge", chargeCentsForUsage(null) === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The verdict, pure — and the grace boundary");
// ═══════════════════════════════════════════════════════════════════════════
ok(`the grace ends on ${AI_EMPLOYEE_GRACE_ENDS_ON} at 00:00 UTC, a single constant`, AI_EMPLOYEE_GRACE_ENDS_AT.toISOString() === `${AI_EMPLOYEE_GRACE_ENDS_ON}T00:00:00.000Z`);
ok("one millisecond before it is inside the grace", inAiEmployeeGrace(new Date(AI_EMPLOYEE_GRACE_ENDS_AT.getTime() - 1)));
ok("the instant itself is not", !inAiEmployeeGrace(AI_EMPLOYEE_GRACE_ENDS_AT));
ok("a garbage clock is never 'in grace'", !inAiEmployeeGrace("not a date"));
ok("a balance that covers one reply is charged to the wallet", walletVerdict({ balanceCents: 13, needCents: 13, now: AFTER_END }).billing === "wallet");
ok("…in the grace too — a funded wallet pays from day one", walletVerdict({ balanceCents: 13, needCents: 13, now: BEFORE_END }).billing === "wallet");
ok("one cent short, inside the grace → the allowance", walletVerdict({ balanceCents: 12, needCents: 13, now: BEFORE_END }).billing === "grace");
{
  const v = walletVerdict({ balanceCents: 12, needCents: 13, now: AFTER_END });
  ok("one cent short, after the grace → refused, code no_credit", v.allowed === false && v.code === "no_credit" && v.reason === WALLET_EMPTY_REASON, v);
}
ok("a NaN balance counts as empty, never as enough", walletVerdict({ balanceCents: NaN, needCents: 13, now: AFTER_END }).allowed === false);
ok("an overdrawn wallet is refused", walletVerdict({ balanceCents: -40, needCents: 13, now: AFTER_END }).allowed === false);
ok("a zero or NaN estimate is treated as 1¢ — a reply is never free", walletVerdict({ balanceCents: 0, needCents: 0, now: AFTER_END }).allowed === false && walletVerdict({ balanceCents: 0, needCents: NaN, now: AFTER_END }).needCents === 1);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Debit idempotency, per AiEmployeeReply id");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = makeDb({ voiceCreditEntry: [credit(1000)] });
  const usageRows = [];
  const meter = walletLedger("ai_employee_reply", { companyId: "C1", prisma: db, now: AFTER_END, deps: { recordAiUsage: async (u) => usageRows.push(u), checkAiQuota: async () => { throw new Error("the allowance must not be asked"); } } });
  const gate = await meter.check();
  ok("a $10 wallet admits the reply on the wallet", gate.allowed === true && gate.billing === "wallet" && gate.balanceCents === 1000);
  const u = { model: "gpt-5.5", promptTokens: 12_000, completionTokens: 800 };
  const a = await meter.record(u, { ref: "ai_employee_reply:R1" });
  const b = await meter.record(u, { ref: "ai_employee_reply:R1" });
  const debits = db.$store.voiceCreditEntry.filter((r) => r.kind === "ai_employee_reply");
  ok("recording the same reply twice writes ONE debit", debits.length === 1, debits);
  ok("…of 17¢, negative, in the AI pool", debits[0]?.cents === -17 && debits[0]?.pool === "ai" && poolForKind("ai_employee_reply") === POOLS.AI);
  ok("…and both records report the same 17¢ charge", a.chargedCents === 17 && b.chargedCents === 17, { a: a.chargedCents, b: b.chargedCents });
  ok("the balance moved by exactly one charge", walletOf(db) === 983, walletOf(db));
  ok("the AiUsage row is still written, marked paid-from-wallet (kept out of the allowance)", usageRows.length === 2 && usageRows.every((r) => r.feature === "ai_employee_reply" && r.paidFromWallet === true));
  await meter.record(u, { ref: "ai_employee_reply:R2" });
  ok("a different reply is a different charge", db.$store.voiceCreditEntry.filter((r) => r.kind === "ai_employee_reply").length === 2 && walletOf(db) === 966);
  // A record nobody checked first is charged, never free.
  const unchecked = walletLedger("ai_employee_reply", { companyId: "C1", prisma: db, now: AFTER_END, deps: { recordAiUsage: async () => {} } });
  const c = await unchecked.record(u, { ref: "ai_employee_reply:R3" });
  ok("a record() with no check() is charged to the wallet, not given away", c.billing === "wallet" && c.chargedCents === 17);
  // A ledger that throws must not throw at the caller.
  const broken = walletLedger("ai_employee_reply", { companyId: "C1", prisma: db, now: AFTER_END, deps: { recordAiUsage: async () => {}, debitCredit: async () => { throw new Error("ledger down"); } } });
  await broken.check();
  const d = await broken.record(u, { ref: "ai_employee_reply:R4" });
  ok("a ledger failure is reported as 0¢ charged, never thrown", d.chargedCents === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The AI employee end to end: empty wallet → no model call, a person");
// ═══════════════════════════════════════════════════════════════════════════
const company = { id: "C1", name: "Acme Painting", businessHours: null, timezone: "America/Toronto", defaultLanguage: "en" };
const t0 = new Date("2026-09-20T15:00:00Z");
const seedThread = (extra = {}) => ({
  aiEmployee: [{ id: "R", companyId: "C1", role: "receptionist", name: "Rosa", displayName: "Rosa", enabled: true, mode: "auto", maxRepliesPerThread: 3, businessHoursOnly: false, disabledTools: [], channels: ["web"], instructionsFingerprint: "f", createdAt: t0 }],
  messageThread: [{ id: "th1", companyId: "C1", status: "open", participantName: "Sam", channel: { platform: "web" }, lastInboundAt: t0, assignedEmployeeId: null, routingIntent: null, routingReason: null, humanTookOverAt: null }],
  message: [{ id: "m1", threadId: "th1", direction: "in", private: false, body: "Can someone come and look at my deck?", sentAt: t0, attachments: null, failedReason: null, sentByUserId: null }],
  company: [company],
  ...extra,
});
function run(db, { now, quota = { allowed: true }, payer = null } = {}) {
  clearPayerCache();
  if (payer) db.$store.aiFeaturePayer.push({ feature: "ai_employee_reply", payer });
  const seen = { loops: 0, usage: [], notified: [], sent: [], platform: [] };
  const deps = {
    db,
    now,
    checkAiQuota: async () => quota,
    recordAiUsage: async (u) => { seen.usage.push(u); },
    isAiConfigured: () => true,
    notify: async (n) => { seen.notified.push(n); },
    sleep: async () => {},
    runToolLoop: async ({ onUsage }) => {
      seen.loops++;
      await onUsage?.({ model: "gpt-5.5", promptTokens: 12_000, completionTokens: 800 });
      return { text: "Happy to help — when suits you?" };
    },
  };
  const send = async (text) => { seen.sent.push(text); return { ok: true }; };
  return { seen, go: () => respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send, deps }) };
}
{
  const db = makeDb(seedThread());
  const { seen, go } = run(db, { now: AFTER_END });
  const out = await go();
  ok("after the grace, an empty wallet refuses with NO_CREDIT", out.replied === false && out.reason === SKIP.NO_CREDIT, out);
  ok("…and the model is NEVER called", seen.loops === 0);
  const row = db.$store.aiEmployeeReply[0];
  ok("…the thread is handed to a person, the reason on the row", row?.handedOff === true && row?.handoffReason === SKIP.NO_CREDIT && row?.suppressedReason === SKIP.NO_CREDIT, row);
  ok("…the company is notified by name", seen.notified.some((n) => n.type === "ai_employee.handoff" && n.params?.reason === SKIP.NO_CREDIT));
  ok("…nothing is sent and nothing is debited", seen.sent.length === 0 && db.$store.voiceCreditEntry.length === 0);
}
{
  const db = makeDb(seedThread({ voiceCreditEntry: [credit(1000)] }));
  const { seen, go } = run(db, { now: AFTER_END, quota: { allowed: false, reason: "allowance spent" } });
  const out = await go();
  const row = db.$store.aiEmployeeReply[0];
  ok("a funded wallet replies — whatever the monthly allowance says", out.replied === true && seen.loops === 1, out);
  const debit = db.$store.voiceCreditEntry.find((r) => r.kind === "ai_employee_reply");
  ok("…one debit, keyed on the reply row it paid for", debit?.ref === `ai_employee_reply:${row.id}` && debit?.cents === -17, debit);
  ok("…the reply row carries the charge and the vendor cost separately", row.chargedCents === 17 && row.costCents === 9, { chargedCents: row.chargedCents, costCents: row.costCents });
  ok("…and the AiUsage row is written, paid from the wallet", seen.usage.length === 1 && seen.usage[0].paidFromWallet === true && seen.usage[0].feature === "ai_employee_reply");
  ok("…the result reports what was charged", out.chargedCents === 17);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The grace window, end to end");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = makeDb(seedThread());
  const { seen, go } = run(db, { now: BEFORE_END, quota: { allowed: true } });
  const out = await go();
  ok("inside the grace, an empty wallet still replies — on the allowance, as before", out.replied === true && seen.loops === 1, out);
  ok("…nothing is debited from the empty wallet", db.$store.voiceCreditEntry.length === 0);
  ok("…the AiUsage row counts against the allowance (paidFromWallet false)", seen.usage.length === 1 && seen.usage[0].paidFromWallet === false);
  ok("…and the reply row shows no charge", db.$store.aiEmployeeReply[0].chargedCents === undefined || db.$store.aiEmployeeReply[0].chargedCents === null);
}
{
  const db = makeDb(seedThread());
  const { seen, go } = run(db, { now: BEFORE_END, quota: { allowed: false, reason: "You've used this month's FieldQuo AI allowance." } });
  const out = await go();
  ok("inside the grace with the allowance spent: NO_CREDIT, no model call — the old behaviour exactly", out.reason === SKIP.NO_CREDIT && seen.loops === 0);
}
{
  const db = makeDb(seedThread({ voiceCreditEntry: [credit(500)] }));
  const { go } = run(db, { now: BEFORE_END });
  await go();
  ok("inside the grace, a FUNDED wallet is already charged", db.$store.voiceCreditEntry.some((r) => r.kind === "ai_employee_reply" && r.cents === -17));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The /platform switch: move the AI employee to FieldQuo");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = makeDb(seedThread());
  const { seen, go } = run(db, { now: AFTER_END, payer: "fieldquo" });
  const out = await go();
  ok("with FieldQuo paying, an empty wallet does not stop the employee", out.replied === true && seen.loops === 1, out);
  ok("…nothing is debited from anyone's credit", db.$store.voiceCreditEntry.length === 0);
  ok("…the spend is on FieldQuo's ledger, attributed to the company", db.$store.platformAiUsage.length === 1 && db.$store.platformAiUsage[0].area === "ai_employee_reply" && db.$store.platformAiUsage[0].meta?.companyId === "C1");
  ok("…and the company's allowance ledger is untouched", seen.usage.length === 0);
  clearPayerCache();
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The copilot never touches the company's allowance");
// ═══════════════════════════════════════════════════════════════════════════
{
  clearPayerCache();
  const db = makeDb();
  const forbidden = async () => { throw new Error("the company allowance was touched"); };
  let used = 0;
  const meter = await meterFor("copilot", {
    companyId: "C1",
    prisma: db,
    now: AFTER_END,
    deps: {
      checkAiQuota: forbidden,
      recordAiUsage: forbidden,
      getAiCap: async () => ({ cap: 1_000, source: "plan" }),
    },
  });
  ok("the copilot's default payer is FieldQuo", meter.payer === "fieldquo" && meter.ledger === "fieldquo");
  const gate = await meter.check();
  ok("…its check never asks checkAiQuota", gate.allowed === true);
  await meter.record({ model: "gpt-5-mini", promptTokens: 400, completionTokens: 200 });
  const row = db.$store.platformAiUsage[0];
  ok("…its record never writes AiUsage — it lands on FieldQuo's ledger, tagged with the company", row?.area === "copilot" && row?.meta?.companyId === "C1" && row?.totalTokens === 600);
  // The fair-use ceiling: the allowance's SIZE, counted on FieldQuo's ledger.
  db.$store.platformAiUsage.push({ area: "copilot", createdAt: AFTER_END, meta: { companyId: "C1" }, totalTokens: 900 });
  const near = await meter.check();
  ok("900 of a 1,000-token ceiling: still allowed, and warned at 80%", near.allowed === true && near.nearLimit === true && near.usage?.tokens === 900 && near.cap === 1_000, near);
  db.$store.platformAiUsage.push({ area: "copilot", createdAt: AFTER_END, meta: { companyId: "C1" }, totalTokens: 200 });
  const over = await meter.check();
  ok("past it: refused with the allowance's own words, code quota", over.allowed === false && over.code === "quota" && /allowance/.test(over.reason || ""), over);
  db.$store.platformAiUsage.push({ area: "copilot", createdAt: AFTER_END, meta: { companyId: "OTHER" }, totalTokens: 999_999 });
  const other = await meterFor("copilot", { companyId: "C2", prisma: db, now: AFTER_END, deps: { checkAiQuota: forbidden, recordAiUsage: forbidden, getAiCap: async () => ({ cap: 1_000 }) } });
  ok("…counted per company — another company's use is not this one's", (await other.check()).allowed === true);
  const lastMonth = await meterFor("copilot", { companyId: "C1", prisma: db, now: new Date("2026-11-02T12:00:00Z"), deps: { checkAiQuota: forbidden, recordAiUsage: forbidden, getAiCap: async () => ({ cap: 1_000 }) } });
  ok("…and it resets with the month", (await lastMonth.check()).allowed === true);
  const unlimited = await meterFor("copilot", { companyId: "C1", prisma: db, now: AFTER_END, deps: { checkAiQuota: forbidden, recordAiUsage: forbidden, getAiCap: async () => ({ cap: null }) } });
  ok("an explicit null cap is unlimited here too", (await unlimited.check()).allowed === true);
  ok("translation defaults to FieldQuo as well", (await meterFor("translation", { companyId: "C1", prisma: db, deps: { checkAiQuota: forbidden, recordAiUsage: forbidden } })).payer === "fieldquo");
  ok("the pure verdict matches checkAiQuota's words", /allowance/.test(allowanceVerdict({ usage: { tokens: 5 }, cap: 5 }).reason) && allowanceVerdict({ usage: { tokens: 0 }, cap: 0 }).allowed === false);
  const route = code("app/api/ai/copilot/route.js");
  ok("the copilot route meters through meterFor(\"copilot\") and nothing else", /meterFor\("copilot"/.test(route) && !/checkAiQuota|recordAiUsage/.test(route));
  clearPayerCache();
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Wiring that cannot be executed offline, read");
// ═══════════════════════════════════════════════════════════════════════════
{
  const usage = code("lib/ai/usage.js");
  ok("checkAiQuota leaves wallet-paid rows out of the allowance", /getMonthlyUsage\(companyId, \{ allowanceOnly: true \}\)/.test(usage) && /allowanceOnly \? \{ paidFromWallet: false \} : \{\}/.test(usage));
  ok("recordAiUsage writes the flag", /paidFromWallet: paidFromWallet === true/.test(usage));
  ok("the schema carries both new columns", /paidFromWallet Boolean @default\(false\)/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")) && /chargedCents\s+Int\?/.test(readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")));
  ok("the AI employee's features are registered on the wallet ledger", companyLedgerFor("ai_employee_reply") === "wallet" && companyLedgerFor("ai_employee_front_desk") === "wallet" && companyLedgerFor("copilot") === "allowance");
  ok("both kinds are AI-wallet kinds", poolForKind("ai_employee_reply") === POOLS.AI && poolForKind("ai_employee_front_desk") === POOLS.AI);
  ok("the flat spend gate REFUSES them — no free pass at 0¢", spendVerdict({ kind: "ai_employee_reply", balanceCents: 99_999 }).allowed === false && spendVerdict({ kind: "ai_employee_reply", balanceCents: 99_999 }).reason === "priced_per_call");
  const respond = code("lib/aiEmployee/respond.js");
  ok("respond.js checks the meter before the model and records against the reply id", respond.indexOf("meter.check()") > -1 && respond.indexOf("meter.check()") < respond.indexOf("runLoop(") && /ref: replyId \? `ai_employee_reply:\$\{replyId\}`/.test(respond));
  ok("the charge is stamped on the reply only after the ledger answered", /if \(replyId && charged > 0\)/.test(respond));
  const settings = code("app/api/ai-employee/route.js");
  ok("the settings route asks the SAME meter a reply does", /meterFor\(AI_EMPLOYEE_FEATURE/.test(settings) && /meter\.check\(\)/.test(settings) && /"paused"/.test(settings));
  const page = code("app/app/settings/ai-employee/page.js");
  ok("the settings page renders the paused notice with the top-up/bundle button", /app\.aiEmployee\.pausedTitle/.test(page) && /billing === "paused"/.test(page) && /\/app\/settings\/ai-credit/.test(page) && /app\.aiEmployee\.topUpOrBundle/.test(page));
  ok("…and the grace banner with its date", /billing === "grace"/.test(page) && /app\.aiEmployee\.graceBanner/.test(page) && /graceEndsOn/.test(page));
  const billing = code("app/api/platform/ai-billing/route.js");
  ok("/platform/ai-billing sums the dollars debited per company", /voiceCreditEntry\.groupBy\(\{ by: \["companyId", "kind"\]/.test(billing) && /aiEmployeeCharges/.test(billing));
  ok("every registered feature is wired", PAYER_FEATURES.every((f) => f.wired));
}

console.log(`\ncheck-ai-wallet-meter: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
