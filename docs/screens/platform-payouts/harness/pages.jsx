// Mounts one of the three real pages by ?page=payouts|reps|settings, then
// drives ?scene= by clicking the real controls, exactly as a hand would.
import React from "react";
import { createRoot } from "react-dom/client";
import PayoutsPage from "@/app/platform/sales/payouts/page";
import RepsPage from "@/app/platform/sales/reps/page";
import SettingsPage from "@/app/sales/settings/page";
const params = new URLSearchParams(window.location.search);
const page = params.get("page") || "payouts";
const Page = page === "reps" ? RepsPage : page === "settings" ? SettingsPage : PayoutsPage;
createRoot(document.getElementById("root")).render(
  <div className={page === "settings" ? "p-6 bg-muted text-foreground min-h-screen" : "bg-background text-foreground min-h-screen"}>
    <div className={page === "settings" ? "max-w-5xl mx-auto" : ""}><Page /></div>
  </div>,
);
const scene = params.get("scene");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 50) => {
  for (let i = 0; i < tries; i++) { const el = document.querySelector(sel); if (el) return el; await wait(100); }
  throw new Error(`scene: never found ${sel}`);
};
const setValue = (el, text) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
(async () => {
  if (!scene) return;
  if (scene === "payouts-form") {
    const form = await until('[data-mark-paid-form][data-batch-id="bana2"]');
    setValue(form.querySelector("[data-paid-via]"), "Wise");
    setValue(form.querySelector("[data-payment-reference]"), "WISE-5120");
    setValue(form.querySelector("[data-payment-note]"), "Sent 7 Sept, minus the Wise fee.");
  }
  if (scene === "payouts-paid") {
    const form = await until('[data-mark-paid-form][data-batch-id="bana2"]');
    setValue(form.querySelector("[data-payment-reference]"), "WISE-5120");
    setValue(form.querySelector("[data-paid-via]"), "Wise");
    await wait(100);
    form.querySelector("[data-mark-paid-submit]").click();
    await until("[data-payout-notice]");
    await until('[data-payout-batch="bana2"][data-batch-status="paid"]');
  }
  if (scene === "payouts-month") {
    (await until('[data-period-switch="month"]')).click();
    await until('[data-period-table][data-period="month"]');
  }
  if (scene === "reps-open") {
    // The hash is the state: arriving at #rep-repana opens Ana.
    await until('[data-rep-card="repana"][data-open="true"]');
    await until('[data-rep-payments="repana"] [data-payout-batch]');
  }
  await wait(400);
  document.documentElement.setAttribute("data-scene-ready", scene);
})().catch((err) => document.documentElement.setAttribute("data-scene-error", String(err?.message || err)));
