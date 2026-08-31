"use client";

// app/components/mobile/BottomSheet.js
//
// The single highest-value piece of this pass: on a phone, a dialog centred
// in the middle of the screen reads as a website that happened to load on a
// small screen. A panel that rises from the bottom, with a handle a thumb can
// drag, reads as an app. Same content, same data, one interaction detail
// apart — and that detail is most of what "feels native" means in practice.
//
// ── One component, two DIFFERENT primitives, chosen by breakpoint ──────────
//
// The obvious approach is one Popup styled with responsive Tailwind classes
// that switch from a bottom sheet to a centred box at `lg`. That was tried
// first here and abandoned: @base-ui's Drawer drives its slide/swipe
// animation through an inline CSS transform bound to a live
// `--drawer-swipe-movement-y` variable the library itself writes on every
// pointer move (see its Popup CSS Variables in the docs). A responsive
// override can win the STATIC transform for the resting state, but it cannot
// stop the library writing a Y-axis swipe transform on a screen where a mouse
// makes no vertical drag gesture at all — the mechanism is simply built for
// one physical direction. Overriding an animation system a dependency owns,
// rather than not asking it to run in a context it wasn't designed for, is
// exactly the "reimplementing what a library already does, worse" AGENTS.md
// warns against for the focus trap specifically — the same reasoning extends
// to the gesture engine.
//
// So: below `lg`, this renders @base-ui's Drawer (bottom sheet, real
// swipe-to-dismiss, safe-area padding). At `lg` and above, it renders
// @base-ui's Dialog (centred, no swipe — a swipe gesture on a 27-inch monitor
// has no finger to track). Both share the exact same content markup through
// SheetSections below, so nothing about what a caller passes in — title,
// description, children, footer — differs between the two; only the chrome
// around it does. The caller sees one component and one prop surface.
//
// Both primitives get scroll lock, focus trap and Escape-to-close from
// @base-ui itself (the `modal` default), not reimplemented here — see
// @base-ui/react's dialog/drawer docs, "modal" prop: focus is trapped,
// document scroll is locked, outside pointer interaction is disabled, and
// focus returns to whatever opened it on close (`finalFocus`, default
// behaviour). iOS's classic "modal closes, page silently jumps to the top"
// bug is exactly what a naive `position: fixed` + manual scrollY save/restore
// gets wrong; @base-ui's own scroll lock is the tested implementation, so it
// is used rather than hand-rolled.
//
// ── Why the breakpoint is read with JS, not just `lg:hidden` ───────────────
//
// Everything else in this task avoids a JS breakpoint check in favour of pure
// CSS (see AppBar.js, and app/components/designer/StrokeWidthSidebar.js's own
// `md:relative` pattern). This is the one component where that isn't
// possible: `lg:hidden` can hide an element, but it cannot swap WHICH
// component subtree React mounted — Drawer.Root and Dialog.Root are
// different element trees, not one element restyled. `isDesktop` starts
// `false` on both server and first client render (mobile-first, matching
// the majority of this product's traffic and avoiding a hydration mismatch —
// see the comment on the hook below), and updates once after mount. The one
// visible consequence is a single re-render right after hydration on a
// desktop browser, before which nothing is open yet (`open` is controlled by
// the caller and normally starts `false`), so nothing is ever seen flashing
// from one presentation to the other.
import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { TOUCH_FEEDBACK_CLASS } from "@/app/components/mobile/TouchFeedback";

// Matches Tailwind's default `lg` (1024px) — this project doesn't override
// `--breakpoint-lg` in app/globals.css, so the two stay in sync without a
// shared constant to import (a plain number can't be imported out of a
// Tailwind `@theme` block).
const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  // Mobile-first default — see this file's header comment on why this
  // can't read `window` on the initial render without risking a hydration
  // mismatch (Dialog.Root and Drawer.Root are different trees, not one
  // element with different classes).
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);
    const onChange = (e) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

// The content both presentations share, parameterised over which namespace's
// Title/Description/Close parts to use — Drawer's extend Dialog's, but they
// are still two distinct sets of components, not one. This is the seam that
// keeps the two branches below from drifting into two copies of the same
// markup (AGENTS.md: "the copy is the one that rots, because it's the one
// nobody looks at"). `footer` is deliberately NOT handled in here — both
// branches pin it as a sibling of the scroll area instead (see each branch),
// so a caller's Save/Cancel row never scrolls out of reach on EITHER
// presentation. An earlier version rendered it inside this scrollable block
// on the desktop branch only, which meant it scrolled away on a tall sheet
// on desktop but stayed pinned on mobile — an inconsistency AGENTS.md's own
// "diff the payload" spirit says to catch by re-reading the two branches
// side by side rather than trusting each one in isolation.
function SheetSections({ TitleComp, DescriptionComp, CloseComp, title, description, hideTitle, closeLabel, children }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        {title ? (
          <TitleComp className={hideTitle ? "sr-only" : "text-base font-semibold text-foreground"}>
            {title}
          </TitleComp>
        ) : (
          // Dialog/Drawer both warn to the console without a Title unless one
          // is explicitly opted out of — an empty span keeps the flex layout
          // (Close button pinned right) without claiming a title that isn't
          // there. A sheet with no heading at all should still pass
          // `hideTitle` with a real (visually hidden) title for a screen
          // reader user, not omit `title` altogether.
          <span />
        )}
        <CloseComp
          aria-label={closeLabel}
          className={cn(
            TOUCH_FEEDBACK_CLASS,
            "-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-transform active:scale-90",
          )}
        >
          <X size={18} />
        </CloseComp>
      </div>

      {description && (
        <DescriptionComp className="mt-1 text-sm text-muted-foreground">{description}</DescriptionComp>
      )}

      <div className={title || description ? "mt-4" : undefined}>{children}</div>
    </>
  );
}

export default function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  children,
  footer,
  className,
  initialFocus,
  finalFocus,
}) {
  const isDesktop = useIsDesktop();
  const { t } = useTranslation();
  // Reuses "app.action.close" (see AppBar.js's identical comment on
  // "app.action.back") rather than a new key — already translated
  // everywhere the app catalogue is, unlike a freshly-minted one.
  const closeLabel = t("app.action.close", "Close");

  if (isDesktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black/40 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Popup
              initialFocus={initialFocus}
              finalFocus={finalFocus}
              className={cn(
                "flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl outline-none transition-[transform,opacity] duration-150 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
                className,
              )}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <SheetSections
                  TitleComp={Dialog.Title}
                  DescriptionComp={Dialog.Description}
                  CloseComp={Dialog.Close}
                  title={title}
                  description={description}
                  hideTitle={hideTitle}
                  closeLabel={closeLabel}
                >
                  {children}
                </SheetSections>
              </div>

              {footer && (
                // Pinned OUTSIDE the scroll area above, same as the mobile
                // branch below — a tall sheet's Save/Cancel row stays put on
                // both presentations rather than only on the one someone
                // happened to test.
                <div className="mt-4 flex shrink-0 gap-3 border-t border-border pt-4">{footer}</div>
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black/40 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[swiping]:duration-0 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup
            initialFocus={initialFocus}
            finalFocus={finalFocus}
            className={cn(
              // touch-action stays "auto" here (not manipulation/none) —
              // @base-ui's own docs set this deliberately so the popup can
              // still receive the touch events its swipe recognizer needs;
              // TOUCH_FEEDBACK_CLASS is applied to the individual controls
              // inside (the Close button, and whatever the caller's `footer`
              // buttons use), never to the Popup itself.
              "flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card text-foreground shadow-2xl outline-none touch-auto [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[swiping]:transition-none data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
              className,
            )}
          >
            {/* Drag handle — visual affordance. The actual dismiss gesture is
                @base-ui's own touch-event swipe recognizer on the Popup
                (Drawer.Content below is explicitly exempted from swipe
                interference for text selection, per the Drawer docs); this
                bar is not itself a listener. It is not a button because the
                header row two lines down already carries a real Close
                button — a handle that's ALSO independently clickable reads
                as two controls doing the same thing right next to each
                other. */}
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />

            <Drawer.Content
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-5 pt-3",
                // No footer: THIS is the bottom-most element, so it carries
                // the safe-area padding that clears the home indicator.
                footer ? "pb-3" : "pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
              )}
            >
              <SheetSections
                TitleComp={Drawer.Title}
                DescriptionComp={Drawer.Description}
                CloseComp={Drawer.Close}
                title={title}
                description={description}
                hideTitle={hideTitle}
                closeLabel={closeLabel}
              >
                {children}
              </SheetSections>
            </Drawer.Content>

            {footer && (
              // Pinned OUTSIDE Drawer.Content's scroll area, so it never
              // scrolls away with long content — this is the bottom-most
              // element when it exists, so IT carries the safe-area padding.
              <div className="shrink-0 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                {footer}
              </div>
            )}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
