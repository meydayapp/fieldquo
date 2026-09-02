// lib/sales/intel/versioning.js
//
// When editing a rule bumps its version, and when it mutates in place.
//
// ══ The decision, and why ══════════════════════════════════════════════════
//
// `ProspectOpportunity.ruleVersion` and `ProspectTechnology.signatureVersion`
// are stamped onto every stored result at the moment it is produced. That is
// the whole reason those columns exist: a rep looking at a recommendation from
// three weeks ago can ask "what did the rule say when this was written", and a
// bad recommendation is traceable to a rule rather than to "the AI".
//
// So the rule is not "bump on every save". It is:
//
//   BUMP when the edit changes WHAT THE ROW DECIDES.
//     A stored result citing v1 must keep meaning what it meant. Editing the
//     conditions of v1 in place makes every historical row a citation of
//     something that no longer exists — the history is still there and it is
//     now a lie, which is worse than not having it.
//
//   DO NOT BUMP when the edit changes only how the row is DESCRIBED or
//   whether it runs at all.
//     A rename is a label. `active` is not a semantic change: a rule switched
//     off stops producing, and switched back on it means exactly what it meant
//     before. Bumping on either would fill the version column with noise and
//     make the one question it answers harder to answer.
//
// The alternative considered and rejected: a new ROW per version, with the old
// one kept immutable. That is the more correct model and it is not free —
// `code` and `signal` are `@unique`, so it needs a compound key, and every
// reader (`db.opportunityRule.findMany({ where: { active: true } })`) would
// have to learn to pick the newest. Changing the storage model of a table
// three engines already read, to get provenance those engines already have via
// the stamped version string, is not a trade worth making today. Written down
// here so the next person can see it was a decision rather than an oversight.
//
// ══ ConfidenceRule is the honest exception ════════════════════════════════
//
// `ConfidenceRule.version` has no counterpart column anywhere: nothing stamps
// a confidence version onto a stored figure. So on that table the version is a
// change counter, shown on the screen, and nothing downstream reads it. It is
// bumped on weight and on `enabled` — both change the number the engine
// computes — so that the counter is at least true. The screen says so out
// loud rather than implying a provenance trail that does not exist.

/**
 * Fields whose change alters what a row DECIDES, per model.
 *
 * Data rather than an `if` in each route: the three routes must agree, and a
 * fourth caller (a future bulk import) has to get the same answer without
 * copying a condition. AGENTS.md failure class 4 — the copy is the one that
 * rots.
 */
export const SEMANTIC_FIELDS = Object.freeze({
  // `priority` is in here and it is the only entry that needs an argument.
  // It is not merely presentation: `buildOpportunities` resolves two rules
  // recommending the same capability by priority and refuses the loser with
  // `duplicate_capability`. So a priority edit can add or remove a stored
  // recommendation, which is exactly the definition above.
  opportunityRule: ["capabilityCode", "conditions", "reasonTemplate", "priority"],
  // `patterns` is what gets matched; `isCompetitor` decides whether a match
  // turns the entire sales conversation into a displacement. Both change what
  // a detection stamped with this version meant.
  technologySignature: ["patterns", "isCompetitor"],
  // See the header: a counter, not a provenance trail.
  confidenceRule: ["weight", "enabled"],
});

/**
 * The next version string.
 *
 * Increments a TRAILING integer wherever it is, so "1" → "2", "v3" → "v4" and
 * "2026.1" → "2026.2" all do the obvious thing. A version with no trailing
 * digits gets ".2" appended rather than being replaced — whatever a superadmin
 * or an import wrote is somebody's meaning, and silently rewriting "draft" to
 * "2" would lose it.
 *
 * Never returns the input unchanged: a bump that does not bump would make
 * every stored stamp ambiguous, which is the failure this file exists to
 * prevent.
 */
export function nextVersion(current) {
  const s = typeof current === "string" ? current.trim() : "";
  if (!s) return "2"; // Nothing was recorded; the seed writes "1", so the next is 2.
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) return `${s}.2`;
  const [, prefix, digits] = m;
  const next = String(BigInt(digits) + 1n);
  // Keep zero padding: "v007" → "v008", not "v08".
  const padded = digits.length > next.length ? next.padStart(digits.length, "0") : next;
  return `${prefix}${padded}`;
}

/**
 * Deep-ish equality for the values these columns hold.
 *
 * JSON columns arrive as objects and a superadmin re-saving the same
 * conditions must NOT bump the version — a version that moves when nothing
 * changed is the same lie as one that does not move when something did. Key
 * order is normalised because `JSON.stringify` is order-sensitive and the
 * browser posts whatever order the editor happened to serialise.
 */
export function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "object" || typeof b === "object") {
    return stableStringify(a) === stableStringify(b);
  }
  // Decimal columns arrive as Prisma Decimal and leave as numbers, so compare
  // as numbers when both sides look numeric. `0.90` and `0.9` are one weight.
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

function stableStringify(v) {
  if (v == null) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}

/**
 * Should this edit bump the version, and which fields made it so.
 *
 * @param {string} model  a key of SEMANTIC_FIELDS
 * @param {object} before the stored row
 * @param {object} patch  only the fields being written
 * @returns {{ bump: boolean, changed: string[], version: string|null }}
 *          `version` is the string to write, or null when nothing bumps.
 */
export function versionBumpFor(model, before, patch) {
  const fields = SEMANTIC_FIELDS[model];
  if (!fields) throw new Error(`versionBumpFor: unknown model ${model}`);

  const changed = fields.filter(
    (f) => f in (patch || {}) && !sameValue(before?.[f], patch[f]),
  );
  if (changed.length === 0) return { bump: false, changed: [], version: null };
  return { bump: true, changed, version: nextVersion(before?.version) };
}
