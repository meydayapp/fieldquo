"use client";

// app/components/kitchen/FinishPicker.js
//
// Choosing what the kitchen is made of.
//
// ONE component for both audiences. The contractor and the homeowner are
// picking from the same palette and writing the same field, and two pickers
// would be two palettes that drift — a client choosing "Sage" from a list the
// contractor's screen doesn't have is a colour nobody can order.
//
// What differs is only `allowCustom`: a company matching a client's existing
// millwork needs an arbitrary hex; a homeowner given a colour wheel picks
// something no cabinet shop stocks and the contractor has to walk it back.
//
// ── Swatches, not names ────────────────────────────────────────────────────
//
// Every option shows the actual colour at a usable size. "Greige" means nothing
// as a word, and a homeowner deciding between three greens from a dropdown is
// being asked to imagine their own kitchen — which is exactly the job the
// drawing next to this is doing for them.

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import {
  CABINET_COLORS,
  DOOR_STYLES,
  COUNTER_COLORS,
  FLOOR_COLORS,
  WALL_COLORS,
  BACKSPLASH_COLORS,
  normaliseFinish,
} from "@/lib/kitchen/finishes";

function Section({ title, hint, children }) {
  return (
    <div>
      <p className="text-[0.72rem] font-bold tracking-wide uppercase text-neutral-500">
        {title}
      </p>
      {hint && <p className="text-xs text-neutral-500 mt-0.5">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * A colour chip.
 *
 * The tick is drawn in a colour chosen against the swatch itself, not a fixed
 * white — on Pure White and Natural Oak a white tick is invisible, which makes
 * the selected option look unselected.
 */
function Swatch({ hex, label, selected, onClick }) {
  const light = isLight(hex);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={`relative h-11 w-11 rounded-lg border transition-transform ${
        selected
          ? "border-neutral-900 dark:border-white scale-105 shadow-sm"
          : "border-neutral-300 dark:border-neutral-700 hover:scale-105"
      }`}
      style={{ backgroundColor: hex }}
    >
      {selected && (
        <Check
          size={16}
          strokeWidth={3}
          className="absolute inset-0 m-auto"
          style={{ color: light ? "#1f2226" : "#ffffff" }}
        />
      )}
    </button>
  );
}

function isLight(hex) {
  const s = String(hex || "").replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = parseInt(full.slice(0, 6) || "888888", 16);
  if (!Number.isFinite(n)) return true;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Perceived luminance, not the average — a saturated yellow and a mid grey
  // have the same average and very different readability.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/**
 * @param value        the current finish
 * @param onChange     fires with the whole finish on every change
 * @param allowCustom  offer a custom hex (contractor only — see the header)
 * @param compact      hide wall and backsplash (the plan-only view)
 */
export default function FinishPicker({
  value,
  onChange,
  allowCustom = false,
  compact = false,
}) {
  const f = normaliseFinish(value);
  const [customOpen, setCustomOpen] = useState(false);

  // Always emits a NORMALISED finish, so nothing downstream — including the
  // public API — has to re-validate what a picker produced.
  const set = (patch) => onChange?.(normaliseFinish({ ...f, ...patch }));

  return (
    <div className="space-y-5">
      <Section title="Cabinet colour">
        {CABINET_COLORS.map((c) => (
          <Swatch
            key={c.key}
            hex={c.hex}
            label={c.label}
            selected={f.cabinetColor.toLowerCase() === c.hex.toLowerCase()}
            onClick={() => set({ cabinetColor: c.hex })}
          />
        ))}
        {allowCustom && (
          <>
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              title="Custom colour"
              aria-label="Custom colour"
              className="h-11 w-11 rounded-lg border border-dashed border-neutral-400 dark:border-neutral-600 grid place-items-center text-neutral-500"
            >
              <Plus size={16} />
            </button>
            {customOpen && (
              <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                <input
                  type="color"
                  value={f.cabinetColor}
                  onChange={(e) => set({ cabinetColor: e.target.value })}
                  className="h-11 w-11 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent p-0.5"
                />
                {f.cabinetColor}
              </label>
            )}
          </>
        )}
      </Section>

      <Section
        title="Door style"
        hint={DOOR_STYLES.find((d) => d.key === f.doorStyle)?.hint}
      >
        {DOOR_STYLES.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => set({ doorStyle: d.key })}
            aria-pressed={f.doorStyle === d.key}
            className={`px-3.5 py-2 rounded-full border text-sm ${
              f.doorStyle === d.key
                ? "border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </Section>

      {/* A two-tone island is the most-asked-for thing in a kitchen, so it's
          offered directly rather than left to a custom colour nobody finds. */}
      <Section title="Island colour" hint="Leave off to match the rest.">
        <button
          type="button"
          onClick={() => set({ islandColor: null })}
          aria-pressed={!f.islandColor}
          className={`px-3.5 py-2 rounded-full border text-sm ${
            !f.islandColor
              ? "border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold"
              : "border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
          }`}
        >
          Same as cabinets
        </button>
        {CABINET_COLORS.map((c) => (
          <Swatch
            key={c.key}
            hex={c.hex}
            label={`Island — ${c.label}`}
            selected={f.islandColor?.toLowerCase() === c.hex.toLowerCase()}
            onClick={() => set({ islandColor: c.hex })}
          />
        ))}
      </Section>

      <Section title="Countertop">
        {COUNTER_COLORS.map((c) => (
          <Swatch
            key={c.key}
            hex={c.hex}
            label={c.label}
            selected={f.countertopColor.toLowerCase() === c.hex.toLowerCase()}
            onClick={() => set({ countertopColor: c.hex, countertopVeined: c.veined })}
          />
        ))}
      </Section>

      <Section title="Floor">
        {FLOOR_COLORS.map((c) => (
          <Swatch
            key={c.key}
            hex={c.hex}
            label={c.label}
            selected={f.floorColor.toLowerCase() === c.hex.toLowerCase()}
            onClick={() => set({ floorColor: c.hex, floorPlank: c.plank })}
          />
        ))}
      </Section>

      {!compact && (
        <>
          <Section title="Wall paint">
            {WALL_COLORS.map((c) => (
              <Swatch
                key={c.key}
                hex={c.hex}
                label={c.label}
                selected={f.wallColor.toLowerCase() === c.hex.toLowerCase()}
                onClick={() => set({ wallColor: c.hex })}
              />
            ))}
          </Section>

          <Section title="Backsplash">
            {BACKSPLASH_COLORS.map((c) => (
              <Swatch
                key={c.key}
                // "Slab (matches counter)" has no colour of its own — it IS the
                // counter, so the chip shows the counter and choosing it stores
                // null, which the renderer reads as "follow the counter".
                hex={c.hex ?? f.countertopColor}
                label={c.label}
                selected={
                  c.hex === null
                    ? f.backsplashColor === null
                    : f.backsplashColor?.toLowerCase() === c.hex.toLowerCase()
                }
                onClick={() => set({ backsplashColor: c.hex, backsplashTile: c.tile })}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
