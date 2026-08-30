"use client";

// app/components/designer/ShapeSidebar.js
//
// Ported from `components/shape-sidebar.tsx`. react-icons (IoTriangle,
// FaDiamond, FaCircle, FaSquare, FaSquareFull) replaced with lucide-react;
// the two square shapes (soft-corner rectangle vs. sharp rectangle) both use
// lucide's single `Square` glyph since lucide has no separate "filled
// square" icon the way Font Awesome does — a cosmetic difference in the
// button icon only, not in what addSoftRectangle()/addRectangle() draw.
// ScrollArea replaced with a plain `overflow-y-auto` div per AGENTS.md
// (base-ui/react does ship a scroll-area primitive, but the task is explicit
// that this port doesn't use it). `bg-white` swapped for `bg-card`.
import { Circle, Diamond, Square, Triangle } from "lucide-react";

import { ShapeTool } from "@/app/components/designer/ShapeTool";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function ShapeSidebar({ editor, activeTool, onChangeActiveTool }) {
  const onClose = () => onChangeActiveTool("select");

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "shapes" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Shapes" description="Add shapes to your canvas" />
      <div className="overflow-y-auto">
        <div className="grid grid-cols-3 gap-4 p-4">
          <ShapeTool onClick={() => editor?.addCircle()} icon={Circle} />
          <ShapeTool onClick={() => editor?.addSoftRectangle()} icon={Square} />
          <ShapeTool onClick={() => editor?.addRectangle()} icon={Square} />
          <ShapeTool onClick={() => editor?.addTriangle()} icon={Triangle} />
          <ShapeTool
            onClick={() => editor?.addInverseTriangle()}
            icon={Triangle}
            iconClassName="rotate-180"
          />
          <ShapeTool onClick={() => editor?.addDiamond()} icon={Diamond} />
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
