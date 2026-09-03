// lib/sales/intel/brief.js
//
// The pre-call card: what we know about this business, what we do not, and
// what there is to say — assembled from rows, never from a model.
//
// ══ The model writes SENTENCES. That is the whole of its job ═══════════════
//
// lib/site/generateSite.js makes this argument for a contractor's website and
// it transfers without amendment: the model never chooses a section, never
// invents a service, never emits a number. Here it never decides an
// opportunity exists (the rule engine did, deterministically, per §58), never
// supplies a fact (every fact is a row), and never writes a figure (there is
// no numeric field in the schema it answers into, and any sentence containing
// a digit is dropped before it reaches the card).
//
// Everything below composes WITHOUT a model. Phrasing is an argument, and
// omitting it produces the same card in plainer words. That is the same
// property generateSite.js holds — every path falls back to something factual,
// so AI being down produces plainer copy and never a broken page.
//
// ══ KNOWN and UNKNOWN are two lists, not one list with gaps ═══════════════
//
// §21 asks for the split and AGENTS.md failure class 5 says why: absence of a
// statement is not a statement. An owner we could not find is SHOWN as
// unknown; the alternative — quietly leaving the line out — reads as "there is
// nothing to know", and a rep who opens with the wrong person's name has spent
// their one call. Spec §6 settles the owner case specifically: do not
// architect around scraping LinkedIn, and an unknown owner stays null.
//
// Three sentences that must never appear on this card, and the code that stops
// each of them:
//
//   "They have no booking page"   — unless a capability row says `false`.
//     `known()` accepts only a real boolean, so a null crawl produces an
//     UNKNOWN entry rather than an absence.
//   "They have no website"        — same rule, plus the source's own listing
//     is reported as what it is: the directory listed none.
//   "The owner is <name>"         — there is no source for it, so the line is
//     in UNKNOWN and there is no slot a model could write it into.
//
// ══ Nothing here is stored, and that is deliberate ════════════════════════
//
// The card is composed at read time from the rows, so it cannot go stale
// against them. The only thing worth caching is the part that costs money —
// the model's sentences — and the handler caches exactly that, keyed to the
// run that produced it. lib/notifications/catalog.js makes the general
// argument: a composed English sentence is composed by somebody who does not
// know who will read it.
import { OBSERVABLE_CAPABILITY_CODES } from "./capabilities";
import { looksLikeInstruction } from "@/lib/voice/transcript";

/** Bump when the composed shape changes — a cached phrasing from an older
 *  version must not be merged into a card built by a newer one. */
export const BRIEF_VERSION = "1";

/** A phrased sentence longer than this is refused rather than truncated. A cut
 *  sentence is a sentence somebody else finished, and a rep reads it aloud. */
export const MAX_SENTENCE = 240;

/** The most opportunities the model is asked to phrase. Past three a rep has
 *  run out of call, and every extra slot is another sentence to validate. */
export const MAX_PHRASED_ANGLES = 3;

/** Why a line is in the UNKNOWN column. A closed vocabulary, the shape
 *  lib/analytics/kpis.js's REASONS uses, so a screen renders the sentence and
 *  the code stays the thing that is compared. */
export const UNKNOWN_REASONS = Object.freeze({
  never_crawled: "Their website has not been read.",
  not_decided: "Their website was read and this could not be decided from it.",
  no_source: "Nothing FieldQuo can lawfully read carries this.",
  not_listed: "The directory that supplied this record did not list it.",
});

/** Strictly three-valued. Only a real boolean is a statement — the same rule
 *  opportunity.js's normaliseValue keeps, and the reason it exists. */
function known(value) {
  return value === true || value === false;
}

function text(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Human-readable capability names, for a card a rep reads at speed. A code
 *  with no entry here falls back to its own code rather than being hidden —
 *  a missing label is a cosmetic problem and dropping the line is not. */
const CAPABILITY_LABELS = Object.freeze({
  WEBSITE: "Website",
  ONLINE_BOOKING: "Online booking",
  INSTANT_ESTIMATE: "Instant estimate",
  ONLINE_PAYMENT: "Online payment",
  LEAD_CAPTURE_FORM: "Enquiry form",
  CLIENT_PORTAL: "Client portal",
  LIVE_CHAT: "Live chat",
  PUBLISHED_HOURS: "Published opening hours",
  EMAIL_CONTACT: "Email address published",
  PHONE_CONTACT: "Phone number published",
  ONLINE_REVIEWS: "Reviews on the site",
});

export function capabilityLabel(code) {
  return CAPABILITY_LABELS[code] || code;
}

/** The slot id for one opportunity's phrased sentence. One function so the
 *  builder and the validator cannot spell it differently. */
export function angleSlot(capabilityCode) {
  return `angle:${capabilityCode}`;
}

/**
 * The card.
 *
 * @param prospect       the row
 * @param capabilities   ProspectCapability rows  — { code, value, evidenceIds }
 * @param technologies   ProspectTechnology rows  — { technologyCode, isCompetitor, evidenceIds }
 * @param inferences     ProspectInference rows   — { kind, value, evidenceIds }
 * @param opportunities  ProspectOpportunity rows — { capabilityCode, rank, reason, evidenceIds, ruleCode }
 * @param score          the latest ProspectScore  — { score, reasons, scoringVersion }
 * @param phrasing       { opening, angles: { [slot]: sentence } } or null.
 *                       Validated by validatePhrasing() BEFORE it arrives here;
 *                       this function trusts it only to be strings.
 */
export function composeBrief({
  prospect = null,
  capabilities = [],
  technologies = [],
  inferences = [],
  opportunities = [],
  score = null,
  phrasing = null,
} = {}) {
  const capByCode = new Map(capabilities.filter((c) => c?.code).map((c) => [c.code, c]));
  const decided = [...capByCode.values()].filter((c) => known(c.value));
  const crawled = decided.length > 0;

  // ── Identity: what the directory said, with the directory named ─────────
  const sourceLabel = prospect?.sourceProvider
    ? `${prospect.sourceProvider}${prospect.sourceRelease ? ` ${prospect.sourceRelease}` : ""}`
    : null;

  const known_ = [];
  const unknown = [];

  const fact = (id, label, detail, extra = {}) =>
    known_.push({ id, label, detail, layer: "fact", evidenceIds: [], source: sourceLabel, ...extra });
  const gap = (id, label, reason) =>
    unknown.push({ id, label, reason, reasonText: UNKNOWN_REASONS[reason] || reason });

  fact("business_name", "Business", text(prospect?.businessName) || "(unnamed)");

  const where = [text(prospect?.city), text(prospect?.province)].filter(Boolean).join(", ");
  if (where) fact("location", "Where", where);
  else gap("location", "Where", "not_listed");

  if (text(prospect?.phoneE164)) fact("phone", "Phone", prospect.phoneE164.trim());
  else gap("phone", "Phone", "not_listed");

  if (text(prospect?.websiteUrl)) {
    fact("website", "Website", prospect.websiteUrl.trim());
  } else {
    // Exactly what it is. Not "no website" — the directory listed none, and
    // the measured fill rate says that is a gap in the directory about as
    // often as a gap in the market.
    gap("website", "Website", "not_listed");
  }

  if (text(prospect?.tradeKey)) fact("trade", "Trade", prospect.tradeKey);

  if (prospect?.sourceUpdatedAt) {
    fact("record_age", "Record last refreshed", isoDay(prospect.sourceUpdatedAt));
  } else {
    gap("record_age", "Record last refreshed", "not_listed");
  }

  // ── The owner. Always unknown unless something first-party said so ──────
  //
  // Spec §6: do not architect around scraping LinkedIn, and unknown stays
  // null. The only thing that can fill this is a prospect telling a rep on a
  // recorded call, which arrives as a `decision_maker` inference sourced
  // first-party.
  const decisionMaker = inferences.find((i) => i?.kind === "decision_maker" && text(i?.value));
  if (decisionMaker) {
    known_.push({
      id: "decision_maker",
      label: "Who decides",
      detail: decisionMaker.value,
      layer: "inference",
      evidenceIds: Array.isArray(decisionMaker.evidenceIds) ? decisionMaker.evidenceIds : [],
      source: decisionMaker.source || "derived",
    });
  } else {
    gap("decision_maker", "Who decides", "no_source");
  }

  const scale = inferences.find((i) => i?.kind === "company_scale" && text(i?.value));
  if (scale) {
    known_.push({
      id: "company_scale",
      label: "Company size",
      detail: String(scale.value).toLowerCase().replace(/_/g, " "),
      layer: "inference",
      evidenceIds: Array.isArray(scale.evidenceIds) ? scale.evidenceIds : [],
      source: scale.source || "derived",
    });
  } else {
    gap("company_scale", "Company size", crawled ? "not_decided" : "never_crawled");
  }

  // ── Capabilities: one line each, in KNOWN or in UNKNOWN, never dropped ──
  for (const code of OBSERVABLE_CAPABILITY_CODES) {
    const row = capByCode.get(code);
    if (row && known(row.value)) {
      known_.push({
        id: `capability:${code}`,
        label: capabilityLabel(code),
        detail: row.value ? "yes" : "no",
        layer: "fact",
        evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds : [],
        source: "website",
      });
    } else {
      gap(`capability:${code}`, capabilityLabel(code), row ? "not_decided" : "never_crawled");
    }
  }

  // ── Who else is in the room ─────────────────────────────────────────────
  const competitorRow = technologies.find((t) => t?.isCompetitor === true) || null;
  const competitor = competitorRow
    ? {
        technologyCode: competitorRow.technologyCode,
        evidenceIds: Array.isArray(competitorRow.evidenceIds) ? competitorRow.evidenceIds : [],
      }
    : null;

  if (competitor) {
    known_.push({
      id: `technology:${competitor.technologyCode}`,
      label: "Already running",
      detail: competitor.technologyCode,
      layer: "fact",
      evidenceIds: competitor.evidenceIds,
      source: "website",
    });
  } else if (!crawled) {
    // NOT "no competitor". Nothing was read, so nothing was ruled out.
    gap("competitor", "Competitor's platform", "never_crawled");
  }

  const otherTech = technologies.filter((t) => t?.isCompetitor !== true && t?.technologyCode);
  for (const t of otherTech) {
    known_.push({
      id: `technology:${t.technologyCode}`,
      label: "Tool in use",
      detail: t.technologyCode,
      layer: "fact",
      evidenceIds: Array.isArray(t.evidenceIds) ? t.evidenceIds : [],
      source: "website",
    });
  }

  // ── What there is to say ────────────────────────────────────────────────
  //
  // Straight from ProspectOpportunity. The deterministic `reason` is ALWAYS
  // carried, whether or not a model phrased an angle beside it: a rep must be
  // able to read the sentence the rule wrote, and a generated line that
  // replaced it would leave nothing to check the generation against.
  const ranked = [...opportunities]
    .filter((o) => o?.capabilityCode)
    .sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0));

  const angles = phrasing?.angles && typeof phrasing.angles === "object" ? phrasing.angles : {};
  const talkingPoints = ranked.map((o) => ({
    capabilityCode: o.capabilityCode,
    label: capabilityLabel(o.capabilityCode),
    rank: Number(o.rank) || 0,
    reason: o.reason || null,
    ruleCode: o.ruleCode || null,
    evidenceIds: Array.isArray(o.evidenceIds) ? o.evidenceIds : [],
    angle: text(angles[angleSlot(o.capabilityCode)]),
  }));

  // ── The opening line ────────────────────────────────────────────────────
  const opening = text(phrasing?.opening) || plainOpening({ prospect, competitor, talkingPoints, crawled });

  return {
    version: BRIEF_VERSION,
    prospectId: prospect?.id ?? null,
    opening,
    // Whether a model touched this card at all. A screen showing a generated
    // sentence has to be able to label it, and a rep is entitled to know which
    // words came from a rule and which from a model.
    phrased: Boolean(text(phrasing?.opening)) || talkingPoints.some((t) => t.angle),
    known: known_,
    unknown,
    competitor,
    talkingPoints,
    score: score ? { value: score.score ?? null, reasons: score.reasons ?? [], version: score.scoringVersion ?? null } : null,
    // Not a mood. It is the one sentence that decides how a low score reads.
    crawled,
    capabilitiesDecided: decided.length,
  };
}

/** YYYY-MM-DD, UTC. The same day discipline lib/analytics/periodPresets.js
 *  keeps: a date built from a local clock lands on the wrong side of a
 *  boundary for anybody west of Greenwich. */
function isoDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toISOString().slice(0, 10);
}

/**
 * The card with no model behind it.
 *
 * Every branch is a sentence about rows we hold. It carries no number: the
 * counts a rep needs are on the lists themselves, and a sentence saying
 * "three things to talk about" above a list of three is a second place for the
 * same fact to be wrong.
 */
export function plainOpening({ prospect, competitor, talkingPoints = [], crawled = false } = {}) {
  const name = text(prospect?.businessName) || "This business";
  const where = [text(prospect?.city), text(prospect?.province)].filter(Boolean).join(", ");
  const place = where ? ` in ${where}` : "";

  if (competitor) {
    return `${name}${place} is already running ${competitor.technologyCode}, so this is a displacement conversation rather than a gap to fill.`;
  }
  if (!crawled) {
    return `${name}${place} has not had its website read, so everything below the directory record is unknown rather than absent.`;
  }
  if (!talkingPoints.length) {
    return `${name}${place} was analysed and nothing came up that FieldQuo can point at — worth a call on the trade fit alone, not on a gap.`;
  }
  return `${name}${place} — the gaps below each cite something that was actually observed on their site.`;
}

/**
 * The closed set of places a model may write a sentence, with the material it
 * may write ABOUT.
 *
 * Built from the composed card, so a slot can only exist for something that
 * already exists. There is no slot for a fact, a number, a name, an owner or
 * an opportunity — the model cannot supply one, because there is nowhere to
 * put it.
 */
export function phrasingSlots(brief) {
  const slots = [{ slot: "opening", about: brief?.opening || "" }];
  for (const point of (brief?.talkingPoints || []).slice(0, MAX_PHRASED_ANGLES)) {
    slots.push({ slot: angleSlot(point.capabilityCode), about: point.reason || point.label });
  }
  return slots;
}

/**
 * The vendor's answer, checked.
 *
 * `strict: true` guarantees the SHAPE and nothing else — jsonSchema.js's
 * header lists what a schema structurally cannot say, and every rule below is
 * on that list. The gates, in order of what they cost when missing:
 *
 *   unknown slot     a sentence about something not on this card, which is the
 *                    model inventing a subject. Dropped.
 *   any digit        the model emitting a number. There is no numeric field in
 *                    the schema, so this is the only door left open, and it is
 *                    shut here. A count, a price, a percentage or a review
 *                    total that the model made up looks exactly as trustworthy
 *                    as one computed in code.
 *   instruction      a prompt line echoed back, caught by the same gate
 *                    lib/ai/callTranscriptDigest.js applies to a caller's own
 *                    words. Blunt, and it fails in the safe direction.
 *   too long / empty a schema cannot express maxLength or "non-empty".
 *
 * Rejection is per sentence, not per response: one bad angle should not cost
 * the opening line. `problems` names every drop, so a rejection is visible
 * rather than a card that is quietly plainer than it should be.
 */
export function validatePhrasing(raw, slots = []) {
  const allowed = new Set(slots.map((s) => s.slot));
  const problems = [];
  const phrasing = { opening: null, angles: {} };

  const accept = (slot, value) => {
    const sentence = text(value);
    if (!sentence) {
      problems.push(`${slot}: empty`);
      return null;
    }
    if (!allowed.has(slot)) {
      problems.push(`${slot}: not a slot on this brief`);
      return null;
    }
    if (sentence.length > MAX_SENTENCE) {
      problems.push(`${slot}: ${sentence.length} characters, over ${MAX_SENTENCE}`);
      return null;
    }
    if (/\d/.test(sentence)) {
      problems.push(`${slot}: contains a number, which the model does not get to supply`);
      return null;
    }
    if (looksLikeInstruction(sentence)) {
      problems.push(`${slot}: shaped like an instruction rather than a sentence`);
      return null;
    }
    return sentence;
  };

  phrasing.opening = accept("opening", raw?.opening);

  const seen = new Set();
  for (const entry of Array.isArray(raw?.angles) ? raw.angles : []) {
    const slot = text(entry?.slot);
    if (!slot) {
      problems.push("angle: no slot named");
      continue;
    }
    if (seen.has(slot)) {
      // Two sentences for one slot is the model answering twice. Keeping the
      // first is arbitrary; keeping neither would lose a good line. The first
      // is kept and the second is named.
      problems.push(`${slot}: a second sentence for a slot already answered`);
      continue;
    }
    seen.add(slot);
    const sentence = accept(slot, entry?.sentence);
    if (sentence) phrasing.angles[slot] = sentence;
  }

  const usable = Boolean(phrasing.opening) || Object.keys(phrasing.angles).length > 0;
  return { ok: usable, phrasing: usable ? phrasing : null, problems };
}

/**
 * The JSON Schema the model answers into, built for THIS prospect.
 *
 * The slot list is an `enum`, so the vendor constrains generation to slots
 * that exist rather than validatePhrasing dropping invented ones after the
 * tokens are paid for. Both still run: the enum is one vendor's promise, and
 * provider.js exists because the vendor can change.
 *
 * NOTHING in here is a number. No price, no total, no amount, no cost, no
 * quantity, no count, no confidence, no score. Adding one would be the
 * cheapest possible way to start believing a model's arithmetic — see
 * lib/ai/jsonSchema.js's closing section, which makes the argument at length.
 */
export function briefSchema(slots = []) {
  const names = slots.map((s) => s.slot);
  return {
    type: "object",
    additionalProperties: false,
    required: ["opening", "angles"],
    properties: {
      opening: { type: "string" },
      angles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "sentence"],
          properties: {
            slot: { type: "string", ...(names.length ? { enum: names } : {}) },
            sentence: { type: "string" },
          },
        },
      },
    },
  };
}

/**
 * What the model is shown.
 *
 * Only the material that is already on the card, and only as sentences to
 * rewrite. It is given no rows, no ids, no counts and no evidence — there is
 * nothing for it to source from, because sourcing is not its job.
 */
export function phrasingPrompt(brief, slots = []) {
  const lines = slots.map((s) => `${s.slot}\n${s.about}`);
  return [
    "Rewrite each of the following notes as ONE natural sentence a salesperson could say out loud.",
    "",
    "Rules:",
    "- Keep every claim exactly as strong as it arrives. Do not add a fact, a name, a figure or a guess.",
    "- Never write a number, a digit, a count, a price or a percentage.",
    "- Say nothing about what this business does NOT have unless the note says it.",
    "- One sentence each. No lists, no greeting, no sign-off.",
    "",
    "Notes:",
    "",
    lines.join("\n\n"),
  ].join("\n");
}

/** The system turn. Short on purpose: the constraint that matters is in the
 *  schema and in validatePhrasing, not in a sentence a model may ignore. */
export const PHRASING_SYSTEM =
  "You rewrite sales notes into plain spoken sentences. You never introduce a fact, a name or a number " +
  "that is not in the note you were given. If a note cannot be rewritten without inventing something, " +
  "repeat it as plainly as you can.";
