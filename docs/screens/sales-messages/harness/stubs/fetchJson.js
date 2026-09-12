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
    if (!withE164) return { conversations: fx.conversations, readStateError: fx.readStateError || null, draftsError: fx.draftsError || null };
    const thread = fx.threads[withE164];
    if (!thread) throw new Error("No such thread in fixtures: " + withE164);
    return thread;
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
  if (u.pathname.startsWith("/api/sales/checkins")) return { ok: true };
  if (u.pathname === "/api/sales/leads" && method === "POST") return { lead: { id: "lead-from-prospect" } };
  throw new Error("Harness has no answer for " + method + " " + url);
}
