// app/components/quotes/builder/LotAreaMeasure.js
//
// Trace the lawn, fill in Lot Size.
//
// The landscaping trades (lib/measure/lotTakeoff.js lists them) price by line
// item and ask their questions through the intake form: "Lot Size (sqft)",
// and for the two that lay edging, "Edging (linear ft)". Until this screen an
// estimator typed those from a lot plan, a pace-out or a guess. Now the same
// aerial still the paver designer draws on is offered here, on the same
// canvas (PolygonMeasure.js), and the traced area and outline are written
// into the same two intake boxes the estimator would have typed into — which
// sit directly below, still editable, so a number measured on site can
// overrule a number traced from the sky.
//
// This is the landscaping LAYER on the shared canvas, the way PaverDesigner
// is the paving layer: one surface to trace, and an emit into intake fields
// instead of a takeoff. Nothing in here measures; lib/measure/imageScale.js
// does, and lib/measure/lotTakeoff.js decides which fields get the answer.
//
// The drawing is kept on the group under `intakeValues.lotDrawing`, the way
// the paver drawing lives in `takeoff.paverDesign`: the intake JSON is already
// a column that round-trips verbatim, so reopening the quote restores the
// outline rather than a flat number nobody can recount. No schema change.
//
// ── What the CLIENT sees of it ─────────────────────────────────────────────
//
// The drawing is in viewBox units and means nothing off this canvas. So the
// traced outline is ALSO written onto the group's takeoff as lat/lng
// vertices (`takeoff.lawn`, through canvasShapeToLatLng — the still's
// centre and zoom are known, so the inverse projection is exact), and the
// save route draws those vertices on a fresh satellite still, captures it,
// and the quote the client receives prints it with "Lawn measured: 1,850 sq
// ft" (lib/measure/measureImages.js). The vertices also let the server
// recompute the area from the outline itself, the way it does for the
// public polygon — the canvas figure is what the group was priced on and is
// what prints; the recompute sits beside it as a check.
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  LOT_AREA_FIELD,
  LOT_EDGE_FIELD,
  lotIntakePatch,
} from "@/lib/measure/lotTakeoff";
import { canvasShapeToLatLng } from "@/lib/measure/imageScale";
import PolygonMeasure, { blankDrawing, usePolygonMeasure, VIEW_W, VIEW_H } from "./PolygonMeasure";

// One layer. Lawn, bed and yard are all "the area being worked", and offering
// a choice between them would invent a distinction no intake field records.
const LAYERS = [
  {
    key: "lawn",
    label: "Lawn / yard area",
    labelKey: "app.lawn.surfaceArea",
    stroke: "#15803d",
    fill: "rgba(34,197,94,0.28)",
  },
];

/** Where the drawing lives on the group's intake JSON. */
export const LOT_DRAWING_KEY = "lotDrawing";

const numOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {object}   p.intakeValues   the group's intake answers
 * @param {Array}    p.fields         the category's intake field list — which
 *                                    of the two boxes exist decides what is
 *                                    written (lotIntakePatch)
 * @param {Function} p.onIntakeChange (patch) → merges into intakeValues
 * @param {string}   p.imageUrl
 * @param {object}   [p.imageScale]
 * @param {{lat:number,lng:number}} [p.siteLocation]  the still's centre — with
 *                                    it, the outline is written to the takeoff
 *                                    in lat/lng for the document
 * @param {string}   [p.siteAddress]
 * @param {Function} [p.onTakeoffChange] (patch) → merges into the group's takeoff
 */
export default function LotAreaMeasure({
  intakeValues = {},
  fields = [],
  onIntakeChange,
  imageUrl = "",
  imageScale = null,
  siteLocation = null,
  siteAddress = "",
  onTakeoffChange,
}) {
  const { t } = useTranslation();

  const stored = intakeValues?.[LOT_DRAWING_KEY];
  const doc = useMemo(
    () => ({ ...blankDrawing(), ...(stored && typeof stored === "object" ? stored : {}) }),
    [stored],
  );

  // One update path, same signature as the paver designer's: a partial
  // drawing, or a function of the current drawing returning one.
  const update = useCallback(
    (patch) => {
      const next = {
        ...doc,
        ...(typeof patch === "function" ? patch(doc) : patch),
      };
      onIntakeChange?.({ [LOT_DRAWING_KEY]: next });
    },
    [doc, onIntakeChange],
  );

  const measure = usePolygonMeasure({ doc, imageUrl, imageScale, layers: LAYERS });
  const { totals, fpp, natural, scaleSource } = measure;

  const hasEdgeField = fields.some((f) => f?.key === LOT_EDGE_FIELD);
  const hasAreaField = fields.some((f) => f?.key === LOT_AREA_FIELD);

  /* ── Emit into the intake ──────────────────────────────────────────── */

  // Whole square feet and tenths of a foot — lotIntakePatch rounds, and only
  // writes the fields this trade's form has. Seeded with the empty result so
  // mounting an untouched canvas never zeroes a lot size somebody typed; once
  // a shape is closed the drawing owns those boxes, including on the way back
  // down to zero when the last shape is removed.
  const emitted = useMemo(() => lotIntakePatch(totals, fields), [totals, fields]);
  const lastEmit = useRef(JSON.stringify(lotIntakePatch({ areaSqFt: 0, perimeterFt: 0 }, fields)));

  useEffect(() => {
    const key = JSON.stringify(emitted);
    if (key === lastEmit.current) return;
    lastEmit.current = key;
    if (Object.keys(emitted).length) onIntakeChange?.(emitted);
  }, [emitted, onIntakeChange]);

  /* ── Emit the outline onto the takeoff, for the document ────────────── */

  // Only with a satellite still whose centre and zoom are known (the
  // automatic scale): a drawing over a manual reference line has no
  // coordinates to give. The largest closed shape is the lawn; the canvas
  // area is the figure the group is priced on and is what is written.
  const lawnTakeoff = useMemo(() => {
    if (!onTakeoffChange) return undefined;
    const closed = (measure.measured || []).filter((x) => x?.m?.ok && Array.isArray(x.shape?.points) && x.shape.points.length >= 3);
    if (!closed.length || !fpp) return null;
    if (scaleSource !== "auto" || !siteLocation || !imageScale) return null;
    const largest = closed.sort((a, b) => (b.m.areaSqFt || 0) - (a.m.areaSqFt || 0))[0];
    const vertices = canvasShapeToLatLng(largest.shape.points, {
      center: siteLocation,
      scaleInfo: imageScale,
      naturalWidth: natural?.width,
      naturalHeight: natural?.height,
      viewWidth: VIEW_W,
      viewHeight: VIEW_H,
    });
    if (!vertices) return null;
    return {
      areaSqft: Math.round(totals.areaSqFt),
      perimeterFt: Math.round(totals.perimeterFt * 10) / 10,
      source: "traced_builder",
      basis: "traced",
      estimated: false,
      vertices: vertices.map((v) => ({ lat: Math.round(v.lat * 1e7) / 1e7, lng: Math.round(v.lng * 1e7) / 1e7 })),
      address: siteAddress || "",
    };
  }, [fpp, scaleSource, siteLocation, imageScale, natural, totals, measure.measured, siteAddress, onTakeoffChange]);

  const lastTakeoff = useRef(undefined);
  useEffect(() => {
    if (lawnTakeoff === undefined) return;
    const key = JSON.stringify(lawnTakeoff);
    if (key === lastTakeoff.current) return;
    // First render with nothing drawn writes nothing: a group whose takeoff
    // was never touched must not gain `{ lawn: null }` on the way past.
    if (lastTakeoff.current === undefined && lawnTakeoff === null) {
      lastTakeoff.current = key;
      return;
    }
    lastTakeoff.current = key;
    onTakeoffChange?.({ lawn: lawnTakeoff, measureImage: null });
  }, [lawnTakeoff, onTakeoffChange]);

  // A form with no box for the area cannot be filled from here. Not rendering
  // is the honest answer — a canvas whose numbers go nowhere is the dead
  // control AGENTS.md is about — and lotTakeoff's list is checked against the
  // field definitions so this branch is never reached in practice.
  if (!hasAreaField) return null;

  const any = numOf(emitted[LOT_AREA_FIELD]) > 0;

  return (
    <div className="space-y-3">
      <PolygonMeasure
        doc={doc}
        update={update}
        layers={LAYERS}
        measure={measure}
        imageUrl={imageUrl}
        ariaLabel={t("app.lawn.canvasAria")}
        heading={
          <div>
            <h3 className="text-sm font-medium">{t("app.lawn.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {hasEdgeField ? t("app.lawn.introAreaEdge") : t("app.lawn.introArea")}
            </p>
          </div>
        }
      />

      <div className="rounded-lg border border-border p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">{t("app.lawn.areaLabel")}</div>
            <div className="text-lg font-medium tabular-nums">
              {fpp ? (
                <>
                  {Math.round(totals.areaSqFt)}{" "}
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
          <div>
            <div className="text-xs text-muted-foreground">{t("app.lawn.edgeLabel")}</div>
            <div className="text-lg font-medium tabular-nums">
              {fpp ? (
                <>
                  {totals.perimeterFt.toFixed(1)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("app.paver.ftUnit")}
                  </span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">
                  {t("app.paver.scaleNotSetShort")}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {any
            ? hasEdgeField
              ? t("app.lawn.totalsAreaEdge", {
                  sqft: Math.round(totals.areaSqFt),
                  edge: totals.perimeterFt.toFixed(1),
                })
              : t("app.lawn.totalsArea", {
                  sqft: Math.round(totals.areaSqFt),
                  edge: totals.perimeterFt.toFixed(1),
                })
            : t("app.lawn.nothingMeasured")}
        </p>
      </div>
    </div>
  );
}
