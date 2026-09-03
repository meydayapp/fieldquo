// lib/sales/notes/body.js
//
// What a note's text is, what it is allowed to be, and the honest record of
// what the editor turned out to be.
//
// ══ THE EDITOR: BlockNote does not install. A textarea shipped. ════════════
//
// The decision handed to this work was BlockNote → JSON → Postgres, autosave,
// no realtime, and it came with an instruction to verify the packages first
// and to ship a textarea if they would not go in cleanly. They will not, and
// the reason is upstream and not fixable from here.
//
// Measured on 2026-09-02 with npm 10.8.2, in an isolated directory pinned to
// FieldQuo's own react@19.2.4 / lucide-react@^1.23.0 / @base-ui/react@^1.6.0 /
// tailwindcss@4:
//
//   $ npm install @blocknote/core
//   npm error ERESOLVE unable to resolve dependency tree
//   npm error Found: @y/y@undefined
//   npm error   peer @y/y@"*" from @y/protocols@1.0.6-rc.1
//   npm error Could not resolve dependency:
//   npm error peerOptional @y/y@"^14.0.0-rc.23" from @blocknote/core@0.54.0
//
// The chain, because the shape of it is what makes it unfixable here.
// @blocknote/core declares six Yjs peers, all marked optional — which is what
// docs/construction/AUDIT-realtime-hosting.md §4 read the registry metadata and
// concluded from. But `optional` only means "do not error when it is ABSENT";
// npm still has to place the ones that are reachable, and @y/protocols
// declares a NON-optional `peer @y/y@"*"`. Every published @y/y is a
// prerelease (14.0.0-rc.6 … rc.24), and a bare `*` range does not match
// prereleases. So @y/y resolves to nothing and the tree is unsatisfiable.
//
// This is not about collaboration being switched on. `@blocknote/core` ALONE,
// with no provider, no @blocknote/react and no editor code anywhere, fails.
// 0.53.0 and 0.52.1 fail identically. There is no version that installs.
//
// Two escapes exist and both were tested, and both are repo-wide:
//
//   --legacy-peer-deps   installs (50 packages, and Yjs genuinely absent) but
//                        changes peer resolution for all ~300 dependencies and
//                        has to be permanent — an .npmrc, and Vercel's build.
//   overrides            a three-line `"overrides": {"@y/protocols": {"@y/y":
//                        "14.0.0-rc.24"}}` makes plain `npm install` work. Also
//                        permanent, also project-wide, and it pins a
//                        release-candidate of a library this product does not
//                        use.
//
// Either would mean one of twelve concurrent agents rewriting package-lock.json
// and the project's install semantics to add a note editor. If a later commit
// touched the lockfile without carrying the overrides block, `npm install`
// would stop working for everyone. That is not a trade this feature is worth.
//
// One more measured fact, since the audit flagged it as needing checking:
// @blocknote/shadcn does pull a SECOND copy of the icon library —
// node_modules/@blocknote/shadcn/node_modules/lucide-react@0.525.0 alongside
// the root's 1.39.0. Confirmed, not inferred.
//
// So: a textarea. It autosaves, it says whether it saved, it keeps a local
// draft when the network is gone, and it is guarded against overwriting a
// colleague. Every one of those is a property BlockNote would not have given
// for free. What is missing is formatting, and `bodyFormat` below is what
// makes adding it later a migration rather than a guess.

/** What `SalesRepNote.body` holds. Stored, so old rows stay readable. */
export const BODY_FORMAT_TEXT = "text";

/**
 * Formats a reader knows how to render. A row whose format is not on this list
 * is shown as an explanation, never as raw text — rendering an unknown format
 * as plain text is how a JSON document ends up on screen as `[{"id":"…`.
 */
export const KNOWN_BODY_FORMATS = [BODY_FORMAT_TEXT];

/**
 * What shipped, named on the screen as well as here.
 *
 * On the screen because a rep who was told "Notion for your notes" and finds a
 * textarea deserves the sentence, and because the alternative — a toolbar of
 * bold/italic buttons that do nothing — is the exact failure AGENTS.md opens
 * with.
 */
export const EDITOR = {
  kind: "textarea",
  label: "Plain text",
  why:
    "Rich formatting isn't here yet: the block editor we chose can't be " +
    "installed without changing how the whole project resolves its " +
    "dependencies. Text you write is saved exactly as typed.",
};

export const LIMITS = {
  // Long enough for a full call transcript typed by hand; short enough that a
  // paste of a whole website is refused rather than stored.
  body: 60_000,
  title: 200,
};

/**
 * The one byte Postgres will not store in a text column.
 *
 * Spelled as an escape rather than typed as a literal: a source file that
 * contains a raw NUL is truncated by some editors and diff tools, and this
 * file had exactly that bug until the check below caught it.
 */
const NUL = /\u0000/g;

/**
 * Strip what a database column should never hold, and nothing else.
 *
 * NUL bytes only. Postgres text columns reject U+0000 outright, so a paste
 * carrying one fails the write with a driver error rather than a message
 * anyone can act on. Everything else a rep types — tabs, emoji, CRLF, RTL
 * marks — is their note and is stored verbatim.
 *
 * Deliberately NOT escaping HTML. The body is rendered into a textarea and
 * into React text nodes, both of which escape on the way out; escaping on the
 * way IN would store `&amp;` and hand the rep back something they did not
 * type. Escaping at the wrong end is how "&" becomes "&amp;amp;" by Thursday.
 */
export function sanitiseBody(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(NUL, "").slice(0, LIMITS.body);
}

/** Same, plus newline collapsing — a title is one line by definition. */
export function sanitiseTitle(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(NUL, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, LIMITS.title);
}

/**
 * What to show in a list when the rep never typed a title.
 *
 * DISPLAY ONLY, and never written back to `title`. Storing a derived title
 * would make it stale the moment the first line changed, and would make
 * "untitled" indistinguishable from "titled with its own first line" — the
 * absent-data failure, in the shape of a helpful default.
 */
export function displayTitle(note) {
  const title = typeof note?.title === "string" ? note.title.trim() : "";
  if (title) return title;

  const body = typeof note?.body === "string" ? note.body : "";
  const firstLine = body.split("\n").find((line) => line.trim().length > 0);
  if (firstLine) return firstLine.trim().slice(0, 80);

  return "Untitled note";
}

/** Is this a body a reader can render? See KNOWN_BODY_FORMATS. */
export function isRenderableFormat(format) {
  return KNOWN_BODY_FORMATS.includes(format);
}
