// app/providers/FeatureProvider.js
//
// Carries the resolved feature flags from the server layout to the two sidebars.
//
// ── Why a provider and not a fetch ─────────────────────────────────────────
//
// The alternative was a /api/features endpoint the sidebar calls on mount. That
// makes the menu flicker — every page load would draw the full nav and then
// remove rows a moment later, which is worse than not hiding them at all, and it
// puts a round trip on the critical path of every screen. AppLayout already
// resolves the map in the same render pass it uses for the language and the lock
// state, so this costs two queries per page instead of two queries plus a fetch.
//
// ── Why it carries so little ───────────────────────────────────────────────
//
// Only { state, visible, usable } per key — see navFlagsFrom in
// lib/features/gate.js. The `note` and the resolution `source` stay on the
// server: "shut off for this company specifically" is FieldQuo's internal
// reasoning, and shipping it to a tenant's browser would put the platform's
// commercial decisions in a devtools panel.
//
// This is presentation state. Nothing here is a permission — see lib/features/nav.js.
"use client";

import { createContext, useContext } from "react";

const FeatureContext = createContext(null);

export function FeatureProvider({ flags, children }) {
  return (
    <FeatureContext.Provider value={flags || null}>
      {children}
    </FeatureContext.Provider>
  );
}

/**
 * The flags, or null when nothing resolved them.
 *
 * Null is a real answer, not an error: lib/features/nav.js treats it as "show
 * everything", because a menu that empties itself while a provider is missing is
 * a far more visible failure than a row that leads to a gated page.
 */
export function useFeatureFlags() {
  return useContext(FeatureContext);
}
