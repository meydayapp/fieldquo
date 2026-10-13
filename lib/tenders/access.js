// lib/tenders/access.js
//
// Who may see a tender, change one, see the people on it, see its money,
// and turn it into a job. Five questions, each answered by a key the grid
// already has — no new permission category, because a tender is a quote's
// prospect: the bid IS a quote.
//
//   read      quotes ≥ view_only        — the same rung the quotes list asks
//   write     quotes ≥ view_create_edit — the same rung POST /api/quotes asks
//   contacts  clientsProperties ≥ full_view — the Contracting Authority's
//             name, email and phone are client contact data, the same level
//             GET /api/clients needs to show a client's email
//   money     the showPricing toggle — estimated value, bid security, the
//             winning price; a pricing-blind member sees the tender without
//             the figures, the way the quotes list redacts a total
//   convert   job:create + jobs ≥ view_create_edit — exactly POST /api/jobs
//
// The sidebar row (lib/permissions/nav.js "app.nav.tenders") is the read rung.
// scripts/check-tenders.mjs executes all five against every preset.
//
// Whether the company HAS tenders at all is a different axis — the `tenders`
// feature in lib/features/registry.js, hidden by default — and is enforced
// before any of this runs (lib/currentMember.js for /api/tenders,
// app/app/tenders/layout.js for the pages, the cron per company).
import { can } from "@/lib/permissions";
import { hasLevel, hasToggle } from "@/lib/permissions/enforce";

export const TENDER_READ = Object.freeze({ category: "quotes", level: "view_only" });
export const TENDER_WRITE = Object.freeze({ category: "quotes", level: "view_create_edit" });
export const TENDER_CONTACTS = Object.freeze({ category: "clientsProperties", level: "full_view" });
export const TENDER_MONEY_TOGGLE = "showPricing";

export const CONTACT_FIELDS = Object.freeze([
  "contractingAuthorityName",
  "contractingAuthorityEmail",
  "contractingAuthorityPhone",
  "technicalAuthorityName",
  "technicalAuthorityEmail",
  "technicalAuthorityPhone",
]);

export const MONEY_FIELDS = Object.freeze([
  "estimatedValue",
  "bidSecurityAmount",
  "awardedValue",
  "winningPrice",
]);

export function canReadTenders(member) {
  return !!member && hasLevel(member, TENDER_READ.category, TENDER_READ.level);
}

export function canWriteTenders(member) {
  return !!member && hasLevel(member, TENDER_WRITE.category, TENDER_WRITE.level);
}

export function canSeeTenderContacts(member) {
  return !!member && hasLevel(member, TENDER_CONTACTS.category, TENDER_CONTACTS.level);
}

export function canSeeTenderMoney(member) {
  return !!member && hasToggle(member, TENDER_MONEY_TOGGLE);
}

export function canConvertTender(member) {
  return !!member && can(member.role, "job:create") && hasLevel(member, "jobs", "view_create_edit");
}

/** May this member switch a client to an organisation, or add one? POST/PATCH /api/clients ask this. */
export function canEditClients(member) {
  return !!member && hasLevel(member, "clientsProperties", "full_edit");
}

function refuse(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

export function requireTenderRead(member) {
  if (!canReadTenders(member)) throw refuse("Your access level for Quotes doesn't include tenders.");
}

export function requireTenderWrite(member) {
  if (!canWriteTenders(member)) throw refuse("Your access level for Quotes doesn't allow you to change tenders.");
}

/**
 * The tender as this member may see it. Contact and money fields are
 * REMOVED, not blanked — a "$0 estimated" on a restricted screen is a figure
 * they were not allowed, and an empty email box reads as "none on file".
 */
export function redactTender(tender, member) {
  if (!tender) return tender;
  const out = { ...tender };
  if (!canSeeTenderContacts(member)) for (const f of CONTACT_FIELDS) delete out[f];
  if (!canSeeTenderMoney(member)) {
    for (const f of MONEY_FIELDS) delete out[f];
    if (out.quote) {
      const { total, ...rest } = out.quote;
      void total;
      out.quote = rest;
    }
  }
  return out;
}

/** The capability flags the screens draw from — one object, computed once. */
export function tenderCapabilities(member) {
  return {
    canEdit: canWriteTenders(member),
    canSeeContacts: canSeeTenderContacts(member),
    canSeeMoney: canSeeTenderMoney(member),
    canConvert: canConvertTender(member),
    canEditClients: canEditClients(member),
  };
}
