// app/components/sales/presenceBeat.js
//
// The portal's keepalive, browser side: which tabs are open, and the beat.
//
// ══ Why a tab registry ════════════════════════════════════════════════════
//
// The rule (lib/sales/calls/agentState.js): a rep is Off when no portal tab
// has beaten for two minutes, and a `leaving` beat may be sent only from
// the LAST tab closing — a rep with the queue in one tab and a lead in
// another does not go Off because they closed the lead. Tabs of one origin
// share localStorage, so each tab writes its id and the time under one key
// every REGISTRY_PING_MS, removes itself on pagehide, and asks the registry
// whether any OTHER id is fresh before saying goodbye. Unreadable storage
// (private mode, a stubbed window) answers "others may be alive", so the
// worst case is a rep who stays Available for two minutes after closing
// the tab — the ordinary expiry — never a rep marked Off with a tab open.
//
// The pure half (otherTabsAlive, prunedRegistry) is what
// scripts/check-sales-presence.mjs executes; the rest touches the window.

export const REGISTRY_KEY = "fieldquo.sales.tabs";
/** How often a tab re-stamps itself. */
export const REGISTRY_PING_MS = 30 * 1000;
/** A tab that has not stamped for this long is treated as gone (a crashed tab never runs pagehide). */
export const REGISTRY_TTL_MS = 90 * 1000;

/** A registry with the dead entries removed. Never throws on a bad shape. */
export function prunedRegistry(registry, now = Date.now(), ttlMs = REGISTRY_TTL_MS) {
  const r = registry && typeof registry === "object" ? registry : {};
  const out = {};
  for (const [id, at] of Object.entries(r)) {
    const t = Number(at);
    if (!id || !Number.isFinite(t)) continue;
    if (now - t <= ttlMs) out[id] = t;
  }
  return out;
}

/**
 * Is any tab OTHER than `myId` fresh? `null` registry — storage could not
 * be read — is "maybe", which the caller treats as yes.
 */
export function otherTabsAlive(registry, myId, now = Date.now(), ttlMs = REGISTRY_TTL_MS) {
  if (registry === null || registry === undefined) return true;
  const live = prunedRegistry(registry, now, ttlMs);
  return Object.keys(live).some((id) => id !== myId);
}

function readRegistry(storage) {
  try {
    const raw = storage.getItem(REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return null;
  }
}

function writeRegistry(storage, registry) {
  try {
    storage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    /* private mode; the tab is simply not registered */
  }
}

/** A fresh id for this tab. */
export function newTabId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Stamp this tab as alive. */
export function pingTab(myId, { storage = typeof localStorage === "undefined" ? null : localStorage, now = Date.now() } = {}) {
  if (!storage || !myId) return;
  const current = readRegistry(storage);
  if (current === null) return;
  writeRegistry(storage, { ...prunedRegistry(current, now), [myId]: now });
}

/** Remove this tab, and say whether any other is still alive (null storage → true). */
export function leaveTab(myId, { storage = typeof localStorage === "undefined" ? null : localStorage, now = Date.now() } = {}) {
  if (!storage || !myId) return true;
  const current = readRegistry(storage);
  if (current === null) return true;
  const rest = prunedRegistry(current, now);
  delete rest[myId];
  writeRegistry(storage, rest);
  return Object.keys(rest).length > 0;
}

/**
 * One beat. `leaving` uses sendBeacon so it survives the tab closing;
 * an ordinary beat is a fetch whose answer carries the derived presence.
 * Returns the body, or null when the beat could not be sent or read.
 */
export async function sendBeat({ leaving = false } = {}) {
  const payload = JSON.stringify({ leaving });
  if (leaving && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      navigator.sendBeacon("/api/sales/presence", new Blob([payload], { type: "application/json" }));
    } catch {
      /* the server expires us in two minutes regardless */
    }
    return null;
  }
  try {
    const res = await fetch("/api/sales/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: leaving,
    });
    if (!res.ok) {
      // A refusal with a code is an answer the provider acts on: the
      // session ended elsewhere (lib/sales/auth.js sessionSuperseded).
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { refused: true, status: res.status, code: data?.code || null, error: data?.error || null };
    }
    return await res.json();
  } catch {
    return null;
  }
}
