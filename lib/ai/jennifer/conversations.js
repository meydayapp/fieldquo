// lib/ai/jennifer/conversations.js
//
// Persistence for a COMPANY-mode Jennifer conversation only. There is no
// anonymous equivalent, deliberately — AGENTS.md non-negotiable #8 forbids
// keeping a stranger's chat log, so the anonymous half of app/api/jennifer/
// route.js never calls anything in this file; it stays exactly as stateless
// as it always was (see that route's header). What DOES get written for an
// anonymous escalation is a single Feedback ticket with a one-sentence
// reason — a different, much smaller thing than a conversation.
//
// Every function here takes companyId as an argument rather than reading it
// from a row it just loaded, and every LOOKUP filters by companyId in the
// WHERE clause rather than checking it after the fact — a conversation id
// guessed or leaked from another tenant has to fail to MATCH the query, not
// be fetched and then rejected, which is the same reasoning
// lib/permissions/enforce.js's scopeFilter uses.
//
// ── The unresolved → escalated → resolved lifecycle ─────────────────────────
//
// Modelled directly on the reference implementation's own conversation
// status field and its `shouldTriggerAgent = status === "unresolved"` rule
// (packages/backend/convex/public/messages.ts in the echo reference) — once a
// conversation is escalated, the MODEL STOPS ANSWERING IN IT. A visitor typing
// again while waiting for a human gets their message saved (so the operator
// sees the full thread) but no bot reply, because a bot cheerfully continuing
// to answer in a conversation a person is now handling is confusing at best
// and, for the escalation topics that got it here (money, deletion, legal),
// actively wrong. See shouldAutoRespond() below, which is the single place
// that decision is made.
import { db } from "@/lib/db";

/** Roles the MODEL is shown as conversation history. An operator's reply is
 * real context for the next human who opens this thread, but Jennifer never
 * generates another turn once escalated (see shouldAutoRespond), so there is
 * currently no path where an operator message reaches askJennifer's prompt —
 * this exists so that if that ever changes, someone has to look at this
 * comment and decide on purpose rather than by accident. */
const MODEL_VISIBLE_ROLES = new Set(["user", "assistant"]);

/**
 * A conversation, scoped to the caller's own company — or null if it doesn't
 * exist, belongs to someone else, or the id is malformed. All three read as
 * exactly the same "not found" to the caller; see the header on why the scope
 * lives in the query, not in a check afterwards.
 */
export async function loadConversation({ conversationId, companyId }) {
  if (!conversationId || !companyId) return null;
  return db.jenniferConversation.findFirst({
    where: { id: conversationId, companyId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function createConversation({ companyId, userId }) {
  return db.jenniferConversation.create({
    data: { companyId, userId },
    include: { messages: true },
  });
}

export async function appendMessage({ conversationId, role, content }) {
  return db.jenniferMessage.create({
    data: { conversationId, role, content: String(content ?? "").slice(0, 8000) },
  });
}

/**
 * Does an incoming message get a Jennifer reply, or just get filed for a
 * human to see? Pure — takes the status, not a live row — so the check
 * script can execute the actual lifecycle rule directly.
 */
export function shouldAutoRespond(status) {
  // "resolved" also auto-responds: a company member typing into a closed
  // conversation is starting a new question, not continuing a closed one —
  // see reopenIfResolved just below, which is what actually flips the row
  // back to unresolved when this is true.
  return status === "unresolved" || status === "resolved";
}

/** If a message arrives on a resolved conversation, it reopens — this is the
 * one status transition applied on the READ side rather than only ever
 * forward through escalate. */
export async function reopenIfResolved(conversation) {
  if (conversation.status !== "resolved") return conversation;
  return db.jenniferConversation.update({
    where: { id: conversation.id },
    data: { status: "unresolved", escalationReason: null },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function markEscalated({ conversationId, reason }) {
  return db.jenniferConversation.update({
    where: { id: conversationId },
    data: { status: "escalated", escalationReason: reason || "handed off" },
  });
}

/** The conversation's messages, in the {role, content} shape askJennifer
 * expects — operator turns filtered out per MODEL_VISIBLE_ROLES above. */
export function toModelMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => MODEL_VISIBLE_ROLES.has(m.role))
    .map((m) => ({ role: m.role, content: m.content }));
}
