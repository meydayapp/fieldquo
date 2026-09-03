// lib/sales/playbook/generate.js
//
// The AI half, and its fences.
//
// ══ The model writes SENTENCES. That is the entire job. ═══════════════════
//
// lib/site/generateSite.js makes this argument for the website builder and it
// is the same argument here, with a higher price for getting it wrong: the
// model never selects a playbook, never invents a capability, never emits a
// number, and never decides whether there is anything to say. It is handed a
// closed list of things that are already TRUE about this prospect — each one a
// ProspectOpportunity row with evidence behind it — and asked to say them in a
// way a contractor on a ladder will listen to.
//
// Three fences, in order, and each of them would be sufficient on a good day:
//
//   1. The schema's `capabilityCode` is an `enum` of the codes that actually
//      have an opportunity row for THIS prospect. With `strict: true` the
//      vendor will not generate anything else, so an invented citation costs
//      no tokens and never exists.
//   2. Every returned point runs through the same gate as a rule-authored one
//      (lib/sales/playbook/talkingPoints.js). A vendor promise is not access
//      control; provider.js's own header says the vendor can change.
//   3. There is no numeric field anywhere in the schema, and the gate refuses a
//      figure written into the prose of an AI-sourced point.
//
// ══ AI is optional and its absence is PLAINER, never blank ════════════════
//
// Every failure path below falls through to `deterministicTalkingPoints`,
// which reads `ProspectOpportunity.reason` — a sentence a superadmin wrote as
// a rule template, already interpolated, already evidence-cited. So an
// unconfigured deployment, a spent budget, a vendor outage, a truncated reply
// and a reply we refused all produce the same thing: a shorter, flatter script
// that is still correct. The `degraded` flag and the reason travel with it so
// the screen can say which, rather than silently looking like a thin prospect.
//
// ══ The prospect's own name is untrusted text in a prompt ═════════════════
//
// `businessName` comes out of a third-party directory and reaches the model
// verbatim. Nothing can be done about that — it is the one string the sentence
// has to contain — so the containment is structural rather than textual: the
// output shape is fixed, the citation is a closed enum, and the worst a hostile
// listing name can do is put its own words inside a sentence a superadmin reads
// on the review screen before a rep ever says it.
import { AI_FAILURE, AI_MODEL, complete, isAiConfigured } from "@/lib/ai/provider";
import { TALKING_POINT_STAGES } from "./stages";
import { assembleTalkingPoints, deterministicTalkingPoints } from "./talkingPoints";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "./platformAi";

/** Shows up in vendor-side errors. Named after the caller, per provider.js. */
export const SCHEMA_NAME = "sales_playbook_talking_points";

/** The area column on PlatformAiUsage, so a spike traces to this stage. */
export const AI_AREA = "playbook_talking_points";

/** How many sentences a rep can hold in their head at the top of a call. */
export const MAX_GENERATED_POINTS = 3;

/** Why the script is plainer than it could have been. */
export const DEGRADED_REASONS = Object.freeze({
  unconfigured:
    "No model is configured on this deployment, so the script is built from the rules alone.",
  over_budget:
    "FieldQuo's own AI budget for this scope is spent, so nothing was generated.",
  budget_unreadable:
    "The AI budget could not be read, and an unreadable budget is treated as a stop rather than as permission.",
  vendor_error: "The model could not be reached, so the script is built from the rules alone.",
  refused: "The model declined to answer, so the script is built from the rules alone.",
  empty: "The model returned nothing, so the script is built from the rules alone.",
  truncated: "The model's reply was cut off, so the script is built from the rules alone.",
  unparseable: "The model's reply was not usable, so the script is built from the rules alone.",
  schema_mismatch:
    "The model's reply did not match the shape we asked for, so the script is built from the rules alone.",
  bad_schema:
    "The schema this deployment builds is not one the vendor accepts. Nothing was sent. This is a bug, not a prospect problem.",
  all_refused:
    "Everything the model wrote was refused by the evidence gate, so the script is built from the rules alone.",
  nothing_to_say:
    "No opportunity has been generated for this prospect, so there is nothing that could be said with evidence behind it.",
});

/**
 * The JSON Schema, built per prospect.
 *
 * `capabilityCode` is an enum of what is citable for THIS prospect, not a free
 * string, and that is the single most important line in this file. It is also
 * why the schema is a function: a shared constant would have to allow every
 * capability code, and "the model may cite anything in the matrix" is exactly
 * the claim §11 forbids.
 *
 * Not a single numeric field, anywhere, at any depth. See lib/ai/jsonSchema.js's
 * closing section — a numeric field in a schema is a claim that a model's guess
 * is good enough to show as a fact.
 */
export function talkingPointSchema(citableCodes) {
  const codes = [...new Set((citableCodes || []).filter((c) => typeof c === "string" && c))];
  return {
    type: "object",
    additionalProperties: false,
    required: ["points"],
    properties: {
      points: {
        type: "array",
        description: `At most ${MAX_GENERATED_POINTS} points, in the order a rep should say them.`,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["capabilityCode", "stageKey", "text"],
          properties: {
            capabilityCode: {
              type: "string",
              description: "Which of the listed opportunities this sentence is about.",
              enum: codes,
            },
            stageKey: {
              type: "string",
              description:
                "relevance for the one sentence that earns the call; fit for what we do about it.",
              enum: [...TALKING_POINT_STAGES],
            },
            text: {
              type: "string",
              description: "One or two sentences a rep says out loud. No figures of any kind.",
            },
          },
        },
      },
    },
  };
}

const SYSTEM = [
  "You write one or two spoken sentences for a salesperson phoning a small field-service contractor.",
  "You are given a closed list of things that were OBSERVED about this business and what FieldQuo does about each.",
  "Rules, all absolute:",
  "- Say only what is on the list. Never name a capability, integration or feature that is not on it.",
  "- Every point cites one listed capabilityCode. There is no other way to write a point.",
  "- No figures of any kind: no prices, no percentages, no counts, no durations, no comparisons like 'half'.",
  "- Never claim anything about a competitor's product. You have not been told what it does.",
  "- Plain trade language. Short sentences. No marketing adjectives, no 'leverage', no 'solution'.",
  "- A contractor is on a ladder. Say the thing, do not build up to it.",
].join("\n");

/**
 * The prompt. Pure, so a check can diff it.
 *
 * Only the fields listed here reach the model. Not the phone number, not the
 * address, not the evidence rows themselves — none of which help it write a
 * sentence, and all of which would be personal data leaving the building for
 * no gain.
 */
export function talkingPointPrompt({ prospect = {}, playbook = null, ctx } = {}) {
  const rows = [...(ctx?.byCode?.values?.() || [])].sort(
    (a, b) => a.rank - b.rank || a.capabilityCode.localeCompare(b.capabilityCode),
  );

  const observed = rows
    .map((o, i) => {
      const cap = (ctx.matrix || []).find((c) => c.code === o.capabilityCode);
      return [
        `${i + 1}. capabilityCode: ${o.capabilityCode}`,
        `   what FieldQuo does: ${cap?.name || o.capabilityCode}`,
        `   why it applies here: ${o.reason || "(no sentence stored)"}`,
      ].join("\n");
    })
    .join("\n");

  return [
    `Business: ${prospect.businessName || "(unnamed)"}`,
    prospect.city ? `Town: ${prospect.city}` : null,
    prospect.tradeKey ? `Trade: ${prospect.tradeKey}` : null,
    playbook
      ? `Conversation type: ${playbook.name} — selected because ${playbook.selectorLabel || playbook.selectorKey}.`
      : null,
    "",
    "Observed opportunities:",
    observed || "(none)",
    "",
    `Write at most ${MAX_GENERATED_POINTS} points.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @returns {{
 *   points: Array, source: "ai"|"rule", degraded: boolean,
 *   reason: string|null, reasonText: string|null,
 *   refused: Array, model: string|null,
 * }}
 */
export async function generateTalkingPoints({
  prospect = {},
  playbook = null,
  ctx,
  campaignId = null,
  salesRepId = null,
  ref = null,
  limit = MAX_GENERATED_POINTS,
} = {}) {
  const fallback = (reason) => {
    const { accepted, refused } = deterministicTalkingPoints(ctx, { limit });
    return {
      points: accepted,
      source: "rule",
      degraded: true,
      reason,
      reasonText: DEGRADED_REASONS[reason] || reason,
      refused,
      model: null,
    };
  };

  // Nothing observed means nothing citable means nothing to generate. The
  // model is never asked, because the only thing it could do with an empty
  // list is invent — and with an empty enum the schema would not even be
  // valid.
  if (!ctx?.citableCodes?.length) {
    return {
      points: [],
      source: "rule",
      degraded: true,
      reason: "nothing_to_say",
      reasonText: DEGRADED_REASONS.nothing_to_say,
      refused: [],
      model: null,
    };
  }

  if (!isAiConfigured()) return fallback("unconfigured");

  const budget = await checkPlatformAiBudget({ campaignId });
  if (!budget.ok) return fallback(budget.reason === "over_budget" ? "over_budget" : "budget_unreadable");

  let usage = null;
  const result = await complete({
    system: SYSTEM,
    prompt: talkingPointPrompt({ prospect, playbook, ctx }),
    // Deliberately NOT `quality: "writing"`. That model exists for the single
    // most-read sentence FieldQuo generates — a contractor's homepage headline
    // — and provider.js's own comment says it is affordable because it is rare.
    // This runs once per prospect across a campaign of hundreds, and the job is
    // rephrasing three sentences that were handed over already written. The
    // default model is the right tool and roughly an order of magnitude
    // cheaper; STATUS.md's arithmetic already names the OpenAI lane as what
    // makes a 1,000-prospect campaign take two days.
    schema: talkingPointSchema(ctx.citableCodes),
    schemaName: SCHEMA_NAME,
    onUsage: (u) => {
      usage = u;
    },
  });

  // Metered before any decision about the content, the same order provider.js
  // uses and for the same reason: a reply we refuse was still generated and
  // still billed, and a refusal lane that shows zero spend is the number the
  // budget exists to produce.
  if (usage) {
    await recordPlatformAiUsage({
      area: AI_AREA,
      model: usage.model || AI_MODEL,
      usage,
      prospectId: prospect?.id ?? null,
      campaignId,
      salesRepId,
      ref,
    });
  }

  if (!result?.ok) {
    const known = Object.values(AI_FAILURE).includes(result?.reason) ? result.reason : "vendor_error";
    return fallback(known);
  }

  const { accepted, refused } = assembleTalkingPoints(
    (result.data?.points || []).slice(0, limit).map((p) => ({ ...p, source: "ai" })),
    ctx,
  );

  // The model answered and every sentence failed the gate. That is not an
  // empty script — it is a script we could have written without it, and the
  // reason has to say so rather than reporting a healthy AI pass with no
  // points in it.
  if (accepted.length === 0) {
    const flat = fallback("all_refused");
    return { ...flat, refused: [...refused, ...flat.refused], model: usage?.model || AI_MODEL };
  }

  return {
    points: accepted,
    source: "ai",
    degraded: false,
    reason: null,
    reasonText: null,
    refused,
    model: usage?.model || AI_MODEL,
  };
}
