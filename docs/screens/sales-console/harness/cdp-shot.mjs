// Screenshot through the DevTools protocol, with real device emulation —
// headless Chrome's window cannot go below ~500px wide, so a phone frame
// needs Emulation.setDeviceMetricsOverride.
//   node --experimental-websocket cdp-shot.mjs <out.png> <width> <height> <scale> <url> [mobile]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [out, width, height, scale, url, mobile] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1400,1000", "--user-data-dir=/tmp/cdp-profile-" + port, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === "page");
  } catch {}
}
if (!target) { chrome.kill(); throw new Error("chrome did not start"); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Number(height), deviceScaleFactor: Number(scale), mobile: mobile === "mobile" });
if (mobile === "mobile") await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Page.navigate", { url });
await sleep(800);
for (let i = 0; i < 40; i++) {
  const r = await send("Runtime.evaluate", { expression: "document.documentElement.getAttribute('data-harness-done') || (new URLSearchParams(location.search).get('do') ? '' : '1')", returnByValue: true });
  if (r.result?.result?.value === "1") break;
  await sleep(200);
}
await sleep(400);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log("wrote", out);
ws.close();
chrome.kill();
