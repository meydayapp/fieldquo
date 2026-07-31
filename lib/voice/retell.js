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
 * Buy a number.
 *
 * `areaCode` is a hint, not a guarantee — the provider gives what it has. The
 * caller must show the number it actually got rather than the one that was
 * asked for; a contractor who requested 819 and silently received 437 will
 * print the wrong one on a van.
 */
export function buyNumber({ areaCode, agentId, nickname }) {
  return call("/create-phone-number", {
    body: {
      ...(areaCode ? { area_code: Number(areaCode) } : {}),
      ...(agentId ? { inbound_agent_id: agentId } : {}),
      ...(nickname ? { nickname } : {}),
    },
  });
}

/**
 * Bring a number the company already owns, over SIP.
 *
 * This is the PORT path, and it needs their carrier's trunk details. Most
 * companies should forward instead — see lib/voice/numbers.js for why.
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
      ...(agentId ? { inbound_agent_id: agentId } : {}),
      ...(nickname ? { nickname } : {}),
    },
  });
}

export function releaseNumber(e164) {
  return call(`/delete-phone-number/${encodeURIComponent(e164)}`, { method: "DELETE" });
}

export function listNumbers() {
  return call("/list-phone-numbers", { method: "GET" });
}

/** Point an existing number at a different agent. */
export function attachAgent(e164, agentId) {
  return call(`/update-phone-number/${encodeURIComponent(e164)}`, {
    method: "PATCH",
    body: { inbound_agent_id: agentId },
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
