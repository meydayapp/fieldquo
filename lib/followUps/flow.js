// lib/followUps/flow.js
//
// Turns FollowUpRule rows into the shape the settings-page flow diagram draws.
//
// Deliberately separate from app/app/settings/follow-ups/FlowDiagram.js, which
// is a "use client" JSX file and therefore can't be imported by a plain-node
// check script. The derivation lives here so
// scripts/check-follow-up-flow.mjs can execute it against hostile rows — an
// unknown trigger, a null delay, a rule whose template was deleted — rather
// than someone reading the JSX and believing it.
//
// Nothing in here renders. It answers one question: given the rules a company
// saved, what does the cron actually do, in what order, and what stops it.

import { TRIGGER_META } from "@/lib/followUps/triggers";

// Message keys, not English. The diagram translates them; keeping them as
// literals in one place means scripts/check-translations.mjs — which scans for
// "app.*" string literals and is blind to computed keys — can still see them.
export const TRIGGER_LABEL_KEYS = {
  quote_no_response: "app.followFlow.triggerQuoteNoResponse",
  invoice_overdue: "app.followFlow.triggerInvoiceOverdue",
  job_completed: "app.followFlow.triggerJobCompleted",
};

// Shared with the LIST on the settings page, which prints the same sentence in
// words. That is what makes aria-hidden on the diagram honest: nothing is
// readable only as a picture.
export const STOP_KEYS = {
  quote_answered: "app.followFlow.stopQuoteAnswered",
  invoice_paid: "app.followFlow.stopInvoicePaid",
  job_reopened: "app.followFlow.stopJobReopened",
};

export const ONCE_KEYS = {
  quote: "app.followFlow.onceQuote",
  invoice: "app.followFlow.onceInvoice",
  job: "app.followFlow.onceJob",
};

export const UNIT_KEYS = { hours: "app.time.hours", days: "app.time.days" };

/**
 * A rule's delay in milliseconds, so two rules on one trigger stack in the
 * order they actually fire rather than the order they were created.
 *
 * Mirrors cutoffFor() in app/api/cron/follow-ups/route.js: anything that isn't
 * "hours" is treated as days there, so it is treated as days here too.
 */
export function delayMs(rule) {
  const value = Number(rule?.delayValue);
  if (!Number.isFinite(value)) return 0;
  return rule?.delayUnit === "hours" ? value * 3_600_000 : value * 86_400_000;
}

/**
 * Rules grouped into one flow per trigger, each ordered by when it fires.
 *
 * Returns [] for anything that isn't an array of rules — this is fed straight
 * from a fetch() response, and a failed load must render nothing rather than
 * throw inside a component.
 */
export function buildFlows(rules) {
  const groups = new Map();
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule?.id) continue;
    const key = rule.triggerEvent || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  return [...groups.entries()].map(([triggerEvent, groupRules]) => ({
    triggerEvent,
    // null for a trigger this build doesn't know — the cron's FINDERS lookup
    // would miss too, so the rule genuinely never runs and the diagram says so.
    meta: TRIGGER_META[triggerEvent] || null,
    steps: [...groupRules].sort((a, b) => delayMs(a) - delayMs(b)),
  }));
}

/** The two sentences describing when a rule stops chasing an entity. */
export function stopKeysFor(triggerEvent) {
  const meta = TRIGGER_META[triggerEvent];
  return {
    stopKey: STOP_KEYS[meta?.stopsWhen] || null,
    onceKey: ONCE_KEYS[meta?.entityType] || null,
  };
}
