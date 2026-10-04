// app/components/quotes/builder/CustomItemDialog.js
//
// "Create custom item" — the button in the Add service dialog that the owner's
// reference window had and this one left out until there was a real add
// behind it (AddServicePicker.js explains the wait).
//
// The owner (2026-10-03): "custom item should be based on the current estimate
// so they pick one service and based on what we have the custom line item
// makes sense." So the dialog asks, first, which of the estimate's services
// the item belongs to (skipped when there is one), and then offers THAT
// service's units — per door on cabinets, per sq ft of wall on an interior,
// per tread on stairs, plus each, hour and lump sum — with the quantity
// opening on the figure the service's own calculator already measured.
//
// Every rule lives in lib/quotes/customItem.js (executed by
// scripts/check-custom-item.mjs); this file is the boxes. What it adds is the
// builder's own: `customItem.add(tempId, line)` appends the line to that
// group's typed lines, the same place the line-item library's text blocks
// land (QuoteBuilder addLibraryLine), so the save, the PDF, the client's page,
// the invoice and the Cost & margin panel read it as they read any line.
//
// "Save to price book" writes a Product through POST /api/products — the
// route Settings › Products & Services uses, owner/admin only — linked to the
// service's quote type. Offered only where it can work: to someone the route
// would let write, on a quote in the company's own language (a price book row
// is written in the company's language; a French line saved from an English
// company's French quote would become an English row in French), and only
// with a price above zero (a $0 row would be offered as a free item next
// time). Both failures are said, not swallowed: a refused save adds nothing,
// because the contractor asked for two things.
"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowLeft, Loader2, Plus } from "lucide-react";
import StepDialog from "@/app/components/dashboard/StepDialog";
import BottomSheet from "@/app/components/mobile/BottomSheet";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { buildCustomLine, openingQuantity, priceBookBody } from "@/lib/quotes/customItem";
import { measureLabel, calcLabel } from "./templateLineNotes";

const WIDE_QUERY = "(min-width: 640px)";
function subscribeWide(onChange) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => Boolean(typeof window !== "undefined" && window.matchMedia?.(WIDE_QUERY).matches),
    () => false,
  );
}

const inputClass =
  "w-full min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/** The words for a unit option, in the member's language. */
export function unitOptionLabel(t, option, fmt = (n) => String(n)) {
  const unitWord = (u) =>
    u === "each"
      ? t("app.customItem.unitEach", "Each")
      : u === "hour"
        ? t("app.customItem.unitHour", "Hour")
        : u === "flat"
          ? t("app.customItem.unitFlat", "Lump sum")
          : t(`app.quoteReview.unit_${u}`, u);
  if (!option.measurementKey) return unitWord(option.unit);
  const base = `${measureLabel(t, option.measurementKey)} (${unitWord(option.unit)})`;
  return typeof option.figure === "number" && option.figure > 0
    ? t("app.customItem.unitWithFigure", "{unit} — {figure} on this section", { unit: base, figure: fmt(option.figure) })
    : base;
}

/**
 * @param customItem  { targets, unitsFor(tempId), hourlyRateFor(tempId),
 *                      showPricing, currency, canSaveToBook, bookLanguageOk,
 *                      add(tempId, line), onSavedProduct?(product) }
 * @param onClose
 */
export default function CustomItemDialog({ customItem, onClose }) {
  const { t, language } = useTranslation();
  const wide = useWide();
  const firstRef = useRef(null);
  const targets = Array.isArray(customItem?.targets) ? customItem.targets : [];
  const [tempId, setTempId] = useState(targets.length === 1 ? targets[0].tempId : null);
  const target = targets.find((x) => x.tempId === tempId) || null;
  const units = useMemo(() => (tempId ? customItem.unitsFor(tempId) : []), [customItem, tempId]);
  const showPricing = customItem?.showPricing !== false;
  const fmt = (n) => Number(n).toLocaleString(language || "en", { maximumFractionDigits: 2 });
  const money = (n) => formatAppMoney(n, customItem?.currency || null, language);

  const [values, setValues] = useState({ description: "", detail: "", unitId: "", quantity: "", rate: "", unitCost: "" });
  const [saveToBook, setSaveToBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The first unit opens selected — the service's own measured unit when it
  // has one — and its figure in the quantity box.
  const unitId = values.unitId && units.some((u) => u.id === values.unitId) ? values.unitId : units[0]?.id || "";
  const option = units.find((u) => u.id === unitId) || null;
  const quantity = values.unitId ? values.quantity : values.quantity === "" ? openingQuantity(option) : values.quantity;

  function pickUnit(id) {
    const next = units.find((u) => u.id === id);
    const patch = { unitId: id };
    if (next) {
      const opening = openingQuantity(next);
      if (opening !== "") patch.quantity = opening;
      else if (next.unit === "flat") patch.quantity = 1;
      if (next.unit === "hour" && values.rate === "") {
        const hourly = customItem.hourlyRateFor?.(tempId);
        if (hourly != null && hourly > 0) patch.rate = hourly;
      }
    }
    setValues((v) => ({ ...v, ...patch, ...(patch.quantity === undefined ? { quantity: v.quantity === "" ? quantity : v.quantity } : {}) }));
  }

  const lineTotal = (() => {
    const q = Number(String(quantity).replace(/[,\s]/g, ""));
    const r = Number(String(values.rate).replace(/[,\s]/g, ""));
    return Number.isFinite(q) && Number.isFinite(r) ? Math.round(q * r * 100) / 100 : 0;
  })();
  const bookOffered = showPricing && customItem?.canSaveToBook === true;

  async function add() {
    setError("");
    const built = buildCustomLine(
      { ...values, unitId, quantity },
      { units, categoryKey: target?.categoryKey || null, showPricing },
    );
    if (!built.ok) {
      setError(t(`app.customItem.error_${built.reason}`, built.error));
      return;
    }
    let line = built.line;
    if (bookOffered && saveToBook && customItem.bookLanguageOk) {
      const body = priceBookBody(line, { categoryId: target?.categoryId || null });
      if (!body) {
        setError(t("app.customItem.bookNeedsPrice", "Give it a unit price above zero to save it to your price book."));
        return;
      }
      setBusy(true);
      try {
        const product = await fetchJson("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (product?.id) {
          line = { ...line, productId: String(product.id) };
          customItem.onSavedProduct?.(product);
        }
      } catch (err) {
        setBusy(false);
        setError(err?.message || t("app.customItem.bookFailed", "Couldn't save it to your price book, so nothing was added. Try again, or untick Save to price book."));
        return;
      }
      setBusy(false);
    }
    customItem.add(tempId, line);
    onClose();
  }

  const title = t("app.customItem.title", "Create custom item");
  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
        data-custom-item-cancel
      >
        {t("app.action.cancel", "Cancel")}
      </button>
      {target && (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          data-custom-item-add
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          {t("app.customItem.add", "Add to {service}", { service: target.label })}
        </button>
      )}
    </div>
  );

  const body = !target ? (
    <div className="space-y-3" data-custom-item-targets>
      <p className="text-sm text-muted-foreground">
        {t("app.customItem.pickService", "Which service on this estimate is it part of? It uses that service's units.")}
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {targets.map((x, i) => (
          <li key={x.tempId}>
            <button
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => setTempId(x.tempId)}
              className="relative flex w-full min-h-12 flex-col items-start overflow-hidden rounded-lg border border-border bg-card py-2.5 pl-4 pr-3 text-left text-sm font-medium text-foreground shadow-sm hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-custom-item-target={x.tempId}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
              <span className="truncate">{x.label}</span>
              {x.categoryLabel && x.categoryLabel !== x.label ? (
                <span className="text-xs font-normal text-muted-foreground truncate">{x.categoryLabel}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div className="space-y-4" data-custom-item-form>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("app.customItem.inService", "Part of {service}", { service: target.label })}
        </p>
        {targets.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setTempId(null);
              setValues((v) => ({ ...v, unitId: "", quantity: "" }));
              setError("");
            }}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            data-custom-item-change-service
          >
            <ArrowLeft size={13} aria-hidden="true" />
            {t("app.customItem.changeService", "Another service")}
          </button>
        )}
      </div>

      <label className="block text-xs font-medium text-muted-foreground">
        {t("app.customItem.description", "Description")}
        <input
          ref={firstRef}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          placeholder={t("app.customItem.descriptionPlaceholder", "What the client reads on the line")}
          maxLength={160}
          className={`${inputClass} mt-1`}
          data-custom-item-description
        />
      </label>

      <label className="block text-xs font-medium text-muted-foreground">
        {t("app.customItem.detail", "Details (optional)")}
        <textarea
          value={values.detail}
          onChange={(e) => setValues({ ...values, detail: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-custom-item-detail
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-muted-foreground">
          {t("app.customItem.unit", "Unit")}
          <select
            value={unitId}
            onChange={(e) => pickUnit(e.target.value)}
            className={`${inputClass} mt-1`}
            data-custom-item-unit
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {unitOptionLabel(t, u, fmt)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          {t("app.customItem.quantity", "Quantity")}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setValues({ ...values, unitId, quantity: e.target.value })}
            className={`${inputClass} mt-1`}
            data-custom-item-quantity
          />
        </label>
      </div>

      {option?.measurementKey ? (
        <p className="text-xs text-muted-foreground" data-custom-item-figure>
          {typeof option.figure === "number" && option.figure > 0
            ? t("app.customItem.figureFrom", "From the {calc}: {figure} on this section. Change it if this item covers only part of it.", {
                calc: calcLabel(t, option.calc),
                figure: fmt(option.figure),
              })
            : t("app.customItem.figureMissing", "Nothing on this section has measured {measure} yet — type the quantity.", {
                measure: measureLabel(t, option.measurementKey),
              })}
        </p>
      ) : null}
      {option?.pricedByCalculator ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-400" data-custom-item-overlap>
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t("app.customItem.overlap", "The {calc} already prices {measure} on this section. This line is charged on top of it — use it for extra work, not the same work again.", {
              calc: calcLabel(t, option.pricedBy),
              measure: measureLabel(t, option.measurementKey),
            })}
          </span>
        </p>
      ) : null}

      {showPricing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-muted-foreground">
            {t("app.customItem.unitPrice", "Unit price")}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.rate}
              onChange={(e) => setValues({ ...values, unitId, quantity, rate: e.target.value })}
              className={`${inputClass} mt-1`}
              data-custom-item-rate
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            {t("app.customItem.unitCost", "Unit cost (optional)")}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.unitCost}
              onChange={(e) => setValues({ ...values, unitId, quantity, unitCost: e.target.value })}
              className={`${inputClass} mt-1`}
              data-custom-item-cost
            />
          </label>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("app.customItem.lineTotal", "Line total")}</p>
            <p className="min-h-11 py-2.5 text-sm font-semibold tabular-nums text-foreground" data-custom-item-total>
              {money(lineTotal)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground" data-custom-item-unpriced>
          {t("app.customItem.unpriced", "Your access level doesn't show prices, so this line is added without one for someone who can to price.")}
        </p>
      )}

      <p className="text-xs text-muted-foreground" data-custom-item-tax>
        {t("app.customItem.taxNote", "Taxed with the rest of the quote, like this section's other lines. The unit cost is only for your margin — the client never sees it.")}
      </p>

      {bookOffered &&
        (customItem.bookLanguageOk ? (
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={saveToBook}
              onChange={(e) => setSaveToBook(e.target.checked)}
              data-custom-item-save-book
            />
            <span>
              {t("app.customItem.saveToBook", "Save to price book")}
              <span className="block text-xs text-muted-foreground">
                {t("app.customItem.saveToBookHint", "Adds it to Products & Services under {service}, at this price and unit, so the next quote can pick it.", {
                  service: target.categoryLabel || target.label,
                })}
              </span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground" data-custom-item-book-language>
            {t("app.customItem.bookLanguage", "Save to price book is offered on quotes in your company's own language — your price book is written in it.")}
          </p>
        ))}

      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400" role="alert" data-custom-item-error>
          <AlertCircle size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}
    </div>
  );

  if (wide) {
    return (
      <StepDialog open id="custom-item" title={title} onClose={onClose} footer={footer} initialFocusRef={firstRef}>
        {body}
      </StepDialog>
    );
  }
  return (
    <BottomSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      footer={footer}
    >
      {body}
    </BottomSheet>
  );
}
