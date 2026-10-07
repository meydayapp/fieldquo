// lib/clients/businessQuestion.js
//
// "Is <name> a business (a contractor you work for)?" — the sub side of the
// GC on-ramp (owner 2026-10-06, gap 4).
//
// ══ Why ask at all ═════════════════════════════════════════════════════════
//
// The quote email carries "Add this price to your own quote →" to a BUSINESS
// client only — Client.type === "company" (lib/quotes/addToQuoteLink.js). The
// type defaults to "individual", and a sub who typed "Northline Builders Ltd"
// into the quick-add without touching the toggle sends a quote to a general
// contractor that silently lacks the line. Nothing about that is visible to
// the sub; the GC simply never learns the price can go into their own quote.
//
// ══ Why ask, rather than decide ════════════════════════════════════════════
//
// A name that reads like a company's is a GUESS. Flipping the type on a guess
// would put the line in front of a homeowner whose name happens to contain
// "Homes" — and the line is the one place the homeowner's email points at a
// page that is not the contractor's. So the guess decides only whether to
// ASK; the answer is the sub's statement, and it is asked ONCE
// (Client.businessAskedAt), whichever way it goes.
//
// Pure: no I/O. GET/POST /api/clients/[id]/business-answer and
// scripts/check-gc-onramp.mjs import it.

// Words that, standing alone in a name, say "this is a business". Word
// boundaries throughout: "Coates" is not "co", "Homesley" is not "homes".
// Legal forms first (English, French, German, Spanish, Italian — the client
// languages), then the trade words a contractor's customer-businesses use.
const LEGAL_FORMS = [
  "inc", "incorporated", "ltd", "limited", "llc", "llp", "lp", "corp", "corporation", "co", "company",
  "ltée", "ltee", "limitée", "limitee", "enr", "senc", "gmbh", "ag", "kg", "sa", "sas", "sarl", "sl", "srl", "spa",
  "pty", "plc",
];
const TRADE_WORDS = [
  "construction", "constructions", "contracting", "contractor", "contractors", "builders", "building", "build",
  "renovation", "renovations", "reno", "renos", "homes", "group", "enterprises", "enterprise", "services",
  "development", "developments", "developers", "properties", "property", "management", "holdings", "realty",
  "solutions", "associates", "partners", "industries", "restoration", "remodeling", "remodelling",
  "general", "gc", "design", "interiors", "projects",
];

const WORD = new Set([...LEGAL_FORMS, ...TRADE_WORDS]);

/**
 * Does this name read like a company's? A heuristic that only ever decides
 * whether to ASK — never what the client is.
 */
export function looksLikeBusinessName(name) {
  const s = String(name ?? "").toLowerCase().normalize("NFC");
  if (!s.trim()) return false;
  // "& Sons", "Bros." — family-firm shapes.
  if (/&\s*(sons?|daughters?|fils|co)\b/.test(s) || /\bbros\b\.?/.test(s)) return true;
  const words = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.some((w) => WORD.has(w));
}

/**
 * Should the send dialog ask about this client? An individual, never asked
 * before, whose name reads like a company's. Anything else — already a
 * company, already answered, a homeowner's ordinary name — asks nothing.
 *
 * @param client { type, name, businessAskedAt }
 */
export function shouldAskIfBusiness(client) {
  if (!client || typeof client !== "object") return false;
  if (client.type === "company") return false;
  if (client.businessAskedAt) return false;
  return looksLikeBusinessName(client.name);
}

/** The two answers the route accepts. Anything else is refused. */
export const BUSINESS_ANSWERS = Object.freeze(["business", "individual"]);

/**
 * The write an answer makes. "business" makes the client a company — the
 * same field the client form's toggle sets — and both answers stamp the
 * question as asked so it never comes back.
 */
export function businessAnswerUpdate(answer, now = new Date()) {
  if (!BUSINESS_ANSWERS.includes(answer)) return null;
  return answer === "business"
    ? { type: "company", businessAskedAt: now }
    : { businessAskedAt: now };
}
