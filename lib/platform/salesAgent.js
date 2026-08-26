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
// FieldQuo had no Retell agent of its own and no number for one, and there was
// nowhere to put either: VoiceAgent and VoicePhoneNumber are both keyed by
// companyId, and giving FieldQuo a Company row would make it a tenant in every
// count in the console. PlatformVoiceAgent is that missing home; the NUMBER is
// configuration (FIELDQUO_SALES_NUMBER), because a number needs an owner and
// FieldQuo is not one of its own customers.
//
// The number itself still has to be bought in the Retell dashboard by a person.
// Nothing here buys one — a purchase is money, and the tenant purchase flow
// spends a contractor's credit against a contractor's account, neither of which
// exists here. Until the variable names a real number, `checkSalesReadiness`
// says so at the first link and the screen leads with it.
//
// RETELL_TEST_NUMBER is NOT that number. It is the owner's line for trying a
// TENANT receptionist before a company buys their own, bound to whichever agent
// is being tested — claiming it for the sales line would take that away and get
// taken back the next time somebody tests one. Detected and reported rather
// than silently allowed; see lib/platform/salesCall.js.
import {
  voiceConfigured,
  createAgent,
  updateAgent,
  createRetellLlm,
  updateRetellLlm,
  attachAgent,
  getAgent,
  getNumber,
  getRetellLlm,
  boundAgentId,
  RetellError,
} from "@/lib/voice/retell";
import { toE164, formatNumber, isSharedTestNumber } from "@/lib/voice/numbers";
import { resolveReadiness, originIsStable } from "@/lib/voice/readiness";
import { webhookHealth } from "@/lib/voice/webhookHealth";
import { db } from "@/lib/db";
import { salesKnowledge } from "./salesKnowledge";
import { buildSalesPrompt, buildSalesGreeting } from "./salesPrompt";
import {
  salesNumbers,
  salesNumberProblems,
  salesCallDeliveryEvidence,
  SALES_NUMBER_ENV,
} from "./salesCall";

/** The single row's id. There is one FieldQuo. */
export const SALES_AGENT_ID = "fieldquo";

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
export async function buildSalesAgentConfig({ origin, notes } = {}) {
  const [knowledge, row] = await Promise.all([salesKnowledge(), salesAgentRow()]);

  // The stored notes unless a caller supplied some — the preview on the
  // platform screen passes what is in the textarea so the owner can see the
  // effect before saving, and everything else takes what is on the row.
  const useNotes = notes === undefined ? row?.notes || null : notes;

  // Normalised rather than trusted as typed. A transfer destination has to be
  // dialable E.164 or Retell refuses the whole agent, and toE164 returns null
  // for anything it cannot make sense of — null here means "no transfer", which
  // the prompt then says out loud rather than offering something that fails.
  // Literal, not process.env[SALES_TRANSFER_ENV] — see the note in salesCall.js
  // about check-env-docs only seeing a literal read.
  const transferTo = toE164(process.env.FIELDQUO_SALES_TRANSFER_TO);
  const webhookUrl = origin ? `${origin}/api/voice/webhook` : undefined;

  // A call is only kept if there is a number for it to arrive on — the webhook
  // recognises FieldQuo's own line by exactly this list. Without one the agent
  // is told nothing is written down, because nothing is.
  const callsRecorded = salesNumbers().length > 0;

  const prompt = buildSalesPrompt({
    knowledge,
    notes: useNotes,
    canTransfer: Boolean(transferTo),
    contactUrl: SALES_CONTACT_URL,
    callsRecorded,
  });
  const greeting = buildSalesGreeting({});

  return {
    knowledge,
    row,
    notes: useNotes,
    transferTo,
    webhookUrl,
    callsRecorded,
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
 * FieldQuo's own agent row, or null.
 *
 * A single row with a fixed id. `findUnique` rather than `findFirst` so a
 * second row is impossible to read even if one were somehow written.
 */
export async function salesAgentRow() {
  return db.platformVoiceAgent.findUnique({ where: { id: SALES_AGENT_ID } }).catch(() => null);
}

/** Save the two things a person actually decides: does it answer, and the notes. */
export async function saveSalesAgentSettings({ enabled, notes } = {}) {
  const data = {};
  if (enabled !== undefined) data.enabled = Boolean(enabled);
  // An empty box means "no notes", which is different from "leave them alone" —
  // hence the explicit null rather than dropping the key. A tone note the owner
  // deleted has to stop reaching the phone, the same way a contractor's does.
  if (notes !== undefined) data.notes = String(notes || "").trim().slice(0, 3000) || null;

  return db.platformVoiceAgent.upsert({
    where: { id: SALES_AGENT_ID },
    create: { id: SALES_AGENT_ID, ...data },
    update: data,
  });
}

/**
 * Create or update FieldQuo's own agent at the provider, and make the number
 * answer with it — or stop answering.
 *
 * ── Deliberately the same shape as provisionAgent, not the same function ───
 *
 * Retell splits an agent in two: a RETELL LLM holding the prompt, the greeting
 * and the tools, and an AGENT holding voice_id, language and webhook_url and
 * pointing at the LLM through response_engine. Getting that wrong is what left
 * a contractor with a bought number attached to nothing, so the order here
 * copies the one that was fixed: engine first, agent second, attachment last.
 *
 * Nothing is published, for the reason written out in lib/voice/provision.js —
 * an unpinned number resolves the LATEST version, and every save writes the
 * newest, so a change is live on the next call. Publishing would buy nothing
 * and would bring the whole draft/publish ceremony with it.
 *
 * ── Attachment is the switch ──────────────────────────────────────────────
 *
 * A number with an agent is answered; a number without one is not. (What the
 * caller hears in that second case is undocumented — see attachAgent in
 * lib/voice/retell.js.) So `enabled`
 * is honoured AT THE PROVIDER rather than only in our column — the exact bug
 * that made a tenant's "answer my calls" toggle do nothing for months. And the
 * attach is READ BACK, because a 200 on the PATCH is not evidence the phone
 * stopped answering.
 *
 * @returns { ok, agentId } or { ok: false, reason }
 */
export async function provisionSalesAgent(origin) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };

  const config = await buildSalesAgentConfig({ origin });
  const row = config.row;

  try {
    let providerLlmId = row?.providerLlmId || null;
    let providerAgentId = row?.providerAgentId || null;

    if (providerLlmId) {
      await updateRetellLlm(providerLlmId, config.llmPayload);
    } else {
      const created = await createRetellLlm(config.llmPayload);
      providerLlmId = created?.llm_id || null;
      if (!providerLlmId) return { ok: false, reason: "no_llm_id" };
    }

    const agentPayload = {
      ...config.agentPayload,
      response_engine: { type: "retell-llm", llm_id: providerLlmId },
    };

    if (providerAgentId) {
      await updateAgent(providerAgentId, agentPayload);
    } else {
      const created = await createAgent(agentPayload);
      providerAgentId = created?.agent_id || null;
      if (!providerAgentId) return { ok: false, reason: "no_agent_id" };
    }

    await db.platformVoiceAgent.upsert({
      where: { id: SALES_AGENT_ID },
      create: { id: SALES_AGENT_ID, providerAgentId, providerLlmId },
      update: { providerAgentId, providerLlmId },
    });

    const attached = await syncSalesNumberAttachment(providerAgentId);
    return { ok: true, agentId: providerAgentId, llmId: providerLlmId, attached };
  } catch (err) {
    console.error("[platform/salesAgent] provision failed:", err.message);
    return { ok: false, reason: err.message };
  }
}

/**
 * Point FieldQuo's number at its agent, or at nothing.
 *
 * Only ever touches numbers named in FIELDQUO_SALES_NUMBER. It cannot detach a
 * tenant's line even if the variable were set to one by mistake, because
 * `salesNumberProblems()` reports that collision and this refuses to act on it
 * — a configuration typo must not be able to silence a contractor's phone.
 */
export async function syncSalesNumberAttachment(knownAgentId = null) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };

  const numbers = salesNumbers();
  if (!numbers.length) return { ok: false, reason: "no_number" };

  const [row, problems] = await Promise.all([salesAgentRow(), salesNumberProblems()]);
  const claimed = new Set(problems.filter((p) => p.code === "belongs_to_tenant").map((p) => p.e164));

  const providerAgentId = knownAgentId || row?.providerAgentId || null;
  if (!providerAgentId) return { ok: false, reason: "no_agent" };

  const want = row?.enabled ? providerAgentId : null;
  const results = [];

  for (const e164 of numbers) {
    if (claimed.has(e164)) {
      results.push({ e164, ok: false, reason: "belongs_to_tenant" });
      continue;
    }
    try {
      await attachAgent(e164, want);
      // Read it back. Retell documents how to SET the routing list and not how
      // to empty it, so a 200 on the PATCH is not proof the phone went quiet —
      // and a switch that reports success while the agent keeps answering is
      // the failure this whole area has been climbing out of.
      //
      // Only a POSITIVE mismatch fails: if the read itself does not come back
      // we have learned nothing, and refusing on no evidence would break
      // attachment every time the provider is briefly slow.
      const live = await getNumber(e164).catch(() => null);
      if (live && boundAgentId(live) !== want) {
        throw new Error(`the provider still reports ${boundAgentId(live) || "no agent"} on ${e164}`);
      }
      results.push({ e164, ok: true, answering: Boolean(want) });
    } catch (err) {
      results.push({ e164, ok: false, reason: err.message });
    }
  }

  return { ok: results.every((r) => r.ok), answering: Boolean(want), results };
}

/**
 * The same ten-link chain the tenant receptionist is checked against, asked
 * about FieldQuo's own agent.
 *
 * ── Composed, never re-derived ────────────────────────────────────────────
 *
 * resolveReadiness() in lib/voice/readiness.js is pure and takes observations,
 * which is exactly why it can be reused here: FieldQuo's agent has a different
 * number, a different agent row and no credit ledger, but the QUESTION at every
 * link is identical. Writing a second resolver would produce a second opinion,
 * and the one nobody looks at would be the one on screen.
 *
 * ── The two links that genuinely differ ───────────────────────────────────
 *
 * `hasCredit` is null rather than true. A tenant pre-pays into a credit ledger;
 * FieldQuo's own minutes come off the shared Retell account, whose health is
 * /platform/voice-health. Null means "not asked", which resolveReadiness reads
 * as "no reason to fail" — passing `true` would be claiming we checked.
 *
 * `events` proof comes from PlatformVoiceCall rather than VoiceCall, because a
 * call to this number can never create a VoiceCall — that is the hole this work
 * closed. The rejection half is platform-wide and shared, since a delivery we
 * refuse is one we never parsed and therefore never attributed.
 */
export async function checkSalesReadiness(origin) {
  const configured = voiceConfigured();

  const [config, numberProblems, health, delivered] = await Promise.all([
    buildSalesAgentConfig({ origin }).catch(() => null),
    salesNumberProblems().catch(() => []),
    // null: the rejection is platform-wide, and the accepted half comes from
    // PlatformVoiceCall below. Passing a company id here would count a tenant's
    // calls as evidence that FieldQuo's own line works.
    webhookHealth(null).catch(() => ({ accepted: 0, lastAcceptedAt: null, rejection: null })),
    salesCallDeliveryEvidence().catch(() => ({ count: 0, lastAt: null })),
  ]);

  const row = config?.row || (await salesAgentRow());
  const numbers = salesNumbers();
  const e164 = numbers[0] || null;

  const observations = {
    configured,
    providerReachable: null,
    number: {
      haveRow: numbers.length > 0,
      e164,
      // FieldQuo's line is bought outright in the Retell dashboard, so there is
      // no `provisioning` limbo and no carrier forwarding to be unsure about.
      status: numbers.length ? "active" : null,
      source: "purchased",
      publicNumber: null,
      existsAtProvider: null,
      boundAgent: null,
    },
    agent: {
      wantAgentId: row?.providerAgentId || null,
      existsAtProvider: null,
      webhookUrl: null,
      llmIdAtProvider: null,
    },
    engine: {
      wantLlmId: row?.providerLlmId || null,
      existsAtProvider: null,
      promptAtProvider: null,
      greetingAtProvider: null,
      toolUrlsAtProvider: null,
    },
    company: { enabled: Boolean(row?.enabled), hasCredit: null, cents: null },
    events: {
      providerDelivered: delivered.count > 0,
      rejectedReason: health.rejection?.reason || null,
      rejectedAfterDelivery: Boolean(
        health.rejection && delivered.lastAt && health.rejection.at > delivered.lastAt,
      ),
    },
    expectedWebhookUrl: config?.webhookUrl || (origin ? `${origin}/api/voice/webhook` : null),
    expectedToolOrigin: origin ? `${origin}/api/voice/tools/` : null,
    originIsStable: originIsStable(origin),
    expected: config ? { prompt: config.prompt, greeting: config.greeting } : null,
  };

  if (configured && e164) {
    // ── Ask the provider ─────────────────────────────────────────────────
    //
    // `providerReachable` flips to true on the FIRST answer of any kind,
    // including a 404 — a 404 is Retell answering. It flips to false only if
    // every attempt failed for another reason, because a transport failure
    // tells us nothing about what exists. Same rule as checkReadiness.
    let answered = false;
    let refused = false;
    const ask = async (fn, onOk) => {
      try {
        onOk(await fn());
        answered = true;
      } catch (err) {
        if (err instanceof RetellError && err.status === 404) {
          answered = true;
          onOk(null);
        } else {
          refused = true;
        }
      }
    };

    await ask(
      () => getNumber(e164),
      (live) => {
        observations.number.existsAtProvider = live !== null;
        observations.number.boundAgent = live ? boundAgentId(live) : null;
      },
    );

    if (observations.agent.wantAgentId) {
      await ask(
        () => getAgent(observations.agent.wantAgentId),
        (agent) => {
          observations.agent.existsAtProvider = agent !== null;
          observations.agent.webhookUrl = agent?.webhook_url || null;
          observations.agent.llmIdAtProvider = agent?.response_engine?.llm_id || null;
        },
      );
    }

    if (observations.engine.wantLlmId) {
      await ask(
        () => getRetellLlm(observations.engine.wantLlmId),
        (llm) => {
          observations.engine.existsAtProvider = llm !== null;
          observations.engine.promptAtProvider = llm?.general_prompt ?? null;
          observations.engine.greetingAtProvider = llm?.begin_message ?? null;
          observations.engine.toolUrlsAtProvider = Array.isArray(llm?.general_tools)
            ? llm.general_tools.map((t) => t?.url).filter(Boolean)
            : null;
        },
      );
    }

    observations.providerReachable = answered ? true : refused ? false : null;
  }

  const chain = resolveReadiness(observations);

  return {
    ...chain,
    // Not part of the chain, because it is a configuration mistake rather than
    // a broken link — but it is the one that would divert a contractor's
    // callers, so it is returned alongside and drawn first.
    numberProblems,
    number: e164,
    numberDisplay: e164 ? formatNumber(e164) : null,
    numberVar: SALES_NUMBER_ENV,
    enabled: Boolean(row?.enabled),
    providerAgentId: row?.providerAgentId || null,
    transferTo: config?.transferTo || null,
    transferToDisplay: config?.transferTo ? formatNumber(config.transferTo) : null,
    transferVar: SALES_TRANSFER_ENV,
    // Named so the screen can warn if the sales line is pointed at the
    // receptionist test number — a caller put through would reach whichever
    // tenant agent is being tried that day.
    transferIsSharedTestNumber: Boolean(
      config?.transferTo && isSharedTestNumber(config.transferTo),
    ),
    calls: delivered,
  };
}
