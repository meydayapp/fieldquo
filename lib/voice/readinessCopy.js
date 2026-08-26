// lib/voice/readinessCopy.js
//
// What the settings screen SAYS about each link in the receptionist chain.
//
// Split from lib/voice/readiness.js for the same reason diagnosisCopy.js is
// split from diagnose.js: readiness.js imports the database and the provider
// client, so a client component importing it would drag Prisma into the browser
// bundle. This file is pure data — no React, no imports, no environment reads —
// so the page, the resolver and the check script can all share one table.
//
// The strings here are the per-key ENGLISH FALLBACK. app/i18n/appMessages.js
// carries the real catalogue under the same keys.
//
// ── Written for the person who has to act ──────────────────────────────────
//
// Not "unbound", not "404", not "webhook_url mismatch". Every sentence has to
// survive being read on a phone, in a driveway, by somebody who wants to know
// whether their calls are covered. Where a link is broken it says what broke
// AND who can put it right, because "something is wrong" sends them to email us
// about things they could have fixed in ten seconds.

/**
 * The chain, in the order a call travels it.
 *
 * The page renders in this order and the check script asserts over it — a link
 * the resolver can emit but the page cannot draw is a link nobody sees fail.
 */
export const READINESS_LINKS = [
  "provider",
  "number",
  "agent",
  "engine",
  "binding",
  "switch",
  "webhook",
  "prompt",
  "events",
  "forwarding",
];

/**
 * Reasons that mean the same thing on more than one link.
 *
 * One key rather than one per link: "we couldn't check" reads identically
 * wherever it appears, and six translations of the same sentence is six places
 * for it to drift.
 */
export const SHARED_REASON_KEYS = {
  unchecked: "app.setVoice.chain.unchecked",
  voice_off: "app.setVoice.chain.voiceOff",
  no_credit: "app.setVoice.chain.noCredit",
};

/** The i18n key for one link's reason. */
export function reasonKeyFor(id, reason) {
  return SHARED_REASON_KEYS[reason] || `app.setVoice.chain.${id}.${reason}`;
}

/** The i18n key for a link's name. */
export const linkLabelKey = (id) => `app.setVoice.chain.label.${id}`;
/** The i18n key for "whose end is this". */
export const ownerKey = (owner) => `app.setVoice.chain.owner.${owner}`;
/** The i18n key for the one-line summary. */
export const overallKey = (overall) => `app.setVoice.chain.overall.${overall}`;

/** Short name for each link, as a heading beside a tick or a cross. */
export const LINK_LABEL = {
  provider: "The phone service",
  number: "Your number",
  agent: "The receptionist itself",
  engine: "What it knows",
  binding: "The number answers with it",
  switch: "Switched on and funded",
  webhook: "Call results reach FieldQuo",
  prompt: "It's running your latest wording",
  events: "Calls are being recorded",
  forwarding: "Your carrier forwarding",
};

/**
 * One sentence per outcome, keyed exactly as reasonKeyFor builds it.
 *
 * A link with no sentence renders a blank row, and a link with the WRONG
 * sentence is worse than no check at all — so the check script asserts that
 * every reason the resolver can produce has an entry here.
 */
export const REASON_TEXT = {
  "app.setVoice.chain.unchecked":
    "We couldn't check this one. Nothing is claimed either way.",
  "app.setVoice.chain.voiceOff":
    "The receptionist is switched off, so nothing is set to answer. That's your own setting — turn it on below when you're ready.",
  "app.setVoice.chain.noCredit":
    "There isn't enough credit to take a call, so nothing will answer. Top up above.",

  "app.setVoice.chain.provider.not_configured":
    "FieldQuo isn't connected to a phone service on this deployment, so nothing below can work. This one is ours.",
  "app.setVoice.chain.provider.reachable": "We reached the phone service and it answered.",
  "app.setVoice.chain.provider.unreachable":
    "The phone service didn't answer us just now, so we can't tell you anything below without guessing. Try again in a minute.",

  "app.setVoice.chain.number.none":
    "You haven't set up a number yet — there's nothing for the receptionist to answer on.",
  "app.setVoice.chain.number.porting":
    "Your number is still moving over from your old provider. Nothing can answer on it until it lands.",
  "app.setVoice.chain.number.ours":
    "The phone service confirms this number is on FieldQuo's account and rented for you.",
  "app.setVoice.chain.number.not_ours":
    "The phone service has no such number on our account. The purchase never finished, so nothing is renting it and nothing can answer on it.",

  "app.setVoice.chain.agent.never_built":
    "No receptionist was ever built at the phone service for you, so a caller reaches nothing.",
  "app.setVoice.chain.agent.present": "Your receptionist exists at the phone service.",
  "app.setVoice.chain.agent.gone":
    "We're holding a receptionist the phone service has never heard of — it was deleted or never finished. Callers reach nothing.",

  "app.setVoice.chain.engine.never_built":
    "The receptionist's instructions were never created at the phone service.",
  "app.setVoice.chain.engine.gone":
    "The receptionist's instructions have gone missing at the phone service.",
  "app.setVoice.chain.engine.detached":
    "Your receptionist is reading a different set of instructions from the ones this page edits, so nothing you change here reaches a caller.",
  "app.setVoice.chain.engine.present":
    "The receptionist is reading the instructions this page edits.",

  "app.setVoice.chain.binding.attached":
    "The phone service confirms your number is answered by your receptionist.",
  "app.setVoice.chain.binding.bound_elsewhere":
    "Your number is answered by a different receptionist from yours. Callers are reaching the wrong one.",
  "app.setVoice.chain.binding.unbound":
    "Your number and your receptionist both exist, but the two were never connected, so calls ring out.",

  "app.setVoice.chain.switch.on": "It's switched on, funded, and live at the phone service.",
  "app.setVoice.chain.switch.not_live":
    "This page says it's switched on and the phone service says nothing is attached to your number. The switch didn't take.",

  "app.setVoice.chain.webhook.matches":
    "The phone service is set to send call results to this address, so calls get recorded here.",
  "app.setVoice.chain.webhook.missing":
    "The phone service has nowhere to send call results, so your calls are never recorded — no transcript, no lead, no charge, even though the phone answers perfectly.",
  "app.setVoice.chain.webhook.elsewhere":
    "The phone service is sending your call results to a different address from this one, so they never arrive. This is why calls can be answered and still leave no record.",
  "app.setVoice.chain.webhook.preview_origin":
    "You're looking at a temporary preview of FieldQuo, so we can't judge this — and fixing it from here would point your phone at an address that gets deleted. Open the app at its normal address to check it.",

  "app.setVoice.chain.prompt.in_step":
    "The wording the phone is running is the wording on this page.",
  "app.setVoice.chain.prompt.drifted":
    "The phone is running older instructions than the ones on this page — a save didn't reach it.",
  "app.setVoice.chain.prompt.greeting_drifted":
    "The greeting callers actually hear isn't the one on this page.",
  "app.setVoice.chain.prompt.tools_elsewhere":
    "The receptionist can talk, but it's been told to file callers' details at an address that no longer exists — so nothing it takes down is saved.",

  "app.setVoice.chain.events.landing":
    "Call results have reached FieldQuo, so the whole loop is closed.",
  "app.setVoice.chain.events.rejected":
    "The phone service has tried to send us call results and we turned them away, so nothing was recorded.",
  "app.setVoice.chain.events.none_yet":
    "Nobody has rung yet, so there's nothing to judge. Ring the number yourself and run this again.",

  "app.setVoice.chain.forwarding.uncheckable":
    "Forwarding lives inside your own phone carrier and no software of ours can see it. Ring the receptionist's own line directly to test it without forwarding in the way, then ring your business number to test the forward itself.",
};

/** Whose end a broken link is on. */
export const OWNER_TEXT = {
  fieldquo: "Ours to fix — the button below does it.",
  company: "Yours to change, and nothing is broken.",
  unknown: "We can't tell which end this is.",
};

/** The one line at the top of the panel. */
export const OVERALL_TEXT = {
  ready: "Every link checks out. Ring it and it will answer, and the call will be recorded.",
  ready_with_warnings:
    "The phone will answer, but something below still needs looking at.",
  not_ready: "It won't work as things stand. What's wrong is below, in order.",
  unsure:
    "We couldn't check the whole chain, so we're not going to tell you it works. What we could and couldn't see is below.",
};
