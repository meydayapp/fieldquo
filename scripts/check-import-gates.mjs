// scripts/check-import-gates.mjs
//
//   npm run check:import-gates
//
// A form refuses BEFORE the work, not after it.
//
// ══ The bug ═══════════════════════════════════════════════════════════════
//
// POST /api/clients, POST /api/clients/import and POST /api/leads/import each
// call requireLevel() and always have. The three screens in front of them
// asked nobody. A member at clientsProperties: view_only saw the Import and New
// client buttons on /app/clients — shown to everyone — chose a CSV, watched
// four hundred rows parse and preview, pressed Import, and got a 403. The same
// shape /app/jobs/new was fixed for: "QA reached the full form by direct URL,
// filled it in, and the save came back 403."
//
// AGENTS.md is explicit that hiding a button is not access control, so this
// asserts BOTH halves: the list stops offering the link, and the page behind it
// refuses on arrival for anyone who typed the URL or kept a bookmark.
//
// ══ Why it is not a changelog ═════════════════════════════════════════════
//
// The category and level are not written down here. They are READ OUT OF THE
// ROUTE — every requireLevel(full, "<category>", "<level>", …) in the API file
// — and the page is required to ask for the same pair. So moving a route from
// full_edit to full_view, or adding a second requireLevel to it, fails here
// until the screen in front of it agrees. A hardcoded pair would pass forever
// while the route drifted underneath it, which is the failure mode this repo
// has already had once in `check:visit-status` reading a map that had moved.
//
// Sources are comment-stripped first: the paragraphs above name every
// requireLevel and useHasLevel spelling this looks for, and would otherwise
// satisfy the check by describing it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;

// label FIRST — reversed, a non-empty label is a truthy condition and the
// check can never fail.
function ok(label, passed, detail = "") {
  if (passed) console.log(`  ok    ${label}`);
  else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

/** Every (category, level) pair the route enforces, in source order. */
function routeRequirements(routeFile) {
  const src = stripComments(read(routeFile));
  return [...src.matchAll(/requireLevel\(\s*\w+\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g)].map(
    (m) => ({ category: m[1], level: m[2] }),
  );
}

const GUARDED = [
  {
    page: "app/app/clients/import/page.js",
    route: "app/api/clients/import/route.js",
    // The first thing the RENDER puts on screen. Deliberately a JSX marker and
    // not `Papa.parse`: an earlier draft used the parse call and failed on a
    // correct page, because handleFile is DEFINED above the early return and
    // only RUNS if the form rendered. Source order is not execution order; the
    // file input is only reachable when the page drew itself.
    workMarker: '<input\n              type="file"',
  },
  {
    page: "app/app/leads/import/page.js",
    route: "app/api/leads/import/route.js",
    workMarker: '<input type="file"',
  },
  {
    page: "app/app/clients/new/page.js",
    route: "app/api/clients/route.js",
    workMarker: "<form",
  },
];

// Lists that link to a guarded page must not offer the link to somebody the
// page will refuse.
const OFFERS = [
  {
    list: "app/app/clients/page.js",
    hrefs: ["/app/clients/new", "/app/clients/import"],
    from: "app/api/clients/route.js",
  },
];

console.log("\nEach form asks for the level its route enforces\n");
for (const { page, route, workMarker } of GUARDED) {
  const reqs = routeRequirements(route);
  ok(
    `${route} enforces a level at all`,
    reqs.length > 0,
    "no requireLevel found — if the route stopped gating, this whole check is asserting nothing",
  );
  if (reqs.length === 0) continue;

  const src = stripComments(read(page));

  for (const { category, level } of reqs) {
    const asks = new RegExp(
      String.raw`useHasLevel\(\s*"${category}"\s*,\s*"${level}"\s*\)`,
    ).test(src);
    ok(
      `${page} asks for ${category}:${level}`,
      asks,
      `the route requires it; the page must ask the same pair, not a looser one`,
    );
  }

  // The refusal has to REPLACE the page, and it has to come before the work.
  const refusalAt = src.search(/if\s*\(\s*!\s*\w+\s*\)\s*return\s*<NoAccessPanel\b/);
  ok(
    `${page} returns a refusal instead of the page`,
    refusalAt !== -1,
    "expected `if (!canX) return <NoAccessPanel …/>` — a greyed-out form is the shape PermissionNotice.js exists to remove",
  );

  const workAt = src.indexOf(workMarker);
  ok(
    `${page} refuses before it renders/parses anything`,
    refusalAt !== -1 && workAt !== -1 && refusalAt < workAt,
    `refusal at ${refusalAt}, "${workMarker}" at ${workAt} — refusing after the work is the 403-at-the-end this exists to stop`,
  );
}

console.log("\nAnd the lists stop offering what those pages refuse\n");
for (const { list, hrefs, from } of OFFERS) {
  const reqs = routeRequirements(from);
  const src = stripComments(read(list));
  ok(
    `${list} asks the same level as ${from}`,
    reqs.length > 0 &&
      reqs.every(({ category, level }) =>
        new RegExp(String.raw`useHasLevel\(\s*"${category}"\s*,\s*"${level}"\s*\)`).test(src),
      ),
    "the list must know the level before it can hide the link",
  );

  // Every link to a guarded page has to sit inside the conditional. Computed
  // by finding each `{<flag> && (` and matching parens forward to its close,
  // rather than by looking back a fixed number of characters — an earlier
  // draft did the latter and reported a correctly gated link as ungated
  // purely because a sibling link sat between it and the guard.
  const regions = [];
  for (const m of src.matchAll(/\{[^{}\n]*\bcanWriteClients\b[^\n]*&&\s*\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    // An unbalanced region ends at EOF, which would swallow the whole file and
    // pass everything. Discarded instead.
    if (depth === 0) regions.push([m.index, i]);
  }
  ok(
    `${list} has at least one canWriteClients region`,
    regions.length > 0,
    "no balanced `{canWriteClients && ( … )}` found — the assertions below would be vacuous",
  );

  for (const href of hrefs) {
    let count = 0;
    let guarded = 0;
    const needle = `href="${href}"`;
    for (let at = src.indexOf(needle); at !== -1; at = src.indexOf(needle, at + 1)) {
      count++;
      if (regions.some(([a, b]) => at > a && at < b)) guarded++;
    }
    ok(
      `${list} gates every link to ${href}`,
      count > 0 && guarded === count,
      count === 0
        ? "no link found — did the href move? this assertion is now vacuous"
        : `${count - guarded} of ${count} link(s) are offered unconditionally`,
    );
  }
}

console.log(
  failures === 0
    ? "\nPASSED — no form collects work it is going to refuse.\n"
    : `\n${failures} problem(s).\n`,
);
process.exit(failures === 0 ? 0 : 1);
