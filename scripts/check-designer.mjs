// scripts/check-designer.mjs
//
// Guards the canvas-editor port (app/components/designer/, lib/designer/,
// app/api/designer/) against the ways this exact kind of port goes wrong: a
// fixed bug regressing back to its broken form, a dropped dependency
// creeping back in, fabric's browser build getting imported somewhere
// Next's SSR pass can reach it — and, since the owner's 2026-08-30
// correction restored templates/Unsplash/AI generation/background removal,
// the free/premium line drawn between them drifting: a free feature
// accidentally gated behind the AI spend check, or the two AI actions
// quietly ending up priced differently instead of sharing one kind.
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
import { buildPhotoContext, scopeOfWorkFacts } from "@/lib/marketing/jobPhotoContext";
import { parseModelJson } from "@/lib/ai/marketingCopy";

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
  ...walk("app/api/designer"),
  ...walk("lib/designer"),
  "components/Hint.jsx",
  "components/ui/slider.jsx",
  "components/ui/dropdown-menu.jsx",
  "components/ui/tooltip.jsx",
  "components/ui/input.jsx",
  "components/ui/label.jsx",
  "components/ui/textarea.jsx",
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

// Restored per the owner's 2026-08-30 correction (see Editor.js's module
// doc): "remove-bg" IS selection-dependent — deselecting must close its
// sidebar the same way it closes fill/stroke/opacity — while "templates" and
// "ai" are NOT, because neither needs anything selected to be useful.
ok(selectionDependentTools.includes("remove-bg"), "'remove-bg' IS a selection-dependent tool — its sidebar needs a selected image, same as fill/stroke/opacity");
ok(!selectionDependentTools.includes("templates") && !selectionDependentTools.includes("ai"), "'templates'/'ai' are NOT selection-dependent — both work with nothing selected");

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

// ═════════════════════════════════════════════════════════════════════════
section("10. Template gallery — free, and genuinely a Prisma model");
// ═════════════════════════════════════════════════════════════════════════
// Restored per the coordinator's 2026-08-30 correction: every editor feature
// in the source clone exists here except AI image generation. Checked at the
// source level (no live DB query from a script that runs in every
// environment, including ones with no DATABASE_URL — the seed itself was
// already run and verified by hand against the real database this session).
const schemaSrc = read("prisma/schema.prisma");
const templateModelMatch = schemaSrc.match(/model DesignTemplate \{([\s\S]*?)\n\}/);
ok(!!templateModelMatch, "prisma/schema.prisma defines model DesignTemplate");
if (templateModelMatch) {
  // Prisma's `///` doc comments stripped the same way `//` is elsewhere —
  // this schema's OWN comment on the model explains why `isPro` was
  // deliberately not carried over, and that explanation contains the word
  // "isPro". Reading fields, not prose, again.
  const modelBody = templateModelMatch[1].replace(/^\s*\/\/\/.*$/gm, "");
  ok(/^\s*name\s+String\s+@unique/m.test(modelBody), "DesignTemplate.name is unique (the seed's upsert key)");
  ok(/^\s*json\s+Json/m.test(modelBody), "DesignTemplate.json is a native Json field");
  ok(/^\s*thumbnailUrl\s+String\?/m.test(modelBody), "DesignTemplate.thumbnailUrl is nullable — no image is a real, renderable state");
  ok(
    !/^\s*isPro\b/m.test(modelBody) && !/^\s*isTemplate\b/m.test(modelBody),
    "DesignTemplate has no isPro/isTemplate column — nothing here is paywalled, so there is nothing for either flag to gate",
  );
}

const templatesRouteSrc = read("app/api/designer/templates/route.js");
ok(/memberOrRefusal\s*\(/.test(templatesRouteSrc), "GET /api/designer/templates resolves its member through the guard");
ok(/db\.designTemplate\.findMany\(/.test(templatesRouteSrc), "it actually queries DesignTemplate — not a stub");
ok(
  !stripComments(templatesRouteSrc).includes("isPro") && !stripComments(templatesRouteSrc).includes("usePaywall"),
  "the templates route has no paywall check — the gallery is free",
);

const editorSrc = read("app/components/designer/Editor.js");
ok(/<TemplateSidebar\b/.test(editorSrc), "Editor.js renders TemplateSidebar");
const sidebarRailSrc = read("app/components/designer/Sidebar.js");
ok(
  /onClick=\{\(\)\s*=>\s*onChangeActiveTool\("templates"\)\}/.test(sidebarRailSrc),
  "the left icon rail has a real launcher for the templates tool — not a rail with no way to reach it",
);

// ═════════════════════════════════════════════════════════════════════════
section("11. AI image tools — the one premium feature, gated and priced once");
// ═════════════════════════════════════════════════════════════════════════
const registrySrc = read("lib/features/registry.js");
ok(/key:\s*"marketing_designer"/.test(registrySrc), "\"marketing_designer\" is a registered feature");

const registryEntryMatch = registrySrc.match(/\{\s*\n\s*key:\s*"marketing_designer"[\s\S]*?\n\s*\},\n\];/);
ok(!!registryEntryMatch, "the marketing_designer entry can be isolated for its own checks");
if (registryEntryMatch) {
  const entry = registryEntryMatch[0];
  ok(/"\/api\/designer\/remove-bg"/.test(entry), "marketing_designer's apiPrefixes cover the remove-bg route");
  ok(/"\/api\/designer\/generate"/.test(entry), "marketing_designer's apiPrefixes cover the generate route");
  // The whole point of the coordinator's correction: templates, uploads and
  // stock photos must NOT go dark if this feature is ever locked or hidden.
  ok(
    !entry.includes("/api/designer/templates") && !entry.includes("/api/designer/unsplash"),
    "marketing_designer's apiPrefixes do NOT cover templates or unsplash — those stay free and reachable regardless of this feature's state",
  );
}

const adapterSrc = read("lib/designer/aiImageAdapter.js");
ok(/export async function requestAiImage/.test(adapterSrc), "aiImageAdapter.js exports requestAiImage()");
ok(/export async function statusForCompany/.test(adapterSrc), "aiImageAdapter.js exports statusForCompany()");
ok(
  (adapterSrc.match(/featureAllowsSpend\(companyId,\s*"marketing_designer"\)/g) || []).length >= 2,
  "both statusForCompany() and requestAiImage() check the SAME literal feature key — not a copy that can drift",
);

// The seam, now CLOSED.
//
// These two assertions used to say the opposite: that lib/ai/images.js did NOT
// exist and that the adapter did NOT import it. Both were correct inside an
// isolated worktree where the vendor call was being written in parallel, and
// both became false the moment the two branches merged — a check that asserts
// scaffolding is a check that fails the day the scaffolding comes down.
//
// Written as "@/lib/ai/" + "images" rather than the joined literal on purpose —
// scripts/check-imports.mjs (part of `npm run build`) scans this very file's
// source text for anything shaped like `from "..."`, and the joined literal
// sitting near the word "from" reads AS a real import specifier. Splitting it
// is the fix check-imports.mjs's own header prescribes for that trap.
const VENDOR_MODULE = "@/lib/ai/" + "images";
ok(
  fs.existsSync(path.join(ROOT, "lib/ai/images.js")),
  "the vendor call exists — the adapter has something real to reach",
);
ok(
  stripComments(adapterSrc).includes(VENDOR_MODULE),
  "aiImageAdapter.js calls it, so the AI controls are no longer disabled scaffolding",
);
ok(
  /AI_IMAGE_VENDOR_READY = true/.test(adapterSrc),
  "…and the readiness flag says so, so the routes stop refusing with vendor_unavailable",
);
// The un-refunded-charge shape the sibling worktree's own mutation testing
// found: generateMarketingImage returns NULL when the vendor refuses rather
// than throwing, so a bare try/catch never fires and the reservation is kept
// for a picture nobody got.
ok(
  /if \(!result\?\.url\) throw/.test(adapterSrc),
  "a vendor that declines WITHOUT throwing still reaches the refund — a null return is not an exception",
);
ok(
  !/new OpenAI|from "openai"/.test(adapterSrc),
  "…and it goes through lib/ai/provider.js, the only file allowed to talk to the vendor",
);

const generateRouteSrc = read("app/api/designer/generate/route.js");
const removeBgRouteSrc = read("app/api/designer/remove-bg/route.js");
for (const [name, src] of [["generate", generateRouteSrc], ["remove-bg", removeBgRouteSrc]]) {
  const code = stripComments(src);
  ok(/requestAiImage\(/.test(code), `${name}/route.js calls the shared adapter, not its own spend logic`);
  ok(
    !/requestAiImage\(\s*\{[^}]*\bkind:/s.test(code),
    `${name}/route.js does not pass its own "kind" to requestAiImage — the adapter alone decides the spend kind, so the two routes cannot drift onto different prices`,
  );
  ok(
    /priceCents/.test(code) && /balanceCents/.test(code) && /shortfallCents/.test(code),
    `${name}/route.js's refusal body carries price, balance and shortfall — not "something went wrong"`,
  );
}

// "Never a button that appears to work": both sidebars must render their
// action disabled BEFORE a click, driven by the status fetch, not just fail
// after the fact.
const aiSidebarSrc = read("app/components/designer/AiSidebar.js");
const removeBgSidebarSrc = read("app/components/designer/RemoveBgSidebar.js");
for (const [name, src] of [["AiSidebar", aiSidebarSrc], ["RemoveBgSidebar", removeBgSidebarSrc]]) {
  ok(/useAiImageStatus\(/.test(src), `${name}.js reads live status before rendering its action`);
  ok(/disabled=\{!status\?\.allowed/.test(src), `${name}.js's action button is disabled whenever status.allowed is false`);
}

// ═════════════════════════════════════════════════════════════════════════
section("12. Unsplash — restored, free, key never reaches the browser");
// ═════════════════════════════════════════════════════════════════════════
const unsplashLibSrc = read("lib/designer/unsplash.js");
ok(/process\.env\.UNSPLASH_ACCESS_KEY/.test(unsplashLibSrc), "lib/designer/unsplash.js reads a server-only env var");
for (const file of DESIGNER_FILES) {
  // Comments stripped — lib/designer/unsplash.js's own header explains, in
  // prose, why it does NOT use NEXT_PUBLIC_UNSPLASH_ACCESS_KEY the way the
  // source clone did, which put that exact string in a comment for a
  // raw-text scan to trip over.
  ok(
    !stripComments(read(file)).includes("NEXT_PUBLIC_UNSPLASH"),
    `${file} does not reference a public (browser-exposed) Unsplash key`,
  );
}

const unsplashRouteSrc = read("app/api/designer/unsplash/route.js");
ok(/reason:\s*"not_configured"/.test(unsplashRouteSrc), "the route can say \"not configured\"");
ok(/reason:\s*"unavailable"/.test(unsplashRouteSrc), "the route can separately say \"unavailable\" — a different sentence for a different problem");
// The two reasons must come from DIFFERENT branches — a single `reason:
// "not_configured"` that also covers a provider failure would be exactly
// the conflation AGENTS.md calls a bug.
ok(
  (unsplashRouteSrc.match(/reason:\s*"(not_configured|unavailable)"/g) || []).length === 2,
  "each reason string is written exactly once — one conditional branch per meaning, not reused across two different failures",
);
ok(read("docs/VERCEL.md").includes("UNSPLASH_ACCESS_KEY"), "UNSPLASH_ACCESS_KEY is documented in docs/VERCEL.md");

// ═════════════════════════════════════════════════════════════════════════
section("13. Seed content — real templates only, no third-party hotlinks");
// ═════════════════════════════════════════════════════════════════════════
// coming_soon and flash_sale are pure shapes/text from the source clone's own
// sample templates — genuinely real, not fabricated. car_sale and travel are
// deliberately NOT seeded: both embed a `type:"image"` object pointing at a
// live third-party CDN this repo doesn't control (uploadthing, Unsplash's
// image host respectively), which can 404 the moment either host rotates the
// file — a template that silently breaks is worse than one that was never
// offered. See prisma/seed-design-templates.js's own header for the full
// reasoning; this just proves the file still agrees with it.
const seedSrc = read("prisma/seed-design-templates.js");
const seedCode = stripComments(seedSrc);
ok(seedCode.includes("coming-soon.json"), "Coming Soon is an active (uncommented) seed entry");
ok(seedCode.includes("flash-sale.json"), "Flash Sale is an active (uncommented) seed entry");
ok(
  !seedCode.includes("car-sale.json") && !seedCode.includes("travel.json"),
  "car_sale and travel stay commented out — not active seed entries — because their JSON embeds a live third-party image URL this repo doesn't control",
);
// And prove they are still THERE, just commented — scaffolded for a five-
// minute follow-up, not silently deleted.
ok(
  seedSrc.includes("car-sale.json") && seedSrc.includes("travel.json"),
  "car_sale and travel are still documented in the file (commented), not removed outright",
);
ok(
  fs.existsSync(path.join(ROOT, "public/design-templates/coming-soon.png")) &&
    fs.existsSync(path.join(ROOT, "public/design-templates/flash-sale.png")),
  "both seeded templates have a real thumbnail file checked into public/",
);

// ═════════════════════════════════════════════════════════════════════════
section("14. Owner's usability complaints — rail spacing, mobile layout, AI prompt copy");
// ═════════════════════════════════════════════════════════════════════════
// The owner's four verbatim complaints (see the coordinator's brief): the
// tool rail wasted vertical space, the editor wasn't mobile-friendly, the AI
// panel had no visible prompt, and its placeholder was the source clone's
// own sample text. Comments stripped throughout — same reasoning as
// sections 6/8/9 above: this section's own module docs (SidebarItem.js,
// Sidebar.js, ShapeSidebar.js, AiSidebar.js) all describe the fix in prose
// using the very words a naive scan would look for ("aspect-video",
// "fixed", "astronaut").

const sidebarItemSrc = read("app/components/designer/SidebarItem.js");
const sidebarItemCode = stripComments(sidebarItemSrc);
ok(
  !/aspect-video/.test(sidebarItemCode),
  "SidebarItem.js no longer forces the rail button into a 16:9 box — that's what turned a 100px-wide rail into ~56px-tall buttons before padding",
);
ok(
  /\bh-14\b/.test(sidebarItemCode) && /md:h-16\b/.test(sidebarItemCode),
  "…replaced with a plain, compact fixed height instead",
);

const sidebarRailSrc2 = read("app/components/designer/Sidebar.js");
const sidebarRailCode2 = stripComments(sidebarRailSrc2);
ok(
  !/\bw-\[100px\]/.test(sidebarRailCode2),
  "Sidebar.js no longer hardcodes the old 100px-wide rail",
);
ok(
  /\bfixed\b[^"]*\binset-x-0\b[^"]*\bbottom-0\b/.test(sidebarRailCode2) &&
    /md:static\b/.test(sidebarRailCode2) &&
    /md:h-full\b/.test(sidebarRailCode2),
  "the rail is `fixed` to the bottom of the viewport below `md`, and reverts to the static side rail at `md` and up",
  sidebarRailCode2,
);

// The bottom-sheet treatment is shared by all fourteen tool panels — a
// regression that fixes only some of them (e.g. reverting one file back to
// a fixed 360px column) would still leave a phone unable to reach that one
// tool. Looped, not spot-checked.
const TOOL_PANEL_FILES = [
  "AiSidebar.js",
  "DrawSidebar.js",
  "FilterSidebar.js",
  "FillColorSidebar.js",
  "FontSidebar.js",
  "ImageSidebar.js",
  "SettingsSidebar.js",
  "RemoveBgSidebar.js",
  "ShapeSidebar.js",
  "OpacitySidebar.js",
  "StrokeColorSidebar.js",
  "TextSidebar.js",
  "TemplateSidebar.js",
  "StrokeWidthSidebar.js",
];
const OLD_DESKTOP_ONLY_PANEL_CLASS = "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card";
for (const name of TOOL_PANEL_FILES) {
  const p = `app/components/designer/${name}`;
  const code = stripComments(read(p));
  ok(
    !code.includes(OLD_DESKTOP_ONLY_PANEL_CLASS),
    `${p} no longer uses the old desktop-only fixed-360px panel class unconditionally`,
  );
  ok(
    /\bfixed\b/.test(code) && /bottom-16\b/.test(code) && /md:relative\b/.test(code) && /md:w-\[360px\]/.test(code),
    `${p} renders as a fixed bottom sheet below \`md\` and the original 360px side panel at \`md\` and up`,
  );
}

// Editor.js owns the one shared backdrop (not fourteen copies of it) and
// gives the canvas area room for the fixed bottom rail.
const editorSrc2 = read("app/components/designer/Editor.js");
const editorCode2 = stripComments(editorSrc2);
ok(
  /activeTool !== "select"/.test(editorCode2) && /md:hidden/.test(editorCode2),
  "Editor.js renders a mobile-only backdrop behind whichever tool panel is open",
);
ok(/\bpb-16\b/.test(editorCode2), "the canvas area reserves room for the fixed bottom rail on mobile");

// The AI panel: a real, visible prompt box, in the audience's own language.
const aiSidebarSrc2 = read("app/components/designer/AiSidebar.js");
const aiSidebarCode2 = stripComments(aiSidebarSrc2);
ok(
  !/astronaut/i.test(aiSidebarCode2) && !/horse on mars/i.test(aiSidebarCode2),
  "AiSidebar.js no longer carries the source clone's own sample prompt as its placeholder",
);
ok(!/rows=\{10\}/.test(aiSidebarCode2), "the textarea is no longer 10 rows tall — too tall for a phone once the keyboard is up");
ok(/<Textarea\b/.test(aiSidebarCode2), "AiSidebar.js still renders a real Textarea, not just an error message");
ok(
  !/!loading\s*&&\s*status\?\.allowed/.test(aiSidebarCode2) && !/status\?\.allowed\s*&&\s*!loading/.test(aiSidebarCode2),
  "…and rendering the form is NOT additionally gated on status.allowed — a disallowed company must still SEE the prompt box, only unable to submit it",
);
// The reason banner has to live INSIDE the same <form> as the textarea, not
// as a separate block above it — that's the literal "stacked, not one
// panel" bug the owner reported as "no prompt or anything of the sort".
const aiFormMatch = aiSidebarCode2.match(/<form\b[\s\S]*?<\/form>/);
ok(!!aiFormMatch, "AiSidebar.js's form can be isolated");
if (aiFormMatch) {
  const formBody = aiFormMatch[0];
  // `status` plus whatever else it is handed — the second argument is `t`,
  // added when the money sentence moved into the catalogue. Pinning the exact
  // arity here would fail on a translated refusal, which is the opposite of
  // what this line is guarding.
  ok(/disabledReasonText\(status[,)]/.test(formBody), "the refusal reason renders INSIDE the form, not in a separate block above it");
  ok(/<Textarea\b/.test(formBody), "…in the same form as the actual prompt textarea");
}

// A vague "Feature not available for this object" told the owner nothing
// actionable — replaced with a plain instruction.
const removeBgSrc2 = read("app/components/designer/RemoveBgSidebar.js");
ok(
  !stripComments(removeBgSrc2).includes("Feature not available for this object"),
  "RemoveBgSidebar.js's empty state tells the person what to do (select a photo), not just that something is unavailable",
);

// No hardcoded bg-white anywhere in the designer tree — a panel that's white
// in dark mode is the exact bug AGENTS.md's item 5 and this file's own
// section 6 already guard against for OTHER dropped dependencies; this
// checks the literal Tailwind class itself, across every designer file.
for (const file of DESIGNER_FILES) {
  const code = stripComments(read(file));
  ok(!/\bbg-white\b/.test(code), `${file} does not hardcode bg-white`);
}

// ═════════════════════════════════════════════════════════════════════════
section("15. AI text bridge — job photo context grounding and anti-embellishment");
// ═════════════════════════════════════════════════════════════════════════
// buildPhotoContext(), scopeOfWorkFacts() and parseModelJson() are pure —
// see lib/marketing/jobPhotoContext.js's own header for why that's
// deliberate — so they're executed here the same way section 5 executes
// isTextType()/rgbaObjectToString(), not just read.
//
// The scenario the coordinator asked to see proven: two photos both tagged
// "finish" and none tagged "start" must not be describable as a
// before/after. beforeAfterAvailable is the pre-computed fact the system
// prompt in lib/ai/marketingCopy.js relies on instead of leaving that
// judgment to the model.
ok(
  buildPhotoContext(
    ["https://cdn/a.jpg", "https://cdn/b.jpg"],
    [
      { url: "https://cdn/a.jpg", stage: "finish", caption: null, jobId: "job1" },
      { url: "https://cdn/b.jpg", stage: "finish", caption: null, jobId: "job1" },
    ],
  ).beforeAfterAvailable === false,
  "two 'finish' photos with no 'start' photo — beforeAfterAvailable is false, not inferred true",
);
ok(
  buildPhotoContext(
    ["https://cdn/a.jpg", "https://cdn/b.jpg"],
    [
      { url: "https://cdn/a.jpg", stage: "start", caption: null, jobId: "job1" },
      { url: "https://cdn/b.jpg", stage: "finish", caption: null, jobId: "job1" },
    ],
  ).beforeAfterAvailable === true,
  "a genuine start+finish pair — beforeAfterAvailable is true",
);

// "issue" photos are an office record and must never reach a marketing
// asset — dropped from BOTH the images sent to the vendor and the text
// describing them, not merely hidden from one or the other.
{
  const withIssue = buildPhotoContext(
    ["https://cdn/issue.jpg", "https://cdn/finish.jpg"],
    [
      { url: "https://cdn/issue.jpg", stage: "issue", caption: "water damage behind cabinet", jobId: "job1" },
      { url: "https://cdn/finish.jpg", stage: "finish", caption: null, jobId: "job1" },
    ],
  );
  ok(!withIssue.images.includes("https://cdn/issue.jpg"), "an issue photo is dropped from the images sent to the vendor");
  ok(!withIssue.photos.some((p) => p.url === "https://cdn/issue.jpg"), "…and from the text describing the photo set");
  ok(withIssue.excludedIssue.includes("https://cdn/issue.jpg"), "…and is reported back as excluded, not silently dropped");
  ok(withIssue.images.includes("https://cdn/finish.jpg"), "its non-issue sibling from the same job is still included");
}
ok(
  buildPhotoContext(
    ["https://cdn/issue1.jpg", "https://cdn/issue2.jpg"],
    [
      { url: "https://cdn/issue1.jpg", stage: "issue", caption: null, jobId: "job1" },
      { url: "https://cdn/issue2.jpg", stage: "issue", caption: null, jobId: "job1" },
    ],
  ).images.length === 0,
  "every supplied photo tagged issue — nothing usable reaches the vendor",
);

// Photos spanning two different jobs: only the most-represented job's story
// gets told, so a caption never mixes two jobs' work into one claim.
{
  const twoJobs = buildPhotoContext(
    ["https://cdn/a.jpg", "https://cdn/b.jpg", "https://cdn/c.jpg"],
    [
      { url: "https://cdn/a.jpg", stage: "start", caption: null, jobId: "job1" },
      { url: "https://cdn/b.jpg", stage: "finish", caption: null, jobId: "job1" },
      { url: "https://cdn/c.jpg", stage: "finish", caption: null, jobId: "job2" },
    ],
  );
  ok(twoJobs.jobId === "job1", "the job with more photos on the canvas wins the tie-break");
  ok(twoJobs.excludedOtherJob.includes("https://cdn/c.jpg"), "the other job's photo is excluded, not silently merged in");
  ok(!twoJobs.images.includes("https://cdn/c.jpg"), "…and never reaches the vendor either");
}

// A photo with no JobPhoto match at all (a stock photo, a fresh upload never
// filed against a job) is a real, legitimate case — kept as an image, but
// carrying no invented tag.
{
  const untagged = buildPhotoContext(["https://cdn/stock.jpg"], []);
  ok(untagged.images.includes("https://cdn/stock.jpg"), "an unmatched photo is still sent — it's a real photo on the canvas");
  ok(untagged.photos[0].tag === null && untagged.photos[0].tagLabel === null, "…but with no tag invented for it");
}

// A company-defined custom tag (docs/PHOTO-TAGS.md) is not one of
// lib/gallery/stages.js's four known keys, and stageLabel() falls back to
// "In progress" for ANY unknown key — calling it unconditionally would
// mislabel every custom tag as "in progress". isStage() must gate it.
ok(
  buildPhotoContext(
    ["https://cdn/a.jpg"],
    [{ url: "https://cdn/a.jpg", stage: "warranty-visit", caption: null, jobId: "job1" }],
  ).photos[0].tagLabel === "warranty-visit",
  "a custom, company-defined tag flows through as itself, not silently relabelled 'In progress'",
);

// Duplicate URLs (the same photo dragged onto the canvas twice) must not
// double-count toward which job wins or appear twice in the vendor request.
{
  const deduped = buildPhotoContext(
    ["https://cdn/a.jpg", "https://cdn/a.jpg"],
    [{ url: "https://cdn/a.jpg", stage: "finish", caption: null, jobId: "job1" }],
  );
  ok(deduped.images.length === 1, "a duplicated URL appears once in images, not twice");
}

console.log("\nHostile input to buildPhotoContext — must never throw\n");
ok(buildPhotoContext(null, []).images.length === 0, "null urls doesn't throw, returns empty");
ok(buildPhotoContext(["https://cdn/a.jpg"], undefined).images.length === 1, "undefined photoRows doesn't throw — the url is kept, untagged");
ok(
  buildPhotoContext([null, 5, undefined, "https://cdn/a.jpg"], [
    { url: "https://cdn/a.jpg", stage: "progress", caption: null, jobId: "job1" },
  ]).images.length === 1,
  "non-string entries in the url list are skipped, not thrown on",
);

console.log("\nscopeOfWorkFacts — a scope with no line items, and a job with no quote\n");
ok(scopeOfWorkFacts([{ label: "Cabinet Refinishing", lineItems: [], category: { name: "Cabinets" } }]).hasScope === false, "a group with no line items — hasScope: false");
ok(
  scopeOfWorkFacts([{ label: "X", lineItems: [{ amount: 500 }, { description: "" }], category: {} }]).hasScope === false,
  "line items present but every description is missing/blank — hasScope: false",
);
ok(scopeOfWorkFacts(null).hasScope === false, "a job with no quote behind it — loadJobPhotoContext hands this null straight through — hasScope: false, no throw");
ok(scopeOfWorkFacts(undefined).hasScope === false, "undefined scopeGroups — same");
{
  const real = scopeOfWorkFacts([
    {
      label: "Cabinet Refinishing",
      category: { name: "Cabinets" },
      lineItems: [
        { description: "37 doors, thermofoil", detail: "sanded and resprayed", amount: 4200, unitPrice: 113.5 },
        { description: "8 drawer fronts", amount: 900 },
      ],
    },
  ]);
  ok(real.hasScope === true, "a real scope with real line items — hasScope: true");
  ok(
    !JSON.stringify(real).includes("4200") && !JSON.stringify(real).includes("900") && !JSON.stringify(real).includes("113.5"),
    "every dollar figure on the line items (amount, unitPrice) is stripped — never reaches the facts sent to the model",
  );
}

console.log("\nparseModelJson — the guards that a schema cannot express, kept\n");

// parseModelJson now takes the OBJECT complete() validated against
// CAPTION_SCHEMA, not the raw reply string: the fence, the JSON.parse and the
// "did the two keys arrive" question moved into provider.js's schema mode and
// are executed there by scripts/check-ai-structured-output.mjs.
//
// Everything below is what STAYED, and every one of these is a limit the
// strict subset has no keyword for — maxLength, pattern and maxItems are all
// on its unsupported list. It is also still fed shapes the vendor promises
// are impossible, because the promise belongs to one vendor and this function
// decides what goes out under a contractor's own name.
ok(parseModelJson({ caption: "Fresh coat.", hashtags: ["#kitchen"] }).caption === "Fresh coat.", "a validated object passes straight through");
ok(parseModelJson("Sure! Here's a caption: Fresh cabinets.").caption === "", "a bare string — degrades to empty, never throws");
ok(parseModelJson("").caption === "" && parseModelJson(null).caption === "" && parseModelJson(undefined).caption === "", "empty/null/undefined input all degrade to empty");
ok(parseModelJson([1, 2, 3]).caption === "", "an array instead of an object degrades to empty");
ok(parseModelJson({ caption: 123, hashtags: [] }).caption === "", "a non-string caption is dropped, not coerced to \"123\"");
ok(parseModelJson({ caption: "ok", hashtags: "#kitchen" }).hashtags.length === 0, "hashtags sent as a bare string (not an array) — treated as none, not split into characters");
ok(
  JSON.stringify(parseModelJson({ caption: "ok", hashtags: ["kitchen remodel", "#Already-Tagged!"] }).hashtags) === '["#kitchenremodel","#AlreadyTagged"]',
  "hashtags missing '#' or carrying punctuation/spaces are normalised into one clean token",
);
ok(
  parseModelJson({ caption: "ok", hashtags: Array.from({ length: 500 }, (_, i) => `#tag${i}`) }).hashtags.length === 30,
  "500 hashtags from a runaway model reply are capped at Instagram's own 30-hashtag limit",
);
ok(
  parseModelJson({ caption: "ok", hashtags: ["#Kitchen", "#kitchen", "#KITCHEN"] }).hashtags.length === 1,
  "the same hashtag repeated in different cases is deduplicated",
);
ok(
  parseModelJson({ caption: "x".repeat(3000), hashtags: [] }).caption.length === 2200,
  "an over-length caption is capped at Instagram's 2200-character limit, not sent through uncapped",
);
{
  parseModelJson(JSON.parse('{"caption":"ok","hashtags":[],"__proto__":{"polluted":true}}'));
  ok({}.polluted === undefined, "a __proto__ key in the model's JSON reply does not pollute Object.prototype");
}

// ── A task title carries a client's name too ──────────────────────────────
//
// Job.title was correctly excluded from everything sent to the model, because
// lib/jobs/createJobFromQuote.js builds it as "{Type} — {ClientName}
// ({QuoteNumber})". The same name reaches the same place by a second door:
// lib/tasks/autoCreate.js creates a task titled "Schedule the job for
// {clientName}", and a photo requirement added to one of those would have
// handed the model exactly the name the first exclusion was protecting.
//
// Executed rather than grepped: a fixture whose taskTitle contains a name, run
// through the real builder, and the serialised context searched for it.
{
  const rows = [
    {
      url: "https://example.test/a.jpg",
      stage: "start",
      jobId: "j1",
      taskTitle: "Schedule the job for Sarah Mitchell",
      taskComment: "second coat done",
    },
  ];
  const blob = JSON.stringify(buildPhotoContext(rows.map((r) => r.url), rows));
  ok(
    !/Sarah Mitchell/.test(blob),
    "a task title never reaches the model — it carries the client's name, same as Job.title",
  );
  ok(
    /second coat done/.test(blob),
    "...while the completion comment, which describes the WORK, still does",
  );
}

// ═════════════════════════════════════════════════════════════════════════
section("16. The designs index — the answer the server already sent");
// ═════════════════════════════════════════════════════════════════════════
//
// /api/marketing/designer/designs selects every saved layout's `ratioKey`, so
// the list page knows exactly WHICH of the five formats are done. It printed
// "3/5" and nothing else, which makes "which two are missing?" a question you
// answer by opening the design — the same failure as the jobs list reducing a
// pre-sorted `visits` array to its length. The fraction stays (it is the fast
// read); the chips are what the payload was already paying for.
{
  const listRoute = stripComments(read("app/api/marketing/designer/designs/route.js"));
  ok(
    /layouts:\s*\{\s*select:\s*\{[^}]*ratioKey: true/.test(listRoute),
    "the list route still sends each design's saved ratioKeys",
  );

  const indexPage = stripComments(read("app/app/marketing/designer/page.js"));
  ok(
    /new Set\(\s*\(d\.layouts \|\| \[\]\)\.map\(\(l\) => l\.ratioKey\)/.test(indexPage),
    "…and the page reads the keys rather than only counting them",
  );
  ok(
    /AD_RATIOS\.map\(\(r\) => \(/.test(indexPage) && /\{r\.label\}/.test(indexPage),
    "…rendering one chip per format, named",
  );
  ok(
    /saved\.has\(r\.key\)/.test(indexPage),
    "…with done and missing told apart by the key, not by position",
  );
  // A chip that looks identical whether or not the format is saved is a
  // control that appears to inform and doesn't.
  ok(
    /saved\.has\(r\.key\)\s*\?\s*"bg-muted text-foreground"\s*:\s*"text-muted-foreground"/.test(
      indexPage,
    ),
    "…and the two states are visually different, using the same pairing the editor's own ratio switcher uses",
  );
  ok(
    /aria-label=\{`\$\{t\("app\.action\.delete"\)\} — \$\{d\.name\}`\}/.test(indexPage),
    "the delete control's label is translated and names the design it deletes",
  );
  ok(
    !/aria-label="Delete design"/.test(indexPage),
    "…and the hardcoded English one is gone",
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
