// scripts/check-pricing-benchmark.mjs
//
//   npm run check:pricing-benchmark
//
// The benchmark engine, executed. Pure functions, hostile input, no database.
//
// The failure this guards hardest against is the quiet one: a benchmark that
// looks like a number and describes nothing — units mixed together, one
// fat-fingered price dragging a mean, or a "market average" computed from two
// companies who can each derive the other's rate from it.
import {
  buildBenchmarks,
  comparePrice,
  compareCompany,
  normalizeServiceName,
  normalizeUnit,
  normalizeCurrency,
  normalizeRegionCode,
  selectGroup,
  unmatchedNames,
  MIN_COHORT,
} from "../lib/pricing/benchmark.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

// Eight painting companies pricing a cabinet door, in their own words —
// the exact scenario this was built for.
const DOOR_PRICES = [150, 155, 130, 100, 200, 230, 175, 180];
// COSMETIC variants of one name — case, plurals, spacing, a bracketed aside.
// This is the realistic case for a DEFAULT service: the catalogue is seeded, so
// most companies carry the same wording and only edit the price.
const DOOR_NAMES = [
  "Painted Door", "painted doors", "PAINTED DOORS", "Painted  door",
  "Painted door (each)", "painted Doors", "Painted Doors", "painted door",
];
const doors = DOOR_PRICES.map((price, i) => ({
  companyId: `co${i}`, categoryKey: "interior_painting", categoryLabel: "Interior Painting",
  name: DOOR_NAMES[i], unit: i % 3 === 0 ? "door" : i % 3 === 1 ? "doors" : "each",
  price,
}));

console.log("\nName folding — the same line item in eight hands\n");
const normed = new Set(DOOR_NAMES.map(normalizeServiceName));
check("eight cosmetic spellings fold to one key", normed.size === 1);
check("bracketed asides are dropped", normalizeServiceName("MDF doors (painted)") === normalizeServiceName("MDF doors"));
check("a dashed aside is dropped", normalizeServiceName("Cabinet Box Skinning — veneer/laminate") === normalizeServiceName("Cabinet Box Skinning"));
check("plurals fold", normalizeServiceName("Soft-Close Hinges") === normalizeServiceName("soft close hinge"));
check("'glass' is not de-pluralised into 'glas'", normalizeServiceName("Glass Inserts").includes("glass"));
check("an empty name folds to empty", normalizeServiceName("") === "");
check("null doesn't throw", normalizeServiceName(null) === "");

// ── The boundary, asserted on purpose ────────────────────────────────────
//
// These are all cabinet doors and a human would group them. The normaliser
// does NOT, and must not: "MDF door" is a paint job, "thermofoil door" is a
// wrap, and they price 10 apart in the real catalogue. Deciding they are one
// service is a judgement about the trade, not about strings — it belongs to
// the AI clustering pass, where a person can review a merge before it moves
// anybody's price. If a future edit makes these fold, that is a regression.
const semantic = new Set([
  "Painted door", "New Painted MDF Doors", "Thermofoil / Vinyl-Wrapped Doors",
].map(normalizeServiceName));
check("semantically different door types do NOT silently merge", semantic.size === 3);

console.log("\nUnit aliasing — the anchor the whole thing rests on\n");
check("'doors' and 'door' are one unit", normalizeUnit("doors") === normalizeUnit("door"));
check("'ea' is 'each'", normalizeUnit("ea") === "each");
check("'LF' is 'linear ft'", normalizeUnit("LF") === "linear ft");
check("'sqft' is 'sq ft'", normalizeUnit("sqft") === "sq ft");
check("'hrs' is 'hour'", normalizeUnit("hrs") === "hour");
check("a missing unit is null, not a bucket", normalizeUnit("") === null);

// The count family. Same item, two spellings — splitting them turns one honest
// benchmark into two that each fall under the floor, so the average vanishes.
check("'door' and 'each' are one measure", normalizeUnit("door") === normalizeUnit("each"));
check("'drawer' joins them", normalizeUnit("drawers") === normalizeUnit("each"));
check("but 'linear ft' does NOT", normalizeUnit("linear ft") !== normalizeUnit("each"));
check("and 'sq ft' does NOT", normalizeUnit("sq ft") !== normalizeUnit("linear ft"));
check("'job' is a flat rate", normalizeUnit("job") === "flat");

console.log("\nThe average you asked for\n");
const b = buildBenchmarks(doors);
check("eight companies produce one group", b.length === 1);
const g = b[0];
// sorted: 100 130 150 155 175 180 200 230 → median = (155+175)/2 = 165
check("median is 165", g.median === 165);
check("mean is 165", g.mean === 165);
check("p25 and p75 bracket it", g.p25 < g.median && g.p75 > g.median);
check("min and max are the real ends", g.min === 100 && g.max === 230);
check("company count is eight", g.companies === 8);
check("the label is a name a painter would recognise", /door/i.test(g.label));
check("the unit is carried", g.unit === "each");
check("but a painter is shown 'door', not 'each'", /door/i.test(g.displayUnit));
check("not flagged as skewed", g.skewed === false);

console.log("\nThe k-anonymity floor\n");
check(`fewer than ${MIN_COHORT} companies publishes nothing`, buildBenchmarks(doors.slice(0, 4)).length === 0);
check(`exactly ${MIN_COHORT} publishes`, buildBenchmarks(doors.slice(0, 5)).length === 1);
// One company with eight priced variants is one opinion, not eight.
const oneCompany = DOOR_PRICES.map((price, i) => ({ ...doors[i], companyId: "same-co", price }));
check("one company entering eight rows does not clear the floor", buildBenchmarks(oneCompany).length === 0);

console.log("\nUnits are never mixed\n");
const mixed = [
  ...doors,
  ...[18, 20, 22, 19, 21].map((price, i) => ({
    companyId: `lf${i}`, categoryKey: "interior_painting", categoryLabel: "Interior Painting",
    name: "Painted door", unit: "linear ft", price,
  })),
];
const mb = buildBenchmarks(mixed);
check("same name, two units → two groups", mb.length === 2);
check("the per-door median is untouched by the linear-ft rows", mb.find((x) => x.unit !== "linear ft").median === 165);
check("the linear-ft group has its own median", mb.find((x) => x.unit === "linear ft").median === 20);

console.log("\nOne fat-fingered price\n");
const typo = [...doors, { companyId: "co9", categoryKey: "interior_painting", categoryLabel: "Interior Painting", name: "Painted door", unit: "door", price: 99999 }];
const tg = buildBenchmarks(typo)[0];
check("the median barely moves", tg.median === 175);
check("the mean is wrecked", tg.mean > 10000);
check("and it is flagged as skewed", tg.skewed === true);

console.log("\nGarbage prices are dropped, not bucketed\n");
const junk = [
  ...doors,
  { companyId: "z1", categoryKey: "interior_painting", categoryLabel: "x", name: "Painted door", unit: "door", price: 0 },
  { companyId: "z2", categoryKey: "interior_painting", categoryLabel: "x", name: "Painted door", unit: "door", price: -50 },
  { companyId: "z3", categoryKey: "interior_painting", categoryLabel: "x", name: "Painted door", unit: "door", price: null },
  { companyId: "z4", categoryKey: "interior_painting", categoryLabel: "x", name: "Painted door", unit: "door", price: "abc" },
  { companyId: "z5", categoryKey: "interior_painting", categoryLabel: "x", name: "Painted door", unit: "door", price: 5_000_000 },
];
check("zero, negative, null, non-numeric and absurd all dropped", buildBenchmarks(junk)[0].companies === 8);
check("a row with no unit is dropped", buildBenchmarks([...doors, { companyId: "n1", categoryKey: "interior_painting", name: "Painted door", price: 160 }])[0].companies === 8);
check("a row with no trade is dropped", buildBenchmarks([...doors, { companyId: "n2", name: "Painted door", unit: "door", price: 160 }])[0].companies === 8);

console.log("\nHostile input\n");
check("null rows returns []", buildBenchmarks(null).length === 0);
check("undefined returns []", buildBenchmarks(undefined).length === 0);
check("a list of nulls returns []", buildBenchmarks([null, undefined]).length === 0);
check("a string instead of rows returns []", buildBenchmarks("rows").length === 0);

console.log("\nWhere a company sits\n");
check("100 against a 165 median reads as below", comparePrice(100, g).position === "below");
check("230 reads as above", comparePrice(230, g).position === "above");
check("165 reads as in line", comparePrice(165, g).position === "in_line");
check("180 is within the 15% band", comparePrice(180, g).position === "in_line");
check("delta is signed and rounded", comparePrice(100, g).deltaPct === -39.4);
check("a null price compares to nothing", comparePrice(null, g) === null);
check("a missing group compares to nothing", comparePrice(150, null) === null);

console.log("\nA company's whole rate card against the market\n");
const mine = [
  { categoryKey: "interior_painting", name: "Painted Door", unit: "door", price: 100 },
  { categoryKey: "interior_painting", name: "Something we invented", unit: "each", price: 40 },
];
const cc = compareCompany(mine, b);
check("only rows with a benchmark come back", cc.length === 1);
check("furthest out of step is first", cc[0].position === "below");
check("it names the trade", cc[0].categoryLabel === "Interior Painting");
check("it carries your price and the quartiles", cc[0].yourPrice === 100 && cc[0].p25 > 0);

console.log("\nWhat didn't match — the clustering input\n");
const un = unmatchedNames(mine, b);
check("the invented line item is surfaced", un[0].items.some((i) => i.name === "Something we invented"));
check("the benchmarked one is not", !un[0].items.some((i) => /painted door/i.test(i.name)));

// ══════════════════════════════════════════════════════════════════════════
// Geography
//
// A painter's door price in Toronto is not a painter's door price in rural
// Saskatchewan. Everything below is about the two ways that goes wrong: a
// national average wearing a province's name, and a CAD average with USD in it.
// ══════════════════════════════════════════════════════════════════════════

const CO = (companyId, price, province, country = "CA", currency = "CAD") => ({
  companyId,
  categoryKey: "interior_painting",
  categoryLabel: "Interior Painting",
  name: "Painted Door",
  unit: "door",
  price,
  currency,
  country,
  province,
});
const inProvince = (prefix, prices, province, country, currency) =>
  prices.map((p, i) => CO(`${prefix}${i}`, p, province, country, currency));
const region = (rows, opts = {}) => buildBenchmarks(rows, { ...opts, scope: "region" });
const findScope = (groups, scope, province = null) =>
  groups.find((g) => g.scope === scope && (province === null || g.province === province));

console.log("\nNo scoping asked for, nothing about the answer changes\n");
// The existing platform screens call buildBenchmarks(rows) with no scope. The
// region fields are on the rows here and must be ignored completely.
const doorsWithRegion = doors.map((d, i) => ({
  ...d,
  currency: i % 2 ? "USD" : "CAD",
  country: i % 2 ? "US" : "CA",
  province: i % 2 ? "NY" : "ON",
}));
const unscoped = buildBenchmarks(doorsWithRegion);
check("region fields on the rows change nothing without a scope", unscoped.length === 1 && unscoped[0].median === 165);
check("the key is still the bare item key", unscoped[0].key === "interior_painting::painted door::each");
check("an unscoped group says so rather than leaving it to be guessed", unscoped[0].scope === "global");
check("and carries no country or province to be misread as local", unscoped[0].country === undefined && unscoped[0].province === undefined);
check("itemKey matches key when unscoped", unscoped[0].itemKey === unscoped[0].key);

// An unknown scope is a caller bug. Falling back to the global pool would hand
// back national numbers to somebody who asked for local ones — silently.
let threwOnScope = false;
try { buildBenchmarks(doorsWithRegion, { scope: "provinces" }); } catch { threwOnScope = true; }
check("an unrecognised scope throws instead of quietly going national", threwOnScope);

console.log("\nCurrency is a hard boundary\n");
// Five Ontario painters at ~100 CAD and five New York painters at ~100 USD.
// The numbers are deliberately identical, so a merge would be invisible in the
// median and only the group count would give it away.
const twoCurrencies = [
  ...inProvince("on", [100, 102, 104, 106, 108], "ON", "CA", "CAD"),
  ...inProvince("ny", [100, 102, 104, 106, 108], "NY", "US", "USD"),
];
const tc = region(twoCurrencies);
check("CAD and USD never share a group", tc.every((g) => g.samples <= 5));
check("each currency gets its own province group", tc.filter((g) => g.scope === "province").length === 2);
check("each currency gets its own country group", tc.filter((g) => g.scope === "country").length === 2);
check("every group names its currency", tc.every((g) => g.currency === "CAD" || g.currency === "USD"));
check("the CAD group holds only Canadian rows", tc.find((g) => g.currency === "CAD" && g.scope === "country").companies === 5);

// Same currency, two countries. Currency alone is not enough to merge on —
// a Canadian company billing USD is not in the American market.
const oneCurrencyTwoCountries = [
  ...inProvince("ca", [100, 100, 100, 100, 100], "ON", "CA", "USD"),
  ...inProvince("us", [200, 200, 200, 200, 200], "NY", "US", "USD"),
];
const octc = region(oneCurrencyTwoCountries);
check("one currency in two countries stays two markets", octc.filter((g) => g.scope === "country").length === 2);
check("and the medians are each country's own", octc.filter((g) => g.scope === "country").map((g) => g.median).sort((a, b) => a - b).join() === "100,200");

// No currency is not a licence to average. It is a wiring error in the caller,
// and the message has to say so — silently defaulting to CAD is how a US
// company's dollars end up in a Canadian median.
let currencyError = null;
try { region([...inProvince("on", [100, 101, 102, 103, 104], "ON"), CO("nc", 100, "ON", "CA", null)]); }
catch (e) { currencyError = e; }
check("a row with no currency throws rather than being averaged", currencyError !== null);
check("and the message tells the caller what to supply", /currency/i.test(currencyError?.message || ""));
check("a currency that isn't a currency is not a currency", normalizeCurrency("dollars") === null && normalizeCurrency("US$") === null);
check("case and spacing fold", normalizeCurrency(" cad ") === "CAD");

console.log("\nA province that clears the floor is reported as that province\n");
// Six Ontario painters — a real Ontario cohort — and five in Alberta.
const twoProvinces = [
  ...inProvince("on", [100, 102, 104, 106, 108, 110], "ON"),
  ...inProvince("ab", [300, 302, 304, 306, 308], "AB"),
];
const tp = region(twoProvinces);
const onGroup = findScope(tp, "province", "ON");
const abGroup = findScope(tp, "province", "AB");
const caGroup = findScope(tp, "country");
check("Ontario is published as Ontario", onGroup?.scope === "province" && onGroup.province === "ON");
check("its median is Ontario's, not the country's", onGroup.median === 105);
check("Alberta is its own market", abGroup.median === 304);
check("the country group is the whole country, not the leftovers", caGroup.samples === 11 && caGroup.companies === 11);
check("a country group carries no province to be mistaken for one", caGroup.province === null);
check("province and country groups pair on itemKey", onGroup.itemKey === caGroup.itemKey);
check("but never collide on key", onGroup.key !== caGroup.key);

console.log("\nA province that doesn't clear falls back — and says which\n");
// Three provinces of three. Nine companies nationally, nobody local enough.
const thin = [
  ...inProvince("on", [100, 102, 104], "ON"),
  ...inProvince("qc", [200, 202, 204], "QC"),
  ...inProvince("ab", [300, 302, 304], "AB"),
];
const tb = region(thin);
check("no province clears, so no province group is published", tb.every((g) => g.scope !== "province"));
check("the country group carries all nine", tb.length === 1 && tb[0].companies === 9);
const qcLookup = selectGroup(tb, CO("qc0", 200, "QC"));
check("a Quebec company still gets an answer", qcLookup !== null);
check("and it is labelled Canada, not Quebec", qcLookup.scope === "country" && qcLookup.province === null);
check("the fallback is legible from the group alone", qcLookup.country === "CA" && qcLookup.currency === "CAD");
// The whole point: the caller can tell the two apart without guessing.
check("an Ontario company in the other fixture gets the local one", selectGroup(tp, CO("on0", 100, "ON")).scope === "province");
check("a company in a province with no data at all falls back too", selectGroup(tp, CO("ns0", 100, "NS")).scope === "country");

console.log("\nA company with no province still counts nationally\n");
// Four in Ontario plus one company that never filled the field in. Ontario is
// four and publishes nothing; Canada is five and publishes — including them.
const nullProvince = [...inProvince("on", [100, 100, 100, 100], "ON"), CO("blank", 200, null)];
const np = region(nullProvince);
check("the national cohort is five, not four", np.length === 1 && np[0].companies === 5);
check("its rows include the province-less one", np[0].max === 200);
check("null province never becomes a province group", np.every((g) => g.scope !== "province"));
check("an empty-string province is the same as none", region([...inProvince("on", [100, 100, 100, 100], "ON"), CO("blank", 200, "   ")])[0].companies === 5);
// A row with no COUNTRY is a different case: there is no cohort it can honestly
// join, so it is dropped like a row with no unit — never folded into another.
const noCountry = region([...inProvince("on", [100, 100, 100, 100, 100], "ON"), CO("void", 9999, "ON", null)]);
check("a row with no country joins nothing rather than something wrong", noCountry.every((g) => g.max === 100));

console.log("\nThe floor holds at both scopes\n");
check("a four-company province publishes nothing local", region(inProvince("on", [100, 101, 102, 103], "ON")).length === 0);
check(`exactly ${MIN_COHORT} in a province publishes it`, findScope(region(inProvince("on", [100, 101, 102, 103, 104], "ON")), "province", "ON") !== undefined);
check("one company with five rows in one province is still one opinion",
  region([100, 101, 102, 103, 104].map((p) => CO("solo", p, "ON"))).length === 0);
check("a raised floor is respected at province scope",
  region(twoProvinces, { minCohort: 6 }).every((g) => g.companies >= 6));

// ── Slicing publishes the complement, so the complement needs a floor too ──
//
// Six Ontario companies and two in Quebec. Publishing "Ontario, 6" and
// "Canada, 8" from the same rows publishes Quebec's two by subtraction — and
// either of them can then subtract itself and read the other's price exactly.
// That is the disclosure MIN_COHORT exists to prevent, arrived at by
// arithmetic instead of a small group.
const leaky = [
  ...inProvince("on", [100, 102, 104, 106, 108, 110], "ON"),
  ...inProvince("qc", [500, 502], "QC"),
];
const lk = region(leaky);
check("the six-company province is still published", findScope(lk, "province", "ON") !== undefined);
check("the country group is withheld rather than exposing the other two", findScope(lk, "country") === undefined);
check("the two Quebec companies get nothing, which is the correct answer", selectGroup(lk, CO("qc0", 500, "QC")) === null);
// The same shape with the residual above the floor is fine and must publish.
const notLeaky = [
  ...inProvince("on", [100, 102, 104, 106, 108, 110], "ON"),
  ...inProvince("qc", [500, 502, 504, 506, 508], "QC"),
];
const nlk = region(notLeaky);
check("a residual that clears the floor is published normally", findScope(nlk, "country")?.companies === 11);
// Residual of exactly zero — every company is inside a published province — is
// also safe: country minus provinces is nothing.
const covered = [
  ...inProvince("on", [100, 102, 104, 106, 108], "ON"),
  ...inProvince("qc", [500, 502, 504, 506, 508], "QC"),
];
check("a residual of zero publishes both scopes", region(covered).filter((g) => g.scope === "country").length === 1);
// And one province-less company is enough to withhold it — that company is the
// residual, and its rows would be recoverable by subtraction.
const oneBlank = [...inProvince("on", [100, 102, 104, 106, 108, 110], "ON"), CO("blank", 777, null)];
check("a lone province-less company withholds the national number too", findScope(region(oneBlank), "country") === undefined);

console.log("\nComparing against the market you are actually in\n");
const rc = compareCompany([CO("on0", 100, "ON"), CO("on0", 300, "AB")], tp);
check("each row is measured against its own scope", rc.length === 2);
check("the Ontario row is compared to Ontario", rc.find((r) => r.province === "ON").scope === "province");
check("the Alberta row is compared to Alberta", rc.find((r) => r.province === "AB").scope === "province");
check("a thin-province row says it was compared nationally", compareCompany([CO("qc0", 100, "QC")], tb)[0].scope === "country");
check("an unscoped comparison still says global", compareCompany(mine, b)[0].scope === "global");
check("a row with no currency matches no scoped group", compareCompany([{ ...CO("x", 100, "ON"), currency: null }], tp).length === 0);
check("unmatched names survive scoped benchmarks", unmatchedNames([CO("on0", 100, "ON"), { ...CO("on0", 40, "ON"), name: "Something we invented" }], tp)[0].items.length === 1);

console.log("\nFuzz — invariants that must hold on any input at all\n");
// Reasoning about a two-level cohort is exactly where this gets got wrong, so
// the groups are recomputed from the raw rows by brute force and compared.
let seed = 20260819;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(rnd() * a.length)];

const fuzzRows = [];
for (let i = 0; i < 3000; i += 1) {
  const country = pick(["CA", "CA", "CA", "US", "us", null]);
  fuzzRows.push({
    companyId: `co${Math.floor(rnd() * 60)}`,
    categoryKey: pick(["interior_painting", "cabinets", null, ""]),
    categoryLabel: pick(["Interior Painting", "Cabinets", null]),
    name: pick(["Painted Door", "painted doors", "Soft-Close Hinges", "", null, "Glass Inserts (frosted)"]),
    unit: pick(["door", "each", "EA", "linear ft", "sq ft", null, ""]),
    price: pick([100, 150.5, 0, -3, null, "abc", 99999, 12, "45.50", 5_000_000]),
    currency: pick(["CAD", "USD", "cad"]),
    country,
    // Weighted, not uniform: an even spread over eight provinces would leave
    // every local cohort under the floor and quietly make half the invariants
    // below vacuous. The "fuzz reaches both scopes" check guards that.
    province: pick(["ON", "ON", "ON", "on", "QC", "QC", "AB", "NY", null, "  "]),
  });
}

const usable = fuzzRows.filter(
  (r) => r.categoryKey && normalizeUnit(r.unit) && normalizeServiceName(r.name)
    && Number(r.price) > 0 && Number(r.price) <= 1_000_000 && normalizeRegionCode(r.country),
);
const rowItemKey = (r) => `${r.categoryKey}::${normalizeServiceName(r.name)}::${normalizeUnit(r.unit)}`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) / 2;
  return s.length % 2 ? s[pos] : (s[pos - 0.5] + s[pos + 0.5]) / 2;
};
const round2 = (n) => Math.round(n * 100) / 100;

const fuzzed = region(fuzzRows);
check("fuzz produced groups to check", fuzzed.length > 0);
check("fuzz reaches both scopes, so nothing below is vacuous",
  fuzzed.some((g) => g.scope === "province") && fuzzed.some((g) => g.scope === "country"));
check("no group is below the floor at any scope", fuzzed.every((g) => g.companies >= MIN_COHORT));
check("every group states a scope", fuzzed.every((g) => g.scope === "province" || g.scope === "country"));
check("every scoped group names its currency and country", fuzzed.every((g) => /^[A-Z]{3}$/.test(g.currency) && g.country));
check("province groups are the only ones with a province", fuzzed.every((g) => (g.scope === "province") === (g.province !== null)));
check("keys are unique", new Set(fuzzed.map((g) => g.key)).size === fuzzed.length);

// The numbers, recomputed from the rows the group claims to describe.
const membersOf = (g) => usable.filter(
  (r) => rowItemKey(r) === g.itemKey
    && normalizeCurrency(r.currency) === g.currency
    && normalizeRegionCode(r.country) === g.country
    && (g.scope === "country" || normalizeRegionCode(r.province) === g.province),
);
check("every group's median is its own members', recomputed",
  fuzzed.every((g) => round2(median(membersOf(g).map((r) => Number(r.price)))) === g.median));
check("every group's sample count is its own members'",
  fuzzed.every((g) => membersOf(g).length === g.samples));
check("a country group covers the WHOLE country, provinces included",
  fuzzed.filter((g) => g.scope === "country").every((g) => new Set(membersOf(g).map((r) => r.companyId)).size === g.companies));
check("no group mixes currencies", fuzzed.every((g) => new Set(membersOf(g).map((r) => normalizeCurrency(r.currency))).size === 1));
check("no group mixes countries", fuzzed.every((g) => new Set(membersOf(g).map((r) => normalizeRegionCode(r.country))).size === 1));

// The subtraction attack, checked on every published pair.
const leakFree = fuzzed.filter((g) => g.scope === "country").every((g) => {
  const provinces = fuzzed.filter((p) => p.scope === "province" && p.itemKey === g.itemKey && p.currency === g.currency && p.country === g.country);
  if (!provinces.length) return true;
  const shown = new Set(provinces.map((p) => p.province));
  const residual = new Set(
    membersOf(g).filter((r) => !shown.has(normalizeRegionCode(r.province))).map((r) => r.companyId),
  );
  return residual.size === 0 || residual.size >= MIN_COHORT;
});
check("no published country group exposes a sub-floor residual by subtraction", leakFree);

// Every usable row must be able to find the market it belongs to, or find
// nothing — never somebody else's.
const misrouted = usable.filter((r) => {
  const g = selectGroup(fuzzed, r);
  if (!g) return false;
  return g.currency !== normalizeCurrency(r.currency)
    || g.country !== normalizeRegionCode(r.country)
    || (g.scope === "province" && g.province !== normalizeRegionCode(r.province));
});
check("lookup never returns another market's group", misrouted.length === 0);
check("lookup prefers the local group when one exists", usable.every((r) => {
  const g = selectGroup(fuzzed, r);
  if (!g || g.scope === "province") return true;
  const local = fuzzed.find((p) => p.scope === "province" && p.itemKey === rowItemKey(r)
    && p.currency === normalizeCurrency(r.currency) && p.country === normalizeRegionCode(r.country)
    && p.province === normalizeRegionCode(r.province));
  return local === undefined;
}));

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
