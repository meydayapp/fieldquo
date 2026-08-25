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
import fs from "node:fs";
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
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import PayCycleCard from "../app/components/settings/PayCycleCard.js";
import JobMaterials from "../app/components/jobs/JobMaterials.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";
import { hasLevel } from "../lib/permissions/enforce.js";
import {
  deriveSourcingLines,
  sourcingProgress,
} from "../lib/jobs/sourcingList.js";
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
  // The trade whose defaults ship [placeholders]: the panel must show the
  // draft (brackets and all) and the banner naming what is withheld, or a
  // company can never fill one in.
  [
    "placeholders to fill in",
    {
      content: resolveServiceContent("cabinet_refinishing", null),
      contentOverrides: {},
    },
  ],
  // The trade whose paragraph varies with the takeoff. `variesWith` drives a
  // different hint, and a non-string in that slot must not take the panel out.
  [
    "a trade whose scope varies",
    {
      content: resolveServiceContent("cabinet_refacing", null),
      contentOverrides: {},
    },
  ],
  [
    "a customised scope paragraph",
    {
      content: resolveServiceContent("cabinet_refacing", null),
      contentOverrides: { scopeDescription: "We do it our way." },
    },
  ],
  [
    "junk in the scope column",
    {
      content: { draft: { description: 42, included: "no", steps: null } },
      contentOverrides: { scopeDescription: 7 },
    },
  ],
];
for (const [label, category] of WORDING_CASES) {
  try {
    const html = renderToStaticMarkup(
      <LanguageProvider initialLanguage="en">
        <QuoteWording category={category} onChange={() => {}} defaultOpen />
      </LanguageProvider>,
    );
    if (!html || html.length < 40)
      throw new Error(`rendered ${html.length} chars`);
    pass += 1;
  } catch (err) {
    fails.push(`quote wording (${label}): ${err.message}`);
  }
}

// ── The job's sourcing list ────────────────────────────────────────────────
//
// deriveSourcingLines runs inside an API route, so a throw on a malformed job
// is a 500 on the job page. It is exercised here rather than in the pure check
// script because the module imports the Prisma client.
// Every write on this panel needs jobs:view_create_edit. Rendered through the
// real provider at each level, because a viewer handed a page of checkboxes
// that 403 on the first tap is the one rule this codebase is swept for.
// PermissionProvider takes `role` and `permissions` as separate props, NOT a
// caller object — passing one as `value` renders every case as "unresolved"
// and the test proves nothing. Learned by writing it wrong first.
const GATE_CASES = [
  ["unresolved", null, null],
  ["viewer", "employee", { jobs: "view" }],
  ["editor", "admin", { jobs: "view_create_edit" }],
  ["owner", "owner", {}],
];
// The render above proves the panel survives every level. It cannot prove the
// GATE, because renderToStaticMarkup runs no effects — the fetch never
// resolves, so every level renders the loading skeleton and a viewer would
// look correctly gated even if it were not. So the gate is asserted against
// the exact expression the component evaluates.
try {
  for (const [label, role, permissions] of GATE_CASES) {
    const caller = role === null ? null : { role, permissions };
    const canEdit = hasLevel(caller, "jobs", "view_create_edit");
    const expected = label === "editor" || label === "owner";
    if (canEdit !== expected)
      throw new Error(
        `${label}: hasLevel says ${canEdit}, expected ${expected}`,
      );
  }
  pass += 1;
} catch (err) {
  fails.push(`job materials gate: ${err.message}`);
}

for (const [label, role, permissions] of GATE_CASES) {
  try {
    const html = renderToStaticMarkup(
      <PermissionProvider role={role} permissions={permissions}>
        <JobMaterials jobId="j1" />
      </PermissionProvider>,
    );
    if (!html || html.length < 40)
      throw new Error(`rendered ${html.length} chars`);
    pass += 1;
  } catch (err) {
    fails.push(`job materials panel (${label}): ${err.message}`);
  }
}

try {
  const job = {
    quote: {
      scopeGroups: [
        {
          categoryId: "c1",
          category: { key: "roofing_service" },
          takeoff: {
            ...createTradeConfig("roofing_service"),
            areaSqft: 2400,
            pitchRise: 8,
            layers: 1,
            dripEdgeFt: 180,
          },
        },
        {
          categoryId: "c2",
          category: { key: "paving" },
          takeoff: {
            ...createTradeConfig("paving"),
            patioSqft: 600,
            complexityLevel: "moderate",
            paverOption: "standard",
          },
        },
        // A trade with no bill, and two malformed groups.
        {
          categoryId: "c3",
          category: { key: "plumbing" },
          takeoff: { sqft: 10 },
        },
        { categoryId: "c4", category: null, takeoff: null },
      ],
    },
  };
  const lines = deriveSourcingLines(job);
  const must = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  must(lines.length > 0, "derived nothing");
  must(
    lines.some((l) => l.categoryKey === "roofing_service"),
    "no roofing lines",
  );
  must(
    lines.some((l) => l.categoryKey === "paving"),
    "no paving lines",
  );
  must(
    !lines.some((l) => l.categoryKey === "plumbing"),
    "plumbing has no bill",
  );
  must(
    lines.every((l) => l.qty > 0 && l.unit && l.name),
    "a line is malformed",
  );
  // The whole point: an unpriced line stays null so the panel can say so.
  must(
    lines.some((l) => l.estUnitCost === null),
    "unpriced became 0",
  );
  must(
    new Set(lines.map((l) => l.sortOrder)).size === lines.length,
    "sort order collides",
  );
  for (const bad of [
    null,
    undefined,
    {},
    { quote: null },
    { quote: { scopeGroups: "x" } },
    42,
  ]) {
    must(
      deriveSourcingLines(bad).length === 0,
      `derived from ${JSON.stringify(bad)}`,
    );
  }
  // Progress must not fold unpriced lines into the estimate as free.
  const p = sourcingProgress([
    {
      qty: 2,
      unit: "bag",
      estUnitCost: 10,
      actualCost: 25,
      purchasedAt: new Date(),
    },
    {
      qty: 3,
      unit: "bag",
      estUnitCost: null,
      actualCost: null,
      purchasedAt: null,
    },
  ]);
  must(
    p.total === 2 && p.bought === 1 && p.outstanding === 1,
    "progress counts",
  );
  must(!p.complete, "not complete with one outstanding");
  must(p.estimatedTotal === 20, `estimated ${p.estimatedTotal}`);
  must(p.actualTotal === 25, `actual ${p.actualTotal}`);
  must(p.unpriced === 1, "unpriced count");
  must(!sourcingProgress([]).complete, "an empty list is not complete");
  pass += 1;
} catch (err) {
  fails.push(`sourcing list: ${err.message}`);
}

// ── Every auto-task is keyed to ONE record ─────────────────────────────────
//
// A job, a quote and an invoice each get their own to-do, because they are
// separate things that happen on separate days — but a task per MATERIAL would
// put seventeen rows on /app/tasks for one job. The rule is one task per
// record, and the sourceKey is what enforces it: it is uniquely indexed, so a
// key that did not carry an id would let the first job's task block every
// other job's forever.
try {
  // Comments stripped first. autoCreate.js documents its own key format in a
  // doc comment — "rather than the string `invoice_sent:${id}` written out" —
  // and scanning raw source counted that prose as a second real key, reporting
  // a collision that does not exist. A checker that reads comments as code
  // fails on good documentation.
  const src = fs
    .readFileSync("lib/tasks/autoCreate.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  const keys = [...src.matchAll(/`(\w+):\$\{([^}]+)\}`/g)].map((m) => ({
    prefix: m[1],
    id: m[2],
  }));
  if (keys.length < 4) throw new Error(`only found ${keys.length} source keys`);
  for (const k of keys) {
    // Asserts the key carries a per-record IDENTIFIER, not the shape of the
    // expression producing it. `.id`, a bare `id`, or a camelCase `invoiceId`
    // all satisfy it — the last one has no word boundary before "Id", which is
    // why the naive \bid\b fails a refactor it should welcome. A check that
    // breaks on better code teaches people to delete the check.
    if (!/(\.id\b|\bid\b|Id\b)/.test(k.id))
      throw new Error(`${k.prefix} is not keyed to a record id (${k.id})`);
  }
  const prefixes = keys.map((k) => k.prefix);
  for (const want of [
    "quote_accepted",
    "job_materials",
    "invoice_sent",
    "job_completed",
  ]) {
    if (!prefixes.includes(want)) throw new Error(`missing ${want}`);
  }
  // One per record, not one per record TYPE — two jobs must not collide.
  if (new Set(prefixes).size !== prefixes.length)
    throw new Error("two task kinds share a prefix and would collide");
  pass += 1;
} catch (err) {
  fails.push(`auto-task keys: ${err.message}`);
}

// The pay-cycle card renders before its fetch resolves and after it fails —
// both are the states a settings page is actually in most of the time.
try {
  const html = renderToStaticMarkup(<PayCycleCard />);
  // Null data renders nothing, which is correct: a card that flashed defaults
  // before the company's real cadence loaded would show the wrong payday.
  if (html !== "") throw new Error("rendered before data loaded");
  pass += 1;
} catch (err) {
  fails.push(`pay cycle card: ${err.message}`);
}

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} rendered`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ builder, settings & sourcing: ${pass} checks`);
