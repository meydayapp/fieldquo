// scripts/check-job-controls-reachable.mjs
//
// Two rules, on the two screens where each was broken:
//
//   1. A control on the job page that PATCHes the job is drawn only for
//      somebody the route will answer.
//   2. A delete confirmation names everything the delete destroys, not only
//      the part that survives.
//
//   npm run check:job-controls
//
// ── 1. The three controls a Crew member could press and never use ──────────
//
// PATCH /api/jobs/[id] calls requireLevel(full, "jobs", "view_create_edit").
// The Crew preset sits at `jobs: view_only` (lib/permissions.js), and
// app/app/jobs/[id] is the page a crew opens on site — the largest group of
// people using this product, on the screen they use most. It drew a status
// <select>, an Edit link and an Archive button, all three of which answer 403.
//
// Archive was the worst of the three because the file had already reasoned
// about it and got it wrong in a comment: "Offered to anyone who can edit the
// job" sat directly above a button nothing had gated. A claim in a comment is
// not a check, which is why this file exists rather than a second comment.
//
// The Edit link pointed at /app/jobs/[id]/edit, which had no gate of its own —
// so hiding the button alone would have left the door it opened standing open
// to a bookmark. app/app/jobs/new/page.js records QA doing exactly that on the
// sibling screen: reached the full form by URL, filled it in, save came back
// 403. Both halves are asserted here for that reason.
//
// ── 2. "Leads it already produced are kept" ────────────────────────────────
//
// True, and the smaller half of the truth. FunnelResponse and FunnelEvent both
// hang off Funnel with onDelete: Cascade, so deleting a funnel destroys every
// recorded run through it and the entire drop-off report — which is the whole
// reason FunnelEvent rows exist. A dialog that names only what survives is a
// destructive operation labelled as a tidy-up.
//
// ── What this cannot prove ─────────────────────────────────────────────────
//
// It is a source scan over comment-stripped text. It cannot prove a hidden
// button is unreachable (the server does that, and still does), and it cannot
// prove the dialog's sentence is TRUE — only that it names the two things the
// schema says are destroyed. The cascade itself is asserted against
// prisma/schema.prisma, so if a future migration drops it this check goes red
// and the copy gets revisited rather than quietly becoming a lie.

import { readFileSync } from "node:fs";

let fail = 0;
const ok = (label, condition) => {
  if (!condition) fail++;
  console.log(`${condition ? "  ok  " : "  FAIL"} ${label}`);
};
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// Comments stripped first: every file below carries a comment DESCRIBING the
// rule, and a scan that reads its own documentation as the implementation is
// the false pass this repo has already been burned by.
const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

console.log("\nThe job page only draws what the route will accept");

const detail = strip(read("../app/app/jobs/[id]/JobDetail.js"));

// The gate is asked of the grid at the level the route enforces — not a role,
// and not a different level that would merely look like a gate.
ok(
  "JobDetail asks hasLevel(caller, 'jobs', 'view_create_edit')",
  /hasLevel\(\s*caller\s*,\s*["']jobs["']\s*,\s*["']view_create_edit["']\s*\)/.test(detail),
);

// Each control must sit behind that answer. Asserted by SHAPE — the guard
// identifier immediately preceding the element — rather than by the words
// "permission" appearing somewhere in the file: `if (false && x)` contains the
// words and does nothing.
ok(
  "the status <select> is behind canEditJob",
  /canEditJob\s*&&\s*\(\s*<select/.test(detail),
);
ok(
  "the Edit link is behind canEditJob",
  /canEditJob\s*&&\s*\(\s*<Link/.test(detail),
);
ok(
  "the Archive / Restore button is behind canEditJob",
  /canEditJob\s*&&\s*\(\s*<button/.test(detail),
);
// Delete was already gated and must stay that way — a pass that quietly
// dropped the stricter gate while adding the looser one would read as progress.
ok(
  "Delete still asks for the delete level, not the edit one",
  /hasLevel\(\s*caller\s*,\s*["']jobs["']\s*,\s*["']view_create_edit_delete["']\s*\)/.test(detail) &&
    /canDeleteJob\s*&&/.test(detail),
);
// The badge is NOT gated: hiding the status itself from a crew member would
// take away information they are entitled to, which is a different bug.
ok(
  "the status badge itself is still shown to everyone",
  /jobStatusClasses\(job\.status\)/.test(detail) &&
    !/canEditJob\s*&&[\s\S]{0,80}jobStatusClasses/.test(detail),
);

console.log("\n...and the door that button opened is gated too");
const edit = strip(read("../app/app/jobs/[id]/edit/page.js"));
ok(
  "the edit form asks the same level",
  /useHasLevel\(\s*["']jobs["']\s*,\s*["']view_create_edit["']\s*\)/.test(edit),
);
ok(
  "it refuses INSTEAD of the form, not around it",
  /if\s*\(\s*!canEdit\s*\)\s*return\s*<NoAccessPanel/.test(edit),
);
// Hook-order safety: the permission hook must be called before the first early
// return, or this page joins the React #310 crash check:job-page-hooks exists
// for. Compare source offsets.
{
  const hookAt = edit.indexOf("useHasLevel(");
  const firstReturn = edit.search(/\n\s*if\s*\([^)]*\)\s*\n?\s*return\s*\(/);
  ok(
    "the permission hook runs before the first early return",
    hookAt > -1 && firstReturn > -1 && hookAt < firstReturn,
  );
}

console.log("\nDeleting a funnel says what it destroys");

// The premise, straight from the schema. If a migration ever removes the
// cascade, this goes red and the sentence gets rewritten rather than silently
// becoming false.
const schema = read("../prisma/schema.prisma");
const modelBody = (name) => {
  const m = new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema);
  return m ? m[1] : "";
};
ok(
  "FunnelResponse still cascades from Funnel",
  /funnel\s+Funnel[\s\S]*?onDelete:\s*Cascade/.test(modelBody("FunnelResponse")),
);
ok(
  "FunnelEvent still cascades from Funnel",
  /funnel\s+Funnel[\s\S]*?onDelete:\s*Cascade/.test(modelBody("FunnelEvent")),
);

const funnels = strip(read("../app/app/funnels/page.js"));
ok(
  "the bin opens a real dialog, not window.confirm",
  /<DeleteConfirmModal/.test(funnels) && !/\bconfirm\(/.test(funnels),
);
// Both halves of the truth, in the copy the person actually reads. Matched on
// the rendered message prop, not on the comment above it.
{
  const m = /message=\{([\s\S]*?)\n\s*\}\n/.exec(funnels);
  const message = m ? m[1] : "";
  ok("the dialog has a message", message.length > 0);
  ok(
    "it says the recorded runs go",
    /\brun\b|\bruns\b/.test(message),
  );
  ok(
    "it says the drop-off report goes",
    /drop-off/.test(message),
  );
  ok(
    "it still says the leads survive",
    /pipeline stay|stay where they are/.test(message),
  );
  // A count is stated only when it is known: `?? 0` here would tell somebody
  // "no runs are affected" about a funnel that has had hundreds.
  ok(
    "a run count is only claimed when the payload carries one",
    /typeof\s+confirmFunnel\?\._count\?\.responses\s*===\s*["']number["']/.test(message),
  );
  ok(
    "no `?? 0` or `|| 0` padding the count in the dialog",
    !/_count\?\.responses\s*(\?\?|\|\|)\s*0/.test(message),
  );
}

console.log(fail === 0 ? "\nAll good.\n" : `\n${fail} problem(s).\n`);
process.exit(fail === 0 ? 0 : 1);
