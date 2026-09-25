// scripts/check-offline-invoicing.mjs
//
//   npm run check:offline-invoicing
//
// Executes the offline layer and the clocked-hours line against hostile
// input, and proves the three properties the mockup's note promised:
//
//   1. the queue replay is idempotent — a replay that reaches the server
//      twice creates one record (lib/offline/idempotency.js), and the
//      phone-side replay (lib/offline/queue.js) never posts a synced item
//      again;
//   2. the labour line is priced by the server — buildLabourLine takes a
//      rate the server resolved from a key, refuses a $0 line, skips open,
//      billed and rejected entries;
//   3. the browser never sends amounts for it — invoiceBodyFrom and
//      labourRequestFrom carry ids and a key, and the invoice route reads
//      no amount off the labour block.
//
// Plus the punch moment (a queued punch keeps its tap time, an online punch
// cannot back-date) and the queued-punch override the clock draws from.

import { readFileSync } from "node:fs";
import {
  partitionBillable, sumHours, hoursByWorker, buildLabourLine, retotal, labourRequestFrom,
} from "../lib/invoices/labourLine.js";
import { labourRateOptionsFrom, resolveLabourRateFrom, isHourUnit } from "../lib/invoices/labourRates.js";
import {
  mintKey, summarise, orderForReplay, classifyResponse, makeItem, replayQueue, invoiceBodyFrom, isNetworkFailure,
} from "../lib/offline/queue.js";
import { memoryStore } from "../lib/offline/store.js";
import { withOfflineKey, validOfflineKey, readOfflineKey } from "../lib/offline/idempotency.js";
import { punchMoment, MAX_REPLAY_AGE_MS } from "../lib/offline/punchMoment.js";
import { queuedPunchState } from "../lib/offline/punchState.js";

let failures = 0;
let passes = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

// ── 1. The labour line ────────────────────────────────────────────────────
section("1. Clocked hours → a line the server prices");
{
  const entries = [
    { id: "a", clockIn: "2026-09-23T08:00:00Z", clockOut: "2026-09-23T12:00:00Z", hours: "4.0", status: "pending", billedInvoiceId: null, worker: { name: "Marco" } },
    { id: "b", clockIn: "2026-09-23T12:30:00Z", clockOut: "2026-09-23T15:00:00Z", hours: 2.5, status: "approved", billedInvoiceId: null, worker: { name: "Dani" } },
    { id: "open", clockIn: "2026-09-23T15:00:00Z", clockOut: null, hours: null, status: "pending", billedInvoiceId: null, worker: { name: "Marco" } },
    { id: "billed", clockIn: "2026-09-22T08:00:00Z", clockOut: "2026-09-22T16:00:00Z", hours: 8, status: "approved", billedInvoiceId: "inv_old", worker: { name: "Dani" } },
    { id: "rej", clockIn: "2026-09-22T08:00:00Z", clockOut: "2026-09-22T09:00:00Z", hours: 1, status: "rejected", billedInvoiceId: null, worker: { name: "Dani" } },
    { id: "neg", clockIn: "2026-09-22T08:00:00Z", clockOut: "2026-09-22T09:00:00Z", hours: -3, status: "approved", billedInvoiceId: null },
    { id: "nan", clockIn: "2026-09-22T08:00:00Z", clockOut: "2026-09-22T09:00:00Z", hours: "abc", status: "approved", billedInvoiceId: null },
    null, undefined, 42, { id: 7 },
  ];
  const { billable, skipped } = partitionBillable(entries);
  ok("only the two closed, unbilled, positive entries are billable", billable.map((e) => e.id).join() === "a,b");
  ok("open, billed, rejected, negative and NaN entries are skipped with a reason", skipped.length === 5 && skipped.every((s) => s.reason));
  ok("sumHours is 6.5", sumHours(entries) === 6.5);
  ok("hoursByWorker groups by name", JSON.stringify(hoursByWorker(entries)) === JSON.stringify([{ name: "Marco", hours: 4 }, { name: "Dani", hours: 2.5 }]));

  const line = buildLabourLine({ entries, rate: 85, rateKey: "company", label: "Labour" });
  ok("the line is 'Labour — 6.5 h × 85' for 552.50", line && line.description === "Labour — 6.5 h × 85" && line.amount === 552.5 && line.quantity === 6.5 && line.unit === "hour");
  ok("the line records the ids it bills and the rate key", line.labour.timeEntryIds.join() === "a,b" && line.labour.rateKey === "company" && line.labour.hours === 6.5);
  ok("no rate → no line (never a $0 row)", buildLabourLine({ entries, rate: 0, rateKey: "company" }) === null && buildLabourLine({ entries, rate: "x", rateKey: "company" }) === null && buildLabourLine({ entries, rate: -5, rateKey: "company" }) === null);
  ok("nothing billable → no line", buildLabourLine({ entries: [entries[2], entries[3]], rate: 85, rateKey: "company" }) === null);
  ok("garbage entries → no line", buildLabourLine({ entries: "nope", rate: 85, rateKey: "company" }) === null);
  ok("float hours are rounded, not accumulated", buildLabourLine({ entries: [{ id: "x", clockOut: "z", hours: 0.1 }, { id: "y", clockOut: "z", hours: 0.2 }], rate: 3, rateKey: "company" }).amount === 0.9);

  const money = retotal({ lineItems: [line, { amount: 340 }, { amount: "bad" }], discount: 0, taxEnabled: true, taxRatePct: 13 });
  ok("retotal derives subtotal, tax and total from the lines", money.subtotal === 892.5 && money.tax === 116.03 && money.total === 1008.53);
  ok("retotal: tax off → 0; negative discount ignored; NaN pct → 0 tax", retotal({ lineItems: [line], taxEnabled: false, taxRatePct: 13 }).tax === 0 && retotal({ lineItems: [line], discount: -50, taxRatePct: 0 }).total === 552.5 && retotal({ lineItems: [line], taxRatePct: "x" }).tax === 0);

  ok("labourRequestFrom keeps ids and a key only", JSON.stringify(labourRequestFrom({ timeEntryIds: ["a", "b", "a", 5, ""], rateKey: "category:abc", amount: 999, rate: 1 })) === JSON.stringify({ timeEntryIds: ["a", "b"], rateKey: "category:abc" }));
  ok("labourRequestFrom refuses a bad key or no ids", labourRequestFrom({ timeEntryIds: ["a"], rateKey: "../../etc" }) === null && labourRequestFrom({ timeEntryIds: [], rateKey: "company" }) === null && labourRequestFrom({ timeEntryIds: ["a"], rateKey: "company:x:y" }) === null);
}

// ── 2. Rate keys resolve on the server ────────────────────────────────────
section("2. Rate keys → the company's own rows");
{
  const options = labourRateOptionsFrom({
    company: { labourSellRate: "85.00" },
    categories: [
      { id: "cat1", defaultRate: 95, unit: "hour", enabled: true, category: { name: "Plumbing", key: "plumbing" } },
      { id: "cat2", defaultRate: 12, unit: "sq ft", enabled: true, category: { name: "Painting" } },
      { id: "cat3", defaultRate: 70, unit: "Hourly", enabled: false, category: { name: "Off" } },
      { id: "cat4", defaultRate: null, unit: "hr", enabled: true, category: { name: "No rate" } },
      { id: "cat5", defaultRate: 60, unit: "  HOURS ", enabled: true, category: { name: "Carpentry" } },
    ],
  });
  ok("company rate and hour-priced, enabled, rated categories are offered", options.map((o) => o.key).join() === "company,category:cat1,category:cat5");
  ok("resolve returns the server's figure for a known key", resolveLabourRateFrom(options, "category:cat1") === 95 && resolveLabourRateFrom(options, "company") === 85);
  ok("resolve returns null — never a default — for an unknown or tampered key", resolveLabourRateFrom(options, "category:cat2") === null && resolveLabourRateFrom(options, "company:99") === null && resolveLabourRateFrom(options, 85) === null);
  ok("no company rate → no company option", labourRateOptionsFrom({ company: { labourSellRate: null }, categories: [] }).length === 0);
  ok("isHourUnit accepts the spellings, refuses the rest", isHourUnit("hour") && isHourUnit("Hrs") && !isHourUnit("sq ft") && !isHourUnit(null));
}

// ── 3. The queue, replayed twice ──────────────────────────────────────────
section("3. Replay: ordered, once, server wins");
{
  ok("summarise counts kinds and ignores photos in the bar total", JSON.stringify(summarise([
    makeItem("invoice", {}), makeItem("invoice", {}), makeItem("timesheet", {}), makeItem("photo", {}),
    { ...makeItem("invoice", {}), status: "synced" }, { ...makeItem("timesheet", {}), status: "failed" }, { kind: "bogus", status: "queued" }, null,
  ])) === JSON.stringify({ invoices: 2, timesheets: 1, photos: 1, failed: 1, synced: 1, total: 3 }));
  const ordered = orderForReplay([
    makeItem("invoice", {}, { key: "i1", now: 1 }), makeItem("photo", {}, { key: "p1", now: 2 }),
    makeItem("timesheet", { action: "out" }, { key: "t2", now: 3 }), makeItem("timesheet", { action: "in" }, { key: "t1", now: 0 }),
    { ...makeItem("timesheet", {}, { key: "done" }), status: "synced" },
  ]);
  ok("punches first in tap order, then photos, then invoices; synced items never replay", ordered.map((i) => i.key).join() === "t1,t2,p1,i1");
  ok("classifyResponse: 2xx ok, 4xx refused, 5xx/429 retry", classifyResponse(201) === "ok" && classifyResponse(409) === "refused" && classifyResponse(422) === "refused" && classifyResponse(503) === "retry" && classifyResponse(429) === "retry");
  ok("mintKey passes the server's validator", validOfflineKey(mintKey()) && !validOfflineKey("short") && !validOfflineKey("has space here!"));
  ok("isNetworkFailure recognises a thrown fetch", isNetworkFailure(new TypeError("Failed to fetch")) && !isNetworkFailure(new Error("x")));

  // A fake server with the real idempotency helper on top of a tiny fake db.
  const ledger = new Map();
  const invoices = [];
  const fakeDb = {
    offlineSyncItem: {
      findUnique: async ({ where }) => ledger.get(where.companyId_clientKey.clientKey) || null,
      create: async ({ data }) => {
        if (ledger.has(data.clientKey)) {
          const err = new Error("unique");
          err.code = "P2002";
          throw err;
        }
        ledger.set(data.clientKey, data);
        return data;
      },
      upsert: async ({ where, create }) => {
        if (!ledger.has(where.companyId_clientKey.clientKey)) ledger.set(where.companyId_clientKey.clientKey, create);
      },
    },
    $transaction: async (fn) => fn(fakeDb),
  };
  const server = async (key, body) => {
    const out = await withOfflineKey({ db: fakeDb, companyId: "c1", memberId: "m1", key, kind: "invoice" }, async () => {
      const inv = { id: `inv_${invoices.length + 1}`, ...body };
      invoices.push(inv);
      return { entityId: inv.id, result: inv };
    });
    return out;
  };
  const first = await server("qAAAAAAAAAAAAAAAAAAAAAAA", { clientId: "cl1" });
  const second = await server("qAAAAAAAAAAAAAAAAAAAAAAA", { clientId: "cl1" });
  ok("withOfflineKey: the second replay of a key writes nothing and answers the first id", invoices.length === 1 && !first.replayed && second.replayed && second.entityId === "inv_1");
  const plain = await server(null, { clientId: "cl2" });
  ok("no key → an ordinary write every time", invoices.length === 2 && !plain.replayed);
  ok("readOfflineKey reads only a valid header", readOfflineKey({ headers: new Map([["x-offline-key", "qBBBBBBBBBBBBBBBBBBBBBBB"]]) }) === "qBBBBBBBBBBBBBBBBBBBBBBB" && readOfflineKey({ headers: new Map([["x-offline-key", "no good"]]) }) === null && readOfflineKey({}) === null);

  // The phone side, against a fake fetch that routes to the fake server.
  const calls = [];
  const fetchOnce = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", key: init.headers?.["X-Offline-Key"] || null });
    // The photo goes through lib/media/uploadClient.js: sign, the bytes to
    // Cloudinary, verify. Each leg is answered the way the real one answers.
    if (url === "/api/upload/sign") return { status: 200, json: async () => ({ uploadUrl: "https://api.cloudinary.com/v1_1/x/image/upload", fields: { public_id: "pid", signature: "s" }, kind: "photo", resourceType: "image" }) };
    if (url === "https://api.cloudinary.com/v1_1/x/image/upload") return { status: 200, json: async () => ({ public_id: "pid", version: 1, signature: "a".repeat(40), resource_type: "image" }) };
    if (url === "/api/upload/verify") return { status: 200, json: async () => ({ url: "https://res.cloudinary.com/x/photo.jpg", kind: "photo", publicId: "pid" }) };
    if (url === "/api/time-clock") {
      const body = JSON.parse(init.body);
      if (body.action === "out" && body.at === "bad") return { status: 409, json: async () => ({ error: "out of order" }) };
      return { status: 200, json: async () => ({ ok: true, open: { id: "te_1" } }) };
    }
    if (url === "/api/invoices") {
      const body = JSON.parse(init.body);
      // Asserted for the full invoice only; the later "lost response" case
      // posts a bare one.
      if (body.labour) {
        ok("the replayed invoice body carries no subtotal/tax/total and the labour block no amount", !("subtotal" in body) && !("tax" in body) && !("total" in body) && body.offline === true && !("amount" in body.labour) && !("rate" in body.labour) && Object.keys(body.labour).join() === "timeEntryIds,rateKey");
        ok("the queued photo's uploaded URL rides on the invoice", body.clientPhotos.some((p) => p.url === "https://res.cloudinary.com/x/photo.jpg"));
      }
      const out = await server(init.headers["X-Offline-Key"], body);
      return { status: out.replayed ? 200 : 201, json: async () => ({ id: out.entityId }) };
    }
    if (/\/api\/invoices\/inv_\d+\/send$/.test(url)) return { status: 200, json: async () => ({ ok: true }) };
    throw new Error("unexpected " + url);
  };

  const store = memoryStore();
  const photo = makeItem("photo", { blob: new Blob(["x"]), name: "wall.jpg" }, { key: "qPHOTOPHOTOPHOTOPHOTOPHO", now: 1 });
  await store.put(makeItem("timesheet", { action: "in", jobId: "j1", at: "2026-09-23T12:00:00Z" }, { key: "qPUNCH1PUNCH1PUNCH1PUNCH", now: 0 }));
  await store.put(photo);
  await store.put(makeItem("invoice", {
    clientId: "cl1", jobId: "j1", lineItems: [{ description: "Accent wall", quantity: 1, rate: 340, amount: 340 }],
    labour: { timeEntryIds: ["a", "b"], rateKey: "company", amount: 9999 }, taxEnabled: true, send: true, photoKeys: [photo.key],
  }, { key: "qINVOICEINVOICEINVOICEIN", now: 2 }));

  const r1 = await replayQueue({ store, fetch: fetchOnce, now: 10 });
  ok("first pass: punch, photo and invoice all synced", r1.synced.length === 3 && r1.failed.length === 0 && !r1.stoppedOffline);
  const invoiceItem = await store.get("qINVOICEINVOICEINVOICEIN");
  ok("the invoice item now carries the server's id", invoiceItem.status === "synced" && invoiceItem.serverId === "inv_3");
  const before = invoices.length;
  const r2 = await replayQueue({ store, fetch: fetchOnce, now: 20 });
  ok("second pass: nothing replays, nothing is created", r2.synced.length === 0 && invoices.length === before && !calls.slice(-1)[0] === false);
  ok("the send was posted once", calls.filter((c) => /send$/.test(c.url)).length === 1);

  // A lost response: the item is still queued, the server already wrote it.
  const store2 = memoryStore();
  await store2.put(makeItem("invoice", { clientId: "cl1", lineItems: [], taxEnabled: true, send: false, photoKeys: [] }, { key: "qLOSTLOSTLOSTLOSTLOSTLOS", now: 0 }));
  await server("qLOSTLOSTLOSTLOSTLOSTLOS", { clientId: "cl1" });
  const n = invoices.length;
  const r3 = await replayQueue({ store: store2, fetch: fetchOnce, now: 30 });
  ok("a replay after a lost response is answered from the ledger — same id, no new invoice", r3.synced.length === 1 && invoices.length === n && r3.synced[0].serverId === `inv_${n}`);

  // Offline mid-replay: stop, leave the rest queued.
  const store3 = memoryStore();
  await store3.put(makeItem("timesheet", { action: "in", at: "2026-09-23T12:00:00Z" }, { key: "qOFF1OFF1OFF1OFF1OFF1OFF", now: 0 }));
  await store3.put(makeItem("invoice", { clientId: "cl1", lineItems: [], photoKeys: [] }, { key: "qOFF2OFF2OFF2OFF2OFF2OFF", now: 1 }));
  const r4 = await replayQueue({ store: store3, fetch: async () => { throw new TypeError("Failed to fetch"); }, now: 40 });
  ok("no signal → stoppedOffline, everything still queued", r4.stoppedOffline && (await store3.list()).every((i) => i.status === "queued"));

  // A refusal: needs attention, not retried forever.
  const store4 = memoryStore();
  await store4.put(makeItem("timesheet", { action: "out", at: "bad" }, { key: "qBADBADBADBADBADBADBADBA", now: 0 }));
  const r5 = await replayQueue({ store: store4, fetch: fetchOnce, now: 50 });
  ok("a 409 marks the item failed with the server's sentence", r5.failed.length === 1 && r5.failed[0].error === "out of order" && (await store4.get("qBADBADBADBADBADBADBADBA")).status === "failed");
  const r6 = await replayQueue({ store: store4, fetch: fetchOnce, now: 60 });
  ok("a failed item does not replay on its own", r6.synced.length === 0 && r6.failed.length === 0);

  ok("invoiceBodyFrom never emits money totals", (() => { const b = invoiceBodyFrom({ clientId: "c", lineItems: [{ amount: 5 }], labour: { timeEntryIds: ["a"], rateKey: "company" } }, []); return !("subtotal" in b) && !("tax" in b) && !("total" in b) && !("amount" in b.labour); })());
}

// ── 4. The punch moment and the clock's override ──────────────────────────
section("4. Replayed punches keep their tap time; online punches cannot back-date");
{
  const now = new Date("2026-09-23T15:00:00Z");
  ok("online: `at` is ignored, now wins", punchMoment({ at: "2026-09-01T08:00:00Z", offlineKey: null, now }).at === now);
  ok("replay: the tap time is honoured", punchMoment({ at: "2026-09-23T08:00:00Z", offlineKey: "k", now }).at.toISOString() === "2026-09-23T08:00:00.000Z");
  ok("replay: a future punch is refused", Boolean(punchMoment({ at: "2026-09-24T08:00:00Z", offlineKey: "k", now }).error));
  ok("replay: a punch older than the window is refused", Boolean(punchMoment({ at: new Date(now.getTime() - MAX_REPLAY_AGE_MS - 1000).toISOString(), offlineKey: "k", now }).error));
  ok("replay: garbage is refused", Boolean(punchMoment({ at: "yesterday-ish", offlineKey: "k", now }).error));
  ok("replay: no `at` → now", punchMoment({ offlineKey: "k", now }).at === now);

  const serverOpen = { id: "te_9", clockIn: "2026-09-23T07:58:00Z" };
  ok("no queued punch → the server's answer", queuedPunchState([], serverOpen).open === serverOpen);
  const qIn = [makeItem("timesheet", { action: "in", at: "2026-09-23T13:00:00Z", jobId: "j1", jobTitle: "Angelos" }, { now: 5 })];
  const s1 = queuedPunchState(qIn, null);
  ok("a queued 'in' shows on the clock since the tap, pending", s1.pending && s1.open?.queued && s1.open.clockIn === "2026-09-23T13:00:00Z" && s1.open.job.title === "Angelos");
  const qOut = [...qIn, makeItem("timesheet", { action: "out", at: "2026-09-23T16:00:00Z" }, { now: 6 })];
  ok("a queued 'out' after it shows clocked out", queuedPunchState(qOut, serverOpen).open === null);
  ok("synced and failed punches do not override", queuedPunchState(qIn.map((i) => ({ ...i, status: "synced" })), serverOpen).open === serverOpen);
}

// ── 5. The route and the worker read the source ──────────────────────────
section("5. Wiring");
{
  const route = readFileSync(new URL("../app/api/invoices/route.js", import.meta.url), "utf8");
  ok("POST /api/invoices wraps the create in withOfflineKey and stamps billedInvoiceId in the same transaction", route.includes("withOfflineKey(") && route.includes("billedInvoiceId: created.id"));
  ok("POST /api/invoices prices labour from resolveLabourRate, never from the body", route.includes("resolveLabourRate(db, member.companyId, labourRequest.rateKey)") && !/labour\.(amount|rate)\b/.test(route));
  ok("POST /api/invoices re-derives totals when it added a line or the body came from the queue", route.includes("retotal({ lineItems, discount, taxEnabled"));
  const clock = readFileSync(new URL("../app/api/time-clock/route.js", import.meta.url), "utf8");
  ok("POST /api/time-clock reads the moment through punchMoment and the key through readOfflineKey", clock.includes("punchMoment({ at: body?.at, offlineKey") && clock.includes("readOfflineKey(request)"));
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  ok("sw.js intercepts GET only, same origin, network first, and honours the off switch", sw.includes('request.method !== "GET"') && sw.includes("url.origin !== self.location.origin") && sw.includes("async function networkFirst") && sw.includes("fq:offline-config"));
  ok("sw.js never caches a non-200 or opaque response", sw.includes('res.status === 200 && res.type !== "opaque"'));
  ok("sw.js posts fq:sync on Background Sync rather than replaying itself", sw.includes('event.tag !== "fq-offline-queue"') && sw.includes('type: "fq:sync"') && !sw.includes("indexedDB"));
  const shell = readFileSync(new URL("../app/components/offline/OfflineShell.js", import.meta.url), "utf8");
  ok("the shell hands the company switch to the worker on every load", shell.includes('type: "fq:offline-config", enabled: Boolean(enabled)'));
  const layout = readFileSync(new URL("../app/app/layout.js", import.meta.url), "utf8");
  ok("the app layout reads Company.offlineCachingEnabled and mounts the shell with it", layout.includes("offlineCachingEnabled: true") && layout.includes("<OfflineShell enabled={company?.offlineCachingEnabled !== false}>"));
  const settings = readFileSync(new URL("../app/api/settings/field-work/route.js", import.meta.url), "utf8");
  ok("the setting is written by the field-work route", settings.includes("data.offlineCachingEnabled = body.offlineCachingEnabled") && settings.includes("data.labourSellRate"));
  const offer = readFileSync(new URL("../app/api/invoices/labour-line/route.js", import.meta.url), "utf8");
  ok("the offer route reads billedInvoiceId so an hour is never offered twice", offer.includes("billedInvoiceId: true") && offer.includes("partitionBillable"));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
