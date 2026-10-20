// lib/messaging/aiTurn.js
//
// "Does this message owe the AI employee a turn, and has it had one?"
//
// ══ The hole this closes ═══════════════════════════════════════════════════
//
// lib/messaging/ingest.js AWAITS aiEmployeeOnInbound inside the webhook
// request. That turn costs a 2.5–6s burst debounce, a routing model call, the
// main model call, any tool calls and then a Graph send. The Message row is
// committed BEFORE any of it (ingest.js, the upsert), and the hook fires only
// when that upsert created the row.
//
// So when the function is cut off mid-turn, the reply is gone for good: Meta
// redelivers, the upsert finds the row, `created` is false, and nothing asks
// the employee again. No cron swept it and no queue held it — the homeowner
// simply never got an answer, and the inbox shows a message that looks
// answered-in-due-course. That is the first rule in AGENTS.md wearing a
// different hat: a reply that appears to be coming and isn't.
//
// ══ Why a flag on the row, and not a queue ════════════════════════════════
//
// Because this repo already answered that question. /api/cron/messaging-media
// carries the argument in full: deferred work is a route under app/api/cron/,
// in vercel.json, behind requireCronSecret — and "a Message row with
// mediaPending true IS the queue, indexed, self-clearing, and impossible to
// get out of step with the work." `aiPending` is the same shape for the same
// reason, down to the index. A second mechanism would be the one nobody
// monitors.
//
// The inline turn STAYS. A reply that lands in three seconds is the product;
// the sweep is the safety net under it, not a replacement for it.

/**
 * The one definition of "this message owes the employee a turn".
 *
 * Exported and used in BOTH places — the flag written with the row and the
 * hook that runs the turn — for the reason the mediaPending comment gives
 * about hasFetchableMedia: two copies of a predicate is a row the cron spins
 * on forever, or one it never looks at. The conditions are ingest's own:
 *
 *   direction "in"   the employee answers homeowners, never its own sends
 *   not imported     a pull of the last thirty days is history; answering it
 *                    would reply to a month of old enquiries at once
 *   not noAutoReply  the ingest's explicit "do not answer this one"
 *
 * Takes the ingest EVENT, not the stored row, so it can be evaluated in the
 * same expression that builds the create payload.
 */
export function owesAiTurn(event) {
  return (
    event?.direction === "in" &&
    event?.imported !== true &&
    event?.noAutoReply !== true
  );
}

/**
 * How long a message must sit before the sweeper will touch it.
 *
 * Long enough that a turn still running in the webhook is never raced: the
 * burst gate alone can hold for 6s (lib/aiEmployee/routing.js) and the model
 * calls follow it. Two minutes is far past any turn that is still alive and
 * far short of a homeowner giving up.
 */
export const AI_TURN_GRACE_MS = 2 * 60 * 1000;

/** The sweeper's cutoff, as a Date. */
export function aiTurnCutoff(now = new Date()) {
  return new Date(now.getTime() - AI_TURN_GRACE_MS);
}
