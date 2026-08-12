// app/app/settings/services/RateCard.js
//
// The rate card for one trade — what you charge for the main scope of work.
//
// This is the screen that was missing. Settings > Services could only express
// a single `defaultRate` per trade, so a cabinet shop had one number standing
// in for "per door", "per drawer" and three complexity tiers, and a stair
// refinisher had one number standing in for treads, risers, balusters, newel
// posts, handrail and landings. Everybody typed totals into the quote instead.
//
// ── Where this sits relative to Products & Services ─────────────────────────
//
// Rate card (here):        the MAIN SCOPE. Per door, per tread, per sq ft.
//                          These build the quote's core lines automatically.
// Products & Services:     ADD-ONS. Discrete extras you drop onto any quote —
//                          handles, hinges, a rush fee. Priced individually.
//
// A rate answers "what does this trade cost per unit of work". A product
// answers "what else went on the job". Keeping them apart is why the quote can
// build itself from a takeoff and still let you add a one-off line.
//
// Fields are declared by the trade, not hardcoded here — see
// PRICE_BOOK_FIELDS. A trade added to the price book later renders with no
// change to this file.
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Lock } from "lucide-react";
import {
  PRICE_BOOK_FIELDS,
  PRICE_BOOK_GROUPS,
  getPriceBook,
  readField,
  hasPriceBook,
} from "@/app/data/tradePriceBooks";

const inputClass =
  "w-28 border border-border rounded px-2 py-1 text-sm text-right tabular-nums";

/** Group fields in declaration order, keeping ungrouped ones in a lead block. */
function groupFields(fields) {
  const blocks = [];
  for (const field of fields) {
    const key = field.group || field.level || "";
    const last = blocks[blocks.length - 1];
    if (last && last.key === key) last.fields.push(field);
    else blocks.push({ key, fields: [field] });
  }
  return blocks;
}

export default function RateCard({ category, overrides, onChange }) {
  const [open, setOpen] = useState(false);
  const fields = PRICE_BOOK_FIELDS[category.key] || [];
  const book = useMemo(
    () => getPriceBook(category.key, overrides),
    [category.key, overrides],
  );

  if (!hasPriceBook(category.key) || fields.length === 0) return null;

  const customised = overrides && Object.keys(overrides).length > 0;
  const blocks = groupFields(fields);

  // Writing a value that equals the default would pin the company to today's
  // number forever. Clearing a field removes it from the patch instead, so the
  // trade goes back to inheriting.
  function setField(path, raw) {
    const next = structuredClone(overrides || {});
    const parts = path.split(".");
    if (raw === "" || raw === null) {
      let node = next;
      for (let i = 0; i < parts.length - 1; i++) node = node?.[parts[i]];
      if (node) delete node[parts[parts.length - 1]];
    } else {
      let node = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]] || typeof node[parts[i]] !== "object") node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = Number(raw);
    }
    onChange(Object.keys(next).length ? next : null);
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm"
      >
        <span className="font-medium text-foreground">
          Rate card
          {customised && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              customised
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
            What you charge for the main scope of this trade. Quotes build their
            core lines from these. One-off extras — handles, hinges, a rush fee —
            live in Products &amp; Services instead.
          </p>

          {blocks.map((block, bi) => (
            <div key={bi}>
              {block.key && (
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {PRICE_BOOK_GROUPS[block.key] || block.key}
                </h4>
              )}
              <div className="space-y-1">
                {block.fields.map((field) => {
                  const effective = readField(book, field.path);
                  const isOverridden = readField(overrides || {}, field.path) !== undefined;
                  return (
                    <div key={field.path} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-foreground">
                        {field.label}
                        {field.internal && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"
                            title="Internal only — never shown to the client"
                          >
                            <Lock size={10} /> internal
                          </span>
                        )}
                      </span>
                      <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">
                        {field.suffix}
                      </span>
                      <input
                        type="number"
                        step={field.step ?? 1}
                        value={effective ?? ""}
                        onChange={(e) => setField(field.path, e.target.value)}
                        className={`${inputClass} ${
                          isOverridden ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : ""
                        }`}
                      />
                      {isOverridden ? (
                        <button
                          type="button"
                          onClick={() => setField(field.path, "")}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Reset to the default"
                        >
                          <RotateCcw size={13} />
                        </button>
                      ) : (
                        <span className="w-[21px]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            Highlighted fields are yours. Everything else follows the built-in
            defaults and will keep improving with them — reset a field to go
            back to inheriting.
          </p>
        </div>
      )}
    </div>
  );
}
