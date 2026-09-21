// docs/screens/sales-performance/harness/pages.jsx
//
// The three REAL pages — /platform/sales/performance, /sales/agency/
// performance, /sales/agency/call-quality — rendered against a snapshot of
// what their routes returned for the real database (fixtures/*.json, written
// by dump.mjs). The components, the shared CallPerformanceSections and the
// i18n hook are the shipped ones; only next/* and the data layer are stubbed.
import React from "react";
import { createRoot } from "react-dom/client";
import PlatformPerformancePage from "@/app/platform/sales/performance/page";
import AgencyPerformancePage from "@/app/sales/agency/performance/page";
import AgencyCallQualityPage from "@/app/sales/agency/call-quality/page";
const params = new URLSearchParams(window.location.search);
const page = params.get("page") || "platform";
const Page = page === "agency" ? AgencyPerformancePage : page === "quality" ? AgencyCallQualityPage : PlatformPerformancePage;
createRoot(document.getElementById("root")).render(
  <div className="bg-background text-foreground min-h-screen p-6">
    <div className="max-w-6xl mx-auto"><Page /></div>
  </div>,
);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  // Ready when the calls table (or the quality queue) has drawn.
  for (let i = 0; i < 100; i++) {
    if (document.querySelector("[data-performance-calls] tbody tr, [data-call-quality-review] tbody tr, [data-call-quality-review] li, [data-agency-performance] table")) break;
    await wait(100);
  }
  await wait(400);
  document.documentElement.setAttribute("data-scene-ready", "1");
})();
