// scripts/check-drywall-finish-levels.mjs
//
//   npm run check:drywall-finish-levels
//
// Drywall quotes and the GA-214 finish levels: the select, the price book that
// went live behind it, the lines it writes, and what none of that may do.
// Before 2026-10-03 the select offered three values (one, "level 2
// unfinished", wrong), nothing read the answer, every drywall document said
// "Level 4, or Level 5 where specified" whatever was sold, and the drywall
// book sat staged in app/data/priceBooks/interior.js with no reader.
//
// What is asserted, section by section:
//
//   A. Six levels offered on both drywall quote types, the book's three tiers
//      on drywall_install, each with a plain line in every app language.
//   B. The three old stored values read as the levels they meant; nothing
//      else is read as a level.
//   C. The book is live: registered, shown on the rate card with ONLY the
//      rows a quote reads (hang + Levels 1–5, per tier), every one of those
//      rows proven read by overriding it and finding the override on a line.
//   D. The lines: each level × tier puts exactly its hang and finishing lines
//      on, at the company's merged-book rates; a change swaps in place; Level
//      0 is hang only; the modes add / update exactly what they say.
//   E. A line the contractor edited is never replaced or removed.
//   F. Templates: the book owns the board — a template line keyed to a board
//      figure is held back in either order of adding, a company's own single
//      service owns its group, and a template line is never touched.
//   G. The client's document names the chosen level in all eight languages;
//      an old value or none prints exactly what no answer prints.
//   H. The public self-quote field: the question and six strings, no price,
//      no rate, no tier, none of the staff-side keys.
//   I. New groups: Level 4 + Standard for one the estimator added; a phone
//      call's draft keeps its blanks but still gets the hang line it sized.
//   J. Materials: a tripwire on the recipe the compound would scale in.
//
// Executed, not matched: the real modules are imported and run; only the
// builder and route wiring (React and Prisma files) are read as text.

import { readFileSync } from "node:fs";
import {
  FINISH_LEVELS,
  FINISH_LEVEL_LABELS,
  LEGACY_FINISH_LEVELS,
  DEFAULT_FINISH_LEVEL,
  DRYWALL_TIERS,
  DRYWALL_TIER_LABELS,
  normaliseFinishLevel,
  normaliseDrywallTier,
  documentFinishLevel,
} from "@/app/data/drywallFinishLevels";
import {
  getIntakeFields,
  publicIntakeFields,
  shownSelectValue,
  withFieldDefaults,
  INTAKE_FIELDS,
} from "@/app/data/quoteIntakeFields";
import {
  FINISH_LINE_IDS,
  finishLevelRate,
  hangRate,
  syncFinishLine,
  isFinishLine,
  isDrywallLine,
  drywallPartOf,
  drywallQuantity,
  bookBillsBoard,
} from "@/lib/quotes/drywallFinishLine";
import {
  resolveServiceContent,
  dominantProcessSteps,
  drywallFinishText,
  presetCatalogues,
  DRYWALL_INSTALL_PARAGRAPH_SINCE,
} from "@/lib/documents/serviceContent";
import { scopeBreakdownHtml, quoteSectionsText } from "@/lib/email/quoteSections";
import {
  TRADE_PRICE_BOOKS,
  PRICE_BOOK_FIELDS,
  getPriceBook,
  hasPriceBook,
  tradeIsPricedByDefault,
  priceBookBasis,
  readField,
} from "@/app/data/tradePriceBooks";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
import { MATERIAL_RECIPES } from "@/app/data/materialRecipes";
import { INTERIOR_PRICE_BOOKS, INTERIOR_RECIPES } from "@/app/data/priceBooks/interior";
import { newScopeGroup, applyLineItemEdit, scopeGroupPayload, groupSubtotal } from "@/lib/quotes/builderPayload";
import { expandServiceTemplate, keysPricedByGroup, measurementsFromGroups } from "@/lib/quotes/serviceTemplateLines";
import { newRoomMeasure, newMeasureRoom } from "@/lib/measure/reuseTakeoffs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { LANGUAGE_CODES } from "@/app/i18n/languages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? pass++
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)?.slice(0, 300)}` : ""}`);
const section = (s) => console.log(`\n${s}`);
const src = (p) => readFileSync(p, "utf8");
const code = (p) => src(p).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const r2 = (n) => Math.round(n * 100) / 100;

const TRADES = ["drywall", "drywall_install"];
const SIX = ["level_0", "level_1", "level_2", "level_3", "level_4", "level_5"];
const TIERS = ["standard", "moderate", "high"];
const finishField = (k) => getIntakeFields(k).find((f) => f.key === "finishLevel");
const tierField = () => getIntakeFields("drywall_install").find((f) => f.key === "complexityLevel");

/* ══ A. What is offered ═════════════════════════════════════════════════ */
section("A. Six levels and three tiers offered");

ok("FINISH_LEVELS is level_0 … level_5, in order", JSON.stringify(FINISH_LEVELS) === JSON.stringify(SIX), FINISH_LEVELS);
ok("the default is Level 4", DEFAULT_FINISH_LEVEL === "level_4");
for (const k of TRADES) {
  const f = finishField(k);
  ok(`${k}: has a Finish Level select`, f && f.type === "select", f);
  ok(`${k}: offers exactly the six levels`, JSON.stringify(f?.options) === JSON.stringify(SIX), f?.options);
  ok(`${k}: every level has its plain line`, SIX.every((l) => typeof f?.optionLabels?.[l] === "string" && f.optionLabels[l].includes(`Level ${l.slice(-1)}`)));
  ok(`${k}: no old value is still OFFERED`, Object.keys(LEGACY_FINISH_LEVELS).every((v) => !f?.options?.includes(v)));
}
ok("both quote types share one definition", finishField("drywall") === finishField("drywall_install"));
ok("no other quote type offers the old values", Object.entries(INTAKE_FIELDS).every(([, fields]) => fields.every((f) => !(f.options || []).some((o) => Object.hasOwn(LEGACY_FINISH_LEVELS, o)))));
ok("drywall_install asks the book's tier: standard / moderate / high, default standard, staff only", JSON.stringify(tierField()?.options) === JSON.stringify(TIERS) && tierField().default === "standard" && tierField().staffOnly === true && JSON.stringify(DRYWALL_TIERS) === JSON.stringify(TIERS));
ok("…the tiers are the book's own", TIERS.every((t) => Boolean(INTERIOR_PRICE_BOOKS.drywall_install.complexity[t])));
ok("plain drywall (no book) is not asked a tier it could not price", !getIntakeFields("drywall").some((f) => f.key === "complexityLevel"));
ok("a blank or junk tier prices as Standard, as every takeoff's does", normaliseDrywallTier("") === "standard" && normaliseDrywallTier("__proto__") === "standard" && normaliseDrywallTier(" high ") === "high");
const APP_KEYS = [
  ...SIX.map((l) => `app.intake.finishLevel.${l}`),
  ...TIERS.map((t) => `app.intake.complexityLevel.${t}`),
  "app.drywallFinish.held",
  "app.drywallFinish.unpriced",
  "app.drywallFinish.ownPricing",
  "app.templateLines.calc_drywallBook",
];
for (const lang of Object.keys(APP_MESSAGES)) {
  for (const key of APP_KEYS) {
    const v = APP_MESSAGES[lang][key];
    ok(`app catalogue ${lang}: ${key} present`, typeof v === "string" && v.trim().length > 0, v);
    if (lang !== "en") ok(`app catalogue ${lang}: ${key} translated, not the English`, v !== APP_MESSAGES.en[key], v);
  }
  // The number survives translation: a Level 5 line that said 4 is the worst
  // possible typo on a drywall quote.
  for (const l of SIX) {
    const v = APP_MESSAGES[lang][`app.intake.finishLevel.${l}`] || "";
    ok(`app catalogue ${lang}: ${l} names its own number first`, (v.match(/\d/) || [])[0] === l.slice(-1), v);
  }
}
ok("the English catalogue is the definitions' own wording", SIX.every((l) => APP_MESSAGES.en[`app.intake.finishLevel.${l}`] === FINISH_LEVEL_LABELS[l]) && TIERS.every((t) => APP_MESSAGES.en[`app.intake.complexityLevel.${t}`] === DRYWALL_TIER_LABELS[t]));

/* ══ B. The old stored values still read ═══════════════════════════════ */
section("B. Legacy values map");

ok("level_2_unfinished → level_2", normaliseFinishLevel("level_2_unfinished") === "level_2");
ok("level_4_standard → level_4", normaliseFinishLevel("level_4_standard") === "level_4");
ok("level_5_premium → level_5", normaliseFinishLevel("level_5_premium") === "level_5");
ok("every new value reads as itself", SIX.every((l) => normaliseFinishLevel(l) === l));
ok("padding is tolerated", normaliseFinishLevel("  level_3 ") === "level_3");
const junk = [null, undefined, "", "level_6", "Level 4", 4, "4", "__proto__", "constructor", "toString", {}, [], "level_4_standard_x"];
ok("junk, numbers and prototype keys are not a level", junk.every((v) => normaliseFinishLevel(v) === null), junk.map((v) => normaliseFinishLevel(v)));
const f0 = finishField("drywall_install");
ok("the select SHOWS an old value as the level it meant", shownSelectValue(f0, "level_4_standard") === "level_4" && shownSelectValue(f0, "level_5_premium") === "level_5" && shownSelectValue(f0, "level_2_unfinished") === "level_2");
ok("…a current value as itself", SIX.every((l) => shownSelectValue(f0, l) === l));
ok("…and an unknown value unchanged, never invented", shownSelectValue(f0, "mystery") === "mystery" && shownSelectValue(f0, "") === "" && shownSelectValue(f0, undefined) === undefined);
ok("a select with no legacy map is untouched", shownSelectValue(getIntakeFields("tiling").find((f) => f.key === "material"), "level_4_standard") === "level_4_standard");
ok("the DOCUMENT reads only new values (old ones keep their old wording)", documentFinishLevel("drywall", { finishLevel: "level_5_premium" }) === null && documentFinishLevel("drywall", { finishLevel: "level_5" }) === "level_5");
ok("…and only on the drywall quote types", documentFinishLevel("general_contracting", { finishLevel: "level_5" }) === null && documentFinishLevel("interior_painting", { finishLevel: "level_4" }) === null);

/* ══ C. The book is live ═══════════════════════════════════════════════ */
section("C. drywall_install's price book is live, and every rate on its card is read");

const STAGED = INTERIOR_PRICE_BOOKS.drywall_install;
ok("registered BY REFERENCE to the staged book — one home for the numbers", TRADE_PRICE_BOOKS.drywall_install === STAGED);
ok("hasPriceBook / tradeIsPricedByDefault: priced", hasPriceBook("drywall_install") && tradeIsPricedByDefault("drywall_install"));
// Two of the six since later on 2026-10-03: plain `drywall`'s REPAIR book went
// live too (fixed-price patches and sheets, lib/quotes/drywallRepairs.js). It
// bills no board — no hang row, no finishing row — so nothing in this file's
// finish-line machinery fires on a drywall group (bookBillsBoard).
ok("two of interior.js's six are live: drywall (repairs) and drywall_install", Object.keys(INTERIOR_PRICE_BOOKS).filter((k) => hasPriceBook(k)).sort().join() === "drywall,drywall_install");
ok("plain `drywall`'s book is the repair book, registered by reference", TRADE_PRICE_BOOKS.drywall === INTERIOR_PRICE_BOOKS.drywall);
ok("…and it bills no board, so no hang or finishing line is ever written from it", !bookBillsBoard(TRADE_PRICE_BOOKS.drywall) && bookBillsBoard(STAGED));
// The rates per tier, pinned, so a change to them is a decision with a diff.
const EXPECT = {
  standard: [1.2, 0.45, 0.75, 1.1, 1.45, 2.2],
  moderate: [1.55, 0.55, 0.95, 1.4, 1.85, 2.8],
  high: [2.05, 0.7, 1.2, 1.8, 2.45, 3.7],
};
for (const t of TIERS) {
  const g = getPriceBook("drywall_install").complexity[t];
  const got = [g.hangPricePerSqft, ...[1, 2, 3, 4, 5].map((n) => g[`finishLevel${n}PricePerSqft`])];
  ok(`${t}: hang, L1 … L5 = ${EXPECT[t].join(" / ")} $/sqft`, JSON.stringify(got) === JSON.stringify(EXPECT[t]), got);
  ok(`${t}: each level costs more than the one below`, got.slice(1).every((v, i, a) => i === 0 || v > a[i - 1]));
}
const FIELDS = PRICE_BOOK_FIELDS.drywall_install || [];
const KEYS = ["hangPricePerSqft", ...[1, 2, 3, 4, 5].map((n) => `finishLevel${n}PricePerSqft`)];
ok("the rate card: 18 rows = 3 tiers × (hang + Levels 1–5)", FIELDS.length === 18 && TIERS.every((t) => KEYS.every((k) => FIELDS.some((f) => f.path === `complexity.${t}.${k}` && f.level === t))), FIELDS.map((f) => f.path));
ok("…no Level 0 row — Level 0 is the hang row with no finishing", !FIELDS.some((f) => /finishLevel0/.test(f.path)));
ok("…every row is $ / sqft and resolves to a real number", FIELDS.every((f) => f.suffix === "$ / sqft" && Number(readField(getPriceBook("drywall_install"), f.path)) > 0));
ok("…the staged rows nothing reads (ceiling surcharge, corner bead, extras) are NOT on the card", !FIELDS.some((f) => /ceilingUpcharge|cornerBead|extras\./.test(f.path)));
ok("Settings > Services states the basis: per sq ft", priceBookBasis("drywall_install").some((b) => b.unit === "sqft"));
{
  // The save path keeps every row on the card, and only those.
  const patch = { complexity: { high: { finishLevel5PricePerSqft: 4.1, ceilingUpchargePerSqft: 9 } }, extras: { debrisRemovalPrice: 1 } };
  const kept = sanitiseRates("drywall_install", patch);
  ok("sanitiseRates keeps a card row and drops rows the card does not show", kept?.complexity?.high?.finishLevel5PricePerSqft === 4.1 && kept?.complexity?.high?.ceilingUpchargePerSqft === undefined && kept?.extras === undefined, kept);
}
// Every row on the card is READ: override exactly that path and find the
// override on a line. A card row no line moves would be a dead control.
for (const f of FIELDS) {
  const [, tier, key] = f.path.split(".");
  const override = { complexity: { [tier]: { [key]: 9.87 } } };
  const book = getPriceBook("drywall_install", override);
  const level = key === "hangPricePerSqft" ? "level_4" : `level_${key.match(/\d/)[0]}`;
  const r = syncFinishLine(
    { tempId: "x", categoryKey: "drywall_install", intakeValues: { finishLevel: level, complexityLevel: tier, squareFootage: 10 }, lineItems: [] },
    { book, mode: "create" },
  );
  ok(`${f.path}: a company's own rate reaches the quote`, r.lineItems.some((l) => l.rate === 9.87 && l.amount === 98.7), r.lineItems.map((l) => l.rate));
}

/* ══ D. The lines ═══════════════════════════════════════════════════════ */
section("D. Each level × tier bills exactly its lines");

const dwGroup = (intake, lineItems = [], extra = {}) => ({
  tempId: "g",
  persisted: false,
  categoryKey: "drywall_install",
  categoryId: "cat_dw",
  intakeValues: intake,
  lineItems,
  ...extra,
});
const COMPANY = { complexity: { standard: { finishLevel5PricePerSqft: 2.95 } } };
const book = getPriceBook("drywall_install", COMPANY);
ok("a company override merges over the code default", book.complexity.standard.finishLevel5PricePerSqft === 2.95 && book.complexity.standard.finishLevel4PricePerSqft === 1.45);

for (const t of TIERS) {
  for (const l of SIX) {
    const r = syncFinishLine(dwGroup({ finishLevel: l, complexityLevel: t, squareFootage: 1000 }), { book, mode: "create" });
    const hang = r.lineItems.filter((x) => drywallPartOf(x) === "hang");
    const fin = r.lineItems.filter(isFinishLine);
    const hr = book.complexity[t].hangPricePerSqft;
    ok(`${t} ${l}: one hang line at ${hr}/sqft × 1000`, hang.length === 1 && hang[0].rate === hr && hang[0].amount === r2(1000 * hr) && hangRate(book, t) === hr, hang);
    if (l === "level_0") {
      ok(`${t} level_0: hang only — no finishing line`, fin.length === 0 && r.lineItems.length === 1 && !r.unpriced);
      continue;
    }
    const n = l.slice(-1);
    const expected = book.complexity[t][`finishLevel${n}PricePerSqft`];
    ok(`${t} ${l}: exactly one finishing line, row finish_l${n}, at ${expected}/sqft`, fin.length === 1 && fin[0].meta.drywallFinish.itemId === `finish_l${n}` && FINISH_LINE_IDS[l] === `finish_l${n}` && fin[0].rate === expected && finishLevelRate(book, l, t) === expected, fin.map((x) => x.rate));
    ok(`${t} ${l}: amount = 1000 × rate, the line names the level`, fin[0].amount === r2(1000 * expected) && fin[0].description.includes(`Level ${n}`) && fin[0].unit === "sqft");
    ok(`${t} ${l}: hang first, finishing straight after`, drywallPartOf(r.lineItems[0]) === "hang" && drywallPartOf(r.lineItems[1]) === "finish");
    ok(`${t} ${l}: the group total is hang + finishing, once each`, groupSubtotal({ ...dwGroup({}), lineItems: r.lineItems }) === r2(1000 * hr) + r2(1000 * expected));
  }
}
{
  const typed = { description: "Corner bead", quantity: 40, unit: "linear ft", rate: 4, amount: 160 };
  const start = [...syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1000 }), { book, mode: "create" }).lineItems, typed];
  let prev = start;
  for (const l of ["level_5", "level_1", "level_3", "level_2", "level_4"]) {
    const r = syncFinishLine(dwGroup({ finishLevel: l, squareFootage: 1000 }, prev), { book, mode: "level" });
    const fin = r.lineItems.filter(isFinishLine);
    ok(`→ ${l}: still one finishing line, now ${l}, in the same place`, fin.length === 1 && fin[0].meta.drywallFinish.level === l && r.lineItems.indexOf(fin[0]) === prev.findIndex(isFinishLine));
    ok(`→ ${l}: the hang line is the same object and the typed line untouched`, r.lineItems[0] === prev[0] && r.lineItems.includes(typed) && r.lineItems.length === 3);
    prev = r.lineItems;
  }
  const to0 = syncFinishLine(dwGroup({ finishLevel: "level_0", squareFootage: 1000 }, prev), { book, mode: "level" });
  ok("→ Level 0 removes the finishing line and only it", to0.lineItems.length === 2 && !to0.lineItems.some(isFinishLine) && to0.lineItems.includes(typed));
  const back = syncFinishLine(dwGroup({ finishLevel: "level_5", squareFootage: 1000 }, to0.lineItems), { book, mode: "level" });
  ok("Level 0 → Level 5 adds the finishing line back, after the hang", back.lineItems.filter(isFinishLine).length === 1 && drywallPartOf(back.lineItems[1]) === "finish");
  const cleared = syncFinishLine(dwGroup({ finishLevel: "", squareFootage: 1000 }, prev), { book, mode: "level" });
  ok("clearing the select removes the finishing line, keeps the hang", !cleared.lineItems.some(isFinishLine) && cleared.lineItems.some((x) => drywallPartOf(x) === "hang"));
  // The modes.
  const noHang = prev.filter((x) => drywallPartOf(x) !== "hang");
  const lvl = syncFinishLine(dwGroup({ finishLevel: "level_2", squareFootage: 1000 }, noHang), { book, mode: "level" });
  ok("a level change does NOT bring back a hang line the estimator deleted", !lvl.lineItems.some((x) => drywallPartOf(x) === "hang"));
  const noFin = prev.filter((x) => !isFinishLine(x));
  const rs = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 2000 }, noFin), { book, mode: "resize" });
  ok("a new square footage does NOT bring back a deleted finishing line", !rs.lineItems.some(isFinishLine) && rs.lineItems.find((x) => drywallPartOf(x) === "hang").quantity === 2000);
  const resized = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1250 }, prev), { book, mode: "resize" });
  ok("a new square footage re-sizes both untouched lines in place", resized.lineItems.filter(isDrywallLine).every((x) => x.quantity === 1250) && resized.lineItems.length === 3);
  const retiered = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1000, complexityLevel: "high" }, prev), { book, mode: "resize" });
  ok("a new tier re-prices both lines from that tier's column", retiered.lineItems[0].rate === 2.05 && retiered.lineItems.find(isFinishLine).rate === 2.45);
}
{
  // Square feet: typed wins; else the room measure's board area.
  const takeoff = { ...newRoomMeasure("drywall_install"), rooms: [{ ...newMeasureRoom("drywall_install"), lengthFt: 12, widthFt: 10, heightFt: 8, openings: [{ kind: "door", count: 1, widthFt: 3, heightFt: 7 }] }] };
  ok("no typed square footage: the room measure's board (451 sq ft)", drywallQuantity(dwGroup({}, [], { takeoff })) === 451);
  ok("typed square footage wins over the measure", drywallQuantity(dwGroup({ squareFootage: 500 }, [], { takeoff })) === 500);
  ok("neither: 0, never an invented area", drywallQuantity(dwGroup({})) === 0);
  const measured = syncFinishLine(dwGroup({ finishLevel: "level_4" }, [], { takeoff }), { book, mode: "create" });
  ok("…and the lines bill the measured board", measured.lineItems.every((x) => x.quantity === 451));
  const legacy = syncFinishLine(dwGroup({ finishLevel: "level_5_premium", squareFootage: 100 }), { book, mode: "create" });
  ok("an old stored value prices as the level it meant", legacy.line?.meta?.drywallFinish?.level === "level_5" && legacy.line?.rate === 2.95);
  const hostile = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: "1e308x" }), { book, mode: "create" });
  ok("hostile square footage is 0, not NaN", hostile.lineItems.every((x) => x.quantity === 0 && x.amount === 0));
  ok("negative square footage is 0", syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: -50 }), { book, mode: "create" }).lineItems.every((x) => x.quantity === 0));
  const fr = syncFinishLine(dwGroup({ finishLevel: "level_3", squareFootage: 10 }), { book, language: "fr", mode: "create" });
  ok("the lines are written in the DOCUMENT's language", fr.lineItems[0].description.startsWith("Panneaux de gypse") && fr.line?.description.startsWith("Finition du gypse") && fr.line?.detail === drywallFinishText("level_3", "fr").description);
  ok("a saved group is never synced", syncFinishLine({ ...dwGroup({ finishLevel: "level_5" }), persisted: true }, { book, mode: "create" }).lineItems.length === 0);
  ok("another trade is never synced", syncFinishLine({ ...dwGroup({ finishLevel: "level_5" }), categoryKey: "tiling" }, { book, mode: "create" }).lineItems.length === 0);
  const zeroed = getPriceBook("drywall_install", { complexity: { standard: { finishLevel2PricePerSqft: 0 } } });
  const z = syncFinishLine(dwGroup({ finishLevel: "level_2", squareFootage: 100 }), { book: zeroed, mode: "create" });
  ok("a level the company zeroed adds no $0 line, and says so", z.line === null && z.unpriced === true && z.lineItems.length === 1);
  const plain = syncFinishLine({ ...dwGroup({ finishLevel: "level_5", squareFootage: 100 }), categoryKey: "drywall" }, { book: getPriceBook("drywall"), mode: "create" });
  ok("plain drywall (no book): no lines, and the builder says no rate is set", plain.lineItems.length === 0 && plain.unpriced === true);
  const saved = scopeGroupPayload({ ...dwGroup({}), label: "Drywall", lineItems: syncFinishLine(dwGroup({ finishLevel: "level_5", squareFootage: 300 }), { book, mode: "create" }).lineItems });
  ok("the save stores both lines with their rates and amounts", saved.lineItems.length === 2 && saved.lineItems[0].amount === 360 && saved.lineItems[1].amount === 885, saved.lineItems.map((x) => x.amount));
}

/* ══ E. Hand edits ══════════════════════════════════════════════════════ */
section("E. A line the contractor edited is the contractor's");
{
  const start = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1000 }), { book, mode: "create" }).lineItems;
  for (const part of ["finish", "hang"]) {
    const idx = start.findIndex((x) => drywallPartOf(x) === part);
    for (const [field, value] of [["rate", 1.6], ["quantity", 900], ["description", "My own wording"]]) {
      const edited = start.map((li, i) => (i === idx ? applyLineItemEdit(li, field, value) : li));
      for (const [mode, intake] of [
        ["level", { finishLevel: "level_5", squareFootage: 1000 }],
        ["level", { finishLevel: "level_0", squareFootage: 1000 }],
        ["resize", { finishLevel: "level_4", squareFootage: 2000 }],
        ["resize", { finishLevel: "level_4", squareFootage: 1000, complexityLevel: "high" }],
      ]) {
        const r = syncFinishLine(dwGroup(intake, edited), { book, mode });
        ok(`edited ${part} ${field}, then ${mode} ${JSON.stringify(intake)}: the edited line is kept as typed`, r.lineItems.includes(edited[idx]));
        ok(`…and no second ${part} line beside it`, r.lineItems.filter((x) => drywallPartOf(x) === part).length === 1 && (part === "finish" ? r.held : r.hangHeld) === true);
      }
    }
  }
  const noRecord = start.map((li) => (isFinishLine(li) ? { ...li, meta: { drywallFinish: { level: "level_4" } } } : li));
  ok("a marker with no record of what was written is treated as edited", syncFinishLine(dwGroup({ finishLevel: "level_5", squareFootage: 1000 }, noRecord), { book, mode: "level" }).held);
  ok("a plain line is never ours", !isDrywallLine({ description: "Finish — Level 4 (paint ready)", rate: 1.45 }));
  const qb = code("app/components/quotes/builder/QuoteBuilder.js");
  ok("builder: a level change syncs in `level` mode; size, tier and the room measure in `resize`", /includes\("finishLevel"\)\) return "level"/.test(qb) && /k === "squareFootage" \|\| k === "complexityLevel" \|\| k === "takeoff"\)\) return "resize"/.test(qb));
  ok("builder: intake edits AND the room measure (updatePricing) run withFinishLine", (qb.match(/withFinishLine\(/g) || []).length >= 4);
  ok("builder: a saved group is never synced", /FINISH_LEVEL_TRADES\.includes\(group\.categoryKey\) \|\| group\.persisted\) return group/.test(qb));
  ok("builder: the notice is rendered under the intake", qb.includes("finishLineNotice(group)") && qb.includes("data-drywall-finish-notice"));
}

/* ══ F. Templates — the double-billing fix ═════════════════════════════ */
section("F. The book owns the board; a template cannot bill it twice");
{
  const DW = { id: "cat_dw", key: "drywall_install", label: "Drywall Installation", unit: "flat", defaultRate: null };
  const BOARD = "areaSqFt,wallSqft,ceilingSqft,drywallSheets";
  ok("a drywall_install group holds back every board figure", keysPricedByGroup({ categoryKey: "drywall_install" }).join() === BOARD);
  ok("…except one priced by the company's own single service", keysPricedByGroup({ categoryKey: "drywall_install", ownPricing: true }).length === 0);
  ok("plain drywall (no book) holds nothing back", keysPricedByGroup({ categoryKey: "drywall" }).length === 0);
  const takeoff = { ...newRoomMeasure("drywall_install"), rooms: [{ ...newMeasureRoom("drywall_install"), lengthFt: 12, widthFt: 10, heightFt: 8, openings: [{ kind: "door", count: 1, widthFt: 3, heightFt: 7 }] }] };
  const tpl = { templateLines: [
    { kind: "labour", name: "Tape and finish", qty: 1, unit: "sqft", unitPrice: 1.5, measurementKey: "areaSqFt" },
    { kind: "labour", name: "Walls finished", qty: 1, unit: "sqft", unitPrice: 1.5, measurementKey: "wallSqft" },
    { kind: "material", name: "Board", qty: 1, unit: "each", unitPrice: 18, measurementKey: "drywallSheets" },
    { kind: "other", name: "Disposal", qty: 1, unit: "flat", unitPrice: 150 },
  ] };
  // Order 1 — the service added WITH its template (addScopeGroupWithTemplate).
  const g = { ...newScopeGroup(DW, DW.label, null, { tempId: "t1", fieldDefaults: true }), takeoff, intakeValues: { finishLevel: "level_4", complexityLevel: "standard" } };
  const sized = { ...g, lineItems: syncFinishLine(g, { book: getPriceBook("drywall_install"), mode: "resize" }).lineItems };
  const exp = expandServiceTemplate(tpl, { measurements: measurementsFromGroups([sized], { targetTempId: "t1" }), currency: "USD", runId: "r1", heading: false, pricedKeys: keysPricedByGroup(sized) });
  const lines = [...sized.lineItems.filter(isDrywallLine), ...exp.lines];
  ok("template added with the service: only the flat Disposal lands", exp.lines.length === 1 && exp.lines[0].description.includes("Disposal") && exp.summary.skipped.length === 3, exp.summary.skipped?.map((s) => s.description));
  ok("…the board is billed once: book hang + book Level 4 + disposal", lines.length === 3 && groupSubtotal({ ...sized, lineItems: lines }) === r2(451 * 1.2) + r2(451 * 1.45) + 150, groupSubtotal({ ...sized, lineItems: lines }));
  // Order 2 — a template added INTO a group that already carries the book's
  // lines, then the level changed: still one finishing line, and every
  // template line the same object, untouched.
  const disposal = exp.lines[0];
  const editedTemplate = applyLineItemEdit(disposal, "rate", 175);
  const withTpl = [...sized.lineItems, editedTemplate];
  for (const l of ["level_5", "level_0", "level_3"]) {
    const r = syncFinishLine({ ...sized, lineItems: withTpl, intakeValues: { ...sized.intakeValues, finishLevel: l } }, { book: getPriceBook("drywall_install"), mode: "level" });
    ok(`template in the group, then ${l}: at most one finishing line, the template line untouched (even edited)`, r.lineItems.filter(isFinishLine).length === (l === "level_0" ? 0 : 1) && r.lineItems.includes(editedTemplate));
  }
  // A company's own single service owns its group.
  const own = { ...newScopeGroup(DW, DW.label, null, { tempId: "p1", fieldDefaults: true }), lineItems: [{ description: "Drywall, hung and finished", quantity: 1, unit: "flat", rate: 4200, amount: 4200, productId: "p" }], ownPricing: true };
  for (const [mode, intake] of [["level", { finishLevel: "level_5", squareFootage: 1000 }], ["resize", { finishLevel: "level_5", squareFootage: 1500 }]]) {
    const r = syncFinishLine({ ...own, intakeValues: intake }, { book: getPriceBook("drywall_install"), mode });
    ok(`own service, ${mode}: the level adds no line — the service is the price`, r.lineItems.length === 1 && r.lineItems[0] === own.lineItems[0]);
  }
  const ownTpl = expandServiceTemplate(tpl, { measurements: measurementsFromGroups([{ ...own, takeoff }], { targetTempId: "p1" }), currency: "USD", runId: "r2", heading: false, pricedKeys: keysPricedByGroup(own) });
  ok("…and a template added to it keeps every line (nothing of ours to protect)", ownTpl.lines.length === 4);
  const qb = code("app/components/quotes/builder/QuoteBuilder.js");
  ok("builder: the template add keeps the book's lines and passes the held-back keys", /lineItems\.filter\(isDrywallLine\)/.test(qb) && /lineItems: \[\.\.\.book, \.\.\.lines\]/.test(qb));
  ok("builder: the one-line add marks the group ownPricing", /ownPricing: true/.test(qb));
  ok("builder: the held-back note names the drywall price book", /"drywallBook"/.test(qb));
}

/* ══ G. The document names the chosen level, in every language ═════════ */
section("G. Document text");

const cats = presetCatalogues();
ok("eight document languages carry a finish catalogue", LANGUAGE_CODES.every((l) => cats[l]?.drywallFinish?.levels) && Object.keys(cats).length === 8, Object.keys(cats));
const ENGLISH = /\b(the|and|with|your|we|is|are|of)\b/i;
const SCRIPT = { uk: /[Ѐ-ӿ]/, pa: /[਀-੿]/ };
for (const lang of LANGUAGE_CODES) {
  const c = cats[lang].drywallFinish;
  for (const k of ["lineTitle", "hangTitle", "hung", "cleaned"]) {
    ok(`${lang}: ${k} present`, typeof c[k] === "string" && c[k].trim().length > 0);
    if (lang !== "en") ok(`${lang}: ${k} translated`, c[k] !== cats.en.drywallFinish[k] && !ENGLISH.test(c[k]), c[k]);
  }
  ok(`${lang}: exactly the six levels`, JSON.stringify(Object.keys(c.levels)) === JSON.stringify(SIX), Object.keys(c.levels));
  // The finish step is the LAST step of the drywall trades in this language —
  // the one finishSteps() rewrites. It must be the one that mentions 4 and 5.
  const plainDoc = resolveServiceContent("drywall_install", null, null, lang);
  const lastBody = plainDoc.steps.at(-1)?.body || "";
  ok(`${lang}: the drywall trades' last step is the finish step (mentions 4 and 5)`, /4/.test(lastBody) && /5/.test(lastBody), lastBody.slice(0, 80));
  // drywall_install has had a trade paragraph since its book went live (a
  // priced trade states its scope — check:trade-labour); plain drywall has none.
  ok(`${lang}: drywall_install's trade paragraph names no level of its own`, plainDoc.description.length > 60 && !/\d/.test(plainDoc.description), plainDoc.description.slice(0, 60));
  for (const l of SIX) {
    const n = l.slice(-1);
    const words = drywallFinishText(l, lang);
    ok(`${lang} ${l}: name and description present`, words && words.name && words.description);
    ok(`${lang} ${l}: both name the level's own number`, words.name.includes(n) && words.description.includes(n) && (words.description.match(/\d/) || [])[0] === n, words.description.slice(0, 60));
    if (lang !== "en") {
      ok(`${lang} ${l}: translated, no English words left`, words.description !== drywallFinishText(l, "en").description && !ENGLISH.test(words.description) && !ENGLISH.test(words.name), words.description.slice(0, 80));
    }
    if (SCRIPT[lang]) ok(`${lang} ${l}: written in its own script`, SCRIPT[lang].test(words.description));
    for (const trade of TRADES) {
      const base = resolveServiceContent(trade, null, null, lang);
      const doc = resolveServiceContent(trade, null, null, lang, { finishLevel: l });
      const expected = [base.description, words.description].filter(Boolean).join(" ");
      ok(`${lang} ${trade} ${l}: the scope paragraph states the level (after the trade's own)`, doc.description === expected, doc.description.slice(0, 80));
      ok(`${lang} ${trade} ${l}: the Drywall step states it too`, doc.steps.at(-1).body.includes(words.description) && doc.steps.at(-1).title === base.steps.at(-1).title && doc.steps.at(-1).timeline === base.steps.at(-1).timeline);
      ok(`${lang} ${trade} ${l}: every other step unchanged`, JSON.stringify(doc.steps.slice(0, -1)) === JSON.stringify(base.steps.slice(0, -1)));
      ok(`${lang} ${trade} ${l}: the quote's steps (dominant group) state it`, dominantProcessSteps([{ categoryKey: trade, subtotal: 10, intake: { finishLevel: l } }], lang).at(-1).body === doc.steps.at(-1).body);
    }
  }
  // No answer, an old answer, junk: the document is exactly what no answer
  // prints — the old step wording, word for word.
  for (const trade of TRADES) {
    const none = JSON.stringify(resolveServiceContent(trade, null, null, lang));
    for (const intake of [undefined, null, {}, { finishLevel: "level_4_standard" }, { finishLevel: "level_5_premium" }, { finishLevel: "level_2_unfinished" }, { finishLevel: "level_9" }, { finishLevel: 5 }, "level_5"]) {
      ok(`${lang} ${trade}: intake ${JSON.stringify(intake)} prints exactly what no answer prints`, JSON.stringify(resolveServiceContent(trade, null, null, lang, intake)) === none);
    }
  }
  ok(`${lang}: a general contractor's shell sequence is not touched by a level`, JSON.stringify(resolveServiceContent("general_contracting", null, null, lang, { finishLevel: "level_5" })) === JSON.stringify(resolveServiceContent("general_contracting", null, null, lang)));
}
ok("the shared SHELL_SEQUENCE is not mutated by a level (copy, not edit)", resolveServiceContent("drywall", null, null, "en").steps.at(-1).body.includes("Level 4, or Level 5 where specified"));
// Plain drywall has a scope paragraph since its repair book went live
// (2026-10-03), dated like drywall_install's: a document from before it
// prints none, as it always did.
const DW_PARA = resolveServiceContent("drywall", null, null, "en").description;
ok("plain drywall prints its own scope paragraph without a level", DW_PARA.startsWith("We do the drywall work priced above"));
ok("...but a drywall document written before it prints none, as it did", resolveServiceContent("drywall", null, null, "en", undefined, "2026-10-01T12:00:00Z").description === "");
{
  const own = resolveServiceContent("drywall_install", { scopeDescription: "We hang and finish board.", processSteps: [{ title: "Ours", body: "Our step." }] }, null, "en", { finishLevel: "level_5" });
  ok("a company's own paragraph still prints, with the level stated after it", own.description === `We hang and finish board. ${drywallFinishText("level_5", "en").description}`);
  ok("a company's own steps are theirs — not rewritten", own.steps.length === 1 && own.steps[0].body === "Our step.");
  const en5 = resolveServiceContent("drywall", null, null, "en", { finishLevel: "level_5" });
  ok("the owner's example sentence, in our words — after the trade's own paragraph", en5.description === `${DW_PARA} ${drywallFinishText("level_5", "en").description}` && en5.description.includes("Finished to Level 5: Level 4 plus a full skim coat"), en5.description);
}
for (const [file, needles] of [
  ["app/api/quotes/[id]/document/route.js", ["intakeValues: true", "g.intakeValues,", "intake: g.intakeValues"]],
  ["app/api/invoices/[id]/document/route.js", ["intakeValues: true", "g.intakeValues,", "intake: g.intakeValues"]],
  ["app/api/public/quotes/[token]/route.js", ["g.intakeValues,", "intake: g.intakeValues"]],
  ["lib/quotes/scopeGroupDisplay.js", ["intake: g.intakeValues"]],
  ["lib/documentSections/ScopeGroupsSection.js", ["g.intake,"]],
  ["lib/email/quoteSections.js", ["g.intake,"]],
  ["lib/documentSections/ProcessStepsSection.js", ["intake: g.intakeValues"]],
  ["lib/email/quoteEmail.js", ["intake: g.intakeValues"]],
  ["app/components/quotes/builder/ScopeGroupCard.js", ["group.intakeValues"]],
]) {
  const s = code(file);
  ok(`${file}: passes the group's intake to the resolver`, needles.every((n) => s.includes(n)), needles.filter((n) => !s.includes(n)));
}
ok("public quote route: intakeValues is never a returned key", !/\bintakeValues\s*:/.test(code("app/api/public/quotes/[token]/route.js")));

/* ══ G2. The trade paragraph: new documents only ════════════════════════ */
section("G2. drywall_install's paragraph prints on documents created after it, never on older ones");
{
  // A real "before": the catalogues with drywall_install's paragraph removed
  // for the length of one render — exactly what the product printed before the
  // paragraph existed — compared through the real renderers, not a model of
  // them. Restored immediately after.
  const ENTRIES = LANGUAGE_CODES.map((l) => cats[l].content.drywall_install);
  const renderAll = (lang, intake, createdAt) => {
    const group = { label: "Drywall", subtotal: 1200, category: { key: "drywall_install", label: "Drywall" }, intakeValues: intake, lineItems: [{ description: "Board", quantity: 1, amount: 1200 }] };
    const data = { scopeGroups: [group], ...(createdAt !== undefined ? { createdAt } : {}) };
    return JSON.stringify({
      content: resolveServiceContent("drywall_install", null, null, lang, intake, createdAt),
      html: scopeBreakdownHtml({ data, company: {}, language: lang }),
      text: quoteSectionsText({ data, company: {}, language: lang }),
    });
  };
  const before = (lang, intake) => {
    const saved = ENTRIES.map((e) => e.description);
    ENTRIES.forEach((e) => { delete e.description; });
    try {
      return renderAll(lang, intake, undefined);
    } finally {
      ENTRIES.forEach((e, i) => { e.description = saved[i]; });
    }
  };
  const OLD = ["2026-09-15T12:00:00.000Z", new Date("2026-10-03T23:59:59.999Z"), "2025-01-01"];
  const NEW = ["2026-10-04T00:00:00.000Z", new Date("2026-11-02T09:30:00Z")];
  ok("the cut-over is the start of the day after the change", DRYWALL_INSTALL_PARAGRAPH_SINCE === "2026-10-04T00:00:00.000Z");
  for (const lang of LANGUAGE_CODES) {
    for (const intake of [null, {}, { finishLevel: "level_4_standard" }, { finishLevel: "level_5_premium", squareFootage: 800 }]) {
      const was = before(lang, intake);
      for (const at of OLD) {
        ok(`${lang} ${JSON.stringify(intake)} created ${String(at instanceof Date ? at.toISOString() : at)}: content, email HTML and email text byte-identical to before`, renderAll(lang, intake, at) === was);
      }
      ok(`${lang} ${JSON.stringify(intake)}: the comparison is not vacuous — a new document differs from "before"`, renderAll(lang, intake, NEW[0]) !== was);
      for (const at of NEW) {
        const doc = resolveServiceContent("drywall_install", null, null, lang, intake, at);
        ok(`${lang} ${JSON.stringify(intake)} created after: the paragraph prints`, doc.description === cats[lang].content.drywall_install.description && renderAll(lang, intake, at).includes(JSON.stringify(doc.description).slice(1, 40)));
      }
    }
    ok(`${lang}: the paragraph really was restored after each "before"`, typeof cats[lang].content.drywall_install.description === "string" && cats[lang].content.drywall_install.description.length > 60);
    // A quote written on the day itself with a NEW level: the level sentence,
    // no paragraph.
    const day = resolveServiceContent("drywall_install", null, null, lang, { finishLevel: "level_5" }, "2026-10-03T15:00:00Z");
    ok(`${lang}: written on the cut-over day with a level — the level sentence alone`, day.description === drywallFinishText("level_5", lang).description);
  }
  ok("1 ms before the cut-over: withheld; at it: printed", resolveServiceContent("drywall_install", null, null, "en", null, "2026-10-03T23:59:59.999Z").description === "" && resolveServiceContent("drywall_install", null, null, "en", null, "2026-10-04T00:00:00.000Z").description.length > 60);
  ok("no date, or an unreadable one: treated as a new document", ["", null, undefined, "not a date", NaN].every((d) => resolveServiceContent("drywall_install", null, null, "en", null, d).description.length > 60));
  ok("a company's own paragraph is never withdrawn by the cut-over", resolveServiceContent("drywall_install", { scopeDescription: "Our words." }, null, "en", null, "2026-01-01").description === "Our words.");
  ok("no other trade is dated: an old roofing quote prints what a new one does", resolveServiceContent("roofing_service", null, null, "en", null, "2020-01-01").description === resolveServiceContent("roofing_service", null, null, "en").description);
  // Every surface that renders an EXISTING document passes its age.
  for (const [file, needles] of [
    ["app/api/quotes/[id]/document/route.js", ["createdAt: true", "quote.createdAt,"]],
    ["app/api/invoices/[id]/document/route.js", ["createdAt: true", "invoice.quote?.createdAt,"]],
    ["app/api/public/quotes/[token]/route.js", ["quote.createdAt,"]],
    ["lib/documentSections/ScopeGroupsSection.js", ["data?.createdAt,"]],
    ["lib/email/quoteSections.js", ["data?.createdAt,"]],
    ["lib/email/quoteEmail.js", ["createdAt: quote.createdAt"]],
    ["lib/ai/quoteReview.js", ["quote.createdAt)"]],
    ["lib/quotes/completeness.js", ["quote?.createdAt)", "quote.createdAt)"]],
    ["app/components/quotes/builder/ScopeGroupCard.js", ["documentCreatedAt)"]],
    ["app/components/quotes/builder/QuoteBuilder.js", ["createdAt: quote.createdAt || null", "documentCreatedAt={start.createdAt || null}"]],
  ]) {
    const s = code(file);
    ok(`${file}: passes the document's createdAt`, needles.every((n) => s.includes(n)), needles.filter((n) => !s.includes(n)));
  }
}

/* ══ H. The public intake carries no prices ════════════════════════════ */
section("H. Public self-quote field");

const PUBLIC_KEYS = new Set(["key", "label", "type", "options", "unit", "placeholder", "help"]);
for (const k of TRADES) {
  const pub = publicIntakeFields(k);
  const f = pub.find((x) => x.key === "finishLevel");
  ok(`${k}: the public form still asks the finish level`, Boolean(f));
  ok(`${k}: …with the six level strings and nothing priced`, JSON.stringify(f?.options) === JSON.stringify(SIX) && f.options.every((o) => typeof o === "string"));
  ok(`${k}: only the public keys travel (no labels, legacy map or default)`, pub.every((x) => Object.keys(x).every((p) => PUBLIC_KEYS.has(p))), pub.map((x) => Object.keys(x)));
  ok(`${k}: the tier is never asked of a homeowner`, !pub.some((x) => x.key === "complexityLevel"));
  const text = JSON.stringify(pub);
  ok(`${k}: no rate, price or money anywhere in the public payload`, !/price|rate|\$|amount|cost/i.test(text), text);
  ok(`${k}: the public copy is a copy — mutating it cannot reach the definition`, (() => { f.options.push("x"); return finishField(k).options.length === 6; })());
}
ok("every other category's public fields are unchanged in shape", Object.keys(INTAKE_FIELDS).every((k) => publicIntakeFields(k).every((x) => Object.keys(x).every((p) => PUBLIC_KEYS.has(p)))));
ok("the self-quote routes read the projected helper", code("app/api/self-quote/route.js").includes("publicIntakeFields(") && code("app/api/self-quote/[companySlug]/route.js").includes("publicIntakeFields("));

/* ══ I. New groups ═════════════════════════════════════════════════════ */
section("I. New groups");
{
  const DW = { id: "cat_dw", key: "drywall_install", label: "Drywall Installation", unit: "flat", defaultRate: 999 };
  const tile = newScopeGroup(DW, DW.label, null, { tempId: "a", fieldDefaults: true, language: "es" });
  ok("added from a tile: Level 4, Standard", tile.intakeValues.finishLevel === "level_4" && tile.intakeValues.complexityLevel === "standard");
  ok("…opens on the book's hang + Level 4 lines (0 sq ft until measured), in the document's language — no seeded flat line", tile.lineItems.length === 2 && tile.lineItems.every(isDrywallLine) && tile.lineItems[0].description.startsWith("Paneles de yeso") && tile.lineItems.every((x) => x.quantity === 0));
  ok("…an old single rate on the category never becomes a second price", !tile.lineItems.some((x) => x.rate === 999));
  const call = newScopeGroup(DW, DW.label, null, { tempId: "b", intakeValues: { squareFootage: 400 } });
  ok("a phone call's draft: absent stays absent", !("finishLevel" in call.intakeValues) && !("complexityLevel" in call.intakeValues));
  ok("…but the square feet the caller gave are hung, at Standard, with no finishing line invented", call.lineItems.length === 1 && drywallPartOf(call.lineItems[0]) === "hang" && call.lineItems[0].quantity === 400 && call.lineItems[0].rate === 1.2);
  const said = newScopeGroup(DW, DW.label, null, { tempId: "c", intakeValues: { squareFootage: 400, finishLevel: "level_5" } });
  ok("…and a level the caller named is billed", said.lineItems.filter(isFinishLine).length === 1 && said.lineItems.find(isFinishLine).rate === 2.2);
  ok("an answer the caller gave wins over the default", newScopeGroup(DW, DW.label, null, { tempId: "d", fieldDefaults: true, intakeValues: { finishLevel: "level_2" } }).intakeValues.finishLevel === "level_2");
  ok("…even a blank one", newScopeGroup(DW, DW.label, null, { tempId: "e", fieldDefaults: true, intakeValues: { finishLevel: "" } }).intakeValues.finishLevel === "");
  const plain = newScopeGroup({ id: "cat_d", key: "drywall", label: "Drywall", unit: "flat", defaultRate: null }, "Drywall", null, { tempId: "f", fieldDefaults: true });
  ok("plain drywall (no book): Level 4 by default, its one seeded line as before", plain.intakeValues.finishLevel === "level_4" && plain.lineItems.length === 1 && !isDrywallLine(plain.lineItems[0]));
  ok("a trade with no defaults is byte-identical either way", JSON.stringify(newScopeGroup({ id: "e", key: "electrical", label: "Electrical", unit: "hour", defaultRate: 110 }, "Electrical", null, { tempId: "e", fieldDefaults: true })) === JSON.stringify(newScopeGroup({ id: "e", key: "electrical", label: "Electrical", unit: "hour", defaultRate: 110 }, "Electrical", null, { tempId: "e" })));
  ok("withFieldDefaults never fills a key the caller set", JSON.stringify(withFieldDefaults(getIntakeFields("drywall"), { finishLevel: "level_1" })) === JSON.stringify({ finishLevel: "level_1" }));
  const raw = src("app/components/quotes/builder/QuoteBuilder.js");
  const at = raw.indexOf("Only what the caller actually said");
  const fromCall = at >= 0 ? raw.slice(Math.max(0, at - 400), at + 1600) : "";
  ok("builder: the phone-call prefill does not ask for defaults, and names the language", fromCall.includes("newScopeGroup(") && !fromCall.includes("fieldDefaults") && fromCall.includes("language: bootstrap.companyLanguage"));
  ok("builder: a tile add asks for defaults", /function addScopeGroup\(category, label(, addOns = \[\])?(, route = null)?\)[\s\S]{0,500}fieldDefaults: true/.test(code("app/components/quotes/builder/QuoteBuilder.js")));
}

/* ══ J. Materials ══════════════════════════════════════════════════════ */
section("J. Materials");

// No drywall recipe is live. The staged one in app/data/priceBooks/interior.js
// carries two-currency costs that nothing reads yet (that file's "Wiring" §1)
// and records Level 4 compound coverage only (475 sq ft of board a box; "Level
// 5 roughly doubles it"). So there is nothing for the level to scale. This
// fails the day a drywall recipe lands, so whoever lands it makes compound
// follow the level instead of costing every job at Level 4.
ok("no live drywall material recipe yet — compound scaling is owed when one lands", !Object.hasOwn(MATERIAL_RECIPES, "drywall_install") && !Object.hasOwn(MATERIAL_RECIPES, "drywall"));
{
  const compound = INTERIOR_RECIPES.drywall_install?.materials?.compound_allpurpose;
  ok("…the staged recipe's costs are two-currency objects, which no costing reader takes yet", compound && typeof compound.cost?.cad === "object" && typeof compound.cost?.usd === "object");
  ok("…and it states Level 4 coverage only — no per-level figure to scale by", INTERIOR_RECIPES.drywall_install?.consumption?.compoundSqftOfBoardPerBoxLevel4 === 475 && !Object.keys(INTERIOR_RECIPES.drywall_install?.consumption || {}).some((k) => /Level5/.test(k)));
}

/* ══ K. The repair intake asks no room (owner, 2026-10-03) ═════════════ */
section("K. Drywall repairs: no square footage, no ceiling height");
{
  const keys = (k) => getIntakeFields(k).map((f) => f.key);
  ok("plain drywall (repairs) no longer asks Square Footage", !keys("drywall").includes("squareFootage"), keys("drywall"));
  ok("…nor Ceiling Height", !keys("drywall").includes("ceilingHeight"), keys("drywall"));
  ok("…and still asks the finish level and demo", keys("drywall").includes("finishLevel") && keys("drywall").includes("demoExisting"));
  ok("drywall_install keeps Square Footage — it is the hang and finishing quantity", keys("drywall_install").includes("squareFootage"));
  ok("interior painting keeps its ceiling height (untouched)", keys("interior_painting").includes("ceilingHeight"));
  ok("the public form for drywall shows the finish level only", JSON.stringify(publicIntakeFields("drywall").map((f) => f.key)) === JSON.stringify(["finishLevel"]), publicIntakeFields("drywall"));

  // Proof the two answers never fed a repair price: the same group with and
  // without them produces identical lines (a new group and a resize sync).
  // The full payload, repair items included, was also md5-compared against
  // origin/main b75c8639's intake file when this landed: identical.
  const repairBook = getPriceBook("drywall");
  const cat = { id: "c", key: "drywall", label: "Drywall", unit: "sqft", defaultRate: 3.25 };
  const lines = (iv) => {
    const g = newScopeGroup(cat, "Drywall", null, { tempId: "t", fieldDefaults: true, language: "en", intakeValues: iv });
    return syncFinishLine({ ...g, intakeValues: { ...g.intakeValues, ...iv } }, { book: repairBook, mode: "resize" }).lineItems;
  };
  const bare = JSON.stringify(lines({}));
  for (const iv of [{ squareFootage: 400, ceilingHeight: 9 }, { squareFootage: 1e9, ceilingHeight: -3 }, { squareFootage: "x", ceilingHeight: null }]) {
    ok(`stored ${JSON.stringify(iv)} changes no drywall line`, JSON.stringify(lines(iv)) === bare, lines(iv));
  }
  ok("the repair book bills no board, so square feet could never write a line", bookBillsBoard(repairBook) === false);
  for (const f of ["lib/costing/estimateJobCost.js", "lib/costing/quoteCosting.js", "lib/services/productionRates.js", "app/data/materialRecipes.js"]) {
    ok(`${f} reads no ceilingHeight`, !/ceilingHeight/.test(code(f)));
  }
}

console.log(`\ncheck-drywall-finish-levels: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error(fails.slice(0, 80).map((f) => `  ✗ ${f}`).join("\n") + (fails.length > 80 ? `\n  … and ${fails.length - 80} more` : ""));
  process.exit(1);
}
