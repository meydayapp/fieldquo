// docs/screens/public/product/shoot-live.mjs
//
//   node docs/screens/public/product/shoot-live.mjs
//
// Full-page captures of the five rebuilt marketing pages on the LIVE site —
// /product/quoting, /scheduling, /team, /analytics and /features/payments —
// at 1280 and at 375 (emulated as a phone), written beside this file as
// <page>-<width>.png. One headless Chrome, one tab, navigated in a loop, the
// same DevTools-protocol pattern docs/screens/app-guide/harness/shoot.mjs
// uses. No login: these are public pages, which is the point of the proof.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.ORIGIN || "https://www.fieldquo.com";
const PAGES = ["product/quoting", "product/scheduling", "product/team", "product/analytics", "features/payments"];
const WIDTHS = [1280, 375];
const CHROME =
  process.env.CHROME_BIN ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

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
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result || msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

for (const width of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  for (const page of PAGES) {
    await send("Page.navigate", { url: `${ORIGIN}/${page}` });
    await sleep(4000);
    // Scroll to the bottom and back so every lazy image has loaded, then
    // wait for the ones in flight.
    await evaluate(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))); })()`);
    await sleep(800);
    const height = await evaluate("document.documentElement.scrollHeight");
    const sideways = await evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
    const file = join(here, `${page.replace("/", "-")}-${width}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`${file} ${width}x${height}${sideways ? "  SIDEWAYS SCROLL" : ""}`);
  }
}
ws.close();
chrome.kill();
