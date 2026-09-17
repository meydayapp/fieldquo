// scripts/check-queue-cache.mjs
//
// The sales queue's two caches and the "given back" strip, executed.
//
// ══ What this proves ═══════════════════════════════════════════════════════
//
//   1. The server memo (lib/sales/queueCache.js createMemo): a value stands
//      for TTL_MS, one in-flight load is shared, a thrown load caches
//      nothing, and the queue route reads the window overrides, the retry
//      rules and the available-per-trade GROUP BY through it — never the
//      rep's own rows.
//   2. The client snapshot (readSnapshot / writeSnapshot): keyed by rep AND
//      trade, refused for another rep, aged out, the list returned with the
//      detail nulled when the URL names a different row, the press's
//      `batch.result` stripped; and the page draws it before its first
//      request and writes every payload back.
//   3. The per-lead cache (readLead / writeLead / prefetchTargets): merged
//      per field, bounded, aged; the read-ahead picks the next rows in dial
//      order that are not already held; the playbook and the call history
//      read it first; the route answers `?only=current` through the same
//      buildCurrent as the full response.
//   4. The strip (lib/sales/queueGivenBack.js groupGivenBack): one event per
//      sweep and reason, automatic reasons only, names A→Z, newest first,
//      the rep's local midnight as "today", and nine-language copy for every
//      key it prints.
//
// Run: npm run check:queue-cache

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LEAD_MAX_AGE_MS,
  LEAD_MAX_ENTRIES,
  LEAD_PREFETCH_AHEAD,
  LEAD_INDEX_KEY,
  SNAPSHOT_MAX_AGE_MS,
  SNAPSHOT_REP_KEY,
  TTL_MS,
  clearSnapshots,
  createMemo,
  currentRepId,
  leadKey,
  prefetchTargets,
  readLead,
  readSnapshot,
  snapshotKey,
  writeLead,
  writeSnapshot,
} from "@/lib/sales/queueCache";
import { GIVEN_BACK_REASONS, GIVEN_BACK_WHY_KEYS, givenBackSince, groupGivenBack, loadGivenBack } from "@/lib/sales/queueGivenBack";
import { RELEASE_REASONS } from "@/lib/sales/queueBatch";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

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
const section = (heading) => console.log(`\n${heading}\n`);

/** A sessionStorage stand-in: the four methods the cache uses, over a Map. */
function fakeStorage({ quota = Number.POSITIVE_INFINITY } = {}) {
  const m = new Map();
  return {
    get length() {
      return m.size;
    },
    key(i) {
      return [...m.keys()][i] ?? null;
    },
    getItem(k) {
      return m.has(k) ? m.get(k) : null;
    },
    setItem(k, v) {
      if (String(v).length > quota) throw new Error("QuotaExceededError");
      m.set(k, String(v));
    },
    removeItem(k) {
      m.delete(k);
    },
    _map: m,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════
section("1. The server memo");

{
  let clock = 1_000_000;
  const memo = createMemo({ ttlMs: 1000, now: () => clock });
  let loads = 0;
  const loader = async () => {
    loads++;
    await sleep(5);
    return { n: loads };
  };
  const a = await memo.get("k", loader);
  const b = await memo.get("k", loader);
  ok("a second read inside the TTL is the cached value, not a second load", a.n === 1 && b.n === 1 && loads === 1);
  clock += 999;
  ok("…still cached at TTL − 1 ms", (await memo.get("k", loader)).n === 1 && loads === 1);
  clock += 2;
  ok("past the TTL it loads again", (await memo.get("k", loader)).n === 2 && loads === 2);
  // In-flight sharing: two callers before the first resolves.
  clock += 5000;
  const [x, y] = await Promise.all([memo.get("k", loader), memo.get("k", loader)]);
  ok("two callers during one load share it — one load, one value", x === y && loads === 3, { loads });
  // A throwing loader caches nothing.
  let boom = 0;
  const bad = async () => {
    boom++;
    throw new Error("neon asleep");
  };
  let threw = false;
  try {
    await memo.get("bad", bad);
  } catch {
    threw = true;
  }
  let threw2 = false;
  try {
    await memo.get("bad", bad);
  } catch {
    threw2 = true;
  }
  ok("a loader that throws caches nothing: the next read tries again", threw && threw2 && boom === 2);
  ok("clear(key) forgets one; clear() forgets all", (memo.clear("k"), memo.size() === 0) && (memo.clear(), memo.size() === 0));
  ok("TTL_MS is sixty seconds — the number in the route's header", TTL_MS === 60_000);
  const tiny = createMemo({ ttlMs: 1000, now: () => clock, max: 2 });
  await tiny.get("a", async () => 1);
  await tiny.get("b", async () => 2);
  await tiny.get("c", async () => 3);
  ok("the memo is bounded: past `max` the oldest entry goes", tiny.size() === 2);
}

{
  const route = decomment(read("app/api/sales/queue/route.js"));
  ok("the route reads the window overrides through the memo", /queueMemo\.get\("policyContext", \(\) => loadWindowPolicyContext\(\{ now \}\)\)/.test(route));
  ok("…and the retry rules", /queueMemo\.get\("retryRules", \(\) => loadRetryRules\(\{ db \}\)\)/.test(route));
  ok("…and the available-per-trade GROUP BY, keyed by the rep's language rule", /queueMemo\.get\(`availableByTrade:\$\{langKey\}`/.test(route) && /const langKey = JSON\.stringify\(languageWhereFor\(rep\)/.test(route));
  ok("the rep's OWN rows are never read through the memo", !/queueMemo\.get\([^)]*queueWhere/.test(route) && (route.match(/queueMemo\.get\(/g) || []).length === 3);
  ok("QUEUE_SELECT carries no `_count` — the two GROUP BYs replace it", !/_count: \{ select: \{ capabilities: true, opportunities: true \} \}/.test(route) && /db\.prospectCapability\.groupBy\(\{ by: \["prospectId"\]/.test(route) && /db\.prospectOpportunity\.groupBy\(\{ by: \["prospectId"\]/.test(route));
  ok("…and puts the counts back on the row as `_count` for isResearched()", /p\._count = \{ capabilities: capsById\.get\(p\.id\) \|\| 0, opportunities: oppsById\.get\(p\.id\) \|\| 0 \}/.test(route));
  ok("the nine rep-level reads leave together", /const \[policyContext, retryRules, claimedRows, shiftStart, takenToday, adminAssigned, givenBack, mineByTrade, availableByTrade\] =\s*await Promise\.all\(/.test(route));
  ok("the log line and Server-Timing carry the phases", /timing\[label\]/.test(route) && /Server-Timing": serverTiming/.test(route) && /mark\("phase1"\)/.test(route) && /mark\("order"\)/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The client snapshot");

{
  const store = fakeStorage();
  const T0 = 1_800_000_000_000;
  const body = { rep: { id: "rep_a" }, queue: { items: [{ id: "p1" }] }, current: { id: "p1" }, batch: { max: 25, result: { claimed: 25 } }, serverNow: "x" };
  ok("snapshotKey is rep + trade", snapshotKey({ repId: "rep_a", tradeKey: "roofing" }) === "sales-queue:snapshot:rep_a:roofing" && snapshotKey({ repId: "rep_a" }) === "sales-queue:snapshot:rep_a:-" && snapshotKey({}) === null);
  ok("write: kept, and the rep pointer set", writeSnapshot(store, body, { tradeKey: "roofing", now: T0 }) === true && store.getItem(SNAPSHOT_REP_KEY) === "rep_a");
  const back = readSnapshot(store, { tradeKey: "roofing", now: T0 + 1000 });
  ok("read: the same payload, current matching", back && back.body.queue.items[0].id === "p1" && back.currentMatches === true && back.body.current.id === "p1");
  ok("…with the press's `batch.result` stripped — it described a press that did not just happen", back.body.batch.result === null && back.body.batch.max === 25);
  ok("another trade: nothing", readSnapshot(store, { tradeKey: "plumbing", now: T0 + 1000 }) === null);
  ok("the URL naming the snapshot's own row: current kept", readSnapshot(store, { tradeKey: "roofing", prospectId: "p1", now: T0 + 1000 }).currentMatches === true);
  const other = readSnapshot(store, { tradeKey: "roofing", prospectId: "p2", now: T0 + 1000 });
  ok("the URL naming a different row: the LIST comes back, the detail is nulled, and it says so", other && other.currentMatches === false && other.body.current === null && other.body.queue.items.length === 1);
  ok("aged out at SNAPSHOT_MAX_AGE_MS", readSnapshot(store, { tradeKey: "roofing", now: T0 + SNAPSHOT_MAX_AGE_MS + 1 }) === null && readSnapshot(store, { tradeKey: "roofing", now: T0 + SNAPSHOT_MAX_AGE_MS - 1 }) !== null);
  ok("a snapshot from the future is not believed", readSnapshot(store, { tradeKey: "roofing", now: T0 - 120_000 }) === null);
  // Another rep signs in on the same tab.
  writeSnapshot(store, { ...body, rep: { id: "rep_b" }, queue: { items: [] } }, { tradeKey: "plumbing", now: T0 + 2000 });
  ok("after another rep's payload the pointer moves, and rep_a's snapshot is not served", store.getItem(SNAPSHOT_REP_KEY) === "rep_b" && readSnapshot(store, { tradeKey: "roofing", now: T0 + 3000 }) === null);
  ok("…rep_b's own is", readSnapshot(store, { tradeKey: "plumbing", now: T0 + 3000 })?.body.rep.id === "rep_b");
  ok("currentRepId reads the pointer", currentRepId(store) === "rep_b" && currentRepId(null) === null);
  ok("no storage: write is false, read is null, nothing throws", writeSnapshot(null, body) === false && readSnapshot(null) === null && readSnapshot(undefined, {}) === null);
  ok("a full storage: write is false, nothing throws", writeSnapshot(fakeStorage({ quota: 10 }), body, { now: T0 }) === false);
  store.setItem("sales-queue:snapshot:rep_b:plumbing", "{not json");
  ok("garbage in storage reads as nothing", readSnapshot(store, { tradeKey: "plumbing", now: T0 + 3000 }) === null);
  ok("clearSnapshots removes every snapshot and the pointer", clearSnapshots(store) >= 2 && store.getItem(SNAPSHOT_REP_KEY) === null && [...store._map.keys()].every((k) => !k.startsWith("sales-queue:snapshot:")));
  ok("a payload without a rep is not kept", writeSnapshot(fakeStorage(), { queue: {} }, { now: T0 }) === false);
}

{
  const page = decomment(read("app/sales/queue/page.js"));
  ok("the page reads the snapshot on mount, before the first load", /const snap = readSnapshot\(store, \{ tradeKey, prospectId \}\);/.test(page) && page.indexOf("readSnapshot(store") < page.indexOf("setFetching(true);"));
  ok("…and sets the list without stamping the clock from it", /setData\(body\);\s*setLoading\(false\);\s*setFromSnapshot\(true\);/.test(page) && !/stampClock\(snap/.test(page));
  ok("every payload goes through applyPayload, which writes the snapshot and the lead", /const applyPayload = useCallback\(/.test(page) && /writeSnapshot\(store, body, \{ tradeKey \}\);/.test(page) && (page.match(/applyPayload\(body\)/g) || []).length >= 2 && !/setData\(body\);\s*\}\s*catch/.test(page));
  ok("the detail from the per-lead cache is drawn on row select, before the request", /const lead = readLead\(sessionStore\(\), \{ repId: data\?\.rep\?\.id \|\| null, prospectId: id \}\);/.test(page) && /setQuery\(\{ prospectId: id \}\);/.test(page));
  ok("the missing detail waits (detailLoading) instead of flashing the empty state", /const detailLoading = loading \|\| \(detailPending && !current\);/.test(page) && /\{!detailLoading && !current \?/.test(page) && !/\{!loading && !current \?/.test(page));
  ok("the 'refreshing…' hint is drawn while the snapshot is on screen and the request is out", /refreshing: fromSnapshot && fetching,/.test(page) && /data-queue-refreshing/.test(page) && /app\.salesQueue\.refreshing/.test(page));
  ok("the top-up never fires from a snapshot: it waits on `fetching`, which the load sets first", /if \(loading \|\| fetching \|\| busy \|\| !data \|\| !tradeKey\) return;/.test(page));
  ok("the read-ahead runs from live data only, never from a snapshot's order", /if \(fromSnapshot \|\| !data\?\.rep\?\.id\) return;/.test(page));
  ok("the queue has a loading boundary, so the route is prefetched and the transition is immediate", existsSync(join(ROOT, "app/sales/queue/loading.js")) && /app\.salesQueue\.openingConsole/.test(read("app/sales/queue/loading.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The per-lead cache and the read-ahead");

{
  const store = fakeStorage();
  const T0 = 1_800_000_000_000;
  store.setItem(SNAPSHOT_REP_KEY, "rep_a");
  ok("leadKey is rep + prospect", leadKey({ repId: "rep_a", prospectId: "p1" }) === "sales-queue:lead:rep_a:p1" && leadKey({ repId: "rep_a" }) === null);
  ok("write current", writeLead(store, { repId: "rep_a", prospectId: "p1", now: T0 }, { current: { id: "p1", brief: { talkingPoints: ["a"] } } }) === true);
  let e = readLead(store, { prospectId: "p1", now: T0 + 1 });
  ok("read: the entry, rep taken from the pointer", e && e.current.id === "p1" && e.history === null && Object.keys(e.playbook).length === 0);
  writeLead(store, { repId: "rep_a", prospectId: "p1", now: T0 + 10 }, { playbook: { default: { script: "hi" } } });
  writeLead(store, { repId: "rep_a", prospectId: "p1", now: T0 + 20 }, { history: { history: [1] } });
  writeLead(store, { repId: "rep_a", prospectId: "p1", now: T0 + 30 }, { playbook: { fr: { script: "salut" } } });
  e = readLead(store, { prospectId: "p1", now: T0 + 40 });
  ok("writes merge per field: current, both playbook languages and the history all survive", e.current.id === "p1" && e.playbook.default.script === "hi" && e.playbook.fr.script === "salut" && e.history.history[0] === 1 && e.at === T0 + 30, e);
  ok("another rep's pointer: nothing", (store.setItem(SNAPSHOT_REP_KEY, "rep_b"), readLead(store, { prospectId: "p1", now: T0 + 40 }) === null));
  store.setItem(SNAPSHOT_REP_KEY, "rep_a");
  ok("an explicit repId wins over the pointer", readLead(store, { repId: "rep_a", prospectId: "p1", now: T0 + 40 })?.current.id === "p1");
  ok("aged out at LEAD_MAX_AGE_MS", readLead(store, { prospectId: "p1", now: T0 + 30 + LEAD_MAX_AGE_MS + 1 }) === null);
  ok("a stale entry is still MERGED into (not lost) when a new field arrives", (writeLead(store, { repId: "rep_a", prospectId: "p1", now: T0 + 30 + LEAD_MAX_AGE_MS + 5 }, { history: { history: [2] } }), readLead(store, { prospectId: "p1", now: T0 + 30 + LEAD_MAX_AGE_MS + 6 })?.current.id === "p1"));
  // Bound.
  for (let i = 0; i < LEAD_MAX_ENTRIES + 5; i++) writeLead(store, { repId: "rep_a", prospectId: `q${i}`, now: T0 + 100 + i }, { current: { id: `q${i}` } });
  const index = JSON.parse(store.getItem(LEAD_INDEX_KEY));
  ok(`the index holds at most LEAD_MAX_ENTRIES (${LEAD_MAX_ENTRIES}) and the oldest are gone`, index.length === LEAD_MAX_ENTRIES && readLead(store, { prospectId: "p1", now: T0 + 200 }) === null && readLead(store, { prospectId: "q0", now: T0 + 200 }) === null && readLead(store, { prospectId: `q${LEAD_MAX_ENTRIES + 4}`, now: T0 + 200 })?.current.id === `q${LEAD_MAX_ENTRIES + 4}`);
  ok("no storage / full storage: false, nothing thrown", writeLead(null, { repId: "r", prospectId: "p" }, {}) === false && writeLead(fakeStorage({ quota: 5 }), { repId: "r", prospectId: "p", now: T0 }, { current: { id: "p" } }) === false);
}

{
  const order = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  ok(`LEAD_PREFETCH_AHEAD is ${LEAD_PREFETCH_AHEAD}`, LEAD_PREFETCH_AHEAD === 2);
  ok("the next two after the current row", prefetchTargets({ order, currentId: "b" }).join(",") === "c,d");
  ok("rows already held are skipped, so the next two UNHELD are taken", prefetchTargets({ order, currentId: "b", cached: (id) => id === "c" }).join(",") === "d,e");
  ok("no current: the head of the order", prefetchTargets({ order }).join(",") === "a,b");
  ok("at the end of the list: fewer, never a wrap", prefetchTargets({ order, currentId: "e" }).length === 0 && prefetchTargets({ order, currentId: "d" }).join(",") === "e");
  ok("a current not in the order (filtered out by a zone chip): the head", prefetchTargets({ order, currentId: "zz" }).join(",") === "a,b");
  ok("plain ids work too", prefetchTargets({ order: ["x", "y"], currentId: "x" }).join(",") === "y");
}

{
  const page = decomment(read("app/sales/queue/page.js"));
  ok("the read-ahead asks `?only=current`, then the playbook, then the history — one row at a time", /only=current/.test(page) && /\/api\/sales\/playbook\?prospectId=/.test(page) && /\/api\/sales\/calls\/history\?/.test(page) && /for \(const id of targets\)/.test(page));
  ok("…and only while the tab is visible", /document\.visibilityState === "hidden"\) return;/.test(page));
  const route = decomment(read("app/api/sales/queue/route.js"));
  ok("the route answers `only=current` through readCurrentFull + buildCurrent — the same builder as the full response", /url\.searchParams\.get\("only"\) === "current" && prospectId/.test(route) && (route.match(/await buildCurrent\(\{ rep, full, zone, lang, now, policyContext, retryRules \}\)/g) || []).length === 2);
  ok("…scoped through queueWhere like every read of a row", /function readCurrentFull\(rep, id, now\) \{\s*return db\.prospect\.findFirst\(\{\s*where: \{ id, \.\.\.queueWhere\(rep\.id, \{ now \}\) \}/.test(route));
  const playbook = decomment(read("app/components/sales/PlaybookMount.js"));
  ok("PlaybookMount draws the cached script first and still re-reads", /const cachedDefault = cachedEntry\?\.playbook\?\.default \|\| null;/.test(playbook) && /setPlaybookLoading\(!cachedDefault\);/.test(playbook) && /const first = await fetchJson\(playbookUrl\(null\)\);/.test(playbook));
  ok("…and files what it fetched under the lead, per language", /writeLead\(store, \{ repId, prospectId: scriptProspectId \}, \{ playbook: \{ \[language \|\| "default"\]: body \} \}\)/.test(playbook));
  const history = decomment(read("app/components/sales/CallHistory.js"));
  ok("useCallHistory draws the cached history first and still re-reads", /const cached = prospectId \? readLead\(store, \{ prospectId \}\)\?\.history \|\| null : null;/.test(history) && /if \(cached\) setData\(cached\);/.test(history) && /writeLead\(store, \{ repId, prospectId \}, \{ history: body \}\)/.test(history));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The given-back strip");

{
  ok("the automatic reasons are exactly the release reasons minus the rep's own two", GIVEN_BACK_REASONS.every((r) => RELEASE_REASONS.includes(r)) && !GIVEN_BACK_REASONS.includes("rep") && !GIVEN_BACK_REASONS.includes("rest") && GIVEN_BACK_REASONS.length === RELEASE_REASONS.length - 2, GIVEN_BACK_REASONS);
  const at = (iso) => new Date(iso);
  const rows = [
    { releasedAt: at("2026-09-17T19:05:33.300Z"), releaseReason: "day_end", prospect: { businessName: "Zed Roofing" } },
    { releasedAt: at("2026-09-17T19:05:33.100Z"), releaseReason: "day_end", prospect: { businessName: "alpha roofing" } },
    { releasedAt: at("2026-09-17T19:05:33.200Z"), releaseReason: "day_end", prospect: { businessName: "Zed Roofing" } }, // a duplicate name — two rows, one name
    { releasedAt: at("2026-09-17T19:05:34.000Z"), releaseReason: "lapsed", prospect: { businessName: "Beta Plumbing" } },
    { releasedAt: at("2026-09-17T20:05:00.000Z"), releaseReason: "closed", prospect: { businessName: "Gamma Ltd" } },
    { releasedAt: at("2026-09-17T18:00:00.000Z"), releaseReason: "rest", prospect: { businessName: "Not shown" } },
    { releasedAt: at("2026-09-17T18:00:00.000Z"), releaseReason: "rep", prospect: { businessName: "Not shown either" } },
    { releasedAt: "garbage", releaseReason: "day_end", prospect: { businessName: "No date" } },
    { releasedAt: at("2026-09-17T20:06:00.000Z"), releaseReason: "admin", prospect: null },
  ];
  const events = groupGivenBack(rows, { repZone: "Asia/Karachi", language: "en", now: at("2026-09-17T20:10:00Z") });
  ok("one event per (reason, minute), newest first", events.map((e) => `${e.reason}@${e.at}`).join(" ") === "admin@2026-09-17T20:06:00.000Z closed@2026-09-17T20:05:00.000Z lapsed@2026-09-17T19:05:00.000Z day_end@2026-09-17T19:05:00.000Z", events.map((e) => `${e.reason}@${e.at}`));
  const dayEnd = events.find((e) => e.reason === "day_end");
  ok("the sweep's three rows are one event of count 3 with two names, A→Z, case-folded", dayEnd.count === 3 && dayEnd.names.join("|") === "alpha roofing|Zed Roofing", dayEnd);
  ok("the rep's own presses (rep, rest) are not in the strip", !events.some((e) => e.reason === "rep" || e.reason === "rest"));
  ok("a row with no usable date is dropped, not crashed on", !events.some((e) => e.names.includes("No date")));
  ok("a row whose prospect is gone still counts, nameless", events.find((e) => e.reason === "admin").count === 1 && events.find((e) => e.reason === "admin").names.length === 0);
  ok("the time is on the rep's clock: 00:05 in Karachi for 19:05 UTC", /00:05|12:05/.test(dayEnd.atLocal), dayEnd.atLocal);
  ok("…with the zone named", typeof dayEnd.zone === "string" && dayEnd.zone.length > 0, dayEnd.zone);
  ok("every event carries the catalogue key for its reason", events.every((e) => e.whyKey === GIVEN_BACK_WHY_KEYS[e.reason]));
  ok("no rows: no events, no throw", groupGivenBack([]).length === 0 && groupGivenBack(null).length === 0);

  // "Today" starts at the rep's local midnight.
  const since = givenBackSince({ repZone: "America/Toronto", now: at("2026-09-17T14:00:00Z") }); // 10:00 EDT
  ok("today starts at the rep's local midnight: 04:00 UTC for Toronto", since.toISOString() === "2026-09-17T04:00:00.000Z", since);
  const fallback = givenBackSince({ repZone: "Mars/Olympus", now: at("2026-09-17T14:00:00Z") });
  ok("an unusable zone: the last 24 hours", fallback.toISOString() === "2026-09-16T14:00:00.000Z", fallback);

  // The loader, against a scripted db.
  const seen = [];
  const db = {
    salesQueueClaim: {
      async findMany(args) {
        seen.push(args);
        return rows.slice(0, 2);
      },
    },
  };
  const loaded = await loadGivenBack({ db, rep: { id: "rep_a" }, repZone: "Asia/Karachi", now: at("2026-09-17T20:10:00Z") });
  ok("loadGivenBack reads THIS rep's automatic releases since the local midnight, capped", seen[0].where.salesRepId === "rep_a" && seen[0].where.releaseReason.in.join() === GIVEN_BACK_REASONS.join() && seen[0].where.releasedAt.gte instanceof Date && seen[0].take === 400 && loaded.events.length === 1 && loaded.readError === null, seen[0]);
  const broken = await loadGivenBack({ db: { salesQueueClaim: { findMany: async () => { throw new Error("P1001"); } } }, rep: { id: "rep_a" }, now: at("2026-09-17T20:10:00Z") });
  ok("a failed read is an empty list WITH readError — absence, not a claim of nothing", broken.events.length === 0 && broken.readError === "P1001");
  ok("no db: empty, no throw", (await loadGivenBack({ rep: { id: "x" } })).events.length === 0);
}

{
  const route = decomment(read("app/api/sales/queue/route.js"));
  ok("the route carries `givenBack` in every response", /loadGivenBack\(\{ db, rep, repZone: zone, language: lang, now \}\)/.test(route) && /^\s*givenBack,$/m.test(route));
  const page = decomment(read("app/sales/queue/page.js"));
  ok("the strip is drawn above the list from the server's events, with the names behind a disclosure", /function GivenBackStrip\(\{ t, givenBack \}\)/.test(page) && /data-given-back-event=\{e\.reason\}/.test(page) && /<details/.test(page) && /e\.names\.join\(" · "\)/.test(page) && /<GivenBackStrip t=\{t\} givenBack=\{givenBack\} \/>/.test(page));
  ok("…and says when the log could not be read, rather than nothing", /givenBack\.readError \?/.test(page) && /app\.salesQueue\.givenBack\.unreadable/.test(page));
  ok("…every sentence is a catalogue key: the reason key rides on the event", /why: e\.whyKey \? t\(e\.whyKey\) : e\.reason/.test(page));
  const keys = ["app.salesQueue.refreshing", "app.salesQueue.givenBack.title", "app.salesQueue.givenBack.line", "app.salesQueue.givenBack.note", "app.salesQueue.givenBack.unreadable", ...Object.values(GIVEN_BACK_WHY_KEYS)];
  const langs = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  for (const lang of langs) {
    const missing = keys.filter((k) => typeof APP_MESSAGES[lang]?.[k] !== "string" || !APP_MESSAGES[lang][k].trim());
    ok(`${lang}: every strip key has a sentence`, missing.length === 0, missing);
  }
  ok("the line names its four parameters in every language", langs.every((l) => ["{count}", "{time}", "{zone}", "{why}"].every((p) => APP_MESSAGES[l]["app.salesQueue.givenBack.line"].includes(p))));
  const cron = decomment(read("app/api/cron/sales-queue-release/route.js"));
  ok("the cron still calls releaseDayEnded and returns its counts (onShift included)", /releaseDayEnded\(\{/.test(cron) && /\.\.\.counts/.test(cron));
}

const pkg = JSON.parse(read("package.json"));
ok("check:queue-cache exists", typeof pkg.scripts["check:queue-cache"] === "string");
ok("…and check:all runs it", /npm run check:queue-cache\b/.test(pkg.scripts["check:all"]));

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  failures.length === 0
    ? `\nALL PASS — ${pass} checks`
    : `\n${pass} passed, ${failures.length} FAILED\n` + failures.map((f) => `  ✗ ${f}`).join("\n"),
);
process.exit(failures.length ? 1 : 0);
