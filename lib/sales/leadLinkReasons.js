// lib/sales/leadLinkReasons.js
//
// The vocabulary of a lead link, with no imports.
//
// lib/sales/leadLink.js decides and writes, and to do that it imports
// lib/sales/attribution.js, which imports the database client. The lead
// SCREEN needs only the reason codes and the catalogue keys that turn them
// into a sentence, and a "use client" component importing the decider would
// pull `pg` into a browser bundle. Same split, same reason, as
// lib/sales/outreachPipeline.js beside lib/sales/outreach.js. leadLink.js
// re-exports everything here so server code has one import.

/** Every reason decideLeadLink() can return, ok_ ones last. */
export const LEAD_LINK_REASONS = [
  "not_found",
  "lead_already_linked",
  "demo_company",
  "already_linked_to_lead",
  "self_deal",
  "attributed_to_another_rep",
  "signed_up_before_lead",
  "referral_code",
  "ok_already_yours",
  "ok_unclaimed",
];

/** Every reason decideUnlink() can refuse with. */
export const UNLINK_REFUSALS = ["not_linked", "no_link_date", "window_expired"];

/**
 * How long after linking a rep may undo it themselves.
 *
 * Thirty days is long enough to notice a wrong company on the next call and
 * short enough that a link the commission ledger has been reading for a
 * quarter is not quietly withdrawn. Outside it, the correction is a
 * superadmin's.
 */
export const UNLINK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Reason → catalogue key, for the sentence the rep reads. */
export const LEAD_LINK_REASON_KEYS = Object.freeze({
  not_found: "app.salesLeads.linkVerdict.notFound",
  lead_already_linked: "app.salesLeads.linkVerdict.leadAlreadyLinked",
  demo_company: "app.salesLeads.linkVerdict.demoCompany",
  already_linked_to_lead: "app.salesLeads.linkVerdict.alreadyLinkedToLead",
  self_deal: "app.salesLeads.linkVerdict.selfDeal",
  attributed_to_another_rep: "app.salesLeads.linkVerdict.attributedToAnotherRep",
  signed_up_before_lead: "app.salesLeads.linkVerdict.signedUpBeforeLead",
  referral_code: "app.salesLeads.linkVerdict.referralCode",
  ok_already_yours: "app.salesLeads.linkVerdict.okAlreadyYours",
  ok_unclaimed: "app.salesLeads.linkVerdict.okUnclaimed",
  // Unlink refusals, same table so one lookup covers the whole screen.
  not_linked: "app.salesLeads.unlinkVerdict.notLinked",
  no_link_date: "app.salesLeads.unlinkVerdict.noLinkDate",
  window_expired: "app.salesLeads.unlinkVerdict.windowExpired",
});
