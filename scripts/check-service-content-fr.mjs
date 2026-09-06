// scripts/check-service-content-fr.mjs
//
//   npm run check:service-content-fr
//
// A document keeps the language it was created in. The scope prose is chosen
// at render time from a static catalogue keyed by the document's fixed
// language; this executes that choice for French and pins the four places
// that must hand the language in. The owner opened Q-2026-0011 — DEVIS,
// "Préparé pour" — and read "We replace the doors and drawer fronts…" under
// it; that is the failure this holds shut.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveServiceContent, dominantProcessSteps, isFrench } from "../lib/documents/serviceContent.js";
import { CONTENT_FR, GENERIC_FR } from "../lib/documents/serviceContent.fr.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)?.slice(0, 300));
  }
}
const english = /\b(the|and|with|your|we)\b/i;

ok("isFrench: fr, fr-CA, FR, ' fr '", ["fr", "fr-CA", "FR", " fr "].every(isFrench));
ok("isFrench: en, null, '', 'french' are not", !isFrench("en") && !isFrench(null) && !isFrench("") && !isFrench("french"));

// ── The trade the owner saw ────────────────────────────────────────────────
const fr = resolveServiceContent("cabinet_refacing", null, null, "fr");
const en = resolveServiceContent("cabinet_refacing", null, null, "en");
ok("French refacing description is French", fr.description.startsWith("Nous remplaçons les portes"), fr.description.slice(0, 60));
ok("...and the English one is unchanged", en.description.startsWith("We replace the doors"), en.description.slice(0, 40));
ok("French inclusions are French, same count as English minus the withheld placeholders",
  fr.included.length === en.included.length && fr.included.every((l) => !english.test(l)), fr.included);
ok("bracketed placeholders are withheld in French too (three of them on refacing)",
  fr.included.length === 8 && fr.included.every((l) => !/\[/.test(l)), fr.included.length);
ok("...and reported as unfilled, in French", fr.unfilled.length === 3 && fr.unfilled.every((p) => /votre|combien|vos/i.test(p)), fr.unfilled);
ok("French steps are French, same count", fr.steps.length === en.steps.length && fr.steps.every((s) => !english.test(s.title) && !english.test(s.body)), fr.steps.map((s) => s.title));
ok("steps are numbered 1..n after filtering", fr.steps.every((s, i) => s.num === i + 1));
ok("the accent colour rides through from English (not a French field)", fr.accent === en.accent);
ok("variesWith is the French label", fr.variesWith === "le matériau des portes", fr.variesWith);

// ── Variants ────────────────────────────────────────────────────────────────
const thermo = resolveServiceContent("cabinet_refacing", null, { doorMaterial: "thermofoil" }, "fr");
ok("the thermofoil variant is French", /thermoplastique/.test(thermo.description) && !english.test(thermo.description), thermo.description.slice(0, 80));
const unknownDoor = resolveServiceContent("cabinet_refacing", null, { doorMaterial: "unobtainium" }, "fr");
ok("an unknown door material falls back to the French TRADE paragraph, not English", unknownDoor.description === fr.description);

// ── Company override wins in whatever language it was written ──────────────
const own = resolveServiceContent("cabinet_refacing", { scopeDescription: "Texte de l'entreprise.", includedItems: ["Ligne 1"] }, null, "fr");
ok("a company's own paragraph and list win over the catalogue", own.description === "Texte de l'entreprise." && own.included.join() === "Ligne 1");
const ownEn = resolveServiceContent("cabinet_refacing", { scopeDescription: "Company text." }, null, "fr");
ok("...even when they wrote it in English on a French document — their text, untouched", ownEn.description === "Company text.");

// ── Fallbacks: a trade or field not yet translated ─────────────────────────
const untranslated = Object.keys(CONTENT_FR).length;
const plumbingFr = resolveServiceContent("plumbing", null, null, "fr");
const plumbingEn = resolveServiceContent("plumbing", null, null, "en");
ok("a trade with no French entry renders its English description and steps, not nothing — and the FRENCH generic inclusions",
  plumbingFr.description === plumbingEn.description && plumbingFr.steps.length === plumbingEn.steps.length && plumbingFr.included.join() === GENERIC_FR.included.join(),
  { desc: plumbingFr.description.slice(0, 40), inc: plumbingFr.included[0] });
const installFr = resolveServiceContent("flooring_install", null, null, "fr");
ok("a trade with only French steps: French steps, generic French inclusions, English description (none exists in either)",
  installFr.steps[0].title === "Consultation et sélection" && installFr.included[0] === GENERIC_FR.included[0] && installFr.description === "", { steps: installFr.steps[0]?.title, inc: installFr.included[0], desc: installFr.description });
const nothingFr = resolveServiceContent("no_such_trade", null, null, "fr");
ok("an unknown trade in French gets the French generic inclusions", nothingFr.included.join() === GENERIC_FR.included.join());
ok("...and the English generic in English", resolveServiceContent("no_such_trade", null, null, "en").included[0].startsWith("All labour"));
ok("no language at all behaves exactly as before (English)", JSON.stringify(resolveServiceContent("cabinet_refacing", null, null)) === JSON.stringify(en));

// ── Every French entry keeps the English entry's shape ─────────────────────
for (const [key, entry] of Object.entries(CONTENT_FR)) {
  const e = resolveServiceContent(key, null, null, "en");
  const f = resolveServiceContent(key, null, null, "fr");
  if (entry.included) ok(`${key}: French inclusions match the English count`, f.included.length === e.included.length, [f.included.length, e.included.length]);
  if (entry.steps) ok(`${key}: French steps match the English count`, f.steps.length === e.steps.length, [f.steps.length, e.steps.length]);
  if (entry.description) ok(`${key}: French description contains no English function words`, !english.test(f.description), f.description.slice(0, 80));
  ok(`${key}: French inclusions contain no English function words`, f.included.every((l) => !english.test(l)), f.included.filter((l) => english.test(l)));
}
ok("seven trades translated so far — the owner's company's set", untranslated === 8, untranslated);

// ── Process steps for a whole quote ────────────────────────────────────────
const dom = dominantProcessSteps([{ categoryKey: "interior_painting", subtotal: 100 }, { categoryKey: "countertop", subtotal: 900 }], "fr");
ok("the dominant trade's steps come out in French", dom[0].title === "Consultation et sélection", dom[0]);
ok("no groups: the French generic steps", dominantProcessSteps([], "fr").length > 0 && dominantProcessSteps([], "fr").every((s) => s.num));

// ── The four call sites hand the language in ───────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
ok("the public quote route resolves the language ONCE and hands it to the prose",
  /const docLanguage = resolveClientLanguage\(/.test(read("app/api/public/quotes/[token]/route.js")) && /g\.takeoff,\s*docLanguage,\s*\)/.test(read("app/api/public/quotes/[token]/route.js")));
ok("the quote document route passes quote.language", /g\.takeoff,\s*quote\.language,\s*\)/.test(read("app/api/quotes/[id]/document/route.js")));
ok("the invoice document route passes invoice.language", /g\.takeoff,\s*invoice\.language,\s*\)/.test(read("app/api/invoices/[id]/document/route.js")));
ok("the PDF scope section passes its language", /g\.takeoff,[\s\S]{0,200}language,\s*\)/.test(read("lib/documentSections/ScopeGroupsSection.js")));
ok("the process-steps section threads language into stepsFor", /stepsFor\(data, language\)/.test(read("lib/documentSections/ProcessStepsSection.js")));
// The steps are built in three routes, separately from the prose. The first
// deploy translated the prose and left "Measure and specify" under a French
// quote, because these three were not told. Every dominantProcessSteps call
// outside the library must name a language.
for (const [file, lang] of [
  ["app/api/public/quotes/[token]/route.js", "docLanguage"],
  ["app/api/quotes/[id]/document/route.js", "quote\\.language"],
  ["app/api/invoices/[id]/document/route.js", "invoice\\.language"],
]) {
  // Code lines only: the invoice route's comment mentions the call by name.
  const src = read(file).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const calls = src.match(/dominantProcessSteps\(/g) || [];
  const withLang = src.match(new RegExp(`dominantProcessSteps\\([\\s\\S]{0,400}?${lang},?\\s*\\)`, "g")) || [];
  ok(`${file}: every dominantProcessSteps call passes the document's language`, calls.length > 0 && withLang.length === calls.length, { calls: calls.length, withLang: withLang.length });
}

console.log(`\ncheck-service-content-fr: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
