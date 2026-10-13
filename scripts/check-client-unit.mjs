// scripts/check-client-unit.mjs
//
//   npm run check:client-unit
//
// The department or branch on documents (owner, 2026-10-14): a company
// client's Client.organizationUnit prints under its name on the quote and the
// invoice — the staff pages and builders, the client's /q page, the PDF and
// the email panel — through ONE function, lib/documents/clientUnit.js.
//
// What it proves, EXECUTED (bundled with esbuild; the surfaces are JSX):
//
//   1. clientUnitLine against hostile input — company only, whitespace
//      collapsed, capped, junk is null.
//   2. BYTE-IDENTICAL for everyone else: an individual (with and without a
//      stale unit, with no type at all) and a company with no unit or a blank
//      one render every surface with the SAME md5 as the tree before the line
//      existed (scripts/fixtures/clientBlockBaseline.json, written from
//      21cefa69c by scripts/client-block-baseline.mjs).
//   3. A company with a unit: it is printed, under the name and above the
//      contact lines, on the quote AND the invoice, in English and French
//      documents alike, verbatim — the client's words, never translated.
//   4. Long names wrap on every surface (nothing truncates to one line), and
//      a hostile unit is escaped.
//   5. Contrast measured, not assumed: the ink the unit uses against the
//      panel it sits on, across hostile brand colours, at 4.5:1.
//   6. The surfaces that are pages (the invoice page's own client block, /q)
//      call the shared pieces.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { renderClientBlocks, CLIENT_FIXTURES, BRANDS, LONG_UNIT } from "./fixtures/clientBlockRender.mjs";
import BASELINE from "./fixtures/clientBlockBaseline.json";
import { clientUnitLine, CLIENT_UNIT_MAX } from "@/lib/documents/clientUnit";
import { DocumentClientUnit } from "@/app/components/document/QuoteDocument";
import { documentTheme } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { quotePageClientFacts } from "@/lib/quotes/gcSignup";

let pass = 0;
const failures = [];
const ok = (label, cond, got) => {
  if (cond) pass++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}${got !== undefined ? `  got: ${JSON.stringify(got).slice(0, 300)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);
const md5 = (s) => createHash("md5").update(s).digest("hex");
const read = (p) => readFileSync(p, "utf8");

section("1. clientUnitLine");
{
  const unit = "Science and Parliamentary Infrastructure Branch";
  ok("a company with a unit → the unit", clientUnitLine({ type: "company", organizationUnit: unit }) === unit);
  ok("an individual with a unit → null", clientUnitLine({ type: "individual", organizationUnit: unit }) === null);
  ok("no type → null", clientUnitLine({ organizationUnit: unit }) === null);
  ok("type spelled another way → null (the enum is exact)", clientUnitLine({ type: "Company", organizationUnit: unit }) === null);
  for (const junk of [null, undefined, "company", 5, [], { type: "company" }, { type: "company", organizationUnit: 7 }, { type: "company", organizationUnit: ["x"] }, { type: "company", organizationUnit: { toString: () => "x" } }, { type: "company", organizationUnit: "   \n\t " }]) {
    ok(`junk ${JSON.stringify(junk)} → null`, clientUnitLine(junk) === null);
  }
  ok("whitespace runs and newlines collapse to one space", clientUnitLine({ type: "company", organizationUnit: "  Science\n\nand   Parliamentary\tBranch " }) === "Science and Parliamentary Branch");
  const capped = clientUnitLine({ type: "company", organizationUnit: "x".repeat(2000) });
  ok(`capped at ${CLIENT_UNIT_MAX}, with an ellipsis`, capped.length === CLIENT_UNIT_MAX && capped.endsWith("…"), capped.length);
  ok("a long real name under the cap is kept whole", clientUnitLine({ type: "company", organizationUnit: LONG_UNIT }) === LONG_UNIT);
  const proto = JSON.parse('{"type":"company","__proto__":{"organizationUnit":"polluted"}}');
  ok('a JSON body with "__proto__" carries no unit', clientUnitLine(proto) === null, clientUnitLine(proto));
}

section("2. Byte-identical for an individual and a company without a unit");
const blocks = renderClientBlocks();
const UNCHANGED = ["individual", "individualStaleUnit", "individualNoType", "companyNoUnit", "companyBlankUnit"];
for (const fixture of UNCHANGED) {
  for (const [lang, surfaces] of Object.entries(blocks[fixture])) {
    for (const [surface, rendered] of Object.entries(surfaces)) {
      const was = BASELINE[fixture]?.[lang]?.[surface];
      ok(`${fixture} ${lang} ${surface}: md5 ${md5(rendered).slice(0, 8)} = before`, typeof was === "string" && md5(rendered) === was, { now: md5(rendered), was });
    }
  }
}
ok("the baseline covers every unchanged fixture and surface", UNCHANGED.every((f) => ["en", "fr"].every((l) => Object.keys(BASELINE[f]?.[l] || {}).length === 5)));
ok("…and a stale unit on an individual renders exactly what a clean individual does",
  ["en", "fr"].every((l) => ["parties", "pdfQuote", "pdfInvoice", "email"].every((s) => md5(blocks.individualStaleUnit[l][s]) === md5(blocks.individual[l][s]))));

section("3. A company with a unit: printed under the name, quote and invoice, verbatim");
const UNIT = CLIENT_FIXTURES.companyUnit.organizationUnit;
const NAME = CLIENT_FIXTURES.companyUnit.name;
for (const lang of ["en", "fr"]) {
  const b = blocks.companyUnit[lang];
  for (const surface of ["parties", "pdfQuote", "pdfInvoice", "email"]) {
    const s = b[surface];
    const iName = s.indexOf(NAME);
    const iUnit = s.indexOf(UNIT);
    const iAfter = Math.min(...["lisa.hampel@pspc.example", "11 Laurier St"].map((x) => s.indexOf(x)).filter((i) => i >= 0));
    ok(`${lang} ${surface}: the unit is printed`, iUnit > -1);
    ok(`${lang} ${surface}: …after the name and before the contact lines`, iName > -1 && iName < iUnit && iUnit < iAfter, { iName, iUnit, iAfter });
    ok(`${lang} ${surface}: …once`, s.split(UNIT).length === 2);
  }
  ok(`${lang}: the /q page's facts carry it`, JSON.parse(b.facts).organizationUnit === UNIT, b.facts);
}
ok("French and English documents print the same words (never translated)",
  blocks.companyUnit.fr.pdfQuote.includes(UNIT) && blocks.companyUnit.en.pdfQuote.includes(UNIT));
ok("the invoice PDF mirrors the quote PDF's client panel",
  blocks.companyUnit.en.pdfInvoice.includes(UNIT) && blocks.companyUnit.en.pdfInvoice.indexOf(UNIT) > blocks.companyUnit.en.pdfInvoice.indexOf(NAME));
ok("an individual's /q facts are still the name alone", JSON.stringify(quotePageClientFacts(CLIENT_FIXTURES.individualStaleUnit)) === JSON.stringify({ name: "Marie Tremblay" }));
const shared = renderToStaticMarkup(<DocumentClientUnit client={CLIENT_FIXTURES.companyUnit} />);
ok("DocumentClientUnit (the invoice page's line) renders the unit", shared.includes(UNIT) && shared.includes("data-client-unit"));
ok("DocumentClientUnit renders NOTHING for an individual or a unit-less company",
  ["individual", "individualStaleUnit", "companyNoUnit", "companyBlankUnit"].every((f) => renderToStaticMarkup(<DocumentClientUnit client={CLIENT_FIXTURES[f]} />) === ""));

section("4. Long names wrap; hostile text is escaped");
{
  const l = blocks.companyLongUnit.en;
  for (const surface of ["parties", "pdfQuote", "pdfInvoice", "email"]) ok(`${surface}: the whole long name is there`, l[surface].includes(LONG_UNIT));
  ok("staff page / builder: the line wraps (break-words, no truncate)", /<p class="[^"]*break-words[^"]*" data-client-unit="true">/.test(l.parties) && !/data-client-unit[^>]*truncate/.test(l.parties));
  ok("email: the line wraps (overflow-wrap) and is not clipped", /overflow-wrap:anywhere;word-break:break-word;">Science and Parliamentary/.test(l.email) && !/white-space:nowrap|text-overflow/.test(l.email.split(LONG_UNIT)[0].slice(-200)));
  const pdfUnit = JSON.parse(l.pdfQuote);
  const texts = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.props) {
      if (n.props.children === LONG_UNIT) texts.push(n.props);
      walk(n.props.children);
    }
  };
  walk(pdfUnit);
  ok("PDF: the unit is one Text with no maxLines / ellipsis — react-pdf wraps it in the panel", texts.length === 1 && !("maxLines" in (texts[0].style || {})) && !("textOverflow" in (texts[0].style || {})), texts);
  const h = blocks.companyHostileUnit.en;
  ok("email: a hostile unit is escaped", !h.email.includes("<img") && h.email.includes("&lt;img"));
  ok("staff page: a hostile unit is escaped", !h.parties.includes("<img") && h.parties.includes("&lt;img"));
  ok("/q page: QuoteApproval prints the facts' unit with break-words",
    /quote\.client\?\.organizationUnit && \(\s*<p className="text-sm text-\[#2d2520\]\/70 break-words" data-client-unit>/.test(read("app/q/[token]/QuoteApproval.js")));
}

section("5. Contrast, measured across hostile brand colours");
for (const brand of BRANDS) {
  const t = documentTheme({ brandColor: brand });
  const r = contrastRatio(t.inkMutedOnWash, t.accentWash);
  ok(`${brand}: the unit's ink on the panel wash is ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, r);
  const b = renderClientBlocks({ languages: ["en"], brand }).companyUnit.en;
  ok(`${brand}: the PDF draws the unit in that measured ink`, b.pdfQuote.includes(`"color":"${t.inkMutedOnWash}","lineHeight":1.4,"marginBottom":1},"children":"${UNIT}"`));
  ok(`${brand}: the email draws it in the same ink on the same wash`,
    b.email.includes(`background:${t.accentWash}`) && b.email.includes(`color:${t.inkMutedOnWash};overflow-wrap:anywhere;word-break:break-word;">${UNIT}`));
}
{
  // /q: fixed colours, not the brand — #2d2520 at 70% over the white card.
  const mix = (a, b, alpha) => Math.round(a * alpha + b * (1 - alpha));
  const ink = [0x2d, 0x25, 0x20].map((c) => mix(c, 255, 0.7));
  const hex = `#${ink.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const r = contrastRatio(hex, "#ffffff");
  ok(`/q: the unit's ink (${hex}) on the white card is ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, r);
}

section("6. The page surfaces call the shared pieces");
{
  const inv = read("app/app/invoices/[id]/page.js");
  ok("invoice page: DocumentClientUnit right under the client's name",
    /\{invoice\.client\?\.name\}\s*<\/p>\s*\{\/\*[\s\S]{0,200}?\*\/\}\s*<DocumentClientUnit client=\{invoice\.client\} \/>/.test(inv));
  const parties = read("app/components/document/QuoteDocument.js");
  ok("DocumentParties: the unit right under the name (staff quote page, quote and invoice builders)",
    /\{client\?\.name\}<\/p>\s*<DocumentClientUnit client=\{client\} \/>/.test(parties));
  ok("the public quote select carries organizationUnit (the /q page and the signed PDF)",
    /select: \{ name: true, email: true, address: true, language: true, type: true, contactName: true, phone: true, organizationUnit: true \}/.test(read("app/api/public/quotes/[token]/route.js")));
  for (const f of ["lib/documentSections/ClientInfoSection.js", "lib/email/documentEmailLayout.js", "lib/quotes/gcSignup.js", "app/components/document/QuoteDocument.js"]) {
    ok(`${f} asks clientUnitLine (one rule)`, /clientUnitLine\(/.test(read(f)) && /from "@\/lib\/documents\/clientUnit"/.test(read(f)));
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
