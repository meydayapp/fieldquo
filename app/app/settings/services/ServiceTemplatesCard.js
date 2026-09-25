// app/app/settings/services/ServiceTemplatesCard.js
//
// The estimate template inside each of the trade's services, under the
// trade's card on Settings > Services: the labour, material and other lines
// the service opens with on an estimate, each with its unit price and unit
// cost, the discount it opens with, and a photo — all editable, saved on the
// Product row through the same PATCH /api/products/[id] the price editor and
// ServiceSeedsCard use.
//
// ── Why a second card and not more rows in ServiceSeedsCard ────────────────
//
// ServiceSeedsCard lists the SEEDED services of a trade (by seed key) and
// exists to show the benchmark range beside the company's price. A template
// belongs to any service the company sells under the trade — the cabinet
// add-ons a refinisher created itself, the seeded painting jobs, the four
// rows an electrician typed — so this card lists every Product linked to the
// trade (by category, or by seed-key prefix for a seeded row that predates
// category links) and leaves the seeds card exactly as it was.
//
// ── What is a fact ─────────────────────────────────────────────────────────
//
// Everything here is the company's own row. The totals under a template are
// arithmetic on the lines the company typed (lib/services/templates.js), in
// the company's currency, and the benchmark range beside a seeded service's
// price is the same guideline ServiceSeedsCard shows. Nothing here reaches
// a client-facing surface; the builder integration that expands a template
// onto an estimate is a later pass — this is the editor and the data.
//
// Owner/admin only for the writes (the route refuses anyone else); a reader
// sees the template read-only.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ImagePlus, Loader2, Plus, Ruler, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { uploadFile } from "@/lib/media/uploadClient";
import { formatMoney } from "@/lib/currency";
import { benchmarkForSeedKey } from "@/lib/services/seeds";
import { MEASUREMENT_KEYS as MEASUREMENT_REGISTRY, measurementKeysForTrade } from "@/lib/services/measurementKeys";
import { PAINT_TAKEOFF_CATEGORIES } from "@/lib/pricing/sanitiseRates";
import {
  LINE_KINDS,
  ESTIMATE_TYPE_KEYS,
  sanitiseEstimateTypes,
  COVERAGE_UNITS,
  expandTemplate,
  templateTotals,
  groupLinesByKind,
  sanitiseTemplateLines,
  sanitiseDefaultDiscount,
} from "@/lib/services/templates";
import BenchmarkRange from "@/app/components/pricing/BenchmarkRange";
import AutoTranslateBanner from "@/app/components/settings/AutoTranslateBanner";
import ProductionRateField, {
  productionDraftFrom,
  productionFromDraft,
  formatProductionRate,
  productionMeasureLabel,
} from "@/app/components/pricing/ProductionRateField";
import { defaultProductionKey, sanitiseProduction } from "@/lib/services/productionRates";

const UNITS = ["flat", "each", "hour", "sqft", "linear_ft", "square"];

const whole = (n, currency, language) =>
  n == null ? "" : formatMoney(n, currency, language).replace(/[.,]00(?=\D*$)/, "");

const emptyLine = (kind) => ({ kind, name: "", description: "", qty: 1, unit: kind === "labour" ? "flat" : "each", unitPrice: "", unitCost: "", taxable: true });

/** The editable copy of a product's template — strings in the boxes, never NaN. */
function draftFrom(product) {
  const lines = (Array.isArray(product?.templateLines) ? product.templateLines : []).map((l) => ({
    kind: LINE_KINDS.includes(l.kind) ? l.kind : "other",
    name: l.name || "",
    description: l.description || "",
    qty: l.qty ?? 1,
    unit: l.unit || "each",
    unitPrice: l.unitPrice ?? "",
    unitCost: l.unitCost ?? "",
    taxable: l.taxable !== false,
    measurementKey: l.measurementKey || "",
    wastePct: l.wastePct ?? "",
    coverage: l.coverage && typeof l.coverage === "object" ? l.coverage.per ?? "" : l.coverage ?? "",
    coverageUnit: l.coverage && typeof l.coverage === "object" ? l.coverage.unit || "each" : "each",
    translations: l.translations,
  }));
  const d = product?.defaultDiscount;
  return {
    lines,
    discount: d ? { name: d.name || "", kind: d.kind === "percent" ? "percent" : "fixed", amount: d.amount ?? "" } : { name: "", kind: "fixed", amount: "" },
    imageUrl: product?.imageUrl || null,
    estimateTypes: sanitiseEstimateTypes(product?.estimateTypes),
    // The service's production rate (lib/services/productionRates.js). An
    // empty box opens on the key the template's first labour line measures.
    production: productionDraftFrom(product?.production, defaultProductionKey(product) || ""),
  };
}

/** What the PATCH sends: the sanitiser's view, so the box and the row agree. */
function payloadFrom(draft) {
  return {
    templateLines: sanitiseTemplateLines(draft.lines.map((l) => ({ ...l, measurementKey: l.measurementKey || undefined, wastePct: l.wastePct === "" ? undefined : l.wastePct, coverage: l.coverage === "" ? undefined : { per: l.coverage, unit: l.coverageUnit || "each" }, coverageUnit: undefined }))),
    defaultDiscount: sanitiseDefaultDiscount(draft.discount),
    imageUrl: draft.imageUrl || null,
    estimateTypes: sanitiseEstimateTypes(draft.estimateTypes),
    production: productionFromDraft(draft.production),
  };
}

export default function ServiceTemplatesCard({ category, currency, canEdit, products, productsError, onProductsChange }) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  const mine = useMemo(() => {
    const prefix = `fq.${category.key}.`;
    return (products || [])
      .filter((p) => (p.categories || []).some((c) => c.id === category.id) || (typeof p.seedKey === "string" && p.seedKey.startsWith(prefix)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [products, category.id, category.key]);
  const withTemplate = mine.filter((p) => Array.isArray(p.templateLines) && p.templateLines.length > 0).length;

  useEffect(() => setOpenId(null), [category.id]);

  return (
    <div className="mt-3 border-t border-border pt-3" data-service-templates-card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" data-service-templates-toggle onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-left text-sm font-medium text-foreground">
          {t("app.serviceTemplates.title", "Estimate templates")}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t("app.serviceTemplates.count", { have: withTemplate, total: mine.length })}
          </span>
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("app.serviceTemplates.note", "The labour, material and other lines a service opens with on an estimate, with a unit price and a unit cost on each. Every line stays repriceable on the estimate.")}</p>

      {open && (
        <div className="mt-2 space-y-2">
          {productsError ? (
            <p className="text-xs text-amber-700 dark:text-amber-500">{productsError}</p>
          ) : mine.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("app.serviceTemplates.none", "No services are linked to this trade yet. Add one in Products & Services to give it a template.")}</p>
          ) : (
            mine.map((p) => (
              <TemplateRow
                key={p.id}
                product={p}
                category={category}
                currency={currency}
                language={language}
                canEdit={canEdit}
                expanded={openId === p.id}
                onToggle={() => setOpenId((v) => (v === p.id ? null : p.id))}
                onSaved={onProductsChange}
                t={t}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TemplateRow({ product, category, currency, language, canEdit, expanded, onToggle, onSaved, t }) {
  const lineCount = Array.isArray(product.templateLines) ? product.templateLines.length : 0;
  const totals = useMemo(() => templateTotals(expandTemplate(product, { currency }), product.defaultDiscount), [product, currency]);
  const benchmark = product.seedKey ? benchmarkForSeedKey(product.seedKey) : null;
  const enabled = product.templateEnabled !== false;
  const [toggling, setToggling] = useState(false);
  const [toggleErr, setToggleErr] = useState("");

  // The company's switch: a seeded template it does not sell stays on the
  // row, off, rather than being deleted — the quote builder offers only
  // enabled templates (lib/services/templates.js#templatesFor).
  async function setEnabled(next) {
    setToggling(true);
    setToggleErr("");
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateEnabled: next }),
      });
      if (!res.ok) {
        setToggleErr(await reportResponseError(res));
        return;
      }
      await onSaved?.();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div data-service-template-row className="rounded-md border border-border px-3 py-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          {expanded ? <ChevronDown size={14} className="mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />}
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-foreground break-words">{product.name}</span>
            <span className="block text-[11px] text-muted-foreground">
              {lineCount > 0
                ? t("app.serviceTemplates.rowSummary", { count: lineCount, total: whole(totals.total, currency, language) })
                : t("app.serviceTemplates.rowEmpty", "No template yet — the service is one price.")}
            </span>
            {benchmark && (
              <BenchmarkRange benchmark={benchmark} currency={currency} price={product.unitPrice} compact />
            )}
            {sanitiseProduction(product.production) && (
              <span className="block text-[11px] text-muted-foreground" data-row-production>
                {t("app.production.rowSummary", "Production: {measure} — {rate}", {
                  measure: productionMeasureLabel(product.production.key, t),
                  rate: formatProductionRate(product.production, t),
                })}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
          <div className="text-sm tabular-nums text-foreground sm:text-right">
            {product.unitPrice != null ? (
              <>
                {whole(product.unitPrice, currency, language)}
                {product.unit ? <span className="text-xs text-muted-foreground">{" / "}{t(`app.quoteReview.unit_${product.unit}`, product.unit)}</span> : null}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t("app.serviceSeeds.noPrice")}</span>
            )}
          </div>
          {lineCount > 0 && (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground" data-template-enabled>
              <input type="checkbox" checked={enabled} disabled={!canEdit || toggling} onChange={(e) => setEnabled(e.target.checked)} />
              {enabled ? t("app.serviceTemplates.enabled", "Offered on quotes") : t("app.serviceTemplates.disabled", "Switched off")}
            </label>
          )}
        </div>
      </div>
      {toggleErr && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{toggleErr}</p>}
      {expanded && (
        <TemplateEditor product={product} category={category} currency={currency} language={language} canEdit={canEdit} onSaved={onSaved} t={t} />
      )}
    </div>
  );
}

function TemplateEditor({ product, category, currency, language, canEdit, onSaved, t }) {
  const [draft, setDraft] = useState(() => draftFrom(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  // Line names and descriptions the company typed are drafted into the other
  // languages on save; the route answers what it queued only for new words.
  const [autoTranslate, setAutoTranslate] = useState(null);
  const fileRef = useRef(null);
  // Every trade measures something — a painter's wall sq ft, a stair
  // builder's treads, a roofer's squares — so the picker is offered on every
  // line, from the one registry (lib/services/measurementKeys.js).
  const measureLabel = (k) => t(`app.serviceTemplates.measure_${k}`, MEASUREMENT_REGISTRY[k]?.label || k);
  // The trade's own figures first (lib/services/measurementKeys.js
  // TRADE_MEASUREMENTS), then every other registered key.
  const measureKeys = useMemo(() => measurementKeysForTrade(category.key), [category.key]);

  // A fresh row from the server (after a save elsewhere) resets an untouched draft.
  const dirty = useMemo(() => JSON.stringify(payloadFrom(draft)) !== JSON.stringify(payloadFrom(draftFrom(product))), [draft, product]);
  useEffect(() => {
    if (!dirty) setDraft(draftFrom(product));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const preview = useMemo(() => {
    const payload = payloadFrom(draft);
    const lines = expandTemplate({ templateLines: payload.templateLines }, { currency });
    return { lines, totals: templateTotals(lines, payload.defaultDiscount) };
  }, [draft, currency]);
  const groups = groupLinesByKind(draft.lines.map((l, i) => ({ ...l, _i: i })));

  const setLine = (i, patch) => setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const addLine = (kind) => setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine(kind)] }));
  const removeLine = (i) => setDraft((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFrom(draft)),
      });
      if (!res.ok) {
        setMsg({ text: await reportResponseError(res), error: true });
        return;
      }
      const answer = await res.json().catch(() => null);
      setAutoTranslate(answer?.autoTranslate || null);
      setMsg({ text: t("app.serviceTemplates.saved", "Template saved.") });
      await onSaved?.();
    } catch (err) {
      setMsg({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const data = await uploadFile(file, { purpose: "quotes" });
      setDraft((d) => ({ ...d, imageUrl: data.url }));
    } catch (err) {
      setMsg({ text: err.message, error: true });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const input = "w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60";
  const num = `${input} tabular-nums`;

  return (
    <div className="mt-2 space-y-3 border-t border-border pt-2" data-service-template-editor>
      {/* Photo */}
      <div className="flex items-center gap-3">
        {draft.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.imageUrl} alt="" className="h-14 w-14 rounded object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-border text-muted-foreground">
            <ImagePlus size={16} />
          </div>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="rounded border border-border px-2 py-1 font-medium text-foreground hover:bg-accent disabled:opacity-50">
              {uploading ? <Loader2 size={12} className="inline animate-spin" /> : draft.imageUrl ? t("app.serviceTemplates.replacePhoto", "Replace photo") : t("app.serviceTemplates.addPhoto", "Add photo")}
            </button>
            {draft.imageUrl && (
              <button type="button" onClick={() => setDraft((d) => ({ ...d, imageUrl: null }))} className="text-muted-foreground hover:text-foreground">
                {t("app.serviceTemplates.removePhoto", "Remove photo")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lines, by kind */}
      {LINE_KINDS.map((kind) => (
        <div key={kind} data-template-group={kind}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`app.serviceTemplates.kind_${kind}`)}</h4>
            {canEdit && (
              <button type="button" onClick={() => addLine(kind)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <Plus size={12} /> {t("app.serviceTemplates.addLine", "Add line")}
              </button>
            )}
          </div>
          {groups[kind].length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{t("app.serviceTemplates.noLines", "No lines.")}</p>
          ) : (
            <div className="mt-1 space-y-2">
              {groups[kind].map((l) => (
                <div key={l._i} data-template-line className="rounded border border-border/60 p-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                    <div className="col-span-2 sm:col-span-5">
                      <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.lineName", "Line")}</label>
                      <input className={input} value={l.name} disabled={!canEdit} onChange={(e) => setLine(l._i, { name: e.target.value })} placeholder={t("app.serviceTemplates.lineNamePlaceholder", "What is done, or what is supplied")} />
                      {l.measurementKey && (
                        <span data-measurement-chip className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                          <Ruler size={11} />
                          {t("app.serviceTemplates.qtyFrom", { measure: measureLabel(l.measurementKey) })}
                          {l.kind === "material" && l.wastePct ? ` +${l.wastePct}%` : ""}
                        </span>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.qty", "Qty")}</label>
                      {/* Editable even when a measurement fills it: this qty is what the
                          estimate opens with when the takeoff has no figure yet. */}
                      <input className={num} type="number" min="0" step="any" value={l.qty} disabled={!canEdit} onChange={(e) => setLine(l._i, { qty: e.target.value })} title={l.measurementKey ? t("app.serviceTemplates.qtyFallback", "Used until the takeoff supplies the figure") : undefined} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.unit", "Unit")}</label>
                      <input className={input} list={`tpl-units-${product.id}`} value={l.unit} disabled={!canEdit} onChange={(e) => setLine(l._i, { unit: e.target.value })} />
                    </div>
                    <div className="sm:col-span-3 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.unitPrice", "Unit price")}</label>
                        <input className={num} type="number" min="0" step="0.01" value={l.unitPrice} disabled={!canEdit} onChange={(e) => setLine(l._i, { unitPrice: e.target.value })} />
                      </div>
                      {canEdit && (
                        <button type="button" onClick={() => removeLine(l._i)} aria-label={t("app.serviceTemplates.removeLine", "Remove line")} className="mb-1 text-muted-foreground hover:text-foreground">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="col-span-2 sm:col-span-5">
                      <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.lineDescription", "Description")}</label>
                      <input className={input} value={l.description} disabled={!canEdit} onChange={(e) => setLine(l._i, { description: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.unitCost", "Unit cost")}</label>
                      <input className={num} type="number" min="0" step="0.01" value={l.unitCost} disabled={!canEdit} onChange={(e) => setLine(l._i, { unitCost: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                      <label className="flex items-center gap-1 pb-1 text-xs text-foreground">
                        <input type="checkbox" checked={l.taxable} disabled={!canEdit} onChange={(e) => setLine(l._i, { taxable: e.target.checked })} />
                        {t("app.serviceTemplates.taxable", "Taxable")}
                      </label>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-muted-foreground">{t("app.serviceTemplates.measurement", "Qty from the takeoff")}</label>
                      <div className="flex gap-1">
                        <select className={input} value={l.measurementKey} disabled={!canEdit} onChange={(e) => setLine(l._i, { measurementKey: e.target.value })}>
                          <option value="">{t("app.serviceTemplates.measurementNone", "Typed qty")}</option>
                          {measureKeys.map((k) => (
                            <option key={k} value={k}>{measureLabel(k)}</option>
                          ))}
                        </select>
                        {/* Waste is a material modifier — an extra 10 % of
                            shingles is real, an extra 10 % of labour is not —
                            so the box is offered on material lines only. */}
                        {l.measurementKey && l.kind === "material" && (
                          <input className={`${num} w-20`} type="number" min="0" max="50" step="0.5" value={l.wastePct} disabled={!canEdit} onChange={(e) => setLine(l._i, { wastePct: e.target.value })} placeholder={t("app.serviceTemplates.wastePct", "Waste %")} title={t("app.serviceTemplates.wastePct", "Waste %")} />
                        )}
                        {/* How much of the figure one unit covers — 32 sq ft per
                            drywall sheet, 8 ft per fence post. Blank = 1. */}
                        {l.measurementKey && l.kind === "material" && (
                          <>
                            <input className={`${num} w-20`} type="number" min="0" step="any" value={l.coverage} disabled={!canEdit} onChange={(e) => setLine(l._i, { coverage: e.target.value })} placeholder={t("app.serviceTemplates.coverage", "Per unit")} title={t("app.serviceTemplates.coverageHint", "How much of the measurement one unit covers, e.g. 32 sq ft per sheet. Blank = 1.")} />
                            {l.coverage !== "" && (
                              <select className={`${input} w-20`} value={l.coverageUnit} disabled={!canEdit} onChange={(e) => setLine(l._i, { coverageUnit: e.target.value })} aria-label={t("app.serviceTemplates.coverage", "Per unit")}>
                                {COVERAGE_UNITS.map((u) => (
                                  <option key={u} value={u}>{t(`app.serviceTemplates.coverageUnit_${u}`, u)}</option>
                                ))}
                              </select>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <datalist id={`tpl-units-${product.id}`}>
        {UNITS.map((u) => (
          <option key={u} value={u}>{t(`app.quoteReview.unit_${u}`, u)}</option>
        ))}
      </datalist>

      {/* Where the template is offered: painting's estimate types. Every
          other quote type has no sub-types, so the box is not drawn — an
          empty list means "every estimate type" and that is the default. */}
      {PAINT_TAKEOFF_CATEGORIES.includes(category.key) && (
        <div data-template-estimate-types>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.serviceTemplates.estimateTypes", "Offered on these estimate types")}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("app.serviceTemplates.estimateTypesNote", "None ticked = every estimate type of this quote type.")}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {ESTIMATE_TYPE_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-1 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={draft.estimateTypes.includes(k)}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, estimateTypes: e.target.checked ? [...d.estimateTypes, k] : d.estimateTypes.filter((x) => x !== k) }))}
                />
                {t(`app.paint.type.${k}`, k)}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* How fast the crew does this service — the quote's crew hours, its
          labour cost and the job plan read it (lib/services/productionRates.js). */}
      <ProductionRateField
        draft={draft.production}
        onChange={(production) => setDraft((d) => ({ ...d, production }))}
        tradeKeys={[category.key]}
        disabled={!canEdit}
        t={t}
      />

      {/* Default discount */}
      <div data-template-discount>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.serviceTemplates.discount", "Default discount")}</h4>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-12">
          <div className="col-span-2 sm:col-span-6">
            <input className={input} value={draft.discount.name} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, discount: { ...d.discount, name: e.target.value } }))} placeholder={t("app.serviceTemplates.discountName", "Discount name, e.g. New customer discount")} />
          </div>
          <div className="sm:col-span-3">
            <select className={input} value={draft.discount.kind} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, discount: { ...d.discount, kind: e.target.value } }))}>
              <option value="fixed">{t("app.serviceTemplates.discountFixed", "Fixed amount")}</option>
              <option value="percent">{t("app.serviceTemplates.discountPercent", "Percent")}</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <input className={num} type="number" min="0" step="0.01" value={draft.discount.amount} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, discount: { ...d.discount, amount: e.target.value } }))} placeholder={draft.discount.kind === "percent" ? "%" : currency} />
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-template-totals>
        <span>{t("app.serviceTemplates.subtotal", "Subtotal")}: <span className="font-medium text-foreground">{whole(preview.totals.subtotal, currency, language) || "—"}</span></span>
        {preview.totals.discountAmount > 0 && (
          <span>{t("app.serviceTemplates.discountLabel", "Discount")}: <span className="font-medium text-foreground">−{whole(preview.totals.discountAmount, currency, language)}</span></span>
        )}
        <span>{t("app.serviceTemplates.total", "Total")}: <span className="font-medium text-foreground">{whole(preview.totals.total, currency, language) || "—"}</span></span>
        <span>{t("app.serviceTemplates.cost", "Cost")}: <span className="font-medium text-foreground">{whole(preview.totals.cost, currency, language) || "—"}</span></span>
        {preview.totals.margin != null && (
          <span>{t("app.serviceTemplates.margin", "Margin")}: <span className="font-medium text-foreground">{preview.totals.margin}%</span></span>
        )}
        {preview.totals.unpriced > 0 && (
          <span className="text-amber-700 dark:text-amber-500">{t("app.serviceTemplates.unpriced", { count: preview.totals.unpriced })}</span>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={saving || !dirty} className="rounded-lg bg-inverted px-3 py-1.5 text-xs font-semibold text-inverted-foreground disabled:opacity-50">
            {saving ? <Loader2 size={12} className="inline animate-spin" /> : t("app.serviceTemplates.save", "Save template")}
          </button>
          {dirty && (
            <button type="button" onClick={() => setDraft(draftFrom(product))} disabled={saving} className="text-xs text-muted-foreground hover:text-foreground">
              {t("app.serviceTemplates.discard", "Discard changes")}
            </button>
          )}
          {msg && <span className={`text-xs ${msg.error ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{msg.text}</span>}
        </div>
      )}
      <AutoTranslateBanner result={autoTranslate} id={autoTranslate?.id} />
    </div>
  );
}
