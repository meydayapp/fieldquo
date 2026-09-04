// scripts/check-crew-screen-states.mjs
//
// The two screens a crew actually touches, and the claims they made when they
// had not loaded.
//
//   npm run check:crew-screen-states
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// lib/loadState.js exists because `useState([])` is a claim of zero made
// before the server has answered. Both of these pages made the same claim
// wearing `null` instead of `[]`, which is why the sweep for `useState([])`
// never found them.
//
//   app/app/clock — `load()` returned early on a non-ok response and left
//   `data` at null. Every figure below is read with `?.`, so the page rendered
//   the complete clocked-out screen: "You're clocked out.", 0.00 hours today,
//   "No entries yet today.", and a green Clock in button. A worker who WAS on
//   the clock pressed it and got a 409 from POST /api/time-clock. The only
//   correction was a toast, and a toast goes away. This is the screen an
//   hourly worker touches every single shift.
//
//   app/app/scheduler — same early return, two wrong screens. On a first load
//   all seven day cards read "No shifts scheduled." On week NAVIGATION the
//   headings advanced while `data` kept the previous week's shifts, so last
//   Tuesday's crew was drawn under next Tuesday's date. Silently wrong data is
//   worse than an empty state: nothing about it looks wrong.
//
// ══ And one dead control ═══════════════════════════════════════════════════
//
// Add shift and Publish week were gated on `data.manager`, which GET
// /api/shifts sets from `can(member.role, "user:view")`. Both routes behind
// those buttons require `hasLevel(full, "schedule", "edit_all")`. A supervisor
// whose schedule dial is view_own or edit_own holds user:view, so they got the
// button, the modal, the whole-company worker dropdown, typed a shift and lost
// it to a 403. The file already asked the right question for DELETE and never
// carried it across to the two controls that create.
//
// ══ Why the gate is asserted by SHAPE, not by its words ════════════════════
//
// `if (false && hasLevel(...))` contains every word an assertion about wording
// would look for. So section 3 pairs each control with the level the ROUTE
// demands, reads the level out of both files, and compares them — the page
// cannot drift from the route without this failing.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Source with comments removed, case preserved. Both pages explain these
 *  bugs at length; a scan that reads its own explanation as the offence is a
 *  false pass this repo has already been burnt by. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

let fail = 0;
let pass = 0;
const failures = [];
function ok(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : `  — ${detail}`}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const clock = code("app/app/clock/page.js");
const sched = code("app/app/scheduler/page.js");
const shiftsRoute = code("app/api/shifts/route.js");
const publishRoute = code("app/api/shifts/publish/route.js");
const deleteRoute = code("app/api/shifts/[id]/route.js");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The time clock — a failed load is not a clocked-out worker");

ok(
  "the load goes through fetchList, so a failure is a value and not a fall-through",
  /fetchList\("\/api\/time-clock"\)/.test(clock),
);
ok(
  "a failure is HELD in state rather than returned past",
  /setErrorKey\(result\.errorKey\)/.test(clock),
);
ok(
  "...and the punch state goes back to 'not known', never left stale",
  /if \(!result\.ok\) \{[\s\S]{0,240}?setData\(null\);/.test(clock),
);

// The load-bearing one: the render must STOP at the failure. A banner rendered
// alongside the clocked-out screen would still show the green Clock in button,
// which is the whole bug.
const clockGate = clock.indexOf("if (errorKey)");
const clockNotIn = clock.indexOf("app.clock.notClockedIn");
const clockPunch = clock.indexOf("app.clock.clockIn");
ok(
  "the render STOPS at the failure — an early return, not a banner beside the clock face",
  clockGate > -1 && /if \(errorKey\) \{[\s\S]{0,600}?return \(/.test(clock),
);
ok(
  "...and that gate precedes both 'You're clocked out' and the Clock in button",
  clockGate > -1 && clockGate < clockNotIn && clockGate < clockPunch,
  `gate@${clockGate} notClockedIn@${clockNotIn} clockIn@${clockPunch}`,
);
ok(
  "...offering the shared failure panel with its retry, not a bespoke sentence",
  /<ListState[^>]*errorKey=\{errorKey\}[^>]*onRetry=\{load\}/.test(
    clock.replace(/\s+/g, " "),
  ),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Today's total, EXECUTED — and shared with the route");
//
// The old code was `Math.round(((data.todayHours || 0) + 0) * 100) / 100` on
// the clocked-in branch and `data.todayHours` on the other: the same value
// twice, with a `+ 0` where the live elapsed was meant to go. The figure froze
// at page load while the timer above it kept ticking, so after a shift the
// card read 07:12:33 elapsed beside 0.02 hours today.
//
// This section RUNS the function rather than reading for it. The first draft
// of this check asserted `/data\.today\.reduce\(/` against the source, and a
// mutation that prefixed the whole expression with `false &&` — leaving the
// text intact and the code dead — passed it. That is the "asserting a guard by
// its words rather than its shape" trap, committed inside the check written to
// avoid it. Executing the arithmetic cannot be fooled that way.

const { todayHoursFrom } = await import("../lib/timeclock/todayHours.js");
const NOW = new Date("2026-09-03T14:00:00Z").getTime();
const iso = (h) => new Date(NOW - h * 3_600_000).toISOString();

ok(
  "a closed entry contributes its booked hours",
  todayHoursFrom([{ clockIn: iso(4), clockOut: iso(1), hours: 3 }], NOW) === 3,
  todayHoursFrom([{ clockIn: iso(4), clockOut: iso(1), hours: 3 }], NOW),
);
ok(
  "an OPEN entry contributes the time elapsed since the punch",
  todayHoursFrom([{ clockIn: iso(2.5), clockOut: null, hours: null }], NOW) === 2.5,
  todayHoursFrom([{ clockIn: iso(2.5), clockOut: null, hours: null }], NOW),
);
// The bug, stated as an assertion: the same rows a minute apart must differ.
ok(
  "...so the figure MOVES with the clock rather than freezing at load",
  todayHoursFrom([{ clockIn: iso(1), clockOut: null }], NOW + 60_000) >
    todayHoursFrom([{ clockIn: iso(1), clockOut: null }], NOW),
);
ok(
  "closed and open add together",
  todayHoursFrom(
    [
      { clockIn: iso(6), clockOut: iso(4), hours: 2 },
      { clockIn: iso(1), clockOut: null },
    ],
    NOW,
  ) === 3,
);
// `Number(null) === 0`, and 0 is finite. A closed row with no booked hours is
// a row somebody has to fix, not a row worth guessing at.
// Two rows, not one. `Number(null)` is 0, so a single unbooked row reads the
// same whether it is skipped or trusted — the first version of this assertion
// used one row and a mutation that trusted Number() straight through passed
// it. `Number(undefined)` is NaN, and one NaN poisons the whole day, so a
// GOOD row has to sit beside the bad one for the difference to show.
const MIXED = [
  { clockIn: iso(6), clockOut: iso(4), hours: 2 },
  { clockIn: iso(3), clockOut: iso(1), hours: null },
  { clockIn: iso(1), clockOut: iso(0.5) },
];
ok(
  "a closed entry with no booked hours contributes nothing and poisons nothing",
  todayHoursFrom(MIXED, NOW) === 2,
  todayHoursFrom(MIXED, NOW),
);
ok(
  "a genuine empty day is 0, which is a real answer",
  todayHoursFrom([], NOW) === 0,
);
// The whole point of lib/loadState.js, in one function.
ok(
  "rows we were never given are null — not a confident zero",
  todayHoursFrom(undefined, NOW) === null && todayHoursFrom(null, NOW) === null,
);
ok(
  "a punch dated in the future never subtracts from the day",
  todayHoursFrom([{ clockIn: iso(-2), clockOut: null }], NOW) === 0,
  todayHoursFrom([{ clockIn: iso(-2), clockOut: null }], NOW),
);
ok(
  "an unparseable punch is skipped rather than poisoning the total",
  todayHoursFrom(
    [{ clockIn: "not-a-date", clockOut: null }, { clockIn: iso(2), clockOut: iso(1), hours: 1 }],
    NOW,
  ) === 1,
);

// One definition, both sides. This is the duplication that rotted in the first
// place — AGENTS.md failure class 9.
ok(
  "the route computes today's hours through the shared function",
  /todayHoursFrom\(today\)/.test(code("app/api/time-clock/route.js")),
);
ok(
  "...and so does the screen, passing its own ticking clock",
  /todayHoursFrom\(data\?\.today, now\)/.test(clock),
);
ok(
  "neither side keeps a private copy of the arithmetic",
  !/\+ 0\) \* 100/.test(clock) &&
    !/todayHours \+= /.test(code("app/api/time-clock/route.js")),
);
ok(
  "a figure that never arrived does not print as 0.00",
  /Number\.isFinite\(liveToday\)/.test(clock) &&
    !/\(liveToday \|\| 0\)\.toFixed/.test(clock),
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The scheduler's write controls ask what the routes ask");

/**
 * The brace-matched body of a block, from a marker that opens one.
 *
 * Needed twice below, for the same reason both times: an index comparison
 * ("does X appear after Y") cannot tell "inside the gate" from "after the gate
 * closed", and after-the-gate is exactly where an ungated control would sit.
 */
function blockFrom(src, marker, { skipParams = false } = {}) {
  const start = src.indexOf(marker);
  if (start === -1) return null;

  // A function signature's parameter list has to be skipped by matching
  // PARENTHESES first. `DELETE(request, { params })` destructures, so the
  // first "{" after the name opens the ARGUMENTS, and a brace matcher that
  // starts there returns "{ params }" — against which every assertion fails
  // while looking as though the route were wrong. That is not hypothetical:
  // it is what the first run of this check reported, and it is the same trap
  // scripts/check-ai-topup-inline.mjs documents in its own fnBody().
  let from = start + marker.length;
  const nextParen = skipParams ? src.indexOf("(", from) : -1;
  if (nextParen !== -1) {
    let parens = 0;
    for (let i = nextParen; i < src.length; i++) {
      if (src[i] === "(") parens++;
      else if (src[i] === ")") {
        parens--;
        if (parens === 0) {
          from = i + 1;
          break;
        }
      }
    }
  }

  // A marker that IS the opening brace — the JSX gate `{canEditSchedule && (`
  // — opens its own block. Searching forward from the end of that marker finds
  // the next `{` INSIDE it (the first `onClick={`), and returns that handler
  // as though it were the gate. Both callers below then report the control as
  // ungated while it is gated correctly.
  const open = marker.startsWith("{") ? start : src.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

// The level each route demands, read out of the route rather than assumed.
//
// Scoped to the HANDLER, not to the file: app/api/shifts/[id]/route.js gates
// PATCH at edit_all and DELETE at edit_delete_all, and a file-wide regex
// returns whichever comes first in the source. That is how a check comes to
// certify the wrong number confidently.
const levelIn = (src, handler) => {
  const body = handler ? blockFrom(src, handler, { skipParams: true }) : src;
  const m = /hasLevel\(full, "schedule", "([a-z_]+)"\)/.exec(body || "");
  return m ? m[1] : null;
};
const createLevel = levelIn(shiftsRoute, "export async function POST");
const publishLevel = levelIn(publishRoute, "export async function POST");
const deleteLevel = levelIn(deleteRoute, "export async function DELETE");

ok("POST /api/shifts states a schedule level", Boolean(createLevel), createLevel);
ok("POST /api/shifts/publish states one too", Boolean(publishLevel), publishLevel);
ok("DELETE /api/shifts/[id] states one too", Boolean(deleteLevel), deleteLevel);

// The page's own constants, read the same way.
const pageLevel = (name) => {
  const m = new RegExp(
    `const ${name} = hasLevel\\(caller, "schedule", "([a-z_]+)"\\)`,
  ).exec(sched);
  return m ? m[1] : null;
};
ok(
  "the page's edit gate is the SAME level the create route demands",
  pageLevel("canEditSchedule") === createLevel && createLevel !== null,
  `page=${pageLevel("canEditSchedule")} route=${createLevel}`,
);
ok(
  "...and publish demands no more than that gate allows",
  publishLevel === createLevel,
  `publish=${publishLevel} create=${createLevel}`,
);
ok(
  "the delete gate is the SAME level the delete route demands",
  pageLevel("canDeleteShift") === deleteLevel && deleteLevel !== null,
  `page=${pageLevel("canDeleteShift")} route=${deleteLevel}`,
);

// Shape, not words: both write controls must sit INSIDE the gate's block. An
// "appears after the gate" test would pass just as happily on a button that
// sits after the gate closed, which is the ungated case.
const editGate = blockFrom(sched, "{canEditSchedule && (");
ok(
  "the Add shift button is inside the edit gate's block",
  Boolean(editGate) && editGate.includes('data-tour="scheduler-add"'),
);
ok(
  "the Publish week button is inside that same block",
  Boolean(editGate) && editGate.includes("app.scheduler.publishWeek"),
);
// The other half: `manager` is user:view and must no longer gate a write.
const managerGates = (sched.match(/\{isManager && \(/g) || []).length;
const managerBlocks = [];
{
  let rest = sched;
  for (let i = 0; i < managerGates; i++) {
    const b = blockFrom(rest, "{isManager && (");
    if (!b) break;
    managerBlocks.push(b);
    rest = rest.slice(rest.indexOf(b) + b.length);
  }
}
ok(
  "nothing that writes is left behind the user:view gate",
  managerBlocks.every(
    (b) =>
      !b.includes("app.scheduler.addShift") &&
      !b.includes("app.scheduler.publishWeek"),
  ),
  `${managerBlocks.length} isManager block(s) inspected`,
);
ok(
  "the per-day add button is gated on it too — same route, same level",
  (sched.match(/\{canEditSchedule && \(/g) || []).length >= 2,
  `${(sched.match(/\{canEditSchedule && \(/g) || []).length} gates`,
);
ok(
  "...and it is a 44px target, not a bare 16px icon",
  /size-11[\s\S]{0,200}?aria-label=\{t\("app\.scheduler\.addShift"\)\}/.test(sched),
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. A week that failed to load says so");

ok(
  "the week goes through fetchList",
  /fetchList\(\s*`\/api\/shifts\?from=/.test(sched),
);
ok(
  "a failed week is DROPPED, so navigation cannot draw last week under new dates",
  /if \(!result\.ok\) \{\s*setData\(null\);\s*setErrorKey\(result\.errorKey\);/.test(
    sched,
  ),
);
ok(
  "the failure panel replaces the seven day cards rather than sitting above them",
  /\{errorKey \? \(/.test(sched) && /\) : loading \? \(/.test(sched),
);
// Locate the "No shifts scheduled." copy and prove the error branch is an
// earlier arm of the SAME conditional, so the two can never both render.
const noShiftsAt = sched.indexOf("app.scheduler.noShifts");
const errBranchAt = sched.indexOf("{errorKey ? (");
ok(
  "...and 'No shifts scheduled.' lives inside the arm the failure skips",
  errBranchAt > -1 && noShiftsAt > errBranchAt,
  `errorBranch@${errBranchAt} noShifts@${noShiftsAt}`,
);
ok(
  "the panel carries the shared retry",
  /<ListState[^>]*errorKey=\{errorKey\}[^>]*onRetry=\{load\}/.test(
    sched.replace(/\s+/g, " "),
  ),
);

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fail ? 1 : 0);
