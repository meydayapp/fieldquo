// lib/messaging/pageChannels.js
//
// The step that was missing between "a Facebook Page is connected" and "a
// message from a homeowner lands in the inbox".
//
// ══ The bug this file closes ═══════════════════════════════════════════════
//
// lib/messaging/ingest.js resolves an inbound webhook to a tenant with
// channelForExternalId(platform, entry.id) — a MessagingChannel lookup, and
// deliberately the ONLY thing that can name a company (a payload cannot). But
// saveChannel had exactly one caller, the WhatsApp callback, so nothing in the
// codebase had ever created a channel with platform `facebook` or `instagram`.
// A Page could be connected, its token stored, its webhook subscribed — and
// every inbound message answered `unknown_page` and dropped. The inbox, the
// outcomes, the AI employee, the monthly review and the attribution rollup all
// hang off a message that could not arrive.
//
// ══ One connection, both halves ════════════════════════════════════════════
//
// There is no second "connect the inbox" OAuth round trip: the Page connect
// asks for the union scope (lib/meta/client.js's metaPagesRequestedScope) and
// this is what turns that one grant into the rows the inbox needs. A
// contractor connects their Page once.
//
// ══ …and only when Meta actually granted it ════════════════════════════════
//
// Two gates, both required, both read from what Meta ANSWERED rather than what
// FieldQuo asked for:
//
//   the grant     inboxPlatformsGranted(), off GET /me/permissions — the
//                 consent screen lets a person un-tick a permission, and a
//                 Page connected for publishing alone must not grow an inbox.
//   the webhook   the subscription actually confirmed by Meta. Without it Meta
//                 delivers nothing, so a channel row would be an inbox that is
//                 wired up and permanently empty — which reads as "no customers
//                 wrote to us", the most expensive lie this feature could tell.
//
// Strictly stronger than the grant alone, because subscribePageWebhook refuses
// to even ask when the grant is missing. Where the subscribe failed for a
// reason that passes (Meta rate-limited for five minutes), the settings panel
// offers the retry, and the retry runs this.

import { saveChannel } from "./channels";
import { db } from "@/lib/db";
import { inboxPlatformsGranted } from "@/lib/meta/pageConnect";

/** The two platforms one Page connection can own. WhatsApp is not one of them. */
export const PAGE_CHANNEL_PLATFORMS = Object.freeze(["facebook", "instagram"]);

/**
 * Create (or revive) the inbox channels a Page connection has earned.
 *
 * @returns {Promise<{ facebook: boolean, instagram: boolean }>} which channels
 *          now exist — not which were asked for.
 *
 * `pageToken` is stored on BOTH rows, encrypted by saveChannel. That is not a
 * shortcut: Meta's Instagram messaging endpoint is
 * POST /<ig-user-id>/messages authenticated with the linked PAGE's token —
 * there is no separate Instagram credential to hold.
 *
 * The Instagram row is keyed on the Instagram business account id and not the
 * Page id, because that is what Meta puts in `entry.id` on an
 * `object: "instagram"` webhook (lib/messaging/envelope.js's OBJECT_TO_PLATFORM
 * maps it), and `entry.id` is the only thing the ingest looks a tenant up by.
 * Keying it on the Page id would produce a channel that resolves nothing.
 */
export async function savePageMessagingChannels({
  companyId,
  pageId,
  pageName,
  pageToken,
  instagramUserId,
  instagramUsername,
  grantedScopes,
  webhookSubscribedAt,
  connectedByUserId,
}) {
  const created = { facebook: false, instagram: false };
  if (!companyId || !pageId || !pageToken) return created;

  // Meta never confirmed the subscription, so nothing will be delivered. See
  // the header: an inbox that cannot receive is worse than no inbox.
  if (!webhookSubscribedAt) return created;

  const granted = inboxPlatformsGranted(grantedScopes);

  if (granted.facebook) {
    await saveChannel({
      companyId,
      platform: "facebook",
      // THE tenant key. Meta puts the Page id in `entry.id` on every page
      // webhook, and channelForExternalId looks up exactly this value.
      externalId: pageId,
      // What the contractor calls it. Never a fabricated "Facebook": a company
      // with a Page and an Instagram account has two rows in one inbox.
      name: pageName || null,
      accessToken: pageToken,
      // A Page token minted from a long-lived user token has no expiry of its
      // own, and stamping the user token's 60 days onto it would make the
      // inbox report a dead connection that still works — the same call
      // savePageConnection's own comment makes about the same credential.
      tokenExpiresAt: null,
      connectedByUserId: connectedByUserId || null,
    });
    created.facebook = true;
  }

  if (granted.instagram && instagramUserId) {
    await saveChannel({
      companyId,
      platform: "instagram",
      externalId: instagramUserId,
      // The @handle where Meta gave one, so the inbox filter names the account
      // rather than printing a 17-digit id at a contractor.
      name: instagramUsername ? `@${instagramUsername}` : pageName || null,
      accessToken: pageToken,
      tokenExpiresAt: null,
      connectedByUserId: connectedByUserId || null,
    });
    created.instagram = true;
  }

  return created;
}

/**
 * Stop watching this company's Page and Instagram inboxes.
 *
 * STAMPED, never deleted — MessagingChannel.disconnectedAt, exactly as the
 * WhatsApp disconnect does it and for the reason the schema gives: the
 * conversations survive, because the month-end review reads history and a
 * contractor who reconnects must not find last quarter's won/lost record gone.
 * Reconnecting the same Page revives the same row (saveChannel's upsert).
 *
 * `status` is deliberately untouched, matching the WhatsApp disconnect: it
 * describes whether the CREDENTIAL works, and a contractor choosing to
 * disconnect has not broken anything.
 *
 * Scoped by PLATFORM rather than by the connection's own page id, on purpose.
 * Two reasons, and the second is the one that matters: a company that switched
 * Pages could hold a channel for a Page they no longer have connected, and
 * leaving that row live means Meta keeps filing that Page's customer messages
 * into an inbox nobody is watching. "Disconnect Facebook & Instagram" means
 * all of it. WhatsApp is a different platform, a different panel and a
 * different credential, and is not touched.
 *
 * @returns {Promise<number>} how many channels were stamped.
 */
export async function disconnectPageMessagingChannels(companyId) {
  if (!companyId) return 0;
  const res = await db.messagingChannel.updateMany({
    where: {
      companyId,
      platform: { in: [...PAGE_CHANNEL_PLATFORMS] },
      disconnectedAt: null,
    },
    data: { disconnectedAt: new Date() },
  });
  return res?.count ?? 0;
}

/**
 * Which of the inboxes this grant allows are NOT live right now — what the
 * settings panel needs to offer "Connect the inbox" to a Page that was
 * connected before this code existed, and nothing at all to a Page whose
 * company never granted messaging.
 *
 * A READ. The status route is a GET, reachable by a superadmin under an
 * impersonation cookie, and non-negotiable #3 is that the platform console
 * views everything and edits nothing — so the backfill is a button a member of
 * the company presses, never something a read quietly performs.
 *
 * @returns {Promise<string[]>} platform names, in a stable order.
 */
export async function missingPageChannels({ companyId, grantedScopes, instagramUserId }) {
  const granted = inboxPlatformsGranted(grantedScopes);
  const wanted = PAGE_CHANNEL_PLATFORMS.filter((p) =>
    p === "instagram" ? granted.instagram && Boolean(instagramUserId) : granted.facebook,
  );
  if (!wanted.length) return [];

  const live = await db.messagingChannel.findMany({
    where: { companyId, platform: { in: wanted }, disconnectedAt: null },
    select: { platform: true },
  });
  const have = new Set(live.map((c) => c.platform));
  return wanted.filter((p) => !have.has(p));
}
