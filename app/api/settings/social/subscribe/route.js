// app/api/settings/social/subscribe/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaFullyConfigured } from "@/lib/meta/client";
import {
  getPageConnection,
  getDecryptedPageToken,
  recordWebhookSubscription,
} from "@/lib/meta/pageConnection";
import { subscribePageWebhook, missingWebhookPermissions } from "@/lib/meta/pageConnect";
import { savePageMessagingChannels } from "@/lib/messaging/pageChannels";

/**
 * Retry the webhook subscription on a Page that is already connected — and
 * create the inbox channels that subscription earns.
 *
 * ── Also the backfill, deliberately the SAME route ────────────────────────
 *
 * A Page connected before lib/messaging/pageChannels.js existed has a working
 * publishing connection, a granted messaging scope, a live subscription — and
 * no MessagingChannel row, so every message Meta delivers is answered
 * `unknown_page`. The fix is exactly what this route already does plus the
 * write that was missing, so it is this route rather than a second one:
 * "connect the inbox" and "subscribe again" are one action with two names, and
 * two endpoints doing it would be the copy that rots.
 *
 * The alternative — backfilling lazily inside GET /status — was rejected
 * because that route is reachable by a superadmin under an impersonation
 * cookie, and non-negotiable #3 is that the platform console views everything
 * and edits nothing. A read that writes a row into a customer's tenant breaks
 * that whatever guard is bolted on afterwards.
 *
 * ── Why this route exists at all ──────────────────────────────────────────
 *
 * Because the alternative is a panel that reports "we could not subscribe this
 * Page" with no way forward except disconnecting and re-running the whole
 * OAuth round trip — for a failure that is usually Meta being rate-limited for
 * five minutes. The connection is fine; one call failed; the fix is that call
 * again. Offering the retry is what makes the honest failure state actionable
 * rather than a dead end (AGENTS.md's first rule cuts both ways: a state that
 * tells the truth and offers nothing is only half of it).
 *
 * POST, not GET: it changes stored data and makes a call to Meta.
 *
 * The Page and the token come from the STORED connection, never from the
 * request body — a pageId a caller could name is a pageId a caller could name
 * belonging to somebody else's tenant.
 */
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  if (!metaFullyConfigured()) {
    return NextResponse.json(
      { error: "This deployment isn't set up for Meta connections." },
      { status: 409 },
    );
  }

  const connection = await getPageConnection(member.companyId);
  if (!connection) {
    return NextResponse.json({ error: "No Facebook Page is connected." }, { status: 404 });
  }

  let pageToken = null;
  try {
    pageToken = getDecryptedPageToken(connection);
  } catch {
    pageToken = null;
  }
  if (!pageToken) {
    // A live row with no readable token. Reconnecting is the only fix, and
    // saying so beats retrying a call that cannot authenticate.
    return NextResponse.json(
      { error: "The stored Page token can't be read. Reconnect the Page." },
      { status: 409 },
    );
  }

  // Refused rather than attempted when the permissions were never granted.
  // Meta would answer with a permissions error, which the panel would show as
  // "Meta refused us" — true, and useless: the fix is a reconnect that grants
  // them, not another press of this button.
  const missing = missingWebhookPermissions(connection.scopes);
  if (missing.length) {
    return NextResponse.json(
      { error: `Meta hasn't granted the permissions this needs: ${missing.join(", ")}.`, missing },
      { status: 409 },
    );
  }

  const webhook = await subscribePageWebhook({
    pageToken,
    pageId: connection.pageId,
    grantedScopes: connection.scopes,
  });
  await recordWebhookSubscription(member.companyId, connection.pageId, webhook);

  if (!webhook.webhookSubscribedAt) {
    console.error(
      `[social-subscribe] company=${member.companyId} page=${connection.pageId} retry failed: ${webhook.webhookSubscribeError}`,
    );
    // 502, because the failure is Meta's answer and not this request's shape.
    // The panel reloads its status either way and re-reads the stored state,
    // so the screen and the database cannot disagree about what happened.
    return NextResponse.json(
      {
        subscribed: false,
        // A message, not a bare status: fetchJson falls back to "Something
        // went wrong on our end" for a 5xx with no `error`, which points a
        // contractor at FieldQuo for a refusal that came from Meta.
        error: "Meta refused the subscription again. Wait a few minutes and retry, or reconnect the Page.",
      },
      { status: 502 },
    );
  }

  // Only now, on a subscription Meta CONFIRMED. The gate lives inside
  // savePageMessagingChannels as well — this is the caller-side half of the
  // same rule, and both are cheap.
  let inbox = { facebook: false, instagram: false };
  try {
    inbox = await savePageMessagingChannels({
      companyId: member.companyId,
      pageId: connection.pageId,
      pageName: connection.pageName,
      pageToken,
      instagramUserId: connection.instagramUserId,
      instagramUsername: connection.instagramUsername,
      grantedScopes: connection.scopes,
      webhookSubscribedAt: webhook.webhookSubscribedAt,
      connectedByUserId: member.userId,
    });
  } catch (err) {
    console.error(
      `[social-subscribe] company=${member.companyId} page=${connection.pageId} inbox channels: ${err?.message}`,
    );
    // The subscription DID happen and is recorded; saying otherwise would send
    // them to re-run a call that worked. What did not happen is the inbox, and
    // the panel re-reads status either way — so it will still offer the press.
    return NextResponse.json(
      {
        subscribed: true,
        inbox,
        error: "Meta is sending this Page's messages now, but the inbox couldn't be set up. Try again in a moment.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ subscribed: true, inbox });
}
