// lib/voice/recording.js
//
// Who may hear a customer's phone call, and how the audio is reached.
//
// ── The recording URL is a BEARER TOKEN, and it does not look like one ─────
//
// `VoiceCall.recordingUrl` is whatever Retell put in `recording_url`. Nothing
// in this codebase signs it, proxies it, scopes it to a tenant or expires it —
// an earlier audit established that, and it has not changed. Anyone holding
// the string can play a homeowner describing their kitchen, their address and
// their phone number, with no session and no account.
//
// That makes it exactly the kind of value that must not be stored twice, must
// not be serialised into a JSON blob that travels, and must never be rendered
// on a client-facing surface — not the quote PDF, not the portal, not an email.
// A URL on a document is a URL in an inbox, and a quote gets forwarded.
//
// ── So the link is an ID, and the audio is a route ────────────────────────
//
// Everything that wants to "link the recording" links `callRecordingHref(id)`
// instead. That is a FieldQuo path with a call id in it: useless to anyone
// without a session, and safe to sit beside a quote, because the route below
// it re-derives the company from the signed-in member and streams the audio
// itself. The provider's URL never leaves the server.
//
// Quote.sourceCallId exists for the same reason: the Quote row holds the id of
// the call it was drafted from and never the URL, so even a client-facing route
// that spread the whole quote row could not leak the audio.

/**
 * Where a signed-in member can listen to one call.
 *
 * Relative on purpose — an absolute origin baked into a stored draft would be
 * wrong the moment the deployment moves, and this string is only ever used
 * inside /app.
 */
export function callRecordingHref(callId) {
  const id = String(callId ?? "").trim();
  return id ? `/api/voice/calls/${encodeURIComponent(id)}/recording` : null;
}

/**
 * The permission dial that governs hearing a call, and seeing who called.
 *
 * ── Why the client dial and not `user:manage` ──────────────────────────────
 *
 * Everything else under /api/voice and /api/settings/voice gates on
 * `user:manage`, because those routes BUY a number, change the agent's script
 * or spend credit. These two hand over a hundred callers' phone numbers, what
 * they said, and the recording of them saying it. That is not a billing
 * decision, it is the client book arriving by another door.
 *
 * `clientsProperties` at `full_view` is the dial that already draws exactly
 * this line. It is the level lib/permissions/enforce.js strips a lead's
 * `phone` below, and the level lib/permissions/nav.js hides the Clients row
 * below, for the reason stated there: a crew member gets the address of the
 * job they are driving to, not the company's customer list.
 *
 * It also keeps the person whose job this is. An Estimator (role `employee`,
 * so `user:manage` would refuse them) sits at clientsProperties full_edit and
 * is precisely who rings a missed call back. Gating on the coarse role would
 * have hidden the inbox from its main user to protect it from Crew.
 *
 * Declared here rather than in either route because both ask the same
 * question, and the second copy is the one that would stay open after the
 * first was tightened.
 */
export const CALL_AUDIO_LEVEL = ["clientsProperties", "full_view"];

/**
 * Is this something we are willing to fetch server-side?
 *
 * The URL arrives on a signature-verified webhook, so it is not attacker-
 * supplied in the ordinary sense — but the route below turns it into an
 * outbound request from our own network, and "the payload was signed" is a
 * weaker guarantee than "the scheme is https". Anything else is refused rather
 * than fetched.
 */
export function isFetchableRecording(url) {
  try {
    return new URL(String(url)).protocol === "https:";
  } catch {
    return false;
  }
}
