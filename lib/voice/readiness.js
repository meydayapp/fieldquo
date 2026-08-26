// lib/voice/readiness.js
//
// Every link in the chain between a stranger dialling and a lead landing —
// asked of the PROVIDER, one link at a time, and reported in plain words.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The owner was told the phone receptionist worked. It never has. His account
// had a number stuck on `provisioning`, an agent switched off, a number never
// attached to it, and a webhook verifier that rejected 100% of deliveries — and
// every screen in the app said something reassuring, because every screen was
// reading OUR OWN COLUMNS. Our columns were the thing that was wrong.
//
// So the one rule this module is built around:
//
//   NO LINK IS EVER GREEN ON THE STRENGTH OF OUR OWN DATABASE.
//
// Each link's `ok` requires an observation the provider gave us. A provider we
// could not reach yields `unknown`, never `ok` and never `fail` — absence of a
// reply is not a reply, the same rule lib/voice/diagnose.js follows. That is
// asserted by scripts/check-voice-readiness.mjs over every combination of
// states, because this is the module whose being wrong is invisible.
//
// ══ Not a second diagnosis ═════════════════════════════════════════════════
//
// The number/binding verdict comes from diagnoseNumber() in
// lib/voice/diagnose.js, and the repair comes from the existing repair route.
// This adds the four links that diagnosis never covered — the agent object, the
// response engine, the webhook URL Retell holds, and the prompt Retell holds —
// and it composes rather than re-deriving. Two modules that both decide whether
// a number is bound will disagree, and the one nobody looks at will be the one
// on screen.
//
// ══ Who fixes it ═══════════════════════════════════════════════════════════
//
// Every failure names a cause AND an owner:
//
//   "fieldquo"  our push never landed. Fixable from the button on the page.
//   "company"   the contractor's own decision or their own carrier — the
//               receptionist is off, the credit ran out, forwarding isn't set.
//               Never "repaired" on their behalf.
//   "unknown"   we could not see. Never presented as either.

import { db } from "@/lib/db";
import { voiceConfigured, getAgent, getRetellLlm, RetellError } from "./retell";
import { diagnoseAndHeal } from "./diagnose";
import { buildAgentConfig } from "./provision";
import { webhookHealth } from "./webhookHealth";
import { SIGNATURE_REASON_TEXT } from "./webhookSignature";
import { READINESS_LINKS, reasonKeyFor } from "./readinessCopy";

// Re-exported so a server-side caller needs one import rather than two. The
// copy itself lives in readinessCopy.js because this file imports Prisma and
// the client component cannot.
export { READINESS_LINKS };

/** Links that must all be `ok` before we may tell anyone the phone will answer. */
export const REQUIRED_LINKS = [
  "provider",
  "number",
  "agent",
  "engine",
  "binding",
  "switch",
  "webhook",
];

/**
 * What a fix button may do, and nothing else.
 *
 *   resync   push our configuration to the provider again (provisionAgent).
 *            Honours `enabled`, so it can never switch a contractor's phone on.
 *   repair   the existing number repair — release a ghost, build a missing
 *            agent, finish a binding. Owned by the repair route.
 *   enable / topup / forwarding are the contractor's own actions and carry NO
 *            button here: they are things only they can decide or do.
 */
export const FIXES = ["resync", "repair", "enable", "topup", "forwarding"];

const OK = "ok";
const FAIL = "fail";
const UNKNOWN = "unknown";

/**
 * Is this origin one Retell can be pointed at and left pointed at?
 *
 * `provisionAgent` derives `webhook_url` from the origin of whichever request
 * triggered it, which is the right default — a preview deployment must wire to
 * itself or it would post test calls into production. The cost is that a save
 * made from a preview URL, or from a laptop, silently repoints the LIVE agent
 * at an address that stops existing. That is the single most likely explanation
 * for a phone that answers perfectly and records nothing.
 *
 * So anything that could not still be there next month is not stable: Vercel's
 * per-deployment hostnames and any form of localhost.
 */
export function originIsStable(origin) {
  if (!origin) return false;
  let host;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return false;
  // `fieldquo.vercel.app` is a project alias and survives; `fieldquo-abc123.vercel.app`
  // is one deployment and does not. Treated the same way regardless, because a
  // webhook is not the place to be clever about which vercel.app host is which.
  if (host.endsWith(".vercel.app")) return false;
  return true;
}

function link(id, state, reason, { fixer = null, fix = null, detail = null } = {}) {
  return { id, state, reasonKey: reasonKeyFor(id, reason), reason, fixer, fix, detail };
}

/** "we could not ask" — the only honest answer downstream of a dead provider. */
function unreachable(id) {
  return link(id, UNKNOWN, "unchecked", { fixer: "unknown" });
}

/**
 * Turn provider observations into the chain. PURE — no I/O, injectable.
 *
 * Every field that describes the provider is three-state: `true` observed
 * present, `false` observed absent (a 404 — evidence), `null` we could not
 * look. A `null` may never produce `ok` or `fail`.
 *
 * @param {object} o observations, see checkReadiness below for how they are gathered
 */
export function resolveReadiness(o = {}) {
  const links = [];

  // ── 1. The provider itself ───────────────────────────────────────────────
  //
  // Everything below asks Retell something. If we have no key, or every call
  // we made failed, nothing below is knowable and saying so once beats nine
  // copies of the same shrug.
  const providerLink = !o.configured
    ? link("provider", FAIL, "not_configured", { fixer: "fieldquo" })
    : o.providerReachable === true
      ? link("provider", OK, "reachable")
      : o.providerReachable === false
        ? link("provider", FAIL, "unreachable", { fixer: "unknown" })
        : link("provider", UNKNOWN, "unchecked", { fixer: "unknown" });
  links.push(providerLink);
  const canAsk = providerLink.state === OK;

  const n = o.number || {};
  const a = o.agent || {};
  const e = o.engine || {};
  const c = o.company || {};

  // ── 2. The number ────────────────────────────────────────────────────────
  //
  // "No number at all" is not a provider question, so it is answered even when
  // Retell is down: there is nothing to look up.
  let numberLink;
  if (n.haveRow === false) {
    numberLink = link("number", FAIL, "none", { fixer: "company" });
  } else if (n.haveRow !== true) {
    numberLink = unreachable("number");
  } else if (n.status === "porting") {
    // A port in flight is slow, not broken. The port card owns that state.
    numberLink = link("number", UNKNOWN, "porting", { fixer: "company" });
  } else if (!canAsk) {
    numberLink = unreachable("number");
  } else if (n.existsAtProvider === true) {
    numberLink = link("number", OK, "ours", { detail: { e164: n.e164 } });
  } else if (n.existsAtProvider === false) {
    // A 404 from get-phone-number on OUR account means this number is not on
    // it — the purchase died halfway, or the row names somebody else's number.
    // Either way nobody is renting it and nothing can ever answer on it.
    numberLink = link("number", FAIL, "not_ours", { fixer: "fieldquo", fix: "repair" });
  } else {
    numberLink = unreachable("number");
  }
  links.push(numberLink);

  // ── 3. The agent object ──────────────────────────────────────────────────
  let agentLink;
  if (!canAsk) agentLink = unreachable("agent");
  else if (!a.wantAgentId) agentLink = link("agent", FAIL, "never_built", { fixer: "fieldquo", fix: "resync" });
  else if (a.existsAtProvider === true) agentLink = link("agent", OK, "present", { detail: { agentId: a.wantAgentId } });
  else if (a.existsAtProvider === false)
    // We hold an id the provider has never heard of. Deleting an agent in the
    // Retell dashboard does exactly this, and our column happily keeps naming
    // the corpse.
    agentLink = link("agent", FAIL, "gone", { fixer: "fieldquo", fix: "resync" });
  else agentLink = unreachable("agent");
  links.push(agentLink);

  // ── 4. The response engine (the prompt object) ───────────────────────────
  let engineLink;
  if (!canAsk) engineLink = unreachable("engine");
  else if (!e.wantLlmId) engineLink = link("engine", FAIL, "never_built", { fixer: "fieldquo", fix: "resync" });
  else if (e.existsAtProvider === false) engineLink = link("engine", FAIL, "gone", { fixer: "fieldquo", fix: "resync" });
  else if (e.existsAtProvider !== true) engineLink = unreachable("engine");
  else if (a.llmIdAtProvider && a.llmIdAtProvider !== e.wantLlmId)
    // The agent is speaking a DIFFERENT prompt object from the one we maintain.
    // Every greeting edit would land on an engine no call uses.
    engineLink = link("engine", FAIL, "detached", {
      fixer: "fieldquo",
      fix: "resync",
      detail: { holds: a.llmIdAtProvider, ours: e.wantLlmId },
    });
  else engineLink = link("engine", OK, "present");
  links.push(engineLink);

  // ── 5. The binding — attachment IS the on/off switch ─────────────────────
  //
  // Precedence matters and mirrors verdictFor() in diagnose.js: a number left
  // unbound because the contractor switched voice off looks identical at the
  // provider to one whose attach failed, and only one of them is a fault.
  let bindingLink;
  if (numberLink.state !== OK || agentLink.state !== OK) bindingLink = unreachable("binding");
  else if (n.boundAgent && n.boundAgent === a.wantAgentId) bindingLink = link("binding", OK, "attached");
  else if (c.enabled === false)
    bindingLink = link("binding", FAIL, "voice_off", { fixer: "company", fix: "enable" });
  else if (c.hasCredit === false)
    bindingLink = link("binding", FAIL, "no_credit", { fixer: "company", fix: "topup" });
  else if (n.boundAgent)
    bindingLink = link("binding", FAIL, "bound_elsewhere", {
      fixer: "fieldquo",
      fix: "resync",
      detail: { holds: n.boundAgent, ours: a.wantAgentId },
    });
  else bindingLink = link("binding", FAIL, "unbound", { fixer: "fieldquo", fix: "resync" });
  links.push(bindingLink);

  // ── 6. Switched on, and able to afford a call ────────────────────────────
  //
  // The one link that is genuinely about our own state — and it STILL is not
  // allowed to go green on it. "Switched on here" was the lie the whole feature
  // told: a toggle reading ON above a number with nothing attached. Its `ok`
  // therefore requires the provider-confirmed binding above.
  let switchLink;
  if (c.enabled === false) switchLink = link("switch", FAIL, "voice_off", { fixer: "company", fix: "enable" });
  else if (c.hasCredit === false)
    switchLink = link("switch", FAIL, "no_credit", { fixer: "company", fix: "topup", detail: { cents: c.cents ?? null } });
  else if (bindingLink.state === OK) switchLink = link("switch", OK, "on");
  else if (bindingLink.state === UNKNOWN) switchLink = unreachable("switch");
  else
    // On here, not on at the provider. The dead control, named.
    switchLink = link("switch", FAIL, "not_live", { fixer: "fieldquo", fix: "resync" });
  links.push(switchLink);

  // ── 7. Where Retell posts call events ────────────────────────────────────
  //
  // Read back off the agent, never off our config. A webhook_url left pointing
  // at a preview deployment posts every call into the void, and the symptom is
  // an empty call list on a phone that answered perfectly.
  let webhookLink;
  if (agentLink.state !== OK) webhookLink = unreachable("webhook");
  else if (!o.expectedWebhookUrl) webhookLink = unreachable("webhook");
  else if (o.originIsStable === false)
    // ── Looking at this from a preview deployment ─────────────────────────
    //
    // The expected URL is derived from the address in the browser's bar, so on
    // a `*.vercel.app` preview or on localhost the comparison would call a
    // perfectly healthy production webhook "wrong" — and a Fix pressed here
    // would REPOINT the live agent at a deployment that gets torn down in a
    // week. Neither the verdict nor the repair is safe from here, so this says
    // so instead of guessing. The repair route refuses for the same reason.
    webhookLink = link("webhook", UNKNOWN, "preview_origin", {
      fixer: "unknown",
      detail: { holds: a.webhookUrl || null, ours: o.expectedWebhookUrl },
    });
  else if (!a.webhookUrl)
    webhookLink = link("webhook", FAIL, "missing", { fixer: "fieldquo", fix: "resync" });
  else if (a.webhookUrl !== o.expectedWebhookUrl)
    webhookLink = link("webhook", FAIL, "elsewhere", {
      fixer: "fieldquo",
      fix: "resync",
      detail: { holds: a.webhookUrl, ours: o.expectedWebhookUrl },
    });
  else webhookLink = link("webhook", OK, "matches", { detail: { url: a.webhookUrl } });
  links.push(webhookLink);

  // ── 8. The words the phone is actually running ───────────────────────────
  //
  // Compared against what buildAgentConfig would push RIGHT NOW, so a failed
  // save that left the old wording live is visible instead of being covered by
  // a settings form showing the new wording.
  let promptLink;
  if (engineLink.state !== OK || !o.expected) promptLink = unreachable("prompt");
  else if (e.promptAtProvider == null) promptLink = unreachable("prompt");
  else if (e.promptAtProvider !== o.expected.prompt)
    promptLink = link("prompt", FAIL, "drifted", { fixer: "fieldquo", fix: "resync" });
  else if (e.greetingAtProvider !== o.expected.greeting)
    promptLink = link("prompt", FAIL, "greeting_drifted", {
      fixer: "fieldquo",
      fix: "resync",
      detail: { holds: e.greetingAtProvider || null, ours: o.expected.greeting },
    });
  else if (
    // Skipped from a preview, for the same reason the webhook link is: the
    // expected origin is whatever is in the browser bar, and the live tools may
    // be perfectly correct for production. The prompt and greeting above do not
    // depend on the origin, so those two are still judged.
    o.originIsStable !== false &&
    Array.isArray(e.toolUrlsAtProvider) &&
    o.expectedToolOrigin &&
    e.toolUrlsAtProvider.some((u) => !String(u).startsWith(o.expectedToolOrigin))
  )
    // The agent can still talk; it just cannot SAVE anybody, because the tool
    // endpoints it was given belong to a deployment that no longer exists.
    promptLink = link("prompt", FAIL, "tools_elsewhere", { fixer: "fieldquo", fix: "resync" });
  else promptLink = link("prompt", OK, "in_step");
  links.push(promptLink);

  // ── 9. Have events actually landed ───────────────────────────────────────
  //
  // The only end-to-end proof in the list, and deliberately the only link whose
  // evidence is a past provider ACTION rather than a present provider answer.
  // `providerDelivered` is set from the existence of a call we recorded, which
  // can only happen after a signature we accepted — never from a config column.
  const ev = o.events || {};
  let eventsLink;
  if (ev.rejectedReason && (!ev.providerDelivered || ev.rejectedAfterDelivery))
    eventsLink = link("events", FAIL, "rejected", {
      fixer: "fieldquo",
      detail: {
        why: SIGNATURE_REASON_TEXT[ev.rejectedReason] || ev.rejectedReason,
        reason: ev.rejectedReason,
      },
    });
  else if (ev.providerDelivered === true) eventsLink = link("events", OK, "landing");
  // No call has ever come in. That is not a failure and must not be drawn as
  // one — it is the state of a phone nobody has dialled yet.
  else eventsLink = link("events", UNKNOWN, "none_yet");
  links.push(eventsLink);

  // ── 10. Carrier forwarding — permanently unknowable ──────────────────────
  //
  // Only for a forwarded setup, and it can never be anything but `unknown`: the
  // forward is a rule inside the contractor's own carrier and no API we hold
  // can see it. Saying "we cannot check this" is the honest version; a green
  // tick here would be the single most dangerous line on the page.
  if (n.source === "forwarded") {
    links.push(
      link("forwarding", UNKNOWN, "uncheckable", {
        fixer: "company",
        fix: "forwarding",
        detail: { ours: n.e164 || null, theirs: n.publicNumber || null },
      }),
    );
  }

  const anyFail = links.some((l) => l.state === FAIL);
  const required = links.filter((l) => REQUIRED_LINKS.includes(l.id));
  const allRequiredOk = required.length > 0 && required.every((l) => l.state === OK);

  return {
    links,
    // Three-state on purpose, exactly like each link. "We could not tell" is a
    // legitimate outcome of a readiness check and pretending otherwise is how
    // this feature got its reputation.
    overall: allRequiredOk ? (anyFail ? "ready_with_warnings" : "ready") : anyFail ? "not_ready" : "unsure",
    // What a single button could put right without deciding anything for them.
    repairable: links.some((l) => l.state === FAIL && l.fixer === "fieldquo" && l.fix),
    fixes: [...new Set(links.filter((l) => l.state === FAIL && l.fix).map((l) => l.fix))],
  };
}

/**
 * Go and ask. Gathers observations, then hands them to the pure resolver.
 *
 * Costs up to four provider round-trips on a screen a contractor opens rarely,
 * and only when they press the button. Cheap against the alternative, which was
 * a page asserting a chain nobody had ever checked.
 *
 * @param origin this deployment's absolute origin, from getAppOrigin(request)
 */
export async function checkReadiness(companyId, origin) {
  const configured = voiceConfigured();

  const [diagnosis, agentRow, health, config] = await Promise.all([
    // ── The number half comes from the existing diagnosis, not a second one ──
    //
    // diagnoseAndHeal already asks get-phone-number, reads the bound agent back
    // and corrects a stale `provisioning` column in the one safe direction. A
    // parallel copy here would be a second opinion on the same question, and
    // the settings page would then have two panels that can disagree.
    diagnoseAndHeal(companyId).catch(() => null),
    db.voiceAgent.findUnique({
      where: { companyId },
      select: { enabled: true, providerAgentId: true, providerLlmId: true },
    }),
    webhookHealth(companyId).catch(() => ({ accepted: 0, lastAcceptedAt: null, rejection: null })),
    // What we WOULD push. Never pushed here — a readiness check that changes
    // the thing it is measuring is not a readiness check.
    buildAgentConfig(companyId, origin).catch(() => null),
  ]);

  const observations = {
    configured,
    // The diagnosis made a provider call unless there was nothing to ask about.
    // `provider_unreachable` is its own way of saying the transport failed.
    providerReachable:
      !diagnosis || diagnosis.verdict === "no_number" || diagnosis.verdict === "not_configured"
        ? null
        : diagnosis.verdict === "provider_unreachable"
          ? false
          : true,
    number: {
      // Three-state like everything else: `null` means the diagnosis itself
      // threw, which is not evidence that the company has no number.
      haveRow: diagnosis ? diagnosis.verdict !== "no_number" : null,
      e164: diagnosis?.e164 || null,
      status: diagnosis?.status || null,
      source: diagnosis?.source || null,
      publicNumber: diagnosis?.publicNumber || null,
      existsAtProvider: diagnosis?.existsAtProvider ?? null,
      boundAgent: diagnosis?.boundAgent || null,
    },
    agent: {
      wantAgentId: agentRow?.providerAgentId || null,
      existsAtProvider: null,
      webhookUrl: null,
      llmIdAtProvider: null,
    },
    engine: {
      wantLlmId: agentRow?.providerLlmId || null,
      existsAtProvider: null,
      promptAtProvider: null,
      greetingAtProvider: null,
      toolUrlsAtProvider: null,
    },
    company: {
      enabled: Boolean(agentRow?.enabled),
      // `balanceCents` is only filled in once canTakeCall has actually run, so
      // it is the honest signal for "we know". Without it, a company with no
      // number would be reported as out of credit — a second, invented problem
      // on top of the real one.
      hasCredit: diagnosis?.balanceCents == null ? null : Boolean(diagnosis.hasCredit),
      cents: diagnosis?.balanceCents ?? null,
    },
    events: {
      providerDelivered: health.accepted > 0,
      rejectedReason: health.rejection?.reason || null,
      rejectedAfterDelivery: Boolean(
        health.rejection && health.lastAcceptedAt && health.rejection.at > health.lastAcceptedAt,
      ),
    },
    expectedWebhookUrl: config?.webhookUrl || (origin ? `${origin}/api/voice/webhook` : null),
    expectedToolOrigin: origin ? `${origin}/api/voice/tools/` : null,
    originIsStable: originIsStable(origin),
    expected: config
      ? {
          prompt: config.llmPayload.general_prompt,
          greeting: config.llmPayload.begin_message,
        }
      : null,
  };

  if (!configured) return { ...resolveReadiness(observations), observations: redact(observations) };

  // ── Reached, or not ──────────────────────────────────────────────────────
  //
  // `providerReachable` flips to true on the FIRST answer of any kind,
  // including a 404: a 404 is Retell answering. It flips to false only if every
  // attempt failed for a non-404 reason, because a transport failure tells us
  // nothing about what exists.
  let answered = observations.providerReachable === true;
  let refused = observations.providerReachable === false;

  const ask = async (fn, onOk) => {
    try {
      const res = await fn();
      answered = true;
      onOk(res, true);
    } catch (err) {
      if (err instanceof RetellError && err.status === 404) {
        answered = true;
        onOk(null, false);
      } else {
        refused = true;
      }
    }
  };

  await Promise.all([
    agentRow?.providerAgentId
      ? ask(
          () => getAgent(agentRow.providerAgentId),
          (res, exists) => {
            observations.agent.existsAtProvider = exists;
            observations.agent.webhookUrl = res?.webhook_url || null;
            observations.agent.llmIdAtProvider = res?.response_engine?.llm_id || null;
          },
        )
      : Promise.resolve(),
    agentRow?.providerLlmId
      ? ask(
          () => getRetellLlm(agentRow.providerLlmId),
          (res, exists) => {
            observations.engine.existsAtProvider = exists;
            observations.engine.promptAtProvider = res?.general_prompt ?? null;
            observations.engine.greetingAtProvider = res?.begin_message ?? null;
            observations.engine.toolUrlsAtProvider = Array.isArray(res?.general_tools)
              ? res.general_tools.map((tool) => tool?.url).filter(Boolean)
              : null;
          },
        )
      : Promise.resolve(),
  ]);

  // Nothing to ask about is not the same as nothing answering. A company with
  // no number, no agent and no engine made no calls at all, and the provider is
  // "unchecked" rather than "reachable" — which keeps every link below honest.
  //
  // One answer is enough. A single 404 among three timeouts still proves Retell
  // is up, and the three links that timed out stay `unknown` on their own
  // three-state fields rather than being condemned by the transport.
  observations.providerReachable = answered ? true : refused ? false : null;

  return { ...resolveReadiness(observations), observations: redact(observations) };
}

/**
 * What may cross to the browser.
 *
 * Provider ids and the full prompt are not secrets exactly, but they are not
 * the contractor's business either, and a 4,000-character system prompt in a
 * JSON response is a payload nobody reads. Only the shape of the answer travels
 * — the reasons carry everything a person needs.
 */
function redact(o) {
  return {
    e164: o.number.e164,
    publicNumber: o.number.publicNumber,
    source: o.number.source,
    status: o.number.status,
    webhookUrl: o.agent.webhookUrl,
    expectedWebhookUrl: o.expectedWebhookUrl,
    originIsStable: o.originIsStable ?? null,
    balanceCents: o.company.cents,
  };
}
