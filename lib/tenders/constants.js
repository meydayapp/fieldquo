// lib/tenders/constants.js
//
// The closed vocabularies of a tender. No imports, so a "use client" form and
// a bare-node check script read the same lists the server validates against —
// a picker offering a value the route refuses is the dead-control failure.

/** Where the solicitation is published. `other` covers a city's own site. */
export const TENDER_SOURCES = Object.freeze([
  "canadabuys",
  "sap_ariba",
  "merx",
  "bids_and_tenders",
  "biddingo",
  "email",
  "other",
]);

/** Every status, in the order the list's filter shows them. */
export const TENDER_STATUSES = Object.freeze([
  "watching",
  "bid",
  "no_bid",
  "preparing",
  "submitted",
  "won",
  "lost",
  "cancelled",
  "withdrawn",
]);

/**
 * Statuses with a deadline still ahead of US. Reminders fire only for these,
 * and the list's "open" filter is these. A submitted bid is out of our hands:
 * reminding the team that it closes tomorrow is noise.
 */
export const OPEN_TENDER_STATUSES = Object.freeze(["watching", "bid", "preparing"]);

/** What a document on a tender is. */
export const TENDER_DOCUMENT_KINDS = Object.freeze([
  "solicitation",
  "addendum",
  "submission",
  "correspondence",
  "award",
  "other",
]);

/** The upload purpose tender files go through — see lib/media/directUpload.js. */
export const TENDER_UPLOAD_PURPOSE = "plans";

/** Free-text ceilings. Refused above, never truncated. */
export const LIMITS = Object.freeze({
  title: 200,
  solicitationNumber: 80,
  buyerBranch: 200,
  sourceUrl: 1000,
  questionsChannel: 300,
  personName: 120,
  email: 200,
  phone: 40,
  siteVisitLocation: 300,
  securityClearance: 300,
  notes: 5000,
  reason: 1000,
  confirmationNumber: 120,
  contractNumber: 120,
  winnerName: 200,
  debriefNotes: 5000,
  documentName: 200,
});

/** Bid validity is days after closing; a year and a half is generous. */
export const MAX_BID_VALIDITY_DAYS = 730;

/** A hundred billion — far past any tender a FieldQuo company bids on. */
export const MAX_MONEY = 100_000_000_000;
