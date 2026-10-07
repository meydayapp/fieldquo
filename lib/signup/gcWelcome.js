// lib/signup/gcWelcome.js
//
// Is this owner a general contractor who signed up to add a subcontractor's
// price to their own quote — and if so, which welcome screens do they get,
// and what may those screens be prefilled with?
//
// The signal is the add-to-quote cookie (lib/quotes/addToQuoteLink.js
// ADD_TO_QUOTE_COOKIE) that /q/<token>/add and /signup leave: it names a share
// token, nothing else. It is re-checked against the database on every
// request — a cookie naming a draft, an unknown token or a malformed value is
// treated exactly as no cookie (the full welcome list, no prefill).
//
// The prefill is lib/quotes/gcSignup.js's, built from the same client object
// the public quote page returns — the exposure rule lives there.
//
// One server helper for the three readers that must agree on the list: the
// welcome page, PATCH /api/signup/personalize and POST /api/signup/setup.

import { db as defaultDb } from "@/lib/db";
import { ADD_TO_QUOTE_COOKIE, isShareTokenShape } from "@/lib/quotes/addToQuoteLink";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";
import { gcSignupPrefill, quotePageClientFacts } from "@/lib/quotes/gcSignup";
import { GC_WELCOME_STEPS, WELCOME_STEPS } from "@/lib/signup/welcome";

/** The share token in a Cookie header's add-to-quote cookie, or null. Pure. */
export function addToQuoteTokenFromCookies(cookieHeader) {
  for (const part of String(cookieHeader || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== ADD_TO_QUOTE_COOKIE) continue;
    const value = part.slice(i + 1).trim();
    return isShareTokenShape(value) ? value : null;
  }
  return null;
}

/**
 * The welcome screens' prefill (lib/signup/welcomeState.js welcomePrefill)
 * with the GC's own details from the sub's quote poured into the BLANKS only
 * — an answer the owner already gave is never replaced. Pure.
 *
 *   contactName → first / last name   phone → phone
 *   companyName → business name       address → the address box (the owner
 *                                       still picks it from the list: the
 *                                       country comes from the place they
 *                                       choose, never from a guess)
 */
export function withGcPrefill(prefill, gc = {}) {
  const user = { ...(prefill?.user || {}) };
  const company = { ...(prefill?.company || {}) };
  if (gc.contactName && !user.firstName && !user.lastName) {
    const words = gc.contactName.split(/\s+/).filter(Boolean);
    user.firstName = words[0] || "";
    user.lastName = words.slice(1).join(" ");
  }
  if (gc.phone && !user.phone) user.phone = gc.phone;
  if (gc.companyName && !company.name) company.name = gc.companyName;
  if (gc.address && !company.address) company.address = gc.address;
  return { ...prefill, user, company };
}

/**
 * @param cookieHeader  the request's Cookie header
 * @returns {{ gc: boolean, steps: string[], prefill: object, senderName: string|null }}
 *          — `gc: false` with the full list when there is no valid hand-off.
 */
export async function gcWelcomeContext(cookieHeader, { prisma = defaultDb } = {}) {
  const none = { gc: false, steps: WELCOME_STEPS, prefill: {}, senderName: null };
  const token = addToQuoteTokenFromCookies(cookieHeader);
  if (!token) return none;
  let quote = null;
  try {
    quote = await prisma.quote.findFirst({
      where: { shareToken: token },
      // The fields quotePageClientFacts may show — it decides which (by type).
      select: {
        status: true,
        client: { select: { name: true, type: true, contactName: true, email: true, phone: true, address: true } },
        company: { select: { name: true } },
      },
    });
  } catch {
    return none;
  }
  if (!quote || !isPubliclyReadable(quote.status)) return none;
  return {
    gc: true,
    steps: GC_WELCOME_STEPS,
    prefill: gcSignupPrefill(quotePageClientFacts(quote.client)),
    // Shown on /q/<token> as the document's sender — not new to the reader.
    senderName: quote.company?.name || null,
  };
}
