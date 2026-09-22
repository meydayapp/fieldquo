// app/components/layout/NavShell.js
//
// The one piece of state the /app chrome shares: which overlay is open.
//
//   drawer   the phone's left slide-over (the hamburger, and the tour's way in)
//   more     the phone's "More" bottom sheet (the tab bar's last slot)
//   create   the Create menu (top bar on desktop, the floating + on a phone)
//   search   the global search (the top bar's box, `/` from anywhere)
//   settings whether the rail is showing its settings sub-list (Roofr's slide)
//
// ── Why a context, and why now ──────────────────────────────────────────────
//
// `mobileOpen` used to be local state inside AdminSidebar with no setter
// exported. MobileTabBar's "More" therefore opened the drawer by clicking the
// hamburger's real DOM node — `document.querySelector('[data-tour-open="nav"]')`
// — a coupling docs/MOBILE-TABBAR.md already named as the wrong long-term
// shape. The shell reorganisation (2026-09-21) adds a second sheet, a Create
// menu and a search palette that four components open from five places, so
// the DOM hack would have become four DOM hacks. One provider, mounted once by
// app/app/layout.js above the rail, the top bar and the tab bar.
//
// Exactly one overlay is open at a time: opening the sheet closes the drawer,
// opening search closes the sheet. A phone with a scrim under a scrim is a
// phone nobody can get back from.
//
// Every overlay closes on navigation — pathname is watched here, once, so no
// caller has to remember. Escape is handled by each overlay (they own the
// keydown while mounted), not here.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const NONE = null;
const NavShellContext = createContext(null);

/** Under /app/settings — the index or any page beneath it. */
export function isSettingsPath(pathname) {
  const p = String(pathname || "");
  return p === "/app/settings" || p.startsWith("/app/settings/");
}

export function NavShellProvider({ children }) {
  const pathname = usePathname();
  // The one open overlay: "drawer" | "more" | "create" | "search" | null.
  const [overlay, setOverlay] = useState(NONE);
  // The rail's settings sub-list. Separate from `overlay` because it is not
  // an overlay — it is a state of the rail, and it survives a navigation
  // between two settings pages (that is the whole point of the slide).
  //
  // Derived from the route on the first paint (a deep link into
  // /app/settings/branding lands with the list already slid — no repaint),
  // then opened whenever the route ENTERS settings and closed whenever it
  // LEAVES. In between it is the user's: Back keeps the main list until they
  // open Settings again.
  const [settingsPanel, setSettingsPanel] = useState(() => isSettingsPath(pathname));
  const prevPath = useRef(pathname);

  useEffect(() => {
    setOverlay(NONE);
    const was = isSettingsPath(prevPath.current);
    const now = isSettingsPath(pathname);
    if (now && !was) setSettingsPanel(true);
    if (!now && was) setSettingsPanel(false);
    prevPath.current = pathname;
  }, [pathname]);

  const open = useCallback((name) => setOverlay(name), []);
  const close = useCallback(() => setOverlay(NONE), []);
  const toggle = useCallback((name) => setOverlay((cur) => (cur === name ? NONE : name)), []);

  const value = useMemo(
    () => ({
      overlay,
      open,
      close,
      toggle,
      isOpen: (name) => overlay === name,
      settingsPanel,
      setSettingsPanel,
    }),
    [overlay, open, close, toggle, settingsPanel],
  );
  return <NavShellContext.Provider value={value}>{children}</NavShellContext.Provider>;
}

const FALLBACK = {
  overlay: NONE,
  open: () => {},
  close: () => {},
  toggle: () => {},
  isOpen: () => false,
  settingsPanel: false,
  setSettingsPanel: () => {},
};

/**
 * Never throws outside the provider: a component photographed alone by a
 * harness, or mounted on a surface without the shell, gets inert controls
 * rather than a crash. Nothing that reads this decides access.
 */
export function useNavShell() {
  return useContext(NavShellContext) || FALLBACK;
}
