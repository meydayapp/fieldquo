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
 * Normalise a checklist array to `{ label, done, phase }`.
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
 * @param {boolean} [opts.keepDone]  Preserve `done` (visit edits) rather than
 *                                   resetting it (a template has no state).
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
      return {
        label: String(label).trim(),
        done: keepDone ? item?.done === true : false,
        phase:
          !forcePhase && item?.phase
            ? normalizePhase(item.phase)
            : fallbackPhase,
      };
    })
    .filter((item) => item.label);
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
