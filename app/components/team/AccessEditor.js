"use client";

// app/components/team/AccessEditor.js
//
// The access controls — administrator, preset, and the granular grid — in ONE
// place, so the screen that CREATES a team member and the screen that EDITS
// one offer the same things.
//
// ── The inconsistency this closes ──────────────────────────────────────────
//
// New User offered five presets: Crew (then called "Worker (limited access)"),
// Worker, Dispatcher, Manager, Custom, plus the full 10-category grid and
// three toggles.
//
// Manage Team offered a role dropdown. Nothing else. Which meant permissions
// were WRITE-ONCE: you could create a Crew member and then never change anyone
// to or from that level; you could create a Dispatcher and
// afterwards see only "Manager", with no way to tell which grid they carried
// or to alter it; and "Custom" was unreachable for anyone already on the team.
//
// The owner reported it as the two screens disagreeing about the roles. They
// do — but renaming the labels could never fix it, because the screens were
// not offering the same KIND of thing. One edited a role; the other configured
// access. This component is the thing they now share.
//
// ── What it does not decide ────────────────────────────────────────────────
//
// Nothing here is a permission check. `assignableRoles` and `yourPermissions`
// come from the server via /api/settings/members/self/role, and the server
// clamps again on write (clampPermissions). This only stops the UI offering
// what would be refused — a control that 403s on click is the dead control
// this codebase keeps being swept for.

import {
  PERMISSION_PRESETS,
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PRESET_TO_ROLE,
} from "@/lib/permissions";
import { ROLE_LABELS, tierNote } from "@/lib/permissions/roleManagement";
import {
  emptyPermissionValues,
  presetForValues,
} from "@/lib/permissions/accessPresets";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

// Re-exported so callers import the editor and its helpers from one place,
// while the helpers themselves live in a JSX-free module a guard can load.
export { emptyPermissionValues, presetForValues };

// ── Crew is a shape, not a starting point ──────────────────────────────────
//
// Every preset here was a starting point: pick one, then move any dial. The
// owner found what that does to the free tier. He picked Crew, moved Schedule
// to "edit everyone's schedule", and the invite saved and sent — because
// touching a dial only clears the preset LABEL, and the form then falls back to
// role `employee` with whatever grid is on screen.
//
// His fix, and it is the right one: lock it the way Make administrator is
// locked. Administrator hides the grid entirely and posts
// `{ isAdministrator: true }` — the tier IS the answer, so there is nothing to
// fit. Crew is the same kind of thing from the other end.
//
// Only Crew. The paid presets stay editable, because a company that buys a seat
// may shape it however it likes; that is what they are paying for. What may not
// be shaped is the row that costs nothing.
//
// This is the honest label, NOT the enforcement. Hiding a dial is not access
// control, and somebody posting a hand-written body still gets whatever grid
// they send. What stops that is lib/pricing/ladder.js: free now means at or
// below the Crew ceiling, so an elevated grid is a SEAT however it arrived and
// the seat cap answers it. The two land together or the loophole is only
// invisible.
const FIXED_PRESET = "worker";

export default function AccessEditor({
  grants,
  isAdministrator,
  onAdministratorChange,
  activePreset,
  onPresetChange,
  values,
  onValueChange,
  t,
}) {
  const unrestricted = ["owner", "admin"].includes(grants?.yourRole);
  const canAssign = (role) => grants?.assignableRoles?.includes(role) ?? false;

  // A level you don't hold is not yours to delegate. Owner and admin bypass the
  // grid entirely, so they see the full list.
  function offerableLevels(key, cat) {
    if (unrestricted) return cat.levels;
    const mine = grants?.yourPermissions?.[key];
    const idx = cat.levels.findIndex((l) => l.value === mine);
    return idx === -1 ? cat.levels.slice(0, 1) : cat.levels.slice(0, idx + 1);
  }
  const canOfferToggle = (key) =>
    unrestricted || grants?.yourPermissions?.[key] === true;

  const offerablePresets = Object.entries(PERMISSION_PRESETS).filter(([key]) =>
    canAssign(PRESET_TO_ROLE[key]),
  );

  return (
    <div className="space-y-4">
      {/* Only for someone who can actually assign `admin`. */}
      {canAssign("admin") && (
        <label className="flex items-start gap-2.5 text-sm bg-muted border border-border rounded-lg p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isAdministrator}
            onChange={(e) => onAdministratorChange(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">
              {t("app.setTeamNew.makeAdmin")}
            </span>
            <br />
            <span className="text-muted-foreground">
              {t("app.setTeamNew.makeAdminDesc")}
            </span>
          </span>
        </label>
      )}

      {!isAdministrator && (
        <>
          {offerablePresets.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t("app.setTeamNew.presetIntro")}
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {offerablePresets.map(([key, preset]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onPresetChange(key)}
                    className={`text-left p-3 rounded-lg border text-sm ${
                      activePreset === key
                        ? "border-inverted bg-muted"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium text-foreground flex items-baseline justify-between gap-2">
                      <span>{preset.label}</span>
                      {/* The tier this preset produces. Two presets share one
                          tier, so this word alone never identifies a person —
                          it used to be printed bare here AND as Manage Team's
                          badge, which is how a Dispatcher read as a Manager.
                          Labelled as a tier now, with the sharing spelled out
                          on hover and in the line under the grid. */}
                      <span
                        className="text-[11px] font-normal text-muted-foreground shrink-0"
                        title={tierNote(PRESET_TO_ROLE[key])}
                      >
                        {t("app.setTeamNew.tierChip", "{tier} tier", {
                          tier: ROLE_LABELS[PRESET_TO_ROLE[key]] || "Worker",
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {preset.description}
                    </div>
                  </button>
                ))}

                {/* Custom is now a BUTTON, not a passive card. It used to be an
                    inert div that only lit up as a side effect of touching a
                    dial below — so "set this person to custom" was not
                    something you could actually do, only something that
                    happened to you. */}
                <button
                  type="button"
                  onClick={() => onPresetChange(null)}
                  className={`text-left p-3 rounded-lg border text-sm ${
                    activePreset === null
                      ? "border-inverted bg-muted"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="font-medium text-foreground">
                    {t("app.setTeamNew.custom")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("app.setTeamNew.customDesc")}
                  </div>
                </button>
              </div>
              {/* The two vocabularies, said out loud. The product has four
                  ROLES (the enum the API gates on) and five access levels, and
                  they are not 1:1 — until this line, no screen mentioned that
                  the tier chips above repeat. */}
              <p className="text-xs text-muted-foreground mt-2">
                {t(
                  "app.setTeamNew.tierExplain",
                  "Access levels are grouped into permission tiers, and two levels can share one — so the tier on its own doesn't tell you which level someone has. Hover a tier to see which levels share it.",
                )}
              </p>
            </div>
          )}

          {/* Fixed preset: say what they get, and show no dials. A disabled
              grid would be worse than none — twenty greyed selects invite the
              reader to hunt for the one that will let them through. */}
          {activePreset === FIXED_PRESET ? (
            <p className="text-sm text-muted-foreground pt-2 border-t border-border">
              {t(
                "app.setTeamNew.crewFixed",
                "Crew access is fixed: their own schedule, the jobs they're assigned to, what to buy for those jobs, and their own hours. No prices, quotes, invoices or requests. Crew don't use a seat — to give someone more than this, pick another level.",
              )}
            </p>
          ) : (
          <>
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => (
              <div key={key}>
                <label className="text-sm font-medium text-foreground block mb-1">
                  {cat.label}
                </label>
                <select
                  className={inputClass}
                  value={values[key] ?? cat.levels[0].value}
                  onChange={(e) => onValueChange(key, e.target.value)}
                >
                  {offerableLevels(key, cat).map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            {Object.entries(PERMISSION_TOGGLES)
              .filter(([key]) => canOfferToggle(key))
              .map(([key, description]) => (
                <label key={key} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!values[key]}
                    onChange={(e) => onValueChange(key, e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <br />
                    <span className="text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
