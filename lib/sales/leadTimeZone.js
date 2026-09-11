// lib/sales/leadTimeZone.js
//
// Where a lead's clock comes from, for TEXTING — one answer the call path
// already gives.
//
// ══ The duplicate the owner caught ═════════════════════════════════════════
//
// On one lead screen, the same afternoon, the call region said "Judged in the
// time zone their address implies (America/New_York)" and, three cards down,
// the texting panel said "We don't know what time it is where this prospect
// is." Same lead, same province, two rules. The call path asks
// lib/sales/callingRules.js `zonesFor({country, province})`; the text path
// only honoured a zone a rep had TYPED, and refused otherwise — so a signup
// link to Amish Valley Sheds (NY, straight from discovery) was never sent, and
// the rep read "sign-up link sent" on the step list and believed it had been.
//
// ══ The rule, now shared ═══════════════════════════════════════════════════
//
//   stated  — a zone a rep wrote after speaking to them. Wins outright, for
//             the reason callingRules gives: a person who had them on the
//             phone outranks a subdivision lookup, and it is the only thing
//             that resolves a split state.
//   derived — the province/state maps to exactly ONE zone (New York, Ontario,
//             most of the map). Used, and SAID to be derived on the screen.
//   ambiguous — the subdivision spans several zones (Florida, Texas, BC…).
//             Nothing is picked. The screen asks, and lists the candidates,
//             which is more useful than "we don't know".
//   none    — no province anywhere. The screen asks.
//
// What is still never done: guessing from the AREA CODE. That is wrong for
// every ported mobile, and it was the one half of the old refusal that was
// right.
//
// The lead's own country/province beat the linked prospect's — the same
// precedence lib/sales/leadDial.js `leadCallingContext` uses, for the same
// reason (the rep is closer to the fact than a directory row).
//
// Pure. Executed by scripts/check-sales-sms.mjs.
import { zonesFor } from "@/lib/sales/callingRules";
import { localTimeIn } from "@/lib/sales/callingWindow";

/**
 * @param lead  `{ timeZone, country, province, prospect?: { country, province } }`
 * @returns `{ timeZone: string|null, source: "stated"|"derived"|"ambiguous"|null, candidates: string[] }`
 */
export function resolveLeadTimeZone(lead = {}) {
  const typed = typeof lead?.timeZone === "string" ? lead.timeZone.trim() : "";
  // A stated zone Intl cannot read is not a zone; fall through to derivation
  // rather than trusting a typo over a working province.
  if (typed && localTimeIn(typed, new Date())) {
    return { timeZone: typed, source: "stated", candidates: [typed] };
  }
  const country = lead?.country || lead?.prospect?.country || null;
  const province = lead?.province || lead?.prospect?.province || null;
  const zones = zonesFor({ country, province });
  if (zones.length === 1) return { timeZone: zones[0], source: "derived", candidates: zones };
  if (zones.length > 1) return { timeZone: null, source: "ambiguous", candidates: zones };
  return { timeZone: null, source: null, candidates: [] };
}
