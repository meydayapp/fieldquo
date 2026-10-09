// lib/permissions/accessPresets.js
//
// Pure helpers for the access editor. Deliberately not inside the component:
// a guard has to be able to import them, and Node cannot parse JSX.

import {
  PERMISSION_PRESETS,
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PRESET_TO_ROLE,
  TOGGLES_ON_WHEN_ABSENT,
} from "@/lib/permissions";
import { ROLE_LABELS } from "./roleManagement";
import { UNRESTRICTED_ROLES } from "./enforce";
import { MARKETING_AGENCY_KEY } from "./marketingAgency";

// ── Switches a person can be turned OFF without leaving their preset ───────
//
// The owner, 2026-10-03: the time clock is on by default for the roles that
// use it, and switchable per person in Edit access. Turning one feature OFF
// for one person is not a different job: a Crew member with no clock is still
// Crew (still free — lib/pricing/ladder.js counts a grid BELOW Crew as free),
// and an Estimator with no clock is still an Estimator. So these values match
// the preset they sit in, the label keeps saying what the person is, and the
// fixed Crew panel can offer the switch without unlocking the whole grid.
// Only OFF values belong here — anything that GRANTS more is a different
// grid, and must read as one.
//
// clientPhoneOnOwnJobs joined it on 2026-10-04: the owner wants crew to see the
// client's phone on their own jobs by default, and an owner may take it away
// from one person without that person stopping being Crew.
export const PRESET_OFF_SWITCHES = Object.freeze({ timeTracking: "none", clientPhoneOnOwnJobs: false });

/** Is `value` the off position of a per-person switch for `key`? */
export function isPresetOffSwitch(key, value) {
  return Object.prototype.hasOwnProperty.call(PRESET_OFF_SWITCHES, key) && PRESET_OFF_SWITCHES[key] === value;
}

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

  // The marketing-agency marker is not a dial, so the "no extras" test below
  // never looks at it. Without this a grid carrying it could match another
  // preset whose dials happened to agree — and an agency confined to
  // marketing would be LABELLED as something it is not. And the other way: a
  // preset that carries the marker matches only a grid that does.
  const agency = values[MARKETING_AGENCY_KEY] === true;

  for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
    if (role && PRESET_TO_ROLE[key] !== role) continue;
    if (agency !== (preset.values?.[MARKETING_AGENCY_KEY] === true)) continue;

    // A toggle saved before it existed is absent, and reads as on — see
    // TOGGLES_ON_WHEN_ABSENT. Without this every Crew grid saved before
    // 2026-10-04 would open as "Custom".
    const held = (k) => (values[k] === undefined && TOGGLES_ON_WHEN_ABSENT.includes(k) ? true : values[k]);
    const matchesStated = Object.entries(preset.values).every(
      ([k, v]) => held(k) === v || isPresetOffSwitch(k, values[k]),
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

/** The roles some preset actually produces. Owner is not one of them. */
export const ROLES_WITH_PRESETS = new Set(Object.values(PRESET_TO_ROLE));

/**
 * What to CALL this member's access, anywhere a person reads it.
 *
 * ── The bug this exists to stop happening again ────────────────────────────
 *
 * Manage Team's read-only badge rendered `ROLE_LABELS[member.role]`. Two
 * presets share the `supervisor` tier and ROLE_LABELS has one name for it, so
 * every Dispatcher on that screen read "Manager" — and the owner who assigned
 * Dispatcher reasonably concluded they had handed out delete, job costing,
 * payments and everyone's expenses. The editable dropdown on the very same row
 * already answered correctly, by reverse-matching the stored grid. There is no
 * reason for two answers, so there is now one function.
 *
 * ── Why it asks the grid first, and the tier only when the grid is silent ──
 *
 * It names whatever actually governs the member, which is the same order
 * enforce.js resolves in:
 *
 *   1. owner/admin (UNRESTRICTED_ROLES) and the isAdministrator flag skip the
 *      grid entirely — hasLevel() returns true before reading it — so the tier
 *      name IS the whole truth for them.
 *   2. No grid stored: hasLevel() falls back to the coarse role, so again the
 *      tier is what governs. Saying "Custom" there would invent a
 *      configuration nobody made.
 *   3. A grid that matches a preset: the preset's own label.
 *   4. A grid that matches nothing: "Custom" — genuinely custom, and the tier
 *      label would be actively misleading, which is the reported bug.
 *
 * `tierLabel` comes back alongside so a caller can show BOTH vocabularies.
 * Nothing on screen used to say the two existed, let alone that they are not
 * 1:1; the badge's tooltip now does.
 *
 * @param {{role?: string|null, permissions?: object|null}} member
 * @returns {{kind: "administrator"|"tier"|"preset"|"custom",
 *            presetKey: string|null, label: string,
 *            role: string|null, tierLabel: string|null}}
 */
export function describeAccess(member) {
  const role = member?.role ?? null;
  const stored = member?.permissions;
  const tierLabel = role ? ROLE_LABELS[role] || role : null;
  const base = { presetKey: null, role, tierLabel };

  if (UNRESTRICTED_ROLES.has(role) || stored?.isAdministrator === true) {
    return {
      ...base,
      kind: "administrator",
      // isAdministrator on a lower tier still means "full access, ignore the
      // grid" to every screen that writes it, so it is named as such.
      label: role === "owner" ? ROLE_LABELS.owner : ROLE_LABELS.admin,
    };
  }

  const hasGrid =
    stored && typeof stored === "object" && Object.keys(stored).length > 0;
  if (!hasGrid) return { ...base, kind: "tier", label: tierLabel };

  const presetKey = presetForValues(
    { ...emptyPermissionValues(), ...stored },
    role,
  );
  if (presetKey) {
    return {
      ...base,
      kind: "preset",
      presetKey,
      label: PERMISSION_PRESETS[presetKey].label,
    };
  }

  // A tier no preset produces cannot have a preset to fail to match, so
  // "Custom" would be describing a choice nobody was offered.
  if (!ROLES_WITH_PRESETS.has(role)) {
    return { ...base, kind: "tier", label: tierLabel };
  }
  return { ...base, kind: "custom", label: "Custom" };
}
