// scripts/check-quote-costing.mjs
//
// A quote used to compute its whole cost estimate — labour hours, materials,
// overhead, the crew, the margin — show it, and throw every number away on
// save. Reopen the quote and there was no way to answer "what margin did we
// price this at" or "how many hours did we assume", which are the only two
// questions the costing feature exists for. app/api/jobs/[id]/costing said so
// in a comment and returned `estimatedCost: null` because of it.
//
// QuoteCosting closes that. What this file guards is the four ways it could
// close it and still be broken:
//
//   1. A status-only PATCH — accept, decline, send — silently wiping the row.
//      That is the exact bug documented on the invoice route, and it bites
//      harder here: "accepted" is the moment the estimate becomes worth having.
//   2. A saved row being re-derived on read, so the margin drifts as the price
//      book moves and the answer changes when nobody touched the quote.
//   3. `saved` lying about which of the two happened.
//   4. A malformed stored takeoff taking the endpoint down.
//
// And, since 2026-10-04, the fifth: a quote's overhead shared by the job's
// crew time (lib/costing/overheadShare.js) — the panel, the saved row and the
// derived costing all on the same basis and the same cent, and every quote of
// a company that has not set its billable hours byte-for-byte what it was.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-quote-costing.mjs

// FIRST, before anything reaches lib/db.js: a scriptable fake client, so the
// time-share section can execute buildQuoteCostingRow / deriveQuoteCosting /
// calculateMinimumPrice. Nothing above that section touches the database.
import "./fixtures/fakePrismaGlobal.mjs";
import { createHash } from "node:crypto";
import { costBasisMissing } from "@/lib/costing/quoteCosting";
import {
  normaliseQuoteCosting,
  quoteCostSummary,
  shapeSavedQuoteCosting,
  shapeEstimate,
  MARGIN_TARGET_PCT,
} from "@/lib/costing/quoteCosting";
import {
  isEmptyQuoteCosting,
  shouldWriteQuoteCosting,
  buildQuoteCostingRow,
} from "@/app/api/quotes/costingWrite";
import { deriveQuoteCosting } from "@/lib/costing/quoteCostEstimate";
import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import {
  calculateMinimumPrice,
  calculateHourlyFloor,
  priceFromBurn,
} from "@/lib/analytics/minimumPrice";
import { calculateBurnRate } from "@/lib/analytics/burnRate";
import {
  billableHoursFrom,
  overheadRates,
  overheadForJob,
  overheadPerHourFloor,
  overheadInputsFrom,
} from "@/lib/costing/overheadShare";
import { fixtureGroups, costingGroups } from "./productionRateFixtures.mjs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`,
  );
};

// ───────────────────────────────────────────────────────────────────────────
// 1. "This request said nothing about costing"
// ───────────────────────────────────────────────────────────────────────────
//
// The three cases shouldWriteQuoteCosting exists to keep apart. `costingSent`
// is `costing !== undefined` in both routes, so silence is testable here
// without a database.

console.log("\nA request that says nothing leaves an existing row alone");
const filled = {
  crew: [{ name: "Ana", rate: 30, hours: null }],
  addedLabourHours: 0,
  addedMaterialCost: 0,
  note: "",
};
t(
  "status-only PATCH over an existing row: no write",
  shouldWriteQuoteCosting({
    costingSent: false,
    may: true,
    hasExistingRow: true,
    row: null,
  }),
  false,
);
t(
  "...even if a row happened to be built anyway",
  shouldWriteQuoteCosting({
    costingSent: false,
    may: true,
    hasExistingRow: true,
    row: filled,
  }),
  false,
);
t(
  "status-only PATCH on a quote with no row: still no write",
  shouldWriteQuoteCosting({
    costingSent: false,
    may: true,
    hasExistingRow: false,
    row: null,
  }),
  false,
);
t(
  "a request that DOES send a filled panel writes",
  shouldWriteQuoteCosting({
    costingSent: true,
    may: true,
    hasExistingRow: false,
    row: filled,
  }),
  true,
);

console.log("\nAn empty panel means different things with and without a row");
const empty = { crew: [], addedLabourHours: 0, addedMaterialCost: 0, note: "" };
t("empty is recognised as empty", isEmptyQuoteCosting(empty), true);
t("a crew makes it non-empty", isEmptyQuoteCosting(filled), false);
t(
  "empty over an EXISTING row is a deletion the user asked for",
  shouldWriteQuoteCosting({
    costingSent: true,
    may: true,
    hasExistingRow: true,
    row: empty,
  }),
  true,
);
t(
  "empty with NO row writes nothing — a 0% margin card on an uncosted quote",
  shouldWriteQuoteCosting({
    costingSent: true,
    may: true,
    hasExistingRow: false,
    row: empty,
  }),
  false,
);
t(
  "overhead alone is a setting, not a statement about this job",
  isEmptyQuoteCosting({ ...empty, overheadPct: 10, labourRate: 35 }),
  true,
);

console.log("\nWithout the job-costing toggle, nothing is written at all");
t(
  "a member who may not cost cannot post one alongside a line-item edit",
  shouldWriteQuoteCosting({
    costingSent: true,
    may: false,
    hasExistingRow: true,
    row: filled,
  }),
  false,
);

// ───────────────────────────────────────────────────────────────────────────
// 2. Saved figures come back verbatim
// ───────────────────────────────────────────────────────────────────────────
//
// Deliberately inconsistent numbers: nothing here adds up, so anything that
// recomputes instead of reading is caught. A real row is consistent, which is
// exactly why a consistent fixture would prove nothing.

console.log("\nA saved row is READ, never recomputed");
const savedRow = {
  labourHours: 161.5,
  labourCost: 4561.67,
  materialTotal: 2880.25,
  unpricedMaterials: 3,
  overhead: 412.4,
  overheadBasis: "per_job",
  totalCost: 7854.32,
  price: 12000,
  profit: 4145.68,
  marginPct: 34.547,
  marginTargetPct: 30,
  signal: "green",
  costIncomplete: false,
  blendedRate: 28.25,
  crew: [
    { id: "w1", name: "Ana", rate: 25, hours: 53.67, cost: 1341.75 },
    { id: "w2", name: "Bo", rate: 35, hours: 53.67, cost: 1878.45 },
  ],
  groups: [
    {
      label: "Front driveway",
      categoryKey: "paving",
      labourHours: 41.2,
      materialTotal: 2880.25,
      materials: [
        {
          name: "Pavers",
          qty: 640,
          unit: "sqft",
          unitCost: 4.5,
          cost: 2880,
          unpriced: false,
        },
        {
          name: "Polymeric sand",
          qty: 5,
          unit: "bag",
          unitCost: null,
          cost: 0,
          unpriced: true,
        },
      ],
    },
  ],
};
const readBack = shapeSavedQuoteCosting(savedRow);
t("saved: true", readBack.saved, true);
t("labour hours verbatim", readBack.labourHours, 161.5);
t("labour cost verbatim", readBack.labourCost, 4561.67);
t("material total verbatim", readBack.materialTotal, 2880.25);
t("unpriced count verbatim", readBack.unpricedMaterials, 3);
t("overhead verbatim", readBack.overhead, 412.4);
t("overhead basis verbatim", readBack.overheadBasis, "per_job");
t(
  "estimated cost is the stored total, not a fresh sum",
  readBack.estimatedCost,
  7854.32,
);
t("price verbatim", readBack.price, 12000);
t(
  "profit verbatim — NOT price minus cost recomputed",
  readBack.profit,
  4145.68,
);
t("margin verbatim", readBack.marginPct, 34.55);
t("target verbatim", readBack.marginTargetPct, 30);
t("signal verbatim", readBack.signal, "green");
t("blended rate verbatim", readBack.blendedRate, 28.25);
t("crew rate is exposed as hourlyRate", readBack.crew[0].hourlyRate, 25);
t("crew hours verbatim", readBack.crew[1].hours, 53.67);
t("group hours verbatim", readBack.groups[0].labourHours, 41.2);
t(
  "an unpriced material keeps a NULL unit cost, not 0",
  readBack.groups[0].materials[1].unitCost,
  null,
);
t("...and stays flagged", readBack.groups[0].materials[1].unpriced, true);

// The point of the whole table: today's rate card must not touch it.
const wouldRecompute = quoteCostSummary({
  scopeGroups: [
    {
      tempId: "g0",
      categoryKey: "paving",
      takeoff: { patioSqft: 640, baseDepthIn: 12 },
    },
  ],
  price: 12000,
});
t(
  "a live recompute genuinely differs — so 'verbatim' is a real claim",
  wouldRecompute.estimatedCost !== readBack.estimatedCost,
  true,
);

console.log("\nA quote priced at nothing has no margin, and does not claim 0%");
t(
  "no price → null margin, not a break-even",
  shapeSavedQuoteCosting({ ...savedRow, price: 0, marginPct: null }).marginPct,
  null,
);

console.log("\nThe crew rows add up to the labour cost above them");
// This caught a real defect during the build. Storing the crew as it was TYPED
// — which is what the invoice side does — read back as three people on zero
// hours costing nothing, underneath a labour cost of $2,897.93. On a quote most
// members carry `hours: null`, meaning "an even share of the predicted pool",
// so the resolved share has to be frozen with the money. A panel whose parts
// don't add up to its total is a panel nobody trusts twice.
const priced = quoteCostSummary({
  scopeGroups: [
    {
      tempId: "sg1",
      categoryKey: "paving",
      takeoff: { drivewaySqft: 640, baseDepthIn: 18 },
    },
  ],
  crew: [
    { id: "w1", name: "Ana", rate: 25, hours: null },
    { id: "w2", name: "Bo", rate: 25, hours: null },
    { id: "w3", name: "Cy", rate: 35, hours: null },
  ],
  addedLabourHours: 6,
  price: 12000,
});
const asStored = shapeSavedQuoteCosting({
  ...priced,
  totalCost: priced.estimatedCost,
  // The mapping app/api/quotes/costingWrite.js performs before writing.
  crew: priced.crew.map((m) => ({
    name: m.name,
    rate: m.rate,
    hours: m.hours,
    cost: m.cost,
  })),
});
const crewCost =
  Math.round(asStored.crew.reduce((s, m) => s + m.cost, 0) * 100) / 100;
const crewHours =
  Math.round(asStored.crew.reduce((s, m) => s + m.hours, 0) * 100) / 100;
t(
  "nobody is stored on zero hours when they share the pool",
  asStored.crew.every((m) => m.hours > 0),
  true,
);
t("the crew's costs sum to the labour cost", crewCost, asStored.labourCost);
t(
  "the crew's hours account for the labour hours (to the cent)",
  Math.abs(crewHours - asStored.labourHours) <= 0.03,
  true,
);
t("a blended rate is derived, not demanded", asStored.blendedRate > 0, true);

// ───────────────────────────────────────────────────────────────────────────
// 3. Nothing saved → recomputed, and flagged as such
// ───────────────────────────────────────────────────────────────────────────

console.log("\nNothing saved: recomputed from the stored takeoff, saved:false");
const recomputed = shapeEstimate(
  quoteCostSummary({
    scopeGroups: [
      {
        tempId: "sg1",
        categoryKey: "paving",
        label: "Front driveway",
        takeoff: { drivewaySqft: 640, baseDepthIn: 18 },
      },
    ],
    crew: [],
    labourRate: 0,
    overheadPct: 10,
    price: 12000,
    marginTargetPct: MARGIN_TARGET_PCT,
  }),
  { saved: false },
);
t("saved: false", recomputed.saved, false);
t("the takeoff produced real hours", recomputed.labourHours > 0, true);
t("a bill of materials came out of it", recomputed.groups.length > 0, true);
t(
  "nobody was recorded on the job, so the hours cost nothing...",
  recomputed.labourCost,
  0,
);
t(
  "...and that is reported as unfinished, not as a bargain",
  recomputed.costIncomplete,
  true,
);
t("an unfinished cost is never green", recomputed.signal !== "green", true);
t("the price it was measured against travels with it", recomputed.price, 12000);

console.log("\nA quote with no scope at all recomputes to nothing, honestly");
const bare = shapeEstimate(quoteCostSummary({ scopeGroups: [], price: 0 }), {
  saved: false,
});
t("no cost", bare.estimatedCost, 0);
t("no margin against no price", bare.marginPct, null);
t("no signal to give", bare.signal, "none");
t("no groups invented", bare.groups, []);

// ───────────────────────────────────────────────────────────────────────────
// 4. Hostile input never throws
// ───────────────────────────────────────────────────────────────────────────
//
// Every one of these reaches quoteCostSummary from a stored Json column or a
// request body. A throw here is a quote that cannot be saved, or a cost panel
// that 500s on a quote somebody needs to look at.

console.log("\nHostile and absent takeoffs are survived, not thrown on");
const hostile = [
  ["null scopeGroups", { scopeGroups: null, price: 100 }],
  ["a string where a group should be", { scopeGroups: ["nope"], price: 100 }],
  ["null entries", { scopeGroups: [null, undefined], price: 100 }],
  ["no categoryKey", { scopeGroups: [{ takeoff: { sqft: 100 } }], price: 100 }],
  [
    "an unknown trade",
    {
      scopeGroups: [{ categoryKey: "not_a_trade", takeoff: { sqft: 10 } }],
      price: 100,
    },
  ],
  [
    "a takeoff that is a string",
    { scopeGroups: [{ categoryKey: "paving", takeoff: "640" }], price: 100 },
  ],
  [
    "a takeoff that is an array",
    { scopeGroups: [{ categoryKey: "paving", takeoff: [1, 2] }], price: 100 },
  ],
  [
    "NaN quantities",
    {
      scopeGroups: [{ categoryKey: "paving", takeoff: { patioSqft: NaN } }],
      price: 100,
    },
  ],
  [
    "1e400 quantities",
    {
      scopeGroups: [{ categoryKey: "paving", takeoff: { patioSqft: 1e400 } }],
      price: 100,
    },
  ],
  [
    "1e308 — finite until something multiplies it",
    {
      scopeGroups: [{ categoryKey: "paving", takeoff: { patioSqft: 1e308 } }],
      price: 100,
    },
  ],
  [
    "a negative area",
    {
      scopeGroups: [{ categoryKey: "paving", takeoff: { patioSqft: -500 } }],
      price: 100,
    },
  ],
  ["a crew that is not an array", { scopeGroups: [], crew: "Ana", price: 100 }],
  [
    "crew rows that are junk",
    { scopeGroups: [], crew: [null, 7, { name: {} }], price: 100 },
  ],
  ["a negative price", { scopeGroups: [], price: -5000 }],
  ["no arguments at all", undefined],
];
for (const [label, args] of hostile) {
  let out = null;
  let threw = null;
  try {
    out = shapeEstimate(quoteCostSummary(args), { saved: false });
  } catch (e) {
    threw = e?.message || String(e);
  }
  t(`${label}: no throw`, threw, null);
  if (!threw) {
    const finite =
      Number.isFinite(out.estimatedCost) &&
      Number.isFinite(out.labourHours) &&
      Number.isFinite(out.labourCost) &&
      Number.isFinite(out.materialTotal) &&
      Number.isFinite(out.overhead) &&
      Number.isFinite(out.profit) &&
      (out.marginPct === null || Number.isFinite(out.marginPct));
    t(`${label}: every figure is a real number`, finite, true);
  }
}

console.log("\nThe write boundary refuses absurd figures rather than clamping");
t(
  "no block at all is silence, not an empty one",
  normaliseQuoteCosting(undefined),
  null,
);
t("a string is not a costing block", normaliseQuoteCosting("crew"), null);
const dirty = normaliseQuoteCosting({
  crew: [
    {
      id: "x".repeat(200),
      name: "  Ana  ".padEnd(400, "!"),
      rate: "1e400",
      hours: "",
    },
    { name: "Bo", rate: -50, hours: 8 },
    null,
    "nope",
  ],
  addedLabourHours: 1e400,
  addedMaterialCost: "abc",
  labourRate: 35,
  overheadPct: 99999,
  note: "z".repeat(9000),
});
t("junk crew entries are dropped", dirty.crew.length, 2);
t("the id is length-capped", dirty.crew[0].id.length, 64);
t("the name is trimmed and capped", dirty.crew[0].name.length, 120);
t("1e400 is refused, not clamped to the column ceiling", dirty.crew[0].rate, 0);
t(
  "a blank hours field stays null — an even share, not zero",
  dirty.crew[0].hours,
  null,
);
t("a negative rate is refused", dirty.crew[1].rate, 0);
t("explicit hours survive", dirty.crew[1].hours, 8);
t("1e400 added hours refused", dirty.addedLabourHours, 0);
t("a non-numeric material cost is 0", dirty.addedMaterialCost, 0);
t(
  "an absurd overhead percentage is capped at the absurdity line",
  dirty.overheadPct,
  1000,
);
t("the note is capped", dirty.note.length, 500);

// ───────────────────────────────────────────────────────────────────────────
// 5. The wire shape is complete, and the same on both paths
// ───────────────────────────────────────────────────────────────────────────
//
// A parallel UI is being written against this. A key that exists on the saved
// path and not the recomputed one is a panel that renders on old quotes and
// breaks on new ones, or the reverse — so both are checked against one list.

console.log("\nThe contract shape, on both paths");
const CONTRACT = [
  "saved",
  "labourHours",
  "labourCost",
  "materialTotal",
  "unpricedMaterials",
  // The lines' own cost (lib/costing/lineItemCost.js) — 0 on a row written
  // before the column existed, never absent.
  "lineItemCost",
  "overhead",
  "overheadBasis",
  "estimatedCost",
  "price",
  "profit",
  "marginPct",
  "marginTargetPct",
  "signal",
  "costIncomplete",
  "crew",
  "blendedRate",
  "groups",
];
// ── The saved path carries the INPUTS back as well ─────────────────────────
//
// The contract above is the ANSWER — hours, costs, margin — and it is shared
// with the recompute, which has no inputs to report. But every editor that
// reopens a costed quote (QuoteCostEditor on the quote page, the cost panel in
// the shared quote builder) has to seed itself from what the estimator TYPED,
// and those four numbers were not in the response at all. They read as blank
// and the next save wrote the blanks back, silently zeroing the extra hours,
// the extra materials and the fallback rate.
//
// So they are on the saved shape and deliberately NOT on the recomputed one: a
// recompute has no inputs, and inventing zeroes would claim somebody said
// something they never said.
const SAVED_INPUTS = [
  "addedLabourHours",
  "addedMaterialCost",
  "labourRate",
  "overheadPct",
  "note",
];
for (const [label, shape] of [
  ["saved", readBack],
  ["recomputed", recomputed],
]) {
  const keys = Object.keys(shape).sort();
  t(
    `${label}: exactly the contract's keys, no more`,
    keys,
    [...CONTRACT, ...(label === "saved" ? SAVED_INPUTS : [])].sort(),
  );
  t(`${label}: saved is a boolean`, typeof shape.saved, "boolean");
  t(
    `${label}: overheadBasis is a string`,
    typeof shape.overheadBasis,
    "string",
  );
  t(`${label}: signal is a string`, typeof shape.signal, "string");
  t(
    `${label}: costIncomplete is a boolean`,
    typeof shape.costIncomplete,
    "boolean",
  );
  t(`${label}: crew is an array`, Array.isArray(shape.crew), true);
  t(`${label}: groups is an array`, Array.isArray(shape.groups), true);
  t(
    `${label}: blendedRate is a number or null, never undefined`,
    shape.blendedRate === null || typeof shape.blendedRate === "number",
    true,
  );
  for (const k of [
    "labourHours",
    "labourCost",
    "materialTotal",
    "unpricedMaterials",
    "overhead",
    "estimatedCost",
    "price",
    "profit",
    "marginTargetPct",
  ]) {
    t(`${label}: ${k} is a finite number`, Number.isFinite(shape[k]), true);
  }
  for (const g of shape.groups) {
    t(
      `${label}: a group has the four keys plus its materials`,
      Object.keys(g).sort(),
      [
        "categoryKey",
        "labourHours",
        "materialTotal",
        "materials",
        "label",
      ].sort(),
    );
    for (const m of g.materials) {
      t(
        `${label}: a material row is complete`,
        Object.keys(m).sort(),
        ["cost", "name", "qty", "unit", "unitCost", "unpriced"].sort(),
      );
    }
  }
  for (const c of shape.crew) {
    t(
      `${label}: a crew row is complete`,
      Object.keys(c).sort(),
      [
        "cost",
        "hourlyRate",
        "hours",
        "name",
        // Saved only, and for the same reason as SAVED_INPUTS: an editor has to
        // know which hours were PINNED by a person and which are a resolved
        // even share. Without hoursExplicit, reopening the panel freezes "split
        // the pool evenly" into hard numbers the next save cannot undo — and
        // without the id it cannot tell which worker a row was.
        ...(label === "saved" ? ["hoursExplicit", "id"] : []),
      ].sort(),
    );
  }
}

console.log("\nThe signal vocabulary is the panel's, not a second one");
for (const s of [readBack.signal, recomputed.signal, bare.signal]) {
  t(
    `"${s}" is one of green/amber/red/none`,
    ["green", "amber", "red", "none"].includes(s),
    true,
  );
}

console.log("\nA margin is refused when nothing supports it");
{
  // Q-2026-0006 rendered "54.52% margin" against LABOUR $0.00 / 0 hrs and
  // MATERIALS $0.00 on a $6,650 cabinet quote. The arithmetic was right and it
  // was still a lie: a subtraction missing its two biggest terms, presented as
  // an answer, in green.
  t(
    "the real Q-2026-0006 shape refuses a margin",
    costBasisMissing({ labourHours: 0, materialTotal: 0, price: 6650 }),
  );
  t(
    "recovering labour is enough to state one",
    costBasisMissing({ labourHours: 102.28, materialTotal: 0, price: 6650 }),
    false,
  );
  t(
    "recovering materials is enough to state one",
    costBasisMissing({ labourHours: 0, materialTotal: 2575.29, price: 6650 }),
    false,
  );
  // A quote priced at nothing genuinely has no margin to refuse — the banner
  // would be answering a question nobody asked.
  t(
    "a quote priced at zero is not a missing basis",
    costBasisMissing({ labourHours: 0, materialTotal: 0, price: 0 }),
    false,
  );
  for (const bad of [null, undefined, NaN, Infinity, "x", {}, []]) {
    t(
      `hostile hours ${JSON.stringify(bad)} still refuses`,
      costBasisMissing({ labourHours: bad, materialTotal: bad, price: 6650 }),
    );
    t(
      `hostile price ${JSON.stringify(bad)} refuses nothing`,
      costBasisMissing({ labourHours: 0, materialTotal: 0, price: bad }),
      false,
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Overhead as the job's fair share of the month's crew time
// ───────────────────────────────────────────────────────────────────────────
//
// The owner, 2026-10-04: overhead per job = monthly fixed overhead × (the
// job's crew-hours ÷ the month's billable crew-hours). Executed, not read:
// the pure rule, the estimator, the price-floor answer that carries the rate,
// and the two server paths that save or derive a costing — against a fake
// database (scripts/fixtures/fakePrismaGlobal.mjs).

const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9;

console.log("\nThe rule itself (lib/costing/overheadShare.js)");
{
  const rates = overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: 320 });
  t("$8,000 a month ÷ 320 billable crew-hours = $25 an hour", rates.perHour, 25);
  const twoWeeks = overheadForJob({ rates, jobHours: 160 });
  t("a two-week job for two people (160 crew-hours) carries $4,000", twoWeeks.amount, 4000);
  t("…on the per_hour basis", twoWeeks.basis, "per_hour");
  t("…which is half the month", twoWeeks.share, 0.5);
  t("a half-day repair for one (4 crew-hours) carries $100", overheadForJob({ rates, jobHours: 4 }).amount, 100);

  // "If a job takes 2 weeks and they only do 2 jobs a month, or have capacity
  // for 3 or 4…": by jobs, the same 160-hour job's overhead moves with the
  // job count; by time, it is the job's share of the month whatever the count.
  for (const jobs of [2, 3, 4]) {
    const both = overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: 320, jobsPerMonth: jobs });
    t(`${jobs} jobs a month, hours set: the 160-hour job still carries $4,000`, overheadForJob({ rates: both, jobHours: 160 }).amount, 4000);
    const jobsOnly = overheadRates({ monthlyFixedCosts: 8000, jobsPerMonth: jobs });
    const perJob = overheadForJob({ rates: jobsOnly, jobHours: 160 });
    t(`${jobs} jobs a month, hours unset: per_job, labelled`, perJob.basis, "per_job");
    t(`…$8,000 ÷ ${jobs}`, perJob.amount, Math.round((8000 / jobs) * 100) / 100);
  }
  const nothing = overheadForJob({ rates: overheadRates({ monthlyFixedCosts: 8000 }), jobHours: 160, price: 12000 });
  t("neither hours nor jobs: 10% of the price, labelled pct_of_price", [nothing.basis, nothing.amount, nothing.pct], ["pct_of_price", 1200, 10]);
  t("rates unknown entirely: still the percentage, never a made-up rate", overheadForJob({ rates: null, jobHours: 160, price: 1000 }).basis, "pct_of_price");

  for (const bad of [0, -320, NaN, "abc", Infinity, -Infinity, 1e9, "", null, undefined, true, {}, []]) {
    t(`billable hours ${JSON.stringify(bad) ?? String(bad)} is "not said"`, billableHoursFrom(bad), null);
    t(`…and gives no hourly rate`, overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: bad }).perHour, null);
  }
  t("a stored Decimal string reads as its number", billableHoursFrom("320.00"), 320);
  for (const bad of [0, -3, "abc", NaN, null]) {
    const r = overheadRates({ monthlyFixedCosts: 8000, billableHoursPerMonth: 320, jobsPerMonth: 4 });
    t(`job hours ${String(bad)}: no time to share, falls to per_job`, overheadForJob({ rates: r, jobHours: bad }).basis, "per_job");
  }
  t("the hourly floor is the rate, to the cent", overheadPerHourFloor(overheadRates({ monthlyFixedCosts: 8123.45, billableHoursPerMonth: 317.5 })), 25.59);
  t("no hours, no floor", overheadPerHourFloor(overheadRates({ monthlyFixedCosts: 8000 })), null);

  // The one reading of the price-floor answer, shared by the builder and both
  // server paths.
  t("a 403 body carries nothing", overheadInputsFrom({ error: "no" }), { overheadPerJob: null, overheadPerHour: null, billableHoursPerMonth: null, monthlyFixedCosts: null });
  t("a failed fetch carries nothing", overheadInputsFrom(null).overheadPerHour, null);
  const refusal = { needsCapacity: true, error: "Tell us…", monthlyFixedCosts: 8000, billableHoursPerMonth: 320, overheadPerHour: 25 };
  t("a needsCapacity refusal with hours: per-hour yes, per-job no", [overheadInputsFrom(refusal).overheadPerHour, overheadInputsFrom(refusal).overheadPerJob], [25, null]);
  t("a rate without its divisor is not one we can explain: both or neither", overheadInputsFrom({ overheadPerHour: 25 }).overheadPerHour, null);
  t("a success body: costPerJob read exactly as before", overheadInputsFrom({ costPerJob: 1035.35, monthlyFixedCosts: 4141.4 }).overheadPerJob, 1035.35);
  t("hostile rate values are not rates", [0, -1, "abc", Infinity].map((v) => overheadInputsFrom({ overheadPerHour: v, billableHoursPerMonth: 320 }).overheadPerHour), [null, null, null, null]);
}

console.log("\nThe estimator: per_hour when the rate and the hours are both there");
{
  const base = { scopeGroups: [], labourRatePerHour: 35, crew: [], manualLabourHours: 160, price: 20000, overheadPctOfPrice: 10, marginTargetPct: 20 };
  const e = estimateQuoteCost({ ...base, overheadPerJob: 2000, overheadPerHour: 25, billableHoursPerMonth: 320 });
  t("overhead = $25 × 160 h, beating the $2,000 per-job slice", [e.overhead, e.overheadBasis], [4000, "per_hour"]);
  t("the explanation travels with it", e.overheadShare, { perHour: 25, hours: 160, share: 0.5 });
  t("the estimated cost carries it", e.estimatedCost, 4000 + 160 * 35);
  const noDivisor = estimateQuoteCost({ ...base, overheadPerHour: 25 });
  t("without the divisor the amount is the same and the share is null, not Infinity", [noDivisor.overhead, noDivisor.overheadShare?.share], [4000, null]);
  const noHours = estimateQuoteCost({ ...base, manualLabourHours: 0, overheadPerJob: 2000, overheadPerHour: 25, billableHoursPerMonth: 320 });
  t("a job with no hours yet falls to per_job", [noHours.overhead, noHours.overheadBasis], [2000, "per_job"]);
  t("…and carries no overheadShare key at all", "overheadShare" in noHours, false);
  const noHoursNoJobs = estimateQuoteCost({ ...base, manualLabourHours: 0, overheadPerHour: 25, billableHoursPerMonth: 320 });
  t("no hours and no per-job figure: the percentage", [noHoursNoJobs.overhead, noHoursNoJobs.overheadBasis], [2000, "pct_of_price"]);
  for (const bad of [0, -25, NaN, "abc", Infinity, "", false, null]) {
    const h = estimateQuoteCost({ ...base, overheadPerJob: 2000, overheadPerHour: bad, billableHoursPerMonth: 320 });
    t(`hostile overheadPerHour ${String(bad)}: per_job exactly as before`, [h.overhead, h.overheadBasis, "overheadShare" in h], [2000, "per_job", false]);
  }
  const huge = estimateQuoteCost({ ...base, overheadPerHour: 1e306, billableHoursPerMonth: 320 });
  t("an overflowing rate never reaches the total as Infinity", Number.isFinite(huge.estimatedCost), true);

  // Byte-for-byte: the md5s below were taken by running these exact fixtures
  // through quoteCostSummary on the commit BEFORE overheadPerHour existed
  // (4a026795). "pct" is also check-production-rates' pinned summary.
  const PINNED = {
    pct: "e30e0cc4d3781d985d7bf0c0ce4d2fac",
    perJob: "88f5a6c153f98ec679ae92a542cea603",
    perJobCrew: "12b1815a506daf323b4ee3a879d7f30f",
    noHours: "d4fa85ef4a6d464739b85f2c73791d32",
  };
  const cg = costingGroups(fixtureGroups());
  const crewFix = [{ id: "u1", name: "A", rate: 30 }, { id: "u2", name: "B", rate: 42, hours: 10 }];
  const cases = {
    pct: { scopeGroups: cg, crew: [], labourRate: 35, overheadPct: 10, price: 25000, addedLabourHours: 3 },
    perJob: { scopeGroups: cg, crew: [], labourRate: 35, overheadPct: 10, overheadPerJob: 1035.35, price: 25000, addedLabourHours: 3 },
    perJobCrew: { scopeGroups: cg, crew: crewFix, labourRate: 35, overheadPct: 10, overheadPerJob: 1035.35, price: 25000 },
    noHours: { scopeGroups: [], crew: [], labourRate: 35, overheadPct: 10, overheadPerJob: 500, price: 4000 },
  };
  for (const [label, c] of Object.entries(cases)) {
    t(`${label}: summary md5 unchanged with no overheadPerHour`, md5(quoteCostSummary(c)), PINNED[label]);
    t(`${label}: …and with overheadPerHour: null`, md5(quoteCostSummary({ ...c, overheadPerHour: null, billableHoursPerMonth: null })), PINNED[label]);
    t(`${label}: …and with a hostile one`, md5(quoteCostSummary({ ...c, overheadPerHour: "abc", billableHoursPerMonth: 320 })), PINNED[label]);
  }

  const timed = quoteCostSummary({ ...cases.perJob, overheadPerHour: 25, billableHoursPerMonth: 320 });
  t("a real quote with hours goes per_hour through quoteCostSummary", timed.overheadBasis, "per_hour");
  t("…priced at its own hours", timed.overhead, Math.round(25 * timed.labourHours * 100) / 100);
  const shaped = shapeEstimate(timed);
  t("the wire shape keeps per_hour", shaped.overheadBasis, "per_hour");
  t("…and the explanation", [shaped.overheadShare?.perHour, shaped.overheadShare?.hours], [25, timed.labourHours]);
  const savedTimed = shapeSavedQuoteCosting({ ...savedRow, overheadBasis: "per_hour" });
  t("a SAVED per_hour row reads back per_hour", savedTimed.overheadBasis, "per_hour");
  t("…with no recomputed explanation beside the frozen figure", "overheadShare" in savedTimed, false);
  t("an absent basis still defaults to pct_of_price", shapeSavedQuoteCosting({ ...savedRow, overheadBasis: null }).overheadBasis, "pct_of_price");
}

console.log("\nThe price-floor answer carries the rate (calculateMinimumPrice, fake database)");
let WORLD;
globalThis.__FQ_DB = async (model, op) => {
  if (model === "forecastSettings" && op === "findUnique") return WORLD.forecast;
  if (op === "findMany" && model in WORLD.rows) return WORLD.rows[model];
  throw new Error(`unscripted db.${model}.${op}`);
};
const world = (forecast, monthly = 8000) => ({
  forecast,
  rows: { expense: [{ amount: monthly, frequency: "monthly" }], salary: [], debt: [], asset: [], materialRecipeSetting: [] },
});
{
  WORLD = world(null);
  const bare = await calculateMinimumPrice({ companyId: "co" });
  t("nothing set: the refusal, key for key, as it always was", Object.keys(bare), ["needsCapacity", "error"]);

  WORLD = world({ jobsPerMonthCapacity: 4, jobsPerWeekCapacity: 1, targetMargin: null, billableHoursPerMonth: null });
  const jobsOnly = await calculateMinimumPrice({ companyId: "co" });
  const burn = await calculateBurnRate({ companyId: "co", cashOnHand: null });
  t("jobs only: no time-share keys", "overheadPerHour" in jobsOnly, false);
  t("…and the answer is priceFromBurn's, byte for byte", md5(jobsOnly), md5(priceFromBurn({ burn, capacity: 1, jobsPerMonth: 4, targetMargin: 0.2 })));

  WORLD = world({ jobsPerMonthCapacity: 4, jobsPerWeekCapacity: 1, targetMargin: null, billableHoursPerMonth: "320.00" });
  const both = await calculateMinimumPrice({ companyId: "co" });
  t("hours + jobs: the per-job floor is unchanged", [both.costPerJob, both.minimumPrice], [jobsOnly.costPerJob, jobsOnly.minimumPrice]);
  t("…and the time share rides beside it", [both.billableHoursPerMonth, both.overheadPerHour, both.hourlyFloor, both.minimumPerHour], [320, 25, 25, 31.25]);
  const hourly = await calculateHourlyFloor({ companyId: "co", billableHoursPerMonth: 320 });
  t("hourlyFloor IS calculateHourlyFloor's answer (its production caller)", both.hourlyFloor, hourly.hourlyFloor);

  WORLD = world({ jobsPerMonthCapacity: null, jobsPerWeekCapacity: 0, targetMargin: null, billableHoursPerMonth: 320 });
  const hoursOnly = await calculateMinimumPrice({ companyId: "co" });
  t("hours but no jobs: still needsCapacity, same sentence", [hoursOnly.needsCapacity, hoursOnly.error], [true, bare.error]);
  t("…but the quote still gets its rate", [hoursOnly.overheadPerHour, hoursOnly.monthlyFixedCosts], [25, 8000]);
  t("…and no per-job figure", "costPerJob" in hoursOnly, false);

  for (const bad of [0, -320, "abc", 1e9]) {
    WORLD = world({ jobsPerMonthCapacity: 4, jobsPerWeekCapacity: 1, targetMargin: null, billableHoursPerMonth: bad });
    const r = await calculateMinimumPrice({ companyId: "co" });
    t(`stored hours ${String(bad)}: treated as unset, answer as before`, md5(r), md5(jobsOnly));
  }
}

console.log("\nThe panel and the saved row agree to the cent");
{
  // Awkward numbers on purpose: a rate that does not terminate, hours with a
  // quarter in them. $8,123.45 ÷ 317.5 h × 37.25 h = $953.0661… → $953.07.
  const costing = { crew: [], addedLabourHours: 37.25, addedMaterialCost: 0, labourRate: 35, overheadPct: 10 };
  const builderEstimate = (body) => {
    // What QuoteBuilder does with the GET body: overheadInputsFrom, then the
    // live estimate with the panel's own inputs.
    const o = overheadInputsFrom(body);
    return estimateQuoteCost({
      scopeGroups: [], labourRatePerHour: 35, crew: [], manualLabourHours: 0 + 37.25 + 0,
      manualMaterialCost: 0, price: 9000, overheadPerJob: o.overheadPerJob,
      overheadPerHour: o.overheadPerHour, billableHoursPerMonth: o.billableHoursPerMonth,
      overheadPctOfPrice: 10, purchasedMaterialCost: 0, marginTargetPct: 20,
      recipeOverridesByCategory: {}, lineItemCost: 0,
    });
  };
  const scenarios = [
    ["hours and jobs set", { jobsPerMonthCapacity: 3, jobsPerWeekCapacity: 1, targetMargin: null, billableHoursPerMonth: 317.5 }, "per_hour", 953.07],
    ["hours set, no jobs", { jobsPerMonthCapacity: null, jobsPerWeekCapacity: 0, targetMargin: null, billableHoursPerMonth: 317.5 }, "per_hour", 953.07],
    ["jobs only", { jobsPerMonthCapacity: 3, jobsPerWeekCapacity: 1, targetMargin: null, billableHoursPerMonth: null }, "per_job", 2707.82],
    ["nothing set", null, "pct_of_price", 900],
  ];
  for (const [label, forecast, basis, amount] of scenarios) {
    WORLD = world(forecast, 8123.45);
    // Over the wire exactly as the builder receives it.
    const body = JSON.parse(JSON.stringify(await calculateMinimumPrice({ companyId: "co" })));
    const panel = builderEstimate(body);
    const row = await buildQuoteCostingRow({ companyId: "co", costing, price: 9000, scopeGroups: [] });
    t(`${label}: the panel says ${basis}`, [panel.overheadBasis, panel.overhead], [basis, amount]);
    t(`${label}: the saved row says the same, to the cent`, [row.overheadBasis, row.overhead, row.totalCost], [panel.overheadBasis, panel.overhead, panel.estimatedCost]);
  }
  // And the drawing read's path (overheadRates → overheadForJob) lands on the
  // same cent, because it is the same function.
  const drawing = overheadForJob({ rates: overheadRates({ monthlyFixedCosts: 8123.45, billableHoursPerMonth: 317.5, jobsPerMonth: 3 }), jobHours: 37.25 });
  t("the drawing read's figure is the panel's", drawing.amount, 953.07);
  t("…and the share is 37.25 of 317.5 hours", near(drawing.share, 37.25 / 317.5), true);

  // The derived costing (no saved row) reads the same rate. With no hours on
  // the quote it has no time to share, so it falls back — labelled.
  WORLD = world({ jobsPerMonthCapacity: 3, jobsPerWeekCapacity: 1, targetMargin: null, billableHoursPerMonth: 317.5 }, 8123.45);
  const derivedNoHours = await deriveQuoteCosting({ companyId: "co", quote: { subtotal: 9000, discount: 0, scopeGroups: [] } });
  t("a derived costing with no hours falls to per_job", [derivedNoHours.overheadBasis, derivedNoHours.overhead], ["per_job", 2707.82]);
  WORLD = world({ jobsPerMonthCapacity: null, jobsPerWeekCapacity: 0, targetMargin: null, billableHoursPerMonth: 317.5 }, 8123.45);
  const derivedNothing = await deriveQuoteCosting({ companyId: "co", quote: { subtotal: 9000, discount: 0, scopeGroups: [] } });
  t("…and with no jobs either, the percentage", derivedNothing.overheadBasis, "pct_of_price");
}

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — a quote remembers what it was costed at\n",
);
process.exit(fail ? 1 : 0);
