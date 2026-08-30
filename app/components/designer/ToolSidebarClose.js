// app/components/designer/ToolSidebarClose.js
//
// Ported from `components/tool-sidebar-close.tsx`, `bg-white` swapped for
// `bg-card` per AGENTS.md item 5 so this reads correctly in dark mode
// instead of a light tab floating on a dark panel.
//
// One button, two shapes, picked with `md:` overrides rather than two
// components — every tool panel already has exactly one
// `<ToolSidebarClose onClick={onClose} />` call, and duplicating that call
// site 14 times just to swap in a mobile variant would be the "copy-paste
// instead of a shared helper" failure class AGENTS.md names. Below `md` the
// panel it sits in is a bottom sheet (see e.g. ShapeSidebar.js), so the
// side-tab position/shape makes no sense there — this renders as a plain "X"
// in the sheet's top-right corner instead, then reverts to the original
// side-tab chevron at `md` and up.
import { ChevronsLeft, X } from "lucide-react";

/**
 * @param {Object} props
 * @param {() => void} props.onClick
 */
export function ToolSidebarClose({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close panel"
      className="group absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full border bg-card shadow-sm md:top-1/2 md:-right-[1.80rem] md:h-[70px] md:w-auto md:-translate-y-1/2 md:rounded-l-none md:rounded-r-xl md:border-y md:border-r md:border-l-0 md:px-1 md:pr-2 md:shadow-none"
    >
      <X className="size-4 text-foreground transition group-hover:opacity-75 md:hidden" />
      <ChevronsLeft className="hidden size-4 text-foreground transition group-hover:opacity-75 md:block" />
    </button>
  );
}
