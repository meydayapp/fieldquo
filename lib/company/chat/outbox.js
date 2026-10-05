// lib/company/chat/outbox.js
//
// The phone's outbox for team-chat TEXT: words typed in a basement with no
// signal are kept, shown in the thread as "waiting", and sent when the phone
// is back online — on the browser's `online` event, on the tab coming back,
// and on every poll of the open room.
//
// ══ Why its own small outbox and not lib/offline/queue.js ═════════════════
//
// The offline queue is the invoicing/timesheet replay, with its own bar and
// its own counts; a chat line is not "an invoice waiting", and adding a
// fourth kind there would put chat into a summary that means something
// else. What IS shared is the server half: every send carries its key as
// X-Offline-Key and the room route answers a replay from the same ledger
// (lib/offline/idempotency.js, OfflineSyncItem kind "chat"), so a send whose
// answer was lost is replayed as the SAME message, never a second one.
//
// Text only. A photo is uploaded straight to Cloudinary before the message
// is sent, which needs the connection the outbox is waiting for; the
// composer says so instead of pretending to queue it.
//
// ══ Whose outbox ══════════════════════════════════════════════════════════
//
// Kept in localStorage under the MEMBER's id, so a shared office computer
// never replays one person's words under the next person's session — the
// server would post them as whoever is signed in. Every read and write is
// wrapped: private windows and full storage throw, and then the outbox lives
// in memory only for the life of the tab, which is still better than losing
// the words at the first failed send.
import { mintKey } from "@/lib/offline/queue";
import { FETCH_ERROR_KEYS } from "@/lib/fetchJson";

const PREFIX = "fq.companyChat.outbox.v1.";
/** Never more than this many lines waiting: a stuck outbox must not grow forever. */
export const OUTBOX_MAX = 50;

/** A fetchJson error that never reached the server — as opposed to a refusal. */
export function isOfflineError(err) {
  if (!err) return false;
  if (typeof err.status === "number" && err.status > 0) return false;
  return err.i18nKey === FETCH_ERROR_KEYS.network || err.name === "TypeError" || err.cause?.name === "TypeError" || /reach the server/i.test(String(err.message || ""));
}

export function loadOutbox(memberId) {
  if (!memberId) return [];
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + memberId);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.key === "string" && typeof x.roomId === "string" && typeof x.body === "string") : [];
  } catch {
    return [];
  }
}

export function saveOutbox(memberId, list) {
  if (!memberId) return;
  try {
    globalThis.localStorage?.setItem(PREFIX + memberId, JSON.stringify((list || []).slice(-OUTBOX_MAX)));
  } catch {
    /* storage refused: the in-memory copy carries on */
  }
}

/** A new waiting line. */
export function outboxItem({ roomId, body, replyToId = null }, { now = Date.now(), random } = {}) {
  return { key: mintKey(random), roomId, body, replyToId: replyToId || null, at: new Date(now).toISOString(), status: "queued", error: null };
}
