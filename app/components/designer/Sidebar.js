"use client";

// app/components/designer/Sidebar.js
//
// Ported from `components/sidebar.tsx`. "Design" (templates) and "AI" were
// dropped in the first pass of this port and restored per the owner's
// 2026-08-30 correction — see Editor.js's module doc for the full reasoning.
// Both tabs are real now: Design opens TemplateSidebar (free,
// DesignTemplate-backed), AI opens AiSidebar (the one premium feature,
// gated in lib/designer/aiImageAdapter.js).
import { ImageIcon, LayoutTemplate, Pencil, Settings, Shapes, Sparkles, Type } from "lucide-react";

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
          icon={LayoutTemplate}
          label="Design"
          isActive={activeTool === "templates"}
          onClick={() => onChangeActiveTool("templates")}
        />
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
          icon={Sparkles}
          label="AI"
          isActive={activeTool === "ai"}
          onClick={() => onChangeActiveTool("ai")}
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
