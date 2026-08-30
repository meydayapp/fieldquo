"use client";

// app/components/designer/DrawSidebar.js
// Ported near verbatim from `components/draw-sidebar.tsx`.
import { ColorPicker } from "@/app/components/designer/ColorPicker";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { STROKE_COLOR, STROKE_WIDTH } from "@/lib/designer/constants";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function DrawSidebar({ editor, activeTool, onChangeActiveTool }) {
  const colorValue = editor?.getActiveStrokeColor() || STROKE_COLOR;
  const widthValue = editor?.getActiveStrokeWidth() || STROKE_WIDTH;

  const onClose = () => {
    editor?.disableDrawingMode();
    onChangeActiveTool("select");
  };

  const onColorChange = (value) => editor?.changeStrokeColor(value);
  const onWidthChange = (value) => editor?.changeStrokeWidth(value);

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        activeTool === "draw" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Drawing mode" description="Modify brush settings" />
      <div className="overflow-y-auto">
        <div className="space-y-6 border-b p-4">
          <Label className="text-sm">Brush width</Label>
          <Slider
            value={[widthValue]}
            onValueChange={(values) => onWidthChange(values[0])}
          />
        </div>
        <div className="space-y-6 p-4">
          <ColorPicker value={colorValue} onChange={onColorChange} />
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
