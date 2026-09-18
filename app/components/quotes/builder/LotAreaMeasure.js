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
// The still it is traced on is this panel's own (useSatelliteStill.js), from
// the address the estimator chose — the yard being landscaped is not always
// the address on the invoice — at the zoom they chose, and the takeoff
// stores both (`measureAddress`, `measureFrame`) so the drawing reopens on
// the same picture. A zoom change re-projects the outline through lat/lng
// (reprojectDrawing) rather than dropping it.
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  LOT_AREA_FIELD,
  LOT_EDGE_FIELD,
  lotIntakePatch,
} from "@/lib/measure/lotTakeoff";
import { canvasShapeToLatLng, reprojectDrawing, DEFAULT_ZOOM } from "@/lib/measure/imageScale";
import PolygonMeasure, { asShapes, blankDrawing, usePolygonMeasure, VIEW_W, VIEW_H } from "./PolygonMeasure";
import MeasureAddressField from "./MeasureAddressField";
import MeasureZoomControls from "./MeasureZoomControls";
import { useSatelliteStill, useFollowClientAddress, placementOf, LEGACY_LOT_ZOOM } from "./useSatelliteStill";

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
 * @param {object}   [p.takeoff]      the group's takeoff — carries the still's
 *                                    address and frame, and receives the
 *                                    outline in lat/lng for the document
 * @param {string}   [p.siteAddress]  the client's address, the default
 * @param {Function} [p.onTakeoffChange] (patch) → merges into the group's takeoff
 */
export default function LotAreaMeasure({
  intakeValues = {},
  fields = [],
  onIntakeChange,
  takeoff = null,
  siteAddress = "",
  onTakeoffChange,
}) {
  const { t } = useTranslation();

  const stored = intakeValues?.[LOT_DRAWING_KEY];
  const doc = useMemo(
    () => ({ ...blankDrawing(), ...(stored && typeof stored === "object" ? stored : {}) }),
    [stored],
  );

  /* ── The still ─────────────────────────────────────────────────────── */

  // A drawing with no stored frame predates frames and was traced at the
  // old default zoom — see LEGACY_LOT_ZOOM for why fetching it at today's
  // default would measure it sixteen times too small.
  const [address, setAddress] = useState(takeoff?.measureAddress || siteAddress || "");
  const still = useSatelliteStill({
    frame: takeoff?.measureFrame || null,
    address: takeoff?.measureAddress || siteAddress,
    auto: true,
    initialZoom: asShapes(stored?.shapes).length ? LEGACY_LOT_ZOOM : DEFAULT_ZOOM,
  });
  const imageUrl = still.still?.image?.url || "";
  const imageScale = still.still?.scale || null;
  const siteLocation = still.still?.location || null;
  const measuredAddress = still.still?.formattedAddress || takeoff?.measureAddress || "";

  // The frame on screen is the frame on the takeoff — after the first
  // automatic fetch; a measure or zoom writes it itself, beside the
  // re-projected drawing, and this is then a no-op. The latest takeoff is
  // read through a ref because the outline effect below writes the takeoff
  // too, and a frame written over a stale copy would drop it.
  const takeoffRef = useRef(takeoff);
  takeoffRef.current = takeoff;
  const frameKey = JSON.stringify(still.still?.frame || null);
  useEffect(() => {
    const cur = still.still;
    if (!cur?.frame || !onTakeoffChange) return;
    const t0 = takeoffRef.current || {};
    const sameFrame = JSON.stringify(t0.measureFrame || null) === frameKey;
    const addr = cur.formattedAddress || t0.measureAddress || "";
    if (sameFrame && (t0.measureAddress || "") === addr) return;
    onTakeoffChange({ measureFrame: cur.frame, measureAddress: addr });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

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

  // The outline follows the ground, not the picture: a new still (another
  // address, another zoom) gets the same outline re-projected through
  // lat/lng, never dropped. Written in one patch with the frame, so the
  // drawing and the picture it is on change together.
  function adoptStill(next, from) {
    const moved = from ? reprojectDrawing(doc, from, placementOf(next)) : null;
    if (moved) onIntakeChange?.({ [LOT_DRAWING_KEY]: moved });
    onTakeoffChange?.({ measureFrame: next.frame, measureAddress: next.formattedAddress || address });
  }
  async function measureAt(query) {
    const from = still.placement;
    const next = await still.measure(query, DEFAULT_ZOOM);
    if (next) adoptStill(next, from);
  }
  function zoomTo(z) {
    const moved = still.reframe(z);
    if (moved) adoptStill(moved.still, moved.from);
  }
  // A different client picked while the box still held the old one's address.
  useFollowClientAddress(siteAddress, address, (next) => {
    setAddress(next);
    measureAt(next);
  });
  const zoom = still.still?.frame?.zoom ?? null;

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
      address: measuredAddress || "",
    };
  }, [fpp, scaleSource, siteLocation, imageScale, natural, totals, measure.measured, measuredAddress, onTakeoffChange]);

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
      <MeasureAddressField
        value={address}
        onChange={setAddress}
        onMeasure={measureAt}
        defaultAddress={siteAddress}
        busy={still.busy}
        measuredAt={still.still?.formattedAddress || ""}
        error={still.error ? t("app.measure.unavailable", "Satellite imagery is unavailable for this address. Enter the numbers below.") : ""}
      />
      {zoom !== null && (
        <MeasureZoomControls
          zoom={zoom}
          onZoom={zoomTo}
          onRecentre={zoom !== DEFAULT_ZOOM ? () => zoomTo(DEFAULT_ZOOM) : null}
          groundWidthFeet={still.still?.scale?.groundWidthFeet}
          busy={still.busy}
        />
      )}
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
