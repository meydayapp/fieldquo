// app/components/quotes/builder/PolygonMeasure.js
//
// Trace a shape on a photo, get its area and its outline in feet.
//
// This is the drawing surface PaverDesigner.js used to own outright. It was
// lifted out when the landscaping trades needed the same thing — a lawn is a
// polygon exactly as a patio is — so that there is ONE canvas, one keyboard
// path, one scale bar and one set of measurements. PaverDesigner keeps the
// paver-specific layer (patterns, waste, base gravel, the diagonal check) on
// top of this; LotAreaMeasure.js puts the intake-field layer on top for lawns.
// Neither copies a line of the tracing code, because the copy is the one that
// rots.
//
// ── Where the scale comes from ──────────────────────────────────────────────
//
// Two sources, resolved by lib/measure/imageScale.js resolveScale():
//
//  1. AUTOMATIC. A Google satellite still has a known ground resolution —
//     metres per pixel = 156543.03 · cos(lat) / 2^zoom / scale — and the route
//     that serves the image also returns that scale as JSON. Given it (or,
//     failing that, the parameters parsed back off the image URL), every shape
//     is measured the moment it is closed. The estimator draws nothing first.
//
//  2. MANUAL. A reference line drawn along something of known length, with
//     that length typed. This is the only scale for a photo the estimator
//     uploaded themselves, and it OVERRIDES the automatic one when both exist,
//     because drawing a line is a deliberate act and the automatic scale is a
//     default. A "use the satellite scale" button clears the override.
//
// The two are kept honest by the same rule as before: without a scale from
// either source, there are no measurements. A traced shape has an area in
// PIXELS at all times, and showing that number — even greyed out, even
// labelled "px" — invites somebody to read it as feet. "Scale not set" is the
// honest output, so that is what it says.
//
// ── Canvas units, not image pixels ──────────────────────────────────────────
//
// The viewBox is a fixed 1000×640 and the image is painted into it with
// `xMidYMid slice`, exactly as the paver canvas always did — saved paver
// drawings are in these units and were traced over an image placed this way,
// so changing the fit would move every stored outline off the photo it was
// drawn on. The automatic scale therefore goes through canvasFeetPerUnit(),
// which knows the fit and the image's real pixel size and turns feet-per-
// image-pixel into feet-per-viewBox-unit.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Ruler, Trash2, Undo2, X } from "lucide-react";
import {
  canvasFeetPerUnit,
  imageScaleFromUrl,
  isPoint,
  measureShape,
  resolveScale,
} from "@/lib/measure/imageScale";
import { Field, Num } from "./fields";
import { useTranslation } from "@/app/hooks/useTranslation";

export const VIEW_W = 1000;
export const VIEW_H = 640;

const numOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round(numOf(n) * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, numOf(n)));

export const asShapes = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
export const asPoints = (v) => (Array.isArray(v) ? v.filter(isPoint) : []);

let shapeSeq = 0;
const nextShapeId = () => `shape_${Date.now().toString(36)}_${shapeSeq++}`;

/** The drawing every caller's document starts from. */
export function blankDrawing() {
  return {
    scale: null,
    shapes: [],
    imageOpacity: 0.65,
  };
}

/* ── The hook: one place the numbers come from ─────────────────────────── */

/**
 * The decoded size of the image at `url`, once the browser has it.
 *
 * Read off a throwaway Image() rather than the SVG <image>, which reports no
 * natural size. The browser serves the second request from cache, so the
 * canvas does not fetch the tile twice. Null until loaded, or on a URL that
 * fails — canvasFeetPerUnit() falls back to the declared size, so a slow load
 * still measures; it just cannot correct a guessed aspect ratio (a URL that
 * carried no size) until the real pixels land. See canvasFeetPerUnit for why
 * the aspect is the only thing the decoded size is needed for.
 */
export function useImageNaturalSize(url) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    setSize(null);
    if (!url || typeof window === "undefined") return undefined;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => {
      if (!cancelled) setSize(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return size;
}

/**
 * Every derived number for a drawing: the scale in effect and where it came
 * from, each shape measured, and the totals per layer.
 *
 * A hook rather than a callback from the canvas so the parent that owns the
 * document owns the numbers too, in the same render — PaverDesigner emits
 * its takeoff from these totals and would otherwise be one render behind
 * the shape it just closed.
 *
 * @param {object}   p.doc         { scale, shapes, imageOpacity }
 * @param {string}   p.imageUrl
 * @param {object}   [p.imageScale] the scale object the satellite route
 *                                  returns; parsed off the URL when absent
 * @param {Array}    p.layers      [{ key, ... }] — totals are keyed by these
 */
export function usePolygonMeasure({ doc, imageUrl = "", imageScale = null, layers = [] }) {
  const rawShapes = doc?.shapes;
  const shapes = useMemo(() => asShapes(rawShapes), [rawShapes]);
  const natural = useImageNaturalSize(imageUrl);

  const autoScale = useMemo(() => {
    if (imageScale && Number(imageScale.feetPerPixel) > 0) return imageScale;
    return imageUrl ? imageScaleFromUrl(imageUrl) : null;
  }, [imageScale, imageUrl]);

  const autoFeetPerUnit = useMemo(
    () =>
      autoScale
        ? canvasFeetPerUnit({
            feetPerPixel: autoScale.feetPerPixel,
            pixelWidth: autoScale.pixelWidth,
            pixelHeight: autoScale.pixelHeight,
            naturalWidth: natural?.width,
            naturalHeight: natural?.height,
            viewWidth: VIEW_W,
            viewHeight: VIEW_H,
            fit: "slice",
          })
        : null,
    [autoScale, natural],
  );

  const { feetPerUnit: fpp, source: scaleSource } = resolveScale({
    reference: doc?.scale || null,
    autoFeetPerUnit,
  });

  const measured = useMemo(
    () => shapes.map((s) => ({ shape: s, m: measureShape(s.points, fpp) })),
    [shapes, fpp],
  );

  const totals = useMemo(() => {
    const byLayer = Object.fromEntries(
      layers.map((l) => [l.key, { areaSqFt: 0, perimeterFt: 0 }]),
    );
    const fallback = layers[0]?.key;
    let areaSqFt = 0;
    let perimeterFt = 0;
    for (const { shape, m } of measured) {
      if (!m.ok) continue;
      const key = byLayer[shape.surface] ? shape.surface : fallback;
      if (key && byLayer[key]) {
        byLayer[key].areaSqFt = round2(byLayer[key].areaSqFt + m.areaSqFt);
        byLayer[key].perimeterFt = round2(byLayer[key].perimeterFt + m.perimeterFt);
      }
      areaSqFt = round2(areaSqFt + m.areaSqFt);
      perimeterFt = round2(perimeterFt + m.perimeterFt);
    }
    return { byLayer, areaSqFt, perimeterFt };
  }, [measured, layers]);

  return {
    shapes,
    fpp,
    scaleSource,
    autoScale,
    autoFeetPerUnit,
    natural,
    measured,
    totals,
  };
}

/* ── The canvas ────────────────────────────────────────────────────────── */

const layerOf = (layers, key) => layers.find((l) => l.key === key) || layers[0];

/**
 * @param {object}   p.doc       the drawing document
 * @param {Function} p.update    (patch | prev => patch) — the caller's one
 *                               update path, controlled or not
 * @param {Array}    p.layers    [{ key, labelKey, stroke, fill }]
 * @param {object}   p.measure   the object from usePolygonMeasure()
 * @param {string}   p.imageUrl
 * @param {ReactNode} p.heading  rendered left of the draw buttons
 * @param {string}   p.ariaLabel the canvas's accessible name
 * @param {Function} [p.renderShapeExtra] (shape, m) → node under a shape row
 */
export default function PolygonMeasure({
  doc,
  update,
  layers,
  measure,
  imageUrl = "",
  heading = null,
  ariaLabel,
  renderShapeExtra = null,
}) {
  const { t } = useTranslation();
  const { fpp, scaleSource, autoScale, autoFeetPerUnit, measured } = measure;

  // "idle" edits what exists; "draw" collects a polygon; "scale" collects the
  // two ends of the reference line.
  const [mode, setMode] = useState("idle");
  const [draft, setDraft] = useState(null); // { surface, points: [] }
  const [scaleDraft, setScaleDraft] = useState(null); // { a } while placing
  const [selectedId, setSelectedId] = useState(null);
  const [cursor, setCursor] = useState({ x: VIEW_W / 2, y: VIEW_H / 2 });
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [drag, setDrag] = useState(null);

  const svgRef = useRef(null);
  const draggedRef = useRef(false);

  const shapes = asShapes(doc?.shapes);
  const multiLayer = layers.length > 1;

  /* ── Pointer → viewBox coordinates ─────────────────────────────────── */

  const toView = useCallback((clientX, clientY) => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    return {
      x: clamp(((clientX - rect.left) / rect.width) * VIEW_W, 0, VIEW_W),
      y: clamp(((clientY - rect.top) / rect.height) * VIEW_H, 0, VIEW_H),
    };
  }, []);

  /* ── Placing points ────────────────────────────────────────────────── */

  const placePoint = useCallback(
    (pt) => {
      if (!pt) return;
      const p = { x: clamp(pt.x, 0, VIEW_W), y: clamp(pt.y, 0, VIEW_H) };
      if (mode === "draw") {
        setDraft((d) => (d ? { ...d, points: [...asPoints(d.points), p] } : d));
        return;
      }
      if (mode === "scale") {
        if (!scaleDraft) {
          setScaleDraft({ a: p });
          return;
        }
        // Keep whatever length was typed for the previous line: re-drawing the
        // reference over a better landmark shouldn't silently unset the scale.
        update((prev) => ({
          scale: {
            a: scaleDraft.a,
            b: p,
            lengthFt: numOf(prev.scale?.lengthFt),
          },
        }));
        setScaleDraft(null);
        setMode("idle");
        setKeyboardMode(false);
      }
    },
    [mode, scaleDraft, update],
  );

  const closeShape = useCallback(() => {
    const pts = asPoints(draft?.points);
    if (pts.length < 3) return;
    update((prev) => ({
      shapes: [
        ...asShapes(prev.shapes),
        {
          id: nextShapeId(),
          name: defaultName(asShapes(prev.shapes), layers, draft.surface, t),
          surface: draft.surface,
          points: pts,
        },
      ],
    }));
    setDraft(null);
    setMode("idle");
    setKeyboardMode(false);
  }, [draft, update, layers, t]);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setScaleDraft(null);
    setMode("idle");
    setKeyboardMode(false);
  }, []);

  const startDraw = (surface) => {
    setSelectedId(null);
    setDraft({ surface, points: [] });
    setMode("draw");
    svgRef.current?.focus();
  };

  const startScale = () => {
    setDraft(null);
    setScaleDraft(null);
    setMode("scale");
    svgRef.current?.focus();
  };

  /* ── Dragging a vertex ─────────────────────────────────────────────── */

  const beginDrag = (target) => (e) => {
    e.stopPropagation();
    draggedRef.current = false;
    setDrag(target);
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is a nicety; without it the drag still tracks while
      // the pointer stays over the canvas.
    }
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    const pt = toView(e.clientX, e.clientY);
    if (!pt) return;
    draggedRef.current = true;
    moveVertex(drag, pt);
  };

  const moveVertex = useCallback(
    (target, pt) => {
      const p = { x: clamp(pt.x, 0, VIEW_W), y: clamp(pt.y, 0, VIEW_H) };
      if (target.kind === "scale") {
        update((prev) => {
          if (!prev.scale) return {};
          return { scale: { ...prev.scale, [target.end]: p } };
        });
        return;
      }
      update((prev) => ({
        shapes: asShapes(prev.shapes).map((s) =>
          s.id === target.shapeId
            ? {
                ...s,
                points: asPoints(s.points).map((q, i) =>
                  i === target.index ? p : q,
                ),
              }
            : s,
        ),
      }));
    },
    [update],
  );

  const endDrag = (e) => {
    if (!drag) return;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Already released, or never captured. Nothing to undo.
    }
    setDrag(null);
  };

  const onCanvasClick = (e) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (mode === "idle") {
      setSelectedId(null);
      return;
    }
    placePoint(toView(e.clientX, e.clientY));
  };

  /* ── Keyboard ──────────────────────────────────────────────────────── */

  // The whole primary flow has to work without a mouse: a crosshair the arrow
  // keys move, Enter to drop a point, and buttons for everything else. Placing
  // a vertex is the only action a pointer can do that a keyboard otherwise
  // cannot, so it is the one that got the explicit affordance.
  const onCanvasKeyDown = (e) => {
    const step = e.shiftKey ? 1 : 12;
    const move = (dx, dy) => {
      e.preventDefault();
      setKeyboardMode(true);
      setCursor((c) => ({
        x: clamp(c.x + dx, 0, VIEW_W),
        y: clamp(c.y + dy, 0, VIEW_H),
      }));
    };
    switch (e.key) {
      case "ArrowLeft":
        return move(-step, 0);
      case "ArrowRight":
        return move(step, 0);
      case "ArrowUp":
        return move(0, -step);
      case "ArrowDown":
        return move(0, step);
      case "Enter":
      case " ":
        if (mode === "idle") return;
        e.preventDefault();
        setKeyboardMode(true);
        placePoint(cursor);
        return;
      case "Backspace":
        if (mode !== "draw") return;
        e.preventDefault();
        setDraft((d) =>
          d ? { ...d, points: asPoints(d.points).slice(0, -1) } : d,
        );
        return;
      case "Escape":
        if (mode === "idle") {
          setSelectedId(null);
          return;
        }
        e.preventDefault();
        cancelDraft();
        return;
      default:
        break;
    }
  };

  /* ── Render ────────────────────────────────────────────────────────── */

  const selected = shapes.find((s) => s.id === selectedId) || null;
  const draftPoints = asPoints(draft?.points);
  const scalePts = doc?.scale || null;
  const opacity = clamp(doc?.imageOpacity ?? 0.65, 0, 1);
  const draftLayer = layerOf(layers, draft?.surface);

  const handleKeyMove = (e, onMove) => {
    const step = e.shiftKey ? 1 : 8;
    const deltas = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = deltas[e.key];
    if (!d) return;
    e.preventDefault();
    onMove(d);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heading}
        <div className="flex flex-wrap gap-1.5">
          {layers.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => startDraw(l.key)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-foreground/30"
            >
              <Plus size={13} style={{ color: l.stroke }} />
              {t(l.labelKey)}
            </button>
          ))}
          <button
            type="button"
            onClick={startScale}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
              mode === "scale"
                ? "border-foreground bg-muted"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <Ruler size={13} />
            {scalePts
              ? t("app.paver.redrawScale")
              : autoFeetPerUnit
                ? t("app.measure.measureManually")
                : t("app.paver.setScale")}
          </button>
        </div>
      </div>

      {/* Scale first, loudly. Every number on this screen is downstream of it,
          and an estimator who traces five shapes before discovering that is an
          estimator who traces them twice. */}
      <ScaleBar
        t={t}
        scale={scalePts}
        fpp={fpp}
        source={scaleSource}
        autoScale={autoScale}
        autoFeetPerUnit={autoFeetPerUnit}
        mode={mode}
        placing={Boolean(scaleDraft)}
        onLength={(v) =>
          update((prev) =>
            prev.scale ? { scale: { ...prev.scale, lengthFt: v } } : {},
          )
        }
        onStart={startScale}
        onClear={() => update({ scale: null })}
      />

      {/* Drawing toolbar. Close and Undo are buttons rather than key hints
          alone, because the keyboard path has to be reachable by tabbing. */}
      {mode !== "idle" && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted px-3 py-2 text-xs">
          <span className="font-medium">
            {mode === "scale"
              ? scaleDraft
                ? t("app.paver.scaleFarEnd")
                : t("app.paver.scaleNearEnd")
              : t("app.paver.tracing", {
                  surface: t(draftLayer.labelKey).toLowerCase(),
                  points: t("app.paver.pointCount", { value: draftPoints.length }),
                })}
          </span>
          <span className="text-muted-foreground">
            {t("app.paver.keyHints")}
          </span>
          <span className="ml-auto flex gap-1.5">
            {mode === "draw" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) =>
                      d ? { ...d, points: asPoints(d.points).slice(0, -1) } : d,
                    )
                  }
                  disabled={draftPoints.length === 0}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
                >
                  <Undo2 size={12} /> {t("app.paver.undoPoint")}
                </button>
                <button
                  type="button"
                  onClick={closeShape}
                  disabled={draftPoints.length < 3}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
                >
                  <Check size={12} /> {t("app.paver.closeShape")}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={cancelDraft}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1"
            >
              <X size={12} /> {t("app.action.cancel")}
            </button>
          </span>
        </div>
      )}

      {/* text-foreground is load-bearing: the grid pattern strokes with
          currentColor, which resolves against the <svg> the pattern is
          defined in, not against the <rect> that paints it. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full rounded-lg border border-border bg-muted text-foreground touch-none"
        style={{ cursor: mode === "idle" ? "default" : "crosshair" }}
        role="application"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onCanvasKeyDown}
        onBlur={() => setKeyboardMode(false)}
        onClick={onCanvasClick}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <pattern
            id="pd-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M40 0 L0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.12"
            />
          </pattern>
        </defs>

        {imageUrl ? (
          <image
            href={imageUrl}
            x={0}
            y={0}
            width={VIEW_W}
            height={VIEW_H}
            opacity={opacity}
            // "slice", not "meet": saved drawings were traced over an image
            // placed this way, and the automatic scale is computed for it —
            // see the header and canvasFeetPerUnit().
            preserveAspectRatio="xMidYMid slice"
          />
        ) : null}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#pd-grid)" />

        {measured.map(({ shape, m }) => {
          const l = layerOf(layers, shape.surface);
          const pts = asPoints(shape.points);
          if (pts.length < 3) return null;
          const active = shape.id === selectedId;
          const c = centroid(pts);
          return (
            <g key={shape.id}>
              <polygon
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={l.fill}
                stroke={l.stroke}
                strokeWidth={active ? 3 : 2}
                onClick={(e) => {
                  // In draw mode the click has to reach the canvas, or a
                  // corner that lands on an existing shape never gets placed.
                  if (mode !== "idle") return;
                  e.stopPropagation();
                  setSelectedId(shape.id);
                }}
                style={{ cursor: mode === "idle" ? "pointer" : "crosshair" }}
              />
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                fontSize="15"
                fill="#111827"
                stroke="#ffffff"
                strokeWidth="4"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {shape.name || t(l.labelKey)}
                {m.ok
                  ? ` · ${t("app.paver.sqft", { n: Math.round(m.areaSqFt) })}`
                  : ` · ${t("app.paver.scaleNotSetShort")}`}
              </text>
            </g>
          );
        })}

        {/* Handles only for the selected shape, and only when nothing is being
            traced: a canvas full of draggable dots turns "click to add a
            point" into "accidentally move somebody else's corner". */}
        {mode === "idle" &&
          selected &&
          asPoints(selected.points).map((p, i) => (
            <circle
              key={`${selected.id}_${i}`}
              cx={p.x}
              cy={p.y}
              r={8}
              fill="#ffffff"
              stroke={layerOf(layers, selected.surface).stroke}
              strokeWidth={3}
              tabIndex={0}
              role="button"
              aria-label={t("app.paver.cornerAria", {
                name: selected.name || t(layerOf(layers, selected.surface).labelKey),
                index: i + 1,
                total: asPoints(selected.points).length,
              })}
              style={{ cursor: "grab" }}
              onPointerDown={beginDrag({
                kind: "shape",
                shapeId: selected.id,
                index: i,
              })}
              onKeyDown={(e) =>
                handleKeyMove(e, (d) =>
                  moveVertex(
                    { kind: "shape", shapeId: selected.id, index: i },
                    { x: p.x + d[0], y: p.y + d[1] },
                  ),
                )
              }
            />
          ))}

        {/* The polygon being traced. */}
        {draftPoints.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={draftLayer.stroke}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {draftPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={5}
                fill="#ffffff"
                stroke={draftLayer.stroke}
                strokeWidth={2}
              />
            ))}
          </g>
        )}

        {/* The reference line. */}
        {scaleDraft && (
          <circle
            cx={scaleDraft.a.x}
            cy={scaleDraft.a.y}
            r={6}
            fill="#111827"
            pointerEvents="none"
          />
        )}
        {scalePts && isPoint(scalePts.a) && isPoint(scalePts.b) && (
          <g>
            <line
              x1={scalePts.a.x}
              y1={scalePts.a.y}
              x2={scalePts.b.x}
              y2={scalePts.b.y}
              stroke="#111827"
              strokeWidth={3}
              strokeDasharray="10 6"
              pointerEvents="none"
            />
            <text
              x={(scalePts.a.x + scalePts.b.x) / 2}
              y={(scalePts.a.y + scalePts.b.y) / 2 - 10}
              textAnchor="middle"
              fontSize="15"
              fill="#111827"
              stroke="#ffffff"
              strokeWidth="4"
              paintOrder="stroke"
              pointerEvents="none"
            >
              {scaleSource === "manual"
                ? t("app.paver.ft", { n: round2(numOf(scalePts.lengthFt)) })
                : t("app.paver.lengthNotSet")}
            </text>
            {mode === "idle" &&
              ["a", "b"].map((end) => (
                <circle
                  key={end}
                  cx={scalePts[end].x}
                  cy={scalePts[end].y}
                  r={8}
                  fill="#ffffff"
                  stroke="#111827"
                  strokeWidth={3}
                  tabIndex={0}
                  role="button"
                  aria-label={
                    end === "a"
                      ? t("app.paver.scaleStartAria")
                      : t("app.paver.scaleEndAria")
                  }
                  style={{ cursor: "grab" }}
                  onPointerDown={beginDrag({ kind: "scale", end })}
                  onKeyDown={(e) =>
                    handleKeyMove(e, (d) =>
                      moveVertex(
                        { kind: "scale", end },
                        { x: scalePts[end].x + d[0], y: scalePts[end].y + d[1] },
                      ),
                    )
                  }
                />
              ))}
          </g>
        )}

        {/* The keyboard crosshair, shown only once a key has moved it — a
            permanent crosshair on a mouse-driven canvas is just clutter. */}
        {keyboardMode && mode !== "idle" && (
          <g pointerEvents="none">
            <line
              x1={cursor.x - 14}
              y1={cursor.y}
              x2={cursor.x + 14}
              y2={cursor.y}
              stroke="#111827"
              strokeWidth={2}
            />
            <line
              x1={cursor.x}
              y1={cursor.y - 14}
              x2={cursor.x}
              y2={cursor.y + 14}
              stroke="#111827"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {imageUrl && (
        <Field
          label={t("app.paver.imageOpacity", { pct: Math.round(opacity * 100) })}
        >
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) =>
              update({ imageOpacity: Number(e.target.value) / 100 })
            }
            className="mt-1 w-full"
          />
        </Field>
      )}

      <ShapeList
        t={t}
        layers={layers}
        multiLayer={multiLayer}
        measured={measured}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPatch={(id, patch) =>
          update((prev) => ({
            shapes: asShapes(prev.shapes).map((s) =>
              s.id === id ? { ...s, ...patch } : s,
            ),
          }))
        }
        onRemove={(id) => {
          setSelectedId((cur) => (cur === id ? null : cur));
          update((prev) => ({
            shapes: asShapes(prev.shapes).filter((s) => s.id !== id),
          }));
        }}
        renderShapeExtra={renderShapeExtra}
      />
    </div>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function ScaleBar({
  t,
  scale,
  fpp,
  source,
  autoScale,
  autoFeetPerUnit,
  mode,
  placing,
  onLength,
  onStart,
  onClear,
}) {
  // No reference line drawn. Either the image measures itself, or nothing
  // does yet — and the second has to be loud.
  if (!scale) {
    if (source === "auto" && fpp) {
      return (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <strong className="font-medium">
            {t("app.measure.autoScale", {
              inches: round2(fpp * 12),
              zoom: autoScale?.zoom ?? "",
              lat: round2(autoScale?.latitude ?? 0),
            })}
          </strong>{" "}
          {t("app.measure.autoScaleHelp")}{" "}
          {mode !== "scale" && (
            <button
              type="button"
              onClick={onStart}
              className="underline underline-offset-2"
            >
              {t("app.measure.measureManually")}
            </button>
          )}
          {placing && <span> {t("app.paver.nowClickFarEnd")}</span>}
        </div>
      );
    }
    return (
      <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <strong className="font-medium">{t("app.paver.scaleNotSet")}</strong>{" "}
        {t("app.paver.scaleNotSetHelp")}{" "}
        {mode !== "scale" && (
          <button
            type="button"
            onClick={onStart}
            className="underline underline-offset-2"
          >
            {t("app.paver.setTheScale")}
          </button>
        )}
        {placing && <span> {t("app.paver.nowClickFarEnd")}</span>}
      </div>
    );
  }

  // A reference line exists. It wins once its length is a positive number;
  // until then the automatic scale, if there is one, is still what measures.
  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-border px-3 py-2">
      <Field label={t("app.paver.referenceLength")} className="w-40">
        <Num
          value={scale.lengthFt}
          step={0.5}
          suffix={t("app.paver.ftUnit")}
          onChange={onLength}
        />
      </Field>
      <p className="pb-1.5 text-xs text-muted-foreground">
        {source === "manual"
          ? `${t("app.paver.pixelIs", { inches: round2(fpp * 12) })}${
              autoFeetPerUnit ? ` ${t("app.measure.manualInUse")}` : ""
            }`
          : autoFeetPerUnit
            ? t("app.measure.manualPending")
            : t("app.paver.typeRealLength")}
      </p>
      {autoFeetPerUnit && (
        <button
          type="button"
          onClick={onClear}
          className="mb-1.5 rounded border border-border px-2 py-1 text-xs hover:border-foreground/30"
        >
          {t("app.measure.useAutoScale")}
        </button>
      )}
    </div>
  );
}

function ShapeList({
  t,
  layers,
  multiLayer,
  measured,
  selectedId,
  onSelect,
  onPatch,
  onRemove,
  renderShapeExtra,
}) {
  if (measured.length === 0) {
    return (
      <p className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        {t("app.paver.noAreas")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {measured.map(({ shape, m }) => {
        const l = layerOf(layers, shape.surface);
        const active = shape.id === selectedId;
        return (
          <div
            key={shape.id}
            className={`rounded-lg border p-3 space-y-2 ${
              active ? "border-foreground/40" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: l.stroke }}
              />
              <input
                value={shape.name || ""}
                onChange={(e) => onPatch(shape.id, { name: e.target.value })}
                placeholder={t(l.labelKey)}
                aria-label={t("app.paver.areaName")}
                className="min-w-0 flex-1 border border-border rounded px-2 py-1.5 text-sm font-medium"
              />
              {/* One layer means nothing to choose; a select with a single
                  option is a control that appears to do something. */}
              {multiLayer && (
                <select
                  value={l.key}
                  onChange={(e) => onPatch(shape.id, { surface: e.target.value })}
                  aria-label={t("app.paver.surfaceType")}
                  className="border border-border rounded px-2 py-1.5 text-sm"
                >
                  {layers.map((o) => (
                    <option key={o.key} value={o.key}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => onSelect(active ? null : shape.id)}
                className="rounded border border-border px-2 py-1.5 text-xs"
              >
                {active ? t("app.action.done") : t("app.paver.adjust")}
              </button>
              <button
                type="button"
                onClick={() => onRemove(shape.id)}
                className="p-1.5 text-muted-foreground hover:text-red-600"
                aria-label={t("app.paver.removeArea", { name: shape.name || t(l.labelKey) })}
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {m.ok ? (
                <>
                  <span className="tabular-nums">
                    <span className="text-muted-foreground">{t("app.paver.area")} </span>
                    {t("app.paver.sqft", { n: Math.round(m.areaSqFt) })}
                  </span>
                  <span className="tabular-nums">
                    <span className="text-muted-foreground">{t("app.paver.perimeter")} </span>
                    {t("app.paver.ft", { n: m.perimeterFt.toFixed(1) })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("app.paver.corners", { value: m.points })}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {m.reason === "no_scale"
                    ? t("app.paver.scaleNotSetNoMeasure")
                    : t("app.paver.tooFewPoints", { points: t("app.paver.pointCount", { value: m.points }) })}
                </span>
              )}
            </div>

            {renderShapeExtra ? renderShapeExtra(shape, m) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────────────── */

function centroid(points) {
  const pts = asPoints(points);
  if (pts.length === 0) return { x: VIEW_W / 2, y: VIEW_H / 2 };
  const sum = pts.reduce(
    (acc, p) => ({ x: acc.x + numOf(p.x), y: acc.y + numOf(p.y) }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

// The name is UI-only, so the reader's language is the right one for it.
function defaultName(existing, layers, surface, t) {
  const l = layerOf(layers, surface);
  const label = t ? t(l.labelKey) : l.label;
  const n = asShapes(existing).filter((x) => x.surface === surface).length + 1;
  return n === 1 ? label : `${label} ${n}`;
}
