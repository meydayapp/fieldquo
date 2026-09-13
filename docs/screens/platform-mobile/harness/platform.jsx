// The platform-console harness: every /platform page, the real component
// inside the real app/platform/layout.js (PlatformSidebar + <main>), fed by
// ./fixtures/ through stubs/platformFetch.js. One bundle, one HTML file;
// ?path= picks the route, ?scene= presses a control, ?scroll= a selector to
// bring to the top.
//
// Why the whole console and not the four screens the owner named: "the
// platform is not mobile friendly" is a claim about the surface, and the
// defects a phone shows — a rail that never collapses, a table wider than
// the viewport with no scroll container, a 28px icon button — are per page.
// scripts/check-platform-mobile.mjs walks this same map, so a page added to
// the console that is not added here fails that check by name.
//
// Nothing is drawn here that staff could not reach: every screen is the
// shipped component, and every scene is a click on a shipped control.
import React from "react";
import { createRoot } from "react-dom/client";
import "./stubs/platformFetch.js";
import PlatformLayout from "@/app/platform/layout";
import { PAGES } from "./pages.js";
import { SCENES } from "./fixtures/index.js";

const params = new URLSearchParams(window.location.search);
const path = params.get("path") || "/platform";
const entry = PAGES[path];
if (!entry) {
  document.documentElement.setAttribute("data-scene-error", `harness: no page for ${path}`);
  document.documentElement.setAttribute("data-harness-done", "1");
  throw new Error(`harness: no page for ${path}`);
}
window.__harnessPath = path;
window.__harnessParams = entry.params || {};

const element = entry.render();
// /platform/login is the one route the layout does not chrome (the sidebar
// early-returns there), so the page is rendered bare, as it ships.
createRoot(document.getElementById("root")).render(
  path === "/platform/login" ? element : <PlatformLayout>{element}</PlatformLayout>,
);

// ── Scene driver ─────────────────────────────────────────────────────────
const scene = params.get("scene") || "";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
const settled = async () => {
  // Every page shows a spinner while its fetches are out; wait for the last
  // one to go, then a beat for layout.
  for (let i = 0; i < 80; i++) {
    if (!document.querySelector(".animate-spin") && !document.querySelector("[aria-busy='true']")) break;
    await wait(100);
  }
  await wait(500);
};
(async () => {
  await until("#root > *");
  await settled();
  if (scene === "drawer") {
    // The phone rail: open it through the button the tour would press.
    (await until('[data-tour-open="platform-nav"]')).click();
    await until('[data-platform-drawer]');
    await wait(300);
  }
  if (scene && scene !== "drawer") {
    const fn = SCENES[path]?.[scene];
    if (!fn) throw new Error(`scene: ${path} has no scene "${scene}"`);
    await fn({ until, wait, settled });
    await wait(300);
  }
  const scrollTo = params.get("scroll");
  if (scrollTo) {
    (await until(scrollTo)).scrollIntoView({ block: "start" });
    window.scrollBy(0, -(Number(params.get("scrollPad")) || 72));
  }
  await wait(300);
  if (window.__harnessUnanswered?.length) throw new Error("unanswered: " + window.__harnessUnanswered.join(", "));
  document.documentElement.setAttribute("data-harness-done", "1");
})().catch((err) => {
  document.documentElement.setAttribute("data-harness-done", "1");
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
});
