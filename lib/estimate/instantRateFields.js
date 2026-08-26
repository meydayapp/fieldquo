// lib/estimate/instantRateFields.js
//
// Which UNIT RATES the instant-quote settings screen offers for a trade, and
// how a nested one is read and written without losing its siblings.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The settings screen used to decide this with a string comparison —
// `trade.trade === "cabinet_refacing"` — behind three hand-typed boxes. Cabinet
// refinishing was wired as an instant trade later, priced per door out of its
// own price book, and declares `hasMaterials: false` because it recoats the
// doors that are already there. It therefore matched neither branch: an owner
// could switch it on and never see, let alone change, the $150 a door it was
// quoting strangers. Edit the price book in Settings › Rates to $175 and the
// instant quote keeps saying $150 for ever, invisibly.
//
// Adding a second `||` would have fixed that trade and left the next one in
// exactly the same place, so the list is DERIVED from two declarations each
// trade already makes:
//
//   PRICE_BOOK_FIELDS[trade]         what the rate is called, its unit, its step
//   INSTANT_ESTIMATE_DEFAULTS[trade] which of those the instant estimator
//                                    actually prices off — it is the seed for
//                                    the very config this screen edits, so a
//                                    key absent from it is a key nothing reads
//
// The intersection matters in both directions:
//
//   · Refacing's book carries the supplier's cost per square foot, the average
//     door area and freight. Those are margin-panel figures; this screen edits
//     what a HOMEOWNER is quoted, so anything flagged `internal` is dropped
//     outright rather than merely ordered last.
//   · Refacing's book also carries the add-on and complexity rates refinishing
//     prices off — but estimateCabinetRefacing reads neither, so the seed
//     decides it and refacing grows no box that changes no number. That is the
//     dead control this codebase is repeatedly swept for.
//
// A trade that wants this block in future declares fields and seeds them. It
// does not come back here.
import { PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";

// Rates an instant estimator prices off that NO price book declares.
//
// Refacing charges veneer on the exposed sides of the cabinet box by the foot.
// The quote builder's refacing scope (buildCabinets in lib/pricing/tradeScope.js)
// has no such line, so declaring it in the price book to reach it from here
// would grow a dead field on the Services rate card to fix a missing one on
// this screen. Refinishing deliberately has no entry: it sprays the box
// exteriors as part of the base scope, there is no per-foot rate for it, and
// estimateCabinetRefinishing ignores the key entirely.
const INSTANT_ONLY_FIELDS = {
  cabinet_refacing: [
    {
      path: "perBoxLinearFt",
      label: "Per box linear ft",
      suffix: "$ / linear ft",
      step: 5,
    },
  ],
};

// Same reasoning as ownEntry in tradePriceBooks.js: PRICE_BOOK_FIELDS["__proto__"]
// and ["constructor"] are truthy on any plain object, and a trade key arrives
// from a stored row.
function ownEntry(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/**
 * Read a dotted path out of a saved config.
 *
 * Own properties only. `InstantQuoteConfig.config` is free-form JSON that has
 * been round-tripped through Postgres, so a crafted save can carry a
 * "__proto__" key; plain `node[part]` walking would resolve it to
 * Object.prototype and hand the form a "value" nobody stored. Not exported
 * from tradePriceBooks' `readField`, which walks with plain indexing.
 *
 * Returns undefined for anything absent — never 0. An unset per-door rate must
 * render as an empty box, because a confident $0 on `perDoor` quotes a free
 * kitchen.
 */
export function readRate(config, path) {
  return String(path)
    .split(".")
    .reduce(
      (node, part) =>
        node && typeof node === "object" && Object.prototype.hasOwnProperty.call(node, part)
          ? node[part]
          : undefined,
      config,
    );
}

function isUnsafeKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * The patch that sets one dotted rate, ready for the form's SHALLOW merge.
 *
 * The settings screen merges with `{ ...config, ...next }`, so a nested rate
 * has to arrive as a fully rebuilt top-level branch: posting
 * `{ addOns: { handleHolesPerDoor: 12 } }` would silently delete the other six
 * add-on rates the company had set. Every level is cloned rather than mutated,
 * because `config` is React state and an in-place write is a render that
 * doesn't happen.
 *
 * Returns null for a path with a prototype-poisoning segment, so the caller
 * writes nothing at all rather than writing somewhere unexpected.
 */
export function rateFieldPatch(config, path, value) {
  const parts = String(path).split(".");
  if (parts.some(isUnsafeKey) || parts.some((p) => p === "")) return null;

  const top = parts[0];
  if (parts.length === 1) return { [top]: value };

  const existing = readRate(config, top);
  const root = isPlainObject(existing) ? { ...existing } : {};
  let node = root;
  for (let i = 1; i < parts.length - 1; i++) {
    const child = node[parts[i]];
    node[parts[i]] = isPlainObject(child) ? { ...child } : {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  return { [top]: root };
}

/** The top-level config key a field lives under; "" for a bare rate. */
function groupOf(path) {
  const i = String(path).indexOf(".");
  return i < 0 ? "" : String(path).slice(0, i);
}

/**
 * The editable unit rates for one instant trade.
 *
 * `seedConfig` is injected rather than imported so this module stays free of
 * the estimator's import graph — the settings screen is a client component and
 * has no business bundling the junk-removal pricer to render a text box. The
 * settings route passes INSTANT_ESTIMATE_DEFAULTS[trade].
 *
 * The SEED decides which fields exist, never the company's saved row: a saved
 * config that is missing `perDrawer` must still render an empty per-drawer box,
 * or the one rate that needs filling in is the one rate with no editor.
 *
 * Returns [] for a trade with no unit rates, which is most of them — they price
 * off a materials list or a tier table and have their own editors already.
 */
export function instantRateFields(trade, seedConfig) {
  const declared = [
    ...(ownEntry(PRICE_BOOK_FIELDS, trade) || []).filter((f) => !f.internal),
    ...(ownEntry(INSTANT_ONLY_FIELDS, trade) || []),
  ];

  const priced = declared
    .filter((f) => readRate(seedConfig, f.path) !== undefined)
    .map((f) => ({
      path: f.path,
      label: f.label,
      // The book writes its units as "$ / door"; the input already carries a $
      // prefix, so the suffix drops it rather than rendering "$ [150] $ / door".
      suffix: f.suffix ? String(f.suffix).replace(/^\$\s*/, "") : null,
      step: f.step ?? 1,
      group: groupOf(f.path),
    }));

  // Coalesce by group in declaration order, so the bare rates lead and the
  // add-ons arrive as one block rather than eleven undifferentiated boxes.
  return groupRateFields(priced).flatMap((b) => b.fields);
}

/** Group fields in declaration order, ungrouped ones keeping their own block. */
export function groupRateFields(fields) {
  const blocks = [];
  for (const field of fields || []) {
    const key = field.group || "";
    const last = blocks[blocks.length - 1];
    if (last && last.key === key) last.fields.push(field);
    else blocks.push({ key, fields: [field] });
  }
  return blocks;
}
