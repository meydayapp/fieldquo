// lib/leads/conversationSources.js
//
// Which lead sources mean "this lead came out of a conversation" — the
// leads the delete dialog offers "don't create a lead from this conversation
// again" for (app/components/leads/LeadDeleteDialog.js).
//
// Derived from lib/messaging/platforms.js SOURCE_FOR_PLATFORM rather than
// listed: a platform added there is a conversation source here the same day,
// with nothing to remember. Plus "ai_employee", the AI employee's own source
// when the channel is unknown (lib/aiEmployee/tools.js book_callback).
//
// A hint for the screen, not the decision: the server marks only threads it
// can actually find for the lead (lib/leads/deleteLead.js), and says which
// leads had none. Pure — imported by a client component.
import { SOURCE_FOR_PLATFORM } from "@/lib/messaging/platforms";

export const CONVERSATION_LEAD_SOURCES = Object.freeze([...new Set([...Object.values(SOURCE_FOR_PLATFORM), "ai_employee"])]);

/** Did this lead (as the board has it) probably come from a conversation? */
export function looksLikeConversationLead(lead) {
  if (!lead || typeof lead !== "object") return false;
  const ev = lead.conversationEvidence;
  if (ev && typeof ev === "object" && typeof ev.threadId === "string" && ev.threadId) return true;
  return typeof lead.source === "string" && CONVERSATION_LEAD_SOURCES.includes(lead.source);
}

// ── "Not a lead": the statement on the THREAD ───────────────────────────────
//
// Kept in MessageThread.leadCapture (the JSON lib/leads/conversationLead.js
// already keeps its verdict in) as `notALead: { at, byUserId, byName, leadId,
// leadName }` — no new column. Here rather than in deleteLead.js so the two
// hot paths that read it (the conversation capture on every inbound message,
// the AI employee's book_callback) do not load the delete module's
// dependencies.

/** Has a person said this conversation is not a lead? Pure. */
export function isMarkedNotALead(capture) {
  return Boolean(capture && typeof capture === "object" && capture.notALead && capture.notALead.at);
}

/**
 * The thread's leadCapture with the "not a lead" statement added. Pure.
 * Merged, never replaced: the capture's verdict, AI-run count and contact
 * signature are what stop the paid extraction re-running, and they stay.
 */
export function withNotALeadMark(capture, { at, byUserId = null, byName = null, leadId = null, leadName = null }) {
  const base = capture && typeof capture === "object" && !Array.isArray(capture) ? capture : {};
  return {
    ...base,
    notALead: {
      at: new Date(at).toISOString(),
      byUserId,
      byName,
      leadId,
      leadName,
    },
  };
}
