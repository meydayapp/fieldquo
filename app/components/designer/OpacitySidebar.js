"use client";

// app/components/designer/OpacitySidebar.js
// Ported near verbatim from `components/opacity-sidebar.tsx`.
import { useEffect, useMemo, useState } from "react";

import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function OpacitySidebar({ editor, activeTool, onChangeActiveTool }) {
  const initialValue = editor?.getActiveOpacity() || 1;
  const selectedObject = useMemo(
    () => editor?.selectedObjects[0],
    [editor?.selectedObjects],
  );

  const [opacity, setOpacity] = useState(initialValue);

  useEffect(() => {
    if (selectedObject) {
      setOpacity(selectedObject.get("opacity") || 1);
    }
  }, [selectedObject]);

  const onClose = () => onChangeActiveTool("select");

  const onChange = (value) => {
    editor?.changeOpacity(value);
    setOpacity(value);
  };

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        activeTool === "opacity" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Opacity" description="Change the opacity of the selected object" />
      <div className="overflow-y-auto">
        <div className="space-y-4 border-b p-4">
          <Slider
            value={[opacity]}
            onValueChange={(values) => onChange(values[0])}
            max={1}
            min={0}
            step={0.01}
          />
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
