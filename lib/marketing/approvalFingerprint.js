// lib/marketing/approvalFingerprint.js
//
// What was on the screen when somebody pressed Approve.
//
// ── Why an approval needs a fingerprint at all ─────────────────────────────
//
// A boolean `approved` is an approval that survives the content changing
// underneath it. Approve a post on Tuesday, edit the headline on Wednesday,
// schedule it on Thursday, and a name is attached to a sign-off for words
// nobody read. That is not a weaker version of the gate — it is the gate
// producing a false record, which is worse than having none, because the audit
// trail now says a person checked something they did not check.
//
// So the approval stores a hash of the exact thing approved, and the publish
// route recomputes it from the CURRENT rows immediately before writing
// anything. Same instinct as lib/migrations/state.js's canWrite() being
// re-read fresh on every write rather than trusted from an earlier request:
// permission granted a moment ago is not permission now.
//
// ── What is IN the fingerprint, and what is deliberately out ───────────────
//
// IN: every saved ratio's layout document, and the caption and hashtags. Those
// are the post — the pixels are rendered from the layouts, and the words are
// the words.
//
// OUT: the design's name, its campaign, its timestamps, and anything about who
// approved it. Renaming a design from "kitchen post v2" to "kitchen post" is
// not a change to what gets published, and invalidating an approval over it
// would train people to re-approve without looking, which is how a gate stops
// meaning anything.
//
// ── Pure ───────────────────────────────────────────────────────────────────
//
// node:crypto only. No database, no fabric — scripts/check-job-post.mjs
// executes it against reordered, mutated and hostile input.
import { createHash } from "node:crypto";

/**
 * Canonical JSON: object keys sorted at every depth, arrays left in order.
 *
 * JSON.stringify alone would make the fingerprint depend on key insertion
 * order, which Prisma's Json column does not promise to preserve across a
 * write and a read. Approving a design and immediately re-reading it would
 * then look like a change — the gate would fire on nothing, every time, and
 * the fix somebody reached for would be to delete the gate.
 *
 * Array order is NOT sorted, because in a fabric document it is the z-order:
 * two documents with the same objects stacked differently are two different
 * pictures.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  // NaN/Infinity serialise as null through JSON.stringify either way; naming
  // them here would only add a branch that changes nothing.
  return value;
}

/**
 * The fingerprint of one design's publishable content.
 *
 * @param {Object} args
 * @param {Array<{ratioKey: string, json: object, width: number, height: number}>} args.layouts
 *   every saved MarketingDesignLayout row. Sorted by ratioKey here rather than
 *   relied on from the query — an ORDER BY that changes, or a route that
 *   selects them a different way, must not invalidate every approval in the
 *   product.
 * @param {string} [args.caption]
 * @param {string[]} [args.hashtags]  order preserved: they are printed in it.
 * @returns {string} a hex sha256. Never throws; a missing layout list
 *   fingerprints as the empty set, which is a real state (a design nobody has
 *   saved a ratio for) and must not be confused with an error.
 */
export function designFingerprint({ layouts = [], caption = "", hashtags = [] } = {}) {
  const rows = (Array.isArray(layouts) ? layouts : [])
    .filter((l) => l && typeof l.ratioKey === "string")
    .map((l) => ({
      ratioKey: l.ratioKey,
      width: Number(l.width) || 0,
      height: Number(l.height) || 0,
      json: canonical(l.json ?? null),
    }))
    .sort((a, b) => (a.ratioKey < b.ratioKey ? -1 : a.ratioKey > b.ratioKey ? 1 : 0));

  const payload = {
    layouts: rows,
    caption: typeof caption === "string" ? caption : "",
    hashtags: (Array.isArray(hashtags) ? hashtags : []).filter((h) => typeof h === "string"),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Is this design approved, for what it says RIGHT NOW?
 *
 * Three states, not two, and the third is the one worth naming: a design that
 * was approved and has since changed is not "unapproved" — telling somebody
 * that would send them looking for an approve button they already pressed. It
 * is `stale`, and the screen says so.
 *
 * @param {{approvedAt: Date|null, approvedFingerprint: string|null, caption: string|null, hashtags: string[]}} design
 * @param {Array} layouts
 * @returns {{ok: boolean, state: "approved"|"not_approved"|"stale", current: string}}
 */
export function approvalState(design, layouts) {
  const current = designFingerprint({
    layouts,
    caption: design?.caption || "",
    hashtags: design?.hashtags || [],
  });

  if (!design?.approvedAt || !design?.approvedFingerprint) {
    return { ok: false, state: "not_approved", current };
  }
  if (design.approvedFingerprint !== current) {
    return { ok: false, state: "stale", current };
  }
  return { ok: true, state: "approved", current };
}
