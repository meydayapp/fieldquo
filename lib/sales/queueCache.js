// lib/sales/queueCache.js
//
// Two small caches for the sales queue, and why each is allowed to exist.
//
// ══ Server: sixty seconds of memory per warm function ═════════════════════
//
// /api/sales/queue GET was measured at p50 1.24 s, p90 2.17 s on
// 2026-09-17 (47 requests from the Vercel log, before this file). Half of
// that was work that does not change from one request to the next: the
// platform's calling-window overrides and retry rules (two tiny tables read
// on every load), and the 560,000-row GROUP BY that counts what is
// AVAILABLE per trade — which is the same number for every rep with the
// same language rule, and changes by a handful a minute. memo() keeps such
// an answer for TTL_MS in the function's own memory and hands the same
// promise to every caller that arrives while the read is in flight, so a
// rep's browser polling twice in a second costs one query, not two.
//
// It is NOT used for anything about a rep's own rows — those are read fresh
// every time, because a stale list is exactly the "my leads disappeared /
// came back" report this work exists to end — and it is NOT a substitute
// for the dial route reading overrides itself: a compliance decision at
// dial time reads the live rows. The queue shows; the dial decides.
//
// ══ Client: the last payload, shown while the fresh one loads ═════════════
//
// The owner: "it takes time for them to reload, even the ones that have been
// claimed, so they need to be cached." The browser keeps the last queue
// payload it saw in sessionStorage — per rep, per trade, per tab, gone when
// the tab closes — and draws it at once with a "refreshing…" hint while the
// real request is out. Every action that changes the queue (a claim, a
// release, an outcome) writes the payload it got back, so the snapshot is
// never older than the last thing the rep did. A snapshot older than
// SNAPSHOT_MAX_AGE_MS is not shown: half an hour is one calling-window
// change, and a list of rows that have since gone back is the disappearing
// act again.
//
// Both halves are pure functions over an injected clock and an injected
// storage, executed by scripts/check-queue-cache.mjs.

/** How long a memoised server read stands. */
export const TTL_MS = 60 * 1000;

/**
 * A memo over an async loader. `now` is injectable so a check can age it.
 *
 * `get(key, loader)` returns the cached value while it is younger than
 * `ttlMs`, the in-flight promise while a load is running, and otherwise
 * runs `loader()` and caches what it resolves to. A loader that throws
 * caches nothing — the next caller tries again — so one bad read does not
 * pin an error for a minute.
 */
export function createMemo({ ttlMs = TTL_MS, now = () => Date.now(), max = 200 } = {}) {
  const entries = new Map();
  const inflight = new Map();
  return {
    async get(key, loader) {
      const t = now();
      const hit = entries.get(key);
      if (hit && t - hit.at < ttlMs) return hit.value;
      if (inflight.has(key)) return inflight.get(key);
      const p = Promise.resolve()
        .then(loader)
        .then((value) => {
          entries.set(key, { at: now(), value });
          if (entries.size > max) entries.delete(entries.keys().next().value);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    /** Forget one key, or everything. */
    clear(key) {
      if (key === undefined) entries.clear();
      else entries.delete(key);
    },
    size() {
      return entries.size;
    },
  };
}

/** The one memo the queue route uses; module-level so a warm function keeps it. */
export const queueMemo = createMemo();

// ── Client snapshot ─────────────────────────────────────────────────────────

/** A snapshot older than this is not drawn. */
export const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;
/** sessionStorage key prefix; the rep pointer sits beside the snapshots. */
export const SNAPSHOT_PREFIX = "sales-queue:snapshot:";
export const SNAPSHOT_REP_KEY = "sales-queue:rep";

/** The storage key for one rep's one trade. */
export function snapshotKey({ repId, tradeKey = "" } = {}) {
  if (!repId) return null;
  return `${SNAPSHOT_PREFIX}${repId}:${tradeKey || "-"}`;
}

/**
 * Read the snapshot to draw first, or null.
 *
 * The rep is whoever the tab last saw (SNAPSHOT_REP_KEY): the page does not
 * know the rep before its first response, and a snapshot keyed by rep is
 * what keeps one rep's list from flashing on another rep's screen after a
 * sign-out in the same tab — the pointer moves with the sign-in. Refused
 * when: no rep pointer; nothing stored; older than `maxAgeMs`.
 *
 * When the URL names a prospect that is not the snapshot's current one, the
 * LIST is still right and is returned; `current` is nulled and
 * `currentMatches` is false, so the page draws the list at once and takes
 * the detail from the lead cache (readLead) or from the fresh response —
 * never another business's record under the named row's highlight.
 */
export function readSnapshot(storage, { tradeKey = "", prospectId = "", now = Date.now(), maxAgeMs = SNAPSHOT_MAX_AGE_MS } = {}) {
  try {
    const repId = storage?.getItem?.(SNAPSHOT_REP_KEY) || "";
    const key = snapshotKey({ repId, tradeKey });
    if (!key) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.body || typeof parsed.body !== "object") return null;
    if (!Number.isFinite(parsed.at) || now - parsed.at > maxAgeMs || parsed.at > now + 60_000) return null;
    if (parsed.body?.rep?.id !== repId) return null;
    const currentMatches = !prospectId || parsed.body?.current?.id === prospectId;
    const body = currentMatches ? parsed.body : { ...parsed.body, current: null };
    return { body, at: parsed.at, currentMatches };
  } catch {
    return null;
  }
}

/**
 * Keep a payload for the next paint. The rep pointer is written with it.
 * Nothing is thrown: a full or unavailable storage means no snapshot, and
 * the page loads the way it always did.
 */
export function writeSnapshot(storage, body, { tradeKey = "", now = Date.now() } = {}) {
  try {
    const repId = body?.rep?.id;
    const key = snapshotKey({ repId, tradeKey });
    if (!key || !storage?.setItem) return false;
    // `batch.result` is the sentence about the press that produced THIS
    // response ("claimed 25, 3 researched"); on a later paint it would
    // describe a press that did not just happen.
    const batch = body.batch ? { ...body.batch, result: null } : body.batch;
    storage.setItem(SNAPSHOT_REP_KEY, repId);
    storage.setItem(key, JSON.stringify({ at: now, body: { ...body, batch } }));
    return true;
  } catch {
    return false;
  }
}

/** Forget every snapshot this tab holds (sign-out, a rep switch). */
export function clearSnapshots(storage) {
  try {
    const keys = [];
    for (let i = 0; i < (storage?.length || 0); i++) {
      const k = storage.key(i);
      if (k && k.startsWith(SNAPSHOT_PREFIX)) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
    storage?.removeItem?.(SNAPSHOT_REP_KEY);
    return keys.length;
  } catch {
    return 0;
  }
}

// ── Client: one claimed lead, ready before it is opened ────────────────────
//
// The owner, 2026-09-17: the rep should open a claimed lead with zero
// network wait — the script, the brief, the talking points, the call
// history, the retry view — and only presence and the outcome writes should
// go to the server. So beside the list snapshot the tab keeps one entry per
// lead it has seen: the queue's `current` for that prospect, the playbook
// per script language, and the call history. The queue page writes an
// entry from every payload it gets, and PREFETCHES the next rows in dial
// order (LEAD_PREFETCH_AHEAD) so the row the dialler walks to next is
// already here. A lead never opened and not next in order still costs one
// request the first time; the report says so rather than the code
// pretending otherwise.
//
// Per rep (the key carries the rep id), per tab, gone with the tab. Aged
// out at LEAD_MAX_AGE_MS: a brief does not change in half an hour; a call
// history does, and every outcome write refreshes the entry on its way
// back.

/** A lead entry older than this is not drawn. */
export const LEAD_MAX_AGE_MS = 30 * 60 * 1000;
/** How many rows after the current one the page fetches ahead. */
export const LEAD_PREFETCH_AHEAD = 2;
/** At most this many lead entries per tab; the oldest goes when a new one arrives. */
export const LEAD_MAX_ENTRIES = 40;
export const LEAD_PREFIX = "sales-queue:lead:";
export const LEAD_INDEX_KEY = "sales-queue:lead-index";

export function leadKey({ repId, prospectId } = {}) {
  if (!repId || !prospectId) return null;
  return `${LEAD_PREFIX}${repId}:${prospectId}`;
}

/** The lead entry for this prospect, or null: `{ at, current, playbook, history }`. */
export function readLead(storage, { repId = null, prospectId = "", now = Date.now(), maxAgeMs = LEAD_MAX_AGE_MS } = {}) {
  try {
    const rep = repId || storage?.getItem?.(SNAPSHOT_REP_KEY) || "";
    const key = leadKey({ repId: rep, prospectId });
    if (!key) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.at) || now - parsed.at > maxAgeMs || parsed.at > now + 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Merge `patch` — any of `current`, `playbook: { [language]: body }`,
 * `history` — into the lead's entry and stamp it. The index keeps the
 * entries bounded: past LEAD_MAX_ENTRIES the oldest is removed.
 */
export function writeLead(storage, { repId, prospectId, now = Date.now() } = {}, patch = {}) {
  try {
    const key = leadKey({ repId, prospectId });
    if (!key || !storage?.setItem) return false;
    const have = readLead(storage, { repId, prospectId, now, maxAgeMs: Number.POSITIVE_INFINITY }) || {};
    const next = {
      at: now,
      current: patch.current !== undefined ? patch.current : have.current ?? null,
      playbook: { ...(have.playbook || {}), ...(patch.playbook || {}) },
      history: patch.history !== undefined ? patch.history : have.history ?? null,
    };
    storage.setItem(key, JSON.stringify(next));
    // The index: most recent last.
    let index = [];
    try {
      index = JSON.parse(storage.getItem(LEAD_INDEX_KEY) || "[]");
      if (!Array.isArray(index)) index = [];
    } catch {
      index = [];
    }
    index = index.filter((k) => k !== key);
    index.push(key);
    while (index.length > LEAD_MAX_ENTRIES) {
      const old = index.shift();
      try {
        storage.removeItem(old);
      } catch {
        // already gone
      }
    }
    storage.setItem(LEAD_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch {
    // Quota, private mode, no storage: the lead loads the way it always did.
    return false;
  }
}

/**
 * Which rows to fetch ahead: the next `ahead` ids after `currentId` in
 * `order` that have no fresh entry yet — pure. With no current, the head of
 * the order. Rows already cached are skipped, so a rep walking the list
 * costs at most `ahead` background requests per step.
 */
export function prefetchTargets({ order = [], currentId = null, ahead = LEAD_PREFETCH_AHEAD, cached = () => false } = {}) {
  const ids = (Array.isArray(order) ? order : []).map((o) => (typeof o === "string" ? o : o?.id)).filter(Boolean);
  const from = currentId ? ids.indexOf(currentId) + 1 : 0;
  const out = [];
  for (let i = from; i < ids.length && out.length < ahead; i++) {
    if (ids[i] === currentId) continue;
    if (cached(ids[i])) continue;
    out.push(ids[i]);
  }
  return out;
}

/** The tab's sessionStorage, or null where there is none (SSR, a locked-down browser). */
export function sessionStore() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** The rep this tab last saw a queue payload for, or null. */
export function currentRepId(storage) {
  try {
    return storage?.getItem?.(SNAPSHOT_REP_KEY) || null;
  } catch {
    return null;
  }
}
