// lib/notify/pushSubscription.js
//
// The pure half of lib/notify/pushSubscriptionRoute.js — what a browser's
// subscription must look like, and how exactly one owner column is set.
// Its own file, with no next/server import, so
// scripts/check-browser-notifications.mjs can EXECUTE these against hostile
// input rather than read them.

export const OWNER_COLUMNS = ["userId", "salesRepId", "platformAdminId"];

/** Validates a browser's PushSubscription JSON. Returns null when malformed. */
export function parseSubscription(body) {
  const endpoint = String(body?.endpoint || "").trim();
  const p256dh = String(body?.keys?.p256dh || "").trim();
  const auth = String(body?.keys?.auth || "").trim();
  if (!/^https:\/\/.{10,2000}$/.test(endpoint)) return null;
  if (!p256dh || p256dh.length > 512 || !auth || auth.length > 128) return null;
  return { endpoint, keysP256dh: p256dh, keysAuth: auth };
}

/**
 * Exactly one owner column, set from the gate. Returns the data fragment
 * that sets that column and nulls the other two — so an upsert re-owning an
 * endpoint cannot leave a stale second owner on the row.
 */
export function ownerData(owner) {
  const set = OWNER_COLUMNS.filter((c) => owner?.[c]);
  if (set.length !== 1) return null;
  return Object.fromEntries(OWNER_COLUMNS.map((c) => [c, owner[c] || null]));
}

