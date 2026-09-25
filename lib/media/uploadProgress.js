// lib/media/uploadProgress.js
//
// Which uploads are in flight, and how far along — the one store the one
// progress UI (app/components/UploadProgress.js) reads.
//
// A module-level store rather than a React context because the thing that
// knows the progress is lib/media/uploadClient.js, which is called from
// thirty-odd places, some of them not components at all (the offline queue).
// Threading an onProgress prop through each would be thirty chances to forget
// one; every upload through the helper reports here without being asked.
//
// No React, no DOM — plain subscribe/getSnapshot for useSyncExternalStore.

let uploads = [];
const listeners = new Set();
let nextId = 1;

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeUploads(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The in-flight list. A new array on every change, so React sees one. */
export function getUploadsSnapshot() {
  return uploads;
}

const EMPTY = [];
/** The server render has nothing in flight. */
export function getServerUploadsSnapshot() {
  return EMPTY;
}

/** @returns {number} an id for updateUpload / endUpload */
export function beginUpload(name, total) {
  const id = nextId++;
  uploads = [...uploads, { id, name: String(name || ""), loaded: 0, total: Number(total) || 0 }];
  emit();
  return id;
}

export function updateUpload(id, loaded, total) {
  uploads = uploads.map((u) =>
    u.id === id ? { ...u, loaded: Number(loaded) || 0, total: Number(total) || u.total } : u,
  );
  emit();
}

export function endUpload(id) {
  uploads = uploads.filter((u) => u.id !== id);
  emit();
}

// ── One visible host ────────────────────────────────────────────────────────
//
// The progress UI is mounted in the /app shell AND inside the shared uploader
// (which also runs on the public forms and the portal, where there is no /app
// shell). On an /app page with an uploader both are mounted; only the first to
// mount draws, so there is exactly one bar on screen, never two.
let hosts = [];
const hostListeners = new Set();

export function registerProgressHost(token) {
  hosts = [...hosts, token];
  for (const fn of hostListeners) fn();
  return () => {
    hosts = hosts.filter((t) => t !== token);
    for (const fn of hostListeners) fn();
  };
}

export function subscribeHosts(fn) {
  hostListeners.add(fn);
  return () => hostListeners.delete(fn);
}

export function activeProgressHost() {
  return hosts[0] || null;
}
