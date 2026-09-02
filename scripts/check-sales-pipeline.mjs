// scripts/check-sales-pipeline.mjs
//
// The sales pipeline task runner. Prove it cannot run a task twice, cannot
// wedge, cannot retry for ever, and cannot report work it did not do.
//
//   npm run check:sales-pipeline
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Every guarantee here is about a race or a ladder, and neither is visible by
// reading. "Two runners cannot both win" is a claim; two runners that actually
// run against a store enforcing the same compare-and-set semantics Postgres
// does is a measurement. Same for the retry ladder: nobody exercises the fifth
// attempt of a six-hour-old failure by hand, which is precisely why that is
// where a silent drop would live.
//
// No database and no network. lib/db is never touched — the runner takes its
// prisma through `deps`, so what runs below is the shipped runner against an
// in-memory store that reproduces the two semantics that carry the whole
// design: updateMany matching zero rows when the `where` no longer describes
// the row, and a unique index refusing a second idempotencyKey.
//
// Nine things it proves, each of which is a bug somebody could ship:
//
//   1. Two concurrent claims — exactly one wins, and the handler runs once.
//   2. A live claim is untouchable; a dead one is reclaimable; and a
//      straggler cannot settle a row that was reclaimed out from under it.
//   3. A reclaim hands the provider the SAME idempotency key.
//   4. Backoff grows, and is written into notBefore.
//   5. The attempt ceiling terminates instead of looping.
//   6. One failing task leaves its siblings alone.
//   7. An unregistered kind, and an unimplemented stage, end terminal WITH A
//      REASON — never a silent `done`.
//   8. Enqueue dedupes on idempotencyKey, including when it loses the race.
//   9. A provider ceiling defers a task without charging it an attempt.
//
// Plus positional source rules, each scoped to ONE function extracted by brace
// matching — a guard string sitting elsewhere in the same file has manufactured
// a false pass in this repo twice — and the cron's schedule, checked against
// every other entry in vercel.json rather than asserted in a comment.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TASK_KINDS, isKnownKind, resolveProvider } from "@/lib/sales/pipeline/kinds";
import {
  MAX_ATTEMPTS,
  STALE_CLAIM_MINUTES,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  backoffMs,
  claimDecision,
  failureOutcome,
  idempotencyKeyFor,
} from "@/lib/sales/pipeline/schedule";
import {
  registerHandler,
  getHandler,
  isPlaceholder,
  handlerStatus,
  NOT_IMPLEMENTED,
  __resetHandlerForTests,
} from "@/lib/sales/pipeline/registry";
import { makeProviderBudget, PROVIDER_LIMITS, limitsFor } from "@/lib/sales/pipeline/limits";
import { claimTask, runClaimedTask, drainSalesPipeline } from "@/lib/sales/pipeline/runner";
import { enqueuePipelineTask } from "@/lib/sales/pipeline/tasks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

const MINUTE = 60_000;
const T0 = new Date("2026-09-01T09:00:00.000Z");
const at = (mins) => new Date(T0.getTime() + mins * MINUTE);

/* ═══════════════════════════════════════════════════════════════════════════
   A store with the two semantics that matter
   ═══════════════════════════════════════════════════════════════════════════

   updateMany returns a COUNT, and matches on the whole `where` — which is what
   makes a compare-and-set a compare-and-set. Modelling it as "find by id, then
   write" would exercise the fast path and skip the only thing being asserted.

   create honours @@unique on idempotencyKey by throwing P2002, because that is
   the actual dedupe guarantee in tasks.js; its findUnique is only a fast path.

   Every method yields to the microtask queue first, so two drains started
   together genuinely interleave rather than running to completion in turn. */

const ms = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());
const tick = () => Promise.resolve();

function matches(row, where) {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!cond.some((c) => matches(row, c))) return false;
      continue;
    }
    const actual = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(actual)) return false;
      if ("lte" in cond && !(actual != null && ms(actual) <= ms(cond.lte))) return false;
      if ("lt" in cond && !(actual != null && ms(actual) < ms(cond.lt))) return false;
      if ("gt" in cond && !(actual != null && ms(actual) > ms(cond.gt))) return false;
      continue;
    }
    if (actual instanceof Date || cond instanceof Date) {
      if (actual == null || cond == null) { if ((actual ?? null) !== (cond ?? null)) return false; continue; }
      if (ms(actual) !== ms(cond)) return false;
      continue;
    }
    if ((actual ?? null) !== (cond ?? null)) return false;
  }
  return true;
}

function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !(v instanceof Date) && "increment" in v) {
      row[k] = (row[k] || 0) + v.increment;
    } else {
      row[k] = v;
    }
  }
}

function makeStore(seedRows = []) {
  let n = 0;
  const rows = [];
  const blowUpOn = new Set(); // task ids whose updateMany throws, to test isolation

  const base = (r) => ({
    id: r.id || `t${++n}`,
    kind: "CALCULATE_LEAD_SCORE",
    prospectId: null,
    campaignId: null,
    payload: null,
    status: "queued",
    notBefore: T0,
    attempts: 0,
    lastError: null,
    claimedAt: null,
    claimToken: null,
    claimExpires: null,
    idempotencyKey: null,
    createdAt: T0,
    completedAt: null,
    ...r,
  });

  for (const r of seedRows) rows.push(base(r));

  const salesPipelineTask = {
    async findMany({ where = {}, orderBy = [], take } = {}) {
      await tick();
      let out = rows.filter((r) => matches(r, where));
      const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
      out = out.slice().sort((a, b) => {
        for (const k of keys) {
          const [field] = Object.keys(k);
          const d = ms(a[field]) - ms(b[field]);
          if (d) return d;
        }
        return 0;
      });
      return (take ? out.slice(0, take) : out).map((r) => ({ ...r }));
    },
    async findUnique({ where }) {
      await tick();
      const found = rows.find((r) => matches(r, where));
      return found ? { ...found } : null;
    },
    async updateMany({ where, data }) {
      await tick();
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) {
        if (blowUpOn.has(r.id)) throw new Error(`store exploded on ${r.id}`);
        applyData(r, data);
      }
      return { count: hit.length };
    },
    async create({ data }) {
      await tick();
      if (data.idempotencyKey && rows.some((r) => r.idempotencyKey === data.idempotencyKey)) {
        const err = new Error("Unique constraint failed on the fields: (`idempotencyKey`)");
        err.code = "P2002";
        throw err;
      }
      const row = base(data);
      rows.push(row);
      return { ...row };
    },
  };

  return {
    db: { salesPipelineTask },
    rows,
    row: (id) => rows.find((r) => r.id === id),
    explodeOn: (id) => blowUpOn.add(id),
  };
}

/** Install a handler for a kind, replacing whatever is registered. */
function useHandler(kind, fn) {
  __resetHandlerForTests(kind);
  registerHandler(kind, fn);
}

const swallow = async () => {};
const drain = (store, extra = {}) =>
  drainSalesPipeline({
    now: extra.now || T0,
    limit: extra.limit ?? 50,
    deps: { db: store.db, recordError: extra.recordError || swallow, ...(extra.deps || {}) },
    ...(extra.budget ? { deps: { db: store.db, recordError: swallow, budget: extra.budget, ...(extra.deps || {}) } } : {}),
  });

/* ══════════════════════════════════════════════════════════════════════════ */
section("1. Two concurrent claims — exactly one wins");

{
  // The race as it actually happens: two runners whose findMany returned the
  // same snapshot, both now trying to claim it.
  const store = makeStore([{ id: "race1" }]);
  const snapshot = { ...store.row("race1") };

  const a = await claimTask({ task: snapshot, now: T0, token: "tok-a", deps: { db: store.db } });
  const b = await claimTask({ task: snapshot, now: T0, token: "tok-b", deps: { db: store.db } });

  ok("first claim wins", a !== null && a.claimToken === "tok-a");
  ok("second claim on the same snapshot gets nothing", b === null, b ? `got ${b.claimToken}` : "");
  ok("attempts charged exactly once", store.row("race1").attempts === 1, store.row("race1").attempts);
  ok("row holds the winner's token", store.row("race1").claimToken === "tok-a", store.row("race1").claimToken);
}

{
  // And end to end: two drains started together, one task, one handler call.
  const store = makeStore([{ id: "race2" }]);
  let calls = 0;
  useHandler("CALCULATE_LEAD_SCORE", async () => { calls++; return { done: true }; });

  const [r1, r2] = await Promise.all([drain(store), drain(store)]);

  ok("handler ran exactly once across two concurrent drains", calls === 1, calls);
  ok("exactly one drain reports it done", r1.done + r2.done === 1, `${r1.done}+${r2.done}`);
  ok("the loser says so rather than silently passing",
    (r1.skipped.claimed_by_another_run || 0) + (r2.skipped.claimed_by_another_run || 0) === 1);
  ok("row ends done", store.row("race2").status === "done", store.row("race2").status);
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("2. A live claim is untouchable; a dead one is reclaimable");

{
  const store = makeStore([{
    id: "held",
    status: "claimed",
    attempts: 1,
    claimedAt: T0,
    claimToken: "someone-else",
    claimExpires: at(STALE_CLAIM_MINUTES),
  }]);
  let calls = 0;
  useHandler("CALCULATE_LEAD_SCORE", async () => { calls++; return { done: true }; });

  const before = await drain(store, { now: at(STALE_CLAIM_MINUTES - 1) });
  ok("a claim that has not expired is not even a candidate", before.considered === 0, before.considered);
  ok("nobody ran the handler", calls === 0, calls);
  ok("the claim is untouched", store.row("held").claimToken === "someone-else");

  const after = await drain(store, { now: at(STALE_CLAIM_MINUTES + 1) });
  ok("past claimExpires it becomes a candidate", after.considered === 1, after.considered);
  ok("and it is reclaimed and run", calls === 1 && after.done === 1, `${calls}/${after.done}`);
  ok("attempts incremented by the reclaim", store.row("held").attempts === 2, store.row("held").attempts);

  // The mirror image, and the one a claim guard alone does not cover: a slow
  // run whose claim went stale WHILE it was working. Somebody else has legally
  // reclaimed the row and may be mid-provider-call; the straggler must not
  // stamp `done` over a claim that is currently live.
  const store2 = makeStore([{
    id: "straggler",
    status: "claimed",
    attempts: 2,
    claimedAt: at(20),
    claimToken: "runner-B",
    claimExpires: at(20 + STALE_CLAIM_MINUTES),
    idempotencyKey: "sales_pipeline:CALCULATE_LEAD_SCORE:straggler",
  }]);
  useHandler("CALCULATE_LEAD_SCORE", async () => ({ done: true }));

  const staleSnapshot = { ...store2.row("straggler"), claimToken: "runner-A", attempts: 1 };
  await runClaimedTask({ task: staleSnapshot, now: at(21), token: "runner-A", deps: { db: store2.db } });
  ok("a straggler cannot settle a row that was reclaimed", store2.row("straggler").status === "claimed",
    store2.row("straggler").status);
  ok("the live claim survives it", store2.row("straggler").claimToken === "runner-B",
    store2.row("straggler").claimToken);

  // And the same for the failure path — a straggler's error must not release
  // a claim somebody else is holding.
  useHandler("CALCULATE_LEAD_SCORE", async () => { throw new Error("slow and doomed"); });
  await runClaimedTask({ task: staleSnapshot, now: at(21), token: "runner-A", deps: { db: store2.db } });
  ok("nor can a straggler's failure release it", store2.row("straggler").claimToken === "runner-B"
    && store2.row("straggler").lastError === null, store2.row("straggler").lastError);

  // A claimed row with no claimExpires is a bug elsewhere, not an invitation.
  const d = claimDecision({
    task: { status: "claimed", claimExpires: null, attempts: 0, notBefore: T0 },
    now: at(600),
  });
  ok("a claimed row with a null claimExpires is left alone", d.act === "skip" && d.reason === "claim_live", d.reason);
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("3. A reclaim hands the provider the SAME idempotency key");

{
  const store = makeStore([{ id: "reclaim1" }]);
  const seen = [];
  useHandler("CALCULATE_LEAD_SCORE", async ({ idempotencyKey }) => {
    seen.push(idempotencyKey);
    return { done: true };
  });

  // A dead invocation: it claimed, and then the lambda died. Nothing settled.
  const dead = await claimTask({ task: { ...store.row("reclaim1") }, now: T0, token: "dead", deps: { db: store.db } });
  ok("the dead run got a key", typeof dead.idempotencyKey === "string" && dead.idempotencyKey.length > 0, dead.idempotencyKey);

  // The reclaim, after the claim goes stale.
  await drain(store, { now: at(STALE_CLAIM_MINUTES + 1) });
  ok("the reclaim ran the handler", seen.length === 1, seen.length);
  ok("with the key the dead run would have used", seen[0] === dead.idempotencyKey, `${seen[0]} vs ${dead.idempotencyKey}`);
  ok("and the row still holds that one key", store.row("reclaim1").idempotencyKey === dead.idempotencyKey);
}

{
  // An explicit key from enqueue is never overwritten by the runner.
  const store = makeStore([{ id: "reclaim2", idempotencyKey: "crawl:p1:example.com" }]);
  const seen = [];
  useHandler("CALCULATE_LEAD_SCORE", async ({ idempotencyKey }) => { seen.push(idempotencyKey); return { done: true }; });
  await drain(store);
  ok("an enqueue-supplied key reaches the handler unchanged", seen[0] === "crawl:p1:example.com", seen[0]);
  ok("and is still on the row afterwards", store.row("reclaim2").idempotencyKey === "crawl:p1:example.com");
}

{
  // The derivation itself: same row in, same key out, every time. A minted
  // token would not have this property, which is the whole argument.
  const task = { id: "abc", kind: "CRAWL_WEBSITE", idempotencyKey: null };
  const first = idempotencyKeyFor(task);
  ok("derived key is stable across calls", first === idempotencyKeyFor(task), first);
  ok("derived key is unique per row", idempotencyKeyFor({ ...task, id: "abd" }) !== first);
  ok("an explicit key always wins", idempotencyKeyFor({ ...task, idempotencyKey: "k" }) === "k");
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("4. Backoff grows, and is written into notBefore");

{
  const ladder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => backoffMs(n));
  let growing = true;
  for (let i = 1; i < ladder.length; i++) {
    if (ladder[i] < ladder[i - 1]) growing = false;
  }
  ok("never decreases", growing, ladder.map((v) => v / 1000).join("s,") + "s");
  ok("first retry is the base delay", ladder[0] === BACKOFF_BASE_MS, ladder[0]);
  ok("strictly grows while below the cap", ladder[1] > ladder[0] && ladder[2] > ladder[1], `${ladder[0]}<${ladder[1]}<${ladder[2]}`);
  ok("caps rather than running away", ladder[ladder.length - 1] === BACKOFF_MAX_MS, ladder[ladder.length - 1]);
  ok("an absurd attempt count cannot overflow to Infinity", Number.isFinite(backoffMs(1e9)), backoffMs(1e9));

  const store = makeStore([{ id: "back1" }]);
  useHandler("CALCULATE_LEAD_SCORE", async () => { throw new Error("socket hang up"); });

  await drain(store, { now: T0 });
  const firstWait = ms(store.row("back1").notBefore) - T0.getTime();
  ok("a throw puts it back on the queue", store.row("back1").status === "queued", store.row("back1").status);
  ok("with the error kept", /socket hang up/.test(store.row("back1").lastError || ""), store.row("back1").lastError);
  ok("and a backoff written into notBefore", firstWait === backoffMs(1), firstWait);

  // Still inside the backoff: not a candidate.
  const early = await drain(store, { now: new Date(T0.getTime() + firstWait - 1) });
  ok("it is not picked up before notBefore", early.considered === 0, early.considered);

  await drain(store, { now: new Date(T0.getTime() + firstWait) });
  const secondWait = ms(store.row("back1").notBefore) - (T0.getTime() + firstWait);
  ok("the second wait is longer than the first", secondWait > firstWait, `${firstWait} -> ${secondWait}`);
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("5. The attempt ceiling terminates instead of looping");

{
  const store = makeStore([{ id: "ceil1" }]);
  let calls = 0;
  useHandler("CALCULATE_LEAD_SCORE", async () => { calls++; throw new Error("always down"); });

  // Drive the clock forward past each backoff, far more times than the ceiling
  // allows, so a runner that looped would show it.
  let now = T0;
  for (let i = 0; i < MAX_ATTEMPTS + 6; i++) {
    await drain(store, { now });
    now = new Date(ms(store.row("ceil1").notBefore) + 1000);
  }

  const final = store.row("ceil1");
  ok(`handler ran exactly ${MAX_ATTEMPTS} times, never more`, calls === MAX_ATTEMPTS, calls);
  ok("row ends in a terminal state", final.status === "failed", final.status);
  ok("saying it gave up, and why", /gave up after \d+ attempts: threw: always down/.test(final.lastError || ""), final.lastError);
  ok("completedAt set, so it is not merely unfinished", final.completedAt !== null);
  ok("claim released", final.claimToken === null && final.claimExpires === null);

  const after = await drain(store, { now: at(10_000) });
  ok("a terminated task is never a candidate again", after.considered === 0, after.considered);
}

{
  // The other route to the ceiling: attempts burned by crashes, so the failure
  // path never ran. Without the retire branch this row sits queued for ever.
  const store = makeStore([{ id: "ceil2", attempts: MAX_ATTEMPTS, status: "queued" }]);
  let calls = 0;
  useHandler("CALCULATE_LEAD_SCORE", async () => { calls++; return { done: true }; });

  const r = await drain(store, { now: T0 });
  ok("an at-ceiling queued row is retired, not run", calls === 0 && r.retired === 1, `${calls}/${r.retired}`);
  ok("into a terminal state with a reason", store.row("ceil2").status === "failed"
    && /gave up after/.test(store.row("ceil2").lastError || ""), store.row("ceil2").lastError);
  ok("failureOutcome agrees at the boundary",
    failureOutcome({ attempts: MAX_ATTEMPTS }).status === "failed"
    && failureOutcome({ attempts: MAX_ATTEMPTS - 1 }).status === "queued");
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("6. One failing task leaves its siblings alone");

{
  const store = makeStore([
    { id: "sibA", payload: { n: 1 } },
    { id: "sibB", payload: { n: 2 } },
    { id: "sibC", payload: { n: 3 } },
  ]);
  const ran = [];
  useHandler("CALCULATE_LEAD_SCORE", async ({ task }) => {
    ran.push(task.id);
    if (task.id === "sibB") throw new Error("ECONNREFUSED example.com");
    return { done: true };
  });

  const r = await drain(store, { now: T0 });
  ok("every sibling was attempted", ran.length === 3, ran.join(","));
  ok("the two healthy ones finished", store.row("sibA").status === "done" && store.row("sibC").status === "done");
  ok("the broken one is queued for a retry", store.row("sibB").status === "queued", store.row("sibB").status);
  ok("siblings carry no error", store.row("sibA").lastError === null && store.row("sibC").lastError === null);
  ok("counts add up", r.done === 2 && r.retried === 1, JSON.stringify({ done: r.done, retried: r.retried }));
}

{
  // A failure in the RUNNER itself — the store throwing on one row's settle —
  // must not abandon the rows after it. This is the case a try/catch around
  // the loop instead of inside it would get wrong.
  const store = makeStore([{ id: "boomA" }, { id: "boomB" }, { id: "boomC" }]);
  store.explodeOn("boomB");
  const errors = [];
  useHandler("CALCULATE_LEAD_SCORE", async () => ({ done: true }));

  const r = await drain(store, { now: T0, recordError: async (e) => { errors.push(e); } });
  ok("rows either side of the explosion still completed",
    store.row("boomA").status === "done" && store.row("boomC").status === "done",
    `${store.row("boomA").status}/${store.row("boomC").status}`);
  ok("the failure is counted", (r.skipped.runner_error || 0) === 1, JSON.stringify(r.skipped));
  ok("and reported, not swallowed", errors.length === 1 && errors[0].area === "sales-pipeline", errors.length);

  // A non-Error throw must not break the failure path either.
  const store2 = makeStore([{ id: "odd1" }]);
  useHandler("CALCULATE_LEAD_SCORE", async () => { throw "a string, not an Error"; });
  await drain(store2, { now: T0 });
  ok("a non-Error throw still settles the row", store2.row("odd1").status === "queued", store2.row("odd1").status);
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("7. Unknown and unbuilt stages are terminal WITH A REASON");

{
  // A kind no handler is registered for at all.
  const store = makeStore([{ id: "unk1", kind: "SOMETHING_NOBODY_BUILT" }]);
  const r = await drain(store, { now: T0 });
  const row = store.row("unk1");
  ok("never reported as done", row.status !== "done", row.status);
  ok("terminal, deliberately", row.status === "abandoned", row.status);
  ok("and the reason names the kind", /no handler registered for kind "SOMETHING_NOBODY_BUILT"/.test(row.lastError || ""), row.lastError);
  ok("counted as abandoned rather than done", r.abandoned === 1 && r.done === 0, JSON.stringify({ a: r.abandoned, d: r.done }));
  ok("it does not come back on the next tick", (await drain(store, { now: at(10_000) })).considered === 0);
}

{
  // A real kind whose handler is still the shipped placeholder.
  __resetHandlerForTests("GENERATE_RESEARCH_BRIEF");
  ok("the shipped registry knows the kind", getHandler("GENERATE_RESEARCH_BRIEF") !== null);
  ok("and admits it is a placeholder", isPlaceholder("GENERATE_RESEARCH_BRIEF"));

  const store = makeStore([{ id: "ni1", kind: "GENERATE_RESEARCH_BRIEF" }]);
  const r = await drain(store, { now: T0 });
  const row = store.row("ni1");
  ok("an unimplemented stage is NOT done", row.status !== "done", row.status);
  ok("it is abandoned, not retried five times", row.status === "abandoned", row.status);
  ok("the row says 'not implemented'", (row.lastError || "").startsWith(NOT_IMPLEMENTED), row.lastError);
  ok("and names where the handler must go", /lib\/sales\/pipeline\/handlers/.test(row.lastError || ""));
  ok("the drain reports it too", (r.skipped[`not_implemented:GENERATE_RESEARCH_BRIEF`] || 0) === 1, JSON.stringify(r.skipped));

  const status = handlerStatus();
  ok("handlerStatus covers every kind", status.length === TASK_KINDS.length, status.length);
  ok("and reports this one as not implemented",
    status.find((s) => s.kind === "GENERATE_RESEARCH_BRIEF")?.implemented === false);
}

{
  // A handler that returns an unrecognised shape is not a success either, and
  // is not read as a request for five more attempts.
  const store = makeStore([{ id: "shrug" }]);
  useHandler("CALCULATE_LEAD_SCORE", async () => ({ maybe: "sure" }));
  await drain(store, { now: T0 });
  ok("an unrecognised result is terminal, not done", store.row("shrug").status === "abandoned", store.row("shrug").status);
  ok("with a reason", (store.row("shrug").lastError || "").length > 0, store.row("shrug").lastError);

  // …but an explicit retry:true IS honoured.
  const store2 = makeStore([{ id: "again" }]);
  useHandler("CALCULATE_LEAD_SCORE", async () => ({ done: false, retry: true, reason: "429 from vendor" }));
  await drain(store2, { now: T0 });
  ok("an explicit retry goes back on the queue", store2.row("again").status === "queued", store2.row("again").status);
  ok("with a backoff", ms(store2.row("again").notBefore) === T0.getTime() + backoffMs(1));
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("8. Enqueue dedupes on idempotencyKey");

{
  const store = makeStore([]);
  const spec = { kind: "CRAWL_WEBSITE", prospectId: "p1", idempotencyKey: "crawl:p1:acme.com" };

  const a = await enqueuePipelineTask(spec, { deps: { db: store.db } });
  const b = await enqueuePipelineTask(spec, { deps: { db: store.db } });
  ok("the second enqueue returns the first row", a.id === b.id, `${a.id}/${b.id}`);
  ok("only one row exists", store.rows.length === 1, store.rows.length);

  // The race the findUnique fast path cannot catch: both callers looked, both
  // saw nothing, both insert. The unique index is what actually holds.
  const store2 = makeStore([]);
  const original = store2.db.salesPipelineTask.findUnique;
  let firstLook = true;
  store2.db.salesPipelineTask.findUnique = async (args) => {
    if (firstLook) { firstLook = false; return null; }
    return original(args);
  };
  await store2.db.salesPipelineTask.create({ data: { kind: "CRAWL_WEBSITE", idempotencyKey: "k1" } });
  const raced = await enqueuePipelineTask(
    { kind: "CRAWL_WEBSITE", idempotencyKey: "k1" },
    { deps: { db: store2.db } },
  );
  ok("a lost insert race returns the winner rather than throwing", raced?.idempotencyKey === "k1", JSON.stringify(raced));
  ok("and still leaves one row", store2.rows.length === 1, store2.rows.length);

  const store3 = makeStore([]);
  const refused = await enqueuePipelineTask({ kind: "NOT_A_STAGE" }, { deps: { db: store3.db } });
  ok("an unknown kind is refused at enqueue", refused === null && store3.rows.length === 0);
  ok("isKnownKind agrees", !isKnownKind("NOT_A_STAGE") && isKnownKind("CRAWL_WEBSITE"));

  // No key means no dedupe — two genuinely separate units of work.
  const store4 = makeStore([]);
  await enqueuePipelineTask({ kind: "CRAWL_WEBSITE" }, { deps: { db: store4.db } });
  await enqueuePipelineTask({ kind: "CRAWL_WEBSITE" }, { deps: { db: store4.db } });
  ok("without a key, two enqueues are two tasks", store4.rows.length === 2, store4.rows.length);
}

/* ══════════════════════════════════════════════════════════════════════════ */
section("9. A provider ceiling defers without charging an attempt");

{
  const cap = limitsFor("http_crawl").maxPerRun;
  const seed = [];
  for (let i = 0; i < cap + 5; i++) seed.push({ id: `c${i}`, kind: "CRAWL_WEBSITE" });
  const store = makeStore(seed);
  useHandler("CRAWL_WEBSITE", async () => ({ done: true }));

  const r = await drain(store, { now: T0, limit: cap + 5 });
  ok(`exactly ${cap} crawls ran this tick`, r.done === cap, r.done);
  ok("the rest were deferred, by name", (r.skipped["rate_limited:http_crawl"] || 0) === 5, JSON.stringify(r.skipped));

  const deferred = store.row(`c${cap + 4}`);
  ok("a deferred task was not claimed", deferred.status === "queued" && deferred.claimToken === null, deferred.status);
  ok("was not charged an attempt", deferred.attempts === 0, deferred.attempts);
  ok("and was not given a backoff", ms(deferred.notBefore) === T0.getTime());

  const next = await drain(store, { now: at(10), limit: cap + 5 });
  ok("the next tick picks them up unchanged", next.done === 5, next.done);
}

{
  // The pacing seam: minGapMs is expressed per provider and the runner awaits
  // it. Injected here rather than shipped as a live delay, because a real gap
  // belongs to a vendor quota nobody has measured yet.
  const store = makeStore([{ id: "g1" }, { id: "g2" }, { id: "g3" }]);
  useHandler("CALCULATE_LEAD_SCORE", async () => ({ done: true }));
  const slept = [];
  const budget = makeProviderBudget({ limits: { local: { maxPerRun: 10, minGapMs: 250 } } });
  await drainSalesPipeline({
    now: T0,
    limit: 10,
    deps: { db: store.db, recordError: swallow, budget, sleep: async (n) => { slept.push(n); } },
  });
  ok("no pause before the first request", slept.length === 2, JSON.stringify(slept));
  ok("the declared gap is honoured between them", slept.every((n) => n === 250), JSON.stringify(slept));
  ok("every stage maps to a declared provider",
    TASK_KINDS.every((k) => PROVIDER_LIMITS[resolveProvider({ kind: k })] !== undefined),
    TASK_KINDS.map((k) => resolveProvider({ kind: k })).join(","));
  ok("a payload can name its own vendor", resolveProvider({ kind: "DISCOVER_BUSINESSES", payload: { provider: "yelp" } }) === "yelp");
  ok("an undeclared provider gets a restrictive ceiling, not an unlimited one",
    Number.isFinite(limitsFor("something_new").maxPerRun) && limitsFor("something_new").maxPerRun <= 5,
    limitsFor("something_new").maxPerRun);
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. Source rules — each scoped to ONE function, by brace matching
   ═══════════════════════════════════════════════════════════════════════════

   A guard string that appears anywhere in the same FILE has manufactured a
   false pass in this repo twice. So each rule below runs against the body of
   exactly one named function, cut out by counting braces with strings and
   comments masked first, and every extraction is itself asserted to have
   worked — a null slice must fail loudly rather than vacuously pass. */
section("10. Positional source rules, scoped to one function each");

/** Blank out comments and string/template bodies, preserving offsets, so that
 *  brace counting and keyword matching cannot be fooled by either. */
function mask(src) {
  const out = src.split("");
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") { out[i] = " "; i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      out[i] = " "; out[i + 1] = " "; i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] !== "\n") out[i] = " "; i++; }
      if (i < n) { out[i] = " "; out[i + 1] = " "; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === "\\") { out[i] = " "; out[i + 1] = " "; i += 2; continue; }
        if (src[i] === quote) break;
        if (src[i] !== "\n") out[i] = " ";
        i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** One function's source, start of signature to its matching closing brace.
 *
 *  The parameter list is skipped by counting PARENTHESES first. Jumping
 *  straight to the next "{" lands on a destructured parameter — every function
 *  worth checking here takes one — and the brace count then closes on the
 *  signature instead of the body, which passes vacuously. Found by mutation
 *  testing this very file. */
function fnBody(src, name) {
  const masked = mask(src);
  const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = masked.match(re);
  if (!m) return null;
  let paren = 0;
  let i = m.index + m[0].length - 1; // on the "("
  for (; i < masked.length; i++) {
    if (masked[i] === "(") paren++;
    else if (masked[i] === ")") { paren--; if (paren === 0) break; }
  }
  if (paren !== 0) return null;
  const open = masked.indexOf("{", i);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

// The extractor has to be trustworthy before anything is asserted with it.
{
  const sample = `function outer({ a, deps = {} } = {}) { const s = "} not a brace"; /* } */ if (a) { return 1; } return "MARKER"; }\nfunction after() { return "GUARD"; }`;
  const body = fnBody(sample, "outer");
  ok("brace matcher ignores braces in strings and comments",
    body !== null && body.endsWith(`return "MARKER"; }`) && !body.includes("GUARD"), body);
  ok("brace matcher does not stop at a destructured parameter",
    body !== null && body.includes("MARKER"), body);
  ok("brace matcher returns null for a name that is not there", fnBody(sample, "nope") === null);
}

{
  const src = read("lib/sales/pipeline/runner.js");
  const body = fnBody(src, "claimTask");
  ok("claimTask extracted", body !== null);
  if (body) {
    const code = mask(body);
    ok("claimTask claims with updateMany", /updateMany\s*\(/.test(code));
    ok("claimTask never reads-then-writes by id", !/\bupdate\s*\(\s*\{/.test(code) && !/findFirst|findUnique/.test(code));
    ok("its where names the status it read", /status:\s*task\.status/.test(code));
    ok("its where names the claim token it read", /claimToken:\s*task\.claimToken/.test(code));
    ok("its where re-checks notBefore at write time", /notBefore:\s*\{\s*lte/.test(code));
    ok("it refuses to steal a live claim", /claimExpires:\s*\{\s*lt/.test(code));
    ok("a count other than one is not a claim", /count\s*!==\s*1/.test(code));
    ok("the attempt is charged by the claim", /attempts:\s*\{\s*increment/.test(code));
    ok("the idempotency key is derived, not minted", /idempotencyKeyFor\(/.test(code) && !/randomUUID\(\)\s*;?\s*$/m.test(code.replace(/token\s*\|\|\s*randomUUID\(\)/, "")));
    ok("the claim gets its own expiry", /claimExpires:\s*new Date/.test(code));
  }
}

{
  const src = read("lib/sales/pipeline/runner.js");
  const body = fnBody(src, "drainSalesPipeline");
  ok("drainSalesPipeline extracted", body !== null);
  if (body) {
    const code = mask(body);
    ok("the batch is state-driven, not a cursor", /findMany\s*\(/.test(code) && /status:\s*"?queued/.test(body) && !/cursor/.test(code));
    ok("dead claims are part of the candidate query", /claimExpires:\s*\{\s*lt:\s*now/.test(code));
    ok("the loop body is inside a try", /for\s*\(const [\s\S]{0,120}?\{\s*[\s\S]{0,400}?try\s*\{/.test(code));
    ok("and the catch does not rethrow", !/catch\s*\([^)]*\)\s*\{[^}]*\bthrow\b/.test(code));
    ok("budget is taken before the claim",
      code.indexOf("budget.take") !== -1 && code.indexOf("budget.take") < code.indexOf("claimTask("),
      `${code.indexOf("budget.take")} < ${code.indexOf("claimTask(")}`);
    ok("a lost claim is skipped, not run", /if\s*\(!claimed\)/.test(code));
  }
}

{
  const src = read("app/api/cron/sales-pipeline/route.js");
  const body = fnBody(src, "GET");
  ok("the cron GET extracted", body !== null);
  if (body) {
    const code = mask(body);
    const guard = code.indexOf("requireCronSecret(");
    const work = code.indexOf("drainSalesPipeline(");
    ok("requireCronSecret is called inside GET", guard !== -1);
    ok("its 401 is returned, not ignored", /if\s*\(denied\)\s*return denied/.test(code));
    ok("it runs before any work", guard !== -1 && work !== -1 && guard < work, `${guard} < ${work}`);
  }
}

{
  const vercel = JSON.parse(read("vercel.json"));
  const entry = (vercel.crons || []).find((c) => c.path === "/api/cron/sales-pipeline");
  ok("the cron is registered in vercel.json", !!entry, entry ? entry.schedule : "missing");
  if (entry) {
    const minutes = new Set();
    const [minuteField] = entry.schedule.split(" ");
    const stepped = /^(\d+)-59\/(\d+)$/.exec(minuteField);
    ok("the schedule is a stepped minute field", !!stepped, minuteField);
    if (stepped) {
      for (let m = Number(stepped[1]); m < 60; m += Number(stepped[2])) minutes.add(m);
    }
    // The offset is the point: minutes nothing else in vercel.json fires on.
    const others = new Set();
    for (const c of vercel.crons) {
      if (c.path === "/api/cron/sales-pipeline") continue;
      const f = c.schedule.split(" ")[0];
      const step = /^\*\/(\d+)$/.exec(f);
      if (step) { for (let m = 0; m < 60; m += Number(step[1])) others.add(m); }
      else if (/^\d+$/.test(f)) others.add(Number(f));
    }
    const clash = [...minutes].filter((m) => others.has(m));
    ok("it shares no minute with the other crons", clash.length === 0, clash.join(","));
    ok("six ticks an hour", minutes.size === 6, minutes.size);
  }
}

{
  // The runner must actually load the handler registry module, or a stage that
  // somebody implements would silently keep reporting "not implemented".
  const src = mask(read("lib/sales/pipeline/runner.js"));
  ok("the runner imports the handler barrel for its side effects", /import\s+"\.\/handlers"/.test(read("lib/sales/pipeline/runner.js")), "");
  ok("and imports the registry", /from\s+"\.\/registry"/.test(read("lib/sales/pipeline/runner.js")));
  ok("mask left the import statements intact", src.includes("import"));
}

console.log(
  failures
    ? `\n✗ sales pipeline: ${failures} of ${checks} checks failed\n`
    : `\n✓ sales pipeline: ${checks} checks passed\n`,
);
process.exit(failures ? 1 : 0);
