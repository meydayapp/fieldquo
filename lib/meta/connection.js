// lib/meta/connection.js
//
// The only file that reads or writes MetaAdConnection — the same "one door"
// discipline lib/stripe/connectAccount.js keeps for Company.stripeAccountId.
// Every route under app/api/meta-ads/* calls through here rather than
// touching db.metaAdConnection or lib/meta/tokenCrypto.js directly, so the
// encrypt-before-write / decrypt-only-when-needed rule can't be skipped by
// a route that forgets.
import { db } from "@/lib/db";
import { encryptToken, decryptToken } from "./tokenCrypto";

/** The row FieldQuo is allowed to show the browser — never the token itself. */
export function publicConnectionShape(connection) {
  if (!connection) return null;
  return {
    adAccountId: connection.adAccountId,
    adAccountName: connection.adAccountName,
    adAccountCurrency: connection.adAccountCurrency,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt,
    lastSyncError: connection.lastSyncError,
    connectedAt: connection.connectedAt,
    tokenExpiresAt: connection.tokenExpiresAt,
  };
}

export async function getConnection(companyId) {
  return db.metaAdConnection.findUnique({ where: { companyId } });
}

/**
 * Create or replace a company's connection. Called once at the end of the
 * OAuth callback (or the account-picker finalize step) — never with a
 * plaintext token already at rest anywhere else, including logs: this is the
 * one place encryptToken() runs for a fresh connect.
 */
export async function saveConnection({
  companyId,
  adAccountId,
  adAccountName,
  adAccountCurrency,
  accessToken,
  tokenExpiresAt,
  connectedByUserId,
}) {
  const accessTokenEnc = encryptToken(accessToken);
  return db.metaAdConnection.upsert({
    where: { companyId },
    create: {
      companyId,
      adAccountId,
      adAccountName,
      adAccountCurrency,
      accessTokenEnc,
      tokenExpiresAt,
      connectedByUserId,
      status: "connected",
    },
    update: {
      adAccountId,
      adAccountName,
      adAccountCurrency,
      accessTokenEnc,
      tokenExpiresAt,
      connectedByUserId,
      status: "connected",
      lastSyncError: null,
    },
  });
}

/** The plaintext token, decrypted on demand — never cached, never logged. */
export function getDecryptedToken(connection) {
  return decryptToken(connection.accessTokenEnc);
}

export async function disconnectConnection(companyId) {
  // Deleting rather than soft-marking: a disconnected company has no reason
  // to keep an encrypted token at rest at all, and reconnecting creates a
  // fresh row with a fresh token — there's no state worth preserving across
  // a disconnect the way there is across a sync failure (see
  // recordSyncOutcome below, which keeps the row).
  await db.metaAdConnection.deleteMany({ where: { companyId } });
}

/**
 * Written by the sync job after every attempt, success or failure — this is
 * what turns a dead token into a VISIBLE "needs_reauth" on the settings
 * screen instead of a connection that quietly stops updating. See
 * lib/meta/client.js's classifyMetaError for what decides which status.
 */
export async function recordSyncOutcome({ companyId, status, error }) {
  return db.metaAdConnection.update({
    where: { companyId },
    data: {
      status,
      lastSyncError: error ?? null,
      lastSyncedAt: new Date(),
    },
  });
}
