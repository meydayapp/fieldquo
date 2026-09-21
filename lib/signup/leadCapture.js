// lib/signup/leadCapture.js
//
// The browser half of the signup capture: what app/signup/page.js posts,
// and when. No imports, so the signup page can pull it in without dragging
// the server-side rules (lib/signup/leads.js, which reaches the attribution
// module and therefore `db`) into a client bundle.
//
// ══ The contract ═══════════════════════════════════════════════════════════
//
//   · a JSON POST to CAPTURE_ENDPOINT — never a query string. The body
//     carries the person's name, number and company, and a URL is logged by
//     every proxy between a van and Vercel.
//   · debounced: the page waits CAPTURE_DEBOUNCE_MS after the LAST change to
//     the form before posting, so a name typed letter by letter is one
//     request, not nine. A step change posts at once, with keepalive, so the
//     furthest step is recorded even if the tab closes on the way to Stripe.
//   · nothing is posted until there is an email and one more thing — a name,
//     a company, a number or a trade. An email alone is a login attempt.
//   · the password is never in the body. The check greps for that.
//
// scripts/check-signup-leads.mjs executes captureBodyFor against the form
// shape the page holds, and holds the page to the endpoint and the delay.

export const CAPTURE_ENDPOINT = "/api/signup/lead";
export const CAPTURE_DEBOUNCE_MS = 1500;

/** The page's step names, and which of them the capture reports as-is. */
export const CAPTURE_STEPS = Object.freeze(["account", "business", "industry", "services", "plan", "checkout"]);

/**
 * The body for one capture, or null when there is nothing worth sending.
 *
 * @param form      the page's `form` state (password included — dropped here)
 * @param step      the step being shown, or "checkout" at the Stripe handoff
 * @param extras    { selectedIndustries, salesCode, referralCode, utm, visitorId, referrer }
 */
export function captureBodyFor(form = {}, step = "account", extras = {}) {
  const email = typeof form?.email === "string" ? form.email.trim() : "";
  if (!email || !email.includes("@")) return null;
  if (!CAPTURE_STEPS.includes(step)) return null;
  const s = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const trades = Array.isArray(extras.selectedIndustries) ? extras.selectedIndustries.filter((t) => typeof t === "string") : [];
  const body = {
    email,
    step,
    firstName: s(form.firstName, 80),
    lastName: s(form.lastName, 80),
    companyName: s(form.companyName, 160),
    phone: s(form.phone, 40),
    city: s(form.city, 80),
    province: s(form.province, 40),
    country: s(form.country, 2),
    language: s(form.language, 5),
    trades,
    salesCode: s(extras.salesCode, 40),
    referralCode: s(extras.referralCode, 40),
    utm: extras.utm && typeof extras.utm === "object" ? extras.utm : null,
    visitorId: s(extras.visitorId, 40),
    referrer: s(extras.referrer, 200),
  };
  const worth = body.firstName || body.lastName || body.companyName || body.phone || trades.length > 0;
  return worth ? body : null;
}

/** A stable fingerprint of a body, so the same form is not posted twice. */
export function captureFingerprint(body) {
  return body ? JSON.stringify(body) : "";
}
