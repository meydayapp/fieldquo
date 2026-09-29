"use client";

// app/components/designer/hooks/useCanvasEvents.js
// Ported near verbatim from `hooks/use-canvas-events.ts`. Wires fabric's own
// object/selection events to the editor's save-on-change and selection
// state — this is the ONLY place `save()` gets called from user edits; every
// add/remove/modify anywhere in the editor funnels through it.
import { useEffect } from "react";

import { filledName, isPlaceholderName } from "@/lib/designer/placeholders";

/**
 * @param {Object} props
 * @param {() => void} props.save
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @param {(objects: import("fabric").fabric.Object[]) => void} props.setSelectedObjects
 * @param {() => void} [props.clearSelectionCallback]
 */
export function useCanvasEvents({
  save,
  canvas,
  setSelectedObjects,
  clearSelectionCallback,
}) {
  useEffect(() => {
    if (canvas) {
      canvas.on("object:added", () => save());
      canvas.on("object:removed", () => save());
      canvas.on("object:modified", () => save());
      // A template's bracketed placeholder ("[Paste a real review…]") stops
      // being one the moment somebody types into it — the name the publish
      // routes look for is changed here, and the edit's own object:modified
      // saves it (lib/designer/placeholders.js).
      canvas.on("text:changed", (e) => {
        const target = e?.target;
        if (target && isPlaceholderName(target.name)) target.name = filledName(target.name);
      });
      canvas.on("selection:created", (e) => {
        setSelectedObjects(e.selected || []);
      });
      canvas.on("selection:updated", (e) => {
        setSelectedObjects(e.selected || []);
      });
      canvas.on("selection:cleared", () => {
        setSelectedObjects([]);
        clearSelectionCallback?.();
      });
    }

    return () => {
      if (canvas) {
        canvas.off("object:added");
        canvas.off("object:removed");
        canvas.off("object:modified");
        canvas.off("text:changed");
        canvas.off("selection:created");
        canvas.off("selection:updated");
        canvas.off("selection:cleared");
      }
    };
  }, [save, canvas, clearSelectionCallback, setSelectedObjects]);
}
