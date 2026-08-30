// scripts/check-designer.mjs
//
// Guards the canvas-editor port (app/components/designer/, lib/designer/)
// against the three ways this exact kind of port goes wrong: a fixed bug
// regressing back to its broken form, a dropped dependency creeping back in,
// and fabric's browser build getting imported somewhere Next's SSR pass can
// reach it.
//
// ══ Two different kinds of assertion, on purpose ═══════════════════════════
//
// transformText()/debounce() are pure JS — they never touch fabric — so
// sections 1 and 3 EXECUTE them, the same way check-ad-ratios.mjs executes
// reflow() rather than reading it. That's why lib/designer/utils.js and
// lib/designer/filters.js are two separate files: splitting createFilter()
// (the one function that imports "fabric") out of utils.js is what makes the
// rest of utils.js importable under plain Node at all. fabric@5.3.0-browser
// touches `window`/`document` at import time — the whole reason it needs the
// "-browser" pin and the ssr:false boundary — so nothing here can import it,
// and createFilter()'s gamma/saturation fix (section 2) is checked by reading
// the source instead.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-designer.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { transformText, isTextType, rgbaObjectToString } from "@/lib/designer/utils";
import { debounce } from "@/lib/designer/debounce";
import { selectionDependentTools } from "@/lib/designer/constants";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// Comments are where this port's own explanatory notes NAME the dependency
// they replaced ("react-use's useEvent replaced with...", "no lodash.debounce
// here"...) — exactly the prose a naive substring scan would misread as the
// dependency still being present. Section 6 needs the CODE, not the prose
// describing what the code deliberately doesn't do, so it strips comments
// first, the same way check-imports.mjs does for the same reason.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(relPath, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(relPath);
  }
  return out;
}

const DESIGNER_FILES = [
  ...walk("app/components/designer"),
  ...walk("lib/designer"),
  "components/Hint.jsx",
  "components/ui/slider.jsx",
  "components/ui/dropdown-menu.jsx",
  "components/ui/tooltip.jsx",
  "components/ui/input.jsx",
  "components/ui/label.jsx",
].filter((f) => fs.existsSync(path.join(ROOT, f)));

// ═════════════════════════════════════════════════════════════════════════
section("1. BUG FIX — transformText() actually normalises legacy text objects");
// ═════════════════════════════════════════════════════════════════════════
// The source clone: `item.type === "text" && (item.type === "textbox")` — a
// comparison whose result is discarded. Fixed to an assignment. Executed
// against a hostile tree: nested groups, a legacy "text" object, an
// "i-text" object that must NOT be touched (only "text" normalises to
// "textbox" — isTextType() treating i-text/textbox/text as equivalent for
// EDITING doesn't mean transformText should rewrite all three), and a
// dangling `objects` array with no matching items.

const tree = [
  {
    type: "group",
    objects: [
      { type: "text", text: "legacy" },
      { type: "i-text", text: "should not change" },
      { type: "textbox", text: "already fine" },
    ],
  },
  { type: "rect" },
];

transformText(tree);

ok(tree[0].objects[0].type === "textbox", "a nested legacy 'text' object becomes 'textbox'");
ok(tree[0].objects[1].type === "i-text", "'i-text' is left alone — only 'text' normalises");
ok(tree[0].objects[2].type === "textbox", "an already-correct 'textbox' is untouched");
ok(tree[1].type === "rect", "non-text objects are untouched");
ok(transformText(undefined) === undefined, "no objects array does not throw");
ok(transformText(null) === undefined, "null does not throw");

const singleText = [{ type: "text" }];
transformText(singleText);
ok(singleText[0].type === "textbox", "a top-level (non-nested) legacy object also normalises");

// ═════════════════════════════════════════════════════════════════════════
section("2. BUG FIX — createFilter('gamma') does not fall through to Saturation");
// ═════════════════════════════════════════════════════════════════════════
// Can't execute this one: createFilter() is in lib/designer/filters.js
// specifically BECAUSE it imports "fabric", and fabric@5.3.0-browser cannot
// load under plain Node (see the module doc above). Read the source instead
// and require an unconditional `break;` between the Gamma constructor call
// and the next `case`.

const filtersSrc = read("lib/designer/filters.js");
const gammaMatch = filtersSrc.match(/case\s+"gamma":([\s\S]*?)case\s+"saturation":/);
ok(!!gammaMatch, "the 'gamma' case exists and precedes 'saturation' in source order");
if (gammaMatch) {
  ok(/\bbreak;/.test(gammaMatch[1]), "'gamma' has its own break — does not fall through to 'saturation'", gammaMatch[1].trim());
  ok(/filters\.Gamma\(/.test(gammaMatch[1]), "the gamma branch still constructs a Gamma filter");
}

// ═════════════════════════════════════════════════════════════════════════
section("3. BUG FIX — saveSvg() exports real SVG, not a renamed PNG");
// ═════════════════════════════════════════════════════════════════════════
// The source clone's saveSvg() called canvas.toDataURL(options) — the same
// raster call savePng() uses — and downloaded it with a ".svg" extension.
// Fixed to call canvas.toSVG(). Checked at the source level (canvas.toSVG is
// a real DOM/fabric call this script cannot execute without fabric loaded).

const editorHookSrc = read("app/components/designer/hooks/useEditor.js");
const saveSvgMatch = editorHookSrc.match(/const saveSvg = \(\) => \{([\s\S]*?)\n  \};/);
ok(!!saveSvgMatch, "saveSvg() is defined in useEditor.js");
if (saveSvgMatch) {
  const body = saveSvgMatch[1];
  ok(/canvas\.toSVG\(/.test(body), "saveSvg() calls canvas.toSVG() — real vector export");
  ok(!/canvas\.toDataURL\(/.test(body), "saveSvg() does NOT call canvas.toDataURL() — the source clone's bug");
  ok(/downloadFile\([^,]+,\s*"svg"\)/.test(body), "the control still downloads a file named .svg — not silently removed");
}

// ═════════════════════════════════════════════════════════════════════════
section("4. debounce() — the lodash.debounce replacement");
// ═════════════════════════════════════════════════════════════════════════
await new Promise((resolveWait) => {
  let calls = 0;
  let lastArg = null;
  const fn = debounce((v) => {
    calls += 1;
    lastArg = v;
  }, 30);

  fn("a");
  fn("b");
  fn("c");

  setTimeout(() => {
    ok(calls === 1, "three rapid calls collapse into one invocation", calls);
    ok(lastArg === "c", "the trailing call's argument wins, not the first", lastArg);
    resolveWait();
  }, 80);
});

// ═════════════════════════════════════════════════════════════════════════
section("5. utils.js — isTextType / rgbaObjectToString against hostile input");
// ═════════════════════════════════════════════════════════════════════════
ok(isTextType("text") && isTextType("i-text") && isTextType("textbox"), "all three text-ish fabric types are recognised");
ok(!isTextType("rect") && !isTextType(undefined), "non-text and undefined are not");
ok(rgbaObjectToString("transparent") === "rgba(0,0,0,0)", "the literal 'transparent' string is handled, not just RGBColor objects");
ok(rgbaObjectToString({ r: 10, g: 20, b: 30 }) === "rgba(10, 20, 30, 1)", "a missing alpha defaults to fully opaque");
ok(rgbaObjectToString({ r: 10, g: 20, b: 30, a: 0 }) === "rgba(10, 20, 30, 0)", "an explicit alpha of 0 is kept, not treated as falsy/missing");

// "remove-bg" is intentionally absent — that sidebar was dropped along with
// the AI backend it needed (see Editor.js). A "remove-bg" entry surviving in
// this list would mean something still expects to open a sidebar this port
// doesn't ship.
ok(!selectionDependentTools.includes("remove-bg"), "'remove-bg' is not a selection-dependent tool — that sidebar was dropped");
ok(!selectionDependentTools.includes("templates") && !selectionDependentTools.includes("ai"), "'templates'/'ai' are not tools — those sidebars were dropped");

// ═════════════════════════════════════════════════════════════════════════
section("6. Dropped dependencies do not creep back in");
// ═════════════════════════════════════════════════════════════════════════
// Substrings chosen to catch both the npm package name and how it shows up
// in an import specifier or comment referencing it, without being so broad
// they'd flag this file's own explanatory prose (kept import-shaped: no bare
// "hono"/"replicate" word-match, which would hit ordinary English text).
const FORBIDDEN = [
  { needle: "@radix-ui", why: "no Radix in this repo — @base-ui/react only" },
  { needle: "react-icons", why: "lucide-react only" },
  { needle: "uploadthing", why: "dropped per AGENTS.md; images go through /api/upload" },
  { needle: "replicate", why: "ai-sidebar (Replicate) was dropped" },
  { needle: "@tanstack", why: "no react-query — saveStatus is plain useState in Editor.js" },
  { needle: "lodash.debounce", why: "replaced by lib/designer/debounce.js" },
  { needle: "uuidv4", why: "replaced by crypto.randomUUID()" },
  { needle: "use-file-picker", why: "replaced by a plain <input type=\"file\">" },
  { needle: "usePaywall", why: "every usePaywall call was dropped" },
  { needle: "react-use", why: "useEvent replaced with useEffect + addEventListener" },
  { needle: "from \"hono\"", why: "no Hono in this port" },
];

for (const file of DESIGNER_FILES) {
  const src = stripComments(read(file));
  for (const { needle, why } of FORBIDDEN) {
    ok(!src.includes(needle), `${file} does not reference "${needle}" (${why})`);
  }
}

// ═════════════════════════════════════════════════════════════════════════
section("7. fabric only ever imported behind a \"use client\" boundary");
// ═════════════════════════════════════════════════════════════════════════
// fabric@5.3.0-browser touches window/document at import time. Every file
// that imports it must open with "use client" — the mechanical signal that
// this module can only ever run in the browser, never during Next's SSR
// pass. (This doesn't by itself guarantee no SERVER COMPONENT imports the
// file directly — see section 8 for the belt: DesignerLoader's ssr:false.)
const FABRIC_IMPORT = /from\s+["']fabric["']|require\(\s*["']fabric["']\s*\)/;
let fabricImportersFound = 0;
for (const file of DESIGNER_FILES) {
  const src = read(file);
  if (!FABRIC_IMPORT.test(src)) continue;
  fabricImportersFound += 1;
  const firstLine = src.split("\n").find((l) => l.trim().length > 0)?.trim();
  ok(firstLine === '"use client";', `${file} imports "fabric" and opens with "use client"`, firstLine);
}
ok(fabricImportersFound > 0, "sanity: at least one file actually imports fabric (the check above isn't vacuously passing)", fabricImportersFound);

// ═════════════════════════════════════════════════════════════════════════
section("8. The editor root is only ever reachable via next/dynamic({ ssr: false })");
// ═════════════════════════════════════════════════════════════════════════
const loaderPath = "app/components/designer/DesignerLoader.js";
ok(fs.existsSync(path.join(ROOT, loaderPath)), "DesignerLoader.js exists — the documented injection point for pages");
if (fs.existsSync(path.join(ROOT, loaderPath))) {
  const loaderSrc = read(loaderPath);
  // Comments stripped before every regex below — a mutation that deletes the
  // real `{ ssr: false }` option while the explanatory comment two lines up
  // still SAYS "ssr: false" must still fail this check. (It didn't, the
  // first time this was mutation-tested — the un-stripped regex matched the
  // prose instead of the code. Fixed by scanning code only, same as
  // section 6's stripComments() use.)
  const loaderCode = stripComments(loaderSrc);
  ok(loaderSrc.trim().startsWith('"use client";'), "DesignerLoader.js opens with \"use client\" — next/dynamic(ssr:false) requires a Client Component caller");
  ok(/from\s+["']next\/dynamic["']/.test(loaderCode), "DesignerLoader.js imports next/dynamic");
  ok(/ssr:\s*false/.test(loaderCode), "the dynamic import passes { ssr: false }");
  ok(/import\(["']@\/app\/components\/designer\/Editor["']\)/.test(loaderCode), "it dynamically imports Editor.js specifically (not some other module)");
}

// ═════════════════════════════════════════════════════════════════════════
section("9. lib/marketing/ratios.js is used, not reimplemented");
// ═════════════════════════════════════════════════════════════════════════
// AGENTS.md item 8: AD_RATIOS + reflow() from the existing module, no local
// copy of the scale math. Comments stripped first — this file's own header
// comment names "reflow()" three times while explaining the wiring, which
// would make a mutation that deletes the real CALL invisible to a raw
// substring/regex scan (caught by mutation-testing this exact assertion:
// removing the `reflow(doc, from, to)` call on its own, leaving the prose
// intact, did not fail this check until it was scoped to code only).
const editorHookCode = stripComments(editorHookSrc);
ok(/from\s+["']@\/lib\/marketing\/ratios["']/.test(editorHookCode), "useEditor.js imports from lib/marketing/ratios");
ok(/\breflow\(doc,\s*from,\s*to\)/.test(editorHookCode), "useEditor.js calls the imported reflow() with (doc, from, to)");
ok(!/function\s+reflow\s*\(/.test(editorHookCode) && !/const\s+reflow\s*=/.test(editorHookCode),
  "useEditor.js does not declare its own reflow — it only imports one");
ok(!/Math\.min\(\s*\w+\s*\/\s*\w+,\s*\w+\s*\/\s*\w+\s*\)/.test(editorHookCode),
  "no inline min(scaleX, scaleY)-shaped fit computation — that's reflow()'s job, not duplicated here");

// Same reasoning as editorHookCode above — this file's own module doc names
// both AD_RATIOS and changeRatio() while explaining the wiring.
const settingsCode = stripComments(read("app/components/designer/SettingsSidebar.js"));
ok(/\bAD_RATIOS\b/.test(settingsCode), "SettingsSidebar.js renders the AD_RATIOS presets");
ok(/onClick=\{\(\)\s*=>\s*editor\?\.changeRatio\(/.test(settingsCode),
  "SettingsSidebar.js wires a click to editor.changeRatio() — not a fresh implementation of frame-switching");

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
