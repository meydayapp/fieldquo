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
//   1. One slider. The component moved from app/site/[subdomain]/
//      BeforeAfter.js to app/components/public/BeforeAfter.js; with no
//      document props its output is pinned to the pre-move md5. The
//      website block now passes the site's language (re-pinned on purpose,
//      see below), so a French site says Avant / Après.
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
import SharedBeforeAfter, { positionFromX } from "../app/components/public/BeforeAfter.js";
import SiteBlocks from "../app/site/[subdomain]/SiteBlocks.js";
import { siteCopy } from "../lib/site/siteCopy.js";
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
section("1. The website's slider: one component, the site's own language");
{
  // (a) The component with NO document props is unchanged: md5s of
  // renderToStaticMarkup taken from app/site/[subdomain]/BeforeAfter.js at
  // 9cc84fb72, before the move.
  //
  // Re-pinned 2026-10-31, and ONLY for the ba-range class on the range
  // input. The pin's job is to catch markup that moves when nobody meant it
  // to, so when it legitimately moves the reason is recorded here rather
  // than the number quietly swapped: the native thumb was unsized, which
  // insets a range input's travel by half a thumb-width at each end (16px
  // measured in Chrome) and leaves the drawn grip lagging the pointer and
  // both edges of the photo unreachable. The class sizes the thumb to 1px
  // and sets touch-action. Nothing else about the output changed.
  //
  // Re-pinned again 2026-11-03, for the touch drag. Was
  // cba6f292b1d7bb2e88466a0bfa60e6bd / e78c166acdc039f9b4788337f00c92e1. The
  // owner, second report: "that slider button is still very hard to shift …
  // people try to press and hold or try other things like double tapping."
  // The 1px thumb above fixed the desktop mapping and made iOS Safari worse,
  // because Safari drags a range ONLY from the thumb — a one-pixel target on
  // the phone a homeowner reads a quote on. The position is now driven by
  // pointer events on the photo, and the range input is the keyboard only.
  // The rendered diff is exactly two attributes, nothing else:
  //   box:   + touch-pan-y cursor-ew-resize [-webkit-touch-callout:none]
  //   input: cursor-ew-resize → pointer-events-none
  // Both are asserted on their own below, so a future re-pin cannot quietly
  // drop them.
  const theme = { ink: "#111111", paper: "#fefefe", accentWash: "#eeeeff", inkMuted: "#555555" };
  const CASES = [
    [{ before: "https://x/b.jpg", after: "https://x/a.jpg" }, "691d62cc6aeb2285ced2fe491b4a6735"],
    [{ before: "https://x/b.jpg", after: "https://x/a.jpg", caption: "Maple St", radius: "rounded-xl", theme }, "7bbe3570516b10e62c5e9780fbebe75b"],
    [{ before: "https://x/b.jpg", after: null }, "d41d8cd98f00b204e9800998ecf8427e"],
  ];
  CASES.forEach(([props, pinned], i) => {
    const viaSite = md5(renderToStaticMarkup(h(SiteBeforeAfter, props)));
    const viaShared = md5(renderToStaticMarkup(h(SharedBeforeAfter, props)));
    ok(`bare slider case ${i + 1}: renders the pre-move markup`, viaSite === pinned, viaSite);
    ok(`bare slider case ${i + 1}: …through the shared component, not a copy`, viaShared === viaSite);
  });
  const reexport = read("app/site/[subdomain]/BeforeAfter.js");
  ok("the old path is a re-export, not a second slider", /export \{ default \} from "@\/app\/components\/public\/BeforeAfter"/.test(reexport) && !/useState|<input/.test(reexport));
  ok("the site still imports it from the old path", /import BeforeAfter from "\.\/BeforeAfter"/.test(read("app/site/[subdomain]/SiteBlocks.js")));

  // (b) The website as a visitor gets it — SiteBlocks' own before/after
  // block. CHANGED ON PURPOSE on 2026-10-10 (coordinator's follow-up): the
  // block now passes the site's language to the slider (`labels`,
  // `compareLabel` from lib/site/siteCopy.js), so a French site stops saying
  // "Before"/"After". Against the 9cc84fb72 markup the English render differs
  // in exactly three places: the after image's alt "After: Maple St" →
  // "After — Maple St"; the before image is no longer alt="" aria-hidden but
  // "Before — Maple St"; the range input's label "Drag to compare before and
  // after: Maple St" → "Maple St — Drag the handle to compare.". The grip,
  // the tags' look, the 4:3 box and the layout are untouched. Re-pin only on
  // another deliberate change, and say so in the commit.
  const siteTheme = documentTheme({ brandColor: "#06356b" });
  const site = (language) => {
    const html = renderToStaticMarkup(
      h(SiteBlocks, {
        blocks: [{ id: "b1", type: "beforeafter", content: { heading: "Our work", intro: "", pairs: [{ before: "https://x/b.jpg", after: "https://x/a.jpg", caption: "Maple St" }] } }],
        company: { name: "Acme", slug: "acme" }, theme: siteTheme, fill: fillPair(siteTheme), subdomain: "acme", language,
      }),
    );
    return (html.match(/<figure[\s\S]*?<\/figure>/) || [""])[0];
  };
  const en = site("en");
  // Was 35037d4052d0c89f564dc418012b18e5 (the same block without the props).
  // Re-pinned 2026-11-03 with the two drag attributes above; was
  // 0e767e1c5981665acd857ec6d94ed122. The website's slider had the same
  // one-pixel touch target as the proposal's, so the contractor's own
  // visitors could not work it either.
  const SITE_EN_PINNED = "231259b2d0d28beaad42f67086bfdb4a";
  ok("website (en): the block's slider renders the re-pinned markup", md5(en) === SITE_EN_PINNED, md5(en));
  ok("website (en): …with the three intended differences", /alt="After — Maple St"/.test(en) && /alt="Before — Maple St"/.test(en) && />Maple St — Drag the handle to compare\.<\/label>/.test(en) && !/aria-hidden="true" class="absolute/.test(en));
  ok("website (en): …and the site's look kept (paper grip, inline grow, 4:3 box, no brand handle)", /shadow-lg/.test(en) && /transition:scale 120ms ease-out/.test(en) && /aspect-\[4\/3\]/.test(en) && !/motion-reduce/.test(en));
  const fr = site("fr");
  ok("website (fr): the tags say Avant / Après, not Before / After", />Avant<\/span>/.test(fr) && />Après<\/span>/.test(fr) && !/>Before</.test(fr) && !/>After</.test(fr));
  ok("website (fr): alt text and the slider's name are French", /alt="Avant — Maple St"/.test(fr) && />Maple St — Faites glisser pour comparer\.<\/label>/.test(fr));
  for (const lang of ["es", "uk", "pa", "tl", "de", "it"]) {
    const out = site(lang);
    const t = siteCopy(lang);
    ok(`website (${lang}): the tags are the site's own words`, out.includes(`>${t.before}</span>`) && out.includes(`>${t.after}</span>`) && t.before !== "Before");
  }
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
  // ── The drag surface, and the CSS it depends on ─────────────────────────
  //
  // `ba-range` is a class on the range input whose whole effect lives in
  // app/globals.css. A class with no rule behind it is a dead control: the
  // slider would look identical and drag badly again, silently. So the two
  // are held to each other here.
  const css = read("app/globals.css");
  const slider = read("app/components/public/BeforeAfter.js");
  ok("the range input carries ba-range", /className="ba-range /.test(slider));
  ok("…and globals.css keeps the native webkit thumb from being painted over the photo",
    /\.ba-range::-webkit-slider-thumb\s*\{[^}]*width:\s*1px/.test(css));
  ok("…and the Firefox thumb too", /\.ba-range::-moz-range-thumb\s*\{[^}]*width:\s*1px/.test(css));

  // ── The drag surface is the PHOTO, not the range input (2026-11-03) ─────
  //
  // Reported twice by the owner. A native range does not drag from its track:
  // on iOS Safari a touch anywhere but the thumb does nothing, and the thumb
  // is 1px wide (above). So the photo owns the pointer and the input owns the
  // keyboard. Asserted on the RENDERED markup, because the whole previous
  // failure was a comment in this component claiming "dragging anywhere
  // works, which is what people try first" while it did not.
  const bare = renderToStaticMarkup(h(SharedBeforeAfter, { before: "https://x/b.jpg", after: "https://x/a.jpg" }));
  const boxClass = (bare.match(/<div class="(relative overflow-hidden[^"]*)"/) || [])[1] || "";
  const inputTag = (bare.match(/<input [^>]*>/) || [""])[0];
  ok("the photo box claims the horizontal drag and hands back the vertical scroll", /(^| )touch-pan-y( |$)/.test(boxClass), boxClass);
  ok("…shows a drag cursor on a desktop", /(^| )cursor-ew-resize( |$)/.test(boxClass), boxClass);
  ok("…and suppresses the long-press 'Save Image' sheet a homeowner was getting instead", boxClass.includes("[-webkit-touch-callout:none]"), boxClass);
  ok("the range input no longer takes the pointer", /pointer-events-none/.test(inputTag) && !/cursor-ew-resize/.test(inputTag), inputTag);
  ok("…but is still there for arrow keys and screen readers", /type="range"/.test(inputTag) && /min="0"/.test(inputTag) && /max="100"/.test(inputTag));
  ok("the box drives the position from pointer events, with capture so a drag can leave the photo",
    /onPointerDown=\{startDrag\}/.test(slider) && /onPointerMove=\{moveDrag\}/.test(slider) && /setPointerCapture/.test(slider));
  ok("…and pointercancel ends the drag, so a vertical swipe scrolls instead of tracking",
    /onPointerCancel=\{endDrag\}/.test(slider) && /onLostPointerCapture=\{endDrag\}/.test(slider));
  ok("…from a ref, not state, so the first move after the press is not dropped", /draggingRef/.test(slider));
  ok("the input's value is rounded, so a float drag does not fight the step",
    /value=\{Math\.round\(pos\)\}/.test(slider));
  ok("the invisible input gets a drawn focus ring, since its own is invisible",
    /onFocus=\{\(\) => setFocused\(true\)\}/.test(slider) && /focused \?/.test(slider));

  // Executed, not read: the clamp a captured drag depends on.
  const rect = { left: 100, width: 400 };
  ok("clamp: the middle of the photo is 50%", positionFromX(300, rect) === 50, positionFromX(300, rect));
  ok("clamp: the left edge is 0%", positionFromX(100, rect) === 0, positionFromX(100, rect));
  ok("clamp: the right edge is 100%", positionFromX(500, rect) === 100, positionFromX(500, rect));
  ok("clamp: dragged off the left, it pins to 0 rather than inverting", positionFromX(-9999, rect) === 0, positionFromX(-9999, rect));
  ok("clamp: dragged off the right, it pins to 100", positionFromX(99999, rect) === 100, positionFromX(99999, rect));
  ok("clamp: a quarter in is 25%", positionFromX(200, rect) === 25, positionFromX(200, rect));
  ok("clamp: an unmeasured box gives nothing, never NaN", [
    positionFromX(300, { left: 0, width: 0 }),
    positionFromX(300, null),
    positionFromX(300, undefined),
    positionFromX(300, { left: 0, width: NaN }),
    positionFromX(NaN, rect),
    positionFromX(300, { left: NaN, width: 400 }),
  ].every((v) => v === null));

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

// ═══════════════════════════════════════════════════════════════════════════
section("6. The photos are DELIVERED, not served as the originals");
{
  // Reported 2026-10-20 from a live quote: five before/after pairs rendered
  // as empty grey boxes on the client's page and arrived only slowly on a
  // phone. Nothing was broken — the markup served Cloudinary ORIGINALS, and
  // one of that company's was 1.7 MB. Ten of those is the whole section.
  //
  // Executed, not read: the component is rendered and the src attributes are
  // the assertion, because "we call resizedUrl somewhere" is the kind of
  // claim that survives the call being removed from the tag that matters.
  const theme = { ink: "#111111", paper: "#fefefe", accentWash: "#eeeeff", inkMuted: "#555555" };
  const CLOUDINARY = "https://res.cloudinary.com/demo/image/upload/v1790080132/fieldquo/companies/co_1/kitchen.jpg";
  const html = renderToStaticMarkup(
    h(SharedBeforeAfter, { before: CLOUDINARY, after: CLOUDINARY, theme }),
  );
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  ok("both images are rendered", srcs.length === 2, srcs.length);
  ok(
    "…through a delivered variant, never the original",
    srcs.every((u) => u.includes("/upload/w_1400,c_limit,q_auto,f_auto/")),
    srcs,
  );
  ok(
    "…and the original path is gone from the tag",
    srcs.every((u) => !/\/upload\/v1790080132/.test(u)),
    srcs,
  );

  // c_limit never enlarges and f_auto negotiates the format: a small photo is
  // untouched, which is why this is safe to apply to every gallery picture.
  ok("c_limit, so a small photo is not blown up", srcs.every((u) => u.includes("c_limit")));

  // A URL that is not Cloudinary's passes through unharmed — a company that
  // ever stores a photo elsewhere must not get a mangled src.
  const foreign = renderToStaticMarkup(
    h(SharedBeforeAfter, { before: "https://example.com/b.jpg", after: "https://example.com/a.jpg", theme }),
  );
  ok(
    "a non-Cloudinary URL is left exactly as it is",
    [...foreign.matchAll(/src="([^"]+)"/g)].every((m) => /^https:\/\/example\.com\/[ab]\.jpg$/.test(m[1])),
  );

  // The half-pair case (one photo, no slider) goes through the same variant.
  const sections = read("app/components/public/proposal/ProposalSections.js");
  ok(
    "the single-photo fallback is sized too",
    /<img src=\{resizedUrl\(src, \{ width: 1400 \}\)\}/.test(sections),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
