// lib/offline/store.js
//
// The phone-side queue: one IndexedDB object store, `queue`, keyed by the
// client-minted key. No library — the whole API this needs is get/put/
// delete/getAll, and a dependency here would be a dependency inside the
// Capacitor shell on branch `mobile` too.
//
// `memoryStore()` is the same interface without IndexedDB, for the check
// script and for the SSR pass (nothing on the server ever touches this, but
// a module that throws at import time on `indexedDB` would break the page
// it is imported into).

const DB_NAME = "fieldquo-offline";
const DB_VERSION = 1;
const STORE = "queue";

// Reached through globalThis rather than as a bare identifier: this module
// is imported by a page that also renders on the server, where indexedDB is
// not a global, and the repo's no-undef lint has no browser-storage globals.
const idb = () => globalThis.indexedDB;

export function idbAvailable() {
  return typeof idb() !== "undefined";
}

function open() {
  return new Promise((resolve, reject) => {
    const req = idb().open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "key" });
        os.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB refused to open"));
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const os = t.objectStore(STORE);
    let out;
    try {
      const r = fn(os);
      if (r && typeof r.onsuccess !== "undefined") {
        r.onsuccess = () => {
          out = r.result;
        };
        r.onerror = () => reject(r.error);
      } else {
        out = r;
      }
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("aborted"));
  });
}

/** The IndexedDB-backed store. Every method resolves; a broken IDB rejects. */
export function idbStore() {
  let dbp = null;
  const db = () => (dbp ||= open());
  return {
    async list() {
      const rows = await tx(await db(), "readonly", (os) => os.getAll());
      return (rows || []).sort((a, b) => a.createdAt - b.createdAt);
    },
    async get(key) {
      return tx(await db(), "readonly", (os) => os.get(key));
    },
    async put(item) {
      await tx(await db(), "readwrite", (os) => os.put(item));
      return item;
    },
    async remove(key) {
      await tx(await db(), "readwrite", (os) => os.delete(key));
    },
  };
}

/** Same interface, in memory. For checks and for a browser with no IndexedDB. */
export function memoryStore(initial = []) {
  const map = new Map(initial.map((i) => [i.key, i]));
  return {
    async list() {
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async get(key) {
      return map.get(key);
    },
    async put(item) {
      map.set(item.key, item);
      return item;
    },
    async remove(key) {
      map.delete(key);
    },
  };
}
