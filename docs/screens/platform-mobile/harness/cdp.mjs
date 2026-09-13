// A small DevTools-protocol client: one headless Chrome, many pages. The
// per-shot cdp-shot.mjs the other harnesses carry spawns a browser per frame,
// which is fine for ten frames and not for the two hundred this audit walks.
//
//   const chrome = await launch();
//   await chrome.emulate({ width: 375, height: 812, scale: 1, mobile: true });
//   await chrome.open(url);            // waits for data-harness-done
//   const value = await chrome.eval("document.title");
//   const png = await chrome.screenshot({ fullPage: true });
//   await chrome.close();
//
// Needs `node --experimental-websocket` on Node < 22; Node 22 has WebSocket.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

export function findChrome() {
  return CANDIDATES.find((p) => existsSync(p)) || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ chromePath = findChrome() } = {}) {
  if (!chromePath) throw new Error("No Chrome found — set CHROME_PATH to a Chrome/Chromium binary.");
  const port = 9333 + Math.floor(Math.random() * 500);
  const proc = spawn(
    chromePath,
    [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1400,1000", "--user-data-dir=/tmp/cdp-profile-" + port, "about:blank"],
    { stdio: "ignore" },
  );
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === "page");
    } catch {}
  }
  if (!target) {
    proc.kill();
    throw new Error("chrome did not start");
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || "exception");
    } else if (m.method === "Runtime.consoleAPICalled" && m.params?.type === "error") {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");

  const chrome = {
    consoleErrors,
    async emulate({ width, height, scale = 1, mobile = false }) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
      await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    },
    async open(url, { doneAttr = "data-harness-done", timeoutMs = 20000 } = {}) {
      consoleErrors.length = 0;
      await send("Page.navigate", { url });
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        await sleep(150);
        const r = await send("Runtime.evaluate", { expression: `document.documentElement.getAttribute(${JSON.stringify(doneAttr)}) || ''`, returnByValue: true });
        if (r.result?.result?.value === "1") break;
      }
      const err = await chrome.eval("document.documentElement.getAttribute('data-scene-error') || ''");
      return { sceneError: err || null };
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
      return r.result?.result?.value;
    },
    async screenshot({ fullPage = false, maxHeight = 2400 } = {}) {
      let clip;
      if (fullPage) {
        const m = await chrome.eval("({ w: window.innerWidth, h: Math.min(document.documentElement.scrollHeight, " + maxHeight + ") })");
        clip = { x: 0, y: 0, width: m.w, height: m.h, scale: 1 };
      }
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage, ...(clip ? { clip } : {}) });
      return Buffer.from(shot.result.data, "base64");
    },
    async close() {
      ws.close();
      proc.kill();
    },
  };
  return chrome;
}
