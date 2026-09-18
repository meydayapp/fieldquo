// app/app/settings/instant-quotes/LawnCareEditor.js
//
// The lawn-care card: programs, the services each includes, and add-ons —
// every one priced as a base for the minimum lawn size plus a step per
// further 1,000 sq ft (lib/estimate/lawnCare.js). Rendered by TradeCard on
// the instant-quotes settings screen for the `lawn_care` trade, in its own
// file because that screen is already eighteen hundred lines and this card
// is a form of its own.
//
// Text is per language. A program name is part of the document a client
// signs, and a document keeps its language (non-negotiable 6), so the owner
// writes each language rather than FieldQuo translating at send time. One
// language is edited at a time (the tabs at the top); an item with nothing
// in the language being viewed shows its English so the owner can see what
// they are translating.
"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { LAWN_MIN_SQFT_DEFAULT, LAWN_INCREMENT_SQFT } from "@/lib/estimate/lawnCare";

const LANGS = [
  ["en", "EN"],
  ["fr", "FR"],
  ["es", "ES"],
];

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `item_${Date.now().toString(36)}`;

function textOf(field, lang) {
  if (typeof field === "string") return field;
  return field?.[lang] ?? "";
}
function withText(field, lang, value) {
  const base = typeof field === "string" ? { en: field } : { ...(field || {}) };
  base[lang] = value;
  return base;
}

function TextRow({ label, value, placeholder, onChange, multiline = false }) {
  const cls = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}

function PriceRow({ currency, item, onChange, t }) {
  const numOrEmpty = (v) => (v === "" ? "" : Number(v));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-[11px] text-muted-foreground">{t("app.setInstantQuotes.lawn.base", "Price at minimum size")}</span>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">{currency}</span>
          <input
            type="number"
            step="0.01"
            value={item.base ?? ""}
            onChange={(e) => onChange({ base: numOrEmpty(e.target.value) })}
            className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </label>
      <label className="block">
        <span className="text-[11px] text-muted-foreground">
          {t("app.setInstantQuotes.lawn.perThousand", "+ per extra {n} sq ft", { n: LAWN_INCREMENT_SQFT.toLocaleString() })}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">{currency}</span>
          <input
            type="number"
            step="0.01"
            value={item.perThousand ?? ""}
            onChange={(e) => onChange({ perThousand: numOrEmpty(e.target.value) })}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </label>
    </div>
  );
}

function ItemFields({ item, lang, onChange, t, currency, priced = true }) {
  const en = (f) => (lang !== "en" && !textOf(item[f], lang) ? textOf(item[f], "en") : "");
  return (
    <div className="space-y-2">
      <TextRow
        label={t("app.setInstantQuotes.lawn.name", "Name")}
        value={textOf(item.name, lang)}
        placeholder={en("name")}
        onChange={(v) => onChange({ name: withText(item.name, lang, v) })}
      />
      <TextRow
        label={t("app.setInstantQuotes.lawn.description", "Description")}
        value={textOf(item.description, lang)}
        placeholder={en("description")}
        onChange={(v) => onChange({ description: withText(item.description, lang, v) })}
        multiline
      />
      <TextRow
        label={t("app.setInstantQuotes.lawn.window", "Season window (e.g. September – October)")}
        value={textOf(item.window, lang)}
        placeholder={en("window")}
        onChange={(v) => onChange({ window: withText(item.window, lang, v) })}
      />
      {priced && <PriceRow currency={currency} item={item} onChange={onChange} t={t} />}
    </div>
  );
}

/**
 * @param {object}   p.config   the trade's config (programs, addOns, minSqft)
 * @param {Function} p.patch    (partial) → merges into the config
 * @param {string}   p.currency
 * @param {boolean}  p.isDefaults  the seed, not the company's saved row
 */
export default function LawnCareEditor({ config, patch, currency, isDefaults }) {
  const { t } = useTranslation();
  const [lang, setLang] = useState("en");
  const programs = Array.isArray(config.programs) ? config.programs : [];
  const addOns = Array.isArray(config.addOns) ? config.addOns : [];

  const setProgram = (i, next) => {
    const list = [...programs];
    list[i] = { ...list[i], ...next };
    patch({ programs: list });
  };
  const setService = (pi, si, next) => {
    const services = [...(programs[pi].services || [])];
    services[si] = { ...services[si], ...next };
    setProgram(pi, { services });
  };
  const setAddOn = (i, next) => {
    const list = [...addOns];
    list[i] = { ...list[i], ...next };
    patch({ addOns: list });
  };

  const sumProgram = (p) => (p.services || []).reduce((s, x) => s + (Number(x.base) || 0), 0);

  return (
    <div className="space-y-5">
      {isDefaults && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t(
            "app.setInstantQuotes.lawn.seedNote",
            "These are typical figures observed in Ottawa/Gatineau in 2026, not your prices — the per-1,000 sq ft step in particular is a starting guess. Edit them and save.",
          )}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-[11px] text-muted-foreground">
            {t("app.setInstantQuotes.lawn.minSqft", "Minimum lawn size (priced as at least this)")}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="100"
              value={config.minSqft ?? LAWN_MIN_SQFT_DEFAULT}
              onChange={(e) => patch({ minSqft: e.target.value === "" ? "" : Number(e.target.value) })}
              className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-muted-foreground">sq ft</span>
          </div>
        </label>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {LANGS.map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${lang === code ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
          <span className="pl-1 pr-2 text-[11px] text-muted-foreground">{t("app.setInstantQuotes.lawn.editingLang", "text language")}</span>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-foreground mb-1">{t("app.setInstantQuotes.lawn.programs", "Programs")}</div>
        <p className="text-xs text-muted-foreground mb-2">
          {t(
            "app.setInstantQuotes.lawn.programsHint",
            "A program's price is the sum of the services it includes. The cheapest program per service is marked \"Best value\" on the public page.",
          )}
        </p>
        <div className="space-y-3">
          {programs.map((p, pi) => (
            <div key={p.key || pi} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {t("app.setInstantQuotes.lawn.programTotal", "Program total at minimum size")}: <strong className="text-foreground">{currency} {sumProgram(p).toFixed(2)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => patch({ programs: programs.filter((_, j) => j !== pi) })}
                  className="text-muted-foreground hover:text-red-600 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  aria-label={t("app.setInstantQuotes.lawn.removeProgram", "Remove program")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <ItemFields item={p} lang={lang} onChange={(n) => setProgram(pi, n)} t={t} currency={currency} priced={false} />
              <div className="pl-3 border-l-2 border-border space-y-3">
                <div className="text-xs font-medium text-foreground">{t("app.setInstantQuotes.lawn.included", "Included services")}</div>
                {(p.services || []).map((s, si) => (
                  <div key={s.key || si} className="rounded-md bg-muted/40 p-2 space-y-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setProgram(pi, { services: p.services.filter((_, j) => j !== si) })}
                        className="text-muted-foreground hover:text-red-600 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> {t("app.action.remove", "Remove")}
                      </button>
                    </div>
                    <ItemFields item={s} lang={lang} onChange={(n) => setService(pi, si, n)} t={t} currency={currency} />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProgram(pi, {
                      services: [...(p.services || []), { key: slug(`svc_${(p.services || []).length}_${Date.now()}`), name: {}, description: {}, window: {}, base: "", perThousand: "" }],
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus size={13} /> {t("app.setInstantQuotes.lawn.addService", "Add an included service")}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => patch({ programs: [...programs, { key: slug(`program_${programs.length}_${Date.now()}`), name: {}, description: {}, window: {}, services: [] }] })}
          className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} /> {t("app.setInstantQuotes.lawn.addProgram", "Add a program")}
        </button>
      </div>

      <div>
        <div className="text-sm font-medium text-foreground mb-1">{t("app.setInstantQuotes.lawn.addOns", "Add-ons")}</div>
        <p className="text-xs text-muted-foreground mb-2">
          {t("app.setInstantQuotes.lawn.addOnsHint", "Ticked by the homeowner beside a program. A service is a one-off treatment; a program is its own seasonal bundle.")}
        </p>
        <div className="space-y-3">
          {addOns.map((a, i) => (
            <div key={a.key || i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={a.kind === "program" ? "program" : "service"}
                  onChange={(e) => setAddOn(i, { kind: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="service">{t("app.setInstantQuotes.lawn.kindService", "Add-on service")}</option>
                  <option value="program">{t("app.setInstantQuotes.lawn.kindProgram", "Add-on program")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => patch({ addOns: addOns.filter((_, j) => j !== i) })}
                  className="text-muted-foreground hover:text-red-600 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  aria-label={t("app.setInstantQuotes.lawn.removeAddOn", "Remove add-on")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <ItemFields item={a} lang={lang} onChange={(n) => setAddOn(i, n)} t={t} currency={currency} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => patch({ addOns: [...addOns, { key: slug(`addon_${addOns.length}_${Date.now()}`), kind: "service", name: {}, description: {}, window: {}, base: "", perThousand: "" }] })}
          className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus size={14} /> {t("app.setInstantQuotes.lawn.addAddOn", "Add an add-on")}
        </button>
      </div>
    </div>
  );
}
