// app/api/settings/social/callback/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import {
  metaFullyConfigured,
  metaPagesConnectEnabled,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listPages,
  debugUserToken,
  classifyEmptyPageList,
} from "@/lib/meta/client";
import { resolveInstagram, resolveGrantedScopes, subscribePageWebhook } from "@/lib/meta/pageConnect";
import { savePageConnection, disconnectPageConnection } from "@/lib/meta/pageConnection";
import {
  savePageMessagingChannels,
  disconnectPageMessagingChannels,
} from "@/lib/messaging/pageChannels";
import { getAppOrigin } from "@/lib/appUrl";
import {
  PAGES_STATE_COOKIE,
  PAGES_PENDING_TOKEN_COOKIE,
  baseCookieOptions,
} from "@/lib/meta/oauthCookies";
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";

// Meta's redirect target for the PUBLISHING connect flow. Everything fails
// toward the settings screen, never a bare error page — same reasoning as
// app/api/meta-ads/callback: the person is staring at a tab that just came
// back from facebook.com, and the only useful place to land them is the screen
// they started on.
function toSettings(origin, params) {
  return NextResponse.redirect(`${origin}${SOCIAL_SETTINGS_PATH}?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deniedByUser = url.searchParams.get("error"); // Meta sets this if consent was declined

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(PAGES_STATE_COOKIE)?.value;
  cookieStore.delete(PAGES_STATE_COOKIE);

  if (deniedByUser) return toSettings(origin, { socialError: "denied" });
  if (!code || !state || !stateCookie) return toSettings(origin, { socialError: "bad_state" });

  const [cookieState, cookieCompanyId] = stateCookie.split(":");
  if (cookieState !== state) return toSettings(origin, { socialError: "bad_state" });

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  if (!member || !isBillingAdmin(member.role) || member.companyId !== cookieCompanyId) {
    return toSettings(origin, { socialError: "session" });
  }

  // Re-checked here and not only in /connect: the flag can be turned off
  // between the two legs, and a token granted under a permission this
  // deployment is no longer offering should not become a stored connection.
  if (!metaPagesConnectEnabled()) return toSettings(origin, { socialError: "awaiting_review" });
  if (!metaFullyConfigured()) return toSettings(origin, { socialError: "not_configured" });

  const redirectUri = `${origin}/api/settings/social/callback`;

  const shortLived = await exchangeCodeForToken({ code, redirectUri });
  if (!shortLived.ok) return toSettings(origin, { socialError: shortLived.kind });
  const shortToken = shortLived.data?.access_token;
  if (!shortToken) return toSettings(origin, { socialError: "unknown_error" });

  // The long-lived USER token matters here for a reason beyond its own 60-day
  // life: a PAGE token minted from a long-lived user token does not expire at
  // all (Meta's documented behaviour), while one minted from the short-lived
  // token inherits its ~1-2 hour window. Skipping this exchange would store a
  // credential that dies before the contractor's first scheduled post fires.
  const longLived = await exchangeForLongLivedToken({ shortLivedToken: shortToken });
  if (!longLived.ok) return toSettings(origin, { socialError: longLived.kind });
  const longToken = longLived.data?.access_token;
  if (!longToken) return toSettings(origin, { socialError: "unknown_error" });
  // longLived.data.expires_in (the USER token's ~60 days) is deliberately not
  // recorded anywhere: what gets stored is the PAGE token, which has its own
  // lifetime — none — and stamping the user token's date on it would make the
  // seam report token_expired on a connection that still works.

  const pagesRes = await listPages({ accessToken: longToken });
  if (!pagesRes.ok) return toSettings(origin, { socialError: pagesRes.kind });
  const pages = Array.isArray(pagesRes.data?.data) ? pagesRes.data.data : [];

  if (pages.length === 0) {
    // Not an error state to hide behind "something went wrong" — and not one
    // sentence for three different facts either. The owner, an admin of five
    // Pages, read "doesn't administer any Page" on every attempt; the truth
    // was that the dialog had granted pages_show_list with NO Page ticked.
    // debug_token says which it is; the screen says the matching fix.
    const debug = await debugUserToken({ accessToken: longToken }).catch(() => ({ ok: false }));
    const why = debug?.ok ? classifyEmptyPageList(debug.data) : "no_pages";
    return toSettings(origin, { socialError: why });
  }

  if (pages.length > 1) {
    // More than one Page: the USER token is held server-side in an httpOnly
    // cookie — never in the redirect URL — and /finalize re-reads the Page
    // list with it to get the chosen Page's own token. Page tokens are never
    // put in a cookie, not even briefly: there could be a dozen of them and
    // each one can post as that business.
    cookieStore.set(
      PAGES_PENDING_TOKEN_COOKIE,
      JSON.stringify({ token: longToken }),
      baseCookieOptions(),
    );
    const pickList = pages.map((p) => ({ id: p.id, name: p.name || p.id }));
    return toSettings(origin, { socialPickPage: JSON.stringify(pickList) });
  }

  const page = pages[0];
  const pageToken = page.access_token;
  if (!pageToken) return toSettings(origin, { socialError: "no_page_token" });

  const instagram = await resolveInstagram({ pageToken, pageId: page.id });
  const scopes = await resolveGrantedScopes(longToken);

  // The call that decides whether a message can ever reach the inbox. Run
  // BEFORE the row is written, with the PAGE token the edge requires, so the
  // connection is stored in the state it actually earned — there is no window
  // in which a row says "connected" while nothing has been asked of Meta.
  // Its outcome is stored, never swallowed: see lib/meta/pageConnect.js.
  const webhook = await subscribePageWebhook({ pageToken, pageId: page.id, grantedScopes: scopes });

  // One live Page per company today (see lib/meta/pageConnection.js): clear any
  // previous one in the same request so a reconnect to a DIFFERENT Page can
  // never leave two rows where getPageConnection has to pick. The inbox
  // channels are cleared with it and for the same reason — a channel for the
  // Page they just switched away from would keep filing that Page's customer
  // messages into an inbox nobody is watching. saveChannel's upsert revives the
  // row when the same Page is reconnected, so no history is lost either way.
  await disconnectPageConnection(member.companyId);
  await disconnectPageMessagingChannels(member.companyId);
  await savePageConnection({
    companyId: member.companyId,
    pageId: page.id,
    pageName: page.name || null,
    pageAccessToken: pageToken,
    instagramUserId: instagram.id,
    instagramUsername: instagram.username,
    // The PAGE token's own expiry, which is "none" when it came from a
    // long-lived user token. Deliberately not padded with the user token's
    // date: they are different credentials with different lifetimes, and
    // stamping a 60-day expiry on a token that has none would make the seam
    // report token_expired on a connection that still works.
    tokenExpiresAt: null,
    scopes,
    connectedByUserId: member.userId,
    ...webhook,
  });

  // The same connection, its other half: the MessagingChannel rows
  // lib/messaging/ingest.js resolves an inbound webhook against. Nothing is
  // written unless Meta both GRANTED the messaging permissions and CONFIRMED
  // the subscription — see lib/messaging/pageChannels.js. A failure here must
  // not lose the publishing connection that has already been stored, so it is
  // logged rather than thrown: the panel then shows the inbox as not connected
  // and offers the one-press retry, which is the honest state.
  try {
    await savePageMessagingChannels({
      companyId: member.companyId,
      pageId: page.id,
      pageName: page.name || null,
      pageToken,
      instagramUserId: instagram.id,
      instagramUsername: instagram.username,
      grantedScopes: scopes,
      webhookSubscribedAt: webhook.webhookSubscribedAt,
      connectedByUserId: member.userId,
    });
  } catch (err) {
    console.error(`[social-callback] company=${member.companyId} inbox channels: ${err?.message}`);
  }

  return toSettings(origin, { socialConnected: "1" });
}
