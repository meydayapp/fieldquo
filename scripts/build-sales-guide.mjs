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
import { SEAT_LADDER } from "@/lib/pricing/ladder";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lang = (process.argv[2] || "en").toLowerCase();
const contentPath = join(ROOT, "docs/sales/guide", `content.${lang}.js`);
if (!existsSync(contentPath)) {
  console.error(`No content module for "${lang}" — expected docs/sales/guide/content.${lang}.js`);
  process.exit(1);
}
const { GUIDE, DEEP_DIVES } = await import(contentPath);

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
const CATALOGUE = FEATURE_PAGE_MESSAGES[lang] || FEATURE_PAGE_MESSAGES.en;
const translated = (key) => (typeof CATALOGUE[key] === "string" ? CATALOGUE[key] : null);

/** A partial feature's limit sentence, and whether it is in the reader's language.
 *  `translated` false means the English original is being shown, which the page
 *  then says out loud — a caveat a rep cannot read is worse than one they can. */
const limitOf = (f) => {
  const t = translated(`feature.${f.key}.limits`);
  return t ? { text: t, translated: true } : { text: f.limits || "", translated: lang === "en" };
};

/** Escape for HTML text. Every string below is authored, but none is trusted. */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const byKey = new Map(FEATURE_MATRIX.map((f) => [f.key, f]));
const partials = FEATURE_MATRIX.filter((f) => f.readiness !== "shipped");

/** Screenshots are optional. A missing one omits its figure rather than
 *  printing a broken image — the guide has to be shippable before somebody
 *  has logged in to capture them. */
const shotsDir = join(ROOT, "docs/sales/guide/shots");
const shot = (name, caption) => {
  const file = join(shotsDir, `${name}.png`);
  if (!existsSync(file)) return "";
  const b64 = readFileSync(file).toString("base64");
  return `<figure><img src="data:image/png;base64,${b64}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`;
};

const featureRow = (f) => `
  <tr id="f-${esc(f.key)}">
    <td class="fname">${esc(f.name)}${f.readiness !== "shipped" ? ` <span class="badge partial">${esc(GUIDE.partialBadge)}</span>` : ""}</td>
    <td>${esc(f.summary)}</td>
  </tr>`;

const sections = [
  { id: "pitch", title: GUIDE.pitchHeading },
  { id: "plans", title: GUIDE.plansHeading },
  { id: "deep", title: GUIDE.deepHeading },
  ...DEEP_DIVES.map((d) => ({ id: d.id, title: d.title, sub: true })),
  { id: "reference", title: GUIDE.referenceHeading },
  { id: "partial", title: GUIDE.partialHeading },
  { id: "gaps", title: GUIDE.gapsHeading },
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
  .badge { font-size: 7pt; padding: 1pt 4pt; border-radius: 3px; letter-spacing: .06em; vertical-align: 1pt; }
  .badge.partial { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .callout { border-left: 3px solid #c2410c; background: #fff7ed; padding: 9pt 11pt; margin: 10pt 0 14pt; }
  .limit { background: #fffbeb; border: 1px solid #fde68a; padding: 8pt 10pt; margin: 5pt 0 13pt; font-size: 9.5pt; }
  .limit strong { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #92400e; margin-bottom: 3pt; }
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
    (GUIDE.coverMeta || "{date} · {features} · {partials}")
      .replace("{date}", new Date().toISOString().slice(0, 10))
      .replace("{features}", String(FEATURE_MATRIX.length))
      .replace("{partials}", String(partials.length)),
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
      .map((f) => `<a href="#f-${esc(f.key)}">${esc(f.name)}</a>`).join("")}</p>
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`).join("\n")}

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

<section id="partial">
  <h2>${esc(GUIDE.partialHeading)}</h2>
  <p>${esc(GUIDE.partialIntro)}</p>
  ${partials.map((f) => `
  <h3><a href="#f-${esc(f.key)}">${esc(f.name)}</a></h3>
  <p>${esc(f.summary)}</p>
  <div class="limit"><strong>${esc(GUIDE.limitLabel)}${
    limitOf(f).translated ? "" : ` — ${esc(GUIDE.limitInEnglish || "English original")}`
  }</strong>${esc(limitOf(f).text)}</div>`).join("")}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

<section id="gaps">
  <h2>${esc(GUIDE.gapsHeading)}</h2>
  <p>${esc(GUIDE.gapsIntro)}</p>
  ${(GUIDE.gaps || []).map((g) => `<h3>${esc(g.title)}</h3><p>${esc(g.body)}</p>`).join("")}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

<section id="glossary">
  <h2>${esc(GUIDE.glossaryHeading)}</h2>
  <p>${esc(GUIDE.glossaryIntro)}</p>
  <dl>${(GUIDE.glossary || []).map((g) => `<dt id="g-${esc(g.term.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(g.term)}</dt><dd>${esc(g.def)}${g.key && byKey.get(g.key) ? ` <a href="#f-${esc(g.key)}">${esc(GUIDE.seeAlso)} ${esc(byKey.get(g.key).name)}</a>` : ""}</dd>`).join("")}</dl>
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

</body></html>`;

const outDir = join(ROOT, "docs/sales/guide/build");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `fieldquo-sales-guide.${lang}.html`);
writeFileSync(out, html);
const untranslated = partials.filter((f) => !limitOf(f).translated);
console.log(`${lang}: ${FEATURE_MATRIX.length} features, ${DEEP_DIVES.length} deep dives, ${partials.length} with limits`);
console.log(
  `${lang}: ${partials.length - untranslated.length}/${partials.length} limit sentences in the reader's language` +
    (untranslated.length ? ` — English original shown for: ${untranslated.map((f) => f.key).join(", ")}` : ""),
);
console.log(`wrote ${out}`);
