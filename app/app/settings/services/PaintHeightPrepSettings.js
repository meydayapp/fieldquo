// app/app/settings/services/PaintHeightPrepSettings.js
//
// Settings → Services, beside the painting rates, two sections of the
// painting preset (lib/pricing/paintHeightPrep.js — one copy, read by the
// quote builder's painting card and by the drawing read):
//
//   Access, height and prep    height factors and the height the rates were
//                              measured at, prep allowances, daily setup,
//                              the crew plan, prep-material prices, sundries
//   Equipment & access         rental rates per equipment type and size,
//   (#equipment-access)        "we own this", delivery, frame scaffold — the
//                              place the owner asked for (2026-10-05: "is
//                              there a place the company can add it?")
//
// Every box shows the figure IN USE when it is empty (FieldQuo's, faint) and
// where it came from; a typed figure is the company's own, amber with a reset,
// written into the same `takeoff` overrides the painting rates use (both
// painting rows — see PaintRateSets.js), sanitised by
// sanitisePaintTakeoffOverrides. A company that never opens this prices on
// the preset — and every such line says "FieldQuo default — set yours".
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchJson } from "@/lib/fetchJson";
import {
  HEIGHT_BANDS,
  HEIGHT_FACTOR_PRESET,
  HEIGHT_BASIS_PRESET_FT,
  PREP_ALLOWANCE_PRESET,
  PREP_STEP_INFO,
  DAILY_SETUP_PRESET_MINUTES,
  CREW_PLAN_PRESET,
  PREP_MATERIAL_PRICE_PRESET,
  SUNDRIES_PCT_PRESET,
  ACCESS_KINDS,
  ACCESS_REFERENCE,
  ACCESS_REFERENCE_YEAR,
  SOURCES,
} from "@/lib/pricing/paintHeightPrep";
import { withPath } from "./PaintRateSets";

const inputClass = "w-24 border border-border rounded px-2 py-1 text-sm text-right tabular-nums bg-background";
const changed = "border-amber-400 bg-amber-50 dark:bg-amber-950/30";
const readPath = (obj, path) => path.split(".").reduce((n, p) => (n == null ? undefined : n[p]), obj);

function Row({ label, hint, path, preset, ov, onSet, step = 0.1, suffix = null, t }) {
  const mine = readPath(ov, path);
  const isSet = mine !== undefined && mine !== null;
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 min-w-0 text-sm text-foreground">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {suffix && <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{suffix}</span>}
      <input
        type="number"
        min={0}
        step={step}
        value={isSet ? mine : ""}
        placeholder={preset === null || preset === undefined ? "—" : String(preset)}
        onChange={(e) => onSet(path, e.target.value === "" ? undefined : Number(e.target.value))}
        className={`${inputClass} ${isSet ? changed : ""}`}
        aria-label={label}
      />
      {isSet ? (
        <button type="button" onClick={() => onSet(path, undefined)} className="p-1 text-muted-foreground" title={t("app.rateCard.resetToDefault")}>
          <RotateCcw size={13} />
        </button>
      ) : (
        <span className="w-[21px]" />
      )}
    </div>
  );
}

function Section({ id, title, customised, children, t }) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.location.hash === `#${id}`);
  // The sidebar row and the set-up step link here by #id. The card mounts
  // after the services load, too late for the browser's own jump, and a
  // click while already on the page changes only the hash — so open and
  // scroll on both.
  useEffect(() => {
    const go = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [id]);
  return (
    <div id={id} className="mt-3 border-t border-border pt-3 scroll-mt-20">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm" aria-expanded={open}>
        <span className="font-medium text-foreground">
          {title}
          {customised && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{t("app.rateCard.customised")}</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3 space-y-5">{children}</div>}
    </div>
  );
}

export default function PaintHeightPrepSettings({ overrides, onChange }) {
  const { t } = useTranslation();
  const { currency } = useCompanyPreferences();
  const ov = overrides || {};
  const onSet = (path, value) => onChange(withPath(ov, path, value));
  const set = (k) => readPath(ov, `takeoff.${k}`) !== undefined;
  const section = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  // The reference table in this company's currency — what an empty box uses.
  const [defaults, setDefaults] = useState(null);
  useEffect(() => {
    let live = true;
    fetchJson("/api/quotes/access-rental")
      .then((d) => live && setDefaults(d))
      .catch(() => live && setDefaults({ error: true }));
    return () => {
      live = false;
    };
  }, []);
  const inUse = (kind, size, p) => {
    const row = defaults?.kinds?.find((k) => k.kind === kind)?.rows?.find((r) => String(r.size) === String(size));
    return row && row[p] !== null && row[p] !== undefined ? row[p] : null;
  };

  return (
    <>
      <Section id="prep-materials" title={t("app.paintPreset.title", "Access, height and prep")} customised={["heightFactors", "heightBasisFt", "prepAllowances", "dailySetupMinutes", "crewPlan", "prepMaterialPrices", "sundriesPct"].some(set)} t={t}>
        <p className="text-xs text-muted-foreground">
          {t("app.paintPreset.intro", "Used by your painting quotes and by drawing reads. Blank boxes use FieldQuo's figure (shown faint); a figure you type is yours.")}
        </p>
        <div className="space-y-2">
          <p className={section}>{t("app.paintPreset.heightTitle", "Labour by working height")}</p>
          <p className="text-xs text-muted-foreground">
            {t("app.paintPreset.heightSource", "Multipliers on the hours for the share of a surface in each band — {source}. Above 21 ft is FieldQuo's extrapolation.", { source: SOURCES.htdf.name })}
          </p>
          {HEIGHT_BANDS.map((b) => (
            <Row key={b.key} t={t} label={t(`app.paintPreset.band.${b.key}`, b.label)} path={`takeoff.heightFactors.${b.key}`} preset={HEIGHT_FACTOR_PRESET[b.key]} ov={ov} onSet={onSet} step={0.05} suffix="×" />
          ))}
          <Row
            t={t}
            label={t("app.paintPreset.basis", "Height your production rates were measured at")}
            hint={t("app.paintPreset.basisHint", "FieldQuo's rates came from a 9 ft room, so height is charged above that. If your rates are for 8 ft rooms, set 8.")}
            path="takeoff.heightBasisFt"
            preset={HEIGHT_BASIS_PRESET_FT}
            ov={ov}
            onSet={onSet}
            step={0.5}
            suffix="ft"
          />
        </div>
        <div className="space-y-2">
          <p className={section}>{t("app.paintPreset.prepTitle", "Prep allowances")}</p>
          <p className="text-xs text-muted-foreground">{t("app.paintPreset.prepSource", "Hours per 100 sq ft, added as the line's prep hours when a condition is chosen — {source}.", { source: SOURCES.resene.name })}</p>
          {Object.keys(PREP_ALLOWANCE_PRESET).map((k) => (
            <Row key={k} t={t} label={t(`app.paintPreset.prep.${k}`, PREP_STEP_INFO[k].label)} path={`takeoff.prepAllowances.${k}`} preset={PREP_ALLOWANCE_PRESET[k]} ov={ov} onSet={onSet} step={0.05} suffix={t("app.paintPreset.per100", "h / 100 sq ft")} />
          ))}
          <Row
            t={t}
            label={t("app.paintPreset.setup", "Daily setup and clean-up, occupied or heritage building")}
            hint={t("app.paintPreset.setupHint", "Minutes a painter a day — Craftsman's SURRPTUCU, 20–30 minutes each for setup and clean-up.")}
            path="takeoff.dailySetupMinutes"
            preset={DAILY_SETUP_PRESET_MINUTES}
            ov={ov}
            onSet={onSet}
            step={5}
            suffix={t("app.paintPreset.minutes", "min")}
          />
        </div>
        <div className="space-y-2">
          <p className={section}>{t("app.paintPreset.materialsTitle", "Prep materials and sundries")}</p>
          <p className="text-xs text-muted-foreground">{t("app.paintPreset.materialsSource", "Prices in {currency} for what a chosen condition uses. Blank: a US shelf price (Home Depot, 2026-09-24), shown as a FieldQuo default on every line. Masonry primer follows your primer price until you set its own.", { currency })}</p>
          {Object.keys(PREP_MATERIAL_PRICE_PRESET).map((k) => (
            <Row key={k} t={t} label={t(`app.paintPreset.material.${k}`, k)} path={`takeoff.prepMaterialPrices.${k}`} preset={PREP_MATERIAL_PRICE_PRESET[k]} ov={ov} onSet={onSet} step={0.5} suffix={currency} />
          ))}
          <Row t={t} label={t("app.paintPreset.material.masonry_primer", "Masonry primer (per gallon)")} hint={t("app.paintPreset.masonryFollows", "Blank: same as primer.")} path="takeoff.prepMaterialPrices.masonry_primer" preset={null} ov={ov} onSet={onSet} step={0.5} suffix={currency} />
          <Row t={t} label={t("app.paintPreset.sundries", "Sundries — rollers, covers, brushes")} hint={t("app.paintPreset.sundriesHint", "A share of the paint, counted as a cost.")} path="takeoff.sundriesPct" preset={SUNDRIES_PCT_PRESET} ov={ov} onSet={onSet} step={1} suffix="%" />
        </div>
        <div className="space-y-2">
          <p className={section}>{t("app.paintPreset.crewTitle", "Crew plan")}</p>
          <Row t={t} label={t("app.paintPreset.hoursPerDay", "Productive hours a painter a day")} path="takeoff.crewPlan.hoursPerDay" preset={CREW_PLAN_PRESET.hoursPerDay} ov={ov} onSet={onSet} step={0.25} suffix="h" />
          <Row t={t} label={t("app.paintPreset.crewSize", "Painters on a typical job")} hint={t("app.paintPreset.crewSizeHint", "Blank: the active field crew on your Team page.")} path="takeoff.crewPlan.crewSize" preset={CREW_PLAN_PRESET.crewSize} ov={ov} onSet={onSet} step={1} />
        </div>
      </Section>

      <Section id="equipment-access" title={t("app.paintPreset.accessTitle", "Equipment & access")} customised={["accessRates", "deliveryPerTrip", "frameScaffoldPer100Sqft"].some(set)} t={t}>
        <p className="text-xs text-muted-foreground">
          {t("app.paintPreset.accessSource", "Your own day / week / month rates in {currency} win. Blank: Craftsman's {year} rental table in US dollars, sized to the working height and converted at the dated exchange rate.", { currency, year: ACCESS_REFERENCE_YEAR })}
        </p>
        {defaults?.error && <p className="text-xs text-amber-800 dark:text-amber-300">{t("app.paintPreset.defaultsFailed", "Couldn't load FieldQuo's default rates to show beside the boxes. Your own rates still save, and quotes still price from them.")}</p>}
        {defaults?.noRate && <p className="text-xs text-amber-800 dark:text-amber-300">{t("app.paintPreset.noFx", "FieldQuo holds no dated exchange rate to {currency}, so the reference can't be used: until you enter your rates here, access lines on your quotes say they are not priced.", { currency })}</p>}
        {defaults?.converted && defaults.fxText && <p className="text-[11px] text-muted-foreground">{t("app.paintPreset.converted", "Defaults converted {text}.", { text: defaults.fxText })}</p>}
        {ACCESS_KINDS.map((k) => {
          const owned = readPath(ov, `takeoff.accessRates.${k}.owned`) === true;
          const rows = ACCESS_REFERENCE[k].rows;
          return (
            <div key={k} className="rounded border border-border p-2 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{t(`app.planRead.equipment.${k}`, ACCESS_REFERENCE[k].label)}</p>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={owned} onChange={(e) => onSet(`takeoff.accessRates.${k}.owned`, e.target.checked ? true : undefined)} />
                  {t("app.paintPreset.owned", "We own this (no rental)")}
                </label>
              </div>
              {!owned && !rows.length && (
                <>
                  <p className="text-[11px] text-muted-foreground">{t("app.paintPreset.noReference", "No reference rate exists for this — set yours, or quotes say it isn't priced.")}</p>
                  {["day", "week", "month"].map((p) => (
                    <Row key={p} t={t} label={t(`app.paintPreset.period.${p}`, p)} path={`takeoff.accessRates.${k}.${p}`} preset={null} ov={ov} onSet={onSet} step={1} suffix={currency} />
                  ))}
                </>
              )}
              {!owned &&
                rows.map((row) => (
                  <div key={String(row.size)} className="pl-2 border-l border-border space-y-1">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    {["day", "week", "month"].map((p) => (
                      <Row
                        key={p}
                        t={t}
                        label={t(`app.paintPreset.period.${p}`, p)}
                        path={row.size === null ? `takeoff.accessRates.${k}.${p}` : `takeoff.accessRates.${k}.sizes.${row.size}.${p}`}
                        preset={inUse(k, row.size, p)}
                        ov={ov}
                        onSet={onSet}
                        step={1}
                        suffix={currency}
                      />
                    ))}
                  </div>
                ))}
            </div>
          );
        })}
        <Row t={t} label={t("app.paintPreset.delivery", "Delivery or pickup, per trip")} hint={t("app.paintPreset.noCitedFigure", "No cited figure exists — left out until you set yours.")} path="takeoff.deliveryPerTrip" preset={null} ov={ov} onSet={onSet} step={5} suffix={currency} />
        <Row t={t} label={t("app.paintPreset.frameScaffold", "Frame scaffold, erected and dismantled, per 100 sq ft of face")} hint={t("app.paintPreset.noCitedFigure", "No cited figure exists — left out until you set yours.")} path="takeoff.frameScaffoldPer100Sqft" preset={null} ov={ov} onSet={onSet} step={5} suffix={currency} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={readPath(ov, "takeoff.accessDefaultsConfirmed") === true} onChange={(e) => onSet("takeoff.accessDefaultsConfirmed", e.target.checked ? true : undefined)} />
          {t("app.paintPreset.useDefaults", "Use FieldQuo's defaults for anything I haven't set (they show as defaults on every quote)")}
        </label>
      </Section>
    </>
  );
}
