// lib/estimate/instantSeed.js
//
// Two things the instant estimator needs to know about a company's SERVICES,
// kept pure so the settings route, the public pricer and the check scripts all
// execute the same code.
//
//   1. Which painting scopes the company actually sells. Interior and exterior
//      painting are two service categories that share one `painting` estimator
//      (lib/trades/catalog.js), and until this file existed the public form
//      asked every homeowner "interior or exterior?" — including the customers
//      of a company that only does one — and the estimator priced whatever
//      they picked. An exterior-only painter was quoting interiors at their
//      base rate minus the surcharge that IS their exterior price.
//
//   2. The instant seed, derived from the company's own price book. The seed
//      is the starting point the settings form shows before a row is saved,
//      and cabinet refinishing already read it out of TRADE_PRICE_BOOKS so
//      "$150 a door" would not be typed twice. But it read the CODE book, not
//      the company's — a company that had set its own per-door rate under
//      Services & Pricing was still shown FieldQuo's $150 here — and painting
//      did not read the book at all. This generalises the cabinet pattern:
//      seed only, never the live price. The saved row is what prices, because
//      a saved row is what the company chose; when their services pricing
//      moves after that, the settings screen SAYS so and offers one button
//      (see seedDrift / applyDerivedSeed). Nothing re-derives automatically.
//
// ── The painting mapping, and why it is what it is ──────────────────────────
//
// The interior book prices a room from a complexity tier — standard / moderate
// / high — each carrying `wallPricePerSqft` plus per-room and per-item prices
// (ceiling, trim, doors). The exterior book does the same by surface: `siding`,
// `trim`, `fascia`, `deck`, `fence` per tier. The instant estimator is a flat
// $/sqft of surface × a scope surcharge × a condition surcharge.
//
//   base rate      = interior `complexity.standard.wallPricePerSqft` — the
//                    cleanest job's wall rate. Walls are what "surface area"
//                    on the instant form means; the per-room extras have no
//                    sqft equivalent and are not folded in.
//   exterior       = standard-tier `siding` over that base, as a percentage.
//   surcharge        Siding is the exterior's wall. When only exterior is
//                    sold, the base rate IS the siding rate and the surcharge
//                    is 0 — same number, no double-counting.
//   condition      = moderate and high tier wall rates over standard, as
//   surcharge        percentages. The book's own tier descriptions ("good wall
//                    condition" / "minor repairs" / "extensive repairs") are
//                    the instant form's good / fair / poor.
//
// What the book does NOT have is a paint GRADE. The old seed carried three
// invented grades (economy / standard / premium at 2.00 / 2.75 / 3.75) that no
// company's book expresses, so the derived seed carries ONE grade, "Standard",
// at the book's rate. A company that sells grades adds the rows on the
// settings screen — that is their number, typed by them, not a ratio we made
// up. The instant-only knobs (range band, painting's minimum charge) have no
// book equivalent and stay literal in INSTANT_ESTIMATE_DEFAULTS, said so there.
//
// A tier that is CHEAPER than the one below it derives as 0%, not a negative:
// the estimator's clampPct floors surcharges at 0, so a negative could not be
// saved anyway, and the drift notice will show the company the 0.
import { getPriceBook, readField, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { rateFieldPatch, readRate } from "@/lib/estimate/instantRateFields";

function num(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/** `above` over `base` as a surcharge fraction, two decimals, never negative. */
function surchargeOver(above, base) {
  const b = num(base);
  const a = num(above);
  if (!(b > 0) || !(a > 0)) return 0;
  return Math.max(0, Math.round((a / b - 1) * 100) / 100);
}

/* ── Painting scope ───────────────────────────────────────────────────────── */

export const PAINTING_SCOPES = ["interior", "exterior"];

/** The service category each scope is sold as. */
export const PAINTING_SCOPE_CATEGORY = {
  interior: "interior_painting",
  exterior: "exterior_painting",
};

/** Which painting scopes a company sells, from its enabled category keys. */
export function paintingScopesOffered(enabledCategoryKeys) {
  const set = new Set(Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : []);
  return PAINTING_SCOPES.filter((scope) => set.has(PAINTING_SCOPE_CATEGORY[scope]));
}

/**
 * The scope a painting estimate is priced at, given what the homeowner asked
 * for and what the company sells.
 *
 *   none offered   → not priceable; the trade is not offered at all
 *   one offered    → that one, whatever the browser said (`fixed: true`)
 *   both offered   → the homeowner's pick, or undefined when they made none —
 *                    the estimator's own default applies, exactly as before
 *
 * Nothing here pads an absent answer: "fixed" means the company's services
 * decided it, and the public form does not ask.
 */
export function resolvePaintingScope(requested, offered) {
  const list = Array.isArray(offered)
    ? PAINTING_SCOPES.filter((s) => offered.includes(s))
    : [];
  if (list.length === 0) return { ok: false, reason: "scope_not_offered" };
  if (list.length === 1) return { ok: true, scope: list[0], fixed: true };
  return {
    ok: true,
    scope: PAINTING_SCOPES.includes(requested) ? requested : undefined,
    fixed: false,
  };
}

/**
 * A measurement with its scope resolved against the company's services. Only
 * painting has a scope; every other trade's measurement passes through
 * untouched. Returns { ok:false, reason } when the trade is not offered.
 */
export function applyOfferedScope(trade, measurement, offered) {
  if (trade !== "painting") return { ok: true, measurement };
  const resolved = resolvePaintingScope(measurement?.scope, offered);
  if (!resolved.ok) return resolved;
  if (!resolved.fixed) return { ok: true, measurement };
  return { ok: true, measurement: { ...(measurement || {}), scope: resolved.scope } };
}

/* ── Seed derivation ──────────────────────────────────────────────────────── */

// Labels for the painting fields the drift notice compares. Cabinet
// refinishing's come from PRICE_BOOK_FIELDS — these four paths exist only in
// the instant config, so the book has no word for them.
const PAINTING_FIELDS = [
  { path: "materials.standard.ratePerSqft", label: "Base rate (Standard), per sqft", kind: "money" },
  { path: "scopeSurcharge.exterior", label: "Exterior surcharge", kind: "percent" },
  { path: "conditionSurcharge.fair", label: "Fair-condition surcharge", kind: "percent" },
  { path: "conditionSurcharge.poor", label: "Poor-condition surcharge", kind: "percent" },
];

const DERIVATIONS = {
  cabinet_refinishing: {
    categories: ["cabinet_refinishing"],
    derive({ books }) {
      const book = books?.cabinet_refinishing;
      if (!book) return null;
      return {
        perDoor: num(book.perDoor),
        perDrawer: num(book.perDrawer),
        // Dollars per face, not a percentage — an ornate kitchen costs a fixed
        // amount more per door to prep whatever the base rate is.
        complexityUpchargePerUnit: { ...(book.complexityUpchargePerUnit || {}) },
        addOns: { ...(book.addOns || {}) },
        // The book calls this `minimumTotal`; every instant config calls its
        // floor `minCharge`, and toRange() is what applies it.
        minCharge: num(book.minimumTotal),
      };
    },
    fields() {
      const declared = (PRICE_BOOK_FIELDS.cabinet_refinishing || [])
        .filter((f) => !f.internal)
        .map((f) => ({ path: f.path, label: f.label, kind: "money" }));
      return [...declared, { path: "minCharge", label: "Minimum charge", kind: "money" }];
    },
  },
  painting: {
    categories: ["interior_painting", "exterior_painting"],
    derive({ books, offered }) {
      const scopes = PAINTING_SCOPES.filter((s) => (offered || []).includes(s));
      const interior = scopes.includes("interior") ? books?.interior_painting : null;
      const exterior = scopes.includes("exterior") ? books?.exterior_painting : null;

      const wall = (level) => num(readField(interior, `complexity.${level}.wallPricePerSqft`));
      const siding = (level) => num(readField(exterior, `complexity.${level}.siding`));

      // The base is interior walls when they are sold, else exterior siding.
      // A rate the company zeroed is "no rate", not "free", so it falls
      // through to the other scope or to null.
      const baseIsInterior = wall("standard") > 0;
      const base = baseIsInterior ? wall("standard") : siding("standard") > 0 ? siding("standard") : 0;
      if (!(base > 0)) return null;

      const tier = baseIsInterior ? wall : siding;
      return {
        materials: [{ key: "standard", label: "Standard", ratePerSqft: base }],
        scopeSurcharge: {
          interior: 0,
          exterior: baseIsInterior && siding("standard") > 0 ? surchargeOver(siding("standard"), base) : 0,
        },
        conditionSurcharge: {
          good: 0,
          fair: surchargeOver(tier("moderate"), base),
          poor: surchargeOver(tier("high"), base),
        },
      };
    },
    fields() {
      return PAINTING_FIELDS;
    },
  },
};

/** The instant trades whose seed can be read out of a price book. */
export const DERIVED_SEED_TRADES = Object.keys(DERIVATIONS);

/** The service categories a trade's seed derives from. */
export function seedCategoriesFor(trade) {
  return DERIVATIONS[trade]?.categories || [];
}

/**
 * Build the derivation inputs from the company's enabled category rows:
 * `{ key, rates }` per enabled CompanyServiceCategory. A category that is off
 * contributes no book — the company doesn't sell it, so its rates are not
 * theirs to inherit from.
 */
export function seedInputsFor(trade, enabledCategoryRows) {
  const wanted = new Set(seedCategoriesFor(trade));
  const rows = Array.isArray(enabledCategoryRows) ? enabledCategoryRows : [];
  const books = {};
  for (const row of rows) {
    const key = row?.key;
    if (!wanted.has(key)) continue;
    const book = getPriceBook(key, row.rates);
    if (book) books[key] = book;
  }
  return {
    books,
    offered: paintingScopesOffered(rows.map((r) => r?.key)),
  };
}

/**
 * The part of an instant config a price book can state, or null when the
 * trade has no derivation or the books cannot state it.
 */
export function deriveInstantSeed(trade, { books, offered } = {}) {
  const spec = DERIVATIONS[trade];
  if (!spec) return null;
  return spec.derive({ books: books || {}, offered: offered || [] });
}

/**
 * The derivation over the CODE books with every category sold — what
 * INSTANT_ESTIMATE_DEFAULTS carries, so the literal seed and a company's
 * derived one share one shape.
 */
export function defaultDerivedSeed(trade) {
  const categories = seedCategoriesFor(trade);
  return deriveInstantSeed(
    trade,
    seedInputsFor(
      trade,
      categories.map((key) => ({ key, rates: null })),
    ),
  );
}

/** The fields the drift compares for a trade — [{ path, label, kind }]. */
export function seedFields(trade) {
  return DERIVATIONS[trade]?.fields() || [];
}

// `materials.<key>.<rate>` reads a row of the materials list by its key;
// everything else is a dotted config path through the own-property reader.
function parseMaterialPath(path) {
  const m = /^materials\.([^.]+)\.([^.]+)$/.exec(String(path));
  return m ? { key: m[1], rate: m[2] } : null;
}

/** One comparable value out of a config. undefined when the config lacks it. */
export function readSeedValue(config, path) {
  const mat = parseMaterialPath(path);
  if (!mat) return readRate(config, path);
  const rows = Array.isArray(config?.materials) ? config.materials : [];
  const row = rows.find((r) => r && typeof r === "object" && r.key === mat.key);
  return row ? row[mat.rate] : undefined;
}

/**
 * Where a saved row and the derived seed disagree — [{ path, label, kind,
 * saved, derived }]. A field the saved row never set counts: "not set here"
 * is a real difference, and the one the company most needs to hear about.
 */
export function seedDrift(trade, savedConfig, derived) {
  if (!derived) return [];
  const out = [];
  for (const field of seedFields(trade)) {
    const there = readSeedValue(derived, field.path);
    if (there === undefined) continue; // the book doesn't state it either
    const here = readSeedValue(savedConfig, field.path);
    const same =
      here !== undefined &&
      Number.isFinite(Number(here)) &&
      Math.abs(Number(here) - Number(there)) < 1e-9;
    if (!same) out.push({ ...field, saved: here, derived: there });
  }
  return out;
}

/**
 * The config with the derived seed applied over it. Everything the book does
 * not state — the visibility mode, the budget bands, the range band, extra
 * material grades the company added — is kept. A materials row is updated in
 * place by key, or appended when the company has no row of that key.
 */
export function applyDerivedSeed(trade, config, derived) {
  if (!derived) return config;
  let next = { ...(config || {}) };
  for (const field of seedFields(trade)) {
    const value = readSeedValue(derived, field.path);
    if (value === undefined) continue;
    const mat = parseMaterialPath(field.path);
    if (mat) {
      const rows = Array.isArray(next.materials)
        ? next.materials.filter((r) => r && typeof r === "object")
        : [];
      const idx = rows.findIndex((r) => r.key === mat.key);
      const template = (derived.materials || []).find((r) => r?.key === mat.key) || {};
      const row = idx >= 0 ? { ...rows[idx], [mat.rate]: value } : { ...template, [mat.rate]: value };
      next.materials = idx >= 0 ? rows.map((r, i) => (i === idx ? row : r)) : [...rows, row];
      continue;
    }
    const patch = rateFieldPatch(next, field.path, value);
    if (patch) next = { ...next, ...patch };
  }
  return next;
}
