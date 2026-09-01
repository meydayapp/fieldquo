// lib/gallery/tags.js
//
// Company-defined job-photo tags — free-form process labels ("sanding",
// "priming", "top coat", "demo"...) that a contractor puts on a photo,
// layered ON TOP of the four built-in stages in lib/gallery/stages.js rather
// than replacing them.
//
// ══ Why stage stays a separate, protected axis ═════════════════════════════
//
// start/progress/finish/issue are not labels, they're product logic:
//   - start + finish drive beforeAfterPairs (lib/gallery/albums.js)
//   - issue is a hard privacy boundary, enforced independently in TWO places
//     (see the header comment on lib/gallery/stages.js and on the JobPhotoTag
//     model in prisma/schema.prisma)
//
// A company-defined tag is decoration next to that, never a stand-in for it.
// A contractor can name a tag "Issue", "Before", "Finished" — spelled however
// they like — and it changes nothing: tags live in their own table
// (JobPhotoTag / JobPhotoTagOnPhoto), a photo's `stage` column is untouched,
// and none of the functions in albums.js or lib/site/jobPhotos.js ever read a
// tag's name to decide what's public. The functions below don't enforce that
// separation — they can't touch it, because they never see `stage` at all.
// That absence IS the safety argument. See docs/PHOTO-TAGS.md.
//
// Pure. No database, no network.

export const TAG_NAME_MAX = 60;

/** Collapse whitespace, trim, and cap length — the shape a tag name is stored in. */
export function normaliseTagName(name) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAG_NAME_MAX);
}

export function isValidTagName(name) {
  return normaliseTagName(name).length > 0;
}

/**
 * Case-insensitive identity for duplicate detection — "Sanding" and "sanding"
 * are the same tag to a picker, even though the stored `name` keeps whatever
 * capitalisation was typed.
 */
export function tagKey(name) {
  return normaliseTagName(name).toLowerCase();
}

/**
 * True when `name` collides (case-insensitively) with an EXISTING tag in the
 * same company, other than `excludeId` itself (so renaming a tag to the name
 * it already has isn't a false collision).
 */
export function isDuplicateTagName(name, existingTags, excludeId = null) {
  const key = tagKey(name);
  if (!key) return false;
  return (Array.isArray(existingTags) ? existingTags : []).some(
    (t) => t && t.id !== excludeId && tagKey(t.name) === key,
  );
}

/**
 * A small, generic starter set any trade can accept as-is, edit, or ignore
 * entirely — offered, never applied. Deliberately NOT "before"/"after"/
 * "issue": those words belong to `stage`, and offering a starter tag that
 * echoes a protected stage name would blur the exact line this file exists to
 * keep sharp. Process words only — the "process (sanding, installing,
 * priming, top coat, demo, etc)" half of the ask, not the before/after half
 * stage already owns.
 */
export const STARTER_TAGS = [
  { name: "Demo", color: "#b91c1c" },
  { name: "Prep", color: "#b45309" },
  { name: "Sanding", color: "#a16207" },
  { name: "Priming", color: "#0369a1" },
  { name: "Installing", color: "#1d4ed8" },
  { name: "Top coat", color: "#15803d" },
  { name: "Punch list", color: "#7c3aed" },
  { name: "Touch-up", color: "#be185d" },
];

/**
 * Starter tags this company hasn't already got (by name, case-insensitive) —
 * what "Add starter tags" actually offers to create. Never re-creates a tag a
 * company renamed, retired, or already has; "offered, never applied" means an
 * accept action still has to be idempotent, not just gated behind a click.
 */
export function missingStarterTags(existingTags) {
  const have = new Set(
    (Array.isArray(existingTags) ? existingTags : []).map((t) => tagKey(t?.name)),
  );
  return STARTER_TAGS.filter((s) => !have.has(tagKey(s.name)));
}

/**
 * Sort tags for a picker or settings list: active before retired, then by
 * sortOrder, then alphabetically as a stable tiebreaker for equal orders.
 */
export function sortTags(tags) {
  return (Array.isArray(tags) ? tags : []).slice().sort((a, b) => {
    const aActive = a?.active !== false;
    const bActive = b?.active !== false;
    if (aActive !== bActive) return aActive ? -1 : 1;
    const ao = Number.isFinite(a?.sortOrder) ? a.sortOrder : 0;
    const bo = Number.isFinite(b?.sortOrder) ? b.sortOrder : 0;
    if (ao !== bo) return ao - bo;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

/**
 * Photos carrying a given tag id. Deliberately indifferent to whether the tag
 * is active or retired — a filter has to keep finding photos whose tag was
 * later retired, the same way stageTimeline keeps showing a photo whose stage
 * predates a rename (lib/gallery/albums.js). Retiring hides a tag from the
 * PICKER; it must not also make the photos wearing it unfindable.
 */
export function filterByTag(photos, tagId) {
  if (!tagId) return Array.isArray(photos) ? photos : [];
  return (Array.isArray(photos) ? photos : []).filter(
    (p) => Array.isArray(p?.tags) && p.tags.some((t) => t?.id === tagId),
  );
}
