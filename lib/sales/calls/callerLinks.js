// lib/sales/calls/callerLinks.js
//
// Where the incoming-call dialog may point the rep, decided once, on the
// server, from rows the caller has already read.
//
// ══ Why a pure function and not two lines in the route ═══════════════════
//
// The owner's ask (2026-09-17): beside Pick up and Decline, "Open the
// company" and "Notes" — links that work while the phone rings and after
// it is picked up — and, when the number matches nothing, "Save as a new
// lead" with the number filled in. The interesting cases are exactly the
// ones a route handler hides: the claim lapsed an hour ago, the prospect
// was merged into a survivor, two reps hold a lead on the same number, the
// lead is somebody else's, the caller withheld their number. Taking rows
// rather than querying means every one of those is EXECUTED by
// scripts/check-sales-mobile.mjs rather than reasoned about.
//
// ══ A rep is only ever pointed at what they may open ══════════════════════
//
// The console lists a rep's OWN live claims (queueWhere: assignedRepId is
// them, not merged, claim not lapsed) and /api/sales/queue?prospectId=
// answers inside that same WHERE — so a console link is offered ONLY when
// the prospect would load there. The lead page is leadWhere(rep.id, id) —
// the rep's own SalesLead — so a lead link is offered ONLY for a lead they
// typed in. A business held by another rep gets its name and "held by
// <rep>" (the route's `holder`) and NO link: a link that opened a 404, or
// worse a colleague's row, is the dead-control class AGENTS.md leads with.
//
// Nothing here is authority. The pages these hrefs open re-check scope on
// their own reads; this only decides whether to DRAW the link.
//
// ══ The three shapes ══════════════════════════════════════════════════════
//
//   { open: { kind: "console", href }, notes: { href }, save: null }
//     — the rep holds the claim: the queue card, and its Notes tab.
//   { open: { kind: "lead", href },    notes: { href }, save: null }
//     — the rep's own lead: the lead page, and its notes block.
//   { open: null, notes: null, save: { href } }
//     — a number that matched nobody: the new-lead form, number filled in.
//   { open: null, notes: null, save: null }
//     — held by somebody else, ambiguous, or no number at all.

import { MATCH_LEAD, MATCH_NONE, MATCH_PROSPECT } from "./inboundMatch";

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

/**
 * Whether this rep could open the prospect on the console right now —
 * the same three terms as queueWhere(), evaluated on the row in hand.
 */
export function holdsLiveClaim(prospect, repId, now = new Date()) {
  if (!prospect || !repId) return false;
  if (prospect.assignedRepId !== repId) return false;
  if (prospect.mergedIntoId) return false;
  const until = prospect.claimExpiresAt ? new Date(prospect.claimExpiresAt) : null;
  if (until && !Number.isNaN(until.getTime()) && until.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * @param match      matchInboundCaller()'s answer.
 * @param prospects  the Prospect rows the route read for this number
 *                   (id, businessName, assignedRepId, mergedIntoId, claimExpiresAt, city, province).
 * @param leads      the SalesLead rows (id, businessName, salesRepId, prospectId, province).
 * @param repId      the rep asking.
 * @param now        for the claim's expiry.
 */
export function callerLinks({ match, prospects = [], leads = [], repId = null, now = new Date() } = {}) {
  const none = { open: null, notes: null, save: null, city: null, province: null };
  if (!match || !repId) return none;
  const rows = Array.isArray(prospects) ? prospects.filter((r) => r && r.id) : [];
  const leadRows = Array.isArray(leads) ? leads.filter((r) => r && r.id) : [];
  // The rep's own lead on this number, when there is exactly one. Two of
  // their own on one number is the ambiguity the matcher refuses to pick
  // through, and so does this.
  const mine = leadRows.filter((l) => l.salesRepId === repId);
  const myLead = mine.length === 1 ? mine[0] : null;

  if (match.outcome === MATCH_PROSPECT) {
    const prospect = rows.find((r) => r.id === match.prospectId) || null;
    const place = { city: prospect?.city || null, province: prospect?.province || myLead?.province || null };
    if (holdsLiveClaim(prospect, repId, now)) {
      return {
        ...place,
        open: { kind: "console", href: consoleHref(prospect.id) },
        notes: { href: consoleHref(prospect.id, "notes") },
        save: null,
      };
    }
    // Not theirs on the console — but a lead they typed in on this number
    // is still theirs to open.
    if (myLead) {
      return {
        ...place,
        open: { kind: "lead", href: leadHref(myLead.id) },
        notes: { href: leadHref(myLead.id, "lead-notes") },
        save: null,
      };
    }
    return { ...place, open: null, notes: null, save: null };
  }

  if (match.outcome === MATCH_LEAD) {
    const lead = leadRows.find((r) => r.id === match.salesLeadId) || null;
    const place = { city: null, province: lead?.province || null };
    if (lead && lead.salesRepId === repId) {
      return {
        ...place,
        open: { kind: "lead", href: leadHref(lead.id) },
        notes: { href: leadHref(lead.id, "lead-notes") },
        save: null,
      };
    }
    return { ...place, open: null, notes: null, save: null };
  }

  if (match.outcome === MATCH_NONE && match.phone) {
    return { ...none, save: { href: newLeadHref(match.phone) } };
  }

  // unknown (no number), ambiguous (the matcher would not pick): nothing.
  return none;
}
