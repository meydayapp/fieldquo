// scripts/check-sidebar-focus.mjs
//
// Why the sidebar's search box only accepted one character at a time.
//
// ══ The bug ════════════════════════════════════════════════════════════════
//
// SidebarContent was declared inside AdminSidebar's render body — correct, it
// closes over about twenty pieces of local state — and then rendered as
// `<SidebarContent />`.
//
// A function declared in a render body gets a NEW identity on every render.
// React compares element types by identity, so that was a different component
// type each time: unmount the whole subtree, mount a fresh one. Every keystroke
// in the filter destroyed and recreated the <input>, and the browser dropped
// focus with it.
//
// The reported symptom was "the search box stops after every character, I need
// to focus it again". The cause was not in the search code, the filter, or the
// input. It was one pair of angle brackets.
//
// ══ Why this check reads source ════════════════════════════════════════════
//
// This is a React reconciliation property, not a pure function — there is no
// value to execute and assert on. The failure is invisible to every other check
// in this repo: the build passes, the imports resolve, the component renders,
// and the bug only exists between two renders in a browser. So the guard has to
// be structural, and it has to be specific enough to fail if the JSX form comes
// back.
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SRC = strip(readFileSync("app/components/layout/AdminSidebar.js", "utf8"));

section("1. The inner body is CALLED, never rendered as an element");

ok(/function sidebarContent\(/.test(SRC), "the inner body exists and is lowercase");
ok(
  /\{sidebarContent\(\{ forceExpanded: false \}\)\}/.test(SRC),
  "the desktop rail calls it",
);
ok(
  /\{sidebarContent\(\{ forceExpanded: true \}\)\}/.test(SRC),
  "the mobile drawer calls it too — both, or the drawer keeps the bug",
);
// The regression that would silently return: JSX on a locally-declared
// function. Lowercase makes the mistake loud instead of silent, but assert it
// anyway, because a rename back to PascalCase plus JSX is one careless edit.
ok(!/<SidebarContent[\s/>]/.test(SRC), "nothing renders it as <SidebarContent />");
ok(!/<sidebarContent[\s/>]/.test(SRC), "…and nothing renders the lowercase form either");

section("2. No OTHER component is declared in the render body and rendered as JSX");

// The same fault, one copy-paste away. Find every function declared with a
// capital-letter name inside the module and check none is both nested and used
// as an element — the exact shape that costs focus, scroll position and any
// state held below it.
const nested = [...SRC.matchAll(/^\s{2,}function ([A-Z]\w*)\(/gm)].map((m) => m[1]);
ok(nested.length === 0, "no capitalised function is declared inside a render body", nested);

section("3. The filter itself is a plain controlled input, imported from outside");

const FILTER = strip(readFileSync("app/components/layout/NavFilter.js", "utf8"));
ok(/export function NavFilter\(/.test(FILTER), "NavFilter is a module-level component");
ok(/value=\{value\}/.test(FILTER) && /onChange=\{\(e\) => onChange\(e\.target\.value\)\}/.test(FILTER),
  "…a controlled input with no internal state to lose");
// A key that changes per render remounts just as surely as a new type does.
ok(!/<input[^>]*\skey=/.test(FILTER), "the input carries no key that could change between renders");
ok(/from "@\/app\/components\/layout\/NavFilter"/.test(SRC), "and the sidebar imports it rather than declaring it inline");

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
