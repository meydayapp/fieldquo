// lib/tiktok/connection.js
//
// The only file that reads or writes TikTokConnection — the same "one door"
// lib/meta/pageConnection.js keeps for MetaPageConnection, and deliberately the
// same shape: encrypt on the way in with lib/meta/tokenCrypto.js (the SAME
// helper and key Meta tokens use — one encrypted-token layer in this codebase,
// not two), decrypt only at the moment of use, never hand a token to a caller
// that only wanted a name.
//
// ── Three rules live here and nowhere else ─────────────────────────────────
//
//   1. A tombstone is not a connection. Every live read filters
//      `disconnectedAt: null`.
//   2. Disconnecting NEVER deletes. It nulls both tokens and stamps
//      disconnectedAt + disconnectReason in one updateMany — whether the
//      person pressed Disconnect, TikTok sent authorization.removed, or the
//      refresh token was refused for good. scripts/check-tiktok.mjs drives
//      every one of those paths against a recording client and fails on any
//      delete.
//   3. publicTikTokShape() is what a browser may see. No token is in it.
//
// Every function that touches the database takes an optional `client` (the
// Prisma client by default) and every one that calls TikTok an optional `api`
// (lib/tiktok/client.js by default), so the check can execute the real code
// rather than assert about it by reading.
import { db } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/meta/tokenCrypto";
import * as tiktokApi from "./client";
import { TIKTOK_SCOPES } from "./config";

/** Refresh when the access token has less than this left — a post takes a few calls. */
export const ACCESS_REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** The cron rolls a refresh token forward once it is inside this window. */
export const REFRESH_ROLLOVER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const DISCONNECT_REASONS = Object.freeze(["user", "authorization_removed", "refresh_failed", "replaced"]);

/** `expires_in` seconds → an absolute Date, or null when TikTok gave none. */
export function expiryFrom(seconds, now = new Date()) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(now.getTime() + n * 1000);
}

/** Which of the scopes FieldQuo asks for TikTok did NOT grant. Null in, null out. */
export function missingTikTokScopes(granted) {
  if (granted == null) return null;
  const have = new Set(String(granted).split(",").map((s) => s.trim()).filter(Boolean));
  return TIKTOK_SCOPES.filter((s) => !have.has(s));
}

/** The row FieldQuo is allowed to show the browser — never a token. */
export function publicTikTokShape(row) {
  if (!row) return null;
  return {
    openId: row.openId,
    displayName: row.displayName || null,
    avatarUrl: row.avatarUrl || null,
    scopes: row.scopes || null,
    missingScopes: missingTikTokScopes(row.scopes),
    connectedAt: row.connectedAt || null,
    disconnectedAt: row.disconnectedAt || null,
    disconnectReason: row.disconnectReason || null,
    revokeFailed: Boolean(row.revokeError),
    refreshTokenExpiresAt: row.refreshTokenExpiresAt || null,
  };
}

export async function getLiveTikTokConnection(companyId, { client = db } = {}) {
  return client.tikTokConnection.findFirst({
    where: { companyId, disconnectedAt: null },
    orderBy: { connectedAt: "desc" },
  });
}

/** The newest row, live or not — so the card can say WHY it is no longer connected. */
export async function getLatestTikTokConnection(companyId, { client = db } = {}) {
  return client.tikTokConnection.findFirst({ where: { companyId }, orderBy: { updatedAt: "desc" } });
}

/**
 * Store a fresh connection from the OAuth callback. One live TikTok account per
 * company — the composer asks "which account does this company post to", and
 * two answers is a product decision nobody has made — so any OTHER live row is
 * stamped `replaced` (not deleted) in the same request. Reconnecting the same
 * account revives its own row.
 */
export async function saveTikTokConnection(
  { companyId, openId, displayName, avatarUrl, accessToken, refreshToken, expiresIn, refreshExpiresIn, scopes, connectedByUserId, now = new Date() },
  { client = db } = {},
) {
  const shared = {
    displayName: displayName ?? null,
    avatarUrl: avatarUrl ?? null,
    accessTokenEnc: encryptToken(accessToken),
    refreshTokenEnc: encryptToken(refreshToken),
    accessTokenExpiresAt: expiryFrom(expiresIn, now),
    refreshTokenExpiresAt: expiryFrom(refreshExpiresIn, now),
    scopes: scopes ?? null,
    connectedByUserId: connectedByUserId ?? null,
    connectedAt: now,
    disconnectedAt: null,
    disconnectReason: null,
    revokeError: null,
  };
  await client.tikTokConnection.updateMany({
    where: { companyId, disconnectedAt: null, NOT: { openId } },
    data: tombstone("replaced", now),
  });
  return client.tikTokConnection.upsert({
    where: { companyId_openId: { companyId, openId } },
    create: { companyId, openId, ...shared },
    update: shared,
  });
}

function tombstone(reason, now, revokeError = null) {
  return {
    accessTokenEnc: null,
    refreshTokenEnc: null,
    accessTokenExpiresAt: null,
    disconnectedAt: now,
    disconnectReason: reason,
    revokeError: revokeError ? String(revokeError).slice(0, 300) : null,
  };
}

/**
 * Disconnect: tokens gone, row kept. An updateMany, so a company with no live
 * row is a harmless no-op, and there is no code path here that can delete.
 * Returns how many rows were stamped.
 */
export async function disconnectTikTokConnection(companyId, { reason = "user", revokeError = null, now = new Date(), client = db } = {}) {
  const r = await client.tikTokConnection.updateMany({
    where: { companyId, disconnectedAt: null },
    data: tombstone(DISCONNECT_REASONS.includes(reason) ? reason : "user", now, revokeError),
  });
  return r?.count ?? 0;
}

/**
 * TikTok's authorization.removed webhook: the person removed FieldQuo in the
 * TikTok app. Every live row for that TikTok account (it could be connected to
 * more than one company) stops being live. Stamped, never deleted.
 */
export async function markAuthorizationRemoved(openId, { now = new Date(), client = db } = {}) {
  if (!openId) return 0;
  const r = await client.tikTokConnection.updateMany({
    where: { openId: String(openId), disconnectedAt: null },
    data: tombstone("authorization_removed", now),
  });
  return r?.count ?? 0;
}

/** Keep the card's nickname/avatar current from a fresh creator_info. Best effort. */
export async function updateCreatorDisplay(connectionId, { nickname, avatarUrl }, { client = db } = {}) {
  if (!connectionId || (!nickname && !avatarUrl)) return;
  await client.tikTokConnection
    .update({
      where: { id: connectionId },
      data: { ...(nickname ? { displayName: nickname } : {}), ...(avatarUrl ? { avatarUrl } : {}) },
    })
    .catch(() => {});
}

// TikTok's OAuth errors that mean the refresh token itself is dead — as
// opposed to a network blip or a 5xx, which must NOT tear down a connection
// that will work again in a minute. Deliberately ONE code: invalid_request /
// invalid_client are what a mistyped TIKTOK_CLIENT_KEY produces, and reading
// those as "this person's token is dead" would disconnect every company at
// once over a deploy setting.
const DEAD_REFRESH_CODES = new Set(["invalid_grant"]);

/**
 * Exchange a row's refresh token for a new pair and store both (TikTok may
 * rotate the refresh token). A refusal that means "this refresh token is
 * dead" stamps the row `refresh_failed`; anything else leaves it alone and
 * reports the failure.
 *
 * @returns {Promise<{ok: true, row: object, accessToken: string} | {ok: false, reason: string, code?: string}>}
 */
export async function refreshConnection(row, { now = new Date(), client = db, api = tiktokApi } = {}) {
  let refreshToken;
  try {
    refreshToken = row?.refreshTokenEnc ? decryptToken(row.refreshTokenEnc) : null;
  } catch {
    return { ok: false, reason: "unreadable_token" };
  }
  if (!refreshToken) return { ok: false, reason: "not_connected" };

  if (row.refreshTokenExpiresAt && new Date(row.refreshTokenExpiresAt).getTime() <= now.getTime()) {
    await client.tikTokConnection.updateMany({
      where: { id: row.id, disconnectedAt: null },
      data: tombstone("refresh_failed", now),
    });
    return { ok: false, reason: "token_expired" };
  }

  const r = await api.refreshAccessToken({ refreshToken });
  if (!r.ok) {
    if (DEAD_REFRESH_CODES.has(r.code)) {
      await client.tikTokConnection.updateMany({
        where: { id: row.id, disconnectedAt: null },
        data: tombstone("refresh_failed", now),
      });
      return { ok: false, reason: "token_expired", code: r.code };
    }
    return { ok: false, reason: "refresh_failed", code: r.code };
  }
  const d = r.data || {};
  if (!d.access_token) return { ok: false, reason: "refresh_failed", code: "no_access_token" };
  const updated = await client.tikTokConnection.update({
    where: { id: row.id },
    data: {
      accessTokenEnc: encryptToken(d.access_token),
      accessTokenExpiresAt: expiryFrom(d.expires_in, now),
      ...(d.refresh_token
        ? {
            refreshTokenEnc: encryptToken(d.refresh_token),
            refreshTokenExpiresAt: expiryFrom(d.refresh_expires_in, now) ?? row.refreshTokenExpiresAt ?? null,
          }
        : {}),
      ...(typeof d.scope === "string" && d.scope ? { scopes: d.scope } : {}),
    },
  });
  return { ok: true, row: updated, accessToken: d.access_token };
}

/**
 * A usable access token for the company's live connection, refreshed on use
 * when it is within ACCESS_REFRESH_MARGIN_MS of expiry. Never throws: every
 * "no" is a reason the caller renders (the same discipline
 * lib/social/metaConnection.js keeps — an exception is not a state).
 *
 * @returns {Promise<{connected: true, accessToken: string, connection: object} | {connected: false, reason: string, code?: string}>}
 */
export async function getTikTokAccess(companyId, { now = new Date(), client = db, api = tiktokApi } = {}) {
  const row = await getLiveTikTokConnection(companyId, { client }).catch(() => null);
  if (!row) return { connected: false, reason: "not_connected" };

  const expiresAt = row.accessTokenExpiresAt ? new Date(row.accessTokenExpiresAt).getTime() : 0;
  if (expiresAt - now.getTime() > ACCESS_REFRESH_MARGIN_MS) {
    try {
      const accessToken = row.accessTokenEnc ? decryptToken(row.accessTokenEnc) : null;
      if (accessToken) return { connected: true, accessToken, connection: row };
    } catch {
      return { connected: false, reason: "unreadable_token" };
    }
  }

  const refreshed = await refreshConnection(row, { now, client, api });
  if (!refreshed.ok) return { connected: false, reason: refreshed.reason, code: refreshed.code };
  return { connected: true, accessToken: refreshed.accessToken, connection: refreshed.row };
}

/**
 * The daily cron's work: roll forward every live connection whose REFRESH
 * token is inside REFRESH_ROLLOVER_WINDOW_MS of expiring. Access tokens are
 * refreshed on use and are not the cron's business — it exists so an account
 * nobody posts from for a year does not silently die. Usually zero rows.
 */
export async function refreshDueConnections({ now = new Date(), client = db, api = tiktokApi, limit = 50 } = {}) {
  const due = await client.tikTokConnection.findMany({
    where: {
      disconnectedAt: null,
      refreshTokenExpiresAt: { lte: new Date(now.getTime() + REFRESH_ROLLOVER_WINDOW_MS) },
    },
    orderBy: { refreshTokenExpiresAt: "asc" },
    take: limit,
  });
  const summary = { checked: due.length, refreshed: 0, expired: 0, failed: 0 };
  for (const row of due) {
    // eslint-disable-next-line no-await-in-loop
    const r = await refreshConnection(row, { now, client, api });
    if (r.ok) summary.refreshed += 1;
    else if (r.reason === "token_expired") summary.expired += 1;
    else summary.failed += 1;
  }
  return summary;
}
