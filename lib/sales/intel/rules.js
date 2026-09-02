// lib/sales/intel/rules.js
//
// The starter `OpportunityRule` rows: when a gap becomes something to say.
//
// ══ Why these are seeds and not constants ══════════════════════════════════
//
// They are written here as data and then live in the database, editable by a
// superadmin. That is the spec's shape and it is also the honest one: which
// gaps are worth a sentence is a sales judgement that will change monthly, and
// a judgement that needs a deploy to change is a judgement nobody revises.
//
// What is NOT editable is the evaluator (lib/sales/intel/opportunity.js) or the
// capability matrix's `tableStakes` classification. A superadmin may decide
// that a missing booking page is worth mentioning; they may not decide that a
// recommendation can go out without evidence, or that online booking is a
// displacement argument against an incumbent platform.
//
// ══ Every rule here fires on `is: false`, and that is the dangerous edge ═══
//
// `is: false` means "we looked and it is not there". It does NOT match a null,
// and the whole of opportunity.js's `evaluateCondition` exists to keep that
// true. Read that file's header before adding a rule: the failure it prevents
// is a rep telling a contractor they have no booking page when they have one
// the crawler could not reach, and that is a call that ends in the first
// thirty seconds.
//
// ══ The competitor rules are a different conversation, not an extra line ═══
//
// COMPETITOR_* below do not add a bullet to the same pitch. They are the pitch:
// a business already running a field-service platform has scheduling, invoicing
// and online booking, and a rep who opens with "you need online booking" has
// told them nothing except that we did not look. So those rules recommend only
// out of the capabilities the matrix marks `tableStakes: false`, and the
// non-competitor rules carry an explicit `{ kind: "competitor", present: false }`
// so they simply do not apply.
//
// That explicit condition is belt-and-braces on top of the guard in
// evaluateRule, and deliberately so — the same reasoning that puts the
// impersonation gate in middleware.js AND lib/currentMember.js. The condition
// makes the rule's INTENT readable to whoever edits it; the guard makes the
// property hold for a rule written by somebody who never read this comment.
import { OBSERVABLE_CAPABILITY_CODES } from "./capabilities";
import { validateRule } from "./opportunity";

const RULES = [
  // ── Displacement: somebody else's platform is already installed ──────────
  //
  // Highest priority, because it changes what every other rule is allowed to
  // say. Recommending WHITE_LABEL_DOCUMENTS is a claim about FieldQuo (the
  // homeowner never sees our name — AGENTS.md's first paragraph), not a claim
  // about what the incumbent lacks. We do not have a sourced feature list for
  // any competitor and will not assert one from memory on a sales call.
  {
    code: "COMPETITOR_WHITE_LABEL",
    name: "Running a competitor's platform — lead with whose name is on the paperwork",
    capabilityCode: "WHITE_LABEL_DOCUMENTS",
    priority: 100,
    conditions: { all: [{ kind: "competitor", present: true }] },
    reasonTemplate:
      "This business is already running {competitor}, so they are not short of a " +
      "scheduler. The question worth asking is whose name the homeowner sees: " +
      "with FieldQuo the quote, the invoice, the booking page and the email all " +
      "carry theirs, and nothing carries ours.",
  },
  {
    code: "COMPETITOR_MISSED_CALLS",
    name: "Running a competitor's platform — the phone is still unanswered",
    capabilityCode: "AI_RECEPTIONIST",
    priority: 95,
    conditions: {
      all: [
        { kind: "competitor", present: true },
        // They publish a number, so missed calls are a real cost to them. This
        // is also what gives the recommendation a second thing to cite.
        { kind: "capability", code: "PHONE_CONTACT", is: true },
      ],
    },
    reasonTemplate:
      "{competitor} runs their office; it does not answer their phone. The number " +
      "on their site rings while they are on a ladder. Ours answers in their " +
      "company's name, books the job, and drafts the quote from what the caller " +
      "said — talk time is prepaid credit, not part of the subscription.",
  },

  // ── No website at all ────────────────────────────────────────────────────
  //
  // The spec's §5 settles this: no website is a SIGNAL, not a disqualifier.
  // These prospects stay in the pipeline and they are among the best ones.
  {
    code: "NO_WEBSITE",
    name: "No website found",
    capabilityCode: "WEBSITE",
    priority: 90,
    conditions: {
      all: [
        { kind: "capability", code: "WEBSITE", is: false },
        { kind: "competitor", present: false },
      ],
    },
    reasonTemplate:
      "We found no website for this business — every enquiry has to arrive by " +
      "phone, from somebody who already knew the name. A site on their own " +
      "domain, built from the work they already do, is the first thing to fix.",
  },

  // ── A website, and no way to book on it ─────────────────────────────────
  {
    code: "WEBSITE_NO_BOOKING",
    name: "Has a website, no online booking",
    capabilityCode: "ONLINE_BOOKING",
    priority: 80,
    conditions: {
      all: [
        { kind: "capability", code: "WEBSITE", is: true },
        { kind: "capability", code: "ONLINE_BOOKING", is: false },
        { kind: "competitor", present: false },
      ],
    },
    reasonTemplate:
      "They have a site and no way to book on it, so a homeowner reading it at " +
      "ten at night has to remember to ring in the morning. Most do not.",
  },

  // ── An email address where a form should be ─────────────────────────────
  {
    code: "EMAIL_ONLY_CONTACT",
    name: "Contact is an email address, with no enquiry form",
    capabilityCode: "LEAD_CAPTURE_FORM",
    priority: 70,
    conditions: {
      all: [
        { kind: "capability", code: "WEBSITE", is: true },
        { kind: "capability", code: "EMAIL_CONTACT", is: true },
        { kind: "capability", code: "LEAD_CAPTURE_FORM", is: false },
        { kind: "competitor", present: false },
      ],
    },
    reasonTemplate:
      "The only way to get in touch is an email address, so enquiries arrive as " +
      "free text in an inbox and get answered when somebody remembers. A form " +
      "drops onto the site they already have and what comes back lands in a " +
      "worked list, scored, one click from a quote.",
  },

  // ── No way to pay ───────────────────────────────────────────────────────
  {
    code: "NO_ONLINE_PAYMENT",
    name: "No way for a client to pay online",
    capabilityCode: "ONLINE_PAYMENT",
    priority: 75,
    conditions: {
      all: [
        { kind: "capability", code: "ONLINE_PAYMENT", is: false },
        { kind: "competitor", present: false },
      ],
    },
    reasonTemplate:
      "There is nothing on this business that takes a card, so the money arrives " +
      "by cheque or e-transfer whenever the client gets round to it. Paying from " +
      "the invoice on a phone is the difference between thirty days and three — " +
      "and it is their own payout account, not ours.",
  },

  // ── Nobody can reach them outside a phone call ──────────────────────────
  //
  // The brief for this rule asked for "no live chat plus LIMITED published
  // hours". `ProspectCapability.value` is a boolean, so "limited" is not
  // expressible: it needs a count of open hours, and there is no column for
  // one. Inventing a threshold — or padding a partial opening-hours array into
  // an assumed Mon–Fri — is AGENTS.md's failure class 5 and it is the specific
  // mistake lib/company/businessHours.js exists to avoid.
  //
  // So this fires on the observation that IS available: no chat, and no
  // published hours at all. Both are real readings of a real page, and both
  // cite evidence. If a detector later records an hours COUNT, this rule gains
  // a condition rather than this comment gaining an excuse.
  {
    code: "NO_CHAT_NO_HOURS",
    name: "No live chat and no published hours — the phone is the only door",
    capabilityCode: "AI_RECEPTIONIST",
    priority: 65,
    conditions: {
      all: [
        { kind: "capability", code: "LIVE_CHAT", is: false },
        { kind: "capability", code: "PUBLISHED_HOURS", is: false },
        { kind: "capability", code: "PHONE_CONTACT", is: true },
        { kind: "competitor", present: false },
      ],
    },
    reasonTemplate:
      "No chat, no posted hours, and a phone number. Anybody who wants them has " +
      "to ring and hope. Ours answers in their name whenever it rings, books the " +
      "appointment, and writes up the quote from the call — talk time is prepaid " +
      "credit, not part of the subscription.",
  },
];

/**
 * The seed rows, validated against the capability matrix before they are handed
 * to anybody.
 *
 * Throws rather than filtering. A starter rule that silently did not ship is a
 * feature that appears to exist — the rules screen would list five where six
 * were written — and this is the one moment where the mistake is cheap to see.
 */
export function seedOpportunityRules({ matrix } = {}) {
  const rows = RULES.map((r) => ({
    code: r.code,
    name: r.name,
    capabilityCode: r.capabilityCode,
    conditions: r.conditions,
    reasonTemplate: r.reasonTemplate,
    priority: r.priority,
    active: true,
    version: "1",
  }));

  const problems = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.code)) problems.push(`${row.code}: duplicate rule code`);
    seen.add(row.code);
    const { ok, problems: found } = validateRule(row, matrix ? { matrix } : {});
    if (!ok) problems.push(`${row.code}: ${found.join(", ")}`);
  }
  if (problems.length) {
    throw new Error(`seedOpportunityRules: ${problems.join("; ")}`);
  }

  return rows;
}

/**
 * Which observable codes the starter rules actually depend on.
 *
 * The contract the crawler has to satisfy for any of this to fire, in one
 * place, so "we built the rules and no detector produces PUBLISHED_HOURS" is a
 * question somebody can answer without reading six condition objects.
 */
export function requiredDetectors() {
  const codes = new Set();
  for (const r of RULES) {
    for (const c of [...(r.conditions.all || []), ...(r.conditions.any || [])]) {
      if (c.kind === "capability" || c.kind === "capabilityUnknown") codes.add(c.code);
    }
  }
  return [...codes].filter((c) => OBSERVABLE_CAPABILITY_CODES.includes(c)).sort();
}
