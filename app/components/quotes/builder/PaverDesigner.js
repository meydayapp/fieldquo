// app/components/quotes/builder/PaverDesigner.js
//
// Trace the area, get the takeoff.
//
// The paving takeoff (TradeTakeoff.js → PavingTakeoff) asks for three numbers:
// patio sqft, walkway sqft, driveway sqft. On a real driveway an estimator gets
// those by pacing the site and multiplying in their head, or by measuring a
// satellite image with a ruler on the screen. Both of those produce a number
// nobody can check later. This screen produces the same number from a drawing
// that can be re-opened, re-measured and argued with.
//
// Everything measured here comes out of lib/pricing/paverTakeoff.js. This file
// owns the drawing and the units, and NOT the arithmetic — the shoelace area,
// the diagonal check, the waste allowance and the base volumes all live in the
// engine, which is pure and has been executed against hostile input. A second
// implementation here would be the copy that rots.
//
// ── Two rules this screen refuses to break ─────────────────────────────────
//
// 1. Without a scale, there are no measurements. A traced shape has an area in
//    PIXELS at all times, and showing that number — even greyed out, even
//    labelled "px" — invites somebody to read it as feet. "Scale not set" is
//    the honest output, so that is what it says.
// 2. The materials panel is internal. Paver counts, gravel yardage and bag
//    counts are ordering numbers with waste and compaction inside them; they
//    are not a bill of materials for a client, and the panel says so on screen.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PAVER_WASTE,
  baseMaterials,
  paverCount,
  polySandBags,
  polygonAreaSqFt,
  polygonPerimeterFt,
  squareCheck,
} from "@/lib/pricing/paverTakeoff";
import { Check, Plus, Ruler, Trash2, Undo2, X } from "lucide-react";
import { Field, Num, inputClass } from "./fields";
import { useTranslation } from "@/app/hooks/useTranslation";

/* ── Geometry, exported for the check script ───────────────────────────────
 *
 * Pure and dependency-light on purpose: the scale conversion is the one piece
 * of maths this file adds to the engine, and it is exactly where a divide-by-
 * zero or an Infinity would get through unnoticed. Exported so a script can
 * execute it rather than a reviewer reading it. */

const numOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const isPoint = (p) =>
  Boolean(p) && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y));

/**
 * Feet per canvas pixel, from the reference line the user drew.
 *
 * Returns null — never 0, never Infinity — when the line is degenerate or no
 * length has been typed yet. Callers branch on null and print "scale not set";
 * a 0 would silently measure every shape as nothing, and an Infinity would
 * measure a 12 ft patio as the county.
 */
export function feetPerPixel(scale) {
  if (!scale || !isPoint(scale.a) || !isPoint(scale.b)) return null;
  const px = Math.hypot(
    numOf(scale.b.x) - numOf(scale.a.x),
    numOf(scale.b.y) - numOf(scale.a.y),
  );
  const ft = numOf(scale.lengthFt);
  if (!(px > 0) || !(ft > 0)) return null;
  const ratio = ft / px;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

/**
 * Measure one traced shape.
 *
 * `reason` carries WHY there is no measurement, because "add another point"
 * and "set the scale" are different problems and a single blank cell tells the
 * estimator neither.
 *
 * @returns {{ok:boolean, reason:string|null, points:number, areaSqFt:number,
 *            perimeterFt:number, feet:Array<{x:number,y:number}>}}
 */
export function measureShape(points, fpp) {
  const pts = Array.isArray(points) ? points.filter(isPoint) : [];
  const none = (reason) => ({
    ok: false,
    reason,
    points: pts.length,
    areaSqFt: 0,
    perimeterFt: 0,
    feet: [],
  });
  if (pts.length < 3) return none("too_few");
  const scale = Number(fpp);
  if (!Number.isFinite(scale) || scale <= 0) return none("no_scale");

  const feet = pts.map((p) => ({
    x: numOf(p.x) * scale,
    y: numOf(p.y) * scale,
  }));
  return {
    ok: true,
    reason: null,
    points: pts.length,
    areaSqFt: polygonAreaSqFt(feet),
    perimeterFt: polygonPerimeterFt(feet),
    feet,
  };
}

/**
 * Is a traced quadrilateral actually a rectangle?
 *
 * The engine's squareCheck compares one measured diagonal against the diagonal
 * two sides imply. A quad has two of them, and a shape can be square at one
 * corner and skewed at the other, so both are run and the WORSE one is
 * reported — a takeoff that passes on its best corner is not a check.
 *
 * @returns {{diagonal:number, diagonal2:number|null, square:boolean,
 *            differenceFt:number}|null} null unless there are exactly 4 points.
 */
export function quadSquareCheck(feet, toleranceFt = 0.25) {
  if (!Array.isArray(feet) || feet.length !== 4 || !feet.every(isPoint)) {
    return null;
  }
  const [p0, p1, p2, p3] = feet;
  const d = (a, b) =>
    Math.hypot(numOf(b.x) - numOf(a.x), numOf(b.y) - numOf(a.y));
  const at = (l, w, diag) =>
    squareCheck({
      lengthFt: l,
      widthFt: w,
      measuredDiagonalFt: diag,
      toleranceFt,
    });
  const first = at(d(p0, p1), d(p1, p2), d(p0, p2));
  const second = at(d(p1, p2), d(p2, p3), d(p1, p3));
  return first.differenceFt >= second.differenceFt ? first : second;
}

/* ── end geometry ────────────────────────────────────────────────────────── */

const VIEW_W = 1000;
const VIEW_H = 640;

const round2 = (n) => Math.round(numOf(n) * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, numOf(n)));

// Copied from TradeTakeoff.js rather than imported: that file exports only its
// entry points, and this one must not edit it. If a third takeoff screen wants
// them, they belong in a shared module — see the note in the handoff.

/* ── What the estimator can choose ─────────────────────────────────────── */

// Surfaces are the three the paving book prices, keyed to the takeoff fields
// buildPaving reads. `depth` mirrors the engine's own standard base depth so
// the panel can say which one it used — a driveway carries 8" of gravel and a
// walkway 4", and a summed yardage that doesn't say so is unreadable.
const SURFACES = [
  {
    key: "patio",
    label: "Patio",
    labelKey: "app.paver.surfacePatio",
    takeoffKey: "patioSqft",
    stroke: "#b45309",
    fill: "rgba(217,119,6,0.28)",
  },
  {
    key: "walkway",
    label: "Walkway",
    labelKey: "app.paver.surfaceWalkway",
    takeoffKey: "walkwaySqft",
    stroke: "#1d4ed8",
    fill: "rgba(37,99,235,0.28)",
  },
  {
    key: "driveway",
    label: "Driveway",
    labelKey: "app.paver.surfaceDriveway",
    takeoffKey: "drivewaySqft",
    stroke: "#0f766e",
    fill: "rgba(13,148,136,0.28)",
  },
];

const surfaceOf = (key) => SURFACES.find((s) => s.key === key) || SURFACES[0];

// Each pattern names a waste bucket the engine already defines. None of these
// percentages is invented here — the mapping is the only judgement:
// basketweave is laid square to the edges, so it cuts like running bond, and
// pretending it wastes 20% would order stone nobody lays.
const PATTERNS = [
  {
    value: "running_bond",
    label: "Running bond",
    labelKey: "app.paver.patternRunningBond",
    waste: "straight",
    note: "Straight courses, half-bond offset. Least cutting.",
    noteKey: "app.paver.patternRunningBondNote",
  },
  {
    value: "herringbone",
    label: "Herringbone",
    labelKey: "app.paver.patternHerringbone",
    waste: "herringbone",
    note: "45° or 90° weave. Every edge course is a cut.",
    noteKey: "app.paver.patternHerringboneNote",
  },
  {
    value: "basketweave",
    label: "Basketweave",
    labelKey: "app.paver.patternBasketweave",
    waste: "straight",
    note: "Pairs laid square to the edges, so it cuts like running bond.",
    noteKey: "app.paver.patternBasketweaveNote",
  },
];

const patternOf = (value) =>
  PATTERNS.find((p) => p.value === value) || PATTERNS[0];

// `label` is the English seed each table keeps for anything that reads the
// data without a translator (tests, the engine's own summaries); `labelKey` is
// what the screen prints, through t(). Same for `note`/`noteKey` above.
const JOINT_WIDTHS = [
  { value: "narrow", label: 'Narrow joints (up to 1/4")', labelKey: "app.paver.jointNarrow" },
  { value: "wide", label: 'Wide joints (1/4"–1")', labelKey: "app.paver.jointWide" },
  { value: "flagstone", label: "Flagstone / irregular", labelKey: "app.paver.jointFlagstone" },
];

function blankDesign() {
  return {
    scale: null,
    shapes: [],
    pattern: "running_bond",
    // null, not 0: 0 is a real answer ("order exactly the theoretical count")
    // and must not be what a blank field means.
    wastePctOverride: null,
    paverLengthIn: 8,
    paverWidthIn: 4,
    // 0 matches the engine's default and the published coverage tables, which
    // absorb the joint into the waste allowance. Counting it twice orders short.
    jointIn: 0,
    jointWidth: "narrow",
    toleranceFt: 0.25,
    imageOpacity: 0.65,
  };
}

const asShapes = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const asPoints = (v) => (Array.isArray(v) ? v.filter(isPoint) : []);

let shapeSeq = 0;
const nextShapeId = () => `shape_${Date.now().toString(36)}_${shapeSeq++}`;

/* ── The canvas ────────────────────────────────────────────────────────── */

export default function PaverDesigner({
  takeoff = null,
  onChange,
  design = null,
  onDesignChange = null,
  imageUrl = "",
  className = "",
}) {
  const { t } = useTranslation();
  // Controlled only when the parent supplies BOTH halves. A `design` prop with
  // no way to report edits would render a canvas that swallows every change —
  // the exact "control that appears to work" this codebase keeps finding — so
  // a one-sided prop is treated as a seed instead.
  const controlled = Boolean(design && onDesignChange);
  const [internal, setInternal] = useState(() => ({
    ...blankDesign(),
    ...(design || {}),
  }));
  const doc = useMemo(
    () => (controlled ? { ...blankDesign(), ...design } : internal),
    [controlled, design, internal],
  );

  // One update path for both modes: `patch` is a partial design, or a function
  // of the current design returning one.
  const update = useCallback(
    (patch) => {
      const apply = (prev) => ({
        ...prev,
        ...(typeof patch === "function" ? patch(prev) : patch),
      });
      if (controlled) onDesignChange(apply({ ...blankDesign(), ...design }));
      else setInternal(apply);
    },
    [controlled, design, onDesignChange],
  );

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

  const shapes = asShapes(doc.shapes);
  const fpp = feetPerPixel(doc.scale);
  const pattern = patternOf(doc.pattern);

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
          name: defaultName(asShapes(prev.shapes), draft.surface, t),
          surface: draft.surface,
          points: pts,
        },
      ],
    }));
    setDraft(null);
    setMode("idle");
    setKeyboardMode(false);
  }, [draft, update]);

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

  /* ── Measurements ──────────────────────────────────────────────────── */

  const measured = useMemo(
    () =>
      shapes.map((s) => {
        const m = measureShape(s.points, fpp);
        return {
          shape: s,
          m,
          check: m.ok ? quadSquareCheck(m.feet, numOf(doc.toleranceFt)) : null,
        };
      }),
    [shapes, fpp, doc.toleranceFt],
  );

  const totals = useMemo(() => {
    const bySurface = { patio: 0, walkway: 0, driveway: 0 };
    let perimeterFt = 0;
    for (const { shape, m } of measured) {
      if (!m.ok) continue;
      const key = surfaceOf(shape.surface).key;
      bySurface[key] = round2(bySurface[key] + m.areaSqFt);
      perimeterFt = round2(perimeterFt + m.perimeterFt);
    }
    const areaSqFt = round2(
      bySurface.patio + bySurface.walkway + bySurface.driveway,
    );
    return { bySurface, areaSqFt, perimeterFt };
  }, [measured]);

  /* ── Emit the takeoff ──────────────────────────────────────────────── */

  // Whole square feet. A shape traced over a satellite tile is not accurate to
  // a hundredth of a foot, and a quote line reading "437.26 sqft" claims a
  // precision the method does not have.
  const emitted = useMemo(
    () =>
      Object.fromEntries(
        SURFACES.map((s) => [
          s.takeoffKey,
          Math.round(totals.bySurface[s.key]),
        ]),
      ),
    [totals],
  );

  // Seeded with the empty result so mounting an unused designer never zeroes
  // square footage somebody typed by hand. Once a shape is drawn the designer
  // owns those three fields, including on the way back down to zero.
  //
  // The guard is what makes it safe to depend on `onChange` and `takeoff`: the
  // parent's own re-render re-runs this effect, and the key check turns that
  // into a no-op instead of a loop.
  const lastEmit = useRef("0|0|0");

  useEffect(() => {
    const key = SURFACES.map((s) => emitted[s.takeoffKey]).join("|");
    if (key === lastEmit.current) return;
    lastEmit.current = key;
    onChange?.({ ...(takeoff || {}), ...emitted });
  }, [emitted, onChange, takeoff]);

  /* ── Materials ─────────────────────────────────────────────────────── */

  const materials = useMemo(() => {
    if (!(totals.areaSqFt > 0)) return null;

    const waste =
      doc.wastePctOverride === null || doc.wastePctOverride === ""
        ? null
        : numOf(doc.wastePctOverride) / 100;

    const pavers = paverCount({
      areaSqFt: totals.areaSqFt,
      paverLengthIn: doc.paverLengthIn,
      paverWidthIn: doc.paverWidthIn,
      jointIn: doc.jointIn,
      pattern: pattern.waste,
      wastePct: waste,
    });

    // Base depth is a property of what the surface carries, so the volumes are
    // summed per surface rather than run once on the total. Averaging a
    // driveway's 8" against a walkway's 4" under-orders one and over-orders
    // the other.
    const base = { gravelCuYd: 0, sandCuYd: 0, bySurface: [] };
    for (const s of SURFACES) {
      const area = totals.bySurface[s.key];
      if (!(area > 0)) continue;
      const b = baseMaterials({ areaSqFt: area, surface: s.key });
      base.gravelCuYd = round2(base.gravelCuYd + b.gravelCuYd);
      base.sandCuYd = round2(base.sandCuYd + b.sandCuYd);
      base.bySurface.push({ ...s, area, ...b });
    }

    return {
      pavers,
      base,
      poly: polySandBags({ areaSqFt: totals.areaSqFt, joint: doc.jointWidth }),
    };
  }, [totals, doc, pattern]);

  /* ── Render ────────────────────────────────────────────────────────── */

  const selected = shapes.find((s) => s.id === selectedId) || null;
  const draftPoints = asPoints(draft?.points);
  const scalePts = doc.scale;
  const opacity = clamp(doc.imageOpacity, 0, 1);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{t("app.paver.title")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("app.paver.intro")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SURFACES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => startDraw(s.key)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-foreground/30"
            >
              <Plus size={13} style={{ color: s.stroke }} />
              {t(s.labelKey)}
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
            {scalePts ? t("app.paver.redrawScale") : t("app.paver.setScale")}
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
        mode={mode}
        placing={Boolean(scaleDraft)}
        onLength={(v) =>
          update((prev) =>
            prev.scale ? { scale: { ...prev.scale, lengthFt: v } } : {},
          )
        }
        onStart={startScale}
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
                  surface: t(surfaceOf(draft?.surface).labelKey).toLowerCase(),
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
        aria-label={t("app.paver.canvasAria")}
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
            preserveAspectRatio="xMidYMid slice"
          />
        ) : null}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#pd-grid)" />

        {measured.map(({ shape, m }) => {
          const s = surfaceOf(shape.surface);
          const pts = asPoints(shape.points);
          if (pts.length < 3) return null;
          const active = shape.id === selectedId;
          const c = centroid(pts);
          return (
            <g key={shape.id}>
              <polygon
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={s.fill}
                stroke={s.stroke}
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
                {shape.name || t(s.labelKey)}
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
              stroke={surfaceOf(selected.surface).stroke}
              strokeWidth={3}
              tabIndex={0}
              role="button"
              aria-label={t("app.paver.cornerAria", {
                name: selected.name || t(surfaceOf(selected.surface).labelKey),
                index: i + 1,
                total: asPoints(selected.points).length,
              })}
              style={{ cursor: "grab" }}
              onPointerDown={beginDrag({
                kind: "shape",
                shapeId: selected.id,
                index: i,
              })}
              onKeyDown={(e) => {
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
                moveVertex(
                  { kind: "shape", shapeId: selected.id, index: i },
                  { x: p.x + d[0], y: p.y + d[1] },
                );
              }}
            />
          ))}

        {/* The polygon being traced. */}
        {draftPoints.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={surfaceOf(draft?.surface).stroke}
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
                stroke={surfaceOf(draft?.surface).stroke}
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
              {fpp
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
                  onKeyDown={(e) => {
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
                    moveVertex(
                      { kind: "scale", end },
                      { x: scalePts[end].x + d[0], y: scalePts[end].y + d[1] },
                    );
                  }}
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
        tolerance={numOf(doc.toleranceFt)}
      />

      <SurfaceTotals t={t} totals={totals} emitted={emitted} fpp={fpp} />

      <PaverSpec t={t} doc={doc} pattern={pattern} update={update} />

      <MaterialsPanel t={t} materials={materials} pattern={pattern} />

      {!controlled && (
        <p className="text-xs text-muted-foreground">
          {t("app.paver.notSavedNote")}
        </p>
      )}
    </div>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function ScaleBar({ t, scale, fpp, mode, placing, onLength, onStart }) {
  if (!scale) {
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
        {fpp
          ? t("app.paver.pixelIs", { inches: round2(fpp * 12) })
          : t("app.paver.typeRealLength")}
      </p>
    </div>
  );
}

function ShapeList({
  t,
  measured,
  selectedId,
  onSelect,
  onPatch,
  onRemove,
  tolerance,
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
      {measured.map(({ shape, m, check }) => {
        const s = surfaceOf(shape.surface);
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
                style={{ background: s.stroke }}
              />
              <input
                value={shape.name || ""}
                onChange={(e) => onPatch(shape.id, { name: e.target.value })}
                placeholder={t(s.labelKey)}
                aria-label={t("app.paver.areaName")}
                className="min-w-0 flex-1 border border-border rounded px-2 py-1.5 text-sm font-medium"
              />
              <select
                value={s.key}
                onChange={(e) => onPatch(shape.id, { surface: e.target.value })}
                aria-label={t("app.paver.surfaceType")}
                className="border border-border rounded px-2 py-1.5 text-sm"
              >
                {SURFACES.map((o) => (
                  <option key={o.key} value={o.key}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
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
                aria-label={t("app.paver.removeArea", { name: shape.name || t(s.labelKey) })}
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

            {/* The diagonal check is the tape-measure check a crew does before
                laying anything, and it is the one thing that catches a trace
                that looks rectangular and isn't. */}
            {check && !check.square && (
              <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {t("app.paver.notSquare", {
                  diff: check.differenceFt,
                  implied: check.diagonal,
                  measured: check.diagonal2,
                  tolerance,
                })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SurfaceTotals({ t, totals, emitted, fpp }) {
  const any = SURFACES.some((s) => numOf(emitted[s.takeoffKey]) > 0);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {SURFACES.map((s) => (
          <div key={s.key}>
            <div className="text-xs text-muted-foreground">{t(s.labelKey)}</div>
            <div className="text-lg font-medium tabular-nums">
              {fpp ? (
                <>
                  {Math.round(totals.bySurface[s.key])}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("app.paver.sqftUnit")}
                  </span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">
                  {t("app.paver.scaleNotSetShort")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {any
          ? t("app.paver.totalsNote", {
              sqft: totals.areaSqFt.toFixed(0),
              edge: totals.perimeterFt.toFixed(1),
            })
          : t("app.paver.nothingMeasured")}
      </p>
    </div>
  );
}

function PaverSpec({ t, doc, pattern, update }) {
  const wasteFromPattern = PAVER_WASTE[pattern.waste] ?? PAVER_WASTE.straight;
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div>
        <span className="text-xs text-muted-foreground">{t("app.paver.layingPattern")}</span>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {PATTERNS.map((p) => {
            const active = pattern.value === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => update({ pattern: p.value })}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-foreground/50 bg-muted"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="block text-sm font-medium">{t(p.labelKey)}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(p.noteKey)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("app.paver.cuttingAllowance", {
                    pct: Math.round((PAVER_WASTE[p.waste] ?? 0) * 100),
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Field label={t("app.paver.paverLength")}>
          <Num
            value={doc.paverLengthIn}
            step={0.25}
            onChange={(v) => update({ paverLengthIn: v })}
          />
        </Field>
        <Field label={t("app.paver.paverWidth")}>
          <Num
            value={doc.paverWidthIn}
            step={0.25}
            onChange={(v) => update({ paverWidthIn: v })}
          />
        </Field>
        <Field label={t("app.paver.jointWidth")}>
          <Num
            value={doc.jointIn}
            step={0.0625}
            onChange={(v) => update({ jointIn: v })}
          />
        </Field>
        <Field label={t("app.paver.wastePct")}>
          <input
            type="number"
            min={0}
            step={1}
            value={doc.wastePctOverride ?? ""}
            placeholder={String(Math.round(wasteFromPattern * 100))}
            onChange={(e) =>
              update({
                wastePctOverride:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("app.paver.polySandJoint")}>
          <select
            value={doc.jointWidth || "narrow"}
            onChange={(e) => update({ jointWidth: e.target.value })}
            className={inputClass}
          >
            {JOINT_WIDTHS.map((j) => (
              <option key={j.value} value={j.value}>
                {t(j.labelKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("app.paver.squareTolerance")}>
          <Num
            value={doc.toleranceFt}
            step={0.25}
            onChange={(v) => update({ toleranceFt: v })}
          />
          {/* 0.25 ft is the engine's default and it is a TAPE tolerance. A
              shape traced over a satellite tile will rarely meet it, so the
              number is editable rather than the warning being softened. */}
          <p className="mt-1 text-xs text-muted-foreground">
            {t("app.paver.toleranceHint")}
          </p>
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("app.paver.jointHint")}
      </p>
    </div>
  );
}

function MaterialsPanel({ t, materials, pattern }) {
  if (!materials) return null;
  const { pavers, base, poly } = materials;
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">{t("app.paver.materialsToOrder")}</h4>
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("app.paver.internalEstimate")}
        </span>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Stat
          label={t("app.paver.pavers")}
          value={pavers.order > 0 ? `${pavers.order}` : "—"}
          hint={
            pavers.order > 0
              ? t("app.paver.paversHint", {
                  exact: pavers.exact,
                  pct: Math.round(pavers.wastePct * 100),
                  pattern: t(pattern.labelKey).toLowerCase(),
                  perSqFt: pavers.perSqFt,
                })
              : t("app.paver.enterPaverSize")
          }
        />
        <Stat
          label={t("app.paver.baseGravel")}
          value={t("app.paver.cuYd", { n: base.gravelCuYd })}
          hint={t("app.paver.gravelHint", {
            depths: base.bySurface
              .map((b) => `${t(b.labelKey).toLowerCase()} ${b.gravelDepthIn}"`)
              .join(", "),
          })}
        />
        <Stat
          label={t("app.paver.beddingSand")}
          value={t("app.paver.cuYd", { n: base.sandCuYd })}
          hint={t("app.paver.sandHint")}
        />
        <Stat
          label={t("app.paver.polySand")}
          value={
            poly.low === poly.high
              ? t("app.paver.bags", { value: poly.low })
              : t("app.paver.bagsRange", { low: poly.low, high: poly.high })
          }
          hint={t("app.paver.polyHint")}
        />
      </dl>

      <p className="text-xs text-muted-foreground">
        {t("app.paver.quantitiesOnly")}
      </p>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium tabular-nums">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
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

// The name is UI-only (the drawing is not saved — see notSavedNote), so the
// reader's language is the right one for it.
function defaultName(existing, surface, t) {
  const s = surfaceOf(surface);
  const label = t ? t(s.labelKey) : s.label;
  const n = asShapes(existing).filter((x) => x.surface === surface).length + 1;
  return n === 1 ? label : `${label} ${n}`;
}
