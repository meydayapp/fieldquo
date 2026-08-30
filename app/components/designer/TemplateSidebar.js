"use client";

// app/components/designer/TemplateSidebar.js
//
// Restored per the owner's 2026-08-30 correction: dropped in the first pass
// because its backend was Drizzle/Hono (ai-sidebar's usePaywall was also
// dropped there and stays dropped — this gallery is free). Backend is now
// GET /api/designer/templates + the DesignTemplate Prisma model
// (prisma/schema.prisma, seeded by prisma/seed-design-templates.js).
//
// Differs from the source clone's template-sidebar.tsx in two ways:
//   - No `isPro`/paywall check — every template here is free.
//   - No useConfirm dialog (that hook was dropped along with everything else
//     on AGENTS.md's drop list). A native window.confirm() covers the one
//     thing that dialog was protecting: applying a template DISCARDS the
//     canvas's current contents, and that needs a beat before it happens
//     regardless of which confirmation UI asks for it.
import { useEffect, useState } from "react";
import { AlertTriangle, Layers, Loader } from "lucide-react";

import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function TemplateSidebar({ editor, activeTool, onChangeActiveTool }) {
  const [templates, setTemplates] = useState(null); // null = loading
  const [error, setError] = useState(false);

  useEffect(() => {
    if (activeTool !== "templates" || templates !== null) return;

    let cancelled = false;
    fetch("/api/designer/templates")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTool, templates]);

  const onClose = () => onChangeActiveTool("select");

  const onClick = (template) => {
    if (
      !window.confirm(
        "Replace the current design with this template? Anything on the canvas now will be lost.",
      )
    ) {
      return;
    }
    editor?.loadJson(JSON.stringify(template.json));
  };

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        activeTool === "templates" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Templates" description="Start from a ready-made design" />
      {templates === null && !error && (
        <div className="flex flex-1 items-center justify-center">
          <Loader className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-y-4">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Failed to load templates</p>
        </div>
      )}
      {templates !== null && !error && templates.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-y-4 p-4 text-center">
          <Layers className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No templates yet</p>
          <p className="text-xs text-muted-foreground">
            FieldQuo hasn&apos;t published any starter designs on this deployment. Start from a
            blank canvas — nothing here is broken.
          </p>
        </div>
      )}
      {templates !== null && !error && templates.length > 0 && (
        <div className="overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 p-4">
            {templates.map((template) => (
              <button
                key={template.id}
                style={{ aspectRatio: `${template.width}/${template.height}` }}
                onClick={() => onClick(template)}
                className="group relative w-full overflow-hidden rounded-sm border bg-muted transition hover:opacity-75"
              >
                {template.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.thumbnailUrl}
                    alt={template.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // Honest fallback, not a broken <img>: a template with no
                  // stored thumbnail (see the Prisma model's own comment)
                  // shows its name and dimensions instead of implying a
                  // preview image exists.
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary p-2 text-center">
                    <span className="text-xs font-medium text-secondary-foreground">
                      {template.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {template.width}×{template.height}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 w-full truncate bg-black/50 p-1 text-left text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                  {template.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
