"use client";

// app/components/photoAnnotator/hooks/useFitZoom.js
//
// Keeps the photo fitted inside its container, the same job the designer's
// useAutoResize.js does for its "clip" workspace rect — reusing its exact
// technique (fabric.util.findScaleToFit + zoomToPoint + a re-centred
// viewportTransform, re-run on every ResizeObserver tick) rather than
// re-deriving the math. The one structural difference: the designer's
// workspace is a live fabric.Rect object it can query by name ("clip");
// this annotator's workspace is the background photo, which fabric does NOT
// return from `canvas.getObjects()` (setBackgroundImage keeps it out of the
// object list on purpose — see PhotoAnnotatorEditor.js's own note on why
// that matters for undo/redo and for what gets SAVED). So this hook is
// handed the workspace's pixel size directly as `workspaceWidth`/
// `workspaceHeight` instead of discovering it by querying the canvas.
//
// The photo is always positioned at world-space (0,0) — see
// PhotoAnnotatorEditor.js's setBackgroundImage call — so, unlike
// useAutoResize.js, there is no separate "workspace.getCenterPoint()" to
// read; the centre is simply (width/2, height/2).
import { fabric } from "fabric";
import { useCallback, useEffect } from "react";

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @param {HTMLDivElement | null} props.container
 * @param {number} props.workspaceWidth
 * @param {number} props.workspaceHeight
 */
export function useFitZoom({ canvas, container, workspaceWidth, workspaceHeight }) {
  const fit = useCallback(() => {
    if (!canvas || !container || !workspaceWidth || !workspaceHeight) return;

    const viewportWidth = container.offsetWidth;
    const viewportHeight = container.offsetHeight;
    if (!viewportWidth || !viewportHeight) return;

    canvas.setWidth(viewportWidth);
    canvas.setHeight(viewportHeight);

    // A hair of margin so a stroke drawn right at the photo's edge isn't
    // sitting flush against the container's own edge — 0.9 rather than the
    // designer's 0.85: this canvas holds one photo, not an artboard someone
    // is actively dragging objects in and out of, so less breathing room is
    // needed around it.
    const zoomRatio = 0.9;
    const scale = fabric.util.findScaleToFit(
      { width: workspaceWidth, height: workspaceHeight },
      { width: viewportWidth, height: viewportHeight },
    );
    const zoom = zoomRatio * scale;

    canvas.setViewportTransform(fabric.iMatrix.concat());
    canvas.zoomToPoint(new fabric.Point(viewportWidth / 2, viewportHeight / 2), zoom);

    const vt = canvas.viewportTransform;
    if (!vt) return;
    vt[4] = viewportWidth / 2 - (workspaceWidth / 2) * vt[0];
    vt[5] = viewportHeight / 2 - (workspaceHeight / 2) * vt[3];
    canvas.setViewportTransform(vt);
    canvas.requestRenderAll();
  }, [canvas, container, workspaceWidth, workspaceHeight]);

  useEffect(() => {
    if (!canvas || !container) return undefined;
    const observer = new ResizeObserver(() => fit());
    observer.observe(container);
    return () => observer.disconnect();
  }, [canvas, container, fit]);

  return { fit };
}
