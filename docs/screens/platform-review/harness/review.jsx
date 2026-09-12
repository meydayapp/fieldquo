import React from "react";
import { createRoot } from "react-dom/client";
import PlatformSalesReviewPage from "@/app/platform/sales/review/page";
import PlatformSidebar from "@/app/components/platform/PlatformSidebar";

// The rail's badge fetch, answered like the count route would.
const realFetch = window.fetch;
window.fetch = async (url, init) => {
  if (String(url).startsWith("/api/platform/sales/review/count")) {
    return new Response(JSON.stringify({ count: 255842 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(url, init);
};

const params = new URLSearchParams(window.location.search);
const mobile = params.get("mobile") === "1";
createRoot(document.getElementById("root")).render(
  <div className="flex min-h-screen bg-muted">
    {mobile ? null : <PlatformSidebar />}
    <main className="flex-1 min-w-0 p-6 sm:p-8">
      <PlatformSalesReviewPage />
    </main>
  </div>,
);

// ── Scene driver ─────────────────────────────────────────────────────────
// ?scene=folder|picked|bulk|confirm|shopwords — drives the real controls.
const scene = params.get("scene");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
const key = (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
(async () => {
  try {
    await until("[data-review-rows] [data-review-row]");
    await wait(200);
    if (scene === "picked") {
      key("j"); await wait(50);
      key("2"); await wait(200);
    }
    if (scene === "decided") {
      key("1"); await wait(50);
      key("Enter"); await wait(400);
    }
    if (scene === "bulk" || scene === "confirm") {
      const input = await until('input[aria-label="Search"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "toiture");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await wait(400);
      (await until("[data-bulk-open]")).click();
      const select = await until("[data-bulk-trade]");
      const setSel = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
      setSel.call(select, "roofing");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(200);
      if (scene === "confirm") {
        (await until("[data-bulk-assign]")).click();
        await until("[data-bulk-confirm]");
        await wait(200);
      }
    }
    if (scene === "shopwords") {
      const box = await until('input[type="checkbox"]');
      box.click();
      await wait(400);
      (await until("[data-bulk-open]")).click();
      await until("[data-bulk-reject]");
      await wait(200);
    }
    if (scene === "maintenance") {
      const btn = [...document.querySelectorAll("[data-maintenance] button")][0];
      btn.click();
      (await until("[data-reclassify-dry]")).click();
      await until("[data-maintenance] pre");
      await wait(200);
      document.querySelector("[data-maintenance]").scrollIntoView({ block: "end" });
      await wait(200);
    }
    document.documentElement.setAttribute("data-harness-done", "1");
  } catch (err) {
    document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
    document.documentElement.setAttribute("data-harness-done", "1");
  }
})();
