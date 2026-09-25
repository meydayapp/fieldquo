// app/components/quotes/builder/ReuseTakeoff.js
//
// The measuring panels for the trades with no calculator of their own —
// flooring, tile and drywall (rooms), siding (walls), fencing and concrete
// (the aerial tracer). lib/measure/reuseTakeoffs.js holds every rule and
// every number; this file draws them and reports edits back.
//
// ── What these panels do NOT do ────────────────────────────────────────────
//
// They price nothing. The figures they produce fill the quantities of the
// service's template lines ("Add with its template lines", lib/quotes/
// serviceTemplateLines.js) — the owner's rule that the calculator produces
// the quantity and the template line supplies the price. So there is no
// total on these cards: a dollar figure here would be a number the quote
// does not contain. Each card says where its figures go instead.
//
// ── Same controls as the painting room ─────────────────────────────────────
//
// A room is measured with AreaGeometry.js — the very component the painting
// room card renders (Room / Surface toggle, W × L × H, the strip the
// estimator types over), fed by paint's areaGeometry — so a flooring room
// and a painted room measure identically and cannot drift apart.
//
// Staff-only, like every takeoff: nothing here reaches a client surface; the
// group's `takeoff` JSON is never returned by the public quote routes.
"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { areaGeometry, derivedGeometry } from "@/lib/pricing/paintTakeoff";
import {
  ROOM_MEASURE_TRADES,
  ROOM_MEASURE_MODEL,
  DRYWALL_SHEETS,
  newRoomMeasure,
  newMeasureRoom,
  newSidingWall,
  newOpening,
  roomFigures,
  roomMeasureFigures,
  sidingWallsFigures,
  statedWaste,
} from "@/lib/measure/reuseTakeoffs";
import { Field, Num, inputClass, asList } from "./fields";
import { MeasurementStyleToggle, AreaDimensionFields, GeometryStrip } from "./AreaGeometry";

const fmt = (n, language) => Number(n || 0).toLocaleString(language || "en", { maximumFractionDigits: 2 });

const SURFACE_KEY = { floor: "floorSqft", walls: "wallSqft", ceiling: "ceilingSqft", perimeter: "linearFt" };

/** The words for a surface tick, per trade — a tiler's walls are tile, a hanger's are board. */
function surfaceLabel(t, trade, surface) {
  const words = {
    flooring_install: {
      floor: t("app.reuseTakeoff.surf_floor", "Floor"),
      perimeter: t("app.reuseTakeoff.surf_baseboard", "Baseboard & transitions (perimeter)"),
      walls: t("app.reuseTakeoff.surf_wallTile", "Wall tile / backsplash"),
    },
    tiling: {
      floor: t("app.reuseTakeoff.surf_floorTile", "Floor tile"),
      walls: t("app.reuseTakeoff.surf_wallTile", "Wall tile / backsplash"),
      perimeter: t("app.reuseTakeoff.surf_trim", "Trim / bullnose (perimeter)"),
    },
    drywall_install: {
      walls: t("app.reuseTakeoff.surf_walls", "Walls"),
      ceiling: t("app.reuseTakeoff.surf_ceiling", "Ceiling"),
    },
  };
  return words[trade]?.[surface] || surface;
}

function figureLabel(t, key) {
  const words = {
    floorSqft: t("app.reuseTakeoff.fig_floor", "Floor"),
    wallSqft: t("app.reuseTakeoff.fig_walls", "Walls (net of openings)"),
    ceilingSqft: t("app.reuseTakeoff.fig_ceiling", "Ceiling"),
    linearFt: t("app.reuseTakeoff.fig_perimeter", "Perimeter"),
  };
  return words[key] || key;
}

const unitOf = (t, key) => (key === "linearFt" ? t("app.paver.ftUnit", "ft") : t("app.paver.sqftUnit", "sq ft"));

/** A waste box: blank means "the template line's own", 0 is a statement. */
function WasteInput({ value, onChange, t, label }) {
  const stated = statedWaste(value);
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>{label || t("app.reuseTakeoff.waste", "Waste")}</span>
      <input
        type="number"
        min={0}
        max={50}
        step={1}
        value={stated === null ? "" : stated}
        placeholder={t("app.reuseTakeoff.wasteTemplate", "template")}
        onChange={(e) => onChange(e.target.value === "" ? null : statedWaste(e.target.value))}
        className="w-16 border border-border rounded px-1.5 py-0.5 text-sm tabular-nums bg-background text-right"
      />
      <span>%</span>
    </label>
  );
}

/* ── Openings ──────────────────────────────────────────────────────────── */

function Openings({ room, set, t, language }) {
  const rows = asList(room.openings);
  const setRow = (i, patch) => set({ openings: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const kinds = [
    ["door", t("app.reuseTakeoff.door", "Door")],
    ["window", t("app.reuseTakeoff.window", "Window")],
    ["other", t("app.reuseTakeoff.otherOpening", "Other opening")],
  ];
  const total = roomFigures(room, { surfaces: { walls: true } }).openingsSqft;
  return (
    <div className="space-y-1.5" data-reuse-openings>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.reuseTakeoff.openings", "Openings — taken off the walls")}
        </span>
        {total > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            −{fmt(total, language)} {t("app.paver.sqftUnit", "sq ft")}
          </span>
        )}
      </div>
      {rows.map((o, i) => (
        <div key={i} className="grid grid-cols-[1fr_4rem_4.5rem_4.5rem_auto] gap-1.5 items-end">
          <Field label={t("app.reuseTakeoff.openingKind", "Opening")}>
            <select value={o?.kind || "door"} onChange={(e) => setRow(i, { kind: e.target.value })} className={inputClass}>
              {kinds.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("app.reuseTakeoff.count", "Count")}>
            <Num value={o?.count} onChange={(v) => setRow(i, { count: v })} />
          </Field>
          <Field label={t("app.reuseTakeoff.widthFt", "W (ft)")}>
            <Num value={o?.widthFt} onChange={(v) => setRow(i, { widthFt: v })} step={0.5} />
          </Field>
          <Field label={t("app.reuseTakeoff.heightFt", "H (ft)")}>
            <Num value={o?.heightFt} onChange={(v) => setRow(i, { heightFt: v })} step={0.5} />
          </Field>
          <button
            type="button"
            onClick={() => set({ openings: rows.filter((_, j) => j !== i) })}
            className="p-1.5 mb-0.5 text-muted-foreground hover:text-red-600"
            aria-label={t("app.reuseTakeoff.removeOpening", "Remove opening")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-3">
        <button type="button" onClick={() => set({ openings: [...rows, newOpening("door")] })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus size={12} /> {t("app.reuseTakeoff.addDoor", "Door")}
        </button>
        <button type="button" onClick={() => set({ openings: [...rows, newOpening("window")] })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus size={12} /> {t("app.reuseTakeoff.addWindow", "Window")}
        </button>
        <button type="button" onClick={() => set({ openings: [...rows, newOpening("other")] })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus size={12} /> {t("app.reuseTakeoff.addOther", "Other")}
        </button>
      </div>
    </div>
  );
}

/* ── One room / one wall ───────────────────────────────────────────────── */

function MeasureRoomCard({ room, index, surfaces, trade, gable = false, t, language, onChange, onRemove }) {
  const set = (patch) => onChange({ ...room, ...patch });
  const style = room.measurement === "wall" ? "wall" : "area";
  const closed = style === "area";
  const ticks = room.surfaces && typeof room.surfaces === "object" ? room.surfaces : {};
  const ticked = Object.fromEntries(surfaces.map((s) => [s, ticks[s] === true]));
  const figures = roomFigures(room, { surfaces: ticked });
  // The strip shows the figures this trade reads — a floor trade has no use
  // for a ceiling — in the painting card's order.
  const keys = surfaces.map((s) => SURFACE_KEY[s]);
  const stripFields = [
    ["linearFt", t("app.paint.geoLinear", "Linear ft")],
    ["wallSqft", t("app.paint.geoWalls", "Walls sqft")],
    ["ceilingSqft", t("app.paint.geoCeiling", "Ceiling sqft")],
    ["floorSqft", t("app.paint.geoFloor", "Floor sqft")],
  ].filter(([k]) => keys.includes(k));
  const net = keys.filter((k) => figures[k] > 0).map((k) => `${figureLabel(t, k)} ${fmt(figures[k], language)} ${unitOf(t, k)}`);

  return (
    <div className="rounded-lg border border-border p-3 space-y-3" data-reuse-room={index}>
      <div className="flex items-center gap-2 flex-wrap">
        <MeasurementStyleToggle closed={closed} set={set} t={t} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{net.join(" · ")}</span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1.5 text-muted-foreground hover:text-red-600"
          aria-label={t("app.reuseTakeoff.removeRoom", "Remove")}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <AreaDimensionFields area={room} index={index} style={style} closed={closed} set={set} t={t}>
        {gable && !closed && (
          <Field label={t("app.reuseTakeoff.gableRise", "Gable rise (ft)")}>
            <Num value={room.gableRiseFt} onChange={(v) => set({ gableRiseFt: v })} step={0.5} />
          </Field>
        )}
      </AreaDimensionFields>

      {surfaces.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {surfaces.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={ticked[s]}
                onChange={(e) => set({ surfaces: { ...ticks, [s]: e.target.checked } })}
              />
              <span className={ticked[s] ? "text-foreground" : "text-muted-foreground"}>{surfaceLabel(t, trade, s)}</span>
            </label>
          ))}
        </div>
      )}

      <GeometryStrip
        area={room}
        geo={areaGeometry(room)}
        calc={derivedGeometry(room)}
        closed={closed}
        set={set}
        t={t}
        fields={stripFields}
        hint={t(
          "app.reuseTakeoff.stripHint",
          "Gross figures from the dimensions. The ticked surfaces are what this room measures; openings listed below come off the walls.",
        )}
      />

      {(ticked.walls || surfaces.length === 1) && <Openings room={room} set={set} t={t} language={language} />}
      {gable && figures.gableSqft > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("app.reuseTakeoff.gableAdded", "Gable: +{n} sq ft (half the run × the rise).", { n: fmt(figures.gableSqft, language) })}
        </p>
      )}
    </div>
  );
}

/* ── Flooring, tile, drywall ───────────────────────────────────────────── */

/**
 * @param trade     flooring_install | tiling | drywall_install
 * @param takeoff   the group's takeoff, or null before the first room
 * @param onChange  (nextTakeoff) — the whole takeoff, replaced
 */
export function RoomMeasure({ trade, takeoff, onChange }) {
  const { t, language } = useTranslation();
  const cfg = ROOM_MEASURE_TRADES[trade];
  const current = takeoff && typeof takeoff === "object" && takeoff.model === ROOM_MEASURE_MODEL ? takeoff : null;
  const figures = useMemo(() => (current ? roomMeasureFigures(current, trade) : null), [current, trade]);
  if (!cfg) return null;

  // The first press writes the whole blank takeoff — merged over whatever the
  // group already carries, so nothing else on it is dropped.
  const start = () => onChange({ ...(takeoff && typeof takeoff === "object" ? takeoff : {}), ...newRoomMeasure(trade) });
  const rooms = asList(current?.rooms);
  const setTakeoff = (patch) => onChange({ ...current, ...patch });
  const setRoom = (i, next) => setTakeoff({ rooms: rooms.map((r, j) => (j === i ? next : r)) });
  const waste = current?.waste && typeof current.waste === "object" ? current.waste : {};

  const heading = (
    <div>
      <h3 className="text-sm font-medium">{t("app.reuseTakeoff.roomsTitle", "Measure the rooms")}</h3>
      <p className="text-xs text-muted-foreground">
        {t(
          "app.reuseTakeoff.roomsIntro",
          "The figures fill this service's template lines — use \"Add with its template lines\" in the line items below. Nothing here is priced on its own.",
        )}
      </p>
    </div>
  );

  if (!current) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 space-y-2" data-reuse-takeoff={trade}>
        {heading}
        <button type="button" onClick={start} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus size={14} /> {t("app.reuseTakeoff.addRoom", "Add a room")}
        </button>
      </div>
    );
  }

  const figureKeys = cfg.surfaces.map((s) => SURFACE_KEY[s]);
  return (
    <div className="rounded-lg border border-border p-3 space-y-3" data-reuse-takeoff={trade}>
      {heading}
      {rooms.map((room, i) => (
        <MeasureRoomCard
          key={i}
          room={room && typeof room === "object" ? room : {}}
          index={i}
          surfaces={cfg.surfaces}
          trade={trade}
          t={t}
          language={language}
          onChange={(next) => setRoom(i, next)}
          onRemove={() => setTakeoff({ rooms: rooms.filter((_, j) => j !== i) })}
        />
      ))}
      <button
        type="button"
        onClick={() => setTakeoff({ rooms: [...rooms, newMeasureRoom(trade)] })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus size={14} /> {t("app.reuseTakeoff.addRoom", "Add a room")}
      </button>

      {/* ── What the template lines will read ── */}
      <div className="rounded-lg bg-accent px-3 py-2 space-y-1.5 text-sm" data-reuse-figures>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.reuseTakeoff.figuresTitle", "For the template lines")}
        </div>
        {figureKeys.map((key) => {
          const value = figures?.[key] || 0;
          const w = Object.hasOwn(waste, key) ? statedWaste(waste[key]) : null;
          const hasWaste = cfg.waste.includes(key);
          return (
            <div key={key} className="flex items-center justify-between gap-3 flex-wrap" data-reuse-figure={key}>
              <span>
                {figureLabel(t, key)}{" "}
                <span className="font-medium tabular-nums">
                  {fmt(value, language)} {unitOf(t, key)}
                </span>
                {key === "wallSqft" && figures?.openingsSqft > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    {t("app.reuseTakeoff.lessOpenings", "(less {n} sq ft of openings)", { n: fmt(figures.openingsSqft, language) })}
                  </span>
                )}
              </span>
              {hasWaste && (
                <span className="flex items-center gap-2">
                  <WasteInput t={t} value={w} onChange={(v) => setTakeoff({ waste: { ...waste, [key]: v } })} />
                  {w !== null && value > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("app.reuseTakeoff.toOrder", "order {n}", { n: fmt(Math.round(value * (1 + w / 100) * 100) / 100, language) })}
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })}

        {cfg.sheets && figures?.sheets && (
          <div className="border-t border-border pt-1.5 space-y-1.5" data-reuse-sheets>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{t("app.reuseTakeoff.sheetSize", "Sheet")}</span>
                <select
                  value={figures.sheets.sheetSqft}
                  onChange={(e) => setTakeoff({ sheetSqft: Number(e.target.value) })}
                  className="border border-border rounded px-1.5 py-0.5 text-sm bg-background"
                >
                  {Object.entries(DRYWALL_SHEETS).map(([sqft, label]) => (
                    <option key={sqft} value={sqft}>
                      {label} ({sqft} {t("app.paver.sqftUnit", "sq ft")})
                    </option>
                  ))}
                </select>
              </label>
              <WasteInput
                t={t}
                label={t("app.reuseTakeoff.sheetWaste", "Sheet waste")}
                value={figures.sheets.wastePct}
                onChange={(v) => setTakeoff({ sheetWastePct: v })}
              />
            </div>
            <div>
              {t("app.reuseTakeoff.sheetsLine", "Board {board} sq ft → {count} sheets", {
                board: fmt(figures.sheets.boardSqft, language),
                count: figures.sheets.count,
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {cfg.sheets
            ? t(
                "app.reuseTakeoff.sheetsFoot",
                "The sheet count includes its waste, so a line priced per sheet (board, mud and tape) adds none on top. Lines priced per sq ft read the walls and ceiling as measured.",
              )
            : t(
                "app.reuseTakeoff.wasteFoot",
                "A waste typed here replaces the waste on the material lines that read that figure; left blank, each line keeps its template's own. Labour never takes waste.",
              )}
        </p>
      </div>
    </div>
  );
}

/* ── Siding walls — inside the siding takeoff ──────────────────────────── */

/**
 * Measure the walls being clad as elevations and fill the siding takeoff's
 * own Wall area box. Every edit writes the walls AND the box in one change,
 * the way the lawn tracer owns Lot Size once a shape exists: while walls are
 * listed, their net area is the box's value (typing over it holds until a
 * wall is next edited); removing the last wall zeroes it.
 */
export function SidingWalls({ takeoff, onChange }) {
  const { t, language } = useTranslation();
  const walls = asList(takeoff?.walls);
  const commit = (next) => {
    const f = sidingWallsFigures(next);
    onChange({ ...takeoff, walls: next, sqft: f ? Math.round(f.netSqft) : 0 });
  };
  const figures = sidingWallsFigures(walls);

  if (!walls.length) {
    return (
      <button
        type="button"
        onClick={() => commit([newSidingWall(t("app.reuseTakeoff.frontWall", "Front"))])}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        data-siding-walls="empty"
      >
        <Plus size={14} /> {t("app.reuseTakeoff.measureWalls", "Measure the walls (elevations, less openings)")}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3" data-siding-walls>
      <div>
        <h3 className="text-sm font-medium">{t("app.reuseTakeoff.wallsTitle", "Walls being clad")}</h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "app.reuseTakeoff.wallsIntro",
            "Each elevation is a wall run × its height, plus the gable; doors and windows come off. The net total fills Wall area above.",
          )}
        </p>
      </div>
      {walls.map((w, i) => (
        <MeasureRoomCard
          key={i}
          room={{ ...(w && typeof w === "object" ? w : {}), surfaces: { walls: true } }}
          index={i}
          surfaces={["walls"]}
          trade="siding"
          gable
          t={t}
          language={language}
          onChange={(next) => commit(walls.map((x, j) => (j === i ? next : x)))}
          onRemove={() => commit(walls.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        onClick={() => commit([...walls, newSidingWall("")])}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus size={14} /> {t("app.reuseTakeoff.addWall", "Add a wall")}
      </button>
      {figures && (
        <div className="rounded bg-accent px-3 py-2 text-sm tabular-nums" data-siding-net>
          {t("app.reuseTakeoff.wallsTotal", "{gross} sq ft of wall, less {openings} sq ft of openings = {net} sq ft to clad", {
            gross: fmt(figures.grossSqft, language),
            openings: fmt(figures.openingsSqft, language),
            net: fmt(figures.netSqft, language),
          })}
        </div>
      )}
    </div>
  );
}
