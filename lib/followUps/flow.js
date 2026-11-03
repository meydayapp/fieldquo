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

import { TRIGGER_META, followUpChannel } from "@/lib/followUps/triggers";

// Message keys, not English. The diagram translates them; keeping them as
// literals in one place means scripts/check-translations.mjs — which scans for
// "app.*" string literals and is blind to computed keys — can still see them.
export const TRIGGER_LABEL_KEYS = {
  lead_no_response: "app.followFlow.triggerLeadNoResponse",
  quote_no_response: "app.followFlow.triggerQuoteNoResponse",
  invoice_overdue: "app.followFlow.triggerInvoiceOverdue",
  job_completed: "app.followFlow.triggerJobCompleted",
};

// The dropdown's helper sentence per trigger. TRIGGER_META.description is the
// English seed; these are what a screen prints.
export const TRIGGER_DESCRIPTION_KEYS = {
  lead_no_response: "app.followFlow.descLeadNoResponse",
  quote_no_response: "app.followFlow.descQuoteNoResponse",
  invoice_overdue: "app.followFlow.descInvoiceOverdue",
  job_completed: "app.followFlow.descJobCompleted",
};

// Shared with the LIST on the settings page, which prints the same sentence in
// words. That is what makes aria-hidden on the diagram honest: nothing is
// readable only as a picture.
export const STOP_KEYS = {
  lead_answered: "app.followFlow.stopLeadAnswered",
  quote_answered: "app.followFlow.stopQuoteAnswered",
  invoice_paid: "app.followFlow.stopInvoicePaid",
  job_reopened: "app.followFlow.stopJobReopened",
};

// ── The channel each step sends by ─────────────────────────────────────────
//
// The diagram drew `FOLLOW_UP_CHANNEL === "email" ? t(...) : FOLLOW_UP_CHANNEL`
// — a one-sided conditional whose else branch would have printed the raw word
// "sms" at a user, left behind by the single-channel constant it read. Now
// each step answers for itself, from FollowUpRule.channel through
// followUpChannel(), which treats anything it does not recognise as email
// exactly as the cron does. So a step cannot be drawn as a text that the cron
// then sends as an email, or the reverse.
export const CHANNEL_KEYS = {
  email: "app.followFlow.sendEmail",
  sms: "app.followFlow.sendSms",
};

/** The message key for the channel a rule sends by. Never null. */
export function channelKeyFor(rule) {
  return CHANNEL_KEYS[followUpChannel(rule)] || CHANNEL_KEYS.email;
}

// The same two channels as a NOUN, for the dropdown on the settings page.
// Kept beside CHANNEL_KEYS rather than derived from it because they are
// genuinely two different strings — the diagram draws a sentence ("Send a
// text") and a picker labelled "Send by" needs the thing, not the act — and
// keeping them in one module is what lets scripts/check-follow-up-sms.mjs
// assert both exist in every language.
export const CHANNEL_OPTION_KEYS = {
  email: "app.setFollowUps.channelEmail",
  sms: "app.setFollowUps.channelSms",
};

// Which recipients a channel silently has none of — the footnote under the
// diagram. Two channels, two different "skipped" sentences: a client with an
// email and no mobile is skipped by an SMS step and not by an email one, and
// one footnote covering both would be wrong for whichever the company is
// actually using.
export const SKIPPED_KEYS = {
  email: "app.followFlow.noEmailNote",
  sms: "app.followFlow.noPhoneNote",
};

/**
 * The channels these flows actually use, in CHANNEL_KEYS order.
 *
 * So the footnotes under the diagram describe the rules on screen rather than
 * every channel that exists — a company with no SMS rule is not told about
 * mobile numbers it does not need.
 */
export function channelsIn(flows) {
  const used = new Set();
  for (const flow of Array.isArray(flows) ? flows : []) {
    for (const step of flow?.steps || []) used.add(followUpChannel(step));
  }
  return Object.keys(CHANNEL_KEYS).filter((c) => used.has(c));
}

export const ONCE_KEYS = {
  lead: "app.followFlow.onceLead",
  quote: "app.followFlow.onceQuote",
  invoice: "app.followFlow.onceInvoice",
  job: "app.followFlow.onceJob",
};

// A UNIT_KEYS map used to sit here, pairing a delayUnit with a bare plural
// noun ("app.time.days"). It moved to lib/i18n/duration.js as part of
// formatDuration(): the delay is a count agreeing with a noun in six
// languages, not a key lookup, and the settings list has to print exactly the
// phrase the diagram draws.

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
