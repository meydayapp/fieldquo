// lib/sales/preferenceWrite.js
//
// The only place a rep's own INTERFACE PREFERENCE is written.
//
// ══ Why a file, rather than db.salesRep.update in the route ═══════════════
//
// `salesRep` is on REP_FORBIDDEN_WRITES (lib/sales/gate.js) and
// scripts/check-sales-auth.mjs enforces that against the real route files AND
// against the modules those routes import — one hop, deliberately, because
// moving a forbidden write into lib/ to quiet the grep is gaming the rule
// rather than obeying it. That happened once already, with the payout write,
// and the fix was this shape: one function, its columns named AS DATA, and the
// key set asserted by the check instead of trusted.
//
// This file is the second instance of that shape. It is a SEPARATE file from
// lib/sales/payoutWrite.js on purpose: that check locates the payout writer's
// update by `indexOf("salesRep.update(")` and asserts its data block sets
// exactly the three payout columns. A second update in the same file would sit
// past that index and be scanned by nothing at all — the exact index-ordering
// trap the check's own comments say this repo has hit three times.
//
// ══ Why this write is not the escalation that list forbids ════════════════
//
// REP_FORBIDDEN_WRITES names the rep row for four columns and says which:
// "active, code, commission plan, acceptedAt. Rotating your own code or
// reactivating yourself is the same escalation in a different shape." Each of
// those is a rep deciding something about what they are OWED or whether they
// are still employed.
//
// `language` decides which words the chrome of their own console is drawn in.
// It cannot change what is owed, who a company is credited to, whether a batch
// pays, or whether the rep can sign in tomorrow. The value is drawn from a
// closed set the caller validates against app/i18n/languages.js, so the worst
// a compromised session achieves is a console in Tagalog.
//
// ══ Why there is no audit line here, unlike the payout writer ═════════════
//
// payoutWrite.js logs every change with the old and new handle masked, because
// redirecting a payout is a real fraud shape and a redirect nobody can
// reconstruct afterwards is the one that costs money. Nothing about a language
// costs anything, and a recordError row per settings save would bury the
// payout redirects it exists to make findable. The absence is a decision, not
// an omission.
import { db } from "@/lib/db";

/**
 * The columns of SalesRep this file writes, and the only ones.
 *
 * Named as data so scripts/check-sales-auth.mjs can assert the writer touches
 * these and nothing else. Mirrors GATE_WRITES_ON_SALES_REP in lib/sales/gate.js
 * and PAYOUT_WRITES_ON_SALES_REP in lib/sales/payoutWrite.js, for the reason
 * both give: the rule has to be checkable, not merely written down.
 */
export const PREFERENCE_WRITES_ON_SALES_REP = ["language"];

/**
 * Save a rep's interface language.
 *
 * @param salesRepId  from the gate's fresh read of the session. NEVER from a
 *                    request body — a rep id a client could name is a client
 *                    that can reach into a colleague's row.
 * @param language    a supported code, or null for "follow my browser".
 *                    Already validated by the caller through
 *                    parseLanguageChoice() in lib/sales/repLanguage.js.
 *
 * Null is written through rather than skipped: clearing a stated preference is
 * a rep saying "stop deciding this for me", and a writer that treated null as
 * "no change" would ship a control that appears to work and doesn't — the rule
 * AGENTS.md leads with. Nothing else on the row is touched, so this removes no
 * record and no history.
 *
 * @returns the updated row, selected narrowly.
 */
export async function saveRepLanguage({ salesRepId, language, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("saveRepLanguage: a salesRepId is required");

  return client.salesRep.update({
    where: { id },
    // Exactly PREFERENCE_WRITES_ON_SALES_REP. Anything else here is the
    // escalation REP_FORBIDDEN_WRITES exists to prevent.
    data: { language },
    select: { id: true, language: true },
  });
}
