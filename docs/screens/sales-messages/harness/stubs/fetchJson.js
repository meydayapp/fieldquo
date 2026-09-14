// Harness stub of @/lib/fetchJson: answers the real page's requests from
// fixtures. Scenario chosen by ?scenario= in the harness URL.
import { FIXTURES } from "../fixtures.js";

function scenario() {
  const s = new URLSearchParams(window.location.search).get("scenario") || "default";
  return FIXTURES[s] || FIXTURES.default;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, options = {}) {
  const fx = scenario();
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(url, "http://harness.local");
  await delay(30);
  window.__harnessCalls = window.__harnessCalls || [];
  window.__harnessCalls.push({ url, method, body: options.body || null });

  if (u.pathname === "/api/sales/messages" && method === "GET") {
    const withE164 = u.searchParams.get("with");
    // Fresh objects every read, as a real response is: the page's setState
    // bails out on an identical reference, so a fixture mutated in place
    // (the demo send below) would never reach the screen.
    if (!withE164) return { conversations: fx.conversations.map((c) => ({ ...c })), readStateError: fx.readStateError || null, draftsError: fx.draftsError || null, waiting: fx.waiting ? { ...fx.waiting, items: [...fx.waiting.items] } : null };
    const thread = fx.threads[withE164];
    if (!thread) throw new Error("No such thread in fixtures: " + withE164);
    return { ...thread, messages: [...(thread.messages || [])], checkIns: thread.checkIns ? [...thread.checkIns] : thread.checkIns };
  }
  if (u.pathname === "/api/sales/messages" && method === "POST") {
    if (fx.sendRefusal) { const e = new Error(fx.sendRefusal); throw e; }
    const thread = fx.threads[options.body.to];
    const msg = { id: "m" + Date.now(), direction: "out", body: options.body.text + "\n\nFieldQuo, 123 Main St. Reply STOP to opt out", sentAt: new Date().toISOString(), fromE164: "+15550000000", toE164: options.body.to };
    thread.messages = [...thread.messages, msg];
    return { ok: true, messages: thread.messages };
  }
  if (u.pathname === "/api/sales/messages/triage") {
    // The override: relabel the latest inbound row of that thread and the
    // list's chip, the way the real route + list read would.
    const thread = fx.threads[options.body.with];
    const kind = options.body.triage;
    if (thread) {
      const latest = [...thread.messages].reverse().find((m) => m.direction === "in");
      if (latest) { latest.triage = kind; latest.triageOverriddenById = kind ? "rep-rach" : null; }
      thread.triage = latest ? { kind, reason: latest.triageReason || null, overridden: Boolean(kind), at: new Date().toISOString(), open: true } : null;
    }
    const conv = fx.conversations.find((c) => c.e164 === options.body.with);
    if (conv) conv.triage = { ...(conv.triage || {}), kind, overridden: Boolean(kind) };
    return { ok: true, with: options.body.with, triage: kind, messageId: "m" };
  }
  if (u.pathname === "/api/sales/messages/read") return { ok: true, with: options.body.with, readAt: new Date().toISOString(), doneAt: options.body.done ? new Date().toISOString() : null };
  if (u.pathname === "/api/sales/messages/contacts") {
    const q = (u.searchParams.get("q") || "").toLowerCase();
    return { results: fx.contacts.filter((c) => !q || (c.name || "").toLowerCase().includes(q) || (c.e164 || "").includes(q.replace(/\D/g, "") || "§")) };
  }
  if (u.pathname === "/api/sales/messages/start") {
    const phone = options.body.phone.replace(/\D/g, "");
    if (phone.startsWith("1809") || phone.startsWith("809")) throw new Error("Texting is available for Canadian and US numbers only.");
    if (phone.startsWith("44")) throw new Error("Texting is available for Canadian and US numbers only.");
    if (phone.endsWith("0199")) throw new Error("This number belongs to a contractor another rep is working. It is held by Priya N.");
    return { ok: true, with: "+15145550134", leadId: "lead-new", created: true };
  }
  if (u.pathname === "/api/sales/sms" && method === "GET") return fx.signup;
  if (u.pathname === "/api/sales/sms" && method === "POST") return { ok: true };
  if (u.pathname === "/api/sales/checkins/waiting") return { ok: true, ...(fx.waiting || { count: 0, demoCount: 0, noNumberCount: 0, items: [] }) };
  if (/^\/api\/sales\/checkins\/[^/]+\/send$/.test(u.pathname) && method === "POST") {
    // The demo's simulated send, as store.js simulateDemoSend leaves the
    // thread: the draft consumed, an outbound bubble marked demo, the list
    // row moved on (no draft, our words last).
    const id = u.pathname.split("/")[4];
    for (const thread of Object.values(fx.threads)) {
      const draft = (thread.checkIns || []).find((c) => c.id === id);
      if (!draft) continue;
      thread.checkIns = thread.checkIns.filter((c) => c.id !== id);
      if (thread.demo) {
        thread.messages = [...thread.messages, { id: "demo:" + id, direction: "out", body: draft.draftText, sentAt: new Date().toISOString(), fromE164: null, toE164: thread.with, demo: true }];
      }
      const conv = fx.conversations.find((c) => c.e164 === thread.with);
      if (conv) Object.assign(conv, { openDrafts: 0, nextDraftDue: null, draftOnly: false, lastDirection: "out", lastAt: new Date().toISOString(), count: 1 });
      if (fx.waiting) { fx.waiting.count -= 1; if (draft.origin === "demo") fx.waiting.demoCount -= 1; fx.waiting.items = fx.waiting.items.filter((i) => i.id !== id); }
      return { ok: true, demo: Boolean(thread.demo), checkIn: { ...draft, status: "sent" }, messages: thread.messages, checkIns: thread.checkIns };
    }
    return { ok: true };
  }
  if (u.pathname.startsWith("/api/sales/checkins")) return { ok: true };
  if (u.pathname === "/api/sales/leads" && method === "POST") return { lead: { id: "lead-from-prospect" } };
  throw new Error("Harness has no answer for " + method + " " + url);
}
