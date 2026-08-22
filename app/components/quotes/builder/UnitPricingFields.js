// app/components/quotes/builder/UnitPricingFields.js
//
// Per-unit pricing for cabinet refinishing and refacing.
//
// This is the densest block in the builder — door and drawer counts, wood
// species, base rate, complexity tier, an optional custom upcharge, seventeen
// complexity reasons across three categories, and three finish fields. All of
// it was inline in a 1,500-line page inside an IIFE, which is why nobody could
// see that the rest of the page had a shape.
//
// Presentational only. Every handler is the parent's, unchanged — this
// component holds no state of its own except which disclosure is open, which
// is genuinely local. That keeps the save path identical: the same
// `updateIntakeValue` and `updatePricing` calls fire on the same events with
// the same arguments as before.
"use client";

import {
  COMPLEXITY_LEVELS,
  COMPLEXITY_REASONS,
  finalUnitPrice,
  groupUnits,
} from "@/app/data/cabinetPricing";
import { formatAppMoney } from "@/lib/format/money";

// Kept as a plain list rather than a lookup: the internal primer-coats rule in
// the costing engine reads these exact strings.
const WOOD_SPECIES = [
  "oak",
  "ash",
  "hickory",
  "pine",
  "maple",
  "mdf_prefinished",
  "thermofoil",
  "other",
];

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs text-muted-foreground">{label}</label>
    {children}
  </div>
);

const inputClass =
  "w-full mt-1 border border-border rounded px-2 py-1.5 text-sm";

export default function UnitPricingFields({
  // The company's billing currency. Without it these rendered a bare
  // toFixed(2), which does not group — $2100.00 next to a grouped total.
  currency,
  group,
  reasonsOpen,
  onToggleReasons,
  onIntakeChange,
  onPricingChange,
  onToggleReason,
}) {
  const units = groupUnits(group);
  const finalPrice = finalUnitPrice(group);
  const iv = group.intakeValues || {};

  const upcharge =
    group.complexityLevel === "custom"
      ? Number(group.complexityUpcharge) || 0
      : COMPLEXITY_LEVELS.find((l) => l.value === group.complexityLevel)
          ?.upcharge || 0;

  const reasonCount = group.complexityReasons?.length || 0;

  return (
    <div className="space-y-4 pb-4 border-b border-border">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Doors">
          <input
            type="number"
            min="0"
            value={iv.doorCount || ""}
            onChange={(e) => onIntakeChange("doorCount", e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </Field>
        <Field label="Drawers">
          <input
            type="number"
            min="0"
            value={iv.drawerCount || ""}
            onChange={(e) => onIntakeChange("drawerCount", e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </Field>
        <Field label="Total units">
          <div className="mt-1 px-3 py-1.5 bg-muted border border-border rounded text-sm font-semibold text-center text-foreground">
            {units}
          </div>
        </Field>
      </div>

      <Field label="Wood / door material">
        <select
          value={iv.woodSpecies || ""}
          onChange={(e) => onIntakeChange("woodSpecies", e.target.value)}
          className={`${inputClass} bg-card`}
        >
          <option value="">—</option>
          {WOOD_SPECIES.map((w) => (
            <option key={w} value={w}>
              {w.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Base price / unit">
          <div className="relative mt-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <input
              type="number"
              min="0"
              step="5"
              // ── Why 0 renders as blank ──────────────────────────────
              //
              // Typing "-50" left "050" in the field, priced as $50/unit.
              // A number input reports "" for anything it can't parse, and "-"
              // on its own is one of those — so the minus keystroke wrote 0,
              // React rendered a literal "0", and the digits that followed
              // landed after it: "0" → "05" → "050".
              //
              // Rendering 0 as empty breaks that chain: the minus still writes
              // 0, the field shows nothing, and "50" types cleanly. A base
              // price of exactly zero is not a thing anyone means to enter
              // here, so blank is the honest display for it.
              value={group.baseUnitPrice ? group.baseUnitPrice : ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return onPricingChange({ baseUnitPrice: 0 });
                const n = Number(raw);
                // Negatives and junk are IGNORED rather than written as 0 —
                // silently rewriting someone's keystroke to a different number
                // is how the artifact got there in the first place.
                if (!Number.isFinite(n) || n < 0) return;
                onPricingChange({ baseUnitPrice: n });
              }}
              className="w-full border border-border rounded pl-5 pr-2 py-1.5 text-sm"
            />
          </div>
        </Field>
        <Field label="Upcharge">
          <div className="mt-1 px-3 py-1.5 bg-muted border border-border rounded text-sm text-center text-foreground">
            +${upcharge}
          </div>
        </Field>
        <Field label="Final / unit">
          <div className="mt-1 px-3 py-1.5 bg-inverted rounded text-sm font-semibold text-center text-inverted-foreground">
            {formatAppMoney(finalPrice, currency, "en")}
          </div>
        </Field>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">
          Project complexity
        </label>
        <div className="flex flex-wrap gap-2">
          {COMPLEXITY_LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              type="button"
              onClick={() => onPricingChange({ complexityLevel: lvl.value })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                group.complexityLevel === lvl.value
                  ? "border-inverted bg-inverted text-inverted-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {lvl.label}
              {lvl.upcharge ? ` (+$${lvl.upcharge})` : ""}
            </button>
          ))}
        </div>

        {group.complexityLevel === "custom" && (
          <div className="mt-2 w-40">
            <label className="text-xs text-muted-foreground">
              Custom upcharge / unit
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={group.complexityUpcharge || ""}
              onChange={(e) =>
                onPricingChange({
                  complexityUpcharge: Number(e.target.value) || 0,
                })
              }
              className={inputClass}
              placeholder="e.g. 60"
            />
          </div>
        )}
      </div>

      <div>
        {/* Collapsed by default: seventeen checkboxes open on a phone buries
            everything below them. The count on the toggle is what tells you
            there's something in there worth opening. */}
        <button
          type="button"
          onClick={onToggleReasons}
          className="text-xs font-medium text-foreground flex items-center gap-1"
        >
          {reasonsOpen ? "▾" : "▸"} Complexity reasons
          {reasonCount > 0 && (
            <span className="bg-inverted text-inverted-foreground rounded-full px-1.5 text-[10px]">
              {reasonCount}
            </span>
          )}
          <span className="text-muted-foreground font-normal">
            — shown on the quote &amp; PDF
          </span>
        </button>

        {reasonsOpen && (
          <div className="mt-2 border border-border rounded-lg p-3 space-y-3">
            {Object.entries(COMPLEXITY_REASONS).map(([cat, reasons]) => (
              <div key={cat}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  {cat}
                </p>
                {reasons.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-start gap-2 text-sm py-0.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={group.complexityReasons?.includes(r.id) || false}
                      onChange={() => onToggleReason(r.id)}
                    />
                    <span className="text-foreground">{r.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Colour">
          <input
            value={group.color || ""}
            onChange={(e) => onPricingChange({ color: e.target.value })}
            className={inputClass}
            placeholder="e.g. BM Chantilly Lace"
          />
        </Field>
        <Field label="Sheen">
          <select
            value={group.sheen || ""}
            onChange={(e) => onPricingChange({ sheen: e.target.value })}
            className={`${inputClass} bg-card`}
          >
            <option value="">Select…</option>
            <option value="matte">Matte</option>
            <option value="satin">Satin</option>
            <option value="semi-gloss">Semi-Gloss</option>
            <option value="gloss">Gloss</option>
          </select>
        </Field>
        <Field label="Door style">
          <input
            value={group.doorStyle || ""}
            onChange={(e) => onPricingChange({ doorStyle: e.target.value })}
            className={inputClass}
            placeholder="e.g. Shaker"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between bg-muted border border-border rounded-lg px-4 py-2.5">
        <span className="text-sm text-muted-foreground">
          {units} unit{units === 1 ? "" : "s"} × {formatAppMoney(finalPrice, currency, "en")}
        </span>
        <span className="text-base font-bold text-foreground">
          {formatAppMoney(units * finalPrice, currency, "en")}
        </span>
      </div>
    </div>
  );
}
