// app/components/quotes/builder/LineItemsTable.js
//
// The editable priced rows every scope group ends in.
//
// Whatever produced them — a unit-price calculation, a tier selection, an
// intake formula or someone typing — the result is the same table, and it stays
// editable. That's deliberate: a contractor standing in a kitchen needs to be
// able to override any number the software worked out, without hunting for the
// input that produced it.
//
// ── One fix while extracting ────────────────────────────────────────────────
//
// The columns had no headers. Four unlabelled inputs in a row is guessable on
// a laptop and genuinely ambiguous on a phone, where quantity and rate are
// two identical narrow number boxes. Headers cost one row and remove the
// guessing.
//
// ── Where the chips went ────────────────────────────────────────────────────
//
// "Common for this trade" and the products <select> used to sit under the
// table as two separate pickers. Both now live inside the one library
// dialog "+ Add area or line item" opens (LineItemLibrary.js), beside the
// company's text blocks, so there is one list to search. The catalogue and
// the products are still the sources; only the doorway moved. A text block
// on the table is a line whose scope is drawn rich (RichTextBody) and,
// when it carries no price, shows no rate or amount boxes.
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Plus, X, Percent } from "lucide-react";
import { getBenchmark } from "@/lib/pricing/benchmarkGuidance";
import { formatAppMoney } from "@/lib/format/money";
import { useTranslation } from "@/app/hooks/useTranslation";
import { isTextLine, lineShowsAmount } from "@/lib/quotes/textBlocks";
import { markupPct, priceFromMarkup } from "@/lib/costing/lineItemCost";
import RichTextBody from "@/app/components/quotes/RichTextBody";
import LineItemLibrary from "./LineItemLibrary";

// The scope-note placeholder (app.lineItems.detailPlaceholder) is shown greyed
// in the box, so an estimator can see the SHAPE of a good scope note without
// having to be told. Deliberately about prep and process — the parts a client
// cannot see and therefore assumes are not happening.

/**
 * Unit cost / Markup % / Unit price, under a line's price (Jobber's popover,
 * by the owner's request 2026-09-23).
 *
 * ── Which side moves ────────────────────────────────────────────────────────
 *
 * Three boxes, one relationship: price = cost × (1 + markup). Typing a cost
 * keeps the markup and moves the price; typing a markup keeps the cost and
 * moves the price; typing the price keeps the cost and moves the markup. The
 * markup is never stored — it is what the two stored numbers imply
 * (lib/costing/lineItemCost.js markupPct) — so the only thing this writes
 * that the table did not already write is the line's `unitCost`, through the
 * same onChange the quantity and rate boxes use.
 *
 * ── Internal ────────────────────────────────────────────────────────────────
 *
 * The cost never reaches the document: every client-facing renderer reads
 * description, detail, quantity and amount. It is said in the popover in
 * words, because the box sits two inches from the price the client will read.
 */
function CostMarkupPopover({ item, index, currency, onChange, onClose, t, money }) {
  const rate = Number(item.rate) || 0;
  const unitCost = item.unitCost == null || item.unitCost === "" ? "" : Number(item.unitCost);
  // The markup box's own text while it is being typed — a half-typed "1"
  // must not snap to the figure the cost and price imply mid-keystroke.
  const [markup, setMarkup] = useState(() => {
    const m = markupPct(unitCost, rate);
    return m == null ? "" : String(m);
  });
  const rootRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const box = "w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground tabular-nums";
  const setCost = (v) => {
    const next = v === "" ? null : Number(v);
    onChange(index, "unitCost", next);
    const m = Number(markup);
    if (next > 0 && markup !== "" && Number.isFinite(m)) onChange(index, "rate", priceFromMarkup(next, m));
  };
  const setMarkupPct = (v) => {
    setMarkup(v);
    const m = Number(v);
    if (unitCost > 0 && v !== "" && Number.isFinite(m)) onChange(index, "rate", priceFromMarkup(unitCost, m));
  };
  const setPrice = (v) => {
    const next = Number(v) || 0;
    onChange(index, "rate", next);
    const m = markupPct(unitCost, next);
    setMarkup(m == null ? "" : String(m));
  };

  return (
    <div
      ref={rootRef}
      className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg space-y-2 text-left"
      data-cost-markup-popover
    >
      <p className="text-xs font-semibold text-foreground">{t("app.lineItems.costMarkup", "Cost & markup")}</p>
      <label className="block text-xs">
        <span className="block text-[11px] text-muted-foreground mb-0.5">{t("app.lineItems.unitCost", "Unit cost")}</span>
        <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setCost(e.target.value)} className={box} data-unit-cost-input />
      </label>
      <label className="block text-xs">
        <span className="block text-[11px] text-muted-foreground mb-0.5">{t("app.lineItems.markupPct", "Markup %")}</span>
        <input type="number" step="0.1" value={markup} onChange={(e) => setMarkupPct(e.target.value)} disabled={!(unitCost > 0)} className={`${box} disabled:bg-muted disabled:text-muted-foreground`} data-markup-input />
      </label>
      <label className="block text-xs">
        <span className="block text-[11px] text-muted-foreground mb-0.5">{t("app.lineItems.unitPrice", "Unit price")}</span>
        <input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => setPrice(e.target.value)} className={box} data-unit-price-input />
      </label>
      {unitCost > 0 && (
        <p className="text-[11px] text-muted-foreground tabular-nums" data-cost-markup-summary>
          {t("app.lineItems.costChip", "Cost {cost} · markup {pct}%", { cost: money(unitCost), pct: markupPct(unitCost, rate) ?? 0 })}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">{t("app.lineItems.costHint", "Internal — the client never sees the cost.")}</p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" onClick={() => { onChange(index, "unitCost", null); setMarkup(""); }} disabled={!(unitCost > 0)} className="text-[11px] underline underline-offset-2 text-muted-foreground disabled:opacity-50">
          {t("app.lineItems.clearCost", "Clear cost")}
        </button>
        <button type="button" onClick={onClose} className="text-xs font-semibold underline underline-offset-2 text-foreground">
          {t("app.docBuilder.done", "Done")}
        </button>
      </div>
    </div>
  );
}

export default function LineItemsTable({
  // The company's billing currency. Without it these rendered a bare
  // toFixed(2), which does not group — $2100.00 next to a grouped total.
  currency,
  items = [],
  products = [],
  categoryKey,
  onChange,
  onAdd,
  onRemove,
  onAddProduct,
  onAddSuggested,
  // A fully-formed line from the library dialog — a text block, priced or
  // not (lib/quotes/textBlocks.js lineFromTextBlock).
  onAddLine,
  // The quote's language, so a block written in another one is resolved or
  // drafted into it before it lands.
  documentLanguage = "en",
  // The trade's hourly sell rate, prefilled for an hourly block.
  hourlyRate = null,
  // Whether this member may see or type money — the dialog prices nothing
  // for one who may not.
  showPricing = true,
  // The takeoff's areas, when the trade has some to offer (see the dialog).
  areas = null,
  onAddArea = null,
  // A service's estimate template, expanded as lines — see
  // lib/quotes/serviceTemplateLines.js. `templateInfo(product)` says whether
  // the product's template is offered here (null = not offered) and what it
  // would fill; `onAddProductTemplate(product)` adds it. Both absent → the
  // library shows the products exactly as before.
  templateInfo = null,
  onAddProductTemplate = null,
  // (item, index, items) → { bar, note } for a line that came from a
  // template (templateLineNotes.js): the run's bar over its first line and
  // where the line's quantity came from — or which measurement would fill it.
  describeLine = null,
}) {
  const { t, language } = useTranslation();
  const detailPlaceholder = t("app.lineItems.detailPlaceholder");
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Which line's cost / markup popover is open — one at a time.
  const [costOpen, setCostOpen] = useState(null);
  const money = (n) => formatAppMoney(n, currency, language);

  return (
    <div>
      {/* ── Column headers: desktop only ─────────────────────────────────────
          Below sm each line becomes its own stacked card with the field names
          on the fields themselves. A twelve-column grid on a 375px phone gave
          Description about 110px — five-sixths of a quote line, unreadable and
          unusable, on the screen this product exists to fill in. */}
      {items.length > 0 && (
        <div className="hidden sm:grid grid-cols-12 gap-2 mb-1.5 px-1">
          <span className="col-span-5 text-[11px] font-medium text-muted-foreground">
            {t("app.lineItems.description")}
          </span>
          <span className="col-span-2 text-[11px] font-medium text-muted-foreground">
            {t("app.lineItems.qty")}
          </span>
          <span className="col-span-2 text-[11px] font-medium text-muted-foreground">
            {t("app.lineItems.rate")}
          </span>
          <span className="col-span-2 text-[11px] font-medium text-muted-foreground text-right">
            {t("app.lineItems.amount")}
          </span>
          <span className="col-span-1" />
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const described = describeLine ? describeLine(item, i, items) : null;
          return (
          // A Fragment, not a wrapper: the rows must stay direct children of
          // the space-y list, or every line's spacing changes.
          <Fragment key={i}>
          {described?.bar && (
            <div className="flex items-center justify-between gap-2 flex-wrap rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground" data-template-run-bar>
              <span className="min-w-0">{described.bar.text}</span>
              {described.bar.action && (
                <button type="button" onClick={described.bar.action.onClick} className="font-semibold text-foreground underline underline-offset-2" data-template-refill>
                  {described.bar.action.label}
                </button>
              )}
            </div>
          )}
          <div
            // Mobile: a bordered card, description on its own line, then the
            // numbers in a row. Desktop: the original twelve-column row,
            // unchanged. `sm:contents` on the inner wrapper makes it vanish at
            // sm so its children become grid items of THIS grid — that's what
            // lets one markup tree serve both shapes without duplicating the
            // inputs and their handlers.
            className="rounded-lg border border-border p-2 space-y-2 sm:space-y-0 sm:p-0 sm:border-0 sm:rounded-none sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
          >
            <input
              value={item.description}
              onChange={(e) => onChange(i, "description", e.target.value)}
              placeholder={t("app.lineItems.description")}
              className="w-full sm:col-span-5 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
            />
            {/* An unpriced text block has no quantity or rate to type: the
                boxes would be a $0.00 the document does not print. Its row
                keeps the remove button and the badges below. */}
            {!lineShowsAmount(item) ? (
              <div className="flex items-center justify-between gap-2 sm:col-span-7">
                <span className="text-[11px] text-muted-foreground">
                  {t("app.textBlocks.chipTextBlock", "Text block")}
                  {item.hiddenOnWorkOrder ? ` · ${t("app.textBlocks.hiddenOnWorkOrderChip", "Hidden on work order")}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="shrink-0 p-2 sm:p-0 -mr-1 sm:mr-0 text-muted-foreground hover:text-red-600"
                  aria-label={t("app.lineItems.removeLine")}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
            <div className="flex items-center gap-2 sm:contents">
              <label className="flex-1 sm:contents">
                <span className="sm:hidden block text-[10px] font-medium text-muted-foreground mb-0.5">
                  {t("app.lineItems.qty")}
                </span>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onChange(i, "quantity", Number(e.target.value))}
                  className="w-full sm:col-span-2 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
                />
              </label>
              <label className="flex-1 sm:contents">
                <span className="sm:hidden block text-[10px] font-medium text-muted-foreground mb-0.5">
                  {t("app.lineItems.rate")}
                </span>
                {/* The price box, with the cost / markup popover behind the
                    % beside it (Jobber's "tap the unit price"). Only for a
                    member who may see money — a cost is money. */}
                <span className="relative block w-full sm:col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => onChange(i, "rate", Number(e.target.value))}
                    className={`w-full border border-border rounded px-2 py-2 sm:py-1.5 text-sm ${showPricing ? "pr-7" : ""}`}
                  />
                  {showPricing && (
                    <button
                      type="button"
                      onClick={() => setCostOpen((cur) => (cur === i ? null : i))}
                      aria-label={t("app.lineItems.costMarkup", "Cost & markup")}
                      title={t("app.lineItems.costMarkup", "Cost & markup")}
                      aria-expanded={costOpen === i}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 ${Number(item.unitCost) > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      data-cost-markup-toggle
                    >
                      <Percent size={12} />
                    </button>
                  )}
                  {costOpen === i && (
                    <CostMarkupPopover item={item} index={i} currency={currency} onChange={onChange} onClose={() => setCostOpen(null)} t={t} money={money} />
                  )}
                </span>
              </label>
              <div className="sm:col-span-2 text-sm font-medium text-foreground text-right tabular-nums shrink-0 self-end pb-2 sm:pb-0">
                {formatAppMoney(item.amount, currency, language)}
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                // 40px hit area on mobile; the desktop version stays a bare icon.
                className="sm:col-span-1 shrink-0 self-end p-2 sm:p-0 -mr-1 sm:mr-0 text-muted-foreground hover:text-red-600"
                aria-label={t("app.lineItems.removeLine")}
              >
                <X size={14} />
              </button>
            </div>
            )}

            {/* ── What the work actually involves ──────────────────────────
                The name of a line is not the scope of it. "Cabinet
                Refinishing" tells a homeowner nothing about the degreasing,
                the primer coats or the sanding between them — and the AI
                review recommended "clearer wording" on every quote forever
                precisely because that text had nowhere to live, so the only
                thing anyone could improve was the name.

                Spans the full grid on desktop so it reads as a paragraph
                belonging to the line above it rather than a fifth column.
                Optional on every line: a disposal fee does not need a
                paragraph, and forcing one would fill quotes with padding. */}
            {isTextLine(item) ? (
              // The block's body, as the client will read it — bold, lists
              // and links drawn, not their markers. Edited through the
              // library dialog rather than in place: the toolbar and the
              // preview live there, and a plain textarea here would show
              // the markers to somebody who never chose to see them.
              <div className="sm:col-span-12 rounded border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground">
                {item.detail ? <RichTextBody body={item.detail} /> : null}
                {lineShowsAmount(item) && item.hiddenOnWorkOrder ? (
                  <span className="inline-block mt-1 rounded-full border border-border px-2 py-0.5 text-[10px]">
                    {t("app.textBlocks.hiddenOnWorkOrderChip", "Hidden on work order")}
                  </span>
                ) : null}
              </div>
            ) : (
              <textarea
                value={item.detail || ""}
                onChange={(e) => onChange(i, "detail", e.target.value)}
                rows={2}
                placeholder={detailPlaceholder}
                className="w-full sm:col-span-12 border border-border rounded px-2 py-1.5 text-xs resize-y bg-background text-foreground placeholder:text-muted-foreground"
              />
            )}

            {/* What the line costs, said on the row once a cost is stated, so
                the figure is not only in a popover that is closed. */}
            {showPricing && Number(item.unitCost) > 0 && lineShowsAmount(item) && (
              <p className="sm:col-span-12 text-[11px] text-muted-foreground tabular-nums" data-line-cost-chip>
                {t("app.lineItems.costChip", "Cost {cost} · markup {pct}%", { cost: money(item.unitCost), pct: markupPct(item.unitCost, item.rate) ?? 0 })}
              </p>
            )}
            <BenchmarkHint item={item} categoryKey={categoryKey} />
            {described?.note && (
              <p
                className={`sm:col-span-12 text-[11px] leading-snug ${described.note.tone === "warn" ? "text-amber-700 dark:text-amber-500" : "text-muted-foreground"}`}
                data-template-line-note={described.note.tone}
              >
                {described.note.text}
                {described.note.action && (
                  <>
                    {" "}
                    <button type="button" onClick={described.note.action.onClick} className="font-semibold underline underline-offset-2" data-template-open-calculator>
                      {described.note.action.label}
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-foreground flex items-center gap-1"
        >
          <Plus size={12} /> {t("app.lineItems.addLine")}
        </button>

        {/* The library: text blocks, the trade's habitual extras, the
            products catalogue, a custom item — one dialog. Offered whenever
            a caller can take a line from it. */}
        {(onAddLine || onAddSuggested || onAddProduct) && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            data-open-line-item-library
          >
            <Plus size={12} /> {t("app.textBlocks.addTitle", "Add area or line item")}
          </button>
        )}
      </div>

      <LineItemLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        categoryKey={categoryKey}
        products={products}
        existingDescriptions={items.map((i) => i.description)}
        documentLanguage={documentLanguage}
        currency={currency}
        hourlyRate={hourlyRate}
        showPricing={showPricing}
        areas={areas}
        onAddArea={onAddArea}
        onAddLine={onAddLine}
        onAddSuggested={onAddSuggested}
        onAddProduct={onAddProduct}
        templateInfo={templateInfo}
        onAddProductTemplate={onAddProductTemplate}
      />
    </div>
  );
}

/**
 * What the trade typically charges for this line, shown only while the rate is
 * still blank.
 *
 * ── Why it disappears once a rate is entered ────────────────────────────────
 *
 * The benchmark is here to answer "what do people charge for this?", which is
 * a question you have exactly once. Leaving it up afterwards turns it into a
 * running commentary on the contractor's own pricing — and worse, invites them
 * to drift toward a national median that has nothing to do with their market,
 * their overhead or their van.
 *
 * ── Why "no benchmark" is worth rendering ───────────────────────────────────
 *
 * A `none` result means the research looked and found nothing publishable, and
 * says why. That is different information from silence, which reads as "we have
 * no opinion". Both plumbing (26 of 82 lines) and electrical (4 of 54) have
 * real holes, and printing them is what stops someone assuming the ranges they
 * DO see are complete.
 *
 * Never client-facing: this is FieldQuo's own research, not the company's rate
 * card, and it exists only in the back-office builder.
 */
const CONFIDENCE_KEYS = {
  inferred: "app.lineItems.confidenceInferred",
  derived: "app.lineItems.confidenceDerived",
  market_typical: "app.lineItems.confidenceMarket",
  unverified: "app.lineItems.confidenceUnverified",
  guess: "app.lineItems.confidenceGuess",
};

function BenchmarkHint({ item, categoryKey }) {
  const { t } = useTranslation();
  const rate = Number(item.rate) || 0;
  if (rate > 0 || !item.catalogKey) return null;

  const b = getBenchmark(categoryKey, item.catalogKey);
  if (!b) return null;

  const isNumber = b.kind === "range" || b.kind === "multiplier";
  return (
    <p
      className={`text-[11px] leading-snug sm:col-span-12 ${
        isNumber ? "text-muted-foreground" : "text-amber-700 dark:text-amber-500"
      }`}
      title={b.detail}
    >
      {isNumber ? `${t("app.lineItems.typical")} ` : ""}
      {b.label}
      {b.kind === "range" && b.currency !== "USD" ? ` ${b.currency}` : ""}
      {/* A range read off published estimates and one inferred from a single
          job are not the same claim, so the weaker ones say so rather than
          borrowing the confidence of the rest. */}
      {b.confidence !== "read" && isNumber ? (
        <span className="opacity-70">
          {" · "}
          {/* The closed vocabulary lib/pricing/benchmarkGuidance.js emits;
              a value this screen has never heard of prints as itself
              rather than vanishing. */}
          {CONFIDENCE_KEYS[b.confidence]
            ? t(CONFIDENCE_KEYS[b.confidence])
            : b.confidence}
        </span>
      ) : null}
    </p>
  );
}
