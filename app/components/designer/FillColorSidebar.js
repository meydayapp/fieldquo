"use client";

// app/components/designer/FillColorSidebar.js
// Ported from `components/fill-color-sidebar.tsx`.
import { ColorPicker } from "@/app/components/designer/ColorPicker";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { FILL_COLOR } from "@/lib/designer/constants";
import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function FillColorSidebar({ editor, activeTool, onChangeActiveTool }) {
  const value = editor?.getActiveFillColor() || FILL_COLOR;

  const onClose = () => onChangeActiveTool("select");
  const onChange = (value) => editor?.changeFillColor(value);

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "fill" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Fill color" description="Add fill color to your element" />
      <div className="overflow-y-auto">
        <div className="space-y-6 p-4">
          <ColorPicker value={value} onChange={onChange} />
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
