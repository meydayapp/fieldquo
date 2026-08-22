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
import { Plus, X, Search } from "lucide-react";
import { getDefaultLineItems } from "@/app/data/defaultLineItems";
import { getLineItemGroups } from "@/app/data/lineItemGroups";
import { getBenchmark } from "@/lib/pricing/benchmarkGuidance";
import { formatAppMoney } from "@/lib/format/money";

// Above this many suggestions a flat row of chips stops being a picker and
// becomes a wall. Electrical ships 54 and plumbing 82; every other trade ships
// six to nine and is better off flat, so the switch is on count, not on trade.
const GROUPED_PICKER_THRESHOLD = 20;

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
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState("");

  // Anything already on the quote drops out of the suggestions — offering
  // "Disposal fee" when it's the line directly above is noise.
  const present = new Set(
    items.map((i) => String(i.description || "").trim().toLowerCase()),
  );
  const catalog = getDefaultLineItems(categoryKey);
  const all = catalog.filter(
    (s) => !present.has(s.description.toLowerCase()),
  );
  const q = query.trim().toLowerCase();
  const suggestions = q
    ? all.filter((s) => s.description.toLowerCase().includes(q))
    : all;

  // Gated on the CATALOGUE size, not on what's left. Gating on the remainder
  // would flip the picker from sectioned to flat partway through a big quote,
  // as adding lines shrank the list past the threshold — the layout moving
  // under someone mid-task, for no reason they could see.
  const groups = getLineItemGroups(categoryKey);
  const grouped = groups.length > 0 && catalog.length >= GROUPED_PICKER_THRESHOLD;
  const sections = grouped
    ? groups
        .map((g) => ({
          ...g,
          items: suggestions.filter((s) => s.group === g.key),
        }))
        .filter((g) => g.items.length > 0)
    : [{ key: "_all", label: null, items: suggestions }];

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
                {formatAppMoney(item.amount, currency, "en")}
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

            <BenchmarkHint item={item} categoryKey={categoryKey} />
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

        {/* Gated on the unfiltered list, not the filtered one: a search that
            matches nothing must not take the button that closes the panel. */}
        {all.length > 0 && onAddSuggested && (
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
                  ? ` — ${formatAppMoney(p.unitPrice, currency, "en")}`
                  : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Offered, never added automatically. An unwanted line on a quote is
          worse than a missing one, because the client reads it. Prices are
          blank on purpose — see app/data/defaultLineItems.js. */}
      {showSuggestions && all.length > 0 && (
        <div className="mt-3 border border-dashed border-border rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-2">
            Tap to add. You&apos;ll need to fill in the price — these are the
            things this trade usually bills for, not what to charge.
          </p>

          {/* Search appears with the sections. Fifty-four chips are navigable
              by heading; eighty-two are navigable by typing. */}
          {grouped && (
            <div className="relative mb-3">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${all.length} items…`}
                className="w-full border border-border rounded-lg pl-7 pr-2 py-1.5 text-xs bg-card"
              />
            </div>
          )}

          {sections.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              Nothing matches “{query}”.
            </p>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.key}>
                  {section.label && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {section.label}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {section.items.map((s) => (
                      <button
                        key={s.key || s.description}
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
              ))}
            </div>
          )}
        </div>
      )}
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
function BenchmarkHint({ item, categoryKey }) {
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
      {isNumber ? "Typical: " : ""}
      {b.label}
      {b.kind === "range" && b.currency !== "USD" ? ` ${b.currency}` : ""}
      {/* A range read off published estimates and one inferred from a single
          job are not the same claim, so the weaker ones say so rather than
          borrowing the confidence of the rest. */}
      {b.confidence !== "read" && isNumber ? (
        <span className="opacity-70"> · {b.confidence}</span>
      ) : null}
    </p>
  );
}
