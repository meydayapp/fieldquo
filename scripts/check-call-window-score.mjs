#!/usr/bin/env node
//
// scripts/check-call-window-score.mjs
//
//   npm run check:call-window-score
//
// The best-window score — executed, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. windowScore(): Wednesday 15:30 in Toronto outranks Friday 11:00 in
//      Vancouver; the tiers are the header's (3–4 pm > 10–11 am > the rest;
//      Wed > Tue/Thu > Mon > Fri > weekend); a shut window is null; an
//      unusable zone is null; a split province is scored by its worse half.
//   2. The monotone shape across a whole week in every zone the table knows:
//      inside an open window the score is never null, outside it always is,
//      and the hour tier never contradicts the local clock.
//   3. The held list (groupByWindow): at one instant, a Toronto row at 15:30
//      goes before a Vancouver row at 12:30; a due retry still goes first;
//      the chip is drawn for the top tier only.
//   4. The batch top-up (selectBatch): the same key in the same place; a row
//      whose window is shut, or whose jurisdiction cap holds it, is not
//      taken however good the hour — the score never overrides readiness.
//   5. The screen: the queue route hands `bestTimeNow` down through
//      windowFor, the queue row draws the chip from it, the key exists in
//      nine languages, and check:all runs this.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BEST_HOURS,
  DAY_TIERS,
  HOUR_TIER_REST,
  WINDOW_SCORE_TOP,
  callingWindowFor,
  compareWindowScore,
  dayTierOf,
  hourTierOf,
  isBestTimeNow,
  windowScore,
} from "@/lib/sales/callWindowScore";
import { SALES_CALL_WINDOW, localTimeIn } from "@/lib/sales/callingWindow";
import { CALLING_JURISDICTIONS, CALL_ALLOWED, CALL_REFUSED, SUBDIVISION_TIME_ZONES } from "@/lib/sales/callingRules";
import { windowOpenAt } from "@/lib/sales/retryRules";
import { WINDOW_GROUP_NOW, groupByWindow } from "@/lib/sales/queueWindows";
import { regroupForRetry, retryViewFor } from "@/lib/sales/retryPool";
import { selectBatch, shiftEndFrom } from "@/lib/sales/queueBatch";
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
const section = (t) => console.log(`\n${t}\n`);

const TORONTO = "America/Toronto";
const VANCOUVER = "America/Vancouver";
// 2026-09-09 is a Wednesday; 2026-09-11 a Friday; 2026-09-12 a Saturday.
const WED_1530_TORONTO = new Date("2026-09-09T19:30:00Z");
const FRI_1100_VANCOUVER = new Date("2026-09-11T18:00:00Z");

// ═══════════════════════════════════════════════════════════════════════════
section("1. windowScore(): the owner's ranking, from Belkins");

{
  const wed = windowScore({ now: WED_1530_TORONTO, timeZone: TORONTO });
  const fri = windowScore({ now: FRI_1100_VANCOUVER, timeZone: VANCOUVER });
  ok("fixture: Wednesday 15:30 in Toronto, Friday 11:00 in Vancouver", localTimeIn(TORONTO, WED_1530_TORONTO).weekday === 3 && localTimeIn(TORONTO, WED_1530_TORONTO).minute === 15 * 60 + 30 && localTimeIn(VANCOUVER, FRI_1100_VANCOUVER).weekday === 5 && localTimeIn(VANCOUVER, FRI_1100_VANCOUVER).minute === 11 * 60);
  ok("Wednesday 15:30 Toronto outranks Friday 11:00 Vancouver", Number.isFinite(wed) && Number.isFinite(fri) && wed > fri, { wed, fri });
  ok("…Wednesday 15:30 is the top tier (3–4 pm, Wednesday): 34", wed === 3 * 10 + 4 && isBestTimeNow(wed));
  ok("…Friday 11:00 is an ordinary hour on the worst working day: 11", fri === 1 * 10 + 1 && !isBestTimeNow(fri));
  ok("10–11 am is the second tier: Friday 10:30 Vancouver scores 21", windowScore({ now: new Date("2026-09-11T17:30:00Z"), timeZone: VANCOUVER }) === 21);
  ok("the hour outranks the day: Friday 15:30 (31) beats Wednesday 10:30 (24)", windowScore({ now: new Date("2026-09-11T19:30:00Z"), timeZone: TORONTO }) === 31 && windowScore({ now: new Date("2026-09-09T14:30:00Z"), timeZone: TORONTO }) === 24 && compareWindowScore(31, 24) < 0);
  ok("the day tiers: Wed 4, Tue/Thu 3, Mon 2, Fri 1, weekend 0", dayTierOf(3) === 4 && dayTierOf(2) === 3 && dayTierOf(4) === 3 && dayTierOf(1) === 2 && dayTierOf(5) === 1 && dayTierOf(0) === 0 && dayTierOf(6) === 0 && dayTierOf(7) === null && Object.keys(DAY_TIERS).length === 7);
  ok("the hour tiers: [15:00,16:00) → 3, [10:00,11:00) → 2, else 1; 16:00 and 11:00 are outside", hourTierOf(15 * 60) === 3 && hourTierOf(15 * 60 + 59) === 3 && hourTierOf(16 * 60) === HOUR_TIER_REST && hourTierOf(10 * 60) === 2 && hourTierOf(11 * 60) === HOUR_TIER_REST && hourTierOf(9 * 60) === 1 && hourTierOf("x") === null && BEST_HOURS.length === 2);
  ok("WINDOW_SCORE_TOP is the top hour tier on any day", WINDOW_SCORE_TOP === 30 && isBestTimeNow(30) && !isBestTimeNow(29) && !isBestTimeNow(null));
  ok("a shut window is null: Wednesday 07:30 Toronto", windowScore({ now: new Date("2026-09-09T11:30:00Z"), timeZone: TORONTO }) === null);
  ok("…and so is a jurisdiction's own shut window handed in: Oklahoma at 20:30 local (08:00–20:00)", windowScore({ now: new Date("2026-09-10T01:30:00Z"), timeZone: "America/Chicago", window: CALLING_JURISDICTIONS["US-OK"].window }) === null && windowScore({ now: new Date("2026-09-10T01:30:00Z"), timeZone: "America/Chicago" }) !== null);
  ok("an unusable zone, no zone, a bad clock: null, never a number", windowScore({ now: new Date(), timeZone: "Not/AZone" }) === null && windowScore({ now: new Date(), timeZone: null }) === null && windowScore({ now: "yesterday", timeZone: TORONTO }) === null && windowScore({ now: new Date(NaN), timeZone: TORONTO }) === null);
  // A split province: Ontario is Eastern AND Central. At 19:30Z on a
  // Wednesday it is 15:30 in Toronto (tier 3) and 14:30 in Winnipeg (tier
  // 1): the score is the worse half's, so a Kenora business is never
  // promoted on Toronto's clock.
  const split = windowScore({ now: WED_1530_TORONTO, timeZone: [TORONTO, "America/Winnipeg"] });
  ok("a split province is scored by its worse half: Toronto 34, Winnipeg 14 → 14", split === 14, split);
  ok("…and is null when either half is shut", windowScore({ now: new Date("2026-09-09T13:30:00Z"), timeZone: [TORONTO, "America/Winnipeg"] }) === null);
  ok("compareWindowScore: higher first, null last, equal is 0", compareWindowScore(34, 14) < 0 && compareWindowScore(null, 11) > 0 && compareWindowScore(21, 21) === 0);
  ok("callingWindowFor: the jurisdiction's window, the courtesy window, the Canadian default", callingWindowFor({ country: "US", province: "OK" }) === CALLING_JURISDICTIONS["US-OK"].window && callingWindowFor({}) === SALES_CALL_WINDOW && callingWindowFor({ country: "US", province: "CO" }) !== SALES_CALL_WINDOW);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. A whole week, every zone: scored iff open, and the tier follows the clock");

{
  const zones = [...new Set(Object.values(SUBDIVISION_TIME_ZONES).flat())];
  let checked = 0;
  let bad = null;
  for (const zone of zones) {
    for (let h = 0; h < 7 * 24 && !bad; h++) {
      const now = new Date(Date.UTC(2026, 8, 7, h, 15));
      const open = windowOpenAt(now, zone, SALES_CALL_WINDOW);
      const score = windowScore({ now, timeZone: zone });
      checked++;
      if (open === true && !Number.isFinite(score)) bad = { zone, now: now.toISOString(), open, score };
      else if (open !== true && score !== null) bad = { zone, now: now.toISOString(), open, score };
      else if (open === true) {
        const local = localTimeIn(zone, now);
        const expect = hourTierOf(local.minute) * 10 + dayTierOf(local.weekday);
        if (score !== expect) bad = { zone, now: now.toISOString(), score, expect };
      }
    }
  }
  ok(`${checked} instants across ${zones.length} zones: scored iff the window is open, and the score is the clock's tier`, bad === null, bad);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The held list: best window first, due retry still first, the chip on the top tier only");

{
  // Wednesday 19:30Z: Toronto 15:30 (top tier), Vancouver 12:30 (ordinary),
  // Halifax 16:30 (ordinary; shuts first at 21:30 local = 00:30Z).
  const now = WED_1530_TORONTO;
  const rows = [
    { id: "van", country: "CA", province: "BC", timeZone: VANCOUVER },
    { id: "hfx", country: "CA", province: "NS" },
    { id: "tor", country: "CA", province: "ON", timeZone: TORONTO },
  ];
  const g = groupByWindow(rows, { repZone: TORONTO, shiftEnd: shiftEndFrom({ now }), now, language: "en" });
  ok("all three are callable now", g.groups[0]?.kind === WINDOW_GROUP_NOW && g.groups[0].ids.length === 3, g.groups);
  ok("Toronto at 15:30 goes first, ahead of Halifax which shuts sooner", g.groups[0].ids[0] === "tor", g.groups[0].ids);
  ok("…then Halifax (shuts soonest among the ordinary hours), then Vancouver", g.groups[0].ids.join() === "tor,hfx,van", g.groups[0].ids);
  ok("windowFor carries the score and the chip: Toronto 34 chipped, the others not", g.byId.tor.windowScore === 34 && g.byId.tor.bestTimeNow === true && g.byId.van.windowScore === 14 && g.byId.van.bestTimeNow === false && g.byId.hfx.bestTimeNow === false);
  // A due retry on the Vancouver row: regroupForRetry moves it to the front
  // regardless of the score — the rotation aimed it at this hour.
  const retries = { van: retryViewFor({ attemptCount: 1, lastOutcome: "no_answer", nextAttemptAt: new Date(now.getTime() - 1000) }, { repZone: TORONTO, language: "en", now }) };
  const r = regroupForRetry(g, retries, { shiftEnd: shiftEndFrom({ now }), now });
  ok("a DUE RETRY still goes in front of the best-window row", r.groups[0].ids.join() === "van,tor,hfx", r.groups[0].ids);
  // Saturday: the day tier is 0; the hour tier still ranks.
  const sat = new Date("2026-09-12T19:30:00Z");
  const gs = groupByWindow(rows, { repZone: TORONTO, shiftEnd: shiftEndFrom({ now: sat }), now: sat, language: "en" });
  ok("Saturday 15:30 Toronto is still the top hour tier (30) and chipped", gs.byId.tor.windowScore === 30 && gs.byId.tor.bestTimeNow === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The batch top-up: the same key, and never over a shut window or a cap");

{
  const now = WED_1530_TORONTO;
  const shiftEnd = shiftEndFrom({ now });
  const cand = (id, over) => ({ id, createdAt: new Date("2026-09-01T00:00:00Z"), researched: false, recentlyReleased: false, readiness: { decision: CALL_ALLOWED, blockers: [] }, closesAt: null, retryDue: false, windowScore: null, ...over });
  const picked = selectBatch({
    candidates: [
      cand("shuts_soon", { closesAt: new Date(now.getTime() + 60 * 60 * 1000), researched: true, windowScore: 14 }),
      cand("best_hour", { closesAt: new Date(now.getTime() + 6 * 60 * 60 * 1000), windowScore: 34 }),
      cand("unscored", { closesAt: new Date(now.getTime() + 30 * 60 * 1000), windowScore: null }),
    ],
    shiftEnd,
    want: 25,
  });
  ok("selectBatch: the best hour outranks the row that shuts sooner and is researched", picked.ids[0] === "best_hour", picked.ids);
  ok("…an unscored row goes last, after the scored ones", picked.ids.join() === "best_hour,shuts_soon,unscored", picked.ids);
  const due = selectBatch({
    candidates: [
      cand("best_hour", { windowScore: 34 }),
      cand("due_retry", { windowScore: 11, retryDue: true }),
    ],
    shiftEnd,
    want: 25,
  });
  ok("…a due retry still goes first", due.ids[0] === "due_retry", due.ids);
  const shut = selectBatch({
    candidates: [
      cand("ordinary_open", { windowScore: 11 }),
      cand("shut_but_scored", { windowScore: 34, readiness: { decision: CALL_REFUSED, blockers: [{ code: "outside_window" }], opensAt: new Date(now.getTime() + 3600 * 1000) } }),
      cand("cap_held", { windowScore: 34, readiness: { decision: CALL_REFUSED, blockers: [{ code: "call_cap_reached" }] } }),
    ],
    shiftEnd,
    want: 25,
  });
  ok("a shut window is never taken, whatever the score", !shut.ids.includes("shut_but_scored"));
  ok("a jurisdiction cap holds the row out of the batch, whatever the score", !shut.ids.includes("cap_held") && shut.ids.join() === "ordinary_open", shut.ids);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The screen, the words, the wiring");

{
  const qw = decomment(read("lib/sales/queueWindows.js"));
  ok("queueWindows computes the score in the prospect's zone through resolveLeadTimeZone and the row's own window", /resolveLeadTimeZone\(\{ timeZone, country: prospect\.country, province: prospect\.province \}\)/.test(qw) && /windowScore\(\{ now, timeZone: zones, window: callingWindowFor\(prospect\) \}\)/.test(qw));
  ok("…sorts 'Callable now' by score before closing time", /scoreOf\(b\) - scoreOf\(a\) \|\| stamp\(a\.w\.closesAtIso\) - stamp\(b\.w\.closesAtIso\)/.test(qw));
  const qb = decomment(read("lib/sales/queueBatch.js"));
  ok("queueBatch scores each candidate the same way and sorts by it after the due-retry key", /windowScore: readiness\.decision === CALL_ALLOWED \? candidateWindowScore/.test(qb) && /if \(da !== dbb\) return da - dbb;[\s\S]*?windowScore[\s\S]*?if \(wa\.at !== wb\.at\) return wa\.at - wb\.at;/.test(qb));
  const page = decomment(read("app/sales/queue/page.js"));
  ok("the queue row draws the chip from the server's bestTimeNow", /bestTimeNow: Boolean\(w\?\.bestTimeNow\)/.test(page) && /app\.salesQueue\.bestTimeNow/.test(page));
  ok("…and not on a held retry", /!w\?\.retryHold/.test(page));
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`app.salesQueue.bestTimeNow exists in ${lang}`, typeof APP_MESSAGES[lang]["app.salesQueue.bestTimeNow"] === "string" && APP_MESSAGES[lang]["app.salesQueue.bestTimeNow"].length > 0);
  }
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9);
  const header = read("lib/sales/callWindowScore.js");
  ok("the header carries the Belkins figures", /175,000 dials/.test(header) && /9\.9 %/.test(header) && /24\.5 %/.test(header) && /3–4 pm/.test(header) && /Wednesday/.test(header));
  const pkg = JSON.parse(read("package.json"));
  ok("package.json has check:call-window-score", typeof pkg.scripts["check:call-window-score"] === "string");
  ok("…and check:all runs it", /check:call-window-score/.test(pkg.scripts["check:all"]));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
