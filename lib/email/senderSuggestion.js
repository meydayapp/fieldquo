// lib/email/senderSuggestion.js
//
// What Settings › Email domain PROPOSES from the company's own email address
// (Company.email — the one replies already go to). The owner, 2026-10-09: "in
// the domains page we should know what is the company's email address so that
// outgoing emails point to that and not to the owner's log in email."
//
// TrueFinish is the case that prompted it: Company.email is
// info@truefinishcabinets.com, the domain field opened empty (or on a send.
// subdomain of the website), and once a domain was connected the From line
// would have read quotes@… because "quotes" is the column's default. The
// company had already told us its address; the page made them work it out
// again.
//
// ══ Proposals, never writes ═══════════════════════════════════════════════
//
// Nothing in this file changes a row. Company.emailFromLocal defaults to
// "quotes" in the schema, so a stored "quotes" cannot be told apart from a
// company that CHOSE quotes — overwriting it "because it is only the default"
// would silently change the From line of a company that picked it. So the
// local part is offered (shouldOfferLocal) and written only by the existing
// PATCH on /api/settings/email-domain when somebody taps the suggestion.
// The domain is prefilled into a form field the owner still has to press
// Connect on, exactly like suggestSendingDomain's website proposal.
//
// Pure and import-free apart from lib/validation.js (itself import-free), so
// the page and the route share it — the browser decides when to SHOW the
// offer with the same function the check script executes.

import { emailProblem } from "@/lib/validation";
import { isPlatformEmailDomain } from "./platformDomains";
import { suggestSendingDomain } from "./suggestSendingDomain";

/**
 * The part before the @ a company may send as. The ONE rule: the PATCH on
 * /api/settings/email-domain refuses anything else, and a suggestion that
 * rule would refuse is not offered — a one-tap button that answers 400 is a
 * control that appears to work and doesn't.
 */
export const FROM_LOCAL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

// Mailbox providers and ISPs whose domain nobody but the provider can add DNS
// records to. A company whose email is bob@gmail.com cannot send AS that
// address through any service, so proposing gmail.com as a sending domain
// would be a confident wrong answer (AGENTS.md failure class 5). Includes the
// Canadian and US ISP mailboxes contractors still run their business on.
const FREE_MAILBOX_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "passport.com",
  "yahoo.com", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com",
  "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.net", "mail.com", "zoho.com", "yandex.com", "hey.com", "fastmail.com",
  // Canada
  "videotron.ca", "sympatico.ca", "bell.net", "rogers.com", "shaw.ca", "telus.net",
  "cogeco.ca", "eastlink.ca", "sasktel.net", "mts.net",
  // United States
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net",
  "cox.net", "charter.net", "spectrum.net", "earthlink.net", "optonline.net",
]);
// Microsoft and Yahoo own every country-code variant (hotmail.ca, yahoo.co.uk,
// outlook.fr, live.ca …). Matched on the first label so a list cannot miss one.
const FREE_MAILBOX_FAMILIES = /^(hotmail|outlook|live|yahoo|windowslive)\.[a-z.]+$/;

/** Lowercased, trimmed, no trailing dot; "" for anything that isn't a string. */
export function normaliseDomain(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\.$/, "") : "";
}

/** True for a domain nobody but a mailbox provider can send as. */
export function isFreeMailboxDomain(domain) {
  const d = normaliseDomain(domain);
  if (!d) return false;
  return FREE_MAILBOX_DOMAINS.has(d) || FREE_MAILBOX_FAMILIES.test(d);
}

/**
 * The company email split into what this page can use, or null when the
 * address is blank or is not one an email can be delivered to. The same
 * emailProblem() rule that refuses it on write (business-info PATCH) and
 * keeps it out of Reply-To on send (senderFor) — a stored value that rule
 * refuses produces no proposal at all rather than a proposal built on it.
 */
export function companyEmailParts(email) {
  if (typeof email !== "string" || emailProblem(email) !== null) return null;
  const [local, domain] = email.trim().split("@");
  return { local, domain: normaliseDomain(domain) };
}

/**
 * What the company's own email suggests for its sender.
 *
 * @returns null when there is no usable company email or it is on a
 *   FieldQuo domain; otherwise
 *   { domain, freeMailbox: true }                — can't be sent as; say so
 *   { domain, freeMailbox: false, local, address } — local is null when the
 *     part before the @ is one the From PATCH would refuse (john+quotes@…),
 *     and then only the domain is proposed
 */
export function senderSuggestionFor({ email } = {}) {
  const parts = companyEmailParts(email);
  if (!parts || !parts.domain) return null;
  // fieldquo.com is a boundary (lib/email/platformDomains.js): the connect
  // route refuses it, so proposing it would be a dead end. A test company
  // with a @fieldquo.com address gets no proposal.
  if (isPlatformEmailDomain(parts.domain)) return null;
  if (isFreeMailboxDomain(parts.domain)) return { domain: parts.domain, freeMailbox: true };
  const local = parts.local.toLowerCase();
  const usable = FROM_LOCAL_PATTERN.test(local);
  return {
    domain: parts.domain,
    freeMailbox: false,
    local: usable ? local : null,
    address: usable ? `${local}@${parts.domain}` : null,
  };
}

/**
 * The domain to put in the empty "Connect a domain" field, or null.
 *
 * Only when no domain has been started — a connected (or pending) domain is
 * the company's own decision and the field isn't shown then anyway. The
 * company email's domain comes first because it is the one that makes From
 * and Reply-To the same address; the website's send. subdomain
 * (suggestSendingDomain) is the fallback for a company whose email is on a
 * free mailbox or blank.
 *
 * @returns { domain, source: "company_email" | "website" } | null
 */
export function domainPrefillFor({ email, website, emailDomain } = {}) {
  if (normaliseDomain(emailDomain)) return null;
  const s = senderSuggestionFor({ email });
  if (s && !s.freeMailbox) return { domain: s.domain, source: "company_email" };
  const fromSite = suggestSendingDomain(website);
  return fromSite ? { domain: fromSite, source: "website" } : null;
}

/**
 * Should the page OFFER "send as <company email>" for this domain?
 *
 * True only when the domain being set up or verified IS the company email's
 * domain (a send. subdomain is not: info@send.x.com is not the address the
 * client knows) and the stored local part differs. Offering is all it does —
 * the write is the tap.
 */
export function shouldOfferLocal({ suggestion, domain, emailFromLocal } = {}) {
  if (!suggestion || suggestion.freeMailbox || !suggestion.local) return false;
  if (normaliseDomain(domain) !== suggestion.domain) return false;
  return String(emailFromLocal || "quotes") !== suggestion.local;
}
