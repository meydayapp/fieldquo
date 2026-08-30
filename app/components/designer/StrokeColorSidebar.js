"use client";

// app/components/designer/StrokeColorSidebar.js
// Ported from `components/stroke-color-sidebar.tsx`.
import { ColorPicker } from "@/app/components/designer/ColorPicker";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { STROKE_COLOR } from "@/lib/designer/constants";
import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function StrokeColorSidebar({ editor, activeTool, onChangeActiveTool }) {
  const value = editor?.getActiveStrokeColor() || STROKE_COLOR;

  const onClose = () => onChangeActiveTool("select");
  const onChange = (value) => editor?.changeStrokeColor(value);

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "stroke-color" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Stroke color" description="Add stroke color to your element" />
      <div className="overflow-y-auto">
        <div className="space-y-6 p-4">
          <ColorPicker value={value} onChange={onChange} />
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
