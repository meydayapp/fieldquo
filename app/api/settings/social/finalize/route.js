// app/api/settings/social/finalize/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { listPages, debugUserToken, grantedPageIds, fetchPagesByIds } from "@/lib/meta/client";
import { resolveInstagram, resolveGrantedScopes, subscribePageWebhook } from "@/lib/meta/pageConnect";
import { savePageConnection, disconnectPageConnection } from "@/lib/meta/pageConnection";
import {
  savePageMessagingChannels,
  disconnectPageMessagingChannels,
} from "@/lib/messaging/pageChannels";
import { PAGES_PENDING_TOKEN_COOKIE } from "@/lib/meta/oauthCookies";

// The second half of a multi-Page connect: the callback left the long-lived
// USER token in an httpOnly cookie and sent the browser back to the settings
// screen with a list of Pages. This is where a choice becomes a stored
// connection — the token never appears in a URL or in the page's own state.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const pageId = typeof body?.pageId === "string" ? body.pageId.trim() : "";
  if (!pageId) return NextResponse.json({ error: "pageId is required" }, { status: 400 });

  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(PAGES_PENDING_TOKEN_COOKIE)?.value;
  cookieStore.delete(PAGES_PENDING_TOKEN_COOKIE);
  if (!pendingRaw) {
    return NextResponse.json(
      { error: "That connection attempt expired — start over from \"Connect Facebook & Instagram\"." },
      { status: 409 },
    );
  }

  let pending;
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return NextResponse.json({ error: "That connection attempt is corrupted — start over." }, { status: 409 });
  }
  if (!pending?.token) {
    return NextResponse.json({ error: "That connection attempt expired — start over." }, { status: 409 });
  }

  // The Page list is re-read from Meta rather than trusted from the browser,
  // for two reasons at once: it is where the chosen Page's OWN access token
  // comes from (page tokens are never put in a cookie — see the callback), and
  // it re-proves that this person still administers the Page they are naming.
  // A pageId typed into this request that is not in Meta's answer connects
  // nothing.
  const pagesRes = await listPages({ accessToken: pending.token });
  if (!pagesRes.ok) {
    return NextResponse.json(
      { error: `Could not confirm that Page with Meta (${pagesRes.kind}).` },
      { status: 502 },
    );
  }
  let pages = Array.isArray(pagesRes.data?.data) ? pagesRes.data.data : [];
  if (!pages.some((p) => p?.id === pageId)) {
    // The list can omit a Page the grant names (business-portfolio Pages —
    // see fetchPagesByIds); the same fallback as the callback, so a Page
    // that was offered in the picker can also be chosen.
    const debug = await debugUserToken({ accessToken: pending.token }).catch(() => ({ ok: false }));
    const ids = debug?.ok ? grantedPageIds(debug.data).filter((id) => id === pageId) : [];
    if (ids.length) pages = pages.concat(await fetchPagesByIds({ accessToken: pending.token, pageIds: ids }));
  }
  const page = pages.find((p) => p?.id === pageId);
  if (!page) {
    return NextResponse.json({ error: "That Page is not one Meta lists for this login." }, { status: 400 });
  }
  if (!page.access_token) {
    return NextResponse.json({ error: "Meta returned no access token for that Page." }, { status: 502 });
  }

  const instagram = await resolveInstagram({ pageToken: page.access_token, pageId: page.id });
  const scopes = await resolveGrantedScopes(pending.token);

  // Identical to the callback's, and here rather than shared with it because
  // the two halves of a multi-Page connect end in different files by design —
  // what IS shared is subscribePageWebhook itself, which is the part that
  // could rot in a copy. Same rule: the PAGE token, before the write.
  const webhook = await subscribePageWebhook({
    pageToken: page.access_token,
    pageId: page.id,
    grantedScopes: scopes,
  });

  // Both halves cleared before the new Page is stored — the callback's own
  // note says why the inbox channels go with the connection.
  await disconnectPageConnection(member.companyId);
  await disconnectPageMessagingChannels(member.companyId);
  await savePageConnection({
    companyId: member.companyId,
    pageId: page.id,
    pageName: page.name || null,
    pageAccessToken: page.access_token,
    instagramUserId: instagram.id,
    instagramUsername: instagram.username,
    // Null for the same reason as the callback's: a page token minted from a
    // long-lived user token has no expiry of its own, and the USER token's
    // date belongs to a different credential.
    tokenExpiresAt: null,
    scopes,
    connectedByUserId: member.userId,
    ...webhook,
  });

  // Identical to the callback's, and here rather than shared with it for the
  // reason the webhook subscribe above gives: the two halves of a multi-Page
  // connect end in different files by design, and what IS shared is
  // savePageMessagingChannels itself — the part that could rot in a copy.
  let inbox = { facebook: false, instagram: false };
  try {
    inbox = await savePageMessagingChannels({
      companyId: member.companyId,
      pageId: page.id,
      pageName: page.name || null,
      pageToken: page.access_token,
      instagramUserId: instagram.id,
      instagramUsername: instagram.username,
      grantedScopes: scopes,
      webhookSubscribedAt: webhook.webhookSubscribedAt,
      connectedByUserId: member.userId,
    });
  } catch (err) {
    console.error(`[social-finalize] company=${member.companyId} inbox channels: ${err?.message}`);
  }

  return NextResponse.json({ success: true, inbox });
}
