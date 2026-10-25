"use client";

// app/components/designer/hooks/useCanvasPanZoom.js
//
// The three gestures a canvas editor is expected to have and this port never
// had: Ctrl/Cmd+scroll and Alt+scroll to zoom at the cursor, space-held drag
// and middle-mouse drag to pan, plus the zoom-to-a-scale primitive the
// Ctrl+1/Shift+1 "100%" shortcut needs. Before this, the ONLY way to move the
// viewport was the Footer's two buttons and autoZoom() — so a frame larger
// than the container could never be inspected at its edges, which is exactly
// what the owner reported ("i cannot zoom in and out so if the image is too
// big i cannot move the designer to fetch the edges").
//
// All three live together because they all write the same thing: fabric's
// viewportTransform. Splitting them would mean three modules racing over one
// matrix, and the cursor state ("am I in pan mode?") is shared between the
// space key and the drag.
//
// NOT part of the undo history, deliberately: viewportTransform is not in
// canvas.toJSON(JSON_KEYS), so nothing here calls save(). Panning is looking,
// not editing — a person who nudges the view twice and hits Ctrl+Z expects
// their last real edit back, not a scroll position.
import { fabric } from "fabric";
import { useCallback, useEffect, useState } from "react";

import { ZOOM_MAX, ZOOM_MIN } from "@/lib/designer/constants";

// Fabric's own defaults, read off the prototype rather than hardcoded, so
// restoring them after pan mode can't drift from whatever this fabric
// version actually ships ("default" and "move" today).
const BASE_CURSOR = fabric.Canvas.prototype.defaultCursor;
const BASE_HOVER_CURSOR = fabric.Canvas.prototype.hoverCursor;

const clampZoom = (zoom) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

// Space belongs to whatever has focus before it belongs to this hook — two
// separate ways that matters:
//
//   - Typing. Fabric's in-place text editing routes keystrokes through a
//     hidden <textarea> it appends to the document, so a plain tagName test
//     already covers the canvas's own text layers as well as the sidebars'
//     inputs; contentEditable covers any rich field a later panel adds.
//   - Activating a control. Space is how a keyboard user presses a focused
//     button, checkbox or switch. Swallowing it here would mean tabbing to
//     "Zoom in" and finding that Enter works and Space silently doesn't —
//     the same class of dead control AGENTS.md is about, just reached by
//     keyboard. The role selectors are there for Radix's primitives, which
//     render div-based switches and menu items rather than real <button>s.
//
// closest(), not a tagName check, because the focusable element is often an
// inner span inside the control that owns the key.
const SPACE_IS_THEIRS =
  'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"],' +
  ' [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"],' +
  ' [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"],' +
  ' [role="tab"], [role="slider"], [role="combobox"]';

function spaceBelongsToFocus(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (typeof target.closest !== "function") return false;
  return Boolean(target.closest(SPACE_IS_THEIRS));
}

// deltaY is only comparable across browsers after deltaMode is applied:
// Chrome/Safari report pixels (mode 0), Firefox historically reports LINES
// (mode 1, deltaY of 3 for one notch) and page mode exists too. Without this
// the same wheel notch zooms ~10% in Chrome and ~0.3% in Firefox.
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

function wheelDeltaPx(event) {
  if (event.deltaMode === 1) return event.deltaY * LINE_HEIGHT_PX;
  if (event.deltaMode === 2) return event.deltaY * PAGE_HEIGHT_PX;
  return event.deltaY;
}

/**
 * @param {Object} props
 * @param {import("fabric").fabric.Canvas | null} props.canvas
 * @returns {{zoomToScale: (scale: number) => void}}
 */
export function useCanvasPanZoom({ canvas }) {
  // State, not a ref: the grab cursor has to change when space goes down,
  // and the drag listener has to know whether space is held when the mouse
  // goes down. One re-render per press is cheaper than either a ref the
  // cursor effect can't observe or a second source of truth.
  const [spaceHeld, setSpaceHeld] = useState(false);

  /**
   * Zoom to an absolute scale and re-centre the workspace, the same way
   * useAutoResize's autoZoom() does — the tail of this function is that
   * file's centring maths, which is the only way to land the frame in the
   * middle of a container whose size fabric doesn't know about.
   */
  const zoomToScale = useCallback(
    (scale) => {
      if (!canvas) return;
      // Math.min/Math.max pass NaN and Infinity straight through, and a
      // non-finite zoom turns viewportTransform into NaN — a canvas that
      // renders nothing at all, with no way back but a page reload. Bail
      // instead of clamping, so a bad caller changes nothing.
      if (!Number.isFinite(scale)) return;

      const center = canvas.getCenter();
      canvas.setViewportTransform(fabric.iMatrix.concat());
      canvas.zoomToPoint(new fabric.Point(center.left, center.top), clampZoom(scale));

      const workspace = canvas.getObjects().find((object) => object.name === "clip");
      const viewportTransform = canvas.viewportTransform;
      if (!workspace || !viewportTransform) return;
      if (canvas.width === undefined || canvas.height === undefined) return;

      const workspaceCenter = workspace.getCenterPoint();
      viewportTransform[4] = canvas.width / 2 - workspaceCenter.x * viewportTransform[0];
      viewportTransform[5] = canvas.height / 2 - workspaceCenter.y * viewportTransform[3];

      canvas.setViewportTransform(viewportTransform);
      canvas.requestRenderAll();
    },
    [canvas],
  );

  // ── Ctrl/Cmd+scroll and Alt+scroll: zoom at the cursor ───────────────────
  useEffect(() => {
    if (!canvas) return undefined;

    const handleWheel = (opt) => {
      const event = opt?.e;
      if (!event) return;

      // A plain wheel is NOT ours. <main> in Editor.js is `overflow-auto`
      // and the mobile layout stacks tool panels below the canvas, so
      // swallowing an unmodified scroll would trap a phone user inside the
      // canvas with no way to reach the rest of the page. Both modifier
      // sets are accepted because Alt+scroll is the only one that survives
      // on Linux/Windows window managers that eat Ctrl+scroll, and macOS
      // trackpad pinch arrives as a wheel event with ctrlKey already set —
      // so pinch-to-zoom comes out of this branch for free.
      if (!(event.ctrlKey || event.metaKey || event.altKey)) return;

      // Both, in this order: preventDefault stops the browser's own
      // Ctrl+scroll page zoom (the wheel listener fabric registers on
      // upperCanvasEl is not passive, so this is honoured), and
      // stopPropagation keeps the gesture off the scrolling ancestor.
      event.preventDefault();
      event.stopPropagation();

      // Fabric's documented idiom: exponential, so a notch in and a notch
      // back out return to the scale you started from. A linear step does
      // not round-trip.
      const delta = wheelDeltaPx(event);
      if (!Number.isFinite(delta)) return; // same NaN trap as zoomToScale

      const next = clampZoom(canvas.getZoom() * 0.999 ** delta);
      canvas.zoomToPoint(new fabric.Point(event.offsetX, event.offsetY), next);
    };

    canvas.on("mouse:wheel", handleWheel);
    return () => canvas.off("mouse:wheel", handleWheel);
  }, [canvas]);

  // ── The space key, tracked as a modifier ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (spaceBelongsToFocus(event.target)) return;
      if (canvas?.getActiveObject()?.isEditing) return;

      // Space scrolls the nearest scrollable ancestor otherwise, which jumps
      // the canvas out of view the moment pan mode is entered.
      event.preventDefault();
      setSpaceHeld(true);
    };

    const handleKeyUp = (event) => {
      if (event.code !== "Space" && event.key !== " ") return;
      setSpaceHeld(false);
    };

    // Alt-tabbing or Cmd-tabbing away with space down never delivers the
    // keyup, and a canvas left in pan mode reads as broken: clicks select
    // nothing and the cursor stays a grab hand.
    const handleBlur = () => setSpaceHeld(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [canvas]);

  // ── Space-held drag and middle-mouse drag: pan ───────────────────────────
  useEffect(() => {
    if (!canvas) return undefined;

    const wrapper = canvas.wrapperEl;
    const upper = canvas.upperCanvasEl;
    if (!wrapper) return undefined;

    const applyCursor = (value, hover) => {
      canvas.defaultCursor = value;
      canvas.hoverCursor = hover;
      if (upper) upper.style.cursor = value;
    };

    if (spaceHeld) applyCursor("grab", "grab");

    let origin = null;

    const handleMouseDown = (event) => {
      if (!spaceHeld && event.button !== 1) return;

      // Capture phase, and on the WRAPPER rather than on the canvas itself:
      // fabric registers its own mousedown on upperCanvasEl, a child of the
      // wrapper, and at the target element listeners fire in registration
      // order regardless of the capture flag — so a capture listener on the
      // same element would not reliably run first. Stopping the event one
      // level up is what keeps fabric from grabbing the object under the
      // cursor and dragging the ARTWORK while the person meant to drag the
      // VIEW. Rejected: setting canvas.selection = false and relying on
      // fabric to leave objects alone, which it does not — selection only
      // governs the marquee, not dragging an object already under the mouse.
      event.preventDefault();
      event.stopPropagation();

      origin = { x: event.clientX, y: event.clientY };
      applyCursor("grabbing", "grabbing");
    };

    // On window, not the canvas: a drag that leaves the canvas element (very
    // easy when panning towards an edge, which is the whole point) must keep
    // panning and must still end on mouseup wherever that lands.
    const handleMouseMove = (event) => {
      if (!origin) return;
      canvas.relativePan(
        new fabric.Point(event.clientX - origin.x, event.clientY - origin.y),
      );
      origin = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      if (!origin) return;
      origin = null;
      applyCursor(spaceHeld ? "grab" : BASE_CURSOR, spaceHeld ? "grab" : BASE_HOVER_CURSOR);
    };

    wrapper.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      wrapper.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      origin = null;
      applyCursor(BASE_CURSOR, BASE_HOVER_CURSOR);
    };
  }, [canvas, spaceHeld]);

  // Only zoomToScale is exported: `spaceHeld` is internal cursor state, and
  // nothing outside this hook has a use for it today.
  return { zoomToScale };
}
