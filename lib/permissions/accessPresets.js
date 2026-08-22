// lib/permissions/accessPresets.js
//
// Pure helpers for the access editor. Deliberately not inside the component:
// a guard has to be able to import them, and Node cannot parse JSX.

import {
  PERMISSION_PRESETS,
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PRESET_TO_ROLE,
} from "@/lib/permissions";

/** Every category at its lowest level, every toggle off. */
export function emptyPermissionValues() {
  const values = {};
  for (const key of Object.keys(PERMISSION_CATEGORIES)) {
    values[key] = PERMISSION_CATEGORIES[key].levels[0].value;
  }
  for (const key of Object.keys(PERMISSION_TOGGLES)) values[key] = false;
  return values;
}

/**
 * Which preset a stored grid corresponds to, or null for "custom".
 *
 * Member has no `preset` column, and shouldn't have one — a preset is a
 * starting point, not an identity, and someone who moved one dial afterwards
 * is genuinely custom. Matching on the VALUES is what lets the editor open
 * showing "Dispatcher" selected for a member created as a Dispatcher, which is
 * the question the owner was really asking: which of these is this person?
 *
 * Two presets can share a role (Worker/Worker-limited, Dispatcher/Manager), so
 * the role alone can never answer it — that is exactly why a role dropdown was
 * the wrong control and this editor exists.
 */
export function presetForValues(values, role) {
  if (!values || typeof values !== "object") return null;

  for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
    if (role && PRESET_TO_ROLE[key] !== role) continue;

    const matchesStated = Object.entries(preset.values).every(
      ([k, v]) => values[k] === v,
    );
    if (!matchesStated) continue;

    // No grants BEYOND the preset either — otherwise a member holding the
    // Dispatcher grid plus payroll would read as a plain Dispatcher, which is
    // the more dangerous direction to be wrong in.
    const noExtras =
      Object.keys(PERMISSION_CATEGORIES).every((k) => {
        if (preset.values[k] !== undefined) return true;
        return values[k] === PERMISSION_CATEGORIES[k].levels[0].value;
      }) &&
      Object.keys(PERMISSION_TOGGLES).every((k) => {
        if (preset.values[k] !== undefined) return true;
        return values[k] !== true;
      });

    if (noExtras) return key;
  }
  return null;
}
