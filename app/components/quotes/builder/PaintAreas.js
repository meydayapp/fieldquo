// app/components/quotes/builder/PaintAreas.js
//
// The painting takeoff: an estimate type, then areas, then substrates and
// options inside them.
//
// ── Why this is its own file ───────────────────────────────────────────────
//
// TradeTakeoff.js is ~2,900 lines of fourteen trades. This one form is bigger
// than most of them, and it is the only takeoff whose numbers were recovered
// from a completed job — every figure on this screen is asserted to the cent in
// scripts/check-paint-takeoff.mjs. Keeping it separate keeps that relationship
// findable, and PaverDesigner.js already set the precedent for a takeoff that
// outgrew the shared file.
//
// ── The shape, from the approved mockup (2026-09-21) ───────────────────────
//
//   1. One question first: Interior · Exterior · Cabinets & millwork ·
//      Staining · Commercial. No hourly rate on the cards — that is internal
//      and lives on the type's rate set.
//   2. An area is a Room (4 walls) or a Surface (single wall), measured
//      W × L × H, with a "Calculated from measurements" strip the estimator
//      can type over.
//   3. After picking a room, tick what gets painted; every substrate row
//      prices at a SITUATION-NAMED rate from the type's set ("8 ft walls",
//      "16 ft walls", "Walls, bad condition · $1.50/sqft"), chosen in a
//      searchable picker that can also create a custom rate.
//   4. The area is one table — Qty · Prep hr · Painting hr · Total hr ·
//      Materials · Labour · Total — with "Options the homeowner can tick"
//      underneath: a whole substrate, an extra coat, a premium paint, or a
//      custom line.
//
// ── Everything on this screen is STAFF-ONLY ────────────────────────────────
//
// Production rates, hourly sell rate, gallons, paint cost per gallon, the rate
// formula. Non-negotiable #4 is that public endpoints never return prices, and
// a production rate plus an hourly rate is the contractor's entire pricing
// model in one line. Nothing here is reachable from /quote, /q or a PDF: the
// client-facing renderers read `description` and `amount` off the line items
// and the public route deliberately never returns `takeoff` at all.
//
// The arithmetic lives in lib/pricing/paintTakeoff.js and is called, not
// reimplemented — a second copy on the screen is how a form ends up disagreeing
// with the quote it is writing.
"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  X,
  Search,
  Pencil,
  ChevronUp,
  Home,
  Building2,
  Grid2x2,
  Brush,
  Building,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  paintTakeoff,
  paintFormula,
  areaGeometry,
  derivedGeometry,
  isGeometryOverride,
  newPaintArea,
  newPaintSubstrate,
  newPaintOption,
  estimateTypeOf,
  rateSetFor,
  ratesForSubstrate,
  substrateFits,
  areaTypeSurfaces,
  substrateProvenance,
  PAINT_ESTIMATE_TYPES,
  PAINT_QUICK_PICKS,
  PAINT_GEOMETRY_OVERRIDES,
  PAINT_OPTION_KINDS,
} from "@/lib/pricing/paintTakeoff";
import { Field, Num, inputClass, asList } from "./fields";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import MediaUploader from "@/app/components/MediaUploader";
import { reportResponseError } from "@/lib/clientErrors";

const own = (map, key) =>
  map && key && Object.prototype.hasOwnProperty.call(map, key)
    ? map[key]
    : undefined;

const hoursText = (h) => `${h} h`;
const num2 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const TYPE_ICONS = {
  interior: Home,
  exterior: Building2,
  cabinets: Grid2x2,
  staining: Brush,
  commercial: Building,
};

const smallInput =
  "w-full border border-border rounded px-2 py-1 text-sm tabular-nums bg-background";

/* ── Rate words ────────────────────────────────────────────────────────── */

/** "100 sqft/hr", "$1.50/sqft", "0.5 h/side" — in the company's currency. */
function figureOf(rate, unit, money) {
  if (!rate) return "";
  // Three decimals: the derived cabinet hours are 20.5 ÷ 60, and a screen
  // that prints 0.3416666666666667 is asking to be read as broken.
  const r3 = (v) => Math.round(num2(v) * 1000) / 1000;
  if (rate.basis === "flat") return `${money(num2(rate.sellPerUnit))}/${unit}`;
  if (num2(rate.hoursPerUnit) > 0) return `${r3(rate.hoursPerUnit)} h/${unit}`;
  if (num2(rate.productionRate) > 0) return `${r3(rate.productionRate)} ${unit}/hr`;
  return "";
}

function ProvenanceTag({ provenance, t }) {
  if (!provenance || provenance === "custom") return null;
  const words = {
    recovered: t("app.paint.provRecovered", "✓ recovered"),
    analogue: t("app.paint.provAnalogue", "analogue"),
    derived: t("app.paint.provDerived", "derived"),
    example: t("app.paint.provExample", "example"),
    illustrative: t("app.paint.provIllustrative", "illustrative"),
  };
  const label = words[provenance];
  if (!label) return null;
  return (
    <span
      className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        provenance === "recovered"
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

/* ── Modal shell ───────────────────────────────────────────────────────── */

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-foreground">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── 1. Estimate type ──────────────────────────────────────────────────── */

// Exported: the same cards are the FIRST screen of a painting company's new
// quote (EstimateTypeFirst.js), before any service tile — the owner's b1
// mockup, which landed inside the takeoff and was never seen (2026-09-21).
export function EstimateTypeCards({ value, onPick, t, legacyNote = true, bare = false }) {
  // `bare`: the caller draws the card and the title (EstimateTypeFirst's
  // "New painting quote" card, mockup b1); only the tiles are drawn here.
  return (
    <div className={bare ? "space-y-2" : "rounded-lg border border-border p-3 space-y-2"}>
      {!bare && (
        <div>
          <div className="text-sm font-semibold text-foreground">
            {t("app.paint.typeTitle", "What kind of estimate is this?")}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "app.paint.typeHint",
              "The pick decides which areas, surfaces and rates you see next.",
            )}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Object.keys(PAINT_ESTIMATE_TYPES).map((key) => {
          const type = PAINT_ESTIMATE_TYPES[key];
          const Icon = TYPE_ICONS[key] || Home;
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-pressed={on}
              className={`text-left rounded-xl border p-3 flex flex-col gap-1.5 min-w-0 transition-colors ${
                on
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-600/[0.12] text-blue-700 dark:text-blue-300">
                <Icon size={16} />
              </span>
              <span className="text-sm font-medium text-foreground">
                {t(`app.paint.type.${key}`, type.label)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`app.paint.typeHint.${key}`, type.hint)}
              </span>
            </button>
          );
        })}
      </div>
      {!value && legacyNote && (
        <p className="text-xs text-muted-foreground">
          {t(
            "app.paint.typeLegacy",
            "This takeoff was written before estimate types existed. It prices as it always did until you pick one.",
          )}
        </p>
      )}
    </div>
  );
}

/* ── 3. The rate picker ────────────────────────────────────────────────── */

function RatePicker({ row, def, rateSet, estimateType, money, t, onPick, onClose, onSaveRate }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    label: "",
    situation: "",
    basis: "production",
    productionRate: def.rateBasis === "item" ? 0 : num2(def.productionRate),
    hoursPerUnit: def.rateBasis === "item" ? num2(def.hoursPerUnit) : 0,
    sellPerUnit: 0,
    save: Boolean(onSaveRate),
  });
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const rates = useMemo(() => ratesForSubstrate(rateSet, row.key), [rateSet, row.key]);
  const needle = q.trim().toLowerCase();
  const shown = rates.filter(
    (r) =>
      !needle ||
      `${r.label} ${r.situation || ""}`.toLowerCase().includes(needle),
  );
  const unit = row.key === "custom" ? row.unit || def.unit : def.unit;
  const currentKey = row.rateKey || (row.rate ? "__inline" : null);

  const createRate = async () => {
    const rate = {
      label: draft.label.trim(),
      situation: draft.situation.trim(),
      substrate: row.key,
      basis: draft.basis,
      ...(draft.basis === "flat"
        ? { sellPerUnit: num2(draft.sellPerUnit) }
        : def.rateBasis === "item"
          ? { hoursPerUnit: num2(draft.hoursPerUnit) }
          : { productionRate: num2(draft.productionRate) }),
    };
    if (!rate.label) return;
    if (draft.save && onSaveRate) {
      setSaving(true);
      try {
        const key = await onSaveRate(estimateType, rate);
        if (key) {
          onPick({ rateKey: key, rate: null });
          return;
        }
        setSaveFailed(true);
      } finally {
        setSaving(false);
      }
    }
    // Kept on this line only: the rate could not be saved to the set (no
    // permission, offline) or the estimator chose not to. The engine reads
    // `row.rate` the same way it reads a set rate.
    onPick({ rateKey: null, rate });
  };

  return (
    <Modal
      title={t("app.paint.selectRate", "Select rate — {substrate}", { substrate: row.label || def.label })}
      onClose={onClose}
    >
      {!creating && (
        <>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("app.paint.searchRates", "Search rates… (walls, ceiling, cutting, wallpaper)")}
              className="w-full border border-border rounded px-2 py-1.5 pl-7 text-sm bg-background"
              autoFocus
            />
          </div>
          <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
            {shown.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                {t("app.paint.noRates", "No rate in this set matches. Create one below.")}
              </p>
            )}
            {shown.map((r) => {
              const on = r.key === currentKey;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onPick({ rateKey: r.key, rate: null })}
                  className={`w-full text-left flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    on ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {r.label}
                      <ProvenanceTag provenance={r.provenance} t={t} />
                    </span>
                    {r.situation && (
                      <span className="block text-xs text-muted-foreground">{r.situation}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {figureOf(r, unit, money)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              + {t("app.paint.createRate", "Create custom rate")}
            </button>
            <button type="button" onClick={onClose} className="text-sm underline text-muted-foreground">
              {t("app.paint.close", "Close")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t(
              "app.paint.rateLegend",
              "✓ recovered = solved from completed jobs; analogue and example = an opening position, check before quoting. Edit the list in Settings › Services › Painting rates.",
            )}
          </p>
        </>
      )}

      {creating && (
        <div className="space-y-2">
          <Field label={t("app.paint.rateName", "Name")}>
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder={t("app.paint.rateNamePlaceholder", "12 ft walls, textured")}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label={t("app.paint.rateSituation", "Situation")}>
            <input
              value={draft.situation}
              onChange={(e) => setDraft({ ...draft, situation: e.target.value })}
              placeholder={t("app.paint.rateSituationPlaceholder", "When does this rate apply?")}
              className={inputClass}
            />
          </Field>
          <Field label={t("app.paint.rateBasis", "Priced as")}>
            <select
              value={draft.basis}
              onChange={(e) => setDraft({ ...draft, basis: e.target.value })}
              className={inputClass}
            >
              <option value="production">
                {def.rateBasis === "item"
                  ? t("app.paint.basisHours", "Hours per {unit} × hourly rate", { unit })
                  : t("app.paint.basisProduction", "Production rate ({unit}/hr) × hourly rate", { unit })}
              </option>
              <option value="flat">{t("app.paint.basisFlat", "Flat price per {unit}", { unit })}</option>
            </select>
          </Field>
          {draft.basis === "flat" ? (
            <Field label={t("app.paint.sellPerUnit", "Price per {unit}", { unit })}>
              <Num value={draft.sellPerUnit} onChange={(v) => setDraft({ ...draft, sellPerUnit: v })} step={0.05} />
            </Field>
          ) : def.rateBasis === "item" ? (
            <Field label={t("app.paint.hoursPerUnit", "Hours per {unit}", { unit })}>
              <Num value={draft.hoursPerUnit} onChange={(v) => setDraft({ ...draft, hoursPerUnit: v })} step={0.05} suffix="h" />
            </Field>
          ) : (
            <Field label={t("app.paint.productionRate", "Production rate")}>
              <Num value={draft.productionRate} onChange={(v) => setDraft({ ...draft, productionRate: v })} step={5} suffix={`${unit}/hr`} />
            </Field>
          )}
          {onSaveRate && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.save}
                onChange={(e) => setDraft({ ...draft, save: e.target.checked })}
              />
              {t("app.paint.saveRateToSet", "Save to my {type} rates", {
                type: t(`app.paint.type.${estimateType}`, PAINT_ESTIMATE_TYPES[estimateType]?.label || estimateType),
              })}
            </label>
          )}
          {saveFailed && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(
                "app.paint.saveRateFailed",
                "Couldn't save it to the rate card — it stays on this line only. An owner or admin can add it in Settings › Services.",
              )}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="text-sm underline text-muted-foreground">
              {t("app.paint.back", "Back")}
            </button>
            <button
              type="button"
              onClick={createRate}
              disabled={saving || !draft.label.trim()}
              className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? t("app.paint.saving", "Saving…") : t("app.paint.useThisRate", "Use this rate")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Substrate picker ──────────────────────────────────────────────────── */

function SubstratePicker({ book, estimateType, surface, t, onPick, onClose }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const keys = Object.keys(book?.substrates || {}).filter((key) => {
    const def = book.substrates[key];
    if (!substrateFits(def, { estimateType, surface })) return false;
    return !needle || `${def.label} ${key}`.toLowerCase().includes(needle);
  });
  return (
    <Modal title={t("app.paint.addSubstrateTitle", "Add a substrate")} onClose={onClose}>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("app.paint.searchSubstrates", "Search surfaces…")}
          className="w-full border border-border rounded px-2 py-1.5 pl-7 text-sm bg-background"
          autoFocus
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5 max-h-[50vh] overflow-y-auto">
        {keys.map((key) => {
          const def = book.substrates[key];
          const prov = substrateProvenance(key, def);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              className={`text-left rounded-lg border border-border px-3 py-2 hover:bg-accent ${
                key === "custom" ? "border-dashed" : ""
              }`}
            >
              <span className="text-sm font-medium text-foreground">
                {key === "custom" ? `+ ${t("app.paint.customLine", "Custom line")}` : def.label}
                {key !== "custom" && <ProvenanceTag provenance={prov} t={t} />}
              </span>
              <span className="block text-xs text-muted-foreground">
                {key === "custom"
                  ? t("app.paint.customLineHint", "Your own description, unit and rate")
                  : t("app.paint.perUnit", "per {unit}", { unit: def.unit })}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ── 4. Quick picks: tick what's painted ───────────────────────────────── */

const PICK_LABELS = {
  walls: ["app.paint.pick.walls", "Walls"],
  ceiling: ["app.paint.pick.ceiling", "Ceiling"],
  door: ["app.paint.pick.doors", "Doors"],
  trim: ["app.paint.pick.trim", "Trim / baseboards"],
  windows: ["app.paint.pick.windows", "Windows"],
  closets: ["app.paint.pick.closets", "Closets"],
};

function QuickPicks({ area, book, estimateType, t, onChange }) {
  const picks = own(PAINT_QUICK_PICKS, estimateType) || [];
  const substrates = asList(area.substrates);
  const rowFor = (key) => substrates.findIndex((s) => s?.key === key);

  const toggle = (pick, on) => {
    const i = rowFor(pick.key);
    if (on && i < 0) {
      const row = newPaintSubstrate(pick.key, book, { estimateType });
      if (!row) return;
      const def = book.substrates[pick.key];
      // A counted substrate starts at one, so the tick prices something; a
      // measured one reads the room. Both are typed over in the table.
      if (pick.count && !def.driver) {
        row.quantity = pick.sides ? 2 : 1;
        if (pick.sides) row.doorCount = 1;
        if (pick.sides) row.sides = 2;
        if (pick.faces) row.faces = 1;
      }
      onChange({ ...area, substrates: [...substrates, row] });
    } else if (!on && i >= 0) {
      onChange({ ...area, substrates: substrates.filter((_, j) => j !== i) });
    }
  };

  const setRow = (i, patch) =>
    onChange({
      ...area,
      substrates: substrates.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });

  if (!picks.length) return null;
  return (
    <div className="rounded border border-border p-2.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {t("app.paint.tickPainted", "Tick what's painted")}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {picks.map((pick) => {
          const def = own(book?.substrates, pick.key);
          if (!def) return null;
          const i = rowFor(pick.key);
          const on = i >= 0;
          const row = on ? substrates[i] : null;
          const [lk, ld] = PICK_LABELS[pick.pick || pick.key] || [null, def.label];
          const label = lk ? t(lk, ld) : def.label;
          return (
            <div key={pick.key} className="flex items-center gap-1.5 flex-wrap">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={on} onChange={(e) => toggle(pick, e.target.checked)} />
                {label}
              </label>
              {on && pick.count && (
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={pick.sides ? (row.doorCount ?? Math.max(1, Math.ceil(num2(row.quantity) / (row.sides || 1)))) : num2(row.quantity)}
                  onChange={(e) => {
                    const n = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                    if (pick.sides) {
                      const sides = row.sides === 1 ? 1 : 2;
                      setRow(i, { doorCount: n, sides, quantity: n * sides });
                    } else if (pick.faces) {
                      const faces = row.faces === 2 ? 2 : 1;
                      setRow(i, { faces, quantity: n * faces });
                    } else {
                      setRow(i, { quantity: n });
                    }
                  }}
                  className="w-14 border border-border rounded px-1.5 py-0.5 text-sm tabular-nums bg-background"
                  aria-label={t("app.paint.howMany", "How many")}
                />
              )}
              {on && pick.sides && (
                <select
                  value={row.sides === 1 ? 1 : 2}
                  onChange={(e) => {
                    const sides = Number(e.target.value) === 1 ? 1 : 2;
                    const n = row.doorCount ?? Math.max(1, Math.ceil(num2(row.quantity) / (row.sides || 1)));
                    setRow(i, { sides, doorCount: n, quantity: n * sides });
                  }}
                  className="border border-border rounded px-1.5 py-0.5 text-sm bg-background"
                >
                  <option value={1}>{t("app.paint.oneSide", "one side")}</option>
                  <option value={2}>{t("app.paint.bothSides", "both sides")}</option>
                </select>
              )}
              {on && pick.faces && (
                <select
                  value={row.faces === 2 ? 2 : 1}
                  onChange={(e) => {
                    const faces = Number(e.target.value) === 2 ? 2 : 1;
                    const n = Math.ceil(num2(row.quantity) / (row.faces || 1));
                    setRow(i, { faces, quantity: n * faces });
                  }}
                  className="border border-border rounded px-1.5 py-0.5 text-sm bg-background"
                >
                  <option value={1}>{t("app.paint.oneFace", "one face")}</option>
                  <option value={2}>{t("app.paint.bothFaces", "both faces")}</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 4. One substrate row of the area table ────────────────────────────── */

function SubstrateRow({
  row,
  priced,
  book,
  rateSet,
  estimateType,
  t,
  money,
  onChange,
  onRemove,
  onPickRate,
}) {
  const [open, setOpen] = useState(false);
  const def = own(book?.substrates, row?.key);
  if (!def) return null;
  const set = (patch) => onChange({ ...row, ...patch });
  const unit = row.key === "custom" ? row.unit || def.unit : def.unit;
  const derived = row.quantity === null || row.quantity === undefined;
  const formula = paintFormula(priced);
  const rate =
    (row.rateKey && own(rateSet?.rates, row.rateKey)) ||
    (row.rate && typeof row.rate === "object" ? row.rate : null);
  const rateWords =
    rate && rateSet
      ? `${rate.label || ""} · ${figureOf(rate, unit, money)}`
      : priced
        ? t("app.paint.rateCard", "rate card")
        : "";
  const products = book?.products || {};
  const multi = Array.isArray(row.products) && row.products.length > 1;

  return (
    <>
      <tr className="border-b border-border align-top">
        <td className="py-1.5 pr-2 min-w-[12rem]">
          <input
            value={row.label ?? def.label}
            onChange={(e) => set({ label: e.target.value })}
            className="w-full border border-border rounded px-2 py-1 text-sm font-medium bg-background"
          />
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            {rateSet ? (
              <button
                type="button"
                onClick={onPickRate}
                className="underline decoration-dotted hover:text-foreground text-left"
              >
                {rateWords || t("app.paint.pickRate", "Pick a rate")}
              </button>
            ) : (
              <span>{rateWords}</span>
            )}
            <span>·</span>
            <label className="flex items-center gap-1">
              {t("app.paint.coats", "Coats")}
              <select
                value={row.coats ?? def.coats ?? 2}
                onChange={(e) => set({ coats: Number(e.target.value) })}
                className="border border-border rounded px-1 py-0.5 text-xs bg-background"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            {row.optional === true && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {t("app.paint.optionalTag", "optional")}
              </span>
            )}
          </div>
        </td>
        <td className="py-1.5 px-1 text-right">
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              min={0}
              step={0.5}
              value={derived ? (priced?.quantity ?? 0) : row.quantity}
              onChange={(e) => set({ quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
              className={`${smallInput} w-20 text-right ${derived ? "text-muted-foreground" : ""}`}
              title={derived ? t("app.paint.quantityMeasured", "From the measurements — type to override") : ""}
            />
            <span className="text-xs text-muted-foreground w-8">{unit}</span>
          </div>
          {!derived && def.driver && (
            <button
              type="button"
              onClick={() => set({ quantity: null })}
              className="text-[11px] text-muted-foreground underline"
            >
              {t("app.paint.useMeasured", "Use the measured quantity again")}
            </button>
          )}
        </td>
        <td className="py-1.5 px-1 text-right">
          <input
            type="number"
            min={0}
            step={0.25}
            value={row.prepHours ?? 0}
            onChange={(e) => set({ prepHours: e.target.value === "" ? 0 : Number(e.target.value) })}
            className={`${smallInput} w-16 text-right`}
          />
        </td>
        <td className="py-1.5 px-1 text-right tabular-nums text-sm">
          {priced ? (Math.round(num2(priced.workHours) * 100) / 100).toFixed(2) : "—"}
        </td>
        <td className="py-1.5 px-1 text-right tabular-nums text-sm">
          {priced ? (Math.round(num2(priced.hours) * 100) / 100).toFixed(2) : "—"}
        </td>
        <td className="py-1.5 px-1 text-right tabular-nums text-sm">
          {!priced
            ? "—"
            : priced.noProduct
              ? t("app.paint.noProductShort", "no product")
              : priced.unpriced && priced.material === null
                ? t("app.paint.unpricedShort", "unpriced")
                : money(priced.material ?? 0)}
        </td>
        <td className="py-1.5 px-1 text-right tabular-nums text-sm">{priced ? money(priced.labour) : "—"}</td>
        <td className="py-1.5 pl-1 text-right tabular-nums text-sm font-semibold">
          {priced ? money(priced.amount) : "—"}
        </td>
        <td className="py-1.5 pl-1 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label={t("app.paint.rowDetails", "Row details")}
            aria-expanded={open}
          >
            {open ? <ChevronUp size={14} /> : <Pencil size={14} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-muted-foreground hover:text-red-600"
            aria-label={t("app.paint.removeSubstrate", "Remove substrate")}
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-accent/40">
          <td colSpan={9} className="p-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {row.key === "custom" && (
                <Field label={t("app.paint.unit", "Unit")}>
                  <input
                    value={row.unit || def.unit}
                    onChange={(e) => set({ unit: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              )}
              {multi ? (
                row.products.map((p, pi) => (
                  <Field
                    key={pi}
                    label={
                      pi === 0
                        ? t("app.paint.stainProduct", "Stain")
                        : t("app.paint.clearProduct", "Clear coat")
                    }
                  >
                    <div className="flex gap-1">
                      <select
                        value={p.productKey || ""}
                        onChange={(e) =>
                          set({
                            products: row.products.map((x, xi) =>
                              xi === pi ? { ...x, productKey: e.target.value } : x,
                            ),
                          })
                        }
                        className={inputClass}
                      >
                        {Object.keys(products).map((key) => (
                          <option key={key} value={key}>
                            {products[key].label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={p.coats ?? 1}
                        onChange={(e) =>
                          set({
                            products: row.products.map((x, xi) =>
                              xi === pi ? { ...x, coats: Number(e.target.value) } : x,
                            ),
                          })
                        }
                        className={`${inputClass} w-16`}
                        aria-label={t("app.paint.coats", "Coats")}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </div>
                  </Field>
                ))
              ) : (
                <Field label={t("app.paint.product", "Product")}>
                  <select
                    value={row.noProduct ? "__none" : (row.productKey ?? def.productKey ?? "__none")}
                    onChange={(e) =>
                      e.target.value === "__none"
                        ? set({ noProduct: true })
                        : set({ noProduct: false, productKey: e.target.value })
                    }
                    className={inputClass}
                  >
                    {Object.keys(products).map((key) => (
                      <option key={key} value={key}>
                        {products[key].label}
                        {products[key].costPerGal === null ? ` (${t("app.paint.unpricedShort", "unpriced")})` : ""}
                      </option>
                    ))}
                    {/* Not "$0 paint". No product means nobody is supplying paint for
                        this line, which is a different claim from free paint, and the
                        totals below report the two separately. */}
                    <option value="__none">{t("app.paint.noProduct", "No product — labour only")}</option>
                  </select>
                </Field>
              )}
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground sm:pt-5">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.optional === true}
                    onChange={(e) => set({ optional: e.target.checked })}
                  />
                  {t("app.paint.optionalSubstrate", "Optional — client can add it")}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.roundGallonsUp === true}
                    onChange={(e) =>
                      // Back to null, not false: null inherits the area's setting,
                      // false overrides it to "no". Three states, three meanings.
                      set({ roundGallonsUp: e.target.checked ? true : null })
                    }
                  />
                  {t("app.paint.roundGallons", "Round gallons up")}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.showFormula === true}
                    onChange={(e) => set({ showFormula: e.target.checked })}
                  />
                  {t("app.paint.showFormula", "Show rate formula (internal)")}
                </label>
              </div>
            </div>
            {priced && (
              <div className="text-xs text-muted-foreground tabular-nums mt-2">
                {hoursText(priced.displayHours)} · {money(priced.labour)} {t("app.paint.labourWord", "labour")}
                {priced.noProduct
                  ? ` · ${t("app.paint.noProductShort", "no product")}`
                  : priced.materials.map((m) =>
                      ` · ${m.label}: ${m.gallons.toFixed(2)} gal${m.unpriced ? ` (${t("app.paint.unpriced", "no price on this product yet")})` : ` · ${money(m.material)}`}`,
                    ).join("")}
                {priced.rateInline && ` · ${t("app.paint.rateOnThisLine", "custom rate on this line only")}`}
              </div>
            )}
            {formula && (
              <div className="text-xs rounded bg-accent px-2 py-1 tabular-nums text-muted-foreground mt-1">
                {formula}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ── 4. Options the homeowner can tick ─────────────────────────────────── */

function OptionRows({ area, priced, book, t, money, onChange }) {
  const options = asList(area.options);
  const substrates = asList(area.substrates);
  const [menu, setMenu] = useState(false);
  const optionalLines = (priced?.lines || []).filter((l) => l.kind === "substrate" && l.optional);
  const pricedOptions = priced?.options || [];
  const includedLines = (priced?.lines || []).filter((l) => l.kind === "substrate" && !l.optional);
  const products = book?.products || {};

  const setOption = (i, patch) =>
    onChange({ ...area, options: options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const addOption = (kind, patch = {}) => {
    onChange({ ...area, options: [...options, newPaintOption(kind, patch)] });
    setMenu(false);
  };

  // Premium candidates: the products marked as an upgrade of the line's
  // paint, then any other product of the same surface.
  const premiumFor = (line) => {
    const current = line.productKey;
    const keys = Object.keys(products).filter((k) => k !== current);
    return [
      ...keys.filter((k) => products[k].premiumFor === current),
      ...keys.filter((k) => products[k].premiumFor !== current && (products[current]?.surface || "any") === (products[k].surface || "any")),
    ];
  };

  const empty = optionalLines.length === 0 && options.length === 0;

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("app.paint.optionsTitle", "Options the homeowner can tick")}
      </div>
      {empty && (
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "app.paint.optionsEmpty",
            "None yet. Mark a substrate optional in its row details, or add an extra coat, a premium paint or a custom option below.",
          )}
        </p>
      )}
      <table className="w-full text-sm mt-1">
        <tbody>
          {optionalLines.map((l) => (
            <tr key={`s-${l.rowIndex}`} className="border-b border-border">
              <td className="py-1.5 pr-2">
                <span className="inline-block w-3.5 h-3.5 border border-muted-foreground rounded-sm align-[-2px] mr-1.5" />
                {l.label}{" "}
                <span className="text-muted-foreground text-xs">
                  {l.quantity} {l.unit}, {l.coats} {t("app.paint.coatsShort", "coats")} · {hoursText(l.displayHours)}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums w-28">+ {money(l.amount)}</td>
              <td className="py-1.5 pl-1 w-8 text-right">
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...area,
                      substrates: substrates.map((s, j) => (j === l.rowIndex ? { ...s, optional: false } : s)),
                    })
                  }
                  className="text-xs underline text-muted-foreground"
                  title={t("app.paint.makeIncluded", "Put it back in the included scope")}
                >
                  {t("app.paint.include", "include")}
                </button>
              </td>
            </tr>
          ))}
          {options.map((o, i) => {
            const p = pricedOptions.find((x) => x.index === i) || null;
            const line = includedLines.find((l) => l.rowIndex === o.substrateIndex) || null;
            return (
              <tr key={`o-${i}`} className="border-b border-border align-top">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block w-3.5 h-3.5 border border-muted-foreground rounded-sm shrink-0" />
                    <input
                      value={o.label ?? ""}
                      onChange={(e) => setOption(i, { label: e.target.value })}
                      placeholder={p?.label || t("app.paint.optionLabel", "Option name")}
                      className="border border-border rounded px-2 py-0.5 text-sm bg-background min-w-[10rem] flex-1"
                    />
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {o.kind === "extra_coat"
                        ? t("app.paint.kindExtraCoat", "extra coat")
                        : o.kind === "premium_paint"
                          ? t("app.paint.kindPremium", "premium paint")
                          : t("app.paint.kindCustom", "custom")}
                    </span>
                    {p?.custom && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t("app.paint.customPrice", "custom price")}
                      </span>
                    )}
                  </div>
                  {o.kind !== "custom" && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <select
                        value={o.substrateIndex ?? ""}
                        onChange={(e) => setOption(i, { substrateIndex: e.target.value === "" ? null : Number(e.target.value) })}
                        className="border border-border rounded px-1.5 py-0.5 text-xs bg-background"
                      >
                        <option value="">{t("app.paint.onWhichLine", "On which line?")}</option>
                        {includedLines.map((l) => (
                          <option key={l.rowIndex} value={l.rowIndex}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      {o.kind === "premium_paint" && line && (
                        <select
                          value={o.productKey ?? ""}
                          onChange={(e) => setOption(i, { productKey: e.target.value || null })}
                          className="border border-border rounded px-1.5 py-0.5 text-xs bg-background"
                        >
                          <option value="">{t("app.paint.whichProduct", "Which product?")}</option>
                          {premiumFor(line).map((k) => (
                            <option key={k} value={k}>
                              {products[k].label}
                              {products[k].costPerGal === null ? ` (${t("app.paint.unpricedShort", "unpriced")})` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      {p && p.computedAmount !== null && p.computedAmount !== undefined && (
                        <span>
                          {t("app.paint.computed", "takeoff: {amount}", { amount: money(p.computedAmount) })}
                          {o.kind === "extra_coat" && ` · ${hoursText(Math.round(num2(p.hours) * 100) / 100)}`}
                        </span>
                      )}
                      {p && p.unpriced && !p.custom && (
                        <span className="text-amber-700 dark:text-amber-400">
                          {o.kind === "premium_paint"
                            ? t("app.paint.premiumUnpriced", "Price this product on the rate card, or type an amount.")
                            : t("app.paint.optionUnpriced", "No price yet — type an amount.")}
                        </span>
                      )}
                      {!p && o.substrateIndex !== null && (
                        <span className="text-amber-700 dark:text-amber-400">
                          {t("app.paint.optionNoLine", "That line has nothing measured yet.")}
                        </span>
                      )}
                    </div>
                  )}
                  <input
                    value={o.detail ?? ""}
                    onChange={(e) => setOption(i, { detail: e.target.value })}
                    placeholder={t("app.paint.optionDetail", "One line on why it's worth having (optional)")}
                    className="mt-1 w-full border border-border rounded px-2 py-0.5 text-xs bg-background"
                  />
                </td>
                <td className="py-1.5 text-right tabular-nums w-32">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-muted-foreground">+</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={o.amount === null || o.amount === undefined ? "" : o.amount}
                      placeholder={p && p.computedAmount !== null && p.computedAmount !== undefined ? String(p.computedAmount) : ""}
                      onChange={(e) => setOption(i, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                      className={`${smallInput} w-24 text-right`}
                      aria-label={t("app.paint.optionAmount", "Option price")}
                    />
                  </div>
                  {o.amount !== null && o.amount !== undefined && o.kind !== "custom" && (
                    <button
                      type="button"
                      onClick={() => setOption(i, { amount: null })}
                      className="text-[11px] underline text-muted-foreground"
                    >
                      {t("app.paint.useTakeoffPrice", "use the takeoff's price")}
                    </button>
                  )}
                </td>
                <td className="py-1.5 pl-1 w-8 text-right">
                  <button
                    type="button"
                    onClick={() => onChange({ ...area, options: options.filter((_, j) => j !== i) })}
                    className="p-1 text-muted-foreground hover:text-red-600"
                    aria-label={t("app.paint.removeOption", "Remove option")}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="relative inline-block mt-2">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-expanded={menu}
        >
          + {t("app.paint.addOption", "Add option")}
        </button>
        {menu && (
          <div className="absolute z-20 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg p-1 text-sm">
            {PAINT_OPTION_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  addOption(kind, {
                    substrateIndex: kind === "custom" ? null : (includedLines[0]?.rowIndex ?? null),
                    productKey:
                      kind === "premium_paint" && includedLines[0]
                        ? premiumFor(includedLines[0])[0] || null
                        : null,
                  })
                }
                className="w-full text-left rounded px-2 py-1.5 hover:bg-accent"
              >
                {kind === "extra_coat"
                  ? t("app.paint.addExtraCoat", "Extra coat")
                  : kind === "premium_paint"
                    ? t("app.paint.addPremium", "Premium paint upgrade")
                    : t("app.paint.addCustomOption", "Custom option")}
                <span className="block text-xs text-muted-foreground">
                  {kind === "extra_coat"
                    ? t("app.paint.addExtraCoatHint", "One more coat on a line, repriced by the takeoff")
                    : kind === "premium_paint"
                      ? t("app.paint.addPremiumHint", "Swap the product; the client pays the paint difference")
                      : t("app.paint.addCustomOptionHint", "Anything else, priced by hand")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 2 + 4. One area ───────────────────────────────────────────────────── */

function AreaCard({
  area,
  index,
  priced,
  book,
  estimateType,
  rateSet,
  t,
  onChange,
  onRemove,
  onSaveRate,
}) {
  const money = useCompanyMoney();
  const [pickingRate, setPickingRate] = useState(null);
  const [addingSubstrate, setAddingSubstrate] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const set = (patch) => onChange({ ...area, ...patch });
  const substrates = asList(area.substrates);
  const style = area.measurement || "area";
  const closed = style === "area";
  const geo = priced?.geometry || areaGeometry(area);
  const calc = priced?.derived || derivedGeometry(area);
  const type = estimateType ? PAINT_ESTIMATE_TYPES[estimateType] : null;

  const setSub = (i, next) =>
    set({ substrates: substrates.map((s, j) => (j === i ? next : s)) });

  // By stored index, never by position in the priced list: a substrate with
  // nothing measured yet produces no line, which would shift every row below it.
  const priceOf = (i) =>
    (priced?.lines || []).find((l) => l.kind === "substrate" && l.rowIndex === i) || null;

  const areaTypeKeys = Object.keys(book?.areaTypes || {}).filter((key) => {
    if (!type) return true;
    return areaTypeSurfaces(book.areaTypes[key]).some((s) => type.surfaces.includes(s));
  });
  if (area.areaType && !areaTypeKeys.includes(area.areaType)) areaTypeKeys.unshift(area.areaType);

  const overridden = Object.keys(PAINT_GEOMETRY_OVERRIDES).some((f) =>
    isGeometryOverride(area[PAINT_GEOMETRY_OVERRIDES[f]]),
  );
  const strip = [
    ["linearFt", t("app.paint.geoLinear", "Linear ft")],
    ["wallSqft", t("app.paint.geoWalls", "Walls sqft")],
    ["ceilingSqft", t("app.paint.geoCeiling", "Ceiling sqft")],
    ["floorSqft", t("app.paint.geoFloor", "Floor sqft")],
  ];

  const media = asList(area.media);
  const hasNotes = Boolean(area.clientNote || area.crewNote);

  return (
    // data-paint-area: the document builder lands here when its room card is
    // clicked (DocumentBuilder.js scrolls to the index it drew).
    <div className="rounded-lg border border-border p-3 space-y-3" data-paint-area={index}>
      {/* ── Header: name · Room/Surface · total ── */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">{money(priced?.total ?? 0)}</span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1.5 text-muted-foreground hover:text-red-600"
          aria-label={t("app.paint.removeArea", "Remove area")}
        >
          <Trash2 size={15} />
        </button>
      </div>

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
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label={t("app.paint.areaType", "Area type")}>
          <select
            value={area.areaType || areaTypeKeys[0] || "den"}
            onChange={(e) => {
              const next = own(book?.areaTypes, e.target.value);
              set({
                areaType: e.target.value,
                // Under a type the surface is the type's; with none it follows
                // the room as it always did.
                surface: type ? area.surface : next?.surface || area.surface,
                // The label follows the type only while it still matches the
                // old type's — a label the estimator wrote for the client is
                // theirs and is never overwritten.
                label:
                  area.label === own(book?.areaTypes, area.areaType)?.label
                    ? next?.label || area.label
                    : area.label,
              });
            }}
            className={inputClass}
          >
            {areaTypeKeys.map((key) => (
              <option key={key} value={key}>
                {book.areaTypes[key]?.label || key}
              </option>
            ))}
          </select>
        </Field>
        {(!type || estimateType === "commercial") && (
          <Field label={t("app.paint.surface", "Interior / exterior")}>
            <select
              value={area.surface === "exterior" ? "exterior" : "interior"}
              onChange={(e) => set({ surface: e.target.value })}
              className={inputClass}
            >
              <option value="interior">{t("app.paint.interior", "Interior")}</option>
              <option value="exterior">{t("app.paint.exterior", "Exterior")}</option>
            </select>
          </Field>
        )}
        <Field label={t("app.paint.areaPrepHours", "Extra prep hours")}>
          <Num value={area.prepHours} onChange={(v) => set({ prepHours: v })} step={0.25} suffix="h" />
        </Field>
      </div>

      {/* ── Calculated from measurements — type over any figure ── */}
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
        <p className="text-muted-foreground mt-1.5">
          {t(
            "app.paint.grossHint",
            "Every surface below reads its quantity from this strip. Gross area — openings are not deducted, which is what the production rates were recovered against.",
          )}
        </p>
      </div>

      {/* ── Tick what's painted ── */}
      {estimateType && (
        <QuickPicks area={area} book={book} estimateType={estimateType} t={t} onChange={onChange} />
      )}

      {/* ── The area table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[52rem]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <th className="text-left font-semibold py-1 pr-2">{t("app.paint.colDescription", "Description")}</th>
              <th className="text-right font-semibold py-1 px-1">{t("app.paint.colQty", "Qty")}</th>
              <th className="text-right font-semibold py-1 px-1">{t("app.paint.colPrep", "Prep hr")}</th>
              <th className="text-right font-semibold py-1 px-1">{t("app.paint.colPainting", "Painting hr")}</th>
              <th className="text-right font-semibold py-1 px-1">{t("app.paint.colTotalHr", "Total hr")}</th>
              <th className="text-right font-semibold py-1 px-1">{t("app.paint.colMaterials", "Materials")}</th>
              <th className="text-right font-semibold py-1 px-1">{t("app.paint.colLabour", "Labour")}</th>
              <th className="text-right font-semibold py-1 pl-1">{t("app.paint.colTotal", "Total")}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {substrates.length === 0 && (
              <tr>
                <td colSpan={9} className="py-2 text-xs text-muted-foreground">
                  {t("app.paint.noSubstrates", "Nothing added yet — tick a surface above or add a substrate below.")}
                </td>
              </tr>
            )}
            {substrates.map((row, i) => (
              <SubstrateRow
                key={i}
                row={row}
                priced={priceOf(i)}
                book={book}
                rateSet={rateSet}
                estimateType={estimateType}
                t={t}
                money={money}
                onChange={(next) => setSub(i, next)}
                onRemove={() => set({ substrates: substrates.filter((_, j) => j !== i) })}
                onPickRate={() => setPickingRate(i)}
              />
            ))}
            {priced && substrates.length > 0 && (
              <tr className="bg-muted font-semibold">
                <td className="py-1.5 pr-2">
                  {t("app.paint.areaTotal", "Area total")} · {money(priced.hourlySellRate)}/h
                </td>
                <td />
                <td className="py-1.5 px-1 text-right tabular-nums">
                  {(Math.round(num2(priced.prepHours) * 100) / 100).toFixed(2)}
                </td>
                <td className="py-1.5 px-1 text-right tabular-nums">
                  {(Math.round((num2(priced.hours) - num2(priced.prepHours)) * 100) / 100).toFixed(2)}
                </td>
                <td className="py-1.5 px-1 text-right tabular-nums">{priced.displayHours.toFixed(2)}</td>
                <td className="py-1.5 px-1 text-right tabular-nums">{money(priced.material)}</td>
                <td className="py-1.5 px-1 text-right tabular-nums">{money(priced.labour)}</td>
                <td className="py-1.5 pl-1 text-right tabular-nums">{money(priced.total)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Options ── */}
      <OptionRows area={area} priced={priced} book={book} t={t} money={money} onChange={onChange} />

      {/* ── Links ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <button type="button" onClick={() => setAddingSubstrate(true)} className="hover:text-foreground">
          + {t("app.paint.addSubstrate", "Add substrate")}
        </button>
        <button type="button" onClick={() => setShowMedia((v) => !v)} className="hover:text-foreground">
          {t("app.paint.addMedia", "Add media")}
          {media.length > 0 && ` (${media.length})`}
        </button>
        <button type="button" onClick={() => setShowNotes((v) => !v)} className="hover:text-foreground">
          {t("app.paint.addNotes", "Add notes")}
        </button>
        <button type="button" onClick={() => setShowMore((v) => !v)} className="hover:text-foreground">
          {t("app.paint.more", "More")}
          {area.optional === true && ` · ${t("app.paint.optionalTag", "optional")}`}
        </button>
      </div>

      {(showMedia || media.length > 0) && (
        <div className="rounded border border-border p-2.5">
          <div className="text-xs text-muted-foreground mb-1">
            {t(
              "app.paint.mediaHint",
              "Photos of this area, for your own record on the takeoff. They do not print on the quote.",
            )}
          </div>
          <MediaUploader
            uploadUrl="/api/upload" purpose="quotes"
            value={media}
            onChange={(next) => set({ media: asList(next) })}
            max={6}
            label={t("app.paint.mediaLabel", "Add photos of this area")}
            hint=""
          />
        </div>
      )}

      {(showNotes || hasNotes) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t("app.paint.clientNote", "Client note (on the quote)")}>
            <input
              value={area.clientNote || ""}
              onChange={(e) => set({ clientNote: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("app.paint.crewNote", "Crew note (work order)")}>
            <input
              value={area.crewNote || ""}
              onChange={(e) => set({ crewNote: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {showMore && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={area.optional === true}
              onChange={(e) => set({ optional: e.target.checked })}
            />
            {t("app.paint.optionalArea", "Optional — client can add or drop the whole area")}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={area.roundGallonsUp === true}
              onChange={(e) => set({ roundGallonsUp: e.target.checked ? true : null })}
            />
            {t("app.paint.roundGallonsArea", "Round gallons up in this area")}
          </label>
        </div>
      )}

      {pickingRate !== null && substrates[pickingRate] && (
        <RatePicker
          row={substrates[pickingRate]}
          def={own(book?.substrates, substrates[pickingRate].key)}
          rateSet={rateSet}
          estimateType={estimateType}
          money={money}
          t={t}
          onSaveRate={onSaveRate}
          onPick={(patch) => {
            setSub(pickingRate, { ...substrates[pickingRate], ...patch });
            setPickingRate(null);
          }}
          onClose={() => setPickingRate(null)}
        />
      )}
      {addingSubstrate && (
        <SubstratePicker
          book={book}
          estimateType={estimateType}
          surface={estimateType === "commercial" || !estimateType ? area.surface || "interior" : null}
          t={t}
          onPick={(key) => {
            const row = newPaintSubstrate(key, book, { estimateType });
            if (row) set({ substrates: [...substrates, row] });
            setAddingSubstrate(false);
          }}
          onClose={() => setAddingSubstrate(false)}
        />
      )}
    </div>
  );
}

/* ── The takeoff ───────────────────────────────────────────────────────── */

/**
 * Saves a custom rate to the company's set through the painting-rates route.
 * Resolves to the new key, or null when the save was refused — the picker
 * then keeps the rate on the line. Rates saved this session are merged into
 * the book here so the picker lists them before the page is reloaded.
 */
function useSavedRates(book) {
  const [extra, setExtra] = useState({});
  const merged = useMemo(() => {
    if (!book || !Object.keys(extra).length) return book;
    const rateSets = { ...(book.rateSets || {}) };
    for (const type of Object.keys(extra)) {
      const set = rateSets[type] || {};
      rateSets[type] = { ...set, rates: { ...(set.rates || {}), ...extra[type] } };
    }
    return { ...book, rateSets };
  }, [book, extra]);

  const save = async (estimateType, rate) => {
    try {
      const res = await fetch("/api/settings/painting-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateType, rate }),
      });
      if (!res.ok) {
        // A 403 is the normal answer for an estimator without settings rights;
        // the picker explains and keeps the rate on the line. Anything else
        // is reported the way every other failed save is.
        if (res.status !== 403) await reportResponseError(res, "Couldn't save the rate.");
        return null;
      }
      const data = await res.json();
      if (!data?.key || !data?.rate) return null;
      setExtra((prev) => ({
        ...prev,
        [estimateType]: { ...(prev[estimateType] || {}), [data.key]: data.rate },
      }));
      return data.key;
    } catch {
      return null;
    }
  };
  return [merged, save];
}

export default function PaintAreas({ takeoff, book: rawBook, onChange }) {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const [book, saveRate] = useSavedRates(rawBook);
  const areas = asList(takeoff?.areas);
  const estimateType = estimateTypeOf(takeoff);
  const rateSet = rateSetFor(book, estimateType);
  // One call, not a reimplementation. The screen and the quote must agree, and
  // the only way to guarantee that is for them to be the same arithmetic.
  const result = paintTakeoff(takeoff, book);

  const setArea = (i, next) =>
    onChange({ ...takeoff, areas: areas.map((a, j) => (j === i ? next : a)) });

  // Two lists over one array — see `index` in paintTakeoff(). Matching on the
  // label would pair the wrong room the moment a house had two "Bedroom"s.
  const pricedFor = (i) =>
    result.areas.find((o) => o.index === i) ||
    result.optionalAreas.find((o) => o.index === i) ||
    null;

  const addArea = () => {
    const type = estimateType ? PAINT_ESTIMATE_TYPES[estimateType] : null;
    onChange({
      ...takeoff,
      areas: [...areas, newPaintArea(type?.defaultAreaType || "den", book, { estimateType })],
    });
  };

  return (
    <div className="space-y-3">
      <EstimateTypeCards
        value={estimateType}
        t={t}
        onPick={(key) => onChange({ ...takeoff, estimateType: key })}
      />

      {areas.map((area, i) => (
        <AreaCard
          key={i}
          area={area}
          index={i}
          priced={pricedFor(i)}
          book={book}
          estimateType={estimateType}
          rateSet={rateSet}
          t={t}
          onChange={(next) => setArea(i, next)}
          onRemove={() => onChange({ ...takeoff, areas: areas.filter((_, j) => j !== i) })}
          onSaveRate={saveRate}
        />
      ))}

      <button
        type="button"
        onClick={addArea}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus size={14} /> {t("app.paint.addArea", "Add an area")}
      </button>

      {areas.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
          {result.rateSet && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("app.paint.rateSetInUse", "Rate set")}</span>
              <span>
                {t(`app.paint.type.${estimateType}`, result.rateSet.label)} · {money(result.rateSet.hourlySellRate)}/h
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("app.paint.totalHours", "Man-hours")}</span>
            <span className="tabular-nums">{hoursText(result.displayHours)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("app.paint.totalLabour", "Labour")}</span>
            <span className="tabular-nums">{money(result.labour)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("app.paint.totalMaterial", "Materials")}</span>
            <span className="tabular-nums">{money(result.material)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border pt-2">
            <span>{t("app.paint.totalScope", "Included scope")}</span>
            <span className="tabular-nums">{money(result.total)}</span>
          </div>

          {result.unpricedCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(
                "app.paint.unpricedWarning",
                "{n} line(s) use a product with no price on the rate card. Their paint is counted but not costed.",
                { n: result.unpricedCount },
              )}
            </p>
          )}

          {result.purchase.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.paint.buyList", "Paint to buy")}
              </div>
              {result.purchase.map((p) => (
                <div key={p.productKey} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="tabular-nums">
                    {p.gallons} gal ({p.fractionalGallons})
                  </span>
                </div>
              ))}
              {/* Fractional in brackets on purpose. Rounding each room up and
                  adding is not adding and rounding once, and on a house the
                  difference is a trip to the store — see paintTakeoff(). */}
            </div>
          )}

          {(result.optionalAreas.length > 0 ||
            result.optionalSubstrates.length > 0 ||
            result.options.some((o) => o.amount !== null && o.amount > 0)) && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("app.paint.optionalOffered", "Offered as optional extras")}
              </div>
              {result.optionalAreas.map((a) => (
                <div key={`a-${a.index}`} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="tabular-nums">{money(a.total)}</span>
                </div>
              ))}
              {result.optionalSubstrates.map((s, i) => (
                <div key={`s-${i}`} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {s.area} — {s.label}
                  </span>
                  <span className="tabular-nums">{money(s.amount)}</span>
                </div>
              ))}
              {result.options
                .filter((o) => o.amount !== null && o.amount > 0)
                .map((o, i) => (
                  <div key={`o-${i}`} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {o.area} — {o.label}
                    </span>
                    <span className="tabular-nums">{money(o.amount)}</span>
                  </div>
                ))}
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "app.paint.optionalExplain",
                  "Not in the total above. The client ticks them under the room on their quote, and the total they sign changes when they do.",
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
