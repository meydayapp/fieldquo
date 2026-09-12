// The WhatsApp settings card harness: the REAL app/components/settings/
// WhatsAppPanel.js, with window.fetch answered from fixtures.
//   ?scenario=ready       nothing connected, sign-up button + advanced door
//   ?scenario=connected   a number connected through the advanced door
//   ?scene=manual         opens the advanced section and fills the fields
//   ?lang=fr              any of the nine catalogues
import React from "react";
import { createRoot } from "react-dom/client";
import WhatsAppPanel from "@/app/components/settings/WhatsAppPanel";

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario") || "ready";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const STATUS = {
  ready: {
    connectEnabled: true, featureState: "preview", appConfigured: true, fullyConfigured: true,
    signupConfigured: true, readOnly: false, channels: [], templates: [],
  },
  nosignup: {
    connectEnabled: true, featureState: "preview", appConfigured: true, fullyConfigured: true,
    signupConfigured: false, readOnly: false, channels: [], templates: [],
  },
  connected: {
    connectEnabled: true, featureState: "preview", appConfigured: true, fullyConfigured: true,
    signupConfigured: true, readOnly: false,
    channels: [{
      id: "chan_1", platform: "whatsapp", name: "TrueFinish Cabinets", externalId: "1357924680",
      status: "connected", connectedAt: "2026-09-12T14:00:00Z", disconnectedAt: null, lastError: null,
      wabaId: "2468013579", displayPhoneNumber: "+1 716 555 0199", verifiedName: "TrueFinish Cabinets",
      connectedVia: "manual", importedAt: null,
    }],
    templates: [
      { id: "t1", name: "quote_follow_up", language: "en_US", status: "APPROVED" },
      { id: "t2", name: "visit_reminder", language: "en_US", status: "PENDING" },
    ],
  },
};

window.__calls = [];
window.fetch = async (url, options = {}) => {
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(String(url), "http://harness.local");
  window.__calls.push({ url: u.pathname, method, body: options.body || null });
  await new Promise((r) => setTimeout(r, 40));
  if (u.pathname === "/api/settings/whatsapp/status") return json(STATUS[scenario] || STATUS.ready);
  if (u.pathname === "/api/settings/whatsapp/manual" && method === "POST") {
    if (params.get("refuse")) return json({ error: "refused", code: params.get("refuse") }, 400);
    return json({ connected: true, channel: STATUS.connected.channels[0] });
  }
  return json({ error: "Harness has no answer for " + method + " " + u.pathname }, 404);
};

createRoot(document.getElementById("root")).render(
  <div className="bg-background text-foreground min-h-screen fq-app-shell p-6 max-w-2xl">
    <WhatsAppPanel />
  </div>,
);

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
const type = async (sel, text) => {
  const el = await until(sel);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
(async () => {
  try {
    if (scene === "manual") {
      (await until("[data-whatsapp-manual] > button")).click();
      await until("[data-whatsapp-manual] form");
      const inputs = document.querySelectorAll("[data-whatsapp-manual] input");
      await type("[data-whatsapp-manual] input[inputmode=numeric]", "2468013579");
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(inputs[1], "1357924680");
      inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      await type("[data-whatsapp-token]", "EAAGm0PX4ZCpsBOZCexampleSystemUserToken");
      if (params.get("refuse")) {
        (await until("[data-whatsapp-manual] button[type=submit]")).click();
        await until("[data-whatsapp-manual] form .text-red-700, [data-whatsapp-manual] form .dark\\:text-red-300");
      }
      await wait(300);
    }
    document.documentElement.setAttribute("data-harness-done", "1");
  } catch (err) {
    document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
    document.documentElement.setAttribute("data-harness-done", "1");
  }
})();
