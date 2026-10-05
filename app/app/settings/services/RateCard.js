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
//
// ── Labour presets (2026-10-05) ──────────────────────────────────────────
//
// A trade can also carry LABOUR PRESETS — how long its work takes, FieldQuo's
// defaults calibrated against the Craftsman estimating guides
// (lib/pricing/labourPresets.js). Electrical, plumbing, carpentry and flooring
// installation have no price book but do have presets, so the card renders
// for them with the presets alone. A preset the company has not changed says
// "FieldQuo default" beside it; the owner: "this is only for the preset; the
// company can modify them to adjust to their own rates." Saved sparse under
// `presets.<key>`, through the same sanitiser as every other path.
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Lock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  PRICE_BOOK_FIELDS,
  PRICE_BOOK_GROUPS,
  getPriceBook,
  readField,
  hasPriceBook,
} from "@/app/data/tradePriceBooks";
import { presetFieldsFor, presetBook, presetLabel, presetUnit } from "@/lib/pricing/labourPresets";

const inputClass =
  "w-28 border border-border rounded px-2 py-1 text-sm text-right tabular-nums";
// Wording needs room to be read back; a sentence in a 7rem right-aligned box
// is a field you can type into and cannot check.
const textInputClass =
  "flex-[2] min-w-0 border border-border rounded px-2 py-1 text-sm";

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

// `defaultOpen`: closed on the settings page, where a company with six
// trades would otherwise face six open grids; open in the home page's
// "Set your pricing" dialog, which exists to show exactly this grid.
export default function RateCard({ category, overrides, onChange, defaultOpen = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const presetFields = useMemo(() => presetFieldsFor(category.key), [category.key]);
  const hasBook = hasPriceBook(category.key);
  const fields = [...(hasBook ? PRICE_BOOK_FIELDS[category.key] || [] : []), ...presetFields];
  const book = useMemo(
    () => ({
      ...(getPriceBook(category.key, overrides) || {}),
      ...(presetFields.length ? presetBook(category.key, overrides) : {}),
    }),
    [category.key, overrides, presetFields],
  );

  if ((!hasBook && presetFields.length === 0) || fields.length === 0) return null;

  const customised = overrides && Object.keys(overrides).length > 0;
  const blocks = groupFields(fields);

  // Writing a value that equals the default would pin the company to today's
  // number forever. Clearing a field removes it from the patch instead, so the
  // trade goes back to inheriting.
  // `type` decides how the value is stored, not just how it renders. Most of a
  // rate card is money, but a few fields are the wording a quote prints — the
  // garage-door spec and warranty lines — and Number("Made in Canada") is NaN.
  //
  // `toggle` is a THIRD kind and stores 1, never `true`. lib/pricing/
  // sanitiseRates.js keeps only declared paths and coerces each to a finite
  // number, so a boolean would be dropped on the way to the database and the
  // switch would be a control that appears to work and doesn't. Unticking
  // clears the key rather than writing 0, which is the same "go back to
  // inheriting" every other field on this card offers.
  function setField(path, raw, type = "number") {
    const next = structuredClone(overrides || {});
    const parts = path.split(".");
    const blank = raw === "" || raw === null || raw === undefined;
    if (blank) {
      let node = next;
      for (let i = 0; i < parts.length - 1; i++) node = node?.[parts[i]];
      if (node) delete node[parts[parts.length - 1]];
    } else {
      let node = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]] || typeof node[parts[i]] !== "object")
          node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] =
        type === "text" ? String(raw) : Number(raw);
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
          {t("app.rateCard.title")}
          {customised && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {t("app.rateCard.customised")}
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
          {hasBook && (
            <p className="text-xs text-muted-foreground">
              {t("app.rateCard.intro")}
            </p>
          )}
          {presetFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("app.labourPresets.intro", "How long the work takes, in labour-hours — FieldQuo's defaults, calibrated against an industry reference (Craftsman estimating guides). Change any figure to your own crew's; yours is used wherever FieldQuo times this work, such as a drawing read.")}
            </p>
          )}

          {blocks.map((block, bi) => (
            <div key={bi}>
              {block.key && (
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {block.key.startsWith("labourPresets.")
                    ? t(`app.labourPresets.group.${block.key.slice("labourPresets.".length)}`, block.key.slice("labourPresets.".length))
                    : PRICE_BOOK_GROUPS[block.key] || block.key}
                </h4>
              )}
              <div className="space-y-1">
                {block.fields.map((field) => {
                  const effective = readField(book, field.path);
                  const isOverridden =
                    readField(overrides || {}, field.path) !== undefined;
                  return (
                    <div key={field.path} className="flex items-center gap-2">
                      {/* min-w-0: a flex-1 label beside a 7rem input and a
                          6rem suffix otherwise refuses to shrink below its
                          longest word and pushes the input off a 375px card. */}
                      <span className="flex-1 min-w-0 break-words text-sm text-foreground">
                        {field.preset ? presetLabel(field.preset, t) : field.label}
                        {/* Labour figures the company has not changed say
                            whose they are — the preset is FieldQuo's, there
                            to be adjusted to the crew's own. */}
                        {!isOverridden && (field.preset || field.group === "roofLabour") && (
                          <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
                            · {t("app.labourPresets.fieldquoDefault", "FieldQuo default")}
                          </span>
                        )}
                        {field.internal && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"
                            title={t("app.rateCard.internalTitle")}
                          >
                            <Lock size={10} /> {t("app.rateCard.internal")}
                          </span>
                        )}
                      </span>
                      <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">
                        {field.preset ? presetUnit(field.preset, t) : field.suffix}
                      </span>
                      {/* A switch is a checkbox, not a box you type 1 into.
                          It occupies the same slot as the number input so the
                          rows in a block still line up. */}
                      {field.type === "toggle" ? (
                        <span className="flex w-28 justify-end">
                          <input
                            type="checkbox"
                            checked={Number(effective) === 1}
                            onChange={(e) =>
                              setField(
                                field.path,
                                e.target.checked ? 1 : "",
                                "toggle",
                              )
                            }
                            className="h-4 w-4 accent-foreground"
                          />
                        </span>
                      ) : (
                        <input
                          type={field.type === "text" ? "text" : "number"}
                          {...(field.type === "text"
                            ? {}
                            : { step: field.step ?? 1 })}
                          value={effective ?? ""}
                          onChange={(e) =>
                            setField(field.path, e.target.value, field.type)
                          }
                          className={`${field.type === "text" ? textInputClass : inputClass} ${
                            isOverridden
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                              : ""
                          }`}
                        />
                      )}
                      {isOverridden ? (
                        <button
                          type="button"
                          onClick={() => setField(field.path, "")}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title={t("app.rateCard.resetToDefault")}
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
            {t("app.rateCard.outro")}
          </p>
        </div>
      )}
    </div>
  );
}
