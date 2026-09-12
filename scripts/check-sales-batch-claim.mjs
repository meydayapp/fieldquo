#!/usr/bin/env node
//
// scripts/check-sales-batch-claim.mjs
//
//   npm run check:sales-batch-claim
//
// "Claim the next 25", and "Release the rest" — executed, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. The selection order: callable soonest first — open now (shuts soonest
//      first), then opening later (earliest first) — and inside each window
//      researched rows before unresearched, the pool's own order inside
//      each, rows this rep released in the last seven days last of all.
//   2. The window rule: a row whose calling window does not open before the
//      rep's SHIFT ends (SHIFT_HOURS from their first Available today, read
//      from the ledger; the claim instant when there is none) is NOT
//      claimed; one that opens later in the shift is.
//   3. The caps: one press takes at most QUEUE_BATCH_MAX; the day takes at
//      most QUEUE_DAILY_CLAIM_CAP, counted from a fixture claim log and not
//      from what the rep currently holds.
//   4. Atomicity: with a scripted db in which another rep takes some of the
//      chosen rows between the read and the write, the winners counted are
//      exactly the rows the write matched — never the rows that were asked
//      for — and the claim log records only winners, in dial order.
//   5. Release: untouched rows go back; a row with a call attempt since the
//      claim is kept; a worked row is out of scope; the log says why.
//   6. The sticky fix, source-asserted: the dial section on the queue is in
//      normal flow, and the header says why.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed.
// Sources are decommented before a regex touches them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BATCH_REASON_KEYS,
  QUEUE_TOP_UP_BELOW,
  QUEUE_TOP_UP_MIN_INTERVAL_MS,
  releaseClosedUntouched,
  CANDIDATE_SCAN,
  DEPRIORITISING_RELEASES,
  QUEUE_BATCH_MAX,
  QUEUE_DAILY_CLAIM_CAP,
  RELEASE_DEPRIORITISE_DAYS,
  RELEASE_REASONS,
  SHIFT_HOURS,
  callableBeforeDayEnd,
  claimBatch,
  endOfLocalDay,
  isResearched,
  localDateIn,
  nextClosing,
  partitionForRelease,
  releaseDayEnded,
  releaseUntouched,
  selectBatch,
  shiftEndFrom,
  shiftStartFor,
  startOfLocalDay,
  untouchedSinceClaim,
  usableTimeZone,
  windowSortKey,
} from "@/lib/sales/queueBatch";
import { CALL_ALLOWED, CALL_REFUSED, salesCallReadiness } from "@/lib/sales/callingRules";
import { REP_QUEUE_WRITES } from "@/lib/sales/queueGate";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// A scripted db. Enough Prisma to run claimBatch / releaseUntouched /
// releaseDayEnded against fixtures, with hooks to interfere between a read
// and a write.
// ═══════════════════════════════════════════════════════════════════════════

const DAY = 24 * 60 * 60 * 1000;

function matches(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      if (!cond.every((w) => matches(row, w))) return false;
      continue;
    }
    if (key === "OR") {
      if (!cond.some((w) => matches(row, w))) return false;
      continue;
    }
    if (key === "capabilities" || key === "opportunities") {
      const n = row._count?.[key] ?? 0;
      if ("some" in cond && !(n > 0)) return false;
      if ("none" in cond && n > 0) return false;
      continue;
    }
    if (key === "callAttempts" || key === "queueClaims") continue; // relation reads handled by select
    const v = row[key];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (typeof cond !== "object" || cond instanceof Date) {
      if (v !== cond) return false;
      continue;
    }
    if ("in" in cond && !cond.in.includes(v)) return false;
    // Postgres semantics, on purpose: NOT IN over a NULL is NULL, i.e. false.
    // lib/sales/leadLanguage.js's fragment says `province IS NULL OR NOT IN`
    // because of exactly this, and a matcher that waved NULL through would
    // hide the bug the fragment exists to avoid.
    if ("notIn" in cond && (v == null || cond.notIn.includes(v))) return false;
    if ("not" in cond) {
      if (cond.not === null && (v === null || v === undefined)) return false;
      if (cond.not !== null && v === cond.not) return false;
    }
    if ("lt" in cond && !(v instanceof Date && v.getTime() < cond.lt.getTime())) return false;
    if ("gte" in cond && !(v instanceof Date && v.getTime() >= cond.gte.getTime())) return false;
  }
  return true;
}

function scriptedDb({ prospects, claims = [], attempts = [], tasks = [], activity = [], between = null }) {
  const state = {
    prospects: prospects.map((p) => ({ ...p })),
    claims: claims.map((c) => ({ ...c })),
    attempts: attempts.map((a) => ({ ...a })),
    tasks: tasks.map((t) => ({ ...t })),
    activity: activity.map((a) => ({ ...a })),
    log: [],
  };
  let nextId = 1;
  const claimRows = (prospectId, where) =>
    state.claims.filter((c) => c.prospectId === prospectId && matches(c, where));

  const db = {
    state,
    prospect: {
      async count({ where }) {
        state.log.push("prospect.count");
        return state.prospects.filter((p) => matches(p, where)).length;
      },
      async findMany({ where, orderBy, take, select }) {
        state.log.push("prospect.findMany");
        let rows = state.prospects.filter((p) => matches(p, where));
        if (orderBy?.[0]?.createdAt === "asc") rows.sort((a, b) => a.createdAt - b.createdAt);
        if (take) rows = rows.slice(0, take);
        return rows.map((p) => {
          const out = { ...p };
          if (select?.queueClaims) {
            out.queueClaims = claimRows(p.id, select.queueClaims.where).slice(0, select.queueClaims.take || 1e9);
          }
          if (select?.callAttempts) {
            out.callAttempts = state.attempts.filter(
              (a) => a.prospectId === p.id && matches(a, select.callAttempts.where),
            );
          }
          if (select?.leads) out.leads = p.leads || [];
          return out;
        });
      },
      async updateMany({ where, data }) {
        state.log.push("prospect.updateMany");
        // Interference: something happens between the read and this write.
        if (between && !between.done) {
          between.done = true;
          between.run(state);
        }
        let count = 0;
        for (const p of state.prospects) {
          if (matches(p, where)) {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      },
    },
    salesQueueClaim: {
      async count({ where }) {
        state.log.push("salesQueueClaim.count");
        return state.claims.filter((c) => matches(c, where)).length;
      },
      async create({ data }) {
        state.log.push("salesQueueClaim.create");
        const row = { id: `c${nextId++}`, releasedAt: null, releaseReason: null, workedAt: null, ...data };
        state.claims.push(row);
        return row;
      },
      async createMany({ data }) {
        state.log.push("salesQueueClaim.createMany");
        for (const d of data) {
          state.claims.push({ id: `c${nextId++}`, releasedAt: null, releaseReason: null, workedAt: null, ...d });
        }
        return { count: data.length };
      },
      async updateMany({ where, data }) {
        state.log.push("salesQueueClaim.updateMany");
        let count = 0;
        for (const c of state.claims) {
          if (matches(c, where)) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
      async findMany({ where, select }) {
        state.log.push("salesQueueClaim.findMany");
        return state.claims
          .filter((c) => matches(c, where))
          .map((c) => {
            const out = { ...c };
            if (select?.prospect) {
              const p = state.prospects.find((x) => x.id === c.prospectId) || null;
              out.prospect = p ? { assignedRepId: p.assignedRepId, claimExpiresAt: p.claimExpiresAt } : null;
            }
            return out;
          });
      },
    },
    // The presence ledger, read for the shift's start: the earliest
    // Available row in the window asked for.
    salesRepActivity: {
      async findFirst({ where, orderBy }) {
        state.log.push("salesRepActivity.findFirst");
        const rows = state.activity.filter((a) => matches(a, where));
        if (orderBy?.startedAt === "asc") rows.sort((a, b) => a.startedAt - b.startedAt);
        return rows[0] || null;
      },
    },
    async $transaction(fn) {
      state.log.push("$transaction");
      return fn(db);
    },
  };
  return db;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures. Toronto rep, 09:00 local on a Friday.
// ═══════════════════════════════════════════════════════════════════════════

const ZONE = "America/Toronto";
const NOW = new Date("2026-09-11T14:00:00Z"); // 10:00 EDT, Friday
const EVENING = new Date("2026-09-12T02:30:00Z"); // 22:30 EDT, Friday
const REP = { id: "rep_a" };
const OTHER = { id: "rep_b" };

let seq = 0;
function prospect(over = {}) {
  seq++;
  return {
    id: over.id || `p${seq}`,
    tradeKey: "electrical",
    status: "discovered",
    doNotContactAt: null,
    assignedRepId: null,
    assignedAt: null,
    claimExpiresAt: null,
    createdAt: new Date(NOW.getTime() - (1000 - seq) * 60 * 1000),
    country: "CA",
    province: "ON",
    lastCrawledAt: null,
    _count: { capabilities: 0, opportunities: 0 },
    leads: [],
    ...over,
  };
}
const researched = (over = {}) =>
  prospect({ lastCrawledAt: NOW, _count: { capabilities: 2, opportunities: 1 }, ...over });

// ═══════════════════════════════════════════════════════════════════════════
section("0. The numbers are the owner's, and the reasons are keys");

ok("QUEUE_BATCH_MAX is 25 — one press or one top-up, the owner's number of 2026-09-11", QUEUE_BATCH_MAX === 25, QUEUE_BATCH_MAX);
ok("QUEUE_DAILY_CLAIM_CAP is 250 — 200 calls a day plus room for no-answers and redials", QUEUE_DAILY_CLAIM_CAP === 250);
ok("SHIFT_HOURS is 7 — the owner's shift, lunch and break inside it", SHIFT_HOURS === 7);
ok("released rows sort last for 7 days", RELEASE_DEPRIORITISE_DAYS === 7);
ok("the scan is bounded, so a huge pool cannot time the request out", CANDIDATE_SCAN >= 200 && CANDIDATE_SCAN <= 1000);
for (const [code, key] of Object.entries(BATCH_REASON_KEYS)) {
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`reason ${code} → ${key} exists in ${lang}`, typeof APP_MESSAGES[lang][key] === "string");
  }
}
ok("every de-prioritising release reason is a release reason", DEPRIORITISING_RELEASES.every((r) => RELEASE_REASONS.includes(r)));
ok("…and a lapsed lease does NOT de-prioritise — nobody chose to give it back", !DEPRIORITISING_RELEASES.includes("lapsed"));

// ═══════════════════════════════════════════════════════════════════════════
section("1. The rep's day: zone, local date, and its end");

ok("a browser zone Intl can read is usable", usableTimeZone(ZONE, NOW) === ZONE);
ok("a bogus zone is not", usableTimeZone("Mars/Olympus", NOW) === null);
ok("…nor an empty one", usableTimeZone("", NOW) === null && usableTimeZone(null, NOW) === null);
ok("the local date is the rep's, not UTC's", localDateIn(ZONE, new Date("2026-09-12T02:30:00Z")) === "2026-09-11");
{
  const end = endOfLocalDay(ZONE, NOW);
  ok("the day ends at the next local midnight", end?.toISOString() === "2026-09-12T04:00:00.000Z", end);
  const dst = endOfLocalDay(ZONE, new Date("2026-11-01T05:00:00Z")); // 01:00 EDT on fall-back day
  ok("…across a DST transition too", dst?.toISOString() === "2026-11-02T05:00:00.000Z", dst);
  ok("…and null for a zone nobody can read", endOfLocalDay("Mars/Olympus", NOW) === null);
  const start = startOfLocalDay(ZONE, NOW);
  ok("the day started at the previous local midnight", start?.toISOString() === "2026-09-11T04:00:00.000Z", start);
  ok("…across the fall-back too", startOfLocalDay(ZONE, new Date("2026-11-01T05:00:00Z"))?.toISOString() === "2026-11-01T04:00:00.000Z");
}

// ═══════════════════════════════════════════════════════════════════════════
section("1b. The shift: first Available today, plus SHIFT_HOURS");

{
  const eightET = new Date("2026-09-11T12:00:00Z"); // 08:00 EDT
  const activity = [
    // Yesterday's shift: must not count.
    { salesRepId: "rep_a", state: "available", startedAt: new Date("2026-09-10T12:00:00Z") },
    { salesRepId: "rep_a", state: "available", startedAt: eightET },
    { salesRepId: "rep_a", state: "paused", startedAt: new Date("2026-09-11T15:00:00Z") },
    // Back from lunch: NOT a new shift.
    { salesRepId: "rep_a", state: "available", startedAt: new Date("2026-09-11T16:00:00Z") },
    { salesRepId: "rep_b", state: "available", startedAt: new Date("2026-09-11T11:00:00Z") },
  ];
  const db = scriptedDb({ prospects: [], activity });
  const at805 = new Date("2026-09-11T12:05:00Z");
  const start = await shiftStartFor({ db, salesRepId: "rep_a", timeZone: ZONE, now: at805 });
  ok("the shift started at the rep's FIRST Available today, not yesterday's and not rep_b's", start?.toISOString() === eightET.toISOString(), start);
  const later = await shiftStartFor({ db, salesRepId: "rep_a", timeZone: ZONE, now: new Date("2026-09-11T17:00:00Z") });
  ok("…and coming back from lunch does not move it", later?.toISOString() === eightET.toISOString(), later);
  const none = await shiftStartFor({ db, salesRepId: "rep_c", timeZone: ZONE, now: at805 });
  ok("a rep with no Available row today has no shift start", none === null);
  ok("…and shiftEndFrom then counts from now", shiftEndFrom({ shiftStart: none, now: at805 }).toISOString() === "2026-09-11T19:05:00.000Z");
  ok("with a start, the shift ends SHIFT_HOURS after it: 08:00 → 15:00 ET", shiftEndFrom({ shiftStart: start, now: at805 }).toISOString() === "2026-09-11T19:00:00.000Z");
  ok("a start in the future is not believed", shiftEndFrom({ shiftStart: new Date(at805.getTime() + 60_000), now: at805 }).toISOString() === "2026-09-11T19:05:00.000Z");
  ok("a client with no ledger reads as no start rather than throwing", (await shiftStartFor({ db: {}, salesRepId: "rep_a", timeZone: ZONE, now: at805 })) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The window rule: open before the rep's day ends, or not taken");

{
  const dayEnd = endOfLocalDay(ZONE, NOW);
  const on = salesCallReadiness({ prospect: { country: "CA", province: "ON" }, now: NOW });
  ok("an open window is callable", on.decision === CALL_ALLOWED && callableBeforeDayEnd({ readiness: on, dayEnd }));
  const bc = salesCallReadiness({ prospect: { country: "CA", province: "BC" }, now: NOW }); // 06:00 in BC
  ok(
    "a window that opens later today is callable (BC at 07:00, opens 08:00)",
    bc.decision === CALL_REFUSED &&
      bc.blockers.some((b) => b.code === "outside_window") &&
      callableBeforeDayEnd({ readiness: bc, dayEnd }),
    { decision: bc.decision, opensAt: bc.opensAt },
  );
  const eveningEnd = endOfLocalDay(ZONE, EVENING);
  const ny = salesCallReadiness({ prospect: { country: "US", province: "NY" }, now: EVENING });
  ok(
    "a window that opens TOMORROW is not (New York at 22:30, opens 08:00 tomorrow)",
    ny.decision === CALL_REFUSED && !callableBeforeDayEnd({ readiness: ny, dayEnd: eveningEnd }),
    { opensAt: ny.opensAt, dayEnd: eveningEnd },
  );
  const az = salesCallReadiness({ prospect: { country: "US", province: "AZ" }, now: NOW });
  ok("a prohibition is never callable, whatever the clock says", !callableBeforeDayEnd({ readiness: az, dayEnd }));
  const nowhere = salesCallReadiness({ prospect: {}, now: NOW });
  ok("an unknown location is not callable", !callableBeforeDayEnd({ readiness: nowhere, dayEnd }));
  ok("no readiness at all is not callable", !callableBeforeDayEnd({ readiness: null, dayEnd }));
  ok(
    "a forged ALLOWED with no opensAt still needs the decision, not the blockers",
    callableBeforeDayEnd({ readiness: { decision: CALL_ALLOWED, blockers: [] }, dayEnd }),
  );
  const closes = nextClosing({ prospect: { country: "CA", province: "ON" }, now: NOW });
  ok("nextClosing names when an open window shuts", closes instanceof Date && closes.getTime() > NOW.getTime(), closes);
  ok("…and is null when the window is not open", nextClosing({ prospect: { country: "CA", province: "BC" }, now: NOW }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. selectBatch: callable soonest, then researched first, released-recently last, capped");

{
  const dayEnd = shiftEndFrom({ now: NOW });
  const allowed = { decision: CALL_ALLOWED, blockers: [] };
  const tomorrow = {
    decision: CALL_REFUSED,
    blockers: [{ code: "outside_window" }],
    opensAt: new Date(dayEnd.getTime() + 8 * 60 * 60 * 1000),
  };
  const mk = (id, over) => ({ id, createdAt: new Date(NOW.getTime() - 1000 * Number(id.slice(1))), researched: false, recentlyReleased: false, readiness: allowed, ...over });
  const candidates = [
    mk("c1", { researched: false }),
    mk("c2", { researched: true }),
    mk("c3", { researched: true, recentlyReleased: true }),
    mk("c4", { researched: false }),
    mk("c5", { researched: true, readiness: tomorrow }),
    mk("c6", { researched: true }),
    mk("c7", { researched: false, recentlyReleased: true }),
  ];
  const r = selectBatch({ candidates, shiftEnd: dayEnd, want: 100 });
  ok("inside one window: researched rows come first, then unresearched, then the recently released", r.ids.join(",") === "c6,c2,c4,c1,c3,c7", r.ids);
  ok("…the row whose window opens after the shift is skipped, and counted", !r.ids.includes("c5") && r.skippedForWindow === 1, r);
  ok("…and the researched/unresearched split is reported", r.researched === 3 && r.unresearched === 3, r);
  const capped = selectBatch({ candidates, shiftEnd: dayEnd, want: 2 });
  ok("`want` caps the batch, keeping the order", capped.ids.join(",") === "c6,c2", capped.ids);
  const over = selectBatch({ candidates, shiftEnd: dayEnd, want: 10_000 });
  ok("…and can never exceed QUEUE_BATCH_MAX", over.ids.length <= QUEUE_BATCH_MAX);
  const many = selectBatch({
    candidates: Array.from({ length: 250 }, (_, i) => mk(`c${i + 10}`, { researched: i % 2 === 0 })),
    shiftEnd: dayEnd,
    want: 100,
  });
  ok("250 eligible rows → exactly QUEUE_BATCH_MAX (25), all researched (there were 125)", many.ids.length === QUEUE_BATCH_MAX && many.researched === QUEUE_BATCH_MAX, { n: many.ids.length, researched: many.researched });
  ok("the older `dayEnd` name still names the same bound", selectBatch({ candidates, dayEnd, want: 100 }).ids.join(",") === r.ids.join(","));

  // ── Callability outranks research ──────────────────────────────────────
  const H = 60 * 60 * 1000;
  const opensIn = (h) => ({ decision: CALL_REFUSED, blockers: [{ code: "outside_window" }], opensAt: new Date(NOW.getTime() + h * H) });
  const win = [
    mk("pt", { researched: true, readiness: opensIn(3) }), // Pacific, opens in 3h
    mk("et", { researched: false, readiness: allowed, closesAt: new Date(NOW.getTime() + 11 * H) }),
    mk("ct", { researched: true, readiness: opensIn(1) }), // Central, opens in 1h
    mk("at", { researched: false, readiness: allowed, closesAt: new Date(NOW.getTime() + 10 * H) }), // Atlantic shuts first
    mk("et2", { researched: true, readiness: allowed, closesAt: new Date(NOW.getTime() + 11 * H) }),
    mk("noclose", { researched: true, readiness: allowed, closesAt: null }),
  ];
  const w = selectBatch({ candidates: win, shiftEnd: dayEnd, want: 100 });
  // 2026-09-11: the batch is open-now ONLY. Rows that open later — even in
  // an hour, even researched — are skipped and counted, and the earliest of
  // their openings is named for the "more open at" sentence.
  ok("open-now rows only, shuts-soonest first, researched first inside the same closing", w.ids.join(",") === "at,et2,et,noclose", w.ids);
  ok("a researched row that opens in an hour is NOT taken; it is counted, and its opening named", !w.ids.includes("ct") && !w.ids.includes("pt") && w.skippedForWindow === 2 && w.nextOpensAt === new Date(NOW.getTime() + 1 * H).toISOString(), { skipped: w.skippedForWindow, next: w.nextOpensAt });
  ok("windowSortKey: open now is tier 0 at closesAt; shut is tier 1 at opensAt; neither instant → Infinity, never 0", (() => {
    const a = windowSortKey({ readiness: allowed, closesAt: new Date(5000) });
    const b = windowSortKey({ readiness: opensIn(1) });
    const c = windowSortKey({ readiness: allowed, closesAt: null });
    const d = windowSortKey({ readiness: { decision: CALL_REFUSED, blockers: [], opensAt: null } });
    return a.tier === 0 && a.at === 5000 && b.tier === 1 && b.at > NOW.getTime() && c.tier === 0 && c.at === Infinity && d.tier === 1 && d.at === Infinity;
  })());
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. claimBatch against a scripted db: trade, log, caps, atomic winners");

async function run() {
  // ── The trade is in the write ─────────────────────────────────────────────
  {
    seq = 0;
    const pool = [
      researched({ id: "e1" }),
      prospect({ id: "e2" }),
      researched({ id: "r1", tradeKey: "roofing" }),
      researched({ id: "e3", status: "needs_review" }),
      researched({ id: "e4", doNotContactAt: NOW }),
      researched({ id: "e5", assignedRepId: "rep_b", claimExpiresAt: new Date(NOW.getTime() + DAY) }),
      researched({ id: "e6", assignedRepId: "rep_b", claimExpiresAt: new Date(NOW.getTime() - 1000) }), // lapsed
    ];
    const db = scriptedDb({ prospects: pool });
    const r = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("only the picked trade is claimed — a roofer never lands in an Electrical day", !r.claimedIds.includes("r1"));
    ok("…nor a needs_review row, a do-not-contact, or another rep's live claim", !["e3", "e4", "e5"].some((id) => r.claimedIds.includes(id)), r.claimedIds);
    ok("…but a LAPSED claim is back in the pool and is taken", r.claimedIds.includes("e6"));
    ok("researched before unresearched in the ids returned (all open now, same closing)", r.claimedIds.join(",") === "e1,e6,e2", r.claimedIds);
    ok("the counts say what came researched and what is waiting", r.claimed === 3 && r.researched === 2 && r.unresearched === 1, r);
    ok("the lease is written on every winner, for this rep, expiring later", pool.length && db.state.prospects.filter((p) => r.claimedIds.includes(p.id)).every((p) => p.assignedRepId === "rep_a" && p.claimExpiresAt > NOW));
    const logged = db.state.claims.filter((c) => c.salesRepId === "rep_a");
    ok("the claim log has one row per winner, in dial order, with the zone and the local date", logged.length === 3 && logged.map((c) => c.prospectId).join(",") === "e1,e6,e2" && logged.every((c, i) => c.position === i && c.repTimeZone === ZONE && c.localDate === "2026-09-11" && c.mode === "batch"), logged);
    ok("…sharing one batchId", new Set(logged.map((c) => c.batchId)).size === 1 && r.batchId === logged[0].batchId);
    ok("the write rode a transaction", db.state.log.includes("$transaction"));
    ok("the pool ran short, and the response says so by key", r.reason === "pool_empty" && r.reasonKey === BATCH_REASON_KEYS.pool_empty, r);
    ok("remainingToday came down by what was claimed", r.remainingToday === QUEUE_DAILY_CLAIM_CAP - 3, r.remainingToday);
  }

  // ── The language rule: a Quebec row is not offered to a rep without French ─
  //
  // The owner: "the leads from quebec ... can't be handed out to anybody
  // unless they have a French profile in their settings." The rule is in
  // claimCandidateWhere() (lib/sales/leadLanguage.js), so the same scripted
  // db, two reps, and the rows say who got what.
  {
    seq = 0;
    const mk = () => [
      researched({ id: "qc1", province: "QC" }),
      researched({ id: "qc2", province: "Québec" }),
      researched({ id: "on1", province: "ON" }),
      researched({ id: "nb1", province: "NB" }),
      researched({ id: "np1", province: null }),
    ];
    const english = { id: "rep_a", sellsIn: ["en"] };
    const db = scriptedDb({ prospects: mk() });
    const r = await claimBatch({ db, rep: english, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("an English-only rep is not handed the Quebec rows", !r.claimedIds.includes("qc1") && !r.claimedIds.includes("qc2"), r.claimedIds);
    ok("…but is handed Ontario and New Brunswick (bilingual, no requirement)", ["on1", "nb1"].every((id) => r.claimedIds.includes(id)), r.claimedIds);
    ok("…and the two kept back are COUNTED as skippedForLanguage", r.skippedForLanguage === 2, r.skippedForLanguage);
    ok("the row with NO province was kept back by the WINDOW rule (no jurisdiction), not the language one", r.skippedForWindow === 1 && r.skippedForLanguage === 2, r);
    ok("…while the Quebec rows stay unassigned in the pool", db.state.prospects.filter((p) => p.id.startsWith("qc")).every((p) => p.assignedRepId === null));
    const unset = { id: "rep_a" };
    const db2 = scriptedDb({ prospects: mk() });
    const r2 = await claimBatch({ db: db2, rep: unset, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("a rep who never answered (no sellsIn) is treated as English-only", r2.claimedIds.length === 2 && r2.skippedForLanguage === 2, r2);
    const french = { id: "rep_a", sellsIn: ["fr", "en"] };
    const db3 = scriptedDb({ prospects: mk() });
    const r3 = await claimBatch({ db: db3, rep: french, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("a rep with French is offered the Quebec rows", r3.claimedIds.includes("qc1") && r3.claimedIds.includes("qc2"), r3.claimedIds);
    ok("…and everything else the window allows", r3.claimed === 4 && r3.skippedForLanguage === 0, r3);
    ok("…without a count query at all — nothing was kept back", !db3.state.log.includes("prospect.count"));
    // Empty result still says what was kept back.
    const db4 = scriptedDb({ prospects: [researched({ id: "qc9", province: "QC" })] });
    const r4 = await claimBatch({ db: db4, rep: english, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("a pool that is ALL Quebec gives an English rep nothing, and says two things: pool_empty and skippedForLanguage 1", r4.claimed === 0 && r4.reason === "pool_empty" && r4.skippedForLanguage === 1, r4);
    for (const lang of Object.keys(APP_MESSAGES)) {
      ok(`the sentence for it exists in ${lang}`, typeof APP_MESSAGES[lang]["app.salesQueue.batchSkippedForLanguage"] === "string");
    }
  }

  // ── The daily cap, from the log ───────────────────────────────────────────
  {
    seq = 0;
    const pool = Array.from({ length: 120 }, () => researched());
    const claims = Array.from({ length: QUEUE_DAILY_CLAIM_CAP - 10 }, (_, i) => ({
      id: `old${i}`,
      salesRepId: "rep_a",
      prospectId: `gone${i}`,
      claimedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      mode: "batch",
      localDate: "2026-09-11",
      repTimeZone: ZONE,
      // Released already — and STILL counted. That is the point of the log.
      releasedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      releaseReason: "rest",
      workedAt: null,
    }));
    const db = scriptedDb({ prospects: pool, claims });
    const r = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok(`${QUEUE_DAILY_CLAIM_CAP - 10} taken today (and released) → only 10 more, not 100`, r.claimed === 10, r.claimed);
    ok("…and the cap is the log's count, not the rep's current holdings", db.state.claims.filter((c) => c.salesRepId === "rep_a").length === QUEUE_DAILY_CLAIM_CAP);
    const again = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok(`at ${QUEUE_DAILY_CLAIM_CAP} the next press claims nothing and says daily_cap`, again.claimed === 0 && again.reason === "daily_cap" && again.reasonKey === BATCH_REASON_KEYS.daily_cap, again);
    ok("…without touching the pool", db.state.log.filter((l) => l === "prospect.updateMany").length === 1);
    const yesterday = claims.map((c) => ({ ...c, localDate: "2026-09-10" }));
    const db2 = scriptedDb({ prospects: pool.map((p) => ({ ...p })), claims: yesterday });
    const fresh = await claimBatch({ db2, db: db2, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("yesterday's claims do not count against today: a full batch", fresh.claimed === QUEUE_BATCH_MAX, fresh.claimed);
    ok("a pool of 120 eligible rows gives exactly QUEUE_BATCH_MAX, no shortfall reason", fresh.claimed === QUEUE_BATCH_MAX && fresh.reason === null, fresh.reason);
  }

  // ── The window rule, end to end ───────────────────────────────────────────
  {
    seq = 0;
    const pool = [
      researched({ id: "on1", country: "CA", province: "ON" }),
      researched({ id: "ny1", country: "US", province: "NY" }),
      researched({ id: "bc1", country: "CA", province: "BC" }),
      researched({ id: "az1", country: "US", province: "AZ" }),
    ];
    const db = scriptedDb({ prospects: pool });
    const r = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: EVENING });
    ok(
      "at 22:30 Toronto: Ontario and New York are shut till tomorrow, BC (19:30) is open, Arizona is banned — only BC is claimed",
      r.claimedIds.join(",") === "bc1",
      r.claimedIds,
    );
    ok("…and the rows left for the window are counted (ON, NY; AZ is not a window)", r.skippedForWindow === 3, r.skippedForWindow);
    ok("…with the shortfall named as partial_open, and tomorrow's earliest opening", r.reason === "partial_open" && typeof r.nextOpensAt === "string", { reason: r.reason, next: r.nextOpensAt });
    const van = scriptedDb({ prospects: pool.map((p) => ({ ...p })) });
    const r2 = await claimBatch({ db: van, rep: REP, tradeKey: "electrical", timeZone: "America/Vancouver", now: EVENING });
    ok("the same instant for a Vancouver rep (19:30, day ends at 03:00 Toronto): still only BC — ON/NY open at 05:00 Vancouver, after that rep's midnight", r2.claimedIds.join(",") === "bc1", r2.claimedIds);
    const morning = scriptedDb({ prospects: pool.map((p) => ({ ...p })) });
    const r3 = await claimBatch({ db: morning, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("at 10:00 Toronto: ON and NY open now are taken; BC (opens 11:00 Toronto) waits for the top-up; Arizona never", r3.claimedIds.slice().sort().join(",") === "ny1,on1" && !r3.claimedIds.includes("bc1"), r3.claimedIds);
    ok("…in dial order: NY (shuts 21:00) before ON (21:30)", r3.claimedIds.join(",") === "ny1,on1", r3.claimedIds);
    ok("…and BC's opening is what the shortfall names", r3.reason === "partial_open" && r3.nextOpensAt === salesCallReadiness({ prospect: { country: "CA", province: "BC" }, now: NOW }).opensAt.toISOString(), r3.nextOpensAt);
    ok("…and the response says when the shift ends", r3.shiftEnd === shiftEndFrom({ now: NOW }).toISOString() && typeof r3.shiftStart === "string", r3);
  }

  // ── The shift rule, end to end ────────────────────────────────────────────
  //
  // A rep who went Available at 08:00 ET and claims at 08:05: the shift ends
  // at 15:00 ET. Pacific opens at 11:00 ET — in. Hawaii opens 08:00 HST =
  // 14:00 EDT — in, just. Alaska (08:00 AKDT = 12:00 EDT) in. A row a rep
  // stated as being in Honolulu but whose window is 09:00 (Canada's rule,
  // 15:00 EDT) — out: 15:00 is not before 15:00.
  {
    seq = 0;
    const eightET = new Date("2026-09-11T12:00:00Z");
    const at805 = new Date("2026-09-11T12:05:00Z");
    const pool = [
      researched({ id: "ca1", country: "US", province: "CA" }),
      researched({ id: "ny2", country: "US", province: "NY" }),
      researched({ id: "hi1", country: "US", province: "HI" }),
      researched({ id: "ak1", country: "US", province: "AK", leads: [{ timeZone: "America/Anchorage" }] }),
      researched({ id: "late", country: "CA", province: "BC", leads: [{ timeZone: "Pacific/Honolulu" }] }),
      researched({ id: "ns1", country: "CA", province: "NS" }),
    ];
    const activity = [{ salesRepId: "rep_a", state: "available", startedAt: eightET }];
    const db = scriptedDb({ prospects: pool, activity });
    const r = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: "America/New_York", now: at805 });
    ok("the shift was read from the ledger: 08:00 + 7h = 15:00 ET", r.shiftStart === eightET.toISOString() && r.shiftEnd === "2026-09-11T19:00:00.000Z", r);
    ok("no row that opens at or after 15:00 ET is claimed, nor any that opens later at all: only what is open at 08:05 ET", !r.claimedIds.includes("late") && !r.claimedIds.includes("ca1") && r.skippedForWindow === 4, r);
    ok("the Pacific row opening 11:00 ET is left for the top-up, and is the earliest opening named", r.nextOpensAt === "2026-09-11T15:00:00.000Z", r.nextOpensAt);
    ok("…the order: Atlantic (shuts 20:30 ET) → New York (21:00); Pacific, Alaska and Hawaii wait for the top-ups at 11:00, 12:00 and 14:00", r.claimedIds.join(",") === "ns1,ny2", r.claimedIds);

    // 11:30 ET, same rep, same shift: a second batch leads with what is
    // callable at 11:30 — Pacific is open now and sorts by closing time.
    const at1130 = new Date("2026-09-11T15:30:00Z");
    const pool2 = pool.map((p) => ({ ...p, id: `${p.id}b` }));
    const db2 = scriptedDb({ prospects: pool2, activity });
    const r2 = await claimBatch({ db: db2, rep: REP, tradeKey: "electrical", timeZone: "America/New_York", now: at1130 });
    ok("at 11:30 the batch is what is callable at 11:30, shuts-soonest first: NS, NY, CA (20:00 PT = 23:00 ET); AK and HI open later and wait", r2.claimedIds.join(",") === "ns1b,ny2b,ca1b" && r2.nextOpensAt === "2026-09-11T16:00:00.000Z", { ids: r2.claimedIds, next: r2.nextOpensAt });
    ok("…and the shift end did not move: still 15:00 ET", r2.shiftEnd === "2026-09-11T19:00:00.000Z", r2.shiftEnd);
    // With no Available row the claim instant stands in: 11:30 + 7h = 18:30
    // ET, and Hawaii (opens 14:00 ET) is still in.
    const db3 = scriptedDb({ prospects: pool.map((p) => ({ ...p, id: `${p.id}c` })) });
    const r3 = await claimBatch({ db: db3, rep: REP, tradeKey: "electrical", timeZone: "America/New_York", now: at1130 });
    ok("with no Available row today the shift runs from the claim: 11:30 → 18:30 ET", r3.shiftStart === at1130.toISOString() && r3.shiftEnd === "2026-09-11T22:30:00.000Z", r3);
    ok("…and the explicit shiftStart parameter is honoured over the ledger", (await claimBatch({ db: scriptedDb({ prospects: pool.map((p) => ({ ...p, id: `${p.id}d` })), activity }), rep: REP, tradeKey: "electrical", timeZone: "America/New_York", now: at1130, shiftStart: null })).shiftEnd === "2026-09-11T22:30:00.000Z");
  }

  // ── Atomic winners ────────────────────────────────────────────────────────
  {
    seq = 0;
    const pool = Array.from({ length: 6 }, (_, i) => researched({ id: `w${i + 1}` }));
    const between = {
      done: false,
      run(state) {
        // Between claimBatch's read and its write, rep_b takes w2 and w4.
        for (const p of state.prospects) {
          if (p.id === "w2" || p.id === "w4") {
            p.assignedRepId = "rep_b";
            p.assignedAt = NOW;
            p.claimExpiresAt = new Date(NOW.getTime() + DAY);
          }
        }
      },
    };
    const db = scriptedDb({ prospects: pool, between });
    const r = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("rep_b took two rows between the read and the write: rep_a wins exactly the other four", r.claimedIds.join(",") === "w1,w3,w5,w6", r.claimedIds);
    ok("…rep_b's rows are untouched", db.state.prospects.filter((p) => p.id === "w2" || p.id === "w4").every((p) => p.assignedRepId === "rep_b"));
    ok("…the count is the winners, not the request", r.claimed === 4);
    ok("…and the log records only winners, positions renumbered 0..3", db.state.claims.map((c) => `${c.prospectId}:${c.position}`).join(",") === "w1:0,w3:1,w5:2,w6:3", db.state.claims.map((c) => c.position));
    const allGone = { done: false, run(state) { for (const p of state.prospects) { p.assignedRepId = "rep_b"; p.claimExpiresAt = new Date(NOW.getTime() + DAY); } } };
    const db2 = scriptedDb({ prospects: pool.map((p) => ({ ...p, assignedRepId: null, claimExpiresAt: null })), between: allGone });
    const lost = await claimBatch({ db: db2, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("losing every race is `contended`, with nothing logged", lost.claimed === 0 && lost.reason === "contended" && db2.state.claims.length === 0, lost);
  }

  // ── Seven-day de-prioritisation ───────────────────────────────────────────
  {
    seq = 0;
    const pool = [researched({ id: "d1" }), researched({ id: "d2" }), researched({ id: "d3" })];
    const claims = [
      { id: "k1", salesRepId: "rep_a", prospectId: "d1", claimedAt: new Date(NOW.getTime() - 2 * DAY), mode: "batch", localDate: "2026-09-09", releasedAt: new Date(NOW.getTime() - 2 * DAY), releaseReason: "day_end", workedAt: null },
      { id: "k2", salesRepId: "rep_a", prospectId: "d2", claimedAt: new Date(NOW.getTime() - 9 * DAY), mode: "batch", localDate: "2026-09-02", releasedAt: new Date(NOW.getTime() - 9 * DAY), releaseReason: "rest", workedAt: null },
      // Released by a DIFFERENT rep two days ago: no effect on rep_a's order.
      { id: "k3", salesRepId: "rep_b", prospectId: "d3", claimedAt: new Date(NOW.getTime() - 2 * DAY), mode: "single", localDate: "2026-09-09", releasedAt: new Date(NOW.getTime() - 2 * DAY), releaseReason: "rep", workedAt: null },
    ];
    const db = scriptedDb({ prospects: pool, claims });
    const r = await claimBatch({ db, rep: REP, tradeKey: "electrical", timeZone: ZONE, now: NOW });
    ok("d1 (released by this rep 2 days ago) sorts LAST; d2 (9 days ago) and d3 (another rep's release) keep pool order", r.claimedIds.join(",") === "d2,d3,d1", r.claimedIds);
  }

  // ── The rolling batch: 25, open NOW, topped up under 5 ────────────────
  //
  // The owner, 2026-09-11 at 9:20 pm Eastern with a batch of shut windows:
  // "a batch of 25, and if there are fewer than 5 leads left it auto-fetches
  // a new set from the current time". So the selection is open-now only,
  // closing soonest first; a row that opens later — even inside the shift —
  // is skipped and counted, and the earliest of those openings rides back
  // so a short batch can say "N open now — more open at 8:00 AM". The
  // trade, the cap and the language rule sit above the selection as before.
  {
    const LATE = new Date("2026-09-12T02:00:00Z"); // 22:00 EDT Friday (Ontario shut at 21:30), 19:00 PDT (open)
    seq = 0;
    const pool = [
      researched({ id: "on1", country: "CA", province: "ON" }),
      researched({ id: "bc1", country: "CA", province: "BC" }),
      prospect({ id: "bc2", country: "CA", province: "BC" }),
      researched({ id: "roof", country: "CA", province: "BC", tradeKey: "roofing" }),
      researched({ id: "qc1", country: "CA", province: "QC" }),
    ];
    const english = { id: "rep_a", sellsIn: ["en"] };
    const db = scriptedDb({ prospects: pool });
    const r = await claimBatch({ db, rep: english, tradeKey: "electrical", timeZone: ZONE, now: LATE });
    ok("the batch takes the rows open at this instant", r.claimedIds.join(",") === "bc1,bc2", r.claimedIds);
    ok("…skips the shut Eastern row and COUNTS it", !r.claimedIds.includes("on1") && r.skippedForWindow >= 1, r);
    ok("…never a roofer, never a Quebec row for an English-only rep", !r.claimedIds.includes("roof") && !r.claimedIds.includes("qc1"), r.claimedIds);
    ok("…and says how many were open, and that the rest open later", r.openNow === 2 && r.reason === "partial_open" && typeof r.nextOpensAt === "string", { openNow: r.openNow, reason: r.reason, next: r.nextOpensAt });

    // 10:30 am Eastern: Ontario open in both its zones, BC opens at 11 am
    // Eastern — inside the shift, and still NOT taken: it is not open now.
    const MORNING = new Date("2026-09-11T14:30:00Z");
    const morningPool = [researched({ id: "on1", country: "CA", province: "ON" }), researched({ id: "bc1", country: "CA", province: "BC" })];
    const morning = await claimBatch({ db: scriptedDb({ prospects: morningPool }), rep: english, tradeKey: "electrical", timeZone: ZONE, now: MORNING });
    ok("a row that opens later in the shift is left for the top-up, and counted", morning.claimedIds.join(",") === "on1" && morning.skippedForWindow === 1 && morning.reason === "partial_open", morning.claimedIds);
    ok("…with the earliest opening among the rows left", morning.nextOpensAt === salesCallReadiness({ prospect: { country: "CA", province: "BC" }, now: MORNING }).opensAt.toISOString(), morning.nextOpensAt);

    // A top-up appends: the second claim, a minute later, takes rows the
    // first did not and never the ones already held — the candidate WHERE
    // is inside the transaction's updateMany, and winners are read back by
    // rep and instant.
    const LATER = new Date(LATE.getTime() + 60 * 1000);
    const again = await claimBatch({ db, rep: english, tradeKey: "electrical", timeZone: ZONE, now: LATER });
    ok("a top-up a minute later takes nothing it already holds", again.claimedIds.every((id) => !r.claimedIds.includes(id)), again.claimedIds);
    ok("…and the held set is the union with no duplicate", (() => { const held = db.state.prospects.filter((p) => p.assignedRepId === "rep_a").map((p) => p.id); return new Set(held).size === held.length && held.includes("bc1") && held.includes("bc2"); })());

    const capped = await claimBatch({ db: scriptedDb({ prospects: pool, claims: Array.from({ length: QUEUE_DAILY_CLAIM_CAP }, (_, i) => ({ id: `k${i}`, salesRepId: "rep_a", prospectId: `x${i}`, claimedAt: LATE, localDate: "2026-09-11", mode: "batch", releasedAt: null })) }), rep: english, tradeKey: "electrical", timeZone: ZONE, now: LATE });
    ok("the daily cap refuses a top-up like any press", capped.claimed === 0 && capped.reason === "daily_cap", capped.reason);

    const shut = await claimBatch({ db: scriptedDb({ prospects: [researched({ id: "on9", country: "CA", province: "ON" }), researched({ id: "ns9", country: "CA", province: "NS" })] }), rep: english, tradeKey: "electrical", timeZone: ZONE, now: LATE });
    ok("nothing open now → none_open_now, by key", shut.claimed === 0 && shut.reason === "none_open_now" && shut.reasonKey === BATCH_REASON_KEYS.none_open_now, shut);
    ok("…carrying the EARLIEST next opening from the readiness the selection computed", typeof shut.nextOpensAt === "string" && new Date(shut.nextOpensAt).getTime() > LATE.getTime() && new Date(shut.nextOpensAt).getTime() - LATE.getTime() < 13 * 60 * 60 * 1000, shut.nextOpensAt);
    const sel = selectBatch({ candidates: [{ id: "a", readiness: { decision: CALL_ALLOWED, blockers: [] } }, { id: "b", readiness: { decision: CALL_REFUSED, blockers: [{ code: "outside_window" }], opensAt: new Date(LATE.getTime() + 3600e3) } }], want: 10 });
    ok("selectBatch itself: open now taken, shut skipped and counted, its opening named", sel.ids.join(",") === "a" && sel.skippedForWindow === 1 && sel.nextOpensAt === new Date(LATE.getTime() + 3600e3).toISOString(), sel);

    // ── The dead rows go back before a top-up ─────────────────────────
    // Held, untouched, shut for the rest of the shift → released with
    // reason "closed" (which does not de-prioritise). A row with an
    // attempt, a row with a callback promised, and a row that opens later
    // in the shift are all kept.
    const shiftEnd = shiftEndFrom({ shiftStart: LATE, now: LATE }); // 05:00 EDT
    const claimedAt = new Date(LATE.getTime() - 3600e3);
    const heldRows = [
      researched({ id: "dead1", country: "CA", province: "ON", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: new Date(LATE.getTime() + DAY) }),
      researched({ id: "rung", country: "CA", province: "ON", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: new Date(LATE.getTime() + DAY) }),
      researched({ id: "promised", country: "CA", province: "ON", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: new Date(LATE.getTime() + DAY) }),
      researched({ id: "open", country: "CA", province: "BC", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: new Date(LATE.getTime() + DAY) }),
    ];
    const dbHeld = scriptedDb({
      prospects: heldRows,
      claims: heldRows.map((p, i) => ({ id: `h${i}`, salesRepId: "rep_a", prospectId: p.id, claimedAt, localDate: "2026-09-11", mode: "batch", releasedAt: null, workedAt: null })),
      attempts: [
        { id: "a1", prospectId: "rung", salesRepId: "rep_a", dialledAt: new Date(LATE.getTime() - 600e3), callbackAt: null },
        { id: "a2", prospectId: "promised", salesRepId: "rep_a", dialledAt: new Date(LATE.getTime() - 600e3), callbackAt: new Date(LATE.getTime() + DAY) },
      ],
    });
    const rel = await releaseClosedUntouched({ db: dbHeld, rep: english, shiftEnd, now: LATE });
    ok("the untouched row whose window is shut for the shift is released", rel.releasedIds.join(",") === "dead1", rel);
    ok("…a row with an attempt is NOT released", dbHeld.state.prospects.find((p) => p.id === "rung").assignedRepId === "rep_a");
    ok("…a row with a callback promised is NOT released", dbHeld.state.prospects.find((p) => p.id === "promised").assignedRepId === "rep_a");
    ok("…a row that is open now is NOT released", dbHeld.state.prospects.find((p) => p.id === "open").assignedRepId === "rep_a");
    ok("…the log says 'closed', a reason that does not de-prioritise", dbHeld.state.claims.find((c) => c.prospectId === "dead1").releaseReason === "closed" && RELEASE_REASONS.includes("closed") && !DEPRIORITISING_RELEASES.includes("closed"));

    const route = decomment(read("app/api/sales/queue/route.js"));
    ok("the route reads `auto` as a boolean, releases the dead rows first, then claims", /const auto = body\.auto === true;/.test(route) && route.indexOf("releaseClosedUntouched({ db, rep, shiftEnd, now, policyContext })") < route.indexOf("claimBatch({ db, rep, tradeKey, timeZone, now, policyContext })") && /result\.releasedClosed = releasedClosed;/.test(route));
    ok("…and the batch tells the console the threshold and the interval", /topUpBelow: QUEUE_TOP_UP_BELOW,/.test(route) && /topUpIntervalMs: QUEUE_TOP_UP_MIN_INTERVAL_MS,/.test(route));
    const page = decomment(read("app/sales/queue/page.js"));
    ok("the console tops up under the threshold, at most once an interval, posting only the flag", /act\("claim_batch", \{ auto: true \}\)/.test(page) && /if \(openHeld >= topUpBelow\) return;/.test(page) && /if \(nowMs - lastTopUp\.current < topUpInterval\) return;/.test(page));
    ok("…never while a press is in flight, and never past the cap", /if \(loading \|\| fetching \|\| busy \|\| !data \|\| !tradeKey\) return;/.test(page) && /if \(!\(remainingToday > 0\)\) return;/.test(page));
    ok("…and openHeld counts rows callable now with no outcome, not marked worked", /item\.window\?\.callableNow && !item\.lastOutcome && item\.claim\?\.state !== "mine_worked"/.test(page));
    ok("the top-up's toast names the count and the zones it added", /app\.salesQueue\.topUpToast/.test(page) && /zoneAcronym/.test(page));
    ok("the list's one line says open · closed · the threshold", /app\.salesQueue\.openNowSummary/.test(page));
    ok("QUEUE_TOP_UP_BELOW is 5 and the interval a minute", QUEUE_TOP_UP_BELOW === 5 && QUEUE_TOP_UP_MIN_INTERVAL_MS === 60_000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Release: untouched goes back, dialled stays, worked is out of scope");

async function runRelease() {
  {
    const claimedAt = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    const rows = [
      { id: "u1", assignedAt: claimedAt, claimExpiresAt: new Date(NOW.getTime() + DAY), attempts: [] },
      { id: "u2", assignedAt: claimedAt, claimExpiresAt: new Date(NOW.getTime() + DAY), attempts: [{ dialledAt: new Date(NOW.getTime() - 60 * 60 * 1000) }] },
      // An attempt from BEFORE this claim (a previous rep, or a previous lease) does not count as touching it.
      { id: "u3", assignedAt: claimedAt, claimExpiresAt: new Date(NOW.getTime() + DAY), attempts: [{ dialledAt: new Date(NOW.getTime() - 5 * DAY) }] },
      { id: "u4", assignedAt: claimedAt, claimExpiresAt: null, attempts: [] },
    ];
    const p = partitionForRelease(rows);
    ok("no attempt since the claim → released", p.release.includes("u1"));
    ok("an attempt since the claim → kept", p.keep.includes("u2") && !p.release.includes("u2"));
    ok("an attempt from before the claim is not an attempt on it → released", p.release.includes("u3"));
    ok("a worked row (lease already ended) is neither released nor kept — out of scope", p.worked.includes("u4") && !p.release.includes("u4") && !p.keep.includes("u4"));
    ok("untouchedSinceClaim treats a missing assignedAt as the epoch", untouchedSinceClaim({ assignedAt: null, attempts: [{ dialledAt: NOW }] }) === false);
  }
  {
    const claimedAt = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    const lease = new Date(NOW.getTime() + DAY);
    const pool = [
      researched({ id: "h1", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: lease }),
      researched({ id: "h2", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: lease }),
      researched({ id: "h3", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: null }), // worked
      researched({ id: "h4", assignedRepId: "rep_b", assignedAt: claimedAt, claimExpiresAt: lease }), // not ours
    ];
    const claims = ["h1", "h2", "h3"].map((id, i) => ({ id: `q${i}`, salesRepId: "rep_a", prospectId: id, claimedAt, mode: "batch", localDate: "2026-09-11", repTimeZone: ZONE, releasedAt: null, releaseReason: null, workedAt: null }));
    claims.push({ id: "qb", salesRepId: "rep_b", prospectId: "h4", claimedAt, mode: "single", localDate: "2026-09-11", repTimeZone: ZONE, releasedAt: null, releaseReason: null, workedAt: null });
    const attempts = [{ prospectId: "h2", salesRepId: "rep_a", dialledAt: new Date(NOW.getTime() - 60 * 60 * 1000) }];
    const db = scriptedDb({ prospects: pool, claims, attempts });
    const r = await releaseUntouched({ db, rep: REP, reason: "rest", now: NOW });
    ok("Release the rest: the untouched row goes back, the dialled one is kept", r.released === 1 && r.kept === 1 && r.releasedIds.join(",") === "h1", r);
    const h1 = db.state.prospects.find((p) => p.id === "h1");
    ok("…the released row is unclaimed again, not deleted", h1 && h1.assignedRepId === null && h1.claimExpiresAt === null && db.state.prospects.length === 4);
    ok("…the dialled row still belongs to the rep", db.state.prospects.find((p) => p.id === "h2").assignedRepId === "rep_a");
    ok("…the worked row is untouched", db.state.prospects.find((p) => p.id === "h3").assignedRepId === "rep_a");
    ok("…and rep_b's row is untouched — the WHERE carries the rep", db.state.prospects.find((p) => p.id === "h4").assignedRepId === "rep_b");
    const logRow = db.state.claims.find((c) => c.prospectId === "h1");
    ok("the log says when and why: releasedAt now, reason `rest`", logRow.releasedAt === NOW && logRow.releaseReason === "rest", logRow);
    ok("…and the kept row's log entry stays open", db.state.claims.find((c) => c.prospectId === "h2").releasedAt === null);
    let threw = null;
    try { await releaseUntouched({ db, rep: REP, reason: "whatever", now: NOW }); } catch (e) { threw = e; }
    ok("an unknown reason is refused, never written", threw !== null);
  }
  // ── The day-end sweep ─────────────────────────────────────────────────────
  {
    const claimedAt = new Date("2026-09-11T14:00:00Z"); // 10:00 Toronto, Friday
    const lease = new Date(claimedAt.getTime() + 2 * DAY);
    const pool = [
      researched({ id: "s1", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: lease }),
      researched({ id: "s2", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: lease }),
      researched({ id: "s3", assignedRepId: "rep_a", assignedAt: claimedAt, claimExpiresAt: null }), // worked via disposition
      researched({ id: "s4", assignedRepId: null, assignedAt: null, claimExpiresAt: null }), // put back by hand, log never closed
      researched({ id: "s5", assignedRepId: "rep_c", assignedAt: claimedAt, claimExpiresAt: lease }), // Vancouver rep, day not over
    ];
    const claim = (id, rep, zone) => ({ id: `z${id}`, salesRepId: rep, prospectId: id, claimedAt, mode: "batch", localDate: "2026-09-11", repTimeZone: zone, releasedAt: null, releaseReason: null, workedAt: null });
    const claims = [claim("s1", "rep_a", ZONE), claim("s2", "rep_a", ZONE), claim("s3", "rep_a", ZONE), claim("s4", "rep_a", ZONE), claim("s5", "rep_c", "America/Vancouver")];
    const attempts = [{ prospectId: "s2", salesRepId: "rep_a", dialledAt: new Date(claimedAt.getTime() + 60 * 60 * 1000) }];
    // 00:30 Saturday in Toronto — the rep's Friday is over. 21:30 Friday in Vancouver — rep_c's is not.
    const tick = new Date("2026-09-12T04:30:00Z");
    const db = scriptedDb({ prospects: pool, claims, attempts });
    const counts = await releaseDayEnded({ db, now: tick });
    ok("the Toronto rep's untouched row is released at their midnight", db.state.prospects.find((p) => p.id === "s1").assignedRepId === null && counts.released === 1, counts);
    ok("…with reason day_end in the log", db.state.claims.find((c) => c.prospectId === "s1").releaseReason === "day_end");
    ok("…their dialled row is kept", db.state.prospects.find((p) => p.id === "s2").assignedRepId === "rep_a" && counts.kept === 1);
    ok("…their worked row is closed in the log as worked, never released", db.state.claims.find((c) => c.prospectId === "s3").workedAt !== null && db.state.claims.find((c) => c.prospectId === "s3").releasedAt === null);
    ok("…a row already back in the pool is closed as lapsed, not counted as a release", db.state.claims.find((c) => c.prospectId === "s4").releaseReason === "lapsed" && counts.lapsed === 1);
    ok("the Vancouver rep's day has not ended: their row is untouched", db.state.prospects.find((p) => p.id === "s5").assignedRepId === "rep_c" && db.state.claims.find((c) => c.prospectId === "s5").releasedAt === null);
    const earlier = scriptedDb({ prospects: pool.map((p) => ({ ...p, assignedRepId: p.id === "s4" ? null : p.id === "s5" ? "rep_c" : "rep_a" })), claims: claims.map((c) => ({ ...c, releasedAt: null, releaseReason: null, workedAt: null })), attempts });
    const before = await releaseDayEnded({ db: earlier, now: new Date("2026-09-12T02:00:00Z") }); // 22:00 Friday Toronto
    ok("at 22:00 Friday Toronto nothing is due yet — the day has not ended", before.released === 0 && before.reps === 0, before);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Source: the route, the gate, the cron, the screen, the sticky fix");

{
  const route = decomment(read("app/api/sales/queue/route.js"));
  const lib = decomment(read("lib/sales/queueBatch.js"));
  const page = decomment(read("app/sales/queue/page.js"));
  const cron = decomment(read("app/api/cron/sales-queue-release/route.js"));
  const vercel = JSON.parse(read("vercel.json"));

  ok("the route offers claim_batch and release_rest", /"claim_batch"/.test(route) && /"release_rest"/.test(route));
  ok("…and claim_batch delegates to claimBatch with the trade and the browser's zone — nothing else", /claimBatch\(\{ db, rep, tradeKey, timeZone, now, policyContext \}\)/.test(route));
  ok("the trade filter is inside the updateMany's WHERE inside the transaction", /\$transaction\(async \(tx\) => \{[\s\S]*?tx\.prospect\.updateMany\(\{\s*where: \{ id: \{ in: picked\.ids \}, \.\.\.claimCandidateWhere\(\{ tradeKey, now: at, rep \}\) \}/.test(lib));
  ok("winners are read back by rep AND instant, so a row already held from an earlier claim is not counted twice", /where: \{ id: \{ in: picked\.ids \}, assignedRepId: rep\.id, assignedAt: at \}/.test(lib));
  ok("the single claim is logged and counted against the same cap", /logSingleClaim\(\{ db, rep, prospectId: candidate\.id, timeZone, now: at \}\)/.test(route) && /takenToday >= QUEUE_DAILY_CLAIM_CAP/.test(route));
  ok("the single claim's cap refusal is by key, with the cap as a value", /reasonKey: "app\.salesQueue\.batchReason\.dailyCap"/.test(route));
  ok("research is asked for after every successful claim, batch and single, behind a typeof guard", /typeof fn !== "function"/.test(route) && (route.match(/queueResearchFor\(/g) || []).length >= 3 && /priority: "claimed"/.test(route));
  ok("…and never awaited on the response path", /Promise\.resolve\(\)\s*\.then\(\(\) => fn\(/.test(route));
  ok("the route's Prospect list read is still scoped through queueWhere", /const claimedRows = await db\.prospect\.findMany\(\{\s*where: queueWhere\(rep\.id/.test(route));
  // The held list is EVERYTHING the rep holds. It used to be narrowed to the
  // picked trade, so claiming a second trade made the first one vanish from
  // the screen — the owner's "sometimes the leads briefly disappear".
  ok("…and NOT narrowed to the picked trade — the picker chooses what to claim, never what to hide", !/const claimedRows = await db\.prospect\.findMany\(\{[\s\S]{0,400}?tradeKey \}/.test(route));
  ok("the day's list is ordered by the claim log's (claimedAt, position)", /orderBy: \[\{ claimedAt: "asc" \}, \{ position: "asc" \}\]/.test(route));
  ok("\"researching…\" is read from the pipeline's own task table, never inferred", /db\.salesPipelineTask\.findMany\(\{\s*where: \{ prospectId: \{ in: ids \}, status: \{ in: \["queued", "claimed"\] \}/.test(route));
  ok("the response carries the ordered ids for the autodialler", /claimedIds: won/.test(lib) && /result: batch/.test(route));
  ok("nothing in queueBatch lists the pool by the availability condition alone", !/findMany\(\{\s*where: claimCandidateWhere/.test(lib));
  ok("…every candidate read ANDs the research condition onto it", (lib.match(/where: \{ AND: \[base, (researchedWhere|unresearchedWhere)\(\)\] \}/g) || []).length === 2);

  // The gate's list and the lib's writes.
  const written = new Set([...lib.matchAll(/\b(?:db|tx)\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g)].map((m) => m[1]));
  ok("queueBatch writes only the models REP_QUEUE_WRITES names", [...written].every((m) => REP_QUEUE_WRITES.includes(m)), [...written]);
  ok("…and REP_QUEUE_WRITES is exactly prospect + salesQueueClaim", REP_QUEUE_WRITES.length === 2 && REP_QUEUE_WRITES.includes("salesQueueClaim"));
  ok("nothing in queueBatch or the cron deletes", !/\.(delete|deleteMany)\(/.test(lib) && !/\.(delete|deleteMany)\(/.test(cron));

  // The cron.
  ok("the cron is gated by the cron secret", /const denied = requireCronSecret\(request\);\s*if \(denied\) return denied;/.test(cron));
  ok("…and calls releaseDayEnded", /releaseDayEnded\(\{/.test(cron));
  const scheduled = vercel.crons.find((c) => c.path === "/api/cron/sales-queue-release");
  ok("…and is scheduled hourly in vercel.json", Boolean(scheduled) && /^\d+ \* \* \* \*$/.test(scheduled.schedule), scheduled);

  // The screen.
  ok("the button says the server's number, never a typed 100", /t\("app\.salesQueue\.claimBatch", \{ count: batchSize \}\)/.test(page) && !/claimBatch", \{ count: 100/.test(page));
  ok("…and batchSize is min(server max, what is left of the day)", /const batchSize = Math\.min\(data\?\.batch\?\.max \?\? 0, remainingToday\)/.test(page));
  ok("the single path survives as \"Just one\"", /act\("claim"\)/.test(page) && /app\.salesQueue\.claimJustOne/.test(page));
  ok("Release the rest posts release_rest", /act\("release_rest"\)/.test(page));
  ok("…and is not rendered when it would release nothing", /untouchedCount > 0 \?/.test(page));
  ok("the browser sends its zone with every request, and never a number", /timeZone: browserTimeZone\(\)/.test(page) && /search\.set\("timeZone", zone\)/.test(page) && !/max:\s*\d/.test(page));
  ok("at the cap the button is replaced by the sentence, not greyed", /remainingToday > 0 \? \(/.test(page) && /app\.salesQueue\.batchReason\.dailyCap/.test(page));
  ok("a row prints researched / researching / not researched as three sentences", /rowResearched/.test(page) && /rowResearching/.test(page) && /rowNotResearched/.test(page));
  ok("…and the window's opening or closing, on the REP's clock from the server's strings", /rowWindowOpensAt/.test(page) && /rowWindowClosesAt/.test(page) && /w\.opensAtLocal/.test(page) && /w\.closesAtLocal/.test(page) && !/hhmmIn\(/.test(page));
  ok("the route reads the shift from the ledger and groups by window", /shiftStartFor\(\{ db, salesRepId: rep\.id, timeZone: zone, now \}\)/.test(route) && /groupByWindow\(/.test(route) && /queue\.windows = \{/.test(route));
  ok("the claim itself reads the same ledger — never a shiftStart the browser sent", /shiftStartFor\(\{ db, salesRepId: rep\.id/.test(lib) && !/body\.shiftStart/.test(route));
  ok("…and the last outcome by its disposition key", /app\.salesCall\.disposition\.\$\{item\.lastOutcome\.disposition\}\.label/.test(page));

  // The sticky fix.
  const dialTag = page.match(/<section[^>]*data-tour="sales-queue-dial"[^>]*>/)?.[0] || "";
  ok("the dial section is in normal flow — no sticky, no fixed, no z-index on it", dialTag.length > 0 && !/\bsticky\b|\bfixed\b|\bz-\d/.test(dialTag), dialTag.slice(0, 120));
  ok("…and the header records why (the owner's sentence about the notes scrolling underneath)", /scrolls underneath/.test(read("app/sales/queue/page.js")) && /taller than the viewport/.test(read("app/sales/queue/page.js")));
  ok("…the lead editor and the notes still come AFTER the dial in the same column, so nothing else could cover them", page.indexOf('data-tour="sales-queue-dial"') < page.indexOf("<QueueLeadEditor") && page.indexOf("<QueueLeadEditor") < page.indexOf("<ProspectNotes"));
  const aside = page.match(/<aside[^>]*className=\{`[^`]*`\}/)?.[0] || "";
  ok("the list column's sticky is bounded (max-h + overflow-y-auto), which is the version that covers nothing", /lg:sticky/.test(aside) && /lg:max-h-\[/.test(aside) && /lg:overflow-y-auto/.test(aside), aside.slice(0, 160));

  // Every key the screen asks for, in nine languages.
  const missing = [];
  for (const m of page.matchAll(/"(app\.salesQueue\.[A-Za-z0-9.]+)"/g)) {
    for (const lang of Object.keys(APP_MESSAGES)) if (APP_MESSAGES[lang][m[1]] === undefined) missing.push(`${m[1]} (${lang})`);
  }
  ok("every app.salesQueue key the page names exists in all nine languages", missing.length === 0, [...new Set(missing)].slice(0, 10));
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: claimBatch keeps its {count} slot`, String(APP_MESSAGES[lang]["app.salesQueue.claimBatch"]).includes("{count}"));
  }

  const pkg = JSON.parse(read("package.json"));
  ok("check:all runs this", /check:sales-batch-claim/.test(pkg.scripts["check:all"] || ""));
}

await run();
await runRelease();

console.log(
  failures.length
    ? `\n✗ ${failures.length} failed, ${pass} passed\n${failures.map((f) => `   - ${f}`).join("\n")}\n`
    : `\n✓ sales batch claim: ${pass} passed, 0 failed\n`,
);
process.exit(failures.length ? 1 : 0);
