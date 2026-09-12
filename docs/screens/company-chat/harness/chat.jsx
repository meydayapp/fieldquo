import React from "react";
import { createRoot } from "react-dom/client";
import CompanyChat from "@/app/components/company/CompanyChat";
const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")).render(
  <div className="p-4 bg-background text-foreground min-h-screen">
    <CompanyChat heading={params.get("heading") || "Chat"} height="h-[calc(100vh-2rem)]" />
  </div>,
);

// ── Scene driver, for headless screenshots ────────────────────────────────
// ?scene=list|job|members|mention|new — clicks the real controls in order,
// with waits, exactly as a hand would. Nothing is rendered that a user
// could not reach.
const scene = params.get("scene");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
const click = async (sel) => (await until(sel)).click();
const type = async (sel, text) => {
  const el = await until(sel);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
(async () => {
  if (!scene) return;
  await until('[data-room-list]');
  await wait(300);
  if (scene === "list") {
    await click('[data-room-group="finished"] button');
  }
  if (scene === "job" || scene === "members" || scene === "mention") {
    await click('[data-room-id="j1"]');
    await until('[data-chat-scroller] [data-unread-divider]');
    await wait(300);
  }
  if (scene === "members") {
    await click('[data-members-button]');
    await until('[data-members-list]');
  }
  if (scene === "mention") {
    await type('[data-chat-composer] textarea', "Yes, 7:30 works — @s");
    await until('[data-mention-popup]');
  }
  if (scene === "new") {
    await click('[data-new-button]');
    await until('[data-people-picker] [data-person]');
  }
  await wait(400);
  document.documentElement.setAttribute("data-harness-done", "1");
})().catch((err) => {
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
  document.documentElement.setAttribute("data-harness-done", "1");
});
