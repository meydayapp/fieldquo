// lib/i18n/contentHash.js
//
// A change detector that runs in the browser as well as on the server.
//
// lib/i18n/companyText.js's sourceHash() is sha1 through node:crypto, which
// is right for the texts only the server reads. The job-process wording a
// company edits in Settings › Services is read by resolveServiceContent
// (lib/documents/serviceContent.js), and that file is also imported by the
// quote builder in the browser — so the hash that decides "was this
// translation drafted from the wording the company has NOW?" has to be one
// both sides can compute. FNV-1a over the UTF-16 code units, twice with two
// offsets, printed as 16 hex characters: not a security hash, a staleness
// check, and a collision would need two different wordings of the same trade
// to land on the same 64 bits.

function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Stable hash of a string, or of any JSON-able value. */
export function contentHash(value) {
  const s = typeof value === "string" ? value.trim() : JSON.stringify(value ?? null);
  return fnv1a(s, 0x811c9dc5).toString(16).padStart(8, "0") + fnv1a(s, 0x01234567).toString(16).padStart(8, "0");
}

/**
 * The hash of one job-process override field, as the drafter stores it and
 * resolveServiceContent compares it. Steps are hashed as [title, body,
 * timeline] tuples rather than as objects because Postgres JSONB does not
 * keep object key order — the same step read back could stringify
 * differently and read as "changed" on every render.
 */
export function serviceContentHash(field, value) {
  if (field === "processSteps") {
    return contentHash((Array.isArray(value) ? value : []).map((s) => [s?.title || "", s?.body || "", s?.timeline || ""]));
  }
  if (field === "includedItems") return contentHash(Array.isArray(value) ? value.map((i) => String(i ?? "")) : []);
  return contentHash(typeof value === "string" ? value : "");
}
