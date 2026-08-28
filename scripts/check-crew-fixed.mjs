// scripts/check-crew-fixed.mjs
//
// The loophole the owner walked through, and why closing it took two changes.
//
// He added a crew member on the free tier, picked Crew, then moved Schedule to
// "edit everyone's schedule". The invite saved and sent. His own description of
// the shape of it: choosing Custom FIRST stopped him, choosing Crew and then
// editing did not.
//
// Both halves of that are one cause. Touching a dial clears the preset LABEL
// (`activePreset = null`), and the invite form then reads
// `PRESET_TO_ROLE[activePreset] || "employee"` — so the row lands on role
// `employee` carrying whatever grid is on screen. Custom stopped him only
// because he had given it quote powers, and quotes were one of four categories
// isBillableSeat asked about. Schedule was not on that list, so it was free.
//
// ══ Free was a denylist ════════════════════════════════════════════════════
//
// isBillableSeat asked "do they hold quotes, jobs, invoices or requests at
// view_create_edit". Everything else was free by omission. The omission covered
// editing the whole company's rota, every pay rate, company-wide expenses,
// everyone's hours, every note, and clientsProperties: full_edit — the
// exportable client list, on a row that costs nothing, which is
// non-negotiable #4 with a login attached.
//
// CLIENT_RESTRICTED_FIELDS in lib/permissions/enforce.js already makes the
// argument this file acts on: "a denylist silently leaks every column added
// later", and this grid gains categories. So free is a CEILING now — at or
// below what Crew holds — and anything above it is a seat whatever it is
// called on screen.
//
// ══ Why the UI lock is not the fix, only half of it ════════════════════════
//
// The owner's suggestion was to lock Crew the way Make administrator is locked:
// no dials, the tier IS the answer. That is right, and it is done. But hiding a
// dial is not access control — a hand-written POST still carries any grid it
// likes. The ceiling is what refuses that, by making it cost a seat and letting
// the seat cap answer. Shipping the lock alone would have made the loophole
// invisible rather than closed, which is worse.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-crew-fixed.mjs

import { readFileSync } from "node:fs";
import { PERMISSION_PRESETS, PERMISSION_CATEGORIES, PERMISSION_TOGGLES, PRESET_TO_ROLE } from "@/lib/permissions";
import { isBillableSeat } from "@/lib/pricing/ladder";
import { seatCheck } from "@/lib/pricing/seatLimit";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const CREW = PERMISSION_PRESETS.worker.values;
const crewPlus = (over) => ({ role: "employee", permissions: { ...CREW, ...over } });
const crew = crewPlus({});

console.log("\nCrew, exactly as shipped, is free");
ok("the preset itself costs nothing", isBillableSeat(crew) === false);
ok("...and it is the `employee` role", PRESET_TO_ROLE.worker === "employee");
ok("...whose label is Crew", PERMISSION_PRESETS.worker.label === "Crew");

console.log("\nThe dial he moved, and every one beside it");
// The exact escalation he reported. It was free.
ok("Schedule → edit everyone's is a SEAT", isBillableSeat(crewPlus({ schedule: "edit_all" })) === true);
ok("...and so is edit_delete_all", isBillableSeat(crewPlus({ schedule: "edit_delete_all" })) === true);
// The five that were free with it, and are worse.
ok("everyone's pay rates is a SEAT", isBillableSeat(crewPlus({ payroll: "view_all" })) === true);
ok("company-wide expenses is a SEAT", isBillableSeat(crewPlus({ expenses: "view_record_edit_all" })) === true);
ok("everyone's hours is a SEAT", isBillableSeat(crewPlus({ timeTracking: "view_record_edit_all" })) === true);
ok("every note is a SEAT", isBillableSeat(crewPlus({ notes: "all" })) === true);
// The one that is non-negotiable #4: the client list, exportable, for free.
ok("the full client list is a SEAT", isBillableSeat(crewPlus({ clientsProperties: "full_edit" })) === true);
// And the four that already billed still bill — nothing regressed.
for (const category of ["quotes", "jobs", "invoices", "requests"]) {
  ok(`${category} at view_create_edit still bills`, isBillableSeat(crewPlus({ [category]: "view_create_edit" })) === true);
}
// Reading, not just writing. The tier that held this shape was deleted for
// being a hole — "forty people for free and forty copies of the rate card".
ok("reading every quote is a SEAT, not free", isBillableSeat(crewPlus({ quotes: "view_only" })) === true);

console.log("\nEvery toggle is an escalation too");
for (const toggle of Object.keys(PERMISSION_TOGGLES)) {
  ok(`${toggle} turned on is a SEAT`, isBillableSeat(crewPlus({ [toggle]: true })) === true);
}

console.log("\nCrew's own rungs stay free — this is what must not move");
// jobs:view_only is the rung that lets the person in the van open the job they
// are driving to. Over-tightening here would make the free tier useless, which
// is how `jobs: none` got reverted the first time.
for (const [category, level] of Object.entries(CREW)) {
  if (typeof level === "boolean") continue;
  ok(`${category} at Crew's own "${level}" is free`, isBillableSeat(crewPlus({ [category]: level })) === false);
}
// A grid that is BELOW Crew in places is still free — a company may hand out
// less than the preset without being charged for the privilege.
ok("a grid below Crew is free",
  isBillableSeat(crewPlus({ jobs: "none", timeTracking: "view_record_own" })) === false);
// A missing category reads as its bottom rung, not as an escalation.
ok("an absent category is not an escalation",
  isBillableSeat({ role: "employee", permissions: (() => { const g = { ...CREW }; delete g.schedule; return g; })() }) === false);

console.log("\nA level nobody recognises is treated as ABOVE the ceiling");
// A typo must not be free. This function decides what a company pays.
ok("a nonsense level bills", isBillableSeat(crewPlus({ schedule: "edit_everything" })) === true);

console.log("\nThe ceiling is derived from the preset, not restated beside it");
const ladder = readFileSync("lib/pricing/ladder.js", "utf8");
ok("it is built from PERMISSION_PRESETS.worker",
  /PERMISSION_PRESETS\.worker\.values\[key\]/.test(ladder));
// The whole point of the inversion: no list of category names to fall behind.
ok("...and no longer enumerates four billable categories",
  !/\["quotes", "jobs", "invoices", "requests"\]\.some/.test(ladder));
ok("...it walks every category the grid defines",
  /Object\.keys\(PERMISSION_CATEGORIES\)/.test(ladder));
ok("...so a category added later is covered without editing this file",
  Object.keys(PERMISSION_CATEGORIES).length > 4);

console.log("\nAnd the seat cap is what actually refuses it");
// The enforcement, end to end: his own case. Solo is one seat, and he holds it.
const SOLO = { seats: 1, crewSeats: 5, tierKey: "solo" };
const owner = { role: "owner", permissions: null };
ok("a plain crew member still fits on Solo",
  seatCheck({ roster: [owner], plan: SOLO, incoming: crew }).allowed === true);
const escalated = seatCheck({ roster: [owner], plan: SOLO, incoming: crewPlus({ schedule: "edit_all" }) });
ok("...the escalated one is REFUSED", escalated.allowed === false);
ok("...for the seat cap, because that is what it now is", escalated.reason === "seat_limit", escalated.reason);
// Nobody already working is cut off by a rule that arrived after them. One live
// member flips to billable under this change; a company over its cap keeps
// everyone and is only stopped from adding another.
ok("an over-limit company is not blocked when merely asked about",
  seatCheck({ roster: [owner, crewPlus({ payroll: "view_all" })], plan: SOLO }).allowed === true);

console.log("\nThe screen tells the same story the server does");
const editor = readFileSync("app/components/team/AccessEditor.js", "utf8");
ok("Crew is named as the one fixed preset", /const FIXED_PRESET = "worker";/.test(editor));
ok("...and its dials are not rendered", /activePreset === FIXED_PRESET \?/.test(editor));
// Disabled selects would be worse than none: twenty greyed dials invite the
// reader to hunt for the one that lets them through.
ok("...they are replaced by a sentence, not by disabled inputs",
  /app\.setTeamNew\.crewFixed/.test(editor) && !/disabled=\{activePreset/.test(editor));
// The paid presets stay editable. A company that buys a seat may shape it.
ok("only Crew is fixed — the paid presets keep their grid",
  (editor.match(/FIXED_PRESET/g) || []).length === 2);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
