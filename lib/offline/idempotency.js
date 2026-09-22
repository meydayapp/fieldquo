// lib/offline/idempotency.js
//
// "Server wins": replaying an offline write twice creates one record.
//
// The phone queues a write under a client-generated key (lib/offline/queue.js)
// and sends it as the X-Offline-Key header when it replays. A route that
// supports replay wraps its write in withOfflineKey(): the key is looked up
// first, and if a previous replay already landed, the stored entity id is
// returned and NOTHING is written. Otherwise the write runs inside a
// transaction that also inserts the key, so a race between two replays of
// the same key ends in one P2002 and one record — never two invoices.
//
// The key is only ever a lookup. The record's id is the server's; the phone
// learns it from the response and forgets its own key.
//
// ── Why a header, not a body field ────────────────────────────────────────
//
// The body is the same body the online page posts. A route that reads the
// key from the header can add replay support without changing what it
// accepts, and a body validator never has to know the field exists.

export const OFFLINE_KEY_HEADER = "x-offline-key";

/** A key is a client-minted id: printable, bounded, no whitespace. */
export function validOfflineKey(key) {
  return typeof key === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(key);
}

/** The key on a request, or null when this is an ordinary online write. */
export function readOfflineKey(request) {
  const raw = request?.headers?.get?.(OFFLINE_KEY_HEADER);
  return validOfflineKey(raw) ? raw : null;
}

/**
 * Run `write(tx)` once for this key.
 *
 * @param {object} p
 * @param {import("@prisma/client").PrismaClient} p.db
 * @param {string} p.companyId
 * @param {string} p.memberId
 * @param {string|null} p.key   null → no idempotency, `write` runs on `db` directly
 * @param {string} p.kind       invoice | timesheet | photo
 * @param {(tx) => Promise<{ entityId: string, result: any }>} write
 *        Must return the created entity's id; `result` is handed back to the
 *        caller (the response body it wants to send).
 * @returns {Promise<{ replayed: boolean, entityId: string|null, result: any }>}
 *          `replayed: true` means an earlier replay already wrote it and
 *          `result` is null — the caller re-reads the entity by id.
 */
export async function withOfflineKey({ db, companyId, memberId, key, kind }, write) {
  if (!key) {
    const out = await write(db);
    return { replayed: false, entityId: out?.entityId ?? null, result: out?.result };
  }

  const seen = await db.offlineSyncItem.findUnique({
    where: { companyId_clientKey: { companyId, clientKey: key } },
    select: { entityId: true, status: true, error: true },
  });
  if (seen) {
    return { replayed: true, entityId: seen.entityId, result: null, status: seen.status, error: seen.error };
  }

  try {
    return await db.$transaction(async (tx) => {
      const out = await write(tx);
      await tx.offlineSyncItem.create({
        data: { companyId, memberId, clientKey: key, kind, entityId: out?.entityId ?? null, status: "synced" },
      });
      return { replayed: false, entityId: out?.entityId ?? null, result: out?.result };
    });
  } catch (err) {
    // Two replays raced: the other one won and its row is now there. Answer
    // with that row rather than a 500 the phone would retry forever.
    if (err?.code === "P2002") {
      const winner = await db.offlineSyncItem.findUnique({
        where: { companyId_clientKey: { companyId, clientKey: key } },
        select: { entityId: true, status: true, error: true },
      });
      if (winner) return { replayed: true, entityId: winner.entityId, result: null, status: winner.status, error: winner.error };
    }
    throw err;
  }
}

/**
 * Record a replay the server REFUSED for a reason the phone cannot fix by
 * retrying (a client that no longer exists, a punch out of order). Without
 * this, the same key comes back every time the phone gets signal; with it,
 * the next attempt answers "needs attention" from the ledger and the phone
 * stops. Never throws — the refusal is the response, this is bookkeeping.
 */
export async function recordOfflineRefusal({ db, companyId, memberId, key, kind, error }) {
  if (!key) return;
  try {
    await db.offlineSyncItem.upsert({
      where: { companyId_clientKey: { companyId, clientKey: key } },
      create: { companyId, memberId, clientKey: key, kind, status: "failed", error: String(error || "").slice(0, 500) },
      update: {},
    });
  } catch {
    /* bookkeeping only */
  }
}
