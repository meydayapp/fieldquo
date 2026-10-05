// lib/googleAds/connection.js
//
// The GoogleAdsConnection row: every read and write of it, in one file —
// the "one door" lib/meta/connection.js and lib/reviews/googleBusiness/
// connection.js keep for theirs, so no route can store a plaintext token or
// hand one to the browser. Takes `db` as an argument (defaulting to the real
// client) so the check can execute these against a memory fixture.

import { db as realDb } from "@/lib/db";
import { encryptToken } from "@/lib/meta/tokenCrypto";
import { cleanCustomerId, formatCustomerId } from "./client";

export const GOOGLE_ADS_SETTINGS_PATH = "/app/settings/google-ads";

export async function getGoogleAdsConnection(companyId, db = realDb) {
  if (!companyId) return null;
  return db.googleAdsConnection.findUnique({ where: { companyId } });
}

/**
 * Connect, or reconnect. The fresh refresh token replaces the old one; the
 * account choice is KEPT on a reconnect (the same person re-consenting after
 * "needs_reauth" should not have to pick the account again) — if the new
 * Google user cannot read it, the next sync says so in words.
 */
export async function saveGoogleAdsConnection({ companyId, refreshToken, email, memberId }, db = realDb) {
  const refreshTokenEnc = encryptToken(refreshToken);
  return db.googleAdsConnection.upsert({
    where: { companyId },
    create: { companyId, refreshTokenEnc, email: email || null, connectedByMemberId: memberId || null, status: "connected" },
    update: { refreshTokenEnc, email: email || null, connectedByMemberId: memberId || null, connectedAt: new Date(), status: "connected", lastSyncError: null },
  });
}

/** The ad account the company picked — validated by the caller against Google's own list. */
export async function setGoogleAdsAccount(companyId, { customerId, loginCustomerId, customerName, currencyCode }, db = realDb) {
  const id = cleanCustomerId(customerId);
  if (!id) throw new Error("setGoogleAdsAccount: a 10-digit customer id is required");
  return db.googleAdsConnection.update({
    where: { companyId },
    data: {
      customerId: id,
      loginCustomerId: cleanCustomerId(loginCustomerId),
      customerName: customerName ? String(customerName).slice(0, 200) : null,
      currencyCode: /^[A-Z]{3}$/.test(currencyCode || "") ? currencyCode : null,
      status: "connected",
      lastSyncError: null,
    },
  });
}

/**
 * Disconnect: the connection row goes (and with it the only copy of the
 * token). The MarketingSpend rows it imported STAY — they are the company's
 * spend history, and a disconnect is not a request to rewrite it.
 */
export async function deleteGoogleAdsConnection(companyId, db = realDb) {
  const existing = await db.googleAdsConnection.findUnique({ where: { companyId } });
  if (!existing) return null;
  await db.googleAdsConnection.delete({ where: { companyId } });
  return existing;
}

/** Stamped after every sync attempt, success or failure. */
export async function recordGoogleAdsSync(companyId, { status, error = null }, db = realDb) {
  try {
    await db.googleAdsConnection.update({
      where: { companyId },
      data: { status, lastSyncError: error ? String(error).slice(0, 500) : null, lastSyncedAt: new Date() },
    });
  } catch {
    // Disconnected mid-sync. Nothing to stamp.
  }
}

/** What the browser may see. No token, no ciphertext. */
export function publicGoogleAdsShape(row) {
  if (!row) return null;
  return {
    email: row.email || null,
    customerId: row.customerId || null,
    customerIdFormatted: formatCustomerId(row.customerId),
    viaManager: row.loginCustomerId ? formatCustomerId(row.loginCustomerId) : null,
    customerName: row.customerName || null,
    currencyCode: row.currencyCode || null,
    status: row.status || "connected",
    lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null,
    lastSyncError: row.lastSyncError || null,
    connectedAt: row.connectedAt ? new Date(row.connectedAt).toISOString() : null,
  };
}
