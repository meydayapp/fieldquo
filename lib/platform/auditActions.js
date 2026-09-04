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
  ai_cap_changed: { label: "Changed an AI spend cap", tone: "neutral" },

  // ── What FieldQuo sells ──────────────────────────────────────────────────
  plan_created: { label: "Created a plan", tone: "good" },
  plan_updated: { label: "Updated a plan", tone: "neutral" },
  plan_deleted: { label: "Deleted a plan", tone: "danger" },
  promotion_created: { label: "Created a promotion", tone: "good" },
  promotion_updated: { label: "Updated a promotion", tone: "neutral" },
  promo_code_created: { label: "Created a promo code", tone: "good" },
  promo_code_revoked: { label: "Revoked a promo code", tone: "danger" },
  promo_code_reinstated: { label: "Reinstated a promo code", tone: "neutral" },
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
  sales_prospect_reviewed: { label: "Reviewed a prospect", tone: "neutral" },

  sales_playbook_created: { label: "Created a playbook", tone: "good" },
  sales_playbook_edited: { label: "Edited a playbook", tone: "neutral" },
  sales_playbook_relabelled: { label: "Relabelled a playbook", tone: "neutral" },
  sales_playbook_deleted: { label: "Deleted a playbook", tone: "danger" },
  sales_playbook_defaults_installed: { label: "Installed the default playbooks", tone: "neutral" },

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
