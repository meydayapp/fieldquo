// lib/sales/scope.js
//
// Which companies a sales rep may see, and which columns of them.
//
// ══ This is the tenant boundary itself, not a filter behind one ═══════════
//
// lib/permissions/enforce.js's assignedJobWhere() is the pattern this copies,
// and the difference between the two is the whole reason this file has its own
// header instead of a one-line comment.
//
// assignedJobWhere() narrows a query that is ALREADY scoped by companyId. Every
// caller spreads it into `{ id, companyId, ...assignedJobWhere(member) }`, and
// scripts/check-tenant-scope.mjs proves that outer companyId is there. So if
// assignedJobWhere is wrong, a crew member sees one more job inside a company
// they are already an employee of. Bad, bounded.
//
// This one has no outer filter to sit behind. A rep's company query IS the
// top-level list — there is no companyId in scope, because the rep is not in
// any tenant. Getting this fragment wrong does not leak a row; it leaks an
// entire customer's business to someone who was never a member of it. Same
// shape, materially higher stakes, so it fails closed harder and its refusing
// case is proven by execution in scripts/check-sales-auth.mjs rather than by
// reading.
//
// ── The demo company is a SECOND predicate, and here it is ────────────────
//
// This used to say the demo access rule was unbuilt and that when it landed it
// must sit beside this one as an explicit OR rather than being folded in. It
// has landed, and it is `repDemoWhere()` below — separate, as promised.
//
// The reason is worth keeping: "attributed to me" is what commission is
// computed from. Quietly making a demo tenant satisfy assignedCompanyWhere()
// would make a fixture account look like a sale, and every payout number
// downstream would be wrong in the direction nobody audits.

/**
 * The `where` fragment restricting a Company query to this rep's own book.
 *
 * Used as the whole `where`, or spread into one:
 *
 *   db.company.findMany({ where: assignedCompanyWhere(rep.id) })
 *   db.company.findFirst({ where: { id, ...assignedCompanyWhere(rep.id) } })
 *
 * ── Why it never returns `{}` ────────────────────────────────────────────
 *
 * assignedJobWhere() returns `{}` for a member who sees the whole board, so
 * the spread is a no-op. There is no equivalent here on purpose: NOBODY sees
 * every company through this function. A rep with no attributions sees nothing,
 * which is the correct and common state — 31 companies predate the sales
 * portal and their null attribution is permanent and right, not a gap to fill.
 * An empty object would turn "I could not work out who is asking" into "show
 * them everything", which is the single worst failure this file can have.
 *
 * ── Why the refusing case filters on the relation, not on `id` ───────────
 *
 * Same reasoning assignedJobWhere() gives: a caller that already set `id`
 * would have it overwritten, silently WIDENING a query whose only job is to
 * narrow. `__none__` is the sentinel scopeFilter and assignedJobWhere already
 * use; no cuid can equal it.
 */
export function assignedCompanyWhere(salesRepId) {
  const id =
    typeof salesRepId === "string" && salesRepId.length > 0
      ? salesRepId
      : "__none__";
  return { salesAttribution: { is: { salesRepId: id } } };
}

/**
 * The ONLY Company columns a rep may read.
 *
 * Narrow by default, and the list is the decision: a rep is paid on whether a
 * company activated, subscribed and stayed, so they get the facts that answer
 * those three questions and nothing else. Not the contractor's quotes, clients,
 * revenue, documents, phone number or address — none of which a commission
 * depends on, and all of which belong to the contractor.
 *
 * A `select` rather than an omit-list, deliberately: a column added to Company
 * tomorrow is invisible here by default. An omit-list would leak it on the day
 * it lands, which is the direction this must never fail in.
 */
export const REP_COMPANY_SELECT = {
  id: true,
  name: true,
  // Signup date. The only date a rep needs to tell "mine, last week" from
  // "mine, in March".
  createdAt: true,
  // Milestone-1 state: Stripe has run KYC and this contractor can take money.
  stripeChargesEnabled: true,
  // Milestone context, and the honest version of "did they finish setting up".
  onboardingCompletedAt: true,
  // A demo tenant dressed as a real one must be legible as a demo, or a rep's
  // own walkthrough account reads as a sale in their list.
  isDemo: true,
  subscription: { select: { status: true } },
  salesAttribution: { select: { capturedAt: true, source: true } },
};

/**
 * The commission-ledger columns a rep may read about their own companies.
 *
 * Read-only, and amounts are excluded from the portal shell on purpose: what
 * ships here is milestone STATE. Payout figures arrive with the payout batches
 * that pay them, and a number on screen that no batch can yet pay is a promise
 * the product cannot keep.
 */
export const REP_MILESTONE_SELECT = {
  companyId: true,
  milestone: true,
  status: true,
  occurredAt: true,
};

/**
 * The one demo tenant this rep may reach, as a `where` fragment.
 *
 * ══ Why a rep needs one at all ════════════════════════════════════════════
 *
 * The owner asked where a rep shows a prospect how the product works. The
 * platform console's answer is "Run the demo", which opens a demo tenant
 * through IMPERSONATION — and impersonation is read-only and superadmin-only,
 * twice enforced, deliberately. A rep impersonating could not write a quote,
 * which is the only thing a prospect actually wants to watch happen.
 *
 * So a rep gets a real login to a real demo company instead: a fixture
 * FieldQuo owns outright, with no customer, no data worth protecting, and a
 * one-click wipe.
 *
 * ══ Why it never widens to "any demo" ═════════════════════════════════════
 *
 * `SalesRep.demoCompanyId` is @unique, so two reps cannot be pointed at one
 * demo and reset it out from under each other mid-walkthrough. This function
 * honours that by matching the ID and nothing else: it does NOT match
 * `isDemo: true`, which would let any rep wipe any other rep's demo halfway
 * through their call.
 *
 * Returns a where fragment that matches NOTHING when the rep has no demo — the
 * same discipline assignedCompanyWhere() follows, and for the same reason. An
 * empty object here would mean "every company", which on a function whose
 * callers reset data is the worst failure available.
 */
export function repDemoWhere(demoCompanyId) {
  const id = typeof demoCompanyId === "string" ? demoCompanyId.trim() : "";
  // A rep with no demo assigned matches no row. `{ id: "" }` would too, but an
  // impossible id says what it means to the next reader.
  if (!id) return { id: "__no_demo_assigned__" };
  // isDemo is asserted as well as the id. The id came off the rep's own row so
  // it should always be a demo — and "should always be" is exactly the
  // assumption that makes a reset destructive the day somebody points the
  // column at a real tenant by hand.
  return { id, isDemo: true };
}
