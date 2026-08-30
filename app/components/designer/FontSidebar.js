"use client";

// app/components/designer/FontSidebar.js
// Ported near verbatim from `components/font-sidebar.tsx`.
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { fonts } from "@/lib/designer/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function FontSidebar({ editor, activeTool, onChangeActiveTool }) {
  const value = editor?.getActiveFontFamily();

  const onClose = () => onChangeActiveTool("select");

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "font" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Font" description="Change the text font" />
      <div className="overflow-y-auto">
        <div className="space-y-1 border-b p-4">
          {fonts.map((font) => (
            <Button
              key={font}
              variant="secondary"
              size="lg"
              className={cn(
                "h-16 w-full justify-start text-left",
                value === font && "border-2 border-primary",
              )}
              style={{
                fontFamily: font,
                fontSize: "16px",
                padding: "8px 16px",
              }}
              onClick={() => editor?.changeFontFamily(font)}
            >
              {font}
            </Button>
          ))}
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
