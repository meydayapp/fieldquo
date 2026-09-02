#!/usr/bin/env node
//
// scripts/check-sales-payouts.mjs
//
// The week boundary and the batch total, executed rather than reasoned about.
//
// Both are places where being one instant or one reversal out means a rep is
// paid twice or not at all, and neither failure is visible by reading.
import { readFileSync } from "node:fs";
import {
  weekBounds,
  previousWeekBounds,
  entriesForWindow,
  batchTotalCents,
} from "../lib/sales/payouts.js";

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failures.push(name + (detail ? ` — ${detail}` : "")); console.log("  ✗ " + name + (detail ? ` — ${detail}` : "")); }
}
const iso = (d) => d.toISOString();

console.log("\nThe week is Monday to Monday, in UTC");
// 2026-09-02 is a Wednesday.
const wed = new Date("2026-09-02T14:00:00Z");
const w = weekBounds(wed);
ok("the week starts Monday", iso(w.start) === "2026-08-31T00:00:00.000Z", iso(w.start));
ok("and ends the following Monday", iso(w.end) === "2026-09-07T00:00:00.000Z", iso(w.end));

// The case that breaks a naive Sunday-based week: a Sunday belongs to the week
// that STARTED the previous Monday, not to the one about to begin.
const sun = new Date("2026-09-06T23:59:59Z");
ok(
  "a Sunday night belongs to the week that began Monday",
  iso(weekBounds(sun).start) === "2026-08-31T00:00:00.000Z",
  iso(weekBounds(sun).start),
);
const mon = new Date("2026-09-07T00:00:00Z");
ok(
  "and the very next instant starts a new week",
  iso(weekBounds(mon).start) === "2026-09-07T00:00:00.000Z",
  iso(weekBounds(mon).start),
);

const prev = previousWeekBounds(wed);
ok("the closable week is the one before", iso(prev.start) === "2026-08-24T00:00:00.000Z", iso(prev.start));
ok("and it ends where this week began", iso(prev.end) === iso(w.start));
ok("the closable week is exactly seven days", (prev.end - prev.start) / 86400000 === 7);

console.log("\nWhich entries belong in the batch");
const start = new Date("2026-08-24T00:00:00Z");
const end = new Date("2026-08-31T00:00:00Z");
const rows = [
  { id: "a", amountCents: 2000, occurredAt: new Date("2026-08-24T00:00:00Z") }, // exactly start
  { id: "b", amountCents: 4000, occurredAt: new Date("2026-08-27T12:00:00Z") },
  { id: "c", amountCents: 6500, occurredAt: new Date("2026-08-31T00:00:00Z") }, // exactly end
  { id: "d", amountCents: 2000, occurredAt: new Date("2026-08-20T00:00:00Z") }, // before
  { id: "e", amountCents: 2000, occurredAt: new Date("2026-08-26T00:00:00Z"), payoutBatchId: "old" },
];
const picked = entriesForWindow(rows, start, end);
const ids = picked.map((e) => e.id).join(",");
// Half-open [start, end). An entry at exactly `end` belongs to the NEXT week —
// inclusive on both sides puts one entry in two batches and pays it twice.
ok("an entry at exactly the start instant is IN", ids.includes("a"), ids);
ok("an entry at exactly the end instant is OUT", !ids.includes("c"), ids);
ok("an earlier week is out", !ids.includes("d"), ids);
ok("an entry already in another batch is out", !ids.includes("e"), ids);
ok("only the right two are picked", ids === "a,b", ids);
ok("a malformed date is skipped, not thrown on", entriesForWindow([{ id: "x", occurredAt: "nonsense" }], start, end).length === 0);
ok("nonsense input yields nothing", entriesForWindow(null, start, end).length === 0);

console.log("\nWhat the batch is worth");
ok("earnings sum", batchTotalCents(picked) === 6000, String(batchTotalCents(picked)));
// A reversal is a negative row and needs no special case anywhere.
ok(
  "a reversal reduces the batch",
  batchTotalCents([{ amountCents: 6500 }, { amountCents: -6500 }]) === 0,
);
// A week whose reversals outweigh its earnings nets negative, and the batch is
// still created — the debt is real and carries into the next payout.
ok(
  "a week can net negative",
  batchTotalCents([{ amountCents: 2000 }, { amountCents: -6500 }]) === -4500,
);

console.log("\nHow the closer behaves");
const src = readFileSync("lib/sales/payouts.js", "utf8");
function fnBody(source, name) {
  const m = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`).exec(source);
  if (!m) return null;
  const next = source.indexOf("\nexport ", m.index + m[0].length);
  return source.slice(m.index, next === -1 ? source.length : next);
}
const close = fnBody(src, "closeWeekForRep");
ok("closeWeekForRep exists to check", close !== null);
ok(
  "entries are claimed only if still unclaimed",
  /updateMany\([\s\S]{0,300}payoutBatchId: null/.test(close || ""),
);
ok(
  "and a short claim rolls the whole thing back",
  /claimed\.count !== inWindow\.length/.test(close || ""),
);
ok("the batch and its entries move in one transaction", /\$transaction/.test(close || ""));
ok("a duplicate close is absorbed, not thrown", /P2002/.test(close || ""));
ok("an empty week creates no batch", /if \(!inWindow\.length\) return null/.test(close || ""));

const payable = fnBody(src, "payableTotalFor");
// The whole point: a reversal after the close must change what is paid.
ok(
  "what is paid is re-summed from the rows",
  /balanceCents\(entries\)/.test(payable || ""),
);
ok(
  "and drift from the closing figure is surfaced rather than hidden",
  /driftedFromClose/.test(payable || ""),
);

const cron = readFileSync("app/api/cron/sales-payouts/route.js", "utf8");
ok("the cron demands its secret", cron.includes("requireCronSecret(request)"));
ok("before any work", cron.indexOf("requireCronSecret") < cron.indexOf("salesRep.findMany"));
ok("it closes LAST week, never the live one", cron.includes("previousWeekBounds"));
// A rep who left last Wednesday still earned what they earned before Wednesday.
ok(
  "a deactivated rep is still paid what they earned",
  !/salesRep\.findMany\(\{[\s\S]{0,120}active: true/.test(cron),
);
ok("nothing is marked paid automatically", !/status: "paid"/.test(cron));

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const entry = (vercel.crons || []).find((c) => c.path === "/api/cron/sales-payouts");
ok("the closer is actually scheduled", Boolean(entry));
ok("weekly, on a Monday", Boolean(entry) && entry.schedule.endsWith(" * * 1"), entry?.schedule);

console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} of ${passed + failures.length}`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} assertions`);
