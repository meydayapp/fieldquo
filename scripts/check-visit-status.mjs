// scripts/check-visit-status.mjs
//
// Three features and a counter that were correct in source and unreachable.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// `JobVisit.status` was written once, at creation, as "scheduled". Nothing in
// the product could ever change it again. The PATCH route accepted a status and
// reacted to two values; the only client that ever called that route was the
// checklist, which sends `checklistItems` and nothing else.
//
// So: the "on my way" text to the homeowner had editable wording at
// /app/settings/messages (under a heading saying it is the ONE message that
// really sends), a template renderer, a STOP/opt-out check and a Twilio call —
// and no button anywhere could fire it. `ensureUpcomingVisit` never ran from a
// human action. And the job page's "0 of 3 complete" counter, filtering on
// status === "completed", could never move off zero.
//
// ══ Why the guard is structural ════════════════════════════════════════════
//
// Every one of those files passed every check in this repo. `check:all` was
// green, the build was green, the route's own logic was right. What was missing
// was a CALLER, and no check in the repo asked whether a route had one.
//
// So this asks the question that was never asked: does a non-API surface send
// a status to that endpoint, and is every status it can send one the route and
// the badge map actually know about?
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { visitActions, VISIT_STATUS_LABELS, mayMoveVisit } from "../lib/jobs/visitStatus.js";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) => strip(readFileSync(p, "utf8"));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

// ══ 1. A human surface actually sends a status ═════════════════════════════

section("1. Something outside app/api PATCHes a visit with a status");

const clientFiles = walk("app").filter((f) => !f.startsWith(join("app", "api")));
const senders = clientFiles.filter((f) => {
  const src = read(f);
  // The endpoint, and a status in the body. Both, in the same file — either
  // alone is what the codebase had before and it was not enough.
  return /\/visits\/\$\{[^}]*\}/.test(src) && /body:\s*JSON\.stringify\(\{\s*status/.test(src);
});
ok(senders.length > 0, "at least one client surface sends { status } to /api/jobs/[id]/visits/[visitId]", senders);

// ══ 2. Every status the UI can send is one the route knows ═════════════════

section("2. Every offered transition lands somewhere real");

const ROUTE = read("app/api/jobs/[id]/visits/[visitId]/route.js");
const offered = [...new Set(
  ["scheduled", "on_the_way", "completed", "cancelled", "canceled", "in_progress", "zzz-unknown"]
    .flatMap((s) => visitActions(s).map((a) => a.to)),
)];

ok(offered.includes("on_the_way"), "the UI can put a visit on the way — the state the SMS hangs off", offered);
ok(offered.includes("completed"), "the UI can complete a visit — the state the counter and recurrence hang off", offered);

for (const status of offered) {
  ok(
    Object.prototype.hasOwnProperty.call(VISIT_STATUS_LABELS, status),
    `"${status}" has a human label rather than rendering raw`,
  );
}

// ══ 3. The promises on the buttons are still true ══════════════════════════

section("3. The side effects the labels promise still exist in the route");

ok(
  /status === "on_the_way"/.test(ROUTE) && /sendSms\(/.test(ROUTE),
  'the route still texts the client on the way into "on_the_way" — the button says it does',
);
ok(
  /status === "completed"/.test(ROUTE) && /ensureUpcomingVisit\(/.test(ROUTE),
  "completing a visit on a recurring job still spawns the next one",
);
ok(
  /maySms\(/.test(ROUTE),
  "the on-my-way send still checks the STOP opt-out before it goes",
);

// The one transition flagged `texts: true` must be the one the route texts on,
// and no other. A button that quietly gained an SMS, or lost one while keeping
// the label, is the same failure in reverse.
const texting = visitActions("scheduled").filter((a) => a.texts).map((a) => a.to);
ok(
  texting.length === 1 && texting[0] === "on_the_way",
  "exactly one offered transition is marked as texting the client, and it is on_the_way",
  texting,
);

// ══ 4. No transition produces an unstyled badge ════════════════════════════

section("4. Every reachable status is styled on the job page");

const DETAIL = read("app/app/jobs/[id]/JobDetail.js");
const stylesBlock = DETAIL.slice(DETAIL.indexOf("const STATUS_STYLES"));
const styled = [...stylesBlock.slice(0, stylesBlock.indexOf("};")).matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
for (const status of offered) {
  ok(styled.includes(status), `"${status}" has a badge style, not the grey fallback`, styled);
}
ok(
  !/v\.status\?\.replace\(/.test(DETAIL),
  "the visit badge uses the shared label, not a raw underscore-strip",
);

// ══ 5. The UI's permission rule is the route's rule ════════════════════════

section("5. mayMoveVisit mirrors the route's three clauses");

ok(mayMoveVisit({ assignedToId: null, userId: "u1", hasEditAll: false }) === true, "unassigned: anyone may move it");
ok(mayMoveVisit({ assignedToId: "u1", userId: "u1", hasEditAll: false }) === true, "the assignee may move their own");
ok(mayMoveVisit({ assignedToId: "u2", userId: "u1", hasEditAll: false }) === false, "someone else's visit is refused");
ok(mayMoveVisit({ assignedToId: "u2", userId: "u1", hasEditAll: true }) === true, "schedule:edit_all overrides");
ok(mayMoveVisit({ assignedToId: "u2", userId: null, hasEditAll: false }) === false, "no session is not a match");

ok(
  /visit\.assignedToId === member\.userId/.test(ROUTE) &&
    /visit\.assignedToId !== null/.test(ROUTE) &&
    /hasLevel\(full, "schedule", "edit_all"\)/.test(ROUTE),
  "the route still asks those same three questions — if it stops, the UI above is now guessing",
);

console.log(
  fail
    ? `\n✗ visit status: ${fail} check${fail === 1 ? "" : "s"} failed\n`
    : "\n✓ visit status: a human can move a visit, and every move it offers is real\n",
);
process.exit(fail ? 1 : 0);
