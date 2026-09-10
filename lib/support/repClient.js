// lib/support/repClient.js
//
// The escalation channel as a rep-side UI sees it. Three functions, and they
// are the ONLY supported way to call /api/sales/support from a browser.
//
// ══ Why this exists rather than a fetch at each call site ══════════════════
//
// Two screens want to raise a ticket: /sales/support (built here) and the
// rep's own company screen (being built beside this). Written twice, the copy
// is the one that rots — AGENTS.md failure class #4 — and the specific way it
// rots is known in advance: `fetch` does not serialise an object, so the second
// hand-written call site posts the nine characters `[object Object]`, the route
// validates an empty body, and the rep is told a subject is required while the
// subject is on screen. lib/fetchJson.js's header records that exact bug
// killing six controls on one console screen.
//
// So: everything goes through fetchJson, which serialises and which turns an
// error status into a thrown Error with a message a human can act on. There is
// no `if (res.ok)` here and none is possible.
import { fetchJson } from "@/lib/fetchJson";

/**
 * Raise a ticket about one of the rep's own companies.
 *
 * @param {object} params
 * @param {string} params.companyId  a company ATTRIBUTED TO THIS REP. The
 *   server re-reads that attribution from the database before writing and
 *   answers 404 otherwise — this argument is a request, not a grant.
 * @param {string} params.subject    one line, trimmed and capped at 140.
 * @param {string} params.body       what happened. Line breaks survive.
 * @param {string} [params.priority] "low" | "normal" | "high" | "urgent".
 *   Omit it and the ticket is `normal`; send anything else and the call is
 *   refused rather than quietly downgraded.
 *
 * @returns {Promise<{ ticket: {
 *   id: string, subject: string, body: string, status: "open",
 *   priority: string, createdAt: string, resolvedAt: null,
 *   assignedAdminId: string|null, assigned: boolean,
 *   company: { id: string, name: string },
 *   statusLine: string, notes: [] } }>}
 *
 * `assigned: false` is a real answer, not an error: the ticket IS recorded, and
 * `statusLine` says in words that nobody is on it. Show that sentence — a
 * screen that renders "Open" either way is the reassuring lie this channel
 * exists to stop.
 *
 * @throws {Error} with `.status` and a readable `.message` — 404 "not in your
 *   book", 400 for an empty subject or body or an unknown priority, 401 when
 *   the portal session has gone.
 */
export async function raiseSupportTicket({ companyId, subject, body, priority } = {}) {
  return fetchJson("/api/sales/support", {
    method: "POST",
    body: { companyId, subject, body, priority },
  });
}

/**
 * The rep's own tickets, newest first, with their threads.
 *
 * @param {object} [params]
 * @param {string} [params.status] one of "open" | "in_progress" | "resolved",
 *   or omitted for all of them. An unknown value is refused rather than
 *   ignored, because a filter that silently does nothing shows a list that
 *   contradicts the control above it.
 *
 * @returns {Promise<{ tickets: Array<object>, counts: Record<string, number> }>}
 *   Each ticket carries `notes` — the rep-visible thread only; FieldQuo's
 *   internal notes are filtered server-side.
 */
export async function listSupportTickets({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const query = params.toString();
  return fetchJson(`/api/sales/support${query ? `?${query}` : ""}`);
}

/**
 * Add a reply to a ticket the rep raised.
 *
 * The rep can answer a question from support; they deliberately cannot change
 * the STATUS. A rep marking their own ticket resolved would take it out of a
 * queue FieldQuo had not yet looked at.
 *
 * @param {string} ticketId  must be one of this rep's own — re-checked from
 *   the database at write time.
 * @param {string} body
 * @returns {Promise<{ note: { id: string, body: string, authorKind: "rep", createdAt: string } }>}
 */
export async function replyToSupportTicket(ticketId, body) {
  return fetchJson(`/api/sales/support/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: { body },
  });
}
