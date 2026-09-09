// app/api/settings/social/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import {
  disconnectPageConnection,
  getPageConnection,
  getDecryptedPageToken,
} from "@/lib/meta/pageConnection";
import { unsubscribePageWebhook } from "@/lib/meta/pageConnect";
import { disconnectPageMessagingChannels } from "@/lib/messaging/pageChannels";

// Severing a company's Facebook/Instagram publishing connection — same weight
// and same gate as app/api/meta-ads/disconnect: the encrypted Page token
// leaves the database in this request, and scheduled posts that have not fired
// yet will find no connection when the cron reaches them (which they report,
// per-post, rather than failing silently — see the scheduled-publish cron).
//
// A POST even though /connect is a GET: this one changes stored data, and a
// GET that deletes a credential is the exact "irreversible action behind a
// link" shape a prefetch or a link-preview bot can trigger.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // ── Tell Meta to stop, BEFORE the token that could tell it is destroyed ──
  //
  // Order is the whole point. disconnectPageConnection() nulls
  // pageAccessTokenEnc, and the DELETE on /<page-id>/subscribed_apps needs
  // that token — do it the other way round and the subscription can never be
  // removed by anything FieldQuo holds. A subscription left standing is this
  // company's customer messages still being POSTed to us after they revoked
  // our access: not a tidy-up, a data-handling failure.
  //
  // Best effort in one direction only: a Meta refusal must never stop the
  // credential being destroyed, which is what a contractor pressing Disconnect
  // is actually asking for. But it is attempted, and its failure is RECORDED —
  // on the tombstone row for support, and in this response so the panel says
  // it rather than leaving them believing it stopped.
  const connection = await getPageConnection(member.companyId);
  let pageToken = null;
  try {
    pageToken = getDecryptedPageToken(connection);
  } catch {
    // A row whose ciphertext will not open (wrong key, corruption). The
    // disconnect still proceeds — it is the row we are tearing down — and the
    // unsubscribe reports that it had nothing to call with.
    pageToken = null;
  }
  const removed = await unsubscribePageWebhook({
    pageToken,
    pageId: connection?.pageId || null,
    wasSubscribed: Boolean(connection?.webhookSubscribedAt),
  });
  if (removed.error) {
    console.error(
      `[social-disconnect] company=${member.companyId} page=${connection?.pageId || "?"} unsubscribe failed: ${removed.error}`,
    );
  }

  await disconnectPageConnection(member.companyId, { webhookSubscribeError: removed.error });

  // ── The inbox half of the same connection ────────────────────────────────
  //
  // A MessagingChannel row is what lib/messaging/ingest.js resolves an inbound
  // webhook against, so leaving one live after a disconnect means this
  // company's customers keep being filed into FieldQuo after they revoked our
  // access — the same data-handling failure as an unremoved subscription, one
  // layer down, and the one that survives Meta refusing the DELETE above.
  // Stamped, never deleted (the WhatsApp disconnect's own note says why): the
  // conversations stay, and reconnecting revives the rows.
  const channelsDisconnected = await disconnectPageMessagingChannels(member.companyId);

  return NextResponse.json({
    success: true,
    // How many inboxes stopped, so the panel is never guessing. Zero is the
    // ordinary answer for a Page connected for publishing only.
    channelsDisconnected,
    // Three answers, not a boolean: true (Meta confirmed), false (Meta refused
    // and may keep delivering), null (there was no subscription to remove —
    // the ordinary case for a Page connected for publishing only).
    webhookUnsubscribed: removed.skipped ? null : removed.ok,
  });
}
