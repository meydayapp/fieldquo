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
//
// ── Where the market is, not only what it is ───────────────────────────────
//
// A painter's door price in Toronto is not a painter's door price in rural
// Saskatchewan, so `scope: "region"` slices the same groups by geography.
// Three things about that slice are load-bearing:
//
//   1. CURRENCY IS A HARD BOUNDARY. A CAD price averaged with a USD one is a
//      number that is wrong in both currencies. Rows in different billing
//      currencies never meet, and a row with no currency is refused rather
//      than guessed at — see the throw in buildBenchmarks.
//
//   2. THE FLOOR GETS HARDER WHEN YOU SLICE, SO THE SCOPE IS ALWAYS STATED.
//      Five companies nationally is achievable; five painters quoting the same
//      door in one province often is not. A province group is published only
//      when it clears MIN_COHORT on its own, and a company whose province
//      doesn't clear falls back to the country number — but every group
//      carries `scope`, `country` and `province`, so the UI says "Ontario" or
//      "Canada" truthfully. A national average presented as a local one is the
//      worst outcome available here; nothing in this file may produce it.
//
//   3. THERE IS NO LEVEL BETWEEN PROVINCE AND COUNTRY. "Prairies",
//      "Northeast", "Greater Toronto" are judgements about which markets
//      behave alike, and nothing in the schema supports them. `city`,
//      `postalCode` and lat/lng exist, but a city cohort essentially never
//      reaches five distinct companies for one line item, and a radius around
//      a point is a made-up market boundary wearing a number.
//
// ── The leak that publishing two granularities creates ─────────────────────
//
// Publishing "Canada, 8 companies" and "Ontario, 6 companies" from the same
// rows publishes a third thing nobody asked for: everyone else. Country sum
// minus province sum is the exact aggregate of the two companies outside
// Ontario, and either of them can subtract itself and read the other's price —
// the disclosure the floor exists to prevent, reached by arithmetic instead of
// a small group.
//
// So the country group is withheld when the companies it covers that no
// published province group covers number between one and MIN_COHORT - 1. The
// province groups are kept and the country group is the one dropped, because
// each province group satisfies the floor on its own evidence, and the only
// company the national number uniquely serves is the one in the thin residual
// — precisely the company the arithmetic would expose.

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

/**
 * An ISO 4217 code, or null.
 *
 * Null means "this row cannot be placed", never "assume the default". Padding
 * a missing currency with CAD is how a US company's dollars end up inside a
 * Canadian average — the caller has `Company.currency` and must send it.
 */
export function normalizeCurrency(value) {
  const c = String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return c.length === 3 ? c : null;
}

/**
 * Fold a country or province/state to a comparison key.
 *
 * Case and punctuation only. "ON" and "Ontario" deliberately do NOT fold into
 * each other: that needs a name↔code table per country, and getting one entry
 * wrong merges two markets silently. The cost of not doing it is that a
 * province typed both ways splits into two cohorts, each of which fails the
 * floor and falls back to the country number — a truthfully-labelled national
 * average, which is the safe direction to be wrong in. The real fix is a
 * province picker at data entry, not a guess here.
 */
export function normalizeRegionCode(value) {
  const s = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
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
 * The item identity, independent of geography: (trade, what-it-is, unit).
 *
 * Also the `key` of an unscoped group, which is what every existing caller
 * matches on — so it must keep exactly this shape.
 */
function itemKeyFor(categoryKey, norm, unit) {
  return `${categoryKey}::${norm}::${unit}`;
}

/**
 * The published key of a group, unique across scopes.
 *
 * Unscoped stays the bare item key so nothing that already matches on it
 * changes. Scoped keys are prefixed, never suffixed, so the currency and place
 * are the first thing anyone reading a log sees.
 */
function groupKeyFor(itemKey, scope, currency, country, province) {
  if (scope === "province") return `${currency}:${country}-${province}::${itemKey}`;
  if (scope === "country") return `${currency}:${country}::${itemKey}`;
  return itemKey;
}

/** Province-less rows still belong to their country; they need a bucket name. */
const NO_PROVINCE = " no-province";

const emptyLeaf = (province) => ({
  province,
  prices: [],
  // The most common ORIGINAL spelling is shown, not the normalised one:
  // "soft close hinge" is what the matcher works on, "Soft-Close Hinges" is
  // what a contractor recognises.
  names: new Map(),
  // The canonical unit groups; the original spelling is what a contractor
  // reads. "per door" means more to a cabinet painter than "per each", even
  // though the two had to be merged to get an average at all.
  units: new Map(),
  companies: new Set(),
});

function addToLeaf(leaf, row, price) {
  const display = String(row.name || "").trim();
  if (display) leaf.names.set(display, (leaf.names.get(display) || 0) + 1);
  const rawUnit = String(row.unit || "").trim();
  if (rawUnit) leaf.units.set(rawUnit, (leaf.units.get(rawUnit) || 0) + 1);
  leaf.prices.push(price);
  leaf.companies.add(row.companyId);
}

/**
 * The country cohort is every leaf in the country, including the provinces
 * that published on their own and the rows whose company never set one.
 *
 * Not "the provinces that didn't clear the floor": that would be a rest-of-
 * country figure labelled Canada, which is the same lie as a national average
 * labelled Ontario, just pointing the other way.
 */
function mergeLeaves(leaves) {
  const merged = emptyLeaf(null);
  for (const leaf of leaves) {
    // Spread would pass every price as an argument and blow the stack on a
    // real dataset.
    for (const p of leaf.prices) merged.prices.push(p);
    for (const c of leaf.companies) merged.companies.add(c);
    for (const [k, n] of leaf.names) merged.names.set(k, (merged.names.get(k) || 0) + n);
    for (const [k, n] of leaf.units) merged.units.set(k, (merged.units.get(k) || 0) + n);
  }
  return merged;
}

const mostCommon = (counts) =>
  [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

function summarise(item, leaf, scope, currency, country, province) {
  const sorted = [...leaf.prices].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const mean = sorted.reduce((s, n) => s + n, 0) / sorted.length;

  const group = {
    key: groupKeyFor(item.itemKey, scope, currency, country, province),
    // The same line item across every scope. A caller showing "Ontario" and
    // "Canada" side by side pairs them on this.
    itemKey: item.itemKey,
    categoryKey: item.categoryKey,
    categoryLabel: item.categoryLabel,
    label: mostCommon(leaf.names) || item.itemKey,
    unit: item.unit,
    displayUnit: mostCommon(leaf.units) || item.unit,
    companies: leaf.companies.size,
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
    // Always present, including unscoped: a consumer must never have to infer
    // from the absence of a field whether this number is local.
    scope,
  };

  if (scope !== "global") {
    group.currency = currency;
    group.country = country;
    group.province = province ?? null;
  }

  return group;
}

const SCOPE_RANK = { province: 0, country: 1, global: 2 };

/**
 * Build benchmark groups from raw priced rows.
 *
 * @param rows  [{ companyId, categoryKey, categoryLabel, name, unit, price, source,
 *                 currency, country, province }]
 *              currency/country/province are read only when scoping is asked
 *              for, and describe the COMPANY that entered the row.
 * @param opts  { minCohort, scope }
 *              scope: "none" (default) — one global pool, exactly as before.
 *                     "region" — province where the cohort clears the floor,
 *                     country otherwise, never mixing currencies.
 * @returns [{ key, itemKey, categoryKey, categoryLabel, label, unit, displayUnit,
 *             companies, samples, median, mean, p25, p75, min, max, skewed,
 *             scope, currency?, country?, province? }]
 *          `scope` is "global" | "country" | "province"; currency/country/
 *          province are present on everything except "global".
 * @throws  when scoping is asked for and a priced row carries no currency.
 */
export function buildBenchmarks(rows, opts = {}) {
  const minCohort = Number.isFinite(opts.minCohort) ? opts.minCohort : MIN_COHORT;
  const scope = opts.scope === undefined || opts.scope === null ? "none" : String(opts.scope);
  // An unrecognised scope must not quietly become "none". A caller that asked
  // for local numbers and silently got national ones is the failure this whole
  // design exists to prevent.
  if (scope !== "none" && scope !== "region") {
    throw new Error(`buildBenchmarks: unknown scope "${scope}" (expected "none" or "region")`);
  }
  const regional = scope === "region";

  const items = new Map();

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

    let currency = null;
    let country = null;
    let province = null;

    if (regional) {
      currency = normalizeCurrency(row?.currency);
      if (!currency) {
        // Not a drop and not a default. Every other missing field here means
        // "this row joins nothing"; a missing currency means "this row would
        // join the WRONG thing", and there is no safe answer to invent. The
        // caller has Company.currency — see lib/pricing/benchmarkData.js.
        throw new Error(
          'buildBenchmarks({ scope: "region" }) needs a currency on every priced row; ' +
            `"${String(row?.name || "").slice(0, 60)}" has none. Averaging two currencies ` +
            "produces a number that is wrong in both, and defaulting one is the same bug " +
            "with a nicer name — supply Company.currency on the row.",
        );
      }
      country = normalizeRegionCode(row?.country);
      // No country is no cohort — the same treatment as no unit, for the same
      // reason: there is nothing this row can honestly be averaged with. It is
      // NOT the province case below, which does still count nationally.
      if (!country) continue;
      // Null province is expected and kept: the company still belongs to its
      // country, and dropping it would shrink every national average.
      province = normalizeRegionCode(row?.province);
    }

    const itemKey = itemKeyFor(categoryKey, norm, unit);
    if (!items.has(itemKey)) {
      items.set(itemKey, {
        itemKey,
        categoryKey,
        categoryLabel: row.categoryLabel || categoryKey,
        unit,
        pools: new Map(),
      });
    }
    const item = items.get(itemKey);

    // One pool per (currency, country). Currency first because it is the hard
    // boundary: two countries billing the same currency still never merge, but
    // one country billing two currencies must not either.
    const poolKey = regional ? `${currency}::${country}` : "";
    if (!item.pools.has(poolKey)) {
      item.pools.set(poolKey, { currency, country, leaves: new Map() });
    }
    const pool = item.pools.get(poolKey);

    const leafKey = province ?? NO_PROVINCE;
    if (!pool.leaves.has(leafKey)) pool.leaves.set(leafKey, emptyLeaf(province));
    addToLeaf(pool.leaves.get(leafKey), row, price);
  }

  const out = [];
  for (const item of items.values()) {
    for (const pool of item.pools.values()) {
      const leaves = [...pool.leaves.values()];

      // The floor counts COMPANIES, not rows. One company with eight priced
      // variations of the same item is one opinion about the market, however
      // many rows it wrote. That is true at every scope.
      if (!regional) {
        const [leaf] = leaves;
        if (!leaf || leaf.companies.size < minCohort) continue;
        out.push(summarise(item, leaf, "global", null, null, null));
        continue;
      }

      const published = leaves.filter(
        (l) => l.province !== null && l.companies.size >= minCohort,
      );
      for (const leaf of published) {
        out.push(summarise(item, leaf, "province", pool.currency, pool.country, leaf.province));
      }

      const national = mergeLeaves(leaves);
      if (national.companies.size < minCohort) continue;

      if (published.length) {
        // Everyone the national number covers that no published province group
        // covers. Country minus provinces is arithmetic anybody can do, so this
        // set is effectively published too — and it has to clear the floor like
        // any other cohort. A company that appears in both a published province
        // and an unpublished leaf counts here: its uncovered rows are the ones
        // the subtraction exposes.
        const residual = new Set();
        for (const leaf of leaves) {
          if (published.includes(leaf)) continue;
          for (const c of leaf.companies) residual.add(c);
        }
        if (residual.size > 0 && residual.size < minCohort) continue;
      }

      out.push(summarise(item, national, "country", pool.currency, pool.country, null));
    }
  }

  return out.sort(
    (a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel) ||
      b.companies - a.companies ||
      a.label.localeCompare(b.label) ||
      // Tiebreakers that only ever fire once geography is in play, so unscoped
      // ordering is byte-for-byte what it was.
      String(a.currency || "").localeCompare(String(b.currency || "")) ||
      String(a.country || "").localeCompare(String(b.country || "")) ||
      SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope] ||
      String(a.province || "").localeCompare(String(b.province || "")),
  );
}

/**
 * The keys a row could match, most local first.
 *
 * This is the fallback, and it is the only place it happens: province, then
 * country, then the unscoped pool. Because each group states its own `scope`,
 * a caller that lands on the second or third entry can see that it did.
 */
export function benchmarkLookupKeys(row) {
  const categoryKey = row?.categoryKey;
  const unit = normalizeUnit(row?.unit);
  const norm = normalizeServiceName(row?.name);
  if (!categoryKey || !unit || !norm) return [];

  const itemKey = itemKeyFor(categoryKey, norm, unit);
  const currency = normalizeCurrency(row?.currency);
  const country = normalizeRegionCode(row?.country);
  const province = normalizeRegionCode(row?.province);

  const keys = [];
  // Without a currency there is no scoped cohort this row belongs to — it can
  // only match an unscoped benchmark, which is the honest answer.
  if (currency && country && province) {
    keys.push(groupKeyFor(itemKey, "province", currency, country, province));
  }
  if (currency && country) {
    keys.push(groupKeyFor(itemKey, "country", currency, country, null));
  }
  keys.push(itemKey);
  return keys;
}

/** Benchmarks by published key, for repeated lookups. */
export function indexBenchmarks(benchmarks) {
  const index = new Map();
  for (const b of Array.isArray(benchmarks) ? benchmarks : []) {
    if (b?.key && !index.has(b.key)) index.set(b.key, b);
  }
  return index;
}

/**
 * The most local benchmark that covers this row, or null.
 *
 * Accepts either the array or an index from indexBenchmarks — a per-row caller
 * in a render loop should pass the index and not rebuild it each time.
 */
export function selectGroup(benchmarks, row) {
  const index = benchmarks instanceof Map ? benchmarks : indexBenchmarks(benchmarks);
  for (const key of benchmarkLookupKeys(row)) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}

/**
 * Where one company's price sits against a group.
 *
 * @returns { position, deltaPct, median, unit, companies, scope, country, province } | null
 *   position: "below" | "in_line" | "above"
 *
 * `deltaPct` is signed and relative to the median, so -22 reads as "22% under
 * the middle of the market" without the caller doing arithmetic.
 *
 * The scope travels with the comparison, not just with the group, because this
 * is the shape a screen renders from: "12% under Ontario" and "12% under
 * Canada" are different claims and the caller must be able to tell them apart.
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
    scope: group.scope || "global",
    currency: group.currency ?? null,
    country: group.country ?? null,
    province: group.province ?? null,
  };
}

/**
 * Match a company's own priced rows against the benchmark set.
 *
 * Returns only the rows that HAVE a benchmark to compare to, in the order a
 * contractor should care: furthest out of step first. A screen showing forty
 * "in line" rows above the one that is 40% under buries the finding.
 *
 * With regional benchmarks the row's own currency/country/province decide
 * which group it is measured against, most local first. Each result says which
 * scope it landed on.
 */
export function compareCompany(rows, benchmarks, opts = {}) {
  const index = indexBenchmarks(benchmarks);
  const results = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const price = usablePrice(row?.price);
    if (price === null) continue;

    const group = selectGroup(index, row);
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
  // Matched on the ITEM, not the scoped key: the question here is "did anyone
  // anywhere reach a benchmark for this line item", and an item that
  // benchmarks in Ontario is not an unnamed mystery for the clustering pass
  // just because this company is in Alberta.
  const matched = new Set(
    (Array.isArray(benchmarks) ? benchmarks : []).map((b) => b?.itemKey || b?.key),
  );
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
