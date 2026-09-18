// Walks the texting flow through the portal harness (docs/screens/sales-
// portal/harness — build it first) and records every sentence a rep meets,
// every disabled control and every request, into <label>/record.json
// beside a frame per scene per width. The owner's report was "the reps find
// it a bit hard to send a new text"; this is how the friction was measured
// before and after (../before, ../after — see ../README.md).
//
//   OUT=/tmp/fq-portal sh docs/screens/sales-portal/harness/build.sh
//   node --experimental-websocket docs/screens/sales-texting/harness/shoot.mjs after /tmp/fq-portal
//
// SIZES=375,1280,1600 and FRAMES=a-history,… narrow the run.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../../platform-mobile/harness/cdp.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || "after";
const PORTAL = process.argv[3] || "/tmp/fq-portal-harness";
const DEST = process.env.DEST || path.join(HERE, "..", label);
mkdirSync(DEST, { recursive: true });
const portal = (extra = "") => `file://${PORTAL}/portal.html?page=messages${extra}`;
const SCENES = {
  "a-history": portal("&thread=%2B14055550132"),
  "b-held-no-history": portal("&thread=%2B15145550148"),
  "c-new-message": portal("&scene=new-message"),
  "c-typed-open": portal("&scene=typed-open"),
  "d-thread-url-unknown": portal("&thread=%2B18192387263"),
  "e-thread-compose-own": portal("&thread=%2B15145550148&compose=own"),
  "f-thread-compose-discussed": portal("&thread=%2B15145550148&compose=discussed"),
  "g-thread-url-held-by-other": portal("&thread=%2B12125550199"),
  "h-link-no-signup-draft": portal("&thread=%2B18195550106"),
};
const names = process.env.FRAMES ? process.env.FRAMES.split(",") : Object.keys(SCENES);
const SIZES = (process.env.SIZES || "375,1280").split(",").map(Number);
const DIMS = { 375: { width: 375, height: 812, mobile: true }, 1280: { width: 1280, height: 900, mobile: false }, 1600: { width: 1600, height: 900, mobile: false } };
const chrome = await launch();
const out = {};
for (const name of names) for (const size of SIZES) {
  const d = DIMS[size];
  await chrome.emulate({ width: d.width, height: d.height, scale: 1, mobile: d.mobile });
  const { sceneError } = await chrome.open(SCENES[name]);
  const text = await chrome.eval(`(() => {
    const pick = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim()).filter(Boolean);
    return {
      alerts: pick('[role="alert"], [data-new-text-error], [data-first-contact], [data-composer-suppressed], [data-first-contact-refusal], [data-first-contact-picker], [data-thread-zone]'),
      hints: pick('[data-composer-hint], .text-amber-900, .text-amber-800'),
      buttons: pick('button, a[href]').slice(0, 80),
      disabled: [...document.querySelectorAll('button[disabled]')].map((b) => b.textContent.trim()).filter(Boolean),
      calls: (window.__harnessCalls || []).map((c) => c.method + ' ' + c.url),
    };
  })()`);
  const png = await chrome.screenshot({ fullPage: true, maxHeight: size === 375 ? 1800 : 900 });
  const file = `${name}-${size}.png`;
  writeFileSync(path.join(DEST, file), png);
  out[`${name} @${size}`] = { file, sceneError: sceneError || null, ...text, consoleErrors: chrome.consoleErrors.slice(0, 5) };
  console.log(name, size, sceneError ? "ERR " + sceneError : "ok");
}
await chrome.close();
writeFileSync(path.join(DEST, "record.json"), JSON.stringify(out, null, 1));
console.log("wrote", DEST);
