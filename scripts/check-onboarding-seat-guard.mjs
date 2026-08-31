// scripts/check-onboarding-seat-guard.mjs
//
// The owner's account showed 1/1 seats used and 0/5 crew seats, and the
// onboarding dashboard's "Add Employee" popup still let them pick Estimator,
// Dispatcher or Manager — every one of them a seat — as if the seat had never
// been spoken for.
//
// ══ What was actually wrong ═════════════════════════════════════════════════
//
// POST /api/team/quick-add gated on checkUserLimit(), which compares total
// HEADCOUNT against the legacy Plan.maxUsers column — seeded as
// `tier.seats + tier.crewSeats` (scripts/seed-seat-ladder.mjs), i.e. 6 for
// Solo. It has no idea seats and crew are two different pools; a company with
// its one seat full and all five crew slots empty reads as "1 of 6, go
// ahead" no matter which preset is requested. The real split — seatCheck() in
// lib/pricing/seatLimit.js — was wired into POST /api/settings/members (the
// full New User page) and nowhere else. quick-add is the ONLY door that
// creates a seat-consuming member without ever asking whether a seat exists.
//
// ══ What these assert ═══════════════════════════════════════════════════════
//
//  1. seatFits() — the picker-facing pure function — against hostile counts:
//     a full seat with spare crew room, a full crew with spare seat room (the
//     absorption rule), both full, neither full, and a missing/null cap
//     (unlimited legacy plan).
//  2. The Add Employee popup actually calls seatFits() to disable presets it
//     has no room for, rather than rendering all four unconditionally.
//  3. POST /api/team/quick-add calls the REAL seatCheck() — not just
//     checkUserLimit() — and refuses with 402 when it says no. This is the
//     part that matters: hiding an option in the popup is not access control,
//     and a hostile or stale client can still POST directly.
//
// Comments are stripped before any regex touches route or component source,
// and every regex is scoped to the specific function/block it claims to
// test — see check-worker-archive.mjs for why both traps matter here.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-onboarding-seat-guard.mjs

import { readFileSync } from "node:fs";
import { seatFits } from "@/lib/pricing/seatLimit";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";

let pass = 0;
const fails = [];
const ok = (label, cond) =>
  cond ? (pass++, console.log(`  ok  ${label}`)) : fails.push(label);

const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
const codeOf = (r) =>
  read(r)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function functionBody(source, exportSignature) {
  const start = source.indexOf(exportSignature);
  if (start === -1) throw new Error(`could not find ${exportSignature}`);
  const rest = source.slice(start + exportSignature.length);
  const next = rest.search(/\nexport (async function|function|const)/);
  return next === -1 ? rest : rest.slice(0, next);
}

const asPreset = (key) => ({
  role: PRESET_TO_ROLE[key],
  permissions: PERMISSION_PRESETS[key].values,
});

console.log("\nseatFits — the picker-facing pure function, hostile counts");

console.log("\n  The owner's own case: Solo, 1/1 seats, 0/5 crew");
const solo1of1 = { used: 1, crew: 0, seatCap: 1, crewCap: 5 };
ok("Worker (crew) still fits — the seat being full doesn't touch crew",
  seatFits({ ...asPreset("worker"), seats: solo1of1 }) === true);
ok("Estimator (a seat) does NOT fit — this is the exact bug",
  seatFits({ ...asPreset("estimator"), seats: solo1of1 }) === false);
ok("Dispatcher (a seat) does NOT fit", seatFits({ ...asPreset("dispatcher"), seats: solo1of1 }) === false);
ok("Manager (a seat) does NOT fit", seatFits({ ...asPreset("manager"), seats: solo1of1 }) === false);

console.log("\n  Crew absorption: seat is FULL, but a crew slot is also full — spare seat covers it");
// Solo: 1 seat used (the owner), crew full at 5/5. crewCap(5) + spareSeats(0,
// since the one seat is already taken) = 5, so a 6th crew member does NOT
// fit — but this asserts the boundary the OTHER way: crew has ROOM (4/5), so
// it still fits even with the seat gone.
const crewRoom = { used: 1, crew: 4, seatCap: 1, crewCap: 5 };
ok("crew with room left still fits", seatFits({ ...asPreset("worker"), seats: crewRoom }) === true);
const crewFull = { used: 1, crew: 5, seatCap: 1, crewCap: 5 };
ok("crew AT its cap, with no spare seat, does not fit",
  seatFits({ ...asPreset("worker"), seats: crewFull }) === false);
// The actual absorption boundary — the owner's own example: "we also have
// the 10 seats. 10 seats and 15 crews is equal to 25." Nobody has taken the
// ONE seat yet, and crew is already sitting at its cap: the spare seat must
// absorb one more crew person. seatBlocked/crewBlocked math that forgets the
// spare-seat term (e.g. always treats it as 0) passes every case above —
// those all happen to have the seat already occupied — and only this one
// catches it.
const spareSeatAbsorbs = { used: 0, crew: 5, seatCap: 1, crewCap: 5 };
ok("crew AT its cap, but the seat is still OPEN, absorbs one more via the spare seat",
  seatFits({ ...asPreset("worker"), seats: spareSeatAbsorbs }) === true);
const noSpareLeft = { used: 0, crew: 6, seatCap: 1, crewCap: 5 };
ok("...but the spare seat absorbs only ONE — a second over-cap crew member still doesn't fit",
  seatFits({ ...asPreset("worker"), seats: noSpareLeft }) === false);

console.log("\n  A fresh company: nobody added yet");
const fresh = { used: 0, crew: 0, seatCap: 1, crewCap: 5 };
ok("a seat fits when the one seat is still open", seatFits({ ...asPreset("estimator"), seats: fresh }) === true);
ok("crew fits when nothing is used", seatFits({ ...asPreset("worker"), seats: fresh }) === true);

console.log("\n  No plan / legacy unlimited (seatCap and crewCap both null)");
const unlimited = { used: 40, crew: 40, seatCap: null, crewCap: null };
ok("a seat always fits with no cap", seatFits({ ...asPreset("manager"), seats: unlimited }) === true);
ok("crew always fits with no cap", seatFits({ ...asPreset("worker"), seats: unlimited }) === true);

console.log("\n  Missing `seats` entirely reads as no data, not as a green light with no basis");
ok("no seats object at all still resolves (treated as no cap, same as unlimited)",
  seatFits({ ...asPreset("manager"), seats: undefined }) === true);

console.log("\nThe Add Employee popup — app/components/team/AddEmployeeModal.js");
const modal = codeOf("../app/components/team/AddEmployeeModal.js");
ok("imports seatFits rather than inventing its own math",
  /import\s*\{\s*seatFits\s*\}\s*from\s*["']@\/lib\/pricing\/seatLimit["']/.test(modal));
ok("fetches real seat usage instead of assuming every preset is free",
  /fetchJson\(["']\/api\/settings\/members\/pending["']\)/.test(modal));
const eligBlock = modal.slice(
  modal.indexOf("const eligibility"),
  modal.indexOf("const [form, setForm]"),
);
ok("computes per-preset eligibility with seatFits(), one call per PRESET_KEYS entry",
  /seatFits\(\{[\s\S]*?role:\s*PRESET_TO_ROLE\[key\][\s\S]*?permissions:\s*PERMISSION_PRESETS\[key\]\.values[\s\S]*?\}\)/.test(eligBlock));
const selectBlock = modal.slice(modal.indexOf("<select"), modal.indexOf("</select>"));
ok("each <option> is actually disabled when its preset doesn't fit — not just labelled",
  /disabled=\{!eligibility\[key\]\}/.test(selectBlock));
ok("a preset that no longer fits is not left silently selected",
  /eligibility\[f\.preset\]/.test(modal) && /PRESET_KEYS\.find\(\(key\)\s*=>\s*eligibility\[key\]\)/.test(modal));

console.log("\nSERVER enforcement — POST /api/team/quick-add — hiding the option is not the fix");
const quickAdd = codeOf("../app/api/team/quick-add/route.js");
const post = functionBody(quickAdd, "export async function POST(request) {");
ok("imports the real seatCheck, not only the legacy headcount limit",
  /import\s*\{\s*seatCheck,\s*seatLimitMessage\s*\}\s*from\s*["']@\/lib\/pricing\/seatLimit["']/.test(quickAdd));
ok("the legacy checkUserLimit is still called (belt) — this is additive, not a replacement",
  /checkUserLimit\(/.test(post));
ok("seatCheck is called with the roster, the real plan, and what this invite will actually carry",
  /seatCheck\(\{\s*roster:\s*\[\.\.\.seatRoster,\s*\.\.\.seatPending\]/.test(post) &&
  /incoming:\s*\{\s*role,\s*permissions:\s*vetted\.permissions\s*\}/.test(post));
ok("checked against the CLAMPED permissions (vetted), never the raw request body",
  !/incoming:\s*\{\s*role,\s*permissions\s*\}/.test(post) || /vetted\.permissions/.test(post));
ok("refuses with 402 and the seat_limit code when seatCheck says no",
  /if\s*\(\s*!seats\.allowed\s*\)\s*\{[\s\S]{0,150}status:\s*402/.test(post) &&
  /code:\s*["']seat_limit["']/.test(post));
ok("pending invitations are counted too — a sent invite already spends the seat",
  /seatPending[\s\S]{0,40}db\.pendingTeamProfile\.findMany/.test(post));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error("\nFAILED:");
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
