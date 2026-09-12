#!/usr/bin/env node
//
// scripts/check-queue-windows.mjs
//
//   npm run check:queue-windows
//
// The day's list grouped by when a row can be rung, in the rep's own clock —
// executed against the real calling rules, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. groupByWindow at 8 am Eastern: Eastern and Atlantic callable, Central
//      opens at 09:00 ET (Illinois, 08:00 local), a Central row under a
//      09:00 rule opens at 10:00 ET (Manitoba), Mountain at 10:00, Pacific
//      at 11:00 — every instant COMPUTED from lib/sales/callingRules.js, none
//      typed here; Phoenix (no DST) shares Pacific's instant in September and
//      is named beside it; a garbage zone with no province lands in "not
//      callable" with a reason; a row opening after the shift is "later".
//   2. At 1 pm Eastern everything is callable and sorted by closing time,
//      Atlantic before Eastern before Pacific.
//   3. At 8 pm Eastern a Maryland row (08:00–20:00) has closed for the day
//      and lands in "not callable today" with the shift bound, or in an
//      "opens tomorrow" group without it — dated, never a bare time.
//   4. A Pacific rep reads the same instants three hours earlier, in Spanish.
//   5. The dialler walks the grouped order: it does not cross into a later
//      group, waits for it, and dials its first row when re-asked at the
//      instant — through the gates, so a paused rep gets nothing.
//   6. Source: the route calls groupByWindow with the rep's zone and the
//      ledger's shift; the page draws a header per group with its count and
//      a zone chip per row; the strings exist in all nine languages; the
//      check is in check:all.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed.
// Sources are decommented before a regex touches them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WINDOW_GROUP_LATER,
  WINDOW_GROUP_NOW,
  WINDOW_GROUP_OPENS,
  groupByWindow,
  repClock,
  windowFor,
  zoneAcronym,
  zoneLongName,
  zoneShortName,
  ZONE_ACRONYMS,
} from "@/lib/sales/queueWindows";
import { SHIFT_HOURS, shiftEndFrom } from "@/lib/sales/queueBatch";
import { CALL_ALLOWED, salesCallReadiness } from "@/lib/sales/callingRules";
import { AUTODIAL_REASONS, nextDial } from "@/lib/sales/autodial";
import { STATE_AVAILABLE, STATE_PAUSED } from "@/lib/sales/calls/agentState";
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
const section = (heading) => console.log(`\n${heading}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// Fixture: a Friday in September. Every instant below is derived, not typed.
// ═══════════════════════════════════════════════════════════════════════════

const ET = "America/New_York";
const PT = "America/Los_Angeles";
const EIGHT_ET = new Date("2026-09-11T12:00:00Z");
const ONE_PM_ET = new Date("2026-09-11T17:00:00Z");
const EIGHT_PM_ET = new Date("2026-09-12T00:00:00Z");

const rows = [
  { id: "ny", country: "US", province: "NY" }, // Eastern, 08:00–21:00
  { id: "ns", country: "CA", province: "NS" }, // Atlantic, Canada 09:00–21:30
  { id: "il", country: "US", province: "IL" }, // Central, 08:00–21:00
  { id: "mb", country: "CA", province: "MB" }, // Central under a 09:00 rule
  { id: "co", country: "US", province: "CO" }, // Mountain, courtesy 08:00–20:00
  { id: "ca", country: "US", province: "CA" }, // Pacific, courtesy 08:00–20:00
  { id: "phx", country: "US", province: "CA", timeZone: "America/Phoenix" }, // stated Phoenix, no DST
  { id: "bad", country: "US", province: null, timeZone: "Mars/Olympus" }, // garbage, nowhere
  { id: "az", country: "US", province: "AZ" }, // prohibited outright
];

/** What the rules say a row opens at, from the same function the screen uses. */
function opensAt(row, now) {
  return salesCallReadiness({ prospect: { country: row.country, province: row.province }, timeZone: row.timeZone || null, now }).opensAt;
}
const hhmm = (at, zone) => new Intl.DateTimeFormat("en", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

// ═══════════════════════════════════════════════════════════════════════════
section("1. 8 am Eastern: callable now, then one group per opening, then not today");
// ═══════════════════════════════════════════════════════════════════════════

{
  const shiftEnd = shiftEndFrom({ now: EIGHT_ET }); // 15:00 ET
  const r = groupByWindow(rows, { repZone: ET, shiftEnd, now: EIGHT_ET, language: "en" });
  const kinds = r.groups.map((g) => g.kind);
  ok("groups come as now → opens… → later", kinds[0] === WINDOW_GROUP_NOW && kinds[kinds.length - 1] === WINDOW_GROUP_LATER && kinds.slice(1, -1).every((k) => k === WINDOW_GROUP_OPENS), kinds);
  const now_ = r.groups[0];
  ok("Eastern and Atlantic are callable now", now_.ids.slice().sort().join(",") === "ns,ny", now_.ids);
  ok("…Atlantic first: Nova Scotia shuts at 21:30 AT = 20:30 ET, New York at 21:00 ET", now_.ids.join(",") === "ns,ny" && r.byId.ns.closesAtLocal === "20:30" && r.byId.ny.closesAtLocal === "21:00", { ns: r.byId.ns.closesAtLocal, ny: r.byId.ny.closesAtLocal });
  ok("…and the group's count is its size", now_.count === 2);

  const opens = r.groups.filter((g) => g.kind === WINDOW_GROUP_OPENS);
  const expectIl = opensAt(rows[2], EIGHT_ET);
  const expectMb = opensAt(rows[3], EIGHT_ET);
  const expectCo = opensAt(rows[4], EIGHT_ET);
  const expectCa = opensAt(rows[5], EIGHT_ET);
  ok("Illinois opens when the rules say (08:00 CT = 09:00 ET), in the rep's clock", opens[0]?.ids.join(",") === "il" && opens[0].opensAtIso === expectIl.toISOString() && opens[0].opensAtLocal === hhmm(expectIl, ET) && opens[0].opensAtLocal === "09:00", opens[0]);
  ok("Manitoba — Central under Canada's 09:00 rule — opens at 10:00 ET, NOT with Illinois", opens[1]?.ids.includes("mb") && !opens[0].ids.includes("mb") && opens[1].opensAtIso === expectMb.toISOString() && opens[1].opensAtLocal === "10:00", opens[1]);
  ok("…so the same zone appears in two groups: the key is the instant, the label names the zone", /Central Time/.test(opens[0].zoneLabel) && /Central Time/.test(opens[1].zoneLabel) && opens[0].key !== opens[1].key, { a: opens[0].zoneLabel, b: opens[1].zoneLabel });
  ok("Colorado opens at 10:00 ET — the SAME instant as Manitoba, so one group with both", opens[1].ids.includes("co") ? opens[1].ids.join(",") === "mb,co" && opens[1].zoneLabel === "Central Time, Mountain Time" : false, opens[1]);
  ok("…and the instants are the rules', not this file's", expectCo.getTime() === expectMb.getTime() && opens[1].opensAtIso === expectCo.toISOString());
  const pacific = opens.find((g) => g.ids.includes("ca"));
  ok("California opens at 11:00 ET", pacific && pacific.opensAtIso === expectCa.toISOString() && pacific.opensAtLocal === "11:00", pacific);
  ok("Phoenix (MST, no DST) shares Pacific's instant in September and is named beside it, not folded into it", pacific?.ids.join(",") === "ca,phx" && pacific.zoneLabel === "Pacific Time, Mountain Standard Time" && pacific.zones.join(",") === `${PT},America/Phoenix`, pacific);
  ok("the opens groups are in opening order", opens.every((g, i) => i === 0 || Date.parse(g.opensAtIso) >= Date.parse(opens[i - 1].opensAtIso)));
  ok("there are exactly three opening instants: 09:00, 10:00, 11:00", opens.map((g) => g.opensAtLocal).join(",") === "09:00,10:00,11:00", opens.map((g) => g.opensAtLocal));

  const later = r.groups[r.groups.length - 1];
  ok("the garbage zone with no province is not callable, with the rules' reason", later.ids.includes("bad") && r.byId.bad.reasonCode === "location_unknown" && r.byId.bad.callableNow === false && r.byId.bad.opensAtIso === null, r.byId.bad);
  ok("…and Arizona's prohibition is there too, by its blocker's code", later.ids.includes("az") && typeof r.byId.az.reasonCode === "string" && r.byId.az.reasonCode !== "opens_after_shift", r.byId.az);
  ok("the order is every id once, groups in sequence", r.order.length === rows.length && new Set(r.order).size === rows.length && r.order.join(",") === r.groups.flatMap((g) => g.ids).join(","), r.order);
  ok("every row knows its group key", rows.every((row) => r.groups.some((g) => g.key === r.byId[row.id].group && g.ids.includes(row.id))));

  // The chip: Intl's short name in the rep's language, at the instant.
  ok("each row carries its zone as a chip: EDT, ADT, CDT, MDT, PDT, MST", ["ny", "ns", "il", "co", "ca", "phx"].map((id) => r.byId[id].zoneShort).join(",") === "EDT,ADT,CDT,MDT,PDT,MST", ["ny", "ns", "il", "co", "ca", "phx"].map((id) => r.byId[id].zoneShort));
  ok("…and its IANA id", r.byId.phx.zone === "America/Phoenix" && r.byId.ns.zone === "America/Halifax");
  ok("a stated zone outranks the derived one: the Phoenix row is judged in Phoenix, not California", r.byId.phx.zone === "America/Phoenix");

  // The shift bound: a Hawaiian row opens 08:00 HST = 14:00 ET, inside a
  // 15:00 shift end; a Honolulu-stated row under Canada's 09:00 rule opens at
  // 15:00 ET and is NOT before 15:00 — later.
  const edge = groupByWindow(
    [{ id: "hi", country: "US", province: "HI" }, { id: "hi9", country: "CA", province: "BC", timeZone: "Pacific/Honolulu" }],
    { repZone: ET, shiftEnd, now: EIGHT_ET },
  );
  ok("a row opening inside the shift is an 'opens' group; one opening at the shift's end is 'later' with opens_after_shift", edge.byId.hi.kind === WINDOW_GROUP_OPENS && edge.byId.hi.opensAtLocal === "14:00" && edge.byId.hi9.kind === WINDOW_GROUP_LATER && edge.byId.hi9.reasonCode === "opens_after_shift" && edge.byId.hi9.opensAtLocal === "15:00", { hi: edge.byId.hi, hi9: edge.byId.hi9 });
  ok(`…the shift bound is SHIFT_HOURS (${SHIFT_HOURS}) from the start, the same instant selectBatch judged`, shiftEnd.toISOString() === "2026-09-11T19:00:00.000Z");
  ok("with no shift bound every opening is today's", groupByWindow([{ id: "hi9", country: "CA", province: "BC", timeZone: "Pacific/Honolulu" }], { repZone: ET, now: EIGHT_ET }).byId.hi9.kind === WINDOW_GROUP_OPENS);
}

// ═══════════════════════════════════════════════════════════════════════════
section("1b. The chips' acronyms: ET · CT · MT · PT · AT · NT, run through Intl");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner: "fix them by time zones with a little tab — ET, PT, the
// acronyms". Executed for the nine zones a row can carry, in September (DST)
// and in January, because "EDT"/"EST" is the trap the generic form avoids.
{
  const JAN = new Date("2026-01-15T17:00:00Z");
  const expect = [
    ["America/New_York", "ET"], ["America/Toronto", "ET"], ["America/Chicago", "CT"], ["America/Winnipeg", "CT"],
    ["America/Denver", "MT"], ["America/Phoenix", "MT"], ["America/Los_Angeles", "PT"], ["America/Vancouver", "PT"],
    ["America/Halifax", "AT"], ["America/St_Johns", "NT"],
  ];
  for (const [zone, want] of expect) {
    ok(`${zone} → ${want} in September`, zoneAcronym(zone, { at: EIGHT_ET }) === want, zoneAcronym(zone, { at: EIGHT_ET }));
    ok(`${zone} → ${want} in January`, zoneAcronym(zone, { at: JAN }) === want, zoneAcronym(zone, { at: JAN }));
  }
  ok("the six the list wears are the exported set", ZONE_ACRONYMS.join(",") === "ET,CT,MT,PT,AT,NT");
  ok("a zone outside the six falls back to its short form, never to nothing", typeof zoneAcronym("Pacific/Honolulu", { at: EIGHT_ET }) === "string" && zoneAcronym("Pacific/Honolulu", { at: EIGHT_ET }).length > 0 && !ZONE_ACRONYMS.includes(zoneAcronym("Pacific/Honolulu", { at: EIGHT_ET })), zoneAcronym("Pacific/Honolulu", { at: EIGHT_ET }));
  ok("garbage is echoed as itself, not thrown", zoneAcronym("Mars/Olympus", { at: EIGHT_ET }) === "Mars/Olympus" && zoneAcronym(null) === null);
  const r = groupByWindow(rows, { repZone: ET, shiftEnd: shiftEndFrom({ now: EIGHT_ET }), now: EIGHT_ET, language: "fr" });
  ok("every grouped row carries its acronym — English even for a French rep", r.byId.ny.zoneAcronym === "ET" && r.byId.ca.zoneAcronym === "PT" && r.byId.ns.zoneAcronym === "AT" && r.byId.il.zoneAcronym === "CT", { ny: r.byId.ny.zoneAcronym, ca: r.byId.ca.zoneAcronym });
  // The filter keeps the grouping: selecting PT leaves the "opens" group
  // with only its Pacific rows and drops a group with none — the same
  // shape the console's QueueList draws (a group hides when its filtered
  // ids are empty; the running number keeps counting across groups).
  const keep = new Set(Object.keys(r.byId).filter((id) => r.byId[id].zoneAcronym === "PT"));
  const filtered = r.groups.map((g) => ({ kind: g.kind, ids: g.ids.filter((id) => keep.has(id)) })).filter((g) => g.ids.length);
  ok("filtering to PT keeps the window grouping and only the Pacific rows", filtered.length >= 1 && filtered.every((g) => g.ids.every((id) => r.byId[id].zoneAcronym === "PT")) && filtered.some((g) => g.ids.includes("ca")), filtered);
  ok("…and the console filters inside the groups rather than re-grouping", /group\.ids\.filter\(\(id\) => !visibleIds \|\| visibleIds\.has\(id\)\)/.test(decomment(read("app/sales/queue/page.js"))) && /item\.window\?\.zoneAcronym === zoneFilter/.test(decomment(read("app/sales/queue/page.js"))));
  ok("…and the walk (Next, the autodialler) follows the filtered list", /walkItems\.map\(\(item\) => \(\{/.test(decomment(read("app/sales/queue/page.js"))) && /\[walkItems\],\n/.test(decomment(read("app/sales/queue/page.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. 1 pm Eastern: everything callable, shuts-soonest first");
// ═══════════════════════════════════════════════════════════════════════════

{
  const r = groupByWindow(rows, { repZone: ET, shiftEnd: shiftEndFrom({ now: ONE_PM_ET }), now: ONE_PM_ET });
  ok("one callable group holds every window row; the later group holds only the two that can never be rung", r.groups.length === 2 && r.groups[0].kind === WINDOW_GROUP_NOW && r.groups[0].count === 7 && r.groups[1].ids.slice().sort().join(",") === "az,bad", r.groups.map((g) => [g.kind, g.ids]));
  const order = r.groups[0].ids;
  const closes = order.map((id) => Date.parse(r.byId[id].closesAtIso));
  ok("…sorted by closing time ascending", closes.every((t, i) => i === 0 || t >= closes[i - 1]), order.map((id) => [id, r.byId[id].closesAtLocal]));
  ok("…Atlantic (20:30 ET) before Eastern (21:00) before Colorado (22:00) before Pacific and Phoenix (23:00)", order.indexOf("ns") < order.indexOf("ny") && order.indexOf("ny") < order.indexOf("co") && order.indexOf("co") < order.indexOf("ca") && r.byId.ns.closesAtLocal === "20:30" && r.byId.ca.closesAtLocal === "23:00", order);
  ok("ties keep claim order: California before Phoenix, Illinois before Manitoba is decided by the clock (IL 22:00, MB 22:30)", order.indexOf("ca") < order.indexOf("phx") && order.indexOf("il") < order.indexOf("mb"), order);
  ok("no row has an opening time when it is open now", order.every((id) => r.byId[id].opensAtIso === null && r.byId[id].callableNow === true));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. 8 pm Eastern: a window that closed for the day");
// ═══════════════════════════════════════════════════════════════════════════

{
  const md = [{ id: "md", country: "US", province: "MD" }, { id: "ny", country: "US", province: "NY" }];
  const bounded = groupByWindow(md, { repZone: ET, shiftEnd: shiftEndFrom({ now: EIGHT_PM_ET }), now: EIGHT_PM_ET });
  ok("Maryland (08:00–20:00) is shut at 20:00 and opens tomorrow — after a shift that ends at 03:00 — so it is 'not callable today'", bounded.byId.md.kind === WINDOW_GROUP_LATER && bounded.byId.md.reasonCode === "opens_after_shift", bounded.byId.md);
  ok("…while New York (to 21:00) is still callable", bounded.byId.ny.kind === WINDOW_GROUP_NOW && bounded.byId.ny.closesAtLocal === "21:00");
  const open = groupByWindow(md, { repZone: ET, now: EIGHT_PM_ET });
  ok("with no shift bound the same row is an opens group dated TOMORROW, never a bare '08:00' that reads as today", open.byId.md.kind === WINDOW_GROUP_OPENS && /12/.test(open.byId.md.opensAtLocal) && /08:00/.test(open.byId.md.opensAtLocal) && open.byId.md.opensAtLocal !== "08:00", open.byId.md.opensAtLocal);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. A Pacific rep, in Spanish: the same instants on their own clock");
// ═══════════════════════════════════════════════════════════════════════════

{
  const en = groupByWindow(rows, { repZone: ET, shiftEnd: shiftEndFrom({ now: EIGHT_ET }), now: EIGHT_ET, language: "en" });
  const es = groupByWindow(rows, { repZone: PT, shiftEnd: shiftEndFrom({ now: EIGHT_ET }), now: EIGHT_ET, language: "es" });
  ok("the grouping is identical — the rep's zone changes the labels, never the rule", en.order.join(",") === es.order.join(",") && en.groups.map((g) => g.opensAtIso).join("|") === es.groups.map((g) => g.opensAtIso).join("|"));
  const pacific = es.groups.find((g) => g.ids.includes("ca"));
  ok("California's 11:00 ET reads as 08:00 for a Pacific rep", pacific?.opensAtLocal === "08:00", pacific?.opensAtLocal);
  ok("…and the group is named in Spanish, from Intl, not a table", /Pacífico/.test(pacific?.zoneLabel || "") && /Montañas/.test(pacific?.zoneLabel || ""), pacific?.zoneLabel);
  ok("the chip too: what CLDR has for Spanish (an offset), never an English abbreviation pasted in", es.byId.ca.zoneShort === zoneShortName(PT, { language: "es", at: EIGHT_ET }) && es.byId.ca.zoneShort !== "PDT", es.byId.ca.zoneShort);
  ok("Nova Scotia's closing reads 17:30 on a Pacific clock", es.byId.ns.closesAtLocal === "17:30", es.byId.ns.closesAtLocal);
  ok("zoneLongName falls back rather than blanking: a garbage zone yields the id it was given", zoneLongName("Mars/Olympus") === "Mars/Olympus" && zoneLongName(null) === null && zoneShortName("Mars/Olympus") === "Mars/Olympus");
  ok("repClock with no usable rep zone says UTC out loud", /UTC$/.test(repClock(EIGHT_ET, { repZone: "Mars/Olympus", now: EIGHT_ET })) && /UTC$/.test(repClock(EIGHT_ET, { repZone: null, now: EIGHT_ET })));
  ok("repClock refuses garbage instants", repClock(null) === null && repClock(new Date("x")) === null);
  ok("windowFor on its own agrees with the grouped answer", (() => {
    const w = windowFor({ prospect: { country: "US", province: "CA" }, repZone: ET, now: EIGHT_ET });
    return w.kind === WINDOW_GROUP_OPENS && w.opensAtLocal === "11:00" && w.callableNow === false && w.decision !== CALL_ALLOWED;
  })());
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The dialler walks the groups and waits at a wall");
// ═══════════════════════════════════════════════════════════════════════════

{
  const r = groupByWindow(rows, { repZone: ET, shiftEnd: shiftEndFrom({ now: EIGHT_ET }), now: EIGHT_ET });
  const order = r.order.map((id) => ({ id, dialled: false, opensAt: r.byId[id].callableNow ? null : r.byId[id].opensAtIso }));
  const base = { order, cursor: null, readiness: { decision: "allowed" }, state: STATE_AVAILABLE, switchOn: true, callUp: false, inboundRinging: false, browserReady: true, now: EIGHT_ET.getTime() };
  ok("at 8 am it dials the first callable row — Nova Scotia, which shuts first", nextDial(base).dial === "ns");
  const afterNow = order.map((row) => (r.byId[row.id].callableNow ? { ...row, dialled: true } : row));
  const w = nextDial({ ...base, order: afterNow, cursor: "ny" });
  const il = r.groups.find((g) => g.ids.includes("il"));
  ok("with both callable rows dialled it WAITS for Illinois at 09:00 ET rather than dialling it", w.wait === "il" && w.reason === AUTODIAL_REASONS.window_not_open && w.opensAt === Date.parse(il.opensAtIso) && w.count === 1, w);
  ok("…and does not cross into Manitoba, Colorado or Pacific to find something", !("dial" in w) && !("skip" in w));
  ok("re-asked at the instant, it dials Illinois", nextDial({ ...base, order: afterNow, cursor: "ny", now: Date.parse(il.opensAtIso) }).dial === "il");
  ok("re-asked at the instant by a rep who paused, it says paused — never a dial from a pause", nextDial({ ...base, order: afterNow, cursor: "ny", now: Date.parse(il.opensAtIso), state: STATE_PAUSED }).reason === AUTODIAL_REASONS.not_available);
  ok("re-asked at the instant with the switch off, it says switch off", nextDial({ ...base, order: afterNow, cursor: "ny", now: Date.parse(il.opensAtIso), switchOn: false }).reason === AUTODIAL_REASONS.switch_off);
  const withIl = afterNow.map((row) => (row.id === "il" ? { ...row, dialled: true } : row));
  const w2 = nextDial({ ...base, order: withIl, cursor: "il", now: Date.parse(il.opensAtIso) + 60_000 });
  const ten = r.groups.find((g) => g.ids.includes("mb"));
  ok("then it waits for the 10:00 group — Manitoba and Colorado, counted together", w2.wait === "mb" && w2.count === 2 && w2.opensAt === Date.parse(ten.opensAtIso), w2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Source: the route, the page, the strings, the wiring");
// ═══════════════════════════════════════════════════════════════════════════

const route = decomment(read("app/api/sales/queue/route.js"));
const page = decomment(read("app/sales/queue/page.js"));
const control = decomment(read("app/components/sales/AutodialControl.js"));
const lib = decomment(read("lib/sales/queueWindows.js"));

ok("the route groups the held rows with the rep's zone, the ledger's shift and the rep's language", /groupByWindow\(\s*inClaimOrder\.map/.test(route) && /\{ repZone: zone, shiftEnd, now, language: lang, policyContext \}/.test(route));
ok("…and serves the list in the grouped order, with the groups beside it", /const claimed = windows\.order\.map\(\(id\) => byId\.get\(id\)\)/.test(route) && /queue\.windows = \{/.test(route) && /groups: windows\.groups/.test(route));
ok("…each row carrying windowFor's answer, never a second decision", /window: windows\.byId\[p\.id\] \|\| null/.test(route) && !/nextClosing\(/.test(route));
ok("the rep's zone comes from the browser the way the batch claim's does, and the language beside it", /url\.searchParams\.get\("timeZone"\)/.test(route) && /url\.searchParams\.get\("language"\)/.test(route) && /repLanguageOrNull\(language\) \|\| "en"/.test(route));
ok("the library evaluates the window through salesCallReadiness and closes it through nextClosing — no rule of its own", /salesCallReadiness\(\{\s*prospect,\s*timeZone,\s*now,\s*language,\s*windowPolicy: policyContext \? windowPolicyFor\(prospect, policyContext\) : null,\s*\}\)/.test(lib) && /nextClosing\(\{ prospect, timeZone, now \}\)/.test(lib) && !/startMinute|endMinute/.test(lib));
ok("…zone names come from Intl in the rep's language, never a table", /timeZoneName: style/.test(lib) && /"longGeneric"/.test(lib) && /"short"/.test(lib) && !/"Pacific Time"|"Eastern Time"/.test(lib));
ok("the page sends its language with the zone", /search\.set\("language", language\)/.test(page) && /timeZone: browserTimeZone\(\), language,/.test(page));
ok("the page draws one header per group with its count, and the 'later' group's sentence", /groups\.map\(\(group\) =>/.test(page) && /groupTitle\(group, t\)/.test(page) && /\{group\.count\}/.test(page) && /app\.salesQueue\.windowGroup\.laterNote/.test(page));
ok("…the three group titles are keys, with the time and zone as values", /app\.salesQueue\.windowGroup\.now/.test(page) && /app\.salesQueue\.windowGroup\.later"/.test(page) && /t\("app\.salesQueue\.windowGroup\.opensAt", \{ time: group\.opensAtLocal \|\| "", zone: group\.zoneLabel \}\)/.test(page));
ok("…each row shows its zone chip and the server's rep-clock time", /\{meta\.zone\}/.test(page) && /zone: w\?\.zoneShort \|\| null/.test(page) && /time: w\.opensAtLocal/.test(page) && /time: w\.closesAtLocal/.test(page));
ok("…and the row number runs across groups", /position \+= 1;/.test(page) && /\{position\}\./.test(page));
ok("the page keeps the old dial-order fallback for a response with no groups", /kind: "all"/.test(page));
ok("the control prints the wait with the count, the rep-clock time and the zone", /app\.salesAutodial\.waitingForWindow/.test(control) && /count: auto\.waiting\.count/.test(control) && /time: auto\.waiting\.opensAtLocal/.test(control) && /zone: auto\.waiting\.zoneLabel/.test(control));

const KEYS = [
  "app.salesQueue.windowGroup.now",
  "app.salesQueue.windowGroup.opensAt",
  "app.salesQueue.windowGroup.opensAtNoZone",
  "app.salesQueue.windowGroup.later",
  "app.salesQueue.windowGroup.laterNote",
  "app.salesAutodial.waitingForWindow",
  "app.salesAutodial.waitingForWindowNoZone",
  "app.salesAutodial.waitingForWindowNote",
];
const langs = Object.keys(APP_MESSAGES);
ok("nine languages", langs.length === 9, langs);
for (const key of KEYS) {
  ok(`${key} exists in all nine`, langs.every((l) => typeof APP_MESSAGES[l][key] === "string" && APP_MESSAGES[l][key].trim().length > 0), langs.filter((l) => typeof APP_MESSAGES[l][key] !== "string"));
}
ok("the opens-at label carries {time} and {zone} in every language", langs.every((l) => /\{time\}/.test(APP_MESSAGES[l]["app.salesQueue.windowGroup.opensAt"]) && /\{zone\}/.test(APP_MESSAGES[l]["app.salesQueue.windowGroup.opensAt"])));
ok("the wait sentence carries {count}, {time} and {zone} in every language", langs.every((l) => ["{count}", "{time}", "{zone}"].every((p) => APP_MESSAGES[l]["app.salesAutodial.waitingForWindow"].includes(p))));
// 2026-09-11: the batch is what is open NOW and tops itself up; the note
// says so, and no longer promises the shift. The skip sentences still name
// the shift, which is still the bound.
ok("the batch note says open now, and that the next batch adds itself", /open right now/.test(APP_MESSAGES.en["app.salesQueue.claimBatchNote"]) && /on its own/.test(APP_MESSAGES.en["app.salesQueue.claimBatchNote"]) && !/day ends/.test(APP_MESSAGES.en["app.salesQueue.claimBatchNote"]) && /shift/.test(APP_MESSAGES.en["app.salesQueue.batchSkippedForWindow"]) && /shift/.test(APP_MESSAGES.en["app.salesQueue.batchReason.noneCallableToday"]));
ok("…and carries {threshold} in every language", Object.keys(APP_MESSAGES).every((l) => /\{threshold\}/.test(APP_MESSAGES[l]["app.salesQueue.claimBatchNote"])));
ok("…and no language still says 'journée / jornada / Tag' in the batch note", !/journée/.test(APP_MESSAGES.fr["app.salesQueue.claimBatchNote"]) && !/jornada/.test(APP_MESSAGES.es["app.salesQueue.claimBatchNote"]) && !/Tages/.test(APP_MESSAGES.de["app.salesQueue.claimBatchNote"]));

const pkg = JSON.parse(read("package.json"));
ok("check:queue-windows exists", typeof pkg.scripts["check:queue-windows"] === "string");
ok("…and check:all runs it", /npm run check:queue-windows\b/.test(pkg.scripts["check:all"]));

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  failures.length === 0
    ? `\nALL PASS — ${pass} checks`
    : `\n${pass} passed, ${failures.length} FAILED\n` + failures.map((f) => `  ✗ ${f}`).join("\n"),
);
process.exit(failures.length ? 1 : 0);
