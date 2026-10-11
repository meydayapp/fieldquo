// lib/email/preferencesStore.js
//
// The database half of lib/email/preferences.js: EmailPreference rows, by user
// or by the token in an email's footer. Every function takes `client` so the
// check runs it against a recording stub; the routes and the lifecycle cron
// pass the real db.
//
// ── The token is stored, not derived ───────────────────────────────────────
//
// 32 CSPRNG bytes per row, unique — MarketingSubscriber.unsubscribeToken's
// shape, for the reason lib/marketing/unsubscribe.js writes down: a token
// derived from (user, secret) would mean one leaked secret rewrites every
// contractor's preferences at once; a stored random token bounds a leak to
// the one row it came from. The row is created the first time a letter that
// carries the link is built (ensurePreferenceRow), so "every commercial email
// has a working preferences link" is true for everybody, not only for the
// people who already opened the page.

import { randomBytes } from "node:crypto";
import { db as realDb } from "@/lib/db";
import { categoryAllowed, resolvePreferences, CHANGE_VIA } from "@/lib/email/preferences";

export function newPreferenceToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * The row for this user, creating it (with a token) when there is none.
 * Idempotent and race-safe: a concurrent create loses on the unique userId
 * and the winner's row is read back. Never touches an existing row's choices.
 */
export async function ensurePreferenceRow(userId, { client = realDb } = {}) {
  if (!userId) throw new Error("ensurePreferenceRow: no user.");
  const existing = await client.emailPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await client.emailPreference.create({ data: { userId, token: newPreferenceToken() } });
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const row = await client.emailPreference.findUnique({ where: { userId } });
    if (!row) throw err;
    return row;
  }
}

/** { row, user } for a footer token, or null. The user is read for consent and the masked address only. */
export async function loadByToken(token, { client = realDb } = {}) {
  if (typeof token !== "string" || !token) return null;
  const row = await client.emailPreference.findUnique({ where: { token } });
  if (!row) return null;
  const user = await client.user.findUnique({
    where: { id: row.userId },
    select: { id: true, email: true, language: true, marketingConsentAt: true },
  });
  if (!user) return null;
  return { row, user };
}

/** The effective preferences for a user id (row or not). */
export async function preferencesForUser(userId, { client = realDb } = {}) {
  const [row, user] = await Promise.all([
    client.emailPreference.findUnique({ where: { userId } }),
    client.user.findUnique({ where: { id: userId }, select: { id: true, email: true, language: true, marketingConsentAt: true } }),
  ]);
  if (!user) return null;
  return { row, user, prefs: resolvePreferences(row, user) };
}

/**
 * May FieldQuo send `category` to this user — read NOW, in the request that
 * sends. Transactional is always yes. A missing user is no.
 */
export async function userAllowsCategory(userId, category, { client = realDb } = {}) {
  if (!userId) return false;
  const found = await preferencesForUser(userId, { client });
  if (!found) return false;
  return categoryAllowed(category, found.row, found.user);
}

/**
 * Write a validated patch (validatePreferencePatch's `data`) onto the row,
 * creating it when needed. Returns the effective preferences after the write.
 */
export async function savePreferences(userId, data, { via, client = realDb, now = new Date() } = {}) {
  if (!CHANGE_VIA.includes(via)) throw new Error(`savePreferences: unknown change source "${via}"`);
  const row = await ensurePreferenceRow(userId, { client });
  const updated = await client.emailPreference.update({
    where: { id: row.id },
    data: { ...data, changedVia: via, changedAt: now },
  });
  const user = await client.user.findUnique({ where: { id: userId }, select: { marketingConsentAt: true } });
  return resolvePreferences(updated, user);
}
