// lib/jobs/checklistItems.js
//
// The one place a checklist item's shape is decided.
//
// Three routes touch these arrays — the template settings route, visit
// creation and visit update — and before this file each had its own private
// normaliser. They had already drifted: the settings route coerced strings to
// `{ label, done }`, while POST /visits wrote whatever JSON the browser sent
// straight onto the row. So a visit could hold `["mask the counters"]` and the
// job page, which reads `item.label`, rendered "Untitled item" for every step.
//
// ── Why phase lives on the item, not just the template ─────────────────────
//
// A visit's checklist is a COPY, taken once and then edited by the crew. If
// the phase only existed on JobChecklistTemplate, grouping a visit's list
// would mean reading back a template that may since have been renamed,
// re-phased or deleted — and a template delete deliberately doesn't strip work
// off a scheduled job. Stamping the phase alongside the label keeps the copy
// self-describing, which is the same reason `done` lives there.
//
// ── Two kinds of list share this shape ─────────────────────────────────────
//
// A residential trade list is a line of text you tick: "mask the baseboards".
// A construction inspection item is a measurement against a published
// tolerance: "bed joints 3/8 in nominal, +/- 1/8 in", cite TMS 602, record the
// number, photograph it, and don't let it be submitted as failed without a
// comment. Both are checklists and both get ticked by the same crew on the
// same phone, so they are ONE shape rather than two parallel features.
//
// The richer fields are all OPTIONAL and are only written when they carry
// something. A list of bare strings round-trips through here byte-identical —
// stamping fifteen nulls onto every "mask the baseboards" would bloat every
// existing row to describe an inspection regime nobody asked for.

/// Order matters: this is the order a day happens in, and every grouped
/// rendering walks it rather than sorting the keys.
export const CHECKLIST_PHASES = ["pre", "during", "post"];

export const PHASE_LABELS = {
  pre: "Before the work",
  during: "On the job",
  post: "Before you leave",
};

/// Short forms for tight rows (a badge next to a template name).
export const PHASE_SHORT = {
  pre: "Before",
  during: "During",
  post: "After",
};

/// How an item is answered. `pass_fail_na` is the default and covers most of
/// an inspection; `numeric` is the one that earns its keep, because "95% of
/// maximum dry density" is a reading, not a tick, and storing it as a tick
/// throws away the only part a dispute later turns on.
export const RESPONSE_TYPES = [
  "pass_fail_na",
  "yes_no",
  "numeric",
  "text",
  "date",
  "single_select",
  "multi_select",
];

export const RESPONSE_TYPE_LABELS = {
  pass_fail_na: "Pass / Fail / N/A",
  yes_no: "Yes / No",
  numeric: "Measurement",
  text: "Note",
  date: "Date",
  single_select: "Pick one",
  multi_select: "Pick any",
};

/// What a `pass_fail_na` / `yes_no` item can hold. Kept as strings rather than
/// booleans because "n/a" is a real, meaningful third answer on an inspection
/// — "this doesn't apply here" is not the same statement as "no".
export const RESPONSE_VALUES = ["pass", "fail", "na", "yes", "no"];

/// Media a crew attaches to a single item. `video` is listed separately from
/// `file` because the capture control differs on a phone, not because the
/// storage does.
export const MEDIA_KINDS = ["photo", "video", "file"];

/**
 * Coerce anything to one of the three phases.
 *
 * Unknown values fall back to "during" rather than being rejected: the phase
 * is a grouping hint, and dropping an item because someone posted "cleanup"
 * would lose real work off a crew's list to protect a heading.
 */
export function normalizePhase(value) {
  const phase = String(value || "").trim().toLowerCase();
  return CHECKLIST_PHASES.includes(phase) ? phase : "during";
}

/**
 * Coerce anything to a known response type.
 *
 * Falls back to `pass_fail_na` for the same reason phases fall back to
 * "during": an unrecognised type must still leave the crew a control they can
 * answer, and pass/fail/NA is the one that fits any check.
 */
export function normalizeResponseType(value) {
  const type = String(value || "").trim().toLowerCase();
  return RESPONSE_TYPES.includes(type) ? type : "pass_fail_na";
}

function cleanString(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Normalise the media attached to one item.
 *
 * A bare string is treated as a photo URL, because that is what every existing
 * photo array in this codebase already is (JobVisit.photos) and the migration
 * path has to be "keep working", not "lose the photos".
 */
function normalizeMedia(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        const url = entry.trim();
        return url ? { url, kind: "photo", caption: null } : null;
      }
      const url = cleanString(entry?.url);
      if (!url) return null;
      const kind = MEDIA_KINDS.includes(entry?.kind) ? entry.kind : "photo";
      return { url, kind, caption: cleanString(entry?.caption) };
    })
    .filter(Boolean);
}

/**
 * Normalise a checklist array to `{ label, done, phase }` plus whatever
 * inspection detail the item actually carries.
 *
 * Accepts bare strings, `{ label }`, `{ text }`, and existing normalised
 * items, so a template written by the seed, typed in settings, or posted by an
 * older client all land in the same shape.
 *
 * @param {unknown} items
 * @param {object} [opts]
 * @param {string} [opts.phase]      Fallback phase for items that carry none.
 * @param {boolean} [opts.forcePhase] Overwrite each item's own phase with
 *                                   `opts.phase`. A TEMPLATE is single-phase by
 *                                   definition, so re-phasing one has to
 *                                   restamp its items; a VISIT's list is mixed
 *                                   and must keep each item where it was put.
 * @param {boolean} [opts.keepDone]  Preserve `done`, the recorded response,
 *                                   the note and the attached media (visit
 *                                   edits) rather than resetting them (a
 *                                   template has no state).
 */
export function normalizeChecklistItems(items, opts = {}) {
  const fallbackPhase = normalizePhase(opts.phase);
  const forcePhase = opts.forcePhase === true;
  const keepDone = opts.keepDone === true;

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const label =
        typeof item === "string" ? item : item?.label || item?.text || "";

      const next = {
        label: String(label).trim(),
        done: keepDone ? item?.done === true : false,
        phase:
          !forcePhase && item?.phase
            ? normalizePhase(item.phase)
            : fallbackPhase,
      };

      if (typeof item !== "object" || item === null) return next;

      // ── The inspection detail, written only when present ──────────────
      //
      // `criteria` is the objective threshold ("+/- 1/8 in"), `reference` the
      // published section it comes from. Both are copied onto the visit and
      // never re-derived from the template: a template can be edited or
      // deleted after a crew has already worked to the old wording, and the
      // record of what they were asked to check has to survive that.
      const section = cleanString(item.section);
      if (section) next.section = section;

      const criteria = cleanString(item.criteria ?? item.acceptance_criteria);
      if (criteria) next.criteria = criteria;

      const reference = cleanString(item.reference);
      if (reference) next.reference = reference;

      const rawType = item.responseType ?? item.response_type;
      // Only stamped when the item actually said something. An absent type
      // means "a tick", and writing "pass_fail_na" onto every legacy item
      // would change what those rows claim about themselves.
      if (rawType) next.responseType = normalizeResponseType(rawType);

      const unit = cleanString(item.unit);
      if (unit) next.unit = unit;

      // expected_range: [min, max] with nulls allowed at either end — an
      // open-ended tolerance ("95% or greater") is the normal case, not an
      // error.
      const range = Array.isArray(item.expected_range) ? item.expected_range : null;
      const min = cleanNumber(range ? range[0] : item.expectedMin);
      const max = cleanNumber(range ? range[1] : item.expectedMax);
      if (min !== null) next.expectedMin = min;
      if (max !== null) next.expectedMax = max;

      const options = Array.isArray(item.options)
        ? item.options.map(cleanString).filter(Boolean)
        : [];
      if (options.length) next.options = options;

      if (item.critical === true) next.critical = true;
      if ((item.photoRequired ?? item.photo_required) === true)
        next.photoRequired = true;
      if ((item.noteRequiredOnFail ?? item.note_required_on_fail) === true)
        next.noteRequiredOnFail = true;

      // ── What the crew recorded ────────────────────────────────────────
      //
      // Dropped when copying a template onto a visit (keepDone false), for the
      // same reason `done` is: last week's reading is not this week's.
      if (keepDone) {
        const response =
          typeof item.response === "number"
            ? item.response
            : cleanString(item.response);
        if (response !== null && response !== "") next.response = response;

        const note = cleanString(item.note);
        if (note) next.note = note;

        const media = normalizeMedia(item.media);
        if (media.length) next.media = media;
      }

      return next;
    })
    .filter((item) => item.label);
}

/**
 * Is this item finished, given what it asks for?
 *
 * A tick alone is not completion when the item demands evidence. An inspection
 * that says "photograph the gauge" and accepts a bare tick is the dead-control
 * failure wearing a checkbox: it looks finished and proves nothing.
 *
 * Returns `{ done, missing }` where `missing` names what is still owed, so a
 * UI can say why rather than just refusing.
 */
export function checklistItemStatus(item) {
  const missing = [];
  if (!item?.done) missing.push("tick");

  if (item?.photoRequired) {
    const hasPhoto = (item.media || []).some((m) => m.kind === "photo");
    if (!hasPhoto) missing.push("photo");
  }

  // Only a FAILED answer forces a comment. Requiring one on a pass would
  // train people to type "ok" eighty times, which is worse than no note.
  const failed = item?.response === "fail" || item?.response === "no";
  if (failed && item?.noteRequiredOnFail && !item?.note) missing.push("note");

  return { done: missing.length === 0, missing };
}

/**
 * Group items into `[{ phase, label, items }]`, phases with nothing in them
 * omitted.
 *
 * Empty phases are dropped rather than rendered as empty headings, because a
 * "Before you leave" heading with no steps under it reads as "nothing to do
 * before you leave" — which is a statement the company never made.
 */
export function groupChecklistByPhase(items) {
  const normalized = normalizeChecklistItems(items, { keepDone: true });

  return CHECKLIST_PHASES.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    // Index into the ORIGINAL array is carried through, so a UI that ticks an
    // item can write back to the right slot without re-deriving the grouping.
    items: normalized
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.phase === phase),
  })).filter((group) => group.items.length > 0);
}

/**
 * Group items into `[{ section, items }]` in FIRST-APPEARANCE order.
 *
 * Deliberately not alphabetical and not a fixed vocabulary: a checklist's
 * sections are the order the work happens in ("Surface Preparation" before
 * "Finish Coat Application"), and sorting them would scramble a sequence the
 * author chose. Items with no section land in one leading group with a null
 * name, which is every list written before sections existed.
 */
export function groupChecklistBySection(items) {
  const normalized = normalizeChecklistItems(items, { keepDone: true });
  const groups = [];
  const byName = new Map();

  normalized.forEach((item, index) => {
    const name = item.section || null;
    if (!byName.has(name)) {
      const group = { section: name, items: [] };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).items.push({ ...item, index });
  });

  return groups;
}

/** True when any item carries section/criteria detail worth rendering. */
export function hasInspectionDetail(items) {
  return (Array.isArray(items) ? items : []).some(
    (item) =>
      item &&
      typeof item === "object" &&
      (item.section || item.criteria || item.responseType || item.reference),
  );
}
