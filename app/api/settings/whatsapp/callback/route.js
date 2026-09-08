// app/api/settings/whatsapp/callback/route.js
//
// Where Embedded Signup lands, and the four server-to-server calls that turn
// its `code` into a working channel.
//
//   1. code -> business token           lib/meta/whatsappConnect.js
//   2. which WABAs was it granted over? (debug_token granular_scopes)
//   3. subscribe this app to that WABA  ← the one whose failure fails the
//                                         connect; without it no inbound
//                                         message is ever delivered
//   4. read the number's display form and verified name
//
// Everything fails toward the settings screen, never a bare error page: the
// person is staring at a tab that just came back from facebook.com, and the
// only useful place to land them is the screen they started on.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { metaFullyConfigured, metaWhatsAppEnabled } from "@/lib/meta/client";
import {
  exchangeWhatsAppCode,
  whatsAppAccountsForToken,
  subscribeAppToWaba,
  listWhatsAppNumbers,
} from "@/lib/meta/whatsappConnect";
import { saveChannel } from "@/lib/messaging/channels";
import { getAppOrigin } from "@/lib/appUrl";
import { WHATSAPP_STATE_COOKIE } from "@/lib/meta/oauthCookies";
import { WHATSAPP_SETTINGS_PATH } from "@/lib/messaging/whatsappSettingsPath";

function toSettings(origin, params) {
  return NextResponse.redirect(`${origin}${WHATSAPP_SETTINGS_PATH}?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deniedByUser = url.searchParams.get("error");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(WHATSAPP_STATE_COOKIE)?.value;
  cookieStore.delete(WHATSAPP_STATE_COOKIE);

  if (deniedByUser) return toSettings(origin, { whatsappError: "denied" });
  if (!code || !state || !stateCookie) return toSettings(origin, { whatsappError: "bad_state" });

  const [cookieState, cookieCompanyId] = stateCookie.split(":");
  if (cookieState !== state) return toSettings(origin, { whatsappError: "bad_state" });

  // Through the guard, not getCurrentMember — this route is under a prefix
  // `whatsapp_messaging` claims in lib/features/registry.js, so a company the
  // feature is withheld from must be refused here too and not only on the
  // panel. The refusal itself is swallowed into a settings redirect below
  // rather than returned: a JSON 404 is the right answer to a fetch and the
  // wrong one to a browser coming back from facebook.com.
  const { member, response } = await memberOrRefusal(request);
  // The refusal is TESTED and answered — with a redirect rather than by
  // returning it. `response` is a JSON 401/402/403/404, which is the right
  // answer to a fetch and the wrong one to a browser arriving from
  // facebook.com; landing them on the settings screen with a reason is the
  // same trade /api/settings/social/callback makes.
  if (response) return toSettings(origin, { whatsappError: "session" });
  if (!member || !isBillingAdmin(member.role) || member.companyId !== cookieCompanyId) {
    return toSettings(origin, { whatsappError: "session" });
  }

  // Re-checked here and not only in /connect: the flag can be turned off
  // between the two legs, and a token granted under a permission this
  // deployment no longer offers must not become a stored connection.
  if (!metaWhatsAppEnabled()) return toSettings(origin, { whatsappError: "awaiting_review" });
  if (!metaFullyConfigured()) return toSettings(origin, { whatsappError: "not_configured" });

  const exchanged = await exchangeWhatsAppCode({ code });
  if (!exchanged.ok) return toSettings(origin, { whatsappError: exchanged.kind });
  const businessToken = exchanged.data?.access_token;
  if (!businessToken) return toSettings(origin, { whatsappError: "unknown_error" });

  const accounts = await whatsAppAccountsForToken({ accessToken: businessToken });
  if (!accounts.ok) return toSettings(origin, { whatsappError: accounts.kind });
  const wabaIds = accounts.data?.wabaIds || [];
  if (!wabaIds.length) {
    // Not an error to hide behind "something went wrong": the person finished
    // the flow without granting FieldQuo any WhatsApp Business Account. The
    // fix is on Meta's side and the panel says so.
    return toSettings(origin, { whatsappError: "no_waba" });
  }

  // ── One WABA per connect, and the first one ─────────────────────────────
  //
  // A contractor with several WhatsApp Business Accounts is not a case this
  // build handles, and it says so rather than picking silently: the second and
  // subsequent ids are ignored and nothing about them is stored. The Page flow
  // offers a chooser because a painter with two Pages is ordinary; a small
  // contractor with two WABAs is not, and a chooser nobody would ever see is a
  // screen that rots. Running the flow again after granting a different
  // account connects that one.
  const wabaId = wabaIds[0];

  // The call whose failure FAILS the connect. Everything else about a
  // connection without it looks perfect — the token works, the send works —
  // and not one inbound message ever arrives. A channel row written here would
  // be a control that appears to work and doesn't.
  const subscribed = await subscribeAppToWaba({ accessToken: businessToken, wabaId });
  if (!subscribed.ok) return toSettings(origin, { whatsappError: "no_webhook" });

  const numbers = await listWhatsAppNumbers({ accessToken: businessToken, wabaId });
  if (!numbers.ok) return toSettings(origin, { whatsappError: numbers.kind });
  const list = Array.isArray(numbers.data?.data) ? numbers.data.data : [];
  const number = list.find((n) => typeof n?.id === "string" && n.id);
  if (!number) return toSettings(origin, { whatsappError: "no_number" });

  try {
    await saveChannel({
      companyId: member.companyId,
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
      accessToken: businessToken,
      // Deliberately not stamped. Meta's business tokens from Embedded Signup
      // do not carry an expiry we were told about, and "we were not told" and
      // "it expires on this date" are different answers — padding the first
      // into a far-future date would hide a dead connection (the schema's own
      // note on tokenExpiresAt).
      tokenExpiresAt: null,
      connectedByUserId: member.userId || null,
      wabaId,
      displayPhoneNumber: number.display_phone_number || null,
      verifiedName: number.verified_name || null,
    });
  } catch (err) {
    console.error("[whatsapp-callback] failed to store channel:", err?.message);
    return toSettings(origin, { whatsappError: "unknown_error" });
  }

  return toSettings(origin, { whatsappConnected: "1" });
}
