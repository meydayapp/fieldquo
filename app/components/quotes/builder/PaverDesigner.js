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
// The drawing itself — the canvas, the reference line, the keyboard path, the
// per-shape measurements — is PolygonMeasure.js, shared with the landscaping
// trades. This file is the PAVER layer on top of it: which three surfaces can
// be traced, the laying pattern and its waste, the base gravel by surface, the
// diagonal check, and the three takeoff fields the totals are written to.
//
// Everything measured here comes out of lib/pricing/paverTakeoff.js (via
// lib/measure/imageScale.js). This file owns the units and the emit, and NOT
// the arithmetic — the shoelace area, the diagonal check, the waste allowance
// and the base volumes all live in the engine, which is pure and has been
// executed against hostile input. A second implementation here would be the
// copy that rots.
//
// ── Two rules this screen refuses to break ─────────────────────────────────
//
// 1. Without a scale, there are no measurements. The scale now usually comes
//    for free — a satellite still carries its own ground resolution, see
//    PolygonMeasure.js — but for an uploaded photo it is still the reference
//    line, and until one of the two exists "scale not set" is what it says.
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
  squareCheck,
} from "@/lib/pricing/paverTakeoff";
import { isPoint } from "@/lib/measure/imageScale";
import { Field, Num, inputClass } from "./fields";
import { useTranslation } from "@/app/hooks/useTranslation";
import PolygonMeasure, { blankDrawing, usePolygonMeasure } from "./PolygonMeasure";

const numOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Is a traced quadrilateral actually a rectangle?
 *
 * The engine's squareCheck compares one measured diagonal against the diagonal
 * two sides imply. A quad has two of them, and a shape can be square at one
 * corner and skewed at the other, so both are run and the WORSE one is
 * reported — a takeoff that passes on its best corner is not a check.
 *
 * Paver-specific, so it stays here rather than in the shared canvas: a lawn
 * has no edge restraint to cut and no border course to lay square.
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

const round2 = (n) => Math.round(numOf(n) * 100) / 100;


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
    ...blankDrawing(),
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
  };
}

/* ── The designer ──────────────────────────────────────────────────────── */

export default function PaverDesigner({
  takeoff = null,
  onChange,
  design = null,
  onDesignChange = null,
  imageUrl = "",
  // The scale object /api/measure/satellite returned with the image. Optional:
  // without it the canvas parses the parameters off the URL, and an uploaded
  // photo with neither falls back to the reference line.
  imageScale = null,
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

  /* ── Measurements ──────────────────────────────────────────────────── */

  // The scale, each shape's area and the per-surface totals all come from the
  // shared hook, in this render — see usePolygonMeasure for why a hook and
  // not a callback.
  const measure = usePolygonMeasure({
    doc,
    imageUrl,
    imageScale,
    layers: SURFACES,
  });
  const { fpp } = measure;
  const pattern = patternOf(doc.pattern);

  const totals = useMemo(() => {
    const bySurface = Object.fromEntries(
      SURFACES.map((s) => [s.key, numOf(measure.totals.byLayer[s.key]?.areaSqFt)]),
    );
    return {
      bySurface,
      areaSqFt: measure.totals.areaSqFt,
      perimeterFt: measure.totals.perimeterFt,
    };
  }, [measure.totals]);

  /* ── Emit the takeoff ──────────────────────────────────────────────── */

  // Whole square feet. A shape traced over a satellite tile is not accurate to
  // a hundredth of a foot, and a quote line reading "437.26 sqft" claims a
  // precision the method does not have.
  //
  // `measuredAreaSqft` is the TRACED total, beside the three boxes: the boxes
  // can be typed over, and the document's "Area measured: N sq ft" caption
  // (lib/measure/measureImages.js measureCaption) must only ever claim what
  // was actually drawn. 0 when nothing is traced, which the caption reads as
  // "no measurement" and prints nothing.
  const emitted = useMemo(
    () => ({
      ...Object.fromEntries(
        SURFACES.map((s) => [
          s.takeoffKey,
          Math.round(totals.bySurface[s.key]),
        ]),
      ),
      measuredAreaSqft: Math.round(totals.areaSqFt),
    }),
    [totals],
  );

  // Seeded with the empty result so mounting an unused designer never zeroes
  // square footage somebody typed by hand. Once a shape is drawn the designer
  // owns those three fields, including on the way back down to zero.
  //
  // The guard is what makes it safe to depend on `onChange` and `takeoff`: the
  // parent's own re-render re-runs this effect, and the key check turns that
  // into a no-op instead of a loop.
  const lastEmit = useRef("0|0|0|0");

  //
  // A function of the takeoff as it is when the write lands, not a spread of
  // the prop: PavingTakeoff writes the still's frame onto the same takeoff in
  // an effect of its own, in the same commit as this one, and two spreads of
  // the same stale prop meant the second write silently undid the first.
  // TradeTakeoff's onChange (QuoteBuilder.updateTakeoff) composes functions.
  useEffect(() => {
    const key = [...SURFACES.map((s) => emitted[s.takeoffKey]), emitted.measuredAreaSqft].join("|");
    if (key === lastEmit.current) return;
    lastEmit.current = key;
    onChange?.((prev) => ({ ...(prev || takeoff || {}), ...emitted }));
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

  const tolerance = numOf(doc.toleranceFt);

  // The diagonal check is the tape-measure check a crew does before laying
  // anything, and it is the one thing that catches a trace that looks
  // rectangular and isn't. Rendered under the shape's row in the shared list.
  const renderNotSquare = (shape, m) => {
    const check = m.ok ? quadSquareCheck(m.feet, tolerance) : null;
    if (!check || check.square) return null;
    return (
      <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {t("app.paver.notSquare", {
          diff: check.differenceFt,
          implied: check.diagonal,
          measured: check.diagonal2,
          tolerance,
        })}
      </p>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <PolygonMeasure
        doc={doc}
        update={update}
        layers={SURFACES}
        measure={measure}
        imageUrl={imageUrl}
        ariaLabel={t("app.paver.canvasAria")}
        heading={
          <div>
            <h3 className="text-sm font-medium">{t("app.paver.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("app.paver.intro")}
            </p>
          </div>
        }
        renderShapeExtra={renderNotSquare}
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
