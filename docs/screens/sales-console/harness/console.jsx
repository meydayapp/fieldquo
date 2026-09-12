import React from "react";
import { createRoot } from "react-dom/client";
import SalesShell from "@/app/sales/SalesShell";
import SalesQueuePage from "@/app/sales/queue/page";

const params = new URLSearchParams(window.location.search);
window.__harnessPath = "/sales/queue";
createRoot(document.getElementById("root")).render(
  <SalesShell>
    <SalesQueuePage />
  </SalesShell>,
);

// ── Scene driver ─────────────────────────────────────────────────────────
// ?scene=idle|call|tab-<key>|rail-collapsed|ring|mobile-drawer — clicks the
// real controls in order. Nothing rendered here that a rep could not reach.
const scene = params.get("scene") || "";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
const click = async (sel) => (await until(sel)).click();
(async () => {
  await until('[data-sales-console]');
  await until('[data-console-card="company"] [data-company-description]');
  await until('[data-slot="script"] [data-testid="ai-call-script"]');
  await wait(300);
  if (scene === "call") {
    const btn = [...document.querySelectorAll('[data-console-card="dialer"] button')].find((b) => /^\s*Call\b/.test(b.textContent));
    if (!btn) throw new Error("no Call button");
    btn.click();
    await until('[data-console-card="dialer"] .font-mono');
    await wait(2200);
  }
  const keyIn = async (digits) => {
    (await until('[data-dial-clear]')).click();
    await wait(100);
    for (const d of digits) { (await until(`[data-dial-key="${d}"]`)).click(); await wait(30); }
  };
  const pressCall = async () => {
    const btn = [...document.querySelectorAll('[data-console-card="dialer"] button')].find((b) => /^\s*Call\b/.test(b.textContent));
    if (!btn) throw new Error("no Call button");
    btn.click();
  };
  if (scene === "typed") {
    await keyIn("4055550142");
    await wait(300);
  }
  if (scene === "dial-button") {
    (await until('[data-console-card="contact"] [data-dial-number-button="+14055550177"]')).click();
    await until('[data-console-card="dialer"] .font-mono');
    await wait(1500);
  }
  if (scene === "typed-refused") {
    await keyIn("4055550666");
    await pressCall();
    await until('[data-dial-error]');
    await wait(300);
  }
  if (scene === "typed-call") {
    await keyIn("4055550142");
    await pressCall();
    await until('[data-console-card="dialer"] .font-mono');
    (await until('[data-dial-key="1"]')).click();
    await wait(1500);
  }
  if (scene.startsWith("tab-")) {
    await click(`[data-console-tab="${scene.slice(4)}"]`);
    await wait(200);
  }
  if (scene === "rail-expanded" || scene === "rail-collapsed") {
    await click('[data-queue-rail-toggle]');
    await wait(400);
  }
  if (scene === "ring") {
    window.__ring("+19185550123");
    await until('[data-incoming-drawer="open"]');
    await wait(500);
  }
  if (scene === "ring-closed") {
    window.__ring("+19185550123");
    await until('[data-incoming-drawer="open"]');
    await wait(300);
    const decline = [...document.querySelectorAll('[data-incoming-drawer] button')].find((b) => /Decline/.test(b.textContent));
    decline.click();
    await wait(600);
    if (document.querySelector('[data-incoming-drawer]')) throw new Error("drawer still mounted after decline");
  }
  if (scene === "ring-answered") {
    window.__ring("+19185550123");
    await until('[data-incoming-drawer="open"]');
    await wait(300);
    const pick = [...document.querySelectorAll('[data-incoming-drawer] button')].find((b) => /Pick up/.test(b.textContent));
    pick.click();
    await until('[data-live-call-slot] [data-inbound-live]');
    await wait(1600);
  }
  if (scene === "mobile-drawer") {
    await click('[data-queue-drawer-open]');
    await until('[data-queue-drawer]');
    await wait(300);
  }
  if (scene === "maximized") {
    await click('[data-console-maximize]');
    await wait(300);
  }
  if (scene === "status-menu") {
    await click('[data-tour="sales-status"] button');
    await wait(200);
  }
  const scrollTo = params.get("scroll");
  if (scrollTo) {
    (await until(scrollTo)).scrollIntoView({ block: "start" });
    window.scrollBy(0, -76);
  }
  await wait(300);
  document.documentElement.setAttribute("data-harness-done", "1");
})().catch((err) => {
  document.documentElement.setAttribute("data-harness-done", "1");
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
});
