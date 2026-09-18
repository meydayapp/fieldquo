// The sales-portal harness: the real page components inside the real
// SalesShell, fed by ../fixtures.js through stubs/portalFetch.js. One
// bundle, one HTML file; ?page= picks the page, ?lang= the catalogue,
// ?scene= a control to press, ?scroll= a selector to bring to the top.
//
//   ?page=today|leads|companies|calendar|notes|note|playbook|support|pay|voicemail|demo
//         |messages|team|threads|thread|settings|welcome|login|invite
//
// The second row landed with the phone audit (docs/screens/sales-mobile):
// every /sales screen but the queue (docs/screens/sales-console/harness) is
// now reachable here, inside the shipped shell, so one walk covers the
// portal. Texts and Team are answered by the fixtures their own harnesses
// carry (stubs/portalFetch.js delegates /api/sales/messages* and /api/staff/*
// to them) so the rows are the ones those frames already show.
//
// Nothing is drawn here that a rep could not reach: every screen is the
// shipped component, and every scene is a click on a shipped control.
import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "./stubs/portalFetch.js";
import SalesShell from "@/app/sales/SalesShell";
import SalesQueuePage from "@/app/sales/queue/page";
import SalesHomePage from "@/app/sales/page";
import SalesLeadsPage from "@/app/sales/leads/page";
import SalesLeadPage from "@/app/sales/leads/[id]/page";
import SalesPortalPage from "@/app/sales/companies/page";
import SalesCalendarPage from "@/app/sales/calendar/page";
import SalesNotesPage from "@/app/sales/notes/page";
import SalesNotePage from "@/app/sales/notes/[id]/page";
import PlaybookView from "@/app/sales/playbook/PlaybookView";
import SalesSupportPage from "@/app/sales/support/page";
import SalesPayPage from "@/app/sales/pay/page";
import SalesVoicemailPage from "@/app/sales/voicemail/page";
import SalesDemoPage from "@/app/sales/demo/page";
import SalesMessagesPage from "@/app/sales/messages/page";
import SalesTeamPage from "@/app/sales/team/page";
import SalesThreadsPage from "@/app/sales/threads/page";
import SalesThreadPage from "@/app/sales/threads/[id]/page";
import SalesSettingsPage from "@/app/sales/settings/page";
import SalesWelcomePage from "@/app/sales/welcome/page";
import SalesLoginPage from "@/app/sales/login/page";
import SalesInvitePage from "@/app/sales/invite/[token]/page";
import SalesAgencyPage from "@/app/sales/agency/page";
import { seedPlaybooks } from "@/lib/sales/playbook/defaults";
import { seedObjections } from "@/lib/sales/playbook/objections";
import { battlecards } from "@/lib/sales/playbook/battlecards";
import { playbookMoments } from "@/lib/sales/playbook/moments";

const params = new URLSearchParams(window.location.search);
const page = params.get("page") || "today";

// The playbook page is a server component: it loads the playbooks and the
// objections (built-in seeds when the tables are absent — the same rows
// this hands over) and renders PlaybookView with them. Pinned to the
// manual's date so the battlecards' "as of" figures are the ones printed.
function PlaybookPage() {
  const asOf = new Date("2026-09-12T12:00:00Z");
  return (
    <PlaybookView
      playbooks={seedPlaybooks().filter((p) => p.active).map((p) => ({ ...p, source: "built-in", id: p.key }))}
      objections={seedObjections().filter((o) => o.active).map((o) => ({ ...o, source: "built-in", id: o.code }))}
      cards={battlecards({ asOf })}
      moments={playbookMoments()}
    />
  );
}

const PAGES = {
  today: ["/sales", <SalesHomePage />],
  // The queue, inside this harness too (2026-09-18) — so a call placed on
  // it can be followed to every other page below without the shell
  // remounting. Its routes are answered by the console harness's own
  // fixtures (stubs/portalFetch.js delegates to them).
  queue: ["/sales/queue", <SalesQueuePage />],
  leads: ["/sales/leads", <SalesLeadsPage />],
  lead: ["/sales/leads/l2", <SalesLeadPage params={Promise.resolve({ id: "l2" })} />],
  companies: ["/sales/companies", <SalesPortalPage />],
  calendar: ["/sales/calendar", <SalesCalendarPage />],
  notes: ["/sales/notes", <SalesNotesPage />],
  note: ["/sales/notes/n1", <SalesNotePage params={Promise.resolve({ id: "n1" })} />],
  playbook: ["/sales/playbook", <PlaybookPage />],
  support: ["/sales/support", <SalesSupportPage />],
  pay: ["/sales/pay", <SalesPayPage />],
  voicemail: ["/sales/voicemail", <SalesVoicemailPage />],
  demo: ["/sales/demo", <SalesDemoPage />],
  messages: ["/sales/messages", <SalesMessagesPage />],
  team: ["/sales/team", <SalesTeamPage />],
  threads: ["/sales/threads", <SalesThreadsPage />],
  thread: ["/sales/threads/t1", <SalesThreadPage params={Promise.resolve({ id: "t1" })} />],
  settings: ["/sales/settings", <SalesSettingsPage />],
  // The agency's own screen; pair it with &agency=1 so the shell draws My
  // team and the stub answers as an agency account.
  agency: ["/sales/agency", <SalesAgencyPage />],
  welcome: ["/sales/welcome", <SalesWelcomePage />],
  // The two screens reached without a session: the shell hides its chrome
  // on both, as it ships.
  login: ["/sales/login", <SalesLoginPage />],
  invite: ["/sales/invite/tok_harness", <SalesInvitePage params={Promise.resolve({ token: "tok_harness" })} />],
};
const [path, element] = PAGES[page] || PAGES.today;
window.__harnessPath = path;
window.__harnessParams = page === "note" ? { id: "n1" } : page === "lead" ? { id: "l2" } : page === "thread" ? { id: "t1" } : page === "invite" ? { token: "tok_harness" } : {};

// ── The page under the shell, by pathname ─────────────────────────────
// The App Router keeps the layout (SalesShell, its providers, the call they
// hold) mounted and swaps the page; this does the same. The pathname is the
// navigation stub's store: a push() from a shipped control — Text them,
// Email them, a rail link — or window.__harnessNavigate() from a scene
// moves it, and the page under the shell changes without the shell
// remounting. A path no fixture page answers keeps the page the frame
// opened with.
const BY_PATH = Object.fromEntries(Object.values(PAGES).map(([p, el]) => [p, el]));
const pathListeners = new Set();
const subscribePath = (l) => { pathListeners.add(l); return () => pathListeners.delete(l); };
const readPath = () => window.__harnessPath || path;
// The navigation stub notifies its own readers; this store is told through
// the same window hook so one push moves both.
const origNavigate = window.__harnessNavigate;
window.__harnessNavigate = (p) => { origNavigate?.(p); pathListeners.forEach((l) => l()); };
// A push() from a page component goes through the stub's go(), which sets
// window.__harnessPath; poll it so the router sees pushes made by shipped
// controls, not only by the scene driver.
setInterval(() => { pathListeners.forEach((l) => l()); }, 100);
function PageRouter({ initial }) {
  const current = useSyncExternalStore(subscribePath, readPath, () => path);
  return BY_PATH[current] || initial;
}
createRoot(document.getElementById("root")).render(<SalesShell><PageRouter initial={element} /></SalesShell>);

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
  for (let i = 0; i < 60; i++) {
    if (!document.querySelector(".animate-spin")) break;
    await wait(100);
  }
  await wait(400);
};
(async () => {
  // The login and invite screens carry no tour anchor — the shell is hidden
  // there — so they are waited on by their form instead.
  await until(page === "login" || page === "invite" ? "form" : "[data-tour]");
  await settled();
  if (scene === "drawer") {
    (await until('[data-tour-open="sales-nav"]')).click();
    await until('[data-sales-topbar] ~ * aside, aside[aria-label]');
    await wait(300);
  }
  if (scene === "status-menu") {
    // The picker is in the header from lg up and in the drawer below it, and
    // the header is display:none on a phone — so below lg the drawer is
    // opened first and the drawer's copy of the button is the one pressed.
    // Clicking the first match blindly pressed the hidden header button and
    // the 375 frame showed nothing open.
    const visible = () =>
      [...document.querySelectorAll('[data-tour="sales-status"] button')].find((b) => b.getClientRects().length > 0);
    if (!visible()) {
      (await until('[data-tour-open="sales-nav"]')).click();
      await until('[data-nav-drawer] [data-tour="sales-status"]');
      await wait(300);
    }
    visible().click();
    await wait(200);
  }
  if (scene === "reminder-then-ring") {
    // The Off reminder is up (?presence=offline), then a contractor rings:
    // the reminder must close and the ring dialog be the only modal.
    await until("[data-available-reminder]");
    window.__ring("+19185550123");
    await until('[data-incoming-dialog="open"] [data-incoming-pick-up]');
    await wait(300);
    if (document.querySelector("[data-available-reminder]")) throw new Error("scene: the Off reminder stayed open under a ring");
  }
  if (scene === "incoming-call" || scene === "incoming-call-held" || scene === "incoming-call-unknown") {
    // A contractor ringing back, on whatever page the frame is: the stubbed
    // Twilio Device (stubs/twilio.js) fires `incoming` and the dock draws
    // its alert dialog over the page. Fired after the page has settled so the
    // Off reminder, if it was up, is already the thing a ring closes. Three
    // numbers, three answers from the stubbed caller lookup (portalFetch.js):
    // the rep's own claim (links), another rep's (no link), nobody's (save).
    if (typeof window.__ring !== "function") throw new Error("scene: no stubbed Device to ring");
    const from = scene === "incoming-call-held" ? "+14055550777" : scene === "incoming-call-unknown" ? "+12125550199" : "+19185550123";
    window.__ring(from);
    await until('[data-incoming-dialog="open"] [data-incoming-pick-up]');
    // Long enough for the caller lookup to answer and the ring clock to tick.
    await wait(1200);
    const links = document.querySelector("[data-incoming-links]");
    if (scene === "incoming-call" && !(links?.querySelector("[data-incoming-open-company]") && links?.querySelector("[data-incoming-notes]"))) throw new Error("scene: the held business has no Open / Notes links");
    if (scene === "incoming-call-held" && links?.querySelector("a")) throw new Error("scene: a business held by another rep was linked");
    if (scene === "incoming-call-unknown" && !links?.querySelector("[data-incoming-save-lead]")) throw new Error("scene: an unmatched number has no save link");
  }
  if (page === "support" && scene === "open-ticket") {
    // The first ticket's header row is a button; pressing it opens the thread.
    const btn = [...document.querySelectorAll("button")].find((b) => /Invoices not arriving/.test(b.textContent));
    if (!btn) throw new Error("scene: ticket header not found");
    btn.click();
    await wait(300);
  }
  // ── Texts (2026-09-18): the New message picker, and a typed number Opened ──
  // The two presses the owner's reps make when a company says "text me
  // instead": New message, then type a number and press Open. The typed
  // scene lands on the fresh thread the stub answers for it, which is where
  // the first-message composer is.
  if (page === "messages" && (scene === "new-message" || scene === "typed-open")) {
    (await until("[data-new-message-button]")).click();
    await until("[data-new-message]");
    if (scene === "typed-open") {
      const input = await until("#new-text-phone");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, "819 345 9008");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(100);
      (await until("[data-new-text-form] button[type=submit]")).click();
      await until("[data-first-contact], [data-first-contact-picker], [data-first-contact-refusal]");
      await settled();
    }
  }
  // ── The call survives navigation (2026-09-18) ───────────────────────
  // ?page=queue&scene=call-navigate:<page> — press the queue's Call, then
  // move to another /sales page THROUGH THE ROUTER (the shell stays
  // mounted, the page under it changes), and prove: the stubbed Call was
  // never disconnected, the live strip is on the new page with Hang up,
  // Mute, Transfer, Text them and Email, and Hang up from the strip ends
  // the call and asks for the write-up right there. `text-them` navigates
  // the way the owner's rep did — by pressing Text them on the live call.
  if (page === "queue" && scene.startsWith("call-navigate:")) {
    const to = scene.slice("call-navigate:".length);
    await until('[data-console-card="dialer"] [data-call-button]', 150);
    (await until('[data-console-card="dialer"] [data-call-button]')).click();
    await until('[data-live-call-slot] [data-live-call="out"]');
    const callObj = window.__outboundCall;
    if (!callObj) throw new Error("scene: no outbound Call object after the press");
    let disconnected = false;
    callObj.on("disconnect", () => { disconnected = true; });
    await wait(1200);
    if (to === "text-them") {
      (await until('[data-live-call-slot] [data-live-call="out"] [data-text-them="chip"] [data-text-them-button]')).click();
      await until('[data-live-call-strip="out"]', 100);
    } else if (to === "email") {
      (await until('[data-live-call-slot] [data-live-call="out"] [data-email-them-button]')).click();
      await until('[data-live-call-strip="out"]', 100);
    } else if (to === "back") {
      // Away to Texts and back to the queue: the call must land back in
      // the Dialer card's slot, still up, with the same clock running.
      window.__harnessNavigate(PAGES.messages[0]);
      await until('[data-live-call-strip="out"]', 100);
      await settled();
      if (disconnected) throw new Error("scene: the call was disconnected by leaving the queue");
      // Long enough that the clock reads several seconds — the proof it is
      // the same call and not one restarted on return.
      await wait(3200);
      window.__harnessNavigate(PAGES.queue[0]);
      await until('[data-console-card="dialer"] [data-live-call-slot] [data-live-call="out"]', 150);
      await settled();
      if (disconnected) throw new Error("scene: the call was disconnected by coming back to the queue");
      if (document.querySelector('[data-live-call-strip="out"]')) throw new Error("scene: the strip is still up with the Dialer card on screen");
      if (document.querySelector('[data-console-card="dialer"] [data-call-button]')) throw new Error("scene: the Call button is back under a live call");
      const clockText = document.querySelector("[data-live-call-clock]")?.textContent || "";
      if (!/^0:(0[3-9]|[1-5]\d)$/.test(clockText)) throw new Error(`scene: the clock did not carry on across the navigation (${clockText})`);
      document.documentElement.setAttribute("data-harness-done", "1");
      return;
    } else {
      const target = PAGES[to];
      if (!target) throw new Error(`scene: no page named ${to}`);
      window.__harnessNavigate(target[0]);
      // The lead page registers a live-call slot of its own, so the call
      // draws inline there; every other page gets the strip.
      await until(to === "lead" ? '[data-live-call-slot] [data-live-call="out"]' : '[data-live-call-strip="out"]', 100);
    }
    await settled();
    if (disconnected) throw new Error(`scene: the call was disconnected by navigating to ${to}`);
    if (document.querySelector('[data-console-card="dialer"]')) throw new Error("scene: the queue is still on the screen — the page did not change");
    const strip = document.querySelector(to === "lead" ? '[data-live-call-slot] [data-live-call="out"]' : '[data-live-call-strip="out"]');
    const wanted = ["[data-live-call-hang-up]", "[data-live-call-mute]", '[data-text-them="chip"]', "[data-email-them-button]", "[data-live-call-clock]"];
    if (to !== "lead") wanted.push("[data-live-call-back]");
    for (const sel of wanted) {
      if (!strip.querySelector(sel)) throw new Error(`scene: the strip on ${to} has no ${sel}`);
    }
    if (params.get("hangup") === "1") {
      strip.querySelector("[data-live-call-hang-up]").click();
      await wait(300);
      if (!disconnected) throw new Error("scene: Hang up on the strip did not end the call");
      if (document.querySelector('[data-live-call-strip="out"]')) throw new Error("scene: the strip is still up after Hang up");
      await until("[data-outbound-write-up]", 50);
      const ended = (window.__harnessCalls || []).some((c) => c.method === "POST" && c.url === "/api/sales/calls" && c.body?.action === "ended" && c.body?.hungUpBy === "rep");
      if (!ended) throw new Error("scene: the hang-up was not posted as the rep's");
      await wait(300);
    }
  }
  if (page === "leads" && scene === "adding") {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().length && /add|ajouter|añadir|agregar/i.test(b.textContent));
    if (btn) { btn.click(); await wait(200); }
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
