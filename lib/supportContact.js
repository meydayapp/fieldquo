// lib/supportContact.js
//
// Where "get in touch" actually goes.
//
// Several places in /app told a contractor to get in touch and gave them no way
// to do it — an action named for a reader who cannot take it, which is the
// dead-control failure AGENTS.md is about. The number-stuck banner is the worst
// of them: it appears on a number the company is being charged for, tells them
// not to buy another, and then ends.
//
// There is no in-app support inbox to point at. `/api/feedback` exists and the
// platform console reads what it writes, but nothing in /app renders a form for
// it, so linking a contractor at a route with no UI would swap one dead end for
// another. The honest answer is the address FieldQuo already publishes and
// already answers: the marketing site tells strangers to email it when a demo
// slot is missing, and /api/marketing/contact sends from it.
//
// FieldQuo's own name appearing here is fine. This is the contractor's back
// office; the white-label rule is about what a HOMEOWNER sees.
export const SUPPORT_EMAIL = "hello@fieldquo.com";

/**
 * A mailto: with the context already in it.
 *
 * The subject matters more than it looks. "My number isn't working" from an
 * address nobody recognises takes a round trip to place; the same message
 * carrying the company name and the number is answerable first time.
 */
export function supportMailto({ subject, body } = {}) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}${params.length ? `?${params.join("&")}` : ""}`;
}
