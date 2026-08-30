"use client";

// app/components/designer/hooks/useClipboard.js
// Ported near verbatim from `hooks/use-clipboard.ts`. Fabric objects clone
// asynchronously (callback-style, not Promise — fabric v5's own API), so
// copy/paste is necessarily two separate clone() round-trips rather than one.
import { useCallback, useRef } from "react";

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 */
export function useClipboard({ canvas }) {
  const clipboard = useRef(null);

  const copy = useCallback(() => {
    canvas?.getActiveObject()?.clone((cloned) => {
      clipboard.current = cloned;
    });
  }, [canvas]);

  const paste = useCallback(() => {
    if (!clipboard.current) return;

    clipboard.current.clone((clonedObj) => {
      canvas?.discardActiveObject();
      clonedObj.set({
        left: clonedObj.left + 10,
        top: clonedObj.top + 10,
        evented: true,
      });

      if (clonedObj.type === "activeSelection") {
        clonedObj.canvas = canvas;
        clonedObj.forEachObject((obj) => {
          canvas?.add(obj);
        });
        clonedObj.setCoords();
      } else {
        canvas?.add(clonedObj);
      }

      clipboard.current.top += 10;
      clipboard.current.left += 10;
      canvas?.setActiveObject(clonedObj);
      canvas?.requestRenderAll();
    });
  }, [canvas]);

  return { copy, paste };
}
