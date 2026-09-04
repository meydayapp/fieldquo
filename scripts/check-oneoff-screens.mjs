// scripts/check-oneoff-screens.mjs
//
// The back-office one-offs: marketing, spend, subscribers, the social
// calendar, safety and tasks.
//
//   npm run check:oneoff-screens
//
// ══ What went wrong, screen by screen ══════════════════════════════════════
//
// app/app/marketing — `campaigns` was `useState(null)` under a comment citing
// lib/loadState.js, and the two lists BESIDE it on the same page were still
// `useState([])`. A 401 or a 500 on GET /api/settings/document-templates
// landed as `[]`, which rendered "you have no templates yet — go and make one"
// at a contractor with five, AND hard-disabled the submit button underneath,
// so the campaign could not be created either. The doctrine was applied to one
// list on the page and not the other two.
//
// app/app/safety — `jobs` at `useState([])`. A failed GET /api/jobs collapsed
// the picker to "Not tied to a job", which is itself a legitimate choice, so
// nothing about it looked wrong — and the incident was filed with jobId null,
// permanently detached from the job it happened on. An incident report is the
// one record nobody can re-derive later.
//
// app/app/marketing/spend — two faults. The summary error was captured into a
// `__error` sentinel that was then never read, so a failed summary made the
// blended cost-per-lead card and the by-channel table simply VANISH,
// indistinguishable from "no spend yet" and with no retry. And
// `summary?.companyCurrency || "CAD"` fell back on a payload the ENTRIES table
// does not come from — so a Swiss company whose summary 500s saw every real
// spend row rendered as CA$.
//
// app/app/marketing/subscribers — `handleImport` had no try/finally and a bare
// `res.json()`. A 502 returns Next's HTML error page and a 204 returns
// nothing, so the parse threw before `setImporting(false)` was reached and the
// button stayed disabled, reading "Importing…", until a page reload.
// `handleAdd` directly below it already had the finally.
//
// app/app/marketing/designer/calendar — STATUS_STYLES and DOT_STYLES listed
// seven of `enum SocialPublishStatus`'s eight members. `container_created` —
// the state an Instagram post sits in between its two publish calls — fell to
// the grey fallback while its LABEL resolved to "Publishing", so one state wore
// two colours on one calendar.
//
// app/app/tasks — the priority badge and the priority dropdown both printed
// `{task.priority}`, the raw lowercase column. And the tick: `done` is
// `["done","cancelled"].includes(status)`, so a CANCELLED task drew a filled
// tick, and the handler read `status === "done" ? "open" : "done"` — which sent
// "done" for it. Pressing the tick on work somebody had called off recorded it
// as finished.
//
// ══ Why the enum maps are compared against the schema ══════════════════════
//
// AGENTS.md is explicit: check every status map against prisma/schema.prisma,
// "not against the four values someone copied from another page". Both maps
// below are diffed against the real enum block, and the SIZE of that block is
// asserted first — a regex that silently matches nothing makes every
// completeness test vacuously true, which this pass has already been burnt by
// once today.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
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

const marketing = code("app/app/marketing/page.js");
const spend = code("app/app/marketing/spend/page.js");
const subs = code("app/app/marketing/subscribers/page.js");
const calendar = code("app/app/marketing/designer/calendar/page.js");
const safety = code("app/app/safety/page.js");
const tasks = code("app/app/tasks/page.js");
const schema = read("prisma/schema.prisma");
const messages = read("app/i18n/appMessages.js");

/** The members of a Prisma enum, from the schema. */
function enumMembers(name) {
  const m = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

/** The keys of an object literal declared as `const NAME = { ... }`. */
function mapKeys(src, name) {
  const m = new RegExp(`const ${name} = \\{([^}]*)\\}`).exec(src);
  if (!m) return null;
  return [...m[1].matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)].map((h) => h[1]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. A list that failed to load never claims to be empty");

ok(
  "marketing: the template list can say 'not known'",
  /const \[templates, setTemplates\] = useState\(null\)/.test(marketing),
);
ok(
  "...and its failure is kept, not discarded into an empty array",
  /setTemplates\(null\);\s*setTemplatesErrorKey\(result\.errorKey\);/.test(marketing),
);
ok(
  "...the 'go and write one' prompt fires only on a list the server SENT",
  /Array\.isArray\(templates\) &&\s*templates\.length === 0/.test(marketing),
);
ok(
  "...and a failure offers a retry instead of that prompt",
  /templatesErrorKey \?/.test(marketing) && /onClick=\{loadTemplates\}/.test(marketing),
);
ok(
  "marketing: the member list can say 'not known' too",
  /const \[members, setMembers\] = useState\(null\)/.test(marketing),
);
ok(
  "...and says so, rather than silently collapsing to Unassigned",
  /members === null &&/.test(marketing),
);
ok(
  "marketing: neither list is fetched with a bare r.ok ternary any more",
  !/r\.ok \? r\.json\(\) : \[\]/.test(marketing),
);

ok(
  "safety: the job picker can say 'not known'",
  /const \[jobs, setJobs\] = useState\(null\)/.test(safety),
);
ok(
  "...loaded through fetchArray, not a swallowing ternary",
  /fetchArray\("\/api\/jobs"\)/.test(safety) &&
    !/res\.ok \? res\.json\(\) : \[\]/.test(safety),
);
// The load-bearing one. "Not tied to a job" is a real answer; an unread list
// looking identical to it is how an incident ends up attached to nothing.
ok(
  "...and the form SAYS the list is missing before an incident is filed at nothing",
  /jobs === null &&/.test(safety),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Marketing spend — the right currency, and a failure that speaks");

ok(
  "the summary's failure is stored rather than dropped on the floor",
  /setSummaryError\(summaryResult\.__error\)/.test(spend),
);
ok(
  "...and rendered, with a retry",
  /\{summaryError &&/.test(spend) && /onClick=\{load\}/.test(spend),
);
ok(
  "the entries table no longer falls back to Canada",
  !/companyCurrency \|\| "CAD"/.test(spend) && !/"CAD"/.test(spend),
);
ok(
  "...it falls back to the company's own currency, from the provider that holds it",
  /useCompanyPreferences\(\)/.test(spend) &&
    /summary\?\.companyCurrency \|\| companyCurrency/.test(spend),
);
// `c.leads || "—"` printed a deliberately-entered 0 as "unknown". 0 is finite.
ok(
  "a genuine zero leads is printed as 0, not as a dash meaning 'unknown'",
  !/c\.leads \|\| "—"/.test(spend) &&
    /Number\.isFinite\(Number\(c\.leads\)\)/.test(spend),
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The import button can always be un-pressed");

{
  const body = /async function handleImport\(\)[\s\S]*?\n  \}/.exec(subs)?.[0] || "";
  ok("handleImport was found", body.length > 0);
  ok(
    "...it clears the busy flag in a finally, on every path",
    /finally \{\s*setImporting\(false\);\s*\}/.test(body),
  );
  ok(
    "...and never parses an error body with a bare res.json()",
    /res\.json\(\)\.catch\(\(\) => null\)/.test(body) &&
      !/const data = await res\.json\(\);/.test(body),
  );
  ok(
    "...a non-ok response reports and returns rather than reading a null body",
    /if \(!res\.ok\) \{/.test(body),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Status and priority maps, diffed against the schema");

const socialStatuses = enumMembers("SocialPublishStatus");
ok(
  "SocialPublishStatus was read from the schema and is not empty",
  socialStatuses.length >= 8,
  socialStatuses.join(","),
);
for (const map of ["STATUS_STYLES", "DOT_STYLES"]) {
  const keys = mapKeys(calendar, map);
  const missing = keys ? socialStatuses.filter((v) => !keys.includes(v)) : ["<map not found>"];
  ok(
    `the calendar's ${map} covers every SocialPublishStatus`,
    missing.length === 0,
    `missing: ${missing.join(",")}`,
  );
}
// The label already existed for the member that had no colour, which is what
// made the bug so quiet: the chip said "Publishing" in grey beside another
// row saying "Publishing" in blue.
ok(
  "...and every one of them has a label in the catalogue",
  socialStatuses.every((v) =>
    messages.includes(`"app.marketingDesigner.calendar.status.${v}"`),
  ),
  socialStatuses
    .filter((v) => !messages.includes(`"app.marketingDesigner.calendar.status.${v}"`))
    .join(","),
);

const priorities = enumMembers("TaskPriority");
ok("TaskPriority was read from the schema", priorities.length === 4, priorities.join(","));
{
  const labelled = mapKeys(tasks, "PRIORITY_LABELS");
  const styled = mapKeys(tasks, "PRIORITY_STYLES");
  ok(
    "every TaskPriority has a label",
    labelled && priorities.every((p) => labelled.includes(p)),
    `missing: ${priorities.filter((p) => !labelled?.includes(p)).join(",")}`,
  );
  ok(
    "...and a chip style",
    styled && priorities.every((p) => styled.includes(p)),
  );
}
ok(
  "the badge renders the label, never the raw column",
  /priorityLabel\(task\.priority\)/.test(tasks) && !/\{task\.priority\}/.test(tasks),
);
ok(
  "the dropdown is built from the map rather than a hand-typed array",
  /TASK_PRIORITIES\.map/.test(tasks) &&
    !/\["low", "normal", "high", "urgent"\]/.test(tasks),
);
ok(
  "...and its options are labelled, not raw",
  /\{priorityLabel\(p\)\}/.test(tasks),
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. The tick does not complete work somebody called off");
//
// `done` is ["done","cancelled"].includes(status), so a cancelled task draws a
// filled tick. The handler read `status === "done" ? "open" : "done"` and so
// sent "done" for it — recording work that had been called off as finished.

ok(
  "both settled states are treated as settled by the handler",
  /const settled = task\.status === "done" \|\| task\.status === "cancelled";/.test(
    tasks,
  ),
);
ok(
  "...so a cancelled task REOPENS rather than completing",
  /const status = settled \? "open" : "done";/.test(tasks) &&
    !/task\.status === "done" \? "open" : "done"/.test(tasks),
);
// And the two must agree about what "settled" means, or the tick's appearance
// and its behaviour part company again.
{
  const drawn = /const done = \[([^\]]*)\]\.includes\(task\.status\)/.exec(tasks)?.[1] || "";
  const drawnSet = new Set([...drawn.matchAll(/"(\w+)"/g)].map((m) => m[1]));
  ok(
    "the states drawn as ticked are exactly the states the handler reopens",
    drawnSet.has("done") && drawnSet.has("cancelled") && drawnSet.size === 2,
    [...drawnSet].join(","),
  );
}

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fail ? 1 : 0);
