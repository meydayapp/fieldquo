// lib/voice/retell.js
//
// The only file that talks to Retell.
//
// Same rule as lib/ai/provider.js: one boundary with the vendor, so swapping to
// Vapi or raw Twilio later is one file rather than a search across the app, and
// so every call is logged and rate-limit-aware in one place.
//
// ── The key ────────────────────────────────────────────────────────────────
//
// RETELL_API_KEY is set in Vercel by the owner. It is never read anywhere else,
// never sent to a browser, and never logged — `redact()` below exists because
// the natural thing to do when a request fails is print the request.
//
// Absent, every call throws a clear, catchable error rather than a TypeError
// three frames deep. Local development has no key, so "not configured" is a
// normal state the UI has to handle, not an exception.
export const RETELL_BASE = "https://api.retellai.com";

/** Configured? Callers use this to show "set up voice" instead of an error. */
export function voiceConfigured() {
  return Boolean(process.env.RETELL_API_KEY);
}

class RetellError extends Error {
  constructor(message, { status, body, endpoint } = {}) {
    super(message);
    this.name = "RetellError";
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}
export { RetellError };

/**
 * Anything that could carry a secret, removed.
 *
 * Called on every payload before it can reach a log. Importing a number means
 * POSTing SIP trunk credentials, and those would otherwise sit in plaintext in
 * a Vercel log line the first time a port fails.
 */
function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (/password|secret|token|auth|key/i.test(k)) out[k] = "[redacted]";
    else if (v && typeof v === "object") out[k] = redact(v);
    else out[k] = v;
  }
  return out;
}

/**
 * One request.
 *
 * @throws RetellError — always, on any non-2xx. Callers get a message they can
 *         show and a status they can branch on; nobody has to inspect a Response.
 */
async function call(endpoint, { method = "POST", body, timeoutMs = 15000 } = {}) {
  const key = process.env.RETELL_API_KEY;
  if (!key) {
    throw new RetellError(
      "The phone agent isn't set up yet — no Retell API key is configured.",
      { status: 0, endpoint },
    );
  }

  // A hung provider must not hold a request open until the platform kills it.
  // 15s is well past a healthy call and well short of a Vercel timeout.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${RETELL_BASE}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new RetellError("The phone provider didn't respond in time.", {
        status: 504,
        endpoint,
      });
    }
    throw new RetellError(`Couldn't reach the phone provider: ${err.message}`, {
      status: 0,
      endpoint,
    });
  }
  clearTimeout(timer);

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body is itself the diagnostic — kept as text below */
  }

  if (!res.ok) {
    const message =
      parsed?.error_message || parsed?.message || `Phone provider error (${res.status})`;
    console.error("[retell] request failed", {
      endpoint,
      status: res.status,
      // Redacted, and the REQUEST is logged rather than the key — see redact().
      sent: redact(body),
      got: parsed ? redact(parsed) : text?.slice(0, 400),
    });
    throw new RetellError(message, { status: res.status, body: parsed, endpoint });
  }

  return parsed;
}

/* ─────────────────────────────── numbers ───────────────────────────────── */

/**
 * A number's agent, in the shape the API takes now.
 *
 * Retell deprecated the scalar routing fields — `inbound_agent_id`,
 * `outbound_agent_id` and their `_version` twins — on 31 March 2026, replacing
 * all four with weighted LISTS. Past that date the old name is a hard 400:
 *
 *     Deprecated API usage is no longer supported: Phone number single-agent
 *     fields. Fields: inbound_agent_id.
 *
 * which is exactly what "add a number" started returning in production. Retell
 * migrated the stored data itself; it is the request bodies that had to change.
 *
 * We route to one agent, so the list is one entry at weight 1 — Retell's
 * guidance is that the weights in a list sum to 1, and for a single agent that
 * is the whole of it.
 *
 * `agentId` null/undefined produces an EMPTY LIST, and that is deliberate:
 * detaching is how the "Answer my calls" switch turns the phone off at the
 * provider (see syncNumberAttachment). Omitting the key instead would leave the
 * previous agent attached and make the switch a dead control.
 *
 * ── Why no agent_version ───────────────────────────────────────────────────
 *
 * `agent_version` is optional here (the schema requires `agent_id` and `weight`
 * only) and we deliberately don't send one. Retell's reference says a version
 * reference "supports a numeric version (for example 3) or a tag/environment
 * name", that "latest" means the most recently CREATED version and
 * "latest_published" the most recently published one — and that with no
 * reference passed you get the latest version.
 *
 * Unbound is what we want, because we never publish: update-agent edits "the
 * latest draft version", so the newest version is always the one provisionAgent
 * just wrote, and a contractor's greeting edit reaches the phone. Pinning a
 * number to the number we happened to see at buy time would freeze it there
 * forever. The day anyone starts publishing versions — from the dashboard or
 * from here — this has to become explicit: pass `{ version: "latest_published" }`
 * and publish on every save, or live calls will run whichever version was
 * current when the number was bought.
 */
export function agentRouting(agentId, { version } = {}) {
  if (!agentId) return [];
  return [
    {
      agent_id: agentId,
      ...(version ? { agent_version: version } : {}),
      // Required, and constrained to 0 < weight <= 1: Retell picks an agent per
      // call with probability proportional to its weight, and the weights in a
      // list must total 1. One agent takes the whole of it.
      weight: 1,
    },
  ];
}

/**
 * Which agent a number is actually bound to, from a provider response — or null.
 *
 * Reading the list back is the only way to know an attach or a detach took, and
 * the detach shape is the one thing the reference doesn't document. See
 * syncNumberAttachment.
 */
export function boundAgentId(numberResponse) {
  const list = numberResponse?.inbound_agents;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[0]?.agent_id || null;
}

/**
 * Buy a number.
 *
 * `areaCode` is a hint, not a guarantee — the provider gives what it has. The
 * caller must show the number it actually got rather than the one that was
 * asked for; a contractor who requested 819 and silently received 437 will
 * print the wrong one on a van.
 *
 * ── `tollFree` was billed and never bought ─────────────────────────────────
 *
 * The settings screen sells a toll-free line at $9/month and a 5¢/minute
 * surcharge, and this function used to send neither `toll_free` nor anything
 * else that distinguished the two — so Retell returned a LOCAL number at its
 * default and the contractor paid the toll-free price for it. That is a customer
 * being overcharged for a product they didn't receive, which is worse than any
 * cost leak: the number they advertise as free-to-call isn't.
 *
 * ── `country` is not optional in practice ──────────────────────────────────
 *
 * Absent, Retell defaults to US, and `area_code` is documented as US-only. This
 * product ships fr-CA agents and Quebec area codes (514, 819) in its own
 * fixtures — asking for 514 against a US default is not a Canadian number, it's
 * whatever US pool happens to answer. Sent explicitly so the request says what
 * it means.
 */
// ── Where a FieldQuo number may dial ────────────────────────────────────────
//
// `allowed_outbound_country_list` is documented as defaulting to ALL COUNTRIES
// when empty, and we were sending it nowhere. Retell's own international rate
// card runs to $0.80/min for the Philippines, $0.45 Thailand, $0.40 Indonesia,
// $0.28 Japan — against the 35c/min this product charges. Every number we have
// ever created could be dialled at a loss of up to 55c a minute, by anyone who
// reached the outbound tool.
//
// Restricted to the countries FieldQuo actually sells into. Outbound only: the
// documented rates are outbound, and clamping INBOUND would drop a call from a
// client who happens to be abroad — a real homeowner, on a real job, whose
// number we would simply refuse.
//
// Widening this is a pricing decision, not a config tweak. lib/voice/credits.js
// prices one minute the same everywhere; any country added here needs a rate
// that covers it first.
const OUTBOUND_COUNTRIES = ["US", "CA"];

export function buyNumber({ areaCode, agentId, nickname, tollFree = false, country = "CA" }) {
  return call("/create-phone-number", {
    body: {
      ...(areaCode ? { area_code: Number(areaCode) } : {}),
      // Always sent, both ways. Sending it only when true would leave "local"
      // implicit, and an implicit value is what produced the mismatch above.
      toll_free: Boolean(tollFree),
      country_code: String(country || "CA").toUpperCase(),
      allowed_outbound_country_list: OUTBOUND_COUNTRIES,
      ...(agentId ? { inbound_agents: agentRouting(agentId) } : {}),
      ...(nickname ? { nickname } : {}),
    },
  });
}

/**
 * Connect a number the company already owns, over SIP. NOT porting.
 *
 * ── The label this carried was wrong, and it mattered ──────────────────────
 *
 * This said "the PORT path". It isn't one. Retell's /import-phone-number
 * attaches a number the contractor KEEPS at their own carrier, over an elastic
 * SIP trunk, and it takes minutes. Porting is a carrier-to-carrier transfer of
 * ownership that takes two to four weeks and which Retell's API does not do at
 * all — the docs describe no porting endpoint.
 *
 * Two different products behind one name, which is why the `ported` branch in
 * app/api/settings/voice/number/route.js writes a row and never calls this: a
 * port genuinely cannot be completed by an API call, so nothing here could have
 * helped it. The function works; it is simply wired to nothing.
 *
 * What it unlocks, when someone wires it up, is a third option the settings
 * screen doesn't offer: a contractor who already has a VoIP number connects it
 * instead of renting one from us. Needs their trunk credentials (Twilio elastic
 * SIP, Telnyx or Vonage), so it suits the minority who already run a VoIP
 * provider — not the one-van painter, who should forward.
 */
export function importNumber({
  e164,
  terminationUri,
  sipUsername,
  sipPassword,
  agentId,
  nickname,
}) {
  return call("/import-phone-number", {
    body: {
      phone_number: e164,
      termination_uri: terminationUri,
      ...(sipUsername ? { sip_trunk_auth_username: sipUsername } : {}),
      ...(sipPassword ? { sip_trunk_auth_password: sipPassword } : {}),
      allowed_outbound_country_list: OUTBOUND_COUNTRIES,
      ...(agentId ? { inbound_agents: agentRouting(agentId) } : {}),
      ...(nickname ? { nickname } : {}),
    },
  });
}

export function releaseNumber(e164) {
  return call(`/delete-phone-number/${encodeURIComponent(e164)}`, { method: "DELETE" });
}

/**
 * One number, as the provider currently has it.
 *
 * Exists to CHECK rather than to display: `inbound_agents` on the way back is
 * the only way to know whether an attach or a detach actually took. See
 * syncNumberAttachment.
 */
export function getNumber(e164) {
  return call(`/get-phone-number/${encodeURIComponent(e164)}`, { method: "GET" });
}

/**
 * Every number on the account.
 *
 * `/v2/` is not a typo and not a house style — Retell versions these paths one
 * at a time, and this is the only phone-number endpoint that carries a prefix
 * (create/get/update/delete/import are all unversioned). The v1 path this used
 * to call also returned a bare array; v2 returns { items, pagination_key,
 * has_more }, so callers must read `.items`.
 */
export function listNumbers({ limit, paginationKey } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  if (paginationKey) qs.set("pagination_key", paginationKey);
  const query = qs.toString();
  return call(`/v2/list-phone-numbers${query ? `?${query}` : ""}`, { method: "GET" });
}

/**
 * Point an existing number at a different agent — or at none.
 *
 * `agentId: null` DETACHES, and detaching is the on/off switch: a number with no
 * agent rings out, a number with one is answered. Sent as an explicit empty list
 * rather than by leaving the field out, because leaving it out is a no-op at the
 * provider and the contractor's "Answer my calls" toggle would stop working.
 *
 * The empty list is the one shape here the reference does NOT spell out — it
 * documents `nullable` arrays and says routing happens "if set and non-empty",
 * but never names a detach procedure. So the caller reads the number back and
 * checks, rather than trusting a 200. See syncNumberAttachment.
 */
export function attachAgent(e164, agentId) {
  return call(`/update-phone-number/${encodeURIComponent(e164)}`, {
    method: "PATCH",
    body: { inbound_agents: agentRouting(agentId) },
  });
}

/* ──────────────────────── response engines (Retell LLM) ────────────────── */

/**
 * The PROMPT half of an agent.
 *
 * Retell splits one conversational agent across two objects: this "Retell LLM"
 * owns `general_prompt`, `begin_message` and `general_tools`; the agent (below)
 * owns the voice, the language and the webhook, and points at this by id.
 *
 * We used to POST the prompt fields straight to /create-agent, which that
 * endpoint does not accept — so agent creation failed, numbers were bought with
 * no agent attached, and callers heard silence. See lib/voice/provision.js.
 *
 * @returns the created object; `.llm_id` is what the agent references.
 */
export function createRetellLlm(payload) {
  return call("/create-retell-llm", { body: payload });
}

export function updateRetellLlm(llmId, payload) {
  return call(`/update-retell-llm/${encodeURIComponent(llmId)}`, {
    method: "PATCH",
    body: payload,
  });
}

/* ─────────────────────────────── agents ────────────────────────────────── */

export function createAgent(payload) {
  return call("/create-agent", { body: payload });
}

export function updateAgent(agentId, payload) {
  return call(`/update-agent/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    body: payload,
  });
}

/* ──────────────────────────────── calls ────────────────────────────────── */

export function getCall(callId) {
  return call(`/v2/get-call/${encodeURIComponent(callId)}`, { method: "GET" });
}

/**
 * Place an outbound call.
 *
 * `fromE164` must be a number WE own at the provider — it's both the caller ID
 * the customer sees and, on the webhook, how we resolve which company placed
 * the call (an outbound call's `to_number` is the customer's, so it can't
 * identify the tenant).
 *
 * `dynamicVariables` are substituted into the outbound agent's template prompt
 * and opening line at dial time — this is how one standing agent runs a brief
 * specific to THIS customer and THIS quote without a per-call agent, and
 * without one call's details leaking into another's.
 *
 * @returns the provider's call object; `.call_id` is what the webhook keys on.
 */
export function createPhoneCall({ fromE164, toE164, agentId, dynamicVariables, metadata }) {
  return call("/v2/create-phone-call", {
    body: {
      from_number: fromE164,
      to_number: toE164,
      ...(agentId ? { override_agent_id: agentId } : {}),
      ...(dynamicVariables ? { retell_llm_dynamic_variables: dynamicVariables } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
}
