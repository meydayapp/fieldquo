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

ok("Arizona is UNVERIFIED for hours while carrying its data-acquisition rule",
  CALLING_JURISDICTIONS["US-AZ"].verified === false &&
  /39-121\.03/.test(CALLING_JURISDICTIONS["US-AZ"].dataAcquisition || ""));
ok("Texas is unverified and its ch. 302 registration is flagged as unknown",
  CALLING_JURISDICTIONS["US-TX"].verified === false &&
  CALLING_JURISDICTIONS["US-TX"].registration?.required === true &&
  /302/.test(CALLING_JURISDICTIONS["US-TX"].registration?.what || ""));

for (const code of ["US-MD", "US-NY", "US-MS", "US-LA", "US-IN", "US-CT"]) {
  ok(`${code} is listed as unread rather than omitted`,
    CALLING_JURISDICTIONS[code] && CALLING_JURISDICTIONS[code].verified === false);
}
ok("Maryland names the specific provision that could not be verified",
  /14-4502/.test(CALLING_JURISDICTIONS["US-MD"].citation));

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
section("3. Unknown is not allowed, in every way it can arise");
// ═══════════════════════════════════════════════════════════════════════════

const noon = "2026-09-03T17:00:00Z";

for (const code of ["TX", "MD", "NY", "MS", "LA", "IN", "AZ", "CT"]) {
  const r = salesCallReadiness({ prospect: us(code), now: at(noon) });
  ok(`${code} is unverified and returns "unknown", not "allowed"`, r.decision === CALL_UNKNOWN, r.decision);
  ok(`${code}'s refusal names the statute nobody has read`,
    r.blockers.some((b) => b.code === "jurisdiction_unverified"));
}

// An unlisted state is the ordinary case — 40-odd of them — and it must be
// unknown rather than falling to a comfortable federal 8-to-9 that does not
// exist for these calls.
for (const code of ["CO", "GA", "OH", "CA", "MI"]) {
  ok(`${code} is unlisted and returns "unknown"`, decide(us(code), noon) === CALL_UNKNOWN);
}
ok("an unlisted state says nobody has read it, rather than naming a window",
  salesCallReadiness({ prospect: us("CO"), now: at(noon) }).blockers.some(
    (b) => b.code === "jurisdiction_unread",
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
ok("Texas carries BOTH its unverified hours and its registration flag", (() => {
  const r = salesCallReadiness({ prospect: us("TX"), now: at(noon) });
  return (
    r.decision === CALL_UNKNOWN &&
    r.blockers.some((b) => b.code === "jurisdiction_unverified") &&
    r.warnings.some((w) => w.code === "registration_outstanding")
  );
})());
ok("Arizona surfaces its data-acquisition rule as a warning",
  salesCallReadiness({ prospect: us("AZ"), now: at(noon) })
    .warnings.some((w) => w.code === "data_acquisition_rule"));

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
  dialHref(salesCallReadiness({ prospect: us("CO"), now: at(noon) }), "+15551234567") === null);

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
