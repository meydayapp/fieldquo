// lib/sales/playbook/approaches.js
//
// Which selling APPROACH a playbook key stands for — the one fact a client
// component needs to know about the Reverse Selling playbook without pulling
// its seed module (lib/sales/playbook/reverseSelling.js imports the referral
// policy, which imports the database and Stripe; none of that may reach a
// browser bundle).
//
// ══ Why a key and not a flag on the row ═══════════════════════════════════
//
// A boolean column would be a schema change for one playbook, and a playbook
// key is already stamped on every assignment and every talking point and can
// never change (app/api/platform/sales/playbooks/[key]/route.js refuses it).
// So the key IS the stable identity, and the approach is read off it. A
// superadmin who copies the script under another key has written a new
// playbook, and the screens treat it as one — the extra pieces that belong to
// this approach (the referral plant beside "stay on the line", the AI
// script's trial close) follow the key the owner switched on, not the words.
//
// Pure, import-free, safe anywhere.

/** The Reverse Selling playbook's key. Stored on rows: never rename it. */
export const REVERSE_SELLING_KEY = "REVERSE_SELLING";

/** The approach name the AI call script's inputs carry. In the hash only when set. */
export const REVERSE_SELLING_APPROACH = "reverse_selling";

/** True when this playbook key is the Reverse Selling playbook. */
export function isReverseSelling(playbookKey) {
  return typeof playbookKey === "string" && playbookKey === REVERSE_SELLING_KEY;
}

/** The approach a playbook key stands for, or null for every other playbook. */
export function approachForPlaybook(playbookKey) {
  return isReverseSelling(playbookKey) ? REVERSE_SELLING_APPROACH : null;
}
