// scripts/check-empty-vs-error.mjs
//
// The rule: a page that failed to load must show the failure INSTEAD of an
// empty state, and must never print a count it does not have.
//
//   npm run check:empty-vs-error
//
// ── What this script can actually prove ────────────────────────────────────
//
// Not much, and it is important to be honest about that rather than let a
// green tick imply more than it means.
//
// This is a TEXT scan. It does not parse JSX, does not build a render tree,
// and cannot follow state through a component. So it cannot prove the thing
// the rule is really about — that on a failed fetch the empty state does not
// appear on screen. Only a browser can prove that.
//
// What it CAN do is check the two mechanical preconditions that made the bug
// possible in the first place, both of which are visible in the source text:
//
//   1. A list whose state starts at `useState([])` is claiming "there are zero
//      of these" before the server has said anything. Every instance of the
//      original bug — "0 clients total", "$0.00 outstanding", "Nothing
//      outstanding" — traces back to that one initial value. A list that
//      starts at `null` cannot fabricate a count, whatever the JSX does.
//
//   2. A page that renders an empty state after a client-side fetch needs SOME
//      structural way to suppress it on failure. This script accepts the
//      shared <ListState> component, or an early `return` in an error branch.
//      It cannot tell a correct hand-rolled guard from a broken one; it only
//      insists that something is there to inspect.
//
// And one thing it can prove outright, because it is a pure syntax question:
//
//   3. `reportResponseError(res, setSomething, …)` — the three-argument form.
//      lib/clientErrors.js supports it deliberately now, but only in the
//      (res, setter, fallback) order. Any other function in slot two is a
//      mistake, and it is the mistake that made a page show the API's raw
//      word "Unauthorized" while its own error banner stayed empty.
//
// So: rule 1 is a real invariant, rule 3 is a real invariant, rule 2 is a
// smoke alarm. A page can pass all three and still render both states. Treat a
// pass as "the known failure shapes are absent", not as "this is correct".
//
// ── Why a curated list rather than every page ──────────────────────────────
//
// Pages outside GOVERNED are not held to this yet — several are calendars,
// grids and wizards where "the list" is not a list. Adding a page to the array
// is the deliberate act of opting it in. An unlisted page is not a silent
// exemption: the roster is printed on every run, so what is uncovered is as
// visible as what is covered.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;

function ok(label, passed, detail = "") {
  checks++;
  if (passed) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}

/**
 * Every call to `name(...)` in `src`, as arrays of top-level argument text.
 *
 * Tracks paren/bracket depth and string literals so that `t("a.b")` counts as
 * one argument rather than being chopped at its own bracket. Not a parser —
 * it does not understand comments or template-literal interpolation — but it
 * is correct for the shapes this call site takes, and it fails closed: an
 * unterminated call yields no arguments rather than wrong ones.
 */
function callArgs(src, name) {
  const calls = [];
  const needle = `${name}(`;
  let from = 0;

  for (;;) {
    const start = src.indexOf(needle, from);
    if (start === -1) break;
    from = start + needle.length;

    let depth = 1;
    let quote = null;
    let current = "";
    const args = [];

    for (let i = from; i < src.length; i++) {
      const ch = src[i];

      if (quote) {
        if (ch === "\\") {
          current += ch + (src[i + 1] ?? "");
          i++;
          continue;
        }
        if (ch === quote) quote = null;
        current += ch;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        current += ch;
        continue;
      }
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      if (ch === ")" || ch === "]" || ch === "}") depth--;

      if (depth === 0) {
        args.push(current.trim());
        calls.push(args.filter((a) => a !== ""));
        break;
      }
      if (ch === "," && depth === 1) {
        args.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
  }

  return calls;
}

// ── The pages held to the rule ─────────────────────────────────────────────
//
// `state` is the list variable whose initial value must be null.
const GOVERNED = [
  { file: "app/app/clients/page.js", state: "clients" },
  { file: "app/app/quotes/page.js", state: "quotes" },
  { file: "app/app/jobs/page.js", state: "jobs" },
  { file: "app/app/invoices/page.js", state: "invoices" },
  { file: "app/app/leads/page.js", state: "leads" },
  { file: "app/app/tasks/page.js", state: "tasks" },
  { file: "app/app/funnels/page.js", state: "funnels" },
  { file: "app/app/marketing/page.js", state: "campaigns" },
  { file: "app/app/marketing/subscribers/page.js", state: "subscribers" },
  { file: "app/app/crew-inbox/page.js", state: "messages" },
  { file: "app/app/receptionist/page.js", state: "data" },
];

// Text that means "you have nothing", in the copy or in a translation key.
// Deliberately loose — a false positive here costs one line in GOVERNED, a
// false negative costs a contractor re-typing their client list.
const EMPTY_MARKERS = [
  /\bempty\b/i,
  /No \w+ yet/i,
  /Nothing (here|outstanding)/i,
  /Add your first/i,
  /Create your first/i,
];

console.log("Empty state vs error state\n");

for (const { file, state } of GOVERNED) {
  const src = read(file);
  console.log(`${file}`);

  // ── 1. The list must not start as a claim of zero ────────────────────────
  const declared = new RegExp(
    `const \\[${state},\\s*set\\w+\\]\\s*=\\s*useState\\(([^)]*)\\)`,
  ).exec(src);

  ok(
    `${state} starts as null, not []`,
    declared ? declared[1].trim() === "null" : false,
    declared
      ? `useState(${declared[1].trim()}) — an empty array asserts "zero of these" before the server answered`
      : `could not find a useState declaration for '${state}' (renamed? update GOVERNED)`,
  );

  // ── 2. Something must suppress the empty state on failure ────────────────
  const hasEmptyState = EMPTY_MARKERS.some((re) => re.test(src));
  if (hasEmptyState) {
    const usesListState = /<ListState[\s>]/.test(src);
    // The hand-rolled alternative: an error branch that returns before the
    // empty state can render. Weak evidence, accepted as such.
    const earlyReturn = /if\s*\(\s*error\w*\s*\)[\s\S]{0,80}?return/.test(src);
    ok(
      "empty state is gated by <ListState> or an early error return",
      usesListState || earlyReturn,
      "renders an empty state after a fetch with no structural guard against showing it on failure",
    );
  } else {
    checks++;
    console.log("  ok    no empty state to gate");
  }

  // ── 3. No raw protocol word can reach the banner via a bad call shape ────
  //
  // The supported three-arg order is (res, setter, fallback). Anything else in
  // slot two that is a function is the old mistake.
  // A regex cannot do this: the fallback is routinely `t("some.key")`, whose
  // own parentheses defeat any `[^)]` character class. So the arguments are
  // split by scanning with a depth counter, which is short and actually right.
  const badCalls = callArgs(src, "reportResponseError").filter((args) => {
    if (args.length < 3) return false; // one- and two-arg forms are fine
    const isSetter = (a) => /^set[A-Z_]/.test(a);
    // (res, setter, fallback) is supported. A setter anywhere after slot two
    // means the arguments were written the other way round.
    return !isSetter(args[1]) && args.slice(2).some(isSetter);
  });
  ok(
    "reportResponseError arguments are in (res, setter, fallback) order",
    badCalls.length === 0,
    badCalls.map((a) => `reportResponseError(${a.join(", ")})`).join("\n          "),
  );

  console.log("");
}

// ── The roster, printed so gaps are visible ────────────────────────────────
//
// Every page.js under app/app that does a client-side fetch and is not in
// GOVERNED. Reported, never failed — see the header on why.
const uncovered = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel);
    else if (entry.name === "page.js") {
      if (GOVERNED.some((g) => g.file === rel)) continue;
      const src = read(rel);
      if (!/"use client"/.test(src)) continue;
      if (!/fetch\(|fetchJson\(|fetchList\(|fetchArray\(/.test(src)) continue;
      if (!EMPTY_MARKERS.some((re) => re.test(src))) continue;
      uncovered.push(rel);
    }
  }
};
walk("app/app");

console.log(
  `Not governed (client fetch + an empty state, not yet opted in): ${uncovered.length}`,
);
for (const f of uncovered) console.log(`  - ${f}`);

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
