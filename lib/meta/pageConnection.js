// lib/meta/pageConnection.js
//
// The only file that reads or writes MetaPageConnection — the same "one door"
// discipline lib/meta/connection.js keeps for MetaAdConnection, and a
// deliberate copy of its shape rather than a second invented pattern: encrypt
// on the way in, decrypt only at the moment of use, never hand a token to a
// caller that only wanted a name.
//
// ── Two rules live here and nowhere else ───────────────────────────────────
//
//   1. A tombstone is not a connection. Disconnecting empties
//      pageAccessTokenEnc and stamps disconnectedAt in one write; every read
//      below filters `disconnectedAt: null`, so a disconnected row can never
//      answer "connected" no matter which caller asks. (MetaAdConnection
//      deletes its row outright; this table is per-PAGE, so a company with two
//      Pages disconnecting one still has the other — see the model's comment.)
//   2. publicPageConnectionShape() is what a browser may see. The token is not
//      in it, and adding it there would be the whole failure this file exists
//      to prevent.
import { db } from "@/lib/db";
import { encryptToken, decryptToken } from "./tokenCrypto";

/** The row FieldQuo is allowed to show the browser — never the token itself. */
export function publicPageConnectionShape(connection) {
  if (!connection) return null;
  return {
    pageId: connection.pageId,
    pageName: connection.pageName,
    instagramUserId: connection.instagramUserId,
    instagramUsername: connection.instagramUsername,
    scopes: connection.scopes,
    connectedAt: connection.connectedAt,
    tokenExpiresAt: connection.tokenExpiresAt,
  };
}

/**
 * The company's live Page connection, or null.
 *
 * A company CAN have more than one row (the unique key is companyId+pageId),
 * but only one is live at a time today — the connect flow disconnects any
 * previous Page before saving a new one, because the publish flow asks "which
 * Page does this company post to" and two answers to that is a product
 * decision nobody has made. Ordered newest-first so that if a future change
 * does allow two, this returns the one just connected rather than an arbitrary
 * row.
 */
export async function getPageConnection(companyId) {
  return db.metaPageConnection.findFirst({
    where: { companyId, disconnectedAt: null },
    orderBy: { connectedAt: "desc" },
  });
}

/**
 * Create or replace a company's Page connection. Called once at the end of the
 * OAuth callback (or the Page-picker finalize step) — the one place
 * encryptToken() runs for a fresh publishing connect.
 *
 * `instagramUserId: null` is stored as null and meant as null: a Page with no
 * linked Instagram professional account publishes to Facebook only, and
 * padding it with anything at all would be AGENTS.md's failure class 5 on the
 * one field the publish flow branches on.
 */
export async function savePageConnection({
  companyId,
  pageId,
  pageName,
  pageAccessToken,
  instagramUserId,
  instagramUsername,
  tokenExpiresAt,
  scopes,
  connectedByUserId,
}) {
  const pageAccessTokenEnc = encryptToken(pageAccessToken);
  const shared = {
    pageName: pageName ?? null,
    pageAccessTokenEnc,
    instagramUserId: instagramUserId ?? null,
    instagramUsername: instagramUsername ?? null,
    tokenExpiresAt: tokenExpiresAt ?? null,
    scopes: scopes ?? null,
    connectedByUserId: connectedByUserId ?? null,
    // Reconnecting the same Page revives its row rather than leaving a
    // tombstone that every read has to keep stepping over.
    disconnectedAt: null,
  };
  return db.metaPageConnection.upsert({
    where: { companyId_pageId: { companyId, pageId } },
    create: { companyId, pageId, connectedAt: new Date(), ...shared },
    update: { connectedAt: new Date(), ...shared },
  });
}

/**
 * The plaintext page token, decrypted on demand — never cached, never logged.
 *
 * Returns null rather than throwing when the row carries no token (a
 * tombstone) so the seam can report "not connected" instead of turning a
 * disconnected company into a 500. A DECRYPT failure still throws: a row whose
 * ciphertext will not open is a corrupted or wrong-key row, which is a
 * different fact from "expired" and must not be laundered into one.
 */
export function getDecryptedPageToken(connection) {
  if (!connection?.pageAccessTokenEnc) return null;
  return decryptToken(connection.pageAccessTokenEnc);
}

/**
 * Sever the connection. The encrypted token is gone from the database in this
 * write — that is the point of it, and it is why this is an update that NULLS
 * the column rather than a status flip beside a token still sitting there.
 */
export async function disconnectPageConnection(companyId) {
  await db.metaPageConnection.updateMany({
    where: { companyId, disconnectedAt: null },
    data: { pageAccessTokenEnc: null, disconnectedAt: new Date() },
  });
}
