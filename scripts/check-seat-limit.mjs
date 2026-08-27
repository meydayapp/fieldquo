// scripts/check-seat-limit.mjs
//
// The cap, which did not exist until the owner walked straight through it.
//
// He was on Solo — one seat, five crew — and created an Administrator. Nothing
// stopped him, because the seat counter was honest and the limit was decorative.
// His words: "the owner account should be counted as one seat, given that they
// are using all the tools."
//
// ══ Two caps, not one ══════════════════════════════════════════════════════
//
// My first version gated seats only, reasoning that crew are free so nothing
// should stop them. That is wrong about the product: a tier is "1 seat and 5
// crew", not "1 seat and as many crew as you like". Free is not unlimited.
//
// And they must close INDEPENDENTLY. A Solo owner with five crew still cannot
// add a manager; a Solo owner whose seat is taken can still add crew. One
// disabled button beside one live one is the honest picture, and collapsing
// them into a single "team is full" is a lie in both directions.
//
// ══ No auto-add ════════════════════════════════════════════════════════════
//
// The owner ruled that out explicitly. Adding a seat at the extra-seat price
// and telling them afterwards is money moving without anybody pressing
// anything, which comes back as a chargeback and a support thread about what
// the software did on its own.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-seat-limit.mjs

import { seatCheck, seatLimitMessage } from "@/lib/pricing/seatLimit";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const SOLO = { seats: 1, crewSeats: 5, tierKey: "solo" };
const CREWTIER = { seats: 3, crewSeats: 8, tierKey: "crew" };
const LEGACY = { seats: null, crewSeats: null, tierKey: null };

const as = (preset) => ({
  role: PRESET_TO_ROLE[preset],
  permissions: PERMISSION_PRESETS[preset].values,
});
const owner = { role: "owner", permissions: null };
const admin = { role: "admin", permissions: null };
const crew = as("worker");
const estimator = as("estimator");
const dispatcher = as("dispatcher");

console.log("\nThe owner's own case");
const hisCase = seatCheck({ roster: [owner], plan: SOLO, incoming: admin });
ok("an Administrator on Solo is REFUSED", hisCase.allowed === false);
ok("...for the seat cap, not the crew cap", hisCase.reason === "seat_limit", hisCase.reason);
// He said it himself: the owner uses every tool, so the owner is a seat.
ok("the owner already counts as the one seat", hisCase.seatsUsed === 1, hisCase.seatsUsed);
ok("and the refusal names the next tier up",
  /Crew covers 3 seats and 8 crew/.test(seatLimitMessage(hisCase)));

console.log("\nEvery paid role consumes the seat");
for (const [label, who] of [["an admin", admin], ["a dispatcher", dispatcher], ["an estimator", estimator]]) {
  ok(`${label} is refused on a full Solo`,
    seatCheck({ roster: [owner], plan: SOLO, incoming: who }).allowed === false);
}
// Estimator is the interesting one: role `employee`, but it writes quotes.
ok("...including Estimator, whose ROLE is employee",
  PRESET_TO_ROLE.estimator === "employee" &&
    seatCheck({ roster: [owner], plan: SOLO, incoming: estimator }).allowed === false);

console.log("\nThe two caps close independently");
ok("a full seat does NOT block crew",
  seatCheck({ roster: [owner], plan: SOLO, incoming: crew }).allowed === true);
const fiveCrew = [owner, crew, crew, crew, crew, crew];
ok("a full crew DOES block a sixth crew member",
  seatCheck({ roster: fiveCrew, plan: SOLO, incoming: crew }).allowed === false);
ok("...and says so as the CREW cap, not the seat cap",
  seatCheck({ roster: fiveCrew, plan: SOLO, incoming: crew }).reason === "crew_limit");
// Somebody stopped from adding a painter must not be told about seats.
ok("...and the message never mentions seats",
  !/use a seat/.test(seatLimitMessage(seatCheck({ roster: fiveCrew, plan: SOLO, incoming: crew }))));
ok("four crew still leaves room for a fifth",
  seatCheck({ roster: [owner, crew, crew, crew, crew], plan: SOLO, incoming: crew }).allowed === true);

console.log("\nA bigger tier fits");
ok("Crew tier takes a second seat", seatCheck({ roster: [owner], plan: CREWTIER, incoming: admin }).allowed === true);
ok("...and a third", seatCheck({ roster: [owner, admin], plan: CREWTIER, incoming: dispatcher }).allowed === true);
ok("but not a fourth",
  seatCheck({ roster: [owner, admin, dispatcher], plan: CREWTIER, incoming: estimator }).allowed === false);

console.log("\nNobody is locked out by a cap that arrived after they did");
// Every company predates this. Enforcing retroactively would cut a working
// shop down to one login, which is not a pricing rule, it is an outage.
const over = seatCheck({ roster: [owner, admin, dispatcher], plan: SOLO });
ok("an over-limit company is not 'blocked' when merely asked about", over.allowed === true);
ok("...and the overage is reported", over.over === 2, over.over);
ok("...but the next seat is still refused",
  seatCheck({ roster: [owner, admin, dispatcher], plan: SOLO, incoming: estimator }).allowed === false);

console.log("\nA plan with no stated cap cannot be exceeded");
// Legacy per-headcount rows were never sold with a seat promise.
ok("legacy plans allow anyone", seatCheck({ roster: [owner, admin], plan: LEGACY, incoming: admin }).allowed === true);
ok("...and say why", seatCheck({ roster: [owner], plan: LEGACY }).reason === "no_seat_limit");
ok("no plan at all allows anyone", seatCheck({ roster: [owner], plan: null, incoming: admin }).allowed === true);

console.log("\nThe top of the ladder is a conversation, not a button");
const huge = Array.from({ length: 12 }, () => admin);
const beyond = seatCheck({ roster: huge, plan: SOLO, incoming: admin });
ok("no tier fits thirteen seats", beyond.nextTier === null);
ok("...so the message asks them to talk to us", /[Tt]alk to us/.test(seatLimitMessage(beyond)));

console.log("\nBoth server doors are gated, not just the screen");
import { readFileSync } from "node:fs";
const invite = readFileSync("app/api/settings/members/route.js", "utf8");
const role = readFileSync("app/api/settings/members/[id]/role/route.js", "utf8");
ok("the invite route calls seatCheck", /seatCheck\(/.test(invite));
ok("the role-change route calls seatCheck", /seatCheck\(/.test(role));
// Promotion is the fast door. Gating only the invite would leave it open.
ok("...only when the change actually crosses into a seat",
  /isBillableSeat\(afterChange\) && !isBillableSeat\(target\)/.test(role));
ok("both refuse with 402 rather than a generic 400",
  /code: "seat_limit"[\s\S]{0,80}status: 402/.test(invite) &&
    /code: "seat_limit"[\s\S]{0,80}status: 402/.test(role));
// The clamp runs first: an invite asked for as a Manager and clamped to a
// Worker costs nothing, and must not be refused for what was requested.
ok("the invite is checked AFTER the permissions are clamped",
  invite.indexOf("vetted.permissions") < invite.indexOf("seatCheck("));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
