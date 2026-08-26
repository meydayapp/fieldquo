// lib/voice/provision.js
//
// Turning a company's settings into a live agent at the provider.
//
// ── Why this is its own file ───────────────────────────────────────────────
//
// Three things call it — creating a number, editing the greeting, and enabling
// the receptionist — and all three must produce exactly the same agent. Three
// copies of "build the prompt, attach the tools, push it" is three chances for
// the live agent to drift from what the settings screen says it is, and the
// symptom is a contractor swearing they changed the greeting a week ago.
//
// ── Push on every save, not just on create ─────────────────────────────────
//
// The agent at Retell is a CACHE of what's in our database, and the database is
// the truth. Editing the greeting and not pushing leaves a screen that says one
// thing and a phone that says another — which is worse than the edit failing,
// because nobody knows.
import { db } from "@/lib/db";
import {
  createAgent,
  updateAgent,
  attachAgent,
  getNumber,
  boundAgentId,
  createRetellLlm,
  updateRetellLlm,
  voiceConfigured,
} from "./retell";
import { buildAgentPrompt, buildGreeting } from "./prompt";
import { toolDefinitions } from "./tools";
import { canTakeCall } from "./credits";
// A call's length ceiling, priced from the balance. The credit gate only ever
// asked whether a call could START; nothing stopped it running an hour on two
// minutes of credit.
import { ceilingForCompany } from "./callCeiling";
import { toE164 } from "./numbers";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { groupHours, hasBusinessHours } from "@/lib/company/businessHours";
import {
  quoteTopicsForCompany,
  upsellTopicsForCompany,
  photoDestination,
} from "./quoteQuestions";
// Which of the four visit paths this company is on — book it, send them the
// link because there's a fee, put them through, or take a callback. Derived
// from their own EventType rows so it changes the moment they do.
import { visitPolicyFor } from "./availability";

/**
 * Everything the prompt needs, from the database.
 *
 * Absent facts stay absent — see the note in prompt.js. A model handed an empty
 * opening-hours string will invent hours, and a business whose opening times get
 * made up on the phone finds out from a customer standing outside a locked unit.
 */
async function factsFor(companyId) {
  const [company, enabled, areas] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        name: true, phone: true, city: true, province: true,
        // Where a caller is asked to email photos. A call cannot carry one, and
        // this is the only address the company has actually published — see
        // photoDestination() for why the sending domain and the voice number
        // are both the wrong answer.
        email: true,
        businessHours: true, defaultLanguage: true, timezone: true,
      },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { label: true, labelTranslations: true } } },
    }),
    db.workArea.findMany({ where: { companyId }, select: { name: true }, take: 30 }),
  ]);

  const language = company?.defaultLanguage || "en";

  // What a quote for this company's instantly-priced trades actually needs, so
  // the receptionist asks for it. Read AFTER the language is known, because the
  // trade names it produces are spoken aloud. Derived from the company's own
  // InstantQuoteConfig rows, which is why it changes the moment they switch a
  // service on — see the re-provision note on reprovisionIfLive().
  const quoteTopics = await quoteTopicsForCompany(companyId, language);

  // ...and what else they sell, so the receptionist can mention an upgrade the
  // company genuinely prices. Same language, same reason: the labels are read
  // out loud. Derived from lib/pricing/offerings.js, so an add-on the company
  // has zeroed is not offered on the phone either.
  const upsells = await upsellTopicsForCompany(companyId, language);

  return {
    company: company || { name: "the business" },
    language,
    quoteTopics,
    upsells,
    photosTo: photoDestination(company),
    // In the company's own language, so a French shop's agent says "Peinture
    // intérieure" rather than reading an English trade name aloud in French.
    services: enabled
      .map((e) => categoryLabel(e.category, language))
      .filter(Boolean),
    areas: areas.map((a) => a.name).filter(Boolean),
    hours: hoursSentence(company?.businessHours),
  };
}

/**
 * Opening hours as one sentence, or null.
 *
 * Null when they haven't set any — NOT "not specified", and NOT an invented
 * Mon–Fri. `hasBusinessHours` is the gate: absence of a statement is not a
 * statement, and a partial array padded with defaults is how a made-up opening
 * time reaches a caller. Same rule the website generator follows.
 *
 * An earlier version called a `describeHours` that doesn't exist, guarded with
 * optional chaining — so it returned null every time and the agent silently
 * never knew the hours. Silent, and exactly the kind of thing nobody notices.
 */
function hoursSentence(businessHours) {
  if (!hasBusinessHours(businessHours)) return null;
  try {
    const groups = groupHours(businessHours);
    const open = groups.filter((g) => !g.closed);
    if (!open.length) return null;
    return open.map((g) => `${g.label} ${g.hours}`).join(", ");
  } catch {
    return null;
  }
}

// Retell requires a voice on every agent — there is no "default" server-side, and
// omitting it fails the create. This is the fallback when the company hasn't
// picked one; `VoiceAgent.voice` overrides it.
const DEFAULT_VOICE_ID = "11labs-Adrian";
const DEFAULT_VOICE_ID_FR = "11labs-Marissa";

function voiceFor(agent, language) {
  if (agent?.voice) return agent.voice;
  return language === "fr" ? DEFAULT_VOICE_ID_FR : DEFAULT_VOICE_ID;
}

/**
 * Exactly what we would push to the provider for this company, right now.
 *
 * Split out of provisionAgent so the readiness check in lib/voice/readiness.js
 * can compare what Retell HOLDS against what we would send, rather than
 * rebuilding a second copy of the payload. A copy is the version that rots:
 * the day someone edits the prompt here, a duplicated builder over there keeps
 * reporting "in step" about a prompt that no longer matches.
 *
 * Pure of side effects — reads the database, writes nothing.
 */
export async function buildAgentConfig(companyId, origin) {
  const [agent, facts, maxCallMs] = await Promise.all([
    db.voiceAgent.findUnique({ where: { companyId } }),
    factsFor(companyId),
    // How long a call may run, priced from what this company can actually pay.
    // Retell's default is an hour; a company with two minutes of credit could
    // therefore talk for one. See lib/voice/callCeiling.js.
    ceilingForCompany(companyId),
  ]);

  // Where Retell posts call_started / call_ended / call_analyzed. Absolute, and
  // derived from the request origin so preview deployments wire to themselves.
  const webhookUrl = origin ? `${origin}/api/voice/webhook` : undefined;

  // ── Where a caller can be put through, if anywhere ───────────────────────
  //
  // Normalised here rather than trusted as typed. The settings API stores
  // whatever was entered, trimmed to 40 characters — "(613) 555-0123", "613 555
  // 0123 ext 2" — and a transfer destination has to be dialable E.164 or the
  // provider refuses the whole agent. toE164 returns null for anything it
  // cannot make sense of, and null here means "no transfer", which the prompt
  // then says out loud. Better than an agent that offers to put someone through
  // to a number that doesn't parse.
  const transferTo = toE164(agent?.transferTo);

  // ── What happens when a caller asks for someone to come out ──────────────
  //
  // This was `eventType.count({ active: true }) > 0` — "are there any
  // appointments at all?" — and that question has the wrong answer for a
  // company that charges for a visit. It booked the paid one for free. The
  // policy replaces the count with the real question: which of these can the
  // PHONE take, which need the booking page because there is money to collect,
  // and is there a link to send them to.
  //
  // Read after `transferTo`, because "can you put me through to someone?" is
  // one of the four answers and the policy has to know whether it is available.
  // Awaited separately rather than folded into the Promise.all above for the
  // same reason.
  //
  // Same function lib/voice/availability.js serves slots from, so the agent
  // cannot be told it may book something the availability endpoint then
  // refuses to offer.
  const visit = await visitPolicyFor(companyId, {
    origin,
    canTransfer: Boolean(transferTo),
  });
  const canBook = visit.canBook;

  // The PROMPT half (Retell LLM). Rebuilt from scratch every push, so a company
  // that DELETES their custom note gets an agent without it — merging would
  // leave removed instructions live forever.
  const llmPayload = {
    general_prompt: buildAgentPrompt({
      company: facts.company,
      services: facts.services,
      areas: facts.areas,
      hours: facts.hours,
      notes: agent?.instructions,
      canBook,
      visit,
      canTransfer: Boolean(transferTo),
      quoteTopics: facts.quoteTopics,
      upsells: facts.upsells,
      photosTo: facts.photosTo,
    }),
    begin_message: buildGreeting({ company: facts.company, greeting: agent?.greeting }),
    general_tools: toolDefinitions(origin, { canBook, transferTo }),
  };

  const agentPayload = {
    agent_name: `${facts.company.name} — receptionist`,
    language: facts.language === "fr" ? "fr-CA" : "en-US",
    voice_id: voiceFor(agent, facts.language),
    // Always sent, so a re-provision can bring a stale ceiling DOWN as well as
    // up. Omitting it when it happens to equal the default would leave an agent
    // provisioned before this existed on Retell's one-hour default for ever.
    max_call_duration_ms: maxCallMs,
    ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
  };

  return { agent, facts, canBook, visit, transferTo, webhookUrl, maxCallMs, llmPayload, agentPayload };
}

/**
 * Create or update this company's agent at the provider.
 *
 * ── The two-object shape ───────────────────────────────────────────────────
 *
 * Retell splits an agent in two, and this used to get it wrong:
 *   • a RETELL LLM holds general_prompt / begin_message / general_tools, and
 *   • an AGENT holds voice_id (required), language, webhook_url, and points at
 *     the LLM through response_engine: { type: "retell-llm", llm_id }.
 *
 * The old code POSTed the prompt fields straight to /create-agent with no
 * response_engine and usually no voice_id. That call fails, so provisioning
 * returned {ok:false} — and the number was still bought, attached to nothing.
 * A contractor completed the whole setup and callers heard silence.
 *
 * ── webhook_url ────────────────────────────────────────────────────────────
 *
 * Set here, on the agent. Without it Retell never posts call_started, so no
 * VoiceCall row is created — which means every tool call ("save this caller")
 * is rejected for lack of context, no lead is ever saved, and no minute is ever
 * billed. The whole feature hangs off this one field.
 *
 * ── Why nothing is published ───────────────────────────────────────────────
 *
 * Retell agents have versions and a draft/publish split: `update-agent` edits
 * "the latest draft version", and published versions are immutable. We never
 * call publish-agent-version, and that is a decision rather than an omission.
 *
 * A phone number resolves an unpinned agent to the LATEST version — latest
 * created, not latest published. Since every save here writes the newest
 * version and nothing is ever frozen, the newest version is always what we just
 * wrote, so a contractor's greeting edit is live on the next call. Adding a
 * publish step would buy nothing and would need the whole ceremony with it
 * (branch a draft from the published base, edit it, publish it), because you
 * cannot edit a published version in place.
 *
 * The catch, and it is the reason this is written down: it depends on the
 * number being UNPINNED. Publish anything — from here or from the Retell
 * dashboard — and the choice comes back, because then "latest" and "what's
 * live" can differ. See agentRouting() in retell.js for the one-line change.
 *
 * @returns { ok, agentId } or { ok: false, reason }
 */
export async function provisionAgent(companyId, origin) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };

  const { agent, facts, canBook, transferTo, webhookUrl, maxCallMs, llmPayload, agentPayload } =
    await buildAgentConfig(companyId, origin);

  try {
    let providerAgentId = agent?.providerAgentId;
    let providerLlmId = agent?.providerLlmId;

    // 1. The response engine.
    if (providerLlmId) {
      await updateRetellLlm(providerLlmId, llmPayload);
    } else {
      const createdLlm = await createRetellLlm(llmPayload);
      providerLlmId = createdLlm?.llm_id;
      if (!providerLlmId) return { ok: false, reason: "no_llm_id" };
    }

    // 2. The agent that speaks it. `response_engine` is bolted on here rather
    // than inside buildAgentConfig because the llm id is not known until step 1
    // has run on a first provision.
    const payload = {
      ...agentPayload,
      response_engine: { type: "retell-llm", llm_id: providerLlmId },
    };

    if (providerAgentId) {
      await updateAgent(providerAgentId, payload);
    } else {
      const created = await createAgent(payload);
      providerAgentId = created?.agent_id;
      if (!providerAgentId) return { ok: false, reason: "no_agent_id" };
    }

    // ── The outbound agent ────────────────────────────────────────────────
    //
    // A second agent, template-driven: its whole prompt and opening line are
    // dynamic variables filled in per call (see lib/voice/outboundCall.js), so
    // one standing agent runs every outbound purpose without a per-call agent
    // and without one customer's brief bleeding into another's. Reprovisioned
    // alongside the inbound one so voice/language stay in step.
    let outboundAgentId = agent?.outboundProviderAgentId;
    let outboundLlmId = agent?.outboundProviderLlmId;
    const outboundLlmPayload = {
      // The literal braces are Retell's dynamic-variable syntax, not a bug.
      general_prompt: "{{outbound_prompt}}",
      begin_message: "{{opening}}",
      // save_caller only — an outbound call records what it learns onto the
      // lead/client it was placed about; it never books or quotes.
      general_tools: toolDefinitions(origin, { canBook: false }),
    };
    try {
      if (outboundLlmId) {
        await updateRetellLlm(outboundLlmId, outboundLlmPayload);
      } else {
        const createdOutLlm = await createRetellLlm(outboundLlmPayload);
        outboundLlmId = createdOutLlm?.llm_id || null;
      }
      if (!outboundLlmId) throw new Error("no outbound llm_id");

      const outboundPayload = {
        agent_name: `${facts.company.name} — outbound`,
        language: facts.language === "fr" ? "fr-CA" : "en-US",
        voice_id: voiceFor(agent, facts.language),
        response_engine: { type: "retell-llm", llm_id: outboundLlmId },
        // The same ceiling as inbound. An outbound minute costs the shared pool
        // exactly what an inbound one does, and capping only the number a
        // stranger dials would leave the half we initiate uncapped.
        max_call_duration_ms: maxCallMs,
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      };

      if (outboundAgentId) {
        await updateAgent(outboundAgentId, outboundPayload);
      } else {
        const createdOut = await createAgent(outboundPayload);
        outboundAgentId = createdOut?.agent_id || null;
      }
    } catch (err) {
      // Non-fatal: a company can still take inbound calls if the outbound agent
      // fails to provision. Logged, and outboundAgentId stays null so
      // placeOutboundCall refuses rather than dialling with no brief.
      console.error("[voice/provision] outbound agent failed:", err.message);
      outboundAgentId = agent?.outboundProviderAgentId || null;
      outboundLlmId = agent?.outboundProviderLlmId || null;
    }

    await db.voiceAgent.upsert({
      where: { companyId },
      create: {
        companyId,
        providerAgentId,
        providerLlmId,
        outboundProviderAgentId: outboundAgentId,
        outboundProviderLlmId: outboundLlmId,
      },
      update: {
        providerAgentId,
        providerLlmId,
        outboundProviderAgentId: outboundAgentId,
        outboundProviderLlmId: outboundLlmId,
      },
    });

    // ── The "Answer my calls" switch, honoured at the PROVIDER ──────────────
    //
    // Attaching the agent to the number is what makes it answer, and this used
    // to happen unconditionally at buy time — so the agent answered from the
    // moment a number existed, while the screen still showed the switch off, and
    // turning it off changed nothing. A dead control in both directions, on the
    // one setting whose whole purpose is "don't answer yet".
    //
    // Now: attach when enabled, detach when not. `enabled` defaults to false, so
    // a freshly bought number stays silent until the contractor says otherwise.
    //
    // ── And the result TRAVELS ────────────────────────────────────────────
    //
    // This was `await syncNumberAttachment(...)` with the return value dropped,
    // and the `{ ok: true }` below went out regardless. So the settings PUT —
    // whose whole job on this field is to report whether the phone picked the
    // change up — answered `live: true` after a detach that had failed at the
    // provider. A contractor pressed "turn off", saw it save, and the agent
    // kept answering and kept billing. The one switch whose purpose is "stop
    // answering" was the one that could report success without doing it.
    const attachment = await syncNumberAttachment(companyId, providerAgentId);

    return { ok: true, agentId: providerAgentId, outboundAgentId, canBook, attachment };
  } catch (err) {
    console.error("[voice/provision] failed", err);
    return { ok: false, reason: err.message };
  }
}

/**
 * Re-push an ALREADY-LIVE agent, from a screen that isn't the voice settings.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The agent's prompt is built from the company's services (`factsFor`) and, now,
 * from what a quote for those services needs (`quoteTopicsForCompany`). Both are
 * edited on OTHER screens — Settings › Services and Settings › Instant Quote —
 * neither of which pushed anything. So a contractor could switch Cabinet
 * Refacing on, watch the settings screen say so, and have a receptionist that
 * had never heard of it until the next unrelated save on the voice page. The
 * agent at Retell is a cache of our database; a cache nothing invalidates is a
 * screen that lies.
 *
 * ── Why it is not just provisionAgent ──────────────────────────────────────
 *
 * provisionAgent CREATES an agent when there isn't one. Calling it from the
 * services screen would provision a Retell agent — and start the outbound one
 * too — for a company that has never touched voice, off a save about price
 * books. So this refuses unless the company already has a live agent id, and
 * says which it is rather than returning a bare false.
 *
 * Best-effort by contract: callers must not let it fail the save it follows.
 */
export async function reprovisionIfLive(companyId, origin) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };

  const agent = await db.voiceAgent
    .findUnique({ where: { companyId }, select: { providerAgentId: true } })
    .catch(() => null);
  if (!agent?.providerAgentId) return { ok: false, reason: "no_agent" };

  return provisionAgent(companyId, origin);
}

/**
 * Make the provider match our two "should it answer?" rules: the contractor has
 * switched it ON, and there's at least a minute of credit.
 *
 * Attachment IS the on/off switch — a number with an agent is answered, a number
 * without one is not. (What the CALLER hears when it is not — ringing, or a busy
 * tone — is undocumented and is deliberately no longer asserted here; see
 * attachAgent in lib/voice/retell.js for what was and wasn't established.) Both
 * rules were previously unenforced at the provider:
 * the agent was attached at buy time and never detached, so the switch did
 * nothing and an exhausted account kept answering (and went further negative).
 *
 * Called after provisioning, after a call is billed, and after a top-up, so the
 * three places that can change the answer all converge on the same state. Safe
 * to call often — attaching an already-attached number is a no-op.
 */
/**
 * Reasons syncNumberAttachment says no that are NOT a failure of the switch.
 *
 * A company with no number, no agent, or no provider credentials has nothing to
 * attach or detach — the on/off switch is correct and inert. Everything else
 * means the provider was asked and did not comply, which is the case a
 * contractor has to be told about, because the phone is not doing what the
 * screen says it is.
 *
 * A named helper rather than an inline list at the one call site, because the
 * second copy of a list like this is the one that goes stale when a fourth
 * structural reason is added.
 */
const NOTHING_TO_ATTACH = ["no_number", "no_agent", "not_configured"];

/** Did an attach/detach genuinely fail at the provider? */
export function attachmentFailed(result) {
  if (!result) return false;
  if (result.ok) return false;
  return !NOTHING_TO_ATTACH.includes(result.reason);
}

export async function syncNumberAttachment(companyId, knownAgentId = null) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };

  const [agent, number] = await Promise.all([
    db.voiceAgent.findUnique({
      where: { companyId },
      select: { id: true, providerAgentId: true, enabled: true },
    }),
    // ── heldNumber, not "active" ─────────────────────────────────────────
    //
    // This required `status: "active"` and it deadlocked a real company. Their
    // number sat on `provisioning` — the purchase completed at Retell and died
    // before its own UPDATE — so this found nothing, the number was never
    // attached to the agent, and no call could ever be answered. Meanwhile the
    // one thing that repairs a stale status is a page load, so the order the
    // contractor happened to do things in decided whether their phone worked.
    //
    // A number the company HOLDS is the right question. Retell is the authority
    // on whether it exists — attachAgent fails loudly if it does not — so
    // filtering on our own possibly-stale column before asking was checking the
    // copy instead of the original.
    db.voicePhoneNumber.findFirst({
      where: { companyId, status: { in: ["provisioning", "active"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, e164: true, agentId: true, status: true, numberType: true },
    }),
  ]);
  if (!number?.e164) return { ok: false, reason: "no_number" };

  const providerAgentId = knownAgentId || agent?.providerAgentId;
  if (!providerAgentId) return { ok: false, reason: "no_agent" };

  // The number's OWN rate, not the local default. A toll-free minute costs more
  // than a local one, so asking `canTakeCall` without the type is the same
  // wrong comparison the settings PUT gate already had fixed: a company with
  // 35¢ would keep a toll-free line attached whose first minute costs 40¢.
  const { allowed } = await canTakeCall(companyId, number.numberType);
  const shouldAnswer = Boolean(agent?.enabled) && allowed;

  const want = shouldAnswer ? providerAgentId : null;

  try {
    await attachAgent(number.e164, want);

    // ── Read it back ──────────────────────────────────────────────────────
    //
    // Attaching moved from a scalar field to a weighted list when Retell
    // deprecated `inbound_agent_id`, and the reference documents everything
    // about that list EXCEPT how to empty it — routing happens "if set and
    // non-empty", but no detach procedure is named. A 200 on the PATCH is
    // therefore not evidence the phone stopped answering, and this is the one
    // call where that distinction is the whole feature: a switch that reports
    // success and leaves the agent answering keeps billing a company that
    // turned voice off.
    //
    // Only a POSITIVE mismatch fails. If the read itself doesn't come back we
    // learn nothing, and refusing on no evidence would break attachment every
    // time the provider is briefly slow.
    const live = await getNumber(number.e164).catch(() => null);
    if (live && boundAgentId(live) !== want) {
      throw new Error(
        `the provider still reports ${boundAgentId(live) || "no agent"} on ${number.e164}`,
      );
    }

    // Mirror it locally. VoicePhoneNumber.agentId was read by the webhook (it
    // stamps VoiceCall.agentId) but never written, so every call recorded a null
    // agent — a dead write path. Now it reflects what's actually attached.
    //
    // OUR id, not Retell's. The column is a foreign key to VoiceAgent.id, and
    // this used to store `providerAgentId` — an id no VoiceAgent row has — so
    // every attach died on a foreign-key violation, got swallowed by the catch
    // below, and reported "couldn't attach the number" for a number that had in
    // fact been attached. The write path stayed dead and said it wasn't.
    await db.voicePhoneNumber.update({
      where: { id: number.id },
      data: {
        agentId: shouldAnswer ? agent?.id || null : null,
        // Retell just answered about this number and did what we asked, which
        // is better evidence than the column. A row still reading
        // `provisioning` at this point is a purchase that completed at the
        // provider and died before its own UPDATE — and every other screen
        // gates on that column, so leaving it stale keeps the feature switched
        // off everywhere while the phone itself is fine.
        //
        // One direction only, and only off `provisioning`: a released or failed
        // number is not resurrected by an attach succeeding.
        ...(number.status === "provisioning" && { status: "active" }),
      },
    });
    return { ok: true, answering: shouldAnswer };
  } catch (err) {
    console.error(
      `[voice/provision] couldn't ${shouldAnswer ? "attach" : "detach"} the number:`,
      err.message,
    );
    return { ok: false, reason: err.message };
  }
}
