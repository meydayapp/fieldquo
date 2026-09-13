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
import React from "react";
import { createRoot } from "react-dom/client";
import "./stubs/portalFetch.js";
import SalesShell from "@/app/sales/SalesShell";
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
  welcome: ["/sales/welcome", <SalesWelcomePage />],
  // The two screens reached without a session: the shell hides its chrome
  // on both, as it ships.
  login: ["/sales/login", <SalesLoginPage />],
  invite: ["/sales/invite/tok_harness", <SalesInvitePage params={Promise.resolve({ token: "tok_harness" })} />],
};
const [path, element] = PAGES[page] || PAGES.today;
window.__harnessPath = path;
window.__harnessParams = page === "note" ? { id: "n1" } : page === "lead" ? { id: "l2" } : page === "thread" ? { id: "t1" } : page === "invite" ? { token: "tok_harness" } : {};
createRoot(document.getElementById("root")).render(<SalesShell>{element}</SalesShell>);

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
    (await until('[data-tour="sales-status"] button')).click();
    await wait(200);
  }
  if (page === "support" && scene === "open-ticket") {
    // The first ticket's header row is a button; pressing it opens the thread.
    const btn = [...document.querySelectorAll("button")].find((b) => /Invoices not arriving/.test(b.textContent));
    if (!btn) throw new Error("scene: ticket header not found");
    btn.click();
    await wait(300);
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
