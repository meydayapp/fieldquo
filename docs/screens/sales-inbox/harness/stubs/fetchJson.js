// Harness stub of @/lib/fetchJson: answers the real inbox's requests from
// fixtures.js. Scenario by ?scenario=.
import { FIXTURES, listRows, detailOf } from "../fixtures.js";

function scenario() {
  const s = new URLSearchParams(window.location.search).get("scenario") || "default";
  return FIXTURES[s] || FIXTURES.default;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, options = {}) {
  const fx = scenario();
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(url, "http://harness.local");
  const body = typeof options.body === "string" ? JSON.parse(options.body || "{}") : options.body || {};
  await delay(30);
  window.__harnessCalls = window.__harnessCalls || [];
  window.__harnessCalls.push({ url, method, body });

  if (u.pathname === "/api/sales/threads" && method === "GET") {
    const rows = listRows(fx, u.searchParams.get("folder") || "inbox", u.searchParams.get("q") || "");
    return { threads: rows, folder: u.searchParams.get("folder") || "inbox", unread: rows.filter((r) => r.labels.unread && !r.archivedAt).length, outreach: fx.outreach, mailbox: fx.mailbox };
  }
  if (u.pathname === "/api/sales/threads" && method === "POST") {
    return { threadId: "t-acme", messageId: "m-new" };
  }
  if (u.pathname === "/api/sales/threads/templates") {
    return { language: "en", templates: [
      { key: "signup", label: "Signup link", subject: "Your FieldQuo signup link", body: "Hi Dana,\n\nAs promised, here is the link to start your FieldQuo account — the first month is free and there is nothing to install:\n\nhttps://www.fieldquo.com/signup?sales=rachel\n\nRachel Koudoyor" },
      { key: "followUp", label: "Follow-up", subject: "Quick follow-up", body: "Hi Dana,\n\nJust checking whether you had a chance to look at what I sent over.\n\nRachel Koudoyor" },
    ] };
  }
  const m = u.pathname.match(/^\/api\/sales\/threads\/([^/]+)$/);
  if (m && method === "GET") {
    const d = detailOf(fx, m[1]);
    if (!d) throw new Error("Not found.");
    return d;
  }
  if (m && method === "PATCH") {
    const t = fx.threads[m[1]];
    if (body.read === true) t.readAt = new Date().toISOString();
    if (body.read === false) t.readAt = t.lastInboundAt ? new Date(new Date(t.lastInboundAt).getTime() - 1).toISOString() : null;
    if (body.archived === true) t.archivedAt = new Date().toISOString();
    if (body.archived === false) t.archivedAt = null;
    return { thread: { id: t.id, readAt: t.readAt, archivedAt: t.archivedAt }, mirrored: 0 };
  }
  if (/^\/api\/sales\/threads\/[^/]+\/messages$/.test(u.pathname) && method === "POST") {
    const id = u.pathname.split("/")[4];
    fx.messages[id] = [...fx.messages[id], { id: "m" + Date.now(), direction: "out", fromAddress: "rachel.koudoyor@fieldquo.com", toAddress: (body.to || []).join(", "), ccAddresses: (body.cc || []).join(", ") || null, subject: "Re: " + fx.threads[id].subject, body: body.body + "\n\n—\nRachel Koudoyor · FieldQuo · rachel.koudoyor@fieldquo.com", sentAt: new Date().toISOString(), seen: true, filedBy: null, attachments: [], forwardedToMailbox: false }];
    fx.threads[id].lastMessageAt = new Date().toISOString();
    return { messageId: "m-new", threadId: id };
  }
  if (u.pathname === "/api/sales/email-drafts" && method === "PUT") {
    const d = { id: body.id || "d-" + Date.now(), leadId: body.leadId, threadId: body.threadId || null, kind: body.kind, toAddresses: (body.toAddresses || []).join(", ") || null, ccAddresses: null, subject: body.subject || null, body: body.body || "", quotedMessageId: body.quotedMessageId || null, attachments: null, updatedAt: new Date().toISOString() };
    return { draft: body.body || body.subject ? d : null };
  }
  if (u.pathname.startsWith("/api/sales/email-drafts/") && method === "DELETE") return { discarded: true };
  if (u.pathname === "/api/sales/leads" && method === "GET") return { leads: fx.leads, counts: {}, outreach: fx.outreach };
  const l = u.pathname.match(/^\/api\/sales\/leads\/([^/]+)$/);
  if (l && method === "GET") return { lead: fx.leads.find((x) => x.id === l[1]) || null };
  if (u.pathname.startsWith("/api/sales/calls")) return { history: [], calls: [] };
  throw new Error("Harness has no answer for " + method + " " + url);
}
