// app/instant-quote/[companySlug]/RoomPicker.js
//
// Interior painting without a tape measure: the homeowner adds rooms by type,
// says whether each is small, medium or large and whether the ceiling is
// standard or high, and ticks what to paint. Nothing here is a price and
// nothing here is a measurement the server believes — the browser posts room
// KEYS (type, size, height, the paint ticks, a door count) and the server
// assumes the dimensions from the company's region (lib/estimate/
// roomPresets.js) and prices them from the company's own rates.
//
// The sizes printed beside "Small / Medium / Large" come from the page payload
// (`trade.rooms`, publicRoomPicker on the server) — the same table the server
// prices from, so "Medium · about 11 × 12 ft" is what the figure assumes, and
// the panel says "typical size, confirm on site" beside it. The words are the
// picker's own nine-language table (lib/i18n/roomPresetCopy.js).
//
// Selection is shown the way the rest of the form shows it — a ring in the
// brand's MEASURED accent (theme.accentText, 4.5:1 against the card) — never
// the raw brand hex, which is white on white for a white-branded company.
"use client";

import { Plus, X } from "lucide-react";
import { roomCopy, roomCopyLocale } from "@/lib/i18n/roomPresetCopy";
import { dimsText, heightText } from "@/lib/estimate/roomDisplay";

const SIZES = ["small", "medium", "large"];
const HEIGHTS = ["standard", "high"];
const MAX_ROOMS = 30;
const MAX_DOORS = 10;

/** A fresh room of a type: medium, standard ceiling, walls only — the picker's defaults. */
export function newRoom(type) {
  return { type, size: "medium", height: "standard", walls: true, ceiling: false, trim: false, doors: 0 };
}

/** Does this list describe anything to paint? The form's "job described" test. */
export function roomsDescribed(rooms) {
  return (
    Array.isArray(rooms) &&
    rooms.some((r) => r && (r.walls !== false || r.ceiling === true || r.trim === true || Number(r.doors) > 0))
  );
}

export default function RoomPicker({ picker, rooms, onChange, language, theme }) {
  const t = roomCopy(language);
  const locale = roomCopyLocale(language);
  const list = Array.isArray(rooms) ? rooms : [];
  const types = Array.isArray(picker?.types) ? picker.types : [];
  const sizesFor = (type) => types.find((x) => x.type === type)?.sizes || null;
  const unit = picker?.unit === "m" ? "m" : "ft";
  const ring = (on) => (on ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined);

  const set = (i, patch) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const add = (type) => {
    if (list.length >= MAX_ROOMS) return;
    onChange([...list, newRoom(type)]);
  };

  // The size a chip assumes, written the way the report will write it.
  const sizeText = (type, size) => {
    const pair = sizesFor(type)?.[size];
    return Array.isArray(pair) ? dimsText({ unit, length: pair[0], width: pair[1] }, locale) : "";
  };
  const storeys = (type) => (type === "stairwell" ? Number(picker?.stairwellStoreys) || 1 : 1);
  // A room type with its own ceiling (a basement) carries `heights`; every
  // other type reads the region's.
  const heightValue = (type, h) => {
    const own = types.find((x) => x.type === type)?.heights;
    const base = Number((own || picker?.heights)?.[h]);
    return heightText({ unit, ceilingHeight: Math.round(base * storeys(type) * 100) / 100 }, locale);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t.hint(t.regions[picker?.region] || t.regions.north_america)}</p>
      </div>

      {list.map((room, i) => {
        const name = t.rooms[room.type] || room.type;
        return (
          <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{name}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`${t.remove} — ${name}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-8 px-2"
              >
                <X size={14} aria-hidden="true" /> {t.remove}
              </button>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.size}</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.size}>
                {SIZES.map((s) => {
                  const on = (room.size || "medium") === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(i, { size: s })}
                      className={`rounded-lg border px-2 py-1.5 min-h-11 text-xs font-medium text-foreground text-left ${
                        on ? "border-transparent" : "border-border hover:border-foreground/30"
                      }`}
                      style={ring(on)}
                    >
                      <span className="block">{t.sizes[s]}</span>
                      <span className="block text-[11px] text-muted-foreground font-normal">≈ {sizeText(room.type, s)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.height}</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.height}>
                {HEIGHTS.map((h) => {
                  const on = (room.height || "standard") === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(i, { height: h })}
                      className={`rounded-lg border px-2 py-1.5 min-h-11 text-xs font-medium text-foreground text-left ${
                        on ? "border-transparent" : "border-border hover:border-foreground/30"
                      }`}
                      style={ring(on)}
                    >
                      {t.heights[h]} <span className="text-muted-foreground font-normal">· {heightValue(room.type, h)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.paint}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {["walls", "ceiling", "trim"].map((part) => (
                  <label key={part} className="flex items-center gap-2 text-sm text-foreground min-h-8">
                    <input
                      type="checkbox"
                      checked={part === "walls" ? room.walls !== false : room[part] === true}
                      onChange={(e) => set(i, { [part]: e.target.checked })}
                    />
                    <span>{t.parts[part]}</span>
                  </label>
                ))}
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span>{t.parts.doors}</span>
                  <button
                    type="button"
                    onClick={() => set(i, { doors: Math.max(0, (Number(room.doors) || 0) - 1) })}
                    disabled={!(Number(room.doors) > 0)}
                    className="h-8 w-8 rounded-full border border-border text-foreground disabled:opacity-40"
                    aria-label={`${t.parts.doors} −`}
                  >
                    −
                  </button>
                  <span className="w-5 text-center tabular-nums">{Number(room.doors) || 0}</span>
                  <button
                    type="button"
                    onClick={() => set(i, { doors: Math.min(MAX_DOORS, (Number(room.doors) || 0) + 1) })}
                    disabled={(Number(room.doors) || 0) >= MAX_DOORS}
                    className="h-8 w-8 rounded-full border border-border text-foreground disabled:opacity-40"
                    aria-label={`${t.parts.doors} +`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {list.length < MAX_ROOMS && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">{t.addRoom}</p>
          <div className="flex flex-wrap gap-2">
            {types.map(({ type }) => (
              <button
                key={type}
                type="button"
                onClick={() => add(type)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 min-h-10 text-sm font-medium text-foreground hover:border-foreground/30"
              >
                <Plus size={14} aria-hidden="true" /> {t.rooms[type] || type}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
