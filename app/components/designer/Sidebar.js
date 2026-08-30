"use client";

// app/components/designer/Sidebar.js
//
// Ported from `components/sidebar.tsx` with two icons removed: "Design"
// (opened template-sidebar) and "AI" (opened ai-sidebar). Both sidebars are
// dropped per AGENTS.md — leaving their launcher icons in this rail would be
// exactly the dead-button failure AGENTS.md's "rule that matters most"
// warns about, a tab that opens onto nothing.
import { ImageIcon, Pencil, Settings, Shapes, Type } from "lucide-react";

import { SidebarItem } from "@/app/components/designer/SidebarItem";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function Sidebar({ activeTool, onChangeActiveTool }) {
  return (
    <aside className="flex h-full w-[100px] flex-col overflow-y-auto border-r bg-card">
      <ul className="flex flex-col">
        <SidebarItem
          icon={ImageIcon}
          label="Image"
          isActive={activeTool === "images"}
          onClick={() => onChangeActiveTool("images")}
        />
        <SidebarItem
          icon={Type}
          label="Text"
          isActive={activeTool === "text"}
          onClick={() => onChangeActiveTool("text")}
        />
        <SidebarItem
          icon={Shapes}
          label="Shapes"
          isActive={activeTool === "shapes"}
          onClick={() => onChangeActiveTool("shapes")}
        />
        <SidebarItem
          icon={Pencil}
          label="Draw"
          isActive={activeTool === "draw"}
          onClick={() => onChangeActiveTool("draw")}
        />
        <SidebarItem
          icon={Settings}
          label="Settings"
          isActive={activeTool === "settings"}
          onClick={() => onChangeActiveTool("settings")}
        />
      </ul>
    </aside>
  );
}
