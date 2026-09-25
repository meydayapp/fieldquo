// app/components/quotes/builder/AreaGeometry.js
//
// The measuring half of the painting room card — Room (4 walls) / Surface
// (single wall), the name and dimension boxes, and the "Calculated from
// measurements" strip the estimator can type over — lifted out of
// PaintAreas.js's AreaCard so the trades that REUSE the room takeoff
// (RoomMeasure.js: flooring, tile, drywall, siding walls) measure a room with
// the very same controls rather than a copy of them.
//
// ── Why lifted, not copied ─────────────────────────────────────────────────
//
// The owner (2026-09-25): flooring, tile and drywall "could use the room
// takeoff… that measures the surface area and floor (ceiling)". A second set
// of W × L × H boxes beside the paint one is the copy that rots (AGENTS.md
// failure class 4): the day paint's strip learns a new override, the flooring
// copy would silently not. So the JSX moved here verbatim and AreaCard renders
// it; the painting card's HTML was md5'd before and after the move and is
// byte-identical (docs/ROADMAP.md, 2026-09-25).
//
// The arithmetic is not here either — areaGeometry / derivedGeometry /
// PAINT_GEOMETRY_OVERRIDES in lib/pricing/paintTakeoff.js, which every caller
// passes in or this file imports. Presentational: every edit goes back through
// `set(patch)`.
"use client";

import {
  PAINT_GEOMETRY_OVERRIDES,
  isGeometryOverride,
} from "@/lib/pricing/paintTakeoff";
import { Field, Num, inputClass } from "./fields";

const smallInput =
  "w-full border border-border rounded px-2 py-1 text-sm tabular-nums bg-background";

/** The four strip figures, in the painting card's order. */
export function defaultStripFields(t) {
  return [
    ["linearFt", t("app.paint.geoLinear", "Linear ft")],
    ["wallSqft", t("app.paint.geoWalls", "Walls sqft")],
    ["ceilingSqft", t("app.paint.geoCeiling", "Ceiling sqft")],
    ["floorSqft", t("app.paint.geoFloor", "Floor sqft")],
  ];
}

/** Room (4 walls) · Surface (single wall). */
export function MeasurementStyleToggle({ closed, set, t }) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
      {[
        ["area", t("app.paint.room", "Room (4 walls)")],
        ["wall", t("app.paint.singleWall", "Surface (single wall)")],
      ].map(([key, label]) => {
        const on = key === "area" ? closed : !closed;
        return (
          <button
            key={key}
            type="button"
            onClick={() => set({ measurement: key })}
            aria-pressed={on}
            className={`px-3 py-1 ${on ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Name, then W × L × H for a room, run × height for a single wall, or the
 * legacy measured area + linear feet. `children` land at the end of the same
 * grid row (RoomMeasure puts the gable rise there for a siding wall).
 */
export function AreaDimensionFields({ area, index, style, closed, set, t, children = null }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <Field label={t("app.paint.name", "Name")}>
        <input
          value={area.label || ""}
          onChange={(e) => set({ label: e.target.value })}
          placeholder={t("app.paint.areaPlaceholder", "Area {n}", { n: index + 1 })}
          className={inputClass}
        />
      </Field>
      {closed ? (
        <>
          <Field label={t("app.paint.widthFt", "Width (ft)")}>
            <Num value={area.widthFt} onChange={(v) => set({ widthFt: v })} step={0.5} />
          </Field>
          <Field label={t("app.paint.lengthFt", "Length (ft)")}>
            <Num value={area.lengthFt} onChange={(v) => set({ lengthFt: v })} step={0.5} />
          </Field>
          <Field label={t("app.paint.heightFt", "Height (ft)")}>
            <Num value={area.heightFt} onChange={(v) => set({ heightFt: v })} step={0.5} />
          </Field>
        </>
      ) : style === "surface" ? (
        <>
          <Field label={t("app.paint.surfaceSqft", "Measured area (sqft)")}>
            <Num value={area.surfaceSqft} onChange={(v) => set({ surfaceSqft: v })} step={1} />
          </Field>
          <Field label={t("app.paint.linearFt", "Linear feet")}>
            <Num value={area.linearFt} onChange={(v) => set({ linearFt: v })} step={0.5} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("app.paint.wallRunFt", "Width of the wall (ft)")}>
            <Num value={area.linearFt} onChange={(v) => set({ linearFt: v })} step={0.5} />
          </Field>
          <Field label={t("app.paint.heightFt", "Height (ft)")}>
            <Num value={area.heightFt} onChange={(v) => set({ heightFt: v })} step={0.5} />
          </Field>
        </>
      )}
      {children}
    </div>
  );
}

/**
 * "Calculated from measurements — type over any figure". `geo` is the area's
 * geometry WITH overrides (areaGeometry), `calc` without (derivedGeometry);
 * `fields` narrows the strip to the figures a trade reads (a floor trade has
 * no use for a ceiling); `hint` is the sentence under it, which differs
 * because painting prices gross wall area and drywall does not.
 */
export function GeometryStrip({ area, geo, calc, closed, set, t, fields = null, hint }) {
  const strip = fields || defaultStripFields(t);
  const overridden = Object.keys(PAINT_GEOMETRY_OVERRIDES).some((f) =>
    isGeometryOverride(area[PAINT_GEOMETRY_OVERRIDES[f]]),
  );
  return (
    <div className="rounded bg-accent px-3 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.paint.calculated", "Calculated from measurements")}
        </span>
        <span className="text-muted-foreground">
          {t("app.paint.overrideHint", "Type over any figure to override it")}
          {overridden && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() =>
                  set(
                    Object.fromEntries(
                      Object.values(PAINT_GEOMETRY_OVERRIDES).map((k) => [k, null]),
                    ),
                  )
                }
                className="underline"
              >
                {t("app.paint.reset", "reset")}
              </button>
            </>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
        {strip.map(([field, label]) => {
          const key = PAINT_GEOMETRY_OVERRIDES[field];
          const edited = isGeometryOverride(area[key]);
          const unsupported = !closed && (field === "ceilingSqft" || field === "floorSqft");
          return (
            <div key={field}>
              <div className="text-muted-foreground">{label}</div>
              {unsupported ? (
                <div
                  className="font-medium text-muted-foreground"
                  title={t("app.paint.noCeilingOnWall", "A single wall has no ceiling or floor.")}
                >
                  —
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={edited ? area[key] : geo[field]}
                    onChange={(e) => set({ [key]: e.target.value === "" ? null : Number(e.target.value) })}
                    className={`${smallInput} ${edited ? "border-blue-600 pr-14" : ""}`}
                  />
                  {edited && (
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-700 dark:text-blue-300"
                      title={t("app.paint.calculatedWas", "Calculated: {n}", { n: calc[field] })}
                    >
                      {t("app.paint.edited", "edited")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-1.5">{hint}</p>
    </div>
  );
}
