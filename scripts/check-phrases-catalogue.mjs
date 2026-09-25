// scripts/check-phrases-catalogue.mjs
//
// The company's own catalogue words, drafted on save and printed in the
// reader's language (lib/i18n/phrases.js): the financing note
// (financingNote), instant-quote option names (materialLabel), the names of
// services a company created itself (categoryLabel) and the words of the
// template lines it typed or renamed (templateLineName /
// templateLineDescription).
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-phrases-catalogue.mjs
//
// Two halves. Every helper that swaps a text is EXECUTED against hostile
// input — no rows, a row for other words, a row in the text's own language,
// an unknown language, a broken connection, junk shapes — because a lookup
// that prints "" or another text's words is the failure that matters. The
// wiring is read from source: each save route queues its namespace and each
// client-facing reader looks the text up.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { phraseKey, phraseLookup, loadPhrases, loadPhraseTranslations } from "@/lib/i18n/phrases";
import { sourceHash } from "@/lib/i18n/sourceHash";
import { financingOffer, financingPhrases, normaliseFinancing } from "@/lib/estimate/financing";
import { materialPhraseEntries, localiseMaterialLabels } from "@/lib/estimate/instantQuoteServer";
import { computeInstantEstimate, INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { serviceName, customCategoryPhrases, phraseMapLookup } from "@/lib/i18n/serviceName";
import {
  authoredTemplateText,
  templateLineTexts,
  templateLinePhrasesFor,
  phrasedLineText,
  expandTemplate,
  lineText,
} from "@/lib/services/templates";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("FAIL:", name);
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

const row = (ns, text, language, translated, extra = {}) => ({
  key: phraseKey(ns, text),
  language,
  text: translated,
  sourceHash: sourceHash(String(text).trim()),
  sourceLanguage: "en",
  status: "drafted",
  ...extra,
});

/** A db whose one table answers like Prisma would for the where loadPhrases sends. */
function fakeDb(rows, { throws = false } = {}) {
  const calls = [];
  return {
    calls,
    companyTextTranslation: {
      async findMany({ where }) {
        calls.push(where);
        if (throws) throw new Error("P1001: can't reach database");
        return rows.filter(
          (r) =>
            (!where.companyId || r.companyId === undefined || r.companyId === where.companyId) &&
            (!where.language || r.language === where.language) &&
            where.key.in.includes(r.key) &&
            (!where.status || where.status.in.includes(r.status)),
        );
      },
    },
  };
}

// ── 1. The financing note ───────────────────────────────────────────────────
{
  const on = { enabled: true, note: "  Ask about our 12-month plan.  " };
  ok(same(financingPhrases(null), []), "financingPhrases: no setting → nothing to load");
  ok(same(financingPhrases("yes"), []), "financingPhrases: a non-object → nothing");
  ok(same(financingPhrases({ enabled: false, note: "x" }), []), "financingPhrases: off → nothing (no query for a hidden note)");
  ok(same(financingPhrases({ enabled: true, note: "   " }), []), "financingPhrases: a blank note → nothing (the built-in sentence is already translated)");
  ok(same(financingPhrases({ enabled: true, note: 42 }), []), "financingPhrases: a non-string note → nothing");
  ok(same(financingPhrases(on), [{ ns: "financingNote", text: "Ask about our 12-month plan." }]), "financingPhrases: the note, trimmed exactly as it is saved");
  ok(normaliseFinancing(on).note === financingPhrases(on)[0].text, "the saved note and the looked-up note are the same string (one hash)");

  const tr = phraseLookup([
    row("financingNote", "Ask about our 12-month plan.", "fr", "Demandez-nous notre plan sur 12 mois."),
    // Other words — must never land on this note.
    row("financingNote", "Ask about our 24-month plan.", "fr", "PLAN 24 MOIS"),
  ]);
  ok(financingOffer(on, { language: "fr", tr }).note === "Demandez-nous notre plan sur 12 mois.", "a drafted note is printed in the reader's language");
  ok(financingOffer(on, { language: "fr" }).note === "Ask about our 12-month plan.", "no lookup → the company's own words, as before");
  // loadPhrases reads ONE language, so a reader in Spanish holds a lookup
  // built from Spanish rows — here, none.
  ok(financingOffer(on, { language: "es", tr: phraseLookup([]) }).note === "Ask about our 12-month plan.", "no draft in that language → the company's own words");
  ok(financingOffer({ enabled: true, note: "Other words" }, { language: "fr", tr }).note === "Other words", "a row for other words is not printed");
  ok(financingOffer(on, { language: "fr", tr: () => "" }).note === "Ask about our 12-month plan.", "a lookup returning '' falls back to the company's words, never blank");
  ok(financingOffer(on, { language: "fr", tr: () => undefined }).note === "Ask about our 12-month plan.", "a lookup returning a non-string falls back, never 'undefined'");
  ok(financingOffer(on, { language: "fr", tr: "not a function" }).note === "Ask about our 12-month plan.", "a non-function tr is ignored");
  ok(financingOffer(on, { language: "fr", tr: () => "x".repeat(900) }).note.length === 400, "a drafted note is clamped like a saved one");
  const noNote = financingOffer({ enabled: true }, { language: "fr", tr: () => "INVENTED" });
  ok(noNote.note.startsWith("Du financement"), "no note → the built-in sentence in the language; tr is never asked to invent one");
  ok(financingOffer({ enabled: true }, { language: "zz", tr }).note === "Financing is available — ask us for details.", "an unknown language → the English built-in sentence");
  ok(financingOffer({ enabled: false, note: "x" }, { language: "fr", tr }) === null, "off → null, whatever the lookup");
  const offer = financingOffer({ ...on, url: "https://lender.example/apply", aprPct: 9.9, termMonths: 60 }, { language: "fr", tr });
  ok(same(Object.keys(offer).sort(), ["mode", "note", "url"]), "the offer's shape is unchanged — still no monthly figure, APR or term");

  // A row in the language the note is written in is never printed.
  const selfRow = phraseLookup([row("financingNote", "Ask about our 12-month plan.", "en", "SELF", { sourceLanguage: "en" })]);
  ok(financingOffer(on, { language: "en", tr: selfRow }).note === "Ask about our 12-month plan.", "a row in the note's own language is not printed");
}

// loadPhrases end to end, as the three routes call it.
{
  const rows = [
    { ...row("financingNote", "Ask about our 12-month plan.", "fr", "Demandez-nous notre plan sur 12 mois."), companyId: "co1" },
    { ...row("financingNote", "Ask about our 12-month plan.", "fr", "AUTRE ENTREPRISE"), companyId: "co2" },
  ];
  const on = { enabled: true, note: "Ask about our 12-month plan." };
  const db = fakeDb(rows);
  const tr = await loadPhrases(db, "co1", "fr", financingPhrases(on));
  ok(financingOffer(on, { language: "fr", tr }).note === "Demandez-nous notre plan sur 12 mois.", "loadPhrases → financingOffer prints the draft");
  ok(db.calls.length === 1 && db.calls[0].companyId === "co1", "one read, scoped to the company");
  const trOther = await loadPhrases(fakeDb(rows.slice(1)), "co1", "fr", financingPhrases(on));
  ok(financingOffer(on, { language: "fr", tr: trOther }).note === "Ask about our 12-month plan.", "another company's row is never printed");
  const idle = fakeDb(rows);
  await loadPhrases(idle, "co1", "fr", financingPhrases({ enabled: false, note: "x" }));
  ok(idle.calls.length === 0, "financing off → no query at all");
  const broken = await loadPhrases(fakeDb(rows, { throws: true }), "co1", "fr", financingPhrases(on));
  ok(financingOffer(on, { language: "fr", tr: broken }).note === "Ask about our 12-month plan.", "a failed read prints the company's words, not a 500");
}

// ── 2. Instant-quote option names ───────────────────────────────────────────
{
  ok(same(materialPhraseEntries(null), []), "materialPhraseEntries: no config → nothing");
  ok(same(materialPhraseEntries({ materials: "x" }), []), "materialPhraseEntries: materials not an array → nothing");
  ok(
    same(materialPhraseEntries({ materials: [null, 3, { key: "a" }, { key: "b", label: "  " }, { key: "c", label: 7 }, { key: "d", label: "Metal" }] }), [{ ns: "materialLabel", text: "Metal" }]),
    "materialPhraseEntries: only real names",
  );

  const tr = phraseLookup([
    row("materialLabel", "Architectural shingles", "fr", "Bardeaux architecturaux"),
    row("materialLabel", "Standing", "fr", "WRONG"),
  ]);
  const config = { ...INSTANT_ESTIMATE_DEFAULTS.roofing, materials: [...INSTANT_ESTIMATE_DEFAULTS.roofing.materials, null, { key: "odd", label: 12 }] };
  const out = localiseMaterialLabels(config, tr);
  const byKey = Object.fromEntries(out.materials.filter((m) => m && typeof m === "object").map((m) => [m.key, m]));
  ok(byKey.asphalt_arch.label === "Bardeaux architecturaux", "a drafted option name is swapped in");
  ok(byKey.metal_standing_seam.label === "Standing seam metal", "a row for other words does not land on a name");
  ok(same(out.materials.map((m) => m?.key), config.materials.map((m) => m?.key)), "keys and order are untouched (pricing and the posted key never read a label)");
  ok(same(out.materials.map((m) => m?.ratePerSquare), config.materials.map((m) => m?.ratePerSquare)), "rates are untouched");
  ok(out.materials.includes(null) && byKey.odd.label === 12, "junk rows pass through as they were (the sanitiser decides, not this)");
  ok(config.materials[1].label === "Architectural shingles", "the saved config object is not mutated");
  ok(localiseMaterialLabels(null, tr) === null, "null config → null");
  ok(localiseMaterialLabels(config, null) === config, "no lookup → the same config");
  ok(localiseMaterialLabels({ trade: "x" }, tr).trade === "x", "a config without materials is returned as is");

  // The estimator's breakdown line — which becomes the draft quote's line —
  // carries the localised name, and the figure does not move.
  const measurements = { squares: 20, steepness: "standard", tearOffLayers: 0 };
  const plain = computeInstantEstimate({ trade: "roofing", measurements, materialKey: "asphalt_arch", config: INSTANT_ESTIMATE_DEFAULTS.roofing, language: "fr" });
  const local = computeInstantEstimate({ trade: "roofing", measurements, materialKey: "asphalt_arch", config: localiseMaterialLabels(INSTANT_ESTIMATE_DEFAULTS.roofing, tr), language: "fr" });
  ok(plain.ok && local.ok, "roofing estimates with and without the swap");
  ok(/Bardeaux architecturaux/.test(local.breakdown?.[0]?.label || ""), "the breakdown line names the option in the reader's language");
  ok(local.low === plain.low && local.high === plain.high && local.breakdown[0].amount === plain.breakdown[0].amount, "the swap changes no figure");
}

// ── 3. Custom service names ─────────────────────────────────────────────────
{
  const catalogue = { key: "interior_painting", label: "Interior Painting", labelTranslations: { fr: "Peinture intérieure" }, companyId: null };
  const own = { key: "custom_1", label: "Heritage window restoration", labelTranslations: null, companyId: "co1" };
  const frenchTyped = { key: "custom_2", label: "Restauration de fenêtres", labelTranslations: null, companyId: "co1" };
  const tr = phraseLookup([
    row("categoryLabel", "Heritage window restoration", "fr", "Restauration de fenêtres patrimoniales"),
    { ...row("categoryLabel", "Restauration de fenêtres", "en", "Window restoration"), sourceLanguage: "fr" },
    // A catalogue label has no phrase; even if one existed it must not win.
    row("categoryLabel", "Interior Painting", "fr", "WRONG"),
  ]);
  ok(serviceName(catalogue, "fr", tr) === "Peinture intérieure", "a catalogue service keeps FieldQuo's translation");
  ok(serviceName(catalogue, "es", tr) === "Interior Painting", "a catalogue service with no translation → its label (categoryLabel, unchanged)");
  ok(serviceName(own, "fr", tr) === "Restauration de fenêtres patrimoniales", "a company's own service is named from its drafted phrase");
  ok(serviceName(own, "es", phraseLookup([])) === "Heritage window restoration", "no draft in that language → the company's own words");
  ok(serviceName(frenchTyped, "en", tr) === "Window restoration", "a name typed in French reaches an English reader (categoryLabel's 'en is default' shortcut is bypassed)");
  ok(serviceName(own, "fr") === "Heritage window restoration", "no lookup → categoryLabel, the words as written");
  ok(serviceName({ ...own, labelTranslations: { fr: "Reviewed wording" } }, "fr", tr) === "Reviewed wording", "a stored labelTranslations entry beats a draft");
  ok(serviceName({ ...own, labelTranslations: { fr: "   " } }, "fr", tr) === "Restauration de fenêtres patrimoniales", "a blank stored entry does not beat the draft");
  ok(serviceName(null, "fr", tr) === "", "no category → ''");
  ok(serviceName({ companyId: "co1", label: "" }, "fr", tr) === "", "an unnamed category stays unnamed (nothing invented)");
  ok(serviceName(own, "fr", () => "") === "", "…and a broken lookup's '' is the lookup's contract to keep, not ours to invent over");

  ok(
    same(customCategoryPhrases([catalogue, own, null, { companyId: "co1", label: " " }, { companyId: "co1", label: 5 }]), [{ ns: "categoryLabel", text: "Heritage window restoration" }]),
    "customCategoryPhrases: only the company's own, named rows",
  );
  ok(same(customCategoryPhrases("nope"), []), "customCategoryPhrases: junk → []");

  const map = { "Heritage window restoration": { fr: "Restauration patrimoniale", es: "  " } };
  const lookup = phraseMapLookup(map, "fr");
  ok(lookup("categoryLabel", "Heritage window restoration") === "Restauration patrimoniale", "phraseMapLookup: the drafted language");
  ok(phraseMapLookup(map, "es")("categoryLabel", "Heritage window restoration") === "Heritage window restoration", "phraseMapLookup: a blank draft → the text");
  ok(phraseMapLookup(map, "zz")("categoryLabel", "Heritage window restoration") === "Heritage window restoration", "phraseMapLookup: an unknown language → the text");
  ok(phraseMapLookup(null, "fr")("categoryLabel", "X") === "X", "phraseMapLookup: no map → the text");
  ok(phraseMapLookup(map, null)("categoryLabel", "Heritage window restoration") === "Heritage window restoration", "phraseMapLookup: no language → the text");
  ok(phraseMapLookup(map, "fr")("categoryLabel", 42) === "", "phraseMapLookup: a non-string → '' (never 'undefined')");
  ok(phraseMapLookup(map, "fr")("categoryLabel", "__proto__") === "__proto__", "phraseMapLookup: a prototype key is not a translation");

  // The prep guide's path: loadPhraseTranslations → phraseMapLookup → serviceName.
  const db = fakeDb([
    { ...row("categoryLabel", "Heritage window restoration", "fr", "Restauration de fenêtres patrimoniales"), companyId: "co1" },
    { ...row("categoryLabel", "Heritage window restoration", "en", "SELF"), companyId: "co1", sourceLanguage: "en" },
  ]);
  const byText = await loadPhraseTranslations(db, "co1", "categoryLabel", customCategoryPhrases([catalogue, own]).map((e) => e.text));
  ok(serviceName(own, "fr", phraseMapLookup(byText, "fr")) === "Restauration de fenêtres patrimoniales", "prep guide path: the drafted name");
  ok(serviceName(own, "en", phraseMapLookup(byText, "en")) === "Heritage window restoration", "prep guide path: a row in the text's own language is not printed");
  const none = fakeDb([]);
  await loadPhraseTranslations(none, "co1", "categoryLabel", customCategoryPhrases([catalogue]).map((e) => e.text));
  ok(none.calls.length === 0, "a job of catalogue services only costs no query");
}

// ── 4. Template lines ───────────────────────────────────────────────────────
{
  const seeded = { kind: "labour", name: "Prep and mask", description: "Tape and cover", translations: { fr: { name: "Préparer et masquer", description: "Ruban et bâches" } } };
  const typed = { kind: "material", name: "Heritage glazing putty", description: "Linseed oil putty" };
  const before = [seeded, typed];

  const unchanged = authoredTemplateText(before, before);
  ok(same(unchanged.names, ["Heritage glazing putty"]) && same(unchanged.descriptions, ["Linseed oil putty"]), "an unchanged save queues only the typed line (a pending draft is retried)");
  ok(unchanged.fresh === false, "…and the banner stays quiet: nothing new");
  const renamed = authoredTemplateText([{ ...seeded, name: "Prep, mask and prime" }, typed], before);
  ok(renamed.names.includes("Prep, mask and prime") && !renamed.names.includes("Prep and mask"), "a renamed seeded line's new name is queued (its translations are the old words')");
  ok(!renamed.descriptions.includes("Tape and cover"), "…its unchanged description is not re-drafted");
  ok(renamed.fresh === true, "…and the banner speaks");
  const redescribed = authoredTemplateText([{ ...seeded, description: "Tape, cover, sand" }], before);
  ok(same(redescribed.names, []) && same(redescribed.descriptions, ["Tape, cover, sand"]), "an edited description alone queues the description alone");
  const fresh = authoredTemplateText(before, null);
  ok(same(fresh.names, ["Heritage glazing putty"]), "no previous row: seeded lines are still never re-drafted");
  ok(same(authoredTemplateText("junk", before), { names: [], descriptions: [], fresh: false }), "junk lines → nothing");
  ok(same(authoredTemplateText([null, 4, { name: "  " }, { name: 9 }], []).names, []), "unnamed / non-string lines → nothing");
  ok(authoredTemplateText([typed, { ...typed }], []).names.length === 1, "the same words twice are one phrase");
  ok(same(authoredTemplateText([{ ...seeded, translations: {} }], before).names, ["Prep and mask"]), "an empty translations object counts as none");

  const products = [
    { id: "p1", templateLines: [seeded, typed] },
    { id: "p2", templateLines: null },
    { id: "p3", templateLines: [{ name: " Spaced name ", description: "" }] },
  ];
  const texts = templateLineTexts(products);
  ok(texts.names.includes("Heritage glazing putty") && texts.names.includes(" Spaced name ") && texts.descriptions.length === 2, "templateLineTexts: every distinct text, raw (the read is keyed by it)");
  ok(same(templateLineTexts(null), { names: [], descriptions: [] }), "templateLineTexts: junk → empty");
  const drafts = {
    name: { "Heritage glazing putty": { fr: "Mastic de vitrage patrimonial" }, " Spaced name ": { fr: "Nom" }, "Other product line": { fr: "X" } },
    description: { "Linseed oil putty": { fr: "Mastic à l'huile de lin" } },
  };
  const p1 = templateLinePhrasesFor(products[0], drafts);
  ok(same(Object.keys(p1.name), ["Heritage glazing putty"]) && !("Other product line" in p1.name), "templateLinePhrasesFor: only this product's own lines travel");
  ok(templateLinePhrasesFor(products[1], drafts) === null, "templateLinePhrasesFor: no lines → nothing extra sent");
  ok(templateLinePhrasesFor({ templateLines: [seeded] }, drafts) === null, "templateLinePhrasesFor: no drafts for its lines → nothing extra sent");
  ok("Spaced name" in templateLinePhrasesFor(products[2], drafts).name, "templateLinePhrasesFor: keyed by the trimmed text the sanitiser leaves");
  ok(templateLinePhrasesFor(products[0], null) === null, "templateLinePhrasesFor: no drafts at all → null");

  const phrases = { name: { "Heritage glazing putty": { fr: "Mastic de vitrage patrimonial" }, "Prep and mask": { fr: "Préparer, masquer (nouveau)" } }, description: { "Linseed oil putty": { fr: "Mastic à l'huile de lin" } } };
  ok(phrasedLineText(typed, null, "fr") === null, "phrasedLineText: no phrases → null (lineText decides)");
  ok(phrasedLineText(typed, phrases, null) === null, "phrasedLineText: no language → null");
  ok(phrasedLineText(typed, phrases, "es") === null, "phrasedLineText: no draft in that language → null");
  ok(same(phrasedLineText(typed, phrases, "fr"), { name: "Mastic de vitrage patrimonial", description: "Mastic à l'huile de lin", missing: false }), "phrasedLineText: both drafted");
  ok(phrasedLineText({ ...seeded }, phrases, "fr").name === "Préparer, masquer (nouveau)", "phrasedLineText: a draft (the company's words) beats a seeded translation");
  const halfway = phrasedLineText({ name: "Heritage glazing putty", description: "Untranslated note" }, phrases, "fr");
  ok(halfway.name === "Mastic de vitrage patrimonial" && halfway.description === "Untranslated note" && halfway.missing === true, "phrasedLineText: a name draft with an undrafted description is still flagged missing");
  ok(phrasedLineText({ name: "Heritage glazing putty" }, phrases, "fr").missing === false, "phrasedLineText: a line with no description is complete with its name");
  ok(phrasedLineText({ name: "__proto__" }, phrases, "fr") === null, "phrasedLineText: a prototype key is not a draft");

  // expandTemplate: the builders' path. A product WITHOUT phrases expands
  // byte for byte as before (md5 against lineText's own path).
  const product = { templateLines: [seeded, typed, { kind: "other", name: "Travel", qty: 1, unitPrice: 50 }] };
  const baseline = expandTemplate(product, { language: "fr", currency: "CAD" });
  const legacy = product.templateLines.map((l) => lineText(l, "fr"));
  ok(same(baseline.map((l) => [l.description, l.detail]), legacy.map((t) => [t.name, t.description])), "expandTemplate without phrases is lineText, as before");
  ok(md5(expandTemplate({ ...product, templateLinePhrases: null }, { language: "fr", currency: "CAD" })) === md5(baseline), "templateLinePhrases: null changes nothing (md5)");
  ok(md5(expandTemplate({ ...product, templateLinePhrases: phrases }, { language: "es", currency: "CAD" })) === md5(expandTemplate(product, { language: "es", currency: "CAD" })), "phrases in another language change nothing (md5)");
  const withPhrases = expandTemplate({ ...product, templateLinePhrases: phrases }, { language: "fr", currency: "CAD" });
  ok(withPhrases[1].description === "Mastic de vitrage patrimonial" && withPhrases[1].detail === "Mastic à l'huile de lin", "a typed line opens on a French quote in French");
  ok(!withPhrases[1].warnings.includes("translation:fr"), "…and is no longer flagged untranslated");
  ok(withPhrases[2].description === "Travel" && withPhrases[2].warnings.includes("translation:fr"), "an undrafted typed line keeps its words and its flag");
  ok(same(withPhrases.map((l) => [l.rate, l.quantity, l.amount]), baseline.map((l) => [l.rate, l.quantity, l.amount])), "no figure moves");
}

// ── 5. The wiring, read from source ─────────────────────────────────────────
const code = (p) =>
  readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
/** The body of one exported function, so an assertion cannot pass on a line elsewhere in the file. */
const fnBody = (src, name) => {
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return "";
  const next = src.slice(start + 1).search(/\n(export\s+)?(async\s+)?function\s+\w+\s*\(/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
};

{
  const iq = code("app/api/settings/instant-quote/route.js");
  const put = fnBody(iq, "PUT");
  ok(/schedulePhrases\(\{[^}]*ns:\s*"financingNote"[^}]*texts:\s*\[financing\.note\]/s.test(put), "instant-quote PUT: the financing save queues financingNote");
  ok(/return NextResponse\.json\(\{ ok: true, financing, autoTranslate \}\)/.test(put), "…and answers what it queued");
  ok(/financing\.note !== normaliseFinancing\(before\?\.financing\)\.note \? scheduled : null/.test(put), "…only when the note's words changed");
  ok(/schedulePhrases\(\{[^}]*ns:\s*"materialLabel"/s.test(put), "instant-quote PUT: the trade save queues materialLabel");
  ok(/enabled: saved\.enabled, autoTranslate \}/.test(put), "…and answers what it queued");

  for (const [file, lang] of [
    ["app/api/instant-quote/[companySlug]/measure/route.js", "language"],
    ["app/api/instant-quote/[companySlug]/request/route.js", "emailLanguage"],
  ]) {
    const src = code(file);
    ok(new RegExp(`loadPhrases\\(db, company\\.id, ${lang}, financingPhrases\\(company\\.financing\\)\\)`).test(src), `${file}: loads the note's draft in the form's language`);
    ok(/financingOffer\(company\.financing, \{ language(: \w+)?, tr: trFinancing \}\)/.test(src), `${file}: financingOffer prints it`);
    ok(!/financingOffer\(company\.financing, \{ language(: \w+)? \}\)/.test(src), `${file}: no untranslated financingOffer call left`);
  }
  const pq = code("app/api/public/quotes/[token]/route.js");
  ok(/loadPhrases\(\s*db,\s*quote\.companyId,\s*resolveClientLanguage\([^)]*\),\s*financingPhrases\(quote\.company\?\.financing\),?\s*\)/s.test(pq), "public quote: loads the note's draft in the document's resolved language");
  ok(/present\(quote, \{ financingTr \}\)/.test(pq) && /financing: financingBlock\(quote, financingTr\)/.test(pq), "public quote: present → financingBlock → financingOffer carries it");
  ok(/financingOffer\(raw, \{[\s\S]*?\n\s*tr,\n\s*\}\);/.test(fnBody(pq, "financingBlock")), "public quote: financingBlock hands tr to financingOffer");

  const iqs = code("lib/estimate/instantQuoteServer.js");
  const page = fnBody(iqs, "loadCompanyInstantTrades");
  ok(/const trMaterial = await loadPhrases\(\s*db,\s*company\.id,\s*lang,/s.test(page), "public form payload: option names loaded in the visitor's language");
  ok(/localiseMaterialLabels\(sanitiseInstantConfig\(config\), trMaterial\)/.test(page), "…and printed through the lookup");
  ok(/withMaterialPhrases\(await loadEnabledConfig\(companyId, trade\), companyId, namedLanguage\)/.test(fnBody(iqs, "priceAllMaterials")), "priceAllMaterials (the /measure cards, the report's cards) localises the names");
  ok(/withMaterialPhrases\(sanitiseInstantConfig\(await loadEnabledConfig\(companyId, trade\)\), companyId, namedLanguage\)/.test(fnBody(iqs, "priceOneMaterial")), "priceOneMaterial (the draft quote's lines) localises the names");
  ok(/if \(!config \|\| !language\) return config;/.test(fnBody(iqs, "withMaterialPhrases")), "a pricer called without a language (phone, AI employee) keeps the words as written");

  const sc = code("app/api/settings/service-categories/route.js");
  const post = fnBody(sc, "POST");
  ok(/schedulePhrases\(\{[^}]*ns:\s*"categoryLabel"[^}]*texts:\s*\[category\.label\]/s.test(post), "service-categories POST: a new service's name is queued");
  ok(/autoTranslate,\s*\},\s*\{ status: 201 \}/s.test(post), "…and the answer carries it");
  ok(!/categoryLabel/.test(fnBody(sc, "PATCH")), "…the PATCH is not touched by this namespace");
  const editor = code("app/app/settings/services/ServicesEditor.js");
  ok(/const \{ autoTranslate: queued, \.\.\.created \} = await res\.json\(\);/.test(editor) && /setAutoTranslate\(queued \|\| null\)/.test(editor), "Services screen: the create answer feeds the banner, not the category row");

  for (const file of ["lib/proposal/load.js", "app/site/[subdomain]/page.js", "app/api/portal/[token]/tickets/route.js"]) {
    const src = code(file);
    ok(/customCategoryPhrases\(categories\)/.test(src) && /serviceName\(c, language, (tr|trService)\)/.test(src), `${file}: a company's own service names are looked up in the reader's language`);
    ok(!/\bcategoryLabel\(c, language\)/.test(src), `${file}: no bare categoryLabel left on the service list`);
    ok(/companyId: true/.test(src), `${file}: selects companyId to tell own services from the catalogue's`);
  }
  const pg = code("lib/prepGuide/build.js");
  ok(/loadPhraseTranslations\(\s*db,\s*companyId,\s*"categoryLabel",/s.test(pg), "prep guide loader: loads the own services' drafts");
  ok(/serviceName\(category, language, trService, "en"\)/.test(pg) && /phraseMapLookup\(categoryPhrases, language\)/.test(pg), "prep guide builder: names them in the guide's language");

  const pid = code("app/api/products/[id]/route.js");
  ok(/authoredTemplateText\(updated\.templateLines, existing\.templateLines\)/.test(pid), "product PATCH: works out which line words the company wrote");
  ok(/ns: "templateLineName", texts: authored\.names/.test(pid) && /ns: "templateLineDescription", texts: authored\.descriptions/.test(pid), "…and queues both namespaces");
  ok(/if \(templateLines !== undefined\)/.test(pid), "…only on a save that sent the template");
  const pr = code("app/api/products/route.js");
  const get = fnBody(pr, "GET");
  ok(/loadPhraseTranslations\(db, member\.companyId, "templateLineName", names\)/.test(get) && /loadPhraseTranslations\(db, member\.companyId, "templateLineDescription", descriptions\)/.test(get), "GET /api/products: loads the line drafts, scoped to the company");
  ok(/templateLinePhrasesFor\(p, drafts\)/.test(get), "…and sends each product its own");
  const tpl = code("lib/services/templates.js");
  ok(/phrasedLineText\(line, product\?\.templateLinePhrases, language, defaultLanguage\) \|\| lineText\(line, language, defaultLanguage\)/.test(fnBody(tpl, "expandTemplate")), "expandTemplate prefers a drafted phrase, else lineText");
  const card = code("app/app/settings/services/ServiceTemplatesCard.js");
  ok(!/templateLinePhrases/.test(card), "the template editor never round-trips the drafts into the row");

  const iqPage = code("app/app/settings/instant-quotes/page.js");
  ok(/setAutoTranslate\(answer\?\.autoTranslate \|\| null\)/.test(fnBody(iqPage, "FinancingCard")) && /<AutoTranslateBanner result=\{autoTranslate\}/.test(fnBody(iqPage, "FinancingCard")), "Financing card: shows what the save queued");
  const tc = code("app/app/settings/instant-quotes/TradeCard.js");
  ok(/setAutoTranslate\(answer\?\.autoTranslate \|\| null\)/.test(tc) && /<AutoTranslateBanner result=\{autoTranslate\}/.test(tc), "Trade card: shows what the save queued");
  ok(/setAutoTranslate\(answer\?\.autoTranslate \|\| null\)/.test(card) && /<AutoTranslateBanner result=\{autoTranslate\}/.test(card), "Template editor: shows what the save queued");
}

console.log(`check-phrases-catalogue: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
