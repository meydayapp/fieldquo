// lib/messaging/whatsappSignup.js
//
// Building the Embedded Signup URL, and knowing whether one can be built.
//
// ══ Why not lib/meta/client.js's buildAuthorizeUrl ═════════════════════════
//
// Because Embedded Signup is not a plain OAuth dialog. It is Facebook Login
// for Business, and it needs two parameters the ads dialog has never sent:
//
//   config_id                     the Embedded Signup CONFIGURATION created in
//                                 the App Dashboard. It — not the `scope`
//                                 parameter — is what decides which
//                                 permissions and which WhatsApp onboarding
//                                 steps the business is walked through.
//   override_default_response_type  without it Meta returns a token in the
//                                 fragment rather than a code in the query,
//                                 and a fragment never reaches the server.
//
// Passing those through buildAuthorizeUrl would mean adding two optional
// parameters to the function every OTHER Meta flow calls, for a dialog none of
// them opens. The ads consent screen is the thing this codebase most carefully
// does not widen (lib/meta/client.js's metaRequestedScope header), and the
// cheapest way to keep that true is to not touch the function that builds it.
//
// `scope` is still sent, and still exactly META_WHATSAPP_SCOPE. Meta takes the
// configuration as authoritative, but a scope string that disagreed with the
// configuration would be a second, silent answer to "what are we asking for" —
// and the one a reader would find first.

import { GRAPH_API_VERSION, META_WHATSAPP_SCOPE, metaAppConfigured } from "@/lib/meta/client";

/**
 * Is there an Embedded Signup configuration to send people to?
 *
 * Separate from metaAppConfigured() because it fails separately and it is the
 * one a deployment is most likely to be missing: the app credentials are
 * shared with four other Meta features, and this id is created once, by hand,
 * in the App Dashboard's WhatsApp → Embedded Signup section.
 */
export function whatsAppSignupConfigured() {
  return Boolean(metaAppConfigured() && process.env.META_WHATSAPP_CONFIG_ID);
}

/**
 * The URL that opens Embedded Signup.
 *
 * @param redirectUri  must match one of the app's Valid OAuth Redirect URIs
 * @param state        the CSRF value, echoed back on the callback
 * @returns the URL, or null when this deployment has nothing to build one from
 *          — null rather than a URL missing its config_id, which would open a
 *          dialog that errors on Meta's side with a message the contractor
 *          cannot act on.
 */
export function buildWhatsAppSignupUrl({ redirectUri, state }) {
  if (!whatsAppSignupConfigured()) return null;
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    config_id: process.env.META_WHATSAPP_CONFIG_ID,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    override_default_response_type: "true",
    scope: META_WHATSAPP_SCOPE,
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}
