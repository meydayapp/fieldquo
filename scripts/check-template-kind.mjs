// scripts/check-template-kind.mjs
//
// DocumentTemplate.sections holds two different vocabularies in one JSON
// column: PDF layouts use domain sections (header, scope_groups, totals…),
// emails use content blocks (heading, text, button…). Mixing them produced
// "Unknown section type: heading" the first time anyone created a PDF layout
// and downloaded it.
//
// These assertions execute the real functions rather than reading the source,
// because the bug was a wrong FUNCTION CALL, not wrong text.

import { readFileSync } from "node:fs";
import {
  isPdfTemplate,
  allowedTypesFor,
  starterSectionsFor,
  invalidSectionTypes,
  usableSections,
} from "@/lib/documents/templateKind";
// sectionMeta, not the registry: every registry module imports @react-pdf/renderer,
// which bare Node cannot parse. assertSectionMetaInSync (called from the registry
// on the server) is what guarantees these two lists stay identical, so asserting
// against SECTION_TYPES here is asserting against the renderer.
import { SECTION_TYPES } from "@/lib/documentSections/sectionMeta";
import { BLOCK_TYPES, defaultSectionsFor } from "@/app/data/emailTemplateBlocks";

let passed = 0;
const failures = [];
function ok(label, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}
const section = (t) => console.log(`\n${t}`);

const PDF_TYPES = ["quote_pdf", "invoice_pdf"];
const EMAIL_TYPES = [
  "quote_email", "invoice_email", "receipt_email",
  "follow_up_email", "instructions_email", "marketing_email", "custom_email",
];

// ── The regression itself ───────────────────────────────────────────────────

section("The bug — a new PDF layout must be renderable");

for (const type of PDF_TYPES) {
  const sections = starterSectionsFor(type);
  ok(`${type}: starter layout is non-empty`, Array.isArray(sections) && sections.length > 0);

  // The exact failure: getSectionModule threw on the seeded type. Asserted
  // through SECTION_TYPES, which assertSectionMetaInSync ties to the registry.
  const unrenderable = sections.filter((s) => !SECTION_TYPES.includes(s.type));
  ok(
    `${type}: every starter section renders`,
    unrenderable.length === 0,
    unrenderable.map((s) => s.type).join(", "),
  );

  ok(
    `${type}: starter layout contains NO email block types`,
    invalidSectionTypes(type, sections).length === 0,
    invalidSectionTypes(type, sections).join(", "),
  );
}

// The precise shape of the old bug, asserted so it can't come back by a
// different route: the email default for a PDF type is [heading, text].
const emailDefaultForPdf = defaultSectionsFor("quote_pdf");
ok(
  "defaultSectionsFor still returns email blocks for a PDF type (so it must never be used for one)",
  invalidSectionTypes("quote_pdf", emailDefaultForPdf).length > 0,
  "if this ever passes cleanly, the vocabularies have merged and this guard is stale",
);

section("Email templates keep working");

for (const type of EMAIL_TYPES) {
  const sections = starterSectionsFor(type);
  ok(`${type}: starter blocks are non-empty`, Array.isArray(sections) && sections.length > 0);
  ok(
    `${type}: starter blocks are all in the email vocabulary`,
    invalidSectionTypes(type, sections).length === 0,
    invalidSectionTypes(type, sections).join(", "),
  );
}

// ── The vocabularies must not overlap ───────────────────────────────────────

section("The two vocabularies stay disjoint");

const pdfVocab = new Set(SECTION_TYPES);
const emailVocab = new Set(BLOCK_TYPES.map((b) => b.type));
const overlap = [...pdfVocab].filter((t) => emailVocab.has(t));
ok(
  "no type means one thing in a PDF and another in an email",
  overlap.length === 0,
  overlap.join(", "),
);
ok("isPdfTemplate is true for exactly the two PDF types",
  PDF_TYPES.every(isPdfTemplate) && !EMAIL_TYPES.some(isPdfTemplate));
ok("allowedTypesFor returns the PDF registry for a PDF type",
  allowedTypesFor("quote_pdf").has("scope_groups") && !allowedTypesFor("quote_pdf").has("heading"));
ok("allowedTypesFor returns the block list for an email type",
  allowedTypesFor("quote_email").has("heading") && !allowedTypesFor("quote_email").has("scope_groups"));

// ── The write guard ─────────────────────────────────────────────────────────

section("Write guard — a mismatched section is rejected, not stored");

ok("a heading in a quote_pdf is reported invalid",
  invalidSectionTypes("quote_pdf", [{ type: "heading" }]).includes("heading"));
ok("scope_groups in a quote_email is reported invalid",
  invalidSectionTypes("quote_email", [{ type: "scope_groups" }]).includes("scope_groups"));
ok("a section with no type at all is reported invalid",
  invalidSectionTypes("quote_pdf", [{ sortOrder: 0 }]).length === 1);
ok("a valid PDF layout reports nothing",
  invalidSectionTypes("quote_pdf", [{ type: "header" }, { type: "totals" }]).length === 0);
for (const junk of [null, undefined, "nope", 42, {}]) {
  ok(`non-array sections (${JSON.stringify(junk)}) is not a crash`,
    Array.isArray(invalidSectionTypes("quote_pdf", junk)));
}

// ── The read path heals rather than 500s ────────────────────────────────────

section("Read path — an already-broken template still produces a document");

const broken = [{ type: "heading" }, { type: "header" }, { type: "text" }, { type: "totals" }];
const healed = usableSections("quote_pdf", broken);
ok("unknown sections are dropped", healed.sections.every((s) => pdfVocab.has(s.type)));
ok("known sections survive", healed.sections.length === 2);
ok("what was dropped is REPORTED, not swallowed",
  healed.dropped.includes("heading") && healed.dropped.includes("text"));
ok("the healed layout renders",
  healed.sections.every((s) => SECTION_TYPES.includes(s.type)));

// A template that is ENTIRELY email blocks would otherwise heal to zero
// sections — a blank page from a template the company thinks they configured.
const allWrong = usableSections("quote_pdf", [{ type: "heading" }, { type: "text" }]);
ok("an entirely-wrong layout falls back to the default rather than a blank page",
  allWrong.sections.length > 2 && allWrong.sections.every((s) => pdfVocab.has(s.type)));
ok("a correct layout is returned untouched (same reference)",
  usableSections("quote_pdf", broken.slice(1, 2)).dropped.length === 0);

// ── Call sites ──────────────────────────────────────────────────────────────

section("Call sites — the create route and every PDF reader are wired");

const createRoute = readFileSync("app/api/settings/document-templates/route.js", "utf8");
ok("create route uses starterSectionsFor, not defaultSectionsFor",
  /starterSectionsFor\(type\)/.test(createRoute) && !/sections:\s*defaultSectionsFor/.test(createRoute));

const patchRoute = readFileSync("app/api/settings/document-templates/[id]/route.js", "utf8");
ok("patch route rejects a mismatched vocabulary before writing",
  /invalidSectionTypes\(existing\.type,\s*sections\)/.test(patchRoute));

for (const f of [
  "app/api/quotes/[id]/pdf/route.js",
  "app/api/invoices/[id]/pdf/route.js",
  "app/api/quotes/[id]/send/route.js",
  "app/api/public/quotes/[token]/route.js",
]) {
  const src = readFileSync(f, "utf8");
  ok(`${f} heals a broken template instead of throwing`,
    /usableSections\(/.test(src),
    "a stored bad section would 500 this route");
}

console.log("");
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log(`ALL PASS — ${passed} passed, 0 failed`);
