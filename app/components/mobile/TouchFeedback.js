"use client";

// app/components/mobile/TouchFeedback.js
//
// A phone has no `:hover`. Every `hover:bg-muted` in this codebase — and
// there are hundreds — is invisible on the device the owner is complaining
// about, because a finger never "hovers" before it lands. The only signal a
// touchscreen can give back is press: does the thing under your thumb visibly
// react the instant you touch it. That's what this wraps.
//
// Four things bundled together because they're always wanted together, and
// forgetting one is what makes a native-feeling tap feel web-feeling again:
//
//   1. A real, visible `:active` state (scale by default — see FEEDBACK below
//      for why scale over a background change).
//   2. `-webkit-tap-highlight-color: transparent` — Mobile Safari's own
//      "you tapped this" flash, which fights whatever we draw ourselves and
//      looks like a bug even when our own feedback is correct.
//   3. `touch-action: manipulation` — drops the ~300ms delay browsers used to
//      insert before firing `click`, in case the tap turns into a double-tap
//      zoom gesture. Nothing in this product wants double-tap-to-zoom on a
//      button.
//   4. `user-select: none` — a long-press on a tab label or nav row must not
//      raise the text-selection loupe. Selectable text (form fields, quote
//      line items) should never be wrapped in this.
//
// ── The iOS :active quirk ────────────────────────────────────────────────
//
// Mobile Safari does not apply `:active` styles on a plain tap unless SOME
// touch handler is attached to the element (or an ancestor) — a long-standing
// WebKit behaviour, not a bug in this component. Without it the CSS above is
// dead code on an iPhone specifically, the one device this whole task is
// about. `onTouchStart={() => {}}` is the standard, minimal fix: it does
// nothing itself, but its mere presence is what makes WebKit honour `:active`
// at all. Reasoned from documented WebKit behaviour, not felt on a real
// device this session — see docs/MOBILE-APP-FEEL.md's verification section.
//
// ── Polymorphic via useRender, the same way components/ui/badge.jsx is ─────
//
// A pressable is frequently a Link, sometimes a button, occasionally a plain
// row. `render` lets a caller hand in the element it actually wants
// (`<TouchFeedback render={<Link href="/app/jobs" />}>`) instead of this
// component forcing a `<button>` and the caller working around it.
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "@/lib/utils";

// Exported for the cases wrapping isn't practical — an existing `<Link>` or
// `<button>` that already carries its own className and shouldn't gain a
// wrapper element. `cn(TOUCH_FEEDBACK_CLASS, "existing classes")` applies the
// same four behaviours directly. Does NOT include the active-state class
// (scale/opacity), since those read oddly stacked with a caller's own hover
// styling — see FEEDBACK_CLASS below for that piece on its own.
export const TOUCH_FEEDBACK_CLASS =
  "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]";

// The two presses this repo's surfaces actually need. "scale" is the default
// because it works on any background — a fill colour it can darken.
// "opacity" suits something that's already a fill button (bg-inverted,
// bg-red-600) where scaling reads as more app-like than a colour shift.
const FEEDBACK_CLASS = {
  scale: "transition-transform duration-100 active:scale-[0.97]",
  opacity: "transition-opacity duration-100 active:opacity-70",
  none: "",
};

export default function TouchFeedback({
  className,
  render,
  feedback = "scale",
  onTouchStart,
  ...props
}) {
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps(
      {
        "data-slot": "touch-feedback",
        className: cn(TOUCH_FEEDBACK_CLASS, FEEDBACK_CLASS[feedback] ?? FEEDBACK_CLASS.scale, className),
        // See "The iOS :active quirk" above — this handler's body is
        // deliberately empty.
        onTouchStart: (e) => {
          onTouchStart?.(e);
        },
      },
      props,
    ),
    state: {},
  });
}
