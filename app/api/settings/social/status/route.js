// app/api/settings/social/status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import {
  metaAppConfigured,
  metaFullyConfigured,
  metaPagesConnectEnabled,
  META_PAGES_SCOPE,
} from "@/lib/meta/client";
import { getPageConnection, publicPageConnectionShape } from "@/lib/meta/pageConnection";
import { missingWebhookPermissions } from "@/lib/meta/pageConnect";
import { missingPageChannels } from "@/lib/messaging/pageChannels";

// What the Facebook/Instagram publishing panel needs to render ONE honest
// state and never a control that can't work:
//
//   1. awaiting Meta review  — metaPagesConnectEnabled() is false, which is
//                              every production deployment today. No Connect
//                              button at all; the panel says what is blocked.
//   2. not configured        — the flag is on but this deployment has no
//                              META_APP_ID/META_APP_SECRET, or no token
//                              encryption key
//   3. connected, not connected — a real Connect / Disconnect
//
// Gated exactly like app/api/meta-ads/status: isBillingAdmin, with the same
// impersonation carve-out on the READ only (non-negotiable #3 — the platform
// console views everything and edits nothing, and middleware already refuses
// every non-GET under an impersonation cookie, so this cannot become a write).
//
// The TOKEN is not in this response and cannot be: publicPageConnectionShape()
// is the only thing serialised, and it has no token field.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const connection = await getPageConnection(member.companyId);
  const shape = publicPageConnectionShape(connection);

  return NextResponse.json({
    connectEnabled: metaPagesConnectEnabled(),
    appConfigured: metaAppConfigured(),
    fullyConfigured: metaFullyConfigured(),
    connection: shape
      ? {
          ...shape,
          connectedByName: await connectorName(connection.connectedByUserId),
          // What Meta granted, minus what publishing needs — empty for a
          // healthy connection. A contractor who un-ticked one permission on
          // the consent screen has a connection that looks perfect and fails
          // at the moment they publish; this is what lets the panel say so
          // first. Null (Meta's permission read failed at connect time) is
          // reported as "we don't know", never as "all good": see
          // lib/meta/pageConnect.js.
          missingScopes: missingScopes(shape.scopes),
          // Which of the two permissions the webhook subscribe needs are not
          // granted — the reason the subscribe was never ATTEMPTED, which is
          // the state every Page connected on the publishing consent screen is
          // in today. Sent so the panel can say WHY messages will not arrive
          // instead of leaving a blank where a subscription would be; an empty
          // array means the permissions are there and any failure is Meta's.
          webhookMissingPermissions: missingWebhookPermissions(shape.scopes),
          // Which inboxes this grant allows that have no live MessagingChannel
          // row — non-empty only for a Page connected before the connect flow
          // created them, which is every Page connected up to today. The panel
          // turns this into a one-press "Connect the inbox" that POSTs
          // /api/settings/social/subscribe.
          //
          // A READ, and only a read. Backfilling here would be a GET that
          // writes into a customer's tenant, reachable under an impersonation
          // cookie — non-negotiable #3 forbids it, and "the button is right
          // there" is not a reason to break it.
          //
          // Empty for a company that never granted messaging, so the panel
          // draws nothing rather than a control that would refuse them.
          missingInboxChannels: await missingPageChannels({
            companyId: member.companyId,
            grantedScopes: shape.scopes,
            instagramUserId: shape.instagramUserId,
          }),
        }
      : null,
  });
}

/**
 * The name behind connectedByUserId, or null. A separate read rather than a
 * Prisma relation because MetaPageConnection stores the id as a plain column
 * (as MetaAdConnection does) — a deleted user must not take the connection row
 * with it.
 */
async function connectorName(userId) {
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
  return user?.name || null;
}

/**
 * Which of META_PAGES_SCOPE's permissions Meta did NOT grant.
 *
 * `null` in, `null` out — "we could not read the granted list" is a different
 * answer from "nothing is missing", and collapsing the two would print a green
 * tick over a connection nobody has verified (AGENTS.md failure class 5).
 */
function missingScopes(granted) {
  if (!granted) return null;
  const have = new Set(String(granted).split(",").map((s) => s.trim()).filter(Boolean));
  return META_PAGES_SCOPE.split(",").filter((s) => !have.has(s));
}
