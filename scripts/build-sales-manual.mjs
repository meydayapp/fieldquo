// scripts/build-sales-manual.mjs
//
//   node scripts/build-sales-manual.mjs            # all three languages
//   node scripts/build-sales-manual.mjs fr         # one
//   node scripts/build-sales-manual.mjs en --html  # HTML only, no Chrome
//
// Builds "FieldQuo Sales Portal — Training Manual" as a PDF per language,
// from docs/sales/manual/content.<lang>.js, through headless Chrome's
// --print-to-pdf. Modelled on scripts/build-sales-guide.mjs; the differences
// are the ones a TRAINING manual needs and a reference guide does not.
//
// ══ On-screen labels are looked up, never retyped ═════════════════════════
//
// A trainer says "press Claim the next 25" and the rep looks for those words
// on the screen. If the manual says "Claim next batch" and the button says
// "Claim the next 25", the new rep concludes the manual is out of date and
// stops trusting it — on day one. So the content modules never spell a label
// out. They write {{app.salesQueue.claimBatch|count=25}} and this builder
// substitutes the string from app/i18n/appMessages.js IN THAT LANGUAGE. A key
// that is not in the catalogue fails the build, because a label that does not
// exist is a control that does not exist.
//
// ══ Figures come from a manifest with fallbacks ═══════════════════════════
//
// docs/sales/manual/figures.js maps a figure key to candidate paths, first
// existing one wins, and a `*` in a candidate is a glob. The sales-portal
// captures (docs/screens/sales-portal/NN-*.png) did not exist when this was
// written — the owner's Chrome was not signed in — so those keys list the
// eventual capture first and the closest rendered-component frame second.
// When nothing exists, a neutral "screenshot to follow" box is drawn in the
// figure's place. Never a broken image: a broken image in a training PDF
// reads as a broken product.
//
// ══ The index carries real page numbers ═══════════════════════════════════
//
// Chrome cannot write a target's page number into a link (no target-counter),
// so this is two-pass. Pass one prints PREFIXES of the document — the front
// matter plus every chapter before this one, plus this chapter cut off just
// after the heading in question — and reads each page count back. Chrome's
// PDFs keep one plain `/Type /Page` object per page, so counting is a regex,
// not a PDF parser. A prefix lays out exactly as the full document does up
// to that point (flow layout never reaches backwards), so the count IS the
// page the heading sits on. The block after the heading is included but cut
// short — a heading has page-break-after: avoid, so it moves with whatever
// follows it, but a long paragraph that spills onto the next page must not
// drag the count with it. Standalone chapter prints were tried first and
// over-counted by three pages: a page-break-before on the first element of
// a document does not collapse the way it does mid-flow. The final print
// carries the numbers; the footer's page counter is CSS, which Chrome does
// support.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { FIGURES } from "../docs/sales/manual/figures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs/sales/manual/build");
const CHROME =
  process.env.CHROME_BIN ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

const args = process.argv.slice(2);
const htmlOnly = args.includes("--html");
const langs = args.filter((a) => !a.startsWith("--"));
const LANGS = langs.length ? langs : ["en", "fr", "es"];
const FILE_SUFFIX = { en: "EN", fr: "FR", es: "ES" };

/** Escape for HTML text. Every string is authored, but none is trusted. */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ── Figures ────────────────────────────────────────────────────────────────
//
// Resolved once per build, shared by every language. A candidate with `*`
// is matched against the directory listing (first match in name order).
function resolveCandidate(rel) {
  if (!rel.includes("*")) return existsSync(join(ROOT, rel)) ? rel : null;
  const dir = dirname(rel);
  const abs = join(ROOT, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return null;
  const re = new RegExp("^" + basename(rel).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  const hit = readdirSync(abs).filter((f) => re.test(f)).sort()[0];
  return hit ? join(dir, hit) : null;
}
const resolvedFigures = new Map();
for (const [key, candidates] of Object.entries(FIGURES)) {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  const found = list.map(resolveCandidate).find(Boolean) || null;
  resolvedFigures.set(key, { found, wanted: list[0] });
}
const dataUri = (rel) => `data:image/png;base64,${readFileSync(join(ROOT, rel)).toString("base64")}`;

// ── Labels ─────────────────────────────────────────────────────────────────
//
// {{key}} or {{key|a=1;b=two}}. The value is read from the language being
// built; a language without that key falls back to English and is counted,
// so the report can say "N labels printed in English" rather than hide it.
function makeLabeller(lang) {
  const cat = APP_MESSAGES[lang] || {};
  const en = APP_MESSAGES.en;
  const missing = new Set();
  const fellBack = new Set();
  const label = (key, params = {}) => {
    let v = cat[key];
    if (typeof v !== "string" && typeof en[key] === "string") {
      v = en[key];
      fellBack.add(key);
    }
    if (typeof v !== "string") {
      missing.add(key);
      return `⟪${key}⟫`;
    }
    // A catalogue string can be a function-shaped countedNoun; those are
    // rendered by the app, not by a manual, and are not quoted here.
    return v.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m));
  };
  return { label, missing, fellBack };
}

/** Inline markup for authored prose: **bold**, {{label}}, `code`. Escaped first. */
function inline(text, L) {
  let s = esc(text);
  s = s.replace(/\{\{([\w.]+)(?:\|([^}]*))?\}\}/g, (m, key, params) => {
    const p = {};
    if (params) for (const kv of params.split(";")) { const [k, ...rest] = kv.split("="); p[k.trim()] = rest.join("=").trim(); }
    const v = L.label(key, p);
    // A button name is a chip. A whole sentence quoted from the screen is a
    // quotation — a chip the width of a paragraph is unreadable, and one that
    // cannot wrap overflows the page, which makes Chrome shrink the whole
    // print to fit and throws the pagination pass off by a page or two.
    return v.length > 44 ? `<q class="uiq">${esc(v)}</q>` : `<span class="ui">${esc(v)}</span>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

// ── Blocks ─────────────────────────────────────────────────────────────────
function renderBlock(b, ctx) {
  const { L, ui } = ctx;
  if (typeof b === "string") return `<p>${inline(b, L)}</p>`;
  if (b.p) return `<p>${inline(b.p, L)}</p>`;
  if (b.h) return `<h3 id="${esc(headingId(ctx.chapter, b))}">${inline(b.h, L)}</h3>`;
  if (b.h4) return `<h4>${inline(b.h4, L)}</h4>`;
  if (b.steps) return `<ol class="steps">${b.steps.map((s) => `<li>${inline(s, L)}</li>`).join("")}</ol>`;
  if (b.list) return `<ul>${b.list.map((s) => `<li>${inline(s, L)}</li>`).join("")}</ul>`;
  if (b.callout) return `<div class="callout">${b.title ? `<div class="ct">${inline(b.title, L)}</div>` : ""}${[].concat(b.callout).map((p) => `<p>${inline(p, L)}</p>`).join("")}</div>`;
  if (b.warn) return `<div class="callout warn">${b.title ? `<div class="ct">${inline(b.title, L)}</div>` : ""}${[].concat(b.warn).map((p) => `<p>${inline(p, L)}</p>`).join("")}</div>`;
  if (b.screen) {
    const s = b.screen;
    const part = (title, body, cls) =>
      body == null ? "" : `<div class="sc ${cls}"><div class="sct">${esc(title)}</div>${Array.isArray(body) ? `<ol>${body.map((x) => `<li>${inline(x, L)}</li>`).join("")}</ol>` : `<p>${inline(body, L)}</p>`}</div>`;
    return `<div class="screen">${part(ui.doThis, s.doThis, "do")}${part(ui.youllSee, s.youllSee, "see")}${part(ui.why, s.why, "why")}</div>`;
  }
  if (b.figure) {
    const fig = resolvedFigures.get(b.figure);
    const n = ++ctx.figureCount;
    const cap = `${ui.figure.replace("{n}", n)} — ${inline(b.caption || "", L)}`;
    if (!fig) throw new Error(`Unknown figure key "${b.figure}" — add it to docs/sales/manual/figures.js`);
    if (fig.found) {
      ctx.figuresReal.push(`${b.figure} ← ${fig.found}`);
      return `<figure class="${b.narrow ? "narrow" : ""}"><img src="${dataUri(fig.found)}" alt="${esc(b.caption || b.figure)}"><figcaption>${cap}</figcaption></figure>`;
    }
    ctx.figuresPlaceholder.push(`${b.figure} (wanted ${fig.wanted})`);
    return `<figure class="placeholder ${b.narrow ? "narrow" : ""}"><div class="ph"><div class="pht">${esc(ui.placeholderTitle)}</div><div class="phb">${esc(ui.placeholderBody.replace("{what}", b.caption || b.figure))}</div></div><figcaption>${cap}</figcaption></figure>`;
  }
  if (b.table) {
    const t = b.table;
    return `<table>${t.head ? `<thead><tr>${t.head.map((h) => `<th>${inline(h, L)}</th>`).join("")}</tr></thead>` : ""}<tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? "first" : ""}">${inline(c, L)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  if (b.tryIt) return `<div class="tryit"><div class="tt">${esc(ui.tryIt)}</div><ol>${b.tryIt.map((s) => `<li>${inline(s, L)}</li>`).join("")}</ol></div>`;
  if (b.glossary) return `<dl class="gloss">${b.glossary.map((g) => `<dt>${inline(g.term, L)}</dt><dd>${inline(g.def, L)}</dd>`).join("")}</dl>`;
  if (b.resources) return `<table class="res"><tbody>${b.resources.map((r) => `<tr><td class="first">${inline(r.label, L)}${r.url ? `<br><a href="${esc(r.url)}">${esc(r.url)}</a>` : ""}</td><td>${inline(r.note, L)}</td></tr>`).join("")}</tbody></table>`;
  if (b.checklist) return `<ul class="check">${b.checklist.map((s) => `<li>${inline(s, L)}</li>`).join("")}</ul>`;
  if (b.spacer) return `<div class="spacer"></div>`;
  throw new Error(`Unknown block: ${JSON.stringify(b).slice(0, 80)}`);
}

// ── Page ───────────────────────────────────────────────────────────────────
const CSS = `
  @page { size: A4; margin: 17mm 16mm 19mm;
    @bottom-center { content: "{{FOOTER}}"; font: 8pt "Helvetica Neue", Helvetica, Arial, sans-serif; color: #94a3b8; }
    @bottom-right { content: counter(page); font: 8pt "Helvetica Neue", Helvetica, Arial, sans-serif; color: #64748b; } }
  @page :first { @bottom-center { content: none; } @bottom-right { content: none; } }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1a1d23; margin: 0; }
  h1 { font-size: 28pt; line-height: 1.1; margin: 0 0 6pt; letter-spacing: -0.02em; }
  h2 { font-size: 19pt; line-height: 1.15; margin: 0 0 10pt; letter-spacing: -0.01em; page-break-after: avoid; }
  h2 .num { display: block; font-size: 9pt; letter-spacing: .12em; text-transform: uppercase; color: #c2410c; margin-bottom: 6pt; }
  h3 { font-size: 12.5pt; margin: 18pt 0 5pt; page-break-after: avoid; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 9pt; }
  h4 { font-size: 10.5pt; margin: 12pt 0 3pt; page-break-after: avoid; color: #334155; }
  p { margin: 0 0 7pt; }
  a { color: #c2410c; text-decoration: none; }
  code { font: 9.5pt Menlo, Consolas, monospace; background: #f1f5f9; padding: 0 3pt; border-radius: 2px; }
  .ui { display: inline; font-weight: 600; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; padding: 0 4pt; line-height: 1.35; font-size: 9.5pt; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  q.uiq { quotes: "\u201C" "\u201D"; color: #0f3d3a; font-style: italic; }
  q.uiq::before, q.uiq::after { color: #0f766e; font-style: normal; }
  html[lang="fr"] q.uiq, html[lang="es"] q.uiq { quotes: "\u00AB\u00A0" "\u00A0\u00BB"; }
  body, td, li, p { overflow-wrap: anywhere; }
  .cover { page-break-after: always; padding-top: 52mm; }
  .cover .sub { font-size: 13pt; color: #475569; margin-top: 4pt; max-width: 130mm; }
  .cover .meta { margin-top: 26pt; font-size: 9pt; color: #64748b; }
  .cover .aud { margin-top: 40pt; font-size: 10pt; color: #334155; border-left: 3px solid #c2410c; padding-left: 10pt; max-width: 120mm; }
  .rule { height: 3px; background: #c2410c; width: 64px; margin: 16pt 0; }
  .toc { page-break-after: always; }
  .toc h2 { border-top: 2px solid #c2410c; padding-top: 9pt; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { padding: 3pt 0; }
  .toc li.ch { font-weight: 600; margin-top: 6pt; }
  .toc li.sub { padding-left: 18pt; font-size: 9.5pt; font-weight: 400; }
  .toc a { display: flex; align-items: baseline; gap: 6pt; color: inherit; }
  .toc a .t { flex: 0 1 auto; }
  .toc a .dots { flex: 1 1 auto; border-bottom: 1px dotted #94a3b8; min-width: 12pt; transform: translateY(-3pt); }
  .toc a .pg { flex: 0 0 auto; color: #475569; font-variant-numeric: tabular-nums; }
  .toc .cn { display: inline-block; width: 16pt; color: #c2410c; }
  section.chapter { page-break-before: always; }
  .intro { font-size: 11.5pt; color: #334155; margin-bottom: 10pt; }
  ol.steps { padding-left: 20pt; margin: 4pt 0 10pt; }
  ol.steps li { margin-bottom: 4pt; padding-left: 2pt; }
  ul { padding-left: 18pt; margin: 4pt 0 8pt; }
  ul li { margin-bottom: 3pt; }
  .screen { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8pt; margin: 8pt 0 12pt; page-break-inside: avoid; }
  .sc { border: 1px solid #e2e8f0; border-radius: 4px; padding: 7pt 9pt; font-size: 9.5pt; background: #fafafa; }
  .sc .sct { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; margin-bottom: 4pt; }
  .sc.do .sct { color: #c2410c; } .sc.see .sct { color: #0f766e; } .sc.why .sct { color: #475569; }
  .sc ol { padding-left: 14pt; margin: 0; } .sc li { margin-bottom: 3pt; } .sc p { margin: 0; }
  .callout { border-left: 3px solid #c2410c; background: #fff7ed; padding: 8pt 11pt; margin: 8pt 0 12pt; page-break-inside: avoid; }
  .callout.warn { border-left-color: #b91c1c; background: #fef2f2; }
  .callout .ct { font-weight: 700; margin-bottom: 3pt; }
  .callout p:last-child { margin-bottom: 0; }
  .tryit { border: 1.5px solid #0f766e; border-radius: 5px; padding: 9pt 12pt; margin: 14pt 0 6pt; background: #f0fdfa; page-break-inside: avoid; }
  .tryit .tt { font-weight: 700; color: #0f766e; margin-bottom: 4pt; }
  .tryit ol { padding-left: 18pt; margin: 0; } .tryit li { margin-bottom: 3pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 9.5pt; page-break-inside: auto; }
  th { text-align: left; background: #f1f5f9; padding: 5pt 6pt; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
  td { padding: 5pt 6pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.first { font-weight: 600; width: 30%; }
  tr { page-break-inside: avoid; }
  figure { margin: 10pt 0 12pt; page-break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; }
  figure.narrow { width: 42%; margin-left: auto; margin-right: auto; }
  figcaption { font-size: 8.5pt; color: #64748b; margin-top: 3pt; }
  figure.placeholder .ph { border: 1.5px dashed #94a3b8; border-radius: 4px; background: #f8fafc; padding: 26pt 18pt; text-align: center; color: #64748b; }
  figure.placeholder .pht { font-weight: 700; color: #475569; margin-bottom: 4pt; }
  figure.placeholder .phb { font-size: 9pt; }
  figure.placeholder.narrow .ph { padding: 60pt 12pt; }
  dl.gloss dt { font-weight: 700; margin-top: 7pt; page-break-after: avoid; }
  dl.gloss dd { margin: 1pt 0 0; color: #334155; }
  table.res td.first { width: 34%; }
  ul.check { list-style: none; padding-left: 0; }
  ul.check li { padding-left: 18pt; position: relative; margin-bottom: 5pt; }
  ul.check li::before { content: ""; position: absolute; left: 0; top: 2pt; width: 9pt; height: 9pt; border: 1.5px solid #64748b; border-radius: 2px; }
  .back { font-size: 8pt; color: #94a3b8; margin-top: 10pt; }
  .spacer { height: calc(2 * 1.55 * 10.5pt); page-break-inside: avoid; }
`;

/** Anchor for a section heading: the chapter id plus a slug of the words.
 *  Prefixed because the slug drops accents, and two French headings can
 *  otherwise collapse into the same id. */
const slug = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const headingId = (chapter, b) => b.id || `${chapter.id}-${slug(b.h)}`;

/** The block after a heading, as the pagination pass renders it.
 *
 *  A heading carries page-break-after: avoid, so Chrome keeps it with the
 *  start of whatever follows — and for a paragraph "the start" means two
 *  lines, because orphans default to 2. So flowing text is stood in for by
 *  an unbreakable spacer exactly two lines tall: it fits at the foot of a
 *  page precisely when the real paragraph's first two lines would, and the
 *  heading moves with it precisely when it would in the full document. A
 *  one-line stand-in was tried first and put two headings a page early.
 *  Blocks that are unbreakable anyway (figure, screen, callout, try-it) are
 *  rendered whole, since they move as one piece; a table is its head row and
 *  first row, which is what page-break-inside: avoid on rows keeps together. */
function truncateBlock(b) {
  if (typeof b === "string" || b.p || b.steps || b.list || b.checklist || b.h4) return { spacer: true };
  if (b.table) return { table: { head: b.table.head, rows: b.table.rows.slice(0, 1) } };
  if (b.glossary) return { glossary: b.glossary.slice(0, 1) };
  if (b.resources) return { resources: b.resources.slice(0, 1) };
  return b;
}

function buildDocument(M, L, opts) {
  // opts.pages: Map(id → page number) for the TOC.
  // opts.upto: { chapterIndex, uptoBlock } renders the front matter, every
  // chapter before chapterIndex in full, and chapterIndex cut to uptoBlock
  // blocks (the last one truncated) — the prefix the pagination pass counts.
  const ui = M.ui;
  const ctx = { L, ui, figureCount: 0, figuresReal: [], figuresPlaceholder: [], chapter: null };
  const pages = opts.pages || new Map();
  const pg = (id) => (pages.has(id) ? String(pages.get(id)) : "");
  const chapterNum = (c) => ui.chapter.replace("{n}", c.n);

  const toc = M.chapters
    .map((c) => {
      const subs = c.blocks.filter((b) => b && b.h).map((b) => ({ id: headingId(c, b), title: b.h }));
      return `<li class="ch"><a href="#${esc(c.id)}"><span class="cn">${c.n}</span><span class="t">${inline(c.title, L)}</span><span class="dots"></span><span class="pg">${pg(c.id)}</span></a></li>` +
        subs.map((s) => `<li class="sub"><a href="#${esc(s.id)}"><span class="t">${inline(s.title, L)}</span><span class="dots"></span><span class="pg">${pg(s.id)}</span></a></li>`).join("");
    })
    .join("\n");

  const chapterHtml = (c, uptoBlock) => {
    ctx.chapter = c;
    ctx.figureCount = c.figureBase || 0;
    const blocks = uptoBlock == null ? c.blocks : c.blocks.slice(0, uptoBlock);
    return `<section class="chapter" id="${esc(c.id)}">
  <h2><span class="num">${esc(chapterNum(c))}</span>${inline(c.title, L)}</h2>
  ${c.intro ? `<p class="intro">${inline(c.intro, L)}</p>` : ""}
  ${blocks.map((b) => renderBlock(b, ctx)).join("\n  ")}
  ${uptoBlock == null ? `<p class="back"><a href="#contents">${esc(ui.backToContents)}</a></p>` : ""}
</section>`;
  };

  // Figure numbers run through the whole manual; remember where each chapter starts.
  let base = 0;
  for (const c of M.chapters) { c.figureBase = base; base += c.blocks.filter((b) => b && b.figure).length; }
  let body;
  if (opts.upto) {
    const { chapterIndex, uptoBlock } = opts.upto;
    body = M.chapters.slice(0, chapterIndex).map((c) => chapterHtml(c)).join("\n");
    if (uptoBlock > 0) {
      const c = M.chapters[chapterIndex];
      const cut = { ...c, blocks: c.blocks.slice(0, uptoBlock).map((b, i, arr) => (i === arr.length - 1 ? truncateBlock(b) : b)) };
      body += "\n" + chapterHtml(cut, uptoBlock);
    }
  } else {
    body = M.chapters.map((c) => chapterHtml(c)).join("\n");
  }

  const front = `<div class="cover">
  <div class="rule"></div>
  <h1>${esc(M.title)}</h1>
  <p class="sub">${esc(M.subtitle)}</p>
  <p class="meta">${esc(M.coverMeta.replace("{date}", new Date().toISOString().slice(0, 10)).replace("{chapters}", String(M.chapters.length)))}</p>
  <p class="aud">${esc(M.audience)}</p>
</div>
<nav class="toc">
  <h2 id="contents">${esc(ui.contents)}</h2>
  <ol>
    ${toc}
  </ol>
</nav>`;

  const html = `<!doctype html>
<html lang="${esc(M.lang)}" dir="${esc(M.dir || "ltr")}">
<head><meta charset="utf-8"><title>${esc(M.title)}</title>
<style>${CSS.replace("{{FOOTER}}", esc(M.title).replace(/"/g, '\\"'))}</style></head>
<body>
${front}
${body}
</body></html>`;
  return { html, ctx };
}

// ── Chrome ─────────────────────────────────────────────────────────────────
function printPdf(htmlPath, pdfPath) {
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=10000",
    `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`,
  ], { stdio: ["ignore", "ignore", "ignore"], timeout: 120000 });
}
const countPages = (pdfPath) => (readFileSync(pdfPath, "latin1").match(/\/Type\s*\/Page(?![s])/g) || []).length;

// ── Build ──────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const scratch = join(tmpdir(), `fq-manual-${process.pid}`);
mkdirSync(scratch, { recursive: true });

for (const lang of LANGS) {
  const contentPath = join(ROOT, "docs/sales/manual", `content.${lang}.js`);
  if (!existsSync(contentPath)) { console.error(`No content module for "${lang}" — expected docs/sales/manual/content.${lang}.js`); process.exit(1); }
  const { MANUAL: M } = await import(contentPath);
  const L = makeLabeller(lang);

  // Pass 1 — pagination. Front matter, then each chapter alone, then each
  // section's prefix inside its chapter.
  const pages = new Map();
  if (!htmlOnly) {
    const prefixPages = (chapterIndex, uptoBlock, tag) => {
      const doc = buildDocument(M, L, { upto: { chapterIndex, uptoBlock } });
      const hp = join(scratch, `${lang}-${tag}.html`); writeFileSync(hp, doc.html);
      const pp = join(scratch, `${lang}-${tag}.pdf`); printPdf(hp, pp);
      return countPages(pp);
    };
    const starts = [];
    M.chapters.forEach((c, i) => {
      // Everything before this chapter ends on page N; the chapter opens on N+1.
      const before = prefixPages(i, 0, `ch${i}`);
      starts.push(before + 1);
      pages.set(c.id, before + 1);
      c.blocks.forEach((b, bi) => {
        if (!b || !b.h) return;
        pages.set(headingId(c, b), prefixPages(i, Math.min(bi + 2, c.blocks.length), `ch${i}-s${bi}`));
      });
    });
    console.log(`${lang}: chapter start pages ${starts.join(", ")}`);
  }

  // Pass 2 — the real document.
  const { html, ctx } = buildDocument(M, L, { pages });
  const htmlOut = join(OUT_DIR, `fieldquo-sales-manual.${lang}.html`);
  writeFileSync(htmlOut, html);
  const pdfOut = join(OUT_DIR, `FieldQuo-Sales-Portal-Training-Manual-${FILE_SUFFIX[lang] || lang.toUpperCase()}.pdf`);
  if (!htmlOnly) {
    printPdf(htmlOut, pdfOut);
    const total = countPages(pdfOut);
    const expected = pages.size ? Math.max(...pages.values()) : 0;
    console.log(`${lang}: wrote ${pdfOut} (${total} pages${expected > total ? ` — WARNING: index expects ≥${expected}` : ""})`);
  }
  console.log(`${lang}: ${M.chapters.length} chapters · ${ctx.figuresReal.length} real figures · ${ctx.figuresPlaceholder.length} placeholders`);
  if (ctx.figuresPlaceholder.length) console.log(`${lang}: placeholders: ${ctx.figuresPlaceholder.join(", ")}`);
  if (L.fellBack.size) console.log(`${lang}: ${L.fellBack.size} labels printed in English (no ${lang} string): ${[...L.fellBack].join(", ")}`);
  if (L.missing.size) { console.error(`${lang}: labels NOT in the catalogue: ${[...L.missing].join(", ")}`); process.exitCode = 1; }
  console.log(`wrote ${htmlOut}`);
}
