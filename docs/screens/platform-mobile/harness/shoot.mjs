// Walks every /platform route in pages.js at 375×812 and 768×1024 through one
// headless Chrome, writes a full-page frame per route per size, runs audit.js
// on each and writes one JSON report.
//
//   OUT=/tmp/fq-platform-harness sh docs/screens/platform-mobile/harness/build.sh
//   node docs/screens/platform-mobile/harness/shoot.mjs before    # → docs/screens/platform-mobile/before/
//   node docs/screens/platform-mobile/harness/shoot.mjs after     # → docs/screens/platform-mobile/after/
//
// Options: ROUTES=/platform,/platform/growth (comma list) to shoot a subset;
// SIZES=375 to shoot one size; DEST=/some/dir to write elsewhere; SCENE=name
// to press that scene on every route that has it (see fixtures/*.js).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const OUT = process.env.OUT || "/tmp/fq-platform-harness";
const label = process.argv[2] || "after";
const DEST = process.env.DEST || path.join(ROOT, "docs/screens/platform-mobile", label);
mkdirSync(DEST, { recursive: true });

const SIZES = (process.env.SIZES || "375,768").split(",").map(Number);
const DIMS = { 375: { width: 375, height: 812, mobile: true }, 768: { width: 768, height: 1024, mobile: true }, 1280: { width: 1280, height: 900, mobile: false } };

// The route list comes from pages.js, read as text so this script needs no
// bundler: every key of the PAGES map, in order.
const pagesSource = readFileSync(path.join(HERE, "pages.js"), "utf8");
const ids = Object.fromEntries([...readFileSync(path.join(HERE, "fixtures/ids.js"), "utf8").matchAll(/export const (\w+) = "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const allRoutes = [...pagesSource.matchAll(/^\s+(?:"([^"]+)"|\[`([^`]+)`\]): \{ render/gm)].map((m) => (m[1] || m[2]).replace(/\$\{(\w+)\}/g, (_, k) => ids[k]));
const routes = process.env.ROUTES ? process.env.ROUTES.split(",") : allRoutes;
const slug = (route) => route.replace(/^\/platform\/?/, "").replace(/\//g, "__") || "dashboard";

const auditSource = readFileSync(path.join(HERE, "audit.js"), "utf8").replace(/^export /m, "");

// The report keeps counts and the first offenders, not every small target
// on a sixty-row page — the frame beside it is the rest of the evidence.
const compact = (a) => ({
  ...a,
  overflow: a.overflow.slice(0, 10), clipped: a.clipped.slice(0, 5),
  tapCount: a.tap.length, tap: a.tap.slice(0, 12), tapPrimary: a.tapPrimary.slice(0, 12),
  truncatedCount: a.truncated.length, truncated: a.truncated.slice(0, 6),
  smallInputCount: a.smallInputs.length, smallInputs: a.smallInputs.slice(0, 4),
  scrollers: a.scrollers.slice(0, 6),
});

const chrome = await launch();
const report = {};
for (const route of routes) {
  for (const size of SIZES) {
    const dims = DIMS[size];
    await chrome.emulate({ width: dims.width, height: dims.height, scale: 1, mobile: dims.mobile });
    const scene = process.env.SCENE ? `&scene=${encodeURIComponent(process.env.SCENE)}` : "";
    const url = `file://${OUT}/platform.html?path=${encodeURIComponent(route)}${scene}`;
    const { sceneError } = await chrome.open(url);
    const audit = await chrome.eval(`(${auditSource})(${dims.width})`);
    audit.consoleErrors = chrome.consoleErrors.slice(0, 5);
    if (sceneError) audit.sceneError = sceneError;
    // Full page, capped: 1600px on the phone (four screens), the viewport on
    // the tablet — enough to see a table below the fold without the folder
    // weighing sixty megabytes.
    const png = await chrome.screenshot({ fullPage: true, maxHeight: size === 375 ? 1600 : dims.height });
    const file = `${slug(route)}${process.env.SCENE ? "-" + process.env.SCENE : ""}-${size}.png`;
    writeFileSync(path.join(DEST, file), png);
    report[`${route} @${size}`] = { file, ...compact(audit) };
    const flags = [
      audit.scrollsSideways ? `SIDEWAYS docW=${audit.docW}` : "",
      audit.overflow.length ? `overflow=${audit.overflow.length}` : "",
      audit.tables.filter((t) => !t.inScroller).length ? `tables-no-scroller=${audit.tables.filter((t) => !t.inScroller).length}` : "",
      audit.tapPrimary.length ? `small-primary=${audit.tapPrimary.length}` : "",
      audit.unanswered.length ? `UNANSWERED=${audit.unanswered.join(" ")}` : "",
      audit.sceneError ? `ERR=${audit.sceneError}` : "",
    ].filter(Boolean);
    console.log(`${route} @${size}  ${flags.join("  ") || "ok"}`);
  }
}
await chrome.close();
writeFileSync(path.join(DEST, "audit.json"), JSON.stringify(report, null, 1));
console.log("wrote", path.join(DEST, "audit.json"));
