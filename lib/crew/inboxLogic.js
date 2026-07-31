// lib/crew/inboxLogic.js
//
// What to DO with a crew message — the layer above attribution.
//
// attribution.js answers "which job?". This answers the messier question that
// wraps it: this message might be a fresh photo, OR it might be the crew
// answering the "which job?" we asked a moment ago. Those need different
// handling, and getting them confused is its own way to file to the wrong job.
//
// ══ One open question at a time, and the latest message wins ═══════════════
//
// A sender has at most one unanswered "which job?" pending. When a reply comes
// that clearly picks one of the offered jobs, it resolves — and it files the
// ORIGINAL pending photo, not the reply. When something else arrives instead (a
// new photo, an unrelated message), the stale question is abandoned rather than
// left to collect a mismatched answer later. That mirrors how a person reads a
// chat: the newest thing is what you're talking about.
//
// ══ Pure ═══════════════════════════════════════════════════════════════════
//
// No database, no network. The caller loads the pending question and the day's
// candidate jobs and passes them in; this returns an ACTION describing what
// should happen. The DB writes and the SMS reply live in the orchestration
// layer, so the branching that's easy to get wrong is testable on its own.
import { attributeMessage } from "./attribution";

/**
 * Parse a reply to a "which job?" question into the job it picks.
 *
 * Accepts a 1-based number ("2"), or a distinctive word from a candidate
 * (a client surname, a street number, a word from the job title). Returns null
 * when the reply doesn't clearly pick exactly one — "the first one" or a vague
 * "yeah that one" is not a selection, and guessing which is exactly the silent
 * wrong-guess this whole system refuses to make.
 */
export function parseSelection(reply, candidates = []) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c && c.jobId) : [];
  if (!list.length) return null;

  const text = String(reply || "").trim().toLowerCase();
  if (!text) return null;

  // A bare number, 1-based. "2" or "#2" or "option 2".
  const numMatch = text.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (n >= 1 && n <= list.length) {
      // But ONLY if the number isn't also a street number of a different
      // candidate — "123" replying to a list where one job is at 123 Oak is a
      // name match, not "the 123rd option". Name match is handled below and
      // takes precedence when the number exceeds the list length; when it's a
      // small in-range number we treat it as an ordinal, which is what a crew
      // member means by texting "2".
      return list[n - 1];
    }
  }

  // A distinctive word from exactly one candidate.
  const words = new Set(text.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2));
  const named = list.filter((c) => {
    const ids = new Set();
    for (const field of [c.clientName, c.jobTitle, c.address]) {
      for (const tok of String(field || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)) {
        if (tok.length >= 2) ids.add(tok);
      }
    }
    for (const w of words) if (ids.has(w)) return true;
    return false;
  });
  return named.length === 1 ? named[0] : null;
}

/**
 * Decide what to do with an inbound crew message.
 *
 * @param {object} inbound     { text, hasMedia, point }
 * @param {object|null} pending  a prior unanswered question:
 *                               { candidates, payload }  where payload is the
 *                               original message we're still trying to file
 *                               ({ text, mediaCount, point })
 * @param {Array}  candidates  the sender's scheduled jobs today (fresh)
 *
 * @returns one of:
 *   { action: "file",   jobId, method, payload, resolvedAsk }   file payload to jobId
 *   { action: "ask",    candidates, payload }                    ask which job
 *   { action: "reask",  candidates, payload }                    reply wasn't a pick; ask again
 *   { action: "ignore", reason }                                 nothing to file
 *
 * `payload` on a file/ask is what should be filed or held — for a resolved ask
 * it's the ORIGINAL pending payload, not the reply.
 */
export function decideAction({ inbound = {}, pending = null, candidates = [] } = {}) {
  const text = String(inbound.text || "").trim();
  const hasMedia = Boolean(inbound.hasMedia);
  const thisPayload = { text, mediaCount: inbound.mediaCount || 0, point: inbound.point || null };

  // ── Resolving an open question ────────────────────────────────────────────
  if (pending && Array.isArray(pending.candidates) && pending.candidates.length) {
    // A pure text reply with no new media is a candidate for "answering".
    if (!hasMedia) {
      const picked = parseSelection(text, pending.candidates);
      if (picked) {
        return {
          action: "file",
          jobId: picked.jobId,
          method: "answered",
          // The photo we were holding — NOT the "2" they just texted.
          payload: pending.payload,
          resolvedAsk: true,
        };
      }
      // Text, but not a recognisable pick. If it's empty, ignore; otherwise the
      // crew said something we couldn't map — ask again with the same options
      // rather than guess or drop their photo.
      if (!text) return { action: "ignore", reason: "empty" };
      return { action: "reask", candidates: pending.candidates, payload: pending.payload };
    }
    // New media while a question is open: the conversation moved on. Fall
    // through and treat THIS as a new message; the caller abandons the stale
    // question. (Documented tradeoff — the held photo is dropped rather than
    // risk answering the old question with the new photo's context.)
  }

  // ── A fresh message ───────────────────────────────────────────────────────
  if (!hasMedia && !text) {
    return { action: "ignore", reason: "no content" };
  }

  const verdict = attributeMessage({ candidates, text, point: inbound.point || null });

  if (verdict.confidence === "high" && verdict.jobId) {
    return {
      action: "file",
      jobId: verdict.jobId,
      method: verdict.method,
      payload: thisPayload,
      resolvedAsk: false,
    };
  }

  // Needs a human to point at the right job.
  if (verdict.needsConfirmation) {
    return { action: "ask", candidates: verdict.candidates, payload: thisPayload };
  }

  // No candidates at all — nothing scheduled to file against.
  return { action: "ignore", reason: verdict.reason || "no candidates" };
}
