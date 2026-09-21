// lib/platform/auditActions.js
//
// What every PlatformAuditLog.action means, in words, and how loudly to say it.
//
// ══ The bug this file exists to kill ═══════════════════════════════════════
//
// /platform/audit-log opened with the sentence "Impersonation entries are
// visually distinct because they're the ones that matter most: they're the
// moments a staff member had access to a customer's real client data, and the
// entry is the only record that it happened."
//
// They were not visually distinct. The page keyed its amber treatment on the
// action `impersonate`, and NOTHING in this codebase has ever written that
// value — lib/platform/impersonate.js writes `impersonation_started` and
// `impersonation_ended`. So the one entry class the screen was built around
// fell through to the neutral fallback: grey pill, generic scroll icon, the
// label "impersonation started" produced by replacing underscores. The same
// went for the four other keys the page named: `company_suspended` and
// `company_updated` are real, `impersonate` is not, and thirty-six actions the
// product writes had no wording at all.
//
// That is AGENTS.md failure class 1 read backwards — a value READ that is
// never WRITTEN — and it is why the map lives here now rather than beside the
// screen: scripts/check-platform-truth.mjs scans every `platformAuditLog.create`
// in the repo, extracts the action literals (including the ones inside a
// ternary), and fails when one of them has no entry below. A key nobody writes
// fails the same scan from the other direction. Neither could be caught by
// reading this file, which is exactly how it survived.
//
// ══ Why tone and not a class name ══════════════════════════════════════════
//
// Colour is the point on this screen — "encode state in FORM as well as
// number", the design rule the amber impersonation row was supposed to be an
// instance of. But a Tailwind class list here would put pixels in a module a
// bare-node check has to import, so this names a TONE and the screen owns the
// palette. The tones are the classes of thing a support person is scanning
// for:
//
//   access   an admin held a customer's session — the most consequential row
//            in the table, and the only record that it happened
//   tenant   FieldQuo acted inside a customer's own data (the paid migration
//            service, non-negotiable #3's one sanctioned exception)
//   danger   something was taken away: suspended, revoked, deactivated,
//            deleted, cancelled
//   good     something was created
//   neutral  something was changed

/**
 * Every action the product writes, mapped to how it should read.
 *
 * Held to what the code actually writes by check:platform-truth, in both
 * directions. Add the row here in the same commit that adds the write.
 */
export const AUDIT_ACTIONS = {
  // ── Access to a customer's account ───────────────────────────────────────
  impersonation_started: { label: "Signed in as company", tone: "access" },
  impersonation_ended: { label: "Ended company session", tone: "access" },
  demo_login_created: { label: "Created a demo login", tone: "access" },
  // The owner reading a conversation they are not a party to — a staff DM
  // or group (lib/staff/audit.js), or a rep's texts and emails with a
  // prospect (lib/sales/conversationAudit.js). "access" rather than
  // neutral: like an impersonation, the row is the record that somebody
  // read what was not addressed to them, and it is the same colour on the
  // screen for the same reason. Superadmin-only ("chat:audit"), read-only,
  // and — for the staff chat — announced in the room itself.
  chat_audited: { label: "Read a staff conversation", tone: "access" },
  rep_conversation_audited: { label: "Read a rep's conversation with a prospect", tone: "access" },

  // ── Writes inside a customer's tenant, and the money that licensed them ──
  migration_quoted: { label: "Priced a data migration", tone: "tenant" },
  migration_completed: { label: "Closed a data migration", tone: "tenant" },
  migration_cancelled: { label: "Cancelled a data migration", tone: "danger" },

  // ── Companies ────────────────────────────────────────────────────────────
  company_created: { label: "Created company", tone: "good" },
  company_updated: { label: "Updated company", tone: "neutral" },
  company_suspended: { label: "Suspended company", tone: "danger" },
  company_deletion_requested: { label: "Requested deletion", tone: "danger" },
  trial_extended: { label: "Extended a free period", tone: "neutral" },
  trial_ended: { label: "Ended a free period — billed now", tone: "danger" },
  subscription_cancelled_by_platform: { label: "Cancelled a company's subscription", tone: "danger" },
  // Our Subscription row rewritten from what Stripe holds (the "Sync from
  // Stripe" button). Neutral: it changes what we SAY, never what they pay.
  subscription_synced: { label: "Synced the subscription from Stripe", tone: "neutral" },
  ai_cap_changed: { label: "Changed an AI spend cap", tone: "neutral" },
  // A flagged signup (outside CA/US, repeat IP, stated-country mismatch)
  // marked reviewed — the one write on /platform/signup-origins.
  signup_reviewed: { label: "Reviewed a flagged signup", tone: "neutral" },
  // /platform/errors: "somebody looked at this, and here is why it is fine".
  // One row per batch, the ids in details. Unmarking is its own action so a
  // reversed review reads as a reversal, not as a second review.
  error_reviewed: { label: "Marked errors reviewed", tone: "neutral" },
  error_unreviewed: { label: "Unmarked reviewed errors", tone: "neutral" },

  // ── What FieldQuo sells ──────────────────────────────────────────────────
  plan_created: { label: "Created a plan", tone: "good" },
  plan_updated: { label: "Updated a plan", tone: "neutral" },
  plan_deleted: { label: "Deleted a plan", tone: "danger" },
  // Kept for its subscribers, sold to nobody (Plan.retiredAt). "danger"
  // because it withdraws a price from sale; un-retiring is the reversal and
  // reads as one.
  plan_retired: { label: "Retired a plan", tone: "danger" },
  plan_unretired: { label: "Put a retired plan back on sale", tone: "neutral" },
  promotion_created: { label: "Created a promotion", tone: "good" },
  promotion_updated: { label: "Updated a promotion", tone: "neutral" },
  promo_code_created: { label: "Created a promo code", tone: "good" },
  promo_code_revoked: { label: "Revoked a promo code", tone: "danger" },
  promo_code_reinstated: { label: "Reinstated a promo code", tone: "neutral" },
  influencer_enrolled: { label: "Enrolled a company as an influencer", tone: "good" },
  influencer_unenrolled: { label: "Unenrolled a company as an influencer", tone: "neutral" },
  feature_global_set: { label: "Changed a feature for everyone", tone: "neutral" },
  feature_override_set: { label: "Overrode a feature for one company", tone: "neutral" },
  feature_override_cleared: { label: "Cleared a feature override", tone: "neutral" },

  // ── FieldQuo's own staff ─────────────────────────────────────────────────
  platform_admin_created: { label: "Created a staff account", tone: "good" },
  platform_admin_updated: { label: "Changed a staff account", tone: "neutral" },
  platform_admin_deactivated: { label: "Deactivated a staff account", tone: "danger" },
  demo_availability_updated: { label: "Changed demo availability", tone: "neutral" },
  feedback_updated: { label: "Triaged a feedback item", tone: "neutral" },

  // ── The sales operation ──────────────────────────────────────────────────
  sales_rep_invited: { label: "Invited a sales rep", tone: "good" },
  sales_rep_reinvited: { label: "Re-sent a rep invitation", tone: "neutral" },
  sales_rep_reactivated: { label: "Reactivated a sales rep", tone: "neutral" },
  sales_rep_deactivated: { label: "Deactivated a sales rep", tone: "danger" },
  sales_rep_work_mailbox_set: { label: "Set a rep's work mailbox", tone: "neutral" },
  // FieldQuo's own money leaving: a superadmin paid a rep's weekly batch
  // and said where and with what (lib/sales/payoutProof.js). The second is
  // a receipt or reference added to a batch already paid.
  sales_payout_marked_paid: { label: "Marked a rep's payout paid", tone: "good" },
  sales_payout_proof_added: { label: "Added proof to a rep's payout", tone: "neutral" },
  // A FieldQuo-owned phone number lent to a rep for their console, or taken
  // back (app/api/platform/crew-lines/route.js). Neither tone is danger: the
  // number stays FieldQuo's either way.
  sales_number_assigned: { label: "Lent a phone number to a rep", tone: "neutral" },
  sales_number_unassigned: { label: "Took a phone number back from a rep", tone: "neutral" },
  // The telemarketer registration a jurisdiction requires before a rep may
  // call into it (app/api/platform/sales/registrations/route.js). Withdrawn
  // is danger: every campaign into that territory stops being callable.
  sales_telemarketer_registration_recorded: { label: "Recorded a telemarketer registration", tone: "good" },
  sales_telemarketer_registration_withdrawn: { label: "Withdrew a telemarketer registration", tone: "danger" },
  // How hard a state's calling window and cap are applied on the rep's
  // screens (app/api/platform/sales/windows/route.js). Relaxing one — warn
  // only, or off — is danger: a rep may now ring outside the hours the law
  // file recorded. Setting it back to enforce is neutral.
  sales_window_override_relaxed: { label: "Relaxed a calling window (warn only / off)", tone: "danger" },
  sales_window_override_enforced: { label: "Set a calling window back to enforce", tone: "neutral" },
  // The phones FieldQuo itself owns for testing the dialler at any hour
  // (app/api/platform/sales/test-lines/route.js, lib/sales/testLines.js). A
  // number on that list can be rung outside every calling window by every
  // rep, so a change to it is danger: a stranger's number added here is an
  // unlawful call waiting to happen. The log carries the list before and after.
  sales_test_lines_updated: { label: "Changed the dialler's test-line list", tone: "danger" },
  // The phones a live caller may be handed to — the owner's mobile, the
  // office line (app/api/platform/sales/transfer-numbers/route.js,
  // lib/sales/transferNumbers.js). Every rep can send a live call to a
  // number on it, on FieldQuo's account, so a change is danger: a stranger's
  // number here is toll fraud with a label. The log carries the list before
  // and after.
  sales_transfer_numbers_updated: { label: "Changed the transfer-phone list", tone: "danger" },
  // Live-call supervision (lib/sales/calls/supervision.js). Listen and
  // whisper are inaudible to the prospect; barge and take are not, and the
  // rep is always told of those two. Each row names the attempt.
  sales_call_listen: { label: "Listened to a rep's live call", tone: "neutral" },
  sales_call_whisper: { label: "Whispered to a rep on a live call", tone: "neutral" },
  sales_call_barge: { label: "Joined a rep's live call", tone: "danger" },
  sales_call_take: { label: "Took a live call from a rep", tone: "danger" },
  sales_call_supervision_ended: { label: "Left a rep's live call", tone: "neutral" },
  sales_supervision_settings_updated: { label: "Changed the call-supervision settings", tone: "danger" },
  sales_rep_call_privileges_updated: { label: "Changed what a rep may dial outside the queue", tone: "neutral" },
  // Which languages a rep sells in — the list that decides who may be handed
  // a Quebec prospect (lib/sales/leadLanguage.js). Its own action because
  // "why did this rep stop getting Quebec rows" has to be answerable from
  // the log.
  sales_rep_sells_in_set: { label: "Set a rep's selling languages", tone: "neutral" },
  // Danger, like the test-lines edit: this is the flag that lets an account
  // ring at any hour and drops its dials from every count.
  sales_rep_test_account_set: { label: "Set a rep's test-account flag", tone: "danger" },
  // The queue changing hands without the rep's say-so. A release puts held
  // prospects back in the pool for a rep who disconnected (or is leaving);
  // a reassignment moves held prospects and open leads to another rep. Both
  // are "danger" rather than neutral because both take work off somebody,
  // and the row is how that rep finds out why their list emptied. Neither
  // moves an attribution or a commission entry — those stay with the rep who
  // earned them — and the details say so with `attributionsMoved: 0`.
  sales_rep_queue_released: { label: "Released a rep's held prospects", tone: "danger" },
  sales_rep_queue_reassigned: { label: "Moved a rep's queue and leads to another rep", tone: "danger" },
  // The console handed a rep leads (lib/sales/assignLeads.js) — the next
  // batch by the rep's own selection, or rows a superadmin ticked — or took
  // them back. "good" for the hand-out: a queue was filled and nothing was
  // taken from anybody; "danger" for the take-back, which empties one. The
  // details name the rep, the trade, the province and language narrowing,
  // and every prospect id, so the rep's Today line and the owner a week
  // later read the same row.
  leads_assigned: { label: "Assigned leads to a rep", tone: "good" },
  leads_unassigned: { label: "Took assigned leads back from a rep", tone: "danger" },
  // A superadmin put an exhausted prospect back in the pool with a fresh
  // attempt count (lib/sales/retryRules.js recycleData). Neutral: nothing is
  // taken from anybody and nothing is deleted — the last outcome and every
  // call attempt stay — but the row is how the owner sees that a business
  // rung four times with no answer is about to be rung again.
  sales_prospect_recycled: { label: "Recycled exhausted prospects into the pool", tone: "neutral" },
  // The retry cadence itself — how soon a no-answer is rung again and how
  // many tries before the row leaves the pool (lib/sales/retryRules.js,
  // overridden by SalesRetryRule). "danger" because it changes every rep's
  // day from the next request on; the details carry before and after per
  // outcome. A reset writes the defaults back and is its own action so the
  // log can say which it was.
  sales_retry_rules_set: { label: "Changed the retry rules (wait, ceiling, same day, rotation)", tone: "danger" },
  sales_retry_rules_reset: { label: "Reset the retry rules to the code defaults", tone: "neutral" },
  // What FieldQuo pays its own salespeople. These four are the money rows of
  // the sales operation: a plan's amounts decide every SalesCommissionEntry
  // written from the moment they change, and an assignment decides whether a
  // rep's milestones are recorded at all — with no plan, earnMilestone writes
  // nothing and the rep earns nothing. Clearing an assignment is therefore
  // "danger" rather than neutral: it is the edit that silently stops the ledger.
  sales_commission_plan_created: { label: "Created a commission plan", tone: "good" },
  sales_commission_plan_updated: { label: "Changed what a commission plan pays", tone: "neutral" },
  sales_commission_plan_reactivated: { label: "Reactivated a commission plan", tone: "neutral" },
  sales_commission_plan_deactivated: { label: "Withdrew a commission plan", tone: "danger" },
  sales_rep_commission_plan_set: { label: "Set a rep's commission plan", tone: "neutral" },

  // A suppression is somebody telling FieldQuo to stop. Removing one is the
  // only action in the product that puts FieldQuo back in touch with them, so
  // it reads as a removal rather than as an ordinary edit — the same reasoning
  // /platform/suppressions gives for making the button awkward.
  sales_suppression_added: { label: "Added a do-not-contact entry", tone: "good" },
  sales_suppression_imported: { label: "Imported a do-not-contact list", tone: "good" },
  sales_suppression_removed: { label: "Removed a do-not-contact entry", tone: "danger" },

  sales_campaign_created: { label: "Created a campaign", tone: "good" },
  sales_campaign_started: { label: "Started a campaign", tone: "neutral" },
  // The settings save that also clears a blocked source, and — when the
  // discovery thread had died — queues discovery again. The details say
  // whether a task was queued and, if not, why.
  sales_campaign_configured: { label: "Rebuilt a campaign source's settings", tone: "neutral" },
  sales_campaign_discovery_retried: { label: "Queued a campaign's discovery again", tone: "neutral" },
  sales_prospect_reviewed: { label: "Reviewed a prospect", tone: "neutral" },
  // The Review folder (/platform/sales/review) acting on MANY rows at once —
  // one row per press, carrying the filter and the count, never one per
  // prospect. Its own key so a 40,000-row assignment reads as one act rather
  // than disappearing into a page of "Reviewed a prospect".
  sales_prospects_bulk_reviewed: { label: "Reviewed prospects in bulk", tone: "neutral" },
  // The one-off re-classification of licence-register rows from needs_review
  // to contractor (lib/sales/discovery/reclassifyRegisters.js). Idempotent, so
  // a second row here means somebody ran it again and it found nothing.
  sales_prospects_reclassified: { label: "Reclassified licence-register prospects", tone: "neutral" },
  // A superadmin merged flagged-duplicate rows into the one a rep works
  // (lib/sales/discovery/mergeProspects.js): the survivor's empty fields
  // filled, the others retired and kept. The details name the survivor,
  // the retired ids and the fields filled. Unmerge is its own row so the
  // log reads "merged, then unmerged" rather than a second "merged".
  sales_prospects_merged: { label: "Merged duplicate prospects", tone: "neutral" },
  sales_prospects_unmerged: { label: "Unmerged prospects", tone: "neutral" },
  // The Review folder's suggestion batch (lib/sales/discovery/
  // suggestTradesBatch.js) writing Prospect.suggested* from the name table —
  // a prompt, never a trade; the details carry the count and the version.
  sales_trade_suggestions_computed: { label: "Computed trade suggestions from names", tone: "neutral" },
  // The paid half: the AI pass over the rows the name table left blank
  // (lib/sales/discovery/suggestTradesAi.js). Every run writes one row with
  // the model, the rows read and what it cost.
  sales_trade_suggestions_ai: { label: "Computed trade suggestions with AI", tone: "neutral" },
  // The owner's yes to that paid pass, stored on a PlatformAiBudget "job"
  // row so the cron runs it unattended, and the moment it cleared itself
  // (done, cap reached) or was stopped. details.kind says which.
  sales_trade_suggestions_ai_approval: { label: "Approved or cleared the AI trade-suggestion pass", tone: "neutral" },

  sales_playbook_created: { label: "Created a playbook", tone: "good" },
  sales_playbook_edited: { label: "Edited a playbook", tone: "neutral" },
  sales_playbook_relabelled: { label: "Relabelled a playbook", tone: "neutral" },
  sales_playbook_deleted: { label: "Deleted a playbook", tone: "danger" },
  sales_playbook_defaults_installed: { label: "Installed the default playbooks", tone: "neutral" },
  // lib/sales/playbook/store.js re-syncing the built-in playbooks and
  // objection replies after a deploy changed their shipped text.
  sales_playbook_builtins_refreshed: { label: "Refreshed the built-in playbooks", tone: "neutral" },

  sales_objection_created: { label: "Created an objection reply", tone: "good" },
  sales_objection_edited: { label: "Edited an objection reply", tone: "neutral" },
  sales_objection_relabelled: { label: "Relabelled an objection reply", tone: "neutral" },
  sales_objection_deleted: { label: "Deleted an objection reply", tone: "danger" },

  sales_experiment_created: { label: "Created an experiment", tone: "good" },
  sales_experiment_edited: { label: "Edited an experiment", tone: "neutral" },
  sales_experiment_relabelled: { label: "Relabelled an experiment", tone: "neutral" },
  sales_experiment_deleted: { label: "Deleted an experiment", tone: "danger" },

  sales_rule_created: { label: "Created an opportunity rule", tone: "good" },
  sales_rule_edited: { label: "Edited an opportunity rule", tone: "neutral" },
  sales_rule_relabelled: { label: "Relabelled an opportunity rule", tone: "neutral" },
  sales_rule_deleted: { label: "Deleted an opportunity rule", tone: "danger" },

  sales_signature_created: { label: "Created a trade signature", tone: "good" },
  sales_signature_edited: { label: "Edited a trade signature", tone: "neutral" },
  sales_signature_relabelled: { label: "Relabelled a trade signature", tone: "neutral" },
  sales_signature_deleted: { label: "Deleted a trade signature", tone: "danger" },
  sales_signatures_seeded: { label: "Seeded the trade signatures", tone: "neutral" },

  // One setting, and every discovery campaign is built on it. Logged because
  // changing it re-points eighty campaigns at a different host in one edit.
  sales_snapshot_base_url_set: { label: "Set the snapshot base URL", tone: "neutral" },

  sales_confidence_tuned: { label: "Tuned a confidence signal", tone: "neutral" },
  sales_confidence_disabled: { label: "Disabled a confidence signal", tone: "danger" },
};

/**
 * How one row should read.
 *
 * An action with no entry is shown as unrecognised rather than tidied into a
 * sentence — the same decision lib/platform/subscriptionStatus.js makes and
 * for the same reason: a value this file cannot name is a bug IN this file,
 * and it should look like one rather than blending in. The underscores-to-
 * spaces fallback that used to be here is what let `impersonation_started`
 * masquerade as a handled case for as long as it did.
 *
 * @param {string} action
 * @returns {{ label: string, tone: string, known: boolean }}
 */
export function describeAuditAction(action) {
  const known = AUDIT_ACTIONS[action];
  if (known) return { ...known, known: true };
  return {
    label: action ? `Unrecognised action: ${action}` : "Unrecorded action",
    tone: "unknown",
    known: false,
  };
}
