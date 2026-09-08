// lib/messaging/activity.js
//
// The system lines that run down the middle of a conversation.
//
// ══ What this is for ═══════════════════════════════════════════════════════
//
// Taken from Chatwoot's `message_type: activity`, and taken for the reason
// their inbox is legible and ours was not: the interesting part of a lead is
// not the words, it is the SHAPE — she wrote on Tuesday, Dave answered in
// eleven minutes, a quote went out on Wednesday, it became a job on Friday.
// With the quote and the job living on other screens, the conversation read as
// five sentences and a dropdown, and the month-end review had to be believed
// rather than seen. An activity row puts each of those events in the one
// column, in order, where anybody can read the story back.
//
// ══ Structured, never a rendered sentence ══════════════════════════════════
//
// Chatwoot stores the finished sentence in `content` — it can, because a
// Chatwoot account has one locale. FieldQuo is read in nine, by employees of
// the SAME company: a note written while the app was in French must not read
// as French to the next person, and a stored English sentence cannot be
// translated later without lying about what was written. So the row stores
// { type, ... } and this file turns it into an i18n key and parameters at
// render time.
//
// Nothing here writes a sentence, and nothing here invents a fact. An activity
// whose type this file does not recognise renders as NOTHING rather than as a
// guess — a row from a future version of the app should be silent, not wrong.
//
// Pure except for writeActivity() at the bottom, so the mapping is executed by
// scripts/check-messaging.mjs rather than eyeballed.

import { activityRowFields, } from "./messageKinds";
import { outcomeLabelKey } from "./outcomes";

/**
 * Every activity a thread can record. A closed list for the same reason
 * THREAD_OUTCOMES is one: an open-ended `type` ends up holding "assigned",
 * "Assigned" and "assign" and cannot be rendered, counted, or filtered.
 */
export const ACTIVITY_TYPES = Object.freeze([
  // The four-state status moved. `to` carries the new one.
  "status_changed",
  // Somebody judged the conversation, or un-judged it.
  "outcome_set",
  "outcome_cleared",
  // Somebody took it, or handed it back.
  "assigned",
  "unassigned",
  // A quote, job, client or lead was attached — the line that makes the
  // month-end read a story instead of a table.
  "linked",
  "unlinked",
  // Parked until a date, and returned when that date arrived. The second one
  // is written by /api/cron/messaging-snooze and by nothing else: it is the
  // proof, in the thread itself, that the snooze actually came back.
  "snoozed",
  "unsnoozed",
]);

/** What `linked`/`unlinked` may name. Mirrors the four link columns. */
export const LINK_KINDS = Object.freeze(["client", "lead", "job", "quote"]);

/**
 * Build the JSON an activity row carries.
 *
 * `by` is the actor's NAME, captured at the moment it happened. Storing the
 * name and not only the id is deliberate: this is a historical record, and a
 * person who later leaves the company still assigned the thread that Tuesday.
 * Null when a machine did it (the snooze cron), which the renderer says out
 * loud rather than attributing to nobody in particular.
 */
export function buildActivity(type, fields = {}) {
  if (!ACTIVITY_TYPES.includes(type)) return null;
  const activity = { type };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    activity[key] = value;
  }
  return activity;
}

/**
 * An activity row's i18n key and parameters, or null when there is nothing
 * honest to print.
 *
 * @returns {{ key: string, params: object }|null}
 */
export function activityLabel(activity) {
  if (!activity || typeof activity !== "object") return null;
  const by = typeof activity.by === "string" && activity.by.trim() ? activity.by.trim() : null;
  // The suffix that decides whether the sentence names a person. Two keys per
  // event rather than a "System" placeholder name: "Snoozed by System" reads
  // as a colleague nobody has met, and the cron is not a colleague.
  const who = by ? "By" : "Auto";

  switch (activity.type) {
    case "status_changed": {
      // The new state IS the sentence — "Marked resolved", "Reopened". A
      // key per state, so each language can phrase its own verb.
      const to = activity.to;
      if (!["open", "pending", "snoozed", "resolved"].includes(to)) return null;
      return { key: `app.messages.activity.status.${to}${who}`, params: by ? { name: by } : {} };
    }
    case "outcome_set": {
      if (!activity.outcome) return null;
      return {
        key: `app.messages.activity.outcomeSet${who}`,
        params: { outcome: activity.outcome, ...(by ? { name: by } : {}) },
      };
    }
    case "outcome_cleared":
      return { key: `app.messages.activity.outcomeCleared${who}`, params: by ? { name: by } : {} };
    case "assigned": {
      const to = typeof activity.to === "string" && activity.to.trim() ? activity.to.trim() : null;
      if (!to) return null;
      return {
        key: `app.messages.activity.assigned${who}`,
        params: { assignee: to, ...(by ? { name: by } : {}) },
      };
    }
    case "unassigned":
      return { key: `app.messages.activity.unassigned${who}`, params: by ? { name: by } : {} };
    case "linked": {
      if (!LINK_KINDS.includes(activity.kind)) return null;
      return {
        key: `app.messages.activity.linked${who}`,
        params: { kind: activity.kind, ...(by ? { name: by } : {}) },
      };
    }
    case "unlinked": {
      if (!LINK_KINDS.includes(activity.kind)) return null;
      return {
        key: `app.messages.activity.unlinked${who}`,
        params: { kind: activity.kind, ...(by ? { name: by } : {}) },
      };
    }
    case "snoozed":
      return { key: `app.messages.activity.snoozed${who}`, params: by ? { name: by } : {} };
    case "unsnoozed":
      // Written by the cron, so there is nobody to name and the `who` suffix
      // above resolves to Auto on its own.
      return { key: `app.messages.activity.unsnoozed${who}`, params: by ? { name: by } : {} };
    default:
      // A type this version does not know. Silent, not guessed.
      return null;
  }
}

/**
 * The `data` for one activity Message row.
 *
 * `body` is left empty on purpose. It is the customer-visible text column, an
 * activity has none, and putting an English summary there would be the second
 * copy of the sentence this file exists to avoid — the copy nobody updates.
 * The inbox preview reads only "in"/"out" rows for exactly that reason.
 *
 * externalId carries a "local:" prefix like every other row that never came
 * from Meta, so @@unique([threadId, externalId]) still holds and a log line
 * says on sight that Meta never saw it.
 */
export function activityRowData({ threadId, activity, at = new Date() }) {
  if (!activity) return null;
  return {
    threadId,
    ...activityRowFields(),
    externalId: `local:activity:${crypto.randomUUID()}`,
    body: "",
    activity,
    sentAt: at,
  };
}

/**
 * Write one activity row.
 *
 * Takes a Prisma client OR a transaction, like lib/quotes/quoteNumber.js's
 * allocator, so a caller that is changing the thread can put the record of the
 * change in the SAME transaction as the change. A status that moved with no
 * line saying so is a worse record than no line at all: it makes the column
 * look complete.
 *
 * Never throws for an unknown type — it returns null, having written nothing.
 * A route that fails because it tried to log something is a route that refuses
 * a legitimate edit for a cosmetic reason.
 */
export async function writeActivity(tx, { threadId, type, at, ...fields }) {
  const activity = buildActivity(type, fields);
  const data = activityRowData({ threadId, activity, at });
  if (!data) return null;
  return tx.message.create({ data });
}
