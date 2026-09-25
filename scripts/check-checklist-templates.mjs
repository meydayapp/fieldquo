// scripts/check-checklist-templates.mjs
//
//   npm run check:checklist-templates
//
// The typed, per-trade checklist templates: the seeds, the item shape they
// write, what counts as answered, and the wiring that makes each piece do
// something. Runs with no database (db-stub-loader) so it can gate a deploy.
//
// What it exists to catch, in the order they would hurt:
//
//   * A seeded string missing any of the eight languages FieldQuo supports.
//     A crew member in Punjabi who gets one English line in a list of thirty
//     reads that as the one line nobody meant for them.
//   * A select with no options, a type outside the closed set, a seed key
//     used twice (the second install would be skipped as "already have it").
//   * Required items that do not gate the close, auto-add that nothing calls,
//     a route nothing fetches — the dead-control class, one per link.
//   * The normaliser changing a legacy list: bare strings must still come out
//     exactly as they did before typed items existed.
import { readFileSync } from "node:fs";
import {
  ALL_CHECKLIST_SEEDS,
  CHECKLIST_SEED_LANGUAGES,
  CHECKLIST_SEEDS_BY_FILE,
  checklistSeedsForTrade,
} from "@/app/data/checklistSeeds";
import { tradeKeys } from "@/lib/trades/catalog";
import { normalizeChecklistItems, ITEM_TYPE_TO_RESPONSE, SIGNATURE_MAX_CHARS } from "@/lib/jobs/checklistItems";
import {
  isAnswered,
  answerItem,
  unansweredRequired,
  itemsFromTemplate,
  localizeItem,
  optionLabel,
  groupByChecklist,
  describeMissing,
} from "@/lib/checklists/typedItems";
import { templateDataForSeed } from "@/lib/checklists/seedTemplates";

let pass = 0;
const failures = [];
const ok = (cond, label, detail) => {
  if (cond) {
    pass += 1;
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
};
const src = (p) => readFileSync(p, "utf8");

// ── 1. Every seed, every string, eight languages ─────────────────────────
console.log("Seeds");
const EIGHT = ["en", "fr", "es", "it", "de", "uk", "tl", "pa"];
ok(JSON.stringify([...CHECKLIST_SEED_LANGUAGES].sort()) === JSON.stringify([...EIGHT].sort()), "seed languages are exactly the eight FieldQuo supports");
const docLabels = src("lib/i18n/documentLabels.js");
for (const lang of EIGHT) ok(new RegExp(`\\n\\s*${lang}: \\{`).test(docLabels), `documentLabels.js carries ${lang} too`);

const TYPES = new Set(Object.keys(ITEM_TYPE_TO_RESPONSE));
const catalogue = new Set(tradeKeys());
const perLang = Object.fromEntries(EIGHT.map((l) => [l, 0]));
const seen = new Set();
let itemCount = 0;
const full = (obj, where) => {
  for (const lang of EIGHT) {
    const v = obj?.[lang];
    const good = typeof v === "string" && v.trim().length > 0;
    ok(good, `${where} has ${lang}`, good ? "" : JSON.stringify(obj?.en));
    if (good) perLang[lang] += 1;
  }
};
for (const seed of ALL_CHECKLIST_SEEDS) {
  const where = seed.seedKey;
  ok(/^fq\.cl\.[a-z_]+\.[a-z_]+$/.test(seed.seedKey), `${where}: seed key shape`);
  ok(!seen.has(seed.seedKey), `${where}: seed key unique`);
  seen.add(seed.seedKey);
  ok(["pre", "during", "post"].includes(seed.phase), `${where}: phase`);
  ok(seed.requiredToClose === false, `${where}: seeds never gate the close on their own`);
  ok(Array.isArray(seed.trades) && seed.trades.length > 0, `${where}: offered to a trade`);
  for (const key of seed.trades) ok(key === "*" || catalogue.has(key), `${where}: trade ${key} is in the catalogue`);
  for (const key of seed.autoAddFor) ok(seed.trades.includes(key), `${where}: auto-adds only for a trade it is offered to (${key})`);
  full(seed.name, `${where} name`);
  ok(seed.sections.length > 0, `${where}: has sections`);
  for (const section of seed.sections) {
    full(section.title, `${where} section "${section.title.en}"`);
    ok(section.items.length > 0, `${where} section "${section.title.en}" has items`);
    for (const item of section.items) {
      itemCount += 1;
      const at = `${where} "${item.label.en}"`;
      ok(TYPES.has(item.type), `${at}: type ${item.type} in the closed set`);
      ok(typeof item.required === "boolean", `${at}: required is a boolean`);
      full(item.label, at);
      if (item.type === "select" || item.type === "multiselect") {
        ok(Array.isArray(item.options?.en) && item.options.en.length >= 2, `${at}: a select has options`);
        for (const lang of EIGHT) {
          const list = item.options?.[lang];
          ok(Array.isArray(list) && list.length === item.options.en.length && list.every((o) => typeof o === "string" && o.trim()), `${at}: options in ${lang}, same count as English`);
        }
      } else {
        ok(!item.options, `${at}: only selects carry options`);
      }
    }
  }
}
const trades = Object.fromEntries(
  Object.entries(CHECKLIST_SEEDS_BY_FILE).map(([file, list]) => [file, { lists: list.length, items: list.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.items.length, 0), 0) }]),
);
console.log(`  ${ALL_CHECKLIST_SEEDS.length} checklists, ${itemCount} items`);
for (const [file, c] of Object.entries(trades)) console.log(`    ${file.padEnd(22)} ${String(c.lists).padStart(2)} lists ${String(c.items).padStart(3)} items`);
console.log(`  strings per language: ${EIGHT.map((l) => `${l} ${perLang[l]}`).join(" · ")}`);
ok(new Set(Object.values(perLang)).size === 1, "every language has the same number of strings");
ok(checklistSeedsForTrade("cabinet_refinishing").some((c) => c.seedKey === "fq.cl.cabinet_refinishing.painting"), "cabinet refinishing gets cabinet painting");
ok(checklistSeedsForTrade("interior_painting").some((c) => c.seedKey === "fq.cl.painting.job"), "interior painting gets the painting job list");
ok(checklistSeedsForTrade("some_trade_with_no_lists").length === 4, "a trade with no lists of its own still gets the four generic ones");

// ── 2. What the installer writes ─────────────────────────────────────────
console.log("Installer");
const painting = ALL_CHECKLIST_SEEDS.find((c) => c.seedKey === "fq.cl.painting.job");
const fr = templateDataForSeed(painting, { companyId: "c1", categoryId: "cat1", language: "fr" });
ok(fr.name === painting.name.fr, "the row is named in the company's language");
ok(fr.items[0].label === painting.sections[0].items[0].label.fr, "items are worded in the company's language");
ok(EIGHT.every((l) => fr.translations[l]?.name === painting.name[l]), "the name is carried in all eight languages");
ok(fr.items.every((i) => EIGHT.every((l) => typeof i.i18n?.[l]?.label === "string" && i.i18n[l].label)), "every item carries all eight languages, the row's own included");
ok(fr.items.length === painting.sections.reduce((n, s) => n + s.items.length, 0), "no item lost on install");
ok(fr.items.filter((i) => i.required).length === painting.sections.flatMap((s) => s.items).filter((i) => i.required).length, "required flags survive install");
ok(fr.items.some((i) => i.responseType === "stoplight") && fr.items.some((i) => i.responseType === "signature"), "types fold onto responseType");
ok(fr.categoryId === "cat1" && fr.seedKey === "fq.cl.painting.job" && fr.companyId === "c1", "row identity");
const generic = ALL_CHECKLIST_SEEDS.find((c) => c.trades.includes("*"));
ok(templateDataForSeed(generic, { companyId: "c1", categoryId: "cat1", language: "zz" }).categoryId === null, "generic lists belong to no trade");
ok(templateDataForSeed(generic, { companyId: "c1", categoryId: "cat1", language: "zz" }).name === generic.name.en, "an unseeded language falls back to English, never blank");

// ── 3. The normaliser, legacy and hostile ────────────────────────────────
console.log("Normaliser");
const legacy = ["mask the counters", { label: "photograph before" }, { text: "sweep" }];
ok(JSON.stringify(normalizeChecklistItems(legacy)) === JSON.stringify([
  { label: "mask the counters", done: false, phase: "during" },
  { label: "photograph before", done: false, phase: "during" },
  { label: "sweep", done: false, phase: "during" },
]), "a legacy list comes out exactly as before");
const typed = normalizeChecklistItems([
  { label: "a", type: "stoplight", required: true },
  { label: "b", type: "number" },
  { label: "c", type: "select", options: ["x", "", " y "] },
  { label: "d", type: "nonsense" },
  { label: "e", type: "check", responseType: "numeric" },
]);
ok(typed[0].responseType === "stoplight" && typed[0].required === true, "type → responseType, required kept");
ok(typed[1].responseType === "numeric", "number → numeric");
ok(JSON.stringify(typed[2].options) === '["x","y"]', "blank options dropped, trimmed");
ok(!("responseType" in typed[3]), "an unknown type is a tick");
ok(typed[4].responseType === "numeric", "an explicit responseType wins over type");
const png = "data:image/png;base64,iVBORw0KGgo=";
const kept = normalizeChecklistItems([
  { label: "s", responseType: "signature", response: { dataUrl: png, name: " Ann ", signedAt: "2026-09-24T10:00:00Z" } },
  { label: "s2", responseType: "signature", response: { dataUrl: "javascript:alert(1)" } },
  { label: "s3", responseType: "signature", response: { dataUrl: "data:image/png;base64," + "A".repeat(SIGNATURE_MAX_CHARS) } },
  { label: "m", responseType: "multi_select", response: ["a", "a", "", 3] },
  { label: "n", responseType: "numeric", response: Infinity },
  { label: "i", i18n: { fr: { label: "fr", junk: 1 }, xx: { label: "no" }, es: { label: 5 } } },
], { keepDone: true });
ok(kept[0].response?.dataUrl === png && kept[0].response.name === "Ann", "a signature image is kept");
ok(!("response" in kept[1]), "a non-image signature is dropped");
ok(!("response" in kept[2]), "an oversized signature is dropped");
ok(JSON.stringify(kept[3].response) === '["a","3"]' || JSON.stringify(kept[3].response) === '["a"]', "multi-select answers deduped and cleaned");
ok(!("response" in kept[4]), "a non-finite number is not an answer");
ok(JSON.stringify(kept[5].i18n) === '{"fr":{"label":"fr"}}', "i18n keeps known languages and strings only");
ok(!("response" in normalizeChecklistItems([{ label: "x", response: "old" }])[0]), "a template copy drops last week's answers");

// ── 4. Answers, required, the close message ──────────────────────────────
console.log("Answers");
ok(!isAnswered({ responseType: "stoplight", response: "blue" }) && isAnswered({ responseType: "stoplight", response: "amber" }), "stop-light takes only green/amber/red");
ok(isAnswered({ responseType: "numeric", response: 0 }), "zero is a reading");
ok(!isAnswered({ responseType: "text", response: "   " }), "whitespace is not an answer");
ok(isAnswered({ responseType: "photo", media: [{ kind: "photo", url: "u" }] }) && !isAnswered({ responseType: "photo", media: [{ kind: "file", url: "u" }] }), "a photo item needs a photo");
ok(isAnswered({ done: true }) && !isAnswered({ done: false }), "a tick is its tick");
ok(isAnswered({ responseType: "pass_fail_na", done: true }), "legacy answer types still count as ticks");
ok(answerItem({ responseType: "text" }, { response: "hi" }).done === true && answerItem({ responseType: "text", response: "hi", done: true }, { response: "" }).done === false, "answering sets done; clearing unsets it");
const miss = unansweredRequired(
  [{ label: "A", required: true, responseType: "stoplight" }, { label: "B", required: true, done: true }, { label: "C" }],
  null,
  [{ label: "D", required: true, responseType: "signature", checklist: "Paint" }],
);
ok(miss.map((m) => m.label).join() === "A,D", "required and empty, across the job and its visits");
ok(describeMissing(miss) === "A; Paint — D", "the refusal names what is missing");
ok(describeMissing(Array.from({ length: 8 }, (_, i) => ({ label: `x${i}` })), 5).endsWith("(and 3 more)"), "a long list is capped with a count");

// ── 5. Copy onto a job, read in the viewer's language ─────────────────────
console.log("Copy and read");
const tpl = { id: "t1", name: "Painting", phase: "during", requiredToClose: false, translations: { pa: { name: "ਪੇਂਟਿੰਗ" } }, items: fr.items };
const copy = itemsFromTemplate(tpl, "fr");
ok(copy.every((i) => i.templateId === "t1" && i.checklist === "Painting"), "the copy names its list");
ok(copy.every((i) => EIGHT.every((l) => i.i18n?.[l]?.label)), "the copy carries every language");
ok(copy[0].i18n.pa.checklist === "ਪੇਂਟਿੰਗ", "the list's name rides along per language");
ok(localizeItem(copy[0], "pa").label === painting.sections[0].items[0].label.pa, "a Punjabi viewer reads Punjabi");
ok(localizeItem({ label: "row", i18n: { en: { label: "english" } } }, "zh").label === "english", "a missing language falls back to English");
ok(localizeItem({ label: "row" }, "pa").label === "row", "a legacy item reads as written");
ok(itemsFromTemplate({ ...tpl, requiredToClose: true }, "en").every((i) => i.required), "requiredToClose marks every copied item required");
const sel = { options: ["Copper", "Aluminium"], i18n: { fr: { options: ["Cuivre", "Aluminium"] }, de: { options: ["only one"] } } };
ok(optionLabel(sel, "Copper", "fr") === "Cuivre", "an answer is shown in the viewer's language");
ok(localizeItem(sel, "de").options[0] === "Copper", "a mis-sized option translation is ignored, not misaligned");
ok(groupByChecklist([...copy, { label: "own", checklist: "Other" }]).length === 2, "two lists on a job are two forms");

// ── 6. Wiring: every piece has a caller ──────────────────────────────────
console.log("Wiring");
const jobRoute = src("app/api/jobs/[id]/route.js");
ok(jobRoute.includes("unansweredRequired(") && jobRoute.includes("checklist_incomplete") && /status: 409/.test(jobRoute), "closing a job checks required items");
ok(src("lib/jobs/createJob.js").includes("attachAutoChecklists(") && src("lib/jobs/createJobFromQuote.js").includes("attachAutoChecklists("), "both job-creation paths auto-attach");
ok(src("lib/products/seedServices.js").includes("seedChecklistTemplatesForTrade("), "seeding a trade seeds its checklists");
ok(src("app/components/checklists/JobChecklist.js").includes("/checklist`"), "the job checklist route has a caller");
ok(src("app/app/settings/checklists/page.js").includes("/api/settings/checklists/seed"), "the install route has a caller");
ok(src("app/app/jobs/[id]/JobDetail.js").includes("<JobChecklist"), "the job page draws the job checklist");
const settingsRoute = src("app/api/settings/checklists/route.js");
ok(["requiredToClose", "autoAddFor", "translations"].every((f) => settingsRoute.includes(`${f}:`)), "the settings route writes every new template field");
ok(src("lib/checklists/autoAdd.js").includes("autoAddFor: { hasSome"), "autoAddFor is read");
ok(src("prisma/schema.prisma").includes("@@unique([companyId, seedKey])"), "seed key is unique per company");

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
