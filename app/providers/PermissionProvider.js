// app/providers/PermissionProvider.js
//
// Carries the caller's effective permission grid from the server layout to the
// sidebars and any screen that needs to know what it may offer.
//
// ── The gap this closes ────────────────────────────────────────────────────
//
// QA probed production as a real employee and found the grid reached the
// browser nowhere at all — not in the session, not in /api/settings/members,
// not in any bootstrap payload. The client was structurally incapable of
// honouring a permission, which is why every "New Quote" button rendered
// enabled next to an endpoint that would 403, and why an employee restricted
// to name_address_only still saw a full nav of screens they could not use.
//
// Modelled on FeatureProvider deliberately, for the same reasons: resolving it
// in the same render pass as the language and lock state costs one more query
// instead of a fetch on the critical path of every screen, and a menu that
// draws in full and then removes rows a moment later is worse than one that
// never hid them.
//
// ── This is affordances, not access control ────────────────────────────────
//
// Same rule as lib/features/nav.js, and worth repeating because it is the rule
// people break: hiding a button is not a permission. The server refuses
// regardless — lib/permissions/enforce.js is the enforcement and it runs
// whether or not this provider exists. What this buys is a UI that stops
// offering people work the server will reject, and stops naming screens they
// cannot open.
//
// ── Why the whole grid, and not a list of booleans ─────────────────────────
//
// A precomputed "canCreateQuote: false" would need a new field every time a
// screen asks a new question, and each one is a chance to forget. The grid is
// the same 13 keys the server reasons about, so client and server ask the
// identical question of the identical data.
"use client";

import { createContext, useContext } from "react";

const PermissionContext = createContext(null);

export function PermissionProvider({ permissions, role, children }) {
  return (
    <PermissionContext.Provider value={{ permissions: permissions || null, role: role || null }}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * The caller's `{ role, permissions }`, or null when nothing resolved it.
 *
 * Null means "show everything", matching how useFeatureFlags treats a missing
 * map. A UI that hides itself because a provider was slow is a far more
 * visible failure than a button that leads to a 403 — and the 403 is still
 * there, doing the actual work.
 */
export function usePermissions() {
  return useContext(PermissionContext);
}
