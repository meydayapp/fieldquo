// lib/social/metaConnection.js
//
// THE SEAM. This file is the only thing the publish flow (lib/social/
// publishDesign.js, app/api/marketing/designer/designs/[id]/publish/route.js)
// knows about how a company's Facebook Page and Instagram account get
// connected. It does not implement OAuth, does not store a token, and does
// not talk to Meta — a sibling worktree is building per-tenant Meta OAuth
// and encrypted token storage for the ads/insights import
// (docs/META-ADS-INTEGRATION.md), and duplicating that here would leave two
// half-built connection layers competing for the same job.
//
// ══ What MUST happen on merge ═══════════════════════════════════════════
//
// getMetaConnection() below always returns "not connected" — there is no
// stored token anywhere in this build to return. Whoever lands the real
// Meta OAuth/token-storage layer must replace this function's BODY only,
// keeping the same return shape, so nothing in lib/social/publishDesign.js
// or the publish route has to change:
//
//   1. Look up the company's stored connection (wherever the OAuth layer
//      keeps it — likely Company-scoped, mirroring Company.stripeAccountId,
//      per docs/META-ADS-INTEGRATION.md Part 3's own recommendation).
//   2. Decrypt the Page access token server-side only — it must never reach
//      a browser or a log line. "Never store a raw token in plain text" is
//      the whole point of that sibling worktree's encrypted-storage work;
//      this file inherits that obligation the moment it starts returning a
//      real token.
//   3. Return { connected: true, pageId, pageName, pageAccessToken,
//      instagramUserId, instagramUsername } — a Page with no linked
//      Instagram Business/Creator account still returns connected: true
//      with instagramUserId: null, so Facebook-only publishing works even
//      before Instagram is linked (see docs/SOCIAL-PUBLISHING.md, "what a
//      contractor must set up on Meta's side").
//   4. If the stored token is expired/revoked, return connected: false with
//      reason: "token_expired" rather than throwing — the same "detect
//      explicitly, surface on settings, never report zero as success"
//      discipline docs/META-ADS-INTEGRATION.md Part 3 already specifies for
//      the insights sync, because it is the identical failure shape with a
//      different logo on it.
//
// ══ Why a function, not a constant ══════════════════════════════════════
//
// A real implementation is async (a DB read, a decrypt) — this stub is
// already async so every caller is already written against the real
// contract and needs no change when the body is replaced.

/**
 * @typedef {Object} MetaConnection
 * @property {boolean} connected
 * @property {"not_built"|"token_expired"|"revoked"|null} [reason]
 * @property {string|null} [pageId]
 * @property {string|null} [pageName]
 * @property {string|null} [pageAccessToken]
 * @property {string|null} [instagramUserId]
 * @property {string|null} [instagramUsername]
 */

/**
 * @param {string} companyId
 * @returns {Promise<MetaConnection>}
 */
// eslint-disable-next-line no-unused-vars
export async function getMetaConnection(companyId) {
  return {
    connected: false,
    reason: "not_built",
    pageId: null,
    pageName: null,
    pageAccessToken: null,
    instagramUserId: null,
    instagramUsername: null,
  };
}

/**
 * A one-line, translatable-key-safe reason code for the UI — kept separate
 * from `reason` above (which is for logs/support, in English, and can grow
 * new values without touching every caller's translation table).
 *
 * @param {MetaConnection} connection
 * @returns {"notConnected"|"tokenExpired"|"ready"}
 */
export function connectionStatusKey(connection) {
  if (connection?.connected) return "ready";
  if (connection?.reason === "token_expired" || connection?.reason === "revoked") {
    return "tokenExpired";
  }
  return "notConnected";
}
