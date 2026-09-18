// scripts/check-area-code-zone.mjs
//
//   node scripts/check-area-code-zone.mjs
//
// The area-code → time-zone table pre-fills a select a rep confirms. It is
// never a decision (see the header of lib/sales/areaCodeZone.js), but a wrong
// pre-fill is still a wrong pre-fill a tired rep will accept, so the table is
// checked the way a pricing table would be.
//
// ══ What is asserted ══════════════════════════════════════════════════════
//
//   1. Every key is an N-X-X area code, never N11.
//   2. Every non-null value is a zone Intl resolves — a typo or a deprecated
//      alias would pre-fill a select option that does not exist.
//   3. Every Canadian area code in lib/voice/nanp.js has an entry (null is an
//      entry — a split code is a decision, an absent one is an oversight), and
//      every Canadian code maps to a Canadian zone; every US code to a US one.
//      This is what catches "604": "America/New_York".
//   4. No area code outside the US and Canada is in the table: FieldQuo does
//      not text Jamaica and must not pretend to know its clock.
//   5. Spot checks, including the ones a rep would hit first (819, 716, 604),
//      the splits the table must refuse (807, 250, 928), and the shapes the
//      number parser must reject.
//
// ══ Executed, no network ══════════════════════════════════════════════════
//
// Relative imports, not `@/`, so plain Node runs it from the repo root.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// 807 was set to Toronto, 604 to New_York, 819 was deleted, Jamaica's 876
// was added, "Pacific/Honolulu" was misspelt, and the number parser was
// loosened to accept ten bare digits. All six fail. Removing the N11 guard
// in zoneForAreaCode does NOT fail — 911 is not a key, so the table answers
// null without it — which is why that guard is described in the source as
// belt-and-braces and the 911 case below asserts the answer, not the path.
// Restored from a `cp` backup, never from git.
import {
  AREA_CODE_ZONES,
  zoneForAreaCode,
  suggestZoneForNumber,
} from "../lib/sales/areaCodeZone.js";
import {
  CANADIAN_AREA_CODES,
  NANP_OUTSIDE_US_CA_AREA_CODES,
} from "../lib/voice/nanp.js";

let failures = 0;
function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}
function ok(condition, message) {
  if (!condition) fail(message);
}

const CANADIAN_ZONES = new Set([
  "America/Toronto", "America/Winnipeg", "America/Regina", "America/Edmonton",
  "America/Vancouver", "America/Moncton", "America/Halifax", "America/St_Johns",
]);
const US_ZONES = new Set([
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
  "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
  "America/Puerto_Rico", "Pacific/Guam", "Pacific/Pago_Pago",
]);

// ── 1 and 2: shape of every key, validity of every value ────────────────
ok(Object.isFrozen(AREA_CODE_ZONES), "AREA_CODE_ZONES must be frozen");
let total = 0;
let split = 0;
for (const [code, zone] of Object.entries(AREA_CODE_ZONES)) {
  total += 1;
  ok(/^[2-9]\d\d$/.test(code) && !/^\d11$/.test(code), `${code} is not an N-X-X area code`);
  if (zone === null) {
    split += 1;
    continue;
  }
  ok(typeof zone === "string", `${code} maps to ${typeof zone}, not a zone string or null`);
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
  } catch {
    fail(`${code} maps to "${zone}", which Intl does not resolve`);
  }
  ok(
    CANADIAN_ZONES.has(zone) || US_ZONES.has(zone),
    `${code} maps to "${zone}", which is not one of the canonical names the table is allowed to use`,
  );
}

// ── 3: Canada is complete, and each country's codes stay in its zones ───
const canadian = new Set(CANADIAN_AREA_CODES);
for (const code of CANADIAN_AREA_CODES) {
  ok(code in AREA_CODE_ZONES, `Canadian area code ${code} has no entry (null is an entry; absence is not)`);
}
for (const [code, zone] of Object.entries(AREA_CODE_ZONES)) {
  if (zone === null) continue;
  if (canadian.has(code)) {
    ok(CANADIAN_ZONES.has(zone), `Canadian area code ${code} maps to a non-Canadian zone "${zone}"`);
  } else {
    ok(US_ZONES.has(zone), `US area code ${code} maps to a non-US zone "${zone}"`);
  }
}

// ── 4: nothing outside the US and Canada ────────────────────────────────
for (const code of NANP_OUTSIDE_US_CA_AREA_CODES) {
  ok(!(code in AREA_CODE_ZONES), `${code} is outside the US and Canada and must not be in the table`);
  ok(zoneForAreaCode(code) === null, `zoneForAreaCode(${code}) must be null for a non-US/CA code`);
}

// ── 5: spot checks ──────────────────────────────────────────────────────
const zoneCases = [
  ["819", "America/Toronto"],
  ["716", "America/New_York"],
  ["604", "America/Vancouver"],
  ["204", "America/Winnipeg"],
  ["306", "America/Regina"],
  ["403", "America/Edmonton"],
  ["506", "America/Moncton"],
  ["902", "America/Halifax"],
  ["807", null],
  ["250", null],
  ["867", null],
  ["928", null],
  ["915", "America/Denver"],
  ["808", "Pacific/Honolulu"],
  ["907", "America/Anchorage"],
  ["602", "America/Phoenix"],
  ["787", "America/Puerto_Rico"],
  ["911", null],
  ["411", null],
  ["800", null],
  ["100", null],
  ["1234", null],
  ["", null],
  [null, null],
  [undefined, null],
  [819, "America/Toronto"],
];
for (const [input, expected] of zoneCases) {
  const got = zoneForAreaCode(input);
  ok(got === expected, `zoneForAreaCode(${JSON.stringify(input)}) → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
}

const numberCases = [
  ["+18193459008", { areaCode: "819", timeZone: "America/Toronto" }],
  ["+17165550123", { areaCode: "716", timeZone: "America/New_York" }],
  // A split code still names the area code, so the screen can say why it asks.
  ["+18075550123", { areaCode: "807", timeZone: null }],
  // A NANP number FieldQuo does not text: the code is read, the zone is not.
  ["+18765550123", { areaCode: "876", timeZone: null }],
  ["+447700900123", null],
  ["+1819345900", null], // one digit short
  ["+181934590081", null], // one digit long
  ["8193459008", null], // no +1
  ["+1 819 345 9008", null], // formatted, not E.164
  ["+11193459008", null], // area code cannot start with 1
  ["+18191459008", null], // exchange cannot start with 1
  ["", null],
  [null, null],
  [undefined, null],
  [18193459008, null],
];
for (const [input, expected] of numberCases) {
  const got = suggestZoneForNumber(input);
  ok(
    JSON.stringify(got) === JSON.stringify(expected),
    `suggestZoneForNumber(${JSON.stringify(input)}) → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
  );
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`ok: ${total} area codes, ${split} split`);
