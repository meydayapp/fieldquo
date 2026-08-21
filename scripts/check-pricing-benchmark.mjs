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

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
