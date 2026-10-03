// scripts/check-drywall-finish-levels.mjs
//
//   npm run check:drywall-finish-levels
//
// The drywall Finish Level select: the six GA-214 levels, what the answer
// does, and what it must never do. Before 2026-10-03 the select offered three
// values (one of them, "level 2 unfinished", wrong), nothing read the answer,
// and every drywall document said "Level 4, or Level 5 where specified"
// whatever was sold — the control that appears to work and doesn't.
//
// What is asserted, section by section:
//
//   A. Six levels offered, on both drywall quote types, each with a plain line
//      in every app catalogue language.
//   B. The three old stored values still read as the levels they meant, and
//      nothing else is read as a level.
//   C. Each level puts exactly its own priced line on the quote (Level 0: none),
//      at the rate the company's own merged book carries, and a change of level
//      swaps that one line in place. Run TWICE: against the live product, where
//      no drywall book exists yet (no line, said so), and against the staged
//      book in app/data/priceBooks/interior.js merged in for the run.
//   D. A finishing line the contractor edited is never replaced or removed.
//   E. The client's document names the chosen level in each of the eight
//      document languages — and a quote holding an old value, or none, prints
//      byte-for-byte what it printed before.
//   F. The public self-quote field carries the question and six strings: no
//      price, no rate, none of the staff-side keys.
//   G. A new group opens on Level 4 only when the estimator added it; a phone
//      call's draft keeps its blanks.
//   H. Materials: a tripwire on the recipe the compound would scale in.
//
// Executed, not matched: the real modules are imported and run; only the
// builder and route wiring (React and Prisma files) are read as text.

import { readFileSync } from "node:fs";
import {
  FINISH_LEVELS,
  FINISH_LEVEL_LABELS,
  LEGACY_FINISH_LEVELS,
  DEFAULT_FINISH_LEVEL,
  normaliseFinishLevel,
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
  finishLevelLine,
  syncFinishLine,
  isFinishLine,
  isUntouchedFinishLine,
} from "@/lib/quotes/drywallFinishLine";
import {
  resolveServiceContent,
  dominantProcessSteps,
  drywallFinishText,
  presetCatalogues,
} from "@/lib/documents/serviceContent";
import { TRADE_PRICE_BOOKS, getPriceBook } from "@/app/data/tradePriceBooks";
import { MATERIAL_RECIPES } from "@/app/data/materialRecipes";
import { INTERIOR_PRICE_BOOKS } from "@/app/data/priceBooks/interior";
import { newScopeGroup, applyLineItemEdit, scopeGroupPayload } from "@/lib/quotes/builderPayload";
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

const TRADES = ["drywall", "drywall_install"];
const SIX = ["level_0", "level_1", "level_2", "level_3", "level_4", "level_5"];
const finishField = (k) => getIntakeFields(k).find((f) => f.key === "finishLevel");

/* ══ A. Six levels offered ══════════════════════════════════════════════ */
section("A. Six levels offered");

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
// The app catalogue: every language carries every level's line and both notes.
const APP_KEYS = [...SIX.map((l) => `app.intake.finishLevel.${l}`), "app.drywallFinish.held", "app.drywallFinish.unpriced"];
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
ok("the English catalogue is the definition's own wording", SIX.every((l) => APP_MESSAGES.en[`app.intake.finishLevel.${l}`] === FINISH_LEVEL_LABELS[l]));

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

/* ══ C. Each level adds exactly its priced line ════════════════════════ */
section("C. Each level drives its line — live product (no drywall book)");

const dwGroup = (intake, lineItems = [{ description: "Drywall Installation", quantity: 1, unit: "flat", rate: 0, amount: 0 }]) => ({
  tempId: "g",
  persisted: false,
  categoryKey: "drywall_install",
  categoryId: "cat_dw",
  intakeValues: intake,
  lineItems,
});

ok("live: drywall_install has no price book today", getPriceBook("drywall_install") === null && getPriceBook("drywall") === null);
for (const l of SIX) {
  const r = syncFinishLine(dwGroup({ finishLevel: l, squareFootage: 1000 }), { book: getPriceBook("drywall_install") });
  ok(`live ${l}: no line is invented without a rate`, r.line === null && r.lineItems.filter(isFinishLine).length === 0 && r.lineItems.length === 1);
  ok(`live ${l}: the builder is told why (${l === "level_0" ? "Level 0 bills nothing" : "unpriced"})`, r.unpriced === (l !== "level_0"));
}
ok("live: no level answered → nothing to say", syncFinishLine(dwGroup({}), { book: null }).unpriced === false);

section("C. Each level drives its line — the staged book, merged for this run");

// Merged exactly as the owner's one-line merge would (check-pricebook-interior
// does the same), and removed again at the end of the section.
TRADE_PRICE_BOOKS.drywall_install = INTERIOR_PRICE_BOOKS.drywall_install;
const COMPANY = { complexity: { standard: { finishLevel5PricePerSqft: 2.95 } } };
const book = getPriceBook("drywall_install", COMPANY);
const grid = book.complexity.standard;
ok("merged: the company's own Level 5 rate is in the book it prices from", grid.finishLevel5PricePerSqft === 2.95 && grid.finishLevel4PricePerSqft === 1.45);

let previous = null;
for (const l of SIX) {
  const g = dwGroup({ finishLevel: l, squareFootage: 1000 });
  const r = syncFinishLine(g, { book, language: "en" });
  const mine = r.lineItems.filter(isFinishLine);
  if (l === "level_0") {
    ok("Level 0 adds NO line — it is hung board", mine.length === 0 && r.line === null && !r.unpriced);
    continue;
  }
  const n = Number(l.slice(-1));
  const item = book.items.find((i) => i.id === `finish_l${n}`);
  const expected = grid[item.priceType];
  ok(`${l}: exactly one finishing line`, mine.length === 1, mine.length);
  ok(`${l}: it is the book's row finish_l${n}`, mine[0]?.meta?.drywallFinish?.itemId === `finish_l${n}` && FINISH_LINE_IDS[l] === `finish_l${n}`);
  ok(`${l}: priced from the merged book exactly as the row is (${expected}/sqft)`, mine[0]?.rate === expected && finishLevelRate(book, l) === expected, mine[0]?.rate);
  ok(`${l}: quantity × rate`, mine[0]?.quantity === 1000 && mine[0]?.amount === Math.round(1000 * expected * 100) / 100, mine[0]);
  ok(`${l}: the line names the level`, mine[0]?.description.includes(`Level ${n}`) && mine[0]?.unit === "sqft", mine[0]?.description);
  ok(`${l}: the seeded line beside it is untouched`, r.lineItems[0].description === "Drywall Installation" && r.lineItems.length === 2);
  if (previous) {
    // A change of level, starting from the previous level's lines.
    const before = syncFinishLine(dwGroup({ finishLevel: previous, squareFootage: 1000 }), { book }).lineItems;
    const typed = { description: "Corner bead", quantity: 40, unit: "linear ft", rate: 4, amount: 160 };
    const withTyped = [...before, typed];
    const swapped = syncFinishLine(dwGroup({ finishLevel: l, squareFootage: 1000 }, withTyped), { book });
    const fin = swapped.lineItems.filter(isFinishLine);
    ok(`${previous} → ${l}: still exactly one finishing line, now ${l}`, fin.length === 1 && fin[0].meta.drywallFinish.level === l);
    ok(`${previous} → ${l}: swapped IN PLACE (same position)`, swapped.lineItems.indexOf(fin[0]) === before.findIndex(isFinishLine));
    ok(`${previous} → ${l}: a typed line is the same object, untouched`, swapped.lineItems.includes(typed) && swapped.lineItems.length === withTyped.length);
  }
  previous = l;
}
{
  const l4 = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1000 }), { book }).lineItems;
  const to0 = syncFinishLine(dwGroup({ finishLevel: "level_0", squareFootage: 1000 }, l4), { book });
  ok("Level 4 → Level 0 removes our line and only our line", to0.lineItems.length === 1 && !to0.lineItems.some(isFinishLine));
  const cleared = syncFinishLine(dwGroup({ finishLevel: "", squareFootage: 1000 }, l4), { book });
  ok("clearing the select removes our line", !cleared.lineItems.some(isFinishLine) && cleared.lineItems.length === 1);
  const resized = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1250 }, l4), { book });
  ok("a new square footage re-sizes our untouched line", resized.lineItems.filter(isFinishLine)[0]?.quantity === 1250 && resized.lineItems.length === 2);
  const legacy = syncFinishLine(dwGroup({ finishLevel: "level_5_premium", squareFootage: 100 }), { book });
  ok("an old stored value prices as the level it meant", legacy.line?.meta?.drywallFinish?.level === "level_5" && legacy.line?.rate === 2.95);
  const blankSqft = syncFinishLine(dwGroup({ finishLevel: "level_4" }), { book });
  ok("no square footage: the line opens at 0 sq ft and $0, never an invented area", blankSqft.line?.quantity === 0 && blankSqft.line?.amount === 0);
  const hostile = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: "1e308x" }), { book });
  ok("hostile square footage is 0, not NaN", hostile.line?.quantity === 0 && Number.isFinite(hostile.line?.amount));
  const neg = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: -50 }), { book });
  ok("negative square footage is 0", neg.line?.quantity === 0);
  const fr = syncFinishLine(dwGroup({ finishLevel: "level_3", squareFootage: 10 }), { book, language: "fr" });
  ok("the line is written in the DOCUMENT's language", fr.line?.description.startsWith("Finition du gypse") && fr.line?.detail === drywallFinishText("level_3", "fr").description);
  ok("a saved group is never synced", syncFinishLine({ ...dwGroup({ finishLevel: "level_5" }), persisted: true }, { book }).lineItems.length === 1);
  ok("another trade is never synced", syncFinishLine({ ...dwGroup({ finishLevel: "level_5" }), categoryKey: "tiling" }, { book }).lineItems.length === 1);
  const zeroed = getPriceBook("drywall_install", { complexity: { standard: { finishLevel2PricePerSqft: 0 } } });
  const z = syncFinishLine(dwGroup({ finishLevel: "level_2", squareFootage: 100 }), { book: zeroed });
  ok("a level the company zeroed adds no $0 line, and says so", z.line === null && z.unpriced === true);
  // The line survives the save path as written: a drywall group is not a
  // takeoff or unit-priced trade, so scopeGroupPayload stores its lines.
  const saved = scopeGroupPayload({ ...dwGroup({ finishLevel: "level_5", squareFootage: 300 }), lineItems: syncFinishLine(dwGroup({ finishLevel: "level_5", squareFootage: 300 }), { book }).lineItems, label: "Drywall" });
  const savedFinish = (saved.lineItems || []).find(isFinishLine);
  ok("the save stores the finishing line with its rate and amount", savedFinish?.rate === 2.95 && savedFinish?.amount === 885, savedFinish);
}

/* ══ D. A hand-edited line is never replaced ═══════════════════════════ */
section("D. A hand-edited finishing line is the contractor's");

{
  const start = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 1000 }), { book }).lineItems;
  const idx = start.findIndex(isFinishLine);
  for (const [field, value] of [["rate", 1.6], ["quantity", 900], ["description", "Taping and finishing, my way"]]) {
    const edited = start.map((li, i) => (i === idx ? applyLineItemEdit(li, field, value) : li));
    ok(`edited ${field}: no longer counts as ours`, !isUntouchedFinishLine(edited[idx]) && isFinishLine(edited[idx]));
    for (const l of SIX) {
      const r = syncFinishLine(dwGroup({ finishLevel: l, squareFootage: 1000 }, edited), { book });
      ok(`edited ${field}, then ${l}: the edited line is kept, byte for byte`, r.lineItems.includes(edited[idx]) && JSON.stringify(r.lineItems) === JSON.stringify(edited));
      ok(`edited ${field}, then ${l}: no second finishing line beside it`, r.lineItems.filter(isFinishLine).length === 1 && r.held === true && r.line === null);
    }
    const resized = syncFinishLine(dwGroup({ finishLevel: "level_4", squareFootage: 2000 }, edited), { book });
    ok(`edited ${field}, then a new square footage: kept as typed`, JSON.stringify(resized.lineItems) === JSON.stringify(edited));
  }
  const noRecord = start.map((li, i) => (i === idx ? { ...li, meta: { drywallFinish: { level: "level_4" } } } : li));
  ok("a marker with no record of what was written is treated as edited", !isUntouchedFinishLine(noRecord[idx]) && syncFinishLine(dwGroup({ finishLevel: "level_5", squareFootage: 1000 }, noRecord), { book }).held);
  ok("a plain line is never ours", !isFinishLine({ description: "Finish — Level 4 (paint ready)", rate: 1.45 }));
  // The builder's own trigger, read as text: a level change syncs; a square
  // footage change syncs ONLY while our untouched line is still there, so a
  // line the estimator deleted is not resurrected by typing a number.
  const qb = code("app/components/quotes/builder/QuoteBuilder.js");
  ok("builder: updateIntakeValue and updateIntakeValues both run withFinishLine", (qb.match(/withFinishLine\(/g) || []).length >= 3);
  ok("builder: square footage re-syncs only with an untouched line present", /changedKeys\.includes\("squareFootage"\)\s*&&\s*\(group\.lineItems \|\| \[\]\)\.some\(isUntouchedFinishLine\)/.test(qb));
  ok("builder: a saved group is never synced", /FINISH_LEVEL_TRADES\.includes\(group\.categoryKey\) \|\| group\.persisted\) return group/.test(qb));
  ok("builder: the notice is rendered under the intake", qb.includes("finishLineNotice(group)") && qb.includes("data-drywall-finish-notice"));
}
delete TRADE_PRICE_BOOKS.drywall_install;
ok("the merged book was removed again — the live map is as it was", getPriceBook("drywall_install") === null);

/* ══ E. The document names the chosen level, in every language ═════════ */
section("E. Document text");

const cats = presetCatalogues();
ok("eight document languages carry a finish catalogue", LANGUAGE_CODES.every((l) => cats[l]?.drywallFinish?.levels) && Object.keys(cats).length === 8, Object.keys(cats));
const ENGLISH = /\b(the|and|with|your|we|is|are|of)\b/i;
const SCRIPT = { uk: /[Ѐ-ӿ]/, pa: /[਀-੿]/ };
for (const lang of LANGUAGE_CODES) {
  const c = cats[lang].drywallFinish;
  for (const k of ["lineTitle", "hung", "cleaned"]) {
    ok(`${lang}: ${k} present`, typeof c[k] === "string" && c[k].trim().length > 0);
    if (lang !== "en") ok(`${lang}: ${k} translated`, c[k] !== cats.en.drywallFinish[k] && !ENGLISH.test(c[k]), c[k]);
  }
  ok(`${lang}: exactly the six levels`, JSON.stringify(Object.keys(c.levels)) === JSON.stringify(SIX), Object.keys(c.levels));
  // The finish step is the LAST step of the drywall trades in this language —
  // the one finishSteps() rewrites. It must be the one that mentions 4 and 5.
  const plain = resolveServiceContent("drywall_install", null, null, lang);
  const lastBody = plain.steps.at(-1)?.body || "";
  ok(`${lang}: the drywall trades' last step is the finish step (mentions 4 and 5)`, /4/.test(lastBody) && /5/.test(lastBody), lastBody.slice(0, 80));
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
      const doc = resolveServiceContent(trade, null, null, lang, { finishLevel: l });
      ok(`${lang} ${trade} ${l}: the scope paragraph states the level`, doc.description === words.description, doc.description.slice(0, 80));
      ok(`${lang} ${trade} ${l}: the Drywall step states it too`, doc.steps.at(-1).body.includes(words.description) && doc.steps.at(-1).title === plain.steps.at(-1).title && doc.steps.at(-1).timeline === plain.steps.at(-1).timeline);
      ok(`${lang} ${trade} ${l}: every other step unchanged`, JSON.stringify(doc.steps.slice(0, -1)) === JSON.stringify(plain.steps.slice(0, -1)));
      ok(`${lang} ${trade} ${l}: the quote's steps (dominant group) state it`, dominantProcessSteps([{ categoryKey: trade, subtotal: 10, intake: { finishLevel: l } }], lang).at(-1).body === doc.steps.at(-1).body);
    }
  }
  // Already-sent quotes: no answer, an old answer, junk — the document is
  // byte-for-byte what it was before this existed.
  for (const trade of TRADES) {
    const before = JSON.stringify(resolveServiceContent(trade, null, null, lang));
    for (const intake of [undefined, null, {}, { finishLevel: "level_4_standard" }, { finishLevel: "level_5_premium" }, { finishLevel: "level_2_unfinished" }, { finishLevel: "level_9" }, { finishLevel: 5 }, "level_5"]) {
      ok(`${lang} ${trade}: intake ${JSON.stringify(intake)} prints exactly what it printed before`, JSON.stringify(resolveServiceContent(trade, null, null, lang, intake)) === before);
    }
  }
  ok(`${lang}: a general contractor's shell sequence is not touched by a level`, JSON.stringify(resolveServiceContent("general_contracting", null, null, lang, { finishLevel: "level_5" })) === JSON.stringify(resolveServiceContent("general_contracting", null, null, lang)));
}
ok("the shared SHELL_SEQUENCE is not mutated by a level (copy, not edit)", resolveServiceContent("drywall", null, null, "en").steps.at(-1).body.includes("Level 4, or Level 5 where specified"));
{
  const own = resolveServiceContent("drywall_install", { scopeDescription: "We hang and finish board.", processSteps: [{ title: "Ours", body: "Our step." }] }, null, "en", { finishLevel: "level_5" });
  ok("a company's own paragraph still prints, with the level stated after it", own.description === `We hang and finish board. ${drywallFinishText("level_5", "en").description}`);
  ok("a company's own steps are theirs — not rewritten", own.steps.length === 1 && own.steps[0].body === "Our step.");
  const en5 = resolveServiceContent("drywall_install", null, null, "en", { finishLevel: "level_5" });
  ok("the owner's example sentence, in our words", en5.description.startsWith("Finished to Level 5: Level 4 plus a full skim coat"), en5.description);
}
// Every document surface passes the group's intake to the resolver.
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
// The public route reads intakeValues for the paragraph and never returns it.
{
  const pub = code("app/api/public/quotes/[token]/route.js");
  ok("public quote route: intakeValues is never a returned key", !/\bintakeValues\s*:/.test(pub));
}

/* ══ F. The public intake carries no prices ════════════════════════════ */
section("F. Public self-quote field");

const PUBLIC_KEYS = new Set(["key", "label", "type", "options", "unit", "placeholder", "help"]);
for (const k of TRADES) {
  const pub = publicIntakeFields(k);
  const f = pub.find((x) => x.key === "finishLevel");
  ok(`${k}: the public form still asks the finish level`, Boolean(f));
  ok(`${k}: …with the six level strings and nothing priced`, JSON.stringify(f?.options) === JSON.stringify(SIX) && f.options.every((o) => typeof o === "string"));
  ok(`${k}: only the public keys travel (no labels, legacy map or default)`, pub.every((x) => Object.keys(x).every((p) => PUBLIC_KEYS.has(p))), pub.map((x) => Object.keys(x)));
  const text = JSON.stringify(pub);
  ok(`${k}: no rate, price or money anywhere in the public payload`, !/price|rate|\$|amount|cost/i.test(text), text);
  ok(`${k}: the public copy is a copy — mutating it cannot reach the definition`, (() => { f.options.push("x"); return finishField(k).options.length === 6; })());
}
ok("every other category's public fields are unchanged in shape", Object.keys(INTAKE_FIELDS).every((k) => publicIntakeFields(k).every((x) => Object.keys(x).every((p) => PUBLIC_KEYS.has(p)))));
ok("the self-quote routes read the projected helper", code("app/api/self-quote/route.js").includes("publicIntakeFields(") && code("app/api/self-quote/[companySlug]/route.js").includes("publicIntakeFields("));

/* ══ G. Defaults ═══════════════════════════════════════════════════════ */
section("G. A new group opens on Level 4 — when the estimator added it");

const DW = { id: "cat_dw", key: "drywall_install", label: "Drywall Installation", unit: "flat", defaultRate: null };
ok("added from a tile: Level 4", newScopeGroup(DW, DW.label, null, { tempId: "a", fieldDefaults: true }).intakeValues.finishLevel === "level_4");
ok("a phone call's draft: absent stays absent", !("finishLevel" in newScopeGroup(DW, DW.label, null, { tempId: "b", intakeValues: { squareFootage: 400 } }).intakeValues));
ok("an answer the caller gave wins over the default", newScopeGroup(DW, DW.label, null, { tempId: "c", fieldDefaults: true, intakeValues: { finishLevel: "level_2" } }).intakeValues.finishLevel === "level_2");
ok("…even a blank one", newScopeGroup(DW, DW.label, null, { tempId: "d", fieldDefaults: true, intakeValues: { finishLevel: "" } }).intakeValues.finishLevel === "");
ok("a trade with no defaults is byte-identical either way", JSON.stringify(newScopeGroup({ id: "e", key: "electrical", label: "Electrical", unit: "hour", defaultRate: 110 }, "Electrical", null, { tempId: "e", fieldDefaults: true })) === JSON.stringify(newScopeGroup({ id: "e", key: "electrical", label: "Electrical", unit: "hour", defaultRate: 110 }, "Electrical", null, { tempId: "e" })));
ok("withFieldDefaults never fills a key the caller set", JSON.stringify(withFieldDefaults(getIntakeFields("drywall"), { finishLevel: "level_1" })) === JSON.stringify({ finishLevel: "level_1" }));
ok("live (no book): the default adds no line", newScopeGroup(DW, DW.label, null, { tempId: "f", fieldDefaults: true }).lineItems.length === 1);
TRADE_PRICE_BOOKS.drywall_install = INTERIOR_PRICE_BOOKS.drywall_install;
{
  const g = newScopeGroup(DW, DW.label, null, { tempId: "g", fieldDefaults: true, language: "es" });
  const fin = g.lineItems.filter(isFinishLine);
  ok("merged book: the default Level 4 bills its line at once, in the document's language", fin.length === 1 && fin[0].meta.drywallFinish.level === "level_4" && fin[0].description.startsWith("Acabado de paneles de yeso"));
}
delete TRADE_PRICE_BOOKS.drywall_install;
{
  // Raw source for the anchor: it is a comment, which code() strips.
  const raw = src("app/components/quotes/builder/QuoteBuilder.js");
  const at = raw.indexOf("Only what the caller actually said");
  const fromCall = at >= 0 ? raw.slice(Math.max(0, at - 400), at + 1200) : "";
  ok("builder: the phone-call prefill does not ask for defaults", fromCall.includes("newScopeGroup(") && !fromCall.includes("fieldDefaults"));
  const qb = code("app/components/quotes/builder/QuoteBuilder.js");
  ok("builder: a tile add does", /function addScopeGroup\(category, label\)[\s\S]{0,400}fieldDefaults: true/.test(qb));
}

/* ══ H. Materials ══════════════════════════════════════════════════════ */
section("H. Materials");

// No drywall recipe is live — the one in app/data/priceBooks/interior.js is
// staged with the book, and records Level 4 compound coverage only (475 sq ft
// of board a box; "Level 5 roughly doubles it"). So there is nothing for the
// level to scale today. This fails the day a drywall recipe lands, so whoever
// lands it makes compound follow the level instead of costing every job at
// Level 4.
ok("no live drywall material recipe yet — compound scaling is owed when one lands", !Object.hasOwn(MATERIAL_RECIPES, "drywall_install") && !Object.hasOwn(MATERIAL_RECIPES, "drywall"));

console.log(`\ncheck-drywall-finish-levels: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error(fails.slice(0, 80).map((f) => `  ✗ ${f}`).join("\n") + (fails.length > 80 ? `\n  … and ${fails.length - 80} more` : ""));
  process.exit(1);
}
