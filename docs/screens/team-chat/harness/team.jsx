import React from "react";
import { createRoot } from "react-dom/client";
import StaffChat from "@/app/components/staff/StaffChat";
const params = new URLSearchParams(window.location.search);
const heading = params.get("heading") || "Team";
createRoot(document.getElementById("root")).render(
  <div className="p-4 bg-background text-foreground min-h-screen">
    <StaffChat heading={heading} />
  </div>,
);

// ── Scene driver, for headless screenshots ────────────────────────────────
// ?scene=list|sales|members|group|mention — clicks the real controls in
// order, with waits, exactly as a hand would. Nothing is rendered that a
// user could not reach.
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
    await click('[data-room-group="joinable"] button');
  }
  if (scene === "sales" || scene === "members" || scene === "mention") {
    await click('[data-room-id="sales"]');
    await until('[data-chat-scroller] [data-unread-divider]');
    await wait(300);
  }
  if (scene === "members") {
    await click('[data-members-button]');
    await until('[data-members-list]');
  }
  if (scene === "mention") {
    await type('[data-chat-composer] textarea', "Sure — @j");
    await until('[data-mention-popup]');
  }
  if (scene === "group") {
    await click('[data-new-button]');
    await click('[data-new-menu] [role="menuitem"]:nth-child(2)');
    await until('[data-new-group-form] [data-people-picker] [data-person]');
    const name = await until('[data-new-group-form] input[required]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(name, "Sales West");
    name.dispatchEvent(new Event("input", { bubbles: true }));
    (await until('[data-person="rep:r2"]')).click();
    (await until('[data-person="user:a1"]')).click();
  }
  await wait(400);
  document.documentElement.setAttribute("data-scene-ready", scene);
})().catch((err) => {
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
});
