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
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  LOT_AREA_FIELD,
  LOT_EDGE_FIELD,
  lotIntakePatch,
} from "@/lib/measure/lotTakeoff";
import PolygonMeasure, { blankDrawing, usePolygonMeasure } from "./PolygonMeasure";

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
 */
export default function LotAreaMeasure({
  intakeValues = {},
  fields = [],
  onIntakeChange,
  imageUrl = "",
  imageScale = null,
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
  const { totals, fpp } = measure;

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
