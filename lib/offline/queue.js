// lib/offline/queue.js
//
// What the phone does with a write it cannot send.
//
// ── One queue, three kinds ────────────────────────────────────────────────
//
//   invoice    the body /app/invoices/new would have posted, minus every
//              amount the server derives (see lib/invoices/labourLine.js —
//              the labour block is ids and a rate key), plus the keys of any
//              photos picked while offline
//   photo      a File the person attached while offline, uploaded first at
//              replay so the invoice can carry the Cloudinary URL
//   timesheet  a punch — in / out / switch — with the moment it was tapped,
//              because the server's "now" at replay is not when they clocked
//
// Every item has a client-minted `key`. It travels as X-Offline-Key and the
// server's lib/offline/idempotency.js makes a second replay of the same key
// a no-op. The phone keeps the item until the server answers, so a lost
// response is replayed, not lost — and answered from the ledger.
//
// ── Who wins ──────────────────────────────────────────────────────────────
//
// The server. The phone never invents an id: once the server answers with
// one, the item records it as `serverId` and shows "Synced ✓". A refusal the
// phone cannot fix (a 4xx — the client was deleted, the punch is out of
// order) is "Needs attention" with the server's sentence; a 5xx or a dropped
// connection is a retry. Nothing here ever deletes a queued item on its own.
//
// ── Why the replay is here and not in the service worker ──────────────────
//
// public/sw.js cannot import this module (it is a Next bundle), and a second
// copy of the replay in the worker would be the copy that rots. The worker's
// only job in the sync is to wake a tab (it posts { type: "fq:sync" } on the
// Background Sync event); the tab runs this. A phone with no tab open syncs
// on the next open — the bar says so.
//
// Pure where it can be: ordering, summaries and response classification take
// plain arrays so scripts/check-offline-invoicing.mjs can execute them; the
// I/O takes an injected `fetch` and `store` for the same reason.

export const QUEUE_KINDS = ["invoice", "photo", "timesheet"];

const MAX_RETRIES = 5;
const KEEP_SYNCED_MS = 24 * 60 * 60 * 1000;

/** A key the server's validOfflineKey() accepts: 8–80 of [A-Za-z0-9_-]. */
export function mintKey(random = Math.random) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "q";
  for (let i = 0; i < 23; i++) s += alphabet[Math.floor(random() * alphabet.length)];
  return s;
}

/** What the bar says: how many of each kind are still waiting, and what failed. */
export function summarise(items) {
  const out = { invoices: 0, timesheets: 0, photos: 0, failed: 0, synced: 0, total: 0 };
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || !QUEUE_KINDS.includes(it.kind)) continue;
    if (it.status === "synced") {
      out.synced++;
      continue;
    }
    if (it.status === "failed") {
      out.failed++;
      continue;
    }
    // A photo belongs to an invoice; the bar counts what the person made.
    if (it.kind === "invoice") out.invoices++;
    else if (it.kind === "timesheet") out.timesheets++;
    else out.photos++;
  }
  out.total = out.invoices + out.timesheets;
  return out;
}

/**
 * The order a replay runs in. Punches first, in the order they were tapped
 * (an "out" replayed before its "in" is refused); then photos; then invoices,
 * whose photo URLs the uploads above just produced.
 */
export function orderForReplay(items) {
  const rank = { timesheet: 0, photo: 1, invoice: 2 };
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.status === "queued")
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.createdAt - b.createdAt);
}

/**
 * What a response status means for the item.
 *   ok        → synced
 *   refused   → 4xx the phone cannot fix: needs attention
 *   retry     → 5xx / 429: keep it, try later
 */
export function classifyResponse(status) {
  if (status >= 200 && status < 300) return "ok";
  if (status === 429 || status >= 500) return "retry";
  return "refused";
}

/** A fetch that threw (no signal, DNS, aborted) — as opposed to a response. */
export function isNetworkFailure(err) {
  return err instanceof TypeError || err?.name === "TypeError" || err?.name === "AbortError";
}

/** Build a queue item. Blobs (photos) ride in `payload.blob`; IndexedDB stores them. */
export function makeItem(kind, payload, { key = mintKey(), now = Date.now() } = {}) {
  if (!QUEUE_KINDS.includes(kind)) throw new Error(`unknown queue kind: ${kind}`);
  return { key, kind, payload, status: "queued", attempts: 0, error: null, serverId: null, createdAt: now, syncedAt: null };
}

async function readError(res, fallback) {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    /* not JSON */
  }
  return fallback;
}

/**
 * Replay everything queued. Stops at the first network failure (still
 * offline) and leaves the rest queued. Returns what changed so the bar can
 * say "2 invoices sent, 3 timesheets saved" or "1 needs attention".
 *
 * @param {object} p
 * @param {{list, get, put, remove}} p.store   lib/offline/store.js
 * @param {typeof fetch} p.fetch
 * @param {number} [p.now]
 * @param {(item) => void} [p.onChange]        called after each item's state changes
 * @returns {Promise<{ synced: object[], failed: object[], stoppedOffline: boolean }>}
 */
export async function replayQueue({ store, fetch, now = Date.now(), onChange = () => {} }) {
  const all = await store.list();
  const synced = [];
  const failed = [];
  let stoppedOffline = false;

  // House-keeping: a synced item older than a day has been shown; drop it.
  for (const it of all) {
    if (it.status === "synced" && it.syncedAt && now - it.syncedAt > KEEP_SYNCED_MS) {
      await store.remove(it.key);
    }
  }

  for (const item of orderForReplay(all)) {
    const fresh = (await store.get(item.key)) || item;
    if (fresh.status !== "queued") continue;
    let outcome;
    try {
      outcome = await replayOne(fresh, { store, fetch, now });
    } catch (err) {
      if (isNetworkFailure(err)) {
        stoppedOffline = true;
        break;
      }
      outcome = { status: "retry", error: err?.message || "Could not sync." };
    }
    const next = { ...fresh, attempts: fresh.attempts + 1 };
    if (outcome.status === "ok") {
      next.status = "synced";
      next.serverId = outcome.serverId ?? next.serverId;
      next.syncedAt = now;
      next.error = outcome.warning || null;
      if (outcome.payload) next.payload = outcome.payload;
      synced.push(next);
    } else if (outcome.status === "refused" || next.attempts >= MAX_RETRIES) {
      next.status = "failed";
      next.error = outcome.error || "The server refused it.";
      failed.push(next);
    } else {
      next.error = outcome.error || null;
      if (outcome.payload) next.payload = outcome.payload;
    }
    await store.put(next);
    onChange(next);
  }
  return { synced, failed, stoppedOffline };
}

async function replayOne(item, ctx) {
  if (item.kind === "photo") return replayPhoto(item, ctx);
  if (item.kind === "timesheet") return replayTimesheet(item, ctx);
  return replayInvoice(item, ctx);
}

async function replayPhoto(item, { fetch }) {
  const { blob, name } = item.payload || {};
  if (!blob) return { status: "refused", error: "The photo is no longer on this phone." };
  const fd = new FormData();
  fd.append("file", blob, name || "photo.jpg");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const verdict = classifyResponse(res.status);
  if (verdict !== "ok") return { status: verdict, error: await readError(res, `Upload failed (${res.status}).`) };
  const data = await res.json().catch(() => null);
  if (!data?.url) return { status: "refused", error: "Upload answered without a URL." };
  // The blob has done its job; keep the URL, drop the bytes.
  return {
    status: "ok",
    serverId: data.publicId || data.url,
    payload: { name, url: data.url, kind: data.kind || "photo", publicId: data.publicId || null },
  };
}

async function replayTimesheet(item, { fetch }) {
  const p = item.payload || {};
  const res = await fetch("/api/time-clock", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Offline-Key": item.key },
    body: JSON.stringify({
      action: p.action,
      ...(p.action === "out" ? {} : { jobId: p.jobId || null }),
      ...(p.kind ? { kind: p.kind } : {}),
      ...(p.stamp ? { stamp: p.stamp } : {}),
      at: p.at,
    }),
  });
  const verdict = classifyResponse(res.status);
  if (verdict !== "ok") return { status: verdict, error: await readError(res, `Refused (${res.status}).`) };
  const data = await res.json().catch(() => ({}));
  return { status: "ok", serverId: data?.open?.id || data?.entry?.id || null };
}

async function replayInvoice(item, { store, fetch }) {
  const p = item.payload || {};
  // Photos first. A photo that failed for good fails the invoice's photos
  // only — the invoice still goes, without it, and the warning says so.
  const photoUrls = [];
  let photoWarning = null;
  for (const key of Array.isArray(p.photoKeys) ? p.photoKeys : []) {
    const photo = await store.get(key);
    if (!photo) continue;
    if (photo.status === "synced" && photo.payload?.url) {
      photoUrls.push({ url: photo.payload.url, kind: photo.payload.kind || "photo", publicId: photo.payload.publicId || null });
      continue;
    }
    if (photo.status === "failed") {
      photoWarning = "A photo could not be uploaded and was left off.";
      continue;
    }
    // Still queued: upload it now, in this pass.
    const out = await replayPhoto(photo, { fetch });
    const next = { ...photo, attempts: photo.attempts + 1 };
    if (out.status === "ok") {
      Object.assign(next, { status: "synced", serverId: out.serverId, payload: out.payload, syncedAt: Date.now() });
      photoUrls.push({ url: out.payload.url, kind: out.payload.kind, publicId: out.payload.publicId });
    } else if (out.status === "refused" || next.attempts >= MAX_RETRIES) {
      Object.assign(next, { status: "failed", error: out.error });
      photoWarning = "A photo could not be uploaded and was left off.";
    } else {
      // A 5xx on the upload: the invoice waits with it.
      await store.put(next);
      return { status: "retry", error: out.error };
    }
    await store.put(next);
  }

  // Stage 1: create. Idempotent on the key — a lost response is replayed
  // and answered from the server's ledger with the same invoice id.
  let invoiceId = p.serverInvoiceId || null;
  if (!invoiceId) {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Offline-Key": item.key },
      body: JSON.stringify(invoiceBodyFrom(p, [...(p.clientPhotos || []), ...photoUrls])),
    });
    const verdict = classifyResponse(res.status);
    if (verdict !== "ok") return { status: verdict, error: await readError(res, `Refused (${res.status}).`) };
    const data = await res.json().catch(() => null);
    if (!data?.id) return { status: "refused", error: "The server answered without an invoice id." };
    invoiceId = data.id;
    // Remember the id BEFORE the send, so a send that fails does not create a
    // second invoice on the next pass.
    await store.put({ ...item, payload: { ...p, serverInvoiceId: invoiceId } });
  }

  // Stage 2: send, when asked. Not idempotent on the server, so a lost
  // response here could mean one email twice — accepted, and rarer than a
  // lost invoice.
  if (p.send) {
    const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
    const verdict = classifyResponse(res.status);
    if (verdict === "retry") return { status: "retry", error: await readError(res, "Send failed; will retry."), payload: { ...p, serverInvoiceId: invoiceId } };
    if (verdict === "refused") {
      // The invoice exists as a draft. That is a synced item with a warning,
      // not a failure that would replay the creation.
      return {
        status: "ok",
        serverId: invoiceId,
        warning: `Saved as a draft — ${await readError(res, "the email could not be sent.")}`,
        payload: { ...p, serverInvoiceId: invoiceId, send: false },
      };
    }
  }
  return { status: "ok", serverId: invoiceId, warning: photoWarning, payload: { ...p, serverInvoiceId: invoiceId } };
}

/**
 * The POST /api/invoices body from a queued payload. No `subtotal`, `tax`
 * or `total`: the route derives all three when `offline: true` (see the
 * route) — and the labour block is ids plus a rate key.
 */
export function invoiceBodyFrom(p, clientPhotos) {
  return {
    offline: true,
    clientId: p.clientId,
    ...(p.jobId ? { jobId: p.jobId } : {}),
    lineItems: (Array.isArray(p.lineItems) ? p.lineItems : []).map((li) => ({
      description: String(li.description || ""),
      quantity: Number(li.quantity) || 0,
      unit: li.unit || "flat",
      rate: Number(li.rate) || 0,
      amount: Number(li.amount) || 0,
    })),
    ...(p.labour ? { labour: { timeEntryIds: p.labour.timeEntryIds, rateKey: p.labour.rateKey } } : {}),
    taxEnabled: p.taxEnabled !== false,
    notes: p.notes || "",
    dueDate: p.dueDate || null,
    clientPhotos,
    language: p.language || undefined,
  };
}
