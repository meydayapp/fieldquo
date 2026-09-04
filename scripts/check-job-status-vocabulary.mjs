// scripts/check-job-status-vocabulary.mjs
//
// One vocabulary per enum, one tone map per vocabulary, and no page keeping a
// private copy of either.
//
//   npm run check:job-status-vocabulary
//
// ── The bug this exists for ────────────────────────────────────────────────
//
// This is the fourth time in this repo that a status map has been copied from
// somewhere it was correct into somewhere it wasn't:
//
//   * the invoices list carried a four-key map copied from quotes, where four
//     is right — InvoiceStatus has seven, and a live chargeback rendered as
//     `class="… rounded-full undefined"` beside the raw word
//     `partially_refunded` (lib/invoices/statusPresentation.js);
//   * the appointments calendar carried four keys matching AppointmentStatus
//     EXACTLY, which looks exhaustive and wasn't, because that page merges
//     three vocabularies (lib/appointments/statusLabels.js);
//   * the job detail page said `unscheduled` where the list said "Needs a
//     date" (lib/jobs/statusLabels.js);
//   * and then the job EDIT page kept its own STATUSES array and its own
//     `s.replace(/_/g, " ")`, so the form you change a status ON printed the
//     database's word while the two screens either side of it printed the
//     considered one.
//
// The colours had the same shape and were left behind when the words were
// fixed. app/app/jobs/page.js painted `unscheduled` purple ("this needs a
// date"); JobDetail's map had no entry for it at all and fell through to the
// grey a CANCELLED job gets; app/app/clients/[id] had no map and printed
// `{j.status}` with a CSS `capitalize`, which does not treat "_" as a word
// break — so `in_progress` reached a contractor as "In_progress".
//
// ── What this proves, and what it can't ────────────────────────────────────
//
// It parses `enum JobStatus` out of prisma/schema.prisma and asserts the tone
// map covers exactly it — no missing value, no invented one. It asserts the
// visit map covers every string lib/jobs/visitStatus.js itself recognises,
// including BOTH spellings of cancelled. It asserts no tone resolves to
// undefined, which is the failure that renders the literal word "undefined"
// into a class list. And it asserts the four pages read the shared helpers
// rather than declaring a private map.
//
// It cannot prove what a badge LOOKS like — only a browser does that — and it
// cannot see a map built at runtime. It is a tripwire for a regression whose
// exact shape has now shipped four times.

import { readFileSync } from "node:fs";
import {
  JOB_STATUS_TONE,
  JOB_TONE_CLASSES,
  jobStatusClasses,
  jobStatusLabel,
  JOB_STATUSES,
} from "@/lib/jobs/statusLabels";
import {
  VISIT_STATUS_TONE,
  VISIT_TONE_CLASSES,
  visitStatusClasses,
  VISIT_STATUS_LABELS,
} from "@/lib/jobs/visitStatus";
import { FUNNEL_STATUS_LABEL, funnelStatusLabel } from "@/lib/funnels/status";

let fail = 0;
// Label FIRST. The reversed shape — ok(condition, "label") — makes a non-empty
// string the condition, and a check that can never fail is worse than none.
const ok = (label, condition) => {
  if (!condition) fail++;
  console.log(`${condition ? "  ok  " : "  FAIL"} ${label}`);
};

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// Comments stripped before any source is searched. A file whose comment SAYS
// "STATUS_STYLES" while declaring no such thing must not read as a violation,
// and every one of the files below now carries exactly such a comment
// explaining why the map moved out.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

// ── The schema is the source, not another hand-written list ────────────────
function enumValues(name) {
  const schema = read("../prisma/schema.prisma");
  const m = new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!m) return null;
  return stripComments(m[1])
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+$/i.test(l));
}

console.log("\nJobStatus — read from prisma/schema.prisma");
const jobStatuses = enumValues("JobStatus");
ok("enum JobStatus was found in the schema", Array.isArray(jobStatuses) && jobStatuses.length > 0);
ok(
  `every JobStatus has a tone (${(jobStatuses || []).join(", ")})`,
  (jobStatuses || []).every((s) => JOB_STATUS_TONE[s]),
);
ok(
  "the tone map invents no status the schema doesn't have",
  Object.keys(JOB_STATUS_TONE).every((s) => (jobStatuses || []).includes(s)),
);
ok(
  "JOB_STATUSES (the dropdown order) matches the enum as a set",
  (jobStatuses || []).every((s) => JOB_STATUSES.includes(s)) &&
    JOB_STATUSES.every((s) => (jobStatuses || []).includes(s)),
);
ok(
  "every tone resolves to real classes — no `undefined` in a class list",
  Object.values(JOB_STATUS_TONE).every((tone) => typeof JOB_TONE_CLASSES[tone] === "string"),
);
ok(
  "an unknown status still gets a chip rather than the word undefined",
  jobStatusClasses("on_hold") === JOB_TONE_CLASSES.off &&
    !/undefined/.test(jobStatusClasses(undefined)),
);

// The specific regression: unscheduled must NOT look like cancelled. A job
// fresh off an accepted quote is the one thing on the screen somebody has to
// act on; a cancelled job is the one thing they never have to look at again.
ok(
  "`unscheduled` is not painted the same as `cancelled`",
  jobStatusClasses("unscheduled") !== jobStatusClasses("cancelled"),
);
ok(
  "`unscheduled` keeps the attention tone the jobs list already gave it",
  JOB_STATUS_TONE.unscheduled === "attention",
);

// Every pairing carries its dark half — a bg-*-50 with no dark counterpart is
// a bright slab in a dark-mode van.
for (const [tone, classes] of Object.entries(JOB_TONE_CLASSES)) {
  if (classes.includes("bg-muted")) continue; // token-based, theme-aware already
  ok(`job tone "${tone}" has a dark: background`, /dark:bg-/.test(classes));
  ok(`job tone "${tone}" has a dark: foreground`, /dark:text-/.test(classes));
}

console.log("\nVisit statuses — a DIFFERENT vocabulary, kept apart on purpose");
ok(
  "every status visitStatusLabel recognises also has a tone",
  Object.keys(VISIT_STATUS_LABELS).every((s) => VISIT_STATUS_TONE[s]),
);
ok(
  "the visit tone map invents nothing visitStatusLabel can't resolve",
  Object.keys(VISIT_STATUS_TONE).every((s) => VISIT_STATUS_LABELS[s]),
);
ok(
  "both spellings of cancelled are styled — the schedule filter queries both",
  visitStatusClasses("cancelled") === visitStatusClasses("canceled"),
);
ok(
  "a missing visit status resolves as `scheduled`, the column's own default",
  visitStatusClasses("") === visitStatusClasses("scheduled") &&
    visitStatusClasses(null) === visitStatusClasses("scheduled"),
);
ok(
  "an unknown visit status still gets a chip, never `undefined`",
  !/undefined/.test(visitStatusClasses("teleported")),
);
ok(
  "every visit tone resolves to real classes",
  Object.values(VISIT_STATUS_TONE).every((t) => typeof VISIT_TONE_CLASSES[t] === "string"),
);
// The reason the two maps are separate rather than merged: on_the_way (a
// visit) and in_progress (a job) sit inches apart on the job page and must not
// be the same colour.
ok(
  "`on_the_way` and `in_progress` are told apart",
  visitStatusClasses("on_the_way") !== visitStatusClasses("in_progress"),
);
for (const [tone, classes] of Object.entries(VISIT_TONE_CLASSES)) {
  if (classes.includes("bg-muted")) continue;
  ok(`visit tone "${tone}" has a dark: background`, /dark:bg-/.test(classes));
}

console.log("\nNo page keeps its own copy");
// The four screens that render a job's status. Each must read the shared
// helper and must not declare a private status→classes object.
const CONSUMERS = [
  ["jobs list", "../app/app/jobs/page.js", "jobStatusClasses"],
  ["job detail", "../app/app/jobs/[id]/JobDetail.js", "jobStatusClasses"],
  ["job edit form", "../app/app/jobs/[id]/edit/page.js", "jobStatusLabel"],
  ["client detail", "../app/app/clients/[id]/page.js", "jobStatusClasses"],
];
for (const [label, rel, helper] of CONSUMERS) {
  const src = stripComments(read(rel));
  ok(`${label} calls ${helper}()`, new RegExp(`${helper}\\s*\\(`).test(src));
  ok(
    `${label} declares no private status→classes map`,
    !/const\s+STATUS_STYLES\s*=/.test(src),
  );
  // The raw-enum tell: `.replace(/_/g, " ")` on a status, or a bare
  // `{x.status}` rendered straight into JSX with no helper around it.
  ok(
    `${label} does not tidy a raw status with replace(/_/g)`,
    !/replace\(\/_\/g/.test(src),
  );
  // The negative lookbehind is load-bearing, and is the trap this repo has
  // already been caught by: without it `value={job.status}` — the status
  // <select>'s own value, which is CORRECT and must stay — reads as a rendered
  // badge. A regex that matches an attribute rather than the rendered value is
  // how `key={row.raw}` passed for `{row.raw}`.
  ok(
    `${label} renders no bare {job.status} / {j.status}`,
    !/(?<!=)\{\s*(?:job|j|v)\.status\s*\}/.test(src),
  );
}

// The edit form is the one that shipped the raw word: it must offer the shared
// list, not a private array of the same five strings.
{
  const src = stripComments(read("../app/app/jobs/[id]/edit/page.js"));
  ok(
    "the job edit form maps JOB_STATUSES rather than its own array",
    /JOB_STATUSES\.map/.test(src) && !/const\s+STATUSES\s*=\s*\[/.test(src),
  );
}

console.log("\nFunnelStatus — the same shape, two values");
const funnelStatuses = enumValues("FunnelStatus");
ok("enum FunnelStatus was found in the schema", (funnelStatuses || []).length > 0);
ok(
  `every FunnelStatus has a label (${(funnelStatuses || []).join(", ")})`,
  (funnelStatuses || []).every((s) => FUNNEL_STATUS_LABEL[s]),
);
ok(
  "no invented funnel status",
  Object.keys(FUNNEL_STATUS_LABEL).every((s) => (funnelStatuses || []).includes(s)),
);
ok(
  "no funnel label is the raw column value",
  (funnelStatuses || []).every((s) => funnelStatusLabel(s) !== s),
);
for (const [label, rel] of [
  ["funnels list", "../app/app/funnels/page.js"],
  ["funnel builder", "../app/app/funnels/[id]/page.js"],
]) {
  const src = stripComments(read(rel));
  ok(`${label} calls funnelStatusLabel()`, /funnelStatusLabel\s*\(/.test(src));
  ok(
    `${label} renders no bare {funnel.status} / {f.status}`,
    !/\{\s*(?:funnel|f)\.status\s*\}/.test(src),
  );
}

console.log(fail === 0 ? "\nAll good.\n" : `\n${fail} problem(s).\n`);
process.exit(fail === 0 ? 0 : 1);
