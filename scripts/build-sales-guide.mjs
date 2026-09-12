// scripts/build-sales-guide.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/build-sales-guide.mjs en
//
// Builds the sales reference guide as HTML, ready for Chrome's --print-to-pdf.
//
// ══ Why it is generated and not written ═══════════════════════════════════
//
// A sales guide is a promise a rep repeats on a call, so the expensive failure
// is not a typo — it is a feature described here that the product does not
// have, or a limit that has quietly stopped being true. Both happen the moment
// a document is maintained by hand beside a codebase that keeps moving.
//
// So the FEATURES come from lib/marketing/featureMatrix.js and nowhere else.
// That module is proof-carrying: every entry names the files and exports that
// must exist for it, and scripts/check-feature-matrix.mjs fails the build when
// one does not. A feature cannot appear in this PDF unless it exists in the
// code, and its "what it does not do" sentence is the product's own.
//
// The prose lives in docs/sales/guide/content.<lang>.js — sentences only, no
// markup, so a translator is handed language rather than HTML.
//
// ══ Navigable, because it is a reference ══════════════════════════════════
//
// Nobody reads this cover to cover. Every section is an anchor, the contents
// links to all of them, every feature name in a deep dive links to its row in
// the table, and each section links back. Chrome carries internal anchors into
// the PDF, so the links work in the file a rep opens on a phone in a car park.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FEATURE_MATRIX, MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { FEATURE_PAGE_MESSAGES } from "@/app/i18n/featurePages/index.js";
import { MESSAGES } from "@/app/i18n/messages";
import { SEAT_LADDER } from "@/lib/pricing/ladder";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lang = (process.argv[2] || "en").toLowerCase();
const contentPath = join(ROOT, "docs/sales/guide", `content.${lang}.js`);
if (!existsSync(contentPath)) {
  console.error(`No content module for "${lang}" — expected docs/sales/guide/content.${lang}.js`);
  process.exit(1);
}
const { GUIDE, DEEP_DIVES, CONSOLE_SECTIONS = [] } = await import(contentPath);

// ══ Where the non-prose strings come from ═════════════════════════════════
//
// The group headings and each partial feature's "what it does not do" sentence
// are NOT in the content module, and deliberately so: they are pinned to
// lib/marketing/featureMatrix.js, and app/i18n/featurePages/ already carries a
// reviewed translation of both in nine languages — the same strings a French
// reader is already shown on fieldquo.com/features. Re-translating them here
// would produce a second French wording of a caveat, which is the one place a
// second wording does real damage. So this reads the shipped catalogue, and
// falls back to the matrix's English rather than inventing anything.
//
// The same is true of every feature NAME and SUMMARY: app/i18n/messages.js
// carries all 76 in nine languages, pinned character-for-character to the
// matrix in English by check:feature-pages. The first FR/ES build printed them
// in English because nobody looked — the translation was there the whole time.
const CATALOGUE = { ...(FEATURE_PAGE_MESSAGES[lang] || {}), ...(MESSAGES[lang] || {}) };
const translated = (key) => (typeof CATALOGUE[key] === "string" ? CATALOGUE[key] : null);
const nameOf = (f) => translated(`feature.${f.key}.name`) || f.name;
const summaryOf = (f) => translated(`feature.${f.key}.summary`) || f.summary;

// ══ What the PDF deliberately does NOT carry ══════════════════════════════
//
// The matrix's `readiness` and `limits` are not rendered. The owner's call,
// and a defensible one: a caveat in a sales guide is a promise to fix nothing,
// whereas a caveat in docs/OPEN-WORK-APP.md is a job. So the "what it does not
// do" sentences go to the owner as a game plan, and the guide describes the
// product as the matrix proves it to be. If a limit is real and unfixable it
// belongs in the matrix summary itself, where the public site shows it too.

/** Escape for HTML text. Every string below is authored, but none is trusted. */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const byKey = new Map(FEATURE_MATRIX.map((f) => [f.key, f]));
const partials = FEATURE_MATRIX.filter((f) => f.readiness !== "shipped");
if (partials.length) {
  console.log(
    `${lang}: ${partials.length} matrix entries are still marked partial and are rendered without a badge — ` +
      `their caveats are tracked in docs/OPEN-WORK-APP.md, not here: ${partials.map((f) => f.key).join(", ")}`,
  );
}

/** Screenshots are optional. A missing one omits its figure rather than
 *  printing a broken image — the guide has to be shippable before somebody
 *  has logged in to capture them. */
const shotsDir = join(ROOT, "docs/sales/guide/shots");
const figure = (file, caption) => {
  if (!existsSync(file)) return "";
  const b64 = readFileSync(file).toString("base64");
  return `<figure><img src="data:image/png;base64,${b64}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`;
};
const shot = (name, caption) => figure(join(shotsDir, `${name}.png`), caption);

// ══ The rep's own tools are a second list, not more deep dives ════════════
//
// DEEP_DIVES describe the PRODUCT — what a contractor buys — and every one
// of them is chained to the feature matrix through its `keys`. The console,
// the batch, the incoming-call drawer, Texts, Team and Pay are not features
// FieldQuo sells; they are the room the rep works in, and nothing in the
// matrix proves them. So they are a separate list with no `keys`, no chips,
// and their own heading, and their proof is a different kind: the screens
// under docs/screens/sales-console and docs/screens/sales-messages are the
// REAL components rendered against fixtures, so a section may carry one as
// its figure (`shot`, a path from the repo root). The image is the claim's
// evidence in the same way a feature key is — a paragraph that describes a
// control the frame does not show is the thing to catch in review.
const consoleSections = Array.isArray(CONSOLE_SECTIONS) ? CONSOLE_SECTIONS : [];

const featureRow = (f) => `
  <tr id="f-${esc(f.key)}">
    <td class="fname">${esc(nameOf(f))}</td>
    <td>${esc(summaryOf(f))}</td>
  </tr>`;

const sections = [
  { id: "pitch", title: GUIDE.pitchHeading },
  { id: "plans", title: GUIDE.plansHeading },
  { id: "deep", title: GUIDE.deepHeading },
  ...DEEP_DIVES.map((d) => ({ id: d.id, title: d.title, sub: true })),
  ...(consoleSections.length ? [{ id: "console", title: GUIDE.consoleHeading }] : []),
  ...consoleSections.map((d) => ({ id: d.id, title: d.title, sub: true })),
  { id: "reference", title: GUIDE.referenceHeading },
  { id: "glossary", title: GUIDE.glossaryHeading },
];

const html = `<!doctype html>
<html lang="${esc(GUIDE.lang)}" dir="${esc(GUIDE.dir)}">
<head><meta charset="utf-8"><title>${esc(GUIDE.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1a1d23; margin: 0; }
  h1 { font-size: 30pt; line-height: 1.1; margin: 0 0 6pt; letter-spacing: -0.02em; }
  h2 { font-size: 17pt; margin: 26pt 0 8pt; letter-spacing: -0.01em; page-break-after: avoid; border-top: 2px solid #c2410c; padding-top: 9pt; }
  h3 { font-size: 12.5pt; margin: 18pt 0 5pt; page-break-after: avoid; color: #0f172a; }
  p { margin: 0 0 8pt; }
  a { color: #c2410c; text-decoration: none; }
  .cover { page-break-after: always; padding-top: 55mm; }
  .cover .sub { font-size: 13pt; color: #475569; margin-top: 4pt; }
  .cover .meta { margin-top: 26pt; font-size: 9pt; color: #64748b; }
  .rule { height: 3px; background: #c2410c; width: 64px; margin: 16pt 0; }
  .toc { page-break-after: always; }
  .toc ol { list-style: none; padding: 0; margin: 0; counter-reset: s; }
  .toc li { padding: 4pt 0; border-bottom: 1px dotted #cbd5e1; }
  .toc li.sub { padding-left: 16pt; border-bottom: none; font-size: 9.5pt; }
  .toc a { display: flex; justify-content: space-between; gap: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 9.5pt; }
  th { text-align: left; background: #f1f5f9; padding: 5pt 6pt; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
  td { padding: 5pt 6pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.fname { font-weight: 600; width: 33%; }
  .callout { border-left: 3px solid #c2410c; background: #fff7ed; padding: 9pt 11pt; margin: 10pt 0 14pt; }
  .chips a { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 3px; padding: 1.5pt 6pt; margin: 0 3pt 3pt 0; font-size: 8.5pt; }
  .back { font-size: 8pt; color: #94a3b8; margin-top: 4pt; }
  figure { margin: 10pt 0; page-break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; }
  figcaption { font-size: 8.5pt; color: #64748b; margin-top: 3pt; }
  section { page-break-inside: auto; }
  dt { font-weight: 600; margin-top: 8pt; }
  dd { margin: 2pt 0 0; color: #334155; }
</style></head>
<body>

<div class="cover">
  <div class="rule"></div>
  <h1>${esc(GUIDE.title)}</h1>
  <p class="sub">${esc(GUIDE.subtitle)}</p>
  <p class="meta">${esc(
    (GUIDE.coverMeta || "{date} · {features}")
      .replace("{date}", new Date().toISOString().slice(0, 10))
      .replace("{features}", String(FEATURE_MATRIX.length)),
  )}</p>
</div>

<nav class="toc">
  <h2 id="contents">${esc(GUIDE.contentsHeading)}</h2>
  <ol>
    ${sections.map((s) => `<li class="${s.sub ? "sub" : ""}"><a href="#${esc(s.id)}"><span>${esc(s.title)}</span></a></li>`).join("\n    ")}
  </ol>
</nav>

<section id="intro">
  <h2>${esc(GUIDE.intro.heading)}</h2>
  ${GUIDE.intro.body.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
</section>

<section id="pitch">
  <h2>${esc(GUIDE.pitchHeading)}</h2>
  <div class="callout">${GUIDE.pitch.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
</section>

<section id="plans">
  <h2>${esc(GUIDE.plansHeading)}</h2>
  <p>${esc(GUIDE.plansIntro)}</p>
  <table><thead><tr>
    <th>${esc(GUIDE.planCols.plan)}</th><th>${esc(GUIDE.planCols.price)}</th>
    <th>${esc(GUIDE.planCols.seats)}</th><th>${esc(GUIDE.planCols.crew)}</th></tr></thead>
    <tbody>${SEAT_LADDER.map((t) => `<tr><td class="fname">${esc(t.label)}</td><td>$${t.price}</td><td>${t.seats}</td><td>${t.crewSeats}</td></tr>`).join("")}</tbody>
  </table>
  <p>${esc(GUIDE.planNote)}</p>
</section>

<section id="deep">
  <h2>${esc(GUIDE.deepHeading)}</h2>
  <p>${esc(GUIDE.deepIntro)}</p>
</section>

${DEEP_DIVES.map((d) => `
<section id="${esc(d.id)}">
  <h3>${esc(d.title)}</h3>
  ${d.body.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${shot(d.id, d.title)}
  <p class="chips">${d.keys.map((k) => byKey.get(k)).filter(Boolean)
      .map((f) => `<a href="#f-${esc(f.key)}">${esc(nameOf(f))}</a>`).join("")}</p>
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`).join("\n")}

${consoleSections.length ? `
<section id="console">
  <h2>${esc(GUIDE.consoleHeading)}</h2>
  ${(GUIDE.consoleIntro || []).map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
</section>

${consoleSections.map((d) => `
<section id="${esc(d.id)}">
  <h3>${esc(d.title)}</h3>
  ${d.body.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${d.shot ? figure(join(ROOT, d.shot), d.shotCaption || d.title) : ""}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`).join("\n")}` : ""}

<section id="reference">
  <h2>${esc(GUIDE.referenceHeading)}</h2>
  <p>${esc(GUIDE.referenceIntro)}</p>
  ${MATRIX_GROUPS.map((g) => `
  <h3>${esc(translated(`featureGroup.${g.key}.label`) || g.label)}</h3>
  <p>${esc(translated(`featureGroup.${g.key}.blurb`) || g.blurb)}</p>
  <table><tbody>
  ${FEATURE_MATRIX.filter((f) => f.group === g.key).map(featureRow).join("")}
  </tbody></table>`).join("\n")}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

<section id="glossary">
  <h2>${esc(GUIDE.glossaryHeading)}</h2>
  <p>${esc(GUIDE.glossaryIntro)}</p>
  <dl>${(GUIDE.glossary || []).map((g) => `<dt id="g-${esc(g.term.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(g.term)}</dt><dd>${esc(g.def)}${g.key && byKey.get(g.key) ? ` <a href="#f-${esc(g.key)}">${esc(GUIDE.seeAlso)} ${esc(nameOf(byKey.get(g.key)))}</a>` : ""}</dd>`).join("")}</dl>
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

</body></html>`;

const outDir = join(ROOT, "docs/sales/guide/build");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `fieldquo-sales-guide.${lang}.html`);
writeFileSync(out, html);
const englishNames = FEATURE_MATRIX.filter((f) => lang !== "en" && nameOf(f) === f.name).map((f) => f.key);
console.log(`${lang}: ${FEATURE_MATRIX.length} features, ${DEEP_DIVES.length} deep dives, ${consoleSections.length} console sections`);
const missingShots = consoleSections.filter((d) => d.shot && !existsSync(join(ROOT, d.shot))).map((d) => d.shot);
if (missingShots.length) console.log(`${lang}: figures named but not found (omitted): ${missingShots.join(", ")}`);
if (englishNames.length) console.log(`${lang}: feature names still English: ${englishNames.join(", ")}`);
console.log(`wrote ${out}`);
