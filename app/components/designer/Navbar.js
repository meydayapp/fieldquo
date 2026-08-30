"use client";

// app/components/designer/Navbar.js
//
// Ported from `components/navbar.tsx`. Departures from the source, all per
// AGENTS.md:
//
//   - No @tanstack/react-query `useMutationState` — save status is now the
//     `saveStatus` prop Editor.js computes itself (see the comment there).
//   - No `use-file-picker` dependency — "Open" uses a plain hidden
//     <input type="file"> ref, which is all use-file-picker wrapped anyway.
//   - No UserButton (dropped per AGENTS.md's drop list) and no Logo — the
//     designer mounts inside FieldQuo's own `/app` chrome, which already has
//     both; duplicating either here would be the second logo/account menu on
//     screen.
//   - react-icons (CiFileOn, BsCloudCheck, BsCloudSlash) replaced with
//     lucide-react, which this repo already depends on and react-icons is
//     explicitly told not to be added.
import { useRef } from "react";
import {
  ChevronDown,
  CloudCheck,
  CloudOff,
  Download,
  File,
  Loader,
  MousePointerClick,
  Redo2,
  Undo2,
} from "lucide-react";

import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {"unavailable"|"idle"|"pending"|"saved"|"error"} props.saveStatus
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function Navbar({ editor, activeTool, saveStatus, onChangeActiveTool }) {
  const fileInputRef = useRef(null);

  const openJsonFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = () => {
      editor?.loadJson(reader.result);
    };
  };

  return (
    <nav className="flex h-[68px] w-full items-center gap-x-8 overflow-x-auto border-b p-2 md:p-4">
      <div className="flex h-full w-full items-center gap-x-1">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              File
              <ChevronDown className="ml-2 size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <DropdownMenuItem
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-x-2"
            >
              <File className="size-6" />
              <div>
                <p>Open</p>
                <p className="text-xs text-muted-foreground">Open a JSON file</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            openJsonFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="mx-2 h-8 w-px bg-border" />
        <Hint label="Select" side="bottom" sideOffset={10}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChangeActiveTool("select")}
            className={cn(activeTool === "select" && "bg-muted")}
          >
            <MousePointerClick className="size-4" />
          </Button>
        </Hint>
        <Hint label="Undo" side="bottom" sideOffset={10}>
          <Button
            disabled={!editor?.canUndo()}
            variant="ghost"
            size="icon"
            onClick={() => editor?.onUndo()}
          >
            <Undo2 className="size-4" />
          </Button>
        </Hint>
        <Hint label="Redo" side="bottom" sideOffset={10}>
          <Button
            disabled={!editor?.canRedo()}
            variant="ghost"
            size="icon"
            onClick={() => editor?.onRedo()}
          >
            <Redo2 className="size-4" />
          </Button>
        </Hint>
        <div className="mx-2 h-8 w-px bg-border" />
        {saveStatus === "pending" && (
          <div className="flex items-center gap-x-2">
            <Loader className="size-4 animate-spin text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Saving...</div>
          </div>
        )}
        {saveStatus === "error" && (
          <div className="flex items-center gap-x-2">
            <CloudOff className="size-[20px] text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Failed to save</div>
          </div>
        )}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-x-2">
            <CloudCheck className="size-[20px] text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Saved</div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-x-4">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                Export
                <Download className="ml-4 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60">
              <DropdownMenuItem
                className="flex items-center gap-x-2"
                onClick={() => editor?.saveJson()}
              >
                <File className="size-6" />
                <div>
                  <p>JSON</p>
                  <p className="text-xs text-muted-foreground">Save for later editing</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-x-2"
                onClick={() => editor?.savePng()}
              >
                <File className="size-6" />
                <div>
                  <p>PNG</p>
                  <p className="text-xs text-muted-foreground">Best for sharing on the web</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-x-2"
                onClick={() => editor?.saveJpg()}
              >
                <File className="size-6" />
                <div>
                  <p>JPG</p>
                  <p className="text-xs text-muted-foreground">Best for printing</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-x-2"
                onClick={() => editor?.saveSvg()}
              >
                <File className="size-6" />
                <div>
                  <p>SVG</p>
                  <p className="text-xs text-muted-foreground">
                    Best for editing in vector software
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
