// lib/demo/clientFacing.js
//
// What a DEMO company's client-facing pages leave out, so a prospect playing
// the homeowner sees the product and not the scaffolding.
//
// ══ Why anything is hidden at all ═════════════════════════════════════════
//
// The seed (lib/demo/seedContent.js) gives every demo company contact details
// that cannot reach anyone, on purpose: a 555-01xx phone, a website and an
// e-transfer/Zelle address on <slug>.example.com. That is right for the back
// office — nothing a rep presses can text or email a stranger — and wrong for
// the page a prospect is shown as "what your client gets". "Send an
// e-transfer to pay@demo-ana-cabinets.example.com" in the How-to-pay box, and
// "Questions? Call +1 514 555 0180" under it, read as a broken product, not a
// demo. The demo Pay button already walks the real payment experience to a
// "Demo — no card is charged" screen (lib/demo/demoPayment.js), so the
// offline box adds nothing a prospect can use.
//
// ══ What decides it ═══════════════════════════════════════════════════════
//
// The company row's own isDemo, read in the same request by the route that
// builds the client payload — the boolean lib/demo/simulatedSpend.js's
// isDemoCompany() would return, from the same row. Nothing here takes a flag
// from a request. A real company passes `isDemo: false` and every function
// below hands back exactly what it was given — the same object, not a copy —
// so a real tenant's payload is byte-identical (scripts/check-white-label-meta.mjs
// diffs it).
//
// ══ Only what is fictional ════════════════════════════════════════════════
//
// A rep can put a real phone on a demo company to take a call during a
// pitch. So a demo's contact details are dropped only when they are the
// seed's kind of fictional: a 555-01xx number (the NANP block reserved for
// fiction) or an address on an RFC 2606 example domain. A real number on a
// demo still shows.

/** NANP 555-0100…0199, the block reserved for fiction, in any formatting. */
export function isFictionalPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7) return false;
  return /^55501\d{2}$/.test(digits.slice(-7));
}

/** An email or URL on example.com / .net / .org, or a *.example / *.test host. */
export function isFictionalAddress(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return false;
  const host = s.includes("@")
    ? s.split("@").pop()
    : s.replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0];
  return /(^|\.)example\.(com|net|org)$/.test(host) || /\.(example|test|invalid)$/.test(host);
}

/**
 * The company's contact fields as a client page may print them. For a real
 * company: the same object, untouched. For a demo: the fictional phone,
 * email and website set to null (null, not "", so every `company.phone &&`
 * on the page already hides the row).
 */
export function demoSafeContact(company, isDemo) {
  if (!isDemo || !company || typeof company !== "object") return company;
  const out = { ...company };
  if ("phone" in out && isFictionalPhone(out.phone)) out.phone = null;
  if ("email" in out && isFictionalAddress(out.email)) out.email = null;
  if ("website" in out && isFictionalAddress(out.website)) out.website = null;
  return out;
}

/**
 * The "How to pay" block a client page may show. Null for a demo: every
 * method in a demo's block is the seed's fictional address, and the demo Pay
 * button is what shows the payment experience. A real company's block is
 * returned as it was given.
 */
export function demoSafeHowToPay(block, isDemo) {
  return isDemo ? null : block;
}
