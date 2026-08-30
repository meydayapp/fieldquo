"use client";

// app/components/designer/hooks/useLoadState.js
// Ported near verbatim from `hooks/use-load-state.ts`. Loads
// `initialData.json` (the injection point — see Editor.js) into the fabric
// canvas exactly once per mount, then seeds history with that as index 0 so
// undo never rewinds past the document the editor was opened with.
import { useEffect, useRef } from "react";

import { JSON_KEYS } from "@/lib/designer/constants";

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @param {() => void} props.autoZoom
 * @param {React.MutableRefObject<string | undefined>} props.initialState
 * @param {React.MutableRefObject<string[]>} props.canvasHistory
 * @param {React.Dispatch<React.SetStateAction<number>>} props.setHistoryIndex
 */
export function useLoadState({
  canvas,
  autoZoom,
  initialState,
  canvasHistory,
  setHistoryIndex,
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && initialState?.current && canvas) {
      const data = JSON.parse(initialState.current);

      canvas.loadFromJSON(data, () => {
        const currentState = JSON.stringify(canvas.toJSON(JSON_KEYS));

        canvasHistory.current = [currentState];
        setHistoryIndex(0);
        autoZoom();
      });
      initialized.current = true;
    }
  }, [canvas, autoZoom, initialState, canvasHistory, setHistoryIndex]);
}
