#!/usr/bin/env node
//
// scripts/check-sales-textpane.mjs
//
//   npm run check:sales-textpane
//
// The conversation pane of /sales/messages is the dominant area of the
// frame, at every size — MEASURED in Chrome, because it is a property of a
// layout and no regex over a className proves one.
//
// ══ The owner's screenshot, 2026-09-19 ═══════════════════════════════════
//
// Rep Favor, 1600×860 at 125% (1280×680 CSS px), the Advance Appliance
// thread: the pane between the header and the composer was ~100px, so of
// the whole exchange she saw one line — "Reply STOP to unsubscribe." — and
// a scrollbar, and believed the reply was missing. The chrome around the
// pane had grown to ~250px of header, a three-line time-zone warning, a
// four-line composer and a three-line footnote, and none of it shrinks.
//
// ══ What is asserted ═════════════════════════════════════════════════════
//
// The REAL page (app/sales/messages/page.js), inside the REAL SalesShell,
// bundled by docs/screens/sales-portal/harness against fixture data, opened
// at 1600×860, 1280×680 and 375×812 on the thread as production held it
// (docs/screens/sales-messages/harness/fixtures.js `advance`: the office's
// verbatim inbound with its five blank lines, and one reply):
//
//   · the scroller ([data-chat-scroller]) is ≥ 45% of the thread column;
//   · on open, the last inbound AND the last outbound rows are wholly
//     inside the scroller's visible box — the history above is reachable
//     by scrolling, the exchange itself is not;
//   · the warning and the CASL footnote are one line each (≤ 30px);
//   · the header is two lines (≤ 90px).
//
// And the same thread once attached to its lead (`advanceAttached`): the
// header names the business and its town, the window tag says the clock
// was derived from the address, no warning, no Link control.
//
// Screenshots land in $SHOTS (default /tmp/fq-textpane) so a failure can
// be looked at. Needs Chrome (docs/screens/platform-mobile/harness/cdp.mjs
// finds it) and ~90s to bundle; it is not in check:all for that reason,
// and it is the check to run after touching the thread pane's chrome.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, findChrome } from "../docs/screens/platform-mobile/harness/cdp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS || "/tmp/fq-textpane";
const MIN_PANE_RATIO = 0.45;

let pass = 0;
const failures = [];
function ok(name, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail !== undefined ? `  — got: ${JSON.stringify(detail)}` : ""}`);
  }
}

if (!findChrome()) {
  console.error("No Chrome found — set CHROME_PATH. This check measures a layout and cannot run without a browser.");
  process.exit(1);
}

// ── Build the portal harness once ─────────────────────────────────────────
const OUT = process.env.PORTAL_OUT || mkdtempSync(join(tmpdir(), "fq-portal-"));
if (!existsSync(join(OUT, "portal.html")) || !process.env.PORTAL_OUT) {
  console.log(`building the portal harness into ${OUT} …`);
  execFileSync("sh", ["docs/screens/sales-portal/harness/build.sh"], { cwd: ROOT, env: { ...process.env, OUT }, stdio: "inherit" });
}
mkdirSync(SHOTS, { recursive: true });

const THREAD = "+19149357510";
const SIZES = [
  { name: "1600x860", width: 1600, height: 860, mobile: false },
  { name: "1280x680", width: 1280, height: 680, mobile: false },
  { name: "375x812", width: 375, height: 812, mobile: true },
];

const MEASURE = `(() => {
  const col = document.querySelector('[data-chat-pane="thread"]');
  const scroller = document.querySelector('[data-chat-scroller]');
  if (!col || !scroller) return { error: "no thread pane" };
  const c = col.getBoundingClientRect(), s = scroller.getBoundingClientRect();
  const rows = [...scroller.querySelectorAll('[data-chat-row="message"]')];
  const inb = rows.filter((r) => r.getAttribute("data-own") !== "true");
  const out = rows.filter((r) => r.getAttribute("data-own") === "true");
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top - s.top), bottom: Math.round(r.bottom - s.top), visible: r.top >= s.top - 1 && r.bottom <= s.bottom + 1 }; };
  const h = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : null; };
  const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
  return {
    column: Math.round(c.height), pane: Math.round(s.height), ratio: +(s.height / c.height).toFixed(3),
    header: h('[data-thread-header]'), composer: h('[data-chat-composer]'),
    warning: h('[data-composer-blocker]'), footnote: h('[data-casl-footnote]'),
    lastInbound: box(inb[inb.length - 1]), lastOutbound: box(out[out.length - 1]),
    name: text('[data-thread-header] h2'), place: text('[data-thread-place]'),
    windowTag: text('[data-tag="window"]'), zoneSource: document.querySelector('[data-tag="window"]')?.getAttribute('data-zone-source') || null,
    linkButton: Boolean(document.querySelector('[data-link-lead-button]')),
    scrollTop: Math.round(scroller.scrollTop), scrollHeight: scroller.scrollHeight,
  };
})()`;

const chrome = await launch();
const report = {};
try {
  for (const scenario of ["advance", "advanceAttached"]) {
    console.log(`\n${scenario}`);
    for (const size of SIZES) {
      await chrome.emulate({ width: size.width, height: size.height, scale: 1, mobile: size.mobile });
      const url = `file://${OUT}/portal.html?page=messages&scenario=${scenario}&thread=${encodeURIComponent(THREAD)}`;
      await chrome.open(url, { timeoutMs: 8000 });
      await new Promise((r) => setTimeout(r, 1200));
      const m = await chrome.eval(MEASURE);
      report[`${scenario}-${size.name}`] = m;
      const shot = join(SHOTS, `${scenario}-${size.name}.png`);
      writeFileSync(shot, await chrome.screenshot());
      const tag = `${scenario} @ ${size.name}`;
      ok(`${tag}: the thread pane rendered`, !m.error, m);
      if (m.error) continue;
      ok(`${tag}: the conversation is ≥ ${MIN_PANE_RATIO * 100}% of the column (${m.pane}/${m.column} = ${m.ratio})`, m.ratio >= MIN_PANE_RATIO, m);
      ok(`${tag}: on open, the last inbound is wholly visible`, m.lastInbound?.visible === true, m.lastInbound);
      ok(`${tag}: on open, the last outbound is wholly visible`, m.lastOutbound?.visible === true, m.lastOutbound);
      ok(`${tag}: the header is two lines at most`, m.header !== null && m.header <= 90, m.header);
      ok(`${tag}: the CASL footnote is one line`, m.footnote !== null && m.footnote <= 30, m.footnote);
      if (scenario === "advance") {
        ok(`${tag}: the time-zone warning is one line`, m.warning !== null && m.warning <= 30, m.warning);
        ok(`${tag}: a no-lead thread offers Link to a lead`, m.linkButton === true);
      } else {
        ok(`${tag}: the header names the business and its town`, m.name === "Advance Appliance" && m.place === "· Yonkers, NY", [m.name, m.place]);
        ok(`${tag}: the window is judged in the zone derived from the address, and says so`, m.zoneSource === "derived" && /until/i.test(m.windowTag || ""), [m.zoneSource, m.windowTag]);
        ok(`${tag}: no time-zone warning and no Link control on an attached thread`, m.warning === null && m.linkButton === false, [m.warning, m.linkButton]);
      }
      console.log(`       → ${shot}`);
    }
  }

  // ── The Link control opens the panel and lists what the rep holds ──────
  {
    await chrome.emulate({ width: 1280, height: 680, scale: 1, mobile: false });
    await chrome.open(`file://${OUT}/portal.html?page=messages&scenario=advance&thread=${encodeURIComponent(THREAD)}`, { timeoutMs: 8000 });
    await new Promise((r) => setTimeout(r, 1000));
    const opened = await chrome.eval(`(async () => {
      document.querySelector('[data-link-lead-button]').click();
      for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 100)); if (document.querySelectorAll('[data-link-lead-pick]').length) break; }
      const picks = [...document.querySelectorAll('[data-link-lead-pick]')];
      const scroller = document.querySelector('[data-chat-scroller]').getBoundingClientRect();
      const col = document.querySelector('[data-chat-pane="thread"]').getBoundingClientRect();
      return { panel: Boolean(document.querySelector('[data-link-lead]')), picks: picks.length, kinds: [...new Set(picks.map((p) => p.getAttribute('data-link-lead-pick')))], ratio: +(scroller.height / col.height).toFixed(3) };
    })()`);
    writeFileSync(join(SHOTS, "advance-link-panel-1280x680.png"), await chrome.screenshot());
    ok("Link to a lead opens a panel listing the rep's leads and prospects", opened.panel && opened.picks > 0 && opened.kinds.includes("lead") && opened.kinds.includes("prospect"), opened);
    ok("…over the thread, not out of it: the pane keeps its height", opened.ratio >= MIN_PANE_RATIO, opened.ratio);
  }
} finally {
  await chrome.close();
}
writeFileSync(join(SHOTS, "measurements.json"), JSON.stringify(report, null, 2));

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
