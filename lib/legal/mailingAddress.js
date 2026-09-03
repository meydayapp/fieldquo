// lib/legal/mailingAddress.js
//
// FieldQuo's own postal address, for the footer CASL requires on every
// commercial electronic message it sends.
//
// ══ Why it moved out of lib/sales/outreachSender.js ════════════════════════
//
// It lived there because a rep's outreach email was the only thing that needed
// it. A second commercial message now exists — the abandoned-signup recovery
// letter (lib/signup/abandoned.js) — and it is sent by a CRON, which
// scripts/check-sales-outreach.mjs deliberately forbids from importing
// anything under lib/sales/outreach*. That rule is right and should stay: a
// scheduler reaching the rep-outreach machinery is a product decision with its
// own consent posture, not a quiet import.
//
// The alternative was to read the env var in both places. That is the
// copy-paste duplication AGENTS.md lists as failure class #4, and on this
// particular value the copy would rot in the worst direction — one sender
// blocking on a missing address and the other quietly shipping without one.
//
// It sits beside lib/legal/privacyOfficer.js because it is the same kind of
// thing: a legally required detail FieldQuo has to state, with no default.
//
// ══ No default, ever ══════════════════════════════════════════════════════
//
// An empty string, which every caller must refuse to send on. A plausible
// placeholder would be worse than nothing: unlike a web page, an email with a
// fictional address in its footer has already been delivered to a stranger by
// the time anybody notices.

/** FieldQuo's mailing address, or "" when nobody has set one. */
export function mailingAddress() {
  return process.env.SALES_MAILING_ADDRESS || "";
}
