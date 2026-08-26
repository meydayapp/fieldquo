// scripts/check-voice-number-race.mjs
//
//   npm run check:number-race
//
// One number per company, even when two requests arrive together.
//
// ══ What went wrong, twice, for $4 each ════════════════════════════════════
//
// POST /api/settings/voice/number asked heldNumber() "do they have one
// already?" and, seconds later, wrote the VoicePhoneNumber row. In between sat
// provisionAgent() and buyNumber() — a network call to Retell. A second request
// arriving inside that window found no held number either, reserved a second
// month's rental, and bought a second live line. Company
// cmsl36it7000004juyw4qyn0u holds two purchased numbers with two `number_setup`
// debits of $4, 31 seconds apart.
//
// ══ Why this file executes the real handler ════════════════════════════════
//
// The guard is not a function that can be called; it is an ORDER of operations
// inside a route, and every previous attempt to pin it down read the source and
// checked that `heldNumber` appeared before `buyNumber`. That assertion was true
// on the day the company bought two numbers.
//
// So this imports the real POST and runs it, with the provider replaced by a
// promise this file controls. That is what makes "two requests, one purchase"
// a demonstration rather than a claim: request A is held open exactly where
// Retell would hold it, request B runs to completion in that window, and the
// ledger is counted afterwards.
//
// The database is a stub — but a stub that behaves like the real one in the two
// ways that matter here: @@unique([companyId, ref]) raises P2002, and a
// transaction sees everything committed before it started. Everything the guard
// depends on is therefore exercised, including the parts of spendGate.js that
// only exist because of Postgres.
//
// ── Run it with node, via the alias loader ─────────────────────────────────
//
//   node --import ./scripts/alias-loader.mjs scripts/check-voice-number-race.mjs

import { readFileSync } from "node:fs";
import { register } from "node:module";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

let fail = 0;
let pass = 0;
const ok = (cond, msg, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
    if (detail !== undefined) console.log(`      got: ${JSON.stringify(detail)}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. A database stub with the two behaviours the guard leans on
   ═══════════════════════════════════════════════════════════════════════════

   * `@@unique([companyId, ref])` on VoiceCreditEntry, raising Prisma's own
     P2002 — the constraint that makes a reservation happen once.
   * `$transaction`, which records the isolation level it was asked for and
     rolls its writes back when the callback throws. Reads inside see everything
     committed before it began, which is the only property this file's scenarios
     actually turn on.

   It is deliberately NOT a Postgres. SSI cannot be simulated in JavaScript, and
   pretending otherwise would be the "looks atomic and isn't" this whole change
   exists to avoid. The serialisation failure is therefore injected — the thing
   under test there is what the ROUTE does with a 40001, which is the half that
   was capable of shipping a 500. */

function makeDb() {
  const state = { entries: [], numbers: [], txLevels: [], txCount: 0 };

  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("gte" in v) return new Date(row[k]).getTime() >= new Date(v.gte).getTime();
      }
      return row[k] === v;
    });

  const view = (store) => ({
    voiceCreditEntry: {
      async aggregate({ where }) {
        const rows = store.entries.filter((e) => matches(e, where));
        return { _sum: { cents: rows.reduce((n, e) => n + e.cents, 0) } };
      },
      async findFirst({ where }) {
        return store.entries.find((e) => matches(e, where)) || null;
      },
      async findMany({ where }) {
        return store.entries.filter((e) => matches(e, where));
      },
      async create({ data }) {
        if (data.ref != null) {
          const clash = store.entries.find(
            (e) => e.companyId === data.companyId && e.ref === data.ref,
          );
          if (clash) {
            const err = new Error("Unique constraint failed on (companyId, ref)");
            err.code = "P2002";
            throw err;
          }
        }
        const row = { id: `e${store.entries.length + 1}`, createdAt: new Date(), ...data };
        store.entries.push(row);
        return row;
      },
    },
    voicePhoneNumber: {
      async findFirst({ where, orderBy } = {}) {
        const rows = store.numbers.filter((n) => matches(n, where));
        if (orderBy?.createdAt === "asc") {
          rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return rows[0] || null;
      },
      async findMany({ where } = {}) {
        return store.numbers.filter((n) => matches(n, where));
      },
      async create({ data }) {
        const clash = store.numbers.find((n) => n.e164 === data.e164);
        if (clash) {
          const err = new Error("Unique constraint failed on e164");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `n${store.numbers.length + 1}`, createdAt: new Date(), ...data };
        store.numbers.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = store.numbers.find((n) => n.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    voiceAgent: {
      async findUnique() {
        return { providerAgentId: "agent_1", enabled: true };
      },
    },
    company: {
      async findUnique() {
        return { id: "co", name: "Test Co", country: "CA", email: null };
      },
    },
  });

  const base = {
    ...view(state),
    async $transaction(fn, opts) {
      state.txLevels.push(opts?.isolationLevel || null);
      state.txCount++;
      // A snapshot, so a callback that throws leaves nothing behind. That is
      // what lets the route promise "nothing has been charged" on the failure
      // path and be telling the truth.
      const scratch = {
        entries: state.entries.slice(),
        numbers: state.numbers.slice(),
        txLevels: state.txLevels,
      };
      if (globalThis.__FQ_TX_THROWS) {
        const err = globalThis.__FQ_TX_THROWS;
        globalThis.__FQ_TX_THROWS = null;
        throw err;
      }
      const result = await fn(view(scratch));
      state.entries = scratch.entries;
      state.numbers = scratch.numbers;
      return result;
    },
    __state: state,
  };

  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return new Proxy({}, { get: () => async () => null });
    },
  });
}

globalThis.__FQ_DB = makeDb();
globalThis.__FQ_TX_THROWS = null;
// The provider. `__FQ_BUY` is swapped per scenario — a promise this file holds
// open is what puts a second request inside the window the real Retell call
// opens up.
// A DIFFERENT number each time, because that is what Retell does. A provider
// that handed back the same number twice would hide a second purchase behind
// VoicePhoneNumber.e164's unique index.
globalThis.__FQ_BUY = async () => ({ phone_number: `+1514555${String(1000 + globalThis.__FQ_BUY_CALLS).slice(-4)}` });
globalThis.__FQ_BUY_CALLS = 0;

// Which module each stub stands in for.
const SPECIFIERS = {
  "@/lib/db": "fq:db",
  "next/server": "fq:next",
  "@/lib/apiMember": "fq:member",
  "@/lib/voice/retell": "fq:retell",
  "@/lib/voice/provision": "fq:provision",
  "@/lib/voice/numberSearch": "fq:search",
  "@/lib/voice/diagnose": "fq:diagnose",
  "@/lib/activity/log": "fq:activity",
  "@/lib/platform/errorLog": "fq:errorlog",
  "@/lib/appUrl": "fq:appurl",
  "@/lib/features/gate": "fq:features",
  "@/lib/email/resend": "fq:email",
  "@/lib/email/platformSender": "fq:email",
  "@/lib/email/billingEmail": "fq:email",
  "@/lib/email/companySender": "fq:email",
  "@/lib/voice/numberRelease": "fq:release",
};

// The stub sources are inlined into the hook, not handed to it through a
// global: module hooks run on their own worker thread, where this file's
// globals do not exist. Same technique as scripts/check-refusal-shape.mjs.
const SOURCES = {
  // A Proxy rather than a snapshot: each scenario installs a fresh database and
  // a module-level binding would freeze whichever one existed at import time.
  "fq:db": "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
  "fq:next":
    "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };",
  "fq:member":
    "export const memberOrRefusal = async () => ({ member: globalThis.__FQ_MEMBER, response: null });\n" +
    "export const memberOrRefusalPlain = memberOrRefusal;",
  "fq:retell":
    "export class RetellError extends Error { constructor(m, o) { super(m); this.status = o?.status; } }\n" +
    "export const voiceConfigured = () => true;\n" +
    "export const buyNumber = async (...a) => { globalThis.__FQ_BUY_CALLS++; return globalThis.__FQ_BUY(...a); };\n" +
    "export const getNumber = async () => ({});\n" +
    "export const boundAgentId = () => null;\n" +
    "export const releaseNumber = async () => ({});\n" +
    "export const importNumber = async () => ({});",
  "fq:provision": "export const provisionAgent = async () => ({ ok: true });",
  "fq:search":
    "export const isStillAvailable = async () => null;\n" +
    "export const numberChoiceAvailable = () => false;\n" +
    "export const searchLocalNumbers = async () => ({ configured: false, numbers: [] });",
  "fq:diagnose":
    "export const diagnoseNumber = async () => ({ verdict: 'provider_unreachable' });\n" +
    "export const diagnoseAndHeal = async () => ({ verdict: 'provider_unreachable' });\n" +
    "export const NUMBER_VERDICTS = {};\n" +
    "export const statusNeedsCorrection = () => false;\n" +
    "export const verdictFor = () => 'ok';",
  "fq:activity": "export const recordActivity = async () => null;",
  "fq:errorlog": "export const recordError = async () => null;",
  "fq:appurl":
    "export const getAppOrigin = () => 'https://example.test';\n" +
    "export const appUrl = (p) => 'https://example.test' + p;",
  "fq:features":
    "export const featureAllowsSpend = async () => true;\n" +
    "export const featureStateFor = async () => ({ state: 'on' });\n" +
    "export const featureMapForCompany = async () => ({});\n" +
    "export const assertFeatureAccess = async (m) => m;\n" +
    "export const navFlagsFrom = () => ({});",
  "fq:email":
    "export const sendEmail = async () => ({ ok: true });\n" +
    "export const getPlatformFrom = async () => 'noreply@example.test';\n" +
    "export const buildPlatformNotice = () => ({ subject: '', html: '' });\n" +
    "export const ownerEmailFor = async () => null;",
  "fq:release":
    "export const releaseHeldNumber = async () => ({ ok: true });\n" +
    "export const HELD_STATUSES = ['provisioning', 'active', 'porting'];\n" +
    "export const planRelease = () => ({ reason: 'no_number' });",
};

const HOOKS = `
const STUBS = ${JSON.stringify(SPECIFIERS)};
const SOURCES = ${JSON.stringify(SOURCES)};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (SOURCES[url]) return { format: "module", shortCircuit: true, source: SOURCES[url] };
  return nextLoad(url, context);
}
`;

globalThis.__FQ_MEMBER = { id: "m1", companyId: "co", role: "owner", userId: "u1" };

register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const route = await import("@/app/api/settings/voice/number/route.js");
const gate = await import("@/lib/voice/spendGate");
const credits = await import("@/lib/voice/credits");

const { claimVerdict, isSerialisationFailure, numberSetupRef, refundRefFor, CLAIM_WINDOW_MS } = gate;
const { monthlyCentsFor } = credits;

const LOCAL = monthlyCentsFor("local");
const req = (body) => ({ url: "https://app.example.test/api/settings/voice/number", json: async () => body });

/** Fresh database with `cents` of credit already in it. */
function reset(cents = LOCAL * 5) {
  globalThis.__FQ_DB = makeDb();
  globalThis.__FQ_TX_THROWS = null;
  globalThis.__FQ_BUY_CALLS = 0;
  globalThis.__FQ_BUY = async () => ({ phone_number: `+1514555${String(1000 + globalThis.__FQ_BUY_CALLS).slice(-4)}` });
  if (cents > 0) {
    globalThis.__FQ_DB.__state.entries.push({
      id: "seed",
      companyId: "co",
      cents,
      kind: "topup",
      ref: "seed-topup",
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    });
  }
  return globalThis.__FQ_DB.__state;
}

const setups = (state) => state.entries.filter((e) => e.kind === "number_setup");
const refunds = (state) => state.entries.filter((e) => String(e.ref || "").startsWith("refund:"));
const balance = (state) =>
  state.entries.filter((e) => e.companyId === "co").reduce((n, e) => n + e.cents, 0);

/* ═══════════════════════════════════════════════════════════════════════════
   2. Two requests inside the provider window
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Two clicks, one number ─────────────────────────────────────────\n");

{
  const state = reset();

  // Request A is parked exactly where Retell parks it: after the reservation
  // has committed, before the row exists. This is the whole window.
  let release;
  let entered;
  const parked = new Promise((r) => {
    release = r;
  });
  const atProvider = new Promise((r) => {
    entered = r;
  });
  globalThis.__FQ_BUY = async () => {
    // The number is decided on the way IN, not on the way out: Retell hands each
    // caller a different line, and computing it after the wait would give both
    // requests the same one and hide the second purchase behind e164's unique
    // index — the exact failure this scenario has to be able to see.
    const mine = `+1514555${String(1000 + globalThis.__FQ_BUY_CALLS).slice(-4)}`;
    entered();
    await parked;
    return { phone_number: mine };
  };

  // A safety net, so that a REGRESSION reports a failure instead of hanging: if
  // the guard ever stops refusing, request B walks into the same parked provider
  // call and the two wait for each other for ever.
  const net = setTimeout(release, 3000);

  const a = route.POST(req({ source: "purchased", numberType: "local" }));
  // Wait for A to actually reach the provider rather than guessing at ticks.
  await atProvider;

  ok(setups(state).length === 1, "request A reserved before touching the provider");
  ok(state.numbers.length === 0, "…and no number row exists yet — this is the window");

  const bRes = await route.POST(req({ source: "purchased", numberType: "local" }));

  ok(bRes.status === 409, "request B, inside that window, is REFUSED", bRes.status);
  ok(
    bRes.body?.errorKey === "app.setVoice.numberBusy.inFlight",
    "…with the 'we're already on it' message, not a generic error",
    bRes.body?.errorKey,
  );
  ok(
    bRes.body?.retryAt instanceof Date,
    "…and a time it can be retried, rather than an open-ended spinner",
  );
  ok(setups(state).length === 1, "…and B reserved NOTHING", setups(state).length);

  clearTimeout(net);
  release();
  const aRes = await a;

  ok(aRes.status === 200, "request A still completes", aRes.status);
  ok(globalThis.__FQ_BUY_CALLS === 1, "exactly ONE number was bought at the provider", globalThis.__FQ_BUY_CALLS);
  ok(state.numbers.length === 1, "exactly one VoicePhoneNumber row exists", state.numbers.length);
  ok(setups(state).length === 1, `exactly one $${(LOCAL / 100).toFixed(2)} number_setup debit`, setups(state).length);
  ok(refunds(state).length === 0, "…and nothing had to be refunded");
}

/* ── The same pair, one millisecond apart ────────────────────────────────────

   The window above is seconds long and the reservation row closes it. The pair
   that overlap to the millisecond have no committed row to see, and Postgres is
   what separates them: SERIALIZABLE aborts one with SQLSTATE 40001. The route's
   job is to turn that into the refusal the user should see. */

console.log("\n── The loser of a genuinely simultaneous pair ──────────────────────\n");

{
  const state = reset();
  const serialisation = Object.assign(new Error("could not serialize access due to read/write dependencies among transactions"), {
    code: "P2010",
    meta: { driverAdapterError: { cause: { originalCode: "40001", kind: "postgres" } } },
  });
  globalThis.__FQ_TX_THROWS = serialisation;

  const res = await route.POST(req({ source: "purchased", numberType: "local" }));

  ok(res.status === 409, "a serialisation failure answers 409, NOT 500", res.status);
  ok(
    res.body?.errorKey === "app.setVoice.numberBusy.inFlight",
    "…and says the same thing every other 'already on it' says",
    res.body?.errorKey,
  );
  ok(globalThis.__FQ_BUY_CALLS === 0, "…and never reached the provider");
  ok(setups(state).length === 0, "…and took no money");
  ok(balance(state) === LOCAL * 5, "…the balance is untouched", balance(state));
}

// The transaction that failed for some OTHER reason is not a refusal at all,
// and must not masquerade as one. It gets a 503 and an honest sentence.
{
  const state = reset();
  globalThis.__FQ_TX_THROWS = Object.assign(new Error("connection lost"), { code: "P1001" });
  const res = await route.POST(req({ source: "purchased", numberType: "local" }));
  ok(res.status === 503, "an unrelated transaction failure is 503, not 500 and not 409", res.status);
  ok(setups(state).length === 0, "…and nothing was charged, which is what it tells them");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The transaction is real, and it is SERIALIZABLE
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The guard and the money are in one serialisable transaction ─────\n");

{
  const state = reset();
  await route.POST(req({ source: "purchased", numberType: "local" }));
  ok(state.txCount >= 1, "the purchase path opens a transaction");
  ok(
    state.txLevels.every((l) => l === "Serializable") && state.txLevels.length >= 1,
    "…and every one of them asks for Serializable",
    state.txLevels,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. A company that gave its number back may buy another
   ═══════════════════════════════════════════════════════════════════════════

   The guard must not have quietly widened. `released` and `failed` are not
   numbers anybody holds, and a stale reservation from the purchase that
   PRODUCED the released row must not outlive it. */

console.log("\n── Released and failed rows still allow a purchase ─────────────────\n");

for (const status of ["released", "failed"]) {
  const state = reset();
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  // The reservation is still inside the claim window — this is the case that
  // would strand them if "any recent number_setup" were the rule.
  state.entries.push({
    id: "old-setup",
    companyId: "co",
    cents: -LOCAL,
    kind: "number_setup",
    ref: numberSetupRef("old-token"),
    createdAt: twoMinutesAgo,
  });
  state.numbers.push({
    id: "n-old",
    companyId: "co",
    e164: "+15145550999",
    status,
    source: "purchased",
    numberType: "local",
    createdAt: oneMinuteAgo,
  });

  const res = await route.POST(req({ source: "purchased", numberType: "local" }));
  ok(res.status === 200, `a company whose only row is \`${status}\` may buy again`, res.status);
  ok(state.numbers.length === 2, "…and gets a second row, which is correct here", state.numbers.length);
}

// The mirror image: a `provisioning`, `active` or `porting` row still refuses.
for (const status of ["provisioning", "active", "porting"]) {
  const state = reset();
  state.numbers.push({
    id: "n-held",
    companyId: "co",
    e164: "+15145550999",
    status,
    source: "purchased",
    numberType: "local",
    createdAt: new Date(Date.now() - 60 * 1000),
  });
  const res = await route.POST(req({ source: "purchased", numberType: "local" }));
  ok(res.status === 409, `a \`${status}\` row still refuses a second purchase`, res.status);
  ok(globalThis.__FQ_BUY_CALLS === 0, "…without touching the provider");
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The refund still fires when the provider refuses
   ═══════════════════════════════════════════════════════════════════════════

   The reservation now commits inside a transaction that closed long before the
   provider answered. The refund is written afterwards, outside it — if that had
   been folded into the transaction it would have been rolled back with it, and
   the company would be down a month's rental for a number they never got. */

console.log("\n── A provider refusal still gives the money back ───────────────────\n");

{
  const state = reset();
  const { RetellError } = await import("@/lib/voice/retell");
  globalThis.__FQ_BUY = async () => {
    throw new RetellError("no numbers left in that area");
  };

  const res = await route.POST(req({ source: "purchased", numberType: "local" }));

  ok(res.status === 502, "the provider's refusal is reported as such", res.status);
  ok(setups(state).length === 1, "the reservation did happen — money moves first, on purpose");
  ok(refunds(state).length === 1, "…and exactly one refund was written", refunds(state).length);
  ok(
    refunds(state)[0]?.ref === refundRefFor(setups(state)[0]?.ref),
    "…keyed to the reservation it gives back, so the statement reads reserved/refunded",
  );
  ok(balance(state) === LOCAL * 5, "…and the balance is whole again", balance(state));
  ok(state.numbers.length === 0, "…with no number row left behind");

  // …and having been refunded, they are free to try again immediately. A claim
  // that outlived its own refund would lock them out for the whole window.
  globalThis.__FQ_BUY = async () => ({ phone_number: "+15145550111" });
  const second = await route.POST(req({ source: "purchased", numberType: "local" }));
  ok(second.status === 200, "…and the next attempt is allowed straight away", second.status);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The port path, which has no provider call and the same race
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Porting claims the slot in the same transaction ─────────────────\n");

{
  const state = reset();
  const first = await route.POST(req({ source: "ported", publicNumber: "+15145550222" }));
  ok(first.status === 200 && first.body?.status === "porting", "a port request is recorded", first.status);
  ok(state.txLevels.every((l) => l === "Serializable"), "…inside a Serializable transaction", state.txLevels);

  const second = await route.POST(req({ source: "ported", publicNumber: "+15145550333" }));
  ok(second.status === 409, "a second port request is refused", second.status);
  ok(state.numbers.length === 1, "…and only one porting row exists", state.numbers.length);

}

{
  // A fresh company, or the porting row above would refuse at the top guard and
  // this would pass without the transaction ever being reached.
  reset();
  globalThis.__FQ_TX_THROWS = Object.assign(new Error("deadlock detected"), { code: "40P01" });
  const raced = await route.POST(req({ source: "ported", publicNumber: "+15145550444" }));
  ok(raced.status === 409, "a serialisation failure on the port path is 409 too", raced.status);
  ok(
    raced.body?.errorKey === "app.setVoice.numberBusy.inFlight",
    "…with the same 'already on it' message",
    raced.body?.errorKey,
  );
}

// e164 is unique across the whole table. A number already in FieldQuo is a
// refusal, not a 500 — and it must not say whose it is.
{
  const state = reset();
  state.numbers.push({
    id: "n-elsewhere",
    companyId: "other-co",
    e164: "+15145550777",
    status: "active",
    createdAt: new Date(),
  });
  const res = await route.POST(req({ source: "ported", publicNumber: "+15145550777" }));
  ok(res.status === 409, "porting a number FieldQuo already knows is a 409, not a crash", res.status);
  ok(res.body?.errorKey === "app.setVoice.portTaken", "…with its own message", res.body?.errorKey);
  ok(
    !/other-co|another compan|someone else/i.test(res.body?.error || ""),
    "…that names no other tenant",
    res.body?.error,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. claimVerdict, against a hostile ledger
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The claim decision, executed directly ───────────────────────────\n");

const now = new Date("2026-08-24T12:00:00Z");
const ago = (ms) => new Date(now.getTime() - ms);
const claim = (ref, ms) => ({ kind: "number_setup", ref: numberSetupRef(ref), createdAt: ago(ms) });

ok(
  claimVerdict({ entries: [claim("t1", 1000)], now }).inFlight === true,
  "a reservation a second old, with no number behind it, is a purchase in flight",
);
ok(
  claimVerdict({ entries: [claim("t1", CLAIM_WINDOW_MS + 1000)], now }).inFlight === false,
  "…one older than the window is not — a crashed request must not strand a company for ever",
);
ok(
  claimVerdict({
    entries: [claim("t1", 1000), { kind: "adjustment", ref: refundRefFor(numberSetupRef("t1")), createdAt: ago(500) }],
    now,
  }).inFlight === false,
  "a refunded reservation is settled — the provider refused and they may try again",
);
ok(
  claimVerdict({ entries: [claim("t1", 5000)], numberRowsCreatedAt: [ago(4000)], now }).inFlight === false,
  "a reservation with a number row after it is settled — from there heldNumber() decides",
);
ok(
  claimVerdict({ entries: [claim("t1", 5000)], numberRowsCreatedAt: [ago(9000)], now }).inFlight === true,
  "…but a row from BEFORE it settles nothing; that was the previous number",
);
ok(
  claimVerdict({ entries: [claim("t1", 9000), claim("t2", 1000)], now }).ref === numberSetupRef("t2"),
  "with two unsettled reservations it reports the newest, which is the one still running",
);

let hostileClean = true;
for (const entries of [null, undefined, "nope", [null], [{}], [{ kind: "number_setup" }], [{ kind: "number_setup", ref: "number_setup:x", createdAt: "not a date" }], [{ kind: "topup", ref: "number_setup:x", createdAt: now }]]) {
  const v = claimVerdict({ entries, now });
  if (v.inFlight !== false || v.ref !== null) {
    hostileClean = false;
    console.log(`      ✗ ${JSON.stringify(entries)} → ${JSON.stringify(v)}`);
  }
}
ok(hostileClean, "a null, malformed or undated ledger claims nothing — no phantom lock-out");

/* ═══════════════════════════════════════════════════════════════════════════
   8. Recognising Postgres saying "you lost the race"
   ═══════════════════════════════════════════════════════════════════════════

   Three shapes, because this stack produces three. The nested one was read off
   this database: the PrismaPg adapter puts the raw SQLSTATE at
   meta.driverAdapterError.cause.originalCode. */

console.log("\n── 40001 is a refusal, not a fault ─────────────────────────────────\n");

ok(isSerialisationFailure({ code: "P2034" }), "Prisma's own write-conflict code is recognised");
ok(
  isSerialisationFailure({ code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40001" } } } }),
  "…so is the raw SQLSTATE the PrismaPg adapter passes through",
);
ok(isSerialisationFailure({ code: "40P01" }), "…and a deadlock, which means the same thing to the caller");
ok(
  isSerialisationFailure(new Error("could not serialize access due to read/write dependencies")),
  "…and the message, for a driver that carries no code at all",
);
ok(!isSerialisationFailure(null), "null is not a serialisation failure");
ok(!isSerialisationFailure({ code: "P2002" }), "…nor is a unique violation, which means something else entirely");
ok(!isSerialisationFailure({ code: "P1001" }), "…nor a database that isn't answering");

/* ═══════════════════════════════════════════════════════════════════════════
   9. The reservation is still the FIRST thing that costs anything
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Order of operations, in the shipped source ──────────────────────\n");

const routeSrc = readFileSync(new URL("../app/api/settings/voice/number/route.js", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

ok(
  routeSrc.indexOf("reserveSpend({") < routeSrc.indexOf("buyNumber({"),
  "the money is still reserved before the provider is called",
);
ok(
  routeSrc.indexOf("$transaction") < routeSrc.indexOf("buyNumber({"),
  "…and the transaction closes before it, not around it — a network call inside a serialisable transaction makes things worse",
);
ok(
  routeSrc.indexOf("isolationLevel", routeSrc.indexOf("reserveSpend({")) < routeSrc.indexOf("buyNumber({"),
  "…and the reservation's own transaction is closed by the time the provider is called",
);
ok(
  routeSrc.lastIndexOf("refundReservation({") > routeSrc.indexOf("catch (err)"),
  "the refund still lives in the catch that follows the provider call",
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
