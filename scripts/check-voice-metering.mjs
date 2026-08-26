// scripts/check-voice-metering.mjs
//
// The voice meter, EXECUTED rather than read.
//
//   npm run check:voice-metering
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// A live tenant took a real phone call and had zero VoiceCall rows, zero credit
// entries and zero errors. Every minute this product bills was billed from one
// branch of one webhook, and when that delivery stopped nothing anywhere
// noticed — because a webhook that never arrives looks exactly like a phone
// nobody rang. Balances never fell, so nobody was ever cut off, so a company at
// zero credit talked indefinitely on FieldQuo's pooled Retell account.
//
// Every assertion below is a sentence somebody could otherwise get wrong again,
// and each one costs real money in one direction or the other:
//
//   1. A call is billed EXACTLY ONCE, whether the webhook sees it, the
//      reconciler sees it, or both see it in either order.
//   2. A duration we cannot establish is UNBILLED and flagged — never zero,
//      never an average.
//   3. Hostile input (negative, 1e400, NaN, a poisoned rate) never produces a
//      negative charge, an Infinity, or a silent zero.
//   4. An unreachable provider charges nobody and detaches nobody.
//   5. A balance crossing zero DETACHES at the provider; a top-up re-attaches.
//   6. Enforcement is at the provider, and covers OUTBOUND as well as inbound.
//
// NO NETWORK AND NO DATABASE. Both are injected, and the code under test is the
// real shipped code — chargeCall, debitCredit, costForSeconds,
// reconcileVoiceCalls, ceilingMsFor, alertsFor. A check that asserts on a copy
// of the logic passes forever while the copy rots.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  costForSeconds,
  chargeCall,
  debitCredit,
  addCredit,
  balanceFor,
  canTakeCall,
  ratePerMinute,
  CENTS_PER_MINUTE,
} from "@/lib/voice/credits";
import {
  reconcileVoiceCalls,
  durationSecondsOf,
  ourNumberOn,
} from "@/lib/voice/reconcileCalls";
import { ceilingMsFor, MIN_CALL_MS, MAX_CALL_MS } from "@/lib/voice/callCeiling";
import { alertsFor, PROVIDER_COST_CENTS_PER_MINUTE } from "@/lib/voice/pool";
import {
  providerCostCentsOf,
  providerCostPatch,
  marginOf,
  summariseMargin,
  MARGIN_FLOOR_RATIO,
} from "@/lib/voice/providerCost";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Comments stripped before any source assertion. The naive grep fails the
// moment a file explains in prose why it must not do the thing — the same trap
// check-booking-fee documents. Assert on code, never on the words around it.
const codeOf = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   A fake Prisma, with the ONE semantic that matters: the unique index.
   ══════════════════════════════════════════════════════════════════════════
   @@unique([companyId, ref]) is the entire "never bill twice" guarantee. If
   this fake let a second row through, every idempotency assertion below would
   pass against a database that does not exist. So it throws P2002, exactly as
   Postgres does, and writeEntry's recovery path is exercised for real. */
function fakeDb(seed = {}) {
  const entries = [];
  const numbers = (seed.numbers || []).map((n) => ({ ...n }));
  const calls = new Map();
  let n = 0;

  return {
    _entries: entries,
    _calls: calls,
    voiceCreditEntry: {
      async create({ data }) {
        if (
          data.ref != null &&
          entries.some((e) => e.companyId === data.companyId && e.ref === data.ref)
        ) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `e_${++n}`, createdAt: new Date(), ...data };
        entries.push(row);
        return row;
      },
      async findFirst({ where }) {
        return (
          entries.find((e) =>
            Object.entries(where).every(([k, v]) => (v === undefined ? true : e[k] === v)),
          ) || null
        );
      },
      async aggregate({ where }) {
        const sum = entries
          .filter((e) => e.companyId === where.companyId)
          .reduce((t, e) => t + e.cents, 0);
        return { _sum: { cents: sum } };
      },
    },
    voicePhoneNumber: {
      async findMany() {
        return numbers.map((x) => ({ ...x }));
      },
      async findFirst({ where }) {
        return numbers.find((x) => x.companyId === where.companyId) || null;
      },
    },
    voiceCall: {
      // The reconciler asks whether a row already has a transcript before
      // spending a /v2/get-call on one. Real Prisma returns null for a miss.
      async findUnique({ where }) {
        return calls.get(where.providerCallId) || null;
      },
      async upsert({ where, create, update }) {
        const existing = calls.get(where.providerCallId);
        if (existing) calls.set(where.providerCallId, { ...existing, ...update });
        else calls.set(where.providerCallId, { ...create });
        return calls.get(where.providerCallId);
      },
    },
  };
}

const NUM = {
  id: "num1",
  e164: "+15550001111",
  companyId: "co1",
  agentId: "ag1",
  numberType: "local",
};
const TOLL = {
  id: "num2",
  e164: "+18005550000",
  companyId: "co2",
  agentId: "ag2",
  numberType: "toll_free",
};

const providerCall = (over = {}) => ({
  call_id: "c1",
  direction: "inbound",
  from_number: "+15559998888",
  to_number: NUM.e164,
  call_status: "ended",
  start_timestamp: 1_700_000_000_000,
  end_timestamp: 1_700_000_090_000,
  duration_ms: 90_000,
  ...over,
});

/** A reconciler run with everything stubbed and nothing reaching a network. */
function runner(db, calls, over = {}) {
  const detached = [];
  const ceilings = [];
  const logged = [];
  return {
    detached,
    ceilings,
    logged,
    run: (extra = {}) =>
      reconcileVoiceCalls({
        db,
        configured: true,
        listCalls: async () => ({ items: calls, has_more: false }),
        // /v3/list-calls carries no transcript — the reconciler fetches one
        // per rescued call from /v2/get-call. Stubbed so no check reaches the
        // network, and overridable by the transcript section below.
        getCall: async () => ({}),
        syncNumberAttachment: async (id) => detached.push(id),
        pushCallCeiling: async (id) => ceilings.push(id),
        recordError: async (e) => logged.push(e),
        ...over,
        ...extra,
      }),
  };
}

/* ────────────────────── 1. costForSeconds, exactly ───────────────────────── */

console.log("\ncostForSeconds — the arithmetic every charge is built on");
{
  const R = ratePerMinute("local");
  ok("rate is the configured 35¢ default", R === 35 && CENTS_PER_MINUTE === 35, `(${R})`);
  ok("0 seconds costs nothing", costForSeconds(0) === 0);
  ok("1 second costs the one-minute minimum", costForSeconds(1) === R, `(${costForSeconds(1)})`);
  ok("59 seconds is still one minute", costForSeconds(59) === R);
  ok("60 seconds is one minute", costForSeconds(60) === R);
  ok("61 seconds rounds up to two", costForSeconds(61) === 2 * R);
  ok("toll-free bills its own 40¢ rate", costForSeconds(1, "toll_free") === 40);
  ok("an unknown number type falls back to local", costForSeconds(1, "martian") === R);

  // Hostile. Each of these reached a Prisma Int column before this check existed.
  ok("negative seconds never bill", costForSeconds(-5) === 0);
  ok("negative seconds are never a NEGATIVE charge", !(costForSeconds(-5) < 0));
  ok("NaN never bills", costForSeconds(NaN) === 0);
  ok("null never bills", costForSeconds(null) === 0);
  ok("undefined never bills", costForSeconds(undefined) === 0);
  ok('"abc" never bills', costForSeconds("abc") === 0);
  ok("1e400 (Infinity) never bills", costForSeconds(1e400) === 0);
  ok("1e400 is never Infinity out", Number.isFinite(costForSeconds(1e400)));
  ok("-Infinity is never Infinity out", Number.isFinite(costForSeconds(-1e400)));
  ok("a huge-but-finite duration stays finite", Number.isFinite(costForSeconds(1e12)));

  // A string of digits is a real provider payload shape, and must still bill.
  ok('"90" bills two minutes', costForSeconds("90") === 2 * R);
}

/* ─────────────────── 2. duration extraction never guesses ────────────────── */

console.log("\ndurationSecondsOf — absence of a duration is not zero");
{
  ok("duration_ms wins", durationSecondsOf({ duration_ms: 90_000 }) === 90);
  ok("0 ms is a real zero", durationSecondsOf({ duration_ms: 0 }) === 0);
  ok(
    "timestamps are the fallback",
    durationSecondsOf({ start_timestamp: 1000, end_timestamp: 61_000 }) === 60,
  );
  ok("no duration and no timestamps is NULL", durationSecondsOf({}) === null);
  ok("null, not zero", durationSecondsOf({}) !== 0);
  ok("a negative duration_ms is not trusted", durationSecondsOf({ duration_ms: -5 }) === null);
  ok("Infinity is not trusted", durationSecondsOf({ duration_ms: 1e400 }) === null);
  ok("NaN is not trusted", durationSecondsOf({ duration_ms: NaN }) === null);
  ok(
    "a clock that ran backwards is not a negative call",
    durationSecondsOf({ start_timestamp: 61_000, end_timestamp: 1000 }) === null,
  );
  ok(
    "a start with no end is not a duration",
    durationSecondsOf({ start_timestamp: 1000 }) === null,
  );

  ok("inbound: our number is the one dialled", ourNumberOn(providerCall()) === NUM.e164);
  ok(
    "outbound: our number is the one calling",
    ourNumberOn(providerCall({ direction: "outbound", from_number: NUM.e164, to_number: "+15551112222" })) ===
      NUM.e164,
  );
}

/* ──────────────── 3. billed exactly once, in every arrival order ─────────── */

console.log("\nexactly once — whoever sees the call first");
{
  const R = ratePerMinute("local");

  // (a) The reconciler alone. This is the rescue.
  {
    const db = fakeDb({ numbers: [NUM] });
    const r = runner(db, [providerCall()]);
    const res = await r.run();
    ok("reconciler bills a call the webhook never delivered", res.rescued === 1);
    ok("charged 90s at two minutes", db._entries.length === 1 && db._entries[0].cents === -2 * R);
    ok("balance moved by exactly that", (await balanceFor("co1", db)) === -2 * R);
    ok("a VoiceCall row was created too", db._calls.has("c1"));
    ok(
      "the rescue is LOUD — a repaired meter must not stay broken",
      r.logged.some((e) => e.code === "webhook_missed"),
    );
    ok("the company was re-synced at the provider", r.detached.includes("co1"));
    ok("and its call ceiling re-pushed", r.ceilings.includes("co1"));
  }

  // (b) Webhook first, then the reconciler.
  {
    const db = fakeDb({ numbers: [NUM] });
    await chargeCall({ companyId: "co1", callId: "c1", seconds: 90, numberType: "local", prisma: db });
    const before = db._entries.length;
    const r = runner(db, [providerCall()]);
    const res = await r.run();
    ok("webhook then reconciler: still one entry", db._entries.length === before && before === 1);
    ok("reconciler reports it as already billed", res.alreadyBilled === 1 && res.rescued === 0);
    ok("no second rescue log", !r.logged.some((e) => e.code === "webhook_missed"));
  }

  // (c) Reconciler first, then the webhook (call_ended AND call_analyzed).
  {
    const db = fakeDb({ numbers: [NUM] });
    await runner(db, [providerCall()]).run();
    await chargeCall({ companyId: "co1", callId: "c1", seconds: 90, numberType: "local", prisma: db });
    await chargeCall({ companyId: "co1", callId: "c1", seconds: 92, numberType: "local", prisma: db });
    ok("reconciler then two webhook events: one entry", db._entries.length === 1);
    ok("and the amount is the first one written", db._entries[0].cents === -2 * R);
  }

  // (d) The reconciler run twice — an overlapping cron.
  {
    const db = fakeDb({ numbers: [NUM] });
    const r = runner(db, [providerCall()]);
    await r.run();
    const second = await r.run();
    ok("a cron that overlaps itself bills once", db._entries.length === 1);
    ok("and says so", second.rescued === 0 && second.alreadyBilled === 1);
  }

  // (e) Both paths key on the SAME ref. If they ever diverged, every check
  //     above would still pass while production billed twice.
  {
    const db = fakeDb({ numbers: [NUM] });
    await chargeCall({ companyId: "co1", callId: "c9", seconds: 30, prisma: db });
    ok("the idempotency key is call:<providerCallId>", db._entries[0].ref === "call:c9");
    ok("and the reconciler looks up that exact key", codeOf("lib/voice/reconcileCalls.js").includes("`call:${providerCallId}`"));
  }

  // (f) The legacy callId key still protects rows written before refs existed.
  {
    const db = fakeDb({ numbers: [NUM] });
    await db.voiceCreditEntry.create({
      data: { companyId: "co1", cents: -35, kind: "call", callId: "old1", ref: null },
    });
    await chargeCall({ companyId: "co1", callId: "old1", seconds: 30, prisma: db });
    ok("a pre-ref row is not double-charged", db._entries.length === 1);
  }
}

/* ────────────── 4. a duration we can't establish is never invented ───────── */

console.log("\nnever invent a charge");
{
  const db = fakeDb({ numbers: [NUM] });
  const r = runner(db, [providerCall({ duration_ms: undefined, start_timestamp: undefined, end_timestamp: undefined })]);
  const res = await r.run();
  ok("an unknown duration bills nothing", db._entries.length === 0);
  ok("it is counted, not swallowed", res.unknownDuration === 1);
  ok("it is not counted as a zero-length call", res.zeroLength === 0);
  ok("a human is told", r.logged.some((e) => e.code === "unknown_duration"));
  ok("no detach was triggered by it", r.detached.length === 0);

  // And the row's durationSec is left ALONE — writing 0 would turn "we don't
  // know" into "it was empty" permanently.
  ok("durationSec is not written as 0", db._calls.get("c1")?.durationSec === undefined);
}
{
  // A genuine zero-length call IS free, and is a different case.
  const db = fakeDb({ numbers: [NUM] });
  const res = await runner(db, [providerCall({ duration_ms: 0, end_timestamp: 1_700_000_000_000 })]).run();
  ok("a real zero-length call is free", db._entries.length === 0 && res.zeroLength === 1);
  ok("and is not flagged as unknown", res.unknownDuration === 0);
}
{
  // A call on a number we have no row for is FieldQuo's cost and nobody's charge.
  const db = fakeDb({ numbers: [NUM] });
  const r = runner(db, [providerCall({ to_number: "+15557778888" })]);
  const res = await r.run();
  ok("a call on an unknown number charges nobody", db._entries.length === 0);
  ok("and is surfaced as unattributed", res.unknownNumber === 1 && r.logged.some((e) => e.code === "unattributed_calls"));
}

/* ─────────── 5. an unreachable provider charges and detaches nobody ──────── */

console.log("\nan unreachable provider is not evidence of usage");
{
  const db = fakeDb({ numbers: [NUM] });
  const detached = [];
  const ceilings = [];
  const res = await reconcileVoiceCalls({
    db,
    configured: true,
    listCalls: async () => {
      throw new Error("ECONNRESET");
    },
    syncNumberAttachment: async (id) => detached.push(id),
    pushCallCeiling: async (id) => ceilings.push(id),
    recordError: async () => {},
  });
  ok("it says provider_unreachable", res.ok === false && res.reason === "provider_unreachable");
  ok("nobody was charged", db._entries.length === 0);
  ok("nobody was detached", detached.length === 0);
  ok("no ceiling was moved", ceilings.length === 0);
}
{
  // No key is not "zero calls". Reporting an empty result we never asked for is
  // the same lie the broken webhook told.
  const db = fakeDb({ numbers: [NUM] });
  const res = await reconcileVoiceCalls({ db, configured: false, listCalls: async () => ({ items: [] }) });
  ok("no API key reports not_configured, not success", res.ok === false && res.reason === "not_configured");
}
{
  // A partial page failure bills what it saw and refuses to act on a balance.
  const db = fakeDb({ numbers: [NUM] });
  const detached = [];
  let call = 0;
  const res = await reconcileVoiceCalls({
    db,
    configured: true,
    listCalls: async () => {
      call++;
      if (call === 1) return { items: [providerCall()], has_more: true, pagination_key: "k" };
      throw new Error("timeout");
    },
    syncNumberAttachment: async (id) => detached.push(id),
    pushCallCeiling: async () => {},
    recordError: async () => {},
  });
  ok("a partial read still bills what it saw", res.rescued === 1);
  ok("but refuses to detach on an incomplete picture", res.partial === true && detached.length === 0);
}

/* ────────────── 6. the cut-off: zero detaches, a top-up re-attaches ──────── */

console.log("\nthe cut-off, at the provider");
{
  const R = ratePerMinute("local");
  const db = fakeDb({ numbers: [NUM] });

  await addCredit({ companyId: "co1", cents: 3 * R, kind: "topup", stripeRef: "s1", prisma: db });
  ok("with 3 minutes of credit a call is allowed", (await canTakeCall("co1", "local", db)).allowed);

  // Burn it with a three-minute call.
  await chargeCall({ companyId: "co1", callId: "burn", seconds: 180, numberType: "local", prisma: db });
  const after = await canTakeCall("co1", "local", db);
  ok("at zero, a call is refused", after.allowed === false && after.cents === 0);

  // And that refusal is what syncNumberAttachment turns into a DETACH. Asserted
  // on the shipped source: this is the one line the entire feature rests on,
  // and it is a provider call, not a UI state.
  const prov = codeOf("lib/voice/provision.js");
  ok(
    "shouldAnswer needs BOTH the switch and the credit",
    /const shouldAnswer\s*=\s*Boolean\(agent\?\.enabled\)\s*&&\s*allowed/.test(prov),
  );
  ok("and a false verdict attaches NULL — a number with no agent rings out", /const want\s*=\s*shouldAnswer\s*\?\s*providerAgentId\s*:\s*null/.test(prov));
  ok("the detach is read back rather than trusted", prov.includes("boundAgentId(live) !== want"));

  // Top up. The balance is a SUM, so credit restores the verdict with no extra
  // state to get out of step.
  await addCredit({ companyId: "co1", cents: 1000, kind: "topup", stripeRef: "s2", prisma: db });
  ok("a top-up re-allows calls", (await canTakeCall("co1", "local", db)).allowed);
  ok(
    "and the top-up route re-attaches AND lifts the ceiling",
    (() => {
      const t = codeOf("app/api/settings/voice/topup/route.js");
      return t.includes("syncNumberAttachment(") && t.includes("pushCallCeiling(");
    })(),
  );

  // A retried Stripe webhook must not double the credit.
  const before = await balanceFor("co1", db);
  await addCredit({ companyId: "co1", cents: 1000, kind: "topup", stripeRef: "s2", prisma: db });
  ok("a replayed top-up credits once", (await balanceFor("co1", db)) === before);
}
{
  // Toll-free: the gate must price against the number that will take the call.
  const db = fakeDb({ numbers: [TOLL] });
  await addCredit({ companyId: "co2", cents: 37, kind: "topup", stripeRef: "t1", prisma: db });
  ok("37¢ is not enough for a 40¢ toll-free minute", (await canTakeCall("co2", "toll_free", db)).allowed === false);
  ok("checking it as local would have wrongly allowed it", (await canTakeCall("co2", "local", db)).allowed === true);
}

/* ───────────────────── 7. the mid-call ceiling ───────────────────────────── */

console.log("\nthe mid-call ceiling — a 2-minute balance cannot buy an hour");
{
  const R = ratePerMinute("local");
  ok("Retell's floor is respected at zero", ceilingMsFor(0) === MIN_CALL_MS);
  ok("one minute of credit buys one minute", ceilingMsFor(R) === 60_000);
  ok("two minutes of credit buys two", ceilingMsFor(2 * R) === 120_000);
  ok("thirty minutes buys thirty", ceilingMsFor(30 * R) === 1_800_000);
  ok("it never exceeds Retell's 2h maximum", ceilingMsFor(100_000_000) === MAX_CALL_MS);
  ok("it never drops below Retell's 1m minimum", ceilingMsFor(1) === MIN_CALL_MS);
  ok("negative balances clamp to the floor, not below", ceilingMsFor(-5000) === MIN_CALL_MS);
  ok("NaN clamps to the floor", ceilingMsFor(NaN) === MIN_CALL_MS);
  // A balance that isn't a number is not a rich company. Nonsense resolves
  // DOWNWARD to the floor, never upward — granting two hours of talk time on an
  // unreadable balance is the exact failure this file exists to stop.
  ok("Infinity resolves to the floor, never to Infinity", ceilingMsFor(1e400) === MIN_CALL_MS);
  ok("and is never Infinity out", Number.isFinite(ceilingMsFor(1e400)));
  ok("every output is a finite integer in range", [0, 1, R, 1e9, NaN, -1, 1e400].every((c) => {
    const v = ceilingMsFor(c);
    return Number.isInteger(v) && v >= MIN_CALL_MS && v <= MAX_CALL_MS;
  }));
  ok(
    "toll-free buys fewer minutes of ceiling than local for the same money",
    ceilingMsFor(400, "toll_free") < ceilingMsFor(400, "local"),
  );

  // The floor and the gate line up: anything allowed to start can afford the
  // shortest call Retell lets us configure. No gap to absorb.
  ok(
    "any balance that passes canTakeCall affords the minimum ceiling",
    costForSeconds(MIN_CALL_MS / 1000, "local") <= ratePerMinute("local"),
  );

  // Enforced at the PROVIDER, and on BOTH agents.
  const cc = codeOf("lib/voice/callCeiling.js");
  ok("the ceiling is pushed to Retell, not stored in a column", cc.includes("updateAgent(") && cc.includes("max_call_duration_ms"));
  ok("outbound agents get it too", cc.includes("outboundProviderAgentId"));
  const prov = codeOf("lib/voice/provision.js");
  ok("provisioning sends it on the inbound agent", /max_call_duration_ms:\s*maxCallMs/.test(prov));
  ok("and on the outbound agent", (prov.match(/max_call_duration_ms:\s*maxCallMs/g) || []).length >= 2);
  // ── Placement, not presence ─────────────────────────────────────────────
  //
  // `pushCallCeiling` must sit OUTSIDE the `if (!after.allowed)` block. Inside
  // it, the ceiling only ever moves once the balance is already empty — which
  // is precisely too late, because the call that empties it is the one that
  // needed the shorter ceiling. Presence alone would pass either way, so this
  // counts braces rather than trusting a substring.
  ok(
    "the webhook re-pushes the ceiling after EVERY call, not only on exhaustion",
    (() => {
      const w = codeOf("app/api/voice/webhook/route.js");
      const start = w.indexOf("if (!after.allowed)");
      const push = w.indexOf("pushCallCeiling(");
      if (start < 0 || push < 0 || push < start) return false;
      // Walk from the `if` to the push, tracking depth. Back at or below the
      // depth the `if` opened at means we left the block.
      let depth = 0;
      for (let i = w.indexOf("{", start); i < push; i++) {
        if (w[i] === "{") depth++;
        else if (w[i] === "}") depth--;
      }
      return depth <= 0;
    })(),
  );
}

/* ───────────── 8. outbound: a detached number is not a spend limit ───────── */

console.log("\noutbound — dialling out costs the pool too");
{
  const out = codeOf("lib/voice/outboundCall.js");
  ok("credit is re-checked at DIAL time", out.includes("canTakeCall("));
  ok(
    "and priced against the number we dial from, not assumed local",
    /canTakeCall\(task\.companyId,\s*number\.numberType\)/.test(out),
  );
  ok(
    "the credit check happens after the number is resolved",
    out.indexOf("resolveCaller(") < out.indexOf("canTakeCall("),
  );
  ok(
    "the contractor's own outbound switch is read at dial time, not just at enqueue",
    out.includes("company.outboundCallsEnabled"),
  );
  ok(
    "the platform kill switch is checked before spending",
    out.includes('featureAllowsSpend(task.companyId, "voice_receptionist")'),
  );
  // The cron must not have its own copy of any of these. A second gate is the
  // one that rots.
  const cron = codeOf("app/api/cron/voice-outbound/route.js");
  ok("the cron has no credit logic of its own", !/canTakeCall|balanceFor|costForSeconds/.test(cron));
}

/* ──────────────────── 9. the shared pool, and its honesty ────────────────── */

console.log("\nthe pool — read what Retell gives, derive the rest, say which");
{
  ok(
    "concurrency is READ from Retell",
    codeOf("lib/voice/retell.js").includes("/get-concurrency"),
  );
  ok(
    "list-calls uses /v3/ — the legacy GET /list-calls is deprecated, no sunset date",
    (() => {
      const r = codeOf("lib/voice/retell.js");
      return r.includes("/v3/list-calls") && !r.includes("/v2/list-calls");
    })(),
  );
  ok(
    "provider cost is NOT confused with what we charge",
    PROVIDER_COST_CENTS_PER_MINUTE !== CENTS_PER_MINUTE,
  );

  // Alerts fire BEFORE exhaustion, never only after.
  ok("a healthy pool raises nothing", alertsFor({ conc: { current: 1, limit: 20 } }).length === 0);
  ok(
    "70% of the shared ceiling warns",
    alertsFor({ conc: { current: 15, limit: 20 } }).some((a) => a.code === "concurrency_high"),
  );
  ok(
    "the ceiling itself is critical",
    alertsFor({ conc: { current: 20, limit: 20 } }).some(
      (a) => a.code === "concurrency_exhausted" && a.level === "critical",
    ),
  );
  ok(
    "thin runway warns before it runs out",
    alertsFor({ remainingCents: 5000, runwayDays: 3 }).some((a) => a.code === "pool_low"),
  );
  ok(
    "a spent pool is critical",
    alertsFor({ remainingCents: -1, runwayDays: -1 }).some((a) => a.code === "pool_spent"),
  );
  ok(
    "an unreadable concurrency is reported, not treated as zero",
    alertsFor({ error: "504" }).some((a) => a.code === "concurrency_unreadable"),
  );
  ok(
    "an unknown balance invents nothing",
    alertsFor({ conc: { current: 1, limit: 20 }, remainingCents: null, runwayDays: null }).length === 0,
  );
  // Every derived figure must SAY it is derived, wherever it surfaces.
  ok(
    "the derived figures are labelled as derived in the payload",
    read("lib/voice/pool.js").includes('basis: "derived"') && read("lib/voice/pool.js").includes('basis: "read"'),
  );
  ok(
    "and on the platform page",
    read("app/platform/page.js").includes("derived, not read") &&
      read("app/platform/page.js").includes("read from Retell"),
  );
}

/* ───────────────── 10. wiring: none of this ships switched off ───────────── */

console.log("\nwiring — a reconciler nothing runs is a dead control");
{
  const vercel = JSON.parse(read("vercel.json"));
  const cron = vercel.crons?.find((c) => c.path === "/api/cron/voice-reconcile");
  ok("the reconciler cron is registered in vercel.json", Boolean(cron), cron?.schedule || "");
  ok("it runs at least hourly", /^\d+ \* \* \* \*$/.test(cron?.schedule || ""));
  ok("the route exists", fs.existsSync(path.join(ROOT, "app/api/cron/voice-reconcile/route.js")));
  ok(
    "and is protected by CRON_SECRET like every other cron",
    codeOf("app/api/cron/voice-reconcile/route.js").includes("process.env.CRON_SECRET"),
  );
  ok(
    "the platform console can see the pool",
    fs.existsSync(path.join(ROOT, "app/api/platform/voice-health/route.js")) &&
      read("app/platform/page.js").includes("/api/platform/voice-health"),
  );
  ok(
    "the platform console is superadmin-only and read-only about it",
    (() => {
      const v = codeOf("app/api/platform/voice-health/route.js");
      return v.includes("getCurrentPlatformAdmin") && !/\.(update|create|delete|upsert)\(/.test(v);
    })(),
  );
  // The contractor is told about the cut-off. A limit nobody was warned about
  // is a hidden fee — and this one hangs up on their customer.
  const messages = read("app/i18n/appMessages.js");
  ok(
    "the call-length cap is explained to the contractor",
    read("app/app/settings/voice/page.js").includes("app.setVoice.callCap"),
  );
  ok(
    "in all six catalogues",
    (messages.split('"app.setVoice.callCap":').length - 1) === 6,
  );
  ok(
    "both new env vars are documented",
    (() => {
      const d = read("docs/VERCEL.md");
      return d.includes("RETELL_CREDIT_PURCHASED_CENTS") && d.includes("RETELL_COST_CENTS_PER_MINUTE");
    })(),
  );
}

/* ─────────── N. the provider's OWN cost, and the measured margin ─────────── */

console.log("\nprovider cost — measured, never assumed");
{
  // ── The field, and its unit ───────────────────────────────────────────────
  //
  // `call_cost.combined_cost`, "Combined cost of all individual costs in
  // CENTS": https://docs.retellai.com/api-references/get-call
  //
  // Present on /v3/list-calls items and on the call object the call_ended /
  // call_analyzed webhooks carry. Fractional, because product unit prices are
  // documented in cents PER SECOND.
  ok(
    "combined_cost is read straight off call_cost, in cents",
    providerCostCentsOf({ call_cost: { combined_cost: 67 } }) === 67,
  );
  ok(
    "a fractional cost is kept, not rounded away",
    providerCostCentsOf({ call_cost: { combined_cost: 66.98 } }) === 66.98,
  );

  // ── The real call the owner pulled off his dashboard ──────────────────────
  //
  // call_24f6120f0adf969e5092d8d6ec7 — 3:51 (231s), $0.670. The single datum
  // that proved RETELL_COST_CENTS_PER_MINUTE was a guess, so it is pinned.
  {
    const m = marginOf({ billedCents: 140, providerCostCents: 67, durationSec: 231 });
    ok("the real call: 231s bills 4 minutes at 35¢ = $1.40", costForSeconds(231) === 140);
    ok("its measured spread is 73¢", m.spreadCents === 73);
    ok("its measured margin is 52%", Math.round(m.marginRatio * 100) === 52);
    ok(
      "Retell's real rate was 17.4¢/min, not the 16¢ assumed",
      Math.abs(67 / (231 / 60) - 17.4) < 0.05,
      `(${(67 / (231 / 60)).toFixed(2)}¢)`,
    );
    ok(
      "and the REAL duration is reported next to the billed one, so rounding " +
        "is not mistaken for margin",
      Math.abs(m.realMinutes - 3.85) < 0.01 && m.billedMinutes === 4,
    );
    ok("a healthy call is not flagged", m.below === false);
  }

  // ── Absence is unknown, never the constant ────────────────────────────────
  //
  // Same rule as durationSecondsOf: padding an absent number with a default is
  // how a guess becomes indistinguishable from a reading.
  ok("a call with no call_cost is unknown", providerCostCentsOf({}) === null);
  ok("an absent combined_cost is unknown", providerCostCentsOf({ call_cost: {} }) === null);
  ok("a null combined_cost is unknown", providerCostCentsOf({ call_cost: { combined_cost: null } }) === null);
  ok(
    "1e400 is unknown, never Infinity",
    providerCostCentsOf({ call_cost: { combined_cost: 1e400 } }) === null,
  );
  ok("NaN is unknown", providerCostCentsOf({ call_cost: { combined_cost: "abc" } }) === null);
  ok("a negative cost is unknown", providerCostCentsOf({ call_cost: { combined_cost: -5 } }) === null);
  ok(
    "an unknown cost is NEVER the fallback constant",
    providerCostCentsOf({}) !== PROVIDER_COST_CENTS_PER_MINUTE,
  );

  // The patch shape is what stops the two writers disagreeing, and what stops
  // call_analyzed erasing what call_ended recorded.
  ok(
    "a known cost produces a patch",
    providerCostPatch({ call_cost: { combined_cost: 67 } }).providerCostCents === 67,
  );
  ok(
    "an unknown cost produces an EMPTY patch, so it cannot blank an existing value",
    Object.keys(providerCostPatch({})).length === 0,
  );

  // ── An unknown cost must never look like free money ───────────────────────
  ok("no cost means no margin row at all", marginOf({ billedCents: 140, providerCostCents: null }) === null);
  ok(
    "and emphatically not a 100% margin",
    marginOf({ billedCents: 140, providerCostCents: null })?.marginRatio !== 1,
  );

  // ── A losing call is detectable ───────────────────────────────────────────
  {
    const loss = marginOf({ billedCents: 35, providerCostCents: 80, durationSec: 55 });
    ok("a call that cost more than it billed has a negative spread", loss.spreadCents === -45);
    ok("and is flagged", loss.below === true);
  }
  ok(
    "a thin-but-positive call is flagged at the floor",
    marginOf({ billedCents: 100, providerCostCents: 80, durationSec: 60 }).below === true,
    `(floor ${MARGIN_FLOOR_RATIO})`,
  );

  // ── The rollup states its coverage rather than presenting a sample as all ─
  {
    const sum = summariseMargin([
      { billedCents: 140, providerCostCents: 67, durationSec: 231 },
      { billedCents: 35, providerCostCents: 80, durationSec: 55 },
      { billedCents: 70, providerCostCents: null, durationSec: 90 },
    ]);
    ok("every call is counted in the total", sum.total === 3);
    ok("only priced calls are averaged in", sum.covered === 2);
    ok("the uncovered call contributes no cost", sum.costCents === 147);
    ok("the losing call is counted", sum.negative === 1);
    ok("the basis says the figure is measured", sum.basis === "measured");
    ok(
      "cost-per-minute is computed off REAL seconds, not billed minutes",
      Math.abs(sum.costCentsPerRealMinute - 147 / ((231 + 55) / 60)) < 0.001,
    );
    ok("nothing priced at all says so rather than showing zero", summariseMargin([]).basis === "none");
  }

  // ── It reaches the platform page, and both writers write it ───────────────
  ok(
    "a negative margin raises a CRITICAL alert nobody can miss",
    alertsFor({ margin: { covered: 2, total: 3, negative: 1, marginRatio: 0.4, costCentsPerRealMinute: 17 } })
      .some((a) => a.code === "margin_negative" && a.level === "critical"),
    "This is the thing that cannot be seen today.",
  );
  ok(
    "a stale cost constant is called out against Retell's own figures",
    alertsFor({ margin: { covered: 9, total: 9, negative: 0, marginRatio: 0.5, costCentsPerRealMinute: 30 } })
      .some((a) => a.code === "cost_constant_stale"),
  );
  ok(
    "nothing measured raises no margin alert — silence beats a guess",
    !alertsFor({ margin: { covered: 0, total: 4 } }).some((a) => a.code.startsWith("margin_")),
  );
  ok(
    "the webhook records the provider cost",
    codeOf("app/api/voice/webhook/route.js").includes("providerCostPatch"),
  );
  ok(
    "and so does the reconciler, through the same helper",
    codeOf("lib/voice/reconcileCalls.js").includes("providerCostPatch"),
  );
  ok(
    "the platform page shows the measured margin next to the derived spend",
    (() => {
      const page = read("app/platform/page.js");
      return page.includes("measured margin") && page.includes("derived, not read");
    })(),
  );
}

console.log("\nthe transcript the list response does not carry");
{
  // /v3/list-calls returns call_analysis, recording_url and call_cost but NOT
  // transcript / transcript_object. Reading them off a list item recorded every
  // rescued call with an empty transcript — permanently, because the update
  // branch only fills gaps.
  //   https://docs.retellai.com/api-references/list-calls  (no transcript)
  //   https://docs.retellai.com/api-references/get-call    (transcript)
  const db = fakeDb({ numbers: [NUM] });
  const asked = [];
  const r = runner(db, [providerCall({ call_cost: { combined_cost: 67 } })], {
    getCall: async (id) => {
      asked.push(id);
      return { transcript: "Hi, my kitchen tap is leaking." };
    },
  });
  await r.run();

  ok("the single-call read is used to get a transcript", asked.length === 1 && asked[0] === "c1");
  const row = db._calls.get("c1");
  ok("and it lands on the row", row?.transcript === "Hi, my kitchen tap is leaking.");
  ok("the provider cost lands on the same row", Number(row?.providerCostCents) === 67);

  // A detail read that fails costs the transcript and NOTHING else — the money
  // must not depend on it.
  const db2 = fakeDb({ numbers: [NUM] });
  const r2 = runner(db2, [providerCall({ call_cost: { combined_cost: 67 } })], {
    getCall: async () => {
      throw new Error("provider down");
    },
  });
  const res2 = await r2.run();
  ok("a failed transcript fetch still bills the call", res2.rescued === 1);
  ok("and records no transcript rather than inventing one", db2._calls.get("c1")?.transcript === null);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
