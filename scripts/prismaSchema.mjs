// scripts/prismaSchema.mjs
//
// The one way a check reads prisma/schema.prisma with its comments removed.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Checks that wanted "the schema without its comments" each ran it through the
// JavaScript comment stripper they already had for source files:
//
//   src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
//
// Prisma has no block comments, so `/*` in a schema is literal text. A doc
// comment naming a glob (`app/data/serviceSeeds/*`) paired with a `*/` inside
// `accounts/*/locations/*` ~8,500 lines later, and the stripper deleted
// everything between: 133 of 353 models and enums, Subscription and SmsOptOut
// among them. Three checks failed for it (6eae21eb); a fourth
// (check-sales-sms) kept passing only because the model it asserts on sits
// below the hole. Each fix was a different hand-written regex, and the one
// that stayed `(^|[^:])\/\/.*$` still cuts a string literal containing `//`
// anywhere but after a colon.
//
// So: one lexer, here. It walks each line, skips over "double-quoted strings"
// (Prisma strings never span lines, and `\"` escapes a quote), and cuts at the
// first `//` outside a string — which covers `///` doc comments too, since
// they begin with `//`. The line itself is kept (empty if it was only a
// comment) so line numbers still match the file, and whitespace left before
// a cut comment is trimmed, so `field Type @attr // note` reads exactly like
// `field Type @attr` to a regex anchored on `\n`.
//
// readPrismaSchema() also REFUSES to hand back a schema that lost a
// declaration: every `model`/`enum`/`type`/`view` line in the raw file must
// survive stripping. A declaration can never be inside a comment (a
// commented-out one starts with `//` and is not a declaration line), so a
// mismatch can only mean the stripper ate code — the failure above, which
// then passed or failed checks silently for weeks.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SCHEMA_PATH = join(REPO, "prisma", "schema.prisma");

/** One line: the index where a `//` comment starts outside a string, or -1. */
function commentStart(line) {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inString) {
      if (c === "\\") i++; // skip the escaped character, `\"` included
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "/" && line[i + 1] === "/") {
      return i;
    }
  }
  return -1;
}

/**
 * Remove every Prisma comment (`//` and `///`) from schema text. `/*` is left
 * alone because Prisma has no block comments. Line count is preserved.
 */
export function stripPrismaComments(src) {
  return String(src ?? "")
    .split("\n")
    .map((line) => {
      const at = commentStart(line);
      return at < 0 ? line : line.slice(0, at).replace(/[ \t]+$/, "");
    })
    .join("\n");
}

const DECLARATION = /^(model|enum|type|view)\s+(\w+)/gm;
const declarations = (src) => [...src.matchAll(DECLARATION)].map((m) => `${m[1]} ${m[2]}`);

/**
 * prisma/schema.prisma, comments removed, verified to have lost no model,
 * enum, type or view. Throws rather than returning a shorter schema.
 *
 * @param {object} [o]
 * @param {boolean} [o.comments=false] true returns the raw text unchanged
 * @param {string}  [o.path]           another schema file (used by tests)
 */
export function readPrismaSchema({ comments = false, path = SCHEMA_PATH } = {}) {
  const raw = readFileSync(path, "utf8");
  if (comments) return raw;
  const stripped = stripPrismaComments(raw);
  const before = declarations(raw);
  const after = new Set(declarations(stripped));
  const lost = before.filter((d) => !after.has(d));
  if (lost.length) {
    throw new Error(
      `stripPrismaComments lost ${lost.length} declaration(s) from ${path}: ${lost.slice(0, 5).join(", ")}` +
        (lost.length > 5 ? ", …" : ""),
    );
  }
  return stripped;
}
