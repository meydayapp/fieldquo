// lib/social/metaConnection.js
//
// THE SEAM. This file is the only thing the publish flow (lib/social/
// publishDesign.js, app/api/marketing/designer/designs/[id]/publish/route.js)
// knows about how a company's Facebook Page and Instagram account get
// connected. It still does not implement OAuth and does not talk to Meta: it
// reads what the connect flow stored, through the one door that owns that
// table (lib/meta/pageConnection.js), which is why there is exactly one
// encrypted-token layer in this codebase and not two.
//
// ══ The four steps, and where each one now lives ═══════════════════════════
//
// This header used to be a specification for an unbuilt real-company branch,
// because there was no stored token anywhere in the build to return. There is
// now — app/api/settings/social/{connect,callback,finalize,disconnect} grant
// META_PAGES_SCOPE and store an encrypted PAGE token per company+Page. The
// four steps it demanded, kept here as the contract they still are:
//
//   1. Look up the company's stored connection — getPageConnection(), which
//      filters out a disconnected row so a tombstone can never read as live.
//   2. Decrypt the Page access token server-side only — it must never reach
//      a browser or a log line. getDecryptedPageToken(), at the moment of
//      use, never cached.
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
// What has NOT changed: the return shape, the demo branch, and therefore
// every caller. `reason: "not_built"` is still what a company with no stored
// connection gets — which, until Meta approves META_PAGES_SCOPE, is every
// company, because the connect flow that would create one is switched off
// (metaPagesConnectEnabled() in lib/meta/client.js).
//
// ══ Why a function, not a constant ══════════════════════════════════════
//
// A real implementation is async (a DB read, a decrypt) — this stub is
// already async so every caller is already written against the real
// contract and needs no change when the body is replaced.
//
// ══ The one exception: a demo company ══════════════════════════════════════
//
// Added for docs/SOCIAL-SCHEDULING.md's demo mock, and it belongs HERE and
// nowhere else, for the same reason this whole file is "the seam": every
// caller (lib/social/publishDesign.js, both publish routes, the scheduling
// cron) already asks this one function "are we connected, and to what" —
// so it is also the one function that gets to answer "and is that connection
// real." A demo company (Company.isDemo) gets `connected: true` with
// `mock: true` and fabricated-but-realistic ids — never `pageAccessToken`
// bytes that look like a real token, and never anything derived from
// another tenant's real connection. `mock` is the ONLY signal
// lib/social/publishDesign.js and every route use to pick
// lib/social/mockMetaGraphClient.js over the real metaGraphClient.js — so a
// real company can reach this branch only if Company.isDemo is true for it,
// which is the same gate app/api/settings/voice/number/route.js already
// trusts for the demo phone line, re-read fresh here rather than cached or
// passed in, for the identical reason: a flag a caller could pass wrong is
// not a security boundary, a flag this function reads itself is.
import { db } from "@/lib/db";
import { getPageConnection, getDecryptedPageToken } from "@/lib/meta/pageConnection";

/**
 * @typedef {Object} MetaConnection
 * @property {boolean} connected
 * @property {"not_built"|"token_expired"|"revoked"|"unreadable_token"|null} [reason]
 * @property {boolean} [mock] - true only for a demo company's fabricated
 *   connection; see this file's header. Never true for a real company.
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
export async function getMetaConnection(companyId) {
  const company = await db.company
    .findUnique({ where: { id: companyId }, select: { isDemo: true, name: true } })
    .catch(() => null);

  if (company?.isDemo) {
    // Fabricated, and shaped to say so on sight to anyone who logs it — the
    // fixed 'demo_' prefix on every id here is not decorative: it is what
    // keeps a support conversation from ever mistaking this for a real
    // Meta page id or access token, the same discipline
    // lib/voice/demoLine.js's fictional NANP block (555-01xx) keeps for a
    // demo's phone number. A demo company is re-dressed as different trades
    // over time (lib/demo/industries.js) — pageName follows the company's
    // OWN current name rather than a fixed string, so the demo stays
    // internally consistent with whatever trade it's playing this week.
    return {
      connected: true,
      mock: true,
      reason: null,
      pageId: "demo_page_000000",
      pageName: company.name ? `${company.name} (Demo)` : "Demo Page",
      pageAccessToken: "demo-token-not-a-real-credential",
      instagramUserId: "demo_ig_000000",
      instagramUsername: "demo_account",
    };
  }

  // ── The real-company branch (the four steps in this file's header) ───────
  //
  // Step 1: the stored connection. lib/meta/pageConnection.js is the one door
  // onto MetaPageConnection — a disconnected row (token nulled, disconnectedAt
  // stamped) is filtered out there, so "connected" here can never be a
  // tombstone.
  const stored = await getPageConnection(companyId).catch(() => null);
  if (!stored) return notConnected("not_built");

  // Step 4, checked BEFORE decrypting: an expiry Meta gave us that has passed.
  // A page token derived from a long-lived user token normally has no expiry
  // at all (tokenExpiresAt is null, and that is not a gap — see the model), so
  // this fires only when Meta actually told us a date and that date is behind
  // us. Returned, never thrown: the publish route and the settings panel both
  // have to render this state, and an exception is not a state.
  if (stored.tokenExpiresAt && stored.tokenExpiresAt.getTime() <= Date.now()) {
    return notConnected("token_expired");
  }

  // Step 2: decrypt server-side only. This value is returned to
  // lib/social/publishDesign.js, which hands it to Meta and nothing else — it
  // is never serialised into an API response (the settings screen reads
  // /api/settings/social/status, which returns publicPageConnectionShape and
  // has no token in it) and never logged.
  let pageAccessToken = null;
  try {
    pageAccessToken = getDecryptedPageToken(stored);
  } catch {
    // The ciphertext will not open: a corrupted row, or META_TOKEN_ENCRYPTION_KEY
    // rotated out from under it. NOT "expired" — Meta never said anything about
    // this token — but the contractor's fix is the same one word, reconnect,
    // which is why connectionStatusKey folds it into the same UI state.
    return notConnected("unreadable_token");
  }
  if (!pageAccessToken) return notConnected("not_built");

  // Step 3. instagramUserId stays null when the Page has no linked Instagram
  // professional account — connected: true regardless, so Facebook-only
  // publishing works (publishToFacebook succeeds; publishToInstagram refuses
  // with its own `no_instagram_account`, which is the honest per-platform
  // answer rather than a blanket "not connected").
  return {
    connected: true,
    mock: false,
    reason: null,
    pageId: stored.pageId,
    pageName: stored.pageName || null,
    pageAccessToken,
    instagramUserId: stored.instagramUserId || null,
    instagramUsername: stored.instagramUsername || null,
  };
}

/**
 * Every "no" this function can give, in one shape. Written once so a new
 * refusal can never accidentally omit `pageAccessToken: null` — a missing key
 * and an explicit null read identically at most call sites and not at all of
 * them.
 */
function notConnected(reason) {
  return {
    connected: false,
    mock: false,
    reason,
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
  if (
    connection?.reason === "token_expired" ||
    connection?.reason === "revoked" ||
    // A stored credential that will not decrypt is a different FACT from an
    // expired one (see getMetaConnection's own comment) and the same ACTION:
    // reconnect. Folded in here rather than given a fourth UI state nobody
    // could act on differently.
    connection?.reason === "unreadable_token"
  ) {
    return "tokenExpired";
  }
  return "notConnected";
}
