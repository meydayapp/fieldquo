"use client";

// app/components/photoAnnotator/hooks/useAnnotatorHistory.js
//
// Undo/redo for the annotation LAYER only — never the photo. Adapted from
// the designer's app/components/designer/hooks/useHistory.js, with two
// deliberate differences:
//
//   1. That hook's undo/redo call `canvas.clear()`, which also wipes
//      fabric's `backgroundImage`/`backgroundColor` — fine for the designer,
//      where the "workspace" is itself a plain fabric.Rect object reloaded
//      from the JSON on every undo. Here the photo is set via
//      `canvas.setBackgroundImage()`, is never part of the JSON this hook
//      snapshots, and must survive every undo/redo untouched — so this
//      removes only the CURRENT annotation objects
//      (`canvas.remove(...canvas.getObjects())`) before loading the
//      previous/next snapshot back in, rather than clearing the whole
//      canvas.
//
//   2. The current index lives in a REF (`indexRef`), not just React state.
//      PhotoAnnotatorEditor.js wires `push` into several fabric event
//      handlers (`path:created`, `object:modified`, …) inside `useEffect`s
//      whose own dependency arrays do NOT include this hook's returned
//      object — deliberately, to avoid re-subscribing those listeners on
//      every keystroke (see that file's own comment on why). If `push`
//      closed over the `index` STATE value the way the designer's `save`
//      reads `historyIndex`, an event handler captured on an early render
//      would keep re-slicing history against a stale index forever — this
//      hook's own `historyRef.current.slice(0, index + 1)` truncation (a
//      redo branch, which the designer's `save` doesn't even attempt) is
//      exactly the kind of logic a stale index quietly corrupts. Reading
//      `indexRef.current` instead means `push`/`undo`/`redo`/`reset` are
//      stable across renders (their own useCallback deps are just
//      `[canvas, onChange]`) and always act on the CURRENT index no matter
//      how old the closure holding them is. `index` state still exists,
//      updated alongside the ref, purely so canUndo()/canRedo() reflect the
//      current position in a component's render (a ref mutation alone
//      doesn't trigger React to re-render the Undo/Redo buttons).
//
// This file never imports "fabric" itself — every fabric call arrives
// through the `canvas` instance the caller passes in.
import { useCallback, useRef, useState } from "react";

function snapshot(canvas) {
  // `o.toObject()` with no key list, unlike the designer's
  // `canvas.toJSON(JSON_KEYS)` — this annotator has no "clip" workspace rect
  // to preserve by name, and every object type it produces (path, group,
  // rect, ellipse, textbox) serialises everything undo/redo needs (position,
  // colour, stroke, the halo pairing) through fabric's own defaults.
  return JSON.stringify({ objects: canvas.getObjects().map((o) => o.toObject()) });
}

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @param {() => void} [props.onChange] - fired after every push/undo/redo
 *   that actually changes what's on the canvas, so a caller can drive a
 *   "Save" button's enabled state off "is there anything to save" rather
 *   than every canvas event.
 */
export function useAnnotatorHistory({ canvas, onChange }) {
  const [index, setIndex] = useState(-1);
  const indexRef = useRef(-1);
  const historyRef = useRef([]);
  const suppressRef = useRef(false);

  const setIndexBoth = (value) => {
    indexRef.current = value;
    setIndex(value);
  };

  const canUndo = useCallback(() => index > 0, [index]);
  const canRedo = useCallback(() => index < historyRef.current.length - 1, [index]);

  /** Seed history with the CURRENT canvas state as the one-and-only entry —
   * called once after the initial annotation (if any) has finished loading,
   * so undo can never rewind past the photo the editor was opened with. */
  const reset = useCallback(() => {
    if (!canvas) return;
    historyRef.current = [snapshot(canvas)];
    setIndexBoth(0);
  }, [canvas]);

  /** Push the current canvas state as a new history entry — called
   * explicitly by PhotoAnnotatorEditor.js after every discrete user action
   * (a stroke finishes, a shape/text is added, a delete, a move/resize/text
   * edit is committed). */
  const push = useCallback(() => {
    if (!canvas || suppressRef.current) return;
    const json = snapshot(canvas);
    // Truncate any redo branch — a new stroke after undoing two strokes
    // discards the two that were undone, matching every editor's own
    // undo/redo convention rather than keeping a dangling redo branch.
    historyRef.current = [...historyRef.current.slice(0, indexRef.current + 1), json];
    setIndexBoth(historyRef.current.length - 1);
    onChange?.();
  }, [canvas, onChange]);

  const loadIndex = useCallback(
    (targetIndex) => {
      if (!canvas) return;
      const targetJson = historyRef.current[targetIndex];
      if (targetJson === undefined) return;
      suppressRef.current = true;
      canvas.remove(...canvas.getObjects());
      const { objects } = JSON.parse(targetJson);
      canvas.loadFromJSON({ objects }, () => {
        canvas.renderAll();
        setIndexBoth(targetIndex);
        suppressRef.current = false;
        onChange?.();
      });
    },
    [canvas],
  );

  const undo = useCallback(() => {
    if (indexRef.current > 0) loadIndex(indexRef.current - 1);
  }, [loadIndex]);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) loadIndex(indexRef.current + 1);
  }, [loadIndex]);

  return { push, undo, redo, canUndo, canRedo, reset };
}
