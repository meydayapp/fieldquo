// lib/messaging/channels.js
//
// The ONE door onto MessagingChannel — the same discipline
// lib/meta/connection.js keeps for MetaAdConnection and
// lib/stripe/connectAccount.js keeps for Company.stripeAccountId. Every route
// and every send goes through here rather than touching db.messagingChannel or
// lib/meta/tokenCrypto.js directly, so "encrypt before write, decrypt only at
// the moment of use, never hand a token to a browser" cannot be skipped by a
// route that forgets.
//
// ══ Why this is not lib/social/metaConnection.js ═══════════════════════════
//
// That file is the seam for PUBLISHING a post to a Page. It answers "are we
// connected, and to what" for one Page and one ads-shaped token, and its
// header spells out that it deliberately implements no OAuth of its own.
// Messaging needs a different token (a per-Page messaging token), a different
// scope Meta has not approved yet (lib/meta/client.js's META_MESSAGING_SCOPE),
// and several Pages per company. What IS copied from it, exactly, is the rule
// about demo companies: `mock` is decided HERE, by reading Company.isDemo
// fresh from the database, never from a flag a caller passed in — a flag a
// caller could get wrong is not a boundary.

import { db } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/meta/tokenCrypto";
import { metaAppConfigured, metaWhatsAppEnabled } from "@/lib/meta/client";
import { tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";
import { isMessagingPlatform } from "./platforms";

/** What may be sent to a browser. Never accessTokenEnc, never a token. */
export function publicChannelShape(channel) {
  if (!channel) return null;
  return {
    id: channel.id,
    platform: channel.platform,
    name: channel.name || null,
    externalId: channel.externalId,
    status: channel.status,
    connectedAt: channel.connectedAt,
    disconnectedAt: channel.disconnectedAt || null,
    lastError: channel.lastError || null,
    // WhatsApp only, and null on the other two rather than absent: a settings
    // panel that has to test `"displayPhoneNumber" in channel` is a panel that
    // knows about platforms. Null means "this channel has no number", which is
    // the truth for a Page.
    wabaId: channel.wabaId || null,
    displayPhoneNumber: channel.displayPhoneNumber || null,
    verifiedName: channel.verifiedName || null,
    // When the channel's past conversations were last pulled from Meta, or
    // null for never. Facebook and Instagram only; the settings card prints
    // it beside "Import past conversations" so the link says when it last
    // ran rather than pretending it never has.
    importedAt: channel.importedAt || null,
  };
}

/** A company's live channels — disconnected ones excluded, never deleted. */
export async function listChannels(companyId) {
  return db.messagingChannel.findMany({
    where: { companyId, disconnectedAt: null },
    orderBy: { connectedAt: "asc" },
  });
}

/**
 * Resolve an inbound webhook to a tenant.
 *
 * THE tenant-resolution function, and the reason the webhook never reads a
 * companyId out of a payload: this looks up the Page id Meta itself put in
 * `entry.id` against our own rows. A stranger who POSTs a forged body can name
 * any Page id they like; unless FieldQuo holds a row for it, nothing is
 * written, and the row is what names the company.
 *
 * Uses the @@unique([platform, externalId]) index — global, not company-scoped
 * on purpose: one Page belongs to exactly one FieldQuo tenant, and a lookup
 * that needed a companyId to find it would have to be told the answer first.
 */
export async function channelForExternalId(platform, externalId) {
  if (!platform || !externalId) return null;
  return db.messagingChannel.findUnique({
    where: { platform_externalId: { platform, externalId } },
  });
}

/**
 * One channel ROW, by its own id — token and all.
 *
 * For the two callers that already hold a thread and need the credential to
 * fetch its media: /api/cron/messaging-media and the Retry endpoint. It goes
 * through this file rather than touching db.messagingChannel directly for the
 * reason the header gives — every read of a token-bearing row goes through one
 * door, so "decrypt only at the moment of use" is enforced in one place.
 *
 * Company-scoped, and not optionally: a media fetch is triggered by a signed-in
 * member for the cron's sake and by a cron for a message it has already
 * resolved, and neither has a reason to reach a channel in another tenant.
 */
export async function channelById(companyId, channelId) {
  if (!companyId || !channelId) return null;
  return db.messagingChannel.findFirst({ where: { id: channelId, companyId } });
}

/**
 * Create or refresh one Page's channel. The one place encryptToken runs for
 * messaging, so a plaintext Page token exists only inside this call.
 */
export async function saveChannel({
  companyId,
  platform,
  externalId,
  name,
  accessToken,
  tokenExpiresAt,
  connectedByUserId,
  // WhatsApp only. Undefined on a Page connect, and Prisma drops an undefined
  // from both halves of an upsert — so a Facebook reconnect cannot blank the
  // WhatsApp columns of a row it does not own, and a WhatsApp reconnect that
  // learned nothing new leaves what it already had.
  wabaId,
  displayPhoneNumber,
  verifiedName,
}) {
  if (!isMessagingPlatform(platform)) {
    // Refused rather than stored. `platform` is a plain String column and the
    // set that constrains it lives in lib/messaging/platforms.js, so THIS is
    // the constraint — a row with a platform nothing recognises would be a
    // conversation in no inbox, invisible to every filter and to the webhook
    // that would have to resolve it.
    throw new Error(`saveChannel: unknown platform ${String(platform)}`);
  }
  const accessTokenEnc = encryptToken(accessToken);
  return db.messagingChannel.upsert({
    where: { companyId_platform_externalId: { companyId, platform, externalId } },
    create: {
      companyId,
      platform,
      externalId,
      name,
      accessTokenEnc,
      tokenExpiresAt,
      connectedByUserId,
      status: "connected",
      wabaId,
      displayPhoneNumber,
      verifiedName,
    },
    update: {
      name,
      accessTokenEnc,
      tokenExpiresAt,
      connectedByUserId,
      status: "connected",
      lastError: null,
      wabaId,
      displayPhoneNumber,
      verifiedName,
      // Reconnecting a Page revives the same row, and every conversation
      // hanging off it comes back with it — see the schema note on why a
      // disconnect never deletes.
      disconnectedAt: null,
    },
  });
}

/** The plaintext Page token, decrypted at the moment of use. Never cached. */
export function decryptedChannelToken(channel) {
  return decryptToken(channel.accessTokenEnc);
}

/**
 * Mark a channel as needing attention. Called after a Meta refusal, so a dead
 * token becomes a visible state on the inbox instead of messages that quietly
 * stop arriving — the identical rule lib/meta/connection.js's recordSyncOutcome
 * follows for the ads import.
 */
export async function recordChannelError({ channelId, status, error }) {
  return db.messagingChannel.update({
    where: { id: channelId },
    data: { status, lastError: error ?? null },
  });
}

/**
 * Record that a channel's existing conversations were pulled from Meta.
 *
 * Read back by lib/messaging/pageImport.js as two different facts: null means
 * the connect flow still owes this channel its one automatic import, and a
 * recent stamp is the manual refresh's rate limit. Stamped AFTER the import
 * ran — never before, so a pull that failed halfway is retried by the next
 * connect or press rather than recorded as done.
 */
export async function stampChannelImported({ channelId, at = new Date() }) {
  return db.messagingChannel.update({
    where: { id: channelId },
    data: { importedAt: at },
  });
}

/**
 * Is FieldQuo itself able to connect a Page at all?
 *
 * Three separate things have to be true and they fail differently, so they are
 * reported separately rather than as one boolean:
 *
 *   app        — META_APP_ID / META_APP_SECRET exist (FieldQuo's problem)
 *   crypto     — META_TOKEN_ENCRYPTION_KEY exists, so a token can be stored
 *                at rest (FieldQuo's problem)
 *   approved   — Meta has approved pages_messaging for this app
 *                (Meta's decision; nobody here can hurry it)
 *
 * The screen prints the reason it gets. A "Connect" button that 500s because
 * an env var is missing is the dead control AGENTS.md's first rule forbids.
 */
export function platformMessagingReadiness() {
  // Imported lazily-shaped rather than at call time to keep this pure-ish and
  // testable: both helpers read process.env and never throw.
  return {
    app: metaAppConfigured(),
    crypto: tokenCryptoConfigured(),
    // Deliberately read through lib/meta/client.js rather than reading the env
    // var here, so there is exactly one definition of "Meta has approved this".
    approved: process.env.META_MESSAGING_APPROVED === "true",
    // WhatsApp is a SEPARATE App Review with a separate flag, so it is a
    // separate field rather than folded into `approved` above. A company could
    // have WhatsApp working and Page messaging still blocked, and one boolean
    // covering both would make the screen say the wrong thing for whichever
    // of the two landed first.
    whatsapp: metaWhatsAppEnabled(),
  };
}

/**
 * The connection state one screen needs, in one object.
 *
 * @returns {{ connected: boolean, mock: boolean, reason: string|null,
 *             channels: Array, readiness: object }}
 *
 * `reason` values, all of them things the UI has a sentence for:
 *   "awaiting_meta_approval" — the scopes are not granted yet. The state every
 *                              real company is in today.
 *   "not_configured"         — FieldQuo has no Meta app or no encryption key.
 *   "not_connected"          — everything is ready; nobody has connected a Page.
 *   "needs_reauth"           — a Page was connected and its token stopped working.
 */
export async function messagingConnection(companyId) {
  const company = await db.company
    .findUnique({ where: { id: companyId }, select: { isDemo: true, name: true } })
    .catch(() => null);

  // ── The demo company, and ONLY the demo company ─────────────────────────
  //
  // Same carve-out, same reasoning and same fixed `demo_` prefixes as
  // lib/social/metaConnection.js: a sales demo has to show a populated inbox,
  // and Company.isDemo is read here from the database rather than passed in.
  // `mock` is the only signal any route uses to serve the sample threads in
  // lib/messaging/demoThreads.js, so a real company cannot reach them.
  if (company?.isDemo) {
    return {
      connected: true,
      mock: true,
      reason: null,
      channels: [
        {
          id: "demo_channel_facebook",
          platform: "facebook",
          name: company.name ? `${company.name} (Demo)` : "Demo Page",
          externalId: "demo_page_000000",
          status: "connected",
          connectedAt: null,
          disconnectedAt: null,
          lastError: null,
        },
      ],
      readiness: platformMessagingReadiness(),
    };
  }

  const readiness = platformMessagingReadiness();
  const channels = await listChannels(companyId).catch(() => []);
  const shaped = channels.map(publicChannelShape);

  if (shaped.length) {
    const broken = shaped.find((c) => c.status !== "connected");
    return {
      connected: !broken,
      mock: false,
      reason: broken ? "needs_reauth" : null,
      channels: shaped,
      readiness,
    };
  }

  // Order matters: the thing that is actually blocking is named first. Telling
  // a contractor "nobody has connected a Page" when the truth is "Meta has not
  // approved us yet" sends them looking for a button that would refuse them.
  // Both reviews, not one. Once EITHER Page messaging or WhatsApp is enabled
  // there is a channel a contractor could actually connect, so "waiting on
  // Meta" stops being the true answer and "nobody has connected anything"
  // starts being it — and telling them the wrong one of those sends them
  // either to a button that would refuse them or away from one that works.
  const reason = !readiness.approved && !readiness.whatsapp
    ? "awaiting_meta_approval"
    : !readiness.app || !readiness.crypto
      ? "not_configured"
      : "not_connected";

  return { connected: false, mock: false, reason, channels: [], readiness };
}
