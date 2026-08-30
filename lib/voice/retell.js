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
 * ── `phoneNumber` asks for ONE number, and that is a different promise ─────
 *
 * The reference documents `phone_number` as "The number you are trying to
 * purchase in E.164 format", and `number_provider` as defaulting to twilio. So
 * a specific number can be named, and naming one is how the area-code hint
 * above stops being a hint: lib/voice/numberSearch.js searches Twilio's real
 * available inventory — the same pool Retell buys out of — and the contractor
 * picks a number that exists.
 *
 * This matters most where the hint is worthless. `area_code` is documented
 * "Currently only supports US area code", and this product sells into Quebec,
 * so for a Canadian company the hint has never done anything at all.
 *
 * The two are mutually exclusive by construction. Sending `area_code` alongside
 * a named number asks for a specific number AND a range, which is two requests
 * in one body — and whichever the provider honours, the other is a surprise.
 * `number_provider` is stated explicitly rather than left to its default for the
 * same reason `toll_free` is: the number was found in TWILIO's inventory, and a
 * Telnyx purchase of it would be a request for a number that provider has never
 * heard of. An implicit value is what produced the toll-free mismatch below.
 *
 * Still not a guarantee. The number can be sold in the seconds between the
 * search and the click, so the caller checks availability immediately before
 * spending anything and compares what came back against what it asked for.
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

export function buyNumber({
  areaCode,
  phoneNumber,
  agentId,
  nickname,
  tollFree = false,
  country = "CA",
}) {
  // A named number supersedes the range it came out of — see above. Normalised
  // here rather than trusted, so a caller passing "" or a stray display string
  // falls back to the hint instead of posting a `phone_number` the provider
  // will reject.
  // ── Toll-free has no area, and nothing to choose from ────────────────────
  //
  // Suppressed HERE and not only at the call site. The buy route already
  // discards both on a toll-free order, so this is belt-and-braces — but it is
  // the kind of belt that has already failed once in this exact function:
  // `toll_free` used to go unsent entirely, Retell returned a local number, and
  // a contractor paid the toll-free rate for it. A boundary that will assemble a
  // self-contradictory body on request is a boundary waiting for its second
  // caller. 800/833 numbers are not in an area code and are not what the picker
  // searches, so neither field can mean anything alongside one.
  const named =
    !tollFree && /^\+\d{8,15}$/.test(String(phoneNumber || "")) ? String(phoneNumber) : null;
  const hint = !tollFree && areaCode ? Number(areaCode) : null;

  return call("/create-phone-number", {
    body: {
      // A named number supersedes the range it came out of. Never both.
      ...(named
        ? { phone_number: named, number_provider: "twilio" }
        : hint
          ? { area_code: hint }
          : {}),
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
 * EVERY number on the account, following the pagination to the end.
 *
 * The single page above is not enough for the one job this endpoint has —
 * reconciling what Retell bills us for against what our tenants hold
 * (lib/voice/numberAudit.js). A reconciliation that reads the first page and
 * stops reports every number past the cut as unheld on one side and missing on
 * the other, which is worse than not reconciling at all.
 *
 * `pages` is a hard stop, not a preference: a provider that keeps returning
 * `has_more` with an unchanging cursor would otherwise spin until the platform
 * kills the request. Hitting it returns `complete: false`, and the caller has to
 * say so on screen rather than presenting a partial list as the whole account.
 */
export async function listAllNumbers({ pageSize = 200, pages = 20 } = {}) {
  const items = [];
  let paginationKey;
  let complete = true;

  for (let i = 0; i < pages; i += 1) {
    const page = await listNumbers({ limit: pageSize, paginationKey });
    const batch = Array.isArray(page?.items) ? page.items : [];
    items.push(...batch);

    const next = page?.pagination_key || null;
    // Both conditions, not either: `has_more` with no cursor is a page we
    // cannot ask for, and repeating the cursor we just used is a loop.
    if (!page?.has_more || !next || next === paginationKey) {
      complete = true;
      paginationKey = null;
      break;
    }
    paginationKey = next;
    complete = i < pages - 1;
  }

  return { items, complete };
}

/**
 * Point an existing number at a different agent — or at none.
 *
 * `agentId: null` DETACHES, and detaching is the on/off switch: a number with an
 * agent is answered, a number without one is not. Sent as an explicit empty list
 * rather than by leaving the field out, because leaving it out is a no-op at the
 * provider and the contractor's "Answer my calls" toggle would stop working.
 *
 * ── What the CALLER hears is not known, and used to be asserted ───────────
 *
 * Three files in this repository said "a number with no agent rings out". That
 * was never checked against anything. Retell's documentation does not state it,
 * and its own vocabulary leans the other way: every documented case of a call it
 * will not take is described as "disconnect" or "hangs up", never as ringing.
 * The one documented case of Retell holding a caller in a ringing state is a
 * pending inbound webhook, which requires `inbound_webhook_url` to be set.
 *
 * Checked, on 26/08/2026, against:
 *
 *   https://docs.retellai.com/deploy/inbound-call
 *   https://docs.retellai.com/features/inbound-call-webhook
 *   https://docs.retellai.com/reliability/debug-call-disconnect
 *
 * The disconnect-reason table has no entry that could cover an inbound call to
 * an unbound number at all, which is consistent with such a call never becoming
 * a call object. Retell's SIP edge is known to answer INVITEs it will not take
 * with `486 Rejected` — a caller hears "user busy" — but the one packet capture
 * showing that was on a number that WAS bound to an agent, so it does not settle
 * this either.
 *
 * The difference matters to the person paying for it: "busy" tells a homeowner
 * the contractor is on another call and to try again in a minute, and a
 * receptionist that is switched off is not busy. Settling it needs one live test
 * against a real number and a real key, which no CI job here can do. Until
 * somebody makes that call and listens, the app says what is true — the number
 * stops answering — and warns that we cannot promise a caller hears ringing.
 * See the auto top-up card and the "Answer my calls" card in
 * app/app/settings/voice/page.js.
 *
 * `fallback_number`, on this same endpoint, is NOT the lever it looks like. Its
 * documented trigger is exhausted inbound CONCURRENCY and nothing else — the
 * wording is identical in all five places it appears, and the concurrency page
 * spells out the whole algorithm. It does not fire for an unbound number. The
 * documented lever that does work regardless of binding is
 * `inbound_webhook_url`, which the reference says applies "whether or not the
 * number has an inbound agent set" and which can return an `override_agent_id`
 * per call. That is how a "we can't take calls right now" message would be
 * delivered without leaving an agent attached and billing. It is a product
 * decision — it costs a minute of talk time per call on FieldQuo's account for
 * companies that have run out of credit — and nobody has made it.
 *
 * ── The detach shape is the one thing the reference will not settle ───────
 *
 * Re-checked against the current reference and against the generated
 * `retell-sdk` types, which come from Retell's own OpenAPI spec:
 *
 *   https://docs.retellai.com/api-references/update-phone-number
 *
 * Both agree on two facts and refuse to join them up:
 *
 *   • the field is typed `Array<InboundAgent> | null`, so NULL is explicitly
 *     accepted — and `fallback_number` on the same endpoint documents "Set to
 *     null to remove", which is this API's stated idiom for removal;
 *   • the prose says routing applies "If set and non-empty", which implies an
 *     EMPTY ARRAY is a legal set-state meaning nobody answers.
 *
 * Nothing anywhere names a detach procedure, and the same page says "Total
 * weights must add up to 1" — which an empty array does not satisfy. So `[]`
 * being rejected by a validator is a live possibility, not a paranoid one, and
 * it cannot be settled without a key: there is no RETELL_API_KEY in local .env
 * and this has never run against the real API.
 *
 * So we do not pick. `[]` first because it is the shape the prose implies, and
 * `null` on rejection because it is the shape the type and the sibling field
 * imply. Costs one extra request only in the case where the first shape was
 * wrong — and getting this wrong is not cosmetic: a failed detach is a company
 * at zero credit that keeps answering calls on FieldQuo's account for free.
 * The caller still reads the number back and checks; see syncNumberAttachment.
 */
export async function attachAgent(e164, agentId) {
  const path = `/update-phone-number/${encodeURIComponent(e164)}`;
  const routing = agentRouting(agentId);

  // An ATTACH has exactly one documented shape. Only the detach is in doubt.
  if (routing.length > 0) {
    return call(path, { method: "PATCH", body: { inbound_agents: routing } });
  }

  try {
    return await call(path, { method: "PATCH", body: { inbound_agents: [] } });
  } catch (err) {
    // Only a REJECTION of the shape earns a retry. A 500, a timeout or an auth
    // failure means the provider never got as far as reading the body, and
    // retrying a different body would just be a second identical outage —
    // worse, it would report "detached" off whichever request happened to
    // return first. 422 is included: Retell validates weights, and a sum of 0
    // is the failure this whole branch exists for.
    const status = err instanceof RetellError ? err.status : null;
    if (status !== 400 && status !== 422) throw err;
    return call(path, { method: "PATCH", body: { inbound_agents: null } });
  }
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

/**
 * One agent, as the provider currently has it.
 *
 * Exists for the same reason getNumber does: to CHECK. `webhook_url` and
 * `response_engine.llm_id` are the two fields the whole feature hangs off, and
 * both are written by us and then never looked at again — a webhook URL left
 * pointing at a preview deployment posts every call event into the void, and
 * nothing in the app could see it. lib/voice/readiness.js reads it back.
 *
 * No `version` query: unpinned, matching agentRouting() — the version a call
 * resolves is the latest, which is the one we last wrote. Asking for a specific
 * version here would report on an object no call uses.
 */
export function getAgent(agentId) {
  return call(`/get-agent/${encodeURIComponent(agentId)}`, { method: "GET" });
}

/**
 * One response engine, as the provider currently has it.
 *
 * `general_prompt` on the way back is the only way to know the guardrails the
 * agent is actually running are the ones we last built. A push that failed
 * halfway leaves a live agent on an old prompt and a settings screen showing
 * the new one, and until this existed nothing could tell them apart.
 */
export function getRetellLlm(llmId) {
  return call(`/get-retell-llm/${encodeURIComponent(llmId)}`, { method: "GET" });
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
 * Calls the PROVIDER has, whether or not it ever told us about them.
 *
 * ── Why the meter cannot hang off the webhook alone ────────────────────────
 *
 * Every minute this product bills is billed from `call_ended`. If that delivery
 * stops — a rotated key, a preview URL left on the agent, a verifier bug, an
 * endpoint someone unsubscribed in a dashboard — the symptom is not an error.
 * It is a phone that works perfectly, calls that cost FieldQuo real money, and
 * balances that never move. That is exactly the state the owner's own account
 * was in. So there has to be a way to ASK, and this is it. See
 * lib/voice/reconcileCalls.js for what is done with the answer, and
 * lib/booking/reconcileBookingFee.js for the same conclusion reached about
 * Stripe: a webhook is a fast path, never the only path.
 *
 * ── /v3/, and what the docs actually say ───────────────────────────────────
 *
 * Retell versions these paths one at a time (see listNumbers, still on /v2/).
 *
 * CORRECTION, re-checked 25/08/2026. This comment used to assert that "the
 * legacy list endpoints were REMOVED on 15/06/2026 — `POST /v2/list-calls` is
 * gone, not merely deprecated". Neither half of that survives checking, and it
 * was written from memory:
 *
 *   • the legacy endpoint is `GET /list-calls`, UNVERSIONED. There is no
 *     `/v2/list-calls` and there does not appear ever to have been one — the
 *     SDK's generated client has no such path.
 *   • it is documented as DEPRECATED, not removed, and the page carries no
 *     sunset date at all:
 *     https://docs.retellai.com/api-references/list-calls_deprecated
 *
 * So v3 is right, but for the reason the docs give rather than the invented
 * one: "Use the v3 list-calls endpoint for new integrations", which "adds
 * cursor-based pagination, richer filters, and `include_total`".
 * https://docs.retellai.com/api-references/list-calls
 *
 * v3 also changed the filter shape: flat `after_start_timestamp` scalars
 * became TYPED filters, `{ type, op, value }`, keyed by field name under
 * `filter_criteria` — which is why the window below looks like it does rather
 * than like two dates.
 *
 * ── What v3 will NOT give you ──────────────────────────────────────────────
 *
 * No `transcript` and no `transcript_object`. The deprecation page says it
 * outright: fetch "detailed fields like transcripts and recordings separately"
 * via the single-call read. `call_analysis`, `recording_url` and `call_cost`
 * ARE on the list items; the words are not. See upsertCallRow in
 * lib/voice/reconcileCalls.js, which fetches them per rescued call.
 *
 * @param sinceMs / untilMs  epoch ms, inclusive window on start_timestamp
 * @returns { items, pagination_key, has_more, total? }
 */
export function listCalls({ sinceMs, untilMs, limit = 200, paginationKey } = {}) {
  const filter = {};
  if (Number.isFinite(sinceMs) && Number.isFinite(untilMs)) {
    // "bt" is between, and the value is a two-element [lower, upper] array.
    filter.start_timestamp = { type: "range", op: "bt", value: [sinceMs, untilMs] };
  }
  // Only calls that are OVER. An `ongoing` call has no final duration, and
  // billing a duration that is still moving is how a call gets charged twice at
  // two different lengths. `error` is included deliberately: a call that failed
  // may still have consumed provider minutes, and the reconciler decides what to
  // do with it from the duration rather than from the status.
  filter.call_status = { type: "enum", op: "in", value: ["ended", "error"] };

  return call("/v3/list-calls", {
    body: {
      filter_criteria: filter,
      sort_order: "descending",
      limit: Math.min(1000, Math.max(1, Number(limit) || 200)),
      ...(paginationKey ? { pagination_key: paginationKey } : {}),
    },
    // Larger window than a normal request: this runs from a cron, not from a
    // page, and a slow list is better than a run that bills nobody.
    timeoutMs: 30000,
  });
}

/* ──────────────────────────── the account itself ───────────────────────── */

/**
 * How much of the SHARED ceiling is in use right now.
 *
 * FieldQuo holds one Retell account and every tenant's calls draw on it. This
 * is the one thing about that pool Retell will actually tell us — there is no
 * balance or credit endpoint in the API at all, only the dashboard, which is
 * why lib/voice/pool.js has to DERIVE the money side and says so.
 *
 * `concurrency_limit` is the number of simultaneous calls the whole account may
 * have. Hit it and the next caller — anyone's caller — gets
 * `concurrency_limit_reached`, which no tenant can see and no tenant caused.
 *
 * @returns { current_concurrency, concurrency_limit, base_concurrency,
 *            purchased_concurrency, concurrency_burst_enabled, ... }
 */
/**
 * How much of the workspace's concurrent-call capacity is in use.
 *
 * ── Why a SaaS has to watch this and a single business does not ───────────
 *
 * Concurrency is a WORKSPACE limit, not a per-agent one: every contractor on
 * FieldQuo draws from the same pool, and Retell exposes no per-agent cap to
 * partition it with. So one busy contractor at nine on a Monday can exhaust
 * the capacity of everybody else's receptionist. Retell's documented behaviour
 * when the pool is full is that an inbound call waits about forty seconds and
 * then falls back or fails — which the caller experiences as a business that
 * does not answer its phone.
 *
 * The cost of NOT running out is trivial: $8 a slot a month, against a slot
 * that carries hundreds of dollars of billable minutes. See
 * lib/voice/platformEconomics.js, which does that arithmetic rather than
 * leaving it to be re-derived.
 *
 * https://docs.retellai.com/api-references/get-concurrency
 */
export function getConcurrency() {
  return call("/get-concurrency", { method: "GET" });
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
