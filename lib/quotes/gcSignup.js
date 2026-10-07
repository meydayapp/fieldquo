// lib/quotes/gcSignup.js
//
// A general contractor signing up from a subcontractor's quote — what the
// signup and the welcome questions may be prefilled with, and from where.
// Owner 2026-10-06 (gap 1 of the GC on-ramp brief).
//
// ══ The exposure rule, and why it is a function rather than a promise ═══════
//
// The owner's rule: the prefill shows the token holder NOTHING the quote page
// (/q/<token>) does not already show them. The token is a bearer credential —
// whoever holds the link (the GC, or anyone the GC forwarded it to) sees the
// page, so the page is the boundary.
//
// What the page shows of the CLIENT (the GC) is exactly one fact today: the
// name under "Prepared for" (app/api/public/quotes/[token]/route.js returns
// `client: { name }` and nothing else). The email, phone, office address and
// contact person the sub holds are on the PDF attached to the sub's email,
// not on the page — so they are NOT prefilled, however useful they would be.
//
// To make that impossible to get wrong later, the public quote route builds
// its `client` object with quotePageClientFacts() below, and the prefill is
// built ONLY from that object. If the page is ever made to show more about
// the client, the prefill follows, and never before. check:gc-onramp feeds
// a client row full of private fields through both and fails on any prefill
// value the page object does not carry.
//
// Pure: no I/O. Imported by the public route, the received-quote route, the
// welcome page and the check script.

import { shareTokenFromLink, isShareTokenShape } from "@/lib/quotes/addToQuoteLink";

const clean = (v, max) =>
  typeof v === "string"
    ? v
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/**
 * The client facts /q/<token> shows the token holder. The public quote route
 * returns exactly this object as `client` — one source for the page and the
 * prefill.
 */
export function quotePageClientFacts(client) {
  return { name: String(client?.name || "") };
}

/**
 * The page fact each prefill field may come from. A field whose fact the
 * page does not carry is simply absent.
 */
const PREFILL_FROM_FACT = Object.freeze({
  companyName: { fact: "name", max: 120 },
  email: { fact: "email", max: 254 },
  phone: { fact: "phone", max: 40 },
  address: { fact: "address", max: 300 },
  contactName: { fact: "contactName", max: 160 },
});

/**
 * The signup / welcome prefill, from the quote page's own client facts.
 *
 * @param facts quotePageClientFacts(client) — never the client row itself
 * @returns { companyName?, email?, phone?, address?, contactName? }
 */
export function gcSignupPrefill(facts) {
  const out = {};
  if (!facts || typeof facts !== "object") return out;
  for (const [field, { fact, max }] of Object.entries(PREFILL_FROM_FACT)) {
    if (!Object.hasOwn(facts, fact)) continue;
    const v = clean(facts[fact], max);
    // A name with markup is not prefilled: the welcome screen would refuse
    // it anyway (lib/signup/welcome.js), and a prefill the GC has to fix is
    // worse than none.
    if (v && !/[<>]/.test(v)) out[field] = v;
  }
  return out;
}

/** The share token in a /q/<token>/add path, or null. */
export function addPathToken(path) {
  const raw = String(path || "");
  if (!/^\/q\/[A-Za-z0-9_-]{20,128}\/add\/?$/.test(raw)) return null;
  const token = shareTokenFromLink(raw);
  return isShareTokenShape(token) ? token : null;
}
