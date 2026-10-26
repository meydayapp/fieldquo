// scripts/check-section-folds.mjs
//
//   node scripts/check-section-folds.mjs
//
// Every card that offers a fold has to actually fold.
//
// ── Why this exists ──────────────────────────────────────────────────────
//
// app/components/jobs/JobSection.js gives a card three things: `open`, a
// `toggle` rendered by JobSectionToggle, and `bodyId`. The chevron and the
// aria wiring come free, which is the trap: a card can draw a perfectly
// convincing, keyboard-accessible, aria-expanded toggle and never hide
// anything, because hiding is the ONE part the card has to do itself —
// `<div id={section.bodyId} hidden={!section.open}>`.
//
// Forget it and you ship a control that appears to work and does not, which
// is the thing AGENTS.md names first. Nothing caught it before this file:
// no check script in the repo mentioned bodyId at all, with a dozen cards
// already on the pattern.
//
// Static on purpose. The question is not what the markup looks like for one
// set of props — it is whether the binding is there at all, in every card,
// and that is answerable by reading. A render test would cover two files
// and cost a bundler; this covers all of them and costs a grep.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".js") || entry.endsWith(".jsx")) out.push(full);
  }
  return out;
}

const files = walk(join(ROOT, "app")).filter((f) => {
  const src = readFileSync(f, "utf8");
  return /\buseJobSection\s*\(/.test(src) && !f.endsWith("JobSection.js");
});

let pass = 0;
const fails = [];
const ok = (label, cond, detail = "") => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

ok("some cards use the fold at all", files.length > 0, "nothing found — did the hook move?");

for (const file of files) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const name = rel.split("/").pop();

  // A file may hold SEVERAL folds, and they are not all called `section` —
  // JobDetail has clientSection and visitsSection, JobPlan planSection and
  // daySection. Assert per variable, or the check reports working code as
  // broken, which is its own kind of dead control.
  const holders = [
    ...src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*useJobSection\([^,]+,\s*"([^"]+)"/g),
  ].map((m) => ({ variable: m[1], key: m[2] }));

  ok(`${name}: names the section it folds`, holders.length > 0, "useJobSection needs a key");

  // The toggle has to be drawn, or `open` is a state nobody can change.
  ok(`${name}: draws the toggle`, /<JobSectionToggle\b/.test(src), "state with no control");

  for (const { variable, key } of holders) {
    const where = holders.length > 1 ? `${name} (${key})` : name;
    // The fold has to BIND — the one half that comes free nowhere.
    ok(
      `${where}: binds the body to the fold`,
      new RegExp(`id=\\{${variable}\\.bodyId\\}`).test(src),
      "the chevron turns and nothing hides",
    );
    ok(
      `${where}: …and actually hides it`,
      new RegExp(`hidden=\\{!${variable}\\.open\\}`).test(src) ||
        new RegExp(`\\{${variable}\\.open &&`).test(src),
      "bodyId without hidden is decoration",
    );
  }

  // Heading-wraps-button, never the other way round: a <button> around an
  // <h2> is invalid (a heading is not phrasing content) and loses the card
  // from heading navigation. JobSection.js makes the same argument.
  ok(
    `${name}: the toggle sits inside the heading, not around it`,
    !/<button[^>]*>\s*<h[23]/.test(src),
    "button wrapping a heading",
  );
}

const seen = new Map();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/useJobSection\([^,]+,\s*"([^"]+)"/g)) {
    const prev = seen.get(m[1]);
    ok(
      `the key "${m[1]}" belongs to one card`,
      !prev || prev === file,
      `also used by ${prev ? relative(ROOT, prev) : "?"} — two cards would fold together`,
    );
    seen.set(m[1], file);
  }
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions across ${files.length} folding cards`,
);
process.exit(fails.length ? 1 : 0);
