"use client";

// app/components/designer/Editor.js
//
// Ported from the source clone's `components/editor.tsx` — the root of the
// canvas editor. Two structural departures from the source, both required by
// AGENTS.md:
//
//   - No @tanstack/react-query. The source read save status off a
//     `useMutationState` hook tied to its own `useUpdateProject` mutation,
//     which this repo has no equivalent of (and shouldn't: the Prisma model
//     and save route are explicitly "other work" — see the module doc at the
//     bottom of this file). Instead this component owns `saveStatus` itself,
//     driven by actually awaiting whatever `saveCallback` the caller passes
//     in. That is a real status, not a decorative one: if `saveCallback` is
//     omitted, no "Saved"/"Saving" indicator renders at all, rather than
//     lying about a save that isn't wired up.
//   - No ai-sidebar, template-sidebar or remove-bg-sidebar. Per AGENTS.md,
//     ai-sidebar (Replicate image generation) and every usePaywall call are
//     dropped outright. remove-bg-sidebar depended on the same
//     usePaywall + AI-backend pairing — shipping its button with the backend
//     gone would be exactly the dead-control failure AGENTS.md warns about,
//     so it goes with it. template-sidebar's useGetTemplates/useConfirm are
//     both explicitly on the drop list, and with it dropped, `templates` is
//     no longer offered from the left icon rail (see Sidebar.js).
//
// `initialData` and `saveCallback` are the injection point, exactly as the
// source used them: this component builds and renders the whole editor and
// never itself calls an API. `initialData` is `{ json, width, height }` —
// the same shape use-load-state.ts / use-history.ts read/write.
import { fabric } from "fabric";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { selectionDependentTools } from "@/lib/designer/constants";
import { debounce } from "@/lib/designer/debounce";
import { useEditor } from "@/app/components/designer/hooks/useEditor";

import { Navbar } from "@/app/components/designer/Navbar";
import { Footer } from "@/app/components/designer/Footer";
import { Sidebar } from "@/app/components/designer/Sidebar";
import { Toolbar } from "@/app/components/designer/Toolbar";
import { ShapeSidebar } from "@/app/components/designer/ShapeSidebar";
import { FillColorSidebar } from "@/app/components/designer/FillColorSidebar";
import { StrokeColorSidebar } from "@/app/components/designer/StrokeColorSidebar";
import { StrokeWidthSidebar } from "@/app/components/designer/StrokeWidthSidebar";
import { OpacitySidebar } from "@/app/components/designer/OpacitySidebar";
import { TextSidebar } from "@/app/components/designer/TextSidebar";
import { FontSidebar } from "@/app/components/designer/FontSidebar";
import { ImageSidebar } from "@/app/components/designer/ImageSidebar";
import { FilterSidebar } from "@/app/components/designer/FilterSidebar";
import { DrawSidebar } from "@/app/components/designer/DrawSidebar";
import { SettingsSidebar } from "@/app/components/designer/SettingsSidebar";

/**
 * @param {Object} props
 * @param {{json?: string, width?: number, height?: number}} [props.initialData]
 * @param {(values: {json: string, height: number, width: number}) => (void|Promise<void>)} [props.saveCallback]
 */
export function Editor({ initialData, saveCallback }) {
  // "unavailable" (no saveCallback wired — nothing rendered), "idle" (has a
  // callback, nothing saved yet this session), "pending", "saved", "error".
  const [saveStatus, setSaveStatus] = useState(saveCallback ? "idle" : "unavailable");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useMemo(
    () =>
      debounce((values) => {
        if (!saveCallback) return;
        setSaveStatus("pending");
        // saveCallback may be sync or return a Promise — the source clone's
        // caller was always a react-query `mutate`, which is fire-and-forget
        // by design. This one is awaited either way so `saveStatus` reflects
        // what actually happened rather than optimistically claiming "Saved"
        // before an async save has even settled.
        Promise.resolve()
          .then(() => saveCallback(values))
          .then(() => setSaveStatus("saved"))
          .catch((err) => {
            console.error("[designer] save failed:", err);
            setSaveStatus("error");
          });
      }, 500),
    [saveCallback],
  );

  const [activeTool, setActiveTool] = useState("select");

  const onClearSelection = useCallback(() => {
    if (selectionDependentTools.includes(activeTool)) {
      setActiveTool("select");
    }
  }, [activeTool]);

  const { init, editor } = useEditor({
    defaultState: initialData?.json,
    defaultWidth: initialData?.width,
    defaultHeight: initialData?.height,
    clearSelectionCallback: onClearSelection,
    saveCallback: debouncedSave,
  });

  const onChangeActiveTool = useCallback(
    (tool) => {
      if (tool === "draw") {
        editor?.enableDrawingMode();
      }

      if (activeTool === "draw") {
        editor?.disableDrawingMode();
      }

      if (tool === activeTool) {
        return setActiveTool("select");
      }

      setActiveTool(tool);
    },
    [activeTool, editor],
  );

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      controlsAboveOverlay: true,
      preserveObjectStacking: true,
    });

    init({
      initialCanvas: canvas,
      initialContainer: containerRef.current,
    });

    return () => {
      canvas.dispose();
    };
  }, [init]);

  return (
    <div className="flex h-full flex-col">
      <Navbar
        editor={editor}
        activeTool={activeTool}
        saveStatus={saveStatus}
        onChangeActiveTool={onChangeActiveTool}
      />
      <div className="absolute top-[68px] flex h-[calc(100%-68px)] w-full">
        <Sidebar activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <ShapeSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <FillColorSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <StrokeColorSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <StrokeWidthSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <OpacitySidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <TextSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <FontSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <ImageSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <FilterSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <DrawSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <SettingsSidebar editor={editor} activeTool={activeTool} onChangeActiveTool={onChangeActiveTool} />
        <main className="relative flex flex-1 flex-col overflow-auto bg-muted">
          <Toolbar
            editor={editor}
            activeTool={activeTool}
            onChangeActiveTool={onChangeActiveTool}
            key={JSON.stringify(editor?.canvas.getActiveObject())}
          />
          <div className="h-[calc(100%-124px)] flex-1 bg-muted" ref={containerRef}>
            <canvas ref={canvasRef} />
          </div>
          <Footer editor={editor} />
        </main>
      </div>
    </div>
  );
}
