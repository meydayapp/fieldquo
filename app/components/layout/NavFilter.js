// app/components/layout/NavFilter.js
//
// The parts of a grouped sidebar that need React: the filter box, the dead-end
// message, and the hook that remembers which groups you left open.
//
// SettingsSidebar already had a filter box. The main rail needed one too once
// its groups could be collapsed — so this is that box lifted out and given a
// `tone`, not a second copy of it. The copy is always the one that rots,
// because it's the one nobody looks at.
//
// `tone` is "rail" (the navy chrome) or "panel" (the settings list on a card).
// Two token sets, one component; both measured by scripts/check-sidebar.mjs.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { initialOpenKeys, readOverrides, writeOverrides } from "./navDisclosure";

const TONE = {
  rail: {
    input:
      "bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-muted-foreground border-sidebar-border",
    icon: "text-sidebar-muted-foreground",
    text: "text-sidebar-muted-foreground",
    action: "text-sidebar-foreground",
  },
  panel: {
    input: "bg-background text-foreground placeholder:text-muted-foreground border-border",
    icon: "text-muted-foreground",
    text: "text-muted-foreground",
    action: "text-foreground",
  },
};

export function NavFilter({ value, onChange, placeholder, tone = "panel" }) {
  const c = TONE[tone] || TONE.panel;
  return (
    <div className="relative">
      <Search
        size={14}
        className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${c.icon}`}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        // `search` gives mobile keyboards a sensible action key and a native
        // clear button on iOS.
        type="search"
        className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm ${c.input}`}
      />
    </div>
  );
}

/**
 * A dead end needs a way out. Without this, typing something with no match
 * leaves a blank column and no hint that clearing the box brings everything
 * back.
 */
export function NavEmptyState({ query, onClear, clearLabel, message, tone = "panel" }) {
  const c = TONE[tone] || TONE.panel;
  return (
    <div className="px-3 py-6 text-center">
      <p className={`text-sm ${c.text}`}>{message}</p>
      <button type="button" onClick={onClear} className={`text-sm underline mt-1 ${c.action}`}>
        {clearLabel}
      </button>
    </div>
  );
}

/**
 * Which groups are open, remembered per user.
 *
 * localStorage rather than a schema field on purpose: this is a preference
 * about one browser's chrome, not a record of anything. A column would have to
 * be read, written, migrated and reasoned about per device for no gain.
 *
 * Only groups the user has actually clicked are stored, so `defaultOpenKeys`
 * keeps applying to the rest — a new group added to the nav later gets the
 * sensible default instead of inheriting "closed" from a stale blob.
 */
export function useGroupDisclosure({ storageKey, defaultOpenKeys = [], activeKey = null }) {
  // Server and first client render must agree, so the initial set is derived
  // from defaults + the active route only — both known without a browser.
  // Stored preferences land in the effect below.
  const [openKeys, setOpenKeys] = useState(() =>
    initialOpenKeys({ defaultOpenKeys, active: activeKey }),
  );

  const openRef = useRef(openKeys);
  const overridesRef = useRef({});
  const defaultsRef = useRef(defaultOpenKeys);
  defaultsRef.current = defaultOpenKeys;

  useEffect(() => {
    openRef.current = openKeys;
  }, [openKeys]);

  useEffect(() => {
    const stored = readOverrides(storageKey);
    overridesRef.current = stored;
    const next = initialOpenKeys({
      defaultOpenKeys: defaultsRef.current,
      overrides: stored,
      active: activeKey,
    });
    openRef.current = next;
    setOpenKeys(next);
    // Hydration is a one-shot per storage key. activeKey is handled by the
    // effect below, which must not re-run this and wipe a deliberate collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Re-open the group the route moved INTO. Keyed on activeKey rather than run
  // every render, so collapsing the group you're currently in still works —
  // forcing it open on every pass would make that click do nothing.
  useEffect(() => {
    if (!activeKey) return;
    setOpenKeys((prev) => {
      if (prev.has(activeKey)) return prev;
      const next = new Set(prev);
      next.add(activeKey);
      openRef.current = next;
      return next;
    });
  }, [activeKey]);

  const toggle = useCallback(
    (key) => {
      const nowOpen = !openRef.current.has(key);
      const next = new Set(openRef.current);
      if (nowOpen) next.add(key);
      else next.delete(key);
      openRef.current = next;
      setOpenKeys(next);
      overridesRef.current = { ...overridesRef.current, [key]: nowOpen };
      writeOverrides(storageKey, overridesRef.current);
    },
    [storageKey],
  );

  return { openKeys, toggle };
}
