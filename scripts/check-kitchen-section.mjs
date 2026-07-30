// scripts/check-kitchen-section.mjs
//
//   npm run check:section
//
// Whether the kitchen drawing appears on a document — which matters more than
// how it looks.
//
// Most quotes have no kitchen. A section that prints an empty box on every
// fence quote is worse than one nobody added, so the negative cases here
// outnumber the positive one deliberately.
//
// Source-level rather than rendered: the module imports @react-pdf, and dragging
// a font pipeline into a check script makes it slow and fragile, which makes it
// a check nobody runs. The rendering is covered by check:pdf, which produces a
// real PDF and reads the text back off the page.

import { readFileSync } from "node:fs";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};

// Re-implemented from source rather than imported: the module pulls in
// @react-pdf. Asserting the source still MATCHES is the guard against drift.
const src = readFileSync("lib/documentSections/KitchenPlanSection.js", "utf8");
ok(/export function designFrom/.test(src), "designFrom is exported for testing");
ok(/serviceType === "kitchen"/.test(src), "it checks the service type");
ok(/Array\.isArray\(d\.elements\) && d\.elements\.length/.test(src),
   "…AND that there are actually elements — a kitchen quote with an empty design draws nothing");
ok(/wrap=\{false\}/.test(src),
   "the block is wrap={false}: a drawing split across a page break is unreadable");
ok(/return "";/.test(src.slice(src.indexOf("renderEmailHtml"))),
   "renderEmailHtml returns nothing — Outlook drops complex SVG entirely, and a half-rendered drawing is worse than a line saying it's attached");
ok(!/\|\| "Kitchen plan"/.test(src),
   "no English fallback on the heading — the label exists in all six languages, and a fallback would hide a missing one");

const designFrom = (data) => {
  const d = data?.scopeDetails;
  return d?.serviceType === "kitchen" && Array.isArray(d.elements) && d.elements.length ? d : null;
};
for (const [label, data, want] of [
  ["a real kitchen", { scopeDetails:{ serviceType:"kitchen", elements:[{kind:"base"}] } }, true],
  ["no scopeDetails", {}, false],
  ["null data", null, false],
  ["null scopeDetails", { scopeDetails:null }, false],
  ["a roofing quote", { scopeDetails:{ serviceType:"roofing", elements:[{}] } }, false],
  ["a kitchen with no elements", { scopeDetails:{ serviceType:"kitchen", elements:[] } }, false],
  ["elements not an array", { scopeDetails:{ serviceType:"kitchen", elements:"nope" } }, false],
]) {
  ok(Boolean(designFrom(data)) === want, `${label} → ${want ? "draws" : "draws NOTHING"}`);
}

// Registered and described.
const reg = readFileSync("lib/documentSections/registry.js", "utf8");
const met = readFileSync("lib/documentSections/sectionMeta.js", "utf8");
ok(/kitchen_plan: kitchenPlan/.test(reg), "registered in SECTION_REGISTRY");
ok(/kitchen_plan: \{/.test(met), "described in SECTION_META — the registry asserts these stay in sync at import time");

// The label, in every language the product ships documents in.
const labels = readFileSync("lib/i18n/documentLabels.js", "utf8");
const n = (labels.match(/kitchenPlan:/g) || []).length;
ok(n === 6, `the heading is translated in all ${n} document languages`);

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
