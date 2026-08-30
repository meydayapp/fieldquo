"use client";

// app/components/designer/SettingsSidebar.js
//
// Ported from `components/settings-sidebar.tsx`, and the one sidebar this
// port genuinely extends rather than just translates: AGENTS.md item 8 asks
// for lib/marketing/ratios.js's AD_RATIOS presets and reflow() to be wired
// into the editor, and this is where a size control already lived.
//
// The source clone's changeSize() only ever set the workspace rect's width
// and height — nothing else moved or rescaled (see ratios.js's own header
// comment on exactly this bug). The "Frame" buttons below call
// editor.changeRatio() instead, which reflows every object through
// lib/marketing/ratios.js's reflow() — imported, not reimplemented, per the
// explicit instruction not to duplicate that scale math here. The manual
// width/height form still calls plain changeSize() for a custom size,
// because reflowing to an arbitrary typed-in size the person is actively
// adjusting (as opposed to jumping to a named platform frame) is not what
// AD_RATIOS is for.
import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { ColorPicker } from "@/app/components/designer/ColorPicker";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { AD_RATIOS } from "@/lib/marketing/ratios";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function SettingsSidebar({ editor, activeTool, onChangeActiveTool }) {
  const workspace = editor?.getWorkspace();

  const initialWidth = useMemo(() => `${workspace?.width ?? 0}`, [workspace]);
  const initialHeight = useMemo(() => `${workspace?.height ?? 0}`, [workspace]);
  const initialBackground = useMemo(() => workspace?.fill ?? "#ffffff", [workspace]);

  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [background, setBackground] = useState(initialBackground);

  useEffect(() => {
    setWidth(initialWidth);
    setHeight(initialHeight);
    setBackground(initialBackground);
  }, [initialWidth, initialHeight, initialBackground]);

  const changeWidth = (value) => setWidth(value);
  const changeHeight = (value) => setHeight(value);
  const changeBackground = (value) => {
    setBackground(value);
    editor?.changeBackground(value);
  };

  const onSubmit = (e) => {
    e.preventDefault();

    editor?.changeSize({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    });
  };

  const onClose = () => onChangeActiveTool("select");

  const activeRatioKey = AD_RATIOS.find(
    (r) => String(r.width) === width && String(r.height) === height,
  )?.key;

  const warning = editor?.getRatioWarning?.();

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "settings" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Settings" description="Change the look of your workspace" />
      <div className="overflow-y-auto">
        <div className="space-y-3 border-b p-4">
          <Label className="text-sm">Frame</Label>
          <div className="grid grid-cols-2 gap-2">
            {AD_RATIOS.map((r) => (
              <Button
                key={r.key}
                type="button"
                variant="secondary"
                size="sm"
                className={cn(
                  "h-auto flex-col items-start gap-0.5 py-2 text-left",
                  activeRatioKey === r.key && "border-2 border-primary",
                )}
                onClick={() => editor?.changeRatio(r.key)}
              >
                <span className="text-xs font-medium">{r.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {r.width}×{r.height}
                </span>
              </Button>
            ))}
          </div>
          {warning && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Reflow is a starting point — {warning.overflowing.length}{" "}
                {warning.overflowing.length === 1 ? "object extends" : "objects extend"} past
                this frame&apos;s edge. Nudge it back in before exporting.
              </span>
            </div>
          )}
        </div>
        <form className="space-y-4 p-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Height</Label>
            <Input
              placeholder="Height"
              value={height}
              type="number"
              onChange={(e) => changeHeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Width</Label>
            <Input
              placeholder="Width"
              value={width}
              type="number"
              onChange={(e) => changeWidth(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Resize
          </Button>
        </form>
        <div className="p-4">
          <ColorPicker
            value={background} // We dont support gradients or patterns
            onChange={changeBackground}
          />
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
