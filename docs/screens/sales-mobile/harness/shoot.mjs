// Walks every /sales screen at 375×812 and 768×1024 through one headless
// Chrome, writes a full-page frame per screen per size, runs the platform
// audit (docs/screens/platform-mobile/harness/audit.js — one audit for both
// consoles) on each and writes one JSON report.
//
// The screens come from two harnesses: docs/screens/sales-portal/harness
// (every page but the queue, inside the shipped SalesShell) and
// docs/screens/sales-console/harness (the queue, with its dialler, incoming
// call drawer and tabbed card — the Leads tab is the phone's list). Build
// both first:
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
// The navigate scenes press, wait for pages to settle and navigate twice;
// they need longer than a static frame.
const OPEN_TIMEOUT_MS = Number(process.env.OPEN_TIMEOUT_MS) || 45000;

// HLANG=fr|es renders every frame in that catalogue (both harnesses read
// ?lang=); the default is English. Named HLANG because LANG is the shell's.
const langQ = process.env.HLANG ? `&lang=${process.env.HLANG}` : "";
const portal = (page, extra = "") => `file://${PORTAL}/portal.html?page=${page}${extra}${langQ}`;
const queue = (extra = "") => `file://${CONSOLE}/console.html?do=1${extra}${langQ}`;
/** Every screen a rep can reach, and the states a phone has to hold. */
export const FRAMES = {
  today: portal("today"),
  "today-drawer": portal("today", "&scene=drawer"),
  "today-status-menu": portal("today", "&scene=status-menu"),
  "today-incoming-call": portal("today", "&scene=incoming-call"),
  "today-incoming-call-held": portal("today", "&scene=incoming-call-held"),
  "today-incoming-call-unknown": portal("today", "&scene=incoming-call-unknown"),
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
  "queue-tab-leads": queue("&scene=tab-leads"),
  "queue-maximized": queue("&scene=maximized"),
  "queue-tab-contact": queue("&scene=tab-contact"),
  "queue-tab-disposition": queue("&scene=tab-disposition"),
  "queue-typed": queue("&scene=typed"),
  // 2026-09-17: a test line typed on a lead's card, the owner's test
  // account, the Tasks tab's Call now, and the agency's own screens.
  "queue-typed-test": queue("&scene=typed-test"),
  "queue-test-account": queue("&scene=typed&testAccount=1"),
  "queue-tab-tasks": queue("&scene=tab-tasks"),
  "queue-tab-script": queue("&scene=tab-script"),
  // 2026-09-18: "Text them" beside the Call button, and the ring dialog's
  // "They'd rather text"; the Texts screen's first-message picker on a
  // fresh thread, opened blank from a Text them press.
  "queue-text-them": queue("&scene=text-them"),
  "messages-new": portal("messages", "&scene=typed-open"),
  "messages-compose-own": portal("messages", "&thread=%2B15145550148&compose=own"),
  // 2026-09-18: the call survives navigation. Placed on the queue (now in
  // the portal harness, so the shell stays mounted while the page under
  // it changes), then followed to each page the owner named — through
  // Text them and Email them on the live call for the first two, through
  // the router for the rest — with the strip's Hang up, Mute, Transfer,
  // Text them, Email and "Back to the call screen" asserted on every one,
  // and the hang-up itself, from the strip, on the Texts page. The scene
  // FAILS the frame if the stubbed Call is ever disconnected.
  "queue-call-navigate": portal("queue", "&scene=call-navigate:text-them&hangup=1"),
  "queue-call-navigate-email": portal("queue", "&scene=call-navigate:email"),
  "queue-call-navigate-threads": portal("queue", "&scene=call-navigate:threads"),
  "queue-call-navigate-calendar": portal("queue", "&scene=call-navigate:calendar"),
  "queue-call-navigate-leads": portal("queue", "&scene=call-navigate:leads"),
  "queue-call-navigate-lead": portal("queue", "&scene=call-navigate:lead"),
  "queue-call-navigate-notes": portal("queue", "&scene=call-navigate:notes"),
  "queue-call-navigate-pay": portal("queue", "&scene=call-navigate:pay"),
  "queue-call-navigate-team": portal("queue", "&scene=call-navigate:team"),
  "queue-call-navigate-settings": portal("queue", "&scene=call-navigate:settings"),
  "queue-call-navigate-today": portal("queue", "&scene=call-navigate:today"),
  "queue-call-navigate-back": portal("queue", "&scene=call-navigate:back"),
  agency: portal("agency", "&agency=1"),
  "pay-agency": portal("pay", "&agency=1&scroll=%5Bdata-by-employee%5D"),
  "today-reminder": portal("today", "&presence=offline"),
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
    const { sceneError } = await chrome.open(FRAMES[name], { timeoutMs: OPEN_TIMEOUT_MS });
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
