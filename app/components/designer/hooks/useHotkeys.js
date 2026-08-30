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
 */
export function useHotkeys({ canvas, undo, redo, save, copy, paste }) {
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
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [canvas, undo, redo, save, copy, paste]);
}
