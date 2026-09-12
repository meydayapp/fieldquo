// lib/meta/whatsappConnect.js
//
// The three Graph calls that turn a completed Embedded Signup into a working
// WhatsApp channel.
//
// ══ What Embedded Signup hands back, and what it does NOT ══════════════════
//
// developers.facebook.com/docs/whatsapp/embedded-signup (read 2026-09-08):
// the flow returns "the customer's WABA ID, business phone number ID, and an
// exchangeable token code", and the app must then complete server-to-server
// calls to exchange the code for a customer-scoped business token, subscribe
// to webhooks on the customer's WABA, and register the number for Cloud API
// use.
//
// So the browser's part of the flow ends with three values and NOTHING
// working. These are the calls that finish it:
//
//   1. GET  /oauth/access_token           code -> business token
//   2. POST /<waba-id>/subscribed_apps    without this, no webhook ever fires
//   3. GET  /<waba-id>/phone_numbers      the display number and verified name
//
// Step 2 is the one most easily skipped, because everything else looks
// connected without it: the token works, the send works, and the inbox stays
// empty forever because no inbound message is ever delivered. It is therefore
// the one call here whose failure FAILS THE CONNECT rather than degrading it.
//
// ══ What is deliberately NOT done here ═════════════════════════════════════
//
// POST /<phone-number-id>/register with a PIN. Meta documents it as part of
// onboarding, and it is the step that moves a number onto the Cloud API — but
// it takes a six-digit two-step-verification PIN that belongs to the business
// and that FieldQuo has no business holding, and a number onboarded through
// Embedded Signup arrives already registered. Sending a made-up PIN would
// either fail or, worse, set one the contractor does not know. If a number
// turns out not to be registered, the send path says so by name
// (`number_not_registered`, error 133010) rather than this file guessing.

import { GRAPH_API_VERSION, classifyMetaError } from "./client";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Every call here returns the same shape as lib/meta/client.js's graphFetch —
 * `{ ok: true, data }` or `{ ok: false, kind, message }` — so a caller
 * handling one handles all of them, and a Meta failure reads the same here as
 * it does in the ads import.
 */
async function whatsappFetch(path, { accessToken, method = "GET", params = {} } = {}) {
  if (!accessToken) throw new Error("whatsappFetch: accessToken is required.");
  const url = new URL(`${GRAPH_BASE}${path}`);
  const search = new URLSearchParams(params);
  if (method === "GET") url.search = search.toString();

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        // The Cloud API takes a bearer header, not an access_token query
        // parameter. Same note as lib/messaging/whatsappSend.js: copying the
        // ads client's body field here is a 401 that reads like a dead token.
        Authorization: `Bearer ${accessToken}`,
        ...(method !== "GET" && { "Content-Type": "application/x-www-form-urlencoded" }),
      },
      ...(method !== "GET" && { body: search }),
    });
  } catch (err) {
    return { ok: false, kind: "network", message: `Could not reach Meta (${err?.message || "network error"}).` };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null; // A non-JSON body still needs classifying, not a throw.
  }

  if (!res.ok) {
    return { ok: false, ...classifyMetaError({ status: res.status, body, headers: res.headers }) };
  }
  return { ok: true, data: body };
}

/**
 * Embedded Signup's `code` -> a business token scoped to the customer's WABA.
 *
 * No `redirect_uri`. This is the one place the WhatsApp flow genuinely differs
 * from the OAuth exchange in lib/meta/client.js: the code comes from the
 * Embedded Signup JS SDK rather than from a redirect, so there is no URI to
 * match, and sending one is an error rather than a harmless extra.
 */
export async function exchangeWhatsAppCode({ code }) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID || "",
    client_secret: process.env.META_APP_SECRET || "",
    code,
  });

  let res;
  try {
    res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  } catch (err) {
    return { ok: false, kind: "network", message: `Could not reach Meta (${err?.message || "network error"}).` };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    return { ok: false, ...classifyMetaError({ status: res.status, body, headers: res.headers }) };
  }
  return { ok: true, data: body };
}

/**
 * Which WhatsApp Business Accounts did this token actually get granted?
 *
 * ── Why this is asked rather than assumed ──────────────────────────────────
 *
 * Embedded Signup's JavaScript variant posts the WABA id and phone number id
 * back to the opener window. The REDIRECT variant this codebase uses (a link,
 * not a popup — same trade lib/../settings/social/connect explains) returns
 * only a code, so the ids have to be discovered server-side.
 *
 * Meta's documented answer is `GET /debug_token`, whose response carries
 * `granular_scopes`: for each permission, the `target_ids` it was granted
 * OVER. For whatsapp_business_management that is the list of WABAs the
 * business ticked on the consent screen — which is the fact we want, and is
 * strictly better than inferring it: a business that owns four WABAs and
 * granted one must not have the other three touched.
 *
 * Verified with the APP token (`<app id>|<app secret>`), which is what
 * debug_token requires; the business token cannot inspect itself.
 */
export async function whatsAppAccountsForToken({ accessToken }) {
  const appToken = `${process.env.META_APP_ID || ""}|${process.env.META_APP_SECRET || ""}`;
  const res = await whatsappFetch("/debug_token", {
    accessToken: appToken,
    params: { input_token: accessToken },
  });
  if (!res.ok) return res;

  const granular = Array.isArray(res.data?.data?.granular_scopes)
    ? res.data.data.granular_scopes
    : [];
  const ids = new Set();
  for (const g of granular) {
    // Both permissions are granted over the same WABAs, and either one alone
    // is enough to name the account. Reading only `management` would miss a
    // business that granted messaging and declined management — which is a
    // connection that can send but cannot list templates, and is worth having.
    if (g?.scope !== "whatsapp_business_management" && g?.scope !== "whatsapp_business_messaging") {
      continue;
    }
    for (const id of Array.isArray(g.target_ids) ? g.target_ids : []) {
      if (typeof id === "string" && id) ids.add(id);
    }
  }
  return { ok: true, data: { wabaIds: [...ids] } };
}

/**
 * What a token IS — which app minted it, and which scopes it carries.
 *
 * ── For the pasted-credential path, and why it has to be asked ─────────────
 *
 * A company admin who cannot get through Embedded Signup can generate a
 * permanent system user token in Meta's App Dashboard and paste it in. Two
 * things about such a token are invisible from the token string itself and
 * decide whether the connection will WORK rather than merely store:
 *
 *   app_id   `POST /<waba-id>/subscribed_apps` subscribes the app THE TOKEN
 *            BELONGS TO. A token generated under some other Meta app would
 *            read the number, send a message, and route every inbound
 *            webhook to that other app's callback URL — a connection that
 *            looks perfect and receives nothing, the one shape this codebase
 *            is built to refuse. So the app id has to be FieldQuo's.
 *   scopes   Reading the number needs only whatsapp_business_management;
 *            sending needs whatsapp_business_messaging. A token that passed
 *            the read and lacked the second would fail on the first reply.
 *
 * `GET /debug_token` answers both, with the app token — the same call
 * whatsAppAccountsForToken makes, kept separate because it answers a
 * different question ("is this token usable at all") and the answer has a
 * different shape.
 */
export async function inspectWhatsAppToken({ accessToken }) {
  const appToken = `${process.env.META_APP_ID || ""}|${process.env.META_APP_SECRET || ""}`;
  const res = await whatsappFetch("/debug_token", {
    accessToken: appToken,
    params: { input_token: accessToken },
  });
  if (!res.ok) return res;
  const data = res.data?.data && typeof res.data.data === "object" ? res.data.data : {};
  return {
    ok: true,
    data: {
      appId: typeof data.app_id === "string" || typeof data.app_id === "number" ? String(data.app_id) : null,
      isValid: data.is_valid !== false,
      scopes: Array.isArray(data.scopes) ? data.scopes.filter((x) => typeof x === "string") : [],
      // Meta reports 0 for a token that never expires (a system user token),
      // and epoch seconds otherwise. Passed through as-is so the caller can
      // tell "never" from "not told" — see the schema note on tokenExpiresAt.
      expiresAt: typeof data.expires_at === "number" ? data.expires_at : null,
    },
  };
}

/**
 * The WhatsApp Business Account itself: its id and name.
 *
 * The second of the two reads that prove a pasted token before it is stored —
 * the number is one object and the account is another, and a token can be
 * granted over one without the other. Read with the token about to be
 * stored, never the app token, for the same reason listWhatsAppNumbers gives.
 */
export async function getWhatsAppBusinessAccount({ accessToken, wabaId }) {
  return whatsappFetch(`/${wabaId}`, { accessToken, params: { fields: "id,name" } });
}

/**
 * Subscribe THIS app to the customer's WABA, so `messages` webhooks fire.
 *
 * The call whose failure fails the connect. Without it a channel row exists,
 * the send path works, and not one inbound message ever arrives — a connection
 * that looks perfect and receives nothing, which is exactly the control that
 * appears to work and doesn't.
 */
export async function subscribeAppToWaba({ accessToken, wabaId }) {
  return whatsappFetch(`/${wabaId}/subscribed_apps`, { accessToken, method: "POST" });
}

/**
 * The numbers on a WABA: id, the number as Meta prints it, and the VERIFIED
 * business name a homeowner sees at the top of the chat.
 *
 * Read with the business token, so a success here also proves the token about
 * to be stored can see the number about to be recorded beside it — the same
 * property lib/meta/pageConnect.js's resolveInstagram relies on.
 */
export async function listWhatsAppNumbers({ accessToken, wabaId }) {
  return whatsappFetch(`/${wabaId}/phone_numbers`, {
    accessToken,
    params: { fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status" },
  });
}

/**
 * One number's own details, for the case where Embedded Signup named the
 * number but the WABA listing is refused (a permission the business un-ticked
 * on the consent screen).
 *
 * Best effort by contract: a connect that reaches here with a phone number id
 * and a working token has everything it NEEDS. What it loses is the display
 * number and the verified name, which are labels — and a label that could not
 * be read is stored as null, never as the phone number id dressed up as one.
 */
export async function getWhatsAppNumber({ accessToken, phoneNumberId }) {
  return whatsappFetch(`/${phoneNumberId}`, {
    accessToken,
    params: { fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status" },
  });
}
