"use client";

// app/components/layout/NavDrawer.js
//
// The slide-over a sidebar becomes below `lg`: a full-screen scrim and a
// panel from the left edge, above every bar (z-50; a tour card is z-[60] and
// the sales dock z-[70], so both still cover it). Escape closes it, so does
// the scrim, and the panel is a landmark with the nav's own label.
//
// ── Why a component, and why now ────────────────────────────────────────────
//
// AdminSidebar (/app) and SalesMobileTabBar (/sales) each carried these
// twelve lines inline, identical to the class. When the platform console
// grew its own phone chrome (docs/screens/platform-mobile) the honest
// choices were a third copy or one primitive — and the copy is the one
// nobody looks at when the z-index ladder or the width changes. The two
// existing sidebars now render this; their markup is byte-for-byte what they
// had, and their checks (check-sales-mobile, check-sidebar) still read the
// same attributes off the same nodes.
//
// Only the container lives here. The panel's contents — the rows, the close
// button carrying data-tour-close, who is signed in — stay in each sidebar,
// because that is what differs between them. Closing on route change stays
// with the caller too: it owns `open`.
//
// `surface` is the panel's paint: "sidebar" for the two navy rails, "card"
// for the sales portal, which deliberately has no dark surface
// (scripts/check-platform-console.mjs asserts that).

import { useEffect } from "react";

const SURFACES = {
  sidebar: "bg-sidebar text-sidebar-foreground",
  card: "bg-card text-foreground",
};

/**
 * @param open      whether the drawer is mounted; nothing renders when false.
 * @param onClose   called on the scrim, and on Escape.
 * @param label     aria-label for the panel — the nav's name.
 * @param surface   "sidebar" | "card".
 * @param safeArea  pad the panel for the phone's insets (the sales portal
 *                  does; /app's rail scrolls its own content and does not).
 * @param panelAttrs extra attributes on the <aside>, e.g. a data-* hook.
 */
export default function NavDrawer({ open, onClose, label, surface = "sidebar", safeArea = false, panelAttrs = {}, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-50" data-nav-drawer>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={`absolute left-0 top-0 h-full w-[min(20rem,86vw)] max-w-[86vw] shadow-2xl flex flex-col ${SURFACES[surface] || SURFACES.sidebar} ${
          safeArea ? "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : ""
        }`}
        aria-label={label}
        {...panelAttrs}
      >
        {children}
      </aside>
    </div>
  );
}
