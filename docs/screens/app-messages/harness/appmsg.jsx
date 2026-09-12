// The /app/messages harness: the REAL page, with window.fetch answered from
// fixtures. ?scenario=default|blocked|awaiting|demo, ?readonly=1 for a
// view-only member, ?scene= drives the controls for a screenshot.
import React from "react";
import { createRoot } from "react-dom/client";
import MessagesPage from "@/app/app/messages/page";
import { FIXTURES, PEOPLE } from "./fixtures.js";

const params = new URLSearchParams(window.location.search);
const fx = FIXTURES[params.get("scenario") || "default"] || FIXTURES.default;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

window.__calls = [];
window.fetch = async (url, options = {}) => {
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(String(url), "http://harness.local");
  window.__calls.push({ url: u.pathname + u.search, method, body: options.body || null });
  await delay(40);
  if (u.pathname === "/api/messaging/threads" && method === "GET") {
    const q = (u.searchParams.get("q") || "").toLowerCase();
    const platform = u.searchParams.get("platform");
    let threads = fx.list();
    if (q) threads = threads.filter((t) => (t.participantName || "").toLowerCase().includes(q) || (t.preview || "").toLowerCase().includes(q));
    if (platform) threads = threads.filter((t) => t.platform === platform);
    return json({ connection: fx.connection, note: fx.note, threads, pageImport: fx.pageImport || { available: false, reason: fx.connection.mock ? "demo" : "not_connected", granted: { facebook: false, instagram: false }, platforms: [], importedAt: null } });
  }
  if (u.pathname === "/api/messaging/import" && method === "POST") {
    // The Conversations API pull: twelve threads seen, three of them new.
    if (params.get("import") === "limited") return json({ kind: "rate_limited", error: "Conversations were refreshed a moment ago. Try again in a few minutes.", retryAfterSeconds: 420 }, 429);
    await delay(600);
    return json({ kind: "ok", conversations: 12, messages: 41, created: 3, skipped: 0, errors: 0, platforms: { facebook: { conversations: 9, messages: 30, skipped: 0, errors: 0 }, instagram: { conversations: 3, messages: 11, skipped: 0, errors: 0 } }, lastError: null });
  }
  const m = /^\/api\/messaging\/threads\/([^/]+)(\/[a-z]+)?$/.exec(u.pathname);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const sub = m[2] || "";
    if (!sub && method === "GET") {
      const thread = fx.thread(id);
      return thread ? json({ connection: fx.connection, thread }) : json({ error: "Not found" }, 404);
    }
    if (!sub && method === "PATCH") {
      if (fx.connection.mock) return json({ error: "This is a sample conversation, so changes to it aren't saved." }, 409);
      const body = JSON.parse(options.body || "{}");
      const thread = fx.thread(id);
      if (!thread) return json({ error: "Not found" }, 404);
      if ("outcome" in body) {
        thread.outcome = body.outcome;
        thread.messages.push({ id: "act" + Date.now(), direction: "activity", body: "", attachments: null, sentAt: new Date(), activity: body.outcome ? { type: "outcome_set", outcome: body.outcome, by: "Dave Morin" } : { type: "outcome_cleared", by: "Dave Morin" } });
      }
      if ("status" in body) {
        thread.status = body.status;
        thread.snoozedUntil = body.snoozedUntil || null;
        thread.messages.push({ id: "act" + Date.now(), direction: "activity", body: "", attachments: null, sentAt: new Date(), activity: body.status === "snoozed" ? { type: "snoozed", by: "Dave Morin" } : { type: "status_changed", to: body.status, by: "Dave Morin" } });
      }
      if (body.read === true) thread.unread = 0;
      if ("assignedToId" in body) thread.assignedToId = body.assignedToId;
      return json({ thread });
    }
    if (sub === "/temperature" && method === "GET") {
      const t = fx.temperature(id);
      return t ? json(t) : json({ error: "Not found" }, 404);
    }
    if (sub === "/reply" && method === "POST") {
      if (fx.connection.mock) return json({ error: "This is a sample conversation, so nothing can be sent from it." }, 409);
      const body = JSON.parse(options.body || "{}");
      const thread = fx.thread(id);
      if (params.get("refuse") === "1") {
        thread.messages.push({ id: "out" + Date.now(), direction: "out", body: body.text || "", attachments: null, sentAt: new Date(), failedReason: "That Page needs reconnecting: Meta returned error 190 (access token expired)." });
        return json({ error: "That Page needs reconnecting: Meta returned error 190 (access token expired)." }, 502);
      }
      thread.messages.push({ id: "out" + Date.now(), direction: "out", body: body.kind === "template" ? "[template quote_follow_up]" : body.text || "", attachments: null, sentAt: new Date(), readAt: null, failedReason: null });
      thread.waitingSince = null;
      return json({ ok: true });
    }
    if (sub === "/note" && method === "POST") {
      const body = JSON.parse(options.body || "{}");
      const thread = fx.thread(id);
      thread.messages.push({ id: "note" + Date.now(), direction: "note", private: true, body: body.text || "", attachments: null, sentAt: new Date() });
      return json({ ok: true });
    }
  }
  if (u.pathname === "/api/leads/assignees") return json(PEOPLE);
  return json({ error: "Harness has no answer for " + method + " " + u.pathname }, 404);
};

createRoot(document.getElementById("root")).render(
  <div className="bg-background text-foreground min-h-screen fq-app-shell">
    <MessagesPage />
  </div>,
);

// ── Scene driver, for headless screenshots ────────────────────────────────
// Clicks the real controls in order, with waits, exactly as a hand would.
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
const click = async (sel) => (await until(sel)).click();
const type = async (sel, text) => {
  const el = await until(sel);
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
(async () => {
  if (!scene) return;
  await until("[data-room-list], [data-connect-card]");
  await wait(400);
  if (scene === "facebook") {
    await click('[data-room-id="t_fb_sandra"]');
    await until("[data-chat-scroller] [data-unread-divider]");
  }
  if (scene === "instagram") {
    await click('[data-room-id="t_ig_marco"]');
    await until("[data-chat-scroller] [data-unread-divider]");
  }
  if (scene === "whatsapp") {
    await click('[data-room-id="t_wa_priya"]');
    await until("[data-chat-scroller] [data-system-row]");
  }
  if (scene === "outcome-menu") {
    await click('[data-room-id="t_fb_sandra"]');
    await until("[data-chat-scroller]");
    await wait(300);
    await click("[data-outcome-chip]");
    await until("[data-outcome-menu]");
  }
  if (scene === "context-outcome" || scene === "context-history") {
    await click('[data-room-id="t_fb_sandra"]');
    await until("[data-chat-scroller]");
    await wait(300);
    const tab = scene === "context-outcome" ? 2 : 3;
    await click(`[data-context-tabs] [role="tab"]:nth-child(${tab})`);
    await until(scene === "context-outcome" ? "[data-context-outcome]" : "[data-context-history]");
  }
  if (scene === "demo") {
    await click('[data-room-id="demo_thread_sandra"], [data-room-list] [data-room-id]');
    await until("[data-chat-scroller]");
  }
  if (scene === "import") {
    await click("[data-import-button]");
    await until("[data-import-toast]");
    await wait(300);
  }
  if (scene === "filter-instagram") {
    await click('[data-channel-filter] button:nth-child(3)');
    await wait(500);
  }
  if (scene === "refused") {
    await click('[data-room-id="t_fb_sandra"]');
    await until("[data-chat-scroller]");
    await wait(300);
    await type("[data-chat-composer] textarea", "We can start Monday the 21st — 8am ok?");
    await wait(100);
    await click("[data-composer-send]");
    await until("[data-send-error]");
    await wait(300);
  }
  if (scene === "sent") {
    await click('[data-room-id="t_fb_sandra"]');
    await until("[data-chat-scroller]");
    await wait(300);
    await type("[data-chat-composer] textarea", "We can start Monday the 21st — 8am ok?");
    await wait(100);
    await click("[data-composer-send]");
    await wait(800);
  }
  // Mobile scenes
  if (scene === "m-thread" || scene === "m-context" || scene === "m-back") {
    await click('[data-room-id="t_fb_sandra"]');
    await until("[data-chat-scroller] [data-unread-divider]");
    await wait(300);
  }
  if (scene === "m-context") {
    await click("[data-details-button]");
    await until('[data-chat-pane="context-sheet"]');
  }
  if (scene === "m-back") {
    await click("[data-back-button]");
    await wait(300);
  }
  await wait(500);
  document.documentElement.setAttribute("data-scene-ready", scene);
  // cdp-shot.mjs waits on this when ?do=1 is passed, so a scene that takes
  // real time (an import round trip) is captured after it lands.
  document.documentElement.setAttribute("data-harness-done", "1");
})().catch((err) => {
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
  document.documentElement.setAttribute("data-harness-done", "1");
});
