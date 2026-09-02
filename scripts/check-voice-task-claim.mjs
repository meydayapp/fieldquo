// scripts/check-voice-task-claim.mjs
//
// The outbound queue dials real phones. Prove it dials each one ONCE.
//
//   npm run check:voice-task-claim
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// app/api/cron/voice-outbound/route.js selected `status: "queued"` rows, handed
// each to placeQueuedCall, and wrote the outcome back afterwards. Nothing was
// claimed in between, so two overlapping invocations selected the same rows and
// placed the same call twice — a real, billed phone call to a real person,
// about a quote they had already been rung about.
//
// A comment claiming "the claim is atomic" is a claim. Two drainers running
// against one in-memory database that enforces the same compare-and-set
// Postgres does, with a dialler stub that COUNTS calls, is a measurement. So
// every guarantee below is run rather than read:
//
//   1. Two concurrent drainers that both see the same queued row place ONE
//      call between them.
//   2. A claim whose run died is reclaimable after the stale window, and not
//      one second before it.
//   3. A reclaim does not dial again. It asks the provider whether the dead run
//      already dialled — adopting the call if so, dialling only on a clear no,
//      and dialling NEVER when the provider cannot be read.
//   4. A sales call on FieldQuo's own line is reconcilable, so a dropped
//      webhook on it is recoverable instead of wrong for ever — with its tool
//      calls intact.
//   5. The platform console reports FieldQuo's own line as FieldQuo's own,
//      not as a billing leak.
//
// No database, no Retell, no network: every collaborator is injected, which is
// also why this runs in CI with no secrets.
//
// ══ The source rules are SCOPED ════════════════════════════════════════════
//
// Every string-matching assertion below runs against ONE named function pulled
// out by brace matching, never the whole file. A guard string that matches
// somewhere else in the same file — in a comment explaining it, or in a second
// function that happens to use the same words — is a false pass, and this
// project has shipped two of them.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  drainOutboundQueue,
  OUTBOUND_STALE_CLAIM_MINUTES,
  MAX_ATTEMPTS,
} from "@/lib/voice/drainOutbound";
import { findPlacedCallForTask } from "@/lib/voice/outboundCall";
import { reconcileVoiceCalls } from "@/lib/voice/reconcileCalls";
import { recordSalesCall, salesCallFields } from "@/lib/platform/salesCall";
import { auditVoiceNumbers } from "@/lib/voice/numberAudit";
import { transcriptTurns } from "@/lib/voice/transcript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

/**
 * ONE named function's source, by brace matching.
 *
 * Returns "" when the name is absent, which fails every rule written against
 * it — a renamed function must break loudly rather than silently stop being
 * checked.
 */
function fnSource(src, name) {
  const re = new RegExp(`(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return "";
  // Walk the argument list to its closing paren, then take the body from the
  // first brace after it. Doing it by index rather than by regex is what makes
  // a default value containing a brace harmless.
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") depth--;
    i++;
  }
  const open = src.indexOf("{", i);
  if (open === -1) return "";
  depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, j + 1);
    }
  }
  return "";
}

/** Comments removed: a rule must check the code, never the prose about it. */
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MINUTE = 60_000;
const T0 = new Date("2026-09-01T15:00:00Z");
const at = (mins) => new Date(T0.getTime() + mins * MINUTE);

/* ═══════════════════════════════════════════════════════════════════════════
   A world: the VoiceCallTask table, with the one semantic that carries
   everything — updateMany refusing to match a row somebody else has moved.
   ═══════════════════════════════════════════════════════════════════════════ */

function matches(row, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") {
      if (!v.some((w) => matches(row, w))) return false;
      continue;
    }
    const val = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("lte" in v) {
        if (val == null) return false;
        if (new Date(val).getTime() > new Date(v.lte).getTime()) return false;
      }
      if ("in" in v && !v.in.includes(val)) return false;
      continue;
    }
    const a = val instanceof Date ? val.getTime() : val;
    const b = v instanceof Date ? v.getTime() : v;
    if (a !== b) return false;
  }
  return true;
}

function makeWorld({ tasks = [] } = {}) {
  const rows = tasks.map((t, i) => ({
    id: t.id || `task${i}`,
    companyId: "co1",
    purpose: "quote_followup",
    status: "queued",
    notBefore: new Date("2026-09-01T09:00:00Z"),
    attempts: 0,
    lastError: null,
    lastTriedAt: null,
    providerCallId: null,
    context: {},
    ...t,
  }));

  const errors = [];
  let findManyCalls = 0;
  let beforeFindMany = null;

  const db = {
    voiceCallTask: {
      async findMany({ where, orderBy, take }) {
        findManyCalls++;
        if (beforeFindMany) await beforeFindMany(findManyCalls, where);
        let out = rows.filter((r) => matches(r, where));
        const key = orderBy ? Object.keys(orderBy)[0] : null;
        if (key) {
          out = [...out].sort((a, b) => {
            const x = a[key] ? new Date(a[key]).getTime() : 0;
            const y = b[key] ? new Date(b[key]).getTime() : 0;
            return x - y;
          });
        }
        // Snapshots, like a real read: a later mutation must not retro-edit
        // what a racer already read.
        return out.slice(0, take ?? out.length).map((r) => ({ ...r }));
      },
      async updateMany({ where, data }) {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
    },
  };

  return {
    db,
    rows,
    errors,
    row: (id) => rows.find((r) => r.id === id),
    recordError: async (e) => {
      errors.push(e);
    },
    gateOnFindMany: (fn) => {
      beforeFindMany = fn;
    },
  };
}

/** A dialler that counts. The whole point of the exercise. */
function makeDialler(result = { placed: true, providerCallId: "call_A" }) {
  const calls = [];
  return {
    calls,
    place: async (task) => {
      calls.push(task.id);
      return typeof result === "function" ? result(task) : result;
    },
  };
}

console.log("\n══ 1. Two concurrent drainers place ONE call ═══════════════════════\n");

{
  const w = makeWorld({ tasks: [{ id: "t1" }] });
  const dialler = makeDialler();

  // Both runs read the queue BEFORE either claims — the serverless case this
  // whole mechanism exists for. Released once both have their snapshot.
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let firstReads = 0;
  // Gated on the QUERY, not on a call counter: the two runs interleave at
  // whatever point their awaits fall, and a counter that assumed an order
  // deadlocked. The first run to read the queued rows waits; the second
  // releases it, so both hold the same snapshot whichever got there first.
  w.gateOnFindMany(async (_n, where) => {
    if (where.status !== "queued") return;
    firstReads++;
    if (firstReads === 1) await gate;
    else release();
  });

  const run = () =>
    drainOutboundQueue({
      db: w.db,
      placeQueuedCall: dialler.place,
      findPlacedCallForTask: async () => null,
      recordError: w.recordError,
      now: T0,
    });

  const [a, b] = await Promise.all([run(), run()]);

  ok("both drainers really did read the same queued row", firstReads === 2);
  ok(
    "exactly one call was placed at the provider",
    dialler.calls.length === 1,
    `placed ${dialler.calls.length}`,
  );
  ok(
    "…one run placed it and the other was refused the claim",
    a.placed + b.placed === 1 && a.raced + b.raced === 1,
    JSON.stringify({ a: { placed: a.placed, raced: a.raced }, b: { placed: b.placed, raced: b.raced } }),
  );
  ok("…and the task ends done, with the call id on it", w.row("t1").status === "done" && w.row("t1").providerCallId === "call_A");
}

{
  // The claim is entered BEFORE the dial, not after it. Asserted by watching
  // the row from inside the dialler.
  const w = makeWorld({ tasks: [{ id: "t2" }] });
  let statusAtDialTime = null;
  await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: async (task) => {
      statusAtDialTime = w.row(task.id).status;
      return { placed: true, providerCallId: "call_B" };
    },
    findPlacedCallForTask: async () => null,
    recordError: w.recordError,
    now: T0,
  });
  ok(
    "the row says `calling` while the phone is ringing, not `queued`",
    statusAtDialTime === "calling",
    `saw ${statusAtDialTime}`,
  );
}

{
  // A task not yet due is not dialled at all.
  const w = makeWorld({ tasks: [{ id: "t3", notBefore: at(60) }] });
  const dialler = makeDialler();
  const t = await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: dialler.place,
    findPlacedCallForTask: async () => null,
    recordError: w.recordError,
    now: T0,
  });
  ok("a task held for later is not dialled", dialler.calls.length === 0 && t.considered === 0);
  ok("…and is left queued", w.row("t3").status === "queued");
}

console.log("\n══ 2. A stale claim is reclaimable — and only when stale ═══════════\n");

{
  const fresh = makeWorld({
    tasks: [{ id: "t4", status: "calling", lastTriedAt: at(-(OUTBOUND_STALE_CLAIM_MINUTES - 1)) }],
  });
  const dialler = makeDialler();
  const t = await drainOutboundQueue({
    db: fresh.db,
    placeQueuedCall: dialler.place,
    findPlacedCallForTask: async () => null,
    recordError: fresh.recordError,
    now: T0,
  });
  ok(
    "a claim younger than the stale window is left strictly alone",
    t.considered === 0 && dialler.calls.length === 0,
  );
  ok("…and the row is untouched", fresh.row("t4").status === "calling");
}

{
  const w = makeWorld({
    tasks: [{ id: "t5", status: "calling", lastTriedAt: at(-(OUTBOUND_STALE_CLAIM_MINUTES + 1)) }],
  });
  const dialler = makeDialler({ placed: true, providerCallId: "call_C" });
  const t = await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: dialler.place,
    // The dead run never got as far as dialling.
    findPlacedCallForTask: async () => null,
    recordError: w.recordError,
    now: T0,
  });
  ok(
    "a claim older than the stale window is reclaimed rather than wedged for ever",
    t.considered === 1 && t.placed === 1,
  );
  ok("…and the call the dead run never made is finally made", dialler.calls.length === 1);
  ok("…once", w.row("t5").status === "done" && w.row("t5").providerCallId === "call_C");
}

{
  // A `calling` row with no stamp at all must not be invisible: `lte` excludes
  // NULL in SQL, which would wedge it permanently.
  const w = makeWorld({ tasks: [{ id: "t6", status: "calling", lastTriedAt: null }] });
  const dialler = makeDialler();
  const t = await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: dialler.place,
    findPlacedCallForTask: async () => null,
    recordError: w.recordError,
    now: T0,
  });
  ok("a claim with no stamp is treated as stale, not as invisible", t.considered === 1);
}

{
  // Two drainers arriving on the SAME abandoned row. The compare-and-set is on
  // the stamp they both read, so only one can take it over.
  const w = makeWorld({
    tasks: [{ id: "t7", status: "calling", lastTriedAt: at(-(OUTBOUND_STALE_CLAIM_MINUTES + 5)) }],
  });
  const dialler = makeDialler({ placed: true, providerCallId: "call_D" });
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let reads = 0;
  w.gateOnFindMany(async (_n, where) => {
    if (where.status !== "calling") return;
    reads++;
    if (reads === 1) await gate;
    else release();
  });
  const run = () =>
    drainOutboundQueue({
      db: w.db,
      placeQueuedCall: dialler.place,
      findPlacedCallForTask: async () => null,
      recordError: w.recordError,
      now: T0,
    });
  const [a, b] = await Promise.all([run(), run()]);
  ok("both drainers read the same abandoned claim", reads === 2);
  ok(
    "only one of them takes it over",
    dialler.calls.length === 1 && a.raced + b.raced === 1,
    `dialled ${dialler.calls.length}`,
  );
}

console.log("\n══ 3. A reclaim does not double-call ═══════════════════════════════\n");

{
  // The dead run DID dial. The reclaim must adopt that call, not make another.
  const w = makeWorld({
    tasks: [{ id: "t8", status: "calling", lastTriedAt: at(-20) }],
  });
  const dialler = makeDialler();
  const t = await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: dialler.place,
    findPlacedCallForTask: async () => ({ call_id: "call_already", metadata: { taskId: "t8" } }),
    recordError: w.recordError,
    now: T0,
  });
  ok(
    "a reclaim that finds the call already placed dials NOBODY",
    dialler.calls.length === 0,
    `dialled ${dialler.calls.length}`,
  );
  ok("…and adopts the call the dead run made", t.adopted === 1 && w.row("t8").providerCallId === "call_already");
  ok("…recording it as done rather than leaving it to be found again", w.row("t8").status === "done");
  ok(
    "…and says so out loud, because a run dying mid-dial is worth knowing about",
    w.errors.some((e) => e.code === "claim_recovered"),
  );
}

{
  // The provider cannot be read. Not knowing is not permission to dial.
  const w = makeWorld({ tasks: [{ id: "t9", status: "calling", lastTriedAt: at(-20) }] });
  const dialler = makeDialler();
  const t = await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: dialler.place,
    findPlacedCallForTask: async () => {
      throw new Error("provider down");
    },
    recordError: w.recordError,
    now: T0,
  });
  ok(
    "an unreadable provider is not evidence that nothing was dialled — nobody is rung",
    dialler.calls.length === 0 && t.unverified === 1,
  );
  ok("…the attempt is counted", w.row("t9").attempts === 1);
  ok(
    "…the reason is written down rather than swallowed",
    /provider down/.test(w.row("t9").lastError || ""),
  );
  ok(
    "…and it stays claimed, so the FRESH path (which never checks) cannot pick it up",
    w.row("t9").status === "calling",
  );
}

{
  // …and it does not loop for ever. Attempts are bounded and the end is recorded.
  const w = makeWorld({
    tasks: [{ id: "t10", status: "calling", lastTriedAt: at(-20), attempts: MAX_ATTEMPTS - 1 }],
  });
  const dialler = makeDialler();
  const t = await drainOutboundQueue({
    db: w.db,
    placeQueuedCall: dialler.place,
    findPlacedCallForTask: async () => {
      throw new Error("still down");
    },
    recordError: w.recordError,
    now: T0,
  });
  ok(
    "an endlessly unreadable provider ends in a recorded failure, not an endless queue",
    t.failed === 1 && w.row("t10").status === "failed" && dialler.calls.length === 0,
  );
  ok("…with the reason on the row", Boolean(w.row("t10").lastError));
}

{
  // Every non-placed verdict still lands somewhere. Nothing is dropped.
  const cases = [
    { verdict: { placed: false, terminal: true, reason: "They opted out." }, status: "skipped" },
    { verdict: { placed: false, retryLater: true, reason: "Outside calling hours." }, status: "queued" },
    { verdict: { placed: false, reason: "The provider refused." }, status: "queued" },
  ];
  for (const c of cases) {
    const w = makeWorld({ tasks: [{ id: "tx" }] });
    await drainOutboundQueue({
      db: w.db,
      placeQueuedCall: async () => c.verdict,
      findPlacedCallForTask: async () => null,
      recordError: w.recordError,
      now: T0,
    });
    ok(
      `a "${c.verdict.reason}" verdict lands as ${c.status}, with its reason`,
      w.row("tx").status === c.status && w.row("tx").lastError === c.verdict.reason,
      w.row("tx").status,
    );
  }

  // A hold must not burn the retry budget; a transient failure must.
  const held = makeWorld({ tasks: [{ id: "th" }] });
  await drainOutboundQueue({
    db: held.db,
    placeQueuedCall: async () => ({ placed: false, retryLater: true, reason: "No credit." }),
    findPlacedCallForTask: async () => null,
    recordError: held.recordError,
    now: T0,
  });
  ok("a hold does not count as an attempt", held.row("th").attempts === 0);

  const failed = makeWorld({ tasks: [{ id: "tf" }] });
  await drainOutboundQueue({
    db: failed.db,
    placeQueuedCall: async () => ({ placed: false, reason: "Refused." }),
    findPlacedCallForTask: async () => null,
    recordError: failed.recordError,
    now: T0,
  });
  ok("a transient failure does", failed.row("tf").attempts === 1);

  // A throw from the dialler is a call that was never made — never a silent loss.
  const threw = makeWorld({ tasks: [{ id: "tt" }] });
  const t = await drainOutboundQueue({
    db: threw.db,
    placeQueuedCall: async () => {
      throw new Error("boom");
    },
    findPlacedCallForTask: async () => null,
    recordError: threw.recordError,
    now: T0,
  });
  ok(
    "a dialler that throws leaves the task recorded, not lost",
    t.held === 1 && threw.row("tt").status === "queued" && /boom/.test(threw.row("tt").lastError),
  );
}

console.log("\n── the lookup that makes a reclaim safe ────────────────────────────\n");

{
  const asked = [];
  const found = await findPlacedCallForTask(
    { id: "t42", lastTriedAt: at(-20) },
    {
      now: T0,
      list: async (args) => {
        asked.push(args);
        return {
          items: [
            { call_id: "someone_else", metadata: { taskId: "t99" } },
            { call_id: "ours", metadata: { taskId: "t42" }, call_status: "ongoing" },
          ],
        };
      },
    },
  );
  ok("the task's own call is found by the id we stamped on it", found?.call_id === "ours");
  ok("…and another task's call is not mistaken for it", found?.call_id !== "someone_else");
  ok(
    "the lookup drops the ended-only filter, or a call still connected is invisible",
    asked[0]?.statuses === null,
  );
  ok(
    "…and it looks back from the dead claim, not from now",
    asked[0]?.sinceMs < at(-20).getTime() + 1,
  );

  const none = await findPlacedCallForTask(
    { id: "t42", lastTriedAt: at(-20) },
    { now: T0, list: async () => ({ items: [] }) },
  );
  ok("nothing at the provider is a clear no, not a maybe", none === null);

  let threw = false;
  try {
    await findPlacedCallForTask(
      { id: "t42", lastTriedAt: at(-20) },
      {
        now: T0,
        list: async () => {
          throw new Error("503");
        },
      },
    );
  } catch {
    threw = true;
  }
  ok("an unreadable list THROWS rather than returning a comfortable null", threw);
}

console.log("\n══ 4. A platform sales call is reconcilable ════════════════════════\n");

const SALES = "+16135550199";
const TENANT = "+16135550111";

function makeMeterWorld() {
  const platformRows = new Map();
  const voiceRows = new Map();
  return {
    platformRows,
    voiceRows,
    prisma: {
      voicePhoneNumber: {
        findMany: async () => [
          { id: "n1", e164: TENANT, companyId: "co1", agentId: "ag1", numberType: "local" },
        ],
      },
      platformVoiceCall: {
        findUnique: async ({ where }) => platformRows.get(where.providerCallId) || null,
        upsert: async ({ where, create, update }) => {
          const id = where.providerCallId;
          if (platformRows.has(id)) Object.assign(platformRows.get(id), update);
          else
            platformRows.set(id, {
              transcript: null,
              summary: null,
              recordingUrl: null,
              durationSec: 0,
              ...create,
            });
          return platformRows.get(id);
        },
      },
      voiceCall: {
        findUnique: async ({ where }) => voiceRows.get(where.providerCallId) || null,
        upsert: async ({ where, create, update }) => {
          const id = where.providerCallId;
          if (voiceRows.has(id)) Object.assign(voiceRows.get(id), update);
          else voiceRows.set(id, { id, transcript: null, summary: null, recordingUrl: null, ...create });
          return voiceRows.get(id);
        },
      },
      voiceCreditEntry: { findFirst: async () => null },
    },
  };
}

// A transcript WITH tool calls — the field the sales path used to throw away.
const WITH_TOOLS = [
  { role: "agent", content: "Thanks for calling FieldQuo." },
  { role: "tool_call_invocation", tool_call_id: "tc1", name: "transfer_call", arguments: "{}" },
  { role: "tool_call_result", tool_call_id: "tc1", content: '{"ok":false}', successful: false },
  { role: "user", content: "Nobody picked up." },
];

{
  const w = makeMeterWorld();
  const charged = [];
  const result = await reconcileVoiceCalls({
    db: w.prisma,
    configured: true,
    isSalesNumber: (e) => e === SALES,
    listCalls: async () => ({
      items: [
        { call_id: "sales1", direction: "inbound", from_number: "+15145550000", to_number: SALES, duration_ms: 61000 },
        { call_id: "tenant1", direction: "inbound", from_number: "+15145550001", to_number: TENANT, duration_ms: 30000 },
      ],
      has_more: false,
    }),
    getCall: async (id) =>
      id === "sales1"
        ? {
            call_id: "sales1",
            transcript_with_tool_calls: WITH_TOOLS,
            transcript_object: [{ role: "agent", content: "Thanks for calling FieldQuo." }],
            call_analysis: { call_summary: "Asked about pricing." },
            recording_url: "https://example.com/s.wav",
            disconnection_reason: "user_hangup",
          }
        : { call_id: id },
    chargeCall: async (args) => {
      charged.push(args);
      return { id: "e1" };
    },
    balanceFor: async () => 1000,
    syncNumberAttachment: async () => {},
    pushCallCeiling: async () => {},
    recordError: async () => {},
    now: T0.getTime(),
  });

  const row = w.platformRows.get("sales1");
  ok("a call on FieldQuo's own line is recognised rather than discarded", result.platformOwn === 1);
  ok("…and written to PlatformVoiceCall", result.platformReconciled === 1 && Boolean(row));
  ok(
    "…so it is NOT reported as money leaving for nobody",
    result.unknownNumber === 0,
    `unknownNumber ${result.unknownNumber}`,
  );
  ok("…its length is recovered", row?.durationSec === 61);
  ok("…and its summary and recording", row?.summary === "Asked about pricing." && Boolean(row?.recordingUrl));

  ok(
    "the TENANT path is untouched — its call is still billed",
    charged.length === 1 && charged[0].callId === "tenant1",
    JSON.stringify(charged.map((c) => c.callId)),
  );
  ok("…and no sales call is billed to anybody", !charged.some((c) => c.callId === "sales1"));

  // Bug 3: the transcript keeps its tool calls.
  const turns = transcriptTurns(row?.transcript);
  ok(
    "the recovered transcript keeps the tool calls the plain transcript drops",
    turns.some((t) => t.role === "tool" && t.tool === "transfer_call"),
    JSON.stringify(turns.map((t) => t.role)),
  );
  ok(
    "…including whether the tool succeeded, which is the whole diagnostic",
    turns.some((t) => t.role === "tool" && t.ok === false),
  );
}

{
  // Running it twice changes nothing, and never stomps what a webhook wrote.
  const w = makeMeterWorld();
  w.platformRows.set("sales1", {
    providerCallId: "sales1",
    transcript: [{ role: "agent", content: "the webhook's copy" }],
    summary: "the webhook's summary",
    recordingUrl: null,
    durationSec: 61,
  });
  await reconcileVoiceCalls({
    db: w.prisma,
    configured: true,
    isSalesNumber: (e) => e === SALES,
    listCalls: async () => ({
      items: [{ call_id: "sales1", direction: "inbound", to_number: SALES, duration_ms: 999000 }],
      has_more: false,
    }),
    getCall: async () => ({ call_id: "sales1", transcript_with_tool_calls: WITH_TOOLS }),
    chargeCall: async () => null,
    balanceFor: async () => 0,
    syncNumberAttachment: async () => {},
    pushCallCeiling: async () => {},
    recordError: async () => {},
    now: T0.getTime(),
  });
  const row = w.platformRows.get("sales1");
  ok(
    "a row the webhook already wrote keeps its transcript",
    row.transcript?.[0]?.content === "the webhook's copy",
  );
  ok("…and its summary", row.summary === "the webhook's summary");
  ok("…and its duration", row.durationSec === 61);
}

{
  // A tenant pressing "recover my missed calls" must not sweep FieldQuo's line.
  const w = makeMeterWorld();
  const result = await reconcileVoiceCalls({
    db: w.prisma,
    configured: true,
    onlyCompanyId: "co1",
    isSalesNumber: (e) => e === SALES,
    listCalls: async () => ({
      items: [{ call_id: "sales2", direction: "inbound", to_number: SALES, duration_ms: 1000 }],
      has_more: false,
    }),
    getCall: async () => ({ call_id: "sales2" }),
    chargeCall: async () => null,
    balanceFor: async () => 0,
    syncNumberAttachment: async () => {},
    pushCallCeiling: async () => {},
    recordError: async () => {},
    now: T0.getTime(),
  });
  ok(
    "a scoped tenant recovery counts FieldQuo's own line but writes nothing to it",
    result.platformOwn === 1 && result.platformReconciled === 0 && w.platformRows.size === 0,
  );
}

{
  // And the webhook writer keeps the tool calls too — the same mapping.
  const writes = [];
  const prisma = {
    platformVoiceCall: {
      upsert: async (args) => {
        writes.push(args);
        return {};
      },
    },
  };
  await recordSalesCall({
    type: "call_analyzed",
    prisma,
    call: { call_id: "c1", duration_ms: 61000, transcript_with_tool_calls: WITH_TOOLS },
  });
  const turns = transcriptTurns(writes.at(-1).update.transcript);
  ok(
    "the sales WEBHOOK stores the transcript with tool calls, not the plain one",
    turns.some((t) => t.role === "tool"),
  );

  // A later event with no duration must not blank the one already recorded.
  writes.length = 0;
  await recordSalesCall({ type: "call_analyzed", prisma, call: { call_id: "c1" } });
  ok(
    "an event carrying no duration leaves the recorded one alone rather than writing 0",
    writes.at(-1).update.durationSec === undefined,
    String(writes.at(-1).update.durationSec),
  );

  ok(
    "the field mapping is one function, and it is the one both paths call",
    salesCallFields({ transcript_with_tool_calls: WITH_TOOLS }).transcript === WITH_TOOLS,
  );
}

console.log("\n══ 5. The console does not call FieldQuo's own line a leak ═════════\n");

const providerLine = (e164) => ({ phone_number: e164, inbound_agents: [{ agent_id: "ag" }] });

{
  const audit = auditVoiceNumbers({
    providerNumbers: [providerLine(SALES), providerLine(TENANT), providerLine("+16135550999")],
    rows: [
      {
        id: "r1",
        e164: TENANT,
        companyId: "co1",
        status: "active",
        company: { name: "Big Painter Inc" },
        createdAt: new Date("2026-01-01"),
      },
    ],
    ourNumbers: [{ e164: SALES, label: "sales" }],
  });

  const sales = audit.lines.find((l) => l.e164 === SALES);
  ok("FieldQuo's own line is named as FieldQuo's own", sales?.fieldquoOwn === true && sales?.ownLabel === "sales");
  ok("…and is NOT reported as a leak", sales?.leak === false);
  ok("…with a reason that says so rather than 'no row of ours'", sales?.unheldReason === "fieldquo_own");
  ok(
    "…and the alarm count counts only the real one",
    audit.counts.leak === 1 && audit.counts.fieldquoOwn === 1,
    JSON.stringify(audit.counts),
  );
  ok(
    "a number nobody holds and nobody claims IS still a leak",
    audit.lines.find((l) => l.e164 === "+16135550999")?.leak === true,
  );
  ok(
    "the three groups still account for every number Retell has",
    audit.counts.held + audit.counts.fieldquoOwn + audit.counts.leak === audit.counts.atProvider,
  );
  ok("…and a company's own line is unaffected", audit.counts.held === 1);
}

{
  // The expensive collision must NOT be hidden by "that one's ours". A tenant
  // holding the configured sales number is a contractor's callers reaching
  // FieldQuo's agent, and it has to stay visible.
  const audit = auditVoiceNumbers({
    providerNumbers: [providerLine(SALES)],
    rows: [
      {
        id: "r1",
        e164: SALES,
        companyId: "co1",
        status: "active",
        company: { name: "Big Painter Inc" },
        createdAt: new Date("2026-01-01"),
      },
    ],
    ourNumbers: [{ e164: SALES, label: "sales" }],
  });
  ok(
    "a tenant row for our own number still reads as held by that tenant",
    audit.lines[0].holder?.companyName === "Big Painter Inc" && audit.lines[0].fieldquoOwn === false,
  );
}

{
  const audit = auditVoiceNumbers({
    providerNumbers: [providerLine(SALES)],
    rows: [],
  });
  ok(
    "told about no numbers of its own, the audit reports exactly what it used to",
    audit.counts.unheld === 1 && audit.counts.leak === 1 && audit.counts.fieldquoOwn === 0,
  );
  const junk = auditVoiceNumbers({
    providerNumbers: [providerLine(SALES)],
    rows: [],
    ourNumbers: [null, "x", {}, { e164: "" }],
  });
  ok("junk in ourNumbers audits to zeroes rather than throwing", junk.counts.fieldquoOwn === 0);
}

console.log("\n── the mechanism is where the console reads it ─────────────────────\n");

{
  const routeGet = fnSource(code(read("app/api/platform/voice-numbers/route.js")), "GET");
  ok("the console route asks for the audit", /auditVoiceNumbers\(/.test(routeGet));
  // The ARGUMENT, brace-matched, not the function body. Deleting `ourNumbers`
  // from the call while leaving the list built above it passed a body-wide
  // regex — a false pass caught by mutating this exact line, which is the
  // failure mode this project has shipped twice.
  const auditCall = (() => {
    const i = routeGet.indexOf("auditVoiceNumbers(");
    if (i === -1) return "";
    let depth = 0;
    for (let j = i; j < routeGet.length; j++) {
      if (routeGet[j] === "(") depth++;
      else if (routeGet[j] === ")") {
        depth--;
        if (depth === 0) return routeGet.slice(i, j + 1);
      }
    }
    return "";
  })();
  ok(
    "…and tells it which numbers are FieldQuo's own, or the audit cannot know",
    /\bourNumbers\b/.test(auditCall),
    auditCall.replace(/\s+/g, " ").slice(0, 90),
  );
  ok(
    "…built from the sales line and the shared test line, which is unheld for the same reason",
    /salesNumbers\(\)/.test(routeGet) && /sharedTestNumbers\(\)/.test(routeGet),
  );

  const page = fnSource(read("app/platform/voice-numbers/page.js"), "VoiceNumbersPage");
  ok("the page's alarm section reads `leak`, not `unheld`", /l\.leak/.test(page));
  ok("…and gives FieldQuo's own lines a section of their own", /fieldquoOwn/.test(page));
  ok("…and the alarm stat counts leaks", /counts\.leak/.test(page));

  const rowFn = fnSource(read("app/platform/voice-numbers/page.js"), "NumberRow");
  ok(
    "the red alarm styling is driven by `leak` — red on our own phone was the complaint",
    /const alarm = line\.leak/.test(rowFn),
  );
}

console.log("\n── the guards themselves, scoped to the function that holds them ───\n");

{
  const drain = fnSource(code(read("lib/voice/drainOutbound.js")), "drainOutboundQueue");
  ok("drainOutboundQueue was found and read", drain.length > 500);

  // A compare-and-set, not a read-then-write. The single line that stops two
  // drainers both dialling.
  ok(
    "the claim is an updateMany whose where names the state that was read",
    /updateMany\(\{[\s\S]*?where:[\s\S]*?status: "queued"[\s\S]*?data:/.test(drain),
  );
  ok(
    "…the stale reclaim compares the claim stamp too, so two reclaimers cannot both win",
    /status: "calling", lastTriedAt: task\.lastTriedAt/.test(drain),
  );
  ok("…and a claim that matched nothing refuses rather than carrying on", /claim\.count !== 1/.test(drain));
  ok(
    "the outcome write is guarded on the claim we still hold",
    /where: \{ id: task\.id, status: "calling", lastTriedAt: now \}/.test(drain),
  );
  ok(
    "a reclaim asks the provider BEFORE it dials",
    drain.indexOf("findPlaced(task") !== -1 &&
      drain.indexOf("findPlaced(task") < drain.indexOf("await place(task"),
  );
  // Every write, not "a write somewhere in the file". Each updateMany call's
  // own argument object is pulled out by brace matching and checked, so a
  // fourth one added without an id cannot hide behind the three that have one.
  const writes = [];
  for (let i = drain.indexOf("updateMany("); i !== -1; i = drain.indexOf("updateMany(", i + 1)) {
    let depth = 0;
    for (let j = i; j < drain.length; j++) {
      if (drain[j] === "(") depth++;
      else if (drain[j] === ")") {
        depth--;
        if (depth === 0) {
          writes.push(drain.slice(i, j + 1));
          break;
        }
      }
    }
  }
  ok(
    "…and every write keys off the id from this run's own read, never a caller's",
    writes.length >= 2 && writes.every((wr) => /id: task\.id/.test(wr)),
    `${writes.length} writes`,
  );

  const find = fnSource(code(read("lib/voice/outboundCall.js")), "findPlacedCallForTask");
  ok("findPlacedCallForTask was found and read", find.length > 200);
  ok("it matches on the task id we stamped into the provider's metadata", /metadata\?\.taskId === task\.id/.test(find));
  ok("…and asks for calls in every state, ongoing included", /statuses: null/.test(find));

  const placed = fnSource(code(read("lib/voice/outboundCall.js")), "placeQueuedCall");
  const afterDial = placed.slice(placed.indexOf("const providerCallId = created?.call_id"));
  ok(
    "nothing after the phone starts ringing may throw — a failed row must not become a second call",
    /try \{[\s\S]*voiceCall\.upsert[\s\S]*\} catch/.test(afterDial),
  );

  const recon = fnSource(code(read("lib/voice/reconcileCalls.js")), "reconcileVoiceCalls");
  ok(
    "the sales recognition runs where the tenant lookup already failed, not instead of it",
    recon.indexOf("byE164.get(e164)") < recon.indexOf("ourOwnNumber(e164)"),
  );
  ok(
    "…and before the unattributed-money alarm, so our own line never trips it",
    recon.indexOf("ourOwnNumber(e164)") < recon.indexOf("tally.unknownNumber++"),
  );

  const fields = fnSource(code(read("lib/platform/salesCall.js")), "salesCallFields");
  ok("salesCallFields was found and read", fields.length > 100);
  ok("the sales transcript goes through the shared reader", /transcriptFrom\(call\)/.test(fields));
  ok(
    "…and not through transcript_object, which silently drops every tool call",
    !/transcript_object/.test(fields),
  );

  const audit = fnSource(code(read("lib/voice/numberAudit.js")), "auditVoiceNumbers");
  ok("the leak judgement is separate from the unheld fact", /leak: !holder && !ownLabel/.test(audit));
  ok("…and a held number is never anybody's 'own'", /!holder \? ours\.get\(n\.e164\)/.test(audit));

  const cron = code(read("app/api/cron/voice-outbound/route.js"));
  ok(
    "the cron route keeps no second copy of the queue logic",
    !/voiceCallTask/.test(cron) && /drainOutboundQueue/.test(cron),
  );
}

console.log(`\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} checks\n`);
process.exit(failures ? 1 : 0);
