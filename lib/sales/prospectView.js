// lib/sales/prospectView.js
//
// Everything a screen needs to show a prospect WITHOUT collapsing the three
// layers into one.
//
// ══ Why a module and not JSX ══════════════════════════════════════════════
//
// The spec's §2 rule — fact, inference and recommendation stay separate in the
// database AND in the UI — is the whole reason ProspectCapability,
// ProspectInference and ProspectOpportunity are three tables instead of one
// wide row. Two screens now render all three, and a rule enforced by "the two
// page files both remember to do it" is a rule that lasts until the third
// screen. So the decision of what a row is ALLOWED to say lives here, in
// functions with no React in them, and the pages are the dumb half.
//
// That also makes the rule executable. scripts/check-prospect-ui.mjs runs these
// against a capability that is false, the same capability that is null, an
// inference with no confidence, an opportunity with no evidence, a
// do-not-contact prospect, another rep's claim, a lapsed claim and an empty
// queue — none of which can be proven by reading a component.
//
// ══ The layer contract is NOT re-implemented here ═════════════════════════
//
// presentCapability / presentInference / presentOpportunity in
// lib/sales/intel/confidence.js already decide `layer` and `verified`, and
// their headers argue why an inference is `verified: false` at confidence 1.0.
// This file CALLS them and never recomputes what they decided. A second
// opinion about what is verified is exactly how the two answers drift, and the
// one that drifts is the one on screen in front of a rep.
//
// What this file adds is the sentence: given a presented row, what may a
// human say out loud, and what must they not.
//
// ══ No database, on purpose ══════════════════════════════════════════════
//
// Nothing here imports @/lib/db. The where-fragments are returned as plain
// objects for the routes to use, the same shape lib/sales/scope.js's
// assignedCompanyWhere() returns, so a check can execute the SCOPING RULE
// against fixture rows without a Postgres and without a stub.
import {
  LAYER_FACT,
  LAYER_INFERENCE,
  LAYER_RECOMMENDATION,
  presentCapability,
  presentInference,
  presentOpportunity,
} from "@/lib/sales/intel/confidence";

export { LAYER_FACT, LAYER_INFERENCE, LAYER_RECOMMENDATION };

/**
 * What a layer is called on screen, and the one-line explanation under it.
 *
 * Written down once because the three words are the entire user interface for
 * §2: a rep who cannot tell an observation from an argument will read an
 * argument out as an observation.
 */
export const LAYER_HEADINGS = Object.freeze({
  [LAYER_FACT]: {
    title: "What we observed",
    note: "Facts. Each one was seen, or deliberately looked for and not seen.",
  },
  [LAYER_INFERENCE]: {
    title: "What we infer",
    note: "Conclusions the evidence supports and does not prove. Never say one as a fact.",
  },
  [LAYER_RECOMMENDATION]: {
    title: "What to pitch",
    note: "Arguments built from the two above. Each carries the reason it fired.",
  },
});

/**
 * How long an unworked claim holds a prospect.
 *
 * ── Honestly not a superadmin setting ────────────────────────────────────
 *
 * The owner's standing rule 1 says every setting is editable from the console,
 * and this one is not: no column holds it, and prisma/schema.prisma is settled.
 * It is a constant, the same position DETECTION_THRESHOLD and MATCH_THRESHOLD
 * hold today, and the platform screen SAYS it is a constant rather than
 * rendering a field that would not persist. Adding the column is a small build
 * and belongs with the other pipeline settings, not smuggled in behind a
 * control that lies.
 */
export const CLAIM_HOURS = 48;

/** Prisma Decimal, a number, a numeric string, or nothing. */
function num(v) {
  if (v == null) return null;
  if (typeof v === "object" && typeof v.toNumber === "function") {
    const n = v.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function when(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════════════════════════════════════
// Evidence → confidence signals
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ProspectEvidence.type → the signal name lib/sales/intel/confidence.js knows.
 *
 * The two vocabularies were written apart — evidence types are what a detector
 * emits, signal names are what a weight is keyed on — and this is the only
 * place they meet. An evidence type with no entry contributes NOTHING rather
 * than a middle weight, which is confidence.js's own rule for an unknown
 * signal and the reason a typo cannot quietly score 0.5.
 */
export const SIGNAL_BY_EVIDENCE_TYPE = Object.freeze({
  script_src: "detection.script_src",
  iframe_host: "detection.iframe_host",
  schema_org: "detection.schema_org",
  google_field: "detection.google_field",
  form: "detection.form",
  meta: "detection.meta",
  link: "detection.link",
  page_content: "detection.page_content",
  transcript: "detection.transcript",
});

/**
 * The signal names behind a row, from the evidence ids it cites.
 *
 * @param {string[]} evidenceIds
 * @param {Map<string, {type: string}>|object} byId  evidence rows, by id
 */
export function signalsFor(evidenceIds, byId) {
  const get =
    byId instanceof Map ? (id) => byId.get(id) : (id) => (byId ? byId[id] : undefined);
  const out = [];
  for (const id of Array.isArray(evidenceIds) ? evidenceIds : []) {
    const signal = SIGNAL_BY_EVIDENCE_TYPE[get(id)?.type];
    if (signal) out.push(signal);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Layer 1 — facts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The three sentences a capability can produce, per code.
 *
 * `no` and `unknown` are DIFFERENT SENTENCES and that is the point of the
 * table. "No online booking" and "we don't know whether they book online" are
 * different claims, and a rep who reads the second as the first tells a
 * contractor they have no booking page while the contractor is looking at one.
 *
 * `unknown` deliberately never contains the word "no".
 */
const CAPABILITY_WORDS = Object.freeze({
  WEBSITE: {
    subject: "Website",
    yes: "Has a website of their own",
    no: "No website — we looked and there is none",
    unknown: "Website: not established",
  },
  ONLINE_BOOKING: {
    subject: "Online booking",
    yes: "Books jobs online",
    no: "No online booking on their site",
    unknown: "Online booking: not established",
  },
  INSTANT_ESTIMATE: {
    subject: "Instant estimate",
    yes: "Gives a price on the site",
    no: "No instant estimate on their site",
    unknown: "Instant estimate: not established",
  },
  ONLINE_PAYMENT: {
    subject: "Online payment",
    yes: "Takes payment online",
    no: "No way to pay online",
    unknown: "Online payment: not established",
  },
  LEAD_CAPTURE_FORM: {
    subject: "Enquiry form",
    yes: "Has an enquiry form",
    no: "No enquiry form — email or phone only",
    unknown: "Enquiry form: not established",
  },
  CLIENT_PORTAL: {
    subject: "Client portal",
    yes: "Has a client login",
    no: "No client portal",
    unknown: "Client portal: not established",
  },
  LIVE_CHAT: {
    subject: "Live chat",
    yes: "Has live chat",
    no: "No live chat",
    unknown: "Live chat: not established",
  },
  PUBLISHED_HOURS: {
    subject: "Opening hours",
    yes: "Publishes opening hours",
    no: "Publishes no opening hours at all",
    unknown: "Opening hours: not established",
  },
  EMAIL_CONTACT: {
    subject: "Email address",
    yes: "Publishes an email address",
    no: "Publishes no email address",
    unknown: "Email address: not established",
  },
  PHONE_CONTACT: {
    subject: "Phone number",
    yes: "Publishes a phone number",
    no: "Publishes no phone number",
    unknown: "Phone number: not established",
  },
  ONLINE_REVIEWS: {
    subject: "Reviews on the site",
    yes: "Shows reviews on their site",
    no: "Shows no reviews on their site",
    unknown: "Reviews on the site: not established",
  },
});

/** A code with no entry still renders — as its own code, never as a guess. */
function wordsFor(code) {
  return (
    CAPABILITY_WORDS[code] || {
      subject: String(code || "Unknown capability"),
      yes: `${code}: yes`,
      no: `${code}: we looked and found none`,
      unknown: `${code}: not established`,
    }
  );
}

/**
 * What may be SAID about one capability.
 *
 * Three-valued out to the screen, and the three branches produce three
 * different `state`s, three different sentences and three different tones. A
 * renderer cannot accidentally paint "no" and "don't know" the same, because
 * it is not handed the same values for them.
 *
 *   state "has"      value true
 *   state "gap"      value false — WE LOOKED. This is a finding.
 *   state "unknown"  value null  — we could not look. This is not a finding.
 *
 * `sayable` is what decides whether a rep may assert this on a call. It is
 * false for every unknown (there is no statement to assert) and false for a
 * finding the evidence does not VERIFY — `verified` comes from
 * presentCapability, which computes it from the kind of signal and never from
 * the number.
 */
export function capabilityStatement(row, { rules = [], evidenceById = null } = {}) {
  const presented = presentCapability(
    { ...row, signals: signalsFor(row?.evidenceIds, evidenceById) },
    { rules },
  );
  const words = wordsFor(presented.code);

  if (presented.value === null) {
    return {
      ...presented,
      layer: LAYER_FACT,
      subject: words.subject,
      state: "unknown",
      known: false,
      text: words.unknown,
      // The whole reason this function exists. Never merge this branch with
      // the one below, however tempting the shared shape looks.
      detail: "We could not look, so nothing is claimed either way. Ask them.",
      sayable: false,
      tone: "unknown",
    };
  }

  const state = presented.value ? "has" : "gap";
  return {
    ...presented,
    layer: LAYER_FACT,
    subject: words.subject,
    state,
    known: true,
    text: presented.value ? words.yes : words.no,
    detail: presented.value
      ? null
      : "We looked at the pages that rendered and this was not on any of them.",
    sayable: presented.verified === true,
    tone: state,
  };
}

/**
 * The facts that live on the Prospect row itself — name, place, rating.
 *
 * Every one is three-valued in the same way a capability is: a missing rating
 * is "the source did not say", never a zero and never a blank cell that reads
 * as a bad score. AGENTS.md failure class 5 is padding absent data with
 * defaults, and a 0.0 star rating is the most damaging default available here.
 */
export function prospectFacts(prospect = {}) {
  const rating = num(prospect.googleRating);
  const reviews = Number.isFinite(Number(prospect.googleReviewCount))
    ? Number(prospect.googleReviewCount)
    : null;
  const place = [prospect.city, prospect.province, prospect.country].filter(Boolean).join(", ");
  const refreshed = when(prospect.sourceUpdatedAt);

  const rows = [
    {
      key: "businessName",
      label: "Business",
      known: Boolean(prospect.businessName),
      text: prospect.businessName || "No name on this record",
    },
    {
      key: "location",
      label: "Where",
      known: Boolean(place || prospect.addressLine),
      text: [prospect.addressLine, place].filter(Boolean).join(" · ") || "No address on this record",
    },
    {
      key: "phone",
      label: "Phone",
      known: Boolean(prospect.phoneE164),
      text: prospect.phoneE164 || "No phone number on this record",
    },
    {
      key: "rating",
      label: "Rating",
      known: rating !== null,
      text: rating === null ? "The source listed no rating" : `${rating.toFixed(1)} out of 5`,
    },
    {
      key: "reviews",
      label: "Reviews",
      known: reviews !== null,
      text: reviews === null ? "The source listed no review count" : `${reviews} review${reviews === 1 ? "" : "s"}`,
    },
    {
      key: "website",
      label: "Website",
      // hasWebsite is three-valued on the Prospect row for the reason its
      // schema comment gives, and it keeps all three here.
      known: prospect.hasWebsite === true || prospect.hasWebsite === false,
      text:
        prospect.hasWebsite === true
          ? prospect.websiteUrl || "Has a website"
          : prospect.hasWebsite === false
            ? "No website — we looked"
            : prospect.websiteUrl
              ? `${prospect.websiteUrl} — listed, not yet checked`
              : "The source listed no website. That is a gap in the directory as often as a gap in the market.",
    },
    {
      key: "businessStatus",
      label: "Still trading?",
      known: Boolean(prospect.businessStatus),
      // Overture only ever says `open` or nothing, so a null here genuinely
      // means the directory does not know — including for businesses that
      // have shut. Never rendered as "open".
      text: prospect.businessStatus || "The source did not say. Some of these have closed.",
    },
    {
      key: "sourceUpdatedAt",
      label: "Source last refreshed",
      known: Boolean(refreshed),
      text: refreshed ? refreshed.toISOString().slice(0, 10) : "The source did not say when",
    },
  ];

  return rows.map((r) => ({ ...r, layer: LAYER_FACT }));
}

/** A detected technology, as a fact with the competitor question answered. */
export function technologyStatement(row = {}) {
  const competitor = row.isCompetitor === true;
  return {
    layer: LAYER_FACT,
    code: row.technologyCode ?? null,
    name: row.name || row.technologyCode || "Unknown technology",
    isCompetitor: competitor,
    confidence: num(row.confidence),
    evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds : [],
    signatureVersion: row.signatureVersion ?? null,
    text: competitor
      ? `Running ${row.name || row.technologyCode} — a field-service platform. This is a displacement conversation.`
      : `Running ${row.name || row.technologyCode}.`,
    tone: competitor ? "competitor" : "adjacent",
  };
}

/**
 * "No competitor detected" is NOT the same as "no competitor".
 *
 * The same null-versus-false trap one level up: a prospect nothing has crawled
 * has no ProspectTechnology rows, and reading an empty list as "they use
 * nothing" is how a rep opens with a displacement pitch at somebody who has
 * never had a website crawled at all.
 */
export function competitorSummary({ technologies = [], lastCrawledAt = null } = {}) {
  const competitors = technologies.filter((t) => t.isCompetitor === true);
  if (competitors.length > 0) {
    return {
      known: true,
      present: true,
      competitors: competitors.map((t) => technologyStatement(t)),
      text: `Competitor detected: ${competitors
        .map((t) => t.name || t.technologyCode)
        .join(", ")}.`,
    };
  }
  if (!when(lastCrawledAt)) {
    return {
      known: false,
      present: null,
      competitors: [],
      text: "Nothing has crawled this business yet, so we do not know what software they run.",
    };
  }
  return {
    known: true,
    present: false,
    competitors: [],
    text: "No competitor platform was detected on the pages we could read.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Layer 2 — inferences
// ═══════════════════════════════════════════════════════════════════════════

/** SOLO_LIKELY → "Solo likely". A bucket read back as words, never a count. */
function humanBucket(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * What may be SAID about one inference — or a refusal to render it.
 *
 * ── Two refusals, both deliberate ────────────────────────────────────────
 *
 * 1. NO CONFIDENCE, NO CLAIM. presentInference always returns a confidence
 *    envelope, and that envelope's `value` is null when nothing behind the row
 *    is a signal this engine recognises. Rendering the claim anyway would put
 *    "Small team" on screen beside nothing — indistinguishable, to a rep
 *    reading it at 8am, from an observation. An inference without its
 *    confidence is not a weaker inference; it is a fact-shaped sentence, which
 *    is the one thing §2 exists to prevent.
 *
 * 2. A NUMBER IS NOT A BUCKET. ProspectInference.value is a CLASSIFICATION —
 *    the schema comment is explicit, "several vans in a photo support 'small
 *    team' and do not support 'eleven employees'". A stored value carrying a
 *    digit means something upstream wrote a count into a bucket column, and
 *    the screen refuses it rather than reading it out.
 *
 * Both return `renderable: false` with the reason, which the page prints. That
 * is louder than dropping the row, and a dropped row is how a bad writer goes
 * unnoticed.
 */
export function inferenceStatement(row, { rules = [], evidenceById = null } = {}) {
  const presented = presentInference(
    { ...row, signals: signalsFor(row?.evidenceIds, evidenceById) },
    { rules },
  );

  const confidence = presented.confidence;
  const value = confidence && typeof confidence === "object" ? confidence.value : null;
  if (value === null || value === undefined) {
    return {
      layer: LAYER_INFERENCE,
      kind: presented.kind,
      renderable: false,
      refusal:
        "An inference is only shown with how sure we are. Nothing behind this one is a signal the " +
        "confidence engine recognises, so there is no figure to show and the claim is withheld.",
      confidence,
      verified: false,
    };
  }

  if (/\d/.test(String(presented.value ?? ""))) {
    return {
      layer: LAYER_INFERENCE,
      kind: presented.kind,
      renderable: false,
      refusal:
        "This inference carries a number. ProspectInference.value is a classification — \"small team\", " +
        "never \"twelve employees\" — so it is withheld rather than read out as a count.",
      confidence,
      verified: false,
    };
  }

  return {
    layer: LAYER_INFERENCE,
    kind: presented.kind,
    renderable: true,
    // Never `verified`. presentInference hard-codes that and this passes it
    // through rather than re-deciding it.
    verified: presented.verified,
    value: presented.value,
    text: humanBucket(presented.value),
    kindText: humanBucket(presented.kind),
    confidence,
    confidenceText: `${Math.round(value * 100)}% confident`,
    source: presented.source,
    sourceText:
      presented.source === "call"
        ? "They said this on a call — first-party, and still an inference."
        : "Derived from what we observed.",
    evidenceIds: presented.evidenceIds,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Layer 3 — recommendations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What may be SAID about one opportunity — or a refusal to render it.
 *
 * ProspectOpportunity's schema comment: "A recommendation with no evidenceIds
 * is the generic sales filler the brief exists to prevent, so the absence is
 * visible rather than plausible." Visible means ON SCREEN. buildOpportunities
 * already refuses to store one, so a row here with no citation means something
 * wrote around the gate — and hiding it would hide the bug as well as the row.
 *
 * The reason is required for the same reason: `reason` is what the rep says
 * out loud. A recommendation with a blank reason is a capability name with no
 * argument attached, which is the filler under a different spelling.
 */
export function opportunityStatement(row, { capabilityName = null } = {}) {
  const presented = presentOpportunity(row);
  const base = {
    layer: LAYER_RECOMMENDATION,
    capabilityCode: presented.capabilityCode,
    name: capabilityName || presented.capabilityCode || "Unnamed capability",
    rank: presented.rank,
    verified: presented.verified,
    ruleCode: presented.ruleCode,
    ruleVersion: presented.ruleVersion,
    evidenceIds: presented.evidenceIds,
    confidence: presented.confidence,
  };

  if (base.evidenceIds.length === 0) {
    return {
      ...base,
      renderable: false,
      refusal:
        "This recommendation cites no evidence. It is shown as broken rather than read out — a pitch " +
        "with nothing behind it is the generic sales filler the evidence gate exists to stop.",
    };
  }

  if (!presented.reason || !String(presented.reason).trim()) {
    return {
      ...base,
      renderable: false,
      refusal: "This recommendation carries no reason, so there is nothing to say beyond the feature name.",
    };
  }

  const conf = presented.confidence?.value;
  return {
    ...base,
    renderable: true,
    reason: presented.reason,
    confidenceText:
      conf === null || conf === undefined
        ? "No confidence figure — treat this as untested."
        : `${Math.round(conf * 100)}% confident`,
    // The weakest-link sentence, when confidence.js supplied one.
    confidenceNote: presented.confidence?.reasonText || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ownership — who is allowed to phone this contractor right now
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The statuses a Prospect can hold, and what each means on a screen.
 *
 * Read off what the pipeline actually writes — lib/sales/discovery/ingest.js
 * writes `discovered` and `needs_review`, and the campaign review route writes
 * `rejected` — rather than invented. A filter offering a status nothing writes
 * is a control that returns nothing forever, which is the dead control under
 * another name.
 */
export const PROSPECT_STATUS_LABELS = Object.freeze({
  discovered: "Discovered — workable",
  needs_review: "Needs review — held out of every queue",
  rejected: "Rejected by a human",
});

export const CLAIM_STATES = Object.freeze([
  "unclaimed",
  "mine",
  "mine_worked",
  "held",
  "held_worked",
  "lapsed",
]);

/**
 * Whose claim is this, and is it still alive.
 *
 * The columns are Prospect.assignedRepId / assignedAt / claimExpiresAt, and
 * the schema's own comment sets the vocabulary: `claimExpiresAt` is "null for a
 * prospect that has actually been worked — a real conversation is not a lease".
 * So three shapes, not two:
 *
 *   no rep                       unclaimed
 *   rep + expiry in the future   an active lease
 *   rep + expiry in the past     lapsed, back in the pool
 *   rep + NO expiry              worked. Permanent, never lapses.
 *
 * A lapsed claim reports the previous holder in `holderId` — the row is
 * available, and who had it is still worth showing to whoever picks it up.
 */
export function claimState(prospect = {}, { repId = null, now = new Date() } = {}) {
  const holderId = prospect.assignedRepId || null;
  const expires = when(prospect.claimExpiresAt);
  const at = when(now) || new Date();
  const mine = Boolean(holderId) && holderId === repId;

  if (!holderId) {
    return { state: "unclaimed", holderId: null, mine: false, expiresAt: null, text: "Unclaimed." };
  }

  if (!expires) {
    return {
      state: mine ? "mine_worked" : "held_worked",
      holderId,
      mine,
      expiresAt: null,
      text: mine
        ? "You worked this one. It stays yours — a real conversation is not a lease."
        : "Another rep has worked this one. It does not lapse.",
    };
  }

  if (expires.getTime() <= at.getTime()) {
    return {
      state: "lapsed",
      holderId,
      mine: false,
      expiresAt: expires,
      text: "This claim lapsed without being worked, so the prospect is back in the pool.",
    };
  }

  return {
    state: mine ? "mine" : "held",
    holderId,
    mine,
    expiresAt: expires,
    text: mine
      ? `Yours until ${expires.toISOString().slice(0, 16).replace("T", " ")} UTC.`
      : "Another rep has claimed this one. Two reps must never phone the same contractor.",
  };
}

/**
 * May this prospect be contacted at all, right now?
 *
 * do-not-contact first and unconditionally: it is set on the row precisely so
 * it survives every pipeline transition, and it outranks having a phone number,
 * an active claim or anything else. Everything that renders a call control asks
 * this one function.
 */
export function contactability(prospect = {}) {
  const dnc = when(prospect.doNotContactAt);
  if (dnc) {
    return {
      callable: false,
      code: "do_not_contact",
      title: "Do not contact",
      text:
        `Recorded ${dnc.toISOString().slice(0, 10)}. ` +
        (prospect.doNotContactReason
          ? `Reason: ${prospect.doNotContactReason}`
          : "No reason was recorded."),
    };
  }
  if (!prospect.phoneE164) {
    return {
      callable: false,
      code: "no_phone",
      title: "No phone number",
      text: "This record carries no phone number, so there is nothing to dial from here.",
    };
  }
  return { callable: true, code: null, title: null, text: null };
}

/**
 * May THIS rep claim it — regardless of whether the pool has one to give?
 *
 * Asks about do-not-contact and ownership, and deliberately NOT about having a
 * phone number. `contactability()` answers "may this be rung right now", which
 * is a different question: a prospect with no phone is still a prospect worth
 * holding while somebody finds one, and refusing the claim would leave it in
 * the pool for the next rep to rediscover the same gap.
 */
export function claimable(prospect = {}, { repId = null, now = new Date() } = {}) {
  if (when(prospect.doNotContactAt)) return false;
  const { state, mine } = claimState(prospect, { repId, now });
  return mine || state === "unclaimed" || state === "lapsed";
}

/**
 * The `where` restricting a Prospect query to THIS rep's own queue.
 *
 * Shaped after lib/sales/scope.js's assignedCompanyWhere(), including the part
 * that matters most: it never returns `{}`. A rep with no claims sees nothing,
 * which is the correct and common state; an empty object would turn "I could
 * not work out who is asking" into "show them every prospect in the database",
 * and the whole point of ownership is that a rep does not browse the pool.
 *
 * The `__none__` sentinel is the one assignedCompanyWhere and assignedJobWhere
 * already use; no cuid can equal it.
 *
 * Lapsed claims are excluded. A claim that expired is back in the pool by
 * definition, and leaving it on the rep's screen would let two reps phone the
 * same contractor — the exact thing ownership exists to prevent.
 */
export function queueWhere(salesRepId, { now = new Date() } = {}) {
  const id =
    typeof salesRepId === "string" && salesRepId.length > 0 ? salesRepId : "__none__";
  const at = when(now) || new Date();
  return {
    assignedRepId: id,
    OR: [{ claimExpiresAt: null }, { claimExpiresAt: { gt: at } }],
  };
}

/**
 * The `where` matching a prospect this rep is allowed to be handed next.
 *
 * Single-trade, because the owner's reasoning is that a rep who says the same
 * script forty times gets better at it. `tradeKey` is the spine and there is no
 * "any trade" value — passing nothing yields the same `__none__` sentinel
 * rather than the whole pool.
 *
 * `needs_review` and `rejected` rows are excluded by naming the one status that
 * is workable, not by listing the ones that are not: a status added later must
 * be opted IN to a rep's queue, never default into it.
 */
export function claimCandidateWhere({ tradeKey = null, now = new Date() } = {}) {
  const trade = typeof tradeKey === "string" && tradeKey.length > 0 ? tradeKey : "__none__";
  const at = when(now) || new Date();
  return {
    tradeKey: trade,
    status: "discovered",
    doNotContactAt: null,
    OR: [{ assignedRepId: null }, { claimExpiresAt: { lt: at } }],
  };
}

/** When a claim taken now should lapse. */
export function claimExpiryFrom(now = new Date()) {
  const at = when(now) || new Date();
  return new Date(at.getTime() + CLAIM_HOURS * 60 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// The two views
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Everything known about one prospect, in three labelled layers.
 *
 * Returns the layers as separate arrays rather than one merged, sorted list.
 * A merged list is exactly the collapse §2 forbids: whatever the badges say,
 * a reader takes adjacency for equivalence.
 */
export function prospectView({
  prospect = {},
  capabilities = [],
  technologies = [],
  inferences = [],
  opportunities = [],
  evidence = [],
  scores = [],
  rules = [],
  capabilityNames = {},
  repId = null,
  now = new Date(),
} = {}) {
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));

  const facts = capabilities
    .map((row) => capabilityStatement(row, { rules, evidenceById }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const inferred = inferences.map((row) => inferenceStatement(row, { rules, evidenceById }));

  const recommended = opportunities
    .slice()
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .map((row) =>
      opportunityStatement(row, { capabilityName: capabilityNames[row.capabilityCode] || null }),
    );

  const latestScore = scores
    .slice()
    .sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime())[0];

  return {
    id: prospect.id ?? null,
    businessName: prospect.businessName || "No name on this record",
    tradeKey: prospect.tradeKey ?? null,
    status: prospect.status ?? null,
    classification: prospect.classification ?? null,
    classificationReason: prospect.classificationReason ?? null,
    facts: prospectFacts(prospect),
    contact: contactability(prospect),
    claim: claimState(prospect, { repId, now }),
    competitor: competitorSummary({ technologies, lastCrawledAt: prospect.lastCrawledAt }),
    technologies: technologies.map((t) => technologyStatement(t)),
    capabilities: facts,
    inferences: inferred,
    opportunities: recommended,
    // Nothing writes ProspectScore in this build, so the honest answer is a
    // null with the reason — never a 0, which reads as "we scored it and it is
    // worthless".
    score: latestScore
      ? { value: latestScore.score, version: latestScore.scoringVersion, reasons: latestScore.reasons || [] }
      : null,
    scoreNote: latestScore ? null : "No lead score has been computed for this prospect.",
    // The unknowns, gathered, because "what is UNKNOWN, stated as unknown" is
    // a section of the screen and not a tone of voice.
    unknowns: [
      ...prospectFacts(prospect).filter((f) => !f.known).map((f) => f.text),
      ...facts.filter((f) => f.state === "unknown").map((f) => f.text),
      ...(competitorSummary({ technologies, lastCrawledAt: prospect.lastCrawledAt }).known
        ? []
        : ["We do not know what software they run — nothing has crawled them."]),
      ...(inferred.length === 0 ? ["Nothing has been inferred about this business yet."] : []),
    ],
    lastCrawledAt: prospect.lastCrawledAt ?? null,
  };
}

/**
 * The rep's queue, or an honest empty state.
 *
 * `empty` carries a REASON. "You have nothing to call" and "there is nothing
 * left in this trade to claim" are different problems with different fixes, and
 * a single "Nothing here" tells a rep neither.
 */
export function buildQueue({
  prospects = [],
  repId = null,
  now = new Date(),
  availableToClaim = null,
  tradeKey = null,
} = {}) {
  const items = prospects.map((p) => ({
    id: p.id,
    businessName: p.businessName || "No name on this record",
    tradeKey: p.tradeKey ?? null,
    claim: claimState(p, { repId, now }),
    contact: contactability(p),
  }));

  const callable = items.filter((i) => i.contact.callable);
  const blocked = items.filter((i) => !i.contact.callable);

  if (items.length > 0) {
    return {
      items,
      empty: false,
      emptyReason: null,
      emptyText: null,
      callableCount: callable.length,
      blockedCount: blocked.length,
      availableToClaim,
      tradeKey,
    };
  }

  const reason =
    availableToClaim === null
      ? "unknown_pool"
      : availableToClaim > 0
        ? "nothing_claimed"
        : "pool_empty";

  return {
    items: [],
    empty: true,
    emptyReason: reason,
    emptyText:
      reason === "nothing_claimed"
        ? `Your queue is empty. ${availableToClaim} prospect${availableToClaim === 1 ? " is" : "s are"} free to claim in this trade.`
        : reason === "pool_empty"
          ? "Your queue is empty, and there is nothing left to claim in this trade. Discovery has to run again before there is."
          : "Your queue is empty. We could not count what is left to claim.",
    callableCount: 0,
    blockedCount: 0,
    availableToClaim,
    tradeKey,
  };
}
