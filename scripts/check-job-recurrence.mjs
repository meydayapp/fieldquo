// scripts/check-job-recurrence.mjs
//
//   npm run check:job-recurrence
//
// "This is a recurring job" has to carry a rule, or it is a dead control.
//
// ══ The bug ═══════════════════════════════════════════════════════════════
//
// Both job forms offered a frequency <select> whose first option is the empty
// "Select frequency…", and neither refused a save while it was still selected.
// lib/jobs/createJob.js stores `recurring: !!recurring` and
// `recurrenceRule: recurrenceRule || null` — both perfectly storable — and then
// lib/jobs/recurrence.js's scheduleNextVisit bails on
// `!RECURRENCE_RULES.has(job.recurrenceRule)`. So the job read as repeating on
// its own page, on the list and on the calendar, and a second visit never
// appeared. That module's own header says it exists because "a company ticked
// 'weekly', trusted it, and a second visit never appeared"; the forms let the
// same thing happen one field along.
//
// ══ Why this check is not a changelog ═════════════════════════════════════
//
// A check that hardcodes "weekly, biweekly, monthly" and asserts the two pages
// mention them would pass forever while proving nothing — it would be a list of
// the three values somebody typed in 2026. Everything below is derived:
//
//   · Part 1 EXECUTES lib/jobs/recurrence.js. It does not read the forms at
//     all. It proves, for real, that the empty rule schedules nothing and that
//     every member of RECURRENCE_RULES schedules something. That is the fact
//     which makes an unguarded tick a dead control, and if a future refactor
//     made an empty rule fall back to weekly, this part would go green and the
//     rest of the check would become unnecessary rather than wrong.
//
//   · Part 2 reads the two forms and requires that the SET drives them: the
//     option values offered must be exactly RECURRENCE_RULES, sourced from the
//     module rather than typed. A fourth rule added to the Set therefore fails
//     here until both screens offer it, and an option offered that the Set does
//     not contain fails too.
//
//   · Part 3 requires each form to refuse the save. It looks for a guard whose
//     SHAPE is right — a RECURRENCE_RULES membership test on the rule state,
//     reached before the request goes out — not for words like "recurring" in a
//     sentence. `if (false && …)` contains all the right words and does
//     nothing.
//
// Source is comment-stripped before any of Part 2 or 3 runs. Without that, the
// paragraphs above — which name RECURRENCE_RULES, quote the guard and list the
// three rules — would satisfy the check by describing it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECURRENCE_RULES,
  RECURRENCE_LABEL_KEYS,
  nextVisitDate,
} from "../lib/jobs/recurrence.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;

// label FIRST. Reversed, a non-empty label becomes the condition and the check
// can never fail — the false pass that has caught agents in this repo before.
function ok(label, passed, detail = "") {
  if (passed) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}

/**
 * Comment bodies blanked, every other character kept in place.
 *
 * Line and block comments only — enough for these two files, and it fails
 * SAFE: over-blanking would remove a real guard and fail the check, never
 * invent one. A string containing "//" is the known limitation; neither form
 * has one on a line that matters.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

const FORMS = [
  { file: "app/app/jobs/new/page.js", state: "recurrenceRule" },
  { file: "app/app/jobs/[id]/edit/page.js", state: "recurrenceRule" },
];

// ── Part 1: what an unset rule actually schedules ──────────────────────────
//
// Executed, not read. `anchor` is a real past date so the "strictly after now"
// roll-forward in nextVisitDate has somewhere to go.
console.log("\nWhat a recurring job with no rule actually schedules\n");
{
  const anchor = new Date("2026-01-05T09:00:00.000Z");
  const now = new Date("2026-02-01T00:00:00.000Z");

  for (const empty of [null, undefined, "", "  ", "fortnightly", "every 2 weeks"]) {
    ok(
      `nextVisitDate(${JSON.stringify(empty)}) schedules nothing`,
      nextVisitDate(anchor, empty, now) === null,
      "a rule the scheduler does not know must yield null, which is what makes an unguarded tick a dead control",
    );
  }

  ok(
    "RECURRENCE_RULES is not empty",
    RECURRENCE_RULES.size > 0,
    "an empty set would make every assertion below vacuous",
  );

  for (const rule of RECURRENCE_RULES) {
    const next = nextVisitDate(anchor, rule, now);
    ok(
      `nextVisitDate("${rule}") schedules a future visit`,
      next instanceof Date && next > now,
      `got ${String(next)}`,
    );
    ok(
      `"${rule}" has a label key`,
      typeof RECURRENCE_LABEL_KEYS[rule] === "string" &&
        RECURRENCE_LABEL_KEYS[rule].startsWith("app."),
      "a rule the cron schedules and no screen can name is a rule nobody can pick",
    );
  }

  // The other direction: a label key for a rule that was removed from the Set
  // would put an option on both forms that schedules nothing.
  for (const rule of Object.keys(RECURRENCE_LABEL_KEYS)) {
    ok(
      `label key "${rule}" names a rule the scheduler knows`,
      RECURRENCE_RULES.has(rule),
      "this option would be offered and would schedule nothing",
    );
  }
}

// ── Part 2: the forms offer exactly what the scheduler understands ─────────
console.log("\nBoth job forms drive their picker off RECURRENCE_RULES\n");
for (const { file } of FORMS) {
  const src = stripComments(read(file));

  ok(
    `${file} imports RECURRENCE_RULES from lib/jobs/recurrence`,
    /import\s*\{[^}]*\bRECURRENCE_RULES\b[^}]*\}\s*from\s*["']@\/lib\/jobs\/recurrence["']/.test(
      src,
    ),
    "a hand-typed list of frequencies is a second source of truth",
  );

  // Every literal <option value="x"> in the file, minus the empty placeholder.
  // Matching the ATTRIBUTE here is correct — unlike the trap where a regex
  // matched `key={row.raw}` instead of the rendered value, an <option>'s value
  // attribute IS what gets submitted.
  const literalOptions = [...src.matchAll(/<option\s+[^>]*value="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((v) => v !== "");

  const strays = literalOptions.filter((v) => !RECURRENCE_RULES.has(v));
  ok(
    `${file} hand-writes no frequency option`,
    strays.length === 0,
    strays.length ? `hand-written option values: ${strays.join(", ")}` : "",
  );

  ok(
    `${file} maps the Set to its options`,
    /\[\s*\.\.\.\s*RECURRENCE_RULES\s*\]\s*\.map\s*\(/.test(src),
    "options must be generated from RECURRENCE_RULES so a fourth rule appears without an edit here",
  );
}

// ── Part 3: neither form will save a tick with no rule ─────────────────────
//
// Asserted by SHAPE. The guard has to be a membership test against
// RECURRENCE_RULES on the recurrence state, and it has to sit before the
// request — a check after the fetch would be an error message on a job that is
// already wrong.
console.log("\nNeither form saves 'recurring' without a rule\n");
for (const { file, state } of FORMS) {
  const src = stripComments(read(file));

  const guard = new RegExp(
    // `recurring && !RECURRENCE_RULES.has(recurrenceRule…)` — allowing a
    // .trim() or similar on the state, and nothing else between the pieces.
    String.raw`\brecurring\s*&&\s*!\s*RECURRENCE_RULES\.has\(\s*${state}[^)]*\)`,
  );
  const guardAt = src.search(guard);
  ok(
    `${file} refuses a recurring job with no rule`,
    guardAt !== -1,
    "expected a `recurring && !RECURRENCE_RULES.has(rule)` test before the save",
  );

  if (guardAt === -1) continue;

  // Every WRITE in the file, by offset. Keyed on the method rather than on the
  // URL: both forms also GET /api/jobs (the callback lookup here, the row being
  // edited there), and an earlier attempt that searched for the URL matched
  // those reads and reported the guard as coming after the save. A read is not
  // the thing the guard has to precede.
  const writes = [...src.matchAll(/\bmethod:\s*["'](?:POST|PATCH|PUT)["']/g)].map(
    (m) => m.index,
  );

  ok(
    `${file} still writes something`,
    writes.length > 0,
    "no POST/PATCH found — if the save moved, this check is now asserting nothing",
  );

  // The guard must precede EVERY write in the file, not merely the next one. A
  // second save path added above it would bypass it entirely, and that is the
  // shape this is here to notice.
  const early = writes.filter((at) => at < guardAt);
  ok(
    `${file} guards before every write`,
    writes.length > 0 && early.length === 0,
    early.length
      ? `${early.length} write(s) at offset(s) ${early.join(", ")} sit above the guard at ${guardAt}`
      : "",
  );

  // And the guard has to STOP the save. A `return` between the guard and the
  // first write is what makes it a guard rather than a warning printed on the
  // way past.
  const firstWriteAfter = writes.find((at) => at > guardAt);
  ok(
    `${file} returns out of the guard`,
    firstWriteAfter !== undefined &&
      /\breturn\b/.test(src.slice(guardAt, firstWriteAfter)),
    "the guard sets a message and falls through, which saves the job anyway",
  );
}

console.log(
  failures === 0
    ? "\nPASSED — a recurring job cannot be saved without a rule the scheduler runs.\n"
    : `\n${failures} problem(s).\n`,
);
process.exit(failures === 0 ? 0 : 1);
