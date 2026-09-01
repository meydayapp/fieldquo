// scripts/check-voice-spend.mjs
//
//   npm run check:voice-spend
//
// Nothing costs FieldQuo money before the company has paid for it.
//
// ══ Why this file is not a style check ═════════════════════════════════════
//
// FieldQuo holds ONE Retell account. Every number "a tenant" buys is billed to
// FieldQuo, immediately and every month after, whether or not that contractor
// ever pays. Two leaks were live:
//
//   1. POST /api/settings/voice/number bought a real phone number with no
//      balance check of any kind, then GRANTED 30 minutes of credit on top.
//   2. The monthly rental was written to VoicePhoneNumber.monthlyCents at
//      purchase and never billed to anyone. Talk time drew down correctly; the
//      $4/$9 a month never left the database.
//
// So these assertions are about money leaving a bank account. The pure ones
// EXECUTE the real decision functions against hostile input — a NaN balance, a
// number with no rental, a cron that hasn't run for four months. The ledger ones
// execute the real credits.js and spendGate.js against a stubbed database that
// enforces the same unique constraint Postgres does, so "the free trial can't be
// granted twice" is demonstrated rather than asserted about source.
//
// The source-reading assertions are the ones with no single call site to
// capture: the ORDER of reserve-then-buy inside a route handler, and the fact
// that no second copy of the gate has appeared somewhere else.
//
// ── Run it with node, via the alias loader ─────────────────────────────────
//
//   node --import ./scripts/alias-loader.mjs scripts/check-voice-spend.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { register } from "node:module";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

let fail = 0;
const ok = (c, m, detail) => {
  console.log((c ? "✓ " : "✗ ") + m);
  if (!c) {
    fail++;
    if (detail) console.log(`    ${detail}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   A stubbed database, with the constraint that matters
   ═══════════════════════════════════════════════════════════════════════════

   The ledger's guarantees are database guarantees: the balance is a SUM, and a
   spend with a `ref` happens once because a unique index says so. Asserting
   those by reading source proves nothing — the whole point is what the database
   does when two writes race. So this stub implements @@unique([companyId, ref])
   and throws Prisma's own P2002, and the real credits.js runs against it.

   Everything else is a Proxy that answers politely, so importing the gate
   doesn't drag in models this file has no opinion about. */

function makeDb() {
  const entries = [];
  const numbers = new Map();

  const voiceCreditEntry = {
    async aggregate({ where, _sum }) {
      const rows = entries.filter((e) => e.companyId === where.companyId);
      return { _sum: { cents: rows.reduce((n, e) => n + e.cents, 0) } };
    },
    async findFirst({ where }) {
      return (
        entries.find((e) =>
          Object.entries(where).every(([k, v]) => (v === undefined ? true : e[k] === v)),
        ) || null
      );
    },
    async findMany({ where }) {
      return entries.filter((e) => e.companyId === where.companyId);
    },
    async create({ data }) {
      if (data.ref != null) {
        const clash = entries.find((e) => e.companyId === data.companyId && e.ref === data.ref);
        // The real thing. Prisma raises P2002 on a unique violation, and
        // credits.js catching it is the difference between "idempotent" and
        // "idempotent unless two requests arrive together".
        if (clash) {
          const err = new Error("Unique constraint failed on (companyId, ref)");
          err.code = "P2002";
          throw err;
        }
      }
      const row = { id: `e${entries.length + 1}`, createdAt: new Date(), ...data };
      entries.push(row);
      return row;
    },
  };

  const voicePhoneNumber = {
    async update({ where, data }) {
      const row = { ...(numbers.get(where.id) || { id: where.id }), ...data };
      numbers.set(where.id, row);
      return row;
    },
    async findFirst() {
      return numbers.values().next().value || null;
    },
    async findMany() {
      return [...numbers.values()];
    },
  };

  const base = {
    voiceCreditEntry,
    voicePhoneNumber,
    company: { async findUnique() { return { id: "co", name: "Test Co", email: null, country: "CA" }; } },
    member: { async findFirst() { return null; } },
    platformErrorLog: { async create() { return null; } },
    __entries: entries,
    __numbers: numbers,
  };

  // Anything not modelled above answers with a shrug rather than a TypeError —
  // the gate imports the error log and the email sender, and neither is what
  // this file is testing.
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return new Proxy(
        {},
        { get: () => async () => null },
      );
    },
  });
}

globalThis.__FQ_DB = makeDb();

// Swap "@/lib/db" for that stub, everywhere, before anything imports it. The
// hook is registered after alias-loader's, and hooks run most-recent-first, so
// this one wins for the single specifier it cares about and defers on the rest.
const HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    // A Proxy, not a snapshot. Every scenario below wants a fresh, empty
    // ledger, and \`export const db = globalThis.__FQ_DB\` would bind whichever
    // one existed at import time — so a later reset would silently be ignored
    // and half these assertions would be reading the wrong database.
    return {
      format: "module",
      shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
    };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const credits = await import("@/lib/voice/credits");
const gate = await import("@/lib/voice/spendGate");
const numbersLib = await import("@/lib/voice/numbers");

const {
  balanceFor, addCredit, debitCredit, chargeCall, grantFreeTrial, trialGranted,
  monthlyCentsFor, ratePerMinute, canTakeCall, TRIAL_REF, CENTS_PER_MINUTE,
} = credits;
const {
  SPEND_KINDS, priceSpend, spendVerdict, checkSpend, reserveSpend, refundReservation,
  rentDecision, rentRef, rentFor, rentStatus, billNumberRent,
  RENT_PERIOD_DAYS, RENT_GRACE_DAYS, RENT_WARN_AHEAD_DAYS,
} = gate;
const { isTollFreeNumber } = numbersLib;

const DAY = 24 * 60 * 60 * 1000;
const src = (p) => readFileSync(p, "utf8");
/** Source with comments stripped — a comment naming a function is not a call. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ROUTE = "app/api/settings/voice/number/route.js";
const SETTINGS = "app/api/settings/voice/route.js";
const PAGE = "app/app/settings/voice/page.js";
const CRON = "app/api/cron/voice-rent/route.js";
const GATE = "lib/voice/spendGate.js";

console.log("\n── What each spend costs, and whether it's affordable ──────────────\n");

ok(priceSpend("number_setup", "local") === monthlyCentsFor("local"),
   `a local number's first month is ${monthlyCentsFor("local")}¢ — the same price the settings screen shows`);
ok(priceSpend("number_setup", "toll_free") > priceSpend("number_setup", "local"),
   `toll-free costs more up front (${priceSpend("number_setup", "toll_free")}¢ vs ${priceSpend("number_setup", "local")}¢)`);
ok(priceSpend("call", "toll_free") === ratePerMinute("toll_free"),
   `a call's floor is one minute at the number's own rate (${ratePerMinute("toll_free")}¢ toll-free)`);
ok(priceSpend("number_rent", "local") === priceSpend("number_setup", "local"),
   "the first month and every month after are the same price — no teaser rate to explain later");

// Fail CLOSED. A typo in a future caller must be refused, not waved through.
ok(spendVerdict({ kind: "who_knows", balanceCents: 999999 }).allowed === false,
   "an unknown spend kind is REFUSED even with money in the account");
ok(priceSpend("who_knows") === 0, "…and prices at zero rather than NaN");

const need = priceSpend("number_setup", "local");
ok(spendVerdict({ kind: "number_setup", balanceCents: need }).allowed === true,
   `exactly ${need}¢ is enough — the boundary is inclusive`);
const short = spendVerdict({ kind: "number_setup", balanceCents: need - 1 });
ok(short.allowed === false && short.shortfallCents === 1,
   "one cent short is refused, and the shortfall is reported to the cent");

let hostileClean = true;
for (const balance of [NaN, null, undefined, "abc", -50000, "", {}, []]) {
  const v = spendVerdict({ kind: "number_setup", balanceCents: balance });
  if (v.allowed || v.shortfallCents < 0 || !Number.isFinite(v.shortfallCents)) {
    hostileClean = false;
    console.log(`   ✗ balance ${JSON.stringify(balance)} → ${JSON.stringify(v)}`);
  }
}
ok(hostileClean, "a NaN, null, negative or non-numeric balance can never buy anything");
ok(spendVerdict({ kind: "number_setup", balanceCents: Infinity }).allowed === false,
   "Infinity is rubbish too — no real balance is infinite, and the guard fails closed on it");
ok(spendVerdict({ kind: "number_setup", balanceCents: 100000 }).allowed === true,
   "…while an ordinary large balance still passes (it rejects rubbish, not arithmetic)");

console.log("\n── The gate is ONE helper ──────────────────────────────────────────\n");

// The failure this prevents: a new voice feature that spends money writes its
// own `if (cents < X)`. The second copy is the one that rots, because it's the
// one nobody looks at.
const BALANCE_TEST = /\b(cents|balance|balanceCents)\s*[<>]=?\s*/;
const allowedToJudge = new Set(["lib/voice/spendGate.js", "lib/voice/credits.js"]);
const judges = [];
for (const dir of ["lib/voice", "app/api/settings/voice", "app/api/cron"]) {
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = `${d}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) {
        if (allowedToJudge.has(full)) continue;
        if (BALANCE_TEST.test(code(src(full)))) judges.push(full);
      }
    }
  };
  walk(dir);
}
ok(judges.length === 0,
   "no file outside credits.js/spendGate.js decides affordability for itself",
   `these compare a balance inline: ${judges.join(", ")}`);

ok(existsSync(GATE), "there is exactly one gate module, lib/voice/spendGate.js");
ok(Object.keys(SPEND_KINDS).length >= 3 &&
   ["number_setup", "number_rent", "call"].every((k) => SPEND_KINDS[k]),
   `it enumerates every spend: ${Object.keys(SPEND_KINDS).join(", ")}`);

// The gate must agree with the pre-existing call gate rather than being a
// second opinion about the same question. provision.js and outboundCall.js call
// canTakeCall directly and can't be pointed at the gate, so drift here means an
// outbound call placed that the receptionist would have refused.
globalThis.__FQ_DB = makeDb();
await addCredit({ companyId: "agree", cents: ratePerMinute("toll_free"), kind: "topup", stripeRef: "s1" });
const viaGate = await checkSpend({ companyId: "agree", kind: "call", numberType: "toll_free" });
const viaCredits = await canTakeCall("agree", "toll_free");
ok(viaGate.allowed === viaCredits.allowed && viaGate.balanceCents === viaCredits.cents,
   "checkSpend({kind:'call'}) and canTakeCall give the same answer — one rule, two doors");

globalThis.__FQ_DB = makeDb();
await addCredit({ companyId: "tf", cents: ratePerMinute("local"), kind: "topup", stripeRef: "s2" });
ok((await checkSpend({ companyId: "tf", kind: "call", numberType: "toll_free" })).allowed === false,
   `a toll-free line needs ${ratePerMinute("toll_free")}¢ for its first minute, not the ${ratePerMinute("local")}¢ local rate`);

console.log("\n── Money moves BEFORE the provider is called ───────────────────────\n");

const routeSrc = code(src(ROUTE));
ok(/reserveSpend\s*\(/.test(routeSrc), "the buy route reserves through the gate");
ok(routeSrc.indexOf("reserveSpend") < routeSrc.indexOf("buyNumber("),
   "…and it reserves BEFORE buyNumber — check-then-buy-then-charge is no gate at all");
ok(/status:\s*402/.test(routeSrc),
   "a company that can't afford it gets 402, distinct from the 403 a non-admin gets");
// The CALL, not the import. `refundReservation` appearing in an import list is
// not a refund — a mutation that renamed the call while leaving the import
// survived exactly that mistake.
ok(/refundReservation\s*\(\s*\{/.test(routeSrc) &&
   routeSrc.lastIndexOf("refundReservation({") > routeSrc.indexOf("catch (err)"),
   "a provider failure refunds the reservation, inside the catch — otherwise they're down a month's rent for nothing");
ok(/if \(!row\)/.test(routeSrc),
   "…and only when the number never made it into the database; a hiccup after that must not hand back rent on a live line");
ok(/const overpaid = reserved\.needCents - actualMonthly;/.test(routeSrc) &&
   /overpaid > 0/.test(routeSrc),
   "an overcharge — toll-free money for a local line — is refunded on the spot, not left for someone to notice");
ok(!/\baddCredit\s*\(/.test(routeSrc),
   "the route never writes credit directly; the trial goes through grantFreeTrial, which is where 'once' is enforced");
ok(/rentPaidThroughAt/.test(routeSrc),
   "…and it records what the up-front month paid for, so the cron knows when the next one is due");

// Every provider call that costs money, and who guards it.
const SPENDERS = [
  ["buyNumber", ROUTE, "reserveSpend"],
  ["createPhoneCall", "lib/voice/outboundCall.js", "canTakeCall"],
];
for (const [fn, file, guard] of SPENDERS) {
  const s = code(src(file));
  ok(s.includes(fn) && s.includes(guard) && s.indexOf(guard) < s.indexOf(`${fn}(`),
     `${fn} in ${file} is gated by ${guard}, and the gate runs first`);
}

// Nothing else anywhere calls the two spending provider functions.
const callers = [];
for (const dir of ["app", "lib"]) {
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = `${d}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) {
        const s = code(src(full));
        if (full !== "lib/voice/retell.js" && /\b(buyNumber|createPhoneCall)\s*\(/.test(s)) {
          callers.push(full);
        }
      }
    }
  };
  walk(dir);
}
// lib/voice/demoLine.js is a THIRD caller of buyNumber, and it is deliberately
// not gated by reserveSpend: it always passes `demo: true`, which retell.js's
// buyNumber short-circuits before any network call or reservation — see the
// "a demo's line, simulated here" block in lib/voice/retell.js. Nothing here
// EVER reaches the provider or spends a cent, so the money gate this list is
// checking for has nothing to guard. scripts/check-demo-number-pool.mjs is
// where that "never touches the network" claim is executed and proven; this
// list just has to know demoLine.js is the one caller allowed to be ungated.
const DEMO_LINE = "lib/voice/demoLine.js";
ok(callers.every((f) => [ROUTE, "lib/voice/outboundCall.js", DEMO_LINE].includes(f)),
   `only the two gated call sites — plus the demo line, which spends nothing — call the provider`,
   `also found: ${callers.filter((f) => ![ROUTE, "lib/voice/outboundCall.js", DEMO_LINE].includes(f)).join(", ")}`);

// Executed, not read: a company one cent short cannot reserve, and reserving
// takes exactly the price and no more.
globalThis.__FQ_DB = makeDb();
const poor = await reserveSpend({ companyId: "poor", kind: "number_setup", numberType: "local", ref: "r1" });
ok(poor.allowed === false, "reserveSpend on an empty account refuses");
ok((await balanceFor("poor")) === 0, "…and takes nothing — a refused reservation is not a debit");

await addCredit({ companyId: "poor", cents: monthlyCentsFor("local") - 1, kind: "topup", stripeRef: "t" });
ok((await reserveSpend({ companyId: "poor", kind: "number_setup", ref: "r2" })).allowed === false,
   "one cent short still refuses");
await addCredit({ companyId: "poor", cents: 1, kind: "topup", stripeRef: "t2" });
const paid = await reserveSpend({ companyId: "poor", kind: "number_setup", ref: "r3" });
ok(paid.allowed === true && (await balanceFor("poor")) === 0,
   `at exactly the price it goes through and debits ${monthlyCentsFor("local")}¢ — no more, no less`);
await refundReservation({ companyId: "poor", ref: "r3", cents: paid.needCents });
ok((await balanceFor("poor")) === monthlyCentsFor("local"),
   "a refund puts back exactly what was taken");
await refundReservation({ companyId: "poor", ref: "r3", cents: paid.needCents });
ok((await balanceFor("poor")) === monthlyCentsFor("local"),
   "…and refunding twice credits once — the refund carries its own ref");

console.log("\n── The free trial is a gift, given once ────────────────────────────\n");

globalThis.__FQ_DB = makeDb();
ok((await trialGranted("farm")) === false, "a new company hasn't had its trial");
await grantFreeTrial({ companyId: "farm", numberType: "local" });
const afterFirst = await balanceFor("farm");
ok(afterFirst > 0, `the first number grants ${afterFirst}¢ of credit`);
ok((await trialGranted("farm")) === true, "…and it's recorded as granted");

// The farming attempt: release the number, buy another, collect again.
await grantFreeTrial({ companyId: "farm", numberType: "local" });
await grantFreeTrial({ companyId: "farm", numberType: "toll_free" });
await grantFreeTrial({ companyId: "farm" });
ok((await balanceFor("farm")) === afterFirst,
   "releasing and re-buying grants nothing further — three more attempts, including at the dearer toll-free rate, all no-ops");
ok(globalThis.__FQ_DB.__entries.filter((e) => e.ref === TRIAL_REF).length === 1,
   "exactly one trial row exists, refused by the unique index rather than by a lookup");
ok(!/_v\d|v\d$/.test(TRIAL_REF),
   `the trial ref is stable ("${TRIAL_REF}") — a versioned one would re-gift every existing company the day someone bumped it`);

const schema = src("prisma/schema.prisma");
ok(/@@unique\(\[companyId,\s*ref\]\)/.test(schema),
   "the database enforces it: @@unique([companyId, ref]) on VoiceCreditEntry");
ok(/grantFreeTrial/.test(code(src(ROUTE))),
   "the buy route grants through grantFreeTrial, not a bare addCredit it could get wrong");

// Talk time keeps its own idempotency, which predates refs.
globalThis.__FQ_DB = makeDb();
await addCredit({ companyId: "dup", cents: 10000, kind: "topup", stripeRef: "x" });
await chargeCall({ companyId: "dup", callId: "c1", seconds: 65, numberType: "local" });
await chargeCall({ companyId: "dup", callId: "c1", seconds: 70, numberType: "local" });
ok((await balanceFor("dup")) === 10000 - 2 * ratePerMinute("local"),
   "call_ended and call_analyzed for one call bill once, not twice");

console.log("\n── The monthly rental actually leaves the balance ──────────────────\n");

const now = new Date("2026-08-12T09:00:00Z");
const number = (over = {}) => ({
  id: "n1", companyId: "co", e164: "+15145550142", status: "active",
  numberType: "local", monthlyCents: 400,
  rentPaidThroughAt: null, rentGraceUntilAt: null, rentWarnedAt: null,
  ...over,
});

ok(rentFor(number({ monthlyCents: 250 })) === 250,
   "a number bought at last year's rate keeps last year's rate — the row's price wins over the list");
ok(rentFor(number({ monthlyCents: 0, numberType: "toll_free" })) === monthlyCentsFor("toll_free"),
   "…and a row with no stored price falls back to the list for its type, not to zero");

const dueNow = rentDecision({ number: number(), balanceCents: 400, now });
ok(dueNow.action === "charge", "a number that has never been charged is due immediately");
ok(dueNow.ref === rentRef("n1", now) && dueNow.ref.includes("2026-08-12"),
   `the period is the idempotency key: ${dueNow.ref}`);
ok(rentRef("n1", now) !== rentRef("n1", new Date(now.getTime() + 31 * DAY)),
   "…and next month's key is a different one");

const paidThrough = new Date(now.getTime() + 10 * DAY);
ok(rentDecision({ number: number({ rentPaidThroughAt: paidThrough }), balanceCents: 0, now }).action === "none",
   "paid up and not close to due: nothing happens, however empty the balance");

const yesterday = new Date(now.getTime() - DAY);
const onTime = rentDecision({ number: number({ rentPaidThroughAt: yesterday }), balanceCents: 400, now });
ok(onTime.action === "charge" &&
   onTime.paidThroughAt.getTime() === yesterday.getTime() + RENT_PERIOD_DAYS * DAY,
   "a day late advances from the DUE date, not from today — paying late doesn't buy extra time");

const longOutage = rentDecision({
  number: number({ rentPaidThroughAt: new Date(now.getTime() - 120 * DAY) }),
  balanceCents: 400, now,
});
ok(longOutage.action === "charge" && longOutage.forgaveArrears === true &&
   longOutage.paidThroughAt.getTime() === now.getTime() + RENT_PERIOD_DAYS * DAY,
   "four months of missed crons bills ONE month and forgives the gap — our outage is not their bill");

console.log("\n── Running dry mid-month: warned, then grace, then released ────────\n");

const warnable = rentDecision({
  number: number({ rentPaidThroughAt: new Date(now.getTime() + 2 * DAY) }),
  balanceCents: 100, now,
});
ok(warnable.action === "warn_soon" && warnable.shortfallCents === 300,
   `${RENT_WARN_AHEAD_DAYS} days out with too little credit, they're told — while there's still time to act`);

const graceStart = rentDecision({ number: number(), balanceCents: 100, now });
ok(graceStart.action === "grace_start" &&
   graceStart.graceUntil.getTime() === now.getTime() + RENT_GRACE_DAYS * DAY,
   `an unaffordable rental starts a ${RENT_GRACE_DAYS}-day grace period — the number KEEPS WORKING`);
// Not asserted against the constant alone: that is a tautology, and a grace
// period quietly set to 0 would have passed it while taking a contractor's
// business number the same day it went unpaid.
ok(RENT_GRACE_DAYS >= 3 && RENT_GRACE_DAYS <= 30 &&
   graceStart.graceUntil.getTime() >= now.getTime() + 3 * DAY,
   `${RENT_GRACE_DAYS} days is long enough to cover a week on site and short enough to bound FieldQuo's exposure`);
ok(RENT_PERIOD_DAYS >= 28 && RENT_PERIOD_DAYS <= 31,
   `a billing period is ${RENT_PERIOD_DAYS} days — a month, not a fortnight`);
ok(RENT_WARN_AHEAD_DAYS >= 1 && RENT_WARN_AHEAD_DAYS < RENT_GRACE_DAYS,
   `the heads-up lands ${RENT_WARN_AHEAD_DAYS} days BEFORE the charge, not after it`);
ok(graceStart.shortfallCents === 300, "…and says exactly how much is needed");

const graceUntil = new Date(now.getTime() + 3 * DAY);
ok(rentDecision({ number: number({ rentGraceUntilAt: graceUntil }), balanceCents: 0, now }).action === "grace_remind",
   "inside the grace period they're reminded, not cut off");
ok(rentDecision({
     number: number({ rentGraceUntilAt: graceUntil, rentWarnedAt: new Date(now.getTime() - DAY) }),
     balanceCents: 0, now,
   }).action === "grace_wait",
   "…but a daily cron doesn't send a daily email");
ok(rentDecision({
     number: number({ rentGraceUntilAt: new Date(now.getTime() - DAY) }),
     balanceCents: 0, now,
   }).action === "release",
   "only when the grace period has run out is the number released");
ok(rentDecision({
     number: number({ rentGraceUntilAt: new Date(now.getTime() - DAY) }),
     balanceCents: 400, now,
   }).action === "charge",
   "paying during grace charges and rescues it — the release is never inevitable");

ok(rentDecision({ number: number({ status: "porting" }), balanceCents: 0, now }).action === "skip",
   "a port in flight is never charged — nothing is rented until it lands");
ok(rentDecision({ number: number({ status: "released" }), balanceCents: 1e6, now }).action === "skip",
   "a released number stops costing anything");
ok(rentDecision({ number: null, balanceCents: 400, now }).action === "skip",
   "a missing row is skipped rather than crashing the run for every other company");

const ACTIONS = new Set(["none", "charge", "warn_soon", "grace_start", "grace_remind", "grace_wait", "release", "skip"]);
let sweepClean = true;
const seen = new Set();
for (const status of ["active", "porting", "released", "failed", "provisioning"]) {
  for (const paid of [null, -100 * DAY, -DAY, 2 * DAY, 40 * DAY]) {
    for (const grace of [null, -DAY, 3 * DAY]) {
      for (const warned of [null, -DAY, -10 * DAY]) {
        for (const balance of [-1, 0, 100, 400, 99999, NaN]) {
          const d = rentDecision({
            number: number({
              status,
              rentPaidThroughAt: paid === null ? null : new Date(now.getTime() + paid),
              rentGraceUntilAt: grace === null ? null : new Date(now.getTime() + grace),
              rentWarnedAt: warned === null ? null : new Date(now.getTime() + warned),
            }),
            balanceCents: balance, now,
          });
          seen.add(d.action);
          if (!ACTIONS.has(d.action)) { sweepClean = false; console.log(`   ✗ ${d.action}`); }
        }
      }
    }
  }
}
ok(sweepClean, `450 state combinations produce only known, labelled actions`);
ok([...ACTIONS].filter((a) => a !== "skip").every((a) => seen.has(a)),
   `every state is reachable, none is dead code: ${[...seen].sort().join(", ")}`);

console.log("\n── Executed against the ledger ─────────────────────────────────────\n");

globalThis.__FQ_DB = makeDb();
await addCredit({ companyId: "co", cents: 1000, kind: "topup", stripeRef: "top" });
const row = number({ rentPaidThroughAt: yesterday });
const billed = await billNumberRent(row, { now });
ok(billed.action === "charge" && (await balanceFor("co")) === 600,
   `the rental actually debits: $10.00 − $4.00 = $${((await balanceFor("co")) / 100).toFixed(2)}`);
const rentRows = globalThis.__FQ_DB.__entries.filter((e) => e.kind === "number_rent");
ok(rentRows.length === 1 && rentRows[0].cents === -400,
   "…as one negative ledger row of kind number_rent, so the statement explains it");
ok(globalThis.__FQ_DB.__numbers.get("n1")?.rentPaidThroughAt?.getTime() ===
     yesterday.getTime() + RENT_PERIOD_DAYS * DAY,
   "…and the paid-through moved, which is what stops it charging again tomorrow");

// The cron overlapping itself, or a run retried after a crash.
await billNumberRent(row, { now });
await billNumberRent(row, { now });
ok(globalThis.__FQ_DB.__entries.filter((e) => e.kind === "number_rent").length === 1 &&
   (await balanceFor("co")) === 600,
   "three runs over the same period charge once — the ref is a database constraint, not a lookup");

globalThis.__FQ_DB = makeDb();
await addCredit({ companyId: "co", cents: 100, kind: "topup", stripeRef: "top" });
const broke = await billNumberRent(number({ rentPaidThroughAt: yesterday }), { now });
ok(broke.action === "grace_start" && (await balanceFor("co")) === 100,
   "an unaffordable rental takes nothing and starts the grace clock instead");
ok(globalThis.__FQ_DB.__numbers.get("n1")?.rentGraceUntilAt instanceof Date,
   "…and the grace deadline is written down, so 'past due' is a state and not a guess");
ok(globalThis.__FQ_DB.__numbers.get("n1")?.rentWarnedAt instanceof Date,
   "…along with the fact that they were told");

console.log("\n── The contractor can see all of it before it happens ──────────────\n");

const statusPastDue = rentStatus(number({ rentGraceUntilAt: graceUntil }), 0, now);
ok(statusPastDue?.pastDue === true && statusPastDue.graceUntil,
   "rentStatus labels a past-due number and carries the date it stops working");
const statusFine = rentStatus(number({ rentPaidThroughAt: paidThrough }), 5000, now);
ok(statusFine?.pastDue === false && statusFine.coversNext === true,
   "a healthy number reports when the next rental is and that the balance covers it");
ok(rentStatus(number({ rentPaidThroughAt: paidThrough }), 100, now)?.coversNext === false,
   "…and says so when it doesn't, before the due date rather than after");
ok(rentStatus(number({ status: "porting" }), 0, now) === null,
   "a porting number has no rental status to show — no invented due date");
ok(rentStatus(number({ rentGraceUntilAt: null, rentPaidThroughAt: null }), 0, now)?.graceUntil === null,
   "a grace date that hasn't been committed is null, not invented for the screen");

const pageSrc = src(PAGE);
const settingsSrc = code(src(SETTINGS));
ok(/afford\.allowed/.test(pageSrc) || /type\.afford\.allowed/.test(pageSrc),
   "the buy button is disabled from the SERVER's affordability verdict");
ok(/disabled=\{[^}]*!type\.afford\.allowed/.test(pageSrc),
   "…on the purchase buttons specifically");
ok(/!forwardAfford\.allowed/.test(pageSrc),
   "…and on forwarding, which still buys a number to forward to");
ok(/app\.setVoice\.cantAfford/.test(pageSrc),
   "a disabled button carries the reason and the shortfall — not a dead control");
ok(/app\.setVoice\.rentPastDueTitle/.test(pageSrc) && /app\.setVoice\.rentNext/.test(pageSrc),
   "the page renders both rental states: next charge, and past due");
ok(/spendVerdict\(/.test(settingsSrc) && /afford:/.test(settingsSrc),
   "the verdict is computed in the API from the company's own balance, never in the browser");
ok(!/No monthly fee/i.test(code(pageSrc)) && !/No monthly fee/i.test(code(src("app/i18n/appMessages.js"))),
   "the old 'no monthly fee' copy is gone from the shipped strings — there is a monthly fee");

const messages = src("app/i18n/appMessages.js");
const NEW_KEYS = [
  "app.setVoice.firstMonthNow", "app.setVoice.firstMonthUpFront", "app.setVoice.cantAfford",
  "app.setVoice.trialWithNumber", "app.setVoice.portNoCharge", "app.setVoice.rentNext",
  "app.setVoice.rentSoon", "app.setVoice.rentWontCover", "app.setVoice.rentPastDueTitle",
  "app.setVoice.rentPastDueDated", "app.setVoice.rentPastDueNow",
];
const missing = NEW_KEYS.filter((k) => (messages.match(new RegExp(`"${k}"`, "g")) || []).length < 6);
ok(missing.length === 0, "every new string exists in all six languages", `short: ${missing.join(", ")}`);

console.log("\n── The rental is actually wired to run ─────────────────────────────\n");

ok(existsSync(CRON), "there is a rent cron at /api/cron/voice-rent");
const cronSrc = code(src(CRON));
// Was a literal /CRON_SECRET/ text match. Every cron route now calls the
// shared, fail-closed lib/security/cronAuth.js helper instead of hand-
// comparing the env var (see docs/SECURITY-FIXES.md — a missing
// CRON_SECRET used to authenticate anyone who sent the literal string
// "Bearer undefined"). requireCronSecret() is the stronger, current proof
// of "protected"; the old text would still match a stray comment even with
// no real check behind it.
ok(/requireCronSecret\(request\)/.test(cronSrc), "…protected by CRON_SECRET, like every other cron here");
ok(/billNumberRent/.test(cronSrc), "…and it delegates every judgement to the gate");
ok(/status:\s*"active"/.test(cronSrc), "…looking only at active numbers");
const vercel = JSON.parse(src("vercel.json"));
const scheduled = vercel.crons.find((c) => c.path === "/api/cron/voice-rent");
ok(Boolean(scheduled), "…and it's scheduled in vercel.json — an unscheduled cron bills nobody");
ok(/^\d+ \d+ \* \* \*$/.test(scheduled?.schedule || ""),
   `…daily (${scheduled?.schedule}), because every number has its own anniversary`);

const pkg = JSON.parse(src("package.json"));
ok(Boolean(pkg.scripts["check:voice-spend"]), "this check has a script entry");
ok(pkg.scripts["check:all"].includes("check:voice-spend"), "…and runs as part of check:all");

console.log("\n── Billed for what was actually bought ─────────────────────────────\n");

// The other direction of the same class of bug: the contractor was charged the
// toll-free rate for a local line, because the purchase request never said which
// kind it wanted while the price did.
ok(isTollFreeNumber("+18335550142") && isTollFreeNumber("+18005550142"),
   "833 and 800 read as toll-free");
ok(!isTollFreeNumber("+15145550142") && !isTollFreeNumber("+18195550142"),
   "514 and 819 do not");
ok(!isTollFreeNumber("+18225550142"),
   "822 is RESERVED for future toll-free use, not assignable — treating it as toll-free would bill $9 for a line nobody can have");
ok(!isTollFreeNumber("") && !isTollFreeNumber(null) && !isTollFreeNumber("833"),
   "junk is not toll-free");
ok(/isTollFreeNumber\(e164\)/.test(routeSrc),
   "the stored type comes from the NUMBER we received, not from the order we sent");
ok(/numberType:\s*actualType/.test(routeSrc) && /monthlyCents:\s*actualMonthly/.test(routeSrc),
   "…and both the rate and the rental follow it, for the whole life of the line");
ok(/tollFree/.test(routeSrc) && /country:/.test(routeSrc),
   "the purchase request states the type and the country explicitly");
ok(/providerId:\s*bought\?\.phone_number\b/.test(routeSrc),
   "providerId stores the E.164, not the pretty display string");
// The release itself moved out of the gate and into lib/voice/numberRelease.js,
// shared with the contractor's own Release button — so the E.164 invariant is
// asserted where it now lives. `providerId` holds Retell's
// `phone_number_pretty` on older rows: a release that looked the number up
// there would fail silently and leave the rental running for ever.
ok(/releaseHeldNumber\(number/.test(code(src(GATE))),
   "the gate releases through the one shared helper rather than calling the provider itself");
ok(/releaseAtProvider\(number\.e164/.test(code(src("lib/voice/numberRelease.js"))),
   "…and the release keys on the E.164 too, so an old pretty-string row still releases");
ok(!/providerId/.test(code(src("lib/voice/numberRelease.js"))),
   "…and never on providerId, which is a display string on rows written before that was fixed");

console.log(fail === 0 ? "\nALL PASS\n" : `\n${fail} FAILED\n`);
process.exit(fail ? 1 : 0);
