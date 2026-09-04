// scripts/check-sales-calling-window.mjs
//
//   npm run check:sales-calling-window
//
// When a FieldQuo rep may ring a business, and the proof that the screen asks.
//
// ══ Why this check exists ══════════════════════════════════════════════════
//
// lib/sales/callingWindow.js shipped a correct calling window with NO
// PRODUCTION CALLER. The only importer was another check script. Meanwhile
// app/sales/queue/page.js rendered `href={`tel:${current.phoneE164}`}` with no
// window test of any kind, so a rep could dial at three in the morning and
// nothing stopped or warned them. Every static check in the repo was green
// throughout, because each one proved code CORRECT and none proved it
// REACHED.
//
// So the assertions below come in two kinds and both are load-bearing:
//
//   1. EXECUTION. The real shipped functions are run against the edges of each
//      statute — 07:59 and 08:00, 19:59 and 20:01, Saturday morning against a
//      weekday rule, a state that spans two zones, a jurisdiction nobody has
//      read. Reading this code cannot tell you whether 20:00 is inside or
//      outside; running it can.
//
//   2. REACHABILITY. That the queue screen has no way to render a dial control
//      without the gate having said yes, and that no sales path can reach the
//      automated voice dialler.
//
// ══ The reachability assertions are STRUCTURAL, not textual ════════════════
//
// A regex asserting "the tel: link sits inside the right JSX branch" is a
// check arguing with a formatter, and this project has had that produce a
// false pass more than once. So the design was changed to make the assertion
// executable: the page has no `tel:` string at all, and the only way to obtain
// one is dialHref(), which is CALLED below with each of the three decisions.
// The source rule left over is the simplest possible one — no `tel:` anywhere
// under app/sales — which survives any reformatting because it does not care
// where the string is, only that it does not exist.
//
// ══ The negative control ═══════════════════════════════════════════════════
//
// 47 U.S.C. 227(b)(1)(A)(iii) bans autodialled and artificial-voice calls to
// wireless numbers with NO business exemption, and contractors answer on
// mobiles. It is out of scope today only because no sales path reaches
// lib/voice/outboundCall.js. That is a property, not a fact, so the import
// graph is walked from every sales entry point and the run fails if it is ever
// reached. If that check ever goes red, the answer is not to edit the check.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

import {
  CALLING_JURISDICTIONS,
  CALL_ALLOWED,
  CALL_REFUSED,
  CALL_UNKNOWN,
  FIELDQUO_COURTESY_WINDOW,
  SUBDIVISION_TIME_ZONES,
  describeWindow,
  dialHref,
  jurisdictionFor,
  locationCodes,
  nextOpening,
  salesCallReadiness,
  zoneAgreement,
  zonesFor,
} from "@/lib/sales/callingRules";
import { localTimeIn, withinSalesCallingHours } from "@/lib/sales/callingWindow";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}`);

/** Comments stripped before any regex touches source. A rule named in a comment is not a rule. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function read(rel) {
  return stripComments(readFileSync(join(ROOT, rel), "utf8"));
}
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const at = (iso) => new Date(iso);
/** A prospect is only ever `{ country, province }` to this gate. */
const us = (province) => ({ country: "US", province });
const decide = (prospect, iso, extra = {}) =>
  salesCallReadiness({ prospect, now: at(iso), ...extra }).decision;

// ═══════════════════════════════════════════════════════════════════════════
section("1. The table says what it was read to say");
// ═══════════════════════════════════════════════════════════════════════════

for (const [key, row] of Object.entries(CALLING_JURISDICTIONS)) {
  ok(`${key} carries a citation`, typeof row.citation === "string" && row.citation.length > 40);
  ok(`${key} declares whether it was verified`, typeof row.verified === "boolean");
  // The single most dangerous row this table could hold: an unread
  // jurisdiction carrying a window, which would read as "we checked".
  if (!row.verified) {
    ok(`${key} is unverified and therefore carries NO window`, row.window === null, row.window);
    ok(`${key} is unverified and therefore carries no cap`, row.maxCallsPer24h === null);
  }
}

ok("Oklahoma is verified, 08:00–20:00, capped at 3 in 24h", (() => {
  const r = CALLING_JURISDICTIONS["US-OK"];
  return (
    r.verified &&
    r.window.weekday.startMinute === 480 &&
    r.window.weekday.endMinute === 1200 &&
    r.window.weekend.startMinute === 480 &&
    r.window.weekend.endMinute === 1200 &&
    r.maxCallsPer24h === 3
  );
})());

ok("Florida is verified, 08:00–20:00, capped at 3 in 24h", (() => {
  const r = CALLING_JURISDICTIONS["US-FL"];
  return r.verified && r.window.weekday.startMinute === 480 && r.window.weekday.endMinute === 1200 && r.maxCallsPer24h === 3;
})());
// The two Florida provisions are easy to confuse and only one of them is the
// calling-hours rule, so the citation has to name which and say the other is
// not it.
ok("Florida cites §501.616 and says in terms that §501.059 is not the rule",
  /501\.616/.test(CALLING_JURISDICTIONS["US-FL"].citation) &&
  /NOT §501\.059/.test(CALLING_JURISDICTIONS["US-FL"].citation));

ok("Washington is verified 08:00–20:00 on the RCW 19.158 basis, not 80.36", (() => {
  const r = CALLING_JURISDICTIONS["US-WA"];
  return r.verified && r.window.weekday.endMinute === 1200 && /19\.158\.110\(4\)/.test(r.citation);
})());
ok("Washington records that RCW 80.36.390 excludes B2B and does not lift the other statute",
  /80\.36\.390/.test(CALLING_JURISDICTIONS["US-WA"].citation));
ok("Washington carries the RCW 19.158.050 registration flag, unfiled",
  CALLING_JURISDICTIONS["US-WA"].registration?.required === true &&
  CALLING_JURISDICTIONS["US-WA"].registration?.done === false);

ok("Canada is the CRTC window, 09:00–21:30 weekday and 10:00–18:00 weekend", (() => {
  const r = CALLING_JURISDICTIONS.CA;
  return (
    r.verified &&
    r.window.weekday.startMinute === 540 && r.window.weekday.endMinute === 21 * 60 + 30 &&
    r.window.weekend.startMinute === 600 && r.window.weekend.endMinute === 1080
  );
})());
ok("Canada carries the National DNCL registration flag, unfiled",
  CALLING_JURISDICTIONS.CA.registration?.required === true &&
  CALLING_JURISDICTIONS.CA.registration?.done === false);

// Nevada is the row that proves the table can say "read, and imposes nothing"
// without that collapsing into "unread". Two different absences, two different
// spellings.
ok("Nevada is VERIFIED with no statutory window — a finding, not a gap",
  CALLING_JURISDICTIONS["US-NV"].verified === true && CALLING_JURISDICTIONS["US-NV"].window === null);
ok("Nevada's citation names NRS 624.110(1) and the absence of a restriction",
  /624\.110\(1\)/.test(CALLING_JURISDICTIONS["US-NV"].citation));

// ── Arizona: read, and the answer is a BAN rather than a window ────────────
//
// This slot used to assert Arizona was unverified. The read happened, and it
// found something a window cannot express: A.R.S. §44-1278(B)(3) prohibits an
// unsolicited sales call to any mobile number outright, and §44-1273(A)
// preserves that against every exemption. So Arizona is verified AND refuses,
// which is a third shape this table had no room for before.
ok("Arizona is verified and still refuses, on a flat prohibition rather than a window",
  CALLING_JURISDICTIONS["US-AZ"].verified === true &&
  CALLING_JURISDICTIONS["US-AZ"].window === null &&
  /44-1278\(B\)\(3\)/.test(CALLING_JURISDICTIONS["US-AZ"].prohibition?.fix || ""));
ok("Arizona keeps its data-acquisition rule alongside the prohibition",
  /39-121\.03/.test(CALLING_JURISDICTIONS["US-AZ"].dataAcquisition || ""));
ok("Texas is now VERIFIED, and its ch. 302 registration is confirmed rather than unknown", (() => {
  const r = CALLING_JURISDICTIONS["US-TX"];
  return (
    r.verified === true &&
    r.window === null &&
    r.registration?.required === true &&
    /302\.101/.test(r.registration?.what || "")
  );
})());
// The Texas finding that a survey table would get backwards: §302.056 reads
// like a B2B exemption and is not one.
ok("Texas records that §302.056 covers only resale and manufacturing, so it does NOT exempt this sale",
  /resell/.test(CALLING_JURISDICTIONS["US-TX"].registration?.what || "") &&
  /manufacturing/.test(CALLING_JURISDICTIONS["US-TX"].registration?.what || ""));

// ── The six that were "known to matter and not read" ───────────────────────
//
// All six were read. Maryland, New York, Mississippi and Connecticut turned
// out to have windows that bind; Louisiana and Indiana turned out not to.
// Asserted as VERIFIED now, which is the tripwire working in the direction it
// was pointed.
for (const code of ["US-MD", "US-NY", "US-MS", "US-LA", "US-IN", "US-CT"]) {
  ok(`${code} has been read and is now verified`,
    CALLING_JURISDICTIONS[code] && CALLING_JURISDICTIONS[code].verified === true);
}
ok("Maryland resolved the §14-4502 question: the B2B exemption is confined to subsection (a)",
  /14-4502\(c\)/.test(CALLING_JURISDICTIONS["US-MD"].citation) &&
  /This subsection does not apply to/.test(CALLING_JURISDICTIONS["US-MD"].citation));
// New York is the state a survey is most likely to get wrong, because the
// section WITH a B2B exemption is not the section with the hours rule.
ok("New York records that §399-pp's B2B exemption does not reach §399-z's window",
  /399-pp/.test(CALLING_JURISDICTIONS["US-NY"].citation) &&
  /399-z has no B2B exemption/.test(CALLING_JURISDICTIONS["US-NY"].citation));
ok("New York's window is 08:00–21:00, not the 08:00–20:00 shape copied from Florida", (() => {
  const w = CALLING_JURISDICTIONS["US-NY"].window;
  return w.weekday.startMinute === 480 && w.weekday.endMinute === 21 * 60;
})());
ok("Illinois cites the operative words that carry no residential limb",
  /No person shall solicit the sale of goods or services/.test(CALLING_JURISDICTIONS["US-IL"].citation));

// ── Pennsylvania: encoded forward, on purpose ──────────────────────────────
//
// The window in the table is the one Act 47 of 2026 imposes from October, not
// the one in force today, because the future one is narrower and cannot go
// wrong-permissive while nobody is looking. Asserted so that "fixing" it to
// today's wider 08:00–21:00 fails.
ok("Pennsylvania encodes the NARROWER post-Act-47 window, 09:00–19:00 with Sundays closed", (() => {
  const w = CALLING_JURISDICTIONS["US-PA"].window;
  return (
    w.weekday.startMinute === 9 * 60 &&
    w.weekday.endMinute === 19 * 60 &&
    (w.closedWeekdays || []).includes(0)
  );
})());
ok("Pennsylvania's citation says why it is forward-dated, and names the act",
  /Act 47/.test(CALLING_JURISDICTIONS["US-PA"].citation) &&
  /wrong-permissive/.test(CALLING_JURISDICTIONS["US-PA"].citation));

// ── Vermont and Iowa: read, and DELIBERATELY still refusing ────────────────
//
// Both are the case the Nevada row's comment warns about from the other side:
// "we searched and found no hours provision" is a weaker claim than "we read
// the scope words and they exclude this call", and only the second earns a
// verified row. Asserted so that a later tidy-up cannot promote them for
// looking similar to their neighbours.
for (const code of ["US-VT", "US-IA"]) {
  ok(`${code} is an ABSENCE finding and therefore stays unverified`,
    CALLING_JURISDICTIONS[code].verified === false &&
    CALLING_JURISDICTIONS[code].window === null);
}
ok("Vermont still surfaces its criminal registration duty despite being unverified",
  CALLING_JURISDICTIONS["US-VT"].registration?.required === true &&
  /18 months/.test(CALLING_JURISDICTIONS["US-VT"].registration?.what || ""));
ok("Iowa says its finding is an absence, not a scope reading",
  /negative proven by absence/.test(CALLING_JURISDICTIONS["US-IA"].citation));

ok("there is no US federal row to fall back to",
  CALLING_JURISDICTIONS.US === undefined && CALLING_JURISDICTIONS["US"] === undefined);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The edges of each verified window, executed");
// ═══════════════════════════════════════════════════════════════════════════

// A stated time zone is used for these, because the question here is what the
// STATUTE says at 07:59, not what a split state does. The split state gets its
// own section below.
const edge = (province, tz, iso, extra = {}) =>
  salesCallReadiness({ prospect: us(province), timeZone: tz, now: at(iso), ...extra }).decision;

// 2026-09-03 is a Thursday. America/Chicago is CDT (UTC-5) on that date.
ok("Oklahoma refuses 07:59 local", edge("OK", "America/Chicago", "2026-09-03T12:59:00Z") === CALL_REFUSED);
ok("Oklahoma allows 08:00 local", edge("OK", "America/Chicago", "2026-09-03T13:00:00Z") === CALL_ALLOWED);
ok("Oklahoma allows 19:59 local", edge("OK", "America/Chicago", "2026-09-04T00:59:00Z") === CALL_ALLOWED);
ok("Oklahoma refuses 20:01 local", edge("OK", "America/Chicago", "2026-09-04T01:01:00Z") === CALL_REFUSED);
ok("Oklahoma refuses 20:00 local exactly — the bound is exclusive at the top",
  edge("OK", "America/Chicago", "2026-09-04T01:00:00Z") === CALL_REFUSED);

// America/New_York is EDT (UTC-4) on that date.
ok("Florida refuses 07:59 local", edge("FL", "America/New_York", "2026-09-03T11:59:00Z") === CALL_REFUSED);
ok("Florida allows 08:00 local", edge("FL", "America/New_York", "2026-09-03T12:00:00Z") === CALL_ALLOWED);
ok("Florida allows 19:59 local", edge("FL", "America/New_York", "2026-09-03T23:59:00Z") === CALL_ALLOWED);
ok("Florida refuses 20:01 local", edge("FL", "America/New_York", "2026-09-04T00:01:00Z") === CALL_REFUSED);

// Washington is wholly Pacific, so the derived zone is unambiguous and no
// stated zone is needed — this is the one state where the whole chain runs.
ok("Washington refuses 07:59 local, from the address alone",
  decide(us("WA"), "2026-09-03T14:59:00Z") === CALL_REFUSED);
ok("Washington allows 08:00 local, from the address alone",
  decide(us("WA"), "2026-09-03T15:00:00Z") === CALL_ALLOWED);
ok("Washington refuses 20:01 local, from the address alone",
  decide(us("WA"), "2026-09-04T03:01:00Z") === CALL_REFUSED);

// Nevada has no statute, so FieldQuo's own courtesy window is what applies —
// and it must actually apply, or "no rule" would mean "call at 4am".
ok("Nevada refuses 03:00 local under FieldQuo's own window",
  decide(us("NV"), "2026-09-03T10:00:00Z") === CALL_REFUSED);
ok("Nevada allows 10:00 local", decide(us("NV"), "2026-09-03T17:00:00Z") === CALL_ALLOWED);
ok("the Nevada refusal says the rule is FieldQuo's, not Nevada's", (() => {
  const r = salesCallReadiness({ prospect: us("NV"), now: at("2026-09-03T10:00:00Z") });
  const fix = r.blockers.map((b) => b.fix).join(" ");
  return /FieldQuo's own rule/.test(fix) && /Nevada imposes none/.test(fix);
})());

// Canada: the weekday/weekend split is the thing an 8-to-8 copy would lose.
const ca = (iso) =>
  salesCallReadiness({
    prospect: { country: "CA", province: "ON" },
    timeZone: "America/Toronto",
    now: at(iso),
  }).decision;
ok("Canada refuses 08:59 on a weekday", ca("2026-09-03T12:59:00Z") === CALL_REFUSED);
ok("Canada allows 09:00 on a weekday", ca("2026-09-03T13:00:00Z") === CALL_ALLOWED);
ok("Canada allows 21:29 on a weekday", ca("2026-09-04T01:29:00Z") === CALL_ALLOWED);
ok("Canada refuses 21:30 on a weekday", ca("2026-09-04T01:30:00Z") === CALL_REFUSED);
// 2026-09-05 is a Saturday.
ok("Canada refuses 09:59 on a Saturday — the weekday start does not apply",
  ca("2026-09-05T13:59:00Z") === CALL_REFUSED);
ok("Canada allows 10:00 on a Saturday", ca("2026-09-05T14:00:00Z") === CALL_ALLOWED);
ok("Canada refuses 18:00 on a Saturday — three and a half hours before the weekday cutoff",
  ca("2026-09-05T22:00:00Z") === CALL_REFUSED);
ok("Canada resolves federally: Alberta and Ontario get the same row",
  jurisdictionFor({ country: "CA", province: "AB" }) === jurisdictionFor({ country: "CA", province: "ON" }));

// ═══════════════════════════════════════════════════════════════════════════
section("2b. Every verified state, at all four edges of its own window");
// ═══════════════════════════════════════════════════════════════════════════
//
// ══ Why a generated sweep and not thirty hand-written triples ══════════════
//
// Because a hand-written triple is written once, against the window that was
// in the table that day, and nothing ties it to the row afterwards. Change
// Georgia from 20:00 to 21:00 and the hand-written 20:01 assertion goes red
// for the right reason exactly once; change it in BOTH places, which is what a
// hurried edit does, and the check has stopped testing anything.
//
// So the edges are DERIVED from the row. The loop reads `window` out of
// CALLING_JURISDICTIONS and asks the shipped gate what it says one minute
// before the start, at the start, one minute before the end, at the end and
// one minute after — which means a wrong number in the table is still a wrong
// number, but a MISSING assertion is impossible.
//
// The hand-written edges in §2 stay. They are the ones that would catch this
// loop deriving its edges from the same mistake twice.

/**
 * The instant at which the wall clock in `zone` reads `minute` on `isoDate`.
 *
 * Two passes, and the second is not decoration. The first pass corrects a
 * naive UTC guess by the zone's offset AT THAT GUESS, which is the wrong
 * offset whenever the guess and the answer fall on opposite sides of a DST
 * transition — 02:30 on a spring-forward Sunday is the case that breaks it.
 * The second pass re-reads the offset at the corrected instant and lands.
 */
function instantAt(zone, isoDate, minute) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0) + minute * 60_000;
  const offsetAt = (t) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(t));
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return Date.UTC(p.year, p.month - 1, p.day, Number(p.hour) % 24, p.minute, p.second) - t;
  };
  let t = naive - offsetAt(naive);
  t = naive - offsetAt(t);
  return new Date(t);
}

// The helper's own control. Every boundary assertion below is worthless if
// instantAt is off by an hour, and an off-by-an-hour helper produces a run
// that is entirely green — the window simply gets tested at the wrong minutes.
// So it is checked against the shipped clock, on both sides of a DST boundary
// and in a zone that has no DST at all. 2026-11-01 is the US fall-back date.
for (const [zone, date] of [
  ["America/New_York", "2026-09-03"],
  ["America/New_York", "2026-11-02"],
  ["America/Chicago", "2026-03-09"],
  ["America/Phoenix", "2026-07-01"],
  ["Pacific/Honolulu", "2026-01-15"],
  ["America/Anchorage", "2026-09-03"],
]) {
  for (const minute of [0, 479, 480, 1199, 1200, 1259, 1439]) {
    const read = localTimeIn(zone, instantAt(zone, date, minute));
    ok(`instantAt lands on ${hhmmOf(minute)} in ${zone} on ${date}`, read?.minute === minute, read?.minute);
  }
}
function hhmmOf(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Every verified row that HAS a window, swept at its own edges.
 *
 * A stated time zone is used, because the question is what the STATUTE says at
 * its boundary, not what a two-zone state does about it — that is section 3's
 * job, and mixing the two produces a state whose split hides a wrong bound.
 * The zone used is the first one the subdivision map holds, so the assertion
 * exercises a zone this product would really evaluate that state in.
 *
 * Weekday and weekend are both swept. Every US window in this table happens to
 * be flat, and that is a fact about the rows rather than a property of the
 * code — Canada's is not flat, and a sweep that only ever looked at Thursdays
 * would not notice a state whose weekend bounds got typed wrong.
 */
const DAYS = [
  ["2026-09-03", "Thursday", "weekday", 4],
  ["2026-09-05", "Saturday", "weekend", 6],
  ["2026-09-06", "Sunday", "weekend", 0],
];

let sweptStates = 0;
for (const [key, row] of Object.entries(CALLING_JURISDICTIONS)) {
  if (!key.startsWith("US-") || !row.verified || !row.window) continue;
  const sub = key.slice(3);
  const zone = SUBDIVISION_TIME_ZONES[sub]?.[0];
  ok(`${key} has a time zone to be evaluated in at all`, Boolean(zone));
  if (!zone) continue;
  sweptStates++;

  for (const [date, dayName, half, weekdayNumber] of DAYS) {
    const bounds = row.window[half];
    const closed = (row.window.closedWeekdays || []).includes(weekdayNumber);
    const call = (minute) =>
      salesCallReadiness({
        prospect: us(sub),
        timeZone: zone,
        now: instantAt(zone, date, minute),
        // The cap is handed a zero so a capped state is not refused for the
        // wrong reason — this sweep is about the clock, and §4 owns the cap.
        attemptsLast24h: 0,
      }).decision;

    // ── A day the statute closes outright ────────────────────────────────
    //
    // Swept ACROSS the hours the window would otherwise have opened, not just
    // at midnight. A `closedWeekdays` implementation that forgot to check the
    // list would look correct at 03:00 — it is refused by the bounds anyway —
    // and be wrong for the whole trading day. That is the mutation this
    // branch exists to catch.
    if (closed) {
      for (const minute of [0, bounds.startMinute, bounds.startMinute + 1, 12 * 60, bounds.endMinute - 1, 23 * 60 + 59]) {
        ok(`${key} ${dayName} is closed outright: REFUSES ${hhmmOf(minute)}`,
          call(minute) === CALL_REFUSED, call(minute));
      }
      ok(`${key} says out loud that ${dayName}s are closed`,
        /no calls at all on/.test(describeWindow(row.window) || ""), describeWindow(row.window));
      continue;
    }

    ok(`${key} ${dayName}: REFUSES one minute before ${hhmmOf(bounds.startMinute)}`,
      call(bounds.startMinute - 1) === CALL_REFUSED, call(bounds.startMinute - 1));
    ok(`${key} ${dayName}: ALLOWS ${hhmmOf(bounds.startMinute)} exactly`,
      call(bounds.startMinute) === CALL_ALLOWED, call(bounds.startMinute));
    ok(`${key} ${dayName}: ALLOWS one minute before ${hhmmOf(bounds.endMinute)}`,
      call(bounds.endMinute - 1) === CALL_ALLOWED, call(bounds.endMinute - 1));
    ok(`${key} ${dayName}: REFUSES ${hhmmOf(bounds.endMinute)} exactly — the top bound is exclusive`,
      call(bounds.endMinute) === CALL_REFUSED, call(bounds.endMinute));
    ok(`${key} ${dayName}: REFUSES one minute after ${hhmmOf(bounds.endMinute)}`,
      call(bounds.endMinute + 1) === CALL_REFUSED, call(bounds.endMinute + 1));
    ok(`${key} ${dayName}: REFUSES the middle of the night`,
      call(3 * 60) === CALL_REFUSED, call(3 * 60));
  }
}
ok("the sweep actually swept some states — an empty loop is green and proves nothing",
  sweptStates >= 4, sweptStates);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Unknown is not allowed, in every way it can arise");
// ═══════════════════════════════════════════════════════════════════════════

const noon = "2026-09-03T17:00:00Z";

for (const code of ["VT", "IA"]) {
  const r = salesCallReadiness({ prospect: us(code), now: at(noon) });
  ok(`${code} is unverified and returns "unknown", not "allowed"`, r.decision === CALL_UNKNOWN, r.decision);
  ok(`${code}'s refusal names the statute nobody has read`,
    r.blockers.some((b) => b.code === "jurisdiction_unverified"));
}

// ── The states that were read, and now answer ──────────────────────────────
//
// This block used to hold CO, GA, OH, CA and MI as examples of the ordinary
// unlisted case. All five have been read, so the assertion is inverted: they
// must NO LONGER return unknown at a time their own rule permits. Kept as the
// same five states on purpose, so the diff shows what the read bought.
const NOON_ALLOWED = ["CO", "GA", "OH", "CA", "MI", "TX", "NY", "IL", "MA", "TN"];
for (const code of NOON_ALLOWED) {
  const zone = SUBDIVISION_TIME_ZONES[code][0];
  const r = salesCallReadiness({
    prospect: us(code),
    timeZone: zone,
    now: instantAt(zone, "2026-09-03", 12 * 60),
  });
  ok(`${code} has been read and is ALLOWED at noon on a Thursday`, r.decision === CALL_ALLOWED, r.decision);
  ok(`${code} no longer says nobody has read it`,
    !r.blockers.some((b) => b.code === "jurisdiction_unread" || b.code === "jurisdiction_unverified"));
}

// Arizona is read AND refuses, which is the shape that did not exist before.
// Asserted at a time of day no window would refuse, so it can only be the ban.
ok("Arizona refuses at noon on a Thursday — a ban, not a window", (() => {
  const r = salesCallReadiness({
    prospect: us("AZ"),
    timeZone: "America/Phoenix",
    now: instantAt("America/Phoenix", "2026-09-03", 12 * 60),
  });
  return r.decision === CALL_REFUSED && r.blockers.some((b) => b.code === "az_mobile_ban");
})());
ok("the Arizona refusal explains that waiting will not fix it", (() => {
  const r = salesCallReadiness({ prospect: us("AZ"), timeZone: "America/Phoenix", now: at(noon) });
  return /waiting does not fix it/.test(r.blockers.map((b) => b.fix).join(" "));
})());

// ── The unread branch, kept REACHABLE on purpose ───────────────────────────
//
// Once every state and DC had a row, `jurisdiction_unread` became unreachable,
// and a mutation making it return "allowed" passed the entire suite green.
// That is this check's own opening complaint — proving code correct without
// proving it reached — committed by the check itself.
//
// Puerto Rico restores it: a real US subdivision, really present in the
// Overture extract, with a real time zone and genuinely no law read. The
// assertion below must name `jurisdiction_unread` SPECIFICALLY and must not
// accept `location_unknown` in its place, because accepting either is how the
// vacuous version passed.
ok("a US subdivision with no jurisdiction row returns unknown", decide(us("PR"), noon) === CALL_UNKNOWN);
ok("...and says nobody has read it — NOT that we cannot tell where it is", (() => {
  const r = salesCallReadiness({ prospect: us("PR"), now: at(noon) });
  return (
    r.blockers.some((b) => b.code === "jurisdiction_unread") &&
    !r.blockers.some((b) => b.code === "location_unknown")
  );
})());
ok("Puerto Rico's location IS resolved — the gap is the statute, not the address",
  locationCodes({ country: "US", province: "PR" }).subdivision === "PR" &&
  zonesFor({ country: "US", province: "PR" }).length === 1);
// The invariant that keeps the branch honest. Stated as "some subdivision
// really produces this verdict" rather than "some key is missing from the
// table", because a Canadian code is missing from the US table too and would
// satisfy the weaker form without exercising anything.
ok("at least one subdivision really reaches the unread branch, so the mutation above stays catchable",
  Object.keys(SUBDIVISION_TIME_ZONES).some((sub) =>
    salesCallReadiness({ prospect: us(sub), now: at(noon) }).blockers.some(
      (b) => b.code === "jurisdiction_unread",
    ),
  ));

// No location at all.
ok("a prospect with no country or province is unknown",
  salesCallReadiness({ prospect: {}, now: at(noon) }).decision === CALL_UNKNOWN);
ok("a prospect with a province and no country is unknown — the country is never guessed",
  salesCallReadiness({ prospect: { province: "OK" }, now: at(noon) }).decision === CALL_UNKNOWN);
ok("a prospect with a country and no province is unknown",
  salesCallReadiness({ prospect: { country: "US" }, now: at(noon) }).decision === CALL_UNKNOWN);
ok("an unrecognised subdivision string is unknown",
  salesCallReadiness({ prospect: { country: "US", province: "ZZ" }, now: at(noon) }).decision === CALL_UNKNOWN);

// ── The time zone half ──────────────────────────────────────────────────────
ok("an unusable time zone reads as no time at all", localTimeIn("Nowhere/Nothing") === null);
ok("an empty time zone reads as no time at all", localTimeIn("") === null && localTimeIn(null) === null);
ok("withinSalesCallingHours REFUSES an unknown zone rather than defaulting",
  withinSalesCallingHours(at(noon), null).allowed === false &&
  withinSalesCallingHours(at(noon), "Nowhere/Nothing").allowed === false);
ok("and says waiting will not fix it",
  withinSalesCallingHours(at(noon), null).retryLater === false);
ok("zoneAgreement refuses to answer when a zone is unusable",
  zoneAgreement(FIELDQUO_COURTESY_WINDOW, ["America/Chicago", "Nowhere/Nothing"], at(noon)) === null);
ok("zoneAgreement refuses to answer with no zones at all",
  zoneAgreement(FIELDQUO_COURTESY_WINDOW, [], at(noon)) === null);
ok("a stated time zone that Intl cannot read is ignored, not trusted", (() => {
  const r = salesCallReadiness({ prospect: us("WA"), timeZone: "Nowhere/Nothing", now: at("2026-09-03T15:00:00Z") });
  return r.zoneSource === "derived" && r.zones.includes("America/Los_Angeles");
})());
ok("a stated time zone replaces the derived set when it is usable", (() => {
  const r = salesCallReadiness({ prospect: us("FL"), timeZone: "America/Chicago", now: at(noon) });
  return r.zoneSource === "stated" && r.zones.length === 1 && r.zones[0] === "America/Chicago";
})());

// ── A state that spans two zones ────────────────────────────────────────────
//
// Florida is the case that matters, because it is one of the two states with a
// private right of action and its panhandle is Central. At 08:30 Eastern it is
// 07:30 in Pensacola: allowed in one half, unlawful in the other. The answer
// must be "we cannot tell", never the populous half.
ok("Florida at 08:30 Eastern is UNKNOWN, not allowed — the panhandle is an hour behind",
  decide(us("FL"), "2026-09-03T12:30:00Z") === CALL_UNKNOWN);
ok("Florida at 08:30 Eastern is not REFUSED either — that would be a finding we did not make",
  decide(us("FL"), "2026-09-03T12:30:00Z") !== CALL_REFUSED);
ok("Florida at 09:00 Eastern is allowed — both halves agree",
  decide(us("FL"), "2026-09-03T13:00:00Z") === CALL_ALLOWED);
ok("Florida at 03:00 Eastern is REFUSED — both halves agree it is the middle of the night",
  decide(us("FL"), "2026-09-03T07:00:00Z") === CALL_REFUSED);
ok("the ambiguous answer offers the hour it becomes safe everywhere", (() => {
  const r = salesCallReadiness({ prospect: us("FL"), now: at("2026-09-03T12:30:00Z") });
  return (
    r.blockers.some((b) => b.code === "time_zone_ambiguous") &&
    typeof r.opensAtText === "string" &&
    r.opensAtText.length > 0
  );
})());
ok("Ontario is treated as spanning Eastern and Central",
  zonesFor({ country: "CA", province: "ON" }).length === 2 &&
  decide({ country: "CA", province: "ON" }, "2026-09-03T13:30:00Z") === CALL_UNKNOWN);
ok("Quebec resolves through its accented and French spellings",
  locationCodes({ country: "Canada", province: "Québec" }).subdivision === "QC" &&
  locationCodes({ country: "CA", province: "QC" }).subdivision === "QC");
ok("a hyphenated ISO subdivision resolves",
  locationCodes({ country: "US", province: "US-FL" }).subdivision === "FL");
ok("every subdivision in the zone map has at least one zone",
  Object.values(SUBDIVISION_TIME_ZONES).every((z) => Array.isArray(z) && z.length > 0));
ok("every zone name in the map is one Intl can actually read",
  Object.values(SUBDIVISION_TIME_ZONES)
    .flat()
    .every((z) => localTimeIn(z, at(noon)) !== null));

// ═══════════════════════════════════════════════════════════════════════════
section("4. The 24-hour cap, and the honesty about not counting it");
// ═══════════════════════════════════════════════════════════════════════════

const okAt = (extra) => salesCallReadiness({ prospect: us("OK"), timeZone: "America/Chicago", now: at(noon), ...extra });

ok("three calls already made refuses the fourth", okAt({ attemptsLast24h: 3 }).decision === CALL_REFUSED);
ok("four already made still refuses", okAt({ attemptsLast24h: 4 }).decision === CALL_REFUSED);
ok("two already made allows the third", okAt({ attemptsLast24h: 2 }).decision === CALL_ALLOWED);
ok("zero already made allows", okAt({ attemptsLast24h: 0 }).decision === CALL_ALLOWED);
ok("the cap refusal names the count", okAt({ attemptsLast24h: 3 }).blockers.some((b) => b.code === "call_cap_reached"));

// The gate's behaviour when nothing counts. This is still exercised after the
// table landed, because `attemptsLast24h` is null on every path that cannot
// count — a handset dial from a screen that never queried, a number that will
// not normalise — and "cannot count" must go on reading as `unenforced` rather
// than collapsing into a cleared cap.
ok("an uncounted cap is reported as unenforced, not silently ignored", (() => {
  const r = okAt({});
  return r.decision === CALL_ALLOWED && r.unenforced.some((u) => u.code === "call_cap_uncounted");
})());
ok("Florida reports the same uncounted cap",
  salesCallReadiness({ prospect: us("FL"), timeZone: "America/New_York", now: at(noon) })
    .unenforced.some((u) => u.code === "call_cap_uncounted"));
ok("a jurisdiction with no cap reports nothing unenforced",
  salesCallReadiness({ prospect: us("WA"), now: at("2026-09-03T17:00:00Z") }).unenforced.length === 0);
// ── The tripwire, tripped, and what replaced it ────────────────────────────
//
// This slot used to assert the OPPOSITE: that `model SalesCallAttempt` was
// absent from prisma/schema.prisma, with the message "if this fails, wire the
// cap up". The model landed, so it failed, so the cap got wired up — which is
// the entire job that assertion existed to do.
//
// It is replaced rather than deleted, and replaced by the thing it was
// standing in for: the cap is only enforced if the route that dials actually
// COUNTS. A schema with the table in it and a route that never queries it is
// the same uncounted cap as before, dressed as a fixed one.
ok("the table the cap is counted on exists", (() => {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  return /model\s+SalesCallAttempt\b/.test(schema);
})());
ok("the dial route counts the cap and hands the count to the gate", (() => {
  const route = readFileSync(join(ROOT, "app/api/sales/calls/route.js"), "utf8");
  const counted = /await\s+attemptsLast24h\(/.test(route);
  // The gate call's argument object is sliced out before it is searched. A
  // lazy span from the call to the first match reaches the same field name in
  // the response body further down and passes after the field was deleted from
  // the gate call — check-sales-call-handling.mjs records that exact mutation.
  const open = route.indexOf("salesCallReadiness({");
  const close = open === -1 ? -1 : route.indexOf("});", open);
  const args = open === -1 || close === -1 ? "" : route.slice(open, close);
  return counted && /attemptsLast24h:\s*attempts24h/.test(args);
})());

// ── Registration ────────────────────────────────────────────────────────────
ok("Washington warns that registration is outstanding, and still evaluates the hours", (() => {
  const r = salesCallReadiness({ prospect: us("WA"), now: at("2026-09-03T15:00:00Z") });
  return r.decision === CALL_ALLOWED && r.warnings.some((w) => w.code === "registration_outstanding");
})());
ok("Canada warns that the National DNCL registration is outstanding",
  salesCallReadiness({ prospect: { country: "CA", province: "AB" }, timeZone: "America/Edmonton", now: at("2026-09-03T17:00:00Z") })
    .warnings.some((w) => w.code === "registration_outstanding"));
// Texas is now the case that proves a warning does NOT gate the call: its
// registration is outstanding and unexempted, and the dial still goes ahead
// with the warning beside it — because nothing here can know whether the
// certificate is in the drawer. That is this file's stated design, and Texas
// is where it costs the most if it is wrong.
ok("Texas is allowed inside its hours while its registration warning stands", (() => {
  const r = salesCallReadiness({
    prospect: us("TX"),
    timeZone: "America/Chicago",
    now: instantAt("America/Chicago", "2026-09-03", 12 * 60),
  });
  return r.decision === CALL_ALLOWED && r.warnings.some((w) => w.code === "registration_outstanding");
})());
ok("six states carry an outstanding registration warning, not one", (() => {
  const flagged = Object.entries(CALLING_JURISDICTIONS).filter(
    ([, row]) => row.registration?.required === true && row.registration?.done === false,
  );
  return flagged.length >= 6;
})());
ok("Arizona surfaces its data-acquisition rule as a warning",
  salesCallReadiness({ prospect: us("AZ"), now: at(noon) })
    .warnings.some((w) => w.code === "data_acquisition_rule"));

// ── The holiday bans, said out loud rather than silently not applied ───────
//
// Alabama, Utah and Rhode Island each close holidays as well as Sundays, and
// no holiday calendar is encoded — deliberately, because a half-built one is
// AGENTS.md failure class #5. The honest alternative is to SAY so on the
// screen, which is the same move the uncounted 24-hour cap makes. If this ever
// goes quiet, a rep is being told a state is clear on Thanksgiving.
for (const [code, zone] of [["AL", "America/Chicago"], ["UT", "America/Denver"], ["RI", "America/New_York"]]) {
  const r = salesCallReadiness({
    prospect: us(code),
    timeZone: zone,
    now: instantAt(zone, "2026-09-03", 12 * 60),
  });
  ok(`${code} is allowed at noon on a working Thursday`, r.decision === CALL_ALLOWED, r.decision);
  ok(`${code} says out loud that its holiday ban is not being counted`,
    r.unenforced.some((u) => u.code === "closed_holidays"));
}
ok("a state with no hand-enforced rule reports none",
  salesCallReadiness({
    prospect: us("IL"),
    timeZone: "America/Chicago",
    now: instantAt("America/Chicago", "2026-09-03", 12 * 60),
  }).unenforced.length === 0);

// ── A verified state with NO statutory window still gets a window ─────────
//
// The Nevada rule, now applying to twenty-odd states. The danger of a large
// `window: null` population is that "no statute" quietly becomes "no limit",
// so the courtesy window is asserted on the two biggest of them, and the
// attribution is asserted with it — a rep told "Texas forbids this" would be
// told something false and would find out.
for (const [code, zone] of [["CA", "America/Los_Angeles"], ["TX", "America/Chicago"]]) {
  ok(`${code} has no statutory window and is still refused at 03:00`,
    salesCallReadiness({ prospect: us(code), timeZone: zone, now: instantAt(zone, "2026-09-03", 3 * 60) })
      .decision === CALL_REFUSED);
  ok(`the ${code} refusal says the rule is FieldQuo's own, not the state's`, (() => {
    const r = salesCallReadiness({
      prospect: us(code), timeZone: zone, now: instantAt(zone, "2026-09-03", 3 * 60),
    });
    const fix = r.blockers.map((b) => b.fix).join(" ");
    return /FieldQuo's own rule/.test(fix) && new RegExp(`${CALLING_JURISDICTIONS[`US-${code}`].name} imposes none`).test(fix);
  })());
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The dial control cannot exist without a yes");
// ═══════════════════════════════════════════════════════════════════════════

ok("dialHref builds a target from an allowed decision",
  dialHref({ decision: CALL_ALLOWED }, "+15551234567") === "tel:+15551234567");
ok("dialHref returns NOTHING from a refusal", dialHref({ decision: CALL_REFUSED }, "+15551234567") === null);
ok("dialHref returns NOTHING from an unknown", dialHref({ decision: CALL_UNKNOWN }, "+15551234567") === null);
ok("dialHref returns nothing with no decision at all", dialHref(null, "+15551234567") === null);
ok("dialHref returns nothing with no phone number",
  dialHref({ decision: CALL_ALLOWED }, "") === null && dialHref({ decision: CALL_ALLOWED }, null) === null);
ok("dialHref refuses an unrecognised decision string rather than treating it as a yes",
  dialHref({ decision: "probably" }, "+15551234567") === null);

// The end-to-end version: a real refusal fed to dialHref produces nothing.
ok("a real out-of-hours refusal produces no dial target",
  dialHref(
    salesCallReadiness({ prospect: us("OK"), timeZone: "America/Chicago", now: at("2026-09-04T01:01:00Z") }),
    "+15551234567",
  ) === null);
ok("a real unknown-jurisdiction verdict produces no dial target",
  dialHref(salesCallReadiness({ prospect: us("IA"), now: at(noon) }), "+15551234567") === null);
// And the new refusal shape: a flat prohibition must be as unable to produce a
// dial target as an out-of-hours refusal is.
ok("a real prohibition verdict produces no dial target",
  dialHref(
    salesCallReadiness({ prospect: us("AZ"), timeZone: "America/Phoenix", now: at(noon) }),
    "+15551234567",
  ) === null);

// ── The source rule that makes the above the ONLY route ────────────────────
const SALES_TREES = ["app/sales", "app/api/sales"];
const telOffenders = [];
for (const tree of SALES_TREES) {
  for (const file of walk(join(ROOT, tree))) {
    if (/tel:/.test(stripComments(readFileSync(file, "utf8")))) {
      telOffenders.push(relative(ROOT, file));
    }
  }
}
ok("no sales screen or route builds a `tel:` target of its own", telOffenders.length === 0, telOffenders);

const queuePage = read("app/sales/queue/page.js");
ok("the queue page imports the gate", /from\s+"@\/lib\/sales\/callingRules"/.test(queuePage));
ok("the queue page calls dialHref", /\bdialHref\s*\(/.test(queuePage));
ok("the queue page calls the gate itself, so the window closes while it is open",
  /\bsalesCallReadiness\s*\(/.test(queuePage));

// A citation that reaches nobody is the safe-looking half of failure class #1
// — written, never read. It used to be true of every VERIFIED row: the only
// path to `citation` was the "nobody has read this" blocker, so the rows that
// let a call happen cited their statute to no one.
ok("the queue page shows a verified jurisdiction's citation to the rep",
  /compliance\.citation/.test(queuePage) && /jurisdiction\?\.verified/.test(queuePage));

const queueRoute = read("app/api/sales/queue/route.js");
ok("the queue route consults the gate too", /\bsalesCallReadiness\s*\(/.test(queueRoute));
ok("the queue route stamps its own clock so the screen does not trust the rep's machine",
  /serverNow/.test(queueRoute));
ok("the queue route reads a stated time zone off the lead", /timeZone/.test(queueRoute));

// ═══════════════════════════════════════════════════════════════════════════
section("6. NEGATIVE CONTROL — no sales path reaches the automated dialler");
// ═══════════════════════════════════════════════════════════════════════════

const FORBIDDEN = resolve(ROOT, "lib/voice/outboundCall.js");

/** Resolve one import specifier to a file on disk, or null for a package. */
function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // a node_modules package; nothing of ours behind it
  for (const candidate of [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.jsx`,
    join(base, "index.js"),
    join(base, "index.mjs"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return resolve(candidate);
  }
  return null;
}

function specifiersIn(file) {
  const src = stripComments(readFileSync(file, "utf8"));
  const out = [];
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) out.push(m[1]);
  return out;
}

const seeds = [...walk(join(ROOT, "app/sales")), ...walk(join(ROOT, "app/api/sales")), ...walk(join(ROOT, "lib/sales"))];
const seen = new Set();
/** file → the file that first pulled it in, so a hit can be reported as a path. */
const via = new Map();
const stack = seeds.map((f) => resolve(f));
for (const s of stack) via.set(s, null);

let reached = null;
while (stack.length) {
  const file = stack.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  if (file === FORBIDDEN) {
    reached = file;
    break;
  }
  for (const spec of specifiersIn(file)) {
    const target = resolveSpecifier(spec, file);
    if (!target || seen.has(target)) continue;
    if (!via.has(target)) via.set(target, file);
    stack.push(target);
  }
}

function chainTo(file) {
  const parts = [];
  let cursor = file;
  while (cursor) {
    parts.unshift(relative(ROOT, cursor));
    cursor = via.get(cursor) || null;
    if (parts.length > 12) break;
  }
  return parts.join(" → ");
}

ok(
  "lib/voice/outboundCall.js is unreachable from every sales entry point — " +
    "this is what keeps 47 U.S.C. 227(b)(1)(A)(iii) out of scope",
  reached === null,
  reached ? chainTo(reached) : undefined,
);
ok("the walk actually walked something — a graph of one file proves nothing",
  seen.size > 60, seen.size);
ok("the walk can see lib/voice/outboundCall.js exists, so the target is not a typo",
  existsSync(FORBIDDEN));
// The walk's own control: the forbidden file IS reachable from the tenant
// paths, so a `reached === null` above means "sales does not touch it", not
// "the resolver is broken".
{
  const tenantSeeds = [resolve(ROOT, "app/api/quotes/[id]/call/route.js")];
  const tenantSeen = new Set();
  const tstack = [...tenantSeeds];
  let tenantReached = false;
  while (tstack.length) {
    const file = tstack.pop();
    if (tenantSeen.has(file)) continue;
    tenantSeen.add(file);
    if (file === FORBIDDEN) {
      tenantReached = true;
      break;
    }
    for (const spec of specifiersIn(file)) {
      const target = resolveSpecifier(spec, file);
      if (target && !tenantSeen.has(target)) tstack.push(target);
    }
  }
  ok("the same walk DOES reach it from a tenant route, proving the resolver works", tenantReached);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The window sentence is derived, never retyped");
// ═══════════════════════════════════════════════════════════════════════════

ok("a flat window is described as flat", describeWindow(FIELDQUO_COURTESY_WINDOW) === "08:00–20:00 every day, in the prospect's own time zone");
ok("a split window names both halves", (() => {
  const text = describeWindow(CALLING_JURISDICTIONS.CA.window);
  return /09:00–21:30 weekdays/.test(text) && /10:00–18:00 weekends/.test(text);
})());
ok("describeWindow says nothing about a jurisdiction with no window", describeWindow(null) === null);
ok("nextOpening lands exactly on the boundary, not a minute past", (() => {
  const opens = nextOpening(FIELDQUO_COURTESY_WINDOW, ["America/Chicago"], at("2026-09-03T12:30:00Z"));
  return localTimeIn("America/Chicago", opens).minute === 480;
})());
ok("nextOpening gives up rather than looping on an unusable zone",
  nextOpening(FIELDQUO_COURTESY_WINDOW, ["Nowhere/Nothing"], at(noon)) === null);

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
