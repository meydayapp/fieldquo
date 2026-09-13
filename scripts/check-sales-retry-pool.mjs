#!/usr/bin/env node
//
// scripts/check-sales-retry-pool.mjs
//
//   npm run check:sales-retry-pool
//
// The retry pool — executed, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. The rule table is TOTAL over the disposition vocabulary, and every
//      number is the one the module's header defends.
//   2. nextAttempt(): a "no answer" walks four blocks of the prospect's day
//      and exhausts on the fourth; "busy" comes back in fifteen minutes in the
//      same block; "voicemail" waits two days and exhausts on the third; a
//      callback is the agreed time; every final outcome schedules nothing.
//   3. The window roll: a retry never lands inside a shut window — the
//      Canadian default or a jurisdiction's own — across every zone in the
//      table and a spread of instants; a busy tone at 21:25 Friday is rung
//      back Saturday at 10:00, not 21:40.
//   4. An unknown zone still delays, never schedules a block, and never
//      exhausts early.
//   5. Exhaustion and recycle: exhaustedAt is set once and never cleared by
//      a later final outcome; recycleData resets the count and stamps who,
//      and deletes nothing.
//   6. The disposition write, against the db stub: saveDisposition() runs
//      the rule inside its transaction and writes the pool columns on the
//      prospect; the fourth no-answer exhausts it.
//   7. The pool, against the db stub: claimCandidateWhere() admits a due
//      retry and refuses a scheduled one and an exhausted one; claimBatch()
//      hands a due retry out FIRST, ahead of a fresh row that would sort
//      earlier on every other key.
//   8. The held list: regroupForRetry() puts a due retry at the front of
//      "Callable now", a scheduled one in its own "opens at" group, an
//      exhausted one in "later".
//   9. The screens and the words: the queue route and the lead route carry
//      `retry`; the console and the lead screen print it; the four keys
//      exist in all nine languages; the platform route is superadmin-only
//      and recycles with a guarded updateMany and an audit row; the sidebar
//      links it; the audit action is described.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RETRY_BLOCKS,
  RETRY_KIND_CALLBACK,
  RETRY_KIND_FINAL,
  RETRY_KIND_RETRY,
  RETRY_MAX_ATTEMPTS,
  RETRY_RULES,
  RETRY_RULE_ORDER,
  blockOf,
  nextAttempt,
  nextBlockAfter,
  recycleData,
  retryAvailableWhere,
  retryRuleTable,
  retryStateOf,
  rollToOpen,
  windowOpenAt,
} from "@/lib/sales/retryRules";
import { regroupForRetry, retryViewFor, retryWindowFor, retryWriteFor } from "@/lib/sales/retryPool";
import { DISPOSITIONS, DISPOSITION_ORDER } from "@/lib/sales/calls/dispositions";
import { SALES_CALL_WINDOW, localTimeIn } from "@/lib/sales/callingWindow";
import { CALLING_JURISDICTIONS, SUBDIVISION_TIME_ZONES } from "@/lib/sales/callingRules";
import { claimCandidateWhere } from "@/lib/sales/prospectView";
import { claimBatch, selectBatch } from "@/lib/sales/queueBatch";
import { groupByWindow } from "@/lib/sales/queueWindows";
import { saveDisposition } from "@/lib/sales/calls/store";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";
import { db, resetDbStub, rows, writes } from "./fixtures/dbStub.mjs";

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
const section = (t) => console.log(`\n${t}\n`);

const TORONTO = "America/Toronto";
const local = (at, zone = TORONTO) => {
  const l = localTimeIn(zone, at);
  return l ? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][l.weekday]} ${String(Math.floor(l.minute / 60)).padStart(2, "0")}:${String(l.minute % 60).padStart(2, "0")}` : null;
};

// ═══════════════════════════════════════════════════════════════════════════
section("1. The table is total, and the numbers are the header's");

for (const code of DISPOSITION_ORDER) {
  ok(`disposition "${code}" has a retry rule`, Object.hasOwn(RETRY_RULES, code));
}
for (const code of RETRY_RULE_ORDER) {
  ok(`rule "${code}" is a disposition`, Object.hasOwn(DISPOSITIONS, code));
  const r = RETRY_RULES[code];
  ok(`…and carries a reason in words`, typeof r.why === "string" && r.why.length > 10);
  ok(`…and a known kind`, [RETRY_KIND_RETRY, RETRY_KIND_CALLBACK, RETRY_KIND_FINAL].includes(r.kind));
}
ok("no answer: 3 h, 4 attempts, rotates", RETRY_RULES.no_answer.delayMinutes === 180 && RETRY_RULES.no_answer.maxAttempts === 4 && RETRY_RULES.no_answer.rotateBlock === true);
ok("busy: 15 min, 6 attempts, same block", RETRY_RULES.busy.delayMinutes === 15 && RETRY_RULES.busy.maxAttempts === 6 && RETRY_RULES.busy.rotateBlock === false);
ok("voicemail: 2 days, 3 attempts, rotates", RETRY_RULES.voicemail.delayMinutes === 2 * 24 * 60 && RETRY_RULES.voicemail.maxAttempts === 3 && RETRY_RULES.voicemail.rotateBlock === true);
ok("gatekeeper: 1 day, 4 attempts, rotates", RETRY_RULES.gatekeeper.delayMinutes === 24 * 60 && RETRY_RULES.gatekeeper.maxAttempts === 4);
ok("callback is its own kind with no ceiling", RETRY_RULES.callback.kind === RETRY_KIND_CALLBACK && RETRY_RULES.callback.maxAttempts === null);
for (const code of ["reached_interested", "agreed_link_sent", "reached_not_interested", "do_not_call", "bad_number", "not_a_fit"]) {
  ok(`${code} is final`, RETRY_RULES[code].kind === RETRY_KIND_FINAL);
}
ok("busy's ceiling is the highest, so 'Retry 1 of M' before a dial reads M = 6", RETRY_MAX_ATTEMPTS === 6);
ok("the four blocks, in rotation order", RETRY_BLOCKS.join(",") === "morning,midday,afternoon,evening");
ok("the rotation walks round", nextBlockAfter("evening") === "morning" && nextBlockAfter("morning") === "midday" && nextBlockAfter(null) === "morning" && nextBlockAfter("nonsense") === "morning");
ok("the platform table is the rules in order, with the words", (() => {
  const t = retryRuleTable();
  return t.length === RETRY_RULE_ORDER.length && t.every((r, i) => r.code === RETRY_RULE_ORDER[i] && r.why === RETRY_RULES[r.code].why);
})());

// ═══════════════════════════════════════════════════════════════════════════
section("2. nextAttempt(): one no-answer per block, then exhausted");

{
  // Friday 10:00 EDT — morning.
  let now = new Date("2026-09-11T14:00:00Z");
  let count = 0;
  let last = null;
  const seen = [];
  let d = null;
  for (let i = 0; i < 6; i++) {
    d = nextAttempt({ outcome: "no_answer", attemptCount: count, now, timeZone: TORONTO, lastBlock: last });
    if (d.exhausted) break;
    seen.push(d.block);
    count = d.attemptCount;
    last = d.block;
    now = d.nextAttemptAt;
  }
  ok("first no-answer at 10:00 is aimed at midday", seen[0] === "midday", seen);
  ok("then afternoon, then evening — three different blocks", seen.join(",") === "midday,afternoon,evening", seen);
  ok("every scheduled instant is inside the window", seen.length === 3);
  ok("the fourth no-answer exhausts", d?.exhausted === true && d.attemptCount === 4 && d.nextAttemptAt === null && d.block === null, d);
  ok("…and says the ceiling", d?.maxAttempts === 4);
}
{
  // Friday 19:30 EDT — evening. The next block is morning: tomorrow (Saturday) at 10:00.
  const d = nextAttempt({ outcome: "no_answer", attemptCount: 0, now: new Date("2026-09-11T23:30:00Z"), timeZone: TORONTO });
  ok("an evening no-answer rolls to Saturday morning at the weekend opening (10:00)", local(d.nextAttemptAt) === "Sat 10:00" && d.block === "morning", local(d.nextAttemptAt));
}
{
  const d = nextAttempt({ outcome: "no_answer", attemptCount: 0, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO, lastBlock: "afternoon" });
  ok("the block the dial LANDED in wins over the block it was aimed at", d.block === "midday", d.block);
}

section("2b. busy: soon, same block; voicemail: two days; gatekeeper: a day");
{
  const d = nextAttempt({ outcome: "busy", attemptCount: 0, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO });
  ok("busy at 10:00 is rung back at 10:15", local(d.nextAttemptAt) === "Fri 10:15" && d.block === "morning", local(d.nextAttemptAt));
  ok("…and is not exhausted", !d.exhausted && d.attemptCount === 1);
  const six = nextAttempt({ outcome: "busy", attemptCount: 5, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO });
  ok("the sixth busy exhausts", six.exhausted === true);
  const five = nextAttempt({ outcome: "busy", attemptCount: 4, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO });
  ok("the fifth does not", five.exhausted === false && five.nextAttemptAt);
}
{
  // Saturday 16:00 EDT; two days → Monday 16:00, afternoon; rotate → evening: Monday 17:00.
  const d = nextAttempt({ outcome: "voicemail", attemptCount: 0, now: new Date("2026-09-12T20:00:00Z"), timeZone: TORONTO });
  ok("voicemail on Saturday afternoon: Monday, next block (evening) at 17:00", local(d.nextAttemptAt) === "Mon 17:00" && d.block === "evening", local(d.nextAttemptAt));
  const third = nextAttempt({ outcome: "voicemail", attemptCount: 2, now: new Date("2026-09-12T20:00:00Z"), timeZone: TORONTO });
  ok("the third voicemail exhausts", third.exhausted === true && third.attemptCount === 3);
  // Two no-answers then a voicemail: the voicemail's ceiling (3) closes it.
  const mixed = nextAttempt({ outcome: "voicemail", attemptCount: 2, now: new Date("2026-09-12T20:00:00Z"), timeZone: TORONTO });
  ok("two no-answers then a voicemail is three attempts, and the voicemail rule closes it", mixed.exhausted === true);
}
{
  const d = nextAttempt({ outcome: "gatekeeper", attemptCount: 0, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO });
  ok("gatekeeper at Friday 10:00: Saturday, next block (midday) at 12:00", local(d.nextAttemptAt) === "Sat 12:00" && d.block === "midday", local(d.nextAttemptAt));
}

section("2c. callback and final outcomes");
{
  const cb = new Date("2026-09-14T18:00:00Z");
  const d = nextAttempt({ outcome: "callback", attemptCount: 1, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO, callbackAt: cb });
  ok("a callback schedules the agreed time", d.kind === RETRY_KIND_CALLBACK && d.nextAttemptAt?.getTime() === cb.getTime());
  ok("…counts the dial and never exhausts", d.attemptCount === 2 && d.exhausted === false && d.maxAttempts === null);
  ok("…and names the block it falls in", d.block === "afternoon", d.block);
  const none = nextAttempt({ outcome: "callback", attemptCount: 1, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO, callbackAt: "not a date" });
  ok("a callback with no usable time schedules nothing rather than now", none.nextAttemptAt === null);
}
for (const code of ["reached_interested", "agreed_link_sent", "reached_not_interested", "do_not_call", "bad_number", "not_a_fit"]) {
  const d = nextAttempt({ outcome: code, attemptCount: 7, now: new Date("2026-09-11T14:00:00Z"), timeZone: TORONTO });
  ok(`${code}: counted, nothing scheduled, never exhausted`, d.kind === RETRY_KIND_FINAL && d.attemptCount === 8 && d.nextAttemptAt === null && d.exhausted === false);
}
{
  const d = nextAttempt({ outcome: "made_up", attemptCount: 0, now: new Date(), timeZone: TORONTO });
  ok("an unknown outcome is treated as final and said to be", d.kind === RETRY_KIND_FINAL && d.nextAttemptAt === null);
  const bad = nextAttempt({ outcome: "no_answer", attemptCount: "lots", now: "yesterday?", timeZone: TORONTO });
  ok("hostile count and clock: count reads as 0, clock as now, nothing throws", bad.attemptCount === 1 && bad.nextAttemptAt instanceof Date);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The window roll: never inside a shut window");

{
  // Friday 21:25 EDT busy → 21:40 is past the 21:30 weekday cutoff → Saturday 10:00.
  const d = nextAttempt({ outcome: "busy", attemptCount: 0, now: new Date("2026-09-12T01:25:00Z"), timeZone: TORONTO });
  ok("busy at 21:25 Friday is rung back Saturday 10:00, not 21:40", local(d.nextAttemptAt) === "Sat 10:00", local(d.nextAttemptAt));
}
{
  // Sunday 17:50 EDT no-answer → +3 h is shut (weekend ends 18:00) → next block after evening is morning → Monday 09:00.
  const d = nextAttempt({ outcome: "no_answer", attemptCount: 0, now: new Date("2026-09-13T21:50:00Z"), timeZone: TORONTO });
  ok("Sunday evening no-answer lands Monday 09:00 morning", local(d.nextAttemptAt) === "Mon 09:00" && d.block === "morning", local(d.nextAttemptAt));
}
{
  // A jurisdiction window: Oklahoma 08:00–20:00 every day. Busy at 19:50 → 20:05 is shut → next day 08:00.
  const ok_ = CALLING_JURISDICTIONS["US-OK"];
  ok("the Oklahoma row carries a window to hand in", Boolean(ok_?.window));
  const d = nextAttempt({ outcome: "busy", attemptCount: 0, now: new Date("2026-09-12T00:50:00Z"), timeZone: "America/Chicago", window: ok_.window });
  ok("busy at 19:50 CDT under Oklahoma's 08:00–20:00 rings back at 08:00 next day", local(d.nextAttemptAt, "America/Chicago") === "Sat 08:00", local(d.nextAttemptAt, "America/Chicago"));
  ok("retryWindowFor picks the jurisdiction's window for an Oklahoma row", retryWindowFor({ country: "US", province: "OK" }) === ok_.window);
  ok("…the Canadian window for a row with no jurisdiction", retryWindowFor({}) === SALES_CALL_WINDOW);
}
{
  // Every zone in the table, a spread of instants and outcomes: the scheduled instant is always open.
  const zones = [...new Set(Object.values(SUBDIVISION_TIME_ZONES).flat())];
  let checked = 0;
  let bad = null;
  for (const zone of zones) {
    for (let h = 0; h < 48 && !bad; h += 5) {
      const now = new Date(Date.UTC(2026, 8, 10, h, 7));
      for (const outcome of ["no_answer", "busy", "voicemail", "gatekeeper"]) {
        const d = nextAttempt({ outcome, attemptCount: 0, now, timeZone: zone });
        checked++;
        if (!(d.nextAttemptAt instanceof Date) || windowOpenAt(d.nextAttemptAt, zone) !== true) {
          bad = { zone, now: now.toISOString(), outcome, at: d.nextAttemptAt };
          break;
        }
        if (d.nextAttemptAt.getTime() < now.getTime() + RETRY_RULES[outcome].delayMinutes * 60 * 1000) {
          bad = { zone, now: now.toISOString(), outcome, early: d.nextAttemptAt };
          break;
        }
        if (blockOf(d.nextAttemptAt, zone) !== d.block) {
          bad = { zone, outcome, block: d.block, actual: blockOf(d.nextAttemptAt, zone) };
          break;
        }
      }
    }
  }
  ok(`${checked} schedules across ${zones.length} zones: every one inside the window, after the delay, in the block it names`, bad === null, bad);
}
{
  // Rotation across a spread: a rotating retry never lands in the block it was dialled in
  // (unless the window forces it — none in the table does).
  let bad = null;
  for (let h = 0; h < 24 && !bad; h++) {
    const now = new Date(Date.UTC(2026, 8, 9, h, 0));
    const from = blockOf(now, TORONTO);
    const d = nextAttempt({ outcome: "no_answer", attemptCount: 0, now, timeZone: TORONTO });
    if (d.block === from) bad = { now: now.toISOString(), from, got: d.block };
  }
  ok("a rotating retry never lands in the block it was dialled in", bad === null, bad);
}
{
  const r = rollToOpen({ from: new Date("2026-09-12T01:25:00Z"), timeZone: "Not/AZone" });
  ok("rollToOpen answers null for a zone Intl cannot read", r === null);
  const w = windowOpenAt(new Date(), "Not/AZone");
  ok("windowOpenAt answers null, never false, for an unusable zone", w === null);
  const closed = windowOpenAt(new Date("2026-09-13T16:00:00Z"), TORONTO, { weekday: { startMinute: 0, endMinute: 1440 }, weekend: { startMinute: 0, endMinute: 1440 }, closedWeekdays: [0] });
  ok("a closedWeekdays window is shut on that day", closed === false);
}

section("4. An unknown zone delays, names no block, never exhausts early");
{
  const d = nextAttempt({ outcome: "no_answer", attemptCount: 0, now: new Date("2026-09-11T14:00:00Z"), timeZone: null });
  ok("no zone: the bare delay stands", d.nextAttemptAt?.getTime() === new Date("2026-09-11T17:00:00Z").getTime());
  ok("…no block is invented", d.block === null && d.zoneKnown === false);
  const w = retryWriteFor({ outcome: "no_answer", prospect: { attemptCount: 0, country: "US", province: "FL" }, timeZone: null, now: new Date("2026-09-11T14:00:00Z") });
  ok("a split state (Florida) with no stated zone is 'ambiguous', and the write says so — and schedules across both halves", w.zoneSource === "ambiguous" && w.timeZone === null && w.candidates.length === 2 && w.data.retryBlock === "midday", w);
  const ny = retryWriteFor({ outcome: "no_answer", prospect: { attemptCount: 0, country: "US", province: "NY" }, timeZone: null, now: new Date("2026-09-11T14:00:00Z") });
  ok("New York derives its zone and gets a block", ny.zoneSource === "derived" && ny.timeZone === "America/New_York" && ny.data.retryBlock === "midday");
  const stated = retryWriteFor({ outcome: "no_answer", prospect: { attemptCount: 0, country: "US", province: "FL" }, timeZone: "America/Chicago", now: new Date("2026-09-11T14:00:00Z") });
  ok("a stated zone resolves the split state", stated.zoneSource === "stated" && stated.timeZone === "America/Chicago");
  // Ontario is Eastern AND Central (Kenora). With no stated zone the rule
  // takes both candidates: the instant must be open in both, and the block
  // is named only where both agree.
  const on = retryWriteFor({ outcome: "no_answer", prospect: { attemptCount: 0, country: "CA", province: "ON" }, timeZone: null, now: new Date("2026-09-11T14:00:00Z") });
  ok("Ontario, unresolved, is scheduled where Toronto and Winnipeg agree: 13:00 EDT / 12:00 CDT, midday in both", on.zoneSource === "ambiguous" && on.candidates.length === 2 && on.data.retryBlock === "midday" && local(on.data.nextAttemptAt) === "Fri 13:00", on.data);
  ok("…and the instant is open in both candidate zones", windowOpenAt(on.data.nextAttemptAt, on.candidates) === true);
  const fl = retryWriteFor({ outcome: "busy", prospect: { attemptCount: 0, country: "US", province: "FL" }, timeZone: null, now: new Date("2026-09-12T00:00:00Z") });
  // 20:00 EDT / 19:00 CDT under Florida's 08:00–20:00: shut in Eastern. The
  // roll goes to the first hour BOTH halves allow — 09:00 Eastern, which is
  // 08:00 Central; 08:00 Eastern would be 07:00 in Pensacola and shut.
  ok("Florida, unresolved, at 20:00 EDT is rung back at 09:00 EDT — the first hour both halves allow", fl.data.nextAttemptAt && windowOpenAt(fl.data.nextAttemptAt, fl.candidates, retryWindowFor({ country: "US", province: "FL" })) === true && local(fl.data.nextAttemptAt, "America/New_York") === "Sat 09:00", local(fl.data.nextAttemptAt, "America/New_York"));
  ok("a block at a boundary the two zones disagree on is null, never one half's answer", blockOf(new Date("2026-09-11T16:30:00Z"), ["America/Toronto", "America/Winnipeg"]) === null && blockOf(new Date("2026-09-11T17:30:00Z"), ["America/Toronto", "America/Winnipeg"]) === "midday");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Exhaustion is set once; recycle resets the count and deletes nothing");
{
  const now = new Date("2026-09-11T14:00:00Z");
  const w = retryWriteFor({ outcome: "no_answer", prospect: { attemptCount: 3, exhaustedAt: null, country: "CA", province: "ON" }, now });
  ok("the fourth no-answer writes exhaustedAt", w.data.exhaustedAt === now && w.data.nextAttemptAt === null && w.data.attemptCount === 4);
  const again = retryWriteFor({ outcome: "reached_not_interested", prospect: { attemptCount: 4, exhaustedAt: now, country: "CA", province: "ON" }, now: new Date(now.getTime() + 1000) });
  ok("a later final outcome does not clear it — clearing is the recycle's job", !("exhaustedAt" in again.data) && again.data.attemptCount === 5);
  const already = retryWriteFor({ outcome: "no_answer", prospect: { attemptCount: 9, exhaustedAt: now, country: "CA", province: "ON" }, now: new Date(now.getTime() + 1000) });
  ok("an exhausted row dialled by hand again does not move the exhausted date", !("exhaustedAt" in already.data));
  const r = recycleData({ adminId: "adm_1", now });
  ok("recycle: count 0, nothing scheduled, exhausted cleared, who and when stamped", r.attemptCount === 0 && r.nextAttemptAt === null && r.retryBlock === null && r.exhaustedAt === null && r.recycledAt === now && r.recycledById === "adm_1");
  ok("…and the last outcome is NOT in the recycle data — history stays", !("lastOutcome" in r));
  const s = retryStateOf({ attemptCount: 4, exhaustedAt: now, lastOutcome: "no_answer", nextAttemptAt: null }, now);
  ok("retryStateOf reads an exhausted row as exhausted, not due, not scheduled", s.exhausted && !s.due && !s.scheduled && s.maxAttempts === 4);
  const due = retryStateOf({ attemptCount: 1, nextAttemptAt: new Date(now.getTime() - 1), lastOutcome: "busy" }, now);
  ok("…a past instant as due, with the last outcome's ceiling", due.due && !due.scheduled && due.maxAttempts === 6);
  const ahead = retryStateOf({ attemptCount: 1, nextAttemptAt: new Date(now.getTime() + 1), lastOutcome: "busy" }, now);
  ok("…a future instant as scheduled", ahead.scheduled && !ahead.due);
  const fresh = retryStateOf({}, now);
  ok("…a fresh row as neither, with the table's highest ceiling", !fresh.due && !fresh.scheduled && !fresh.exhausted && fresh.attemptCount === 0 && fresh.maxAttempts === RETRY_MAX_ATTEMPTS);
  const view = retryViewFor({ attemptCount: 1, nextAttemptAt: new Date("2026-09-11T18:30:00Z"), lastOutcome: "no_answer" }, { repZone: TORONTO, language: "en", now });
  ok("retryViewFor prints the instant on the rep's clock", view.nextAttemptAtLocal === "14:30" && view.scheduled, view);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The disposition write runs the rule inside the transaction (db stub)");
{
  const now = new Date("2026-09-11T14:00:00Z");
  resetDbStub();
  rows.prospect.push({ id: "p1", assignedRepId: "rep_a", attemptCount: 0, retryBlock: null, exhaustedAt: null, country: "CA", province: "ON", leads: [], doNotContactAt: null });
  rows.salesCallAttempt.push({ id: "a1", salesRepId: "rep_a", prospectId: "p1", leadId: null, toE164: "+14165550100", disposition: null });
  const r = await saveDisposition({ salesRepId: "rep_a", attemptId: "a1", code: "no_answer", now, client: db });
  ok("saveDisposition succeeds against the stub", r.ok === true, r.error);
  const p = rows.prospect[0];
  ok("the prospect's pool columns are written: count 1, last outcome, next instant, block", p.attemptCount === 1 && p.lastOutcome === "no_answer" && p.nextAttemptAt instanceof Date && p.retryBlock === "midday", p);
  ok("…the decision rides back on the result", r.retry?.kind === RETRY_KIND_RETRY && r.retry.attemptCount === 1);
  ok("…the prospect row was read INSIDE the transaction, not before it", (() => {
    const txAt = writes.findIndex((w) => w.model === "salesCallAttempt" && w.action === "update");
    const upd = writes.findIndex((w) => w.model === "prospect" && w.action === "updateMany");
    return txAt !== -1 && upd > txAt;
  })());
  // Three more no-answers: the fourth exhausts.
  for (let i = 2; i <= 4; i++) {
    rows.salesCallAttempt.push({ id: `a${i}`, salesRepId: "rep_a", prospectId: "p1", leadId: null, toE164: "+14165550100", disposition: null });
    await saveDisposition({ salesRepId: "rep_a", attemptId: `a${i}`, code: "no_answer", now: new Date(now.getTime() + i * 3600 * 1000), client: db });
  }
  ok("the fourth no-answer exhausts the row", rows.prospect[0].attemptCount === 4 && rows.prospect[0].exhaustedAt instanceof Date && rows.prospect[0].nextAttemptAt === null, rows.prospect[0]);
  // A prospect held by another rep is not written — the WHERE scopes it.
  resetDbStub();
  rows.prospect.push({ id: "p2", assignedRepId: "rep_b", attemptCount: 0, retryBlock: null, exhaustedAt: null, country: "CA", province: "ON", leads: [] });
  rows.salesCallAttempt.push({ id: "b1", salesRepId: "rep_a", prospectId: "p2", leadId: null, toE164: "+14165550101", disposition: null });
  await saveDisposition({ salesRepId: "rep_a", attemptId: "b1", code: "no_answer", now, client: db });
  ok("a prospect somebody else holds keeps its pool columns — the write is scoped to the rep's claim", rows.prospect[0].attemptCount === 0 && !rows.prospect[0].lastOutcome);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The pool: due retries in, scheduled and exhausted out, due first (db stub)");
{
  const now = new Date("2026-09-11T14:00:00Z"); // Friday 10:00 EDT
  const where = claimCandidateWhere({ tradeKey: "electrical", now });
  ok("the claim WHERE refuses an exhausted row", where.exhaustedAt === null || where.AND?.some((c) => c.exhaustedAt === null));
  ok("…and carries the retry clause as an AND beside the lease's OR", Array.isArray(where.AND) && where.AND[0]?.OR?.some((c) => c.nextAttemptAt === null) && Array.isArray(where.OR));
  ok("retryAvailableWhere uses lt, the operator every scripted matcher in this repo implements", "lt" in where.AND[0].OR[1].nextAttemptAt);

  const base = (id, over = {}) => ({
    id,
    tradeKey: "electrical",
    status: "discovered",
    doNotContactAt: null,
    assignedRepId: null,
    assignedAt: null,
    claimExpiresAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    country: "CA",
    province: "ON",
    lastCrawledAt: null,
    attemptCount: 0,
    nextAttemptAt: null,
    exhaustedAt: null,
    _count: { capabilities: 0, opportunities: 0 },
    leads: [],
    ...over,
  });
  resetDbStub();
  rows.prospect.push(
    // The freshest, researched, oldest — wins every existing key.
    base("fresh", { createdAt: new Date("2026-08-01T00:00:00Z"), lastCrawledAt: now, _count: { capabilities: 2, opportunities: 1 } }),
    // A due retry: newer, unresearched — loses every existing key, and must still come first.
    base("due", { attemptCount: 1, lastOutcome: "no_answer", nextAttemptAt: new Date(now.getTime() - 60 * 1000), createdAt: new Date("2026-09-10T00:00:00Z") }),
    base("scheduled", { attemptCount: 1, lastOutcome: "busy", nextAttemptAt: new Date(now.getTime() + 15 * 60 * 1000) }),
    base("exhausted", { attemptCount: 4, lastOutcome: "no_answer", exhaustedAt: now }),
    base("exact", { attemptCount: 1, lastOutcome: "busy", nextAttemptAt: now }),
  );
  const admitted = (await db.prospect.findMany({ where })).map((p) => p.id);
  ok("the WHERE admits the fresh row and the due retry", admitted.includes("fresh") && admitted.includes("due"), admitted);
  ok("…and refuses the scheduled one and the exhausted one", !admitted.includes("scheduled") && !admitted.includes("exhausted"), admitted);
  ok("…a retry due at exactly now waits for the next read (lt, by design)", !admitted.includes("exact"));

  const rep = { id: "rep_a", sellsIn: ["en", "fr"] };
  const result = await claimBatch({ db, rep, tradeKey: "electrical", timeZone: TORONTO, now, shiftStart: null });
  ok("claimBatch claims exactly the two admitted rows", result.claimed === 2 && result.claimedIds.length === 2, result);
  ok("…the DUE RETRY FIRST, ahead of the researched, older, fresh row", result.claimedIds[0] === "due" && result.claimedIds[1] === "fresh", result.claimedIds);
  ok("…and the claim log records that order", rows.salesQueueClaim.find((c) => c.prospectId === "due")?.position === 0 && rows.salesQueueClaim.find((c) => c.prospectId === "fresh")?.position === 1);
  ok("…while the scheduled and exhausted rows are still unclaimed", rows.prospect.filter((p) => ["scheduled", "exhausted"].includes(p.id)).every((p) => p.assignedRepId === null));

  // selectBatch, pure: retryDue beats closes-soonest inside tier 0.
  const cand = (id, over) => ({ id, createdAt: new Date("2026-09-01T00:00:00Z"), researched: false, recentlyReleased: false, readiness: { decision: "allowed", blockers: [] }, closesAt: null, retryDue: false, ...over });
  const picked = selectBatch({
    candidates: [
      cand("shuts_soon", { closesAt: new Date(now.getTime() + 60 * 60 * 1000), researched: true }),
      cand("retry_later_close", { closesAt: new Date(now.getTime() + 8 * 60 * 60 * 1000), retryDue: true }),
    ],
    shiftEnd: new Date(now.getTime() + 7 * 3600 * 1000),
    want: 25,
  });
  ok("selectBatch: a due retry outranks a row that shuts sooner and is researched", picked.ids[0] === "retry_later_close", picked.ids);
  const later = selectBatch({
    candidates: [
      cand("open_fresh"),
      cand("retry_but_shut", { retryDue: true, readiness: { decision: "refused", blockers: [{ code: "outside_window" }], opensAt: new Date(now.getTime() + 3600 * 1000) } }),
    ],
    shiftEnd: new Date(now.getTime() + 7 * 3600 * 1000),
    want: 25,
  });
  ok("…but never a shut window: a due retry whose window is shut is not taken now", later.ids.length === 1 && later.ids[0] === "open_fresh", later.ids);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The held list: regroupForRetry()");
{
  const now = new Date("2026-09-11T14:00:00Z"); // Friday 10:00 EDT
  const shiftEnd = new Date(now.getTime() + 7 * 3600 * 1000);
  const held = [
    { id: "a", country: "CA", province: "ON" },
    { id: "b", country: "CA", province: "ON" },
    { id: "c", country: "CA", province: "ON" },
    { id: "d", country: "CA", province: "ON" },
    { id: "e", country: "CA", province: "ON" },
    { id: "pt", country: "CA", province: "BC", timeZone: "America/Vancouver" }, // opens 12:00 EDT
  ];
  const grouped = groupByWindow(held, { repZone: TORONTO, shiftEnd, now, language: "en" });
  ok("fixture: five Ontario rows are callable now and the BC one opens later", grouped.groups[0]?.kind === "now" && grouped.groups[0].ids.length === 5 && grouped.groups[1]?.kind === "opens");
  const opts = { repZone: TORONTO, language: "en", now };
  const retries = {
    a: retryViewFor({}, opts),
    b: retryViewFor({ attemptCount: 1, lastOutcome: "no_answer", nextAttemptAt: new Date(now.getTime() - 1000) }, opts), // due
    c: retryViewFor({ attemptCount: 1, lastOutcome: "busy", nextAttemptAt: new Date(now.getTime() + 15 * 60 * 1000) }, opts), // scheduled 10:15
    d: retryViewFor({ attemptCount: 4, lastOutcome: "no_answer", exhaustedAt: now }, opts), // exhausted
    e: retryViewFor({ attemptCount: 1, lastOutcome: "voicemail", nextAttemptAt: new Date(now.getTime() + 8 * 3600 * 1000) }, opts), // after the shift
    pt: retryViewFor({}, opts),
  };
  const out = regroupForRetry(grouped, retries, { shiftEnd, now });
  const kinds = out.groups.map((g) => g.kind + (g.retry ? "*" : ""));
  ok("the due retry is FIRST in 'Callable now'", out.groups[0].kind === "now" && out.groups[0].ids[0] === "b", out.groups[0].ids);
  ok("…and the fresh row follows it", out.groups[0].ids.includes("a") && !out.groups[0].ids.includes("c") && !out.groups[0].ids.includes("d"));
  const retryGroup = out.groups.find((g) => g.retry);
  ok("the scheduled retry has its own 'opens at' group keyed by the retry instant", retryGroup && retryGroup.ids.join() === "c" && retryGroup.opensAtLocal === "10:15", retryGroup);
  ok("…which sorts before the BC window that opens at 12:00", kinds.indexOf("opens*") < kinds.lastIndexOf("opens"), kinds);
  ok("the BC row keeps its own window group", out.groups.some((g) => g.kind === "opens" && !g.retry && g.ids.join() === "pt"));
  const laterGroup = out.groups.find((g) => g.kind === "later");
  ok("the exhausted row and the after-shift retry are 'later'", laterGroup && laterGroup.ids.includes("d") && laterGroup.ids.includes("e"), laterGroup);
  ok("…with their reasons on the row", out.byId.d.reasonCode === "exhausted" && out.byId.e.reasonCode === "retry_after_shift");
  ok("a held retry's row says it is not callable now and carries the retry instant", out.byId.c.callableNow === false && out.byId.c.opensAtIso === retries.c.nextAttemptAtIso && out.byId.c.retryHold === true);
  ok("`order` is every id exactly once", out.order.length === 6 && new Set(out.order).size === 6, out.order);
  ok("no retries: the grouping is returned as it came", (() => {
    const same = regroupForRetry(grouped, {}, { shiftEnd, now });
    return same.order.join() === grouped.order.join();
  })());
  ok("a retry scheduled before the window opens waits for the window, not the retry", (() => {
    const r = { pt: retryViewFor({ attemptCount: 1, lastOutcome: "busy", nextAttemptAt: new Date(now.getTime() + 15 * 60 * 1000) }, opts) };
    const o = regroupForRetry(grouped, r, { shiftEnd, now });
    return o.byId.pt.opensAtIso === grouped.byId.pt.opensAtIso;
  })());
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The screens, the words, the platform lever");
{
  const route = decomment(read("app/api/sales/queue/route.js"));
  ok("the queue route selects the pool columns", /attemptCount: true,\s*nextAttemptAt: true,\s*lastOutcome: true,\s*retryBlock: true,\s*exhaustedAt: true/.test(route));
  ok("…regroups the held list through regroupForRetry", /regroupForRetry\(grouped, retries/.test(route));
  ok("…and puts `retry` on every row and on the current prospect", /retry: retries\[p\.id\]/.test(route) && /retry: retryViewFor\(full/.test(route));
  const page = decomment(read("app/sales/queue/page.js"));
  ok("the console prints the three retry sentences", /app\.salesQueue\.retry\.next/.test(page) && /app\.salesQueue\.retry\.due/.test(page) && /app\.salesQueue\.retry\.exhausted/.test(page));
  ok("…on the Dialer card (RetryTag) and on the row", /<RetryTag retry=/.test(page) && /meta\.retry\]/.test(page));
  ok("…a due retry is undialled to the autodialler", /dialled: Boolean\(item\.lastOutcome\) && !item\.retry\?\.due/.test(page));
  ok("…and counts as open work for the top-up", /\(!item\.lastOutcome \|\| item\.retry\?\.due\)/.test(page));
  ok("…and a retry-keyed group has its own header", /app\.salesQueue\.windowGroup\.retryAt/.test(page));
  const lead = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the lead screen prints the same sentences", /app\.salesQueue\.retry\.next/.test(lead) && /app\.salesQueue\.retry\.exhausted/.test(lead));
  const leadRoute = decomment(read("app/api/sales/leads/[id]/route.js"));
  ok("…from the lead route's `retry`, on the rep's clock", /retry: retryFor\(lead, request\)/.test(leadRoute) && /retryViewFor\(lead\.prospect/.test(leadRoute));
  const calls = decomment(read("app/api/sales/calls/route.js"));
  ok("the disposition response carries the decision", /retry: result\.retry/.test(calls));
  const store = decomment(read("lib/sales/calls/store.js"));
  ok("saveDisposition reads the prospect INSIDE the transaction for the rule", /const pool = await tx\.prospect\.findUnique/.test(store) && /retryWriteFor\(/.test(store));

  for (const key of ["app.salesQueue.retry.next", "app.salesQueue.retry.due", "app.salesQueue.retry.exhausted", "app.salesQueue.windowGroup.retryAt"]) {
    for (const lang of Object.keys(APP_MESSAGES)) {
      ok(`${key} exists in ${lang}`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 0);
    }
    ok(`${key} keeps its placeholders in every language`, (() => {
      const en = APP_MESSAGES.en[key].match(/\{[a-z]+\}/g) || [];
      return Object.keys(APP_MESSAGES).every((lang) => en.every((ph) => APP_MESSAGES[lang][key].includes(ph)));
    })());
  }
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9);

  const platform = decomment(read("app/api/platform/sales/retry-pool/route.js"));
  ok("the platform route refuses anyone but a superadmin", /admin\.role !== "superadmin"/.test(platform));
  ok("…recycles with a write guarded on exhaustedAt, through recycleData", /updateMany\(\{\s*where: \{ id: \{ in: ids \}, exhaustedAt: \{ not: null \} \},\s*data: recycleData\(/.test(platform));
  ok("…writes an audit row", /action: "sales_prospect_recycled"/.test(platform));
  ok("…and deletes nothing", !/\.delete\(|deleteMany\(/.test(platform));
  ok("the audit action is described", Boolean(AUDIT_ACTIONS?.sales_prospect_recycled?.label));
  const platformPage = decomment(read("app/platform/sales/retry-pool/page.js"));
  ok("the platform page calls the route and offers Recycle", /\/api\/platform\/sales\/retry-pool/.test(platformPage) && /action: "recycle"/.test(platformPage));
  ok("…and prints the rule table from the module's own words", /r\.why/.test(platformPage));
  const sidebar = decomment(read("app/components/platform/PlatformSidebar.js"));
  ok("the sidebar links it", /href: "\/platform\/sales\/retry-pool"/.test(sidebar));
  const schema = read("prisma/schema.prisma");
  for (const col of ["attemptCount", "nextAttemptAt", "lastOutcome", "retryBlock", "exhaustedAt", "recycledAt", "recycledById"]) {
    ok(`Prospect.${col} is in the schema`, new RegExp(`\\n  ${col}\\s+\\S+`).test(schema.slice(schema.indexOf("model Prospect {"), schema.indexOf("model SalesQueueClaim {"))));
  }
  const pkg = JSON.parse(read("package.json"));
  ok("package.json has check:sales-retry-pool", typeof pkg.scripts["check:sales-retry-pool"] === "string");
  ok("…and check:all runs it", /check:sales-retry-pool/.test(pkg.scripts["check:all"]));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
