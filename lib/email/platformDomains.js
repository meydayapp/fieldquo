// lib/email/platformDomains.js
//
// Which email domains are FieldQuo's own — a boundary, not a naming preference.
//
// ══ Why one function, read from two sides ═════════════════════════════════
//
// A QA test POSTed `fieldquo.com` to Settings → Email Domain and the tenant
// ADOPTED it. platformSender.js defines FieldQuo's sending domain as "a verified
// Resend domain no Company claims" — correct, because sending FieldQuo's mail
// from a customer's domain would be a small scandal — so the moment a tenant
// row claimed fieldquo.com, every platform email (invites, billing, password
// resets, and every quote or invoice from the 31 companies with no domain of
// their own) fell back to the Resend sandbox, which delivers only to the
// account owner. One bad row, platform mail down for everyone.
//
// The adoption route now refuses it (the write side). That alone is not
// enough: a row written before the guard, or by any path that isn't that
// route, would still take mail down. So the SAME rule is read on the send
// side — a platform domain is FieldQuo's whether or not a Company row says
// otherwise, and a tenant configured with one sends as if they had none.
// One function, so the two sides cannot drift. Same shape as
// RESERVED_SUBDOMAINS in lib/site/subdomain.js, for the same reason.

const PLATFORM_APEX = "fieldquo.com";

/**
 * True for fieldquo.com and any subdomain of it. Case-insensitive; a trailing
 * dot (a fully-qualified name) is tolerated. Anything else — including a
 * lookalike like fieldquo.com.evil.example — is not ours.
 */
export function isPlatformEmailDomain(name) {
  if (typeof name !== "string") return false;
  const n = name.trim().toLowerCase().replace(/\.$/, "");
  return n === PLATFORM_APEX || n.endsWith(`.${PLATFORM_APEX}`);
}
