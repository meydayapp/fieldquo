"use client";

// app/components/designer/FilterSidebar.js
// Ported near verbatim from `components/filter-sidebar.tsx`.
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { filters } from "@/lib/designer/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function FilterSidebar({ editor, activeTool, onChangeActiveTool }) {
  const onClose = () => onChangeActiveTool("select");

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        activeTool === "filter" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Filters" description="Apply a filter to selected image" />
      <div className="overflow-y-auto">
        <div className="space-y-1 border-b p-4">
          {filters.map((filter) => (
            <Button
              key={filter}
              variant="secondary"
              size="lg"
              className="h-16 w-full justify-start text-left"
              onClick={() => editor?.changeImageFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
