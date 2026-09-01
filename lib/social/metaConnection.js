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
// getMetaConnection() below always returns "not connected" for a REAL
// company — there is no stored token anywhere in this build to return (a
// DEMO company is the one exception; see that section further down). Whoever
// lands the real Meta OAuth/token-storage layer must replace the real-company
// branch's BODY only, keeping the same return shape and leaving the demo
// branch untouched, so nothing in lib/social/publishDesign.js or the publish
// route has to change:
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

/**
 * @typedef {Object} MetaConnection
 * @property {boolean} connected
 * @property {"not_built"|"token_expired"|"revoked"|null} [reason]
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

  return {
    connected: false,
    mock: false,
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
