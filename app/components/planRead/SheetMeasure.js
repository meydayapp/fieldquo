"use client";

// app/components/planRead/SheetMeasure.js
//
// "Check measurements on drawing": a drawing sheet (or a site photo), a scale,
// and a line or an area traced on it — to verify a quantity the read
// produced, or to correct it.
//
// ══ The scale ══════════════════════════════════════════════════════════════
//
// A sheet starts on its title-block scale when it has one (feet per pixel from
// lib/planRead/dimensions.js feetPerPixelFromScale, served with the sheet).
// The estimator can always CALIBRATE over it: draw a line along something of
// known length — tapping a printed dimension fills its length in — and type
// it, in feet or metres. A photo has no scale until calibrated. No scale, no
// number: the panel says "set the scale" rather than measuring nothing.
//
// The arithmetic is lib/measure/imageScale.js's — referenceFeetPerPixel,
// measureShape (the shoelace the paver and lawn tracers already use) and
// measurePolyline — in IMAGE pixels, so the zoom never changes a figure.
//
// ══ What a measurement does ════════════════════════════════════════════════
//
// "Use for" writes it onto one surface of the overview as a MEASURED
// quantity (PATCH /api/plan-reads/[id], op "measure" — a person-only op),
// which outranks every other source and is never marked estimated. Only
// surfaces in the matching unit are offered: an area for square-foot items,
// a line for linear-foot items.

import { useMemo, useRef, useState } from "react";
import { X, Ruler, Square, Spline, ZoomIn, ZoomOut, Undo2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { referenceFeetPerPixel, measureShape, measurePolyline } from "@/lib/measure/imageScale";
import { FEET_PER_METRE } from "@/lib/planRead/dimensions";

const fmt = (n, dp = 1) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: dp }) : "—");

/**
 * @param {{ open: boolean, onClose: () => void,
 *           sources: { key, name, image: {url,width,height}, feetPerPixel?: number|null, scaleText?: string|null, dims?: object[] }[],
 *           initialKey?: string, surfaces: object[], onUse: (surfaceId, value, sourceText) => Promise<void> }} props
 */
export default function SheetMeasure({ open, onClose, sources, initialKey, surfaces = [], onUse }) {
  const { t } = useTranslation();
  const [key, setKey] = useState(initialKey || sources?.[0]?.key || null);
  const src = sources?.find((s) => s.key === key) || sources?.[0] || null;
  const [mode, setMode] = useState("line");
  const [zoom, setZoom] = useState(0.35);
  const [points, setPoints] = useState([]);
  const [calib, setCalib] = useState({ a: null, b: null, length: "", unit: "ft", label: "" });
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const svgRef = useRef(null);

  const calibratedFpp = useMemo(() => {
    const n = Number(calib.length);
    const lengthFt = calib.unit === "m" ? n * FEET_PER_METRE : n;
    return referenceFeetPerPixel({ a: calib.a, b: calib.b, lengthFt });
  }, [calib]);
  const fpp = calibratedFpp ?? src?.feetPerPixel ?? null;
  const scaleSource = calibratedFpp
    ? t("app.planRead.measure.scaleCalibrated", "calibrated on {len}", { len: calib.label || `${calib.length} ${calib.unit}` })
    : src?.feetPerPixel
      ? t("app.planRead.measure.scaleTitle", "title-block scale {scale}", { scale: src.scaleText || "" })
      : null;

  const result = useMemo(() => {
    if (mode === "area") return measureShape(points, fpp);
    if (mode === "line") return measurePolyline(points, fpp);
    return null;
  }, [mode, points, fpp]);

  if (!open || !src) return null;

  const w = src.image.width;
  const h = src.image.height;
  const toImage = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * w, y: ((e.clientY - rect.top) / rect.height) * h };
  };
  const onClick = (e) => {
    const p = toImage(e);
    if (mode === "calibrate") {
      setCalib((c) => (!c.a || (c.a && c.b) ? { ...c, a: p, b: null } : { ...c, b: p }));
      return;
    }
    setPoints((list) => [...list, p]);
  };
  const unitWanted = mode === "area" ? "sqft" : "lnft";
  const choices = surfaces.filter((s) => s.quantity?.unit === unitWanted && s.active !== false);
  const value = mode === "area" ? result?.areaSqFt : result?.lengthFt;
  const canUse = result?.ok && value > 0 && target && !saving;
  const r = Math.max(4, w / 400);

  async function use() {
    setSaving(true);
    try {
      const text = t("app.planRead.measure.sourceText", "Measured on {sheet} — {scale}", { sheet: src.name, scale: scaleSource || "" });
      await onUse(target, Math.round(value * 10) / 10, text);
      setPoints([]);
    } finally {
      setSaving(false);
    }
  }

  const tool = (m, Icon, label) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        if (m !== "calibrate") setPoints([]);
      }}
      aria-pressed={mode === m}
      className={`inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg text-sm border ${mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
    >
      <Icon className="w-4 h-4" aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={t("app.planRead.measure.title", "Check measurements")}>
      <div className="bg-card w-full sm:max-w-6xl sm:rounded-xl flex flex-col max-h-full">
        <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold shrink-0">{t("app.planRead.measure.title", "Check measurements")}</h2>
            <select value={src.key} onChange={(e) => { setKey(e.target.value); setPoints([]); setCalib({ a: null, b: null, length: "", unit: "ft", label: "" }); }} className="min-h-[40px] max-w-[50vw] rounded-md border border-border bg-background px-2 text-sm">
              {sources.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-accent" aria-label={t("app.planRead.measure.close", "Close")}>
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border">
          {tool("calibrate", Ruler, t("app.planRead.measure.calibrate", "Set scale"))}
          {tool("line", Spline, t("app.planRead.measure.line", "Line"))}
          {tool("area", Square, t("app.planRead.measure.area", "Area"))}
          <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg text-sm border border-border hover:bg-accent">
            <Undo2 className="w-4 h-4" aria-hidden />
            {t("app.planRead.measure.undo", "Undo point")}
          </button>
          <span className="ml-auto inline-flex gap-1">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.1, z / 1.4))} className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-border" aria-label={t("app.planRead.measure.zoomOut", "Zoom out")}><ZoomOut className="w-4 h-4" aria-hidden /></button>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, z * 1.4))} className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-border" aria-label={t("app.planRead.measure.zoomIn", "Zoom in")}><ZoomIn className="w-4 h-4" aria-hidden /></button>
          </span>
        </div>

        {mode === "calibrate" && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border text-sm">
            <span className="text-muted-foreground">
              {calib.a && calib.b
                ? t("app.planRead.measure.calibLength", "That line is")
                : t("app.planRead.measure.calibHint", "Click both ends of something whose length you know — a printed dimension, a door.")}
            </span>
            {calib.a && calib.b && (
              <>
                <input type="number" inputMode="decimal" min="0" step="any" value={calib.length} onChange={(e) => setCalib((c) => ({ ...c, length: e.target.value, label: "" }))} className="w-24 min-h-[40px] rounded-md border border-border bg-background px-2" aria-label={t("app.planRead.measure.knownLength", "Known length")} />
                <select value={calib.unit} onChange={(e) => setCalib((c) => ({ ...c, unit: e.target.value, label: "" }))} className="min-h-[40px] rounded-md border border-border bg-background px-2">
                  <option value="ft">ft</option>
                  <option value="m">m</option>
                </select>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-muted min-h-[40vh]">
          <div className="relative" style={{ width: w * zoom, height: h * zoom }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src.image.url} alt={src.name} width={w * zoom} height={h * zoom} className="block select-none" draggable={false} />
            <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full cursor-crosshair" onClick={onClick}>
              {(src.dims || []).filter((d) => d.x !== null && d.y !== null).map((d) => (
                <g key={d.id}>
                  <circle
                    cx={d.x * w}
                    cy={d.y * h}
                    r={r * 1.6}
                    className="fill-amber-400/70 stroke-amber-700"
                    onClick={(e) => {
                      if (mode !== "calibrate") return;
                      e.stopPropagation();
                      setCalib((c) => ({ ...c, length: String(Math.round(d.feet * 1000) / 1000), unit: "ft", label: d.raw }));
                    }}
                  >
                    <title>{d.raw}</title>
                  </circle>
                </g>
              ))}
              {calib.a && <circle cx={calib.a.x} cy={calib.a.y} r={r} className="fill-sky-500" />}
              {calib.a && calib.b && <line x1={calib.a.x} y1={calib.a.y} x2={calib.b.x} y2={calib.b.y} strokeWidth={r / 1.5} className="stroke-sky-500" />}
              {points.length > 0 && (
                mode === "area" ? (
                  <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} strokeWidth={r / 1.5} className="fill-emerald-500/25 stroke-emerald-600" />
                ) : (
                  <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} strokeWidth={r / 1.5} fill="none" className="stroke-emerald-600" />
                )
              )}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={r} className="fill-emerald-600" />
              ))}
            </svg>
          </div>
        </div>

        <div className="p-3 border-t border-border flex flex-wrap items-center gap-3 text-sm">
          {!fpp ? (
            <span className="text-amber-700 dark:text-amber-400">{t("app.planRead.measure.noScale", "Set the scale first — this sheet states none.")}</span>
          ) : (
            <span className="text-muted-foreground">{t("app.planRead.measure.scale", "Scale: {source}", { source: scaleSource })}</span>
          )}
          {mode !== "calibrate" && result?.ok && (
            <strong className="text-base">
              {mode === "area" ? `${fmt(result.areaSqFt, 0)} sq ft` : `${fmt(result.lengthFt, 1)} ft`}
            </strong>
          )}
          {mode !== "calibrate" && (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="min-h-[40px] rounded-md border border-border bg-background px-2 max-w-[60vw]" aria-label={t("app.planRead.measure.useFor", "Use for")}>
                <option value="">{t("app.planRead.measure.pick", "Use for…")}</option>
                {choices.map((s) => (
                  <option key={s.id} value={s.id}>{s.areaName ? `${s.areaName} — ${s.label}` : s.label}</option>
                ))}
              </select>
              <button type="button" disabled={!canUse} onClick={use} className="min-h-[40px] px-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
                {t("app.planRead.measure.apply", "Use this measurement")}
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
