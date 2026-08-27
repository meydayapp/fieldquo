// scripts/check-cabinet-labour.mjs
//
// The hours on a cabinet job — the trade this product sells most of.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// Two things, and the second was worse.
//
// quoteCosting's takeoffDerived required a `takeoff` object. Cabinet groups
// have none — their inputs are intake ANSWERS — so it returned zero and every
// cabinet quote was costed labour-blind.
//
// And the recipe that did carry labour carried it as ONE number:
// `doors × 45min + drawers × 20min`, labelled "Prep, spray & reinstall". Eleven
// operations behind a single figure nobody could check or tune. A greasy 1980s
// kitchen at three primer coats with frame-mounted hinges costed exactly the
// same as a two-year-old IKEA install at one coat.
//
// ══ The trap in fixing it ══════════════════════════════════════════════════
//
// quoteCostSummary ADDS takeoff hours to recipe hours. Deriving cabinet labour
// in both places doubled every cabinet job — which is what the first version of
// this fix did, and what the double-count assertions below exist to catch if
// anyone reintroduces it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-cabinet-labour.mjs

import { cabinetRunLabour, kitchenSize, CABINET_LABOUR_DEFAULTS } from "@/lib/pricing/cabinetLabour";
import { quoteCostSummary } from "@/lib/costing/quoteCosting";
import { INTAKE_FIELDS } from "@/app/data/quoteIntakeFields";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
const near = (label, got, want, tol = 0.02) =>
  ok(label, Math.abs(got - want) <= tol, got);

const D = CABINET_LABOUR_DEFAULTS;
const hoursOf = (cfg) => cabinetRunLabour(cfg, null).hours;
const stepOf = (cfg, key) =>
  cabinetRunLabour(cfg, null).steps.find((s) => s.key === key)?.hours ?? 0;

console.log("\nThe owner's own timings, arithmetic checked");
// 24 doors × 6min + 8 drawers × 4min = 176min = 2.933h
near("sanding is per piece, doors and drawers priced apart",
  stepOf({ doors: 24, drawers: 8 }, "sanding"), (24 * 6 + 8 * 4) / 60);
// A handle is 1 minute to fill and 2 to drill.
near("a handle is 3 minutes",
  stepOf({ doors: 24, drawers: 8, handleHoles: true }, "handles"), (32 * 3) / 60);
// Degreasing doubles on a greasy kitchen. This is the whole reason it is asked.
near("degreasing: normal is 3 min a piece",
  stepOf({ doors: 24, drawers: 8, condition: "normal" }, "degreasing"), (32 * 3) / 60);
near("degreasing: heavy is 6",
  stepOf({ doors: 24, drawers: 8, condition: "heavy" }, "degreasing"), (32 * 6) / 60);
// Fine sanding after primer costs the same as the first pass, once — not per coat.
const fine3 = stepOf({ doors: 24, drawers: 8, primerCoats: 3 }, "fineSanding");
const fine1 = stepOf({ doors: 24, drawers: 8, primerCoats: 1 }, "fineSanding");
ok("fine sanding happens once, not per primer coat", fine3 === fine1 && fine3 > 0, `${fine3}/${fine1}`);
ok("and not at all when nothing is primed",
  stepOf({ doors: 24, drawers: 8, primerCoats: 0 }, "fineSanding") === 0);
// Spraying and drying both scale with TOTAL coats.
near("spraying is 3 min a piece per coat",
  stepOf({ doors: 24, drawers: 8, primerCoats: 2, topCoats: 2 }, "spraying"), (32 * 3 * 4) / 60);
near("drying is an hour a coat",
  stepOf({ doors: 24, drawers: 8, primerCoats: 3, topCoats: 2 }, "drying"), 5);
// Two-tone: half an hour of masking, three hours of spraying and drying.
near("a second colour adds 3.5 hours",
  stepOf({ doors: 24, drawers: 8, twoTone: true }, "toneExtra"),
  D.toneExtraPrepHours + D.toneExtraPaintHours);

console.log("\nKitchen size, and the band the owner left fuzzy");
ok("under 30 pieces is small", kitchenSize(29) === "small");
ok("30 is medium", kitchenSize(30) === "medium");
// His bands overlapped ("medium 30 to 45 ish, large 40-45+"). 45 resolves to
// medium — the cheaper reading, so the ambiguity can never pad a quote.
ok("45 is medium, not large", kitchenSize(45) === "medium");
ok("46 is large", kitchenSize(46) === "large");
ok("box sanding follows the band",
  stepOf({ doors: 20, drawers: 5 }, "boxSanding") === D.boxSandHoursSmall &&
  stepOf({ doors: 40, drawers: 5 }, "boxSanding") === D.boxSandHoursMedium &&
  stepOf({ doors: 50, drawers: 5 }, "boxSanding") === D.boxSandHoursLarge);
// Reinstall spans exactly the 1–4 hours he described, and needs both inputs to
// reach either end.
ok("reinstall bottoms out at 1h",
  stepOf({ doors: 20, drawers: 5, hingeType: "clip" }, "install") === 1);
ok("...and tops out at 4h on a large kitchen with frame-mounted hinges",
  stepOf({ doors: 50, drawers: 5, hingeType: "legacy" }, "install") === 4);

console.log("\nEvery answer has to move the number");
// An input the model reads that changes nothing is a question wasting the
// estimator's time; one nothing can set is worse.
const base = { doors: 24, drawers: 8 };
ok("heavy condition costs more", hoursOf({ ...base, condition: "heavy" }) > hoursOf({ ...base, condition: "normal" }));
ok("legacy hinges cost more", hoursOf({ ...base, hingeType: "legacy" }) > hoursOf({ ...base, hingeType: "clip" }));
ok("an extra primer coat costs more", hoursOf({ ...base, primerCoats: 3 }) > hoursOf({ ...base, primerCoats: 2 }));
ok("handles cost more", hoursOf({ ...base, handleHoles: true }) > hoursOf(base));
const fieldKeys = INTAKE_FIELDS.cabinet_refinishing.map((f) => f.key);
for (const k of ["condition", "hingeType"]) {
  ok(`"${k}" can actually be set on the quote form`, fieldKeys.includes(k));
}

console.log("\nThe add-on override is honoured by the COST, not just the price");
// Quoting two handles and costing thirty-two is a margin computed against work
// nobody is doing.
near("two handles costs two handles",
  stepOf({ ...base, handleHoles: true, addOnUnits: { handleHoles: 2 } }, "handles"), (2 * 3) / 60);
ok("zero handles costs nothing",
  stepOf({ ...base, handleHoles: true, addOnUnits: { handleHoles: 0 } }, "handles") === 0);

console.log("\nAn unanswered question is not an answer");
ok("no counts at all is INCOMPLETE, not a free job",
  cabinetRunLabour({ doors: 0, drawers: 0 }, null).incomplete === true);
ok("...and reports no hours rather than a confident zero",
  cabinetRunLabour({ doors: 0, drawers: 0 }, null).hours === 0);
// Anything not measured says so instead of quietly becoming fact.
const unanswered = cabinetRunLabour(base, null).assumptions;
ok("an unanswered condition is declared", unanswered.some((a) => /condition/i.test(a)));
ok("an unanswered hinge type is declared", unanswered.some((a) => /hinge/i.test(a)));
ok("high complexity says it was never measured",
  cabinetRunLabour({ ...base, complexityLevel: "high" }, null).assumptions.some((a) => /complexity/i.test(a)));
ok("a fully answered small job declares nothing",
  cabinetRunLabour({ ...base, condition: "normal", hingeType: "clip" }, null).assumptions.length === 0);

console.log("\nEnd to end — and NOT counted twice");
const group = (iv) => ({
  categoryKey: "cabinet_refinishing",
  label: "Cabinet Refinishing",
  takeoff: null,
  intakeValues: { woodSpecies: "mdf_prefinished", ...iv },
});
const summary = (iv) => quoteCostSummary({ scopeGroups: [group(iv)], labourRate: 35, price: 6800 });

const plain = summary({ doorCount: "24", drawerCount: "8" });
ok("a cabinet quote reports hours at all", plain.labourHours > 0, plain.labourHours);
// The old blended figure was 24×45 + 8×20 = 20.67h plus setup. If both paths
// ran, the total would sit near the sum of that and the itemised ~33h.
ok("and not the blended figure plus the itemised one",
  plain.labourHours < 45, plain.labourHours);
// Each answer has to survive the trip through the costing, not just the module.
const upgraded = summary({ doorCount: "24", drawerCount: "8", handleHoles: true, twoTone: true });
near("handles and two-tone reach the cost estimate",
  upgraded.labourHours - plain.labourHours,
  (32 * 3) / 60 + D.toneExtraPrepHours + D.toneExtraPaintHours,
  0.05);
const greasy = summary({ doorCount: "24", drawerCount: "8", condition: "heavy", hingeType: "legacy" });
ok("so do condition and hinge type", greasy.labourHours > plain.labourHours, greasy.labourHours);
ok("more hours means less margin", greasy.marginPct < plain.marginPct);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
