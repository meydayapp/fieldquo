// app/components/designer/ToolSidebarClose.js
// Ported near verbatim from `components/tool-sidebar-close.tsx`, `bg-white`
// swapped for `bg-card` per AGENTS.md item 5 so this reads correctly in dark
// mode instead of a light tab floating on a dark panel.
import { ChevronsLeft } from "lucide-react";

/**
 * @param {Object} props
 * @param {() => void} props.onClick
 */
export function ToolSidebarClose({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="group absolute -right-[1.80rem] top-1/2 flex h-[70px] -translate-y-1/2 transform items-center justify-center rounded-r-xl border-y border-r bg-card px-1 pr-2"
    >
      <ChevronsLeft className="size-4 text-foreground transition group-hover:opacity-75" />
    </button>
  );
}
