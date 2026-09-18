// lib/sales/calls/callerHrefs.js
//
// The three places a caller's number can send a rep — pure string builders,
// in a file that imports NOTHING.
//
// They lived in callerLinks.js, which is the right home for the decision
// (whose number, which link). But that file reaches lib/sales/calls/
// inboundMatch.js → suppressionRules.js → lib/voice/numbers.js → lib/db.js,
// and a client component that imports it drags `pg` into the browser
// bundle. The texts screen needs newLeadHref for its "Save as a new lead"
// press (a thread on nobody's lead), and a second copy of the href is the
// copy that rots when the leads page's query string changes — so the
// builders moved here and callerLinks.js re-exports them, byte-identical
// to every caller it had.
//
// scripts/check-sales-messages.mjs holds the texts screen to importing from
// HERE and never from callerLinks.

/** The console, on this prospect. `tab` is one of the console's PANEL_TABS keys. */
export function consoleHref(prospectId, tab = null) {
  const sp = new URLSearchParams();
  sp.set("prospectId", prospectId);
  if (tab) sp.set("tab", tab);
  return `/sales/queue?${sp.toString()}`;
}

/** The lead page; `#lead-notes` is the id on its notes block. */
export function leadHref(salesLeadId, section = null) {
  return `/sales/leads/${encodeURIComponent(salesLeadId)}${section ? `#${section}` : ""}`;
}

/** The leads screen with the add form open and the number filled in. */
export function newLeadHref(phoneE164) {
  const sp = new URLSearchParams();
  sp.set("new", "1");
  if (phoneE164) sp.set("phone", phoneE164);
  return `/sales/leads?${sp.toString()}`;
}
