// docs/screens/app-guide/harness/shoot.mjs
//
//   node docs/screens/app-guide/harness/shoot.mjs            # every screen, en fr es
//   node docs/screens/app-guide/harness/shoot.mjs fr quotes  # one language, one slug
//   ONLY=quotes,jobs LANGS=en node .../shoot.mjs
//
// Drives one headless Chrome through the DevTools protocol over every row of
// screens.js in every language, and writes docs/screens/app-guide/<lang>/
// NN-<slug>.png at 1280 wide. One Chrome, one tab, navigated in a loop —
// spawning a browser per frame is what made earlier captures take an hour.
//
// A frame is written only when the harness signalled data-harness-done and
// raised no data-scene-error; a page that asked the fixture API for a route
// it does not have is reported (window.__unanswered), because that is the
// difference between "the list is empty in the fixture" and "the list is
// empty because the request 404ed", and only the first is a real render.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCREENS } from "./screens.js";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../../..");
const OUT = process.env.OUT || "/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/app-guide";
const CHROME =
  process.env.CHROME_BIN ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const args = process.argv.slice(2);
const LANGS = (process.env.LANGS || args.filter((a) => ["en", "fr", "es"].includes(a)).join(",") || "en,fr,es").split(",");
const only = (process.env.ONLY || args.filter((a) => !["en", "fr", "es"].includes(a)).join(",")).split(",").filter(Boolean);
const WIDTH = 1280;
const HEIGHT = Number(process.env.HEIGHT || 860);

const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", `--window-size=${WIDTH},${HEIGHT}`, "--user-data-dir=/tmp/cdp-profile-" + port, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) { chrome.kill(); throw new Error("chrome did not start"); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
let exceptions = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  // An exception thrown before the harness's own error listener is mounted
  // (a module that fails at import time) would otherwise leave a blank
  // frame with nothing to explain it.
  if (m.method === "Runtime.exceptionThrown") exceptions.push(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || "exception");
};
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Emulation.setTimezoneOverride", { timezoneId: "America/Toronto" });

const report = [];
let n = 0;
for (const screen of SCREENS) {
  n++;
  if (only.length && !only.includes(screen.slug)) continue;
  for (const lang of LANGS) {
    const dir = join(ROOT, "docs/screens/app-guide", lang);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${String(n).padStart(2, "0")}-${screen.slug}.png`);
    const url = `file://${OUT}/guide.html?page=${screen.slug}&lang=${lang}`;
    const t0 = Date.now();
    exceptions = [];
    await send("Page.navigate", { url });
    await sleep(300);
    for (let i = 0; i < 100; i++) {
      if ((await evaluate("document.documentElement.getAttribute('data-harness-done')")) === "1") break;
      await sleep(150);
    }
    await sleep(250);
    const err = (await evaluate("document.documentElement.getAttribute('data-scene-error') || ''")) || exceptions[0]?.split("\n").slice(0, 4).join(" | ") || "";
    const unanswered = (await evaluate("JSON.stringify(window.__unanswered || [])")) || "[]";
    const rootText = (await evaluate("(document.getElementById('root')||{}).innerText || ''")) || "";
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } });
    writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    const calls = JSON.parse((await evaluate("JSON.stringify((window.__calls||[]).map(c=>c.method+' '+c.url))")) || "[]");
    const line = { slug: screen.slug, lang, file: file.replace(ROOT + "/", ""), error: err || null, unanswered: JSON.parse(unanswered), calls, chars: rootText.length, ms: Date.now() - t0 };
    report.push(line);
    console.log(`${line.file}${err ? "  ERROR " + err : ""}${line.unanswered.length ? "  unanswered: " + line.unanswered.join(" ") : ""}${rootText.length < 400 ? "  (thin: " + rootText.length + " chars)" : ""}  ${line.ms}ms`);
  }
}
writeFileSync(join(OUT, `report.${LANGS.join("-")}.json`), JSON.stringify(report, null, 2));
ws.close();
chrome.kill();
