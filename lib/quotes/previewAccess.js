// lib/quotes/previewAccess.js
//
// "Is the person asking for this draft a member of the company that owns it?"
//
// One answer, two callers: app/q/[token]/page.js (the page) and
// app/api/public/quotes/[token] (the payload it fetches). Two copies of this
// would be two chances for the page to render a preview the API then refuses,
// or worse, for the API to serve a draft the page believed it had gated.
//
// ── What a preview is allowed to be ─────────────────────────────────────────
//
// A READ, and nothing else. It records no view, stamps no timestamp on the
// quote, writes no analytics row and emails nobody — the whole point is that
// an estimator can look at the client's copy before the client has one, and a
// preview that left a footprint would make "the client opened it" a lie the
// first time anybody checked their own work. The caller is responsible for
// that; what this file promises is only that it identifies the member without
// touching the quote.
//
// The company match is the gate, not a permission level. Anyone who can open
// the quote in the back office can already read every number on it; the client
// page shows strictly less. What a preview must never do is let a STRANGER
// holding a leaked draft link read it, and the companyId comparison is what
// stops that.

import { getCurrentMember } from "@/lib/currentMember";

/**
 * The tenant comparison, on its own so it can be EXECUTED against hostile
 * input rather than read.
 *
 * This is the security-critical half — "a member of some company" must not be
 * "a member of THIS company" — and it is the half a session cannot be faked
 * for in a check script. Split out for that reason, and for no other: nothing
 * but canPreviewCompanyDocument below should call it, because a member object
 * that did not come from getCurrentMember has not been through the
 * impersonation, feature or active-seat gates.
 */
export function memberMayPreview(member, companyId) {
  if (!companyId || typeof companyId !== "string") return false;
  if (!member?.companyId || typeof member.companyId !== "string") return false;
  return member.companyId === companyId;
}

/**
 * @param requestLike  a Request (API routes) or `{ headers }` (server
 *   components) — the same two shapes getCurrentMember already takes.
 * @param companyId    the quote's owning company.
 * @returns true only for a signed-in, active member of THAT company.
 */
export async function canPreviewCompanyDocument(requestLike, companyId) {
  if (!companyId) return false;
  try {
    // skipBillingGate, because a company behind on its bill previewing its own
    // draft is not a billable action — and the alternative is a thrown 402 on
    // a page whose job is to show what a client would see. The feature and
    // read-only gates inside getCurrentMember still apply: an impersonating
    // superadmin resolves read-only, which a preview already is.
    const member = await getCurrentMember(requestLike, { skipBillingGate: true });
    return memberMayPreview(member, companyId);
  } catch {
    // A refusal from any of the gates is a "no", not a 500 on a page a
    // homeowner might be holding. The draft simply stays not-found.
    return false;
  }
}
