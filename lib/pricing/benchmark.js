// lib/pricing/benchmark.js
//
// What the market charges, from what the market actually entered.
//
// ── The shape of the problem ───────────────────────────────────────────────
//
// Fifteen painting companies price cabinet doors. They enter, in their own
// words: "New Painted MDF Doors", "Painted door", "Door - paint", "MDF doors
// (painted)". Same line item, four names, and no string equality will ever
// join them. What they DO agree on is the unit — every one of them is priced
// `/door` — and that is the anchor this file is built on.
//
// So a benchmark group is (trade, what-it-is, unit). Never (trade, name):
// names are free text. Never (trade, what-it-is) alone either — $18/linear ft
// and $150/each are both real prices for real work and averaging them
// produces a number describing nothing.
//
// ── Median, not mean ───────────────────────────────────────────────────────
//
// One company typing 99999 into a field moves a mean of eight by twelve
// thousand dollars. It moves the median by nothing. Both are returned, because
// a large gap between them is itself the signal that somebody fat-fingered a
// price — but the median is what a contractor is shown.
//
// ── Why there is a floor, and why it isn't hedging ─────────────────────────
//
// Below MIN_COHORT distinct companies this returns nothing at all. Not a
// smaller number with a caveat — nothing.
//
// Two independent reasons, and the second is the one that matters:
//
//   1. "The average" computed from two companies is one contractor's price
//      wearing a word that implies consensus.
//
//   2. With two companies in a group, each one can subtract its own price from
//      the published average and recover the other's exactly. At three they
//      can bound it tightly. A benchmark that lets a competitor derive a rival's
//      rate is not a benchmark, it is a disclosure — and it would be one
//      FieldQuo performed on a customer who never agreed to it.
//
// The floor is k-anonymity, not caution.

/**
 * Minimum distinct companies before a group is published.
 *
 * Five, because four still allows a usefully tight bound on any single member
 * once you know your own value and the mean. Raise it, never lower it.
 */
export const MIN_COHORT = 5;

/**
 * How far from the median counts as "you are out of step".
 *
 * 15% either side. Inside that band a contractor is told they are in line —
 * being told to change a price that is already normal is noise, and noise is
 * how a feature like this gets ignored.
 */
export const IN_LINE_BAND = 0.15;

/**
 * Reduce a free-text service name to something two companies can match on.
 *
 * Deliberately conservative. It folds case, punctuation, bracketed asides and
 * filler words — the differences that are certainly cosmetic. It does NOT try
 * to decide that "MDF door" and "thermofoil door" are the same thing, because
 * they are not: one is a paint job and one is a wrap, and they price 10 apart
 * in the sample data. That judgement is what the AI clustering pass is for,
 * and it belongs in a place a human can review before it merges anything.
 */
export function normalizeServiceName(name) {
  return String(name || "")
    .toLowerCase()
    // Bracketed and dashed asides: "Cabinet Box Skinning — veneer/laminate"
    // and "Cabinet box skinning" should meet.
    .replace(/[—–-]\s.*$/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    // Filler that carries no meaning in a line-item name.
    .replace(/\b(new|the|a|an|and|with|per|each|supply|install|only)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Crude plural fold, applied to the whole phrase's last word only:
    // "doors" -> "door", "hinges" -> "hinge". Words ending "ss" are left
    // alone so "glass" survives.
    .replace(/(\w{3,})(?<!s)s$/, "$1");
}

/**
 * Units that mean the same thing.
 *
 * ── The count family ───────────────────────────────────────────────────────
 *
 * "door", "drawer", "each", "unit", "piece" all collapse to `each`. That looks
 * aggressive until you look at real entries: the same cabinet door is written
 * `95 / door` by one company and `95 / each` by the next, and keeping them
 * apart splits one benchmark into two that each fall under the cohort floor —
 * so the honest average silently becomes no average at all.
 *
 * It is safe because the ITEM NAME is part of the group key. "Painted door /
 * each" and "Painted door / door" merge; "Painted door / each" and "Handles /
 * each" do not, because the names never fold. The unit disambiguates the
 * MEASURE, and the name disambiguates the thing.
 *
 * Area, length, time and flat rates are NOT in the family. $18/linear ft and
 * $18/sq ft are different prices for different work, and a contractor reading
 * one as the other would quote the wrong number.
 */
const UNIT_ALIASES = {
  ea: "each",
  unit: "each",
  pc: "each",
  piece: "each",
  door: "each",
  doors: "each",
  drawer: "each",
  drawers: "each",
  panel: "each",
  panels: "each",
  lf: "linear ft",
  "lin ft": "linear ft",
  "linear foot": "linear ft",
  "linear feet": "linear ft",
  sf: "sq ft",
  sqft: "sq ft",
  "square ft": "sq ft",
  "square foot": "sq ft",
  "square feet": "sq ft",
  hr: "hour",
  hrs: "hour",
  hours: "hour",
  flat: "flat",
  "flat rate": "flat",
  job: "flat",
};

export function normalizeUnit(unit) {
  const u = String(unit || "").toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!u) return null;
  return UNIT_ALIASES[u] || u;
}

/** Numeric, finite, and a price a human could plausibly have meant. */
function usablePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Zero is not a price, it is an unfilled field that happens to parse.
  // Negative is a data error. The upper bound catches a misplaced decimal
  // without discarding a genuinely large flat rate.
  if (n <= 0 || n > 1_000_000) return null;
  return n;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

/**
 * Build benchmark groups from raw priced rows.
 *
 * @param rows  [{ companyId, categoryKey, categoryLabel, name, unit, price, source }]
 * @param opts  { minCohort }
 * @returns [{ key, categoryKey, categoryLabel, label, unit, companies, samples,
 *             median, mean, p25, p75, min, max, spread }]
 */
export function buildBenchmarks(rows, opts = {}) {
  const minCohort = Number.isFinite(opts.minCohort) ? opts.minCohort : MIN_COHORT;
  const groups = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const price = usablePrice(row?.price);
    if (price === null) continue;

    const categoryKey = row?.categoryKey;
    const unit = normalizeUnit(row?.unit);
    const norm = normalizeServiceName(row?.name);
    // A row with no trade, no unit or no name can't be grouped with anything.
    // Dropped rather than bucketed into an "other" pile, which would average
    // unrelated work and call it a benchmark.
    if (!categoryKey || !unit || !norm) continue;

    const key = `${categoryKey}::${norm}::${unit}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        categoryKey,
        categoryLabel: row.categoryLabel || categoryKey,
        // The most common ORIGINAL spelling is shown, not the normalised one:
        // "soft close hinge" is what the matcher works on, "Soft-Close Hinges"
        // is what a contractor recognises.
        names: new Map(),
        // The canonical unit groups; the original spelling is what a
        // contractor reads. "per door" means more to a cabinet painter than
        // "per each", even though the two had to be merged to get an average
        // at all.
        units: new Map(),
        unit,
        prices: [],
        companies: new Set(),
      });
    }

    const g = groups.get(key);
    const display = String(row.name || "").trim();
    if (display) g.names.set(display, (g.names.get(display) || 0) + 1);
    const rawUnit = String(row.unit || "").trim();
    if (rawUnit) g.units.set(rawUnit, (g.units.get(rawUnit) || 0) + 1);
    g.prices.push(price);
    g.companies.add(row.companyId);
  }

  const out = [];
  for (const g of groups.values()) {
    // The floor counts COMPANIES, not rows. One company with eight priced
    // variations of the same item is one opinion about the market, however
    // many rows it wrote.
    if (g.companies.size < minCohort) continue;

    const sorted = [...g.prices].sort((a, b) => a - b);
    const median = quantile(sorted, 0.5);
    const mean = sorted.reduce((s, n) => s + n, 0) / sorted.length;

    out.push({
      key: g.key,
      categoryKey: g.categoryKey,
      categoryLabel: g.categoryLabel,
      label: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || g.key,
      unit: g.unit,
      displayUnit:
        [...g.units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || g.unit,
      companies: g.companies.size,
      samples: sorted.length,
      median: round2(median),
      mean: round2(mean),
      p25: round2(quantile(sorted, 0.25)),
      p75: round2(quantile(sorted, 0.75)),
      min: round2(sorted[0]),
      max: round2(sorted[sorted.length - 1]),
      // A mean far from the median means one entry is dragging it. Surfaced
      // rather than silently corrected — it usually means somebody typed a
      // price wrong, and that is worth knowing.
      skewed: median > 0 && Math.abs(mean - median) / median > 0.25,
    });
  }

  return out.sort(
    (a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel) ||
      b.companies - a.companies ||
      a.label.localeCompare(b.label),
  );
}

/**
 * Where one company's price sits against a group.
 *
 * @returns { position, deltaPct, median, unit } | null
 *   position: "below" | "in_line" | "above"
 *
 * `deltaPct` is signed and relative to the median, so -22 reads as "22% under
 * the middle of the market" without the caller doing arithmetic.
 */
export function comparePrice(price, group, band = IN_LINE_BAND) {
  const p = usablePrice(price);
  if (p === null || !group || !group.median) return null;

  const delta = (p - group.median) / group.median;
  const position =
    delta < -band ? "below" : delta > band ? "above" : "in_line";

  return {
    position,
    deltaPct: Math.round(delta * 1000) / 10,
    median: group.median,
    unit: group.unit,
    companies: group.companies,
  };
}

/**
 * Match a company's own priced rows against the benchmark set.
 *
 * Returns only the rows that HAVE a benchmark to compare to, in the order a
 * contractor should care: furthest out of step first. A screen showing forty
 * "in line" rows above the one that is 40% under buries the finding.
 */
export function compareCompany(rows, benchmarks, opts = {}) {
  const byKey = new Map(benchmarks.map((b) => [b.key, b]));
  const results = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const price = usablePrice(row?.price);
    const unit = normalizeUnit(row?.unit);
    const norm = normalizeServiceName(row?.name);
    if (price === null || !unit || !norm || !row?.categoryKey) continue;

    const group = byKey.get(`${row.categoryKey}::${norm}::${unit}`);
    if (!group) continue;

    const cmp = comparePrice(price, group, opts.band);
    if (!cmp) continue;

    results.push({
      name: row.name,
      categoryLabel: group.categoryLabel,
      yourPrice: round2(price),
      ...cmp,
      p25: group.p25,
      p75: group.p75,
    });
  }

  return results.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

/**
 * Custom names that did NOT reach a benchmark, grouped by trade.
 *
 * This is the input to the clustering pass — the question "are forty
 * contractors all inventing the same line item under forty names?". Deliberately
 * a separate, plain-data output rather than something this file decides: naming
 * is fuzzy, and merging two services because their words overlap is a judgement
 * that should be reviewable before it moves anybody's price.
 */
export function unmatchedNames(rows, benchmarks) {
  const matched = new Set(benchmarks.map((b) => b.key));
  const byTrade = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const price = usablePrice(row?.price);
    const unit = normalizeUnit(row?.unit);
    const norm = normalizeServiceName(row?.name);
    if (price === null || !unit || !norm || !row?.categoryKey) continue;
    if (matched.has(`${row.categoryKey}::${norm}::${unit}`)) continue;

    const trade = row.categoryLabel || row.categoryKey;
    if (!byTrade.has(trade)) byTrade.set(trade, new Map());
    const bucket = byTrade.get(trade);
    const k = `${row.name}::${unit}`;
    if (!bucket.has(k)) {
      bucket.set(k, { name: row.name, unit, prices: [], companies: new Set() });
    }
    bucket.get(k).prices.push(price);
    bucket.get(k).companies.add(row.companyId);
  }

  return [...byTrade.entries()].map(([trade, bucket]) => ({
    trade,
    items: [...bucket.values()]
      .map((i) => ({
        name: i.name,
        unit: i.unit,
        companies: i.companies.size,
        samples: i.prices.length,
        median: round2(quantile([...i.prices].sort((a, b) => a - b), 0.5)),
      }))
      .sort((a, b) => b.companies - a.companies),
  }));
}
