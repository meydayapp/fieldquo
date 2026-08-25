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
// Run: node --import ./scripts/alias-loader.mjs scripts/check-quote-costing.mjs

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
} from "@/app/api/quotes/costingWrite";

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
for (const [label, shape] of [
  ["saved", readBack],
  ["recomputed", recomputed],
]) {
  const keys = Object.keys(shape).sort();
  t(
    `${label}: exactly the contract's keys, no more`,
    keys,
    [...CONTRACT].sort(),
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
      ["cost", "hourlyRate", "hours", "name"].sort(),
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

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — a quote remembers what it was costed at\n",
);
process.exit(fail ? 1 : 0);
