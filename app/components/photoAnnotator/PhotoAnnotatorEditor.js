"use client";

// app/components/photoAnnotator/PhotoAnnotatorEditor.js
//
// Apple Markup, on a job photo — the actual canvas. Never imported directly
// by a page or by JobPhotoCurator.js; see PhotoAnnotatorLoader.js's own
// header for why (it imports "fabric", which crashes SSR).
//
// ══ Reuse-vs-separate — the decision docs/PHOTO-ANNOTATION.md explains in
//    full ═══════════════════════════════════════════════════════════════
//
// This does NOT reuse app/components/designer/Editor.js. That component is
// a full graphic-design surface: 14 tool sidebars, AI image generation,
// background removal, font/filter panels, and — the one that matters most —
// a ratio-switching system (changeRatio/reflow) built around the idea that
// the "workspace" is an artboard whose aspect ratio the user picks and
// changes. A job photo has exactly one aspect ratio, forever: its own.
// Bending Editor.js to fit would mean hiding ten of its fourteen sidebars,
// rewriting its left-rail-plus-360px-panel chrome into Apple Markup's
// top/bottom toolbar shape, and disabling ratio/template/AI machinery that
// has no meaning here — more subtraction than the shared 20% (fabric
// itself, the ssr:false pattern, lib/brand/colour.js's contrast maths) is
// worth. So this is its own small tree: one canvas, nine tools, no layers
// panel, no templates.
//
// ══ The photo is never an editable object ══════════════════════════════
//
// The photo is set via `canvas.setBackgroundImage()`, never `canvas.add()`.
// That keeps it permanently out of `canvas.getObjects()` — which is what
// makes three things simultaneously true without extra bookkeeping:
//   1. It can never be selected, dragged, resized or deleted by a stray tap.
//   2. Undo/redo (useAnnotatorHistory) and the saved `annotationJson` only
//      ever see the markup layer — the photo is structurally excluded from
//      both, not filtered out by convention.
//   3. Flattening (savePng below) still bakes it in, because
//      canvas.toDataURL() rasterises the background regardless of whether
//      it's in the object list.
//
// ══ Touch ═══════════════════════════════════════════════════════════════
//
// fabric@5.3.0-browser wires touchstart/touchmove/touchend to the same
// internal handler pipeline as mouse events (verified by reading
// node_modules/fabric/dist/fabric.js — `_onTouchStart`/`_onTouchEnd` are
// bound in `_bindEvents` unconditionally, not behind an opt-in flag), so
// drawing, dragging, and resizing via a single finger work without any
// extra wiring here — the same as the designer editor.
//
// PINCH-ZOOM IS NOT AVAILABLE. This build's own header comment says why:
// `build: node build.js modules=ALL exclude=gestures,accessors,erasing` —
// the `gestures` module (fabric's touch:gesture / pinch-to-zoom /
// two-finger-rotate support) was excluded when this bundle was built, long
// before this feature existed. Re-including it is a build/vendoring change
// outside this task's scope, and would affect the designer's canvas too. So
// zoom here is explicit +/- buttons (ZoomIn/ZoomOut below), touch-friendly
// tap targets, the same shape as the designer's own Footer.js zoom controls
// — not a regression this feature introduced, a pre-existing constraint of
// the vendored build.
import { fabric } from "fabric";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MousePointer2,
  Pencil,
  PenLine,
  Paintbrush,
  Highlighter,
  Type,
  ArrowUpRight,
  Square,
  Circle,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { resizedUrl } from "@/lib/media/cloudinaryUrl";
import { sanitiseAnnotationJson, ANNOTATOR_MAX_WIDTH } from "@/lib/jobs/photoAnnotation";
import { TOOLS, BRUSHES, ANNOTATION_COLORS, DEFAULT_INK_COLOR, ARROW_DEFAULTS, TEXT_DEFAULTS, SHAPE_STROKE_WIDTH } from "@/lib/photoAnnotator/constants";
import { buildArrowPath } from "@/lib/photoAnnotator/arrowGeometry";
import { haloColorFor } from "@/lib/photoAnnotator/contrast";
import { useAnnotatorHistory } from "@/app/components/photoAnnotator/hooks/useAnnotatorHistory";
import { useFitZoom } from "@/app/components/photoAnnotator/hooks/useFitZoom";
import { useAnnotatorHotkeys } from "@/app/components/photoAnnotator/hooks/useAnnotatorHotkeys";

const BRUSH_TOOLS = new Set([TOOLS.PENCIL, TOOLS.PEN, TOOLS.MARKER, TOOLS.HIGHLIGHTER]);

const TOOL_ICON = {
  [TOOLS.SELECT]: MousePointer2,
  [TOOLS.PENCIL]: Pencil,
  [TOOLS.PEN]: PenLine,
  [TOOLS.MARKER]: Paintbrush,
  [TOOLS.HIGHLIGHTER]: Highlighter,
  [TOOLS.TEXT]: Type,
  [TOOLS.ARROW]: ArrowUpRight,
  [TOOLS.RECTANGLE]: Square,
  [TOOLS.ELLIPSE]: Circle,
};

/**
 * @param {Object} props
 * @param {{id:string, url:string, annotationJson?:string|null, annotationWidth?:number|null, annotationHeight?:number|null, flattenedUrl?:string|null, flattenedPublicId?:string|null}} props.photo
 * @param {string} props.jobId
 * @param {(photo: object) => void} props.onDone - fired with the server's updated photo row after a successful save
 * @param {() => void} props.onCancel - fired to close without saving
 */
export default function PhotoAnnotatorEditor({ photo, jobId, onDone, onCancel }) {
  const { t } = useTranslation();
  const canvasElRef = useRef(null);
  const containerRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [container, setContainer] = useState(null);
  const workspaceRef = useRef({ width: 0, height: 0 });
  const [workspaceReady, setWorkspaceReady] = useState(false);

  const [tool, setTool] = useState(TOOLS.SELECT);
  const [inkColor, setInkColor] = useState(DEFAULT_INK_COLOR);
  const [hasSelection, setHasSelection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const history = useAnnotatorHistory({ canvas, onChange: () => setDirty(true) });
  const { fit } = useFitZoom({
    canvas,
    container,
    workspaceWidth: workspaceRef.current.width,
    workspaceHeight: workspaceRef.current.height,
  });

  // ── Mount the canvas + load the photo as a background image ────────────
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return undefined;
    const fabricCanvas = new fabric.Canvas(el, {
      controlsAboveOverlay: true,
      preserveObjectStacking: true,
      selection: true,
    });
    fabric.Object.prototype.set({
      cornerColor: "#FFF",
      cornerStyle: "circle",
      borderColor: "#0a84ff",
      borderScaleFactor: 1.5,
      transparentCorners: false,
      borderOpacityWhenMoving: 1,
      cornerStrokeColor: "#0a84ff",
    });

    const src = resizedUrl(photo.url, { width: ANNOTATOR_MAX_WIDTH });
    fabric.Image.fromURL(
      src,
      (img) => {
        const width = img.width || photo.annotationWidth || ANNOTATOR_MAX_WIDTH;
        const height = img.height || photo.annotationHeight || ANNOTATOR_MAX_WIDTH;
        workspaceRef.current = { width, height };
        fabricCanvas.setBackgroundImage(img, () => {
          fabricCanvas.requestRenderAll();
        }, { left: 0, top: 0, originX: "left", originY: "top" });

        const loadExisting = () => {
          const sanitised = sanitiseAnnotationJson(photo.annotationJson ?? null);
          if (!sanitised.ok || !sanitised.json) {
            setWorkspaceReady(true);
            return;
          }
          const { objects } = JSON.parse(sanitised.json);
          // Rescale if the stored coordinates were saved against a
          // different working resolution than this session opened at (see
          // JobPhoto.annotationWidth's own schema comment) — should be rare
          // (ANNOTATOR_MAX_WIDTH is a fixed constant) but cheap to guard.
          const savedWidth = photo.annotationWidth || width;
          const factor = savedWidth > 0 ? width / savedWidth : 1;
          if (factor !== 1 && Number.isFinite(factor)) {
            for (const o of objects) {
              if (typeof o.left === "number") o.left *= factor;
              if (typeof o.top === "number") o.top *= factor;
              if (typeof o.scaleX === "number") o.scaleX *= factor;
              if (typeof o.scaleY === "number") o.scaleY *= factor;
            }
          }
          fabricCanvas.loadFromJSON({ objects }, () => {
            fabricCanvas.renderAll();
            setWorkspaceReady(true);
          });
        };
        loadExisting();
      },
      { crossOrigin: "anonymous" },
    );

    setCanvas(fabricCanvas);
    setContainer(containerRef.current);

    return () => {
      fabricCanvas.dispose();
    };
    // Mount once — `photo` is the id this editor was opened for; a different
    // photo means a different mount of this whole component (JobPhotoCurator
    // keys it by photo.id), not a prop change to react to here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed undo/redo history once the initial load (background + any existing
  // annotation) has actually finished, so undo can't rewind past it.
  useEffect(() => {
    if (workspaceReady && canvas) {
      history.reset();
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceReady, canvas]);

  // ── Selection + explicit history checkpoints ────────────────────────────
  // Deliberately NOT wired to `object:added` — PencilBrush's own
  // `path:created` handler below removes and re-adds the stroke as a
  // halo+ink Group, and every shape/arrow/text is added once by the toolbar
  // handler that creates it — each of those already calls history.push()
  // itself at the point the action is actually complete. Also wiring
  // `object:added` here would double- or triple-count a single user action
  // into multiple undo steps. Note also that `history` itself is
  // deliberately absent from this effect's dependency array — see
  // useAnnotatorHistory.js's own header for why its returned functions stay
  // correct even when a handler captured them on an earlier render.
  useEffect(() => {
    if (!canvas) return undefined;
    const onSelection = () => setHasSelection(canvas.getActiveObjects().length > 0);
    const onCleared = () => setHasSelection(false);
    const onModified = () => {
      history.push();
      setDirty(true);
    };
    const onTextExit = () => {
      history.push();
      setDirty(true);
    };
    canvas.on("selection:created", onSelection);
    canvas.on("selection:updated", onSelection);
    canvas.on("selection:cleared", onCleared);
    canvas.on("object:modified", onModified);
    canvas.on("text:editing:exited", onTextExit);
    return () => {
      canvas.off("selection:created", onSelection);
      canvas.off("selection:updated", onSelection);
      canvas.off("selection:cleared", onCleared);
      canvas.off("object:modified", onModified);
      canvas.off("text:editing:exited", onTextExit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  // ── Freehand strokes: pencil / pen / marker / highlighter ───────────────
  const activePresetRef = useRef(BRUSHES[TOOLS.PEN]);
  useEffect(() => {
    if (!canvas) return undefined;
    const onPathCreated = (e) => {
      const inkPath = e.path;
      if (!inkPath) return;
      canvas.remove(inkPath);

      const preset = activePresetRef.current;
      const halo = haloColorFor(inkColor);
      inkPath.set({ opacity: preset.opacity, globalCompositeOperation: preset.composite, selectable: true });
      // A NEW fabric.Path built from the same parsed path-command array
      // (`inkPath.path`) rather than `inkPath.clone()` — Fabric's own clone()
      // is callback-based (it round-trips through toObject/fromObject, async
      // for object types that load a resource), and this needs the halo to
      // exist synchronously, in the same tick, so both objects land in the
      // Group together. Passing the SAME command array reproduces the exact
      // stroke geometry PencilBrush just drew; only the paint (colour,
      // width, opacity, compositing) differs.
      const haloPath = new fabric.Path(inkPath.path, {
        stroke: halo,
        strokeWidth: preset.width + preset.haloExtra,
        fill: null,
        opacity: Math.min(1, preset.opacity + 0.15),
        globalCompositeOperation: "source-over",
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });

      const group = new fabric.Group([haloPath, inkPath], { selectable: true });
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      history.push();
      setDirty(true);
    };
    canvas.on("path:created", onPathCreated);
    return () => canvas.off("path:created", onPathCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, inkColor]);

  const enableBrush = useCallback(
    (brushTool) => {
      if (!canvas) return;
      const preset = BRUSHES[brushTool];
      activePresetRef.current = preset;
      canvas.discardActiveObject();
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = preset.width;
      canvas.freeDrawingBrush.color = inkColor;
      canvas.renderAll();
    },
    [canvas, inkColor],
  );

  const centerOnWorkspace = useCallback(
    (object) => {
      const { width, height } = workspaceRef.current;
      object.set({ left: width / 2, top: height / 2, originX: "center", originY: "center" });
    },
    [],
  );

  const addShape = useCallback(
    (shapeTool) => {
      if (!canvas) return;
      const halo = haloColorFor(inkColor);
      let inkShape;
      let haloShape;
      // `originX/Y: "center"` on every shape below (set in the constructor,
      // not via a later `.set()` — Fabric doesn't reinterpret left/top when
      // origin changes post-construction) means each one's own bounding-box
      // centre lands at world (0,0), the fabric default for an object whose
      // left/top were never explicitly set. Ink and halo end up concentric
      // that way regardless of the two boxes being different sizes.
      const CENTER_ORIGIN = { originX: "center", originY: "center" };
      if (shapeTool === TOOLS.RECTANGLE) {
        const opts = { ...CENTER_ORIGIN, width: 260, height: 180, fill: "transparent", rx: 6, ry: 6 };
        inkShape = new fabric.Rect({ ...opts, stroke: inkColor, strokeWidth: SHAPE_STROKE_WIDTH });
        haloShape = new fabric.Rect({ ...opts, stroke: halo, strokeWidth: SHAPE_STROKE_WIDTH + BRUSHES[TOOLS.PEN].haloExtra });
      } else if (shapeTool === TOOLS.ELLIPSE) {
        const opts = { ...CENTER_ORIGIN, rx: 130, ry: 90, fill: "transparent" };
        inkShape = new fabric.Ellipse({ ...opts, stroke: inkColor, strokeWidth: SHAPE_STROKE_WIDTH });
        haloShape = new fabric.Ellipse({ ...opts, stroke: halo, strokeWidth: SHAPE_STROKE_WIDTH + BRUSHES[TOOLS.PEN].haloExtra });
      } else if (shapeTool === TOOLS.ARROW) {
        inkShape = new fabric.Path(buildArrowPath(ARROW_DEFAULTS), { ...CENTER_ORIGIN, fill: inkColor });
        const pad = 5;
        // Padded on every dimension so the halo's own bounding box grows
        // outward from its own centre by roughly `pad` on every side.
        haloShape = new fabric.Path(
          buildArrowPath({
            length: ARROW_DEFAULTS.length + pad,
            headLength: ARROW_DEFAULTS.headLength + pad,
            headWidth: ARROW_DEFAULTS.headWidth + pad * 2,
            thickness: ARROW_DEFAULTS.thickness + pad * 2,
          }),
          { ...CENTER_ORIGIN, fill: halo },
        );
      } else {
        return;
      }
      const group = new fabric.Group([haloShape, inkShape]);
      centerOnWorkspace(group);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      history.push();
      setDirty(true);
    },
    [canvas, inkColor, centerOnWorkspace],
  );

  const addText = useCallback(() => {
    if (!canvas) return;
    const halo = haloColorFor(inkColor);
    const box = new fabric.Textbox(t("app.photoAnnotator.textPlaceholder", "Note"), {
      fontSize: TEXT_DEFAULTS.fontSize,
      fontFamily: TEXT_DEFAULTS.fontFamily,
      fontWeight: TEXT_DEFAULTS.fontWeight,
      fill: inkColor,
      stroke: halo,
      strokeWidth: 3,
      paintFirst: "stroke",
      originX: "center",
      originY: "center",
      textAlign: "center",
      width: 240,
    });
    centerOnWorkspace(box);
    canvas.add(box);
    canvas.setActiveObject(box);
    box.enterEditing();
    box.selectAll();
    canvas.requestRenderAll();
    history.push();
    setDirty(true);
  }, [canvas, inkColor, centerOnWorkspace, t]);

  const onChangeTool = useCallback(
    (nextTool) => {
      if (!canvas) return;
      if (canvas.isDrawingMode) canvas.isDrawingMode = false;

      if (BRUSH_TOOLS.has(nextTool)) {
        setTool(nextTool);
        enableBrush(nextTool);
        return;
      }
      if (nextTool === TOOLS.RECTANGLE || nextTool === TOOLS.ELLIPSE || nextTool === TOOLS.ARROW) {
        addShape(nextTool);
        setTool(TOOLS.SELECT);
        return;
      }
      if (nextTool === TOOLS.TEXT) {
        addText();
        setTool(TOOLS.SELECT);
        return;
      }
      setTool(TOOLS.SELECT);
      canvas.renderAll();
    },
    [canvas, enableBrush, addShape, addText],
  );

  const deleteSelection = useCallback(() => {
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (!active.length) return;
    canvas.discardActiveObject();
    active.forEach((o) => canvas.remove(o));
    canvas.requestRenderAll();
    history.push();
    setDirty(true);
  }, [canvas, history]);

  useAnnotatorHotkeys({
    canvas,
    undo: history.undo,
    redo: history.redo,
    deleteSelection,
    selectTool: () => onChangeTool(TOOLS.SELECT),
  });

  const onPickColor = useCallback(
    (hex) => {
      setInkColor(hex);
      if (canvas?.isDrawingMode && canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = hex;
      }
    },
    [canvas],
  );

  const zoom = useCallback(
    (direction) => {
      if (!canvas) return;
      const center = canvas.getCenter();
      const current = canvas.getZoom();
      const next = direction > 0 ? Math.min(4, current + 0.15) : Math.max(0.2, current - 0.15);
      canvas.zoomToPoint(new fabric.Point(center.left, center.top), next);
    },
    [canvas],
  );

  // ── Save: flatten (client-side — Fabric can't run server-side, see
  // docs/PHOTO-ANNOTATION.md) and persist both the vector layer and the
  // baked-in preview ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canvas) return;
    setSaving(true);
    setError("");
    try {
      const { width, height } = workspaceRef.current;
      const objects = canvas.getObjects().map((o) => o.toObject());
      canvas.discardActiveObject();

      if (objects.length === 0) {
        // Nothing left on the canvas — including a photo that started with
        // markup and had every object deleted this session — is the same
        // state as "never annotated". Save that as a clear rather than
        // uploading a flattened PNG that's pixel-identical to the original.
        const res = await fetch(`/api/jobs/${jobId}/photos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: photo.id, clearAnnotation: true }),
        });
        if (!res.ok) {
          await reportResponseError(res, t("app.photoAnnotator.saveFailed", "Couldn't save that markup."));
          return;
        }
        const data = await res.json();
        onDone?.(data.photo);
        return;
      }

      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const dataUrl = canvas.toDataURL({ format: "png", left: 0, top: 0, width, height });
      fit();

      const blob = await (await fetch(dataUrl)).blob();
      const fd = new FormData();
      fd.append("file", blob, "annotated.png");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadData?.url) {
        setError(uploadData?.error || t("app.photoAnnotator.uploadFailed", "Couldn't save the flattened image."));
        return;
      }

      const patchRes = await fetch(`/api/jobs/${jobId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          annotationJson: JSON.stringify({ objects }),
          annotationWidth: width,
          annotationHeight: height,
          flattenedUrl: uploadData.url,
          flattenedPublicId: uploadData.publicId || null,
        }),
      });
      if (!patchRes.ok) {
        await reportResponseError(patchRes, t("app.photoAnnotator.saveFailed", "Couldn't save that markup."));
        return;
      }
      const patchData = await patchRes.json();
      onDone?.(patchData.photo);
    } finally {
      setSaving(false);
    }
  }, [canvas, jobId, photo.id, onDone, fit, t]);

  const tools = useMemo(
    () => [
      TOOLS.SELECT,
      TOOLS.PENCIL,
      TOOLS.PEN,
      TOOLS.MARKER,
      TOOLS.HIGHLIGHTER,
      TOOLS.TEXT,
      TOOLS.ARROW,
      TOOLS.RECTANGLE,
      TOOLS.ELLIPSE,
    ],
    [],
  );

  const toolLabel = (id) => t(`app.photoAnnotator.tool.${id}`, id);

  // `dirty` (set by history.push()/history.undo()/history.redo() — see
  // useAnnotatorHistory's onChange) exists to gate exactly this: closing
  // without saving is silent and free when nothing changed, and confirmed
  // when it would throw away real work. Nothing else in this component
  // reads it, on purpose — it's not a "Save" gate (Done is always available;
  // an unnecessary save is harmless) or a visual indicator, both of which
  // would be scope beyond what the brief asked for.
  const handleCancel = useCallback(() => {
    if (dirty && typeof window !== "undefined") {
      const ok = window.confirm(
        t("app.photoAnnotator.discardConfirm", "Discard your changes to this photo's markup?"),
      );
      if (!ok) return;
    }
    onCancel?.();
  }, [dirty, onCancel, t]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1.5"
        >
          <X size={16} /> {t("app.photoAnnotator.cancel", "Cancel")}
        </button>
        <h2 className="text-xs font-bold text-foreground">{t("app.photoAnnotator.title", "Markup")}</h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !workspaceReady}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-3 py-1.5"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {t("app.photoAnnotator.done", "Done")}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 border-b border-border">
          {error}
        </div>
      )}

      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-muted">
        {!workspaceReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        )}
        <canvas ref={canvasElRef} />
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => zoom(1)}
            className="w-9 h-9 rounded-full bg-card border border-border shadow flex items-center justify-center text-foreground"
            aria-label={t("app.photoAnnotator.zoomIn", "Zoom in")}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => zoom(-1)}
            className="w-9 h-9 rounded-full bg-card border border-border shadow flex items-center justify-center text-foreground"
            aria-label={t("app.photoAnnotator.zoomOut", "Zoom out")}
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </div>

      <div className="border-t border-border bg-card">
        <div className="flex items-center gap-1.5 px-2 py-2 overflow-x-auto">
          {tools.map((id) => {
            const Icon = TOOL_ICON[id];
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTool(id)}
                title={toolLabel(id)}
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${
                  active ? "bg-blue-600 text-white border-blue-600" : "bg-background text-foreground border-border"
                }`}
              >
                <Icon size={17} />
              </button>
            );
          })}
          <div className="w-px h-6 bg-border shrink-0 mx-1" />
          <button
            type="button"
            onClick={history.undo}
            disabled={!history.canUndo()}
            title={t("app.photoAnnotator.undo", "Undo")}
            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border border-border text-foreground disabled:opacity-30"
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            onClick={history.redo}
            disabled={!history.canRedo()}
            title={t("app.photoAnnotator.redo", "Redo")}
            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border border-border text-foreground disabled:opacity-30"
          >
            <Redo2 size={17} />
          </button>
          <button
            type="button"
            onClick={deleteSelection}
            disabled={!hasSelection}
            title={t("app.photoAnnotator.delete", "Delete")}
            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border border-border text-red-600 disabled:opacity-30"
          >
            <Trash2 size={17} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-2 pb-2.5 overflow-x-auto">
          {ANNOTATION_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onPickColor(hex)}
              aria-label={hex}
              className={`shrink-0 w-7 h-7 rounded-full border-2 ${
                inkColor === hex ? "border-blue-600" : "border-border"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
