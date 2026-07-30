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
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { getDefaultLineItems } from "@/app/data/defaultLineItems";

export default function LineItemsTable({
  items = [],
  products = [],
  categoryKey,
  onChange,
  onAdd,
  onRemove,
  onAddProduct,
  onAddSuggested,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Anything already on the quote drops out of the suggestions — offering
  // "Disposal fee" when it's the line directly above is noise.
  const present = new Set(
    items.map((i) => String(i.description || "").trim().toLowerCase()),
  );
  const suggestions = getDefaultLineItems(categoryKey).filter(
    (s) => !present.has(s.description.toLowerCase()),
  );

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
            Description
          </span>
          <span className="col-span-2 text-[11px] font-medium text-muted-foreground">
            Qty
          </span>
          <span className="col-span-2 text-[11px] font-medium text-muted-foreground">
            Rate
          </span>
          <span className="col-span-2 text-[11px] font-medium text-muted-foreground text-right">
            Amount
          </span>
          <span className="col-span-1" />
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
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
              placeholder="Description"
              className="w-full sm:col-span-5 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
            />
            <div className="flex items-center gap-2 sm:contents">
              <label className="flex-1 sm:contents">
                <span className="sm:hidden block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Qty
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
                  Rate
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={item.rate}
                  onChange={(e) => onChange(i, "rate", Number(e.target.value))}
                  className="w-full sm:col-span-2 border border-border rounded px-2 py-2 sm:py-1.5 text-sm"
                />
              </label>
              <div className="sm:col-span-2 text-sm font-medium text-foreground text-right tabular-nums shrink-0 self-end pb-2 sm:pb-0">
                ${Number(item.amount).toFixed(2)}
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                // 40px hit area on mobile; the desktop version stays a bare icon.
                className="sm:col-span-1 shrink-0 self-end p-2 sm:p-0 -mr-1 sm:mr-0 text-muted-foreground hover:text-red-600"
                aria-label="Remove line"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-foreground flex items-center gap-1"
        >
          <Plus size={12} /> Add line item
        </button>

        {suggestions.length > 0 && onAddSuggested && (
          <button
            type="button"
            onClick={() => setShowSuggestions((v) => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Plus size={12} />
            {showSuggestions ? "Hide" : "Common for this trade"}
          </button>
        )}

        {/* Only the products linked to this group's category — a flooring
            group shouldn't offer cabinet hardware. */}
        {products.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const product = products.find((p) => p.id === e.target.value);
              if (product) onAddProduct(product);
              e.target.value = "";
            }}
            className="text-xs border border-border rounded-full px-3 py-1.5 bg-card"
          >
            <option value="">+ Add from Products &amp; Services…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.unitPrice != null
                  ? ` — $${Number(p.unitPrice).toFixed(2)}`
                  : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Offered, never added automatically. An unwanted line on a quote is
          worse than a missing one, because the client reads it. Prices are
          blank on purpose — see app/data/defaultLineItems.js. */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mt-3 border border-dashed border-border rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-2">
            Tap to add. You&apos;ll need to fill in the price — these are the
            things this trade usually bills for, not what to charge.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.description}
                type="button"
                onClick={() => onAddSuggested(s)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                <Plus size={11} />
                {s.description}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
