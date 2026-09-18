// app/components/quotes/builder/MeasureZoomControls.js
//
// − / + and "re-centre on the address" for a satellite still, shared by the
// roof, paving and landscaping measure panels.
//
// The owner's complaint that produced this: "zoom out a bit so we can see
// all the property — the roof doesn't have all the edges; I cannot see the
// edge of the property". The defaults moved (lib/measure/imageScale.js
// DEFAULT_ZOOM / DEFAULT_ROOF_ZOOM), and these buttons let the estimator
// move further either way within MIN_ZOOM..MAX_ZOOM — out to see the lot,
// in to trace a path. The panel that renders this re-projects its drawing
// through lat/lng on every step (reprojectDrawing), which is why the buttons
// can exist at all: a zoom that dropped the outline would be a control that
// destroys work while looking cosmetic.
//
// Each tap is one more billed still (the route says so beside its cache
// header), which is the reason the current zoom and the frame's width in
// feet are printed: an estimator who can see "443 ft across" does not tap
// − three times to find out.
//
// "Re-centre" puts the still back on the address at the panel's default
// zoom. There is no panning on these stills — every frame is centred on the
// geocoded address — so "re-centre" is the way back from a zoom the
// estimator regrets, not a pan reset, and it is labelled with the address
// so it does not read as one.
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/measure/imageScale";

/**
 * @param {object}   p
 * @param {number}   p.zoom             the still's current zoom
 * @param {Function} p.onZoom           (zoom) → void — already clamped to MIN..MAX here
 * @param {Function} [p.onRecentre]     () → void
 * @param {number}   [p.groundWidthFeet] what the frame covers, from imageScale()
 * @param {boolean}  [p.busy]
 * @param {string}   [p.note]           e.g. "Zoomed out to fit the roof"
 * @param {number}   [p.minZoom]
 * @param {number}   [p.maxZoom]
 */
export default function MeasureZoomControls({
  zoom,
  onZoom,
  onRecentre = null,
  groundWidthFeet = null,
  busy = false,
  note = "",
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
}) {
  const { t } = useTranslation();
  const z = Number(zoom);
  const canOut = Number.isFinite(z) && z > minZoom;
  const canIn = Number.isFinite(z) && z < maxZoom;
  const btn =
    "h-7 w-7 rounded border border-border text-sm leading-none hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onZoom?.(z - 1)}
          disabled={busy || !canOut}
          aria-label={t("app.measure.zoomOut", "Zoom out")}
          title={t("app.measure.zoomOut", "Zoom out")}
          className={btn}
        >
          −
        </button>
        <span className="min-w-[4.5rem] text-center tabular-nums">
          {Number.isFinite(z) ? t("app.measure.zoomLevel", "Zoom {zoom}", { zoom: z }) : ""}
        </span>
        <button
          type="button"
          onClick={() => onZoom?.(z + 1)}
          disabled={busy || !canIn}
          aria-label={t("app.measure.zoomIn", "Zoom in")}
          title={t("app.measure.zoomIn", "Zoom in")}
          className={btn}
        >
          +
        </button>
      </div>
      {Number.isFinite(Number(groundWidthFeet)) && Number(groundWidthFeet) > 0 && (
        <span className="tabular-nums">
          {t("app.measure.frameAcross", "{feet} ft across", { feet: Math.round(Number(groundWidthFeet)) })}
        </span>
      )}
      {onRecentre && (
        <button
          type="button"
          onClick={() => onRecentre()}
          disabled={busy}
          className="underline disabled:opacity-40"
        >
          {t("app.measure.recentre", "Re-centre on the address")}
        </button>
      )}
      {note && <span className="text-foreground">{note}</span>}
    </div>
  );
}
