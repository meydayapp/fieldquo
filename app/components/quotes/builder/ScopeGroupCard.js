// app/components/quotes/builder/ScopeGroupCard.js
//
// The shell around one service on the quote being built.
//
// ── Why the shell is its own component ──────────────────────────────────────
//
// The body of a scope group differs wildly by trade: cabinet work has a unit
// grid and complexity levels, junk removal has tiered packages, most trades
// have structured intake fields, and everything ends in an editable line-item
// table. That variety belongs in the builder page where the domain logic
// lives. What does NOT vary is the frame — accent, title, running subtotal,
// remove — and that frame is exactly what was missing.
//
// So this takes children and owns only the chrome. The parent keeps its state
// and its save path untouched, which matters because quote creation is the one
// flow in this product that cannot be allowed to break.
//
// ── The running subtotal is the point ───────────────────────────────────────
//
// A multi-service quote used to show one figure at the very bottom. Someone
// pricing "interior painting + flooring" had no idea which half was the
// expensive one without adding it up by hand — and that's the number that
// decides whether the client is told to drop a service or discount the lot.
"use client";

import { Trash2 } from "lucide-react";
import { resolveServiceContent } from "@/lib/documents/serviceContent";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

/**
 * @param group     the scope group being edited (needs categoryKey + label)
 * @param index     position, for the numbered badge on multi-service quotes
 * @param showIndex false on a single-service quote — numbering one thing "01"
 *                  is bureaucracy
 * @param subtotal  computed by the parent, which owns the pricing rules
 */
export default function ScopeGroupCard({
  group,
  index,
  showIndex,
  subtotal,
  onRemove,
  children,
}) {
  // Same resolver as the PDF and the client-facing page, so the colour here is
  // the colour the client eventually sees against this work.
  const accent = resolveServiceContent(group.categoryKey).accent;

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5"
        style={{ backgroundColor: `${accent}0f` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {showIndex && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
              style={{ backgroundColor: accent }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <h3 className="font-semibold text-foreground truncate">
            {group.label}
          </h3>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Only once there's a figure worth showing. A card reading $0.00
              while someone is still typing quantities is noise. */}
          {subtotal > 0 && (
            <span className="font-semibold tabular-nums text-foreground">
              {money(subtotal)}
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-red-600 p-1 -mr-1"
            aria-label={`Remove ${group.label}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}
