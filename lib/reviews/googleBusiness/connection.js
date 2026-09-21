// lib/reviews/googleBusiness/connection.js
//
// The CompanyGoogleBusiness row: every read and write in one file, taking
// `db` as an argument (defaulting to the real client) so the check executes
// these against scripts/fixtures/memoryPrisma.mjs. Same shape as
// lib/calendar/googleConnection.js, and the same rule about what leaves the
// server: publicShape() carries no token and no ciphertext.

import { db as realDb } from "@/lib/db";
import { encryptToken } from "@/lib/meta/tokenCrypto";

export const REVIEWS_SETTINGS_PATH = "/app/settings/reviews";

export async function getBusinessConnection(companyId, db = realDb) {
  if (!companyId) return null;
  return db.companyGoogleBusiness.findUnique({ where: { companyId } });
}

/** Connect, or reconnect: the fresh refresh token replaces the old one, the location choice is kept. */
export async function saveBusinessConnection({ companyId, refreshToken, email, memberId }, db = realDb) {
  const refreshTokenEnc = encryptToken(refreshToken);
  return db.companyGoogleBusiness.upsert({
    where: { companyId },
    create: {
      companyId,
      refreshTokenEnc,
      email: email || null,
      connectedByMemberId: memberId || null,
      connectedAt: new Date(),
      lastError: null,
    },
    update: {
      refreshTokenEnc,
      email: email || null,
      connectedByMemberId: memberId || null,
      connectedAt: new Date(),
      lastError: null,
    },
  });
}

/** The location the company picked from its account's list. */
export async function setBusinessLocation(companyId, { accountName, locationName, locationTitle }, db = realDb) {
  return db.companyGoogleBusiness.update({
    where: { companyId },
    data: { accountName, locationName, locationTitle: locationTitle || null, lastError: null },
  });
}

/**
 * Disconnect: the row goes, and so does every cached review — the cache
 * exists only under the connection's authority, and a company that has
 * revoked it must not keep Google's content on its website.
 */
export async function deleteBusinessConnection(companyId, db = realDb) {
  const existing = await db.companyGoogleBusiness.findUnique({ where: { companyId } });
  if (!existing) return null;
  await db.googleReview.deleteMany({ where: { companyId } });
  await db.companyGoogleBusiness.delete({ where: { companyId } });
  return existing;
}

export async function recordBusinessSyncOutcome(companyId, { error = null } = {}, db = realDb) {
  try {
    await db.companyGoogleBusiness.update({
      where: { companyId },
      data: error ? { lastError: String(error).slice(0, 500) } : { lastError: null, lastSyncAt: new Date() },
    });
  } catch {
    // Disconnected mid-sync. Nothing to stamp.
  }
}

/** What the browser may see. No token, no ciphertext. */
export function publicBusinessShape(row) {
  if (!row) return null;
  return {
    email: row.email || null,
    accountName: row.accountName || null,
    locationName: row.locationName || null,
    locationTitle: row.locationTitle || null,
    connectedAt: row.connectedAt ? new Date(row.connectedAt).toISOString() : null,
    lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt).toISOString() : null,
    lastError: row.lastError || null,
  };
}
