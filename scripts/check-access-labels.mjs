// scripts/check-access-labels.mjs
//
// Two findings from a production QA pass, both of the same shape: the screen
// said something the code did not mean.
//
// F-01  The owner gave `jonny` the Dispatcher preset and Manage Team showed
//       "Manager". PRESET_TO_ROLE maps BOTH dispatcher and manager to the
//       `supervisor` tier, and ROLE_LABELS has one name for that tier — so the
//       read-only badge, which rendered ROLE_LABELS[member.role], collapsed the
//       two. The editable dropdown one cell over had it right all along,
//       because it reverse-matches the stored grid. An owner reading that badge
//       believes a Dispatcher holds delete, job costing, payments and
//       everyone's expenses.
//
// F-07  /app/quotes/<id> and /app/invoices/<id> offered a trash icon and a real
//       "permanently removed" dialog to a Dispatcher capped at
//       view_create_edit. The server refused correctly; the dialog then closed
//       with nothing on screen, so it read as a successful delete.
//
// ── Why the second half is derived and not a list ──────────────────────────
//
// A hand-written list of "controls that must be gated" is a list that goes
// stale the first time somebody adds a delete button. So this walks
// app/api/**/route.js, extracts the grid level each DELETE handler requires
// straight from the enforcement call, finds every client-side `fetch(…,
// { method: "DELETE" })` that targets one of those routes, and asserts the
// file asks the same question of the same grid. A new destructive control is
// covered the moment it is written, without touching this file.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-access-labels.mjs

import {
  PERMISSION_PRESETS,
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PRESET_TO_ROLE,
} from "@/lib/permissions";
import {
  describeAccess,
  emptyPermissionValues,
} from "@/lib/permissions/accessPresets";
import {
  ROLE_LABELS,
  ROLE_RANK,
  assignableAccessLabels,
  assignableRoles,
  tierNote,
  validateRoleChange,
} from "@/lib/permissions/roleManagement";
import { validateInvite } from "@/lib/permissions/inviteGuard";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`,
  );
};
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// ───────────────────────────────────────────────────────────────────────────
console.log("\nEvery preset's own grid reads back as that preset");
// The exact round trip the badge does: take what applyChoice() writes for a
// preset, hand it to describeAccess(), get the preset's label back. Executed,
// not pattern-matched — a regex over the page would have passed the whole time
// the badge was wrong.
for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
  const role = PRESET_TO_ROLE[key];
  const stored = { ...emptyPermissionValues(), ...preset.values };
  const got = describeAccess({ role, permissions: stored });
  t(`${key} → "${preset.label}"`, got.label, preset.label);
  t(`${key} is reported as a preset`, got.kind, "preset");
  t(`${key} names the preset, not the tier`, got.presetKey, key);
}

console.log("\n...and specifically never the bare tier name");
// The reported bug, stated as its own assertion: a Dispatcher must not read
// "Manager", and the only reason it did is that both share one tier.
const dispatcher = describeAccess({
  role: PRESET_TO_ROLE.dispatcher,
  permissions: {
    ...emptyPermissionValues(),
    ...PERMISSION_PRESETS.dispatcher.values,
  },
});
t("a Dispatcher does not read as Manager", dispatcher.label !== "Manager");
t("a Dispatcher reads as Dispatcher", dispatcher.label, "Dispatcher");
t(
  "the collision that caused it is still real (so this test still means something)",
  PRESET_TO_ROLE.dispatcher === PRESET_TO_ROLE.manager &&
    ROLE_LABELS[PRESET_TO_ROLE.dispatcher] === PERMISSION_PRESETS.manager.label,
);
// Two presets on one tier must come out DIFFERENT, whatever they are called.
// (Not "never equals the tier label" — workerFullView is honestly called
// "Worker" and the employee tier is honestly called "Worker"; the failure is
// two people being given the same word, not a word being reused.)
const byTier = new Map();
for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
  const role = PRESET_TO_ROLE[key];
  const got = describeAccess({
    role,
    permissions: { ...emptyPermissionValues(), ...preset.values },
  });
  if (!byTier.has(role)) byTier.set(role, []);
  byTier.get(role).push({ key, label: got.label });
}
for (const [role, entries] of byTier) {
  if (entries.length < 2) continue;
  const labels = entries.map((e) => e.label);
  t(
    `the ${entries.length} presets sharing the ${ROLE_LABELS[role]} tier stay distinguishable (${labels.join(" / ")})`,
    new Set(labels).size === labels.length,
  );
}

console.log("\nA grid that matches no preset reads Custom");
// One dial moved off a preset is genuinely custom, and saying "Manager" there
// is the more dangerous direction to be wrong in.
const bentDispatcher = {
  ...emptyPermissionValues(),
  ...PERMISSION_PRESETS.dispatcher.values,
  payroll: "run_payroll",
};
const bent = describeAccess({
  role: PRESET_TO_ROLE.dispatcher,
  permissions: bentDispatcher,
});
t("Dispatcher + payroll is not a Dispatcher", bent.presetKey, null);
t("...it is Custom", bent.label, "Custom");
t("...and not the tier name", bent.label !== ROLE_LABELS.supervisor);
// Also downward: less than the preset is custom too.
const trimmed = describeAccess({
  role: PRESET_TO_ROLE.manager,
  permissions: {
    ...emptyPermissionValues(),
    ...PERMISSION_PRESETS.manager.values,
    quotes: "view_only",
  },
});
t("Manager minus quote delete is Custom", trimmed.label, "Custom");

console.log("\nWhere the grid is not what governs, the tier is — and only there");
// enforce.js short-circuits before reading the grid for these, so "Custom"
// would be describing a configuration that has no effect.
t(
  "an owner reads as Owner",
  describeAccess({ role: "owner", permissions: null }).label,
  ROLE_LABELS.owner,
);
t(
  "an admin reads as Administrator",
  describeAccess({ role: "admin", permissions: {} }).label,
  ROLE_LABELS.admin,
);
t(
  "the isAdministrator flag wins over any grid",
  describeAccess({
    role: "supervisor",
    permissions: { isAdministrator: true, quotes: "view_only" },
  }).label,
  ROLE_LABELS.admin,
);
t(
  "a member with no grid at all reads as their tier, not Custom",
  describeAccess({ role: "employee", permissions: null }).label,
  ROLE_LABELS.employee,
);
t(
  "an owner is never labelled Custom",
  describeAccess({ role: "owner", permissions: { quotes: "view_only" } })
    .label !== "Custom",
);
// A missing role must not crash the badge — Manage Team renders whatever the
// roster returns.
t("an unknown shape does not throw", (() => {
  try {
    describeAccess(undefined);
    describeAccess({});
    describeAccess({ role: "nonsense", permissions: "not an object" });
    return true;
  } catch {
    return false;
  }
})());

console.log("\nBoth vocabularies are named where a person meets them");
t("tierNote names the tier", /Manager tier/.test(tierNote("supervisor")));
t(
  "...and says the two presets share it",
  /Dispatcher/.test(tierNote("supervisor")) &&
    /Manager/.test(tierNote("supervisor")),
);
t(
  "a tier with one preset does not claim to be shared",
  !/shared by/.test(tierNote("admin")),
);
const TEAM = read("app/app/settings/team/page.js");
t("the Manage Team badge derives from the grid", /accessBadge\(/.test(TEAM));
t(
  "...and no longer prints ROLE_LABELS[m.role]",
  !/ROLE_LABELS\[m\.role\]/.test(TEAM) && !/ROLE_LABELS\[p\.role\]/.test(TEAM),
);
t("...and carries the tier alongside it", /tierNote\(/.test(TEAM));
const EDITOR = read("app/components/team/AccessEditor.js");
t("the access editor labels its tier chip as a tier", /tierChip/.test(EDITOR));
t("...and explains that tiers are shared", /tierExplain/.test(EDITOR));

console.log("\nRefusals speak the vocabulary of the control that was refused");
// "As manager, you can only assign: Worker." — said to a Dispatcher, naming a
// tier they do not hold.
const supervisorAssigns = validateRoleChange({
  actor: { id: "a", role: "supervisor" },
  target: { id: "b", role: "employee" },
  nextRole: "admin",
  ownerCount: 2,
});
t("assigning above yourself is refused", supervisorAssigns.ok, false);
t(
  "...without calling the actor a manager",
  !/as manager/i.test(supervisorAssigns.error),
);
t(
  "...and lists the preset names the screen offers",
  supervisorAssigns.error.includes(PERMISSION_PRESETS.worker.label) &&
    supervisorAssigns.error.includes(PERMISSION_PRESETS.workerFullView.label),
);
const invite = validateInvite({
  actor: { role: "supervisor", permissions: {} },
  role: "admin",
});
t("inviting above yourself is refused", invite.ok, false);
t("...without calling the actor a manager", !/as manager/i.test(invite.error));
t(
  "...and lists what they can actually add",
  invite.error.includes(PERMISSION_PRESETS.worker.label),
);
t(
  "assignableAccessLabels covers every assignable role",
  assignableAccessLabels(assignableRoles("owner")).length >=
    Object.keys(PERMISSION_PRESETS).length,
);
t(
  "an actor who can assign nothing gets a sentence, not an empty list",
  validateRoleChange({
    actor: { id: "a", role: "employee" },
    target: { id: "b", role: "employee" },
    nextRole: "supervisor",
    ownerCount: 2,
  }).error.length > 0,
);

// ───────────────────────────────────────────────────────────────────────────
// Destructive controls, derived from the permission model.
// ───────────────────────────────────────────────────────────────────────────

/** Every file under a directory, recursively. */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * The grid level each DELETE handler enforces, read off the enforcement call
 * itself. Both shapes count: requireLevel(...) throws, and `!hasLevel(...)`
 * followed by a hand-written 403 is the same gate written longhand.
 */
function deleteRequirements() {
  const reqs = new Map();
  for (const file of walk(join(ROOT, "app", "api"))) {
    if (!file.endsWith(`${sep}route.js`)) continue;
    const src = readFileSync(file, "utf8");
    const at = src.indexOf("export async function DELETE");
    if (at < 0) continue;
    const after = src.slice(at + "export async function DELETE".length);
    const end = after.indexOf("export async function");
    const body = end > 0 ? after.slice(0, end) : after;
    for (const m of body.matchAll(
      /(?:requireLevel|hasLevel)\(\s*[\w.?]+\s*,\s*"(\w+)"\s*,\s*"([a-z_]+)"/g,
    )) {
      const route =
        "/" +
        relative(join(ROOT, "app"), file)
          .split(sep)
          .slice(0, -1)
          .join("/");
      if (!reqs.has(route)) reqs.set(route, new Set());
      reqs.get(route).add(`${m[1]}:${m[2]}`);
    }
  }
  return reqs;
}

/** A route path with [params] turned into a matcher for a client template. */
function routeMatcher(route) {
  const parts = route
    .split("/")
    .map((s) =>
      s.startsWith("[")
        ? String.raw`(?:\$\{[^}]*\}|[\w.\[\]]+)`
        : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
  return new RegExp("^" + parts.join("/") + "$");
}

/** Every client-side DELETE fetch: the URL template and the file it is in. */
function clientDeleteCalls() {
  const out = [];
  const roots = [join(ROOT, "app"), join(ROOT, "components")];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (!/\.(js|jsx)$/.test(file)) continue;
      if (file.includes(`${sep}api${sep}`)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/method:\s*["']DELETE["']/g)) {
        const back = src.slice(Math.max(0, m.index - 600), m.index);
        const k = back.lastIndexOf("fetch(");
        if (k < 0) continue;
        const url = /^fetch\(\s*([`"'])([\s\S]*?)\1/.exec(back.slice(k));
        if (!url) continue;
        out.push({ url: url[2], file: relative(ROOT, file), src });
      }
    }
  }
  return out;
}

console.log("\nNo destructive control is offered at a level the API refuses");
const reqs = deleteRequirements();
t(
  "the model yielded gated DELETE routes to check against",
  reqs.size >= 5,
);
const calls = clientDeleteCalls();
t("client DELETE call sites were found", calls.length >= 10);

let checked = 0;
for (const [route, needs] of reqs) {
  const rx = routeMatcher(route);
  for (const call of calls) {
    if (!rx.test(call.url)) continue;
    for (const need of needs) {
      const [category, level] = need.split(":");
      // The same question, of the same grid, in the file that offers the
      // control. Whitespace-tolerant because prettier wraps long calls.
      const asks = new RegExp(
        `hasLevel\\([\\s\\S]{0,80}?"${category}",\\s*"${level}"`,
      ).test(call.src);
      checked++;
      t(`${call.file} → DELETE ${route} asks for ${category}:${level}`, asks);
    }
  }
}
t("at least one control/route pair was actually compared", checked > 0);

console.log("\nA refusal that does reach the browser is shown, not swallowed");
// The 403 used to close the dialog and toast only, which reads exactly like a
// successful delete to the person who pressed the button.
for (const rel of [
  "app/app/quotes/[id]/page.js",
  "app/app/invoices/[id]/page.js",
]) {
  const src = read(rel);
  t(
    `${rel} puts the server's sentence in its own banner`,
    /reportResponseError\(\s*res,\s*setError/.test(src),
  );
  t(`${rel} disables the dialog while deleting`, /busy=\{deleting\}/.test(src));
}

console.log("\nDeleting hours is governed by the ladder that claims to govern it");
// The Timesheets ✕ fired DELETE on the first click, and the timeTracking
// ladder said nothing about deleting at all.
const topLevel =
  PERMISSION_CATEGORIES.timeTracking.levels[
    PERMISSION_CATEGORIES.timeTracking.levels.length - 1
  ];
t("the top Time Tracking level names delete", /delete/i.test(topLevel.label));
t(
  "...and the route requires that exact level",
  new RegExp(`"timeTracking",\\s*"${topLevel.value}"`).test(
    read("app/api/time-entries/[id]/route.js"),
  ),
);
const SHEETS = read("app/app/settings/team/timesheets/page.js");
t("the ✕ asks before deleting", /<DeleteConfirmModal/.test(SHEETS));
t("...and no longer deletes straight from the click", !/onClick=\{\(\) => remove\(/.test(SHEETS));
t(
  "...and the confirmation says what deleting costs",
  /deleteMessage/.test(SHEETS),
);
t(
  "an approved entry is never offered a ✕",
  /e\.status !== "approved" && canDeleteEntry/.test(SHEETS),
);

console.log("\nSelf-approved hours survive as far as the money");
const RUN = read("lib/payroll/buildPayRun.js");
t("the pay run computes them", /selfApprovedTime/.test(RUN));
t(
  "...by comparing the approver to the worker's own login",
  /approvedById !== ownUserId/.test(RUN),
);
t(
  "the preview says so before the run is committed",
  /selfApprovedTime/.test(read("app/app/payroll/page.js")),
);
t(
  "...and the created run records it in the trail",
  /selfApprovedTime/.test(read("app/api/payroll/runs/route.js")),
);

console.log("\nSanity: the model these assertions are derived from");
t("every role has exactly one tier label", Object.keys(ROLE_RANK).every((r) => ROLE_LABELS[r]));
t(
  "every preset value key is a real category or toggle",
  Object.values(PERMISSION_PRESETS).every((p) =>
    Object.keys(p.values).every(
      (k) => PERMISSION_CATEGORIES[k] || PERMISSION_TOGGLES[k],
    ),
  ),
);

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — the badge names the grid, and no delete is offered where the API says no\n",
);
process.exit(fail ? 1 : 0);
