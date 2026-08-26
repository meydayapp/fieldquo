// lib/platform/salesAgent.js
//
// FieldQuo's own phone agent: what it would be, and what is stopping it.
//
// ══ Why this is not part of lib/voice/provision.js ═════════════════════════
//
// provisionAgent(companyId, origin) is keyed on a company from its first
// argument to its last. Every fact it builds comes from a Company row, its
// prompt is the receptionist's, its tools write LeadRequests into a tenant, and
// it attaches to a VoicePhoneNumber the tenant rents. There is no companyId to
// give it here and no tenant row this agent should ever touch, so bending it to
// take a null company would put an `if (!companyId)` branch through the one
// function four other things depend on being simple.
//
// It also would not stay separate. The whole point of AGENTS.md's white-label
// rule is that a contractor's receptionist must never start talking about
// FieldQuo's pricing; one shared builder with a flag is exactly how that leaks.
//
// ══ What exists today, plainly ═════════════════════════════════════════════
//
// FieldQuo does NOT have its own Retell agent, and does not have a number for
// one. There is one Retell account (lib/voice/pool.js) which every tenant draws
// on, and the only number FieldQuo itself holds in it is RETELL_TEST_NUMBER —
// the owner's line for trying the TENANT RECEPTIONIST before a company buys
// their own. That is a different thing wearing the same wire: it is bound to
// whatever tenant agent is being tested, and pointing this agent at it would
// take away the only way to test the receptionist, in exchange for a sales line
// that stops working the moment somebody tests a receptionist again.
//
// So this file builds the configuration and reports the gap. It deliberately
// does NOT ship a provision function or a button: there is nowhere to persist a
// provider agent id (VoiceAgent is keyed by companyId, and FieldQuo has no
// company row), and there is no number to attach it to. A "Provision" control
// that created an agent nobody could ring is the dead control AGENTS.md exists
// to stop. What is here is real: the exact prompt, the exact tools, and an
// honest list of what building the rest needs.
import { voiceConfigured } from "@/lib/voice/retell";
import { toE164, formatNumber, isSharedTestNumber } from "@/lib/voice/numbers";
import { salesKnowledge } from "./salesKnowledge";
import { buildSalesPrompt, buildSalesGreeting } from "./salesPrompt";

/** Where a caller who wants a human ends up. E.164 or anything toE164 accepts. */
export const SALES_TRANSFER_ENV = "FIELDQUO_SALES_TRANSFER_TO";

/** Where somebody this call cannot help is sent. Real, monitored, and public. */
export const SALES_CONTACT_URL = "fieldquo.com/contact";

/**
 * What the agent is allowed to DO. One thing, and it is not ours.
 *
 * ── Why there is no save_caller here ───────────────────────────────────────
 *
 * The receptionist's save_caller writes a LeadRequest into a tenant. This agent
 * has no tenant, and FieldQuo has no table of its own sales enquiries — the
 * /contact form emails the owner rather than storing a row, and says so in its
 * own header. A "take a message" tool with nowhere to write would report
 * success to the model, the model would tell the caller someone will ring them
 * back, and nobody would. That is the worst shape a failure takes: it looks
 * like it worked.
 *
 * ── Why there is no availability or booking tool ───────────────────────────
 *
 * Those run against a company's EventTypes. Reaching them would mean this agent
 * touching tenant data, which is the thing it must never do. FieldQuo's own
 * demo calendar (DemoHostAvailability) is a separate surface with its own
 * booking page, and wiring a phone agent into it is a product decision nobody
 * has made.
 *
 * ── Why transfer_call is safe ──────────────────────────────────────────────
 *
 * It is a Retell built-in: the provider bridges the two legs itself and never
 * posts to us, so there is no endpoint of ours in the path and nothing for a
 * caller to reach by talking the agent into it. A cold transfer, like the
 * receptionist's, for the same reason — nobody wants to be held on a summary.
 *
 * The net effect is that this agent has NO route to any tenant row at all. That
 * is structural, not instructed.
 */
export function salesToolDefinitions({ transferTo = null } = {}) {
  if (!transferTo) return [];
  return [
    {
      type: "transfer_call",
      name: "transfer_to_human",
      description:
        "Put the caller through to a real person at FieldQuo. Use this when " +
        "they ask to speak to someone, when they want to buy or want a demo, " +
        "when they are asking about an account you cannot see, when they want " +
        "a price that is not in your facts, or when they are annoyed. Tell " +
        "them you are putting them through before you call this.",
      transfer_destination: { type: "predefined", number: transferTo },
      transfer_option: { type: "cold_transfer" },
    },
  ];
}

// Retell requires a voice on every agent — there is no server-side default, and
// omitting it fails the create. Same fallback the receptionist uses; FieldQuo's
// own line is English, so there is no language branch here.
const SALES_VOICE_ID = "11labs-Adrian";

/**
 * Exactly what we would push to Retell for FieldQuo's own agent, right now.
 *
 * Same split as buildAgentConfig in lib/voice/provision.js and for the same
 * reason: the platform screen renders THIS, rather than rebuilding a second
 * copy of the payload that drifts the day somebody edits the prompt.
 *
 * Reads the database (Plan, PlatformFeature). Writes nothing, anywhere.
 */
export async function buildSalesAgentConfig({ origin, notes = null } = {}) {
  const knowledge = await salesKnowledge();

  // Normalised rather than trusted as typed. A transfer destination has to be
  // dialable E.164 or Retell refuses the whole agent, and toE164 returns null
  // for anything it cannot make sense of — null here means "no transfer", which
  // the prompt then says out loud rather than offering something that fails.
  const transferTo = toE164(process.env[SALES_TRANSFER_ENV]);
  const webhookUrl = origin ? `${origin}/api/voice/webhook` : undefined;

  const prompt = buildSalesPrompt({
    knowledge,
    notes,
    canTransfer: Boolean(transferTo),
    contactUrl: SALES_CONTACT_URL,
  });
  const greeting = buildSalesGreeting({});

  return {
    knowledge,
    transferTo,
    prompt,
    greeting,
    llmPayload: {
      general_prompt: prompt,
      begin_message: greeting,
      general_tools: salesToolDefinitions({ transferTo }),
    },
    agentPayload: {
      agent_name: "FieldQuo — sales line",
      language: "en-US",
      voice_id: SALES_VOICE_ID,
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    },
  };
}

/**
 * Is there a live agent behind this, and if not, what is missing?
 *
 * Written to be read by somebody who has spent a week finding out that things
 * he was told worked had never worked. It reports `live: false` unconditionally
 * and says why, rather than reporting readiness as a score out of five that
 * could be mistaken for a working phone.
 *
 * @param transferTo the normalised destination from buildSalesAgentConfig
 * @param knowledge  the derived knowledge base
 */
export function salesAgentReadiness({ transferTo = null, knowledge = null } = {}) {
  const blockers = [];

  // Ordered by what has to be true first. The first two are hard stops: with
  // either of them outstanding there is no phone call to have.
  if (!voiceConfigured()) {
    blockers.push({
      code: "no_retell_key",
      severity: "blocking",
      detail:
        "RETELL_API_KEY is not set in this environment, so nothing can be " +
        "created at the provider at all.",
    });
  }

  blockers.push({
    code: "no_agent",
    severity: "blocking",
    detail:
      "FieldQuo has no Retell agent of its own. Nothing in this codebase " +
      "creates one: lib/voice/provision.js provisions a TENANT's receptionist " +
      "and is keyed on a company id, and VoiceAgent — the only table that " +
      "stores a provider agent id — is keyed on companyId too, so there is " +
      "nowhere to record FieldQuo's own. Building it needs a place to keep the " +
      "id and a decision about which number it answers on.",
  });

  blockers.push({
    code: "no_number",
    severity: "blocking",
    detail:
      "FieldQuo owns no number for a sales line. The one number it holds in " +
      "the shared Retell account is RETELL_TEST_NUMBER, which is the owner's " +
      "line for trying a TENANT receptionist before a company buys their own " +
      "(see lib/voice/numbers.js). Attaching this agent to it would break that " +
      "and would be broken back the next time somebody tests a receptionist.",
  });

  if (!transferTo) {
    blockers.push({
      code: "no_transfer",
      severity: "degraded",
      detail:
        `${SALES_TRANSFER_ENV} is not set, so the agent has no tool at all and ` +
        `is told to say it cannot put anyone through. It would still answer ` +
        `questions; it would send anyone who needs a person to ` +
        `${SALES_CONTACT_URL}.`,
    });
  }

  if (knowledge?.nothingSellable || !(knowledge?.plans || []).length) {
    blockers.push({
      code: "no_prices",
      severity: "degraded",
      detail:
        "No plan can currently be bought — every Plan row is either missing a " +
        "Stripe price id or is not public — so the agent has no price list and " +
        "is told to refuse the question rather than estimate. The same state " +
        "empties the public pricing page; see lib/platform/sellablePlans.js.",
    });
  } else if (knowledge.withheldPlanCount > 0) {
    blockers.push({
      code: "some_plans_withheld",
      severity: "note",
      detail:
        `${knowledge.withheldPlanCount} plan(s) are not quotable — no Stripe ` +
        "price id, or not public — so the agent is told its list is partial.",
    });
  }

  return {
    // Not a computed verdict. There is no agent and no number; saying anything
    // other than false here would be the claim this whole file exists to avoid.
    live: false,
    transferTo,
    transferToDisplay: transferTo ? formatNumber(transferTo) : null,
    // Named so the screen can warn if somebody points the transfer at the test
    // line — a caller put through to it would reach a tenant's receptionist.
    transferIsSharedTestNumber: Boolean(transferTo && isSharedTestNumber(transferTo)),
    blockers,
  };
}
