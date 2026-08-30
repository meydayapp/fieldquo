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
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
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
