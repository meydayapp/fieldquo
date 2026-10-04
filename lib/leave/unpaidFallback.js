// lib/leave/unpaidFallback.js
//
// Unpaid time off, for a company that has set up no leave policies.
//
// ── The gap (live test, 2026-10-04) ─────────────────────────────────────────
//
// A crew member in a company with no leave policies opened Time off and read
// "No leave policies have been set up yet" — and nothing else. Not a form, not
// a button: no way to say "I need Friday off" inside the product. The request
// still happened, by text to the owner, off the record and invisible to the
// schedule. A screen that refuses the ask because the office has not done its
// setup is the company's paperwork blocking the person, not protecting anyone.
//
// ── What this allows, and what it does not invent ───────────────────────────
//
// UNPAID time off only: dates and a reason, needing approval, routed to the
// approvers exactly as any request is (POST /api/leave). Unpaid because that
// is the one kind of leave that commits the company to no money and no
// balance — offering "Vacation" would invent an entitlement the owner never
// stated (AGENTS.md failure class #5: absence of a statement is not a
// statement). The owner's note stays — they still have no policies of their
// own — and the moment they set one up, the form offers theirs instead.
//
// The request needs a LeavePolicy row (LeaveRequest.policyId is required and
// every reader joins it for the name). Making that column nullable would touch
// every leave reader in the product; a single, flagged policy row
// (LeavePolicy.systemUnpaid) touches none of them. It is created on the first
// request, not on page load — looking at the screen writes nothing.
//
// Pure, no imports.

/** The policy's name, in the company's own language — the office reads it. */
const NAMES = {
  en: "Unpaid time off",
  fr: "Congé sans solde",
  es: "Permiso sin goce de sueldo",
  it: "Permesso non retribuito",
  de: "Unbezahlter Urlaub",
  uk: "Неоплачувана відпустка",
  pa: "ਬਿਨਾਂ ਤਨਖਾਹ ਛੁੱਟੀ",
  tl: "Day off na walang bayad",
  zh: "无薪假",
};

export function unpaidFallbackName(language) {
  const code = String(language || "en").slice(0, 2).toLowerCase();
  return NAMES[code] || NAMES.en;
}

/** The policies the COMPANY set up — never the fallback row. */
export function companySetPolicies(policies) {
  return (Array.isArray(policies) ? policies : []).filter((p) => p && p.systemUnpaid !== true);
}

/** Does this company need the unpaid fallback offered? Only when it set up none. */
export function offersUnpaidFallback(policies) {
  return companySetPolicies(policies).length === 0;
}

/** The row to create the first time it is used. */
export function unpaidFallbackPolicyData(companyId, language) {
  return {
    companyId,
    name: unpaidFallbackName(language),
    kind: "unpaid",
    paid: false,
    accrualMethod: "annual_allotment",
    annualDays: null,
    requiresApproval: true,
    systemUnpaid: true,
    active: true,
  };
}
