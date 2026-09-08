// lib/aiEmployee/decide.js
//
// Should the AI employee answer this message at all?
//
// ══ Why this is a pure function in its own file ════════════════════════════
//
// Twelve guards decide it, and every one of them is a way for the product to
// message a stranger in a contractor's name when it should not have. Written
// inline in lib/aiEmployee/respond.js they would be twelve `if` statements
// interleaved with database reads and a model call — unrunnable by a check,
// and impossible to enumerate. lib/messaging/composerState.js made the same
// move for the same reason and says so: the claim a check most needs to
// execute cannot live inside something it cannot call.
//
// So: this file takes FACTS and returns a VERDICT. It reads nothing, writes
// nothing, and never awaits. scripts/check-ai-employee.mjs walks every guard
// through it, which is the only way "the employee stops when the credit runs
// out" is a fact rather than a memory.
//
// ══ The order is load-bearing ══════════════════════════════════════════════
//
// Cheapest and most absolute first, and — where two are both true — the one
// the contractor most needs to hear about. A thread that is BOTH over its
// reply cap AND out of credit reports the credit, because one of those is a
// setting they chose and the other is a bill they need to pay.

import { openState } from "@/lib/company/businessHours";
import { readStatus } from "@/lib/messaging/outcomes";
import { roleFor } from "./roles";

/**
 * Every reason a reply does not happen. Keys, not sentences: the settings
 * screen translates them and AiEmployeeReply.suppressedReason stores them.
 *
 * `null` is the only value that means "reply".
 */
export const SKIP = Object.freeze({
  NO_EMPLOYEE: "no_employee",
  DISABLED: "disabled",
  AI_UNAVAILABLE: "ai_unavailable",
  NOT_INBOUND: "not_inbound",
  EMPTY_MESSAGE: "empty_message",
  THREAD_CLOSED: "thread_closed",
  HANDED_OFF: "handed_off",
  HUMAN_REPLIED: "human_replied",
  CAP_REACHED: "cap_reached",
  OUTSIDE_HOURS: "outside_hours",
  NO_CREDIT: "no_credit",
  // WhatsApp only. The employee may not send free text more than 24 hours
  // after the customer last wrote — see lib/messaging/serviceWindow.js. It is
  // a SKIP and not a send failure on purpose: a refusal recorded here is a
  // draft that waits for a person, where a failed send would be a model call
  // billed for a message Meta was always going to refuse.
  OUTSIDE_SERVICE_WINDOW: "outside_service_window",
});

/** Every reason, for the check's key coverage and for the screen's legend. */
export const SKIP_REASONS = Object.freeze(Object.values(SKIP));

/**
 * The two modes, and the fact that one of them is the default.
 *
 * Read from `autoReplyEnabled === true` rather than from truthiness. A row
 * where the column is null — every row written before the switch was ever
 * touched, and every row a migration creates — must be SUGGEST, and `null` is
 * falsy but a `Boolean(null)` conversion elsewhere is one refactor away from
 * becoming `!== false`. Stating the comparison here, once, is the difference
 * between a default and an accident.
 */
export const MODE_SUGGEST = "suggest";
export const MODE_AUTO = "auto";

export function sendMode(employee) {
  return employee?.autoReplyEnabled === true ? MODE_AUTO : MODE_SUGGEST;
}

/**
 * Should this message get a reply, and if so, sent or suggested?
 *
 * Every argument is a FACT the caller has already established. Nothing here
 * infers one: `humanReplied` is not guessed from a message count, and
 * `repliesSoFar` is not guessed from the thread length. An inferred guard is a
 * guard that is wrong in exactly the case nobody tested.
 *
 * @param employee      the AiEmployee row, or null when a company has none.
 * @param businessHoursOpen  true | false | null — the answer withinBusinessHours()
 *                      gave for this company, passed IN rather than computed
 *                      here. openState() reads the real clock and cannot be
 *                      given a time, so computing it inside this function would
 *                      make one guard untestable and quietly turn this from a
 *                      pure function into one that depends on when it runs.
 *                      null means the company has recorded no hours.
 * @param thread        { status } — MessageThread.status, read through
 *                      lib/messaging/outcomes.js's readStatus rather than
 *                      compared raw. See the guard below.
 * @param message       { direction, body } — the message being answered.
 * @param quota         the object lib/ai/usage.js's checkAiQuota returned.
 * @param aiConfigured  isAiConfigured() from lib/ai/provider.js.
 * @param humanReplied  has a PERSON at the company written on this thread
 *                      since this inbound message arrived?
 * @param handedOff     has the employee already fetched a person for this
 *                      thread? Once true it is permanent for the thread.
 * @param repliesSoFar  how many replies this employee has already produced on
 *                      this thread.
 * @param serviceWindowOpen  may free text be sent on this thread's platform
 *                      right now? The answer lib/messaging/serviceWindow.js
 *                      gave, passed IN for the same reason businessHoursOpen
 *                      is: it depends on the clock, and computing it inside
 *                      this function would make one guard untestable and turn
 *                      a pure function into one whose verdict depends on when
 *                      it runs. TRUE is the default because two of the three
 *                      platforms have no window of ours — a Facebook thread
 *                      must not be silenced by a WhatsApp rule.
 *
 * @returns {{ reply: boolean, reason: string|null, mode: string }}
 *          `mode` is meaningful only when reply is true; it is still returned
 *          on a refusal so a caller can log what WOULD have happened.
 */
export function shouldReply({
  employee = null,
  businessHoursOpen = null,
  thread = null,
  message = null,
  quota = null,
  aiConfigured = true,
  humanReplied = false,
  handedOff = false,
  repliesSoFar = 0,
  serviceWindowOpen = true,
} = {}) {
  const mode = sendMode(employee);
  const no = (reason) => ({ reply: false, reason, mode });

  if (!employee) return no(SKIP.NO_EMPLOYEE);
  if (employee.enabled !== true) return no(SKIP.DISABLED);

  // ── Credit, checked before anything the contractor can fix ─────────────
  //
  // Placed above the cap and the hours deliberately. All three stop the
  // employee, but only this one is a state the contractor cannot reason about
  // from the settings screen — and it is the one that has to be LOUD. A silent
  // out-of-credit stop looks exactly like the feature being broken, which is
  // the failure this whole file is arranged around: the caller writes an
  // AiEmployeeReply carrying this reason and flags the thread for a person.
  if (quota && quota.allowed === false) return no(SKIP.NO_CREDIT);

  // No vendor key on this deployment. Distinct from no credit, because the
  // answers differ: one is "top up", the other is "this is ours to fix".
  if (!aiConfigured) return no(SKIP.AI_UNAVAILABLE);

  // Only an inbound message gets answered. Guarding it here rather than at the
  // call site because the employee's OWN outbound message is also a Message
  // row, and an employee that answered itself is the runaway the reply cap
  // exists to bound — better to make it impossible than to bound it.
  if (message?.direction !== "in") return no(SKIP.NOT_INBOUND);
  if (!String(message?.body || "").trim()) return no(SKIP.EMPTY_MESSAGE);

  // ── Read through the messaging feature's own normaliser ────────────────
  //
  // readStatus() maps the legacy "closed" onto "resolved" and lands anything
  // unrecognised on "open". Comparing raw strings here would mean this file
  // held a second, older copy of that vocabulary — and the copy that rots is
  // the one that silently starts answering resolved threads on the day a
  // fifth state is added.
  //
  // "resolved" is finished. "snoozed" and "pending" are NOT: somebody deferred
  // or parked the thread, which is a decision an employee that answered anyway
  // would undo.
  const status = readStatus(thread?.status);
  if (status === "resolved" || status === "snoozed" || status === "pending") {
    return no(SKIP.THREAD_CLOSED);
  }

  // Permanent for the thread, by design. An employee that handed off and then
  // resumed two messages later has un-handed-off, and the homeowner has been
  // told a person is coming.
  if (handedOff) return no(SKIP.HANDED_OFF);

  // A person is already on it. This is the guard that stops the employee
  // talking over the contractor, and it is why the caller must establish
  // "since this message" rather than "ever": a thread where somebody replied
  // last March is not a thread somebody is handling now.
  if (humanReplied) return no(SKIP.HUMAN_REPLIED);

  // 0 is a legitimate value and means "never reply" — a way to pause without
  // losing the configuration. Anything not a finite number is treated as 0
  // rather than as unlimited: a corrupt cap must fail towards silence.
  const cap = Number.isFinite(Number(employee.maxRepliesPerThread))
    ? Number(employee.maxRepliesPerThread)
    : 0;
  if (repliesSoFar >= cap) return no(SKIP.CAP_REACHED);

  // ── A company that saved no hours is IN hours, never out of them ───────
  //
  // withinBusinessHours returns null for absent or malformed hours. Reading
  // that null as "closed" would silence the employee for every company that
  // has never opened the opening-hours editor — inventing a statement out of a
  // silence, which is AGENTS.md failure class 5 with the sign flipped. The
  // contractor asked for "only during business hours"; a company with no
  // business hours recorded has not told us any hours to be outside of. So
  // only an explicit `false` stops it.
  if (employee.businessHoursOnly === true && businessHoursOpen === false) {
    return no(SKIP.OUTSIDE_HOURS);
  }

  // ── LAST, and absolute ──────────────────────────────────────────────────
  //
  // WhatsApp's 24-hour customer service window. Placed at the end because
  // every guard above it is a decision somebody made — a setting, a cap, a
  // status — and this one is a rule of Meta's that no setting can override.
  // A reply composed past it would be a model call billed for a message
  // WhatsApp was always going to refuse (error 131047), so it is stopped
  // BEFORE the call rather than failing at the send.
  //
  // Explicit `=== false`, matching the business-hours guard above it: `null`
  // or `undefined` here means "nobody computed a window", which happens on
  // every Facebook and Instagram thread, and reading that as closed would
  // silence the employee on two platforms that never had this rule.
  //
  // The employee has no template path. That is deliberate and is the honest
  // limit: an approved template is a business-initiated message with money and
  // a policy attached, and choosing to send one is a decision for a person.
  if (serviceWindowOpen === false) return no(SKIP.OUTSIDE_SERVICE_WINDOW);

  return { reply: true, reason: null, mode };
}

/**
 * The tools this employee may call on this reply.
 *
 * Thin, and that is the point: it is the ONE place respond.js asks the
 * question, and it asks the role rather than the row. A per-employee tool
 * override would be a way to hand a pricing tool to a receptionist from a
 * settings screen, which is exactly what roles.js's header argues against.
 */
export function toolsFor(employee) {
  return roleFor(employee?.role).allowed.slice();
}

/**
 * Does the current time fall inside this company's own opening hours?
 *
 * Exported separately from shouldReply so the settings screen can show the
 * contractor what "business hours only" would mean for them RIGHT NOW —
 * a switch whose effect nobody can see is a switch nobody can check.
 *
 * @returns true | false | null (null = the company has recorded no hours)
 */
export function withinBusinessHours(company) {
  const state = openState(company?.businessHours, company?.timezone || undefined);
  if (!state) return null;
  return state.open === true;
}
