// lib/sales/playbook/selectors.js
//
// The closed vocabulary of reasons a playbook may be selected.
//
// ══ §58 is the whole file ═════════════════════════════════════════════════
//
// "Deterministic software for what software can determine. AI only where
// interpretation is genuinely valuable." Which playbook a rep opens is not
// interpretation. It is a comparison between three-valued rows we observed and
// four conditions written down here, and a rep who asks "why am I saying this?"
// has to get a rule and a list of what we saw — never "the model chose it".
//
// So: a playbook row names a selector KEY out of this list. It cannot name
// anything else, because a selector that no evaluator implements is a playbook
// that can never be selected — the dead-control failure with the button
// missing, which is the same argument OBSERVABLE_CAPABILITY_CODES makes on the
// capability side.
//
// ══ Three-valued, strictly — and this is where it costs a deal ════════════
//
// Every selector below reads capability values through the intel engine's
// `indexProspect`, whose `normaliseValue` is strict to the point of rudeness:
// only boolean `false` is false, and null (we could not look) is never absent.
// This file does NOT re-implement any of that. Opening a displacement pitch on
// a business whose site merely timed out is the same thirty-second failure
// lib/sales/intel/opportunity.js's header describes, arriving through a
// different door.
//
// ══ Evidence of an OBSERVATION is not evidence for a CLAIM ════════════════
//
// A selector returns `observationEvidenceIds`: the crawl rows behind the
// capability values it read. That is what makes the selection inspectable —
// "here are the pages we looked at" — and it is deliberately a DIFFERENT thing
// from the evidence a talking point cites. A talking point must chain back
// through a ProspectOpportunity row to something we positively saw
// (lib/sales/playbook/talkingPoints.js enforces it). A selection may be
// justified by an absence, because "they have no booking page" is a fact about
// a page that rendered.
import { OBSERVABLE_CAPABILITY_CODES } from "@/lib/sales/intel/capabilities";

/** Evidence ids off a capability row, whatever its value. Deduped, order kept. */
function evidenceOfCapability(index, code) {
  const row = index?.capByCode?.get(code);
  const ids = Array.isArray(row?.evidenceIds) ? row.evidenceIds : [];
  return [...new Set(ids.filter((id) => typeof id === "string" && id))];
}

/** The observed value for a code: true, false, or null. Never coerced. */
function valueOf(index, code) {
  const row = index?.capByCode?.get(code);
  return row ? row.value : null;
}

const WORDS = { true: "yes", false: "no", null: "not checked" };
const word = (v) => WORDS[String(v)];

/**
 * A selector: one deterministic question about a prospect.
 *
 * `needsCompetitor` is not a condition, it is a CLASSIFICATION, and
 * lib/sales/playbook/select.js turns it into a guard. A selector marked false
 * describes a gap-filling conversation, and a gap-filling conversation is the
 * wrong conversation with somebody who already runs a field-service platform —
 * see the tableStakes argument in lib/sales/intel/capabilities.js. The guard
 * exists so a superadmin cannot produce that call by raising a priority.
 */
const SELECTORS = [
  {
    key: "competitor_detected",
    label: "A competitor's platform is installed",
    needsCompetitor: true,
    reads: [],
    describe:
      "At least one technology signature marked isCompetitor was detected on their site.",
    test(index) {
      const competitors = Array.isArray(index?.competitors) ? index.competitors : [];
      const ids = [
        ...new Set(competitors.flatMap((c) => (Array.isArray(c.evidenceIds) ? c.evidenceIds : []))),
      ];
      return {
        matched: competitors.length > 0,
        observationEvidenceIds: ids,
        facts: competitors.length
          ? competitors.map((c) => ({ label: "competitor detected", value: c.technologyCode }))
          : [{ label: "competitor detected", value: "none" }],
      };
    },
  },
  {
    key: "no_website",
    label: "No website",
    needsCompetitor: false,
    reads: ["WEBSITE"],
    describe:
      "WEBSITE was observed as false — a page rendered and there is no site of their own. A null (we could not look) does not match.",
    test(index) {
      const website = valueOf(index, "WEBSITE");
      return {
        matched: website === false,
        observationEvidenceIds: evidenceOfCapability(index, "WEBSITE"),
        facts: [{ label: "WEBSITE", value: word(website) }],
      };
    },
  },
  {
    key: "website_without_booking",
    label: "A website, and no way to book on it",
    needsCompetitor: false,
    reads: ["WEBSITE", "ONLINE_BOOKING"],
    describe:
      "WEBSITE true and ONLINE_BOOKING false. Both must be real observations; either one unknown and this does not match.",
    test(index) {
      const website = valueOf(index, "WEBSITE");
      const booking = valueOf(index, "ONLINE_BOOKING");
      return {
        matched: website === true && booking === false,
        observationEvidenceIds: [
          ...new Set([
            ...evidenceOfCapability(index, "WEBSITE"),
            ...evidenceOfCapability(index, "ONLINE_BOOKING"),
          ]),
        ],
        facts: [
          { label: "WEBSITE", value: word(website) },
          { label: "ONLINE_BOOKING", value: word(booking) },
        ],
      };
    },
  },
  {
    key: "email_only_quote_request",
    label: "Quotes are requested by email, with no form",
    needsCompetitor: false,
    reads: ["WEBSITE", "EMAIL_CONTACT", "LEAD_CAPTURE_FORM"],
    // "Email-only" is composed, never stored: there is no EMAIL_ONLY_CONTACT
    // capability code and there must not be one. The detector cannot honestly
    // emit "only" — it can see an address and it can see the absence of a form,
    // and the conjunction is a rule's job. Same spelling lib/sales/intel/
    // rules.js already uses for EMAIL_ONLY_CONTACT.
    describe:
      "WEBSITE true, EMAIL_CONTACT true, LEAD_CAPTURE_FORM false. 'Only' is composed from three observations; no detector emits it.",
    test(index) {
      const website = valueOf(index, "WEBSITE");
      const email = valueOf(index, "EMAIL_CONTACT");
      const form = valueOf(index, "LEAD_CAPTURE_FORM");
      return {
        matched: website === true && email === true && form === false,
        observationEvidenceIds: [
          ...new Set([
            ...evidenceOfCapability(index, "WEBSITE"),
            ...evidenceOfCapability(index, "EMAIL_CONTACT"),
            ...evidenceOfCapability(index, "LEAD_CAPTURE_FORM"),
          ]),
        ],
        facts: [
          { label: "WEBSITE", value: word(website) },
          { label: "EMAIL_CONTACT", value: word(email) },
          { label: "LEAD_CAPTURE_FORM", value: word(form) },
        ],
      };
    },
  },
];

// Every code a selector reads has to be a code a detector emits, or the
// selector can never match. Asserted at module load rather than in a check,
// because a typo here is a playbook that silently never opens.
for (const s of SELECTORS) {
  for (const code of s.reads) {
    if (!OBSERVABLE_CAPABILITY_CODES.includes(code)) {
      throw new Error(
        `selectors.js: ${s.key} reads "${code}", which no detector emits. ` +
          "See OBSERVABLE_CAPABILITY_CODES in lib/sales/intel/capabilities.js.",
      );
    }
  }
}

export const SELECTOR_KEYS = Object.freeze(SELECTORS.map((s) => s.key));

const BY_KEY = new Map(SELECTORS.map((s) => [s.key, s]));

/** The selector, or null. A playbook naming an unknown one is refused, not guessed at. */
export function selector(key) {
  return BY_KEY.get(key) || null;
}

/** What the console offers, and what a rep reads under "why am I saying this". */
export function selectorCatalogue() {
  return SELECTORS.map((s) => ({
    key: s.key,
    label: s.label,
    describe: s.describe,
    needsCompetitor: s.needsCompetitor,
    reads: [...s.reads],
  }));
}

/**
 * Run one selector against one indexed prospect.
 *
 * @returns {{ key, matched, observationEvidenceIds, facts, describe, unknown }}
 *          `unknown` is true when the selector did not match and at least one
 *          code it reads was never observed — the difference between "we
 *          looked and it is not so" and "we have not looked", which is the
 *          sentence a rep needs and a superadmin debugging a playbook needs
 *          more.
 */
export function runSelector(key, index) {
  const s = BY_KEY.get(key);
  if (!s) {
    return {
      key,
      matched: false,
      observationEvidenceIds: [],
      facts: [],
      describe: null,
      unknown: false,
      problem: "unknown_selector",
    };
  }
  const result = s.test(index);
  const unresolved = s.reads.filter((code) => valueOf(index, code) === null);
  return {
    key: s.key,
    matched: result.matched === true,
    observationEvidenceIds: result.observationEvidenceIds || [],
    facts: result.facts || [],
    describe: s.describe,
    needsCompetitor: s.needsCompetitor,
    unknown: result.matched !== true && unresolved.length > 0,
    unresolved,
    problem: null,
  };
}
