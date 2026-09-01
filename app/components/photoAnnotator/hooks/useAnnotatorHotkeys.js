"use client";

// app/components/photoAnnotator/hooks/useAnnotatorHotkeys.js
//
// Desktop convenience only — every one of these also has an on-canvas
// button, because the annotator's primary user is on a phone with no
// keyboard. Mirrors the designer's useHotkeys.js's own guard against
// stealing Backspace from a text field: fabric's in-place text editor
// (Textbox.enterEditing) creates a hidden <textarea> that becomes
// event.target while someone is typing, so checking the target's tagName is
// what stops "delete the whole text box" from firing on every backspace
// while composing a caption.
import { useEffect } from "react";

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @param {() => void} props.undo
 * @param {() => void} props.redo
 * @param {() => void} props.deleteSelection
 * @param {() => void} props.selectTool - switches back to the select tool (Escape)
 */
export function useAnnotatorHotkeys({ canvas, undo, redo, deleteSelection, selectTool }) {
  useEffect(() => {
    function onKeyDown(event) {
      const isEditingText = ["INPUT", "TEXTAREA"].includes(event.target?.tagName);
      const isCtrl = event.ctrlKey || event.metaKey;

      if (isEditingText) {
        if (event.key === "Escape") selectTool?.();
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && canvas?.getActiveObjects().length) {
        event.preventDefault();
        deleteSelection?.();
        return;
      }
      if (isCtrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo?.();
        else undo?.();
        return;
      }
      if (isCtrl && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo?.();
        return;
      }
      if (event.key === "Escape") {
        canvas?.discardActiveObject();
        canvas?.renderAll();
        selectTool?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvas, undo, redo, deleteSelection, selectTool]);
}
