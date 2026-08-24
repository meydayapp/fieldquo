// scripts/check-takeoff-render.jsx
//
// Renders the trade takeoffs to static HTML.
//
//   npx tsx scripts/check-takeoff-render.jsx
//
// Why this exists: `next build` compiled cleanly through two shipped crashes in
// this codebase — an `embedSnippet` and a `Megaphone` used without an import —
// because neither is a type error and neither file is evaluated at build time.
// ESLint no-undef now catches that class in the build. This catches the next
// one: a component that references a prop that isn't passed, maps over
// something that isn't an array, or reads a book field that doesn't exist.
// None of those is a compile error. All of them are a blank screen.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TradeTakeoff, {
  hasTakeoff,
} from "../app/components/quotes/builder/TradeTakeoff.js";
import {
  getPriceBook,
  TRADE_PRICE_BOOKS,
} from "../app/data/tradePriceBooks.js";
import { createTradeConfig } from "../lib/pricing/tradeScope.js";
import QuoteWording from "../app/app/settings/services/QuoteWording.js";
import { resolveServiceContent } from "../lib/documents/serviceContent.js";

let pass = 0;
const fails = [];

// Every trade with both a book and a takeoff, blank and then filled in. A
// takeoff that only works once somebody has typed into it is a takeoff that is
// broken the moment it appears on screen.
const FILLED = {
  roofing_service: {
    areaSqft: 2400,
    pitchRise: 8,
    layers: 2,
    storeys: "two",
    valleyFt: 40,
    ridgeHipFt: 60,
    dripEdgeFt: 180,
    ventBoots: 3,
    chimneys: 1,
    deckSheets: 2,
    crewSize: 3,
  },
  insulation: {
    assembly: "attic",
    climateZone: "6",
    sqft: 1200,
    existingDepthIn: 4,
    airSeal: true,
    baffles: 14,
    crewSize: 2,
  },
  siding: {
    sqft: 2000,
    storeys: "two",
    rotRepairSqft: 40,
    trimFt: 200,
    fasciaFt: 120,
    soffitSqft: 260,
  },
};

for (const key of Object.keys(TRADE_PRICE_BOOKS)) {
  if (!hasTakeoff(key)) continue;
  const book = getPriceBook(key);
  const base = createTradeConfig(key) || {};
  const cases = [
    ["blank", base],
    ["filled", { ...base, ...(FILLED[key] || {}) }],
    // Stored JSON that predates a field, or was written by an older version.
    ["sparse", {}],
  ];
  for (const [label, takeoff] of cases) {
    try {
      const html = renderToStaticMarkup(
        <TradeTakeoff
          categoryKey={key}
          takeoff={takeoff}
          book={book}
          onChange={() => {}}
          siteAddress="204 Avro Cir, Ottawa"
        />,
      );
      if (!html || html.length < 40)
        throw new Error(`rendered ${html.length} chars`);
      pass += 1;
    } catch (err) {
      fails.push(`${key} (${label}): ${err.message}`);
    }
  }
}

// The quote-wording editor, OPENED — a collapsed panel renders fine over
// corrupt input and proves nothing. These are Json columns, so a row can hold
// a string where the editor expects an array.
const WORDING_CASES = [
  [
    "inheriting",
    {
      content: resolveServiceContent("insulation", null),
      contentOverrides: { includedItems: null, processSteps: null },
    },
  ],
  [
    "customised",
    {
      content: resolveServiceContent("insulation", null),
      contentOverrides: {
        includedItems: ["a", "b"],
        processSteps: [{ title: "T", body: "B", timeline: "1 day" }],
      },
    },
  ],
  ["no content at all", {}],
  [
    "junk in the Json columns",
    {
      content: {},
      contentOverrides: { includedItems: "nope", processSteps: 42 },
    },
  ],
  [
    "a trade with no defaults",
    {
      content: resolveServiceContent("nonexistent_trade", null),
      contentOverrides: {},
    },
  ],
];
for (const [label, category] of WORDING_CASES) {
  try {
    const html = renderToStaticMarkup(
      <QuoteWording category={category} onChange={() => {}} defaultOpen />,
    );
    if (!html || html.length < 40)
      throw new Error(`rendered ${html.length} chars`);
    pass += 1;
  } catch (err) {
    fails.push(`quote wording (${label}): ${err.message}`);
  }
}

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} rendered`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ builder & settings render: ${pass} renders`);
