// lib/followUps/readiness.js
//
// The two gates every client-facing send passes, asked by the cron.
//
// app/api/quotes/[id]/send/route.js refuses to email a quote when the company
// never finished checkout (lib/signup/planGate.js) and when the quote's tax
// line is an unresolved blank (lib/tax/documentTax.js). A follow-up lands in
// the same inbox under the same name as the quote it chases, so the cron asks
// the same two questions — and it asks them here, in one place, rather than
// inlining a third copy of each gate into a route that already has enough in
// it.
//
// The plan gate is memoised PER RUN per company: the answer does not change
// between one quote and the next in the same minute, and for a company that
// never paid the "no" costs a Stripe round trip. The cache is the caller's
// (a Map created at the top of the run), never module state, so two
// overlapping cron invocations cannot read each other's answers.

import { planDecision } from "@/lib/signup/planGate";
import { taxStatement, taxSendRefusal } from "@/lib/tax/documentTax";
import { attachUsTaxRate } from "@/lib/tax/usRates";

/**
 * May this company send client email at all right now?
 *
 * The member shape planDecision reads is { companyId, role, impersonation,
 * billingAccess }; a cron has no member, so it presents the company as its
 * own owner with no impersonation and lets the gate fetch billing itself.
 *
 * @returns {Promise<boolean>}
 */
export async function companyMaySend(companyId, cache) {
  if (!companyId) return false;
  if (cache?.has(companyId)) return cache.get(companyId);
  let allowed = false;
  try {
    const decision = await planDecision({ companyId, role: "owner", impersonation: null });
    allowed = decision?.action === "allow";
  } catch (err) {
    // A billing lookup that throws is not evidence of a paid plan. Refusing
    // is the safe answer for an automated send nobody is watching.
    console.error("[follow-ups] plan gate failed:", err?.message);
    allowed = false;
  }
  cache?.set(companyId, allowed);
  return allowed;
}

/**
 * Would the quote's own send route refuse this quote for its tax line?
 * Same statement, same refusal, same inputs — the follow-up carries the same
 * figure the quote did.
 *
 * @returns {Promise<boolean>} true when the quote may be chased
 */
export async function quoteTaxReady(db, quote, company) {
  try {
    const taxRates = await db.taxRate.findMany({ where: { companyId: quote.companyId } });
    const refusal = taxSendRefusal(
      taxStatement({
        taxEnabled: quote.taxEnabled,
        tax: quote.tax,
        stored: quote.taxResolution,
        company: company || {},
        taxRates,
        client: await attachUsTaxRate(quote.client),
        siteAddress: quote.siteAddress || null,
        asOf: quote.createdAt,
      }),
      { client: quote.client },
    );
    return !refusal;
  } catch (err) {
    console.error("[follow-ups] tax gate failed:", err?.message);
    return false;
  }
}
