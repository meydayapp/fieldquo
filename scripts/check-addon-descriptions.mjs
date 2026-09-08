// scripts/check-addon-descriptions.mjs
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-addon-descriptions.mjs
//
// Every default add-on says what it is — and the sentence actually reaches
// the line, the document, and the review.
//
// ── The owner's report, and what was true ──────────────────────────────────
//
// "The AI review thinks soft-close hinges, two-tone and the handle holes are
// empty." They were. Three separate paths put a standard add-on on a quote
// and all three dropped or never had the scope sentence:
//
//   1. Products & Services picker — copied name, unit, price; not description.
//   2. "Common for this trade" chips — the catalogue had no sentence to copy.
//   3. Cabinet upgrades priced off the rate card — emitted with no `detail`.
//
// The review is shown name + detail on purpose (lib/ai/quoteReview.js), so a
// line with nothing under it was reported as a line with nothing under it.
//
// ── What is executed here, not read ────────────────────────────────────────
//
//   A. Every catalogue entry carries a sentence: ≥ 20 chars, no "$".
//   B. The copy-on-create rule, against fixtures: empty → copied; typed →
//      untouched; a stored line is never rewritten.
//   C. The three paths above, each producing a line with a detail — and the
//      builder source calling the helper rather than a copy of it.
//   D. Seeding stores the sentence and the French; the backfill planner fills
//      only blanks; the script is dry unless told --apply.
//   E. The review payload carries `detail`, and a line still without one is
//      named as "no description" by the completeness check.
//   F. The PAID pill: three states from facts, the cost inside the label, and
//      every class pair measured ≥ 4.5:1 against the real Tailwind palette.

import { readFileSync } from "node:fs";

import { STANDARD_ADDONS } from "@/app/data/standardAddOns";
import { STANDARD_ADDONS_FR, standardAddOnTranslations } from "@/app/data/standardAddOns.fr";
import { DEFAULT_LINE_ITEMS } from "@/app/data/defaultLineItems";
import { ELECTRICAL_LINE_DETAILS, ELECTRICAL_LINE_ITEMS } from "@/app/data/electricalCatalog";
import { PLUMBING_LINE_DETAILS, PLUMBING_LINE_ITEMS } from "@/app/data/plumbingCatalog";
import { detailForNewLine, lineFromProduct, lineFromSuggestion } from "@/lib/quotes/lineDetail";
import { lineItemsFromStored, scopeGroupPayload } from "@/lib/quotes/builderPayload";
import { cabinetAddOnLines } from "@/lib/pricing/tradeScope";
import { planStandardAddOns, planDescriptionBackfill } from "@/lib/products/seedStandardAddOns";
import { completenessChecks } from "@/lib/quotes/completeness";
import { resolveProductText } from "@/lib/i18n/translateContent";
import { VISION_PILL_CLASSES, visionPillState } from "@/lib/ai/visionPill";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)?.slice(0, 300)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const goodSentence = (s) => typeof s === "string" && s.trim().length >= 20 && !s.includes("$");
// Words that do not occur in French prose; a French entry that contains one
// was pasted from the English column.
const english = /\b(the|and|with|your|per door|each)\b/i;

// ═══════════════════════════════════════════════════════════════════════════
section("A. Every catalogue entry carries a scope sentence");

{
  const entries = Object.entries(STANDARD_ADDONS).flatMap(([cat, list]) => list.map((a) => ({ cat, ...a })));
  const bad = entries.filter((a) => !goodSentence(a.description));
  ok(entries.length >= 25, `STANDARD_ADDONS has entries (${entries.length})`);
  ok(bad.length === 0, "every standard add-on has a description ≥ 20 chars with no $", bad.map((b) => `${b.cat}:${b.name}`));
}
{
  const entries = Object.entries(DEFAULT_LINE_ITEMS).flatMap(([cat, list]) => list.map((a) => ({ cat, ...a })));
  const bad = entries.filter((a) => !goodSentence(a.detail));
  ok(entries.length >= 200, `DEFAULT_LINE_ITEMS has entries across every trade incl. electrical + plumbing (${entries.length})`);
  ok(bad.length === 0, "every default line item has a `detail` ≥ 20 chars with no $", bad.map((b) => `${b.cat}:${b.description}`));
  ok(entries.every((a) => typeof a.description === "string" && a.description.trim()), "…and still a name under `description`");
  ok(
    entries.every((a) => a.detail.trim().toLowerCase() !== a.description.trim().toLowerCase()),
    "…and the sentence is not the name restated",
  );
}
{
  const eKeys = ELECTRICAL_LINE_ITEMS.map((i) => i.key);
  const dKeys = Object.keys(ELECTRICAL_LINE_DETAILS);
  ok(eKeys.every((k) => dKeys.includes(k)), "electrical: every line has a keyed detail", eKeys.filter((k) => !dKeys.includes(k)));
  ok(dKeys.every((k) => eKeys.includes(k)), "electrical: every detail points at a real line", dKeys.filter((k) => !eKeys.includes(k)));
  const pKeys = PLUMBING_LINE_ITEMS.map((i) => i.key);
  const pdKeys = Object.keys(PLUMBING_LINE_DETAILS);
  ok(pKeys.every((k) => pdKeys.includes(k)), "plumbing: every line has a keyed detail", pKeys.filter((k) => !pdKeys.includes(k)));
  ok(pdKeys.every((k) => pKeys.includes(k)), "plumbing: every detail points at a real line", pdKeys.filter((k) => !pKeys.includes(k)));
}
{
  const names = [...new Set(Object.values(STANDARD_ADDONS).flat().map((a) => a.name))];
  const missing = names.filter((n) => !STANDARD_ADDONS_FR[n]);
  ok(missing.length === 0, "every standard add-on name has a French entry", missing);
  const badFr = Object.entries(STANDARD_ADDONS_FR).filter(
    ([, v]) => !goodSentence(v.description) || !v.name || english.test(v.description) || english.test(v.name),
  );
  ok(badFr.length === 0, "…each with a French name and a French sentence ≥ 20 chars, no $", badFr.map(([k]) => k));
  const stale = Object.keys(STANDARD_ADDONS_FR).filter((k) => !names.includes(k));
  ok(stale.length === 0, "…and no French entry for a name that no longer exists", stale);
  ok(
    standardAddOnTranslations("Soft-Close Hinges")?.fr?.description?.length > 20 && standardAddOnTranslations("nope") === null,
    "standardAddOnTranslations: {fr} for a known name, null for an unknown one",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("B. The copy-on-create rule");

ok(detailForNewLine("", "From the catalogue.") === "From the catalogue.", "empty own detail → the catalogue sentence is copied");
ok(detailForNewLine("   ", "From the catalogue.") === "From the catalogue.", "whitespace-only own detail counts as empty");
ok(detailForNewLine("Typed by the estimator.", "From the catalogue.") === "Typed by the estimator.", "typed own detail → untouched, catalogue ignored");
ok(detailForNewLine(null, undefined) === "", "nothing on either side → empty string, not 'undefined'");

{
  // Existing quotes are not rewritten: a stored line without a detail comes
  // back without one. The hydrate path knows nothing about catalogues.
  const stored = lineItemsFromStored([{ description: "Soft-Close Hinges", quantity: 24, amount: 840 }]);
  ok(!("detail" in stored[0]) || !stored[0].detail, "lineItemsFromStored leaves a stored line's missing detail missing");
  const src = read("lib/quotes/builderPayload.js");
  ok(!/lineDetail/.test(src), "…and builderPayload's hydrate path never imports the copy rule");
  // A persisted cabinet group is not re-derived either, so its lines cannot
  // acquire a detail on re-save.
  const persisted = scopeGroupPayload(
    { persisted: true, categoryKey: "cabinet_refinishing", label: "Cabinet Refinishing", lineItems: [{ description: "Soft-close hinges", quantity: 24, rate: 35, amount: 840 }], intakeValues: { doorCount: 24 }, softCloseHinges: true },
    null,
    "fr",
  );
  ok(persisted.lineItems.length === 1 && !persisted.lineItems[0].detail, "a persisted group is never re-derived, so an old line keeps saying what it said");
}

// ═══════════════════════════════════════════════════════════════════════════
section("C. The three paths, each producing a line with a detail");

{
  const product = {
    name: "Soft-Close Hinges",
    description: "Install soft-close hinges, per door.",
    unitPrice: 35,
    unit: "door",
    translations: { fr: { name: "Charnières à fermeture douce", description: "Pose de charnières à fermeture douce, par porte." } },
  };
  const en = lineFromProduct(product, { language: "en", defaultLanguage: "en" });
  ok(en.description === "Soft-Close Hinges" && en.unit === "door" && en.rate === 35 && en.amount === 35, "picker: name, unit, rate, amount copied as before", en);
  ok(en.detail === "Install soft-close hinges, per door.", "picker: the product's description reaches the line's detail", en);
  const fr = lineFromProduct(product, { language: "fr", defaultLanguage: "en" });
  ok(fr.description === "Charnières à fermeture douce" && fr.detail === "Pose de charnières à fermeture douce, par porte.", "picker: a French quote gets the French name AND sentence", fr);
  const noFr = lineFromProduct({ ...product, translations: null }, { language: "fr", defaultLanguage: "en" });
  ok(noFr.description === "Soft-Close Hinges" && noFr.detail === product.description, "picker: no translation → the source text, never a blank line", noFr);
  const bare = lineFromProduct({ name: "Rush Fee", unitPrice: 50 }, {});
  ok(bare.description === "Rush Fee" && !("detail" in bare), "picker: a product with no description carries no `detail` key at all", bare);
  ok(resolveProductText(product, "fr", "en").description.startsWith("Pose"), "…via resolveProductText, which had no caller before this");
}
{
  const chip = DEFAULT_LINE_ITEMS.cabinet_refinishing.find((s) => /handle holes/i.test(s.description));
  const line = lineFromSuggestion(chip);
  ok(line.description === chip.description && line.rate === 0 && line.amount === 0, "chip: name copied, rate deliberately 0", line);
  ok(line.detail === chip.detail && goodSentence(line.detail), "chip: the catalogue's detail reaches the line", line);
  const keyed = lineFromSuggestion(ELECTRICAL_LINE_ITEMS[0]);
  ok(keyed.catalogKey === ELECTRICAL_LINE_ITEMS[0].key && goodSentence(keyed.detail), "chip: a keyed (electrical) line keeps its catalogKey and gets its detail", keyed);
}
{
  const book = { addOns: { handleHolesPerDoor: 12, softCloseHingesPerDoor: 35, drawerSlidesPerDrawer: 45, twoToneFlat: 600, twoTonePerUnit: 0, threeToneFlat: 900, threeTonePerUnit: 0 } };
  const cfg = { doors: 10, drawers: 4, handleHoles: true, softCloseHinges: true, drawerSlides: true, twoTone: true };
  const en = cabinetAddOnLines({ ...cfg, language: "en" }, book);
  ok(en.length === 4, "cabinet: four upgrade lines", en.map((l) => l.description));
  ok(en.every((l) => goodSentence(l.detail)), "cabinet: every upgrade line carries a detail", en.map((l) => l.detail));
  ok(/14 pieces/.test(en.find((l) => /two-tone/i.test(l.description)).detail), "cabinet: two-tone says how many pieces");
  const noCount = cabinetAddOnLines({ doors: 0, drawers: 0, twoTone: true, addOnUnits: { tone: 0 } }, book);
  ok(noCount.length === 1 && goodSentence(noCount[0].detail), "cabinet: two-tone with no count still says what it is (used to vanish)", noCount);
  const fr = cabinetAddOnLines({ ...cfg, language: "fr-CA" }, book);
  ok(fr.every((l) => !english.test(l.detail) && !english.test(l.description)), "cabinet: a French quote gets French names and sentences", fr.map((l) => `${l.description} / ${l.detail}`));
  ok(fr.map((l) => l.amount).join() === en.map((l) => l.amount).join(), "cabinet: language changes words, never money");
  const none = cabinetAddOnLines(cfg, book);
  ok(none.map((l) => l.detail).join() === en.map((l) => l.detail).join(), "cabinet: no language → English");
  const three = cabinetAddOnLines({ doors: 2, drawers: 0, threeTone: true }, book);
  ok(/Third colour across 2 pieces/.test(three[0].detail), "cabinet: three-tone sentence carries its count too");
}
{
  const src = read("app/components/quotes/builder/QuoteBuilder.js");
  ok(/import \{ lineFromProduct, lineFromSuggestion \} from "@\/lib\/quotes\/lineDetail"/.test(src), "builder imports the helper");
  ok(/lineFromProduct\(product, \{\s*language: quoteLanguage \|\| companyLanguage,/.test(src), "builder: the picker path calls lineFromProduct with the QUOTE's language");
  ok(/const line = lineFromSuggestion\(suggestion\);/.test(src), "builder: the chip path calls lineFromSuggestion");
  ok(!/description: product\.name,/.test(src), "builder: the old hand-copied product line is gone");
  ok(/buildScopeGroupPayload\(\s*g,\s*rateOverridesFor\(g\.categoryId\),\s*quoteLanguage \|\| companyLanguage,\s*\)/.test(src), "builder: the payload gets the quote language, so derived cabinet lines are written in it");
  const table = read("app/components/quotes/builder/LineItemsTable.js");
  ok(/onAddProduct\(product\)/.test(table) && /onAddSuggested\(s\)/.test(table), "…and the table still hands the full product / suggestion object up (the detail rides on it)");
  const payload = read("lib/quotes/builderPayload.js");
  ok(/cabinetAddOnLinesFor\(group, rateOverrides, language\)/.test(payload), "…and scopeGroupPayload threads it into cabinetAddOnLinesFor");
  const addOns = read("app/components/quotes/SuggestAddOns.js");
  ok(/detail: s\.detail \|\| "",/.test(addOns), "accepted AI/history add-on: its detail is copied onto the QuoteAddOn row");
}

// ═══════════════════════════════════════════════════════════════════════════
section("D. Seeding stores the sentence; the backfill fills only blanks; dry by default");

{
  const src = read("lib/products/seedStandardAddOns.js");
  ok(/description: a\.description \|\| null,/.test(src), "seed writes Product.description from the catalogue");
  ok(/translations: standardAddOnTranslations\(a\.name\) \|\| undefined,/.test(src), "seed writes Product.translations.fr from the French catalogue");
  const { toCreate } = planStandardAddOns({ addons: STANDARD_ADDONS.cabinet_refinishing, existing: [], categoryId: "c1" });
  ok(toCreate.every((a) => goodSentence(a.description)), "what the seed would create all carries a sentence");
}
{
  const plan = planDescriptionBackfill([
    { id: "p1", name: "Soft-Close Hinges", description: null, translations: null },
    { id: "p2", name: "Soft-Close Hinges", description: "Our own wording.", translations: { fr: { name: "X", description: "Y" } } },
    { id: "p3", name: "Two-Tone Finish", description: "", translations: { es: { name: "Dos tonos", description: "…" } } },
    { id: "p4", name: "Rush Fee", description: null, translations: null },
    { id: "p5", name: "Glass Inserts", description: "Typed.", translations: null },
  ]);
  const by = Object.fromEntries(plan.map((c) => [c.id, c.data]));
  ok(by.p1?.description === "Install soft-close hinges, per door." && by.p1?.translations?.fr?.name, "blank row → description AND French filled");
  ok(!by.p2, "typed description + existing fr → untouched entirely");
  ok(by.p3?.description && by.p3.translations.es && by.p3.translations.fr, "empty-string description → filled; other languages carried, fr added");
  ok(!by.p4, "a name that is not a standard add-on is never touched");
  ok(by.p5 && !by.p5.description && by.p5.translations?.fr, "typed description, no fr → only the French is added");
  ok(plan.every((c) => !("name" in c.data) && !("unitPrice" in c.data) && !("unit" in c.data)), "the plan never changes a name, a price or a unit");
}
{
  const src = read("scripts/backfill-product-descriptions.mjs");
  ok(/const APPLY = process\.argv\.includes\("--apply"\);/.test(src), "backfill: writes only behind --apply");
  ok(/if \(APPLY\) \{[\s\S]*updateMany/.test(src), "…and the only write is inside that guard");
  ok(!/\.delete|deleteMany|\.create\(/.test(src), "…no delete, no create");
  ok(/planDescriptionBackfill\(companyRows\)/.test(src), "…and it decides through the pure planner, per company");
  ok(/description: null \}, \{ description: "" \}/.test(src), "…with a re-check at write time that the description is still blank");
  ok(/--company/.test(src), "…scopeable to one company");
}

// ═══════════════════════════════════════════════════════════════════════════
section("E. The review sees the detail, and names a line without one");

{
  const src = read("lib/ai/quoteReview.js");
  ok(/lineItems: items[\s\S]{0,300}\.\.\.\(li\.detail \? \{ detail: li\.detail \} : \{\}\),/.test(src), "writingPass sends `detail` for every line that has one");
  ok(/optionalExtras: addOns\.map[\s\S]{0,200}\.\.\.\(a\.detail \? \{ detail: a\.detail \} : \{\}\),/.test(src), "…and for every add-on that has one");
  ok(/may have a "detail" — the scope text/.test(src), "…and tells the model that is what it is");
  ok(/completenessChecks\(quote, items\)/.test(src), "reviewQuote runs the deterministic completeness checks on the same items");
}
{
  const base = { validUntil: new Date(Date.now() + 864e5).toISOString(), processNotes: "Next steps.", clientPhotos: [{ kind: "photo", url: "x" }], client: { email: "a@b.c" }, scopeGroups: [] };
  const withDetail = completenessChecks(base, [
    { description: "Soft-close hinges", detail: "Supply and fit soft-close hinges, per door.", amount: 840 },
    { description: "Two-tone finish", detail: "Second colour across 14 pieces.", amount: 600 },
  ]);
  ok(!withDetail.some((c) => c.id === "no_detail"), "lines with a detail → no 'no description' finding", withDetail.map((c) => c.id));
  const bare = completenessChecks(base, [
    { description: "Soft-close hinges", amount: 840 },
    { description: "Two-tone finish", detail: "   ", amount: 600 },
  ]);
  const finding = bare.find((c) => c.id === "no_detail");
  ok(finding && /2 lines have no description/.test(finding.title), "lines without → one finding that says 'no description' and counts them", finding);
  ok(finding && /"Soft-close hinges", "Two-tone finish"/.test(finding.detail), "…naming the lines", finding?.detail);
  ok(finding?.severity === "low", "…at low severity: it never blocks readiness on its own", finding?.severity);
  const many = completenessChecks(base, Array.from({ length: 6 }, (_, i) => ({ description: `Line ${i + 1}`, amount: 1 })));
  ok(/and 3 more/.test(many.find((c) => c.id === "no_detail").detail), "…and six bare lines name three and count the rest");
}

// ═══════════════════════════════════════════════════════════════════════════
section("F. The PAID pill: three facts, the cost inside, and measured contrast");

{
  const money = (c) => `$${(c / 100).toFixed(2)}`;
  const now = new Date("2026-09-08T14:00:00");
  const ready = visionPillState({ spend: { allowed: true, reason: "ok", needCents: 34, balanceCents: 500 }, passes: [], costCents: 34, money, now });
  ok(ready.state === "ready" && ready.label === "Paid · $0.34", "credit to spend → amber, cost inside", ready);
  const short = visionPillState({ spend: { allowed: false, reason: "insufficient_balance", needCents: 34, balanceCents: 10, shortfallCents: 24 }, passes: [], costCents: 34, money, now });
  ok(short.state === "short" && short.label === "No credit · needs $0.34", "cannot cover one read → red, with the amount", short);
  const done = visionPillState({ spend: { allowed: true, reason: "ok", needCents: 34 }, passes: [{ at: "2026-09-08T09:15:00", photosRead: 3 }], costCents: 34, money, now });
  ok(done.state === "done" && done.label === "Paid · $0.34 · read today", "read already today → green, still says the cost", done);
  const yesterday = visionPillState({ spend: null, passes: [{ at: "2026-09-07T23:59:00" }], costCents: 34, money, now });
  ok(yesterday.state === "ready", "a read yesterday is not 'today' (local calendar day)", yesterday);
  const doneButShort = visionPillState({ spend: { allowed: false, reason: "insufficient_balance", needCents: 34 }, passes: [{ at: "2026-09-08T09:15:00" }], costCents: 34, money, now });
  ok(doneButShort.state === "done", "read today beats a short balance — the pill reports what happened, the button handles the next spend");
  const unknown = visionPillState({ spend: null, passes: [], costCents: 34, money, now });
  ok(unknown.state === "ready", "no verdict (fetch failed / older server) → amber, never a red with no fact behind it");
  const hidden = visionPillState({ spend: { allowed: false, reason: "feature_unavailable", needCents: 34 }, passes: [], costCents: 34, money, now });
  ok(hidden.state === "ready", "a feature withdrawal is not a money refusal → not red");
  const badDate = visionPillState({ spend: null, passes: [{ at: "not a date" }, {}], costCents: 34, money, now });
  ok(badDate.state === "ready", "a pass with an unreadable `at` does not count as today");
  ok(Object.values(VISION_PILL_CLASSES).every((c) => !/\/\d+/.test(c)), "no alpha in any pill class — the ratio must not depend on what is behind it");
}
{
  const ui = read("app/components/quotes/SuggestAddOns.js");
  ok(/visionPillState\(\{\s*spend: visionSpend,\s*passes: visionPasses,\s*costCents: VISION_PASS_CENTS,/.test(ui), "panel: the pill is decided by visionPillState from the verdict, the passes and the constant cost");
  ok(/\$\{pill\.className\}/.test(ui) && /\{pill\.label\}/.test(ui), "panel: it wears the module's classes and prints the module's label");
  ok(!/>\s*Paid\s*<\/span>/.test(ui), "panel: the old bare grey 'Paid' outline is gone");
  ok(/setVisionSpend\(vision\?\.spend \|\| null\)/.test(ui), "panel: reads `spend` off GET /api/quotes/[id]/vision");
  ok(/setVisionSpend\(again\?\.spend \|\| null\)/.test(ui), "panel: re-reads the verdict after a paid run moved the wallet");
  const route = read("app/api/quotes/[id]/vision/route.js");
  ok(/checkSpend\(\{ companyId: member\.companyId, kind: "image_vision" \}\)/.test(route), "route: GET computes the verdict with checkSpend (read-only, the same one POST charges on)");
  ok(/spend: \{\s*allowed: spend\.allowed,/.test(route), "route: …and returns it as `spend`");
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  ok(!/reserveSpend\(|status: 402/.test(getBody), "route: GET never reserves and never answers 402");
}
{
  // Contrast, measured against the real palette — the oklch conversion and
  // the sanity pins are the ones scripts/check-platform-contrast.mjs uses.
  function oklchToHex(L, C, hDeg) {
    const h = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const enc = (u) => {
      const v = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(u, 0), 1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, v)) * 255);
    };
    return `#${lin.map((u) => enc(u).toString(16).padStart(2, "0")).join("")}`;
  }
  const luminance = (hex) => {
    const s = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const PALETTE = new Map([["white", "#ffffff"], ["black", "#000000"]]);
  for (const m of read("node_modules/tailwindcss/theme.css").matchAll(/--color-([\w-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)) {
    PALETTE.set(m[1], oklchToHex(Number(m[2]) / 100, Number(m[3]), Number(m[4])));
  }
  ok(PALETTE.size > 100 && PALETTE.get("amber-700") === "#bb4d00", "the real oklch palette parsed (amber-700 = #bb4d00)", PALETTE.get("amber-700"));
  ok(Math.round(contrast("#ffffff", "#000000")) === 21, "contrast maths: white on black is 21:1");

  // The classes are the same in both themes (solid fills, no dark: variant),
  // so one measurement covers light and dark; that is asserted, not assumed.
  for (const [state, cls] of Object.entries(VISION_PILL_CLASSES)) {
    const bg = cls.match(/\bbg-([\w-]+)/)?.[1];
    const fg = cls.match(/\btext-([\w-]+)/)?.[1];
    ok(!/dark:/.test(cls), `${state}: no theme-specific variant, so the fill is the same on both themes`);
    const ratio = bg && fg && PALETTE.get(bg) && PALETTE.get(fg) ? contrast(PALETTE.get(bg), PALETTE.get(fg)) : 0;
    ok(ratio >= 4.5, `${state}: ${cls} measures ${ratio.toFixed(2)}:1 (≥ 4.5 required)`, { bg: PALETTE.get(bg), fg: PALETTE.get(fg) });
  }
}

console.log(fail ? `\n${fail} check(s) failed` : "\nAll add-on description and PAID pill checks passed");
process.exit(fail ? 1 : 0);
