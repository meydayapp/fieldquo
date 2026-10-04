// app/providers/ViewOnlyProvider.js
//
// "View as company" made visible: the app shell mounts this with
// viewOnly={true} only for a read-only support session (app/app/layout.js
// decides from the resolved member — never from anything the browser says).
// Everything else gets viewOnly={false}, which renders the children exactly
// as before and installs nothing; scripts/check-view-only.mjs compares the
// markup to prove it.
//
// What it does in a support session — the rules are lib/impersonation/
// viewOnly.js, this file only wires them to the page:
//
//   · wraps fetch / XHR / sendBeacon, so a write never leaves the browser and
//     the person reads one "View only" note instead of a red 403;
//   · stops a press on a write-by-nature control (submit, switch, file
//     picker, form field, data-write) before its handler runs, and marks
//     those controls aria-disabled with a "View only" title as they appear —
//     the CSS under [data-view-only] in app/globals.css draws them off;
//   · marks any other control whose press the guard just stopped, so it reads
//     as off from then on.
//
// useViewOnly() is the context for the few shared primitives that say it in
// their own words (SendConfirmModal, the notification bell, the personal-page
// gate). The server refuses every write regardless — this is what the person
// sees, not what protects the data (middleware.js, lib/currentMember.js).
"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Eye, UserRound } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { showToast } from "@/lib/toast";
import {
  installViewOnlyGuard,
  personalPageFor,
  WRITE_CONTROL_SELECTOR,
  BLOCKED_ATTR,
  VIEW_ONLY_TOAST_TAG,
  GESTURE_WINDOW_MS,
} from "@/lib/impersonation/viewOnly";

const ViewOnlyContext = createContext(false);

/** True only inside a read-only support session. */
export function useViewOnly() {
  return useContext(ViewOnlyContext);
}

// Where a write-by-nature control counts: the page and its dialogs — never
// the shell's rail, top bar or account menu (navigation, search, the theme
// toggle and "End session" must keep working).
const SCOPE = "main, [role=\"dialog\"]";
const PRESSABLE = "button, a, [role=\"button\"], [role=\"menuitem\"], [role=\"switch\"], [role=\"tab\"], label, input, select, textarea";

function markOff(el, title) {
  if (!el || el.getAttribute(BLOCKED_ATTR) === "1") return;
  el.setAttribute(BLOCKED_ATTR, "1");
  el.setAttribute("aria-disabled", "true");
  if (!el.getAttribute("title")) el.setAttribute("title", title);
}

function ViewOnlyGuard() {
  const { t } = useTranslation();

  useEffect(() => {
    const title = t("app.viewOnly.title");
    const toast = () => showToast({ message: t("app.viewOnly.toast"), tone: "info", tag: VIEW_ONLY_TOAST_TAG });
    let lastGesture = { el: null, at: 0 };

    const uninstall = installViewOnlyGuard(window, {
      onBlocked() {
        // Only a refusal that FOLLOWS a press is the person's doing; a page
        // that posts on mount (a heal, a beacon) is refused silently, the way
        // the server refused it before.
        if (Date.now() - lastGesture.at > GESTURE_WINDOW_MS) return;
        markOff(lastGesture.el?.closest?.(PRESSABLE) || lastGesture.el, title);
        toast();
      },
    });

    const writeControl = (el) => {
      const hit = el?.closest?.(WRITE_CONTROL_SELECTOR);
      return hit && hit.closest(SCOPE) ? hit : null;
    };
    const onPress = (e) => {
      lastGesture = { el: e.target, at: Date.now() };
      const hit = writeControl(e.target);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      toast();
    };
    const onSubmit = (e) => {
      lastGesture = { el: e.submitter || e.target, at: Date.now() };
      if (!e.target?.closest?.(SCOPE)) return;
      e.preventDefault();
      e.stopPropagation();
      toast();
    };
    const onKey = (e) => {
      lastGesture = { el: e.target, at: Date.now() };
    };
    // Capture phase on the window: runs before React's own listeners on the
    // root, so a stopped press never reaches the control's onClick.
    window.addEventListener("click", onPress, true);
    window.addEventListener("submit", onSubmit, true);
    window.addEventListener("keydown", onKey, true);

    // The "View only" title and aria-disabled on every write-by-nature
    // control, as the page draws them (lists load, dialogs open).
    const label = (root) => {
      for (const el of root.querySelectorAll?.(WRITE_CONTROL_SELECTOR) || []) {
        if (!el.closest(SCOPE)) continue;
        el.setAttribute("aria-disabled", "true");
        if (!el.getAttribute("title")) el.setAttribute("title", title);
      }
    };
    label(document);
    // At most once a frame, however busy the page is — only in a support
    // session, never for a real member.
    let queued = 0;
    const observer =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (queued) return;
            queued = requestAnimationFrame(() => {
              queued = 0;
              label(document);
            });
          })
        : null;
    observer?.observe(document.body, { childList: true, subtree: true });

    return () => {
      uninstall();
      observer?.disconnect();
      if (queued) cancelAnimationFrame(queued);
      window.removeEventListener("click", onPress, true);
      window.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [t]);

  return null;
}

/**
 * The page itself, or — on a personal page in a support session — the
 * notice. One gate for every personal page (lib/impersonation/viewOnly.js
 * PERSONAL_PAGES), so the page never mounts and never asks its "my"
 * endpoint for the owner's own data.
 */
export function PersonalPageGate({ children }) {
  const viewOnly = useViewOnly();
  const pathname = usePathname();
  const { t } = useTranslation();
  const page = viewOnly ? personalPageFor(pathname) : null;
  if (!page) return children;
  return (
    <div className="max-w-xl mx-auto px-4 py-12" data-personal-page-notice={page.what}>
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <UserRound size={28} className="mx-auto text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">{t("app.viewOnly.personalTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t("app.viewOnly.personalBody")}</p>
      </div>
    </div>
  );
}

/** A small "View only" line, for a primitive that replaces its own button. */
export function ViewOnlyNote({ className = "" }) {
  const { t } = useTranslation();
  return (
    <p className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`} data-view-only-note>
      <Eye size={13} /> {t("app.viewOnly.title")}
    </p>
  );
}

export default function ViewOnlyProvider({ viewOnly = false, children }) {
  return (
    <ViewOnlyContext.Provider value={Boolean(viewOnly)}>
      {viewOnly ? <ViewOnlyGuard /> : null}
      {children}
    </ViewOnlyContext.Provider>
  );
}
