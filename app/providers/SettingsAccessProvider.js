// app/providers/SettingsAccessProvider.js
//
// Carries the signed-in member's role from the settings layout to the screens
// under it, so a page can decide between "editable", "read-only" and "not
// yours" in its FIRST paint.
//
// ── Why a provider and not a fetch ─────────────────────────────────────────
//
// /api/settings/members/self/role already answers this, and three pages call
// it on mount. That is fine for a button that appears a moment late; it is not
// fine for the sidebar. Fetching there would draw the full list of settings
// screens and then remove three of them, which is worse than never hiding them
// — the row someone just saw is the row they reach for. FeatureProvider exists
// for exactly this reason and this mirrors it.
//
// ── This is presentation state ─────────────────────────────────────────────
//
// Nothing here is access control. Every route behind these screens re-checks
// the same rule with the same helpers; see lib/permissions/settingsAccess.js.
"use client";

import { createContext, useContext, useMemo } from "react";
import {
  canChange as canChangeFor,
  canSee as canSeeFor,
} from "@/lib/permissions/settingsAccess";

const SettingsAccessContext = createContext(null);

export function SettingsAccessProvider({ access, children }) {
  // Pulled apart into primitives BEFORE the memo, rather than memoising on
  // `access?.role`. The layout builds a fresh object every render, so a memo
  // keyed on the object would never hit — and one keyed on optional-chained
  // members reads as a missing dependency to the lint rule, which is a warning
  // that would be right for the wrong reason.
  const resolved = !!access;
  const role = access?.role || null;
  const impersonation = !!access?.impersonation;

  const value = useMemo(
    () => (resolved ? { role, impersonation } : null),
    [resolved, role, impersonation],
  );
  return (
    <SettingsAccessContext.Provider value={value}>
      {children}
    </SettingsAccessContext.Provider>
  );
}

/**
 * { role, impersonation, canSee(cap), canChange(cap), resolved }
 *
 * `resolved` is false when nothing supplied the member — a page rendered
 * outside the settings layout, or a lookup that failed. Consumers treat that as
 * "show it, editable", which is today's behaviour: a settings screen that
 * blanked itself because one query hiccuped would look like the account broke,
 * and the server refuses the save either way.
 */
export function useSettingsAccess() {
  const access = useContext(SettingsAccessContext);
  return useMemo(
    () => ({
      role: access?.role || null,
      impersonation: !!access?.impersonation,
      resolved: !!access,
      canSee: (capability) => (access ? canSeeFor(access, capability) : true),
      canChange: (capability) => (access ? canChangeFor(access, capability) : true),
    }),
    [access],
  );
}
