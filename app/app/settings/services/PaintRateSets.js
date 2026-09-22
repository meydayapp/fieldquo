// app/app/settings/services/PaintRateSets.js
//
// The painting takeoff's rate card: a rate set per estimate type — the
// hourly sell rate and the situation-named rates the quote builder's picker
// lists — plus the paint products (cost and coverage) and the extra-coat
// share. Owner, 2026-09-21: "they might also have to see those rates and
// their pricing in the settings too" — this is that screen, next to the
// trade's RateCard under Settings › Services.
//
// ── What it edits ───────────────────────────────────────────────────────────
//
// The `takeoff` subtree of the trade's rate overrides — the same object
// RateCard's coverage rows write into, sanitised by the same boundary
// (lib/pricing/paintTakeoff.js sanitisePaintTakeoffOverrides, through
// sanitiseRates). Everything shown is the MERGED book (defaults + overrides);
// a field the company changed draws amber with a reset, exactly as RateCard
// does, and clearing it returns the company to inheriting the default.
//
// A default rate cannot be deleted — its key is the seed the picker opens on
// — but it can be HIDDEN from the picker (`hidden: true`), and a custom rate
// the company added can be removed. Both are edits to the company's own
// override JSON; no stored record is deleted.
//
// ── Two category rows, one card ────────────────────────────────────────────
//
// Both painting books read one takeoff, but a company has a rate-override
// row per category. ServicesEditor mounts this card once, on the first
// painting category, and `onChange` here is applied to BOTH painting rows
// (see the mount), so a quote filed under either trade prices the same.
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, EyeOff, Eye, Trash2, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import {
  PAINT_ESTIMATE_TYPES,
  PAINT_TAKEOFF_DEFAULTS,
  substrateFits,
} from "@/lib/pricing/paintTakeoff";

const inputClass =
  "w-24 border border-border rounded px-2 py-1 text-sm text-right tabular-nums bg-background";
const textClass = "border border-border rounded px-2 py-1 text-sm bg-background";
const changed = "border-amber-400 bg-amber-50 dark:bg-amber-950/30";

const own = (map, key) =>
  map && key && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

/** Deep-set / deep-delete on a cloned overrides object, RateCard's way. */
function withPath(overrides, path, value) {
  const next = structuredClone(overrides || {});
  const parts = path.split(".");
  if (value === undefined) {
    let node = next;
    for (let i = 0; i < parts.length - 1; i++) node = node?.[parts[i]];
    if (node) delete node[parts[parts.length - 1]];
  } else {
    let node = next;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== "object") node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  // Prune empty objects so "nothing customised" stores as null again.
  const prune = (o) => {
    if (!o || typeof o !== "object") return o;
    for (const k of Object.keys(o)) {
      if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) {
        prune(o[k]);
        if (Object.keys(o[k]).length === 0) delete o[k];
      }
    }
    return o;
  };
  prune(next);
  return Object.keys(next).length ? next : null;
}

const readPath = (obj, path) =>
  path.split(".").reduce((n, p) => (n == null ? undefined : n[p]), obj);

function ProvenanceWord({ provenance, t }) {
  const words = {
    recovered: t("app.paint.provRecovered", "✓ recovered"),
    analogue: t("app.paint.provAnalogue", "analogue"),
    derived: t("app.paint.provDerived", "derived"),
    example: t("app.paint.provExample", "example"),
    illustrative: t("app.paint.provIllustrative", "illustrative"),
    custom: t("app.paint.provCustom", "yours"),
  };
  const label = words[provenance];
  if (!label) return null;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        provenance === "recovered"
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function NewRateForm({ type, book, t, onAdd, onCancel }) {
  const substrates = Object.keys(book.substrates || {}).filter(
    (k) => k !== "custom" && substrateFits(book.substrates[k], { estimateType: type }),
  );
  const [draft, setDraft] = useState({
    label: "",
    situation: "",
    substrate: substrates[0] || "",
    basis: "production",
    figure: "",
  });
  const def = own(book.substrates, draft.substrate);
  const unit = def?.unit || "each";
  const counted = def?.rateBasis === "item";
  const figureLabel =
    draft.basis === "flat"
      ? t("app.paint.sellPerUnit", "Price per {unit}", { unit })
      : counted
        ? t("app.paint.hoursPerUnit", "Hours per {unit}", { unit })
        : t("app.paint.productionRate", "Production rate");
  const key = () => {
    const base = draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 36) || "rate";
    return `c_${base}_${Date.now().toString(36).slice(-4)}`;
  };
  const submit = () => {
    const n = Number(draft.figure);
    if (!draft.label.trim() || !draft.substrate || !Number.isFinite(n) || n <= 0) return;
    const rate = {
      label: draft.label.trim(),
      situation: draft.situation.trim(),
      substrate: draft.substrate,
      basis: draft.basis,
      ...(draft.basis === "flat"
        ? { sellPerUnit: n }
        : counted
          ? { hoursPerUnit: n }
          : { productionRate: n }),
    };
    onAdd(key(), rate);
  };
  return (
    <div className="rounded border border-dashed border-border p-2.5 grid gap-2 sm:grid-cols-2">
      <input
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        placeholder={t("app.paint.rateName", "Name")}
        className={textClass}
      />
      <input
        value={draft.situation}
        onChange={(e) => setDraft({ ...draft, situation: e.target.value })}
        placeholder={t("app.paint.rateSituation", "Situation")}
        className={textClass}
      />
      <select
        value={draft.substrate}
        onChange={(e) => setDraft({ ...draft, substrate: e.target.value })}
        className={textClass}
      >
        {substrates.map((k) => (
          <option key={k} value={k}>
            {book.substrates[k].label}
          </option>
        ))}
      </select>
      <select
        value={draft.basis}
        onChange={(e) => setDraft({ ...draft, basis: e.target.value })}
        className={textClass}
      >
        <option value="production">
          {counted
            ? t("app.paint.basisHours", "Hours per {unit} × hourly rate", { unit })
            : t("app.paint.basisProduction", "Production rate ({unit}/hr) × hourly rate", { unit })}
        </option>
        <option value="flat">{t("app.paint.basisFlat", "Flat price per {unit}", { unit })}</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground flex-1">{figureLabel}</span>
        <input
          type="number"
          min={0}
          step={draft.basis === "flat" ? 0.05 : counted ? 0.05 : 5}
          value={draft.figure}
          onChange={(e) => setDraft({ ...draft, figure: e.target.value })}
          className={inputClass}
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-sm underline text-muted-foreground">
          {t("app.paint.cancel", "Cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-full bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold"
        >
          {t("app.paint.addRate", "Add rate")}
        </button>
      </div>
    </div>
  );
}

export default function PaintRateSets({ book, overrides, onChange }) {
  const { t } = useTranslation();
  // The currency CODE, because these boxes are TYPED into — the same call
  // cabinet-rates/page.js makes for the same reason.
  const { currency } = useCompanyPreferences();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("interior");
  const [adding, setAdding] = useState(false);
  const takeoff = book?.takeoff || PAINT_TAKEOFF_DEFAULTS;
  const set = useMemo(() => own(takeoff.rateSets, type) || { rates: {} }, [takeoff, type]);
  const defaults = own(PAINT_TAKEOFF_DEFAULTS.rateSets, type) || { rates: {} };
  const ov = overrides || {};
  const customised = Boolean(readPath(ov, "takeoff.rateSets") || readPath(ov, "takeoff.products") || readPath(ov, "takeoff.extraCoatHoursPct"));

  const setPath = (path, value) => onChange(withPath(ov, path, value));
  const isSet = (path) => readPath(ov, path) !== undefined;

  const rateKeys = Object.keys(set.rates || {});
  const figureField = (rate, def) =>
    rate.basis === "flat"
      ? "sellPerUnit"
      : def?.rateBasis === "item" || rate.hoursPerUnit !== undefined
        ? "hoursPerUnit"
        : "productionRate";

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm"
      >
        <span className="font-medium text-foreground">
          {t("app.paint.rateSetsTitle", "Painting rates")}
          {customised && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {t("app.rateCard.customised")}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {t(
              "app.paint.rateSetsIntro",
              "One rate set per kind of estimate. Each rate is named for the situation the painter is looking at and priced either as a production rate × your hourly sell rate, or as a flat price per unit. Nothing here reaches a client.",
            )}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PAINT_ESTIMATE_TYPES).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setType(key);
                  setAdding(false);
                }}
                aria-pressed={type === key}
                className={`rounded-full border px-3 py-1 text-sm ${
                  type === key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                }`}
              >
                {t(`app.paint.type.${key}`, PAINT_ESTIMATE_TYPES[key].label)}
              </button>
            ))}
          </div>

          {/* Hourly sell rates */}
          <div className="space-y-1">
            {[
              ["hourlySellRate", t("app.paint.hourlySell", "Hourly sell rate")],
              ...(defaults.exteriorHourlySellRate !== undefined
                ? [["exteriorHourlySellRate", t("app.paint.hourlySellExterior", "Hourly sell rate — exterior areas")]]
                : []),
            ].map(([field, label]) => {
              const path = `takeoff.rateSets.${type}.${field}`;
              return (
                <div key={field} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-sm text-foreground">{label}</span>
                  <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">
                    {t("app.paint.perHour", "per hour")}
                  </span>
                  <input
                    type="number"
                    step={1}
                    min={0}
                    value={set[field] ?? ""}
                    onChange={(e) => setPath(path, e.target.value === "" ? undefined : Number(e.target.value))}
                    className={`${inputClass} ${isSet(path) ? changed : ""}`}
                  />
                  {isSet(path) ? (
                    <button type="button" onClick={() => setPath(path, undefined)} className="p-1 text-muted-foreground" title={t("app.rateCard.resetToDefault")}>
                      <RotateCcw size={13} />
                    </button>
                  ) : (
                    <span className="w-[21px]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Rates */}
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.paint.ratesHeading", "Rates")}
            </h4>
            <div className="space-y-1">
              {rateKeys.map((key) => {
                const rate = set.rates[key];
                if (!rate || typeof rate !== "object") return null;
                const isDefault = Boolean(own(defaults.rates, key));
                const def = own(takeoff.substrates, rate.substrate);
                const unit = def?.unit || "each";
                const field = figureField(rate, def);
                const path = `takeoff.rateSets.${type}.rates.${key}`;
                const hidden = rate.hidden === true;
                const provenance = isSet(`${path}.${field}`) || isSet(`${path}.label`) ? "custom" : rate.provenance;
                if (hidden && !isDefault) return null;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 flex-wrap sm:flex-nowrap ${hidden ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1 min-w-[10rem]">
                      <input
                        value={rate.label || ""}
                        onChange={(e) => setPath(`${path}.label`, e.target.value)}
                        className={`${textClass} w-full ${isSet(`${path}.label`) ? changed : ""}`}
                        disabled={hidden}
                      />
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <span>{def?.label || rate.substrate}</span>
                        <ProvenanceWord provenance={provenance} t={t} />
                        {rate.situation && !isSet(`${path}.situation`) && <span>· {rate.situation}</span>}
                      </div>
                    </div>
                    <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">
                      {field === "sellPerUnit"
                        ? `${currency} / ${unit}`
                        : field === "hoursPerUnit"
                          ? `h / ${unit}`
                          : `${unit} / hr`}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={field === "productionRate" ? 5 : 0.05}
                      value={rate[field] ?? ""}
                      onChange={(e) => setPath(`${path}.${field}`, e.target.value === "" ? undefined : Number(e.target.value))}
                      className={`${inputClass} ${isSet(`${path}.${field}`) ? changed : ""}`}
                      disabled={hidden}
                    />
                    {isDefault ? (
                      <>
                        {isSet(`${path}.${field}`) || isSet(`${path}.label`) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPath(`${path}.${field}`, undefined);
                            }}
                            className="p-1 text-muted-foreground"
                            title={t("app.rateCard.resetToDefault")}
                          >
                            <RotateCcw size={13} />
                          </button>
                        ) : (
                          <span className="w-[21px]" />
                        )}
                        <button
                          type="button"
                          onClick={() => setPath(`${path}.hidden`, hidden ? undefined : true)}
                          className="p-1 text-muted-foreground"
                          title={
                            hidden
                              ? t("app.paint.showInPicker", "Show in the picker again")
                              : t("app.paint.hideFromPicker", "Hide from the picker")
                          }
                        >
                          {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="w-[21px]" />
                        <button
                          type="button"
                          onClick={() => setPath(path, undefined)}
                          className="p-1 text-muted-foreground hover:text-red-600"
                          title={t("app.paint.removeRate", "Remove this rate")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {adding ? (
              <div className="mt-2">
                <NewRateForm
                  type={type}
                  book={takeoff}
                  t={t}
                  onAdd={(key, rate) => {
                    setPath(`takeoff.rateSets.${type}.rates.${key}`, rate);
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <Plus size={14} /> {t("app.paint.createRate", "Create custom rate")}
              </button>
            )}
          </div>

          {/* Products */}
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.paint.productsHeading", "Paint products — what you pay")}
            </h4>
            <div className="space-y-1">
              {Object.keys(takeoff.products || {}).map((key) => {
                const p = takeoff.products[key];
                const path = `takeoff.products.${key}.costPerGal`;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm text-foreground">
                      {p.label}
                      {p.provenance === "illustrative" && (
                        <span className="ml-1.5">
                          <ProvenanceWord provenance="illustrative" t={t} />
                        </span>
                      )}
                      {(p.costPerGal === null || p.costPerGal === undefined) && (
                        <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">
                          {t("app.paint.unpricedShort", "unpriced")}
                        </span>
                      )}
                    </span>
                    <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">
                      {t("app.paint.perGallon", "per gallon")}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={p.costPerGal ?? ""}
                      onChange={(e) => setPath(path, e.target.value === "" ? undefined : Number(e.target.value))}
                      className={`${inputClass} ${isSet(path) ? changed : ""}`}
                    />
                    {isSet(path) ? (
                      <button type="button" onClick={() => setPath(path, undefined)} className="p-1 text-muted-foreground" title={t("app.rateCard.resetToDefault")}>
                        <RotateCcw size={13} />
                      </button>
                    ) : (
                      <span className="w-[21px]" />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "app.paint.productsHint",
                "Coverage (sqft per gallon) is on the rate card above. An unpriced product is counted in gallons and not costed — never as free paint.",
              )}
            </p>
          </div>

          {/* Extra coat share */}
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-sm text-foreground">
              {t("app.paint.extraCoatPct", "Extra coat — labour, as a share of the line's hours")}
              <span className="block text-xs text-muted-foreground">
                {t(
                  "app.paint.extraCoatPctHint",
                  "Your rates already cover two coats. An \"Extra coat\" option charges one more coat of paint plus this share of the line's hours.",
                )}
              </span>
            </span>
            <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">%</span>
            <input
              type="number"
              min={0}
              max={500}
              step={5}
              value={takeoff.extraCoatHoursPct ?? ""}
              onChange={(e) => setPath("takeoff.extraCoatHoursPct", e.target.value === "" ? undefined : Number(e.target.value))}
              className={`${inputClass} ${isSet("takeoff.extraCoatHoursPct") ? changed : ""}`}
            />
            {isSet("takeoff.extraCoatHoursPct") ? (
              <button type="button" onClick={() => setPath("takeoff.extraCoatHoursPct", undefined)} className="p-1 text-muted-foreground" title={t("app.rateCard.resetToDefault")}>
                <RotateCcw size={13} />
              </button>
            ) : (
              <span className="w-[21px]" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
