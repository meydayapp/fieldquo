// lib/receipts/classify.js
//
// What a receipt's lines ARE, turned into the words the books use — and the
// deterministic hints that sit beside the model's one label.
//
// ══ The division of labour ═════════════════════════════════════════════════
//
// The model labels each line with a `kind` (lib/receipts/extract.js's enum) —
// the only judgement it is asked for. Everything after that is here or in
// lib/receipts/suggest.js, in code that can be run against a fixture and
// argued with:
//
//   * kind → the expense category the P&L buckets it under;
//   * which kinds lean OVERHEAD (fuel, a phone bill, lunch) and which lean JOB
//     (materials);
//   * the store's name as a second, independent hint — "Shell" is fuel
//     whatever the model called the line;
//   * the trade a line belongs to (paint → painting), so a receipt can be
//     matched to the job whose quote is for that trade.
//
// Pure, no imports beyond the category list.
import { EXPENSE_CATEGORY_PRESETS } from "@/lib/expenses/categories";

/** kind → Expense.category. Every value is one of EXPENSE_CATEGORY_PRESETS. */
export const KIND_CATEGORY = Object.freeze({
  materials: "Materials",
  tools_equipment: "Tools & Equipment",
  fuel: "Fuel & Vehicle",
  vehicle: "Fuel & Vehicle",
  office_supplies: "Office Supplies",
  phone_software: "Software & Subscriptions",
  meals: "Meals & Travel",
  safety_gear: "Tools & Equipment",
  fees: "Other",
  other: "Other",
});

/**
 * The kinds that are a cost of RUNNING the business rather than of one job,
 * as the owner listed them: "fuel, tools, office supplies, phone, vehicle
 * maintenance, meals, software". A lean, not a rule — a drill bought for one
 * job is still that job's, which is why the person confirms.
 */
export const OVERHEAD_KINDS = Object.freeze(new Set([
  "fuel",
  "vehicle",
  "tools_equipment",
  "office_supplies",
  "phone_software",
  "meals",
]));

/** The kinds that are the stuff a job is made of. */
export const JOB_KINDS = Object.freeze(new Set(["materials"]));

export function categoryForKind(kind) {
  const c = KIND_CATEGORY[kind];
  return c && EXPENSE_CATEGORY_PRESETS.includes(c) ? c : "Other";
}

/**
 * Store names that say what a receipt is regardless of its lines. Matched on
 * whole words, case-insensitive, against the printed merchant name.
 *
 * Deliberately short and deliberately boring. A general store (Canadian Tire,
 * Walmart, Costco) is NOT here: they sell paint and lunch on one receipt, and
 * a store-level hint would drown the line-level one that actually knows.
 */
export const VENDOR_HINTS = Object.freeze([
  {
    category: "Fuel & Vehicle",
    words: [
      "shell", "esso", "petro-canada", "petro canada", "petrocanada", "chevron", "exxon", "mobil",
      "ultramar", "irving", "husky", "pioneer", "circle k", "couche-tard", "sunoco", "valero",
      "speedway", "marathon", "arco", "texaco", "7-eleven gas", "fas gas", "co-op gas",
      "napa", "autozone", "midas", "jiffy lube", "mr. lube", "mr lube", "kal tire", "o'reilly",
    ],
  },
  {
    category: "Software & Subscriptions",
    words: [
      "rogers", "bell", "telus", "fido", "koodo", "virgin plus", "freedom mobile", "videotron",
      "vidéotron", "verizon", "at&t", "t-mobile", "sprint", "google", "microsoft", "adobe",
      "intuit", "quickbooks", "apple.com", "dropbox", "zoom",
    ],
  },
  {
    category: "Office Supplies",
    words: ["staples", "bureau en gros", "office depot", "officemax", "grand & toy"],
  },
  {
    category: "Meals & Travel",
    words: [
      "tim hortons", "mcdonald's", "mcdonalds", "starbucks", "subway", "a&w", "wendy's",
      "burger king", "second cup", "dunkin", "chipotle", "harvey's", "pizza pizza", "domino's",
    ],
  },
]);

function wordHit(haystack, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(haystack);
}

/** The overhead category a store's name implies, or null. */
export function vendorHint(merchantName) {
  const name = String(merchantName || "").toLowerCase();
  if (!name) return null;
  for (const hint of VENDOR_HINTS) {
    const word = hint.words.find((w) => wordHit(name, w));
    if (word) return { category: hint.category, word };
  }
  return null;
}

// ── Words, for matching a receipt's lines to a job ──────────────────────────

const STOP = new Set([
  "the", "and", "for", "with", "each", "pack", "pkg", "box", "bag", "item", "items", "qty",
  "per", "ea", "pcs", "piece", "pieces", "inch", "feet", "foot", "ft", "mm", "cm", "lb", "lbs",
  "kg", "gal", "gallon", "gallons", "litre", "liter", "roll", "rolls", "white", "black", "grey",
  "gray", "new", "sale", "reg", "total", "sub", "tax", "misc", "general", "labour", "labor",
  "install", "installation", "supply", "supplies", "job", "work", "service", "services",
]);

/** Lower-cased word stems of 3+ letters, plural "s" dropped, stop words out. */
export function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => !STOP.has(w));
}

/**
 * Trade families: a line's words on the left, the words a job in that trade
 * uses on the right. "2 gallons of paint" matches a job called "Interior
 * repaint" or a quote with a line "Walls — two coats".
 */
export const TRADE_FAMILIES = Object.freeze([
  { trade: "painting", words: ["paint", "primer", "stain", "roller", "brush", "caulk", "tape", "sandpaper", "drop", "sherwin", "behr", "benjamin", "coat", "repaint", "painting"] },
  { trade: "drywall", words: ["drywall", "gypsum", "mud", "joint", "compound", "screw", "corner", "bead", "plaster", "taping"] },
  { trade: "flooring", words: ["tile", "grout", "thinset", "mortar", "underlay", "underlayment", "laminate", "vinyl", "hardwood", "floor", "flooring", "trim", "baseboard", "transition"] },
  { trade: "carpentry", words: ["lumber", "stud", "plywood", "osb", "joist", "deck", "framing", "board", "nail", "hinge", "cabinet", "shelf", "door", "carpentry"] },
  { trade: "roofing", words: ["shingle", "roof", "roofing", "flashing", "felt", "ice", "drip", "ridge", "soffit", "fascia", "gutter", "eavestrough"] },
  { trade: "plumbing", words: ["pipe", "pex", "copper", "fitting", "valve", "faucet", "toilet", "drain", "trap", "solder", "plumbing", "sink", "shower"] },
  { trade: "electrical", words: ["wire", "cable", "breaker", "conduit", "outlet", "receptacle", "switch", "romex", "junction", "fixture", "light", "electrical", "panel"] },
  { trade: "landscaping", words: ["mulch", "sod", "soil", "seed", "fertilizer", "stone", "gravel", "paver", "plant", "shrub", "landscape", "landscaping", "lawn", "garden"] },
  { trade: "concrete", words: ["concrete", "cement", "rebar", "form", "quikrete", "sakrete", "aggregate", "slab"] },
]);

/** The trades a piece of text touches. */
export function tradesIn(text) {
  const words = new Set(tokens(text));
  const found = new Set();
  for (const fam of TRADE_FAMILIES) {
    if (fam.words.some((w) => words.has(w) || words.has(tokens(w)[0]))) found.add(fam.trade);
  }
  return found;
}
