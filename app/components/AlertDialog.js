"use client";

// app/components/AlertDialog.js
//
// The one modal primitive: a scrim, a centred card, focus in, Tab trapped,
// focus back, and whatever the caller says Escape and the scrim should do —
// including nothing.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The sales portal grew two modals in one evening: the "You're shown as Off"
// reminder (AvailableReminder.js) and the incoming-call ring (IncomingCallDock
// .js). Each wanted the same eight lines — remember what had focus, move it
// to the primary button, wrap Tab both ways, put focus back — and the second
// copy is the one that rots, because it is the one nobody looks at (AGENTS.md
// failure class 4). So the mechanics live here once, and each caller keeps
// only what is its own: its words, its buttons, its data-* hooks, and its
// answer to "what does Escape do".
//
// It is shadcn's alert-dialog shape (centred over a scrim, cannot be
// dismissed by clicking outside, focus trapped, explicit actions) without
// the Radix dependency: this repo has no component library, and a ring must
// not wait on one.
//
// ══ Dismissal is the caller's decision, not a default ═════════════════════
//
// `onEscape` and `onScrim` are both OPTIONAL and both default to nothing.
// The reminder passes its OK for both, because OK is what a stray tap means
// there. The ring passes NEITHER: a contractor ringing back is not something
// to lose by touching the wrong pixel or pressing the wrong key, and Decline
// is a button with a name. A primitive whose default was "Escape closes"
// would have made the ring dismissable by accident the day somebody forgot
// to opt out, so the safe direction is the default.
//
// ══ Focus ═════════════════════════════════════════════════════════════════
//
// On open, focus moves to `initialFocusRef` if given, else the first
// focusable in the card. Tab and Shift+Tab wrap between the first and last
// focusable INSIDE the card — measured on each keypress, not cached, so a
// button that appears (a refusal's retry) or disables is counted. On close,
// focus returns to whatever had it, when that thing can still take it.
//
// ══ Placement ═════════════════════════════════════════════════════════════
//
// `placement="center"` is the alert-dialog: centred at every width, a full-
// width card with the wrapper's 16px gutters on a phone. `placement="sheet"`
// is what the reminder shipped with — bottom-anchored below sm, centred
// from sm up — and is kept so that modal renders exactly what it rendered
// before this file existed.

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {object} props
 * @param {boolean} props.open — nothing is rendered while false
 * @param {"dialog"|"alertdialog"} [props.role]
 * @param {string} props.labelledBy — id of the heading inside the card
 * @param {string} [props.describedBy] — id of the body text inside the card
 * @param {import("react").RefObject} [props.initialFocusRef] — focused on open
 * @param {() => void} [props.onEscape] — Escape; absent = Escape does nothing
 * @param {() => void} [props.onScrim] — a click outside the card; absent = nothing
 * @param {string} [props.scrimLabel] — the scrim's accessible name when it acts
 * @param {"center"|"sheet"} [props.placement]
 * @param {string} [props.zClass] — the wrapper's z-index utility
 * @param {string} [props.cardClass] — extra classes on the card
 * @param {object} [props.wrapperProps] — data-* hooks for the wrapper
 * @param {object} [props.cardProps] — data-* hooks for the card
 */
export default function AlertDialog({
  open,
  role = "dialog",
  labelledBy,
  describedBy,
  initialFocusRef,
  onEscape,
  onScrim,
  scrimLabel,
  placement = "center",
  zClass = "z-[65]",
  cardClass = "",
  wrapperProps = {},
  cardProps = {},
  children,
}) {
  const cardRef = useRef(null);
  const returnTo = useRef(null);
  // Read through refs so the effect below binds once per open, not once per
  // render: re-binding on every parent render would put focus back on the
  // primary button while the rep is tabbing to the other one.
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  const initialRef = useRef(initialFocusRef);
  initialRef.current = initialFocusRef;

  // Focus in, trap, Escape, focus back.
  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = typeof document !== "undefined" ? document.activeElement : null;
    const focusables = () => (cardRef.current ? [...cardRef.current.querySelectorAll(FOCUSABLE)] : []);
    const primary = initialRef.current?.current || focusables()[0] || null;
    primary?.focus?.();
    const onKey = (e) => {
      if (e.key === "Escape") {
        // Only when the caller gave Escape a meaning. Otherwise the key is
        // still swallowed, so it cannot reach a parent that would act on it.
        e.preventDefault();
        escapeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      // Focus that has escaped the card (a click on the page behind, which
      // the scrim should have caught) is brought back on the next Tab.
      const inside = cardRef.current?.contains(document.activeElement);
      if (!inside) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const back = returnTo.current;
      if (back && typeof back.focus === "function") back.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const wrapperLayout = placement === "sheet" ? "items-end sm:items-center sm:justify-center" : "items-center justify-center";

  return createPortal(
    <div className={`fixed inset-0 ${zClass} flex ${wrapperLayout} p-4`} {...wrapperProps}>
      {onScrim ? (
        <button type="button" className="absolute inset-0 bg-black/40" aria-label={scrimLabel} onClick={onScrim} tabIndex={-1} />
      ) : (
        // A scrim that does nothing is not a button: a screen reader would
        // announce a control with no effect.
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`relative w-full sm:max-w-md rounded-2xl bg-card text-foreground shadow-xl p-5 space-y-4 ${cardClass}`}
        {...cardProps}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
