// lib/messaging/whatsappConnect.js
//
// The step that turns "a WhatsApp token we trust" into "a number the inbox
// answers" — shared by the two doors a token can come through:
//
//   app/api/settings/whatsapp/callback   Embedded Signup: a business token
//                                        minted from Meta's code.
//   app/api/settings/whatsapp/manual     a permanent system user token the
//                                        company's admin generated in Meta's
//                                        App Dashboard and pasted in, for the
//                                        months Access Verification keeps
//                                        Embedded Signup shut.
//
// ══ Why ONE finish rather than one per door ════════════════════════════════
//
// Because the part that decides whether the connection works is the same for
// both, and it is the part most easily got wrong: subscribe FieldQuo's app to
// the WABA (without it no webhook ever fires), read the number with the token
// about to be stored (so the stored token is proven to reach the stored
// number), and write the row in the ONE shape lib/messaging/whatsappSend.js
// and the webhook's tenant lookup both read. A second copy of that in the
// manual route is the copy that rots (AGENTS.md failure class 4) — and it
// would rot in the direction of a channel that sends and never receives.
//
// The two doors differ only in what they know going in. Embedded Signup's
// redirect variant learns the WABA from debug_token and has to DISCOVER the
// number; the manual path was TOLD the number and has to prove it is on that
// WABA. Both facts are settled against the same listing, below.
//
// ══ What this deliberately does not do ═════════════════════════════════════
//
// Verify the token. The callers do that, differently, before calling: the
// signup path trusts a token Meta just minted for it, the manual path reads
// the number, the account and the token's own identity first (see the manual
// route). What arrives here is a token a caller has decided to trust, and
// this step's job is to make it a working channel or say by name why not.

import { subscribeAppToWaba, listWhatsAppNumbers } from "@/lib/meta/whatsappConnect";
import { saveChannel } from "./channels";

/** The closed set for MessagingChannel.connectedVia. */
export const CONNECTED_VIA = Object.freeze(["embedded_signup", "manual"]);

/**
 * Subscribe, resolve the number, store the channel.
 *
 * @param {string}      companyId
 * @param {string|null} connectedByUserId
 * @param {string}      accessToken       plaintext; encrypted inside saveChannel
 *                                        and nowhere else
 * @param {string}      wabaId
 * @param {string|null} phoneNumberId     the manual path names it; the signup
 *                                        path passes null and takes the first
 *                                        number on the WABA
 * @param {string}      connectedVia      one of CONNECTED_VIA
 *
 * @returns {Promise<{ ok: true, channel: object, number: object }
 *                  | { ok: false, kind: string, message?: string }>}
 *
 * `kind` values, every one of which the panel has a sentence for:
 *   "no_webhook"          the subscription failed — the connect FAILS, no
 *                         row is written (a number that cannot receive is
 *                         worse than none)
 *   "no_number"           the WABA has no phone number on it
 *   "number_not_on_waba"  the manual path named a number the WABA does not
 *                         list — a typo, or the id of a number under a
 *                         different account
 *   anything else         classifyMetaError's kind from the listing call
 */
export async function finishWhatsAppConnection({
  companyId,
  connectedByUserId,
  accessToken,
  wabaId,
  phoneNumberId = null,
  connectedVia,
}) {
  if (!companyId || !accessToken || !wabaId) {
    throw new Error("finishWhatsAppConnection: companyId, accessToken and wabaId are required.");
  }
  if (!CONNECTED_VIA.includes(connectedVia)) {
    // Thrown, not stored as null: a caller that does not say which door it is
    // has a bug, and a null here would read as "written before the column
    // existed", which is a different fact.
    throw new Error(`finishWhatsAppConnection: unknown connectedVia ${String(connectedVia)}`);
  }

  // The call whose failure FAILS the connect. Everything else about a
  // connection without it looks perfect — the token works, the send works —
  // and not one inbound message ever arrives. A channel row written past
  // this would be a control that appears to work and doesn't.
  const subscribed = await subscribeAppToWaba({ accessToken, wabaId });
  if (!subscribed.ok) return { ok: false, kind: "no_webhook", message: subscribed.message };

  // Read with the token about to be stored, so a success here also proves
  // that token can see the number about to be recorded beside it.
  const numbers = await listWhatsAppNumbers({ accessToken, wabaId });
  if (!numbers.ok) return { ok: false, kind: numbers.kind, message: numbers.message };
  const list = Array.isArray(numbers.data?.data) ? numbers.data.data : [];
  const number = phoneNumberId
    ? list.find((n) => typeof n?.id === "string" && n.id === phoneNumberId)
    : list.find((n) => typeof n?.id === "string" && n.id);
  if (!number) {
    return { ok: false, kind: phoneNumberId ? "number_not_on_waba" : "no_number" };
  }

  const channel = await saveChannel({
    companyId,
    platform: "whatsapp",
    // The PHONE NUMBER ID, which is both the tenant key the webhook resolves
    // on and the path the send posts to. See the schema comment on
    // MessagingChannel.externalId for why there is no second column holding
    // the same value.
    externalId: number.id,
    // What the contractor calls it. The verified name where Meta gave one,
    // the printed number otherwise, and never a fabricated label: a channel
    // called "WhatsApp" tells a company with two numbers nothing.
    name: number.verified_name || number.display_phone_number || null,
    accessToken,
    // Deliberately not stamped. Neither door tells us an expiry we can trust:
    // Embedded Signup's business token carries none we were told about, and a
    // system user token never expires on its own but dies when the system
    // user is removed. "We were not told" and "it expires on this date" are
    // different answers — the schema's own note on tokenExpiresAt.
    tokenExpiresAt: null,
    connectedByUserId: connectedByUserId || null,
    wabaId,
    displayPhoneNumber: number.display_phone_number || null,
    verifiedName: number.verified_name || null,
    connectedVia,
  });

  return { ok: true, channel, number };
}
