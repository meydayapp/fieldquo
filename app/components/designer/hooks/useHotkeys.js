"use client";

// app/components/designer/hooks/useHotkeys.js
// Ported from `hooks/use-hotkeys.ts`. The source clone used `react-use`'s
// `useEvent("keydown", handler)`, an extra dependency for what is a plain
// `window.addEventListener` with cleanup — replaced with useEffect, per
// AGENTS.md's instruction to drop react-use in favour of the two-line
// equivalent (this repo has no react-use dependency at all otherwise).
import { fabric } from "fabric";
import { useEffect } from "react";

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @param {() => void} props.undo
 * @param {() => void} props.redo
 * @param {(skip?: boolean) => void} props.save
 * @param {() => void} props.copy
 * @param {() => void} props.paste
 * @param {() => void} [props.autoZoom] - fit the frame to the container
 *   (hooks/useAutoResize.js), the same thing the Footer's Reset button does
 * @param {(scale: number) => void} [props.zoomToScale] - absolute zoom,
 *   re-centred on the workspace (hooks/useCanvasPanZoom.js)
 */
export function useHotkeys({
  canvas,
  undo,
  redo,
  save,
  copy,
  paste,
  autoZoom,
  zoomToScale,
}) {
  useEffect(() => {
    function handleKeydown(event) {
      const isCtrlKey = event.ctrlKey || event.metaKey;
      const isBackspace = event.key === "Backspace";
      const isInput = ["INPUT", "TEXTAREA"].includes(event.target.tagName);

      if (isInput) return;

      if (isBackspace) {
        canvas?.remove(...canvas.getActiveObjects());
        canvas?.discardActiveObject();
      }

      if (isCtrlKey && event.key === "z") {
        event.preventDefault();
        undo();
      }

      if (isCtrlKey && event.key === "y") {
        event.preventDefault();
        redo();
      }

      if (isCtrlKey && event.key === "c") {
        event.preventDefault();
        copy();
      }

      if (isCtrlKey && event.key === "v") {
        event.preventDefault();
        paste();
      }

      if (isCtrlKey && event.key === "s") {
        event.preventDefault();
        save(true);
      }

      if (isCtrlKey && event.key === "a") {
        event.preventDefault();
        canvas?.discardActiveObject();

        const allObjects = canvas
          ?.getObjects()
          .filter((object) => object.selectable);

        canvas?.setActiveObject(new fabric.ActiveSelection(allObjects, { canvas }));
        canvas?.renderAll();
      }

      // Zoom: fit the frame, or snap to 100%.
      //
      // TWO bindings for each, because the obvious one is not ours to take.
      // Ctrl/Cmd+0 is the browser's own "reset page zoom" and Ctrl/Cmd+1..8
      // switch tabs; in Chrome and Firefox those are reserved and never
      // reach the page at all, so shipping only them would be shipping two
      // shortcuts that silently do nothing — the exact failure AGENTS.md
      // names. They are still registered because they DO arrive in an
      // installed PWA and in the Capacitor shell, where there is no tab strip
      // to steal them.
      //
      // Shift+0 / Shift+1 are the reliable pair in a browser tab, matched on
      // event.code so they work on a layout where Shift+0 is not ")". Both
      // pairs map the same way round (0 = fit, 1 = 100%) rather than
      // borrowing Figma's inverted Shift+1 = fit, so there is one thing to
      // remember here instead of two.
      const wantsFit = event.code === "Digit0" || event.key === "0";
      const wantsActualSize = event.code === "Digit1" || event.key === "1";

      if ((isCtrlKey || event.shiftKey) && wantsFit) {
        event.preventDefault();
        autoZoom?.();
      }

      if ((isCtrlKey || event.shiftKey) && wantsActualSize) {
        event.preventDefault();
        zoomToScale?.(1);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [canvas, undo, redo, save, copy, paste, autoZoom, zoomToScale]);
}
