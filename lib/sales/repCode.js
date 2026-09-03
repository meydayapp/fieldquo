// lib/sales/repCode.js
//
// What a sales rep's attribution code may look like. Two functions, no imports.
//
// ══ Why these two live apart from the rest of the invite flow ═════════════
//
// They were in lib/sales/invite.js, which is the right neighbourhood — a code
// is minted at the same moment an invitation is — and the wrong FILE, for one
// mechanical reason: invite.js imports `node:crypto` to hash an invite token,
// and the "Add rep" screen needs to prefill the code field as somebody types a
// name. A client component importing invite.js drags node:crypto into the
// browser bundle and the build refuses it.
//
// So the two pure, dependency-free functions move here and invite.js re-exports
// them, which keeps every existing importer — including
// scripts/check-sales-auth.mjs, which imports them BY NAME from invite.js —
// working unchanged. The alternative was a second copy of the slug rules on the
// screen, and a screen that disagrees with the server about what a valid code
// is would show a field going green over a value the server refuses.

/**
 * A rep's attribution code, derived from their name.
 *
 * Lowercase, hyphenated, ASCII only: it ends up in a query string on a public
 * signup URL, and a code that needs percent-encoding is a code somebody will
 * mistype off a business card. Uniqueness is the caller's job — SalesRep.code
 * is @unique and the route retries with a suffix rather than this function
 * guessing at a database it cannot see.
 */
export function codeFromName(name) {
  const slug = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  // A name that is entirely non-Latin leaves nothing behind. "rep" plus the
  // caller's uniqueness suffix is honest; an empty code would collide with
  // every other empty one and fail the unique index instead of saying why.
  return slug || "rep";
}

/** Is this a code a human could read off a card and type back correctly? */
export function isValidCode(code) {
  return /^[a-z0-9][a-z0-9-]{1,30}$/.test(String(code || ""));
}
