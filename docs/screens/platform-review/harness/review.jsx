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
    if (scene === "bar" || scene === "bulk" || scene === "confirm" || scene === "dups") {
      const input = await until('input[aria-label="Search"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "toiture");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await wait(400);
      await until("[data-bulk-bar]");
      if (scene === "dups") {
        // Show the flagged duplicates: the toggle off, the chip on the row,
        // its checkbox off and disabled, the bar counting it out.
        (await until("[data-hide-dups]")).click();
        await wait(400);
        const chip = await until("[data-duplicate-chip]");
        chip.closest("[data-review-row]").scrollIntoView({ block: "center" });
        await wait(200);
      }
      if (scene === "bar") {
        // Untick the third row by its checkbox, and stay at the top so the
        // frame shows where the bar sits: above the list, under the filters.
        const third = document.querySelectorAll("[data-bulk-tick]")[2];
        third.click();
        await wait(200);
        window.scrollTo(0, 0);
        await wait(100);
      }
      if (scene === "bulk" || scene === "confirm") {
        // The bar is on screen with the button reading "Pick the trade to
        // assign" and disabled; Shift+A puts the cursor in the select.
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "A", shiftKey: true, bubbles: true }));
        await wait(50);
        key("j"); key("j"); await wait(50);
        key(" "); await wait(100);
        const select = await until("[data-bulk-trade]");
        const setSel = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        setSel.call(select, "roofing");
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await wait(200);
      }
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
      await until("[data-bulk-bar]");
      await until("[data-bulk-reject]");
      await wait(200);
    }
    if (scene === "pagesize") {
      // 200 rows a page, and how long the real page takes to draw them.
      const t0 = performance.now();
      const select = await until("[data-page-size]");
      const setSel = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
      setSel.call(select, "200");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 100; i++) {
        if (document.querySelectorAll("[data-review-rows] [data-review-row]").length >= 200) break;
        await wait(50);
      }
      const drawn = document.querySelectorAll("[data-review-rows] [data-review-row]").length;
      document.documentElement.setAttribute("data-pagesize-ms", String(Math.round(performance.now() - t0)));
      document.documentElement.setAttribute("data-pagesize-rows", String(drawn));
      document.querySelector("[data-review-pager]")?.scrollIntoView({ block: "end" });
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
