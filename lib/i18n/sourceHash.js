// lib/i18n/sourceHash.js
//
// The change detector every stored translation is keyed on: sha1 of the
// trimmed source, 20 hex characters. Its own file so lib/i18n/companyText.js
// and lib/i18n/phrases.js can both use it without importing each other.
// Server-only (node:crypto); lib/i18n/contentHash.js is the browser-safe one.

import { createHash } from "node:crypto";

/** Short, stable, cheap. Not a security hash — a change detector. */
export function sourceHash(text) {
  return createHash("sha1").update(String(text ?? "").trim()).digest("hex").slice(0, 20);
}
