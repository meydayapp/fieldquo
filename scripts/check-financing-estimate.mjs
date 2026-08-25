// Executes lib/financing/monthlyEstimate.js — the monthly instalment maths, and
// the rule that makes it safe to show a homeowner at all.
//
// The rule, restated because it is the whole reason this file exists:
//
//   NO STATED TERMS → NO FIGURE.
//
// FieldQuo has no default APR and no default term. The original cabinet site
// hardcoded 15% and quoted a monthly payment nobody at the contractor had
// agreed to; the first section below is the assertion that stops that coming
// back through the side door, and the last section proves that every surface
// which DOES show a figure calls it an estimate and names who really sets the
// terms.
import {
  monthlyPayment,
  monthlyEstimate,
  financingTerms,
  normaliseTerms,
  MAX_APR_PCT,
  MAX_TERM_MONTHS,
} from "@/lib/financing/monthlyEstimate";
import { normaliseFinancing } from "@/lib/estimate/financing";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { contrastRatio, ensureContrast } from "@/lib/brand/colour";

let pass = 0,
  fail = 0;
const ok = (n, c, got) => {
  if (c) {
    pass++;
    console.log(`  ✓ ${n}`);
  } else {
    fail++;
    console.log(
      `  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`,
    );
  }
};

// ── 1. No terms → no figure, ever ───────────────────────────────────────────
console.log("\nNo stated terms → no monthly figure (there is no default)");

const NO_TERMS = [
  ["nothing saved", null],
  ["not an object", "12 months at 9.9%"],
  ["financing off, nothing stated", { enabled: false }],
  [
    "enabled, note only",
    { enabled: true, note: "We offer financing — ask us." },
  ],
  ["enabled, provider link only", { enabled: true, url: "https://affirm.com" }],
  ["APR stated, no term", { enabled: true, aprPct: 9.9 }],
  ["term stated, no APR", { enabled: true, termMonths: 12 }],
  [
    "APR stated, term blank string",
    { enabled: true, aprPct: 9.9, termMonths: "" },
  ],
  [
    "term stated, APR blank string",
    { enabled: true, aprPct: "", termMonths: 12 },
  ],
  ["both null", { enabled: true, aprPct: null, termMonths: null }],
  ["term of 0", { enabled: true, aprPct: 9.9, termMonths: 0 }],
  ["negative APR", { enabled: true, aprPct: -5, termMonths: 12 }],
  [
    "APR above the band",
    { enabled: true, aprPct: MAX_APR_PCT + 0.01, termMonths: 12 },
  ],
  [
    "term above the band",
    { enabled: true, aprPct: 9.9, termMonths: MAX_TERM_MONTHS + 1 },
  ],
  [
    "arrays where numbers belong",
    { enabled: true, aprPct: [9.9], termMonths: [12] },
  ],
  [
    "booleans where numbers belong",
    { enabled: true, aprPct: true, termMonths: true },
  ],
];

for (const [label, financing] of NO_TERMS) {
  ok(
    `${label} → no terms`,
    financingTerms(financing) === null,
    financingTerms(financing),
  );
  ok(`${label} → no estimate`, monthlyEstimate(financing, 12000) === null);
}

// The half-stated pair must not survive a SAVE either. Storing a lone APR would
// leave a settings screen that looks configured and a quote page that shows
// nothing — the dead-control failure, one layer down.
console.log("\nA half-stated pair never reaches storage");
const halfApr = normaliseFinancing({ enabled: true, aprPct: 9.9 });
ok(
  "APR alone stores as two nulls",
  halfApr.aprPct === null && halfApr.termMonths === null,
  halfApr,
);
const halfTerm = normaliseFinancing({ enabled: true, termMonths: 24 });
ok(
  "term alone stores as two nulls",
  halfTerm.aprPct === null && halfTerm.termMonths === null,
  halfTerm,
);
const bothSaved = normaliseFinancing({
  enabled: true,
  aprPct: "9.90",
  termMonths: "12",
});
ok(
  "both stated survive, as numbers",
  bothSaved.aprPct === 9.9 && bothSaved.termMonths === 12,
  bothSaved,
);
ok(
  "normaliseFinancing(null) states no terms",
  normaliseFinancing(null).aprPct === null,
);

// The source itself must contain no fallback rate. A future "sensible default"
// is precisely how the hardcoded 15% got into the cabinet site.
console.log("\nThe module states no rate of its own");
const { readFileSync } = await import("node:fs");
const src = readFileSync(
  new URL("../lib/financing/monthlyEstimate.js", import.meta.url),
  "utf8",
);
const code = src
  .split("\n")
  .filter(
    (l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"),
  )
  .join("\n");
ok("no default APR parameter in code", !/aprPct\s*=\s*[\d.]/.test(code));
ok("no default term parameter in code", !/termMonths\s*=\s*[\d.]/.test(code));

// ── 2. 0% APR — straight division, not a divide-by-zero ─────────────────────
console.log("\n0% APR divides, it does not explode");
ok(
  "12000 over 12 at 0% = 1000.00",
  monthlyPayment({ principal: 12000, aprPct: 0, termMonths: 12 }) === 1000,
);
ok(
  "10000 over 3 at 0% = 3333.33",
  monthlyPayment({ principal: 10000, aprPct: 0, termMonths: 3 }) === 3333.33,
);
ok(
  "6000 over 600 at 0% = 10.00",
  monthlyPayment({ principal: 6000, aprPct: 0, termMonths: 600 }) === 10,
);
// Under half a cent a month is not "$0.00 a month" — it is nothing worth
// showing, and "$0.00" would read to a homeowner as free.
ok(
  "$1 over 600 months rounds away to no figure",
  monthlyPayment({ principal: 1, aprPct: 0, termMonths: 600 }) === null,
);
ok(
  "0% via a string field",
  monthlyPayment({ principal: 12000, aprPct: "0", termMonths: "12" }) === 1000,
);
// A rate small enough that (1+r)^n − 1 underflows to zero takes the same path.
// Without the guard this is a division by zero and Infinity lands on a quote.
const dust = monthlyPayment({
  principal: 12000,
  aprPct: 1e-14,
  termMonths: 12,
});
ok("a rate of 1e-14% stays finite", Number.isFinite(dust) && dust > 0, dust);

// ── 3. Known amortisation cases, to the cent ────────────────────────────────
//
// Independently checkable: these are the standard textbook figures for the
// payment formula P·r(1+r)^n / ((1+r)^n − 1).
console.log("\nAmortisation, to the cent");
ok(
  "$200,000 at 4.5% over 360 months = $1,013.37",
  monthlyPayment({ principal: 200000, aprPct: 4.5, termMonths: 360 }) ===
    1013.37,
  monthlyPayment({ principal: 200000, aprPct: 4.5, termMonths: 360 }),
);
ok(
  "$25,000 at 6% over 60 months = $483.32",
  monthlyPayment({ principal: 25000, aprPct: 6, termMonths: 60 }) === 483.32,
  monthlyPayment({ principal: 25000, aprPct: 6, termMonths: 60 }),
);
ok(
  "$10,000 at 9.9% over 12 months = $878.69",
  monthlyPayment({ principal: 10000, aprPct: 9.9, termMonths: 12 }) === 878.69,
  monthlyPayment({ principal: 10000, aprPct: 9.9, termMonths: 12 }),
);
// Interest is real: an APR above zero must cost more than dividing.
const amort = monthlyPayment({ principal: 12000, aprPct: 9.9, termMonths: 12 });
ok("9.9% costs more per month than 0%", amort > 1000, amort);

console.log("\nmonthlyEstimate carries the terms it used");
const est = monthlyEstimate(
  { enabled: true, aprPct: 6, termMonths: 60 },
  25000,
);
ok("monthly matches monthlyPayment", est?.monthly === 483.32, est);
ok("echoes the stated APR", est?.aprPct === 6);
ok("echoes the stated term", est?.termMonths === 60);
ok(
  "no key invents anything else",
  Object.keys(est).sort().join() === "aprPct,monthly,termMonths",
  Object.keys(est),
);

// ── 4. Hostile input never throws, never NaN, never Infinity ────────────────
console.log("\nHostile input: no throw, no NaN, no Infinity");

const HOSTILE = [
  undefined,
  null,
  NaN,
  Infinity,
  -Infinity,
  0,
  -1,
  -0.0001,
  "",
  "   ",
  "abc",
  "1e999",
  "9,9",
  "0x10",
  [],
  [1],
  {},
  { valueOf: () => 1 },
  true,
  false,
  Number.MAX_VALUE,
  Number.MIN_VALUE,
  1e308,
  -1e308,
  "Infinity",
  "-Infinity",
  "NaN",
  1e21,
  0.1 + 0.2,
];

let threw = 0;
let bad = 0;
let combos = 0;
for (const principal of HOSTILE) {
  for (const aprPct of HOSTILE) {
    for (const termMonths of HOSTILE) {
      combos++;
      let out;
      try {
        out = monthlyPayment({ principal, aprPct, termMonths });
      } catch {
        threw++;
        continue;
      }
      // Only two acceptable answers: null, or a positive finite number of cents.
      if (out === null) continue;
      if (typeof out !== "number" || !Number.isFinite(out) || out <= 0) bad++;
    }
  }
}
ok(`no throw across ${combos} hostile combinations`, threw === 0, threw);
ok("no NaN / Infinity / negative ever returned", bad === 0, bad);

// The shapes a caller might actually hand it, rather than a field at a time.
const SHAPES = [
  undefined,
  null,
  0,
  "",
  [],
  {},
  { principal: 1 },
  { aprPct: 5 },
  NaN,
  () => {},
];
let shapeThrew = 0;
for (const s of SHAPES) {
  try {
    const out = monthlyPayment(s);
    if (out !== null && !Number.isFinite(out)) shapeThrew++;
  } catch {
    shapeThrew++;
  }
}
ok(
  "a garbage argument object is refused, not thrown on",
  shapeThrew === 0,
  shapeThrew,
);

// Same for the two readers.
let readerThrew = 0;
for (const s of HOSTILE) {
  try {
    financingTerms(s);
    normaliseTerms(s);
    monthlyEstimate(s, s);
    normaliseFinancing(s);
  } catch {
    readerThrew++;
  }
}
ok(
  "financingTerms / normaliseTerms / monthlyEstimate / normaliseFinancing never throw",
  readerThrew === 0,
  readerThrew,
);

// A zero or negative principal has no instalment. A quote of $0 showing
// "$0.00 a month" is noise; a negative one is nonsense.
console.log("\nA principal with nothing to finance shows nothing");
ok(
  "$0 total → no figure",
  monthlyPayment({ principal: 0, aprPct: 9.9, termMonths: 12 }) === null,
);
ok(
  "negative total → no figure",
  monthlyPayment({ principal: -5000, aprPct: 9.9, termMonths: 12 }) === null,
);

// ── 5. What the homeowner is actually told ──────────────────────────────────
//
// The maths being honest is worthless if the sentence beside it isn't. Every
// language that shows a figure must also say it is an estimate, whose terms it
// is on, and that the provider settles the real ones.
console.log("\nEvery language labels the figure as an estimate");
for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
  const copy = clientDocCopy(lang);
  const note = copy.financingEstimateNote("Acme Painting");
  ok(
    `${lang}: has all six financing strings`,
    [
      copy.financingAvailable,
      copy.financingHeading,
      copy.financingMonthly,
      copy.financingTermsLine,
      copy.financingEstimateNote,
      copy.financingCta,
    ].every(Boolean),
  );
  // The "pay monthly" heading only appears over an actual figure — with no
  // stated terms the panel uses the neutral one, so the two must differ.
  ok(
    `${lang}: the two headings are distinct`,
    copy.financingAvailable !== copy.financingHeading,
    copy.financingAvailable,
  );
  ok(
    `${lang}: the note names the company whose terms these are`,
    note.includes("Acme Painting"),
    note,
  );
  ok(
    `${lang}: the note is a real sentence, not a stub`,
    note.length > 80,
    note.length,
  );
  const line = copy.financingTermsLine(12, "9.9%");
  ok(
    `${lang}: the terms line states both term and rate`,
    line.includes("12") && line.includes("9.9%"),
    line,
  );
  const monthly = copy.financingMonthly("$878.69");
  ok(
    `${lang}: the monthly line is hedged, not a flat price`,
    monthly.includes("$878.69") && monthly.length > 9,
    monthly,
  );
}
// English is the one we can assert word-for-word.
const en = clientDocCopy("en");
const enNote = en.financingEstimateNote("Acme Painting");
ok("en note says 'estimate'", /estimate/i.test(enNote), enNote);
ok(
  "en note hands the real terms to the provider",
  /provider/i.test(enNote) && /actual/i.test(enNote),
  enNote,
);
ok(
  "en monthly figure is approximate",
  /about/i.test(en.financingMonthly("$878.69")),
);

// ── 6. The panel's heading stays readable on hostile brand colours ──────────
//
// The financing panel is a 5%-alpha accent wash over white; #f2f2f2 is the
// darkest that can composite to (a pure-black accent), which is what the page
// measures against. Contractors pick yellow, white and mid-grey, so this is
// measured rather than assumed.
console.log("\nHeading contrast on the financing panel");
const BRANDS = [
  "#ffff00",
  "#ffffff",
  "#f5f5f5",
  "#808080",
  "#06356b",
  "#000000",
  "#ff6600",
  "#c0c0c0",
  "#00ff00",
  "#7f7f00",
];
for (const brand of BRANDS) {
  const ink = ensureContrast(brand, "#f2f2f2", 4.5);
  const ratio = contrastRatio(ink, "#f2f2f2");
  ok(`${brand} → heading at ${ratio.toFixed(2)}:1`, ratio >= 4.5, ratio);
}

// A company that turns financing off still has an APR and a term sitting in
// their settings. The number is the dangerous half, so the guard lives at the
// source rather than in every caller — "remember to check enabled" is the kind
// of rule that holds until the third caller, and the quote email has a seam
// waiting for exactly that call.
console.log("\nFinancing switched off shows no figure");
{
  const stated = { aprPct: 9.9, termMonths: 12 };
  ok(
    "enabled: false → null",
    monthlyEstimate({ ...stated, enabled: false }, 14250) === null,
  );
  ok(
    "absent enabled is not enabled",
    monthlyEstimate({ ...stated }, 14250) === null,
  );
  ok(
    "truthy is not true",
    monthlyEstimate({ ...stated, enabled: "yes" }, 14250) === null,
  );
  ok("null settings → null", monthlyEstimate(null, 14250) === null);
  ok(
    "...and switched on, it still works",
    (monthlyEstimate({ ...stated, enabled: true }, 14250) || {}).monthly > 0,
  );
}

console.log(
  `\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`,
);
process.exit(fail ? 1 : 0);
