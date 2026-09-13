// docs/screens/hr/harness/shoot.mjs
//
// Photograph the four HR scenes at 1280 and 375, in one language (default
// en), from the bundle build.sh produced. Headless Chrome over CDP, the
// same way docs/screens/app-guide/harness/shoot.mjs does it; the page is
// served from $OUT and public/ through Fetch interception, nothing is on a
// network.
//
//   sh docs/screens/hr/harness/build.sh && node --experimental-websocket docs/screens/hr/harness/shoot.mjs [lang]
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../../..");
const OUT = process.env.OUT || "/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/hr-harness";
const CHROME = process.env.CHROME_BIN || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const lang = process.argv[2] || "en";
const SCENES = ["checklist", "documents", "policy", "compliance"];
const FRAMES = [[1280, 900], [375, 812]];

const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1280,900", "--user-data-dir=/tmp/cdp-profile-" + port, "about:blank"], { stdio: "ignore" });
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
const ORIGIN = "https://app.fieldquo.com";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json" };
const serve = (pathname) => {
  const local = ["/hr.html", "/hr.js", "/app.css"].includes(pathname) ? join(OUT, pathname) : join(ROOT, "public", pathname);
  if (!existsSync(local)) return null;
  return { body: readFileSync(local).toString("base64"), type: MIME[extname(pathname)] || "application/octet-stream" };
};
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Fetch.requestPaused") {
    const { requestId, request } = m.params;
    const found = serve(new URL(request.url).pathname);
    if (found) send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: found.type }], body: found.body });
    else send("Fetch.fulfillRequest", { requestId, responseCode: 404, responseHeaders: [{ name: "Content-Type", value: "text/plain" }], body: Buffer.from("harness: not in public/").toString("base64") });
    return;
  }
  if (m.method === "Runtime.exceptionThrown") exceptions.push(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || "exception");
};
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Fetch.enable", { patterns: [{ urlPattern: `${ORIGIN}/*`, requestStage: "Request" }] });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Emulation.setTimezoneOverride", { timezoneId: "America/Toronto" });

const dir = join(ROOT, "docs/screens/hr");
mkdirSync(dir, { recursive: true });
let failed = 0;
for (const scene of SCENES) {
  for (const [width, height] of FRAMES) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    exceptions = [];
    await send("Page.navigate", { url: `${ORIGIN}/hr.html?scene=${scene}&lang=${lang}` });
    await sleep(300);
    for (let i = 0; i < 100; i++) {
      if ((await evaluate("document.documentElement.getAttribute('data-harness-done')")) === "1") break;
      await sleep(150);
    }
    await sleep(250);
    const err = (await evaluate("document.documentElement.getAttribute('data-scene-error') || ''")) || exceptions[0]?.split("\n").slice(0, 3).join(" | ") || "";
    const chars = Number(await evaluate("((document.getElementById('root')||{}).innerText || '').length")) || 0;
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
    const file = join(dir, `${scene}${lang === "en" ? "" : "-" + lang}-${width}.png`);
    writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    if (err || chars < 200) failed++;
    console.log(`${file.replace(ROOT + "/", "")}${err ? "  ERROR " + err : ""}${chars < 200 ? "  (thin: " + chars + " chars)" : ""}`);
  }
}
ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
