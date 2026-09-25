// app/components/receipts/labels.js
//
// Every code the receipts book's server answers with — a reason, a flag, a
// status, a category — turned into the reader's language. The server sends
// CODES and parameters (lib/receipts/suggest.js, validate.js, duplicates.js)
// precisely so this file can do the words; nothing here decides anything.
import { EXPENSE_CATEGORY_PRESETS } from "@/lib/expenses/categories";

/** Expense.category values are stored in English (lib/expenses/categories.js);
 *  these are their display keys. An unknown category shows as typed. */
const CATEGORY_KEYS = {
  Materials: "materials",
  "Fuel & Vehicle": "fuelVehicle",
  "Tools & Equipment": "toolsEquipment",
  Insurance: "insurance",
  "Rent & Utilities": "rentUtilities",
  "Software & Subscriptions": "software",
  Marketing: "marketing",
  "Permits & Licensing": "permits",
  "Office Supplies": "officeSupplies",
  "Meals & Travel": "mealsTravel",
  Other: "other",
};

export function categoryLabel(t, category) {
  const key = CATEGORY_KEYS[category];
  return key ? t(`app.receipts.cat.${key}`) : category || "";
}

export function kindLabel(t, kind) {
  return t(`app.receipts.kind.${kind || "other"}`);
}

export function statusLabel(t, status) {
  return t(`app.receipts.status.${status}`);
}

/** One scoring reason as a sentence. Unknown names read as "someone". */
export function reasonText(t, reason) {
  const p = { ...(reason?.params || {}) };
  if (!p.name) p.name = t("app.receipts.someone");
  if (!p.store) p.store = t("app.receipts.theStore");
  if (p.category) p.category = categoryLabel(t, p.category);
  if (p.trade) p.trade = t(`app.receipts.trade.${p.trade}`);
  const code = reason?.code === "after_hours" && p.weekend ? "after_hours_weekend" : reason?.code;
  return t(`app.receipts.reason.${code}`, p);
}

export function flagText(t, flag, v) {
  return t(`app.receipts.flag.${flag}`, {
    gap: v?.discrepancyCents === null || v?.discrepancyCents === undefined
      ? ""
      : (Math.abs(v.discrepancyCents) / 100).toFixed(2),
  });
}

export function confidenceLabel(t, c) {
  return t(`app.receipts.confidence.${c || "low"}`);
}

/** A route's refusal: its code in the reader's language when we have one,
 *  else the route's own sentence. */
export function refusalText(t, err, fallbackKey = "app.receipts.somethingWrong") {
  const code = err?.code || err?.data?.code;
  if (code) {
    const key = `app.receipts.refused.${code}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return err?.message || t(fallbackKey);
}

/** The picker's options — the one shared preset list. */
export const CATEGORY_OPTIONS = EXPENSE_CATEGORY_PRESETS;
