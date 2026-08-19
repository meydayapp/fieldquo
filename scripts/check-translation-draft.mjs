// scripts/check-translation-draft.mjs
//
// The "Draft the missing ones" button on /app/settings/translations.
//
//   npm run check:translation-draft
//
// Three things are worth holding still here, and only one of them is testable
// by reading:
//
//   1. The AGENTS.md rule-6 boundary. Translating a company's own CATALOGUE in
//      a settings screen is allowed; translating a DOCUMENT is not. The draft
//      path must never touch a Quote, Invoice or PDF, and must never write a
//      translation to the database on its own — the review step is what makes
//      the whole thing legitimate.
//   2. The metering contract. Every model call is quota-checked before and
//      recorded after, and only lib/ai/provider.js constructs a vendor client.
//   3. What the sanitiser does with a reply that isn't the reply it asked for.
//      This one is EXECUTED, not read. A translation landing on the wrong
//      product is a wrong trade term on a homeowner's quote.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyDraftBatch } from "../lib/i18n/translateContent.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// These files talk ABOUT the rules they follow, at length and on purpose. A
// grep for "reviewed: true" therefore hits the prose explaining why only the
// PATCH may write it. Strip comments before asserting on behaviour.
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const route = read("app/api/settings/translations/draft/route.js");
const lib = read("lib/i18n/translateContent.js");
const page = read("app/app/settings/translations/page.js");
const listRoute = read("app/api/settings/translations/route.js");

// ── 1. The rule-6 boundary ─────────────────────────────────────────────────
console.log("\nAGENTS.md non-negotiable 6 — documents keep their language\n");

ok(
  "the draft route never reads or writes a quote, invoice or PDF",
  !/db\.(quote|invoice)\b|pdfUrl/.test(route),
);
ok(
  "the draft route writes NOTHING — no update, upsert or create",
  !/db\.\w+\.(update|upsert|create|updateMany|createMany|delete)\b/.test(route),
  "a machine draft in the database is indistinguishable from a checked one",
);
ok(
  "saving still goes through the PATCH that stamps reviewed:true",
  /reviewed: true/.test(listRoute) &&
    /method: "PATCH"/.test(page) &&
    // The phrase appears in the draft route's prose explaining the rule; what
    // must not appear is the stamp itself in executable code.
    !/reviewed/.test(code(route)),
);
ok(
  "the boundary is written down where the next person will read it",
  /non-negotiable 6/i.test(lib) && /non-negotiable 6/i.test(route),
);

// ── 2. The metering contract ───────────────────────────────────────────────
console.log("\nMetering\n");

ok("no vendor client outside lib/ai/provider.js", !/from "openai"|new OpenAI\(/.test(lib + route));
ok("the draft path goes through complete()", /from "@\/lib\/ai\/provider"/.test(lib));
ok("quota is checked BEFORE the run", /checkAiQuota\(member\.companyId\)/.test(route));

const quotaIndex = route.indexOf("checkAiQuota");
const draftIndex = route.indexOf("draftProductTranslations(");
ok("…and the check precedes the call, not follows it", quotaIndex > -1 && quotaIndex < draftIndex);

ok("usage is recorded AFTER, per call", /recordAiUsage\(/.test(route) && /onUsage/.test(route));
ok(
  'the spend is attributed to a feature the schema knows ("translation")',
  /feature: "translation"/.test(route) &&
    /"translation"/.test(read("prisma/schema.prisma")),
);
ok(
  "quota is re-checked between batches, so a long run can't overrun the cap",
  /shouldContinue/.test(route) && /shouldContinue/.test(lib),
);

// ── 3. Honest controls ─────────────────────────────────────────────────────
console.log("\nControls that tell the truth\n");

ok("the list route reports whether AI is configured at all", /aiAvailable: isAiConfigured\(\)/.test(listRoute));
ok("the page hides the button when it isn't", /data\?\.aiAvailable && data\?\.canDraft && \(/.test(page));
ok("…and says why instead of rendering a dead button", /draftUnavailable/.test(page));
ok("the route refuses with 503 and a sentence when the key is missing", /aiUnavailable: true/.test(route) && /503/.test(route));
ok("the route refuses with 429 and the quota's own reason", /quotaExceeded: true/.test(route) && /429/.test(route));
ok("drafting is owner/admin only — it spends the company's allowance", /isAdmin\(member\.role\)/.test(route));
ok("partial failure is counted and shown, not swallowed", /draftFailedSome/.test(page) && /failed:/.test(route));
ok("running out of allowance mid-run is shown separately", /draftStopped/.test(page) && /stopped:/.test(route));
ok("machine-filled boxes are marked until saved", /machineFilled/.test(page) && /machineDraft/.test(page));
ok(
  "the mark is cleared on save, and only on save",
  /stillDrafts\.delete\(item\.id\)/.test(page),
);
ok(
  "a save's reload preserves everyone else's unsaved drafts",
  /preserveIds/.test(page) && /await load\(stillDrafts\)/.test(page),
);
ok(
  "already-reviewed rows are never re-drafted over",
  /const pending = products\.filter/.test(route) && /entry\?\.name/.test(route),
);

// ── 4. The sanitiser, executed ─────────────────────────────────────────────
console.log("\napplyDraftBatch on replies a model actually produces\n");

const BATCH = [
  { id: "p1", name: "Trim", description: "Baseboards and casings" },
  { id: "p2", name: "Second coat" },
  { id: "p3", name: "Rough-in", description: "First fix" },
];

function drafted(parsed, batch = BATCH) {
  return applyDraftBatch(batch, parsed);
}

let r = drafted(null);
ok("null reply → every id failed, nothing drafted", r.failedIds.length === 3 && Object.keys(r.drafts).length === 0);

r = drafted("the model wrote prose instead");
ok("prose instead of JSON → every id failed", r.failedIds.length === 3);

r = drafted({ items: [{ i: 0, name: "Moulures" }] });
ok("an {items:[…]} wrapper is accepted", r.drafts.p1?.name === "Moulures");

r = drafted([{ i: 1, name: "Deuxième couche" }]);
ok("a short reply drafts what came back…", r.drafts.p2?.name === "Deuxième couche");
ok("…and fails the rest by id rather than leaving them blank", r.failedIds.sort().join(",") === "p1,p3");

r = drafted([{ i: 9, name: "Nowhere" }, { i: -1, name: "Also nowhere" }]);
ok("an index outside the batch is dropped, not applied to a neighbour", Object.keys(r.drafts).length === 0);

r = drafted([{ i: "1", name: "Coerced index" }]);
ok('a numeric string index ("1") is still index 1', r.drafts.p2?.name === "Coerced index");

r = drafted([{ i: 1.5, name: "Fractional" }]);
ok("a fractional index is dropped rather than rounded onto a product", !r.drafts.p2);

r = drafted([{ i: 0, name: "First" }, { i: 0, name: "Second" }]);
ok("a repeated index takes the first, never silently the last", r.drafts.p1?.name === "First");

r = drafted([{ i: 0, name: 3 }, { i: 1, name: null }, { i: 2, name: ["a"] }]);
ok("a non-string name is a failure, not a coerced String(3)", r.failedIds.length === 3 && Object.keys(r.drafts).length === 0);

r = drafted([{ i: 0, name: "   " }]);
ok("a whitespace-only name is a failure — it would read as 'still missing'", r.failedIds.includes("p1"));

r = drafted([{ i: 0, name: "  Moulures  ", description: "  Plinthes  " }]);
ok("values are trimmed", r.drafts.p1.name === "Moulures" && r.drafts.p1.description === "Plinthes");

r = drafted([{ i: 1, name: "Deuxième couche", description: "Invented prose" }]);
ok(
  "a description is NOT invented for a product that never had one",
  r.drafts.p2.description === "",
);

r = drafted([{ i: 0, name: "Moulures" }]);
ok(
  "a missing description on a product that HAS one comes back empty, not fabricated",
  r.drafts.p1.description === "",
);

r = drafted([{ i: 0, name: "Moulures" }], null);
ok("a null batch doesn't throw", r.failedIds.length === 0 && Object.keys(r.drafts).length === 0);

r = drafted([{ i: 0, name: "x" }], []);
ok("an empty batch drafts nothing and fails nothing", r.failedIds.length === 0 && Object.keys(r.drafts).length === 0);

r = drafted([null, undefined, { i: 0, name: "Moulures" }]);
ok("null rows among good ones are skipped, not fatal", r.drafts.p1?.name === "Moulures");

// The one that would be worst in production: a reply whose rows are in a
// different order than they were sent. Index-keyed, so order is irrelevant.
r = drafted([
  { i: 2, name: "Pré-installation" },
  { i: 0, name: "Moulures" },
  { i: 1, name: "Deuxième couche" },
]);
ok(
  "out-of-order rows land on the right products",
  r.drafts.p1.name === "Moulures" &&
    r.drafts.p2.name === "Deuxième couche" &&
    r.drafts.p3.name === "Pré-installation",
);

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
if (failures) process.exitCode = 1;
