// scripts/check-proposal-slider.mjs
//
//   npm run check:proposal-slider
//
// Owner, 2026-10-10, with a screenshot of TrueFinish's live quote page: the
// proposal's "Before & after · Recent work" showed each project as two
// pictures side by side, two projects to a row. He wants each project as ONE
// before/after slider — the website's own component — three across on a
// desktop, two on a tablet, stacked on a phone, cleaner and larger. The PDF
// and the covering email cannot slide and keep their side-by-side pairs.
//
// This proves it by RENDERING, not by reading:
//
//   1. The website's slider is byte-identical. The component moved from
//      app/site/[subdomain]/BeforeAfter.js to app/components/public/
//      BeforeAfter.js (one component for both pages); its output with the
//      site's props is pinned to the md5 taken from the pre-move file.
//   2. The email's before/after (HTML and plain text, three languages) is
//      pinned the same way, and the quote PDF carries no gallery at all and
//      imports no slider.
//   3. The proposal: one slider per pair, same order, labels and alt text in
//      the document's language, lazy images, three pairs in ONE three-column
//      row on desktop, two on a tablet, one on a phone; a half pair is a plain
//      picture, never a broken slider; motion respects reduced-motion; no
//      "FieldQuo" anywhere.
//   4. Contrast, measured: the arrows on the brand-filled grip on hostile
//      brands, and the grip's white-in-ink ring against every photo colour.
//   5. The hint exists in all eight document languages.
//
// Bundled through esbuild (like check:range-presentation) because the
// components are JSX.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SiteBeforeAfter from "../app/site/[subdomain]/BeforeAfter.js";
import SharedBeforeAfter from "../app/components/public/BeforeAfter.js";
import { CompanySections, ProposalGallery, PROPOSAL_GALLERY_GRID } from "../app/components/public/proposal/ProposalSections.js";
import { beforeAfterHtml, quoteSectionsText } from "../lib/email/quoteSections.js";
import { CLIENT_DOC_COPY, clientDocCopy } from "../lib/i18n/clientDocCopy.js";
import { documentTheme, fillPair } from "../lib/documents/theme.js";
import { contrastRatio } from "../lib/brand/colour.js";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const md5 = (s) => createHash("md5").update(s).digest("hex");
const h = React.createElement;

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got === undefined ? "" : `  — got ${JSON.stringify(got)}`}`);
  }
};
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The website's slider is byte-identical");
{
  // md5s of renderToStaticMarkup taken from app/site/[subdomain]/BeforeAfter.js
  // at 9cc84fb72, before the move. If the website's slider is changed ON
  // PURPOSE, re-pin these and say so in the commit.
  const theme = { ink: "#111111", paper: "#fefefe", accentWash: "#eeeeff", inkMuted: "#555555" };
  const CASES = [
    [{ before: "https://x/b.jpg", after: "https://x/a.jpg" }, "d66ce81b5c463218c16a03a21bf7a159"],
    [{ before: "https://x/b.jpg", after: "https://x/a.jpg", caption: "Maple St", radius: "rounded-xl", theme }, "747f13c715cff7611d28ebe500919919"],
    [{ before: "https://x/b.jpg", after: null }, "d41d8cd98f00b204e9800998ecf8427e"],
  ];
  CASES.forEach(([props, pinned], i) => {
    const viaSite = md5(renderToStaticMarkup(h(SiteBeforeAfter, props)));
    const viaShared = md5(renderToStaticMarkup(h(SharedBeforeAfter, props)));
    ok(`site case ${i + 1}: the site's import renders the pinned markup`, viaSite === pinned, viaSite);
    ok(`site case ${i + 1}: …and it is the shared component, not a copy`, viaShared === viaSite);
  });
  const reexport = read("app/site/[subdomain]/BeforeAfter.js");
  ok("the old path is a re-export, not a second slider", /export \{ default \} from "@\/app\/components\/public\/BeforeAfter"/.test(reexport) && !/useState|<input/.test(reexport));
  ok("the site still imports it from the old path", /import BeforeAfter from "\.\/BeforeAfter"/.test(read("app/site/[subdomain]/SiteBlocks.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The email and the PDF are unchanged");
{
  // md5s from lib/email/quoteSections.js at 9cc84fb72. The email can't slide:
  // its pairs stay side by side.
  const items = [
    { beforeUrl: "https://x/b1.jpg", afterUrl: "https://x/a1.jpg", caption: "Kitchen" },
    { beforeUrl: "https://x/b2.jpg", afterUrl: "https://x/a2.jpg" },
  ];
  const PINNED = {
    en: ["77ac5a79dbf080a165792e61d3bab471", "2be003024d97e86b0a824ca3700ba651"],
    fr: ["17183749cb9427f50b72cf88db41c1f2", "a42bf32797a8c10585252fabb1ada510"],
    pa: ["05c1f4ae1bc3919a77fb258e19ee5003", "99889da87e5cd9523d892f3515fbce6f"],
  };
  for (const [language, [html, text]] of Object.entries(PINNED)) {
    const gotHtml = md5(beforeAfterHtml({ items, company: { brandColor: "#f5d90a" }, language }));
    const gotText = md5(quoteSectionsText({ company: { brandColor: "#f5d90a" }, language, beforeAfter: items }));
    ok(`${language}: the email's before/after HTML is the pinned side-by-side table`, gotHtml === html, gotHtml);
    ok(`${language}: …and its plain-text twin is unchanged`, gotText === text, gotText);
  }
  // The quote PDF has never drawn the gallery; it must not start by accident,
  // and no PDF or email renderer may reach for the slider.
  const pdfFiles = [
    "app/admin/lib/pdf/renderDocumentPdf.js",
    "app/admin/lib/pdf/defaultSections.js",
    ...readdirSync(join(ROOT, "lib/documentSections")).filter((f) => f.endsWith(".js")).map((f) => `lib/documentSections/${f}`),
  ];
  ok("the quote PDF renderer carries no before/after gallery", pdfFiles.every((f) => !/beforeUrl|gallery|BeforeAfter|beforeAfter/.test(read(f))), pdfFiles.filter((f) => /beforeUrl|gallery|BeforeAfter|beforeAfter/.test(read(f))));
  const renderers = [...pdfFiles, "app/admin/lib/pdf/renderJobPhotoReportPdf.js", ...readdirSync(join(ROOT, "lib/email")).filter((f) => f.endsWith(".js")).map((f) => `lib/email/${f}`)];
  ok("no PDF or email renderer imports the slider", renderers.every((f) => !/components\/public\/BeforeAfter|\[subdomain\]\/BeforeAfter/.test(read(f))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The web proposal: one slider per project");
const pair = (n, caption = "") => ({ before: `https://res.cloudinary.com/demo/before-${n}.jpg`, after: `https://res.cloudinary.com/demo/after-${n}.jpg`, caption });
const brand = (hex) => documentTheme({ brandColor: hex });
const renderGallery = (gallery, language = "en", theme = brand("#06356b")) =>
  renderToStaticMarkup(h(ProposalGallery, { gallery, copy: clientDocCopy(language), theme }));
const gridClass = (html) => (html.match(/^<div class="([^"]*)"/) || [])[1] || "";
const count = (html, re) => (html.match(re) || []).length;
{
  const three = [pair(1, "Maple St"), pair(2, "Bank St"), pair(3)];
  const theme = brand("#06356b");
  const html = renderToStaticMarkup(
    h(CompanySections, { proposal: { gallery: three }, sectionKeys: ["beforeAfter"], copy: clientDocCopy("en"), theme, rule: "#06356b", wash: {} }),
  );
  ok("through CompanySections: 3 pairs → 3 sliders (3 range inputs)", count(html, /type="range"/g) === 3, count(html, /type="range"/g));
  ok("…no side-by-side pair is left (no grid-cols-2 inside a figure)", !/<figure[^>]*>\s*<div class="grid grid-cols-2/.test(html));
  const g = renderGallery(three);
  const cls = gridClass(g);
  ok("3 pairs: ONE grid, three columns on desktop", cls === PROPOSAL_GALLERY_GRID[3] && /(^| )lg:grid-cols-3( |$)/.test(cls), cls);
  ok("…two on a tablet, one on a phone (no unprefixed column count)", /(^| )sm:grid-cols-2( |$)/.test(cls) && !/(^| )grid-cols-\d/.test(cls), cls);
  ok("…so all three sit in one desktop row (3 items ≤ 3 columns)", count(g, /type="range"/g) === 3);
  const afters = [...g.matchAll(/src="(https:\/\/res\.cloudinary\.com\/demo\/after-\d)\.jpg"/g)].map((m) => m[1].slice(-1));
  ok("same pairs, same order", afters.join("") === "123", afters);
  ok("every picture lazy-loads", count(g, /<img /g) === 6 && count(g, /loading="lazy"/g) === 6);
  ok("alt text: Before/After plus the project label", /alt="Before — Maple St"/.test(g) && /alt="After — Maple St"/.test(g) && /alt="Before"/.test(g) && /alt="After"/.test(g));
  ok("the before picture is no longer hidden from screen readers", !/aria-hidden="true" class="absolute inset-0/.test(g) && !/alt="" aria-hidden/.test(g));
  ok("the range input is named in the document's language", />Maple St — Drag the handle to compare\.<\/label>/.test(g) && /<label[^>]*class="sr-only">Drag the handle to compare\.<\/label>/.test(g));
  ok("the visible hint is shown once, under the grid", count(g, /<p class="[^"]*">Drag the handle to compare\.<\/p>/g) === 1);
  ok("the grip is the measured brand fill, arrows in its measured ink", g.includes(`background-color:${fillPair(theme).bg}`) && g.includes(`stroke="${fillPair(theme).fg}"`));
  ok("…inside a white ring inside an ink ring", /box-shadow:0 0 0 2px #ffffff, 0 0 0 3\.5px #20242b/.test(g));
  ok("reduced motion: the fade and the grip's grow are switched off", count(g, /motion-reduce:transition-none/g) === 9, count(g, /motion-reduce:transition-none/g));
  ok("…and no inline transition the class could not override", !/transition:scale/.test(g));
  ok("no FieldQuo in the rendered section", !/fieldquo/i.test(html));

  const six = renderGallery([1, 2, 3, 4, 5, 6].map((n) => pair(n)));
  ok("6 pairs: 6 sliders in the same three-column grid (two desktop rows)", count(six, /type="range"/g) === 6 && gridClass(six) === PROPOSAL_GALLERY_GRID[3]);
  const two = renderGallery([pair(1), pair(2)]);
  ok("2 pairs: two wide sliders, not two thirds and a hole", gridClass(two) === PROPOSAL_GALLERY_GRID[2] && !/lg:grid-cols-3/.test(gridClass(two)));
  const one = renderGallery([pair(1)]);
  ok("1 pair: the section's full width", gridClass(one) === PROPOSAL_GALLERY_GRID[1] && !/grid-cols/.test(gridClass(one)));

  const fr = renderGallery([pair(1, "Rue Maple")], "fr");
  ok("French: the tags say Avant / Après", />Avant<\/span>/.test(fr) && />Après<\/span>/.test(fr) && !/>Before</.test(fr));
  ok("…and the alt text and hint are French", /alt="Avant — Rue Maple"/.test(fr) && /Faites glisser pour comparer\./.test(fr));
  const pa = renderGallery([pair(1)], "pa");
  ok("Punjabi: the tags are the Punjabi words", pa.includes(`>${CLIENT_DOC_COPY.pa.proposal.before}</span>`) && pa.includes(`>${CLIENT_DOC_COPY.pa.proposal.after}</span>`));

  const half = renderGallery([pair(1), { before: "https://res.cloudinary.com/demo/only-before.jpg", after: "", caption: "Porch" }]);
  ok("a half pair: a plain picture, not a slider", count(half, /type="range"/g) === 1 && /<img src="https:\/\/res\.cloudinary\.com\/demo\/only-before\.jpg" alt="Before — Porch"/.test(half));
  ok("…labelled with the side it is", />Before<\/span><\/div><figcaption[^>]*>Porch</.test(half));
  ok("nothing at all for an empty gallery", renderGallery([]) === "" && renderGallery(null) === "");
  const onlyHalf = renderGallery([{ after: "https://res.cloudinary.com/demo/only-after.jpg" }]);
  ok("only half pairs: no 'drag to compare' hint over nothing to drag", !/Drag the handle/.test(onlyHalf) && /alt="After"/.test(onlyHalf));

  const src = read("app/components/public/proposal/ProposalSections.js");
  ok("the proposal uses the shared slider, not its own", /import BeforeAfter from "@\/app\/components\/public\/BeforeAfter"/.test(src) && !/type="range"/.test(src));
  ok("the slider follows the photo's shape on the proposal (fitToPhoto)", /fitToPhoto\b/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Contrast, measured");
{
  const HOSTILE = ["#f5d90a", "#ffffff", "#000000", "#808080", "#777777", "#9acd32", "#ff6600", "#06356b", "#e0e0e0", "#00ffff"];
  for (const hex of HOSTILE) {
    const f = fillPair(brand(hex));
    ok(`${hex}: the grip's arrows on its fill ≥ 4.5:1`, contrastRatio(f.fg, f.bg) >= 4.5, contrastRatio(f.fg, f.bg).toFixed(2));
  }
  // The photo behind the grip is unknown. Sweep the colour cube: for every
  // colour, one of the two rings must stand out from it by 3:1 (WCAG 1.4.11).
  let worst = Infinity;
  for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) {
    const p = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    worst = Math.min(worst, Math.max(contrastRatio("#ffffff", p), contrastRatio("#20242b", p)));
  }
  ok("the white + ink ring stands out ≥ 3:1 from ANY photo colour", worst >= 3, worst.toFixed(2));
  const t = brand("#f5d90a");
  ok("the BEFORE/AFTER tags: ink on paper ≥ 4.5:1", contrastRatio(t.ink, t.paper) >= 4.5);
  ok("the caption: inkMuted on the white card ≥ 4.5:1", contrastRatio(t.inkMuted, "#ffffff") >= 4.5);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The hint in all eight document languages");
{
  const LANGS = ["en", "fr", "es", "it", "de", "uk", "pa", "tl"];
  const en = CLIENT_DOC_COPY.en.proposal.compareHint;
  for (const lang of LANGS) {
    const v = CLIENT_DOC_COPY[lang]?.proposal?.compareHint;
    ok(`${lang}: compareHint exists${lang === "en" ? "" : " and is not the English"}`, typeof v === "string" && v.trim().length > 0 && (lang === "en" || v !== en), v);
    ok(`${lang}: never names FieldQuo`, !/fieldquo/i.test(v || ""));
  }
  ok("wired into check:all", /npm run check:proposal-slider/.test(JSON.parse(read("package.json")).scripts["check:all"]));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
