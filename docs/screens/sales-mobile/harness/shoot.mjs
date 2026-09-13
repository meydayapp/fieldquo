// Walks every /sales screen at 375×812 and 768×1024 through one headless
// Chrome, writes a full-page frame per screen per size, runs the platform
// audit (docs/screens/platform-mobile/harness/audit.js — one audit for both
// consoles) on each and writes one JSON report.
//
// The screens come from two harnesses: docs/screens/sales-portal/harness
// (every page but the queue, inside the shipped SalesShell) and
// docs/screens/sales-console/harness (the queue, with its dialler, incoming
// call drawer and lead panel). Build both first:
//
//   OUT=/tmp/fq-portal-harness sh docs/screens/sales-portal/harness/build.sh
//   OUT=/tmp/fq-console-harness sh docs/screens/sales-console/harness/build.sh
//   node docs/screens/sales-mobile/harness/shoot.mjs before   # → docs/screens/sales-mobile/before/
//
// Options: FRAMES=today,queue (comma list of names) for a subset; SIZES=375.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../../platform-mobile/harness/cdp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const PORTAL = process.env.PORTAL_OUT || "/tmp/fq-portal-harness";
const CONSOLE = process.env.CONSOLE_OUT || "/tmp/fq-console-harness";
const label = process.argv[2] || "after";
const DEST = process.env.DEST || path.join(ROOT, "docs/screens/sales-mobile", label);
mkdirSync(DEST, { recursive: true });

const SIZES = (process.env.SIZES || "375,768").split(",").map(Number);
const DIMS = { 375: { width: 375, height: 812, mobile: true }, 768: { width: 768, height: 1024, mobile: true }, 1280: { width: 1280, height: 900, mobile: false } };

const portal = (page, extra = "") => `file://${PORTAL}/portal.html?page=${page}${extra}`;
const queue = (extra = "") => `file://${CONSOLE}/console.html?do=1${extra}`;
/** Every screen a rep can reach, and the states a phone has to hold. */
export const FRAMES = {
  today: portal("today"),
  "today-drawer": portal("today", "&scene=drawer"),
  "today-status-menu": portal("today", "&scene=status-menu"),
  leads: portal("leads"),
  lead: portal("lead"),
  companies: portal("companies"),
  calendar: portal("calendar"),
  notes: portal("notes"),
  note: portal("note"),
  playbook: portal("playbook"),
  support: portal("support"),
  "support-ticket": portal("support", "&scene=open-ticket"),
  pay: portal("pay"),
  voicemail: portal("voicemail"),
  demo: portal("demo"),
  messages: portal("messages"),
  team: portal("team"),
  threads: portal("threads"),
  thread: portal("thread"),
  settings: portal("settings"),
  welcome: portal("welcome"),
  login: portal("login"),
  invite: portal("invite"),
  queue: queue(),
  "queue-call": queue("&scene=call"),
  "queue-ring": queue("&scene=ring"),
  "queue-ring-answered": queue("&scene=ring-answered"),
  "queue-drawer": queue("&scene=mobile-drawer"),
  "queue-maximized": queue("&scene=maximized"),
  "queue-tab-contact": queue("&scene=tab-contact"),
  "queue-tab-disposition": queue("&scene=tab-disposition"),
  "queue-typed": queue("&scene=typed"),
};
const names = process.env.FRAMES ? process.env.FRAMES.split(",") : Object.keys(FRAMES);
const auditSource = readFileSync(path.join(ROOT, "docs/screens/platform-mobile/harness/audit.js"), "utf8").replace(/^export /m, "");

// Counts and first offenders, as the platform shooter writes them.
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
for (const name of names) {
  for (const size of SIZES) {
    const dims = DIMS[size];
    await chrome.emulate({ width: dims.width, height: dims.height, scale: 1, mobile: dims.mobile });
    const { sceneError } = await chrome.open(FRAMES[name]);
    const audit = await chrome.eval(`(${auditSource})(${dims.width})`);
    audit.consoleErrors = chrome.consoleErrors.slice(0, 5);
    if (sceneError) audit.sceneError = sceneError;
    const png = await chrome.screenshot({ fullPage: true, maxHeight: size === 375 ? 1600 : dims.height });
    const file = `${name}-${size}.png`;
    writeFileSync(path.join(DEST, file), png);
    report[`${name} @${size}`] = { file, url: FRAMES[name], ...compact(audit) };
    const flags = [
      audit.scrollsSideways ? `SIDEWAYS docW=${audit.docW}` : "",
      audit.overflow.length ? `overflow=${audit.overflow.length}` : "",
      audit.tables.filter((t) => !t.inScroller).length ? `tables-no-scroller=${audit.tables.filter((t) => !t.inScroller).length}` : "",
      audit.tapPrimary.length ? `small-primary=${audit.tapPrimary.length}` : "",
      audit.unanswered.length ? `UNANSWERED=${audit.unanswered.join(" ")}` : "",
      audit.sceneError ? `ERR=${audit.sceneError}` : "",
    ].filter(Boolean);
    console.log(`${name} @${size}  ${flags.join("  ") || "ok"}`);
  }
}
await chrome.close();
writeFileSync(path.join(DEST, "audit.json"), JSON.stringify(report, null, 1));
console.log("wrote", path.join(DEST, "audit.json"));
