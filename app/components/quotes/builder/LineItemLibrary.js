// app/components/quotes/builder/LineItemLibrary.js
//
// "+ Add area or line item": one searchable dialog for everything a line can
// come from — the company's text-block library, the trade's habitual extras
// ("common for this trade", app/data/defaultLineItems.js), the products
// catalogue, and a custom item written on the spot.
//
// ── Why one dialog and not three buttons ────────────────────────────────────
//
// The words a painter repeats lived in five places, none of them named,
// searchable or priced (mockup b5). The trade chips and the products select
// were two of those places on this very table; folding them into the library
// leaves one list to search and one way to add, and the chips' catalogue is
// still the source — it is a section here, not a copy.
//
// ── Language ────────────────────────────────────────────────────────────────
//
// A block is written in one language (QuoteTextBlock.language). Opening it
// for a quote in another resolves the stored translation, or — when there is
// none — asks POST /api/quote-text-blocks/[id]/translate for a DRAFT, shows
// it in the editor marked as machine-written, and stores it on the block
// only when the estimator presses "Add to quote" with the draft in front of
// them. Once stored it is never drafted again. The line that lands on the
// quote carries the text the estimator saw; nothing is translated at send
// time (non-negotiable #6).
//
// ── Money ───────────────────────────────────────────────────────────────────
//
// The dialog prices with the block's own stored rate, the trade's hourly
// rate, or what the estimator types; the line's amount is computed by
// lib/quotes/textBlocks.js priceTextBlock and stored as the line's amount —
// exactly as a typed line is. A member without showPricing sees no price
// controls at all: the block lands unpriced, and the numbers are somebody
// else's to add.
//
// ── Areas ───────────────────────────────────────────────────────────────────
//
// The mockup's "Areas" section (Room, Surface) belongs to the painting
// takeoff and renders only when the takeoff hands this dialog an `areas`
// list with an `onAddArea`; without one, the section is absent rather than
// a heading over nothing.
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search, Plus, Loader2, AlertCircle, Sparkles, Save } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { getDefaultLineItems } from "@/app/data/defaultLineItems";
import { formatAppMoney } from "@/lib/format/money";
import { LANGUAGES } from "@/app/i18n/languages";
import {
  PRICE_MODES,
  resolveTextBlockText,
  lineFromTextBlock,
  priceTextBlock,
  textBlockChip,
  matchesTextBlockQuery,
} from "@/lib/quotes/textBlocks";
import RichTextEditor from "./RichTextEditor";

const inputClass = "w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground";

const CHIP_KEYS = {
  quantity: "app.textBlocks.chipQuantity",
  hourly: "app.textBlocks.chipHourly",
  text: "app.textBlocks.chipText",
  scope: "app.textBlocks.chipScope",
};

function languageName(code) {
  return LANGUAGES.find((l) => l.code === code)?.nativeName || code;
}

/** The editor's initial state for a block (or a blank custom item). */
function draftFrom(block, text, { hourlyRate }) {
  const mode = block?.priceMode || "none";
  return {
    name: text?.name ?? block?.name ?? "",
    body: text?.body ?? block?.body ?? "",
    priceMode: mode,
    hiddenOnWorkOrder: block?.hiddenOnWorkOrder === true,
    unit: block?.unit || (mode === "quantity" ? "sqft" : ""),
    quantity: mode === "hourly" || mode === "quantity" ? "" : 1,
    rate:
      mode === "hourly"
        ? block?.price ?? hourlyRate ?? ""
        : mode === "quantity"
          ? block?.price ?? ""
          : "",
    amount: mode === "custom" ? block?.price ?? "" : "",
  };
}

export default function LineItemLibrary({
  open,
  onClose,
  categoryKey,
  products = [],
  existingDescriptions = [],
  documentLanguage = "en",
  currency = null,
  hourlyRate = null,
  showPricing = true,
  areas = null,
  onAddArea = null,
  onAddLine,
  onAddSuggested,
  onAddProduct,
}) {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState("");
  const [blocks, setBlocks] = useState(null);
  const [loadError, setLoadError] = useState("");
  // null = browsing; { block, text, translation } = the editor is open on a
  // block (block null for a custom item).
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationNote, setTranslationNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const money = (n) => formatAppMoney(n, currency, language);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError("");
    fetchJson("/api/quote-text-blocks")
      .then((rows) => {
        if (!cancelled) setBlocks(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setBlocks([]);
          setLoadError(err.message || t("app.textBlocks.loadError", "Couldn't load the library."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  // Reset when closed so the next open starts on the list.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setEditing(null);
    setDraft(null);
    setSaveToLibrary(false);
    setTranslationNote("");
    setError("");
  }, [open]);

  const present = useMemo(
    () => new Set(existingDescriptions.map((d) => String(d || "").trim().toLowerCase())),
    [existingDescriptions],
  );
  const q = query.trim().toLowerCase();

  const libraryRows = useMemo(
    () => (blocks || []).filter((b) => matchesTextBlockQuery(b, q)),
    [blocks, q],
  );
  const suggestions = useMemo(() => {
    const all = getDefaultLineItems(categoryKey).filter((s) => !present.has(s.description.toLowerCase()));
    return q ? all.filter((s) => s.description.toLowerCase().includes(q)) : all;
  }, [categoryKey, present, q]);
  const productRows = useMemo(
    () => (q ? products.filter((p) => String(p.name || "").toLowerCase().includes(q)) : products),
    [products, q],
  );
  const areaRows = useMemo(
    () => (Array.isArray(areas) ? areas.filter((a) => !q || String(a.label || "").toLowerCase().includes(q)) : []),
    [areas, q],
  );

  if (!open) return null;

  /** Open the editor on a library block, drafting a translation if needed. */
  async function openBlock(block) {
    setError("");
    setTranslationNote("");
    const resolved = resolveTextBlockText(block, documentLanguage);
    const state = { block, text: { name: resolved.name, body: resolved.body }, translation: null };
    setEditing(state);
    setDraft(draftFrom(block, state.text, { hourlyRate }));
    setSaveToLibrary(false);
    if (!resolved.missing) return;

    // No stored rendering in the quote's language: draft one, once. The
    // block's own words stay in the boxes while it runs, so a slow or
    // refused call leaves something to edit rather than a blank.
    setTranslating(true);
    try {
      const res = await fetch(`/api/quote-text-blocks/${block.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: documentLanguage }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTranslationNote(
          data?.error ||
            t("app.textBlocks.translateFailed", "Couldn't translate this block — it's shown in {language}. You can translate it yourself before adding.", {
              language: languageName(block.language),
            }),
        );
        return;
      }
      setDraft((d) => (d ? { ...d, name: data.draft.name, body: data.draft.body } : d));
      setEditing((e) => (e ? { ...e, translation: data.stored ? null : { language: documentLanguage } } : e));
      if (!data.stored) {
        setTranslationNote(
          t("app.textBlocks.translatedDraft", "Translated into {language} by FieldQuo AI — check it before adding. Your edits are saved to the library so this is never translated again.", {
            language: languageName(documentLanguage),
          }),
        );
      }
    } catch (err) {
      setTranslationNote(err.message || t("app.textBlocks.translateFailed", "Couldn't translate this block.", { language: languageName(block.language) }));
    } finally {
      setTranslating(false);
    }
  }

  function openCustom() {
    setError("");
    setTranslationNote("");
    setEditing({ block: null, text: null, translation: null });
    setDraft(draftFrom(null, null, { hourlyRate }));
    setSaveToLibrary(false);
  }

  const pricingFor = (d) =>
    priceTextBlock(d.priceMode, {
      quantity: d.quantity,
      rate: d.rate,
      amount: d.amount,
    });

  /** The block-shaped object the line is built from, whatever it came from. */
  const blockShape = (d, base) => ({
    ...(base?.id ? { id: base.id } : {}),
    name: d.name,
    body: d.body,
    priceMode: showPricing ? d.priceMode : "none",
    price:
      d.priceMode === "custom" ? d.amount : d.priceMode === "hourly" || d.priceMode === "quantity" ? d.rate : null,
    unit: d.priceMode === "quantity" ? d.unit : null,
    hiddenOnWorkOrder: d.hiddenOnWorkOrder,
  });

  async function addToQuote() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError(t("app.textBlocks.titleRequired", "Give the item a title."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      let base = editing.block;
      const shape = blockShape(draft, base);

      // ── The library writes, before the line lands ─────────────────────
      //
      // A custom item ticked "save to library" becomes a block in the
      // quote's language and STAYS on this quote (the owner's rule). A
      // library block opened in another language stores the reviewed
      // translation. Either failure is reported and the line is not added:
      // the person asked for two things and silently doing one would leave
      // them believing the other happened.
      if (!base && saveToLibrary) {
        base = await fetchJson("/api/quote-text-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            body: draft.body,
            priceMode: shape.priceMode,
            price: shape.price === "" ? null : shape.price,
            unit: shape.unit,
            hiddenOnWorkOrder: draft.hiddenOnWorkOrder,
            language: documentLanguage,
            tags: categoryKey ? [String(categoryKey).split("_")[0]] : [],
          }),
        });
        setBlocks((prev) => [...(prev || []), base]);
      } else if (base && editing.translation) {
        const updated = await fetchJson(`/api/quote-text-blocks/${base.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translation: { language: documentLanguage, name, body: draft.body } }),
        });
        setBlocks((prev) => (prev || []).map((b) => (b.id === updated.id ? updated : b)));
      } else if (base && saveToLibrary) {
        // "Save changes to library": the edited title, body, price and
        // switch become the block's own — in the block's language only,
        // which is the language the boxes are in when this is offered.
        const updated = await fetchJson(`/api/quote-text-blocks/${base.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            body: draft.body,
            priceMode: shape.priceMode,
            price: shape.price === "" ? null : shape.price,
            unit: shape.unit,
            hiddenOnWorkOrder: draft.hiddenOnWorkOrder,
          }),
        });
        setBlocks((prev) => (prev || []).map((b) => (b.id === updated.id ? updated : b)));
      }

      const line = lineFromTextBlock(
        { ...shape, ...(base?.id ? { id: base.id } : {}) },
        { name, body: draft.body },
        pricingFor(draft),
      );
      onAddLine(line);
      onClose();
    } catch (err) {
      setError(err.message || t("app.textBlocks.addError", "Couldn't add this item."));
    } finally {
      setBusy(false);
    }
  }

  const priced = draft ? pricingFor(draft) : null;
  // Only a block opened in ITS OWN language may be saved back over itself —
  // saving French boxes over an English block would relabel it.
  const canSaveBack = editing?.block && !editing.translation && editing.block.language === documentLanguage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="line-item-library-title"
      data-line-item-library
    >
      <div className="bg-card text-foreground w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
          <h2 id="line-item-library-title" className="font-semibold">
            {editing
              ? editing.block
                ? editing.block.name
                : t("app.textBlocks.newBlock", "New block")
              : t("app.textBlocks.addTitle", "Add area or line item")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close", "Close")} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {!editing ? (
          <>
            <div className="px-5 py-3 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("app.textBlocks.searchPlaceholder", "Search the library…")}
                  className="w-full border border-border rounded-lg pl-8 pr-2 py-2 text-sm bg-background"
                />
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-3 space-y-4 flex-1">
              {areaRows.length > 0 && onAddArea && (
                <Section title={t("app.textBlocks.sectionAreas", "Areas")}>
                  {areaRows.map((a) => (
                    <RowButton key={a.key} onClick={() => { onAddArea(a); onClose(); }} chip={t("app.textBlocks.chipArea", "area")}>
                      {a.label}
                    </RowButton>
                  ))}
                </Section>
              )}

              <Section title={t("app.textBlocks.sectionBlocks", "Text blocks")}>
                {blocks === null ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {t("app.textBlocks.loading", "Loading the library…")}</p>
                ) : loadError ? (
                  <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {loadError}</p>
                ) : libraryRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {q ? t("app.textBlocks.noMatches", "Nothing in the library matches.") : t("app.textBlocks.empty", "No blocks yet — write one below and save it to the library.")}
                  </p>
                ) : (
                  libraryRows.map((b) => {
                    const chip = textBlockChip(b, money);
                    const foreign = b.language !== documentLanguage && !b.translations?.[documentLanguage]?.name;
                    return (
                      <RowButton
                        key={b.id}
                        onClick={() => openBlock(b)}
                        chip={CHIP_KEYS[chip.key] ? t(CHIP_KEYS[chip.key], chip.label) : chip.label}
                        muted={foreign ? t("app.textBlocks.inLanguage", "in {language}", { language: languageName(b.language) }) : ""}
                      >
                        {b.name}
                      </RowButton>
                    );
                  })
                )}
                <button
                  type="button"
                  onClick={openCustom}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                >
                  <Plus size={12} /> {t("app.textBlocks.newBlock", "New block")}
                </button>
              </Section>

              {suggestions.length > 0 && onAddSuggested && (
                <Section title={t("app.lineItems.commonForTrade", "Common for this trade")} hint={t("app.lineItems.suggestionsHint")}>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s.key || s.description}
                        type="button"
                        onClick={() => { onAddSuggested(s); onClose(); }}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Plus size={11} /> {s.description}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {productRows.length > 0 && onAddProduct && (
                <Section title={t("app.lineItems.addFromProducts", "Add from Products & Services")}>
                  {productRows.map((p) => (
                    <RowButton
                      key={p.id}
                      onClick={() => { onAddProduct(p); onClose(); }}
                      chip={p.unitPrice != null && showPricing ? money(p.unitPrice) : ""}
                    >
                      {p.name}
                    </RowButton>
                  ))}
                </Section>
              )}
            </div>
          </>
        ) : (
          <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1" data-text-block-editor>
            {translationNote ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <Sparkles size={13} className="shrink-0 mt-0.5" /> <span>{translationNote}</span>
              </p>
            ) : null}
            {translating ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> {t("app.textBlocks.translating", "Translating into {language}…", { language: languageName(documentLanguage) })}
              </p>
            ) : null}

            <div>
              <label htmlFor="text-block-title" className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.textBlocks.title", "Title")}
              </label>
              <input
                id="text-block-title"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
                autoFocus={!editing.block}
              />
            </div>

            <div>
              <label htmlFor="text-block-body" className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.textBlocks.body", "Text (shown to the homeowner)")}
              </label>
              <RichTextEditor
                id="text-block-body"
                value={draft.body}
                onChange={(body) => setDraft({ ...draft, body })}
                placeholder={t("app.textBlocks.bodyPlaceholder", "What this covers, in the words the homeowner reads.")}
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.hiddenOnWorkOrder}
                onChange={(e) => setDraft({ ...draft, hiddenOnWorkOrder: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                {t("app.textBlocks.hiddenOnWorkOrder", "Hidden on work order")}
                <span className="block text-xs text-muted-foreground">
                  {t("app.textBlocks.hiddenOnWorkOrderHint", "The crew sees the scope, not this wording.")}
                </span>
              </span>
            </label>

            {showPricing && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t("app.textBlocks.price", "Price")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRICE_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            priceMode: mode,
                            ...(mode === "hourly" && draft.rate === "" ? { rate: hourlyRate ?? "" } : {}),
                            ...(mode === "quantity" && !draft.unit ? { unit: "sqft" } : {}),
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          draft.priceMode === mode ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-muted"
                        }`}
                        data-price-mode={mode}
                      >
                        {t(`app.textBlocks.mode.${mode}`, mode)}
                      </button>
                    ))}
                  </div>
                </div>

                {(draft.priceMode === "hourly" || draft.priceMode === "quantity") && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {draft.priceMode === "hourly" ? t("app.textBlocks.hours", "Hours") : t("app.textBlocks.quantity", "Quantity")}
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={draft.quantity}
                          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                          className={inputClass}
                        />
                        {draft.priceMode === "quantity" ? (
                          <input
                            value={draft.unit}
                            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                            className="w-16 border border-border rounded px-2 py-1.5 text-sm bg-background"
                            aria-label={t("app.textBlocks.unit", "Unit")}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">h</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.rate", "Rate")}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.rate}
                        onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t("app.textBlocks.lineTotal", "Line total")}</p>
                      <p className="text-sm font-semibold tabular-nums py-1.5" data-line-total>{money(priced.amount)}</p>
                    </div>
                  </div>
                )}
                {draft.priceMode === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.amount", "Amount")}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t("app.textBlocks.lineTotal", "Line total")}</p>
                      <p className="text-sm font-semibold tabular-nums py-1.5" data-line-total>{money(priced.amount)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(!editing.block || canSaveBack) && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
                <span>
                  {editing.block
                    ? t("app.textBlocks.saveChangesToLibrary", "Save these changes to the library")
                    : t("app.textBlocks.saveToLibrary", "Save to library")}
                  <span className="block text-xs text-muted-foreground">
                    {t("app.textBlocks.saveToLibraryHint", "It stays on this quote either way.")}
                  </span>
                </span>
              </label>
            )}

            {error ? (
              <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
          {editing ? (
            <button type="button" onClick={() => { setEditing(null); setDraft(null); setError(""); setTranslationNote(""); }} className="text-sm text-muted-foreground hover:text-foreground">
              {t("app.textBlocks.backToLibrary", "Back to the library")}
            </button>
          ) : (
            <span />
          )}
          {editing ? (
            <button
              type="button"
              onClick={addToQuote}
              disabled={busy || translating}
              className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
              data-add-to-quote
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : saveToLibrary || editing.translation ? <Save size={14} /> : <Plus size={14} />}
              {t("app.textBlocks.addToQuote", "Add to quote")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
      {hint ? <p className="text-[11px] text-muted-foreground mb-2">{hint}</p> : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function RowButton({ onClick, chip, muted, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <span className="min-w-0 truncate">
        {children}
        {muted ? <span className="ml-2 text-xs text-muted-foreground">{muted}</span> : null}
      </span>
      {chip ? <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{chip}</span> : null}
    </button>
  );
}
